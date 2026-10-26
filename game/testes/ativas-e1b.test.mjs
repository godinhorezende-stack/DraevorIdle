// (lote E1b, 26/10) AS PARCIAIS MAIS FÁCEIS de Armadilhas, Minas, Auras e Arautos (e as que restavam em outros arquétipos), pelo PoE 1 (o PoB): a Armadilha ativada
// uma vez adicional (a qualidade e a Flamejante da Explosão), o arremesso (a Explosiva da Magnitude, a Hélice de Trarthus), o Fogo contra o Queimando, a conversão
// aleatória da Devastação da Refração, o ricochete no terreno, o Físico como Gelo Extra da Pancada Glacial, o Empalamento dos Espetos, a aura das Minas (a
// Tormenta Explosiva, a Congelante da Sabotagem, a Exposição da Piroclástica), as auras (a Disciplina, a Graça Vaal, a Clareza Vaal, a Disciplina Vaal, a Pureza
// Elementar, o Fanatismo, os Estandartes), as Impurezas Vaal (o efeito da aura e a resistência ignorada), as Armadilhas Drenantes (os feixes) e o Clamor do Mago de
// Batalha (as magias suportadas nos ataques Impelidos). Os sorteios ficam travados.
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
const E1b = await import('../systems/itens-poe/gemas-e1b.mjs');
const L = await import('../systems/itens-poe/linhas-das-gemas.mjs');
const Res = await import('../systems/hunt/resistencia.mjs');
const Defesa = await import('../systems/personagem/defesa.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com as gemas LIGADAS na arma (um grupo só), numa caçada; o alvo imortal a (dx, 0) e os outros longe. */
async function montar(slugs, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand', dx = 1 } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const lista = [slugs].flat();
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: lista.length, links: lista.slice(1).map(() => true), gemas: lista.map(() => null), cores: lista.map(() => 'W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  const itemDe = (s) => G.doSlug(s)?.itemId ?? [...GS.DEFS.values()].find((d) => d.poe?.slug === s)?.itemId;
  e.inventory = lista.map((s) => GS.itemDaGema({ id: itemDe(s), nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < lista.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  lista.forEach((s, i) => { if (G.doSlug(s)) e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }; });
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 10_000;
  e.maxHp = e.hp = 100_000;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });
  return { e, b, resto };
}
function usar(e, b, slot = 0, v = 0.5) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, slot, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; return { ...x, eventos: [...(x.eventos ?? []), ...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])] }; }
    return x;
  });
}
const golpesEm = (ev, m) => (ev ?? []).filter((x) => x.t === 'dmg' && x.foe !== false && x.uid === m.uid && !x.dot).map((x) => x.v);
const soma = (l) => l.reduce((t, x) => t + x, 0);

const FEITAS = ['Defiance_Banner', 'Herald_of_Ash', 'Dread_Banner', 'Vaal_Impurity_of_Fire', 'Vaal_Impurity_of_Ice', 'Vaal_Impurity_of_Lightning', 'Ice_Crash', 'Ice_Crash_of_Cadence',
  'Explosive_Trap_of_Magnitude', 'Fire_Trap', 'Fire_Trap_of_Blasting', 'Reave_of_Refraction', 'Spectral_Helix_of_Trarthus', 'Vaal_Grace', 'Ice_Trap_of_Hollowness', 'Stormblast_Mine',
  'Vaal_Clarity', 'Icicle_Mine_of_Sabotage', 'Lightning_Trap', 'Lightning_Trap_of_Sparking', 'Herald_of_Thunder', 'Discipline', 'Purity_of_Elements', 'Vaal_Discipline', 'Zealotry',
  'Lightning_Spire_Trap_of_Zapping', 'Pyroclast_Mine', 'Pyroclast_Mine_of_Sabotage', 'Siphoning_Trap_of_Pain', 'Battlemages_Cry'];

test('E1b: as 30 gemas do lote ficam completas (funciona, sem motivo)', { skip: SEM }, () => {
  for (const s of FEITAS) assert.deepEqual([G.doSlug(s)?.statusNoJogo, G.doSlug(s)?.motivosNoJogo], ['funciona', []], s);
});

