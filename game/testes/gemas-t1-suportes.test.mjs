// (lote T1, rodada 4, 27/10) OS SUPORTES "IMPLEMENTADOS, SEM TESTE PRÓPRIO" (a fila T1, parte 2): cada um ligado a uma ativa e usado de verdade numa caçada, com os
// números do nível máximo (20; o Desperto 5; o Excepcional 3) conferidos com o poedb salvo e cada linha medida no uso — com e sem o suporte. Os sorteios ficam
// travados. O que o teste mostrou que o jogo não fazia virou correção: o "X% mais Duração" (somava no aumentado — `duracaoMaisPct`) e o "+1 ao Nível das Gemas
// Elementais / de Lacaios" (valia em qualquer gema — `suportes-poe.mjs`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const A = await import('./gemas-t1-apoio.mjs');
const { SEM, G, GS, SP, Acoes, Ficha, montar, usar, perto, PERSONAGEM } = A;
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');

const MACA = 'Two_Hand_Maces/Driftwood_Maul';
const ARCO = 'Bows/Thicket_Bow';
const VARINHA = 'Wands/Driftwood_Wand';
const ESPADA = 'One_Hand_Swords/Rusted_Sword';

/** A tabela do suporte no poedb salvo (a por nível que o jogo carrega; na falta, a da coleção): a célula do nível pela coluna que casa com `re`. */
const NIVEIS = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/gemas-niveis-poedb.json', import.meta.url), 'utf8')).niveis ?? {};
const BRUTO = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/suportes-poe.json', import.meta.url), 'utf8'));
const DA_COLECAO = new Map((Array.isArray(BRUTO) ? BRUTO : Object.values(BRUTO)).map((s) => [s.slug, s]));
function celula(slug, nivel, re) {
  const g = NIVEIS[slug]?.colunas?.some((c) => re.test(c)) ? NIVEIS[slug] : DA_COLECAO.get(slug);
  const i = g.colunas.findIndex((c) => re.test(c));
  assert.ok(i >= 0, `${slug}: coluna ${re}`);
  return parseFloat(String(g.linhas.find((l) => Number(l[0]) === nivel)[i]).replace(',', '.'));
}
/** O efeito do suporte no nível para a ativa (pelas tags da gema ativa). */
const ef = (sup, nivel, ativa, q = 0) => SP.efeitoNoNivel(sup, nivel, q, { tags: (G.doSlug(ativa).gema?.tags ?? G.doSlug(ativa).tags ?? []).map((t) => (String(t).startsWith('poe:') ? t : `poe:${t}`)) }).efeito;
/** O golpe do uso no alvo (o primeiro da gema), com o tempo de uso. */
async function golpe(arma, grupo, v = 0.5, opts = {}, antes = null) {
  const m = await montar(arma, [grupo], opts);
  antes?.(m);
  const u = usar(m, v);
  return { m, u, g: u.golpes[0], uso: m.e.hunt.cooldowns['grupo:poe']?.total, nivel: GS.efeitoNaSkill(m.e, m.e.actions[0].id)?.nivel };
}
const bruto = (g) => g.danoAntesDaResistencia;
/** a ≈ b × f, com o arredondamento do golpe (1 de dano) */
const quase = (a, b, f, tol = 0.01) => Math.abs(a - b * f) <= Math.max(1, tol * b * f);
const sangrando = (b, agora) => b.dots.push({ tipo: 'sangramento', falta: 1e9, porPulso: 1, desde: agora, proximo: agora + 1000, ate: agora + 1e9 });
const ferido = (x) => x.hp < x.maxHp;
function por(m, casas) {
  const p = m.e.hunt.pos;
  return casas.map(([dx, dy], i) => Object.assign(m.resto[i], { x: p.x + dx, y: p.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} }));
}

