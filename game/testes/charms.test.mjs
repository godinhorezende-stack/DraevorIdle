// Os Charms contra o ORIGINAL: o Zoros capturado (2026-09-25,
// api-mapeada/captura-charms-0925/) remontado aqui tem de receber a MESMA view
// e os mesmos charmPoints/charmNext do welcome. E o disparo, como o visto ao vivo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Charms from '../systems/charms.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Prey from '../systems/prey.mjs';
import { CATALOGO } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const CAP = new URL('../../api-mapeada/captura-charms-0925/', import.meta.url);
const ler = (n) => JSON.parse(readFileSync(new URL(n, CAP), 'utf8'));
const WELCOME = ler('welcome-zoros.json').character;

/** O Zoros de 2026-09-25: bestiary do welcome, Wound tier 1 no Crazed Winter Rearguard. */
function zoros() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 588 });
  e.bestiary = { ...WELCOME.bestiary };
  e.charms = { tiers: { 1: 1 }, alvos: { 1: 'crazed-winter-rearguard' }, gastos: 240 };
  return e;
}

/** Faz `Math.random` devolver `v` durante `f`. */
function comSorte(v, f) {
  const original = Math.random;
  Math.random = () => v;
  try {
    return f();
  } finally {
    Math.random = original;
  }
}

test('a view do Zoros é IGUAL à do original, campo a campo', () => {
  assert.deepEqual(Charms.vista(zoros()), ler('charms-zoros.json').view);
});

test('charmPoints e charmNext iguais aos do welcome (495 ganhos − 240 gastos)', () => {
  const e = zoros();
  assert.equal(Charms.pontosGanhos(e), 495);
  const c = Charms.paraCliente(e);
  assert.equal(c.charmPoints, WELCOME.charmPoints);
  assert.equal(c.charmNext, WELCOME.charmNext);
});

test('upgrade: cobra o preço do tier e sobe a chance pela tabela', () => {
  const e = zoros();
  assert.match(Charms.comando(e, { t: 'charms', action: 'upgrade', id: 2 }).erro, /Faltam 145/); // Enflame 400, tem 255
  assert.ok(Charms.comando(e, { action: 'upgrade', id: 7 }).ok); // Cripple 100
  const cripple = Charms.vista(e).list.find((c) => c.id === 7);
  assert.deepEqual([cripple.tier, cripple.chance, cripple.cost], [1, 6, 150]);
  assert.equal(Charms.vista(e).points, 155);
  assert.ok(Charms.comando(e, { action: 'upgrade', id: 7 }).ok);
  assert.equal(Charms.vista(e).list.find((c) => c.id === 7).chance, 9);
  e.bestiary['elder-wyrm'] = 1; // descompleta: sem pontos para o tier 3
  assert.match(Charms.comando(e, { action: 'upgrade', id: 7 }).erro, /Faltam/);
});

test('no máximo: cost null e charmNext ignora ele', () => {
  const e = personagemDeTeste({ level: 100 });
  e.charms = { tiers: Object.fromEntries(Charms.CHARMS.map((c) => [c.id, 3])), alvos: {}, gastos: 0 };
  assert.equal(Charms.proximoPreco(e), null);
  assert.ok(Charms.vista(e).list.every((c) => c.cost == null));
  assert.match(Charms.comando(e, { action: 'upgrade', id: 1 }).erro, /máximo/);
});

test('assign: charm liberado (ofensivo OU defensivo), só criatura já morta; null tira', () => {
  const e = zoros();
  assert.match(Charms.comando(e, { action: 'assign', id: 2, monster: 'troll' }).erro, /Libere/);
  const nuncaMatou = Object.keys(CATALOGO.bestiary).find((k) => !e.bestiary[k]);
  assert.match(Charms.comando(e, { action: 'assign', id: 1, monster: nuncaMatou }).erro, /ainda não matou/);
  assert.ok(Charms.comando(e, { action: 'assign', id: 1, monster: 'troll' }).ok);
  assert.equal(Charms.vista(e).list[0].assigned, 'troll');
  assert.ok(Charms.comando(e, { action: 'assign', id: 1, monster: null }).ok);
  assert.equal(Charms.vista(e).list[0].assigned, null);
  // Defensivo também escolhe a criatura.
  e.charms.tiers[9] = 1;
  assert.ok(Charms.comando(e, { action: 'assign', id: 9, monster: 'troll' }).ok);
  assert.equal(Charms.vista(e).list.find((c) => c.id === 9).assigned, 'troll');
});

