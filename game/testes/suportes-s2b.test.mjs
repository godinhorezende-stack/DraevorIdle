// (lote S2B, 27/10) A SEGUNDA METADE DAS PARCIAIS DOS SUPORTES (a fila S2B): os de lacaio (a Velocidade do Lacaio, o Exemplar, a Carne Fresca, o Exército Elemental, o Escudo de
// Carne, o Frenesi Faminto), os buffs em você (a Fúria Arcana, a Inervação), as Ressonâncias (a Trindade, a Tríade Profana), a Gula, a Intensidade Sobrecarregada, os
// Feitiços (o Passe Enfeitiçado, o Toque Maldito Desperto, o Propagar Feitiço, a Destruição Iminente) e a Explosão Prismática. Os sorteios ficam travados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const { personagemDeTeste } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const S2B = await import('../systems/itens-poe/suportes-s2b.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Reforcos = await import('../systems/skills/reforcos.mjs');
const QuemFeriu = await import('../systems/hunt/quem-feriu.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Terreno = await import('../systems/hunt/terreno.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { resistenciaEfetivaDe } = await import('../systems/hunt/resistencia.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
function travado(v, fn) {
  const antes = Math.random;
  Math.random = typeof v === 'function' ? v : () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
const TAGS = (...t) => ({ tags: t.map((x) => `poe:${x}`) });
const TODAS = TAGS('Magia', 'Ataque', 'Projétil', 'Área', 'Corpo a Corpo', 'Fogo', 'Gelo', 'Raio', 'Caos', 'Físico', 'Lacaio');
const ef = (slug, nivel = 20, q = 20, tags = TODAS) => SP.efeitoNoNivel(slug, nivel, q, tags).efeito;
/** O personagem com as gemas na arma, numa caçada; o alvo colado e os outros longe. */
async function montar(slugs, { arma = 'One_Hand_Swords/Rusted_Sword', nivel = 20, qualidade = 0 } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: slugs.length, links: Array(Math.max(0, slugs.length - 1)).fill(true), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: doSlug(s).itemId, nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < slugs.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(slugs[0]).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
  return { e, b, resto };
}
/** Usa a gema do slot 0 no alvo `b` (com a conjuração concluída); devolve os eventos. */
function usar(e, b, v = 0.5) {
  const eventos = [];
  const r = travado(v, () => Acoes.disparar(e, e.hunt, { nome: 'T' }, 0, b, { manual: true }));
  assert.ok(r.ok, JSON.stringify(r));
  eventos.push(...(r.eventos ?? []));
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(travado(v, () => Acoes.concluirConjuracao(e, e.hunt, { nome: 'T' })) ?? [])); }
  return eventos;
}
const bicho = (extra = {}) => ({ uid: 'b' + Math.random(), name: 'Alvo', x: 10, y: 10, z: 0, hp: 1000, maxHp: 1000, estados: {}, dots: [], ...extra });
const invocar = (slug, efeito = null) => LacaiosPoe.oQueInvoca(slug, 20, { nivel: 20, qualidade: 0, ...(efeito ?? {}) }, {});

const FEITOS = ['Unholy_Trinity_Support', 'Arcane_Surge_Support', 'Prismatic_Burst_Support', 'Exemplar_Support', 'Fresh_Meat_Support', 'Minion_Speed_Support', 'Trinity_Support',
  'Elemental_Army_Support', 'Feeding_Frenzy_Support', 'Impending_Doom_Support', 'Innervate_Support', 'Hex_Bloom_Support', 'Awakened_Hextouch_Support', 'Gluttony_Support',
  'Hexpass_Support', 'Overloaded_Intensity_Support'];
test('S2B: os suportes feitos saem de "parcial"; o Escudo de Carne fica só com os Defensivos e o Predador com a Presa', { skip: SEM }, () => {
  const falhas = FEITOS.filter((s) => SP.doSlug(s)?.status !== 'funciona').map((s) => `${s}: ${SP.doSlug(s)?.status} ${(SP.doSlug(s)?.motivos ?? []).join(' | ')}`);
  assert.deepEqual(falhas, [], falhas.join('\n'));
  // (lote D3, dono 27/10 — aval do dono: os Defensivos do Escudo de Carne e a Presa do Predador foram feitos, os dois saem sem motivos)
  assert.deepEqual(SP.doSlug('Meat_Shield_Support').motivos, []);
  assert.equal(SP.doSlug('Predator_Support').motivos.length, 0, SP.doSlug('Predator_Support').motivos.join(' | '));
});

test('S2B: os números no nível 20 (Excepcionais no 3), com a qualidade 20 — e o que deixou de ir para a suportada', { skip: SEM }, () => {
  assert.deepEqual([ef('Minion_Speed_Support').lacaioVelAtaquePct, ef('Minion_Speed_Support').lacaioVelConjPct, ef('Minion_Speed_Support').lacaioMovPct], [34, 34, 54]);
  const ex = ef('Exemplar_Support');
  assert.deepEqual([ex.exemplarCritIncPor, ex.exemplarCritIncMax, ex.exemplarMultPor, ex.exemplarMultMax, ex.lacaioCritIncPct], [40, 200, 20, 100, 20]);
  const cf = ef('Fresh_Meat_Support');
  assert.deepEqual([cf.carneFrescaPct, cf.carneFrescaMaxMs, cf.furiaDespertaCrit, cf.furiaDespertaMult, cf.lacaioCritIncPct], [10, 10000, 3.9, 69, 20]);
  const ea = ef('Elemental_Army_Support');
  assert.deepEqual([ea.lacaioResPct, ea.lacaioResMaxPct, ea.lacaioExposicaoPct, ea.lacaioMaisElementalPct, ea.lacaioDanoPct], [29, 4, 10, 19, undefined], 'o "mais Dano Elemental" não é mais o aumentado de todo o dano');
  const ms = ef('Meat_Shield_Support');
  assert.deepEqual([ms.lacaioProvocarPct, ms.lacaioMenosDanoRecebidoPct, ms.lacaioMaisPertoDeVocePct, ms.lacaioDanoPct], [20, 29, 30, undefined], '24% + 5% da qualidade no mesmo "menos"');
  const ff = ef('Feeding_Frenzy_Support');
  assert.deepEqual([ff.frenesiFamintoPct, ff.frenesiFamintoMs, ff.lacaioAgressivo], [44, 5900, 1]);
  const ar = ef('Arcane_Surge_Support');
  assert.deepEqual([ar.furiaArcanaLimiar, ar.furiaArcanaCastPct, ar.furiaArcanaRegenPct, ar.furiaArcanaMs, ar.furiaArcanaMaisMagicoPct, ar.maisDanoMagicoPct], [400, 30, 30, 4000, 35, undefined], 'o "35% mais" só com a Fúria Arcana');
  const iv = ef('Innervate_Support');
  assert.deepEqual([iv.inervacao, iv.inervacaoMin, iv.inervacaoMax, iv.inervacaoMs], [1, 8, 145, 10000], '8 s + 2 s da qualidade');
  assert.deepEqual([ef('Trinity_Support').trindadeMaisPor5, ef('Trinity_Support').trindadePen], [3, 16]);
  const up = ef('Unholy_Trinity_Support', 3);
  assert.deepEqual([up.profanaMaisPor10, up.profanaIgnoraResPct, up.profanaIgnoraFisicoPct, up.maisDanoPct], [7, 90, 90, undefined], 'o +7% escala com a menor Ressonância (antes, 7% fixo)');
  const gl = ef('Gluttony_Support', 3);
  assert.deepEqual([gl.gulaPorUso, gl.gulaLimite, gl.regurgitaMs, gl.regurgitaProjeteis], [1, 10, 4000, 7]);
  const oi = ef('Overloaded_Intensity_Support', 3);
  assert.deepEqual([oi.sobrecargaMs, oi.sobrecargaPerda, oi.sobrecargaCritPor, oi.sobrecargaMultPor], [10000, 6, 1.4, 50]);
  assert.deepEqual([ef('Hexpass_Support', 3).feiticoAfetaAProva, ef('Hexpass_Support', 3).amaldicoadoSemCritico, ef('Hexpass_Support', 3).areaMaldicaoPct], [1, 1, -20]);
  assert.equal(ef('Awakened_Hextouch_Support').feiticoAfetaAProvaPct, 34);
  assert.deepEqual([ef('Hex_Bloom_Support').feiticoTransfereM, ef('Hex_Bloom_Support').feiticoTransfereIncPct], [3, 32], '28% + 4% da qualidade');
  // (a Explosão Prismática e a Destruição Iminente: os números são da magia ativada — antes o "100% menos Dano" zerava a suportada e a recarga/qualidade iam para ela)
  const pb = ef('Prismatic_Burst_Support');
  assert.deepEqual([pb.maisDanoPct, pb.recargaPct, pb.danoPct], [undefined, undefined, undefined]);
  assert.deepEqual([pb.prismaMin_fire, pb.prismaMax_fire, pb.prismaMin_ice, pb.prismaMax_ice, pb.prismaMin_energy, pb.prismaMax_energy, pb.prismaRaioM, pb.prismaRecargaMs, pb.prismaRecargaIncPct, pb.prismaEficacia, pb.prismaIncPct, pb.prismaCrit],
    [1224, 1836, 1224, 1836, 153, 2907, 2.2, 800, 57, 2.8, 20, 5]);
  const id = ef('Impending_Doom_Support');
  assert.deepEqual([id.doomMin, id.doomMax, id.doomRecargaMs, id.doomUsos, id.doomEficacia, id.doomAreaIncPct, id.doomRaioM, id.areaIncPct], [1654, 2481, 150, 3, 3.7, 10, 2, undefined]);
});

test('S2B: os lacaios na invocação — a velocidade de ataque e de conjuração, o crítico da qualidade, as resistências, a Provocação, os Agressivos', { skip: SEM }, () => {
  const z0 = invocar('Raise_Zombie');
  const z = invocar('Raise_Zombie', ef('Minion_Speed_Support'));
  assert.equal(z.velAtaquePct - z0.velAtaquePct, 34, 'o Zumbi ataca: a de ataque');
  const s0 = invocar('Raise_Spectre');
  const s = invocar('Raise_Spectre', { lacaioVelAtaquePct: 10, lacaioVelConjPct: 34 });
  assert.equal(s.velAtaquePct - s0.velAtaquePct, 34, 'o Espectro conjura: a de conjuração');
  const c = invocar('Raise_Zombie', ef('Exemplar_Support'));
  assert.equal(c.poe.critInc - z0.poe.critInc, 20);
  assert.deepEqual(c.poe.s2b.exemplar, { incPor: 40, incMax: 200, multPor: 20, multMax: 100 });
  const a = invocar('Raise_Zombie', ef('Elemental_Army_Support'));
  assert.deepEqual([a.poe.res - z0.poe.res, a.poe.resMax - z0.poe.resMax, a.poe.s2b.maisElementalPct, a.poe.s2b.exposicaoPct], [29, 4, 19, 10]);
  assert.equal(LacaiosPoe.tetoDaResDoLacaio(a, 'fire'), 79, '75 + 4');
  const m = invocar('Raise_Zombie', ef('Meat_Shield_Support'));
  assert.equal(m.poe.chances.provocar - z0.poe.chances.provocar, 20);
  assert.equal(invocar('Raise_Zombie', ef('Feeding_Frenzy_Support')).poe.agressivo, true);
  assert.equal(z0.poe.agressivo, false);
});

test('S2B: o golpe do lacaio — o Exemplar pelos seus críticos de ataque recentes (com os tetos), a Carne Fresca, o Frenesi Faminto e o Escudo de Carne', { skip: SEM }, () => {
  const hunt = { clock: 10_000, pos: { x: 0, y: 0 } };
  const l = { tipo: 'lacaio', critChanceBase: 5, critChance: 5, poe: { danoIncPct: 50, s2b: S2B.doLacaio(ef('Exemplar_Support')) } };
  assert.deepEqual(S2B.noGolpeDoLacaio(hunt, l, bicho(), 10_000), { fator: 1, critInc: 0, critBase: 0, critMult: 0 });
  for (const t of [5_000, 7_000, 8_000, 9_000]) S2B.notarCriticoDeAtaque(hunt, t);
  assert.equal(S2B.critsDeAtaqueRecentes(hunt, 10_000), 3, 'o de 5 s atrás não conta');
  const x = S2B.noGolpeDoLacaio(hunt, l, bicho(), 10_000);
  assert.deepEqual([x.critInc, x.critMult], [120, 60]);
  for (let i = 0; i < 10; i++) S2B.notarCriticoDeAtaque(hunt, 10_000);
  const t = S2B.noGolpeDoLacaio(hunt, l, bicho(), 10_000);
  assert.deepEqual([t.critInc, t.critMult], [200, 100], 'os tetos: até 200% e +100%');
  // (a chance: 5% × (1 + 20% + 200%) = 11,1%; o multiplicador: 150% + 100%)
  const crit = S2B.comCriticoDoLote(l, { chance: 6, mult: 1.5 }, t);
  assert.ok(perto(crit.chance, 5 * (1.2 + 2)), String(crit.chance));
  assert.equal(crit.mult, 2.5);
  // (a Carne Fresca: 10% da duração, até 10 s — o de 60 s fica com 6 s; a Fúria Desperta soma à base; a Adrenalina: 100% aumentado sobre os 50% do lacaio)
  const f = { tipo: 'lacaio', duracaoMs: 60_000, critChanceBase: 5, poe: { danoIncPct: 50, s2b: S2B.doLacaio(ef('Fresh_Meat_Support')) } };
  S2B.aoInvocar(f, 10_000);
  assert.equal(f.s2bCarneFrescaAte, 16_000);
  const permanente = { tipo: 'lacaio', poe: { s2b: S2B.doLacaio(ef('Fresh_Meat_Support')) } };
  S2B.aoInvocar(permanente, 10_000);
  assert.equal(permanente.s2bCarneFrescaAte, undefined, 'o permanente não ganha (decisão pendente do dono)');
  const fg = S2B.noGolpeDoLacaio(hunt, f, bicho(), 12_000);
  assert.deepEqual([fg.critBase, fg.critMult], [3.9, 69]);
  assert.ok(perto(fg.fator, 2.5 / 1.5));
  assert.equal(S2B.velDoLacaio(hunt, f, 12_000), 25);
  assert.ok(perto(S2B.fatorDoDanoNoLacaio(f, 12_000, 1), 0.9), 'a Adrenalina: 10% de Redução Física na parte física');
  assert.equal(S2B.noGolpeDoLacaio(hunt, f, bicho(), 16_001).critBase, 0, 'acabou');
  // (o Escudo de Carne: 30% mais no inimigo a até 3 casas de você; 29% menos dano sofrido)
  const ms = { tipo: 'lacaio', poe: { s2b: S2B.doLacaio(ef('Meat_Shield_Support')) } };
  assert.ok(perto(S2B.noGolpeDoLacaio(hunt, ms, bicho({ x: 3, y: 2 }), 12_000).fator, 1.3));
  assert.equal(S2B.noGolpeDoLacaio(hunt, ms, bicho({ x: 4, y: 0 }), 12_000).fator, 1);
  assert.ok(perto(S2B.fatorDoDanoNoLacaio(ms, 12_000), 0.71));
  // (o Frenesi Faminto em você: 10% mais Dano, 10% de velocidade e de movimento nos seus lacaios)
  hunt.poeS2B.frenesiFamintoAte = 13_000;
  assert.ok(perto(S2B.noGolpeDoLacaio(hunt, { tipo: 'lacaio', poe: {} }, bicho(), 12_000).fator, 1.1));
  assert.deepEqual([S2B.velDoLacaio(hunt, { tipo: 'lacaio' }, 12_000), S2B.movDoLacaio(hunt, { tipo: 'lacaio' }, 12_000), S2B.velDoLacaio(hunt, { tipo: 'totem' }, 12_000)], [10, 10, 0]);
});

test('S2B: o acerto do lacaio — a Exposição do Exército Elemental (só elemental) e o Frenesi Faminto (44%); as partes elementais com o "mais"', { skip: SEM }, () => {
  const hunt = { clock: 10_000, pos: { x: 0, y: 0 } };
  const l = { tipo: 'lacaio', poe: { s2b: S2B.doLacaio({ ...ef('Elemental_Army_Support'), ...ef('Feeding_Frenzy_Support') }) } };
  const b = bicho();
  const ev = S2B.aoAcertarDoLacaio(hunt, l, b, 'fire', 10_000, { porExposicao: ModsPoe.porExposicao, rng: () => 0.9 });
  assert.ok(ev.some((x) => x.estado === 'exposto'));
  assert.equal(ModsPoe.exposicao(b, 11_000, 'fire'), 10);
  assert.equal(ModsPoe.exposicao(b, 14_001, 'fire'), 0, '4 s');
  const f = bicho();
  S2B.aoAcertarDoLacaio(hunt, l, f, 'physical', 10_000, { porExposicao: ModsPoe.porExposicao, rng: () => 0.9 });
  assert.equal(ModsPoe.exposicao(f, 11_000, 'fire') + ModsPoe.exposicao(f, 11_000, 'ice') + ModsPoe.exposicao(f, 11_000, 'energy'), 0, 'o golpe físico não expõe');
  assert.ok(!S2B.frenesiFamintoAtivo(hunt, 10_000), 'acima dos 44%');
  S2B.aoAcertarDoLacaio(hunt, l, f, 'physical', 10_000, { porExposicao: ModsPoe.porExposicao, rng: () => 0.2 });
  assert.equal(hunt.poeS2B.frenesiFamintoAte, 15_900);
  const partes = S2B.partesDoLacaio(l, [{ tipo: 'physical', f: 0.5 }, { tipo: 'ice', f: 0.5 }]);
  assert.deepEqual(partes.map((p) => +p.f.toFixed(3)), [0.5, 0.595]);
});

/** O tique dos lacaios com o Math.random fixo e um Zumbi (com `poe` a mais) ao lado do bicho `b`. */
async function tiqueDoZumbi(efeito, { random = 0.5, antes = null } = {}) {
  const { e, b } = await montar(['Raise_Zombie']);
  const h = e.hunt;
  const q = invocar('Raise_Zombie', efeito);
  const l = { ...q, uid: 'l1', tipo: 'lacaio', x: h.pos.x + 2, y: h.pos.y, hp: q.vida, maxHp: q.vida, proximoGolpe: 0, alcanceDeAtaque: 1, perto: 6 };
  Object.assign(b, { x: l.x + 1, y: l.y, hp: 1e9, maxHp: 1e9, evasaoPct: 0 });
  h.lacaios = [l];
  antes?.(h, l);
  const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);
  const ev = travado(random, () => Cacadas.tiqueDosLacaios(e, h, null, grade, Date.now()));
  return { e, h, b, l, ev, dano: 1e9 - b.hp };
}

