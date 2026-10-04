// O VALIDADOR CENTRALIZADO da Engine: orquestra as verificações (`validacao-verificacoes.mjs`, num processo à parte) e os testes pertinentes, classifica o
// resultado em APROVADO / AVISO / BLOQUEANTE, guarda o último de cada um e diz se a versão pode ser aprovada. Nada aqui grava conteúdo: só lê e executa
// comandos FIXOS (o processo das verificações e `node --test <arquivos de teste que existem na pasta de testes>`); a interface nunca manda um comando.
import { execFile, spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Git from './git-local.mjs';
import { arquivosEditaveis } from './validacao-verificacoes.mjs';
import { assinaturaDe } from '../systems/hot-reload.mjs';

// O filho não herda o contexto de um `node --test` pai (senão ele só emitiria eventos em vez do relatório legível).
const envLimpo = () => { const e = { ...process.env }; delete e.NODE_TEST_CONTEXT; return e; };
const JOGO = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CAMINHOS = { jogo: JOGO, runner: join(JOGO, 'admin', 'validacao-runner.mjs'), testes: join(JOGO, 'testes') };
const MARCADOR = '@@VALIDACAO@@';
const ORDEM = { aprovado: 0, aviso: 1, bloqueante: 2 };

/** Quais testes cobrem cada módulo (só os que existem). `codigo`/`outros-dados` pedem a suíte completa. */
export const TESTES_POR_MODULO = {
  monstros: ['overrides', 'hot-reload', 'hot-reload-conteudo'],
  itens: ['overrides-itens', 'hot-reload-conteudo'],
  progressao: ['progressao', 'hot-reload-conteudo'],
  conjuntos: ['conjuntos', 'hot-reload-conteudo'],
  sprites: ['sprites-overrides', 'sprites-edicao', 'editor-sprites', 'hot-reload-cliente'],
  atos: ['atos-modelo', 'atos-armazem', 'atos-runtime', 'atos-versoes', 'atos-recompensas', 'atos-editor-tela', 'hot-reload-conteudo'],
  campanha: ['campanha-editor', 'hot-reload-conteudo'],
  encontros: ['editor-conteudo', 'editor-mapas'],
  hunts: ['hunts-painel', 'editor-mapas'],
  geral: ['validacao'],
};

/** Classifica uma lista de achados: erro → bloqueante; aviso → aviso; nada → aprovado. Pura. */
export function statusDe(achados) {
  if (achados.some((a) => a.nivel === 'erro')) return 'bloqueante';
  return achados.length ? 'aviso' : 'aprovado';
}
/** O pior status de uma lista. */
export const piorStatus = (lista) => lista.reduce((p, s) => (ORDEM[s] > ORDEM[p] ? s : p), 'aprovado');

/** Monta o resultado das verificações a partir do que o processo devolveu. Pura. */
export function montarResultado(verificacoes, { quando = Date.now(), ms = 0, assinatura = null } = {}) {
  const lista = verificacoes.map((v) => ({ ...v, status: statusDe(v.achados) }));
  const resumo = { aprovado: 0, aviso: 0, bloqueante: 0 };
  for (const v of lista) resumo[v.status]++;
  return { quando, ms, assinatura, geral: piorStatus(lista.map((v) => v.status)), resumo, verificacoes: lista };
}

/** Os testes que valem para estes módulos (`{ arquivos, completa }`): `completa` quando o código ou dados sem teste dedicado mudaram. Pura (recebe a lista de arquivos existentes). */
export function testesPertinentes(modulos, existentes) {
  const completa = modulos.some((m) => m === 'codigo' || m === 'outros-dados');
  const nomes = new Set();
  for (const m of modulos) for (const n of TESTES_POR_MODULO[m] ?? []) nomes.add(`${n}.test.mjs`);
  nomes.add('validacao.test.mjs');
  return { arquivos: [...nomes].filter((n) => existentes.includes(n)), completa };
}
const testesExistentes = () => (existsSync(CAMINHOS.testes) ? readdirSync(CAMINHOS.testes).filter((n) => /^[a-z0-9-]+\.test\.mjs$/.test(n)) : []);

/** A "impressão" do conteúdo editável de agora (muda quando qualquer arquivo editável muda). */
export const assinaturaDoConteudo = () => assinaturaDe(arquivosEditaveis(process.env.DRAEVOR_OVERRIDES || null));
/** A impressão do estado do repositório (conteúdo + código alterados): os testes só valem para o estado em que rodaram. */
export function assinaturaDoRepo() {
  const h = createHash('sha1');
  h.update(assinaturaDoConteudo());
  const r = Git.estadoDoRepo();
  h.update(`${r.head ?? ''}`);
  for (const a of Git.alterados().sort((x, y) => x.caminho.localeCompare(y.caminho))) h.update(`${a.estado}:${a.caminho}\0`);
  return h.digest('hex').slice(0, 16);
}

// ------------------------------------------------------------------ execução
const S = { rodando: null, desde: null, linhas: 0, rapida: null, testes: null, erro: null };

function executarRapida() {
  return new Promise((ok) => {
    const t0 = Date.now();
    execFile(process.execPath, [CAMINHOS.runner], { cwd: JOGO, env: envLimpo(), timeout: 180000, maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      const i = String(stdout ?? '').lastIndexOf(MARCADOR);
      if (i < 0) {
        const falha = [{ id: 'executor', modulo: 'geral', titulo: 'Execução das verificações', achados: [{ nivel: 'erro', onde: 'validador', mensagem: `as verificações não terminaram${err ? `: ${err.killed ? 'tempo esgotado' : err.message}` : ''}.` }], detalhe: null, ms: Date.now() - t0 }];
        return ok(montarResultado(falha, { ms: Date.now() - t0, assinatura: assinaturaDoConteudo() }));
      }
      try { ok(montarResultado(JSON.parse(String(stdout).slice(i + MARCADOR.length)), { ms: Date.now() - t0, assinatura: assinaturaDoConteudo() })); } catch (e) {
        ok(montarResultado([{ id: 'executor', modulo: 'geral', titulo: 'Execução das verificações', achados: [{ nivel: 'erro', onde: 'validador', mensagem: `resposta ilegível: ${e.message}` }], detalhe: null, ms: 0 }], { ms: Date.now() - t0 }));
      }
    });
  });
}

/** Interpreta a saída do `node --test` (reporter spec): totais e nomes dos que falharam. Pura. */
export function interpretarSaidaDosTestes(texto) {
  const n = (k) => Number(new RegExp(`^(?:ℹ|#) ${k} (\\d+)`, 'm').exec(texto)?.[1] ?? 0);
  const falhas = [...new Set([...texto.matchAll(/^✖ (.+?)(?: \([\d.]+ms\))?$/gm)].map((m) => m[1]).filter((x) => x !== 'failing tests:'))].slice(0, 30);
  return { total: n('tests'), passaram: n('pass'), falharam: n('fail'), falhas };
}

export function executarTestes(arquivos, { pasta = 'testes' } = {}) {
  return new Promise((ok) => {
    const t0 = Date.now();
    const filho = spawn(process.execPath, ['--test', ...arquivos.map((a) => join(pasta, a))], { cwd: JOGO, env: envLimpo() });
    let saida = '';
    const ler = (b) => { saida += b; S.linhas = (saida.match(/\n/g) ?? []).length; };
    filho.stdout.on('data', ler);
    filho.stderr.on('data', ler);
    const limite = setTimeout(() => filho.kill('SIGKILL'), 20 * 60 * 1000);
    filho.on('close', (codigo) => {
      clearTimeout(limite);
      const r = interpretarSaidaDosTestes(saida);
      ok({ quando: Date.now(), ms: Date.now() - t0, arquivos, ...r, ok: codigo === 0 && r.falharam === 0 && r.total > 0, codigo });
    });
  });
}

/**
 * Roda em segundo plano: `escopo` 'rapida' (as verificações), 'testes' (os pertinentes às alterações; `completa: true` roda tudo) ou 'tudo'. Uma por vez.
 * Devolve na hora `{ ok, iniciado }`; o andamento e o resultado vêm de `estado()`.
 */
export function iniciar({ escopo = 'rapida', completa = false } = {}) {
  if (S.rodando) return { ok: false, erro: `Já há uma execução em andamento (${S.rodando}).` };
  if (!['rapida', 'testes', 'tudo'].includes(escopo)) return { ok: false, erro: 'escopo deve ser rapida, testes ou tudo.' };
  S.rodando = escopo;
  S.desde = Date.now();
  S.linhas = 0;
  S.erro = null;
  (async () => {
    try {
      if (escopo === 'rapida' || escopo === 'tudo') S.rapida = await executarRapida();
      if (escopo === 'testes' || escopo === 'tudo') {
        const existentes = testesExistentes();
        const mods = [...new Set([...Git.alterados().map((a) => Git.moduloDe(a.caminho)), ...(S.rapida?.verificacoes ?? []).filter((v) => v.achados.length).map((v) => v.modulo)])];
        const t = testesPertinentes(mods.length ? mods : ['geral'], existentes);
        const arquivos = completa || t.completa ? existentes : t.arquivos;
        const r = await executarTestes(arquivos);
        S.testes = { ...r, completa: arquivos.length === existentes.length, modulos: mods, assinatura: assinaturaDoRepo() };
      }
    } catch (e) { S.erro = e.message; } finally { S.rodando = null; }
  })();
  return { ok: true, iniciado: escopo };
}

/**
 * O estado para o painel: o que está rodando, o último resultado das verificações e dos testes (marcados "desatualizado" se o conteúdo mudou depois), os arquivos
 * alterados com seus módulos e se a versão pode ser aprovada (sem bloqueantes + testes pertinentes aprovados, ambos para o estado de AGORA).
 */
export function estado() {
  const conteudoAgora = assinaturaDoConteudo();
  const rapida = S.rapida ? { ...S.rapida, desatualizada: S.rapida.assinatura !== conteudoAgora } : null;
  const repoAgora = S.testes ? assinaturaDoRepo() : null;
  const testes = S.testes ? { ...S.testes, desatualizado: S.testes.assinatura !== repoAgora } : null;
  const alterados = Git.alterados().map((a) => ({ ...a, modulo: Git.moduloDe(a.caminho) }));
  const motivos = [];
  if (!rapida) motivos.push('Execute as validações.');
  else if (rapida.desatualizada) motivos.push('O conteúdo mudou depois da última validação: execute de novo.');
  else if (rapida.geral === 'bloqueante') motivos.push(`${rapida.resumo.bloqueante} verificação(ões) com erro bloqueante.`);
  if (!testes) motivos.push('Execute os testes pertinentes.');
  else if (testes.desatualizado) motivos.push('O estado do repositório mudou depois dos testes: execute de novo.');
  else if (!testes.ok) motivos.push(`${testes.falharam} teste(s) falharam.`);
  return { rodando: S.rodando, desde: S.desde, linhas: S.linhas, erro: S.erro, rapida, testes, alterados, modulos: [...new Set(alterados.map((a) => a.modulo))], repo: Git.estadoDoRepo(), aptaParaAprovar: motivos.length === 0, motivos };
}

/** Só os testes: injeta resultados (para provar a regra de "pode aprovar" sem rodar a suíte). */
export function _injetar({ rapida = undefined, testes = undefined } = {}) { if (rapida !== undefined) S.rapida = rapida; if (testes !== undefined) S.testes = testes; }
/** Só os testes: zera o estado em memória. */
export function _reiniciar() { S.rodando = null; S.rapida = null; S.testes = null; S.erro = null; S.linhas = 0; }
