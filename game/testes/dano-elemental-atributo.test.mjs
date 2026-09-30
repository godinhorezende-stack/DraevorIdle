import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Cacadas from '../systems/cacadas.mjs';
import * as Afixos from '../systems/afixos.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as Treino from '../systems/treino.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { round, EFEITO_DO_ELEMENTO } from '../systems/hunt/combate.mjs';
import { personagemDeTeste, PERSONAGEM } from './apoio.mjs';

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);

function golpeCom(elemento, pct) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 1 });
  Treino.garantir(e);
  // Accuracy de sobra: o golpe nunca erra (o erro tem teste próprio, em defesas-novas).
  e.equipment.ring = { id: ANEL, count: 1, af: [{ id: `${elemento}_dmg`, nivel: 1, value: pct }, { id: 'accuracy', nivel: 5, value: 1e6 }] };
  e.maxHp = e.hp = 1e9;
  Afixos.sincronizarMaximos(e);
  Ficha.invalidar(e);
  Cacadas.entrar(e, { huntId: 'troll-cave', mode: 'auto' });
  const h = e.hunt;
  delete h.instancia;
  h.respawns = [];
  h.outrosAndares = {};
  const m = criarMonstro({ key: 'troll', x: h.pos.x + 1, y: h.pos.y }, null);
  m.hp = m.maxHp = 1e12;
  delete m.spawn;
  h.monstros.splice(0, h.monstros.length, m);
  h.alvo = m.uid;
  return round(e, PERSONAGEM).eventos;
}

for (const el of ['fire', 'energy', 'earth', 'ice', 'death', 'holy']) {
  test(`${el}: o golpe traz o número do elemento E o efeito visual dele; o físico sai cinza`, () => {
    const eventos = golpeCom(el, 50);
    const fx = eventos.filter((x) => x.t === 'fx' && x.id === EFEITO_DO_ELEMENTO[el]);
    const numeros = eventos.filter((x) => x.t === 'dmg' && x.foe);
    assert.equal(fx.length, 1, 'efeito do elemento no bicho');
    assert.equal(numeros.length, 2, 'físico + elemento');
    assert.equal(numeros[0].color, '#999999', 'o físico fica cinza');
    assert.ok(numeros[1].v >= 1);
  });
}

test('percentual minúsculo: o elemento nunca bate menos que 1', () => {
  // 0,1% de um golpe de nível 1 dá bem menos que 1 — e tem de bater 1.
  for (let i = 0; i < 40; i++) {
    const numeros = golpeCom('fire', 0.1).filter((x) => x.t === 'dmg' && x.foe);
    assert.equal(numeros.length, 2, 'o elemento aparece mesmo assim');
    assert.ok(numeros[1].v >= 1, `bateu ${numeros[1].v}`);
  }
});
