// O limite de ritmo de uma conexão (game/websocket/limites.mjs): o cliente de verdade
// nunca é cortado; uma enxurrada é, e insistindo a conexão cai.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ritmo, POR_SEGUNDO, RAJADA, TOLERANCIA } from '../../game/websocket/limites.mjs';

test('o ritmo do cliente de verdade (rumo a cada 100 ms + ping por segundo) passa inteiro por 10 minutos', () => {
  const r = new Ritmo(0);
  for (let t = 0; t < 600_000; t += 100) {
    assert.ok(r.aceitar(t), `rumo em ${t}`);
    if (t % 1000 === 0) assert.ok(r.aceitar(t), `ping em ${t}`);
  }
});

test('uma rajada de abrir painéis cabe no balde', () => {
  const r = new Ritmo(0);
  for (let i = 0; i < RAJADA; i++) assert.ok(r.aceitar(0));
  assert.equal(r.aceitar(0), false);
});

test('enxurrada: passa só o ritmo do balde e a conexão acaba marcada como abuso', () => {
  const r = new Ritmo(0);
  let aceitas = 0;
  // 5.000 mensagens em 1 s.
  for (let i = 0; i < 5000; i++) if (r.aceitar(i / 5)) aceitas++;
  assert.ok(aceitas <= RAJADA + POR_SEGUNDO + 1, `aceitou ${aceitas}`);
  assert.ok(r.abusou);
});

test('passar do ritmo por pouco não derruba ninguém: a conta esvazia com o tempo', () => {
  const r = new Ritmo(0);
  for (let i = 0; i < RAJADA; i++) r.aceitar(0);
  for (let i = 0; i < TOLERANCIA; i++) r.aceitar(0); // descarta, mas ainda não é abuso
  assert.equal(r.abusou, false);
  assert.ok(r.aceitar(1000)); // um segundo depois, entra de novo
  assert.ok(r.aceitar(10_000));
  assert.equal(r.descartadas, 0); // 10 s depois não sobra nada da rajada
});

test('enxurrada contínua (1.000/s por 3 s) é marcada como abuso mesmo com o balde reenchendo', () => {
  const r = new Ritmo(0);
  let abusouEm = null;
  for (let i = 0; i < 3000 && abusouEm == null; i++) {
    r.aceitar(i);
    if (r.abusou) abusouEm = i;
  }
  assert.ok(abusouEm != null && abusouEm < 1000, `abusou em ${abusouEm} ms`);
});
