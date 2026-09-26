// O laço da Caça Automática: sem bicho à vista, o personagem anda o percurso
// real da hunt (`route` do mapa capturado) sem parar, e cada volta completa
// conta em `huntLaps`. Antes ele ficava parado esperando os bichos renascerem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../../game/systems/cacadas.mjs';
import * as R from '../../game/systems/regras.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const HUNT = 'werelions-1';

/** Entra na hunt com um personagem que aguenta, e tira todos os bichos. */
function naHuntVazia() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 600 });
  const r = Cacadas.entrar(e, { huntId: HUNT, mode: 'cycle', strategy: 'nearest' });
  assert.equal(r.ok, true, r.erro);
  e.hunt.monstros = [];
  e.hunt.respawns = [];
  return e;
}

/** `n` tiques de 250 ms no relógio da caçada; devolve as posições por onde passou. */
function tiques(e, n, desde = Date.now()) {
  const posicoes = [];
  let agora = desde;
  for (let i = 0; i < n; i++) {
    agora += R.PASSO_MS;
    Cacadas.tique(e, PERSONAGEM, agora);
    // Nada pode renascer no meio do teste.
    e.hunt.monstros = e.hunt.monstros.filter((m) => m.teste);
    e.hunt.respawns = [];
    posicoes.push(`${e.hunt.pos.x},${e.hunt.pos.y}`);
  }
  return { posicoes, agora };
}

test('sem bicho nenhum, ele anda o percurso em vez de ficar parado', () => {
  const e = naHuntVazia();
  const { posicoes } = tiques(e, 40);
  assert.ok(new Set(posicoes).size >= 30, `andou só ${new Set(posicoes).size} casas diferentes em 40 passos`);
  const run = Cacadas.runParaCliente(e);
  assert.ok(run.passo > 0 && run.passos > 100, JSON.stringify(run));
});

test('dá a volta inteira e conta em huntLaps', () => {
  const e = naHuntVazia();
  const { passos } = Cacadas.runParaCliente(e);
  // Entre waypoints distantes (o trecho da rota que sai do andar) ele anda mais
  // de uma casa por waypoint: uma volta leva mais tiques que `passos`.
  tiques(e, Math.ceil(passos * 1.5));
  assert.ok((e.huntLaps?.[HUNT] ?? 0) >= 1, `voltas: ${JSON.stringify(e.huntLaps)}`);
  assert.equal(Cacadas.runParaCliente(e).voltas, e.huntLaps[HUNT]);
});

test('bicho à vista: sai do percurso e vai nele; bicho do outro lado do mapa: ignora', () => {
  const e = naHuntVazia();
  const { x, y } = e.hunt.pos;
  // Um bicho longe (mais de 12 casas) não é alvo — com percurso, ele não atravessa o mapa.
  const longe = { uid: 999001, key: null, name: 'Longe', look: 0, x: x + 40, y, dir: 2, hp: 100, maxHp: 100, exp: 0, loot: [], teste: true };
  e.hunt.monstros.push(longe);
  assert.equal(Cacadas.alvoAtual(e.hunt), null);
  // Um bicho a 3 casas é o alvo.
  const perto = { ...longe, uid: 999002, name: 'Perto', x: x + 3 };
  e.hunt.monstros.push(perto);
  assert.equal(Cacadas.alvoAtual(e.hunt)?.uid, 999002);
});

