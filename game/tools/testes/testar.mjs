#!/usr/bin/env node
// O MOTOR DE TESTES do Draevor (docs/testes-por-nivel.md) — o único: os npm scripts, o hook do Claude Code e o pre-commit do git chamam
// este arquivo; nenhum deles tem lógica de teste própria.
//
//   QUICK   validações rápidas (sintaxe, JSON, marcas de conflito, import) dos arquivos alterados + os testes que dependem DIRETAMENTE deles.
//   SYSTEM  as validações + todos os testes dos sistemas tocados (o mapa curado, `sistemas.mjs`) + os que importam os alterados.
//   FULL    todos os arquivos de teste (testes/*.test.mjs).
//
//   node game/tools/testes/testar.mjs [auto] [arquivo…] classifica as mudanças do git (ou os arquivos dados) e roda o nível que pedem
//   node game/tools/testes/testar.mjs quick [arquivo…]  QUICK (sem arquivo: as mudanças do git)
//   node game/tools/testes/testar.mjs system [sistema…] SYSTEM dos sistemas (sem nome: os das mudanças)
//   node game/tools/testes/testar.mjs full              FULL
//   … --dry-run      não roda nada: mostra arquivos, sistemas, nível, testes escolhidos, a FULL e o porquê
//   … --explain      o porquê de cada sistema e de cada teste escolhido
//   … --hook         o antes-do-commit (Claude Code e git): sai 2 quando barra
//   node game/tools/testes/testar.mjs auditoria [--isolado]   a matriz dos testes (docs/testes-matriz.md)
//   node game/tools/testes/testar.mjs instalar-hook           instala o pre-commit do git (.githooks/pre-commit)
//
// Ele só ESCOLHE quais arquivos de teste o `node --test` roda: não pula, não muda, não marca teste nenhum. A FULL roda todos.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import { join, dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { montarGrafo, todosOsTestes, testesDiretos, ehTeste, RAIZ_DO_JOGO } from './grafo.mjs';
import {
  SISTEMAS, NUCLEO_OBRIGATORIO, FRACAO_PARA_RECOMENDAR_FULL, SISTEMAS_PARA_RECOMENDAR_FULL, SEM_TESTE,
  sistemaPeloNome, sistemasDoTeste, baseDoTeste,
} from './sistemas.mjs';
import { detectarAmbiente, fullPermitida, planejarParalelismo, linhasDoAmbiente, ambienteDosTestes, verificarSeguranca, relatorioDeSeguranca, MENSAGEM_FULL_BLOQUEADA } from './ambiente.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const JOGO = RAIZ_DO_JOGO;
const REPO = resolve(JOGO, '..');
const SAIDA = join(JOGO, 'testes', '.saida');
const COLETOR = join(AQUI, 'coletor.mjs');
/** O QUICK passa disto: os testes alterados, os de nome parecido com o arquivo e os mais rápidos ficam; o resto é do SYSTEM. */
const MAXIMO_DO_QUICK = 20;

// ------------------------------------------------------------------------------------------------- git

// Dentro do pre-commit o git aponta `GIT_INDEX_FILE` para o índice temporário do commit: o motor olha a ÁRVORE DE TRABALHO (é o que os
// testes executam) e o HEAD — nunca o índice —, então tira essa variável dos comandos dele.
const ENV_DO_GIT = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'GIT_INDEX_FILE'));
const git = (args, { tolerante = false } = {}) => {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, env: ENV_DO_GIT });
  if (r.status !== 0 && !tolerante) throw new Error(`git ${args.join(' ')}: ${(r.stderr ?? '').trim()}`);
  return r.status === 0 ? r.stdout : '';
};
const linhas = (t) => t.split('\n').map((l) => l.trim()).filter(Boolean);
/** Caminho do repositório → relativo a `game/` (`game/systems/x.mjs` → `systems/x.mjs`; o resto ganha `../`). */
const doJogo = (p) => (p.startsWith('game/') ? p.slice(5) : `../${p}`);
const doRepo = (p) => (p.startsWith('../') ? p.slice(3) : `game/${p}`);
const casa = (lista, p) => lista.some((re) => re.test(p));

/** As mudanças da árvore de trabalho contra `desde`: mexidos (preparados ou não) e novos. Relativos a `game/`. */
export function mudancas(desde = 'HEAD') {
  const lista = new Set([...linhas(git(['diff', '--name-only', desde, '--'])), ...linhas(git(['ls-files', '--others', '--exclude-standard']))]);
  return [...lista].map(doJogo).sort();
}

/** O hash de blob (o do git) do conteúdo de agora de cada caminho; `null` se não existe. */
function hashesDaArvore(caminhos) {
  const saida = Object.fromEntries(caminhos.map((p) => [p, null]));
  const existem = caminhos.filter((p) => existsSync(join(REPO, doRepo(p))));
  for (let i = 0; i < existem.length; i += 200) {
    const lote = existem.slice(i, i + 200);
    linhas(git(['hash-object', '--', ...lote.map(doRepo)])).forEach((h, k) => (saida[lote[k]] = h));
  }
  return saida;
}

// ------------------------------------------------------------------------------------------------- o fingerprint

