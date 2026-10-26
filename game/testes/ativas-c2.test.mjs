// (lote C2, dono 20/10) AS GEMAS ATIVAS DE CORPO A CORPO, IMPACTO E CANALIZAÇÃO — os contadores próprios e as cargas consumidas (o plano do grupo, as recomendações
// aceitas D2.1 a D2.7): o Esmagar Ossos e o Traumatismo (D2.1) e o pulso no atordoamento (D2.2), o do Traumatismo Complexo (zera em 10), o da Carnificina (o "mais"
// contra atordoados), o Golpe Infernal da Imolação (o debuff carregado em você e a explosão), os Martelos Sagrados e os das Espirais (as cargas — D2.3 — e as
// cascatas — D2.5), o Golpe Tectônico e o do Cataclismo (o ramo da fissura — D2.4), as Gavinhas Relampejantes e as da Excentricidade (o Pulso Mais Forte) e a
// Corrente com Gancho de Trarthus (as correntes — D2.7). Os números são os do PoE (o PoB, o poedb); os sorteios ficam travados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const C2 = await import('../systems/itens-poe/gemas-c2.mjs');
const L = await import('../systems/itens-poe/linhas-das-gemas.mjs');
const CargasPoe = await import('../systems/itens-poe/cargas.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));

/** Roda `fn` com o `Math.random` travado em `v`. */
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com a gema na arma, numa caçada; o alvo imortal colado (à direita, sem armadura) e os outros longe. */
async function montar(slug, { nivel = 20, qualidade = 20, arma = 'Two_Hand_Maces/Driftwood_Maul' } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = [GS.itemDaGema({ id: G.doSlug(slug).itemId, nivel, xp: 0, raridade: 'comum', qualidade })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(slug).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, evasao: 0, armaduraPct: -100 });
  return { e, b, resto };
}
/** Põe o bicho `m` (imortal, sem evasão e sem armadura — a conta do "mais" sem a curva da Armadura) na casa (dx, dy) de você. */
const por = (e, m, dx, dy, extra = {}) => Object.assign(m, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, evasao: 0, armaduraPct: -100, ...extra });
/** Usa a gema no alvo (com a conjuração concluída), com o sorteio travado; o relógio vai para quando o próximo uso pode sair. */
function usar(e, b, v = 0.5) {
  return travado(v, () => {
    let x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    if (e.hunt.conjurando) {
      e.hunt.clock = e.hunt.conjurando.fim;
      const fim = Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM);
      x = { ok: true, eventos: Array.isArray(fim) ? fim : fim?.eventos ?? [] };
    }
    e.hunt.clock = Math.max(e.hunt.clock, e.hunt.cooldowns?.['grupo:poe']?.ate ?? e.hunt.clock);
    return x;
  });
}
const danos = (r, b) => (r.eventos ?? []).filter((ev) => ev.t === 'dmg' && ev.uid === b.uid);
const acertos = (r, b) => danos(r, b).length;
const emVoce = (r) => (r.eventos ?? []).filter((ev) => ev.t === 'dmg' && ev.uid === 'player' && ev.golpe === 'Traumatismo').map((ev) => ev.v);

// ---------------------------------------------------------------- o status e os leitores

// (dono, 20/10 — a segunda rodada do C2: a Vinculação da Tempestade e a do Teletransporte saem de parcial com as Runas e a Explosão de Runas)
test('C2: as 13 gemas do lote saem de parcial (as linhas do PoE têm leitor)', { skip: SEM }, () => {
  for (const s of ['Boneshatter', 'Boneshatter_of_Complex_Trauma', 'Boneshatter_of_Carnage', 'Infernal_Blow_of_Immolation', 'Holy_Hammers', 'Holy_Hammers_of_Spirals', 'Tectonic_Slam', 'Tectonic_Slam_of_Cataclysm', 'Lightning_Tendrils', 'Lightning_Tendrils_of_Eccentricity', 'Chain_Hook_of_Trarthus', 'Stormbind', 'Stormbind_of_Teleportation']) {
    const r = G.REGISTRO.get(s);
    assert.deepEqual([s, r.statusNoJogo, r.motivosNoJogo], [s, 'funciona', []]);
  }
});

