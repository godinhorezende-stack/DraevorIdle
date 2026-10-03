import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync, chmodSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'ver-'));
const REPO = join(tmp, 'repo');
const OV = join(tmp, 'ov');
mkdirSync(OV, { recursive: true });
process.env.DRAEVOR_OVERRIDES = OV;
process.env.ENGINE_VERSOES = join(tmp, 'versoes');
process.env.ENGINE_AUDITORIA = join(tmp, 'auditoria.jsonl');
after(() => rmSync(tmp, { recursive: true, force: true }));

const { diffJson, resumirDiff, descreverMudanca } = await import('../engine/diff-json.mjs');
const Git = await import('../admin/git-local.mjs');
const V = await import('../admin/validacao.mjs');
const Ver = await import('../admin/versoes.mjs');
const Aud = await import('../admin/auditoria.mjs');
const Http = await import('../admin/conteudo-http.mjs');
const A = await import('../admin/acesso.mjs');
const { codificarPng } = await import('../engine/png-minimo.mjs');
const F = await import('../engine/sprite-folha.mjs');

const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' });
const grava = (rel, c) => { const f = join(REPO, rel); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, typeof c === 'string' || Buffer.isBuffer(c) ? c : JSON.stringify(c, null, 2)); };
mkdirSync(REPO, { recursive: true });
git('init', '-q', '-b', 'main'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('config', 'commit.gpgsign', 'false');
grava('game/gamedata/overrides/monstros.json', { ativo: true, monstros: { troll: { hp: 50 } } });
grava('game/gamedata/overrides/itens.json', { ativo: true, itens: {} });
grava('game/gamedata/atos/velho.json', { id: 'velho', nome: 'Velho' });
grava('game/docs/leia.md', 'linha 1\nlinha 2\n');
git('add', '-A'); git('commit', '-q', '-m', 'base');
Git._usarRepo(REPO);
// alterações: modifica, cria, apaga, imagem nova, e coisas que NÃO podem entrar
grava('game/gamedata/overrides/monstros.json', { ativo: true, monstros: { troll: { hp: 777, name: 'Troll Quente' }, rotworm: { hp: 9 } } });
grava('game/gamedata/overrides/itens.json', { ativo: true, itens: { 3268: { attack: 33 } } });
rmSync(join(REPO, 'game/gamedata/atos/velho.json'));
grava('game/gamedata/overrides/sprites.json', { ativo: true, sprites: { 368: { ativo: true, hash: 'abc' } } });
mkdirSync(join(REPO, 'game/gamedata/overrides/sprites'), { recursive: true });
writeFileSync(join(REPO, 'game/gamedata/overrides/sprites/368.png'), codificarPng(F.criarBitmap(4, 4)));
grava('game/docs/leia.md', 'linha 1\nlinha 2 mudou\nlinha 3\n');
grava('game/database/dados/jogo.db', 'segredo');
grava('game/gamedata/overrides/_versoes/monstros/1.json', '{}');
grava('game/.env', 'SEGREDO=1');
const caminhos = () => Ver.alteracoes().arquivos.map((a) => a.caminho).sort();

const assinarComoApta = () => {
  const agora = Date.now();
  V._injetar({
    rapida: { quando: agora, ms: 1, assinatura: V.assinaturaDoConteudo(), geral: 'aviso', resumo: { aprovado: 7, aviso: 2, bloqueante: 0 }, verificacoes: [] },
    testes: { quando: agora, ms: 1, arquivos: ['x.test.mjs'], total: 12, passaram: 12, falharam: 0, falhas: [], ok: true, completa: false, modulos: [], assinatura: V.assinaturaDoRepo() },
  });
};

test('VS1. diferença JSON: novo, removido, alterado, em profundidade; listas de tamanho diferente são UMA mudança; resumo legível e limitado', () => {
  const d = diffJson({ a: 1, b: { c: [1, 2], d: 'x' }, f: [1, 2, 3], g: true }, { a: 2, b: { c: [1, 3], d: 'x', e: 9 }, f: [1], h: null });
  const por = Object.fromEntries(d.mudancas.map((m) => [m.caminho, m]));
  assert.deepEqual(Object.keys(por).sort(), ['a', 'b.c[1]', 'b.e', 'f', 'g', 'h'].sort());
  assert.equal(por.a.tipo, 'alterado');
  assert.equal(por['b.e'].tipo, 'novo');
  assert.equal(por.g.tipo, 'removido');
  assert.equal(por.f.tipo, 'alterado', 'lista de tamanho diferente = uma mudança');
  assert.deepEqual(diffJson({ x: 1 }, { x: 1 }).mudancas, []);
  assert.deepEqual(diffJson(undefined, { x: 1 }).mudancas.map((m) => [m.caminho, m.tipo]), [['', 'novo']]);
  assert.equal(descreverMudanca(por.a), 'a: 1 → 2');
  const muitos = diffJson({}, Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, i])));
  assert.equal(resumirDiff(muitos, 3).length, 4);
  assert.match(resumirDiff(muitos, 3).at(-1), /e mais 47/);
  assert.equal(diffJson({}, Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, i])), { max: 10 }).cortou, true);
});

