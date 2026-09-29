// A caçada offline consolidada em segundo plano (`consolidacao-offline.mjs`,
// `Cacadas.consolidarAusencia`): em pedaços tem de dar o MESMO que de uma vez
// na volta; a morte no meio chega no login; e a regravação nunca passa por
// cima de quem mexeu no personagem no meio (nem de quem está no jogo).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as Cacadas from '../systems/cacadas.mjs';
import * as B from '../database/banco.mjs';
import * as SimulacaoOffline from '../systems/simulacao-offline.mjs';
import * as Consolidacao from '../systems/consolidacao-offline.mjs';
import { vivas } from '../websocket/sessao.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

after(() => SimulacaoOffline.encerrar());

const MIN = 60_000;
const HORA = 60 * MIN;

/** Math.random com semente: as duas maneiras de avançar veem os mesmos sorteios. */
function comSemente(semente, fn) {
  const original = Math.random;
  let s = semente >>> 0;
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

/** Um knight caçando na troll-cave, que saiu (aba fechada) em `saida`. */
function cacandoOffline(saida) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 200 });
  assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto', strategy: 'nearest' }).ok, true);
  e.hunt.offlineDesde = saida;
  return e;
}

/** Como no banco: a caçada compacta, em JSON, e lida de volta. */
function peloBanco(e) {
  const volta = JSON.parse(JSON.stringify({ ...e, hunt: Cacadas.huntParaGravar(e.hunt) }));
  Cacadas.huntAoCarregar(volta.hunt);
  return volta;
}

test('em pedaços depois dos 30 min simulados: soma o mesmo que projetar tudo na volta', () => {
  const T0 = Date.UTC(2026, 8, 29, 3, 0, 0);
  const deUmaVez = comSemente(7, () => {
    const e = cacandoOffline(T0);
    const r = Cacadas.simularAusencia(e, PERSONAGEM, T0 + 3 * HORA);
    return { xp: e.xp, report: r.report, morreu: r.morreu };
  });
  const emPedacos = comSemente(7, () => {
    let e = cacandoOffline(T0);
    // O primeiro pedaço já passa dos 30 min: a parte simulada é UMA só, igual à da volta.
    for (const quando of [40 * MIN, 75 * MIN, 2 * HORA]) {
      const r = Cacadas.consolidarAusencia(e, PERSONAGEM, T0 + quando);
      assert.equal(r.avancou, true, `não avançou aos ${quando / MIN} min`);
      assert.ok(e.hunt.offlineDesde > T0, 'continua ausente, com o ponto andando');
      e = peloBanco(e);
    }
    const r = Cacadas.simularAusencia(e, PERSONAGEM, T0 + 3 * HORA);
    return { xp: e.xp, report: r.report, morreu: r.morreu, hunt: e.hunt };
  });
  assert.equal(deUmaVez.morreu, false);
  assert.equal(emPedacos.morreu, false);
  assert.ok(deUmaVez.report.exp > 0, 'a caçada rendeu exp');
  // Só o arredondamento de cada pedaço de projeção (`Math.round`) separa os dois.
  assert.ok(Math.abs(emPedacos.xp - deUmaVez.xp) <= 3, `xp: ${emPedacos.xp} × ${deUmaVez.xp}`);
  assert.ok(Math.abs(emPedacos.report.exp - deUmaVez.report.exp) <= 3, `relatório: ${emPedacos.report.exp} × ${deUmaVez.report.exp}`);
  assert.ok(Math.abs(emPedacos.report.kills - deUmaVez.report.kills) <= 3, `mortes: ${emPedacos.report.kills} × ${deUmaVez.report.kills}`);
  // A volta fecha a ausência: nada pendurado.
  assert.equal(emPedacos.hunt.offlineDesde, undefined);
  assert.equal(emPedacos.hunt.ausencia, undefined);
});

