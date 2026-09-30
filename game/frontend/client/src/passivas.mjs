/*
 * ---- A ÁRVORE DE PASSIVAS (etapa 7) ----
 *
 * Uma árvore só para todas as classes: um grafo de ~300 nós em volta dos cinco
 * inícios. A tela é UM canvas (e não um elemento por nó: centenas de nós em
 * DOM pesam), redesenhado só quando algo muda — arrastar, zoom, selecionar,
 * resposta do servidor.
 *
 * O servidor é quem decide (`systems/passivas/`): daqui só sai "alocar este
 * caminho", "o que sairia se eu tirasse isto" e "tira". O caminho mostrado ao
 * clicar num nó longe é o mesmo menor caminho que o servidor aceita, nó por
 * nó, cada um validado lá.
 *
 * Os nós (a árvore em si, ~120 KB) vêm uma vez por sessão
 * (`{t:'passivas', action:'arvore'}`); depois, só a vista do personagem.
 */

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

let ctx = null;
let tela = null;

export function initPassivas(context) {
  ctx = context;
}

// ---------------------------------------------------------------- os textos

const TAGS = { physical: 'Physical', fire: 'Fire', ice: 'Ice', earth: 'Earth', energy: 'Energy', holy: 'Holy', death: 'Death', melee: 'Melee', ranged: 'Ranged', spell: 'Spell', area: 'Área', projectile: 'Projétil', single: 'Alvo único', chain: 'Cadeia' };
const STATS = { armour: 'Armour', life: 'Life', accuracy: 'Accuracy', evasion: 'Evasion', attackSpeed: 'Attack Speed', castSpeed: 'Cast Speed', moveSpeed: 'Movement Speed', healing: 'Cura' };
// [rótulo, sufixo] — sufixo '%' quando o add é em %.
const ADDS = {
  str: ['STR', ''], dex: ['DEX', ''], int: ['INT', ''],
  crit_chance: ['Critical Chance', '%'], crit_dmg: ['Critical Damage', '%'],
  life_leech: ['Life Leech', '%'], mana_leech: ['Mana Leech', '%'],
  cooldown_recovery: ['Cooldown Recovery', '%'], skill_cost: ['Redução de custo das skills', '%'],
  skill_melee: ['Melee fighting', ''], skill_distance: ['Distance fighting', ''], skill_magic: ['Magic level', ''], skill_shielding: ['Shielding', ''],
  life: ['Vida', ''], mana: ['Mana', ''], energy_shield: ['Energy Shield', ''], es_pct: ['Energy Shield', '%'],
  block: ['Block Chance', '%'], life_regen_pct: ['Regeneração de vida', '%'], mana_regen_pct: ['Regeneração de mana', '%'],
  dmg_vs_boss: ['Dano contra boss', '%'], avoid_damage: ['Chance de evitar dano', '%'], move_speed: ['Movement Speed', '%'],
};
const LEGADO = { absorb: 'Absorção de dano', armorPenetration: 'Penetração de armadura', attackDamage: 'Todo dano causado', flechaAtravessa: 'Chance de a flecha atravessar' };
const TIPOS = { small: 'Pequeno', notable: 'Notável', keystone: 'Keystone', start: 'Início da classe' };
const num = (v) => (Math.round(v * 100) / 100).toLocaleString('pt-BR');

