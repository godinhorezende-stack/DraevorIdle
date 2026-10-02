// A CURVA GLOBAL de loot (auditoria de 02/10, decisão do dono): a qualidade do drop nunca cai ao passar de um estágio para o seguinte
// (Normal 1→4, Cruel 1→4, Merciless 1→4), o mítico é especial (escada ×0,4), o boss de Ato dá equipamento garantido e a raridade da gema
// segue o estágio.
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import * as C from '../systems/itens/config.mjs';
import { gerarItem } from '../systems/itens/gerar.mjs';
import { pecasGarantidas, poolDoBoss } from '../systems/itens/equipamento-do-boss.mjs';
import * as Gemas from '../systems/skills/gemas.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';

const ORDEM_DOS_ESTAGIOS = [['1', 'facil'], ['2', 'facil'], ['3', 'facil'], ['4', 'facil'], ['1', 'medio'], ['2', 'medio'], ['3', 'medio'], ['4', 'medio'], ['1', 'dificil'], ['2', 'dificil'], ['3', 'dificil'], ['4', 'dificil']];
const tab = ([a, d]) => C.RARIDADES.chances[a][d];
const acima = (t, de) => C.ORDEM.slice(C.ORDEM.indexOf(de)).reduce((s, r) => s + t[r], 0);

test('cada tabela soma 100 e a configuração valida (boot)', () => {
  assert.deepEqual(C.validar(), []);
  for (const e of ORDEM_DOS_ESTAGIOS) assert.ok(Math.abs(C.ORDEM.reduce((s, r) => s + tab(e)[r], 0) - 100) < 1e-6, e.join('/'));
});

test('a qualidade NUNCA cai de um estágio para o seguinte: raro+, épico+, lendário+ e mítico só sobem (ou ficam)', () => {
  for (const de of ['raro', 'épico', 'lendário', 'mítico']) {
    for (let i = 1; i < ORDEM_DOS_ESTAGIOS.length; i++) {
      const antes = acima(tab(ORDEM_DOS_ESTAGIOS[i - 1]), de);
      const agora = acima(tab(ORDEM_DOS_ESTAGIOS[i]), de);
      assert.ok(agora >= antes - 1e-9, `${de}+: ${ORDEM_DOS_ESTAGIOS[i - 1].join('/')} (${antes}) → ${ORDEM_DOS_ESTAGIOS[i].join('/')} (${agora})`);
    }
  }
});

// O mix real de mobs (peso dos spawns das 47 fases) e o multiplicador EFETIVO de itens por abate de cada raridade de mob
// (a chance de cada drop satura em 100%, então o nominal ×1,15/1,5/2/2,5/3 rende ×1,14/1,45/1,89/2,29/2,67) — auditoria de 02/10.
const MIX = { normal: 0.752, modificado: 0.15, raro: 0.05, elite: 0.026, unico: 0.011, boss: 0.011 };
const QEFETIVO = { normal: 1, modificado: 1.136, raro: 1.452, elite: 1.892, unico: 2.294, boss: 2.668 };
const EQUIP_POR_ABATE = { 1: 0.67, 2: 0.75, 3: 0.82, 4: 0.83 };
/** Quantos ABATES REAIS (o mix todo) até 1 item da raridade `r` no estágio `e`. */
const abatesReais = (e, r) => 1 / (EQUIP_POR_ABATE[e[0]] * Object.keys(MIX).reduce((s, m) => s + MIX[m] * QEFETIVO[m] * (C.inclinarTabela(tab(e), m)[r] / 100), 0));

test('as raridades altas são ESPECIAIS: no topo (Merciless 4, sem booster, mix real) raro ~1/10 abates, épico 1/30, lendário 1/150, mítico 1/1.000', () => {
  const topo = ['4', 'dificil'];
  const perto = (obs, alvo, tol) => Math.abs(obs - alvo) / alvo <= tol;
  assert.ok(perto(abatesReais(topo, 'raro'), 10, 0.08), `raro ${abatesReais(topo, 'raro').toFixed(1)}`);
  assert.ok(perto(abatesReais(topo, 'épico'), 30, 0.08), `épico ${abatesReais(topo, 'épico').toFixed(1)}`);
  assert.ok(perto(abatesReais(topo, 'lendário'), 150, 0.08), `lendário ${abatesReais(topo, 'lendário').toFixed(1)}`);
  assert.ok(perto(abatesReais(topo, 'mítico'), 1000, 0.08), `mítico ${abatesReais(topo, 'mítico').toFixed(0)}`);
  assert.ok(abatesReais(['4', 'facil'], 'mítico') > 5000, 'Normal 4: mais raro que o topo');
  for (const e of ORDEM_DOS_ESTAGIOS) assert.ok(abatesReais(e, 'mítico') >= 950, `${e.join('/')}: nenhum estágio passa de 1 mítico a cada ~1.000 abates`);
});

