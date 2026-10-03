import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'int-'));
const REPO = join(tmp, 'repo');
const REMOTO = join(tmp, 'remoto.git');
const HOST = join(tmp, 'hospedagem');
process.env.DRAEVOR_OVERRIDES = join(tmp, 'ov');
process.env.ENGINE_VERSOES = join(tmp, 'versoes');
process.env.ENGINE_AUDITORIA = join(tmp, 'auditoria.jsonl');
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_SYSTEM = '/dev/null';
mkdirSync(process.env.DRAEVOR_OVERRIDES, { recursive: true });
after(() => rmSync(tmp, { recursive: true, force: true }));

const Env = await import('../admin/git-envio.mjs');
const I = await import('../admin/git-integracao.mjs');
const Git = await import('../admin/git-local.mjs');
const V = await import('../admin/validacao.mjs');
const Ver = await import('../admin/versoes.mjs');
const Http = await import('../admin/conteudo-http.mjs');
const A = await import('../admin/acesso.mjs');

const sh = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8' }).trim();
const git = (...a) => sh(REPO, ...a);
const host = (...a) => sh(HOST, ...a);
const grava = (base, rel, c) => { const f = join(base, rel); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, typeof c === 'string' ? c : JSON.stringify(c, null, 2)); };
mkdirSync(REPO, { recursive: true });
execFileSync('git', ['init', '-q', '--bare', '-b', 'main', REMOTO]);
git('init', '-q', '-b', 'main'); git('config', 'user.email', 'dono@x.com'); git('config', 'user.name', 'Dono'); git('config', 'commit.gpgsign', 'false');
git('remote', 'add', 'origin', REMOTO);
grava(REPO, 'game/gamedata/overrides/base.json', { base: true });
git('add', '-A'); git('commit', '-q', '-m', 'base'); git('push', '-q', 'origin', 'main');
execFileSync('git', ['clone', '-q', REMOTO, HOST]);
host('config', 'user.email', 'host@x.com'); host('config', 'user.name', 'Host'); host('config', 'commit.gpgsign', 'false');
Git._usarRepo(REPO);

const apta = () => { const t = Date.now(); V._injetar({ rapida: { quando: t, ms: 1, assinatura: V.assinaturaDoConteudo(), geral: 'aprovado', resumo: { aprovado: 9, aviso: 0, bloqueante: 0 }, verificacoes: [] }, testes: { quando: t, ms: 1, arquivos: ['x'], total: 5, passaram: 5, falharam: 0, falhas: [], ok: true, completa: false, modulos: [], assinatura: V.assinaturaDoRepo() } }); };
let n = 0;
/** Uma versão nova (arquivo novo, para as versões não conflitarem entre si) já ENVIADA ao remoto. */
async function versaoEnviada(titulo) {
  n++;
  const rel = `game/gamedata/overrides/dado-${n}.json`;
  grava(REPO, rel, { n, titulo });
  apta();
  const a = Ver.aprovar({ caminhos: [rel], titulo, por: 'dono@x.com' }, { agora: Date.UTC(2026, 9, 3 + n, 12) });
  assert.equal(a.ok, true, JSON.stringify(a.erros));
  const e = await Env.enviar(a.versao.id);
  assert.equal(e.ok, true, JSON.stringify(e.erros));
  return { id: a.versao.id, rel, commit: e.commit };
}
const trazer = (id) => host('fetch', '-q', 'origin', `versao/${id}`);
const estadoDoDono = () => ({ head: git('rev-parse', 'HEAD'), ramo: git('rev-parse', '--abbrev-ref', 'HEAD'), status: git('status', '--porcelain=v1', '-uall'), staged: git('diff', '--cached', '--name-only'), locais: git('for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads') });

test('GI1. versão ainda não integrada: "pendente", o status da versão não muda, não está apta, e diz o que fazer; o repositório do dono fica idêntico', async () => {
  const v = await versaoEnviada('Pendente');
  const antes = estadoDoDono();
  const r = await I.consultar(v.id);
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  assert.deepEqual([r.situacao, r.apta, r.status], ['pendente', false, 'enviada']);
  assert.match(r.motivos[0], /ainda não está em origin\/main: faça o merge/);
  assert.equal(r.principal.commit, host('rev-parse', 'origin/main'));
  assert.equal(Ver.obter(v.id).status, 'enviada');
  assert.deepEqual(estadoDoDono(), antes, 'HEAD, ramo, índice, arquivos e branches locais intactos (só origin/main foi atualizado)');
});

