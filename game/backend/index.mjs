// Gateway: serve o cliente extraído por HTTP e roda o jogo por WebSocket em `/ws`
// — os dois mesmos caminhos que `ravoxidle.com.br` servia (ver api-mapeada/protocolo.md).
import { createServer } from 'node:http';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Sessao, vivas, ligarRelogio } from '../websocket/sessao.mjs';
import * as ConteudoHttp from '../admin/conteudo-http.mjs';
import { ehPrivado } from './privados.mjs';
import * as Mapas from '../admin/mapas.mjs';
import * as Estaticos from './estaticos.mjs';
import * as Site from '../systems/site.mjs';
import * as DropsDoSite from '../systems/drops-do-site.mjs';
import * as Guildas from '../systems/guildas.mjs';
import * as Wiki from '../systems/wiki.mjs';
import * as Limites from '../websocket/limites.mjs';
import { aquecerGrades } from '../systems/cacadas.mjs';
import * as ConsolidacaoOffline from '../systems/consolidacao-offline.mjs';
import * as Ausentes from '../systems/ausentes.mjs';
import * as Presentes from '../systems/presentes.mjs';
import * as LimpezaDoChao from '../systems/limpeza-do-chao.mjs';
import * as Party from '../systems/party.mjs';
import * as ServerSave from '../systems/server-save.mjs';
import * as Manutencao from '../systems/modo-de-manutencao.mjs';
import * as ModoBeta from '../systems/modo-beta.mjs';
import * as Operacao from '../admin/operacao.mjs';
import { criarAcesso } from '../admin/acesso.mjs';
import { contaPorEmail, conferirSenha } from '../database/banco.mjs';
import { criarGuarda } from '../admin/acesso-http.mjs';
import { validarConfig as validarServerSave } from '../systems/server-save-config.mjs';

Site.ligar(vivas);
// Quem caça de aba fechada entra no número de online (ver `ausentes.mjs`).
Ausentes.ligar(vivas);
// Os presentes da equipe: quem está online recebe na hora (ver `presentes.mjs`).
Presentes.ligar(vivas);
// Quem caça de aba fechada sobe no ranking do dia sem esperar logar
// (ver `consolidacao-offline.mjs`).
ConsolidacaoOffline.ligar();

// O cliente extraído (HTML + `client/`) — mesma sub-estrutura de sempre
// (`/client/...`, `/jogar.html`, etc.), só que a raiz física virou
// `game/frontend` em vez de `assets_raw` (docs/refatoracao-estrutura.md).
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend');
// O cliente (extraído, sem bundler) pede estes arquivos por URL absoluta
// (`/packages/shared/src/formulas.mjs`, etc.) — igual ao servidor de
// verdade, que também os lê. Desde a refatoração pra `game/*`
// (docs/refatoracao-estrutura.md) o arquivo físico mora em `game/engine/`,
// não mais em `assets_raw/packages/shared/src/`; a URL fica a MESMA (o
// cliente extraído não muda) — só o caminho físico por trás dela.
const RAIZ_ENGINE = join(dirname(fileURLToPath(import.meta.url)), '..', 'engine');
// Idem para `/gamedata/...` (JSON de conteúdo + sprites que o cliente busca
// por URL): a pasta virou `game/gamedata`, separada do frontend — não é
// código de cliente, é conteúdo que o SERVIDOR também lê (ver
// `game/systems/dados.mjs` etc.), só que por acaso também serve de estático.
const RAIZ_GAMEDATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
const PORTA = Number(process.env.PORTA ?? 8080);

// Rotas sem extensão que o cliente pede como página (`/jogar`, etc.).
const PAGINAS = {
  '/': '/index.html',
  '/jogar': '/jogar.html',
  '/online': '/online.html',
  '/streamers': '/streamers.html',
  '/guildas': '/guildas.html',
  '/wiki': '/wiki.html',
  '/personagem': '/personagem.html',
  '/editor': '/editor.html',
  '/editor/conteudo': '/editor-conteudo.html',
  '/editor/login': '/editor-login.html',
};
// As páginas da Engine que exigem sessão de administrador (a de login não): sem sessão, o servidor leva ao login ANTES de entregar a página.
const PAGINAS_DA_ENGINE = new Set(['/editor', '/editor/conteudo']);

const PREFIXO_ENGINE = '/packages/shared/src/';
const PREFIXO_GAMEDATA = '/gamedata/';

