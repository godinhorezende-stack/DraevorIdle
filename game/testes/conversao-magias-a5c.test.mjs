// (lote A5c, dono 20/10: "corrigir como o PoE") A CONVERSÃO DO FÍSICO DAS MAGIAS: a conversão da gema entra nas partes do golpe da magia
// (`GemasPoe.partesDaMagia`), como nos ataques — vale também para o Físico ADICIONADO (peças, suportes) —, na ordem do PoE: a da gema, depois a das outras
// fontes (só no que a gema deixou, `ModsPoe.extrasDoFisico` com o `teto`) e o "Físico como Extra" sobre o Físico de antes da conversão. O Tornado da
// Turbulência Elemental sorteia o elemento uma vez por Tornado; a Onda de Convicção sai de parcial. Os sorteios ficam travados.
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
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const A5 = await import('../systems/itens-poe/gemas-a5.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const faixaPerto = (x, [a, b]) => perto(x[0], a) && perto(x[1], b);

/** Roda `fn` com o `Math.random` travado em `v`. */
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
/** O personagem com as gemas na arma, numa caçada; o alvo imortal colado e os outros longe. */
async function montar(slugs, { arma = 'One_Hand_Swords/Rusted_Sword', escudo = 'Shields/Splintered_Tower_Shield', nivel = 20, anel = null } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: slugs.length, links: Array(Math.max(0, slugs.length - 1)).fill(true), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  if (escudo) e.equipment.shield = peca(escudo);
  // (um anel do PoE com estes atributos já traduzidos — como em itens-poe-mods)
  if (anel) e.equipment.ring = { id: J.idDaBase('Rings/Iron_Ring'), count: 1, poe: { base: 'Rings/Iron_Ring', classe: 'Rings', af: anel, tv: J.VERSAO_DA_TRADUCAO } };
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: doSlug(s).itemId, nivel, xp: 0, raridade: 'comum' }));
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
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {} });
  return { e, b };
}
const usar = (e, b) => travado(0.5, () => {
  const x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
  return x;
});

// ---------------------------------------------------------------- a conversão da gema (o PoB)

// (o PoB: skill_physical_damage_%_to_convert_to_* — act_int.lua / act_str.lua / act_dex.lua)
const CONVERSOES_DO_POB = {
  Wave_of_Conviction: { energy: 25, fire: 25 }, // act_int.lua:20817
  Wave_of_Conviction_of_Trarthus: { fire: 50 }, // act_int.lua:20904
  Glacial_Cascade: { ice: 100 }, Glacial_Cascade_of_the_Fissure: { ice: 100 }, // act_int.lua:8804, 8884
  Penance_Brand: { energy: 50 }, Penance_Brand_of_Dissipation: { energy: 50 }, Penance_Brand_of_Conduction: { energy: 50 }, // act_int.lua:13833, 13942, 14035
  Void_Sphere: { chaos: 60 }, Void_Sphere_of_Rending: { chaos: 60 }, // act_int.lua:20285, 20374
  Divine_Ire: { energy: 50 }, Divine_Ire_of_Holy_Lightning: { energy: 50 }, Divine_Ire_of_Disintegration: { energy: 50 }, // act_int.lua:4642, 4752, 4846
  Divine_Retribution: { energy: 50 }, // act_int.lua:4926
  Storm_Burst: { energy: 50 }, Storm_Burst_of_Repulsion: { energy: 50 }, // act_int.lua:18072, 18181
  Purifying_Flame: { fire: 50 }, Purifying_Flame_of_Revelations: { fire: 50 }, // act_int.lua:14391, 14494
  Absolution: { energy: 50 }, Absolution_of_Inspiring: { energy: 50 }, // act_str.lua:24, 120
  Holy_Flame_Totem: { fire: 50 }, Holy_Flame_Totem_of_Ire: { fire: 50 }, // act_str.lua:5877, 5963
  Explosive_Trap: { fire: 50 }, Explosive_Trap_of_Shrapnel: { fire: 50 }, // act_dex.lua:7243, 7335
};

