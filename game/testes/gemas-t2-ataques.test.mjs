// (lote T2, rodada 4 — 27/10) AS ATIVAS DE ATAQUE da fila T2 (as que estavam "implementada, sem teste próprio"): usadas numa caçada, com os sorteios travados — o dano
// e cada linha feita, com o número do nível 20 conferido com o poedb ou o PoB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEM, G, Acoes, montar, usar, danoEm, golpesEm, perto } from './gemas-t2-apoio.mjs';

const GemasT2 = await import('../systems/itens-poe/gemas-t2.mjs');

// ---------------------------------------------------------------- Flecha Cáustica do Envenenamento

test('T2 Caustic_Arrow_of_Poison: 91% de dano de ataque, 60% do Físico vira Caos e 40% de chance de Envenenar (o poedb/PoB, nível 20)', { skip: SEM }, async () => {
  const c = G.compilada('Caustic_Arrow_of_Poison', 20);
  assert.deepEqual([c.stats.efetividade, c.stats.conversao, c.stats.chances.envenenar], [0.91, [{ para: 'caos', pct: 60 }], 40]);
  // a conversão: o Caos com 50% de resistência tira metade de 60% do golpe; o Físico com 50%, metade de 40%
  const dano = async (resist, v = 0.5) => { const { e, b } = await montar(['Caustic_Arrow_of_Poison'], { arma: 'Bows/Crude_Bow' }); b.resist = resist; return { d: danoEm(usar(e, 0, b, v).ev, b), b }; };
  const base = (await dano({})).d;
  const caos = (await dano({ chaos: 50 })).d;
  const fis = (await dano({ physical: 50 })).d;
  assert.ok(base > 800, String(base));
  assert.ok(perto((base - caos) / base, 0.3, 0.02), `caos: ${base} → ${caos}`);
  assert.ok(perto((base - fis) / base, 0.2, 0.03), `físico: ${base} → ${fis}`);
  // o Veneno: o sorteio 0,3 (< 40%) envenena — 30% do dano por segundo, 2 s; o 0,5 não
  const { b: comVeneno } = await dano({}, 0.3);
  const v = comVeneno.dots.find((d) => d.tipo === 'venenoPoe');
  assert.ok(v, JSON.stringify(comVeneno.dots));
  assert.equal(v.ate - v.desde, 2000);
  assert.equal((await dano({}, 0.5)).b.dots.filter((d) => d.tipo === 'venenoPoe').length, 0);
});

test('T2 Caustic_Arrow_of_Poison: explode em área no impacto (o raio 2 + 0,6 m) — o vizinho do alvo também sofre', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Caustic_Arrow_of_Poison'], { arma: 'Bows/Crude_Bow' });
  const [viz, longe] = resto;
  Object.assign(viz, { x: b.x, y: b.y + 1, estados: {}, dots: [] });
  Object.assign(longe, { x: b.x + 4, y: b.y, estados: {}, dots: [] });
  const { ev } = usar(e, 0, b);
  assert.ok(danoEm(ev, b) > 0);
  assert.ok(danoEm(ev, viz) > 0, 'o vizinho a 1 casa');
  assert.equal(danoEm(ev, longe), 0, 'o de 4 casas, não');
});

// ---------------------------------------------------------------- Flecha Cáustica Vaal

test('T2 Vaal_Caustic_Arrow: 400% de dano, 60% Físico → Caos, 4622,5 de Caos por segundo por 6 s, perfura todos e não pode ser Evadida (poedb/PoB, nível 20)', { skip: SEM }, async () => {
  const c = G.compilada('Vaal_Caustic_Arrow', 20);
  assert.deepEqual([c.stats.dot, c.stats.duracao, c.stats.perfura, c.stats.almas, c.stats.conversao], [[{ el: 'caos', dps: 4622.5 }], 6, 99, 20, [{ para: 'caos', pct: 60 }]]);
  assert.equal(G.linhasLocaisNoNivel('Vaal_Caustic_Arrow', 20, 0).af.nunca_erra, 1);
  const { e, b, resto } = await montar(['Vaal_Caustic_Arrow'], { arma: 'Bows/Crude_Bow' });
  // o de trás, na mesma linha: a flecha perfura
  const atras = resto[0];
  Object.assign(atras, { x: b.x + 1, y: b.y, estados: {}, dots: [] });
  // a evasão enorme: o ataque comum erraria; o da Vaal, não
  b.evasaoPct = 1e6;
  const { r, ev } = usar(e, 0, b, 0.99);
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok(danoEm(ev, b) > 0, 'não pode ser Evadido');
  assert.ok(danoEm(ev, atras) > 0, 'perfurou');
  const d = b.dots.find((x) => x.chave === 'Vaal_Caustic_Arrow');
  assert.ok(d, JSON.stringify(b.dots));
  assert.equal(d.ate - d.desde, 6000);
  assert.ok(perto(d.falta, 4622.5 * 6, 0.01), `${d.falta}`);
});