test('C2: os números das linhas no nível 20 e na qualidade 20 (os do PoB)', { skip: SEM }, () => {
  assert.deepEqual(G.c2DaGema('Boneshatter', 20, 20).trauma, { ganho: 1, danoProprio: 194, duracaoS: 6, maisPorPct: 7, tetoPct: Infinity, perdeEm: null });
  assert.deepEqual(G.c2DaGema('Boneshatter', 20, 0).trauma.maisPorPct, 6);
  assert.deepEqual(G.c2DaGema('Boneshatter_of_Complex_Trauma', 20, 20).trauma, { ganho: 1, danoProprio: 582, duracaoS: 6, maisPorPct: 20, tetoPct: 200, perdeEm: 10 });
  assert.deepEqual(G.c2DaGema('Boneshatter', 20, 0).pulso, { porDecimoPct: 15, maxPct: 400, raioM: 1.4 });
  assert.deepEqual(G.c2DaGema('Boneshatter_of_Carnage', 20, 0).pulso, { porDecimoPct: 20, maxPct: 400, raioM: 1.4 });
  assert.equal(G.c2DaGema('Boneshatter_of_Carnage', 20, 0).trauma, null);
  assert.deepEqual(G.c2DaGema('Infernal_Blow_of_Immolation', 20, 20).imolacao, { porCargaPct: 90, max: 6 });
  assert.deepEqual(G.c2DaGema('Holy_Hammers', 20, 20).martelos, { primeiroMaisPct: 100, cascatas: 2, lados: 2, maisAoGastarPct: 20, consome: 1, maisPorCargaPct: 0, cascataPorCarga: 0 });
  assert.deepEqual(G.c2DaGema('Holy_Hammers_of_Spirals', 20, 20).martelos, { primeiroMaisPct: 0, cascatas: 6, lados: 0, maisAoGastarPct: 0, consome: Infinity, maisPorCargaPct: 20, cascataPorCarga: 1 });
  // (dono, 20/10: o comum gasta 1 Carga de Tolerância a cada 3 usos — a descrição do PoB)
  assert.deepEqual(G.c2DaGema('Tectonic_Slam', 20, 20).fissura, { chancePct: 60, porToleranciaPct: 5, consome: 0, consomeACada: 3, maisDanoPorCargaPct: 0, maisAreaPorCargaPct: 0, chancePorCargaPct: 0 });
  assert.deepEqual(G.c2DaGema('Tectonic_Slam_of_Cataclysm', 20, 20).fissura, { chancePct: 0, porToleranciaPct: 0, consome: Infinity, consomeACada: 0, maisDanoPorCargaPct: 20, maisAreaPorCargaPct: 10, chancePorCargaPct: 10 });
  assert.deepEqual(G.c2DaGema('Lightning_Tendrils', 20, 0).pulsoForte, { cada: 3, sempreCritico: true, maisAreaPct: 0, maisDanoPct: 0 });
  assert.deepEqual(G.c2DaGema('Lightning_Tendrils_of_Eccentricity', 20, 0).pulsoForte, { cada: 5, sempreCritico: true, maisAreaPct: 150, maisDanoPct: 500 });
  assert.equal(G.c2DaGema('Lightning_Tendrils_of_Escalation', 20, 0).pulsoForte, null);
  assert.deepEqual(G.c2DaGema('Chain_Hook_of_Trarthus', 20, 20).correntes, { alvos: 11, comprimentoM: 6, max: 16, furia: 1 });
  assert.deepEqual(G.raioPorFuriaDaGema('Chain_Hook_of_Trarthus', 20), { metros: 0.1, cada: 5 });
  // (a Carnificina: o "mais" contra atordoados da qualidade é uma linha local — `linhas-das-gemas`)
  assert.deepEqual(L.atributosDasLinhas(['Mais 20 % de dano contra inimigos atordoados']).af, { 'mais_dano@alvoAtordoado': 20 });
});

