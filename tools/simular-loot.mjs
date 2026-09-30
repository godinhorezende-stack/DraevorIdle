// Simulação do gerador de itens em grande escala: gera N itens pelo MESMO
// gerador do jogo (game/systems/itens/gerar.mjs) e compara com a configuração.
//
// Uso:
//   node tools/simular-loot.mjs [quantos=1000000] [ato=1] [dificuldade=facil] [itemId] [semente] [itemLevel]
//   node tools/simular-loot.mjs 1000000 4 dificil 0 0 1500
//
// Relatório: raridades (observado x esperado), quantidade de adds, tiers T1–T5
// (no total e por raridade, com o esperado pelo Item Level e o viés da
// raridade — `tiers.json`), e as combinações raras — Lendário/Mítico com T4/T5
// e Mítico com vários T5. Sem Item Level, o nível mínimo do item.
import { gerarItem } from '../game/systems/itens/gerar.mjs';
import * as C from '../game/systems/itens/config.mjs';
import { ITEM_CATALOG } from '../game/systems/dados.mjs';

const [N = 1_000_000, ato = '1', dificuldade = 'facil', itemArg, sementeArg, itemLevelArg] = process.argv.slice(2);
const quantos = Number(N);
const itemLevel = Number(itemLevelArg) || undefined;
// O anel tem um dos pools mais amplos: quase nenhum filtro corta a quantidade.
const itemId = Number(itemArg) || Number(Object.values(ITEM_CATALOG).find((i) => i.name === 'might ring')?.id);

let s = Number(sementeArg) || 12345;
const rng = () => {
  s |= 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const R = C.ORDEM;
const porRaridade = Object.fromEntries(R.map((r) => [r, 0]));
const qtdAtributos = {};
const niveis = [0, 0, 0, 0, 0];
const niveisPorRaridade = Object.fromEntries(R.map((r) => [r, [0, 0, 0, 0, 0]]));
const combo = { 'Lendário + T4': 0, 'Lendário + T5': 0, 'Mítico + T4': 0, 'Mítico + T5': 0, 'Mítico + 2 T5': 0, 'Mítico + 3+ T5': 0, 'qualquer + T5': 0, 'qualquer + 2 T5': 0 };
const efeitos = {};

const t0 = Date.now();
for (let i = 0; i < quantos; i++) {
  const p = gerarItem({ itemId, ato, dificuldade, itemLevel, rng });
  const r = p.raridade ?? 'comum';
  porRaridade[r]++;
  const af = p.af ?? [];
  qtdAtributos[af.length] = (qtdAtributos[af.length] ?? 0) + 1;
  let n4 = 0;
  let n5 = 0;
  for (const a of af) {
    niveis[a.nivel - 1]++;
    niveisPorRaridade[r][a.nivel - 1]++;
    if (a.nivel === 4) n4++;
    if (a.nivel === 5) n5++;
  }
  if (r === 'lendário' && n4) combo['Lendário + T4']++;
  if (r === 'lendário' && n5) combo['Lendário + T5']++;
  if (r === 'mítico' && n4) combo['Mítico + T4']++;
  if (r === 'mítico' && n5) combo['Mítico + T5']++;
  if (r === 'mítico' && n5 === 2) combo['Mítico + 2 T5']++;
  if (r === 'mítico' && n5 >= 3) combo['Mítico + 3+ T5']++;
  if (n5) combo['qualquer + T5']++;
  if (n5 >= 2) combo['qualquer + 2 T5']++;
  if (p.efeito) efeitos[p.efeito.id] = (efeitos[p.efeito.id] ?? 0) + 1;
}
const ms = Date.now() - t0;

const pct = (n, total) => (total ? (100 * n) / total : 0).toFixed(4).replace(/\.?0+$/, '') + '%';
const num = (n) => n.toLocaleString('pt-BR');
const umEm = (n) => (n ? `1 em ${num(Math.round(quantos / n))}` : '—');

console.log(`\n=== ${num(quantos)} itens · Ato ${ato} · ${dificuldade} · item ${ITEM_CATALOG[itemId]?.name} · Item Level ${itemLevel ?? ITEM_CATALOG[itemId]?.minLevel} · ${ms} ms (${Math.round((quantos / ms) * 1000).toLocaleString('pt-BR')} itens/s)\n`);
console.log('RARIDADE              observado            esperado');
for (const r of R) {
  const esperado = C.RARIDADES.chances[ato][dificuldade][r];
  console.log(`  ${r.padEnd(10)} ${num(porRaridade[r]).padStart(10)}  ${pct(porRaridade[r], quantos).padStart(9)}   ${String(esperado).padStart(7)}%   ${umEm(porRaridade[r])}`);
}
console.log('\nQUANTIDADE DE ADDS');
for (const [k, v] of Object.entries(qtdAtributos).sort((a, b) => a[0] - b[0])) console.log(`  ${k} atributo(s)  ${num(v).padStart(10)}  ${pct(v, quantos)}`);
const totalNiveis = niveis.reduce((a, b) => a + b, 0);
console.log(`\nTIERS (de ${num(totalNiveis)} adds)`);
niveis.forEach((v, i) => console.log(`  T${i + 1}  ${num(v).padStart(10)}  ${pct(v, totalNiveis)}`));
/** O esperado de cada tier: peso × viés^(tier−1), só os liberados pelo Item Level (o amuleto tem viés extra; não entra aqui). */
const esperadoDoTier = (r) => {
  const il = itemLevel ?? ITEM_CATALOG[itemId]?.minLevel ?? 1;
  const liberados = C.tiersLiberados(il);
  const vies = C.TIERS.viesDaRaridade[r] ?? 1;
  const pesos = [1, 2, 3, 4, 5].map((t) => (liberados.includes(t) ? C.TIERS.peso[t] * vies ** (t - 1) : 0));
  const soma = pesos.reduce((a, b) => a + b, 0);
  return pesos.map((p) => (100 * p) / soma);
};
console.log('\nTIERS POR RARIDADE           T1         T2         T3         T4         T5   (esperado T4 / T5)');
for (const r of R) {
  const t = niveisPorRaridade[r].reduce((a, b) => a + b, 0);
  const esp = esperadoDoTier(r);
  if (!t) continue;
  console.log(`  ${r.padEnd(10)} ${niveisPorRaridade[r].map((v) => pct(v, t).padStart(10)).join(' ')}   (${esp[3].toFixed(2)}% / ${esp[4].toFixed(2)}%)`);
}
console.log('\nCOMBINAÇÕES (itens)');
for (const [k, v] of Object.entries(combo)) console.log(`  ${k.padEnd(18)} ${num(v).padStart(8)}  ${pct(v, quantos).padStart(9)}   ${umEm(v)}`);
console.log('\nPODERES');
for (const [k, v] of Object.entries(efeitos)) console.log(`  ${k.padEnd(18)} ${num(v)}`);
process.exit(0);
