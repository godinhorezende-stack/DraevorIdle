import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, copyFileSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Rev from '../admin/arquivo-versionado.mjs';
import * as Camp from '../admin/campanha-editor.mjs';
import * as Mon from '../admin/overrides.mjs';
import * as Itn from '../admin/overrides-itens.mjs';
import * as Atos from '../admin/atos.mjs';
import * as Aud from '../admin/auditoria.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import * as A from '../admin/acesso.mjs';
import { criarGuarda } from '../admin/acesso-http.mjs';

const pasta = mkdtempSync(join(tmpdir(), 'infra-'));
after(() => rmSync(pasta, { recursive: true, force: true }));
Camp.CAMINHOS.arquivo = join(pasta, 'campanha.json');
Camp.CAMINHOS.versoes = join(pasta, 'campanha-versoes');
Mon.CAMINHOS.arquivo = join(pasta, 'ov', 'monstros.json');
Mon.CAMINHOS.versoes = join(pasta, 'ov', '_v', 'monstros');
Itn.CAMINHOS.arquivo = join(pasta, 'ov', 'itens.json');
Itn.CAMINHOS.versoes = join(pasta, 'ov', '_v', 'itens');
Atos.CAMINHOS.atos = join(pasta, 'atos');
Aud.CAMINHO.arquivo = join(pasta, 'auditoria', 'engine-auditoria.jsonl');
copyFileSync(new URL('../gamedata/campanha.json', import.meta.url), Camp.CAMINHOS.arquivo);
const REAL_CAMPANHA = readFileSync(Camp.CAMINHOS.arquivo, 'utf8');

test('IN1. revisão do arquivo: muda quando o conteúdo muda, "ausente" quando não existe; conferir aceita a atual, recusa a velha e ignora clientes sem controle', () => {
  const f = join(pasta, 'x.json');
  assert.equal(Rev.revisaoDe(f), 'ausente');
  assert.equal(Rev.conferirRevisao('ausente', f), null);
  writeFileSync(f, '{"a":1}');
  const r1 = Rev.revisaoDe(f);
  assert.match(r1, /^[0-9a-f]{16}$/);
  assert.equal(Rev.conferirRevisao(r1, f), null);
  writeFileSync(f, '{"a":2}');
  assert.notEqual(Rev.revisaoDe(f), r1);
  const c = Rev.conferirRevisao(r1, f);
  assert.deepEqual([c.ok, c.codigo], [false, 'conflito']);
  assert.match(c.erros[0], /nada foi gravado/);
  assert.equal(Rev.conferirRevisao(undefined, f), null);
});

test('IN2. campanha: salvar com a revisão LIDA grava; com revisão velha (arquivo mudou no meio) é recusado SEM gravar; restaurar também confere', () => {
  const lida = Camp.ler().revisao;
  const r = Camp.salvar({ fases: [{ huntId: 'troll-cave', nivel: { medio: 120 } }], revisao: lida });
  assert.equal(r.ok, true);
  const nova = Camp.ler().revisao;
  assert.notEqual(nova, lida);
  const antes = readFileSync(Camp.CAMINHOS.arquivo, 'utf8');
  const velha = Camp.salvar({ fases: [{ huntId: 'troll-cave', nivel: { medio: 130 } }], revisao: lida });
  assert.deepEqual([velha.ok, velha.codigo], [false, 'conflito']);
  assert.equal(readFileSync(Camp.CAMINHOS.arquivo, 'utf8'), antes, 'conflito não grava');
  assert.equal(Camp.salvar({ fases: [{ huntId: 'troll-cave', nivel: { medio: 130 } }], revisao: nova }).ok, true);
  assert.equal(Camp.restaurar(1, lida).codigo, 'conflito');
  assert.equal(Camp.restaurar(1, Camp.ler().revisao).ok, true);
  writeFileSync(Camp.CAMINHOS.arquivo, REAL_CAMPANHA);
});

