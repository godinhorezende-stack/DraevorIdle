// A ORGANIZAÇÃO da Loot Bag (dono, 10/10): a AFINIDADE das caixas do depósito, o "Mover Currency" (toda moeda → as caixas de Currency) e o
// "Mover Orbs" (os "Orbe …" → as caixas de Orbs ou a mochila) — sem perder nem duplicar, e o que não couber fica na bolsa —, o CADEADO das
// pilhas e a LIMPEZA que respeita o cadeado e os Únicos; e a sacola do chefe, que NÃO passa pelo filtro (vai inteira para o baú).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Bolsa = await import('../systems/bolsa.mjs');
const Deposito = await import('../systems/deposito.mjs');
const MoedasPoe = await import('../systems/itens-poe/moedas.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Mapas = await import('../systems/itens-poe/mapas.mjs');
const { vitoriaNoBoss } = await import('../systems/hunt/combate.mjs');

const CAOS = MoedasPoe.idDa('Chaos_Orb');
const EXALTADO = MoedasPoe.idDa('Exalted_Orb');
const SABEDORIA = MoedasPoe.idDa('Scroll_of_Wisdom');

function quem() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 50 });
  Bolsa.garantir(e);
  Deposito.garantir(e);
  e.pouch = [];
  return e;
}
const caixa = (e, indice) => e.deposito.find((c) => c.indice === indice);
/** Quantas unidades de `id` há em todo lugar (bolsa, mochila, caixas): nada pode sumir nem duplicar. */
const total = (e, id) => [...e.pouch, ...(e.inventory ?? []), ...e.deposito.flatMap((c) => c.itens)].filter((p) => p.id === id).reduce((n, p) => n + (p.count ?? 1), 0);

test('Currency x Orbs: toda moeda do PoE é currency; os "Orbe …" são Orbs', { skip: SEM }, () => {
  assert.ok(CAOS && EXALTADO && SABEDORIA, 'as moedas do teste existem');
  assert.equal(MoedasPoe.ehMoeda(SABEDORIA), true);
  assert.equal(MoedasPoe.ehOrbe(SABEDORIA), false, 'o Pergaminho é currency, não Orb');
  assert.equal(MoedasPoe.ehOrbe(CAOS), true);
  assert.equal(MoedasPoe.ehOrbe(915001), true, 'o Orbe do Joalheiro também');
  assert.equal(MoedasPoe.ehMoeda(7000001), false, 'peça de equipar não é moeda');
  assert.equal(MoedasPoe.MOEDAS.filter((m) => MoedasPoe.ehOrbe(m.itemId)).length, 58);
});

test('a afinidade é das caixas numeradas: Currency, Orbs ou nenhuma (as Chegadas não)', { skip: SEM }, () => {
  const e = quem();
  assert.ok(Deposito.comando(e, { action: 'afinidade', caixa: 2, afinidade: 'currency' }).ok);
  assert.equal(caixa(e, 2).afinidade, 'currency');
  assert.ok(Deposito.comando(e, { action: 'afinidade', caixa: 2, afinidade: null }).ok);
  assert.equal(caixa(e, 2).afinidade, undefined);
  assert.match(Deposito.comando(e, { action: 'afinidade', caixa: 2, afinidade: 'joias' }).erro, /desconhecida/);
  assert.match(Deposito.comando(e, { action: 'afinidade', caixa: Deposito.INDICE_DAS_CHEGADAS, afinidade: 'orbs' }).erro, /numeradas/);
  // Gravado com o personagem.
  Deposito.comando(e, { action: 'afinidade', caixa: 5, afinidade: 'orbs' });
  const lido = JSON.parse(JSON.stringify(e));
  Deposito.garantir(lido);
  assert.equal(caixa(lido, 5).afinidade, 'orbs');
});

