// As MOEDAS ligadas aos POOLS ESPECIAIS (dono, 08/10: "liga as moedas aos pools"): o Orbe Vaal com o implícito corrompido, os Ocultos,
// os Orbes Exaltados de influência, as Brasas e os Fluidos ancestrais (implícitos Eldritch), os orbes Ancestrais pela influência
// dominante, o Orbe do Conflito e o Orbe do Domínio — as regras do PoE 1, com os mods dos arquivos de `gamedata/itens-poe/pools/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';
import * as Jogo from '../systems/itens-poe/jogo.mjs';
import { gerarPeca } from '../systems/itens-poe/gerar.mjs';
import * as M from '../systems/itens-poe/moedas.mjs';
import { personagemDeTeste } from './apoio.mjs';

const SEM = !existsSync(Catalogo.ARQUIVO) && 'dados do PoE ausentes nesta máquina';
const rngDe = (s) => { let x = s; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };
const BOTAS = () => Catalogo.catalogo().classes.Boots.bases.find((b) => b.pool && (b.requisitos?.nivel ?? 1) <= 70).id;
const peca = (base, raridade, ilvl = 84, s = 7) => Jogo.pecaDoJogo(gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade, ilvl, rng: rngDe(s) }));
const mods = (p) => [...p.poe.prefixos, ...p.poe.sufixos];
/** Usa a moeda pela Forja de verdade (`moedas.usar`); devolve `{ r, peca }` (a peça depois). */
function usar(p, slug, s = 11) {
  const e = Object.assign(personagemDeTeste({ vocacao: 'knight', level: 80 }), { inventory: [structuredClone(p), { id: M.idDa(slug), count: 1 }] });
  const r = M.usar(e, { moeda: M.idDa(slug), alvo: { onde: 'inventory', indice: 0 } }, rngDe(s));
  return { r, peca: e.inventory[0] };
}
const familiasDo = (pool, p) => {
  const b = Catalogo.catalogo().classes[p.poe.classe].bases.find((x) => x.id === p.poe.base);
  const pg = Catalogo.poolEspecialDa(pool, p.poe.classe, b.pool);
  return new Set([...pg.prefixos, ...pg.sufixos, ...pg.implicitos].map((g) => g.familia));
};

test('status: as moedas dos pools agora têm efeito; o Orbe do Despertar segue sem (duas peças)', { skip: SEM }, () => {
  const st = (s) => M.STATUS[s].status;
  for (const s of ['Vaal_Orb', 'Shapers_Exalted_Orb', 'Elders_Exalted_Orb', 'Crusaders_Exalted_Orb', 'Redeemers_Exalted_Orb', 'Hunters_Exalted_Orb', 'Warlords_Exalted_Orb',
    'Lesser_Eldritch_Ember', 'Exceptional_Eldritch_Ember', 'Lesser_Eldritch_Ichor', 'Exceptional_Eldritch_Ichor', 'Eldritch_Chaos_Orb', 'Eldritch_Exalted_Orb',
    'Eldritch_Orb_of_Annulment', 'Orb_of_Conflict', 'Orb_of_Dominance']) assert.equal(st(s), 'funciona', s);
  for (const s of ['Veiled_Chaos_Orb', 'Veiled_Exalted_Orb']) assert.equal(st(s), 'parcial', s);
  assert.equal(st('Awakeners_Orb'), 'nao');
  assert.match(M.STATUS.Awakeners_Orb.motivo, /DUAS peças/);
});

test('Orbe Vaal: um dos quatro resultados é o implícito CORROMPIDO do pool (no lugar dos implícitos); corrompida, não aceita mais moeda comum', { skip: SEM }, () => {
  const base = peca(BOTAS(), 'raro');
  let achou = null;
  for (let s = 1; s < 200 && !achou; s++) {
    const { r, peca: depois } = usar(base, 'Vaal_Orb', s * 104_729); // sementes espalhadas: semente pequena dá o 1º sorteio perto de 0
    assert.equal(r.ok, true);
    assert.equal(depois.poe.corrompido, true);
    if (depois.poe.implicitos?.[0]?.corrompido) achou = depois;
  }
  assert.ok(achou, 'o implícito corrompido saiu');
  assert.equal(achou.poe.implicitos.length, 1);
  assert.equal(achou.poe.implicitos[0].origem, 'corrupted');
  assert.ok(familiasDo('corrupted', achou).has(achou.poe.implicitos[0].familia));
  assert.match(usar(achou, 'Chaos_Orb').r.erro, /corrompida/);
});

