// Compatibilidade do sistema de itens: as peças de ANTES (af com `tier` 1–3 e
// valor na régua antiga) são convertidas — nível, valor reescalado para a
// faixa nova, raridade pela quantidade — sem apagar nada; e o loot novo (bolsa,
// boss, projeção offline) sai inteiro do gerador central.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Item from '../systems/itens/item.mjs';
import * as C from '../systems/itens/config.mjs';
import * as Bolsa from '../systems/bolsa.mjs';
import * as Deposito from '../systems/deposito.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const antiga = (id, pct) => {
  const r = C.REGUA_ANTIGA[id];
  return { id, tier: 1, value: r.min + (pct / 100) * (r.max - r.min) };
};
const faixa = (id, n) => C.ATRIBUTOS[id].niveis[n];

test('o nível sai da posição na régua antiga, e o valor vai para a mesma posição na faixa nova', () => {
  const casos = [[0, 1], [10, 1], [30, 2], [50, 3], [70, 4], [90, 5], [100, 5]];
  for (const [pct, nivel] of casos) {
    const a = antiga('atk_flat', pct);
    assert.equal(Item.converterAtributo(a), true);
    assert.equal(a.nivel, nivel, `${pct}% -> N${nivel}`);
    const [lo, hi] = faixa('atk_flat', nivel);
    assert.ok(a.value >= lo && a.value <= hi, `${pct}%: ${a.value} em [${lo}, ${hi}]`);
    assert.equal(a.tier, undefined, 'o tier antigo sai (virou nível)');
  }
  // O topo antigo (ATK +10) vira o topo novo (+20).
  const topo = antiga('atk_flat', 100);
  Item.converterAtributo(topo);
  assert.equal(topo.value, 20);
});

test('a essência vermelha (acima do topo) continua acima do topo', () => {
  const r = C.REGUA_ANTIGA.crit_dmg;
  const vermelha = { id: 'crit_dmg', tier: 4, value: r.min + 1.3 * (r.max - r.min) };
  Item.converterAtributo(vermelha);
  assert.equal(vermelha.nivel, 5);
  assert.ok(vermelha.value > faixa('crit_dmg', 5)[1], `${vermelha.value} passa do teto do N5`);
});

test('a peça ganha a raridade pela quantidade de atributos; a essência mantém a dela', () => {
  const pecas = [1, 2, 3].map((n) => ({ id: 3004, count: 1, af: ['atk_flat', 'crit_chance', 'hp_max'].slice(0, n).map((id) => antiga(id, 40)) }));
  pecas.forEach((p) => Item.converterPeca(p));
  assert.deepEqual(pecas.map((p) => p.raridade), ['incomum', 'raro', 'épico']);
  const essencia = { id: 900001, count: 1, af: [antiga('fire_res', 50)], afixoDe: 'body', raridade: 'lendário' };
  Item.converterPeca(essencia);
  assert.equal(essencia.raridade, 'lendário');
  assert.equal(essencia.af[0].nivel, 3);
});

test('idempotente: converter de novo não muda nada; peça nova não é tocada', () => {
  const p = { id: 3004, count: 1, af: [antiga('atk_flat', 55)] };
  Item.converterPeca(p);
  const depois = JSON.stringify(p);
  assert.equal(Item.converterPeca(p), false);
  assert.equal(JSON.stringify(p), depois);
  const nova = { id: 3004, count: 1, raridade: 'raro', af: [{ id: 'atk_flat', nivel: 4, value: 12 }] };
  assert.equal(Item.converterPeca(nova), false);
  assert.deepEqual(nova, { id: 3004, count: 1, raridade: 'raro', af: [{ id: 'atk_flat', nivel: 4, value: 12 }] });
});