test('Mover Currency: toda moeda vai para as caixas de Currency; o que não cabe fica na bolsa; nada some nem duplica', { skip: SEM }, () => {
  const e = quem();
  const PECA = Jogo.mapaSorteado(1, { raridade: 'normal' });
  e.pouch = [{ id: CAOS, count: 12 }, { id: SABEDORIA, count: 40 }, PECA, { id: EXALTADO, count: 2 }];
  // Sem caixa de Currency: recusa, e a bolsa fica como estava.
  const antes = structuredClone(e.pouch);
  assert.match(Deposito.moverMoedasDaBolsa(e, { tipo: 'currency' }).erro, /afinidade Currency/);
  assert.deepEqual(e.pouch, antes);
  // Uma caixa de Currency com uma vaga só (e um Caos já guardado: empilha nele).
  Deposito.comando(e, { action: 'afinidade', caixa: 3, afinidade: 'currency' });
  caixa(e, 3).itens = [{ id: CAOS, count: 5 }, ...Array.from({ length: caixa(e, 3).teto - 2 }, (_, k) => ({ id: 8000000 + k, count: 1 }))];
  const r = Deposito.moverMoedasDaBolsa(e, { tipo: 'currency' });
  assert.ok(r.ok, r.erro);
  assert.equal(caixa(e, 3).itens.find((p) => p.id === CAOS).count, 17, 'o Caos empilhou no que já estava lá');
  assert.ok(caixa(e, 3).itens.some((p) => p.id === SABEDORIA), 'o Pergaminho ocupou a última vaga');
  assert.deepEqual(e.pouch.map((p) => p.id), [PECA.id, EXALTADO], 'a peça de equipar não é moeda; o Exaltado não coube');
  assert.match(r.notice, /1 ficaram na bolsa: sem espaço/);
  for (const [id, n] of [[CAOS, 17], [SABEDORIA, 40], [EXALTADO, 2]]) assert.equal(total(e, id), n, `${id}: nem some nem duplica`);
  // Uma segunda caixa de Currency: o resto vai.
  Deposito.comando(e, { action: 'afinidade', caixa: 4, afinidade: 'currency' });
  assert.ok(Deposito.moverMoedasDaBolsa(e, { tipo: 'currency' }).ok);
  assert.deepEqual(e.pouch.map((p) => p.id), [PECA.id]);
  assert.equal(total(e, EXALTADO), 2);
});

test('Mover Orbs: só os Orbs, para as caixas de Orbs — ou para a mochila, se for a regra do jogador (e mochila cheia não perde nada)', { skip: SEM }, () => {
  const e = quem();
  e.pouch = [{ id: CAOS, count: 3 }, { id: SABEDORIA, count: 10 }, { id: EXALTADO, count: 1 }];
  Deposito.comando(e, { action: 'afinidade', caixa: 6, afinidade: 'orbs' });
  const r = Deposito.moverMoedasDaBolsa(e, { tipo: 'orbs' });
  assert.ok(r.ok, r.erro);
  assert.deepEqual(caixa(e, 6).itens.map((p) => p.id).sort(), [CAOS, EXALTADO].sort());
  assert.deepEqual(e.pouch.map((p) => p.id), [SABEDORIA], 'o Pergaminho não é Orb: fica');
  // Para a mochila.
  const f = quem();
  f.settings.destinoDosOrbs = 'mochila';
  f.inventory = [];
  f.pouch = [{ id: CAOS, count: 3 }, { id: SABEDORIA, count: 10 }];
  assert.ok(Deposito.moverMoedasDaBolsa(f, { tipo: 'orbs' }).ok);
  assert.equal(f.inventory.filter((p) => p.id === CAOS).reduce((n, p) => n + p.count, 0), 3);
  assert.deepEqual(f.pouch.map((p) => p.id), [SABEDORIA]);
  // Mochila cheia: recusa e nada sai da bolsa.
  const g = quem();
  g.settings.destinoDosOrbs = 'mochila';
  g.inventory = Array.from({ length: 40 }, (_, k) => ({ id: 8100000 + k, count: 1 }));
  g.pouch = [{ id: CAOS, count: 3 }];
  assert.match(Deposito.moverMoedasDaBolsa(g, { tipo: 'orbs' }).erro, /mochila está cheia/);
  assert.deepEqual(g.pouch, [{ id: CAOS, count: 3 }]);
});

