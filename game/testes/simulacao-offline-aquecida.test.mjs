// (04/11) As threads da caçada offline AQUECIDAS (game/systems/simulacao-offline.mjs): o servidor aquece todas no boot (`QUANTAS`: min(2,
// nCPU − 1) por padrão); se uma morrer, outra nasce aquecida; `encerrar()` fecha de vez. O login não espera na fila da consolidação (com 2+
// threads, uma fica fora dela). O jogo da thread (com os mapas sob demanda — `iniciarJogoDoPoe({ mapasSobDemanda })`) é o MESMO do servidor,
// e ela guarda só os últimos mapas que usou.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import * as Cacadas from '../systems/cacadas.mjs';
import * as SimulacaoOffline from '../systems/simulacao-offline.mjs';
import { ligado as jogoOficial } from '../systems/itens-poe/catalogo.mjs';
import { mapaRealCapturado, mapasReaisCacheados, spawnsDaHunt, spawnsDaHuntSemGuardar, gradeDaHunt, acharHunt, esquecerMapa, manterSoOsMapas, mapaDe } from '../systems/hunt/terreno.mjs';
import * as Campanha from '../systems/campanha.mjs';
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

/** Um personagem caçando offline há `minutos` em `huntId` (o testador: não morre). */
function cacandoOffline(minutos, huntId = HUNT_DE_TESTE) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 20 });
  e.testador = true;
  const fase = huntId !== HUNT_DE_TESTE;
  if (fase) {
    e.sistema = 'poe';
    for (const d of Object.keys(e.campanha)) e.campanha[d].bosses = Array.from({ length: 10 }, (_, i) => i + 1);
  }
  const r = Cacadas.entrar(e, { huntId, mode: 'auto', strategy: 'nearest', ...(fase ? { dificuldade: Campanha.DIFICULDADES[0] } : {}) });
  assert.ok(r.ok, `não entrou em ${huntId}: ${r.erro}`);
  e.hunt.offlineDesde = Date.now() - minutos * 60_000;
  return { ...e, hunt: Cacadas.huntParaGravar(e.hunt) };
}

test('aquecer: TODAS as threads carregam o jogo antes de alguém precisar; a volta não espera a carga', { timeout: 180_000 }, async () => {
  const r = await SimulacaoOffline.aquecer();
  assert.ok(r.ms >= 0 && r.heapMb > 0, JSON.stringify(r));
  assert.equal(r.threads, SimulacaoOffline.QUANTAS);
  assert.equal(SimulacaoOffline.threadsVivas(), SimulacaoOffline.QUANTAS);
  // Aquecer de novo não cria outra.
  await SimulacaoOffline.aquecer();
  assert.equal(SimulacaoOffline.threadsVivas(), SimulacaoOffline.QUANTAS);
  // Duas voltas ao mesmo tempo: nenhuma thread a mais (com 1, fazem fila; com 2, uma em cada).
  const voltas = await Promise.all([SimulacaoOffline.simular(cacandoOffline(3), { id: 'a', nome: 'Aquecida A' }), SimulacaoOffline.simular(cacandoOffline(3), { id: 'b', nome: 'Aquecida B' })]);
  for (const { ausencia } of voltas) assert.ok(ausencia?.report?.minutos >= 2, `a ausência não rodou: ${JSON.stringify(ausencia?.report)}`);
  assert.equal(SimulacaoOffline.threadsVivas(), SimulacaoOffline.QUANTAS);
});

test('o login não espera na fila da consolidação: com 2+ threads, ela nunca ocupa todas', { skip: SimulacaoOffline.QUANTAS < 2 && 'só com 2+ threads (SIMULADORES_OFFLINE)', timeout: 180_000 }, async () => {
  await SimulacaoOffline.aquecer();
  const ordem = [];
  // Duas consolidações longas (2 h fora, uma atrás da outra como na rodada — aqui ao mesmo tempo, o pior caso) e, logo depois, um login curto.
  const consolidacoes = [1, 2].map((i) => SimulacaoOffline.consolidar(cacandoOffline(120), { id: `c${i}`, nome: `Consolidado ${i}` }).then(() => ordem.push(`consolidar ${i}`)));
  assert.equal(SimulacaoOffline.threadsConsolidando(), Math.max(1, SimulacaoOffline.QUANTAS - 1), 'a consolidação ocupou threads demais');
  await esperar(100);
  const { ausencia } = await SimulacaoOffline.simular(cacandoOffline(2), { id: 'l', nome: 'Login no Meio' });
  ordem.push('login');
  assert.ok(ausencia?.report, 'o login não simulou');
  await Promise.all(consolidacoes);
  assert.equal(ordem[0], 'login', `o login esperou a consolidação: ${ordem.join(' → ')}`);
});

