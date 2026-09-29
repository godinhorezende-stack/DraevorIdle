import test from 'node:test';
import assert from 'node:assert/strict';
import { blockChance } from '../engine/formulas.mjs';

test('bloqueio: sem escudo é 0%, qualquer que seja a perícia', () => {
  assert.equal(blockChance(10, null), 0);
  assert.equal(blockChance(200, null), 0);
});

test('bloqueio: escudo +14 com shielding 20 fica perto de 9%', () => {
  const b = blockChance(20, 14);
  assert.ok(b > 0.08 && b < 0.1, String(b));
});

test('bloqueio: shielding inicial (10) não dá nada de graça; escudo de 0 defesa também não', () => {
  assert.equal(blockChance(10, 0), 0);
});

test('bloqueio: teto de 50%, e ele é alcançável (escudo 50 + shielding 130)', () => {
  assert.equal(blockChance(130, 50), 0.5);
  assert.equal(blockChance(999, 999), 0.5);
  assert.ok(blockChance(100, 50) < 0.5);
});
