// As CORES dos sockets e os ORBES DO PoE (dono, 06/10: "como no PoE" — poedb Item_socket; "os do PoE no lugar" dos orbes do Draevor):
// a cor pelo requisito de atributo da peça, a gema só no socket da cor dela (o branco aceita qualquer uma), as peças antigas ganhando
// cor sem perder gema, e o Joalheiro (número), a Fusão (links) e o Cromático (cores) — o orbe só é gasto quando a peça muda.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não está nesta máquina';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const S = await import('../systems/itens-poe/sockets.mjs');
const G = await import('../systems/skills/gemas.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const { personagemDeTeste } = await import('./apoio.mjs');
if (!SEM) Jogo.iniciar(ITEM_CATALOG);

const rngDe = (seed) => S.sorteioFixo(String(seed));
/** Uma gema de suporte do Draevor não tem cor (vale como branca); para cor, um item de gema falso com a cor do PoE. */
function gemaDeCor(cor) {
  const def = [...G.DEFS.values()].find((d) => d.tipo === 'support');
  const id = 999000 + ['vermelha', 'verde', 'azul', 'branca'].indexOf(cor);
  G.DEFS.set(id, { ...def, itemId: id, poe: { cor } });
  ITEM_CATALOG[id] = { id, name: `gema ${cor}`, type: 'gema', gemaDef: def, poeGema: { cor } };
  return id;
}
/** Uma peça do PoE vestida (Body_Armours de Destreza pura). */
function vestir(e, { abertos = 4, links = [true, false, true, false, false], cores = null, gemas = [] } = {}) {
  const base = [...Jogo.registro().porId.entries()].find(([id]) => { const m = ITEM_CATALOG[id]; return m?.poe?.classe === 'Body_Armours' && m.poe.requisitos?.dex && !m.poe.requisitos.str && !m.poe.requisitos.int; });
  const [id] = base;
  e.equipment.body = { id, count: 1, poe: { classe: 'Body_Armours', ilvl: 80 }, soquetes: { abertos, links, gemas: Array.from({ length: 6 }, (_, i) => gemas[i] ?? null), ...(cores ? { cores } : {}) } };
  return e.equipment.body;
}
const quantos = (e, id) => e.inventory.filter((p) => p.id === id).reduce((t, p) => t + (p.count ?? 1), 0);

test('a cor puxa para o atributo da peça: Destreza pura dá quase sempre verde; sem requisito, as três iguais', { skip: SEM }, () => {
  const r = rngDe(1);
  const cores = S.sortearCores(4000, { dex: 155 }, r);
  const verde = cores.filter((c) => c === 'G').length / cores.length;
  assert.ok(verde > 0.8 && verde < 0.95, `verde ${verde}`);
  assert.ok(cores.includes('R') && cores.includes('B'), 'a cor de fora ainda sai de vez em quando');
  const iguais = S.sortearCores(3000, null, rngDe(2));
  for (const c of ['R', 'G', 'B']) assert.ok(Math.abs(iguais.filter((x) => x === c).length / 3000 - 1 / 3) < 0.04);
  assert.ok(!iguais.includes('W'), 'branco não sai no sorteio');
});

test('a gema só entra no socket da cor dela; o branco aceita qualquer uma; a gema branca entra em qualquer socket', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  const verde = gemaDeCor('verde');
  const azul = gemaDeCor('azul');
  const branca = gemaDeCor('branca');
  vestir(e, { cores: ['G', 'R', 'W', 'B', 'G', 'G'] });
  e.inventory.push({ id: azul, count: 1 });
  const r = G.encaixar(e, { de: e.inventory.length - 1, slot: 'body', indice: 0 });
  assert.ok(!r.ok && /azul/.test(r.erro), r.erro);
  assert.equal(quantos(e, azul), 1, 'recusada: a gema continua na mochila');
  assert.ok(G.encaixar(e, { de: e.inventory.length - 1, slot: 'body', indice: 2 }).ok, 'socket branco');
  e.inventory.push({ id: verde, count: 1 });
  assert.ok(G.encaixar(e, { de: e.inventory.length - 1, slot: 'body', indice: 0 }).ok);
  e.inventory.push({ id: branca, count: 1 });
  assert.ok(G.encaixar(e, { de: e.inventory.length - 1, slot: 'body', indice: 1 }).ok, 'gema branca no vermelho');
  // Sem índice (arrastada até a peça): o primeiro socket livre da cor dela.
  e.inventory.push({ id: azul, count: 1 });
  assert.ok(G.encaixar(e, { de: e.inventory.length - 1, slot: 'body' }).ok);
  assert.equal(e.equipment.body.soquetes.gemas[3].id, azul);
  assert.deepEqual(e.equipment.body.soquetes.cores, ['G', 'R', 'W', 'B', 'G', 'G'], 'as cores ficam gravadas');
});

