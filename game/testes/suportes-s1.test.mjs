// (lote S1, 26/10) OS SUPORTES COM 1 OU 2 LINHAS FALTANDO (a fila S1): as linhas que viraram atributos do uso (o Cegar, a Mutilação, o Esmagar, o Intimidar, o
// Enervar, o "mais por Carga"), as cargas do suporte (Poder no Crítico, Tolerância ao Atordoar, Frenesi ao Matar um Congelado), o abate (o Devorar, a Aniquilação), a
// Proliferação e a Dose Letal, o Sacrificar e o Sacrifício Vaal, o Incêndio Controlado, o Superaquecimento, a Comunhão, a Cascata Mágica, a Segunda Ventania, a Runa
// Repentina, o Conjurar no Crítico Desperto, o Arquimago e a Vontade de Ferro (o dano mostrado), a Congregação e a Onda de Choque. Os sorteios ficam travados.
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
const L = await import('../systems/itens-poe/linhas-das-gemas.mjs');
const QuemFeriu = await import('../systems/hunt/quem-feriu.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const CargasPoe = await import('../systems/itens-poe/cargas.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
const TAGS = (...t) => ({ tags: t.map((x) => `poe:${x}`) });
const ef = (slug, nivel = 20, q = 0, tags = TAGS('Magia', 'Ataque', 'Projétil', 'Área', 'Corpo a Corpo', 'Fogo', 'Gelo', 'Raio', 'Caos', 'Físico')) => SP.efeitoNoNivel(slug, nivel, q, tags).efeito;
/** O personagem com as gemas na arma, numa caçada; o alvo imortal colado e os outros longe. */
async function montar(slugs, { arma = 'One_Hand_Swords/Rusted_Sword', nivel = 20 } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: slugs.length, links: Array(Math.max(0, slugs.length - 1)).fill(true), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: doSlug(s).itemId, nivel, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < slugs.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(slugs[0]).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  return e;
}
const bicho = (extra = {}) => ({ uid: 'b' + Math.random(), name: 'Alvo', x: 10, y: 10, z: 0, hp: 1000, maxHp: 1000, estados: {}, dots: [], ...extra });
const huntCom = (monstros, extra = {}) => ({ clock: 10_000, z: 0, pos: { x: 0, y: 0 }, monstros, ...extra });

const FEITOS = ['Maim_Support', 'Endurance_Charge_on_Melee_Stun_Support', 'Iron_Grip_Support', 'Iron_Will_Support', 'Bloodthirst_Support', 'Controlled_Blaze_Support', 'Annihilation_Support',
  'Awakened_Brutality_Support', 'Awakened_Melee_Physical_Damage_Support', 'Overheat_Support', 'Blind_Support', 'Ice_Bite_Support', 'Second_Wind_Support', 'Awakened_Cast_On_Critical_Strike_Support',
  'Greater_Chain_Support', 'Lethal_Dose_Support', 'Elemental_Proliferation_Support', 'Spell_Cascade_Support', 'Devour_Support', 'Power_Charge_On_Critical_Support', 'Archmage_Support',
  'Sacrifice_Support', 'Swiftbrand_Support', 'Decay_Support', 'Ignite_Proliferation_Support', 'Minefield_Support', 'Invention_Support', 'Awakened_Cast_While_Channelling_Support',
  'Awakened_Controlled_Destruction_Support', 'Awakened_Spell_Cascade_Support', 'Congregation_Support', 'Frostmage_Support', 'Greater_Spell_Cascade_Support', 'Communion_Support',
  'Scornful_Herald_Support', 'Vaal_Sacrifice_Support', 'Hextouch_Support', 'Ancestral_Call_Support', 'Awakened_Ancestral_Call_Support', 'Greater_Ancestral_Call_Support', 'Overexertion_Support'];
test('S1: os suportes da fila feitos saem de "parcial" — nenhuma linha não feita no nível máximo, com a qualidade 20', { skip: SEM }, () => {
  const falhas = FEITOS.filter((s) => SP.doSlug(s)?.status !== 'funciona').map((s) => `${s}: ${SP.doSlug(s)?.status} ${(SP.doSlug(s)?.motivos ?? []).join(' | ')}`);
  assert.deepEqual(falhas, [], falhas.join('\n'));
  // (a Onda de Choque: a linha do gatilho é feita; fica a mesma nota do acerto sem golpe da Excepcional)
  assert.equal(SP.doSlug('Shockwave_Support').status, 'parcial');
  assert.ok(SP.doSlug('Shockwave_Support').motivos.every((m) => /acerto sem golpe/.test(m)), SP.doSlug('Shockwave_Support').motivos.join(' | '));
});

test('S1: as linhas viram os atributos do uso — o Cegar, a Mutilação, o Esmagar, o Intimidar, o Enervar e o "mais Dano por Carga"', { skip: SEM }, () => {
  const casos = {
    '10% de chance de Cegar inimigos ao acertar': { chance_cegar: 10 },
    '38% da duração da Cegueira aumentada': { duracao_cegueira: 38 },
    'Efeito da Mutilação aumentado em 20%': { efeito_mutilacao: 20 },
    '10% de chance de Esmagar Inimigos por 4 segundos ao Acertar': { chance_esmagar: 10 },
    '10% de chance de Intimidar Inimigos por 4 segundos ao Acertar': { chance_intimidar: 10, intimidar_s: 4 },
    '10% de chance de Enervar Inimigos por 4 segundos ao Acertar': { chance_inervar: 10, inervar_s: 4 },
    '4% mais Dano por Carga de Tolerância': { 'mais_dano%carga:tolerancia': 4 },
  };
  for (const [l, esperado] of Object.entries(casos)) assert.deepEqual(L.atributosDaLinha(l), esperado, l);
  // (no suporte, com o "Habilidades Suportadas têm")
  assert.deepEqual([ef('Blind_Support', 20, 20)['af:chance_cegar'], ef('Blind_Support', 20, 20)['af:duracao_cegueira'], ef('Blind_Support', 20, 20)['af:efeito_cegueira']], [10, 38, 10]);
  assert.equal(ef('Maim_Support', 20, 20)['af:efeito_mutilacao'], 20);
  assert.equal(ef('Awakened_Brutality_Support', 20)['af:chance_esmagar'], 10);
  assert.equal(ef('Awakened_Melee_Physical_Damage_Support', 20)['af:chance_intimidar'], 10);
  assert.equal(ef('Awakened_Controlled_Destruction_Support', 20)['af:chance_inervar'], 10);
});

test('S1: os números dos suportes no nível 20 — o "por Carga" escala, as chances somam a qualidade, a recuperação soma antes de virar tempo', { skip: SEM }, () => {
  const pc = ef('Power_Charge_On_Critical_Support', 20, 20);
  assert.deepEqual([pc.cargaPoderNoCriticoPct, pc['af:mais_dano%carga:poder'], pc.maisDanoPct], [64, 4, undefined], '54% + 10% da qualidade; 4% mais por Carga de Poder (antes, 4% fixo)');
  const ib = ef('Ice_Bite_Support', 20, 20);
  assert.deepEqual([ib.somadoMin, ib.somadoMax, ib['af:added_ice_dmg_min%carga:frenesi'], ib['af:spell_added_ice_dmg_max%carga:frenesi'], ib['af:dmg_inc%carga:frenesi'], ib.danoPct, ib.cargaFrenesiAoMatarCongeladoPct], [69, 103, 15, 23, 2, undefined, 69]);
  const bt = ef('Bloodthirst_Support', 20, 20, TAGS('Ataque'));
  assert.deepEqual([bt['af:added_physical_dmg_min%vidaMax:1@vidaBaixa'], bt['af:dmg_inc@vidaBaixa'], bt.danoPct], [0.02, 20, undefined]);
  // (a Segunda Ventania: −5% do nível e +5% da qualidade somam zero; sem qualidade, 5% reduzida = 5,26% mais tempo)
  assert.equal(ef('Second_Wind_Support', 20, 20).recargaPct, undefined);
  assert.ok(perto(ef('Second_Wind_Support', 20, 0).recargaPct, (1 / 0.95 - 1) * 100), String(ef('Second_Wind_Support', 20, 0).recargaPct));
  assert.equal(ef('Second_Wind_Support', 20).usosExtraNaoInstantanea, 1);
  const sb = ef('Swiftbrand_Support', 20, 20);
  assert.deepEqual([sb.freqAtivacaoMaisPct, sb.duracaoMaisPct, sb.duracaoPct], [49, -65, undefined], '44% + 5% no mesmo "mais"; −65% MAIS, uma vez (antes, −130% no aumentado)');
  assert.equal(SP.fichaNoNivel('Awakened_Cast_On_Critical_Strike_Support', 20).gatilho.recargaMs, Math.round(150 / 1.52), 'a recarga do gatilho ÷ 1,52');
  assert.equal(ef('Greater_Chain_Support', 3).encadearMaisPct, 50);
  assert.deepEqual([ef('Congregation_Support', 3, 20).maxLacaioPct, ef('Congregation_Support', 3, 20).lacaioMovPct], [38, 10]);
  const dv = ef('Devour_Support', 20, 20);
  assert.deepEqual([dv.devorarVida, dv.devorarMana, dv['af:dmg_inc@consumiuCadaverRecente'], dv.danoPct], [366, 40, 80, undefined]);
  const sw = ef('Shockwave_Support', 20, 20, TAGS('Ataque', 'Corpo a Corpo'));
  assert.deepEqual([sw.ondaDoVazio, sw.ondaRecargaMs, sw.ondaUsos, sw.ondaRecargaIncPct, sw.ondaDanoPct, sw.ondaRaioM, sw.ondaIncPct, sw.danoPct, sw.recargaPct], [1, 1000, 4, 38, 336, 2.7, 10, 10, undefined]);
});

test('S1: as cargas do suporte no acerto — Poder no Crítico, Tolerância ao Atordoar só corpo a corpo', { skip: SEM }, async () => {
  const ficha = { carga_poder_ao_critico: 5 };
  assert.equal(Acoes.cargasDoUsoS1(ficha, {}, true), ficha, 'sem o suporte, a mesma regra');
  assert.deepEqual(Acoes.cargasDoUsoS1(ficha, { cargaPoderNoCriticoPct: 64 }, false), { carga_poder_ao_critico: 69 });
  assert.deepEqual(Acoes.cargasDoUsoS1(null, { cargaToleranciaAoAtordoarPct: 100 }, true), { carga_tolerancia_ao_atordoar: 100 });
  assert.equal(Acoes.cargasDoUsoS1(null, { cargaToleranciaAoAtordoarPct: 100 }, false), null, 'a de Tolerância é só do acerto corpo a corpo');
  const e = await montar(['Heavy_Strike']);
  const regras = Acoes.cargasDoUsoS1(Ficha.combate(e).cargas, { cargaPoderNoCriticoPct: 64, cargaToleranciaAoAtordoarPct: 100 }, true);
  assert.ok(CargasPoe.reageAoAcerto(regras));
  const ganhos = CargasPoe.aoAcertar(e, regras, bicho(), { crit: true, corpoACorpo: true, atordoou: true }, () => 0.1);
  assert.deepEqual(ganhos.sort(), ['poder', 'tolerancia']);
  assert.deepEqual(CargasPoe.aoAcertar(e, regras, bicho(), { crit: true }, () => 0.7), [], 'acima dos 64%, sem carga');
});

test('S1: o abate do uso — a Mordida Congelante (Frenesi no Congelado), o Devorar (Vida, Mana, cadáver) e a Aniquilação (a explosão)', { skip: SEM }, async () => {
  const e = await montar(['Heavy_Strike']);
  const agora = e.hunt.clock;
  const morto = (extra = {}) => { const b = bicho({ hp: 0, x: e.hunt.pos.x + 1, y: e.hunt.pos.y, ...extra }); QuemFeriu.carimbar(b, QuemFeriu.VOCE); return b; };
  const congelado = morto({ estados: { congelado: { ate: agora + 1000 } } });
  const solto = morto();
  const antes = CargasPoe.ativas(e).frenesi ?? 0;
  assert.equal(Acoes.abatesDoSuporteS1(e, e.hunt, null, { cargaFrenesiAoMatarCongeladoPct: 69 }, [congelado, solto], [], () => 0.5), 2);
  assert.equal((CargasPoe.ativas(e).frenesi ?? 0) - antes, 1, 'só o Congelado dá a carga');
  assert.equal(Acoes.abatesDoSuporteS1(e, e.hunt, null, { cargaFrenesiAoMatarCongeladoPct: 69 }, [congelado], [], () => 0), 0, 'o mesmo morto não conta duas vezes');
  e.hp = 100; e.mana = 10;
  const comido = morto();
  Acoes.abatesDoSuporteS1(e, e.hunt, null, { devorarVida: 366, devorarMana: 40 }, [comido], [], () => 0.5);
  assert.deepEqual([e.hp, e.mana, comido.poeDevorado], [466, 50, true]);
  assert.equal(e.hunt.poeRecente?.consumiuCadaver, agora, 'o "Consumiu um cadáver Recentemente"');
  // (a Aniquilação: 35% + 5% da qualidade; o morto explode um décimo da Vida máxima dele em quem está colado — o sorteio travado abaixo explode, acima não)
  assert.equal(ef('Annihilation_Support', 3, 20).explodirAoMatarPct, 40);
  const vizinho = bicho({ x: e.hunt.pos.x + 2, y: e.hunt.pos.y, hp: 10_000, maxHp: 10_000 });
  e.hunt.monstros.push(vizinho);
  const grande = morto({ maxHp: 50_000 });
  const eventos = [];
  Acoes.abatesDoSuporteS1(e, e.hunt, null, { explodirAoMatarPct: 40 }, [grande], eventos, () => 0.3);
  assert.ok(vizinho.hp < 10_000, 'a explosão fere o vizinho');
  assert.ok(eventos.some((x) => x.t === 'explosao'));
  const hp = vizinho.hp;
  Acoes.abatesDoSuporteS1(e, e.hunt, null, { explodirAoMatarPct: 40 }, [morto({ maxHp: 50_000 })], [], () => 0.5);
  assert.equal(vizinho.hp, hp, 'acima dos 40%, não explode');
});

test('S1: a Proliferação (Elemental e de Incêndio) espalha as afecções postas a quem está perto; a Dose Letal dobra o Veneno no não envenenado', { skip: SEM }, () => {
  const agora = 10_000;
  const alvo = bicho({ x: 10, y: 10, estados: { congelado: { ate: agora + 900 }, chocado: { ate: agora + 2000, pct: 30 } }, dots: [{ tipo: 'queimadura', falta: 400, ate: agora + 4000, origem: { fonte: 'poe' } }] });
  const colado = bicho({ x: 11, y: 10 });
  const longe = bicho({ x: 14, y: 10 });
  const hunt = huntCom([alvo, colado, longe], { clock: agora });
  const n = Acoes.aposAfeccoesS1(hunt, alvo, ['queimando', 'congelado', 'eletrizado'], { proliferarElementalM: 1.5 }, [], agora);
  assert.equal(n, 3);
  assert.equal(colado.dots.filter((d) => d.tipo === 'queimadura').length, 1, 'o Incêndio espalhado');
  assert.equal(colado.dots[0].falta, 400);
  assert.deepEqual([colado.estados.congelado.ate, colado.estados.chocado.pct], [agora + 900, 30]);
  assert.equal(longe.dots.length, 0, 'a 4 casas (8 m), fora do 1,5 m');
  // (a de Incêndio: só o Incêndio, a 2 m — 1 casa)
  const outro = bicho({ x: 11, y: 11 });
  const h2 = huntCom([alvo, outro], { clock: agora });
  Acoes.aposAfeccoesS1(h2, alvo, ['queimando', 'congelado'], { proliferarIncendioM: 2 }, [], agora);
  assert.deepEqual([outro.dots.length, outro.estados.congelado], [1, undefined]);
  // (a Dose Letal: 2 Venenos a mais só se o alvo não estava envenenado antes do acerto)
  const v = bicho({ dots: [{ tipo: 'venenoPoe', falta: 50, ate: agora + 2000, origem: { fonte: 'poe' } }] });
  Acoes.aposAfeccoesS1(huntCom([v]), v, ['envenenado'], { venenosExtrasNoNaoEnvenenado: 2 }, [], agora, false);
  assert.equal(v.dots.filter((d) => d.tipo === 'venenoPoe').length, 3);
  Acoes.aposAfeccoesS1(huntCom([v]), v, ['envenenado'], { venenosExtrasNoNaoEnvenenado: 2 }, [], agora, true);
  assert.equal(v.dots.filter((d) => d.tipo === 'venenoPoe').length, 3, 'já envenenado: nada a mais');
});

test('S1: o uso — o Sacrificar, o Sacrifício Vaal, o Incêndio Controlado, o Superaquecimento e a Comunhão', { skip: SEM }, async () => {
  const e = await montar(['Fireball']);
  const agora = e.hunt.clock;
  const entry = { id: 'x', poeGema: { slug: 'Fireball' } };
  e.hp = 1000;
  const s = Acoes.doUsoS1(e, entry, { sacrificioVidaPct: 20, sacrificioCaosPct: 54 }, agora);
  assert.deepEqual([e.hp, s['somadoMin:chaos'], s['somadoMax:chaos']], [800, 108, 108], '20% de 1000 = 200; 54% disso = 108 de Caos adicionado');
  e.hp = 1000; e.es = 300;
  Acoes.doUsoS1(e, entry, { sacrificaTudoMenosUm: 1 }, agora);
  assert.deepEqual([e.hp, e.es], [1, 0]);
  // (o Incêndio Controlado: 3 Incêndios nos últimos 4 s — +42% no Incêndio, 9% menos no dano todo; o de 5 s atrás não conta)
  e.hunt.poeIncendiosS1 = { x: [agora - 5000, agora - 3000, agora - 2000, agora - 100] };
  const b = Acoes.doUsoS1(e, entry, { blazeIncendioPorPct: 14, blazeIncendioMax: 364, blazeMenosPorPct: 3, blazeMenosMax: 78, maisIncendioPct: 24 }, agora);
  assert.ok(perto(b.maisIncendioPct, (1.24 * 1.42 - 1) * 100), String(b.maisIncendioPct));
  assert.ok(perto(b.fatorDeDano, 0.91));
  // (a contagem: cada acerto que Incendeia com a habilidade entra)
  Acoes.aposAfeccoesS1(e.hunt, bicho(), ['queimando'], { blazeIncendioPorPct: 14 }, [], agora, true, 'x');
  assert.equal(e.hunt.poeIncendiosS1.x.filter((t) => agora - t <= 4000).length, 4);
  // (o Superaquecimento: 7 de Fortificação → 2 grupos de 3 → +16% no "mais" das afecções; a Fortificação acaba)
  e.hunt.fortificacao = { n: 7, ate: agora + 5000 };
  const o = Acoes.doUsoS1(e, entry, { superaquecerPct: 8, superaquecerPor: 3 }, agora);
  assert.ok(perto(o.maisAfeccaoPct, 16));
  assert.equal(e.hunt.fortificacao.n, 0);
  // (a Comunhão: 20 a 30 de Físico por lacaio permanente — o de duração não conta)
  e.hunt.lacaios = [{ hp: 10 }, { hp: 10 }, { hp: 10, ate: agora + 5000 }, { hp: 0 }];
  const c = Acoes.doUsoS1(e, entry, { comunhaoMin: 20, comunhaoMax: 30 }, agora);
  assert.deepEqual([c['somadoMin:physical'], c['somadoMax:physical']], [40, 60]);
});

test('S1: a Cascata Mágica — as cópias da área encostadas na frente e atrás (a Desperta e a Maior: também dos lados); cada cópia é mais um acerto', { skip: SEM }, () => {
  const casas = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) casas.push({ x: 10 + dx, y: 10 + dy });
  const meio = bicho({ x: 10, y: 10 });
  const frente = bicho({ x: 13, y: 10 });
  const atras = bicho({ x: 7, y: 11 });
  const lado = bicho({ x: 10, y: 13 });
  const golpes = [{ bicho: meio, pct: 100 }];
  const r = Acoes.cascataMagicaS1(casas, { x: 10, y: 10 }, { x: 4, y: 10 }, 1, [meio, frente, atras, lado], golpes, [meio]);
  assert.deepEqual(r.atingidos.map((b) => b.x + ',' + b.y).sort(), ['10,10', '13,10', '7,11']);
  assert.equal(r.casas.length, 27);
  assert.equal(golpes.length, 3);
  const g2 = [];
  const r2 = Acoes.cascataMagicaS1(casas, { x: 10, y: 10 }, { x: 4, y: 10 }, 2, [meio, frente, atras, lado], g2, [meio]);
  assert.equal(r2.casas.length, 45);
  assert.ok(r2.atingidos.includes(lado), 'a de lado');
  // (sem direção — o centro em você —, a do uso)
  const r3 = Acoes.cascataMagicaS1(casas, { x: 10, y: 10, dir: 2 }, { x: 10, y: 10 }, 1, [lado], [], []);
  assert.ok(r3.atingidos.includes(lado));
});

