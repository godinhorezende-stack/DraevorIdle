// O RETRATO do jogo carregado (os monstros do PoE no bestiário, as áreas e os mapas do endgame no catálogo de hunts e os spawns de cada
// uma, já com os bichos do PoE): o teste da thread da caçada offline compara o da thread (`mapasSobDemanda`) com o do processo — o jogo
// tem de ser o MESMO. Como worker (`workerData.retratoDoJogo`), carrega o jogo como a thread da caçada offline e devolve o retrato.
import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import * as Cacadas from '../systems/cacadas.mjs';
import { iniciarJogoDoPoe } from '../systems/itens-poe/iniciar.mjs';
import { BESTIARY } from '../systems/hunt/monstros.mjs';
import { CATALOGO } from '../systems/dados.mjs';
import { spawnsDaHunt, mapasReaisCacheados } from '../systems/hunt/terreno.mjs';

/** O retrato (JSON) do jogo deste processo/thread. `mapasNaMemoria`: quantos mapas ficaram carregados depois do início. */
export function retratoDoJogo() {
  const mapasNaMemoria = mapasReaisCacheados.size;
  const bestiario = Object.keys(BESTIARY).filter((k) => k.startsWith('poe-')).sort().map((k) => [k, BESTIARY[k]]);
  const hunts = CATALOGO.hunts.filter((h) => h.poeArea || h.poeMapa).map((h) => ({ id: h.id, nome: h.name, nivel: h.level, criaturas: h.creatures }));
  const spawns = hunts.map((h) => [h.id, spawnsDaHunt(h.id)]);
  return { mapasNaMemoria, texto: JSON.stringify({ bestiario, hunts, spawns }) };
}

if (!isMainThread && workerData?.retratoDoJogo) {
  void Cacadas;
  await iniciarJogoDoPoe({ mapasSobDemanda: true });
  parentPort.postMessage(retratoDoJogo());
}
