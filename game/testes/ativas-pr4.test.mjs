// (lote PR4, dono 25/10) AS GEMAS ATIVAS QUE GRUDAM OU PULSAM NO ALVO E OS FEIXES PERIÓDICOS (o plano do grupo projétil-ricochete, as recomendações aceitas): a
// explosão da Flecha Explosiva (as flechas grudadas, o pavio de 1 s, o máximo, o raio e os "mais" por flecha), as flechas grudadas da Eletrocussão, a energia
// estática do Golpe Estático (os feixes periódicos nos N mais perto, o "menos Dano", a frequência), os Relâmpagos Concentrados, os tentáculos do Ensanguentar, a
// Concha Somática (absorve, explode, a imunidade de 200 ms, passa) e a Flecha Aprisionadora (as cordas, o "menos" multiplicativo, o dano sofrido, a quebra a 2
// casas). Os números são os do PoE (o PoB, o poedb); os sorteios ficam travados.
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
const PR4 = await import('../systems/itens-poe/gemas-pr4.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const QUEM = PERSONAGEM.nome;

/** Roda `fn` com o `Math.random` travado em `v`. */
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com a gema na arma, numa caçada; o alvo imortal a `dx` casas e os outros longe. */
async function montar(slug, { nivel = 20, qualidade = 0, arma = 'Bows/Crude_Bow', dx = 1 } = {}) {
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
  // (o alvo de treino não esquiva — os acertos dos ataques não erram; sem armadura: as razões são as do dano antes da redução)
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, armaduraPct: -100, evasao: 0 });
  return { e, b, resto, entry: Acoes.POR_ID_PUBLICO(G.doSlug(slug).acao) };
}
/** Usa a gema no alvo (com a conjuração concluída), com o sorteio travado. */
function usar(e, b, v = 0.5) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; return { ...x, eventos: Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) }; }
    return x;
  });
}
/** Libera a barra para o próximo uso (a recarga do grupo e a da gema). */
const liberar = (e) => { e.hunt.cooldowns = {}; delete e.hunt.conjurando; e.hunt.clock += 1; };
/** O tique do lote PR4 no instante `t`, com o sorteio travado. */
const tique = (e, t, v = 0.5) => travado(v, () => { e.hunt.clock = t; return Acoes.tiqueDasGemasPR4(e, e.hunt, PERSONAGEM, [], t); });
/** Um outro monstro imortal em `(dx, dy)` de você. */
const outro = (e, m, dx, dy) => Object.assign(m, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, armaduraPct: -100, evasao: 0 });
/** Os valores dos golpes (`dmg`) em `m`, na ordem. */
const golpesEm = (eventos, m) => (eventos ?? []).filter((v) => v.t === 'dmg' && v.uid === m.uid).map((v) => v.v);

// ---------------------------------------------------------------- o status e as linhas

test('PR4: as gemas do lote saem de parcial (as linhas do PoE têm leitor)', { skip: SEM }, () => {
  for (const s of ['Explosive_Arrow', 'Lightning_Arrow_of_Electrocution', 'Static_Strike', 'Static_Strike_of_Gathering_Lightning', 'Exsanguinate', 'Somatic_Shell', 'Ensnaring_Arrow']) {
    const r = G.REGISTRO.get(s);
    assert.deepEqual([s, r.statusNoJogo, r.motivosNoJogo], [s, 'funciona', []]);
  }
});

