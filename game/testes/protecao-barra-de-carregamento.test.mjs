// A BARRA da cortina "Carregando" (`#viagem`, main.mjs → `mostrarViagem`) anda SEMPRE (dono, 12/10: "aqui não tá efeito da barra
// carregando, tá meio estático"). O modo leve (que o jogo liga sozinho abaixo de 40 quadros — `vigiarLentidao`) apagava toda animação
// (`body.sem-animacao *`) e a janela sem foco pausava todas (`body.sem-foco *`): a faixa ficava parada no começo do trilho, como se o
// jogo tivesse travado. Conferido no navegador sem tela (a posição da faixa em dois momentos): antes, parada nos dois modos; agora anda.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CSS = readFileSync(new URL('../frontend/client/style.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
/** O corpo da regra cujo seletor é exatamente a lista dada (sem os comentários). */
function regra(seletores) {
  const alvo = seletores.join(',').replace(/\s+/g, '');
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (m[1].replace(/\s+/g, '') === alvo) return m[2];
  return null;
}

test('a faixa da cortina "Carregando" anda no modo leve e com a janela sem foco (o resto das animações continua apagado/pausado)', () => {
  const corpo = regra(['body.sem-animacao #viagem .viagem-trilho i', 'body.sem-foco #viagem .viagem-trilho i']);
  assert.ok(corpo, 'a regra de exceção existe');
  assert.match(corpo, /animation:\s*viagem-corre[^;]*infinite\s*!important/, 'a animação volta, por cima do `animation: none !important`');
  assert.match(corpo, /animation-play-state:\s*running\s*!important/, 'e não fica pausada sem foco');
  // As regras gerais continuam: o modo leve apaga o enfeite e a janela sem foco pausa.
  assert.match(CSS, /body\.sem-animacao \*,[\s\S]*?animation:\s*none\s*!important/);
  assert.match(CSS, /body\.sem-foco \*,[\s\S]*?animation-play-state:\s*paused\s*!important/);
  // A faixa anda por `transform` (o navegador não repinta a tela) e existe a animação dela.
  assert.match(CSS, /@keyframes viagem-corre\s*\{[^}]*translateX/);
});

test('quem pede menos movimento no sistema vê a faixa pulsar (parada parecia o jogo travado)', () => {
  assert.match(CSS, /@keyframes viagem-pulsa/);
  const reduz = CSS.match(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*#viagem \{ animation: none; \}\s*\.viagem-trilho i \{([^}]*)\}/);
  assert.ok(reduz, 'a regra de movimento reduzido da cortina');
  assert.match(reduz[1], /animation:\s*viagem-pulsa/);
});
