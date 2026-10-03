// A dificuldade de subir as skills de ataque (dono, 03/10): cada classe sobe a PRÓPRIA skill na mesma velocidade das outras classes na delas; a de OUTRA
// classe é mais difícil (alcançável); o escudo segue a vocação (o Knight sobe mais fácil). Próprias: Knight = Melee, Paladin = Distance, Monk = Melee,
// Sorcerer e Druid = Magic Level.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../engine/formulas.mjs';

const PROPRIA = [['knight', 'melee'], ['monk', 'melee'], ['paladin', 'distance']];
const custo = (grupo, v, nivel) => (grupo === 'magic' ? E.manaForMagicLevel(nivel, v) : E.triesForSkill(grupo, nivel, v));

test('a skill PRÓPRIA tem o mesmo custo por nível em todas as classes (Melee do Knight e do Monk, Distance do Paladin, Magic Level do Sorcerer e do Druid)', () => {
  for (const nivel of [10, 30, 60, 120, 250]) {
    const tentativas = Math.round(50 * 1.1 ** (nivel - 10));
    for (const [v, g] of PROPRIA) assert.equal(custo(g, v, nivel), tentativas, `${v} ${g} no nível ${nivel}`);
  }
  for (const nivel of [0, 10, 30, 45, 46, 80, 150]) {
    const mana = Math.round(1600 * 1.1 ** nivel);
    for (const v of ['sorcerer', 'druid']) assert.equal(E.manaForMagicLevel(nivel, v), mana, `${v} no ML ${nivel}`);
  }
  // Sem joelho: a razão entre níveis seguidos é sempre a taxa, no ML 45 também.
  assert.ok(Math.abs(E.manaForMagicLevel(46, 'sorcerer') / E.manaForMagicLevel(45, 'sorcerer') - 1.1) < 0.001);
});

test('a skill de OUTRA classe é mais difícil que a própria, mas alcançável (não é mais impossível)', () => {
  const casos = [['sorcerer', 'melee'], ['sorcerer', 'distance'], ['druid', 'melee'], ['knight', 'distance'], ['knight', 'magic'], ['paladin', 'melee'], ['paladin', 'magic'], ['monk', 'distance'], ['monk', 'magic']];
  for (const [v, g] of casos) {
    const propria = g === 'magic' ? E.manaForMagicLevel(60, 'sorcerer') : E.triesForSkill('melee', 60, 'knight');
    const fora = custo(g, v, 60);
    assert.ok(fora > propria, `${v} ${g}: ${fora} deveria ser maior que ${propria}`);
    assert.ok(fora < propria * 20, `${v} ${g}: ${fora} é impossível (mais de 20× a própria)`);
  }
  // O Sorcerer chega ao Melee 100 em algumas centenas de milhões de tentativas, e não em quintilhões.
  let t = 0;
  for (let v = 10; v < 100; v++) t += E.triesForSkill('melee', v, 'sorcerer');
  assert.ok(t < 1e9, `${t}`);
});

test('escudo: segue a vocação (o Knight sobe mais fácil que os outros) e não foi mexido', () => {
  const knight = E.triesForSkill('shielding', 80, 'knight');
  for (const v of ['sorcerer', 'druid']) assert.ok(E.triesForSkill('shielding', 80, v) > knight, v);
  assert.ok(E.triesForSkill('shielding', 80, 'paladin') >= knight);
});
