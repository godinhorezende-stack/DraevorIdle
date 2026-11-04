// (04/11) A thread da caçada offline AQUECIDA (game/systems/simulacao-offline.mjs): o servidor a aquece no boot, uma só por padrão; se ela
// morrer, outra nasce aquecida; `encerrar()` fecha de vez. E o jogo dela (com os mapas sob demanda — `iniciarJogoDoPoe({ mapasSobDemanda })`)
// é o MESMO do servidor.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import * as Cacadas from '../systems/cacadas.mjs';
import * as SimulacaoOffline from '../systems/simulacao-offline.mjs';
import { ligado as jogoOficial } from '../systems/itens-poe/catalogo.mjs';
import { mapaRealCapturado, mapasReaisCacheados, spawnsDaHunt, spawnsDaHuntSemGuardar } from '../systems/hunt/terreno.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';
import { retratoDoJogo } from './apoio-retrato-do-jogo.mjs';

after(() => SimulacaoOffline.encerrar());

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function ate(cond, limiteMs, oQue) {
  const fim = Date.now() + limiteMs;
  while (!cond()) {
    if (Date.now() > fim) assert.fail(`não aconteceu em ${limiteMs} ms: ${oQue}`);
    await esperar(50);
  }
}

/** Um personagem caçando offline há `minutos` (o testador: não morre). */
function cacandoOffline(minutos) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 20 });
  e.testador = true;
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto', strategy: 'nearest' }).ok);
  e.hunt.offlineDesde = Date.now() - minutos * 60_000;
  return { ...e, hunt: Cacadas.huntParaGravar(e.hunt) };
}

test('aquecer: a thread carrega o jogo antes de alguém precisar; uma thread só por padrão; a volta não espera a carga', { timeout: 120_000 }, async () => {
  const r = await SimulacaoOffline.aquecer();
  assert.ok(r.ms >= 0 && r.heapMb > 0, JSON.stringify(r));
  assert.equal(SimulacaoOffline.threadsVivas(), 1);
  // Aquecer de novo não cria outra.
  await SimulacaoOffline.aquecer();
  assert.equal(SimulacaoOffline.threadsVivas(), 1);
  // Duas voltas ao mesmo tempo: com o padrão (sem SIMULADORES_OFFLINE), fazem fila na mesma thread.
  const voltas = await Promise.all([SimulacaoOffline.simular(cacandoOffline(3), { id: 'a', nome: 'Aquecida A' }), SimulacaoOffline.simular(cacandoOffline(3), { id: 'b', nome: 'Aquecida B' })]);
  for (const { ausencia } of voltas) assert.ok(ausencia?.report?.minutos >= 2, `a ausência não rodou: ${JSON.stringify(ausencia?.report)}`);
  if (!process.env.SIMULADORES_OFFLINE) assert.equal(SimulacaoOffline.threadsVivas(), 1);
});

test('a thread morreu sozinha: outra nasce, aquecida, e a volta seguinte funciona', { timeout: 120_000 }, async () => {
  await SimulacaoOffline.aquecer();
  await SimulacaoOffline.derrubarParaTeste();
  await ate(() => SimulacaoOffline.threadsVivas() === 1, 30_000, 'a thread nova nascer');
  const { ausencia } = await SimulacaoOffline.simular(cacandoOffline(2), { id: 'c', nome: 'Depois da Morte' });
  assert.ok(ausencia?.report, 'sem relatório depois da thread nova');
});

test('encerrar: a thread fechada não nasce de novo (o processo dos testes não fica pendurado)', { timeout: 60_000 }, async () => {
  await SimulacaoOffline.aquecer();
  await SimulacaoOffline.encerrar();
  assert.equal(SimulacaoOffline.threadsVivas(), 0);
  await esperar(3_000);
  assert.equal(SimulacaoOffline.threadsVivas(), 0);
});

test('spawnsDaHuntSemGuardar: os mesmos spawns, sem deixar o mapa na memória (e o mapa lido de novo é igual)', { skip: !jogoOficial() && 'só no jogo oficial (as áreas do PoE)' }, () => {
  const hunt = 'oramond-hydras';
  const antes = mapasReaisCacheados.get(hunt);
  mapasReaisCacheados.delete(hunt);
  try {
    const sem = spawnsDaHuntSemGuardar(hunt);
    assert.equal(mapasReaisCacheados.has(hunt), false, 'o mapa ficou na memória');
    assert.deepEqual(sem, spawnsDaHunt(hunt));
    const lido = mapaRealCapturado(hunt);
    if (antes) assert.deepEqual(lido, antes);
    // Já carregado: continua carregado.
    spawnsDaHuntSemGuardar(hunt);
    assert.equal(mapasReaisCacheados.get(hunt), lido);
  } finally {
    if (antes) mapasReaisCacheados.set(hunt, antes);
  }
});

test('o jogo da thread (mapas sob demanda) é o mesmo do servidor: monstros, áreas, mapas do endgame e spawns', { skip: !jogoOficial() && 'só no jogo oficial (o jogo do PoE)', timeout: 120_000 }, async () => {
  const daThread = await new Promise((resolve, reject) => {
    const w = new Worker(new URL('./apoio-retrato-do-jogo.mjs', import.meta.url), { workerData: { retratoDoJogo: true } });
    w.once('message', (m) => { resolve(m); w.terminate(); });
    w.once('error', reject);
  });
  const doProcesso = retratoDoJogo();
  assert.equal(daThread.mapasNaMemoria, 0, 'a thread carregou mapas no início');
  assert.ok(doProcesso.mapasNaMemoria > 0, 'o processo (como o servidor) devia ter os mapas');
  assert.ok(daThread.texto.length > 1000);
  assert.equal(daThread.texto, doProcesso.texto);
});
