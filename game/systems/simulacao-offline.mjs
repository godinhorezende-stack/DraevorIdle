// A caçada offline simulada FORA da thread do jogo.
//
// Quem volta depois de horas caçando offline tem até 30 minutos de caçada
// simulados tique a tique (`Cacadas.simularAusencia`) — 7.200 tiques de uma
// vez. Na thread do jogo isso parava o servidor inteiro: medido, uma volta de
// 2 h deixava TODOS os outros jogadores 1,5–2,3 s sem resposta (ver
// docs/auditoria-performance.md, gargalo 1). Aqui a mesma função roda num
// `worker_thread`; a thread do jogo só espera a resposta.
//
// Poucas threads, reaproveitadas: cada uma carrega o jogo inteiro uma vez
// (`iniciarJogoDoPoe`). Com mais voltas que threads ao mesmo tempo, elas fazem
// fila — quem voltou espera um pouco mais pelo `welcome`, mas ninguém mais trava.
//
// ---- (04/11) As threads AQUECIDAS no boot, e uma sempre livre para o login ----
// O incidente de 04/11: cada thread custava ~500 MB (era a campanha do PoE com
// todos os mapas na memória — agora ~350 MB, ver `CampanhaPoe.iniciar`
// `mapasSobDemanda`, e a thread guarda só os últimos mapas que usou — ver
// `simulacao-offline-worker.mjs`) e ~10 s de carga fria, que caíam em cima do
// primeiro jogador a voltar de uma caçada offline (o "selecionar personagem"
// demorava). Agora o servidor aquece TODAS as threads logo depois de abrir a
// porta (`aquecer`, uma depois da outra): quem entra já encontra o jogo
// carregado. Se uma morrer, outra nasce e é aquecida de novo.
//
// Quantas: `SIMULADORES_OFFLINE`, ou min(2, nCPU − 1) — as 2 de antes na VPS.
// Com 2 ou mais, a consolidação (`consolidacao-offline.mjs`, a cada 10 min,
// até 40 personagens um atrás do outro — um pesado leva ~20 s) nunca ocupa
// todas: o login vai para uma thread sem consolidação e não espera na fila
// dela. Com 1 (`SIMULADORES_OFFLINE=1`, para economizar memória), o login que
// chegar no meio de uma consolidação espera aquele personagem terminar.
import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';

export const QUANTAS = Math.max(1, Number(process.env.SIMULADORES_OFFLINE) || Math.min(2, availableParallelism() - 1));
/** Quantas threads a consolidação pode ocupar ao mesmo tempo: com 2+, sempre sobra uma para o login. */
const PARA_CONSOLIDAR = Math.max(1, QUANTAS - 1);
/*
 * O teto do heap de cada thread (`SIMULADOR_HEAP_MB`, 0 = o do Node). Sem ele o V8 deixa o lixo das caçadas crescer muito antes de
 * coletar: medido (2 threads, 16 terrenos, 3 a 8 rodadas), o rss do pool subia sem parar (1.173 MB na 3ª rodada); com 320 MB ele para em
 * ~930. A thread vive com ~150–200 MB (o jogo + os últimos mapas — ver `simulacao-offline-worker.mjs`). Se uma estourar o teto, ela morre
 * (o login que estava nela simula na thread do jogo, como em qualquer falha — `sessao.mjs`) e outra nasce aquecida.
 */
const LIMITE_HEAP_MB = Math.max(0, Number(process.env.SIMULADOR_HEAP_MB ?? 320) || 0);

const threads = []; // { worker, pendentes: Map<id, {resolve, reject}>, aquecendo: id | null, consolidando: Set<id>, criadaEm }
let proximoId = 1;
// `aquecer()` foi chamado (o servidor): manter as `QUANTAS` threads vivas e aquecidas — se uma morrer, nasce outra. `encerrar()` desliga.
let manterAquecida = false;
// Quantas vezes seguidas a thread morreu logo depois de nascer (o atraso da próxima dobra — não fica num laço de criar e morrer).
let mortesSeguidas = 0;
let recriando = null;

