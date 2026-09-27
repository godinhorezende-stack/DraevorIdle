// Teste de carga: N jogadores ao mesmo tempo no servidor local, caçando (modo
// padrão) ou parados na praça (`cidade`, Fase 4: mede o custo de
// `jogadoresNaPraca`/`chat` com muita gente no mesmo lugar). Cria N contas de
// teste (carga-N@teste.local), sobe cada personagem para o level 600 com vida
// infinita e mede, do lado do cliente, o intervalo entre `state` (o ritmo do
// jogo — o alvo é 250ms) e o ping (atraso do servidor para responder). No fim
// apaga tudo.
//
// Uso (com o servidor rodando em :8080):
//   node tools/carga.mjs [N=20] [segundos=20] [modo=cacada|cidade]
import WebSocket from '../node_modules/ws/wrapper.mjs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const N = Number(process.argv[2] ?? 20);
const SEGUNDOS = Number(process.argv[3] ?? 20);
const MODO = process.argv[4] ?? 'cacada';
const URL_WS = process.env.URL_WS ?? 'ws://localhost:8080/ws';
const DB = fileURLToPath(new URL('../game/database/dados/jogo.db', import.meta.url));
const HUNTS = ['werelions-1', 'roshamuul-cave', 'golems-catacombs', 'deeper-banuta-8', 'spike-8', 'winter-dream-court', 'asura-palace', 'zaoan-draken-walls'];
const SENHA = 'carga-teste-123';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function conectar() {
  const ws = new WebSocket(URL_WS);
  await new Promise((ok, erro) => { ws.on('open', ok); ws.on('error', erro); });
  ws.s = (m) => ws.send(JSON.stringify(m));
  // Espera a próxima mensagem do tipo `t` (como o cliente, que só segue depois da resposta).
  ws.esperar = (...tipos) => new Promise((ok) => {
    const f = (d) => { const m = JSON.parse(d.toString()); if (tipos.includes(m.t)) { ws.off('message', f); ok(m); } };
    ws.on('message', f);
    setTimeout(() => { ws.off('message', f); ok(null); }, 15000);
  });
  ws.s({ t: 'delta', on: true, sessao: true, fundo: true });
  ws.s({ t: 'jaTenhoCatalogo' });
  ws.s({ t: 'oculta', on: false });
  return ws;
}
const email = (i) => `carga-${i}@teste.local`;
const nome = (i) => `Carga${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`;

// 1. Contas e personagens (em série: é só a preparação).
for (let i = 0; i < N; i++) {
  const ws = await conectar();
  let r = ws.esperar('account', 'authError');
  ws.s({ t: 'register', email: email(i), password: SENHA, confirm: SENHA });
  if ((await r)?.t !== 'account') {
    r = ws.esperar('account', 'authError');
    ws.s({ t: 'login', email: email(i), password: SENHA });
    await r;
  }
  r = ws.esperar('account', 'authError');
  ws.s({ t: 'createCharacter', name: nome(i), vocation: 'knight', sex: 'male' });
  await r;
  ws.close();
}
await dormir(500);
const db = new DatabaseSync(DB);
for (let i = 0; i < N; i++) {
  const r = db.prepare('select id, estado from personagens where nome = ?').get(nome(i));
  const e = JSON.parse(r.estado);
  e.level = 600; e.hp = e.maxHp = 1e9;
  db.prepare('update personagens set estado = ? where id = ?').run(JSON.stringify(e), r.id);
}

// 2. Todos caçando.
const jogadores = [];
for (let i = 0; i < N; i++) {
  const ws = await conectar();
  ws.intervalos = []; ws.pings = []; ws.bytes = 0;
  let ultimo = 0;
  ws.on('message', (d) => {
    ws.bytes += d.length;
    const m = JSON.parse(d.toString());
    if (m.t === 'state') { const agora = performance.now(); if (ultimo) ws.intervalos.push(agora - ultimo); ultimo = agora; }
    if (m.t === 'pong') ws.pings.push(performance.now() - m.at);
  });
  let r = ws.esperar('account', 'authError');
  ws.s({ t: 'login', email: email(i), password: SENHA });
  await r;
  r = ws.esperar('welcome', 'authError');
  ws.s({ t: 'play', name: nome(i) });
  await r;
  if (MODO === 'cidade') {
    // Fica na praça, perto de todo mundo (o caso caro de `jogadoresNaPraca`:
    // até 25 outros na tela, todos disputando a mesma vizinhança) — anda de
    // vez em quando, como jogador de verdade parado esperando (não todo
    // mundo dançando em sincronia a cada 600ms: cada um no seu próprio
    // intervalo, a maioria dos "passos" na verdade parando). Um em cada 10
    // fala no Global de vez em quando, para pesar também o `chat` (item 4.3).
    ws.andarEm = setInterval(() => {
      const anda = Math.random() < 0.35;
      ws.s({ t: 'walk', dx: anda ? Math.round(Math.random() * 2) - 1 : 0, dy: anda ? Math.round(Math.random() * 2) - 1 : 0 });
    }, 2000 + Math.random() * 2000);
    if (i % 10 === 0) ws.falarEm = setInterval(() => ws.s({ t: 'chat', channel: 'global', text: `oi de ${nome(i)}` }), 2000);
  } else {
    ws.s({ t: 'startHunt', huntId: HUNTS[i % HUNTS.length], strategy: 'nearest', mode: 'single', ids: null, limites: [] });
  }
  jogadores.push(ws);
}
await dormir(3000);
for (const j of jogadores) { j.intervalos.length = 0; j.pings.length = 0; j.bytes = 0; }
const bytesNoFio = () => jogadores.reduce((a, j) => a + j._socket.bytesRead, 0);
const fio0 = bytesNoFio();
const pinga = setInterval(() => { for (const j of jogadores) j.s({ t: 'ping', at: performance.now() }); }, 500);
await dormir(SEGUNDOS * 1000);
clearInterval(pinga);
for (const j of jogadores) { clearInterval(j.andarEm); clearInterval(j.falarEm); }
const fio = bytesNoFio() - fio0;

const est = (l) => {
  const o = [...l].sort((a, b) => a - b);
  const p = (x) => o[Math.floor(x * (o.length - 1))]?.toFixed(0);
  return `p50 ${p(0.5)}  p90 ${p(0.9)}  p99 ${p(0.99)}  máx ${o.at(-1)?.toFixed(0)}`;
};
console.log(`${N} jogadores (${MODO}) por ${SEGUNDOS}s:`);
console.log(`  intervalo entre states (ms, alvo 250): ${est(jogadores.flatMap((j) => j.intervalos))}`);
console.log(`  ping (ms):                             ${est(jogadores.flatMap((j) => j.pings))}`);
console.log(`  tráfego no fio: ${(fio / 1024 / SEGUNDOS / N).toFixed(2)} KB/s por jogador`);
try {
  const saude = await (await fetch(URL_WS.replace('ws', 'http').replace('/ws', '/saude'))).json();
  console.log('  /saude:', JSON.stringify(saude));
} catch {}

// 3. Limpeza.
if (MODO !== 'cidade') for (const j of jogadores) j.s({ t: 'stopHunt' });
await dormir(800);
for (const j of jogadores) j.close();
await dormir(1500);
for (let i = 0; i < N; i++) {
  const c = db.prepare('select id from contas where email = ?').get(email(i));
  if (!c) continue;
  for (const [t, col] of [['personagens', 'conta'], ['sessoes', 'conta'], ['contas', 'id']]) db.prepare(`delete from ${t} where ${col} = ?`).run(c.id);
}
console.log('  contas de teste apagadas');