test('E1b: a Armadilha ativada uma vez adicional — a qualidade (15%) e a Flamejante da Explosão (50%), somadas à das peças', { skip: SEM }, () => {
  assert.equal(G.chanceDeAtivarDeNovoDaGema('Fire_Trap_of_Blasting', 20, 0), 50);
  for (const s of ['Ice_Trap', 'Ice_Trap_of_Hollowness', 'Lightning_Trap', 'Lightning_Trap_of_Sparking', 'Lightning_Spire_Trap_of_Zapping']) {
    assert.equal(G.chanceDeAtivarDeNovoDaGema(s, 20, 20), 15, s);
    assert.equal(G.chanceDeAtivarDeNovoDaGema(s, 20, 0), 0, s);
  }
  assert.equal(E1b.ativaDeNovo(10, 15, () => 0.24), true, '10 + 15 = 25%: o sorteio de 24 ativa');
  assert.equal(E1b.ativaDeNovo(10, 15, () => 0.25), false, 'o de 25 não');
});

test('E1b: o arremesso — a Explosiva da Magnitude (30% menos) e a Hélice de Trarthus (25% menos com duas mãos; +1 Armadilha com duas armas)', { skip: SEM }, () => {
  assert.deepEqual(G.arremessoDaGema('Explosive_Trap_of_Magnitude', 20, new Set()), { maisPct: -30, extras: 0 });
  assert.deepEqual(G.arremessoDaGema('Spectral_Helix_of_Trarthus', 20, new Set(['duasMaos'])), { maisPct: -25, extras: 0 });
  assert.deepEqual(G.arremessoDaGema('Spectral_Helix_of_Trarthus', 20, new Set(['umaMao', 'duasArmas'])), { maisPct: -0, extras: 1 });
});

test('E1b: o tempo do arremesso da Explosiva da Magnitude é 1/0,7 do da Explosiva', { skip: SEM }, async () => {
  const a = await montar('Explosive_Trap');
  const b = await montar('Explosive_Trap_of_Magnitude');
  const ea = Acoes.POR_ID_PUBLICO(G.doSlug('Explosive_Trap').acao);
  const eb = Acoes.POR_ID_PUBLICO(G.doSlug('Explosive_Trap_of_Magnitude').acao);
  const ta = Acoes.temposDaGemaPoe(a.e, ea, GS.efeitoNaSkill(a.e, ea.id));
  const tb = Acoes.temposDaGemaPoe(b.e, eb, GS.efeitoNaSkill(b.e, eb.id));
  assert.ok(Math.abs(tb.conjuracaoMs / ta.conjuracaoMs - 1 / 0.7) < 0.02, `${tb.conjuracaoMs} / ${ta.conjuracaoMs}`);
});

test('E1b: a Armadilha Flamejante — o Fogo adicionado contra o Queimando entra no acerto de quem está Queimando', { skip: SEM }, async () => {
  assert.deepEqual(G.fogoContraQueimandoDaGema('Fire_Trap', 20), [286, 429]);
  assert.deepEqual(G.fogoContraQueimandoDaGema('Fire_Trap_of_Blasting', 20), [881, 1316]);
  assert.equal(E1b.queimando({ dots: [{ tipo: 'degenFogo', falta: 1000 }] }), true);
  assert.equal(E1b.queimando({ dots: [{ tipo: 'queimadura', falta: 0 }] }), false);
  const frio = await montar('Fire_Trap');
  const d0 = soma(golpesEm(usar(frio.e, frio.b).eventos, frio.b));
  const quente = await montar('Fire_Trap');
  quente.b.dots = [{ tipo: 'queimadura', falta: 60_000, total: 1, porSegundo: 0 }];
  const d1 = soma(golpesEm(usar(quente.e, quente.b).eventos, quente.b));
  assert.ok(d0 > 0 && d1 > d0, `${d0} → ${d1}`);
});

