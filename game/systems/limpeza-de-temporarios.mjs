// A LIMPEZA DE ARQUIVOS TEMPORÁRIOS do Server Save — só o que é comprovadamente descartável.
//
// ---- Auditoria (docs/server-save.md, seção 5): o que o servidor realmente grava em disco ----
// O processo do jogo quase não escreve arquivo: sessões, estado, offline farm, créditos e recompensas moram no
// banco (Postgres em produção); o áudio do chat fica em memória com validade (`chat.mjs`); logs vão para
// stdout e o Docker já rotaciona (`json-file`, 10 MB × 5); o cache é Redis/memória; não há upload em disco. As
// únicas escritas são o editor de conteúdo (JSON do jogo — NÃO é temporário), o SQLite de desenvolvimento
// (`game/database/dados`, com `-wal/-shm` em uso — NUNCA tocar) e, fora do container, o backup (`.parcial`
// de um `pg_dump` interrompido) e os logs de cron. Em produção, portanto, hoje sobra pouca coisa para apagar:
// esta rotina existe para o que ACUMULAR (temporários de operações interrompidas), sem risco para o resto.
//
// ---- Como é seguro ----
//  - Lista EXPLÍCITA de áreas (diretório absoluto + padrão de nome + idade mínima). Nada fora dela é visto.
//  - Sem recursão: só os arquivos regulares DIRETOS da área (nada de diretório, link simbólico, nem `rm -r`).
//  - O nome tem de casar o padrão da área E não pode casar a lista de NUNCA (banco, config, código, backup
//    válido `*.sql.gz`, cópias manuais `ANTES-*`, `mapas-antes-*`...). O caminho final é conferido contra o
//    diretório real da área (`realpath`): `..`, separadores e links não escapam.
//  - Idade mínima por mtime, e arquivo aberto por algum processo (`/proc/*/fd`) é pulado.
//  - Adiada por inteiro quando o Server Save achou pendência (gravação com erro, JSON ilegível, anomalia no offline farm).
//  - Simulação (`dryRun`) só lista. Todo arquivo apagado e todo erro vai para o log; erro num arquivo não para os outros.
import { readdir, lstat, realpath, unlink } from 'node:fs/promises';
import { readdirSync, readlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename, isAbsolute, resolve, sep } from 'node:path';

const HORA = 3_600_000;
const DIA = 24 * HORA;

/** Nomes que NUNCA são apagados, mesmo que uma área os case por engano. */
export const NUNCA = Object.freeze([
  /\.(db|db-wal|db-shm|db-journal|sqlite)$/i, // banco (SQLite dev: journal/wal em uso)
  /\.(env|conf|yml|yaml|pem|key|crt)$/i, // configuração e segredos
  /\.(mjs|js|json|sh)$/i, // código e dados do jogo
  /\.sql\.gz$/i, // backup (os válidos seguem a retenção do script de backup, não esta rotina)
  /\.tar\.gz$/i,
  /^ANTES-/, // cópias de segurança manuais
  /^mapas-antes-/,
]);

export const PADROES = Object.freeze({
  temporarioDoJogo: /^draevor-[\w.-]+\.tmp$/,
  backupParcial: /^jogo-\d{8}-\d{6}\.sql\.gz\.parcial$/,
  logRotacionado: /^[\w.-]+\.log\.(\d+|\d{4}-\d{2}-\d{2})(\.gz)?$|^[\w.-]+-\d{4}-\d{2}-\d{2}\.log(\.gz)?$/,
});

/** Config padrão. Áreas extras entram por variável de ambiente (diretório do host montado no container, ou a CLI no host). */
export function configPadrao(env = process.env) {
  const areas = [{ nome: 'temporarios-do-jogo', dir: tmpdir(), padrao: PADROES.temporarioDoJogo, idadeMinimaMs: DIA }];
  if (env.SERVER_SAVE_BACKUPS_DIR) areas.push({ nome: 'backups-parciais', dir: env.SERVER_SAVE_BACKUPS_DIR, padrao: PADROES.backupParcial, idadeMinimaMs: 6 * HORA });
  const logsDias = Number(env.SERVER_SAVE_LOGS_RETENCAO_DIAS);
  if (env.SERVER_SAVE_LOGS_DIR) areas.push({ nome: 'logs-rotacionados', dir: env.SERVER_SAVE_LOGS_DIR, padrao: PADROES.logRotacionado, idadeMinimaMs: (Number.isFinite(logsDias) && logsDias >= 1 ? logsDias : 14) * DIA });
  return {
    enabled: !/^(0|false|off)$/i.test(String(env.TEMP_CLEANUP_ENABLED ?? 'true')),
    dryRun: /^(1|true|on)$/i.test(String(env.TEMP_CLEANUP_DRY_RUN ?? 'false')),
    maxArquivosPorExecucao: 5000,
    areas,
  };
}

