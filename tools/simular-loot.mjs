// Simulação do gerador de itens em grande escala: gera N itens pelo MESMO
// gerador do jogo (game/systems/itens/gerar.mjs) e compara com a configuração.
//
// Uso:
//   node tools/simular-loot.mjs [quantos=1000000] [ato=1] [dificuldade=facil] [itemId] [semente]
//   node tools/simular-loot.mjs 1000000 4 dificil
//
// Relatório: raridades (observado x esperado), quantidade de atributos, níveis
// N1–N5 (no total e por raridade), e as combinações raras — Lendário/Mítico com
// N4/N5 e Mítico com vários N5.
import { gerarItem } from '../game/systems/itens/gerar.mjs';
import * as C from '../game/systems/itens/config.mjs';
import { ITEM_CATALOG } from '../game/systems/dados.mjs';

const [N = 1_000_000, ato = '1', dificuldade = 'facil', itemArg, sementeArg] = process.argv.slice(2);
const quantos = Number(N);
// O anel aceita todos os 38 atributos: nenhum pool corta a quantidade.
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
const combo = { 'Lendário + N4': 0, 'Lendário + N5': 0, 'Mítico + N4': 0, 'Mítico + N5': 0, 'Mítico + 2 N5': 0, 'Mítico + 3+ N5': 0, 'qualquer + N5': 0, 'qualquer + 2 N5': 0 };
const efeitos = {};

const t0 = Date.now();
for (let i = 0; i < quantos; i++) {
  const p = gerarItem({ itemId, ato, dificuldade, rng });
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
  if (r === 'lendário' && n4) combo['Lendário + N4']++;
  if (r === 'lendário' && n5) combo['Lendário + N5']++;
  if (r === 'mítico' && n4) combo['Mítico + N4']++;
  if (r === 'mítico' && n5) combo['Mítico + N5']++;
  if (r === 'mítico' && n5 === 2) combo['Mítico + 2 N5']++;
  if (r === 'mítico' && n5 >= 3) combo['Mítico + 3+ N5']++;
  if (n5) combo['qualquer + N5']++;
  if (n5 >= 2) combo['qualquer + 2 N5']++;
  if (p.efeito) efeitos[p.efeito.id] = (efeitos[p.efeito.id] ?? 0) + 1;
}
const ms = Date.now() - t0;

const pct = (n, total) => (total ? (100 * n) / total : 0).toFixed(4).replace(/\.?0+$/, '') + '%';
const num = (n) => n.toLocaleString('pt-BR');
const umEm = (n) => (n ? `1 em ${num(Math.round(quantos / n))}` : '—');

console.log(`\n=== ${num(quantos)} itens · Ato ${ato} · ${dificuldade} · item ${ITEM_CATALOG[itemId]?.name} · ${ms} ms (${Math.round((quantos / ms) * 1000).toLocaleString('pt-BR')} itens/s)\n`);
console.log('RARIDADE              observado            esperado');
for (const r of R) {
  const esperado = C.RARIDADES.chances[ato][dificuldade][r];
  console.log(`  ${r.padEnd(10)} ${num(porRaridade[r]).padStart(10)}  ${pct(porRaridade[r], quantos).padStart(9)}   ${String(esperado).padStart(7)}%   ${umEm(porRaridade[r])}`);
}
console.log('\nQUANTIDADE DE ATRIBUTOS');
for (const [k, v] of Object.entries(qtdAtributos).sort((a, b) => a[0] - b[0])) console.log(`  ${k} atributo(s)  ${num(v).padStart(10)}  ${pct(v, quantos)}`);
const totalNiveis = niveis.reduce((a, b) => a + b, 0);
console.log(`\nNÍVEIS (de ${num(totalNiveis)} atributos)`);
niveis.forEach((v, i) => console.log(`  N${i + 1}  ${num(v).padStart(10)}  ${pct(v, totalNiveis)}`));
console.log('\nNÍVEIS POR RARIDADE          N1         N2         N3         N4         N5   (esperado N4 / N5)');
for (const r of R) {
  const t = niveisPorRaridade[r].reduce((a, b) => a + b, 0);
  const esp = C.NIVEIS.chances[ato][dificuldade][r];
  if (!t) continue;
  console.log(`  ${r.padEnd(10)} ${niveisPorRaridade[r].map((v) => pct(v, t).padStart(10)).join(' ')}   (${esp[3]}% / ${esp[4]}%)`);
}
console.log('\nCOMBINAÇÕES (itens)');
for (const [k, v] of Object.entries(combo)) console.log(`  ${k.padEnd(18)} ${num(v).padStart(8)}  ${pct(v, quantos).padStart(9)}   ${umEm(v)}`);
console.log('\nEFEITOS');
for (const [k, v] of Object.entries(efeitos)) console.log(`  ${k.padEnd(18)} ${num(v)}`);
process.exit(0);
