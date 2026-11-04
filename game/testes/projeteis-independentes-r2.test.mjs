// OS PROJÉTEIS INDEPENDENTES, RODADA 2 (03/11 — a revisão do commit e25c380f do voo de verdade). Cada projétil do uso voa e cai no tempo DELE, e cada inimigo leva no
// máximo o que o PoE daria:
//   1 — o primeiro acerto de cada projétil a mais é "no primeiro do caminho que nenhum outro do uso acertou" (D7b) também com os projéteis independentes: o bicho do
//       caminho do principal que ainda voa fica reservado para ele (não o alvo mirado), e o conflito que sobra se resolve no instante do acerto;
//   2 — a separação vale em TODA geometria (as origens laterais da Saraivada, a Barragem…): o principal perdido não faz os a mais errarem, e eles caem no tempo deles;
//   3 — as repetições do uso (o Eco de Magia): os a mais de cada repetição saem no uso, no tempo deles;
//   4 — o voo das habilidades de recarga dos lacaios (o Orbe da Tempestade) com a Velocidade de Projétil dos suportes da gema que os invocou;
//   5 — o voo do lacaio só no golpe de longe, guardado por lacaio/gema (refeito quando as gemas mudam).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no modo PoE, com o catálogo do PoE';
const Voos = await import('../systems/hunt/voos.mjs');
const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
const Acoes = await import('../systems/acoes.mjs');
const GS = await import('../systems/skills/gemas.mjs');
const G = await import('../systems/itens-poe/gemas-poe.mjs');
const SP = await import('../systems/itens-poe/suportes-poe.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');
const ModsPoe = await import('../systems/itens-poe/mods-poe.mjs');
const Secundarios = await import('../systems/skills/golpes-secundarios.mjs');
const LacaiosPoe = await import('../systems/itens-poe/lacaios-poe.mjs');
const Terreno = await import('../systems/hunt/terreno.mjs');
const Areas = await import('../engine/areas.mjs');
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const sorte = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } };

/** O personagem com a arma e a ativa (nível 20), numa caçada; os bichos em `posicoes` ([dx, dy] de você), imortais (o mesmo de `projeteis-independentes`). */
async function montar(arma, ativa, suportes = [], posicoes = [[1, 0]]) {
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 90 }), { classePoe: 'Scion', sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  const n = 1 + suportes.length;
  a.soquetes = { abertos: n, links: Array.from({ length: n - 1 }, () => true), gemas: Array(n).fill(null), cores: Array(n).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = [ativa, ...suportes].map((s) => GS.itemDaGema({ id: (G.doSlug(s) ?? SP.doSlug(s)).itemId, nivel: 20, xp: 0, raridade: 'comum' }));
  for (let i = 0; i < n; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(ativa).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(sorte(0.999, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e7;
  e.maxHp = e.hp = 1e7;
  ModsPoe.definirGradeDoCombate(e.hunt, () => null);
  const modelo = structuredClone(e.hunt.monstros[0]);
  e.hunt.monstros.forEach((m, i) => {
    const p = posicoes[i];
    if (!p) return Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
    const uid = m.uid;
    for (const k of Object.keys(m)) delete m[k];
    Object.assign(m, structuredClone(modelo), { uid, x: e.hunt.pos.x + p[0], y: e.hunt.pos.y + p[1], hp: 1e12, maxHp: 1e12, estados: {}, dots: [], resist: {}, mods: [], raridade: 'normal' });
  });
  e.hunt.cadaveres = [];
  return { e, bichos: e.hunt.monstros.slice(0, posicoes.length) };
}
/** Um uso no `alvo` com o sorteio fixo: os eventos do uso. */
function usar(e, alvo, v = 0.5) {
  e.hunt.clock += 10_000;
  const eventos = [];
  sorte(v, () => {
    const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, alvo, { manual: true });
    assert.ok(r.ok, r.erro);
    eventos.push(...(r.eventos ?? []));
    if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])); }
  });
  return eventos;
}
/** Os tiques do que está no ar, de 250 em 250 ms a partir de agora: `[{ ms, eventos }]`. */
function tiques(e, n = 10, v = 0.5) {
  const t0 = e.hunt.clock;
  const saida = [];
  for (let k = 1; k <= n; k++) { e.hunt.clock = t0 + 250 * k; saida.push({ ms: 250 * k, eventos: sorte(v, () => Voos.tique(e.hunt, e.hunt.clock)) }); }
  return saida;
}
const acertosEm = (ev, b) => ev.filter((x) => x.t === 'dmg' && x.foe && x.uid === b.uid);
/** Os instantes (ms depois do uso; 0 = no uso) de CADA acerto em `b`. */
const acertos = (ev0, ts, b) => [...acertosEm(ev0, b).map(() => 0), ...ts.flatMap((t) => acertosEm(t.eventos, b).map(() => t.ms))];
/** A 1ª casa (a `n` casas de você, Chebyshev) do projétil a mais do leque a `graus` do rumo leste (D7b de `projeteis-voo.mjs`) fora da reta leste. */
function casaDoLeque(n, graus = 10) {
  const a = (graus * Math.PI) / 180;
  const fim = { x: Math.round(Math.cos(a) * 7), y: Math.round(Math.sin(a) * 7) };
  const c = Areas.reta({ x: 0, y: 0 }, fim, 7).find((q) => Math.max(Math.abs(q.x), Math.abs(q.y)) >= n && q.y !== 0);
  return [c.x, c.y];
}
const tirosDe = (ev, e) => ev.filter((x) => x.t === 'shot').map((x) => `${x.x - e.hunt.pos.x},${x.y - e.hunt.pos.y}>${x.tx - e.hunt.pos.x},${x.ty - e.hunt.pos.y}`);

