// (lote T1, rodada 4, 27/10) AS ATIVAS "IMPLEMENTADAS, SEM TESTE PRÓPRIO" (a fila T1, parte 1): cada uma usada de verdade numa caçada, com o número do nível 20
// conferido com o poedb salvo (ou o PoB, quando o poedb diverge) e cada linha feita medida no uso — com e sem a gema quando dá. Os sorteios ficam travados.
// O que o teste mostrou que o jogo não fazia virou correção (`itens-poe/gemas-t1.mjs`): o Arrastão da Legião Congelada (o dano, o Gelo, a área), o giro de 5 s
// do Ciclone Vaal, o buff Sortudo do Arco Elétrico Vaal, a cadeia de 8 cadáveres da Reação em Cadeia e a qualidade das Purezas (somava no lugar de somar).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const A = await import('./gemas-t1-apoio.mjs');
const { SEM, G, SP, Acoes, Ficha, montar, usar, sorte, perto, celula, doPoedb, danoEm, totalDo, PERSONAGEM } = A;
const GemasT1 = await import('../systems/itens-poe/gemas-t1.mjs');
const AfeccoesPoe = await import('../systems/itens-poe/afeccoes.mjs');

const MACA = 'Two_Hand_Maces/Driftwood_Maul';
const ARCO = 'Bows/Crude_Bow';
const VARINHA = 'Wands/Driftwood_Wand';
const ESPADA = 'One_Hand_Swords/Rusted_Sword';
/** O número de uma célula do poedb ("287, 431" → [287, 431]). */
const nums = (c) => String(c).split(',').map((t) => parseFloat(t));
const st20 = (s, q = 0) => G.compilada(s, 20, q).stats;
/** Os outros monstros da caçada, um a um, nas casas dadas (relativas a você), imortais e sem resistência. */
function por(m, casas) {
  const p = m.e.hunt.pos;
  return casas.map(([dx, dy], i) => Object.assign(m.resto[i], { x: p.x + dx, y: p.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} }));
}
const ferido = (b) => b.hp < b.maxHp;

test('T1: Martelo Glacial do Despedaçamento — 622,6% de dano-base (poedb), 100% do Físico em Gelo e o terceiro golpe seguido Crítico (o Martelo comum não)', { skip: SEM }, async () => {
  const S = 'Glacial_Hammer_of_Shattering';
  assert.ok(perto(st20(S).efetividade, nums(celula(S, 20, /^Base Damage$/))[0] / 100, 1e-3), String(st20(S).efetividade));
  assert.deepEqual(st20(S).conversao, [{ para: 'gelo', pct: 100 }]);
  const tres = async (slug) => {
    const m = await montar(MACA, [[slug]]);
    const r = [];
    for (let i = 0; i < 3; i++) {
      m.e.hunt.clock += 10_000;
      const g = usar(m, 0.99).golpes[0];
      r.push({ crit: g.critico, els: Object.keys(g.detalhe?.porElemento ?? { [g.tipo]: 1 }) });
    }
    return r;
  };
  const d = await tres(S);
  assert.deepEqual(d.map((x) => x.crit), [false, false, true], 'o sorteio 0,99 não critica sozinho: o terceiro é Crítico pela linha');
  assert.ok(d.every((x) => x.els.length === 1 && x.els[0] === 'ice'), JSON.stringify(d));
  assert.deepEqual((await tres('Glacial_Hammer')).map((x) => x.crit), [false, false, false], 'o Martelo Glacial comum: o terceiro só congela mais fácil');
});

