// A arte da tela WORLD — toda PROCEDURAL (SVG gerado aqui), sem arquivo de imagem: nada de download extra, nada copiado de outro jogo.
// Cada Ato tem um TEMA (paleta + o que decora o pergaminho); um tema novo é só uma entrada em `TEMAS`.
import { LARGURA, ALTURA, aleatorio } from './world-dados.mjs';

const NS = 'http://www.w3.org/2000/svg';
export const svg = (tag, attrs = {}, ...filhos) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  for (const f of filhos.flat()) if (f) e.append(f);
  return e;
};

/** Os temas de mapa: a paleta do pergaminho e o que o decora. `decoracao`: [símbolo, quantidade]. */
export const TEMAS = {
  floresta: { papel: ['#d8c79a', '#b79f6a'], tinta: '#4a3a1e', agua: '#7f9a9a', decoracao: [['pinheiro', 46], ['montanha', 7], ['ruina', 3]], rio: true },
  deserto: { papel: ['#e0c88e', '#c19a58'], tinta: '#5a3e1a', agua: '#8aa0a0', decoracao: [['duna', 22], ['montanha', 6], ['ruina', 6]], rio: false },
  pantano: { papel: ['#c9c394', '#9d9560'], tinta: '#3d3a1c', agua: '#6f8a7a', decoracao: [['pinheiro', 22], ['pocao', 18], ['ruina', 4]], rio: true },
  cinzas: { papel: ['#bfae94', '#8e7a62'], tinta: '#3a2b24', agua: '#7a6a6a', decoracao: [['montanha', 12], ['rachadura', 14], ['ruina', 6]], rio: false, corrupcao: true },
  neve: { papel: ['#d6d9d2', '#aab4b4'], tinta: '#33414a', agua: '#8aa6b8', decoracao: [['montanha', 14], ['pinheiro', 18], ['duna', 6]], rio: true },
  caverna: { papel: ['#b9aa90', '#85755d'], tinta: '#33271c', agua: '#6a7a82', decoracao: [['montanha', 16], ['rachadura', 10], ['ruina', 4]], rio: false },
};
const TEMA_PADRAO_POR_ATO = ['floresta', 'deserto', 'pantano', 'cinzas'];
export const temaDoAto = (ato, nomeDoTema) => TEMAS[nomeDoTema] ?? TEMAS[TEMA_PADRAO_POR_ATO[(ato - 1) % TEMA_PADRAO_POR_ATO.length]];
export const nomeDoTema = (ato, nomeDoTema) => (TEMAS[nomeDoTema] ? nomeDoTema : TEMA_PADRAO_POR_ATO[(ato - 1) % TEMA_PADRAO_POR_ATO.length]);

function simbolos(tema) {
  const t = tema.tinta;
  return svg('defs', {},
    svg('symbol', { id: 'w-montanha', overflow: 'visible' }, svg('path', { d: 'M-26 14 L-8 -16 L0 -6 L10 -22 L28 14 Z', fill: 'rgba(60,45,25,.16)', stroke: t, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }), svg('path', { d: 'M10 -22 L4 -10 L10 -13 L14 -8 L18 -14 Z', fill: 'rgba(255,255,245,.55)' }), svg('path', { d: 'M-8 -16 L-12 -6 L-7 -8 L-4 -3', fill: 'none', stroke: t, 'stroke-width': .8 })),
    svg('symbol', { id: 'w-pinheiro', overflow: 'visible' }, svg('path', { d: 'M0 -14 L7 -2 L3 -2 L9 8 L-9 8 L-3 -2 L-7 -2 Z', fill: 'rgba(48,66,36,.45)', stroke: t, 'stroke-width': 1, 'stroke-linejoin': 'round' }), svg('path', { d: 'M0 8 V13', stroke: t, 'stroke-width': 1.6 })),
    svg('symbol', { id: 'w-ruina', overflow: 'visible' }, svg('path', { d: 'M-14 12 V-6 L-10 -10 V12 M-2 12 V-12 M8 12 V-3 L14 -8 V12 M-14 -6 Q-2 -22 8 -3', fill: 'none', stroke: t, 'stroke-width': 1.4, 'stroke-linejoin': 'round' })),
    svg('symbol', { id: 'w-duna', overflow: 'visible' }, svg('path', { d: 'M-22 6 Q-10 -10 2 2 T26 6 M-12 12 Q0 4 14 12', fill: 'none', stroke: t, 'stroke-width': 1, opacity: .6 })),
    svg('symbol', { id: 'w-pocao', overflow: 'visible' }, svg('ellipse', { rx: 18, ry: 6, fill: 'rgba(80,110,100,.28)', stroke: t, 'stroke-width': .8, opacity: .8 }), svg('path', { d: 'M-8 -2 q3 -5 6 0 M2 1 q3 -5 6 0', fill: 'none', stroke: t, 'stroke-width': .8 })),
    svg('symbol', { id: 'w-rachadura', overflow: 'visible' }, svg('path', { d: 'M-18 -4 L-6 2 L-2 -8 L8 4 L14 -2 M-6 2 L-10 12 M8 4 L6 14', fill: 'none', stroke: '#4a2138', 'stroke-width': 1.4, 'stroke-linejoin': 'round', opacity: .8 })),
    svg('radialGradient', { id: 'w-vinheta', cx: '50%', cy: '50%', r: '75%' }, svg('stop', { offset: '55%', 'stop-color': '#000', 'stop-opacity': 0 }), svg('stop', { offset: '100%', 'stop-color': '#1a0f04', 'stop-opacity': 0.62 })),
    svg('radialGradient', { id: 'w-corrupcao' }, svg('stop', { offset: '0%', 'stop-color': '#6a2a8a', 'stop-opacity': 0.4 }), svg('stop', { offset: '100%', 'stop-color': '#6a2a8a', 'stop-opacity': 0 }))
  );
}

