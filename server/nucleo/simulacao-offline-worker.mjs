// A thread que simula a caçada offline (ver `simulacao-offline.mjs`).
//
// Recebe o estado do personagem (com a caçada compacta, como no banco), roda
// o MESMO `Cacadas.simularAusencia` de sempre e devolve o estado já
// simulado, compactado de novo, e o relatório. Nada daqui fala com sessão,
// rede ou `vivas`: a simulação é uma função pura do estado — o que é também o
// que deixava ela rodar aqui sem mudar uma linha dela.
import { parentPort } from 'node:worker_threads';
import * as Cacadas from '../sistemas/cacadas.mjs';

parentPort.on('message', ({ id, estado, personagem, agora }) => {
  try {
    Cacadas.huntAoCarregar(estado.hunt);
    const ausencia = Cacadas.simularAusencia(estado, personagem, agora);
    if (estado.hunt) estado.hunt = Cacadas.huntParaGravar(estado.hunt);
    parentPort.postMessage({ id, ok: true, estado, ausencia });
  } catch (e) {
    parentPort.postMessage({ id, ok: false, erro: e?.stack ?? String(e) });
  }
});