test('T1 (correção): Legião Congelada do Agrupamento — o Arrastão Congelante das Estátuas: 184,9% (poedb/PoB), 100% em Gelo, 70% da velocidade, 2,5 m; 5 usos de 0,3 s', { skip: SEM }, async () => {
  const S = 'Frozen_Legion_of_Rallying';
  // (o poedb: "100%, 100%, 100%, 184.9%" — a última parte é a do Arrastão; o PoB, FrozenSweepAltX nível 20: baseMultiplier 1,849, attackSpeedMultiplier −30, radius 25)
  assert.equal(nums(celula(S, 20, /^Base Damage$/)).at(-1), 184.9);
  const st = st20(S);
  assert.deepEqual([st.efetividade, st.conversao, st.velAtaqueBase, st.raio], [1.849, [{ para: 'gelo', pct: 100 }], 70, 2.5]);
  assert.deepEqual([G.temposNoNivel(S, 20).recargaMs, G.temposNoNivel(S, 20).cargas], [300, 5], doPoedb(S).props.join(' | '));
  // (a Legião comum: o Arrastão dela, 332,9%)
  assert.ok(perto(st20('Frozen_Legion').efetividade, 3.329, 1e-6));
  const golpe = async (slug) => {
    const m = await montar(MACA, [[slug]]);
    const u = usar(m, 0.5);
    return { g: u.golpes[0], uso: m.e.hunt.cooldowns['grupo:poe'].total, m };
  };
  const r = await golpe(S);
  const b = await golpe('Frozen_Legion');
  assert.deepEqual(Object.keys(r.g.detalhe.porElemento), ['ice'], 'o Físico da arma vira Gelo');
  assert.ok(perto(r.g.danoAntesDaResistencia / b.g.danoAntesDaResistencia, 1.849 / 3.329, 0.05), `${r.g.danoAntesDaResistencia} / ${b.g.danoAntesDaResistencia}`);
  // (o tempo do ataque: o da arma ÷ 0,7)
  const arma = Ficha.combate(r.m.e).intervaloDoGolpeMs;
  assert.ok(perto(r.uso, arma / 0.7, 0.02), `${r.uso} contra ${arma / 0.7}`);
  // (a área de 2,5 m: o vizinho a 1 casa do alvo também leva)
  const m = await montar(MACA, [[S]]);
  const [viz] = por(m, [[1, 1]]);
  usar(m, 0.5);
  assert.ok(ferido(viz), 'o Arrastão acerta em área');
});

test('T1: Flecha Ardente Vaal — 560% (PoB), Fogo, perfura 3, explode no impacto (1,6 m), 50% de Incendiar, não pode ser Evadida', { skip: SEM }, async () => {
  const S = 'Vaal_Burning_Arrow';
  // (o poedb da tabela traz 420% na coluna — a da Flecha Ardente comum —; o das propriedades e o PoB, VaalBurningArrow nível 20: baseMultiplier 5,6)
  assert.match(doPoedb(S).props.join(' | '), /Dano de Ataque: \(390 — 560\)% de base/);
  assert.equal(st20(S).efetividade, 5.6);
  assert.deepEqual([st20(S).conversao, st20(S).chances.incendiar, G.alvosNoNivel(S, 20).perfurar, G.areaNoImpacto(S, 20).raioM], [[{ para: 'fogo', pct: 100 }], 50, 3, 1.6]);
  // (perfura 3: o alvo e mais 3 na linha; o quinto fica de fora — o sorteio 0,9 > 0,8 dá a explosão de 0 casa, que não pega os colados; a Flecha Ardente comum
  // não perfura)
  const fila = async (slug) => {
    const m = await montar(ARCO, [[slug]]);
    Object.assign(m.b, { x: m.e.hunt.pos.x + 2, y: m.e.hunt.pos.y });
    const resto = por(m, [[3, 0], [4, 0], [5, 0], [6, 0]]);
    const u = usar(m, 0.9);
    return { feridos: [m.b, ...resto].map(ferido), fontes: u.eventos.filter((x) => x.t === 'dmg').map((x) => x.fonte ?? 'direto') };
  };
  const f = await fila(S);
  assert.deepEqual(f.feridos, [true, true, true, true, false]);
  assert.deepEqual(f.fontes, ['direto', 'perfuracao', 'perfuracao', 'perfuracao']);
  assert.deepEqual((await fila('Burning_Arrow')).feridos, [true, false, false, false, false]);
  // (a explosão no impacto: o vizinho colado ao alvo; o sorteio 0,3 < 0,8 dá o raio de 1 casa — 1,6 m ÷ 2)
  const x = await montar(ARCO, [[S]]);
  const [colado] = por(x, [[1, 1]]);
  const u = usar(x, 0.3);
  assert.ok(ferido(colado), 'a explosão');
  assert.deepEqual(Object.keys(u.golpes[0].detalhe.porElemento), ['fire']);
  assert.ok(totalDo(x.b.dots, 'queimadura') > 0, 'o sorteio 0,3 < 50%: Incendeia');
  const sem = await montar(ARCO, [[S]]);
  usar(sem, 0.7);
  assert.equal(totalDo(sem.b.dots, 'queimadura'), 0, 'o sorteio 0,7: não Incendeia');
  // (não pode ser Evadida: o alvo de evasão enorme leva a Vaal; a Flecha Ardente comum erra)
  const evasivo = async (slug) => { const k = await montar(ARCO, [[slug]]); k.b.evasaoPct = 1e7; usar(k, 0.99); return ferido(k.b); };
  assert.deepEqual([await evasivo(S), await evasivo('Burning_Arrow')], [true, false]);
});

