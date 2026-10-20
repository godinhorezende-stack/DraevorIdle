// (lote A3b, dono 19/10: D13) Os OBJETOS das gemas do PoE no chão ou no tempo, na tela: o que o servidor manda no retrato da caçada (`snapshot.poeObjetos` e,
// dos aliados da sala, `snapshot.poeObjetosDoGrupo` — `Acoes.objetosParaCliente`: `{ id, t, x, y, r, ate, el, n, segue }`; `ate` no relógio da caçada,
// `segue` o uid do boneco que ele acompanha) desenhado no mapa com formas e cores, no estilo das Safe Zones (`map.mjs`
// `drawZonasSeguras`): o véu e a borda nas casas do raio, e a figura no centro. Nenhuma imagem nova.
//   bola       — a Bola Relampejante: o globo que pulsa (a cor do elemento) e o raio dos golpes;
//   tornado    — o Tornado: o redemoinho (elipses girando) e o raio;
//   lamina     — a Lâmina Persistente: a lâmina cravada no chão;
//   marcador   — o Disparo Congelante parado: o losango de gelo;
//   olho       — o Olho Invernal: o olho que voa;
//   chao       — o Vórtice e a Geada Rastejante: o chão gelado (o véu nas casas do raio);
//   capturados — os projéteis da Espiral Venenosa em volta de você: as pontinhas girando, com o número;
//   esfera     — a Esfera do Vazio (A3b-2): o globo escuro e o raio;
//   tempestade — a Tormenta Flamejante (A3b-2): a área onde as bolas caem, em brasa;
//   vortice    — o Vórtice de Lâminas (A3b-2): as lâminas girando no raio, uma por lâmina ativa.

const COR_DO_ELEMENTO = { fire: '#ff7a2f', ice: '#8fd8ff', energy: '#c8a6ff', chaos: '#7ee07e', physical: '#d8d0c0', holy: '#ffe08a' };
const corDe = (o, padrao) => COR_DO_ELEMENTO[o?.el] ?? padrao;

/** Os tipos que o servidor manda (`Acoes.objetosParaCliente`). */
export const TIPOS = Object.freeze(['bola', 'tornado', 'lamina', 'marcador', 'olho', 'chao', 'capturados', 'esfera', 'tempestade', 'vortice']);
/** O ESTILO de cada tipo: a cor da figura, a do véu do raio (ou null), a forma. */
export function estiloDoObjeto(o) {
  switch (o?.t) {
    case 'bola': return { forma: 'globo', cor: corDe(o, '#c8a6ff'), veu: 'rgba(200,166,255,0.10)', borda: 'rgba(200,166,255,0.45)' };
    case 'tornado': return { forma: 'redemoinho', cor: corDe(o, '#d8d0c0'), veu: 'rgba(216,208,192,0.10)', borda: 'rgba(216,208,192,0.45)' };
    case 'lamina': return { forma: 'lamina', cor: '#cfd6e0', veu: null, borda: null };
    case 'marcador': return { forma: 'losango', cor: '#8fd8ff', veu: null, borda: null };
    case 'olho': return { forma: 'olho', cor: '#bfeaff', veu: null, borda: null };
    case 'chao': return { forma: 'chao', cor: corDe(o, '#8fd8ff'), veu: 'rgba(143,216,255,0.16)', borda: 'rgba(170,225,255,0.55)' };
    case 'capturados': return { forma: 'pontas', cor: '#7ee07e', veu: null, borda: null };
    case 'esfera': return { forma: 'globo', cor: '#5b3a7a', veu: 'rgba(91,58,122,0.14)', borda: 'rgba(150,110,190,0.5)' };
    case 'tempestade': return { forma: 'chao', cor: '#ff7a2f', veu: 'rgba(255,122,47,0.10)', borda: 'rgba(255,150,80,0.45)' };
    case 'vortice': return { forma: 'laminas', cor: '#cfd6e0', veu: 'rgba(207,214,224,0.06)', borda: null };
    default: return null;
  }
}

/** O véu e a borda das casas a até `r` casas (o quadrado — a mesma conta do servidor) em volta de (cx, cy), em pixels de tela. */
function desenharRaio(ctx, px, py, r, tile, veu, borda) {
  if (!(r > 0) || !veu) return;
  const lado = (2 * r + 1) * tile;
  ctx.fillStyle = veu;
  ctx.fillRect(px - r * tile, py - r * tile, lado, lado);
  if (borda) {
    ctx.strokeStyle = borda;
    ctx.lineWidth = 1;
    ctx.strokeRect(px - r * tile + 0.5, py - r * tile + 0.5, lado - 1, lado - 1);
  }
}

