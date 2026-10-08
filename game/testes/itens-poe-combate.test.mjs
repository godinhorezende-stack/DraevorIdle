// Incremento 3b do sistema de itens do PoE: os atributos NOVOS chegam ao combate de verdade (o mesmo `round` da caçada, a mesma
// `contaDoDano` das magias, o mesmo `matarMonstro`), vindos de uma peça com `poe.af` (o formato que o incremento 3c vai equipar).
// E a garantia de que, SEM peça do PoE, a ficha e o combate ficam exatamente como eram.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Treino from '../systems/treino.mjs';
import { ITEM_CATALOG, ACTION_CATALOG } from '../systems/dados.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { matarMonstro, round } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';
import { NOVOS } from '../systems/itens-poe/traduzir.mjs';

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);
const idDe = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome)?.id);

function comSemente(fn, s = 99) {
  const original = Math.random;
  Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}
function personagem(voc = 'knight') {
  const e = personagemDeTeste({ vocacao: voc, level: 300 });
  Treino.garantir(e);
  for (const k of Object.keys(e.skills)) if (k !== 'fishing') e.skills[k].value = 80;
  e.magic.value = 80;
  if (voc === 'knight') e.equipment.weapon = { id: idDe('fire sword'), count: 1 };
  e.equipment.ring = { id: ANEL, count: 1, af: [] };
  e.maxHp = e.hp = 1e9;
  e.maxMana = e.mana = 1e9;
  return e;
}
/** Veste no anel uma peça do PoE com estes atributos já traduzidos (`poe.af`). */
function vestirPoe(e, af) {
  e.equipment.ring = { id: ANEL, count: 1, af: [], poe: { af } };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return e;
}
function naCacada(e) {
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.outrosAndares = {};
  const m = criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null);
  m.hp = m.maxHp = 1e12;
  delete m.spawn;
  h.monstros.splice(0, h.monstros.length, m);
  h.alvo = m.uid;
  return m;
}
const danoDosGolpes = (e, n = 150) => {
  let d = 0;
  for (let i = 0; i < n; i++) for (const x of round(e, PERSONAGEM).eventos) if (x.t === 'dmg' && x.foe) d += x.v;
  return d;
};

// (B, docs/migracao-poe-matriz.md: era "sem peça do PoE nada muda" — da época da chave. No jogo oficial a ficha base já é a do PoE, com a
// resistência a Caos, como no PoE; o resto vale igual.)
test('sem peça do PoE: a ficha base tem a resistência a Caos (como no PoE), sem dano somado, e a magia usa a chance de crítico de sempre', () => {
  const e = personagem();
  const f = Ficha.combate(e);
  assert.equal('chaos' in f.protection, true);
  assert.equal('chaos' in f.danoDoElemento, false);
  assert.deepEqual([f.danoSomado, f.danoSomadoMagia], [{}, {}]);
  assert.deepEqual([f.vidaPorAbate, f.manaPorAbate, f.vidaPorAcerto, f.manaPorAcerto, f.danoDeMagiaDoPoe], [0, 0, 0, 0, 0]);
  assert.equal(f.critChanceMagia, f.critChance);
  // Uma peça do PoE vazia também não muda nada.
  const g = Ficha.combate(vestirPoe(personagem(), {}));
  assert.equal(g.critChance, f.critChance);
});

test('crítico relativo: "Chance de Crítico aumentada em 100%" dobra a chance (abaixo do teto); a de magia soma o próprio', () => {
  const base = Ficha.combate(personagem()).critChance;
  const f = Ficha.combate(vestirPoe(personagem(), { crit_chance_inc: 100, spell_crit_chance_inc: 50 }));
  assert.ok(Math.abs(f.critChance - Math.min(base * 2, 1)) < 1e-9, `${base} → ${f.critChance}`);
  assert.ok(Math.abs(f.critChanceMagia - Math.min(base * 2.5, 1)) < 1e-9);
});

