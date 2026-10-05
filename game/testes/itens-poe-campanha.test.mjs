// A campanha do PoE convertida (gamedata/itens-poe/campanha-poe.json — tools/montar-campanha-poe.mjs): 10 atos + Epílogo, áreas com mapa
// do Draevor e monstros do PoE, chefes de ato.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const C = JSON.parse(readFileSync(new URL('../gamedata/itens-poe/campanha-poe.json', import.meta.url), 'utf8'));
const CAMPANHA = JSON.parse(readFileSync(new URL('../gamedata/campanha.json', import.meta.url), 'utf8'));

test('C1 — 10 atos + Epílogo; toda área de combate tem mapa do Draevor (de uma hunt da campanha) e monstros do PoE com status', () => {
  assert.equal(C.atos.length, 11);
  assert.equal(C.atos.at(-1).nome, 'Epílogo');
  const huntsDoDraevor = new Set(CAMPANHA.fases.map((f) => f.huntId));
  for (const a of Object.values(C.areas)) {
    if (a.cidade) {
      assert.equal(a.mapa, null);
      continue;
    }
    assert.ok(huntsDoDraevor.has(a.mapa), `${a.nome}: mapa ${a.mapa}`);
    assert.ok(a.monstros.length > 0, `${a.nome}: sem monstros`);
    for (const m of a.monstros) assert.ok(m.vida > 0 && m.dano >= 0 && m.tempoAtaque > 0, `${a.nome}/${m.nome}`);
    for (const c of a.conexoes) assert.ok(C.areas[c], `${a.nome}: conexão ${c}`);
  }
  const prisao = Object.values(C.areas).find((a) => a.nome === 'Prisão Inferior' && a.ato === 1);
  assert.equal(prisao.mapa, 'prison-2', 'a prisão usa o mapa de prisão do Draevor');
});

test('C1 — os 10 chefes de ato com os status de campanha (os 3 que a coleção só traz em nível de mapa, calculados)', () => {
  assert.equal(Object.keys(C.chefes).length, 10);
  for (const ch of Object.values(C.chefes)) assert.ok(ch.monstro?.vida > 0 && ch.monstro.dano > 0, ch.nome);
  assert.equal(C.chefes[1].monstro.vida, 9657, 'Merveil: o valor da coleção');
  assert.ok(C.chefes[2].monstro.calculado && C.chefes[2].monstro.vida > C.chefes[1].monstro.vida && C.chefes[2].monstro.vida < C.chefes[3].monstro.vida, 'Essência dos Vaal entre Merveil e Dominus');
});
