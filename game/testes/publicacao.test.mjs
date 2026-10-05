// Os scripts de publicação (scripts/publicacao/*.sh) rodados DE VERDADE contra repositórios e pastas temporários, com `subir.sh` e a verificação de saúde substituídos por
// comandos de teste. Nada aqui toca em /srv/draevor, em Docker ou na VPS.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPTS = new URL('../../scripts/publicacao/', import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), 'pub-'));
after(() => { try { execFileSync('chmod', ['-R', 'u+w', tmp]); } catch { /* ok */ } rmSync(tmp, { recursive: true, force: true }); });
const ORIGEM = join(tmp, 'origem.git'); const APP = join(tmp, 'app'); const ESTADO = join(tmp, 'releases'); const OUTRO = join(tmp, 'outro');
const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } }).trim();
const app = (...a) => g(APP, ...a);
const grava = (base, rel, c) => { mkdirSync(join(base, rel, '..'), { recursive: true }); writeFileSync(join(base, rel), c); };

// o stub do "subir": registra em qual commit foi chamado; falha se pedirem
const SUBIR = join(tmp, 'subir-stub.sh');
writeFileSync(SUBIR, `#!/usr/bin/env bash\nset -e\necho "$(git -C "$PUB_APP" rev-parse HEAD)" >> "${tmp}/subidas"\n# falha só quando o commit é o que o teste marcou (o anterior sobe normalmente)\n[ ! -e "${tmp}/falhar-subir" ] || [ "$(cat "${tmp}/falhar-subir")" != "$(git -C "$PUB_APP" rev-parse HEAD)" ] || { echo 'docker caiu' >&2; exit 1; }\n`, { mode: 0o755 });
const env = (extra = {}) => ({ ...process.env, PUB_APP: APP, PUB_ESTADO: ESTADO, PUB_SUBIR_CMD: SUBIR, PUB_SAUDE_CMD: `test ! -e "${tmp}/falhar-saude"`, PUB_POR: 'teste', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', ...extra });
const rodar = (script, args = [], extra = {}) => spawnSync('bash', [join(SCRIPTS, script), ...args], { env: env(extra), encoding: 'utf8' });
const log = () => (existsSync(join(ESTADO, 'releases.log')) ? readFileSync(join(ESTADO, 'releases.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []);
const subidas = () => (existsSync(join(tmp, 'subidas')) ? readFileSync(join(tmp, 'subidas'), 'utf8').trim().split('\n') : []);

// repositório: c1 → c2 → c3 na principal; "feature" fora dela
execFileSync('git', ['init', '-q', '--bare', '-b', 'main', ORIGEM]);
execFileSync('git', ['clone', '-q', ORIGEM, OUTRO]);
for (const [k, v] of [['user.email', 't@t'], ['user.name', 't'], ['commit.gpgsign', 'false']]) g(OUTRO, 'config', k, v);
const c = [];
for (const [arq, txt] of [['a.txt', 'um'], ['a.txt', 'dois'], ['a.txt', 'tres']]) { grava(OUTRO, arq, txt); if (!c.length) grava(OUTRO, 'conf.txt', 'conf original'); g(OUTRO, 'add', '-A'); g(OUTRO, 'commit', '-q', '-m', txt); c.push(g(OUTRO, 'rev-parse', 'HEAD')); }
g(OUTRO, 'branch', '-M', 'main'); g(OUTRO, 'push', '-q', 'origin', 'main');
g(OUTRO, 'checkout', '-q', '-b', 'feature', c[0]); grava(OUTRO, 'a.txt', 'so na feature'); g(OUTRO, 'commit', '-q', '-am', 'feature'); const FEATURE = g(OUTRO, 'rev-parse', 'HEAD'); g(OUTRO, 'push', '-q', 'origin', 'feature'); g(OUTRO, 'checkout', '-q', 'main');
execFileSync('git', ['clone', '-q', ORIGEM, APP]);
g(APP, 'config', 'user.email', 't@t'); g(APP, 'config', 'user.name', 't'); g(APP, 'reset', '-q', '--hard', c[0]); // produção está no c1
grava(APP, 'conf.txt', 'conf LOCAL da VPS'); mkdirSync(join(APP, 'certbot'), { recursive: true }); grava(APP, 'certbot/segredo.pem', 'nao-versionado');
const estadoLocal = () => ({ conf: readFileSync(join(APP, 'conf.txt'), 'utf8'), cert: readFileSync(join(APP, 'certbot/segredo.pem'), 'utf8') });

test('PB1. argumentos: só o commit COMPLETO (40 hex) é aceito; lixo, curto, vazio e injeção são recusados antes de qualquer coisa', () => {
  for (const ruim of ['', 'main', 'abc123', c[2].slice(0, 12), `${c[2]}; rm -rf /`, `${c[2]} x`, '$(whoami)', c[2].toUpperCase()]) {
    const r = rodar('publicar.sh', ruim === '' ? [] : [ruim]);
    assert.equal(r.status, 64, `"${ruim}": ${r.stderr}`);
  }
  assert.equal(app('rev-parse', 'HEAD'), c[0], 'produção intocada');
  assert.deepEqual(subidas(), []);
});

test('PB2. recusa o que NÃO está integrado à principal (commit só na branch), o que não é a ponta dela, e o que já está no ar — sem tocar em nada', () => {
  let r = rodar('publicar.sh', [FEATURE]);
  assert.equal(r.status, 68);
  assert.match(r.stderr, /NÃO está integrado à branch principal/);
  r = rodar('publicar.sh', [c[1]]);
  assert.equal(r.status, 69, r.stderr);
  assert.match(r.stderr, /a principal já avançou/);
  assert.equal(rodar('publicar.sh', ['0'.repeat(40)]).status, 67);
  assert.equal(app('rev-parse', 'HEAD'), c[0]);
  assert.deepEqual(subidas(), [], 'nenhum container foi tocado');
  assert.deepEqual(log().map((l) => [l.acao, l.resultado]), [['publicar', 'recusado'], ['publicar', 'recusado']]);
  assert.deepEqual(estadoLocal(), { conf: 'conf LOCAL da VPS', cert: 'nao-versionado' });
});

test('PB3. publicação com sucesso: artefato imutável com hashes, checkout na ponta, modificações locais da VPS preservadas, subir chamado no commit certo, log e estado (atual/anterior)', () => {
  const r = rodar('publicar.sh', [c[2]]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(app('rev-parse', 'HEAD'), c[2]);
  assert.deepEqual(subidas(), [c[2]], 'o subir rodou já no commit publicado');
  assert.deepEqual(estadoLocal(), { conf: 'conf LOCAL da VPS', cert: 'nao-versionado' }, 'a modificação local e o que não é versionado seguem');
  const art = join(ESTADO, 'artefatos', c[2]);
  assert.equal(readFileSync(join(art, 'a.txt'), 'utf8'), 'tres');
  assert.equal(statSync(join(art, 'a.txt')).mode & 0o222, 0, 'artefato somente leitura');
  assert.match(readFileSync(join(ESTADO, 'artefatos', `${c[2]}.sha256`), 'utf8'), /[0-9a-f]{64} {2}\.\/a\.txt/);
  assert.equal(readFileSync(join(ESTADO, 'atual'), 'utf8').trim(), c[2]);
  assert.equal(readFileSync(join(ESTADO, 'anterior'), 'utf8').trim(), c[0]);
  const l = log().filter((x) => x.sha === c[2]).map((x) => x.resultado);
  assert.deepEqual(l, ['iniciada', 'ok']);
  assert.equal(log().at(-1).por, 'teste');
  assert.equal(rodar('publicar.sh', [c[2]]).status, 70, 'republicar o mesmo commit é recusado');
});

test('PB4. ROLLBACK padrão volta para o commit anterior registrado: sobe de novo, preserva a modificação local, registra e atualiza o estado', () => {
  const r = rodar('rollback.sh');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(app('rev-parse', 'HEAD'), c[0]);
  assert.equal(subidas().at(-1), c[0]);
  assert.equal(readFileSync(join(ESTADO, 'atual'), 'utf8').trim(), c[0]);
  assert.deepEqual(estadoLocal(), { conf: 'conf LOCAL da VPS', cert: 'nao-versionado' });
  assert.deepEqual(log().filter((x) => x.acao === 'rollback').map((x) => x.resultado), ['iniciada', 'ok']);
  assert.equal(rodar('rollback.sh', [c[0]]).status, 70, 'já está nele');
  // e dá para publicar de novo depois (o checkout continua na main, atrás da origem: ff-only)
  assert.equal(rodar('publicar.sh', [c[2]]).status, 0);
  assert.equal(app('rev-parse', 'HEAD'), c[2]);
});

test('PB5. rollback para um commit explícito: só da história de origin/main; recusa commit de branch ou inexistente', () => {
  assert.equal(rodar('rollback.sh', [FEATURE]).status, 68);
  assert.equal(rodar('rollback.sh', ['f'.repeat(40)]).status, 67);
  assert.equal(rodar('rollback.sh', ['curto']).status, 64);
  const r = rodar('rollback.sh', [c[1]]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(app('rev-parse', 'HEAD'), c[1]);
  assert.equal(rodar('publicar.sh', [c[2]]).status, 0, 'e volta à ponta');
});

test('PB6. FALHA no subir (docker caiu): rollback AUTOMÁTICO para o que estava no ar, sai com erro, registra falha + rollback automático; a produção termina no commit anterior', () => {
  rodar('rollback.sh', [c[1]]);
  const antes = subidas().length;
  writeFileSync(join(tmp, 'falhar-subir'), c[2]);
  const r = rodar('publicar.sh', [c[2]]);
  rmSync(join(tmp, 'falhar-subir'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FALHA: subir\.sh falhou — voltando para/);
  assert.equal(app('rev-parse', 'HEAD'), c[1], 'voltou ao anterior');
  assert.deepEqual(subidas().slice(antes), [c[2], c[1]], 'tentou subir o novo (falhou) e subiu o anterior');
  assert.deepEqual(log().slice(-5).map((x) => `${x.acao}:${x.resultado}`), ['publicar:iniciada', 'publicar:falhou', 'rollback:iniciada', 'rollback:ok', 'rollback-automatico:ok']);
  assert.ok(log().some((x) => x.acao === 'rollback-automatico' && x.resultado === 'ok'));
  assert.equal(readFileSync(join(ESTADO, 'atual'), 'utf8').trim(), c[1]);
  assert.deepEqual(estadoLocal(), { conf: 'conf LOCAL da VPS', cert: 'nao-versionado' });
});

test('PB7. FALHA na saúde (subiu mas o jogo não responde): também volta sozinho; e se o ROLLBACK também falhar, o log diz "VERIFICAR A PRODUCAO"', () => {
  writeFileSync(join(tmp, 'falhar-saude'), '');
  let r = rodar('publicar.sh', [c[2]]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /o jogo não respondeu na verificação de saúde/);
  assert.match(r.stderr, /o rollback subiu mas o jogo não respondeu na saúde: VERIFICAR A PRODUÇÃO/, 'a saúde também falha no rollback (o teste mantém o arquivo): alerta máximo');
  assert.ok(log().some((x) => x.acao === 'rollback-automatico' && x.resultado === 'falhou' && /VERIFICAR A PRODUCAO/.test(x.detalhe)));
  assert.equal(app('rev-parse', 'HEAD'), c[1], 'ainda assim o código voltou');
  rmSync(join(tmp, 'falhar-saude'));
});

test('PB8. a TRAVA: com uma publicação em andamento, outra (ou um rollback) é recusada com código 75 e nada muda', async () => {
  mkdirSync(ESTADO, { recursive: true });
  const segura = spawn('bash', ['-c', `exec 9>"${join(ESTADO, 'publicacao.trava')}"; flock -n 9 && sleep 30`], { detached: true });
  await new Promise((r) => setTimeout(r, 400));
  const antes = app('rev-parse', 'HEAD');
  const p = rodar('publicar.sh', [c[2]]);
  const rb = rodar('rollback.sh', [c[0]]);
  process.kill(-segura.pid, 'SIGKILL'); // o grupo inteiro (o `sleep` herda a trava)
  assert.equal(p.status, 75);
  assert.match(p.stderr, /outra publicação ou rollback em andamento/);
  assert.equal(rb.status, 75);
  assert.equal(app('rev-parse', 'HEAD'), antes);
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(rodar('publicar.sh', [c[2]]).status, 0, 'liberada a trava, publica normalmente');
});

test('PB9. rollback que PERDERIA uma modificação local da VPS é recusado (git reset --keep) e nada é alterado', () => {
  // um commit antigo que mexe no mesmo arquivo que está modificado localmente na VPS
  g(OUTRO, 'checkout', '-q', 'main'); grava(OUTRO, 'conf.txt', 'conf mudou na principal'); g(OUTRO, 'commit', '-q', '-am', 'conf'); g(OUTRO, 'push', '-q', 'origin', 'main'); const c4 = g(OUTRO, 'rev-parse', 'HEAD');
  app('fetch', '-q', 'origin', 'main');
  // publicar o c4 conflita com a modificação local de conf.txt: aborta ANTES de tocar nos containers
  const antesSub = subidas().length;
  const r = rodar('publicar.sh', [c4]);
  assert.equal(r.status, 71, r.stderr);
  assert.match(r.stderr, /Nada foi alterado nos containers/);
  assert.equal(subidas().length, antesSub);
  assert.equal(app('rev-parse', 'HEAD'), c[2]);
  assert.deepEqual(estadoLocal(), { conf: 'conf LOCAL da VPS', cert: 'nao-versionado' });
});

test('PB10. entrada.sh (o único comando da chave SSH): aceita só publicar <sha40>, rollback, rollback <sha40> e status; recusa o resto, inclusive injeção', () => {
  const ent = (cmd) => spawnSync('bash', [join(SCRIPTS, 'entrada.sh')], { env: env({ SSH_ORIGINAL_COMMAND: cmd }), encoding: 'utf8' });
  for (const ruim of ['', 'bash', 'ls', 'publicar', 'publicar abc', `publicar ${c[2]}; id`, `publicar ${c[2]} && id`, `publicar $(id)`, `publicar ${c[2]}\nid`, 'rollback x', `rollback ${c[0]} extra`, 'status; id', 'cat /etc/passwd', '../publicar.sh']) {
    const r = ent(ruim);
    assert.equal(r.status, 126, JSON.stringify(ruim));
    assert.match(r.stderr, /comando não permitido/);
  }
  const s = ent('status');
  assert.equal(s.status, 0);
  assert.match(s.stdout, /"atual":"[0-9a-f]{40}"/);
  const antes = app('rev-parse', 'HEAD');
  const sem = ent(`publicar ${FEATURE}`);
  assert.equal(sem.status, 68, 'um sha válido passa pela allowlist mas ainda esbarra na regra da principal');
  assert.equal(app('rev-parse', 'HEAD'), antes);
  assert.equal(ent(`rollback ${c[1]}`).status, 0);
  assert.equal(log().at(-1).por, 'engine');
});

test('PB11. higiene: set -euo pipefail em todos, sem eval/curl|sh/--force/chaves; sintaxe válida; o exemplo de authorized_keys usa command= + restrict e NENHUMA chave real', () => {
  for (const f of readdirSync(SCRIPTS).filter((n) => n.endsWith('.sh'))) {
    const t = readFileSync(join(SCRIPTS, f), 'utf8');
    if (f !== 'lib.sh') assert.match(t, /set -e(uo pipefail)?/, f);
    assert.doesNotMatch(t.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n'), /\beval\b|curl[^\n]*\|\s*(ba)?sh|--force|git push|BEGIN (RSA|OPENSSH)|ghp_|password=/i, f);
    assert.equal(spawnSync('bash', ['-n', join(SCRIPTS, f)]).status, 0, `${f}: sintaxe`);
  }
  const ak = readFileSync(join(SCRIPTS, 'authorized_keys.exemplo'), 'utf8');
  assert.match(ak, /command="\/srv\/draevor\/bin\/publicacao\/entrada\.sh",restrict ssh-ed25519 AAAA\.\.\.SUBSTITUIR/);
  assert.doesNotMatch(ak, /AAAAC3[A-Za-z0-9+/]{20,}/, 'nenhuma chave real');
});
