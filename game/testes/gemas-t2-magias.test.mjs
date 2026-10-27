// (lote T2, rodada 4 — 27/10) AS MAGIAS da fila T2 (as que estavam "implementada, sem teste próprio"): usadas numa caçada com os sorteios travados — o dano (pela razão
// com outra magia do mesmo personagem, a resistência do alvo zerada), a área e cada linha feita, com o número do nível 20 conferido com o poedb ou o PoB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEM, G, Ficha, montar, usar, danoEm, perto } from './gemas-t2-apoio.mjs';

const { resistenciaDe } = await import('../systems/hunt/resistencia.mjs');
const Afeccoes = await import('../systems/itens-poe/afeccoes.mjs');

/** Zera a resistência do alvo a cada elemento (a do bestiário compensada): o balão é o dano antes da resistência. */
function semResistencia(e, b) {
  b.resist = {};
  for (const el of ['fire', 'ice', 'energy', 'chaos']) b.resist[el] = -resistenciaDe(e.hunt, b, el);
}
async function golpeDe(slug, { vida = 1e12, v = 0.5 } = {}) {
  const { e, b, resto } = await montar([slug], { arma: 'Wands/Driftwood_Wand' });
  Object.assign(b, { hp: vida, maxHp: vida });
  semResistencia(e, b);
  const { r, ev } = usar(e, 0, b, v);
  assert.ok(r.ok, JSON.stringify(r));
  return { e, b, resto, ev, dano: danoEm(ev, b) };
}
const media = ([a, z]) => (a + z) / 2;

// ---------------------------------------------------------------- Bomba Congelante da Instabilidade

test('T2 Frost_Bomb_of_Instability: 1452 a 2178 de Gelo, 25% de chance de Congelar, raio 2,4 m, duração 1,5 s (poedb/PoB, nível 20)', { skip: SEM }, async () => {
  const c = G.compilada('Frost_Bomb_of_Instability', 20);
  assert.deepEqual([c.stats.dano.gelo, c.stats.chances.congelar, c.stats.raio, c.stats.duracao, c.stats.critico, c.tempoUso ?? c.stats.tempoUso], [[1452, 2178], 25, 2.4, 1.5, 7.5, 0.7]);
  // o dano: a razão com a Nova Glacial comum (1122 a 1683; a Bomba comum não serve — a Exposição dela entra antes do dano) no mesmo personagem, a resistência zerada
  const inst = await golpeDe('Frost_Bomb_of_Instability');
  const nova = await golpeDe('Ice_Nova');
  assert.ok(perto(inst.dano / nova.dano, media([1452, 2178]) / media([1122, 1683]), 0.01), `${inst.dano} / ${nova.dano}`);
  assert.equal(inst.b.estados.exposicao, undefined, 'a da Instabilidade não tem a Exposição a Gelo da comum');
});

test('T2 Frost_Bomb_of_Instability: a explosão pega quem está no raio (2,4 m = 1 casa + 20%); o sorteio de 0,2 Congela, o de 0,5 não', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Frost_Bomb_of_Instability'], { arma: 'Wands/Driftwood_Wand' });
  Object.assign(b, { hp: 20_000, maxHp: 20_000 });
  Object.assign(resto[0], { x: b.x, y: b.y + 1, estados: {}, dots: [] });
  Object.assign(resto[1], { x: b.x + 3, y: b.y, estados: {}, dots: [] });
  const { ev } = usar(e, 0, b, 0.5);
  assert.ok(danoEm(ev, b) > 0 && danoEm(ev, resto[0]) > 0, 'o alvo e o vizinho');
  assert.equal(danoEm(ev, resto[1]), 0, 'a 3 casas, fora');
  assert.equal(b.estados.congelado, undefined, '0,5 ≥ 25%');
  const { e: e2, b: b2 } = await montar(['Frost_Bomb_of_Instability'], { arma: 'Wands/Driftwood_Wand' });
  Object.assign(b2, { hp: 20_000, maxHp: 20_000 });
  usar(e2, 0, b2, 0.2);
  assert.ok(b2.estados.congelado?.ate > e2.hunt.clock, JSON.stringify(b2.estados));
});

