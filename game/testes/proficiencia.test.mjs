// A Proficiência de arma contra o ORIGINAL: as 678 views e a vitrine do Zotod
// (api-mapeada/servidor/proficiency.json), e a view do Zoros de 2026-09-25
// (welcome), remontadas aqui têm de sair IGUAIS. E o XP e os perks no combate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Proficiencia from '../systems/proficiencia.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Prey from '../systems/prey.mjs';
import { personagemDeTeste, PERSONAGEM, comMarcaNova } from './apoio.mjs';

const ler = (p) => comMarcaNova(JSON.parse(readFileSync(new URL(`../../api-mapeada/${p}`, import.meta.url), 'utf8')));
const ZOTOD = ler('servidor/proficiency.json');
const ZOROS = ler('captura-charms-0925/welcome-zoros.json').character;

/** O Zotod da captura: steel axe na mão (436.960 de XP) e um hand axe na mochila. */
function zotod() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.equipment = { ...e.equipment, weapon: { id: 7773, count: 1 } };
  e.inventory = [{ id: 3268, count: 1 }];
  e.pouch = [];
  e.proficiencia = { 7773: { xp: 436960, perks: {} } };
  return e;
}

test('as 678 views do original, arma por arma', () => {
  const e = zotod();
  for (const [id, original] of Object.entries(ZOTOD.viewPorArma)) {
    assert.deepEqual(Proficiencia.vista(e, Number(id)), original, `arma ${id}`);
  }
});

test('a vitrine do Zotod: igual à do original, na mesma ordem', () => {
  assert.deepEqual(Proficiencia.lista(zotod()), ZOTOD.list);
});

test('o Zoros (sanguine blade, 89.765 de XP): a view do welcome', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 636 });
  e.equipment = { ...e.equipment, weapon: { id: 43864, count: 1 } };
  e.proficiencia = { 43864: { xp: 89765, perks: {} } };
  assert.deepEqual(Proficiencia.vistaDaMao(e), ZOROS.proficiency);
});

test('XP por morte: estrelas do bestiary e raridade do boss (Canary); para no teto da maestria', () => {
  assert.equal(Proficiencia.xpDaMorte('troll'), 30); // 1 estrela
  assert.equal(Proficiencia.xpDaMorte('crazed-winter-rearguard'), 165); // 4 estrelas
  assert.equal(Proficiencia.xpDaMorte('ahau'), 5000); // archfoe
  const e = zotod();
  Proficiencia.ganharXp(e, 'crazed-winter-rearguard');
  assert.equal(e.proficiencia[7773].xp, 436960 + 165);
  e.proficiencia[7773].xp = 1e12;
  Proficiencia.ganharXp(e, 'troll');
  // Steel axe: 3 níveis de perk + 2 de maestria = o 5º limiar da tabela knight.
  assert.equal(e.proficiencia[7773].xp, 1500000);
  assert.equal(Proficiencia.vista(e, 7773).percent, 100);
});

test('perk: só em nível liberado, e entra na ficha com a arma na mão', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 636 });
  e.equipment = { ...e.equipment, weapon: { id: 43864, count: 1 } };
  e.proficiencia = { 43864: { xp: 89765, perks: {} } };
  assert.match(Proficiencia.comando(e, { action: 'perk', itemId: 43864, level: 4, slot: 0 }).erro, /liberado/);
  const antes = Ficha.combate(e);
  assert.ok(Proficiencia.comando(e, { action: 'perk', itemId: 43864, level: 1, slot: 0 }).ok); // +1 sword
  assert.ok(Proficiencia.comando(e, { action: 'perk', itemId: 43864, level: 2, slot: 2 }).ok); // +3% life leech
  assert.equal(Proficiencia.vistaDaMao(e).levels[1].chosen, 2);
  // Ficha por tique (game/systems/ficha.mjs): escolher o perk não passa pela
  // sessão, então quem quer ver o efeito precisa invalidar à mão.
  Ficha.invalidar(e);
  const depois = Ficha.combate(e);
  assert.equal(depois.skillValue, antes.skillValue + 1);
  assert.ok(Math.abs(depois.lifeLeech - antes.lifeLeech - 0.03) < 1e-9);
  // Trocou de arma: os perks da sanguine não valem.
  e.equipment.weapon = { id: 7773, count: 1 };
  assert.equal(Proficiencia.bonus(e).lifeLeech, 0);
});

test('o comando: abrir traz a arma da mão e a vitrine; com itemId, só a ficha', () => {
  const e = zotod();
  const aberto = Proficiencia.comando(e, {});
  assert.equal(aberto.view.itemId, 7773);
  assert.equal(aberto.list.length, 678);
  const outra = Proficiencia.comando(e, { itemId: 860 });
  assert.equal(outra.view.name, 'Sword 1H Crimson Sword');
  assert.equal(outra.list, undefined);
  assert.match(Proficiencia.comando(e, { itemId: 3031 }).erro, /não tem proficiência/);
});

test('na caçada: cada morte dá XP à arma da mão', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 20 });
  Prey.garantir(e);
  e.equipment = { ...e.equipment, weapon: { id: 7773, count: 1 } };
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  e.maxHp = e.hp = 1e12;
  let t = Date.now();
  e.hunt.ultimoTique = t;
  for (let i = 0; i < 4 * 120; i++) {
    t += 250;
    e.hp = e.maxHp;
    Cacadas.tique(e, PERSONAGEM, t);
  }
  const mortes = Object.values(e.bestiary ?? {}).reduce((a, b) => a + b, 0);
  assert.ok(mortes > 0);
  assert.ok(e.proficiencia[7773].xp >= mortes, `${e.proficiencia[7773].xp} de XP em ${mortes} mortes`);
});
