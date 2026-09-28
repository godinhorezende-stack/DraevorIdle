// O `?v=` das páginas é o hash do arquivo, calculado ao servir — nunca mais uma
// letra escrita à mão que alguém esquece de trocar (o `main.mjs` ficou dez
// commits atrás no cache de quem abriu o jogo depois de 26/09).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { brotliDecompressSync } from 'node:zlib';
import * as Estaticos from '../backend/estaticos.mjs';

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend');
const TEMP = mkdtempSync(join(tmpdir(), 'draevor-versao-'));
mkdirSync(join(TEMP, 'client'));
writeFileSync(join(TEMP, 'client', 'a.css'), 'body{color:red}');
writeFileSync(
  join(TEMP, 'pagina.html'),
  '<link href="/client/a.css?v=escrito-a-mao"><script src="/client/falta.mjs?v=x"></script><a href="/client/../../fora?v=1">'
);
const hash = (texto) => createHash('sha1').update(texto).digest('hex').slice(0, 10);

let raiz = TEMP;
const servidor = createServer((req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  Estaticos.servir(req, res, join(raiz, caminho)).then((ok) => ok || (res.writeHead(404), res.end()));
});
await new Promise((r) => servidor.listen(0, r));
after(() => {
  servidor.close();
  rmSync(TEMP, { recursive: true, force: true });
});

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

test('o ?v= escrito vira o hash do arquivo; o que não existe (ou sai da raiz) fica como está', async () => {
  raiz = TEMP;
  const r = await pedir('/pagina.html');
  const html = r.corpo.toString();
  assert.match(html, new RegExp(`/client/a\\.css\\?v=${hash('body{color:red}')}"`));
  assert.match(html, /\/client\/falta\.mjs\?v=x"/);
  assert.match(html, /\/client\/\.\.\/\.\.\/fora\?v=1"/);
  assert.equal(r.h['cache-control'], 'no-cache');
});

test('arquivo mudou com a página intocada: ETag nova, e a ETag velha não dá 304', async () => {
  raiz = TEMP;
  const antes = await pedir('/pagina.html');
  writeFileSync(join(TEMP, 'client', 'a.css'), 'body{color:blue}');
  // Data diferente mesmo se o sistema de arquivos arredondar o mtime.
  const t = new Date(Date.now() + 5000);
  utimesSync(join(TEMP, 'client', 'a.css'), t, t);
  const depois = await pedir('/pagina.html', { 'if-none-match': antes.h.etag });
  assert.equal(depois.status, 200, 'com o arquivo novo a página não pode responder 304');
  assert.notEqual(depois.h.etag, antes.h.etag);
  assert.match(depois.corpo.toString(), new RegExp(`\\?v=${hash('body{color:blue}')}"`));
  const denovo = await pedir('/pagina.html', { 'if-none-match': depois.h.etag });
  assert.equal(denovo.status, 304, 'sem mudança, 304 como sempre');
});

test('jogar.html de verdade: main.mjs e style.css com o hash do conteúdo, também em Brotli', async () => {
  raiz = FRONTEND;
  const r = await pedir('/jogar.html', { 'accept-encoding': 'br' });
  assert.equal(r.h['content-encoding'], 'br');
  const html = brotliDecompressSync(r.corpo).toString();
  for (const arq of ['client/style.css', 'client/src/main.mjs']) {
    const v = hash(readFileSync(join(FRONTEND, arq)));
    assert.ok(html.includes(`/${arq}?v=${v}"`), `${arq} deveria ir com ?v=${v}`);
  }
});
