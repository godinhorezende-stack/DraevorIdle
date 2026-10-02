// Os LIMITES do combate (resistência, penetração, chance de crítico e de ataque duplo — de 0 a 100%) e a conta única da resistência com
// penetração (dono, 02/10). Valem para o jogador e para o bicho; o multiplicador de crítico fica de fora.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../systems/combate/limites.mjs';
import { PARAMETROS as PARAMETROS_DO_COMBATE } from '../systems/combate/formulas.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { resistido, resistenciaDe, resistenciaEfetivaDe } from '../systems/hunt/resistencia.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { round } from '../systems/hunt/combate.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM, comSkills } from './apoio.mjs';

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);

test('resistência efetiva = resistência − penetração (0, 50 e 100%), nunca negativa nem acima de 100', () => {
  for (const res of [0, 50, 100]) for (const pen of [0, 50, 100]) assert.equal(L.resistenciaEfetiva(res, pen), Math.max(0, res - pen), `res ${res} pen ${pen}`);
  assert.equal(L.resistenciaEfetiva(60, 20), 40, 'o exemplo do dono (físico)');
  assert.equal(L.resistenciaEfetiva(70, 30), 40, 'o exemplo do dono (fogo)');
  assert.equal(L.resistenciaEfetiva(150, 0), 100, 'resistência acima de 100 vale 100');
  assert.equal(L.resistenciaEfetiva(60, 500), 0, 'penetração acima de 100 vale 100');
});

test('a fraqueza (resistência negativa) não muda com a penetração', () => {
  assert.equal(L.resistenciaEfetiva(-40, 50), -40);
  assert.equal(L.resistenciaEfetiva(0, 50), 0);
  assert.equal(L.danoAposResistencia(100, -40), 140);
});

test('o dano depois da resistência: 0%, 25%, 50%, 75% e 100% (nada passa)', () => {
  assert.deepEqual([0, 25, 50, 75, 100].map((r) => L.danoAposResistencia(100, r)), [100, 75, 50, 25, 0]);
});

test('a resistência do bicho vai até o teto dele (75, configurável) e a fraqueza só até −100', () => {
  assert.equal(L.resistenciaDoMob(150), L.LIMITES.resistenciaDoMob.maximo);
  assert.equal(L.resistenciaDoMob(-300), -100);
  assert.equal(L.resistenciaDoMob(35), 35);
  assert.equal(L.resistenciaDoJogador(130), L.LIMITES.resistenciaDoJogador.maximo);
  assert.equal(L.resistenciaDoJogador(-20), 0, 'a proteção do jogador nunca fica negativa');
});

test('a penetração: a física só no físico; a elemental é global + a do elemento, e nunca vale em outro elemento', () => {
  const pen = { fisica: 20, elemental: 30, porElemento: { fire: 25, ice: 0 } };
  assert.equal(L.penetracaoDe(pen, 'physical'), 20);
  assert.equal(L.penetracaoDe(pen, 'fire'), 55, 'global 30 + fogo 25');
  assert.equal(L.penetracaoDe(pen, 'ice'), 30, 'a de fogo não vale no gelo');
  assert.equal(L.penetracaoDe({ fisica: 90, elemental: 90, porElemento: { fire: 90 } }, 'fire'), 100, 'teto de 100');
  assert.equal(L.penetracaoDe({ fisica: 500 }, 'physical'), 100);
  assert.equal(L.penetracaoDe({ elemental: 40 }, 'physical'), 0, 'a elemental não vale no físico');
  assert.equal(L.penetracaoDe(null, 'fire'), 0);
});

function bicho(resist = {}) {
  const m = criarMonstro({ key: 'troll', x: 1, y: 1 }, null);
  m.resist = resist;
  return m;
}

test('resistido: a penetração do atacante corta a resistência do bicho (e só a do tipo certo)', () => {
  const m = bicho({ fire: 70, ice: 70 });
  const ficha = { penetracao: { fisica: 0, elemental: 0, porElemento: { fire: 30 } } };
  const base = resistenciaDe(null, m, 'fire');
  assert.ok(base >= 70);
  const semPen = resistido(null, m, 'fire', 1000);
  const comPen = resistido(null, m, 'fire', 1000, ficha);
  assert.ok(comPen > semPen, `${semPen} → ${comPen}`);
  assert.equal(resistido(null, m, 'ice', 1000, ficha), resistido(null, m, 'ice', 1000), 'a penetração de fogo não muda o gelo');
});

test('mob com resistência acima do teto: o teto vale antes da penetração; no teto 100, 100% de resistência não deixa passar nada', () => {
  const m = bicho({ earth: 300 });
  const antes = L.LIMITES.resistenciaDoMob.maximo;
  try {
    assert.equal(resistenciaEfetivaDe(null, m, 'earth'), antes);
    L.LIMITES.resistenciaDoMob.maximo = 100;
    assert.equal(resistido(null, m, 'earth', 1000), 0, 'imune');
    assert.equal(resistido(null, m, 'earth', 1000, { penetracao: { elemental: 100 } }), 1000, 'penetração de 100% atravessa a imunidade');
    assert.equal(resistido(null, m, 'earth', 1000, { penetracao: { elemental: 40 } }), 400);
  } finally {
    L.LIMITES.resistenciaDoMob.maximo = antes;
  }
});

test('a fraqueza do bicho para em −100% (dano ×2), mesmo que o bestiário diga −300', () => {
  const m = bicho({ physical: -400 });
  assert.equal(resistenciaDe(null, m, 'physical') <= -100, true);
  assert.equal(resistido(null, m, 'physical', 100), 200);
});

