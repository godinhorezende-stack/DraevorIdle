// A CAMADA DE EFEITOS do combate (dono, 06/10: "Arena de Efeitos" — o que o administrador vê na arena é o que o jogador vê no combate).
// UM módulo só, usado pelo mapa do jogo (`map.mjs`) e pela Arena de Efeitos da engine: transforma os EVENTOS do combate (os mesmos que o
// servidor manda: `skill`/`cast`, `shot`, `fx`, `explosao`/`area`, `dmg`) em instâncias de desenho e as desenha.
//
// Sem visual configurado para a skill o desenho é EXATAMENTE o de sempre (o efeito do evento, o projétil a 60 ms por casa). Com visual
// (`systems/efeitos-visuais.mjs` → `/api/jogo/efeitos`), cada PARTE responde ao seu evento:
//   lancamento (SKILL_CAST, no personagem), projetil (PROJECTILE_CREATED), impacto (PROJECTILE_HIT), area (AREA_CREATED, cada casa),
//   alvo (DAMAGE_APPLIED, preso ao bicho atingido)
// com sprite (efeito, projétil ou spritesheet da biblioteca), escala, rotação, opacidade, deslocamento, atraso, duração, loop, espelhar,
// âncora, velocidade e rastro do projétil. O gameplay (dano, alcance, área) não muda: só o desenho.
import { drawEffect, drawMissile, effectDuration, image } from './sprites.mjs';
import { casasDoEvento } from '/packages/shared/src/areas.mjs';

const TILE = 32;
const VELOCIDADE_PADRAO = 60; // ms por casa — a do client (o projétil segue a distância)

let DADOS = { assets: {}, presets: {}, skills: {} };
/** O visual que vale no jogo (o servidor manda em `/api/jogo/efeitos`). */
export const visuaisAtuais = () => DADOS;
export function definirVisuais(d) {
  DADOS = { assets: d?.assets ?? {}, presets: d?.presets ?? {}, skills: d?.skills ?? {} };
}
export async function carregarVisuais() {
  try {
    const r = await fetch('/api/jogo/efeitos', { cache: 'no-cache' });
    if (r.ok) definirVisuais(await r.json());
  } catch {
    /* sem rede: fica o desenho de sempre */
  }
}

const ANCORA = { acima: -20, corpo: 0, pes: 10 };
const semTransformacao = (p) => !p || ((p.escala ?? 1) === 1 && !(p.rotacao ?? 0) && (p.opacidade ?? 1) === 1 && !p.dx && !p.dy && !p.flipX && !p.flipY && !p.ancora);
const distancia = (a, b) => Math.max(Math.abs((b?.x ?? 0) - (a?.x ?? 0)), Math.abs((b?.y ?? 0) - (a?.y ?? 0)));

// ---------------------------------------------------------------- spritesheets da biblioteca

/** Os quadros de um asset na ordem de tocar (início..fim, ao contrário, ida e volta). */
function sequencia(a) {
  const ini = Math.max(0, a.inicio ?? 0);
  const fim = Math.max(ini, a.fim ?? (a.colunas ?? 1) * (a.linhas ?? 1) - 1);
  let q = [];
  for (let i = ini; i <= fim; i++) q.push(i);
  if (a.reverso) q.reverse();
  if (a.pingpong && q.length > 2) q = q.concat(q.slice(1, -1).reverse());
  return q;
}
/** A duração natural de um asset (ms): os quadros ÷ fps. */
export const duracaoDoAsset = (a) => (sequencia(a).length / Math.max(1, a.fps ?? 12)) * 1000;
/** Desenha o quadro de um asset CENTRADO em (0, 0) (o contexto já está transladado). */
function desenharAsset(ctx, a, progresso) {
  const img = image(a.url);
  if (!img.ready) return false;
  const q = sequencia(a);
  const quadro = q[Math.min(q.length - 1, Math.max(0, Math.floor(progresso * q.length)))] ?? 0;
  const cols = Math.max(1, a.colunas ?? 1);
  const fw = img.image.width / cols;
  const fh = img.image.height / Math.max(1, a.linhas ?? 1);
  ctx.drawImage(img.image, (quadro % cols) * fw, Math.floor(quadro / cols) * fh, fw, fh, -fw / 2, -fh / 2, fw, fh);
  return true;
}

/** A duração natural de um sprite (efeito: a animação do client; asset: quadros ÷ fps; projétil usado como efeito: 600 ms). */
export function duracaoNatural(sprite, visuais = DADOS) {
  if (!sprite) return 600;
  if (sprite.tipo === 'efeito') return effectDuration(sprite.id) || 600;
  if (sprite.tipo === 'asset') return visuais.assets?.[sprite.id] ? duracaoDoAsset(visuais.assets[sprite.id]) : 600;
  return 600;
}

// ---------------------------------------------------------------- eventos → instâncias

/**
 * Uma camada de efeitos: guarda as instâncias e o que precisa entre eventos da mesma skill (a posição do lançador e o tempo de voo, para
 * o impacto "ao chegar o projétil"). `receber(evento, agora, { visuais, uidDe })` → `{ efeitos: [], projeteis: [] }` (novas instâncias).
 */
