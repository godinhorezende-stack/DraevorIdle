// (09/11 — dono: "quero resolver os aproximados e parciais" dos modificadores de monstro) LOTE 5: o LOOT dos Tocados — os itens que o monstro solta viram
// moedas (pela raridade: 1/2/3/5, decisão do dono), carta, mapa (o Escaravelho também — o dono: "virar Mapas"), outra classe, gema; corrompidos, uma raridade acima,
// com o máximo de encaixes; os com qualidade viram a moeda de qualidade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Catalogo from '../systems/itens-poe/catalogo.mjs';

const SEM = !Catalogo.ligado() && 'só no jogo oficial (PoE)';
const { ITEM_CATALOG } = await import('../systems/dados.mjs');
const { iniciarJogoDoPoe } = await import('../systems/itens-poe/iniciar.mjs');
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Loot = await import('../systems/itens-poe/loot-dos-tocados.mjs');
const Cartas = await import('../systems/itens-poe/cartas.mjs');
const Mapas = await import('../systems/itens-poe/mapas.mjs');
if (!SEM) {
  await iniciarJogoDoPoe();
  Jogo.iniciar(ITEM_CATALOG);
}
const peca = (base, raridade = 'raro', ilvl = 70) => Jogo.pecaNaRaridade(base, raridade, ilvl, () => 0.5);

test('a moeda pela raridade: Comum 1, Mágica 2, Rara 3, Única 5 orbes do drop do jogo', { skip: SEM }, () => {
  assert.equal(Loot.converter(peca('Rings/Iron_Ring', 'normal'), { lootVira: 'moeda' }).moedas.length, 1);
  assert.equal(Loot.converter(peca('Rings/Iron_Ring', 'magico'), { lootVira: 'moeda' }).moedas.length, 2);
  const r = Loot.converter(peca('Rings/Iron_Ring', 'raro'), { lootVira: 'moeda' });
  assert.equal(r.moedas.length, 3);
  assert.deepEqual(r.pecas, [], 'a peça some');
  assert.ok(r.moedas.every((m) => Number.isFinite(m.id)));
});

test('carta, mapa e Escaravelho (vira Mapa); outra classe na mesma raridade', { skip: SEM }, () => {
  const c = Loot.converter(peca('Rings/Iron_Ring'), { lootVira: 'carta' }, { nivel: 70 });
  assert.ok(Cartas.ehCarta(c.moedas[0].id));
  for (const vira of ['mapa', 'escaravelho']) {
    const m = Loot.converter(peca('Rings/Iron_Ring'), { lootVira: vira }, { nivel: 70 });
    assert.equal(m.pecas[0].poe.classe, Mapas.CLASSE, vira);
  }
  assert.equal(Loot.tierDoNivel(40), 1, 'na campanha, o T1');
  assert.equal(Loot.tierDoNivel(70, 9), 9, 'no mapa, o tier da área');
  const anel = Loot.converter(peca('Amulets/Coral_Amulet', 'magico'), { lootVira: 'anel' }, { nivel: 70 });
  assert.equal(anel.pecas[0].poe.classe, 'Rings');
  assert.equal(anel.pecas[0].poe.raridade, 'magico');
});

test('corrompido, uma raridade acima (o Raro sem Único na base fica Raro) e o máximo de encaixes, sem ligar', { skip: SEM }, () => {
  assert.equal(Loot.converter(peca('Rings/Iron_Ring'), { lootCorrompido: true }).pecas[0].poe.corrompido, true);
  assert.equal(Loot.converter(peca('Rings/Iron_Ring', 'normal'), { lootRaridadeAcima: true }).pecas[0].poe.raridade, 'magico');
  assert.equal(Loot.converter(peca('Rings/Iron_Ring', 'magico'), { lootRaridadeAcima: true }).pecas[0].poe.raridade, 'raro');
  const armadura = peca('Body_Armours/Plate_Vest', 'normal', 70);
  armadura.soquetes = { abertos: 1, links: [], gemas: [null], cores: ['R'] };
  const cheia = Loot.converter(armadura, { lootSoquetesMax: true }).pecas[0];
  assert.equal(cheia.soquetes.abertos, 6);
  assert.equal(cheia.soquetes.links.filter(Boolean).length, 0, 'os novos não ligam');
  assert.equal(cheia.soquetes.cores.length, 6);
});

test('o modificador do arquivo diz o que o loot vira', () => {
  const d = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/modificadores-monstro.json', import.meta.url), 'utf8'));
  const por = (id) => d.mods.find((m) => m.id === id).stats;
  assert.equal(por('MonsterArchnemesisLunaris').lootVira, 'moeda');
  assert.equal(por('MonsterArchnemesisCorrupter_').lootCorrompido, 1);
  assert.equal(por('MonsterArchnemesisCorrupterMagic').lootCorrompido, undefined, 'o Mágico do Corrompedor tem 0');
});
