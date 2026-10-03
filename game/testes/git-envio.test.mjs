import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'env-'));
const REPO = join(tmp, 'repo');
const REMOTO = join(tmp, 'remoto.git');
process.env.DRAEVOR_OVERRIDES = join(tmp, 'ov');
process.env.ENGINE_VERSOES = join(tmp, 'versoes');
process.env.ENGINE_AUDITORIA = join(tmp, 'auditoria.jsonl');
process.env.GIT_CONFIG_GLOBAL = '/dev/null'; // o autor vem do repositório de teste, nunca da máquina de quem roda
process.env.GIT_CONFIG_SYSTEM = '/dev/null';
mkdirSync(process.env.DRAEVOR_OVERRIDES, { recursive: true });
after(() => rmSync(tmp, { recursive: true, force: true }));

const E = await import('../admin/git-envio.mjs');
const Git = await import('../admin/git-local.mjs');
const V = await import('../admin/validacao.mjs');
const Ver = await import('../admin/versoes.mjs');
const Http = await import('../admin/conteudo-http.mjs');
const A = await import('../admin/acesso.mjs');

const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' });
const noRemoto = (...a) => execFileSync('git', ['--git-dir', REMOTO, ...a], { encoding: 'utf8' }).trim();
const grava = (rel, c) => { const f = join(REPO, rel); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, typeof c === 'string' ? c : JSON.stringify(c, null, 2)); };
mkdirSync(REPO, { recursive: true });
execFileSync('git', ['init', '-q', '--bare', '-b', 'main', REMOTO]);
git('init', '-q', '-b', 'main'); git('config', 'user.email', 'dono@x.com'); git('config', 'user.name', 'Dono'); git('config', 'commit.gpgsign', 'false');
git('remote', 'add', 'origin', REMOTO);
grava('game/gamedata/overrides/monstros.json', { ativo: true, monstros: { troll: { hp: 50 } } });
grava('game/gamedata/overrides/itens.json', { ativo: true, itens: {} });
grava('game/gamedata/atos/velho.json', { id: 'velho' });
grava('game/docs/leia.md', 'doc\n');
grava('outra/coisa.txt', 'fora do jogo\n');
git('add', '-A'); git('commit', '-q', '-m', 'base');
git('push', '-q', 'origin', 'main');
const BASE = git('rev-parse', 'HEAD').trim();
Git._usarRepo(REPO);

const apta = () => { const t = Date.now(); V._injetar({ rapida: { quando: t, ms: 1, assinatura: V.assinaturaDoConteudo(), geral: 'aprovado', resumo: { aprovado: 9, aviso: 0, bloqueante: 0 }, verificacoes: [] }, testes: { quando: t, ms: 1, arquivos: ['x'], total: 5, passaram: 5, falharam: 0, falhas: [], ok: true, completa: false, modulos: [], assinatura: V.assinaturaDoRepo() } }); };
const aprovar = (caminhos, titulo, dia = 3) => { apta(); const r = Ver.aprovar({ caminhos, titulo, por: 'dono@x.com' }, { agora: Date.UTC(2026, 9, dia, 12) }); assert.equal(r.ok, true, JSON.stringify(r.erros)); return r.versao.id; };
const estadoDoRepo = () => ({ head: git('rev-parse', 'HEAD').trim(), ramo: git('rev-parse', '--abbrev-ref', 'HEAD').trim(), status: git('status', '--porcelain=v1', '-uall'), staged: git('diff', '--cached', '--name-only'), refs: git('for-each-ref', '--format=%(refname)').trim().split('\n').filter((r) => !r.includes('versao/')) });

// as alterações do dono (inclusive coisas que NÃO são da versão)
grava('game/gamedata/overrides/monstros.json', { ativo: true, monstros: { troll: { hp: 777, name: 'Troll Quente' } } });
grava('game/gamedata/overrides/itens.json', { ativo: true, itens: { 3268: { attack: 33 } } });
rmSync(join(REPO, 'game/gamedata/atos/velho.json'));
grava('game/docs/leia.md', 'doc mudou — não entra\n');
grava('outra/coisa.txt', 'em andamento, preparada no índice\n');
git('add', 'outra/coisa.txt'); // algo JÁ no índice do dono: o envio não pode tocar nem incluir
grava('game/gamedata/overrides/novo-dado.json', { solto: true }); // novo, não escolhido