test('T1 (correção): Detonar Morto da Reação em Cadeia — 287 a 431 de Fogo, 5% da Vida do cadáver em 2,4 m, e a cadeia até 8 cadáveres (o comum explode 1)', { skip: SEM }, async () => {
  const S = 'Detonate_Dead_of_Chain_Reaction';
  assert.deepEqual(nums(celula(S, 20, /^Causa \d+ a \d+ de Dano de Fogo$/)), [287, 431]);
  assert.deepEqual(st20(S).dano.fogo, [287, 431]);
  const c = G.cadaverDaGema(S, 20);
  assert.deepEqual([c.pct, c.raioExplosaoM], [5, 2.4]);
  assert.equal(GemasT1.cadeiaDeCadaveres(S), 8);
  const explodir = async (slug, casas) => {
    const m = await montar(VARINHA, [[slug]]);
    const p = m.b;
    m.e.hunt.cadaveres = casas.map(([dx, dy], i) => ({ key: `c${i}`, nome: 'Morto', look: 1, x: p.x + dx, y: p.y + dy, maxHp: 10_000 }));
    const u = usar(m, 0.5);
    return { sobram: m.e.hunt.cadaveres.length, m, u };
  };
  // (uma corrente de 3 cadáveres colados e um longe: a cadeia pega os 3 — 1 casa da explosão, 2,4 m ÷ 2 —; o de longe fica)
  const r = await explodir(S, [[0, 0], [1, 0], [2, 0], [6, 0]]);
  assert.equal(r.sobram, 1);
  const base = await explodir('Detonate_Dead', [[0, 0], [1, 0], [2, 0], [6, 0]]);
  assert.equal(base.sobram, 3, 'o Detonar Mortos comum: um cadáver');
  // (no máximo 8: dez cadáveres colados, em duas fileiras ao alcance)
  const dez = await explodir(S, Array.from({ length: 10 }, (_, i) => [i % 5, Math.floor(i / 5)]));
  assert.equal(dez.sobram, 2);
  // (a explosão: 5% de 10.000 de Vida = 500 de Fogo base, com o aumento de Fogo da ficha)
  const f = Ficha.combate(r.m.e);
  const esperado = 500 * Math.max(0, 1 + (f.danoDoElemento?.fire ?? 0) / 100);
  // (o alvo, colado aos cadáveres 0 e 1 — o 2 está a 2 casas —, leva duas explosões; e o acerto da magia, na faixa de 287 a 431)
  const doAlvo = r.u.eventos.filter((x) => x.t === 'dmg' && x.uid === r.m.b.uid && x.sk && !x.spell).map((x) => x.v);
  assert.equal(doAlvo.length, 2, String(doAlvo));
  assert.ok(doAlvo.every((v) => perto(v, esperado, 0.02)), `${doAlvo} contra ${esperado}`);
  const magia = r.u.golpes[0];
  assert.deepEqual([magia.tipo, magia.detalhe.min, magia.detalhe.max], ['fire', 287, 431]);
});