test('S2B: de ponta a ponta no tique dos lacaios — o Frenesi Faminto vem do acerto do Zumbi e dá 10% mais Dano a ele; o Exército Elemental não expõe o golpe físico', { skip: SEM }, async () => {
  const sem = await tiqueDoZumbi(null, { random: 0.01 });
  assert.ok(sem.dano > 0, 'o Zumbi bateu');
  const com = await tiqueDoZumbi(ef('Feeding_Frenzy_Support'), { random: 0.01 });
  assert.ok(com.h.poeS2B?.frenesiFamintoAte > com.h.clock, 'o acerto deu o Frenesi Faminto (1% < 44%)');
  const ativo = await tiqueDoZumbi(null, { random: 0.01, antes: (h) => { h.poeS2B = { frenesiFamintoAte: h.clock + 5000 }; } });
  assert.ok(perto(ativo.dano / sem.dano, 1.1, 0.02), `${ativo.dano} / ${sem.dano}`);
  const ea = await tiqueDoZumbi(ef('Elemental_Army_Support'), { random: 0.01 });
  assert.equal(ModsPoe.exposicao(ea.b, ea.h.clock, 'fire'), 0);
});

test('S2B: a Fúria Arcana — a mana gasta no custo da suportada, por habilidade; no total, o buff (o maior entre o do suporte e o comum) e o "35% mais" só com ele', { skip: SEM }, async () => {
  const hunt = { clock: 0 };
  const e0 = ef('Arcane_Surge_Support');
  assert.equal(S2B.gastarManaArcana(hunt, 'a', 300, e0), null);
  assert.equal(S2B.gastarManaArcana(hunt, 'b', 300, e0), null, 'a outra habilidade conta à parte');
  assert.deepEqual(S2B.gastarManaArcana(hunt, 'a', 150, e0), { ms: 4000, castPct: 30, regenPct: 30 });
  assert.equal(hunt.poeS2B.arcana.a, 50, 'o que sobra conta para o próximo');
  const sem = S2B.doUso(hunt, 'a', { furiaArcanaMaisMagicoPct: 35, maisDanoMagicoPct: 10 }, { magia: true, furiaArcana: false });
  assert.equal(sem.maisDanoMagicoPct, 10);
  const com = S2B.doUso(hunt, 'a', { furiaArcanaMaisMagicoPct: 35, maisDanoMagicoPct: 10, maisDanoAcertoPct: 0, fatorDeDano: 1 }, { magia: true, furiaArcana: true });
  assert.ok(perto(com.fatorDeDano, 1.35));
  assert.ok(perto(com.maisDanoMagicoPct, (1.1 * 1.35 - 1) * 100));
  assert.ok(perto(com.maisDanoAcertoPct, 35));
  // (de ponta a ponta: a Bola de Fogo paga o custo; depois de 400 de mana, a Fúria Arcana e os +20% de conjuração a mais do suporte)
  const { e, b } = await montar(['Fireball', 'Arcane_Surge_Support']);
  for (let i = 0; i < 80 && !ModsPoe.buffAtivo(e, 'furiaArcana'); i++) {
    e.mana = e.maxMana;
    e.hunt.clock += 3000;
    e.hunt.ultimoAtaqueEm = -Infinity;
    usar(e, b);
  }
  assert.ok(ModsPoe.buffAtivo(e, 'furiaArcana'), 'ganhou a Fúria Arcana');
  assert.equal(e.hunt.poeTemporarios?.['s2b:furiaArcana:cast']?.valor, 20, 'os 30% do suporte − os 10% da comum');
  assert.ok(Ficha.combate(e).afPoe.cast_speed >= 30, String(Ficha.combate(e).afPoe.cast_speed));
});