/** "+3% Fire Damage", "+5 STR"... — um efeito de nó em texto. */
export function textoDoEfeito(ef) {
  if (ef.tag) return `+${num(ef.dano)}% de dano ${TAGS[ef.tag] ?? ef.tag}`;
  if (ef.stat) return `+${num(ef.pct)}% ${STATS[ef.stat] ?? ef.stat}`;
  if (ef.add) {
    const [rotulo, suf] = ADDS[ef.add] ?? [ef.add, ''];
    return `+${num(ef.valor)}${suf} ${rotulo}`;
  }
  if (ef.legado) return `+${num(ef.valor * 100)}% ${LEGADO[ef.legado] ?? ef.legado}`;
  return '';
}
/** A chave de soma de um efeito (para o "o que a árvore dá") e o valor dela. */
const chaveDoEfeito = (ef) => (ef.tag ? [`tag:${ef.tag}`, ef.dano] : ef.stat ? [`stat:${ef.stat}`, ef.pct] : ef.add ? [`add:${ef.add}`, ef.valor] : ef.legado ? [`legado:${ef.legado}`, ef.valor] : [null, 0]);
const efeitoDaChave = (chave, v) => {
  const [tipo, k] = chave.split(':');
  return tipo === 'tag' ? { tag: k, dano: v } : tipo === 'stat' ? { stat: k, pct: v } : tipo === 'add' ? { add: k, valor: v } : { legado: k, valor: v };
};
const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ------------------------------------------------------------ a árvore local

/** A árvore que veio do servidor, com o mapa por id e as arestas (uma vez). */
function preparar(a) {
  const porId = new Map(a.nos.map((n) => [n.id, n]));
  const arestas = [];
  for (const n of a.nos) for (const c of n.conexoes) if (n.id < c) arestas.push([n, porId.get(c)]);
  for (const n of a.nos) n.busca = semAcento(`${n.nome} ${n.descricao ?? ''} ${n.efeitos.map(textoDoEfeito).join(' ')} ${n.tags.join(' ')}`);
  return { ...a, porId, arestas };
}

const arvore = () => ctx.state.passivasArvore ?? null;
const vista = () => ctx.state.passivas ?? ctx.state.character?.passivas ?? null;
const meus = () => new Set(vista()?.alocados ?? []);

/** O menor caminho de nós não alocados até `id` — o mesmo que o servidor aceita. */
function caminhoAte(id) {
  const a = arvore();
  const mine = meus();
  if (!a?.porId.has(id)) return null;
  if (mine.has(id)) return [];
  const veioDe = new Map();
  const fila = [...mine];
  for (const x of fila) veioDe.set(x, null);
  for (let i = 0; i < fila.length; i++) {
    for (const c of a.porId.get(fila[i])?.conexoes ?? []) {
      if (veioDe.has(c) || a.porId.get(c)?.tipo === 'start') continue;
      veioDe.set(c, fila[i]);
      if (c === id) {
        const caminho = [];
        for (let x = c; x && !mine.has(x); x = veioDe.get(x)) caminho.unshift(x);
        return caminho;
      }
      fila.push(c);
    }
  }
  return null;
}

/** O estado de um nó para a tela: alocado | disponivel | caminho | bloqueado. */
function estadoDoNo(n) {
  const mine = meus();
  if (mine.has(n.id)) return 'alocado';
  if (n.tipo === 'start') return 'bloqueado';
  return n.conexoes.some((c) => mine.has(c)) ? 'disponivel' : 'bloqueado';
}

// ------------------------------------------------------------------- abrir

export function openPassivas() {
  ctx.send({ t: 'passivas', action: arvore() ? 'ver' : 'arvore' });
  ctx.openModal('Árvore de Passivas', (body) => montar(body), () => {
    tela?.destruir();
    tela = null;
  }, 'passivas');
}

/** Resposta do servidor (`{t:'passivas'}`), chamada pelo main. */
export function aoReceberPassivas(msg) {
  if (msg.arvore) ctx.state.passivasArvore = preparar(msg.arvore);
  if (msg.view) {
    ctx.state.passivas = msg.view;
    if (ctx.state.character) ctx.state.character.passivas = msg.view;
  }
  if (tela) {
    if (msg.plano) tela.plano = msg.plano;
    tela.atualizar();
  }
}

// ------------------------------------------------------------------ a tela

