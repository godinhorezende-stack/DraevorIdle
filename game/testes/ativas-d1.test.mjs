// (lote D1, 27/10) AS DECISÕES DO DONO sobre as parciais que sobraram dos lotes E2A e E2B, pelo PoE 1 (o PoB): os giros da Armadilha de Lâminas (1 acerto por giro em
// cada inimigo na área, 0,25 s por giro), o Carne e Pedra com os valores cheios (Sangue: mais Físico dos acertos nos inimigos da aura; Areia: menos dano dos acertos
// deles em você), o teto de +75% do passo dos Espectros e o "Minas não podem ser Re-armadas" da Mina de Fumaça (não se aplica). Os sorteios ficam travados.
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
const D1 = await import('../systems/itens-poe/gemas-d1.mjs');
const E2a = await import('../systems/itens-poe/gemas-e2a.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const Cond = await import('../systems/itens-poe/condicoes-poe.mjs');
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
async function montar(slugs, { nivel = 20, qualidade = 0, arma = 'Daggers/Sai', dx = 1, barra = null } = {}) {
  J ??= await import('../systems/itens-poe/jogo.mjs');
  gerarPeca ??= (await import('../systems/itens-poe/gerar.mjs')).gerarPeca;
  const lista = [slugs].flat();
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = peca(arma);
  a.soquetes = { abertos: lista.length, links: lista.slice(1).map(() => false), gemas: lista.map(() => null), cores: lista.map(() => 'W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  const itemDe = (s) => G.doSlug(s)?.itemId ?? [...GS.DEFS.values()].find((d) => d.poe?.slug === s)?.itemId;
  e.inventory = lista.map((s) => GS.itemDaGema({ id: itemDe(s), nivel, xp: 0, raridade: 'comum', qualidade }));
  for (let i = 0; i < lista.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  (barra ?? lista).forEach((s, i) => { if (G.doSlug(s)) e.actions[i] = { id: G.doSlug(s).acao, enabled: true, minMana: 0, conditions: [] }; });
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
const id = (slug) => G.doSlug(slug).acao;

test('D1: as gemas do lote ficam completas; os Espectros só com a limitação do idle; a Mina de Fumaça sem o "Re-armadas"', { skip: SEM }, () => {
  for (const s of ['Blade_Trap', 'Blade_Trap_of_Laceration', 'Flesh_and_Stone']) assert.deepEqual([G.doSlug(s)?.statusNoJogo, G.doSlug(s)?.motivosNoJogo], ['funciona', []], s);
  for (const s of ['Raise_Spectre', 'Raise_Spectre_of_Transience']) assert.ok(!G.doSlug(s).motivosNoJogo.some((m) => /no Máximo/.test(m)), `${s}: ${G.doSlug(s).motivosNoJogo.join(' | ')}`);
  const fumaca = G.doSlug('Smoke_Mine').motivosNoJogo;
  assert.ok(!fumaca.some((m) => /Re-armadas/.test(m)), fumaca.join(' | '));
  assert.ok(fumaca.some((m) => /Detonação da Mina é Instantânea/.test(m)), 'o resto da gema segue parcial');
  assert.match(G.linhasQueNaoSeAplicam(['Minas não podem ser Re-armadas'])[0], /^não se aplica: .*Re-armar/);
});

test('D1: a Armadilha de Lâminas — 4 giros (+1 na qualidade 20, + 1 em Empunhadura Dupla), 0,25 s por giro (÷ 1,25 em Empunhadura Dupla); a Laceração, 1 giro', { skip: SEM }, () => {
  assert.deepEqual(G.girosDaGema('Blade_Trap', 20, 0), { giros: 4, chanceDeMais: 0, intervaloMs: 250 });
  assert.deepEqual(G.girosDaGema('Blade_Trap', 20, 20), { giros: 5, chanceDeMais: 0, intervaloMs: 250 });
  const q10 = G.girosDaGema('Blade_Trap', 20, 10);
  assert.equal(q10.giros, 4);
  assert.ok(Math.abs(q10.chanceDeMais - 0.5) < 1e-9, 'a meia volta da qualidade 10: 50% de um giro a mais');
  assert.equal(D1.girosNaAtivacao(q10, () => 0.49), 5);
  assert.equal(D1.girosNaAtivacao(q10, () => 0.5), 4);
  assert.deepEqual(G.girosDaGema('Blade_Trap', 20, 0, true), { giros: 5, chanceDeMais: 0, intervaloMs: 200 });
  assert.deepEqual(G.girosDaGema('Blade_Trap_of_Laceration', 20, 20, true), { giros: 1, chanceDeMais: 0, intervaloMs: 250 });
  assert.equal(D1.duracaoDaQualidadeMs('Blade_Trap', 20), 1000);
  assert.equal(D1.duracaoDaQualidadeMs('Blade_Trap_of_Laceration', 20), 0);
});

test('D1: a Armadilha de Lâminas ativada — gira 4 vezes, um acerto por giro em cada inimigo na área (o alvo e o vizinho), nenhum fora dela', { skip: SEM }, async () => {
  const { e, b, resto } = await montar('Blade_Trap');
  const vizinho = Object.assign(resto[0], { x: b.x, y: b.y + 1, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [], armaduraPct: -100, evasao: 0 });
  const longe = Object.assign(resto[1], { x: b.x + 6, y: b.y, hp: 1e12, maxHp: 1e12, estados: {}, resist: {}, dots: [] });
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.equal(golpesEm(r.eventos, b).length, 0, 'a ativação não acerta: o primeiro giro termina 0,25 s depois');
  const t = e.hunt.poeTorres?.find((x) => x.girosD1);
  assert.ok(t, 'a Armadilha que gira');
  assert.equal(t.intervaloMs, 250);
  assert.equal(Math.round((t.ate - e.hunt.clock) / t.intervaloMs), 4);
  e.hunt.clock = t.proxima;
  const um = travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock));
  assert.equal(golpesEm(um, b).length, 1, 'um giro: um acerto no alvo');
  assert.equal(golpesEm(um, vizinho).length, 1, 'e um no vizinho dentro da área');
  e.hunt.clock = t.ate + 10;
  const resto3 = travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock));
  assert.equal(golpesEm(resto3, b).length, 3, 'os outros 3 giros');
  assert.equal(golpesEm([...um, ...resto3], longe).length, 0, 'fora da área, nenhum');
  assert.ok(!(e.hunt.poeTorres ?? []).some((x) => x.girosD1), 'acabou');
});

test('D1: a Laceração gira 1 vez; a qualidade 20 da base: 5 giros e a Armadilha dura 5 s', { skip: SEM }, async () => {
  const { e, b } = await montar('Blade_Trap_of_Laceration');
  assert.ok(usar(e, b).ok);
  const t = e.hunt.poeTorres?.find((x) => x.girosD1);
  assert.equal(Math.round((t.ate - e.hunt.clock) / t.intervaloMs), 1);
  e.hunt.clock = t.ate + 10;
  assert.equal(golpesEm(travado(0.5, () => Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock)), b).length, 1);
  // a duração da Armadilha plantada que ninguém ativa (o alvo é um boneco — `dummy` não ativa Armadilhas): 4 s na qualidade 0, 5 s na 20
  for (const [q, s] of [[0, 4000], [20, 5000]]) {
    const m = await montar('Blade_Trap', { qualidade: q });
    m.b.dummy = true;
    assert.ok(usar(m.e, m.b).ok);
    const p = (m.e.hunt.plantadas ?? []).find((x) => x.acao === id('Blade_Trap'));
    assert.ok(p, `qualidade ${q}: plantada`);
    const inc = Number(Ficha.combate(m.e).afPoe?.duracao_armadilha) || 0;
    assert.equal(p.ate - p.desde, Math.round(s * Math.max(0.1, 1 + inc / 100)), `qualidade ${q}`);
  }
});

