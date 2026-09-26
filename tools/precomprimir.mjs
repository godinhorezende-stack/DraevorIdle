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
// Uso: node tools/precomprimir.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const RAIZ_FRONTEND = fileURLToPath(new URL('../game/frontend', import.meta.url));
const RAIZ_GAMEDATA = fileURLToPath(new URL('../game/gamedata', import.meta.url));
const TEXTO = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);
const MINIMO = 1024; // mesmo limiar do `servir`: arquivo pequeno não compensa.

/**
 * Os diretórios com estático servido por HTTP de verdade — não
 * `gamedata/hunts`, multi-MB e só lido pelo servidor via `dados.mjs`.
 * `client/` e `gamedata/` viraram duas pastas físicas separadas na
 * refatoração pra `game/*` (docs/refatoracao-estrutura.md) — cada uma com a
 * sua própria raiz, em vez de duas subpastas de uma raiz só.
 */
const ALVOS = [
  { dir: join(RAIZ_FRONTEND, 'client'), recursivo: true },
  { dir: RAIZ_GAMEDATA, recursivo: false },
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

let feitos = 0;
let pulados = 0;
for (const { dir, recursivo } of ALVOS) {
  // `client/`: bundle inteiro, subpastas incluídas. `gamedata/`: só o nível
  // solto (outfits.json, item-sprites.json...) — as pastas dentro (hunts/,
  // sprites/) são dados do servidor ou imagem, não texto servido por HTTP.
  for (const alvo of arquivos(dir, recursivo)) {
    const ext = extname(alvo).toLowerCase();
    if (!TEXTO.has(ext)) continue;
    const st = statSync(alvo);
    if (st.size < MINIMO) continue;
    const brAlvo = `${alvo}.br`;
    const gzAlvo = `${alvo}.gz`;
    let brStale = true;
    let gzStale = true;
    try { brStale = statSync(brAlvo).mtimeMs < st.mtimeMs; } catch {}
    try { gzStale = statSync(gzAlvo).mtimeMs < st.mtimeMs; } catch {}
    if (!brStale && !gzStale) { pulados++; continue; }
    const corpo = readFileSync(alvo);
    if (brStale) writeFileSync(brAlvo, brotliCompressSync(corpo, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: corpo.length } }));
    if (gzStale) writeFileSync(gzAlvo, gzipSync(corpo, { level: 9 }));
    feitos++;
  }
}
console.log(`precomprimir: ${feitos} arquivo(s) novo(s)/mudado(s), ${pulados} já em dia.`);
