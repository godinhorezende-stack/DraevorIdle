// O MAPA de cada cidade de ato (08/11 — o dono: "Queria criar uma diferente para cada ato… igual do poe"; aprovou a Vigília de Lioneye e os
// pontos: "Ta bom esses pontos agr coloque os npcs"): a Vigília com o mapa dela (criado por tools/cidades-rme/criar.mjs), os NPCs do PoE
// (Nessa vende as gemas, Tarkleigh guarda o banco, Bestel conversa), a chegada, os portais, a forja e a árvore; o Ato 6 repete a Vigília; a
// cidade sem mapa próprio segue a de sempre. A posição de outra cidade vira a chegada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = (!existsSync(Catalogo.ARQUIVO) || !Catalogo.ligado()) && 'só no jogo oficial (PoE)';
const { personagemDeTeste } = await import('./apoio.mjs');
const CM = await import('../systems/cidades-mapas.mjs');
const { Sessao } = await import('../websocket/sessao.mjs');
const VIGILIA = 'poe-a1-lioneyes-watch';
const Cidades = await import('../systems/cidades.mjs');
// (09/11) Uma cidade de ato ainda SEM entrada em cidades.json (as cidades ganham mapa uma a uma): a que segue a de sempre.
const DEFINIDAS = new Set(JSON.parse((await import('node:fs')).readFileSync(new URL('../gamedata/cidades/cidades.json', import.meta.url), 'utf8')).cidades.map((c) => c.id));
const SEM_MAPA = Cidades.cidades().find((c) => !DEFINIDAS.has(c.id));

/** As casas andáveis alcançadas a pé da chegada da cidade. */
function alcancadas(id) {
  const g = CM.gradeDa(id);
  const c = CM.chegadaDa(id);
  const vis = new Set([`${c.x},${c.y}`]);
  const fila = [[c.x, c.y]];
  while (fila.length) {
    const [x, y] = fila.shift();
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const k = `${x + dx},${y + dy}`;
      if (!vis.has(k) && g.andavel.has(k)) { vis.add(k); fila.push([x + dx, y + dy]); }
    }
  }
  return vis;
}
const encosta = (vis, { x, y }) => [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => vis.has(`${x + dx},${y + dy}`)));

test('a Vigília de Lioneye tem o seu mapa; o Ato 6 usa o mesmo; a cidade sem mapa próprio segue a de sempre', { skip: SEM }, () => {
  assert.equal(CM.mapaIdDa(VIGILIA), VIGILIA);
  assert.equal(CM.mapaIdDa('poe-a6-lioneyes-watch'), VIGILIA, 'o PoE repete a Vigília no Ato 6');
  assert.equal(CM.mapaIdDa('poe-a2-the-forest-encampment'), 'poe-a2-the-forest-encampment', 'o Acampamento da Floresta tem o seu');
  assert.ok(SEM_MAPA, 'há cidade de ato ainda sem mapa');
  assert.equal(CM.mapaIdDa(SEM_MAPA.id), CM.SEMPRE);
  const m = CM.mapaDa(VIGILIA);
  assert.equal(m.atlas, `cidades/${VIGILIA}`);
  assert.equal(m.blocked.length, m.width * m.height);
  assert.equal(m.stacks.length, m.width * m.height);
  assert.ok(m.stacks.every((p) => p.length && p.every((i) => m.palette[i])), 'toda casa tem chão, e todo sprite está na paleta');
});