/** Arquivo estático — cache e compressão: ver `estaticos.mjs`. */
async function servirArquivo(req, res, caminho) {
  if (caminho.startsWith(PREFIXO_ENGINE)) {
    const alvo = normalize(join(RAIZ_ENGINE, caminho.slice(PREFIXO_ENGINE.length)));
    if (!alvo.startsWith(RAIZ_ENGINE)) return false;
    return Estaticos.servir(req, res, alvo);
  }
  if (caminho.startsWith(PREFIXO_GAMEDATA)) {
    const alvo = normalize(join(RAIZ_GAMEDATA, caminho.slice(PREFIXO_GAMEDATA.length)));
    if (!alvo.startsWith(RAIZ_GAMEDATA)) return false;
    // Conteúdo secreto (encontros, bosses únicos): o servidor lê, o público não baixa.
    if (ehPrivado(alvo.slice(RAIZ_GAMEDATA.length + 1).split('\\').join('/'))) return false;
    return Estaticos.servir(req, res, alvo);
  }
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
    req.on('data', (pedaco) => {
      dados += pedaco;
      // Teto do corpo (as folhas de sprites do editor vão em base64: algumas centenas de KB a poucos MB).
      if (dados.length > 24 * 1024 * 1024) { reject(new Error('Corpo grande demais (máximo 24 MB).')); req.destroy(); }
    });
    req.on('end', () => {
      try {
        resolve((req.corpoAuditado = dados ? JSON.parse(dados) : null));
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

// O acesso à Engine: contas do jogo cujo e-mail está em `gamedata/engine.json` (ou ENGINE_ADMINS); ver `admin/acesso.mjs`.
const acessoDaEngine = criarAcesso({ deps: { contaPorEmail, conferirSenha } });
const guardaDaEngine = criarGuarda(acessoDaEngine);

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
  // O editor de conteúdo (fases, encontros, bosses): sob `/api/mapas/_conteudo/`, o prefixo que o nginx já tranca.
  /*
   * O Server Save e o modo de manutenção, por administrador: sob o mesmo prefixo trancado do editor de conteúdo
   * (o nginx de produção só deixa passar por túnel SSH). GET = situação e últimos ciclos; POST {acao:'executar'}
   * roda um save agora; POST {acao:'manutencao', ativo:true|false} liga/desliga o bloqueio de entradas.
   */
  // O ACESSO à Engine (login de administrador + gravação desligada em produção): vale para TODA rota /api/mapas*, antes de qualquer outra.
  if (await guardaDaEngine(req, res, caminho, { json, corpoJson })) return;
  // O modo beta (acesso livre para testar): GET = situação; POST {ativo:true|false} liga/desliga em tempo de execução.
  if (caminho === '/api/mapas/_conteudo/modo-beta') {
    if (req.method === 'GET') return json(res, 200, { ativo: ModoBeta.ativo() });
    if (req.method === 'POST') {
      const dados = await corpoJson(req).catch(() => null);
      const r = Operacao.definirBeta(dados?.ativo);
      return json(res, r.ok ? 200 : 400, r);
    }
  }
  if (caminho === '/api/mapas/_conteudo/server-save') {
    if (req.method === 'GET') return json(res, 200, { situacao: ServerSave.situacao(), manutencao: Manutencao.bloqueada(), ciclos: await ServerSave.ultimosCiclos(10) });
    if (req.method === 'POST') {
      const dados = await corpoJson(req).catch(() => null);
      if (dados?.acao === 'executar') return json(res, 200, await Operacao.executarServerSave());
      if (dados?.acao === 'manutencao') return json(res, 200, { ok: true, manutencao: Operacao.definirManutencao(!!dados.ativo, typeof dados.mensagem === 'string' ? dados.mensagem : null).ativa });
      return json(res, 400, { ok: false, erros: ['acao deve ser "executar" ou "manutencao".'] });
    }
  }
  if (await ConteudoHttp.atender(req, res, caminho, url, { json, corpoJson })) return;
  if (caminho === '/api/mapas/opcoes' && req.method === 'GET') {
    return json(res, 200, { bestiario: Mapas.bestiarioParaEditor(), paleta: Mapas.PALETA_DO_EDITOR, cidade: Mapas.cidadeParaEditor(), criaturasPorHunt: Mapas.criaturasPorHunt(), ...Mapas.raridadesParaEditor() });
  }
  // O detalhamento dos atributos de um monstro (com a origem de cada parcela), para o editor de mapas.
  if (caminho === '/api/mapas/atributos-do-mob' && req.method === 'GET') {
    const q = url.searchParams;
    return json(res, 200, Mapas.atributosDoMob({ key: q.get('key'), level: q.get('level'), raridade: q.get('raridade') ?? 'normal', modificadores: (q.get('mods') ?? '').split(',').filter(Boolean) }));
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

  /*
   * ---- As APIs públicas do site (capa, /online, /personagem, /guildas) ----
   *
   * Só leitura, sem conta: é o que ravoxidle.com.br responde para quem ainda
   * nem entrou no jogo. Ver `game/systems/site.mjs` e `game/systems/drops-do-site.mjs`.
   */
  if (req.method === 'GET' && caminho.startsWith('/api/')) {
    const q = url.searchParams;
    if (caminho === '/api/status') return json(res, 200, await Site.status(q.get('ranking') ?? 'level'));
    if (caminho === '/api/online') return json(res, 200, Site.jogadoresOnline());
    if (caminho === '/api/drops') return json(res, 200, await DropsDoSite.vista());
    if (caminho === '/api/personagem') return json(res, 200, await Site.personagem(q.get('nome')));
    if (caminho === '/api/wiki/itens') return json(res, 200, Wiki.itens());
    if (caminho === '/api/guildas') return json(res, 200, { guildas: await Guildas.listaDoSite() });
    if (caminho === '/api/guilda') return json(res, 200, await Guildas.fichaDoSite(q.get('nome')));
  }

  // A wiki: `/wiki` e `/wiki/<artigo>` são a mesma página (o artigo vem do caminho, lido por `client/site/wiki.mjs`).
  if (PAGINAS_DA_ENGINE.has(caminho) && acessoDaEngine.precisaDeLogin(req.headers.cookie)) {
    res.writeHead(302, { location: `/editor/login?voltar=${encodeURIComponent(caminho)}`, 'cache-control': 'no-store' });
    return res.end();
  }
  const alvo = PAGINAS[caminho] ?? (caminho.startsWith('/wiki/') && !caminho.includes('.') ? '/wiki.html' : caminho);
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
  // Mensagem maior que isto fecha a conexão antes do `JSON.parse` (ver `game/websocket/limites.mjs`).
  maxPayload: Limites.TAMANHO_MAXIMO,
});
// Mesma razão do `ws.on('error', ...)` de cada conexão: sem isto, um erro do
// SERVIDOR de WebSocket (porta ocupada, etc.) também derruba o processo.
wss.on('error', (e) => console.error('wss', e.message));

wss.on('connection', (ws) => {
  const s = new Sessao(ws);
  s.ola();
  const ritmo = new Limites.Ritmo();

  ws.on('message', (raw) => {
    // Acima do ritmo, a mensagem nem é lida; insistindo, a conexão cai
    // (1008 = violação de política). O cliente de verdade nunca chega perto.
    if (!ritmo.aceitar()) {
      if (ritmo.abusou) ws.close(1008, 'mensagens demais');
      return;
    }
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

/*
 * ---- As grades de hunt, aquecidas ANTES de abrir a porta ----
 *
 * `aquecerGrades` (Fase 5.2) chama `gradeDaHunt` de toda hunt jogável agora,
 * com o event loop livre e ninguém conectado para sentir a pausa — em vez de
 * deixar a conta (até 350ms, síncrono) cair em cima de quem por acaso for o
 * primeiro a entrar numa hunt cara depois do boot, travando o tique de todo
 * mundo online naquele instante.
 */
const t0 = performance.now();
const quantas = aquecerGrades();
console.log(`  grades de hunt aquecidas: ${quantas} em ${(performance.now() - t0).toFixed(0)}ms`);

// A limpeza automática do chão (a cada 60 min, com aviso 1 min antes — `limpeza-do-chao.mjs`).
LimpezaDoChao.ligar(vivas);
LimpezaDoChao.iniciar();
// O Server Save diário (05:00, America/Sao_Paulo) — não mexe no offline farm (ver `server-save.mjs`, docs/server-save.md).
ServerSave.ligar(vivas);
// As parties gravadas voltam (todos como offline, com prazo para reconectar) — ver `party.mjs`.
console.log(`  parties recarregadas: ${await Party.carregar()}`);
if (validarServerSave().config.maintenanceMode) Manutencao.definir(true);
ServerSave.iniciar().catch((e) => console.error('[SERVER-SAVE] não iniciou ->', e.message));

http.listen(PORTA, () => {
  console.log(`\n  Draevor Idle (restaurado)  ->  http://localhost:${PORTA}/jogar\n`);
});

// Desligando o servidor (Ctrl+C): grava todo mundo que está online antes de sair.
for (const sinal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
  process.on(sinal, () => {
    LimpezaDoChao.parar();
    ServerSave.parar();
    for (const s of vivas.values()) s.soltarPersonagem?.();
    process.exit(0);
  });
}