/*
 * ---- O FINGERPRINT do estado testado ----
 * Não é um horário: é o hash do CONTEÚDO de todos os arquivos relevantes da árvore de trabalho (os do HEAD, com o conteúdo de agora no lugar
 * dos mexidos, mais os novos — sem a documentação e o resto de `SEM_TESTE`) e da CONFIGURAÇÃO que muda o resultado (a versão do node, o
 * sistema, as variáveis do jogo). Não depende do índice nem do HEAD: depois do commit, a mesma árvore tem o mesmo fingerprint. Um byte
 * diferente num arquivo relevante → outro fingerprint → os testes rodam de novo.
 */
const VARIAVEIS_DO_JOGO = ['DRAEVOR_CLASSICO', 'DRAEVOR_SQLITE', 'DRAEVOR_OVERRIDES', 'ITENS_POE', 'NODE_ENV', 'TZ'];
export function configuracao() {
  return {
    node: process.version,
    plataforma: `${process.platform}-${process.arch}`,
    variaveis: Object.fromEntries(VARIAVEIS_DO_JOGO.filter((v) => process.env[v] != null).map((v) => [v, process.env[v]])),
    // Só se existe (o valor tem senha): muda quais testes rodam de verdade (o Postgres, o Redis).
    servicos: { postgresDeTeste: !!process.env.DATABASE_URL_TESTE, redis: !!process.env.REDIS_URL },
  };
}
export function estadoDaArvore() {
  const conteudo = new Map();
  for (const l of git(['ls-tree', '-r', 'HEAD']).split('\n')) {
    const m = l.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/);
    if (m) conteudo.set(doJogo(m[2]), m[1]);
  }
  const mexidos = mudancas('HEAD');
  for (const [p, h] of Object.entries(hashesDaArvore(mexidos))) h ? conteudo.set(p, h) : conteudo.delete(p);
  const relevantes = [...conteudo].filter(([p]) => !casa(SEM_TESTE, p)).sort(([a], [b]) => (a < b ? -1 : 1));
  return createHash('sha256').update(relevantes.map(([p, h]) => `${p} ${h}`).join('\n')).digest('hex');
}
const sha = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
/** O fingerprint de UMA rodada: o estado, a configuração, o nível e os testes que rodaram. */
export function fingerprint({ estado, config, nivel, testes }) {
  return sha({ estado, config, nivel, testes: nivel === 'full' ? 'todos' : [...testes].sort() });
}

const APROVADAS = join(SAIDA, 'aprovadas.json');
function aprovar(registro) {
  // A FULL nova substitui a anterior; as outras rodadas ficam (as 12 mais recentes).
  const lista = lerJson(APROVADAS, []).filter((a) => !(registro.nivel === 'full' && a.nivel === 'full'));
  lista.unshift(registro);
  writeFileSync(APROVADAS, JSON.stringify(lista.slice(0, 12), null, 1));
}
/** A rodada aprovada sobre ESTE estado e ESTA configuração que cobre `testes` ('todos' = só a FULL serve). */
export function aprovadaQueCobre(testes, estado = estadoDaArvore(), config = configuracao()) {
  const cfg = sha(config);
  for (const a of lerJson(APROVADAS, [])) {
    if (a.estado !== estado || a.config !== cfg) continue;
    if (fingerprint({ estado: a.estado, config: a.configuracao, nivel: a.nivel, testes: a.testes === 'todos' ? [] : a.testes }) !== a.fingerprint) continue; // registro adulterado
    if (a.testes === 'todos' || (testes !== 'todos' && testes.every((t) => a.testes.includes(t)))) return a;
  }
  return null;
}

// ------------------------------------------------------------------------------------------------- a classificação

const ehCliente = (p) => p.startsWith('frontend/');
const FONTE_DO_SISTEMA = (p) => Object.entries(SISTEMAS).flatMap(([id, s]) => s.fontes.filter((re) => re.test(p)).map((re) => ({ id, re: String(re) })));

/**
 * Classifica os arquivos alterados. O MAPA CURADO (`sistemas.mjs`) decide os sistemas; o import DIRETO completa (o teste que importa o
 * arquivo entra sempre). O fecho transitivo NÃO é usado para escolher: pelo `apoio.mjs`, quase todo teste alcança quase todo arquivo.
 * Devolve `{ nivel: 'nada'|'quick'|'system'|'full', full: null|'recomendada'|'obrigatoria', sistemas, testes: { quick, system, todos },
 * porQue: Map(teste → [motivos]), porArquivo, motivos, verificar }`.
 */
