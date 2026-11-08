// As hunts de vários andares, como no original: a rota gravada sobe e desce
// escadas, cada bicho mora no andar dele, e a escada leva para onde a do
// original leva (conferido contra as 88 trocas de andar das rotas capturadas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as Instancia from '../systems/hunt/instancia.mjs';
import { spawnsDaHunt } from '../systems/hunt/terreno.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Prey from '../systems/prey.mjs';
import { CATALOGO } from '../systems/dados.mjs';
import { personagemDeTeste, PERSONAGEM, huntDoPoe } from './apoio.mjs';

const PASTA = new URL('../gamedata/hunts/', import.meta.url);
// (08/11, adaptado ao PoE — o dono: "Adaptar antes") As hunts são as ÁREAS da campanha do PoE (a do mesmo terreno: `huntDoPoe`), que
// moram no catálogo do jogo (`CATALOGO`, montado no bootstrap), não no `catalog-real.json` do disco. Os chefes de todos os atos vencidos:
// o teste é dos andares, não da porta da campanha.
const AREAS = Object.values(JSON.parse(readFileSync(new URL('../gamedata/itens-poe/campanha-poe.json', import.meta.url), 'utf8')).areas);
const ULTIMO_ATO = Math.max(...AREAS.map((a) => Number(a.ato) || 0));
// Os 214 bichos da Winter Dream Court (107 pontos × 2) — no PoE, a mesma conta na área do Muro de Zaoan (o Front de Batalha, Ato 3).
const BATALHA = 'poe-a3-the-battlefront';
// A Winter Dream Court (3 andares na rota) não é área do PoE: as Catacumbas (Ato 3) também passam por 3 andares.
const CATACUMBAS = 'poe-a3-the-catacombs';

function naHunt(huntId, mode = 'auto') {
  const e = personagemDeTeste({ level: 3000 });
  for (const p of Object.values(e.campanha)) p.bosses = Array.from({ length: ULTIMO_ATO }, (_, i) => i + 1);
  Prey.garantir(e);
  assert.ok(Cacadas.entrar(e, { huntId, mode }).ok, huntId);
  e.maxHp = e.hp = 1e12;
  return e;
}

test('escadas: a regra leva para onde a rota gravada do original chegou, em toda troca com marca', () => {
  let conferidas = 0;
  for (const arquivo of readdirSync(PASTA).filter((f) => f.endsWith('-map.json'))) {
    const mapa = JSON.parse(readFileSync(new URL(arquivo, PASTA), 'utf8'));
    const rota = mapa.route ?? [];
    for (let i = 1; i < rota.length; i++) {
      const [a, b] = [rota[i - 1], rota[i]];
      if (a.z === b.z) continue;
      const destino = Cacadas.destinoDaMudanca(mapa, a.z, a.x, a.y);
      if (!destino) continue; // escada de mão, ou passagem sem marca (a rota decide)
      assert.deepEqual(destino, { x: b.x, y: b.y, z: b.z }, `${arquivo} passo ${i}`);
      conferidas++;
    }
  }
  assert.ok(conferidas >= 70, `só ${conferidas} trocas conferidas`);
});

test('Amazon Camp: cada bicho da instância nasce numa casa alcançável do andar dele, e só os do andar atual vão para o cliente', () => {
  const e = naHunt(huntDoPoe('amazon-camp'));
  const grade = Cacadas.gradeDaHunt(CATALOGO.hunts.find((h) => h.id === huntDoPoe('amazon-camp')));
  const alcancaveis = Instancia.casasAlcancaveis(grade);
  assert.equal(e.hunt.z, 7);
  assert.ok(e.hunt.monstros.every((m) => alcancaveis.get(7).has(`${m.x},${m.y}`)), 'no andar 7, só casa alcançável do 7');
  for (const [z, lista] of Object.entries(e.hunt.outrosAndares)) {
    assert.ok(lista.every((m) => alcancaveis.get(Number(z))?.has(`${m.x},${m.y}`)), `andar ${z}`);
  }
  // Andar com área alcançável pequena pode sair sem bicho no sorteio: pelo menos 2 além do da entrada.
  assert.ok(Object.values(e.hunt.outrosAndares).filter((l) => l.length).length >= 2, 'os bichos de cima e de baixo esperam no andar deles');
  const snap = Cacadas.snapshotDaHunt(e, true);
  assert.equal(snap.z, 7);
  assert.equal(snap.monsters.length, e.hunt.monstros.length);
});

