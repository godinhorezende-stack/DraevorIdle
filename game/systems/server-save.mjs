// O SERVER SAVE diário: salva, confere e faz manutenção leve — SEM parar o jogo e SEM encostar no offline farm.
//
// ---- O que é o offline farm no código (auditoria, `docs/server-save.md`) ----
// A caçada offline NÃO é uma simulação contínua na memória: o estado dela (`hunt`, com `offlineDesde`/`ausencia`) mora
// no JSON do personagem no banco, e as colunas-índice `caca_offline_desde/ate` o espelham. Ela é CALCULADA a partir dele:
// em pedaços, a cada 10 min, pela consolidação (`consolidacao-offline.mjs`, com `UPDATE ... WHERE estado = <lido>`:
// idempotente), e o resto no login (`Cacadas.simularAusencia`). Por isso o jeito de preservá-la é NÃO escrever nela.
//
// ---- O que o Server Save faz ----
//  1. grava os jogadores conectados DESTE processo (`gravarAgora`, a mesma gravação do autosave de 30 s: carimba
//     `offlineDesde` e portanto não interrompe a caçada, que segue offline se o servidor cair);
//  2. (só o processo que ganhou o ciclo) varre os ausentes em lotes, SOMENTE LENDO, e conserta uma coisa: coluna-índice
//     que não bate com o JSON (derivada dele, escrita condicionada ao estado lido). Anomalias (offlineDesde no
//     futuro, JSON ilegível) são relatadas, nunca "consertadas";
//  3. conta recompensas pendentes (só leitura) e faz a manutenção leve (checkpoint passivo do WAL no SQLite);
//  4. registra o ciclo, e SÓ DEPOIS de confirmado avisa "concluído".
//
// ---- O que NUNCA faz ----
// Cancelar/reiniciar/encurtar caçada, mexer em XP/loot/recompensas, limpar o chão, apagar personagem, resetar instância,
// apagar registros de recuperação. (Os testes conferem byte a byte que o JSON de um ausente não muda.)
//
// ---- Agenda e coordenação ----
// Horário de relógio (HH:MM no fuso, padrão 05:00 America/Sao_Paulo), não "24 h depois do boot". Reiniciar NÃO dispara
// save e NÃO recupera ciclo perdido: o próximo horário é calculado do agora. O ciclo é reivindicado por um INSERT único
// em `server_save_ciclos` (slot = o instante programado): com vários processos no mesmo banco, só um roda a parte do
// banco; todos gravam os próprios jogadores e avisam as próprias sessões.
import { randomUUID } from 'node:crypto';
import { banco } from '../database/banco.mjs';
import { colunasDaCacaOffline } from '../database/caca-offline.mjs';
import { validarConfig, MENSAGENS, mensagemDoAviso } from './server-save-config.mjs';
import { proximoSlot } from './server-save-horario.mjs';
import { avisoGlobal, ligar as ligarAvisos } from './avisos-globais.mjs';
import * as Temporarios from './limpeza-de-temporarios.mjs';

const TAG = '[SERVER-SAVE]';
const BIGINT = banco.dialeto === 'postgres' ? 'BIGINT' : 'INTEGER';
await banco.exec(`
  CREATE TABLE IF NOT EXISTS server_save_ciclos (
    slot ${BIGINT} PRIMARY KEY, estado TEXT NOT NULL, lider TEXT NOT NULL, iniciado_em ${BIGINT} NOT NULL, concluido_em ${BIGINT}, resultado TEXT
  );
`);

const processoId = `${process.pid}-${randomUUID().slice(0, 8)}`;
const relogioReal = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (t) => clearTimeout(t), agora: () => Date.now(), cederLaco: () => new Promise((r) => setImmediate(r)) };

let sessoes = new Map();
let estado = null; // { config, relogio, log, anunciar, timers, slot, rodando, ultimo }

export const ligar = (mapa) => {
  sessoes = mapa;
  ligarAvisos(mapa);
};

const log = (msg) => (estado?.log ?? console.log)(`${TAG} ${msg}`);

// ---------------------------------------------------------------------------- a rotina

const sqlOfflineNoJson = banco.dialeto === 'postgres' ? "(estado::jsonb #>> '{hunt,offlineDesde}') IS NOT NULL" : "json_extract(estado, '$.hunt.offlineDesde') IS NOT NULL";
const consultaDosAusentes = banco.prepare(`SELECT id, nome, estado, caca_offline_desde AS desde, caca_offline_ate AS ate FROM personagens WHERE id > ? AND (caca_offline_desde IS NOT NULL OR ${sqlOfflineNoJson}) ORDER BY id LIMIT ?`);
// Só as colunas-índice, e só se o estado ainda for o lido: nunca toca no JSON.
const corrigirColunas = banco.prepare('UPDATE personagens SET caca_offline_desde = ?, caca_offline_ate = ? WHERE id = ? AND estado = ?');

