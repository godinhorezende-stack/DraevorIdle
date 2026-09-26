// Fase 4.3: Global/Mercado/Local serializam a fala UMA vez (`JSON.stringify`)
// e mandam o mesmo texto pronto para cada destinatário (`enviarPronto`), em
// vez de um `JSON.stringify` por gente ouvindo — o conteúdo entregue tem de
// continuar sendo exatamente o mesmo de antes (mesma fala, mesmo formato).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vivas } from '../nucleo/sessao.mjs';
import * as Chat from '../sistemas/chat.mjs';

function sessaoFake(nome, pos = { x: 100, y: 100, z: 7 }) {
  const recebidos = [];
  const s = {
    personagem: { nome },
    estado: { vocation: 'knight', level: 100, pos },
    enviarPronto(texto) { recebidos.push(JSON.parse(texto)); },
    enviar(msg) { recebidos.push(msg); },
    recebidos,
  };
  vivas.set(nome, s);
  return s;
}

function limpar(...sessoes) {
  for (const s of sessoes) vivas.delete(s.personagem.nome);
}

test('Global: todo mundo online recebe a MESMA fala, no mesmo formato de antes', () => {
  const a = sessaoFake('GlobalA');
  const b = sessaoFake('GlobalB');
  const c = sessaoFake('GlobalC');
  try {
    const erro = Chat.falar(a, { channel: 'global', text: 'oi geral' });
    assert.equal(erro, null);
    for (const s of [a, b, c]) {
      assert.equal(s.recebidos.length, 1, s.personagem.nome);
      assert.equal(s.recebidos[0].t, 'chat');
      assert.equal(s.recebidos[0].channel, 'global');
      assert.equal(s.recebidos[0].name, 'GlobalA');
      assert.equal(s.recebidos[0].text, 'oi geral');
    }
  } finally {
    limpar(a, b, c);
  }
});

test('Mercado: mesma regra, canal mercado', () => {
  const a = sessaoFake('MercA');
  const b = sessaoFake('MercB');
  try {
    const erro = Chat.falar(a, { channel: 'mercado', text: 'vendo espada' });
    assert.equal(erro, null);
    assert.equal(a.recebidos[0].channel, 'mercado');
    assert.equal(b.recebidos[0].channel, 'mercado');
    assert.equal(b.recebidos[0].text, 'vendo espada');
  } finally {
    limpar(a, b);
  }
});

test('Local: só quem está perto ouve a fala e vê o balão — quem está longe, nada', () => {
  const perto1 = sessaoFake('Perto1', { x: 100, y: 100, z: 7 });
  const perto2 = sessaoFake('Perto2', { x: 102, y: 100, z: 7 });
  const longe = sessaoFake('Longe', { x: 100, y: 500, z: 7 });
  try {
    const erro = Chat.falar(perto1, { channel: 'local', text: 'e ai' });
    assert.equal(erro, null);
    // perto1 (o próprio) e perto2 ouvem a fala + o balão (2 mensagens cada).
    assert.equal(perto1.recebidos.length, 2);
    assert.equal(perto2.recebidos.length, 2);
    assert.equal(perto2.recebidos[0].channel, 'local');
    assert.equal(perto2.recebidos[0].text, 'e ai');
    assert.equal(perto2.recebidos[1].t, 'events');
    assert.equal(perto2.recebidos[1].events[0].t, 'say');
    assert.equal(perto2.recebidos[1].events[0].quem, 'Perto1');
    // Quem está longe não recebe nada.
    assert.equal(longe.recebidos.length, 0);
  } finally {
    limpar(perto1, perto2, longe);
  }
});