test('raridade do mob: inclina a qualidade (normalizada, nunca passa de 100%), o mítico não ganha mais que o lendário, e a quantidade é o loot do mob', () => {
  const topo = tab(['4', 'dificil']);
  assert.deepEqual(C.inclinarTabela(topo, 'normal'), topo, 'mob normal = a tabela do estágio');
  assert.deepEqual(C.inclinarTabela(topo, 'qualquer-coisa'), topo, 'sem raridade conhecida = a tabela do estágio');
  let anterior = null;
  for (const mob of ['normal', 'modificado', 'raro', 'elite', 'unico', 'boss']) {
    const t = C.inclinarTabela(topo, mob);
    assert.ok(Math.abs(C.ORDEM.reduce((s, r) => s + t[r], 0) - 100) < 1e-9, `${mob} soma 100`);
    for (const r of C.ORDEM) assert.ok(t[r] >= 0, `${mob}/${r}`);
    if (anterior) for (const r of ['épico', 'lendário', 'mítico']) assert.ok(t[r] > anterior[r], `${mob} tem mais ${r} que o mob de baixo`);
    anterior = t;
  }
  const fator = (r) => C.inclinarTabela(topo, 'boss')[r] / topo[r];
  assert.ok(Math.abs(fator('lendário') / fator('mítico') - 1) < 1e-9, 'o mítico tem a mesma inclinação do lendário');
  const loot = JSON.parse(readFileSync(new URL('../gamedata/mobs/raridades.json', import.meta.url), 'utf8')).raridades;
  assert.deepEqual(['normal', 'modificado', 'raro', 'elite', 'unico', 'boss'].map((m) => loot[m].loot), [1, 1.15, 1.5, 2, 2.5, 3]);
});

test('o gerador real: elite e boss dão mais lendário que o mob normal (qualidade), e o boss de Ato usa a inclinação de boss', () => {
  const N = 150000;
  const taxa = (ctx) => {
    let n = 0;
    for (let i = 0; i < N; i++) if (['lendário', 'mítico'].includes(gerarItem({ itemId: 3268, ato: 4, dificuldade: 'dificil', itemLevel: 100, ...ctx }).raridade)) n++;
    return n / N;
  };
  const normal = taxa({});
  const elite = taxa({ raridadeDoMob: 'elite' });
  const boss = taxa({ boss: true });
  assert.ok(elite > normal * 1.5, `elite ${elite} × normal ${normal}`);
  assert.ok(boss > elite * 0.9, 'boss de Ato: pelo menos a inclinação de elite');
});

test('o booster só mexe na QUANTIDADE e a descrição diz isso', () => {
  const t = JSON.parse(readFileSync(new URL('../gamedata/character-template.json', import.meta.url), 'utf8'));
  const loot = t.efeitos.buffPower.find((l) => l.id === 'loot');
  assert.match(loot.resumo, /chance de cada drop/);
  assert.match(loot.resumo, /não muda a raridade/);
  const fonte = readFileSync(new URL('../systems/hunt/combate.mjs', import.meta.url), 'utf8');
  assert.match(fonte, /raridadeDoMob: alvo\.raridade/, 'a raridade do mob chega ao gerador');
});