test('T2 Vaal_Caustic_Arrow: o golpe é 400% do dano da arma no 20 (o PoB e a propriedade do poedb) — antes saía com os 64,4% da coluna velha', { skip: SEM }, async () => {
  assert.equal(G.compilada('Vaal_Caustic_Arrow', 20).stats.efetividade, 4);
  assert.equal(G.compilada('Vaal_Caustic_Arrow', 1).stats.efetividade, 2.8);
  const golpe = async (slug) => { const { e, b } = await montar([slug], { arma: 'Bows/Crude_Bow' }); return danoEm(usar(e, 0, b).ev, b); };
  // (as duas convertem 60% para Caos: a razão dos golpes é a das efetividades, 4 ÷ 0,91)
  const vaal = await golpe('Vaal_Caustic_Arrow');
  const comum = await golpe('Caustic_Arrow_of_Poison');
  assert.ok(perto(vaal / comum, 4 / 0.91, 0.02), `${vaal} / ${comum}`);
});

test('T2 Vaal_Caustic_Arrow: o arco comum com a mesma evasão erra (o controle do "não pode ser Evadido")', { skip: SEM }, async () => {
  const { e, b } = await montar(['Caustic_Arrow_of_Poison'], { arma: 'Bows/Crude_Bow' });
  b.evasaoPct = 1e6;
  assert.equal(danoEm(usar(e, 0, b, 0.99).ev, b), 0);
});

// ---------------------------------------------------------------- Punctura do Estilhaço

test('T2 Puncture_of_Shanking: 437,9% de dano, sempre Sangra, 49% mais Dano com Sangramento (+20% na qualidade 20), duração base 6 s (poedb/PoB, nível 20)', { skip: SEM }, async () => {
  const c = G.compilada('Puncture_of_Shanking', 20);
  assert.deepEqual([c.stats.efetividade, c.stats.chances.sangrar, c.stats.maisSangramentoPct, c.stats.duracao, c.stats.velAtaqueBase], [4.379, 100, 49, 6, 70]);
  assert.equal(G.compilada('Puncture_of_Shanking', 20, 20).stats.maisSangramentoPct, 69);
  assert.deepEqual(G.linhasLocaisNoNivel('Puncture_of_Shanking', 20, 0).af, { 'crit_chance_inc@alvoSangrando': 118 });
  // o Sangramento: 70% do Físico do golpe por segundo × 1,49; com a qualidade 20, × 1,69 (o mesmo golpe)
  const sang = async (q) => { const { e, b } = await montar(['Puncture_of_Shanking'], { arma: 'Daggers/Sai', qualidade: q }); const g = danoEm(usar(e, 0, b).ev, b); return { g, d: b.dots.find((x) => x.tipo === 'sangramento') }; };
  const s0 = await sang(0);
  const s20 = await sang(20);
  assert.ok(s0.d && s20.d);
  const porSeg = (d) => d.falta / ((d.ate - d.desde) / 1000);
  assert.ok(perto(porSeg(s0.d) / (0.7 * s0.g), 1.49, 0.01), `${porSeg(s0.d)} / 0,7 × ${s0.g}`);
  assert.ok(perto(porSeg(s20.d) / porSeg(s0.d), 1.69 / 1.49, 0.005));
});

