import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pasta = mkdtempSync(join(tmpdir(), 'val-'));
const OV = join(pasta, 'overrides');
mkdirSync(join(OV, 'sprites'), { recursive: true });
process.env.DRAEVOR_OVERRIDES = OV; // as verificações (processo filho) leem os overrides DAQUI, não os do dono
after(() => rmSync(pasta, { recursive: true, force: true }));

const V = await import('../admin/validacao.mjs');
const Git = await import('../admin/git-local.mjs');
const Http = await import('../admin/conteudo-http.mjs');
const A = await import('../admin/acesso.mjs');
const { codificarPng } = await import('../engine/png-minimo.mjs');
const F = await import('../engine/sprite-folha.mjs');

const esperarFim = async (ms = 120000) => { const t0 = Date.now(); while (V.estado().rodando && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 200)); return V.estado(); };
const grava = (arq, c) => writeFileSync(join(OV, arq), typeof c === 'string' ? c : JSON.stringify(c));

test('V1. classificação: erro → bloqueante, aviso → aviso, nada → aprovado; o geral é o pior; o resumo conta', () => {
  assert.equal(V.statusDe([]), 'aprovado');
  assert.equal(V.statusDe([{ nivel: 'aviso' }]), 'aviso');
  assert.equal(V.statusDe([{ nivel: 'aviso' }, { nivel: 'erro' }]), 'bloqueante');
  assert.equal(V.piorStatus(['aprovado', 'aviso', 'aprovado']), 'aviso');
  assert.equal(V.piorStatus([]), 'aprovado');
  const r = V.montarResultado([{ id: 'a', achados: [] }, { id: 'b', achados: [{ nivel: 'aviso' }] }, { id: 'c', achados: [{ nivel: 'erro' }] }], { quando: 1, ms: 5 });
  assert.deepEqual([r.geral, r.resumo], ['bloqueante', { aprovado: 1, aviso: 1, bloqueante: 1 }]);
  assert.deepEqual(r.verificacoes.map((v) => v.status), ['aprovado', 'aviso', 'bloqueante']);
});

test('V2. testes pertinentes: cada módulo escolhe os seus (só os que existem); código ou dado sem teste dedicado pede a suíte completa', () => {
  const existentes = ['overrides.test.mjs', 'overrides-itens.test.mjs', 'sprites-overrides.test.mjs', 'hot-reload-conteudo.test.mjs', 'validacao.test.mjs', 'outro.test.mjs'];
  assert.deepEqual(V.testesPertinentes(['monstros'], existentes), { arquivos: ['overrides.test.mjs', 'hot-reload-conteudo.test.mjs', 'validacao.test.mjs'], completa: false });
  assert.deepEqual(V.testesPertinentes(['itens', 'sprites'], existentes).arquivos, ['overrides-itens.test.mjs', 'hot-reload-conteudo.test.mjs', 'sprites-overrides.test.mjs', 'validacao.test.mjs']);
  assert.equal(V.testesPertinentes(['codigo'], existentes).completa, true);
  assert.equal(V.testesPertinentes(['outros-dados'], existentes).completa, true);
  assert.equal(V.testesPertinentes(['docs-e-testes'], existentes).completa, false);
  const reais = Object.values(V.TESTES_POR_MODULO).flat().map((n) => `${n}.test.mjs`);
  for (const n of reais) assert.ok(readFileSync(new URL(`./${n}`, import.meta.url)), `o teste ${n} existe`);
});

test('V3. a saída do node --test vira totais e nomes dos que falharam', () => {
  const saida = '✔ a (1ms)\n✖ b quebrou (2.5ms)\nℹ tests 3\nℹ pass 2\nℹ fail 1\n✖ failing tests:\n✖ b quebrou (2.5ms)\n';
  assert.deepEqual(V.interpretarSaidaDosTestes(saida), { total: 3, passaram: 2, falharam: 1, falhas: ['b quebrou'] });
  assert.deepEqual(V.interpretarSaidaDosTestes('# tests 4\n# pass 4\n# fail 0\n'), { total: 4, passaram: 4, falharam: 0, falhas: [] });
});