test('E1b: a Devastação da Refração converte 100% do Físico para UM elemento sorteado', { skip: SEM }, () => {
  assert.deepEqual(G.conversaoAleatoriaDaGema('Reave_of_Refraction', 20), [{ para: 'aleatorio', pct: 100 }]);
  for (const [v, el] of [[0, 'fire'], [0.5, 'ice'], [0.9, 'energy']]) {
    const p = G.partesDoAtaque('Reave_of_Refraction', 20, { min: 100, max: 100 }, {}, () => v);
    assert.deepEqual(Object.keys(p), [el], String(v));
  }
  assert.deepEqual(G.conversaoAleatoriaDaGema('Reave', 20), []);
});

test('E1b: a Relampejante das Fagulhas ricocheteia no terreno (100%) e a Pancada Glacial ganha o Físico como Gelo Extra da qualidade', { skip: SEM }, () => {
  assert.equal(G.ricocheteNoTerrenoDaGema('Lightning_Trap_of_Sparking', 20), 100);
  assert.equal(G.ricocheteNoTerrenoDaGema('Lightning_Trap', 20), 0);
  assert.equal(G.linhasLocaisNoNivel('Ice_Crash', 20, 20).af.phys_as_extra_ice, 15);
  assert.equal(G.linhasLocaisNoNivel('Ice_Crash_of_Cadence', 20, 20).af.phys_as_extra_ice, 20);
  assert.equal(G.linhasLocaisNoNivel('Bear_Trap_of_Skewers', 20, 0).af.chance_empalar, 100);
});

test('E1b: as auras — os atributos do buff (a Disciplina, a Graça Vaal, a Clareza Vaal, a Disciplina Vaal, a Pureza Elementar, o Fanatismo, os Estandartes)', { skip: SEM }, () => {
  assert.deepEqual(L.atributosDoBuff('Você e Aliados próximos ganham 30 % de Velocidade de Recarga de Escudo de Energia aumentada'), { es_recharge: 30 });
  assert.deepEqual(L.atributosDoBuff('Você e aliados próximos têm +15 % de chance de Evadirem Acertos de Ataques'), { chance_evadir: 15 });
  assert.deepEqual(L.atributosDoBuff('Dano Mágico Suprimido causado em você é Azarado'), { suprimido_azarado: 1 });
  assert.deepEqual(L.atributosDoBuff('Suas Habilidades e de seus aliados próximos não Custam Mana'), { custo_mana_inc: -100 });
  assert.deepEqual(L.atributosDoBuff('A Recarga do seu Escudo de Energia e dos seus aliados próximos não é impedida por Dano'), { recarga_es_nunca_interrompida: 1 });
  assert.deepEqual(L.atributosDoBuff('Você e Aliados não-Lacaios Próximos têm 10 % de chance de criarem Solo Sagrado ao Acertar um Inimigo Raro ou Único, durando 8 segundos'), { 'ev:acertar:soloSagrado:8@alvoRaro': 10, 'ev:acertar:soloSagrado:8@alvoUnico': 10 });
  assert.deepEqual(L.atributosDoBuff('Estandarte faz com que você e Aliados Recuperem 34 de Vida ao Bloquear'), { 'ev:bloquear:vida': 34 });
  assert.deepEqual(L.atributosDoBuff('Estandarte concede -12 de Dano sofrido de cada Tipo de Dano dos Acertos Suprimidos a Você e Aliados'), { suprimido_fixo: -12 });
  const pe = G.buffNoNivel('Purity_of_Elements', 20, 0);
  for (const k of ['imune_incendio', 'imune_resfriamento', 'imune_congelamento', 'imune_eletrizacao']) assert.equal(pe.af[k], 1, k);
  assert.deepEqual(pe.motivos, []);
  assert.equal(G.buffNoNivel('Discipline', 20, 0).af.es_recharge, 30);
  assert.equal(G.buffNoNivel('Vaal_Grace', 20, 0).af.chance_evadir, 15);
  assert.equal(G.buffNoNivel('Vaal_Clarity', 20, 0).af.custo_mana_inc, -100);
});

