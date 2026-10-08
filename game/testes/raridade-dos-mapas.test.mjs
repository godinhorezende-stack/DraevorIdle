// A raridade gravada nos mapas já criados (pedido do dono, 01/10: distribuição
// moderada, modificadores pelo tema do mob) e o caminho dela até o mob — na
// instância da campanha, no mapa do editor fora dela e no bicho que renasce.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import * as A from '../admin/raridade-dos-mapas.mjs';
import * as Mapas from '../admin/mapas.mjs';
import * as Raridade from '../systems/mobs/raridade.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Treino from '../systems/treino.mjs';
import { renascer } from '../systems/hunt/monstros.mjs';
import { RAIZ_HUNTS } from '../systems/hunt/terreno.mjs';
import { CATALOGO } from '../systems/dados.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';
import { doClassico } from './apoio-migracao.mjs';

const spawnsDeTeste = (n, key = 'troll') => Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, x: i, y: 0, z: 7, raio: 1, quantidade: 1, tipo: 'normal', criaturas: [{ key, peso: 1 }] }));

test('distribuir: fixo (a mesma entrada dá o mesmo resultado) e nas quantidades da distribuição', () => {
  const spawns = spawnsDeTeste(100);
  const a = A.distribuir('mapa-x', spawns);
  assert.deepEqual(a, A.distribuir('mapa-x', spawns));
  const conta = (r) => a.filter((s) => s.raridade === r).length;
  assert.equal(conta('elite'), Math.round(100 / A.DIST.porMapa.eliteACada));
  assert.equal(conta('raro'), Math.round(100 * A.DIST.porMapa.raro));
  assert.equal(conta('modificado'), Math.round(100 * A.DIST.porMapa.modificado));
  assert.equal(conta('unico'), A.DIST.porMapa.unico);
  assert.equal(conta('boss'), A.DIST.porMapa.boss);
  assert.notDeepEqual(a.map((s) => s.raridade ?? ''), A.distribuir('mapa-y', spawns).map((s) => s.raridade ?? ''), 'outro mapa, outra escolha');
  // Mapa pequeno: ao menos 1 elite.
  assert.equal(A.distribuir('mapa-z', spawnsDeTeste(5)).filter((s) => s.raridade === 'elite').length, 1);
});

test('completar: o que já tem raridade fica como está, e dá o mesmo que distribuir do zero', () => {
  const spawns = spawnsDeTeste(80);
  const antes = A.distribuir('mapa-c', spawns).map((s) => (s.raridade === 'unico' || s.raridade === 'boss' ? (({ raridade, modificadores, ...r }) => r)(s) : s));
  const completo = A.distribuir('mapa-c', antes, { manter: true });
  assert.deepEqual(completo, A.distribuir('mapa-c', spawns));
  antes.forEach((s, i) => { if (s.raridade) assert.deepEqual(completo[i], s, 'não mexe no que já tinha'); });
  // Um spawn editado à mão fica como está, e conta para a raridade dele.
  const mao = antes.map((s, i) => (i === 0 ? { ...s, raridade: 'boss', modificadores: ['brutal'] } : s));
  const r = A.distribuir('mapa-c', mao, { manter: true });
  assert.deepEqual(r[0], mao[0]);
  assert.equal(r.filter((s) => s.raridade === 'boss').length, 1);
});

test('distribuir: modificadores do tema, dentro do teto, com no máximo N mecânicas; boss fica de fora', { skip: doClassico("Raridade de monstro por mapa do Draevor (temas, editor de mapas)") }, () => {
  const tema = A.temaDe('dragon');
  assert.ok(tema.includes('ignifugo'), 'dragão resiste a fogo: ganha o tema de fogo');
  const a = A.distribuir('mapa-dragao', spawnsDeTeste(200, 'dragon'));
  for (const s of a.filter((x) => x.raridade)) {
    const [min, max] = A.DIST.modificadores[s.raridade];
    assert.ok(s.modificadores.length >= min && s.modificadores.length <= max, JSON.stringify(s));
    assert.ok(tema.includes(s.modificadores[0]), `o primeiro é do tema: ${s.modificadores}`);
    const mecanicas = s.modificadores.filter((id) => Raridade.MODIFICADORES[id].mecanicas);
    assert.ok(mecanicas.length <= A.DIST.mecanicasNoMaximo[s.raridade]);
    assert.deepEqual(Raridade.errosDoSpawn(s), []);
  }
  const boss = Object.keys(CATALOGO.bestiary).find((k) => CATALOGO.bestiary[k].boss);
  assert.ok(A.distribuir('mapa-boss', spawnsDeTeste(50, boss)).every((s) => !s.raridade));
});

