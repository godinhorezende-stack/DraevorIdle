import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { rolarBase, gerarItem } from '../systems/itens/gerar.mjs';
import { metaDaPeca, faixaDoCampo, baseValida } from '../systems/itens/item.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as C from '../systems/itens/config.mjs';
import * as Atributos from '../systems/personagem/atributos.mjs';
import { personagemDeTeste } from './apoio.mjs';

const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);

const arma = Object.values(ITEM_CATALOG).find((i) => i.slot === 'weapon' && !i.stackable && i.attack >= 10 && !i.wand);

test('a configuração é contínua: o maior piso possível é o menor teto possível, e o Comum nunca passa de 100%', () => {
  for (const r of C.RARIDADES.ordem) {
    const { piso, teto } = C.RARIDADES.raridades[r].base;
    assert.equal(piso[1], teto[0], `${r}: maior piso = menor teto`);
    assert.ok(piso[0] <= piso[1] && teto[0] <= teto[1], r);
  }
  assert.ok(C.RARIDADES.raridades.comum.base.teto[1] <= 1);
});

test('rolarBase: piso e teto dentro das faixas da raridade, e o teto NUNCA menor que o piso', () => {
  for (const r of C.RARIDADES.ordem) {
    const { piso, teto } = C.RARIDADES.raridades[r].base;
    for (let i = 0; i < 2000; i++) {
      const [p, t] = rolarBase(arma.id, r).attack;
      assert.ok(t >= p, `${r}: teto ${t} < piso ${p}`);
      assert.ok(p >= Math.max(1, Math.round(arma.attack * piso[0])) && p <= Math.round(arma.attack * piso[1]), `${r}: piso ${p}`);
      assert.ok(t <= Math.round(arma.attack * teto[1]), `${r}: teto ${t}`);
    }
  }
});

test('Comum nunca passa do valor do catálogo', () => {
  for (let i = 0; i < 2000; i++) assert.ok(rolarBase(arma.id, 'comum').attack[1] <= arma.attack);
});

test('raridade maior sobe o piso e o teto (as médias crescem)', () => {
  const media = (r) => {
    let soma = 0;
    for (let i = 0; i < 3000; i++) { const [p, t] = rolarBase(arma.id, r).attack; soma += (p + t) / 2; }
    return soma / 3000;
  };
  const medias = C.RARIDADES.ordem.map(media);
  for (let i = 1; i < medias.length; i++) assert.ok(medias[i] > medias[i - 1], `${C.RARIDADES.ordem[i]} > ${C.RARIDADES.ordem[i - 1]}`);
});

test('gerarItem grava a faixa na peça; metaDaPeca usa a média; sem base, o valor cheio', () => {
  const peca = gerarItem({ itemId: arma.id, raridade: 'épico', rng: () => 0 });
  const [p, t] = peca.base.attack;
  assert.equal(p, Math.round(arma.attack * 0.85));
  assert.equal(metaDaPeca(peca).attack, Math.round((p + t) / 2));
  assert.deepEqual(faixaDoCampo({ id: arma.id }, 'attack'), [arma.attack, arma.attack]);
  assert.equal(metaDaPeca({ id: arma.id, count: 1 }).attack, arma.attack);
});

test('baseValida aceita o número solto (peça antiga) e corrige teto < piso', () => {
  assert.deepEqual(baseValida({ attack: 21 }), { attack: [21, 21] });
  assert.deepEqual(baseValida({ attack: [20, 10], defense: 'x' }), { attack: [20, 20] });
});

test('ficha: o golpe sorteia entre o piso e o teto da arma; a ficha mostra a média', () => {
  const e = personagemDeTeste({ vocacao: 'knight' });
  e.equipment.weapon = { id: arma.id, count: 1, base: { attack: [10, 30] } };
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  assert.ok(f.ataqueMin < f.ataqueMax && f.ataque >= f.ataqueMin && f.ataque <= f.ataqueMax);
  const vistos = new Set();
  for (let i = 0; i < 400; i++) {
    const a = Ficha.ataqueDoGolpe(f);
    assert.ok(a >= f.ataqueMin && a <= f.ataqueMax);
    vistos.add(a);
  }
  assert.ok(vistos.size > 5, 'oscila de golpe em golpe');
});

