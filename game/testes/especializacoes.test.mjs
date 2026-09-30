// CLASSES + ESPECIALIZAÇÕES NATURAIS (gamedata/classes.json): afinidades pelas TAGS da skill/golpe,
// medidas no motor de verdade (disparar/round), e nada bloqueando por classe (modelo Path of Exile).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Treino from '../systems/treino.mjs';
import * as Inventario from '../systems/inventario.mjs';
import * as Comparar from '../systems/itens/comparar.mjs';
import * as Especializacoes from '../systems/personagem/especializacoes.mjs';
import * as Tags from '../systems/skills/tags.mjs';
import { ITEM_CATALOG, ACTION_CATALOG } from '../systems/dados.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { round } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const idDe = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome).id);
const skill = (id) => [...ACTION_CATALOG.spells, ...ACTION_CATALOG.runes].find((x) => x.id === id);

/** Math.random com semente: "com" e "sem" a especialização veem os mesmos sorteios. */
function comSemente(fn) {
  const original = Math.random;
  let s = 7;
  Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}
/** Roda `fn` com a classe SEM especializações (a mesma conta, só sem a afinidade). */
function semEspecializacao(voc, fn) {
  const c = Especializacoes.CONFIG.classes[voc];
  const antes = c.especializacoes;
  c.especializacoes = [];
  try {
    return fn();
  } finally {
    c.especializacoes = antes;
  }
}

function personagem(voc, { arma = null, anel = null } = {}) {
  const e = personagemDeTeste({ vocacao: voc, level: 300 });
  Treino.garantir(e);
  e.magic.value = 60;
  for (const k of Object.keys(e.skills)) if (k !== 'fishing') e.skills[k].value = 80;
  if (arma) e.equipment.weapon = { id: idDe(arma), count: 1 };
  if (arma && ITEM_CATALOG[idDe(arma)].twoHanded) e.equipment.shield = null;
  e.equipment.ring = anel ? { id: idDe('might ring'), count: 1, af: anel } : null;
  e.maxHp = e.hp = e.maxMana = e.mana = 1e9;
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' });
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.outrosAndares = {};
  const m = criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null);
  m.hp = m.maxHp = 1e12;
  delete m.spawn;
  h.monstros.splice(0, h.monstros.length, m);
  h.alvo = m.uid;
  h.escala = { nivel: 1, vida: 1, dano: 1, exp: 1 }; // bicho fraco: o golpe da arma não erra
  return e;
}
/** O dano de 40 lançamentos de uma skill (a conta do combate: `Acoes.disparar`). */
function danoDaSkill(voc, id, opcoes) {
  return comSemente(() => {
    const e = personagem(voc, opcoes);
    e.actions = Array(Acoes.SLOTS).fill(null);
    const slot = Acoes.PAPEL_DO_SLOT.indexOf('attack');
    const r = Acoes.definir(e, { slot, value: { id } });
    assert.ok(r.ok, `${voc} não conseguiu pôr ${id} na barra: ${r.erro}`);
    for (let i = 0; i < 40; i++) {
      e.hunt.cooldowns = {};
      e.hunt.ultimoAtaqueEm = null;
      e.mana = e.maxMana;
      Acoes.disparar(e, e.hunt, PERSONAGEM, slot, e.hunt.monstros[0]);
    }
    return 1e12 - e.hunt.monstros[0].hp;
  });
}
/** O dano de 60 golpes básicos (`round`). */
function danoDoGolpe(voc, opcoes) {
  return comSemente(() => {
    const e = personagem(voc, opcoes);
    let d = 0;
    for (let i = 0; i < 60; i++) for (const x of round(e, PERSONAGEM).eventos) if (x.t === 'dmg' && x.foe) d += x.v;
    return d;
  });
}
/** O ganho esperado: a afinidade soma no MESMO "+X%" das outras fontes (base 100% + ...). */
function ganhoEsperado(voc, tags, somaDasOutras) {
  const afin = Ficha.afinidadePara(Ficha.combate(personagemDeTeste({ vocacao: voc, level: 300 })), tags).pct;
  return (100 + somaDasOutras + afin) / (100 + somaDasOutras);
}
const perto = (a, b, msg) => assert.ok(Math.abs(a / b - 1) < 0.03, `${msg}: ${a.toFixed(4)} vs ${b.toFixed(4)}`);

test('1. Knight usando skill Physical (Brutal Strike, melee): +Physical +Melee', () => {
  assert.deepEqual(Tags.tagsDaAcao(skill('spell-brutal-strike')).sort(), ['melee', 'physical', 'single', 'spell']);
  const com = danoDaSkill('knight', 'spell-brutal-strike');
  const sem = semEspecializacao('knight', () => danoDaSkill('knight', 'spell-brutal-strike'));
  const f = Ficha.combate(personagem('knight'));
  perto(com / sem, ganhoEsperado('knight', ['physical', 'melee'], f.danoDeMagia + (f.danoDoElemento.physical ?? 0) + (f.skillBonus.magic ?? 0)), 'knight brutal strike');
  assert.ok(com > sem * 1.15);
});

