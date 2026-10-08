// O ícone do PoE no MAPA cabe numa casa (dono, 08/10: "item no chão está absurdamente maior que o personagem, não está em 1 tile"). O
// sprite do Tibia maior que 32 é grande de propósito (cresce para cima e para a esquerda a partir da casa); o ícone do PoE é a arte do
// inventário (64×64 a peça, 64/78 a gema, 48 o orbe) e, desenhado do mesmo jeito, ocupava 2×2 casas. Aqui roda o `drawItem` de verdade
// (client/src/sprites.mjs, extraído do arquivo) com um contexto de desenho de mentira.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SPRITES = readFileSync(new URL('../frontend/client/src/sprites.mjs', import.meta.url), 'utf8');
const FONTE = SPRITES.match(/export function drawItem\(ctx, id, x, y, options\) \{[\s\S]*?\n\}/)?.[0]?.replace('export ', '');

function desenhar(sprite, x, y) {
  const drawItem = new Function('itemSprites', 'viewOf', 'image', 'pageSrc', `${FONTE}\nreturn drawItem;`)(
    { 1: sprite },
    () => null,
    () => ({ ready: true, image: 'atlas' }),
    () => 'pagina',
  );
  const chamadas = [];
  assert.equal(drawItem({ drawImage: (...a) => chamadas.push(a) }, 1, x, y), true);
  return chamadas[0].slice(5); // [destino x, y, largura, altura]
}

test('o ícone do PoE (peça 64×64, gema 78×78, orbe 48×48) vai para dentro da casa: 32×32 no canto dela', () => {
  assert.ok(FONTE, 'achei o drawItem');
  assert.deepEqual(desenhar({ w: 64, h: 64, x: 0, y: 0, umaCasa: true }, 320, 160), [320, 160, 32, 32]);
  assert.deepEqual(desenhar({ w: 78, h: 78, x: 0, y: 0, umaCasa: true }, 320, 160), [320, 160, 32, 32]);
  assert.deepEqual(desenhar({ w: 48, h: 48, x: 0, y: 0, umaCasa: true }, 320, 160), [320, 160, 32, 32]);
});

test('o sprite grande do Tibia continua crescendo para cima e para a esquerda (a árvore, o baú grande)', () => {
  assert.deepEqual(desenhar({ w: 64, h: 64, x: 0, y: 0 }, 320, 160), [288, 128, 64, 64]);
  assert.deepEqual(desenhar({ w: 32, h: 32, x: 0, y: 0 }, 320, 160), [320, 160, 32, 32]);
});

test('os três ícones do PoE emprestados do catálogo (peça, gema e orbe) entram marcados para caber numa casa', () => {
  const corpo = SPRITES.match(/export function emprestarDoCatalogo\(catalogo\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  const icones = [...corpo.matchAll(/itemSprites\[id\] = \{[^}]*gerada: `\/api\/jogo\/poe\/icone\/[^}]*\}/g)].map((m) => m[0]);
  assert.equal(icones.length, 3, 'a gema, o orbe e a peça');
  for (const i of icones) assert.match(i, /umaCasa: true/);
});
