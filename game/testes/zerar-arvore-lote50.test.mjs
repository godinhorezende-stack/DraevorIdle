// LOTE 50 — as ÚNICAS de JOIA (J30, a segunda leva): as Réplicas que perdem uma carga por segundo, o Poder Primordial (o seu dano se você
// convocou um Golem nos últimos 8 s; o dos Golens convocados há pouco), a Defesa Imprudente (o crítico contra você) e a Réplica dela (a chance
// de ser Congelado, Eletrizado e Incendiado), a Chuva de Farpas (os projéteis a mais do totem) e o Auto-Flagelo — com a regra do PoE das
// maldições em você: o limite de 1 (+ as adicionais), a mesma maldição não acumula.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const Cargas = await import('../systems/itens-poe/cargas.mjs');
const T = await import('../systems/itens-poe/traduzir.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const tr = (modelo, valores = []) => T.traduzirMod({ modelo, valores });

test('as linhas da segunda leva com efeito', { skip: SEM }, () => {
  for (const [m, v] of [['Perca uma Carga de Tolerância por segundo'], ['perca uma Carga de Frenesi por segundo'], ['Perca uma Carga de Poder por segundo'],
    ['Dano aumentado em {0}% se você Convocou um Golem nos últimos {1} segundos', [25, 8]], ['Dano dos Golens aumentado em {0}% se convocados nos últimos {1} segundos', [35, 8]],
    ['Acertos tem Chance de Acerto Crítico aumentada em {0}% contra você', [140]], ['+{0}% de chance de ser Congelado, Eletrizado e Incendiado', [10]], ['Totens atiram {0} Projéteis adicionais', [2]],
    ['Dano aumentado em {0}% por Maldição em Você', [10]], ['{0} Maldições adicionais podem ser aplicadas à você', [1]]]) {
    assert.equal(tr(m, v ?? []).estado, 'novo', m);
  }
  assert.deepEqual(tr('Dano aumentado em {0}% se você Convocou um Golem nos últimos {1} segundos', [25, 8]).efeitos, [{ stat: 'dmg_inc@nosUltimos:8:usou:golem', valor: 25 }]);
});

test('as RÉPLICAS que perdem uma carga por segundo: a Tolerância cai uma a cada 1 s (até o mínimo)', { skip: SEM }, () => {
  const estado = { hunt: { clock: 10_000, cargasPoe: { tolerancia: { n: 3, ate: 99_000 } } } };
  const af = { tolerancia_perde_a_cada_s: 1 };
  Cargas.tique(estado, af);
  estado.hunt.clock += 1000;
  Cargas.tique(estado, af);
  assert.equal(estado.hunt.cargasPoe.tolerancia.n, 2);
  estado.hunt.clock += 1000;
  Cargas.tique(estado, af);
  assert.equal(estado.hunt.cargasPoe.tolerancia.n, 1);
});

test('o PODER PRIMORDIAL: o Golem convocado há menos de 8 s bate com o "aumentado" a mais; depois, não', { skip: SEM }, () => {
  const q = LacaiosPoe.oQueInvoca('Summon_Stone_Golem', 20, null, { 'lacaio_dano_recente:golem': 35, 'lacaio_dano_recente_s:golem': 8, minion_dmg: 20 });
  assert.equal(q.poe.danoRecentePct, 35);
  assert.equal(q.poe.danoRecenteMs, 8000);
  const l = { poe: q.poe, desde: 1000 };
  const agora = LacaiosPoe.golpeDoLacaio(l, {}, {}, 'physical', 5000, () => 0.99).fator;
  const depois = LacaiosPoe.golpeDoLacaio(l, {}, {}, 'physical', 10_000, () => 0.99).fator;
  assert.ok(Math.abs(agora - (1 + (20 + 35) / 100) / (1 + 20 / 100)) < 1e-9, `${agora}`);
  assert.equal(depois, 1);
});

test('a DEFESA IMPRUDENTE: o crítico do monstro contra você × (1 + 140%); sem a linha, o de sempre', { skip: SEM }, () => {
  const base = { chance: 0.2, fator: 1.5 };
  const ficha = { afPoe: { crit_recebido_inc: 140 } };
  // (o sorteio 0,40: acima dos 20% de sempre, abaixo dos 48% com a linha)
  assert.equal(ModsPoe.criticoDoBicho(base, {}, ficha, 0, () => 0.4).critico, true);
  assert.equal(ModsPoe.criticoDoBicho(base, {}, { afPoe: {} }, 0, () => 0.4), null, 'sem nada que mude, o crítico do bicho (null)');
});

test('as MALDIÇÕES em você pela regra do PoE: o limite de 1 (a mais nova fica), +1 com o Auto-Flagelo; a mesma maldição não acumula', { skip: SEM }, () => {
  const hunt = { clock: 0 };
  ModsPoe.amaldicoarJogador(hunt, 'vuln:a', { nome: 'Vulnerabilidade', af: { x: 1 } }, 0);
  ModsPoe.amaldicoarJogador(hunt, 'enf:b', { nome: 'Enfraquecer', af: { y: 1 } }, 100);
  assert.deepEqual(Object.keys(hunt.maldicoesNoJogador), ['enf:b'], 'o limite de 1: a mais velha sai');
  ModsPoe.amaldicoarJogador(hunt, 'enf:c', { nome: 'Enfraquecer', af: { y: 1 } }, 200);
  assert.deepEqual(Object.keys(hunt.maldicoesNoJogador), ['enf:c'], 'a mesma maldição de outro monstro troca, não acumula');
});
