// (lote T2, rodada 4 — 27/10) AS GEMAS ATIVAS QUE ESTAVAM "implementada, sem teste próprio" (a fila T2): cada uma usada de verdade numa caçada, com os sorteios
// travados — o dano ou o buff, e cada linha que o status dá como feita, com o número do nível 20 conferido com o poedb (gemas-poe.json) ou o PoB, e o efeito
// medido no uso (com e sem, quando dá). As gemas de suporte da fila estão em gemas-t2-suportes.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEM, G, Ficha, montar, usar, danoEm, golpesEm, travado, acao, perto } from './gemas-t2-apoio.mjs';

const Reserva = await import('../systems/itens-poe/reserva.mjs');
const Afeccoes = await import('../systems/itens-poe/afeccoes.mjs');

test('T2: as ativas da fila seguem "funciona", sem motivo pendente', { skip: SEM }, () => {
  const FILA = ['Vitality', 'Caustic_Arrow_of_Poison', 'Vaal_Caustic_Arrow', 'Puncture_of_Shanking', 'Lightning_Strike_of_Arcing', 'Shattering_Steel', 'Vaal_Haste', 'Kinetic_Bolt_of_Fragmentation',
    'Frost_Bomb_of_Instability', 'Ice_Nova_of_Deep_Freeze', 'Scorching_Ray_of_Immolation', 'Conductivity', 'Firestorm_of_Meteors', 'Kinetic_Rain'];
  const falhas = FILA.filter((s) => G.REGISTRO.get(s)?.statusNoJogo !== 'funciona' || G.REGISTRO.get(s)?.motivosNoJogo?.length).map((s) => `${s}: ${G.REGISTRO.get(s)?.statusNoJogo} ${(G.REGISTRO.get(s)?.motivosNoJogo ?? []).join(' | ')}`);
  assert.deepEqual(falhas, []);
});

// ---------------------------------------------------------------- Vitalidade

test('T2 Vitality: no 20, reserva 233 de Mana e dá 193,2 de Vida por segundo a você (o poedb), no raio 3,6 + 1,9 m', { skip: SEM }, async () => {
  const c = G.compilada('Vitality', 20);
  assert.equal(c.stats.buff.regen, 193.2);
  assert.equal(c.stats.raioBonus, 1.9);
  assert.equal(c.stats.raioFinal, 5.5);
  const { e, b } = await montar(['Vitality']);
  const antes = G.adds(e)?.life_regen ?? 0;
  const { r } = usar(e, 0, b);
  assert.ok(r.ok, JSON.stringify(r));
  const buff = e.hunt.buffs[acao('Vitality')];
  assert.equal(buff.ate, Reserva.LIGADA_ATE, 'a aura fica ligada');
  assert.equal(buff.reserva.fixo, 233);
  assert.equal(Reserva.reservadas(e).mana, 233);
  // (5,5 m = 2,75 casas: 2 + a chance de 75% de uma a mais — o sorteio travado em 0,5 dá a terceira)
  assert.equal(buff.raio, 3);
  assert.equal(buff.afPoe.life_regen, 193.2, 'a casa decimal do poedb (antes, arredondado para 193)');
  assert.ok(perto((G.adds(e)?.life_regen ?? 0) - antes, 193.2), `regen ${G.adds(e)?.life_regen} − ${antes}`);
  // a Regeneração da ficha (a do PoE: os fixos da soma) sobe os 193
  Ficha.invalidar(e);
  const reg = Ficha.regenDoPoe(e, Ficha.combate(e).afPoe ?? {});
  assert.ok(reg.vidaFixa >= 193 && reg.vidaPorSegundo >= 193, JSON.stringify(reg));
});

test('T2 Vitality: "Você e Aliados próximos" — o companheiro de grupo dentro do raio recebe a Regeneração; o de fora, não', { skip: SEM }, async () => {
  const { e, b } = await montar(['Vitality']);
  assert.ok(usar(e, 0, b).r.ok);
  const { e: amigo } = await montar(['Vitality'], { soltas: [] });
  amigo.hunt.buffs = {};
  amigo.hunt.partilha = { naSala: [e, amigo] };
  amigo.hunt.z = e.hunt.z;
  amigo.hunt.pos = { x: e.hunt.pos.x + 2, y: e.hunt.pos.y };
  assert.ok(Math.abs((G.adds(amigo)?.life_regen ?? 0) - 193.2) <= 0.5, `perto: ${G.adds(amigo)?.life_regen}`);
  amigo.hunt.pos = { x: e.hunt.pos.x + 6, y: e.hunt.pos.y };
  assert.equal(G.adds(amigo)?.life_regen ?? 0, 0, 'longe (6 casas > 3)');
});

// ---------------------------------------------------------------- Ímpeto Vaal

