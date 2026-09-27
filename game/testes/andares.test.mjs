// As hunts de vários andares, como no original: a rota gravada sobe e desce
// escadas, cada bicho mora no andar dele, e a escada leva para onde a do
// original leva (conferido contra as 88 trocas de andar das rotas capturadas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Prey from '../systems/prey.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const PASTA = new URL('../gamedata/hunts/', import.meta.url);
const CATALOGO = JSON.parse(readFileSync(new URL('../gamedata/catalog-real.json', import.meta.url), 'utf8'));

function naHunt(huntId, mode = 'auto') {
  const e = personagemDeTeste({ level: 3000 });
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

test('Amazon Camp: cada bicho nasce no andar dele, e só os do andar atual vão para o cliente', () => {
  const e = naHunt('amazon-camp');
  const noCatalogo = CATALOGO.hunts.find((h) => h.id === 'amazon-camp').posicoes;
  const doAndar = (z) => new Set(noCatalogo.filter((p) => p.z === z).map((p) => `${p.x},${p.y}`));
  assert.equal(e.hunt.z, 7);
  const aqui = doAndar(7);
  assert.ok(e.hunt.monstros.every((m) => aqui.has(`${m.spawn.x},${m.spawn.y}`) && m.spawn.z === 7), 'no andar 7, só bicho do 7');
  for (const [z, lista] of Object.entries(e.hunt.outrosAndares)) {
    assert.ok(lista.every((m) => m.spawn.z === Number(z)), `andar ${z}`);
  }
  assert.ok(Object.keys(e.hunt.outrosAndares).length >= 4, 'os bichos de cima e de baixo esperam no andar deles');
  const snap = Cacadas.snapshotDaHunt(e, true);
  assert.equal(snap.z, 7);
  assert.equal(snap.monsters.length, e.hunt.monstros.length);
});

test('Caça Automática sobe e desce e passa por todos os andares com bicho, e dá a volta completa', () => {
  // O percurso passa pelos pontos de nascimento (`percursoPelosBichos`): com os 86
  // bichos da Dark Pyramid em 7 andares, uma volta leva uns 8 minutos.
  const e = naHunt('dark-pyramid');
  const andares = new Set([e.hunt.z]);
  let t = Date.now();
  e.hunt.ultimoTique = t;
  for (let i = 0; i < 4 * 60 * 10 && e.hunt; i++) {
    t += 250;
    e.hp = e.maxHp;
    Cacadas.tique(e, PERSONAGEM, t);
    andares.add(e.hunt.z);
    // O cliente só recebe o andar onde ele está.
    if (i % 400 === 0) assert.equal(Cacadas.snapshotDaHunt(e).z, e.hunt.z);
  }
  assert.deepEqual([...andares].sort((a, b) => a - b), [5, 6, 7, 8, 9, 10, 11]);
  assert.ok((e.hunt.percurso.voltas ?? 0) >= 1, `voltas: ${e.hunt.percurso.voltas}`);
});

test('Caça Online: pisar na rampa sobe (Amazon Camp, a de 40,75 leva para 39,75 no andar 6)', () => {
  const e = naHunt('amazon-camp', 'online');
  Object.assign(e.hunt.pos, { x: 41, y: 75 });
  e.hunt.monstros.splice(0);
  Cacadas.andar(e, { dx: -1, dy: 0 });
  Cacadas.tique(e, PERSONAGEM, Date.now() + 100); // o rumo manual vale 500 ms
  assert.deepEqual({ x: e.hunt.pos.x, y: e.hunt.pos.y, z: e.hunt.z }, { x: 39, y: 75, z: 6 });
});

test('huntEscada: a escada de mão sobe, só de perto', () => {
  const e = naHunt('amazon-camp', 'online');
  Object.assign(e.hunt.pos, { x: 95, y: 72 });
  assert.equal(Cacadas.usarEscada(e, { x: 89, y: 72 }).ok, false, 'longe');
  assert.equal(Cacadas.usarEscada(e, { x: 90, y: 72 }).ok, false, 'onde não há escada');
  Object.assign(e.hunt.pos, { x: 89, y: 72 });
  assert.equal(Cacadas.usarEscada(e, { x: 89, y: 72 }).ok, true);
  assert.equal(e.hunt.z, 6);
  assert.ok(Math.max(Math.abs(e.hunt.pos.x - 89), Math.abs(e.hunt.pos.y - 72)) <= 1);
});

test('quantidade como no original: `density` bichos por ponto (Winter Dream Court, andar 7)', () => {
  // O Zoros viu 8 Thanatursus no andar 7 (4 pontos, densidade 2) e o andar
  // chegou a 93 bichos ao mesmo tempo (`captura-monstros-0924`).
  const e = naHunt('winter-dream-court');
  const ursos = e.hunt.monstros.filter((m) => m.key === 'thanatursus').length;
  assert.equal(ursos, 8);
  assert.ok(e.hunt.monstros.length >= 85, `só ${e.hunt.monstros.length} no andar 7`);
  // Hunt de densidade 1 fica com um por ponto.
  assert.equal(naHunt('mother-of-scarabs-lair').hunt.monstros.length, 20);
});

test('Winter Dream Court: todos os bichos existem, e o percurso passa onde eles nascem em cada andar', () => {
  // "ele nunca anda o mapa todo ... na escada na parte de baixo ele vai e já
  // volta pra cima e parece não tem nenhum mob". Os pontos do catálogo estão
  // deslocados (+16, +2) em relação ao mapa: metade caía em rocha e sumia.
  const e = naHunt('winter-dream-court');
  const todos = [...e.hunt.monstros, ...Object.values(e.hunt.outrosAndares).flat()];
  assert.equal(todos.length, 214, '107 pontos, densidade 2');
  const grade = Cacadas.gradeDaHunt(CATALOGO.hunts.find((h) => h.id === 'winter-dream-court'));
  for (const z of [5, 6, 7, 8]) {
    const doAndar = todos.filter((m) => m.spawn.z === z);
    const perto = doAndar.filter((m) => grade.percurso.some((p) => p.z === z && Math.max(Math.abs(p.x - m.spawn.x), Math.abs(p.y - m.spawn.y)) <= 5));
    assert.ok(perto.length >= doAndar.length * 0.9, `andar ${z}: ${perto.length}/${doAndar.length} bichos perto do percurso`);
  }
});
