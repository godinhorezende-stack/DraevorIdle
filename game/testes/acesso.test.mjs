import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import * as A from '../admin/acesso.mjs';
import { criarGuarda } from '../admin/acesso-http.mjs';

const nao = () => false;
const cfg = (env) => A.configuracao({ env, existe: nao, arquivoDeAdmins: '/nao/existe.json' });
const P = '/api/mapas/_conteudo/';

test('AC1. configuração: produção exige login e desliga a gravação; desenvolvimento é livre; variáveis mandam sobre o padrão; admins por e-mail (sem caixa)', () => {
  assert.deepEqual(cfg({ NODE_ENV: 'production', ENGINE_ADMINS: 'God.Rafa365@Gmail.com, outro@x.com' }), { producao: true, exigeLogin: true, grava: false, admins: ['god.rafa365@gmail.com', 'outro@x.com'] });
  assert.deepEqual(cfg({}), { producao: false, exigeLogin: false, grava: true, admins: [] });
  assert.equal(A.configuracao({ env: {}, existe: (p) => p === '/.dockerenv', arquivoDeAdmins: '/x' }).producao, true, 'dentro de container conta como produção');
  assert.equal(cfg({ NODE_ENV: 'production', ENGINE_MODO: 'desenvolvimento' }).producao, false);
  const religa = cfg({ NODE_ENV: 'production', ENGINE_GRAVA: '1', ENGINE_EXIGE_LOGIN: '0' });
  assert.deepEqual([religa.grava, religa.exigeLogin], [true, false], 'ENGINE_GRAVA=1 religa, ENGINE_EXIGE_LOGIN=0 relaxa');
  assert.ok(A.ehAdmin(cfg({ ENGINE_ADMINS: 'a@b.com' }), ' A@B.com '));
  assert.equal(A.ehAdmin(cfg({ ENGINE_ADMINS: 'a@b.com' }), 'z@b.com'), false);
  const arquivo = JSON.parse(readFileSync(new URL('../gamedata/engine.json', import.meta.url), 'utf8'));
  assert.deepEqual(arquivo.admins, ['god.rafa365@gmail.com'], 'a lista do repositório começa pelo dono');
  assert.deepEqual(A.configuracao({ env: {}, existe: nao }).admins, ['god.rafa365@gmail.com'], 'e é a usada quando ENGINE_ADMINS não existe');
});

test('AC2. classificação das rotas: leitura, operação (age no servidor), gravação (arquivo) e o POST que só valida; POST desconhecido = grava (negar por padrão)', () => {
  const c = (m, r) => A.classeDaRota(m, r.startsWith('/api') ? r : P + r);
  for (const r of ['opcoes', 'fases', 'atos-editor', 'hunts/painel', 'biblioteca/lista', 'operacao']) assert.equal(c('GET', r), 'leitura', r);
  for (const r of ['fase/troll-cave/validar', 'mapa/validar', 'bosses/validar', 'atos-editor/validar', 'atos-editor/previa', 'mapas/validar']) assert.equal(c('POST', r), 'leitura', `${r} só valida`);
  for (const r of ['operacao/beta', 'operacao/manutencao', 'operacao/server-save', 'modo-beta', 'server-save']) assert.equal(c('POST', r), 'operacao', r);
  for (const r of ['fase/troll-cave/encontros', 'fase/troll-cave/meta', 'mapa', 'bosses', 'atos-editor', 'atos-editor/meu-ato/restaurar', 'rota-nova-que-ninguem-classificou']) assert.equal(c('POST', r), 'grava', r);
  assert.equal(c('POST', '/api/mapas'), 'grava', 'salvar mapa grava');
  assert.equal(c('GET', '/api/mapas'), 'leitura');
  assert.equal(c('POST', 'auth/entrar'), 'publica');
});