test('o personagem inteiro: equipamento, mochila, bolsa e depósito — uma vez só', () => {
  const e = personagemDeTeste({ level: 100 });
  e.equipment.ring = { id: 3004, count: 1, af: [antiga('hp_max', 100)] };
  e.inventory.push({ id: 3004, count: 1, af: [antiga('atk_flat', 10)] });
  e.pouch = [{ id: 3004, count: 1, af: [antiga('crit_chance', 60), antiga('crit_dmg', 60)] }];
  e.deposito = [{ indice: 0, itens: [{ id: 3004, count: 1, af: [antiga('speed', 90)] }] }];
  e.hunt = { monstros: [{ id: 1, af: [] }] };
  assert.equal(Item.converterPersonagem(e), 4);
  assert.equal(e.versaoDosItens, Item.VERSAO_DOS_ITENS);
  assert.equal(e.equipment.ring.af[0].nivel, 5);
  assert.equal(e.pouch[0].raridade, 'raro');
  assert.equal(e.deposito[0].itens[0].af[0].nivel, 5);
  assert.equal(Item.converterPersonagem(e), 0, 'marcado: não varre de novo');
});

test('o baú da conta é convertido ao ler', () => {
  const caixa = Deposito.caixaDaConta({ itens: [{ id: 3004, count: 1, af: [antiga('armor_flat', 20)] }] });
  assert.equal(caixa.itens[0].af[0].nivel, 1);
  assert.equal(caixa.itens[0].raridade, 'incomum');
});

test('a bolsa guarda a peça inteira do gerador (raridade e efeito), e aceita o formato antigo', () => {
  const e = personagemDeTeste({ level: 100 });
  Bolsa.porNaBolsa(e, 3004, 1, { raridade: 'lendário', af: [{ id: 'atk_flat', nivel: 3, value: 8 }], efeito: { tipo: 'lendario', id: 'desespero' } });
  assert.deepEqual(e.pouch.at(-1), { id: 3004, count: 1, af: [{ id: 'atk_flat', nivel: 3, value: 8 }], raridade: 'lendário', efeito: { tipo: 'lendario', id: 'desespero' } });
  Bolsa.porNaBolsa(e, 3004, 1, [{ id: 'atk_flat', nivel: 1, value: 2 }]);
  assert.deepEqual(e.pouch.at(-1), { id: 3004, count: 1, af: [{ id: 'atk_flat', nivel: 1, value: 2 }] });
});

test('caçada offline projetada: as peças saem COM atributos (antes saíam cruas depois dos 30 min)', () => {
  const e = personagemDeTeste({ level: 60 });
  e.stamina = 2520;
  assert.equal(Cacadas.entrar(e, { huntId: 'amazon-camp', mode: 'auto' }).ok, true);
  const T0 = Date.now() - 6 * 3_600_000;
  e.hunt.offlineDesde = T0;
  e.settings = { ...e.settings, autoSellPouch: false };
  Cacadas.simularAusencia(e, PERSONAGEM, Date.now());
  const pecas = (e.pouch ?? []).filter((p) => ITEM_CATALOG[p.id]?.slot && !ITEM_CATALOG[p.id]?.stackable);
  const comAtributo = pecas.filter((p) => p.af?.length);
  assert.ok(pecas.length > 0, 'caiu equipamento');
  // No Ato 1 Fácil ~72% dos drops são comuns, e comum nunca tem atributo.
  assert.ok(comAtributo.length > 0, `${comAtributo.length} de ${pecas.length} com atributo`);
  for (const p of pecas) if (p.raridade === 'comum') assert.equal(p.af, undefined, 'comum sem atributo');
  for (const p of comAtributo) {
    assert.ok(p.raridade, 'com raridade');
    for (const a of p.af) assert.ok(a.nivel >= 1 && a.nivel <= 5);
  }
});

test('equipável: a raridade é SÓ a do drop; sem ela (kit, loja) é comum; o resto segue o catálogo', async () => {
  const { raridadeDaPeca } = await import('../systems/itens/item.mjs');
  const equipavelRaro = Object.values(ITEM_CATALOG).find((i) => i.slot && !i.stackable && i.rarity && i.rarity !== 'comum');
  const naoEquipavel = Object.values(ITEM_CATALOG).find((i) => !i.slot && i.rarity && i.rarity !== 'comum');
  assert.ok(equipavelRaro && naoEquipavel);
  assert.equal(raridadeDaPeca({ id: equipavelRaro.id, count: 1 }), 'comum', `${equipavelRaro.name} (${equipavelRaro.rarity} no catálogo) sem drop`);
  assert.equal(raridadeDaPeca({ id: equipavelRaro.id, count: 1, raridade: 'lendário' }), 'lendário');
  assert.equal(raridadeDaPeca({ id: naoEquipavel.id, count: 1 }), naoEquipavel.rarity);
});
