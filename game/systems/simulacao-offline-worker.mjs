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
import { mapaDe, mapasReaisCacheados, manterSoOsMapas } from './hunt/terreno.mjs';

// O MESMO jogo do servidor: o do PoE (as áreas da campanha, os monstros, as gemas, os itens) — sem isto a caçada offline numa área do PoE
// quebrava aqui ("reading 'andares'": a área não existia na thread). Carregado uma vez; as mensagens esperam por ele.
// (04/11) `mapasSobDemanda`: os mapas das hunts só quando uma caçada daqui os usa (o servidor tem todos; aqui eram ~180 MB à toa).
const pronto = iniciarJogoDoPoe({ mapasSobDemanda: true });

// (04/11) Os mapas que as caçadas daqui carregam também SAEM: a thread guarda só os `MAPAS_NA_MEMORIA` usados por último (cada mapa com a
// grade são ~4 MB de heap; sem isto, com o servidor rodando, os jogadores passando por terrenos diferentes enchiam a thread de novo — +175 MB
// com os 44 terrenos). O mapa que saiu é lido de novo (igual) na próxima caçada que o usar.
const MAPAS_NA_MEMORIA = Math.max(0, Number(process.env.SIMULADOR_MAPAS_NA_MEMORIA ?? 6) || 0);
let usados = []; // os ids de mapa, do usado há mais tempo ao mais recente

function guardarSoOsRecentes(daCacada) {
  const novos = [...mapasReaisCacheados.keys()].filter((m) => !usados.includes(m));
  const recentes = daCacada.filter(Boolean).map(mapaDe);
  usados = manterSoOsMapas([...usados.filter((m) => !recentes.includes(m)), ...novos.filter((m) => !recentes.includes(m)), ...recentes], MAPAS_NA_MEMORIA);
}

parentPort.on('message', async ({ id, estado, personagem, agora, modo }) => {
  const daCacada = [estado?.hunt?.huntId];
  try {
    await pronto;
    // O "ping" do aquecimento (`simulacao-offline.aquecer`): o jogo já carregou — e o heap desta thread.
    if (modo === 'aquecer') return parentPort.postMessage({ id, ok: true, heapMb: Math.round(process.memoryUsage().heapUsed / 1e6), mapasNaMemoria: mapasReaisCacheados.size });
    Cacadas.huntAoCarregar(estado.hunt);
    // `consolidar`: o avanço em segundo plano (ver `consolidacao-offline.mjs`);
    // o personagem continua ausente. O padrão é o login de sempre.
    const ausencia = modo === 'consolidar' ? Cacadas.consolidarAusencia(estado, personagem, agora) : Cacadas.simularAusencia(estado, personagem, agora);
    daCacada.push(estado.hunt?.huntId);
    if (estado.hunt) estado.hunt = Cacadas.huntParaGravar(estado.hunt);
    guardarSoOsRecentes(daCacada);
    parentPort.postMessage({ id, ok: true, estado, ausencia, mapasNaMemoria: mapasReaisCacheados.size });
  } catch (e) {
    try { guardarSoOsRecentes(daCacada); } catch {}
    parentPort.postMessage({ id, ok: false, erro: e?.stack ?? String(e) });
  }
});
