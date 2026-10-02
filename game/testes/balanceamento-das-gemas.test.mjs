// O balanceamento das gemas (rodada de 02/10, `docs/auditoria-gemas.md`): os botões novos (`fatorDeCura`, `fatorDeCusto`) e as TRAVAS que
// medem no motor de verdade que nenhuma classe volta a passar das outras por muito (o Monk com Chained Penance ficava 5× acima).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';
import * as Acoes from '../systems/acoes.mjs';
import * as Gemas from '../systems/skills/gemas.mjs';
import * as Rot from '../systems/combate/simulador-rotacao.mjs';
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

const dps = (voc, skill, alvos) => {
  const e = personagemDeTeste({ vocacao: voc, level: 300 });
  assert.ok(Rot.vestirBuild(e, { grupos: [{ skill }] }).ok);
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