test('2. Sorcerer usando Fire (Flame Strike): +Fire +Spell', () => {
  const com = danoDaSkill('sorcerer', 'spell-flame-strike');
  const sem = semEspecializacao('sorcerer', () => danoDaSkill('sorcerer', 'spell-flame-strike'));
  assert.ok(com > sem * 1.2, `${sem} → ${com}`);
  const e = personagem('sorcerer');
  assert.deepEqual(Ficha.afinidadePara(Ficha.combate(e), Tags.tagsDaAcao(skill('spell-flame-strike'))).fontes.map((f) => f.especializacao).sort(), ['Fire', 'Spell']);
});

test('3. Knight usando Fire (Flame Strike): pode (não bloqueia), mas sem afinidade natural', () => {
  const e = personagem('knight');
  const entrada = Acoes.catalogo(e).spells.find((x) => x.id === 'spell-flame-strike');
  assert.equal(entrada.blocked, null, 'nada bloqueia por classe');
  assert.deepEqual(entrada.classeRecomendada.sort(), ['druid', 'sorcerer']);
  assert.equal(entrada.afinidade.pct, 0);
  const com = danoDaSkill('knight', 'spell-flame-strike');
  const sem = semEspecializacao('knight', () => danoDaSkill('knight', 'spell-flame-strike'));
  assert.equal(com, sem, 'a especialização do knight não mexe no fogo');
});

test('4. Paladin usando skill ranged (Ethereal Spear e o arco): +Physical +Ranged', () => {
  const com = danoDaSkill('paladin', 'spell-ethereal-spear');
  const sem = semEspecializacao('paladin', () => danoDaSkill('paladin', 'spell-ethereal-spear'));
  assert.ok(com > sem * 1.2, `spear ${sem} → ${com}`);
  const golpeCom = danoDoGolpe('paladin', { arma: 'crossbow' });
  const golpeSem = semEspecializacao('paladin', () => danoDoGolpe('paladin', { arma: 'crossbow' }));
  assert.ok(golpeCom > golpeSem * 1.1, `golpe ${golpeSem} → ${golpeCom}`);
});

test('5. Paladin usando Fire (Flame Strike e Fireball rune): pode, sem afinidade natural', () => {
  const e = personagem('paladin');
  const c = Acoes.catalogo(e);
  for (const id of ['spell-flame-strike', 'rune-fireball-rune']) {
    const x = [...c.spells, ...c.runes].find((y) => y.id === id);
    assert.equal(x.blocked, null, id);
    assert.equal(x.afinidade.pct, 0, id);
  }
  assert.equal(danoDaSkill('paladin', 'spell-flame-strike'), semEspecializacao('paladin', () => danoDaSkill('paladin', 'spell-flame-strike')));
});

test('6. Druid usando Ice (Ice Strike): +Ice (e não Spell — a do druid é Healing)', () => {
  const com = danoDaSkill('druid', 'spell-ice-strike');
  const sem = semEspecializacao('druid', () => danoDaSkill('druid', 'spell-ice-strike'));
  assert.ok(com > sem * 1.1, `${sem} → ${com}`);
  assert.deepEqual(Ficha.afinidadePara(Ficha.combate(personagem('druid')), Tags.tagsDaAcao(skill('spell-ice-strike'))).fontes.map((f) => f.especializacao), ['Ice']);
  // E a cura: Healing +20% na ficha.
  assert.equal(Ficha.combate(personagem('druid')).curaDeMagia - semEspecializacao('druid', () => Ficha.combate(personagem('druid')).curaDeMagia), 20);
});

test('7. Monk usando skill melee (golpe básico e Swift Jab): +Physical +Melee; Mobility na ficha', () => {
  const com = danoDoGolpe('monk');
  const sem = semEspecializacao('monk', () => danoDoGolpe('monk'));
  assert.ok(com > sem * 1.15, `golpe ${sem} → ${com}`);
  if (skill('spell-swift-jab')) {
    const s1 = danoDaSkill('monk', 'spell-swift-jab');
    const s0 = semEspecializacao('monk', () => danoDaSkill('monk', 'spell-swift-jab'));
    assert.ok(s1 > s0 * 1.15, `swift jab ${s0} → ${s1}`);
  }
  const f = Ficha.combate(personagem('monk'));
  const f0 = semEspecializacao('monk', () => Ficha.combate(personagem('monk')));
  assert.ok(f.evasion > f0.evasion && f.speed > f0.speed && f.velocidadeDeAtaque > f0.velocidadeDeAtaque, 'Mobility: Evasion, Movement e Attack Speed');
});

