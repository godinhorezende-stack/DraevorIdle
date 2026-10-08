// O AMBIENTE onde os testes vão rodar, a SEGURANÇA (nada de produção nos testes) e o PARALELISMO (`testar.mjs`).
//
//   LOCAL / CI / STAGING   a FULL roda (manual ou pelo hook); o paralelismo se adapta à CPU ociosa e à memória disponível.
//   PRODUCTION_HOST        a máquina HOSPEDA o servidor do jogo (sinais REAIS: contêiner do jogo, processo do game-server, portas 80/443,
//                          diretório de deploy, configuração e nginx de produção). A FULL é RECUSADA — manual e automática; nem `nice`
//                          nem variável de ambiente (`NODE_ENV`, `DRAEVOR_AMBIENTE=local`) liberam: a FULL disputa CPU, memória, I/O e
//                          cache com o jogo. QUICK e SYSTEM rodam leves (metade dos núcleos, prioridade baixa) — o pre-commit fica rápido.
//   PRODUCTION             DENTRO da instalação de produção (o checkout de produção, o contêiner com banco de produção, NODE_ENV=production):
//                          nenhum teste roda.
//
// As variáveis de ambiente só servem para PEDIR um ambiente mais restrito (ou dizer CI/staging numa máquina sem sinal de jogo); nunca
// para liberar a FULL onde há sinal do servidor do jogo.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';

/** Onde fica a instalação de produção nesta família de máquinas (a VPS: /srv/draevor/app, com config, dados e backups ao lado). */
const CAMINHOS_DE_PRODUCAO = ['/srv/draevor'];
/** O domínio de produção (procurado na configuração do nginx desta máquina). */
const DOMINIOS_DE_PRODUCAO = ['mmoidledraevor.io'];
const MB = 1024 * 1024;
const POR_WORKER = 400 * MB; // medido (08/10): de 2 para 6 processos de teste, +1,2 GB → ~290 MB cada; 400 com folga
const RESERVA = 1536 * MB;

const sim = (v) => /^(1|true|sim|yes)$/i.test(String(v ?? ''));
const nao = (v) => /^(0|false|nao|não|no)$/i.test(String(v ?? ''));
const rodar = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 3000 });
  return r.status === 0 ? r.stdout : '';
};

function memoria() {
  // `MemAvailable` (o que dá para usar sem tirar de ninguém) é melhor que `freemem` (que não conta o cache que o kernel devolve).
  try {
    const m = readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+) kB/m);
    if (m) return { livre: Number(m[1]) * 1024, total: os.totalmem() };
  } catch {}
  return { livre: os.freemem(), total: os.totalmem() };
}

/** As portas TCP em escuta nesta máquina (lidas do /proc, sem depender de `ss`). */
function portasEmEscuta() {
  const portas = new Set();
  for (const f of ['/proc/net/tcp', '/proc/net/tcp6']) {
    try {
      for (const l of readFileSync(f, 'utf8').split('\n').slice(1)) {
        const c = l.trim().split(/\s+/);
        if (c[3] === '0A') portas.add(parseInt(c[1].split(':').pop(), 16)); // 0A = LISTEN
      }
    } catch {}
  }
  return portas;
}

/** Os processos que interessam (o game-server, nginx, Postgres, Redis, Docker do jogo), sem o próprio runner. */
export function processosRelevantes() {
  return rodar('ps', ['-eo', 'pid,user,args'])
    .split('\n')
    .slice(1)
    .filter((l) => /backend\/index\.mjs|nginx: master|postgres(:| -c)|redis-server|containerd-shim|docker-proxy/.test(l) && !/node --test|testar\.mjs|tools\/testes/.test(l))
    .map((l) => l.trim().replace(/\s+/g, ' ').slice(0, 110));
}

/**
 * Os SINAIS de que esta máquina hospeda o servidor do jogo. Cada um é uma evidência; um forte basta para PRODUCTION_HOST.
 * `{ fortes: [..], fracos: [..] }`.
 */
