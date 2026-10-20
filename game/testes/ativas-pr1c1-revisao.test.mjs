// (revisão adversarial dos lotes PR1 e C1, 20/10) os achados confirmados: a eficácia do dano adicional do Sifão do Arquimago, as estilhas em todo voo do escudo,
// o escudo de Trarthus por repetição, os cones da Flecha Galvânica da Energia e do Surto, o buff da Cutilada Vaal pelo Golpe de Misericórdia, o Frenesi por
// repetição, a área do raio do Castigo do Julgamento Divino, a Evisceração parcial, as ondas sobrepostas do Esmagar Escudos, o Impelir das que o PoB marca
// NeverExertable, o balão do Estilhaçar a Terra, o puxão da Corrente de Anzol e o critério único do Raro ou Único. Os números são os do PoE (o PoB, o poedb).
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
const PR1 = await import('../systems/itens-poe/gemas-pr1.mjs');
const C1 = await import('../systems/itens-poe/gemas-c1.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const CargasPoe = await import('../systems/itens-poe/cargas.mjs');
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

let J;
let gerarPeca;
const peca = (base) => J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
const perto = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
/** O personagem com a gema na arma (e a peça da outra mão), numa caçada; o alvo imortal colado (+1, 0) e os outros longe. `repeticoes`: o anel com o Altar Ecoante. */
async function montar(slug, { nivel = 20, qualidade = 0, arma = 'One_Hand_Swords/Rusted_Sword', outra = null, repeticoes = 0 } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: a };
  if (outra) e.equipment.shield = peca(outra);
  else delete e.equipment.shield;
  if (repeticoes) e.equipment.ring = { id: 0, count: 1, af: [], poe: { af: { repeticoes_extra: repeticoes } } };
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
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, evasao: 0, armaduraPct: -100 });
  return { e, b, resto, entry: Acoes.POR_ID_PUBLICO(G.doSlug(slug).acao) };
}
/** Põe o bicho `m` (imortal, sem evasão) na casa (dx, dy) de você. */
const por = (e, m, dx, dy, extra = {}) => Object.assign(m, { x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, evasao: 0, armaduraPct: -100, ...extra });
function usar(e, b, v = 0.5) {
  return travado(v, () => {
    const x = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, b, { manual: true });
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM); }
    return x;
  });
}
const acertos = (r, b) => (r.eventos ?? []).filter((ev) => ev.t === 'dmg' && ev.uid === b.uid).length;

// ---------------------------------------------------------------- PR1

test('revisão PR1 (1): o Raio adicional do Sifão do Arquimago × a eficácia da gema (60%: damageEffectiveness 0,6 do PoB); a Flecha Ardente do Vigor, 1', { skip: SEM }, async () => {
  assert.deepEqual([G.eficaciaNoNivel('Power_Siphon_of_the_Archmage', 20), G.eficaciaNoNivel('Burning_Arrow_of_Vigour', 20)], [0.6, 1]);
  const { e, entry } = await montar('Power_Siphon_of_the_Archmage', { qualidade: 20, arma: 'Wands/Driftwood_Wand' });
  e.maxMana = 10_000;
  Ficha.invalidar(e);
  const f = Acoes.comAsLinhasDaGema(e, Ficha.combate(e), entry);
  const s = ModsPoe.somaPorTags(f, Acoes.tagsPoeDaSkill(entry));
  const mana = Ficha.combate(e).maxMana ?? e.maxMana;
  // (27% da Mana máxima na qualidade 20 × 0,6)
  assert.ok(perto(s.added_energy_dmg_min, 0.27 * 0.6 * mana) && perto(s.added_energy_dmg_max, 0.27 * 0.6 * mana), `${s.added_energy_dmg_min} (Mana ${mana})`);
});

test('revisão PR1 (2): o escudo solta as estilhas também nos voos de direção aleatória', { skip: SEM }, () => {
  const alvo = { uid: 'a', x: 3, y: 0, hp: 10 };
  const atras = { uid: 'b', x: 5, y: 0, hp: 10 };
  // (o sorteio 0: o ângulo 0 — o leste; o escudo acha o alvo e a estilha dele, o de trás)
  const r = Secundarios.resolver({ efeito: { estilhas: { n: 1, pct: 50 }, direcoesAleatorias: true, perfurar: 0, encadear: 0 }, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo, atingidos: [alvo], vivos: [alvo, atras], alcance: 7, rng: () => 0 });
  assert.ok(r.emitidos.some((p) => p.tipo === 'estilha'), 'a estilha saiu');
  assert.ok(r.golpes.some((g) => g.bicho === atras && g.pct === 50), JSON.stringify(r.golpes.map((g) => [g.bicho.uid, g.tipo, g.pct])));
});

