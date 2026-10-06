// A ARENA DE GEMAS (o simulador do dono, da coleção do Drive) desenhada com os SPRITES DO JOGO (dono, 06/10: "na arena de gemas queria
// colocar o sprite e mantenha AGORA"). A engine serve a arena com dois ganchos (`admin/gemas-poe.mjs`, sem mexer nos arquivos dela): o
// mundo em `window.__arenaMundo` e o desenho dela chamando `window.__desenharComSprites(r, m, ui)` antes do próprio — que desenha tudo
// aqui e devolve true (com a chave "Sprites do jogo" ligada).
//   - o personagem e os mobs: os bonecos do jogo (o mob pelo nome, a mesma regra da campanha do PoE — `/api/jogo/poe/desenhos-dos-mobs`);
//   - os efeitos dela (projétil, explosão, anel, golpe, raio, zonas...): os sprites do VISUAL "AGORA" da gema escolhida (estilo da gema +
//     o que foi editado na Arena de Efeitos — `/api/jogo/efeitos`); efeito de outro elemento, o do preset de fábrica do elemento.
import { loadSpriteData, loadEffectData, drawCreature, drawEffect, drawMissile, effectDuration } from './sprites.mjs';
import { carregarVisuais, visuaisAtuais, desenharQuadroDeAsset } from './efeitos-visuais.mjs';

const TILE = 32;
const ELEMENTO_DA_COR = { '#d9c7a3': 'fisico', '#ff7a2e': 'fogo', '#7fd8ff': 'gelo', '#ffe95c': 'raio', '#c06bff': 'caos' };
const PRESET_DO_ELEMENTO = { fisico: 'fabrica:fisico', fogo: 'fabrica:fogo', gelo: 'fabrica:gelo', raio: 'fabrica:raio', caos: 'fabrica:caos' };
const ELEMENTO_DO_JOGO = { physical: 'fisico', fire: 'fogo', ice: 'gelo', energy: 'raio', chaos: 'caos', death: 'caos', earth: 'caos' };
const JOGADOR = { look: 130, colors: { head: 78, body: 88, legs: 58, feet: 76 } };

let pronto = false;
let ligado = true;
let desenhos = {};
let elementoDaGema = {}; // slug → elemento (da lista da própria arena: window.GEMAS / STATUS)
(async () => {
  await Promise.all([loadSpriteData().catch(() => {}), loadEffectData().catch(() => {}), carregarVisuais()]);
  desenhos = await fetch('/api/jogo/poe/desenhos-dos-mobs').then((r) => r.json()).catch(() => ({}));
  for (const [slug, s] of Object.entries(window.STATUS ?? {})) if (s?.elemento) elementoDaGema[slug] = s.elemento;
  pronto = true;
})();

