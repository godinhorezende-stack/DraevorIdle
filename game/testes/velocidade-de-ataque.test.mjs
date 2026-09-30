import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Afixos from '../systems/afixos.mjs';
import * as Ficha from '../systems/ficha.mjs';
import { ATAQUE_MS } from '../systems/hunt/combate.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);

function comVelocidade(pct) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  e.equipment.ring = { id: ANEL, count: 1, af: pct ? [{ id: 'atk_speed', nivel: 5, value: pct }] : [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return Ficha.combate(e);
}

test('a ficha traz o intervalo real entre golpes: 2 s sem bônus, e a velocidade de ataque (add + DEX) o encurta', () => {
  assert.equal(ATAQUE_MS, 2000);
  // O DEX da vocação já dá um pouco de Attack Speed (`Atributos.efeitos`).
  const doDex = comVelocidade(0).velocidadeDeAtaque;
  assert.ok(doDex > 0 && doDex < 5, `DEX dá ${doDex}%`);
  const intervalo = (pct) => Math.round(2000 / (1 + (pct + doDex) / 100));
  assert.equal(comVelocidade(0).intervaloDoGolpeMs, intervalo(0));
  const f = comVelocidade(100);
  assert.equal(f.velocidadeDeAtaque, 100 + doDex);
  assert.equal(f.intervaloDoGolpeMs, intervalo(100), '+100% ≈ metade do intervalo');
  assert.equal(comVelocidade(25).intervaloDoGolpeMs, intervalo(25));
});
