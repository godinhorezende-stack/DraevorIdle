// O relógio em fatias (fase 3): cada sessão nova cai numa fatia fixa,
// round-robin — sem isso as 5 fatias (50ms cada, 250ms o ciclo inteiro)
// ficariam desbalanceadas, e uma delas custaria mais que as outras.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sessao, FATIAS } from '../../game/websocket/sessao.mjs';

const socket = () => ({ readyState: 1, send() {} });

test('a fatia gira 0,1,2,3,4,0,1,... a cada sessão nova', () => {
  const sessoes = Array.from({ length: FATIAS * 3 + 2 }, () => new Sessao(socket()));
  const fatias = sessoes.map((s) => s.fatia);
  for (let i = 0; i < fatias.length; i++) assert.equal(fatias[i], i % FATIAS, `sessão ${i}`);
  // Todas as sessões saem do relógio ao desconectar — não deixa a próxima
  // rodada de testes achando sessão fantasma numa fatia.
  for (const s of sessoes) s.desconectar();
});

test('sai da fatia ao desconectar, e quem entra depois continua o giro de onde parou', () => {
  const a = new Sessao(socket());
  const b = new Sessao(socket());
  assert.notEqual(a.fatia, undefined);
  a.desconectar();
  const c = new Sessao(socket());
  // `c` não reaproveita a fatia de `a` fora de hora — o giro é pela ORDEM de
  // chegada, não pela vaga que abriu.
  assert.equal(c.fatia, (b.fatia + 1) % FATIAS);
  b.desconectar();
  c.desconectar();
});

test('com muita gente, as fatias ficam com o mesmo tamanho (± 1)', () => {
  const N = 503; // não múltiplo de FATIAS, de propósito
  const sessoes = Array.from({ length: N }, () => new Sessao(socket()));
  const porFatia = new Map();
  for (const s of sessoes) porFatia.set(s.fatia, (porFatia.get(s.fatia) ?? 0) + 1);
  const tamanhos = [...porFatia.values()];
  assert.equal(tamanhos.length, FATIAS);
  assert.ok(Math.max(...tamanhos) - Math.min(...tamanhos) <= 1, `fatias desbalanceadas: ${tamanhos}`);
  for (const s of sessoes) s.desconectar();
});
