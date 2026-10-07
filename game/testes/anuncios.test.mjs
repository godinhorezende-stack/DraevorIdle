// O anúncio de drop Épico+ para o servidor inteiro (systems/anuncios.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Anuncios from '../systems/anuncios.mjs';
import { gerarItem } from '../systems/itens/gerar.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';

const ESPADA = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'fire sword').id);
const sessao = (nome) => ({ personagem: nome ? { nome } : null, recebidas: [], enviarPronto(t) { this.recebidas.push(JSON.parse(t)); } });

test('Épico, Lendário e Mítico vão para TODO mundo online (quem dropou inclusive); Comum/Incomum/Raro não', () => {
  const a = sessao('Zotod');
  const b = sessao('Godines');
  const naTelaDeLogin = sessao(null);
  Anuncios.ligar(new Map([['Zotod', a], ['Godines', b], ['?', naTelaDeLogin]]));
  for (const raridade of ['comum', 'incomum', 'raro']) {
    assert.equal(Anuncios.dropRaro({ quem: 'Zotod', peca: gerarItem({ itemId: ESPADA, itemLevel: 700, raridade }), bicho: 'Troll' }), 0, raridade);
  }
  for (const raridade of ['épico', 'lendário', 'mítico']) {
    assert.equal(Anuncios.dropRaro({ quem: 'Zotod', peca: gerarItem({ itemId: ESPADA, itemLevel: 700, raridade }), bicho: 'Troll', onde: 'Troll Cave' }), 2, raridade);
  }
  assert.equal(a.recebidas.length, 3);
  assert.deepEqual(b.recebidas.map((m) => m.peca.raridade), ['épico', 'lendário', 'mítico']);
  assert.equal(naTelaDeLogin.recebidas.length, 0, 'quem ainda não entrou num personagem não recebe');
});

test('a mensagem leva quem, o bicho e a PEÇA inteira (base, Item Level, adds, poder) para o balão do jogo', () => {
  const peca = gerarItem({ itemId: ESPADA, itemLevel: 900, raridade: 'mítico', rng: () => 0.42 });
  const m = Anuncios.mensagem({ quem: 'Zotod', peca, bicho: 'Ferumbras', boss: true, onde: 'Ferumbras', em: 123 });
  assert.equal(m.t, 'dropRaro');
  assert.equal(m.quem, 'Zotod');
  assert.equal(m.bicho, 'Ferumbras');
  assert.equal(m.boss, true);
  assert.equal(m.nome, 'fire sword');
  assert.equal(m.peca.id, ESPADA);
  assert.equal(m.peca.ilvl, 900);
  assert.deepEqual(m.peca.base, peca.base);
  assert.deepEqual(m.peca.af, peca.af);
  assert.deepEqual(m.peca.efeito, peca.efeito);
});

test('o ÚNICO do PoE é anunciado para todo mundo (chat e faixa), com o nome dele; Raro, Mágico e Normal não', async () => {
  const { ITEM_CATALOG: C } = await import('../systems/dados.mjs');
  const A = await import('../systems/anuncios.mjs');
  const id = Number(Object.keys(C)[0]);
  const unico = { id, count: 1, poe: { raridade: 'unico', nome: 'Correntes do Covarde', cor: '#a66734' } };
  assert.equal(A.vale(unico), true);
  assert.equal(A.mensagem({ quem: 'Ana', peca: unico, bicho: 'Hillock' }).nome, 'Correntes do Covarde');
  for (const r of ['raro', 'magico', 'normal']) assert.equal(A.vale({ id, count: 1, poe: { raridade: r, nome: 'x' } }), false, r);
  const recebidas = [];
  A.ligar(new Map([['ana', { personagem: { nome: 'Ana' }, enviarPronto: (t) => recebidas.push(JSON.parse(t)) }], ['bia', { personagem: { nome: 'Bia' }, enviarPronto: (t) => recebidas.push(JSON.parse(t)) }]]));
  assert.equal(A.dropRaro({ quem: 'Ana', peca: unico, bicho: 'Hillock', onde: 'Costa' }), 2, 'vai para todo mundo online');
  assert.deepEqual(recebidas.map((m) => [m.t, m.nome, m.peca.poe.raridade]), [['dropRaro', 'Correntes do Covarde', 'unico'], ['dropRaro', 'Correntes do Covarde', 'unico']]);
});
