// O PODER DA ARMA (decisão do dono, 02/10): o dano base das gemas de ataque cresce pela arma equipada (poder × afinidade), e não mais
// pelo level do personagem. Uma arma NO NÍVEL devolve o dano de antes; o piso legado segura quem ainda usa a arma inicial.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Poder from '../systems/armas/poder.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Gemas from '../systems/skills/gemas.mjs';
import * as Inventario from '../systems/inventario.mjs';
import { ITEM_CATALOG, ACTION_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, comSkills } from './apoio.mjs';

// Armas de teste NO nível que se quer (fora da tabela de níveis de poder: valem pelo `minLevel`), uma de cada família.
const ARMA = { espada: 990001, arco: 990002, wand: 990003, rod: 990004 };
const arma = (id, name, meta) => (ITEM_CATALOG[id] = { id, name, weight: 1, slot: 'weapon', hasSprite: true, rarity: 'comum', ...meta });
arma(ARMA.espada, 'espada de teste', { type: 'sword weapons', skill: 'sword', attack: 30 });
arma(ARMA.arco, 'arco de teste', { type: 'distance weapons', skill: 'distance', attack: 30, range: 6, twoHanded: true });
arma(ARMA.wand, 'wand de teste', { type: 'wands', skill: 'magic', wand: { min: 10, max: 20, element: 'energy', mana: 1 }, range: 4 });
arma(ARMA.rod, 'rod de teste', { type: 'rods', skill: 'magic', wand: { min: 10, max: 20, element: 'ice', mana: 1 }, range: 4 });

function personagem({ level = 343, id = ARMA.wand, nivelDaArma = level, gemas = ['spell-buzz'], raridade } = {}) {
  ITEM_CATALOG[id].minLevel = nivelDaArma;
  const e = personagemDeTeste({ vocacao: 'sorcerer', level });
  e.magic = { value: 100 };
  e.equipment.weapon = { id, count: 1, ...(raridade ? { raridade } : {}) };
  comSkills(e, gemas);
  return e;
}
const danoDe = (e, id) => Acoes.catalogo(e).spells.concat(Acoes.catalogo(e).runes).find((a) => a.id === id).danoBase;
const emPisoZero = (fn) => {
  const antes = Poder.CONFIG.pisoLegado.fracao;
  Poder.CONFIG.pisoLegado.fracao = 0;
  try { return fn(); } finally { Poder.CONFIG.pisoLegado.fracao = antes; }
};

test('a curva de poder: bate com os exemplos do dono e a inversa devolve o nível', () => {
  for (const [nivel, esperado] of [[10, 11], [30, 25], [60, 45], [100, 73], [2500, 1729]]) assert.equal(Math.round(Poder.poderDoNivel(nivel)), esperado);
  for (const n of [1, 50, 343, 2500]) assert.ok(Math.abs(Poder.nivelDoPoder(Poder.poderDoNivel(n)) - n) < 1e-9);
});

test('a família da arma: wand/rod = magic, arco/besta/arremesso = distance, o resto (punho incluso) = melee', () => {
  assert.equal(Poder.familiaDaArma(ITEM_CATALOG[3066]), 'magic'); // snakebite rod
  assert.equal(Poder.familiaDaArma(ITEM_CATALOG[3074]), 'magic'); // wand of vortex
  assert.equal(Poder.familiaDaArma(ITEM_CATALOG[3276]), 'melee'); // hatchet
  assert.equal(Poder.familiaDaArma(ITEM_CATALOG[ARMA.arco]), 'distance');
  assert.equal(Poder.familiaDaArma(ITEM_CATALOG[50171]), 'melee'); // punho do monk
});

test('o catálogo traz o poder de toda arma e o Magic Attack da wand/rod (o mesmo número)', () => {
  assert.equal(ITEM_CATALOG[3066].magicAttack, ITEM_CATALOG[3066].poderDaArma);
  assert.ok(ITEM_CATALOG[3066].poderDaArma > 0);
  assert.equal(ITEM_CATALOG[3276].magicAttack, undefined);
  assert.ok(ITEM_CATALOG[3276].poderDaArma > 0);
});