export function criarCamada() {
  const memo = new Map(); // sk → { x, y, voo }
  function efeito({ sprite, uid = null, x, y, agora, parte, visuais, atrasoExtra = 0, rotulo }) {
    if (!sprite || sprite.tipo === 'nenhum') return null;
    const natural = duracaoNatural(sprite, visuais);
    const vida = parte?.duracao > 0 ? parte.duracao : natural;
    return {
      sprite, uid, x, y, born: agora + (parte?.atraso ?? 0) + atrasoExtra, life: Math.max(40, vida), natural, loop: !!parte?.loop, parte: parte ?? null, rotulo,
      asset: sprite.tipo === 'asset' ? visuais.assets?.[sprite.id] ?? null : null,
    };
  }
  function receber(ev, agora, { visuais = DADOS, uidDe = (e) => e.uid } = {}) {
    const saida = { efeitos: [], projeteis: [] };
    const v = ev.sk ? visuais.skills?.[ev.sk] ?? null : null;
    const m = ev.sk ? memo.get(ev.sk) ?? {} : {};
    const vooAte = (alvo) => (m.x != null ? distancia(m, alvo) * (v?.projetil?.velocidade ?? VELOCIDADE_PADRAO) : m.voo ?? 0);
    if (ev.t === 'skill' || ev.t === 'cast') {
      if (ev.sk) memo.set(ev.sk, { x: ev.x, y: ev.y, voo: 0 });
      if (v?.lancamento && !ev.semLancamento) {
        const i = efeito({ sprite: v.lancamento.sprite, uid: uidDe(ev), x: ev.x, y: ev.y, agora, parte: v.lancamento, visuais, rotulo: 'lancamento' });
        if (i) saida.efeitos.push(i);
      }
    } else if (ev.t === 'shot') {
      const p = v?.projetil;
      const sprite = p?.sprite ?? { tipo: 'projetil', id: ev.id };
      const dist = Math.max(Math.abs(ev.tx - ev.x), Math.abs(ev.ty - ev.y));
      const vida = Math.max(80, dist * (p?.velocidade ?? VELOCIDADE_PADRAO));
      if (ev.sk) memo.set(ev.sk, { ...m, voo: Math.max(m.voo ?? 0, vida) });
      if (sprite.tipo !== 'nenhum') {
        saida.projeteis.push({ sprite, x: ev.x, y: ev.y, tx: ev.tx, ty: ev.ty, born: agora + (p?.atraso ?? 0), life: vida, parte: p ?? null, asset: sprite.tipo === 'asset' ? visuais.assets?.[sprite.id] ?? null : null, rotulo: 'projetil' });
      }
    } else if (ev.t === 'fx') {
      const p = v?.impacto;
      // O `uid` do próprio evento (o bicho atingido), como sempre foi: o efeito segue o boneco.
      const i = efeito({ sprite: p?.sprite ?? { tipo: 'efeito', id: ev.id }, uid: ev.uid, x: ev.x, y: ev.y, agora, parte: p, visuais, atrasoExtra: p?.noImpacto ? vooAte(ev) : 0, rotulo: 'impacto' });
      if (i) saida.efeitos.push(i);
    } else if (ev.t === 'explosao' || ev.t === 'area') {
      const p = v?.area;
      // A área: as casas que de fato pegaram (o servidor manda UM evento; a mesma geometria do combate).
      for (const c of casasDoEvento(ev)) {
        const i = efeito({ sprite: p?.sprite ?? { tipo: 'efeito', id: ev.id }, x: c.x, y: c.y, agora, parte: p, visuais, atrasoExtra: p?.noImpacto ? vooAte(c) : 0, rotulo: 'area' });
        if (i) saida.efeitos.push(i);
      }
    } else if (ev.t === 'dmg' && ev.foe && v?.alvo) {
      const i = efeito({ sprite: v.alvo.sprite, uid: ev.uid, x: ev.x, y: ev.y, agora, parte: v.alvo, visuais, atrasoExtra: v.alvo.noImpacto ? vooAte(ev) : 0, rotulo: 'alvo' });
      if (i) saida.efeitos.push(i);
    }
    return saida;
  }
  return { receber, esquecer: () => memo.clear() };
}

// ---------------------------------------------------------------- desenho

/** Aplica a transformação da parte em volta de (cx, cy) e chama `desenhar()` com a origem no centro. */
function comTransformacao(ctx, parte, cx, cy, extraRad, desenhar) {
  ctx.save();
  ctx.globalAlpha *= parte?.opacidade ?? 1;
  ctx.translate(cx + (parte?.dx ?? 0), cy + (parte?.dy ?? 0) + (ANCORA[parte?.ancora] ?? 0));
  const rad = (((parte?.rotacao ?? 0) * Math.PI) / 180) + extraRad;
  if (rad) ctx.rotate(rad);
  const e = parte?.escala ?? 1;
  ctx.scale(e * (parte?.flipX ? -1 : 1), e * (parte?.flipY ? -1 : 1));
  desenhar();
  ctx.restore();
}