test('C2: as contas puras — o Traumatismo, o pulso, a explosão, os anéis da cascata e o ramo da fissura', { skip: SEM }, () => {
  const t = G.c2DaGema('Boneshatter_of_Complex_Trauma', 20, 20).trauma;
  const hunt = {};
  for (let k = 1; k <= 9; k++) assert.deepEqual(C2.ganharTrauma(hunt, t, 1000, 6000), { n: k, dano: 582 * k });
  assert.deepEqual(C2.ganharTrauma(hunt, t, 1000, 6000), { n: 0, dano: 5820 }, 'no 10º, o dano com os 10 e zera');
  assert.equal(hunt.poeTrauma, undefined);
  // o "mais" com teto: 20% por Traumatismo, até 200%
  assert.equal(C2.fatorDoTrauma(t, 3), 1.6);
  assert.equal(C2.fatorDoTrauma(t, 15), 3);
  // cada Traumatismo com o seu fim
  const h2 = { poeTrauma: [500, 5000] };
  assert.equal(C2.traumasAgora(h2, 1000), 1);
  // o pulso: 15% por 0,1 s inteiro do atordoamento (0,35 s → 45%), até 400%
  const p = G.c2DaGema('Boneshatter', 20, 0).pulso;
  assert.deepEqual([C2.areaDoPulsoPct(p, 350), C2.areaDoPulsoPct(p, 99), C2.areaDoPulsoPct(p, 5000)], [45, 0, 400]);
  // a explosão da Imolação: o golpe × 90% × as cargas
  assert.equal(C2.pctDaExplosao({ porCargaPct: 90 }, 6), 540);
  // o anel 1 da cascata em volta de uma área de raio 1, com 1 casa de largura: a distância 2 (16 casas); o anel 2: a distância 3 (24)
  assert.equal(C2.anelDaCascata({ x: 0, y: 0 }, 1, 1, 1).length, 16);
  assert.equal(C2.anelDaCascata({ x: 0, y: 0 }, 1, 1, 2).length, 24);
  // o ramo: a primeira casa do eixo que sorteia a chance, a 45°, com metade do comprimento
  const eixo = [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }];
  assert.deepEqual(C2.ramoDaFissura(eixo, { ux: 1, uy: 0 }, 60, () => 0.1), [{ x: 2, y: 1 }, { x: 3, y: 2 }]);
  assert.deepEqual(C2.ramoDaFissura(eixo, { ux: 1, uy: 0 }, 60, () => 0.9), [], 'nenhuma casa sorteou');
  assert.equal(C2.chanceDeRamificar(G.c2DaGema('Tectonic_Slam', 20, 20).fissura, 3, 0), 75);
  assert.equal(C2.chanceDeRamificar(G.c2DaGema('Tectonic_Slam_of_Cataclysm', 20, 20).fissura, 0, 4), 40);
});

// ---------------------------------------------------------------- o Esmagar Ossos

test('C2 (D2.1): o Esmagar Ossos — golpe de alvo único; cada ataque que acerta dá 1 Traumatismo (6 s) e você sofre 194 × os Traumatismos; o dano sobe 7% por Traumatismo', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Boneshatter');
  const vizinho = por(e, resto[0], 1, 1);
  const r1 = usar(e, b);
  assert.ok(r1.ok, r1.erro);
  assert.equal(acertos(r1, b), 1);
  assert.equal(acertos(r1, vizinho), 0, 'o golpe é de alvo único (a área é a do pulso)');
  assert.deepEqual(emVoce(r1), [194]);
  assert.equal(e.hunt.poeTrauma.length, 1);
  assert.equal(e.hunt.poeTrauma[0] - 100_000, 6000);
  const d1 = danos(r1, b)[0].v;
  const r2 = usar(e, b);
  assert.deepEqual(emVoce(r2), [388], 'o segundo ganho: 194 × 2');
  const d2 = danos(r2, b)[0].v;
  assert.ok(Math.abs(d2 / d1 - 1.07) < 0.01, `o golpe com 1 Traumatismo: 7% mais (${d2} / ${d1})`);
  // depois de 6 s sem acertar, o Traumatismo acaba
  e.hunt.clock += 6_001;
  assert.equal(C2.traumasAgora(e.hunt, e.hunt.clock), 0);
});