test('S1: de ponta a ponta — o Arquimago (Raio pela Mana não reservada, × a eficácia) e a Vontade de Ferro (a Força no dano mágico) na Bola de Fogo', { skip: SEM }, async () => {
  const e = await montar(['Fireball', 'Archmage_Support']);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Fireball').acao);
  const efeito = GS.efeitoNaSkill(e, entry.id);
  const sem = Acoes.danoMostrado(e, entry, { ...efeito, ...Object.fromEntries(Object.keys(efeito).filter((k) => /manaNaoReservada/.test(k)).map((k) => [k, 0])) });
  const com = Acoes.danoMostrado(e, entry, efeito);
  assert.ok(com.min > sem.min, `com ${com.min} sem ${sem.min}`);
  // (o adicionado é igual no mínimo e no máximo: a diferença entre as faixas é a mesma)
  assert.ok(Math.abs((com.max - sem.max) - (com.min - sem.min)) <= 2, JSON.stringify({ com, sem }));
  const v = await montar(['Fireball', 'Iron_Will_Support']);
  const ev = GS.efeitoNaSkill(v, entry.id);
  const forca = Ficha.combate(v).danoFisicoDaForca ?? 0;
  assert.ok(forca > 0, 'o personagem tem o bônus da Força');
  const semF = Acoes.danoMostrado(v, entry, { ...ev, forcaEmMagias: 0 });
  const comF = Acoes.danoMostrado(v, entry, ev);
  assert.ok(comF.max > semF.max, `com ${comF.max} sem ${semF.max}`);
});

