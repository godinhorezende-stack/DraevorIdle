// (lote B3, dono 21/10) AS GEMAS ATIVAS DE ONDAS, SEQUÊNCIAS, FORMAS E CADÁVERES (o plano do grupo área/nova/chuva/orbe, as recomendações aceitas): a Cascata Glacial e a da
// Fissura (D-B3.1), a Retribuição Divina (D-B3.1), a Rajada Divina e a do Esplendor, a Chuva Cinética do Impacto, o Tiro Tornado da Nuvem Explosiva, a Conflagração (D-B3.2),
// o Morto Volátil e o do Fervor, as Cremações da Exumação e do Vulcão (D-B3.5), a Troca de Corpos (D-B3.3), a Chuva de Lâminas de Trarthus (D-B3.4) e a Invocar Tormenta
// Vaal. Os números são os do PoE (o PoB, o poedb); os sorteios ficam travados.
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
const B3 = await import('../systems/itens-poe/gemas-b3.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const LinhasDasGemas = await import('../systems/itens-poe/linhas-das-gemas.mjs');

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
/** O personagem com a gema na arma (e o escudo), numa caçada; o alvo imortal a `dx` casas e os outros longe. */
async function montar(slug, { nivel = 20, qualidade = 0, arma = 'Wands/Driftwood_Wand', escudo = null, dx = 1, dy = 0 } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  if (escudo) e.equipment.shield = peca(escudo);
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
  Object.assign(b, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [] });
  e.hunt.cadaveres = [];
  return { e, b, resto };
}
/** Usa a gema no alvo (com a conjuração concluída), com o sorteio travado; devolve o resultado com os eventos da conclusão. */
function usar(e, b, v = 0.5, opcoes = {}) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true, ...opcoes });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; return { ...x, eventos: [...(x.eventos ?? []), ...Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM)] }; }
    return x;
  });
}
/** O próximo uso pode sair (a recarga, o tempo de uso). */
const liberar = (e) => { e.hunt.clock += 10_000; e.hunt.cooldowns = {}; };
/** O tique das plantadas (os objetos, os gêiseres, o lote B3) de `ms` em `ms`, até `total`. */
function tiques(e, total, ms = 100, v = 0.5) {
  const ev = [];
  travado(v, () => { for (let t = 0; t < total; t += ms) { e.hunt.clock += ms; ev.push(...Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [])); } });
  return ev;
}
const golpesEm = (ev, b) => ev.filter((x) => x.t === 'dmg' && x.foe && x.uid === b.uid);
/** Um dos monstros longe, trazido para (`dx`, `dy`) de você, imortal. */
function vizinho(m, dx, dy, i = 0) {
  const v = m.resto[i];
  Object.assign(v, { x: m.e.hunt.pos.x + dx, y: m.e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [] });
  return v;
}
const LOTE = ['Glacial_Cascade', 'Glacial_Cascade_of_the_Fissure', 'Divine_Retribution', 'Divine_Blast', 'Divine_Blast_of_Radiance', 'Kinetic_Rain_of_Impact', 'Tornado_Shot_of_Cloudburst', 'Conflagration', 'Volatile_Dead', 'Volatile_Dead_of_Seething', 'Cremation_of_Exhuming', 'Cremation_of_the_Volcano', 'Bodyswap', 'Bladefall_of_Trarthus', 'Vaal_Storm_Call'];

// ---------------------------------------------------------------- o status

test('B3: as 15 gemas do lote saem de parcial (as linhas do PoE têm leitor; as 5 decisões do dono de 21/10 também)', { skip: SEM }, () => {
  for (const s of LOTE) {
    const r = G.REGISTRO.get(s);
    assert.deepEqual([s, r.statusNoJogo, r.motivosNoJogo], [s, 'funciona', []]);
  }
  // (a velocidade do orbe do Morto Volátil não se aplica: só a trajetória — fica como nota, como as linhas de trajetória do lote A3)
  for (const s of ['Volatile_Dead', 'Volatile_Dead_of_Seething']) assert.ok(G.linhasQueNaoSeAplicam(G.linhasDaQualidadeDe(s, 20)).some((n) => /Velocidade de Movimento do Orbe/.test(n)), s);
  // ("Empurra Inimigos ao Acertar" — o global_knockback do PoB — é o Empurrão do jogo em todo acerto da gema)
  assert.deepEqual(LinhasDasGemas.atributosDaLinha('Empurra Inimigos ao Acertar'), { chance_empurrar: 100 });
});