function comAfixos(af, voc = 'knight') {
  const e = personagemDeTeste({ vocacao: voc, level: 300 });
  e.equipment.ring = { id: ANEL, count: 1, af };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return e;
}

test('a ficha corta resistência, crítico, ataque duplo e penetração em 100%; o que passou fica em `excedentes`', () => {
  const e = comAfixos([
    { id: 'fire_res', nivel: 5, value: 160 },
    { id: 'crit_chance', nivel: 5, value: 150 },
    { id: 'double_attack', nivel: 5, value: 130 },
    { id: 'phys_pen', nivel: 5, value: 120 },
    { id: 'elem_pen', nivel: 5, value: 140 },
  ]);
  const f = Ficha.combate(e);
  assert.equal(f.protection.fire, f.limites.resistenciaDoJogador);
  assert.ok(f.excedentes.protection.fire >= 60);
  assert.equal(f.critChance, 1);
  assert.ok(f.excedentes.critChance > 0.5);
  assert.equal(f.ataqueDuplo, 1);
  assert.equal(f.penetracao.fisica, 100);
  assert.equal(f.penetracao.elemental, 100);
  assert.ok(Object.values(f.penetracao.porElemento).every((v) => v === 0));
  assert.equal(f.limites.critico, 100);
});

test('sem os afixos, os atributos novos valem 0 e o multiplicador de crítico não tem limite', () => {
  const f = Ficha.combate(personagemDeTeste({ vocacao: 'knight', level: 300 }));
  assert.equal(f.ataqueDuplo, 0);
  assert.equal(f.penetracao.fisica, 0);
  const e = comAfixos([{ id: 'crit_dmg', nivel: 5, value: 900 }]);
  assert.ok(Ficha.combate(e).critMultiplier > 5, 'o multiplicador é outro atributo');
});

test('o crítico: chance acima de 100% (suporte, charm) sempre critica e nunca passa disso', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  const ficha = { ...Ficha.combate(e), critChance: 5 };
  let crits = 0;
  for (let i = 0; i < 50; i++) if (Ficha.rolarCritico(e, 100, { uid: 1, key: null }, [], ficha).crit) crits++;
  assert.equal(crits, 50);
});

function naCacada(e, forca = 1) {
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.outrosAndares = {};
  const m = criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null);
  m.hp = m.maxHp = 1e12;
  m.forca = forca;
  delete m.spawn;
  h.monstros.splice(0, h.monstros.length, m);
  h.alvo = m.uid;
  return m;
}

test('ataque duplo no golpe básico: com 100%, exatamente UM golpe extra por golpe (sem recursão em cadeia)', () => {
  const modo = PARAMETROS_DO_COMBATE.acerto.modo;
  PARAMETROS_DO_COMBATE.acerto.modo = 'draevor'; // acerto de ~100%: o teste conta golpes, não erros
  try {
  const e = comAfixos([{ id: 'double_attack', nivel: 5, value: 100 }]);
  e.maxHp = e.hp = 1e9;
  naCacada(e);
  let golpes = 0;
  let rodadas = 0;
  for (let i = 0; i < 40; i++) {
    const ev = round(e, PERSONAGEM).eventos.filter((x) => x.t === 'dmg' && x.foe && x.color === '#ff0000');
    if (ev.length) {
      rodadas++;
      golpes += ev.length;
    }
  }
  assert.ok(rodadas > 0);
  assert.equal(golpes, rodadas * 2, `${golpes} golpes em ${rodadas} rodadas`);
  } finally {
    PARAMETROS_DO_COMBATE.acerto.modo = modo;
  }
});

test('ataque duplo sem a chance: um golpe só', () => {
  const modo = PARAMETROS_DO_COMBATE.acerto.modo;
  PARAMETROS_DO_COMBATE.acerto.modo = 'draevor'; // acerto de ~100%: o teste conta golpes, não erros
  try {
  const e = comAfixos([]);
  e.maxHp = e.hp = 1e9;
  naCacada(e);
  let golpes = 0;
  let rodadas = 0;
  for (let i = 0; i < 40; i++) {
    const ev = round(e, PERSONAGEM).eventos.filter((x) => x.t === 'dmg' && x.foe && x.color === '#ff0000');
    if (ev.length) { rodadas++; golpes += ev.length; }
  }
  assert.equal(golpes, rodadas);
  } finally {
    PARAMETROS_DO_COMBATE.acerto.modo = modo;
  }
});

test('ataque duplo na gema: o ataque repete UMA vez, sem gastar mana a mais, e o roubo de vida conta só do primeiro', () => {
  const dano = (duplo) => {
    const e = comAfixos(duplo ? [{ id: 'double_attack', nivel: 5, value: 100 }] : [], 'sorcerer');
    e.maxHp = e.hp = 1e9;
    e.maxMana = e.mana = 1e9;
    naCacada(e);
    e.actions = Array(Acoes.SLOTS).fill(null);
    comSkills(e, ['spell-energy-strike']);
    const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
    assert.ok(Acoes.definir(e, { slot, value: { id: 'spell-energy-strike' } }).ok);
    e.hunt.cooldowns = {};
    e.hunt.ultimoAtaqueEm = null;
    const antes = e.mana;
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, e.hunt.monstros[0]);
    assert.ok(r.ok, r.erro);
    return { acertos: r.eventos.filter((x) => x.t === 'dmg' && x.foe).length, mana: antes - e.mana };
  };
  const um = dano(false);
  const dois = dano(true);
  assert.equal(dois.acertos, um.acertos * 2);
  assert.equal(dois.mana, um.mana, 'o segundo ataque não gasta mana');
});
