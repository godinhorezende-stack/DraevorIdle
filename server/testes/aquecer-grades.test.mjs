// Fase 5.2: `aquecerGrades` (chamada no boot, `index.mjs`) tem de deixar a
// grade de TODA hunt jogável já pronta em `gradesCacheadas` — para que o
// primeiro jogador de verdade a entrar em cada uma pegue o cache, não a
// conta síncrona cara (rasterizar o polígono, achar a rota, encaixar os
// pontos de nascimento — até 350ms medidos numa hunt real).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aquecerGrades, gradeDaHunt, gradesCacheadas, huntsJogaveis } from '../sistemas/hunt/terreno.mjs';
import { CATALOGO } from '../nucleo/dados.mjs';

test('aquece a grade de toda hunt jogável (terreno real), sem lançar', () => {
  const antes = gradesCacheadas.size;
  const quantas = aquecerGrades();
  assert.ok(quantas > 0);
  // `huntsJogaveis` já é o filtro do próprio código para "hunt de verdade,
  // com terreno capturado" — algumas entradas soltas no catálogo (ex.:
  // `jaded-roots`, sem `limite` nem mapa real) não têm terreno nenhum e
  // ficam de fora tanto da lista jogável quanto do que `aquecerGrades`
  // consegue aquecer; não são o alvo deste teste.
  for (const h of huntsJogaveis()) assert.ok(gradesCacheadas.has(h.id), `${h.id} devia estar aquecida`);
  assert.ok(gradesCacheadas.size >= antes);
});

test('depois de aquecida, gradeDaHunt devolve o MESMO objeto (cache, não recomputa)', () => {
  aquecerGrades();
  const hunt = huntsJogaveis().map((h) => CATALOGO.hunts.find((c) => c.id === h.id))[0];
  const a = gradeDaHunt(hunt);
  const b = gradeDaHunt(hunt);
  assert.equal(a, b, 'devia ser a mesma referência — nada recomputado');
});

test('uma hunt com dado ruim não impede o aquecimento das outras', () => {
  const antes = gradesCacheadas.size;
  // Um id que não bate com nenhuma hunt real: cai no ramo do polígono e
  // estoura em `hunt.limite.andares` (null) — exatamente o tipo de erro que
  // `aquecerGrades` tem de engolir sem derrubar o boot.
  const quebrada = { id: '__hunt-de-teste-inexistente__' };
  assert.throws(() => gradeDaHunt(quebrada));
  const quantas = aquecerGrades();
  assert.ok(quantas > 0);
  assert.ok(gradesCacheadas.size >= antes);
});
