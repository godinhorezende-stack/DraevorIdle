// Hunt normal só abre com o level dela ("hunt normais também só se a pessoa
// tiver lv"). A tela já trancava o card ("requer level X"); o servidor não
// conferia, e um comando direto abria qualquer uma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const PORT_HOPE = 'port-hope-corym-dungeons'; // level 40

test('abaixo do level da hunt: não entra, e a frase diz quanto falta', () => {
  const e = personagemDeTeste({ level: 36 });
  const r = Cacadas.entrar(e, { huntId: PORT_HOPE, mode: 'auto' });
  assert.equal(r.ok, false);
  assert.match(r.erro, /pede level 40, e você é level 36/);
  assert.equal(e.hunt ?? null, null);
});

test('no level da hunt: entra', () => {
  const e = personagemDeTeste({ level: 40 });
  assert.equal(Cacadas.entrar(e, { huntId: PORT_HOPE, mode: 'auto' }).ok, true);
  assert.equal(e.hunt.huntId, PORT_HOPE);
});

test('quem já estava caçando abaixo do level não é tirado: a trava é só a porta', () => {
  const e = personagemDeTeste({ level: 40 });
  assert.equal(Cacadas.entrar(e, { huntId: PORT_HOPE, mode: 'auto' }).ok, true);
  e.level = 30; // ex.: entrou antes da trava existir, ou caiu de level morrendo
  const agora = Date.now();
  for (let i = 1; i <= 8; i++) Cacadas.tique(e, PERSONAGEM, agora + i * 250);
  assert.equal(e.hunt?.huntId, PORT_HOPE, 'segue caçando');
});