export function classificar(arquivos, grafo = montarGrafo()) {
  const todos = todosOsTestes();
  const base = todos.filter((t) => !t.includes('.classico.'));
  const motivos = [];
  const porArquivo = [];
  const porQue = new Map();
  const sistemas = new Set();
  const quick = new Set();
  let full = null;
  const subir = (nivel) => (full = full === 'obrigatoria' || nivel === 'obrigatoria' ? 'obrigatoria' : nivel);
  const anotar = (teste, motivo) => {
    if (!porQue.has(teste)) porQue.set(teste, []);
    porQue.get(teste).push(motivo);
  };
  const irmao = (t) => {
    const outro = t.includes('.classico.') ? t.replace('.classico.test.mjs', '.test.mjs') : t.replace('.test.mjs', '.classico.test.mjs');
    return todos.includes(outro) ? outro : null;
  };
  let codigo = false;
  for (const p of arquivos) {
    const info = { arquivo: p, sistemas: [], padroes: [], diretos: [], fracao: 0, nota: '' };
    porArquivo.push(info);
    if (casa(SEM_TESTE, p)) {
      info.nota = 'sem teste (documentação, skills, configuração do repositório)';
      continue;
    }
    codigo = true;
    const nucleo = NUCLEO_OBRIGATORIO.find((re) => re.test(p));
    if (nucleo) {
      subir('obrigatoria');
      info.nota = `NÚCLEO (${nucleo}) → FULL obrigatória`;
      motivos.push(`${p}: núcleo — infraestrutura dos testes, runner, boot/modo, dados/regras, laço da caçada, persistência ou sessão central`);
      continue;
    }
    if (ehTeste(p)) {
      if (existsSync(join(JOGO, p))) {
        quick.add(p);
        anotar(p, 'é o arquivo alterado');
      }
      const i = irmao(p);
      if (i) {
        quick.add(i);
        anotar(i, `irmão de ${p} (o mesmo arquivo no outro modo)`);
      }
      info.sistemas.push(...sistemasDoTeste(p));
      info.nota = 'arquivo de teste → QUICK';
      continue;
    }
    // O import DIRETO: o teste que importa (ou lê pelo `new URL`) o arquivo entra, esteja ou não no mapa.
    info.diretos = [...testesDiretos(grafo, p)];
    for (const t of info.diretos) {
      quick.add(t);
      anotar(t, `importa diretamente ${p}`);
      const i = irmao(t);
      if (i) {
        quick.add(i);
        anotar(i, `irmão de ${t}, que importa ${p}`);
      }
    }
    info.fracao = info.diretos.filter((t) => !t.includes('.classico.')).length / Math.max(1, base.length);
    if (info.fracao >= FRACAO_PARA_RECOMENDAR_FULL && full !== 'obrigatoria') {
      subir('recomendada');
      motivos.push(`${p}: módulo compartilhado — ${Math.round(info.fracao * 100)}% dos testes dependem dele diretamente`);
    }
    if (ehCliente(p)) {
      info.sistemas.push('cliente');
      info.nota = 'cliente (frontend) → QUICK: as validações e os testes que o importam';
      continue;
    }
    // O MAPA CURADO decide os sistemas.
    info.padroes = FONTE_DO_SISTEMA(p);
    let deles = [...new Set(info.padroes.map((x) => x.id))];
    if (!deles.length) {
      // Fora do mapa: os sistemas dos testes que o importam e de quem o importa (até 3 passos) — sinal auxiliar, e a FULL fica recomendada.
      const achados = new Set(info.diretos.flatMap(sistemasDoTeste));
      let fronteira = [p];
      for (let passo = 0; passo < 3 && !achados.size; passo++) {
        fronteira = fronteira.flatMap((f) => [...(grafo.reverso.get(f) ?? [])]);
        for (const f of fronteira) for (const s of ehTeste(f) ? sistemasDoTeste(f) : FONTE_DO_SISTEMA(f).map((x) => x.id)) achados.add(s);
      }
      deles = [...achados];
      if (full !== 'obrigatoria') subir('recomendada');
      motivos.push(`${p}: fora do mapa de sistemas (tools/testes/sistemas.mjs)${deles.length ? ` — pelos imports, ${deles.join(', ')}` : ' e sem quem o importe'}`);
      info.nota = 'fora do mapa curado → sistemas pelos imports, FULL recomendada';
    }
    for (const s of deles) {
      sistemas.add(s);
      info.sistemas.push(s);
    }
  }
  if (sistemas.size >= SISTEMAS_PARA_RECOMENDAR_FULL && full !== 'obrigatoria') {
    subir('recomendada');
    motivos.push(`alteração em ${sistemas.size} sistemas (${[...sistemas].join(', ')})`);
  }
  const doSistema = new Set(quick);
  for (const t of todos) {
    const deles = sistemasDoTeste(t).filter((s) => sistemas.has(s));
    if (!deles.length) continue;
    doSistema.add(t);
    anotar(t, `teste do sistema ${deles.join(', ')} (mapa curado)`);
  }
  const nivel = !codigo ? 'nada' : full === 'obrigatoria' ? 'full' : sistemas.size ? 'system' : 'quick';
  const existentes = arquivos.filter((p) => existsSync(join(REPO, doRepo(p))));
  return {
    nivel,
    full,
    sistemas: [...sistemas].sort(),
    testes: { quick: escolherQuick([...quick], arquivos), system: [...doSistema].sort(), todos },
    porQue,
    porArquivo,
    motivos,
    verificar: {
      sintaxe: existentes.filter((p) => /\.(mjs|js)$/.test(p)),
      json: existentes.filter((p) => /\.json$/.test(p)),
      conflito: existentes.filter((p) => /\.(mjs|js|json|css|html|md|sh)$/.test(p)),
      // Import de verdade só dos módulos do servidor (o do cliente pede o navegador; o `backend/index.mjs` sobe o servidor).
      importar: existentes.filter((p) => /^(systems|websocket|database|engine|admin)\/.*\.mjs$/.test(p) && !/-worker\.mjs$/.test(p)),
      skills: arquivos.some((p) => p.startsWith('../.claude/skills/')),
    },
  };
}

