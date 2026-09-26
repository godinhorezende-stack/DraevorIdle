// Prepara o personagem de medição (conta perf@teste.local, "Perfteste", level 300,
// vida infinita) e o deixa caçando offline. Imprime o token para os outros scripts.
// Uso (servidor em :8080): node tools/perf/preparar-personagem.mjs [huntId=werelions-1]
// Cria conta+personagem, sobe pro level 300 e deixa caçando (offline) em uma hunt.
import WebSocket from '../../server/node_modules/ws/wrapper.mjs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
const HUNT = process.argv[2] ?? 'werelions-1';
const email = 'perf@teste.local', senha = 'perf-teste-123', nome = 'Perfteste';
const ws = new WebSocket('ws://localhost:8080/ws');
await new Promise((r) => ws.on('open', r));
const s = (m) => ws.send(JSON.stringify(m));
const esperar = (...t) => new Promise((ok) => { const f = (d) => { const m = JSON.parse(d); if (t.includes(m.t)) { ws.off('message', f); ok(m); } }; ws.on('message', f); });
let r = esperar('account', 'authError'); s({ t: 'register', email, password: senha, confirm: senha }); let a = await r;
if (a.t !== 'account') { r = esperar('account'); s({ t: 'login', email, password: senha }); a = await r; }
r = esperar('account', 'authError'); s({ t: 'createCharacter', name: nome, vocation: 'knight', sex: 'male' }); await r;
const db = new DatabaseSync(fileURLToPath(new URL('../../server/dados/jogo.db', import.meta.url)));
const row = db.prepare('select id, estado from personagens where nome = ?').get(nome);
const e = JSON.parse(row.estado); e.level = 300; e.hp = e.maxHp = 1e9; e.hunt = null;
db.prepare('update personagens set estado = ? where id = ?').run(JSON.stringify(e), row.id);
r = esperar('welcome'); s({ t: 'play', name: nome }); await r;
s({ t: 'startHunt', huntId: HUNT, strategy: 'nearest', mode: 'single', ids: null, limites: [] });
await new Promise((ok) => setTimeout(ok, 1500));
s({ t: 'release' });
await new Promise((ok) => setTimeout(ok, 500));
console.log(JSON.stringify({ token: a.token, nome }));
process.exit(0);