export function sinaisDoServidorDoJogo() {
  const fortes = [];
  const fracos = [];
  if (sim(process.env.DRAEVOR_SERVIDOR_DO_JOGO)) fortes.push('DRAEVOR_SERVIDOR_DO_JOGO=1');
  // Contêineres do jogo (Docker).
  const conteineres = rodar('docker', ['ps', '--format', '{{.Names}}']).split('\n').filter((n) => /draevor/i.test(n));
  if (conteineres.length) fortes.push(`contêineres do jogo rodando: ${conteineres.join(', ')}`);
  // Diretório de deploy e configuração de produção (só a existência — o conteúdo do .env tem senha e não é lido).
  for (const p of CAMINHOS_DE_PRODUCAO) {
    if (existsSync(`${p}/app/game/backend/index.mjs`)) fortes.push(`diretório de deploy: ${p}/app`);
    if (existsSync(`${p}/config/.env`)) fortes.push(`configuração de produção: ${p}/config/.env (existe; não lido)`);
  }
  // nginx desta máquina servindo o domínio de produção.
  for (const pasta of ['/etc/nginx/sites-enabled', '/etc/nginx/conf.d', ...CAMINHOS_DE_PRODUCAO.map((p) => `${p}/config/nginx`)]) {
    try {
      for (const f of readdirSync(pasta)) {
        const texto = readFileSync(`${pasta}/${f}`, 'utf8');
        const dominio = DOMINIOS_DE_PRODUCAO.find((d) => texto.includes(d));
        if (dominio) fortes.push(`nginx com o domínio de produção (${dominio}): ${pasta}/${f}`);
      }
    } catch {}
  }
  // Portas públicas de servidor web em escuta.
  const portas = portasEmEscuta();
  const web = [80, 443].filter((p) => portas.has(p));
  if (web.length) (fortes.length ? fortes : fracos).push(`portas de servidor em escuta: ${web.join(', ')}`);
  // Processos do game-server (sozinhos são fracos: a máquina de desenvolvimento também sobe o servidor local).
  const jogo = processosRelevantes().filter((l) => /backend\/index\.mjs/.test(l));
  if (jogo.length) fracos.push(`${jogo.length} processo(s) do game-server (node backend/index.mjs)`);
  return { fortes, fracos };
}

