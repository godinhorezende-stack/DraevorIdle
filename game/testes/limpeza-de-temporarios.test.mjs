// A limpeza de temporários (`systems/limpeza-de-temporarios.mjs`): só o descartável, nada fora das áreas, e sem tocar
// no que importa (backup válido, banco, offline farm). Pastas reais temporárias, com mtime ajustado por `utimes`.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, utimes, chmod, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as T from '../systems/limpeza-de-temporarios.mjs';
import * as SS from '../systems/server-save.mjs';
import * as B from '../database/banco.mjs';
import { HUNT_DE_TESTE } from './apoio.mjs';

const HORA = 3_600_000;
const DIA = 24 * HORA;
const pastas = [];
afterEach(async () => {
  SS.parar();
  for (const p of pastas.splice(0)) {
    await chmod(p, 0o755).catch(() => {});
    await rm(p, { recursive: true, force: true });
  }
});
const nova = async () => { const p = await mkdtemp(join(tmpdir(), 'teste-limpeza-')); pastas.push(p); return p; };
const existe = (p) => access(p).then(() => true, () => false);
async function arquivo(dir, nome, idadeMs = 0, conteudo = 'x') {
  const p = join(dir, nome);
  await writeFile(p, conteudo);
  const t = new Date(Date.now() - idadeMs);
  await utimes(p, t, t);
  return p;
}
const area = (dir, extra = {}) => ({ nome: 'teste', dir, padrao: T.PADROES.temporarioDoJogo, idadeMinimaMs: DIA, ...extra });
const cfg = (areas, extra = {}) => ({ enabled: true, dryRun: false, maxArquivosPorExecucao: 5000, areas, ...extra });
const semUso = () => new Set();

test('T1. remove o temporário velho de operação concluída e preserva o recente e o de outro nome', async () => {
  const d = await nova();
  const velho = await arquivo(d, 'draevor-import-1.tmp', 3 * DIA);
  const recente = await arquivo(d, 'draevor-import-2.tmp', HORA);
  const alheio = await arquivo(d, 'outro-programa.tmp', 30 * DIA);
  const r = await T.executar({ config: cfg([area(d)]), emUso: semUso });
  assert.deepEqual(r.removidos.map((x) => x.arquivo), [velho]);
  assert.equal(await existe(velho), false);
  assert.equal(await existe(recente), true);
  assert.equal(await existe(alheio), true);
  assert.equal(r.puladosRecentes, 1);
});

test('T2. arquivo em uso por um processo é preservado', async () => {
  const d = await nova();
  const aberto = await arquivo(d, 'draevor-aberto.tmp', 3 * DIA);
  const r = await T.executar({ config: cfg([area(d)]), emUso: () => new Set([aberto]) });
  assert.equal(r.removidos.length, 0);
  assert.equal(r.puladosEmUso, 1);
  assert.equal(await existe(aberto), true);
});

test('T3. o /proc real: um arquivo que ESTE processo mantém aberto não é apagado', async () => {
  const d = await nova();
  const p = await arquivo(d, 'draevor-seguro.tmp', 3 * DIA);
  const { open } = await import('node:fs/promises');
  const fh = await open(p, 'r');
  try {
    const r = await T.executar({ config: cfg([area(d)]) });
    assert.equal(r.removidos.length, 0, JSON.stringify(r));
    assert.equal(await existe(p), true);
  } finally {
    await fh.close();
  }
  assert.equal((await T.executar({ config: cfg([area(d)]) })).removidos.length, 1, 'fechado, sai');
});

test('T4. backups: o `.parcial` de dump interrompido sai; backup válido, cópia ANTES-* e tar de mapas ficam, mesmo velhos', async () => {
  const d = await nova();
  const parcial = await arquivo(d, 'jogo-20261001-000000.sql.gz.parcial', DIA);
  const valido = await arquivo(d, 'jogo-20260101-000000.sql.gz', 200 * DIA);
  const antes = await arquivo(d, 'ANTES-DO-RESTORE-20260929-175551.sql.gz', 200 * DIA);
  const mapas = await arquivo(d, 'mapas-antes-raridade-20261001-085030.tar.gz', 200 * DIA);
  const r = await T.executar({ config: cfg([{ nome: 'backups-parciais', dir: d, padrao: T.PADROES.backupParcial, idadeMinimaMs: 6 * HORA }]), emUso: semUso });
  assert.deepEqual(r.removidos.map((x) => x.arquivo), [parcial]);
  for (const p of [valido, antes, mapas]) assert.equal(await existe(p), true, p);
});

