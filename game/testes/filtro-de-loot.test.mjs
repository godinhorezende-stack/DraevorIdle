// O filtro de loot no sistema de itens: raridade mínima, nível do atributo
// (N1–N5) e quantos atributos com esse nível — as regras ligadas valem JUNTAS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Afixos from '../systems/afixos.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);
const peca = (raridade, ...niveis) => ({ id: ANEL, count: 1, raridade, ...(niveis.length ? { af: niveis.map((nivel, i) => ({ id: ['hp_max', 'mana_max', 'crit_chance', 'crit_dmg', 'atk_speed', 'fire_dmg'][i], nivel, value: 1 })) } : {}) });
const com = (settings) => ({ ...personagemDeTeste(), settings });

test('padrão: guarda qualquer peça com atributo; o comum (sem atributo) vende', () => {
  const e = com({});
  assert.deepEqual(Afixos.regraDoAtributo(e.settings), { nivel: 1, quantos: 1 });
  assert.equal(Afixos.guarda(e, peca('incomum', 1)), true);
  assert.equal(Afixos.guarda(e, peca('comum')), false);
});

test('quantidade de atributos + nível mínimo (pelo menos UM atributo desse nível)', () => {
  const e = com({ guardarNivel: 4, guardarQuantos: 2 });
  assert.equal(Afixos.guarda(e, peca('raro', 4, 5)), true, 'dois atributos, um N4+');
  // Desde 30/09 (pedido do dono): "2+ atributos E pelo menos um N4+" — antes era "dois N4+".
  assert.equal(Afixos.guarda(e, peca('épico', 5, 3, 3)), true, 'três atributos, um N5');
  assert.equal(Afixos.guarda(e, peca('épico', 3, 3, 3)), false, 'nenhum N4+');
  assert.equal(Afixos.guarda(e, peca('incomum', 5)), false, 'só um atributo');
  assert.equal(Afixos.guarda(com({ guardarNivel: 5 }), peca('mítico', 5, 1)), true);
  assert.equal(Afixos.guarda(com({ guardarNivel: 0 }), peca('mítico', 5, 5)), false, 'nada ligado: vende');
});

test('raridade e atributo valem com OU (pedido do dono, 30/09): a raridade não decide sozinha', () => {
  const e = com({ guardarRaridade: 3, guardarNivel: 3 });
  assert.equal(Afixos.guarda(e, peca('épico', 3)), true);
  assert.equal(Afixos.guarda(e, peca('raro', 5, 5)), true, 'raridade abaixo do piso, mas o atributo N3+ segura');
  assert.equal(Afixos.guarda(e, peca('lendário', 1, 2)), true, 'sem atributo N3+, mas a raridade segura');
  assert.equal(Afixos.guarda(e, peca('raro', 1, 2)), false, 'nem uma nem outra');
  // Só a raridade ligada: guarda pela raridade, com atributo ou sem.
  assert.equal(Afixos.guarda(com({ guardarRaridade: 3, guardarNivel: 0 }), peca('épico', 1)), true);
});

test('tier, imbuement e essência nunca vendem', () => {
  const e = com({ guardarNivel: 0 });
  assert.equal(Afixos.guarda(e, { ...peca('comum'), tier: 2 }), true);
  assert.equal(Afixos.guarda(e, { ...peca('comum'), imbu: [{}] }), true);
});

test('as regras de antes são traduzidas: roxa para cima = N3+, só a dourada = N5, estrelas = quantos', () => {
  assert.deepEqual(Afixos.regraDoAtributo({ guardarAfixo: 2, guardarEstrelas: 2 }), { nivel: 3, quantos: 2 });
  assert.deepEqual(Afixos.regraDoAtributo({ guardarAfixo: 3 }), { nivel: 5, quantos: 1 });
  assert.deepEqual(Afixos.regraDoAtributo({ guardarAfixo: 0 }), { nivel: 0, quantos: 1 });
  // A regra nova manda, mesmo com a antiga gravada.
  assert.deepEqual(Afixos.regraDoAtributo({ guardarAfixo: 3, guardarNivel: 2, guardarQuantos: 4 }), { nivel: 2, quantos: 4 });
});
