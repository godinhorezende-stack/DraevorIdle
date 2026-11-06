// (06/11, dono: "Cadeia completa", "Chefes de mapa", "Tier pelo peso") As Partes do Emissário (Harbinger) e o Ducado de Ukatoa, os dois itens do
// poedb que tinham ficado de fora: as Partes de um conjunto formam o único base do Emissário, o Pergaminho dele vira o aprimorado (os 12 únicos
// não caem de outro jeito, como no PoE), o Ducado põe um implícito sobrenatural num amuleto não Único, e os três caem dos chefes de mapa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

process.env.ITENS_POE = '1';
const Catalogo = await import('../systems/itens-poe/catalogo.mjs');
const SEM = !existsSync(Catalogo.ARQUIVO) && 'catálogo do PoE não importado nesta máquina';
await import('../systems/dados.mjs');
if (!SEM) await (await import('../systems/itens-poe/iniciar.mjs')).iniciarJogoDoPoe();
const Jogo = await import('../systems/itens-poe/jogo.mjs');
const Moedas = await import('../systems/itens-poe/moedas.mjs');
const Traduzir = await import('../systems/itens-poe/traduzir.mjs');
const { BUFFS } = await import('../systems/itens-poe/condicoes-poe.mjs');
const { gerarPeca, UNICOS_SO_DA_CADEIA } = await import('../systems/itens-poe/gerar.mjs');
const semente = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const id = (slug) => Moedas.idDa(slug);

test('as 18 Partes, os 6 Pergaminhos e o Ducado estão no jogo e funcionam', { skip: SEM }, () => {
  const slugs = [...Moedas.EMISSARIO.flatMap((c) => [...c.partes, c.pergaminho]), 'Ukatoas_Ducat'];
  assert.equal(slugs.length, 25);
  for (const s of slugs) {
    assert.ok(id(s), `${s} sem id`);
    assert.equal(Moedas.STATUS[s].status, 'funciona', s);
  }
  assert.equal(Moedas.EMISSARIO.flatMap((c) => c.partes).length, 18);
});

test('as Partes juntas formam o único base; falta uma, não formam', { skip: SEM }, () => {
  const [a, b, c] = Moedas.EMISSARIO[0].partes;
  const estado = { level: 70, inventory: [{ id: id(a), count: 1 }, { id: id(b), count: 1 }], equipment: {} };
  const r1 = Moedas.usar(estado, { moeda: id(a) }, semente(2));
  assert.equal(r1.ok, false);
  assert.match(r1.erro, /Terceira Peça do Arcano/);
  estado.inventory.push({ id: id(c), count: 1 });
  const r2 = Moedas.usar(estado, { moeda: id(b) }, semente(3));
  assert.equal(r2.ok, true);
  assert.equal(estado.inventory.length, 1);
  assert.equal(estado.inventory[0].poe.unico, 'The_Rippling_Thoughts');
  assert.equal(estado.inventory[0].poe.ilvl, 70);
});

test('o Pergaminho aprimora o único base do conjunto dele (e só ele), e os encaixes ficam', { skip: SEM }, () => {
  const cat = Catalogo.catalogo();
  for (const c of Moedas.EMISSARIO) {
    const classe = Object.values(cat.classes).find((x) => x.unicos?.some((u) => u.slug === c.base));
    const u = classe.unicos.find((x) => x.slug === c.base);
    const base = classe.bases.find((x) => x.nome === u.base);
    const peca = Jogo.pecaDoJogo(gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base: base.id, raridade: 'unico', ilvl: 80, rng: semente(4), unico: c.base }), Catalogo.REGRAS, semente(5));
    const soquetes = structuredClone(peca.soquetes ?? null);
    const outro = Moedas.EMISSARIO.find((x) => x !== c).pergaminho;
    const estado = { level: 80, inventory: [peca, { id: id(c.pergaminho), count: 1 }, { id: id(outro), count: 1 }], equipment: {} };
    assert.equal(Moedas.usar(estado, { moeda: id(outro), alvo: { onde: 'inventory', indice: 0 } }, semente(6)).ok, false, `${outro} em ${c.base}`);
    const r = Moedas.usar(estado, { moeda: id(c.pergaminho), alvo: { onde: 'inventory', indice: 0 } }, semente(7));
    assert.equal(r.ok, true, c.pergaminho);
    assert.equal(peca.poe.unico, c.aprimorado);
    assert.deepEqual(peca.soquetes ?? null, soquetes);
    assert.equal(Moedas.quantasTem(estado, id(c.pergaminho)), 0);
  }
});

