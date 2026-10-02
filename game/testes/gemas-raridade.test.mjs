// Gemas (e qualquer peça com dados próprios) NÃO perdem raridade, nível, XP, qualidade, base, sockets... ao mudar de compartimento.
// A causa era um predicado ("essa peça é especial?") copiado em cada compartimento que só olhava atributo, tier e imbuement: a gema só tem
// `raridade` e `gema`, então virava um item LIMPO por id (`{id, count}`) — bolsa de loot ↔ mochila, anúncio/compra no Mercado, juntar
// (que somava a contagem e sumia com a instância). Agora tudo usa `pecaEspecial` (itens/item.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as Bolsa from '../systems/bolsa.mjs';
import * as Inv from '../systems/inventario.mjs';
import * as Deposito from '../systems/deposito.mjs';
import * as Bau from '../systems/bau.mjs';
import * as Mercado from '../systems/mercado.mjs';
import * as Gemas from '../systems/skills/gemas.mjs';
import { pecaEspecial, converterTudo, camposDaPeca } from '../systems/itens/item.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

const ITEM = 910001; // gema: buzz
const RARIDADES = ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico'].filter((r) => Gemas.raridadeDaGema(r) === r);
const gema = (raridade, extra = {}) => Gemas.itemDaGema({ id: ITEM, nivel: 4, xp: 7, raridade, qualidade: 12, ...extra });
const igual = (a, b) => assert.deepEqual(camposDaPeca(a), camposDaPeca(b));
const novo = () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 100 });
  e.inventory = [];
  Bolsa.garantir(e);
  e.pouch = [];
  return e;
};

test('as raridades das gemas que existem no jogo estão cobertas pelo teste', () => {
  assert.ok(RARIDADES.length >= 3, `raridades: ${RARIDADES}`);
  assert.ok(RARIDADES.includes('comum'));
});

test('pecaEspecial: a gema (só raridade + gema) é especial; o item limpo e a raridade comum sozinha não', () => {
  assert.equal(pecaEspecial(gema('raro')), true);
  assert.equal(pecaEspecial(gema('comum')), true, 'a gema comum também tem nível/XP/qualidade');
  assert.equal(pecaEspecial({ id: ITEM, count: 1 }), false);
  assert.equal(pecaEspecial({ id: 660, count: 1, raridade: 'comum' }), false);
  assert.equal(pecaEspecial({ id: 660, count: 1, raridade: 'mítico' }), true);
  for (const campo of [{ af: [{ id: 'x' }] }, { tier: 1 }, { imbu: [{}] }, { base: { attack: [1, 2] } }, { soquetes: { abertos: 1, links: [], gemas: [null] } }, { efeito: {} }, { ilvl: 50 }]) assert.equal(pecaEspecial({ id: 660, count: 1, ...campo }), true, JSON.stringify(campo));
});

for (const raridade of RARIDADES) {
  test(`bolsa de loot ↔ mochila, ida e volta, 3 vezes: a gema ${raridade} (nível, XP, qualidade) chega igual`, () => {
    const e = novo();
    const original = gema(raridade);
    Bolsa.porNaBolsa(e, ITEM, 1, original); // o loot cai na bolsa
    igual(e.pouch[0], original);
    for (let volta = 0; volta < 3; volta++) {
      assert.ok(Bolsa.moverBolsa(e, { id: ITEM, count: 1, to: 'bag' }).ok);
      assert.equal(e.pouch.length, 0);
      assert.equal(e.inventory.length, 1);
      igual(e.inventory[0], original);
      assert.ok(Bolsa.moverBolsa(e, { id: ITEM, count: 1, to: 'pouch' }).ok);
      assert.equal(e.inventory.length, 0);
      igual(e.pouch[0], original);
    }
  });
}

test('duas gemas do mesmo item, raridades diferentes: a apontada (índice) é a que vai; e sem apontar nenhuma vira cópia limpa', () => {
  const e = novo();
  const rara = gema('raro', { nivel: 9, xp: 1 });
  const comum = gema('comum', { nivel: 2, xp: 0 });
  e.pouch = [structuredClone(comum), structuredClone(rara)];
  assert.ok(Bolsa.moverBolsa(e, { id: ITEM, count: 1, to: 'bag', alvo: { indice: 1 } }).ok);
  igual(e.inventory[0], rara);
  igual(e.pouch[0], comum);
  // o menu do celular manda só o id: ainda assim vai uma gema INTEIRA (a que está lá), nunca um item limpo
  assert.ok(Bolsa.moverBolsa(e, { id: ITEM, count: 1, to: 'bag' }).ok);
  assert.equal(e.pouch.length, 0);
  assert.equal(e.inventory.length, 2);
  assert.ok(e.inventory.every((p) => p.gema && p.raridade), 'nenhuma ficou limpa');
});

test('juntar: duas gemas do mesmo item NÃO se fundem (antes a contagem somava e uma instância sumia)', () => {
  const e = novo();
  e.inventory = [gema('raro'), gema('épico', { nivel: 2 })];
  const r = Inv.juntar(e, { de: 0, para: 1 });
  assert.equal(r.ok, false);
  assert.equal(e.inventory.length, 2, 'as duas continuam');
  assert.equal(e.inventory[0].raridade, 'raro');
});

test('juntar continua juntando o que empilha (poção limpa)', () => {
  const pocao = Object.values(ITEM_CATALOG).find((i) => i.stackable && !i.slot && /potion/i.test(i.name));
  const e = novo();
  e.inventory = [{ id: pocao.id, count: 10 }, { id: pocao.id, count: 5 }];
  assert.equal(Inv.juntar(e, { de: 0, para: 1 }).ok, true);
  assert.equal(e.inventory.reduce((a, p) => a + p.count, 0), 15);
});