test('PR4: os números das linhas no nível 20 (e a qualidade), como o PoB e o poedb', { skip: SEM }, () => {
  assert.deepEqual(G.flechaExplosivaDaGema('Explosive_Arrow', 20), { basePct: 50, fogo: [522, 783], raioPorFlechaM: 0.2, raioMaxM: 1.2, acertoPorFlechaPct: 6, afeccaoPorFlechaPct: 3, maximo: 20 });
  assert.equal(G.flechaExplosivaDaGema('Explosive_Arrow', 20, 20).maximo, 22);
  assert.equal(G.flechaExplosivaDaGema('Explosive_Arrow', 1).fogo[0], 47);
  assert.deepEqual(G.eletrocussaoDaGema('Lightning_Arrow_of_Electrocution', 20), { vezes: 4, intervaloMs: 500, maximo: 10 });
  assert.equal(G.eletrocussaoDaGema('Lightning_Arrow_of_Electrocution', 20, 20).vezes, 5);
  assert.equal(G.eletrocussaoDaGema('Lightning_Arrow', 20), null);
  assert.deepEqual(G.estaticoDaGema('Static_Strike', 20), { intervaloMs: 320, menosPct: 30, freqIncPct: 0, alvos: 6 });
  assert.deepEqual(G.estaticoDaGema('Static_Strike', 1), { intervaloMs: 400, menosPct: 30, freqIncPct: 0, alvos: 4 });
  assert.equal(G.estaticoDaGema('Static_Strike', 20, 20).freqIncPct, 20);
  assert.equal(G.estaticoDaGema('Static_Strike_of_Gathering_Lightning', 20), null);
  // (o hitTimeOverride do PoB: 0,32 s ÷ 1,2)
  assert.ok(perto(PR4.intervaloDoEstatico(G.estaticoDaGema('Static_Strike', 20, 20)), 320 / 1.2));
  assert.deepEqual(G.concentradosDaGema('Static_Strike_of_Gathering_Lightning', 20), { ganha: 1, maximo: 10, maisPct: 8 });
  assert.equal(G.concentradosDaGema('Static_Strike_of_Gathering_Lightning', 20, 20).maximo, 12);
  assert.equal(G.tentaculosDaGema('Exsanguinate', 20), 9);
  assert.equal(G.tentaculosDaGema('Exsanguinate', 1), 7);
  assert.equal(G.tentaculosDaGema('Exsanguinate_of_Transmission', 20), 0);
  assert.deepEqual(G.conchaDaGema('Somatic_Shell', 20), { absorve: 6214, maximo: 6, duracaoS: 5, raioM: 1.8, maisAreaPct: 750, imunidadeMs: 200, passa: 1, absorvePct: 100 });
  assert.equal(G.conchaDaGema('Somatic_Shell', 1).absorve, 168);
  assert.ok(perto(G.conchaDaGema('Somatic_Shell', 20, 20).raioM, 2.1));
  assert.deepEqual(G.aprisionadoraDaGema('Ensnaring_Arrow', 20), { danoSofridoPct: 20, menosPct: { normal: 40, raro: 30, unico: 25 }, maximo: 3, efeitoPct: 0 });
  assert.equal(G.aprisionadoraDaGema('Ensnaring_Arrow', 20, 20).efeitoPct, 20);
  assert.equal(G.aprisionadoraDaGema('Ensnaring_Arrow', 1).danoSofridoPct, 15);
});

// ---------------------------------------------------------------- as contas puras

test('PR4: a explosão da Flecha Explosiva — o raio por flecha até +1,2 m e os "mais" (100% por flecha depois da primeira, 6%/3% por flecha)', () => {
  const d = { basePct: 50, fogo: [522, 783], raioPorFlechaM: 0.2, raioMaxM: 1.2, acertoPorFlechaPct: 6, afeccaoPorFlechaPct: 3, maximo: 20 };
  assert.ok(perto(PR4.raioDaExplosaoM(d, 1), 1.7));
  assert.ok(perto(PR4.raioDaExplosaoM(d, 6), 2.7));
  assert.ok(perto(PR4.raioDaExplosaoM(d, 20), 2.7));
  assert.deepEqual(PR4.maisDaExplosao(d, 1), { todosPct: 0, acertoPct: 6, afeccaoPct: 3 });
  assert.deepEqual(PR4.maisDaExplosao(d, 5), { todosPct: 400, acertoPct: 30, afeccaoPct: 15 });
  // no efeito do golpe: a base × 50%, o Fogo adicional, o acerto × 5 × 1,30 e a afecção × 1,15 (o do acerto sai dela pelo `maisDanoAcertoPct`)
  const e = PR4.efeitoDoGolpePR4({ fatorDeDano: 1 }, { tipo: 'explosao', n: 5, d });
  assert.equal(e.basePctDoAtaque, 50);
  assert.deepEqual([e['somadoMin:fire'], e['somadoMax:fire']], [522, 783]);
  assert.ok(perto(e.fatorDeDano, 5 * 1.3));
  assert.ok(perto(e.maisDanoAcertoPct, 30));
  assert.ok(perto(e.maisAfeccaoPct, 15));
  // o feixe: 30% menos; a concha: 750% mais
  assert.ok(perto(PR4.efeitoDoGolpePR4({}, { tipo: 'feixe', menosPct: 30 }).fatorDeDano, 0.7));
  assert.ok(perto(PR4.efeitoDoGolpePR4({ fatorDeDano: 2 }, { tipo: 'concha', maisAreaPct: 750 }).fatorDeDano, 17));
  // os Relâmpagos Concentrados: 8% × 3 = 24% mais com Acertos e Afecções
  const c = PR4.comOsConcentrados({ fatorDeDano: 1 }, 8, 3);
  assert.ok(perto(c.fatorDeDano, 1.24));
  assert.ok(perto(c.maisDanoAcertoPct, 24));
  assert.ok(perto(c.maisAfeccaoPct, 24));
  assert.equal(PR4.comOsConcentrados({ fatorDeDano: 1 }, 8, 0).fatorDeDano, 1);
});

