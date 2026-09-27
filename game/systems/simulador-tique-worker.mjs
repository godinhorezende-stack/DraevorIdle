// A thread que tica UM tique de hunt SOLO (sem grupo, sem arena) por
// mensagem — ver `simulador-tique.mjs`, dono do pool.
//
// Sem estado entre mensagens (mesmo padrão de `simulacao-offline-worker.mjs`:
// manda o estado, recebe o estado) — cada tique chega com o `estado`/
// `personagem`/`agora` inteiros e volta com o `estado` já mutado + os
// eventos. Isto é DE PROPÓSITO mais simples que "o worker é dono da sessão
// entre tiques": a thread principal continua sendo a única fonte de verdade
// de `sessao.estado` entre um tique e outro — comandos do jogador
// (`huntTarget`, `lure`, `strategy`, ...) que mudam `estado.hunt` na hora
// continuam funcionando exatamente como hoje, e ninguém (party, arena) lê um
// `estado` "adiantado" que só existe dentro de um worker. O único custo a
// mais é mandar o `estado` inteiro (32-95 KB, ver Fase 1.3) a cada tique em
// vez de só `{sessionId, agora}` — pouco, e clone estruturado dentro do
// mesmo processo é barato.
//
// Só chega aqui quem já está confirmado como solo (sem `hunt.anfitriao`, sem
// `hunt.pvp`, sem party ativa) — a decisão de quem é elegível é toda de
// `game/websocket/sessao.mjs`. `Cacadas.tique` é puro sobre `estado` +
// `personagem` desde que `hunt.podio` venha pronto nele (ver
// `game/systems/hunt/combate.mjs::matarMonstro` e o comentário em
// `sessao.mjs::tique()`) — nada aqui importa `arena.mjs`, `party.mjs` nem
// nada que fale com `vivas`/sessão/banco.
import { parentPort, workerData } from 'node:worker_threads';
import * as Cacadas from './cacadas.mjs';
import { garantirUidAcimaDe } from './hunt/monstros.mjs';

// Partição do contador de uid dos bichos: cada worker é um módulo carregado
// do zero (`proximoUid = 1`) — sem isto, dois workers criando monstro ao
// mesmo tempo (respawn em duas hunts diferentes, em workers diferentes)
// podiam gerar o mesmo uid. Mesmo mecanismo que já existe para "a caçada
// carregada do banco não pode reusar um uid vivo" (`huntAoCarregar`).
if (Number.isFinite(workerData?.faixaDeUid)) garantirUidAcimaDe(workerData.faixaDeUid);

parentPort.on('message', ({ id, estado, personagem, agora, podio }) => {
  try {
    // `podio` chega à parte (não-enumerável não sobrevive ao clone
    // estruturado — ver o comentário em `simulador-tique.mjs::tique`);
    // recolocado do mesmo jeito não-enumerável que `sessao.mjs` usaria, para
    // `matarMonstro` (`hunt.podio ?? SEM_PODIO`) ler igual não importa a
    // origem, e para não ir junto se este `estado` for adiante (ex.: log de erro).
    if (estado.hunt) Object.defineProperty(estado.hunt, 'podio', { value: podio, enumerable: false, writable: true, configurable: true });
    const eventos = Cacadas.tique(estado, personagem, agora);
    parentPort.postMessage({ id, ok: true, estado, eventos });
  } catch (e) {
    parentPort.postMessage({ id, ok: false, erro: e?.stack ?? String(e) });
  }
});