// A chave "Sprites do jogo" na barra da arena (ligada de fábrica).
function chave() {
  const barra = document.querySelector('.ctrl.toggles');
  if (!barra || document.getElementById('c-sprites-jogo')) return;
  const rotulo = document.createElement('label');
  rotulo.title = 'Desenha o personagem, os mobs e os efeitos com os sprites do jogo e o visual AGORA (Arena de Efeitos)';
  rotulo.innerHTML = '<input type="checkbox" id="c-sprites-jogo" checked> Sprites do jogo';
  rotulo.querySelector('input').addEventListener('change', (e) => { ligado = e.target.checked; });
  barra.prepend(rotulo);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', chave);
else chave();

const gemaEscolhida = () => document.querySelector('#lista-gemas li.sel')?.dataset.slug ?? null;
/** O visual de um efeito: o da gema escolhida (AGORA) se o efeito é do elemento dela; senão o do elemento (preset de fábrica). */
function visualDoEfeito(cor) {
  const V = visuaisAtuais();
  const slug = gemaEscolhida();
  const el = ELEMENTO_DA_COR[String(cor ?? '').toLowerCase()] ?? null;
  const daGema = slug ? V.skills?.[`poe-gema:${slug}`] : null;
  if (daGema && (!el || el === elementoDaGema[slug] || !elementoDaGema[slug])) return daGema;
  return V.presets?.[PRESET_DO_ELEMENTO[el ?? 'fisico']]?.visual ?? {};
}

/** Um sprite (efeito, projétil ou asset) CENTRADO em (x, y), com escala; `pr` = o progresso da animação (0..1). */
function sprite(ctx, s, x, y, escala, pr, dx = 1, dy = 0) {
  if (!s || s.tipo === 'nenhum') return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(escala, escala);
  if (s.tipo === 'efeito') drawEffect(ctx, s.id, -TILE / 2, -TILE / 2, pr);
  else if (s.tipo === 'projetil') drawMissile(ctx, s.id, 0, 0, dx, dy);
  else if (s.tipo === 'asset') { const a = visuaisAtuais().assets?.[s.id]; if (a) desenharQuadroDeAsset(ctx, a, pr, 0, 0); }
  ctx.restore();
}
const progresso = (e, m) => (e.dur && e.dur !== Infinity ? Math.min(0.999, e.idade / e.dur) : ((m.tempo ?? 0) % 1));

window.__desenharComSprites = (r, m) => {
  if (!ligado || !pronto) return false;
  const { ctx, esc } = r;
  const W = r.canvas.clientWidth;
  const H = r.canvas.clientHeight;
  const P = (v) => v * esc;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0d0c0b';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(r.ox, r.oy);
  // O chão: lajotas de 1 metro (a casa do jogo).
  const larg = Math.ceil(W / esc);
  const alt = Math.ceil(H / esc);
  for (let y = 0; y < alt; y++) for (let x = 0; x < larg; x++) { ctx.fillStyle = (x + y) % 2 ? '#1b2326' : '#1f2a2e'; ctx.fillRect(P(x), P(y), esc + 0.5, esc + 0.5); }
  const k = (esc * 1.8) / TILE; // o boneco do jogo (32 px) do tamanho de ~1,8 m (a arena é larga)

  // Efeitos de chão (zonas, auras, marcas): a ÁREA do visual, em loop, do tamanho do raio.
  for (const e of m.efeitos) {
    if (!['zona', 'aura', 'marcador', 'rachadura', 'marca', 'sigilo', 'armadilha', 'mina'].includes(e.tipo)) continue;
    const v = visualDoEfeito(e.cor);
    const s = v.area?.sprite ?? v.impacto?.sprite;
    const tam = Math.max(k, (P(e.r ?? 1) * 2) / (TILE * 1.4));
    ctx.globalAlpha = e.tipo === 'aura' ? 0.45 : 0.8;
    sprite(ctx, s, P(e.x), P(e.y), tam, progresso(e, m));
    ctx.globalAlpha = 1;
  }

  // Os bonecos (de cima para baixo), com a vida.
  for (const e of m.entidades.slice().sort((a, b) => a.y - b.y)) {
    const x = P(e.x);
    const y = P(e.y);
    const d = e.tipo === 'jogador' ? JOGADOR : desenhos[e.nome] ?? null;
    ctx.globalAlpha = e.morto ? 0.35 : 1;
    if (d) {
      ctx.save();
      ctx.translate(x - (TILE * k) / 2, y - TILE * k * 0.85);
      ctx.scale(k, k);
      const dir = Math.abs(e.vx ?? 0) > Math.abs(e.vy ?? 0) ? ((e.vx ?? 0) > 0 ? 1 : 3) : (e.vy ?? 0) < 0 ? 0 : 2;
      drawCreature(ctx, { look: d.look, colors: d.colors, dir, frame: Math.floor((m.tempo ?? 0) * 6) % 2, walking: Math.hypot(e.vx ?? 0, e.vy ?? 0) > 0.1 }, 0, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = e.time === 'inimigo' ? '#c0392b' : '#e0b85a';
      ctx.beginPath();
      ctx.arc(x, y, P(e.raio ?? 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    if (!e.morto && e.vidaMax) {
      const w = TILE * k * 0.9;
      ctx.fillStyle = '#000';
      ctx.fillRect(x - w / 2, y - TILE * k - 6, w, 4);
      ctx.fillStyle = e.time === 'inimigo' ? '#d23b2b' : '#3fbf3f';
      ctx.fillRect(x - w / 2 + 1, y - TILE * k - 5, (w - 2) * Math.max(0, e.vida / e.vidaMax), 2);
    }
    ctx.globalAlpha = 1;
  }

  // Efeitos no ar: os do visual AGORA.
  for (const e of m.efeitos) {
    const v = visualDoEfeito(e.cor);
    const pr = progresso(e, m);
    switch (e.tipo) {
      case 'projetil': {
        const s = v.projetil?.sprite ?? (e.estilo === 'flecha' ? { tipo: 'projetil', id: 3 } : null);
        sprite(ctx, s, P(e.x), P(e.y), k * (v.projetil?.escala ?? 1), pr, e.vx ?? 1, e.vy ?? 0);
        break;
      }
      case 'orbe':
        sprite(ctx, v.projetil?.sprite, P(e.x), P(e.y), k * 1.4, pr, 1, 0);
        break;
      case 'queda': {
        const h = (1 - pr) * 6;
        sprite(ctx, v.projetil?.sprite, P(e.x + h * 0.3), P(e.y - h), k, pr, 0, 1);
        break;
      }
      case 'explosao':
      case 'anel':
        sprite(ctx, v.area?.sprite ?? v.impacto?.sprite, P(e.x), P(e.y), Math.max(k, (P(e.r ?? e.r1 ?? 1) * 2) / (TILE * 1.4)), pr);
        break;
      case 'golpe':
      case 'cone': {
        const a = e.ang ?? 0;
        sprite(ctx, v.impacto?.sprite, P(e.x + Math.cos(a) * (e.r ?? 1) * 0.6), P(e.y + Math.sin(a) * (e.r ?? 1) * 0.6), k * 1.2, pr);
        break;
      }
      case 'raio':
        // A cadeia: o impacto em cada ponto depois do primeiro (o Arco saltando de um mob para o outro).
        for (const p of (e.pts ?? []).slice(1)) sprite(ctx, v.impacto?.sprite, P(p.x), P(p.y), k, pr);
        break;
      default:
        break;
    }
  }

  // Os números (os textos da arena), como ela desenha.
  for (const t of m.textos) {
    const a = 1 - t.idade / t.vida;
    ctx.font = `bold ${t.tamanho}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(0,0,0,${a * 0.8})`;
    ctx.fillText(t.texto, P(t.x) + 1, P(t.y) + 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = t.cor ?? '#fff';
    ctx.fillText(t.texto, P(t.x), P(t.y));
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  return true;
};