test('T1: Violência (Bloodlust_Support) — 39% mais Dano Físico Corpo a Corpo contra Sangrando, não Sangra; a qualidade 20: +10% contra Sangrando', { skip: SEM }, async () => {
  const S = 'Bloodlust_Support';
  assert.equal(celula(S, 20, /mais Dano Físico Corpo a Corpo contra inimigos Sangrando/), 39);
  const e20 = ef(S, 20, 'Heavy_Strike');
  assert.deepEqual([e20.maisAcertoContraSangrandoPct, e20['af:nao_pode:sangramento']], [39, 1]);
  // (o Golpe Pesado no alvo que sangra e no que não sangra: só o que sangra leva os 39% a mais)
  const contra = async (grupo, sangra, q = 0) => bruto((await golpe(MACA, grupo, 0.5, { qualidade: q }, (m) => sangra && sangrando(m.b, m.e.hunt.clock))).g);
  const base = await contra(['Heavy_Strike'], true);
  assert.equal(await contra(['Heavy_Strike'], false), base, 'sem a Violência o sangramento não muda nada');
  assert.ok(perto(await contra(['Heavy_Strike', S], true) / base, 1.39, 0.01));
  assert.ok(perto(await contra(['Heavy_Strike', S], false) / base, 1, 0.01), 'no alvo sem Sangramento, nada');
  // (a qualidade 20: "+10% de Dano Corpo a Corpo aumentado contra Inimigos Sangrando" — × 1,10 por cima)
  const q20 = await contra(['Heavy_Strike', S], true, 20);
  const q20Base = await contra(['Heavy_Strike'], true, 20);
  assert.ok(perto(q20 / q20Base, 1.39 * 1.1, 0.01), `${q20} / ${q20Base}`);
  // ("Ataques Suportados não podem causar Sangramento": a Laceração da Hemorragia, 25% de chance — o sorteio 0,2 Sangra sem a Violência, não com ela)
  const sangue = async (grupo) => (await golpe(ESPADA, grupo, 0.2)).m.b.dots.filter((d) => d.tipo === 'sangramento').length;
  assert.deepEqual([await sangue(['Lacerate_of_Haemorrhage']), await sangue(['Lacerate_of_Haemorrhage', S])], [1, 0]);
});

test('T1 (correção): Mais Duração — 39% MAIS Duração (poedb; +10% na qualidade 20): multiplica, também com o "menos" da Menos Duração', { skip: SEM }, async () => {
  const S = 'More_Duration_Support';
  assert.equal(celula(S, 20, /mais Duração do Efeito de Habilidades/), 39);
  assert.deepEqual([ef(S, 20, 'Summon_Raging_Spirit').duracaoMaisPct, ef(S, 20, 'Summon_Raging_Spirit', 20).duracaoMaisPct], [39, 49]);
  const menos = celula('Less_Duration_Support', 20, /menos Duração do Efeito de Habilidades/);
  // (o Espírito Furioso dura 5 s; com a Mais Duração, 6,95 s; com as duas, 5 × 1,39 × (1 − menos) — antes somavam: 5 × (1 + 0,39 − menos))
  const dura = async (grupo) => { const { m } = await golpe(VARINHA, grupo); const l = m.e.hunt.lacaios.at(-1); return l.ate - l.desde; };
  assert.equal(await dura(['Summon_Raging_Spirit']), 5000);
  assert.equal(await dura(['Summon_Raging_Spirit', S]), 6950);
  assert.ok(Math.abs((await dura(['Summon_Raging_Spirit', S, 'Less_Duration_Support'])) - 5000 * 1.39 * (1 - menos / 100)) <= 1);
  // (o buff do uso também: o giro do Ciclone Vaal — 5 s × 1,39)
  assert.ok(perto(Acoes.fatorDeDuracao((await montar(MACA, [['Vaal_Cyclone', S]])).e, Acoes.POR_ID_PUBLICO(G.doSlug('Vaal_Cyclone').acao), ef(S, 20, 'Vaal_Cyclone')), 1.39, 1e-9));
});

