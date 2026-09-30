// Os efeitos de Lendário e Mítico (systems/itens/efeitos.mjs): separados dos
// atributos, lidos pelo combate em três pontos só.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Efeitos from '../systems/itens/efeitos.mjs';
import * as Ficha from '../systems/ficha.mjs';
import { EFEITOS } from '../systems/itens/config.mjs';
import { personagemDeTeste } from './apoio.mjs';

function com(...efeitos) {
  const e = personagemDeTeste({ level: 100 });
  const slots = ['ring', 'neck', 'head', 'legs'];
  efeitos.forEach(([tipo, id], i) => {
    e.equipment[slots[i]] = { id: 3004, count: 1, raridade: tipo === 'lendario' ? 'lendário' : 'mítico', af: [], efeito: { tipo, id } };
  });
  Ficha.invalidar(e);
  return e;
}

test('Fúria do Desespero: +30% de dano só com a vida abaixo de 40%', () => {
  const e = com(['lendario', 'desespero']);
  e.hp = e.maxHp;
  assert.equal(Efeitos.fatorDeDano(e, { hp: 100, maxHp: 100 }), 1);
  e.hp = Math.floor(e.maxHp * 0.3);
  assert.equal(Efeitos.fatorDeDano(e, { hp: 100, maxHp: 100 }), 1.3);
});

test('Carrasco: +100% contra criatura abaixo de 25% da vida — nunca em boss', () => {
  const e = com(['mitico', 'carrasco']);
  assert.equal(Efeitos.fatorDeDano(e, { hp: 20, maxHp: 100 }), 2);
  assert.equal(Efeitos.fatorDeDano(e, { hp: 50, maxHp: 100 }), 1);
  e.hunt = { isBoss: true, pos: { x: 0, y: 0 } };
  assert.equal(Efeitos.fatorDeDano(e, { hp: 20, maxHp: 100 }), 1);
});

test('Colheita de Almas: cada kill soma, até o teto, e passa com o tempo', () => {
  const e = com(['mitico', 'colheita-de-almas']);
  e.hunt = { pos: { x: 0, y: 0 } };
  const p = EFEITOS.mitico['colheita-de-almas'].efeito.acumuloAoMatar;
  for (let i = 0; i < p.max + 10; i++) Efeitos.aoMatar(e, e.hunt, {}, [], 'X');
  assert.equal(e.hunt.acumulos['colheita-de-almas'].n, p.max);
  assert.ok(Math.abs(Efeitos.fatorDeDano(e, {}) - (1 + (p.max * p.porKill) / 100)) < 1e-9);
  e.hunt.acumulos['colheita-de-almas'].ate = Date.now() - 1;
  assert.equal(Efeitos.fatorDeDano(e, {}), 1, 'acabou o tempo');
});

test('Sede de Sangue: cada kill cura 4% da vida máxima (sem passar do máximo)', () => {
  const e = com(['lendario', 'sede-de-sangue']);
  e.hunt = { pos: { x: 1, y: 1 } };
  e.hp = 1;
  const eventos = [];
  Efeitos.aoMatar(e, e.hunt, {}, eventos, 'X');
  assert.equal(e.hp, 1 + Math.round(e.maxHp * 0.04));
  assert.equal(eventos[0].t, 'heal');
  e.hp = e.maxHp;
  Efeitos.aoMatar(e, e.hunt, {}, [], 'X');
  assert.equal(e.hp, e.maxHp);
});

test('Pele de Pedra: −12% de todo dano recebido, junto com a mitigação das gemas', () => {
  const sem = personagemDeTeste({ level: 100 });
  const e = com(['lendario', 'pele-de-pedra']);
  const antes = Ficha.combate(sem).danoRecebidoDasGemas;
  const depois = Ficha.combate(e).danoRecebidoDasGemas;
  assert.ok(Math.abs(1 - (1 - depois) / (1 - antes) - 0.12) < 1e-9, `${antes} -> ${depois}`);
});

test('o mesmo efeito em duas peças não acumula; sem efeito, nada muda', () => {
  const e = com(['lendario', 'desespero'], ['lendario', 'desespero']);
  e.hp = 1;
  assert.equal(Efeitos.fatorDeDano(e, { hp: 1, maxHp: 1 }), 1.3);
  const nada = personagemDeTeste({ level: 100 });
  assert.equal(Efeitos.fatorDeDano(nada, { hp: 1, maxHp: 100 }), 1);
  assert.equal(Efeitos.reducaoDeDano(nada), 0);
});

test('o texto do efeito vem com os números da configuração', () => {
  assert.deepEqual(Efeitos.textoDoEfeito({ tipo: 'lendario', id: 'desespero' }), {
    nome: 'Fúria do Desespero', tipo: 'lendario', texto: '+30% de dano enquanto a vida estiver abaixo de 40%.',
  });
  assert.equal(Efeitos.textoDoEfeito({ tipo: 'lendario', id: 'nao-existe' }), null);
});