// ---------------------------------------------------------------- 1: cada inimigo leva no máximo o que o PoE daria (D7b com os projéteis independentes)

test('1 — o bicho que entrou na frente do principal leva SÓ o principal (as Facas Etéreas: o alvo a 6 casas, o da frente a 2): antes, também um projétil a mais', { skip: SEM }, async () => {
  const { e, bichos: [alvo, frente] } = await montar('Wands/Driftwood_Wand', 'Ethereal_Knives', [], [[6, 0], [2, 0]]);
  const ev = usar(e, alvo);
  const ts = tiques(e, 10);
  // o principal: 1,5 casa a 5,2 c/s = 288 ms → o tique de 250 (antes: [250, 500] — o 1º a mais, a ±10°, passava pela casa (2, 0) e o pegava também)
  assert.deepEqual(acertos(ev, ts, frente), [250]);
  assert.deepEqual(acertos(ev, ts, alvo), [], 'o principal parou no da frente; nenhum a mais vai no alvo');
});

test('1 — o alvo mirado não fica reservado quando o principal não chega nele: o a mais passa pelo da frente (reservado) e pega quem está atrás, no tempo dele', { skip: SEM }, async () => {
  const { e, bichos: [alvo, frente, atras] } = await montar('Wands/Driftwood_Wand', 'Ethereal_Knives', [], [[6, 0], [2, 0], [3, 0]]);
  const ev = usar(e, alvo);
  const ts = tiques(e, 10);
  assert.deepEqual(acertos(ev, ts, frente), [250], 'o da frente: só o principal');
  // o de trás (3, 0): o 1º a mais (a reta de 10°: (1,0) (2,0) (3,0) (4,1)…) — 2,5 casas a 5,2 c/s = 481 ms → o tique de 500
  assert.deepEqual(acertos(ev, ts, atras), [500]);
  assert.deepEqual(acertos(ev, ts, alvo), []);
});

test('1 — o conflito no INSTANTE do acerto: o bicho do leque que entra na reta do principal leva o principal; o a mais que chega depois nele não acerta (1 acerto, não 2)', { skip: SEM }, async () => {
  const [dx, dy] = casaDoLeque(4, 10);
  const { e, bichos: [alvo, b] } = await montar('Wands/Driftwood_Wand', 'Ethereal_Knives', [], [[6, 0], [dx, dy]]);
  const ev = usar(e, alvo);
  // depois do uso, ele anda 1 casa (para (3, 0)): o principal o encontra a 2,5 casas (481 ms → 500); o a mais dele, mirado em (4, 1), chegaria aos 793 ms (750) — a
  // 1 casa de onde estava, ainda "lá"
  Object.assign(b, { x: e.hunt.pos.x + 3, y: e.hunt.pos.y });
  const ts = tiques(e, 10);
  assert.deepEqual(acertos(ev, ts, b), [500], 'só o principal: o a mais que chega depois no mesmo bicho não acerta');
  assert.deepEqual(acertos(ev, ts, alvo), []);
});