// ---------------------------------------------------------------- Nova Glacial do Congelamento Profundo

test('T2 Ice_Nova_of_Deep_Freeze: 817 a 1225 de Gelo em volta de você (raio 3,2 m), sempre Congela, como se causasse 490% mais (+80% na qualidade 20) — poedb/PoB, nível 20', { skip: SEM }, async () => {
  const c = G.compilada('Ice_Nova_of_Deep_Freeze', 20);
  assert.deepEqual([c.stats.dano.gelo, c.stats.chances.congelar, c.stats.raio], [[817, 1225], 100, 3.2]);
  assert.equal(G.linhasLocaisNoNivel('Ice_Nova_of_Deep_Freeze', 20, 0).af.congelamento_como_mais, 490);
  assert.equal(G.linhasLocaisNoNivel('Ice_Nova_of_Deep_Freeze', 20, 20).af.congelamento_como_mais, 570);
  const df = await golpeDe('Ice_Nova_of_Deep_Freeze');
  const comum = await golpeDe('Ice_Nova');
  assert.ok(perto(df.dano / comum.dano, media([817, 1225]) / media([1122, 1683]), 0.01), `${df.dano} / ${comum.dano}`);
});

test('T2 Ice_Nova_of_Deep_Freeze: o Congelamento dura como se o golpe fosse 5,9× — a conta do PoE (60 ms por 1% da vida); o mesmo golpe sem a linha não congelaria', { skip: SEM }, async () => {
  const vida = 60_000;
  const { e, b, dano } = await golpeDe('Ice_Nova_of_Deep_Freeze', { vida });
  const a = Ficha.combate(e).afeccoes ?? {};
  const aum = (a.duracaoCongelamento ?? 0) + (a.duracao ?? 0);
  const ms = b.estados.congelado?.ate - e.hunt.clock;
  assert.ok(ms > 0, JSON.stringify(b.estados));
  assert.ok(Math.abs(ms - Afeccoes.msDoCongelamento(dano * 5.9, vida, aum)) <= 2, `${ms} ≠ ${Afeccoes.msDoCongelamento(dano * 5.9, vida, aum)}`);
  assert.equal(Afeccoes.msDoCongelamento(dano, vida, aum), 0, 'sem o "como se causasse", abaixo dos 0,3 s');
  // o alcance: o vizinho a 1 casa de você é pego; o de 3 casas, não (3,2 m = 1 casa + 60%)
  const { e: e2, b: b2, resto } = await montar(['Ice_Nova_of_Deep_Freeze'], { arma: 'Wands/Driftwood_Wand' });
  Object.assign(resto[0], { x: e2.hunt.pos.x - 1, y: e2.hunt.pos.y, estados: {}, dots: [] });
  Object.assign(resto[1], { x: e2.hunt.pos.x + 3, y: e2.hunt.pos.y, estados: {}, dots: [] });
  const { ev } = usar(e2, 0, b2);
  assert.ok(danoEm(ev, b2) > 0 && danoEm(ev, resto[0]) > 0);
  assert.equal(danoEm(ev, resto[1]), 0);
});

// ---------------------------------------------------------------- Tormenta Flamejante dos Meteoros

test('T2 Firestorm_of_Meteors: um meteoro de 1960 a 2940 de Fogo, raio 2,6 m, 6% de crítico (poedb/PoB, nível 20)', { skip: SEM }, async () => {
  const c = G.compilada('Firestorm_of_Meteors', 20);
  assert.deepEqual([c.stats.dano.fogo, c.stats.raio, c.stats.critico], [[1960, 2940], 2.6, 6]);
  // a razão com a Bomba Congelante da Instabilidade, as duas com a resistência zerada (o mesmo personagem)
  const fm = await golpeDe('Firestorm_of_Meteors');
  const fb = await golpeDe('Frost_Bomb_of_Instability');
  assert.ok(perto(fm.dano / fb.dano, media([1960, 2940]) / media([1452, 2178]), 0.01), `${fm.dano} / ${fb.dano}`);
  // o Fogo: com 50% de resistência a Fogo, metade
  const { e, b } = await montar(['Firestorm_of_Meteors'], { arma: 'Wands/Driftwood_Wand' });
  semResistencia(e, b);
  b.resist.fire += 50;
  assert.ok(perto(danoEm(usar(e, 0, b).ev, b) / fm.dano, 0.5, 0.01));
  // a área: o vizinho do ponto de queda a 1 casa
  const { e: e3, b: b3, resto } = await montar(['Firestorm_of_Meteors'], { arma: 'Wands/Driftwood_Wand' });
  Object.assign(resto[0], { x: b3.x, y: b3.y + 1, estados: {}, dots: [] });
  const { ev } = usar(e3, 0, b3);
  assert.ok(danoEm(ev, resto[0]) > 0);
});

