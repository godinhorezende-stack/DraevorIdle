// A reestruturação de itens (29/09): STR/DEX/INT, Accuracy, Evasion, Energy
// Shield, Chance to Avoid Damage, bloqueio com teto, a migração v4 das peças
// antigas e o vestir/tirar passando pela MESMA ficha.
import * as Formulas from '../systems/combate/formulas.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Inventario from '../systems/inventario.mjs';
import * as Comparar from '../systems/itens/comparar.mjs';
import * as Atributos from '../systems/personagem/atributos.mjs';
import * as Defesa from '../systems/personagem/defesa.mjs';
import * as Especializacoes from '../systems/personagem/especializacoes.mjs';
import { converterTudo, converterPersonagem, VERSAO_DOS_ITENS } from '../systems/itens/item.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { round, contraAtaque } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const idDe = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome).id);
const ANEL = idDe('might ring');
const C = Atributos.CONFIG;

function comAnel(e, af) {
  e.equipment.ring = { id: ANEL, count: 1, af };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  return Ficha.combate(e);
}
function naCacada(e) {
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
  return m;
}
/** Math.random fixo durante `fn`. */
function comSorteio(valor, fn) {
  const original = Math.random;
  Math.random = () => valor;
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

// ---------------------------------------------------------------- STR/DEX/INT

test('STR/DEX/INT: base da vocação + por level (automático) + itens', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 101 });
  const v = C.porVocacao.knight;
  const p = Atributos.principais(e, { str: 10 });
  assert.equal(p.daVocacao.str, Math.floor(v.base.str + v.porLevel.str * 100));
  assert.equal(p.str, p.daVocacao.str + 10);
  // Cada vocação puxa o seu: knight STR, paladin DEX, mago INT.
  const de = (voc) => Atributos.principais(personagemDeTeste({ vocacao: voc, level: 500 }));
  assert.ok(de('knight').str > de('knight').dex && de('knight').str > de('knight').int);
  assert.ok(de('paladin').dex > de('paladin').str);
  assert.ok(de('sorcerer').int > de('sorcerer').str && de('druid').int > de('druid').dex);
  // "elite knight" (promovido) segue knight.
  assert.deepEqual(Atributos.principais({ vocation: 'Elite Knight', level: 1 }).daVocacao, { str: v.base.str, dex: v.base.dex, int: v.base.int });
});

test('STR dá Life e dano físico; DEX Accuracy, Evasion e Attack Speed; INT Mana e dano mágico — na ficha', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  const antes = comAnel(e, []);
  const vidaAntes = e.maxHp;
  const manaAntes = e.maxMana;
  const f = comAnel(e, [{ id: 'str', nivel: 5, value: 40 }, { id: 'dex', nivel: 5, value: 40 }, { id: 'int', nivel: 5, value: 40 }]);
  const E = C.efeitos;
  assert.equal(f.atributos.str - antes.atributos.str, 40);
  // (o knight tem a especialização Life: +X% também sobre a vida que o STR dá)
  const lifePct = Especializacoes.efeitos(e).stats.life ?? 0;
  assert.ok(Math.abs(e.maxHp - vidaAntes - 40 * E.STR_LIFE_PER_POINT * (1 + lifePct / 100)) <= 1);
  assert.equal(e.maxMana - manaAntes, 40 * E.INT_MANA_PER_POINT);
  assert.ok(Math.abs(f.danoDoElemento.physical - antes.danoDoElemento.physical - 40 * E.STR_PHYSICAL_DAMAGE_PER_POINT) < 1e-9);
  assert.equal(f.accuracy - antes.accuracy, 40 * E.DEX_ACCURACY_PER_POINT);
  assert.equal(f.evasion - antes.evasion, 40 * E.DEX_EVASION_PER_POINT);
  assert.ok(Math.abs(f.velocidadeDeAtaque - antes.velocidadeDeAtaque - 40 * E.DEX_ATTACK_SPEED_PER_POINT) < 1e-9);
  assert.ok(Math.abs(f.danoDeMagia - antes.danoDeMagia - 40 * E.INT_MAGIC_DAMAGE_PER_POINT) < 1e-9);
});

// ---------------------------------------------------------------- Accuracy

test('Accuracy: chance de acerto pela precisão contra a evasão do bicho (entre o piso e o teto)', () => {
  const p = C.precisao;
  // O piso e o teto do acerto são os do modo em uso (`combate/formulas.json`): 5–95% no PoE, `precisao.MIN/MAX` no de antes.
  const poe = Formulas.PARAMETROS.acerto.modo === 'poe';
  assert.equal(Atributos.chanceDeAcerto(0, 100), poe ? Formulas.PARAMETROS.acerto.poe.minimo : p.MIN);
  assert.equal(Atributos.chanceDeAcerto(1e9, 100), poe ? Formulas.PARAMETROS.acerto.poe.maximo : p.MAX);
  // No level do bicho, a precisão base acerta a maioria.
  const L = 300;
  assert.ok(Atributos.chanceDeAcerto(Atributos.precisaoBase(L), L) > 0.8);
  assert.ok(Atributos.chanceDeAcerto(500, 100) > Atributos.chanceDeAcerto(500, 1000), 'bicho mais forte, mais erro');
});

