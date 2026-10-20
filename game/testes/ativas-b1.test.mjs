// (lote B1, dono 20/10) AS GEMAS ATIVAS DE ÁREA, NOVA, CHUVA E ORBE QUE REUSAM O QUE JÁ EXISTE (o plano do grupo, as recomendações aceitas): a Descarga (o dano e a
// área por carga, a chance de não remover), o Condutor Elétrico (a conjuração na recarga) e o dos Céus (o máximo de alvos), as Bombas Congelantes (a regeneração
// reduzida; o "mais" por 0,1 s de duração — D-B1.3), os Estalos Gélidos (o chão que cresce — D-B1.7 — e as cargas — D-B1.6), o Detonar Mortos (o cadáver
// adicional, a Limpeza só com a explosão), a Cremação (o gêiser mais rápido), a Mutilação da Chuva de Flechas Vaal, a Nova Elétrica da Procissão (o "mais
// Velocidade de Conjuração") e a Chuva Explosiva de Trarthus (1 flecha). Os números são os do PoE (o PoB, o poedb); os sorteios ficam travados.
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
const B1 = await import('../systems/itens-poe/gemas-b1.mjs');
const L = await import('../systems/itens-poe/linhas-das-gemas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const CargasPoe = await import('../systems/itens-poe/cargas.mjs');
const Estados = await import('../systems/skills/estados.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/** Roda `fn` com o `Math.random` travado em `v`. */
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com a gema na arma, numa caçada; o alvo imortal colado e os outros longe. */
async function montar(slug, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand' } = {}) {
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
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {} });
  return { e, b, entry: Acoes.POR_ID_PUBLICO(G.doSlug(slug).acao) };
}
/** Usa a gema no alvo (com a conjuração concluída), com o sorteio travado. */
function usar(e, b, v = 0.5) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
    return x;
  });
}
const cargas = (e, c) => { e.hunt.cargasPoe = Object.fromEntries(Object.entries(c).map(([t, n]) => [t, { n, ate: e.hunt.clock + 10_000 }])); Ficha.invalidar(e); };

// ---------------------------------------------------------------- o status

test('B1: as gemas do lote saem de parcial (as linhas do PoE têm leitor)', { skip: SEM }, () => {
  for (const s of ['Blast_Rain_of_Trarthus', 'Shock_Nova_of_Procession', 'Lightning_Conduit', 'Lightning_Conduit_of_the_Heavens', 'Frost_Bomb', 'Frost_Bomb_of_Forthcoming', 'Cold_Snap', 'Cold_Snap_of_Power', 'Vaal_Cold_Snap', 'Discharge', 'Discharge_of_Misery', 'Cremation', 'Detonate_Dead', 'Vaal_Detonate_Dead', 'Detonate_Dead_of_Scavenging', 'Toxic_Rain_of_Withering', 'Vaal_Rain_of_Arrows', 'Storm_Call']) {
    const r = G.REGISTRO.get(s);
    assert.deepEqual([s, r.statusNoJogo, r.motivosNoJogo], [s, 'funciona', []]);
  }
});

// ---------------------------------------------------------------- a Descarga

test('B1: a Descarga — 15% (Miséria: 20%) mais Área por carga, a chance da qualidade de não remover, o dano base de cada elemento × as cargas do tipo', { skip: SEM }, () => {
  assert.deepEqual(G.descargaDaGema('Discharge', 20, 20), { areaPorCargaPct: 15, semRemoverPct: 10 });
  assert.deepEqual(G.descargaDaGema('Discharge_of_Misery', 20, 0), { areaPorCargaPct: 20, semRemoverPct: 0 });
  const d = G.descargaDaGema('Discharge', 20, 0);
  assert.equal(B1.usoDaDescarga(d, { poder: 0, frenesi: 0, tolerancia: 0 }), null);
  assert.deepEqual(B1.usoDaDescarga(d, { poder: 2, frenesi: 1, tolerancia: 0 }), { total: 3, basePor: { energy: 2, fire: 0, ice: 1 }, areaMaisPct: 45 });
  // (o dano base da gema no nível 20: Raio 735–2206 por Poder, Fogo e Gelo 1176–1765 por Tolerância e por Frenesi)
  const p = G.partesDaMagia('Discharge', 20, {}, { basePor: { energy: 2, fire: 0, ice: 1 } });
  assert.deepEqual(p, { energy: [1470, 4412], ice: [1176, 1765] });
});

