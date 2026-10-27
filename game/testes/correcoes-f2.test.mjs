// (revisão F2, 27/10) AS CORREÇÕES DA REVISÃO dos suportes dos lotes S2A e D2: o Sangue Corrompido do Clamor Corrompedor no golpe básico Impelido, a reserva da Mina
// (o custo base × as Minas plantadas, como o PoB — decisão nova do dono — e a reserva que sai quando a gema perde o suporte), o Estandarte Ensanguentado com dois
// estandartes, o Sangue guardado de um uso antigo do Clamor, o Ímpeto de Combate ganho no próprio Deslocamento, o Marcar ao Acertar no golpe básico e as almas da
// Transfusão separadas das do Devorador. Os sorteios ficam travados.
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
const J2A = await import('../systems/itens-poe/suportes-s2a-jogo.mjs');
const Cond = await import('../systems/itens-poe/condicoes-poe.mjs');
const Reserva = await import('../systems/itens-poe/reserva.mjs');
const Plantadas = await import('../systems/itens-poe/armas-plantadas.mjs');
const Cacadas = await import('../systems/cacadas.mjs');
const Combate = await import('../systems/hunt/combate.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

const PERSONAGEM = { nome: 'T' };
function travado(v, fn) {
  const antes = Math.random;
  Math.random = () => v;
  try { return fn(); } finally { Math.random = antes; }
}
const doSlug = (s) => G.doSlug(s) ?? SP.doSlug(s);
/** O personagem com as gemas ligadas na arma, a ativa no slot 0, numa caçada do PoE; o primeiro bicho colado e imortal, os outros longe. */
async function montar(slugs, { arma = 'One_Hand_Swords/Rusted_Sword', vocacao = 'knight', classe = 'Scion' } = {}) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao, level: 90 }), { classePoe: classe, sistema: 'poe' });
  const a = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: arma, raridade: 'normal', ilvl: 60, rng: () => 0.5 }));
  a.soquetes = { abertos: slugs.length, links: Array(Math.max(0, slugs.length - 1)).fill(true), gemas: Array(slugs.length).fill(null), cores: Array(slugs.length).fill('W') };
  e.equipment = { ...e.equipment, weapon: a };
  delete e.equipment.shield;
  e.inventory = slugs.map((s) => GS.itemDaGema({ id: doSlug(s).itemId, nivel: 20, xp: 0, raridade: 'comum', qualidade: 0 }));
  for (let i = 0; i < slugs.length; i++) GS.encaixar(e, { de: 0, slot: 'weapon', indice: i });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(slugs[0]).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(travado(0.5, () => Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' })).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  e.maxHp = e.hp = 1e6;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60, hp: 1e12, maxHp: 1e12 });
  Object.assign(b, { x: e.hunt.pos.x + 1, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {}, dots: [] });
  return { e, b };
}
/** Usa a gema do slot 0 no alvo (a conjuração concluída), com o sorteio travado em `v`. */
function usar(e, alvo, v = 0.5, passo = 10_000) {
  e.hunt.clock += passo;
  const r = travado(v, () => Acoes.disparar(e, e.hunt, PERSONAGEM, 0, alvo, { manual: true }));
  const eventos = [...(r.eventos ?? [])];
  if (r.ok && e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; eventos.push(...(travado(v, () => Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM)) ?? [])); }
  return { r, eventos };
}
/** O golpe básico com a arma no alvo (a barra vazia: nada além dele). */
function golpeBasico(e, b) {
  e.actions[0] = null;
  e.hunt.alvo = b.uid;
  e.hunt.clock += 5000;
  return travado(0.5, () => Combate.round(e, PERSONAGEM));
}
const sangues = (m) => (m.dots ?? []).filter((d) => d.tipo === 'sangueCorrompido' && d.falta > 0);

// ---------------------------------------------------------------- médios