test('S2B: a Inervação — o golpe fatal num Eletrizado dá o Raio adicionado (aos ataques e às magias) por 10 s', { skip: SEM }, async () => {
  const efe = ef('Innervate_Support');
  assert.equal(S2B.inervacaoAoMatar(efe, [bicho({ hp: 0 })], 1000), null, 'sem Eletrização, nada');
  const t = S2B.inervacaoAoMatar(efe, [bicho({ hp: 0, estados: { chocado: { ate: 2000, pct: 10 } } })], 1000);
  assert.deepEqual(Object.values(t).map((x) => [x.stat, x.valor, x.ate]), [['added_energy_dmg_min', 8, 11000], ['added_energy_dmg_max', 145, 11000], ['spell_added_energy_dmg_min', 8, 11000], ['spell_added_energy_dmg_max', 145, 11000]]);
  const { e } = await montar(['Heavy_Strike', 'Innervate_Support']);
  e.hunt.poeTemporarios = Object.fromEntries(Object.entries(S2B.inervacaoAoMatar(efe, [bicho({ hp: 0, estados: { chocado: { ate: e.hunt.clock + 10 } } })], e.hunt.clock)));
  Ficha.invalidar(e);
  assert.equal(ModsPoe.adds(e).added_energy_dmg_max, 145);
});

