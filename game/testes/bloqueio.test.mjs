import test from 'node:test';
import assert from 'node:assert/strict';
import { blockChance } from '../engine/formulas.mjs';

test('bloqueio: sem escudo é 0%, qualquer que seja a perícia', () => {
  assert.equal(blockChance(10, null), 0);
  assert.equal(blockChance(200, null), 0);
});

test('bloqueio: escudo +14 com shielding 20 fica perto de 4%', () => {
  const b = blockChance(20, 14);
  assert.ok(b > 0.04 && b < 0.05, String(b));
});

test('bloqueio: a perícia só amplifica — escudo de 0 defesa não bloqueia, nem com perícia alta', () => {
  assert.equal(blockChance(10, 0), 0);
  assert.equal(blockChance(140, 0), 0);
});

test('bloqueio: mais perícia e escudo melhor sempre sobem a chance', () => {
  assert.ok(blockChance(60, 30) > blockChance(40, 30));
  assert.ok(blockChance(40, 40) > blockChance(40, 30));
});

test('bloqueio: teto de 50% só com escudo 50 e shielding 140', () => {
  assert.equal(blockChance(140, 50), 0.5);
  assert.equal(blockChance(999, 999), 0.5);
  assert.ok(blockChance(120, 50) < 0.5);
  assert.ok(blockChance(140, 40) < 0.5);
});
