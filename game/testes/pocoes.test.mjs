// As poções de vida e mana: as 12 do catálogo, pela barra (clique, tecla,
// toque e o automático usam o mesmo `Acoes.disparar`) e pela mochila
// (`Inventario.usar`, botão direito / toque longo). Ver `podeBeberPocao` em acoes.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Acoes from '../systems/acoes.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Inventario from '../systems/inventario.mjs';
import { ACTION_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';
import { doClassico } from './apoio-migracao.mjs';

const POCOES = ACTION_CATALOG.items.filter((e) => e.heal || e.mana);
const HP_1 = Acoes.PAPEL_DO_SLOT.indexOf('hp');
const MANA_1 = Acoes.PAPEL_DO_SLOT.indexOf('mana');

/** Um personagem que pode beber `p`, caçando, com a vida e a mana no chão e 10 de cada poção. */
function montar(p, { level = Math.max(p.level, 1) + 50 } = {}) {
  const vocacao = p.vocations?.[0] ?? 'knight';
  const e = personagemDeTeste({ vocacao, level });
  e.gold = 0; // sem ouro: a barra não compra no lugar da mochila
  e.inventory = POCOES.map((x) => ({ id: x.itemId, count: 10 }));
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok !== false);
  e.hunt.monstros = [];
  e.hunt.clock = 10_000;
  e.hp = 1;
  e.mana = 1;
  return e;
}
const quantos = (e, itemId) => (e.inventory ?? []).filter((x) => x.id === itemId).reduce((a, x) => a + x.count, 0);
const slotDe = (p) => (p.papeis.includes('hp') ? HP_1 : MANA_1);

test('o catálogo tem as 12 poções de vida/mana, cada uma num slot de vida ou de mana', () => {
  assert.equal(POCOES.length, 12);
  for (const p of POCOES) {
    assert.ok(p.papeis.every((x) => x === 'hp' || x === 'mana'), p.name);
    assert.equal(p.id, `item-${p.itemId}`);
  }
});

for (const p of POCOES) {
  test(`${p.name} (${p.itemId}) pela barra: gasta 1 dela e só dela, cura dentro da faixa, liga a recarga`, { skip: doClassico("Poções do Draevor pela barra; no PoE são os frascos (cinto, cargas)") }, () => {
    const e = montar(p);
    const slot = slotDe(p);
    assert.ok(Acoes.definir(e, { slot, value: { id: p.id } }).ok);
    assert.equal(e.actions[slot].id, p.id, 'o slot mostra a poção escolhida');
    const antes = Object.fromEntries(POCOES.map((x) => [x.itemId, quantos(e, x.itemId)]));
    const r = Cacadas.disparoManual(e, PERSONAGEM, slot);
    assert.equal(r.ok, true, r.erro);
    for (const x of POCOES) assert.equal(quantos(e, x.itemId), antes[x.itemId] - (x === p ? 1 : 0), x.name);
    if (p.heal) assert.ok(e.hp - 1 >= p.heal[0] && e.hp - 1 <= p.heal[1], `hp ${e.hp}`);
    else assert.equal(e.hp, 1);
    if (p.mana) assert.ok(e.mana - 1 >= p.mana[0] && e.mana - 1 <= p.mana[1], `mana ${e.mana}`);
    else assert.equal(e.mana, 1);
    assert.equal(e.hunt.cooldowns[p.id].total, Acoes.RECARGA_DA_POCAO_MS);
    assert.equal(e.hunt.cooldowns['grupo:item'].total, Acoes.RECARGA_DA_POCAO_MS);
    // De novo no mesmo instante: recusada, nada gasto.
    const hp = e.hp;
    const de = quantos(e, p.itemId);
    assert.equal(Cacadas.disparoManual(e, PERSONAGEM, slot).motivo, 'COOLDOWN');
    assert.equal(quantos(e, p.itemId), de);
    assert.equal(e.hp, hp);
    // Passada a recarga, sai de novo.
    e.hunt.clock += Acoes.RECARGA_DA_POCAO_MS;
    e.hp = 1;
    e.mana = 1;
    assert.equal(Cacadas.disparoManual(e, PERSONAGEM, slot).ok, true);
    assert.equal(quantos(e, p.itemId), de - 1);
  });

  test(`${p.name} pela mochila: mesmas regras da barra (recarga, não gasta cheio)`, () => {
    const e = montar(p);
    assert.equal(Inventario.usar(e, { id: p.itemId }).ok, true);
    assert.equal(quantos(e, p.itemId), 9);
    const r = Inventario.usar(e, { id: p.itemId });
    assert.equal(r.ok, false);
    assert.equal(r.motivo, 'COOLDOWN');
    assert.equal(quantos(e, p.itemId), 9);
    e.hunt.clock += Acoes.RECARGA_DA_POCAO_MS;
    e.hp = e.maxHp;
    e.mana = e.maxMana;
    const cheio = Inventario.usar(e, { id: p.itemId });
    assert.equal(cheio.motivo, 'NAO_PRECISA');
    assert.equal(quantos(e, p.itemId), 9);
  });
}

