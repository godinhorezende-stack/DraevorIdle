// Bosses: Boss Tasks, a espera que começa na entrada, os 25 minutos, o Auto
// Boss e a loja de Boss Token — as regras do original (ver `game/systems/bosses.mjs`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Bosses from '../systems/bosses.mjs';
import * as Prey from '../systems/prey.mjs';
import { personagemDeTeste } from './apoio.mjs';
import { doClassico } from './apoio-migracao.mjs';

const HORA = 3_600_000;
const novo = (level = 400) => {
  const e = personagemDeTeste({ level });
  Prey.garantir(e);
  return e;
};

test('boss de task: fechado até a task, abre com as kills, paga Task Token e sai uma vez só', { skip: doClassico("Bosses do Draevor (task, diário, sala de 25 min, Brain Head/Ghulosh, Auto Boss); o jogo oficial recusa bosses do Draevor") }, () => {
  const e = novo();
  assert.match(Cacadas.entrar(e, { huntId: 'the-horned-fox', mode: 'auto' }).erro, /Boss Task/);
  const task = Bosses.tasks(e).find((t) => t.boss === 'the-horned-fox');
  assert.equal(task.kills, 0, 'cada personagem começa do zero, não do molde');
  for (let i = 0; i < task.alvo; i++) Bosses.contarMorte(e, i % 2 ? 'minotaur-guard' : 'minotaur');
  Bosses.contarMorte(e, 'troll'); // quem não é alvo não conta
  assert.equal(task.feito, true);
  assert.equal(task.kills, task.alvo);
  assert.ok(e.inventory.some((p) => p.id === 55729 && p.count === task.tokens), 'Task Token pago');
  assert.ok(Cacadas.entrar(e, { huntId: 'the-horned-fox', mode: 'auto' }).ok);
  assert.equal(e.bossCooldownsAte?.['the-horned-fox'] ?? 0, 0, 'boss de task não tem cooldown');
  Bosses.marcarVitoria(e, 'the-horned-fox');
  e.hunt = null;
  assert.match(Cacadas.entrar(e, { huntId: 'the-horned-fox', mode: 'auto' }).erro, /uma vez por personagem/);
});

test('boss diário: a espera começa ao ENTRAR, mesmo sem ele cair', { skip: doClassico("Bosses do Draevor (task, diário, sala de 25 min, Brain Head/Ghulosh, Auto Boss); o jogo oficial recusa bosses do Draevor") }, () => {
  const e = novo();
  const antes = Date.now();
  assert.ok(Cacadas.entrar(e, { huntId: 'ahau', mode: 'auto' }).ok);
  assert.ok(e.bossCooldownsAte.ahau >= antes + 12 * HORA);
  e.hunt = null;
  assert.match(Cacadas.entrar(e, { huntId: 'ahau', mode: 'auto' }).erro, /ainda não voltou/);
});

test('sala de boss: 25 minutos e volta para a cidade', { skip: doClassico("Bosses do Draevor (task, diário, sala de 25 min, Brain Head/Ghulosh, Auto Boss); o jogo oficial recusa bosses do Draevor") }, () => {
  const e = novo(3000);
  e.hp = e.maxHp = 1e12; // a luta não é o assunto
  assert.ok(Cacadas.entrar(e, { huntId: 'thor', mode: 'online' }).ok);
  for (const b of e.hunt.monstros) b.hp = b.maxHp = 1e15; // e ele não cai
  let t = Date.now();
  e.hunt.ultimoTique = t;
  for (let i = 0; i < 4 * 60 * 26 && e.hunt; i++) {
    t += 250;
    e.hp = e.maxHp;
    Cacadas.tique(e, { id: 0, nome: 'x' }, t);
  }
  assert.equal(e.hunt, null);
  assert.match(e.avisoDaHunt, /25 minutos/);
});

test('brain-head e ghulosh: o boss está na sala (a entrada fica no meio dela)', { skip: doClassico("Bosses do Draevor (task, diário, sala de 25 min, Brain Head/Ghulosh, Auto Boss); o jogo oficial recusa bosses do Draevor") }, () => {
  for (const id of ['brain-head', 'ghulosh']) {
    const e = novo();
    assert.ok(Cacadas.entrar(e, { huntId: id, mode: 'auto' }).ok);
    assert.equal(e.hunt.monstros.length, 1, id);
    const [b] = e.hunt.monstros;
    assert.ok(Math.max(Math.abs(b.x - e.hunt.pos.x), Math.abs(b.y - e.hunt.pos.y)) >= 3, `${id} longe do jogador`);
  }
});

