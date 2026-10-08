// Os bosses como no original, conferidos contra o que foi capturado nas salas
// (Zoros, 2026-09-24, `api-mapeada/captura-bosses-0924/`): a barra do boss, a
// sala real, e os poderes (melee e magias do monster.lua) com o nome e a faixa
// de dano que o original mostra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Prey from '../systems/prey.mjs';
import { personagemDeTeste, PERSONAGEM, huntDoPoe } from './apoio.mjs';
import { doClassico } from './apoio-migracao.mjs';

const RESUMO = JSON.parse(readFileSync(new URL('../../api-mapeada/captura-bosses-0924/resumo-bosses.json', import.meta.url), 'utf8'));

function naSala(id) {
  const e = personagemDeTeste({ level: 3000 });
  Prey.garantir(e);
  assert.ok(Cacadas.entrar(e, { huntId: id, mode: 'online' }).ok, id);
  return e;
}

/** `segundos` de sala com o jogador imortal e o boss que não cai; devolve os golpes que ele levou. */
function apanhar(e, segundos) {
  e.maxHp = e.hp = 1e12;
  for (const b of e.hunt.monstros) b.hp = b.maxHp = 1e15;
  const golpes = [];
  let t = Date.now();
  e.hunt.ultimoTique = t;
  for (let i = 0; i < segundos * 4; i++) {
    t += 250;
    e.hp = e.maxHp;
    for (const ev of Cacadas.tique(e, PERSONAGEM, t) ?? []) if (ev.t === 'dmg' && !ev.foe) golpes.push(ev);
  }
  return golpes;
}

test('as 72 salas capturadas: o jogador e o boss nascem onde o original põe', { skip: doClassico("Salas e poderes dos bosses do Draevor (capturados do original)") }, () => {
  for (const [id, of] of Object.entries(RESUMO)) {
    const e = naSala(id);
    assert.deepEqual({ x: e.hunt.pos.x, y: e.hunt.pos.y }, { x: of.player.x, y: of.player.y }, `${id}: jogador`);
    assert.deepEqual({ x: e.hunt.monstros[0].x, y: e.hunt.monstros[0].y }, of.boss, `${id}: boss`);
  }
});

test('a barra do boss: vida e elementos iguais ao original (resistência no teto de 20%)', { skip: doClassico("Salas e poderes dos bosses do Draevor (capturados do original)") }, () => {
  for (const id of ['earl-osam', 'custodian', 'essence-of-malice', 'faceless-bane']) {
    const e = naSala(id);
    const snap = Cacadas.snapshotDaHunt(e);
    assert.equal(snap.isBoss, true);
    assert.equal(snap.boss.maxHp, RESUMO[id].hp, id);
    assert.deepEqual(snap.boss.elementos, RESUMO[id].elementos, id);
    assert.equal(snap.map.atlas, `hunts/${id}`, 'a sala real');
  }
});

test('Gaffir: os golpes com os nomes do original e dentro da faixa do monster.lua', { skip: doClassico("Salas e poderes dos bosses do Draevor (capturados do original)") }, () => {
  const vistosNoOriginal = new Set(['corpo a corpo', 'físico em área', 'de fogo', 'de terra em feixe', 'de terra em área']);
  const golpes = apanhar(naSala('gaffir'), 240).filter((g) => g.de === 'Gaffir');
  const nomes = new Set(golpes.map((g) => g.golpe));
  assert.ok(nomes.size >= 3, `só ${[...nomes]}`);
  for (const n of nomes) assert.ok(vistosNoOriginal.has(n), `golpe que o original não mostrou: ${n}`);
  assert.ok(golpes.every((g) => g.v <= 750), 'nenhum golpe acima do maior máximo do arquivo (fogo 750)');
  const terra = golpes.find((g) => g.golpe === 'de terra em área');
  if (terra) assert.equal(terra.color, '#00ff00');
});

test('melee de boss é o do arquivo, não metade da vida (Essence of Malice: 0..603)', { skip: doClassico("Salas e poderes dos bosses do Draevor (capturados do original)") }, () => {
  const golpes = apanhar(naSala('essence-of-malice'), 120).filter((g) => g.golpe === 'corpo a corpo');
  assert.ok(golpes.length > 0);
  assert.ok(golpes.every((g) => g.v <= 603), `máximo ${Math.max(...golpes.map((g) => g.v))}`);
});

test('Brain Head não tem melee: só magia', { skip: doClassico("Salas e poderes dos bosses do Draevor (capturados do original)") }, () => {
  const golpes = apanhar(naSala('brain-head'), 120);
  assert.ok(!golpes.some((g) => g.golpe === 'corpo a corpo'));
});