test('1 — o resolvedor: no passe dos a mais, fora fica o bicho reservado (`reservados`), não o alvo; o 1º acerto deles leva `exclusivo` e a marca do projétil', () => {
  const TAGS = ['projectile', 'single', 'hit'];
  const b = (uid, x, y) => ({ uid, x, y, hp: 100 });
  const alvo = b('a', 6, 0);
  const frente = b('f', 2, 0);
  const atras = b('t', 3, 0);
  const r = Secundarios.resolver({ efeito: { alvosExtras: 2 }, tags: TAGS, origem: { x: 0, y: 0 }, alvo, atingidos: [], vivos: [alvo, frente, atras], alcance: 7, rng: () => 0.5, voo: true, parte: 'extras', reservados: [frente] });
  const primeiros = r.golpes.filter((g) => g.tipo === 'projetil');
  assert.deepEqual(primeiros.map((g) => g.bicho.uid), ['t'], 'o reservado fica fora; o de trás leva');
  assert.ok(primeiros.every((g) => g.exclusivo && g.projDoUso >= 1), 'o 1º acerto exclusivo, com a marca do projétil (a ordem — o principal é a 0)');
  // sem `reservados` (o passe de antes): o alvo e os atingidos ficam fora, como antes — e o da frente leva o 1º a mais (o principal também o pegaria)
  const antes = Secundarios.resolver({ efeito: { alvosExtras: 2 }, tags: TAGS, origem: { x: 0, y: 0 }, alvo, atingidos: [], vivos: [alvo, frente, atras], alcance: 7, rng: () => 0.5, voo: true, parte: 'extras' });
  assert.deepEqual(antes.golpes.filter((g) => g.tipo === 'projetil').map((g) => g.bicho.uid), ['f', 't']);
});

// ---------------------------------------------------------------- 2: toda geometria — o principal perdido não leva os a mais; cada um no caminho e no tempo dele

test('2 — a Flecha Dividida com a Saraivada (origens laterais): o alvo sai da reta, o bicho na reta lateral (4, 1) é acertado assim mesmo; o tiro lateral sai no uso', { skip: SEM }, async () => {
  const { e, bichos: [alvo, b] } = await montar('Bows/Crude_Bow', 'Split_Arrow', ['Volley_Support'], [[6, 0], [4, 1]]);
  assert.ok(GS.efeitoNaSkill(e, e.actions[0].id)?.origensLaterais > 0, 'a Saraivada dá as origens laterais');
  const ev = usar(e, alvo);
  assert.ok(tirosDe(ev, e).includes('0,1>4,1'), `o tiro da origem lateral (0, 1) sai no uso (${tirosDe(ev, e).join(' ')})`);
  alvo.y -= 5;
  const ts = tiques(e, 10);
  // (antes: hits = [] — o principal perdido fazia todos os a mais errarem, e eles só saíam no contato)
  assert.equal(acertos(ev, ts, b).length, 1);
  assert.deepEqual(acertos(ev, ts, alvo), []);
});

test('2 — a Barragem (a sequência): o alvo sai da reta; o a mais no outro bicho (4, 1) acerta; os da sequência vão aonde o alvo estava e erram', { skip: SEM }, async () => {
  const { e, bichos: [alvo, b] } = await montar('Bows/Crude_Bow', 'Barrage', [], [[6, 0], [4, 1]]);
  const ev = usar(e, alvo);
  alvo.y -= 5;
  const ts = tiques(e, 10);
  assert.equal(acertos(ev, ts, b).length, 1);
  assert.deepEqual(acertos(ev, ts, alvo), []);
});

