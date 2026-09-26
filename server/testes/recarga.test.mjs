// A recarga das magias de ataque como no original: metade da do catálogo, e o
// grupo "ataque" (1 s) dividido com as runas de ataque. Medido nas capturas do
// Zoros (`captura-monstros-0924`): uma magia por segundo; Fierce Berserk 6 s → ~3 s.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../../game/systems/cacadas.mjs';
import * as Acoes from '../../game/systems/acoes.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

function naHuntComBarra(ids) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 3000 });
  e.magic = { value: 10 }; // a Fireball Rune pede magic level
  ids.forEach((id, k) => assert.ok(Acoes.definir(e, { slot: 11 + k, value: { id } }).ok, id));
  assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
  const h = e.hunt;
  // Três bichos colados nele, que não morrem.
  h.monstros.splice(0, h.monstros.length, ...h.monstros.slice(0, 3));
  h.monstros.forEach((m, i) => Object.assign(m, { x: h.pos.x + [1, -1, 0][i], y: h.pos.y + [0, 0, 1][i], hp: 1e12, maxHp: 1e12 }));
  return e;
}

test('recarga de ataque: Fierce Berserk sai a cada 3 s, e o grupo deixa uma magia por segundo', () => {
  const e = naHuntComBarra(['spell-fierce-berserk', 'spell-berserk']);
  const h = e.hunt;
  const r = Acoes.disparar(e, h, PERSONAGEM, 11, h.monstros[0]);
  assert.ok(r.ok, r.erro);
  assert.equal(h.cooldowns['spell-fierce-berserk'].total, 3000);
  assert.equal(h.cooldowns['grupo:attack'].total, 1000);
  h.clock += 1000;
  assert.ok(Acoes.disparar(e, h, PERSONAGEM, 12, h.monstros[0]).ok, 'um segundo depois, a segunda magia');
});

test('runa de ataque divide a recarga do grupo com as magias (não sai junto)', () => {
  const e = naHuntComBarra(['spell-berserk', 'rune-fireball-rune']);
  const h = e.hunt;
  assert.ok(Acoes.disparar(e, h, PERSONAGEM, 11, h.monstros[0]).ok);
  assert.equal(Acoes.disparar(e, h, PERSONAGEM, 12, h.monstros[0]).ok, false, 'no mesmo instante, a runa espera');
  h.clock += 1000;
  assert.ok(Acoes.disparar(e, h, PERSONAGEM, 12, h.monstros[0]).ok, 'depois do grupo, a runa sai');
});
