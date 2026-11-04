// A tela de entrada no personagem (04/11): a sessão manda as etapas da entrada (`{t:'entrando', etapa, feito?, total?}`) antes do
// `welcome` — 'carregando' (o banco), 'preparando' (a thread da caçada offline), 'simulando' (feito de total minutos de jogo simulados,
// terminando em total de total) e 'entrando'. Sem ausência para simular, as etapas da thread pulam. E o andamento só OBSERVA a
// simulação: com ou sem ele, o resultado é o mesmo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../database/banco.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as SimulacaoOffline from '../systems/simulacao-offline.mjs';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';

after(() => SimulacaoOffline.encerrar());

const MINUTO = 60_000;

/** Caçando, com a aba fechada há `minutos` (vida de sobra: a caçada offline corre o tempo todo). */
function cacandoOffline(minutos) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 12 });
  assert.equal(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto', strategy: 'nearest' }).ok, true);
  e.hp = e.maxHp = 1e12;
  // A entrada refaz a vida pelo equipamento: imortal na caçada (`GemasGBD.imortal`), ela corre os minutos todos (o andamento aparece).
  e.hunt.poeImortal = Number.MAX_SAFE_INTEGER;
  e.hunt.offlineDesde = Date.now() - minutos * MINUTO;
  return e;
}

/** Na cidade, sem caçada nenhuma. */
const naCidade = () => personagemDeTeste({ vocacao: 'knight', level: 12 });

async function contaComPersonagem(t, e) {
  const conta = await B.criarConta({ email: `entrada-${randomUUID()}@teste.local`, senha: 'x' });
  const nome = `Ent${randomUUID().replace(/[^a-z]/g, '').slice(0, 8)}`;
  const p = await B.criarPersonagem({ conta: conta.id, nome, vocacao: 'knight', sexo: 'male', estadoInicial: e.hunt ? { ...e, hunt: Cacadas.huntParaGravar(e.hunt) } : e });
  t.after(async () => {
    for (const s of [...vivas.values()]) if (s.personagem?.nome === nome) s.desconectar();
    vivas.delete(nome);
    await B.excluirPersonagem(p.id);
    B.db.prepare('DELETE FROM sessoes WHERE conta = ?').run(conta.id);
    B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta.id);
  });
  return { conta: await B.contaPorId(conta.id), nome };
}

/** Uma aba: guarda o tipo de cada mensagem e as de `entrando` inteiras (o `welcome` leva o catálogo — não é lido). */
function aba(conta) {
  const tipos = [];
  const entrando = [];
  const ws = {
    readyState: 1,
    bufferedAmount: 0,
    send: (texto) => {
      const t = /^\{"t":"([^"]+)"/.exec(texto)?.[1];
      tipos.push(t);
      if (t === 'entrando') entrando.push(JSON.parse(texto));
    },
  };
  const s = new Sessao(ws);
  s.conta = conta;
  return { s, tipos, entrando };
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperar(condicao, limite = 60_000) {
  const ate = Date.now() + limite;
  while (!condicao()) {
    if (Date.now() > ate) throw new Error('esperou demais');
    await dormir(10);
  }
}

