// A grade da MOCHILA mora dentro da janela do Inventário (`.inv-mochila`), e o cliente só redesenha as janelas de itens que estão abertas
// (`JANELAS_DA_BOLSA` + `desenharSeAberta`, client/src/main.mjs). A janela `container` (a mochila sozinha) nasce escondida: se o Inventário
// não redesenhar a grade junto, o que entra depois do primeiro desenho (o baú da recompensa, o que vem da bolsa de loot) não aparece até
// recarregar a página, e equipar deixa a peça desenhada na mochila — parecia duplicada (08/10; reproduzido e conferido num Chromium sem tela).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const MAIN = readFileSync(new URL('../frontend/client/src/main.mjs', import.meta.url), 'utf8');
const INVENTARIO = readFileSync(new URL('../frontend/client/src/inventory.mjs', import.meta.url), 'utf8');

test('o Inventário aberto redesenha a grade da mochila quando ela muda', () => {
  const bloco = MAIN.match(/const JANELAS_DA_BOLSA = \{([\s\S]*?)\n\};/)?.[1];
  assert.ok(bloco, 'achei JANELAS_DA_BOLSA');
  const doInventario = bloco.match(/\n\s*inventory:\s*([\s\S]*?)\n\s*container:/)?.[1] ?? '';
  assert.match(doInventario, /renderContainer\(\)/, 'a entrada do Inventário tem de chamar renderContainer');
});

test('a grade desenha no Inventário quando ele a tem (e só cai na janela `container` sem ele)', () => {
  assert.match(INVENTARIO, /const corpoDaMochila = \(\) => windowBody\('inventory'\)\?\.querySelector\(':scope > \.inv-mochila'\)/);
  assert.match(INVENTARIO, /const body = corpoDaMochila\(\) \?\? windowBody\('container'\);/);
});
