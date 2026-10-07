// A tela CAMPANHA (antes "WORLD"): o mapa da campanha — dificuldades, abas dos Atos, mapa interativo (zoom, arraste, pinça), painel da fase e barra de atalhos.
//
// É a MESMA campanha de sempre (`{t:'campanha'}` → `systems/campanha.mjs`): quem decide o que está aberto, concluído ou exigido é o
// SERVIDOR — aqui só se desenha o que chegou e se pede o que o jogo já permite (entrar na fase pelo mesmo fluxo de sempre). Segredo nunca
// chega aqui: o servidor só manda o que o jogador já encontrou.
//
// O mapa é SVG (13 nós por Ato: poucas formas, nítido em qualquer zoom e acessível por teclado/leitor de tela); a câmera move UM grupo
// (`transform`), o pergaminho de cada Ato é desenhado uma vez, e trocar a seleção só mexe em classes e no painel — nada é refeito.
// Os dados e as contas moram em `world-dados.mjs` (testável sem DOM); a arte procedural em `world-arte.mjs`.
import { LARGURA, ALTURA, RAIO_DA_FASE, RAIO_DO_BOSS, TIPOS_DE_NO, TEXTO_DO_ESTADO, atosDaCampanha, partesDaCampanha, faseDaFronteira, posicoesDoAto, conexoesDoAto, tracadoDaEstrada, tipoDaFase, estadoDoNo } from './world-dados.mjs';
import { svg, fundoDoAto, nomeDoTema, ICONES, ICONE_DO_TIPO, iconeDeBotao } from './world-arte.mjs';

export { layoutDoAto, colunasPara, estadoDoNo, RAIO_DA_FASE, RAIO_DO_BOSS } from './world-dados.mjs';

/** Um elemento com filhos (texto ou nós). */
const el = (tag, classe, ...filhos) => {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  for (const f of filhos.flat()) if (f != null && f !== false) n.append(f.nodeType ? f : document.createTextNode(String(f)));
  return n;
};
/** O nome do painel: um `div` (o `#modal-body h3` do jogo pintaria um título de ficha por cima). */
const titulo = (...filhos) => {
  const n = el('div', 'w2-nome', ...filhos);
  n.setAttribute('role', 'heading');
  n.setAttribute('aria-level', '3');
  return n;
};
const botao = (classe, texto, aoClicar) => {
  const b = el('button', classe, texto);
  b.type = 'button';
  if (aoClicar) b.onclick = aoClicar;
  return b;
};

// ---------------------------------------------------------------- memória da tela (a câmera e a seleção sobrevivem aos redesenhos)

const CHAVE = 'draevor.world.v1';
const E = { sel: null, ato: null, vistas: new Map(), vistos: new Map() };
const ler = () => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? '{}') ?? {};
  } catch {
    return {};
  }
};
const gravar = (parcial) => {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ ...ler(), ...parcial }));
  } catch {
    /* sem armazenamento (janela privada): a tela funciona igual */
  }
};
/** A última dificuldade/Ato escolhidos (o servidor ainda decide se estão abertos). */
export const preferencia = () => ler();
export const lembrarDificuldade = (id) => gravar({ dificuldade: id });

const reduzMovimento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const estreita = () => (typeof window !== 'undefined' ? window.innerWidth < 700 : false);

// ---------------------------------------------------------------- câmera (arrastar, zoom, pinça)