/**
 * O pergaminho do Ato: papel, rio, decoração (montanhas, árvores, ruínas...), manchas de corrupção e a moldura. Desenhado UMA vez por Ato
 * (a câmera só move o grupo); `pontos` (os nós) ficam livres de decoração. Determinístico: o mesmo Ato sempre sai igual.
 */
// O pergaminho é MAIOR que a área jogável (LARGURA × ALTURA): a tela mostra o mapa inteiro em qualquer proporção de janela sem faixa preta/madeira nas laterais.
const EXT = { x0: -600, y0: -320, x1: LARGURA + 600, y1: ALTURA + 320 };
const AREA = (EXT.x1 - EXT.x0) * (EXT.y1 - EXT.y0);

export function fundoDoAto(ato, nome, pontos = [], fundo = null) {
  const tema = temaDoAto(ato, nome);
  const rnd = aleatorio(ato * 104729 + 7);
  const g = svg('g', { class: 'w-fundo', 'aria-hidden': 'true' });
  g.append(simbolos(tema));
  g.append(svg('linearGradient', { id: `w-papel-${ato}`, x1: 0, y1: 0, x2: 1, y2: 1 }, svg('stop', { offset: '0%', 'stop-color': tema.papel[0] }), svg('stop', { offset: '100%', 'stop-color': tema.papel[1] })));
  g.append(svg('rect', { x: EXT.x0, y: EXT.y0, width: EXT.x1 - EXT.x0, height: EXT.y1 - EXT.y0, fill: `url(#w-papel-${ato})` }));
  // IMAGEM DE FUNDO do Ato (carregada na Engine › Mapa do mundo): cobre a tela do mapa (LARGURA × ALTURA, cortando o excesso) e dispensa a decoração desenhada; sem ela, o fundo de sempre.
  if (fundo?.arquivo) {
    g.append(svg('image', { href: `/gamedata/mapa-mundo/${fundo.arquivo}`, x: 0, y: 0, width: LARGURA, height: ALTURA, preserveAspectRatio: 'xMidYMid slice', class: 'w-fundo-imagem' }));
    return g;
  }
  // manchas e dobras do papel
  for (let i = 0; i < 48; i++) g.append(svg('circle', { cx: Math.round(EXT.x0 + rnd() * (EXT.x1 - EXT.x0)), cy: Math.round(EXT.y0 + rnd() * (EXT.y1 - EXT.y0)), r: 14 + Math.round(rnd() * 46), fill: rnd() > 0.5 ? 'rgba(90,60,20,.07)' : 'rgba(255,240,200,.08)' }));
  g.append(svg('path', { d: `M${LARGURA / 2} ${EXT.y0} V${EXT.y1} M${EXT.x0} ${ALTURA / 2} H${EXT.x1}`, stroke: 'rgba(60,40,15,.16)', 'stroke-width': 1.2, 'stroke-dasharray': '2 5', fill: 'none' }));
  if (tema.corrupcao) for (let i = 0; i < 6; i++) g.append(svg('circle', { cx: EXT.x0 + 150 + Math.round(rnd() * (EXT.x1 - EXT.x0 - 300)), cy: EXT.y0 + 100 + Math.round(rnd() * (EXT.y1 - EXT.y0 - 200)), r: 90 + Math.round(rnd() * 70), fill: 'url(#w-corrupcao)' }));
  if (tema.rio) {
    const y0 = 60 + Math.round(rnd() * 80);
    g.append(svg('path', { d: `M${EXT.x0} ${y0 - 60} C-300 ${y0 + 40} -100 ${y0 + 160} 220 ${y0 + 200} C360 ${y0 - 60} 400 ${y0 + 100} 560 ${y0 + 160} S860 ${y0 + 80} ${EXT.x1} ${y0 + 340}`, fill: 'none', stroke: tema.agua, 'stroke-width': 11, 'stroke-linecap': 'round', opacity: 0.55 }));
    g.append(svg('path', { d: `M${EXT.x0} ${y0 - 60} C-300 ${y0 + 40} -100 ${y0 + 160} 220 ${y0 + 200} C360 ${y0 - 60} 400 ${y0 + 100} 560 ${y0 + 160} S860 ${y0 + 80} ${EXT.x1} ${y0 + 340}`, fill: 'none', stroke: tema.tinta, 'stroke-width': 1, opacity: 0.4, 'stroke-dasharray': '1 6' }));
  }
  const livre = (x, y) => pontos.every((p) => Math.hypot(p.x - x, p.y - y) > 62);
  for (const [simbolo, qtd] of tema.decoracao) {
    const total = Math.round((qtd * AREA) / (LARGURA * ALTURA) * 0.8);
    for (let i = 0, tentativas = 0; i < total && tentativas < total * 6; tentativas++) {
      const x = EXT.x0 + 30 + rnd() * (EXT.x1 - EXT.x0 - 60);
      const y = EXT.y0 + 30 + rnd() * (EXT.y1 - EXT.y0 - 60);
      if (!livre(x, y)) continue;
      const k = 0.7 + rnd() * 0.7;
      g.append(svg('use', { href: `#w-${simbolo}`, transform: `translate(${Math.round(x)} ${Math.round(y)}) scale(${k.toFixed(2)})` }));
      i++;
    }
  }
  // símbolos arcanos nos cantos + rosa dos ventos
  const arcano = (x, y) => svg('g', { transform: `translate(${x} ${y})`, fill: 'none', stroke: tema.tinta, 'stroke-width': 1, opacity: 0.55 }, svg('circle', { r: 20 }), svg('circle', { r: 13, 'stroke-dasharray': '2 3' }), svg('path', { d: 'M0 -20 L6 8 L-17 -10 H17 L-6 8 Z' }));
  g.append(arcano(70, 70), arcano(LARGURA - 70, ALTURA - 70));
  g.append(svg('g', { transform: `translate(${LARGURA - 78} 74)`, fill: 'none', stroke: tema.tinta, 'stroke-width': 1.2, opacity: 0.7 }, svg('circle', { r: 22 }), svg('path', { d: 'M0 -30 L5 -5 L0 0 L-5 -5 Z M0 30 L5 5 L0 0 L-5 5 Z M-30 0 L-5 -5 L0 0 L-5 5 Z M30 0 L5 -5 L0 0 L5 5 Z', fill: tema.tinta, opacity: 0.55 }), svg('text', { y: -34, 'text-anchor': 'middle', fill: tema.tinta, stroke: 'none', 'font-size': 11, 'font-family': 'serif' }, 'N')));
  g.append(svg('rect', { x: EXT.x0, y: EXT.y0, width: EXT.x1 - EXT.x0, height: EXT.y1 - EXT.y0, fill: 'url(#w-vinheta)' }));
  return g;
}