test('PR4: o alvo final de cada flecha (a perfuração e o ricochete continuam a sequência) e o primeiro acertado de cada projétil', () => {
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((uid) => ({ uid, hp: 10 }));
  assert.deepEqual(PR4.alvosFinais([a], []).map((x) => x.uid), ['a']);
  assert.deepEqual(PR4.alvosFinais([a], [{ bicho: b, tipo: 'perfuracao' }, { bicho: c, tipo: 'projetil' }, { bicho: d, tipo: 'encadeamento' }, { bicho: a, tipo: 'impacto' }]).map((x) => x.uid), ['b', 'd']);
  // o erro não gruda: o último que a flecha ACERTOU
  assert.deepEqual(PR4.alvosFinais([a], [{ bicho: b, tipo: 'perfuracao' }], (x) => x !== b).map((x) => x.uid), ['a']);
  assert.deepEqual(PR4.primeirosAcertados([a], [{ bicho: b, tipo: 'perfuracao' }, { bicho: c, tipo: 'projetil' }]).map((x) => x.uid), ['a', 'c']);
});

test('PR4: os tentáculos do Ensanguentar — o alvo e os mais perto no cone de ±30° na direção dele, ao alcance', () => {
  const o = { x: 0, y: 0 };
  const alvo = { uid: 'a', x: 4, y: 0, hp: 10 };
  const noCone = { uid: 'b', x: 2, y: 1, hp: 10 };
  const fora = { uid: 'c', x: 0, y: 3, hp: 10 };
  const atras = { uid: 'd', x: -2, y: 0, hp: 10 };
  const longe = { uid: 'e', x: 9, y: 0, hp: 10 };
  const r = PR4.alvosDosTentaculos(o, alvo, [alvo, noCone, fora, atras, longe], 9, 7);
  assert.deepEqual(r.map((x) => x.uid), ['a', 'b']);
  assert.deepEqual(PR4.alvosDosTentaculos(o, alvo, [alvo, noCone], 1, 7).map((x) => x.uid), ['a']);
});

test('PR4: a Concha absorve o acerto até esgotar; o Aprisionamento — a % de cada corda, o "menos" multiplicativo, a raridade e a quebra a 2 casas', () => {
  const c = { hp: 100 };
  assert.deepEqual(PR4.absorverNaConcha(c, 60), { naVida: 0, absorvido: 60, estourou: false });
  assert.deepEqual(PR4.absorverNaConcha(c, 60), { naVida: 20, absorvido: 40, estourou: true });
  const d = { danoSofridoPct: 20, menosPct: { normal: 40, raro: 30, unico: 25 }, maximo: 3, efeitoPct: 0 };
  const bicho = { x: 5, y: 5, raridade: 'normal' };
  let ap = null;
  for (let k = 0; k < 4; k++) ap = PR4.novaCorda(ap, d, bicho);
  assert.equal(ap.cordas.length, 3);
  assert.ok(perto(PR4.fatorDoPassoAprisionado(ap), 1 / 0.6 ** 3));
  assert.equal(ap.danoSofridoPct, 20);
  // o Raro: 30% por corda; o Único (e o chefe): 25%; o Efeito do Debuff +20%: 48% e 24%
  assert.equal(PR4.novaCorda(null, d, { x: 0, y: 0, raridade: 'raro' }).cordas[0].pct, 30);
  assert.equal(PR4.novaCorda(null, d, { x: 0, y: 0, boss: true }).cordas[0].pct, 25);
  const q = PR4.novaCorda(null, { ...d, efeitoPct: 20 }, bicho);
  assert.ok(perto(q.cordas[0].pct, 48));
  assert.ok(perto(q.danoSofridoPct, 24));
  assert.equal(PR4.quebrouOAprisionamento(ap, { x: 7, y: 5 }), false);
  assert.equal(PR4.quebrouOAprisionamento(ap, { x: 8, y: 5 }), true);
});