test('uma arma NO NÍVEL devolve o dano de antes (nível equivalente = level do personagem), em várias gemas', () => {
  const ids = ['spell-buzz', 'spell-fire-wave', 'spell-ultimate-flame-strike'];
  for (const level of [90, 343, 1000]) {
    const e = personagem({ level, gemas: ids });
    const p = Poder.poderEfetivo(e, 'magic', 'energy');
    // wand sem identidade de elemento afim aqui (energia é afim da wand: +10%) — compara com o level equivalente de verdade.
    assert.ok(Math.abs(Poder.nivelDoPoder(Poder.poderDoNivel(level) * (1 + Poder.CONFIG.identidade.bonusDeElementoAfimPct / 100)) - p.nivelEquivalente) < 1e-6);
  }
  // Sem a identidade (gelo não é afim da wand): o nível equivalente é exatamente o level.
  const e = personagem({ level: 343, id: ARMA.wand });
  assert.ok(Math.abs(Poder.poderEfetivo(e, 'magic', 'ice').nivelEquivalente - 343) < 1e-6);
});

test('o level do personagem NÃO soma mais ao dano base: com a mesma arma e sem piso, o nível equivalente é o mesmo em qualquer level', () => {
  emPisoZero(() => {
    const a = Poder.poderEfetivo(personagem({ level: 120, nivelDaArma: 100 }), 'magic', 'ice');
    const b = Poder.poderEfetivo(personagem({ level: 900, nivelDaArma: 100 }), 'magic', 'ice');
    assert.equal(a.nivelEquivalente, b.nivelEquivalente);
    assert.ok(Math.abs(a.nivelEquivalente - 100) < 1e-6);
  });
});

test('uma arma mais forte dá mais dano; a de nível mais baixo, menos (mesmo personagem, só a arma muda)', () => {
  emPisoZero(() => {
    const e = personagem({ level: 343, nivelDaArma: 100 });
    const fraca = danoDe(e, 'spell-buzz');
    ITEM_CATALOG[ARMA.wand].minLevel = 343;
    const forte = danoDe(e, 'spell-buzz');
    assert.ok(forte.max > fraca.max * 2, `${forte.max} vs ${fraca.max}`);
  });
});

test('a afinidade: a arma errada rende a fração configurada (0,25) e sem arma, a de "sem arma" (0,15)', () => {
  const magica = personagem({ level: 343, id: ARMA.wand });
  assert.equal(Poder.poderEfetivo(magica, 'melee').afinidade, 0.25);
  assert.equal(Poder.poderEfetivo(magica, 'magic').afinidade, 1);
  assert.equal(Poder.poderEfetivo(magica, 'melee').compativel, false);
  const espada = personagem({ level: 343, id: ARMA.espada });
  assert.equal(Poder.poderEfetivo(espada, 'melee').afinidade, 1);
  assert.equal(Poder.poderEfetivo(espada, 'magic').afinidade, 0.25);
  const arco = personagem({ level: 343, id: ARMA.arco });
  assert.equal(Poder.poderEfetivo(arco, 'distance').afinidade, 1);
  const nua = personagem({ level: 343 });
  nua.equipment.weapon = null;
  const p = Poder.poderEfetivo(nua, 'magic');
  assert.equal(p.semArma, true);
  assert.equal(p.afinidade, 0.15);
});

test('a arma incompatível dá bem menos dano que a certa (Buzz com wand × com espada, no mesmo nível)', () => {
  emPisoZero(() => {
    const certa = danoDe(personagem({ level: 343, id: ARMA.wand }), 'spell-buzz');
    const errada = danoDe(personagem({ level: 343, id: ARMA.espada }), 'spell-buzz');
    assert.ok(errada.max < certa.max * 0.5, `${errada.max} vs ${certa.max}`);
  });
});

