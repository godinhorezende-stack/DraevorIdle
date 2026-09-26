// Gateway: serve o cliente extraído por HTTP e roda o jogo por WebSocket em `/ws`
// — os dois mesmos caminhos que `ravoxidle.com.br` servia (ver api-mapeada/protocolo.md).
import { createServer } from 'node:http';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Sessao, vivas, ligarRelogio } from './nucleo/sessao.mjs';
import * as Mapas from './sistemas/mapas.mjs';
import * as Estaticos from './nucleo/estaticos.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets_raw');
const PORTA = Number(process.env.PORTA ?? 8080);

// Rotas sem extensão que o cliente pede como página (`/jogar`, etc.).
const PAGINAS = {
  '/': '/index.html',
  '/jogar': '/jogar.html',
  '/online': '/online.html',
  '/streamers': '/streamers.html',
  '/editor': '/editor.html',
};

/** Arquivo estático de dentro de `assets_raw` (cache e compressão: ver `nucleo/estaticos.mjs`). */
async function servirArquivo(req, res, caminho) {
  const alvo = normalize(join(RAIZ, caminho));
  if (!alvo.startsWith(RAIZ)) return false;
  return Estaticos.servir(req, res, alvo);
}

const http = createServer((req, res) => {
  atender(req, res).catch((e) => {
    console.error('http', req.method, req.url, '->', e.message);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end('erro interno');
    }
  });
});

/** Corpo de um POST, já parseado — só usado pelas rotas de `/api/mapas`. */
function corpoJson(req) {
  return new Promise((resolve, reject) => {
    let dados = '';
    req.on('data', (pedaco) => (dados += pedaco));
    req.on('end', () => {
      try {
        resolve(dados ? JSON.parse(dados) : null);
      } catch {
        reject(new Error('JSON inválido no corpo'));
      }
    });
    req.on('error', reject);
  });
}

function json(res, status, corpo) {
  const texto = JSON.stringify(corpo);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(texto) });
  res.end(texto);
}

async function atender(req, res) {
  const url = new URL(req.url, 'http://x');
  const caminho = decodeURIComponent(url.pathname.split('?')[0]);

  if (caminho === '/saude') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, online: vivas.size }));
  }

  /*
   * ---- A única rota HTTP com verbo além de GET estático ----
   *
   * Tudo mais neste servidor é arquivo estático + `/ws` — o editor de
   * mapas (`/editor`) é a primeira coisa que precisa de um POST de
   * verdade. Sem framework: três `if` bastam pro tamanho disto.
   */
  if (caminho === '/api/mapas/opcoes' && req.method === 'GET') {
    return json(res, 200, { bestiario: Mapas.bestiarioParaEditor(), paleta: Mapas.PALETA_DO_EDITOR });
  }
  if (caminho === '/api/mapas' && req.method === 'GET') {
    return json(res, 200, { ids: Mapas.listar() });
  }
  if (caminho === '/api/mapas' && req.method === 'POST') {
    const dados = await corpoJson(req).catch((e) => ({ __erro: e.message }));
    if (dados?.__erro) return json(res, 400, { ok: false, erro: dados.__erro });
    return json(res, 200, Mapas.salvar(dados));
  }
  if (caminho.startsWith('/api/mapas/') && req.method === 'GET') {
    const id = caminho.slice('/api/mapas/'.length);
    const mapa = Mapas.carregar(id);
    return mapa ? json(res, 200, mapa) : json(res, 404, { ok: false, erro: 'Mapa não encontrado.' });
  }

  const alvo = PAGINAS[caminho] ?? caminho;
  if (await servirArquivo(req, res, alvo)) return;

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('404');
}

// ------------------------------------------------------------- WebSocket

/*
 * Compressão por mensagem (permessage-deflate, que todo navegador negocia
 * sozinho): o jogo fala JSON, que encolhe muito — o `welcome` (mapa da cidade
 * + itens) e os quadros da caçada. Mensagem pequena (< 512 B) vai crua: comprimir
 * custaria mais do que economiza. O contexto fica entre mensagens (padrão do
 * `ws`): quadros parecidos em seguida comprimem ainda mais.
 */
const wss = new WebSocketServer({
  server: http,
  path: '/ws',
  perMessageDeflate: { threshold: 512, zlibDeflateOptions: { level: 6 }, concurrencyLimit: 10 },
});
// Mesma razão do `ws.on('error', ...)` de cada conexão: sem isto, um erro do
// SERVIDOR de WebSocket (porta ocupada, etc.) também derruba o processo.
wss.on('error', (e) => console.error('wss', e.message));

wss.on('connection', (ws) => {
  const s = new Sessao(ws);
  s.ola();

  ws.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    s.receber(m);
  });

  ws.on('close', () => s.desconectar());
  // Sem isto, uma queda seca (rede caiu, browser fechado à força) que emita
  // 'error' antes do 'close' derruba o processo INTEIRO — o Node trata um
  // evento 'error' sem listener como exceção não tratada — e leva todo mundo
  // que estava online junto por causa de uma conexão só.
  ws.on('error', () => s.desconectar());
});

http.on('error', (e) => {
  console.error('http', e.message);
  if (e.code === 'EADDRINUSE') process.exit(1); // este sim é fatal: nada escuta a porta
});

ligarRelogio();

http.listen(PORTA, () => {
  console.log(`\n  Ravox Idle (restaurado)  ->  http://localhost:${PORTA}/jogar\n`);
});

// Desligando o servidor (Ctrl+C): grava todo mundo que está online antes de sair.
for (const sinal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
  process.on(sinal, () => {
    for (const s of vivas.values()) s.soltarPersonagem?.();
    process.exit(0);
  });
}
