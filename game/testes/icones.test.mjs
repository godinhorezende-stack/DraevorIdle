// Ícones dos itens (auditoria de 01/10): o índice do atlas aponta para páginas que existem, com o
// quadro dentro da imagem; o que cai dos bichos sem figura está listado; e o "?" de quem não tem
// figura é desenhado e avisado UMA vez (sem esconder o erro).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditar } from '../../tools/auditar-icones.mjs';
import { desenhar, avisados } from '../frontend/client/src/icone-sem-figura.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';

const a = auditar();

test('nenhum caminho inválido: toda entrada do índice cai numa página PNG válida, com o quadro dentro', () => {
  assert.deepEqual(a.itens.filter((i) => i.erros.length).map((i) => `${i.id}: ${i.erros}`), []);
  for (const p of a.paginas) assert.ok(p.valido, `${p.arquivo} é PNG válido`);
});

test('itens de mochila sem figura são poucos e conhecidos (os "tiles" são pisos de mapa, não itens de bolsa)', () => {
  const semFiguraDeMochila = a.itens.filter((i) => i.origem === 'sem imagem' && !/tiles$/.test(i.tipo));
  assert.ok(semFiguraDeMochila.length <= 25, `${semFiguraDeMochila.length} itens — se cresceu, rodar tools/auditar-icones.mjs`);
});

test('o loot que cai sem figura está todo no relatório, e quase todo é id fora do catálogo', () => {
  assert.ok(a.lootSemImagem.length > 0);
  const foraDoCatalogo = a.lootSemImagem.filter((e) => !ITEM_CATALOG[e.id]).length;
  assert.ok(foraDoCatalogo / a.lootSemImagem.length > 0.8, `${foraDoCatalogo} de ${a.lootSemImagem.length}`);
});

test('fallback: o "?" é desenhado no tamanho do ícone, marcado, e o aviso sai uma vez por id', () => {
  const chamadas = [];
  const ctx = new Proxy({}, { get: (_, nome) => (typeof nome === 'string' && !['strokeStyle', 'fillStyle', 'font', 'lineWidth', 'textAlign', 'textBaseline'].includes(nome) ? (...args) => chamadas.push([nome, ...args]) : undefined), set: () => true });
  const canvas = () => ({ width: 32, height: 32, dataset: {}, getContext: () => ctx });
  const avisos = [];
  avisados.clear();
  const c1 = canvas();
  desenhar(c1, 52719, (t) => avisos.push(t));
  desenhar(canvas(), 52719, (t) => avisos.push(t));
  assert.equal(c1.dataset.semIcone, '52719');
  assert.ok(chamadas.some(([n, t]) => n === 'fillText' && t === '?'), 'desenhou o "?"');
  assert.ok(chamadas.some(([n]) => n === 'strokeRect'), 'e a moldura');
  assert.equal(avisos.length, 1, 'o mesmo id avisa uma vez só');
  assert.match(avisos[0], /52719/);
});