test('D1: o Carne e Pedra — os valores cheios (20% e 19% no nível 20), a Postura de Sangue marca os inimigos na aura com o Físico dos acertos a mais', { skip: SEM }, async () => {
  assert.deepEqual(G.carneEPedraDaGema('Flesh_and_Stone', 20), { sanguePct: 20, areiaPct: 19 });
  assert.deepEqual(G.carneEPedraDaGema('Flesh_and_Stone', 1), { sanguePct: 10, areiaPct: 10 });
  const { e, b, resto } = await montar('Flesh_and_Stone', { arma: 'Wands/Driftwood_Wand' });
  const longe = Object.assign(resto[0], { x: e.hunt.pos.x + 8, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {} });
  assert.ok(usar(e, b).ok);
  const buff = e.hunt.buffs[id('Flesh_and_Stone')];
  assert.ok(buff?.ate > e.hunt.clock, 'ligada');
  assert.equal(buff.postura, 'sangue', 'liga na Postura de Sangue');
  assert.equal(Cond.posturaDe(e.hunt), 'sangue');
  Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.deepEqual(b.estados.carneEPedraD1, { ate: e.hunt.clock + 500, sanguePct: 20 });
  assert.equal(longe.estados.carneEPedraD1, undefined, 'fora da aura, não');
  const f = Ficha.combate(e);
  assert.ok(Math.abs(Cond.fatorRecebidoPeloBicho(b, 'physical', f, e.hunt.clock) / Cond.fatorRecebidoPeloBicho(longe, 'physical', f, e.hunt.clock) - 1.2) < 1e-9, 'o Físico: 20% mais');
  assert.equal(Cond.fatorRecebidoPeloBicho(b, 'fire', f, e.hunt.clock), Cond.fatorRecebidoPeloBicho(longe, 'fire', f, e.hunt.clock), 'o Fogo, não');
  assert.equal(Cond.doBicho(b, e.hunt.clock, { ficha: f }).danoFator, 1, 'na de Sangue, o dano dele em você não muda');
  // a marca dura o tique: sem renovar, acaba
  assert.equal(Cond.fatorRecebidoPeloBicho(b, 'physical', f, e.hunt.clock + 600), Cond.fatorRecebidoPeloBicho(longe, 'physical', f, e.hunt.clock + 600));
});

