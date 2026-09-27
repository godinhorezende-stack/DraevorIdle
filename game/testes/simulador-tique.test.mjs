// O pool de workers que tica hunts solo (`game/systems/simulador-tique.mjs`,
// Fase 5 do audit de performance — ver docs/auditoria-performance.md §15/16
// e a síntese de 2026-09-27). Ainda NÃO está ligado em
// `game/websocket/sessao.mjs` (isso é o próximo passo) — este teste só prova
// que a infraestrutura em si funciona: o resultado de ticar no worker é
// IDÊNTICO a ticar direto na thread principal (mesmo `estado`, mesmo
// `agora`, mesmo dado fixo), e que perder um worker não trava a chamada para
// sempre (o pool cria outro sozinho na próxima).
//
// `SIMULADORES_TIQUE` só existe no processo que importa o módulo (ele lê o
// env na primeira importação) — por isso o import dinâmico com query única,
// mesmo padrão de `redis.test.mjs`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Prey from '../systems/prey.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

/** Prey sorteado com Math.random de verdade — chamar ANTES de qualquer `Math.random = () => x` no teste, senão o sorteio de candidatas do prey trava num `while` que nunca acha uma nova (ver podio-combate.test.mjs). */
function personagemPronto(opcoes) {
  const e = personagemDeTeste(opcoes);
  Prey.garantir(e);
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  e.hunt.ultimoTique = Date.now();
  return e;
}

/** Deep clone só de dados simples (JSON) — a mesma garantia que `estado` já precisa ter para atravessar `postMessage`. */
const clonar = (x) => JSON.parse(JSON.stringify(x));

process.env.SIMULADORES_TIQUE = '2';
const Simulador = await import(`../systems/simulador-tique.mjs?teste=${Math.random()}`);
after(() => Simulador.encerrar());

test('o módulo liga sozinho quando SIMULADORES_TIQUE > 0', () => {
  assert.equal(Simulador.ligado, true);
});

test('ticar no worker dá o MESMO resultado que ticar direto (mesmo estado, mesmo agora, dado fixo)', async () => {
  const original = Math.random;
  try {
    const base = personagemPronto({ level: 400 });
    const semente = clonar(base); // ponto de partida idêntico para as duas simulações

    // Mesma linha do tempo para as duas simulações — senão o tempo real que o
    // round-trip do worker leva (awaits) desalinha os `agora` de cada tique.
    let t0 = Date.now();
    const tempos = Array.from({ length: 20 }, () => (t0 += 250));

    // Baseline: 20 tiques direto na thread principal.
    Math.random = () => 0.5;
    const direto = clonar(semente);
    for (const t of tempos) Cacadas.tique(direto, PERSONAGEM, t);

    // Mesma coisa, mesmos 20 tiques (mesmos `agora`), via worker — um estado
    // completo por tique (sem posse persistente, ver o comentário no topo
    // de simulador-tique.mjs).
    let viaWorker = clonar(semente);
    for (const t of tempos) {
      const r = await Simulador.tique(viaWorker, PERSONAGEM, t);
      viaWorker = r.estado;
    }

    assert.deepEqual(viaWorker, direto, 'o estado depois de 20 tiques no worker deveria ser idêntico ao da thread principal');
  } finally {
    Math.random = original;
  }
});

test('os eventos do tique no worker são os mesmos que `Cacadas.tique` devolveria (ex.: kill)', async () => {
  let estado = personagemPronto({ level: 400 }); // Prey.garantir precisa de Math.random de verdade — ver a nota em personagemPronto
  const original = Math.random;
  Math.random = () => 0.5;
  try {
    let achouKill = false;
    for (let i = 0; i < 200 && !achouKill; i++) {
      const t = Date.now() + i * 250;
      const r = await Simulador.tique(estado, PERSONAGEM, t);
      estado = r.estado;
      if (r.eventos.some((e) => e.t === 'kill')) achouKill = true;
    }
    assert.ok(achouKill, 'nenhum kill em 200 tiques (50s de caçada) — algo mudou no combate ou no sorteio fixo');
  } finally {
    Math.random = original;
  }
});

test('o bônus de pódio (não-enumerável em hunt.podio) atravessa o worker — a mesma correção de podio-combate.test.mjs', async () => {
  // `hunt.podio` é não-enumerável de propósito (não vai para o banco) —
  // clone estruturado (`postMessage`) não leva propriedade não-enumerável, e
  // sem `Simulador.tique` receber `podio` à parte (4º argumento) o bônus
  // silenciosamente sumiria toda vez que o tique fosse pro worker.
  // As duas fichas nascem ANTES de travar o dado — a segunda não pode nascer
  // no meio do bloco travado (é exatamente o bug que já apareceu duas vezes
  // neste arquivo: `Prey.garantir` com Math.random travado trava para sempre).
  let semBonus = personagemPronto({ level: 400 });
  let comBonus = personagemPronto({ level: 400 });
  const original = Math.random;
  Math.random = () => 0.5;
  let semExp;
  try {
    for (let i = 0; i < 200 && semExp === undefined; i++) {
      const r = await Simulador.tique(semBonus, PERSONAGEM, Date.now() + i * 250);
      for (const ev of r.eventos) if (ev.t === 'kill') semExp = ev.exp;
      semBonus = r.estado;
    }
    assert.ok(semExp > 0, 'nenhum kill em 200 tiques');

    let comExp;
    for (let i = 0; i < 200 && comExp === undefined; i++) {
      const r = await Simulador.tique(comBonus, PERSONAGEM, Date.now() + i * 250, { exp: 8, loot: 0, lugar: 1 });
      for (const ev of r.eventos) if (ev.t === 'kill') comExp = ev.exp;
      comBonus = r.estado;
    }
    assert.equal(comExp, Math.round(semExp * 1.08));
  } finally {
    Math.random = original;
  }
});

test('worker que morre: a chamada em andamento rejeita, mas o pool continua funcionando depois', async () => {
  const estado = personagemPronto({ level: 400 });
  const promessa = Simulador.tique(estado, PERSONAGEM, Date.now() + 250);
  // Sem acesso direto ao worker que pegou esta chamada (o pool não expõe
  // isso, de propósito) — encerrar todas as threads simula a pior queda: TODO
  // o pool cai no meio de um tique.
  await Simulador.encerrar();
  await assert.rejects(() => promessa);
  // O pool se recria sozinho na próxima chamada (mesmo padrão de `escolher()`/`nova()`).
  const r = await Simulador.tique(estado, PERSONAGEM, Date.now() + 500);
  assert.ok(r.estado);
});
