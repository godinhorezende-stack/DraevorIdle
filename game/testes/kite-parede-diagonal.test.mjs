// O RECUO do kite perto de parede (dono, 02/10): o deslize nunca se aproxima do alvo — a rota inteira, não só o 1º passo. Antes, o caminho mais
// curto até a casa longe do alvo passava ao lado dele, o 1º passo era recusado e o personagem ficava parado levando dano, mesmo com uma rota
// (diagonal ou lateral) que não se aproxima. Cenários no `tique` de verdade, em grades desenhadas (como `progresso-da-hunt.test.mjs`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as R from '../systems/regras.mjs';
import { gradesCacheadas } from '../systems/hunt/terreno.mjs';
import * as Caminho from '../systems/hunt/caminho.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';
let proximaGrade = 0;

/**
 * Uma grade a partir de um desenho: `.` chão, `#` parede, `P` o personagem,
 * `M` o alvo (e `m` outros bichos) — as três letras são chão também.
 */
function desenho(linhas) {
  const andavel = new Set();
  const achados = { P: null, M: null, m: [] };
  linhas.forEach((linha, y) =>
    [...linha].forEach((c, x) => {
      if (c !== '#') andavel.add(`${x},${y}`);
      if (c === 'P') achados.P = { x, y };
      if (c === 'M') achados.M = { x, y };
      if (c === 'm') achados.m.push({ x, y });
    }),
  );
  const id = `teste-progresso-${++proximaGrade}`;
  const grade = { z: 7, minX: 0, maxX: linhas[0].length - 1, minY: 0, maxY: linhas.length - 1, andavel };
  /*
   * Contador de buscas: toda BFS (`bfsDistancias`) lê `grade.numerica` logo de
   * cara. Um getter aqui conta quantas buscas o tique fez nesta grade.
   */
  const numerica = Caminho.gradeNumerica({ ...grade });
  const buscas = { n: 0 };
  Object.defineProperty(grade, 'numerica', {
    get() {
      buscas.n++;
      return numerica;
    },
  });
  gradesCacheadas.set(id, grade);
  return { id, grade, buscas, ...achados };
}

let uid = 900_000;
const bicho = (pos, extra = {}) => ({
  uid: ++uid, key: null, name: 'Alvo de Teste', look: 0, x: pos.x, y: pos.y, dir: 2,
  hp: 1e9, maxHp: 1e9, exp: 0, loot: [], perseguindo: true, proximoPasso: Infinity, ...extra,
});

/**
 * Um personagem caçando no desenho. `distancia` > 0 é o kite (sorcerer com
 * wand); 0 é corpo a corpo (knight). O bicho fica parado (`proximoPasso:
 * Infinity`) a menos que o teste o mova.
 */
function naGrade(linhas, { vocacao = 'knight', distancia = 0, percurso = null } = {}) {
  const g = desenho(linhas);
  const e = personagemDeTeste({ vocacao, level: 600 });
  e.settings.distance = distancia;
  assert.equal(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto', strategy: 'nearest' }).ok, true);
  const alvo = bicho(g.M);
  Object.assign(e.hunt, {
    huntId: g.id, z: 7, pos: { ...g.P, dir: 2 }, percurso, respawns: [], outrosAndares: {},
    monstros: [alvo, ...g.m.map((p) => bicho(p, { name: 'Outro' }))],
  });
  if (percurso) g.grade.percurso = percurso.pontos;
  return { e, alvo, grade: g.grade, buscas: g.buscas };
}

/** `n` tiques de 250 ms; `antes(i)` roda antes de cada um (o teste mexe no bicho ali). Devolve as casas, tique a tique. */
const relogios = new WeakMap();
function rodar(e, n, antes = () => {}) {
  // O relógio continua de uma chamada para a outra (o passo seguinte já está agendado nele).
  let agora = relogios.get(e) ?? Date.now();
  if (!relogios.has(e)) e.hunt.ultimoTique = agora;
  const casas = [];
  for (let i = 0; i < n; i++) {
    antes(i);
    agora += R.PASSO_MS;
    e.hp = e.maxHp = 1e12;
    Cacadas.tique(e, PERSONAGEM, agora);
    casas.push(`${e.hunt.pos.x},${e.hunt.pos.y}`);
  }
  relogios.set(e, agora);
  return casas;
}

/** Os passos dados (casas diferentes seguidas), sem as paradas. */
const passos = (casas) => casas.filter((c, i) => i === 0 || c !== casas[i - 1]);

/**
 * Quantas vezes o personagem VOLTOU a uma casa de onde já tinha saído — o
 * sintoma de qualquer ciclo (A → B → A, A → B → B → A, A → B → C → A).
 */
function retornos(casas) {
  const vistas = new Set();
  let n = 0;
  for (const c of passos(casas)) {
    if (vistas.has(c)) n++;
    vistas.add(c);
  }
  return n;
}

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));


const V8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Existe casa mais longe do alvo, a até 5 passos, por um caminho que NUNCA fica mais perto dele que a casa atual? */
function haSaidaSemSeAproximar(linhas, p, m) {
  const andavel = new Set();
  linhas.forEach((l, y) => [...l].forEach((c, x) => { if (c !== '#') andavel.add(`${x},${y}`); }));
  const d0 = cheb(p, m);
  const dist = new Map([[`${p.x},${p.y}`, 0]]);
  const fila = [p];
  let melhor = d0;
  while (fila.length) {
    const c = fila.shift();
    const dc = dist.get(`${c.x},${c.y}`);
    melhor = Math.max(melhor, cheb(c, m));
    if (dc >= 5) continue;
    for (const [dx, dy] of V8) {
      const q = { x: c.x + dx, y: c.y + dy };
      const k = `${q.x},${q.y}`;
      if (!andavel.has(k) || dist.has(k) || (q.x === m.x && q.y === m.y) || cheb(q, m) < d0) continue;
      dist.set(k, dc + 1);
      fila.push(q);
    }
  }
  return melhor > d0;
}

