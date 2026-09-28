// Fase 5.3: `servir` tem de preferir o `.br`/`.gz` pronto do build
// (`tools/precomprimir.mjs`) em vez de comprimir na hora — e cair para o
// síncrono de sempre quando o par não existe ou não descomprime para a fonte
// (editada depois do último build, CRLF x LF, data enganosa de checkout), sem
// nunca servir bytes errados.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { mkdtempSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliCompressSync, brotliDecompressSync, gzipSync, gunzipSync, constants } from 'node:zlib';
import * as Estaticos from '../backend/estaticos.mjs';

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

const FORMATOS = {
  br: { cabecalho: 'br', abrir: brotliDecompressSync, comprimir: (c) => brotliCompressSync(c) },
  gz: { cabecalho: 'gzip', abrir: gunzipSync, comprimir: (c) => gzipSync(c) },
};

/** Pede `caminho` em `formato` e exige que o corpo DESCOMPRIMIDO seja exatamente `esperado`. */
async function confere(caminho, formato, esperado) {
  const { cabecalho, abrir } = FORMATOS[formato];
  const r = await pedir(caminho, { 'accept-encoding': cabecalho });
  assert.equal(r.status, 200);
  assert.equal(r.h['content-encoding'], cabecalho);
  assert.ok(abrir(r.corpo).equals(Buffer.from(esperado)), `${caminho} em ${formato} não volta idêntico à fonte`);
  return r.corpo;
}

let n = 0;
/** Uma fonte nova (nome único: `servir` memoriza por caminho) com, opcionalmente, um `.br`/`.gz` ao lado. */
function fonte(pares = {}) {
  const nome = `f${++n}.js`;
  writeFileSync(join(dir, nome), conteudo);
  for (const [sufixo, bytes] of Object.entries(pares)) writeFileSync(join(dir, `${nome}.${sufixo}`), bytes);
  return { nome, caminho: `/${nome}`, arquivo: join(dir, nome) };
}

for (const formato of ['br', 'gz']) {
  const { comprimir } = FORMATOS[formato];

  test(`${formato} correto ao lado: serve o PRONTO (e ele descomprime para a fonte)`, async () => {
    // Mesmo conteúdo, compressão DIFERENTE da que `servir` faria na hora
    // (Brotli 9 / gzip 9): bytes diferentes é só como se prova que veio do
    // arquivo pronto — o que vale é o conteúdo descomprimido, conferido também.
    const pronto = formato === 'br'
      ? brotliCompressSync(conteudo, { params: { [constants.BROTLI_PARAM_QUALITY]: 0 } })
      : gzipSync(conteudo, { level: 1, strategy: constants.Z_HUFFMAN_ONLY });
    const f = fonte({ [formato]: pronto });
    const corpo = await confere(f.caminho, formato, conteudo);
    assert.ok(corpo.equals(pronto), 'devia servir os bytes do arquivo pronto');
  });

  test(`${formato} de OUTRO conteúdo com data mais nova (como num git checkout): ignora, comprime a fonte`, async () => {
    const f = fonte({ [formato]: comprimir(`${conteudo}// velho`) });
    const futuro = new Date(Date.now() + 60_000);
    utimesSync(`${f.arquivo}.${formato}`, futuro, futuro);
    await confere(f.caminho, formato, conteudo);
  });

  test(`${formato} desatualizado (fonte editada depois do build): ignora, comprime a fonte nova`, async () => {
    const f = fonte({ [formato]: comprimir(`${conteudo}// velho`) });
    const antigo = new Date(Date.now() - 60_000);
    utimesSync(`${f.arquivo}.${formato}`, antigo, antigo);
    await confere(f.caminho, formato, conteudo);
  });

  test(`${formato} corrompido: ignora, comprime a fonte`, async () => {
    await confere(fonte({ [formato]: 'isto não é um arquivo comprimido' }).caminho, formato, conteudo);
  });

  test(`${formato} cortado no meio: ignora, comprime a fonte`, async () => {
    await confere(fonte({ [formato]: comprimir(conteudo).subarray(0, 20) }).caminho, formato, conteudo);
  });

  test(`sem ${formato} ao lado: comprime na hora, com o conteúdo certo`, async () => {
    await confere(fonte().caminho, formato, conteudo);
  });

  test(`${formato}: fonte editada com o servidor NO AR — nunca entrega o conteúdo antigo`, async () => {
    const f = fonte({ [formato]: comprimir(conteudo) });
    await confere(f.caminho, formato, conteudo);
    const novo = `${conteudo}// versão 2\n`;
    writeFileSync(f.arquivo, novo); // o par ao lado ficou velho; ninguém rodou o precomprimir
    await confere(f.caminho, formato, novo);
  });
}
