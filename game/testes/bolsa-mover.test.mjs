// Mover da bolsa de loot para a mochila sem dizer QUAL peça (o menu do celular
// e o arrasto mandavam só o `id`): a peça estrelada não pode ficar na bolsa e
// aparecer outra, limpa, na mochila.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Bolsa from '../systems/bolsa.mjs';
import { personagemDeTeste } from './apoio.mjs';

const ESPADA = 660; // fiery spike sword — não empilha
const ESTRELAS = [{ id: 'dano', tier: 2, value: 5 }];
const quantas = (lista, id) => lista.filter((p) => p.id === id).reduce((a, p) => a + (p.count ?? 1), 0);

function comBolsa(pecas) {
  const e = personagemDeTeste();
  e.inventory = [];
  e.pouch = pecas.map((p) => ({ ...p }));
  return e;
}

test('estrelada sozinha na bolsa, sem pilha: vai INTEIRA e não duplica', () => {
  const e = comBolsa([{ id: ESPADA, count: 1, af: ESTRELAS }]);
  assert.ok(Bolsa.moverBolsa(e, { id: ESPADA, count: 9999, to: 'bag' }).ok);
  assert.equal(quantas(e.pouch, ESPADA), 0, 'saiu da bolsa');
  assert.equal(quantas(e.inventory, ESPADA), 1, 'uma só na mochila');
  assert.deepEqual(e.inventory[0].af, ESTRELAS, 'com as estrelas');
});

test('pelo alvo (indice) do menu: a estrelada apontada vai inteira', () => {
  const e = comBolsa([{ id: ESPADA, count: 1 }, { id: ESPADA, count: 1, af: ESTRELAS }]);
  assert.ok(Bolsa.moverBolsa(e, { id: ESPADA, count: 9999, to: 'bag', alvo: { indice: 1 } }).ok);
  assert.deepEqual(e.inventory.map((p) => p.af ?? null), [ESTRELAS]);
  assert.equal(quantas(e.pouch, ESPADA), 1, 'a simples ficou');
});

test('simples + estrelada, sem pilha: sai a simples e o total não muda', () => {
  const e = comBolsa([{ id: ESPADA, count: 1, af: ESTRELAS }, { id: ESPADA, count: 1 }]);
  assert.ok(Bolsa.moverBolsa(e, { id: ESPADA, count: 9999, to: 'bag' }).ok);
  assert.equal(quantas(e.pouch, ESPADA) + quantas(e.inventory, ESPADA), 2, 'nada criado do nada');
  assert.deepEqual(e.pouch[0].af, ESTRELAS, 'a estrelada continua na bolsa, com as estrelas');
  assert.equal(e.inventory[0].af, undefined, 'a que foi é a simples');
});