const K_MIN = 1;
const K_MAX = 3.5;
function criarCamera(viewport, svgEl, cam, vista, aoMudar) {
  /** A parte do viewBox que aparece no palco (com `slice` a proporção do palco corta um dos lados): `{ x0, y0, w, h }` em unidades do mapa. */
  const visivel = () => {
    const W = svgEl.clientWidth || LARGURA;
    const H = svgEl.clientHeight || ALTURA;
    const slice = (svgEl.getAttribute('preserveAspectRatio') ?? '').includes('slice');
    const esc = slice ? Math.max(W / LARGURA, H / ALTURA) : Math.min(W / LARGURA, H / ALTURA);
    const w = Math.min(LARGURA, W / esc);
    const h = Math.min(ALTURA, H / esc);
    return { x0: (LARGURA - w) / 2, y0: (ALTURA - h) / 2, w, h };
  };
  const limitar = () => {
    vista.k = Math.max(K_MIN, Math.min(K_MAX, vista.k));
    // O mapa (0..LARGURA × 0..ALTURA, escalado por k) sempre cobre a parte visível: dá para arrastar até cada borda, nunca além.
    const v = visivel();
    vista.x = Math.max(v.x0 + v.w - LARGURA * vista.k, Math.min(v.x0, vista.x));
    vista.y = Math.max(v.y0 + v.h - ALTURA * vista.k, Math.min(v.y0, vista.y));
  };
  const aplicar = () => {
    limitar();
    cam.setAttribute('transform', `translate(${vista.x.toFixed(1)} ${vista.y.toFixed(1)}) scale(${vista.k.toFixed(3)})`);
    viewport.classList.toggle('ampliado', vista.k > 1.05);
    aoMudar?.();
  };
  const emUnidades = (cx, cy) => {
    const m = svgEl.getScreenCTM();
    if (!m) return { x: 0, y: 0, esc: 1 };
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y, esc: m.a };
  };
  /** Zoom por `fator` mantendo o ponto da tela (cx, cy) parado. */
  const zoom = (fator, cx, cy) => {
    const antes = emUnidades(cx, cy);
    const k = Math.max(K_MIN, Math.min(K_MAX, vista.k * fator));
    const real = k / vista.k;
    vista.x = antes.x - (antes.x - vista.x) * real;
    vista.y = antes.y - (antes.y - vista.y) * real;
    vista.k = k;
    aplicar();
  };
  const centrarEm = (px, py, k = vista.k) => {
    vista.k = k;
    vista.x = LARGURA / 2 - px * k;
    vista.y = ALTURA / 2 - py * k;
    aplicar();
  };

  const ponteiros = new Map();
  let gesto = null;
  viewport.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    ponteiros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    viewport.setPointerCapture?.(ev.pointerId);
    gesto = { inicioX: ev.clientX, inicioY: ev.clientY, moveu: false, pinca: ponteiros.size > 1 ? distancia() : null, alvo: ev.target };
  });
  const distancia = () => {
    const [a, b] = [...ponteiros.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };
  viewport.addEventListener('pointermove', (ev) => {
    const p = ponteiros.get(ev.pointerId);
    if (!p || !gesto) return;
    const dx = ev.clientX - p.x;
    const dy = ev.clientY - p.y;
    p.x = ev.clientX;
    p.y = ev.clientY;
    if (ponteiros.size >= 2) {
      gesto.moveu = true;
      const d = distancia();
      const [a, b] = [...ponteiros.values()];
      if (gesto.pinca) zoom(d / gesto.pinca, (a.x + b.x) / 2, (a.y + b.y) / 2);
      gesto.pinca = d;
      return;
    }
    // Só vira ARRASTE depois de 6 px: um toque que escorrega um pouco continua sendo um toque no nó.
    if (!gesto.moveu && Math.hypot(ev.clientX - gesto.inicioX, ev.clientY - gesto.inicioY) < 6) return;
    gesto.moveu = true;
    const esc = emUnidades(0, 0).esc || 1;
    vista.x += dx / esc;
    vista.y += dy / esc;
    aplicar();
  });
  const soltar = (ev, cancelado = false) => {
    if (!ponteiros.has(ev.pointerId)) return;
    ponteiros.delete(ev.pointerId);
    if (ponteiros.size === 0 && gesto) {
      const foiToque = !gesto.moveu && !cancelado;
      gesto = null;
      if (foiToque) viewport.dispatchEvent(new CustomEvent('toque', { detail: { x: ev.clientX, y: ev.clientY } }));
    } else if (gesto) {
      gesto.pinca = null;
      gesto.moveu = true; // o dedo que sobrou da pinça não vira toque
    }
  };
  viewport.addEventListener('pointerup', (ev) => soltar(ev));
  viewport.addEventListener('pointercancel', (ev) => soltar(ev, true));
  viewport.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    zoom(ev.deltaY < 0 ? 1.18 : 1 / 1.18, ev.clientX, ev.clientY);
  }, { passive: false });
  viewport.addEventListener('dblclick', (ev) => zoom(1.6, ev.clientX, ev.clientY));
  return { zoom, centrarEm, aplicar, centro: () => ({ x: viewport.getBoundingClientRect().left + viewport.clientWidth / 2, y: viewport.getBoundingClientRect().top + viewport.clientHeight / 2 }) };
}

// ---------------------------------------------------------------- o nó

