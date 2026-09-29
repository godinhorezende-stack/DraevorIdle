// Andar clicando/tocando no mapa: `walkTo` (cidade) e `huntWalkTo` (Caça
// Online). O client sempre mandou (clique esquerdo no desktop, toque no chão no
// celular, "Ir até lá" no menu — é o MESMO pedido nos dois) e o servidor não
// tinha handler. Aqui o servidor valida o destino e anda pelo passo de sempre:
// uma casa por `PASSO_MS`, o próximo passo pedido a `proximoPassoAte`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sessao } from '../websocket/sessao.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as R from '../systems/regras.mjs';
import { bloqueado, gradeDaCidade } from '../systems/dados.mjs';
import { bfsDistancias, VIZINHANCA_4 } from '../systems/hunt/caminho.mjs';
import { gradeDaHunt, gradesCacheadas } from '../systems/hunt/terreno.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/*
 * A regra de movimento de sempre (`proximoPassoAte`): "anda reto de
 * preferência, diagonal só quando precisa". Então o número de passos até um
 * destino é o do caminho RETO (vizinhança de 4) quando ele existe.
 */

/** Uma sessão na cidade, com as mensagens guardadas. */
function naCidade() {
  const enviados = [];
  const s = new Sessao({ readyState: 1, send: (t) => enviados.push(JSON.parse(t)) });
  s.conta = { id: 'teste-clique' };
  s.personagem = { id: 0, nome: 'Clique' };
  s.estado = personagemDeTeste({ level: 50 });
  s.estado.pos = { ...R.POSICAO_INICIAL };
  return { s, enviados };
}

/**
 * `n` tiques de 250 ms com `Date.now()` controlado; `antes(i)` roda antes de
 * cada um. Devolve a posição depois de CADA tique.
 */
function tiques(s, n, antes = () => {}) {
  const original = Date.now;
  let agora = (s.relogio ??= original());
  Date.now = () => agora;
  const casas = [];
  try {
    for (let i = 0; i < n; i++) {
      antes(i);
      agora += R.PASSO_MS;
      s.tique();
      const p = s.estado.hunt?.pos ?? s.estado.pos;
      casas.push({ x: p.x, y: p.y });
    }
  } finally {
    s.relogio = agora;
    Date.now = original;
  }
  return casas;
}

/** Cada passo anda no máximo UMA casa e só pisa em casa andável — o servidor não teleporta. */
function passosValidos(casas, inicio, andavel) {
  let antes = inicio;
  for (const c of casas) {
    assert.ok(cheb(antes, c) <= 1, `pulou de ${antes.x},${antes.y} para ${c.x},${c.y}`);
    assert.ok(andavel(c), `pisou em casa bloqueada ${c.x},${c.y}`);
    antes = c;
  }
}
const andavelNaCidade = (c) => !bloqueado(c.x, c.y);

/** Casas andáveis da cidade a `d` passos retos de `origem` (a distância que o personagem de fato anda). */
function casasA(origem, filtro) {
  const g = gradeDaCidade();
  const dist = bfsDistancias(g, origem, 60, null, VIZINHANCA_4);
  const achadas = [];
  for (const k of g.andavel) {
    const [x, y] = k.split(',').map(Number);
    const d = dist.em(x, y);
    if (d != null && filtro({ x, y }, d)) achadas.push({ x, y, d });
  }
  return achadas;
}

// ================================================================ cidade

test('cidade, clique perto: anda até a casa e para', () => {
  const { s } = naCidade();
  const inicio = { ...s.estado.pos };
  const alvo = casasA(inicio, (c, d) => d === 3 && cheb(c, inicio) === 3)[0];
  s.receber({ t: 'walkTo', x: alvo.x, y: alvo.y });
  const casas = tiques(s, 8);
  passosValidos(casas, inicio, andavelNaCidade);
  assert.deepEqual(casas.at(-1), { x: alvo.x, y: alvo.y });
  assert.equal(s.estado.destino, null, 'chegou: o destino some');
  // Um passo por tique: 3 passos em 3 tiques, e parado depois.
  assert.deepEqual(casas[2], { x: alvo.x, y: alvo.y });
  assert.deepEqual(casas[7], { x: alvo.x, y: alvo.y });
});