// ---------------------------------------------------------------- os leitores (os números do PoE)

test('B3: os leitores no nível 20 — os números do PoB e do poedb', { skip: SEM }, () => {
  // a Cascata Glacial: 4 rajadas de 1,2 m, a Explosão Final de 2,4 m com +200% (+2,5 por qualidade); a da Fissura: 6 + 0,1 por qualidade, sem a final
  assert.deepEqual(G.sequenciaDaGema('Glacial_Cascade', 20, 0), { forma: 'cascata', areas: 4, raioM: 1.2, final: { raioM: 2.4, maisPct: 200 } });
  assert.equal(G.sequenciaDaGema('Glacial_Cascade', 20, 20).final.maisPct, 250);
  assert.deepEqual([G.sequenciaDaGema('Glacial_Cascade_of_the_Fissure', 20, 0).areas, G.sequenciaDaGema('Glacial_Cascade_of_the_Fissure', 20, 20).areas, G.sequenciaDaGema('Glacial_Cascade_of_the_Fissure', 20, 20).final], [6, 8, null]);
  // a Retribuição Divina: 4 ondas de 6 explosões; o raio do estouro é o segundo número da célula do poedb ("2, 1.6" — o PoB: 12 + 4 no nível 20)
  assert.deepEqual(G.sequenciaDaGema('Divine_Retribution', 20, 0), { forma: 'ondas', ondas: 4, porOnda: 6, raioM: 1.6 });
  assert.equal(G.sequenciaDaGema('Divine_Retribution', 1, 0).raioM, 1.2);
  assert.equal(G.ultimoDaColuna('Divine_Retribution', 20, /^Raio do Estouro/i), 1.6);
  // a Chuva Cinética do Impacto: o retângulo de 9 m × 4,5 m; 10 projéteis (+2 da qualidade); a explosão de 1,2 m
  assert.deepEqual(G.sequenciaDaGema('Kinetic_Rain_of_Impact', 20, 0), { forma: 'chuvaRetangular', comprimentoM: 9, larguraM: 4.5 });
  assert.deepEqual([G.alvosNoNivel('Kinetic_Rain_of_Impact', 20, 20).base, G.alvosNoNivel('Kinetic_Rain_of_Impact', 20, 20).projeteis], [10, 2]);
  // a Rajada Divina: a explosão de 2,6 m (+0,3 da qualidade) depois de 1,2 s, com 100% mais; a do Esplendor: o orbe de 5 s, uma vez por segundo, 3 orbes, 2,2 m
  assert.deepEqual(G.objetoDaGema('Divine_Blast', 20, 0), { tipo: 'explosaoDivina', semAcerto: false, atrasoMs: 1200, raioM: 2.6, maisPct: 100 });
  assert.ok(perto(G.objetoDaGema('Divine_Blast', 20, 20).raioM, 2.9));
  assert.deepEqual(G.objetoDaGema('Divine_Blast_of_Radiance', 20, 0), { tipo: 'orbeDivino', semAcerto: false, intervaloMs: 1000, duracaoMs: 5000, raioM: 2.2, max: 3 });
  // o Tiro Tornado da Nuvem Explosiva: a carregada; 9 flechas (+4 da qualidade)
  assert.deepEqual(G.objetoDaGema('Tornado_Shot_of_Cloudburst', 20, 0), { tipo: 'carregamento', semAcerto: true });
  assert.deepEqual([G.alvosNoNivel('Tornado_Shot_of_Cloudburst', 20, 20).base, G.alvosNoNivel('Tornado_Shot_of_Cloudburst', 20, 20).projeteis], [9, 4]);
  // a Invocar Tormenta Vaal: um golpe a cada 0,2 s pela duração (6 s, +1 da qualidade), o raio final de 4 m
  assert.deepEqual(G.objetoDaGema('Vaal_Storm_Call', 20, 20), { tipo: 'tormentaVaal', semAcerto: true, intervaloMs: 200, duracaoMs: 7000, raioFinalM: 4 });
  // a Conflagração pelo PoB (as faixas do poedb abaixo do 20 estão corrompidas): 3 flechas, 3 m, 1 m, até 20, 6 s, 4 s, +50% (+1,5 por qualidade); a explosão de 2 m
  assert.deepEqual(G.b3DaGema('Conflagration', 20, 20).conflagracao, { flechas: 3, quedaM: 3, impactoM: 1, maxFlechas: 20, presaMs: 6000, penalidadeMs: 4000, explosaoMaisPct: 80, gatilhoCasas: 1, explosaoM: 2 });
  assert.equal(G.b3DaGema('Conflagration', 1, 0).conflagracao.explosaoM, 1.5);
  // a Cremação da Exumação: explode um cadáver ao disparar; o "15% mais rápido" da qualidade (0,8 s ÷ 1,15)
  assert.equal(G.b3DaGema('Cremation_of_Exhuming', 20, 0).explodeAoDisparar, true);
  assert.equal(G.cadaverDaGema('Cremation_of_Exhuming', 20, 20).geiser.intervaloMs, Math.round(800 / 1.15));
  // a do Vulcão: a cada 1 s, 2 s, 4 projéteis, até 8 (+2 da qualidade)
  assert.deepEqual(G.b3DaGema('Cremation_of_the_Volcano', 20, 20).vulcao, { intervaloMs: 1000, duracaoMs: 2000, projeteis: 4, max: 10 });
  // a Troca de Corpos: 210–315 + 6% (+6% da qualidade) da Vida como Fogo base; o cadáver de 7,9%; 300% mais Área no cadáver; o raio 1,4 + 0,2 m
  const t = G.b3DaGema('Bodyswap', 20, 20).troca;
  assert.deepEqual([t.min, t.max, t.vidaPct, t.cadaverPct, t.areaCadaverMaisPct], [210, 315, 12, 7.9, 300]);
  assert.ok(perto(t.raioM, 1.6));
  assert.deepEqual(B3.fogoDaTroca(t, 10_000), [1410, 1515]);
  // a Chuva de Lâminas de Trarthus: 0,7 s, 2% por 100 de Mana, 2,5 m (+0,3), 1 m, 5 lâminas, 40, 6 s, 5% da Mana por segundo
  assert.deepEqual(G.b3DaGema('Bladefall_of_Trarthus', 20, 0).trarthus, { intervaloMs: 700, porManaPct: 2, porMana: 100, raioM: 2.5, laminaM: 1, laminas: 5, maxPersistentes: 40, persistenteMs: 6000, custoPctPorS: 5 });
  const tr = G.b3DaGema('Bladefall_of_Trarthus', 20, 0).trarthus;
  // (1.050 de Mana: ⌊10,5⌋ = 10 → 20% de frequência; 1 s gasta 5% de 1.000)
  assert.ok(perto(B3.intervaloDaTrarthus(tr, 1050), 700 / 1.2));
  assert.ok(perto(B3.custoDaTrarthus(tr, 1000, 1000), 50));
});