test('A5c: as magias convertem o Físico da gema como no PoB', { skip: SEM }, async () => {
  await G.iniciar({ registrarGema: () => {}, registrarReforco: () => {} });
  for (const [slug, conv] of Object.entries(CONVERSOES_DO_POB)) {
    const [a, b] = G.compilada(slug, 20).stats.dano.fisico;
    const p = G.partesDaMagia(slug, 20);
    const resto = 1 - Object.values(conv).reduce((t, x) => t + x, 0) / 100;
    for (const [el, pct] of Object.entries(conv)) assert.ok(faixaPerto(p[el], [(a * pct) / 100, (b * pct) / 100]), `${slug}: ${el} ${JSON.stringify(p)}`);
    if (resto > 0) assert.ok(faixaPerto(p.physical, [a * resto, b * resto]), `${slug}: o Físico que sobra ${JSON.stringify(p)}`);
    else assert.equal(p.physical, undefined, `${slug}: todo o Físico convertido`);
  }
});

test('A5c: a conversão vale para o Físico adicionado; o adicionado dos elementos não muda', { skip: SEM }, () => {
  const [a, b] = G.compilada('Glacial_Cascade', 20).stats.dano.fisico;
  const p = G.partesDaMagia('Glacial_Cascade', 20, { physical: [10, 20], fire: [5, 7] });
  assert.ok(faixaPerto(p.ice, [a + 10, b + 20]), JSON.stringify(p));
  assert.ok(faixaPerto(p.fire, [5, 7]));
  assert.equal(p.physical, undefined);
  // a Onda de Convicção: o Físico adicionado também vai 25% em Raio e 25% em Fogo
  const [wa, wb] = G.compilada('Wave_of_Conviction', 20).stats.dano.fisico;
  const w = G.partesDaMagia('Wave_of_Conviction', 20, { physical: [100, 100] });
  assert.ok(faixaPerto(w.energy, [(wa + 100) / 4, (wb + 100) / 4]));
  assert.ok(faixaPerto(w.fire, [(wa + 100) / 4, (wb + 100) / 4]));
  assert.ok(faixaPerto(w.physical, [(wa + 100) / 2, (wb + 100) / 2]));
  // a magia sem conversão segue igual (a Bola de Fogo: só Fogo + o adicionado de cada elemento)
  const fb = G.partesDaMagia('Fireball', 20, { physical: [3, 4] });
  assert.ok(faixaPerto(fb.physical, [3, 4]));
});

test('A5c: a ordem do PoE — a conversão da gema, a das outras fontes no que sobrou, e o Físico como Extra sobre o Físico de antes', { skip: SEM }, () => {
  const ficha = { afPoe: { phys_conv_fire: 80, phys_as_extra_chaos: 10 } };
  const outras = (fis, teto) => ModsPoe.extrasDoFisico(ficha, fis, () => 0.5, teto);
  // a Marca da Penitência: 50% em Raio pela gema; os 80% em Fogo das outras fontes só convertem os 50% que sobraram; o Caos extra é 10% do Físico todo
  const [a, b] = G.compilada('Penance_Brand', 20).stats.dano.fisico;
  const p = G.partesDaMagia('Penance_Brand', 20, {}, { outras });
  assert.ok(faixaPerto(p.energy, [a / 2, b / 2]), JSON.stringify(p));
  assert.ok(faixaPerto(p.fire, [a / 2, b / 2]));
  assert.ok(faixaPerto(p.chaos, [a / 10, b / 10]));
  assert.equal(p.physical, undefined, 'nada de Físico sobra');
  // a Cascata Glacial: 100% pela gema — as outras fontes não convertem nada, o extra ainda sai do Físico de antes
  const c = G.partesDaMagia('Glacial_Cascade', 20, {}, { outras });
  const [ca, cb] = G.compilada('Glacial_Cascade', 20).stats.dano.fisico;
  assert.ok(faixaPerto(c.ice, [ca, cb]));
  assert.equal(c.fire, undefined);
  assert.ok(faixaPerto(c.chaos, [ca / 10, cb / 10]));
  // o teto padrão (100) segue o de antes: os 80% em Fogo das outras fontes
  const sem = ModsPoe.extrasDoFisico(ficha, [100, 100], () => 0.5);
  assert.equal(sem.convertidoPct, 80);
  assert.equal(ModsPoe.extrasDoFisico(ficha, [100, 100], () => 0.5, 30).convertidoPct, 30);
});

