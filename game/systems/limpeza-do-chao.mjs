// A LIMPEZA AUTOMÁTICA DO CHÃO: a cada `intervalMinutes` (60) o mundo é limpo, com aviso global
// `warningSeconds` (60 s) antes. Um coordenador só, do PROCESSO — não é timer de sessão.
//
// O que é "o chão" aqui: o único chão que existe no jogo é o da praça (`CHAO` em `inventario.mjs`,
// memória do processo, compartilhado por quem está lá). Hunts, aventuras e instâncias não têm itens
// no chão: o drop vai direto para a mochila (ou "Ficou no chão" no relatório, que é só texto, sem
// objeto). Por isso `varrer` percorre as fontes registradas em `FONTES`, e hoje há uma. Fonte nova
// de chão (um dia) entra numa linha ali.
//
// Vários processos: o chão mora na memória de CADA processo, e cada um avisa as sessões que tem.
// Então cada processo roda o seu coordenador e limpa o seu chão: não há chão compartilhado para
// disputar. (Hoje é um processo só.)
//
// Ciclo: espera (intervalo − aviso) → aviso → espera `aviso` → limpeza em lotes → próximo ciclo
// contado da CONCLUSÃO da limpeza. Os lotes cedem o laço (`setImmediate`) entre si para o tique do
// jogo não esperar.
import { groundCleanupConfig, validarConfig, MENSAGEM_DO_AVISO } from './limpeza-do-chao-config.mjs';
import * as Inventario from './inventario.mjs';
import { ligar, avisoGlobal } from './avisos-globais.mjs';

const TAG = '[GROUND-CLEANUP]';

/** As fontes de itens no chão: `foto()` lista o que há, `limpar(lote)` apaga e devolve `{ pecas }`. */
const FONTES = [
  { nome: 'praça', foto: () => Inventario.fotoDoChao(), limpar: (lote) => Inventario.limparPilhasDoChao(lote) },
];

const relogioReal = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (t) => clearTimeout(t), agora: () => Date.now(), cederLaco: () => new Promise((r) => setImmediate(r)) };

export { ligar, avisoGlobal };

let estado = null; // { config, relogio, log, timer, fase, proximaEm, ciclo, avisouNoCiclo, limpando, execucoes }

const log = (msg) => (estado?.log ?? console.log)(`${TAG} ${msg}`);

/** Varre todas as fontes em lotes de `batchSize`. Devolve `{ encontrados, removidos, ms }`. */
export async function varrer({ batchSize = groundCleanupConfig.batchSize, cederLaco = relogioReal.cederLaco, fontes = FONTES } = {}) {
  const t0 = performance.now();
  let encontrados = 0;
  let removidos = 0;
  for (const fonte of fontes) {
    const foto = fonte.foto();
    encontrados += foto.reduce((s, [, pilha]) => s + pilha.length, 0);
    for (let i = 0; i < foto.length; i += batchSize) {
      removidos += fonte.limpar(foto.slice(i, i + batchSize)).pecas;
      if (i + batchSize < foto.length) await cederLaco();
    }
  }
  return { encontrados, removidos, ms: Math.round(performance.now() - t0) };
}

function agendar(ms, fn) {
  const e = estado;
  if (e.timer) e.relogio.clearTimeout(e.timer); // nunca dois timers vivos
  e.proximaEm = e.relogio.agora() + ms;
  e.timer = e.relogio.setTimeout(() => {
    e.timer = null;
    Promise.resolve().then(fn).catch((erro) => {
      log(`ERRO: ${erro?.stack ?? erro}`);
      if (estado === e) agendarCiclo(); // um erro não para o servidor nem o relógio
    });
  }, ms);
  e.timer?.unref?.();
}

function agendarCiclo() {
  const { intervalMinutes, warningSeconds } = estado.config;
  const ateOAviso = Math.max(0, intervalMinutes * 60_000 - warningSeconds * 1000);
  estado.fase = 'esperando';
  estado.avisouNoCiclo = false;
  estado.ciclo++;
  log(`Próxima limpeza em ${intervalMinutes} minutos`);
  agendar(ateOAviso, avisar);
}

function avisar() {
  const e = estado;
  if (!e.avisouNoCiclo) {
    e.avisouNoCiclo = true; // uma vez por ciclo
    const n = avisoGlobal(MENSAGEM_DO_AVISO);
    log(`Aviso global enviado (${n} jogadores online)`);
  }
  e.fase = 'avisado';
  agendar(e.config.warningSeconds * 1000, limpar);
}

async function limpar() {
  const e = estado;
  if (e.limpando) return; // nunca duas limpezas ao mesmo tempo
  e.limpando = true;
  e.fase = 'limpando';
  log('Limpeza iniciada');
  try {
    const r = await varrer({ batchSize: e.config.batchSize, cederLaco: e.relogio.cederLaco });
    log(`${r.encontrados} itens encontrados, ${r.removidos} itens removidos`);
    log(`Limpeza concluída em ${r.ms}ms`);
    e.execucoes.push({ em: e.relogio.agora(), ...r });
    if (e.execucoes.length > 50) e.execucoes.shift();
  } catch (erro) {
    log(`ERRO na limpeza: ${erro?.stack ?? erro}`);
  } finally {
    e.limpando = false;
    if (estado === e) agendarCiclo();
  }
}

/** Liga o coordenador (idempotente: chamar de novo com ele ligado não cria outro timer). */
export function iniciar({ config = null, relogio = relogioReal, logger = console.log } = {}) {
  if (estado) return { ok: true, jaIniciado: true };
  const { config: valida, erros } = validarConfig(config ?? {});
  for (const erro of erros) logger(`${TAG} Config: ${erro}`);
  if (!valida.enabled) {
    logger(`${TAG} Sistema desativado (enabled: false)`);
    return { ok: true, desativado: true };
  }
  estado = { config: valida, relogio: { ...relogioReal, ...relogio }, log: logger, timer: null, fase: 'esperando', proximaEm: null, ciclo: 0, avisouNoCiclo: false, limpando: false, execucoes: [] };
  logger(`${TAG} Sistema iniciado (intervalo ${valida.intervalMinutes} min, aviso ${valida.warningSeconds} s, lote ${valida.batchSize})`);
  agendarCiclo();
  return { ok: true };
}

/** Desliga (cancela o timer; uma limpeza em andamento termina o lote e não reagenda). Pode religar com `iniciar`. */
export function parar() {
  if (!estado) return;
  const e = estado;
  if (e.timer) e.relogio.clearTimeout(e.timer);
  e.timer = null;
  log('Sistema parado');
  estado = null;
}

/** Foto do estado para o log/diagnóstico e os testes. */
export const situacao = () => (estado ? { fase: estado.fase, proximaEm: estado.proximaEm, ciclo: estado.ciclo, limpando: estado.limpando, execucoes: [...estado.execucoes], config: { ...estado.config }, timerAtivo: !!estado.timer } : null);
