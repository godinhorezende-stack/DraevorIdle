// Microbenchmark de moverMonstros: quantos bichos cabem por tique antes da
// grade de ocupação (server/sistemas/hunt/monstros.mjs) valer a pena.
//
// Isolado de propósito — o teste de carga real (tools/carga.mjs) tem ruído
// demais (rede, banco, outras sessões) para comparar duas versões da mesma
// função. Aqui é só a função, com bichos de verdade colocados PERTO do
// jogador e já perseguindo (o caso que pesa; bicho espalhado longe nem entra
// no laço de movimento, e não exercita o `livre`).
//
// Uso: node tools/bench-mover-monstros.mjs [huntId=werelions-1] [N=500]
import { moverMonstros } from '../server/sistemas/hunt/monstros.mjs';
import { CATALOGO } from '../server/nucleo/dados.mjs';
import { gradeDaHunt } from '../server/sistemas/hunt/terreno.mjs';

const huntId = process.argv[2] ?? 'werelions-1';
const N = Number(process.argv[3] ?? 500);
const hd = CATALOGO.hunts.find((h) => h.id === huntId) ?? CATALOGO.bosses.find((b) => b.id === huntId) ?? { id: huntId };
const grade = gradeDaHunt(hd);
const casas = [...grade.andavel].map((k) => k.split(',').map(Number));

let semente = 7;
const acaso = () => ((semente = (semente * 1103515245 + 12345) >>> 0) / 2 ** 32);

const [px, py] = casas[Math.floor(casas.length / 2)];
// Só as casas a até 12 do jogador: uma leva de verdade, não bichos espalhados
// pelo mapa inteiro (a maioria nem tentaria andar).
const perto = casas.filter(([x, y]) => Math.max(Math.abs(x - px), Math.abs(y - py)) <= 12);
const alvo = perto.length >= N ? perto : casas;

const monstros = [];
for (let i = 0; i < N; i++) {
  const [x, y] = alvo[Math.floor(acaso() * alvo.length)];
  monstros.push({ uid: i + 1, key: 'rat', x, y, dir: 2, hp: 100, maxHp: 100, perseguindo: true, proximoPasso: 0, moveMs: 300 });
}
const hunt = { pos: { x: px, y: py, dir: 2 }, monstros, z: grade.z };

const REPETICOES = 200;
let agora = 1000;
const t0 = performance.now();
for (let i = 0; i < REPETICOES; i++) {
  agora += 250;
  moverMonstros(hunt, grade, agora);
}
const t1 = performance.now();
console.log(`${huntId}: ${N} bichos (perto do jogador, perseguindo), ${REPETICOES} tiques -> ${(t1 - t0).toFixed(1)} ms total, ${((t1 - t0) / REPETICOES).toFixed(3)} ms/tique`);