test('8. dano antes/depois de equipar um item: Fire Damage do anel soma com a afinidade (mesma conta da comparação)', () => {
  const sem = danoDaSkill('sorcerer', 'spell-flame-strike');
  const com = danoDaSkill('sorcerer', 'spell-flame-strike', { anel: [{ id: 'fire_dmg', nivel: 5, value: 25 }] });
  const f = Ficha.combate(personagem('sorcerer'));
  const outras = f.danoDeMagia + (f.danoDoElemento.fire ?? 0) + (f.skillBonus.magic ?? 0) + 30; // + Fire 15 + Spell 15
  perto(com / sem, (100 + outras + 25) / (100 + outras), 'anel de fogo');
  // A comparação ("Ao equipar") vê o mesmo Fire Damage.
  const e = personagem('sorcerer');
  const r = Comparar.comparar(e, { id: idDe('might ring'), af: [{ id: 'fire_dmg', nivel: 5, value: 25 }] });
  assert.equal(r.personagem.find((l) => l.chave === 'danoDoElemento.fire')?.delta, 25);
});

test('9. ficha: a classe, as especializações naturais e os efeitos derivados', () => {
  const f = Ficha.combate(personagem('sorcerer'));
  assert.equal(f.classe.nome, 'Sorcerer');
  assert.deepEqual(f.classe.especializacoes.map((e) => e.nome), ['Fire', 'Energy', 'Death', 'Spell']);
  assert.deepEqual(f.afinidades, { fire: 15, energy: 15, death: 15, spell: 15 });
  assert.equal(f.castSpeed - semEspecializacao('sorcerer', () => Ficha.combate(personagem('sorcerer')).castSpeed), 5);
  // Knight: Armour +20% e Life +15% nos números que o combate usa.
  const k = personagem('knight');
  const k0 = semEspecializacao('knight', () => Ficha.combate(personagem('knight')).armor);
  assert.ok(Ficha.combate(k).armor >= Math.floor(k0 * 1.2) - 1, `Armour ${k0} → ${Ficha.combate(k).armor}`);
  // A vida máxima de um knight normal (sem a vida forçada do teste): +15%.
  const vida = personagemDeTeste({ vocacao: 'knight', level: 300 }).maxHp;
  const vida0 = semEspecializacao('knight', () => personagemDeTeste({ vocacao: 'knight', level: 300 }).maxHp);
  assert.ok(vida > vida0 * 1.1, `vida ${vida0} → ${vida}`);
  // Elite Knight (promovido) é a mesma classe.
  assert.equal(Especializacoes.classeDe({ vocation: 'Elite Knight' }), 'knight');
});

test('10. a origem dos bônus (o que a ficha e o balão mostram): base, equipamento, especialização', () => {
  const e = personagem('sorcerer', { anel: [{ id: 'fire_dmg', nivel: 5, value: 25 }] });
  const f = Ficha.combate(e);
  assert.deepEqual(f.origens['dano.fire'], [{ fonte: 'Equipamento', valor: 25 }, { fonte: 'Especialização: Fire', valor: 15 }]);
  assert.ok(f.origens['dano.spell'].some((o) => o.fonte === 'Especialização: Spell'));
  assert.ok(f.origens['dano.spell'].some((o) => o.fonte.startsWith('INT')));
  // No balão da skill: a afinidade DESTE personagem e de onde vem.
  const flame = Acoes.catalogo(e).spells.find((x) => x.id === 'spell-flame-strike');
  assert.equal(flame.afinidade.pct, 30);
  assert.deepEqual(flame.tags.sort(), ['fire', 'projectile', 'single', 'spell']);
});

test('requisito de atributo (modelo Path of Exile): peça de mago pede INT; o knight precisa investir, o sorcerer já tem', () => {
  const MANTO = idDe('terra mantle');
  assert.deepEqual(ITEM_CATALOG[MANTO].requisito, { atributos: ['int'], valor: 15 });
  const k = personagemDeTeste({ vocacao: 'knight', level: 60 });
  k.inventory.push({ id: MANTO, count: 1 });
  assert.match(Inventario.equipar(k, { id: MANTO }).erro, /Requer 15 INT/);
  // Com INT dos itens, pode.
  k.equipment.ring = { id: idDe('might ring'), count: 1, af: [{ id: 'int', nivel: 5, value: 20 }] };
  assert.notEqual(Inventario.equipar(k, { id: MANTO }).ok, false);
  const s = personagemDeTeste({ vocacao: 'sorcerer', level: 60 });
  s.inventory.push({ id: MANTO, count: 1 });
  assert.notEqual(Inventario.equipar(s, { id: MANTO }).ok, false);
  // Peça de todas as vocações não pede nada.
  assert.equal(ITEM_CATALOG[idDe('might ring')].requisito, undefined);
});