/** O QUICK fica pequeno: os testes alterados, os de nome parecido com o arquivo, e os mais rápidos (pelos tempos da última rodada). */
function escolherQuick(testes, arquivos) {
  if (testes.length <= MAXIMO_DO_QUICK) return testes.sort();
  const tempos = lerJson(join(SAIDA, 'tempos.json'), {});
  const nomes = arquivos.map((a) => a.split('/').pop().replace(/\.(mjs|js|json)$/, ''));
  const peso = (t) => (arquivos.includes(t) ? 0 : nomes.some((n) => baseDoTeste(t).includes(n)) ? 1 : 2);
  return testes.sort((a, b) => peso(a) - peso(b) || (tempos[a] ?? 5000) - (tempos[b] ?? 5000)).slice(0, MAXIMO_DO_QUICK).sort();
}
const testesDoNivel = (c, nivel) => (nivel === 'full' ? c.testes.todos : nivel === 'system' ? c.testes.system : c.testes.quick);

// ------------------------------------------------------------------------------------------------- as validações rápidas

/*
 * As validações do QUICK (e do SYSTEM, antes dos testes). Não há linter configurado no projeto (nem ESLint nem Prettier no package.json):
 * no lugar, o que pega erro de verdade sem dependência nova — a sintaxe (`node --check`), o JSON, as marcas de conflito de merge esquecidas
 * e o import real dos módulos do servidor (pega import quebrado, export que sumiu, erro no topo do módulo).
 */
function validar(v) {
  const erros = [];
  for (const p of v.sintaxe) {
    const r = spawnSync(process.execPath, ['--check', join(REPO, doRepo(p))], { encoding: 'utf8' });
    if (r.status !== 0) erros.push(`sintaxe — ${p}\n${(r.stderr || r.stdout).trim().split('\n').slice(0, 6).join('\n')}`);
  }
  for (const p of v.json) {
    try {
      JSON.parse(readFileSync(join(REPO, doRepo(p)), 'utf8'));
    } catch (e) {
      erros.push(`JSON — ${p}: ${e.message}`);
    }
  }
  for (const p of v.conflito) {
    const n = readFileSync(join(REPO, doRepo(p)), 'utf8').split('\n').findIndex((l) => /^(<{7}|>{7}|={7})( |$)/.test(l));
    if (n >= 0) erros.push(`marca de conflito de merge — ${p}:${n + 1}`);
  }
  if (v.importar.length) {
    const codigo = `for (const f of ${JSON.stringify(v.importar.map((p) => join(JOGO, p)))}) { try { await import(f); } catch (e) { console.error('IMPORT ' + f + '\\n' + String(e?.stack ?? e).split('\\n').slice(0, 6).join('\\n')); process.exitCode = 1; } } process.exit(process.exitCode ?? 0);`;
    // O ambiente dos testes (sem DATABASE_URL/REDIS_URL): importar `database/banco.mjs` com elas abriria o banco delas.
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', codigo], { cwd: JOGO, encoding: 'utf8', timeout: 120_000, env: ambienteDosTestes() });
    if (r.status !== 0) erros.push(`import — ${(r.stderr || 'tempo esgotado (120 s)').split('\n').filter((l) => /IMPORT|Error|error/.test(l) || l.startsWith('    at')).slice(0, 12).join('\n')}`);
  }
  if (v.skills && existsSync(join(REPO, '.claude', 'skills', 'validar.py'))) {
    const r = spawnSync('python3', [join(REPO, '.claude', 'skills', 'validar.py')], { cwd: REPO, encoding: 'utf8' });
    if (r.error?.code !== 'ENOENT' && r.status !== 0) erros.push(`skills — ${(r.stdout + r.stderr).trim().split('\n').slice(-6).join('\n')}`);
  }
  return erros;
}

// ------------------------------------------------------------------------------------------------- rodar e relatar

