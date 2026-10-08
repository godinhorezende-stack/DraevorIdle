// O jogo OFICIAL é o do PoE (dono, 07/10: "migração do Draevor para o PoE oficial"). As contas ficam; o personagem ANTIGO, do Draevor
// clássico, não é convertido: fica arquivado (aparece na lista, não entra, não roda a caçada offline, não conta no limite) e o personagem
// NOVO nasce no PoE. E a caçada offline de um personagem do PoE numa área do PoE rende (o idle do jogo oficial).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as B from '../database/banco.mjs';
import * as Legado from '../systems/personagem/legado.mjs';
import * as Consolidacao from '../systems/consolidacao-offline.mjs';
import * as SimulacaoOffline from '../systems/simulacao-offline.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as R from '../systems/regras.mjs';
import * as Banqueiro from '../systems/banqueiro.mjs';
import * as Mercado from '../systems/mercado.mjs';
import * as Ranking from '../systems/ranking.mjs';
import * as Site from '../systems/site.mjs';
import { iniciarJogoDoPoe } from '../systems/itens-poe/iniciar.mjs';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import { personagemDeTeste } from './apoio.mjs';

const SEM = !existsSync(Catalogo.ARQUIVO) && 'dados do PoE ausentes nesta máquina';
after(() => SimulacaoOffline.encerrar());
// O que o servidor faz no boot (`backend/index.mjs`): o jogo do PoE inteiro, pelo mesmo bootstrap.
if (!SEM) await iniciarJogoDoPoe();

function socket() {
  const recebidas = [];
  return { readyState: 1, send: (t) => recebidas.push(JSON.parse(t)), recebidas };
}
const esperar = async (ok, ms = 8000) => { const t0 = Date.now(); while (!ok()) { if (Date.now() - t0 > ms) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 20)); } };

/** Uma conta com `n` personagens do Draevor clássico (sem a marca do PoE nem o cinto de frascos). */
async function contaComAntigos(t, n) {
  const conta = await B.criarConta({ email: `legado-${randomUUID()}@teste.local`, senha: 'x' });
  const ids = [];
  const nomes = [];
  for (let i = 0; i < n; i++) {
    const nome = `Antigo${randomUUID().replace(/[^a-z]/g, '').slice(0, 7)}`;
    const e = personagemDeTeste({ vocacao: 'knight', level: 120 });
    delete e.frascos;
    delete e.sistema;
    const p = await B.criarPersonagem({ conta: conta.id, nome, vocacao: 'knight', sexo: 'male', estadoInicial: e });
    ids.push(p.id);
    nomes.push(nome);
  }
  t.after(async () => {
    for (const s of [...vivas.values()]) if (s.conta?.id === conta.id) s.desconectar();
    for (const p of await B.personagensDaConta(conta.id)) B.db.prepare('DELETE FROM personagens WHERE id = ?').run(p.id);
    B.db.prepare('DELETE FROM sessoes WHERE conta = ?').run(conta.id);
    B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta.id);
  });
  return { conta: await B.contaPorId(conta.id), ids, nomes };
}

// (08/10: era "a marca ou o cinto de frascos". O cinto sozinho deixou de bastar — `morrerNaHunt` o criava também no Draevor clássico, e
// personagens do Draevor escaparam do arquivamento em produção. Os criados no PoE local antes da marca têm classe do PoE.)
test('quem é do PoE: a marca `sistema: poe`, ou o cinto de frascos com classe do PoE; o resto, no jogo oficial, é arquivado', { skip: SEM }, () => {
  assert.equal(Legado.arquivado({ level: 300, vocation: 'knight' }), true);
  assert.equal(Legado.arquivado({ sistema: 'poe' }), false);
  assert.equal(Legado.arquivado({ frascos: [null, null, null, null, null], classe: 'marauder', level: 7 }), false, 'os criados no PoE local antes da marca');
  assert.equal(Legado.arquivado({ frascos: [null, null, null, null, null], classe: 'knight', level: 1024 }), true, 'do Draevor com o cinto ganho ao morrer');
  assert.equal(Legado.arquivado({ frascos: [null, null, null, null, null], level: 600 }), true, 'do Draevor sem classe, com cinto');
});