test('V4. o executor de testes roda comando fixo de verdade: aprova quando passam, reprova (com o nome) quando falham', async () => {
  const dir = join(pasta, 'testes-de-mentira');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'bom.test.mjs'), "import { test } from 'node:test'; test('passa', () => {});");
  writeFileSync(join(dir, 'ruim.test.mjs'), "import { test } from 'node:test'; import assert from 'node:assert'; test('quebra de propósito', () => assert.equal(1, 2));");
  const ok = await V.executarTestes(['bom.test.mjs'], { pasta: dir });
  assert.deepEqual([ok.ok, ok.total, ok.passaram, ok.falharam], [true, 1, 1, 0]);
  const ruim = await V.executarTestes(['bom.test.mjs', 'ruim.test.mjs'], { pasta: dir });
  assert.equal(ruim.ok, false);
  assert.equal(ruim.falharam, 1);
  assert.ok(ruim.falhas.includes('quebra de propósito'));
});

test('V5. verificações de verdade (processo à parte, jogo carregado do disco): overrides limpos = aprovado; cada tipo de defeito vira erro BLOQUEANTE no módulo certo, com a mensagem do validador do editor', async () => {
  // 1) limpo
  grava('monstros.json', { ativo: true, monstros: { troll: { hp: 90 } } });
  grava('itens.json', { ativo: true, itens: { 3268: { attack: 12 } } });
  assert.equal(V.iniciar({ escopo: 'rapida' }).ok, true);
  assert.equal(V.iniciar({ escopo: 'rapida' }).ok, false, 'uma execução por vez');
  let e = await esperarFim();
  assert.equal(e.rapida.geral === 'bloqueante', false, JSON.stringify(e.rapida.verificacoes.filter((v) => v.status === 'bloqueante')));
  const por = (r, id) => r.verificacoes.find((v) => v.id === id);
  assert.equal(por(e.rapida, 'monstros').status, 'aprovado');
  assert.equal(por(e.rapida, 'itens').status, 'aprovado');
  assert.equal(por(e.rapida, 'json').status, 'aprovado');
  assert.deepEqual(e.rapida.verificacoes.map((v) => v.id), ['json', 'carga', 'monstros', 'itens', 'sprites', 'atos', 'campanha', 'encontros', 'referencias']);
  // 2) defeitos
  grava('monstros.json', { ativo: true, monstros: { troll: { hp: -5, look: 99999999 }, 'sem-base': { hp: 10 }, rotworm: { campoInventado: 1 } } });
  grava('itens.json', { ativo: true, itens: { 3268: { attack: -1, rarity: 'azul' }, 99999999: { attack: 1 } } });
  const png = codificarPng(F.criarBitmap(64, 64));
  writeFileSync(join(OV, 'sprites', '368.png'), png);
  grava('sprites.json', { ativo: true, sprites: { 368: { ativo: true, hash: 'errado0000000', meta: { w: 1, h: 1, cw: 1, ch: 1, shift: [0, 0], groups: [] } }, 369: { ativo: true, hash: 'x', meta: {} } } });
  assert.equal(V.iniciar({ escopo: 'rapida' }).ok, true);
  e = await esperarFim();
  assert.equal(e.rapida.geral, 'bloqueante');
  const txt = (id) => por(e.rapida, id).achados.filter((a) => a.nivel === 'erro').map((a) => `${a.onde} ${a.mensagem}`).join(' | ');
  assert.equal(por(e.rapida, 'monstros').status, 'bloqueante');
  assert.match(txt('monstros'), /vida precisa ser um inteiro/);
  assert.match(txt('monstros'), /campoInventado/);
  assert.match(txt('monstros'), /sem-base.*não existe no bestiário/);
  assert.equal(por(e.rapida, 'itens').status, 'bloqueante');
  assert.match(txt('itens'), /raridade "azul" desconhecida/);
  assert.match(txt('itens'), /não existe no catálogo de itens/);
  assert.equal(por(e.rapida, 'sprites').status, 'bloqueante');
  assert.match(txt('sprites'), /hash do cadastro não bate/);
  assert.match(txt('sprites'), /falta a imagem overrides\/sprites\/369\.png/);
  assert.equal(por(e.rapida, 'carga').status, 'bloqueante', 'o servidor ignoraria essas entradas ao subir');
  assert.match(txt('carga'), /\[overrides\]/);
  // 3) JSON quebrado
  grava('monstros.json', '{ quebrado');
  V.iniciar({ escopo: 'rapida' });
  e = await esperarFim();
  assert.equal(por(e.rapida, 'json').status, 'bloqueante');
  assert.match(txt('json'), /monstros\.json.*JSON inválido/);
  assert.match(txt('monstros'), /não é um JSON válido/);
});