test('C2 (D2.2): o pulso do Esmagar Ossos sai só quando o golpe atordoa, em volta do atordoado (1,4 m + 45% de área pelos 0,35 s)', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Boneshatter');
  const vizinho = por(e, resto[0], 2, 0);
  const r0 = usar(e, b);
  assert.equal(acertos(r0, vizinho), 0, 'sem atordoar, sem pulso');
  // o alvo com a vida máxima baixa é atordoado pelo golpe (o limiar é a vida máxima); o pulso acerta ele e o vizinho dele
  e.hunt.clock += 10_000;
  Object.assign(b, { maxHp: 10, estados: {} });
  const r1 = usar(e, b, 0.5);
  assert.ok(b.estados.atordoado, 'atordoou');
  assert.equal(acertos(r1, vizinho), 1, 'o pulso acertou o vizinho do atordoado');
  assert.equal(acertos(r1, b), 2, 'o atordoado leva o golpe e o pulso');
});

test('C2: o Esmagar Ossos da Carnificina — 20% mais dano contra atordoados (a qualidade 20), sem Traumatismo', { skip: SEM }, async () => {
  const { e, b } = await montar('Boneshatter_of_Carnage');
  const r0 = usar(e, b);
  assert.deepEqual(emVoce(r0), []);
  assert.equal(e.hunt.poeTrauma, undefined);
  const d0 = danos(r0, b)[0].v;
  b.estados = { atordoado: { ate: e.hunt.clock + 60_000 }, controleImuneAte: e.hunt.clock + 60_000 };
  const r1 = usar(e, b);
  const d1 = danos(r1, b)[0].v;
  assert.ok(Math.abs(d1 / d0 - 1.2) < 0.01, `contra o atordoado: 20% mais (${d1} / ${d0})`);
});

test('C2 (D2.1): o Esmagar Ossos do Traumatismo Complexo — ao chegar em 10 Traumatismos, perde todos', { skip: SEM }, async () => {
  const { e, b } = await montar('Boneshatter_of_Complex_Trauma');
  // (cada Traumatismo dura 6 s: com o tempo de ataque da maça, os 9 de antes ficam postos à mão)
  usar(e, b);
  assert.equal(e.hunt.poeTrauma.length, 1);
  e.hunt.poeTrauma = Array(9).fill(e.hunt.clock + 6000);
  const r = usar(e, b);
  assert.deepEqual(emVoce(r), [5820], 'o 10º: 582 × 10');
  assert.equal(e.hunt.poeTrauma, undefined, 'e zera');
});

// ---------------------------------------------------------------- o Golpe Infernal da Imolação

test('C2: o Golpe Infernal da Imolação — cada ataque que acerta carrega o debuff em você (3 s); com 6 cargas, explode em volta de você (o golpe × 90% × 6)', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Infernal_Blow_of_Immolation');
  const perto = por(e, resto[0], 0, 1);
  const t0 = e.hunt.clock;
  const r1 = usar(e, b);
  assert.equal(acertos(r1, perto), 0, 'o golpe é de alvo único');
  assert.deepEqual([e.hunt.poeImolacao.n, e.hunt.poeImolacao.ate - t0], [1, 3000]);
  for (let k = 2; k <= 5; k++) usar(e, b);
  assert.equal(e.hunt.poeImolacao.n, 5);
  const golpe = danos(r1, b)[0].v;
  const r6 = usar(e, b);
  assert.equal(e.hunt.poeImolacao, undefined, 'o debuff sai na 6ª carga');
  const explosao = danos(r6, perto);
  assert.equal(explosao.length, 1, 'a explosão acerta quem está em volta de você');
  assert.ok(Math.abs(explosao[0].v / golpe - 5.4) < 0.05, `o golpe × 90% × 6 (${explosao[0].v} / ${golpe})`);
});

test('C2: a Imolação que acaba antes das 6 cargas explode no tique com as que tem', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Infernal_Blow_of_Immolation');
  const perto = por(e, resto[0], 0, 1);
  usar(e, b);
  usar(e, b);
  assert.equal(e.hunt.poeImolacao.n, 2);
  e.hunt.clock = e.hunt.poeImolacao.ate;
  const ev = travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock));
  assert.equal(e.hunt.poeImolacao, undefined);
  assert.equal(ev.filter((x) => x.t === 'dmg' && x.uid === perto.uid).length, 1, 'a explosão com 2 cargas');
});