// ---------------------------------------------------------------- a Cascata Glacial (D-B3.1)

test('B3 no jogo: a Cascata Glacial — rajadas em linha até o alvo, a Explosão Final com 250% mais (q20), e o Empurrão leva o inimigo para a próxima', { skip: SEM }, async () => {
  const m = await montar('Glacial_Cascade', { qualidade: 20, dx: 3 });
  const x0 = m.b.x;
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  // (o raio de 1,2 m com o sorteio 0,5 dá 1 casa; o alvo a 3 casas é acertado pela 2ª e empurrado; pela 3ª e empurrado; e pela Explosão Final)
  const g = golpesEm(r.eventos, m.b).map((x) => x.v);
  assert.equal(g.length, 3, JSON.stringify(g));
  assert.ok(perto(Math.max(...g) / Math.min(...g), 3.5, 0.01), `a final: ${g}`);
  assert.equal(m.b.x, x0 + 3, 'empurrado a cada acerto');
});

test('B3 no jogo: a Cascata Glacial da Fissura — 6 rajadas no nível 20, 8 com a qualidade 20 (a linha chega mais longe)', { skip: SEM }, async () => {
  // (o sorteio 0,9: o raio de 1,2 m fica em 0 casas — cada rajada pega só a casa dela)
  const sem = await montar('Glacial_Cascade_of_the_Fissure', { dx: 7 });
  assert.equal(usar(sem.e, sem.b, 0.9).motivo, 'SEM_BICHO_NA_AREA');
  const com = await montar('Glacial_Cascade_of_the_Fissure', { qualidade: 20, dx: 7 });
  const r = usar(com.e, com.b, 0.9);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r.eventos, com.b).length, 1);
});