test('A5c: o Tornado da Turbulência Elemental converte num elemento aleatório (o PoB), sorteado uma vez por Tornado', { skip: SEM }, async () => {
  assert.deepEqual(G.conversaoDaMagia('Tornado_of_Elemental_Turbulence', 20), [{ para: 'aleatorio', pct: 100 }]);
  const [a, b] = G.compilada('Tornado_of_Elemental_Turbulence', 20).stats.dano.fisico;
  for (const el of ['fire', 'ice', 'energy']) assert.deepEqual(Object.keys(G.partesDaMagia('Tornado_of_Elemental_Turbulence', 20, {}, { elementoSorteado: el })), [el]);
  assert.ok(faixaPerto(G.partesDaMagia('Tornado_of_Elemental_Turbulence', 20, {}, { rng: () => 0.9 }).energy, [a, b]));
  // no jogo: o Tornado guarda o elemento sorteado ao nascer (rng 0,5 → Gelo)
  const { e, b: alvo } = await montar(['Tornado_of_Elemental_Turbulence']);
  const r = usar(e, alvo);
  assert.ok(r.ok, r.erro);
  const t = (e.hunt.poeObjetos ?? []).find((o) => o.slug === 'Tornado_of_Elemental_Turbulence');
  assert.ok(t, 'o Tornado nasceu');
  assert.equal(t.elementoSorteado, 'ice');
  // o elemento do objeto chega ao golpe: fixado em Fogo (o sorteio de reserva, com o rng 0,5, daria Gelo), a resistência a Fogo corta o pulso a ~0,25 e a de
  // Gelo não muda nada
  const pulso = async (resist) => {
    const { e: e2, b: b2 } = await montar(['Tornado_of_Elemental_Turbulence']);
    assert.ok(usar(e2, b2).ok);
    const o = e2.hunt.poeObjetos.find((x) => x.slug === 'Tornado_of_Elemental_Turbulence');
    o.elementoSorteado = 'fire';
    Object.assign(o, { x: b2.x, y: b2.y });
    b2.resist = resist;
    const vida = b2.hp;
    travado(0.5, () => { e2.hunt.clock = o.proxima; Acoes.tiqueDosObjetos(e2, e2.hunt, PERSONAGEM, [], e2.hunt.clock); });
    return vida - b2.hp;
  };
  const semRes = await pulso({});
  assert.ok(semRes > 0, 'o pulso acertou');
  assert.ok(perto((await pulso({ fire: 75 })) / semRes, 0.25, 0.02));
  assert.ok(perto(await pulso({ ice: 75 }), semRes, 0.001));
  // o Tornado comum não converte
  assert.deepEqual(G.conversaoDaMagia('Tornado', 20), []);
});

test('A5c no jogo: a Cascata Glacial bate Gelo — a resistência a Gelo do alvo corta o golpe todo', { skip: SEM }, async () => {
  const golpe = async (resist) => {
    const { e, b } = await montar(['Glacial_Cascade']);
    b.resist = resist;
    const vida = b.hp;
    const r = usar(e, b);
    assert.ok(r.ok, r.erro);
    return vida - b.hp;
  };
  const sem = await golpe({});
  const gelo = await golpe({ ice: 75 });
  const fisico = await golpe({ physical: 75 });
  assert.ok(sem > 0, 'acertou');
  assert.ok(perto(gelo / sem, 0.25, 0.02), `razão ${gelo / sem}`);
  assert.ok(perto(fisico, sem, 0.001), 'a resistência física não muda nada: não sobra Físico');
});

test('A5c no jogo: a Onda de Convicção sozinha põe a Exposição no elemento do maior dano e sai de parcial', { skip: SEM }, async () => {
  assert.deepEqual(A5.MOTIVOS_A5, {});
  const reg = G.REGISTRO.get('Wave_of_Conviction');
  assert.ok(!reg.motivosNoJogo.some((m) => /conversão do Físico das magias/.test(m)), JSON.stringify(reg.motivosNoJogo));
  assert.equal(reg.statusNoJogo, 'funciona');
  const exposicao = async (resist) => {
    const { e, b } = await montar(['Wave_of_Conviction']);
    b.resist = resist;
    const r = usar(e, b);
    assert.ok(r.ok, r.erro);
    return b.estados.exposicaoPct ?? {};
  };
  // o Fogo e o Raio saem iguais da conversão (25% cada): o que o alvo resiste menos é o maior depois da resistência
  assert.deepEqual(await exposicao({ energy: 75 }), { fire: 15 });
  assert.deepEqual(await exposicao({ fire: 75 }), { energy: 15 });
});

