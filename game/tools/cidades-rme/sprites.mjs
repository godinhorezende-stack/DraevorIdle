// Os SPRITES que o jogo já tem, por id do item: o primeiro achado de cada id em TODOS os mapas capturados (a cidade e as caçadas — a fonte e o
// índice da paleta), e o que BLOQUEIA (de cada id: em quantas casas aparece e em quantas a casa é bloqueada). Os ids do editor são os mesmos.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { decodificarPng } from '../../engine/png-minimo.mjs';

export const G = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'gamedata');
const fontes = new Map();
export const POR_ID = new Map();
const ESTAT = new Map();
const arquivos = ['city', ...readdirSync(join(G, 'hunts')).filter((f) => f.endsWith('-map.json')).map((f) => f.replace('-map.json', ''))];
for (const id of arquivos) {
  const m = JSON.parse(readFileSync(id === 'city' ? join(G, 'city-map.json') : join(G, 'hunts', `${id}-map.json`), 'utf8'));
  fontes.set(id, { m, at: null });
  m.palette.forEach((e, k) => { if (!POR_ID.has(e.id) && (e.variant ?? 0) === 0) POR_ID.set(e.id, { fonte: id, idx: k }); });
  for (const f of Object.values(m.floors ?? { [m.z]: m })) {
    const bl = f.blocked ?? m.blocked;
    (f.stacks ?? []).forEach((p, i) => {
      if (!p?.length) return;
      for (const k of new Set(p.map((x) => m.palette[x]?.id))) { const e = ESTAT.get(k) ?? { n: 0, b: 0 }; e.n++; if (bl?.[i]) e.b++; ESTAT.set(k, e); }
    });
  }
}
export const existe = (id) => POR_ID.has(id);
/** Bloqueia: apareceu em ao menos 3 casas dos mapas capturados e em ≥ 90% delas a casa era bloqueada. */
export const bloqueia = (id) => { const e = ESTAT.get(id); return !!e && e.n >= 3 && e.b / e.n >= 0.9; };
export function atlas(fonte) { const f = fontes.get(fonte); f.at ??= decodificarPng(readFileSync(join(G, 'sprites', `${f.m.atlas}.png`))); return f; }
/** A entrada da paleta do sprite do item `id` e a fonte dela (`{ e, fonte, cell }`). */
export function daPaleta(id) { const ref = POR_ID.get(id); if (!ref) return null; const f = fontes.get(ref.fonte); return { e: f.m.palette[ref.idx], fonte: ref.fonte, cell: f.m.cell ?? 64 }; }

/** Desenha o sprite do item `id` em `out` (W×H) com o canto da casa em (px, py) — para conferir (o jogo desenha com o deslocamento e a altura). */
export function desenhar(out, W, H, id, px, py) {
  const ref = POR_ID.get(id); if (!ref) return false;
  const f = atlas(ref.fonte); const e = f.m.palette[ref.idx]; const cell = f.m.cell ?? 64;
  for (let j = 0; j < e.h; j++) for (let i = 0; i < e.w; i++) {
    const X = px - (e.w - 32) + i, Y = py - (e.h - 32) + j; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
    const s = ((e.ay + (cell - e.h) + j) * f.at.w + e.ax + (cell - e.w) + i) * 4; const a = f.at.data[s + 3] / 255; if (!a) continue;
    const d = (Y * W + X) * 4; for (let z = 0; z < 3; z++) out[d + z] = f.at.data[s + z] * a + out[d + z] * (1 - a); out[d + 3] = 255;
  }
  return true;
}
