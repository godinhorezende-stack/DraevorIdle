// Os SOCKETS das peças do PoE (regra do dono, 05/10 — itens-poe/regras.json → sockets): o máximo pela classe (Capacete/Luvas/Botas 4,
// Armadura 6, Escudo e armas de 1 mão 3, armas de 2 mãos e arco 6) e pelo item level (3 no 2, 4 no 25, 5 no 35, 6 no 50); a peça que cai
// sorteia de 0 ao máximo, totalmente ao acaso, e os links nunca passam dos sockets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const S = await import('../systems/itens-poe/sockets.mjs');
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test('o máximo pela classe e pelo item level', () => {
  const casos = { Helmets: 4, Body_Armours: 6, Gloves: 4, Boots: 4, Shields: 3, One_Hand_Swords: 3, One_Hand_Axes: 3, One_Hand_Maces: 3, Daggers: 3, Wands: 3, Sceptres: 3, Two_Hand_Swords: 6, Two_Hand_Axes: 6, Two_Hand_Maces: 6, Staves: 6, Bows: 6, Rings: 0, Amulets: 0, Belts: 0, Quivers: 0 };
  for (const [c, n] of Object.entries(casos)) assert.equal(S.maximo(c, 84), n, c);
  assert.deepEqual([1, 2, 24, 25, 34, 35, 49, 50].map((i) => S.maximo('Body_Armours', i)), [2, 3, 3, 4, 4, 5, 5, 6]);
  assert.equal(S.maximo('Wands', 60), 3, 'a classe limita mesmo com item level alto');
});

test('o sorteio: de 0 ao máximo, todas as quantidades saem, links só entre sockets abertos', () => {
  const rng = semente(11);
  const vistos = new Set();
  for (let i = 0; i < 3000; i++) {
    const s = S.sortear('Body_Armours', 60, rng);
    assert.equal(s.gemas.length, 6);
    assert.ok(s.abertos >= 0 && s.abertos <= 6);
    vistos.add(s.abertos);
    s.links.forEach((l, k) => { if (l) assert.ok(k + 1 < s.abertos, 'link fora dos sockets abertos'); });
  }
  assert.deepEqual([...vistos].sort(), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(S.sortear('Rings', 60, rng), null);
  assert.equal(S.sortear('Body_Armours', 1, () => 0.999).abertos, 2, 'item level 1: no máximo 2');
});

test('a peça do PoE que cai leva os sockets; o sistema de gemas usa o máximo DELA (classe + item level)', { skip: SEM }, async () => {
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const Jogo = await import('../systems/itens-poe/jogo.mjs');
  const Gemas = await import('../systems/skills/gemas.mjs');
  Jogo.iniciar(ITEM_CATALOG);
  const rng = semente(5);
  let comSocket = 0;
  for (let i = 0; i < 300; i++) {
    const p = Jogo.pecaSorteada(30, rng);
    if (!p) continue;
    const max = S.maximo(p.poe.classe, p.poe.ilvl);
    assert.equal(Gemas.soquetesDe(p)?.max ?? 0, max, p.poe.base);
    if (p.soquetes) {
      comSocket++;
      assert.equal(p.soquetes.gemas.length, max);
    }
  }
  assert.ok(comSocket > 50);
  // A arma inicial (item level 1) também tem sockets, até 2.
  assert.ok(Jogo.armaInicial('marauder').soquetes.gemas.length <= 2);
});

test('as bases "Royale" (modo Battle Royale do PoE) não caem', { skip: SEM }, async () => {
  const { ITEM_CATALOG } = await import('../systems/dados.mjs');
  const Jogo = await import('../systems/itens-poe/jogo.mjs');
  Jogo.iniciar(ITEM_CATALOG);
  const rng = semente(21);
  for (let i = 0; i < 4000; i++) {
    const p = Jogo.pecaSorteada(1 + (i % 70), rng);
    if (p) assert.ok(!p.poe.base.includes('/Royale_'), p.poe.base);
  }
});