test('A5c: passando do que sobra, as conversões das outras fontes são reduzidas PROPORCIONALMENTE (o PoE), nas magias e nos ataques', { skip: SEM }, () => {
  const ficha = { afPoe: { phys_conv_fire: 60, phys_conv_ice: 60 } };
  // sem gema (o teto 100, o dos ataques): 120% pedidos → 50% Fogo e 50% Gelo (antes: 60% Fogo e 40% Gelo, em sequência)
  const ataque = ModsPoe.extrasDoFisico(ficha, [100, 200], () => 0.5);
  assert.ok(perto(ataque.convertidoPct, 100));
  assert.ok(faixaPerto(ataque.extras.fire, [50, 100]), JSON.stringify(ataque.extras));
  assert.ok(faixaPerto(ataque.extras.ice, [50, 100]));
  // abaixo do teto, cada uma inteira
  const pouco = ModsPoe.extrasDoFisico({ afPoe: { phys_conv_fire: 20, phys_conv_ice: 30 } }, [100, 100], () => 0.5);
  assert.ok(perto(pouco.convertidoPct, 50));
  assert.ok(faixaPerto(pouco.extras.fire, [20, 20]) && faixaPerto(pouco.extras.ice, [30, 30]));
  // na magia: a Marca da Penitência converte 50% em Raio; os 120% das outras fontes dividem os 50% que sobram — 25% Fogo, 25% Gelo
  const [a, b] = G.compilada('Penance_Brand', 20).stats.dano.fisico;
  const p = G.partesDaMagia('Penance_Brand', 20, {}, { outras: (fis, teto) => ModsPoe.extrasDoFisico(ficha, fis, () => 0.5, teto) });
  assert.ok(faixaPerto(p.energy, [a / 2, b / 2]), JSON.stringify(p));
  assert.ok(faixaPerto(p.fire, [a / 4, b / 4]));
  assert.ok(faixaPerto(p.ice, [a / 4, b / 4]));
  assert.equal(p.physical, undefined);
  // o aleatório entra na mesma divisão
  const comAleatorio = ModsPoe.extrasDoFisico({ afPoe: { phys_conv_fire: 100, phys_conv_random: 100 } }, [100, 100], () => 0.9);
  assert.ok(faixaPerto(comAleatorio.extras.fire, [50, 50]) && faixaPerto(comAleatorio.extras.energy, [50, 50]), JSON.stringify(comAleatorio.extras));
});

test('A5c: nos ataques, a mesma ordem — a gema primeiro, as outras fontes no Físico que sobrou, o como Extra sobre o Físico de antes (com a eficácia)', { skip: SEM }, () => {
  // as Lâminas Gélidas: 60% em Gelo pela gema; a peça converte 50% em Fogo — só os 40% que sobraram; o Gelo extra é 20% de todo o Físico do golpe
  const ficha = { afPoe: { phys_conv_fire: 50, phys_as_extra_ice: 20 } };
  const ef = G.compilada('Frost_Blades', 20).stats.efetividade;
  const p = G.partesDoAtaque('Frost_Blades', 20, { min: 100, max: 200 }, {}, () => 0.5, { outras: (fis, teto) => ModsPoe.extrasDoFisico(ficha, fis, () => 0.5, teto) });
  assert.ok(faixaPerto(p.ice, [100 * ef * 0.8, 200 * ef * 0.8]), JSON.stringify(p));
  assert.ok(faixaPerto(p.fire, [100 * ef * 0.4, 200 * ef * 0.4]));
  assert.equal(p.physical, undefined, 'nada de Físico sobra');
  // o Físico adicionado (as peças) também passa pela mesma conta
  const q = G.partesDoAtaque('Frost_Blades', 20, { min: 0, max: 0 }, { physical: [10, 10] }, () => 0.5, { outras: (fis, teto) => ModsPoe.extrasDoFisico(ficha, fis, () => 0.5, teto) });
  assert.ok(faixaPerto(q.ice, [8, 8]) && faixaPerto(q.fire, [4, 4]), JSON.stringify(q));
  // sem `outras`, como antes: só a conversão da gema
  const s = G.partesDoAtaque('Frost_Blades', 20, { min: 100, max: 200 }, {}, () => 0.5);
  assert.ok(faixaPerto(s.ice, [60 * ef, 120 * ef]) && faixaPerto(s.physical, [40 * ef, 80 * ef]));
});