test('caçando de verdade (bichos de um golpe): nunca fica parado sem brigar, e anda o percurso', () => {
  // Werelions -1 tinha um White Lion à vista do outro lado de uma parede: sem
  // caminho até ele, o personagem ficava 48s parado. Agora desiste e segue.
  const e = personagemDeTeste({ vocacao: 'knight', level: 600 });
  e.hp = e.maxHp = 50_000;
  assert.equal(Cacadas.entrar(e, { huntId: HUNT, mode: 'cycle', strategy: 'nearest' }).ok, true);
  let agora = Date.now();
  let parado = 0;
  let maior = 0;
  let ultimo = '';
  // 15 minutos: com a densidade do original (2 bichos por ponto, ~296 no andar)
  // ele mata ~28 por minuto, um golpe a cada 2s, e a volta leva uns 12 minutos.
  for (let i = 0; i < 4 * 900; i++) {
    agora += R.PASSO_MS;
    e.hp = e.maxHp;
    for (const m of e.hunt.monstros) if (m.hp > 1) m.hp = 1;
    Cacadas.tique(e, PERSONAGEM, agora);
    const pos = `${e.hunt.pos.x},${e.hunt.pos.y}`;
    const alvo = Cacadas.alvoAtual(e.hunt);
    const brigando = alvo && Math.max(Math.abs(alvo.x - e.hunt.pos.x), Math.abs(alvo.y - e.hunt.pos.y)) <= 1;
    parado = pos === ultimo && !brigando ? parado + 1 : 0;
    maior = Math.max(maior, parado);
    ultimo = pos;
  }
  assert.ok(maior * R.PASSO_MS <= 2000, `ficou ${(maior * R.PASSO_MS) / 1000}s parado sem brigar`);
  // O percurso passa pelos 148 pontos de nascimento (296 bichos, `percursoPelosBichos`):
  // a volta inteira leva ~27 min matando o que renasce no caminho. Em 15, mais da metade.
  const run = Cacadas.runParaCliente(e);
  assert.ok((e.huntLaps?.[HUNT] ?? 0) >= 1 || run.passo >= run.passos / 2, `andou pouco em 15 minutos: ${JSON.stringify(run)}`);
});

test('hunt Vip (sala sem mapa capturado): também tem laço, pelos pontos de nascimento', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 600 });
  e.premiumAte = Date.now() + 86_400_000;
  assert.equal(Cacadas.entrar(e, { huntId: 'vip-hellspawn', mode: 'cycle', strategy: 'nearest' }).ok, true);
  e.hunt.monstros = [];
  e.hunt.respawns = [];
  const { passos } = Cacadas.runParaCliente(e);
  tiques(e, passos * 30);
  assert.ok((e.huntLaps?.['vip-hellspawn'] ?? 0) >= 1, `voltas: ${JSON.stringify(e.huntLaps)}`);
});

test('sem vai-e-volta: lurando ou não, ele nunca fica desfazendo o próprio passo (Winter Dream Court)', () => {
  // "meu char kina ficou bugado indo e voltando": lurando, o "bicho de fora mais
  // perto" trocava a cada passo (33,34 ↔ 34,34 por minutos); brigando, um bicho
  // do outro lado da parede era espelhado. Seis passos seguidos desfazendo o
  // anterior (1,5 s) já é vai-e-volta.
  for (const lure of [0, 4]) {
    const e = personagemDeTeste({ vocacao: 'knight', level: 3000 });
    e.settings.lure = lure;
    assert.equal(Cacadas.entrar(e, { huntId: 'winter-dream-court', mode: 'auto' }).ok, true);
    let agora = Date.now();
    e.hunt.ultimoTique = agora;
    const casas = [];
    let seguidos = 0;
    let pior = 0;
    for (let i = 0; i < 4 * 180; i++) {
      agora += R.PASSO_MS;
      e.hp = e.maxHp = 1e12;
      for (const m of e.hunt.monstros) if (m.hp > 1) m.hp = 1;
      Cacadas.tique(e, PERSONAGEM, agora);
      const c = `${e.hunt.pos.x},${e.hunt.pos.y},${e.hunt.z}`;
      if (c === casas.at(-1)) continue;
      casas.push(c);
      seguidos = casas.length >= 3 && c === casas.at(-3) ? seguidos + 1 : 0;
      pior = Math.max(pior, seguidos);
    }
    assert.ok(pior < 6, `lure ${lure}: ${pior} passos seguidos desfazendo o anterior`);
  }
});