const CORES = {
  fundo: '#0b1012', aresta: '#2d3a3f', arestaViva: '#d9a441', arestaPerto: '#4f7c70', caminho: '#3fbfa8',
  noFundo: '#172024', noBorda: '#3d4c52', alocado: '#e3ae48', alocadoBorda: '#fff0c2', disponivel: '#3fbfa8',
  busca: '#6fd7ff', selecionado: '#ffffff', texto: '#ccd6d8', textoFraco: '#6f8288', keystone: '#c070ff', inicio: '#e3ae48',
};
// A cor do miolo por cluster (o "ícone" do nó): o elemento/tema dele.
const COR_DO_CLUSTER = {
  fire: '#ff7a3c', ice: '#7fd0ff', earth: '#7fc05a', energy: '#b58cff', holy: '#ffe07a', death: '#9c7ab8', physical: '#c9b8a0',
  melee: '#e0795c', ranged: '#a5d46a', spell: '#6fa8ff', life: '#ff6f7d', armour: '#b0b8c0', evasion: '#8fe0c0', energy_shield: '#7ab8ff',
  critical: '#ff9f5a', attack_speed: '#f0c060', cast_speed: '#80c8ff', mana: '#4f8fd0', healing: '#7fe0a0', mobility: '#c0f080', accuracy: '#e8d880', anel: '#aab4b8',
};