test('T5. a lista de NUNCA vence até uma área mal configurada: banco, WAL, config, código e backup ficam', async () => {
  const d = await nova();
  const nomes = ['jogo.db', 'jogo.db-wal', 'jogo.db-shm', 'jogo.db-journal', '.env', 'default.conf', 'config.json', 'codigo.mjs', 'deploy.sh', 'jogo-1.sql.gz', 'x.tar.gz'];
  const ps = [];
  for (const n of nomes) ps.push(await arquivo(d, n, 400 * DIA));
  const larga = { nome: 'larga-demais', dir: d, padrao: /.*/, idadeMinimaMs: DIA };
  const r = await T.executar({ config: cfg([larga]), emUso: semUso });
  assert.equal(r.removidos.length, 0);
  for (const p of ps) assert.equal(await existe(p), true, p);
});

test('T6. logs: só os ROTACIONADOS e velhos saem; o log ativo e o rotacionado recente ficam', async () => {
  const d = await nova();
  const velho1 = await arquivo(d, 'backup.log.1', 20 * DIA);
  const velho2 = await arquivo(d, 'jogo-2026-09-01.log.gz', 20 * DIA);
  const ativo = await arquivo(d, 'backup.log', 90 * DIA);
  const novo = await arquivo(d, 'backup.log.2', 3 * DIA);
  const r = await T.executar({ config: cfg([{ nome: 'logs', dir: d, padrao: T.PADROES.logRotacionado, idadeMinimaMs: 14 * DIA }]), emUso: semUso });
  assert.deepEqual(r.removidos.map((x) => x.arquivo).sort(), [velho1, velho2].sort());
  assert.equal(await existe(ativo), true);
  assert.equal(await existe(novo), true);
});

test('T7. caminhos não autorizados são rejeitados: relativo, raiz, /home, /srv, idade menor que 1 h, área malformada', async () => {
  const motivos = [
    { nome: 'a', dir: 'relativo/x', padrao: /./, idadeMinimaMs: DIA },
    { nome: 'b', dir: '/', padrao: /./, idadeMinimaMs: DIA },
    { nome: 'c', dir: '/home', padrao: /./, idadeMinimaMs: DIA },
    { nome: 'd', dir: '/srv/', padrao: /./, idadeMinimaMs: DIA },
    { nome: 'e', dir: '/tmp', padrao: /./, idadeMinimaMs: 1000 },
    { nome: 'f', dir: '/tmp', padrao: 'texto', idadeMinimaMs: DIA },
    null,
  ];
  const r = await T.executar({ config: cfg(motivos), emUso: semUso });
  assert.equal(r.rejeitadas.length, 7);
  assert.equal(r.removidos.length, 0);
});

test('T8. nada escapa da área: link simbólico, subpasta, nome com `..` e link para fora não são seguidos nem apagados', async () => {
  const d = await nova();
  const fora = await nova();
  const alvo = await arquivo(fora, 'draevor-fora.tmp', 5 * DIA);
  await symlink(alvo, join(d, 'draevor-link.tmp'));
  await mkdir(join(d, 'draevor-pasta.tmp'));
  await arquivo(join(d, 'draevor-pasta.tmp'), 'draevor-dentro.tmp', 5 * DIA);
  const r = await T.executar({ config: cfg([area(d)]), emUso: semUso });
  assert.equal(r.removidos.length, 0);
  assert.equal(await existe(alvo), true, 'o alvo do link não foi tocado');
  assert.equal(await existe(join(d, 'draevor-pasta.tmp', 'draevor-dentro.tmp')), true, 'sem recursão');
  // A própria área como link simbólico para outro lugar: a raiz real é a que vale, e o padrão/idade seguem valendo.
  const ponte = join(await nova(), 'ponte');
  await symlink(fora, ponte);
  const r2 = await T.executar({ config: cfg([area(ponte)]), emUso: semUso });
  assert.deepEqual(r2.removidos.map((x) => x.arquivo), [alvo], 'resolve a área ao diretório real e aplica as mesmas regras nele');
});