test('E1b: as Impurezas Vaal — o efeito da aura da gema e a resistência POSITIVA ignorada pelos acertos no raio', { skip: SEM }, () => {
  assert.deepEqual(G.buffNoNivel('Vaal_Impurity_of_Fire', 20, 0).e1b, { ignoraRes: 'fire', efeitoAuraPct: 76 });
  assert.equal(G.buffNoNivel('Vaal_Impurity_of_Ice', 20, 0).e1b.ignoraRes, 'ice');
  assert.equal(G.buffNoNivel('Vaal_Impurity_of_Lightning', 20, 0).e1b.ignoraRes, 'energy');
  const hunt = { clock: 1000, pos: { x: 10, y: 10 }, z: 0, buffs: { imp: { ate: 5000, raio: 3, e1b: { ignoraRes: 'fire' } } } };
  const perto = { x: 12, y: 10, resist: { fire: 40, ice: 40 } };
  const longe = { x: 20, y: 10, resist: { fire: 40 } };
  const fraco = { x: 11, y: 10, resist: { fire: -20 } };
  const ficha = { afPoe: {} };
  assert.equal(Res.resistenciaEfetivaDe(hunt, perto, 'fire', ficha), 0, 'no raio, o acerto ignora');
  assert.equal(Res.resistenciaEfetivaDe(hunt, perto, 'ice', ficha), 40, 'só o elemento da Impureza');
  assert.equal(Res.resistenciaEfetivaDe(hunt, longe, 'fire', ficha), 40, 'fora do raio, não');
  assert.equal(Res.resistenciaEfetivaDe(hunt, perto, 'fire'), 40, 'sem a ficha (o dano degenerativo), não');
  assert.equal(Res.resistenciaEfetivaDe(hunt, fraco, 'fire', ficha), -20, 'a negativa fica');
  hunt.clock = 6000;
  assert.equal(Res.resistenciaEfetivaDe(hunt, perto, 'fire', ficha), 40, 'o buff vencido não vale');
});

test('E1b: a Disciplina Vaal — o dano não reinicia a espera da recarga do Escudo de Energia', { skip: SEM }, () => {
  const com = { es: 500, hunt: { clock: 0 } };
  Defesa.absorver(com, { energyShield: 500, afPoe: { recarga_es_nunca_interrompida: 1 } }, 100);
  assert.equal(com.esEspera, undefined);
  assert.equal(com.es, 400);
  const sem = { es: 500, hunt: { clock: 0 } };
  Defesa.absorver(sem, { energyShield: 500, afPoe: {} }, 100);
  assert.ok(sem.esEspera > 0);
  const caos = { es: 500 };
  Defesa.reiniciarEspera(caos, { afPoe: { recarga_es_nunca_interrompida: 1 } });
  assert.equal(caos.esEspera, undefined);
});

test('E1b: as Minas — a qualidade da Tormenta Explosiva, o efeito da aura da Congelante da Sabotagem e a Exposição ao Fogo da Piroclástica', { skip: SEM }, async () => {
  assert.deepEqual(G.auraDaMinaE1bDaGema('Stormblast_Mine', 20, 20), { danoPorMinaExtra: 1 });
  assert.deepEqual(G.auraDaMinaE1bDaGema('Icicle_Mine_of_Sabotage', 20, 20), { efeitoAuraPct: 20 });
  assert.deepEqual(G.auraDaMinaE1bDaGema('Pyroclast_Mine', 20, 0), { exposicaoFogoPct: 15 });
  assert.deepEqual(G.auraDaMinaE1bDaGema('Pyroclast_Mine_of_Sabotage', 20, 0), { exposicaoFogoPct: 25 });
  // a Exposição nos inimigos perto da Mina plantada (você andando: a Mina não detona)
  const { e, b } = await montar('Pyroclast_Mine', { dx: 2 });
  e.hunt.poeRecente = { ...(e.hunt.poeRecente ?? {}), moveu: e.hunt.clock };
  const ficha = Ficha.combate(e);
  Plantadas.plantar(e.hunt, ficha, { tipo: 'mina', acao: G.doSlug('Pyroclast_Mine').acao, slot: 0, x: b.x, y: b.y, duracaoMs: 5000, agora: e.hunt.clock });
  travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock));
  assert.equal(b.estados.exposicaoPct?.fire, 15);
  assert.ok(b.estados.exposicao.fire > e.hunt.clock);
});