test('Caça Automática sobe e desce e passa por todos os andares com bicho, e dá a volta completa', () => {
  // O percurso passa pelos pontos de nascimento (`percursoPelosBichos`): com os 86
  // bichos da Dark Pyramid em 7 andares, uma volta leva uns 8 minutos. No PoE, a Cidade Vaal (Ato 7) sobre o mesmo terreno.
  const e = naHunt(huntDoPoe('dark-pyramid'));
  // A mecânica do LAÇO, sem a instância (que trocaria o laço por "ir atrás do que sobrou").
  delete e.hunt.instancia;
  const andares = new Set([e.hunt.z]);
  let t = Date.now();
  e.hunt.ultimoTique = t;
  for (let i = 0; i < 4 * 60 * 10 && e.hunt; i++) {
    t += 250;
    e.hp = e.maxHp;
    // O level 3000 do Draevor matava tudo de um golpe; o personagem de teste do PoE não mata os bichos do Ato 7 — aqui são de um golpe
    // (como em percurso.test.mjs), que o teste é do laço pelos andares, não do combate. O dreno sai junto com a vida.
    for (const m of e.hunt.monstros) { if (m.hp > 1) m.hp = 1; delete m.drenoPoe; }
    Cacadas.tique(e, PERSONAGEM, t);
    andares.add(e.hunt.z);
    // O cliente só recebe o andar onde ele está.
    if (i % 400 === 0) assert.equal(Cacadas.snapshotDaHunt(e).z, e.hunt.z);
  }
  assert.deepEqual([...andares].sort((a, b) => a - b), [5, 6, 7, 8, 9, 10, 11]);
  assert.ok((e.hunt.percurso.voltas ?? 0) >= 1, `voltas: ${e.hunt.percurso.voltas}`);
});

test('Caça Online: pisar na rampa sobe (Amazon Camp, a de 40,75 leva para 39,75 no andar 6)', () => {
  const e = naHunt(huntDoPoe('amazon-camp'), 'online');
  Object.assign(e.hunt.pos, { x: 41, y: 75 });
  e.hunt.monstros.splice(0);
  Cacadas.andar(e, { dx: -1, dy: 0 });
  Cacadas.tique(e, PERSONAGEM, Date.now() + 100); // o rumo manual vale 500 ms
  assert.deepEqual({ x: e.hunt.pos.x, y: e.hunt.pos.y, z: e.hunt.z }, { x: 39, y: 75, z: 6 });
});

test('huntEscada: a escada de mão sobe, só de perto', () => {
  const e = naHunt(huntDoPoe('amazon-camp'), 'online');
  Object.assign(e.hunt.pos, { x: 95, y: 72 });
  assert.equal(Cacadas.usarEscada(e, { x: 89, y: 72 }).ok, false, 'longe');
  assert.equal(Cacadas.usarEscada(e, { x: 90, y: 72 }).ok, false, 'onde não há escada');
  Object.assign(e.hunt.pos, { x: 89, y: 72 });
  assert.equal(Cacadas.usarEscada(e, { x: 89, y: 72 }).ok, true);
  assert.equal(e.hunt.z, 6);
  assert.ok(Math.max(Math.abs(e.hunt.pos.x - 89), Math.abs(e.hunt.pos.y - 72)) <= 1);
});

test('quantidade: a do mapa — a soma das `quantidade` dos spawns (o Front de Batalha: 109 pontos, 214 bichos)', () => {
  const e = naHunt(BATALHA);
  const spawns = spawnsDaHunt(BATALHA);
  assert.equal(spawns.length, 109);
  assert.equal(spawns.reduce((n, s) => n + s.quantidade, 0), 214);
  const todos = [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares).flat()];
  assert.equal(e.hunt.instancia.objetivos.total, todos.length);
  assert.ok(todos.length >= 200, `só ${todos.length} dos 214 nasceram`);
});

test('as Catacumbas: os bichos da instância ficam nos andares por onde a rota passa, e as criaturas são as da área', () => {
  // No PoE as criaturas de uma área são os monstros do PoE dela (`creatures` da hunt da área), não os do mapa do Draevor por baixo.
  const e = naHunt(CATACUMBAS);
  const todos = [...e.hunt.monstros.map((m) => ({ z: e.hunt.z, m })), ...Object.entries(e.hunt.outrosAndares).flatMap(([z, l]) => l.map((m) => ({ z: Number(z), m })))];
  const grade = Cacadas.gradeDaHunt(CATALOGO.hunts.find((h) => h.id === CATACUMBAS));
  const andaresDaRota = new Set(Instancia.andaresDaRota(grade));
  const doMapa = new Set(CATALOGO.hunts.find((h) => h.id === CATACUMBAS).creatures.map((c) => c.key));
  for (const { z, m } of todos) {
    assert.ok(andaresDaRota.has(z), `andar ${z} fora da rota`);
    assert.ok(doMapa.has(m.key), `${m.key} não é deste mapa`);
  }
  assert.ok(new Set(todos.map((t) => t.z)).size >= 3, 'espalhados pelos andares');
});