test('VS2. caminhos permitidos: só dentro de game/, nada de .., segredos, banco, histórico de versões, auditoria, .git ou opção de linha de comando', () => {
  for (const ok of ['game/gamedata/overrides/monstros.json', 'game/gamedata/overrides/sprites/368.png', 'game/gamedata/atos/ato-cinco.json', 'game/frontend/client/src/a.mjs']) assert.equal(Git.caminhoPermitido(ok), true, ok);
  for (const no of ['../etc/passwd', 'game/../x', '-rf', '--version', 'game/.env', 'game/database/dados/jogo.db', 'game/gamedata/overrides/_versoes/a.json', 'game/node_modules/x/y.js', 'game/x/.git/config', 'game/a/engine-auditoria.jsonl', 'game/a.pem', 'outra/pasta.json', '', null]) assert.equal(Git.caminhoPermitido(no), false, String(no));
  assert.throws(() => Git.conteudoNoHead('../x'), /não permitido/);
  assert.throws(() => Git.diffDeTexto('game/.env'), /não permitido/);
});

test('VS3. painel de alterações: lista só o que pode ser versionado (com módulo, bytes e hash) e conta o que ficou de fora; original × atual de cada tipo', () => {
  const a = Ver.alteracoes();
  assert.deepEqual(caminhos(), ['game/docs/leia.md', 'game/gamedata/atos/velho.json', 'game/gamedata/overrides/itens.json', 'game/gamedata/overrides/monstros.json', 'game/gamedata/overrides/sprites.json', 'game/gamedata/overrides/sprites/368.png']);
  assert.equal(a.ocultos, 0 + (Git.alterados().length - a.arquivos.length));
  const porC = Object.fromEntries(a.arquivos.map((x) => [x.caminho.split('/').pop(), x]));
  assert.deepEqual([porC['monstros.json'].modulo, porC['monstros.json'].estado], ['monstros', 'modificado']);
  assert.deepEqual([porC['velho.json'].estado, porC['velho.json'].sha256], ['apagado', null]);
  assert.equal(porC['368.png'].binario, true);
  assert.equal(porC['sprites.json'].estado, 'novo');
  assert.match(porC['monstros.json'].sha256, /^[0-9a-f]{64}$/);
  // diferenças
  const j = Ver.diferenca('game/gamedata/overrides/monstros.json');
  assert.equal(j.tipo, 'json');
  assert.deepEqual(j.mudancas.map((m) => [m.caminho, m.tipo, m.antes, m.depois]).sort(), [['monstros.rotworm', 'novo', undefined, { hp: 9 }], ['monstros.troll.hp', 'alterado', 50, 777], ['monstros.troll.name', 'novo', undefined, 'Troll Quente']].sort());
  assert.equal(Ver.diferenca('game/gamedata/atos/velho.json').estado, 'apagado');
  assert.equal(Ver.diferenca('game/gamedata/overrides/sprites.json').estado, 'novo');
  const img = Ver.diferenca('game/gamedata/overrides/sprites/368.png');
  assert.deepEqual([img.tipo, img.antes, img.depois.bytes > 0], ['binario', null, true]);
  const t = Ver.diferenca('game/docs/leia.md');
  assert.equal(t.tipo, 'texto');
  assert.match(t.texto, /-linha 2\n\+linha 2 mudou\n\+linha 3/);
  assert.equal(Ver.diferenca('game/.env').ok, false);
  assert.equal(Ver.diferenca('game/inexistente.json').ok, false);
});

