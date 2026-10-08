// O `welcome` só leva o mapa da cidade (2,7 MB de JSON) para quem entra NA
// cidade. Quem entra caçando recebe a praça sem mapa: senão o cliente desenhava
// a cidade no primeiro quadro e pedia o `city.png` (3,8 MB) para uma tela que o
// primeiro `state` já trocava pela hunt. Ao voltar, ele pede (`pedirMapa`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Sessao, vivas } from '../websocket/sessao.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import * as R from '../systems/regras.mjs';
import { personagemDeTeste, HUNT_DE_TESTE } from './apoio.mjs';

async function welcomeDe(estado) {
  const enviados = [];
  const s = new Sessao({ readyState: 1, bufferedAmount: 0, send: (d) => enviados.push(JSON.parse(d)) });
  const nome = `Welcome${randomUUID().slice(0, 8)}`;
  s.conta = { id: `conta-${randomUUID()}` };
  try {
    await s.concluirEntrada({ id: randomUUID(), nome }, estado, null, null);
  } finally {
    // Tira a sessão do relógio (e de `vivas`): sem isto o processo não termina.
    s.desconectar();
    vivas.delete(nome);
  }
  return enviados.find((m) => m.t === 'welcome');
}

test('entrando na cidade: o welcome leva o mapa da cidade', async () => {
  const e = personagemDeTeste({ level: 100 });
  e.pos = { ...R.POSICAO_INICIAL };
  const w = await welcomeDe(e);
  assert.ok(w.city?.map?.palette, 'o mapa vai');
});

test('entrando caçando: a praça vai SEM o mapa', async () => {
  const e = personagemDeTeste({ level: 100 });
  e.pos = { ...R.POSICAO_INICIAL };
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  const w = await welcomeDe(e);
  assert.ok(w.city, 'a praça continua indo (jogadores, NPCs...)');
  assert.equal(w.city.map, undefined, 'mas sem os 2,7 MB do mapa');
});
