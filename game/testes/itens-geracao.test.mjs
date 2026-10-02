// O gerador de itens (systems/itens): raridade por ato e dificuldade, Item
// Level, quantidade de adds pela raridade, pool pelo TIPO do item (com peso,
// nível mínimo, raridades permitidas e defesa pela base), tiers T1–T5 pelo
// Item Level, valores nas faixas, poderes Lendário/Mítico — e a distribuição
// estatística bate com a configuração.
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

test('configuração: validada, e as faixas T1 < T2 < T3 < T4 < T5 (T1 o mais fraco)', () => {
  assert.deepEqual(C.validar(), []);
  for (const [id, a] of Object.entries(C.ATRIBUTOS)) {
    if (a.valorPorRaridade) continue; // o valor é da raridade da peça, não do tier (o +N ao nível das gemas)
    const medias = [1, 2, 3, 4, 5].map((n) => (a.niveis[n][0] + a.niveis[n][1]) / 2);
    for (let i = 1; i < 5; i++) assert.ok(medias[i] > medias[i - 1], `${id}: T${i + 1} > T${i}`);
  }
  // Ato 3 Médio: a curva global de 02/10 (auditoria de loot) substituiu a tabela original.
  assert.equal(C.RARIDADES.chances['3'].medio['lendário'], 0.420142); // curva de 02/10 (a tabela antiga era 2,85)
});

// A lista de modificadores confirmada pelo dono (29/09).
const MODIFICADORES = [
  'str', 'dex', 'int', 'atk_flat', 'phys_dmg', 'fire_dmg', 'earth_dmg', 'energy_dmg', 'ice_dmg', 'holy_dmg', 'death_dmg',
  'atk_speed', 'cast_speed', 'crit_chance', 'crit_dmg', 'accuracy',
  'life', 'mana', 'life_regen', 'mana_regen', 'life_regen_pct', 'mana_regen_pct', 'life_leech', 'mana_leech',
  'armor_flat', 'armour_pct', 'evasion', 'evasion_pct', 'energy_shield', 'es_pct', 'block',
  'phys_res', 'fire_res', 'earth_res', 'energy_res', 'ice_res', 'holy_res', 'death_res',
  'move_speed', 'exp_bonus', 'gold_find', 'loot_bonus',
  // +N ao nível das gemas encaixadas (modelo Path of Exile, o dono 30/09).
  'gem_level',
  'dmg_vs_boss', 'dmg_vs_elite', 'dmg_vs_monsters', 'dmg_reduction', 'cooldown_recovery', 'skill_cost', 'avoid_damage',
];

test('modificadores: exatamente a lista do dono, cada um com peso, faixa por tier, nível mínimo e raridades', () => {
  assert.deepEqual(Object.keys(C.ATRIBUTOS).sort(), [...MODIFICADORES].sort());
  for (const [id, a] of Object.entries(C.ATRIBUTOS)) {
    assert.ok(a.peso > 0, `${id}: peso`);
    assert.ok(['flat', 'pct'].includes(a.tipo), `${id}: tipo`);
    assert.ok(a.nivelMinimo >= 1, `${id}: nível mínimo`);
    assert.ok(a.raridades?.length && a.raridades.every((r) => C.ORDEM.includes(r)), `${id}: raridades`);
    assert.ok(Object.values(C.POOLS).some((l) => l.includes(id)), `${id}: em algum pool (tipos de item permitidos)`);
  }
  // Sem "Magic Resistance" nem dano elemental genérico.
  assert.ok(!Object.keys(C.ATRIBUTOS).some((id) => /magic_res|elemental/.test(id)));
  // Os que saíram do jogo ficam só no `legado` (para a migração das peças antigas).
  for (const velho of ['skill_melee', 'hp_max', 'onslaught', 'protect_all', 'capacity', 'spell_dmg']) {
    assert.equal(C.ATRIBUTOS[velho], undefined);
    assert.ok(C.LEGADO[velho]);
  }
  assert.equal(C.ATRIBUTOS.atk_flat.tipo, 'flat');
  assert.equal(C.ATRIBUTOS.phys_dmg.tipo, 'pct');
});