export function desenharNo({ id, tipo, estado, numero, nome, p, atual, novo, escolhido, boss, achados = 0 }) {
  const r = boss ? RAIO_DO_BOSS : RAIO_DA_FASE;
  const g = svg('g', { class: `w-no ${estado} t-${tipo}${atual ? ' atual' : ''}${novo ? ' novo' : ''}${escolhido ? ' escolhido' : ''}`, transform: `translate(${p.x} ${p.y})`, tabindex: 0, role: 'button', 'data-id': id, 'aria-label': `${nome}. ${TIPOS_DE_NO[tipo]}. ${TEXTO_DO_ESTADO[estado]}${atual ? '. Fase atual' : ''}` });
  g.append(svg('circle', { class: 'w-halo', r: r + 9 }));
  // (A fase atual é marcada só pela COR — o ciano do `.w-no.atual`. O anel que pulsava saindo do nó saiu: dono, 07/10, "quero deixar só
  // uma cor para dizer que estou aqui e tirar essa animação da bola saindo de onde estou".)
  // a forma diz o tipo (não só a cor): disco = fase, hexágono = miniboss/desafio, losango com pontas = boss, anel tracejado = opcional/secreto
  const forma = { class: 'w-forma' };
  if (boss || tipo === 'boss-fase') g.append(svg('polygon', { ...forma, points: `0,${-r - 4} ${r + 4},0 0,${r + 4} ${-r - 4},0` }));
  else if (tipo === 'miniboss' || tipo === 'desafio') g.append(svg('polygon', { ...forma, points: [0, 1, 2, 3, 4, 5].map((i) => `${(Math.cos((i * Math.PI) / 3 + Math.PI / 6) * (r + 1)).toFixed(1)},${(Math.sin((i * Math.PI) / 3 + Math.PI / 6) * (r + 1)).toFixed(1)}`).join(' ') }));
  else g.append(svg('circle', { ...forma, r, ...(tipo === 'boss-opcional' || tipo === 'secreta' ? { 'stroke-dasharray': '4 3' } : {}) }));
  const conteudo = svg('g', { class: 'w-icone' });
  if (estado === 'fechada') conteudo.append(ICONES.cadeado());
  else if (estado === 'travada') conteudo.append(ICONES.xis());
  else if (estado === 'completa') conteudo.append(ICONES.visto());
  else if (ICONE_DO_TIPO[tipo]) conteudo.append(ICONES[ICONE_DO_TIPO[tipo]](boss ? 1.25 : 1));
  else conteudo.append(svg('text', { class: 'w-numero', 'text-anchor': 'middle', y: 6 }, String(numero)));
  g.append(conteudo);
  // selo do tipo no canto quando o nó mostra o estado (concluído/bloqueado) e o tipo é especial
  if (estado !== 'aberta' && ICONE_DO_TIPO[tipo] && !boss) g.append(svg('g', { class: 'w-selo', transform: `translate(${r - 4} ${-r + 5}) scale(.55)` }, svg('circle', { r: 11 }), ICONES[ICONE_DO_TIPO[tipo]]()));
  // algo que o jogador JÁ ENCONTROU nesta fase (baú, altar, segredo): uma estrela no canto — nunca o que ele ainda não achou
  if (achados) g.append(svg('g', { class: 'w-selo achado', transform: `translate(${-r + 4} ${-r + 5}) scale(.6)` }, svg('circle', { r: 11 }), ICONES.estrela(1.2)));
  const texto = nome.length > 22 ? `${nome.slice(0, 21)}…` : nome;
  // A PLACA do rótulo (o estilo do mapa ilustrado — dono, 07/10): fundo escuro atrás do nome, legível sobre qualquer arte. A largura
  // acompanha o texto (~6,4 px por letra na fonte do rótulo); o número da fase vai pequeno acima do nome.
  const largura = Math.max(56, Math.round(texto.length * 6.4) + 16);
  const placa = svg('g', { class: 'w-placa' });
  placa.append(svg('rect', { x: -largura / 2, y: r + 6, width: largura, height: 20, rx: 4 }));
  if (numero && !boss) placa.append(svg('text', { class: 'w-placa-num', 'text-anchor': 'middle', y: r + 4 }, String(numero)));
  placa.append(svg('text', { class: 'w-rotulo', 'text-anchor': 'middle', y: r + 20 }, texto));
  g.append(placa);
  return g;
}

// ---------------------------------------------------------------- a tela

/**
 * Desenha a tela inteira dentro de `body`. `h` traz o que vem do resto do jogo (para não importar `panels.mjs`):
 * `figuraDaCriatura`, `entrarNaFase(hunt, lista)`, `enfrentarBoss(boss)`, `portalAberto(boss)`, `escolherDificuldade(id)`, `definirAoCompletar(valor)`, `fechar()`, `verLista()`.
 */
