// A tela WORLD (v2): as contas do mapa sem DOM — Atos dinâmicos, posições (manual e gerada), conexões e seus estados, tipos de nó e a validação do que o editor grava.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LARGURA, ALTURA, atosDaCampanha, partesDaCampanha, faseDaFronteira, posicoesDoAto, conexoesDoAto, tracadoDaEstrada, tipoDaFase, validarMapa, TIPOS_DE_NO } from '../frontend/client/src/world-dados.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as Conteudo from '../systems/campanha-conteudo.mjs';
import { personagemDeTeste } from './apoio.mjs';

const fase = (id, ato, extra = {}) => ({ huntId: id, nome: id, ato, nivel: 10, completa: false, liberada: false, ...extra });
const ESC = {
  id: 'facil', nome: 'Fácil',
  fases: [fase('a', 1, { completa: true, liberada: true }), fase('b', 1, { liberada: true }), fase('c', 1), fase('d', 2)],
  bosses: [{ ato: 1, bossId: 'x', nome: 'Boss 1', nivel: 20, liberado: false, vencido: false }, { ato: 2, bossId: 'y', nome: 'Boss 2', nivel: 40, liberado: false, vencido: false }],
};

test('Atos: dinâmicos (vêm dos dados), com progresso, aberto/concluído e nome/parte do conteúdo', () => {
  const atos = atosDaCampanha(ESC, { 1: { nome: 'A Floresta', parte: 'Parte I', tema: 'floresta' } });
  assert.deepEqual(atos.map((a) => a.ato), [1, 2]);
  assert.equal(atos[0].nome, 'A Floresta');
  assert.equal(atos[1].nome, 'Ato 2', 'sem nome no conteúdo, "Ato N"');
  assert.equal(atos[0].feitas, 1);
  assert.equal(atos[0].aberto, true);
  assert.equal(atos[1].aberto, false, 'nenhuma fase liberada: bloqueado');
  assert.equal(atos[0].concluido, false);
  assert.deepEqual(partesDaCampanha(atos), ['Parte I']);
  const feito = atosDaCampanha({ ...ESC, fases: ESC.fases.map((f) => ({ ...f, completa: true, liberada: true })), bosses: ESC.bosses.map((b) => ({ ...b, vencido: true })) });
  assert.equal(feito.every((a) => a.concluido), true);
  // um quinto Ato nos dados aparece sem mexer no frontend
  const cinco = atosDaCampanha({ ...ESC, fases: [...ESC.fases, fase('z', 5)], bosses: ESC.bosses });
  assert.deepEqual(cinco.map((a) => a.ato), [1, 2, 5]);
});

test('fase da fronteira: a primeira aberta e não concluída; a última aberta se tudo está feito', () => {
  assert.equal(faseDaFronteira(ESC).huntId, 'b');
  const tudo = { ...ESC, fases: ESC.fases.map((f) => ({ ...f, completa: true, liberada: true })) };
  assert.equal(faseDaFronteira(tudo).huntId, 'd');
});

test('posições: cabem no espaço, não se sobrepõem, são determinísticas e a posição do editor vence', () => {
  const fases = Array.from({ length: 12 }, (_, i) => fase(`f${i}`, 1));
  const a = posicoesDoAto(fases, true, {}, 1);
  const b = posicoesDoAto(fases, true, {}, 1);
  assert.deepEqual(a, b, 'mesma conta, mesmo resultado');
  assert.equal(a.pontos.length, 12);
  const todos = [...a.pontos, a.boss];
  for (const p of todos) assert.ok(p.x >= 30 && p.x <= LARGURA - 30 && p.y >= 30 && p.y <= ALTURA - 30, JSON.stringify(p));
  for (let i = 0; i < todos.length; i++) for (let j = i + 1; j < todos.length; j++) assert.ok(Math.hypot(todos[i].x - todos[j].x, todos[i].y - todos[j].y) > 50, `nós ${i} e ${j} colados`);
  assert.notDeepEqual(posicoesDoAto(fases, true, {}, 2).pontos, a.pontos, 'cada Ato tem o seu balanço');
  const manual = posicoesDoAto(fases, true, { f3: { mapa: { x: 500, y: 100 } } }, 1);
  assert.deepEqual(manual.pontos[3], { x: 500, y: 100, manual: true });
  assert.equal(manual.pontos[2].manual, false);
});