const RAIZES_PROIBIDAS = new Set(['/', '/bin', '/boot', '/dev', '/etc', '/home', '/lib', '/proc', '/root', '/run', '/sbin', '/sys', '/usr', '/var', '/srv', '/opt', '/app']);

/** Valida a área; devolve o motivo da rejeição ou `null`. */
export function motivoDeRejeicao(area) {
  if (!area || typeof area.nome !== 'string' || !(area.padrao instanceof RegExp)) return 'área malformada';
  if (typeof area.dir !== 'string' || !isAbsolute(area.dir)) return 'o diretório precisa ser absoluto';
  if (area.dir.includes('\0')) return 'diretório inválido';
  const norm = resolve(area.dir);
  if (RAIZES_PROIBIDAS.has(norm)) return `diretório amplo demais (${norm})`;
  if (!(area.idadeMinimaMs >= HORA)) return 'a idade mínima precisa ser de pelo menos 1 hora';
  return null;
}

/** Os caminhos de arquivo abertos por processos que este contêiner enxerga (melhor esforço; vazio onde não há /proc). */
function arquivosAbertos() {
  const abertos = new Set();
  let pids;
  try {
    pids = readdirSync('/proc').filter((n) => /^\d+$/.test(n));
  } catch {
    return abertos;
  }
  for (const pid of pids) {
    let fds;
    try {
      fds = readdirSync(`/proc/${pid}/fd`);
    } catch {
      continue;
    }
    for (const fd of fds) {
      try {
        abertos.add(readlinkSync(`/proc/${pid}/fd/${fd}`));
      } catch {
        // o descritor fechou no meio: ignora
      }
    }
  }
  return abertos;
}

/**
 * Executa a limpeza. `adiar` (string) pula tudo e devolve o motivo. Devolve
 * `{ adiada?, dryRun, removidos[], candidatos, bytes, rejeitadas[], erros[], puladosEmUso, puladosRecentes }`.
 */
export async function executar({ config = configPadrao(), agora = Date.now(), adiar = null, log = () => {}, emUso = arquivosAbertos } = {}) {
  const r = { dryRun: !!config.dryRun, removidos: [], candidatos: 0, bytes: 0, rejeitadas: [], erros: [], puladosEmUso: 0, puladosRecentes: 0 };
  if (!config.enabled) return { ...r, desativada: true };
  if (adiar) {
    log(`Limpeza de temporários adiada: ${adiar}`);
    return { ...r, adiada: adiar };
  }
  let abertos = null;
  for (const area of config.areas ?? []) {
    const motivo = motivoDeRejeicao(area);
    if (motivo) {
      r.rejeitadas.push({ area: area?.nome ?? '?', motivo });
      log(`Área rejeitada (${area?.nome ?? '?'}): ${motivo}`);
      continue;
    }
    let raiz;
    let nomes;
    try {
      raiz = await realpath(area.dir);
      nomes = await readdir(raiz);
    } catch (e) {
      if (e.code !== 'ENOENT') r.erros.push({ area: area.nome, erro: e.message });
      continue; // a pasta não existe neste ambiente: nada a limpar
    }
    for (const nome of nomes) {
      if (r.removidos.length >= (config.maxArquivosPorExecucao ?? 5000)) break;
      if (nome !== basename(nome) || !area.padrao.test(nome) || NUNCA.some((n) => n.test(nome))) continue;
      const caminho = join(raiz, nome);
      try {
        const st = await lstat(caminho);
        if (!st.isFile()) continue; // diretório, link simbólico, socket...
        if ((await realpath(caminho)) !== caminho || !caminho.startsWith(raiz + sep)) continue; // escapou da área
        if (agora - st.mtimeMs < area.idadeMinimaMs) {
          r.puladosRecentes++;
          continue;
        }
        r.candidatos++;
        abertos ??= emUso();
        if (abertos.has(caminho)) {
          r.puladosEmUso++;
          continue;
        }
        if (!config.dryRun) await unlink(caminho);
        r.removidos.push({ area: area.nome, arquivo: caminho, bytes: st.size });
        r.bytes += st.size;
        log(`${config.dryRun ? '[simulação] removeria' : 'Removido'}: ${caminho} (${st.size} bytes)`);
      } catch (e) {
        if (e.code === 'ENOENT') continue; // outro processo já apagou
        r.erros.push({ area: area.nome, arquivo: caminho, erro: `${e.code ?? ''} ${e.message}`.trim() });
        log(`ERRO em ${caminho}: ${e.message}`);
      }
    }
  }
  return r;
}