test('S2B: a Trindade — o maior tipo do acerto dá a Ressonância dos outros dois (25/s por 2 s, até 50; −5/s sem ganhar); o "mais" e a penetração pela menor', { skip: SEM }, () => {
  const hunt = { clock: 0 };
  assert.equal(S2B.noAcerto(hunt, 'trindade', [{ elemento: 'fire', dano: 100 }, { elemento: 'ice', dano: 30 }], 0), 'fire');
  assert.deepEqual(S2B.ressonancia(hunt, 'trindade', 1000).n, { fire: 0, ice: 25, energy: 25 });
  assert.deepEqual(S2B.ressonancia(hunt, 'trindade', 2000).n, { fire: 0, ice: 50, energy: 50 }, 'no teto');
  assert.deepEqual(S2B.ressonancia(hunt, 'trindade', 3000).n, { fire: 0, ice: 45, energy: 45 }, '−5/s depois dos 2 s');
  assert.deepEqual(S2B.ressonancia(hunt, 'trindade', 5000).n, { fire: 0, ice: 35, energy: 35 });
  assert.equal(S2B.noAcerto(hunt, 'trindade', [{ elemento: 'physical', dano: 100 }, { elemento: 'fire', dano: 30 }], 5000), null, 'o maior é o Físico: nada');
  S2B.noAcerto(hunt, 'trindade', [{ elemento: 'ice', dano: 100 }], 5000);
  const r = S2B.ressonancia(hunt, 'trindade', 6000);
  assert.deepEqual(r.n, { fire: 25, ice: 30, energy: 50 }, 'o Gelo perde; o Fogo e o Raio ganham (o Raio no teto)');
  const e = S2B.doUso(hunt, 'x', { trindade: 1, trindadeMaisPor5: 3, trindadePen: 16 }, {}, 6000);
  assert.deepEqual([e['af:mais_dano_elemental'], e['af:elem_pen']], [15, 16], 'a menor é 25: 3% × 5 e a penetração');
  const baixa = S2B.doUso({ clock: 0 }, 'x', { trindade: 1, trindadeMaisPor5: 3, trindadePen: 16 }, {}, 0);
  assert.deepEqual([baixa['af:mais_dano_elemental'], baixa['af:elem_pen']], [undefined, undefined]);
});