test('a mesma regra em SQL (ranking, site, arena, o script dos arquivados): o cinto sem classe do PoE não passa', { skip: SEM }, async (t) => {
  const conta = await B.criarConta({ email: `legado-sql-${randomUUID()}@teste.local`, senha: 'x' });
  const nome = (p) => `${p}${randomUUID().replace(/[^a-z]/g, '').slice(0, 6)}`;
  const criados = [
    [nome('Marca'), { sistema: 'poe', level: 3 }, true],
    [nome('Cinto'), { frascos: [null], classe: 'witch', level: 9 }, true],
    [nome('Morreu'), { frascos: [null], classe: 'knight', level: 1024 }, false],
    [nome('Velho'), { level: 300, vocation: 'knight' }, false],
  ];
  for (const [n, e] of criados) await B.criarPersonagem({ conta: conta.id, nome: n, vocacao: 'knight', sexo: 'male', estadoInicial: e });
  t.after(async () => {
    for (const p of await B.personagensDaConta(conta.id)) B.db.prepare('DELETE FROM personagens WHERE id = ?').run(p.id);
    B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta.id);
  });
  const doPoe = (await B.banco.prepare(`SELECT nome FROM personagens WHERE conta = ? AND ${Legado.sqlDoPoe('sqlite')}`).all(conta.id)).map((l) => l.nome).sort();
  assert.deepEqual(doPoe, criados.filter(([, , poe]) => poe).map(([n]) => n).sort());
});

test('morrer no Draevor clássico não cria o cinto de frascos (que marcaria o personagem como do PoE)', async () => {
  const FrascosPoe = await import('../systems/itens-poe/frascos.mjs');
  const antes = process.env.DRAEVOR_CLASSICO;
  process.env.DRAEVOR_CLASSICO = '1';
  try {
    const e = { level: 200, vocation: 'knight', classe: 'knight' };
    FrascosPoe.encherNaCidade(e);
    assert.equal('frascos' in e, false);
  } finally {
    if (antes == null) delete process.env.DRAEVOR_CLASSICO; else process.env.DRAEVOR_CLASSICO = antes;
  }
});

test('conta antiga: a conta fica, o personagem antigo aparece ARQUIVADO, não entra e não é mexido; o novo nasce no PoE', { skip: SEM }, async (t) => {
  const { conta, ids, nomes } = await contaComAntigos(t, R.MAXIMO_DE_PERSONAGENS);
  const antes = B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(ids[0]).estado;
  const ws = socket();
  const s = new Sessao(ws);
  s.conta = conta;
  // A lista: os antigos com o selo de arquivado.
  await s.mandarConta(null);
  const lista = ws.recebidas.findLast((m) => m.t === 'account')?.account?.characters ?? [];
  assert.deepEqual(lista.map((c) => c.arquivado), nomes.map(() => true));
  // Entrar no antigo: recusado com a explicação, sem tocar no personagem.
  s.receber({ t: 'play', name: nomes[0] });
  await esperar(() => ws.recebidas.some((m) => m.t === 'authError'));
  assert.match(ws.recebidas.find((m) => m.t === 'authError').message, /arquivado/);
  assert.equal(s.personagem, null);
  assert.equal(B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(ids[0]).estado, antes, 'o personagem antigo não foi convertido');
  // Criar o novo com a conta CHEIA de antigos: os arquivados não contam no limite.
  const novo = `Novo${randomUUID().replace(/[^a-z]/g, '').slice(0, 7)}`;
  await s.criarPersonagem({ name: novo, vocation: 'knight', sex: 'male', classe: 'knight' });
  const criado = await B.personagemPorNome(novo);
  assert.ok(criado, ws.recebidas.filter((m) => m.t === 'authError').map((m) => m.message).join(' | ') || 'não criou');
  const e = JSON.parse(criado.estado);
  assert.equal(e.sistema, 'poe', 'o personagem novo nasce no PoE');
  assert.ok(Array.isArray(e.frascos) && e.level === 1);
  assert.equal(Legado.arquivado(e), false);
  // E a conta continua a mesma (nenhuma conta nova, nenhum antigo apagado).
  assert.equal((await B.personagensDaConta(conta.id)).length, R.MAXIMO_DE_PERSONAGENS + 1);
});

test('a caçada offline em segundo plano não mexe no arquivado', { skip: SEM }, async (t) => {
  const { ids, nomes } = await contaComAntigos(t, 1);
  const linha = B.db.prepare('SELECT id, conta, nome, vocacao, estado FROM personagens WHERE id = ?').get(ids[0]);
  assert.equal(await Consolidacao.consolidarUm(linha), 'arquivado');
  assert.equal(B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(ids[0]).estado, linha.estado);
  assert.ok(nomes.length);
});

