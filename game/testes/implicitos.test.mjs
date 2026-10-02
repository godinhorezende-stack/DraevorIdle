// Os IMPLÍCITOS (o que o catálogo dava a toda cópia de uma peça: perícia, crítico, dano crítico, leech, resistência, regeneração) saíram
// do jogo por decisão do dono (auditoria de balanceamento). Os atributos EXPLÍCITOS (os adds sorteados na peça), a base
// (ataque, defesa, armadura...), as raridades e os sockets continuam. Estes testes seguram a decisão: nenhum item volta a trazer
// implícito, e os explícitos seguem entrando na ficha.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import * as Ficha from '../systems/ficha.mjs';
import { metaDaPeca } from '../systems/itens/item.mjs';
import { personagemDeTeste } from './apoio.mjs';

const IMPLICITOS = ['skillBonus', 'critChance', 'critDamage', 'lifeLeech', 'manaLeech', 'protection', 'regen'];
const SLOTS = ['weapon', 'shield', 'head', 'body', 'legs', 'feet', 'ring', 'neck', 'backpack', 'ammo'];

test('nenhum item do catálogo traz implícito (nem os Crafted, nem os originais)', () => {
  const com = Object.values(ITEM_CATALOG).filter((i) => IMPLICITOS.some((c) => c in i));
  assert.deepEqual(com.slice(0, 5).map((i) => `${i.name}: ${IMPLICITOS.filter((c) => c in i)}`), [], `${com.length} itens ainda trazem implícito`);
});

test('a base das peças continua (ataque, armadura, defesa, alcance, elemento) — só os implícitos saíram', () => {
  const todos = Object.values(ITEM_CATALOG);
  assert.ok(todos.filter((i) => i.slot === 'weapon' && i.attack).length > 100, 'armas com ataque');
  assert.ok(todos.filter((i) => i.slot === 'body' && i.armor).length > 50, 'armaduras com armor');
  assert.ok(todos.filter((i) => i.slot === 'shield' && i.defense).length > 20, 'escudos com defesa');
  assert.ok(todos.filter((i) => i.element).length > 20, 'dano elemental da arma');
  assert.ok(todos.filter((i) => i.wand).length > 20, 'varinhas');
});

test('uma peça equipada de cada slot não dá perícia, crítico, leech, resistência nem regeneração', () => {
  for (const voc of ['knight', 'paladin', 'sorcerer', 'druid', 'monk']) {
    const e = personagemDeTeste({ vocacao: voc, level: 500 });
    e.equipment = {};
    for (const slot of SLOTS) {
      const it = Object.values(ITEM_CATALOG).find((i) => i.slot === slot && i.name.startsWith('Crafted Draevor') && i.name.endsWith('V2') && (!i.vocations || i.vocations.includes(voc)));
      if (it) e.equipment[slot] = { id: it.id };
    }
    assert.ok(Object.keys(e.equipment).length >= 8, `${voc}: o set V2 está montado`);
    const f = Ficha.combate(e);
    assert.deepEqual(Object.values(f.skillBonus ?? {}).filter((v) => v), [], `${voc}: perícia de item`);
    assert.equal(Number(f.critChance.toFixed(4)), 0.03, `${voc}: só o crítico base`);
    assert.equal(Number(f.critMultiplier.toFixed(4)), 1.6, `${voc}: só o multiplicador base`);
    assert.equal(f.lifeLeech, 0);
    assert.equal(f.manaLeech, 0);
    assert.ok(Object.values(f.protection).every((v) => v === 0), `${voc}: resistência de item ${JSON.stringify(f.protection)}`);
    assert.equal(f.regenFlat.hp, 0);
    assert.equal(f.regenFlat.mana, 0);
  }
});

test('os atributos EXPLÍCITOS da peça continuam entrando na ficha (crítico, leech, resistência, regeneração)', () => {
  const e = personagemDeTeste({ vocacao: 'knight', level: 300 });
  const arma = Object.values(ITEM_CATALOG).find((i) => i.slot === 'weapon' && i.skill === 'sword');
  const anel = Object.values(ITEM_CATALOG).find((i) => i.slot === 'ring');
  e.equipment = {
    weapon: { id: arma.id, af: [{ id: 'crit_chance', value: 5, nivel: 4 }, { id: 'life_leech', value: 4, nivel: 4 }] },
    ring: { id: anel.id, af: [{ id: 'phys_res', value: 9, nivel: 4 }, { id: 'life_regen', value: 15, nivel: 4 }] },
  };
  const f = Ficha.combate(e);
  assert.ok(Math.abs(f.critChance - 0.08) < 1e-9, `crítico ${f.critChance}`);
  assert.ok(Math.abs(f.lifeLeech - 0.04) < 1e-9, `leech ${f.lifeLeech}`);
  assert.equal(f.protection.physical, 9);
  assert.equal(f.regenFlat.hp, 15);
});

test('peça com base sorteada (instância) segue sem implícito: metaDaPeca junta só a base ao catálogo', () => {
  const arma = Object.values(ITEM_CATALOG).find((i) => i.slot === 'weapon' && i.name.startsWith('Crafted Draevor Knight'));
  const meta = metaDaPeca({ id: arma.id, base: { attack: [20, 30] } });
  assert.equal(meta.attack, 25);
  for (const c of IMPLICITOS) assert.equal(meta[c], undefined, c);
});

test('o balão do item e a comparação não têm mais o bloco "Implícitos" nem as linhas de implícito', async () => {
  const { readFileSync } = await import('node:fs');
  const fonte = readFileSync(new URL('../frontend/client/src/tooltip.mjs', import.meta.url), 'utf8');
  assert.ok(!/add\('Implícitos'/.test(fonte), 'o subtítulo Implícitos saiu');
  for (const c of ['meta.skillBonus', 'meta.critChance', 'meta.critDamage', 'meta.lifeLeech', 'meta.manaLeech', 'meta.protection', 'meta.regen']) assert.ok(!fonte.includes(c), `${c} saiu do balão`);
  const campos = JSON.parse(readFileSync(new URL('../gamedata/itens/campos.json', import.meta.url), 'utf8'));
  for (const c of ['critChance', 'critDamage', 'lifeLeech', 'manaLeech', 'regen.hp', 'regen.mana', 'protection.*', 'skillBonus.*']) assert.equal(campos.item[c], undefined, `${c} saiu da comparação de itens`);
});

test('o balão do item não anuncia cargas (a peça não gasta cargas ao aparar golpes)', async () => {
  const { readFileSync } = await import('node:fs');
  const fonte = readFileSync(new URL('../frontend/client/src/tooltip.mjs', import.meta.url), 'utf8');
  assert.ok(!fonte.includes('gasta uma a cada golpe'), 'a linha de cargas saiu');
  assert.ok(!/de \$\{desgastado\.total\} cargas/.test(fonte), 'nem a de "N de M cargas"');
});