test('F2 (média): o golpe básico Impelido pelo Clamor com o Clamor Corrompedor põe o Sangue Corrompido no inimigo acertado e gasta o Impelir', { skip: SEM }, async () => {
  const s = await montar(['Intimidating_Cry', 'Corrupting_Cry_Support']);
  assert.ok(usar(s.e, s.b).r.ok);
  assert.equal(s.e.hunt.poeSangueDoImpelirS2A?.Intimidating_Cry?.n, 1);
  s.b.dots = [];
  const n0 = s.e.hunt.impelidos.n;
  golpeBasico(s.e, s.b);
  assert.equal(s.e.hunt.impelidos.n, n0 - 1, 'o golpe básico gastou um Impelir');
  assert.equal(sangues(s.b).length, 1, JSON.stringify(s.b.dots));
  // (sem o suporte: o mesmo golpe Impelido não põe nada)
  const sem = await montar(['Intimidating_Cry']);
  assert.ok(usar(sem.e, sem.b).r.ok);
  sem.b.dots = [];
  golpeBasico(sem.e, sem.b);
  assert.equal(sangues(sem.b).length, 0);
});

test('F2 (média): a reserva da Mina sai quando a gema perde a Cadeia Explosiva — a gema na barra volta a custar e nada fica trancado', { skip: SEM }, async () => {
  const s = await montar(['Fireball', 'Blastchain_Mine_Support'], { arma: 'Wands/Driftwood_Wand', vocacao: 'sorcerer', classe: 'Witch' });
  const e = s.e;
  const acao = G.doSlug('Fireball').acao;
  (e.hunt.poeRecente ??= {}).moveu = Number.MAX_SAFE_INTEGER;
  assert.ok(usar(e, s.b).r.ok);
  assert.ok(Reserva.reservadas(e).mana > 0, 'a mina plantada reserva');
  assert.equal(e.hunt.buffs[acao]?.tipo, 'poe-reserva-mina');
  // (tira o suporte; a Bola de Fogo segue encaixada e na barra)
  GS.tirar(e, { slot: 'weapon', indice: 1 });
  Ficha.invalidar(e);
  Acoes.desligarAurasForaDaBarra(e, e.hunt);
  assert.equal(e.hunt.buffs[acao], undefined, 'a reserva desliga');
  assert.equal(Reserva.reservadas(e).mana, 0);
  assert.ok(!Plantadas.plantadas(e.hunt, 'mina').some((p) => p.reserva), 'as plantadas deixam de contar');
});

test('F2 (decisão nova do dono): a reserva da Mina é a de uma × as Minas da gema plantadas agora (o PoB, activeMineCount)', { skip: SEM }, async () => {
  const h = { clock: 1000, plantadas: [] };
  const r = { recurso: 'mana', fixo: 20, fator: 0.65, minasDe: 'x' };
  assert.equal(Cond.valorDaReserva(h, r, 1000), 0, 'sem mina plantada, nada');
  h.plantadas.push({ tipo: 'mina', acao: 'x', reserva: true, ate: 5000 }, { tipo: 'mina', acao: 'x', reserva: true, ate: 5000 }, { tipo: 'mina', acao: 'x', ate: 5000 }, { tipo: 'mina', acao: 'y', reserva: true, ate: 5000 }, { tipo: 'mina', acao: 'x', reserva: true, ate: 500 });
  assert.equal(Cond.valorDaReserva(h, r, 1000), 2 * 13, 'ceil(20 × 0,65) = 13 por mina; só as da gema, com a reserva e vivas');
  assert.equal(Cond.valorDaReserva(h, { ...r, minasAMais: 1 }, 1000), 3 * 13, 'o "cabe?" conta a que vai sair');
  assert.equal(Cond.valorDaReserva(h, { recurso: 'mana', fixo: 20, fator: 0.65 }, 1000), 13, 'a reserva de aura não muda');
});

// ---------------------------------------------------------------- baixos

test('F2: o Estandarte Ensanguentado no tique vale no estandarte suportado mesmo que outro tenha sido plantado antes', { skip: SEM }, () => {
  const agora = 10_000;
  const b = { uid: 'b', x: 5, y: 5, z: 0, hp: 1e6, maxHp: 1e6, estados: {}, dots: [] };
  const hunt = { clock: agora, z: 0, monstros: [b], buffs: {
    'poe-gema:War_Banner': { ate: agora + 60_000, raio: 3, estandarte: { x: 5, y: 5, z: 0 } },
    'poe-gema:Dread_Banner': { ate: agora + 60_000, raio: 3, estandarte: { x: 5, y: 6, z: 0, sangue: { total: 1000, ms: 2000, proximo: agora } } },
  } };
  assert.equal(J2A.tiqueS2A(hunt, [], agora), 1);
  assert.equal(sangues(b).length, 1);
});