test('IN3. overrides de monstros e de itens: todas as ações que gravam conferem a revisão (salvar, reverter, duplicar, ativo, restaurar)', () => {
  const m0 = Mon.listar({}).revisao;
  assert.equal(m0, 'ausente');
  assert.equal(Mon.salvar('troll', { hp: 90 }, m0).ok, true);
  const m1 = Mon.obter('troll').revisao;
  assert.notEqual(m1, 'ausente');
  for (const r of [Mon.salvar('troll', { hp: 91 }, m0), Mon.reverter('troll', m0), Mon.duplicar('troll', 'troll-x', null, m0), Mon.definirAtivo(false, null, m0), Mon.restaurar(1, m0)]) assert.equal(r.codigo, 'conflito');
  assert.equal(Mon.obter('troll').override.hp, 90, 'nada mudou');
  assert.equal(Mon.reverter('troll', m1).ok, true);
  const i0 = Itn.listar({}).revisao;
  assert.equal(Itn.salvar('3268', { attack: 20 }, i0).ok, true);
  const i1 = Itn.obter('3268').revisao;
  for (const r of [Itn.salvar('3268', { attack: 21 }, i0), Itn.reverter('3268', i0), Itn.definirAtivo(false, null, i0), Itn.restaurar(1, i0)]) assert.equal(r.codigo, 'conflito');
  assert.equal(Itn.obter('3268').override.attack, 20);
  assert.equal(Itn.salvar('3268', { attack: 22 }, i1).ok, true, 'com a revisão atual grava');
});

test('IN4. atos: salvar com a versão que a tela leu; versão velha é recusada; o fluxo normal (salvar em sequência com o que a resposta devolve) segue funcionando', () => {
  const base = { id: 'ato-conc', nome: 'Ato', inicio: 'fase-1', fases: [{ id: 'fase-1', nome: 'Um', huntId: 'troll-cave' }], conexoes: [] };
  const a = Atos.salvar(base);
  assert.equal(a.ato.versao, 1);
  const b = Atos.salvar({ ...a.ato, nome: 'Ato 2' });
  assert.equal(b.ato.versao, 2);
  const velha = Atos.salvar({ ...a.ato, nome: 'Ato velho' });
  assert.deepEqual([velha.ok, velha.codigo], [false, 'conflito']);
  assert.match(velha.erros[0], /versão 1.*arquivo está na 2/);
  assert.equal(Atos.obter('ato-conc').nome, 'Ato 2');
  assert.equal(Atos.salvar({ ...b.ato, nome: 'Ato 3' }).ok, true);
  assert.equal(Atos.restaurar('ato-conc', 1).ok, true, 'restaurar não é bloqueado pela checagem');
  assert.equal(Atos.duplicar('ato-conc', 'ato-conc-2').ok, true);
});

test('IN5. HTTP: conflito responde 409 (e o corpo explica); sucesso e erro de validação continuam 200', async () => {
  const chama = async (rota, corpo) => { const r = []; await Http.atender({ method: 'POST' }, {}, `/api/mapas/_conteudo/${rota}`, new URL('http://x/'), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => corpo }); return r[0]; };
  const lida = Camp.ler().revisao;
  assert.equal((await chama('campanha', { fases: [{ huntId: 'troll-cave', nivel: { medio: 121 } }], revisao: lida }))[0], 200);
  const [status, corpo] = await chama('campanha', { fases: [{ huntId: 'troll-cave', nivel: { medio: 122 } }], revisao: lida });
  assert.equal(status, 409);
  assert.equal(corpo.codigo, 'conflito');
  assert.equal((await chama('campanha', { fases: [{ huntId: 'troll-cave', nivel: { facil: 0 } }], revisao: Camp.ler().revisao }))[0], 200, 'validação inválida não é conflito');
  assert.equal((await chama('overrides', { acao: 'salvar', key: 'troll', override: { hp: 5 }, revisao: 'velha' }))[0], 409);
  assert.equal((await chama('overrides/itens', { acao: 'salvar', id: '3268', override: { attack: 5 }, revisao: 'velha' }))[0], 409);
  writeFileSync(Camp.CAMINHOS.arquivo, REAL_CAMPANHA);
});

