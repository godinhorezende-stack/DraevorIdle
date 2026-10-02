// O conteúdo secreto (encontros, bosses únicos, índice do WORLD) NUNCA é servido como arquivo estático.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { ehPrivado } from '../backend/privados.mjs';

test('os arquivos do conteúdo secreto são privados; o resto de gamedata continua público', () => {
  for (const p of ['encontros/troll-cave.json', 'encontros/qualquer-coisa.json', 'encontros/', 'encontros.json', 'bosses-unicos.json', 'campanha-conteudo.json']) assert.equal(ehPrivado(p), true, p);
  for (const p of ['campanha.json', 'hunts/troll-cave-map.json', 'item-catalog.json', 'sprites/city.png', 'boss-poderes.json', 'encontros-nada.json.bak', 'meu-encontros/x.json']) assert.equal(ehPrivado(p), false, p);
});

test('todo arquivo de conteudo que o jogo cria em gamedata/ está coberto pela lista de privados (não esquecer um novo)', () => {
  for (const n of readdirSync(new URL('../gamedata/encontros/', import.meta.url))) assert.equal(ehPrivado(`encontros/${n}`), true, n);
  // O código do servidor não pode servir de volta o que o editor grava: as rotas do editor ficam sob o prefixo trancado.
  const index = readFileSync(new URL('../backend/index.mjs', import.meta.url), 'utf8');
  assert.match(index, /ehPrivado\(/, 'o servidor estático consulta a lista de privados');
});