test('2 — o a mais das origens laterais cai no tempo DELE: as Facas Etéreas com a Saraivada, o bicho em (3, 1) leva aos 500 ms; o alvo a 6 casas, aos 1000', { skip: SEM }, async () => {
  const { e, bichos: [alvo, b] } = await montar('Wands/Driftwood_Wand', 'Ethereal_Knives', ['Volley_Support'], [[6, 0], [3, 1]]);
  const ev = usar(e, alvo);
  const ts = tiques(e, 10);
  // (de (0, 1): 2,5 casas a 5,2 c/s = 481 ms → o tique de 500; antes caía com o principal, aos 1000)
  assert.deepEqual(acertos(ev, ts, b), [500]);
  assert.deepEqual(acertos(ev, ts, alvo), [1000]);
});

test('2 — o resolvedor com o principal perdido nas origens laterais e na sequência: cada a mais acerta quem está no caminho dele (antes: todos erravam)', () => {
  const b = (uid, x, y) => ({ uid, x, y, hp: 100 });
  const lateral = b('l', 4, 1);
  const r = Secundarios.resolver({ efeito: { alvosExtras: 2, origensLaterais: 2 }, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo: null, atingidos: [], vivos: [lateral], alcance: 7, rumo: { x: 6, y: 0 }, rng: () => 0.5, voo: true });
  assert.deepEqual(r.golpes.filter((g) => g.tipo === 'projetil').map((g) => g.bicho.uid), ['l']);
  // a sequência: o que sobra vai na direção do rumo (o primeiro do caminho); sem ninguém, erra no leque — nunca para trás
  const naReta = b('r', 5, 0);
  const atras = b('t', -3, 0);
  const s = Secundarios.resolver({ efeito: { alvosExtras: 8, sequencia: true, semPropagar: true }, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo: null, atingidos: [], vivos: [naReta, atras], alcance: 7, rumo: { x: 6, y: 0 }, rng: () => 0.5, voo: true });
  assert.equal(s.golpes.filter((g) => g.tipo === 'projetil' && g.bicho === naReta).length, 8, 'os 8 da barragem na reta');
  assert.ok(!s.golpes.some((g) => g.bicho === atras), 'nenhum para trás');
  // no modo clássico (sem o voo), como antes
  const c = Secundarios.resolver({ efeito: { alvosExtras: 2, origensLaterais: 2 }, tags: ['projectile', 'hit'], origem: { x: 0, y: 0 }, alvo: null, atingidos: [], vivos: [lateral], alcance: 7, rumo: { x: 6, y: 0 }, rng: () => 0.5 });
  assert.equal(c.golpes.length, 0);
});

// ---------------------------------------------------------------- 3: as repetições do uso

test('3 — o Eco de Magia: os a mais da repetição saem no USO e caem no tempo deles (o bicho do leque leva os dois aos 750 ms; antes, o da repetição no contato, aos 1000)', { skip: SEM }, async () => {
  const [dx, dy] = casaDoLeque(4, 10);
  const { e, bichos: [alvo, b] } = await montar('Wands/Driftwood_Wand', 'Ethereal_Knives', ['Spell_Echo_Support'], [[6, 0], [dx, dy]]);
  const ev = usar(e, alvo);
  const ts = tiques(e, 10);
  assert.deepEqual(acertos(ev, ts, b), [750, 750]);
  assert.deepEqual(acertos(ev, ts, alvo), [1000, 1000], 'o principal e o da repetição, no contato');
  assert.equal(ts.flatMap((t) => t.eventos.filter((x) => x.t === 'shot')).length, 0, 'nenhum tiro sai no contato: todos no uso');
});

// ---------------------------------------------------------------- 4 e 5: o voo dos lacaios

/** O Golem de Relâmpago (com os suportes na gema) ao lado de você e o bicho a 4 casas dele: os instantes dos acertos do Orbe da Tempestade (a habilidade de recarga). */
async function orbeDoGolem(suportes) {
  const { e, bichos: [b] } = await montar('Wands/Driftwood_Wand', 'Summon_Lightning_Golem', suportes, [[5, 0]]);
  const q = LacaiosPoe.oQueInvoca('Summon_Lightning_Golem', 20, null, {});
  assert.ok(q.recargas?.some((h) => h.tipo === 'magia'), 'o Orbe da Tempestade');
  const h = e.hunt;
  const l = { ...q, recargas: q.recargas.map((x) => ({ ...x })), acao: G.doSlug('Summon_Lightning_Golem').acao, uid: 'g1', tipo: 'lacaio', x: h.pos.x + 1, y: h.pos.y, hp: q.vida, maxHp: q.vida, proximoGolpe: 1e15, alcanceDeAtaque: 8, perto: 20 };
  h.lacaios = [l];
  const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);
  const ev = sorte(0.5, () => Cacadas.tiqueDosLacaios(e, h, null, grade, h.clock));
  return acertos(ev, tiques(e, 8), b);
}

