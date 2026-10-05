// Os chefes pináculo do PoE (só com ITENS_POE=1): registrados como boss único, no painel de Bosses, e a tabela exclusiva na vitória.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Pinaculos = await import('../systems/itens-poe/pinaculos.mjs');
const { bossUnico } = await import('../systems/bosses-unicos/catalogo.mjs');
const { ITEM_CATALOG, CATALOGO } = await import('../systems/dados.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';

test('os 11 chefes entram como boss único e no painel de Bosses, com a vida/dano/resistências do PoE', { skip: SEM }, () => {
  Jogo.iniciar(ITEM_CATALOG);
  const ids = Pinaculos.iniciar();
  assert.equal(ids.length, 11);
  const maven = bossUnico('poe-the-maven');
  assert.equal(maven.atributos.danoMult, 1.5);
  assert.equal(maven.atributos.resistencias.chaos, 30);
  const entrada = CATALOGO.bosses.find((b) => b.id === 'poe-the-maven');
  assert.ok(entrada?.boss && entrada.bossUnico === 'poe-the-maven' && entrada.limite);
  assert.equal(Pinaculos.iniciar().length, 11, 'iniciar de novo não duplica');
  assert.equal(CATALOGO.bosses.filter((b) => b.id === 'poe-the-maven').length, 1);
});

test('a tabela exclusiva: 1 Único só do chefe, como peça do jogo', { skip: SEM }, () => {
  Jogo.iniciar(ITEM_CATALOG);
  Pinaculos.iniciar();
  const slugs = new Set(Pinaculos.pinaculo('poe-the-shaper').unicos.map((u) => u.slug));
  for (let i = 0; i < 20; i++) {
    const p = Pinaculos.dropExclusivo('poe-the-shaper');
    assert.ok(p && ITEM_CATALOG[p.id]?.poe);
    assert.equal(p.poe.raridade, 'unico');
    assert.ok(slugs.has(p.poe.unico), p.poe.unico);
  }
  assert.equal(Pinaculos.dropExclusivo('nao-existe'), null);
});
