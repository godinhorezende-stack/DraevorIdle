// (R3, decisões do dono 27/10) O Conjurar ao Perder Salvaguarda "não se aplica" (o jogo não tem Salvaguarda); o Devorar Maior como o PoB (a alma do Comedor de Almas pelo
// Poder do morto); as torres da Torre Óssea são obstáculo no passo dos monstros; a Tormenta do Vazio explode quando VOCÊ entra nela (revoga a decisão de 19/10).
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
const ModsPoe = await import('../systems/itens-poe/condicoes-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const { moverMonstros, torresNoCaminho } = await import('../systems/hunt/monstros.mjs');

const PERSONAGEM = { nome: 'T' };
function travado(v, fn) {
  const antes = Math.random;
  Math.random = typeof v === 'function' ? v : () => v;
  try { return fn(); } finally { Math.random = antes; }
}

/** O personagem com a arma, a ativa e os suportes ligados, numa caçada; os monstros nas casas `onde` (deslocamentos de você, imortais), o resto longe. */
async function montar(arma, ativa, { suportes = [], onde = [[1, 0]], nivel = 3 } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const n = 1 + suportes.length;
  a.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = [ativa, ...suportes].map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: G.doSlug(s) ? 20 : nivel, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(ativa).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  const ms = e.hunt.monstros;
  ms.forEach((m, i) => Object.assign(m, i < onde.length ? { x: e.hunt.pos.x + onde[i][0], y: e.hunt.pos.y + onde[i][1], hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {} } : { x: e.hunt.pos.x + 60 + i, y: e.hunt.pos.y + 60 }));
  return { e, bs: ms.slice(0, onde.length) };
}
const daFonte = (ev, fonte) => ev.filter((x) => x.t === 'dmg' && x.fonte === fonte);

// ---------------------------------------------------------------- 1. o Conjurar ao Perder Salvaguarda

test('R3: o Conjurar ao Perder Salvaguarda não se aplica (o jogo não tem Salvaguarda) — sem efeito, com a nota do aval', { skip: SEM }, () => {
  const r = SP.doSlug('Cast_on_Ward_Break_Support');
  assert.equal(r.status, 'nao');
  assert.match(r.naoSeAplica, /^não se aplica: .*Salvaguarda.*aval do dono 27\/10/);
  assert.deepEqual(r.motivos, [r.naoSeAplica]);
  assert.equal(SP.NAO_SE_APLICA.Cast_on_Ward_Break_Support, r.naoSeAplica);
});

// ---------------------------------------------------------------- 2. o Devorar Maior

test('R3: o Devorar Maior — a chance por poder do nível e da qualidade; o Poder do morto pela raridade', { skip: SEM }, () => {
  assert.equal(SP.efeitoNoNivel('Greater_Devour_Support', 1, 0).efeito.almaPorPoderPct, 2);
  assert.equal(SP.efeitoNoNivel('Greater_Devour_Support', 3, 0).efeito.almaPorPoderPct, 4);
  assert.equal(SP.efeitoNoNivel('Greater_Devour_Support', 3, 20).efeito.almaPorPoderPct, 5, 'a qualidade 20: +1%');
  assert.deepEqual(SP.doSlug('Greater_Devour_Support').status, 'funciona');
  assert.deepEqual(['normal', 'magico', 'raro', 'unico'].map((raridade) => ModsPoe.poderDoMorto({ raridade })), [1, 2, 10, 20]);
  assert.equal(ModsPoe.poderDoMorto({ boss: true }), 20);
  assert.equal(ModsPoe.poderDoMorto({}), 1);
});

test('R3: o Devorar Maior — consumir o cadáver dá a alma do Comedor de Almas pela chance × o Poder; +5% de velocidade por alma, até 45, perde 1 a cada 0,5 s', { skip: SEM }, async () => {
  const { e } = await montar('Two_Hand_Maces/Driftwood_Maul', 'Heavy_Strike', { suportes: ['Greater_Devour_Support'] });
  const h = e.hunt;
  const ef = { devorarVida: 10, devorarMana: 1, almaPorPoderPct: 4 };
  const morto = (raridade) => ({ uid: `m-${raridade}-${Math.random()}`, hp: 0, maxHp: 10, x: h.pos.x + 1, y: h.pos.y, raridade });
  const antes = ModsPoe.adds(e) ?? {};
  // o Normal (Poder 1): 4% — o sorteio de 0,39 (39) não passa
  Acoes.abatesDoSuporteS1(e, h, PERSONAGEM, ef, [morto('normal')], [], () => 0.39);
  assert.equal(ModsPoe.almasDoJogador(h), 0);
  // o Raro (Poder 10): 40% — passa
  Acoes.abatesDoSuporteS1(e, h, PERSONAGEM, ef, [morto('raro')], [], () => 0.39);
  assert.equal(ModsPoe.almasDoJogador(h), 1);
  const depois = ModsPoe.adds(e) ?? {};
  assert.equal((depois.atk_speed ?? 0) - (antes.atk_speed ?? 0), 5, 'Velocidade de Ataque +5%');
  assert.equal((depois.cast_speed ?? 0) - (antes.cast_speed ?? 0), 5, 'Velocidade de Conjuração +5%');
  // sem a linha do Devorar Maior, não ganha
  Acoes.abatesDoSuporteS1(e, h, PERSONAGEM, { devorarVida: 10 }, [morto('unico')], [], () => 0);
  assert.equal(ModsPoe.almasDoJogador(h), 1);
  // o teto de 45
  h.poeAlmas = { n: 45, em: h.clock, vistas: 45 };
  ModsPoe.almaDoJogador(h);
  assert.equal(ModsPoe.almasDoJogador(h), 45);
  // sem alma nova Recentemente (4 s), perde 1 a cada 0,5 s; o tique tira a velocidade da ficha
  h.clock += ModsPoe.RECENTE_MS + 1000;
  assert.equal(ModsPoe.almasDoJogador(h), 43);
  delete h.poeFichaMudou;
  ModsPoe.tique(e, h, Ficha.combate(e), 100);
  assert.ok(h.poeFichaMudou, 'a ficha é refeita quando as almas caem');
  h.clock += 60_000;
  ModsPoe.tique(e, h, Ficha.combate(e), 100);
  assert.equal(h.poeAlmas, undefined, 'sem nenhuma, o registro sai');
});

// ---------------------------------------------------------------- 3. a Torre Óssea: as torres no passo dos monstros

function corredor() {
  const andavel = new Set();
  for (let x = 0; x <= 10; x++) andavel.add(`${x},5`);
  return { minX: 0, maxX: 10, minY: 5, maxY: 5, andavel };
}
function sala() {
  const andavel = new Set();
  for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) andavel.add(`${x},${y}`);
  return { minX: 0, maxX: 6, minY: 0, maxY: 6, andavel };
}
const bicho = (uid, x, y) => ({ uid, key: 'rat', x, y, dir: 2, hp: 100, maxHp: 100, perseguindo: true, proximoPasso: 0 });
const torre = (x, y, extra = {}) => ({ x, y, z: 0, ate: 9000, ...extra });