test('revisão PR1 (3): o de Trarthus com uma repetição (o Altar Ecoante) — cada repetição deixa o seu escudo parado', { skip: SEM }, async () => {
  const { e, b } = await montar('Spectral_Shield_Throw_of_Trarthus', { outra: 'Shields/Splintered_Tower_Shield', repeticoes: 1 });
  const r = usar(e, b, 0);
  assert.ok(r.ok, r.erro);
  assert.equal(e.hunt.poeObjetos.filter((o) => o.tipo === 'escudo').length, 2);
});

test('revisão PR1 (4): a Flecha Galvânica da Energia — o cone sai de você (não a área no chão em volta do alvo); alcance de 3 casas', { skip: SEM }, async () => {
  const { e, b, resto, entry } = await montar('Galvanic_Arrow_of_Energy', { arma: 'Bows/Crude_Bow' });
  assert.equal(entry.range, 3);
  const frente = por(e, resto[0], 2, 0);
  const atras = por(e, resto[1], -1, 0);
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.deepEqual([acertos(r, b), acertos(r, frente), acertos(r, atras)], [1, 1, 0]);
});

test('revisão PR1 (4): a Flecha Galvânica do Surto — o cone atrás do alvo, na colisão da flecha (o alvo não leva o do próprio cone)', { skip: SEM }, async () => {
  assert.ok(PR1.temConeAtrasDoAlvo('Galvanic_Arrow_of_Surging') && !PR1.temConeAtrasDoAlvo('Galvanic_Arrow'));
  const { e, b, resto } = await montar('Galvanic_Arrow_of_Surging', { arma: 'Bows/Crude_Bow' });
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  const soAlvo = acertos(r, b);
  // o de trás do alvo, colado nele: leva o cone (e o que as flechas a mais derem)
  const m = await montar('Galvanic_Arrow_of_Surging', { arma: 'Bows/Crude_Bow' });
  const atras = por(m.e, m.resto[0], 2, 0);
  const r2 = usar(m.e, m.b);
  assert.ok(r2.ok, r2.erro);
  assert.ok(r2.eventos.some((ev) => ev.t === 'area' && ev.x === m.b.x && ev.y === m.b.y), 'o cone sai do alvo');
  assert.ok(acertos(r2, atras) >= 1, 'o de trás leva o cone');
  assert.equal(acertos(r2, m.b), soAlvo, 'o alvo não leva o cone dele');
  assert.ok(resto.length >= 0);
});

// ---------------------------------------------------------------- C1

test('revisão C1 (5): a Cutilada Vaal — o golpe final pelo Golpe de Misericórdia (o Raro a 4% da Vida) também dá o buff', { skip: SEM }, async () => {
  const { e, b } = await montar('Vaal_Cleave');
  Object.assign(b, { maxHp: 1e12, hp: 0.04e12, raridade: 'raro' });
  assert.ok(usar(e, b).ok);
  assert.ok(b.hp <= 0, 'o Golpe de Misericórdia');
  assert.ok(e.hunt.poeCutiladaVaal, 'o buff');
});

test('revisão C1 (6): o Frenesi da Agressividade com uma repetição — uma Carga de Frenesi por ataque (o uso e a repetição)', { skip: SEM }, async () => {
  const { e, b } = await montar('Frenzy_of_Onslaught', { repeticoes: 1 });
  assert.ok(CargasPoe.maximo(Ficha.combate(e).afPoe ?? {}, 'frenesi') >= 2);
  assert.ok(usar(e, b).ok);
  assert.equal(CargasPoe.ativas(e).frenesi, 2);
});

test('revisão C1 (7): o raio do Castigo do Julgamento Divino causa dano em área (2,1 m) em volta do alvo dele — cada inimigo uma vez', { skip: SEM }, async () => {
  assert.equal(G.areaNoNivel('Smite_of_Divine_Judgement', 20, 0).raioM, 2.1);
  const { e, b, resto } = await montar('Smite_of_Divine_Judgement');
  por(e, b, 0, -1);
  // os 2 alvos do raio atrás de você, a 2 casas; o do meio deles, a 3 casas (fora do alcance do raio), está na área dos dois
  const alvos = [por(e, resto[0], -1, 2), por(e, resto[1], 1, 2)];
  const vizinho = por(e, resto[2], 0, 3);
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.deepEqual([acertos(r, b), ...alvos.map((m) => acertos(r, m)), acertos(r, vizinho)], [1, 1, 1, 1]);
});