test('D1: o Carne e Pedra — usar de novo troca para a Postura da Areia: você sofre 19% menos dos acertos dos inimigos na aura (o lacaio, não)', { skip: SEM }, async () => {
  const { e, b } = await montar('Flesh_and_Stone', { arma: 'Wands/Driftwood_Wand' });
  assert.ok(usar(e, b).ok);
  e.hunt.clock += 3000;
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.equal(r.postura, 'areia');
  assert.equal(Cond.posturaDe(e.hunt), 'areia');
  Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, [], e.hunt.clock);
  assert.deepEqual(b.estados.carneEPedraD1, { ate: e.hunt.clock + 500, areiaPct: 19 });
  const f = Ficha.combate(e);
  assert.ok(Math.abs(Cond.doBicho(b, e.hunt.clock, { ficha: f }).danoFator - 0.81) < 1e-9, 'o golpe dele em você: 19% menos');
  assert.equal(Cond.doBicho(b, e.hunt.clock, { contraOutro: true }).danoFator, 1, 'no lacaio, não');
  assert.equal(Cond.fatorRecebidoPeloBicho(b, 'physical', f, e.hunt.clock), Cond.fatorRecebidoPeloBicho({ ...b, estados: {} }, 'physical', f, e.hunt.clock), 'na da Areia, o Físico dele não muda');
});

test('D1: o Carne e Pedra e o Sangue e Areia ficam na mesma Postura (trocar numa troca a outra; ligar começa na Postura em que você está)', { skip: SEM }, async () => {
  const { e, b } = await montar(['Blood_and_Sand', 'Flesh_and_Stone'], { arma: 'Wands/Driftwood_Wand' });
  assert.ok(usar(e, b, 0).ok);
  e.hunt.clock += 3000;
  assert.equal(usar(e, b, 0).postura, 'areia');
  e.hunt.clock += 3000;
  assert.ok(usar(e, b, 1).ok);
  assert.equal(e.hunt.buffs[id('Flesh_and_Stone')].postura, 'areia', 'liga na Postura em que você está');
  e.hunt.clock += 3000;
  assert.equal(usar(e, b, 1).postura, 'sangue');
  assert.equal(e.hunt.buffs[id('Blood_and_Sand')].postura, 'sangue', 'a outra troca junto');
  assert.equal(Cond.posturaDe(e.hunt), 'sangue');
});

test('D1: os Espectros — "Velocidade de Movimento dos Lacaios está no Máximo": o teto de +75% no aumento total do passo (128 − 53 do PoB)', { skip: SEM }, () => {
  assert.equal(E2a.ESPECTRO.movTetoPct, 75);
  const linhas = G.textosDaGema('Raise_Spectre', 20).linhas;
  const d = E2a.doLacaioE2a('Raise_Spectre', linhas, [], 20);
  assert.equal(d.movTetoPct, 75);
  assert.equal(d.movMaisPct, 55);
  assert.equal(E2a.doLacaioE2a('Raise_Spectre_of_Transience', G.textosDaGema('Raise_Spectre_of_Transience', 20).linhas, [], 20).movTetoPct, 75);
  // hoje (+55% mais, sem aumento): abaixo do teto
  assert.ok(Math.abs(LacaiosPoe.movimentoDoLacaio({ poe: { movimentoPct: 0, movMaisPct: 55, movTetoPct: 75 } }, 0) - 55) < 1e-9);
  // com +20% da árvore: (1,2 × 1,55 − 1) = 86% → 75%
  assert.equal(LacaiosPoe.movimentoDoLacaio({ poe: { movimentoPct: 20, movMaisPct: 55, movTetoPct: 75 } }, 0), 75);
  // +10%: 70,5%, abaixo
  assert.ok(Math.abs(LacaiosPoe.movimentoDoLacaio({ poe: { movimentoPct: 10, movMaisPct: 55, movTetoPct: 75 } }, 0) - 70.5) < 1e-9);
  // sem o teto (outro lacaio), segue
  assert.ok(Math.abs(LacaiosPoe.movimentoDoLacaio({ poe: { movimentoPct: 20, movMaisPct: 55 } }, 0) - 86) < 1e-9);
});