// ---------------------------------------------------------------- Raio Escaldante da Imolação

test('T2 Scorching_Ray_of_Immolation: 2744 de Fogo por segundo por 4 s; o debuff ganha 1 estágio a cada uso, até 8, cada estágio a mais +10% (+4% na qualidade 20)', { skip: SEM }, async () => {
  const c = G.compilada('Scorching_Ray_of_Immolation', 20);
  assert.deepEqual([c.stats.dot, c.stats.duracao], [[{ el: 'fogo', dps: 2744 }], 4]);
  assert.deepEqual(G.debuffDaGema('Scorching_Ray_of_Immolation', 20, 0), { max: 8, porEstagioPct: 10, aposPrimeiro: true, duracaoMs: null, exposicaoPct: 0 });
  assert.equal(G.debuffDaGema('Scorching_Ray_of_Immolation', 20, 20).porEstagioPct, 14);
  const { e, b } = await montar(['Scorching_Ray_of_Immolation'], { arma: 'Wands/Driftwood_Wand' });
  const porSeg = [];
  for (let i = 0; i < 10; i++) {
    e.hunt.clock = Math.max(e.hunt.clock, e.hunt.canalizacao?.ate ?? e.hunt.clock) + 10;
    assert.ok(usar(e, 0, b).r.ok);
    const d = b.dots.find((x) => x.chave === 'Scorching_Ray_of_Immolation');
    porSeg.push(d.porPulso);
  }
  const est = b.estados.poeEstagiosDoDebuff.Scorching_Ray_of_Immolation;
  assert.equal(est.n, 8, 'o máximo');
  // o pulso: × (1 + 10% × (estágios − 1)); no 9º e no 10º uso, parado no máximo
  for (let i = 0; i < 10; i++) assert.ok(perto(porSeg[i] / porSeg[0], 1 + 0.1 * Math.min(7, i), 0.01), `${i}: ${porSeg[i]} / ${porSeg[0]}`);
  const d = b.dots.find((x) => x.chave === 'Scorching_Ray_of_Immolation');
  assert.equal(d.ate - e.hunt.clock, 4000, 'cada uso renova os 4 s');
});

test('T2 Scorching_Ray_of_Immolation: "Modificadores de Dano Mágico aplicam-se ao Dano Degenerativo" — o Dano Incendiário do suporte (39% mais, Desperto nível 5) multiplica o degenerativo', { skip: SEM }, async () => {
  assert.ok(G.dotEhMagico('Scorching_Ray_of_Immolation'));
  const pulso = async (slugs, nivelDe = {}) => { const { e, b } = await montar(slugs, { arma: 'Wands/Driftwood_Wand', nivelDe: { Awakened_Burning_Damage_Support: 5, ...nivelDe } }); usar(e, 0, b); return b.dots.find((x) => x.chave === 'Scorching_Ray_of_Immolation').porPulso; };
  // (o Desperto no 5 também dá "+1 ao Nível das Gemas de Fogo Suportadas": a comparação é com o Raio no 21)
  const sem = await pulso(['Scorching_Ray_of_Immolation'], { Scorching_Ray_of_Immolation: 21 });
  const com = await pulso(['Scorching_Ray_of_Immolation', 'Awakened_Burning_Damage_Support']);
  assert.ok(perto(com / sem, 1.39, 0.01), `${com} / ${sem}`);
});
