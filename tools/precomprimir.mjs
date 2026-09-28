// Fase 5.3: comprime os estáticos (JS/CSS/HTML/SVG do cliente, os `.json`
// soltos de `gamedata/` que o cliente busca por HTTP) no BUILD, não na hora.
//
// `game/backend/estaticos.mjs` fazia Brotli síncrono no request — memorizado (só
// paga 1x por arquivo por processo), mas ainda sim: a 1ª visita depois de
// cada deploy trava o event loop pelo tanto que o Brotli qualidade 9 demorar
// num arquivo de 1 MB, bem na hora em que todo mundo está reconectando. Este
// script escreve `<arquivo>.br`/`<arquivo>.gz` ao lado (mesmo padrão do
// `<png>.webp`, já usado para imagem — ver `tools/imagens/converter.mjs` e
// `webpNoLugar` em `game/backend/estaticos.mjs`): `servir` passa a preferir o
// arquivo pronto, e só cai para o síncrono se o par não existir (arquivo
// novo, editado na mão em dev — nunca quebra, só fica mais lento até rodar
// isto de novo).
//
// Os pares NÃO vão pro git (.gitignore): são saída de build, e versionados
// apodreciam. `scripts/deploy.sh` roda isto a cada deploy, no checkout que o
// container monta, e aborta se falhar. E `servir` só usa um par que
// descomprime exatamente para a fonte — um esquecido nunca vai ao ar errado.
//
// Uso:
//   node tools/precomprimir.mjs              # gera o que falta/mudou e confere tudo
//   node tools/precomprimir.mjs --verificar  # só confere (não escreve nada)
// Sai com código 1 se algum par ficar faltando ou errado.
import { readdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brotliCompressSync, brotliDecompressSync, gzipSync, gunzipSync, constants } from 'node:zlib';

const RAIZ_REPO = fileURLToPath(new URL('..', import.meta.url));
const TEXTO = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);
export const MINIMO = 1024; // mesmo limiar do `servir`: arquivo pequeno não compensa.

/**
 * Os diretórios com estático servido por HTTP de verdade — não
 * `gamedata/hunts`, multi-MB e só lido pelo servidor via `dados.mjs`.
 * `client/` e `gamedata/` viraram duas pastas físicas separadas na
 * refatoração pra `game/*` (docs/refatoracao-estrutura.md) — cada uma com a
 * sua própria raiz, em vez de duas subpastas de uma raiz só.
 * `client/`: bundle inteiro, subpastas incluídas. `gamedata/`: só o nível
 * solto (outfits.json, item-sprites.json...) — as pastas dentro (hunts/,
 * sprites/) são dados do servidor ou imagem, não texto servido por HTTP.
 */
export const ALVOS = [
  { dir: join(RAIZ_REPO, 'game', 'frontend', 'client'), recursivo: true },
  { dir: join(RAIZ_REPO, 'game', 'gamedata'), recursivo: false },
];

/** Os dois formatos: como comprimir (sempre com os mesmos parâmetros — mesma fonte, mesmos bytes) e como abrir. */
const FORMATOS = [
  { sufixo: 'br', abrir: brotliDecompressSync, comprimir: (c) => brotliCompressSync(c, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: c.length } }) },
  { sufixo: 'gz', abrir: gunzipSync, comprimir: (c) => gzipSync(c, { level: 9 }) },
];

function* arquivos(dir, recursivo) {
  for (const nome of readdirSync(dir, { withFileTypes: true })) {
    const alvo = join(dir, nome.name);
    if (nome.isDirectory()) {
      if (recursivo) yield* arquivos(alvo, true);
      continue;
    }
    yield alvo;
  }
}

/** Cada fonte que precisa de par: texto servido, com pelo menos `MINIMO` bytes. */
function* fontes(alvos) {
  for (const { dir, recursivo } of alvos) {
    for (const alvo of arquivos(dir, recursivo)) {
      if (!TEXTO.has(extname(alvo).toLowerCase())) continue;
      const corpo = readFileSync(alvo);
      if (corpo.length >= MINIMO) yield { alvo, corpo };
    }
  }
}

/*
 * ---- Desatualizado é CONTEÚDO diferente, não data ----
 *
 * Num `git clone` (e em todo deploy) os arquivos ganham a hora do checkout, e
 * um `.br` velho passava por novo. Foi assim que 31 pares ficaram com o
 * conteúdo de antes do rebrand (o `item-sprites.json.br` apontava para
 * `ravoxb7e57432-0.png`, 404 no client), e depois 51 de 69 com conteúdo
 * velho ou CRLF x LF. Então: descomprime o pronto e compara com a fonte —
 * descomprimir é barato perto de comprimir.
 */
function emDia(pronto, corpo, abrir) {
  try {
    return abrir(readFileSync(pronto)).equals(corpo);
  } catch {
    return false; // não existe, ou não descomprime (corrompido/cortado)
  }
}

/**
 * Gera o que falta ou está errado. Escreve num temporário e renomeia por cima
 * — o servidor, rodando, nunca lê um par pela metade — e confere o par
 * escrito antes de dar por feito. Nunca toca na fonte.
 */
export function precomprimir(alvos = ALVOS) {
  let feitos = 0;
  let pulados = 0;
  for (const { alvo, corpo } of fontes(alvos)) {
    let mexeu = false;
    for (const { sufixo, abrir, comprimir } of FORMATOS) {
      const pronto = `${alvo}.${sufixo}`;
      if (emDia(pronto, corpo, abrir)) continue;
      const bytes = comprimir(corpo);
      if (!abrir(bytes).equals(corpo)) throw new Error(`precomprimir: ${sufixo} de ${alvo} não volta idêntico à fonte`);
      const temporario = `${pronto}.${process.pid}.tmp`;
      try {
        writeFileSync(temporario, bytes);
        renameSync(temporario, pronto);
      } finally {
        rmSync(temporario, { force: true });
      }
      mexeu = true;
    }
    if (mexeu) feitos++;
    else pulados++;
  }
  return { feitos, pulados };
}

/** Confere, sem escrever: toda fonte tem `.br` e `.gz` que descomprimem EXATAMENTE para ela. */
export function verificar(alvos = ALVOS) {
  const errados = [];
  let conferidos = 0;
  for (const { alvo, corpo } of fontes(alvos)) {
    for (const { sufixo, abrir } of FORMATOS) {
      conferidos++;
      if (!emDia(`${alvo}.${sufixo}`, corpo, abrir)) errados.push(`${alvo}.${sufixo}`);
    }
  }
  return { conferidos, errados };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const soVerificar = process.argv.includes('--verificar');
  if (!soVerificar) {
    const { feitos, pulados } = precomprimir();
    console.log(`precomprimir: ${feitos} arquivo(s) novo(s)/mudado(s), ${pulados} já em dia.`);
  }
  const { conferidos, errados } = verificar();
  if (errados.length) {
    console.error(`precomprimir: ${errados.length} par(es) faltando ou diferente(s) da fonte:`);
    for (const e of errados) console.error(`  ${relative(RAIZ_REPO, e)}`);
    process.exit(1);
  }
  console.log(`precomprimir: ${conferidos} par(es) conferido(s), todos idênticos à fonte.`);
}