test('T1: Laceração da Hemorragia — 346% (poedb), 25% de chance de Sangramento e 132% mais Dano com Sangramento', { skip: SEM }, async () => {
  const S = 'Lacerate_of_Haemorrhage';
  assert.ok(perto(st20(S).efetividade, 3.46, 1e-3));
  assert.deepEqual([st20(S).chances.sangrar, st20(S).maisSangramentoPct, nums(celula(S, 20, /mais Dano com Sangramento/))[0]], [25, 132, 132]);
  const m = await montar(ESPADA, [[S]]);
  const u = usar(m, 0.2);
  const fis = u.golpes.reduce((t, g) => t + (g.detalhe?.porElemento?.physical ?? 0), 0);
  const sangue = totalDo(m.b.dots, 'sangramento');
  assert.ok(fis > 0 && sangue > 0, 'o sorteio 0,2 < 25%: Sangra');
  // (o Sangramento do PoE: 70% do Físico por segundo, 5 s; × 2,32 da linha)
  const base = AfeccoesPoe.BASE.sangramento;
  assert.ok(perto(sangue / fis, base.porSegundo * (base.duracaoMs / 1000) * 2.32, 0.03), `${sangue} / ${fis}`);
  const n = await montar(ESPADA, [[S]]);
  usar(n, 0.3);
  assert.equal(totalDo(n.b.dots, 'sangramento'), 0, 'o sorteio 0,3: não Sangra');
});

test('T1: Chuva de Flechas da Saturação — 35% (poedb), 33 flechas (+8 na qualidade 20), a área acerta em volta do alvo', { skip: SEM }, async () => {
  const S = 'Rain_of_Arrows_of_Saturation';
  assert.ok(perto(st20(S).efetividade, 0.35, 1e-3));
  assert.deepEqual([nums(celula(S, 20, /^Dispara \d+ Flechas$/))[0], G.alvosNoNivel(S, 20).base, G.alvosNoNivel(S, 20, 20).base + G.alvosNoNivel(S, 20, 20).projeteis], [33, 33, 41]);
  const m = await montar(ARCO, [[S]]);
  Object.assign(m.b, { x: m.e.hunt.pos.x + 4, y: m.e.hunt.pos.y });
  const [cima, baixo, longe] = por(m, [[4, -1], [4, 1], [8, 0]]);
  const u = usar(m, 0.3);
  assert.deepEqual([m.b, cima, baixo, longe].map(ferido), [true, true, true, false]);
  assert.ok(u.golpes.every((g) => g.tipo === 'physical'));
});

for (const [S, el, nome] of [['Purity_of_Ice', 'ice', 'Gelo'], ['Purity_of_Lightning', 'energy', 'Raio']]) {
  test(`T1 (correção): ${S} — +41% de Resistência a ${nome} e +4% da máxima (poedb), raio 3,6 + 1,9 m; a qualidade 20 SOMA mais 10%`, { skip: SEM }, async () => {
    assert.deepEqual(nums(celula(S, 20, /de Resistência a (Gelo|Raio) adicional$/)), [41]);
    assert.deepEqual(G.buffNoNivel(S, 20).af, { [`${el}_res`]: 41, [`${el}_res_max`]: 4 });
    assert.equal(G.buffNoNivel(S, 20).raioM, 3.6 + 1.9);
    assert.deepEqual(G.buffNoNivel(S, 20, 20).af, { [`${el}_res`]: 51, [`${el}_res_max`]: 4 }, 'antes: 10 (a linha da qualidade substituía a do nível)');
    for (const q of [0, 20]) {
      const m = await montar(ESPADA, [[S]], { qualidade: q });
      const antes = Ficha.combate(m.e);
      usar(m, 0.5);
      assert.ok(m.e.hunt.buffs?.[G.doSlug(S).acao], 'a aura ligada');
      Ficha.invalidar(m.e);
      const depois = Ficha.combate(m.e);
      assert.equal((depois.afPoe[`${el}_res`] ?? 0) - (antes.afPoe[`${el}_res`] ?? 0), q ? 51 : 41);
      assert.equal((depois.afPoe[`${el}_res_max`] ?? 0) - (antes.afPoe[`${el}_res_max`] ?? 0), 4);
      assert.equal(Ficha.maximoDaResistencia(depois.afPoe, el), Ficha.maximoDaResistencia(antes.afPoe, el) + 4);
    }
  });
}

