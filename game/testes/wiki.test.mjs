// A wiki pública: os dados (`systems/wiki.mjs`) vêm da configuração real, e a página/rota/menu existem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as Wiki from '../systems/wiki.mjs';
import { ATRIBUTOS, TIERS, RARIDADES, ORDEM } from '../systems/itens/config.mjs';

const ler = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('W1. os dados da wiki espelham a configuração: raridades, quantidades, chances (somam 100), tiers e poderes', () => {
  const d = Wiki.itens();
  assert.deepEqual(d.raridades.map((r) => r.id), ORDEM);
  assert.deepEqual(d.raridades.map((r) => r.nome), ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário', 'Mítico']);
  for (const r of d.raridades) assert.equal(r.quantidadeDeModificadores.reduce((a, q) => a + q.chance, 0), 100, r.id);
  assert.equal(d.raridades.find((r) => r.id === 'mítico').chanceDoPoder, 1);
  assert.equal(d.raridades.find((r) => r.id === 'comum').chanceDoPoder, 0);
  for (const [ato, porDif] of Object.entries(d.chancesDeRaridade)) for (const [dif, t] of Object.entries(porDif)) assert.ok(Math.abs(Object.values(t).reduce((a, b) => a + b, 0) - 100) < 1e-4, `Ato ${ato} ${dif}`);
  assert.deepEqual(d.tiers.porItemLevel, TIERS.itemLevel);
  assert.deepEqual(d.tiers.peso, TIERS.peso);
  assert.match(d.convencaoDoTier, /T1 é o tier mais fraco/);
  assert.deepEqual(Object.values(d.dificuldades), ['Normal', 'Cruel', 'Merciless']);
  assert.deepEqual(d.poderes.map((g) => g.grupo), ['lendario', 'mitico']);
  for (const g of d.poderes) for (const x of g.lista) assert.ok(x.nome && x.texto && !/[{}]/.test(x.texto), `${x.id}: texto com número preenchido`);
  assert.equal(d.poderes[0].lista.length + d.poderes[1].lista.length, 7);
  assert.deepEqual(RARIDADES.raridades.mítico.atributos, { 5: 50, 6: 50 });
});

test('W2. os modificadores da wiki: só os que caem (sem Attack antigo nem Damage vs Elite), faixas T1–T5 reais, "Dano adicional" em faixa mín–máx', () => {
  const d = Wiki.itens();
  const ids = d.modificadores.map((m) => m.id);
  assert.equal(ids.length, Object.values(ATRIBUTOS).filter((a) => a.dropa !== false).length);
  assert.ok(!ids.includes('atk_flat') && !ids.includes('dmg_vs_elite'));
  for (const m of d.modificadores) {
    assert.equal(m.faixas.length, 5, m.id);
    assert.deepEqual(m.faixas, [1, 2, 3, 4, 5].map((t) => ATRIBUTOS[m.id].niveis[String(t)]), m.id);
    assert.ok(m.onde.length >= 1, `${m.id} cai em algum equipamento`);
    assert.ok(Object.keys(d.categorias).includes(m.categoria), m.id);
  }
  const dano = d.modificadores.find((m) => m.id === 'phys_add');
  assert.equal(dano.nome, 'Dano adicional', 'sem "físico": o mod pode ser mágico também');
  assert.equal(dano.proporcaoDoMaximo, 2);
  assert.equal(d.modificadores.find((m) => m.id === 'gem_level').valorPorRaridade.mítico, 2);
  assert.equal(Wiki.frequenciaDoPeso(100), 'muito comum');
  assert.equal(Wiki.frequenciaDoPeso(60), 'comum');
  assert.equal(Wiki.frequenciaDoPeso(30), 'incomum');
  assert.equal(Wiki.frequenciaDoPeso(10), 'raro');
  assert.deepEqual(d.modificadores.find((m) => m.id === 'exp_bonus').onde.sort(), ['amuletos', 'aneis']);
});

test('W3. a página, a rota e o menu: /wiki e /wiki/<artigo> servem wiki.html; o link "Wiki" fica ao lado do Ranking nas páginas do site', () => {
  assert.ok(existsSync(new URL('../frontend/wiki.html', import.meta.url)));
  assert.ok(existsSync(new URL('../frontend/client/site/wiki.mjs', import.meta.url)));
  assert.ok(existsSync(new URL('../frontend/client/site/wiki.css', import.meta.url)));
  const backend = ler('backend/index.mjs');
  assert.match(backend, /'\/wiki': '\/wiki\.html'/);
  assert.match(backend, /caminho\.startsWith\('\/wiki\/'\)/);
  assert.match(backend, /'\/api\/wiki\/itens'\) return json\(res, 200, Wiki\.itens\(\)\)/);
  for (const pagina of ['index.html', 'guildas.html', 'online.html', 'personagem.html', 'wiki.html']) {
    const html = ler(`frontend/${pagina}`);
    assert.match(html, /<a href="\/wiki"[^>]*>Wiki<\/a>/, `${pagina}: link da Wiki`);
  }
  assert.match(ler('frontend/index.html'), /data-t="menu\.ranking">Ranking<\/a>\s*<a href="\/wiki"/, 'na capa, a Wiki fica logo depois do Ranking');
  assert.match(ler('frontend/client/site/idiomas.mjs'), /'menu\.wiki': 'Wiki'/);
});

