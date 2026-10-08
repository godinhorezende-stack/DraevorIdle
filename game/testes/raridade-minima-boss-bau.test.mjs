// A raridade MÍNIMA por origem (dono, 02/10): o equipamento que cai de boss, de baú encontrado e dos guardiões do baú sai pelo menos Incomum
// (com atributos e raridade visível); o mob normal segue a tabela. Antes ~62% das wands do boss saíam Comum, 37% sem nenhum campo de raridade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarItem } from '../systems/itens/gerar.mjs';
import * as C from '../systems/itens/config.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';
import * as Cacadas from '../systems/cacadas.mjs';
import { lootDoEncontro } from '../systems/hunt/combate.mjs';
import { lootOrigem } from '../systems/encontros/entregar.mjs';
import { criarMonstro } from '../systems/hunt/monstros.mjs';
import { personagemDeTeste, PERSONAGEM, HUNT_DE_TESTE } from './apoio.mjs';

const idDe = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome).id);
const ARMAS = ['wand of vortex', 'bow', 'sword', 'terra rod'].map(idDe);
const ordem = (r) => C.ORDEM.indexOf(r ?? 'comum');
const MINIMO = C.ORDEM.indexOf('incomum');

test('com origem boss, baú ou guardião, nenhuma arma sai Comum nem sem raridade', () => {
  for (const origem of ['boss', 'bau', 'guardiao']) {
    for (const id of ARMAS) {
      for (let i = 0; i < 400; i++) {
        const p = gerarItem({ itemId: id, level: 100, origem, ...(origem === 'boss' ? { boss: true } : {}) });
        assert.ok(p.raridade, `${origem} ${ITEM_CATALOG[id].name}: sem raridade`);
        assert.ok(ordem(p.raridade) >= MINIMO, `${origem} ${ITEM_CATALOG[id].name}: ${p.raridade}`);
        assert.ok(p.af?.length >= 1, 'a peça Incomum tem pelo menos um atributo');
      }
    }
  }
});

test('o mínimo só sobe: a raridade que já era maior fica, a forçada não muda, e o mob normal segue a tabela (ainda sai Comum)', () => {
  const id = idDe('wand of vortex');
  const contagem = {};
  for (let i = 0; i < 2000; i++) { const r = gerarItem({ itemId: id, level: 100, origem: 'bau' }).raridade; contagem[r] = (contagem[r] ?? 0) + 1; }
  assert.ok((contagem['raro'] ?? 0) + (contagem['épico'] ?? 0) > 0, 'as raridades maiores continuam saindo');
  assert.equal(gerarItem({ itemId: id, level: 100, origem: 'boss', raridade: 'comum' }).raridade ?? 'comum', 'comum', 'a raridade forçada não é elevada');
  const normal = Array.from({ length: 2000 }, () => gerarItem({ itemId: id, level: 100 })).filter((p) => !p.raridade || p.raridade === 'comum').length;
  assert.ok(normal > 1000, `mob normal: ${normal} de 2000 Comuns`);
  assert.equal(C.raridadeMinimaDe('boss'), 'incomum');
  assert.equal(C.raridadeMinimaDe('nao-existe'), null);
});

function naCacada() {
  const e = personagemDeTeste({ vocacao: 'knight', level: 100 });
  e.maxHp = e.hp = 1e9;
  assert.ok(Cacadas.entrar(e, { huntId: HUNT_DE_TESTE, mode: 'auto' }).ok);
  return e;
}

test('o loot do baú encontrado passa pela origem: toda arma que cai do baú sai pelo menos Incomum', () => {
  const e = naCacada();
  const id = idDe('wand of vortex');
  for (let i = 0; i < 60; i++) {
    const caiu = lootDoEncontro(e, e.hunt, PERSONAGEM, lootOrigem({ defId: 'bau-teste', nome: 'Baú' }), [{ id, chance: 1 }], []);
    for (const it of caiu) assert.ok(ordem(it.raridade) >= MINIMO, `o baú soltou ${it.raridade ?? 'sem raridade'}`);
  }
  assert.equal(lootOrigem({ defId: 'x', nome: 'y' }).origemDoLoot, 'bau');
});

test('o boss e o guardião soltam peça pelo menos Incomum (a origem sai da raridade do bicho e da marca de guardião)', () => {
  const e = naCacada();
  const id = idDe('wand of vortex');
  for (const marca of [{ raridade: 'boss' }, { raridade: 'unico' }, { guardiao: true }]) {
    for (let i = 0; i < 40; i++) {
      const m = { ...criarMonstro({ key: 'troll', x: 1, y: 1 }, null), ...marca, name: 'Teste' };
      const caiu = lootDoEncontro(e, e.hunt, PERSONAGEM, m, [{ id, chance: 1 }], []);
      for (const it of caiu) assert.ok(ordem(it.raridade) >= MINIMO, `${JSON.stringify(marca)}: ${it.raridade ?? 'sem raridade'}`);
    }
  }
});
