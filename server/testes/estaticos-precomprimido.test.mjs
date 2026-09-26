// Fase 5.3: `servir` tem de preferir o `.br`/`.gz` pronto do build
// (`tools/precomprimir.mjs`) em vez de comprimir na hora — e cair para o
// síncrono de sempre quando o par não existe ou está desatualizado (fonte
// editada depois do último build), sem nunca servir bytes errados.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { mkdtempSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, brotliDecompressSync, gzipSync, gunzipSync } from 'node:zlib';
import * as Estaticos from '../../game/backend/estaticos.mjs';

const dir = mkdtempSync(join(tmpdir(), 'estaticos-'));
const servidor = createServer((req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  Estaticos.servir(req, res, join(dir, caminho)).then((ok) => ok || (res.writeHead(404), res.end()));
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

// Um conteúdo grande o bastante para passar do limiar de 1024 bytes.
const conteudo = `/* teste de precompressão */\n`.repeat(100);

test('com .br/.gz ao lado (mais novos que a fonte): serve o PRONTO, não recomprime na hora', async () => {
  const arquivo = join(dir, 'a.js');
  writeFileSync(arquivo, conteudo);
  // Um `.br` deliberadamente DIFERENTE do que `brotliCompressSync(conteudo)`
  // geraria — só assim dá para provar que veio do arquivo pronto, e não de
  // uma compressão feita na hora que por acaso bateu.
  const brFalso = brotliCompressSync(`${conteudo}// marca-do-pronto`);
  writeFileSync(`${arquivo}.br`, brFalso);
  const gzFalso = gzipSync(`${conteudo}// marca-do-pronto`);
  writeFileSync(`${arquivo}.gz`, gzFalso);

  const br = await pedir('/a.js', { 'accept-encoding': 'br' });
  assert.equal(br.h['content-encoding'], 'br');
  assert.deepEqual(br.corpo, brFalso);
  assert.match(brotliDecompressSync(br.corpo).toString(), /marca-do-pronto/);

  const gz = await pedir('/a.js', { 'accept-encoding': 'gzip' });
  assert.equal(gz.h['content-encoding'], 'gzip');
  assert.deepEqual(gz.corpo, gzFalso);
  assert.match(gunzipSync(gz.corpo).toString(), /marca-do-pronto/);
});

test('sem .br/.gz ao lado: cai para a compressão síncrona de sempre, com o conteúdo certo', async () => {
  const arquivo = join(dir, 'b.js');
  writeFileSync(arquivo, conteudo);
  const br = await pedir('/b.js', { 'accept-encoding': 'br' });
  assert.equal(br.h['content-encoding'], 'br');
  assert.equal(brotliDecompressSync(br.corpo).toString(), conteudo);
});

test('.br desatualizado (fonte editada DEPOIS do build): ignora o pronto velho, recomprime a fonte nova', async () => {
  const arquivo = join(dir, 'c.js');
  writeFileSync(arquivo, 'conteudo velho '.repeat(100));
  const brVelho = brotliCompressSync('conteudo velho '.repeat(100));
  writeFileSync(`${arquivo}.br`, brVelho);
  // O `.br` fica mais VELHO que a fonte: editou o `.js` depois do build.
  const antigo = new Date(Date.now() - 60_000);
  utimesSync(`${arquivo}.br`, antigo, antigo);
  writeFileSync(arquivo, conteudo); // fonte nova, sem novo build

  const br = await pedir('/c.js', { 'accept-encoding': 'br' });
  assert.equal(brotliDecompressSync(br.corpo).toString(), conteudo, 'devia ignorar o .br velho e comprimir a fonte nova');
});