// ---------------------------------------------------------------- (revisão do A5c) as origens das partes e os locais da arma

test('A5c (revisão): o dano convertido e o "como Extra" guardam os tipos por onde passaram (as origens)', { skip: SEM }, () => {
  // no ataque: as Lâminas Gélidas — 60% do Físico em Gelo pela gema, 20% do Físico como Gelo extra: o Gelo todo veio do Físico
  const origens = {};
  const p = G.partesDoAtaque('Frost_Blades', 20, { min: 100, max: 100 }, { fire: [10, 10] }, () => 0.5, { origens, outras: (fis, teto) => ModsPoe.extrasDoFisico({ afPoe: { phys_as_extra_ice: 20 } }, fis, () => 0.5, teto) });
  const ef = G.compilada('Frost_Blades', 20).stats.efetividade;
  assert.deepEqual(Object.keys(origens.ice), ['physical+ice']);
  assert.ok(faixaPerto(origens.ice['physical+ice'], p.ice) && faixaPerto(p.ice, [80 * ef, 80 * ef]));
  assert.deepEqual(origens.fire, { fire: [10, 10] }, 'o Fogo adicionado é só Fogo');
  assert.deepEqual(Object.keys(origens.physical), ['physical']);
  // na magia: a Marca da Penitência — o Raio veio do Físico
  const om = {};
  G.partesDaMagia('Penance_Brand', 20, { energy: [5, 5] }, { origens: om });
  assert.deepEqual(Object.keys(om.energy).sort(), ['energy', 'physical+energy']);
  // nas conversões entre elementos: o Fogo que veio do Físico, convertido em Caos, leva os três tipos; o ganho como extra também
  const o2 = { fire: { 'physical+fire': [60, 60], fire: [40, 40] } };
  const t = ModsPoe.transformarPartes({ afPoe: { conv_fire_chaos: 50 } }, { fire: [100, 100] }, o2);
  assert.ok(faixaPerto(t.chaos, [50, 50]) && faixaPerto(t.fire, [50, 50]));
  assert.ok(faixaPerto(o2.chaos['physical+fire+chaos'], [30, 30]) && faixaPerto(o2.chaos['fire+chaos'], [20, 20]), JSON.stringify(o2));
  assert.ok(faixaPerto(o2.fire['physical+fire'], [30, 30]) && faixaPerto(o2.fire.fire, [20, 20]));
  const o3 = { ice: { ice: [100, 100] } };
  ModsPoe.transformarPartes({ afPoe: { ice_as_extra_chaos: 10 } }, { ice: [100, 100] }, o3);
  assert.ok(faixaPerto(o3.chaos['ice+chaos'], [10, 10]) && faixaPerto(o3.ice.ice, [100, 100]));
});