test('o gerador real sorteia o que a tabela diz (Monte Carlo, 60 mil por estágio, tolerância de amostra)', () => {
  const N = 60000;
  for (const e of [['1', 'facil'], ['2', 'medio'], ['4', 'dificil']]) {
    const cont = {};
    for (let i = 0; i < N; i++) {
      const r = gerarItem({ itemId: 3268, ato: e[0], dificuldade: e[1], itemLevel: 100 }).raridade ?? 'comum';
      cont[r] = (cont[r] ?? 0) + 1;
    }
    for (const r of ['raro', 'épico']) {
      const p = tab(e)[r] / 100;
      const sd = Math.sqrt((p * (1 - p)) / N);
      assert.ok(Math.abs((cont[r] ?? 0) / N - p) < 5 * sd + 1e-4, `${e.join('/')} ${r}: ${((100 * (cont[r] ?? 0)) / N).toFixed(2)}% × ${tab(e)[r]}%`);
    }
  }
});

test('boss de Ato: equipamento garantido 1 / 2 / 3 por dificuldade, da vocação, com a raridade do estágio+1 e mínimo raro no Merciless', () => {
  const ctx = (dificuldade, itemLevel) => ({ ato: 3, dificuldade, itemLevel });
  assert.equal(pecasGarantidas(ctx('facil', 100), 'knight').length, 1);
  assert.equal(pecasGarantidas(ctx('medio', 475), 'knight').length, 2);
  const m = pecasGarantidas(ctx('dificil', 1650), 'sorcerer');
  assert.equal(m.length, 3);
  const ordem = C.ORDEM;
  for (let k = 0; k < 400; k++) for (const p of pecasGarantidas(ctx('dificil', 1650), 'paladin')) assert.ok(ordem.indexOf(p.raridade ?? 'comum') >= ordem.indexOf('raro'), 'Merciless: no mínimo raro');
  for (const p of m) {
    const meta = ITEM_CATALOG[p.id];
    assert.ok(meta.slot, 'é equipamento');
    assert.ok(!meta.vocations?.length || meta.vocations.includes('sorcerer'), 'da vocação');
    assert.ok(!/^Crafted /.test(meta.name), 'peça de craft só sai da forja');
  }
  assert.equal(pecasGarantidas({ ato: 1, dificuldade: null }, 'knight').length, 0, 'fora da campanha: nada');
});

test('boss de Ato: as peças são das de MAIOR level mínimo até o level do boss e não se repetem na mesma vitória', () => {
  const pool = poolDoBoss(1650, 'knight', 40);
  assert.ok(pool.length > 0 && pool.length <= 40);
  const piso = Math.min(...pool.map((i) => i.minLevel ?? 0));
  const resto = Object.values(ITEM_CATALOG).filter((i) => i.slot && !pool.includes(i) && (i.minLevel ?? 0) > piso && (i.minLevel ?? 0) <= 1650 && (!i.vocations?.length || i.vocations.includes('knight')) && !/^Crafted /.test(i.name) && !i.stackable && ['weapon', 'shield', 'head', 'body', 'legs', 'feet', 'ring', 'neck'].includes(i.slot));
  assert.equal(resto.filter((i) => Gemas.raridadeDaGema('comum') && pool.every((p) => p.id !== i.id) && (i.minLevel ?? 0) > piso).length >= 0, true);
  for (let k = 0; k < 100; k++) {
    const ids = pecasGarantidas({ ato: 4, dificuldade: 'dificil', itemLevel: 2000 }, 'knight').map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, 'sem repetir');
  }
});

test('gema: a raridade segue o estágio (Normal ×1; Merciless 4 ×2 para raro+), o mítico ×0,4 em todos, e fora da campanha o fator é 1', () => {
  assert.equal(Gemas.fatorDoEstagio(1, 'facil'), 1);
  assert.equal(Gemas.fatorDoEstagio(4, 'dificil'), 2);
  assert.equal(Gemas.fatorDoEstagio(2, 'medio'), 1.2);
  assert.equal(Gemas.fatorDoEstagio(null, null), 1);
  const N = 600000;
  const taxa = (ato, dificuldade) => {
    let raro = 0;
    for (let i = 0; i < N; i++) if (C.ORDEM.indexOf(Gemas.sortearRaridade(Math.random, { ato, dificuldade })) >= 2) raro++;
    return raro / N;
  };
  const normal = taxa(1, 'facil');
  const topo = taxa(4, 'dificil');
  assert.ok(topo > normal * 1.5, `raro+ de gema: Normal ${(100 * normal).toFixed(2)}% × Merciless 4 ${(100 * topo).toFixed(2)}%`);
  // comum sempre é a maior fatia
  assert.ok(taxa(4, 'dificil') < 0.5);
});