// Os NPCs do PoE de cada cidade (o dono: "os do PoE em cada ato"): uma loja de gemas e um banco em toda cidade com mapa.
const NPCS_DO_PoE = {
  'poe-a1-lioneyes-watch': [['Nessa', 'loja'], ['Tarkleigh', 'banco'], ['Bestel', 'fala']],
  'poe-a2-the-forest-encampment': [['Greust', 'banco'], ['Yeena', 'loja'], ['Silk', 'fala'], ['Helena', 'fala'], ['Eramir', 'fala']],
};
test('os NPCs do PoE em cada cidade com mapa, de pé em casa livre e alcançáveis da chegada; os marcos também', { skip: SEM }, () => {
  for (const [id, esperados] of Object.entries(NPCS_DO_PoE)) {
    const meta = CM.metaDa(id);
    assert.deepEqual(meta.npcs.map((n) => [n.name, n.tipo]), esperados, id);
    const c = CM.chegadaDa(id);
    assert.equal(CM.bloqueadoNa(id, c.x, c.y), false, `${id}: a chegada é andável`);
    const vis = alcancadas(id);
    for (const n of meta.npcs) {
      assert.equal(CM.bloqueadoNa(id, n.x, n.y), false, `${id}: ${n.name} em casa livre`);
      assert.ok(encosta(vis, n), `${id}: ${n.name} alcançável`);
    }
    for (const acao of ['aventuras', 'boss-diarios', 'forja', 'arvore']) assert.ok(meta.objetos.some((o) => o.acao === acao), `${id}: ${acao}`);
    for (const o of meta.objetos) {
      assert.ok(encosta(vis, o), `${id}: ${o.uid} alcançável`);
      if (o.pisar) assert.equal(CM.bloqueadoNa(id, o.x, o.y), false, `${id}: ${o.uid} (de pisar) em casa livre`);
    }
  }
});

test('a posição de outra cidade (ou fora do mapa) vira a chegada; a desta cidade fica', { skip: SEM }, () => {
  const e = personagemDeTeste({ level: 10 });
  e.atoDaCidade = 1;
  e.pos = { x: 99, y: 65, z: 7, dir: 2 };
  assert.deepEqual(CM.garantirPosicao(e), { ...CM.chegadaDa(VIGILIA), cidade: VIGILIA });
  e.pos = { x: 30, y: 21, z: 7, dir: 1, cidade: VIGILIA };
  assert.deepEqual(CM.garantirPosicao(e), { x: 30, y: 21, z: 7, dir: 1, cidade: VIGILIA });
  e.atoDaCidade = 6;
  assert.equal(CM.garantirPosicao(e).x, 30, 'a Vigília do Ato 6 é o mesmo mapa: a casa vale');
  e.atoDaCidade = SEM_MAPA.ato;
  assert.deepEqual(CM.garantirPosicao(e), { ...CM.chegadaDa(SEM_MAPA.id), cidade: CM.SEMPRE });
});

test('na Vigília: o retrato manda o mapa e os NPCs dela; Nessa abre a loja de gemas, Tarkleigh o banco, Bestel fala', { skip: SEM }, () => {
  const enviados = [];
  const s = new Sessao({ send: (t) => enviados.push(JSON.parse(t)), readyState: 1 });
  s.personagem = { id: 0, nome: 'Vigia' };
  s.estado = personagemDeTeste({ level: 10 });
  s.estado.atoDaCidade = 1;
  s.estado.pos = { x: 99, y: 65, z: 7, dir: 2 };
  s.mandarEstado(true);
  const city = enviados.findLast((m) => m.city)?.city;
  assert.equal(city.mapId, VIGILIA);
  assert.equal(city.map.width, CM.mapaDa(VIGILIA).width);
  assert.deepEqual(city.npcs.map((n) => n.id), ['nessa', 'tarkleigh', 'bestel']);
  assert.deepEqual([city.player.x, city.player.y], [CM.chegadaDa(VIGILIA).x, CM.chegadaDa(VIGILIA).y]);
  s.enviar = (m) => enviados.push(m);
  enviados.length = 0;
  s.falarComNpc({ id: 'nessa' });
  assert.equal(enviados.at(-1)?.tipo, 'loja');
  s.falarComNpc({ id: 'zuma' });
  assert.equal(enviados.at(-1)?.nome, 'Nessa', 'o pedido da loja de sempre vai para quem vende as gemas aqui');
  s.falarComNpc({ id: 'tarkleigh' });
  assert.equal(enviados.at(-1)?.tipo, 'banco');
  s.falarComNpc({ id: 'bestel' });
  assert.match(s.avisoPendente, /^Bestel: /);
});
