// O gerador de itens (systems/itens): raridade por ato e dificuldade,
// quantidade e pool de atributos, níveis 1–5, valores nas faixas, efeitos de
// Lendário e Mítico — e a distribuição estatística bate com a configuração.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../systems/itens/config.mjs';
import * as G from '../systems/itens/gerar.mjs';
import { ITEM_CATALOG } from '../systems/dados.mjs';

/** Sorteio com semente (mulberry32): o mesmo resultado a cada rodada. */
function semente(s) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const idPorNome = (nome) => Number(Object.values(ITEM_CATALOG).find((i) => i.name === nome).id);
const ESPADA = idPorNome('fire sword');
const BOTA = idPorNome('boots of haste');
const ANEL = idPorNome('might ring');

test('configuração: todas as tabelas somam 100 e as faixas N1 < N2 < N3 < N4 < N5', () => {
  assert.deepEqual(C.validar(), []);
  for (const [id, a] of Object.entries(C.ATRIBUTOS)) {
    const medias = [1, 2, 3, 4, 5].map((n) => (a.niveis[n][0] + a.niveis[n][1]) / 2);
    for (let i = 1; i < 5; i++) assert.ok(medias[i] > medias[i - 1], `${id}: N${i + 1} > N${i}`);
  }
  // A correção do Ato 3 Médio (a tabela original somava 99,15).
  assert.equal(C.RARIDADES.chances['3'].medio['lendário'], 2.85);
});

test('ATK e ATK% são atributos diferentes, cada um com a sua escala', () => {
  assert.deepEqual(C.ATRIBUTOS.atk_flat.niveis['1'], [2, 3]);
  assert.deepEqual(C.ATRIBUTOS.atk_flat.niveis['5'], [16, 20]);
  assert.equal(C.ATRIBUTOS.atk_flat.tipo, 'flat');
  assert.equal(C.ATRIBUTOS.weapon_atk_pct.tipo, 'pct');
  assert.notDeepEqual(C.ATRIBUTOS.weapon_atk_pct.niveis, C.ATRIBUTOS.atk_flat.niveis);
});

test('cada raridade sai com a quantidade certa de atributos, e só Lendário/Mítico têm efeito', () => {
  // Comum nunca tem atributo (decisão do dono).
  const faixa = { comum: [0, 0], incomum: [1, 2], raro: [2, 3], 'épico': [3, 4], 'lendário': [4, 5], 'mítico': [5, 6] };
  const rng = semente(1);
  for (const [r, [lo, hi]] of Object.entries(faixa)) {
    const vistos = new Set();
    for (let i = 0; i < 400; i++) {
      const p = G.gerarItem({ itemId: ANEL, level: 500, raridade: r, rng });
      const n = p.af?.length ?? 0;
      vistos.add(n);
      assert.ok(n >= lo && n <= hi, `${r}: ${n} atributos`);
      if (r === 'lendário') assert.equal(p.efeito?.tipo, 'lendario');
      else if (r === 'mítico') assert.equal(p.efeito?.tipo, 'mitico');
      else assert.equal(p.efeito, undefined);
    }
    assert.deepEqual([...vistos].sort(), [...new Set([lo, hi])], `${r}: as quantidades da faixa aparecem`);
  }
});

test('atributos: do pool do equipamento, sem repetir, com valor dentro da faixa do nível', () => {
  const rng = semente(2);
  for (const itemId of [ESPADA, BOTA, ANEL]) {
    const pool = new Set(G.poolDe(itemId));
    for (let i = 0; i < 2000; i++) {
      const p = G.gerarItem({ itemId, level: 1500, raridade: 'mítico', rng });
      const ids = p.af.map((a) => a.id);
      assert.equal(new Set(ids).size, ids.length, 'sem atributo repetido');
      for (const a of p.af) {
        assert.ok(pool.has(a.id), `${a.id} fora do pool`);
        assert.ok(a.nivel >= 1 && a.nivel <= 5);
        const [lo, hi] = C.ATRIBUTOS[a.id].niveis[a.nivel];
        assert.ok(a.value >= lo && a.value <= hi, `${a.id} N${a.nivel} = ${a.value} fora de [${lo}, ${hi}]`);
        assert.equal(G.nivelDoValor(a.id, a.value) >= a.nivel - 0, true);
      }
    }
  }
  // Na arma, só a perícia DELA.
  assert.ok(G.poolDe(ESPADA).includes('skill_sword'));
  assert.ok(!G.poolDe(ESPADA).includes('skill_axe'));
  // Bota tem movimento; arma não.
  assert.ok(G.poolDe(BOTA).includes('speed'));
  assert.ok(!G.poolDe(ESPADA).includes('speed'));
});

