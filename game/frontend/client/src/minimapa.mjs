/*
 * ---- O MINIMAPA, por cima do mapa (à Path of Exile) ----
 *
 * Uma camada pequena e semitransparente no canto superior direito da ÁREA DE JOGO (o canvas do
 * mapa): não é painel, não empurra nada, não mexe na câmera. Mostra a FASE INTEIRA — não só o que
 * a câmera vê — com a geometria real que o servidor já manda (`map.floors[z].blocked/stacks`:
 * chão, parede e vazio, casa a casa) e os pontos nas coordenadas reais do retrato do mapa
 * (`MapView.snapshot`): monstros vivos em vermelho (os de raridade em laranja), o boss maior e
 * dourado, os companheiros de party em verde e o jogador em azul.
 *
 * Desempenho: o fundo (a geometria) vira uma imagem UMA vez por fase e andar — `chaveDaBase`; a
 * cada retrato só se copia essa imagem e se pintam os pontos, no máximo uma vez por quadro
 * (`requestAnimationFrame`). Não toca nos eventos do jogo: a camada não recebe toque nenhum, só o
 * botão de recolher/expandir.
 *
 * `ehTelefone` vem de quem inicia (main.mjs): sem importar o perfil aqui, as contas puras deste
 * módulo (geometria, escala, pontos) rodam nos testes sem navegador.
 */

const LADO_NO_COMPUTADOR = 176;
const LADO_NO_CELULAR = 112;
const MARGEM = 8;
const CORES = {
  chao: [52, 66, 60, 235],
  parede: [128, 128, 122, 235],
  monstro: '#ff3b30',
  raro: '#ff9f1a',
  boss: '#ffd34d',
  aliado: '#4ade80',
  jogador: '#3fa2ff',
};

let mapViewRef = null;
let ehTelefone = () => false;
let raiz = null;
let lona = null;
let botao = null;
let base = null; // a geometria da fase, 1 pixel por casa
let chaveDaBase = null;
let agendado = false;
let ativo = false;
let recolhido = false;
try {
  recolhido = localStorage.getItem('draevor:minimapa') === 'recolhido';
} catch {
  /* sem storage: começa aberto */
}

const dpr = () => Math.min(2, window.devicePixelRatio || 1);
const lado = () => (ehTelefone() ? LADO_NO_CELULAR : LADO_NO_COMPUTADOR);

/** Cria a camada (uma vez). */
export function initMinimapa(mapView, opcoes = {}) {
  mapViewRef = mapView;
  if (opcoes.ehTelefone) ehTelefone = opcoes.ehTelefone;
  raiz = document.createElement('div');
  raiz.id = 'minimapa';
  raiz.hidden = true;
  lona = document.createElement('canvas');
  lona.className = 'minimapa-lona';
  botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'minimapa-botao';
  botao.addEventListener('click', (evento) => {
    evento.preventDefault();
    evento.stopPropagation();
    recolhido = !recolhido;
    try {
      localStorage.setItem('draevor:minimapa', recolhido ? 'recolhido' : 'aberto');
    } catch {
      /* sem storage: vale só nesta aba */
    }
    agendar();
  });
  raiz.append(lona, botao);
  document.body.append(raiz);
  window.addEventListener('resize', agendar);
}

/**
 * Chamado a cada retrato do mapa (`setSnapshot`): `naCacada` — o minimapa só existe na fase.
 * Barato: só agenda um desenho para o próximo quadro.
 */
export function atualizarMinimapa(naCacada) {
  ativo = !!naCacada;
  agendar();
}

function agendar() {
  if (agendado || !raiz) return;
  agendado = true;
  requestAnimationFrame(() => {
    agendado = false;
    desenhar();
  });
}

/** A geometria do andar: chão, parede e vazio, uma casa por pixel. */
export function montarBase(map, z) {
  const andar = map.floors?.[z];
  const bloqueado = andar?.blocked ?? map.blocked ?? [];
  const pilhas = andar?.stacks ?? map.stacks ?? [];
  const { width, height } = map;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const temChao = Array.isArray(pilhas[i]) ? pilhas[i].length > 0 : !!pilhas[i];
    if (!temChao) continue; // vazio: transparente
    const cor = bloqueado[i] ? CORES.parede : CORES.chao;
    pixels.set(cor, i * 4);
  }
  return { width, height, pixels };
}

