import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Menu from '../frontend/client/src/editor-menu.mjs';

const fonte = (arq) => readFileSync(new URL(`../frontend/${arq}`, import.meta.url), 'utf8');
const conteudo = fonte('client/src/editor-conteudo.mjs');
const trecho = (de, ate) => conteudo.slice(conteudo.indexOf(de), conteudo.indexOf(ate));

test('M1. o estado do menu é lido com segurança: sem storage, JSON ruim ou tipos errados caem no padrão e nunca quebram', () => {
  assert.deepEqual(Menu.lerEstado(null), Menu.estadoPadrao());
  assert.deepEqual(Menu.lerEstado({ getItem: () => '{ruim' }), Menu.estadoPadrao());
  assert.deepEqual(Menu.lerEstado({ getItem: () => '"texto"' }), Menu.estadoPadrao());
  assert.deepEqual(Menu.lerEstado({ getItem: () => JSON.stringify({ recolhido: 'sim', gruposFechados: [1, 'mundo', null] }) }), { recolhido: false, gruposFechados: ['mundo'] });
  assert.deepEqual(Menu.lerEstado({ getItem: () => JSON.stringify({ recolhido: true, gruposFechados: ['conteudo'] }) }), { recolhido: true, gruposFechados: ['conteudo'] });
  const guardado = {};
  assert.equal(Menu.gravarEstado({ setItem: (k, v) => { guardado[k] = v; } }, { recolhido: true, gruposFechados: [] }), true);
  assert.equal(JSON.parse(guardado[Menu.CHAVE_DO_MENU]).recolhido, true);
  assert.equal(Menu.gravarEstado({ setItem: () => { throw new Error('cota'); } }, Menu.estadoPadrao()), false, 'sem poder gravar, o menu só não lembra');
  assert.equal(Menu.gravarEstado(null, Menu.estadoPadrao()), true, 'sem storage nenhum não é erro');
});

test('M2. grupos: alternar não muda o estado antigo; navegar até um item de grupo fechado o abre; grupo sem item não aparece', () => {
  const grupos = [{ id: 'a', titulo: 'A', itens: [{ id: 'x' }] }, { id: 'b', titulo: 'B', itens: [{ id: 'y' }] }, { id: 'vazio', titulo: 'Vazio', itens: [] }];
  const e0 = Menu.estadoPadrao();
  const e1 = Menu.alternarGrupo(e0, 'a');
  assert.deepEqual(e0.gruposFechados, []);
  assert.deepEqual(e1.gruposFechados, ['a']);
  assert.deepEqual(Menu.alternarGrupo(e1, 'a').gruposFechados, []);
  assert.deepEqual(Menu.abrirGrupoDe({ ...e1, gruposFechados: ['a', 'b'] }, grupos, 'y').gruposFechados, ['a'], 'abre só o grupo da página ativa');
  assert.equal(Menu.abrirGrupoDe(e0, grupos, 'x'), e0);
  assert.deepEqual(Menu.gruposVisiveis(grupos).map((g) => g.id), ['a', 'b']);
});

test('M3. o menu só tem itens com tela real: todo item vira uma aba existente ou um link para a página antiga; sem ids repetidos; grupos sem item não existem', () => {
  const abas = [...trecho('const ABAS = [', 'const NOME_DA_ABA').matchAll(/\['(\w+)', '[^']+'\]/g)].map((m) => m[1]);
  const grupos = trecho('const GRUPOS = [', 'function abrirGaveta');
  const itens = [...grupos.matchAll(/\{ id: '([\w-]+)', nome: '[^']+', icone: '(\w+)'(?:, modo: '(\w+)')?(?:, href: '([^']+)')?/g)].map((m) => ({ id: m[1], icone: m[2], modo: m[3], href: m[4] }));
  assert.ok(itens.length >= 12);
  assert.equal(new Set(itens.map((i) => i.id)).size, itens.length, 'sem id repetido');
  for (const i of itens) assert.ok(abas.includes(i.id) || i.href, `item sem tela nem link: ${i.id}`);
  for (const i of itens) if (i.modo) assert.ok(Object.keys(Menu.MARCAS).includes(i.modo), `marca desconhecida: ${i.modo}`);
  const ids = [...grupos.matchAll(/\{ id: '(gerenciamento|mundo|conteudo|recursos)', titulo: '([^']+)'/g)].map((m) => m[2]);
  assert.deepEqual(ids, ['Gerenciamento', 'Mundo e campanha', 'Conteúdo do jogo', 'Recursos']);
  assert.doesNotMatch(grupos, /Gemas|NPCs|Economia|Classes e progress/, 'nada de item fictício: só entra quando a tela existir');
  const icones = fonte('client/src/editor-ui.mjs');
  for (const i of itens) assert.match(icones, new RegExp(`\\b${i.icone}:`), `ícone inexistente: ${i.icone}`);
});

test('M4. as URLs atuais continuam valendo (#geral, #fase/<id>, #mapa, #mapas, #hunts, #atos, #mobs, #bosses, #itens, #outfits, #montarias, #biblioteca)', () => {
  const abas = [...trecho('const ABAS = [', 'const NOME_DA_ABA').matchAll(/\['(\w+)', '[^']+'\]/g)].map((m) => m[1]);
  for (const a of ['geral', 'fase', 'mapa', 'mapas', 'hunts', 'atos', 'mobs', 'bosses', 'itens', 'outfits', 'montarias', 'biblioteca']) assert.ok(abas.includes(a), `rota #${a} sumiu`);
  assert.match(conteudo, /lerEndereco/);
  assert.match(conteudo, /href: '\/editor'/, 'o editor de mapas antigo continua acessível');
});

test('M5. a casca tem o botão da gaveta e o fundo; o CSS cobre recolhido (com dica), gaveta em tela pequena e destaque da rota ativa', () => {
  const html = fonte('editor-conteudo.html');
  assert.match(html, /id="eng-menu-btn"/);
  assert.match(html, /id="eng-gaveta-fundo"/);
  const css = fonte('client/editor-tema.css');
  for (const trecho of ['.eng-menu-recolhido', '.eng-nav.recolhido .eng-nav-item::after', 'attr(data-tip)', 'body.eng-gaveta .eng-nav', '.eng-nav-item.ativa', '.eng-nav-sec.fechado', '@media (max-width: 900px)']) assert.ok(css.includes(trecho), trecho);
  assert.match(conteudo, /gravarEstadoDoMenu\(armazem, MENU\)/, 'o estado do menu é guardado');
});