test('V6. "pode aprovar": só com validações sem bloqueante E testes aprovados, ambos para o estado de AGORA; mudou o conteúdo depois = precisa rodar de novo', async () => {
  grava('monstros.json', { ativo: true, monstros: {} });
  grava('itens.json', { ativo: true, itens: {} });
  grava('sprites.json', { ativo: true, sprites: {} });
  V._reiniciar();
  assert.equal(V.estado().aptaParaAprovar, false);
  assert.match(V.estado().motivos.join(' '), /Execute as validações/);
  V.iniciar({ escopo: 'rapida' });
  let e = await esperarFim();
  assert.notEqual(e.rapida.geral, 'bloqueante', JSON.stringify(e.rapida.verificacoes.filter((v) => v.status === 'bloqueante')));
  assert.equal(e.aptaParaAprovar, false, 'faltam os testes');
  assert.match(e.motivos.join(' '), /Execute os testes pertinentes/);
  V._injetar({ testes: { quando: Date.now(), ms: 1, arquivos: ['x'], total: 1, passaram: 1, falharam: 0, falhas: [], ok: true, completa: false, modulos: [], assinatura: V.assinaturaDoRepo() } });
  e = V.estado();
  assert.equal(e.aptaParaAprovar, true, e.motivos.join('|'));
  V._injetar({ testes: { ...V.estado().testes, ok: false, falharam: 2 } });
  assert.match(V.estado().motivos.join(' '), /2 teste\(s\) falharam/);
  assert.equal(V.estado().aptaParaAprovar, false);
  V._injetar({ testes: { ...V.estado().testes, ok: true, falharam: 0 } });
  assert.equal(V.estado().aptaParaAprovar, true);
  // erro bloqueante impede
  V._injetar({ rapida: { ...V.estado().rapida, geral: 'bloqueante', resumo: { aprovado: 0, aviso: 0, bloqueante: 1 } } });
  assert.equal(V.estado().aptaParaAprovar, false);
  assert.match(V.estado().motivos.join(' '), /bloqueante/);
  V.iniciar({ escopo: 'rapida' });
  await esperarFim();
  // o conteúdo mudou depois da validação
  grava('monstros.json', { ativo: true, monstros: { troll: { hp: 91 } } });
  e = V.estado();
  assert.equal(e.rapida.desatualizada, true);
  assert.equal(e.aptaParaAprovar, false);
  assert.match(e.motivos.join(' '), /conteúdo mudou depois da última validação/);
  V._injetar({ testes: { ...V.estado().testes, assinatura: 'de-outro-estado' } });
  assert.equal(V.estado().testes.desatualizado, true);
});

