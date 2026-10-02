// Etapa 4 da tela WORLD: o editor grava o MAPA (posição, tipo, conexões, dados dos Atos) — validado junto, nada grava se algo é recusado,
// o resto do conteúdo da fase fica como está, e o jogo entrega o que foi gravado.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Conteudo from '../admin/conteudo.mjs';
import * as Http from '../admin/conteudo-http.mjs';
import * as Campanha from '../systems/campanha.mjs';
import * as Cont from '../systems/campanha-conteudo.mjs';
import { personagemDeTeste } from './apoio.mjs';

const pasta = mkdtempSync(join(tmpdir(), 'draevor-mapa-'));
const originais = { ...Conteudo.CAMINHOS };
Conteudo.CAMINHOS.fases = join(pasta, 'campanha-conteudo.json');
after(() => {
  Object.assign(Conteudo.CAMINHOS, originais);
  rmSync(pasta, { recursive: true, force: true });
});
const [F1, F2, F3] = Campanha.FASES;
const gravado = () => JSON.parse(readFileSync(Conteudo.CAMINHOS.fases, 'utf8'));
const inicio = (extra = {}) => writeFileSync(Conteudo.CAMINHOS.fases, JSON.stringify({ fases: { [F1.huntId]: { descricao: 'Mantida.', requisitos: { levelMin: 5 }, mundo: { bossPrincipal: null, obrigatorios: [], todos: [] } } }, ...extra }));

test('lerMapa: cada fase com o que o editor grava e o que a tela deduz', () => {
  inicio();
  const m = Conteudo.lerMapa();
  assert.equal(m.fases.length, Campanha.FASES.length);
  const f = m.fases.find((x) => x.huntId === F1.huntId);
  assert.deepEqual([f.mapa, f.tipo, f.conexoes], [null, null, []]);
  assert.ok(f.ato >= 1);
});

test('salvarMapa: grava posição/tipo/conexões/Atos e preserva descrição, requisitos e o índice do mundo', () => {
  inicio();
  const r = Conteudo.salvarMapa({ atos: { 1: { nome: 'A Floresta', parte: 'Parte I', tema: 'neve', bossMapa: { x: 900, y: 500 } } }, fases: { [F1.huntId]: { mapa: { x: 200, y: 150 }, tipo: 'quest', conexoes: [F3.huntId] } } });
  assert.equal(r.ok, true, JSON.stringify(r));
  const g = gravado();
  assert.deepEqual(g.fases[F1.huntId].mapa, { x: 200, y: 150 });
  assert.equal(g.fases[F1.huntId].tipo, 'quest');
  assert.deepEqual(g.fases[F1.huntId].conexoes, [F3.huntId]);
  assert.equal(g.fases[F1.huntId].descricao, 'Mantida.');
  assert.equal(g.fases[F1.huntId].requisitos.levelMin, 5);
  assert.ok(g.fases[F1.huntId].mundo, 'o índice do WORLD não some');
  assert.equal(g.atos[1].nome, 'A Floresta');
  assert.deepEqual(g.atos[1].bossMapa, { x: 900, y: 500 });
});

test('salvarMapa: null/vazio/"comum" voltam ao automático (apaga o campo); Ato vazio some', () => {
  inicio({ atos: { 1: { nome: 'X' } } });
  Conteudo.salvarMapa({ fases: { [F1.huntId]: { mapa: { x: 100, y: 100 }, tipo: 'evento' } } });
  const r = Conteudo.salvarMapa({ atos: { 1: { nome: '' } }, fases: { [F1.huntId]: { mapa: null, tipo: 'comum' } } });
  assert.equal(r.ok, true);
  const g = gravado();
  assert.equal(g.fases[F1.huntId].mapa, undefined);
  assert.equal(g.fases[F1.huntId].tipo, undefined);
  assert.equal(g.atos, undefined);
});