test('B1 no jogo: a Descarga sem carga não sai; com 3 de Poder, 3× o dano de 1 e as cargas saem depois', { skip: SEM }, async () => {
  const { e, b } = await montar('Discharge');
  const sem = usar(e, b);
  assert.deepEqual([sem.ok, sem.motivo], [false, 'SEM_CARGAS']);
  const dano = async (n) => {
    const m = await montar('Discharge');
    cargas(m.e, { poder: n });
    const vida = m.b.hp;
    const r = usar(m.e, m.b);
    assert.ok(r.ok, r.erro);
    return { dano: vida - m.b.hp, sobrou: CargasPoe.ativas(m.e).poder };
  };
  const um = await dano(1);
  const tres = await dano(3);
  assert.ok(um.dano > 0);
  assert.ok(perto(tres.dano / um.dano, 3, 0.01), `razão ${tres.dano / um.dano}`);
  assert.deepEqual([um.sobrou, tres.sobrou], [0, 0], 'a Descarga removeu as cargas');
});

// ---------------------------------------------------------------- os Condutores Elétricos

test('B1: o Condutor Elétrico dos Céus acerta até 15 (+4 da qualidade 20) — os mais perto do centro; o Condutor soma a conjuração à recarga se ativado', { skip: SEM }, () => {
  assert.equal(G.maxAlvosDaGema('Lightning_Conduit_of_the_Heavens', 20, 0), 15);
  assert.equal(G.maxAlvosDaGema('Lightning_Conduit_of_the_Heavens', 20, 20), 19);
  assert.equal(G.maxAlvosDaGema('Lightning_Conduit', 20, 20), null);
  const bs = [{ x: 5, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 1 }];
  assert.deepEqual(B1.maisPertoDoCentro(bs, { x: 0, y: 0 }, 2), [bs[1], bs[3]]);
  assert.equal(G.conjuracaoNaRecargaSeAtivada('Lightning_Conduit'), true);
  assert.equal(G.conjuracaoNaRecargaSeAtivada('Lightning_Conduit_of_the_Heavens'), false);
});

// ---------------------------------------------------------------- as Bombas Congelantes

test('B1: a Bomba Congelante — a Regeneração de Vida −75% no debuff, junto da Exposição (5 s)', { skip: SEM }, async () => {
  assert.equal(G.regenMenosDaGema('Frost_Bomb', 20), 75);
  const { e, b } = await montar('Frost_Bomb');
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.equal(b.estados.regenMenosDebuff?.pct, 75);
  assert.equal(b.estados.regenMenosDebuff.ate, b.estados.exposicao.ice);
  // a regeneração do monstro (10% da vida por segundo): 100 → 25
  const regen = (estados) => {
    const m = { uid: 'm', x: 0, y: 0, hp: 500, maxHp: 1000, regen: 10, proximaRegen: 0, estados };
    Estados.tique({ monstros: [m], clock: 0 }, [], 0);
    return m.hp - 500;
  };
  assert.equal(regen({}), 100);
  assert.equal(regen({ regenMenosDebuff: { ate: 5000, pct: 75 } }), 25);
});

test('B1 (D-B1.3): a Bomba Congelante da Aproximação — 10% mais nos acertos e 3% mais nas afecções por 0,1 s da duração final', { skip: SEM }, async () => {
  assert.deepEqual(G.porDuracaoDaGema('Frost_Bomb_of_Forthcoming', 20), { acertoPct: 10, afeccaoPct: 3 });
  // 2 s (o nível) → 20 décimos: 200% e 60% mais; + 0,5 s da qualidade 20 → 25: 250% e 75%
  assert.deepEqual(B1.maisPelaDuracao({ acertoPct: 10, afeccaoPct: 3 }, 2), { decimos: 20, acertoPct: 200, afeccaoPct: 60 });
  assert.deepEqual(B1.maisPelaDuracao({ acertoPct: 10, afeccaoPct: 3 }, 2.5), { decimos: 25, acertoPct: 250, afeccaoPct: 75 });
  // (o PoB arredonda para baixo: 2,09 s → 20)
  assert.equal(B1.maisPelaDuracao({ acertoPct: 10 }, 2.09).decimos, 20);
  // no jogo: o acerto da gema de qualidade 0 é 3× o do balão (que não conta a duração)
  const { e, b, entry } = await montar('Frost_Bomb_of_Forthcoming');
  const mostrado = Acoes.danoMostrado(e, entry);
  const vida = b.hp;
  assert.ok(usar(e, b).ok);
  const dano = vida - b.hp;
  assert.ok(dano >= mostrado.min * 3 * 0.99 && dano <= mostrado.max * 3 * 1.01, `${dano} em ${mostrado.min * 3}–${mostrado.max * 3}`);
});

