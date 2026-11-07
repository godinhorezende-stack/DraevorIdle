// (07/11/2026 — o dono: "tire a stamina, caça offline para free 4 horas, para vip 12 horas. depois que bater o personagem sai da caça" e
// "Onde tem Stamina ali coloca Experiência e Lv Divino depois no LV 100") o limite da caça offline, o x1,5 do VIP, a Stamina Extension
// sem uso e o Lv Divino (a exp depois do level máximo: +1 ponto de passiva por nível, cada um pede 10% a mais).
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !Catalogo.ligado() && 'só no modo PoE (a curva de level do PoE)';
const R = await import('../systems/regras.mjs');
const LvDivino = await import('../systems/lv-divino.mjs');
const Stamina = await import('../systems/stamina.mjs');
const Arvore = await import('../systems/passivas/arvore.mjs');
const Morte = await import('../systems/morte.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const { colunasDaCacaOffline, limiteDoOffline, HORAS_DO_OFFLINE } = await import('../database/caca-offline.mjs');
const { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } = await import('./apoio.mjs');

const HORA = 3_600_000;
const T0 = Date.UTC(2026, 10, 7, 3);

test('o limite da caça offline: 4 h free, 12 h VIP — pelo premium na saída', () => {
  assert.deepEqual(HORAS_DO_OFFLINE, { free: 4, vip: 12 });
  assert.equal(limiteDoOffline({}, T0), 4 * HORA);
  assert.equal(limiteDoOffline({ premiumAte: T0 + 1 }, T0), 12 * HORA);
  assert.equal(limiteDoOffline({ premiumAte: T0 - 1 }, T0), 4 * HORA, 'o premium que já tinha acabado na saída não vale');
});

test('as colunas da caça offline: até o limite contado da saída; bateu o limite ou morreu, sem "até"', () => {
  assert.deepEqual(colunasDaCacaOffline({ hunt: null }), [null, null]);
  assert.deepEqual(colunasDaCacaOffline({ hunt: { offlineDesde: T0 } }), [T0, T0 + 4 * HORA]);
  assert.deepEqual(colunasDaCacaOffline({ premiumAte: T0 + 1, hunt: { offlineDesde: T0 } }), [T0, T0 + 12 * HORA]);
  // (o limite guardado na ausência manda: o premium que acabou no meio não corta a caça do VIP)
  assert.deepEqual(colunasDaCacaOffline({ hunt: { offlineDesde: T0 + HORA, ausencia: { inicio: T0, limiteMs: 12 * HORA } } }), [T0 + HORA, T0 + 12 * HORA]);
  assert.deepEqual(colunasDaCacaOffline({ hunt: { offlineDesde: T0, ausencia: { inicio: T0, esgotou: true } } }), [T0, null]);
  assert.deepEqual(colunasDaCacaOffline({ hunt: { offlineDesde: T0, ausencia: { inicio: T0, morreu: true } } }), [T0, null]);
});

/** Caçando offline desde `T0`, com a parte simulada (os 30 min) já feita: o resto é a projeção — sem sorteio, sem morte. */
function jaSimulado(e) {
  assert.equal(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto', strategy: 'nearest' }).ok, true);
  const h = e.hunt;
  const sessao = JSON.parse(JSON.stringify(h.sessao));
  const base = { ...JSON.parse(JSON.stringify(sessao)), exp: 1000, kills: 10, gold: 0, lootValue: 0, supplies: 0 };
  h.ausencia = { inicio: T0, principal: sessao, fora: JSON.parse(JSON.stringify(sessao)), base, morreu: false, morreuEm: null, projetadoAte: T0 + 30 * 60_000, limiteMs: limiteDoOffline(e, T0) };
  h.offlineDesde = T0 + 30 * 60_000;
  return e;
}

test('bateu o limite: a caçada offline para ali (exp até as 4 h) e no login o personagem está na cidade', { skip: SEM }, () => {
  const e = jaSimulado(personagemDeTeste({ vocacao: 'knight', level: 60 }));
  const x0 = e.xp;
  const r = Cacadas.consolidarAusencia(e, PERSONAGEM, T0 + 6 * HORA);
  assert.equal(r.esgotou, true);
  assert.equal(colunasDaCacaOffline(e)[1], null, 'sai da fila e do número de online');
  // 3,5 h projetadas no ritmo de 1000 exp a cada 30 min = 7000 (e não as 5,5 h até o login)
  assert.equal(e.xp - x0, 7000);
  assert.equal(Cacadas.consolidarAusencia(e, PERSONAGEM, T0 + 8 * HORA).avancou, false, 'nada mais avança');
  const volta = Cacadas.simularAusencia(e, PERSONAGEM, T0 + 9 * HORA);
  assert.equal(volta.esgotou, true);
  assert.equal(e.hunt, null, 'voltou para a cidade');
  assert.match(volta.report.motivo, /4 horas de caça offline/);
});

test('o VIP caça 12 h; e voltando ANTES do limite, a caçada segue e o relógio recomeça na próxima saída', { skip: SEM }, () => {
  const vip = jaSimulado(Object.assign(personagemDeTeste({ vocacao: 'knight', level: 60 }), { premiumAte: T0 + 24 * HORA }));
  vip.hunt.ausencia.limiteMs = limiteDoOffline(vip, T0);
  const x0 = vip.xp;
  const r = Cacadas.consolidarAusencia(vip, PERSONAGEM, T0 + 6 * HORA);
  assert.ok(!r.esgotou, 'com 6 h, o VIP ainda caça');
  assert.equal(vip.xp - x0, 11_000);
  const free = jaSimulado(personagemDeTeste({ vocacao: 'knight', level: 60 }));
  const volta = Cacadas.simularAusencia(free, PERSONAGEM, T0 + 2 * HORA);
  assert.ok(!volta.esgotou);
  assert.ok(free.hunt, 'logou antes das 4 h: segue caçando');
  assert.equal(free.hunt.ausencia, undefined, 'a ausência fechou: a próxima saída começa um relógio novo');
});

test('a stamina saiu: o VIP fica com o x1,5 fixo, o free x1; a Stamina Extension fica sem uso', () => {
  assert.equal(Stamina.fatorDeExp({}), 1);
  assert.equal(Stamina.fatorDeExp({ premiumAte: Date.now() + HORA }), 1.5);
  assert.equal(Stamina.usarExtension().ok, false);
});

test('o Lv Divino: libera no 100; o 1º pede a exp do 99→100 e cada um seguinte 10% a mais', { skip: SEM }, () => {
  const max = R.levelMaximo();
  const primeiro = R.expForLevel(max) - R.expForLevel(max - 1);
  assert.equal(LvDivino.expDoPrimeiro(), primeiro);
  assert.equal(LvDivino.expDoNivel(2), Math.round(primeiro * 1.1));
  assert.deepEqual(LvDivino.divino({ level: max - 1, xp: R.expForLevel(max - 1) }).liberado, false);
  const no100 = R.expForLevel(max);
  assert.equal(LvDivino.divino({ level: max, xp: no100 }).nivel, 0);
  assert.equal(LvDivino.divino({ level: max, xp: no100 + primeiro - 1 }).nivel, 0);
  assert.equal(LvDivino.divino({ level: max, xp: no100 + primeiro }).nivel, 1);
  assert.equal(LvDivino.divino({ level: max, xp: no100 + primeiro + LvDivino.expDoNivel(2) }).nivel, 2);
  const meio = LvDivino.divino({ level: max, xp: no100 + primeiro + LvDivino.expDoNivel(2) / 2 });
  assert.equal(meio.nivel, 1);
  assert.ok(Math.abs(meio.percent - 0.5) < 1e-6, String(meio.percent));
});

test('o Lv Divino dá +1 ponto de passiva por nível; a morte não tira um Lv Divino', { skip: SEM }, () => {
  const max = R.levelMaximo();
  const e = personagemDeTeste({ vocacao: 'knight', level: max });
  e.xp = R.expForLevel(max);
  const antes = Arvore.pontos(e).total;
  e.xp = LvDivino.expNoComeco(3) + 10;
  assert.equal(Arvore.pontos(e).total - antes, 3);
  // a perda da morte para no começo do Lv Divino 3 (só os 10 de exp passados dele)
  assert.equal(LvDivino.pisoDaExp(e), LvDivino.expNoComeco(3));
  assert.equal(Morte.conta(e).expPerdida, 10);
});
