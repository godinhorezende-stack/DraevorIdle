import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Treino from '../systems/treino.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { contraAtaque } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);

function troco(armaduraPlana, golpes = 300) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  Treino.garantir(e);
  e.equipment.shield = null;
  e.equipment.weapon = { id: e.equipment.weapon.id, count: 1, base: { defense: [0, 0] } };
  e.equipment.ring = { id: ANEL, count: 1, af: armaduraPlana ? [{ id: 'armor_flat', nivel: 5, value: armaduraPlana }] : [] };
  e.maxHp = e.hp = 1e9;
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' });
  const h = e.hunt;
  const bicho = criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null);
  const eventos = [];
  for (let i = 0; i < golpes; i++) contraAtaque(e, h, PERSONAGEM, bicho, eventos);
  return eventos.filter((x) => x.t === 'block');
}

test('armadura que engole o golpe inteiro NÃO é "bloqueou": sai marcada como absorvida', () => {
  const blocos = troco(100000);
  assert.ok(blocos.length > 0, 'a armadura absorveu golpes');
  for (const b of blocos) assert.equal(b.absorvido, true);
});

test('os "bloqueou" de verdade (sem a marca de absorvido) seguem a chance de bloqueio da ficha, e não a armadura', () => {
  const golpes = 2000;
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  e.equipment.shield = null;
  Ficha.invalidar(e);
  const chance = Ficha.combate(e).blockChanceMax;
  const reais = troco(0, golpes).filter((b) => !b.absorvido && !b.esquiva && !b.ruse && !b.charm);
  assert.ok(reais.length / golpes <= chance + 0.04, `bloqueou ${reais.length}/${golpes} com chance ${chance}`);
});