test('ficha: bloqueio e armadura em faixa; a defesa da arma entra no bloqueio, com ou sem escudo', () => {
  const escudo = Object.values(ITEM_CATALOG).find((i) => i.slot === 'shield' && i.defense >= 10);
  const e = personagemDeTeste({ vocacao: 'knight' });
  e.equipment.shield = { id: escudo.id, count: 1, base: { defense: [escudo.defense, escudo.defense + 10] } };
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  assert.ok(f.blockChanceMin < f.blockChanceMax, 'faixa de bloqueio');
  assert.ok(f.blockChance >= f.blockChanceMin && f.blockChance <= f.blockChanceMax);
  assert.ok(f.armorMin <= f.armor && f.armor <= f.armorMax, 'faixa de armadura');

  e.equipment.weapon = { id: arma.id, count: 1, base: { defense: [40, 60] } };
  Ficha.invalidar(e);
  const comArma = Ficha.combate(e);
  assert.ok(comArma.blockChanceMax >= f.blockChanceMax, 'defesa da arma soma no bloqueio');

  // Sem escudo, a defesa da arma sozinha já bloqueia; tirando a defesa dela, o bloqueio cai.
  e.equipment.shield = null;
  Ficha.invalidar(e);
  const semEscudo = Ficha.combate(e);
  assert.ok(semEscudo.blockChance > 0, 'arma com defesa bloqueia sem escudo');
  e.equipment.weapon = { id: arma.id, count: 1, base: { defense: [0, 0] } };
  Ficha.invalidar(e);
  assert.ok(Ficha.combate(e).blockChance < semEscudo.blockChance, 'sem defesa na arma o bloqueio some (fica só o extra dela, se houver)');
});

const armadura = Object.values(ITEM_CATALOG).find((i) => i.armor >= 10 && i.slot && !i.stackable);

test('base de defesa pela vocação da peça: knight Armour, paladin Evasion, mago Energy Shield, monk/duas vocações híbrida', () => {
  const acha = (vs) => Object.values(ITEM_CATALOG).find((i) => i.slot === 'body' && i.armor >= 5 && !i.stackable && JSON.stringify([...(i.vocations ?? [])].sort()) === JSON.stringify([...vs].sort()));
  const casos = [
    [['knight'], ['armor']],
    [['paladin'], ['evasion']],
    [['sorcerer', 'druid'], ['es']],
  ];
  for (const [vs, campos] of casos) {
    const item = acha(vs);
    if (!item) continue;
    for (let i = 0; i < 200; i++) {
      const b = rolarBase(item.id, 'raro', Math.random, 500);
      for (const c of ['armor', 'evasion', 'es']) {
        const tem = (b[c]?.[1] ?? 0) > 0;
        assert.equal(tem, campos.includes(c), `${item.name} (${vs}): ${c}`);
      }
      assert.equal(b.marmor, undefined, 'a armadura mágica não existe mais');
    }
  }
  // Pela regra pura: vocações e peso.
  assert.deepEqual(Atributos.tiposDaBase({ vocations: ['monk'] }), ['armour', 'evasion']);
  assert.deepEqual(Atributos.tiposDaBase({ vocations: ['knight', 'paladin'] }), ['armour', 'evasion']);
  assert.deepEqual(Atributos.tiposDaBase({ vocations: ['knight', 'sorcerer'] }), ['armour', 'es']);
  assert.deepEqual(Atributos.tiposDaBase({ weight: 120 }), ['armour']);
  assert.deepEqual(Atributos.tiposDaBase({ weight: 30 }), ['evasion']);
  assert.deepEqual(Atributos.tiposDaBase({ weight: 60 }), ['armour', 'evasion']);
  // Evasion e ES crescem com o Item Level; a híbrida fica com 75% de cada.
  const baixo = Atributos.valoresDaBase(['es'], 10, 50).es;
  const alto = Atributos.valoresDaBase(['es'], 10, 1500).es;
  assert.ok(alto > baixo);
  assert.equal(Atributos.valoresDaBase(['armour', 'evasion'], 10, 100).armour, 7.5);
});

