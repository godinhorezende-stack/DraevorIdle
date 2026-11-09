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
const Campanha = await import('../systems/campanha.mjs');
const MapasDispositivo = await import('../systems/mapas-dispositivo.mjs');
// (09/11) Uma cidade de ato SEM entrada em cidades.json segue a de sempre. Todas as dos atos já têm a sua: a do teste é registrada só
// durante o teste (e a lista de antes volta no fim).
const SEM_MAPA = { id: 'cidade-de-teste-sem-mapa', nome: 'Cidade de Teste', ato: 99 };
function comCidadeSemMapa(fn) {
  const antes = Cidades.cidades();
  Cidades.registrar([...antes, SEM_MAPA]);
  try {
    return fn();
  } finally {
    Cidades.registrar(antes);
  }
}

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
  assert.equal(CM.mapaIdDa('poe-a6-lioneyes-watch'), 'poe-a6-lioneyes-watch', 'o Ato 6 tem a Vigília depois da guerra (o dono, 09/11: "opção 3")');
  assert.equal(CM.mapaIdDa('poe-a8-the-sarn-encampment'), 'poe-a3-the-sarn-encampment', 'o PoE repete Sarn no Ato 8');
  assert.equal(CM.mapaIdDa('poe-a2-the-forest-encampment'), 'poe-a2-the-forest-encampment', 'o Acampamento da Floresta tem o seu');
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
  'poe-a3-the-sarn-encampment': [['Clarissa', 'loja'], ['Hargan', 'banco'], ['Maramoa', 'fala'], ['Grigor', 'fala']],
  'poe-a4-highgate': [['Petarus e Vanja', 'loja'], ['Tasuni', 'banco'], ['Dialla', 'fala'], ['Oyun', 'fala']],
  'poe-a5-overseers-tower': [['Lani', 'loja'], ['Bannon', 'banco'], ['Utula', 'fala']],
  'poe-a6-lioneyes-watch': [['Lilly Roth', 'loja'], ['Tarkleigh', 'banco'], ['Bestel', 'fala']],
  'poe-a7-the-bridge-encampment': [['Lilly Roth', 'loja'], ['Weylam Roth', 'banco'], ['Helena', 'fala'], ['Eramir', 'fala']],
  'poe-a10-oriath-docks': [['Lilly Roth', 'loja'], ['Bannon', 'banco'], ['Lani', 'fala']],
  'poe-a11-karui-shores': [['Lilly Roth', 'loja'], ['Utula', 'banco'], ['Kirac', 'fala']],
};
test('os NPCs do PoE em cada cidade com mapa, de pé em casa livre, com colisão e alcançáveis da chegada; os marcos também', { skip: SEM }, () => {
  for (const [id, esperados] of Object.entries(NPCS_DO_PoE)) {
    const meta = CM.metaDa(id);
    assert.deepEqual(meta.npcs.map((n) => [n.name, n.tipo]), esperados, id);
    const c = CM.chegadaDa(id);
    assert.equal(CM.bloqueadoNa(id, c.x, c.y), false, `${id}: a chegada é andável`);
    const vis = alcancadas(id);
    for (const n of meta.npcs) {
      const m = CM.mapaDa(id);
      assert.equal(m.blocked[n.y * m.width + n.x], 0, `${id}: ${n.name} em casa livre do mapa`);
      // (09/11 — o dono: "npc tem colisão tbm") ninguém passa por cima do NPC: a casa dele bloqueia o passo e o caminho
      assert.equal(CM.bloqueadoNa(id, n.x, n.y), true, `${id}: ${n.name} tem colisão`);
      assert.equal(CM.gradeDa(id).andavel.has(`${n.x},${n.y}`), false, `${id}: o caminho desvia de ${n.name}`);
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
  // a cidade que repete o mapa de outra (`igualA` — Sarn no Ato 8): a casa de lá vale aqui
  const SARN = 'poe-a3-the-sarn-encampment';
  const c = CM.chegadaDa(SARN);
  e.atoDaCidade = 3;
  e.pos = { x: c.x, y: c.y, z: 7, dir: 1, cidade: SARN };
  e.atoDaCidade = 8;
  assert.deepEqual(CM.garantirPosicao(e), { x: c.x, y: c.y, z: 7, dir: 1, cidade: SARN }, 'Sarn no Ato 8 é o mesmo mapa: a casa vale');
  // e a Vigília do Ato 6 (depois da guerra) é OUTRO mapa: quem estava na do Ato 1 vai para a chegada dela
  e.atoDaCidade = 6;
  e.pos = { x: 30, y: 21, z: 7, dir: 1, cidade: VIGILIA };
  assert.deepEqual(CM.garantirPosicao(e), { ...CM.chegadaDa('poe-a6-lioneyes-watch'), cidade: 'poe-a6-lioneyes-watch' });
  comCidadeSemMapa(() => {
    e.atoDaCidade = SEM_MAPA.ato;
    assert.deepEqual(CM.garantirPosicao(e), { ...CM.chegadaDa(SEM_MAPA.id), cidade: CM.SEMPRE });
  });
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

// (09/11, o dono: "Hub do endgame") A COSTA KARUI (o Epílogo): a cidade do ato 11, sem fases, abre ao vencer o chefe do Ato 10; quem o vence
// passa a morar nela; a viagem até ela é recusada antes; o Dispositivo de Mapas fica lá (o marco e a configuração).
test('o Epílogo: a Costa Karui abre ao vencer o chefe do Ato 10, vira a cidade de quem o vence e tem o Dispositivo de Mapas', { skip: SEM }, () => {
  const KARUI = 'poe-a11-karui-shores';
  assert.equal(Cidades.daCidadeDoAto(11)?.id, KARUI, 'a cidade do ato 11 está registrada');
  assert.deepEqual(Campanha.epilogo()?.id, KARUI);
  const e = personagemDeTeste({ level: 90 });
  for (const p of Object.values(e.campanha)) p.bosses = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  e.atoDaCidade = 10;
  assert.equal(Campanha.cidadeAberta(e, 11), false, 'fechada antes do chefe do Ato 10');
  const enviados = [];
  const s = new Sessao({ readyState: 1, send: (t) => enviados.push(JSON.parse(t)) });
  s.personagem = { id: 0, nome: 'Epilogo' };
  s.estado = e;
  s.receber({ t: 'irParaCidade', ato: 11 });
  assert.match(enviados.findLast((m) => m.t === 'error')?.message ?? '', /Ato 11 ainda não está aberto/);
  assert.equal(e.atoDaCidade, 10);
  Campanha.venceuBoss(e, 'facil', 10);
  assert.equal(Campanha.cidadeAberta(e, 11), true, 'aberta depois do chefe do Ato 10');
  assert.equal(e.atoDaCidade, 11, 'quem vence o chefe do Ato 10 passa a morar na Costa Karui');
  assert.equal(Campanha.paraCliente(e).epilogo?.aberto, true, 'a tela recebe o Epílogo aberto');
  e.atoDaCidade = 10;
  s.receber({ t: 'irParaCidade', ato: 11 });
  assert.equal(e.atoDaCidade, 11, 'a viagem até ela vale');
  assert.deepEqual({ x: e.pos.x, y: e.pos.y }, { x: CM.chegadaDa(KARUI).x, y: CM.chegadaDa(KARUI).y });
  assert.ok(CM.metaDa(KARUI).objetos.some((o) => o.acao === 'dispositivo'), 'o Dispositivo de Mapas na aldeia');
  assert.equal(MapasDispositivo.cidade(), KARUI, 'a configuração do dispositivo aponta para a Costa Karui');
});