test('T1: Suporte Desperto: Dano Adicional de Fogo — 44% do Físico como Fogo Extra (poedb, nível 5), +1 nível só nas gemas Físicas; a qualidade 20: +10% de Fogo', { skip: SEM }, async () => {
  const S = 'Awakened_Added_Fire_Damage_Support';
  assert.equal(celula(S, 5, /Dano Físico como Dano Extra de Fogo/), 44);
  const r = await golpe(MACA, ['Heavy_Strike', S]);
  const pe = r.g.detalhe.porElemento;
  assert.ok(quase(pe.fire, pe.physical, 0.44), JSON.stringify(pe));
  const sem = await golpe(MACA, ['Heavy_Strike']);
  assert.ok(perto(pe.physical, sem.g.detalhe.porElemento.physical, 1e-9), 'o Físico fica; o Fogo é extra');
  // (+1 ao Nível das Gemas Físicas: o Golpe Pesado não tem a tag — fica no 20 —; o Golpe Duplo tem — 21)
  assert.deepEqual([r.nivel, (await golpe(MACA, ['Double_Strike', S])).nivel], [20, 21]);
  const q = (await golpe(MACA, ['Heavy_Strike', S], 0.5, { qualidade: 20 })).g.detalhe.porElemento;
  assert.ok(quase(q.fire, q.physical, 0.44 * 1.1), JSON.stringify(q));
});

test('T1: Suporte Desperto: Generosidade — a aura não afeta você, +44% de Efeito (poedb, nível 5), +1 nível de Aura; a qualidade 20: +40% de Área da Aura', { skip: SEM }, async () => {
  const S = 'Awakened_Generosity_Support';
  assert.equal(celula(S, 5, /possuem \d+% de aumento do Efeito/), 44);
  const aura = async (grupo, q = 0) => {
    const m = await montar(ESPADA, [grupo], { qualidade: q });
    const antes = Ficha.combate(m.e).afPoe.ice_res ?? 0;
    usar(m, 0.5);
    Ficha.invalidar(m.e);
    const id = G.doSlug('Purity_of_Ice').acao;
    const b = m.e.hunt.buffs[id];
    return { m, b, emVoce: (Ficha.combate(m.e).afPoe.ice_res ?? 0) - antes, efeito: G.efeitoDoBuff(m.e, b.tipo, id, b), nivel: GS.efeitoNaSkill(m.e, m.e.actions[0].id).nivel };
  };
  const so = await aura(['Purity_of_Ice']);
  const gen = await aura(['Purity_of_Ice', S]);
  assert.equal(so.emVoce, 41);
  assert.equal(gen.emVoce, 0, 'a Generosidade: a aura não afeta você');
  assert.equal(gen.b.soAliados, true);
  assert.ok(perto(gen.efeito / so.efeito, 1.44, 1e-9), 'nos aliados, 44% de Efeito a mais');
  // (+1 nível: a Pureza Glacial no 21 — a resistência do nível 21 no poedb)
  assert.equal(gen.nivel, 21);
  assert.equal(gen.b.afPoe.ice_res, A.celula('Purity_of_Ice', 21, /de Resistência a Gelo adicional$/) * 1);
  // (a qualidade 20 da Generosidade: a área da aura +40% — o raio × √1,4)
  const q = await aura(['Purity_of_Ice', S], 20);
  const base = G.buffNoNivel('Purity_of_Ice', 21).raio;
  assert.equal(gen.b.raio, base);
  assert.equal(q.b.raio, Math.round(base * Math.sqrt(1.4)), `${q.b.raio} contra ${gen.b.raio} (casas)`);
});

test('T1: Ataques Múltiplos Maiores — 3 repetições, 50% mais Velocidade de Ataque Corpo a Corpo (poedb, nível 3), 20% menos Dano, 22/44/66% mais por repetição', { skip: SEM }, async () => {
  const S = 'Greater_Multistrike_Support';
  assert.equal(celula(S, 3, /mais Velocidade de Ataque Corpo a Corpo/), 50);
  const e3 = ef(S, 3, 'Heavy_Strike');
  assert.deepEqual([e3.repeticoes, e3.maisDanoAcertoPct, e3['repeticaoMaisPct:1'], e3['repeticaoMaisPct:2'], e3['repeticaoMaisPct:3']], [3, -20, 22, 44, 66]);
  const sem = await golpe(MACA, ['Heavy_Strike']);
  const com = await golpe(MACA, ['Heavy_Strike', S]);
  assert.equal(com.u.golpes.length, 4);
  const b0 = bruto(sem.g);
  [1, 1.22, 1.44, 1.66].forEach((f, i) => assert.ok(perto(bruto(com.u.golpes[i]) / b0, 0.8 * f, 0.02), `golpe ${i}: ${bruto(com.u.golpes[i])} / ${b0}`));
  // (o uso ocupa os 4 golpes, cada um a 1 ÷ 1,5 do tempo)
  assert.ok(perto(com.uso, (sem.uso * 4) / 1.5, 0.01), `${com.uso} contra ${sem.uso}`);
});