test('T1 (correção): Ciclone Vaal — gira 5 s (× a Duração): um acerto a cada tempo de ataque dele (300%); 220,8% de dano (poedb); não pode ser Evadido', { skip: SEM }, async () => {
  const S = 'Vaal_Cyclone';
  assert.deepEqual([st20(S).duracao, G.temposNoNivel(S, 20).velAtaqueBase], [5, 300]);
  assert.match(doPoedb(S).props.join(' | '), /Dano de Ataque: \(130 — 221\)% de base/);
  assert.equal(nums(celula(S, 20, /^Base Damage$/))[0], 220.8);
  assert.ok(perto(st20(S).efetividade, 2.208, 1e-3), String(st20(S).efetividade));
  const giro = async (sup = []) => {
    const m = await montar(MACA, [[S, ...sup]]);
    m.b.evasaoPct = 1e7;
    const entry = Acoes.POR_ID_PUBLICO(G.doSlug(S).acao);
    const ef = A.GS.efeitoNaSkill(m.e, entry.id);
    const ataque = Acoes.temposDaGemaPoe(m.e, entry, ef).uso;
    const durMs = 5000 * Acoes.fatorDeDuracao(m.e, entry, ef);
    const u = usar(m, 0.99);
    return { n: u.golpes.length, esperado: Math.round(durMs / ataque), canal: m.e.hunt.canalizacao.ate - m.e.hunt.canalizacao.desde, durMs, ferido: ferido(m.b) };
  };
  const r = await giro();
  assert.ok(r.n > 1, 'antes: um acerto só');
  assert.equal(r.n, r.esperado, JSON.stringify(r));
  assert.ok(perto(r.canal, r.durMs, 0.06), `o uso ocupa o giro: ${r.canal} ms`);
  assert.ok(r.ferido, 'não pode ser Evadido: acerta o alvo de evasão enorme');
  // (com a Mais Duração — 39% mais: mais acertos no giro)
  const d = await giro(['More_Duration_Support']);
  assert.equal(d.n, d.esperado);
  assert.ok(perto(d.durMs / r.durMs, 1.39, 1e-6) && d.n > r.n, `${d.n} contra ${r.n}`);
});

test('T1: Faísca da Imprevisibilidade — 104 a 1983 de Raio (poedb), 7 projéteis (+2 na qualidade 20)', { skip: SEM }, async () => {
  const S = 'Spark_of_Unpredictability';
  assert.deepEqual(st20(S).dano.raio, [104, 1983]);
  assert.deepEqual([nums(celula(S, 20, /^Dispara \d+ projéteis$/))[0], G.alvosNoNivel(S, 20).base, G.alvosNoNivel(S, 20, 20).projeteis], [7, 7, 2]);
  const tiros = async (q, v) => {
    const m = await montar(VARINHA, [[S]], { qualidade: q });
    const u = usar(m, v);
    return { shots: u.eventos.filter((x) => x.t === 'shot').length, g: u.golpes[0], m };
  };
  const a = await tiros(0, 0.5);
  assert.equal(a.shots, 7);
  assert.equal((await tiros(20, 0.5)).shots, 9);
  assert.equal(a.g.tipo, 'energy');
  assert.deepEqual([a.g.detalhe.min, a.g.detalhe.max], [104, 1983], 'a faixa do nível 20 no golpe');
});

