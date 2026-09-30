// Comparar uma peça com a vestida (systems/itens/comparar.mjs): por TODOS os
// atributos (registro central) e pelo impacto na ficha do personagem (o mesmo
// `Ficha.combate` do combate) — sem campo escrito no código.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Comparar from '../systems/itens/comparar.mjs';
import { ATRIBUTOS } from '../systems/itens/config.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import { personagemDeTeste } from './apoio.mjs';

function knight() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  const arma = e.equipment.weapon.id;
  e.equipment.weapon = { id: arma, count: 1, raridade: 'raro', af: [{ id: 'atk_flat', nivel: 5, value: 18 }, { id: 'death_dmg', nivel: 2, value: 5 }, { id: 'crit_chance', nivel: 1, value: 1 }] };
  return { e, arma };
}
const linha = (lista, chave) => lista.find((l) => l.chave === chave);

test('a Espada B com MENOS ataque aparece melhor no que ela é melhor: todos os atributos entram', () => {
  const { e, arma } = knight();
  const r = Comparar.comparar(e, { id: arma, af: [{ id: 'atk_flat', nivel: 3, value: 8 }, { id: 'death_dmg', nivel: 5, value: 14 }, { id: 'crit_chance', nivel: 4, value: 4 }, { id: 'fire_res', nivel: 3, value: 6 }] });
  assert.equal(r.ok, true);
  assert.equal(linha(r.atributos, 'af:atk_flat').delta, -10);
  assert.equal(linha(r.atributos, 'af:death_dmg').delta, 9);
  assert.equal(linha(r.atributos, 'af:crit_chance').delta, 3);
  assert.equal(linha(r.atributos, 'af:fire_res').delta, 6, 'atributo que a vestida nem tinha');
  // No personagem, pelo cálculo da ficha: o ataque cai, o crítico e o dano de morte sobem.
  assert.ok(linha(r.personagem, 'ataque').delta < 0);
  assert.ok(Math.abs(linha(r.personagem, 'critChance').delta - 3) < 1e-6);
  assert.equal(linha(r.personagem, 'danoDoElemento.death').delta, 9);
  assert.equal(linha(r.personagem, 'protection.fire').delta, 6);
});

test('um atributo NOVO no registro aparece sozinho, sem mexer na comparação', () => {
  const { e, arma } = knight();
  ATRIBUTOS.lightning_dmg_teste = { nome: 'Dano de Relâmpago', tipo: 'pct', niveis: { 1: [1, 2], 2: [2, 3], 3: [3, 4], 4: [4, 5], 5: [5, 6] } };
  try {
    const r = Comparar.comparar(e, { id: arma, af: [...e.equipment.weapon.af, { id: 'lightning_dmg_teste', nivel: 3, value: 15 }] });
    const l = linha(r.atributos, 'af:lightning_dmg_teste');
    assert.ok(l, 'o atributo novo não apareceu');
    assert.equal(l.nome, 'Dano de Relâmpago');
    assert.equal(l.sufixo, '%');
    assert.equal(l.delta, 15);
  } finally {
    delete ATRIBUTOS.lightning_dmg_teste;
  }
});

test('vida máxima entra no impacto (passa por sincronizarMaximos, fora da ficha de combate); o estado de verdade não muda', () => {
  const { e, arma } = knight();
  const antes = JSON.stringify(e);
  const r = Comparar.comparar(e, { id: arma, af: [...e.equipment.weapon.af, { id: 'life', nivel: 5, value: 500 }] });
  assert.ok(linha(r.personagem, 'vidaMaxima').delta > 0);
  assert.equal(JSON.stringify(e), antes, 'comparar não pode mexer no personagem');
});

test('a mesma peça dá lista vazia; arma de duas mãos avisa que o escudo sai; item que não se veste é recusado', () => {
  const { e } = knight();
  const w = e.equipment.weapon;
  const igual = Comparar.comparar(e, { id: w.id, af: w.af });
  assert.deepEqual([igual.atributos.length, igual.personagem.length], [0, 0]);
  const duas = Object.values(ITEM_CATALOG).find((i) => i.slot === 'weapon' && i.twoHanded);
  assert.equal(Comparar.comparar(e, { id: duas.id }).tiraOEscudo, true);
  const pocao = Object.values(ITEM_CATALOG).find((i) => i.stackable && !i.slot);
  assert.equal(Comparar.comparar(e, { id: pocao.id }).ok, false);
});

test('"AO EQUIPAR": atual → novo → diferença, na ordem das seções da ficha; `todos` traz a ficha inteira', () => {
  const { e } = knight();
  const ANEL = Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring').id);
  const r = Comparar.comparar(e, { id: ANEL, af: [{ id: 'str', nivel: 5, value: 40 }, { id: 'evasion', nivel: 3, value: 50 }] });
  const str = linha(r.personagem, 'atributos.str');
  assert.equal(str.nome, 'STR');
  assert.equal(str.para - str.de, 40);
  assert.equal(str.delta, 40);
  // Ordem: Atributos antes de Recursos antes de Defensivo.
  const secoes = r.personagem.map((l) => l.secao);
  const ordem = ['Atributos', 'Recursos', 'Ofensivo', 'Defensivo', 'Resistências', 'Utilidade'];
  for (let i = 1; i < secoes.length; i++) assert.ok(ordem.indexOf(secoes[i]) >= ordem.indexOf(secoes[i - 1]), secoes.join(','));
  assert.ok(secoes.includes('Defensivo'), 'Evasion subiu');
  // `todos` inclui o que não muda (DEX, INT...) e nada com zero dos dois lados.
  assert.ok(r.todos.length > r.personagem.length);
  assert.ok(linha(r.todos, 'atributos.dex'));
  assert.ok(r.todos.every((l) => l.de !== 0 || l.para !== 0));
});