// ---------------------------------------------------------------- os Estalos Gélidos

test('B1 (D-B1.6/D-B1.7): os Estalos Gélidos — o chão que cresce (1,5 → 3 m; Vaal 2 → 3,6 m) e as cargas', { skip: SEM }, () => {
  assert.deepEqual(G.estaloDaGema('Cold_Snap', 20), { raioInicialM: 1.5, raioFinalM: 3, aoMorrer: { tipo: 'frenesi', chance: 25 }, porSegundo: null });
  assert.deepEqual(G.estaloDaGema('Vaal_Cold_Snap', 20), { raioInicialM: 2, raioFinalM: 3.6, aoMorrer: { tipo: 'poder', chance: 100 }, porSegundo: 'frenesi' });
  assert.equal(G.estaloDaGema('Cold_Snap_of_Power', 20), null);
  // em casas: m × √Área ÷ 2, a fração como chance (sorteada uma vez): 1,5 m = 0,75 casa; 3 m = 1,5 casa
  const c = { deM: 1.5, ateM: 3, inicio: 0, durMs: 5000, fator: 1 };
  assert.deepEqual([B1.raioQueCresce({ ...c, sorte: 0.9 }, 0), B1.raioQueCresce({ ...c, sorte: 0.9 }, 5000)], [0, 1]);
  assert.deepEqual([B1.raioQueCresce({ ...c, sorte: 0.1 }, 0), B1.raioQueCresce({ ...c, sorte: 0.1 }, 5000)], [1, 2]);
  assert.equal(B1.raioQueCresce({ ...c, sorte: 0.9 }, 2500), 1, 'no meio: 2,25 m = 1,125 casa');
  // (com 100% mais Área: × √2 — 3 m = 2,12 casas)
  assert.equal(B1.raioQueCresce({ ...c, fator: 2, sorte: 0.9 }, 5000), 2);
});

test('B1: o chão do Estalo Gélido no jogo — cresce no tique; a morte nele dá o Frenesi; o do Vaal dá o Frenesi por segundo', { skip: SEM }, async () => {
  const { e, b } = await montar('Cold_Snap');
  assert.ok(usar(e, b, 0.1).ok);
  const a = e.hunt.areasFrias?.at(-1);
  assert.ok(a?.cresce, 'a área fria cresce');
  assert.deepEqual([a.cresce.deM, a.cresce.ateM, a.aoMorrer], [1.5, 3, { tipo: 'frenesi', chance: 25 }]);
  Cacadas.resfriarNasAreasFrias(e.hunt, a.ate - 1, e);
  assert.ok(a.raio >= 1, `o raio no fim: ${a.raio}`);
  assert.deepEqual(ModsPoe.cargasAoMorrerNaAreaFria(e.hunt, { x: a.x, y: a.y }, a.ate - 1, () => 0.2), ['frenesi']);
  assert.deepEqual(ModsPoe.cargasAoMorrerNaAreaFria(e.hunt, { x: a.x, y: a.y }, a.ate - 1, () => 0.3), [], 'acima dos 25%');
  assert.deepEqual(ModsPoe.cargasAoMorrerNaAreaFria(e.hunt, { x: a.x + 50, y: a.y }, a.ate - 1, () => 0), [], 'fora do chão');
  // o Vaal: um inimigo no chão por 2,5 s → 2 Frenesis (aos 1 s e aos 2 s)
  const h = { clock: 0, monstros: [{ x: 0, y: 0, hp: 10 }] };
  ModsPoe.criarAreaFria(h, { x: 0, y: 0, raioM: 3.6, segundos: 4, agora: 0, porSegundo: 'frenesi' });
  assert.deepEqual(ModsPoe.cargasPorSegundoDasAreasFrias(h, 2500), ['frenesi', 'frenesi']);
  h.monstros[0].x = 30;
  assert.deepEqual(ModsPoe.cargasPorSegundoDasAreasFrias(h, 3500), [], 'sem inimigo no chão');
  // no tique da caçada, a carga entra
  const v = await montar('Vaal_Cold_Snap');
  ModsPoe.criarAreaFria(v.e.hunt, { x: v.b.x, y: v.b.y, raioM: 3.6, segundos: 4, agora: v.e.hunt.clock, porSegundo: 'frenesi' });
  Cacadas.resfriarNasAreasFrias(v.e.hunt, v.e.hunt.clock + 1000, v.e);
  assert.equal(CargasPoe.ativas(v.e).frenesi, 1);
});

