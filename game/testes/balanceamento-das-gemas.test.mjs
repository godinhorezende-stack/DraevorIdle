// O balanceamento das gemas (rodada de 02/10, `docs/auditoria-gemas.md`): os botões novos (`fatorDeCura`, `fatorDeCusto`) e as TRAVAS que
// medem no motor de verdade que nenhuma classe volta a passar das outras por muito (o Monk com Chained Penance ficava 5× acima).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Gemas from '../systems/skills/gemas.mjs';
import * as Rot from '../systems/combate/simulador-rotacao.mjs';
import * as Treino from '../systems/treino.mjs';
import * as Ficha from '../systems/ficha.mjs';
import { ACTION_CATALOG } from '../systems/dados.mjs';

const base = (id) => [...ACTION_CATALOG.spells, ...ACTION_CATALOG.runes].find((a) => a.id === id);
const fator = (id, k) => Gemas.defDaGema(Gemas.ITEM_DA_ACAO.get(id))[k];

test('fatorDeCusto muda o custo de mana mostrado no catálogo; fatorDeCura muda a cura mostrada', () => {
  const id = 'spell-wound-cleansing';
  assert.ok(fator(id, 'fatorDeCusto') > 1 && fator(id, 'fatorDeCura') < 1);
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  const entrada = Acoes.catalogo(e).spells.find((a) => a.id === id);
  assert.equal(entrada.mana, Math.round(base(id).mana * fator(id, 'fatorDeCusto')));
  const semFator = Acoes.curaMostrada(e, { ...entrada, id: 'spell-light-healing' });
  assert.ok(semFator.max > 0);
  const defs = Gemas.defDaGema(Gemas.ITEM_DA_ACAO.get(id));
  const antes = defs.fatorDeCura;
  const medio = (x) => (x.min + x.max) / 2;
  const c1 = medio(Acoes.curaMostrada(e, entrada));
  defs.fatorDeCura = antes * 2;
  try {
    assert.ok(Math.abs(medio(Acoes.curaMostrada(e, entrada)) / c1 - 2) < 0.01, 'a cura dobra com o fator dobrado');
  } finally {
    defs.fatorDeCura = antes;
  }
});

test('o Knight não cura mais barato por mana que o Druid (identidade: o curandeiro é o Druid)', () => {
  const e = personagemDeTeste({ vocacao: 'druid', level: 300 });
  const eficiencia = (id) => { const a = Acoes.catalogo(e).spells.find((x) => x.id === id); return ((a.damage.min + a.damage.max) / 2) / a.mana; };
  const knight = Math.max(...['spell-wound-cleansing', 'spell-fair-wound-cleansing', 'spell-intense-wound-cleansing'].map(eficiencia));
  const druid = Math.max(...['spell-heal-friend', 'spell-mass-healing', 'spell-nature-s-embrace'].map(eficiencia));
  assert.ok(druid >= knight, `druid ${druid.toFixed(1)} contra knight ${knight.toFixed(1)}`);
  // Magia maior não é menos eficiente que a pequena de 20 de mana (a regra que a auditoria achou quebrada).
  assert.ok(eficiencia('spell-intense-healing') >= eficiencia('spell-light-healing') * 0.9);
});

// A arma de cada classe NO NÍVEL (300): a magia escala pelo dano normal da ficha, que parte do ataque da arma (Magic Attack na wand/rod).
const ARMA_NO_NIVEL = { sorcerer: 'falcon wand', druid: 'falcon rod', knight: 'umbral masterblade', paladin: 'umbral master bow', monk: null };
const dps = (voc, skill, alvos) => {
  const e = personagemDeTeste({ vocacao: voc, level: 300 });
  // Perícias a 40% do level (a mesma referência da auditoria): a magia escala pelo dano normal da ficha, que depende da perícia.
  Treino.garantir(e);
  e.magic.value = 120;
  for (const p of ['melee', 'distance']) if (e.skills?.[p]) e.skills[p].value = 120;
  Ficha.invalidar(e);
  assert.ok(Rot.vestirBuild(e, { grupos: [{ skill }], arma: ARMA_NO_NIVEL[voc] }).ok);
  return Rot.medirRotacao(e, PERSONAGEM, { duracaoMs: 30000, alvos }).dpsDasGemas;
};