test('organizar, trocar, largar e pegar: a gema segue inteira', () => {
  const e = novo();
  const g = gema('raro');
  e.inventory = [structuredClone(g), { id: 660, count: 1 }];
  Inv.organizar(e, {});
  const depois = e.inventory.find((p) => p.id === ITEM);
  igual(depois, g);
  Inv.trocar(e, { de: 0, para: 1 });
  igual(e.inventory.find((p) => p.id === ITEM), g);
  const i = e.inventory.findIndex((p) => p.id === ITEM);
  Inv.largar(e, { id: ITEM, count: 1, x: e.pos.x, y: e.pos.y, deIndice: i });
  assert.equal(e.inventory.some((p) => p.id === ITEM), false, 'saiu da mochila');
  assert.ok(Inv.pegar(e, { x: e.pos.x, y: e.pos.y }).ok);
  igual(e.inventory.find((p) => p.id === ITEM), g);
});

test('depósito: guardar e tirar devolve a mesma gema', () => {
  const e = novo();
  const g = gema('lendário', { nivel: 7, xp: 99, qualidade: 5 });
  e.inventory = [structuredClone(g)];
  Deposito.garantir(e);
  assert.ok(Deposito.comando(e, { action: 'store', id: ITEM, count: 1, caixa: 0 }).ok);
  assert.equal(e.inventory.length, 0);
  assert.ok(Deposito.comando(e, { action: 'take', id: ITEM, count: 1, caixa: 0 }).ok);
  igual(e.inventory[0], g);
});

test('baú de recompensas (Boss Pouch): a gema do boss chega com a raridade', () => {
  const e = novo();
  const g = gema('mítico');
  Bau.novaSacola(e, 'Boss', [structuredClone(g)]);
  assert.ok(Bau.comandoDoBau(e, { action: 'takeAll' }).ok);
  igual(e.bossPouch[0], g);
});

test('socket: encaixar e tirar preserva raridade, nível, XP e qualidade (e trocar devolve a antiga inteira)', () => {
  const e = novo();
  const peca = Object.values(ITEM_CATALOG).find((i) => i.slot === 'body' && !i.stackable && Gemas.soquetesAbertos(i));
  e.equipment = { body: { id: peca.id, soquetes: Gemas.soquetesAbertos(peca) } };
  const a = gema('raro', { nivel: 5, xp: 3, qualidade: 8 });
  const b = gema('épico', { nivel: 9, xp: 40, qualidade: 20 });
  e.inventory = [structuredClone(a), structuredClone(b)];
  assert.ok(Gemas.encaixar(e, { de: 0, slot: 'body', indice: 0 }).ok);
  assert.ok(Gemas.encaixar(e, { de: 0, slot: 'body', indice: 0 }).ok, 'troca: a antiga volta');
  igual(e.inventory[0], a);
  assert.ok(Gemas.tirar(e, { slot: 'body', indice: 0 }).ok);
  igual(e.inventory.at(-1), b);
});

test('persistência: gravar e carregar (JSON + migração do personagem) mantém a gema da mochila, da bolsa e do depósito', () => {
  const e = novo();
  const g = gema('épico', { nivel: 6, xp: 12, qualidade: 3 });
  e.inventory = [structuredClone(g)];
  e.pouch = [structuredClone(g)];
  Deposito.garantir(e);
  e.deposito[0].itens.push(structuredClone(g));
  const volta = JSON.parse(JSON.stringify(e));
  converterTudo(volta, Math.random, { abrirSoquetes: false });
  igual(volta.inventory[0], g);
  igual(volta.pouch[0], g);
  igual(volta.deposito[0].itens[0], g);
});

test('Mercado: anunciar e comprar a gema entrega a MESMA gema (antes chegava limpa, sem raridade)', async () => {
  const vendedor = { id: `v-${randomUUID()}`, nome: 'Vendedor' };
  const comprador = { id: `c-${randomUUID()}`, nome: 'Comprador' };
  const ev = novo();
  const ec = novo();
  ec.gold = 1_000_000;
  const g = gema('raro', { nivel: 8, xp: 21, qualidade: 15 });
  ev.inventory = [structuredClone(g)];
  const r = await Mercado.anunciar(ev, vendedor, { kind: 'sell', id: ITEM, count: 1, price: 100, moeda: 'gold' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(ev.inventory.length, 0, 'saiu da mochila do vendedor');
  const { banco } = await import('../database/banco.mjs');
  const oferta = await banco.prepare('SELECT id FROM mercado_ofertas WHERE personagem = ?').get(vendedor.id);
  const c = await Mercado.aceitar(ec, comprador, { offerId: oferta.id, count: 1 }, () => null);
  assert.equal(c.ok, true, JSON.stringify(c));
  const chegou = ec.inventory.find((p) => p.id === ITEM) ?? ec.deposito?.flatMap((x) => x.itens).find((p) => p.id === ITEM);
  assert.ok(chegou, 'a gema chegou');
  igual(chegou, g);
});

test('desequipar devolve a peça só com raridade (munição) sem perder a raridade', () => {
  const municao = Object.values(ITEM_CATALOG).find((i) => i.slot === 'ammo' && !i.stackable);
  if (!municao) return;
  const e = novo();
  e.equipment = { ammo: { id: municao.id, count: 1, raridade: 'raro' } };
  Inv.desequipar(e, { slot: 'ammo' });
  assert.equal(e.inventory[0]?.raridade, 'raro');
});