// ---------------------------------------------------------------- os Martelos Sagrados

test('C2 (D2.5): os Martelos Sagrados — o primeiro martelo com +100%; a cascata em anel enquanto acerta, até 2', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Holy_Hammers');
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  const areas = (r.eventos ?? []).filter((ev) => ev.t === 'area');
  assert.equal(areas.length, 2, 'a área do uso e o 1º anel (que não acertou ninguém: a cascata para)');
  // um inimigo no anel 1 continua a cascata até o anel 2
  e.hunt.clock += 10_000;
  const r2 = usar(e, b);
  const anel1 = (r2.eventos ?? []).filter((ev) => ev.t === 'area')[1];
  const c = anel1.casas[0];
  por(e, resto[0], anel1.x - e.hunt.pos.x + c[0], anel1.y - e.hunt.pos.y + c[1]);
  e.hunt.clock += 10_000;
  const r3 = usar(e, b);
  assert.equal((r3.eventos ?? []).filter((ev) => ev.t === 'area').length, 3, 'a área, o anel 1 (acertou) e o anel 2');
  const noAlvo = danos(r3, b)[0].v;
  const noAnel = danos(r3, resto[0])[0].v;
  assert.ok(Math.abs(noAlvo / noAnel - 2) < 0.05, `o primeiro martelo: +100% (${noAlvo} / ${noAnel})`);
});

test('C2 (D2.3): os Martelos Sagrados gastam 1 de Poder — +20% de dano (a qualidade 20) e os 2 martelos dos lados', { skip: SEM }, async () => {
  const { e, b } = await montar('Holy_Hammers');
  const r0 = usar(e, b);
  const d0 = danos(r0, b)[0].v;
  e.hunt.cargasPoe = { poder: { n: 2, ate: e.hunt.clock + 60_000 } };
  e.hunt.clock += 10_000;
  const r1 = usar(e, b);
  assert.equal(CargasPoe.ativas(e).poder, 1, 'gastou 1');
  assert.equal((r1.eventos ?? []).filter((ev) => ev.t === 'area').length, 4, 'a área, os 2 dos lados e o 1º anel');
  const d1 = danos(r1, b)[0].v;
  assert.ok(Math.abs(d1 / d0 - 1.2) < 0.02, `20% mais (${d1} / ${d0})`);
});

test('C2 (D2.3): os Martelos Sagrados das Espirais gastam todas as Cargas de Poder — 20% mais por carga (q20) e +1 cascata por carga', { skip: SEM }, async () => {
  const { e, b } = await montar('Holy_Hammers_of_Spirals');
  const r0 = usar(e, b);
  const d0 = danos(r0, b)[0].v;
  e.hunt.cargasPoe = { poder: { n: 3, ate: e.hunt.clock + 60_000 } };
  e.hunt.clock += 10_000;
  const r1 = usar(e, b);
  assert.equal(CargasPoe.ativas(e).poder, 0, 'gastou todas');
  const d1 = danos(r1, b)[0].v;
  assert.ok(Math.abs(d1 / d0 - 1.6) < 0.05, `3 × 20% mais (${d1} / ${d0} — cada parte arredondada na resistência)`);
  assert.equal(C2.cascatasDoUso(G.c2DaGema('Holy_Hammers_of_Spirals', 20, 20).martelos, 3), 9);
});

// ---------------------------------------------------------------- o Golpe Tectônico