/** Passo 1: grava os conectados deste processo, em lotes. */
export async function gravarConectados({ batchSize = 100, cederLaco = relogioReal.cederLaco, mapa = sessoes } = {}) {
  const vivas = [...mapa.values()].filter((s) => s?.personagem && s.estado);
  let gravados = 0;
  let erros = 0;
  for (let i = 0; i < vivas.length; i += batchSize) {
    const r = await Promise.allSettled(vivas.slice(i, i + batchSize).map((s) => s.gravarAgora()));
    for (const x of r) {
      if (x.status === 'fulfilled') gravados++;
      else {
        erros++;
        log(`ERRO ao gravar um jogador: ${x.reason?.message ?? x.reason}`);
      }
    }
    if (i + batchSize < vivas.length) await cederLaco();
  }
  return { gravados, erros };
}

/** Passo 2: verifica os ausentes (leitura; conserta só coluna-índice derivada). */
export async function verificarOfflineFarm({ agora = Date.now(), batchSize = 100, cederLaco = relogioReal.cederLaco } = {}) {
  const r = { ausentes: 0, colunasCorrigidas: 0, anomalias: [], ilegiveis: 0 };
  let ultimoId = 0;
  for (;;) {
    const linhas = await consultaDosAusentes.all(ultimoId, batchSize);
    if (!linhas.length) break;
    for (const l of linhas) {
      ultimoId = l.id;
      let e;
      try {
        e = JSON.parse(l.estado);
      } catch {
        r.ilegiveis++;
        r.anomalias.push({ id: l.id, nome: l.nome, tipo: 'json-ilegivel' });
        continue;
      }
      if (e?.hunt?.offlineDesde > 0) {
        r.ausentes++;
        if (e.hunt.offlineDesde > agora + 5 * 60_000) r.anomalias.push({ id: l.id, nome: l.nome, tipo: 'offlineDesde-no-futuro', offlineDesde: e.hunt.offlineDesde });
      }
      const [desde, ate] = colunasDaCacaOffline(e);
      const bate = (a, b) => (a == null ? b == null : b != null && Number(a) === Number(b));
      if (!bate(l.desde, desde) || !bate(l.ate, ate)) {
        const ok = await corrigirColunas.run(desde, ate, l.id, l.estado);
        if (ok.changes) r.colunasCorrigidas++;
      }
    }
    await cederLaco();
  }
  return r;
}

/** Recompensas pendentes (só leitura): os créditos ainda não entregues. */
export async function contarPendentes() {
  try {
    return Number((await banco.prepare('SELECT COUNT(*) AS n FROM creditos').get())?.n ?? 0);
  } catch {
    return null; // a tabela não existe neste banco: nada a contar
  }
}

/** Manutenção leve: checkpoint passivo do WAL no SQLite (não bloqueia leitores nem escritores). */
export async function manutencaoLeve() {
  if (banco.dialeto !== 'sqlite') return { feita: false, motivo: 'postgres: o autovacuum cuida' };
  try {
    await banco.exec('PRAGMA wal_checkpoint(PASSIVE)');
    return { feita: true };
  } catch (e) {
    return { feita: false, motivo: e.message };
  }
}

async function reivindicar(slot, agora) {
  const r = await banco.prepare("INSERT INTO server_save_ciclos (slot, estado, lider, iniciado_em) VALUES (?, 'executando', ?, ?) ON CONFLICT (slot) DO NOTHING").run(slot, processoId, agora);
  return !!r.changes;
}
const registrar = (slot, estadoFinal, resultado, agora) => banco.prepare('UPDATE server_save_ciclos SET estado = ?, concluido_em = ?, resultado = ? WHERE slot = ?').run(estadoFinal, agora, JSON.stringify(resultado), slot);

/**
 * Executa UMA rotina. `slot` identifica o ciclo (o horário programado; manual usa o instante do pedido).
 * Devolve `{ ok, lider, ... }`; nunca lança (erro vira `ok:false` e a mensagem de falha).
 */