test('item que não aceita atributo sai simples; Comum sem atributo também', () => {
  const pocao = idPorNome('health potion');
  assert.deepEqual(G.gerarItem({ itemId: pocao, level: 50 }), { id: pocao, count: 1 });
  const rng = semente(3);
  let simples = 0;
  for (let i = 0; i < 500; i++) {
    const p = G.gerarItem({ itemId: ANEL, level: 50, raridade: 'comum', rng });
    if (!p.af) { simples++; assert.deepEqual(p, { id: ANEL, count: 1 }); }
  }
  assert.equal(simples, 500, 'nenhuma comum com atributo');
});

test('ato não bloqueia raridade: Mítico pode sair no Ato 1, e o boss usa a dificuldade de cima', () => {
  // Um sorteio que cai no fim da tabela = a última raridade (mítico).
  const quaseUm = () => 0.9999999;
  assert.equal(G.gerarItem({ itemId: ANEL, level: 8, rng: quaseUm }).raridade, 'mítico');
  assert.deepEqual(G.origemDoDrop({ level: 50 }), { ato: '1', dificuldade: 'facil' });
  assert.deepEqual(G.origemDoDrop({ level: 50, boss: true }), { ato: '1', dificuldade: 'medio' });
  assert.deepEqual(G.origemDoDrop({ level: 250 }), { ato: '2', dificuldade: 'facil' });
  assert.deepEqual(G.origemDoDrop({ level: 700 }), { ato: '3', dificuldade: 'facil' });
  assert.deepEqual(G.origemDoDrop({ level: 1500 }), { ato: '4', dificuldade: 'facil' });
  assert.deepEqual(G.origemDoDrop({ ato: 4, dificuldade: 'dificil', boss: true }), { ato: '4', dificuldade: 'dificil' });
});

test('mesma semente, mesmo item (reproduzível para testes e simulação)', () => {
  const a = G.gerarItem({ itemId: ESPADA, level: 400, rng: semente(99) });
  const b = G.gerarItem({ itemId: ESPADA, level: 400, rng: semente(99) });
  assert.deepEqual(a, b);
});

/** Frequência observada x esperada, com margem de 5 desvios-padrão (binomial). */
function dentroDaMargem(obs, n, pct, nome) {
  const p = pct / 100;
  const sd = Math.sqrt(n * p * (1 - p));
  assert.ok(Math.abs(obs - n * p) <= 5 * sd + 1, `${nome}: ${obs} de ${n} (esperado ${(n * p).toFixed(1)})`);
}

test('estatística: raridade (Ato 4 Difícil) e níveis (Ato 1 Fácil, Raro) batem com a tabela', () => {
  const rng = semente(7);
  const N = 200_000;
  const cont = Object.fromEntries(C.ORDEM.map((r) => [r, 0]));
  for (let i = 0; i < N; i++) cont[G.sortearChave(C.RARIDADES.chances['4'].dificil, rng)]++;
  for (const r of C.ORDEM) dentroDaMargem(cont[r], N, C.RARIDADES.chances['4'].dificil[r], `A4D ${r}`);

  const tabela = C.NIVEIS.chances['1'].facil.raro;
  const niveis = [0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) niveis[G.sortearNivel(tabela, rng) - 1]++;
  niveis.forEach((obs, i) => dentroDaMargem(obs, N, tabela[i], `A1F raro N${i + 1}`));
});
