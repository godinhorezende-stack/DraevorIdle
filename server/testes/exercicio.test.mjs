// Exercise: o personagem vai para o lado do Exercise Dummy da cidade, de frente
// para ele, e cada carga é um golpe na tela com o efeito da arma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Exercicio from '../sistemas/exercicio.mjs';
import { CITY_META } from '../nucleo/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

const BONECOS = CITY_META.objetos.filter((o) => o.acao === 'exercise');
const colado = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;

function treinandoCom(itemId) {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.inventory.push({ id: itemId });
  const r = Exercicio.comecar(e, { itemId });
  assert.ok(r.ok, r.erro);
  return e;
}

test('começar o exercise leva o personagem para o lado de um boneco, de frente para ele', () => {
  const e = treinandoCom(28552); // Exercise Sword
  const b = BONECOS.find((o) => o.uid === e.exercicio.boneco.uid);
  assert.ok(b, 'um dos bonecos da cidade');
  assert.ok(colado(e.pos, b) && !(e.pos.x === b.x && e.pos.y === b.y), `em ${e.pos.x},${e.pos.y}`);
  const dir = e.pos.y > b.y ? 0 : e.pos.y < b.y ? 2 : e.pos.x > b.x ? 3 : 1;
  assert.equal(e.pos.dir, dir, 'olhando para o boneco');
});

test('cada carga é um golpe na tela, com o efeito da arma', () => {
  const golpes = (itemId) => {
    const e = treinandoCom(itemId);
    const eventos = [];
    Exercicio.tique(e, 1000, eventos); // 0,4 s por carga: 2 golpes
    return { e, eventos };
  };
  const espada = golpes(28552).eventos;
  assert.equal(espada.filter((x) => x.t === 'fx' && x.id === 10).length, 2, 'espada: acerta o boneco');
  assert.ok(!espada.some((x) => x.t === 'shot'), 'espada não atira');
  const { e, eventos: arco } = golpes(28555);
  const flecha = arco.find((x) => x.t === 'shot');
  assert.equal(flecha?.id, 3, 'arco: flecha');
  assert.deepEqual({ x: flecha.tx, y: flecha.ty }, { x: e.exercicio.boneco.x, y: e.exercicio.boneco.y }, 'no boneco');
  assert.equal(golpes(28556).eventos.find((x) => x.t === 'shot')?.id, 37, 'rod: gelo');
  assert.equal(golpes(28557).eventos.find((x) => x.t === 'shot')?.id, 4, 'wand: fogo');
  assert.equal(golpes(44065).eventos.find((x) => x.t === 'fx')?.id, 4, 'escudo: bloqueio');
});

test('afastar-se do boneco tira o personagem do treino (noBoneco)', () => {
  const e = treinandoCom(28552);
  assert.equal(Exercicio.noBoneco(e), true);
  e.pos.x += 3;
  assert.equal(Exercicio.noBoneco(e), false);
});