test('revisão C1 (8): a Evisceração (dono 20/10) — o inimigo colado à frente leva as duas ondas; o de 2 casas, uma', { skip: SEM }, async () => {
  assert.equal(G.REGISTRO.get('Eviscerate').statusNoJogo, 'funciona');
  const { e, b, resto } = await montar('Eviscerate', { outra: 'Shields/Splintered_Tower_Shield' });
  const longe = por(e, resto[0], 2, 0);
  // (a Retaliação: a janela aberta pelo bloqueio)
  ModsPoe.abrirRetaliacao(e.hunt, 'bloquear', {}, e.hunt.clock);
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.deepEqual([acertos(r, b), acertos(r, longe)], [2, 1]);
});

test('revisão C1 (9): o Esmagar Escudos do Chefe Guerreiro — no cone E na Onda Central, dois acertos; só na Onda Central, um', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Shield_Crush_of_the_Chieftain', { outra: 'Shields/Splintered_Tower_Shield' });
  const ponta = por(e, resto[0], 2, 0);
  // (o sorteio 0,5: o cone de 2,9 m em 1 casa; a Onda Central × √1,88 = 3,98 m em 2 casas)
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.deepEqual([acertos(r, b), acertos(r, ponta)], [2, 1]);
  // a forma: a sobreposição é o terço do meio dentro do raio do cone
  const cone = [[-1, -1], [0, -1], [1, -1]];
  const casas = C1.formaComOndaCentral(cone, 2).map(([x, y]) => ({ x, y }));
  assert.deepEqual(C1.sobreposicaoDaOndaCentral(cone, 2, casas, { x: 0, y: 0, dir: null }).map((c) => `${c.x},${c.y}`), ['0,-1']);
});

test('revisão C1 (10): as que o PoB marca NeverExertable não são Impelidas — a Cutilada Vaal não gasta nem recebe o Impelido; o Impacto Sísmico Vaal sim', { skip: SEM }, async () => {
  assert.ok(['Vaal_Cleave', 'Swordstorm', 'Eviscerate', 'Vaal_Lightning_Strike'].every(C1.naoImpelivel));
  assert.equal(C1.naoImpelivel('Vaal_Ground_Slam'), false);
  const v = await montar('Vaal_Cleave');
  assert.ok(Acoes.tagsPoeDaSkill(v.entry).includes('naoImpelivel'));
  v.e.hunt.impelidos = { n: 3, ate: v.e.hunt.clock + 20_000 };
  const f = ModsPoe.fichaDoGolpe(Ficha.combate(v.e), Acoes.tagsPoeDaSkill(v.entry), { estado: v.e });
  assert.ok(!f.tagsDoGolpe.includes('impelido'), 'o golpe não é Impelido');
  assert.ok(usar(v.e, v.b).ok);
  assert.equal(v.e.hunt.impelidos.n, 3, 'não gastou o Impelido');
  const s = await montar('Vaal_Ground_Slam', { arma: 'Two_Hand_Maces/Driftwood_Maul' });
  assert.ok(!Acoes.tagsPoeDaSkill(s.entry).includes('naoImpelivel'));
  s.e.hunt.impelidos = { n: 3, ate: s.e.hunt.clock + 20_000 };
  assert.ok(usar(s.e, s.b).ok);
  assert.equal(s.e.hunt.impelidos.n, 2, 'o Impacto Sísmico Vaal gasta');
});

test('revisão C1 (11): o balão do Estilhaçar a Terra da Proeminência não risca as linhas das estacas (a mesma regra do status)', { skip: SEM }, () => {
  for (const slug of ['Earthshatter_of_Prominence', 'Earthshatter', 'Bladefall']) {
    const f = G.fichaNoNivel(slug, 20, 20);
    assert.equal(f.status, 'funciona', slug);
    assert.deepEqual([slug, f.naoFeitas], [slug, []]);
  }
});

test('revisão C1 (12): a Corrente de Anzol para Pesca puxa os não únicos distantes para perto de você; o Único fica', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Chain_Hook_of_Angling', { arma: 'One_Hand_Axes/Rusted_Hatchet' });
  const longe = por(e, resto[0], 0, -3, { raridade: 'magico' });
  const unico = por(e, resto[1], -3, 0, { raridade: 'unico' });
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.ok(acertos(r, longe) && acertos(r, unico));
  assert.equal(cheb(e.hunt.pos, longe), 1, 'puxado');
  assert.equal(cheb(e.hunt.pos, unico), 3, 'o Único não');
  assert.equal(cheb(e.hunt.pos, b), 1);
});

test('revisão C1 (13): o Raro ou Único é um critério só (o do Sifão e o da Cutilada Vaal)', { skip: SEM }, () => {
  assert.equal(C1.raroOuUnico, PR1.raroOuUnico);
  assert.deepEqual([{ raridade: 'raro' }, { raridade: 'unico' }, { boss: true }, { raridade: 'normal' }, null].map(C1.raroOuUnico), [true, true, true, false, false]);
});