// ---------------------------------------------------------------- os ícones dos nós (formas, não emoji)

const traco = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const cheio = { fill: 'currentColor', stroke: 'none' };
/** Os ícones, centrados em (0,0), cabem em ~±11. `currentColor` é a cor do estado do nó. */
export const ICONES = {
  visto: () => svg('path', { d: 'M-8 0 L-2 7 L9 -8', ...traco, 'stroke-width': 3 }),
  cadeado: () => svg('g', {}, svg('rect', { x: -7, y: -1, width: 14, height: 10, rx: 2, ...cheio }), svg('path', { d: 'M-4 -1 V-5 a4 4 0 0 1 8 0 V-1', ...traco })),
  xis: () => svg('path', { d: 'M-7 -7 L7 7 M7 -7 L-7 7', ...traco }),
  caveira: (k = 1) => svg('g', { transform: `scale(${k})` }, svg('path', { d: 'M-9 2 a9 9 0 1 1 18 0 v5 h-4 v4 h-3 v-4 h-4 v4 h-3 v-4 h-4 z', ...cheio }), svg('circle', { cx: -3.5, cy: 1, r: 2.4, fill: '#0e0d10' }), svg('circle', { cx: 3.5, cy: 1, r: 2.4, fill: '#0e0d10' })),
  quest: () => svg('g', {}, svg('path', { d: 'M0 -9 V2', ...traco, 'stroke-width': 3.2 }), svg('circle', { cy: 8, r: 2, ...cheio })),
  evento: () => svg('path', { d: 'M3 -11 L-6 2 H0 L-3 11 L7 -3 H1 Z', ...cheio }),
  secreta: () => svg('g', {}, svg('circle', { cy: -3, r: 5, ...traco }), svg('path', { d: 'M0 2 V10 M0 6 H4', ...traco })),
  cidade: () => svg('path', { d: 'M-9 9 V-1 L-5 -5 L-1 -1 V-9 L3 -12 L8 -9 V9 Z M-3 9 V4 H1 V9', ...traco, 'stroke-width': 1.8 }),
  retorno: () => svg('g', {}, svg('circle', { r: 8, ...traco }), svg('path', { d: 'M-3 0 H3 M0 -3 L3 0 L0 3', ...traco, 'stroke-width': 1.8 })),
  especial: () => svg('path', { d: 'M0 -10 L8 -2 L0 10 L-8 -2 Z M-8 -2 H8', ...traco, 'stroke-width': 1.8 }),
  desafio: () => svg('path', { d: 'M-8 -8 L8 8 M8 -8 L-8 8 M-8 -8 l3 0 M8 -8 l-3 0', ...traco }),
  estrela: (k = 1) => svg('polygon', { points: '0,-7 2,-2 7,-2 3,1.5 4.5,7 0,3.8 -4.5,7 -3,1.5 -7,-2 -2,-2', ...cheio, transform: `scale(${k})` }),
};
/** O ícone de dentro do nó de cada tipo (o `comum` mostra o número da fase, não um ícone). */
export const ICONE_DO_TIPO = { quest: 'quest', miniboss: 'caveira', 'boss-fase': 'caveira', 'boss-opcional': 'caveira', secreta: 'secreta', evento: 'evento', cidade: 'cidade', retorno: 'retorno', especial: 'especial', desafio: 'desafio', boss: 'caveira' };

