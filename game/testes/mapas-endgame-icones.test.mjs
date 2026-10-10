// Os ÍCONES dos mapas do endgame (dono, 10/10: "aqui tem os assets com a imagem dos mapas dos tier que quero colocar"). O do poedb
// (`MapNumbersN`) era só o número romano solto; agora cada tier tem a moeda do mapa com o número (as imagens do dono), todas em 80×80 —
// as que vieram com 78×78 são centralizadas num quadro transparente, sem redimensionar (`tools/importar-icones-mapas.mjs`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decodificarPng } from '../engine/png-minimo.mjs';
import { centralizar, DESTINO, LADO } from '../tools/importar-icones-mapas.mjs';

const MAPAS = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/mapas.json', import.meta.url), 'utf8'));
const PASTA = new URL('../gamedata/itens-poe/icones-itens/', import.meta.url);

test('cada tier (T1–T16) tem o ícone da moeda: um PNG de 80×80, com a borda transparente e o desenho no meio', () => {
  const bases = MAPAS.classe.bases;
  assert.equal(bases.length, 16);
  for (const b of bases) {
    assert.match(b.icone, /^poe-itens\/Mapas\/icones\/Map_Tier_\d+\.png$/, `${b.id}: o ícone novo`);
    assert.equal(b.iconeLado, LADO);
    const arquivo = new URL(b.icone, PASTA);
    assert.ok(existsSync(arquivo), `${b.icone} existe`);
    const png = decodificarPng(readFileSync(arquivo));
    assert.deepEqual([png.w, png.h], [LADO, LADO], `${b.id}: 80×80`);
    // A moeda ocupa o quadro (o desenho de verdade, não só o número): o centro e um ponto do aro são opacos.
    const alfa = (x, y) => png.data[(y * png.w + x) * 4 + 3];
    assert.ok(alfa(40, 40) > 200, `${b.id}: o centro é opaco`);
    assert.ok(alfa(40, 8) > 200, `${b.id}: o aro da moeda (não só o número) é opaco`);
  }
  assert.equal(existsSync(join(DESTINO, 'Map_Tier_1.webp')), false, 'o ícone antigo (só o número) saiu');
});

test('centralizar: a imagem menor vai para o meio do quadro, sem redimensionar; maior que o quadro é recusada', () => {
  const pixel = (r) => [r, 0, 0, 255];
  const data = new Uint8ClampedArray([...pixel(1), ...pixel(2), ...pixel(3), ...pixel(4)]);
  const q = centralizar({ w: 2, h: 2, data }, 4);
  assert.deepEqual([q.w, q.h], [4, 4]);
  const em = (x, y) => Array.from(q.data.subarray((y * 4 + x) * 4, (y * 4 + x) * 4 + 4));
  assert.deepEqual([em(1, 1), em(2, 1), em(1, 2), em(2, 2)], [pixel(1), pixel(2), pixel(3), pixel(4)], 'no meio, intacta');
  assert.deepEqual(em(0, 0), [0, 0, 0, 0], 'a borda é transparente');
  assert.throws(() => centralizar({ w: 5, h: 5, data: new Uint8ClampedArray(100) }, 4), /maior que 4×4/);
});
