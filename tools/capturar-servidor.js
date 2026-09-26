// Captura ao vivo de TUDO que só existe do lado do servidor — magias/runas da
// barra (`actionCatalog`), receitas de forja/craft/desmanche, árvore, gemas,
// charms, loja, mercado, blessings, tokens, tasks, proficiência, montarias,
// NPCs e ranking.
//
// Como usar: logado em ravoxidle.com.br/jogar e dentro do personagem, colar
// este arquivo no Console (F12). Se `window.__RAVOX_DESTINO` apontar para o
// receptor local (tools/receptor.mjs), grava direto em api-mapeada/; senão
// baixa `captura-servidor-<voc>.json`. `window.__RAVOX_SO` (lista de rótulos)
// limita a captura a só esses pedidos.
//
// SÓ LEITURA: nenhum pedido aqui compra, aplica, aceita ou gasta nada — são os
// mesmos `send({t:...})` sem `action` que o cliente manda ao ABRIR cada painel.
//
// O jogo reconecta sozinho (e o servidor derruba a conexão em alguns pedidos,
// ex.: falar com NPC estando dentro de uma hunt), então o socket NÃO é pego uma
// vez só: todo `send` do cliente atualiza qual é o socket vivo, e pedido sem
// resposta é repetido na conexão nova.
(async () => {
  const ESPERA = 1500;
  const IGNORAR = new Set(['state', 'pong', 'online', 'presenca', 'chat', 'events', 'audio', 'hello', 'welcome']);
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => { (window.__capturaLog ??= []).push(a.join(' ')); console.log('[captura]', ...a); };

  let caixa = [];
  let ultimoState = null;
  const ouvidos = new WeakSet();
  let vivo = null;
  let chegou = null;
  const ouvir = (ws) => {
    vivo = ws;
    window.__capturaVivo = ws;
    if (ouvidos.has(ws)) return;
    ouvidos.add(ws);
    ws.addEventListener('message', (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      const t = m.t ?? m.type;
      if (t === 'state') { ultimoState = m; return; }
      if (IGNORAR.has(t)) return;
      caixa.push(m);
      // Resolve assim que a resposta chega: aba em segundo plano tem os timers
      // estrangulados pelo navegador (1/min), então esperar tempo fixo não serve.
      if (chegou) { const r = chegou; chegou = null; queueMicrotask(r); }
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
  log('esperando o jogo usar o socket...');
  while (!vivo || vivo.readyState !== 1) await dormir(300);

  const saida = { capturadoEm: new Date().toISOString(), respostas: {} };
  async function pedir(rotulo, msg) {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      while (!vivo || vivo.readyState !== 1) await dormir(500);
      caixa = [];
      const resposta = new Promise((r) => { chegou = r; setTimeout(r, ESPERA); });
      window.__capturaSendOriginal.call(vivo, JSON.stringify(msg));
      await resposta;
      chegou = null;
      if (caixa.length) break;
    }
    saida.respostas[rotulo] = { pedido: msg, recebido: caixa };
    log(`${rotulo}: ${caixa.length} msg (${caixa.map((m) => m.t ?? m.type).join(',')})`);
    return caixa;
  }

  const SO = window.__RAVOX_SO ? new Set(window.__RAVOX_SO) : null;
  const quer = (rotulo) => !SO || SO.has(rotulo) || [...SO].some((p) => p.endsWith('*') && rotulo.startsWith(p.slice(0, -1)));

  const PEDIDOS = [
    ['actionCatalog', { t: 'actions' }],
    ['forja', { t: 'forja' }],
    ['craft', { t: 'craft', vocacao: null }],
    ['desmanche', { t: 'desmanche' }],
    ['forjaAfixos', { t: 'forjaAfixos' }],
    ['arvore', { t: 'arvore' }],
    ['gemas', { t: 'gemas' }],
    ['charms', { t: 'charms' }],
    ['store', { t: 'store' }],
    ['historicoDaLoja', { t: 'historicoDaLoja' }],
    ['market-browse', { t: 'market', action: 'browse' }],
    ['market-historico', { t: 'market', action: 'historico' }],
    ['coinMarket', { t: 'coinMarket', pagina: 1 }],
    ['blessings', { t: 'blessings' }],
    ['bossToken', { t: 'bossToken' }],
    ['taskToken', { t: 'taskToken' }],
    ['tasksDeBicho', { t: 'tasksDeBicho' }],
    ['proficiency', { t: 'proficiency' }],
    ['mounts', { t: 'mounts' }],
    ['imbuements', { t: 'imbuements' }],
  ];
  for (const v of ['knight', 'paladin', 'sorcerer', 'druid', 'monk']) PEDIDOS.push([`craft-${v}`, { t: 'craft', vocacao: v }]);
  for (const c of ['exp', 'level', 'magic', 'sword', 'axe', 'club', 'distance', 'fist', 'shielding', 'fishing'])
    PEDIDOS.push([`ranking-${c}`, { t: 'ranking', category: c }]);
  for (const [rotulo, msg] of PEDIDOS) if (quer(rotulo)) await pedir(rotulo, msg);

  // Proficiência arma a arma (a lista vem na primeira resposta).
  if (quer('proficiency-*')) {
    const prof = saida.respostas.proficiency?.recebido.find((m) => m.list) ?? (await pedir('proficiency', { t: 'proficiency' })).find((m) => m.list);
    const ids = [...new Set((prof?.list ?? []).map((e) => e.itemId ?? e.id).filter(Boolean))];
    for (const itemId of ids) await pedir(`proficiency-${itemId}`, { t: 'proficiency', itemId });
  }

  // Por último: o servidor pode derrubar a conexão se o personagem não estiver
  // perto do NPC (ou estiver numa hunt).
  for (const id of ['naji', 'zuma']) if (quer(`npc-${id}`)) await pedir(`npc-${id}`, { t: 'falarComNpc', id });

  saida.ultimoState = ultimoState;
  const voc = ultimoState?.character?.vocation ?? 'desconhecida';
  const nome = window.__RAVOX_NOME ?? `captura-servidor-${voc}.json`;
  const corpo = JSON.stringify(saida, null, 1);
  window.__capturaRavox = saida;
  if (window.__RAVOX_DESTINO) {
    const r = await fetch(`${window.__RAVOX_DESTINO}?nome=${nome}`, { method: 'POST', body: corpo });
    log('FIM enviado ao receptor:', await r.text());
    return;
  }
  const blob = new Blob([corpo], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  log('FIM arquivo baixado');
})().catch((e) => (window.__capturaLog ??= []).push('ERRO ' + e));