test('o CADEADO: em qualquer item (dono, 10/10), liga e desliga, e a limpeza não tira o que tem cadeado nem os Únicos', { skip: SEM }, () => {
  const e = quem();
  const unico = Jogo.mapaSorteado(2, { raridade: 'normal' });
  unico.poe = { ...unico.poe, raridade: 'unico' };
  const comum = Jogo.mapaSorteado(3, { raridade: 'normal' });
  e.pouch = [{ id: CAOS, count: 9 }, { id: SABEDORIA, count: 4 }, unico, comum];
  // Dono, 10/10: o cadeado vale para QUALQUER item (antes só moeda/Orb). Liga e desliga na peça comum.
  assert.ok(Bolsa.travar(e, { i: 3, id: comum.id }).ok);
  assert.equal(e.pouch[3].trava, true);
  assert.ok(Bolsa.travar(e, { i: 3, id: comum.id }).ok);
  assert.equal(e.pouch[3].trava, undefined);
  assert.match(Bolsa.travar(e, { i: 0, id: SABEDORIA }).erro, /mudou/);
  assert.ok(Bolsa.travar(e, { i: 0, id: CAOS }).ok);
  assert.equal(e.pouch[0].trava, true);
  // Gravado com o personagem.
  assert.equal(JSON.parse(JSON.stringify(e)).pouch[0].trava, true);
  // A limpeza "em massa" (tudo marcado): só o Pergaminho e a peça comum saem.
  const fora = e.pouch.map((p, i) => ({ i, id: p.id }));
  const r = Bolsa.limparBolsa(e, { fora });
  assert.ok(r.ok);
  assert.match(r.notice, /2 itens protegidos ficaram/);
  assert.deepEqual(e.pouch.map((p) => p.id), [CAOS, unico.id]);
  // Só protegidos marcados: nada sai, e diz por quê.
  assert.match(Bolsa.limparBolsa(e, { fora: e.pouch.map((p, i) => ({ i, id: p.id })) }).erro, /protegidos/);
  assert.equal(e.pouch.length, 2);
  // Destravar: aí sai.
  assert.ok(Bolsa.travar(e, { i: 0, id: CAOS }).ok);
  assert.equal(e.pouch[0].trava, undefined);
  assert.ok(Bolsa.limparBolsa(e, { fora: [{ i: 0, id: CAOS }] }).ok);
  assert.deepEqual(e.pouch.map((p) => p.id), [unico.id]);
  // A pilha travada que sai inteira para o depósito leva a moeda, não o cadeado (lá não há limpeza).
  const f = quem();
  f.pouch = [{ id: CAOS, count: 2, trava: true }];
  Deposito.comando(f, { action: 'afinidade', caixa: 1, afinidade: 'currency' });
  assert.ok(Deposito.moverMoedasDaBolsa(f, { tipo: 'currency' }).ok);
  assert.deepEqual(caixa(f, 1).itens, [{ id: CAOS, count: 2 }]);
});

test('a SACOLA do chefe NÃO passa pelo filtro (dono, 10/10: "vai direto para o baú do boss"): moeda do "Não coletar", peça abaixo do "Só Único" e o mapa vêm', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 70 });
  Bolsa.garantir(e);
  for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  // O filtro recusando TUDO: todas as moedas e os mapas no "Não coletar", e só Únicos de peça.
  e.itemRules.noLoot = [...MoedasPoe.MOEDAS.map((m) => m.itemId), ...Mapas.bases().map((b) => b.itemId)];
  e.settings = { ...e.settings, guardarRaridadePoe: 3 };
  const sala = () => ({ huntId: 'x', isBoss: true, bossId: null, campanha: { bossDoAto: 10, dificuldade: 'facil', ato: 10 }, monstros: [], clock: 0 });
  // O sorteio com SEMENTE fixa: sem ela, umas rodadas não soltavam peça nenhuma em 15 vitórias e o teste dependia da sorte.
  const aleatorio = Math.random;
  let semente = 20261010;
  Math.random = () => ((semente = (semente * 1664525 + 1013904223) >>> 0) / 4294967296);
  try {
    for (let k = 0; k < 15; k++) vitoriaNoBoss(e, sala(), { key: 'demon', name: 'Kitava', loot: [], uid: k + 1, hp: 0, maxHp: 1 }, PERSONAGEM);
  } finally {
    Math.random = aleatorio;
  }
  const itens = e.rewards.flatMap((s) => s.itens);
  assert.equal(itens.filter((p) => Mapas.ehMapa(p)).length, 15, 'o T1 garantido do Kitava vem sempre, mesmo no "Não coletar"');
  assert.ok(itens.some((p) => MoedasPoe.ehMoeda(p.id)), 'as moedas do boss vêm, mesmo no "Não coletar"');
  const equipamento = itens.filter((p) => p.poe && !Mapas.ehMapa(p));
  assert.ok(equipamento.some((p) => p.poe.raridade !== 'unico'), `peça abaixo do "Só Único" também vem: ${equipamento.map((p) => p.poe.raridade).join(', ')}`);
});