test('T1: Difundir — o projétil se Difunde em 2 no alvo (os outros levam), 9% menos Dano de Projétil (poedb)', { skip: SEM }, async () => {
  const S = 'Fork_Support';
  assert.equal(celula(S, 20, /menos Dano de Projétil/), 9);
  const tiro = async (grupo) => {
    const m = await montar(ARCO, [grupo]);
    const p = m.e.hunt.pos;
    Object.assign(m.b, { x: p.x + 3, y: p.y });
    const outros = por(m, [[5, -1], [5, 1], [5, 0]]);
    const u = usar(m, 0.5);
    return { u, outros: outros.filter(ferido).length, fontes: u.eventos.filter((x) => x.t === 'dmg').map((x) => x.fonte ?? 'direto') };
  };
  const sem = await tiro(['Burning_Arrow']);
  const com = await tiro(['Burning_Arrow', S]);
  assert.equal(sem.outros, 0);
  assert.equal(com.outros, 2);
  assert.deepEqual(com.fontes, ['direto', 'bifurcacao', 'bifurcacao']);
  assert.ok(quase(bruto(com.u.golpes[0]), bruto(sem.u.golpes[0]), 0.91), `${bruto(com.u.golpes[0])} / ${bruto(sem.u.golpes[0])}`);
});

test('T1: Suporte Desperto: Difundir — Difunde e Difunde de novo (1 + 2 + 4 acertos), 14% mais Dano de Projétil (poedb, nível 5)', { skip: SEM }, async () => {
  const S = 'Awakened_Fork_Support';
  assert.equal(celula(S, 5, /mais Dano de Projétil/), 14);
  assert.deepEqual([ef(S, 5, 'Burning_Arrow').bifurcar, ef(S, 5, 'Burning_Arrow').bifurcarDeNovo], [2, 1]);
  const m = await montar(ARCO, [['Burning_Arrow', S]]);
  const p = m.e.hunt.pos;
  Object.assign(m.b, { x: p.x + 3, y: p.y });
  por(m, [[5, -1], [5, 1], [5, 0], [6, -1], [6, 1], [6, 0], [7, 0]]);
  const u = usar(m, 0.5);
  const fontes = u.eventos.filter((x) => x.t === 'dmg').map((x) => x.fonte ?? 'direto');
  // aval do dono 03/11: a geometria da difusão (±30°) — os filhos pegam o (5,±1); os netos a ±30° deles não chegam a todos da fila (7 → 5 acertos)
  assert.deepEqual(fontes, ['direto', ...Array(4).fill('bifurcacao')], 'a Difusão comum dá 3 acertos; a Desperta, 5 nesta fila');
  const sem = await golpe(ARCO, ['Burning_Arrow']);
  assert.ok(quase(bruto(u.golpes[0]), bruto(sem.g), 1.14), `${bruto(u.golpes[0])} / ${bruto(sem.g)}`);
});