test('T1: Salva Ardente — 270 a 405 de Fogo (poedb), 7 projéteis e a área de 1,6 m no impacto (PoB)', { skip: SEM }, async () => {
  const S = 'Blazing_Salvo';
  assert.deepEqual([nums(celula(S, 20, /^Causa \d+ a \d+ de Dano de Fogo$/)), st20(S).dano.fogo, G.alvosNoNivel(S, 20).base, G.areaNoImpacto(S, 20).raioM], [[270, 405], [270, 405], 7, 1.6]);
  const m = await montar(VARINHA, [[S]]);
  const [colado] = por(m, [[1, 1]]);
  const u = usar(m, 0.3);
  assert.equal(u.eventos.filter((x) => x.t === 'shot').length, 7);
  assert.ok(u.eventos.some((x) => x.t === 'explosao'), 'a explosão no impacto');
  assert.ok(ferido(colado), 'o colado ao alvo leva a área (0,3 < 0,8: raio de 1 casa)');
  assert.deepEqual([u.golpes[0].tipo, u.golpes[0].detalhe.min, u.golpes[0].detalhe.max], ['fire', 270, 405]);
});

test('T1: Incinerar da Exaustão — 272 a 408 de Fogo, 25% mais por estágio até 15 (+3 na qualidade 20), +0,5 m de raio por estágio até +3 m', { skip: SEM }, async () => {
  const S = 'Incinerate_of_Venting';
  assert.deepEqual([nums(celula(S, 20, /^Causa \d+ a \d+ de Dano de Fogo$/)), nums(celula(S, 20, /metros ao raio por estágio/))], [[272, 408], [0.5, 3]]);
  const est = G.estagiosDaGema(S, 20);
  assert.equal(est.max, 15);
  assert.equal(G.estagiosDaGema(S, 20, 20).max, 18);
  const m = await montar(VARINHA, [[S]]);
  const fatores = [];
  const casas = [];
  for (let i = 0; i < 17; i++) {
    if (i) m.e.hunt.clock = Math.max(m.e.hunt.clock, m.e.hunt.canalizacao?.ate ?? m.e.hunt.clock);
    const u = usar(m, 0.5);
    fatores.push(u.golpes[0].detalhe.fatorDaGema);
    casas.push(u.eventos.filter((x) => x.t === 'area').reduce((t, x) => t + (x.casas?.length ?? 0), 0));
  }
  // (cada uso canalizando sobe um estágio: 1,25 no primeiro, até 1 + 0,25 × 15 = 4,75; depois fica)
  assert.deepEqual(fatores.map((f) => Math.round(f * 100) / 100), [...Array.from({ length: 15 }, (_, i) => 1 + 0.25 * (i + 1)), 4.75, 4.75]);
  assert.ok(casas[6] > casas[0], `a área cresce com os estágios: ${casas}`);
  assert.equal(casas[16], casas[14], 'o raio para no máximo');
});