export async function executar({ slot, manual = false } = {}) {
  const e = estado;
  if (!e) return { ok: false, erro: 'Server Save não está ligado.' };
  if (e.rodando) return { ok: false, erro: 'Já existe um Server Save em andamento.' };
  slot ??= e.relogio.agora();
  if (e.ultimosSlots.has(slot)) return { ok: false, erro: 'Este ciclo já foi executado.' };
  e.rodando = true;
  e.ultimosSlots.add(slot);
  const t0 = performance.now();
  const lag = medirAtrasoDoLaco();
  try {
    log(`Rotina iniciada (${manual ? 'manual' : 'agendada'}, ciclo ${new Date(slot).toISOString()})`);
    e.anunciar(MENSAGENS.inicio);
    const agora = e.relogio.agora();
    const lider = await reivindicar(slot, agora);
    const r = { manual, lider, gravados: 0, errosDeGravacao: 0 };
    const g = await gravarConectados({ batchSize: e.config.batchSize, cederLaco: e.relogio.cederLaco });
    r.gravados = g.gravados;
    r.errosDeGravacao = g.erros;
    if (lider) {
      r.offline = await verificarOfflineFarm({ agora: e.relogio.agora(), batchSize: e.config.batchSize, cederLaco: e.relogio.cederLaco });
      r.recompensasPendentes = await contarPendentes();
      r.manutencao = await manutencaoLeve();
      for (const a of r.offline.anomalias.slice(0, 20)) log(`ANOMALIA ${a.tipo}: ${a.nome} (#${a.id})`);
    } else {
      log('Outro processo conduz a verificação do banco neste ciclo');
    }
    // Por último, depois da persistência e da verificação: arquivos temporários descartáveis. Pendência adia; erro aqui nunca falha o save.
    const pendencia = g.erros ? 'houve erro ao gravar jogadores' : r.offline?.ilegiveis ? 'há estado de personagem ilegível' : r.offline?.anomalias.length ? 'o offline farm tem anomalias a verificar' : null;
    try {
      r.temporarios = await Temporarios.executar({ config: e.configTemporarios, agora: e.relogio.agora(), adiar: pendencia, log });
    } catch (erro) {
      r.temporarios = { erro: erro.message };
      log(`ERRO na limpeza de temporários (o save segue): ${erro.message}`);
    }
    r.ms = Math.round(performance.now() - t0);
    r.atrasoMaximoDoLacoMs = Math.round(lag.parar());
    const ok = g.erros === 0;
    if (lider) await registrar(slot, ok ? 'concluido' : 'falhou', r, e.relogio.agora());
    e.ultimo = { slot, ok, ...r };
    if (!ok) throw Object.assign(new Error(`${g.erros} jogador(es) não foram gravados`), { resultado: r });
    log(`Concluído em ${r.ms}ms: ${r.gravados} jogadores gravados, ${r.offline?.ausentes ?? '-'} ausentes verificados, ${r.offline?.colunasCorrigidas ?? 0} colunas corrigidas, ${r.offline?.anomalias.length ?? 0} anomalias, laço parou no máximo ${r.atrasoMaximoDoLacoMs}ms; temporários: ${r.temporarios?.adiada ? 'adiada' : `${r.temporarios?.removidos?.length ?? 0} removidos`}`);
    e.anunciar(MENSAGENS.concluido); // só depois de confirmado
    return { ok: true, ...r };
  } catch (erro) {
    lag.parar();
    log(`ERRO: ${erro?.stack ?? erro}`);
    try {
      await registrar(slot, 'falhou', { erro: String(erro?.message ?? erro) }, e.relogio.agora());
    } catch {
      // o banco pode ser justamente a falha: o log já tem o motivo
    }
    e.anunciar(MENSAGENS.falha);
    return { ok: false, erro: String(erro?.message ?? erro) };
  } finally {
    e.rodando = false;
  }
}

/** Mede o maior atraso do laço de eventos enquanto a rotina roda (o "travou?" do jogo). */
function medirAtrasoDoLaco() {
  let maior = 0;
  let ultimo = performance.now();
  const id = setInterval(() => {
    const agora = performance.now();
    maior = Math.max(maior, agora - ultimo - 10);
    ultimo = agora;
  }, 10);
  id.unref();
  return { parar: () => (clearInterval(id), Math.max(0, maior)) };
}

// ---------------------------------------------------------------------------- a agenda