test('T2 Puncture_of_Shanking: o Sangramento dura a duração da HABILIDADE — 6 s (não os 5 s do Sangramento comum), e cresce com o "mais Duração" (o PoB: bleed_duration_is_skill_duration)', { skip: SEM }, async () => {
  const { e, b } = await montar(['Puncture_of_Shanking'], { arma: 'Daggers/Sai' });
  usar(e, 0, b);
  const d = b.dots.find((x) => x.tipo === 'sangramento');
  assert.equal(d.ate - d.desde, 6000, 'antes, 5000');
  // (a Punctura comum: 8 s)
  const { e: e2, b: b2 } = await montar(['Puncture'], { arma: 'Daggers/Sai' });
  usar(e2, 0, b2);
  const d2 = b2.dots.find((x) => x.tipo === 'sangramento');
  assert.equal(d2.ate - d2.desde, 8000);
  // com o Mais Duração (39% mais Duração do Efeito de Habilidades no 20): 6 × 1,39
  const { e: e3, b: b3 } = await montar(['Puncture_of_Shanking', 'More_Duration_Support'], { arma: 'Daggers/Sai' });
  usar(e3, 0, b3);
  const d3 = b3.dots.find((x) => x.tipo === 'sangramento');
  assert.equal(d3.ate - d3.desde, Math.round(6000 * 1.39));
});

test('T2 Puncture_of_Shanking: +118% de Chance de Crítico contra o inimigo Sangrando — o sorteio de 0,12 não é crítico no primeiro golpe e é no segundo (já sangrando)', { skip: SEM }, async () => {
  const { e, b } = await montar(['Puncture_of_Shanking'], { arma: 'Daggers/Sai' });
  const g1 = golpesEm(usar(e, 0, b, 0.12).ev, b);
  assert.ok(g1.length && !g1.some((x) => x.crit), 'não sangrava');
  e.hunt.clock += 3000;
  const g2 = golpesEm(usar(e, 0, b, 0.12).ev, b);
  assert.ok(g2.some((x) => x.crit), 'sangrando: crítico');
  // (o controle: a Punctura comum, sem a linha, não é crítica no segundo golpe com o mesmo sorteio)
  const { e: e2, b: b2 } = await montar(['Puncture'], { arma: 'Daggers/Sai' });
  usar(e2, 0, b2, 0.12);
  e2.hunt.clock += 3000;
  assert.ok(!golpesEm(usar(e2, 0, b2, 0.12).ev, b2).some((x) => x.crit));
});

// ---------------------------------------------------------------- Golpe Relampejante do Arco

test('T2 Lightning_Strike_of_Arcing: 377,4% de dano e Ricocheteia 7 vezes no 20 (+2 com qualidade 20, o PoB); 50% do Físico vira Raio (antes, todo Físico)', { skip: SEM }, async () => {
  const c = G.compilada('Lightning_Strike_of_Arcing', 20);
  assert.ok(perto(c.stats.efetividade, 3.774));
  assert.deepEqual([c.stats.ricochetes, c.stats.conversao], [7, [{ para: 'raio', pct: 50 }]]);
  assert.equal(G.alvosNoNivel('Lightning_Strike_of_Arcing', 20, 0).saltos, 7);
  assert.equal(G.alvosNoNivel('Lightning_Strike_of_Arcing', 20, 20).saltos, 9);
  // a família converte (o PoB: os três têm skill_physical_damage_%_to_convert_to_lightning 50)
  assert.deepEqual(G.compilada('Lightning_Strike', 20).stats.conversao, [{ para: 'raio', pct: 50 }]);
  assert.deepEqual(G.compilada('Vaal_Lightning_Strike', 20).stats.conversao, [{ para: 'raio', pct: 50 }]);
  const dano = async (resist) => { const { e, b } = await montar(['Lightning_Strike_of_Arcing']); b.resist = resist; return danoEm(usar(e, 0, b).ev, b); };
  const base = await dano({});
  const raio = await dano({ energy: 50 });
  assert.ok(perto((base - raio) / base, 0.25, 0.02), `${base} → ${raio}`);
});

test('T2 Lightning_Strike_of_Arcing: 10% mais Dano por ricochete da gema (70% no 20) no golpe; o projétil que ricocheteia causa 50% menos (o PoB)', { skip: SEM }, async () => {
  const { e, b, resto } = await montar(['Lightning_Strike_of_Arcing']);
  [[1, 1], [2, 0], [3, 1]].forEach(([dx, dy], i) => Object.assign(resto[i], { x: b.x + dx, y: b.y + dy, estados: {}, dots: [] }));
  const { ev } = usar(e, 0, b);
  const alvo = danoEm(ev, b);
  // o golpe: 1000 × 3,774 × 1,7, menos o que o bicho tira (o mesmo nos dois)
  const { e: e2, b: b2 } = await montar(['Lightning_Strike']);
  const comum = danoEm(usar(e2, 0, b2).ev, b2);
  assert.ok(perto(alvo / comum, (3.774 * 1.7) / 4.56, 0.01), `${alvo} / ${comum}`);
  // os três ricochetes: metade do golpe do alvo
  for (const m of resto.slice(0, 3)) assert.ok(perto(danoEm(ev, m) / alvo, 0.5, 0.01), `${danoEm(ev, m)} / ${alvo}`);
});

