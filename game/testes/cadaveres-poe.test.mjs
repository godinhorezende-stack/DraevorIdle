// O USO DE CADÁVERES (lote G12, 17/10): os cadáveres da caçada guardam a Vida Máxima do morto; a explosão ("X% da Vida Máxima do Cadáver" como
// dano de Fogo, sem os modificadores de dano mágico); Detonar os Mortos (o cadáver mais perto do alvo, com o dano mágico em volta dele), a
// do Saque (só a explosão, não mira os criados), a Vaal (todos em volta), os Mortos Voláteis (até 3), a Cremação (o gêiser que dispara os
// projéteis por 8 s). Sem cadáver, a gema não sai.
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
const Cacadas = await import('../systems/cacadas.mjs');
const Ficha = await import('../systems/ficha.mjs');
const Afixos = await import('../systems/afixos.mjs');

async function com(gema) {
  const J = await import('../systems/itens-poe/jogo.mjs');
  const { gerarPeca } = await import('../systems/itens-poe/gerar.mjs');
  const e = Object.assign(personagemDeTeste({ vocacao: 'sorcerer', level: 80 }), { classePoe: 'Witch', sistema: 'poe' });
  const arma = J.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base: 'Wands/Driftwood_Wand', raridade: 'normal', ilvl: 1, rng: () => 0.5 }));
  arma.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['W'] };
  e.equipment = { ...e.equipment, weapon: arma };
  e.inventory = [GS.itemDaGema({ id: G.doSlug(gema).itemId, nivel: 20, xp: 0, raridade: 'comum' })];
  GS.encaixar(e, { de: 0, slot: 'weapon', indice: 0 });
  e.actions = Array(Acoes.SLOTS).fill(null);
  e.actions[0] = { id: G.doSlug(gema).acao, enabled: true, minMana: 0, conditions: [] };
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'poe-a1-the-coast', mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.clock = 100_000;
  e.mana = e.maxMana = 1e6;
  const [b, ...resto] = e.hunt.monstros;
  for (const m of resto) Object.assign(m, { x: e.hunt.pos.x + 60, y: e.hunt.pos.y + 60 });
  Object.assign(b, { x: e.hunt.pos.x + 3, y: e.hunt.pos.y, hp: 1e12, maxHp: 1e12, estados: {} });
  e.hunt.cadaveres = [];
  return { e, b };
}
const cadaver = (e, dx, dy, maxHp = 100000, extra = {}) => ({ key: 'x', nome: 'Morto', look: 1, x: e.hunt.pos.x + dx, y: e.hunt.pos.y + dy, maxHp, ...extra });
function usar(e, alvo) {
  const r = Acoes.disparar(e, e.hunt, PERSONAGEM, 0, alvo, { manual: true });
  if (!r.ok) return r;
  const ev = [...(r.eventos ?? [])];
  if (e.hunt.conjurando) { e.hunt.clock = e.hunt.conjurando.fim; ev.push(...(Acoes.concluirConjuracao(e, e.hunt, PERSONAGEM) ?? [])); }
  return { ok: true, ev };
}
const dano = (ev, b) => ev.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).reduce((t, x) => t + x.v, 0);

test('G12: a definição das gemas de cadáver e o status', { skip: SEM }, () => {
  assert.deepEqual([G.cadaverDaGema('Detonate_Dead', 20).modo, G.cadaverDaGema('Detonate_Dead', 20).pct], ['detonar', 7.9]);
  assert.equal(G.cadaverDaGema('Volatile_Dead', 20).maximo, 3);
  assert.deepEqual(G.cadaverDaGema('Cremation', 20).geiser, { intervaloMs: 1000, duracaoMs: 8000, projeteis: 4, max: 3 });
  for (const s of ['Detonate_Dead', 'Volatile_Dead', 'Cremation']) assert.ok(!G.doSlug(s).motivosNoJogo.some((m) => /cadáveres não existe/.test(m)), s);
});

test('G12: Detonar os Mortos — sem cadáver não sai; com um, ele explode (7,9% da vida dele) e some', { skip: SEM }, async () => {
  const { e, b } = await com('Detonate_Dead_of_Scavenging');
  assert.equal(usar(e, b).motivo, 'SEM_CADAVER');
  e.hunt.cadaveres = [cadaver(e, 3, 0, 100000)];
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  // a do Saque: 29,5% de 100.000 = 29.500 de Fogo, × o aumentado de Fogo da ficha, pela resistência — só a explosão
  assert.ok(dano(r.ev, b) > 5000, `explosão: ${dano(r.ev, b)}`);
  assert.equal(e.hunt.cadaveres.length, 0, 'o cadáver some');
  // a do Saque não mira os cadáveres criados
  e.hunt.cadaveres = [cadaver(e, 3, 0, 100000, { criadoPor: 'Desecrate' })];
  e.hunt.clock += 10_000;
  assert.equal(usar(e, b).motivo, 'SEM_CADAVER');
});

test('G12: os Mortos Voláteis consomem até 3 cadáveres', { skip: SEM }, async () => {
  const { e, b } = await com('Volatile_Dead');
  e.hunt.cadaveres = [cadaver(e, 3, 0), cadaver(e, 3, 1), cadaver(e, 4, 0), cadaver(e, 4, 1)];
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.equal(e.hunt.cadaveres.length, 1, 'consumiu 3 dos 4');
  assert.ok(dano(r.ev, b) > 0);
});

test('G12: a Cremação — o cadáver explode e vira um gêiser que dispara 4 projéteis por segundo por 8 s', { skip: SEM }, async () => {
  const { e, b } = await com('Cremation');
  e.hunt.cadaveres = [cadaver(e, 3, 0)];
  const r = usar(e, b);
  assert.ok(r.ok, r.erro);
  assert.equal(e.hunt.poeGeiseres?.length, 1);
  e.hunt.clock += 1000;
  const ev = Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []);
  assert.equal(ev.filter((x) => x.t === 'dmg' && x.uid === b.uid && x.foe).length >= 4, true, 'os 4 projéteis do segundo 1');
  e.hunt.clock += 9000;
  Acoes.tiqueDasPlantadas(e, e.hunt, PERSONAGEM, []);
  assert.equal(e.hunt.poeGeiseres, undefined, 'acabou a duração');
});