function montar(body) {
  const raiz = el('div', 'pas');
  const barra = el('div', 'pas-barra');
  const pontos = el('div', 'pas-pontos');
  const busca = document.createElement('input');
  busca.type = 'search';
  busca.placeholder = 'Buscar nó (ex.: fire, life, keystone)';
  busca.className = 'pas-busca';
  const achados = el('span', 'pas-achados');
  const zoomMenos = el('button', 'ghost step', '−');
  const zoomMais = el('button', 'ghost step', '+');
  const centro = el('button', 'ghost', 'Meu início');
  const respecTudo = el('button', 'ghost danger', 'Respec completo');
  zoomMenos.title = 'Afastar';
  zoomMais.title = 'Aproximar';
  barra.append(pontos, busca, achados, zoomMenos, zoomMais, centro, respecTudo);
  const corpo = el('div', 'pas-corpo');
  const mapa = el('div', 'pas-mapa');
  const canvas = document.createElement('canvas');
  const balao = el('div', 'pas-balao');
  balao.hidden = true;
  const carregando = el('div', 'pas-carregando', 'Carregando a árvore…');
  mapa.append(canvas, balao, carregando);
  const info = el('aside', 'pas-info');
  corpo.append(mapa, info);
  raiz.append(barra, corpo, el('p', 'pas-dica', 'Arraste para mover · roda do mouse ou pinça para zoom · clique num nó para ver · dois cliques (ou o botão) aloca o caminho até ele.'));
  body.append(raiz);

  const g = canvas.getContext('2d');
  const cam = { x: 0, y: 0, zoom: 0.26, centrado: false };
  let selecionado = null;
  let sobre = null;
  let termo = '';
  let achadosLista = [];
  let achadoAtual = -1;
  let sujo = true;
  let quadro = 0;
  let largura = 0;
  let altura = 0;

  const t = {
    plano: null,
    atualizar() {
      if (!arvore()) return;
      carregando.hidden = true;
      if (!cam.centrado) centrar();
      desenharBarra();
      desenharInfo();
      pedir();
    },
    destruir() {
      cancelAnimationFrame(quadro);
      observador.disconnect();
    },
  };
  tela = t;

  // ---- câmera ----
  const paraTela = (n) => ({ x: (n.x - cam.x) * cam.zoom + largura / 2, y: (n.y - cam.y) * cam.zoom + altura / 2 });
  const paraMundo = (px, py) => ({ x: (px - largura / 2) / cam.zoom + cam.x, y: (py - altura / 2) / cam.zoom + cam.y });
  const limitarZoom = (z) => Math.max(0.12, Math.min(2.2, z));
  function centrar() {
    const inicio = arvore()?.porId.get(vista()?.inicio);
    if (!inicio) return;
    // A região da classe: um pouco para FORA do início, onde ficam os clusters dela.
    cam.x = inicio.x * 1.7;
    cam.y = inicio.y * 1.7;
    cam.zoom = largura < 500 ? 0.2 : 0.26;
    cam.centrado = true;
  }
  function zoomEm(fator, px = largura / 2, py = altura / 2) {
    const antes = paraMundo(px, py);
    cam.zoom = limitarZoom(cam.zoom * fator);
    const depois = paraMundo(px, py);
    cam.x += antes.x - depois.x;
    cam.y += antes.y - depois.y;
    pedir();
  }
  function irPara(n) {
    cam.x = n.x;
    cam.y = n.y;
    cam.zoom = Math.max(cam.zoom, 0.8);
    pedir();
  }

  // ---- desenho ----
  function pedir() {
    sujo = true;
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(desenhar);
  }
  const raio = (n) => ({ small: 9, notable: 15, keystone: 22, start: 20 })[n.tipo] * Math.max(0.55, Math.min(1.25, cam.zoom * 1.6));

  function forma(n, p, r) {
    g.beginPath();
    if (n.tipo === 'notable' || n.tipo === 'keystone') {
      g.moveTo(p.x, p.y - r);
      g.lineTo(p.x + r, p.y);
      g.lineTo(p.x, p.y + r);
      g.lineTo(p.x - r, p.y);
      g.closePath();
    } else if (n.tipo === 'start') {
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        g.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
      }
      g.closePath();
    } else g.arc(p.x, p.y, r, 0, Math.PI * 2);
  }

  function desenhar() {
    if (!sujo) return;
    sujo = false;
    const a = arvore();
    const dpr = window.devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = CORES.fundo;
    g.fillRect(0, 0, largura, altura);
    if (!a) return;
    const mine = meus();
    const caminho = new Set(selecionado && !mine.has(selecionado.id) ? caminhoAte(selecionado.id) ?? [] : []);
    const visivel = (p, folga) => p.x > -folga && p.y > -folga && p.x < largura + folga && p.y < altura + folga;

    // Os nomes dos clusters, grandes e fracos, quando se vê a árvore de longe.
    if (cam.zoom < 0.75) {
      g.font = `600 ${Math.round(13 + 10 * (0.75 - cam.zoom))}px Cinzel, Georgia, serif`;
      g.textAlign = 'center';
      g.fillStyle = 'rgba(204,214,216,0.28)';
      for (const c of a.clusters) {
        const p = paraTela(c);
        if (visivel(p, 80)) g.fillText(c.nome.toUpperCase(), p.x, p.y);
      }
    }

    // As arestas.
    g.lineCap = 'round';
    for (const [x, y] of a.arestas) {
      const px = paraTela(x);
      const py = paraTela(y);
      if (!visivel(px, 40) && !visivel(py, 40)) continue;
      const vx = mine.has(x.id);
      const vy = mine.has(y.id);
      if (vx && vy) {
        g.strokeStyle = CORES.arestaViva;
        g.lineWidth = 3.2;
      } else if ((caminho.has(x.id) || vx) && (caminho.has(y.id) || vy) && (caminho.has(x.id) || caminho.has(y.id))) {
        g.strokeStyle = CORES.caminho;
        g.lineWidth = 3;
      } else if (vx || vy) {
        g.strokeStyle = CORES.arestaPerto;
        g.lineWidth = 2;
      } else {
        g.strokeStyle = CORES.aresta;
        g.lineWidth = 1.6;
      }
      g.beginPath();
      g.moveTo(px.x, px.y);
      g.lineTo(py.x, py.y);
      g.stroke();
    }

    // Os nós.
    const achadosSet = new Set(achadosLista.map((n) => n.id));
    for (const n of a.nos) {
      const p = paraTela(n);
      if (!visivel(p, 40)) continue;
      const r = raio(n);
      const estado = estadoDoNo(n);
      const noCaminho = caminho.has(n.id);
      // Brilho do keystone e do início.
      if (n.tipo === 'keystone' || (n.tipo === 'start' && mine.has(n.id))) {
        g.save();
        g.shadowColor = n.tipo === 'keystone' ? CORES.keystone : CORES.inicio;
        g.shadowBlur = estado === 'alocado' ? 18 : 8;
        forma(n, p, r);
        g.fillStyle = CORES.noFundo;
        g.fill();
        g.restore();
      }
      forma(n, p, r);
      g.fillStyle = estado === 'alocado' ? CORES.alocado : noCaminho ? 'rgba(63,191,168,0.35)' : CORES.noFundo;
      g.fill();
      g.lineWidth = n.tipo === 'small' ? 1.6 : 2.4;
      g.strokeStyle =
        estado === 'alocado' ? CORES.alocadoBorda : noCaminho || estado === 'disponivel' ? CORES.disponivel : n.tipo === 'keystone' ? '#6d4a86' : n.tipo === 'start' ? '#8a7440' : CORES.noBorda;
      g.stroke();
      // O miolo: a cor do tema do nó (apagada se bloqueado).
      if (n.tipo !== 'start') {
        g.beginPath();
        g.arc(p.x, p.y, Math.max(2, r * 0.38), 0, Math.PI * 2);
        g.fillStyle = COR_DO_CLUSTER[n.cluster] ?? '#aab4b8';
        g.globalAlpha = estado === 'bloqueado' && !noCaminho ? 0.35 : 1;
        g.fill();
        g.globalAlpha = 1;
      }
      if (achadosSet.has(n.id)) {
        g.beginPath();
        g.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
        g.strokeStyle = CORES.busca;
        g.lineWidth = 2;
        g.stroke();
      }
      if (selecionado?.id === n.id || sobre?.id === n.id) {
        g.beginPath();
        g.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
        g.strokeStyle = CORES.selecionado;
        g.lineWidth = selecionado?.id === n.id ? 2.4 : 1.2;
        g.stroke();
      }
      // O nome dos notáveis, keystones e inícios de perto.
      if (n.tipo !== 'small' && cam.zoom >= 0.55) {
        g.font = `${n.tipo === 'keystone' ? 700 : 600} ${n.tipo === 'keystone' ? 12 : 11}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.fillStyle = estado === 'alocado' ? CORES.alocadoBorda : n.tipo === 'keystone' ? '#d9b8ff' : CORES.texto;
        g.fillText(n.nome, p.x, p.y + r + 13);
      }
    }
  }

  function tamanho() {
    const r = mapa.getBoundingClientRect();
    largura = Math.max(10, r.width);
    altura = Math.max(10, r.height);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(largura * dpr);
    canvas.height = Math.round(altura * dpr);
    canvas.style.width = `${largura}px`;
    canvas.style.height = `${altura}px`;
    pedir();
  }
  const observador = new ResizeObserver(tamanho);
  observador.observe(mapa);

  // ---- ponteiro: arrastar, pinça, clique, dois cliques, roda ----
  const toques = new Map();
  let arrasto = null;
  let pinca = null;
  const noEm = (px, py) => {
    const a = arvore();
    if (!a) return null;
    let melhor = null;
    for (const n of a.nos) {
      const p = paraTela(n);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d <= raio(n) + 6 && (!melhor || d < melhor.d)) melhor = { n, d };
    }
    return melhor?.n ?? null;
  };
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    toques.set(e.pointerId, local(e));
    if (toques.size === 1) arrasto = { ...local(e), cx: cam.x, cy: cam.y, moveu: false };
    if (toques.size === 2) {
      const [p1, p2] = [...toques.values()];
      pinca = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), zoom: cam.zoom };
      arrasto = null;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (toques.has(e.pointerId)) toques.set(e.pointerId, p);
    if (pinca && toques.size === 2) {
      const [p1, p2] = [...toques.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const alvo = limitarZoom((pinca.zoom * d) / Math.max(1, pinca.d));
      zoomEm(alvo / cam.zoom, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
      return;
    }
    if (arrasto) {
      const dx = p.x - arrasto.x;
      const dy = p.y - arrasto.y;
      if (Math.hypot(dx, dy) > 5) arrasto.moveu = true;
      if (arrasto.moveu) {
        cam.x = arrasto.cx - dx / cam.zoom;
        cam.y = arrasto.cy - dy / cam.zoom;
        balao.hidden = true;
        pedir();
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      const n = noEm(p.x, p.y);
      if (n?.id !== sobre?.id) {
        sobre = n;
        pedir();
      }
      mostrarBalao(n, p);
    }
  });
  const soltar = (e) => {
    const p = local(e);
    toques.delete(e.pointerId);
    if (toques.size < 2) pinca = null;
    if (arrasto && !arrasto.moveu && toques.size === 0) {
      selecionado = noEm(p.x, p.y);
      t.plano = null;
      desenharInfo();
      pedir();
    }
    if (toques.size === 0) arrasto = null;
  };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);
  canvas.addEventListener('pointerleave', () => {
    balao.hidden = true;
    if (sobre) {
      sobre = null;
      pedir();
    }
  });
  canvas.addEventListener('dblclick', (e) => {
    const p = local(e);
    const n = noEm(p.x, p.y);
    if (n && estadoDoNo(n) !== 'alocado') alocarAte(n);
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = local(e);
      zoomEm(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y);
    },
    { passive: false }
  );
  zoomMais.onclick = () => zoomEm(1.3);
  zoomMenos.onclick = () => zoomEm(1 / 1.3);
  centro.onclick = () => {
    const inicio = arvore()?.porId.get(vista()?.inicio);
    if (inicio) irPara(inicio);
  };

  // ---- busca ----
  busca.oninput = () => {
    termo = semAcento(busca.value.trim());
    achadosLista = termo.length >= 2 ? (arvore()?.nos ?? []).filter((n) => n.busca.includes(termo)) : [];
    achadoAtual = -1;
    achados.textContent = termo.length >= 2 ? `${achadosLista.length} nó${achadosLista.length === 1 ? '' : 's'}` : '';
    pedir();
  };
  busca.onkeydown = (e) => {
    if (e.key !== 'Enter' || !achadosLista.length) return;
    e.preventDefault();
    achadoAtual = (achadoAtual + 1) % achadosLista.length;
    selecionado = achadosLista[achadoAtual];
    irPara(selecionado);
    desenharInfo();
  };

  // ---- balão (mouse) ----
  function mostrarBalao(n, p) {
    if (!n) {
      balao.hidden = true;
      return;
    }
    balao.textContent = '';
    balao.append(...fichaDoNo(n, { curta: true }));
    balao.hidden = false;
    const bx = Math.min(largura - 250, p.x + 16);
    const by = Math.min(altura - balao.offsetHeight - 8, p.y + 16);
    balao.style.left = `${Math.max(4, bx)}px`;
    balao.style.top = `${Math.max(4, by)}px`;
  }

  /** O que um nó é: nome, tipo, descrição, efeitos, custo, requisitos, estado. */
  function fichaDoNo(n, { curta = false } = {}) {
    const partes = [];
    const cab = el('div', `pas-cab tipo-${n.tipo}`);
    cab.append(el('b', null, n.nome), el('span', 'pas-tipo', TIPOS[n.tipo] ?? n.tipo));
    partes.push(cab);
    if (n.descricao) partes.push(el('p', 'pas-desc', n.descricao));
    if (n.efeitos.length) {
      const ul = el('ul', 'pas-efeitos');
      for (const ef of n.efeitos) ul.append(el('li', null, textoDoEfeito(ef)));
      partes.push(ul);
    }
    const estado = estadoDoNo(n);
    const lv = ctx.state.character?.level ?? 1;
    const linhas = [];
    if (n.tipo !== 'start') linhas.push(`Custo: ${n.custo} ponto${n.custo === 1 ? '' : 's'}`);
    if (n.levelMinimo) linhas.push(`Requer level ${n.levelMinimo}${lv < n.levelMinimo ? ' (você não tem)' : ''}`);
    let rotuloEstado = { alocado: 'Alocado', disponivel: 'Disponível', bloqueado: n.tipo === 'start' ? 'Início de outra classe' : 'Bloqueado — sem ligação com um nó seu' }[estado];
    if (estado === 'bloqueado' && n.tipo !== 'start') {
      const c = caminhoAte(n.id);
      if (c?.length) {
        linhas.push(`Caminho: ${c.length} nós · ${c.reduce((s, id) => s + (arvore().porId.get(id)?.custo ?? 0), 0)} pontos`);
        rotuloEstado = 'Longe — aloque o caminho até ele';
      }
    }
    linhas.push(`Estado: ${rotuloEstado}`);
    const rod = el('div', `pas-rodape estado-${estado}`);
    for (const l of linhas) rod.append(el('div', null, l));
    partes.push(rod);
    if (curta && n.tipo !== 'start' && estado !== 'alocado') partes.push(el('div', 'pas-dica-mini', 'dois cliques para alocar'));
    return partes;
  }

  // ---- pontos na barra ----
  function desenharBarra() {
    const v = vista();
    const p = v?.pontos ?? { livres: 0, total: 0, usados: 0 };
    pontos.textContent = '';
    pontos.append(el('b', p.livres ? 'tem' : null, String(p.livres)), el('span', null, ` livre${p.livres === 1 ? '' : 's'} · ${p.usados}/${p.total} usados`));
    respecTudo.textContent = v?.respecsGratis ? `Respec completo (${v.respecsGratis} grátis)` : 'Respec completo';
    respecTudo.disabled = !v?.podeTirar || (v?.alocados?.length ?? 0) <= 1;
    respecTudo.title = v?.podeTirar ? '' : 'Só fora da caçada';
  }
  respecTudo.onclick = () => {
    selecionado = null;
    t.plano = null;
    ctx.send({ t: 'passivas', action: 'planoRespec', tudo: true });
    desenharInfo();
  };

  // ---- painel da direita ----
  function alocarAte(n) {
    const caminho = caminhoAte(n.id);
    if (!caminho?.length) return;
    ctx.send({ t: 'passivas', action: 'alocar', ids: caminho });
  }

  function desenharInfo() {
    info.textContent = '';
    const v = vista();
    const a = arvore();
    if (!a || !v) return;
    // A confirmação de um respec (resposta do `planoRespec`).
    if (t.plano) {
      const caixa = el('div', 'pas-confirma');
      const n = t.plano.tirar.length;
      caixa.append(el('b', null, `Tirar ${n} nó${n === 1 ? '' : 's'}?`));
      const nomes = t.plano.tirar.slice(0, 8).map((id) => a.porId.get(id)?.nome ?? id);
      caixa.append(el('p', null, nomes.join(', ') + (n > 8 ? ` e mais ${n - 8}` : '')));
      caixa.append(el('p', 'pas-preco', t.plano.gratis ? 'Grátis (respec da migração).' : `Custa ${t.plano.preco.toLocaleString('pt-BR')} de ouro (bolso + banco).`));
      const sim = el('button', 'danger', 'Confirmar');
      const nao = el('button', 'ghost', 'Cancelar');
      sim.onclick = () => {
        const pedido = t.plano.tirar.length === (v.alocados.length - 1) && !selecionado ? { tudo: true } : { ids: t.plano.tirar, junto: true };
        ctx.send({ t: 'passivas', action: 'respec', ...pedido });
        t.plano = null;
        selecionado = null;
        desenharInfo();
      };
      nao.onclick = () => {
        t.plano = null;
        desenharInfo();
      };
      const linha = el('div', 'pas-botoes');
      linha.append(sim, nao);
      caixa.append(linha);
      info.append(caixa);
      return;
    }
    if (selecionado) {
      const n = selecionado;
      info.append(...fichaDoNo(n));
      const estado = estadoDoNo(n);
      const linha = el('div', 'pas-botoes');
      if (estado === 'alocado' && n.tipo !== 'start') {
        const tirar = el('button', 'ghost danger', `Tirar (${(v.precoPorNo ?? 0).toLocaleString('pt-BR')} de ouro por nó)`);
        tirar.disabled = !v.podeTirar;
        if (!v.podeTirar) tirar.title = 'Só fora da caçada';
        tirar.onclick = () => ctx.send({ t: 'passivas', action: 'planoRespec', ids: [n.id], junto: true });
        linha.append(tirar);
      } else if (n.tipo !== 'start') {
        const caminho = caminhoAte(n.id) ?? [];
        const custo = caminho.reduce((s, id) => s + (a.porId.get(id)?.custo ?? 0), 0);
        const lv = ctx.state.character?.level ?? 1;
        const falta = caminho.map((id) => a.porId.get(id)).find((x) => (x?.levelMinimo ?? 0) > lv);
        const botao = el('button', 'primary', caminho.length > 1 ? `Alocar caminho (${caminho.length} nós · ${custo} pontos)` : `Alocar (${custo} ponto${custo === 1 ? '' : 's'})`);
        botao.disabled = !caminho.length || custo > (v.pontos?.livres ?? 0) || !!falta;
        if (custo > (v.pontos?.livres ?? 0)) linha.append(el('p', 'pas-aviso', `Faltam ${custo - (v.pontos?.livres ?? 0)} pontos.`));
        if (falta) linha.append(el('p', 'pas-aviso', `${falta.nome} pede level ${falta.levelMinimo}.`));
        botao.onclick = () => alocarAte(n);
        linha.prepend(botao);
      }
      info.append(linha);
      return;
    }
    // Nada selecionado: o que a árvore está dando.
    info.append(el('h3', null, 'O que a árvore dá'));
    const soma = new Map();
    const keystones = [];
    for (const id of v.alocados) {
      const n = a.porId.get(id);
      if (!n) continue;
      if (n.tipo === 'keystone') keystones.push(n);
      for (const ef of n.efeitos) {
        const [k, val] = chaveDoEfeito(ef);
        if (k) soma.set(k, (soma.get(k) ?? 0) + val);
      }
    }
    if (!soma.size && !keystones.length) info.append(el('p', 'pas-vazio', 'Nenhum nó alocado ainda. Clique num nó ligado ao seu início (a estrela) para começar.'));
    const ul = el('ul', 'pas-efeitos');
    for (const [k, val] of soma) ul.append(el('li', null, textoDoEfeito(efeitoDaChave(k, val))));
    info.append(ul);
    for (const k of keystones) {
      const d = el('div', 'pas-keystone');
      d.append(el('b', null, k.nome), el('p', null, k.descricao ?? ''));
      info.append(d);
    }
  }

  // A árvore já veio antes (outra abertura nesta sessão): desenha já.
  requestAnimationFrame(() => {
    tamanho();
    t.atualizar();
  });
}

/** O balão do botão "Árvore" na barra: pontos parados e o resumo. */
export function resumoDasPassivasParaBalao() {
  const v = ctx?.state?.character?.passivas;
  if (!v) return null;
  const caixa = el('div', 'tip-arvore');
  if (v.pontos?.livres) caixa.append(el('b', null, `${v.pontos.livres} ponto${v.pontos.livres === 1 ? '' : 's'} à espera`));
  caixa.append(el('div', null, `${Math.max(0, (v.alocados?.length ?? 1) - 1)} nós alocados · ${v.pontos?.usados ?? 0}/${v.pontos?.total ?? 0} pontos`));
  if (v.respecsGratis) caixa.append(el('div', null, `${v.respecsGratis} respec completo grátis`));
  return caixa;
}
