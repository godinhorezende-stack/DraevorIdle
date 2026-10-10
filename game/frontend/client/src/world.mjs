// A tela CAMPANHA (antes "WORLD"): o mapa da campanha — dificuldades, abas dos Atos, mapa interativo (zoom, arraste, pinça), painel da fase e barra de atalhos.
//
// É a MESMA campanha de sempre (`{t:'campanha'}` → `systems/campanha.mjs`): quem decide o que está aberto, concluído ou exigido é o
// SERVIDOR — aqui só se desenha o que chegou e se pede o que o jogo já permite (entrar na fase pelo mesmo fluxo de sempre). Segredo nunca
// chega aqui: o servidor só manda o que o jogador já encontrou.
//
// O mapa é SVG (13 nós por Ato: poucas formas, nítido em qualquer zoom e acessível por teclado/leitor de tela); a câmera move UM grupo
// (`transform`), o pergaminho de cada Ato é desenhado uma vez, e trocar a seleção só mexe em classes e no painel — nada é refeito.
// Os dados e as contas moram em `world-dados.mjs` (testável sem DOM); a arte procedural em `world-arte.mjs`.
import { LARGURA, ALTURA, RAIO_DA_FASE, RAIO_DO_BOSS, TIPOS_DE_NO, TEXTO_DO_ESTADO, atosDaCampanha, faseDaFronteira, ondeEstaNoMapa, posicoesDoAto, conexoesDoAto, tracadoDaEstrada, tipoDaFase, estadoDoNo } from './world-dados.mjs';
import { svg, fundoDoAto, nomeDoTema, ICONES, ICONE_DO_TIPO, iconeDeBotao } from './world-arte.mjs';
import { faixaDosMapas } from './mapas-dispositivo.mjs';

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
  // a folga em px da TELA, na memória da tela (a tela se redesenha sozinha a cada 8 s: o painel aberto continua com ela)
  const folga = (E.folga ??= { x: 0, y: 0 });
  const emUnidadesDoMapa = (px) => px / (svgEl.getScreenCTM()?.a || 1);
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
    // O mapa (0..LARGURA × 0..ALTURA, escalado por k) sempre cobre a parte visível: dá para arrastar até cada borda, nunca além — menos a
    // FOLGA do lado que o painel aberto cobre (`folga`): sem ela, o nó perto da borda direita (ou do pé, no celular) ficava atrás do painel.
    const v = visivel();
    vista.x = Math.max(v.x0 + v.w - LARGURA * vista.k - emUnidadesDoMapa(folga.x), Math.min(v.x0, vista.x));
    vista.y = Math.max(v.y0 + v.h - ALTURA * vista.k - emUnidadesDoMapa(folga.y), Math.min(v.y0, vista.y));
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
  /** Leva o ponto (px, py) do mapa até o ponto (sx, sy) da TELA, no zoom `k` (o painel aberto: o nó escolhido vai para a parte livre). */
  const levarPara = (px, py, k, sx, sy) => {
    const m = svgEl.getScreenCTM();
    if (!m) return centrarEm(px, py, k);
    const alvo = new DOMPoint(sx, sy).matrixTransform(m.inverse());
    vista.k = Math.max(K_MIN, Math.min(K_MAX, k));
    vista.x = alvo.x - px * vista.k;
    vista.y = alvo.y - py * vista.k;
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
  /** A folga (em px da TELA) à direita e embaixo, além da borda do mapa: o painel aberto cobre esse pedaço. `(0, 0)` tira. */
  const definirFolga = (px, py) => {
    folga.x = Math.max(0, px);
    folga.y = Math.max(0, py);
  };
  return { zoom, centrarEm, levarPara, definirFolga, aplicar, centro: () => ({ x: viewport.getBoundingClientRect().left + viewport.clientWidth / 2, y: viewport.getBoundingClientRect().top + viewport.clientHeight / 2 }) };
}

// ---------------------------------------------------------------- o nó