test('S2B: a Tríade Profana — Caos, Raio e Físico; +7% por 10 da menor e os 90% de ignorar (a resistência a Caos e Raio, a redução física) acima de 25', { skip: SEM }, () => {
  const hunt = { clock: 0 };
  S2B.noAcerto(hunt, 'profana', [{ elemento: 'physical', dano: 100 }], 0);
  S2B.noAcerto(hunt, 'profana', [{ elemento: 'chaos', dano: 100 }], 2000);
  const r = S2B.ressonancia(hunt, 'profana', 2000);
  assert.deepEqual(r.n, { chaos: 50, energy: 50, physical: 0 });
  S2B.noAcerto(hunt, 'profana', [{ elemento: 'energy', dano: 100 }], 2000);
  const e = S2B.doUso(hunt, 'x', { profana: 1, profanaMaisPor10: 7, profanaIgnoraResPct: 90, profanaIgnoraFisicoPct: 90, fatorDeDano: 1.1 }, {}, 3200);
  // (o Físico ganhou 25/s desde os 2 s: 30 aos 3,2 s; Caos e Raio perdem/ganham — a menor é 30)
  assert.equal(Math.floor(S2B.ressonancia(hunt, 'profana', 3200).menor), 30);
  assert.ok(perto(e.fatorDeDano, 1.1 * 1.21), String(e.fatorDeDano));
  assert.deepEqual([e['af:ignora_reducao_fisica'], e['af:s2b_ignora_res_caos_raio']], [90, 90]);
  // (o acerto que sorteou ignorar a resistência: a positiva de Caos e de Raio vai a 0; a de Fogo, não)
  const alvo = bicho({ resist: { chaos: 40, energy: 40, fire: 40 } });
  const h = { clock: 0 };
  const ficha = { penetracao: {}, ignoraResDe: ['chaos', 'energy'] };
  assert.deepEqual(['chaos', 'energy', 'fire'].map((t) => resistenciaEfetivaDe(h, alvo, t, ficha) <= 0), [true, true, false]);
});