test('E1b: as Armadilhas Drenantes — os feixes vão aos N inimigos mais perto (18 na da Dor, 10 + 4 da qualidade na base)', { skip: SEM }, () => {
  assert.equal(G.feixesDaDrenanteDaGema('Siphoning_Trap_of_Pain', 20, 0), 18);
  assert.equal(G.feixesDaDrenanteDaGema('Siphoning_Trap', 20, 20), 14);
  assert.equal(G.feixesDaDrenanteDaGema('Fireball', 20, 0), null);
});

test('E1b: o Clamor do Mago de Batalha — as magias ligadas saem nos ataques Impelidos por ele, com o "menos Dano" do nível', { skip: SEM }, async () => {
  assert.deepEqual(G.magoDeBatalhaDaGema('Battlemages_Cry', 20), { menosPct: 38 });
  const { e, b } = await montar(['Battlemages_Cry', 'Fireball', 'Power_Siphon'], { dx: 2 });
  const grupo = GS.gruposComGatilho(e).find((g) => g.magoDeBatalha);
  assert.ok(grupo, 'o grupo do Mago de Batalha');
  assert.deepEqual(grupo.magias, [G.doSlug('Fireball').acao], 'só a magia (o ataque não)');
  // sem Impelir: o ataque não ativa nada
  const sem = usar(e, b, 2);
  assert.ok(sem.ok);
  assert.equal((sem.eventos ?? []).filter((x) => x.t === 'gatilho').length, 0);
  e.hunt.cooldowns = {};
  delete e.hunt.conjurando;
  e.hunt.clock += 5000;
  e.hunt.impelidos = { n: 5, ate: e.hunt.clock + 20000, de: 'Battlemages_Cry' };
  const com = usar(e, b, 2);
  assert.ok(com.ok);
  const gat = (com.eventos ?? []).filter((x) => x.t === 'gatilho');
  assert.equal(gat.length, 1, 'a Bola de Fogo ativada');
  assert.equal(e.hunt.impelidos.n, 4, 'o Impelir gasto');
});

// ---------------------------------------------------------------- as decisões do dono (26/10)

test('E1b (dono 26/10): as gemas que saem de parcial pelas decisões', { skip: SEM }, () => {
  for (const s of ['Bear_Trap_of_Skewers', 'Flamethrower_Trap', 'Flamethrower_Trap_of_Stability', 'Ice_Trap', 'Seismic_Trap_of_Swells', 'Dark_Bargain', 'Rallying_Cry']) assert.deepEqual([G.doSlug(s)?.statusNoJogo, G.doSlug(s)?.motivosNoJogo], ['funciona', []], s);
  // o Arauto Agonizante: a Virulência no máximo vira nota (o Rastejador segue como motivo)
  const ag = G.doSlug('Herald_of_Agony');
  assert.ok(ag.notas?.some((n) => /Virulência fica no máximo/.test(n)));
  assert.ok(!ag.motivosNoJogo.some((m) => /Virulência/.test(m)));
});

test('E1b (dono 26/10): as Armadilhas de Urso Imobilizam por 3 s × a Duração', { skip: SEM }, async () => {
  assert.deepEqual(G.travaDaGema('Bear_Trap', 20, 0), { ms: 3000 });
  assert.deepEqual(G.travaDaGema('Bear_Trap_of_Skewers', 20, 0), { ms: 3000 });
  assert.equal(G.travaDaGema('Fire_Trap', 20, 0), null);
  const { e, b } = await montar('Bear_Trap_of_Skewers');
  usar(e, b);
  assert.ok(E1b.imobilizado(b, e.hunt.clock), 'Imobilizado');
  assert.ok(Math.abs(b.estados.imobilizado.ate - e.hunt.clock - 3000) <= 1000, String(b.estados.imobilizado.ate - e.hunt.clock));
  assert.equal(E1b.imobilizado(b, b.estados.imobilizado.ate), false, 'acaba');
});