test('ficha: Armour, Evasion e Energy Shield somam das peças (base + adds + %); peça de ES não tem Armour', () => {
  const e = personagemDeTeste({ vocacao: 'sorcerer' });
  // O slot vazio antes (o manto do kit inicial já dá Energy Shield pelo tipo da base).
  e.equipment[armadura.slot] = null;
  Ficha.invalidar(e);
  const semPeca = Ficha.combate(e);
  e.equipment[armadura.slot] = { id: armadura.id, count: 1, base: { armor: [0, 0], es: [100, 140] } };
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  assert.equal(f.energyShield - semPeca.energyShield, 120);
  e.equipment.ring = { id: ANEL, count: 1, af: [{ id: 'energy_shield', nivel: 1, value: 30 }, { id: 'es_pct', nivel: 1, value: 10 }, { id: 'evasion', nivel: 1, value: 40 }] };
  Ficha.invalidar(e);
  const g = Ficha.combate(e);
  assert.equal(g.energyShield, Math.round((f.energyShield + 30) * 1.1));
  assert.ok(g.evasion > f.evasion);
  assert.equal(f.armor, semPeca.armor, 'peça de ES não soma Armour');
});

test('anel e amuleto sorteiam Armour (valor pelo nível quando o catálogo não tem)', () => {
  const joia = Object.values(ITEM_CATALOG).find((i) => (i.slot === 'neck' || i.slot === 'ring') && !i.stackable && !i.armor && i.minLevel >= 24);
  assert.ok(joia, 'há joia sem armadura no catálogo');
  const esperado = Math.max(2, Math.round(joia.minLevel / 12));
  let comArmadura = 0;
  for (let i = 0; i < 300; i++) {
    const b = rolarBase(joia.id, 'mítico');
    assert.equal(b.marmor, undefined);
    assert.equal(b.es, undefined);
    if (!(b.armor?.[1] > 0)) continue;
    comArmadura++;
    assert.ok(b.armor[1] <= Math.round(esperado * 1.6));
  }
  assert.ok(comArmadura > 150, 'a maioria dos Míticos traz armadura');
  const gerada = gerarItem({ itemId: joia.id, raridade: 'comum', rng: () => 0.6 });
  assert.ok(gerada.base?.armor, 'a peça carrega a armadura sorteada');
});

test('joia: pode vir sem nada, só armadura, só ataque ou os dois; Comum/Incomum nunca com armadura E ataque', () => {
  const joia = Object.values(ITEM_CATALOG).find((i) => i.slot === 'neck' && !i.stackable && !i.armor && i.minLevel >= 24);
  const ve = (r) => {
    const c = { nada: 0, armadura: 0, ataque: 0, ambos: 0 };
    for (let i = 0; i < 4000; i++) {
      const b = rolarBase(joia.id, r);
      const arm = (b.armor?.[1] ?? 0) > 0;
      const atk = !!b.attack;
      c[arm && atk ? 'ambos' : arm ? 'armadura' : atk ? 'ataque' : 'nada']++;
    }
    return c;
  };
  for (const r of ['comum', 'incomum']) {
    const c = ve(r);
    assert.equal(c.ambos, 0, `${r}: nunca os dois`);
    assert.ok(c.nada > 0 && c.armadura > 0 && c.ataque > 0, `${r}: os três resultados aparecem`);
  }
  assert.ok(ve('raro').ambos > 0);
  const m = ve('mítico');
  assert.equal(m.nada, 0, 'Mítico nunca vem sem nada');
});

test('ficha: o ataque do anel/amuleto soma ao da arma, em faixa', () => {
  const anel = Object.values(ITEM_CATALOG).find((i) => i.slot === 'ring' && !i.stackable);
  const e = personagemDeTeste({ vocacao: 'knight' });
  e.equipment.weapon = { id: arma.id, count: 1 };
  e.equipment.ring = null;
  Ficha.invalidar(e);
  const sem = Ficha.combate(e);
  e.equipment.ring = { id: anel.id, count: 1, base: { attack: [8, 12] } };
  Ficha.invalidar(e);
  const com = Ficha.combate(e);
  assert.equal(com.ataqueMin, sem.ataqueMin + 8);
  assert.equal(com.ataqueMax, sem.ataqueMax + 12);
  assert.ok(com.ataque > sem.ataque);
});