// ---------------------------------------------------------------- a Retribuição Divina (D-B3.1)

test('B3 no jogo: a Retribuição Divina — 4 ondas de 6 explosões em anéis que crescem do local mirado; no centro, as 6 da primeira onda', { skip: SEM }, async () => {
  const m = await montar('Divine_Retribution', { dx: 2 });
  m.e.hunt.retaliacao = { bloquear: { ate: Infinity, usados: [] } };
  // um segundo inimigo a 4 casas do alvo (a 4ª onda)
  const v = vizinho(m, 6, 0);
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  // (o raio de 1,6 m com o sorteio 0,5 dá 1 casa: as 6 explosões do anel 1 cobrem o centro; as do anel 2 não)
  assert.equal(golpesEm(r.eventos, m.b).length, 6);
  // (as casas sorteadas com o sorteio 0,5: a do meio da lista de cada anel — o anel 4 tem 32 casas, 6 delas; o vizinho a 4 casas pode ou não estar nelas)
  assert.ok(golpesEm(r.eventos, v).length <= 6);
});

// ---------------------------------------------------------------- a Rajada Divina e a do Esplendor

const ESCUDO = { arma: 'One_Hand_Swords/Rusted_Sword', escudo: 'Shields/Splintered_Tower_Shield' };
test('B3 no jogo: a Rajada Divina — a implosão no uso e, 1,2 s depois, a explosão com 100% mais (acertos e afecções)', { skip: SEM }, async () => {
  const m = await montar('Divine_Blast', ESCUDO);
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  const implosao = golpesEm(r.eventos, m.b).map((x) => x.v);
  assert.equal(implosao.length, 1);
  const antes = golpesEm(tiques(m.e, 1100), m.b);
  assert.equal(antes.length, 0, 'ainda não explodiu');
  const exp = golpesEm(tiques(m.e, 200), m.b).map((x) => x.v);
  assert.equal(exp.length, 1);
  assert.ok(perto(exp[0] / implosao[0], 2, 0.01), `${exp[0]} / ${implosao[0]}`);
});

test('B3 no jogo: a Rajada Divina do Esplendor — o orbe explode uma vez por segundo pela duração (5 explosões em 5 s)', { skip: SEM }, async () => {
  const m = await montar('Divine_Blast_of_Radiance', ESCUDO);
  assert.ok(usar(m.e, m.b).ok);
  assert.equal(golpesEm(tiques(m.e, 6000), m.b).length, 5);
  assert.ok(!(m.e.hunt.poeObjetos ?? []).some((o) => o.tipo === 'orbeDivino'), 'o orbe acabou');
});

// ---------------------------------------------------------------- a Chuva Cinética do Impacto