test('cada raridade sai com a quantidade certa de adds; Lendário às vezes com poder, Mítico sempre', () => {
  // Comum nunca tem atributo (decisão do dono).
  const faixa = { comum: [0, 0], incomum: [1, 2], raro: [2, 3], 'épico': [3, 4], 'lendário': [4, 5], 'mítico': [5, 6] };
  const rng = semente(1);
  for (const [r, [lo, hi]] of Object.entries(faixa)) {
    const vistos = new Set();
    let comPoder = 0;
    for (let i = 0; i < 400; i++) {
      const p = G.gerarItem({ itemId: ANEL, itemLevel: 1500, raridade: r, rng });
      const n = p.af?.length ?? 0;
      vistos.add(n);
      assert.ok(n >= lo && n <= hi, `${r}: ${n} atributos`);
      if (p.efeito) comPoder++;
      if (r === 'lendário' && p.efeito) assert.equal(p.efeito.tipo, 'lendario');
      else if (r === 'mítico') assert.equal(p.efeito?.tipo, 'mitico');
      else if (r !== 'lendário') assert.equal(p.efeito, undefined);
    }
    assert.deepEqual([...vistos].sort(), [...new Set([lo, hi])], `${r}: as quantidades da faixa aparecem`);
    if (r === 'lendário') dentroDaMargem(comPoder, 400, C.RARIDADES.raridades['lendário'].chanceDoEfeito * 100, 'lendário com poder');
  }
});

test('adds: do pool do TIPO do item, sem repetir, tier liberado pelo Item Level, valor dentro da faixa do tier', () => {
  const rng = semente(2);
  for (const itemId of [ESPADA, BOTA, ANEL]) {
    const pool = new Set(G.poolDe(itemId));
    for (const itemLevel of [50, 400, 1500]) {
      const liberados = C.tiersLiberados(itemLevel);
      for (let i = 0; i < 700; i++) {
        const p = G.gerarItem({ itemId, itemLevel, raridade: 'mítico', rng });
        assert.equal(p.ilvl, itemLevel);
        const ids = p.af.map((a) => a.id);
        assert.equal(new Set(ids).size, ids.length, 'sem add repetido');
        for (const a of p.af) {
          assert.ok(pool.has(a.id), `${a.id} fora do pool`);
          assert.ok(liberados.includes(a.nivel), `T${a.nivel} com Item Level ${itemLevel}`);
          assert.ok(C.ATRIBUTOS[a.id].nivelMinimo <= itemLevel, `${a.id} abaixo do nível mínimo`);
          // Add de valor pela RARIDADE (o +N ao nível das gemas): o valor é o da tabela, não da faixa do tier.
          const fixo = C.ATRIBUTOS[a.id].valorPorRaridade?.[p.raridade];
          if (fixo != null) {
            assert.equal(a.value, fixo);
            continue;
          }
          const [lo, hi] = C.ATRIBUTOS[a.id].niveis[a.nivel];
          assert.ok(a.value >= lo && a.value <= hi, `${a.id} T${a.nivel} = ${a.value} fora de [${lo}, ${hi}]`);
        }
      }
    }
  }
  // Tipos: arma melee tem STR e dano; bota tem Movement Speed; arma não.
  assert.ok(G.poolDe(ESPADA).includes('str') && G.poolDe(ESPADA).includes('phys_dmg'));
  assert.ok(G.poolDe(BOTA).includes('move_speed'));
  assert.ok(!G.poolDe(ESPADA).includes('move_speed'));
});

test('filtros do pool: raridade permitida, nível mínimo, "não dropa" (Elite) e defesa só com a base dela', () => {
  const ctx = (o) => G.poolDe(ANEL, { itemLevel: 1500, raridade: 'mítico', base: {}, ...o });
  assert.ok(!ctx({ raridade: 'incomum' }).includes('dmg_vs_boss'), 'avançado: Raro+');
  assert.ok(ctx({ raridade: 'raro' }).includes('dmg_vs_boss'));
  assert.ok(!ctx({ itemLevel: 100 }).includes('dmg_vs_boss'), 'avançado: Item Level 101+');
  assert.ok(!ctx({}).includes('dmg_vs_elite'), 'Damage vs Elite definido, mas não dropa enquanto não existir Elite');
  // Peça de Armour não rola Evasion/ES; a de ES não rola Armour.
  const PEITO = Number(Object.values(ITEM_CATALOG).find((i) => i.slot === 'body' && i.armor > 0).id);
  const deArmour = G.poolDe(PEITO, { itemLevel: 500, raridade: 'raro', base: { armor: [10, 12] } });
  assert.ok(deArmour.includes('armor_flat') && !deArmour.includes('evasion') && !deArmour.includes('energy_shield'));
  const deEs = G.poolDe(PEITO, { itemLevel: 500, raridade: 'raro', base: { armor: [0, 0], es: [50, 60] } });
  assert.ok(deEs.includes('energy_shield') && deEs.includes('es_pct') && !deEs.includes('armor_flat'));
  // Anel/amuleto: livres.
  assert.ok(ctx({}).includes('evasion') && ctx({}).includes('energy_shield'));
});