test('T1: Barragem — +4 projéteis em sequência no alvo, 44% menos Dano (poedb), 10% mais Tempo de Ataque por projétil; só com Arco e Varinha', { skip: SEM }, async () => {
  const S = 'Barrage_Support';
  assert.deepEqual([celula(S, 20, /menos Dano$/), ef(S, 20, 'Burning_Arrow').alvosExtras, ef(S, 20, 'Burning_Arrow').tempoPorProjetilPct], [44, 4, 10]);
  const sem = await golpe(ARCO, ['Burning_Arrow']);
  const com = await golpe(ARCO, ['Burning_Arrow', S]);
  assert.equal(com.u.golpes.length, 5);
  assert.ok(com.u.golpes.every((g) => perto(bruto(g) / bruto(sem.g), 0.56, 0.02)), com.u.golpes.map(bruto).join(','));
  assert.equal(com.u.golpes.filter((g) => g.alvo === sem.g.alvo).length, 5, 'os 5 no mesmo alvo');
  // (5 projéteis × 10% mais tempo: × 1,5)
  assert.ok(perto(com.uso, sem.uso * 1.5, 0.01), `${com.uso} contra ${sem.uso}`);
  // (com espada, o Arremesso Espectral com a Barragem não sai)
  const m = await montar(ESPADA, [['Spectral_Throw', S]]);
  const r = A.sorte(0.5, () => Acoes.disparar(m.e, m.e.hunt, PERSONAGEM, 0, m.b, { manual: true }));
  assert.deepEqual([r.ok, r.motivo], [false, 'ARMA']);
});

test('T1: Suporte Desperto: Nova de Flechas — +5 projéteis em círculo a partir do ponto do alvo, 11% menos Dano de Projétil (poedb, nível 5); só com Arco', { skip: SEM }, async () => {
  const S = 'Awakened_Arrow_Nova_Support';
  assert.equal(celula(S, 5, /menos Dano de Projétil/), 11);
  assert.deepEqual([ef(S, 5, 'Burning_Arrow').alvosExtras, ef(S, 5, 'Burning_Arrow').emCirculo, ef(S, 5, 'Burning_Arrow').doPontoDoAlvo], [5, 1, 1]);
  const tiro = async (grupo) => {
    const m = await montar(ARCO, [grupo]);
    const p = m.e.hunt.pos;
    Object.assign(m.b, { x: p.x + 3, y: p.y });
    // (em volta do alvo, nas casas vizinhas — atrás e dos lados, fora da linha do tiro)
    const volta = por(m, [[4, 0], [4, 1], [3, 1], [2, 1], [4, -1], [3, -1], [2, -1]]);
    const u = usar(m, 0.5);
    return { u, volta: volta.filter(ferido).length };
  };
  const sem = await tiro(['Burning_Arrow']);
  const com = await tiro(['Burning_Arrow', S]);
  assert.equal(sem.volta, 0);
  assert.ok(com.volta >= 2, `os projéteis do círculo acertam em volta do alvo: ${com.volta}`);
  assert.ok(quase(bruto(com.u.golpes[0]), bruto(sem.u.golpes[0]), 0.89), `${bruto(com.u.golpes[0])} / ${bruto(sem.u.golpes[0])}`);
  const m = await montar(VARINHA, [['Burning_Arrow', S]]);
  const r = A.sorte(0.5, () => Acoes.disparar(m.e, m.e.hunt, PERSONAGEM, 0, m.b, { manual: true }));
  assert.equal(r.ok, false, 'sem arco, não sai');
});

test('T1: Suporte Desperto: Projéteis Perigosos — 59% mais Dano Físico de Ataque de Projétil e 59% mais Físico degenerativo (poedb, nível 5), 10% menos Velocidade', { skip: SEM }, async () => {
  const S = 'Awakened_Vicious_Projectiles_Support';
  assert.deepEqual([celula(S, 5, /mais Dano Físico de Ataque de Projétil/), celula(S, 5, /mais Dano Físico degenerativo/), celula(S, 5, /mais Dano de Caos degenerativo/)], [59, 59, 59]);
  // (a Perfuração: o acerto Físico e o Sangramento dele)
  const sem = await golpe(ARCO, ['Puncture']);
  const com = await golpe(ARCO, ['Puncture', S]);
  assert.ok(quase(bruto(com.g), bruto(sem.g), 1.59), `${bruto(com.g)} / ${bruto(sem.g)}`);
  const sangue = (r) => r.m.b.dots.filter((d) => d.tipo === 'sangramento').reduce((t, d) => t + d.falta, 0);
  assert.ok(perto(sangue(com) / sangue(sem), 1.59, 0.01), `${sangue(com)} / ${sangue(sem)} — o "mais Físico de Projétil" é só do acerto; o Sangramento leva o degenerativo`);
  assert.ok(perto(com.uso, sem.uso / 0.9, 0.01), `${com.uso} contra ${sem.uso}`);
});