test('os mapas com spawn já têm a raridade gravada, e válida', () => {
  let mapas = 0;
  for (const arq of readdirSync(RAIZ_HUNTS).filter((f) => f.endsWith('-map.json'))) {
    const m = JSON.parse(readFileSync(join(RAIZ_HUNTS, arq), 'utf8'));
    if (!m.spawns?.length) continue;
    mapas++;
    for (const r of ['elite', 'unico', 'boss']) assert.ok(m.spawns.some((s) => s.raridade === r), `${arq} sem ${r}`);
    for (const s of m.spawns) assert.deepEqual(Raridade.errosDoSpawn(s), [], `${arq} ${s.id}`);
  }
  assert.ok(mapas >= 40);
});

test('editor: mapa real (troll-cave) é só spawns; o resto é do editor', { skip: doClassico("Raridade de monstro por mapa do Draevor (temas, editor de mapas)") }, () => {
  assert.equal(Mapas.ehMapaReal(Mapas.carregar(HUNT_DE_TESTE)), true);
  assert.equal(Mapas.ehMapaReal({ atlas: Mapas.cidadeParaEditor().atlas, levels: [7] }), false);
  assert.equal(Mapas.salvarSpawns({ id: 'nao-existe-xyz', spawns: [] }).ok, false);
});

test('mapa do editor fora da campanha: o mob nasce com a raridade do spawn, e renasce com ela', { skip: doClassico("Raridade de monstro por mapa do Draevor (temas, editor de mapas)") }, () => {
  const id = 'teste-raridade-fora-da-campanha';
  const w = 20;
  const h = 10;
  const blocked = new Array(w * h).fill(1);
  for (let y = 2; y < 8; y++) for (let x = 2; x < 18; x++) blocked[y * w + x] = 0;
  const stacks = new Array(w * h).fill(0).map(() => [40]);
  const spawns = [
    { id: 's1', x: 4, y: 4, z: 7, raio: 0, quantidade: 1, criaturas: [{ key: 'troll', peso: 1 }], raridade: 'raro', modificadores: ['vigoroso'] },
    { id: 's2', x: 15, y: 6, z: 7, raio: 0, quantidade: 1, criaturas: [{ key: 'troll', peso: 1 }] },
  ];
  try {
    assert.equal(Mapas.salvar({ id, width: w, height: h, blocked, stacks, spawns }).ok, true);
    const e = personagemDeTeste({ vocacao: 'knight', level: 200 });
    Treino.garantir(e);
    assert.ok(Cacadas.entrar(e, { huntId: id, mode: 'auto' }).ok);
    const raro = e.hunt.monstros.find((m) => m.raridade === 'raro');
    assert.ok(raro, 'nasceu raro');
    assert.deepEqual(raro.mods, ['vigoroso']);
    // Morreu e renasce: com a raridade do spawn.
    e.hunt.monstros = e.hunt.monstros.filter((m) => m !== raro);
    e.hunt.respawns.push({ ...raro.spawn, volta: 0 });
    renascer(e.hunt);
    const novo = e.hunt.monstros.find((m) => m.x === raro.spawn.x && m.y === raro.spawn.y);
    assert.equal(novo?.raridade, 'raro');
    assert.equal(novo.maxHp, raro.maxHp);
  } finally {
    rmSync(join(RAIZ_HUNTS, `${id}-map.json`), { force: true });
  }
});