test('Magma Bubble: sala de lava, o boss nasce nela', { skip: doClassico("Salas e poderes dos bosses do Draevor (capturados do original)") }, () => {
  const e = naSala('magma-bubble');
  assert.equal(e.hunt.monstros.length, 1);
  assert.deepEqual({ x: e.hunt.monstros[0].x, y: e.hunt.monstros[0].y }, { x: 35, y: 36 });
});

test('bichos da hunt (Winter Dream Court): as magias com o nome, a cor e o efeito do original', { skip: doClassico("Salas e poderes dos bosses do Draevor (capturados do original)") }, () => {
  // O que o original mostrou em 5 minutos de caçada do Zoros (`captura-monstros-0924`).
  const doOriginal = {
    'de gelo em área': { cor: '#99ffff', fx: 42 },
    'de gelo em feixe': { cor: '#99ffff', fx: 53 },
    'sagrado em área': { cor: '#ffff00', fx: 50 },
    'de energia em feixe': { cor: '#cc33cc', fx: 38 },
  };
  const e = personagemDeTeste({ level: 3000 });
  Prey.garantir(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'winter-dream-court', mode: 'auto' }).ok);
  e.maxHp = e.hp = 1e12;
  // Com cada bicho no andar dele, os 4 Thanatursus do andar 7 (os das magias
  // sagrada e de energia) ficam longe da entrada, e o personagem de teste briga
  // com a leva da porta o tempo todo. O teste é das magias, não da rota: um
  // deles vem para o lado dele.
  const urso = e.hunt.monstros.find((m) => m.key === 'thanatursus');
  assert.ok(urso, 'há Thanatursus no andar da entrada');
  Object.assign(urso, { x: e.hunt.pos.x, y: e.hunt.pos.y - 1 });
  const vistos = {};
  let t = Date.now();
  e.hunt.ultimoTique = t;
  for (let i = 0; i < 4 * 180 && e.hunt; i++) {
    t += 250;
    e.hp = e.maxHp;
    const ev = Cacadas.tique(e, PERSONAGEM, t) ?? [];
    for (const g of ev.filter((x) => x.t === 'dmg' && !x.foe && doOriginal[x.golpe])) {
      (vistos[g.golpe] ??= { cores: new Set(), fx: new Set(), max: 0 }).cores.add(g.color);
      vistos[g.golpe].max = Math.max(vistos[g.golpe].max, g.v);
      // (A área sai num evento `area` com as casas — o efeito é o mesmo.)
      for (const f of ev.filter((x) => x.t === 'fx' || x.t === 'area')) vistos[g.golpe].fx.add(f.id);
    }
  }
  assert.ok(Object.keys(vistos).length >= 3, `magias vistas: ${Object.keys(vistos)}`);
  for (const [golpe, v] of Object.entries(vistos)) {
    assert.deepEqual([...v.cores], [doOriginal[golpe].cor], golpe);
    assert.ok(v.fx.has(doOriginal[golpe].fx), `${golpe}: efeito ${doOriginal[golpe].fx}`);
    assert.ok(v.max <= 450, `${golpe}: ${v.max} acima do máximo do arquivo`);
  }
});

test('melee dos bichos é o do arquivo (Crazed Winter Rearguard: até 400, não 2.616)', async () => {
  const Poderes = await import('../systems/poderes.mjs');
  let max = 0;
  for (let i = 0; i < 2000; i++) max = Math.max(max, Poderes.golpeCorpoACorpo({ key: 'crazed-winter-rearguard' }));
  assert.ok(max <= 400 && max > 300, `máximo ${max}`);
});

test('bicho novo não solta todas as magias no primeiro tique: o relógio de cada uma começa sorteado', { skip: doClassico("Salas e poderes dos bosses do Draevor (capturados do original)") }, async () => {
  const Poderes = await import('../systems/poderes.mjs');
  const Ficha = await import('../systems/ficha.mjs');
  const e = personagemDeTeste({ level: 300 });
  assert.ok(Cacadas.entrar(e, { huntId: huntDoPoe('werehyaenna-north'), mode: 'auto', dificuldade: 'medio' }).ok);
  e.hp = e.maxHp = 1e9;
  const agora = 1_000_000;
  const aleatorio = Math.random;
  Math.random = () => 0.5; // metade do intervalo; e 0.5*100 passaria nas chances <= 50
  try {
    for (const b of e.hunt.monstros) {
      const colado = { ...b, x: e.hunt.pos.x + 1, y: e.hunt.pos.y, proximoPoder: undefined };
      const eventos = [];
      assert.equal(Poderes.lancar(e, e.hunt, PERSONAGEM, colado, eventos, agora, Ficha.combate(e), false), 0, `${b.name} bateu na entrada`);
      for (const v of Object.values(colado.proximoPoder)) assert.ok(v > agora && v < agora + 2000, `relógio ${v - agora} ms`);
    }
  } finally {
    Math.random = aleatorio;
  }
});
