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
