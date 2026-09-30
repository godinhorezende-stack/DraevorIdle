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
import { personagemDeTeste, PERSONAGEM, comSkills } from './apoio.mjs';
import * as GemasDeSkill from '../systems/skills/gemas.mjs';

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
/** A magia com a gema encaixada NO ANEL (a peça da sonda): o +N ao nível das gemas vale por peça. */
function magiaNoAnel(id) {
  return (e) => {
    e.actions = Array(Acoes.SLOTS).fill(null);
    const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
    e.equipment.ring.soquetes = { abertos: 1, links: [], gemas: [GemasDeSkill.novaGema(GemasDeSkill.ITEM_DA_ACAO.get(id))] };
    Ficha.invalidar(e);
    assert.ok(Acoes.definir(e, { slot, value: { id } }).ok, id);
    for (let i = 0; i < 60; i++) {
      e.hunt.cooldowns = {};
      e.mana = e.maxMana;
      Acoes.disparar(e, e.hunt, PERSONAGEM, slot, e.hunt.monstros[0]);
    }
    return 1e12 - e.hunt.monstros[0].hp;
  };
}
function magia(id) {
  return (e) => {
    e.actions = Array(Acoes.SLOTS).fill(null);
    const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
    comSkills(e, [id]);
    comSkills(e, [id]);
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
    // O que o Energy Shield engoliu (`es`) não chegou na vida.
    for (const x of ev) if (x.t === 'dmg' && !x.foe && !x.es) d += x.v;
  }
  return d;
};
/** As recargas que UMA magia deixa: a própria (`propria`) ou as do grupo/intervalo (o resto). */
const recargaDaMagia = (id, qual) => (e) => {
  e.actions = Array(Acoes.SLOTS).fill(null);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
  comSkills(e, [id]);
  assert.ok(Acoes.definir(e, { slot, value: { id } }).ok, id);
  e.hunt.cooldowns = {};
  e.mana = e.maxMana;
  Acoes.disparar(e, e.hunt, PERSONAGEM, slot, e.hunt.monstros[0]);
  const cds = Object.entries(e.hunt.cooldowns);
  return cds.filter(([k]) => (qual === 'propria' ? k === id : k !== id)).reduce((n, [, c]) => n + (c?.total ?? 0), 0);
};
/** A mana gasta em 30 magias. */
const manaGasta = (id) => (e) => {
  e.actions = Array(Acoes.SLOTS).fill(null);
  const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
  comSkills(e, [id]);
  assert.ok(Acoes.definir(e, { slot, value: { id } }).ok, id);
  let gasto = 0;
  for (let i = 0; i < 30; i++) {
    e.hunt.cooldowns = {};
    e.hunt.ultimoAtaqueEm = null;
    e.mana = e.maxMana;
    Acoes.disparar(e, e.hunt, PERSONAGEM, slot, e.hunt.monstros[0]);
    gasto += e.maxMana - e.mana;
  }
  return gasto;
};
/** Vida/mana que 10 s de regeneração devolvem (`Cacadas.regenerar`, o mesmo do tique). */
const regenerado = (campo) => (e) => {
  e.maxHp = e.maxMana = 1e6;
  e.hp = e.mana = 1;
  Ficha.invalidar(e);
  Cacadas.regenerar(e, 10_000);
  return e[campo] - 1;
};
const matando = (medir) => (e) => {
  let n = 0;
  for (let i = 0; i < 300; i++) {
    const m = criarMonstro({ key: 'troll', x: 1, y: 1 }, null);
    e.hunt.monstros.push(m);
    const ev = [];
    const antes = e.gold ?? 0;
    matarMonstro(e, e.hunt, PERSONAGEM, m, ev);
    n += medir(e, ev, antes);
    e.pouch = [];
  }
  return n;
};
/** Um bicho de level alto (fase de Item Level 2000): o golpe erra sem Accuracy. */
const bichoForte = (forca = 1) => (e) => {
  naCacada(e, 'troll', forca);
  e.hunt.escala = { nivel: 2000, vida: 1, dano: 1, exp: 1 };
};
const comPeca = (slot, nome, base) => (e) => {
  naCacada(e, 'troll', 30);
  e.equipment[slot] = { id: idDe(nome), count: 1, base };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
};

/*
 * id → [vocação, arma, montar(e), medir(e), valor, 'mais' | 'menos'].
 * `montar` prepara a caçada; `medir` devolve o número que o atributo tem de mexer.
 * Um por modificador de gamedata/itens/atributos.json (a lista do dono, 29/09).
 */