test('S2B: a Gula — 10 magias de projétil e a Regurgitação (4 s): em círculo, com 7 projéteis a mais', { skip: SEM }, () => {
  const hunt = { clock: 0 };
  const efg = ef('Gluttony_Support', 3);
  const ctx = { magia: true, projetil: true };
  for (let i = 0; i < 9; i++) { assert.equal(S2B.doUso(hunt, 'x', efg, ctx, i).emCirculo, undefined); S2B.aposPagar(hunt, 'x', efg, ctx, i); }
  assert.equal(S2B.gulaAgora(hunt, 9).gula, 9);
  S2B.aposPagar(hunt, 'x', efg, ctx, 1000);
  assert.deepEqual(S2B.gulaAgora(hunt, 1000), { gula: 0, regurgitando: true });
  const e = S2B.doUso(hunt, 'x', { ...efg, alvosExtras: 2 }, ctx, 2000);
  assert.deepEqual([e.emCirculo, e.alvosExtras], [1, 9]);
  assert.equal(S2B.doUso(hunt, 'x', efg, ctx, 5001).emCirculo, undefined, 'acabou');
  assert.equal(S2B.doUso(hunt, 'x', efg, { magia: true, projetil: false }, 2000).emCirculo, undefined, 'só as magias de projétil');
});

test('S2B: a Intensidade Sobrecarregada — a cada 6 de Intensidade perdida, uma instância (10 s): +1,4% de crítico e +50% de multiplicador cada', { skip: SEM }, () => {
  const hunt = { clock: 0 };
  const eo = ef('Overloaded_Intensity_Support', 3);
  const a = S2B.doUso(hunt, 'x', eo, { perdaDeIntensidade: 4 }, 0);
  assert.equal(a['af:crit_chance'], undefined);
  S2B.aposPagar(hunt, 'x', eo, { perdaDeIntensidade: 4 }, 0);
  const b = S2B.doUso(hunt, 'x', eo, { perdaDeIntensidade: 8 }, 1000);
  assert.deepEqual([b['af:crit_chance'], b['af:crit_dmg']], [2.8, 100], '4 + 8 = 12: duas instâncias já valem neste uso');
  S2B.aposPagar(hunt, 'x', eo, { perdaDeIntensidade: 8 }, 1000);
  assert.equal(S2B.sobrecargaAgora(hunt, 10_999), 2);
  assert.equal(S2B.sobrecargaAgora(hunt, 11_001), 0, '10 s');
});

