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

test('a luta: entrar na arena faz nascer o boss único (vida/dano do PoE) e a vitória põe na sacola o Único exclusivo e o drop do PoE', { skip: SEM }, async () => {
  const Cacadas = await import('../systems/cacadas.mjs');
  const Bau = await import('../systems/bau.mjs');
  const { vitoriaNoBoss } = await import('../systems/hunt/combate.mjs');
  const { personagemDeTeste, PERSONAGEM } = await import('./apoio.mjs');
  const { BESTIARY } = await import('../systems/hunt/monstros.mjs');
  Jogo.iniciar(ITEM_CATALOG);
  Pinaculos.iniciar();
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  const r = Cacadas.entrar(e, { huntId: 'poe-the-maven', mode: 'auto' });
  assert.equal(r.ok, true, r.erro);
  assert.equal(e.hunt.isBoss, true);
  const m = e.hunt.monstros.find((x) => x.boss);
  assert.ok(m, 'o boss único nasceu na arena');
  assert.equal(m.boss.id, 'poe-the-maven');
  assert.equal(m.name, 'The Maven');
  assert.equal(m.maxHp, Math.round(BESTIARY['the-brainstealer'].hp * bossUnico('poe-the-maven').atributos.vidaMult));
  assert.equal(m.resist.chaos, 30);
  Bau.garantir(e);
  const antes = e.rewards.length;
  vitoriaNoBoss(e, e.hunt, m, PERSONAGEM);
  assert.equal(e.rewards.length, antes + 1, 'uma sacola do boss');
  const itens = e.rewards.at(-1).itens;
  const doPoe = itens.filter((i) => i.poe);
  const slugs = new Set(Pinaculos.pinaculo('poe-the-maven').unicos.map((u) => u.slug));
  assert.ok(doPoe.some((i) => i.poe.raridade === 'unico' && slugs.has(i.poe.unico)), 'o Único exclusivo da Maven está na sacola');
  assert.ok(doPoe.length >= 5, `drop do PoE de monstro Único (4,72) + o exclusivo: ${doPoe.length}`);
});