test('C2 (D2.4): o Golpe Tectônico — o ramo a 45° da fissura (60% por casa na qualidade 20), um por fissura; as Cargas de Tolerância só são lidas', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Tectonic_Slam');
  e.hunt.cargasPoe = { tolerancia: { n: 2, ate: e.hunt.clock + 60_000 } };
  // (o sorteio em 0,1: a primeira casa do eixo abre o ramo, para o lado de cima-direita do eixo à direita)
  const r = usar(e, b, 0.1);
  assert.ok(r.ok, r.erro);
  const ramo = (r.eventos ?? []).filter((ev) => ev.t === 'area')[1];
  assert.ok(ramo, 'o ramo saiu');
  assert.equal(CargasPoe.ativas(e).tolerancia, 2, 'o 1º uso não gasta as cargas');
  // um inimigo no ramo leva o acerto dele
  const c = ramo.casas.at(-1);
  por(e, resto[0], ramo.x - e.hunt.pos.x + c[0], ramo.y - e.hunt.pos.y + c[1]);
  e.hunt.clock += 10_000;
  const r2 = usar(e, b, 0.1);
  assert.equal(acertos(r2, resto[0]), 1);
  // sem o sorteio (0,7: a chance é de 60% + 2 × 5% = 70%), sem ramo
  e.hunt.clock += 10_000;
  const r3 = usar(e, b, 0.7);
  assert.equal((r3.eventos ?? []).filter((ev) => ev.t === 'area').length, 1);
});

test('C2 (D2.3): o Golpe Tectônico do Cataclismo consome todas as Cargas de Tolerância — 20% mais Dano por carga (q20)', { skip: SEM }, async () => {
  const { e, b } = await montar('Tectonic_Slam_of_Cataclysm');
  const r0 = usar(e, b);
  const d0 = danos(r0, b)[0].v;
  e.hunt.cargasPoe = { tolerancia: { n: 2, ate: e.hunt.clock + 60_000 } };
  e.hunt.clock += 10_000;
  const r1 = usar(e, b);
  assert.ok(r1.ok, r1.erro);
  assert.equal(CargasPoe.ativas(e).tolerancia, 0, 'consumiu todas');
  const d1 = danos(r1, b)[0].v;
  assert.ok(Math.abs(d1 / d0 - 1.4) < 0.02, `2 × 20% mais (${d1} / ${d0})`);
});

// ---------------------------------------------------------------- as Gavinhas Relampejantes

test('C2: as Gavinhas Relampejantes — o 3º pulso seguido é o Pulso Mais Forte, sempre crítico', { skip: SEM }, async () => {
  const { e, b } = await montar('Lightning_Tendrils', { arma: 'Wands/Driftwood_Wand', qualidade: 0 });
  // (o sorteio em 0,3: nenhum crítico natural)
  const crit = [1, 2, 3, 4, 5, 6].map(() => danos(usar(e, b, 0.3), b).some((ev) => ev.crit));
  assert.deepEqual(crit, [false, false, true, false, false, true]);
});

test('C2: as Gavinhas Relampejantes da Excentricidade — o 5º pulso seguido: crítico, 500% mais dano e 150% mais área', { skip: SEM }, async () => {
  const { e, b } = await montar('Lightning_Tendrils_of_Eccentricity', { arma: 'Wands/Driftwood_Wand', qualidade: 0 });
  // (o sorteio em 0,3: nenhum crítico natural, e a fração da área a mais vira casa)
  const rs = [1, 2, 3, 4, 5].map(() => usar(e, b, 0.3));
  const d = rs.map((r) => danos(r, b)[0]);
  assert.deepEqual(d.map((x) => !!x.crit), [false, false, false, false, true]);
  const mult = Ficha.combate(e).critMultiplier ?? 1.5;
  assert.ok(d[4].v / d[3].v > 6 * mult * 0.95, `× 6 × o multiplicador do crítico (${d[4].v} / ${d[3].v})`);
  const casas = (r) => (r.eventos ?? []).filter((ev) => ev.t === 'area')[0]?.casas.length ?? 0;
  assert.ok(casas(rs[4]) > casas(rs[3]), 'a área maior');
});

// ---------------------------------------------------------------- a Corrente com Gancho de Trarthus