test('dano elemental somado: o golpe da arma ganha o dano de Fogo e de Caos, cada um com a sua cor', () => {
  const sem = personagem();
  naCacada(sem);
  const d0 = comSemente(() => danoDosGolpes(sem));
  const com = vestirPoe(personagem(), { added_fire_dmg_min: 40, added_fire_dmg_max: 60, added_chaos_dmg_min: 10, added_chaos_dmg_max: 20 });
  naCacada(com);
  const d1 = comSemente(() => danoDosGolpes(com));
  assert.ok(d1 > d0 * 1.1, `sem ${d0}, com ${d1}`);
  const cores = new Set();
  for (let i = 0; i < 20; i++) for (const x of round(com, PERSONAGEM).eventos) if (x.t === 'dmg' && x.foe) cores.add(x.color);
  assert.ok(cores.has('#b44dff'), `o Caos aparece na cor dele (${[...cores]})`);
});

test('vida/mana por acerto e por abate', () => {
  const e = vestirPoe(personagem(), { life_on_hit: 25, mana_on_kill: 40 });
  const m = naCacada(e);
  e.hp = e.maxHp - 1000;
  const antes = e.hp;
  for (let i = 0; i < 10; i++) round(e, PERSONAGEM);
  assert.ok(e.hp > antes, `curou por acerto: ${antes} → ${e.hp}`);
  e.mana = e.maxMana - 1000;
  m.hp = 0;
  const ev = [];
  matarMonstro(e, e.hunt, PERSONAGEM, m, ev);
  assert.equal(e.mana, e.maxMana - 1000 + 40, 'ganhou a mana do abate');
});

test('magias: "Dano Mágico aumentado" e o dano somado a magias do MESMO elemento entram; de outro elemento não', () => {
  const flame = ACTION_CATALOG.spells.find((x) => x.id === 'spell-flame-strike');
  assert.equal(flame?.element, 'fire');
  const e0 = personagem('sorcerer');
  const antes = Acoes.danoMostrado(e0, flame, null);
  const e1 = vestirPoe(personagem('sorcerer'), { spell_dmg: 50 });
  const comDano = Acoes.danoMostrado(e1, flame, null);
  assert.ok(comDano.max > antes.max * 1.2, `${antes.max} → ${comDano.max}`);
  const e2 = vestirPoe(personagem('sorcerer'), { spell_added_fire_dmg_min: 100, spell_added_fire_dmg_max: 100 });
  assert.ok(Acoes.danoMostrado(e2, flame, null).min > antes.min + 90, 'fogo somado a magias entra na magia de fogo');
  const e3 = vestirPoe(personagem('sorcerer'), { spell_added_ice_dmg_min: 100, spell_added_ice_dmg_max: 100 });
  assert.deepEqual(Acoes.danoMostrado(e3, flame, null), antes, 'gelo somado não entra na magia de fogo');
});

test('a lista de atributos novos diz quais já têm efeito, e onde', () => {
  const ligados = Object.entries(NOVOS).filter(([, a]) => a.combate);
  assert.ok(ligados.length >= 25);
  for (const [id, a] of ligados) assert.ok(a.efeito, `${id}: falta dizer onde o efeito acontece`);
  for (const id of ['crit_chance_inc', 'spell_dmg', 'added_fire_dmg_min', 'life_on_hit', 'mana_on_kill', 'chaos_res']) assert.equal(NOVOS[id].combate, true, id);
});

test('habilidade de ataque (golpe físico, como o Brutal Strike): soma o dano a ataques de todos os elementos; as coisas de magia não entram', () => {
  const brutal = ACTION_CATALOG.spells.find((x) => x.id === 'spell-brutal-strike');
  assert.ok(brutal);
  const antes = Acoes.danoMostrado(personagem(), brutal, null);
  const com = Acoes.danoMostrado(vestirPoe(personagem(), { added_fire_dmg_min: 30, added_fire_dmg_max: 30, added_chaos_dmg_min: 20, added_chaos_dmg_max: 20 }), brutal, null);
  assert.ok(com.min > antes.min + 40, `${antes.min} → ${com.min}`);
  assert.deepEqual(Acoes.danoMostrado(vestirPoe(personagem(), { spell_dmg: 100, spell_added_physical_dmg_min: 50 }), brutal, null), antes, 'dano de magia não entra no ataque');
});
