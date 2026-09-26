// Arma com elemento bate DUAS vezes no mesmo golpe, como no original (knight
// level 400 de soulcutter: 16 físico em cinza + 73 death em #990000 — ver
// `api-mapeada/treino-online-msgs.json`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../sistemas/cacadas.mjs';
import * as Prey from '../sistemas/prey.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

function primeiroGolpe(armaId) {
  const e = personagemDeTeste({ level: 400 });
  e.equipment.weapon = { id: armaId, count: 1 };
  // Abre os slots de prey ANTES de fixar o acaso: a lista sorteia 9 criaturas
  // distintas e, com `Math.random` constante, nunca acharia a segunda.
  Prey.garantir(e);
  const original = Math.random;
  Math.random = () => 0.5;
  try {
    assert.ok(Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' }).ok);
    let t = Date.now();
    e.hunt.ultimoTique = t;
    for (let i = 0; i < 4 * 600; i++) {
      t += 250;
      e.hp = e.maxHp;
      const golpes = (Cacadas.tique(e, PERSONAGEM, t) ?? []).filter((ev) => ev.t === 'dmg' && ev.foe && !ev.spell);
      if (golpes.length) return golpes;
    }
  } finally {
    Math.random = original;
  }
  assert.fail('não bateu em 10 minutos');
}

test('soulcutter (físico 7 + death 45): dois números no mesmo golpe, cinza e #990000, o de death maior', () => {
  const [fisico, death] = primeiroGolpe(34082);
  assert.equal(fisico.color, '#999999');
  assert.equal(death.color, '#990000');
  assert.equal(fisico.uid, death.uid);
  assert.ok(death.v > fisico.v, `físico ${fisico.v}, death ${death.v}`);
});

test('Crafted Ravox Knight Axe V2 (18 + holy 65): a parte holy entra', () => {
  const golpes = primeiroGolpe(55860);
  assert.equal(golpes.length, 2);
  assert.equal(golpes[1].color, '#ffe066');
});

test('arma sem elemento continua com um número só, vermelho', () => {
  const golpes = primeiroGolpe(7773); // steel axe
  assert.equal(golpes.length, 1);
  assert.equal(golpes[0].color, '#ff0000');
});