test('com caçada offline: carregando → preparando → simulando (em ordem, até total de total) → entrando → welcome', async (t) => {
  const { conta, nome } = await contaComPersonagem(t, cacandoOffline(12));
  const x = aba(conta);
  x.s.receber({ t: 'play', name: nome });
  await esperar(() => x.tipos.includes('welcome'));

  // Tudo da tela vem ANTES do welcome.
  const antesDoWelcome = x.tipos.slice(0, x.tipos.indexOf('welcome'));
  assert.equal(antesDoWelcome.filter((t) => t === 'entrando').length, x.entrando.length, 'veio `entrando` depois do welcome');

  const etapas = x.entrando.map((m) => m.etapa);
  // As etapas na ordem, sem voltar: as repetidas são só o andamento da simulação.
  const ordem = ['carregando', 'preparando', 'simulando', 'entrando'];
  assert.deepEqual([...new Set(etapas)], ordem, `etapas: ${etapas.join(', ')}`);
  for (let i = 1; i < etapas.length; i++) assert.ok(ordem.indexOf(etapas[i]) >= ordem.indexOf(etapas[i - 1]), `voltou de etapa: ${etapas.join(', ')}`);
  assert.equal(etapas.at(-1), 'entrando');

  const simulando = x.entrando.filter((m) => m.etapa === 'simulando');
  const total = simulando[0].total;
  assert.ok(total >= 12 && total <= 13, `total de ${total} min para 12 min fora`);
  assert.ok(simulando.every((m) => m.total === total), 'o total mudou no meio');
  for (let i = 1; i < simulando.length; i++) assert.ok(simulando[i].feito > simulando[i - 1].feito, `o andamento não cresceu: ${simulando.map((m) => m.feito).join(', ')}`);
  assert.ok(simulando.every((m) => m.feito >= 0 && m.feito <= total));
  assert.ok(simulando.some((m) => m.feito > 0 && m.feito < total), `sem andamento no meio: ${simulando.map((m) => m.feito).join(', ')}`);
  // Termina em 100%, uma vez só.
  assert.equal(simulando.at(-1).feito, total);
  assert.equal(simulando.filter((m) => m.feito === total).length, 1);
  assert.equal(x.s.carregando, null);
  assert.equal(vivas.get(nome), x.s);
});

test('sem ausência para simular: carregando → entrando → welcome (as etapas da thread pulam)', async (t) => {
  const { conta, nome } = await contaComPersonagem(t, naCidade());
  const x = aba(conta);
  x.s.receber({ t: 'play', name: nome });
  await esperar(() => x.tipos.includes('welcome'));
  assert.deepEqual(x.entrando.map((m) => m.etapa), ['carregando', 'entrando']);
  assert.ok(x.entrando.every((m) => m.feito === undefined && m.total === undefined));
  assert.ok(x.tipos.indexOf('welcome') > x.tipos.lastIndexOf('entrando'));
});

/** `fn` com um `Math.random` de semente fixa e o relógio parado em `agora` (a mesma corrida a cada chamada, com a máquina lenta ou não). */
function comSemente(agora, fn) {
  const original = Math.random;
  const relogio = Date.now;
  let s = 12345;
  Math.random = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  Date.now = () => agora;
  try {
    return fn();
  } finally {
    Math.random = original;
    Date.now = relogio;
  }
}

test('o andamento não muda a simulação: o mesmo estado e o mesmo relatório, com ou sem ele', () => {
  const agora = Date.now();
  const base = cacandoOffline(5);
  base.hunt.offlineDesde = agora - 5 * MINUTO;
  const gravado = JSON.stringify({ ...base, hunt: Cacadas.huntParaGravar(base.hunt) });
  const rodar = (aoProgredir) => {
    const e = JSON.parse(gravado);
    Cacadas.huntAoCarregar(e.hunt);
    const ausencia = comSemente(agora, () => Cacadas.simularAusencia(e, { id: 'x', nome: 'Semente' }, agora, aoProgredir));
    return { e, ausencia };
  };
  const sem = rodar(null);
  const avisos = [];
  const com = rodar((feito, total) => avisos.push([feito, total]));
  assert.ok(sem.ausencia?.report, 'sem relatório');
  assert.deepEqual(com.ausencia, sem.ausencia);
  assert.deepEqual(JSON.parse(JSON.stringify(com.e)), JSON.parse(JSON.stringify(sem.e)));
  // E os avisos: do 0 ao total (5 min), um por minuto de jogo.
  const total = 5 * MINUTO;
  assert.deepEqual(avisos[0], [0, total]);
  assert.deepEqual(avisos.at(-1), [total, total]);
  assert.ok(avisos.length >= 6 && avisos.length <= 7, `avisos: ${avisos.length}`);
});