test('Accuracy no combate: o golpe da arma pode ERRAR (evento marcado), o boneco de treino nunca esquiva', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  e.maxHp = e.hp = 1e9;
  const m = naCacada(e);
  e.hunt.escala = { nivel: 2000, vida: 1, dano: 1, exp: 1 };
  Ficha.invalidar(e);
  // Sorteio alto (0,99) > chance de acerto: erra.
  const { eventos } = comSorteio(0.99, () => round(e, PERSONAGEM));
  const erro = eventos.find((x) => x.t === 'block' && x.errou);
  assert.ok(erro, 'saiu o evento de erro');
  assert.equal(erro.uid, m.uid);
  assert.ok(!eventos.some((x) => x.t === 'dmg' && x.foe), 'errou: sem dano');
  assert.equal(m.hp, m.maxHp);
  assert.equal(Defesa.errou(Ficha.combate(e), e.hunt, { dummy: true }), false);
});

// ---------------------------------------------------------------- Evasion / Avoid

test('Evasion: esquiva do golpe corpo a corpo do bicho, com teto', () => {
  assert.equal(Atributos.chanceDeEsquiva(0, 100), 0);
  assert.equal(Atributos.chanceDeEsquiva(1e9, 100), Formulas.PARAMETROS.acerto.modo === 'poe' ? 1 - Formulas.PARAMETROS.acerto.poe.minimo : C.evasao.MAX);
  assert.ok(Atributos.chanceDeEsquiva(500, 50) > Atributos.chanceDeEsquiva(500, 500));
});

test('Chance to Avoid Damage: evita o golpe inteiro (evento de esquiva, nenhum dano)', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  comAnel(e, [{ id: 'avoid_damage', nivel: 5, value: 100 }]);
  const m = naCacada(e);
  const vida = e.hp;
  const ev = [];
  for (let i = 0; i < 50; i++) contraAtaque(e, e.hunt, PERSONAGEM, m, ev);
  assert.equal(e.hp, vida);
  assert.ok(ev.every((x) => x.t !== 'dmg'));
});

// ---------------------------------------------------------------- Energy Shield

test('Energy Shield: absorve antes da vida, reinicia a espera e recarrega depois dela', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 100 });
  // Sem o kit (que já dá um pouco de Energy Shield): só o do anel.
  e.equipment = {};
  const f = comAnel(e, [{ id: 'energy_shield', nivel: 5, value: 200 }]);
  assert.equal(f.energyShield, 200);
  assert.equal(Defesa.esAtual(e, f), 200, 'começa cheio');
  const ev = [];
  assert.equal(Defesa.absorver(e, f, 150, ev, { uid: 'player' }), 0, 'o ES engoliu tudo');
  assert.equal(e.es, 50);
  assert.equal(ev[0].es, true);
  assert.equal(Defesa.absorver(e, f, 80, ev, { uid: 'player' }), 30, 'o que sobra passa para a vida');
  assert.equal(e.es, 0);
  // Durante a espera, nada volta.
  Defesa.recarregar(e, f, C.energyShield.ATRASO_MS - 1);
  assert.equal(e.es, 0);
  // Depois dela, RECARGA_POR_SEGUNDO da barra por segundo, até o máximo.
  Defesa.recarregar(e, f, 1 + 1000);
  assert.equal(e.es, Math.floor(200 * C.energyShield.RECARGA_POR_SEGUNDO));
  Defesa.recarregar(e, f, 60_000);
  assert.equal(e.es, 200);
});

test('Energy Shield no combate: o golpe do bicho sai do ES antes da vida; a regeneração da caçada recarrega', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  comAnel(e, [{ id: 'energy_shield', nivel: 5, value: 1e6 }, { id: 'avoid_damage', nivel: 1, value: 0 }]);
  const m = naCacada(e);
  m.forca = 30;
  const vida = e.hp;
  const ev = [];
  // Sorteio 0,99: nada de bloqueio/esquiva, o golpe pega.
  comSorteio(0.99, () => {
    for (let i = 0; i < 20; i++) contraAtaque(e, e.hunt, PERSONAGEM, m, ev);
  });
  assert.equal(e.hp, vida, 'a vida não mexeu');
  assert.ok(e.es < 1e6, 'o ES pagou');
  assert.ok(ev.some((x) => x.t === 'dmg' && x.es));
  const gasto = e.es;
  Cacadas.regenerar(e, C.energyShield.ATRASO_MS + 2000);
  assert.ok(e.es > gasto, 'recarregou na regeneração');
});

// ---------------------------------------------------------------- Block / resistências

test('Block Chance (add) soma no bloqueio, com o teto da configuração', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  const antes = comAnel(e, []).blockChance;
  const f = comAnel(e, [{ id: 'block', nivel: 3, value: 5 }]);
  assert.ok(Math.abs(f.blockChance - Math.min(C.bloqueio.MAX, antes + 0.05)) < 1e-9);
  assert.equal(comAnel(e, [{ id: 'block', nivel: 5, value: 500 }]).blockChance, C.bloqueio.MAX);
});