test('F2: o Clamor usado de novo sem o Clamor Corrompedor apaga o Sangue guardado do uso antigo', { skip: SEM }, async () => {
  const s = await montar(['Intimidating_Cry', 'Corrupting_Cry_Support']);
  assert.ok(usar(s.e, s.b).r.ok);
  assert.ok(s.e.hunt.poeSangueDoImpelirS2A?.Intimidating_Cry);
  GS.tirar(s.e, { slot: 'weapon', indice: 1 });
  Ficha.invalidar(s.e);
  assert.ok(usar(s.e, s.b, 0.5, 60_000).r.ok);
  assert.equal(s.e.hunt.poeSangueDoImpelirS2A?.Intimidating_Cry, undefined);
});

test('F2: o Deslocamento só tira o Ímpeto de Combate que já existia antes do uso dele — o ganho no acerto do próprio uso fica', { skip: SEM }, () => {
  const agora = 10_000;
  const hunt = { clock: agora, z: 0, pos: { x: 0, y: 0 }, monstros: [] };
  const b = { uid: 'b', x: 1, y: 0, z: 0, hp: 1e6, maxHp: 1e6, estados: {}, dots: [] };
  const antes = hunt.poeImpetoGanhosS2A ?? 0;
  J2A.noAcertoS2A(hunt, b, { impetoMs: 2000, impetoVelPct: 20 }, { agora });
  assert.ok(hunt.poeBuffs?.impetoDeCombate > agora);
  assert.equal(J2A.tirarImpeto(hunt, antes), false, 'ganho neste uso: fica');
  assert.ok(hunt.poeBuffs.impetoDeCombate > agora);
  assert.equal(J2A.tirarImpeto(hunt, hunt.poeImpetoGanhosS2A), true, 'o de antes do uso: sai');
  assert.equal(hunt.poeBuffs.impetoDeCombate, undefined);
});

test('F2: o Marcar ao Acertar também no golpe básico (um Ataque) que acerta um Raro', { skip: SEM }, async () => {
  const s = await montar(['Assassins_Mark', 'Mark_On_Hit_Support']);
  const marca = G.doSlug('Assassins_Mark').acao;
  s.b.raridade = 'raro';
  golpeBasico(s.e, s.b);
  assert.ok(s.e.hunt.buffs?.[marca]?.ate > s.e.hunt.clock, `a Marca ativada: ${JSON.stringify(Object.keys(s.e.hunt.buffs ?? {}))}`);
  assert.equal(s.e.hunt.cooldowns?.['gatilho:weapon:1']?.total, 4000, 'a recarga do suporte');
  // (no Normal: não)
  const n = await montar(['Assassins_Mark', 'Mark_On_Hit_Support']);
  golpeBasico(n.e, n.b);
  assert.ok(!(n.e.hunt.buffs?.[marca]?.ate > n.e.hunt.clock));
});

test('F2: as almas da Transfusão e as do Devorador de Almas não viram um contador só — acabado o Devorador, só as da Transfusão ficam', { skip: SEM }, () => {
  const agora = 10_000;
  const l = { hp: 100, x: 0, y: 0, buffs: {}, almas: { n: 1, em: agora, livre: 1 } };
  assert.equal(Cond.almasDoLacaio(l, agora), 1, 'a da Transfusão vale sem o Devorador');
  l.buffs.devoradorDeAlmas = agora + 20_000;
  for (let i = 0; i < 44; i++) Cond.almaParaOsLacaios([l], { x: 1, y: 0 }, agora + 100 * i);
  const t = agora + 100 * 43;
  assert.equal(Cond.almasDoLacaio(l, t), 45);
  // (o buff acaba: as 44 do Devorador vão junto)
  l.buffs.devoradorDeAlmas = t;
  assert.equal(Cond.almasDoLacaio(l, t + 1), 1);
});
