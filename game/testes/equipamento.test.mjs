// Duas mãos (systems/inventario.mjs): arma de duas mãos não divide o corpo com
// escudo — vestir uma tira o outro, que volta para a mochila; a aljava fica
// (é o que o arco/besta usa).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Inventario from '../systems/inventario.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

const porNome = (nome) => Object.values(ITEM_CATALOG).find((i) => i.name === nome);
const DUAS_MAOS = porNome('two handed sword');
const ESCUDO = porNome('dwarven shield');
const ARCO = Object.values(ITEM_CATALOG).find((i) => i.twoHanded && i.ammo && !i.minLevel && !i.vocations?.length) ?? Object.values(ITEM_CATALOG).find((i) => i.twoHanded && i.ammo);
const ALJAVA = porNome('quiver');

function comNaMochila(voc, ...itens) {
  const e = personagemDeTeste({ vocacao: voc, level: 500 });
  e.inventory = itens.map((i) => ({ id: i.id, count: 1 }));
  return e;
}

test('vestir arma de duas mãos tira o escudo para a mochila (com aviso)', () => {
  const e = comNaMochila('knight', DUAS_MAOS);
  e.equipment.shield = { id: ESCUDO.id, count: 1 };
  const r = Inventario.equipar(e, { id: DUAS_MAOS.id });
  assert.equal(r.ok, true);
  assert.equal(e.equipment.weapon.id, DUAS_MAOS.id);
  assert.equal(e.equipment.shield, null);
  assert.ok(e.inventory.some((p) => p.id === ESCUDO.id), 'o escudo voltou para a mochila');
  assert.match(r.notice, /Duas mãos: dwarven shield voltou para a mochila/);
});

test('vestir escudo com arma de duas mãos na mão tira a arma', () => {
  const e = comNaMochila('knight', ESCUDO);
  e.equipment.weapon = { id: DUAS_MAOS.id, count: 1 };
  const r = Inventario.equipar(e, { id: ESCUDO.id });
  assert.equal(r.ok, true);
  assert.equal(e.equipment.shield.id, ESCUDO.id);
  assert.equal(e.equipment.weapon, null);
  assert.ok(e.inventory.some((p) => p.id === DUAS_MAOS.id));
});

test('arco de duas mãos e aljava convivem', () => {
  const e = comNaMochila('paladin', ARCO, ALJAVA);
  e.level = 999;
  assert.equal(Inventario.equipar(e, { id: ALJAVA.id }).ok, true);
  const r = Inventario.equipar(e, { id: ARCO.id });
  assert.equal(r.ok, true, r.erro);
  assert.equal(e.equipment.shield?.id, ALJAVA.id, 'a aljava continua');
  assert.equal(e.equipment.weapon.id, ARCO.id);
  assert.equal(r.notice, undefined);
});

test('personagem que já estava com duas mãos + escudo é corrigido na entrada (a peça com atributos volta inteira)', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 500 });
  e.equipment.weapon = { id: DUAS_MAOS.id, count: 1 };
  e.equipment.shield = { id: ESCUDO.id, count: 1, raridade: 'raro', af: [{ id: 'armor_flat', nivel: 3, value: 5 }] };
  assert.equal(Inventario.corrigirDuasMaos(e), true);
  assert.equal(e.equipment.shield, null);
  const volta = e.inventory.find((p) => p.id === ESCUDO.id);
  assert.equal(volta?.af?.[0]?.id, 'armor_flat');
  assert.equal(Inventario.corrigirDuasMaos(e), false, 'nada a corrigir de novo');
});