test('migração: peça antiga sorteia a faixa pela raridade que já tem; estável nas leituras; munição também', async () => {
  const Item = await import('../systems/itens/item.mjs');
  const antiga = () => ({ id: arma.id, count: 1, raridade: 'épico', af: [] });
  const a = antiga();
  assert.equal(Item.sortearFaixa(a), true);
  const { piso, teto } = C.RARIDADES.raridades['épico'].base;
  const [p, t] = a.base.attack;
  assert.ok(p >= Math.round(arma.attack * piso[0]) && t <= Math.round(arma.attack * teto[1]) && t >= p);
  assert.equal(Item.sortearFaixa(a), false, 'idempotente: já tem faixa');
  // Sorteio repetível (baú/mercado/depósito lidos de novo): a mesma peça leva a mesma faixa.
  const x = antiga();
  const y = antiga();
  Item.sortearFaixa(x);
  Item.sortearFaixa(y);
  assert.deepEqual(x.base, y.base);
  // Munição: sorteia a faixa como a arma (o ataque dela soma ao do arco, em faixa).
  const municao = Object.values(ITEM_CATALOG).find((i) => i.slot === 'ammo' && i.attack >= 10);
  const m = { id: municao.id, count: 1, raridade: 'raro' };
  assert.equal(Item.sortearFaixa(m), true);
  assert.ok(m.base.attack[1] >= m.base.attack[0] && m.base.attack[0] >= 1);
});

test('ficha: a faixa da munição soma ao arco (que não tem ataque próprio)', () => {
  const arco = Object.values(ITEM_CATALOG).find((i) => i.slot === 'weapon' && i.ammo === 'arrow' && !i.attack);
  const flecha = Object.values(ITEM_CATALOG).find((i) => i.slot === 'ammo' && i.ammo === 'arrow' && i.attack >= 10);
  const e = personagemDeTeste({ vocacao: 'paladin' });
  e.equipment.weapon = { id: arco.id, count: 1 };
  e.equipment.ammo = { id: flecha.id, count: 1, base: { attack: [10, 20] } };
  Ficha.invalidar(e);
  const f = Ficha.combate(e);
  assert.equal(f.ataqueMin, 10);
  assert.equal(f.ataqueMax, 20);
  assert.equal(f.ataque, 15);
});

test('bolsa de loot: a peça que cai leva a faixa (`base`) para a bolsa, com ou sem atributo', async () => {
  const Bolsa = await import('../systems/bolsa.mjs');
  const e = personagemDeTeste({ vocacao: 'knight' });
  e.pouch = [];
  // Sem atributo (Comum) — antes virava {id, count} pelado e perdia a faixa.
  const comum = gerarItem({ itemId: arma.id, raridade: 'comum', rng: () => 0.3 });
  assert.ok(comum.base?.attack, 'o gerador dá a faixa');
  assert.equal(Bolsa.porNaBolsa(e, arma.id, 1, comum), 1);
  assert.deepEqual(e.pouch[0].base, comum.base);
  assert.equal(e.pouch[0].raridade, 'comum');
  // E o Item Level do drop (sem ele o balão mostrava o nível do item-base).
  assert.equal(e.pouch[0].ilvl, comum.ilvl);
  const daFase = gerarItem({ itemId: arma.id, itemLevel: 777, raridade: 'raro', rng: () => 0.6 });
  Bolsa.porNaBolsa(e, arma.id, 1, daFase);
  assert.equal(e.pouch.at(-1).ilvl, 777);
  // Com atributo (Raro).
  const raro = gerarItem({ itemId: arma.id, raridade: 'raro', rng: () => 0.6 });
  Bolsa.porNaBolsa(e, arma.id, 1, raro);
  assert.deepEqual(e.pouch.at(-1).base, raro.base);
  assert.deepEqual(e.pouch.at(-1).af, raro.af);
});