test('pedaços DENTRO dos 30 min simulados: o tique continua de onde parou, e o total fecha', () => {
  const T0 = Date.UTC(2026, 8, 29, 3, 0, 0);
  const deUmaVez = comSemente(11, () => {
    const e = cacandoOffline(T0);
    Cacadas.simularAusencia(e, PERSONAGEM, T0 + 2 * HORA);
    return e.xp;
  });
  const emPedacos = comSemente(11, () => {
    let e = cacandoOffline(T0);
    for (const quando of [12 * MIN, 25 * MIN, 50 * MIN]) {
      Cacadas.consolidarAusencia(e, PERSONAGEM, T0 + quando);
      e = peloBanco(e);
    }
    Cacadas.simularAusencia(e, PERSONAGEM, T0 + 2 * HORA);
    return e.xp;
  });
  // Aqui a parte simulada atravessa a gravação: pequenas diferenças de estado
  // (o que o JSON não leva) podem mudar um sorteio. Tolerância de 5%.
  const ganhoUm = deUmaVez;
  assert.ok(Math.abs(emPedacos - ganhoUm) / ganhoUm <= 0.05, `xp: ${emPedacos} × ${ganhoUm}`);
});

test('morreu num pedaço: não avança mais, e o login aplica a morte', () => {
  const T0 = Date.UTC(2026, 8, 29, 3, 0, 0);
  const e = personagemDeTeste({ vocacao: 'knight', level: 8 });
  assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto', strategy: 'nearest' }).ok, true);
  e.hunt.offlineDesde = T0;
  e.hp = 1;
  e.maxHp = 1;
  const r1 = Cacadas.consolidarAusencia(e, PERSONAGEM, T0 + 20 * MIN);
  assert.equal(r1.morreu, true, 'com 1 de vida, tinha de morrer');
  const xpNaMorte = e.xp;
  const r2 = Cacadas.consolidarAusencia(e, PERSONAGEM, T0 + 2 * HORA);
  assert.equal(r2.avancou, false, 'depois de morrer, nada avança');
  assert.equal(e.xp, xpNaMorte);
  const volta = Cacadas.simularAusencia(e, PERSONAGEM, T0 + 3 * HORA);
  assert.equal(volta.morreu, true, 'o login fica sabendo');
});

// ------------------------------------------------------------ banco

async function ausenteNoBanco(horasFora) {
  const c = await B.criarConta({ email: `consolida-${randomUUID()}@teste.local`, senha: 'senha-123' });
  const nome = `Cons${randomUUID().replace(/[^a-z]/g, '').slice(0, 8)}`;
  const e = cacandoOffline(Date.now() - horasFora * HORA);
  const p = await B.criarPersonagem({ conta: c.id, nome, vocacao: 'knight', sexo: 'male', estadoInicial: { ...e, hunt: Cacadas.huntParaGravar(e.hunt) } });
  const linha = await B.banco.prepare('SELECT id, conta, nome, vocacao, estado FROM personagens WHERE id = ?').get(p.id);
  return { c, p, nome, linha, xpAntes: e.xp };
}

test('consolidarUm: grava o avanço, ainda ausente, com o ganho no dia de hoje', async (t) => {
  const { p, linha, xpAntes } = await ausenteNoBanco(2);
  t.after(() => B.excluirPersonagem(p.id));
  const agora = Date.now();
  assert.equal(await Consolidacao.consolidarUm(linha, agora), 'gravado');
  const depois = JSON.parse((await B.banco.prepare('SELECT estado FROM personagens WHERE id = ?').get(p.id)).estado);
  assert.ok(depois.xp > xpAntes, 'o xp subiu no banco');
  assert.ok(depois.hunt.offlineDesde >= agora - 1000, 'o ponto da ausência andou até agora');
  assert.ok(depois.hunt.ausencia, 'o relatório da ausência segue guardado para o login');
  // A régua do ranking do dia: o ganho conta hoje (`site.mjs`, xp − expDoDia.xp).
  assert.ok(depois.xp - depois.expDoDia.xp > 0, 'o ranking do dia vê o ganho');
});

test('consolidarUm: alguém mexeu no personagem no meio — desiste, sem passar por cima', async (t) => {
  const { p, linha } = await ausenteNoBanco(2);
  t.after(() => B.excluirPersonagem(p.id));
  // Uma transferência chega antes da regravação.
  const mexido = JSON.parse(linha.estado);
  mexido.bank = (mexido.bank ?? 0) + 12345;
  await B.regravarEstadoPersonagem(p.id, mexido);
  assert.equal(await Consolidacao.consolidarUm(linha, Date.now()), 'mudou');
  const agoraNoBanco = JSON.parse((await B.banco.prepare('SELECT estado FROM personagens WHERE id = ?').get(p.id)).estado);
  assert.equal(agoraNoBanco.bank, mexido.bank, 'a transferência ficou');
});