test('S2B: os Feitiços — o à prova de maldições com o Passe Enfeitiçado (sempre) e o Toque Maldito Desperto (34%); "não podem causar golpes críticos"', { skip: SEM }, () => {
  assert.deepEqual(S2B.regrasDoFeitico(ef('Hexpass_Support', 3)), { afetaAProva: true, semCritico: true });
  assert.deepEqual(S2B.regrasDoFeitico(ef('Awakened_Hextouch_Support')), { afetaAProvaPct: 34 });
  const lista = (regras) => [{ id: 'm1', def: { tipo: 'poe-maldicao', efeitos: [{ efeito: 'marcaVulneravel', pct: 20, tipos: ['physical'], durMarca: 6000 }, { efeito: 'maldicaoRegras', feitico: true, limite: 1, ...regras }] }, fator: 1, lancado: 0, emAura: false }];
  const prova = () => bicho({ aProvaDeMaldicoes: true });
  const h = { clock: 1000, monstros: [] };
  const b1 = prova();
  Reforcos.marcarCom(h, b1, lista({}), 1000);
  assert.equal(b1.maldicoes?.m1, undefined, 'à prova: o Feitiço não pega');
  const b2 = prova();
  Reforcos.marcarCom(h, b2, lista({ afetaAProva: true, s2b: { afetaAProva: true, semCritico: true } }), 1000);
  assert.ok(b2.maldicoes.m1, 'o Passe Enfeitiçado');
  const b3 = prova();
  travado(0.5, () => Reforcos.marcarCom(h, b3, lista({ s2b: { afetaAProvaPct: 34 } }), 1000));
  assert.equal(b3.maldicoes?.m1, undefined, 'acima dos 34%');
  travado(0.2, () => Reforcos.marcarCom(h, b3, lista({ s2b: { afetaAProvaPct: 34 } }), 1000));
  assert.ok(b3.maldicoes.m1, 'abaixo dos 34%');
  // (o amaldiçoado pelo Passe não critica: nem em você, nem no lacaio)
  assert.equal(S2B.semCriticoPeloFeitico(b2, 2000), true);
  assert.deepEqual(ModsPoe.criticoDoBicho({ chance: 1, fator: 2 }, b2, { afPoe: {} }, 2000, () => 0), { critico: false, fator: 1 });
  assert.deepEqual(LacaiosPoe.criticoNoLacaio({ poe: {} }, { chance: 1, fator: 2 }, b2, 2000, () => 0), { critico: false, fator: 1 });
  assert.equal(S2B.semCriticoPeloFeitico(b2, 8000), false, 'acabou');
});

test('S2B: o Propagar Feitiço — na morte, o Feitiço passa a todos os vivos a até 3 m × 1,32 (1 casa + 98% de chance de 2), com o tempo que faltava', { skip: SEM }, () => {
  const casas = S2B.regrasDoFeitico(ef('Hex_Bloom_Support')).transfereCasas;
  assert.ok(perto(casas, 1.98));
  const morto = bicho({ x: 10, y: 10, hp: 0, maldicoes: { m1: { ate: 5000, desde: 0, lancada: 0, dur: 6000, efeitos: [{ tipo: 'vulneravel', pct: 20 }], s2b: { transfereCasas: casas, limite: 1 } } } });
  const a = bicho({ x: 11, y: 10 });
  const c = bicho({ x: 12, y: 12 });
  const longe = bicho({ x: 13, y: 10 });
  const prova = bicho({ x: 9, y: 10, aProvaDeMaldicoes: true });
  const h = { clock: 3000, monstros: [morto, a, c, longe, prova] };
  const ganharam = S2B.transferirFeiticos(h, morto, 3000, () => 0.5);
  assert.deepEqual(ganharam, [a, c]);
  assert.equal(a.maldicoes.m1.ate, 5000);
  assert.equal(longe.maldicoes, undefined);
  assert.equal(S2B.transferirFeiticos({ clock: 3000, monstros: [morto, longe] }, morto, 3000, () => 0.999).length, 0, 'sorteado 1 casa: a 3 casas não pega');
});

test('S2B: de ponta a ponta — a Vulnerabilidade com o Propagar Feitiço e a Destruição Iminente: as regras na maldição; o Feitiço que termina ativa a Explosão Destruidora (3 usos)', { skip: SEM }, async () => {
  const { e, b } = await montar(['Vulnerability', 'Hex_Bloom_Support', 'Impending_Doom_Support']);
  const id = G.doSlug('Vulnerability').acao;
  const entry = Acoes.POR_ID_PUBLICO(id);
  const efe = GS.efeitoNaSkill(e, id);
  const regras = Acoes.efeitosDaMaldicao(G.buffNoNivel('Vulnerability', 20, 0).efeitos, efe, e, entry).find((x) => x.efeito === 'maldicaoRegras');
  assert.ok(regras.s2b?.doom && regras.s2b.transfereCasas > 0, JSON.stringify(regras));
  const agora = e.hunt.clock;
  const vizinho = e.hunt.monstros[1];
  Object.assign(vizinho, { x: b.x + 1, y: b.y, hp: 1e12, maxHp: 1e12 });
  b.maldicoes = { [id]: { ate: agora - 1, desde: agora - 6000, lancada: agora - 6000, dur: 6000, efeitos: [], s2b: regras.s2b } };
  const ev = travado(0.5, () => Acoes.tiqueDosFeiticosS2B(e, e.hunt, { nome: 'T' }, [], agora));
  assert.ok(ev.some((x) => x.t === 'explosao' && x.fonte === 'explosao-destruidora'));
  assert.ok(b.hp < 1e12 && vizinho.hp < 1e12, 'o Caos na área');
  assert.equal(Acoes.tiqueDosFeiticosS2B(e, e.hunt, null, [], agora).length, 0, 'uma vez só');
  // (o vencido apagado pelo próximo acerto antes do tique fica pendente)
  b.maldicoes = { [id]: { ate: agora - 1, desde: 0, lancada: 0, dur: 6000, efeitos: [], s2b: regras.s2b } };
  S2B.antesDeApagar(e.hunt, b, id, b.maldicoes[id], agora);
  delete b.maldicoes[id];
  assert.equal(S2B.feiticosQueTerminaram(e.hunt, agora).length, 1);
  // (a recarga: 3 usos de 0,15 s)
  const h = { clock: 0 };
  assert.deepEqual([1, 2, 3, 4].map(() => S2B.gastarUso(h, 'd', 150, 3, 0)), [true, true, true, false]);
  assert.equal(S2B.gastarUso(h, 'd', 150, 3, 160), true, 'um voltou');
});