test('Orbe Exaltado do Criador: a Rara ganha a influência e um mod do Criador; de novo, recusa; e a peça influenciada rola mods da influência', { skip: SEM }, () => {
  const { r, peca: p } = usar(peca(BOTAS(), 'raro', 84, 3), 'Shapers_Exalted_Orb');
  assert.equal(r.ok, true, r.erro);
  assert.deepEqual(p.poe.influencias, ['shaper']);
  const inf = mods(p).filter((m) => m.influencia === 'shaper');
  assert.equal(inf.length, 1);
  assert.ok(familiasDo('shaper', p).has(inf[0].familia));
  assert.match(usar(p, 'Elders_Exalted_Orb').r.erro, /já tem influência/);
  assert.match(usar(peca(BOTAS(), 'normal'), 'Shapers_Exalted_Orb').r.erro, /Rara/);
  // Orbe do Caos comum numa peça influenciada: os mods do Criador entram no sorteio (como no PoE).
  let comInfluencia = 0;
  for (let s = 1; s <= 40; s++) if (mods(usar(p, 'Chaos_Orb', s).peca).some((m) => m.influencia === 'shaper')) comInfluencia++;
  assert.ok(comInfluencia > 0, 'o Caos rolou mod do Criador');
});

test('Orbes Ocultos: o Caos Oculto refaz a Rara com UM mod Oculto do pool velado; o Exaltado Oculto troca um mod por um Oculto', { skip: SEM }, () => {
  const { r, peca: p } = usar(peca(BOTAS(), 'raro'), 'Veiled_Chaos_Orb');
  assert.equal(r.ok, true, r.erro);
  const ocultos = mods(p).filter((m) => m.oculto);
  assert.equal(ocultos.length, 1);
  assert.equal(ocultos[0].origem, 'veiled');
  const antes = peca(BOTAS(), 'raro', 84, 5);
  const x = usar(antes, 'Veiled_Exalted_Orb');
  assert.equal(x.r.ok, true, x.r.erro);
  assert.equal(mods(x.peca).length, mods(antes).length, 'tirou um, pôs um');
  assert.equal(mods(x.peca).filter((m) => m.oculto).length, 1);
});

test('Brasas e Fluidos ancestrais: o implícito Eldritch do tier da moeda, em armadura de item level 75+; um lado não apaga o outro', { skip: SEM }, () => {
  const { r, peca: p } = usar(peca(BOTAS(), 'normal'), 'Greater_Eldritch_Ember');
  assert.equal(r.ok, true, r.erro);
  assert.equal(p.poe.implicitos.length, 1, 'substitui o implícito da base');
  assert.equal(p.poe.implicitos[0].origem, 'searing');
  assert.equal(p.poe.implicitos[0].nome, 'Brasa Ancestral Maior');
  assert.equal(p.poe.implicitos[0].degrau, 2);
  const q = usar(p, 'Lesser_Eldritch_Ichor').peca;
  assert.deepEqual(q.poe.implicitos.map((m) => [m.origem, m.degrau]), [['searing', 2], ['eater', 1]]);
  assert.match(usar(peca(BOTAS(), 'normal', 60), 'Lesser_Eldritch_Ember').r.erro, /item level 75/);
  const anel = Catalogo.catalogo().classes.Rings.bases.find((b) => b.pool).id;
  assert.match(usar(peca(anel, 'normal'), 'Lesser_Eldritch_Ember').r.erro, /Peitoral, Botas, Luvas ou Elmo/);
  const influenciada = usar(peca(BOTAS(), 'raro', 84, 3), 'Shapers_Exalted_Orb').peca;
  assert.match(usar(influenciada, 'Lesser_Eldritch_Ember').r.erro, /influenciada/);
});

