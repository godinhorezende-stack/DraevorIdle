// Mede quanto a volta de um personagem com 2h de caçada offline trava o servidor
// para OS OUTROS jogadores (pior ping de uma segunda conexão durante o `play`).
// Uso: [HORAS=2] node tools/perf/login-offline.mjs <token de preparar-personagem.mjs>   (HORAS=0: login sem caçada offline)
import WebSocket from '../../node_modules/ws/wrapper.mjs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync(fileURLToPath(new URL('../../game/database/dados/jogo.db', import.meta.url)));
const row = db.prepare("select id, estado from personagens where nome = 'Perfteste'").get();
const e = JSON.parse(row.estado);
if (!e.hunt) { console.log('sem hunt'); process.exit(); }
const HORAS = Number(process.env.HORAS ?? 2);
if (HORAS > 0) e.hunt.offlineDesde = Date.now() - HORAS * 3600_000; else delete e.hunt.offlineDesde;
db.prepare('update personagens set estado = ? where id = ?').run(JSON.stringify(e), row.id);
// um "outro jogador" medindo o ping durante o login
const obs = new WebSocket('ws://localhost:8080/ws'); await new Promise((r) => obs.on('open', r));
let pior = 0; obs.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'pong') pior = Math.max(pior, performance.now() - m.at); });
const pinga = setInterval(() => obs.send(JSON.stringify({ t: 'ping', at: performance.now() })), 20);
const ws = new WebSocket('ws://localhost:8080/ws'); await new Promise((r) => ws.on('open', r));
const s = (m) => ws.send(JSON.stringify(m));
s({ t: 'resume', token: process.argv[2] });
await new Promise((r) => setTimeout(r, 600));
const t0 = performance.now();
const w = new Promise((ok) => ws.on('message', (d) => { if (JSON.parse(d).t === 'welcome') ok(); }));
s({ t: 'play', name: 'Perfteste' }); await w;
console.log(`play→welcome com ${HORAS}h offline:`, (performance.now() - t0).toFixed(0), 'ms; pior ping de OUTRO jogador no período:', pior.toFixed(0), 'ms');
clearInterval(pinga); s({ t: 'release' }); setTimeout(() => process.exit(0), 300);