/** Onde cada ponto cai na lona (coordenada da casa → pixel), com a fase inteira encaixada no quadrado. */
export function escala(map, ladoPx) {
  const s = Math.min(ladoPx / map.width, ladoPx / map.height);
  return { s, ox: (ladoPx - map.width * s) / 2, oy: (ladoPx - map.height * s) / 2 };
}

/** Os pontos do retrato: `{x, y, tipo}` — só quem está VIVO, nas coordenadas reais. */
export function pontosDoRetrato(snap) {
  const pontos = [];
  const bossUid = snap.boss?.uid ?? null;
  for (const m of snap.monsters ?? []) {
    if (!(m.hp > 0) || !Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;
    const tipo = snap.isBoss || m.uid === bossUid ? 'boss' : m.raridade && m.raridade !== 'normal' ? 'raro' : 'monstro';
    pontos.push({ x: m.x, y: m.y, tipo });
  }
  for (const a of snap.aliados ?? []) if (Number.isFinite(a.x)) pontos.push({ x: a.x, y: a.y, tipo: 'aliado' });
  if (snap.player && Number.isFinite(snap.player.x)) pontos.push({ x: snap.player.x, y: snap.player.y, tipo: 'jogador' });
  return pontos;
}

function posicionar() {
  const r = mapViewRef.canvas.getBoundingClientRect();
  const raizCss = getComputedStyle(document.documentElement);
  const topbar = parseFloat(raizCss.getPropertyValue('--altura-da-topbar')) || 0;
  const faixa = document.getElementById('aviso-dev');
  const aviso = faixa && !faixa.hidden ? faixa.getBoundingClientRect().bottom : 0;
  const topo = Math.max(r.top, topbar, aviso) + MARGEM;
  const direita = Math.max(0, window.innerWidth - Math.min(r.right, window.innerWidth)) + MARGEM;
  raiz.style.top = `${Math.round(topo)}px`;
  raiz.style.right = `${Math.round(direita)}px`;
}

function desenhar() {
  const snap = mapViewRef?.snapshot;
  if (!ativo || !snap?.map?.width) {
    raiz.hidden = true;
    return;
  }
  raiz.hidden = false;
  raiz.classList.toggle('recolhido', recolhido);
  botao.textContent = recolhido ? '🗺' : '–';
  botao.title = recolhido ? 'Mostrar o minimapa' : 'Recolher o minimapa';
  botao.setAttribute('aria-label', botao.title);
  posicionar();
  if (recolhido) return;

  const map = snap.map;
  const z = snap.z ?? map.z ?? 0;
  const chave = `${mapViewRef.mapId}|${z}|${map.width}x${map.height}`;
  if (chave !== chaveDaBase) {
    const b = montarBase(map, z);
    base = document.createElement('canvas');
    base.width = b.width;
    base.height = b.height;
    base.getContext('2d').putImageData(new ImageData(b.pixels, b.width, b.height), 0, 0);
    chaveDaBase = chave;
  }

  const ladoCss = lado();
  const k = dpr();
  const ladoPx = Math.round(ladoCss * k);
  if (lona.width !== ladoPx) {
    lona.width = ladoPx;
    lona.height = ladoPx;
  }
  lona.style.width = `${ladoCss}px`;
  lona.style.height = `${ladoCss}px`;
  const ctx = lona.getContext('2d');
  ctx.clearRect(0, 0, ladoPx, ladoPx);
  ctx.imageSmoothingEnabled = false;
  const { s, ox, oy } = escala(map, ladoPx);
  ctx.drawImage(base, ox, oy, map.width * s, map.height * s);

  const raio = { monstro: 1.6, raro: 2.2, boss: 3.4, aliado: 2.2, jogador: 2.8 };
  for (const p of pontosDoRetrato(snap)) {
    const x = ox + (p.x + 0.5) * s;
    const y = oy + (p.y + 0.5) * s;
    const r = raio[p.tipo] * k;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = CORES[p.tipo];
    ctx.fill();
    if (p.tipo === 'jogador' || p.tipo === 'boss') {
      ctx.lineWidth = Math.max(1, k);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
  }
}
