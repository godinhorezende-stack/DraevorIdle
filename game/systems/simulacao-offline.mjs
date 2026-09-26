// A caçada offline simulada FORA da thread do jogo.
//
// Quem volta depois de horas caçando offline tem até 30 minutos de caçada
// simulados tique a tique (`Cacadas.simularAusencia`) — 7.200 tiques de uma
// vez. Na thread do jogo isso parava o servidor inteiro: medido, uma volta de
// 2 h deixava TODOS os outros jogadores 1,5–2,3 s sem resposta (ver
// docs/auditoria-performance.md, gargalo 1). Aqui a mesma função roda num
// `worker_thread`; a thread do jogo só espera a resposta.
//
// Poucas threads, reaproveitadas: cada uma carrega os dados do jogo uma vez
// (~100 MB). Com mais voltas que threads ao mesmo tempo, elas fazem fila —
// quem voltou espera um pouco mais pelo `welcome`, mas ninguém mais trava.
import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';

const QUANTAS = Math.max(1, Number(process.env.SIMULADORES_OFFLINE) || Math.min(2, availableParallelism() - 1));

const threads = []; // { worker, pendentes: Map<id, {resolve, reject}> }
let proximoId = 1;

function nova() {
  const t = { worker: new Worker(new URL('./simulacao-offline-worker.mjs', import.meta.url)), pendentes: new Map() };
  const falharTudo = (erro) => {
    for (const p of t.pendentes.values()) p.reject(erro);
    t.pendentes.clear();
    const i = threads.indexOf(t);
    if (i >= 0) threads.splice(i, 1);
  };
  t.worker.on('message', ({ id, ok, estado, ausencia, erro }) => {
    const p = t.pendentes.get(id);
    if (!p) return;
    t.pendentes.delete(id);
    if (!t.pendentes.size) t.worker.unref();
    if (ok) p.resolve({ estado, ausencia });
    else p.reject(new Error(erro));
  });
  t.worker.on('error', (e) => falharTudo(e));
  t.worker.on('exit', (codigo) => falharTudo(new Error(`simulação offline: a thread saiu (código ${codigo})`)));
  // Parada, a thread não segura o processo aberto (Ctrl+C, fim dos testes).
  t.worker.unref();
  threads.push(t);
  return t;
}

/** A thread com menos trabalho na fila (cria até `QUANTAS`). */
function escolher() {
  const livre = threads.find((t) => !t.pendentes.size);
  if (livre) return livre;
  if (threads.length < QUANTAS) return nova();
  return threads.reduce((a, b) => (b.pendentes.size < a.pendentes.size ? b : a));
}

/**
 * Simula a ausência de `estado` numa thread à parte. Devolve `{estado,
 * ausencia}` — o estado é uma CÓPIA já simulada (com a caçada compacta, como
 * no banco: passe por `Cacadas.huntAoCarregar`), e `ausencia` é o mesmo que
 * `Cacadas.simularAusencia` devolveria.
 */
export function simular(estado, personagem, agora = Date.now()) {
  const t = escolher();
  const id = proximoId++;
  return new Promise((resolve, reject) => {
    t.pendentes.set(id, { resolve, reject });
    t.worker.ref();
    t.worker.postMessage({ id, estado, personagem, agora });
  });
}

/** Fecha as threads (os testes chamam no fim). */
export async function encerrar() {
  await Promise.all(threads.splice(0).map((t) => t.worker.terminate()));
}