test('S1: a Segunda Ventania dá +1 uso de recarga à não instantânea; o Conjurar ao Canalizar Desperto ignora o atordoamento canalizando', { skip: SEM }, async () => {
  const e = await montar(['Frost_Bomb', 'Second_Wind_Support']);
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Frost_Bomb').acao);
  const efeito = GS.efeitoNaSkill(e, entry.id);
  const com = Acoes.temposDaGemaPoe(e, entry, efeito);
  const sem = Acoes.temposDaGemaPoe(e, entry, { ...efeito, usosExtraNaoInstantanea: 0 });
  assert.equal((com.cargas ?? 1) - (sem.cargas ?? 1), 1, JSON.stringify({ com: com.cargas, sem: sem.cargas }));
  const Controle = await import('../systems/combate/controle.mjs');
  const chefe = { boss: true, raridade: 'unico' };
  const tentar = (hunt) => { for (let i = 0; i < 200; i++) { const r = Controle.tentar(hunt, chefe, { afPoe: {} }, 1000, () => 0); if (r) return r; } return null; };
  const livre = tentar({ clock: 1000 });
  if (livre === 'atordoado') assert.equal(tentar({ clock: 1000, canalizacao: { acao: 'x', ate: 1200, ignoraAtordoamento: true } }), null, 'canalizando com o suporte: sem atordoamento');
});