// ---------------------------------------------------------------- no jogo

test('PR4 no jogo: a Flecha Explosiva gruda no alvo, explode a 1 s da primeira (no tique) na área dela, e as flechas a mais aumentam a explosão', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Explosive_Arrow', { dx: 3 });
  const vizinho = outro(e, resto[0], 4, 0);
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  const f = b.poeFusiveis?.[QUEM];
  assert.ok(f, 'a flecha grudou');
  assert.equal(f.n, 1);
  assert.equal(f.ate - f.desde, 1000);
  // antes do pavio, nada
  assert.deepEqual(golpesEm(tique(e, f.ate - 1), b), []);
  const ev1 = tique(e, f.ate);
  const um = golpesEm(ev1, b);
  assert.equal(um.length, 1);
  assert.equal(golpesEm(ev1, vizinho).length, 1, 'o vizinho a 1 casa está no raio (1,7 m)');
  assert.equal(b.poeFusiveis?.[QUEM], undefined);
  // três flechas: a explosão com 3 × 1,18 ÷ 1,06 do dano da de uma (a mesma rolagem)
  for (let k = 0; k < 3; k++) { liberar(e); assert.ok(usar(e, b).ok); }
  assert.equal(b.poeFusiveis[QUEM].n, 3);
  const tres = golpesEm(tique(e, b.poeFusiveis[QUEM].ate), b);
  assert.equal(tres.length, 1);
  assert.ok(Math.abs(tres[0] / um[0] - (3 * 1.18) / 1.06) < 0.02, `${tres[0]} / ${um[0]}`);
});

test('PR4 no jogo: a Flecha Explosiva explode já no máximo de flechas e na morte do bicho', { skip: SEM }, async () => {
  const { e, b } = await montar('Explosive_Arrow', { dx: 3 });
  assert.ok(usar(e, b).ok);
  b.poeFusiveis[QUEM].n = 19;
  liberar(e);
  assert.ok(usar(e, b).ok);
  assert.equal(b.poeFusiveis[QUEM].n, 20);
  assert.equal(b.poeFusiveis[QUEM].ate, e.hunt.clock);
  assert.equal(golpesEm(tique(e, e.hunt.clock), b).length, 1);
  liberar(e);
  assert.ok(usar(e, b).ok);
  b.hp = 0;
  const ev = tique(e, e.hunt.clock + 1);
  assert.equal(b.poeFusiveis?.[QUEM], undefined);
  assert.ok(ev.some((x) => x.t === 'explosao'));
});

test('PR4 no jogo: a Eletrocussão gruda no alvo e o acerta mais 4 vezes, uma a cada 0,5 s; até 10 flechas por inimigo', { skip: SEM }, async () => {
  const { e, b } = await montar('Lightning_Arrow_of_Electrocution', { dx: 3 });
  assert.ok(usar(e, b).ok);
  const t0 = e.hunt.clock;
  assert.equal(b.poeEletrocussao.length, 1);
  assert.equal(golpesEm(tique(e, t0 + 499), b).length, 0);
  assert.equal(golpesEm(tique(e, t0 + 500), b).length, 1);
  assert.equal(golpesEm(tique(e, t0 + 2000), b).length, 3);
  assert.equal(b.poeEletrocussao, undefined);
  for (let k = 0; k < 12; k++) { liberar(e); assert.ok(usar(e, b).ok); }
  assert.equal(b.poeEletrocussao.length, 10);
});

test('PR4 no jogo: o Golpe Estático que acerta dá a energia estática — os feixes nos vizinhos a cada 0,32 s, com 30% menos dano; o golpe não ricocheteia', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Static_Strike', { arma: 'One_Hand_Swords/Rusted_Sword', dx: 1 });
  const ao = outro(e, resto[0], 0, 1);
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r.eventos, ao).length, 0, 'o golpe corpo a corpo não ricocheteia');
  const t0 = e.hunt.clock;
  assert.equal(e.hunt.poeEstatico.ate - t0, 4000);
  assert.equal(e.hunt.poeEstatico.proxima - t0, 320);
  // (dois feixes — um em cada —, e cada um ricocheteia 1 vez no outro)
  const ev = tique(e, t0 + 320);
  assert.equal(golpesEm(ev, b).length, 2);
  assert.equal(golpesEm(ev, ao).length, 2);
  // o feixe: o golpe com 70% (a mesma rolagem)
  liberar(e);
  const direto = golpesEm(usar(e, b).eventos, b)[0];
  const feixe = golpesEm(tique(e, e.hunt.poeEstatico.proxima), b)[0];
  // (os golpes são inteiros: a diferença do arredondamento, até 1)
  assert.ok(Math.abs(feixe - 0.7 * direto) <= 1, `${feixe} / ${direto}`);
  // a energia acaba nos 4 s
  e.hunt.clock = e.hunt.poeEstatico.ate + 1;
  tique(e, e.hunt.clock);
  assert.equal(e.hunt.poeEstatico, undefined);
});

