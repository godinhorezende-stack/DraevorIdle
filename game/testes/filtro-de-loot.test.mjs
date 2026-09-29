// O filtro de loot no sistema de itens: raridade mínima, nível do atributo
// (N1–N5) e quantos atributos com esse nível — as regras ligadas valem JUNTAS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Afixos from '../systems/afixos.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);
const peca = (raridade, ...niveis) => ({ id: ANEL, count: 1, raridade, ...(niveis.length ? { af: niveis.map((nivel, i) => ({ id: ['hp_pct', 'mana_pct', 'crit_chance', 'crit_dmg', 'atk_pct', 'def_pct'][i], nivel, value: 1 })) } : {}) });
const com = (settings) => ({ ...personagemDeTeste(), settings });

test('padrão: guarda qualquer peça com atributo; o comum (sem atributo) vende', () => {
  const e = com({});
  assert.deepEqual(Afixos.regraDoAtributo(e.settings), { nivel: 1, quantos: 1 });
  assert.equal(Afixos.guarda(e, peca('incomum', 1)), true);
  assert.equal(Afixos.guarda(e, peca('comum')), false);
});

test('nível mínimo e quantos com esse nível', () => {
  const e = com({ guardarNivel: 4, guardarQuantos: 2 });
  assert.equal(Afixos.guarda(e, peca('raro', 4, 5)), true, 'dois N4+');
  assert.equal(Afixos.guarda(e, peca('épico', 5, 3, 3)), false, 'só um N4+');
  assert.equal(Afixos.guarda(com({ guardarNivel: 5 }), peca('mítico', 5, 1)), true);
  assert.equal(Afixos.guarda(com({ guardarNivel: 0 }), peca('mítico', 5, 5)), false, 'nada ligado: vende');
});

test('raridade e atributo ligados valem JUNTOS', () => {
  const e = com({ guardarRaridade: 3, guardarNivel: 3 });
  assert.equal(Afixos.guarda(e, peca('épico', 3)), true);
  assert.equal(Afixos.guarda(e, peca('raro', 5, 5)), false, 'raridade abaixo do piso');
  assert.equal(Afixos.guarda(e, peca('lendário', 1, 2)), false, 'nenhum atributo N3+');
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