test('T1: Dano Crítico Aumentado — +138% de Multiplicador de Crítico (poedb; +10% na qualidade 20) no acerto crítico', { skip: SEM }, async () => {
  const S = 'Increased_Critical_Damage_Support';
  assert.equal(celula(S, 20, /de Multiplicador de Crítico/), 138);
  assert.deepEqual([ef(S, 20, 'Heavy_Strike').critDano, ef(S, 20, 'Heavy_Strike', 20).critDano], [138, 148]);
  const base = Ficha.combate((await montar(MACA, [['Heavy_Strike']])).e).critMultiplier * 100;
  assert.equal(base, 150);
  // (o sorteio 0: Crítico nos dois)
  const sem = await golpe(MACA, ['Heavy_Strike'], 0);
  const com = await golpe(MACA, ['Heavy_Strike', S], 0);
  assert.ok(sem.g.critico && com.g.critico);
  assert.ok(perto(com.g.danoFinal / sem.g.danoFinal, (base + 138) / base, 0.01), `${com.g.danoFinal} / ${sem.g.danoFinal}`);
  // (fora do Crítico, nada)
  assert.ok(perto(bruto((await golpe(MACA, ['Heavy_Strike', S], 0.99)).g) / bruto((await golpe(MACA, ['Heavy_Strike'], 0.99)).g), 1, 1e-9));
});

test('T1: Penetração Elemental — Penetra 28% das Resistências Elementais (poedb) no alvo com 50% de Fogo', { skip: SEM }, async () => {
  const S = 'Elemental_Penetration_Support';
  assert.equal(celula(S, 20, /Penetram \d+% das Resistências Elementais/), 28);
  const contra = async (grupo) => (await golpe(VARINHA, grupo, 0.5, {}, (m) => { m.b.resist = { fire: 50 }; })).g;
  const sem = await contra(['Fireball']);
  const com = await contra(['Fireball', S]);
  assert.ok(perto(sem.danoFinal / bruto(sem), 0.5, 0.01), `${sem.danoFinal} / ${bruto(sem)}`);
  assert.ok(perto(com.danoFinal / bruto(com), 1 - 0.22, 0.01), `${com.danoFinal} / ${bruto(com)}`);
});

test('T1: Suporte Desperto: Dano Adicional de Caos — 189 a 284 de Caos (poedb, nível 5) × a eficácia, +1 nível nas gemas suportadas', { skip: SEM }, async () => {
  const S = 'Awakened_Added_Chaos_Damage_Support';
  assert.deepEqual([ef(S, 5, 'Heavy_Strike')['somadoMin:chaos'], ef(S, 5, 'Heavy_Strike')['somadoMax:chaos']], [189, 284]);
  const efic = G.compilada('Heavy_Strike', 21).stats.efetividade;
  assert.ok(perto(efic, A.celula('Heavy_Strike', 21, /^Base Damage$/).split(',').map(parseFloat)[0] / 100, 1e-3));
  const min = await golpe(MACA, ['Heavy_Strike', S], 0);
  const max = await golpe(MACA, ['Heavy_Strike', S], 0.999);
  assert.equal(min.nivel, 21, '+1 ao nível da gema suportada');
  assert.ok(perto(min.g.detalhe.porElemento.chaos / (min.g.critico ? Ficha.combate(min.m.e).critMultiplier : 1), 189 * efic, 0.02) || perto(min.g.detalhe.porElemento.chaos, 189 * efic, 0.02), JSON.stringify(min.g.detalhe));
  assert.ok(perto(max.g.detalhe.porElemento.chaos, 284 * efic, 0.01), JSON.stringify(max.g.detalhe));
});