/** Usa a gema do slot 0 no alvo `b` (com a conjuração concluída); devolve os eventos. */
function usar(e, b) {
  const eventos = [];
  const r = travado(0.5, () => Acoes.disparar(e, e.hunt, { nome: 'T' }, 0, b, { manual: true }));
  assert.ok(r.ok, JSON.stringify(r));
  eventos.push(...(r.eventos ?? []));
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(travado(0.5, () => Acoes.concluirConjuracao(e, e.hunt, { nome: 'T' })) ?? [])); }
  return eventos;
}
const SLUG = 'Cold_Snap';
async function comNova(suportes) {
  const e = await montar([SLUG, ...suportes]);
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
  return { e, b, resto };
}

test('S1: de ponta a ponta — a Cascata Mágica no Estalo Gélido acerta quem está na cópia da área (na linha do uso); a Decadência põe a Podridão no acertado', { skip: SEM }, async () => {
  const s = await comNova([]);
  const area = usar(s.e, s.b).filter((x) => x.t === 'area').flatMap((x) => x.casas ?? []);
  assert.ok(area.length > 0, 'a área do Estalo Gélido');
  // (a área vem relativa a você — [dx, dy]; o centro é o meio dela; o passo das cópias é o lado do quadrado que a contém, 2 × o raio + 1)
  const cx = Math.round(area.reduce((t, q) => t + q[0], 0) / area.length); const cy = Math.round(area.reduce((t, q) => t + q[1], 0) / area.length);
  const passo = 2 * Math.max(...area.map(([dx, dy]) => Math.max(Math.abs(dx - cx), Math.abs(dy - cy)))) + 1;
  const c = await comNova(['Spell_Cascade_Support', 'Decay_Support']);
  const p = c.e.hunt.pos;
  const quatro = c.resto.slice(0, 4);
  assert.equal(quatro.length, 4, 'quatro bichos para as quatro direções');
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, d], i) => Object.assign(quatro[i], { x: p.x + cx + a * passo, y: p.y + cy + d * passo, estados: {}, dots: [] }));
  usar(c.e, c.b);
  const feridos = quatro.filter((m) => m.hp < 1e12);
  assert.equal(feridos.length, 2, `a frente e a de trás (passo ${passo}): ` + JSON.stringify(quatro.map((m) => [m.x - p.x, m.y - p.y, m.hp < 1e12])));
  assert.ok((c.b.dots ?? []).some((d) => d.chave === 'podridao' && d.tipo === 'degenCaos' && d.falta > 0), JSON.stringify(c.b.dots));
});