test('a thread morreu sozinha: outra nasce, aquecida, e a volta seguinte funciona', { timeout: 120_000 }, async () => {
  await SimulacaoOffline.aquecer();
  await SimulacaoOffline.derrubarParaTeste();
  await ate(() => SimulacaoOffline.threadsVivas() === SimulacaoOffline.QUANTAS, 30_000, 'a thread nova nascer');
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

test('manterSoOsMapas / esquecerMapa: o mapa e a grade saem da memória, e lidos de novo são iguais', { skip: !jogoOficial() && 'só no jogo oficial (as áreas do PoE)' }, () => {
  const hunt = acharHunt(mapaDe(HUNT_DE_TESTE));
  const grade = gradeDaHunt(hunt);
  const mapa = mapaRealCapturado(hunt.id);
  assert.ok(mapa && grade.mapa === mapa);
  esquecerMapa(hunt.id);
  assert.equal(mapasReaisCacheados.has(hunt.id), false);
  const outra = gradeDaHunt(hunt);
  assert.notEqual(outra, grade, 'a grade velha ficou guardada');
  assert.deepEqual(outra, grade);
  // Só os da lista ficam, até o máximo, os mais novos (o fim da lista).
  const antes = new Map(mapasReaisCacheados);
  try {
    mapaRealCapturado('oramond-hydras');
    assert.deepEqual(manterSoOsMapas(['oramond-hydras', hunt.id, 'nao-carregado'], 1), [hunt.id]);
    assert.deepEqual([...mapasReaisCacheados.keys()], [hunt.id]);
    assert.deepEqual(manterSoOsMapas([hunt.id], 0), []);
    assert.equal(mapasReaisCacheados.size, 0);
  } finally {
    for (const [id, m] of antes) mapasReaisCacheados.set(id, m);
  }
});

test('a thread guarda só os últimos mapas que usou (SIMULADOR_MAPAS_NA_MEMORIA): as caçadas em terrenos diferentes não a enchem', { skip: !jogoOficial() && 'só no jogo oficial (as áreas do PoE)', timeout: 180_000 }, async () => {
  const w = new Worker(new URL('../systems/simulacao-offline-worker.mjs', import.meta.url), { env: { ...process.env, SIMULADOR_MAPAS_NA_MEMORIA: '2' } });
  let id = 0;
  const pedir = (msg) => new Promise((resolve, reject) => {
    const meu = ++id;
    const ouvir = (m) => { if (m.id !== meu) return; w.off('message', ouvir); m.ok ? resolve(m) : reject(new Error(m.erro)); };
    w.on('message', ouvir);
    w.postMessage({ id: meu, ...msg });
  });
  try {
    assert.equal((await pedir({ modo: 'aquecer' })).mapasNaMemoria, 0);
    // Três terrenos diferentes (atos 1, 3 e 6): no máximo 2 ficam.
    const huntIds = [1, 3, 6].map((ato) => Campanha.FASES.filter((f) => f.ato === ato)[1].huntId);
    assert.equal(new Set(huntIds.map(mapaDe)).size, 3, `os terrenos se repetem: ${huntIds.map(mapaDe)}`);
    const vistos = [];
    for (const huntId of huntIds) {
      const r = await pedir({ estado: cacandoOffline(3, huntId), personagem: { id: 'm', nome: 'Mapas' }, agora: Date.now(), modo: 'login' });
      assert.ok(r.ausencia?.report?.minutos >= 2, `a ausência não rodou em ${huntId}`);
      vistos.push(r.mapasNaMemoria);
    }
    assert.ok(vistos[0] >= 1, `o mapa da caçada não ficou: ${vistos}`);
    assert.ok(vistos.every((n) => n <= 2), `a thread passou de 2 mapas: ${vistos}`);
    // O mesmo terreno de novo (o mapa lido de novo): a mesma ausência.
    const repetida = await pedir({ estado: cacandoOffline(3, huntIds[0]), personagem: { id: 'm', nome: 'Mapas' }, agora: Date.now(), modo: 'login' });
    assert.ok(repetida.ausencia?.report?.minutos >= 2);
  } finally {
    await w.terminate();
  }
});