test('salvarMapa recusa tudo (e não grava nada) se algo é inválido', () => {
  inicio();
  const antes = readFileSync(Conteudo.CAMINHOS.fases, 'utf8');
  const recusa = (corpo, re) => {
    const r = Conteudo.salvarMapa(corpo);
    assert.equal(r.ok, false);
    assert.match(r.erros.join(' | '), re);
    assert.equal(readFileSync(Conteudo.CAMINHOS.fases, 'utf8'), antes, 'nada foi gravado');
  };
  recusa({ fases: { [F1.huntId]: { mapa: { x: 5000, y: 10 } } } }, /dentro de/);
  recusa({ fases: { [F1.huntId]: { tipo: 'nada' } } }, /desconhecido/);
  recusa({ fases: { [F1.huntId]: { conexoes: [F1.huntId] } } }, /si mesma/);
  recusa({ fases: { [F1.huntId]: { conexoes: ['nao-existe'] } } }, /não é uma fase/);
  recusa({ fases: { 'nao-existe': { mapa: { x: 100, y: 100 } } } }, /Fase desconhecida/);
  recusa({ atos: { 1: { tema: 'lava' } } }, /tema "lava"/);
  recusa({ atos: { 99: { nome: 'x' } } }, /não existe/);
  recusa({ atos: { 1: { bossMapa: { x: 'a', y: 1 } } } }, /bossMapa/);
  // uma boa junto com uma ruim: nenhuma é gravada
  recusa({ fases: { [F1.huntId]: { mapa: { x: 100, y: 100 } }, [F2.huntId]: { mapa: { x: -5, y: 100 } } } }, /dentro de/);
});

test('validar sem gravar: o editor valida ao vivo (rota mapa/validar) e só "mapa" grava', async () => {
  inicio();
  const antes = readFileSync(Conteudo.CAMINHOS.fases, 'utf8');
  const v = Conteudo.salvarMapa({ fases: { [F1.huntId]: { mapa: { x: 100, y: 100 } } } }, { gravar: false });
  assert.equal(v.ok, true);
  assert.ok(v.avisos.some((a) => /só 1 de/.test(a.mensagem)), 'avisa posição parcial');
  assert.equal(readFileSync(Conteudo.CAMINHOS.fases, 'utf8'), antes);
  // as rotas existem
  const respostas = [];
  const json = (res, status, corpo) => respostas.push([status, corpo]);
  const req = (metodo, dados) => ({ method: metodo, __dados: dados });
  const opcoes = { json, corpoJson: async (r) => r.__dados };
  await Http.atender(req('GET'), {}, '/api/mapas/_conteudo/mapa', new URL('http://x/'), opcoes);
  await Http.atender(req('POST', { fases: { [F1.huntId]: { mapa: { x: 10, y: 10 } } } }), {}, '/api/mapas/_conteudo/mapa/validar', new URL('http://x/'), opcoes);
  assert.equal(respostas[0][0], 200);
  assert.ok(Array.isArray(respostas[0][1].fases));
  assert.equal(respostas[1][1].ok, false, 'x=10 fora do espaço');
});

test('o jogo entrega o que o editor gravou (posição, tipo, Atos) e ignora posição inválida', () => {
  inicio();
  Conteudo.salvarMapa({ atos: { 1: { nome: 'Floresta', tema: 'cinzas' } }, fases: { [F1.huntId]: { mapa: { x: 300, y: 200, icone: 'torre' }, tipo: 'cidade' } } });
  const restaurar = Cont._definirParaTestes(gravado().fases);
  try {
    const c = Campanha.paraCliente(personagemDeTeste({ vocacao: 'knight', level: 20 }));
    assert.deepEqual(c.mundo[F1.huntId].mapa, { x: 300, y: 200, icone: 'torre' });
    assert.equal(c.mundo[F1.huntId].tipo, 'cidade');
  } finally {
    restaurar();
  }
});

test('auditoria: aponta mapa inconsistente do arquivo (posição fora, conexão quebrada, Ato desconhecido)', () => {
  writeFileSync(Conteudo.CAMINHOS.fases, JSON.stringify({ atos: { 1: { tema: 'lava' } }, fases: { [F1.huntId]: { mapa: { x: 99999, y: 1 }, conexoes: ['fantasma'] } } }));
  const msgs = Conteudo.auditar().problemas.map((p) => p.mensagem).join(' | ');
  assert.match(msgs, /mapa: a posição no mapa precisa ficar dentro/);
  assert.match(msgs, /mapa: a conexão "fantasma"/);
  assert.match(msgs, /tema "lava"/);
});

test('opções do editor: tipos de nó, temas, espaço do mapa e os Atos gravados', () => {
  inicio({ atos: { 2: { nome: 'Areias' } } });
  const o = Conteudo.opcoes();
  assert.ok(o.tiposDeNo.includes('quest') && o.tiposDeNo.includes('desafio'));
  assert.ok(o.temasDeMapa.includes('floresta'));
  assert.deepEqual(o.espacoDoMapa, { largura: 1000, altura: 640 });
  assert.equal(o.atos[2].nome, 'Areias');
});