function agendar() {
  const e = estado;
  const agora = e.relogio.agora();
  let slot = proximoSlot(agora, e.config);
  if (e.config.intervalHours > 24 && e.ultimoSlotAgendado) {
    // Intervalo em dias (ex.: 48 h): conta a partir do último ciclo agendado, sempre no mesmo horário local.
    slot = proximoSlot(Math.max(agora, e.ultimoSlotAgendado + (e.config.intervalHours - 24) * 3_600_000), e.config);
  }
  e.slot = slot;
  e.ultimoSlotAgendado = slot;
  limparTimers();
  for (const min of e.config.warningsMinutes) {
    const quando = slot - min * 60_000;
    if (quando <= agora) continue; // aviso que já passou (subiu em cima da hora): não sai atrasado nem em dobro
    e.timers.push(e.relogio.setTimeout(() => avisar(min, slot), quando - agora));
  }
  e.timers.push(e.relogio.setTimeout(() => disparar(slot), Math.max(0, slot - agora)));
  for (const t of e.timers) t?.unref?.();
  log(`Próximo Server Save: ${new Date(slot).toISOString()} (${e.config.horaLocal} ${e.config.timezone})`);
}

function avisar(min, slot) {
  const e = estado;
  if (!e || e.slot !== slot) return;
  const chave = `${slot}:${min}`;
  if (e.avisados.has(chave)) return; // um aviso de cada, por ciclo
  e.avisados.add(chave);
  const n = e.anunciar(mensagemDoAviso(min));
  log(`Aviso de ${min} min enviado (${n} jogadores online)`);
}

function disparar(slot) {
  const e = estado;
  if (!e || e.slot !== slot) return;
  executar({ slot })
    .catch((erro) => log(`ERRO inesperado: ${erro?.stack ?? erro}`))
    .finally(() => {
      if (estado === e) agendar(); // o próximo horário é sempre calculado do relógio, nunca do fim da rotina
    });
}

function limparTimers() {
  for (const t of estado.timers) estado.relogio.clearTimeout(t);
  estado.timers = [];
}

/**
 * Liga o agendador (idempotente). Reiniciar o servidor NÃO executa save: só calcula o próximo horário.
 * Ciclos que ficaram "executando" de um processo que caiu são marcados como interrompidos no registro.
 */
export async function iniciar({ config = null, relogio = relogioReal, logger = console.log, anunciar = avisoGlobal, configTemporarios = Temporarios.configPadrao() } = {}) {
  if (estado) return { ok: true, jaIniciado: true };
  const { config: valida, erros } = validarConfig(config ?? {});
  for (const erro of erros) logger(`${TAG} Config: ${erro}`);
  if (!valida.enabled) {
    logger(`${TAG} Sistema desativado (enabled: false)`);
    return { ok: true, desativado: true };
  }
  estado = { configTemporarios, config: valida, relogio: { ...relogioReal, ...relogio }, log: logger, anunciar, timers: [], slot: null, rodando: false, ultimo: null, ultimosSlots: new Set(), avisados: new Set(), ultimoSlotAgendado: null };
  logger(`${TAG} Sistema iniciado (${valida.horaLocal} ${valida.timezone}, a cada ${valida.intervalHours} h, avisos ${valida.warningsMinutes.join('/')} min)`);
  try {
    const r = await banco.prepare("UPDATE server_save_ciclos SET estado = 'interrompido' WHERE estado = 'executando'").run();
    if (r.changes) logger(`${TAG} ${r.changes} ciclo(s) anterior(es) ficaram sem conclusão (processo caiu): registrados como interrompidos`);
    const ultimo = await banco.prepare("SELECT slot, concluido_em FROM server_save_ciclos WHERE estado = 'concluido' ORDER BY slot DESC LIMIT 1").get();
    if (ultimo) {
      estado.ultimoSlotAgendado = Number(ultimo.slot);
      logger(`${TAG} Último ciclo concluído: ${new Date(Number(ultimo.slot)).toISOString()}`);
    }
  } catch (e) {
    logger(`${TAG} ERRO ao ler o registro de ciclos (segue com a agenda): ${e.message}`);
  }
  agendar();
  return { ok: true };
}

export function parar() {
  if (!estado) return;
  limparTimers();
  log('Sistema parado');
  estado = null;
}

export const situacao = () => (estado ? { slot: estado.slot, rodando: estado.rodando, ultimo: estado.ultimo, config: { ...estado.config }, timersAtivos: estado.timers.length } : null);

/** Execução manual (admin): roda já, sem mexer na agenda. */
export function executarAgora() {
  let slot = estado?.relogio.agora();
  while (estado?.ultimosSlots.has(slot)) slot++; // dois pedidos no mesmo milissegundo são ciclos diferentes
  return executar({ slot, manual: true });
}

export const ultimosCiclos = (n = 10) => banco.prepare('SELECT slot, estado, lider, iniciado_em, concluido_em, resultado FROM server_save_ciclos ORDER BY slot DESC LIMIT ?').all(n);
