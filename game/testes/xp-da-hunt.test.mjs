// A conta do XP de ponta a ponta (XP-base → fase → level → estágio → VIP → prey/pódio/online) e a
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
import { ligado as jogoOficial, catalogo as catalogoDoPoe, REGRAS as REGRAS_DO_POE } from '../systems/itens-poe/catalogo.mjs';
import { gerarPeca } from '../systems/itens-poe/gerar.mjs';
import * as JogoDoPoe from '../systems/itens-poe/jogo.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';

const FASE = { huntId: huntDoPoe('mistrock-cyclops'), dificuldade: 'facil' };

/** Um personagem na fase, com `level`/`premium`, e um Cyclops NORMAL (sem raridade) recém-nascido. */
function cenario({ level = 60, premium = false, huntId = FASE.huntId, dificuldade = FASE.dificuldade } = {}) {
  const e = personagemDeTeste({ vocacao: 'knight', level });
  e.premiumAte = premium ? Date.now() + 1e9 : 0;
  e.maxHp = e.hp = 1e9;
  assert.equal(Cacadas.entrar(e, { huntId, mode: 'auto', strategy: 'nearest', dificuldade }).ok, true);
  const m = aplicarEscala(criarMonstro({ key: 'cyclops', x: e.hunt.pos.x + 1, y: e.hunt.pos.y }, null), e.hunt.escala);
  e.hunt.monstros.push(m);
  return { e, m };
}

/** A conta escrita à mão, a partir dos dados — sem passar pelo código de produção da exp. */
function contaIndependente({ level, fatorVip, escalaExp, premium = false }) {
  const base = BESTIARY.cyclops.exp;
  const noMapa = Math.round(base * escalaExp);
  const estagio = level <= 50 ? 3 : level <= 100 ? 2 : 1;
  return Math.round(noMapa * (1 + (R.levelBonus(level) + (premium ? 10 : 0)) / 100) * fatorVip * estagio);
}

// (07/11/2026, aval do dono: "Pode reescrever") a stamina saiu: o VIP (premium) fica com o x1,5 fixo que a stamina cheia dava; o free, x1.
test('o VIP: x1,5 com premium, x1 sem — a stamina saiu, não há mais faixa de metade', () => {
  assert.equal(Stamina.fatorDeExp({ premiumAte: 0 }), 1);
  assert.equal(Stamina.fatorDeExp({ premiumAte: Date.now() + 1e9 }), 1.5);
  assert.equal(Stamina.fatorDeExp({ premiumAte: Date.now() - 1 }), 1, 'o premium vencido não vale');
});

test('XP concedido = conta independente = estimativa da ficha, com e sem VIP (Cyclops, level 60 e 30)', { skip: aAdaptar("XP concedido = conta independente vale no PoE; usa o Cyclops de uma fase do Draevor") }, () => {
  for (const level of [30, 60]) {
    {
      for (const premium of [false, true]) {
        const f = { nome: premium ? 'VIP' : 'free' };
        const { e, m } = cenario({ level, premium });
        const esperado = contaIndependente({ level, fatorVip: premium ? 1.5 : 1, escalaExp: e.hunt.escala.exp, premium });
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

test('o servidor manda o fator do VIP e o estágio para a ficha e a régua (elas não recalculam)', { skip: doClassico("Estágio de XP do Draevor (x3 até 50, x2 até 100) e escala de fase do Draevor; no PoE vale a tabela de XP do PoE (nível máx. 100)") }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 80 });
  assert.deepEqual([Boosts.paraCliente(e).fatorVip, Boosts.paraCliente(e).estagio], [1, 2]);
  e.premiumAte = Date.now() + 1e9;
  assert.equal(Boosts.paraCliente(e).fatorVip, 1.5);
});

test('caçada OFFLINE: a projeção paga o x1,5 do VIP (e os +10% do premium) — mesma conta da online', () => {
  const exp = (premium) => {
    const sorteio = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
    const original = Math.random;
    Math.random = sorteio;
    try {
      const e = personagemDeTeste({ vocacao: 'knight', level: 200 });
      e.premiumAte = premium ? Date.now() + 1e9 : 0;
      // (C — o personagem precisa SOBREVIVER aos 30 min simulados, senão a projeção, que é o que este teste mede, nem roda. Desarmado no PoE
      // ele dava ~5 a cada 2 s; desde que a raridade passou a MULTIPLICAR a velocidade de ataque do bicho do PoE (#181), os Mágicos/Raros
      // que esta semente sorteia o matavam em 51 s sem nenhum abate — antes, em 82 s com 1 abate, e o teste só comparava a exp desse abate.
      // Como na caçada offline do encontros-etapa6: vida que não acaba e, no PoE, uma arma de verdade — um Machado Vaal.)
      e.maxHp = e.hp = 1e9;
      if (jogoOficial()) {
        JogoDoPoe.iniciar(ITEM_CATALOG);
        e.equipment = { ...(e.equipment ?? {}), weapon: JogoDoPoe.pecaDoJogo(gerarPeca({ catalogo: catalogoDoPoe(), regras: REGRAS_DO_POE, base: 'Two_Hand_Axes/Vaal_Axe', raridade: 'normal', ilvl: 64, rng: () => 0.5 })) };
      }
      assert.equal(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto', strategy: 'nearest' }).ok, true);
      e.hunt.offlineDesde = Date.now() - 2 * 3_600_000;
      const r = Cacadas.simularAusencia(e, PERSONAGEM, Date.now());
      assert.equal(r.morreu, false, 'sobreviveu aos 30 min simulados');
      assert.ok(r.report.kills > 0, `caçou: ${r.report.kills} abates`);
      // (a conta da morte com os bônus deste personagem: os +10% do premium somam com os outros bônus dele, e o x1,5 multiplica)
      return { exp: r.report.exp, porMorte: Boosts.expDoBicho(e, 1_000_000) };
    } finally {
      Math.random = original;
    }
  };
  const free = exp(false);
  const vip = exp(true);
  assert.ok(free.exp > 0 && vip.exp > 0);
  const esperado = vip.porMorte / free.porMorte;
  assert.ok(esperado > 1.5, `o VIP paga ao menos x1,5 por morte: ${esperado.toFixed(3)}`);
  assert.ok(Math.abs(vip.exp / free.exp - esperado) < 0.03, `${vip.exp} / ${free.exp} = ${(vip.exp / free.exp).toFixed(3)} (esperado ${esperado.toFixed(3)})`);
});