test('T2 Vaal_Haste: 4 s de 31% de Velocidade de Ataque e de Conjuração e 20% de Movimento (o poedb, nível 20); acaba no fim da duração', { skip: SEM }, async () => {
  const c = G.compilada('Vaal_Haste', 20);
  assert.deepEqual([c.stats.buff.velAtaque, c.stats.buff.velConj, c.stats.buff.velMov, c.stats.duracao, c.stats.almas], [31, 31, 20, 4, 50]);
  const { e, b } = await montar(['Vaal_Haste']);
  const antes = G.adds(e) ?? {};
  const { r } = usar(e, 0, b);
  assert.ok(r.ok, JSON.stringify(r));
  const buff = e.hunt.buffs[acao('Vaal_Haste')];
  assert.equal(buff.ate - e.hunt.clock, 4000);
  const d = G.adds(e);
  assert.deepEqual([d.atk_speed - (antes.atk_speed ?? 0), d.cast_speed - (antes.cast_speed ?? 0), d.move_speed - (antes.move_speed ?? 0)], [31, 31, 20]);
  e.hunt.clock += 4001;
  assert.equal(G.adds(e)?.atk_speed ?? 0, antes.atk_speed ?? 0, 'acabou');
});

// ---------------------------------------------------------------- Condutividade

test('T2 Conductivity: o alvo amaldiçoado tem −36% de Resistência a Raio por 11,8 s (o poedb) — o golpe de raio fere mais', { skip: SEM }, async () => {
  const c = G.compilada('Conductivity', 20);
  assert.deepEqual([c.stats.maldicao.resist.raio, c.stats.duracao, c.stats.raioBonus], [-36, 11.8, 1]);
  const { e, b } = await montar(['Conductivity', 'Spark'], { arma: 'Wands/Driftwood_Wand' });
  // o golpe de raio (a Faísca, slot 1) sem a maldição
  b.resist = { energy: 0 };
  const sem = danoEm(usar(e, 1, b).ev, b);
  assert.ok(sem > 0);
  e.hunt.clock += 5000;
  const { r } = usar(e, 0, b);
  assert.ok(r.ok, JSON.stringify(r));
  const m = e.hunt.buffs[acao('Conductivity')];
  assert.equal(m.ate - m.desde, 11800);
  // (o modelo do jogo: a maldição liga e cada acerto seu amaldiçoa quem ele pega — `Reforcos.marcar`; o primeiro golpe depois dela amaldiçoa, o seguinte já fere mais)
  e.hunt.clock += 2000;
  usar(e, 1, b);
  assert.ok(b.maldicoes?.[acao('Conductivity')]?.ate > e.hunt.clock, 'amaldiçoado');
  assert.equal(b.maldicoes[acao('Conductivity')].dur, 11800);
  e.hunt.clock += 2000;
  const com = danoEm(usar(e, 1, b).ev, b);
  assert.ok(perto(com / sem, 1.36, 0.02), `${com} / ${sem}`);
});

test('T2 Conductivity: "Acertos contra Inimigos Amaldiçoados têm +25% de chance de Eletrizar" — o sorteio abaixo de 25% Eletriza o amaldiçoado', { skip: SEM }, async () => {
  const { e, b } = await montar(['Conductivity', 'Spark'], { arma: 'Wands/Driftwood_Wand' });
  Object.assign(b, { hp: 20_000, maxHp: 20_000 });
  // (a Faísca não tem chance de Eletrizar sozinha — só no crítico, que o sorteio de 0,2 não dá)
  usar(e, 1, b, 0.2);
  assert.equal(b.estados.chocado, undefined, 'sem a maldição, nada');
  e.hunt.clock += 5000;
  assert.ok(usar(e, 0, b).r.ok);
  e.hunt.clock += 2000;
  usar(e, 1, b, 0.9);
  assert.ok(b.maldicoes?.[acao('Conductivity')], 'amaldiçoado (o sorteio 0,9 não eletriza)');
  assert.equal(b.estados.chocado, undefined);
  e.hunt.clock += 2000;
  b.hp = b.maxHp;
  usar(e, 1, b, 0.2);
  assert.ok(b.estados.chocado?.ate > e.hunt.clock, JSON.stringify(b.estados));
});

// ---------------------------------------------------------------- Pacto de Lycia (a decisão do dono)

test('T2 Pact_of_Lycia: o teste achou que o jogo faz uma canalização com o dano do Flagelo Celestial (130 a 2467 de Raio no 20) — no PoE é um Pacto; fica PARCIAL até a decisão do dono', { skip: SEM }, async () => {
  // (aval do dono 28/10: o Pacto de Lycia como no PoB — o uso não fere e fortalece as 3 magias de canalização seguintes; fica 'funciona', sem motivos)
  const r = G.REGISTRO.get('Pact_of_Lycia');
  assert.equal(r.statusNoJogo, 'funciona');
  assert.deepEqual(r.motivosNoJogo, []);
  // o que o jogo faz hoje (os números do PoB do Flagelo Celestial e do Pacto): 130–2467 de Raio, recarga 4 s, conjuração 0,8 s, 33 de Mana
  const c = G.compilada('Pact_of_Lycia', 20);
  assert.deepEqual([c.stats.dano.raio, c.stats.recarga, c.stats.tempoUso, c.stats.custo], [[130, 2467], 4, 0.8, 33]);
  const { e, b } = await montar(['Pact_of_Lycia'], { arma: 'Wands/Driftwood_Wand' });
  assert.equal(danoEm(usar(e, 0, b).ev, b), 0, 'o uso do Pacto não fere (aval do dono 28/10)');
});