/** O progresso da animação (0..1): em loop repete a cada duração natural; senão a animação se estica à duração da instância. */
const progressoDe = (inst, t) => (inst.loop ? (t % inst.natural) / inst.natural : Math.min(0.999, t / inst.life));

/**
 * Desenha um EFEITO com o canto de cima-esquerda do tile em (px, py) da tela. Sem transformação, é a chamada de sempre (`drawEffect`).
 * Devolve false fora do tempo (antes do atraso ou depois do fim).
 */
export function desenharEfeito(ctx, inst, px, py, agora) {
  const t = agora - inst.born;
  if (t < 0 || t >= inst.life) return false;
  const pr = progressoDe(inst, t);
  const s = inst.sprite;
  if (s.tipo === 'efeito' && semTransformacao(inst.parte)) return drawEffect(ctx, s.id, px, py, pr);
  comTransformacao(ctx, inst.parte, px + TILE / 2, py + TILE / 2, 0, () => {
    if (s.tipo === 'efeito') drawEffect(ctx, s.id, -TILE / 2, -TILE / 2, pr);
    else if (s.tipo === 'projetil') drawMissile(ctx, s.id, 0, 0, 0, 0);
    else if (s.tipo === 'asset' && inst.asset) desenharAsset(ctx, inst.asset, pr);
  });
  return true;
}

/** Desenha um PROJÉTIL (com o rastro); `camera` = { x, y } em px. Sem transformação nem rastro, é a chamada de sempre (`drawMissile`). */
export function desenharProjetil(ctx, inst, agora, camera = { x: 0, y: 0 }) {
  const t = agora - inst.born;
  if (t < 0 || t >= inst.life) return false;
  const p = t / inst.life;
  const dx = inst.tx - inst.x;
  const dy = inst.ty - inst.y;
  const onde = (q) => [(inst.x + dx * q) * TILE + TILE / 2 - camera.x, (inst.y + dy * q) * TILE - camera.y];
  const parte = inst.parte;
  const um = (sprite, x, y, alfa = 1) => {
    if (sprite.tipo === 'projetil' && alfa === 1 && semTransformacao(parte) && !parte?.orientar) return drawMissile(ctx, sprite.id, Math.round(x), Math.round(y), dx, dy);
    const comAlfa = { ...(parte ?? {}), opacidade: (parte?.opacidade ?? 1) * alfa };
    comTransformacao(ctx, comAlfa, x, y, parte?.orientar ? Math.atan2(dy, dx) : 0, () => {
      if (sprite.tipo === 'projetil') drawMissile(ctx, sprite.id, 0, 0, dx, dy);
      else if (sprite.tipo === 'efeito') drawEffect(ctx, sprite.id, -TILE / 2, -TILE / 2, (t % (effectDuration(sprite.id) || 600)) / (effectDuration(sprite.id) || 600));
      else if (sprite.tipo === 'asset' && inst.asset) desenharAsset(ctx, inst.asset, inst.asset.loop === false ? p : (t % duracaoDoAsset(inst.asset)) / duracaoDoAsset(inst.asset));
    });
    return true;
  };
  // O RASTRO: cópias atrás do projétil, cada uma mais apagada.
  const r = parte?.rastro;
  if (r?.quantidade > 0) {
    const sprite = r.sprite ?? inst.sprite;
    for (let k = r.quantidade; k >= 1; k--) {
      const q = p - k * (r.espaco ?? 0.06);
      if (q <= 0) continue;
      const [x, y] = onde(q);
      um(sprite, x, y, (r.opacidade ?? 0.5) * (1 - k / (r.quantidade + 1)));
    }
  }
  const [x, y] = onde(p);
  return um(inst.sprite, x, y);
}

/**
 * O efeito CONTÍNUO de um buff ligado (a aura): o sprite da parte `continuo` da skill em loop, com o canto do tile em (px, py). Desenhado a
 * cada quadro enquanto o buff está na lista (`hunt.buffs` → `sk`). false se a skill não tem.
 */
const INSTANCIAS_CONTINUAS = new Map();
export function desenharContinuo(ctx, sk, px, py, agora, visuais = DADOS) {
  const p = visuais.skills?.[sk]?.continuo;
  if (!p?.sprite || p.sprite.tipo === 'nenhum') return false;
  const chave = `${sk}|${JSON.stringify(p)}`;
  let inst = INSTANCIAS_CONTINUAS.get(chave);
  if (!inst) {
    inst = { sprite: p.sprite, parte: { ...p, loop: true }, born: 0, life: Infinity, loop: true, natural: duracaoNatural(p.sprite, visuais), asset: p.sprite.tipo === 'asset' ? visuais.assets?.[p.sprite.id] ?? null : null };
    INSTANCIAS_CONTINUAS.set(chave, inst);
  }
  return desenharEfeito(ctx, inst, px, py, agora);
}

/** Um quadro de um asset centrado em (cx, cy) — a prévia da biblioteca na Arena de Efeitos (o mesmo desenho do combate). */
export function desenharQuadroDeAsset(ctx, asset, progresso, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  const ok = desenharAsset(ctx, asset, progresso);
  ctx.restore();
  return ok;
}