test('transferência do banco para um arquivado: recusada, e nem o ouro de quem manda nem o arquivado mudam', { skip: SEM }, async (t) => {
  const { conta, ids, nomes } = await contaComAntigos(t, 1);
  const antes = B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(ids[0]).estado;
  const s = new Sessao(socket());
  s.conta = conta;
  const meu = { ...personagemDeTeste({ vocacao: 'knight', level: 20 }), sistema: 'poe', bank: 1000 };
  const r = await Banqueiro.transferir(meu, { name: nomes[0], amount: 100 }, { id: 'quem-manda' }, (nome) => s.destinoDaTransferencia(nome));
  assert.match(r.notice ?? '', /arquivado/);
  assert.equal(meu.bank, 1000, 'o ouro não saiu de quem mandou');
  assert.equal(B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(ids[0]).estado, antes, 'o arquivado não recebeu nada');
});

test('"char da conta fora do mundo": o arquivado não é lido, configurado nem trazido para o jogo', { skip: SEM }, async (t) => {
  const { conta, ids, nomes } = await contaComAntigos(t, 1);
  const antes = B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(ids[0]).estado;
  const ws = socket();
  const s = new Sessao(ws);
  s.conta = conta;
  s.personagem = { id: 'atual', nome: 'QuemEstaJogando' };
  for (const m of [{ op: 'dados' }, { op: 'cmd', cmd: { t: 'settings', settings: { autoLoot: false } } }, { op: 'party' }, { op: 'hunt' }]) {
    const recebidas = ws.recebidas.length;
    await s.contaChar({ ...m, name: nomes[0] });
    const novas = ws.recebidas.slice(recebidas);
    assert.ok(novas.some((x) => /arquivado/.test(JSON.stringify(x))), `${m.op}: ${JSON.stringify(novas)}`);
    assert.ok(!novas.some((x) => x.t === 'contaCharDados'), `${m.op}: mandou os dados do arquivado`);
  }
  assert.equal(B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(ids[0]).estado, antes);
  assert.equal(vivas.has(nomes[0]), false, 'o arquivado não foi trazido para o mundo');
});

test('mercado: as ofertas abertas dos arquivados voltam aos donos como crédito; o arquivado não é tocado (A3)', { skip: SEM }, async (t) => {
  const { ids, nomes } = await contaComAntigos(t, 1);
  const dono = String(ids[0]);
  const antes = B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(ids[0]).estado;
  const agora = Date.now();
  const venda = B.db.prepare("INSERT INTO mercado_ofertas (personagem, vendedor, kind, item, count, price, moeda, peca, criada) VALUES (?, ?, 'sell', 3264, 2, 50, 'gold', NULL, ?)").run(dono, nomes[0], agora).lastInsertRowid;
  const compra = B.db.prepare("INSERT INTO mercado_ofertas (personagem, vendedor, kind, item, count, price, moeda, peca, criada) VALUES (?, ?, 'buy', 3264, 3, 40, 'gold', NULL, ?)").run(dono, nomes[0], agora).lastInsertRowid;
  const ordem = B.db.prepare("INSERT INTO coin_ordens (personagem, nome, kind, amount, price, criada) VALUES (?, ?, 'sell', 7, 1000, ?)").run(dono, nomes[0], agora).lastInsertRowid;
  t.after(() => {
    B.db.prepare('DELETE FROM creditos WHERE personagem = ?').run(dono);
    B.db.prepare('DELETE FROM mercado_ofertas WHERE personagem = ?').run(dono);
    B.db.prepare('DELETE FROM coin_ordens WHERE personagem = ?').run(dono);
  });
  assert.ok((await Mercado.devolverOfertasDosArquivados(Legado.arquivado)) >= 3);
  for (const [tabela, id] of [['mercado_ofertas', venda], ['mercado_ofertas', compra], ['coin_ordens', ordem]]) {
    assert.equal(B.db.prepare(`SELECT id FROM ${tabela} WHERE id = ?`).get(id), undefined, `${tabela} ${id} saiu do balcão`);
  }
  const creditos = B.db.prepare('SELECT gold, coins, itens FROM creditos WHERE personagem = ?').all(dono);
  assert.deepEqual(creditos.flatMap((c) => JSON.parse(c.itens)).map((i) => [i.id, i.count]), [[3264, 2]], 'o item da venda voltou');
  assert.equal(creditos.reduce((n, c) => n + Number(c.gold), 0), 3 * 40, 'o ouro da compra voltou');
  assert.equal(creditos.reduce((n, c) => n + Number(c.coins), 0), 7, 'os coins da ordem voltaram');
  assert.equal(B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(ids[0]).estado, antes, 'o arquivado não foi tocado');
  assert.equal(await Mercado.devolverOfertasDosArquivados(Legado.arquivado), 0, 'de novo: nada a devolver');
});