test('B3 no jogo: a Chuva Cinética do Impacto — cada projétil cai num inimigo do retângulo à frente (12 com a qualidade 20), um por inimigo, na ordem', { skip: SEM }, async () => {
  const m = await montar('Kinetic_Rain_of_Impact', { qualidade: 20 });
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r.eventos, m.b).length, 12);
  // dois inimigos longe um do outro, na área (a 1 casa do eixo — a largura de 4,5 m dá ±1 casa): 6 projéteis em cada
  const d = await montar('Kinetic_Rain_of_Impact', { qualidade: 20, dx: 1, dy: 0 });
  const v = vizinho(d, 4, 1);
  const r2 = usar(d.e, d.b);
  assert.ok(r2.ok, r2.erro);
  assert.deepEqual([golpesEm(r2.eventos, d.b).length, golpesEm(r2.eventos, v).length], [6, 6]);
});

// ---------------------------------------------------------------- o Tiro Tornado da Nuvem Explosiva

test('B3 no jogo: o Tiro Tornado da Nuvem Explosiva — a carregada cai no alvo e as flechas saem de lá em volta (o inimigo onde ela cai leva todas)', { skip: SEM }, async () => {
  for (const [q, n] of [[0, 9], [20, 13]]) {
    const m = await montar('Tornado_Shot_of_Cloudburst', { qualidade: q, arma: 'Bows/Crude_Bow', dx: 3 });
    const r = usar(m.e, m.b);
    assert.ok(r.ok, r.erro);
    assert.equal(golpesEm(r.eventos, m.b).length, 0, 'o uso não acerta');
    assert.equal(golpesEm(tiques(m.e, 100), m.b).length, n, `q${q}`);
  }
});

// ---------------------------------------------------------------- a Conflagração (D-B3.2)

test('B3 no jogo: a Conflagração — os impactos no uso, as flechas presas; um inimigo chegando perto (decisão do dono, 21/10) as explode, em cadeia, com 80% mais e o Fogo de 4 s', { skip: SEM }, async () => {
  const m = await montar('Conflagration', { qualidade: 20, arma: 'Bows/Harbinger_Bow', dx: 3 });
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  // (o sorteio 0,5: as 3 flechas caem na casa do alvo — o raio de 3 m dá 1 casa e o sorteio, o centro; o impacto de 1 m, 0 casas)
  const impactos = golpesEm(r.eventos, m.b).map((x) => x.v);
  assert.equal(impactos.length, 3);
  assert.ok(!(m.b.dots ?? []).some((d) => d.chave === 'Conflagration'), 'o impacto não põe o Fogo');
  const presas = () => (m.e.hunt.poeObjetos ?? []).filter((o) => o.tipo === 'flechaPresa');
  assert.equal(presas().length, 3);
  // o alvo longe (a 3 casas delas) e você longe: nada explode
  const casa = { x: m.b.x, y: m.b.y };
  m.b.x += 3;
  assert.equal(golpesEm(tiques(m.e, 500), m.b).length, 0);
  assert.equal(presas().length, 3);
  // o inimigo volta para a casa das flechas: elas explodem (a 1 casa — todas, a cadeia)
  Object.assign(m.b, casa);
  const exp = golpesEm(tiques(m.e, 100), m.b).map((x) => x.v);
  assert.equal(exp.length, 3);
  assert.equal(presas().length, 0);
  assert.ok(perto(exp[0] / impactos[0], 1.8, 0.03), `${exp[0]} / ${impactos[0]}`);
  const fogo = (m.b.dots ?? []).find((d) => d.chave === 'Conflagration');
  assert.ok(fogo, 'a explosão põe o Fogo degenerativo');
  assert.equal(fogo.ate - fogo.desde, 4000);
});