test('4 — o Orbe da Tempestade do golem voa com a Velocidade de Projétil dos suportes da gema que o invocou (o Projéteis Mais Rápidos): 500 ms, não os 750 da D1', { skip: SEM }, async () => {
  // (3,5 casas: a 5,2 c/s — a magia da D1 — 673 ms → o tique de 750; com o suporte, mais rápido)
  assert.deepEqual(await orbeDoGolem([]), [750]);
  assert.deepEqual(await orbeDoGolem(['Faster_Projectiles_Support']), [500]);
});

test('5 — o voo do lacaio é guardado por lacaio/gema (o mesmo objeto no 2º golpe) e refeito quando as gemas mudam (a ficha nova)', { skip: SEM }, async () => {
  const { e } = await montar('Wands/Driftwood_Wand', 'Raise_Spectre', [], [[3, 0]]);
  const l = { acao: G.doSlug('Raise_Spectre').acao, x: 0, y: 0 };
  Ficha.combate(e);
  const v1 = Acoes.vooDoLacaio(e, l, { magia: true });
  assert.equal(Acoes.vooDoLacaio(e, l, { magia: true }), v1, 'guardado');
  assert.equal(Acoes.voosDoLacaioGuardados(e), 1);
  // trocar as gemas: a ficha é refeita (`Ficha.invalidar`) — e o voo, com o suporte novo
  const com = await montar('Wands/Driftwood_Wand', 'Raise_Spectre', ['Faster_Projectiles_Support'], [[3, 0]]);
  e.equipment = com.e.equipment;
  e.inventory = [];
  Ficha.invalidar(e);
  Ficha.combate(e);
  assert.equal(Acoes.voosDoLacaioGuardados(e), 0, 'a ficha nova começa sem nada guardado');
  const v2 = Acoes.vooDoLacaio(e, l, { magia: true });
  assert.ok(v2.v0 > v1.v0, `o suporte novo vale (${v1.v0} → ${v2.v0})`);
});

test('5 — o golpe de PERTO do lacaio não calcula o voo (nada guardado); o de longe, sim', { skip: SEM }, async () => {
  const rodar = (alcance) => {
    const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { sistema: 'poe', classePoe: 'Witch' });
    assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
    const h = e.hunt;
    h.clock = 100_000;
    Object.assign(e, { hp: 1e6, maxHp: 1e6 });
    const [alvo, ...outros] = h.monstros;
    for (const o of outros) Object.assign(o, { x: h.pos.x + 60, y: h.pos.y + 60 });
    const q = LacaiosPoe.oQueInvoca('Raise_Zombie', 10, null, {});
    const l = { ...q, habPob: null, recargas: [], uid: 'l1', tipo: 'lacaio', acao: G.doSlug('Raise_Zombie').acao, x: h.pos.x + 1, y: h.pos.y, hp: q.vida, maxHp: q.vida, proximoGolpe: 0, alcanceDeAtaque: alcance, perto: 8 };
    Object.assign(alvo, { x: l.x + 1, y: l.y, hp: 1e9, maxHp: 1e9 });
    h.alvo = alvo.uid;
    h.lacaios = [l];
    Ficha.combate(e);
    const grade = Cacadas.andarDaGrade(Cacadas.gradeDaHunt(Terreno.huntOuMapaCustom(h.huntId)), h.z);
    sorte(0.99, () => Cacadas.tiqueDosLacaios(e, h, null, grade, Date.now()));
    return { e, alvo };
  };
  const perto = rodar(1);
  assert.ok(perto.alvo.hp < 1e9, 'o golpe de perto saiu');
  assert.equal(Acoes.voosDoLacaioGuardados(perto.e), 0);
  const longe = rodar(5);
  assert.equal(Acoes.voosDoLacaioGuardados(longe.e), 1);
});
