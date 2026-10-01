// O bug do socket no celular: segurar a fileira de sockets da peça vestida arrastava a PEÇA, e
// soltar no mesmo slot mandava `equip` — que veste a cópia da mochila (outros sockets, gemas
// da vestida indo para a mochila). Aqui: a causa no servidor (o `equip` lê a mochila) e as
// regras do cliente que a evitam (`regras-de-toque.mjs`, puro, sem navegador).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Inventario from '../systems/inventario.mjs';
import * as Gemas from '../systems/skills/gemas.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';
import { comecouSemArrasto, acaoDaSolturaNoSlot, engoleEsteClique, JANELA_DO_CLIQUE_ENGOLIDO_MS } from '../frontend/client/src/regras-de-toque.mjs';

test('a CAUSA: `equip` lê a mochila — com outra cópia lá, ele troca a peça vestida (outros sockets, gemas para a mochila)', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  const vestida = e.equipment.weapon;
  const meta = ITEM_CATALOG[vestida.id];
  const max = Gemas.maximoDeSockets(meta);
  assert.ok(max >= 2, 'a arma tem sockets');
  // A vestida: 1 socket aberto, sem link, com uma gema. A cópia na mochila: todos abertos e ligados.
  vestida.soquetes = { abertos: 1, links: Array(max - 1).fill(false), gemas: [{ id: 1, nivel: 3 }, ...Array(max - 1).fill(null)] };
  const copia = { id: vestida.id, count: 1, soquetes: Gemas.soquetesAbertos(meta) };
  e.inventory.push(copia);
  // O que o slot mandava ao receber a peça arrastada do próprio corpo (sem `pilha`).
  const r = Inventario.equipar(e, { id: vestida.id, slot: 'weapon', pilha: null });
  assert.equal(r.ok, true);
  assert.equal(e.equipment.weapon.soquetes.abertos, max, 'vestiu a cópia: o "cadeado abriu"');
  assert.ok(e.equipment.weapon.soquetes.links.every(Boolean), 'e os sockets "se ligaram"');
  assert.ok(e.inventory.some((p) => p.soquetes?.gemas?.[0]?.nivel === 3), 'a vestida (com a gema) foi para a mochila');
});

test('a CORREÇÃO: soltar no slot uma peça que veio do corpo é ignorado; o resto continua igual', () => {
  assert.equal(acaoDaSolturaNoSlot({ id: 1, from: 'equipment' }, false), 'ignorar', 'a peça do corpo não "re-equipa"');
  assert.equal(acaoDaSolturaNoSlot({ id: 1, from: 'equipment' }, true), 'ignorar');
  assert.equal(acaoDaSolturaNoSlot({ id: 1, from: 'bag', pilha: 3 }, false), 'equipar', 'da mochila: veste');
  assert.equal(acaoDaSolturaNoSlot({ id: 1, from: 'pouch' }, false), 'equipar', 'da bolsa: veste');
  assert.equal(acaoDaSolturaNoSlot({ id: 1, from: 'bag', pilha: 3 }, true), 'gema', 'gema da mochila: encaixa (arrastar gema continua)');
  assert.equal(acaoDaSolturaNoSlot({ id: 1, from: 'storeInbox' }, false), 'aviso');
  assert.equal(acaoDaSolturaNoSlot(null, false), 'ignorar');
});

test('o arrasto que começa na fileira de sockets não sai; o que começa no resto do slot, sai', () => {
  const no = (sel) => ({ closest: (q) => (q === '[data-sem-arrasto]' && sel ? {} : null) });
  assert.equal(comecouSemArrasto(no(true)), true, 'dedo na fileira de sockets: sem arrasto');
  assert.equal(comecouSemArrasto(no(false)), false, 'dedo na peça: arrasta como antes');
  assert.equal(comecouSemArrasto(null), false);
});

test('o click do toque longo é engolido só se chegar logo depois; um toque NOVO depois não é', () => {
  const t0 = 1_000_000;
  assert.equal(engoleEsteClique(t0, t0 + 50), true, 'o click que vem atrás do dedo levantado');
  assert.equal(engoleEsteClique(t0, t0 + JANELA_DO_CLIQUE_ENGOLIDO_MS + 1), false, 'antes: engolia o próximo toque em outro botão');
  assert.equal(engoleEsteClique(null, t0), false);
});