/** O ambiente: `{ nome, motivo, sinais, cpus, carga, memoria }`. */
export function detectarAmbiente(raizDoRepo) {
  const cpus = os.availableParallelism?.() ?? os.cpus().length;
  const base = { cpus, carga: os.loadavg()[0], memoria: memoria() };
  // 1) DENTRO da instalação de produção: nada roda.
  const caminho = CAMINHOS_DE_PRODUCAO.find((p) => raizDoRepo === p || raizDoRepo.startsWith(`${p}/`));
  if (caminho) return { ...base, nome: 'PRODUCTION', motivo: `o checkout de produção (${raizDoRepo})`, sinais: { fortes: [], fracos: [] } };
  if (process.env.NODE_ENV === 'production') return { ...base, nome: 'PRODUCTION', motivo: 'NODE_ENV=production', sinais: { fortes: [], fracos: [] } };
  if (existsSync('/.dockerenv') && process.env.DATABASE_URL) return { ...base, nome: 'PRODUCTION', motivo: 'contêiner com DATABASE_URL', sinais: { fortes: [], fracos: [] } };
  const pedido = String(process.env.DRAEVOR_AMBIENTE ?? '').trim().toLowerCase();
  if (['producao', 'produção', 'production', 'prod'].includes(pedido)) return { ...base, nome: 'PRODUCTION', motivo: `DRAEVOR_AMBIENTE=${pedido}`, sinais: { fortes: [], fracos: [] } };
  // 2) A máquina hospeda o jogo? Os SINAIS mandam — nenhuma variável de ambiente desliga isto.
  const sinais = sinaisDoServidorDoJogo();
  if (sinais.fortes.length) return { ...base, nome: 'PRODUCTION_HOST', motivo: 'esta máquina hospeda o servidor do jogo', sinais };
  // 3) Sem sinal de jogo: o que o ambiente diz.
  const nomes = { local: 'LOCAL', dev: 'LOCAL', desenvolvimento: 'LOCAL', ci: 'CI', staging: 'STAGING', homologacao: 'STAGING' };
  if (nomes[pedido]) return { ...base, nome: nomes[pedido], motivo: `DRAEVOR_AMBIENTE=${pedido}`, sinais };
  const ci = ['CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'BUILDKITE', 'JENKINS_URL', 'TEAMCITY_VERSION'].find((v) => process.env[v] && !nao(process.env[v]));
  if (ci) return { ...base, nome: 'CI', motivo: ci, sinais };
  return { ...base, nome: 'LOCAL', motivo: 'sem sinal de servidor do jogo, de CI, de staging ou de produção', sinais };
}

export const MENSAGEM_FULL_BLOQUEADA = 'FULL SUITE BLOQUEADA: esta máquina hospeda o servidor do jogo. Execute a FULL em ambiente dedicado/local/CI/staging.';

// ------------------------------------------------------------------------------------------------- o ambiente dos testes, sem produção

/** Variável que é (ou pode ser) URL ou credencial de produção: sai do ambiente dos testes. As de teste (`*_TESTE`) ficam. */
const PERIGOSA = (nome) =>
  !/_TESTE$/.test(nome) &&
  (/^(DATABASE_URL|REDIS_URL|POSTGRES_|PG(HOST|PORT|USER|PASSWORD|DATABASE|SERVICE|PASSFILE)$)/.test(nome) || /(PASS(WORD)?|SENHA|SECRET|TOKEN|PRIVATE|API_?KEY|CREDENTIAL)/i.test(nome));

/**
 * O ambiente dos processos de teste, SEM nada de produção: `DATABASE_URL` e `REDIS_URL` (com elas o jogo abriria o Postgres e o Redis
 * delas), as `PG*` e qualquer variável de senha, token ou chave. Postgres e Redis de teste só pelas variáveis próprias, que o `db.test` e o
 * `redis.test` leem sozinhos (`DATABASE_URL_TESTE`, `REDIS_URL_TESTE`).
 */
export function ambienteDosTestes(extra = {}) {
  const env = { ...process.env, ...extra };
  for (const nome of Object.keys(env)) if (PERIGOSA(nome)) delete env[nome];
  return env;
}

/** A URL mascarada: só o esquema e a porta (`postgres://***:***@***:5432/***`). */
export function mascarar(url) {
  if (!url) return '(ausente)';
  const m = String(url).match(/^([a-z][a-z0-9+.-]*):\/\/(?:[^@/]*@)?[^:/?#]*(?::(\d+))?/i);
  return m ? `${m[1]}://***:***@***${m[2] ? `:${m[2]}` : ''}/***` : '*** (definida)';
}

/**
 * A SEGURANÇA antes de rodar: o que foi removido, se sobrou URL de produção no ambiente dos testes e se o Postgres/Redis de teste não é o
 * mesmo do jogo. `{ ok, linhas, problemas }`.
 */
export function verificarSeguranca() {
  const linhas = [];
  const problemas = [];
  linhas.push(`DATABASE_URL: ${mascarar(process.env.DATABASE_URL)} → ${process.env.DATABASE_URL ? 'REMOVIDA do ambiente dos testes' : 'não herdada'}`);
  linhas.push(`REDIS_URL:    ${mascarar(process.env.REDIS_URL)} → ${process.env.REDIS_URL ? 'REMOVIDA do ambiente dos testes' : 'não herdada'}`);
  const removidas = Object.keys(process.env).filter(PERIGOSA);
  linhas.push(`Variáveis de URL/credencial removidas dos testes: ${removidas.length ? removidas.join(', ') : 'nenhuma presente'}`);
  // Sobrou alguma URL com credencial ou apontando para o domínio de produção?
  const env = ambienteDosTestes();
  for (const [nome, valor] of Object.entries(env)) {
    const v = String(valor);
    if (/^[a-z][a-z0-9+.-]*:\/\/[^/\s]*:[^/\s]*@/i.test(v) && !/_TESTE$/.test(nome)) problemas.push(`${nome} tem URL com credencial (${mascarar(v)})`);
    if (DOMINIOS_DE_PRODUCAO.some((d) => v.includes(d))) problemas.push(`${nome} aponta para o domínio de produção`);
  }
  // O Postgres/Redis de teste não pode ser o do jogo.
  for (const [teste, prod] of [['DATABASE_URL_TESTE', 'DATABASE_URL'], ['REDIS_URL_TESTE', 'REDIS_URL']]) {
    if (!process.env[teste]) continue;
    if (process.env[prod] && process.env[teste] === process.env[prod]) problemas.push(`${teste} é igual à ${prod} (o banco do jogo)`);
    linhas.push(`${teste}: ${mascarar(process.env[teste])} (só o ${teste === 'DATABASE_URL_TESTE' ? 'db.test' : 'redis.test'} usa; tabela/chaves fixas — não rode duas FULL contra o mesmo)`);
  }
  linhas.push(`URLs de produção no ambiente dos testes: ${problemas.length ? 'ENCONTRADAS' : 'nenhuma'}`);
  linhas.push('Isolamento: SQLite de desenvolvimento local (game/database/dados, WAL + busy_timeout), servidores dos testes em porta efêmera (listen(0)), WebSocket sem rede (sessão com socket falso), overrides e git em pasta temporária; uma rodada por vez (trava).');
  return { ok: !problemas.length, linhas, problemas };
}

/** A FULL pode rodar aqui? `{ ok, motivo }` — nunca no host do jogo nem em produção, nem com URL de produção sobrando. */
export function fullPermitida(amb, seguranca = verificarSeguranca()) {
  if (amb.nome === 'PRODUCTION') return { ok: false, motivo: `ambiente de produção (${amb.motivo}) — nenhum teste roda aqui` };
  if (amb.nome === 'PRODUCTION_HOST') return { ok: false, motivo: MENSAGEM_FULL_BLOQUEADA };
  if (!seguranca.ok) return { ok: false, motivo: `isolamento inseguro: ${seguranca.problemas.join('; ')}` };
  return { ok: true, motivo: '' };
}

// ------------------------------------------------------------------------------------------------- o paralelismo

/** Quantos processos de teste ao mesmo tempo, e por quê. `{ workers, prioridade, motivo }`. */
export function planejarParalelismo(amb, quantosArquivos) {
  const ociosos = Math.max(1, Math.floor(amb.cpus - amb.carga + 0.5));
  const porMemoria = Math.max(1, Math.floor((amb.memoria.livre - RESERVA) / POR_WORKER));
  let teto;
  let regra;
  if (amb.nome === 'PRODUCTION_HOST') {
    teto = Math.max(1, Math.floor(amb.cpus / 2));
    regra = 'host do jogo: só QUICK/SYSTEM, metade dos núcleos, prioridade baixa';
  } else if (amb.nome === 'CI' || amb.nome === 'STAGING') {
    teto = amb.cpus;
    regra = `${amb.nome}: todos os núcleos`;
  } else {
    teto = Math.max(1, amb.cpus - 1);
    regra = 'LOCAL: um núcleo livre para quem está trabalhando';
  }
  const workers = Math.max(1, Math.min(teto, ociosos, porMemoria, Math.max(1, quantosArquivos)));
  return { workers, prioridade: amb.nome === 'PRODUCTION_HOST' ? 10 : 0, motivo: [`teto ${teto} (${regra})`, `${ociosos} núcleo(s) ocioso(s) agora`, `${porMemoria} pela memória`, `${quantosArquivos} arquivo(s)`].join(' · ') };
}

const gb = (b) => `${(b / 1024 ** 3).toFixed(1)} GB`;
/** As linhas do relatório: Parallelism / CPU / Memory / Environment. */
export function linhasDoAmbiente(amb, plano) {
  return [
    `Parallelism: ${plano.workers} worker(s) — ${plano.motivo}${plano.prioridade ? ` · prioridade baixa (nice ${plano.prioridade})` : ''}`,
    `CPU:         ${amb.cpus} núcleo(s), carga média ${amb.carga.toFixed(2)} (1 min)`,
    `Memory:      ${gb(amb.memoria.livre)} disponíveis de ${gb(amb.memoria.total)}`,
    `Environment: ${amb.nome} (${amb.motivo})`,
  ].join('\n');
}

/** O relatório da verificação de segurança (o `testar.mjs ambiente` e o começo de toda FULL). */
export function relatorioDeSeguranca(amb, seguranca = verificarSeguranca()) {
  const s = [`Environment: ${amb.nome} — ${amb.motivo}`];
  if (amb.sinais?.fortes?.length || amb.sinais?.fracos?.length) {
    s.push('Sinais do servidor do jogo nesta máquina:', ...amb.sinais.fortes.map((x) => `  [forte] ${x}`), ...amb.sinais.fracos.map((x) => `  [fraco] ${x}`));
  } else s.push('Sinais do servidor do jogo nesta máquina: nenhum');
  const procs = processosRelevantes();
  s.push(`Processos relevantes (${procs.length}):`, ...(procs.length ? procs.slice(0, 15).map((p) => `  ${p}`) : ['  nenhum']));
  s.push(...seguranca.linhas);
  const full = fullPermitida(amb, seguranca);
  s.push(`FULL aqui: ${full.ok ? 'PERMITIDA' : `RECUSADA — ${full.motivo}`}`);
  return s.join('\n');
}
