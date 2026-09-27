// Heap do servidor depois de um GC forçado (servidor iniciado com --inspect=127.0.0.1:9229).
// Rodar antes/depois de tools/carga.mjs várias vezes: se sobe a cada rodada, é vazamento.
// Uso: node tools/perf/memoria.mjs [rótulo]
import WebSocket from '../../node_modules/ws/wrapper.mjs';
const [alvo] = await (await fetch('http://127.0.0.1:9229/json')).json();
const ws = new WebSocket(alvo.webSocketDebuggerUrl);
await new Promise((r) => ws.on('open', r));
let id = 0;
const pedir = (method, params = {}) => new Promise((ok) => { const meu = ++id; const f = (d) => { const m = JSON.parse(d.toString()); if (m.id === meu) { ws.off('message', f); ok(m.result); } }; ws.on('message', f); ws.send(JSON.stringify({ id: meu, method, params })); });
await pedir('HeapProfiler.enable');
await pedir('HeapProfiler.collectGarbage');
const r = await pedir('Runtime.evaluate', { expression: 'JSON.stringify(process.memoryUsage())' });
const m = JSON.parse(r.result.value); for (const k in m) m[k] = (m[k]/1048576).toFixed(0)+'MB';
console.log(process.argv[2] ?? '', JSON.stringify(m));
ws.close();
