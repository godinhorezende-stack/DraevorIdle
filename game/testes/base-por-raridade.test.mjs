import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { rolarBase, gerarItem } from '../systems/itens/gerar.mjs';
import { metaDaPeca } from '../systems/itens/item.mjs';
import * as C from '../systems/itens/config.mjs';

const arma = Object.values(ITEM_CATALOG).find((i) => i.slot === 'weapon' && !i.stackable && i.attack >= 10);

test('rolarBase: nunca passa do catálogo e respeita o piso da raridade (Comum 70%, Mítico 100%)', () => {
  for (const r of C.RARIDADES.ordem) {
    const piso = Math.round(arma.attack * C.RARIDADES.raridades[r].base.min);
    for (let i = 0; i < 500; i++) {
      const v = rolarBase(arma.id, r).attack;
      assert.ok(v >= piso && v <= arma.attack, `${r}: ${v} fora de ${piso}-${arma.attack}`);
    }
  }
  assert.equal(rolarBase(arma.id, 'mítico').attack, arma.attack);
});

test('raridade maior tem piso maior', () => {
  const pisos = C.RARIDADES.ordem.map((r) => C.RARIDADES.raridades[r].base.min);
  assert.deepEqual([...pisos].sort((a, b) => a - b), pisos);
});

test('gerarItem: a peça carrega o `base` sorteado, e metaDaPeca o aplica sobre o catálogo', () => {
  const peca = gerarItem({ itemId: arma.id, raridade: 'comum', rng: () => 0 });
  assert.equal(peca.base.attack, Math.round(arma.attack * 0.7));
  assert.equal(metaDaPeca(peca).attack, peca.base.attack);
  assert.equal(metaDaPeca({ id: arma.id, count: 1 }).attack, arma.attack, 'sem base: valor cheio');
});
