// Os arquivos do site (cliente, imagens, dados): cache no navegador e compressão.
//
// Medido antes (2026-09-25): abrir o /jogar baixava 5,2 MB (1 MB de CSS, 2,7 MB
// de JS, 1,2 MB de JSON) em TODA visita — `cache-control: no-cache` sem ETag
// obriga o navegador a baixar de novo, e nada ia comprimido. Cada pedido ainda
// lia o arquivo inteiro do disco.
//
// Agora:
// - ETag (tamanho + data) em tudo: o navegador pergunta "mudou?" e, se não
//   mudou, ouve um 304 sem corpo. Arquivo sem versão na URL continua
//   `no-cache` (pergunta toda vez): os módulos do cliente se importam sem
//   `?v=`, e um arquivo novo no servidor tem de chegar na hora.
// - Com `?v=` na URL (style.css, main.mjs): um ano, `immutable` — versão nova
//   é URL nova.
// - Texto (JS, CSS, JSON, HTML, SVG) vai em Brotli ou gzip, o que o navegador
//   aceitar; a versão comprimida fica em memória até o arquivo mudar.
// - Arquivo grande (as imagens de hunt, até 5 MB) vai do disco em fluxo, sem
//   ocupar memória.
// - PNG com um `<nome>.png.webp` ao lado (tools/imagens/converter.mjs): quem
//   aceita WebP (o `Accept` que o navegador manda para imagem) recebe o WebP no
//   mesmo endereço — o cliente continua pedindo `.png`, nada muda nele.
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

export const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const TEXTO = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);
/** Acima disto o arquivo não fica em memória (as imagens das hunts). */
const MAXIMO_EM_MEMORIA = 2 * 1024 * 1024;

/** caminho → { etag, corpo, br, gz } (enquanto o arquivo não mudar). */
const memoria = new Map();

/** O WebP que substitui este PNG, se existe e não é mais velho que ele. */
async function webpNoLugar(req, alvo, st) {
  if (!(req.headers.accept ?? '').includes('image/webp')) return null;
  try {
    const w = await stat(`${alvo}.webp`);
    return w.isFile() && w.mtimeMs >= st.mtimeMs ? { arquivo: `${alvo}.webp`, st: w } : null;
  } catch {
    return null;
  }
}

const etagDe = (st) => `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;

/** Qual compressão o navegador aceita (Brotli primeiro). */
function codificacao(req) {
  const aceita = req.headers['accept-encoding'] ?? '';
  if (/\bbr\b/.test(aceita)) return 'br';
  if (/\bgzip\b/.test(aceita)) return 'gzip';
  return null;
}

async function emMemoria(alvo, st, etag) {
  const guardado = memoria.get(alvo);
  if (guardado?.etag === etag) return guardado;
  const novo = { etag, corpo: await readFile(alvo) };
  memoria.set(alvo, novo);
  return novo;
}

/**
 * Responde `req` com o arquivo `alvo` (já validado como dentro da raiz).
 * Devolve false quando não é um arquivo (para o 404 de quem chamou).
 */
export async function servir(req, res, alvo) {
  let st;
  try {
    st = await stat(alvo);
  } catch {
    return false;
  }
  if (!st.isFile()) return false;

  const ext = extname(alvo).toLowerCase();
  let tipo = TIPOS[ext] ?? 'application/octet-stream';
  const webp = ext === '.png' ? await webpNoLugar(req, alvo, st) : null;
  if (webp) {
    alvo = webp.arquivo;
    st = webp.st;
    tipo = 'image/webp';
  }
  const etag = etagDe(st);
  const versionado = /[?&]v=/.test(req.url);
  const cabecalho = {
    'content-type': tipo,
    'cache-control': versionado ? 'public, max-age=31536000, immutable' : 'no-cache',
    etag,
    'last-modified': st.mtime.toUTCString(),
  };
  if (TEXTO.has(ext)) cabecalho.vary = 'Accept-Encoding';
  if (ext === '.png') cabecalho.vary = 'Accept';

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, cabecalho);
    res.end();
    return true;
  }

  if (st.size > MAXIMO_EM_MEMORIA) {
    res.writeHead(200, { ...cabecalho, 'content-length': st.size });
    if (req.method === 'HEAD') return res.end(), true;
    createReadStream(alvo).pipe(res);
    return true;
  }

  const arq = await emMemoria(alvo, st, etag);
  let corpo = arq.corpo;
  const cod = TEXTO.has(ext) && corpo.length > 1024 ? codificacao(req) : null;
  if (cod === 'br') {
    arq.br ??= brotliCompressSync(arq.corpo, { params: { [constants.BROTLI_PARAM_QUALITY]: 9, [constants.BROTLI_PARAM_SIZE_HINT]: arq.corpo.length } });
    corpo = arq.br;
  } else if (cod === 'gzip') {
    arq.gz ??= gzipSync(arq.corpo, { level: 9 });
    corpo = arq.gz;
  }
  if (cod) cabecalho['content-encoding'] = cod;
  res.writeHead(200, { ...cabecalho, 'content-length': corpo.length });
  res.end(req.method === 'HEAD' ? undefined : corpo);
  return true;
}