test('AC3. decisão: produção sem login = 401; conta comum = 403; admin lê e opera mas NÃO grava; origem diferente = 403; desenvolvimento libera tudo', () => {
  const prod = cfg({ NODE_ENV: 'production', ENGINE_ADMINS: 'dono@x.com' });
  const d = (config, metodo, rota, sessao, extra = {}) => A.decidir({ config, metodo, caminho: rota.startsWith('/api') ? rota : P + rota, sessao, host: 'engine.local', ...extra });
  assert.equal(d(prod, 'GET', 'opcoes', null).status, 401);
  assert.equal(d(prod, 'GET', 'opcoes', { email: 'jogador@x.com' }).status, 403);
  assert.equal(d(prod, 'GET', 'opcoes', { email: 'dono@x.com' }).ok, true);
  assert.equal(d(prod, 'POST', 'operacao/beta', { email: 'dono@x.com' }).ok, true, 'operar o servidor continua possível em produção');
  assert.equal(d(prod, 'POST', 'atos-editor/validar', { email: 'dono@x.com' }).ok, true);
  const g = d(prod, 'POST', 'atos-editor', { email: 'dono@x.com' });
  assert.deepEqual([g.ok, g.status, g.codigo], [false, 403, 'gravacao-desligada']);
  assert.match(g.erro, /commit/);
  assert.equal(d(prod, 'POST', '/api/mapas', { email: 'dono@x.com' }).codigo, 'gravacao-desligada');
  assert.equal(d(prod, 'POST', 'operacao/beta', { email: 'dono@x.com' }, { origem: 'https://outro.site' }).codigo, 'origem');
  assert.equal(d(prod, 'POST', 'operacao/beta', { email: 'dono@x.com' }, { origem: 'https://engine.local' }).ok, true);
  assert.equal(d(prod, 'GET', 'opcoes', { email: 'dono@x.com' }, { origem: 'https://outro.site' }).ok, true, 'leitura não checa origem');
  const dev = cfg({});
  for (const [m, r] of [['GET', 'opcoes'], ['POST', 'atos-editor'], ['POST', '/api/mapas']]) assert.equal(d(dev, m, r, null).ok, true, `${m} ${r} em dev`);
});

const contas = { 'dono@x.com': { id: 1, email: 'dono@x.com', senha: 'ok-dono' }, 'jogador@x.com': { id: 2, email: 'jogador@x.com', senha: 'ok-jogador' } };
const deps = { contaPorEmail: async (e) => contas[e] ?? null, conferirSenha: async (s, guardada) => s === guardada };

