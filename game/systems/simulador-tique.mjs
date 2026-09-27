// Pool de workers que tica hunts SOLO (Fase 5 do audit de performance —
// docs/auditoria-performance.md §15/§16, gargalo #1/#2 da síntese de
// 2026-09-27: o tique de todo mundo hoje roda numa thread só, síncrona, e
// isso limita o processo a ~200 jogadores caçando antes do ping degradar).
//
// Mesmo padrão de `simulacao-offline.mjs` (pool com crescimento preguiçoso,
// `escolher()` pela menor fila, correlação por `id`, erro/saída de um worker
// derruba só ele) — E o mesmo protocolo (manda o estado, recebe o estado),
// só que chamado a cada 250ms em vez de uma vez só. Sem posse persistente de
// sessão: cada tique é independente, a thread principal continua sendo a
// única fonte de verdade de `sessao.estado` entre um tique e outro (ver o
// comentário em `simulador-tique-worker.mjs` para o porquê disso importar).
//
// Só hunts solo (sem grupo, sem arena) usam isto — quem decide elegibilidade,
// tique a tique, é `game/websocket/sessao.mjs`. Hunt em grupo e arena
// continuam 100% na thread principal: elas compartilham OBJETO vivo entre
// sessões (`hunt.anfitriao`, `hunt.partilha.membros` — ver o comentário no
// topo de `game/systems/hunt/combate.mjs`), incompatível com "cada tique
// pode rodar num worker diferente".
//
// Desligado por padrão (`SIMULADORES_TIQUE` não setado ou 0): ninguém chama
// isto, comportamento 100% igual a hoje.
import { Worker } from 'node:worker_threads';

const QUANTAS = Math.max(0, Number(process.env.SIMULADORES_TIQUE) || 0);
export const ligado = QUANTAS > 0;

const FAIXA_DE_UID = 1_000_000_000; // por worker — ver o comentário em simulador-tique-worker.mjs

const threads = []; // { worker, pendentes: Map<id, {resolve, reject}> }
let proximoId = 1;

function nova() {
  const t = {
    worker: new Worker(new URL('./simulador-tique-worker.mjs', import.meta.url), { workerData: { faixaDeUid: (threads.length + 1) * FAIXA_DE_UID } }),
    pendentes: new Map(),
  };
  const falharTudo = (erro) => {
    for (const p of t.pendentes.values()) p.reject(erro);
    t.pendentes.clear();
    const i = threads.indexOf(t);
    if (i >= 0) threads.splice(i, 1);
  };
  t.worker.on('message', ({ id, ok, estado, eventos, erro }) => {
    const p = t.pendentes.get(id);
    if (!p) return;
    t.pendentes.delete(id);
    if (!t.pendentes.size) t.worker.unref();
    if (ok) p.resolve({ estado, eventos });
    else p.reject(new Error(erro));
  });
  t.worker.on('error', (e) => falharTudo(e));
  t.worker.on('exit', (codigo) => falharTudo(new Error(`simulador de tique: a thread saiu (código ${codigo})`)));
  t.worker.unref(); // parado, não segura o processo aberto (testes, Ctrl+C)
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
 * Um tique de `estado` (hunt solo) numa thread à parte. Devolve `{estado,
 * eventos}` — mesmo contrato de `Cacadas.tique`, só que assíncrono. Quem
 * chama atualiza `sessao.estado` com o resultado.
 *
 * `podio` (bônus semanal da Arena, `Arena.bonusDoPodio` — ver
 * `sessao.mjs::tique`) vai à parte porque mora em `hunt.podio`, uma
 * propriedade NÃO-ENUMERÁVEL (de propósito, não vai para o banco) — clone
 * estruturado (`postMessage`) não leva propriedade não-enumerável.
 */
export function tique(estado, personagem, agora, podio) {
  const t = escolher();
  const id = proximoId++;
  return new Promise((resolve, reject) => {
    t.pendentes.set(id, { resolve, reject });
    t.worker.ref();
    t.worker.postMessage({ id, estado, personagem, agora, podio });
  });
}

/** Fecha as threads (os testes chamam no fim). */
export async function encerrar() {
  await Promise.all(threads.splice(0).map((t) => t.worker.terminate()));
}
