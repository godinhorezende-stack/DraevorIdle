// A BOLSA DE LOOT ORGANIZADA (modo PoE — dono, 10/10): cada pilha cai na sua seção (Moedas, Equipáveis, Frascos, Gemas, Mapas, Itens de
// quest, Outros), Equipáveis e Frascos se dividem pela categoria do PoE, e as abas, a busca e a ordem só mudam o que se mostra — o índice
// de cada pilha continua o da bolsa inteira (o que o servidor conhece).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { organizar, secaoDe, chaveDaPilha, SECOES } from '../frontend/client/src/bolsa-organizada.mjs';

const ITENS = {
  1: { name: 'Orbe do Caos', moedaPoe: { slug: 'Chaos_Orb' } },
  2: { name: 'Golpe Pesado', gemaDef: { tipo: 'ativa' } },
  3: { name: 'Elmo de Ferro', slot: 'head', poe: { classe: 'Helmets' } },
  4: { name: 'Machado Enferrujado', slot: 'weapon', poe: { classe: 'One_Hand_Axes' } },
  5: { name: 'Frasco de Vida Pequeno', frasco: true, poe: { classe: 'Life_Flasks' } },
  6: { name: 'Mapa da Praia', mapa: true, poe: { classe: 'Maps' } },
  7: { name: 'Medalhão de Prata', type: 'quest items', missao: { nome: 'x' } },
  8: { name: 'Pedra estranha' },
  9: { name: 'Luvas de Couro', slot: 'gloves', poe: { classe: 'Gloves' } },
};
const peca = (id, raridade, ilvl, nome) => ({ id, count: 1, poe: { classe: ITENS[id].poe.classe, raridade, ilvl, ...(nome ? { nome } : {}) } });
const BOLSA = [
  { id: 1, count: 12 },
  peca(4, 'magico', 78, 'Maximizador Cutelo da Firmeza'),
  { id: 2, count: 1, gema: { nivel: 5 } },
  peca(3, 'raro', 70),
  peca(9, 'normal', 40),
  peca(5, 'normal', 20),
  peca(6, 'normal', 70),
  { id: 7, count: 1 },
  { id: 8, count: 1 },
  peca(3, 'unico', 60),
];

test('a ordem das seções é a do dono: Moedas, Equipáveis, Frascos, Gemas, Mapas, Itens de quest, Outros', () => {
  assert.deepEqual(SECOES.map((s) => s.titulo), ['Moedas', 'Equipáveis', 'Frascos', 'Gemas', 'Mapas', 'Itens de quest', 'Outros']);
  const org = organizar(BOLSA, ITENS);
  assert.deepEqual(org.secoes.map((s) => s.id), ['currency', 'equipamentos', 'frascos', 'gemas', 'mapas', 'quest', 'outros']);
  assert.deepEqual(org.contagem, { currency: 1, equipamentos: 4, frascos: 1, gemas: 1, mapas: 1, quest: 1, outros: 1 });
  assert.equal(org.total, BOLSA.length);
});

test('cada pilha na sua seção; o frasco não é Equipável', () => {
  const de = (i) => secaoDe(BOLSA[i], ITENS[BOLSA[i].id]);
  assert.deepEqual(BOLSA.map((_, i) => de(i)), ['currency', 'equipamentos', 'gemas', 'equipamentos', 'equipamentos', 'frascos', 'mapas', 'quest', 'outros', 'equipamentos']);
});

test('Equipáveis se divide pela categoria do PoE (armas primeiro, depois armaduras), com o índice da bolsa inteira', () => {
  const eq = organizar(BOLSA, ITENS).secoes.find((s) => s.id === 'equipamentos');
  assert.deepEqual(eq.grupos.map((g) => g.rotulo), ['Machados de Uma Mão', 'Elmos', 'Luvas']);
  assert.deepEqual(eq.grupos.find((g) => g.classe === 'Helmets').itens.map((x) => x.i), [3, 9]);
  const fr = organizar(BOLSA, ITENS).secoes.find((s) => s.id === 'frascos');
  assert.deepEqual(fr.grupos.map((g) => g.rotulo), ['Frascos de Vida']);
});

test('a aba mostra uma seção só; a busca acha pelo nome da peça ou da base, sem acento; a contagem das abas não olha a busca', () => {
  assert.deepEqual(organizar(BOLSA, ITENS, { aba: 'gemas' }).secoes.map((s) => s.id), ['gemas']);
  const busca = organizar(BOLSA, ITENS, { busca: 'cutelo' });
  assert.deepEqual(busca.secoes.flatMap((s) => s.itens.map((x) => x.i)), [1]);
  assert.deepEqual(organizar(BOLSA, ITENS, { busca: 'medalhao' }).secoes.flatMap((s) => s.itens.map((x) => x.i)), [7]);
  assert.equal(busca.contagem.equipamentos, 4);
  assert.deepEqual(organizar(BOLSA, ITENS, { busca: 'nada disso' }).secoes, []);
});

test('ordenar por raridade, nível e nome (e ao contrário)', () => {
  const elmos = (o) => organizar(BOLSA, ITENS, o).secoes.find((s) => s.id === 'equipamentos').itens.map((x) => x.i);
  assert.deepEqual(elmos({ ordem: 'categoria' }), [1, 3, 4, 9]);
  assert.deepEqual(elmos({ ordem: 'raridade' }), [9, 3, 1, 4]);
  assert.deepEqual(elmos({ ordem: 'nivel' }), [1, 3, 9, 4]);
  assert.deepEqual(elmos({ ordem: 'nivel', desc: true }), [4, 9, 3, 1]);
});

test('a chave da seleção muda se outra peça tomar o índice (e não muda com a contagem nem com o cadeado)', () => {
  const a = { id: 1, count: 3 };
  assert.equal(chaveDaPilha(a, 0), chaveDaPilha({ id: 1, count: 9, trava: true }, 0));
  assert.notEqual(chaveDaPilha(a, 0), chaveDaPilha({ id: 2, count: 3 }, 0));
  assert.notEqual(chaveDaPilha(a, 0), chaveDaPilha(a, 1));
});