test('A5c (revisão): o fator médio das origens e os "mais" do caminho, sem contar duas vezes', { skip: SEM }, () => {
  // 30 do Físico convertido (× 3) e 10 nativos (× 1): (30 × 3 + 10 × 1) ÷ 40
  const f = ModsPoe.fatorPelasOrigens({ 'physical+ice': [20, 40], ice: [10, 10] }, 'ice', (tipos) => (tipos.includes('physical') ? 3 : 1));
  assert.ok(perto(f, 100 / 40));
  assert.equal(ModsPoe.fatorPelasOrigens(undefined, 'ice', (tipos) => (tipos[0] === 'ice' ? 7 : 0)), 7);
  // o "mais" do Físico entra no Gelo que veio dele (o do Gelo vai no acerto); o "mais Dano Elemental", uma vez só, mesmo num caminho Fogo → Gelo
  const ficha = { afPoe: { mais_dano_fisico: 20, mais_dano_gelo: 50, mais_dano_elemental: 10 } };
  assert.ok(perto(ModsPoe.maisDaOrigem(ficha, null, 'x', ['physical', 'ice'], 'ice'), 1.2 * 1.1));
  assert.ok(perto(ModsPoe.maisDaOrigem(ficha, null, 'x', ['ice'], 'ice'), 1.1));
  assert.ok(perto(ModsPoe.maisDaOrigem(ficha, null, 'x', ['fire', 'ice'], 'ice'), 1.1), 'o Fogo do caminho: o "mais Dano Elemental" não repete');
  // o Fogo convertido em Caos: o "mais Dano Elemental" vale (o caminho foi elemental), e o "mais" do Fogo também
  assert.ok(perto(ModsPoe.maisDaOrigem({ afPoe: { mais_dano_fogo: 30, mais_dano_elemental: 10 } }, null, 'x', ['fire', 'chaos'], 'chaos'), 1.3 * 1.1));
});

test('A5c (revisão) no jogo: a Cascata Glacial ganha o "Dano Físico aumentado" igual ao "Dano de Gelo aumentado" (o Gelo veio do Físico)', { skip: SEM }, async () => {
  const golpe = async (anel) => {
    const { e, b } = await montar(['Glacial_Cascade'], { anel });
    const vida = b.hp;
    assert.ok(usar(e, b).ok);
    return vida - b.hp;
  };
  const sem = await golpe(null);
  const fisico = await golpe({ phys_dmg: 100 });
  const gelo = await golpe({ ice_dmg: 100 });
  const os2 = await golpe({ phys_dmg: 100, ice_dmg: 100 });
  assert.ok(sem > 0);
  assert.ok(fisico > sem * 1.2, `o Físico aumentado vale: ${fisico} > ${sem}`);
  assert.ok(perto(fisico, gelo, 0.002), `${fisico} ≈ ${gelo}`);
  // somados, uma vez cada (aditivos: + 100% + 100%)
  assert.ok(perto(os2 - sem, 2 * (fisico - sem), 0.004), `${os2 - sem} ≈ 2 × ${fisico - sem}`);
});

test('A5c (revisão): os locais da arma ("com essa/esta Arma") só valem nos ataques — não nas magias', { skip: SEM }, async () => {
  const T = await import('../systems/itens-poe/traduzir.mjs');
  assert.deepEqual(T.traduzirParte('{50}% do Dano Físico de Acertos com essa Arma é Convertido para um Elemento Aleatório', [50]).efeitos.map((x) => x.stat), ['phys_conv_random@ataque']);
  assert.deepEqual(T.traduzirParte('Acertos com esta Arma ganham {80}% de Dano Físico como Dano de Gelo ou Raio Extra', [80]).efeitos.map((x) => x.stat), ['phys_as_extra_gelo_ou_raio@ataque']);
  // a linha global (sem "com essa Arma") segue em todo golpe
  assert.deepEqual(T.traduzirParte('{50}% do Dano Físico convertido para um Elemento aleatório', [50]).efeitos.map((x) => x.stat), ['phys_conv_random']);
  const porTag = [{ stat: 'phys_conv_random', tags: ['ataque'], valor: 100 }, { stat: 'phys_as_extra_gelo_ou_raio', tags: ['ataque'], valor: 50 }];
  const magia = ModsPoe.extrasDoFisico({ afPoe: {}, porTag, tagsDoGolpe: ['magia'] }, [100, 100], () => 0.1);
  assert.equal(magia.convertidoPct, 0);
  assert.deepEqual(magia.extras, {});
  const ataque = ModsPoe.extrasDoFisico({ afPoe: {}, porTag, tagsDoGolpe: ['ataque', 'corpo'] }, [100, 100], () => 0.1);
  assert.equal(ataque.convertidoPct, 100);
  assert.ok(faixaPerto(ataque.extras.fire, [100, 100]) && faixaPerto(ataque.extras.ice, [50, 50]), JSON.stringify(ataque.extras));
});