test('a bolsa organizada: "Proteger seleção" põe e tira o cadeado de várias; "Mover seleção" leva para a mochila sem duplicar e sem o cadeado', { skip: SEM }, () => {
  const e = quem();
  e.inventory = [];
  const mapa = Jogo.mapaSorteado(2, { raridade: 'normal' });
  const peca = Jogo.pecaSorteada(30, () => 0.5);
  e.pouch = [{ id: CAOS, count: 9 }, mapa, { id: SABEDORIA, count: 4 }, peca];
  // Proteger várias de uma vez (as que ainda batem com a bolsa); a que não bate fica de fora.
  const r = Bolsa.travar(e, { lista: [{ i: 1, id: mapa.id }, { i: 3, id: peca.id }, { i: 2, id: CAOS }], valor: true });
  assert.ok(r.ok);
  assert.match(r.notice, /2 itens com cadeado/);
  assert.deepEqual(e.pouch.map((p) => !!p.trava), [false, true, false, true]);
  assert.ok(Bolsa.travar(e, { lista: [{ i: 1, id: mapa.id }], valor: false }).ok);
  assert.equal(e.pouch[1].trava, undefined);
  assert.match(Bolsa.travar(e, { lista: [{ i: 9, id: CAOS }], valor: true }).erro, /mudou/);
  // Mover a seleção: o mapa, a peça travada e o Pergaminho vão para a mochila; o Caos fica.
  const antes = [CAOS, SABEDORIA].map((id) => total(e, id));
  const m = Bolsa.moverSelecao(e, { itens: [{ i: 1, id: mapa.id }, { i: 2, id: SABEDORIA }, { i: 3, id: peca.id }] });
  assert.ok(m.ok, m.erro);
  assert.match(m.notice, /3 itens foram para a mochila/);
  assert.deepEqual(e.pouch.map((p) => p.id), [CAOS]);
  assert.deepEqual([CAOS, SABEDORIA].map((id) => total(e, id)), antes, 'nada some nem duplica');
  const naMochila = e.inventory.find((p) => p.id === peca.id);
  assert.deepEqual(naMochila.poe, peca.poe, 'a peça vai inteira, com os mods');
  assert.equal(naMochila.trava, undefined, 'o cadeado é da bolsa: na mochila ele sai');
  assert.ok(e.inventory.some((p) => p.id === mapa.id));
  assert.match(Bolsa.moverSelecao(e, { itens: [] }).erro, /Nada marcado/);
  assert.match(Bolsa.moverSelecao(e, { itens: [{ i: 0, id: SABEDORIA }] }).erro, /mudou/);
});

test('o botão "Depósito" das seções: Orbs nas caixas de Orbs, moedas nas de Currency, o resto nas comuns; peça inteira, sem cadeado; caixa cheia fica na bolsa', { skip: SEM }, () => {
  const e = quem();
  Deposito.comando(e, { action: 'afinidade', caixa: 1, afinidade: 'currency' });
  Deposito.comando(e, { action: 'afinidade', caixa: 2, afinidade: 'orbs' });
  const peca = Jogo.pecaSorteada(30, () => 0.5);
  const mapa = Jogo.mapaSorteado(2, { raridade: 'normal' });
  e.pouch = [{ id: CAOS, count: 5 }, { id: SABEDORIA, count: 7 }, { ...peca, trava: true }, mapa];
  const antes = [CAOS, SABEDORIA].map((id) => total(e, id));
  const r = Bolsa.moverSelecao(e, { para: 'deposito', itens: e.pouch.map((p, i) => ({ i, id: p.id })) });
  assert.ok(r.ok, r.erro);
  assert.match(r.notice, /4 itens foram para o depósito/);
  assert.deepEqual(e.pouch, []);
  assert.deepEqual(caixa(e, 2).itens, [{ id: CAOS, count: 5 }], 'o Orbe vai para a caixa de Orbs');
  assert.deepEqual(caixa(e, 1).itens, [{ id: SABEDORIA, count: 7 }], 'a outra moeda vai para a de Currency');
  const comum = caixa(e, 0).itens;
  assert.deepEqual(comum.map((p) => p.id), [peca.id, mapa.id], 'o resto vai para a primeira caixa sem afinidade');
  assert.deepEqual(comum[0].poe, peca.poe, 'a peça vai inteira');
  assert.equal(comum[0].trava, undefined, 'sem o cadeado');
  assert.deepEqual([CAOS, SABEDORIA].map((id) => total(e, id)), antes, 'nada some nem duplica');
  // Sem caixa de afinidade, a moeda vai para a comum; caixas comuns cheias: fica na bolsa e diz.
  const f = quem();
  f.pouch = [{ id: CAOS, count: 2 }];
  assert.ok(Bolsa.moverSelecao(f, { para: 'deposito', itens: [{ i: 0, id: CAOS }] }).ok);
  assert.ok(f.deposito.some((c) => !c.afinidade && c.itens.some((p) => p.id === CAOS)));
  const g = quem();
  for (const c of g.deposito) if (!c.chegadas) c.itens = Array.from({ length: c.teto ?? 100 }, (_, k) => ({ id: 8200000 + k, count: 1 }));
  g.pouch = [{ ...peca }];
  assert.match(Bolsa.moverSelecao(g, { para: 'deposito', itens: [{ i: 0, id: peca.id }] }).erro, /cheias/);
  assert.equal(g.pouch.length, 1);
});