function nova() {
  const t = { worker: new Worker(new URL('./simulacao-offline-worker.mjs', import.meta.url), LIMITE_HEAP_MB ? { resourceLimits: { maxOldGenerationSizeMb: LIMITE_HEAP_MB } } : {}), pendentes: new Map(), aquecendo: null, consolidando: new Set(), criadaEm: Date.now(), encerrando: false };
  const falharTudo = (erro) => {
    for (const p of t.pendentes.values()) p.reject(erro);
    t.pendentes.clear();
    t.consolidando.clear();
    const i = threads.indexOf(t);
    if (i >= 0) threads.splice(i, 1);
  };
  t.worker.on('message', (msg) => {
    const p = t.pendentes.get(msg.id);
    if (!p) return;
    t.pendentes.delete(msg.id);
    t.consolidando.delete(msg.id);
    if (t.aquecendo === msg.id) t.aquecendo = null;
    // (o aquecimento pendente não segura o processo aberto)
    if (!ocupacao(t)) t.worker.unref();
    if (msg.ok) p.resolve(msg);
    else p.reject(new Error(msg.erro));
  });
  t.worker.on('error', (e) => falharTudo(e));
  t.worker.on('exit', (codigo) => {
    falharTudo(new Error(`simulação offline: a thread saiu (código ${codigo})`));
    if (!t.encerrando) aoMorrer(t, codigo);
  });
  // Parada, a thread não segura o processo aberto (Ctrl+C, fim dos testes).
  t.worker.unref();
  threads.push(t);
  return t;
}

/** Uma thread morreu sozinha (erro, falta de memória): com `manterAquecida`, outra nasce e é aquecida — com atraso se ela morreu logo ao nascer. */
function aoMorrer(t, codigo) {
  if (!manterAquecida || threads.length >= QUANTAS || recriando) return;
  mortesSeguidas = Date.now() - t.criadaEm < 60_000 ? mortesSeguidas + 1 : 0;
  const atraso = mortesSeguidas ? Math.min(60_000, 2_000 * 2 ** (mortesSeguidas - 1)) : 0;
  console.error(`simulação offline: a thread morreu (código ${codigo}) — outra em ${Math.round(atraso / 1000)} s`);
  recriando = setTimeout(() => {
    recriando = null;
    if (!manterAquecida || threads.length >= QUANTAS) return;
    aquecerUma(nova()).catch((e) => console.error('simulação offline: a thread nova não aqueceu ->', e.message));
  }, atraso);
  recriando.unref();
}

/** Quantos trabalhos de verdade a thread tem na fila (o aquecimento não conta: ele só espera a carga que o trabalho esperaria igual). */
const ocupacao = (t) => t.pendentes.size - (t.aquecendo != null ? 1 : 0);

const menosOcupada = (lista) => lista.reduce((a, b) => (ocupacao(b) < ocupacao(a) ? b : a));

/**
 * A thread para um trabalho (cria até `QUANTAS`). O login (`modo` 'login') vai para uma thread livre; sem livre, para a que não tem
 * consolidação na fila (a consolidação de um personagem pesado leva ~20 s). A consolidação ocupa no máximo `PARA_CONSOLIDAR` threads: com 2+,
 * uma fica sempre fora dela — a consolidação seguinte espera na fila de uma que já consolida.
 */
function escolher(modo) {
  if (modo === 'consolidar') {
    const consolidando = threads.filter((t) => t.consolidando.size);
    if (consolidando.length >= PARA_CONSOLIDAR) return menosOcupada(consolidando);
    const livre = threads.find((t) => !ocupacao(t));
    if (livre) return livre;
    if (threads.length < QUANTAS) return nova();
    return menosOcupada(threads.filter((t) => !t.consolidando.size));
  }
  const livre = threads.find((t) => !ocupacao(t));
  if (livre) return livre;
  if (threads.length < QUANTAS) return nova();
  const semConsolidar = threads.filter((t) => !t.consolidando.size);
  return menosOcupada(semConsolidar.length ? semConsolidar : threads);
}