test('B1: o Estalo Gélido do Poder — 50% (+20% da qualidade 20) de Poder no crítico', { skip: SEM }, () => {
  assert.deepEqual(G.cargasNoAcertoDaGema('Cold_Snap_of_Power', 20, 20), { frenesiNoAcertoPct: 0, poderNoCriticoPct: 70 });
  assert.deepEqual(G.cargasNoAcertoDaGema('Cold_Snap_of_Power', 20, 0), { frenesiNoAcertoPct: 0, poderNoCriticoPct: 50 });
});

// ---------------------------------------------------------------- os cadáveres e os gêiseres

test('B1: o cadáver adicional (15%, Vaal 30%), a Limpeza com a qualidade e a Cremação 15% mais rápida', { skip: SEM }, () => {
  assert.equal(G.cadaverDaGema('Detonate_Dead', 20, 20).adicionalPct, 15);
  assert.equal(G.cadaverDaGema('Vaal_Detonate_Dead', 20, 20).adicionalPct, 30);
  assert.equal(G.cadaverDaGema('Detonate_Dead', 20, 0).adicionalPct, 0);
  const lim = G.cadaverDaGema('Detonate_Dead_of_Scavenging', 20, 20);
  assert.deepEqual([lim.pct, lim.comDano, lim.soMortos], [34.5, false, true]);
  assert.equal(G.cadaverDaGema('Cremation', 20, 0).geiser.intervaloMs, 1000);
  assert.equal(G.cadaverDaGema('Cremation', 20, 20).geiser.intervaloMs, Math.round(1000 / 1.15));
});

test('B1 no jogo: o Detonar Mortos de qualidade 20 detona o cadáver adicional na chance', { skip: SEM }, async () => {
  const explode = async (v) => {
    const { e, b } = await montar('Detonate_Dead', { qualidade: 20 });
    e.hunt.cadaveres = [{ key: 'a', x: b.x, y: b.y, maxHp: 1000 }, { key: 'b', x: b.x + 1, y: b.y, maxHp: 1000 }];
    const r = usar(e, b, v);
    assert.ok(r.ok, r.erro);
    return e.hunt.cadaveres.length;
  };
  assert.equal(await explode(0.1), 0, '10 < 15: os dois explodem');
  assert.equal(await explode(0.5), 1, '50 ≥ 15: só o mais perto');
});

// ---------------------------------------------------------------- as linhas locais