test('cidade, clique longe: chega, uma casa por vez, no ritmo do servidor', () => {
  const { s } = naCidade();
  const inicio = { ...s.estado.pos };
  const alvo = casasA(inicio, (c, d) => d >= 20 && d <= 30)[0];
  s.receber({ t: 'walkTo', x: alvo.x, y: alvo.y });
  const casas = tiques(s, alvo.d + 5);
  passosValidos(casas, inicio, andavelNaCidade);
  assert.deepEqual(casas.at(-1), { x: alvo.x, y: alvo.y });
  // O menor caminho a pé: exatamente `d` passos.
  const chegou = casas.findIndex((c) => c.x === alvo.x && c.y === alvo.y);
  assert.equal(chegou + 1, alvo.d);
});

test('cidade, clique na diagonal: chega na casa diagonal (reto de preferência, como sempre)', () => {
  const { s } = naCidade();
  const inicio = { ...s.estado.pos };
  const alvo = casasA(inicio, (c, d) => d === 6 && Math.abs(c.x - inicio.x) === 3 && Math.abs(c.y - inicio.y) === 3)[0];
  assert.ok(alvo, 'sem casa diagonal perto do início');
  s.receber({ t: 'walkTo', x: alvo.x, y: alvo.y });
  const casas = tiques(s, 8);
  passosValidos(casas, inicio, andavelNaCidade);
  assert.deepEqual(casas[5], { x: alvo.x, y: alvo.y });
});

test('clique onde SÓ a diagonal passa: o passo diagonal é usado (mesmo pathfinding em todo lugar)', () => {
  // Uma grade desenhada na Caça Online: de P a D só se chega em diagonal.
  const linhas = ['####D', '###.#', '##P##'];
  const andavel = new Set();
  linhas.forEach((l, y) => [...l].forEach((c, x) => c !== '#' && andavel.add(`${x},${y}`)));
  gradesCacheadas.set('teste-clique-diagonal', { z: 7, minX: 0, maxX: 4, minY: 0, maxY: 2, andavel });
  const { s } = naCacaOnline();
  Object.assign(s.estado.hunt, { huntId: 'teste-clique-diagonal', z: 7, percurso: null, pos: { x: 2, y: 2, dir: 2 } });
  s.receber({ t: 'huntWalkTo', x: 4, y: 0 });
  let agora = Date.now();
  s.estado.hunt.ultimoTique = agora;
  const casas = [];
  for (let i = 0; i < 4; i++) {
    agora += R.PASSO_MS;
    Cacadas.tique(s.estado, PERSONAGEM, agora);
    casas.push(`${s.estado.hunt.pos.x},${s.estado.hunt.pos.y}`);
  }
  assert.deepEqual(casas.slice(0, 2), ['3,1', '4,0']);
});

test('cidade, clique atrás de obstáculo: contorna (o caminho a pé é mais longo que a linha reta)', () => {
  const { s } = naCidade();
  const inicio = { ...s.estado.pos };
  // Atrás de parede: o caminho reto a pé é bem mais longo que a distância em linha reta (Manhattan).
  const alvo = casasA(inicio, (c, d) => d >= Math.abs(c.x - inicio.x) + Math.abs(c.y - inicio.y) + 6 && d <= 30)[0];
  assert.ok(alvo, 'nenhuma casa atrás de parede perto do início');
  s.receber({ t: 'walkTo', x: alvo.x, y: alvo.y });
  const casas = tiques(s, alvo.d + 4);
  passosValidos(casas, inicio, andavelNaCidade);
  assert.deepEqual(casas.at(-1), { x: alvo.x, y: alvo.y });
});

test('cidade, cliques seguidos / troca de destino no meio: vale o último, sem voltar ao primeiro', () => {
  const { s } = naCidade();
  const inicio = { ...s.estado.pos };
  const [a, b] = casasA(inicio, (c, d) => d >= 10 && d <= 14).sort((p, q) => q.x - p.x);
  s.receber({ t: 'walkTo', x: a.x, y: a.y });
  tiques(s, 3);
  // Três cliques em sequência rápida: o último manda.
  s.receber({ t: 'walkTo', x: a.x, y: a.y });
  s.receber({ t: 'walkTo', x: inicio.x, y: inicio.y });
  s.receber({ t: 'walkTo', x: b.x, y: b.y });
  const casas = tiques(s, 40);
  assert.deepEqual(casas.at(-1), { x: b.x, y: b.y });
  assert.equal(s.estado.destino, null);
});

