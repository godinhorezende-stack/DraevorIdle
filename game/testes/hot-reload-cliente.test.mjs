import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import * as F from '../engine/sprite-folha.mjs';

const lerFonte = (a) => readFileSync(new URL(`../frontend/client/src/${a}`, import.meta.url), 'utf8');
const meta = (frames) => ({ w: 256, h: 64 * (1 + frames), cw: 64, ch: 64, shift: [0, 0], groups: [
  { row: 0, frames: 1, layers: 1, dirs: 4, addons: 1, depth: 1, animation: null },
  { row: 1, frames, layers: 1, dirs: 4, addons: 1, depth: 1, animation: { loop: 0, start: 0, random: false, durations: Array.from({ length: frames }, () => [100, 100]) } }] });

test('HC1. planejarTrocas: override novo, override desligado/removido (volta ao original), imagem original alterada à mão, e override ativo vence a imagem original', () => {
  const originais = { 100: meta(4), 101: meta(4), 102: meta(4) };
  const metaOriginal = (l) => originais[l] ?? null;
  const t = (aviso, sobrescritos = new Set()) => F.planejarTrocas(aviso, { metaOriginal, sobrescritos });
  assert.deepEqual(t({ ativo: true, sprites: { 100: { hash: 'abc', meta: meta(5) } } }), [{ look: '100', url: '/gamedata/overrides/sprites/100.png?v=abc', meta: meta(5) }]);
  assert.deepEqual(t({ ativo: true, sprites: { 100: null } }, new Set(['100'])), [{ look: '100', url: '/gamedata/sprites/outfits/100.png', meta: originais[100] }], 'null = original');
  assert.deepEqual(t({ ativo: false, sprites: { 100: { hash: 'abc', meta: meta(5) } } }), [{ look: '100', url: '/gamedata/sprites/outfits/100.png', meta: originais[100] }], 'camada desligada = original');
  assert.deepEqual(t({ ativo: true, sprites: {}, originais: { 101: '5-123' } }), [{ look: '101', url: '/gamedata/sprites/outfits/101.png?v=5-123', meta: originais[101] }], 'furar o cache da imagem original');
  assert.deepEqual(t({ ativo: true, sprites: {}, originais: { 102: '5-123' } }, new Set(['102'])), [], 'quem tem override ativo não troca pela original');
  assert.deepEqual(t({ ativo: true, sprites: { 999: { hash: 'x', meta: meta(2) } } }).map((x) => x.look), ['999'], 'look novo com override entra');
  assert.deepEqual(t({ ativo: true, sprites: { 999: null } }), [], 'look sem original não tem para onde voltar');
});