test('B1: a Mutilação da Chuva de Flechas Vaal (75% de lentidão) e o "mais Velocidade de Conjuração" da Procissão', { skip: SEM }, async () => {
  assert.deepEqual(L.atributosDaLinha('Mutila ao Acertar'), { chance_mutilar: 100 });
  assert.deepEqual(L.atributosDaLinha('150 % de aumento do Efeito de Mutilação'), { efeito_mutilacao: 150 });
  assert.deepEqual(L.atributosDaLinha('10 % mais Velocidade de Conjuração'), { cast_speed_mais: 10 });
  const alvo = { uid: 'b', name: 'Alvo', x: 1, y: 0, hp: 1000, maxHp: 1000, estados: {} };
  const ficha = { afPoe: {}, tagsDoGolpe: ['habilidade'], porTag: [{ stat: 'chance_mutilar', tags: ['habilidade'], valor: 100 }, { stat: 'efeito_mutilacao', tags: ['habilidade'], valor: 150 }] };
  travado(0.99, () => ModsPoe.aoAcertar({}, { clock: 0, monstros: [alvo] }, alvo, ficha, { dano: 1, agora: 0 }));
  assert.equal(alvo.estados.lento?.pct, 75);
  assert.ok(alvo.estados.mutilado?.ate > 0);
  // a Procissão de qualidade 20: o tempo de conjuração ÷ 1,1
  const q0 = await montar('Shock_Nova_of_Procession');
  const q20 = await montar('Shock_Nova_of_Procession', { qualidade: 20 });
  const t0 = Acoes.temposDaGemaPoe(q0.e, q0.entry, GS.efeitoNaSkill(q0.e, q0.entry.id));
  const t20 = Acoes.temposDaGemaPoe(q20.e, q20.entry, GS.efeitoNaSkill(q20.e, q20.entry.id));
  assert.ok(perto(t0.conjuracaoMs / t20.conjuracaoMs, 1.1, 0.02), `${t0.conjuracaoMs} / ${t20.conjuracaoMs}`);
});

test('B1 no jogo: o Condutor Elétrico dos Céus acerta quem não está Eletrizado (só a base exige a Eletrização — o PoB)', { skip: SEM }, async () => {
  assert.equal(G.condutorDaGema('Lightning_Conduit_of_the_Heavens', 20, 0).soEletrizados, false);
  assert.equal(G.condutorDaGema('Lightning_Conduit', 20, 0).soEletrizados, true);
  const { e, b } = await montar('Lightning_Conduit_of_the_Heavens');
  const vida = b.hp;
  assert.ok(usar(e, b).ok);
  assert.ok(vida - b.hp > 0, 'acertou sem Eletrização');
});

test('B1: a Chuva Explosiva de Trarthus dispara 1 flecha', { skip: SEM }, () => {
  assert.equal(G.alvosNoNivel('Blast_Rain_of_Trarthus', 20, 0).base, 1);
  assert.equal(G.alvosNoNivel('Blast_Rain', 20, 0).base, 6);
});

// ---------------------------------------------------------------- as decisões do dono (20/10): D-B1.8, D-B1.9, D-B1.10 e a recarga dos Estalos

test('B1 (D-B1.10): a Invocar Tormenta — o marcador no alvo e o raio 1,5 s depois; a qualidade o faz cair na hora; um que cai leva os outros', { skip: SEM }, async () => {
  assert.deepEqual(G.objetoDaGema('Storm_Call', 20, 20), { tipo: 'tormenta', semAcerto: true, atrasoMs: 1500, naHoraPct: 15 });
  const { e, b } = await montar('Storm_Call');
  const vida = b.hp;
  assert.ok(usar(e, b).ok);
  assert.equal(b.hp, vida, 'na conjuração, nada');
  const m = e.hunt.poeObjetos.find((o) => o.tipo === 'tormenta');
  assert.ok(m && m.x === b.x && m.y === b.y, 'o marcador está no alvo');
  const ate = m.proxima;
  Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], ate - 100);
  assert.equal(b.hp, vida, 'antes da duração, nada');
  travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], ate));
  assert.ok(b.hp < vida, 'o raio caiu');
  assert.ok(!e.hunt.poeObjetos?.some((o) => o.tipo === 'tormenta'), 'o marcador acabou');
  // a qualidade 20 (15%): no sorteio abaixo de 15, cai na hora
  const q = await montar('Storm_Call', { qualidade: 20 });
  const v2 = q.b.hp;
  assert.ok(usar(q.e, q.b, 0.1).ok);
  assert.ok(q.b.hp < v2, 'caiu na hora');
  assert.ok(!q.e.hunt.poeObjetos?.some((o) => o.tipo === 'tormenta'), 'sem marcador');
  // dois marcadores: o primeiro que cai leva o segundo
  const d = await montar('Storm_Call');
  assert.ok(usar(d.e, d.b).ok);
  d.e.hunt.clock += 1000;
  d.e.hunt.cooldowns = {};
  d.e.hunt.conjurando = null;
  assert.ok(usar(d.e, d.b).ok);
  const [m1, m2] = d.e.hunt.poeObjetos.filter((o) => o.tipo === 'tormenta');
  assert.ok(m2.proxima > m1.proxima);
  travado(0.5, () => Acoes.tiqueDasPlantadas(d.e, d.e.hunt, PERSONAGEM, [], m1.proxima));
  travado(0.5, () => Acoes.tiqueDasPlantadas(d.e, d.e.hunt, PERSONAGEM, [], m1.proxima + 250));
  assert.ok(!d.e.hunt.poeObjetos?.some((o) => o.tipo === 'tormenta'), 'os dois caíram');
});