test('Auto Boss: pula o que não dá, entra um depois do outro, conta a leva e para no fim', { skip: doClassico("Bosses do Draevor (task, diário, sala de 25 min, Brain Head/Ghulosh, Auto Boss); o jogo oficial recusa bosses do Draevor") }, () => {
  const e = novo();
  const agora = Date.now();
  e.bossCooldownsAte = { alptramun: agora + HORA };
  const ids = ['alptramun', 'the-horned-fox', 'ahau', 'anomaly'];
  assert.ok(Bosses.comandoDoAuto(e, { action: 'start', ids }, agora).ok);
  assert.equal(Bosses.proximoDoAuto(e, agora), 'ahau', 'pula o em cooldown e o de task fechada');
  Cacadas.entrar(e, { huntId: 'ahau', mode: 'auto' });
  assert.equal(Bosses.proximoDoAuto(e, agora), null, 'com hunt aberta não entra outro');
  e.hunt = null;
  Bosses.depoisDoBoss(e, agora);
  assert.equal(Bosses.proximoDoAuto(e, agora + 1000), null, 'espera a pausa');
  assert.equal(Bosses.proximoDoAuto(e, agora + 8000), 'anomaly');
  assert.equal(Bosses.autoParaCliente(e, agora).usados, 2);
  assert.equal(Bosses.proximoDoAuto(e, agora + 9000), null);
  assert.equal(e.autoBoss.ligado, false, 'lista acabou, rotação desliga');
});

test('Auto Boss: a 15ª entrada fecha a leva por 6h; o passe tira a espera', () => {
  const e = novo();
  const agora = Date.now();
  e.autoBoss = { ...Bosses.auto(e, agora), usados: 14 };
  Bosses.comandoDoAuto(e, { action: 'start', ids: ['ahau'] }, agora);
  assert.equal(Bosses.proximoDoAuto(e, agora), 'ahau');
  assert.equal(Bosses.autoParaCliente(e, agora).espera, 6 * HORA);
  assert.match(Bosses.comandoDoAuto(e, { action: 'start', ids: ['anomaly'] }, agora).erro, /espera/);
  e.autoBoss.passe = true;
  e.autoBoss.passeAte = agora + 7 * 24 * HORA;
  assert.equal(Bosses.autoParaCliente(e, agora).espera, 0);
  assert.ok(Bosses.comandoDoAuto(e, { action: 'start', ids: ['anomaly'] }, agora).ok);
});

test('Auto Boss: sequências com nome (máx 5, nome repetido regrava) e remover', () => {
  const e = novo();
  for (let i = 0; i < 5; i++) assert.ok(Bosses.comandoDoAuto(e, { action: 'save', nome: `s${i}`, ids: ['ahau'] }).ok);
  assert.match(Bosses.comandoDoAuto(e, { action: 'save', nome: 'nova', ids: ['ahau'] }).erro, /limite/);
  assert.ok(Bosses.comandoDoAuto(e, { action: 'save', nome: 's0', ids: ['ahau', 'anomaly', 'nao-existe'] }).ok);
  assert.deepEqual(e.autoBoss.listas[0].ids, ['ahau', 'anomaly']);
  Bosses.comandoDoAuto(e, { action: 'remove', nome: 's1' });
  assert.equal(e.autoBoss.listas.length, 4);
});

test('loja de Boss Token: cobra o item, entrega; outfit uma vez só', () => {
  const e = novo();
  assert.match(Bosses.comprar(e, { id: 'bt-wildcards-5' }).erro, /Boss Token/);
  e.inventory.push({ id: 55287, count: 400 });
  assert.equal(Bosses.lojaParaCliente(e).loja.saldo, 400);
  const antes = e.wildcards ?? 0;
  assert.ok(Bosses.comprar(e, { id: 'bt-wildcards-5' }).ok);
  assert.equal(e.wildcards, antes + 5);
  assert.ok(Bosses.comprar(e, { id: 'bt-outfit-golden' }).ok);
  assert.equal(Bosses.lojaParaCliente(e).loja.saldo, 47);
  assert.equal(Bosses.lojaParaCliente(e).loja.ofertas.find((o) => o.id === 'bt-outfit-golden').owned, true);
  e.inventory.push({ id: 55287, count: 400 });
  assert.match(Bosses.comprar(e, { id: 'bt-outfit-golden' }).erro, /já tem/);
});

test('loja de Boss Token: sem o nome antigo, e sem as armas de Exercise (o treino saiu do jogo — dono, 06/10)', () => {
  const e = novo();
  const loja = Bosses.lojaParaCliente(e).loja;
  assert.doesNotMatch(JSON.stringify(loja), /Ravox/i);
  assert.equal(loja.ofertas.filter((o) => o.grupo === 'exercise').length, 0);
  e.inventory.push({ id: 55287, count: 400 });
  assert.ok(!Bosses.comprar(e, { id: 'bt-exercise-35285' }).ok, 'nem por id');
});
