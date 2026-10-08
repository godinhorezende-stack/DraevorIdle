// A conta do XP de ponta a ponta (XP-base → fase → level → estágio → stamina → prey/pódio/online) e a
// estimativa que a ficha do monstro mostra (`estimarExpDoBicho`): a MESMA cadeia da morte, só uma vez.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Boosts from '../systems/boosts.mjs';
import * as Stamina from '../systems/stamina.mjs';
import * as R from '../systems/regras.mjs';
import { criarMonstro, BESTIARY } from '../systems/hunt/monstros.mjs';
import { aplicarEscala, escalaDaFase } from '../systems/campanha.mjs';
import { matarMonstro, estimarExpDoBicho } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE, huntDoPoe } from './apoio.mjs';
import { aAdaptar, doClassico } from './apoio-migracao.mjs';

const H = (h, m = 0) => h * 60 + m;
const FASE = { huntId: huntDoPoe('mistrock-cyclops'), dificuldade: 'facil' };

/** Um personagem na fase, com `stamina`/`level`/`premium`, e um Cyclops NORMAL (sem raridade) recém-nascido. */
function cenario({ level = 60, stamina = Stamina.TETO, premium = false, huntId = FASE.huntId, dificuldade = FASE.dificuldade } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level });
  e.premiumAte = premium ? Date.now() + 1e9 : 0;
  e.stamina = stamina;
  e.maxHp = e.hp = 1e9;
  assert.equal(Cacadas.entrar(e, { huntId, mode: 'auto', strategy: 'nearest', dificuldade }).ok, true);
  e.stamina = stamina; // `entrar` não mexe, mas o contrato do teste é este
  const m = aplicarEscala(criarMonstro({ key: 'cyclops', x: e.hunt.pos.x + 1, y: e.hunt.pos.y }, null), e.hunt.escala);
  e.hunt.monstros.push(m);
  return { e, m };
}

/** A conta escrita à mão, a partir dos dados — sem passar pelo código de produção da exp. */
function contaIndependente({ level, fatorStamina, escalaExp, premium = false }) {
  const base = BESTIARY.cyclops.exp;
  const noMapa = Math.round(base * escalaExp);
  const estagio = level <= 50 ? 3 : level <= 100 ? 2 : 1;
  return Math.round(noMapa * (1 + (R.levelBonus(level) + (premium ? 10 : 0)) / 100) * fatorStamina * estagio);
}

const FAIXAS = [
  { nome: 'cheia (42h)', stamina: H(42), sem: 1, com: 1.5 },
  { nome: 'quase cheia (41h)', stamina: H(41), sem: 1, com: 1.5 },
  { nome: 'logo acima de 39h', stamina: H(39, 1), sem: 1, com: 1.5 },
  { nome: 'exatamente 39h', stamina: H(39), sem: 1, com: 1 },
  { nome: 'intermediária (25h)', stamina: H(25), sem: 1, com: 1 },
  { nome: 'logo acima de 14h', stamina: H(14, 1), sem: 1, com: 1 },
  { nome: 'exatamente 14h', stamina: H(14), sem: 0.5, com: 0.5 },
  { nome: 'baixa (5h)', stamina: H(5), sem: 0.5, com: 0.5 },
  { nome: 'mínima para caçar (1 min)', stamina: 1, sem: 0.5, com: 0.5 },
];

test('as faixas de stamina: x1,5 só ACIMA de 39h e COM premium; x1 no meio; x0,5 em 14h ou menos — nunca metade com stamina quase cheia', () => {
  for (const f of FAIXAS) {
    assert.equal(Stamina.fatorDeExp({ stamina: f.stamina, premiumAte: 0 }), f.sem, `${f.nome} sem premium`);
    assert.equal(Stamina.fatorDeExp({ stamina: f.stamina, premiumAte: Date.now() + 1e9 }), f.com, `${f.nome} com premium`);
  }
});

test('XP concedido = conta independente = estimativa da ficha, em cada faixa de stamina (Cyclops, level 60 e 30)', { skip: aAdaptar("XP concedido = conta independente vale no PoE; usa o Cyclops de uma fase do Draevor") }, () => {
  for (const level of [30, 60]) {
    for (const f of FAIXAS) {
      for (const premium of [false, true]) {
        const { e, m } = cenario({ level, stamina: f.stamina, premium });
        const esperado = contaIndependente({ level, fatorStamina: premium ? f.com : f.sem, escalaExp: e.hunt.escala.exp, premium });
        const estimativa = estimarExpDoBicho(e, e.hunt, 'cyclops').final;
        const eventos = [];
        matarMonstro(e, e.hunt, PERSONAGEM, m, eventos);
        const concedido = eventos.find((x) => x.t === 'kill').exp;
        assert.equal(concedido, esperado, `L${level} ${f.nome}${premium ? ' +premium' : ''}: concedido`);
        assert.equal(estimativa, concedido, `L${level} ${f.nome}${premium ? ' +premium' : ''}: a ficha promete o que a morte paga`);
      }
    }
  }
});