test('orbes Ancestrais: agem no lado da influência DOMINANTE (Exarca → prefixos); empate, recusam; Orbe do Conflito sobe um tier e desce o outro', { skip: SEM }, () => {
  let p = usar(peca(BOTAS(), 'raro'), 'Greater_Eldritch_Ember').peca;
  p = usar(p, 'Lesser_Eldritch_Ichor').peca;
  const anul = usar(p, 'Eldritch_Orb_of_Annulment');
  assert.equal(anul.r.ok, true, anul.r.erro);
  assert.equal(anul.peca.poe.prefixos.length, p.poe.prefixos.length - 1, 'perdeu um prefixo');
  assert.equal(anul.peca.poe.sufixos.length, p.poe.sufixos.length, 'os sufixos ficaram');
  const caos = usar(p, 'Eldritch_Chaos_Orb');
  assert.equal(caos.r.ok, true, caos.r.erro);
  assert.deepEqual(caos.peca.poe.sufixos.map((m) => m.texto), p.poe.sufixos.map((m) => m.texto), 'o Caos Ancestral só refez os prefixos');
  let empate = usar(peca(BOTAS(), 'raro'), 'Lesser_Eldritch_Ember').peca;
  empate = usar(empate, 'Lesser_Eldritch_Ichor').peca;
  assert.match(usar(empate, 'Eldritch_Chaos_Orb').r.erro, /Nenhuma influência Eldritch domina/);
  const c = usar(p, 'Orb_of_Conflict');
  assert.equal(c.r.ok, true, c.r.erro);
  const graus = (x) => Object.fromEntries(x.poe.implicitos.map((m) => [m.origem, m.degrau]));
  const [a, b] = [graus(p), graus(c.peca)];
  assert.ok(Math.abs(b.searing - a.searing) <= 1 && Math.abs(b.eater - a.eater) <= 1 && (b.searing !== a.searing || b.eater !== a.eater), JSON.stringify([a, b]));
});

test('Orbe do Domínio: com 2+ mods influenciados, tira um e ELEVA outro (o tier Elevado do pool da influência)', { skip: SEM }, () => {
  const p = peca(BOTAS(), 'raro', 90);
  const b = Catalogo.catalogo().classes.Boots.bases.find((x) => x.id === p.poe.base);
  const pg = Catalogo.poolEspecialDa('shaper', 'Boots', b.pool);
  const comElevado = [...pg.prefixos, ...pg.sufixos].filter((g) => g.tiers.some((t) => /Elevad/.test(t.nome ?? '')) && g.tiers.some((t) => t.peso > 0));
  assert.ok(comElevado.length >= 2);
  const como = (g, lado) => { const t = g.tiers.find((x) => x.peso > 0 && !/Elevad/.test(x.nome)); return { familia: g.familia, tier: t.tier, nome: t.nome, ilvl: t.ilvl, modelo: t.modelo, texto: t.texto, valores: t.faixas.map((f) => f[0]), origem: 'shaper', influencia: 'shaper', lado }; };
  p.poe.prefixos = []; p.poe.sufixos = [];
  for (const g of comElevado.slice(0, 2)) p.poe[`${g.lado}s`].push(como(g, g.lado));
  p.poe.influencias = ['shaper'];
  const { r, peca: d } = usar(p, 'Orb_of_Dominance');
  assert.equal(r.ok, true, r.erro);
  const restam = mods(d).filter((m) => m.influencia);
  assert.equal(restam.length, 1);
  assert.equal(restam[0].elevado, true);
  assert.match(restam[0].nome, /Elevad/);
});

test('Orbe Divino: os valores dos mods de pool especial (influência, Oculto) saem de novo, na faixa do tier deles, sem sumir', { skip: SEM }, () => {
  let p = usar(peca(BOTAS(), 'raro', 84, 3), 'Shapers_Exalted_Orb').peca;
  p = usar(p, 'Veiled_Exalted_Orb').peca;
  const especiais = mods(p).filter((m) => m.origem);
  assert.ok(especiais.length >= 1);
  const d = usar(p, 'Divine_Orb', 99).peca;
  for (const m of especiais) assert.ok(mods(d).some((x) => x.familia === m.familia && x.origem === m.origem && x.modelo === m.modelo), m.familia);
});