/**
 * Desenha os objetos (`objetos`, do retrato) no contexto do mapa: `camX`/`camY` a câmera em pixels, `tile` o tamanho da casa, `agora` o relógio da tela (a
 * animação), `relogio` o da caçada (o que falta: `ate − relogio`; o que falta pouco, menos de meio segundo, some aos poucos), `posDe(uid)` a posição andando
 * (em pixels do mundo, o canto da casa) do boneco que o objeto acompanha — o vórtice e os capturados vão com ele, não pulam de casa em casa.
 */
export function desenharObjetosDoPoe(ctx, objetos, { camX = 0, camY = 0, tile = 32, agora = 0, relogio = null, posDe = null } = {}) {
  if (!ctx || !objetos?.length) return;
  ctx.save();
  for (const o of objetos) {
    const e = estiloDoObjeto(o);
    if (!e) continue;
    const dono = o.segue && posDe ? posDe(o.segue) : null;
    const px = (dono ? dono.x : o.x * tile) - camX;
    const py = (dono ? dono.y : o.y * tile) - camY;
    const cx = px + tile / 2;
    const cy = py + tile / 2;
    const falta = o.ate > 0 && relogio != null ? o.ate - relogio : Infinity;
    const alfa = falta < 500 ? Math.max(0.2, falta / 500) : 1;
    ctx.globalAlpha = alfa;
    desenharRaio(ctx, px, py, o.r, tile, e.veu, e.borda);
    const fase = (agora % 1000) / 1000;
    ctx.fillStyle = e.cor;
    ctx.strokeStyle = e.cor;
    ctx.lineWidth = 2;
    if (e.forma === 'globo') {
      const raio = tile * (0.22 + 0.05 * Math.sin(fase * 2 * Math.PI));
      ctx.beginPath();
      ctx.arc(cx, cy, raio, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, raio * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (e.forma === 'redemoinho') {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy - i * tile * 0.12, tile * (0.18 + 0.08 * i), tile * (0.07 + 0.03 * i), fase * 2 * Math.PI + i, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (e.forma === 'lamina') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - tile * 0.3);
      ctx.lineTo(cx + tile * 0.06, cy + tile * 0.1);
      ctx.lineTo(cx - tile * 0.06, cy + tile * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(cx - tile * 0.12, cy + tile * 0.1, tile * 0.24, tile * 0.05);
    } else if (e.forma === 'losango') {
      ctx.beginPath();
      ctx.moveTo(cx, cy - tile * 0.2);
      ctx.lineTo(cx + tile * 0.14, cy);
      ctx.lineTo(cx, cy + tile * 0.2);
      ctx.lineTo(cx - tile * 0.14, cy);
      ctx.closePath();
      ctx.fill();
    } else if (e.forma === 'olho') {
      ctx.beginPath();
      ctx.ellipse(cx, cy, tile * 0.24, tile * 0.13, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.07, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.forma === 'chao') {
      // (o chão é o véu do raio — acima; no centro, um floco)
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(a) * tile * 0.16, cy - Math.sin(a) * tile * 0.16);
        ctx.lineTo(cx + Math.cos(a) * tile * 0.16, cy + Math.sin(a) * tile * 0.16);
        ctx.stroke();
      }
    } else if (e.forma === 'laminas') {
      // (o Vórtice: cada lâmina ativa gira em volta do centro, na borda do raio)
      const n = Math.max(1, Math.min(10, o.n ?? 1));
      const raio = Math.max(0.6, o.r || 1) * tile;
      for (let i = 0; i < n; i++) {
        const a = fase * 2 * Math.PI * 1.5 + (2 * Math.PI * i) / n;
        const bx = cx + Math.cos(a) * raio;
        const by = cy + Math.sin(a) * raio;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(a + Math.PI / 2) * tile * 0.25, by + Math.sin(a + Math.PI / 2) * tile * 0.25);
        ctx.stroke();
      }
    } else if (e.forma === 'pontas') {
      const n = Math.max(1, Math.min(12, o.n ?? 1));
      for (let i = 0; i < n; i++) {
        const a = fase * 2 * Math.PI + (2 * Math.PI * i) / n;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * tile * 0.45, cy + Math.sin(a) * tile * 0.45, tile * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
      if ((o.n ?? 0) > 1) {
        ctx.font = `600 ${Math.round(tile * 0.32)}px Verdana, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(String(o.n), cx, cy - tile * 0.55);
      }
    }
  }
  ctx.restore();
}