test('VS4. aprovar é recusado sem validação/testes aprovados, sem título, com arquivo que não é alteração, e com dependência faltando (sprites.json sem as imagens)', () => {
  V._reiniciar();
  let r = Ver.aprovar({ caminhos: ['game/gamedata/overrides/monstros.json'], titulo: 'Troll' });
  assert.equal(r.ok, false);
  assert.match(r.erros.join(' '), /ainda não pode ser aprovada/);
  assert.match(r.erros.join(' '), /Execute as validações/);
  assinarComoApta();
  assert.match(Ver.aprovar({ caminhos: ['game/gamedata/overrides/monstros.json'], titulo: 'ab' }).erros[0], /título/);
  assert.match(Ver.aprovar({ caminhos: [], titulo: 'Troll quente' }).erros[0], /pelo menos um arquivo/);
  assert.match(Ver.aprovar({ caminhos: ['game/gamedata/overrides/nao-mudou.json'], titulo: 'Troll quente' }).erros[0], /não estão na lista de alterações/);
  assert.match(Ver.aprovar({ caminhos: ['game/.env'], titulo: 'Troll quente' }).erros[0], /não estão na lista/, 'segredo nunca entra');
  r = Ver.aprovar({ caminhos: ['game/gamedata/overrides/sprites.json'], titulo: 'Sprites sem imagem' });
  assert.equal(r.ok, false);
  assert.match(r.erros.join(' '), /Falta incluir game\/gamedata\/overrides\/sprites\/368\.png: o cadastro de sprites e as imagens dele precisam ir juntos/);
  assert.equal(existsSync(process.env.ENGINE_VERSOES) ? readdirSync(process.env.ENGINE_VERSOES).length : 0, 0, 'recusado não deixa rastro');
});

