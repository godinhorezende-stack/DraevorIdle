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

test('a ficha traz o intervalo real entre golpes: 2 s sem bônus, e a velocidade de ataque o encurta', () => {
  assert.equal(ATAQUE_MS, 2000);
  assert.equal(comVelocidade(0).intervaloDoGolpeMs, 2000);
  const f = comVelocidade(100);
  assert.equal(f.velocidadeDeAtaque, 100);
  assert.equal(f.intervaloDoGolpeMs, 1000, '+100% = metade do intervalo');
  assert.ok(comVelocidade(25).intervaloDoGolpeMs === 1600);
});