test('os 12 únicos do Emissário não caem nem saem da Chance; pelo nome, saem', { skip: SEM }, () => {
  const cat = Catalogo.catalogo();
  const rng = semente(8);
  for (const base of ['One_Hand_Swords/Legion_Sword', 'Belts/Cloth_Belt', 'Quivers/Blunt_Arrow_Quiver', 'Helmets/Callous_Mask', 'Shields/Archon_Kite_Shield', 'Staves/Imperial_Staff']) {
    for (let i = 0; i < 200; i++) {
      const g = gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base, raridade: 'unico', ilvl: 84, rng });
      assert.ok(!g.erro, `${base}: ${g.erro}`);
      assert.ok(!UNICOS_SO_DA_CADEIA.has(g.unico), `${base} sorteou ${g.unico}`);
    }
  }
  // (a Máscara Insensível ainda tem o Olho da Malícia: o drop Único dela continua)
  const c = cat.classes.Helmets;
  assert.equal(Jogo.podeCairComo(c, c.bases.find((b) => b.id === 'Helmets/Callous_Mask'), 'unico'), true);
  for (const s of UNICOS_SO_DA_CADEIA) assert.ok(Object.values(cat.classes).some((x) => x.unicos?.some((u) => u.slug === s)), `${s} no catálogo`);
});

test('o Ducado de Ukatoa: amuleto não Único, Exarca ou Devorador, tier pelos pesos, uma vez só', { skip: SEM }, () => {
  const cat = Catalogo.catalogo();
  const rng = semente(9);
  const amuleto = (raridade, ilvl) => Jogo.pecaDoJogo(gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base: 'Amulets/Gold_Amulet', raridade, ilvl, rng }), Catalogo.REGRAS, rng);
  const usar = (peca) => {
    const estado = { level: 80, inventory: [peca, { id: id('Ukatoas_Ducat'), count: 1 }], equipment: {} };
    return Moedas.usar(estado, { moeda: id('Ukatoas_Ducat'), alvo: { onde: 'inventory', indice: 0 } }, rng);
  };
  const pools = new Set();
  const degraus = new Set();
  for (let i = 0; i < 200; i++) {
    const a = amuleto('raro', 84);
    assert.equal(usar(a).ok, true);
    assert.equal(a.poe.implicitos.length, 1);
    const m = a.poe.implicitos[0];
    pools.add(m.origem);
    degraus.add(m.degrau);
    assert.ok(!/Conflito/.test(m.nome), m.nome);
    if (i === 0) assert.equal(usar(a).ok, false); // (já tem um)
  }
  assert.deepEqual([...pools].sort(), ['eater', 'searing']);
  assert.deepEqual([...degraus].sort(), [1, 2, 3, 4]);
  assert.equal(usar(amuleto('raro', 40)).ok, false); // (o item level pedido: 75)
  const anel = Jogo.pecaDoJogo(gerarPeca({ catalogo: cat, regras: Catalogo.REGRAS, base: 'Rings/Gold_Ring', raridade: 'raro', ilvl: 84, rng }), Catalogo.REGRAS, rng);
  assert.equal(usar(anel).ok, false);
});

test('os chefes de mapa soltam Partes, Pergaminhos e o Ducado nas chances de regras.json', { skip: SEM }, () => {
  const cfg = Catalogo.REGRAS.moedas.chefeDeMapa;
  const rng = semente(10);
  const n = 40000;
  const conta = { parte: 0, pergaminho: 0, ducado: 0 };
  const partes = new Set(Moedas.EMISSARIO.flatMap((c) => c.partes).map(id));
  const pergaminhos = new Set(Moedas.EMISSARIO.map((c) => c.pergaminho).map(id));
  for (let i = 0; i < n; i++) {
    for (const x of Moedas.dropDoChefeDeMapa(rng)) {
      if (partes.has(x)) conta.parte++;
      else if (pergaminhos.has(x)) conta.pergaminho++;
      else if (x === id('Ukatoas_Ducat')) conta.ducado++;
      else assert.fail(`id inesperado ${x}`);
    }
  }
  assert.ok(Math.abs(conta.parte / n - cfg.chanceDaParte) < 0.006, `${conta.parte}`);
  assert.ok(Math.abs(conta.pergaminho / n - cfg.chanceDoPergaminho) < 0.004, `${conta.pergaminho}`);
  assert.ok(Math.abs(conta.ducado / n - cfg.chanceDoUkatoa) < 0.004, `${conta.ducado}`);
});

test('os únicos novos: o Emissário das Direções menor (+1) e as linhas da Divinação Destilada valem', { skip: SEM }, () => {
  const t = (texto) => {
    const nums = [];
    const modelo = texto.replace(/-?\d+(?:[.,]\d+)?/g, (m) => { nums.push(Number(m)); return `{${nums.length - 1}}`; });
    return Traduzir.traduzirMod({ modelo, valores: nums });
  };
  assert.deepEqual(t('Concede a Habilidade Convocar Emissário das Direções').efeitos, [{ stat: 'emissario_direcoes_menor', valor: 1 }]);
  assert.deepEqual(t('Raridade dos Itens encontrados aumentada em 40% durante o Efeito').efeitos, [{ stat: 'item_rarity', valor: 40 }]);
  assert.deepEqual(t('+10% de Resistências Elementais durante o Efeito').efeitos.map((e) => e.stat), ['fire_res', 'ice_res', 'energy_res']);
  // (lote 6 das inertes, 06/11: o Emissário do Tempo passou a valer — era 'inerte')
  assert.equal(t('Concede a Habilidade Convocar Emissário do Tempo').estado, 'aproximado');
  assert.equal(BUFFS.emissarioMenorTodos.af.extra_projectiles, 1);
  assert.equal(BUFFS.emissarioTodos.af.extra_projectiles, 2);
});