test('IN6. auditoria: resumo seguro (nunca senha nem conteúdo), linhas append-only, leitura mais nova primeiro com filtro, não lança em erro de disco, rotaciona acima de 5 MB', () => {
  assert.equal(Aud.resumirCorpo(null), null);
  const r = Aud.resumirCorpo({ acao: 'salvar', key: 'troll', senha: 'segredo', password: 'x', override: { hp: 5, loot: [{ id: 1 }] }, revisao: 'abc', fases: [1, 2] });
  assert.deepEqual(r, { acao: 'salvar', key: 'troll', camposDoOverride: ['hp', 'loot'], fasesAlteradas: 2, campos: ['override', 'fases'] });
  assert.doesNotMatch(JSON.stringify(r), /segredo|"x"/);
  assert.equal(Aud.registrar({ tipo: 'gravacao', quem: 'a@x.com', rota: 'campanha', ok: true }), true);
  Aud.registrar({ tipo: 'operacao', quem: 'a@x.com', rota: 'operacao/beta', ok: true });
  Aud.registrar({ tipo: 'recusado', quem: null, codigo: 'sem-login' });
  const todos = Aud.ler({});
  assert.deepEqual(todos.map((e) => e.tipo), ['recusado', 'operacao', 'gravacao'], 'mais nova primeiro');
  assert.ok(todos.every((e) => Number.isFinite(e.quando)));
  assert.deepEqual(Aud.ler({ tipo: 'gravacao' }).map((e) => e.rota), ['campanha']);
  assert.equal(Aud.ler({ limite: 1 }).length, 1);
  const certo = Aud.CAMINHO.arquivo;
  Aud.CAMINHO.arquivo = join(pasta, 'x.json', 'aqui.jsonl'); // x.json é arquivo: o diretório não pode existir
  assert.equal(Aud.registrar({ tipo: 'x' }), false, 'erro de disco devolve false, não lança');
  Aud.CAMINHO.arquivo = certo;
  writeFileSync(certo, `${'x'.repeat(5 * 1024 * 1024 + 10)}\n`);
  Aud.registrar({ tipo: 'depois-da-rotacao' });
  assert.ok(existsSync(certo.replace(/\.jsonl$/, '.1.jsonl')), 'o arquivo grande virou .1');
  assert.ok(statSync(certo).size < 1000);
  assert.deepEqual(Aud.ler({}).map((e) => e.tipo), ['depois-da-rotacao']);
});