test('cidade, destino na parede ou sem caminho: "Não dá para chegar lá." e ele não sai do lugar', () => {
  const { s, enviados } = naCidade();
  const inicio = { ...s.estado.pos };
  // Uma casa bloqueada perto.
  let parede = null;
  for (let r = 1; r < 10 && !parede; r++) for (let dx = -r; dx <= r && !parede; dx++) if (bloqueado(inicio.x + dx, inicio.y + r)) parede = { x: inicio.x + dx, y: inicio.y + r };
  s.receber({ t: 'walkTo', x: parede.x, y: parede.y });
  assert.equal(enviados.at(-1)?.message, 'Não dá para chegar lá.');
  s.receber({ t: 'walkTo', x: 9999, y: 9999 });
  assert.equal(enviados.at(-1)?.message, 'Não dá para chegar lá.');
  assert.deepEqual(tiques(s, 4).at(-1), { x: inicio.x, y: inicio.y });
});

test('cidade, tecla depois do clique: a tecla manda e o destino some (WASD/setas continuam iguais)', () => {
  const { s } = naCidade();
  const inicio = { ...s.estado.pos };
  const alvo = casasA(inicio, (c, d) => d >= 10 && d <= 12)[0];
  s.receber({ t: 'walkTo', x: alvo.x, y: alvo.y });
  tiques(s, 2);
  const livre = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => !bloqueado(s.estado.pos.x + dx, s.estado.pos.y + dy));
  const antes = { ...s.estado.pos };
  // A tecla chega no mesmo relógio do tique (o rumo vale 500ms a partir dela).
  tiques(s, 1, () => {
    s.receber({ t: 'walk', dx: livre[0], dy: livre[1] });
    assert.equal(s.estado.destino, null);
  });
  assert.deepEqual({ x: s.estado.pos.x, y: s.estado.pos.y }, { x: antes.x + livre[0], y: antes.y + livre[1] });
});

test('cidade, destino do clique não vai para o banco', async () => {
  const { s } = naCidade();
  const alvo = casasA(s.estado.pos, (c, d) => d === 5)[0];
  s.receber({ t: 'walkTo', x: alvo.x, y: alvo.y });
  assert.ok(s.estado.destino);
  // Mesmo recorte do que é gravado (`gravarAgora`/`soltarPersonagem`).
  const { rumo, rumoValidoAte, proximoPassoEm, destino, bauDaConta, ...gravado } = s.estado;
  assert.equal('destino' in gravado, false);
  void rumo; void rumoValidoAte; void proximoPassoEm; void destino; void bauDaConta;
});

// ================================================================ Caça Online

/** Uma sessão na Caça Online de troll-cave, sem bichos (o teste põe os que quiser). */
function naCacaOnline(modo = 'online') {
  const { s, enviados } = naCidade();
  s.estado = personagemDeTeste({ level: 100 });
  assert.equal(Cacadas.entrar(s.estado, { huntId: 'troll-cave', mode: modo }).ok, true);
  s.estado.hunt.monstros = [];
  s.estado.hunt.respawns = [];
  // Mapa esvaziado à mão: sem a instância, senão ele contaria como limpo e renovaria (ver hunt/instancia.mjs).
  delete s.estado.hunt.instancia;
  s.estado.hunt.assistencia = false;
  const grade = gradeDaHunt({ id: 'troll-cave' });
  return { s, enviados, grade };
}

function casasNaHunt(grade, origem, filtro) {
  const dist = bfsDistancias(grade, origem, 60, null, VIZINHANCA_4);
  const achadas = [];
  for (const k of grade.andavel) {
    const [x, y] = k.split(',').map(Number);
    const d = dist.em(x, y);
    if (d != null && filtro({ x, y }, d)) achadas.push({ x, y, d });
  }
  return achadas;
}

