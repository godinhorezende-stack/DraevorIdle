// (lote C3, dono 25/10) AS GEMAS ATIVAS DE CORPO A CORPO, IMPACTO E CANALIZAÇÃO — a POSTURA e os OBJETOS NO TEMPO (o plano do grupo, as recomendações aceitas D3.1 a
// D3.5): o Sangue e Areia como o PoE (liga na de Sangue, o clique alterna; "mudou de Postura Recentemente" = 4 s desde a troca — D3.1), a Dilaceração, as Perfurações
// (as estacas — D3.3), as Tempestades de Lâminas e as Furiosas (o ritmo — D3.2), os Terremotos (o abalo — D3.4), as Varridas Sagradas (os martelos), a Fissura
// Vulcânica do Serpenteado e as Tormentas Explosivas (os orbes — D3.5). Os números são os do PoE (o PoB, o poedb); os sorteios ficam travados.
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
const C3 = await import('../systems/itens-poe/gemas-c3.mjs');
const L = await import('../systems/itens-poe/linhas-das-gemas.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
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
/** O personagem com as gemas na arma (cada uma num slot da barra, na ordem), numa caçada; o alvo imortal colado (à direita, sem armadura) e os outros longe. */
async function montar(slugs, { nivel = 20, qualidade = 20, arma = 'Two_Hand_Maces/Driftwood_Maul' } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const lista = [slugs].flat();
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: lista.length, links: [], gemas: lista.map(() => null), cores: lista.map(() => 'W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = lista.map((s) => GS.itemDaGema({ id: G.doSlug(s).itemId, nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < lista.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  lista.forEach((s, i) => { e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }; });
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
/** Usa a gema do slot no alvo (com a conjuração concluída), com o sorteio travado; o relógio vai para quando o próximo uso pode sair. */
function usar(e, b, { slot = 0, v = 0.5 } = {}) {
  return travado(v, () => {
    let x = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, b, { manual: true });
    if (e.hunt.conjurando) {
      e.hunt.clock = e.hunt.conjurando.fim;
      const fim = Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM);
      x = { ok: true, eventos: Array.isArray(fim) ? fim : fim?.eventos ?? [] };
    }
    e.hunt.clock = Math.max(e.hunt.clock, e.hunt.cooldowns?.['grupo:poe']?.ate ?? e.hunt.clock);
    return x;
  });
}
/** O tique dos objetos (e o do C3) até `ms` depois de agora, com o sorteio travado: os eventos. */
function tique(e, ms, v = 0.5) {
  return travado(v, () => {
    e.hunt.clock += ms;
    const ev = Acoes.tiqueDosObjetos(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
    Acoes.tiqueDoC3(e, e.hunt, PERSONAGEM, ev, e.hunt.clock);
    return ev;
  });
}
const danos = (ev, b) => (Array.isArray(ev) ? ev : ev.eventos ?? []).filter((x) => x.t === 'dmg' && x.uid === b.uid);
const total = (ev, b) => danos(ev, b).reduce((t, x) => t + (x.v ?? 0), 0);
const objetos = (e, tipo) => (e.hunt.poeObjetos ?? []).filter((o) => o.tipo === tipo);
const conds = (e) => ModsPoe.condicoesDe(e, Ficha.combate(e).afPoe);

const GEMAS = ['Blood_and_Sand', 'Lacerate', 'Perforate', 'Perforate_of_Duality', 'Perforate_of_Bloodshed', 'Bladestorm', 'Bladestorm_of_Uncertainty', 'Rage_Vortex', 'Rage_Vortex_of_Berserking', 'Earthquake', 'Earthquake_of_Amplification', 'Vaal_Earthquake', 'Holy_Sweep', 'Holy_Sweep_of_Hammerfalls', 'Volcanic_Fissure_of_Snaking', 'Storm_Burst', 'Storm_Burst_of_Repulsion'];

// ---------------------------------------------------------------- o status e os leitores

test('C3: as 16 gemas do lote e o Sangue e Areia saem de parcial (as linhas do PoE têm leitor)', { skip: SEM }, () => {
  for (const s of GEMAS) {
    const r = G.REGISTRO.get(s);
    assert.deepEqual([s, r.statusNoJogo, r.motivosNoJogo], [s, 'funciona', []]);
  }
});

test('C3: os números das linhas no nível 20 e na qualidade 20 (os do PoB)', { skip: SEM }, () => {
  assert.equal(G.c3DaGema('Lacerate', 20, 20).sangramentoNaSanguePct, 88);
  assert.equal(G.c3DaGema('Bladestorm', 20, 20).sangramentoNaSanguePct, 108);
  assert.equal(G.c3DaGema('Bladestorm_of_Uncertainty', 20, 20).sangramentoNaSanguePct, 0, 'o da Incerteza é o "88% mais" de sempre (o compilador)');
  assert.deepEqual(G.c3DaGema('Perforate', 20, 20).estacas, { n: 9, seMudou: 0, sempre: false, raioM: 0.8 });
  assert.deepEqual(G.c3DaGema('Perforate', 20, 0).estacas.n, 7);
  assert.deepEqual(G.c3DaGema('Perforate_of_Duality', 20, 20).estacas, { n: 5, seMudou: 10, sempre: false, raioM: 0.8 });
  assert.deepEqual(G.c3DaGema('Perforate_of_Bloodshed', 20, 20).estacas, { n: 6, seMudou: 0, sempre: true, raioM: 1.1 });
  assert.deepEqual(G.objetoDaGema('Bladestorm', 20, 20), { tipo: 'tempestadeDeLaminas', max: 4, menosPct: 50, duracaoMs: 3000, raioM: 2, outraPosturaPct: 0, sangra: true });
  assert.equal(G.objetoDaGema('Bladestorm', 20, 0).max, 3);
  // (aval do dono, 25/10 — a revisão: a tempestade de Sangue da Incerteza também Sangra — o PoB, BladestormAltX: "Blood bladestorms … cause Bleeding")
  assert.deepEqual(G.objetoDaGema('Bladestorm_of_Uncertainty', 20, 20), { tipo: 'tempestadeDeLaminas', max: 4, menosPct: 50, duracaoMs: 3000, raioM: 2, outraPosturaPct: 50, sangra: true });
  const rv = G.objetoDaGema('Rage_Vortex', 20, 20);
  assert.deepEqual([rv.tipo, rv.furiaMin, rv.sacrificaPct, rv.maisPorFuriaPct, rv.raioPorFuria, rv.frequenciaMaisPct, rv.max, rv.duracaoMs, rv.presa], ['tempestadeFuriosa', 10, 25, 10, { m: 0.1, cada: 2 }, 250, 1, 3000, false]);
  const rb = G.objetoDaGema('Rage_Vortex_of_Berserking', 20, 20);
  assert.deepEqual([rb.presa, rb.sacrificaPct, rb.perdaPorS, rb.perdaMaisPorSPct, rb.duracaoMs], [true, 0, 3, 20, null]);
  assert.deepEqual(G.objetoDaGema('Earthquake', 20, 20), { tipo: 'abalo', atrasoMs: 1000, raioM: 2.8, maisPct: 180, porDecimo: null, vaal: null });
  assert.deepEqual(G.objetoDaGema('Earthquake_of_Amplification', 20, 20), { tipo: 'abalo', atrasoMs: 3000, raioM: 2.8, maisPct: 0, porDecimo: { acertoPct: 15, afeccaoPct: 5, areaPct: 2 }, vaal: null });
  assert.deepEqual(G.objetoDaGema('Vaal_Earthquake', 20, 20).vaal, { secundariaMs: 12000, max: 9 });
  assert.equal(G.objetoDaGema('Vaal_Earthquake', 20, 20).maisPct, 437);
  assert.deepEqual(G.c3DaGema('Holy_Sweep', 20, 20).martelos, { menosPct: 35, raioM: 1.2, varridaM: 2.8, alvos: 8 });
  assert.deepEqual(G.objetoDaGema('Holy_Sweep_of_Hammerfalls', 20, 20), { menosPct: 50, raioM: 1.2, varridaM: 3.3, alvos: 0, tipo: 'martelosCadentes', cadaMs: 700, porQueda: 3, duracaoMs: 3500 });
  // (o raio da VARRIDA é o "O raio Base", não o do martelo)
  assert.ok(Math.abs(G.areaNoNivel('Holy_Sweep', 20, 0).raioM - 2.8) < 1e-9 && Math.abs(G.areaNoNivel('Holy_Sweep', 1, 0).raioM - 2.4) < 1e-9);
  assert.equal(G.c3DaGema('Volcanic_Fissure_of_Snaking', 20, 20).erupcoesExtras, 3);
  assert.equal(G.c3DaGema('Volcanic_Fissure_of_Snaking', 20, 0).erupcoesExtras, 2);
  assert.deepEqual(G.objetoDaGema('Storm_Burst', 20, 20), { tipo: 'orbeTormentaExplosiva', semAcerto: true, saltoMs: 400, duracaoMs: 1600, porRestantePct: 75, raioM: 2, explosaoM: 2.2 });
  assert.equal(G.objetoDaGema('Storm_Burst_of_Repulsion', 20, 0).duracaoMs, 800);
  assert.equal(G.objetoDaGema('Storm_Burst_of_Repulsion', 20, 0).afasta, true);
  assert.equal(G.objetoDaGema('Storm_Burst', 20, 0).afasta, undefined);
  // (as linhas locais: a Postura nas gemas — o Sangrar e a velocidade da Dilaceração, a qualidade da Dualidade, a velocidade na Tempestade Sangrenta)
  assert.deepEqual(G.linhasLocaisNoNivel('Lacerate', 20, 20).af, { 'chance_bleed@posturaSangue': 25, 'atk_speed@mudouPosturaRecente': 20 });
  assert.equal(G.linhasLocaisNoNivel('Perforate_of_Duality', 20, 20).af['mais_dano@posturaSangue'], -70, 'o −75% e o +5% da qualidade: o mesmo stat');
  assert.deepEqual(L.atributosDasLinhas(['12 % mais Velocidade de Ataque enquanto estiver em uma Tempestade de Lâminas Sangrentas']).af, { 'atk_speed_mais@emTempestadeSangrenta': 12 });
});

test('C3: as contas puras — a Fúria do Vórtice, a perda do Berserker, o abalo da Amplificação, a explosão do orbe e as estacas', { skip: SEM }, () => {
  const rv = G.objetoDaGema('Rage_Vortex', 20, 20);
  assert.deepEqual([9, 10, 20, 30].map((f) => C3.furiaSacrificada(rv, f)), [0, 2, 5, 7], 'com ao menos 10; ⌊Fúria × 25%⌋');
  assert.ok(Math.abs(C3.raioDaTempestadeFuriosaM(rv, 1.8, 7) - 2.1) < 1e-9, '+0,1 m por 2 sacrificadas');
  assert.equal(C3.intervaloDaTempestadeFuriosa(rv, 700), 200, 'o tempo de ataque ÷ 3,5');
  const rb = G.objetoDaGema('Rage_Vortex_of_Berserking', 20, 20);
  assert.ok(Math.abs(C3.furiaPerdidaNoBerserker(rb, 0, 1000) - 3) < 1e-9);
  assert.ok(Math.abs(C3.furiaPerdidaNoBerserker(rb, 0, 2000) - 6.6) < 1e-9, '3 + 3,6');
  assert.ok(Math.abs(C3.furiaPerdidaNoBerserker(rb, 1500, 2500) - (1.8 + 0.5 * 4.32)) < 1e-9);
  const amp = G.objetoDaGema('Earthquake_of_Amplification', 20, 20);
  assert.deepEqual(C3.maisDoAbalo(amp, 3000), { acertoPct: 450, afeccaoPct: 150, areaPct: 60 }, '30 décimos');
  assert.deepEqual(C3.maisDoAbalo(G.objetoDaGema('Earthquake', 20, 20), 1000), { acertoPct: 180, afeccaoPct: 180, areaPct: 0 });
  const orbe = G.objetoDaGema('Storm_Burst', 20, 20);
  assert.deepEqual([1600, 1200, 800, 400, 0].map((r) => C3.maisDaExplosaoDoOrbe(orbe, r)), [200, 125, 50, 0, 0], 'max(0, 75 × saltos restantes − 100)');
  // (D3.3) uma estaca em cada 3 no alvo, as outras sorteadas na área
  const casas = [{ x: 9, y: 9 }, { x: 8, y: 8 }];
  assert.deepEqual(C3.casasDasEstacas(5, { x: 0, y: 0 }, casas, () => 0.9), [{ x: 0, y: 0 }, { x: 8, y: 8 }, { x: 8, y: 8 }, { x: 0, y: 0 }, { x: 8, y: 8 }]);
  assert.deepEqual([C3.estacasNoUso(G.c3DaGema('Perforate_of_Duality', 20, 20).estacas, false), C3.estacasNoUso(G.c3DaGema('Perforate_of_Duality', 20, 20).estacas, true)], [5, 15]);
});

// ---------------------------------------------------------------- D3.1: o Sangue e Areia

test('C3 (D3.1): o Sangue e Areia liga na Postura de Sangue; o clique alterna (na recarga), e "mudou de Postura Recentemente" vale 4 s desde a troca', { skip: SEM }, async () => {
  const { e, b } = await montar('Blood_and_Sand', { arma: 'One_Hand_Swords/Rusted_Sword' });
  assert.ok(conds(e).has('posturaSangue'), 'sem o buff: Sangue');
  assert.ok(usar(e, b).ok);
  const id = G.doSlug('Blood_and_Sand').acao;
  assert.equal(e.hunt.buffs[id].postura, 'sangue');
  assert.ok(conds(e).has('posturaSangue') && !conds(e).has('mudouPosturaRecente'), 'ligar não é trocar');
  // (os bônus de Sangue no buff: 27% mais Dano em Área e 5% menos Área; os de Areia: 27% mais Área e 5% MENOS Dano em Área — o sinal do PoB)
  const af = e.hunt.buffs[id].afPoe;
  assert.deepEqual([af['mais_dano@corpo+area+posturaSangue'], af['area_mais@corpo+area+posturaSangue'], af['area_mais@corpo+area+posturaAreia'], af['mais_dano@corpo+area+posturaAreia']], [27, -5, 27, -5]);
  // o clique de novo, na recarga: não troca
  const r0 = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
  assert.equal(r0.motivo, 'COOLDOWN');
  e.hunt.clock = e.hunt.cooldowns[id].ate;
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
  assert.ok(r.ok && r.postura === 'areia', JSON.stringify(r));
  const recarga = e.hunt.cooldowns[id].total;
  assert.ok(recarga > 0 && recarga < 2000, `a recarga de 2 s ÷ a Velocidade de Recarga: ${recarga}`);
  assert.ok(conds(e).has('posturaAreia') && conds(e).has('mudouPosturaRecente'));
  e.hunt.clock += 4000;
  assert.ok(conds(e).has('mudouPosturaRecente'), 'até 4 s');
  e.hunt.clock += 1;
  assert.ok(!conds(e).has('mudouPosturaRecente'), 'depois de 4 s, não');
  // a barra automática não troca sozinha
  e.hunt.clock = Math.max(e.hunt.clock, e.hunt.cooldowns[id].ate);
  assert.equal(Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, {}).motivo, 'EFEITO_ATIVO');
  assert.equal(e.hunt.buffs[id].postura, 'areia');
});

// ---------------------------------------------------------------- a Dilaceração e a Perfuração

test('C3: a Dilaceração — o Sangramento só na Postura de Sangue e a velocidade "se mudou de Postura Recentemente"', { skip: SEM }, async () => {
  const { e } = await montar('Lacerate', { arma: 'One_Hand_Swords/Rusted_Sword' });
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Lacerate').acao);
  const uso = () => Acoes.temposDaGemaPoe(e, entry).uso;
  const antes = uso();
  ModsPoe.marcar(e.hunt, 'mudouPostura', e.hunt.clock);
  Ficha.invalidar(e);
  assert.ok(Math.abs(antes / uso() - 1.2) < 0.01, `20% de Velocidade de Ataque aumentada: ${antes} → ${uso()}`);
});

test('C3: a Dilaceração — "88% mais Dano com Sangramento" e "25% de chance de Sangrar" só na Postura de Sangue', { skip: SEM }, async () => {
  const sangra = async (postura, chance) => {
    const { e, b } = await montar('Lacerate', { arma: 'One_Hand_Swords/Rusted_Sword' });
    if (chance) { e.equipment.ring = { id: 0, count: 1, af: [], poe: { af: { chance_bleed: chance } } }; Ficha.invalidar(e); }
    if (postura) e.hunt.buffs = { ...(e.hunt.buffs ?? {}), 'poe-gema:Blood_and_Sand': { ate: 1e12, postura } };
    b.dots = [];
    usar(e, b, { v: 0.2 });
    return (b.dots ?? []).filter((d) => d.tipo === 'sangramento').reduce((t, d) => t + (d.falta ?? 0), 0);
  };
  const naSangue = await sangra(null, 0);
  assert.ok(naSangue > 0, 'Sangue: 25% de chance (o sorteio em 0,2)');
  assert.equal(await sangra('areia', 0), 0, 'Areia: sem a chance da gema');
  const naAreia = await sangra('areia', 100);
  assert.ok(naAreia > 0 && Math.abs(naSangue / naAreia - 1.88) < 0.05, `o "88% mais" só na de Sangue: ${naAreia} → ${naSangue}`);
});

test('C3 (D3.3): a Perfuração na Postura de Sangue — as estacas (uma em cada 3 no alvo); na de Areia, a área de sempre; a Dualidade com as 10 a mais', { skip: SEM }, async () => {
  const { e, b } = await montar(['Perforate', 'Perforate_of_Duality', 'Blood_and_Sand'], { arma: 'One_Hand_Swords/Rusted_Sword' });
  // (no sorteio travado em 0,9: as estacas fora do alvo caem na última casa da área — longe dele; o raio da estaca, 0,8 m, é 0 casa)
  const sangue = danos(usar(e, b, { v: 0.9 }), b).length;
  assert.equal(sangue, 3, 'Sangue: 9 estacas, 3 no alvo');
  assert.equal(danos(usar(e, b, { slot: 1, v: 0.9 }), b).length, 2, 'Dualidade: 5 estacas, 2 no alvo');
  ModsPoe.marcar(e.hunt, 'mudouPostura', e.hunt.clock);
  assert.equal(danos(usar(e, b, { slot: 1, v: 0.9 }), b).length, 5, 'Dualidade, mudou de Postura: 15 estacas, 5 no alvo');
  // na Postura de Areia: a área inteira, um acerto
  assert.ok(usar(e, b, { slot: 2 }).ok);
  const id = G.doSlug('Blood_and_Sand').acao;
  e.hunt.clock = Math.max(e.hunt.clock, e.hunt.cooldowns[id]?.ate ?? 0);
  assert.equal(Acoes.disparar(e, e.hunt, PERSONAGEM, 2, b, { manual: true }).postura, 'areia');
  assert.equal(danos(usar(e, b, { v: 0.9 }), b).length, 1, 'Areia: uma área');
});

test('C3: a Perfuração da Carnificina — as 6 estacas em qualquer Postura', { skip: SEM }, async () => {
  const { e, b } = await montar('Perforate_of_Bloodshed', { arma: 'One_Hand_Swords/Rusted_Sword' });
  assert.equal(danos(usar(e, b, { v: 0.9 }), b).length, 2, '6 estacas, 2 no alvo');
});

// ---------------------------------------------------------------- as Tempestades de Lâminas

test('C3 (D3.2): a Tempestade de Lâminas — na sua Postura, parada, com o "50% menos", a cada tempo de ataque; a de Sangue Sangra e dá 12% mais Velocidade de Ataque dentro dela', { skip: SEM }, async () => {
  const { e, b } = await montar('Bladestorm', { arma: 'One_Hand_Swords/Rusted_Sword' });
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Bladestorm').acao);
  const usoFora = Acoes.temposDaGemaPoe(e, entry).uso;
  const golpe = total(usar(e, b), b);
  assert.ok(golpe > 0);
  const [t] = objetos(e, 'tempestadeDeLaminas');
  assert.ok(t && t.postura === 'sangue' && t.sangra && t.raio === 1 && t.max === 4, JSON.stringify(t));
  assert.ok(Math.abs(t.intervaloMs - Math.round(usoFora)) <= 1, `a cada tempo de ataque: ${t.intervaloMs} / ${usoFora}`);
  assert.equal(t.ate - t.desde, 3000);
  assert.ok(conds(e).has('emTempestadeSangrenta'));
  assert.ok(Math.abs(usoFora / Acoes.temposDaGemaPoe(e, entry).uso - 1.12) < 0.01, '12% mais Velocidade de Ataque dentro da Sangrenta');
  b.dots = [];
  e.hunt.clock = t.desde;
  const ev = tique(e, t.intervaloMs);
  const doPulso = total(ev, b);
  assert.ok(doPulso > 0 && Math.abs(doPulso / golpe - 0.5) < 0.05, `o "50% menos": ${golpe} → ${doPulso}`);
  assert.ok((b.dots ?? []).some((d) => d.tipo === 'sangramento' || /sangr|bleed/i.test(d.tipo ?? '')), `Sangrou: ${JSON.stringify((b.dots ?? []).map((d) => d.tipo))}`);
  // o máximo: 4 (3 + a qualidade) — saem as mais velhas
  for (let i = 0; i < 5; i++) usar(e, b);
  assert.equal(objetos(e, 'tempestadeDeLaminas').length, 4);
});

test('C3: a Tempestade de Lâminas da Incerteza — 50% de chance da outra Postura (a de Areia Cega)', { skip: SEM }, async () => {
  const { e, b } = await montar('Bladestorm_of_Uncertainty', { arma: 'One_Hand_Swords/Rusted_Sword' });
  usar(e, b, { v: 0.4 });
  const [t] = objetos(e, 'tempestadeDeLaminas');
  assert.ok(t.postura === 'areia' && !t.sangra, JSON.stringify(t));
  e.hunt.clock = t.desde;
  tique(e, t.intervaloMs);
  assert.ok(b.estados?.cego, 'a de Areia Cega');
  usar(e, b, { v: 0.6 });
  assert.equal(objetos(e, 'tempestadeDeLaminas').at(-1).postura, 'sangue');
});

// ---------------------------------------------------------------- as Tempestades Furiosas

test('C3 (D3.2): o Vórtice Furioso — com ao menos 10 de Fúria, sacrifica 25% e a tempestade persegue, com 10% mais dano por Fúria, a cada tempo de ataque ÷ 3,5', { skip: SEM }, async () => {
  const { e, b } = await montar('Rage_Vortex', { arma: 'One_Hand_Swords/Rusted_Sword' });
  e.hunt.furia = { n: 9, ganhou: e.hunt.clock, perdeu: e.hunt.clock };
  usar(e, b);
  assert.equal(objetos(e, 'tempestadeFuriosa').length, 0, 'com 9, não');
  e.hunt.furia = { n: 20, ganhou: e.hunt.clock, perdeu: e.hunt.clock };
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Rage_Vortex').acao);
  const uso = Acoes.temposDaGemaPoe(e, entry).uso;
  usar(e, b);
  const [t] = objetos(e, 'tempestadeFuriosa');
  assert.ok(t && t.sacrificada === 5 && t.maisPct === 50 && t.mov === 'persegue', JSON.stringify(t));
  assert.equal(e.hunt.furia.n, 15);
  assert.ok(Math.abs(t.intervaloMs - uso / 3.5) <= 1, `${t.intervaloMs} / ${uso}`);
  assert.equal(t.ate - t.desde, 3000);
  e.hunt.clock = t.desde;
  assert.ok(total(tique(e, t.intervaloMs), b) > 0);
  // 1 por vez
  e.hunt.furia.n = 20;
  usar(e, b);
  assert.equal(objetos(e, 'tempestadeFuriosa').length, 1);
});

test('C3: o Vórtice Furioso do Berserker — presa em você, perde 3 de Fúria por segundo (20% mais a cada segundo) e acaba sem Fúria', { skip: SEM }, async () => {
  const { e, b } = await montar('Rage_Vortex_of_Berserking', { arma: 'One_Hand_Swords/Rusted_Sword' });
  e.hunt.furia = { n: 12, ganhou: e.hunt.clock, perdeu: e.hunt.clock };
  usar(e, b);
  const [t] = objetos(e, 'tempestadeFuriosa');
  assert.ok(t && t.presa && t.mov === 'no_dono' && t.sacrificada === 0, JSON.stringify(t));
  assert.equal(e.hunt.furia.n, 12, 'não sacrifica');
  const n0 = e.hunt.furia.n;
  e.hunt.clock = t.desde;
  tique(e, 1000);
  assert.equal(e.hunt.furia.n, n0 - 3);
  tique(e, 1000);
  assert.equal(e.hunt.furia.n, n0 - 6, '3,6 no 2º segundo (o 0,6 fica guardado)');
  for (let i = 0; i < 4; i++) tique(e, 1000);
  assert.equal(e.hunt.furia.n, 0);
  assert.equal(objetos(e, 'tempestadeFuriosa').length, 0, 'acabou com a Fúria');
});

// ---------------------------------------------------------------- D3.4: os Terremotos

test('C3 (D3.4): o Terremoto — o abalo estoura uma vez no fim da duração, no ponto do impacto, com o "180% mais" (150% + a qualidade)', { skip: SEM }, async () => {
  const { e, b } = await montar('Earthquake');
  const golpe = total(usar(e, b), b);
  const [a] = objetos(e, 'abalo');
  assert.ok(a && a.ate - a.desde === 1000 && a.c3Mais.acertoPct === 180, JSON.stringify(a));
  e.hunt.clock = a.desde;
  assert.equal(total(tique(e, 999), b), 0, 'ainda não');
  const ab = total(tique(e, 1), b);
  assert.ok(Math.abs(ab / golpe - 2.8) < 0.05, `o abalo: ${golpe} → ${ab}`);
  assert.equal(objetos(e, 'abalo').length, 0, 'uma vez');
});

test('C3: o Terremoto da Amplificação — 15% mais acerto e 2% mais área por 0,1 s de duração (3 s: 450% e 60%)', { skip: SEM }, async () => {
  const { e, b } = await montar('Earthquake_of_Amplification');
  const golpe = total(usar(e, b), b);
  const [a] = objetos(e, 'abalo');
  assert.deepEqual([a.ate - a.desde, a.c3Mais], [3000, { acertoPct: 450, afeccaoPct: 150 }]);
  e.hunt.clock = a.desde;
  const ab = total(tique(e, 3000), b);
  assert.ok(Math.abs(ab / golpe - 5.5) < 0.1, `${golpe} → ${ab}`);
});

test('C3 (D3.4): o Terremoto Vaal — o abalo do uso e, por 12 s, um a cada ataque seu (o anterior já estourado), até 9', { skip: SEM }, async () => {
  const { e, b } = await montar(['Vaal_Earthquake', 'Ground_Slam']);
  const golpe = total(usar(e, b), b);
  assert.ok(golpe > 0);
  const v = e.hunt.poeAbaloVaal;
  assert.ok(v && v.restantes === 8 && v.ate - e.hunt.clock <= 12000, JSON.stringify(v));
  // o ataque com o abalo do uso ainda pendente: não deixa outro
  e.hunt.clock = objetos(e, 'abalo')[0].desde + 10;
  usar(e, b, { slot: 1 });
  e.hunt.clock = objetos(e, 'abalo')[0].desde;
  assert.equal(objetos(e, 'abalo').length, 1);
  const ab = total(tique(e, 1000), b);
  assert.ok(Math.abs(ab / golpe - 5.37) < 0.1, `o "437% mais": ${golpe} → ${ab}`);
  for (let k = 0; k < 8; k++) {
    e.hunt.clock = Math.max(e.hunt.clock, e.hunt.cooldowns?.['grupo:poe']?.ate ?? 0);
    usar(e, b, { slot: 1 });
    const ab2 = objetos(e, 'abalo');
    assert.equal(ab2.length, 1, `o ${k + 2}º abalo`);
    e.hunt.clock = ab2[0].desde;
    tique(e, 1000);
  }
  assert.equal(e.hunt.poeAbaloVaal, undefined, 'acabou depois dos 9');
  e.hunt.clock = Math.max(e.hunt.clock, e.hunt.cooldowns?.['grupo:poe']?.ate ?? 0);
  usar(e, b, { slot: 1 });
  assert.equal(objetos(e, 'abalo').length, 0);
});

// ---------------------------------------------------------------- as Varridas Sagradas

test('C3: a Varrida Sagrada — os martelos em até 8 atingidos (5 + a qualidade), com o "−35%", sem poder ser evadidos', { skip: SEM }, async () => {
  const { e, b } = await montar('Holy_Sweep');
  const golpe = total(usar(e, b), b);
  const ms = objetos(e, 'martelo');
  assert.equal(ms.length, 1, 'um atingido, um martelo');
  b.evasao = 1e9;
  const ab = total(tique(e, 1), b);
  assert.ok(ab > 0 && Math.abs(ab / golpe - 0.65) < 0.05, `${golpe} → ${ab}`);
});

test('C3: a Varrida Sagrada dos Martelos Cadentes — 3 martelos a cada 0,7 s ÷ a Velocidade de Ataque, pela duração, com o "−50%"', { skip: SEM }, async () => {
  const { e, b } = await montar('Holy_Sweep_of_Hammerfalls');
  const golpe = total(usar(e, b), b);
  const [m] = objetos(e, 'martelosCadentes');
  assert.ok(m && m.porQueda === 3 && m.ate - m.desde === 3500 && m.intervaloMs <= 700, JSON.stringify(m));
  e.hunt.clock = m.desde;
  const ab = total(tique(e, m.intervaloMs), b);
  assert.ok(ab > 0 && Math.abs(ab / golpe - 0.5) < 0.05, `um inimigo, um martelo: ${golpe} → ${ab}`);
});

// ---------------------------------------------------------------- a Fissura do Serpenteado

test('C3: a Fissura Vulcânica do Serpenteado — irrompe 3 vezes a mais (2 + a qualidade), indo até o inimigo mais perto', { skip: SEM }, async () => {
  const { e, b } = await montar('Volcanic_Fissure_of_Snaking');
  assert.equal(danos(usar(e, b), b).length, 4);
  const { e: e0, b: b0 } = await montar('Volcanic_Fissure_of_Snaking', { qualidade: 0 });
  assert.equal(danos(usar(e0, b0), b0).length, 3);
});

// ---------------------------------------------------------------- D3.5: as Tormentas Explosivas

test('C3 (D3.5): a Tormenta Explosiva — 1 orbe por uso, que acerta ao nascer e a cada salto de 0,4 s; ao parar de canalizar, explode com o "mais" pelos saltos restantes', { skip: SEM }, async () => {
  const { e, b } = await montar('Storm_Burst', { arma: 'Staves/Gnarled_Branch' });
  const r = usar(e, b);
  assert.equal(total(r, b), 0, 'o uso não acerta na hora');
  const [o] = objetos(e, 'orbeTormentaExplosiva');
  assert.ok(o && o.ate - o.desde === 1600, JSON.stringify(o));
  e.hunt.clock = o.desde;
  const nascer = total(tique(e, 0), b);
  assert.ok(nascer > 0, 'o acerto ao nascer');
  // a canalização segue (o próximo uso): o orbe salta
  const s1 = total(tique(e, 200), b);
  assert.equal(s1, 0);
  // parou de canalizar (passou a folga): explode — restavam 1,6 − 0,2 = 1,4 s (3 saltos): 75 × 3 − 100 = 125% mais
  e.hunt.canalizacao.ate = e.hunt.clock - 1000;
  const ex = total(tique(e, 0), b);
  assert.ok(Math.abs(ex / nascer - 2.25) < 0.05, `${nascer} → ${ex}`);
  assert.equal(objetos(e, 'orbeTormentaExplosiva').length, 0);
});

// (dono, 25/10) a Repulsão: os orbes se afastam do local mirado (o PoE), no passo de 0,4 s, com o alcance de 7 casas
test('C3 (dono 25/10): a conta do salto da Repulsão — o vivo mais perto que fica mais longe do local mirado, a até 7 casas; sem ele, 1 casa para longe', { skip: SEM }, () => {
  const mira = { x: 0, y: 0 };
  assert.deepEqual(C3.saltoDaRepulsao({ x: 2, y: 0 }, mira, [{ x: 1, y: 0 }, { x: 5, y: 1 }, { x: 12, y: 0 }]), { x: 5, y: 1 }, 'o de x=1 está mais perto da mira; o de x=12, fora das 7 casas');
  assert.deepEqual(C3.saltoDaRepulsao({ x: 2, y: -1 }, mira, [{ x: 1, y: 0 }]), { x: 3, y: -2 }, 'sem inimigo mais longe: 1 casa para longe');
  assert.deepEqual(C3.saltoDaRepulsao({ x: 0, y: 0 }, mira, []), { x: 1, y: 0 }, 'em cima da mira: anda 1 casa');
});

test('C3 (dono 25/10): a Tormenta Explosiva da Repulsão — os orbes se afastam do local mirado (não vão ao vivo mais perto)', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Storm_Burst_of_Repulsion', { arma: 'Staves/Gnarled_Branch' });
  // o alvo (o local mirado) a 1 casa à direita; um segundo inimigo à esquerda, mais longe do alvo
  const [c] = resto;
  Object.assign(c, { x: e.hunt.pos.x - 2, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, evasao: 0, armaduraPct: -100 });
  usar(e, b);
  const [o] = objetos(e, 'orbeTormentaExplosiva');
  assert.deepEqual(o.longeDe, { x: b.x, y: b.y });
  e.hunt.canalizacao.ate = 1e15; // (segue canalizando: os orbes não explodem)
  e.hunt.clock = o.desde;
  tique(e, 0);
  tique(e, 400);
  assert.deepEqual({ x: o.x, y: o.y }, { x: c.x, y: c.y }, 'saltou para o inimigo do outro lado, longe do alvo');
  tique(e, 400);
  assert.deepEqual({ x: o.x, y: o.y }, { x: c.x - 1, y: c.y }, 'e segue se afastando');
  // a comum, no mesmo arranjo, salta para o vivo mais perto (o alvo)
  const m = await montar('Storm_Burst', { arma: 'Staves/Gnarled_Branch' });
  usar(m.e, m.b);
  const [o2] = objetos(m.e, 'orbeTormentaExplosiva');
  assert.equal(o2.longeDe, undefined);
  m.e.hunt.clock = o2.desde;
  tique(m.e, 0);
  tique(m.e, 400);
  assert.deepEqual({ x: o2.x, y: o2.y }, { x: m.b.x, y: m.b.y });
});
