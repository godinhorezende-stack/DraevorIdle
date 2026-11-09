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
import cripto from 'node:crypto';
import { syncBuiltinESMExports } from 'node:module';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Prey from '../systems/prey.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

/*
 * (08/11, adaptado ao PoE — o dono: "Adaptar antes") Os testes que precisam de um abate (o evento `kill`, o bônus de pódio): level 90, e não
 * 400 (acima do 100 a XP do nível é Infinity na tabela do PoE), na Praia do Ato 1 — no Navio Encalhado o personagem de teste, sem nada do
 * PoE equipado, não abate nada.
 */
const NIVEL_QUE_ABATE = 90;
const AREA_QUE_ABATE = 'poe-a1-the-coast';

/** Prey sorteado com Math.random de verdade — chamar ANTES de qualquer `Math.random = () => x` no teste, senão o sorteio de candidatas do prey trava num `while` que nunca acha uma nova (ver podio-combate.test.mjs). */
function personagemPronto(opcoes, huntId = HUNT_DE_TESTE, { semente = null } = {}) {
  const e = personagemDeTeste(opcoes);
  Prey.garantir(e);
  if (semente == null) assert.ok(Cacadas.entrar(e, { huntId, mode: 'auto' }).ok);
  else comSemente(semente, () => assert.ok(Cacadas.entrar(e, { huntId, mode: 'auto' }).ok));
  e.hunt.ultimoTique = Date.now();
  return e;
}

/**
 * (08/11) A caçada do PoE sorteada SEMPRE igual: o Math.random com semente e a semente da instância (`crypto.randomInt`, os encontros —
 * `encontros/sorteio.mjs`) também, como em consolidacao-offline.test.mjs. Sem isso cada entrada nasce com outros monstros, e o abate que o
 * teste espera em 200 tiques às vezes não vem.
 */
function comSemente(semente, fn) {
  const original = Math.random;
  const randomIntOriginal = cripto.randomInt;
  let s = semente >>> 0;
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  cripto.randomInt = (min, max, ...resto) => (typeof max !== 'number' ? randomIntOriginal(min, max, ...resto) : min + Math.floor(Math.random() * (max - min)));
  syncBuiltinESMExports();
  try {
    return fn();
  } finally {
    Math.random = original;
    cripto.randomInt = randomIntOriginal;
    syncBuiltinESMExports();
  }
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
    // O worker não vê o `Math.random` fixo daqui: nestes 20 tiques não pode
    // haver luta (dano e loot são sorteados). A instância é densa perto da
    // entrada, então os bichos a menos de 15 casas saem.
    base.hunt.monstros = base.hunt.monstros.filter((m) => Math.max(Math.abs(m.x - base.hunt.pos.x), Math.abs(m.y - base.hunt.pos.y)) > 15);
    // Os encontros da fase (baú, altar: o idle os abre sozinho e sorteia loot) também são sorteio: ficam de fora desta comparação.
    if (base.hunt.instancia) delete base.hunt.instancia.encontros;
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
  let estado = personagemPronto({ level: NIVEL_QUE_ABATE }, AREA_QUE_ABATE, { semente: 7 }); // Prey.garantir precisa de Math.random de verdade — ver a nota em personagemPronto
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
  // (08/11) Na área do PoE cada entrada sorteia a sua caçada (os monstros, as raridades, os encontros): a do bônus é uma CÓPIA da outra (a
  // mesma que o `postMessage` faz), para o primeiro abate dos dois ser o mesmo monstro — é ele que a conta compara.
  let semBonus = personagemPronto({ level: NIVEL_QUE_ABATE }, AREA_QUE_ABATE, { semente: 7 });
  let comBonus = clonar(semBonus);
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
  // O `rejects` se pendura na promessa ANTES de encerrar: `encerrar()` rejeita
  // as chamadas em andamento na hora, e sem ninguém ouvindo isso vira
  // unhandledRejection enquanto o terminate() ainda está rodando.
  const rejeitou = assert.rejects(promessa, /pool encerrado|a thread saiu/);
  await Simulador.encerrar();
  await rejeitou;
  // O pool se recria sozinho na próxima chamada (mesmo padrão de `escolher()`/`nova()`).
  const r = await Simulador.tique(estado, PERSONAGEM, Date.now() + 500);
  assert.ok(r.estado);
});