const lerJson = (f, padrao) => {
  try {
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch {
    return padrao;
  }
};
const carimboDeTempo = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const seg = (ms) => `${(ms / 1000).toFixed(1)} s`;
const duracao = (ms) => (ms >= 60_000 ? `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s` : seg(ms));

/** Roda os arquivos pelo `node --test` (um processo por arquivo, em paralelo — o de sempre), com o coletor; devolve o JSON da rodada. */
function rodarTestes(nivel, testes, plano) {
  mkdirSync(SAIDA, { recursive: true });
  const marca = carimboDeTempo();
  const log = join(SAIDA, `${nivel}-${marca}.log`);
  const json = join(SAIDA, `${nivel}-${marca}.json`);
  const args = ['--test', `--test-concurrency=${plano.workers}`, `--test-reporter=${COLETOR}`, '--test-reporter-destination=stdout', '--test-reporter=spec', `--test-reporter-destination=${log}`, ...testes];
  return new Promise((ok) => {
    const filho = spawn(process.execPath, args, { cwd: JOGO, stdio: ['ignore', 'inherit', 'inherit'], env: ambienteDosTestes({ DRAEVOR_TESTES_JSON: json }) });
    // Prioridade baixa (servidor do jogo nesta máquina): os processos de teste que o runner abrir depois herdam o `nice`.
    if (plano.prioridade) {
      try {
        os.setPriority(filho.pid, plano.prioridade);
      } catch {}
    }
    filho.on('exit', (codigo) => {
      const r = lerJson(json, null) ?? { resumo: null, arquivos: {}, testes: [], falhas: [] };
      Object.assign(r, { codigo, log });
      ok(r);
    });
  });
}

function relatorio(nivel, r, esperados, ambiente = '') {
  const s = r.resumo ?? {};
  const arquivos = Object.entries(r.arquivos ?? {});
  const total = arquivos.reduce((a, [, x]) => a + (x.ms ?? 0), 0);
  const deTeste = arquivos.reduce((a, [, x]) => a + (x.testesMs ?? 0), 0);
  const lentos = [...arquivos].sort((a, b) => b[1].ms - a[1].ms).slice(0, nivel === 'full' ? 10 : 5);
  const titulo = nivel === 'full' ? 'FULL SUITE' : nivel.toUpperCase();
  const saida = [
    '',
    titulo,
    '='.repeat(titulo.length),
    `Arquivos: ${arquivos.length} de ${esperados}`,
    `Total:    ${s.tests ?? '?'}`,
    `Passed:   ${s.passed ?? '?'}`,
    `Failed:   ${s.failed ?? '?'}`,
    `Skipped:  ${s.skipped ?? '?'}`,
    `Todo:     ${s.todo ?? 0}`,
    `Duration: ${duracao(r.fim && r.inicio ? r.fim - r.inicio : s.ms ?? 0)}`,
    '',
    ambiente,
    '',
    // A carga do jogo (o `apoio.mjs` carrega tudo) e os testes em si, somados por arquivo (cada arquivo é um processo).
    `BOOT:  ${duracao(total - deTeste)}  (carga do jogo em cada processo, somada)`,
    `TESTS: ${duracao(deTeste)}  (os testes em si, somados)`,
    `TOTAL: ${duracao(total)}  (somado por arquivo; a parede acima é menor porque os arquivos rodam em paralelo)`,
    '',
    'Arquivos mais lentos (total = boot + testes):',
    ...lentos.map(([f, a], i) => `${String(i + 1).padStart(3)}. ${f} — ${seg(a.ms)} (boot ${seg(a.ms - (a.testesMs ?? 0))}, testes ${seg(a.testesMs ?? 0)}; ${a.testes} testes)`),
  ];
  if (nivel === 'full') {
    const testesLentos = [...(r.testes ?? [])].sort((a, b) => b.ms - a.ms).slice(0, 5);
    saida.push('', 'Testes mais lentos:', ...testesLentos.map((t, i) => `${String(i + 1).padStart(3)}. ${t.arquivo} — ${t.nome.slice(0, 90)} — ${seg(t.ms)}`));
  }
  if (r.falhas?.length) {
    saida.push('', `Falhas (${r.falhas.length}) — classifique cada uma (A bug real · B obsoleto · C adaptar · D removido · E regressão); não ajuste o teste para passar:`);
    for (const f of r.falhas.slice(0, 30)) saida.push(`  ✖ ${f.arquivo}:${f.linha ?? '?'} — ${f.nome}`, ...f.erro.split('\n').slice(0, 4).map((l) => `      ${l}`));
    if (r.falhas.length > 30) saida.push(`  … e mais ${r.falhas.length - 30}`);
  }
  if (arquivos.length < esperados) saida.push('', `ATENÇÃO: ${esperados - arquivos.length} arquivo(s) não terminaram (travou, caiu ou foi interrompido) — veja o log.`);
  saida.push('', `Log completo: ${r.log}`);
  return saida.join('\n');
}

function guardarTempos(r) {
  const f = join(SAIDA, 'tempos.json');
  const t = lerJson(f, {});
  for (const [arquivo, a] of Object.entries(r.arquivos ?? {})) t[arquivo] = a.ms;
  writeFileSync(f, JSON.stringify(t, null, 1));
}

/** Roda um nível: as validações (se houver), os testes, o relatório e — se passou — o registro aprovado com o fingerprint. */
/*
 * ---- Uma rodada por vez na mesma árvore ----
 * Duas rodadas juntas disputam as mesmas linhas do SQLite (medido: o server save reivindica o ciclo pelo horário e a segunda cópia é
 * recusada). A trava (`.saida/rodando.lock`, com o pid) recusa a segunda; uma trava de processo que já morreu é retomada.
 */
const TRAVA = join(SAIDA, 'rodando.lock');
function travar(nivel) {
  mkdirSync(SAIDA, { recursive: true });
  const registro = JSON.stringify({ pid: process.pid, nivel, desde: new Date().toISOString() });
  try {
    writeFileSync(TRAVA, registro, { flag: 'wx' });
  } catch {
    const atual = lerJson(TRAVA, null);
    let viva = false;
    try {
      viva = !!atual?.pid && atual.pid !== process.pid && process.kill(atual.pid, 0);
    } catch {}
    if (viva) return atual;
    writeFileSync(TRAVA, registro);
  }
  const soltar = () => {
    try {
      if (lerJson(TRAVA, null)?.pid === process.pid) unlinkSync(TRAVA);
    } catch {}
  };
  process.once('exit', soltar);
  for (const sinal of ['SIGINT', 'SIGTERM']) process.once(sinal, () => (soltar(), process.exit(130)));
  return null;
}

async function executar(nivel, testes, validacoes = null, amb = detectarAmbiente(REPO)) {
  if (validacoes) {
    const erros = validar(validacoes);
    if (erros.length) {
      console.error(`\n${nivel.toUpperCase()}: as validações rápidas falharam — nenhum teste rodou:\n\n${erros.join('\n\n')}`);
      return false;
    }
    const n = validacoes.sintaxe.length + validacoes.json.length + validacoes.importar.length + validacoes.conflito.length;
    if (n) console.log(`✔ validações rápidas: ${validacoes.sintaxe.length} sintaxe · ${validacoes.json.length} JSON · ${validacoes.conflito.length} sem marca de conflito · ${validacoes.importar.length} import (lint: não há linter configurado no projeto)`);
  }
  // O estado é fotografado ANTES da rodada: o que mudar durante ela não sai aprovado.
  const estado = estadoDaArvore();
  const config = configuracao();
  if (!testes.length) {
    console.log(`${nivel.toUpperCase()}: nenhum arquivo de teste depende diretamente das mudanças.`);
    return true;
  }
  const ocupada = travar(nivel);
  if (ocupada) {
    console.error(`\nOutra rodada (${String(ocupada.nivel).toUpperCase()}, pid ${ocupada.pid}, desde ${ocupada.desde}) está em andamento nesta árvore: duas juntas disputam o mesmo SQLite. Espere ela terminar.`);
    return false;
  }
  const plano = planejarParalelismo(amb, testes.length);
  const linhasAmb = linhasDoAmbiente(amb, plano);
  console.log(`\n${nivel.toUpperCase()} — ${testes.length} arquivo(s) de teste\n${linhasAmb}\n`);
  const r = await rodarTestes(nivel, testes, plano);
  guardarTempos(r);
  const texto = relatorio(nivel, r, testes.length, linhasAmb);
  console.log(texto);
  if (nivel === 'full') writeFileSync(join(SAIDA, 'ultima-full.txt'), texto);
  const ok = r.codigo === 0 && !(r.falhas ?? []).length && Object.keys(r.arquivos ?? {}).length >= testes.length;
  if (ok) {
    const lista = nivel === 'full' ? 'todos' : [...testes].sort();
    aprovar({ nivel, quando: new Date().toISOString(), estado, config: sha(config), configuracao: config, testes: lista, fingerprint: fingerprint({ estado, config, nivel, testes: lista === 'todos' ? [] : lista }), resumo: r.resumo });
    console.log(`\n✔ Aprovado — fingerprint ${fingerprint({ estado, config, nivel, testes: lista === 'todos' ? [] : lista }).slice(0, 12)} (${nivel.toUpperCase()} sobre este conteúdo)`);
  }
  return ok;
}

// ------------------------------------------------------------------------------------------------- o que mostrar

const nomeDaFull = (c) => (c.full === 'obrigatoria' ? 'OBRIGATÓRIA' : c.full === 'recomendada' ? 'recomendada' : 'não necessária');
function aviso(c) {
  if (c.full !== 'recomendada') return '';
  return `\n⚠️  FULL SUITE RECOMENDADA (não bloqueia — rode \`npm test\` antes do merge/deploy):\n${c.motivos.map((m) => `   - ${m}`).join('\n')}`;
}

function dryRun(c, arquivos, nivel = c.nivel) {
  const testes = nivel === 'nada' ? [] : testesDoNivel(c, nivel);
  const s = ['Arquivos modificados:'];
  if (!arquivos.length) s.push('  (nenhum)');
  for (const a of c.porArquivo) s.push(`  ${a.arquivo}${a.sistemas.length ? `  → ${[...new Set(a.sistemas)].join(', ')}` : ''}${a.nota ? `  [${a.nota}]` : ''}`);
  s.push('', `Sistemas detectados: ${c.sistemas.length ? c.sistemas.join(', ') : '(nenhum)'}`, '', `Classificação: ${nivel.toUpperCase()}`, '', `Testes selecionados (${testes.length}${nivel === 'full' ? ' — todos' : ''}):`);
  for (const t of nivel === 'full' ? testes.slice(0, 10) : testes) s.push(`  ${t}`);
  if (nivel === 'full' && testes.length > 10) s.push(`  … e mais ${testes.length - 10}`);
  const estado = estadoDaArvore();
  const ja = nivel === 'nada' ? null : aprovadaQueCobre(nivel === 'full' ? 'todos' : testes, estado);
  const amb = detectarAmbiente(REPO);
  const pode = fullPermitida(amb);
  s.push('', linhasDoAmbiente(amb, planejarParalelismo(amb, testes.length)), `FULL aqui: ${pode.ok ? 'permitida' : `RECUSADA — ${pode.motivo}`}`);
  s.push('', `FULL: ${nomeDaFull(c)}`, '', `Fingerprint do estado: ${estado.slice(0, 12)} — ${ja ? `JÁ APROVADO pela rodada ${ja.nivel.toUpperCase()} de ${ja.quando} (nada rodaria)` : 'ainda não aprovado para este nível'}`, '', 'Motivo:', ...(c.motivos.length ? c.motivos.map((m) => `  - ${m}`) : [`  - ${nivel === 'nada' ? 'só arquivos sem teste' : nivel === 'quick' ? 'mudança no cliente, num teste ou sem sistema: as validações e os testes que dependem diretamente dela' : `o mapa curado liga as mudanças a ${c.sistemas.join(', ')}`}`]));
  return s.join('\n');
}

function explicar(c, nivel = c.nivel) {
  const s = [];
  for (const a of c.porArquivo) {
    s.push(`Arquivo: ${a.arquivo}`);
    if (a.nota) s.push(`  ${a.nota}`);
    if (a.padroes?.length) for (const x of a.padroes) s.push(`  sistema ${x.id} — o mapa curado casa ${x.re}`);
    if (a.sistemas.length && !a.padroes?.length) s.push(`  sistemas: ${[...new Set(a.sistemas)].join(', ')}`);
    const nomes = [...new Set((a.diretos ?? []).map(baseDoTeste))];
    if (nomes.length) s.push(`  testes que o importam diretamente (${nomes.length}, ${Math.round(a.fracao * 100)}% dos testes): ${nomes.slice(0, 10).join(', ')}${nomes.length > 10 ? '…' : ''}`);
    s.push('');
  }
  s.push(`Sistemas: ${c.sistemas.join(', ') || '(nenhum)'}`, `Classificação: ${nivel.toUpperCase()}`, `FULL: ${nomeDaFull(c)}`);
  if (c.motivos.length) s.push('Motivo:', ...c.motivos.map((m) => `  - ${m}`));
  if (nivel !== 'full' && nivel !== 'nada') {
    s.push('', 'Por que cada teste:');
    for (const t of testesDoNivel(c, nivel)) s.push(`  ${t}`, ...[...new Set(c.porQue.get(t) ?? [])].map((m) => `      ${m}`));
  }
  return s.join('\n');
}

// ------------------------------------------------------------------------------------------------- o pre-commit do git

/** Instala o pre-commit do git: um stub na pasta de hooks do repositório que chama `.githooks/pre-commit` (versionado). */
function instalarHook() {
  const versionado = join(REPO, '.githooks', 'pre-commit');
  if (!existsSync(versionado)) {
    console.error(`Não achei ${versionado}.`);
    return 2;
  }
  const pasta = git(['rev-parse', '--git-path', 'hooks']).trim();
  const destino = join(isAbsolute(pasta) ? pasta : join(REPO, pasta), 'pre-commit');
  const MARCA = '# draevor: testes por nível';
  if (existsSync(destino) && !readFileSync(destino, 'utf8').includes(MARCA)) {
    console.error(`Já existe um pre-commit que não é este (${destino}). Não sobrescrevi: chame .githooks/pre-commit de dentro dele.`);
    return 2;
  }
  // O stub chama o pre-commit da árvore em que o commit acontece (cada worktree, o seu); sem ele (branch antiga), não faz nada.
  writeFileSync(destino, `#!/bin/sh\n${MARCA} — instalado por \`npm run test:instalar-hook\`; a lógica é a de .githooks/pre-commit\nhook="$(git rev-parse --show-toplevel)/.githooks/pre-commit"\n[ -f "$hook" ] || exit 0\nexec sh "$hook" "$@"\n`);
  chmodSync(destino, 0o755);
  // Não mexe em `core.hooksPath`: os outros hooks da pasta (o post-commit do graphify, por exemplo) seguem valendo.
  console.log(`Instalado: ${destino} → .githooks/pre-commit (core.hooksPath não foi alterado; os outros hooks continuam).`);
  return 0;
}

// ------------------------------------------------------------------------------------------------- os comandos

async function principal(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith('--') && !a.includes('=')));
  const desde = argv.find((a) => a.startsWith('--desde='))?.slice(8) ?? 'HEAD';
  const posicionais = argv.filter((a) => !a.startsWith('--'));
  const comando = ['quick', 'system', 'full', 'auto', 'auditoria', 'instalar-hook', 'ambiente'].includes(posicionais[0]) ? posicionais.shift() : 'auto';
  const dry = flags.has('--dry-run');
  const explain = flags.has('--explain');
  const hook = flags.has('--hook');

  if (comando === 'auditoria') return (await import('./auditoria.mjs')).auditar({ isolado: flags.has('--isolado') });
  if (comando === 'instalar-hook') return instalarHook();
  if (comando === 'ambiente') {
    // A verificação de segurança, sem rodar nada: o ambiente, os sinais do servidor do jogo, os processos, as URLs (mascaradas), o isolamento.
    const amb = detectarAmbiente(REPO);
    console.log(`${relatorioDeSeguranca(amb)}\n\n${linhasDoAmbiente(amb, planejarParalelismo(amb, todosOsTestes().length))}`);
    return 0;
  }

  // Os arquivos: os dados (quick) ou as mudanças do git.
  const arquivos = (comando === 'quick' || comando === 'auto') && posicionais.length ? posicionais.map((a) => doJogo(a.replace(/^\.\//, ''))) : mudancas(desde);
  const c = classificar(arquivos);

  // O nível pedido: o do comando, ou o da classificação (auto).
  let nivel = comando === 'auto' ? c.nivel : comando;
  let testes;
  if (comando === 'system' && posicionais.length) {
    const ids = posicionais.map((n) => sistemaPeloNome(n) ?? n);
    const desconhecidos = ids.filter((id) => !SISTEMAS[id]);
    if (desconhecidos.length) {
      console.error(`Sistema desconhecido: ${desconhecidos.join(', ')}.\nOs sistemas: ${Object.entries(SISTEMAS).map(([id, s]) => `${id} (${s.apelidos.join(', ')})`).join('; ')}`);
      return 2;
    }
    testes = c.testes.todos.filter((t) => sistemasDoTeste(t).some((s) => ids.includes(s)));
    c.sistemas = ids;
    c.motivos = [`pedido explícito: ${ids.join(', ')}`];
    for (const t of testes) c.porQue.set(t, [`teste do sistema ${sistemasDoTeste(t).filter((s) => ids.includes(s)).join(', ')} (mapa curado)`]);
    c.testes.system = testes;
  }
  if (nivel === 'nada') testes = [];
  testes ??= testesDoNivel(c, nivel);

  if (dry || explain) {
    console.log(dry ? dryRun(c, arquivos, nivel) : explicar(c, nivel));
    return 0;
  }
  const amb = detectarAmbiente(REPO);
  if (amb.nome === 'PRODUCTION') {
    console.error(`Ambiente de PRODUÇÃO (${amb.motivo}): os testes não rodam aqui — nem QUICK, nem SYSTEM, nem FULL. Rode numa cópia de desenvolvimento ou no CI.`);
    return 2;
  }
  // Sem isolamento seguro (sobrou URL de produção no ambiente dos testes, ou o banco de teste é o do jogo): nada roda.
  const seguranca = verificarSeguranca();
  if (!seguranca.ok) {
    console.error(`Testes BLOQUEADOS — isolamento inseguro:\n${seguranca.problemas.map((p) => `  - ${p}`).join('\n')}`);
    return 2;
  }
  // A FULL (pedida, ou a obrigatória do auto/hook) só onde ela pode rodar: nunca no host do jogo nem em produção.
  if (nivel === 'full') {
    const pode = fullPermitida(amb, seguranca);
    if (!pode.ok) {
      const jaAprovada = comando === 'auto' && aprovadaQueCobre('todos');
      if (!jaAprovada) {
        const porQue = c.motivos.length && comando !== 'full' ? `\n  Por que a FULL:\n${c.motivos.map((m) => `    - ${m}`).join('\n')}` : '';
        const cabeca = hook ? 'FULL obrigatória detectada, mas o ambiente atual não é adequado para execução automática.\n' : '';
        console.error(`\n${cabeca}${pode.motivo}${porQue}\n\n${relatorioDeSeguranca(amb, seguranca)}\n\nO que fazer: rode \`npm test\` numa máquina de desenvolvimento, no CI, em staging ou num ambiente dedicado de testes; com o mesmo conteúdo aprovado lá, o commit passa.`);
        return 2;
      }
    } else if (!dry && !explain) console.log(`\nVerificação de segurança antes da FULL:\n${relatorioDeSeguranca(amb, seguranca)}\n`);
  }

  console.log(dryRun(c, arquivos, nivel).split('\n\nTestes selecionados')[0]);
  if (nivel === 'nada') {
    if (c.verificar.skills) return validar(c.verificar).length ? (hook ? 2 : 1) : 0;
    console.log('\nNada a testar (só arquivos sem teste).');
    return 0;
  }
  // Já testado? Uma rodada aprovada sobre ESTE estado (fingerprint) que cobre o que este nível pede.
  if (comando === 'auto') {
    const ja = aprovadaQueCobre(nivel === 'full' ? 'todos' : testes);
    if (ja) {
      console.log(`\n✔ Já aprovado: a rodada ${ja.nivel.toUpperCase()} de ${ja.quando} (fingerprint ${ja.fingerprint.slice(0, 12)}) cobriu estes testes sobre exatamente este conteúdo — nada a rodar de novo.${aviso(c)}`);
      return 0;
    }
    if (nivel === 'full') console.log(`\nFULL OBRIGATÓRIA:\n${c.motivos.map((m) => `  - ${m}`).join('\n')}\nRodando a suíte completa…`);
  }
  const ok = await executar(nivel, testes, nivel === 'full' && comando === 'full' ? null : c.verificar, amb);
  if (ok && comando !== 'full') console.log(aviso(c));
  return ok ? 0 : hook ? 2 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).then((codigo) => process.exit(codigo), (e) => {
    console.error(e?.stack ?? e);
    process.exit(2);
  });
}