test('wand e rod: o rod dá +8% de poder; o elemento afim dá +10% só nas magias; a wand conjura mais rápido', () => {
  const wand = personagem({ level: 343, id: ARMA.wand });
  const rod = personagem({ level: 343, id: ARMA.rod });
  const base = Poder.poderDoNivel(343);
  assert.ok(Math.abs(Poder.poderEfetivo(rod, 'magic', 'death').poder - base * 1.08) < 1e-6, 'rod, elemento não afim (morte)');
  assert.ok(Math.abs(Poder.poderEfetivo(rod, 'magic', 'ice').poder - base * 1.08 * 1.1) < 1e-6, 'rod, gelo é afim');
  assert.ok(Math.abs(Poder.poderEfetivo(wand, 'magic', 'fire').poder - base * 1.1) < 1e-6, 'wand, fogo é afim');
  assert.ok(Math.abs(Poder.poderEfetivo(wand, 'melee', 'fire').poder - base * 0.25) < 1e-6, 'nada de identidade fora da família mágica');
  assert.equal(Ficha.combate(wand).castSpeed - Ficha.combate(rod).castSpeed, Poder.CONFIG.identidade.wand.castSpeedPct);
});

test('a raridade da peça multiplica o poder (mítico 1,25) e o Magic Attack é fixo, sem sorteio', () => {
  const comum = personagem({ level: 343 });
  const mitica = personagem({ level: 343, raridade: 'mítico' });
  const pc = Poder.poderDaPeca(comum.equipment.weapon);
  assert.ok(Math.abs(Poder.poderDaPeca(mitica.equipment.weapon) / pc - 1.25) < 1e-9);
  assert.equal(Poder.poderDaPeca(comum.equipment.weapon), Poder.poderDaPeca(comum.equipment.weapon));
});

test('o piso legado: a arma inicial num level alto não perde tudo (segura a fração configurada do poder esperado)', () => {
  const e = personagem({ level: 343, id: 3074, nivelDaArma: undefined });
  ITEM_CATALOG[3074].minLevel = 6;
  const p = Poder.poderEfetivo(e, 'magic', 'death');
  assert.equal(p.noPiso, true);
  assert.ok(Math.abs(p.piso - Poder.CONFIG.pisoLegado.fracao * Poder.poderDoNivel(343)) < 1e-9);
  assert.ok(p.nivelEquivalente > 200 && p.nivelEquivalente < 343);
});

test('catálogo: a gema de ataque diz a origem do dano (família da arma, afinidade, piso) e o dano mostrado segue a arma', () => {
  const e = personagem({ level: 343, id: ARMA.espada });
  const buzz = Acoes.catalogo(e).spells.find((a) => a.id === 'spell-buzz');
  assert.equal(buzz.armaDoDano.familia, 'melee');
  assert.equal(buzz.armaDoDano.compativel, false);
  assert.equal(buzz.escalaCom, 'magic');
  assert.ok(Acoes.catalogo(e).poderDasArmas.raridade['mítico'] === 1.25);
});

test('as exceções de escala: as gemas sagradas do paladino escalam com Distance e as duas do monk com Melee', () => {
  const escala = (id) => Gemas.habilidadeDeEscala(Gemas.defDaGema(Gemas.ITEM_DA_ACAO.get(id)));
  for (const id of ['spell-divine-missile', 'spell-divine-caldera', 'spell-divine-barrage', 'spell-holy-flash', 'spell-divine-grenade', 'rune-holy-missile-rune']) assert.equal(escala(id), 'distance', id);
  assert.equal(escala('spell-mystic-repulse'), 'melee');
  assert.equal(escala('spell-thousand-fist-blows'), 'melee');
  assert.equal(escala('spell-buzz'), 'magic');
  assert.ok(ACTION_CATALOG.spells.some((a) => a.id === 'spell-buzz'));
});

test('peça vestida com level acima do dele volta para a mochila, sem perda', () => {
  const e = personagem({ level: 50, id: ARMA.espada, nivelDaArma: 200 });
  const antes = (e.inventory ?? []).length;
  const saiu = Inventario.devolverPecasAcimaDoLevel(e);
  assert.deepEqual(saiu, ['espada de teste']);
  assert.equal(e.equipment.weapon, null);
  assert.ok((e.inventory ?? []).length >= antes + 1);
  assert.deepEqual(Inventario.devolverPecasAcimaDoLevel(e), []);
});