export function desenharNo({ id, tipo, estado, numero, nome, p, atual, novo, escolhido, boss, achados = 0 }) {
  const r = boss ? RAIO_DO_BOSS : RAIO_DA_FASE;
  const g = svg('g', { class: `w-no ${estado} t-${tipo}${atual ? ' atual' : ''}${novo ? ' novo' : ''}${escolhido ? ' escolhido' : ''}`, transform: `translate(${p.x} ${p.y})`, tabindex: 0, role: 'button', 'data-id': id, 'aria-label': `${nome}. ${TIPOS_DE_NO[tipo]}. ${TEXTO_DO_ESTADO[estado]}${atual ? '. Você está aqui' : ''}` });
  // O ALVO do toque: invisível e bem maior que o nó pequeno — o dedo acerta sem o desenho virar botão.
  g.append(svg('circle', { class: 'w-alvo', r: r + 14 }));
  g.append(svg('circle', { class: 'w-halo', r: r + 7 }));
  // (A fase atual é marcada só pela COR — o ciano do `.w-no.atual`. O anel que pulsava saindo do nó saiu: dono, 07/10, "quero deixar só
  // uma cor para dizer que estou aqui e tirar essa animação da bola saindo de onde estou".)
  // a forma diz o tipo (não só a cor): disco = fase, hexágono = miniboss/desafio, losango com pontas = boss, anel tracejado = opcional/secreto
  const forma = { class: 'w-forma' };
  if (boss || tipo === 'boss-fase') g.append(svg('polygon', { ...forma, points: `0,${-r - 4} ${r + 4},0 0,${r + 4} ${-r - 4},0` }));
  else if (tipo === 'miniboss' || tipo === 'desafio') g.append(svg('polygon', { ...forma, points: [0, 1, 2, 3, 4, 5].map((i) => `${(Math.cos((i * Math.PI) / 3 + Math.PI / 6) * (r + 1)).toFixed(1)},${(Math.sin((i * Math.PI) / 3 + Math.PI / 6) * (r + 1)).toFixed(1)}`).join(' ') }));
  else g.append(svg('circle', { ...forma, r, ...(tipo === 'boss-opcional' || tipo === 'secreta' ? { 'stroke-dasharray': '4 3' } : {}) }));
  // O ícone na escala do nó (os ícones são desenhados para ±11). A fase aberta comum é a esfera com um ponto aceso (o número fica na placa).
  const conteudo = svg('g', { class: 'w-icone', transform: `scale(${boss ? 0.95 : 0.74})` });
  if (estado === 'fechada') conteudo.append(ICONES.cadeado());
  else if (estado === 'travada') conteudo.append(ICONES.xis());
  else if (estado === 'completa' && !boss) conteudo.append(ICONES.visto());
  else if (ICONE_DO_TIPO[tipo]) conteudo.append(ICONES[ICONE_DO_TIPO[tipo]](boss ? 1.25 : 1));
  else conteudo.append(svg('circle', { class: 'w-ponto', r: 4 }));
  g.append(conteudo);
  // selo do tipo no canto quando o nó mostra o estado (concluído/bloqueado) e o tipo é especial
  if (estado !== 'aberta' && ICONE_DO_TIPO[tipo] && !boss) g.append(svg('g', { class: 'w-selo', transform: `translate(${r - 4} ${-r + 5}) scale(.55)` }, svg('circle', { r: 11 }), ICONES[ICONE_DO_TIPO[tipo]]()));
  // algo que o jogador JÁ ENCONTROU nesta fase (baú, altar, segredo): uma estrela no canto — nunca o que ele ainda não achou
  if (achados) g.append(svg('g', { class: 'w-selo achado', transform: `translate(${-r + 4} ${-r + 5}) scale(.6)` }, svg('circle', { r: 11 }), ICONES.estrela(1.2)));
  const texto = nome.length > 22 ? `${nome.slice(0, 21)}…` : nome;
  // A PLACA do rótulo (o estilo do mapa ilustrado — dono, 07/10): fundo escuro atrás do nome, legível sobre qualquer arte. A largura
  // acompanha o texto: a estimativa (~7,8 px por letra maiúscula na Cinzel do rótulo) e, desenhado e com a fonte carregada, a medida de
  // verdade — o nome não passa da placa (dono, 09/10: "não aparece o nome da fase direito"; com 6,4 px por letra, "Profundezas
  // Inundadas" saía 17 px para fora). O número da fase vai pequeno acima do nome.
  const largura = Math.max(56, Math.round(texto.length * 7.8) + 16);
  const placa = svg('g', { class: 'w-placa' });
  const fundo = svg('rect', { x: -largura / 2, y: r + 6, width: largura, height: 20, rx: 4 });
  placa.append(fundo);
  if (numero && !boss) placa.append(svg('text', { class: 'w-placa-num', 'text-anchor': 'middle', y: r + 4 }, String(numero)));
  const rotulo = svg('text', { class: 'w-rotulo', 'text-anchor': 'middle', y: r + 20 }, texto);
  placa.append(rotulo);
  g.append(placa);
  ajustarPlaca(fundo, rotulo, largura);
  return g;
}

/** Depois do desenho (e da fonte): a placa do tamanho do nome de verdade. Fora do navegador (os testes), fica a estimativa. */
function ajustarPlaca(fundo, rotulo, largura) {
  if (typeof requestAnimationFrame !== 'function' || typeof document === 'undefined') return;
  const medir = () => {
    if (!rotulo.isConnected) return;
    const w = Math.ceil(rotulo.getBBox().width) + 16;
    if (w <= largura && w >= largura - 24) return;
    fundo.setAttribute('x', String(-w / 2));
    fundo.setAttribute('width', String(Math.max(56, w)));
  };
  (document.fonts?.ready ?? Promise.resolve()).then(() => requestAnimationFrame(medir));
}

// ---------------------------------------------------------------- a tela

/*
 * ---- O mapa é o protagonista (dono, 09/10: "faça algo assim", com o mockup do mapa de campanha de ARPG) ----
 * Antes o painel da fase ficava fixo à direita (~35% da tela) e as dificuldades e os Atos eram botões. Agora: as dificuldades viram
 * abas no topo; os Atos, uma faixa com setas, número romano e o progresso; o MAPA ocupa todo o resto (vinheta, névoa, bússola, um
 * controle de zoom pequeno); o painel só aparece quando se escolhe um nó, deslizando por cima do mapa, e fecha no X, no Esc ou num
 * toque no mapa vazio; o rodapé leva o progresso do Ato, os modos e "Próxima fase".
 */
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
const romano = (n) => ROMANOS[n - 1] ?? String(n);

/**
 * Desenha a tela inteira dentro de `body`. `h` traz o que vem do resto do jogo (para não importar `panels.mjs`):
 * `figuraDaCriatura`, `huntIdAtual()` (a caçada em que o personagem está, ou null — o nó azul), `entrarNaFase(hunt, lista)`, `enfrentarBoss(boss)`, `portalAberto(boss)`, `escolherDificuldade(id)`, `definirAoCompletar(valor)`, `fechar()`, `verLista()` (só no clássico; sem ele, nada de botão Lista).
 */
