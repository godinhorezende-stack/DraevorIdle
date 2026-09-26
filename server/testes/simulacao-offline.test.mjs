// A caçada offline simulada numa thread à parte (nucleo/simulacao-offline.mjs):
// o resultado é o de sempre, a thread do jogo NÃO para enquanto ela roda, e
// sair (ou entrar pela outra aba) no meio descarta a simulação sem perder nem
// duplicar nada.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as B from '../../game/database/banco.mjs';
import * as Cacadas from '../sistemas/cacadas.mjs';
import * as SimulacaoOffline from '../nucleo/simulacao-offline.mjs';
import { Sessao, vivas } from '../nucleo/sessao.mjs';
import { personagemDeTeste } from './apoio.mjs';

after(() => SimulacaoOffline.encerrar());

const HORA = 3_600_000;

/** Um personagem level 600 que não morre, caçando offline há `horas`. */
function estadoCacandoOffline(horas) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 600 });
  e.hp = e.maxHp = 1e12;
  assert.ok(Cacadas.entrar(e, { huntId: 'werelions-1', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.offlineDesde = Date.now() - horas * HORA;
  return e;
}

/** Quanto a thread do jogo ficou sem responder enquanto `promessa` corria (maior intervalo entre dois timers de 5 ms). */
async function maiorTravada(promessa) {
  let antes = performance.now();
  let pior = 0;
  const relogio = setInterval(() => {
    const agora = performance.now();
    pior = Math.max(pior, agora - antes);
    antes = agora;
  }, 5);
  try {
    return { resultado: await promessa, pior };
  } finally {
    clearInterval(relogio);
    pior = Math.max(pior, performance.now() - antes);
  }
}

test('na thread à parte: a caçada rende, e a thread do jogo segue respondendo', async () => {
  const e = estadoCacandoOffline(2);
  const xp = e.xp;
  // Aquece a thread (carregar os dados do jogo nela é uma vez só).
  await SimulacaoOffline.simular(estadoCacandoOffline(0.01), { id: 'x', nome: 'Aquece' });
  const ida = { ...e, hunt: Cacadas.huntParaGravar(e.hunt) };
  const { resultado, pior } = await maiorTravada(SimulacaoOffline.simular(ida, { id: 'x', nome: 'Teste Offline' }));
  const { estado, ausencia } = resultado;
  Cacadas.huntAoCarregar(estado.hunt);
  assert.ok(ausencia?.report, 'sem relatório');
  assert.equal(ausencia.morreu, false);
  assert.ok(estado.xp > xp, `exp não subiu (${xp} → ${estado.xp})`);
  assert.equal(estado.hunt.offlineDesde, undefined);
  assert.ok(estado.hunt.monstros.every((m) => m.name && m.loot), 'bicho voltou sem os campos do bestiário');
  assert.ok(pior < 150, `a thread do jogo travou ${pior.toFixed(0)} ms`);
});

// ------------------------------------------------------------------- sessão

/** Um socket de mentira que guarda o que recebeu. */
function socket() {
  const recebidas = [];
  return { readyState: 1, send: (t) => recebidas.push(JSON.parse(t)), recebidas, tipos: () => recebidas.map((m) => m.t) };
}

async function contaComPersonagem(t, horas) {
  const conta = await B.criarConta({ email: `offline-${randomUUID()}@teste.local`, senha: 'x' });
  const nome = `Off${randomUUID().replace(/[^a-z]/g, '').slice(0, 8)}`;
  const e = estadoCacandoOffline(horas);
  const p = await B.criarPersonagem({ conta: conta.id, nome, vocacao: 'knight', sexo: 'male', estadoInicial: { ...e, hunt: Cacadas.huntParaGravar(e.hunt) } });
  t.after(() => {
    for (const s of [...vivas.values()]) if (s.personagem?.nome === nome) s.desconectar();
    B.db.prepare('DELETE FROM personagens WHERE id = ?').run(p.id);
    B.db.prepare('DELETE FROM sessoes WHERE conta = ?').run(conta.id);
    B.db.prepare('DELETE FROM contas WHERE id = ?').run(conta.id);
  });
  return { conta: await B.contaPorId(conta.id), nome, id: p.id };
}

function sessao(conta) {
  const ws = socket();
  const s = new Sessao(ws);
  s.conta = conta;
  return { s, ws };
}

test('play com caçada offline: carrega sem personagem, e entra com o relatório', async (t) => {
  const { conta, nome } = await contaComPersonagem(t, 1);
  const { s, ws } = sessao(conta);
  s.receber({ t: 'play', name: nome });
  // `entrarNoPersonagem` agora é assíncrona (lê o banco antes de disparar a
  // simulação offline) — um giro do event loop basta para ela chegar até lá
  // (o banco de teste é SQLite, cada leitura sua é só um microtask, não I/O
  // de verdade), sem esperar a simulação em si (essa sim, uma thread à parte).
  await new Promise((r) => setImmediate(r));
  assert.equal(s.personagem, null, 'o personagem entrou antes da simulação acabar');
  assert.ok(s.carregando);
  s.tique(); // o relógio passando por ela no meio não faz nada
  s.receber({ t: 'startHunt', huntId: 'troll-cave' }); // comando de jogo no meio: ignorado
  await esperar(() => ws.tipos().includes('welcome'));
  const welcome = ws.recebidas.find((m) => m.t === 'welcome');
  assert.ok(welcome.andamento, 'o welcome veio sem o "Progresso enquanto você esteve fora"');
  assert.equal(s.estado.hunt.huntId, 'werelions-1');
  assert.equal(s.estado.hunt.offlineDesde, undefined);
  assert.equal(vivas.get(nome), s);
  assert.equal(s.carregando, null);
});

test('saiu no meio da simulação: nada é gravado, e a próxima entrada simula de novo', async (t) => {
  const { conta, nome, id } = await contaComPersonagem(t, 1);
  const antes = B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(id).estado;
  const { s, ws } = sessao(conta);
  s.receber({ t: 'play', name: nome });
  await new Promise((r) => setImmediate(r));
  assert.ok(s.carregando);
  s.desconectar();
  await dormir(2500);
  assert.ok(!ws.tipos().includes('welcome'));
  assert.equal(vivas.get(nome), undefined);
  assert.equal(B.db.prepare('SELECT estado FROM personagens WHERE id = ?').get(id).estado, antes, 'o banco mudou');
});

test('a outra aba entra no meio: a primeira é solta e só a segunda recebe o personagem', async (t) => {
  const { conta, nome } = await contaComPersonagem(t, 1);
  const a = sessao(conta);
  const b = sessao(conta);
  a.s.receber({ t: 'play', name: nome });
  // `a` precisa ter chegado até `carregandoAgora.set(...)` antes de `b`
  // entrar, senão as duas leituras assíncronas do banco podem terminar em
  // qualquer ordem e `b` não encontra `a` "no meio".
  await new Promise((r) => setImmediate(r));
  b.s.receber({ t: 'play', name: nome });
  await new Promise((r) => setImmediate(r));
  assert.ok(a.ws.tipos().includes('released'));
  await esperar(() => b.ws.tipos().includes('welcome'));
  await dormir(300);
  assert.ok(!a.ws.tipos().includes('welcome'), 'a aba solta também entrou');
  assert.equal(a.s.personagem, null);
  assert.equal(vivas.get(nome), b.s);
});

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperar(condicao, limite = 20_000) {
  const ate = Date.now() + limite;
  while (!condicao()) {
    if (Date.now() > ate) throw new Error('esperou demais');
    await dormir(20);
  }
}
