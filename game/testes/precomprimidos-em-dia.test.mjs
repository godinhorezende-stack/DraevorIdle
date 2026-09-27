// Todo `.br`/`.gz` do repositório descomprime EXATAMENTE para o arquivo ao lado.
//
// `game/backend/estaticos.mjs` serve o pronto no lugar da fonte quando a data
// dele não é mais velha — e num `git clone`/deploy as datas são todas a do
// checkout. Um par esquecido vai ao ar como está: 31 pares ficaram com o
// conteúdo de antes do rebrand (o `item-sprites.json.br` pedia
// `ravoxb7e57432-0.png`, 404 no client). Conserto: `node tools/precomprimir.mjs`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
// Os mesmos alvos de `tools/precomprimir.mjs`.
const ALVOS = [
  [join(RAIZ, 'frontend', 'client'), true],
  [join(RAIZ, 'gamedata'), false],
];

function* arquivos(dir, recursivo) {
  for (const n of readdirSync(dir, { withFileTypes: true })) {
    const alvo = join(dir, n.name);
    if (n.isDirectory()) {
      if (recursivo) yield* arquivos(alvo, true);
    } else yield alvo;
  }
}

test('cada .br/.gz é a fonte ao lado, byte a byte', () => {
  const errados = [];
  let conferidos = 0;
  for (const [dir, recursivo] of ALVOS) {
    for (const alvo of arquivos(dir, recursivo)) {
      const abrir = alvo.endsWith('.br') ? brotliDecompressSync : alvo.endsWith('.gz') ? gunzipSync : null;
      if (!abrir) continue;
      const fonte = alvo.slice(0, -3);
      conferidos++;
      if (!existsSync(fonte)) errados.push(`${alvo} (sem a fonte)`);
      else if (!abrir(readFileSync(alvo)).equals(readFileSync(fonte))) errados.push(alvo.slice(RAIZ.length));
    }
  }
  assert.ok(conferidos > 0, 'nenhum pré-comprimido encontrado');
  assert.deepEqual(errados, [], 'rode `node tools/precomprimir.mjs`');
});