const cacada = (key, forca) => (e) => naCacada(e, key, forca);
const sobre = (fn) => (e) => fn(Ficha.combate(e));
const SONDAS = {
  // Os 3 principais: STR (Life e dano físico), DEX (Accuracy, Evasion, Attack Speed), INT (Mana e dano mágico).
  str: ['knight', null, cacada(), golpes, 500, 'mais'],
  // (bicho de level alto: contra o troll, o DEX da vocação já bate no teto da esquiva)
  dex: ['knight', null, bichoForte(30), recebido, 5000, 'menos'],
  int: ['sorcerer', null, cacada(), magia('spell-energy-strike'), 500, 'mais'],
  // Ofensivos.
  atk_flat: ['knight', null, cacada(), golpes, 50, 'mais'],
  phys_dmg: ['knight', null, cacada(), golpes, 50, 'mais'],
  crit_chance: ['knight', null, cacada(), golpes, 50, 'mais'],
  crit_dmg: ['knight', null, cacada(), golpes, 200, 'mais'],
  accuracy: ['knight', null, bichoForte(), golpes, 50000, 'mais'],
  life_leech: ['knight', null, cacada(), curaDosGolpes(null), 50, 'mais'],
  mana_leech: ['knight', null, cacada(), curaDosGolpes('#4fc3ff'), 50, 'mais'],
  // A velocidade de ataque encurta o intervalo do golpe básico (a ficha é o que o tique lê).
  atk_speed: ['knight', null, () => {}, sobre((f) => -f.intervaloDoGolpeMs), 50, 'mais'],
  cast_speed: ['sorcerer', null, cacada(), recargaDaMagia('spell-energy-strike', 'grupo'), 50, 'menos'],
  cooldown_recovery: ['sorcerer', null, cacada(), recargaDaMagia('spell-energy-strike', 'propria'), 50, 'menos'],
  skill_cost: ['sorcerer', null, cacada(), manaGasta('spell-energy-strike'), 30, 'menos'],
  // +N ao nível das gemas encaixadas NA PEÇA: a gema do anel sobe de nível, e o dano da skill junto.
  gem_level: ['sorcerer', null, cacada(), magiaNoAnel('spell-energy-strike'), 2, 'mais'],
  // Os elementais: no golpe da arma de um knight (que não tem nada daquele elemento).
  fire_dmg: ['knight', null, cacada(), golpes, 50, 'mais'],
  energy_dmg: ['knight', null, cacada(), golpes, 50, 'mais'],
  earth_dmg: ['knight', null, cacada(), golpes, 50, 'mais'],
  ice_dmg: ['knight', null, cacada(), golpes, 50, 'mais'],
  death_dmg: ['knight', null, cacada(), golpes, 50, 'mais'],
  holy_dmg: ['knight', null, cacada(), golpes, 50, 'mais'],
  // Contra quem: boss (sala do boss), elite (quando existir) e qualquer criatura.
  dmg_vs_boss: ['knight', null, (e) => { naCacada(e); e.hunt.isBoss = true; }, golpes, 50, 'mais'],
  dmg_vs_elite: ['knight', null, (e) => { naCacada(e).elite = true; }, golpes, 50, 'mais'],
  dmg_vs_monsters: ['knight', null, cacada(), golpes, 50, 'mais'],
  // Recursos.
  life: ['knight', null, () => {}, (e) => e.maxHp, 500, 'mais'],
  mana: ['knight', null, () => {}, (e) => e.maxMana, 500, 'mais'],
  life_regen: ['knight', null, () => {}, regenerado('hp'), 50, 'mais'],
  mana_regen: ['knight', null, () => {}, regenerado('mana'), 50, 'mais'],
  life_regen_pct: ['knight', null, () => {}, regenerado('hp'), 50, 'mais'],
  mana_regen_pct: ['knight', null, () => {}, regenerado('mana'), 50, 'mais'],
  // Defensivos: o golpe do bicho de verdade (`contraAtaque`).
  armor_flat: ['knight', null, cacada('troll', 30), recebido, 50, 'menos'],
  armour_pct: ['knight', null, cacada('troll', 30), recebido, 50, 'menos'],
  evasion: ['knight', null, bichoForte(30), recebido, 5000, 'menos'],
  evasion_pct: ['knight', null, bichoForte(30), recebido, 3000, 'menos'],
  energy_shield: ['sorcerer', null, cacada('troll', 30), recebido, 1e6, 'menos'],
  es_pct: ['sorcerer', null, comPeca('body', 'terra mantle', { armor: [0, 0], es: [100, 100] }), recebido, 100, 'menos'],
  block: ['knight', null, () => {}, sobre((f) => f.blockChance), 30, 'mais'],
  dmg_reduction: ['knight', null, cacada('troll', 30), recebido, 30, 'menos'],
  avoid_damage: ['knight', null, cacada('troll', 30), recebido, 30, 'menos'],
  phys_res: ['knight', null, cacada('troll', 30), recebido, 50, 'menos'],
  // As resistências elementais: a proteção da ficha, que `Poderes.lancar` usa (medido na auditoria).
  fire_res: ['knight', null, () => {}, sobre((f) => f.protection.fire), 50, 'mais'],
  energy_res: ['knight', null, () => {}, sobre((f) => f.protection.energy), 50, 'mais'],
  earth_res: ['knight', null, () => {}, sobre((f) => f.protection.earth), 50, 'mais'],
  ice_res: ['knight', null, () => {}, sobre((f) => f.protection.ice), 50, 'mais'],
  holy_res: ['knight', null, () => {}, sobre((f) => f.protection.holy), 50, 'mais'],
  death_res: ['knight', null, () => {}, sobre((f) => f.protection.death), 50, 'mais'],
  // Utilidade.
  move_speed: ['knight', null, () => {}, (e) => Cacadas.razaoDeVelocidade(e), 50, 'mais'],
  exp_bonus: ['knight', null, cacada(), (e) => {
    const m = criarMonstro({ key: 'troll', x: 1, y: 1 }, null);
    e.hunt.monstros.push(m);
    const antes = e.xp;
    matarMonstro(e, e.hunt, PERSONAGEM, m, []);
    return e.xp - antes;
  }, 50, 'mais'],
  loot_bonus: ['knight', null, cacada(), matando((e, ev) => ev.filter((x) => x.t === 'loot').reduce((n, x) => n + x.items.reduce((a, it) => a + it.count, 0), 0)), 100, 'mais'],
  gold_find: ['knight', null, cacada(), matando((e, ev, antes) => (e.gold ?? 0) - antes), 100, 'mais'],
};

test('todo atributo que pode dropar tem uma sonda de efeito aqui (atributo novo sem caminho verificado falha)', () => {
  // Mesmo o que ainda não dropa (Damage vs Elite) tem o caminho verificado.
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