test('a recarga é de todas as poções: vida e mana não saem no mesmo instante', { skip: doClassico("Poções do Draevor pela barra; no PoE são os frascos (cinto, cargas)") }, () => {
  const vida = POCOES.find((p) => p.itemId === 266);
  const mana = POCOES.find((p) => p.itemId === 268);
  const e = montar(vida);
  Acoes.definir(e, { slot: HP_1, value: { id: vida.id } });
  Acoes.definir(e, { slot: MANA_1, value: { id: mana.id } });
  assert.equal(Cacadas.disparoManual(e, PERSONAGEM, HP_1).ok, true);
  assert.equal(Cacadas.disparoManual(e, PERSONAGEM, MANA_1).motivo, 'COOLDOWN_DO_GRUPO');
  // E a mochila respeita a recarga que a barra ligou.
  assert.equal(Inventario.usar(e, { id: mana.itemId }).motivo, 'COOLDOWN_DO_GRUPO');
  assert.equal(quantos(e, mana.itemId), 10);
});

test('a mochila respeita o level da poção (antes só olhava a vocação)', () => {
  const supreme = POCOES.find((p) => p.itemId === 23375);
  const e = montar(supreme, { level: 100 });
  const r = Inventario.usar(e, { id: supreme.itemId });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'BLOQUEADA');
  assert.equal(quantos(e, supreme.itemId), 10);
  assert.equal(e.hp, 1);
});

test('quantidade 1 some da mochila; quantidade 0 não cura nem cria item', { skip: doClassico("Poções do Draevor pela barra; no PoE são os frascos (cinto, cargas)") }, () => {
  const p = POCOES.find((x) => x.itemId === 266);
  const e = montar(p);
  e.inventory = [{ id: p.itemId, count: 1 }];
  Acoes.definir(e, { slot: HP_1, value: { id: p.id } });
  assert.equal(Cacadas.disparoManual(e, PERSONAGEM, HP_1).ok, true);
  assert.equal(quantos(e, p.itemId), 0);
  assert.equal(e.inventory.length, 0);
  e.hunt.clock += Acoes.RECARGA_DA_POCAO_MS;
  e.hp = 1;
  const r = Cacadas.disparoManual(e, PERSONAGEM, HP_1);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'SEM_SUPRIMENTO');
  assert.equal(e.hp, 1);
  assert.equal(e.inventory.length, 0);
  assert.equal(Inventario.usar(e, { id: p.itemId }).ok, false);
});

test('trocar a poção do slot troca a que é gasta', { skip: doClassico("Poções do Draevor pela barra; no PoE são os frascos (cinto, cargas)") }, () => {
  const pequena = POCOES.find((x) => x.itemId === 7876);
  const grande = POCOES.find((x) => x.itemId === 239);
  const e = montar(grande);
  Acoes.definir(e, { slot: HP_1, value: { id: pequena.id } });
  Acoes.definir(e, { slot: HP_1, value: { id: grande.id } });
  assert.equal(Cacadas.disparoManual(e, PERSONAGEM, HP_1).ok, true);
  assert.equal(quantos(e, grande.itemId), 9);
  assert.equal(quantos(e, pequena.itemId), 10);
  // Poção de vida não entra no slot de mana (e vice-versa).
  assert.equal(Acoes.definir(e, { slot: MANA_1, value: { id: grande.id } }).ok, false);
});
