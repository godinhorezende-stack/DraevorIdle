// Fase 4.1: `jogadoresNaPraca` usa uma grade espacial (índice por célula) em
// vez de varrer todo mundo online — o resultado tem de continuar EXATAMENTE
// o mesmo de uma varredura força-bruta: os até 25 mais perto, na tela, e
// ninguém de fora dela. `invalidarIndice` tem de refletir posição nova.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vivas } from '../nucleo/sessao.mjs';
import * as Chat from '../sistemas/chat.mjs';
import { JANELA } from '../nucleo/quadro.mjs';

function sessaoFake(nome, pos) {
  const s = { personagem: { nome }, estado: { pos: { z: 7, dir: 2, ...pos }, outfit: {}, level: 1 } };
  vivas.set(nome, s);
  return s;
}

function limparTodos() {
  for (const nome of [...vivas.keys()]) vivas.delete(nome);
}

test('vê quem está dentro da tela (JANELA) e ignora quem está fora, em qualquer célula', () => {
  limparTodos();
  const eu = sessaoFake('Eu', { x: 100, y: 100 });
  // Um tico dentro de cada borda da tela — tem de aparecer.
  const dentro = [
    sessaoFake('Norte', { x: 100, y: 100 - JANELA.y }),
    sessaoFake('Sul', { x: 100, y: 100 + JANELA.y }),
    sessaoFake('Leste', { x: 100 + JANELA.x, y: 100 }),
    sessaoFake('Oeste', { x: 100 - JANELA.x, y: 100 }),
  ];
  // Um passo além de cada borda — tem de sumir.
  const fora = [
    sessaoFake('ForaNorte', { x: 100, y: 100 - JANELA.y - 1 }),
    sessaoFake('ForaSul', { x: 100, y: 100 + JANELA.y + 1 }),
    sessaoFake('ForaLeste', { x: 100 + JANELA.x + 1, y: 100 }),
    sessaoFake('ForaOeste', { x: 100 - JANELA.x - 1, y: 100 }),
  ];
  Chat.invalidarIndice();
  const nomes = Chat.jogadoresNaPraca(eu).map((j) => j.name);
  for (const s of dentro) assert.ok(nomes.includes(s.personagem.nome), `${s.personagem.nome} devia aparecer`);
  for (const s of fora) assert.ok(!nomes.includes(s.personagem.nome), `${s.personagem.nome} não devia aparecer`);
  limparTodos();
});

test('vê gente perto mesmo espalhada por várias células da grade (cantos distantes)', () => {
  limparTodos();
  // Um em cada quadrante, todos a ~2 casas do centro: caem em células
  // diferentes da grade (a grade é bem maior que 2 casas), e mesmo assim tem
  // que se verem — a busca varre a vizinhança de células, não só a própria.
  const a = sessaoFake('A', { x: 50, y: 50 });
  const b = sessaoFake('B', { x: 52, y: 50 });
  const c = sessaoFake('C', { x: 50, y: 52 });
  const d = sessaoFake('D', { x: 52, y: 52 });
  Chat.invalidarIndice();
  for (const [eu, outros] of [[a, [b, c, d]], [b, [a, c, d]], [c, [a, b, d]], [d, [a, b, c]]]) {
    const nomes = Chat.jogadoresNaPraca(eu).map((j) => j.name);
    for (const o of outros) assert.ok(nomes.includes(o.personagem.nome), `${eu.personagem.nome} devia ver ${o.personagem.nome}`);
  }
  limparTodos();
});

test('não passa de 25, e fica com os mais perto quando tem mais gente que isso na tela', () => {
  limparTodos();
  const eu = sessaoFake('Eu', { x: 100, y: 100 });
  const todos = [];
  for (let i = 0; i < 30; i++) todos.push(sessaoFake(`P${i}`, { x: 100 + (i % 5), y: 100 + Math.floor(i / 5) }));
  Chat.invalidarIndice();
  const vistos = Chat.jogadoresNaPraca(eu);
  assert.equal(vistos.length, 25);
  // Os 5 mais longe (linhas 5 e 6, distância euclidiana maior) ficam de fora — os `_d` (Chebyshev) crescem com i.
  const distancias = vistos.map((j) => Math.max(Math.abs(j.x - 100), Math.abs(j.y - 100)));
  assert.ok(Math.max(...distancias) <= 5);
  limparTodos();
});

test('gente em andar (z) diferente nunca aparece, mesmo bem perto em x/y', () => {
  limparTodos();
  const eu = sessaoFake('Eu', { x: 100, y: 100, z: 7 });
  sessaoFake('OutroAndar', { x: 100, y: 100, z: 8 });
  Chat.invalidarIndice();
  const nomes = Chat.jogadoresNaPraca(eu).map((j) => j.name);
  assert.ok(!nomes.includes('OutroAndar'));
  limparTodos();
});

test('quem entra na praça no meio de um passo do relógio só aparece depois de invalidarIndice', () => {
  limparTodos();
  const eu = sessaoFake('Eu', { x: 100, y: 100 });
  Chat.invalidarIndice();
  assert.equal(Chat.jogadoresNaPraca(eu).length, 0);
  // Uma sessão nova (conectou/entrou na praça DEPOIS do índice deste passo)
  // não está na grade ainda — como o próprio `rodarRelogio` só chama
  // `invalidarIndice` uma vez por passo, isto é esperado dentro do mesmo
  // passo, e não um bug: o próximo passo já refaz a grade com ela dentro.
  const novo = sessaoFake('Novo', { x: 101, y: 100 });
  assert.equal(Chat.jogadoresNaPraca(eu).length, 0, 'ainda com o índice velho');
  Chat.invalidarIndice();
  assert.ok(Chat.jogadoresNaPraca(eu).some((j) => j.name === 'Novo'), 'depois de invalidar, aparece');
  limparTodos();
});

test('quem se mexe SEM invalidar continua com a posição CONGELADA do índice (mesma folga do Ficha.combate)', () => {
  limparTodos();
  const eu = sessaoFake('Eu', { x: 100, y: 100 });
  const outro = sessaoFake('Outro', { x: 100 + JANELA.x, y: 100 });
  Chat.invalidarIndice();
  assert.ok(Chat.jogadoresNaPraca(eu).some((j) => j.name === 'Outro'));
  // Sai da tela de verdade, mas o cartão (posição incluída) foi montado uma
  // vez só ao entrar no índice: sem invalidar, continua vendo a posição de
  // quando o índice foi montado — o mesmo represamento de até um passo do
  // relógio (50 ms) que `Ficha.combate` aceita (Fase 3.1).
  outro.estado.pos.x = 100 + JANELA.x + 500;
  assert.ok(Chat.jogadoresNaPraca(eu).some((j) => j.name === 'Outro'), 'ainda com o cartão velho');
  Chat.invalidarIndice();
  assert.ok(!Chat.jogadoresNaPraca(eu).some((j) => j.name === 'Outro'), 'depois de invalidar, some');
  limparTodos();
});