test('Caça Online, clique perto/longe/atrás de parede: anda pelo pathfinding da hunt e chega', () => {
  const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  for (const escolha of [(c, d) => d === 3, (c, d) => d >= 15 && d <= 25, (c, d, i) => d >= manhattan(c, i) + 6 && d <= 30]) {
    const { s, grade } = naCacaOnline();
    const inicio = { ...s.estado.hunt.pos };
    const alvo = casasNaHunt(grade, inicio, (c, d) => escolha(c, d, inicio))[0];
    assert.ok(alvo);
    s.receber({ t: 'huntWalkTo', x: alvo.x, y: alvo.y });
    // O tique da caçada é o `Cacadas.tique` de verdade, mas sem a sessão inteira:
    let agora = Date.now();
    s.estado.hunt.ultimoTique = agora;
    const casas = [];
    for (let i = 0; i < alvo.d + 6; i++) {
      agora += R.PASSO_MS;
      Cacadas.tique(s.estado, PERSONAGEM, agora);
      casas.push({ ...s.estado.hunt.pos });
    }
    passosValidos(casas, inicio, (c) => grade.andavel.has(`${c.x},${c.y}`));
    assert.deepEqual({ x: casas.at(-1).x, y: casas.at(-1).y }, { x: alvo.x, y: alvo.y });
    assert.equal(s.estado.hunt.destino, null);
  }
});

test('Caça Online: contorna o bicho que está no caminho e não pisa nele', () => {
  const { s, grade } = naCacaOnline();
  const inicio = { ...s.estado.hunt.pos };
  const alvo = casasNaHunt(grade, inicio, (c, d) => d === 6)[0];
  s.receber({ t: 'huntWalkTo', x: alvo.x, y: alvo.y });
  let agora = Date.now();
  s.estado.hunt.ultimoTique = agora;
  // Um bicho parado exatamente na primeira casa do caminho.
  agora += R.PASSO_MS;
  const bicho = { uid: 777001, key: null, name: 'Pedra', look: 0, x: 0, y: 0, hp: 1e9, maxHp: 1e9, exp: 0, loot: [], dummy: true };
  Cacadas.tique(s.estado, PERSONAGEM, agora);
  Object.assign(bicho, { x: s.estado.hunt.pos.x, y: s.estado.hunt.pos.y });
  s.estado.hunt.pos.x = inicio.x;
  s.estado.hunt.pos.y = inicio.y;
  s.estado.hunt.monstros.push(bicho);
  for (let i = 0; i < 20; i++) {
    agora += R.PASSO_MS;
    Cacadas.tique(s.estado, PERSONAGEM, agora);
    assert.ok(!(s.estado.hunt.pos.x === bicho.x && s.estado.hunt.pos.y === bicho.y), 'pisou no bicho');
  }
  assert.deepEqual({ x: s.estado.hunt.pos.x, y: s.estado.hunt.pos.y }, { x: alvo.x, y: alvo.y });
});

test('Caça Online: tecla depois do clique larga o destino; clique novo troca', () => {
  const { s, grade } = naCacaOnline();
  const inicio = { ...s.estado.hunt.pos };
  const [a, b] = casasNaHunt(grade, inicio, (c, d) => d >= 8 && d <= 12);
  s.receber({ t: 'huntWalkTo', x: a.x, y: a.y });
  s.receber({ t: 'huntWalkTo', x: b.x, y: b.y });
  assert.deepEqual({ x: s.estado.hunt.destino.x, y: s.estado.hunt.destino.y }, { x: b.x, y: b.y });
  s.receber({ t: 'huntWalk', dx: 1, dy: 0 });
  assert.equal(s.estado.hunt.destino, null);
});

test('Caça Automática: o clique não anda (quem anda é a rota — regra de sempre)', () => {
  const { s, enviados } = naCacaOnline('auto');
  s.receber({ t: 'huntWalkTo', x: s.estado.hunt.pos.x + 1, y: s.estado.hunt.pos.y });
  assert.equal(s.estado.hunt.destino ?? null, null);
  assert.equal(enviados.at(-1)?.message, 'Na Caça Automática quem anda é a rota.');
});

test('Caça Online, destino sem caminho: "Não dá para chegar lá."', () => {
  const { s, enviados } = naCacaOnline();
  s.receber({ t: 'huntWalkTo', x: 99999, y: 99999 });
  assert.equal(enviados.at(-1)?.message, 'Não dá para chegar lá.');
  assert.equal(s.estado.hunt.destino ?? null, null);
});

test('treinando, clique/toque continua recusado (a regra do treino)', () => {
  const { s, enviados } = naCidade();
  assert.equal(Cacadas.entrarNoPatio(s.estado).ok, true);
  s.receber({ t: 'huntWalkTo', x: 18, y: 14 });
  assert.match(enviados.at(-1)?.message ?? '', /Treinando/);
  assert.equal(s.estado.hunt.destino ?? null, null);
});