// ---------------------------------------------------------------- Aço Estraçalhador

test('T2 Shattering_Steel: 265% de dano, 85% de velocidade, 3 projéteis e 40% de chance de Empalar; a qualidade 20 dá +40% de Efeito do Empalamento (poedb/PoB)', { skip: SEM }, async () => {
  const c = G.compilada('Shattering_Steel', 20);
  assert.deepEqual([c.stats.efetividade, c.stats.velAtaqueBase, c.stats.projeteis, c.stats.chances.empalar], [2.65, 85, 3, 40]);
  assert.equal(G.linhasLocaisNoNivel('Shattering_Steel', 20, 20).af.efeito_empalamento, 40);
  const { e, b, resto } = await montar(['Shattering_Steel']);
  [[0, 1], [1, 0], [0, -1]].forEach(([dx, dy], i) => Object.assign(resto[i], { x: b.x + dx, y: b.y + dy, estados: {}, dots: [] }));
  const { ev } = usar(e, 0, b, 0.3);
  // os 3 projéteis: o alvo e os 2 mais perto (um por inimigo)
  const atingidos = [b, ...resto.slice(0, 3)].filter((m) => danoEm(ev, m) > 0);
  assert.equal(atingidos.length, 3);
  assert.ok(perto(danoEm(ev, b), 2650, 0.02), String(danoEm(ev, b)));
  // o sorteio 0,3 (< 40%) Empala o alvo — guarda 10% do Físico do golpe (2650), por 8 s e 5 acertos; o 0,5, não
  assert.deepEqual(b.estados.empalado, [{ valor: 265, acertos: 5, ate: e.hunt.clock + 8000 }]);
  const { e: e2, b: b2 } = await montar(['Shattering_Steel']);
  usar(e2, 0, b2, 0.5);
  assert.equal(b2.estados.empalado, undefined);
  // a qualidade 20: o Empalamento guarda 40% a mais (10% × 1,4)
  const { e: e3, b: b3 } = await montar(['Shattering_Steel'], { qualidade: 20 });
  usar(e3, 0, b3, 0.3);
  assert.equal(b3.estados.empalado[0].valor, 371);
});

// ---------------------------------------------------------------- Chuva Cinética

test('T2 Kinetic_Rain: pelo PoB (o poedb salvo veio sem as linhas) — 8 projéteis (+2 na qualidade 20), o retângulo 9 × 4,5 m à frente, a explosão de 1,2 m, 25% de dano e 200% de Poder Arcano', { skip: SEM }, async () => {
  const c = G.compilada('Kinetic_Rain', 20);
  assert.deepEqual([c.arquetipo, c.stats.efetividade, c.stats.projeteis, c.stats.raio], ['chuva', 0.25, 8, 1.2]);
  assert.equal(G.alvosNoNivel('Kinetic_Rain', 20, 0).base, 8);
  assert.equal(G.alvosNoNivel('Kinetic_Rain', 20, 20).projeteis, 2);
  assert.deepEqual(G.sequenciaDaGema('Kinetic_Rain', 20), { forma: 'chuvaRetangular', comprimentoM: 9, larguraM: 4.5 });
  assert.equal(G.linhasLocaisNoNivel('Kinetic_Rain', 20).af.poder_arcano, 200);
  // antes: um tiro de varinha de 25% num alvo só. Agora: os 8 projéteis caem nos inimigos da área (um por inimigo, de novo do primeiro quando sobram — a regra da do
  // Impacto) e cada um explode — o alvo sozinho leva os 8
  const { e, b } = await montar(['Kinetic_Rain'], { arma: 'Wands/Driftwood_Wand' });
  const { r, ev } = usar(e, 0, b);
  assert.ok(r.ok, JSON.stringify(r));
  const g = golpesEm(ev, b);
  assert.equal(g.length, 8);
  // dois inimigos na área: 4 explosões em cada (o vizinho a 1 casa do outro leva as do outro também — a explosão é de 1,2 m)
  const { e: e2, b: b2, resto } = await montar(['Kinetic_Rain'], { arma: 'Wands/Driftwood_Wand' });
  Object.assign(resto[0], { x: b2.x + 3, y: b2.y, estados: {}, dots: [] });
  Object.assign(resto[1], { x: b2.x + 12, y: b2.y, estados: {}, dots: [] });
  const r2 = usar(e2, 0, b2);
  assert.equal(golpesEm(r2.ev, b2).length, 4);
  assert.equal(golpesEm(r2.ev, resto[0]).length, 4);
  assert.equal(golpesEm(r2.ev, resto[1]).length, 0, 'fora dos 9 m');
});

