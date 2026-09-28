// `tools/precomprimir.mjs` deixa todo `.br`/`.gz` descomprimindo EXATAMENTE
// para a fonte ao lado — e `--verificar` (o que o deploy roda) acusa o que não.
//
// Antes este teste conferia os pares VERSIONADOS no git. Eles apodreciam: 31
// com o conteúdo de antes do rebrand (o `item-sprites.json.br` pedia
// `ravoxb7e57432-0.png`, 404 no client), depois 51 de 69 com conteúdo velho
// ou CRLF x LF. Agora os pares são saída de build (.gitignore), gerados no
// deploy — então o que se testa é a ferramenta, numa pasta de mentira.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, brotliDecompressSync, gzipSync, gunzipSync } from 'node:zlib';
import { precomprimir, verificar, MINIMO } from '../../tools/precomprimir.mjs';

const texto = (marca) => `// ${marca}\n${'export const x = 1;\n'.repeat(200)}`;

function montar() {
  const raiz = mkdtempSync(join(tmpdir(), 'precomprimir-'));
  const client = join(raiz, 'client');
  const gamedata = join(raiz, 'gamedata');
  mkdirSync(join(client, 'src'), { recursive: true });
  mkdirSync(join(gamedata, 'hunts'), { recursive: true });
  writeFileSync(join(client, 'src', 'a.mjs'), texto('a'));
  writeFileSync(join(client, 'style.css'), texto('css'));
  writeFileSync(join(client, 'pequeno.js'), 'x'.repeat(MINIMO - 1)); // abaixo do limiar: sem par
  writeFileSync(join(client, 'imagem.png'), Buffer.alloc(4096)); // não é texto: sem par
  writeFileSync(join(gamedata, 'outfits.json'), JSON.stringify({ lista: texto('json') }));
  writeFileSync(join(gamedata, 'hunts', 'grande.json'), texto('hunt')); // subpasta de gamedata: fora
  return { client, gamedata, alvos: [{ dir: client, recursivo: true }, { dir: gamedata, recursivo: false }] };
}

const PARES = (m) => [join(m.client, 'src', 'a.mjs'), join(m.client, 'style.css'), join(m.gamedata, 'outfits.json')];

function confereIdenticos(fonte) {
  const corpo = readFileSync(fonte);
  assert.ok(brotliDecompressSync(readFileSync(`${fonte}.br`)).equals(corpo), `${fonte}.br`);
  assert.ok(gunzipSync(readFileSync(`${fonte}.gz`)).equals(corpo), `${fonte}.gz`);
}

test('gera .br e .gz só para texto servido acima do limiar, e cada um volta idêntico à fonte', () => {
  const m = montar();
  assert.deepEqual(precomprimir(m.alvos), { feitos: 3, pulados: 0 });
  for (const f of PARES(m)) confereIdenticos(f);
  assert.deepEqual(readdirSync(m.client).sort(), ['imagem.png', 'pequeno.js', 'src', 'style.css', 'style.css.br', 'style.css.gz']);
  assert.deepEqual(readdirSync(join(m.gamedata, 'hunts')), ['grande.json']);
  assert.deepEqual(verificar(m.alvos), { conferidos: 6, errados: [] });
});

test('nunca mexe na fonte, e rodar de novo não reescreve nada (mesmos bytes)', () => {
  const m = montar();
  const antes = PARES(m).map((f) => readFileSync(f));
  precomprimir(m.alvos);
  const primeira = PARES(m).map((f) => [readFileSync(`${f}.br`), readFileSync(`${f}.gz`)]);
  assert.deepEqual(precomprimir(m.alvos), { feitos: 0, pulados: 3 });
  PARES(m).forEach((f, i) => {
    assert.ok(readFileSync(f).equals(antes[i]), `a fonte ${f} mudou`);
    assert.ok(readFileSync(`${f}.br`).equals(primeira[i][0]));
    assert.ok(readFileSync(`${f}.gz`).equals(primeira[i][1]));
  });
});

test('fonte editada: o par é refeito com o conteúdo NOVO, mesmo com o par de data mais nova', () => {
  const m = montar();
  precomprimir(m.alvos);
  const fonte = join(m.client, 'src', 'a.mjs');
  writeFileSync(fonte, texto('a, versão 2'));
  const futuro = new Date(Date.now() + 60_000); // como num git checkout: a data não diz nada
  utimesSync(`${fonte}.br`, futuro, futuro);
  utimesSync(`${fonte}.gz`, futuro, futuro);
  assert.deepEqual(verificar(m.alvos).errados, [`${fonte}.br`, `${fonte}.gz`]);
  assert.deepEqual(precomprimir(m.alvos), { feitos: 1, pulados: 2 });
  confereIdenticos(fonte);
  assert.equal(verificar(m.alvos).errados.length, 0);
});

test('par com conteúdo errado, corrompido, cortado ou faltando: --verificar acusa, precomprimir conserta', () => {
  const m = montar();
  precomprimir(m.alvos);
  const [a, css, json] = PARES(m);
  writeFileSync(`${a}.br`, brotliCompressSync(texto('outro conteúdo'))); // .br de outro conteúdo
  writeFileSync(`${a}.gz`, gzipSync(texto('outro conteúdo')));            // .gz de outro conteúdo
  writeFileSync(`${css}.br`, 'isto não é brotli');                        // .br corrompido
  writeFileSync(`${css}.gz`, readFileSync(`${css}.gz`).subarray(0, 40));  // .gz cortado no meio
  writeFileSync(`${json}.gz`, 'isto não é gzip');                         // .gz corrompido
  assert.deepEqual(verificar(m.alvos).errados.sort(), [`${a}.br`, `${a}.gz`, `${css}.br`, `${css}.gz`, `${json}.gz`].sort());
  precomprimir(m.alvos);
  for (const f of PARES(m)) confereIdenticos(f);
  assert.deepEqual(verificar(m.alvos).errados, []);
});

test('sem nenhum par: --verificar acusa todos (é o que faz o deploy abortar)', () => {
  const m = montar();
  assert.equal(verificar(m.alvos).errados.length, 6);
});