test('R3: a Torre Óssea — as torres vivas são obstáculo no passo dos monstros; a vencida e a de outro andar, não', () => {
  // o corredor fechado pela torre: o bicho não pisa nela nem passa
  const h = { pos: { x: 5, y: 5 }, clock: 1000, monstros: [bicho(1, 2, 5)], a2: { torres: [torre(3, 5)] } };
  moverMonstros(h, corredor(), 1000);
  assert.deepEqual([h.monstros[0].x, h.monstros[0].y], [2, 5], 'a torre fecha o corredor');
  // a torre vencida não bloqueia
  const v = { pos: { x: 5, y: 5 }, clock: 1000, monstros: [bicho(1, 2, 5)], a2: { torres: [torre(3, 5, { ate: 500 })] } };
  moverMonstros(v, corredor(), 1000);
  assert.equal(v.monstros[0].x, 3);
  // a de outro andar também não
  const z = { pos: { x: 5, y: 5 }, clock: 1000, z: 1, monstros: [bicho(1, 2, 5)], a2: { torres: [torre(3, 5)] } };
  moverMonstros(z, corredor(), 1000);
  assert.equal(z.monstros[0].x, 3);
  assert.equal(torresNoCaminho({ a2: { torres: [] } }, 0), null);
});

test('R3: a Torre Óssea — na sala, o bicho contorna a torre; quem já está numa casa de torre sai normalmente (ninguém fica preso)', () => {
  const h = { pos: { x: 3, y: 3 }, clock: 1000, monstros: [bicho(1, 0, 3)], a2: { torres: [torre(1, 3)] } };
  moverMonstros(h, sala(), 1000);
  const m = h.monstros[0];
  assert.notDeepEqual([m.x, m.y], [0, 3], 'andou');
  assert.notDeepEqual([m.x, m.y], [1, 3], 'sem pisar na torre');
  // o bicho em cima de uma torre (ela nasceu na casa dele): sai
  const p = { pos: { x: 5, y: 5 }, clock: 1000, monstros: [bicho(1, 2, 5)], a2: { torres: [torre(2, 5)] } };
  moverMonstros(p, corredor(), 1000);
  assert.equal(p.monstros[0].x, 3, 'saiu da casa da torre');
});