test('HC2. o renderer do jogo no cliente: trocar a folha é ATÔMICO (carrega tudo antes), limpa o cache só do look trocado, devolve a folha antiga e, se a nova não carrega, o look segue como estava', async () => {
  register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { if (s.startsWith('/packages/shared/src/')) return n(${JSON.stringify(new URL('../engine/', import.meta.url).href)} + s.slice('/packages/shared/src/'.length), c); return n(s, c); }`), import.meta.url);
  const carregadas = [];
  global.document = { addEventListener() {}, createElement: () => ({ getContext: () => ({}) }), visibilityState: 'visible' };
  global.window = { innerHeight: 800, addEventListener() {} };
  global.Image = class { set src(v) { this._src = v; carregadas.push(v); setTimeout(() => (v.includes('falha') ? this.onerror?.() : this.onload?.()), 1); } get src() { return this._src; } get naturalWidth() { return 1; } get naturalHeight() { return 1; } };
  const indice = { 100: meta(4), 101: meta(4) };
  global.fetch = async (url) => ({ ok: !url.includes('overrides/sprites.json'), json: async () => (url.includes('outfits.json') ? indice : url.includes('item-sprites') ? {} : {}) });
  const S = await import('../frontend/client/src/sprites.mjs');
  await S.loadSpriteData();
  assert.equal(S.urlDaFolha('100'), '/gamedata/sprites/outfits/100.png');
  assert.equal(S.outfitInfo('100').groups[1].frames, 4);
  S.image('/gamedata/sprites/outfits/100.png'); // a folha antiga está no cache de imagens
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(S.imagemPronta('/gamedata/sprites/outfits/100.png'), true);
  // 1) override novo: a folha nova é pedida e SÓ DEPOIS o cadastro e a URL trocam
  const p = S.atualizarSpritesDoJogo({ tipo: 'sprites', ativo: true, sprites: { 100: { hash: 'h1', meta: meta(6) } } });
  assert.equal(S.outfitInfo('100').groups[1].frames, 4, 'antes de a folha nova chegar, tudo segue como estava (nada de quadros misturados)');
  assert.equal(S.urlDaFolha('100'), '/gamedata/sprites/outfits/100.png');
  assert.deepEqual(await p, ['100']);
  assert.equal(S.outfitInfo('100').groups[1].frames, 6);
  assert.equal(S.urlDaFolha('100'), '/gamedata/overrides/sprites/100.png?v=h1');
  assert.ok(carregadas.includes('/gamedata/overrides/sprites/100.png?v=h1'));
  assert.equal(S.outfitInfo('101').groups[1].frames, 4, 'os outros looks não mudam');
  // 2) a folha antiga foi devolvida: pedir de novo é um carregamento novo
  const n = carregadas.filter((x) => x === '/gamedata/sprites/outfits/100.png').length;
  S.image('/gamedata/sprites/outfits/100.png');
  assert.equal(carregadas.filter((x) => x === '/gamedata/sprites/outfits/100.png').length, n + 1, 'saiu do cache de imagens (memória liberada)');
  // 3) outra versão do override (hash novo)
  assert.deepEqual(await S.atualizarSpritesDoJogo({ tipo: 'sprites', ativo: true, sprites: { 100: { hash: 'h2', meta: meta(7) } } }), ['100']);
  assert.equal(S.urlDaFolha('100'), '/gamedata/overrides/sprites/100.png?v=h2');
  // 4) folha nova que NÃO carrega: o look segue com a versão anterior
  const aviso = console.warn; console.warn = () => {};
  assert.deepEqual(await S.atualizarSpritesDoJogo({ tipo: 'sprites', ativo: true, sprites: { 100: { hash: 'falha', meta: meta(9) } } }), []);
  console.warn = aviso;
  assert.equal(S.outfitInfo('100').groups[1].frames, 7);
  assert.equal(S.urlDaFolha('100'), '/gamedata/overrides/sprites/100.png?v=h2');
  // 5) override removido: volta ao cadastro e à imagem ORIGINAIS
  assert.deepEqual(await S.atualizarSpritesDoJogo({ tipo: 'sprites', ativo: true, sprites: { 100: null } }), ['100']);
  assert.equal(S.outfitInfo('100').groups[1].frames, 4);
  assert.equal(S.urlDaFolha('100'), '/gamedata/sprites/outfits/100.png');
  // 6) imagem original alterada à mão: mesmo URL com versão (fura o cache do navegador)
  assert.deepEqual(await S.atualizarSpritesDoJogo({ tipo: 'sprites', ativo: true, sprites: {}, originais: { 101: '9-77' } }), ['101']);
  assert.equal(S.urlDaFolha('101'), '/gamedata/sprites/outfits/101.png?v=9-77');
});

test('HC3. o cliente: contentUpdate chega no main, o bestiário é atualizado só nas chaves alteradas (e some quando a variação sai), e uma falha não derruba o jogo', async () => {
  assert.match(lerFonte('main.mjs'), /case 'contentUpdate':\n\s+aplicarContentUpdate\(message, \{ state, redraw: \(\) => panelCtx\.redraw\?\.\(\) \}\);/);
  const { aplicarContentUpdate } = await import('../frontend/client/src/hot-reload-cliente.mjs');
  const eventos = [];
  global.document = { dispatchEvent: (e) => eventos.push(e.detail), addEventListener() {}, createElement: () => ({ getContext: () => ({}) }), visibilityState: 'visible' };
  global.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o.detail; } };
  const state = { catalog: { bestiary: { troll: { hp: 1 }, rotworm: { hp: 2 }, variacao: { hp: 3 } } } };
  let redesenhos = 0;
  const r = await aplicarContentUpdate({ tipo: 'monstros', ids: ['troll', 'variacao'], revisao: 4, monstros: { troll: { hp: 99 }, variacao: null } }, { state, redraw: () => redesenhos++ });
  assert.deepEqual(state.catalog.bestiary, { troll: { hp: 99 }, rotworm: { hp: 2 } });
  assert.equal(redesenhos, 1);
  assert.equal(eventos[0].revisao, 4);
  assert.match(r, /monstros: troll, variacao/);
  const aviso = console.warn; console.warn = () => {};
  const falha = await aplicarContentUpdate({ tipo: 'sprites', revisao: 5, sprites: { 1: { hash: 'x', meta: meta(2) } } }, { state, redraw: () => { throw new Error('boom'); } });
  console.warn = aviso;
  assert.match(falha, /o jogo segue como estava/);
  assert.equal(state.catalog.bestiary.troll.hp, 99, 'nada se perdeu');
});