test('B3 no jogo: a Conflagração — você chegando a 1 casa da flecha presa também a explode', { skip: SEM }, async () => {
  const m = await montar('Conflagration', { arma: 'Bows/Harbinger_Bow', dx: 3 });
  assert.ok(usar(m.e, m.b).ok);
  const presas = () => (m.e.hunt.poeObjetos ?? []).filter((o) => o.tipo === 'flechaPresa');
  const f = presas()[0];
  m.b.x += 3;
  tiques(m.e, 200);
  assert.equal(presas().length, 3);
  m.e.hunt.pos.x = f.x - 1;
  m.e.hunt.pos.y = f.y;
  const ev = tiques(m.e, 100);
  assert.equal(presas().length, 0);
  assert.equal(ev.filter((x) => x.t === 'explosao').length, 3);
});

test('B3 no jogo: a Conflagração — no máximo 20 flechas presas da gema (saem as mais velhas)', { skip: SEM }, async () => {
  const m = await montar('Conflagration', { arma: 'Bows/Crude_Bow', dx: 3 });
  for (let i = 0; i < 8; i++) { assert.ok(usar(m.e, m.b).ok); liberar(m.e); m.e.hunt.poeObjetos = (m.e.hunt.poeObjetos ?? []).map((o) => ({ ...o, ate: m.e.hunt.clock + 60_000 })); }
  assert.equal((m.e.hunt.poeObjetos ?? []).filter((o) => o.tipo === 'flechaPresa').length, 20);
});

// ---------------------------------------------------------------- as Cremações (D-B3.5)

test('B3 no jogo: a Cremação da Exumação — o gêiser explode um cadáver perto a cada disparo', { skip: SEM }, async () => {
  const m = await montar('Cremation_of_Exhuming', { dx: 2 });
  const cad = (dx, dy) => ({ key: 'x', nome: 'Morto', look: 1, x: m.e.hunt.pos.x + dx, y: m.e.hunt.pos.y + dy, maxHp: 10000 });
  m.e.hunt.cadaveres = [cad(2, 0), cad(3, 0)];
  assert.ok(usar(m.e, m.b).ok);
  assert.equal(m.e.hunt.cadaveres.length, 1, 'o do uso explodiu');
  tiques(m.e, 900);
  assert.equal(m.e.hunt.cadaveres.length, 0, 'o perto explodiu no primeiro disparo');
});

test('B3 no jogo: a Cremação do Vulcão — o gêiser no alvo sem cadáver, a cada 1 s por 2 s; até 10 com a qualidade 20', { skip: SEM }, async () => {
  const m = await montar('Cremation_of_the_Volcano', { qualidade: 20, dx: 2 });
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r.eventos, m.b).length, 0, 'o uso não acerta');
  const g = m.e.hunt.poeGeiseres;
  assert.equal(g.length, 1);
  assert.deepEqual([g[0].x, g[0].y, g[0].ate - m.e.hunt.clock, g[0].intervaloMs, g[0].projeteis], [m.b.x, m.b.y, 2000, 1000, 4]);
  assert.equal(golpesEm(tiques(m.e, 2400), m.b).length, 8, '4 projéteis aos 1 s e aos 2 s');
  for (let i = 0; i < 11; i++) { liberar(m.e); assert.ok(usar(m.e, m.b).ok); for (const x of m.e.hunt.poeGeiseres) x.ate = m.e.hunt.clock + 60_000; }
  assert.equal(m.e.hunt.poeGeiseres.length, 10);
});

// ---------------------------------------------------------------- a Troca de Corpos (D-B3.3)

test('B3 no jogo: a Troca de Corpos — com cadáver perto do alvo: consome-o (a explosão dele) e você teleporta para ele, sem contar como movimento', { skip: SEM }, async () => {
  const m = await montar('Bodyswap', { dx: 3 });
  m.e.hunt.cadaveres = [{ key: 'x', nome: 'Morto', look: 1, x: m.b.x - 1, y: m.b.y, maxHp: 10000 }];
  const tel = m.e.hunt.teleportes ?? 0;
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  assert.deepEqual([m.e.hunt.pos.x, m.e.hunt.pos.y], [m.b.x - 1, m.b.y]);
  assert.equal(m.e.hunt.cadaveres.length, 0);
  assert.equal(m.e.hunt.teleportes, tel + 1);
  assert.equal(m.e.hunt.poeUltimaPos, `${m.e.hunt.pos.x},${m.e.hunt.pos.y}`);
  // a explosão da magia na chegada (ao lado do alvo) e a do cadáver (7,9% de 10.000, com 300% mais Área)
  assert.ok(golpesEm(r.eventos, m.b).length >= 2);
});

