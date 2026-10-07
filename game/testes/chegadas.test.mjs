// A Store Inbox e a Boss Pouch saíram (dono, 06/10: "tire boss pouch e store inbox, tudo comprado pela store vai para chegadas"):
// a compra da Store vai para as Chegadas do Depósito (sem teto); o que já estava na Inbox e na Boss Pouch vai para as Chegadas uma vez,
// inteiro; o Baú do Boss leva para a mochila (o que couber no peso) e o resto para a bolsa de loot; nada se guarda à mão nas Chegadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Deposito from '../systems/deposito.mjs';
import * as Loja from '../systems/loja.mjs';
import * as Bau from '../systems/bau.mjs';
import * as Afixos from '../systems/afixos.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

const acha = (n) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === n).id);
const chegadas = (e) => Deposito.garantir(e).find((c) => c.chegadas);
const novo = () => personagemDeTeste({ vocacao: 'knight', level: 50 });

test('o que estava na Store Inbox e na Boss Pouch vai inteiro para as Chegadas (uma vez), que não têm teto', () => {
  const e = novo();
  const mana = acha('mana potion');
  e.storeInbox = [{ id: mana, count: 7 }, { id: acha('exercise sword') || mana, count: 1, carga: 500 }];
  e.bossPouch = [{ id: acha('fire sword'), count: 1, tier: 2, af: [{ id: 'x', value: 1 }] }, ...Array.from({ length: 150 }, () => ({ id: acha('fire sword'), count: 1, af: [{ id: 'y', value: 2 }] }))];
  const c = chegadas(e);
  assert.deepEqual([e.storeInbox, e.bossPouch], [[], []]);
  assert.equal(c.itens.length, 153, 'tudo, acima das 100 de antes');
  assert.ok(c.semTeto);
  assert.ok(c.itens.some((p) => p.tier === 2 && p.af?.length), 'a peça chega inteira');
  assert.ok(c.itens.some((p) => p.carga === 500), 'a carga também');
  // Mais uma vez: nada duplica.
  assert.equal(chegadas(e).itens.length, 153);
});

test('a compra da Store vai para as Chegadas; nas Chegadas nada se guarda à mão', () => {
  const e = novo();
  e.coins = 1e6;
  const antes = chegadas(e).itens.length;
  const r = Loja.comprar(e, { id: 'buffpower-trio' });
  assert.ok(r.ok, r.erro);
  assert.ok(chegadas(e).itens.length > antes, 'os três itens do Buff Power estão nas Chegadas');
  assert.equal((e.storeInbox ?? []).length, 0);
  e.inventory = [{ id: acha('mana potion'), count: 1 }];
  const g = Deposito.comando(e, { action: 'store', caixa: Deposito.INDICE_DAS_CHEGADAS, id: acha('mana potion'), count: 1 });
  assert.ok(!g.ok && /Chegadas/.test(g.erro));
});

test('o Baú do Boss leva para a mochila o que cabe no peso e o resto para a bolsa de loot', () => {
  const e = novo();
  const espada = acha('fire sword');
  Bau.novaSacola(e, 'Boss', [{ id: espada, count: 1, af: [{ id: 'a', value: 1 }] }]);
  assert.ok(Bau.comandoDoBau(e, { action: 'takeAll' }).ok);
  assert.ok(e.inventory.some((p) => p.id === espada && p.af?.length), 'na mochila, inteira');
  // Sem capacidade: vai para a bolsa de loot.
  const pesada = acha('fire sword');
  e.inventory.push(...Array.from({ length: 400 }, () => ({ id: pesada, count: 1 })));
  assert.ok(!(Afixos.capacidade(e) > 1e9));
  const naBolsaAntes = (e.pouch ?? []).length;
  Bau.novaSacola(e, 'Boss', [{ id: espada, count: 1, af: [{ id: 'b', value: 2 }] }]);
  assert.ok(Bau.comandoDoBau(e, { action: 'takeAll' }).ok);
  assert.equal((e.pouch ?? []).length, naBolsaAntes + 1, 'na bolsa de loot');
  assert.equal(e.rewards.length, 0, 'a sacola esvaziou');
});