test('T1 (correção): Suporte Desperto: Foco Elemental — 39% mais Dano Elemental (poedb, nível 5), sem Afecções Elementais, +1 nível só nas gemas Elementais', { skip: SEM }, async () => {
  const S = 'Awakened_Elemental_Focus_Support';
  assert.equal(celula(S, 5, /mais Dano Elemental/), 39);
  // (a Bola de Fogo no 21 sem o suporte contra a do 20 + o Foco Desperto, que a leva ao 21: só os 39%)
  const com = await golpe(VARINHA, ['Fireball', S]);
  const n21 = await golpe(VARINHA, ['Fireball'], 0.5, { nivelDe: (s) => (s === 'Fireball' ? 21 : null) });
  assert.equal(com.nivel, 21);
  assert.ok(perto(bruto(com.g) / bruto(n21.g), 1.39, 0.01), `${bruto(com.g)} / ${bruto(n21.g)}`);
  // ("não podem infligir Afecções Elementais": o sorteio 0 Incendeia sem o suporte, não com ele)
  const queima = async (grupo) => (await golpe(VARINHA, grupo, 0)).m.b.dots.filter((d) => d.tipo === 'queimadura').length;
  assert.deepEqual([(await queima(['Fireball'])) > 0, await queima(['Fireball', S])], [true, 0]);
  // (a correção: o Golpe Pesado não é Elemental — fica no 20; antes subia para o 21)
  assert.equal((await golpe(MACA, ['Heavy_Strike', S])).nivel, 20);
});

test('T1: Suporte Desperto: Dano do Lacaio — 44% mais Dano dos Lacaios e 25% menos Vida (poedb, nível 5), +1 nível nas gemas de Lacaio', { skip: SEM }, async () => {
  const S = 'Awakened_Minion_Damage_Support';
  assert.equal(celula(S, 5, /causam \d+% mais Dano/), 44);
  assert.ok(SP.textosDoNivel(SP.doSlug(S).suporte, 5).mods.includes('Lacaios das Habilidades Suportadas têm 25% menos Vida Máxima'));
  assert.deepEqual([ef(S, 5, 'Summon_Raging_Spirit').lacaioMaisDanoPct, ef(S, 5, 'Summon_Raging_Spirit').lacaioVidaPct], [44, -25]);
  const lacaio = async (grupo, opts) => { const r = await golpe(VARINHA, grupo, 0.5, opts); return { l: r.m.e.hunt.lacaios.at(-1), nivel: r.nivel }; };
  const com = await lacaio(['Summon_Raging_Spirit', S]);
  const n21 = await lacaio(['Summon_Raging_Spirit'], { nivelDe: (s) => (s === 'Summon_Raging_Spirit' ? 21 : null) });
  assert.equal(com.nivel, 21);
  assert.ok(perto(com.l.dano.min / n21.l.dano.min, 1.44, 0.01) && perto(com.l.dano.max / n21.l.dano.max, 1.44, 0.01), `${JSON.stringify(com.l.dano)} / ${JSON.stringify(n21.l.dano)}`);
  assert.ok(perto(com.l.maxHp / n21.l.maxHp, 0.75, 0.01), `${com.l.maxHp} / ${n21.l.maxHp}`);
  assert.ok(LacaiosPoe.oQueInvoca);
});

test('T1: Recuperação de Recarga (Excepcional) — 40% de Velocidade de Recuperação da Recarga aumentada no nível 3 (poedb): a recarga ÷ 1,4', { skip: SEM }, async () => {
  const S = 'Cooldown_Recovery_Support';
  assert.equal(celula(S, 3, /Velocidade de Recuperação da Recarga aumentada/), 40);
  const recarga = async (grupo) => { const { m } = await golpe(VARINHA, grupo, 0.5, { nivelDe: (s) => (s === S ? 3 : null) }); return m.e.hunt.cooldowns['poe-gema:Pact_of_Ghorr'].total; };
  assert.equal(await recarga(['Pact_of_Ghorr']), 4000);
  assert.equal(await recarga(['Pact_of_Ghorr', S]), Math.round(4000 / 1.4));
});