test('E1b (dono 26/10): a Lança-Chamas pulsa a cada 0,1 s pela duração (3,5 s; a da Estabilidade, 2 s)', { skip: SEM }, async () => {
  assert.deepEqual(G.chamasDaGema('Flamethrower_Trap', 20, 0), { intervaloMs: 100, duracaoMs: 3500, areas: 1, chamas: 4 });
  const est = G.chamasDaGema('Flamethrower_Trap_of_Stability', 20, 20);
  assert.equal(est.duracaoMs, 2000);
  assert.equal(est.chamas, 6);
  const { e, b } = await montar('Flamethrower_Trap');
  const ev = usar(e, b).eventos;
  const torre = e.hunt.poeTorres?.[0];
  assert.ok(torre, 'o objeto das chamas');
  assert.equal(torre.intervaloMs, 100);
  assert.ok(soma(golpesEm(ev, b)) > 0, 'o primeiro pulso fere');
});

test('E1b (dono 26/10): a Sísmica dos Poços — 3 ondas (+1 na qualidade 20), cada uma com a chance de sobreposição do PoB (121/324)', { skip: SEM }, async () => {
  assert.deepEqual(G.ondasDaGema('Seismic_Trap_of_Swells', 20, 0), { n: 3, chance: 121 / 324 });
  assert.equal(G.ondasDaGema('Seismic_Trap_of_Swells', 20, 20).n, 4);
  assert.ok(Math.abs(E1b.chanceDaOnda() - 0.37346) < 1e-4);
  // o sorteio 0,3 (< 37,3%): as 3 ondas acertam; o 0,5: nenhuma
  const a = await montar('Seismic_Trap_of_Swells');
  const acertos = golpesEm(usar(a.e, a.b, 0, 0.3).eventos, a.b);
  assert.equal(acertos.length, 3, String(acertos));
  const n = await montar('Seismic_Trap_of_Swells');
  assert.equal(golpesEm(usar(n.e, n.b, 0, 0.5).eventos, n.b).length, 0);
});

test('E1b (dono 26/10): a Barganha Sombria com Esqueleto — sacrifica 12% da Vida máxima dele (sem matar) e fere em volta dele', { skip: SEM }, async () => {
  const { e, b } = await montar('Dark_Bargain', { dx: 3 });
  const esq = { uid: 'esq1', nome: 'Esqueleto', tipo: 'lacaio', hp: 1000, maxHp: 1000, x: b.x - 1, y: b.y, z: e.hunt.z ?? 0 };
  e.hunt.lacaios = [esq];
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.equal(esq.hp, 880, 'o sacrifício: 12% de 1000');
  assert.ok(soma(golpesEm(r.eventos, b)) > 0, 'o inimigo perto do Esqueleto leva');
  // o sacrifício não mata
  esq.hp = 50;
  e.hunt.cooldowns = {};
  delete e.hunt.conjurando;
  e.hunt.clock += 5000;
  usar(e, b);
  assert.equal(esq.hp, 1);
});

test('E1b (dono 26/10): o Clamor de Reunião — o buff nos seus lacaios no raio com 100% mais efeito', { skip: SEM }, () => {
  const hunt = { clock: 1000, pos: { x: 0, y: 0 }, z: 0, poeReuniao: { ate: 5000, raio: 3, z: 0, af: { phys_add_min: 10, phys_add_max: 20, added_fire_dmg_min: 5, added_fire_dmg_max: 6 }, lacaiosMaisPct: 100 } };
  assert.deepEqual(E1b.reuniaoNoLacaio(hunt, { x: 2, y: 0 }), [{ el: 'physical', min: 20, max: 40 }, { el: 'fire', min: 10, max: 12 }]);
  assert.deepEqual(E1b.reuniaoNoLacaio(hunt, { x: 5, y: 0 }), [], 'fora do raio');
  hunt.clock = 6000;
  assert.deepEqual(E1b.reuniaoNoLacaio(hunt, { x: 2, y: 0 }), [], 'o buff vencido');
});
