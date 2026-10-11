// O importador de itens do PoE (`tools/importar-poe-itens.mjs`) refaz `icones-itens/` com as imagens do catálogo, mas a mesma pasta guarda
// os ícones dos MAPAS do endgame (`poe-itens/Mapas/`), gravados por outros tools e referenciados por `mapas.json`. Rodar o importador
// apagava os 458 ícones dos Mapas (11/10): aqui ele roda numa pasta temporária e a subpasta dos Mapas tem de sobreviver intacta, enquanto
// o que é do catálogo continua sendo refeito (a imagem que saiu do catálogo some; a que está nele é copiada da coleção).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copiarImagens, imagensDoCatalogo, PASTAS_DE_OUTROS_TOOLS } from '../../tools/importar-poe-itens.mjs';

const pasta = mkdtempSync(join(tmpdir(), 'importador-imagens-'));
after(() => rmSync(pasta, { recursive: true, force: true }));

const gravar = (arq, conteudo) => {
  mkdirSync(dirname(arq), { recursive: true });
  writeFileSync(arq, conteudo);
};

test('copiarImagens refaz as imagens do catálogo e não apaga os ícones dos Mapas', () => {
  const original = join(pasta, 'original');
  const destino = join(pasta, 'icones-itens');
  gravar(join(original, 'poe-itens/Armadura/Elmos/bases/Elmo.png'), 'elmo novo');
  gravar(join(original, 'poe-itens/Joias/unicos/Joia.png'), 'joia');
  // O que já estava em `icones-itens/`: os Mapas (de outros tools) e imagens do catálogo, uma delas que saiu dele.
  const mapas = {
    'poe-itens/Mapas/icones/Map_Tier_1.png': 'tier 1',
    'poe-itens/Mapas/icones/Map_Tier_16.png': 'tier 16',
    'poe-itens/Mapas/unicos/Hallowed_Ground.png': 'desenho',
    'poe-itens/Mapas/unicos/Hallowed_Ground_T5.png': 'desenho com o V',
  };
  for (const [rel, conteudo] of Object.entries(mapas)) gravar(join(destino, rel), conteudo);
  gravar(join(destino, 'poe-itens/Armadura/Elmos/bases/Elmo.png'), 'elmo velho');
  gravar(join(destino, 'poe-itens/Armadura/Elmos/bases/Saiu_do_Catalogo.png'), 'velho');
  gravar(join(destino, 'poe-itens/Classe_Que_Saiu/x.png'), 'velho');

  const catalogo = { classes: { Elmos: { bases: [{ icone: 'poe-itens/Armadura/Elmos/bases/Elmo.png' }, { icone: '/poe-itens/Armadura/Elmos/bases/Falta.png' }] }, Joias: { unicos: [{ icone: 'poe-itens/Joias/unicos/Joia.png' }] } } };
  const r = copiarImagens(catalogo, { destino, original });

  for (const [rel, conteudo] of Object.entries(mapas)) assert.equal(readFileSync(join(destino, rel), 'utf8'), conteudo, `${rel} sobrevive intacto`);
  assert.equal(readFileSync(join(destino, 'poe-itens/Armadura/Elmos/bases/Elmo.png'), 'utf8'), 'elmo novo', 'a imagem do catálogo vem da coleção');
  assert.equal(readFileSync(join(destino, 'poe-itens/Joias/unicos/Joia.png'), 'utf8'), 'joia');
  assert.ok(!existsSync(join(destino, 'poe-itens/Armadura/Elmos/bases/Saiu_do_Catalogo.png')), 'a imagem que saiu do catálogo é apagada');
  assert.ok(!existsSync(join(destino, 'poe-itens/Classe_Que_Saiu')), 'a pasta que saiu do catálogo é apagada');
  assert.equal(r.copiadas, 2);
  assert.deepEqual(r.faltando, ['poe-itens/Armadura/Elmos/bases/Falta.png']);
});

test('copiarImagens cria a pasta de destino quando ela não existe', () => {
  const original = join(pasta, 'original-2');
  const destino = join(pasta, 'nao-existe', 'icones-itens');
  gravar(join(original, 'poe-itens/Frascos/bases/Frasco.png'), 'frasco');
  const r = copiarImagens({ icone: 'poe-itens/Frascos/bases/Frasco.png' }, { destino, original });
  assert.equal(r.copiadas, 1);
  assert.equal(readFileSync(join(destino, 'poe-itens/Frascos/bases/Frasco.png'), 'utf8'), 'frasco');
});

test('os ícones que mapas.json usa ficam nas pastas preservadas, e o catálogo não tem imagem nelas', () => {
  const itensPoe = fileURLToPath(new URL('../gamedata/itens-poe/', import.meta.url));
  const dentro = (rel) => PASTAS_DE_OUTROS_TOOLS.some((p) => rel === p || rel.startsWith(`${p}/`));
  // Os `<Único>_T<N>.png` não aparecem em mapas.json (o nome é montado), mas ficam na mesma pasta do desenho que aparece.
  const dosMapas = imagensDoCatalogo(JSON.parse(readFileSync(join(itensPoe, 'mapas.json'), 'utf8')));
  assert.ok(dosMapas.length > 0, 'mapas.json referencia ícones');
  assert.deepEqual(dosMapas.filter((rel) => !dentro(rel)), [], 'todo ícone de mapas.json está numa pasta preservada');
  const doCatalogo = imagensDoCatalogo(JSON.parse(readFileSync(join(itensPoe, 'catalogo-itens.json'), 'utf8')));
  assert.deepEqual(doCatalogo.filter(dentro), [], 'o catálogo não grava por cima dos ícones de outros tools');
});