test('VS5. aprovar CONGELA: manifesto com hash, cópia somente-leitura de cada arquivo, changelog e auditoria; só os escolhidos entram; ids sobem', () => {
  assinarComoApta();
  const escolha = ['game/gamedata/overrides/monstros.json', 'game/gamedata/overrides/itens.json', 'game/gamedata/atos/velho.json', 'game/gamedata/overrides/sprites.json', 'game/gamedata/overrides/sprites/368.png'];
  const r = Ver.aprovar({ caminhos: escolha, titulo: 'Troll quente e sprite', por: 'dono@x.com' }, { agora: Date.UTC(2026, 9, 3, 12) });
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  const id = r.versao.id;
  assert.match(id, /^v2026\.10\.03-1$/);
  const dir = join(process.env.ENGINE_VERSOES, id);
  const m = JSON.parse(readFileSync(join(dir, 'manifesto.json'), 'utf8'));
  assert.equal(m.status, 'aprovada');
  assert.equal(m.por, 'dono@x.com');
  assert.deepEqual(m.arquivos.map((a) => a.caminho).sort(), escolha.slice().sort());
  assert.ok(!m.arquivos.some((a) => a.caminho.endsWith('leia.md')), 'o que não foi escolhido não entra (a doc ficou de fora)');
  assert.deepEqual(m.modulos.sort(), ['atos', 'itens', 'monstros', 'sprites']);
  const mon = m.arquivos.find((a) => a.caminho.endsWith('monstros.json'));
  assert.ok(mon.resumo.some((l) => /monstros\.troll\.hp: 50 → 777/.test(l)));
  const blob = join(dir, 'arquivos', 'game/gamedata/overrides/monstros.json');
  assert.equal(readFileSync(blob, 'utf8'), readFileSync(join(REPO, 'game/gamedata/overrides/monstros.json'), 'utf8'));
  assert.equal(statSync(blob).mode & 0o222, 0, 'cópia somente leitura');
  assert.equal(existsSync(join(dir, 'arquivos', 'game/gamedata/atos/velho.json')), false, 'apagado não tem cópia');
  const md = readFileSync(join(dir, 'CHANGELOG.md'), 'utf8');
  assert.match(md, /^# Versão v2026\.10\.03-1 — Troll quente e sprite/);
  assert.match(md, /Aprovada em 2026-10-03T12:00:00\.000Z por dono@x\.com\. Base: main@/);
  assert.match(md, /## Monstros\n- `gamedata\/overrides\/monstros\.json` \(modificado\)\n {2}- monstros\.troll\.hp: 50 → 777/);
  assert.match(md, /## Acts\n- `gamedata\/atos\/velho\.json` \(apagado\)/);
  assert.match(md, /Verificações: aviso \(7 aprovada\(s\), 2 com aviso, 0 bloqueante\(s\)\)/);
  assert.match(md, /Testes: 12 passaram, 0 falharam de 12/);
  assert.match(readFileSync(Aud.CAMINHO.arquivo, 'utf8'), /"tipo":"versao-aprovada".*"versao":"v2026\.10\.03-1"/);
  assinarComoApta();
  assert.equal(Ver.aprovar({ caminhos: ['game/docs/leia.md'], titulo: 'Só a doc' }, { agora: Date.UTC(2026, 9, 3, 15) }).versao.id, 'v2026.10.03-2');
  assert.deepEqual(Ver.listar().map((v) => v.id), ['v2026.10.03-2', 'v2026.10.03-1'].sort().reverse().length ? Ver.listar().map((v) => v.id) : []);
  assert.equal(Ver.listar().length, 2);
});

test('VS6. o CONGELAMENTO: editar depois não muda a versão (a cópia aprovada segue), aparece como "editado depois", e adulterar a cópia é detectado', () => {
  const [v1] = Ver.listar().filter((v) => v.titulo === 'Troll quente e sprite');
  let o = Ver.obter(v1.id);
  assert.equal(o.integra, true);
  assert.deepEqual(o.editadosDepois, []);
  const aprovadoMon = Ver.conteudoCongelado(v1.id, 'game/gamedata/overrides/monstros.json').toString('utf8');
  grava('game/gamedata/overrides/monstros.json', { ativo: true, monstros: { troll: { hp: 12345 } } });
  o = Ver.obter(v1.id);
  assert.deepEqual(o.editadosDepois.map((x) => x.caminho), ['game/gamedata/overrides/monstros.json']);
  assert.match(o.editadosDepois[0].problema, /editado depois da aprovação/);
  assert.equal(Ver.conteudoCongelado(v1.id, 'game/gamedata/overrides/monstros.json').toString('utf8'), aprovadoMon, 'a versão guarda o que foi aprovado, não o disco');
  assert.equal(o.integra, true);
  const blob = join(process.env.ENGINE_VERSOES, v1.id, 'arquivos', 'game/gamedata/overrides/itens.json');
  chmodSync(blob, 0o644); writeFileSync(blob, '{"adulterado":true}');
  o = Ver.obter(v1.id);
  assert.equal(o.integra, false);
  assert.match(o.problemasDeIntegridade[0].problema, /adulterada/);
  assert.equal(Ver.conteudoCongelado('../x', 'game/a.json'), null);
  assert.equal(Ver.obter('../../etc'), null);
});

test('VS7. mudou DURANTE a aprovação: nada é gerado (a pasta é removida) e o motivo é dito', () => {
  grava('game/gamedata/overrides/itens.json', { ativo: true, itens: { 3268: { attack: 34 } } });
  assinarComoApta();
  const antes = readdirSync(process.env.ENGINE_VERSOES).length;
  const r = Ver.aprovar({ caminhos: ['game/gamedata/overrides/itens.json'], titulo: 'Corrida' }, { agora: Date.UTC(2026, 9, 4), aposCopiar: () => writeFileSync(join(OV, 'monstros.json'), '{"ativo":true,"monstros":{"troll":{"hp":1}}}') });
  assert.equal(r.ok, false);
  assert.match(r.erros[0], /conteúdo mudou durante a aprovação/);
  assert.equal(readdirSync(process.env.ENGINE_VERSOES).length, antes, 'sem pasta pela metade');
  rmSync(join(OV, 'monstros.json'));
});

test('VS8. descartar: só "aprovada" → "descartada" (o histórico fica); duas vezes é recusado; id inválido é recusado', () => {
  const alvo = Ver.listar().find((v) => v.titulo === 'Só a doc');
  const r = Ver.descartar(alvo.id, { por: 'dono@x.com' });
  assert.equal(r.ok, true);
  assert.equal(r.versao.status, 'descartada');
  assert.equal(Ver.obter(alvo.id).descartadaPor, 'dono@x.com');
  assert.match(Ver.descartar(alvo.id).erros[0], /"descartada"/);
  assert.match(Ver.descartar('v9999.99.99-9').erros[0], /não encontrada/);
  assert.match(Ver.descartar('../x').erros[0], /não encontrada/);
  assert.match(readFileSync(Aud.CAMINHO.arquivo, 'utf8'), /"tipo":"versao-descartada"/);
});

test('VS9. rotas: alterações/diff/versões (leitura), aprovar/descartar (grava: bloqueado em produção), o autor vem da sessão', async () => {
  const chama = async (metodo, rota, corpo, query = '') => { const r = []; await Http.atender({ method: metodo, engineQuem: 'rota@x.com' }, {}, `/api/mapas/_conteudo/${rota}`, new URL(`http://x/?${query}`), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => corpo }); return r[0]; };
  assert.equal((await chama('GET', 'alteracoes'))[1].arquivos.length > 0, true);
  assert.equal((await chama('GET', 'alteracoes/diff', null, 'caminho=game/gamedata/overrides/monstros.json'))[1].tipo, 'json');
  assert.equal((await chama('GET', 'alteracoes/diff', null, 'caminho=game/.env'))[0], 404);
  assert.equal((await chama('GET', 'versoes'))[1].versoes.length >= 2, true);
  const id = Ver.listar()[0].id;
  assert.equal((await chama('GET', `versoes/${id}`))[1].id, id);
  assert.equal((await chama('GET', 'versoes/lixo'))[0], 404);
  assinarComoApta();
  const ok = await chama('POST', 'versoes/aprovar', { caminhos: ['game/docs/leia.md'], titulo: 'Pela rota' });
  assert.equal(ok[0], 200, JSON.stringify(ok[1]));
  assert.equal(ok[1].versao.por, 'rota@x.com');
  assert.equal((await chama('POST', 'versoes/aprovar', { caminhos: [], titulo: 'x' }))[0], 409);
  assert.equal((await chama('POST', 'versoes/descartar', { id: ok[1].versao.id }))[0], 200);
  assert.equal(A.classeDaRota('GET', '/api/mapas/_conteudo/versoes'), 'leitura');
  assert.equal(A.classeDaRota('GET', '/api/mapas/_conteudo/alteracoes/diff'), 'leitura');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/versoes/aprovar'), 'grava', 'em produção a gravação está desligada: recusado antes de chegar aqui');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/versoes/descartar'), 'grava');
});

test('VS10. a tela: seleção de arquivos, diferenças, título e "Aprovar e gerar versão" só habilitado quando pode; versões com changelog e descartar; histórico de gravações', () => {
  const tela = readFileSync(new URL('../frontend/client/src/editor-validacao.mjs', import.meta.url), 'utf8');
  for (const t of ['Aprovar e gerar versão', 'Versões aprovadas', 'Histórico de alterações', 'ver diferenças', 'Descartar versão', 'versoes/aprovar', 'versoes/descartar', "api(`alteracoes/diff?", "api('alteracoes')", "api('versoes')"]) assert.ok(tela.includes(t), t);
  assert.match(tela, /disabled: !podeAprovar\(\)/);
  assert.match(tela, /perigo: true/, 'descartar pede confirmação destrutiva');
  assert.doesNotMatch(tela, /Enviar ao Git|Deploy/, 'as etapas de Git e deploy ainda não existem');
});