test('GE1. link de comparação (GitHub, https e ssh) e saneamento de credenciais', () => {
  assert.equal(E.linkDeComparacao('https://github.com/o/r.git', 'versao/v1-1'), 'https://github.com/o/r/compare/main...versao/v1-1?expand=1');
  assert.equal(E.linkDeComparacao('git@github.com:o/r.git', 'versao/x'), 'https://github.com/o/r/compare/main...versao/x?expand=1');
  assert.equal(E.linkDeComparacao('https://user:tok@github.com/o/r', 'versao/x'), 'https://github.com/o/r/compare/main...versao/x?expand=1');
  assert.equal(E.linkDeComparacao('/caminho/local.git', 'versao/x'), null);
  assert.equal(E.linkDeComparacao('https://gitlab.com/o/r.git', 'versao/x'), null);
  assert.equal(E.sanearUrl('fatal: https://user:SEGREDO@host/x.git não achei'), 'fatal: https://host/x.git não achei');
  assert.equal(E.sanearUrl('falha token=abc123 fim'), 'falha token=*** fim');
});

test('GE2. enviar: branch versao/<id> no remoto com UM commit sobre o base, só dos arquivos congelados; o repositório do dono (HEAD, ramo, índice, árvore, outras refs) fica IDÊNTICO', async () => {
  const id = aprovar(['game/gamedata/overrides/monstros.json', 'game/gamedata/overrides/itens.json', 'game/gamedata/atos/velho.json'], 'Troll quente e item');
  const antes = estadoDoRepo();
  const r = await E.enviar(id, { agora: 1 });
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  assert.equal(r.branch, `versao/${id}`);
  const commit = noRemoto('rev-parse', `refs/heads/versao/${id}`);
  assert.equal(commit, r.commit);
  assert.equal(noRemoto('rev-parse', `${commit}^`), BASE, 'o pai é o commit base');
  assert.equal(noRemoto('rev-list', '--count', `${BASE}..${commit}`), '1', 'um commit só');
  assert.deepEqual(noRemoto('diff', '--name-status', BASE, commit).split('\n').sort(), ['D\tgame/gamedata/atos/velho.json', 'M\tgame/gamedata/overrides/itens.json', 'M\tgame/gamedata/overrides/monstros.json']);
  assert.equal(noRemoto('show', `${commit}:game/gamedata/overrides/monstros.json`), readFileSync(join(REPO, 'game/gamedata/overrides/monstros.json'), 'utf8').trim());
  const msg = noRemoto('log', '-1', '--format=%an <%ae>%n%B', commit);
  assert.match(msg, /^Dono <dono@x\.com>\nversão v2026\.10\.03-1: Troll quente e item\n\n# Versão v2026\.10\.03-1/);
  assert.match(msg, /monstros\.troll\.hp: 50 → 777/);
  assert.deepEqual(noRemoto('for-each-ref', '--format=%(refname)').split('\n').sort(), ['refs/heads/main', `refs/heads/versao/${id}`].sort(), 'só a branch da versão foi enviada');
  assert.deepEqual(estadoDoRepo(), antes, 'HEAD, ramo, índice, arquivos e refs do dono não mudaram');
  assert.match(antes.staged, /outra\/coisa\.txt/);
  assert.ok(!noRemoto('ls-tree', '-r', '--name-only', commit).includes('novo-dado.json'), 'o que não foi escolhido não vai');
  assert.notEqual(noRemoto('show', `${commit}:game/docs/leia.md`), 'doc mudou — não entra');
  const o = Ver.obter(id);
  assert.deepEqual([o.status, o.git.branch, o.git.commit, o.git.erroDeEnvio], ['enviada', `versao/${id}`, commit, null]);
  assert.match(readFileSync(process.env.ENGINE_AUDITORIA, 'utf8'), /"tipo":"versao-enviada"/);
  assert.equal((await E.enviar(id)).ok, false, 'já enviada: não reenvia');
});

test('GE3. o commit usa a cópia CONGELADA, não o que está no disco agora (editar depois não entra)', async () => {
  const id = aprovar(['game/gamedata/overrides/novo-dado.json'], 'Dado solto', 4);
  const aprovado = readFileSync(join(REPO, 'game/gamedata/overrides/novo-dado.json'), 'utf8');
  grava('game/gamedata/overrides/novo-dado.json', { solto: false, editadoDepois: true });
  const r = await E.enviar(id);
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  assert.equal(noRemoto('show', `${r.commit}:game/gamedata/overrides/novo-dado.json`), aprovado.trim());
  assert.equal(readFileSync(join(REPO, 'game/gamedata/overrides/novo-dado.json'), 'utf8').includes('editadoDepois'), true, 'o disco do dono segue como estava');
});

test('GE4. envio que FALHA preserva a versão (commit local + erro) e dá para tentar de novo SEM criar outro commit; credenciais nunca aparecem', async () => {
  grava('game/docs/leia.md', 'doc v3\n');
  const id = aprovar(['game/docs/leia.md'], 'Só a doc', 5);
  git('remote', 'set-url', 'origin', 'https://user:SEGREDO@host-que-nao-existe.invalid/o/r.git');
  const r = await E.enviar(id);
  assert.equal(r.ok, false);
  assert.equal(r.preservada, true);
  assert.match(r.erros.join(' '), /O envio falhou/);
  assert.match(r.erros.join(' '), /continua guardada/);
  assert.doesNotMatch(JSON.stringify(r) + readFileSync(join(process.env.ENGINE_VERSOES, id, 'manifesto.json'), 'utf8') + readFileSync(process.env.ENGINE_AUDITORIA, 'utf8'), /SEGREDO/);
  const m = Ver.obter(id);
  assert.equal(m.status, 'commit-local');
  assert.ok(m.git.commit && m.git.erroDeEnvio);
  assert.equal(git('rev-parse', `refs/heads/versao/${id}`).trim(), m.git.commit, 'o commit existe localmente');
  const commit = m.git.commit;
  git('remote', 'set-url', 'origin', REMOTO); // o dono corrigiu o remoto
  const r2 = await E.enviar(id);
  assert.equal(r2.ok, true, JSON.stringify(r2.erros));
  assert.equal(r2.commit, commit, 'o MESMO commit foi enviado (não criou outro)');
  assert.equal(noRemoto('rev-parse', `refs/heads/versao/${id}`), commit);
  assert.equal(Ver.obter(id).status, 'enviada');
});

test('GE5. link de comparação do GitHub aparece quando o remoto é do GitHub (o push vai para um pushurl local de teste)', async () => {
  grava('game/docs/leia.md', 'doc v4\n');
  const id = aprovar(['game/docs/leia.md'], 'Com link', 6);
  git('remote', 'set-url', 'origin', 'https://github.com/dono/jogo.git');
  git('remote', 'set-url', '--push', 'origin', REMOTO);
  const r = await E.enviar(id);
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  assert.equal(r.link, `https://github.com/dono/jogo/compare/main...versao/${id}?expand=1`);
  assert.equal(Ver.obter(id).git.remoto, 'https://github.com/dono/jogo.git');
  git('remote', 'set-url', 'origin', REMOTO);
  git('config', '--unset-all', 'remote.origin.pushurl');
});

test('GE6. recusas: id inexistente, versão descartada, cópia adulterada, branch que já existe, sem remoto e sem autor no Git', async () => {
  assert.match((await E.enviar('v9999.99.99-9')).erros[0], /não encontrada/);
  assert.match((await E.enviar('../x')).erros[0], /não encontrada/);
  grava('game/docs/leia.md', 'doc v5\n');
  const d = aprovar(['game/docs/leia.md'], 'Descartada', 7);
  Ver.descartar(d);
  assert.match((await E.enviar(d)).erros[0], /"descartada"/);
  grava('game/docs/leia.md', 'doc v6\n');
  const adulterada = aprovar(['game/docs/leia.md'], 'Adulterada', 8);
  const blob = join(process.env.ENGINE_VERSOES, adulterada, 'arquivos', 'game/docs/leia.md');
  chmodSync(blob, 0o644); writeFileSync(blob, 'outra coisa');
  const r = await E.enviar(adulterada);
  assert.match(r.erros[0], /não está íntegra/);
  assert.equal(existsSync(join(REPO, '.git', 'refs', 'heads', 'versao', adulterada)), false, 'nada foi criado');
  grava('game/docs/leia.md', 'doc v7\n');
  const jaExiste = aprovar(['game/docs/leia.md'], 'Branch existente', 9);
  git('branch', `versao/${jaExiste}`, 'HEAD');
  assert.match((await E.enviar(jaExiste)).erros[0], /já existe neste repositório: não sobrescrevo/);
  git('branch', '-D', `versao/${jaExiste}`);
  git('remote', 'remove', 'origin');
  const semRemoto = await E.enviar(jaExiste);
  assert.equal(semRemoto.ok, false);
  assert.match(semRemoto.erros[0], /remoto "origin" não está configurado/);
  assert.equal(Ver.obter(jaExiste).status, 'commit-local', 'o commit ficou guardado');
  git('remote', 'add', 'origin', REMOTO);
  git('config', '--unset', 'user.name');
  grava('game/docs/leia.md', 'doc v8\n');
  const semAutor = aprovar(['game/docs/leia.md'], 'Sem autor', 10);
  assert.match((await E.enviar(semAutor)).erros[0], /user\.name|autor/);
  git('config', 'user.name', 'Dono');
});

test('GE7. a rota (assíncrona) envia; é "grava" (bloqueada em produção); o código nunca usa --force, merge, checkout ou push de outra ref', async () => {
  grava('game/docs/leia.md', 'doc v9\n');
  const id = aprovar(['game/docs/leia.md'], 'Pela rota', 11);
  const r = []; await Http.atender({ method: 'POST', engineQuem: 'rota@x.com' }, {}, '/api/mapas/_conteudo/versoes/enviar', new URL('http://x/'), { json: (a, c, b) => r.push([c, b]), corpoJson: async () => ({ id }) });
  assert.equal(r[0][0], 200, JSON.stringify(r[0][1]));
  assert.equal(r[0][1].branch, `versao/${id}`);
  assert.equal(A.classeDaRota('POST', '/api/mapas/_conteudo/versoes/enviar'), 'grava');
  const fonte = readFileSync(new URL('../admin/git-envio.mjs', import.meta.url), 'utf8');
  const codigo = fonte.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n'); // (os comentários dizem "nunca --force")
  assert.doesNotMatch(codigo, /--force(?!-remove)|'-f'|'merge'|'checkout'|'reset'|'rebase'|'stash'|--set-upstream|'pull'|'fetch'/);
  assert.equal((fonte.match(/'push'/g) ?? []).length, 1);
  assert.match(fonte, /'push', remoto, `\$\{ref\}:\$\{ref\}`/, 'só a branch da versão, sem força');
  assert.match(fonte, /GIT_TERMINAL_PROMPT: '0'/, 'nunca fica esperando senha');
  assert.match(fonte, /spawn\('git', args/, 'sem shell');
});

test('GE8. a tela: botão "Criar branch e enviar ao Git" nas versões aprovadas, estado enviada com branch/commit/link, erro de envio visível e nova tentativa', () => {
  const tela = readFileSync(new URL('../frontend/client/src/editor-validacao.mjs', import.meta.url), 'utf8');
  for (const t of ['Criar branch e enviar ao Git', 'versoes/enviar', 'Tentar enviar de novo', 'Abrir comparação (PR)', 'enviada', 'commit-local']) assert.ok(tela.includes(t), t);
  assert.doesNotMatch(tela, /Deploy|merge automático/);
});