test('W4. o artigo de itens existe, tem as seções pedidas e não monta HTML a partir de dado (só textContent)', () => {
  const js = ler('frontend/client/site/wiki.mjs');
  for (const secao of ['Visão geral', 'Raridades', 'Chance de cada raridade', 'Item Level', 'Tiers (T1 a T5)', 'Modificadores', 'Poderes lendários e míticos', 'Perguntas rápidas']) assert.ok(js.includes(`'${secao}'`), secao);
  assert.match(js, /slug: 'itens'/);
  assert.match(js, /T1 é o tier MAIS FRACO e T5 o MAIS FORTE/);
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|document\.write/);
});

test('W5. layout: as causas do corte estão corrigidas no CSS (grade com minmax(0, 1fr), container largo, respiro do cabeçalho fixo, tabela sem largura mínima, cartões e sombra de rolagem)', () => {
  const css = ler('frontend/client/site/wiki.css');
  assert.match(css, /grid-template-columns: 210px minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 820px\) \{\s*\.wiki \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /max-width: 1480px/);
  assert.match(css, /padding: calc\(var\(--altura-da-faixa, 30px\) \+ 92px\)/, 'respiro do cabeçalho fixo');
  assert.match(css, /\.wiki-tabela \.tabela \{ min-width: 0; width: 100%; \}/, 'sem o min-width de 540 px do site.css');
  assert.match(css, /\.em-cartoes \.tabela tr \{ display: grid/, 'cartões');
  assert.match(css, /\.wiki-rolagem\.mais-direita::after/, 'sombra quando há mais conteúdo');
  assert.doesNotMatch(css, /overflow-x: hidden/, 'nada de esconder a rolagem da página');
  const js = ler('frontend/client/site/wiki.mjs');
  assert.match(js, /role', 'region'/);
  assert.match(js, /tabIndex = 0/, 'a caixa da tabela rola pelo teclado');
});

test('W6. imagens: figura com alt obrigatório, só arquivo do próprio jogo, carregamento sob demanda, ampliar; sprites carregados só quando a figura aparece; artigo de teste oculto', () => {
  const js = ler('frontend/client/site/wiki.mjs');
  assert.match(js, /const srcSeguro = \(src\) => \/\^\\\/client\\\/assets\\\//, 'só /client/assets/...');
  assert.match(js, /if \(!srcSeguro\(src\) \|\| !alt\) return el\('span'\)/);
  assert.match(js, /img\.loading = 'lazy'/);
  assert.match(js, /img\.decoding = 'async'/);
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /import\('\/client\/src\/sprites\.mjs'\)/, 'sprites.mjs só por import dinâmico (não pesa na abertura)');
  assert.doesNotMatch(js, /^import .*sprites\.mjs/m);
  assert.match(js, /hrefSeguro = \(h\) => \/\^\(\\\/wiki/, 'links internos só para a wiki');
  assert.match(js, /slug: 'layout'[^}]*oculto: true/);
  assert.match(js, /ARTIGOS\.filter\(\(x\) => !x\.oculto\)/, 'o artigo de teste não aparece no índice');
  assert.ok(existsSync(new URL('../frontend/client/assets/wiki/.gitkeep', import.meta.url)), 'pasta das imagens da wiki');
  for (const arq of ['arena-fundo.webp', 'draevor-logo.webp']) assert.ok(existsSync(new URL(`../frontend/client/assets/ui/${arq}`, import.meta.url)), arq);
  assert.match(ler('backend/index.mjs'), /caminho\.startsWith\('\/wiki\/'\) && !caminho\.includes\('\.'\)/);
});