test('consolidarUm: quem está no jogo não é mexido', async (t) => {
  const { p, nome, linha } = await ausenteNoBanco(2);
  t.after(() => {
    vivas.delete(nome);
    return B.excluirPersonagem(p.id);
  });
  vivas.set(nome, { personagem: { nome } });
  assert.equal(await Consolidacao.consolidarUm(linha, Date.now()), 'no-jogo');
  const igual = (await B.banco.prepare('SELECT estado FROM personagens WHERE id = ?').get(p.id)).estado;
  assert.equal(igual, linha.estado);
});

// ------------------------------------------------------------ colunas-índice, stamina, tempo, online

import { colunasDaCacaOffline, AUSENCIA_MAXIMA_MS } from '../database/caca-offline.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Ausentes from '../systems/ausentes.mjs';

test('colunas: fora de caçada nada; caçando, até o que vier antes — 12 h ou o fim da stamina; acabou, sem "até"', () => {
  assert.deepEqual(colunasDaCacaOffline({ hunt: null }), [null, null]);
  const T0 = 1_000_000_000_000;
  const cheia = { stamina: 2520, hunt: { offlineDesde: T0 } };
  assert.deepEqual(colunasDaCacaOffline(cheia), [T0, T0 + AUSENCIA_MAXIMA_MS]);
  const pouca = { stamina: 90, hunt: { offlineDesde: T0 } };
  assert.deepEqual(colunasDaCacaOffline(pouca), [T0, T0 + 90 * MIN]);
  // O teto conta da SAÍDA (ausencia.inicio), não do último pedaço.
  const noMeio = { stamina: 2520, hunt: { offlineDesde: T0 + 5 * HORA, ausencia: { inicio: T0 } } };
  assert.deepEqual(colunasDaCacaOffline(noMeio), [T0 + 5 * HORA, T0 + AUSENCIA_MAXIMA_MS]);
  assert.deepEqual(colunasDaCacaOffline({ stamina: 100, hunt: { offlineDesde: T0, ausencia: { inicio: T0, morreu: true } } }), [T0, null]);
  assert.deepEqual(colunasDaCacaOffline({ stamina: 0, hunt: { offlineDesde: T0, ausencia: { inicio: T0, semStamina: true } } }), [T0, null]);
});

test('o tempo caçando offline CONTA inteiro (não só os 30 min simulados), e a stamina gasta junto', () => {
  const T0 = Date.UTC(2026, 8, 29, 3);
  const e = cacandoOffline(T0);
  e.stamina = 2520;
  const tempoAntes = Ficha.totais(e).time;
  Cacadas.simularAusencia(e, PERSONAGEM, T0 + 3 * HORA);
  const contou = Ficha.totais(e).time - tempoAntes;
  assert.ok(Math.abs(contou - 3 * 3600) <= 60, `tempo caçando: ${Math.round(contou)} s de ${3 * 3600}`);
  assert.ok(Math.abs(e.stamina - (2520 - 180)) <= 1, `stamina: ${e.stamina} (esperado ~${2520 - 180})`);
});

test('acabou a stamina: a caçada offline para ali, e no login ele está na cidade', () => {
  const T0 = Date.UTC(2026, 8, 29, 3);
  const e = cacandoOffline(T0);
  e.stamina = 60; // uma hora
  const tempoAntes = Ficha.totais(e).time;
  const r = Cacadas.consolidarAusencia(e, PERSONAGEM, T0 + 2 * HORA);
  assert.equal(r.semStamina, true, 'a consolidação vê que acabou');
  assert.equal(colunasDaCacaOffline(e)[1], null, 'e ele sai da fila e do número de online');
  const xpParado = e.xp;
  assert.equal(Cacadas.consolidarAusencia(e, PERSONAGEM, T0 + 4 * HORA).avancou, false, 'nada mais avança');
  assert.equal(e.xp, xpParado);
  const volta = Cacadas.simularAusencia(e, PERSONAGEM, T0 + 5 * HORA);
  assert.equal(volta.semStamina, true);
  assert.equal(e.hunt, null, 'voltou para a cidade');
  assert.match(volta.report.motivo, /stamina acabou/);
  assert.ok(e.stamina <= 0.01, `stamina: ${e.stamina}`);
  const contou = Ficha.totais(e).time - tempoAntes;
  assert.ok(Math.abs(contou - 3600) <= 60, `caçou ${Math.round(contou)} s — deveria ser a hora de stamina`);
});