test('IN7. guarda de acesso audita de verdade (HTTP): login, falha, gravação recusada, operação com resumo e resultado, logout; leitura NÃO é registrada; e a tela lê o registro', async () => {
  rmSync(join(pasta, 'auditoria'), { recursive: true, force: true });
  const contas = { 'dono@x.com': { id: 1, email: 'dono@x.com', senha: 'certa' } };
  const acesso = A.criarAcesso({ config: A.configuracao({ env: { NODE_ENV: 'production', ENGINE_ADMINS: 'dono@x.com' }, existe: () => false, arquivoDeAdmins: '/x' }), deps: { contaPorEmail: async (e) => contas[e] ?? null, conferirSenha: async (s, g) => s === g } });
  const guardar = criarGuarda(acesso);
  const server = createServer(async (req, res) => {
    const json = (r, c, b) => { r.statusCode = c; r.setHeader('content-type', 'application/json'); r.end(JSON.stringify(b)); return true; };
    const corpoJson = (r) => new Promise((ok) => { let t = ''; r.on('data', (x) => (t += x)); r.on('end', () => ok((r.corpoAuditado = JSON.parse(t || '{}')))); });
    const caminho = new URL(req.url, 'http://x').pathname;
    if (await guardar(req, res, caminho, { json, corpoJson })) return;
    if (await Http.atender(req, res, caminho, new URL(req.url, 'http://x'), { json, corpoJson })) return;
    json(res, 404, {});
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${server.address().port}/api/mapas/_conteudo/`;
  const chama = (metodo, rota, corpo, cookie) => fetch(base + rota, { method: metodo, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined }).then(async (r) => ({ status: r.status, corpo: await r.json(), cookies: r.headers.getSetCookie() }));
  try {
    await chama('POST', 'auth/entrar', { email: 'dono@x.com', senha: 'errada' });
    const ok = await chama('POST', 'auth/entrar', { email: 'dono@x.com', senha: 'certa' });
    const cookie = ok.cookies.map((c) => c.split(';')[0]).join('; ');
    await chama('GET', 'opcoes', null, cookie);
    await chama('POST', 'operacao/beta', { ativo: true }, cookie);
    await chama('POST', 'atos-editor', { id: 'ato-aud', nome: 'x' }, cookie);
    await chama('POST', 'operacao/beta', { ativo: 'sim' }, cookie);
    await chama('POST', 'auth/sair', {}, cookie);
    const eventos = Aud.ler({ limite: 50 }).reverse();
    assert.deepEqual(eventos.map((e) => e.tipo), ['login-falha', 'login', 'operacao', 'recusado', 'operacao', 'logout']);
    const [falha, login, op, recusado, opFalha, logout] = eventos;
    assert.equal(falha.quem, 'dono@x.com');
    assert.equal(login.quem, 'dono@x.com');
    assert.deepEqual([op.rota, op.ok, op.resumo], ['operacao/beta', true, { ativo: true }]);
    assert.deepEqual([recusado.rota, recusado.codigo, recusado.quem], ['atos-editor', 'gravacao-desligada', 'dono@x.com'], 'gravar em produção é recusado E registrado');
    assert.equal(opFalha.ok, false, 'o resultado real (falhou) é o que fica registrado');
    assert.equal(logout.tipo, 'logout');
    assert.ok(!eventos.some((e) => e.rota === 'opcoes'), 'leitura não é registrada');
    assert.doesNotMatch(readFileSync(Aud.CAMINHO.arquivo, 'utf8'), /certa|errada/, 'nenhuma senha vai para o registro');
    const lido = await chama('GET', 'auditoria?limite=3', null, (await chama('POST', 'auth/entrar', { email: 'dono@x.com', senha: 'certa' })).cookies.map((c) => c.split(';')[0]).join('; '));
    assert.equal(lido.corpo.eventos.length, 3);
  } finally {
    await new Promise((ok) => server.close(ok));
  }
});

test('IN8. a tela trata conflito (modal que oferece recarregar) em campanha, mobs, itens e atos; a Configurações mostra o registro; nenhum editor manda salvar sem a revisão', () => {
  const ler = (a) => readFileSync(new URL(`../frontend/client/src/${a}`, import.meta.url), 'utf8');
  assert.match(ler('editor-ui.mjs'), /export async function tratarConflito/);
  for (const a of ['editor-campanha.mjs', 'editor-mobs.mjs', 'editor-itens.mjs', 'editor-atos.mjs']) assert.match(ler(a), /tratarConflito\(/, a);
  assert.match(ler('editor-campanha.mjs'), /revisao: N\.original\.revisao/);
  assert.match(ler('editor-mobs.mjs'), /acao: 'salvar', key: E\.key, override: paraEnviar\(E\.ov\), revisao: E\.ficha\.revisao/);
  assert.match(ler('editor-itens.mjs'), /acao: 'salvar', id: E\.id, override: paraEnviar\(E\.ov\), revisao: E\.ficha\.revisao/);
  assert.match(ler('editor-operacao.mjs'), /Registro de alterações administrativas/);
  assert.match(ler('editor-operacao.mjs'), /auditoria\?limite=60/);
});

test('IN9. Biblioteca: a ação "Editar" entra no topo do painel, sem embrulhar a ficha (a ficha é {abas, corpo}, não um elemento: embrulhar deixava o painel vazio)', () => {
  const fonte = readFileSync(new URL('../frontend/client/src/editor-biblioteca.mjs', import.meta.url), 'utf8');
  assert.match(fonte, /monstros: \(\) => fichaDoMonstro\(d, \{ abrir \}\),/);
  assert.match(fonte, /itens: \(\) => fichaDoItem\(d, \{ abrir, api \}\),/);
  assert.doesNotMatch(fonte, /el\('div', \{\}, a, f\)/);
  assert.match(fonte, /acaoDaFicha\?\.\(d\) \?\? null,/);
});
