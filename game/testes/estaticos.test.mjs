// Os arquivos do site (fase 2 de "deixar o jogo mais leve"): comprimidos, com
// ETag/304, um ano só para URL com versão, e o arquivo grande em fluxo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import * as Estaticos from '../backend/estaticos.mjs';

// game/frontend (client/, HTML) e game/gamedata (JSON de conteúdo + sprites)
// são duas pastas separadas desde a refatoração pra `game/*` — o servidor de
// verdade (game/backend/index.mjs) roteia `/gamedata/...` pra uma e o resto
// pra outra; este teste imita o mesmo roteamento, só que sem `/packages/shared`
// (Estaticos.servir não sabe nada disso, é genérico).
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend');
const RAIZ_GAMEDATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
const servidor = createServer((req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const alvo = caminho.startsWith('/gamedata/') ? join(RAIZ_GAMEDATA, caminho.slice('/gamedata/'.length)) : join(RAIZ, caminho);
  Estaticos.servir(req, res, alvo).then((ok) => ok || (res.writeHead(404), res.end()));
});
await new Promise((r) => servidor.listen(0, r));
after(() => servidor.close());

function pedir(caminho, cabecalhos = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ port: servidor.address().port, path: caminho, headers: cabecalhos }, (res) => {
      const partes = [];
      res.on('data', (p) => partes.push(p));
      res.on('end', () => resolve({ status: res.statusCode, h: res.headers, corpo: Buffer.concat(partes) }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('JS em Brotli (ou gzip) e o conteúdo volta idêntico', async () => {
  // `.equals`, não `deepEqual`: num erro, o diff de dois Buffers de 1 MB
  // estoura a memória (RangeError) em vez de dizer o que houve.
  const original = readFileSync(join(RAIZ, 'client/src/panels.mjs'));
  const br = await pedir('/client/src/panels.mjs', { 'accept-encoding': 'gzip, deflate, br' });
  assert.equal(br.h['content-encoding'], 'br');
  assert.ok(br.corpo.length < original.length / 3, `${br.corpo.length} de ${original.length}`);
  assert.ok(brotliDecompressSync(br.corpo).equals(original), 'o Brotli não volta idêntico à fonte');
  const gz = await pedir('/client/src/panels.mjs', { 'accept-encoding': 'gzip' });
  assert.equal(gz.h['content-encoding'], 'gzip');
  assert.ok(gunzipSync(gz.corpo).equals(original), 'o gzip não volta idêntico à fonte');
  const cru = await pedir('/client/src/panels.mjs');
  assert.equal(cru.h['content-encoding'], undefined);
  assert.ok(cru.corpo.equals(original), 'o cru não é a fonte');
});

test('ETag: a segunda visita recebe 304 sem corpo', async () => {
  const um = await pedir('/client/style.css');
  assert.ok(um.h.etag);
  assert.equal(um.h['cache-control'], 'no-cache');
  const dois = await pedir('/client/style.css', { 'if-none-match': um.h.etag });
  assert.equal(dois.status, 304);
  assert.equal(dois.corpo.length, 0);
});

test('com ?v= na URL: um ano e immutable', async () => {
  const r = await pedir('/client/style.css?v=muemytzi');
  assert.match(r.h['cache-control'], /max-age=31536000.*immutable/);
});

test('imagem grande de hunt vai inteira, sem compressão (já é PNG)', async () => {
  const dir = join(RAIZ_GAMEDATA, 'sprites/hunts');
  const grande = readdirSync(dir).map((f) => ({ f, n: statSync(join(dir, f)).size })).sort((a, b) => b.n - a.n)[0];
  const r = await pedir(`/gamedata/sprites/hunts/${grande.f}`, { 'accept-encoding': 'br' });
  assert.equal(r.status, 200);
  assert.equal(r.h['content-encoding'], undefined);
  assert.equal(r.corpo.length, grande.n);
});

test('arquivo que não existe: quem chama dá o 404', async () => {
  assert.equal((await pedir('/nao/existe.js')).status, 404);
});

test('PNG com WebP ao lado: quem aceita WebP recebe o WebP; o resto, o PNG', async () => {
  const caminho = '/client/assets/icons/aba-arena.png';
  const png = readFileSync(join(RAIZ, caminho));
  const webp = readFileSync(join(RAIZ, `${caminho}.webp`));
  const doNavegador = await pedir(caminho, { accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' });
  assert.equal(doNavegador.h['content-type'], 'image/webp');
  assert.equal(doNavegador.h.vary, 'Accept');
  assert.deepEqual(doNavegador.corpo, webp);
  assert.ok(webp.length < png.length / 5, `${webp.length} de ${png.length}`);
  const semWebp = await pedir(caminho, { accept: 'image/png,*/*' });
  assert.equal(semWebp.h['content-type'], 'image/png');
  assert.deepEqual(semWebp.corpo, png);
  // O 304 da segunda visita vale para a variante que o navegador tem.
  const denovo = await pedir(caminho, { accept: 'image/webp', 'if-none-match': doNavegador.h.etag });
  assert.equal(denovo.status, 304);
});
