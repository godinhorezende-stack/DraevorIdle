// Perfil do CLIENTE no Chromium (Playwright): CPU, layout/estilo, heap, drawImage/s,
// rAF/s, long tasks, mensagens do WebSocket e as funções que mais gastam.
// Uso: node tools/perf/perfil-cliente.mjs <token> Perfteste [desktop|mobile] [segundos] [rótulo]
//   mobile = 412x915, CPU 4x mais lenta, DPR = $DPR (padrão 3). PLAYWRIGHT=<caminho> se não estiver instalado.
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
import { writeFileSync } from 'node:fs';
const [token, nome, modo = 'desktop', SEG = '20', rotulo = 'x'] = process.argv.slice(2);
const mobile = modo === 'mobile';
const b = await chromium.launch({ args: ['--enable-precise-memory-info'] });
const ctx = await b.newContext(mobile ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: Number(process.env.DPR ?? 3), isMobile: true, hasTouch: true } : { viewport: { width: 1366, height: 768 } });
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(e.message));
await p.addInitScript(([t, n]) => {
  localStorage.setItem('ravox:token', t); localStorage.setItem('ravox:character', n);
  window.__rafs = 0; const loop = () => { window.__rafs++; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  window.__long = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(e.duration); }).observe({ entryTypes: ['longtask'] }); } catch {}
  // conta drawImage no canvas
  window.__draws = 0; const d = CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage = function (...a) { window.__draws++; return d.apply(this, a); };
  window.__mut = 0; addEventListener('DOMContentLoaded', () => new MutationObserver((l) => { window.__mut += l.length; }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true }));
}, [token, nome]);
const cdp = await ctx.newCDPSession(p);
await cdp.send('Performance.enable');
await cdp.send('Network.enable');
const ws = { n: 0, bytes: 0, tipos: {}, enviados: 0 };
cdp.on('Network.webSocketFrameReceived', (e) => { ws.n++; ws.bytes += e.response.payloadData.length; try { const t = JSON.parse(e.response.payloadData).t; ws.tipos[t] = (ws.tipos[t] ?? 0) + 1; } catch {} });
cdp.on('Network.webSocketFrameSent', () => ws.enviados++);
if (mobile) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.goto('http://localhost:8080/jogar');
await p.waitForTimeout(4000); await p.getByText(nome, { exact: true }).first().click().catch(() => {}); await p.waitForTimeout(10000);
await p.screenshot({ path: `./tela-${rotulo}.png` });
const met = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
await p.evaluate(() => { window.__rafs = 0; window.__long = []; window.__draws = 0; window.__mut = 0; });
Object.assign(ws, { n: 0, bytes: 0, tipos: {}, enviados: 0 });
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
const m0 = await met();
await p.waitForTimeout(Number(SEG) * 1000);
const m1 = await met();
const { profile } = await cdp.send('Profiler.stop');
writeFileSync(`./cli-${rotulo}.cpuprofile`, JSON.stringify(profile));
const pg = await p.evaluate(() => ({ rafs: window.__rafs, long: window.__long, draws: window.__draws, mut: window.__mut, nodes: document.getElementsByTagName('*').length, canvases: document.querySelectorAll('canvas').length, overlay: (() => { const o = document.getElementById('map-overlay'); return o ? `${o.width}x${o.height}` : null; })(), fpsJogo: document.querySelector('#medidor-fps, .medidor-fps')?.textContent }));
const d = (k) => (m1[k] - m0[k]);
const seg = Number(SEG);
console.log(JSON.stringify({ modo, seg,
  cpu_ocupada_pct: +(d('TaskDuration') / seg * 100).toFixed(1),
  script_ms_s: +(d('ScriptDuration') * 1000 / seg).toFixed(0), layout_ms_s: +(d('LayoutDuration') * 1000 / seg).toFixed(0), style_ms_s: +(d('RecalcStyleDuration') * 1000 / seg).toFixed(0),
  layouts_s: +(d('LayoutCount') / seg).toFixed(1), recalcs_s: +(d('RecalcStyleCount') / seg).toFixed(1),
  heapMB: +(m1.JSHeapUsedSize / 1048576).toFixed(0), heapDeltaMB: +(d('JSHeapUsedSize') / 1048576).toFixed(1), domNodes: m1.Nodes, listeners: m1.JSEventListeners,
  rAF_s: +(pg.rafs / seg).toFixed(0), drawImage_s: Math.round(pg.draws / seg), mutacoes_s: Math.round(pg.mut / seg),
  longtasks: pg.long.length, longtask_max: Math.round(Math.max(0, ...pg.long)), overlay: pg.overlay,
  ws_rx_msgs_s: +(ws.n / seg).toFixed(1), ws_rx_KB_s_descomprimido: +(ws.bytes / 1024 / seg).toFixed(1), ws_tx_msgs_s: +(ws.enviados / seg).toFixed(1), tipos: ws.tipos, erros: erros.slice(0, 3) }, null, 0));
// top funções por tempo próprio
const porNo = new Map(profile.nodes.map((n) => [n.id, n])); const prop = {};
for (let i = 0; i < profile.samples.length; i++) { const n = porNo.get(profile.samples[i]); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`; prop[k] = (prop[k] ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000; }
for (const [k, v] of Object.entries(prop).sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log(v.toFixed(0).padStart(7), 'ms', k);
await b.close();