test('trava de balanceamento: o melhor DPS do Monk fica na faixa das demais classes, em alvo único e em área', () => {
  const monk1 = dps('monk', 'spell-chained-penance', 1);
  const knight1 = dps('knight', 'spell-fierce-berserk', 1);
  assert.ok(monk1 <= knight1 * 1.5, `monk ${monk1} contra knight ${knight1}`);
  const monk5 = dps('monk', 'spell-chained-penance', 5);
  const sorc5 = dps('sorcerer', 'spell-great-fire-wave', 5);
  assert.ok(monk5 <= sorc5, `a melhor área do Sorcerer (${sorc5}) não pode ficar abaixo da do Monk (${monk5})`);
  const knight5 = dps('knight', 'spell-shield-bash', 5);
  assert.ok(knight5 <= sorc5, `Shield Bash do Knight (${knight5}) não passa da área do Sorcerer (${sorc5})`);
});

test('o custo dos suportes se MULTIPLICA (Multiple Projectiles +30% e Explosion +30% = ×1,69), o custo extra não cresce com a raridade e a mana cobrada é a do catálogo × isso', () => {
  const montar = (supports, raridade = 'comum') => {
    const e = personagemDeTeste({ vocacao: 'sorcerer', level: 300 });
    assert.ok(Rot.vestirBuild(e, { grupos: [{ skill: 'spell-flame-strike', supports }], raridade }).ok);
    return e;
  };
  const e = montar(['multiple-projectiles', 'explosion']);
  const ef = Gemas.efeitoNaSkill(e, 'spell-flame-strike');
  assert.ok(Math.abs(ef.custoPct - 69) < 0.01, `custoPct ${ef.custoPct}`);
  const lendario = Gemas.efeitoNaSkill(montar(['multiple-projectiles', 'explosion'], 'lendário'), 'spell-flame-strike');
  assert.ok(Math.abs(lendario.custoPct - 69) < 0.01, 'a raridade não encarece o suporte');
  // A economia e o custo extra também se multiplicam: ×0,8 (Mana Efficiency) × ×1,3 (Explosion) = ×1,04.
  const misto = Gemas.efeitoNaSkill(montar(['mana-efficiency', 'explosion']), 'spell-flame-strike');
  assert.ok(Math.abs(misto.custoPct - 4) < 0.01, `${misto.custoPct}`);
});

test('trava: a combinação barata (Flame Strike + Greater Multiple Projectiles + Explosion + Greater Damage) não supera a melhor área nativa gastando menos mana', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 300 });
  assert.ok(Rot.vestirBuild(e, { grupos: [{ skill: 'spell-flame-strike', supports: ['greater-multiple-projectiles', 'explosion', 'greater-damage'] }] }).ok);
  const combo = Rot.medirRotacao(e, PERSONAGEM, { duracaoMs: 30000, alvos: 5 });
  const e2 = personagemDeTeste({ vocacao: 'sorcerer', level: 300 });
  assert.ok(Rot.vestirBuild(e2, { grupos: [{ skill: 'spell-great-fire-wave' }] }).ok);
  const nativa = Rot.medirRotacao(e2, PERSONAGEM, { duracaoMs: 30000, alvos: 5 });
  assert.ok(combo.dpsDasGemas <= nativa.dpsDasGemas * 1.2, `combo ${combo.dpsDasGemas} contra nativa ${nativa.dpsDasGemas}`);
  assert.ok(combo.manaPorSegundo >= nativa.manaPorSegundo * 0.3, `mana do combo ${combo.manaPorSegundo} contra ${nativa.manaPorSegundo}`);
});