export function desenharMundo(body, { campanha, escolhida, hunts, bosses, bestiario, h }) {
  const { figuraDaCriatura } = h;
  const mundo = campanha.mundo ?? {};
  const atos = atosDaCampanha(escolhida, campanha.atos ?? {});
  if (!atos.length) return void body.append(el('p', 'empty', 'A campanha ainda não tem Atos.'));
  const fronteira = faseDaFronteira(escolhida);

  // Qual Ato mostrar: o que o jogador estava vendo (se segue aberto) ou o da fase atual.
  let atoAtual = atos.find((a) => a.ato === (E.ato ?? ler().ato) && a.aberto) ?? atos.find((a) => a.ato === fronteira?.ato) ?? atos[0];
  if (!E.sel || !(E.sel.tipo === 'boss' ? atos.some((a) => a.ato === E.sel.ato) : escolhida.fases.some((f) => f.huntId === E.sel.huntId))) E.sel = fronteira ? { tipo: 'fase', huntId: fronteira.huntId } : null;
  if (E.sel && (E.sel.tipo === 'boss' ? E.sel.ato : escolhida.fases.find((f) => f.huntId === E.sel.huntId)?.ato) !== atoAtual.ato) E.sel = null;
  if (!E.sel) E.sel = atoAtual.fases.length ? { tipo: 'fase', huntId: (atoAtual.fases.find((f) => f.huntId === fronteira?.huntId) ?? atoAtual.fases[0]).huntId } : null;

  // O que já era visível antes: o que abriu desde a última vez ganha o brilho de "descoberta".
  const chaveVisto = escolhida.id;
  const antes = E.vistos.get(chaveVisto);
  const agora = new Set(escolhida.fases.filter((f) => f.liberada).map((f) => f.huntId));
  E.vistos.set(chaveVisto, agora);
  const novos = antes ? new Set([...agora].filter((id) => !antes.has(id))) : new Set();

  const raiz = el('div', 'w2');
  raiz.dataset.dificuldade = escolhida.id;

  // ---- 1. (sem cabeçalho próprio: o título "CAMPANHA" é o da janela do jogo; a tela começa nas dificuldades — dono, 07/10)
  const partes = partesDaCampanha(atos);

  // ---- 2. dificuldades
  const aviso = el('div', 'w2-aviso');
  aviso.hidden = true;
  const mostrarAviso = (texto) => {
    aviso.textContent = texto;
    aviso.hidden = !texto;
  };
  const dif = el('nav', 'w2-dificuldades', null);
  dif.setAttribute('aria-label', 'Dificuldade');
  const concluidaDif = (d) => d.fases.every((f) => f.completa || f.pular) && d.bosses.every((b) => b.vencido);
  for (const d of campanha.dificuldades) {
    const ind = d.id === escolhida.id ? 'selecionada' : d.liberada ? 'aberta' : 'bloqueada';
    const b = botao(`w2-placa ${ind}${concluidaDif(d) ? ' concluida' : ''}`, null);
    b.append(el('b', null, d.nome), el('small', null, d.liberada ? `level ${d.faixa[0]}–${d.faixa[1]}` : 'bloqueada'));
    if (concluidaDif(d)) b.append(el('i', 'w2-selo-ok', iconeDeBotao('visto')));
    b.setAttribute('aria-pressed', String(d.id === escolhida.id));
    b.onclick = () => {
      if (!d.liberada) {
        const i = campanha.dificuldades.findIndex((x) => x.id === d.id);
        const ant = campanha.dificuldades[i - 1];
        return mostrarAviso(`O ${d.nome} abre depois de vencer o boss do Ato ${atos.at(-1).ato} no ${ant?.nome ?? 'nível anterior'}.`);
      }
      mostrarAviso('');
      if (d.id !== escolhida.id) {
        lembrarDificuldade(d.id);
        h.escolherDificuldade(d.id);
      }
    };
    dif.append(b);
  }

  // ---- 3. abas dos Atos
  const abas = el('nav', 'w2-atos');
  abas.setAttribute('aria-label', 'Atos');
  abas.setAttribute('role', 'tablist');
  const abaDe = new Map();
  for (const a of atos) {
    const b = botao(`w2-aba${a.aberto ? '' : ' bloqueada'}${a.concluido ? ' concluida' : ''}`, null);
    b.setAttribute('role', 'tab');
    if (!a.aberto) b.append(el('i', 'w2-cad', iconeDeBotao('cadeado')));
    b.append(el('span', null, a.nome), a.concluido ? el('i', 'w2-selo-ok', iconeDeBotao('visto')) : el('small', null, `${a.feitas}/${a.total}`));
    b.onclick = () => {
      if (!a.aberto) return mostrarAviso(`${a.nome} abre quando você completar o Ato anterior (e vencer o boss dele).`);
      mostrarAviso('');
      trocarAto(a);
    };
    abaDe.set(a.ato, b);
    abas.append(b);
  }

  // ---- 4. o mapa
  const palco = el('div', 'w2-palco');
  const progresso = el('div', 'w2-progresso');
  const progressoBarra = el('i');
  progresso.append(progressoBarra);
  const viewport = el('div', 'w2-viewport');
  const bussola = el('div', 'w2-bussola');
  bussola.innerHTML = '<svg viewBox="-42 -42 84 84" aria-hidden="true"><circle r="26" class="b-anel"/><circle r="18" class="b-anel2"/><path d="M0 -24 L5 0 L0 24 L-5 0 Z" class="b-agulha"/><path d="M-24 0 L0 5 L24 0 L0 -5 Z" class="b-agulha2"/><text y="-30" class="b-txt">N</text><text y="38" class="b-txt">S</text><text x="34" y="3.5" class="b-txt">L</text><text x="-34" y="3.5" class="b-txt">O</text></svg>';
  // `slice` (dono, 07/10: "a foto do ato de fundo não está cheia, tem parte preta"): o mapa COBRE o palco em qualquer proporção; o que
  // sobra fora da tela se alcança arrastando (a câmera limita pela parte visível — `criarCamera`).
  const mapaSvg = svg('svg', { class: 'w2-svg', viewBox: `0 0 ${LARGURA} ${ALTURA}`, preserveAspectRatio: 'xMidYMid slice', role: 'group' });
  const cam = svg('g', { class: 'w2-cam' });
  mapaSvg.append(cam);
  viewport.append(mapaSvg);
  const balao = el('div', 'w2-balao');
  balao.hidden = true;
  const controles = el('div', 'w2-controles');
  const dica = el('div', 'w2-dica', 'Arraste para mover · roda ou pinça para o zoom · toque num nó para ver a fase');
  palco.append(viewport, bussola, balao, controles, dica);

  // ---- 5. o painel + 6. a barra
  const painel = el('section', 'w2-painel');
  const barra = el('footer', 'w2-barra');

  raiz.append(dif, barra, abas, progresso, aviso, palco, painel);
  body.append(raiz);

  // A tela se adapta à CAIXA do jogo em que está: mede a janela (e remede quando ela muda) e marca `larga` (700 px+: ocupa a altura toda, sem
  // rolagem) e `lado` (1100 px+: painel à direita). Celular em pé fica no fluxo normal (a página rola).
  const medir = () => {
    if (!raiz.isConnected) return void window.removeEventListener('resize', medir);
    const cs = getComputedStyle(body);
    const larguraUtil = body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    // A altura vem do LIMITE da janela do jogo (`max-height` da caixa), nunca do tamanho atual do conteúdo: medir o conteúdo que a própria
    // medida define faria a tela encolher a cada passo.
    const caixa = body.closest('.modal-box');
    const ccs = caixa ? getComputedStyle(caixa) : null;
    const teto = ccs && /px$/.test(ccs.maxHeight) ? parseFloat(ccs.maxHeight) : window.innerHeight * 0.9;
    const molduras = ccs ? parseFloat(ccs.borderTopWidth) + parseFloat(ccs.borderBottomWidth) : 0;
    const irmaos = caixa ? [...caixa.children].filter((c) => c !== body && getComputedStyle(c).position !== 'absolute').reduce((n, c) => n + c.offsetHeight, 0) : 0;
    const topo = raiz.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
    const altura = teto - molduras - irmaos - topo - parseFloat(cs.paddingBottom) - 6;
    const cabe = larguraUtil >= 700 && altura >= 340 && !(window.innerHeight < 460 && window.innerWidth > window.innerHeight);
    raiz.classList.toggle('larga', cabe);
    // O painel vai para o LADO do mapa assim que cabe (a caixa do jogo é baixa: empilhar deixaria o mapa minúsculo).
    raiz.classList.toggle('lado', cabe && larguraUtil >= 780);
    // O painel leva ~34% da largura no desktop (o mapa fica com ~66%); em caixa menor, o mínimo legível.
    raiz.style.setProperty('--w2-painel', larguraUtil >= 1100 ? '34%' : '300px');
    raiz.style.setProperty('--w2-h', cabe ? `${Math.floor(altura)}px` : 'auto');
  };
  window.addEventListener('resize', medir);
  body.scrollTop = 0;
  medir();

  let dadosDoAto = null;
  const vista = { x: 0, y: 0, k: 1 };
  let chaveVista = null;
  const camera = criarCamera(viewport, mapaSvg, cam, vista, () => {
    balao.hidden = true;
    if (chaveVista) E.vistas.set(chaveVista, { ...vista });
  });
  const nosPorId = new Map();

  const selecionarNo = (sel, { centrar = false } = {}) => {
    E.sel = sel;
    const id = sel.tipo === 'boss' ? `boss:${sel.ato}` : sel.tipo === 'cidade' ? `cidade:${sel.ato}` : sel.huntId;
    for (const [nid, g] of nosPorId) g.classList.toggle('escolhido', nid === id);
    desenharPainel();
    if (centrar && dadosDoAto) {
      const p = dadosDoAto.posicao(id);
      if (p) camera.centrarEm(p.x, p.y, Math.max(1.6, vista.k));
    }
  };

  function montarMapa() {
    cam.replaceChildren();
    nosPorId.clear();
    const a = atoAtual;
    const pos = posicoesDoAto(a.fases, !!a.boss, mundo, a.ato, a.bossMapa);
    const pontos = [...pos.pontos, ...(pos.boss ? [pos.boss] : [])];
    cam.append(fundoDoAto(a.ato, nomeDoTema(a.ato, a.tema), pontos, a.fundo));
    // A CIDADE: o nó de partida (sempre aberta). Sem posição do editor, fica à esquerda da primeira fase.
    const cidadeId = `cidade:${a.ato}`;
    const cidade = a.cidade ? { ...a.cidade, p: a.cidade.posicao ?? { x: Math.max(60, (pos.pontos[0]?.x ?? 100) - 120), y: pos.pontos[0]?.y ?? ALTURA / 2 } } : null;
    const ids = [...a.fases.map((f) => f.huntId), ...(a.boss ? [`boss:${a.ato}`] : []), ...(cidade ? [cidadeId] : [])];
    if (cidade) pontos.push(cidade.p);
    const posicao = (id) => pontos[ids.indexOf(id)];
    // as estradas (sob os nós)
    const estradas = svg('g', { class: 'w2-estradas' });
    // O caminho que leva à fase ATUAL ganha o azul luminoso (`atual`).
    const idDaFronteira = fronteira?.ato === a.ato ? fronteira.huntId : null;
    for (const c of conexoesDoAto(a.fases, a.boss, mundo)) {
      const d = tracadoDaEstrada(posicao(c.de), posicao(c.para), c.tipo);
      estradas.append(svg('path', { d, class: 'w2-leito' }), svg('path', { d, class: `w2-estrada ${c.estado} ${c.tipo}${idDaFronteira && c.para === idDaFronteira ? ' atual' : ''}` }));
    }
    // da cidade às fases ligadas a ela: percorrida se a fase já abriu
    for (const huntId of cidade?.conexoes ?? []) {
      const alvo = posicao(huntId);
      if (!alvo) continue;
      const f = a.fases.find((x) => x.huntId === huntId);
      const d = tracadoDaEstrada(cidade.p, alvo, 'cadeia');
      estradas.append(svg('path', { d, class: 'w2-leito' }), svg('path', { d, class: `w2-estrada ${f?.completa ? 'percorrido' : f?.liberada ? 'disponivel' : 'bloqueado'} cadeia${idDaFronteira === huntId ? ' atual' : ''}` }));
    }
    cam.append(estradas);
    const nos = svg('g', { class: 'w2-nos' });
    a.fases.forEach((f, i) => {
      const m = mundo[f.huntId] ?? {};
      const g = desenharNo({ id: f.huntId, tipo: tipoDaFase(m), estado: estadoDoNo(f), numero: m.grafo?.ordem ?? escolhida.fases.indexOf(f) + 1, nome: f.nome, p: pos.pontos[i], atual: fronteira?.huntId === f.huntId, novo: novos.has(f.huntId), escolhido: E.sel?.huntId === f.huntId, achados: m.descobertos?.length ?? 0 });
      nosPorId.set(f.huntId, g);
      nos.append(g);
    });
    if (cidade) {
      const g = desenharNo({ id: cidadeId, tipo: 'cidade', estado: 'aberta', numero: 0, nome: cidade.nome, p: cidade.p, escolhido: E.sel?.tipo === 'cidade' && E.sel.ato === a.ato });
      g.classList.add('t-cidade-no');
      nosPorId.set(cidadeId, g);
      nos.append(g);
    }
    if (a.boss) {
      const g = desenharNo({ id: `boss:${a.ato}`, tipo: 'boss', estado: estadoDoNo(a.boss), numero: 0, nome: a.boss.nome, p: pos.boss, boss: true, escolhido: E.sel?.tipo === 'boss' && E.sel.ato === a.ato });
      nosPorId.set(`boss:${a.ato}`, g);
      nos.append(g);
    }
    cam.append(nos);
    mapaSvg.setAttribute('aria-label', `Mapa do ${a.nome}`);
    dadosDoAto = { posicao: (id) => posicao(id) };
    chaveVista = `${escolhida.id}:${a.ato}`;
    const salva = E.vistas.get(chaveVista);
    if (salva) Object.assign(vista, salva);
    else {
      Object.assign(vista, { x: 0, y: 0, k: 1 });
      // No celular em pé o mapa inteiro ficaria miúdo: abre mais perto, centrado onde o jogador está.
      // (No desktop abre com um pouco de zoom, centrado na fase: com o mapa inteiro na tela não haveria nada para arrastar.)
      {
        const alvo = posicao(E.sel?.tipo === 'boss' ? `boss:${a.ato}` : E.sel?.huntId) ?? { x: LARGURA / 2, y: ALTURA / 2 };
        vista.k = estreita() ? 2.2 : 1.25;
        vista.x = LARGURA / 2 - alvo.x * vista.k;
        vista.y = ALTURA / 2 - alvo.y * vista.k;
      }
    }
    camera.aplicar();
    if (!reduzMovimento()) {
      cam.classList.remove('entra');
      void cam.getBoundingClientRect();
      cam.classList.add('entra');
    }
  }

  function desenharControles() {
    controles.replaceChildren(
      botao('w2-ctl', iconeDeBotao('mais'), () => camera.zoom(1.4, ...Object.values(camera.centro()))),
      botao('w2-ctl', iconeDeBotao('menos'), () => camera.zoom(1 / 1.4, ...Object.values(camera.centro()))),
      botao('w2-ctl', iconeDeBotao('centrar'), () => {
        const id = E.sel?.tipo === 'boss' ? `boss:${E.sel.ato}` : E.sel?.huntId;
        const p = dadosDoAto.posicao(id);
        if (p) camera.centrarEm(p.x, p.y, Math.max(1.6, vista.k));
      }),
      botao('w2-ctl', iconeDeBotao('tudo'), () => camera.centrarEm(LARGURA / 2, ALTURA / 2, 1))
    );
    [...controles.children].forEach((b, i) => {
      b.setAttribute('aria-label', ['Aproximar', 'Afastar', 'Centrar na fase escolhida', 'Ver o Ato inteiro'][i]);
      b.title = b.getAttribute('aria-label');
    });
  }

  function trocarAto(a, manterSelecao = false) {
    atoAtual = a;
    E.ato = a.ato;
    gravar({ ato: a.ato });
    for (const [n, b] of abaDe) {
      b.classList.toggle('selecionada', n === a.ato);
      b.setAttribute('aria-selected', String(n === a.ato));
    }
    const novaSel = a.fases.length ? { tipo: 'fase', huntId: (a.fases.find((f) => f.huntId === fronteira?.huntId) ?? a.fases.find((f) => f.liberada) ?? a.fases[0]).huntId } : null;
    if (!manterSelecao) E.sel = novaSel;
    progressoBarra.style.width = `${a.total ? Math.round((100 * a.feitas) / a.total) : 0}%`;
    montarMapa();
    desenharPainel();
  }

  // ---- interação com os nós: o clique só vale se o gesto NÃO foi um arraste
  const noDoPonto = (x, y) => {
    const alvo = document.elementFromPoint(x, y)?.closest?.('.w-no');
    return alvo && cam.contains(alvo) ? alvo : null;
  };
  viewport.addEventListener('toque', (ev) => {
    const no = noDoPonto(ev.detail.x, ev.detail.y);
    if (!no) return;
    const id = no.dataset.id;
    selecionarNo(id.startsWith('boss:') ? { tipo: 'boss', ato: Number(id.slice(5)) } : id.startsWith('cidade:') ? { tipo: 'cidade', ato: Number(id.slice(7)) } : { tipo: 'fase', huntId: id });
  });
  viewport.addEventListener('keydown', (ev) => {
    const no = ev.target.closest?.('.w-no');
    if (no && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      const id = no.dataset.id;
      selecionarNo(id.startsWith('boss:') ? { tipo: 'boss', ato: Number(id.slice(5)) } : id.startsWith('cidade:') ? { tipo: 'cidade', ato: Number(id.slice(7)) } : { tipo: 'fase', huntId: id });
    }
  });
  // o balão de resumo (só com mouse — no toque quem resume é o painel)
  viewport.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'mouse' || ev.buttons) return;
    const no = ev.target.closest?.('.w-no');
    if (!no) return void (balao.hidden = true);
    const id = no.dataset.id;
    if (id.startsWith('cidade:')) return void (balao.hidden = true);
    const boss = id.startsWith('boss:');
    const f = boss ? null : escolhida.fases.find((x) => x.huntId === id);
    const b = boss ? atoAtual.boss : null;
    const st = estadoDoNo(boss ? b : f);
    const r = palco.getBoundingClientRect();
    balao.replaceChildren(el('b', null, boss ? b.nome : f.nome), el('span', null, `${TIPOS_DE_NO[boss ? 'boss' : tipoDaFase(mundo[id])]} · level ~${boss ? b.nivel : f.nivel}`), el('span', `w2-estado ${st}`, TEXTO_DO_ESTADO[st]));
    balao.style.left = `${Math.min(r.width - 190, Math.max(4, ev.clientX - r.left + 14))}px`;
    balao.style.top = `${Math.max(4, ev.clientY - r.top + 14)}px`;
    balao.hidden = false;
  });
  viewport.addEventListener('pointerleave', () => (balao.hidden = true));

  // ---- o painel da fase escolhida
  const linha = (rotulo, valor) => el('div', 'w2-linha', el('span', null, rotulo), valor instanceof Node ? valor : el('b', null, valor));
  function desenharPainel() {
    painel.replaceChildren();
    painel.classList.remove('abre');
    if (!reduzMovimento()) {
      void painel.offsetWidth;
      painel.classList.add('abre');
    }
    const sel = E.sel;
    if (!sel) {
      painel.append(titulo( atoAtual.nome), el('p', 'w2-desc', atoAtual.descricao ?? 'Toque num lugar do mapa para ver os detalhes.'));
      return;
    }
    if (sel.tipo === 'cidade') {
      const c = atoAtual.cidade ?? { nome: 'Cidade', conexoes: [] };
      const col1 = el('div', 'w2-col', titulo(c.nome), el('div', 'w2-sub', `${atoAtual.nome} · Cidade`, el('span', 'w2-estado aberta', 'Aberta'), el('span', 'w2-tipo', TIPOS_DE_NO.cidade)), el('p', 'w2-desc', 'O ponto de partida do ato: loja, depósito e os serviços da vila. Daqui saem as estradas para as primeiras fases.'));
      const saidas = el('ul', 'w2-lista', ...(c.conexoes ?? []).map((huntId) => { const f = escolhida.fases.find((x) => x.huntId === huntId); return el('li', f?.completa ? 'feito' : null, `${f?.completa ? '✓ ' : ''}${f?.nome ?? huntId}`); }));
      const col2 = el('div', 'w2-col', el('div', 'w2-bloco', el('span', 'w2-rotulo-bloco', 'Estradas daqui'), saidas));
      const voltar = botao('w2-entrar', 'Voltar à cidade');
      voltar.onclick = () => h.voltarParaCidade?.();
      painel.append(col1, col2, el('div', 'w2-col acao', voltar, el('p', 'w2-nota', 'Encerra a caçada atual (se houver) e volta para a vila.')));
      return;
    }
    if (sel.tipo === 'fase') {
      const posicao = Math.max(0, escolhida.fases.findIndex((x) => x.huntId === sel.huntId));
      const f = escolhida.fases[posicao];
      const m = mundo[f.huntId] ?? {};
      const st = estadoDoNo(f);
      const tipo = tipoDaFase(m);
      const hunt = hunts.get(f.huntId);
      const col1 = el('div', 'w2-col', titulo( f.nome), el('div', 'w2-sub', `${atoAtual.nome} · Fase ${m.grafo?.ordem ?? posicao + 1}`, el('span', `w2-estado ${st}`, TEXTO_DO_ESTADO[st]), tipo !== 'comum' ? el('span', 'w2-tipo', TIPOS_DE_NO[tipo]) : null, fronteira?.huntId === f.huntId ? el('span', 'w2-tipo atual', 'Fase atual') : null), m.ambiente ? el('span', 'w2-tag', m.ambiente) : null, el('p', 'w2-desc', m.descricao ?? 'Sem descrição.'), linha('Dificuldade', escolhida.nome), linha('Level dos monstros', `~${f.nivel}${m.levelRecomendado ? ` (recomendado ${m.levelRecomendado}+)` : ''}`), m.bossPrincipal ? linha('Boss principal', m.bossPrincipal) : null);
      const col2 = el('div', 'w2-col');
      // O bloco "Monstros" saiu do painel (dono, 07/10).
      // O objetivo de verdade da fase (o servidor manda: limpar a área, matar o chefe, matar N, pegar o item da missão) e o progresso.
      const conclusao = el('ul', 'w2-lista');
      const obj = f.objetivo;
      const texto = obj?.texto ? `${obj.texto[0].toUpperCase()}${obj.texto.slice(1)}` : 'Limpar a área';
      const feito = f.completa || (obj && obj.feito >= obj.total);
      conclusao.append(el('li', feito ? 'feito' : null, `${feito ? '✓ ' : ''}${texto}${obj?.tipo === 'matar-n' && !feito ? ` (${obj.feito}/${obj.total})` : ''}`));
      for (const o of m.obrigatorios ?? []) conclusao.append(el('li', null, `${o.nome}${o.tipo === 'boss' || o.tipo === 'miniboss' ? ' (obrigatório)' : ''}`));
      col2.append(el('div', 'w2-bloco', el('span', 'w2-rotulo-bloco', 'Para concluir'), conclusao));
      const exigencias = [];
      const anterior = escolhida.fases[posicao - 1];
      if (anterior && anterior.ato === f.ato && !anterior.pular) exigencias.push([anterior.nome, anterior.completa]);
      for (const e of m.exige ?? []) exigencias.push([e.nome, escolhida.fases.find((x) => x.huntId === e.huntId)?.completa ?? false]);
      if (exigencias.length) col2.append(el('div', 'w2-bloco', el('span', 'w2-rotulo-bloco', 'Requisitos'), el('ul', 'w2-lista', ...exigencias.map(([nome, ok]) => el('li', ok ? 'feito' : 'falta', `${ok ? '✓' : '○'} Completar ${nome}`)))));
      if (m.conhecidos?.length) col2.append(el('div', 'w2-bloco', el('span', 'w2-rotulo-bloco', 'Também nesta fase'), el('ul', 'w2-lista', ...m.conhecidos.map((o) => el('li', o.feito ? 'feito' : null, `${o.feito ? '✓ ' : ''}${o.nome} — ${{ boss: 'boss opcional', miniboss: 'miniboss opcional', sobrevivencia: 'desafio de ondas', fenda: 'fenda', invasor: 'invasão' }[o.tipo] ?? o.tipo}`)))));
      if (m.descobertos?.length) col2.append(el('div', 'w2-bloco', el('span', 'w2-rotulo-bloco', 'Encontrado aqui'), el('ul', 'w2-lista achados', ...m.descobertos.map((d) => el('li', null, `✦ ${d.nome}${d.vezes > 1 ? ` (×${d.vezes})` : ''}`)))));
      const entrar = botao('w2-entrar', st === 'travada' ? 'Em obras' : f.liberada ? 'Entrar' : 'Bloqueada');
      entrar.disabled = !f.liberada || !hunt || !!f.pular;
      // Só o servidor decide: este botão pede pelo mesmo fluxo de sempre e o servidor recusa o que não está aberto.
      entrar.onclick = () => h.entrarNaFase(hunt, atoAtual.fases.map((x) => hunts.get(x.huntId)).filter(Boolean));
      const col3 = el('div', 'w2-col acao', entrar, el('p', 'w2-nota', f.completa ? `${f.limpezas > 1 ? `${f.limpezas} limpezas feitas` : 'Concluída'} — pode repetir a fase.` : f.liberada ? `Para concluir: ${f.objetivo?.texto ?? 'limpar a área'}.` : 'Complete os requisitos acima para abrir.'));
      painel.append(col1, col2, col3);
    } else {
      const b = atoAtual.boss;
      const st = estadoDoNo(b);
      const dados = bosses.get(b.bossId);
      const aberto = h.portalAberto(b);
      const col1 = el('div', 'w2-col', titulo( `Boss do ${atoAtual.nome}`), el('div', 'w2-sub', b.nome, el('span', `w2-estado ${st}`, TEXTO_DO_ESTADO[st]), el('span', 'w2-tipo', 'Boss principal')), linha('Dificuldade', escolhida.nome), linha('Level', `~${b.nivel}`), el('p', 'w2-desc', aberto ? 'Portal aberto: pode enfrentá-lo agora, sem espera.' : b.liberado ? `${b.vencido ? 'Vencido, sem espera. ' : ''}Elimine todos os monstros da última fase do ato, nesta execução, para abrir o portal.` : `Complete as ${atoAtual.total} fases do ${atoAtual.nome} para liberá-lo.`));
      const col2 = el('div', 'w2-col', dados?.creatures?.length ? el('div', 'w2-bichos', figuraDaCriatura(dados.creatures[0], bestiario, 52)) : null, el('div', 'w2-bloco', el('span', 'w2-rotulo-bloco', 'Requisito'), el('ul', 'w2-lista', el('li', atoAtual.feitas === atoAtual.total ? 'feito' : 'falta', `${atoAtual.feitas === atoAtual.total ? '✓' : '○'} ${atoAtual.feitas}/${atoAtual.total} fases completas`))));
      const enfrentar = botao('w2-entrar', aberto ? 'Enfrentar' : b.liberado ? 'Limpe a última fase' : 'Bloqueado');
      enfrentar.disabled = !aberto;
      enfrentar.onclick = () => h.enfrentarBoss(b);
      painel.append(col1, col2, el('div', 'w2-col acao', enfrentar));
    }
  }

  // ---- 6. a barra de atalhos (só o que existe de verdade)
  const aoc = campanha.aoCompletar;
  barra.append(
    botao(`w2-atalho${aoc === 'repetir' ? ' on' : ''}`, 'Ficar na fase', () => h.definirAoCompletar('repetir')),
    botao(`w2-atalho${aoc === 'seguir' ? ' on' : ''}`, 'Avançar sozinho', () => h.definirAoCompletar('seguir')),
    botao('w2-atalho', 'Fase atual', () => {
      if (!fronteira) return;
      const a = atos.find((x) => x.ato === fronteira.ato);
      if (a && a !== atoAtual) trocarAto(a);
      selecionarNo({ tipo: 'fase', huntId: fronteira.huntId }, { centrar: true });
    }),
    botao('w2-atalho', 'Lista', () => h.verLista?.())
  );
  const sub = barra.querySelectorAll('.w2-atalho');
  sub[0].title = 'Com a fase completa, continua em loop na mesma fase (bom para farmar).';
  sub[1].title = 'Jogando online, com a fase completa vai para a próxima do Ato. Offline fica sempre em loop.';
  desenharControles();
  trocarAto(atoAtual, true);
}
