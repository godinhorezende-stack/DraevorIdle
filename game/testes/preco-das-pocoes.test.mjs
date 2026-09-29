import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ITEM_CATALOG, ACTION_CATALOG } from '../systems/dados.mjs';

const bruto = (arquivo) => JSON.parse(readFileSync(new URL(`../gamedata/${arquivo}`, import.meta.url), 'utf8'));
const ehPocao = (n) => /\b(health|mana) potion\b/i.test(n ?? '');

test('poção de vida e de mana custa o DOBRO (item e entrada da barra); a venda e o resto ficam como estavam', () => {
  const original = bruto('item-catalog.json');
  const pocoes = Object.values(ITEM_CATALOG).filter((i) => ehPocao(i.name) && i.buy);
  assert.ok(pocoes.length >= 8, 'as poções de vida e de mana');
  for (const p of pocoes) {
    assert.equal(p.buy, original[p.id].buy * 2, `${p.name}: buy dobrou`);
    assert.equal(p.sell, original[p.id].sell, `${p.name}: sell igual`);
  }
  const catalogo = bruto('action-catalog.json').catalog;
  const dobradas = ACTION_CATALOG.items.filter((e) => ehPocao(e.name) && e.cost);
  assert.ok(dobradas.length >= 8);
  for (const e of dobradas) assert.equal(e.cost, catalogo.items.find((o) => o.id === e.id).cost * 2, `${e.name}: cost dobrou`);
  // O que não é poção de vida/mana não mexe.
  const outra = ACTION_CATALOG.items.find((e) => !ehPocao(e.name) && e.cost > 0);
  if (outra) assert.equal(outra.cost, catalogo.items.find((o) => o.id === outra.id).cost);
});