test('Item Level: o da fase onde caiu (boss +10%); sem ele, o level do contexto ou o nível mínimo do item', () => {
  assert.equal(G.itemLevelDoDrop({ itemId: ESPADA, itemLevel: 300 }), 300);
  assert.equal(G.itemLevelDoDrop({ itemId: ESPADA, itemLevel: 300, boss: true }), 330);
  assert.equal(G.itemLevelDoDrop({ itemId: ESPADA, level: 120 }), 120);
  assert.equal(G.itemLevelDoDrop({ itemId: ESPADA }), ITEM_CATALOG[ESPADA].minLevel);
  assert.deepEqual(C.tiersLiberados(50), [1, 2]);
  assert.deepEqual(C.tiersLiberados(600), [1, 2, 3]);
  assert.deepEqual(C.tiersLiberados(1000), [1, 2, 3, 4]);
  assert.deepEqual(C.tiersLiberados(2000), [1, 2, 3, 4, 5]);
});

test('item que não aceita atributo sai simples; Comum sem atributo também', () => {
  const pocao = idPorNome('health potion');
  assert.deepEqual(G.gerarItem({ itemId: pocao, level: 50 }), { id: pocao, count: 1 });
  const rng = semente(3);
  let simples = 0;
  for (let i = 0; i < 500; i++) {
    const p = G.gerarItem({ itemId: ANEL, level: 50, raridade: 'comum', rng });
    if (!p.af?.length) { simples++; assert.equal(p.efeito, undefined); assert.ok(p.raridade === undefined || p.raridade === 'comum'); }
  }
  assert.equal(simples, 500, 'nenhuma comum com atributo');
});

test('ato não bloqueia raridade: Mítico pode sair no Ato 1, e o boss usa a dificuldade de cima', () => {
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

test('estatística: raridade (Ato 4 Difícil), tiers (peso × viés da raridade) e adds (peso) batem com a configuração', () => {
  const rng = semente(7);
  const N = 200_000;
  const cont = Object.fromEntries(C.ORDEM.map((r) => [r, 0]));
  for (let i = 0; i < N; i++) cont[G.sortearChave(C.RARIDADES.chances['4'].dificil, rng)]++;
  for (const r of C.ORDEM) dentroDaMargem(cont[r], N, C.RARIDADES.chances['4'].dificil[r], `A4D ${r}`);

  // Tiers com Item Level 2000 (todos liberados), Raro.
  const vies = C.TIERS.viesDaRaridade.raro;
  const pesos = [1, 2, 3, 4, 5].map((t) => C.TIERS.peso[t] * vies ** (t - 1));
  const soma = pesos.reduce((a, b) => a + b, 0);
  const tiers = [0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) tiers[C.sortearTier(2000, 'raro', rng) - 1]++;
  tiers.forEach((obs, i) => dentroDaMargem(obs, N, (pesos[i] / soma) * 100, `raro T${i + 1}`));
  // Raridade mais alta puxa o tier para cima.
  const media = (r) => { let t = 0; for (let i = 0; i < 20_000; i++) t += C.sortearTier(2000, r, rng); return t / 20_000; };
  assert.ok(media('mítico') > media('incomum'));

  // Um add só, sorteado pelo peso.
  const pool = G.poolDe(ANEL);
  const pesoTotal = pool.reduce((a, id) => a + C.ATRIBUTOS[id].peso, 0);
  const vistos = {};
  for (let i = 0; i < N; i++) { const [id] = G.sortearAdds(pool, 1, rng); vistos[id] = (vistos[id] ?? 0) + 1; }
  for (const id of pool) dentroDaMargem(vistos[id] ?? 0, N, (C.ATRIBUTOS[id].peso / pesoTotal) * 100, `add ${id}`);
});