test('S2B: a Explosão Prismática — o elemento pelos atributos, a recarga (0,8 s ÷ 1,57), o dano só do elemento no raio em volta do acertado; a suportada não perde o dano', { skip: SEM }, async () => {
  assert.equal(S2B.elementoDoPrisma(100, 0, 0, () => 0.99), 'fire');
  assert.equal(S2B.elementoDoPrisma(10, 10, 20, () => 0.6), 'energy');
  assert.equal(S2B.elementoDoPrisma(10, 10, 20, () => 0.3), 'ice');
  const sem = await montar(['Heavy_Strike']);
  const com = await montar(['Heavy_Strike', 'Prismatic_Burst_Support']);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Heavy_Strike').acao);
  const ds = Acoes.danoMostrado(sem.e, entry, GS.efeitoNaSkill(sem.e, entry.id));
  const dc = Acoes.danoMostrado(com.e, entry, GS.efeitoNaSkill(com.e, entry.id));
  assert.ok(dc.max >= ds.max * 0.99, `o Golpe Pesado não fica zerado: ${dc.max} vs ${ds.max}`);
  const { e, b, resto } = com;
  Object.assign(resto[0], { x: b.x + 1, y: b.y });
  const ev = usar(e, b, 0.3);
  assert.ok(ev.some((x) => x.t === 'explosao' && x.fonte === 'prisma'), 'a explosão saiu');
  assert.ok(resto[0].hp < 1e12, 'o vizinho do acertado levou a explosão');
  const efe = GS.efeitoNaSkill(e, entry.id);
  assert.equal(Acoes.prismaNoAcerto(e, e.hunt, null, entry, efe, b).length, 0, 'na recarga');
  e.hunt.clock += Math.ceil(800 / 1.57) + 1;
  assert.ok(Acoes.prismaNoAcerto(e, e.hunt, null, entry, efe, b, () => 0.3).length > 0, 'depois da recarga');
});

test('S2B: de ponta a ponta — a Bola de Fogo com a Trindade ganha Gelo e Raio no acerto; com a Gula, a 11ª conjuração sai em círculo com 7 projéteis a mais', { skip: SEM }, async () => {
  const t = await montar(['Fireball', 'Trinity_Support']);
  usar(t.e, t.b);
  const r = S2B.ressonancia(t.e.hunt, 'trindade', t.e.hunt.clock + 1000);
  assert.ok(r.n.ice > 0 && r.n.energy > 0 && r.n.fire === 0, JSON.stringify(r.n));
  const g = await montar(['Fireball', 'Gluttony_Support'], { nivel: 3 });
  const tiros = () => { g.e.hunt.clock += 3000; g.e.hunt.ultimoAtaqueEm = -Infinity; g.e.mana = g.e.maxMana; return usar(g.e, g.b).filter((x) => x.t === 'shot').length; };
  const antes = [];
  for (let i = 0; i < 10; i++) antes.push(tiros());
  assert.ok(S2B.gulaAgora(g.e.hunt, g.e.hunt.clock).regurgitando, 'a 10ª deu a Regurgitação');
  const depois = tiros();
  assert.ok(depois >= antes[0] + 7, `${depois} tiros na Regurgitação, ${antes[0]} antes`);
});

test('S2B: de ponta a ponta — o Golpe Pesado com a Inervação mata um Eletrizado e ganha a Inervação; a Explosão Destruidora não sai sem o suporte', { skip: SEM }, async () => {
  const { e, b } = await montar(['Heavy_Strike', 'Innervate_Support']);
  Object.assign(b, { hp: 1, maxHp: 1000, estados: { chocado: { ate: e.hunt.clock + 5000, pct: 10 } } });
  usar(e, b, 0.3);
  assert.ok(b.hp <= 0, 'morreu');
  assert.equal(e.hunt.poeTemporarios?.['s2b:inervacao:a:max']?.valor, 145);
  const sem = await montar(['Vulnerability']);
  const id = G.doSlug('Vulnerability').acao;
  sem.b.maldicoes = { [id]: { ate: sem.e.hunt.clock - 1, desde: 0, lancada: 0, dur: 6000, efeitos: [], s2b: { doom: true } } };
  assert.equal(Acoes.tiqueDosFeiticosS2B(sem.e, sem.e.hunt, null, [], sem.e.hunt.clock).length, 0);
});