/** Ícones dos botões da tela (SVG, sem depender de glifo da fonte): fechar, aproximar, afastar, centrar, ver tudo, cadeado, visto. */
export function iconeDeBotao(nome) {
  const t = { fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const formas = {
    fechar: [svg('path', { d: 'M6 6 L18 18 M18 6 L6 18', ...t })],
    mais: [svg('path', { d: 'M12 5 V19 M5 12 H19', ...t })],
    menos: [svg('path', { d: 'M5 12 H19', ...t })],
    centrar: [svg('circle', { cx: 12, cy: 12, r: 4, ...t }), svg('path', { d: 'M12 2 V6 M12 18 V22 M2 12 H6 M18 12 H22', ...t })],
    tudo: [svg('path', { d: 'M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15', ...t })],
    cadeado: [svg('rect', { x: 6, y: 11, width: 12, height: 9, rx: 2, ...t }), svg('path', { d: 'M9 11 V8 a3 3 0 0 1 6 0 V11', ...t })],
    visto: [svg('path', { d: 'M5 12.5 L10 17.5 L19 7', ...t })],
  };
  return svg('svg', { class: 'w2-ico', viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': 'true' }, formas[nome]);
}

/** O ornamento do cabeçalho: um filete com losango (dois lados espelhados). */
export function ornamentoDoCabecalho(espelho = false) {
  return svg('svg', { class: `w2-ornamento${espelho ? ' espelho' : ''}`, viewBox: '0 0 200 24', 'aria-hidden': 'true', preserveAspectRatio: 'xMaxYMid meet' },
    svg('path', { d: 'M0 12 H150 M150 12 q10 -10 20 0 q-10 10 -20 0 M174 12 H198', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
    svg('path', { d: 'M100 6 L106 12 L100 18 L94 12 Z', fill: 'currentColor' }),
    svg('circle', { cx: 196, cy: 12, r: 2.2, fill: 'currentColor' }));
}