test('stamina caindo abaixo de 14 h: a exp projetada daí em diante vale metade', () => {
  const T0 = Date.UTC(2026, 8, 29, 3);
  const cheia = comSemente(23, () => {
    const e = cacandoOffline(T0);
    e.stamina = 2000;
    const x0 = e.xp;
    Cacadas.simularAusencia(e, PERSONAGEM, T0 + 3 * HORA);
    return e.xp - x0;
  });
  const cansada = comSemente(23, () => {
    const e = cacandoOffline(T0);
    e.stamina = 900; // 15 h: cruza as 14 h (840) uma hora depois de sair
    const x0 = e.xp;
    Cacadas.simularAusencia(e, PERSONAGEM, T0 + 3 * HORA);
    return e.xp - x0;
  });
  // Mesma parte simulada (fator 1 nas duas); projeção: cheia 2,5 h x1; cansada 0,5 h x1 + 2 h x0,5.
  // Em unidades de 30 min: cheia 1 + 5 = 6; cansada 1 + 1 + 4 x 0,5 = 4.
  const razao = cansada / cheia;
  assert.ok(Math.abs(razao - 4 / 6) <= 0.02, `razão ${razao.toFixed(3)} (esperado ~0,667): ${cansada} × ${cheia}`);
});

test('banco: toda gravação leva as colunas; a rodada ignora quem já acabou', async (t) => {
  const vivo = await ausenteNoBanco(2);
  const c = await B.criarConta({ email: `acabou-${randomUUID()}@teste.local`, senha: 'senha-123' });
  const acabou = cacandoOffline(Date.now() - 3 * HORA);
  acabou.stamina = 0;
  acabou.hunt.ausencia = { inicio: acabou.hunt.offlineDesde, semStamina: true, parouEm: acabou.hunt.offlineDesde };
  const pAcabou = await B.criarPersonagem({ conta: c.id, nome: `Fim${randomUUID().replace(/[^a-z]/g, '').slice(0, 8)}`, vocacao: 'knight', sexo: 'male', estadoInicial: { ...acabou, hunt: Cacadas.huntParaGravar(acabou.hunt) } });
  t.after(async () => {
    await B.excluirPersonagem(vivo.p.id);
    await B.excluirPersonagem(pAcabou.id);
  });
  const colunas = (id) => B.banco.prepare('SELECT caca_offline_desde AS desde, caca_offline_ate AS ate, estado FROM personagens WHERE id = ?').get(id);
  const doVivo = await colunas(vivo.p.id);
  assert.ok(doVivo.desde > 0 && doVivo.ate > doVivo.desde, 'criar grava as colunas');
  const doFim = await colunas(pAcabou.id);
  assert.equal(doFim.ate, null, 'quem acabou fica sem "até"');
  await Consolidacao.rodada(Date.now());
  assert.equal((await colunas(pAcabou.id)).estado, doFim.estado, 'a rodada não mexeu em quem acabou');
  const depois = await colunas(vivo.p.id);
  assert.ok(depois.desde > doVivo.desde, 'a rodada avançou o ausente e as colunas andaram junto');
  // Fora de caçada (voltou para a cidade): as colunas zeram na gravação.
  const naCidade = JSON.parse(depois.estado);
  naCidade.hunt = null;
  await B.gravarEstadoPersonagem(vivo.p.id, naCidade);
  const zerado = await colunas(vivo.p.id);
  assert.equal(zerado.desde, null);
  assert.equal(zerado.ate, null);
});

test('online: quem caça de aba fechada conta; quem está conectado não conta duas vezes', async (t) => {
  const { p, nome } = await ausenteNoBanco(1);
  t.after(() => {
    vivas.delete(nome);
    return B.excluirPersonagem(p.id);
  });
  Ausentes.ligar(vivas);
  await Ausentes.atualizar(Date.now());
  assert.ok(Ausentes.agora().some((a) => a.nome === nome), 'ausente caçando entra na lista');
  const antes = Ausentes.contagem();
  vivas.set(nome, { personagem: { nome } });
  assert.equal(Ausentes.contagem(), antes - 1, 'conectado: sai da conta dos ausentes (já conta como conectado)');
});