test('conexões: cadeia, boss e extras com estado (percorrido / disponível / bloqueado); sem duplicar nem sair do Ato', () => {
  const fases = [fase('a', 1, { completa: true, liberada: true }), fase('b', 1, { completa: true, liberada: true }), fase('c', 1, { liberada: true }), fase('d', 1)];
  const boss = { ato: 1, liberado: false, vencido: false };
  const c = conexoesDoAto(fases, boss, { a: { conexoes: ['c', 'b', 'fora'] } });
  const por = (de, para) => c.find((x) => x.de === de && x.para === para);
  assert.equal(por('a', 'b').estado, 'percorrido');
  assert.equal(por('b', 'c').estado, 'disponivel');
  assert.equal(por('c', 'd').estado, 'bloqueado');
  assert.equal(por('d', 'boss:1').tipo, 'boss');
  assert.equal(por('a', 'c').tipo, 'extra', 'a conexão extra do conteúdo');
  assert.equal(c.filter((x) => (x.de === 'a' && x.para === 'b') || (x.de === 'b' && x.para === 'a')).length, 1, 'não duplica a cadeia');
  assert.ok(!c.some((x) => x.para === 'fora'), 'fase de outro Ato não é ligada');
});

test('traçado das estradas: estável para o mesmo par, e a extra curva mais', () => {
  const a = { x: 100, y: 100 };
  const b = { x: 300, y: 200 };
  assert.equal(tracadoDaEstrada(a, b), tracadoDaEstrada(a, b));
  assert.match(tracadoDaEstrada(a, b), /^M100 100 Q\d+ \d+ 300 200$/);
  assert.notEqual(tracadoDaEstrada(a, b, 'extra'), tracadoDaEstrada(a, b, 'cadeia'));
});

test('tipo do nó: o do editor, ou deduzido do conteúdo (boss da fase, miniboss, quest, comum)', () => {
  assert.equal(tipoDaFase({}), 'comum');
  assert.equal(tipoDaFase({ tipo: 'evento' }), 'evento');
  assert.equal(tipoDaFase({ tipo: 'boss' }), 'comum', '"boss" é do nó do Ato, não de uma fase');
  assert.equal(tipoDaFase({ bossPrincipal: 'Guardião' }), 'boss-fase');
  assert.equal(tipoDaFase({ obrigatorios: [{ nome: 'x', tipo: 'miniboss' }] }), 'miniboss');
  assert.equal(tipoDaFase({ obrigatorios: [{ nome: 'x', tipo: 'bau-comum' }] }), 'quest');
  for (const t of ['comum', 'quest', 'miniboss', 'boss-fase', 'boss-opcional', 'secreta', 'evento', 'cidade', 'retorno', 'especial', 'desafio']) assert.ok(TIPOS_DE_NO[t], t);
});

test('validação do mapa: posição fora do espaço, tipo desconhecido, conexão inválida, requisito impossível', () => {
  const fases = [{ huntId: 'a', ato: 1 }, { huntId: 'b', ato: 1 }, { huntId: 'c', ato: 2 }];
  assert.deepEqual(validarMapa(fases, { a: { mapa: { x: 100, y: 100 }, tipo: 'quest', conexoes: ['b'] } }), []);
  const msgs = (conteudo) => validarMapa(fases, conteudo).map((e) => e.mensagem).join(' | ');
  assert.match(msgs({ a: { mapa: { x: 5000, y: 10 } } }), /dentro de/);
  assert.match(msgs({ a: { mapa: { x: 'a', y: 10 } } }), /numéricos/);
  assert.match(msgs({ a: { tipo: 'nada' } }), /desconhecido/);
  assert.match(msgs({ a: { conexoes: ['a'] } }), /si mesma/);
  assert.match(msgs({ a: { conexoes: ['zzz'] } }), /não é uma fase/);
  assert.match(msgs({ a: { conexoes: ['c'] } }), /outro Ato/);
  assert.match(msgs({ a: { requisitos: { exige: ['b'] } } }), /nunca abriria/);
  assert.match(msgs({ b: { requisitos: { exige: ['b'] } } }), /a si mesma/);
  assert.match(msgs({ a: { mapa: { x: 100, y: 100 } }, b: { mapa: { x: 110, y: 105 } } }), /sobre o de/);
});

test('servidor: a campanha entrega os metadados dos Atos e a posição/tipo de cada fase vindos do conteúdo', () => {
  const [F1] = Campanha.FASES;
  const restaurar = Conteudo._definirParaTestes({ [F1.huntId]: { descricao: 'x', mapa: { x: 321, y: 123, icone: 'torre' }, tipo: 'quest' } });
  try {
    const c = Campanha.paraCliente(personagemDeTeste({ vocacao: 'knight', level: 20 }));
    assert.deepEqual(c.mundo[F1.huntId].mapa, { x: 321, y: 123, icone: 'torre' });
    assert.equal(c.mundo[F1.huntId].tipo, 'quest');
    assert.equal(typeof c.atos, 'object');
    const ruim = Conteudo._definirParaTestes({ [F1.huntId]: { mapa: { x: 'a' } } });
    assert.equal(Campanha.paraCliente(personagemDeTeste({ vocacao: 'knight', level: 20 })).mundo[F1.huntId]?.mapa, undefined, 'posição inválida não vai para a tela');
    ruim();
  } finally {
    restaurar();
  }
});