test('C2 (D2.7): a Corrente com Gancho de Trarthus — prende os acertados; o acerto num preso dá 1 de Fúria; longe demais, a corrente arrebenta com o golpe em volta dele', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Chain_Hook_of_Trarthus', { arma: 'One_Hand_Maces/Driftwood_Club' });
  const r1 = usar(e, b);
  assert.ok(r1.ok, r1.erro);
  assert.deepEqual(e.hunt.poeCorrentes.map((c) => c.uid), [b.uid]);
  const furia0 = e.hunt.furia?.n ?? 0;
  usar(e, b);
  assert.equal((e.hunt.furia?.n ?? 0) - furia0, 1, 'o acerto no preso: +1 de Fúria');
  // o preso a 4 casas (mais que os 6 m da corrente): ela arrebenta e o golpe acerta em volta dele
  const vizinho = por(e, resto[0], 5, 0);
  Object.assign(b, { x: e.hunt.pos.x + 4, y: e.hunt.pos.y });
  const ev = travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock));
  assert.equal(e.hunt.poeCorrentes, undefined, 'a corrente arrebentou');
  assert.equal(ev.filter((x) => x.t === 'dmg' && x.uid === b.uid).length, 1);
  assert.equal(ev.filter((x) => x.t === 'dmg' && x.uid === vizinho.uid).length, 1);
});

// ---------------------------------------------------------------- (dono, 20/10) o Golpe Tectônico gasta a cada 3 usos

test('C2 (dono 20/10): o Golpe Tectônico comum gasta 1 Carga de Tolerância a cada 3 usos ("every third time you slam" — o PoB)', { skip: SEM }, async () => {
  const { e, b } = await montar('Tectonic_Slam');
  e.hunt.cargasPoe = { tolerancia: { n: 3, ate: e.hunt.clock + 600_000 } };
  const restam = [1, 2, 3, 4, 5, 6].map(() => { usar(e, b); return CargasPoe.ativas(e).tolerancia; });
  assert.deepEqual(restam, [3, 3, 2, 2, 2, 1]);
});

// ---------------------------------------------------------------- (dono, 20/10) a Vinculação da Tempestade e a Explosão de Runas

/** As runas da Vinculação na caçada. */
const runas = (e) => (e.hunt.poeObjetos ?? []).filter((o) => o.tipo === 'runa_tempestade');
/** Um tique das plantadas (onde a Explosão de Runas sai, sozinha), 200 ms depois. */
const tique = (e, v = 0.5) => { e.hunt.clock += 200; return travado(v, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock)); };
const danoEm = (ev, b) => ev.filter((x) => x.t === 'dmg' && x.uid === b.uid).reduce((t, x) => t + x.v, 0);

test('C2 (dono 20/10): os números das Runas e da Explosão de Runas (o PoB e o poedb)', { skip: SEM }, () => {
  const r = G.c2DaGema('Stormbind', 20, 20).runas;
  assert.deepEqual([r.duracaoMs, r.nivelMax, r.maisDanoPorNivelPct, r.maisAreaPorNivelPct, r.raioM, r.tolhePct, r.explosaoMs, r.manaPorMelhoria, r.teleporta], [12000, 3, 100, 40, 1.6, 50, 160, 24, false]);
  assert.equal(G.c2DaGema('Stormbind', 1, 0).runas.manaPorMelhoria, 5);
  assert.equal(G.c2DaGema('Stormbind_of_Teleportation', 20, 0).runas.teleporta, true);
  // o custo da Explosão (o PoB: 6 no nível 1, 18 no 20, 26 no 40)
  assert.deepEqual([C2.custoDaExplosao(1), C2.custoDaExplosao(20), C2.custoDaExplosao(40)], [6, 18, 26]);
  // a próxima runa: a casa do alvo, depois a mais perto dela sem runa
  assert.deepEqual(C2.casaDaProximaRuna({ x: 5, y: 5 }, []), { x: 5, y: 5 });
  assert.deepEqual(C2.casaDaProximaRuna({ x: 5, y: 5 }, [{ x: 5, y: 5 }]), { x: 4, y: 4 });
  // a melhoria: as mais antigas abaixo do nível 3, uma vez cada; a cadeia: as ligadas a 1 casa
  const rs = [{ desde: 1, nivel: 3, x: 0, y: 0 }, { desde: 2, nivel: 0, x: 1, y: 0 }, { desde: 3, nivel: 0, x: 2, y: 0 }, { desde: 4, nivel: 0, x: 9, y: 9 }];
  assert.deepEqual(C2.melhorarRunas(rs, 2).map((x) => x.desde), [2, 3]);
  assert.deepEqual(C2.cadeiaDeRunas(rs, rs[0]).map((x) => x.desde), [1, 2, 3]);
  assert.ok(Math.abs(C2.raioDaRunaM({ raioM: 1.6, maisAreaPorNivelPct: 30 }, 3) - 1.6 * Math.sqrt(1.9)) < 1e-9);
});

