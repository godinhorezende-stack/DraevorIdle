import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ehPrivado } from '../backend/privados.mjs';
import * as A from '../admin/acesso.mjs';

const ler = (a) => readFileSync(new URL(`../frontend/client/src/${a}`, import.meta.url), 'utf8');
const conteudo = ler('editor-conteudo.mjs');
const editor = ler('editor-sprites-editor.mjs');
const previa = ler('editor-sprites-preview.mjs');

test('ES1. a tela está ligada: menu "parcial" com a rota #sprites, aba, tela fixa, botão "Editar sprite" nas fichas (monstro, outfit, montaria) e no editor de Mobs', () => {
  assert.match(conteudo, /import \{ criarEditorDeSprites \} from '\.\/editor-sprites-editor\.mjs'/);
  assert.match(conteudo, /\{ id: 'sprites', nome: 'Editor de sprites', icone: 'outfit', modo: 'parcial'/);
  assert.match(conteudo, /\['sprites', 'Editor de sprites'\]/);
  assert.match(conteudo, /sprites: SPRITES,/);
  assert.match(conteudo, /sprites: 'sprites' \};/);
  assert.equal((conteudo.match(/acaoDaFicha: \(d\) => botaoDeSprite\(d\)/g) ?? []).length, 3, 'Biblioteca geral, Outfits e Montarias');
  assert.match(conteudo, /Editar este monstro \(override\)'\), botaoDeSprite\(d\)/);
  assert.match(conteudo, /Editar sprite \(quadros e animação\)/);
  assert.match(conteudo, /SPRITES\.sair\(\)/, 'sair da tela libera as folhas de rascunho e para a animação');
  assert.match(ler('editor-mobs.mjs'), /Abrir no editor de sprites \(quadros e animação\)/);
  assert.match(conteudo, /aoVoltar: \(\) => irPara\('mobs'\), irPara: \(aba, id = null, resto = \[\]\) => irPara\(aba, id, resto\) \}\);/);
});

