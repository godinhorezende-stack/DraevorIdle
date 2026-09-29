import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { rolarBase, gerarItem } from '../systems/itens/gerar.mjs';
import { metaDaPeca, faixaDoCampo, baseValida } from '../systems/itens/item.mjs';
import * as Ficha from '../systems/ficha.mjs';
import * as C from '../systems/itens/config.mjs';
import { personagemDeTeste } from './apoio.mjs';

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

test('ficha: bloqueio e armadura em faixa; a defesa da arma entra no bloqueio; sem escudo é 0%', () => {
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

  e.equipment.shield = null;
  Ficha.invalidar(e);
  const semEscudo = Ficha.combate(e);
  assert.equal(semEscudo.blockChance, 0);
  assert.equal(semEscudo.blockChanceMax, 0);
});