test('T1 (correção): Arco Elétrico Vaal — 924 a 1539 de Raio, +9 ricochetes, 15% mais por restante, Eletriza sempre (efeito e duração ×2) e o buff Sortudo de 4 s', { skip: SEM }, async () => {
  const S = 'Vaal_Arc';
  assert.deepEqual([nums(celula(S, 20, /^Causa \d+ a \d+ de Dano de Raio$/)), nums(celula(S, 20, /^Ricocheteia \+\d+ Vezes$/))[0], st20(S).duracao], [[924, 1539], 9, 4]);
  const al = G.alvosNoNivel(S, 20);
  assert.deepEqual([al.saltos, al.pctPorRestante], [9, 15]);
  // (a Eletrização do PoE pelo dano contra o limiar: o alvo com 20.000 de Vida)
  const m = await montar(VARINHA, [[S]]);
  Object.assign(m.b, { hp: 20_000, maxHp: 20_000 });
  const u = usar(m, 0.5);
  assert.equal(u.golpes[0].detalhe.porcentagemDoGolpe, 100 + 15 * 9, 'o primeiro acerto, com os 9 restantes');
  const choque = m.b.estados.chocado;
  assert.ok(choque, '100% de chance de Eletrizar');
  assert.equal(m.e.hunt.poeArcoSortudo, m.e.hunt.clock + 4000, 'o buff de 4 s');
  // (a Eletrização com a duração e o efeito dobrados: 2 s × 2; 50% × (dano ÷ Vida)^0,4 × 2, até 50% — `AfeccoesPoe.forca`)
  const raio = u.golpes[0].danoAntesDaResistencia;
  assert.equal(choque.ate - m.e.hunt.clock, AfeccoesPoe.BASE.eletrizacao.duracaoMs * 2);
  assert.ok(perto(choque.pct, Math.min(50, 2 * AfeccoesPoe.forca(raio, 20_000, { minimo: 5, maximo: 50 })), 0.02), `${choque.pct} (dano ${raio})`);
  const c = await montar(VARINHA, [['Arc']]);
  usar(c, 0.5);
  assert.equal(c.e.hunt.poeArcoSortudo, undefined, 'o Arco comum não liga o buff');
  // (o Sortudo: o mesmo sorteio, com e sem o buff — rola duas vezes e fica o maior; o dano médio sobe; depois dos 4 s volta)
  const media = async (buff) => {
    const k = await montar(VARINHA, [['Arc']]);
    let s = 0;
    let semente = 12345;
    const rng = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
    const o = Math.random;
    Math.random = rng;
    try {
      for (let i = 0; i < 60; i++) {
        k.e.hunt.clock += 2000;
        if (buff === 'sim') GemasT1.ligarArcoSortudo(k.e.hunt, k.e.hunt.clock + 4000);
        if (buff === 'acabou') k.e.hunt.poeArcoSortudo = k.e.hunt.clock - 1;
        A.Registro.definirNivel(2); A.Registro.limparRegistro();
        const r = Acoes.disparar(k.e, k.e.hunt, PERSONAGEM, 0, k.b, { manual: true });
        assert.ok(r.ok, JSON.stringify(r));
        if (k.e.hunt.conjurando) { k.e.hunt.clock = k.e.hunt.conjurando.fim; Acoes.concluirConjuracao(k.e, k.e.hunt, PERSONAGEM); }
        s += A.Registro.ultimosGolpes(50).filter((g) => g.origem === 'gema')[0]?.danoAntesDaResistencia ?? 0;
        A.Registro.definirNivel(0);
      }
    } finally { Math.random = o; }
    return { s, hunt: k.e.hunt };
  };
  const sem = await media('nao');
  const com = await media('sim');
  const acabou = await media('acabou');
  assert.ok(com.s > sem.s * 1.08, `Sortudo: ${com.s} contra ${sem.s}`);
  assert.equal(acabou.hunt.poeArcoSortudo, undefined, 'o buff vencido sai');
  assert.ok(acabou.s < com.s, 'sem o buff, o sorteio de sempre');
  assert.ok(GemasT1.ehArco('Arc_of_Surging') && GemasT1.ehArco('Vaal_Arc') && !GemasT1.ehArco('Arctic_Breath'));
});

