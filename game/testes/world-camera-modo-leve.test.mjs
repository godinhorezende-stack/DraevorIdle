// A câmera do mapa da campanha (`.w2-cam`, client/src/world.mjs) se move pelo atributo `transform` do SVG. O modo leve das animações
// (`body.sem-animacao`, ligado por padrão no celular — graficos.mjs) zera, com `!important`, o `transform` de todo elemento cuja classe
// contém certos pedaços ("entra", "abre"...). Em 08/10 a câmera levava a classe `entra` (o esmaecer ao trocar de Ato) e ficava com ela:
// no celular o mapa congelava — arrastar, pinça e zoom calculavam e nada se mexia na tela, e a vista inicial (zoom e centro na fase)
// também se perdia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CSS = readFileSync(new URL('../frontend/client/style.css', import.meta.url), 'utf8');
const WORLD = readFileSync(new URL('../frontend/client/src/world.mjs', import.meta.url), 'utf8');
const WORLD_CSS = readFileSync(new URL('../frontend/client/world.css', import.meta.url), 'utf8');

/** Os pedaços de classe que o modo leve zera o `transform` (`body.sem-animacao [class*='x']` com `transform: none`). */
function pedacosQueZeramTransform() {
  const pedacos = [];
  for (const m of CSS.matchAll(/((?:body\.sem-animacao \[class\*=['"][^'"]+['"]\],?\s*)+)\{([^}]*)\}/g)) {
    if (!/transform:\s*none/.test(m[2])) continue;
    for (const p of m[1].matchAll(/\[class\*=['"]([^'"]+)['"]\]/g)) pedacos.push(p[1]);
  }
  return pedacos;
}

test('o modo leve zera o transform pelos pedaços de classe (a regra que o teste vigia existe)', () => {
  assert.ok(pedacosQueZeramTransform().includes('entra'), 'se a regra mudou, revise este teste');
});

test('a câmera do mapa da campanha nunca leva classe que o modo leve zera: o transform dela é a posição do mapa', () => {
  const pedacos = pedacosQueZeramTransform();
  const classes = [];
  // a classe com que nasce
  for (const m of WORLD.matchAll(/const cam = svg\('g', \{ class: '([^']+)'/g)) classes.push(...m[1].split(/\s+/));
  // as que ganha depois
  for (const m of WORLD.matchAll(/\bcam\.classList\.(?:add|toggle)\('([^']+)'/g)) classes.push(m[1]);
  assert.ok(classes.includes('w2-cam'), 'achei a câmera');
  const ruins = classes.filter((c) => pedacos.some((p) => c.includes(p)));
  assert.deepEqual(ruins, [], `o modo leve zeraria o transform da câmera (pedaços: ${pedacos.join(', ')})`);
  // e nenhuma regra do world.css anima a câmera por classe (a animação de entrada vai no <svg>, que não tem transform)
  assert.doesNotMatch(WORLD_CSS, /\.w2-cam\.[a-z-]+\s*\{[^}]*animation/);
});