test('GI2. merge commit feito à mão: integrada (modo merge), com o commit do merge, a ponta da principal e apta; vira "integrada" no manifesto e na auditoria; consultar de novo é estável', async () => {
  const v = await versaoEnviada('Merge commit');
  trazer(v.id);
  host('checkout', '-q', 'main'); host('merge', '-q', '--no-ff', '-m', 'Merge pull request', 'FETCH_HEAD'); host('push', '-q', 'origin', 'main');
  const mergeCommit = host('rev-parse', 'HEAD');
  const antes = estadoDoDono();
  const r = await I.consultar(v.id, { agora: 123 });
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  assert.deepEqual([r.situacao, r.modo, r.apta, r.motivos], ['integrada', 'merge', true, []]);
  assert.equal(r.commitIntegrador, mergeCommit);
  assert.equal(r.principal.commit, mergeCommit);
  assert.equal(r.paraPublicar.commit, mergeCommit);
  assert.match(r.paraPublicar.observacao, /ponta da principal/);
  const m = Ver.obter(v.id);
  assert.deepEqual([m.status, m.integracao.commit, m.integracao.modo, m.integracao.verificadaEm], ['integrada', mergeCommit, 'merge', 123]);
  assert.match(readFileSync(process.env.ENGINE_AUDITORIA, 'utf8'), /"tipo":"versao-integrada".*"modo":"merge"/);
  assert.deepEqual(estadoDoDono(), antes);
  const de_novo = await I.consultar(v.id);
  assert.equal(de_novo.situacao, 'integrada');
  assert.equal(readFileSync(process.env.ENGINE_AUDITORIA, 'utf8').match(/versao-integrada/g).length, 1, 'a integração é registrada uma vez só');
});

test('GI3. fast-forward: o commit da versão está na principal; o integrador é o próprio commit', async () => {
  const v = await versaoEnviada('Fast forward');
  // para ser fast-forward a principal precisa estar no commit base da versão (no teste, voltamos a principal do remoto até lá)
  host('fetch', '-q', 'origin'); host('checkout', '-q', 'main'); host('reset', '-q', '--hard', `${v.commit}^`); host('push', '-q', '-f', 'origin', 'main');
  trazer(v.id);
  host('merge', '-q', '--ff-only', 'FETCH_HEAD'); host('push', '-q', 'origin', 'main');
  const r = await I.consultar(v.id);
  assert.deepEqual([r.situacao, r.modo, r.commitIntegrador], ['integrada', 'merge', v.commit]);
});

test('GI4. squash (reescreve o commit): reconhece pelo CONTEÚDO — os arquivos da versão estão na principal exatamente como congelados', async () => {
  const v = await versaoEnviada('Squash');
  host('pull', '-q', '--ff-only', 'origin', 'main');
  trazer(v.id);
  host('merge', '-q', '--squash', 'FETCH_HEAD'); host('commit', '-q', '-m', 'Squash da versão'); host('push', '-q', 'origin', 'main');
  const squash = host('rev-parse', 'HEAD');
  const r = await I.consultar(v.id);
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  assert.deepEqual([r.situacao, r.modo, r.apta], ['integrada', 'conteudo', true]);
  assert.equal(r.commitIntegrador, squash);
});

test('GI5. alterado na principal DEPOIS do merge (outra versão mexeu no arquivo): continua integrada e apta, com aviso listando o arquivo', async () => {
  const v = await versaoEnviada('Depois do merge');
  host('pull', '-q', '--ff-only', 'origin', 'main');
  trazer(v.id);
  host('merge', '-q', '--no-ff', '-m', 'Merge', 'FETCH_HEAD');
  grava(HOST, v.rel, { editado: 'por outra versão' });
  host('commit', '-q', '-am', 'outra versão mexeu'); host('push', '-q', 'origin', 'main');
  const r = await I.consultar(v.id);
  assert.deepEqual([r.situacao, r.modo, r.apta], ['integrada', 'merge', true]);
  assert.deepEqual(r.alteradosDepois, [v.rel]);
  assert.match(r.avisos[0], /alterados na principal depois do merge/);
});

