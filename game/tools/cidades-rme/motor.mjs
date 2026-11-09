// O AUTO-BORDER do Remere's Map Editor (a versão da opentibiabr): os pincéis (data/materials/brushs/grounds.xml, borders/borders.xml) e as regras e
// as tabelas do código do editor (source/ground_brush.cpp — doBorders e getBrushTo; source/brush_tables.cpp — as peças por vizinhança).
import { readFileSync } from 'node:fs';
const D = new URL('./dados/', import.meta.url);
const XG = readFileSync(new URL('grounds.xml', D), 'utf8');
const XB = readFileSync(new URL('borders.xml', D), 'utf8');
const pecasDoXml = (txt) => Object.fromEntries([...txt.matchAll(/edge="(\w+)"\s+item="(\d+)"/g)].map((m) => [m[1], +m[2]]));
export const BORDAS = new Map([...XB.matchAll(/<border id="(\d+)"[^>]*>([\s\S]*?)<\/border>/g)].map((m) => [m[1], pecasDoXml(m[2])]));
export const PINCEIS = new Map();
for (const m of XG.matchAll(/<brush name="([^"]+)" type="ground"[^>]*?z-order="(\d+)"[^>]*>([\s\S]*?)<\/brush>/g)) {
  const [, nome, z, corpo] = m;
  const itens = [...corpo.matchAll(/<item id="(\d+)" chance="(\d+)"/g)].map((x) => ({ id: +x[1], chance: +x[2] })).filter((x) => x.chance > 0);
  const bordas = [];
  for (const b of corpo.matchAll(/<border align="(\w+)"((?:\s+\w+="[^"]*")*)\s*(\/>|>([\s\S]*?)<\/border>)/g)) {
    const at = Object.fromEntries([...b[2].matchAll(/(\w+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
    const pecas = at.id ? BORDAS.get(at.id) : pecasDoXml(b[4] ?? '');
    if (pecas && Object.keys(pecas).length) bordas.push({ align: b[1], to: at.to ?? null, pecas });
  }
  const amigos = [...corpo.matchAll(/<friend name="([^"]+)"/g)].map((x) => x[1]);
  PINCEIS.set(nome, { nome, z: +z, itens, bordas, amigos });
}

// as TABELAS do editor: os 8 vizinhos (bit 0 NO, 1 N, 2 NE, 3 O, 4 L, 5 SO, 6 S, 7 SE) → até 4 peças; as paredes (bit 0 N, 1 O, 2 L, 3 S) → a peça
const CPP = readFileSync(new URL('brush_tables.cpp', D), 'utf8');
const ENUM = {
  TILE_NORTHWEST: 1, TILE_NORTH: 2, TILE_NORTHEAST: 4, TILE_WEST: 8, TILE_EAST: 16, TILE_SOUTHWEST: 32, TILE_SOUTH: 64, TILE_SOUTHEAST: 128,
  WALLTILE_NORTH: 1, WALLTILE_WEST: 2, WALLTILE_EAST: 4, WALLTILE_SOUTH: 8,
  BORDER_NONE: 0, NORTH_HORIZONTAL: 1, EAST_HORIZONTAL: 2, SOUTH_HORIZONTAL: 3, WEST_HORIZONTAL: 4, NORTHWEST_CORNER: 5, NORTHEAST_CORNER: 6, SOUTHWEST_CORNER: 7,
  SOUTHEAST_CORNER: 8, NORTHWEST_DIAGONAL: 9, NORTHEAST_DIAGONAL: 10, SOUTHEAST_DIAGONAL: 11, SOUTHWEST_DIAGONAL: 12,
  WALL_POLE: 0, WALL_SOUTH_END: 1, WALL_EAST_END: 2, WALL_NORTHWEST_DIAGONAL: 3, WALL_WEST_END: 4, WALL_NORTHEAST_DIAGONAL: 5, WALL_HORIZONTAL: 6, WALL_SOUTH_T: 7,
  WALL_NORTH_END: 8, WALL_VERTICAL: 9, WALL_SOUTHWEST_DIAGONAL: 10, WALL_EAST_T: 11, WALL_SOUTHEAST_DIAGONAL: 12, WALL_WEST_T: 13, WALL_NORTH_T: 14, WALL_INTERSECTION: 15,
};
const avaliar = (expr) => expr.split('|').map((t) => t.trim()).filter(Boolean).reduce((v, t) => {
  const m = /^(\w+)(?:\s*<<\s*(\d+))?$/.exec(t);
  return v | ((ENUM[m[1]] ?? Number(m[1])) << Number(m[2] ?? 0));
}, 0);
const tabela = (nome) => {
  const t = [];
  for (const m of CPP.matchAll(new RegExp(nome.replace(/[.:]/g, '\\$&') + '\\[([^\\]]+)\\][^=]*=\\s*([^;]+);', 'g'))) t[avaliar(m[1])] = avaliar(m[2]);
  return t;
};
export const TAB_CHAO = tabela('GroundBrush::border_types');
export const TAB_PAREDE = tabela('WallBrush::full_border_types');
export const TAB_PAREDE_REDUZIDA = tabela('WallBrush::half_border_types');
const NOME_DA_PECA = [null, 'n', 'e', 's', 'w', 'cnw', 'cne', 'csw', 'cse', 'dnw', 'dne', 'dse', 'dsw'];
const VIZ = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const sortear = (itens, rng) => { const tot = itens.reduce((t, x) => t + x.chance, 0); let r = rng() * tot; return (itens.find((x) => (r -= x.chance) < 0) ?? itens[0]).id; };
const amigos = (a, b) => a.amigos.includes(b.nome) || b.amigos.includes(a.nome);

/** `getBrushTo` do editor: a borda que a casa de `G` recebe do vizinho `X` (ou null). `to` ausente = para todos. */
function bordaDoPar(G, X) {
  const interna = (alvo) => G.bordas.find((b) => b.align === 'inner' && b.to === alvo) ?? G.bordas.find((b) => b.align === 'inner' && b.to == null);
  if (G.z < X.z && X.bordas.some((b) => b.align === 'outer')) {
    const i = interna(X.nome);
    if (i) return i.pecas;
    const o = X.bordas.find((b) => b.align === 'outer' && b.to === G.nome) ?? X.bordas.find((b) => b.align === 'outer' && b.to == null);
    return o?.pecas ?? null;
  }
  return interna(X.nome)?.pecas ?? null;
}

/** Pinta a grade (`grade[y][x]` = o nome do pincel) pelo `doBorders` do editor: as pilhas de ids (o chão e as bordas). `existe(id)`: o sprite existe. */
export function pintar(grade, { rng = Math.random, existe = () => true } = {}) {
  const H = grade.length, W = grade[0].length;
  const em = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : PINCEIS.get(grade[y][x]));
  const pilhas = [];
  const faltas = {};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const G = em(x, y);
    if (!G) throw new Error(`pincel desconhecido: ${grade[y][x]}`);
    const itens = G.itens.filter((it) => existe(it.id));
    const pilha = [sortear(itens.length ? itens : G.itens, rng)];
    const grupos = new Map();
    VIZ.forEach(([dx, dy], i) => {
      const X = em(x + dx, y + dy);
      if (!X || X.nome === G.nome || amigos(G, X)) return;
      const pc = bordaDoPar(G, X);
      if (!pc) return;
      const g = grupos.get(pc) ?? grupos.set(pc, { z: X.z, alinhamento: 0 }).get(pc);
      g.alinhamento |= 1 << i;
      g.z = Math.max(g.z, X.z);
    });
    for (const [pc, g] of [...grupos].sort((a, b) => b[1].z - a[1].z)) {
      const v = TAB_CHAO[g.alinhamento] ?? 0;
      for (let k = 0; k < 4; k++) {
        const nome = NOME_DA_PECA[(v >> (8 * k)) & 0xff];
        if (!nome) break;
        const ids = pc[nome] ? [pc[nome]] : ({ dnw: ['w', 'n'], dne: ['e', 'n'], dsw: ['s', 'w'], dse: ['s', 'e'] }[nome] ?? []).map((e) => pc[e]);
        for (const id of ids) {
          if (id && existe(id)) pilha.push(id);
          else faltas[nome] = (faltas[nome] ?? 0) + 1;
        }
      }
    }
    pilhas.push(pilha);
  }
  return { pilhas, faltas, W, H };
}
