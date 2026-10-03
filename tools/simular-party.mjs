// Simulações das regras de recompensa da party (`game/systems/party-recompensas.mjs`): XP por fórmula, sorteio de item, divisão de ouro.
//   node tools/simular-party.mjs
import { partesDeXp, sortearDono, dividirOuro, proximoInicioDoResto } from '../game/systems/party-recompensas.mjs';

const formulas = [['linear (k=1)', 1], ['nível^1,25', 1.25], ['nível^1,5 (adotada)', 1.5], ['nível^2', 2]];
const cenarios = [
  ['A/B/C/D = 10/30/60/100', [10, 30, 60, 100]],
  ['dois iguais 50/50', [50, 50]],
  ['diferença pequena 50/55', [50, 55]],
  ['diferença extrema 5/300', [5, 300]],
  ['um alto + três iniciantes 200/10/10/10', [200, 10, 10, 10]],
  ['cinco iguais 80', [80, 80, 80, 80, 80]],
];
console.log('== XP: fatia de cada integrante (igual dividiria 100/n %) ==');
for (const [nome, niveis] of cenarios) {
  console.log(`\n${nome}`);
  for (const [f, k] of formulas) console.log(`  ${f.padEnd(22)} ${partesDeXp(niveis, k).map((x, i) => `L${niveis[i]}=${(x * 100).toFixed(1)}%`).join('  ')}`);
}
console.log('\n== XP em valores: bicho de 10.000 de exp, party 10/30/60/100 ==');
for (const total of [1000, 10000, 100000]) {
  console.log(`  total ${total}: ` + formulas.map(([f, k]) => `${f.split(' ')[0]}[${partesDeXp([10, 30, 60, 100], k).map((x) => Math.round(x * total)).join('/')}]`).join('  '));
}

let s = 12345;
const rng = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
console.log('\n== Item: 1.000.000 de drops sorteados (uniforme) ==');
for (let n = 2; n <= 5; n++) {
  const c = Array.from({ length: n }, (_, i) => i);
  const levou = Array(n).fill(0);
  for (let i = 0; i < 1_000_000; i++) levou[sortearDono(c, rng)]++;
  console.log(`  ${n} jogadores: ${levou.map((x) => `${(x / 10000).toFixed(2)}%`).join('  ')} (ideal ${(100 / n).toFixed(2)}%)`);
}
console.log('\n== Ouro: 1.001 de ouro por evento, 4 jogadores, 1.000 eventos ==');
const acum = [0, 0, 0, 0];
let inicio = 0;
for (let i = 0; i < 1000; i++) {
  dividirOuro(1001, 4, inicio).forEach((v, k) => (acum[k] += v));
  inicio = proximoInicioDoResto(1001, 4, inicio);
}
console.log(`  acumulado ${acum.join(' / ')}  soma ${acum.reduce((a, b) => a + b, 0)} (original ${1001 * 1000})`);