export function desenharMundo(body, { campanha, escolhida, hunts, bosses, bestiario, h }) {
  const { figuraDaCriatura } = h;
  const mundo = campanha.mundo ?? {};
  const atos = atosDaCampanha(escolhida, campanha.atos ?? {});
  if (!atos.length) return void body.append(el('p', 'empty', 'A campanha ainda não tem Atos.'));
  const fronteira = faseDaFronteira(escolhida);
  // Onde o personagem ESTÁ (o nó azul): a fase em que caça, ou a cidade do ato em que estava (`ondeEstaNoMapa`). A fronteira (a próxima
  // fase a fazer) continua com a estrada acesa e o selo "Próxima fase".
  const onde = ondeEstaNoMapa({ huntId: h.huntIdAtual?.() ?? null, escolhida, atoDaCidade: campanha.atoDaCidade ?? null });

  // Qual Ato mostrar: o que o jogador estava vendo (se segue aberto), o de onde ele está ou o da próxima fase.
  let atoAtual = atos.find((a) => a.ato === (E.ato ?? ler().ato) && a.aberto) ?? atos.find((a) => a.ato === onde?.ato && a.aberto) ?? atos.find((a) => a.ato === fronteira?.ato) ?? atos[0];
  if (!E.sel || !(E.sel.tipo === 'boss' ? atos.some((a) => a.ato === E.sel.ato) : E.sel.tipo === 'cidade' || escolhida.fases.some((f) => f.huntId === E.sel.huntId))) E.sel = fronteira ? { tipo: 'fase', huntId: fronteira.huntId } : null;
  if (E.sel && (E.sel.tipo === 'boss' || E.sel.tipo === 'cidade' ? E.sel.ato : escolhida.fases.find((f) => f.huntId === E.sel.huntId)?.ato) !== atoAtual.ato) E.sel = null;
  if (!E.sel) E.sel = atoAtual.fases.length ? { tipo: 'fase', huntId: (atoAtual.fases.find((f) => f.huntId === fronteira?.huntId) ?? atoAtual.fases[0]).huntId } : null;

  // O que já era visível antes: o que abriu desde a última vez ganha o brilho de "descoberta".
  const chaveVisto = escolhida.id;
  const antes = E.vistos.get(chaveVisto);
  const agora = new Set(escolhida.fases.filter((f) => f.liberada).map((f) => f.huntId));
  E.vistos.set(chaveVisto, agora);
  const novos = antes ? new Set([...agora].filter((id) => !antes.has(id))) : new Set();

  const raiz = el('div', 'w2');
  raiz.dataset.dificuldade = escolhida.id;

  // ---- 1. o topo: as dificuldades, em abas (o título "CAMPANHA" é o da janela do jogo)
  const aviso = el('div', 'w2-aviso');
  aviso.hidden = true;
  let avisoTimer = null;
  const mostrarAviso = (texto) => {
    aviso.textContent = texto;
    aviso.hidden = !texto;
    clearTimeout(avisoTimer);
    if (texto) avisoTimer = setTimeout(() => (aviso.hidden = true), 5000);
  };
  const dif = el('nav', 'w2-dificuldades');
  dif.setAttribute('aria-label', 'Dificuldade');
  const concluidaDif = (d) => d.fases.every((f) => f.completa || f.pular) && d.bosses.every((b) => b.vencido);
  for (const d of campanha.dificuldades) {
    const ind = d.id === escolhida.id ? 'selecionada' : d.liberada ? 'aberta' : 'bloqueada';
    const b = botao(`w2-dif ${ind}${concluidaDif(d) ? ' concluida' : ''}`, null);
    b.append(el('b', null, d.liberada ? null : el('i', 'w2-cad', iconeDeBotao('cadeado')), d.nome), el('small', null, d.liberada ? `Nível ${d.faixa[0]} – ${d.faixa[1]}` : 'Bloqueada'));
    if (concluidaDif(d)) b.append(el('i', 'w2-selo-ok', iconeDeBotao('visto')));
    b.setAttribute('aria-pressed', String(d.id === escolhida.id));
    b.onclick = () => {
      if (!d.liberada) {
        const i = campanha.dificuldades.findIndex((x) => x.id === d.id);
        const ant = campanha.dificuldades[i - 1];
        return mostrarAviso(`O ${d.nome} abre depois de vencer o boss do Ato ${romano(atos.at(-1).ato)} no ${ant?.nome ?? 'nível anterior'}.`);
      }
      mostrarAviso('');
      if (d.id !== escolhida.id) {
        lembrarDificuldade(d.id);
        h.escolherDificuldade(d.id);
      }
    };
    dif.append(b);
  }
  // A aba MAPAS (o Dispositivo de Mapas do endgame): fechada até o chefe do Ato do dispositivo.
  if (campanha.mapas && h.abrirMapas) {
    const m = campanha.mapas;
    const b = botao(`w2-dif mapas ${m.liberado ? 'aberta' : 'bloqueada'}`, null);
    b.append(el('b', null, m.liberado ? null : el('i', 'w2-cad', iconeDeBotao('cadeado')), 'Mapas'), el('small', null, faixaDosMapas(m)));
    b.onclick = () => (m.liberado ? h.abrirMapas() : mostrarAviso(m.motivo ?? `Os mapas abrem depois do chefe do Ato ${romano(m.ato)}.`));
    dif.append(b);
  }

  // ---- 2. a faixa dos Atos: setas, o número romano e o progresso de cada um
  const faixa = el('div', 'w2-atos-faixa');
  const abas = el('nav', 'w2-atos');
  abas.setAttribute('aria-label', 'Atos');
  abas.setAttribute('role', 'tablist');
  const abaDe = new Map();
  for (const a of atos) {
    const b = botao(`w2-aba${a.aberto ? '' : ' bloqueada'}${a.concluido ? ' concluida' : ''}`, null);
    b.setAttribute('role', 'tab');
    b.title = a.nome;
    b.append(el('span', 'w2-aba-nome', `Ato ${romano(a.ato)}`));
    if (!a.aberto) b.append(el('i', 'w2-cad', iconeDeBotao('cadeado')));
    else b.append(el('small', null, a.concluido ? el('i', 'w2-ok', iconeDeBotao('visto')) : null, `${a.feitas} / ${a.total}`), el('i', 'w2-aba-barra', el('i', null)));
    const barra = b.querySelector('.w2-aba-barra > i');
    if (barra) barra.style.width = `${a.total ? Math.round((100 * a.feitas) / a.total) : 0}%`;
    b.onclick = () => {
      if (!a.aberto) return mostrarAviso(`O Ato ${romano(a.ato)} abre quando você completar o Ato anterior (e vencer o boss dele).`);
      mostrarAviso('');
      trocarAto(a);
    };
    abaDe.set(a.ato, b);
    abas.append(b);
  }
  const rolar = (sentido) => abas.scrollBy({ left: sentido * Math.max(160, abas.clientWidth * 0.6), behavior: reduzMovimento() ? 'auto' : 'smooth' });
  const setaAnt = botao('w2-seta', iconeDeBotao('esquerda'), () => rolar(-1));
  const setaProx = botao('w2-seta', iconeDeBotao('direita'), () => rolar(1));
  setaAnt.setAttribute('aria-label', 'Atos anteriores');
  setaProx.setAttribute('aria-label', 'Próximos Atos');
  faixa.append(setaAnt, abas, setaProx);
  // As setas só aparecem quando a faixa não cabe inteira (e cada uma some na ponta dela).
  const atualizarSetas = () => {
    const sobra = abas.scrollWidth - abas.clientWidth;
    faixa.classList.toggle('rola', sobra > 4);
    setaAnt.disabled = abas.scrollLeft <= 2;
    setaProx.disabled = abas.scrollLeft >= sobra - 2;
  };
  abas.addEventListener('scroll', atualizarSetas, { passive: true });

  // ---- 3. o mapa (e, por cima dele, o painel da fase escolhida)
  const palco = el('div', 'w2-palco');
  const viewport = el('div', 'w2-viewport');
  const bussola = el('div', 'w2-bussola');
  bussola.innerHTML = '<svg viewBox="-42 -42 84 84" aria-hidden="true"><circle r="26" class="b-anel"/><circle r="18" class="b-anel2"/><path d="M0 -24 L5 0 L0 24 L-5 0 Z" class="b-agulha"/><path d="M-24 0 L0 5 L24 0 L0 -5 Z" class="b-agulha2"/><text y="-30" class="b-txt">N</text><text y="38" class="b-txt">S</text><text x="34" y="3.5" class="b-txt">L</text><text x="-34" y="3.5" class="b-txt">O</text></svg>';
  // No celular, `slice` (dono, 07/10: "a foto do ato de fundo não está cheia, tem parte preta"): o mapa COBRE o palco e o que sobra se
  // alcança arrastando. No computador o palco é bem mais largo que o mapa e `slice` cortava o alto e o pé do Ato (a fase inicial ficava fora
  // da tela): `meet` mostra o Ato INTEIRO, e as sobras dos lados são a própria arte, desfocada e escura, atrás (`--w2-arte`) — a carta na
  // mesa. A câmera limita pela parte visível nos dois casos (`criarCamera`).
  const mapaSvg = svg('svg', { class: 'w2-svg', viewBox: `0 0 ${LARGURA} ${ALTURA}`, preserveAspectRatio: estreita() ? 'xMidYMid slice' : 'xMidYMid meet', role: 'group' });
  const cam = svg('g', { class: 'w2-cam' });
  mapaSvg.append(cam);
  viewport.append(mapaSvg);
  // A "carta": a vinheta e a névoa das bordas por cima da arte (não pegam o toque).
  const vinheta = el('div', 'w2-vinheta');
  const nevoa = el('div', 'w2-nevoa');
  const balao = el('div', 'w2-balao');
  balao.hidden = true;
  const controles = el('div', 'w2-controles');
  // A dica só até a primeira vez que o jogador mexe no mapa (dono, 09/10: "mostraria só quando entrar pela primeira vez").
  const dica = el('div', 'w2-dica',
    el('span', null, iconeDeBotao('mouse'), estreita() ? 'Arraste' : 'Arraste para mover'),
    el('span', null, iconeDeBotao('roda'), estreita() ? 'Pinça' : 'Roda para o zoom'),
    el('span', null, iconeDeBotao('mao'), estreita() ? 'Toque num nó' : 'Clique num nó para ver a fase'));
  dica.hidden = !!ler().dicaVista;
  const painel = el('section', 'w2-painel');
  painel.hidden = true;
  painel.setAttribute('aria-live', 'polite');
  palco.append(viewport, vinheta, nevoa, bussola, balao, controles, dica, aviso, painel);

  // ---- 4. o rodapé: o progresso do Ato, os modos e a próxima fase
  const rodape = el('footer', 'w2-rodape');
  const feitas = el('div', 'w2-feitas');
  const modos = el('div', 'w2-modos');
  const proxima = botao('w2-proxima', null);
  proxima.append(el('span', null, 'Próxima fase'), iconeDeBotao('seta'));
  rodape.append(feitas, modos, proxima);

  raiz.append(dif, faixa, palco, rodape);
  body.append(raiz);

  // A tela se adapta à CAIXA do jogo em que está: mede a janela (e remede quando ela muda) e marca `larga` (700 px+: ocupa a altura toda,
  // sem rolagem). Celular em pé fica no fluxo normal (a página rola) e o painel vira uma gaveta por cima do mapa.
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
    raiz.style.setProperty('--w2-h', cabe ? `${Math.floor(altura)}px` : 'auto');
    atualizarSetas();
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
  const idDaSelecao = (sel) => (!sel ? null : sel.tipo === 'boss' ? `boss:${sel.ato}` : sel.tipo === 'cidade' ? `cidade:${sel.ato}` : sel.huntId);

  /** Escolhe o nó (o brilho no mapa) e, com `abrir`, abre o painel dele. */
  const selecionarNo = (sel, { centrar = false, abrir = true } = {}) => {
    E.sel = sel;
    if (abrir) E.painel = true;
    const id = idDaSelecao(sel);
    for (const [nid, g] of nosPorId) g.classList.toggle('escolhido', E.painel && nid === id);
    desenharPainel();
    if (centrar && dadosDoAto) {
      const p = dadosDoAto.posicao(id);
      if (p) camera.centrarEm(p.x, p.y, Math.max(1.4, vista.k));
    }
    if (E.painel) fugirDoPainel(id);
  };
  /** O nó escolhido atrás do painel (à direita no computador, embaixo no celular): a câmera o traz para o meio da parte livre do mapa. */
  const fugirDoPainel = (id) => {
    const g = nosPorId.get(id);
    const p = dadosDoAto?.posicao(id);
    if (!g || !p || painel.hidden) return;
    const no = g.querySelector('.w-forma')?.getBoundingClientRect();
    const tela = palco.getBoundingClientRect();
    const pn = painel.getBoundingClientRect();
    if (!no || !no.width) return;
    const cx = no.left + no.width / 2;
    const cy = no.top + no.height / 2;
    const gaveta = pn.width >= tela.width - 40; // o painel atravessa o palco: é a gaveta do celular
    if (gaveta ? cy < pn.top - 24 : cx < pn.left - 24) return;
    camera.definirFolga(gaveta ? 0 : tela.right - pn.left + 12, gaveta ? tela.bottom - pn.top + 12 : 0);
    const k = Math.max(vista.k, 1.3);
    if (gaveta) camera.levarPara(p.x, p.y, k, cx, tela.top + (pn.top - tela.top) / 2);
    else camera.levarPara(p.x, p.y, k, tela.left + (pn.left - tela.left) / 2, Math.min(Math.max(cy, tela.top + 60), tela.bottom - 60));
  };
  const fecharPainel = () => {
    E.painel = false;
    for (const g of nosPorId.values()) g.classList.remove('escolhido');
    desenharPainel();
    // sem o painel, sem a folga: o mapa volta a encostar nas bordas
    camera.definirFolga(0, 0);
    camera.aplicar();
  };

  function montarMapa() {
    cam.replaceChildren();
    nosPorId.clear();
    const a = atoAtual;
    const pos = posicoesDoAto(a.fases, !!a.boss, mundo, a.ato, a.bossMapa);
    const pontos = [...pos.pontos, ...(pos.boss ? [pos.boss] : [])];
    cam.append(fundoDoAto(a.ato, nomeDoTema(a.ato, a.tema), pontos, a.fundo));
    const arte = a.fundo?.url ?? (a.fundo?.arquivo ? `/gamedata/mapa-mundo/${a.fundo.arquivo}` : null);
    viewport.style.setProperty('--w2-arte', arte ? `url("${arte}")` : 'none');
    viewport.classList.toggle('com-arte', !!arte);
    // A CIDADE: o nó de partida (sempre aberta). Sem posição do editor, fica à esquerda da primeira fase.
    const cidadeId = `cidade:${a.ato}`;
    const cidade = a.cidade ? { ...a.cidade, p: a.cidade.posicao ?? { x: Math.max(60, (pos.pontos[0]?.x ?? 100) - 120), y: pos.pontos[0]?.y ?? ALTURA / 2 } } : null;
    const ids = [...a.fases.map((f) => f.huntId), ...(a.boss ? [`boss:${a.ato}`] : []), ...(cidade ? [cidadeId] : [])];
    if (cidade) pontos.push(cidade.p);
    const posicao = (id) => pontos[ids.indexOf(id)];
    // as estradas (sob os nós): concluída em ouro contínuo, a próxima em ouro tracejado andando, a futura apagada
    const estradas = svg('g', { class: 'w2-estradas' });
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
    const escolhido = E.painel ? idDaSelecao(E.sel) : null;
    a.fases.forEach((f, i) => {
      const m = mundo[f.huntId] ?? {};
      const g = desenharNo({ id: f.huntId, tipo: tipoDaFase(m), estado: estadoDoNo(f), numero: m.grafo?.ordem ?? escolhida.fases.indexOf(f) + 1, nome: f.nome, p: pos.pontos[i], atual: onde?.id === f.huntId, novo: novos.has(f.huntId), escolhido: escolhido === f.huntId, achados: m.descobertos?.length ?? 0 });
      nosPorId.set(f.huntId, g);
      nos.append(g);
    });
    if (cidade) {
      const g = desenharNo({ id: cidadeId, tipo: 'cidade', estado: 'aberta', numero: 0, nome: cidade.nome, p: cidade.p, atual: onde?.id === cidadeId, escolhido: escolhido === cidadeId });
      g.classList.add('t-cidade-no');
      nosPorId.set(cidadeId, g);
      nos.append(g);
    }
    if (a.boss) {
      const g = desenharNo({ id: `boss:${a.ato}`, tipo: 'boss', estado: estadoDoNo(a.boss), numero: 0, nome: a.boss.nome, p: pos.boss, boss: true, atual: onde?.id === `boss:${a.ato}`, escolhido: escolhido === `boss:${a.ato}` });
      nosPorId.set(`boss:${a.ato}`, g);
      nos.append(g);
    }
    cam.append(nos);
    mapaSvg.setAttribute('aria-label', `Mapa do Ato ${romano(a.ato)}`);
    dadosDoAto = { posicao: (id) => posicao(id) };
    chaveVista = `${escolhida.id}:${a.ato}`;
    const salva = E.vistas.get(chaveVista);
    if (salva) Object.assign(vista, salva);
    else {
      // O Ato INTEIRO na tela (o mapa é o protagonista); no celular em pé ele ficaria miúdo: abre mais perto, onde o jogador está.
      const alvo = posicao(idDaSelecao(E.sel)) ?? { x: LARGURA / 2, y: ALTURA / 2 };
      vista.k = estreita() ? 1.35 : 1;
      vista.x = LARGURA / 2 - alvo.x * vista.k;
      vista.y = ALTURA / 2 - alvo.y * vista.k;
    }
    camera.aplicar();
    // O esmaecer de entrada vai no `<svg>`, NUNCA na câmera: o modo leve (`body.sem-animacao`, o padrão no celular) zera o `transform` de
    // todo elemento com "entra"/"abre"/"pulso" na classe — na câmera isso congelava o mapa (arrastar, pinça e zoom calculavam e nada
    // se mexia; 08/10). E a classe sai ao terminar: não fica pendurada.
    if (!reduzMovimento()) {
      mapaSvg.classList.remove('entra');
      void mapaSvg.getBoundingClientRect();
      mapaSvg.classList.add('entra');
      mapaSvg.addEventListener('animationend', () => mapaSvg.classList.remove('entra'), { once: true });
    }
  }

  // O controle de zoom: um bloco pequeno (+, −, centrar onde você está — ou, em outro Ato, na próxima fase).
  function desenharControles() {
    const centrarNaAtual = () => {
      const id = onde?.ato === atoAtual.ato ? onde.id : fronteira?.ato === atoAtual.ato ? fronteira.huntId : idDaSelecao(E.sel);
      const p = dadosDoAto.posicao(id);
      if (p) camera.centrarEm(p.x, p.y, Math.max(1.6, vista.k));
    };
    controles.replaceChildren(
      botao('w2-ctl', iconeDeBotao('mais'), () => camera.zoom(1.4, ...Object.values(camera.centro()))),
      botao('w2-ctl', iconeDeBotao('menos'), () => camera.zoom(1 / 1.4, ...Object.values(camera.centro()))),
      botao('w2-ctl', iconeDeBotao('centrar'), centrarNaAtual)
    );
    [...controles.children].forEach((b, i) => {
      b.setAttribute('aria-label', ['Aproximar', 'Afastar', 'Centrar onde você está'][i]);
      b.title = b.getAttribute('aria-label');
    });
  }

  function desenharRodape() {
    const a = atoAtual;
    feitas.replaceChildren(el('i', 'w2-ok', iconeDeBotao('visto')), el('b', null, `${a.feitas} / ${a.total}`), el('span', null, 'fases'), el('i', 'w2-feitas-barra', el('i', null)));
    feitas.querySelector('.w2-feitas-barra > i').style.width = `${a.total ? Math.round((100 * a.feitas) / a.total) : 0}%`;
    proxima.disabled = !fronteira;
    proxima.title = fronteira ? `Ir para ${fronteira.nome}` : 'Nenhuma fase aberta agora';
  }

  function trocarAto(a, manterSelecao = false) {
    atoAtual = a;
    E.ato = a.ato;
    gravar({ ato: a.ato });
    for (const [n, b] of abaDe) {
      b.classList.toggle('selecionada', n === a.ato);
      b.setAttribute('aria-selected', String(n === a.ato));
    }
    abaDe.get(a.ato)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    if (!manterSelecao) {
      E.sel = a.fases.length ? { tipo: 'fase', huntId: (a.fases.find((f) => f.huntId === fronteira?.huntId) ?? a.fases.find((f) => f.liberada) ?? a.fases[0]).huntId } : null;
      E.painel = false;
      camera.definirFolga(0, 0);
    }
    montarMapa();
    desenharPainel();
    desenharRodape();
    atualizarSetas();
  }

  // ---- interação com os nós: o clique só vale se o gesto NÃO foi um arraste; o toque no mapa vazio fecha o painel
  const noDoPonto = (x, y) => {
    const alvo = document.elementFromPoint(x, y)?.closest?.('.w-no');
    return alvo && cam.contains(alvo) ? alvo : null;
  };
  const selDoId = (id) => (id.startsWith('boss:') ? { tipo: 'boss', ato: Number(id.slice(5)) } : id.startsWith('cidade:') ? { tipo: 'cidade', ato: Number(id.slice(7)) } : { tipo: 'fase', huntId: id });
  viewport.addEventListener('toque', (ev) => {
    const no = noDoPonto(ev.detail.x, ev.detail.y);
    if (!no) return void (E.painel && fecharPainel());
    selecionarNo(selDoId(no.dataset.id));
  });
  viewport.addEventListener('keydown', (ev) => {
    const no = ev.target.closest?.('.w-no');
    if (no && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      selecionarNo(selDoId(no.dataset.id));
    }
  });
  // Com o painel aberto, o Esc fecha SÓ o painel (o Esc do jogo, no `document`, fecharia a janela inteira): escuta na CAPTURA, antes dele,
  // esteja o foco onde estiver; sai sozinho quando a tela some.
  const aoEsc = (ev) => {
    if (!raiz.isConnected) return void document.removeEventListener('keydown', aoEsc, true);
    if (ev.key !== 'Escape' || !E.painel || painel.hidden) return;
    ev.stopPropagation();
    ev.preventDefault();
    fecharPainel();
  };
  document.addEventListener('keydown', aoEsc, true);
  // a dica some na primeira mexida no mapa e não volta
  viewport.addEventListener('pointerdown', () => {
    if (dica.hidden) return;
    dica.classList.add('some');
    setTimeout(() => (dica.hidden = true), 400);
    gravar({ dicaVista: true });
  }, { once: true });
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
    balao.replaceChildren(el('b', null, boss ? b.nome : f.nome), el('span', null, `${TIPOS_DE_NO[boss ? 'boss' : tipoDaFase(mundo[id])]} · nível ~${boss ? b.nivel : f.nivel}`), el('span', `w2-estado ${st}`, TEXTO_DO_ESTADO[st]));
    balao.style.left = `${Math.min(r.width - 200, Math.max(4, ev.clientX - r.left + 14))}px`;
    balao.style.top = `${Math.max(4, ev.clientY - r.top + 14)}px`;
    balao.hidden = false;
  });
  viewport.addEventListener('pointerleave', () => (balao.hidden = true));

  // ---- o painel do nó escolhido: cabeçalho (nome e o que é), o corpo e, embaixo, o botão — por cima do mapa
  const linha = (rotulo, valor, classe = null) => el('div', `w2-linha${classe ? ` ${classe}` : ''}`, el('span', null, rotulo), valor instanceof Node ? valor : el('b', null, valor));
  const chip = (texto, classe = '') => el('span', `w2-chip ${classe}`, texto);
  function moldura(nome, sub) {
    const fechar = botao('w2-fechar', iconeDeBotao('fechar'), fecharPainel);
    fechar.setAttribute('aria-label', 'Fechar');
    fechar.title = 'Fechar (Esc)';
    return el('header', 'w2-p-cab', titulo(nome), el('div', 'w2-p-sub', sub), fechar);
  }
  function desenharPainel() {
    painel.replaceChildren();
    const sel = E.sel;
    if (!E.painel || !sel) {
      painel.hidden = true;
      palco.classList.remove('com-painel');
      E.painelNaTela = false;
      return;
    }
    painel.hidden = false;
    palco.classList.add('com-painel');
    // Desliza só quando ABRE: a tela se redesenha sozinha a cada 8 s (o progresso) e o painel já aberto não pode deslizar de novo.
    if (!E.painelNaTela && !reduzMovimento()) {
      painel.classList.remove('desliza');
      void painel.offsetWidth;
      painel.classList.add('desliza');
    }
    E.painelNaTela = true;
    const r = romano(atoAtual.ato);
    const corpo = el('div', 'w2-p-corpo');
    const acao = el('div', 'w2-p-acao');
    if (sel.tipo === 'cidade') {
      const c = atoAtual.cidade ?? { nome: 'Cidade', conexoes: [] };
      corpo.append(el('div', 'w2-chips', chip('Aberta', 'aberta'), chip(TIPOS_DE_NO.cidade), onde?.id === `cidade:${atoAtual.ato}` ? chip('Você está aqui', 'atual') : null), el('p', 'w2-desc', 'O ponto de partida do Ato: loja, depósito e os serviços da vila. Daqui saem as estradas para as primeiras fases.'));
      const saidas = el('ul', 'w2-lista', ...(c.conexoes ?? []).map((huntId) => { const f = escolhida.fases.find((x) => x.huntId === huntId); return el('li', f?.completa ? 'feito' : null, `${f?.completa ? '✓ ' : ''}${f?.nome ?? huntId}`); }));
      corpo.append(el('div', 'w2-bloco', el('span', 'w2-rotulo-bloco', 'Estradas daqui'), saidas));
      if (campanha.cidadesPorAto && h.irParaCidade) {
        // Cada cidade é uma INSTÂNCIA (o jogo oficial — `systems/cidades.mjs`): daqui se vai para ESTA cidade (saindo da caçada, se for o
        // caso); estando nela, nada a fazer.
        const aqui = onde?.id === `cidade:${atoAtual.ato}`;
        const cacando = !!h.huntIdAtual?.();
        const ir = botao('w2-entrar', aqui ? 'Você está aqui' : cacando ? `Voltar para ${c.nome}` : `Ir para ${c.nome}`);
        ir.disabled = aqui;
        ir.onclick = () => h.irParaCidade(atoAtual.ato);
        acao.append(ir, el('p', 'w2-nota', aqui ? 'Quem está nesta cidade vê você; nas outras cidades, não.' : cacando ? 'Encerra a caçada atual e vai para esta cidade.' : 'Viaja para esta cidade (cada cidade tem os seus jogadores).'));
      } else {
        const voltar = botao('w2-entrar', 'Voltar à cidade');
        voltar.onclick = () => h.voltarParaCidade?.();
        acao.append(voltar, el('p', 'w2-nota', 'Encerra a caçada atual (se houver) e volta para a vila.'));
      }
      // O Dispositivo de Mapas fica na cidade do Ato dele (as Docas de Oriath): o atalho para a aba Mapas.
      if (campanha.mapas && h.abrirMapas && atoAtual.ato === campanha.mapas.ato) {
        const dispositivo = botao('w2-entrar w2-dispositivo', 'Dispositivo de Mapas');
        dispositivo.onclick = () => h.abrirMapas();
        acao.append(dispositivo, el('p', 'w2-nota', campanha.mapas.liberado ? 'Abre os mapas do endgame (T1–T16).' : campanha.mapas.motivo));
      }
      painel.append(moldura(c.nome, `Ato ${r} · Cidade`), corpo, acao);
      return;
    }
    if (sel.tipo === 'fase') {
      const posicao = Math.max(0, escolhida.fases.findIndex((x) => x.huntId === sel.huntId));
      const f = escolhida.fases[posicao];
      const m = mundo[f.huntId] ?? {};
      const st = estadoDoNo(f);
      const tipo = tipoDaFase(m);
      const hunt = hunts.get(f.huntId);
      // (o `append` do DOM escreveria "null" no lugar do que não existe: só vai o que existe)
      corpo.append(...[
        el('div', 'w2-chips', chip(TEXTO_DO_ESTADO[st], st), tipo !== 'comum' ? chip(TIPOS_DE_NO[tipo]) : null, onde?.id === f.huntId ? chip('Você está aqui', 'atual') : null, fronteira?.huntId === f.huntId ? chip('Próxima fase') : null),
        m.ambiente ? el('span', 'w2-tag', m.ambiente) : null,
        el('p', 'w2-desc', m.descricao ?? 'Sem descrição.'),
        linha('Nível dos monstros', `~${f.nivel}${m.levelRecomendado ? ` (recomendado ${m.levelRecomendado}+)` : ''}`),
        linha('Dificuldade', escolhida.nome),
        m.bossPrincipal ? linha('Boss principal', m.bossPrincipal) : null,
      ].filter(Boolean));
      // O objetivo de verdade da fase (o servidor manda: limpar a área, matar o chefe, matar N, pegar o item da missão) e o progresso.
      const conclusao = el('ul', 'w2-lista');
      const obj = f.objetivo;
      const texto = obj?.texto ? `${obj.texto[0].toUpperCase()}${obj.texto.slice(1)}` : 'Limpar a área';
      const feito = f.completa || (obj && obj.feito >= obj.total);
      conclusao.append(el('li', feito ? 'feito' : null, `${feito ? '✓ ' : ''}${texto}${obj?.tipo === 'matar-n' && !feito ? ` (${obj.feito}/${obj.total})` : ''}`));
      for (const o of m.obrigatorios ?? []) conclusao.append(el('li', null, `${o.nome}${o.tipo === 'boss' || o.tipo === 'miniboss' ? ' (obrigatório)' : ''}`));
      corpo.append(el('div', 'w2-bloco', el('span', 'w2-rotulo-bloco', 'Para concluir'), conclusao));
      const exigencias = [];
      const anterior = escolhida.fases[posicao - 1];
      if (anterior && anterior.ato === f.ato && !anterior.pular) exigencias.push([anterior.nome, anterior.completa]);
      for (const e of m.exige ?? []) exigencias.push([e.nome, escolhida.fases.find((x) => x.huntId === e.huntId)?.completa ?? false]);
      if (exigencias.length) corpo.append(el('div', 'w2-bloco', el('span', 'w2-rotulo-bloco', 'Requisitos'), el('ul', 'w2-lista', ...exigencias.map(([nome, ok]) => el('li', ok ? 'feito' : 'falta', `${ok ? '✓' : '○'} Completar ${nome}`)))));
      if (m.conhecidos?.length) corpo.append(el('div', 'w2-bloco', el('span', 'w2-rotulo-bloco', 'Também nesta fase'), el('ul', 'w2-lista', ...m.conhecidos.map((o) => el('li', o.feito ? 'feito' : null, `${o.feito ? '✓ ' : ''}${o.nome} — ${{ boss: 'boss opcional', miniboss: 'miniboss opcional', sobrevivencia: 'desafio de ondas', fenda: 'fenda', invasor: 'invasão' }[o.tipo] ?? o.tipo}`)))));
      if (m.descobertos?.length) corpo.append(el('div', 'w2-bloco', el('span', 'w2-rotulo-bloco', 'Encontrado aqui'), el('ul', 'w2-lista achados', ...m.descobertos.map((d) => el('li', null, `✦ ${d.nome}${d.vezes > 1 ? ` (×${d.vezes})` : ''}`)))));
      const entrar = botao('w2-entrar', st === 'travada' ? 'Em obras' : f.liberada ? 'Entrar na fase' : 'Bloqueada');
      entrar.disabled = !f.liberada || !hunt || !!f.pular;
      // Só o servidor decide: este botão pede pelo mesmo fluxo de sempre e o servidor recusa o que não está aberto.
      entrar.onclick = () => h.entrarNaFase(hunt, atoAtual.fases.map((x) => hunts.get(x.huntId)).filter(Boolean));
      acao.append(entrar, el('p', 'w2-nota', f.completa ? `${f.limpezas > 1 ? `${f.limpezas} limpezas feitas` : 'Concluída'} — pode repetir a fase.` : f.liberada ? `Para concluir: ${f.objetivo?.texto ?? 'limpar a área'}.` : 'Complete os requisitos acima para abrir.'));
      painel.append(moldura(f.nome, `Ato ${r} · Fase ${m.grafo?.ordem ?? posicao + 1}`), corpo, acao);
      return;
    }
    // o BOSS do Ato: a arte (a figura dele, ou a ilustração quando houver), o estado e o caminho até ele
    const b = atoAtual.boss;
    const st = estadoDoNo(b);
    const dados = bosses.get(b.bossId);
    const aberto = h.portalAberto(b);
    const arte = el('div', 'w2-arte');
    if (b.arte) {
      arte.classList.add('ilustrada');
      const img = el('img');
      img.src = b.arte;
      img.alt = b.nome;
      arte.append(img);
    } else if (dados?.creatures?.length) arte.append(figuraDaCriatura(dados.creatures[0], bestiario, 112));
    // No jogo oficial (`b.naFase`) o chefe sai de um portal NA última fase, na mesma instância: o botão leva até ela.
    const descricao = b.naFase
      ? b.liberado
        ? `${b.vencido ? 'Vencido. ' : ''}${b.comoAparece ?? 'Limpe a última fase do ato: um portal se abre nela e o chefe sai dele, na mesma instância.'}`
        : `Complete as ${atoAtual.total} fases do Ato ${r} para liberá-lo.`
      : aberto ? 'Portal aberto: pode enfrentá-lo agora, sem espera.' : b.liberado ? `${b.vencido ? 'Vencido, sem espera. ' : ''}Elimine todos os monstros da última fase do ato, nesta execução, para abrir o portal.` : `Complete as ${atoAtual.total} fases do Ato ${r} para liberá-lo.`;
    const tudo = atoAtual.feitas === atoAtual.total;
    corpo.append(
      arte,
      el('div', 'w2-chips', chip(TEXTO_DO_ESTADO[st], st), chip('Boss principal', 'boss')),
      el('p', 'w2-desc', descricao),
      linha('Nível recomendado', `~${b.nivel}`),
      linha('Dificuldade', escolhida.nome),
      linha('Requisito', `${tudo ? '✓' : '○'} ${atoAtual.feitas}/${atoAtual.total} fases completas`, tudo ? 'ok' : 'falta')
    );
    const ultima = b.naFase && b.ultimaFase ? hunts.get(b.ultimaFase) : null;
    const enfrentar = b.naFase ? botao('w2-entrar', b.liberado ? 'Ir para a fase' : 'Bloqueado') : botao('w2-entrar', aberto ? 'Enfrentar' : b.liberado ? 'Limpe a última fase' : 'Bloqueado');
    enfrentar.disabled = b.naFase ? !(b.liberado && ultima) : !aberto;
    enfrentar.onclick = () => (b.naFase ? h.entrarNaFase(ultima, atoAtual.fases.map((x) => hunts.get(x.huntId)).filter(Boolean)) : h.enfrentarBoss(b));
    acao.append(enfrentar);
    painel.append(moldura(b.nome, `Boss do Ato ${r}`), corpo, acao);
  }

  // ---- os modos (ficar na fase / avançar sozinho), a lista e a próxima fase
  const aoc = campanha.aoCompletar;
  modos.append(
    botao(`w2-modo${aoc === 'repetir' ? ' on' : ''}`, 'Ficar na fase', () => h.definirAoCompletar('repetir')),
    botao(`w2-modo${aoc === 'seguir' ? ' on' : ''}`, 'Avançar sozinho', () => h.definirAoCompletar('seguir'))
  );
  // A lista em cartões só onde ela existe (o Draevor clássico): no jogo oficial a Campanha é só o mapa (dono, 09/10).
  if (h.verLista) modos.append(botao('w2-modo', 'Lista', () => h.verLista()));
  const sub = modos.querySelectorAll('.w2-modo');
  sub[0].title = 'Com a fase completa, continua em loop na mesma fase (bom para farmar).';
  sub[1].title = 'Jogando online, com a fase completa vai para a próxima do Ato. Offline fica sempre em loop.';
  if (sub[2]) sub[2].title = 'As fases em lista.';
  proxima.onclick = () => {
    if (!fronteira) return;
    const a = atos.find((x) => x.ato === fronteira.ato);
    if (a && a !== atoAtual) trocarAto(a);
    selecionarNo({ tipo: 'fase', huntId: fronteira.huntId }, { centrar: true });
  };
  desenharControles();
  trocarAto(atoAtual, true);
}
