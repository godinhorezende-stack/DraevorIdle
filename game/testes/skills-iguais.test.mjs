// A dificuldade de subir as skills de ataque é IGUAL para toda vocação (dono, 03/10): Melee, Distance e Magic Level na mesma curva (taxa 1,1), sem joelho.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../engine/formulas.mjs';

const VOCACOES = ['knight', 'paladin', 'sorcerer', 'druid', 'monk', 'none'];

test('Melee e Distance: o mesmo custo por nível para toda vocação, e igual entre as duas skills', () => {
  for (const nivel of [10, 30, 60, 120, 250]) {
    const referencia = E.triesForSkill('melee', nivel, 'knight');
    assert.equal(referencia, Math.round(50 * 1.1 ** (nivel - 10)));
    for (const v of VOCACOES) for (const skill of ['melee', 'distance']) assert.equal(E.triesForSkill(skill, nivel, v), referencia, `${v} ${skill} no nível ${nivel}`);
  }
});

test('Magic Level: o mesmo custo em mana para toda vocação, sem joelho (Paladin e Monk iguais ao Sorcerer, em qualquer nível)', () => {
  for (const nivel of [0, 10, 30, 45, 46, 80, 150]) {
    const referencia = E.manaForMagicLevel(nivel, 'sorcerer');
    assert.equal(referencia, Math.round(1600 * 1.1 ** nivel));
    for (const v of VOCACOES) assert.equal(E.manaForMagicLevel(nivel, v), referencia, `${v} no ML ${nivel}`);
  }
  // Sem degrau no 45: a razão entre níveis seguidos é sempre a taxa.
  assert.ok(Math.abs(E.manaForMagicLevel(46, 'paladin') / E.manaForMagicLevel(45, 'paladin') - 1.1) < 0.001);
});

test('a skill de fora da classe deixa de ser impossível: o Sorcerer sobe Melee e o Knight sobe Magic Level no mesmo ritmo do foco deles', () => {
  assert.equal(E.triesForSkill('melee', 50, 'sorcerer'), E.triesForSkill('melee', 50, 'knight'));
  assert.equal(E.manaForMagicLevel(50, 'knight'), E.manaForMagicLevel(50, 'sorcerer'));
  assert.equal(E.TAXA_DAS_SKILLS_DE_ATAQUE.melee, E.TAXA_DAS_SKILLS_DE_ATAQUE.magic);
});