test('T1: Explosão Flamejante da Contração — 171 a 256, 600% mais Mágico e 250% mais nas Afecções por estágio, 10 estágios (+1 na q20), 3 m − 0,2 m por estágio', { skip: SEM }, async () => {
  const S = 'Flameblast_of_Contraction';
  assert.deepEqual(nums(celula(S, 20, /^Causa \d+ a \d+ de Dano de Fogo$/)), [171, 256]);
  const est = G.estagiosDaGema(S, 20);
  assert.deepEqual([est.max, est.mais, est.maisAfeccao, G.estagiosDaGema(S, 20, 20).max], [10, 600, 250, 11]);
  assert.equal(st20(S).chances.incendiar, 50);
  const m = await montar(VARINHA, [[S]]);
  const casasPorUso = [];
  let u;
  for (let i = 0; i < est.max; i++) {
    if (i) m.e.hunt.clock = Math.max(m.e.hunt.clock, m.e.hunt.canalizacao?.ate ?? m.e.hunt.clock);
    m.b.dots = [];
    u = usar(m, 0.3);
    casasPorUso.push(u.eventos.filter((x) => x.t === 'area').map((x) => x.casas?.length ?? 0));
  }
  // (só a liberação acerta, com 1 + 6 × 10 = 61 no "mais" Mágico)
  assert.equal(u.golpes.length, 1);
  assert.equal(u.golpes[0].detalhe.fatorDaGema, 61);
  // (o Incêndio: o sorteio 0,3 < 50%; a afecção leva 1 + 2,5 × 10 = 26 e não os 61 do acerto)
  const fogo = u.golpes[0].danoAntesDaResistencia;
  const queima = totalDo(m.b.dots, 'queimadura');
  const inc = AfeccoesPoe.BASE.incendio;
  assert.ok(perto(queima / fogo, inc.porSegundo * (inc.duracaoMs / 1000) * (26 / 61), 0.03), `${queima} / ${fogo}`);
  // (o raio encolhe: 3 m − 0,2 × 10 = 1 m na liberação — menos casas que o primeiro)
  // (o raio encolhe: 3 m − 0,2 m por estágio; na liberação, 3 − 0,2 × 10 = 1 m = 0,5 casa — com o sorteio 0,7 acima da fração, só a casa do centro; no primeiro uso,
  // 2,8 m = 1,4 casa → 1 casa de raio, 3 × 3)
  const n = await montar(VARINHA, [[S]]);
  const areas = [];
  for (let i = 0; i < est.max; i++) {
    if (i) n.e.hunt.clock = Math.max(n.e.hunt.clock, n.e.hunt.canalizacao?.ate ?? n.e.hunt.clock);
    areas.push(usar(n, 0.7).eventos.filter((x) => x.t === 'area').map((x) => x.casas?.length ?? 0).at(-1));
  }
  assert.equal(areas[0], 9, JSON.stringify(areas));
  assert.equal(areas.at(-1), 1, JSON.stringify(areas));
  assert.ok(casasPorUso.length === est.max);
});

test('T1: Pacto de Ghorr — 1521,1 de Físico por segundo (poedb, nível 20) no alvo, por 4 s; recarga de 4 s', { skip: SEM }, async () => {
  const S = 'Pact_of_Ghorr';
  assert.deepEqual([G.textosDaGema(S, 20).linhas, G.temposNoNivel(S, 20).recargaMs], [['Causa 1521.1 de Dano Físico Base por segundo'], 4000]);
  const m = await montar(VARINHA, [[S]]);
  usar(m, 0.5);
  const dot = m.b.dots.find((d) => d.tipo === 'degenFisico');
  assert.ok(dot, JSON.stringify(m.b.dots));
  const f = Ficha.combate(m.e);
  const porSegundo = (dot.porPulso * 1000) / (dot.proximo - dot.desde);
  assert.ok(porSegundo >= 1521.1 * 0.999, `${porSegundo}`);
  assert.equal(dot.ate - dot.desde, 4000);
  assert.ok(perto(dot.falta, porSegundo * 4, 0.01));
  assert.ok(f);
  m.e.hunt.clock += 1000;
  const r = Acoes.disparar(m.e, m.e.hunt, PERSONAGEM, 0, m.b, { manual: true });
  assert.equal(r.ok, false, 'a recarga de 4 s');
});