test('B1 (D-B1.8): a Chuva de Flechas Vaal — 1 + 4 sequências em anéis iguais no raio; cada inimigo leva só o golpe do anel dele', { skip: SEM }, async () => {
  assert.equal(G.sequenciasDaChuvaDaGema('Vaal_Rain_of_Arrows', 20), 5);
  assert.equal(G.sequenciasDaChuvaDaGema('Rain_of_Arrows', 20), null);
  // o raio de 4 casas em 5 anéis: as distâncias 0, 1, 2, 3, 4 → um anel cada
  assert.deepEqual([0, 1, 2, 3, 4].map((d) => B1.anelDaCasa(d, 4, 5)), [0, 1, 2, 3, 4]);
  // o raio de 1 casa: o centro no 1º anel, a borda no 3º
  assert.deepEqual([0, 1].map((d) => B1.anelDaCasa(d, 1, 5)), [0, 2]);
  const { e, b } = await montar('Vaal_Rain_of_Arrows', { arma: 'Bows/Crude_Bow' });
  e.hunt.cooldowns = {};
  const vida = b.hp;
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  const aneis = (r.eventos ?? []).filter((x) => x.t === 'area' && x.sequencia != null);
  assert.ok(aneis.length >= 1, 'os anéis na tela');
  const golpes = (r.eventos ?? []).filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe && !x.empalamento);
  assert.ok(vida - b.hp > 0);
  assert.equal(golpes.length, 1, 'um golpe só no alvo');
});

test('B1 (D-B1.9): a Chuva Tóxica do Definhamento — 1 Definhamento (2 s) por uso em cada inimigo acertado', { skip: SEM }, async () => {
  assert.deepEqual(G.definhamentoDaChuvaDaGema('Toxic_Rain_of_Withering', 20), { n: 1, ms: 2000 });
  assert.equal(G.definhamentoDaChuvaDaGema('Toxic_Rain', 20), null);
  const { e, b } = await montar('Toxic_Rain_of_Withering', { arma: 'Bows/Crude_Bow' });
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.equal(b.estados.definhado?.n, 1);
  assert.ok(b.estados.definhado.ate >= e.hunt.clock + 1000);
});

test('B1: os Estalos Gélidos pulam a recarga gastando uma carga (Frenesi; o do Poder, Poder — o PoB)', { skip: SEM }, async () => {
  const { CARGA_QUE_PULA_A_RECARGA } = await import('../systems/itens-poe/movimento-a1b.mjs');
  assert.deepEqual([CARGA_QUE_PULA_A_RECARGA.Cold_Snap, CARGA_QUE_PULA_A_RECARGA.Cold_Snap_of_Power, CARGA_QUE_PULA_A_RECARGA.Vaal_Cold_Snap], ['frenesi', 'poder', undefined]);
  const { e, b } = await montar('Cold_Snap');
  assert.ok(usar(e, b).ok);
  e.hunt.clock = Math.max(e.hunt.clock, e.hunt.cooldowns?.[Acoes.GRUPO_DO_POE]?.ate ?? 0);
  const recarga = usar(e, b);
  assert.equal(recarga.motivo, 'COOLDOWN');
  cargas(e, { frenesi: 2 });
  const pulou = usar(e, b);
  assert.ok(pulou.ok, pulou.erro);
  assert.equal(CargasPoe.ativas(e).frenesi, 1, 'gastou uma');
});
