// OS PROJÉTEIS INDEPENDENTES, RODADA 3 (03/11 — a revisão do commit bea7d1ef). Com os projéteis a mais saindo no uso (e caindo cada um no tempo dele):
//   1 — o 2º golpe do ATAQUE DUPLO fica fora do roubo de vida/mana (conta só do primeiro — a regra do motor): também os a mais dele, no uso e os que caem depois;
//   2 — o golpe que cai depois leva o estado do passe que o soltou: o Dano Dobrado do Eco Desperto na repetição final (não o do passe de pé quando ele chega);
//   3 — a REPETIÇÃO do uso (o Eco de Magia) sai INTEIRA: com os a mais dela já no ar, o principal dela também sai quando o alvo morreu ou o principal se perdeu
//       (antes, só os a mais da repetição saíam — a repetição pela metade).
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
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const J = await import('../systems/itens-poe/jogo.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  J.iniciar(ITEM_CATALOG);
}

const sorte = (v, f) => { const o = Math.random; Math.random = () => v; try { return f(); } finally { Math.random = o; } };

/** O personagem com a arma e a ativa (nível 20), numa caçada; os bichos em `posicoes` ([dx, dy] de você), imortais (o mesmo de `projeteis-independentes-r2`). */
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
/** O dano de cada acerto em `b`, na ordem. */
const danos = (ev0, ts, b) => [...acertosEm(ev0, b), ...ts.flatMap((t) => acertosEm(t.eventos, b))].map((x) => x.v);
/** O roubo de vida do uso (as instâncias que entraram — `Ficha.aplicarLeech`). */
const rouboDeVida = (e) => (e.hunt.roubos ?? []).filter((r) => r.recurso === 'vida').reduce((t, r) => t + r.restante, 0);
const tirosDepois = (ts) => ts.flatMap((t) => t.eventos.filter((x) => x.t === 'shot'));

/** A Flecha Dividida com o ataque duplo garantido (ou não) e 1% de roubo de vida: o roubo do uso e os acertos. */
async function usoDoDuplo(posicoes, ataqueDuplo) {
  const { e, bichos } = await montar('Bows/Crude_Bow', 'Split_Arrow', [], posicoes);
  const f = Ficha.combate(e);
  f.ataqueDuplo = ataqueDuplo;
  f.lifeLeech = 1;
  e.hunt.roubos = [];
  const ev = usar(e, bichos[0]);
  const ts = tiques(e, 8);
  return { roubo: rouboDeVida(e), acertos: bichos.map((b) => acertos(ev, ts, b)) };
}

// ---------------------------------------------------------------- 1: o 2º golpe do ataque duplo fora do roubo

test('1 — o ataque duplo: os a mais do 2º golpe que acertam NO USO não entram no roubo de vida (a Flecha Dividida, o alvo a 4 casas, os bichos a 1): antes 45, agora 27 como sem o duplo', { skip: SEM }, async () => {
  const pos = [[4, 0], [1, 1], [1, -1]];
  const sem = await usoDoDuplo(pos, 0);
  const com = await usoDoDuplo(pos, 1);
  assert.deepEqual(com.acertos, [[250, 250], [0, 0], [0, 0]], 'o 2º golpe acerta todos de novo');
  assert.ok(sem.roubo > 0);
  assert.equal(Math.round(com.roubo), Math.round(sem.roubo), 'o roubo conta só do primeiro golpe');
});

test('1 — o ataque duplo: os a mais do 2º golpe que caem DEPOIS (antes do contato do principal) também ficam fora do roubo (o alvo a 7 casas, os bichos a 4)', { skip: SEM }, async () => {
  const pos = [[7, 0], [4, 1], [4, -1]];
  const sem = await usoDoDuplo(pos, 0);
  const com = await usoDoDuplo(pos, 1);
  // os a mais caem aos 250 ms, o principal aos 500 (o roubo do uso sai no contato dele)
  assert.deepEqual(com.acertos, [[500, 500], [250, 250], [250, 250]]);
  assert.equal(Math.round(com.roubo), Math.round(sem.roubo));
});

// ---------------------------------------------------------------- 2: o golpe que cai depois, no estado do passe que o soltou

test('2 — o Eco Desperto: o a mais da repetição final que cai depois leva o Dano Dobrado sorteado dela (as Facas Etéreas, os bichos a 4 casas no leque)', { skip: SEM }, async () => {
  const { e, bichos: [alvo, b1, b2] } = await montar('Wands/Driftwood_Wand', 'Ethereal_Knives', ['Awakened_Spell_Echo_Support'], [[6, 0], [4, 1], [4, -1]]);
  // o sorteio baixo no uso: o Dano Dobrado da repetição final sai (a chance do Eco Desperto)
  const ev = usar(e, alvo, 0.001);
  const ts = tiques(e, 12);
  for (const b of [b1, b2]) {
    const [primeiro, daRepeticao] = danos(ev, ts, b);
    assert.ok(primeiro > 0);
    // (antes: o golpe que caía depois via o passe de pé — sem o Dano Dobrado —, os dois iguais)
    assert.ok(Math.abs(daRepeticao / primeiro - 2) < 0.01, `a repetição final com Dano Dobrado: ${primeiro} → ${daRepeticao}`);
  }
});

// ---------------------------------------------------------------- 3: a repetição sai inteira

test('3 — o Eco de Magia com o alvo que morre no 1º acerto: a repetição sai inteira — os a mais dela (já no ar) e o principal dela, que vai no rumo e não acerta ninguém', { skip: SEM }, async () => {
  const { e, bichos: [alvo, b1, b2] } = await montar('Wands/Driftwood_Wand', 'Ethereal_Knives', ['Spell_Echo_Support'], [[6, 0], [4, 1], [4, -1]]);
  alvo.hp = alvo.maxHp = 1;
  const ev = usar(e, alvo);
  const ts = tiques(e, 12);
  assert.deepEqual(acertos(ev, ts, alvo), [1000], 'o principal mata o alvo');
  assert.deepEqual(acertos(ev, ts, b1), [750, 750], 'o a mais do uso e o da repetição');
  assert.deepEqual(acertos(ev, ts, b2), [750, 750]);
  // (antes: nenhum tiro depois do uso — o principal da repetição não saía)
  const depois = tirosDepois(ts);
  assert.equal(depois.length, 1, 'o tiro do principal da repetição, no contato');
});

test('3 — o Eco de Magia com o principal que se perde (o alvo saiu da reta): a repetição também sai inteira, sem acertar ninguém com o principal dela', { skip: SEM }, async () => {
  const { e, bichos: [alvo, b1] } = await montar('Wands/Driftwood_Wand', 'Ethereal_Knives', ['Spell_Echo_Support'], [[6, 0], [4, 1]]);
  const ev = usar(e, alvo);
  Object.assign(alvo, { x: e.hunt.pos.x + 30, y: e.hunt.pos.y + 30 });
  const ts = tiques(e, 16);
  assert.deepEqual(acertos(ev, ts, alvo), []);
  assert.deepEqual(acertos(ev, ts, b1), [750, 750]);
  assert.ok(tirosDepois(ts).length >= 1, 'o principal da repetição sai quando o primeiro se perde');
});