test('B3 no jogo: a Troca de Corpos — sem cadáver: você explode no lugar e teleporta para o lado do alvo; o Fogo cresce com a Vida máxima', { skip: SEM }, async () => {
  const dano = async (vida) => {
    const m = await montar('Bodyswap', { dx: 3 });
    m.e.maxHp = m.e.hp = vida;
    const r = usar(m.e, m.b);
    assert.ok(r.ok, r.erro);
    assert.equal(Math.max(Math.abs(m.e.hunt.pos.x - m.b.x), Math.abs(m.e.hunt.pos.y - m.b.y)), 1, 'ao lado do alvo');
    return golpesEm(r.eventos, m.b).reduce((t, x) => t + x.v, 0);
  };
  const a = await dano(10_000);
  const b = await dano(110_000);
  // (+100.000 de Vida × 6% = +6.000 de Fogo base em cada ponta — os modificadores multiplicam por cima)
  assert.ok(b > a * 3, `${a} → ${b}`);
});

// ---------------------------------------------------------------- a Chuva de Lâminas de Trarthus (D-B3.4)

test('B3 no jogo: a Chuva de Lâminas de Trarthus — liga, gasta 5% da Mana por segundo, solta as rajadas em volta de você e desliga no clique', { skip: SEM }, async () => {
  const m = await montar('Bladefall_of_Trarthus', { dx: 1 });
  m.e.maxMana = m.e.mana = 1000;
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r.eventos, m.b).length, 0, 'o uso só liga');
  assert.ok(m.e.hunt.poeTrarthus);
  // (1.000 de Mana: 20% de frequência — uma rajada a cada 583 ms; 1 s gasta 50)
  const ev = tiques(m.e, 1000);
  assert.equal(golpesEm(ev, m.b).length, 1);
  assert.ok(perto(1000 - m.e.mana, 50, 0.001), `${1000 - m.e.mana}`);
  assert.equal((m.e.hunt.poeObjetos ?? []).filter((o) => o.tipo === 'lamina').length, 5, 'as 5 Lâminas Persistentes');
  // a barra automática não a usa de novo; o clique desliga
  liberar(m.e);
  assert.equal(travado(0.5, () => Acoes.disparar(m.e, m.e.hunt, PERSONAGEM, 0, m.b, { manual: false })).motivo, 'EFEITO_ATIVO');
  const off = usar(m.e, m.b);
  assert.ok(off.ok && off.desligou);
  assert.ok(!m.e.hunt.poeTrarthus);
  // sem Mana para o tique, desliga
  liberar(m.e);
  assert.ok(usar(m.e, m.b).ok);
  m.e.mana = 1;
  tiques(m.e, 200);
  assert.ok(!m.e.hunt.poeTrarthus);
});

// ---------------------------------------------------------------- a Invocar Tormenta Vaal

test('B3 no jogo: a Invocar Tormenta Vaal — um golpe a cada 0,2 s pela duração (35 em 7 s, q20) e o raio grande no fim', { skip: SEM }, async () => {
  const m = await montar('Vaal_Storm_Call', { qualidade: 20, dx: 2 });
  const r = usar(m.e, m.b);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r.eventos, m.b).length, 0, 'o uso só põe o marcador');
  assert.equal(golpesEm(tiques(m.e, 7500), m.b).length, 36);
  assert.ok(!(m.e.hunt.poeObjetos ?? []).some((o) => o.tipo === 'tormentaVaal'));
});
