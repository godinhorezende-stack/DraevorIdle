// Captura o MAPA COMPLETO (`state.hunt.map`: paleta, pilhas, colisão, rota) de
// cada hunt que o nível do personagem libera — o mesmo formato de
// `gamedata/hunts/troll-cave-map.json`. O atlas de cada hunt é arquivo estático
// público (`/gamedata/sprites/hunts/<id>.png`) e se baixa à parte, sem login.
//
// Uso: logado e dentro do personagem, com `tools/receptor.mjs` rodando, colar
// no Console. Para cada hunt: `stopHunt` → `startHunt` no modo online (o
// personagem fica parado, não sai atrás de bicho) → `pedirMapa` → grava →
// próxima. No fim devolve o personagem para `window.__RAVOX_VOLTAR`
// (padrão: a hunt em que ele estava ao começar, lida do `state`).
//
// ATENÇÃO: mexe no jogo de verdade — encerra a caçada atual e entra em hunts.
// Rodar só com autorização do dono do personagem.
(async () => {
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => { (window.__huntsLog ??= []).push(a.join(' ')); console.log('[hunts]', ...a); };
  const DESTINO = window.__RAVOX_DESTINO ?? 'http://localhost:8765/';
  let VOLTAR = window.__RAVOX_VOLTAR ?? null;
  const JA_TEM = new Set(window.__RAVOX_JA_TEM ?? ['troll-cave', 'amazon-camp']);

  // Mesmo rastreio de socket do capturar-servidor.js (o jogo reconecta sozinho).
  let vivo = null;
  const ouvidos = new WeakSet();
  const esperas = new Set();
  const ouvir = (ws) => {
    vivo = ws;
    window.__capturaVivo = ws;
    if (ouvidos.has(ws)) return;
    ouvidos.add(ws);
    ws.addEventListener('message', (ev) => {
      if (!esperas.size) return;
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      for (const e of [...esperas]) if (e.filtro(m)) { esperas.delete(e); e.resolve(m); }
    });
  };
  if (!window.__capturaSendOriginal) {
    window.__capturaSendOriginal = WebSocket.prototype.send;
    WebSocket.prototype.send = function (d) {
      window.__capturaOuvir?.(this);
      return window.__capturaSendOriginal.call(this, d);
    };
  }
  window.__capturaOuvir = ouvir;
  // Um script anterior já achou o socket: aba no fundo quase não manda nada sozinha.
  if (window.__capturaVivo?.readyState === 1) ouvir(window.__capturaVivo);
  while (!vivo || vivo.readyState !== 1) await dormir(300);

  /** Espera a primeira mensagem que passar no filtro (ou null no prazo). */
  const esperar = (filtro, ms) => new Promise((resolve) => {
    const e = { filtro, resolve };
    esperas.add(e);
    setTimeout(() => { if (esperas.delete(e)) resolve(null); }, ms);
  });
  const enviar = (msg) => window.__capturaSendOriginal.call(vivo, JSON.stringify(msg));
  // O mapa da cidade tem o mesmo formato; só vale o que for DESTA hunt
  // (o atlas vem com sufixo do modo: `hunts/dark-pyramid-online`).
  const mapaDe = (id) => (m) => m.t === 'state' && m.hunt?.map?.palette && String(m.hunt.map.atlas).startsWith(`hunts/${id}`);

  // A lista de hunts só chega no `hello` (na conexão): vem de fora,
  // `window.__RAVOX_HUNTS = [{id, level}, ...]` (do catalog-real.json).
  const hunts = (window.__RAVOX_HUNTS ?? []).filter((h) => !JA_TEM.has(h.id ?? h));
  const nivel = window.__RAVOX_NIVEL ?? Infinity;

  // Onde o personagem está agora, para devolver no fim (sem hunt: fica na cidade).
  if (!VOLTAR) {
    // A resposta do `pedirMapa` não traz `huntId`, só o atlas (`hunts/<id>[-online]`).
    const agora = esperar((m) => m.t === 'state' && m.hunt?.map?.atlas, 6000);
    enviar({ t: 'pedirMapa' });
    const atlas = String((await agora)?.hunt.map.atlas ?? '');
    const id = atlas.startsWith('hunts/') ? atlas.slice(6).replace(/-online$/, '') : null;
    if (id) VOLTAR = { huntId: id, mode: atlas.endsWith('-online') ? 'online' : 'cycle', ids: [id] };
    log('voltar para:', JSON.stringify(VOLTAR));
  }
  const resultado = { ok: [], recusadas: {}, semMapa: [] };

  for (const h of hunts) {
    const id = h.id ?? h;
    if ((h.level ?? 0) > nivel) { resultado.recusadas[id] = `level ${h.level}`; continue; }
    enviar({ t: 'stopHunt' });
    await esperar((m) => m.t === 'state' || m.t === 'runReport', 3000);
    const resposta = esperar((m) => m.t === 'error' || mapaDe(id)(m), 8000);
    enviar({ t: 'startHunt', huntId: id, strategy: 'nearest', mode: 'online', ids: null, limites: [] });
    const r = await resposta;
    if (r?.t === 'error') { resultado.recusadas[id] = r.message ?? r.erro ?? r.text ?? JSON.stringify(r); log(id, 'recusada:', resultado.recusadas[id]); continue; }
    const mapa = r ?? await (async () => {
      const p = esperar(mapaDe(id), 15000);
      enviar({ t: 'pedirMapa' });
      return p;
    })();
    if (!mapa) { resultado.semMapa.push(id); log(id, 'sem mapa'); continue; }
    const corpo = JSON.stringify(mapa.hunt.map);
    await fetch(`${DESTINO}?nome=hunt-${id}-map.json`, { method: 'POST', body: corpo });
    resultado.ok.push(id);
    log(id, 'ok', corpo.length);
  }

  enviar({ t: 'stopHunt' });
  await esperar((m) => m.t === 'state' || m.t === 'runReport', 3000);
  if (VOLTAR) enviar({ t: 'startHunt', strategy: 'nearest', limites: [], ...VOLTAR });
  log('FIM', JSON.stringify(resultado));
  await fetch(`${DESTINO}?nome=hunts-resultado.json`, { method: 'POST', body: JSON.stringify(resultado, null, 1) });
})().catch((e) => (window.__huntsLog ??= []).push('ERRO ' + e));
