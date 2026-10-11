// O JOGO OFICIAL SEM PREY E SEM CHARMS (dono, 11/10: "tire o sistema de prey e charms, desktop e mobile"): nenhum bônus nem efeito vale,
// os painéis não aceitam comando, nada vai para a tela e a Store não vende o 3º slot nem os Wildcards. O que o personagem tinha fica
// guardado (sem efeito). No clássico (a transição) os dois seguem: `prey.classico` e `charms.classico`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Prey from '../systems/prey.mjs';
import * as Charms from '../systems/charms.mjs';
import * as Loja from '../systems/loja.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';
import { soNoOficial } from './apoio-migracao.mjs';

const SKIP = { skip: soNoOficial('o Prey e os Charms só saíram do jogo oficial') };

/** Um personagem que JÁ tinha Prey e Charms montados (de antes): dano, defesa, exp e loot contra Troll; Dodge e Low Blow no Troll. */
function comTudoMontado() {
  const e = personagemDeTeste({ level: 50 });
  Prey.garantir(e);
  e.prey[0] = { ...e.prey[0], key: 'troll', state: 'active', bonus: 'damage', percent: 25, left: 3_600_000, total: 7_200_000 };
  e.prey[1] = { ...e.prey[1], key: 'troll', state: 'active', bonus: 'exp', percent: 40, left: 3_600_000, total: 7_200_000 };
  e.charms = { tiers: { 9: 3, 1: 3 }, alvos: { 9: 'troll', 1: 'troll' }, gastos: 0 };
  e.bestiary = { troll: 999 };
  return e;
}

/** Faz `Math.random` devolver `v` durante `f` (todo charm dispararia). */
function comSorte(v, f) {
  const original = Math.random;
  Math.random = () => v;
  try {
    return f();
  } finally {
    Math.random = original;
  }
}

test('Prey: nenhum fator vale (dano, defesa, exp, loot), o relógio não corre e o painel recusa', SKIP, () => {
  const e = comTudoMontado();
  for (const fator of ['fatorDeDano', 'fatorDeExp', 'fatorDeLoot', 'fatorDeDefesa']) assert.equal(Prey[fator](e, 'troll'), 1, fator);
  const antes = e.prey[0].left;
  Prey.consumir(e, 60_000);
  assert.equal(e.prey[0].left, antes, 'o relógio parado');
  assert.match(Prey.comando(e, { action: 'choose', slot: 0, key: 'rat' }).erro, /não existe/);
  // Nada vai para a tela (a ficha e o HUD mostrariam um bônus que não vale), e o que ele tinha fica guardado.
  assert.deepEqual(Prey.paraCliente(e), { prey: [], preyRerollCost: 0 });
  assert.equal(e.prey[0].key, 'troll');
});

test('Charms: nenhum dispara (Dodge, crítico, dano elemental), o painel recusa e a morte não anuncia pontos', SKIP, () => {
  const e = comTudoMontado();
  const hunt = { pos: { x: 0, y: 0 }, monstros: [], clock: 0 };
  comSorte(0, () => {
    assert.equal(Charms.desviou(e, hunt, PERSONAGEM, { key: 'troll' }, []), false, 'Dodge');
    assert.deepEqual(Charms.criticoExtra(e, 'troll'), { chance: 0, dano: 0 });
    const bicho = { key: 'troll', uid: 1, x: 1, y: 1, hp: 1000, maxHp: 1000, name: 'Troll' };
    const eventos = [];
    Charms.aoAcertar(e, hunt, bicho, eventos);
    assert.equal(bicho.hp, 1000, 'o Wound não bate');
    assert.deepEqual(eventos, []);
  });
  assert.match(Charms.comando(e, { action: 'upgrade', id: 1 }).erro, /não existem/);
  assert.deepEqual(Charms.paraCliente(e), { bestiary: e.bestiary, charmPoints: 0, charmNext: null });
  const eventos = [];
  const novo = personagemDeTeste({ level: 50 });
  for (let k = 0; k < 2000; k++) Charms.contarMorte(novo, 'troll', eventos);
  assert.ok(!eventos.some((ev) => ev.t === 'bestiaryDone'), 'sem "+N pontos de charm"');
});

test('Store: o 3º slot de Prey e os Wildcards não estão à venda', SKIP, () => {
  const e = personagemDeTeste({});
  const loja = Loja.catalogoDaLoja(e);
  const ids = Object.values(loja).filter(Array.isArray).flat().map((x) => x?.id);
  assert.ok(ids.includes('xp-boost'), 'a loja continua com o resto');
  for (const id of ['prey-slot', 'wildcards-5', 'wildcards-25']) assert.ok(!ids.includes(id), id);
  e.coins = 10_000;
  assert.equal(Loja.comprar(e, { id: 'prey-slot' }).ok, false);
  assert.notEqual(e.preyThirdSlot, true);
});