test('GI6. se o remoto não responde: erro claro e o status anterior é MANTIDO; sem buscar, usa o que já foi baixado', async () => {
  const v = await versaoEnviada('Remoto fora');
  git('remote', 'set-url', 'origin', 'https://user:SEGREDO@host-que-nao-existe.invalid/o/r.git');
  const r = await I.consultar(v.id);
  assert.equal(r.ok, false);
  assert.match(r.erros[0], /Não consegui consultar o remoto.*status anterior foi mantido/);
  assert.doesNotMatch(JSON.stringify(r), /SEGREDO/);
  assert.equal(Ver.obter(v.id).status, 'enviada');
  const local = await I.consultar(v.id, { buscar: false });
  assert.equal(local.ok, true);
  assert.equal(local.situacao, 'pendente', 'com o que já se sabe da principal');
  git('remote', 'set-url', 'origin', REMOTO);
});

test('GI7. recusas: versão não enviada, descartada, id inexistente/inválido', async () => {
  n++;
  grava(REPO, `game/gamedata/overrides/dado-${n}.json`, { n });
  apta();
  const a = Ver.aprovar({ caminhos: [`game/gamedata/overrides/dado-${n}.json`], titulo: 'Só aprovada' }, { agora: Date.UTC(2026, 10, 1) });
  assert.match((await I.consultar(a.versao.id)).erros[0], /"aprovada": envie-a ao Git antes/);
  Ver.descartar(a.versao.id);
  assert.match((await I.consultar(a.versao.id)).erros[0], /foi descartada/);
  assert.match((await I.consultar('v9999.99.99-9')).erros[0], /não encontrada/);
  assert.match((await I.consultar('../x')).erros[0], /não encontrada/);
});

test('GI8. integrada → continua consultável; se a versão SAI da principal (revert/force), a consulta diz que não está mais e não está apta', async () => {
  const v = await versaoEnviada('Vai e volta');
  host('pull', '-q', '--ff-only', 'origin', 'main');
  trazer(v.id);
  host('merge', '-q', '--no-ff', '-m', 'Merge', 'FETCH_HEAD'); host('push', '-q', 'origin', 'main');
  assert.equal((await I.consultar(v.id)).situacao, 'integrada');
  host('reset', '-q', '--hard', 'HEAD~1'); host('push', '-q', '-f', 'origin', 'main'); // a principal perdeu o merge (só no teste)
  const r = await I.consultar(v.id);
  assert.equal(r.ok, true);
  assert.deepEqual([r.situacao, r.apta], ['pendente', false]);
  assert.equal(r.status, 'integrada', 'o registro histórico de que ela foi integrada fica');
});

test('GI9. a rota consulta (assíncrona, "grava": bloqueada em produção); o código só usa fetch de origin main e comandos de leitura — nada de merge, checkout, reset, pull, push ou update-ref', async () => {
  const v = await versaoEnviada('Pela rota');
  const r = []; await Http.atender({ method: 'POST' }, {}, '/api/mapas/_conteudo/versoes/consultar', new URL('http://x/'), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => ({ id: v.id }) });
  assert.equal(r[0][0], 200);
  assert.equal(r[0][1].situacao, 'pendente');
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/versoes/consultar'), 'grava');
  const fonte = readFileSync(new URL('../admin/git-integracao.mjs', import.meta.url), 'utf8');
  const codigo = fonte.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const usados = [...new Set([...codigo.matchAll(/rodar\(\['([a-z-]+)'/g)].map((m) => m[1]))].sort();
  assert.deepEqual(usados, ['cat-file', 'fetch', 'hash-object', 'log', 'ls-tree', 'merge-base', 'rev-list', 'rev-parse']);
  assert.match(codigo, /rodar\(\['fetch', remoto, principal\]/);
  assert.doesNotMatch(codigo, /'(push|pull|checkout|reset|update-ref|commit|commit-tree|branch)'|--force/);
});

test('GI10. a tela: "Consultar status no remoto", situação (pendente/integrada), commit do merge, ponta da principal, "Apta para publicação" e o aviso de que o deploy é a etapa seguinte', () => {
  const tela = readFileSync(new URL('../frontend/client/src/editor-validacao.mjs', import.meta.url), 'utf8');
  for (const t of ['Consultar status no remoto', 'versoes/consultar', 'Apta para publicação', 'Integrada à principal', 'Ainda não está na principal', 'integrada']) assert.ok(tela.includes(t), t);
  assert.doesNotMatch(tela, /Deploy para produção/, 'o botão de deploy é da etapa 6');
});