async function subir(env, agora) {
  const acesso = A.criarAcesso({ config: cfg(env), deps, agora });
  const guardar = criarGuarda(acesso);
  const server = createServer(async (req, res) => {
    const json = (r, c, b) => { r.statusCode = c; r.setHeader('content-type', 'application/json'); r.end(JSON.stringify(b)); return true; };
    const corpoJson = (r) => new Promise((ok) => { let t = ''; r.on('data', (x) => (t += x)); r.on('end', () => ok(JSON.parse(t || '{}'))); });
    const caminho = new URL(req.url, 'http://x').pathname;
    if (await guardar(req, res, caminho, { json, corpoJson })) return;
    json(res, 200, { passou: true });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  const chama = (metodo, caminho, { corpo, cookie, origem } = {}) => fetch(base + caminho, { method: metodo, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(origem ? { origin: origem } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined }).then(async (r) => ({ status: r.status, setCookie: r.headers.get('set-cookie'), corpo: await r.json() }));
  return { chama, fechar: () => new Promise((ok) => server.close(ok)), acesso, base };
}
const servidores = [];
after(async () => { for (const s of servidores) await s.fechar(); });

test('AC4. fluxo real em HTTP (produção): sem login 401; senha errada 401; conta comum 403; admin entra, ganha cookie HttpOnly/SameSite e lê; sair invalida', async () => {
  const s = await subir({ NODE_ENV: 'production', ENGINE_ADMINS: 'dono@x.com' });
  servidores.push(s);
  assert.equal((await s.chama('GET', `${P}opcoes`)).status, 401);
  assert.equal((await s.chama('GET', `${P}auth/quem`)).corpo.logado, false);
  assert.equal((await s.chama('POST', `${P}auth/entrar`, { corpo: { email: 'dono@x.com', senha: 'errada' } })).status, 401);
  assert.equal((await s.chama('POST', `${P}auth/entrar`, { corpo: { email: 'jogador@x.com', senha: 'ok-jogador' } })).status, 403);
  assert.equal((await s.chama('POST', `${P}auth/entrar`, { corpo: { email: 'nao@x.com', senha: 'x' } })).status, 401);
  const ok = await s.chama('POST', `${P}auth/entrar`, { corpo: { email: 'DONO@x.com ', senha: 'ok-dono' } });
  assert.equal(ok.status, 200);
  assert.match(ok.setCookie, /engine_sessao=[0-9a-f]{48}/);
  assert.match(ok.setCookie, /HttpOnly/);
  assert.match(ok.setCookie, /SameSite=Strict/);
  assert.match(ok.setCookie, /Path=\/api\/mapas/);
  assert.equal(ok.corpo.config.grava, false);
  const cookie = ok.setCookie.split(';')[0];
  assert.equal((await s.chama('GET', `${P}opcoes`, { cookie })).corpo.passou, true);
  assert.equal((await s.chama('GET', '/api/mapas', { cookie })).status, 200, 'o editor antigo usa o mesmo cookie');
  const quem = (await s.chama('GET', `${P}auth/quem`, { cookie })).corpo;
  assert.deepEqual([quem.logado, quem.admin, quem.email], [true, true, 'dono@x.com']);
  const grava = await s.chama('POST', `${P}atos-editor`, { cookie, corpo: {} });
  assert.deepEqual([grava.status, grava.corpo.codigo], [403, 'gravacao-desligada']);
  assert.equal((await s.chama('POST', `${P}operacao/beta`, { cookie, corpo: { ativo: true } })).status, 200);
  await s.chama('POST', `${P}auth/sair`, { cookie });
  assert.equal((await s.chama('GET', `${P}opcoes`, { cookie })).status, 401, 'depois de sair o cookie não vale mais');
  assert.equal((await s.chama('GET', '/api/status')).status, 200, 'fora de /api/mapas nada muda (o jogo e o site seguem públicos)');
});

test('AC5. limite de tentativas: 5 falhas seguidas bloqueiam o IP por alguns minutos (429), e a janela expira; senha certa depois limpa o contador', async () => {
  let t = 1_000_000;
  const s = await subir({ NODE_ENV: 'production', ENGINE_ADMINS: 'dono@x.com' }, () => t);
  servidores.push(s);
  for (let i = 0; i < 5; i++) assert.equal((await s.chama('POST', `${P}auth/entrar`, { corpo: { email: 'dono@x.com', senha: 'x' } })).status, 401);
  assert.equal((await s.chama('POST', `${P}auth/entrar`, { corpo: { email: 'dono@x.com', senha: 'ok-dono' } })).status, 429, 'bloqueado mesmo com a senha certa');
  t += 11 * 60_000;
  assert.equal((await s.chama('POST', `${P}auth/entrar`, { corpo: { email: 'dono@x.com', senha: 'ok-dono' } })).status, 200, 'a janela expirou');
});

test('AC6. a sessão expira (12 h) e login de outra origem é recusado (CSRF)', async () => {
  let t = 5_000_000;
  const s = await subir({ NODE_ENV: 'production', ENGINE_ADMINS: 'dono@x.com' }, () => t);
  servidores.push(s);
  assert.equal((await s.chama('POST', `${P}auth/entrar`, { corpo: { email: 'dono@x.com', senha: 'ok-dono' }, origem: 'https://site-malicioso.com' })).status, 403);
  const ok = await s.chama('POST', `${P}auth/entrar`, { corpo: { email: 'dono@x.com', senha: 'ok-dono' } });
  const cookie = ok.setCookie.split(';')[0];
  assert.equal((await s.chama('GET', `${P}opcoes`, { cookie })).status, 200);
  const mut = await s.chama('POST', `${P}operacao/beta`, { cookie, corpo: { ativo: false }, origem: 'https://site-malicioso.com' });
  assert.deepEqual([mut.status, mut.corpo.codigo], [403, 'origem']);
  t += A.DURACAO_DA_SESSAO_MS + 1;
  assert.equal((await s.chama('GET', `${P}opcoes`, { cookie })).status, 401, 'sessão vencida');
});

test('AC7. desenvolvimento: sem login e com gravação (a sua máquina continua editando livre); o cookie leva Secure atrás de HTTPS', async () => {
  const dev = await subir({});
  servidores.push(dev);
  assert.equal((await dev.chama('GET', `${P}opcoes`)).status, 200);
  assert.equal((await dev.chama('POST', `${P}atos-editor`, { corpo: {} })).status, 200);
  assert.deepEqual((await dev.chama('GET', `${P}auth/quem`)).corpo.config, { producao: false, exigeLogin: false, grava: true });
  assert.match(A.montarCookie('abc', { seguro: true }), /; Secure/);
  assert.doesNotMatch(A.montarCookie('abc'), /Secure/);
  assert.equal(A.lerCookie('a=1; engine_sessao=xyz; b=2'), 'xyz');
  assert.equal(A.lerCookie(undefined), null);
});

test('AC8. a Engine e o servidor usam o acesso: guarda ligada ANTES das rotas, tela de login, barra e a regra de produção documentada', () => {
  const idx = readFileSync(new URL('../backend/index.mjs', import.meta.url), 'utf8');
  assert.ok(idx.indexOf('guardaDaEngine(req, res, caminho') < idx.indexOf("caminho === '/api/mapas/_conteudo/modo-beta'"), 'o guarda roda antes de qualquer rota /api/mapas');
  const tela = readFileSync(new URL('../frontend/client/src/editor-conteudo.mjs', import.meta.url), 'utf8');
  assert.match(tela, /await garantirAcesso\(/);
  assert.match(tela, /sem-login/);
  assert.match(readFileSync(new URL('../frontend/editor-conteudo.html', import.meta.url), 'utf8'), /id="eng-acesso"/);
  assert.match(readFileSync(new URL('../frontend/client/src/editor.mjs', import.meta.url), 'utf8'), /status === 401/);
});