test('S1: o Toque Maldito — o Golpe Pesado ligado amaldiçoa com a Vulnerabilidade no acerto; a maldição não se conjura à mão', { skip: SEM }, async () => {
  const e = await montar(['Heavy_Strike', 'Hextouch_Support', 'Vulnerability']);
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
  const vuln = G.doSlug('Vulnerability').acao;
  assert.ok(GS.ativadaPor(e, vuln), 'a Vulnerabilidade só sai pelo Toque');
  const lista = Acoes.maldicoesDoToqueS1(e, Acoes.POR_ID_PUBLICO(G.doSlug('Heavy_Strike').acao));
  assert.equal(lista?.length, 1);
  usar(e, b);
  assert.ok(b.maldicoes?.[vuln]?.ate > e.hunt.clock, JSON.stringify(Object.keys(b.maldicoes ?? {})));
});

test('S1: o Chamado Ancestral — o Golpe Duplo acerta mais 2 vivos ao alcance do golpe (antes o alvo extra do corpo a corpo não tinha quem o lesse); o longe fica de fora', { skip: SEM }, async () => {
  assert.equal(ef('Ancestral_Call_Support', 20, 20, TAGS('Ataque', 'Corpo a Corpo')).alcanceAlvosExtrasPct, 15);
  assert.equal(ef('Greater_Ancestral_Call_Support', 3, 20, TAGS('Ataque', 'Corpo a Corpo')).alcanceAlvosExtrasPct, 40);
  const ferir = async (sup) => {
    const e = await montar(['Dual_Strike', ...sup]);
    e.mana = e.maxMana = 1e7; e.maxHp = e.hp = 1e7;
    const [b, ...resto] = e.hunt.monstros;
    for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12 });
    Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12 });
    const [m1, m2, m3] = resto;
    Object.assign(m1, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y + 1 });
    Object.assign(m2, { x: e.hunt.pos.x, y: e.hunt.pos.y + 1 });
    Object.assign(m3, { x: e.hunt.pos.x + 3, y: e.hunt.pos.y });
    usar(e, b);
    return [m1, m2, m3].map((m) => m.hp < 1e12);
  };
  assert.deepEqual(await ferir([]), [false, false, false]);
  assert.deepEqual(await ferir(['Ancestral_Call_Support']), [true, true, false]);
});