test('T2 Kinetic_Rain: cada projétil ativa a Anomalia Cinética no lugar (o PoB: 150% de dano no 20, 1,2 m, 6 s, até 30) — ela explode com o inimigo perto', { skip: SEM }, async () => {
  const { e, b } = await montar(['Kinetic_Rain'], { arma: 'Wands/Driftwood_Wand' });
  const { ev } = usar(e, 0, b);
  const chuva = golpesEm(ev, b)[0].v;
  const an = e.hunt.poeR3c?.anomalias ?? [];
  assert.equal(an.length, 8);
  assert.ok(an.every((a) => a.ate - e.hunt.clock === 6000 && a.chuvaT2?.danoPct === 150 && a.x === b.x && a.y === b.y), JSON.stringify(an[0]));
  const evT = [];
  Acoes.tiqueR3C(e, e.hunt, { nome: 'T' }, evT, e.hunt.clock + 100, () => 0.5);
  const exp = golpesEm(evT, b);
  assert.equal(exp.length, 8, 'as 8 explodem');
  // a anomalia: o golpe da varinha com 150% no lugar dos 25% e o mesmo Poder Arcano de 200% (a explosão é o acerto ativado das anomalias do R3C — os "aumentados" de
  // ataque e de área da ficha entram nele: a razão fica perto de 6, com 6% de folga)
  assert.ok(perto(exp[0].v / chuva, 150 / 25, 0.06), `${exp[0].v} / ${chuva}`);
  // sem o Poder Arcano, a explosão cai (o Dano Mágico aumentado do personagem conta 200% nela)
  const { e: e3, b: b3 } = await montar(['Kinetic_Rain'], { arma: 'Wands/Driftwood_Wand' });
  usar(e3, 0, b3);
  for (const a of e3.hunt.poeR3c.anomalias) a.chuvaT2.arcanoPct = 0;
  const evS = [];
  Acoes.tiqueR3C(e3, e3.hunt, { nome: 'T' }, evS, e3.hunt.clock + 100, () => 0.5);
  assert.ok(golpesEm(evS, b3)[0].v < exp[0].v);
  assert.equal((e.hunt.poeR3c?.anomalias ?? []).length, 0);
  assert.deepEqual(GemasT2.anomaliaDaChuva('Kinetic_Rain', 1), { danoPct: 132, raioM: 1.2, duracaoMs: 6000, teto: 30, arcanoPct: 200 });
});

// ---------------------------------------------------------------- Tiro Cinético da Fragmentação

test('T2 Kinetic_Bolt_of_Fragmentation: 95% de dano, 115% de velocidade, 2 projéteis adicionais (3 alvos) — "mudam de direção" não se aplica (a trajetória, decisão A3)', { skip: SEM }, async () => {
  const c = G.compilada('Kinetic_Bolt_of_Fragmentation', 20);
  assert.deepEqual([c.stats.efetividade, c.stats.velAtaqueBase, c.stats.projeteisExtra], [0.95, 115, 2]);
  assert.equal(G.alvosNoNivel('Kinetic_Bolt_of_Fragmentation', 20).projeteis, 2);
  const { e, b, resto } = await montar(['Kinetic_Bolt_of_Fragmentation'], { arma: 'Wands/Driftwood_Wand' });
  [[0, 1], [1, 0], [0, -1]].forEach(([dx, dy], i) => Object.assign(resto[i], { x: b.x + dx, y: b.y + dy, estados: {}, dots: [] }));
  const { ev } = usar(e, 0, b);
  assert.equal([b, ...resto.slice(0, 3)].filter((m) => danoEm(ev, m) > 0).length, 3);
  assert.ok(perto(danoEm(ev, b), 950, 0.02), String(danoEm(ev, b)));
});