test('R1. borda atrás, bicho na mesma linha, saída só passando por baixo/diagonal: o kite sai e se afasta (antes ficava parado)', () => {
  // O caso medido: o caminho mais curto até uma casa longe passava ao lado do bicho; a rota que nunca se aproxima é um pouco maior.
  const linhas = ['#.....#.#', 'P.M....##', '.....#..#', '#.....#..', '........#', '#.##.#...', '....#..#.'];
  const { e, alvo } = naGrade(linhas, { vocacao: 'sorcerer', distancia: 4 });
  assert.ok(haSaidaSemSeAproximar(linhas, { x: 0, y: 1 }, { x: 2, y: 1 }));
  const casas = rodar(e, 24);
  assert.ok(cheb(e.hunt.pos, alvo) >= 3, `ficou em ${casas.at(-1)}, a ${cheb(e.hunt.pos, alvo)} do bicho`);
  assert.equal(retornos(casas), 0, `vaivém: ${passos(casas).join(' ')}`);
  for (const c of passos(casas)) assert.ok(!linhas[Number(c.split(',')[1])][Number(c.split(',')[0])].includes('#'), `pisou em parede: ${c}`);
});

test('R2. encostado na parede com a abertura na diagonal: usa a diagonal e continua a uma distância segura', () => {
  const { e, alvo } = naGrade([
    '#######',
    '#.....#',
    '#.P.M.#',
    '#..#..#',
    '#.....#',
    '#######',
  ], { vocacao: 'sorcerer', distancia: 4 });
  const casas = rodar(e, 20);
  assert.equal(retornos(casas), 0, passos(casas).join(' '));
  assert.ok(cheb(e.hunt.pos, alvo) >= 2);
});

test('R3. sem nenhuma casa que afaste sem se aproximar (corredor fechado): fica parado e sem refazer a busca a cada tique', () => {
  const { e, buscas } = naGrade([
    '#######',
    'P.M....',
    '#######',
  ], { vocacao: 'sorcerer', distancia: 4 });
  const casas = rodar(e, 30);
  assert.equal(new Set(casas).size, 1, `andou: ${passos(casas).join(' ')}`);
  assert.ok(buscas.n <= 12, `${buscas.n} buscas em 30 tiques`);
});

test('R4. fuzz com semente: em 500 posições aleatórias perto de paredes, nunca fica parado havendo saída que não se aproxima, nunca entra em vaivém e nunca pisa em parede', () => {
  let seed = 4242;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let casos = 0;
  for (let n = 0; n < 500; n++) {
    const W = 9;
    const H = 7;
    const g = Array.from({ length: H }, () => Array.from({ length: W }, () => (rnd() < 0.28 ? '#' : '.')));
    const livre = () => { for (let k = 0; k < 50; k++) { const x = Math.floor(rnd() * W); const y = Math.floor(rnd() * H); if (g[y][x] === '.') return { x, y }; } return null; };
    const p = livre();
    const m = livre();
    if (!p || !m) continue;
    const d = cheb(p, m);
    if (d < 1 || d > 2) continue;
    g[p.y][p.x] = 'P';
    g[m.y][m.x] = 'M';
    const linhas = g.map((l) => l.join(''));
    if (!haSaidaSemSeAproximar(linhas, p, m)) continue;
    casos++;
    const { e, alvo } = naGrade(linhas, { vocacao: 'sorcerer', distancia: 4 });
    const casas = rodar(e, 24);
    assert.ok(cheb(e.hunt.pos, alvo) > d, `preso: ${p.x},${p.y} → ${casas.at(-1)} (bicho ${m.x},${m.y})\n${linhas.join('\n')}`);
    assert.equal(retornos(casas), 0, `vaivém: ${passos(casas).join(' ')}\n${linhas.join('\n')}`);
    for (const c of passos(casas)) assert.ok(linhas[Number(c.split(',')[1])][Number(c.split(',')[0])] !== '#', `pisou em parede ${c}`);
  }
  assert.ok(casos >= 60, `poucos casos úteis (${casos})`);
});

test('R5. corpo a corpo (Distância 0) não faz kite: continua colando no bicho mesmo perto da parede', () => {
  const { e, alvo } = naGrade([
    'P.M....',
    '.......',
  ], { vocacao: 'knight', distancia: 0 });
  rodar(e, 12);
  assert.equal(cheb(e.hunt.pos, alvo), 1);
});

test('R6. bicho que cola a cada passo (mesma velocidade): o kite desiste depois de 3 recuos sem ganhar distância e bate de onde está, tentando de novo depois da folga', () => {
  const { e, alvo } = naGrade([
    '..................................',
    '.......P..M.......................',
    '..................................',
  ], { vocacao: 'sorcerer', distancia: 4 });
  // O bicho acompanha: a cada tique volta a ficar a 1 casa do personagem (cola, na mesma velocidade).
  const cola = () => { alvo.x = e.hunt.pos.x + (e.hunt.pos.x > 2 ? 1 : -1); alvo.y = e.hunt.pos.y; };
  const casas = rodar(e, 24, cola);
  const andou = passos(casas).length - 1;
  assert.ok(andou >= 1 && andou <= 12, `andou ${andou} passos em 6 s com o bicho colado`);
  assert.ok(e.hunt.kite.paradoAte > 0, 'registrou a folga do recuo');
});