test('PR4 no jogo: os Relâmpagos Concentrados — +1 por ataque que acerta (até 10), 8% mais por Relâmpago no uso', { skip: SEM }, async () => {
  const { e, b } = await montar('Static_Strike_of_Gathering_Lightning', { arma: 'One_Hand_Swords/Rusted_Sword', dx: 1 });
  const sem = golpesEm(usar(e, b).eventos, b)[0];
  assert.equal(e.hunt.poeConcentrados.n, 1);
  liberar(e);
  const com1 = golpesEm(usar(e, b).eventos, b)[0];
  assert.ok(Math.abs(com1 / sem - 1.08) < 0.02, `${com1} / ${sem}`);
  e.hunt.poeConcentrados.n = 10;
  liberar(e);
  usar(e, b);
  assert.equal(e.hunt.poeConcentrados.n, 10);
});

test('PR4 no jogo: o Ensanguentar acerta o alvo e os vizinhos no cone à sua frente, não o de trás', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Exsanguinate', { arma: 'Wands/Driftwood_Wand', dx: 3 });
  const noCone = outro(e, resto[0], 2, 1);
  const atras = outro(e, resto[1], -2, 0);
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r.eventos, b).length, 1);
  assert.equal(golpesEm(r.eventos, noCone).length, 1);
  assert.equal(golpesEm(r.eventos, atras).length, 0);
});

test('PR4 no jogo: a Concha Somática — no primeiro acertado, 6214; os acertos dela não a gastam; esgotada, explode, deixa 200 ms de imunidade e passa', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Somatic_Shell', { arma: 'Wands/Driftwood_Wand', dx: 3 });
  const vizinho = outro(e, resto[0], 4, 0);
  assert.ok(usar(e, b).ok);
  const c = b.poeConchas?.[QUEM];
  assert.ok(c, 'a concha no alvo');
  assert.equal(c.hp, 6214);
  assert.equal(c.ate - e.hunt.clock, 5000);
  liberar(e);
  assert.ok(usar(e, b).ok);
  assert.equal(b.poeConchas[QUEM].hp, 6214, 'os acertos da própria Concha não a gastam');
  // esgotada (por outro acerto): explode no tique, acerta em volta, a imunidade e a concha passa ao vizinho
  b.poeConchas[QUEM].hp = 0;
  b.poeConchas[QUEM].estourou = e.hunt.clock;
  const t = e.hunt.clock;
  const ev = tique(e, t);
  assert.ok(ev.some((x) => x.t === 'explosao'));
  assert.ok(golpesEm(ev, b).length >= 1);
  assert.equal(b.poeConchaImuneAte, t + 200);
  assert.ok(vizinho.poeConchas?.[QUEM], 'a concha passou ao vizinho');
  assert.equal(b.poeConchas, undefined);
  // na imunidade, o acerto não põe concha nova; depois, sim
  delete vizinho.poeConchas;
  liberar(e);
  e.hunt.clock = t + 100;
  b.poeConchaImuneAte = t + 200;
  assert.ok(usar(e, b).ok);
  assert.equal(b.poeConchas?.[QUEM], undefined);
});

test('PR4 no jogo: a Concha absorve o acerto de outra gema sua antes da Vida', { skip: SEM }, async () => {
  const { e, b } = await montar('Explosive_Arrow', { dx: 3 });
  b.poeConchas = { [QUEM]: { acao: 'x', hp: 1e15, max: 1e15, absorvePct: 100, ate: e.hunt.clock + 5000, desde: e.hunt.clock } };
  const antes = b.hp;
  assert.ok(usar(e, b).ok);
  assert.equal(b.hp, antes);
  assert.ok(b.poeConchas[QUEM].hp < 1e15);
});

