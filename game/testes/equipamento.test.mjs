// Duas mãos (systems/inventario.mjs): arma de duas mãos não divide o corpo com
// escudo — vestir uma tira o outro, que volta para a mochila; a aljava fica
// (é o que o arco/besta usa).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Inventario from '../systems/inventario.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Bolsa from '../systems/bolsa.mjs';
import * as Gerar from '../systems/itens/gerar.mjs';
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

// ---- Munição e arremessável: não empilham, vêm com raridade, somam ataque ----

const SPEAR = porNome('spear');
const BOW = porNome('bow');
const ARROW = porNome('arrow');
const FLAMING = porNome('flaming arrow');
const BOLT = porNome('bolt');

test('arremessável (spear) é de duas mãos: tira o escudo; e não empilha', () => {
  assert.equal(SPEAR.twoHanded, true);
  assert.equal(SPEAR.stackable, false);
  const e = comNaMochila('paladin', SPEAR);
  e.equipment.weapon = null;
  e.equipment.shield = { id: ESCUDO.id, count: 1 };
  Inventario.equipar(e, { id: SPEAR.id });
  assert.equal(e.equipment.shield, null);
});

test('munição e arremessável aceitam raridade e atributos (a munição com o pool dela)', () => {
  for (const it of [ARROW, BOLT, SPEAR]) assert.equal(Gerar.aceitaAtributos(it.id), true, it.name);
  const pool = Gerar.poolDe(ARROW.id);
  assert.ok(pool.includes('dex') && pool.includes('fire_dmg'));
  let comAtributo = 0;
  for (let i = 0; i < 400; i++) if (Gerar.gerarItem({ itemId: ARROW.id, ato: 3, dificuldade: 'medio' }).af?.length) comAtributo++;
  assert.ok(comAtributo > 0);
});

test('o ataque da munição do tipo certo soma ao do arco (como no Tibia); a flecha elemental traz o elemento', () => {
  const ficha = (mun) => {
    const e = personagemDeTeste({ vocacao: 'paladin', level: 100 });
    e.equipment.shield = null;
    e.equipment.weapon = { id: BOW.id, count: 1 };
    e.equipment.ammo = mun ? { id: mun.id, count: 1 } : null;
    return Ficha.combate(e);
  };
  assert.equal(ficha(null).ataque, 0);
  assert.equal(ficha(ARROW).ataque, ARROW.attack);
  assert.equal(ficha(BOLT).ataque, 0, 'bolt no arco não serve');
  assert.deepEqual(ficha(FLAMING).element, FLAMING.element);
});

test('pilha antiga de munição vira uma peça e o resto é vendido; equipar leva uma unidade', () => {
  const e = personagemDeTeste({ vocacao: 'paladin', level: 100 });
  const ouro = e.gold ?? 0;
  e.inventory = [{ id: ARROW.id, count: 200 }];
  e.equipment.ammo = { id: BOLT.id, count: 50 };
  const r = Bolsa.desempilharMunicao(e);
  assert.equal(r.pecas, 199 + 49);
  assert.equal(e.inventory[0].count, 1);
  assert.equal(e.equipment.ammo.count, 1);
  assert.equal(e.gold - ouro, r.ouro);
  assert.deepEqual(Bolsa.desempilharMunicao(e), { pecas: 0, ouro: 0 }, 'uma vez só');
  e.inventory.push({ id: ARROW.id, count: 1 }, { id: ARROW.id, count: 1 });
  Inventario.equipar(e, { id: ARROW.id });
  assert.equal(e.equipment.ammo.count, 1);
});
