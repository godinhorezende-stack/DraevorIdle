// "teste se os bônus estão aplicáveis": os quatro bônus de prey numa caçada de
// verdade (troll-cave, Trolls reais do bestiário), cada um comparado com um
// personagem idêntico SEM prey. `Math.random` fica fixo nos dois para que o
// único jeito de os números saírem diferentes seja o bônus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Prey from '../sistemas/prey.mjs';
import * as Cacadas from '../sistemas/cacadas.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const HORA = 3_600_000;

function comPrey(bonus, key = 'troll', rarity = 10) {
  const estado = personagemDeTeste({ level: 400 });
  Prey.garantir(estado);
  if (bonus) Object.assign(estado.prey[0], { key, bonus, rarity, percent: Prey.percentual(bonus, rarity), left: HORA, state: 'active' });
  return estado;
}

/** Caça na troll-cave com `Math.random` fixo até `achou(evento)` aparecer; devolve o evento. */
function cacarAte(estado, acaso, achou) {
  const original = Math.random;
  Math.random = () => acaso;
  try {
    assert.ok(Cacadas.entrar(estado, { huntId: 'troll-cave', mode: 'auto' }).ok);
    let t = Date.now();
    estado.hunt.ultimoTique = t;
    for (let i = 0; i < 4 * 900; i++) {
      t += 250;
      estado.hp = estado.maxHp; // a vida não é o assunto aqui
      for (const ev of Cacadas.tique(estado, PERSONAGEM, t) ?? []) if (achou(ev)) return ev;
    }
  } finally {
    Math.random = original;
  }
  assert.fail('o evento esperado nunca aconteceu em 15 minutos de caçada');
}

const golpeNoTroll = (ev) => ev.t === 'dmg' && ev.foe && ev.alvo === 'Troll';
const golpeDoTroll = (ev) => ev.t === 'dmg' && !ev.foe && ev.de === 'Troll';
const lootDoTroll = (ev) => ev.t === 'loot' && ev.name === 'Troll';
const morteDoTroll = (ev) => ev.t === 'kill' && ev.name === 'Troll';

test('DANO: prey de dano 10★ bate 25% mais forte no Troll', () => {
  const sem = cacarAte(comPrey(null), 0.5, golpeNoTroll).v;
  const com = cacarAte(comPrey('damage'), 0.5, golpeNoTroll).v;
  assert.ok(Math.abs(com - sem * 1.25) <= 1, `sem ${sem}, com ${com}`);
});

test('DEFESA: prey de defesa 10★ tira 30% do golpe do Troll (do que passou da armadura)', () => {
  // Sem armadura: o Troll do monster.lua bate 0..15, e com a sorte fixa em 0,5 a
  // armadura do equipamento inicial comia o golpe inteiro — nunca havia dano.
  const pelado = (estado) => Object.assign(estado, { equipment: {} });
  const sem = cacarAte(pelado(comPrey(null)), 0.5, golpeDoTroll).v;
  const com = cacarAte(pelado(comPrey('defense')), 0.5, golpeDoTroll).v;
  assert.equal(com, Math.round(sem * 0.7), `sem ${sem}, com ${com}`);
});

test('EXPERIÊNCIA: prey de exp 10★ dá +40% de exp por Troll', () => {
  const sem = cacarAte(comPrey(null), 0.5, morteDoTroll).exp;
  const com = cacarAte(comPrey('exp'), 0.5, morteDoTroll).exp;
  assert.equal(com, Math.round(sem * 1.4));
});

test('LOOT: prey de loot 10★ faz cair o que tem chance entre 25% e 35% (x1,4 passa do sorteio 0,35)', () => {
  const nomes = (ev) => ev.items.map((i) => i.id).sort();
  const sem = nomes(cacarAte(comPrey(null), 0.35, lootDoTroll));
  const com = nomes(cacarAte(comPrey('loot'), 0.35, lootDoTroll));
  // Sem prey: só o que tem chance > 35% (gold coin 3031, hand axe 3268).
  assert.deepEqual(sem, [3031, 3268]);
  // Com prey: + spear (26%) e meat (30%).
  assert.deepEqual(com, [3031, 3268, 3277, 3577]);
});

test('o bônus NÃO vale contra outra criatura (prey de Amazon caçando Troll)', () => {
  const semDano = cacarAte(comPrey(null), 0.5, golpeNoTroll).v;
  const comDanoErrado = cacarAte(comPrey('damage', 'amazon'), 0.5, golpeNoTroll).v;
  assert.equal(comDanoErrado, semDano);
  const semExp = cacarAte(comPrey(null), 0.5, morteDoTroll).exp;
  const comExpErrada = cacarAte(comPrey('exp', 'amazon'), 0.5, morteDoTroll).exp;
  assert.equal(comExpErrada, semExp);
});

test('o bônus NÃO vale com o tempo zerado', () => {
  const estado = comPrey('exp');
  estado.prey[0].left = 0;
  estado.prey[0].key = 'troll'; // como se tivesse acabado agora mesmo
  const sem = cacarAte(comPrey(null), 0.5, morteDoTroll).exp;
  assert.equal(cacarAte(estado, 0.5, morteDoTroll).exp, sem);
});