test('S1 (dono, 26/10): um Impelir por Clamor — dois Clamores impelem o mesmo ataque, cada um gasta a sua carga; o Esforço Excessivo dá 10% por Clamor', { skip: SEM }, async () => {
  const GAC = await import('../systems/itens-poe/gemas-gac.mjs');
  const h = { };
  GAC.porImpelir(h, { n: 6, ate: 5000, de: 'Seismic_Cry', so: 'pancada' }, 0);
  GAC.porImpelir(h, { n: 3, ate: 5000, de: 'Intimidating_Cry' }, 0);
  assert.deepEqual([h.impelidos.de, h.impelidos.n, h.impelidos.outros.map((x) => x.de)], ['Intimidating_Cry', 3, ['Seismic_Cry']], 'o novo é o principal; o anterior fica junto');
  GAC.porImpelir(h, { n: 2, ate: 6000, de: 'Intimidating_Cry' }, 0);
  assert.deepEqual([h.impelidos.n, h.impelidos.ate, h.impelidos.outros.length], [3, 6000, 1], 'o mesmo Clamor renova pelo máximo');
  assert.equal(GAC.impelemEste(h.impelidos, ['ataque', 'corpo', 'pancada', 'habilidade'], 0).length, 2);
  assert.equal(GAC.impelemEste(h.impelidos, ['ataque', 'corpo', 'golpe', 'habilidade'], 0).length, 1, 'o Sísmico só impele as Pancadas');
  // (de ponta a ponta: o Golpe Sísmico — uma Pancada — com o Esforço Excessivo, impelido pelos dois)
  const e = await montar(['Ground_Slam', 'Overexertion_Support']);
  e.mana = e.maxMana = 1e7; e.maxHp = e.hp = 1e7;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12 });
  const agora = e.hunt.clock;
  e.hunt.impelidos = { n: 3, ate: agora + 20_000, de: 'Intimidating_Cry', outros: [{ n: 6, ate: agora + 20_000, de: 'Seismic_Cry', so: 'pancada' }] };
  const entry = Acoes.POR_ID_PUBLICO(G.doSlug('Ground_Slam').acao);
  const comClamores = Acoes.comOsAlvosDaGema(entry, GS.efeitoNaSkill(e, entry.id), e);
  assert.equal(comClamores['af:mais_dano@impelido'], 14 + 10 * 2, 'os 14% do Impelido + 10% por cada um dos 2 Clamores');
  usar(e, b);
  assert.deepEqual([e.hunt.impelidos.n, e.hunt.impelidos.outros[0].n], [2, 5], 'cada Clamor gastou uma carga');
});
