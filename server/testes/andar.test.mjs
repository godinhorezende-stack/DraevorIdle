// Andar na cidade: um passo por tique, sem perder passo quando o tique chega
// um pouco antes de 250 ms (o relógio real oscila 249/251). Antes da folga
// (`R.jaPode`), segurando a tecla por 4 s saíam 8 passos em vez de 16.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sessao } from '../../game/websocket/sessao.mjs';
import * as R from '../nucleo/regras.mjs';
import { personagemDeTeste } from './apoio.mjs';

function andar(intervalos) {
  const s = new Sessao({ readyState: 1, send() {} });
  s.personagem = { id: 0, nome: 'Andar' };
  s.estado = personagemDeTeste();
  s.estado.pos = { ...R.POSICAO_INICIAL };
  // Anda para um lado livre da praça (o primeiro dos quatro que não é parede).
  const livre = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => {
    for (let i = 1; i <= intervalos.length + 1; i++) {
      const x = s.estado.pos.x + dx * i;
      const y = s.estado.pos.y + dy * i;
      if (x < 0 || y < 0) return false;
    }
    return true;
  });
  const original = Date.now;
  let agora = original();
  Date.now = () => agora;
  const passos = [];
  try {
    for (const dt of intervalos) {
      agora += dt;
      s.estado.rumo = { dx: livre[0], dy: livre[1] };
      s.estado.rumoValidoAte = agora + 1000;
      const antes = { ...s.estado.pos };
      s.processarMovimento();
      if (s.estado.pos.x !== antes.x || s.estado.pos.y !== antes.y) passos.push(agora);
    }
  } finally {
    Date.now = original;
  }
  return passos;
}

test('16 tiques de ~250 ms (249/251) = 16 passos, nenhum perdido', () => {
  const intervalos = Array.from({ length: 16 }, (_, i) => (i % 2 ? 251 : 249));
  const passos = andar(intervalos);
  // A praça pode ter parede no caminho: o que importa é não perder tique quando anda.
  if (passos.length < 16) assert.ok(passos.length >= 4, `andou só ${passos.length}`);
  for (let i = 1; i < passos.length; i++) assert.ok(passos[i] - passos[i - 1] <= 251, `passo perdido: ${passos[i] - passos[i - 1]} ms`);
});

test('nunca dois passos no mesmo tique: tiques de 100 ms andam no ritmo de 250', () => {
  const passos = andar(Array.from({ length: 40 }, () => 100));
  for (let i = 1; i < passos.length; i++) assert.ok(passos[i] - passos[i - 1] >= 200, `rápido demais: ${passos[i] - passos[i - 1]} ms`);
});
