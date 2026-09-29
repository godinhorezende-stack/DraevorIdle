import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { rolarBase, gerarItem } from '../systems/itens/gerar.mjs';
import { metaDaPeca } from '../systems/itens/item.mjs';
import * as C from '../systems/itens/config.mjs';

const arma = Object.values(ITEM_CATALOG).find((i) => i.slot === 'weapon' && !i.stackable && i.attack >= 10);

test('rolarBase: fica dentro da faixa em % da raridade, e a faixa passa de 100% para os dois lados', () => {
  for (const r of C.RARIDADES.ordem) {
    const { min, max } = C.RARIDADES.raridades[r].base;
    const piso = Math.round(arma.attack * min);
    const topo = Math.round(arma.attack * max);
    for (let i = 0; i < 500; i++) {
      const v = rolarBase(arma.id, r).attack;
      assert.ok(v >= piso && v <= topo, `${r}: ${v} fora de ${piso}-${topo}`);
    }
  }
  assert.ok(C.RARIDADES.raridades.comum.base.min < 1 && C.RARIDADES.raridades.comum.base.max > 1, 'comum varia pra baixo e pra cima');
});

test('raridade maior tem piso e teto maiores', () => {
  for (const campo of ['min', 'max']) {
    const v = C.RARIDADES.ordem.map((r) => C.RARIDADES.raridades[r].base[campo]);
    assert.deepEqual([...v].sort((a, b) => a - b), v, campo);
  }
});

test('gerarItem: a peça carrega o `base` sorteado, e metaDaPeca o aplica sobre o catálogo', () => {
  const peca = gerarItem({ itemId: arma.id, raridade: 'comum', rng: () => 0 });
  assert.equal(peca.base.attack, Math.round(arma.attack * 0.9));
  assert.equal(metaDaPeca(peca).attack, peca.base.attack);
  assert.equal(metaDaPeca({ id: arma.id, count: 1 }).attack, arma.attack, 'sem base: valor cheio');
});