test('ranking do jogo e do site: só personagens do PoE (o arquivado de level alto não aparece) (A4)', { skip: SEM }, async (t) => {
  const { ids, nomes } = await contaComAntigos(t, 1);
  const e = JSON.parse(B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(ids[0]).estado);
  e.level = 99_999;
  B.db.prepare('UPDATE personagens SET estado = ? WHERE id = ?').run(JSON.stringify(e), ids[0]);
  const conta = (await B.contaPorId((await B.personagemPorNome(nomes[0])).conta));
  const novo = `Poe${randomUUID().replace(/[^a-z]/g, '').slice(0, 7)}`;
  const p = await B.criarPersonagem({ conta: conta.id, nome: novo, vocacao: 'knight', sexo: 'male', estadoInicial: { ...personagemDeTeste({ vocacao: 'knight', level: 50 }), level: 88_888, sistema: 'poe' } });
  t.after(() => B.db.prepare('DELETE FROM personagens WHERE id = ?').run(p.id));
  const topo = await Ranking.topo('level');
  const nomesNoTopo = (topo.lista ?? topo).map((x) => x.name);
  assert.ok(nomesNoTopo.includes(novo), 'o personagem do PoE está no ranking');
  assert.ok(!nomesNoTopo.includes(nomes[0]), 'o arquivado não está');
  const st = await Site.status('level');
  assert.ok(!JSON.stringify(st).includes(nomes[0]), 'nem no site');
  assert.ok(!JSON.stringify(st).includes('99999'), 'nem como o maior level do servidor');
});

test('migração de classe da Engine: pula o arquivado (A5)', { skip: SEM }, async (t) => {
  const { ids } = await contaComAntigos(t, 1);
  // Uma classe só deste teste: a migração não pode alcançar nenhum outro personagem do banco local.
  const classe = `legado-teste-${randomUUID()}`;
  B.db.prepare('UPDATE personagens SET classe = ? WHERE id = ?').run(classe, ids[0]);
  const antes = B.db.prepare('SELECT estado, vocacao, classe FROM personagens WHERE id = ?').get(ids[0]);
  assert.equal(await B.migrarClasse(classe, `${classe}-nova`, 'knight', { pular: Legado.arquivado }), 0, 'ninguém migrou');
  const depois = B.db.prepare('SELECT estado, vocacao, classe FROM personagens WHERE id = ?').get(ids[0]);
  assert.deepEqual(depois, antes, 'o arquivado ficou como estava');
  // Sem o `pular`, o mesmo personagem migraria (a prova de que o teste alcança a migração de verdade).
  assert.equal(await B.migrarClasse(classe, `${classe}-nova`, 'knight'), 1);
});

test('o idle do jogo oficial: a caçada offline de um personagem do PoE numa área do PoE rende', { skip: SEM }, async () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 20 });
  e.sistema = 'poe';
  e.hp = e.maxHp = 1e9;
  const entrou = Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' });
  assert.ok(entrou.ok, entrou.erro);
  e.hunt.offlineDesde = Date.now() - 0.5 * 3_600_000;
  const xp = e.xp;
  const { estado, ausencia } = await SimulacaoOffline.simular({ ...e, hunt: Cacadas.huntParaGravar(e.hunt) }, { id: 'x', nome: 'Idle PoE' });
  assert.ok(ausencia?.report, 'sem relatório da ausência');
  assert.ok(estado.xp > xp, `a caçada offline do PoE não rendeu exp (${xp} → ${estado.xp})`);
});

test('na tela de escolha (sem personagem em jogo, onde o arquivado fica) pedir a campanha ou as passivas não quebra nem responde', { skip: SEM }, async () => {
  const ws = socket();
  const s = new Sessao(ws);
  const erros = [];
  const erroAntes = console.error;
  console.error = (...a) => erros.push(a.join(' '));
  try {
    s.receber({ t: 'campanha' });
    s.receber({ t: 'passivas', action: 'arvore' });
    await new Promise((r) => setTimeout(r, 50));
  } finally {
    console.error = erroAntes;
  }
  assert.deepEqual(erros.filter((e) => /campanha|passivas/.test(e)), [], 'sem "sessao campanha/passivas -> Cannot read properties of null"');
  assert.equal(ws.recebidas.some((m) => m.t === 'campanha' || m.t === 'passivas'), false);
});