test('T9. falha de permissão é registrada, não derruba e os outros arquivos seguem', async (t) => {
  if (process.getuid?.() === 0) return t.skip('como root a permissão não falha');
  const d = await nova();
  await arquivo(d, 'draevor-a.tmp', 3 * DIA);
  await arquivo(d, 'draevor-b.tmp', 3 * DIA);
  await chmod(d, 0o555); // sem escrita no diretório: unlink dá EACCES
  const linhas = [];
  const r = await T.executar({ config: cfg([area(d)]), emUso: semUso, log: (l) => linhas.push(l) });
  assert.equal(r.removidos.length, 0);
  assert.equal(r.erros.length, 2);
  assert.ok(linhas.some((l) => l.includes('ERRO')));
  await chmod(d, 0o755);
});

test('T10. a simulação lista e NÃO apaga', async () => {
  const d = await nova();
  const p = await arquivo(d, 'draevor-sim.tmp', 3 * DIA);
  const linhas = [];
  const r = await T.executar({ config: cfg([area(d)], { dryRun: true }), emUso: semUso, log: (l) => linhas.push(l) });
  assert.equal(r.dryRun, true);
  assert.equal(r.removidos.length, 1);
  assert.equal(await existe(p), true);
  assert.ok(linhas[0].includes('[simulação] removeria'));
});

test('T11. desativada não faz nada; pasta inexistente não é erro; o teto por execução vale', async () => {
  const d = await nova();
  const p = await arquivo(d, 'draevor-x.tmp', 3 * DIA);
  assert.equal((await T.executar({ config: cfg([area(d)], { enabled: false }), emUso: semUso })).desativada, true);
  assert.equal(await existe(p), true);
  const r = await T.executar({ config: cfg([area(join(d, 'nao-existe'))]), emUso: semUso });
  assert.deepEqual([r.erros.length, r.rejeitadas.length], [0, 0]);
  for (let i = 0; i < 5; i++) await arquivo(d, `draevor-lote-${i}.tmp`, 3 * DIA);
  const limitada = await T.executar({ config: cfg([area(d)], { maxArquivosPorExecucao: 2 }), emUso: semUso });
  assert.equal(limitada.removidos.length, 2);
});

test('T12. a configuração: tmp do jogo sempre; backups e logs só se o diretório for dado; padrão não é simulação', () => {
  const base = T.configPadrao({});
  assert.deepEqual(base.areas.map((a) => a.nome), ['temporarios-do-jogo']);
  assert.equal(base.enabled, true);
  assert.equal(base.dryRun, false);
  const cheia = T.configPadrao({ SERVER_SAVE_BACKUPS_DIR: '/srv/draevor/backups', SERVER_SAVE_LOGS_DIR: '/srv/draevor/logs', SERVER_SAVE_LOGS_RETENCAO_DIAS: '7', TEMP_CLEANUP_DRY_RUN: 'true' });
  assert.deepEqual(cheia.areas.map((a) => a.nome), ['temporarios-do-jogo', 'backups-parciais', 'logs-rotacionados']);
  assert.equal(cheia.areas[2].idadeMinimaMs, 7 * DIA);
  assert.equal(cheia.dryRun, true);
  assert.equal(T.configPadrao({ TEMP_CLEANUP_ENABLED: 'false' }).enabled, false);
});

// ---------------------------------------------------------------- integração com o Server Save

const relogio = () => ({ setTimeout: () => ({ unref() {} }), clearTimeout() {}, agora: () => Date.now(), cederLaco: () => Promise.resolve() });
const iniciarSave = (d, extra = {}) => SS.iniciar({ relogio: relogio(), logger: () => {}, anunciar: () => 1, configTemporarios: cfg([area(d)]), ...extra });