test('o ESTÁGIO de level: x3 até o 50, x2 até o 100, x1 depois — passar do 100 corta o XP pela metade (é esperado)', { skip: doClassico("Estágio de XP do Draevor (x3 até 50, x2 até 100) e escala de fase do Draevor; no PoE vale a tabela de XP do PoE (nível máx. 100)") }, () => {
  const xp = (level) => {
    const { e, m } = cenario({ level });
    const ev = [];
    matarMonstro(e, e.hunt, PERSONAGEM, m, ev);
    return ev.find((x) => x.t === 'kill').exp;
  };
  const bonus = (l) => 1 + R.levelBonus(l) / 100;
  // Mesmo bônus de level (25% no 100 e no 101): a diferença é SÓ o estágio.
  assert.equal(R.levelBonus(100), R.levelBonus(101));
  assert.ok(Math.abs(xp(101) / xp(100) - 0.5) < 0.02, `100→101: ${xp(100)} → ${xp(101)}`);
  assert.equal(Boosts.estagioDeExp(50), 3);
  assert.equal(Boosts.estagioDeExp(51), 2);
  assert.equal(Boosts.estagioDeExp(101), 1);
  assert.ok(bonus(50) > 0);
});

test('a escala da FASE: o Cyclops da Mistrock vale 150 no bestiário e outro número na fase (e a ficha mostra os dois)', { skip: doClassico("Estágio de XP do Draevor (x3 até 50, x2 até 100) e escala de fase do Draevor; no PoE vale a tabela de XP do PoE (nível máx. 100)") }, () => {
  const { e } = cenario({ level: 60 });
  const r = estimarExpDoBicho(e, e.hunt, 'cyclops');
  assert.equal(r.base, 150, 'o XP-base do bestiário não muda');
  assert.ok(r.escalaDaFase < 1 && r.naFase < 150, `Fácil: a fase paga menos que a base (${r.naFase})`);
  // A prévia do seletor de hunt: sem caçada, a escala vem da fase e da dificuldade ESCOLHIDAS.
  const previa = estimarExpDoBicho(e, null, 'cyclops', { huntId: huntDoPoe('mistrock-cyclops'), dificuldade: 'medio' });
  assert.equal(previa.escalaDaFase, escalaDaFase(huntDoPoe('mistrock-cyclops'), 'medio').exp);
  assert.ok(previa.escalaDaFase > 1, 'no Médio a fase paga MAIS que a base');
  const fora = estimarExpDoBicho(e, null, 'cyclops');
  assert.equal(fora.escalaDaFase, 1, 'fora de caçada não há escala de fase');
  assert.equal(fora.naFase, 150);
});

test('o servidor manda o fator de stamina e o estágio para a ficha e a régua (elas não recalculam)', { skip: doClassico("Estágio de XP do Draevor (x3 até 50, x2 até 100) e escala de fase do Draevor; no PoE vale a tabela de XP do PoE (nível máx. 100)") }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 80 });
  e.stamina = H(10);
  assert.deepEqual([Boosts.paraCliente(e).fatorStamina, Boosts.paraCliente(e).estagio], [0.5, 2]);
  e.stamina = H(41);
  e.premiumAte = Date.now() + 1e9;
  assert.equal(Boosts.paraCliente(e).fatorStamina, 1.5);
});

test('caçada OFFLINE: a projeção segue a faixa da stamina (14h ou menos paga metade) — mesma conta da online', () => {
  const exp = (stamina) => {
    const sorteio = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
    const original = Math.random;
    Math.random = sorteio;
    try {
      const e = personagemDeTeste({ vocacao: 'knight', level: 200 });
      e.stamina = stamina;
      assert.equal(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto', strategy: 'nearest' }).ok, true);
      e.stamina = stamina;
      e.hunt.offlineDesde = Date.now() - 2 * 3_600_000;
      return Cacadas.simularAusencia(e, PERSONAGEM, Date.now()).report.exp;
    } finally {
      Math.random = original;
    }
  };
  const cheia = exp(H(30));
  const baixa = exp(H(8));
  assert.ok(cheia > 0 && baixa > 0);
  assert.ok(Math.abs(baixa / cheia - 0.5) < 0.03, `${baixa} / ${cheia} = ${(baixa / cheia).toFixed(3)} (esperado 0,5)`);
});