test('C2 (dono 20/10): a Vinculação espalha runas (sem dano no uso); a Explosão de Runas melhora pelos 24 de mana gasta e detona em cadeia', { skip: SEM }, async () => {
  const { e, b } = await montar('Stormbind', { arma: 'Wands/Driftwood_Wand', qualidade: 0 });
  const r1 = usar(e, b);
  assert.ok(r1.ok, r1.erro);
  assert.equal(acertos(r1, b), 0, 'o uso da canalização não acerta: espalha a runa');
  assert.deepEqual(runas(e).map((o) => [o.x - e.hunt.pos.x, o.y - e.hunt.pos.y, o.nivel]), [[1, 0, 0]]);
  assert.equal(runas(e)[0].ate - runas(e)[0].desde, 12_000);
  // a segunda runa na casa vizinha do alvo (o padrão crescente)
  usar(e, b);
  assert.equal(runas(e).length, 2);
  // a Explosão de Runas canaliza: 18 de mana por uso; a cada 24, a runa mais antiga abaixo do nível 3 melhora (6 melhorias: 144 de mana, 8 usos); depois detona
  const mana0 = e.mana;
  const ev = [];
  for (let k = 0; k < 40 && runas(e).length; k++) ev.push(...tique(e));
  assert.equal(runas(e).length, 0, 'as duas detonaram (a cadeia)');
  assert.equal(mana0 - e.mana, 18 * 8);
  assert.equal(ev.filter((x) => x.t === 'dmg' && x.uid === b.uid).length, 2, 'as duas runas acertam o alvo (cada runa é um acerto)');
});

test('C2 (dono 20/10): a runa no nível 3 causa 4× o dano da runa sem melhoria (+100% por nível)', { skip: SEM }, async () => {
  const dano = async (nivel) => {
    const { e, b } = await montar('Stormbind', { arma: 'Wands/Driftwood_Wand', qualidade: 0 });
    usar(e, b);
    runas(e)[0].nivel = nivel;
    // (sem mana, a Explosão não canaliza: detona já)
    e.mana = 0;
    return danoEm(tique(e), b);
  };
  const d0 = await dano(0);
  const d3 = await dano(3);
  assert.ok(d0 > 0 && Math.abs(d3 / d0 - 4) < 0.1, `nível 3: 4× (${d3} / ${d0})`);
});

// (o Tolhimento é a lentidão do jogo, com o teto dela — `estados.lento.maximo`, 40%: os 50% do PoE ficam em 40, como o Tolhimento dos objetos do A3b)
test('C2 (dono 20/10): o inimigo em cima da runa é Tolhido (−50% de movimento, no teto de 40% da lentidão do jogo)', { skip: SEM }, async () => {
  const { e, b } = await montar('Stormbind', { arma: 'Wands/Driftwood_Wand', qualidade: 0 });
  usar(e, b);
  for (const o of runas(e)) o.nivel = 3;
  // (o alvo longe da explosão não: a runa fica, e ele em cima dela)
  e.hunt.clock += 200;
  travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock));
  // (lote C4, com o aval do dono 21/10: o Tolhimento é o estado próprio `tolhido` — só de movimento e sem o teto de 40% do `lento`: a runa Tolhe os 50% inteiros)
  assert.equal(b.estados.tolhido?.pct, 50);
});

test('C2 (dono 20/10): a Vinculação do Teletransporte leva você à runa detonada se você não detonou há 0,5 s', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Stormbind_of_Teleportation', { arma: 'Wands/Driftwood_Wand', qualidade: 0 });
  // (a runa a 3 casas, sem bicho em cima; o alvo ao lado dela)
  por(e, b, 3, 0);
  usar(e, b);
  const r = runas(e)[0];
  Object.assign(r, { x: e.hunt.pos.x + 3, y: e.hunt.pos.y + 1, nivel: 3 });
  void resto;
  tique(e);
  assert.deepEqual([e.hunt.pos.x, e.hunt.pos.y], [r.x, r.y]);
  assert.equal(runas(e).length, 0);
});