test('V7. Git local (só leitura): arquivos alterados com o módulo certo; _versoes e dados de operação não entram; comandos sem texto do usuário', () => {
  const m = Git.moduloDe;
  assert.equal(m('game/gamedata/overrides/monstros.json'), 'monstros');
  assert.equal(m('game/gamedata/overrides/itens.json'), 'itens');
  assert.equal(m('game/gamedata/overrides/sprites/368.png'), 'sprites');
  assert.equal(m('game/gamedata/overrides/sprites.json'), 'sprites');
  assert.equal(m('game/gamedata/sprites/outfits/128.png'), 'sprites');
  assert.equal(m('game/gamedata/atos/ato-cinco.json'), 'atos');
  assert.equal(m('game/gamedata/campanha.json'), 'campanha');
  assert.equal(m('game/gamedata/encontros/x.json'), 'encontros');
  assert.equal(m('game/gamedata/hunts/x.json'), 'hunts');
  assert.equal(m('game/gamedata/item-catalog.json'), 'outros-dados');
  assert.equal(m('game/systems/overrides.mjs'), 'codigo');
  assert.equal(m('game/docs/x.md'), 'docs-e-testes');
  const lista = Git.alterados();
  assert.ok(Array.isArray(lista));
  for (const a of lista) { assert.match(a.caminho, /^game\//); assert.ok(['novo', 'modificado', 'apagado'].includes(a.estado)); assert.ok(!/_versoes/.test(a.caminho)); }
  const fonte = readFileSync(new URL('../admin/git-local.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(fonte, /'(commit|push|checkout|reset|merge|add|stash|clean)'/, 'nenhuma operação que escreva no repositório');
  assert.match(fonte, /execFileSync\('git'/, 'sem shell');
});

test('V8. rotas: estado (leitura), executar (só lê as verificações); testes só no ambiente local; escopo inválido recusado; produção não roda testes', async () => {
  const chama = async (metodo, rota, corpo) => { const r = []; await Http.atender({ method: metodo }, {}, `/api/mapas/_conteudo/${rota}`, new URL('http://x/'), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => corpo }); return r[0]; };
  V._reiniciar();
  const g = await chama('GET', 'validacao');
  assert.equal(g[0], 200);
  assert.deepEqual(Object.keys(g[1]).sort(), ['alterados', 'aptaParaAprovar', 'desde', 'erro', 'linhas', 'modulos', 'motivos', 'rapida', 'repo', 'rodando', 'testes'].sort());
  assert.equal((await chama('POST', 'validacao/executar', { escopo: 'xyz' }))[0], 409);
  Http.ligarHotReload(null);
  const t = await chama('POST', 'validacao/executar', { escopo: 'testes' });
  assert.equal(t[0], 409);
  assert.match(t[1].erros[0], /só rodam no ambiente local/);
  assert.equal(V.estado().rodando, null, 'nada foi iniciado');
  assert.equal(A.classeDaRota('GET', '/api/mapas/_conteudo/validacao'), 'leitura');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/validacao/executar'), 'leitura');
});

test('V9. a tela: menu "Validação e versão", rota própria, só consome rotas do servidor, mostra Aprovado/Aviso/Erro bloqueante, o que roda e se pode aprovar (o botão de aprovar vive em versoes.test.mjs)', () => {
  const ler = (a) => readFileSync(new URL(`../frontend/client/src/${a}`, import.meta.url), 'utf8');
  const conteudo = ler('editor-conteudo.mjs');
  assert.match(conteudo, /\{ id: 'validacao', nome: 'Validação e versão'/);
  assert.match(conteudo, /validacao: criarTelaDeValidacao\(\{ api, raiz: \(\) => \$\('#raiz'\), podeGravar: \(\) => !document\.body\.classList\.contains\('eng-somente-leitura'\) \}\),/);
  assert.match(conteudo, /\['validacao', 'Validação e versão'\]/);
  const tela = ler('editor-validacao.mjs');
  for (const t of ['Aprovado', 'Aviso', 'Erro bloqueante', 'Executar validações', 'Executar testes pertinentes', 'Aprovar e gerar versão', 'só com problema']) assert.ok(tela.includes(t), t);
  assert.match(tela, /api\('validacao'\)/);
  assert.match(tela, /api\('validacao\/executar'/);
  assert.match(tela, /raiz\(\)\.querySelector\('\.val-tela'\)/, 'o laço de atualização para quando a tela sai');
});
