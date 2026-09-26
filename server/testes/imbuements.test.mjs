// Imbuements contra o ORIGINAL: os encaixes e os imbuements ativos do Zoros
// (welcomes de 2026-09-24 e 2026-09-25) remontados aqui saem IGUAIS; e o
// relógio, que só anda caçando.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Imbuements from '../../game/systems/imbuements.mjs';
import * as Ficha from '../../game/systems/ficha.mjs';
import * as Afixos from '../../game/systems/afixos.mjs';
import { elementalDoImbuement } from '../../game/systems/hunt/combate.mjs';
import { personagemDeTeste } from './apoio.mjs';

const ler = (p) => JSON.parse(readFileSync(new URL(`../../api-mapeada/${p}`, import.meta.url), 'utf8')).character;

function comEquipamento(w) {
  const e = personagemDeTeste({ vocacao: 'knight', level: w.level });
  e.equipment = structuredClone(w.equipment);
  return e;
}

test('os encaixes de cada slot: iguais aos do Zoros (sanguine blade, soulbastion, soulwalkers)', () => {
  const w = ler('captura-charms-0925/welcome-zoros.json');
  const e = comEquipamento(w);
  const { imbuementSlots, imbuementTipos } = Imbuements.encaixes(e);
  assert.deepEqual(imbuementSlots, w.imbuementSlots);
  assert.deepEqual(imbuementTipos, w.imbuementTipos);
});

test('os ativos: Strike e Vampirism na soulcutter, no formato do original', () => {
  for (const f of ['captura-bosses-0924/welcome-zoros-0924.json', 'captura-gemas-0925/welcome-zoros-gemas.json']) {
    const w = ler(f);
    const e = comEquipamento(w);
    e.hunt = {}; // caçando (offline), como estava: paused false
    assert.deepEqual(Imbuements.paraCliente(e).imbuements, w.imbuements, f);
  }
});

test('o relógio só anda caçando e o que zera sai da peça', () => {
  const e = comEquipamento(ler('captura-bosses-0924/welcome-zoros-0924.json'));
  Imbuements.consumir(e, 50340_000); // o que o Zoros perdeu entre as capturas
  assert.deepEqual(e.equipment.weapon.imbu, [{ id: 'strike-1', left: 204600000 }, { id: 'vampirism-1', left: 204660000 }]);
  Imbuements.consumir(e, 204600000);
  assert.deepEqual(e.equipment.weapon.imbu, [{ id: 'vampirism-1', left: 60000 }]);
  Imbuements.consumir(e, 60000);
  assert.equal(e.equipment.weapon.imbu, undefined);
});

test('aplicar: cobra ouro e reagentes, respeita os tipos e os encaixes da peça', () => {
  const e = comEquipamento(ler('captura-charms-0925/welcome-zoros.json'));
  const strike = Imbuements.CATALOGO_DE_IMBUEMENTS.find((m) => m.id === 'strike-1');
  e.gold = 0;
  e.inventory = [];
  e.pouch = [];
  assert.match(Imbuements.comando(e, { slot: 'weapon', id: 'strike-1' }).erro, /gold/);
  e.gold = 5e6;
  assert.match(Imbuements.comando(e, { slot: 'weapon', id: 'strike-1' }).erro, /Faltam 1x/);
  e.inventory = strike.items.map((r) => ({ id: r.id, count: r.count }));
  assert.ok(Imbuements.comando(e, { slot: 'weapon', id: 'strike-1' }).ok);
  assert.equal(e.gold, 5e6 - strike.price);
  assert.equal(e.inventory.length, 0, 'os reagentes saíram');
  assert.deepEqual(e.equipment.weapon.imbu, [{ id: 'strike-1', left: strike.durationMs }]);
  // O mesmo tipo de novo, não; e o capacete do Zoros não tem encaixe.
  e.inventory = strike.items.map((r) => ({ id: r.id, count: r.count }));
  assert.match(Imbuements.comando(e, { slot: 'weapon', id: 'strike-2' }).erro, /desse tipo/);
  assert.match(Imbuements.comando(e, { slot: 'head', id: 'strike-1' }).erro, /não aceita/);
  // Tirar cobra o removeCost.
  const ouro = e.gold;
  assert.ok(Imbuements.comando(e, { slot: 'weapon', action: 'remove', id: 'strike-1' }).ok);
  assert.equal(e.gold, ouro - strike.removeCost);
  assert.equal(e.equipment.weapon.imbu, undefined);
});

test('os efeitos entram na ficha: crítico, leech, proteção, perícia e capacidade', () => {
  const e = comEquipamento(ler('captura-bosses-0924/welcome-zoros-0924.json'));
  const semNada = comEquipamento(ler('captura-bosses-0924/welcome-zoros-0924.json'));
  delete semNada.equipment.weapon.imbu;
  const a = Ficha.combate(semNada);
  const b = Ficha.combate(e);
  assert.ok(Math.abs(b.critChance - a.critChance - 0.05) < 1e-9, 'Strike basic: +5% de chance');
  assert.ok(Math.abs(b.critMultiplier - a.critMultiplier - 0.05) < 1e-9, 'Strike basic: +5% de dano crítico');
  assert.ok(b.lifeLeech > a.lifeLeech, 'Vampirism: life leech');
  // Proteção e capacidade numa peça que aceita.
  const cap = Afixos.capacidade(semNada);
  e.equipment.body = { id: e.equipment.body.id, count: 1, imbu: [{ id: 'featherweight-3', left: 1000 }, { id: 'lich-shroud-3', left: 1000 }] };
  assert.equal(Afixos.capacidade(e), cap * 1.15);
  // A ficha guardada é da peça de ANTES (ver "Uma ficha por tique" em
  // game/systems/ficha.mjs) — quem troca o equipamento no meio do teste precisa
  // avisar, do jeito que a sessão avisa a cada tique/comando.
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).protection.death - Ficha.combate(semNada).protection.death, 10);
});

test('dano elemental: a parte convertida passa pela resistência do bicho', () => {
  const alvo = { key: 'crazed-winter-rearguard', hp: 1000 };
  const r = elementalDoImbuement({ isBoss: false }, alvo, 'fire', 100);
  assert.equal(r.v, 120); // fogo -20 no Rearguard: leva 20% a mais
  assert.equal(alvo.hp, 880);
  assert.equal(r.cor, '#ff9900');
});