test('PR4 no jogo: a Flecha Aprisionadora — as cordas no alvo (40% cada, até 3), +20% de dano de projétil de ataque sofrido, a quebra a 2 casas', { skip: SEM }, async () => {
  const { e, b } = await montar('Ensnaring_Arrow', { dx: 3 });
  b.raridade = 'normal';
  const primeiro = golpesEm(usar(e, b).eventos, b)[0];
  assert.equal(b.poeAprisionado.cordas.length, 1);
  assert.equal(b.poeAprisionado.cordas[0].pct, 40);
  liberar(e);
  const segundo = golpesEm(usar(e, b).eventos, b)[0];
  assert.ok(Math.abs(segundo / primeiro - 1.2) < 0.02, `${segundo} / ${primeiro}`);
  for (let k = 0; k < 3; k++) { liberar(e); usar(e, b); }
  assert.equal(b.poeAprisionado.cordas.length, 3);
  assert.ok(perto(PR4.fatorDoPassoAprisionado(b.poeAprisionado), 1 / 0.6 ** 3));
  b.x += 3;
  tique(e, e.hunt.clock);
  assert.equal(b.poeAprisionado, undefined);
});

// ---------------------------------------------------------------- as decisões do dono (25/10)

test('PR4 (dono, 25/10): o feixe dos Relâmpagos Concentrados — +1 ricochete a cada 2 (5 no máximo de 10, 6 com os 12 da qualidade), sem "menos Dano"', () => {
  assert.deepEqual([0, 1, 2, 3, 10, 12].map(PR4.ricochetesDoConcentrado), [0, 0, 1, 1, 5, 6]);
  const e = PR4.efeitoDoGolpePR4({ fatorDeDano: 1 }, { tipo: 'feixeConcentrado', n: 5, maisPct: 8 });
  assert.ok(perto(e.fatorDeDano, 1.4));
  assert.ok(perto(e.maisAfeccaoPct, 40));
});

test('PR4 no jogo (dono, 25/10): com Relâmpagos Concentrados o ataque solta o feixe — 1 alvo, os ricochetes pelos Relâmpagos, o dano do golpe com o "mais"', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Static_Strike_of_Gathering_Lightning', { arma: 'One_Hand_Swords/Rusted_Sword', dx: 1 });
  const [m1, m2, m3] = [outro(e, resto[0], 2, 0), outro(e, resto[1], 3, 0), outro(e, resto[2], 4, 0)];
  // sem Relâmpago antes do ataque: sem feixe
  usar(e, b);
  assert.equal(e.hunt.poeFeixesConcentrados, undefined);
  // 1 Relâmpago: o feixe sem ricochete, no vivo mais perto de você (o alvo)
  liberar(e);
  const direto = golpesEm(usar(e, b).eventos, b)[0];
  assert.deepEqual(e.hunt.poeFeixesConcentrados.map((f) => f.n), [1]);
  const ev1 = tique(e, e.hunt.clock);
  assert.equal(golpesEm(ev1, b).length, 1);
  assert.equal(golpesEm(ev1, m1).length, 0);
  // o feixe sem "menos": o mesmo dano do golpe com o mesmo "mais" (a mesma rolagem; o arredondamento, até 1)
  assert.ok(Math.abs(golpesEm(ev1, b)[0] - direto) <= 1, `${golpesEm(ev1, b)[0]} / ${direto}`);
  assert.equal(e.hunt.poeFeixesConcentrados, undefined);
  // 5 Relâmpagos: 2 ricochetes — o alvo e mais 2 em sequência
  e.hunt.poeConcentrados.n = 5;
  liberar(e);
  usar(e, b);
  const ev5 = tique(e, e.hunt.clock);
  assert.deepEqual([b, m1, m2, m3].map((m) => golpesEm(ev5, m).length), [1, 1, 1, 0]);
});

test('PR4 no jogo (dono, 25/10): a flecha da Flecha Explosiva causa dano ao acertar (a parte "Arrow" do PoB), além de grudar', { skip: SEM }, async () => {
  const { e, b } = await montar('Explosive_Arrow', { dx: 3 });
  const r = usar(e, b);
  assert.equal(golpesEm(r.eventos, b).length, 1);
  assert.ok(golpesEm(r.eventos, b)[0] > 0);
  assert.equal(b.poeFusiveis[QUEM].n, 1);
});
