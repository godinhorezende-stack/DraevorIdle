// A thread que simula a caçada offline (ver `simulacao-offline.mjs`).
//
// Recebe o estado do personagem (com a caçada compacta, como no banco), roda
// o MESMO `Cacadas.simularAusencia` de sempre e devolve o estado já
// simulado, compactado de novo, e o relatório. Nada daqui fala com sessão,
// rede ou `vivas`: a simulação é uma função pura do estado — o que é também o
// que deixava ela rodar aqui sem mudar uma linha dela.
import { parentPort } from 'node:worker_threads';
import * as Cacadas from './cacadas.mjs';
import { iniciarJogoDoPoe } from './itens-poe/iniciar.mjs';

// O MESMO jogo do servidor: o do PoE (as áreas da campanha, os monstros, as gemas, os itens) — sem isto a caçada offline numa área do PoE
// quebrava aqui ("reading 'andares'": a área não existia na thread). Carregado uma vez; as mensagens esperam por ele.
const pronto = iniciarJogoDoPoe();

parentPort.on('message', async ({ id, estado, personagem, agora, modo }) => {
  try {
    await pronto;
    Cacadas.huntAoCarregar(estado.hunt);
    // `consolidar`: o avanço em segundo plano (ver `consolidacao-offline.mjs`);
    // o personagem continua ausente. O padrão é o login de sempre.
    const ausencia = modo === 'consolidar' ? Cacadas.consolidarAusencia(estado, personagem, agora) : Cacadas.simularAusencia(estado, personagem, agora);
    if (estado.hunt) estado.hunt = Cacadas.huntParaGravar(estado.hunt);
    parentPort.postMessage({ id, ok: true, estado, ausencia });
  } catch (e) {
    parentPort.postMessage({ id, ok: false, erro: e?.stack ?? String(e) });
  }
});