test('bestiary: conta a morte e paga os pontos UMA vez, quando fecha', () => {
  const e = personagemDeTeste({ level: 50 });
  const troll = CATALOGO.bestiary.troll;
  e.bestiary = { troll: troll.toKill - 1 };
  const eventos = [];
  Charms.contarMorte(e, 'troll', eventos);
  assert.deepEqual(eventos, [{ t: 'bestiaryDone', name: troll.name, points: troll.charmPoints }]);
  Charms.contarMorte(e, 'troll', eventos);
  assert.equal(eventos.length, 1);
  assert.equal(Charms.pontos(e), troll.charmPoints);
});

test('Wound no Rearguard: 260 cravado (5% de 5.200), no formato do original', () => {
  const e = zoros();
  const bicho = { uid: 7, key: 'crazed-winter-rearguard', name: 'Crazed Winter Rearguard', x: 1, y: 1, hp: 5200, maxHp: 5200 };
  const eventos = [];
  comSorte(0.01, () => Charms.aoAcertar(e, { monstros: [bicho] }, bicho, eventos));
  assert.deepEqual(eventos.find((x) => x.t === 'dmg'), { t: 'dmg', uid: 7, x: 1, y: 1, v: 260, foe: true, charm: 'Wound', alvo: 'Crazed Winter Rearguard', color: '#ff0000' });
  assert.equal(bicho.hp, 4940);
  // Com a chance acima dos 5%, nada; e em outra criatura, nada.
  const outro = { ...bicho, key: 'thanatursus', hp: 5200 };
  comSorte(0.01, () => Charms.aoAcertar(e, { monstros: [outro] }, outro, eventos));
  comSorte(0.06, () => Charms.aoAcertar(e, { monstros: [bicho] }, bicho, eventos));
  assert.equal(eventos.filter((x) => x.charm).length, 1);
});

test('dano elemental tem teto de 2x o level (Canary)', () => {
  const e = personagemDeTeste({ level: 10 });
  e.bestiary = { troll: 1 };
  e.charms = { tiers: { 1: 1 }, alvos: { 1: 'troll' }, gastos: 0 };
  const bicho = { uid: 1, key: 'troll', name: 'Troll', x: 0, y: 0, hp: 100000, maxHp: 100000 };
  const eventos = [];
  comSorte(0, () => Charms.aoAcertar(e, { monstros: [bicho] }, bicho, eventos));
  assert.equal(eventos.find((x) => x.t === 'dmg').v, 20);
});

test('na caçada: as mortes enchem o bestiary e o Dodge (no Troll) apara o golpe', () => {
  const e = personagemDeTeste({ level: 20 });
  Prey.garantir(e);
  e.charms = { tiers: { 9: 3 }, alvos: { 9: 'troll' }, gastos: 0 };
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  e.maxHp = e.hp = 1e12;
  let t = Date.now();
  e.hunt.ultimoTique = t;
  let dodges = 0;
  // 5 minutos: o Dodge (11%) depende da sorte nos golpes dos trolls — em 2 minutos
  // ele já faltou uma vez em ~20 rodadas.
  const matou = () => Object.values(e.bestiary ?? {}).some((n) => n > 0);
  for (let i = 0; i < 4 * 300 && !(dodges && matou()); i++) {
    t += 250;
    e.hp = e.maxHp;
    for (const ev of Cacadas.tique(e, PERSONAGEM, t) ?? []) if (ev.charm === 'Dodge') dodges++;
  }
  assert.ok(Object.values(e.bestiary).reduce((a, b) => a + b, 0) > 0, 'matou e contou');
  assert.ok(dodges > 0, 'Dodge tier 3 (11%) apareceu');
});

test('defensivo só vale contra a criatura escolhida', () => {
  const e = personagemDeTeste({ level: 20 });
  e.charms = { tiers: { 9: 3 }, alvos: { 9: 'troll' }, gastos: 0 };
  const hunt = { pos: { x: 0, y: 0 }, monstros: [] };
  comSorte(0, () => {
    assert.equal(Charms.desviou(e, hunt, PERSONAGEM, { key: 'troll' }, []), true);
    assert.equal(Charms.desviou(e, hunt, PERSONAGEM, { key: 'rotworm' }, []), false);
  });
});
