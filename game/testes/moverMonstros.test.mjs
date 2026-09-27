// moverMonstros com a grade de ocupação (fase 3): o mesmo resultado do
// `.some()` de antes, inclusive o caso sutil que fazia a grade ter de ser
// ATUALIZADA a cada passo do laço, e não uma fotografia do início do tique —
// um bicho que já andou libera a casa dele para o próximo bicho, no MESMO
// tique, porque o `.some()` original também lia posições já atualizadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moverMonstros, ALCANCE_DE_PERCEPCAO } from '../systems/hunt/monstros.mjs';

// Um corredor reto: y=5, x de 0 a 10 — cada casa andável, sem obstáculo.
// (o jogador precisa caber DENTRO da caixa minX..maxX: fora dela o BFS
// devolve tudo vazio de propósito — não é sobre o refatoramento.)
function grade() {
  const andavel = new Set();
  for (let x = 0; x <= 10; x++) andavel.add(`${x},5`);
  return { minX: 0, maxX: 10, minY: 5, maxY: 5, andavel };
}

// Uma sala aberta 6x6 — para dois bichos poderem mirar a MESMA casa vindo de
// lados diferentes (num corredor de 1 casa de largura isso não acontece: quem
// vem atrás sempre está na casa que o da frente acabou de deixar).
function sala() {
  const andavel = new Set();
  for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) andavel.add(`${x},${y}`);
  return { minX: 0, maxX: 5, minY: 0, maxY: 5, andavel };
}

const bicho = (uid, x, y, extra = {}) => ({
  uid, key: 'rat', x, y, dir: 2, hp: 100, maxHp: 100, perseguindo: true, proximoPasso: 0, ...extra,
});

test('um bicho anda uma casa em direção ao jogador', () => {
  const hunt = { pos: { x: 5, y: 5 }, monstros: [bicho(1, 2, 5)] };
  moverMonstros(hunt, grade(), 1000);
  assert.equal(hunt.monstros[0].x, 3);
});

test('dois bichos que mirariam a MESMA casa: só o primeiro do laço a ocupa, o outro não pisa nela', () => {
  // Sala aberta, jogador em (3,3). De (2,0) e de (4,0) — bichos que não estão
  // nem perto um do outro nem na casa que o outro quer —, o melhor passo dos
  // DOIS é a mesma casa livre, (3,0). É a mesma disputa que o `.some()` de
  // antes também resolvia lendo a posição JÁ ATUALIZADA de quem passou antes
  // no laço; aqui é a grade de ocupação que teria de acusar a mesma coisa.
  const hunt = { pos: { x: 3, y: 3 }, monstros: [bicho(1, 2, 0), bicho(2, 4, 0)] };
  moverMonstros(hunt, sala(), 1000);
  const [a, b] = hunt.monstros;
  assert.deepEqual([a.x, a.y], [3, 0], 'o primeiro do laço fica com a casa disputada');
  assert.notDeepEqual([b.x, b.y], [3, 0], 'o segundo não pisa em cima do primeiro');
  assert.notDeepEqual([b.x, b.y], [4, 0], 'e realmente andou — não travou parado');
});

test('um bicho que já andou libera a casa: o de trás pode ocupar no MESMO tique', () => {
  // Três em fila (2,3,4) indo na direção do jogador (em x=10): o da frente
  // (4) anda para 5, libera a casa 4; o do meio (3) anda para 4 — só possível
  // se a grade de ocupação tiver sido atualizada DENTRO do mesmo laço.
  const hunt = { pos: { x: 10, y: 5 }, monstros: [bicho(1, 4, 5), bicho(2, 3, 5), bicho(3, 2, 5)] };
  moverMonstros(hunt, grade(), 1000);
  const [frente, meio, tras] = hunt.monstros;
  assert.equal(frente.x, 5);
  assert.equal(meio.x, 4, 'o do meio devia ocupar a casa que o da frente acabou de deixar');
  assert.equal(tras.x, 3, 'o de trás devia poder avançar para a casa que o do meio deixou');
});

test('bicho morto não bloqueia, e ninguém pisa no jogador', () => {
  const hunt = {
    pos: { x: 4, y: 5 },
    monstros: [
      bicho(1, 2, 5, { hp: 0 }), // morto, na casa que o vivo tentaria ocupar
      bicho(2, 1, 5), // vivo, tentando andar para a direita (2,5) — morto não bloqueia
      bicho(3, 3, 5), // vivo, colado ao jogador (distância 1) — não anda, fica parado
    ],
  };
  moverMonstros(hunt, grade(), 1000);
  assert.equal(hunt.monstros[1].x, 2, 'não devia ser bloqueado pelo bicho morto');
  assert.equal(hunt.monstros[2].x, 3, 'colado ao jogador: fica parado');
});

test('fora do alcance de percepção, ninguém anda (sem BFS nenhum)', () => {
  const hunt = { pos: { x: 0, y: 5 }, monstros: [bicho(1, 9, 5, { perseguindo: false })] };
  moverMonstros(hunt, grade(), 1000);
  assert.equal(hunt.monstros[0].x, 9);
});

void ALCANCE_DE_PERCEPCAO; // só para documentar o import acima, se precisar ajustar a grade
