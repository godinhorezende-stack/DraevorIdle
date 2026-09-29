// Melee é UMA perícia (punho, clava, espada e machado juntos), ao lado de
// distance, shielding e magic level. Ver `Treino.canonica`/`Treino.garantir`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Treino from '../systems/treino.mjs';
import * as Ficha from '../systems/ficha.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

test('as perícias são melee, distance, shielding e fishing (fora o magic level)', () => {
  assert.deepEqual(Treino.PERICIAS, ['melee', 'distance', 'shielding', 'fishing']);
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  assert.deepEqual(Object.keys(Treino.paraCliente(e).skills), Treino.PERICIAS);
});

test('fist, club, sword e axe treinam e leem o mesmo melee', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  Treino.garantir(e);
  const antes = Treino.valor(e, 'melee');
  for (const arma of ['fist', 'club', 'sword', 'axe']) Treino.treinar(e, arma, 200);
  assert.ok(e.skills.melee.value > antes);
  for (const arma of ['fist', 'club', 'sword', 'axe']) assert.equal(Treino.valor(e, arma), e.skills.melee.value);
  assert.equal(e.skills.sword, undefined);
});

test('personagem salvo com as quatro perícias antigas fica com a maior no melee', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  e.skills = { fist: { value: 12, tries: 3 }, club: { value: 40, tries: 5 }, sword: { value: 71, tries: 9 }, axe: { value: 33, tries: 1 }, distance: { value: 20, tries: 0 }, shielding: { value: 60, tries: 0 } };
  assert.equal(Treino.valor(e, 'melee'), 71); // até antes do `garantir` explícito
  Treino.garantir(e);
  assert.deepEqual(e.skills.melee, { value: 71, tries: 9 });
  for (const k of ['fist', 'club', 'sword', 'axe']) assert.equal(e.skills[k], undefined);
  assert.equal(e.skills.distance.value, 20);
});

test('a perícia da arma na ficha é sempre melee, menos distance e magic', () => {
  const de = (skill) => Object.values(ITEM_CATALOG).find((i) => i.slot === 'weapon' && i.skill === skill && !i.wand);
  for (const skill of ['sword', 'axe', 'club']) assert.equal(Ficha.periciaDaArma(de(skill)), 'melee', skill);
  assert.equal(Ficha.periciaDaArma(null), 'melee'); // sem arma: punho
  assert.equal(Ficha.periciaDaArma(de('distance')), 'distance');
});