test('ES2. a tela só fala com rotas que o servidor tem, e salvar/reverter/restaurar/ativo mandam a revisão (controle de concorrência) e tratam conflito', () => {
  const http = readFileSync(new URL('../admin/conteudo-http.mjs', import.meta.url), 'utf8');
  for (const rota of ['overrides/sprites/validar', 'overrides/sprites', 'overrides/sprites/\\${encodeURIComponent', 'biblioteca/lista']) assert.ok(editor.includes(rota.replace(/\\\$/, '$')) || http.includes(rota.split('/\\')[0]), rota);
  assert.match(http, /rota === 'overrides\/sprites\/validar'/);
  assert.match(http, /rota\.startsWith\('overrides\/sprites\/'\)/);
  for (const acao of ['salvar', 'reverter', 'ativo', 'restaurar']) assert.match(editor, new RegExp(`acao: '${acao}'.*revisao: E\\.ficha\\.revisao`));
  assert.ok((editor.match(/tratarConflito\(/g) ?? []).length >= 4);
  assert.match(editor, /confirmar\('Voltar ao sprite original\?'.*perigo: true/, 'destrutivo pede confirmação');
  assert.match(editor, /confirmar\('Descartar as alterações\?'/);
  assert.match(editor, /Somente leitura neste servidor \(produção\)/);
});

test('ES3. desempenho e limpeza: pixel a pixel só repinta o canvas e a miniatura do quadro (traço = UMA entrada no histórico); rascunho no renderer é adiado; sair para o laço e remove as variantes', () => {
  assert.match(editor, /mudar\('lápis'|const rotulo = E\.traco\.ferr === 'lapis' \? 'lápis' : 'borracha'/);
  assert.match(editor, /\{ leve: true \}/);
  assert.match(editor, /if \(leve\) atualizarMiniatura\(E\.i\); else \{ pintarLinhaDoTempo\(\); pintarPaineis\(\); \}/);
  assert.match(editor, /agendarRascunho\(espera = 140\)/);
  assert.match(editor, /clearTimeout\(tRascunho\)/);
  assert.match(editor, /J\?\.removerVariante\(chaves\(\)\.rascunho\); J\?\.removerVariante\(chaves\(\)\.original\)/);
  assert.match(editor, /document\.removeEventListener\('keydown', teclas\)/);
  assert.match(previa, /if \(!r\.corpo\.isConnected\) return;/, 'o laço de animação para quando a pré-visualização sai da tela');
  assert.match(previa, /cancelAnimationFrame\(laco\)/);
  const io = ler('editor-sprites-io.mjs');
  assert.match(io, /premultiplyAlpha: 'none'/, 'decodifica sem pré-multiplicar o alfa (pixel exato)');
  assert.match(io, /const cache = new Map\(\)/, 'cache de imagens decodificadas');
});

test('ES4. o renderer do jogo: variantes (rascunho/original) entram sob chave própria e a folha de um look tem uma só porta (folhaDe → override ou original); o preload do main usa a mesma URL', () => {
  const sp = ler('sprites.mjs');
  assert.match(sp, /export function registrarVariante\(chave, \{ meta, fonte \}\)/);
  assert.match(sp, /export const removerVariante/);
  assert.match(sp, /export const urlDaFolha = \(look\) => urlsDeFolha\[look\] \?\? `\/gamedata\/sprites\/outfits\/\$\{look\}\.png`/);
  assert.match(sp, /function folhaDe\(look\) \{[\s\S]*?variantes\.get\(look\)[\s\S]*?return image\(urlDaFolha\(look\)\);/);
  assert.equal((sp.match(/outfitMeta\[look\]/g) ?? []).length, 1, 'só `metaDe` lê o índice cru; o renderer sempre passa por ele (variantes e overrides valem em todo lugar)');
  assert.match(sp, /fetch\('\/gamedata\/overrides\/sprites\.json'\)/);
  assert.match(sp, /catch \{ \/\* sem overrides \*\/ \}/, 'sem arquivo de overrides o jogo segue normal');
  assert.match(ler('editor-sprites.mjs'), /export const jogo = async/);
});

test('ES5. os arquivos de override são servidos como estáticos públicos (o cliente do jogo os baixa) e a leitura do editor é "leitura"; salvar é "grava" (produção só lê)', () => {
  assert.equal(ehPrivado('overrides/sprites.json'), false);
  assert.equal(ehPrivado('overrides/sprites/368.png'), false);
  assert.equal(A.classeDaRota('GET', '/api/mapas/_conteudo/overrides/sprites/368'), 'leitura');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/overrides/sprites/validar'), 'leitura');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/overrides/sprites'), 'grava');
  const cfgProd = A.configuracao({ env: { NODE_ENV: 'production' }, existe: () => false, arquivoDeAdmins: '/x' });
  assert.equal(cfgProd.grava, false, 'em produção a gravação do editor continua desligada');
});

test('ES6. o CSS do editor existe e usa os tokens da Engine (sem cor solta fora do tema, exceto o xadrez e o cenário de teste)', () => {
  const css = readFileSync(new URL('../frontend/client/editor-tema.css', import.meta.url), 'utf8');
  for (const c of ['.spr-tela', '.spr-principal', '.spr-palco', '.spr-quadro', '.spr-paineis', '.spr-xadrez', '.spr-paleta']) assert.ok(css.includes(c), c);
  assert.match(css, /image-rendering: pixelated/, 'sem suavização na ampliação');
});

test('ES7. a pré-visualização contextual usa o MESMO drawCreature do jogo; montaria desenha o cavaleiro no mesmo ponto (sem deslocamento próprio)', () => {
  assert.match(previa, /J\.drawCreature\(c, \{ look, colors, dir, frame, walking: andando, mount, addons \}/);
  assert.match(previa, /mount: ctx\.chaves\.rascunho/);
  assert.match(previa, /não existe deslocamento do cavaleiro por montaria/);
  const jogo = ler('sprites.mjs');
  assert.match(jogo, /export function drawCreature\(ctx, \{ look, colors, dir, frame, walking, mount, addons \}, px, py\)/);
  assert.match(jogo, /outfitFrame\(mount, null, dir, frame, walking\)/);
});