// ---------------------------------------------------------------- 4. a Tormenta do Vazio: explode quando você entra

test('R3: a Tormenta do Vazio — o inimigo dentro dela não a explode (fica Cego); você entrando, ela explode nos inimigos do raio', { skip: SEM }, async () => {
  const t = await montar('Bows/Crude_Bow', 'Rain_of_Arrows', { suportes: ['Voidstorm_Support'], onde: [[4, 0]] });
  const h = t.e.hunt;
  travado(0.999, () => Acoes.disparar(t.e, h, PERSONAGEM, 0, t.bs[0], { manual: true }));
  assert.equal(h.poeTormentas?.length, 1, 'a tormenta onde o ataque caiu (a mais de 3 m de você)');
  const st = h.poeTormentas[0];
  // no meio dos estágios: o inimigo nela não a explode — só fica Cego
  h.clock += 1000;
  const ev = [];
  travado(0.999, () => Acoes.tiqueDasPlantadas(t.e, h, PERSONAGEM, ev));
  assert.equal(daFonte(ev, 'tormenta-do-vazio').length, 0, 'o inimigo não a explode');
  assert.equal(h.poeTormentas?.length, 1);
  assert.ok(t.bs[0].estados.cego?.ate > h.clock, 'Cego dentro dela');
  assert.equal(Acoes.tormentaParaEntrar(t.e, h), null, 'ainda sem o estágio cheio');
  // o estágio cheio (10 em 2 s) com o inimigo dentro: o idle a vê para entrar
  h.clock += 1500;
  travado(0.999, () => Acoes.tiqueDasPlantadas(t.e, h, PERSONAGEM, []));
  assert.equal(Acoes.tormentaParaEntrar(t.e, h), st);
  // você entra no raio: explode, com o "+40% por estágio"
  h.pos = { ...h.pos, x: st.x - 1, y: st.y };
  const ev2 = [];
  travado(0.999, () => Acoes.tiqueDasPlantadas(t.e, h, PERSONAGEM, ev2));
  assert.ok(daFonte(ev2, 'tormenta-do-vazio').some((x) => x.uid === t.bs[0].uid && x.v > 0), 'explodiu no inimigo dentro dela');
  assert.equal(h.poeTormentas, undefined);
});

test('R3: a Tormenta do Vazio no idle — com a tormenta carregada perto e nada mais urgente, o personagem anda até ela e a explode', { skip: SEM }, async () => {
  const t = await montar('Bows/Crude_Bow', 'Rain_of_Arrows', { suportes: ['Voidstorm_Support'], onde: [[60, 60]] });
  const h = t.e.hunt;
  t.e.actions[0] = null;
  let agora = (h.ultimoTique ?? Date.now()) + 250;
  travado(0.999, () => Cacadas.tique(t.e, PERSONAGEM, agora));
  const grade = ModsPoe.gradeDoCombate(h);
  // uma casa andável a 3 casas de você, onde a tormenta já está no estágio cheio, com o inimigo (parado, Congelado) dentro
  let c = null;
  for (let dx = -3; dx <= 3 && !c; dx++) for (let dy = -3; dy <= 3 && !c; dy++) if (Math.max(Math.abs(dx), Math.abs(dy)) === 3 && grade.andavel.has(`${h.pos.x + dx},${h.pos.y + dy}`)) c = { x: h.pos.x + dx, y: h.pos.y + dy };
  assert.ok(c, 'uma casa andável a 3 casas');
  Object.assign(t.bs[0], { x: c.x, y: c.y, estados: { congelado: { ate: 1e15 } } });
  // (o arco parado a 3 casas do alvo — a "Distância" da barra: sem a tormenta, ele não sairia do lugar)
  h.distancia = 3;
  h.poeTormentas = [{ acao: G.doSlug('Rain_of_Arrows').acao, x: c.x, y: c.y, z: h.z ?? 0, desde: h.clock - 3000, ate: h.clock + 60_000, raioM: 1.8, danoPct: 148, incPct: 0, estagioMs: 200, estagiosMax: 10, areaPorEstagioPct: 15, danoPorEstagioPct: 40 }];
  assert.ok(Acoes.tormentaParaEntrar(t.e, h), 'a tormenta carregada');
  for (let i = 0; i < 40 && h.poeTormentas?.length; i++) { agora += 250; travado(0.999, () => Cacadas.tique(t.e, PERSONAGEM, agora)); }
  assert.equal(h.poeTormentas, undefined, 'entrou e explodiu');
  assert.ok(Math.max(Math.abs(h.pos.x - c.x), Math.abs(h.pos.y - c.y)) <= 2, 'andou até ela');
});
