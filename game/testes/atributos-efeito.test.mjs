// "Todo atributo que o sistema permite dropar precisa ter um caminho completo
// até o efeito correspondente no jogo" (o dono, auditoria de 29/09).
//
// Cada atributo de gamedata/itens/atributos.json tem aqui uma SONDA: uma peça
// com só ele, e o sistema real (golpe, magia, golpe do bicho, passo, morte)
// medido com e sem ela, na mesma sequência de sorteios. Atributo novo sem
// sonda → este teste falha: nada entra no jogo sem caminho verificado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Treino from '../systems/treino.mjs';
import { ATRIBUTOS } from '../systems/itens/config.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { matarMonstro, round, contraAtaque } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);
const idDe = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome)?.id);

/** Math.random com semente fixa, para "com" e "sem" verem os mesmos sorteios. */
function comSemente(fn) {
  const original = Math.random;
  let s = 99;
  Math.random = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function personagem(voc, { arma = null } = {}) {
  const e = personagemDeTeste({ vocacao: voc, level: 300 });
  Treino.garantir(e);
  e.magic.value = 80;
  for (const k of Object.keys(e.skills)) if (k !== 'fishing') e.skills[k].value = 80;
  if (arma) e.equipment.weapon = { id: idDe(arma), count: 1 };
  e.equipment.ring = { id: ANEL, count: 1, af: [] };
  e.maxHp = e.hp = 1e9;
  e.maxMana = e.mana = 1e9;
  return e;
}
function vestir(e, id, valor) {
  if (id) e.equipment.ring = { id: ANEL, count: 1, af: [{ id, nivel: 5, value: valor }] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return e;
}
function naCacada(e, key = 'troll', forca = 1) {
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.outrosAndares = {};
  const m = criarMonstro({ key, x: h.pos.x + 1, y: h.pos.y }, null);
  m.hp = m.maxHp = 1e12;
  m.forca = forca;
  delete m.spawn;
  h.monstros.splice(0, h.monstros.length, m);
  h.alvo = m.uid;
  return m;
}
const golpes = (e, n = 200) => {
  let d = 0;
  for (let i = 0; i < n; i++) for (const x of round(e, PERSONAGEM).eventos) if (x.t === 'dmg' && x.foe) d += x.v;
  return d;
};
const curaDosGolpes = (cor) => (e) => {
  let c = 0;
  for (let i = 0; i < 100; i++) {
    e.hp = e.maxHp / 2;
    e.mana = 0;
    for (const x of round(e, PERSONAGEM).eventos) if (x.t === 'heal' && (cor ? x.color === cor : x.color !== '#4fc3ff')) c += x.v;
  }
  return c;
};
function magia(id) {
  return (e) => {
    e.actions = Array(Acoes.SLOTS).fill(null);
    const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
    assert.ok(Acoes.definir(e, { slot, value: { id } }).ok, id);
    for (let i = 0; i < 60; i++) {
      e.hunt.cooldowns = {};
      e.mana = e.maxMana;
      Acoes.disparar(e, e.hunt, PERSONAGEM, slot, e.hunt.monstros[0]);
    }
    // O dano que as 60 magias causaram: a vida que o bicho perdeu.
    return 1e12 - e.hunt.monstros[0].hp;
  };
}
const recebido = (e) => {
  const m = e.hunt.monstros[0];
  let d = 0;
  for (let i = 0; i < 400; i++) {
    e.hp = e.maxHp;
    const ev = [];
    contraAtaque(e, e.hunt, PERSONAGEM, m, ev);
    for (const x of ev) if (x.t === 'dmg' && !x.foe) d += x.v;
  }
  return d;
};

/*
 * id → [vocação, arma, montar(e), medir(e), valor, 'mais' | 'menos'].
 * `montar` prepara a caçada; `medir` devolve o número que o atributo tem de mexer.
 */
const cacada = (key, forca) => (e) => naCacada(e, key, forca);
const SONDAS = {
  atk_flat: ['knight', null, cacada(), golpes, 50, 'mais'],
  weapon_atk_pct: ['knight', null, cacada(), golpes, 50, 'mais'],
  crit_chance: ['knight', null, cacada(), golpes, 50, 'mais'],
  crit_dmg: ['knight', null, cacada(), golpes, 200, 'mais'],
  onslaught: ['knight', null, cacada(), golpes, 50, 'mais'],
  life_leech: ['knight', null, cacada(), curaDosGolpes(null), 50, 'mais'],
  mana_leech: ['knight', null, cacada(), curaDosGolpes('#4fc3ff'), 50, 'mais'],
  // A velocidade de ataque encurta o intervalo do golpe básico (a ficha é o que o tique lê).
  atk_speed: ['knight', null, () => {}, (e) => Ficha.combate(e).velocidadeDeAtaque, 50, 'mais'],
  // Os elementais: na magia do elemento E no golpe da arma de um knight (que não tem nada daquele elemento).
  fire_dmg: ['knight', null, cacada(), golpes, 50, 'mais'],
  energy_dmg: ['knight', null, cacada(), golpes, 50, 'mais'],
  earth_dmg: ['knight', null, cacada(), golpes, 50, 'mais'],
  ice_dmg: ['knight', null, cacada(), golpes, 50, 'mais'],
  death_dmg: ['knight', null, cacada(), golpes, 50, 'mais'],
  holy_dmg: ['knight', null, cacada(), golpes, 50, 'mais'],
  spell_dmg: ['sorcerer', null, cacada(), magia('spell-energy-strike'), 50, 'mais'],
  skill_magic: ['sorcerer', null, cacada(), magia('spell-energy-strike'), 30, 'mais'],
  spell_heal: ['druid', null, cacada(), (e) => {
    e.actions = Array(Acoes.SLOTS).fill(null);
    const slot = Acoes.PAPEL_DO_SLOT.indexOf('hp');
    Acoes.definir(e, { slot, value: { id: 'spell-intense-healing' } });
    let c = 0;
    for (let i = 0; i < 30; i++) {
      e.hunt.cooldowns = {};
      e.hp = 1;
      e.maxHp = 1e6;
      Acoes.disparar(e, e.hunt, PERSONAGEM, slot, null);
      c += e.hp - 1;
    }
    return c;
  }, 50, 'mais'],
  armor_flat: ['knight', null, cacada('troll', 30), recebido, 50, 'menos'],
  phys_res: ['knight', null, cacada('troll', 30), recebido, 50, 'menos'],
  protect_all: ['knight', null, cacada('troll', 30), recebido, 50, 'menos'],
  skill_shielding: ['knight', null, () => {}, (e) => Ficha.combate(e).blockChance, 30, 'mais'],
  // As resistências elementais: a proteção da ficha, que `Poderes.lancar` usa (medido na auditoria).
  fire_res: ['knight', null, () => {}, (e) => Ficha.combate(e).protection.fire, 50, 'mais'],
  energy_res: ['knight', null, () => {}, (e) => Ficha.combate(e).protection.energy, 50, 'mais'],
  earth_res: ['knight', null, () => {}, (e) => Ficha.combate(e).protection.earth, 50, 'mais'],
  ice_res: ['knight', null, () => {}, (e) => Ficha.combate(e).protection.ice, 50, 'mais'],
  death_res: ['knight', null, () => {}, (e) => Ficha.combate(e).protection.death, 50, 'mais'],
  hp_max: ['knight', null, () => {}, (e) => e.maxHp, 50, 'mais'],
  mana_max: ['knight', null, () => {}, (e) => e.maxMana, 50, 'mais'],
  hp_regen: ['knight', null, () => {}, (e) => Ficha.combate(e).regenFlat.hp, 50, 'mais'],
  capacity: ['knight', null, () => {}, (e) => Afixos.capacidade(e), 50, 'mais'],
  speed: ['knight', null, () => {}, (e) => Cacadas.razaoDeVelocidade(e), 200, 'mais'],
  exp_bonus: ['knight', null, cacada(), (e) => {
    const m = criarMonstro({ key: 'troll', x: 1, y: 1 }, null);
    e.hunt.monstros.push(m);
    const antes = e.xp;
    matarMonstro(e, e.hunt, PERSONAGEM, m, []);
    return e.xp - antes;
  }, 50, 'mais'],
  loot_bonus: ['knight', null, cacada(), (e) => {
    let n = 0;
    for (let i = 0; i < 300; i++) {
      const m = criarMonstro({ key: 'troll', x: 1, y: 1 }, null);
      e.hunt.monstros.push(m);
      const ev = [];
      matarMonstro(e, e.hunt, PERSONAGEM, m, ev);
      for (const x of ev) if (x.t === 'loot') n += x.items.reduce((a, it) => a + it.count, 0);
      e.pouch = [];
    }
    return n;
  }, 100, 'mais'],
  skill_axe: ['knight', null, cacada(), golpes, 30, 'mais'],
  skill_sword: ['knight', 'sword', cacada(), golpes, 30, 'mais'],
  skill_club: ['knight', 'mace', cacada(), golpes, 30, 'mais'],
  skill_fist: ['monk', null, cacada(), golpes, 30, 'mais'],
  skill_distance: ['paladin', null, cacada(), golpes, 30, 'mais'],
};

test('todo atributo que pode dropar tem uma sonda de efeito aqui (atributo novo sem caminho verificado falha)', () => {
  const sem = Object.keys(ATRIBUTOS).filter((id) => !SONDAS[id]);
  assert.deepEqual(sem, [], `atributos sem sonda de efeito: ${sem.join(', ')}`);
});

for (const [id, [voc, arma, montar, medir, valor, sentido]] of Object.entries(SONDAS)) {
  test(`${id}: com o atributo, o efeito muda (${sentido})`, () => {
    const sem = comSemente(() => {
      const e = vestir(personagem(voc, { arma }), null);
      montar(e);
      return medir(e);
    });
    const com = comSemente(() => {
      const e = vestir(personagem(voc, { arma }), id, valor);
      montar(e);
      Ficha.invalidar(e);
      return medir(e);
    });
    if (sentido === 'mais') assert.ok(com > sem, `${id}: ${sem} → ${com}`);
    else assert.ok(com < sem, `${id}: ${sem} → ${com}`);
  });
}

test('resistência do bicho vale na magia (troll resiste 20% a energia) e o elemental dos atributos passa por ela', () => {
  const energia = comSemente(() => {
    const e = personagem('sorcerer');
    naCacada(e, 'troll');
    return magia('spell-energy-strike')(e);
  });
  const terra = comSemente(() => {
    const e = personagem('sorcerer');
    naCacada(e, 'troll');
    return magia('spell-terra-strike')(e);
  });
  // Mesmo dano de catálogo (strike de 1º círculo), resistências opostas: energia +20, terra −10.
  assert.ok(terra > energia, `terra ${terra} deveria passar energia ${energia} no troll`);
});
