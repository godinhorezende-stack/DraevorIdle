// Grava um perfil de CPU do servidor rodando (iniciado com `node --inspect=127.0.0.1:9229 index.mjs`)
// durante `segundos`, e mostra as funções que mais gastam.
// Uso: node tools/perfil-servidor.mjs [segundos=15] [arquivo.cpuprofile]
import WebSocket from '../server/node_modules/ws/wrapper.mjs';
import { writeFileSync } from 'node:fs';

const SEGUNDOS = Number(process.argv[2] ?? 15);
const [alvo] = await (await fetch('http://127.0.0.1:9229/json')).json();
const ws = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise((r) => ws.on('open', r));
let id = 0;
const pedir = (method, params = {}) => new Promise((ok) => {
  const meu = ++id;
  const f = (d) => { const m = JSON.parse(d.toString()); if (m.id === meu) { ws.off('message', f); ok(m.result); } };
  ws.on('message', f);
  ws.send(JSON.stringify({ id: meu, method, params }));
});
await pedir('Profiler.enable');
await pedir('Profiler.setSamplingInterval', { interval: 200 });
await pedir('Profiler.start');
await new Promise((r) => setTimeout(r, SEGUNDOS * 1000));
const { profile } = await pedir('Profiler.stop');
ws.close();
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(profile));

const porNo = new Map(profile.nodes.map((n) => [n.id, n]));
const pai = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) pai.set(c, n.id);
const proprio = {};
const total = {};
const nome = (n) => `${n.callFrame.functionName || '(anônima)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`;
for (let i = 0; i < profile.samples.length; i++) {
  const dt = (profile.timeDeltas[i] ?? 0) / 1000;
  let n = porNo.get(profile.samples[i]);
  proprio[nome(n)] = (proprio[nome(n)] ?? 0) + dt;
  const vistos = new Set();
  while (n) {
    const k = nome(n);
    if (!vistos.has(k)) { total[k] = (total[k] ?? 0) + dt; vistos.add(k); }
    n = porNo.get(pai.get(n.id));
  }
}
const ms = SEGUNDOS * 1000;
const ocioso = proprio['(idle) :0'] ?? 0;
console.log(`CPU ocupada: ${(((ms - ocioso) / ms) * 100).toFixed(0)}% de ${SEGUNDOS}s`);
console.log('--- tempo próprio:');
for (const [k, v] of Object.entries(proprio).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`${v.toFixed(0).padStart(7)} ms  ${k}`);
console.log('--- tempo total (com o que chama):');
for (const [k, v] of Object.entries(total).filter(([k]) => /\.mjs/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log(`${v.toFixed(0).padStart(7)} ms  ${k}`);