/** Manda um trabalho para a thread `t`; `segurar`: o processo fica aberto até a resposta (o aquecimento não segura). */
function enviar(t, mensagem, { segurar = true } = {}) {
  const id = proximoId++;
  return new Promise((resolve, reject) => {
    t.pendentes.set(id, { resolve, reject });
    if (mensagem.modo === 'consolidar') t.consolidando.add(id);
    if (!segurar && t.aquecendo == null) t.aquecendo = id;
    if (segurar) t.worker.ref();
    t.worker.postMessage({ id, ...mensagem });
  });
}

/** O "ping" do aquecimento: responde quando o jogo terminou de carregar na thread (`{ms, heapMb}` — quanto a espera levou e o heap dela). Um por thread. */
function aquecerUma(t) {
  const inicio = Date.now();
  return (t.aquecimento ??= enviar(t, { modo: 'aquecer' }, { segurar: false }).then(({ heapMb }) => ({ ms: Date.now() - inicio, heapMb })));
}

/**
 * Aquece a simulação offline (o servidor chama logo depois de abrir a porta): cria as `QUANTAS` threads que faltam e espera o jogo carregar
 * em cada uma — uma DEPOIS da outra (não duas cargas frias ao mesmo tempo: nem o pico de memória nem a CPU do boot dobram). Daí em diante
 * elas ficam sempre aquecidas — se uma morrer, outra nasce e é aquecida. Devolve `{ms, heapMb, threads}` (o tempo até a última e o heap
 * dela). O aquecimento NÃO segura o processo aberto (o servidor fica aberto pela porta; um script que só espera isto precisa de algo vivo).
 */
export async function aquecer() {
  manterAquecida = true;
  const inicio = Date.now();
  let r = { heapMb: 0 };
  for (const t of threads.slice()) r = await aquecerUma(t);
  while (manterAquecida && threads.length < QUANTAS) r = await aquecerUma(nova());
  return { ms: Date.now() - inicio, heapMb: r.heapMb, threads: threads.length };
}

/**
 * Simula a ausência de `estado` numa thread à parte. Devolve `{estado,
 * ausencia}` — o estado é uma CÓPIA já simulada (com a caçada compacta, como
 * no banco: passe por `Cacadas.huntAoCarregar`), e `ausencia` é o mesmo que
 * `Cacadas.simularAusencia` devolveria.
 */
export function simular(estado, personagem, agora = Date.now(), modo = 'login') {
  return enviar(escolher(modo), { estado, personagem, agora, modo }).then(({ estado: simulado, ausencia }) => ({ estado: simulado, ausencia }));
}

/**
 * O avanço em segundo plano (`Cacadas.consolidarAusencia`), na mesma thread à
 * parte: `{estado, ausencia}` com `ausencia = {avancou, morreu}` (ou `null`).
 * Ver `consolidacao-offline.mjs`.
 */
export const consolidar = (estado, personagem, agora = Date.now()) => simular(estado, personagem, agora, 'consolidar');

/** Quantas threads estão vivas agora (o teste do aquecimento olha). */
export const threadsVivas = () => threads.length;

/**
 * Fecha as threads (os testes chamam no fim). Toda chamada pendente rejeita
 * aqui, na hora — a mesma corrida de `simulador-tique.mjs::encerrar` (resposta
 * antes do `exit` + `unref()` com o `terminate()` pendente). Desliga também o
 * "manter aquecida": a thread fechada aqui não nasce de novo.
 */
export async function encerrar() {
  manterAquecida = false;
  if (recriando) clearTimeout(recriando);
  recriando = null;
  const fechando = threads.splice(0);
  const erro = new Error('simulação offline: pool encerrado');
  for (const t of fechando) {
    t.encerrando = true;
    for (const p of t.pendentes.values()) p.reject(erro);
    t.pendentes.clear();
    t.worker.ref(); // segura o event loop até a thread sair de verdade
  }
  await Promise.all(fechando.map((t) => t.worker.terminate()));
}

/** (testes) Quantas threads têm consolidação na fila agora. */
export const threadsConsolidando = () => threads.filter((t) => t.consolidando.size).length;

/** (testes) Derruba uma thread de propósito, como se ela tivesse morrido sozinha (o `exit` de verdade — sem o `encerrar`). */
export async function derrubarParaTeste() {
  const t = threads[0];
  if (t) await t.worker.terminate();
}