test('as 7 resistências somam na proteção da ficha (sem "Magic Resistance")', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  const antes = comAnel(e, []).protection;
  for (const el of ['phys', 'fire', 'earth', 'energy', 'ice', 'holy', 'death']) {
    const f = comAnel(e, [{ id: `${el}_res`, nivel: 3, value: 7 }]);
    const campo = el === 'phys' ? 'physical' : el;
    assert.equal(f.protection[campo] - (antes[campo] ?? 0), 7, el);
  }
});

// ---------------------------------------------------------------- vestir / tirar

test('vestir e tirar passam pela MESMA ficha: o que entra, sai (vida máxima inclusive)', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 200 });
  e.equipment.ring = null;
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  const antes = { ...Ficha.combate(e), vida: e.maxHp };
  e.inventory.push({ id: ANEL, count: 1, raridade: 'raro', ilvl: 200, af: [{ id: 'str', nivel: 2, value: 8 }, { id: 'life', nivel: 2, value: 50 }] });
  assert.equal(Inventario.equipar(e, { id: ANEL }).ok ?? true, true);
  Ficha.invalidar(e);
  const vestido = Ficha.combate(e);
  assert.equal(vestido.atributos.str, antes.atributos.str + 8);
  const lifePct = Especializacoes.efeitos(e).stats.life ?? 0;
  assert.ok(Math.abs(e.maxHp - antes.vida - (50 + 8 * C.efeitos.STR_LIFE_PER_POINT) * (1 + lifePct / 100)) <= 1);
  Inventario.desequipar(e, { slot: 'ring' });
  Ficha.invalidar(e);
  assert.equal(Ficha.combate(e).atributos.str, antes.atributos.str);
  assert.equal(e.maxHp, antes.vida);
});

test('comparação usa a mesma conta: STR a mais aparece como diferença', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 200 });
  const r = Comparar.comparar(e, { id: ANEL, af: [{ id: 'str', nivel: 5, value: 40 }] });
  assert.ok(r.ok !== false, JSON.stringify(r));
  const linhas = [...(r.personagem ?? []), ...(r.linhas ?? [])];
  assert.ok(linhas.some((l) => l.delta > 0), 'alguma estatística subiu');
});

// ---------------------------------------------------------------- migração v4

test('migração v4: adds antigos viram os novos no MESMO tier, sem duplicar; marmor vira Energy Shield; ganha Item Level', () => {
  const mantle = idDe('terra mantle'); // sorcerer/druid → Energy Shield
  const peito = Object.values(ITEM_CATALOG).find((i) => i.slot === 'body' && i.armor >= 5 && JSON.stringify(i.vocations) === JSON.stringify(['knight']));
  const e = {
    versaoDosItens: 3,
    equipment: {
      body: { id: mantle, count: 1, raridade: 'raro', base: { armor: [0, 0], marmor: [11, 13] }, af: [{ id: 'skill_magic', nivel: 3, value: 2 }, { id: 'spell_dmg', nivel: 4, value: 5 }] },
      legs: { id: peito.id, count: 1, raridade: 'épico', base: { armor: [peito.armor, peito.armor] }, af: [{ id: 'skill_melee', nivel: 5, value: 6 }, { id: 'hp_max', nivel: 2, value: 3 }, { id: 'onslaught', nivel: 1, value: 0.5 }] },
    },
    inventory: [{ id: mantle, count: 1, raridade: 'incomum', af: [{ id: 'protect_all', nivel: 2, value: 1 }] }],
  };
  assert.ok(converterPersonagem(e) > 0);
  assert.equal(e.versaoDosItens, VERSAO_DOS_ITENS);
  const { body, legs } = e.equipment;
  // skill_magic T3 e spell_dmg T4 viram INT: fica UM, o de tier mais alto.
  assert.deepEqual(body.af.map((a) => [a.id, a.nivel]), [['int', 4]]);
  assert.equal(body.base.marmor, undefined);
  assert.deepEqual(body.base.armor, [0, 0]);
  assert.ok(body.base.es[0] > 0 && body.base.es[1] >= body.base.es[0], 'Energy Shield da peça de mago');
  assert.equal(body.ilvl, ITEM_CATALOG[mantle].minLevel);
  assert.deepEqual(legs.af.map((a) => [a.id, a.nivel]), [['str', 5], ['life', 2], ['crit_dmg', 1]]);
  for (const a of [...body.af, ...legs.af]) {
    const [lo, hi] = Afixos.FICHAS[a.id].niveis[a.nivel];
    assert.ok(a.value >= lo && a.value <= hi, `${a.id} T${a.nivel}: ${a.value}`);
  }
  assert.deepEqual(legs.base.armor, [peito.armor, peito.armor], 'peça de knight segue Armour');
  assert.equal(e.inventory[0].af[0].id, 'phys_res');
  // Idempotente.
  assert.equal(converterTudo(e), 0);
});