test('I1. o Server Save limpa os temporários DEPOIS das verificações e registra no resultado; offline farm e banco ficam intactos', async () => {
  const d = await nova();
  const p = await arquivo(d, 'draevor-sobra.tmp', 3 * DIA);
  const antes = await B.banco.prepare('SELECT COUNT(*) AS n FROM personagens').get();
  await iniciarSave(d);
  const r = await SS.executarAgora();
  assert.equal(r.ok, true);
  assert.equal(r.temporarios.removidos.length, 1);
  assert.equal(await existe(p), false);
  assert.equal(Number((await B.banco.prepare('SELECT COUNT(*) AS n FROM personagens').get()).n), Number(antes.n));
  await B.banco.prepare('DELETE FROM server_save_ciclos WHERE lider = ?').run(SS.PROCESSO_ID);
});

test('I2. pendência no save (jogador sem gravar) ADIA a limpeza inteira: nenhum arquivo é apagado e o save segue com falha própria', async () => {
  const d = await nova();
  const p = await arquivo(d, 'draevor-pendente.tmp', 3 * DIA);
  SS.ligar(new Map([['x', { personagem: {}, estado: {}, gravarAgora: async () => { throw new Error('disco'); } }]]));
  await iniciarSave(d);
  const r = await SS.executarAgora();
  assert.equal(r.ok, false);
  assert.equal(await existe(p), true);
  SS.ligar(new Map());
  await B.banco.prepare('DELETE FROM server_save_ciclos WHERE lider = ?').run(SS.PROCESSO_ID);
});

test('I3. anomalia no offline farm adia a limpeza; erro dentro da limpeza NÃO derruba o Server Save', async () => {
  const d = await nova();
  const p = await arquivo(d, 'draevor-anomalia.tmp', 3 * DIA);
  const c = await B.criarConta({ email: `tmp-${Date.now()}@teste.local`, senha: 'senha-123' });
  const pers = await B.criarPersonagem({ conta: c.id, nome: `Tmp${Date.now() % 1e9}`, vocacao: 'knight', sexo: 'male', estadoInicial: { hunt: { huntId: HUNT_DE_TESTE, offlineDesde: Date.now() + 5 * DIA } } });
  try {
    await iniciarSave(d);
    const r = await SS.executarAgora();
    assert.equal(r.ok, true);
    assert.match(r.temporarios.adiada, /anomalias/);
    assert.equal(await existe(p), true);
  } finally {
    await B.excluirPersonagem(pers.id);
  }
  SS.parar();
  await B.banco.prepare('DELETE FROM server_save_ciclos WHERE lider = ?').run(SS.PROCESSO_ID);
  // Erro de verdade dentro da limpeza: `config.areas` malformado (não iterável) estoura; o save conclui mesmo assim.
  await iniciarSave(d, { configTemporarios: { enabled: true, areas: 5 } });
  const r2 = await SS.executarAgora();
  assert.equal(r2.ok, true);
  assert.ok(r2.temporarios.erro);
  await B.banco.prepare('DELETE FROM server_save_ciclos WHERE lider = ?').run(SS.PROCESSO_ID);
});

test('I4. a limpeza não trava o servidor: 3000 arquivos velhos, o laço de eventos segue respondendo', async () => {
  const d = await nova();
  for (let i = 0; i < 3000; i++) await arquivo(d, `draevor-m-${i}.tmp`, 3 * DIA, '');
  let maior = 0;
  let ultimo = performance.now();
  const id = setInterval(() => { const n = performance.now(); maior = Math.max(maior, n - ultimo - 10); ultimo = n; }, 10);
  const t0 = performance.now();
  const r = await T.executar({ config: cfg([area(d)]), emUso: semUso });
  clearInterval(id);
  console.log(`      [I4] ${r.removidos.length} arquivos em ${(performance.now() - t0).toFixed(0)}ms, laço parou no máximo ${maior.toFixed(0)}ms`);
  assert.equal(r.removidos.length, 3000);
  assert.ok(maior < 250, `o laço parou ${maior}ms`);
});