test('a peça antiga sem cor ganha cor fixa, e a gema que já estava encaixada fica com a cor dela (nada sai do lugar)', { skip: SEM }, () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  const azul = gemaDeCor('azul');
  const p = vestir(e, { gemas: [{ id: azul, nivel: 3, xp: 0, raridade: 'comum', qualidade: 0 }] });
  const a = G.soquetesDe(p).cores;
  assert.deepEqual(G.soquetesDe(p).cores, a, 'o mesmo sorteio sempre');
  assert.equal(a[0], 'B', 'o socket com a gema azul é azul');
  assert.equal(G.gravarCores(e), 1);
  assert.deepEqual(p.soquetes.cores, a);
  assert.equal(p.soquetes.gemas[0].id, azul);
});

test('Joalheiro: outro número de sockets (sem gema na peça); Fusão: links (as gemas ficam); Cromático: outras cores — o orbe só sai quando muda', { skip: SEM }, () => {
  const O = G.ORBES_DO_POE;
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  for (const o of Object.values(O).filter((x) => x?.itemId)) e.inventory.push({ id: o.itemId, count: 50 });
  const verde = gemaDeCor('verde');
  const p = vestir(e, { cores: ['G', 'G', 'G', 'G', 'G', 'G'], gemas: [{ id: verde, nivel: 1, xp: 0, raridade: 'comum', qualidade: 0 }] });
  // Com gema: o Joalheiro e o Cromático recusam sem gastar.
  for (const tipo of ['joalheiro', 'cromatico']) {
    const r = G.usarOrbeDoPoe(e, { slot: 'body', tipo });
    assert.ok(!r.ok && /Tire as gemas/.test(r.erro), r.erro);
    assert.equal(quantos(e, O[tipo].itemId), 50);
  }
  // A Fusão mexe só nos links.
  const r = G.usarOrbeDoPoe(e, { slot: 'body', tipo: 'fusao' }, rngDe(3));
  assert.ok(r.ok, r.erro);
  assert.equal(quantos(e, O.fusao.itemId), 49);
  assert.equal(p.soquetes.gemas[0].id, verde, 'a gema ficou');
  // Sem gema: o Joalheiro troca o número (sempre outro) e o Cromático as cores (sempre outra combinação).
  G.tirar(e, { slot: 'body', indice: 0 });
  for (let i = 0; i < 20; i++) {
    const antes = p.soquetes.abertos;
    const j = G.usarOrbeDoPoe(e, { slot: 'body', tipo: 'joalheiro' }, rngDe(`j${i}`));
    if (antes >= 6) { assert.ok(!j.ok); break; }
    assert.ok(j.ok, j.erro);
    assert.notEqual(p.soquetes.abertos, antes);
    const coresAntes = p.soquetes.cores.slice(0, p.soquetes.abertos).join('');
    assert.ok(G.usarOrbeDoPoe(e, { slot: 'body', tipo: 'cromatico' }, rngDe(`c${i}`)).ok);
    assert.notEqual(p.soquetes.cores.slice(0, p.soquetes.abertos).join(''), coresAntes);
  }
  // A peça toda ligada recusa a Fusão sem gastar.
  p.soquetes.abertos = 3;
  p.soquetes.links = [true, true, false, false, false];
  const n = quantos(e, O.fusao.itemId);
  assert.ok(!G.usarOrbeDoPoe(e, { slot: 'body', tipo: 'fusao' }).ok);
  assert.equal(quantos(e, O.fusao.itemId), n);
});

test('6 sockets e 6 links são raros como no PoE; a loja da Zuma vende os orbes do PoE e a Fundidora não cai mais', { skip: SEM }, () => {
  const r = rngDe(9);
  let seis = 0;
  for (let i = 0; i < 20000; i++) if (S.sortearNumero(1, 6, r) === 6) seis++;
  assert.ok(seis > 0 && seis / 20000 < 0.01, `6 sockets ${seis}/20000`);
  let todos = 0;
  for (let i = 0; i < 20000; i++) if (S.sortearLinks(6, 6, r).every(Boolean)) todos++;
  assert.ok(todos / 20000 < 0.003, `6 links ${todos}/20000`);
  const e = personagemDeTeste({ vocacao: 'sorcerer', level: 90 });
  const ids = G.linhasDosOrbes(e).map((l) => l.id).sort();
  assert.deepEqual(ids, Object.values(G.ORBES_DO_POE).filter((o) => o?.itemId).map((o) => o.itemId).sort());
  assert.equal(G.sortearFundidora({ ato: 4, fatorDeChance: 1e9 }), null);
  e.gold = 1e9;
  assert.ok(G.comprarNaLoja(e, { id: G.ORBES_DO_POE.cromatico.itemId, count: 3 }).ok);
  assert.equal(quantos(e, G.ORBES_DO_POE.cromatico.itemId), 3);
  assert.equal(ITEM_CATALOG[G.ORBES_DO_POE.cromatico.itemId].poeMoeda.icone, 'Chromatic_Orb.png');
});
