// O que toda cidade usa: o sorteio com semente, o ruído suave, os MARCOS do jogo no chão (o portal, a forja, a árvore — os mesmos sprites da
// cidade de sempre), a conferência do caminho (a chegada alcança tudo) e a MONTAGEM do mapa no formato da cidade (`dados.CITY_MAP`) com o atlas.
import { daPaleta, atlas as atlasDa } from './sprites.mjs';
import { porDoodad } from './objetos.mjs';

export function sorteio(semente) {
  let s = semente;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}
/** O ruído suave (valores em [0, 1]) de uma grade W×H, `f` células por lado. */
export function ruidoSuave(rng, W, H) {
  const g = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => rng()));
  return (x, y, f = 8) => {
    const fx = ((((x / W) * f) % f) + f) % f, fy = ((((y / H) * f) % f) + f) % f;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const s = (t) => t * t * (3 - 2 * t);
    const a = g[iy][ix], b = g[iy][ix + 1], c = g[iy + 1][ix], d = g[iy + 1][ix + 1];
    const top = a + (b - a) * s(tx), bot = c + (d - c) * s(tx);
    return top + (bot - top) * s(ty);
  };
}

// os sprites dos marcos, os mesmos da cidade de sempre (gamedata/city-map.json): o portal (64×64), a bigorna da forja entre as duas fornalhas
// e a árvore grande (3×3, a casa do meio da direita vazia)
const PORTAL = 25056;
const FORJA = [[-1, 0, 7709], [0, 0, 55269], [1, 0, 7709]];
const ARVORE = [[0, 0, 18582], [1, 0, 18583], [2, 0, 18584], [0, 1, 18585], [1, 1, 18587], [0, 2, 18586], [1, 2, 18588], [2, 2, 18589]];
/** Põe os sprites dos marcos de `objetos` (o formato de city-meta.json) na camada; devolve as casas que bloqueiam (a forja e a árvore). */
export function porMarcos(cam, objetos) {
  const duras = new Set();
  const feitos = new Set();
  for (const o of objetos) {
    if (o.acao === 'aventuras' || o.acao === 'boss-diarios') cam.por(o.x, o.y, PORTAL);
    // (09/11) o DISPOSITIVO DE MAPAS da cidade do endgame (a Costa Karui): a poça roxa em redemoinho, de pé (clica-se nele)
    else if (o.acao === 'dispositivo') for (const [x, y] of porDoodad(cam, 'color purple pool', o.x, o.y, () => 0, { alt: 0, exigeLivre: false }) ?? [[o.x, o.y]]) duras.add(`${x},${y}`);
    else if (o.acao === 'forja') for (const [dx, dy, id] of FORJA) { cam.por(o.x + dx, o.y + dy, id); duras.add(`${o.x + dx},${o.y + dy}`); }
    else if (o.acao === 'arvore') {
      const [x0, y0] = o.uid.split(':')[2].split(',').map(Number); // `marco:arvore:<canto>:<casa>`
      if (feitos.has(`${x0},${y0}`)) continue;
      feitos.add(`${x0},${y0}`);
      for (const [dx, dy, id] of ARVORE) { cam.por(x0 + dx, y0 + dy, id); duras.add(`${x0 + dx},${y0 + dy}`); }
    }
  }
  return duras;
}

/** As casas alcançáveis a pé a partir de (x, y) (`livre(x, y)`). */
export function alcancaveis(W, H, livre, [x0, y0]) {
  const vis = new Set([`${x0},${y0}`]);
  const fila = [[x0, y0]];
  while (fila.length) {
    const [x, y] = fila.shift();
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || vis.has(k) || !livre(nx, ny)) continue;
      vis.add(k);
      fila.push([nx, ny]);
    }
  }
  return vis;
}

/**
 * Monta o MAPA no formato da cidade: `pilhas[i]` = os ids (o chão, as bordas e os objetos, de baixo para cima), `blocked[i]` = 0/1. Cada id vira
 * uma entrada da paleta (copiada da do mapa capturado onde o sprite está, com os quadros copiados para o atlas novo). Devolve `{ mapa, atlas }`.
 */
export function compor({ id, W, H, z = 7, pilhas, blocked }) {
  const COLUNAS = 32;
  const cell = 64;
  const paleta = [];
  const quadros = [];
  const indiceDe = new Map();
  const usar = (item) => {
    if (indiceDe.has(item)) return indiceDe.get(item);
    const p = daPaleta(item);
    if (!p) throw new Error(`${id}: sem sprite para o item ${item}`);
    if (p.cell !== cell) throw new Error(`${id}: o item ${item} vem de um atlas de casa ${p.cell}`);
    const cells = (p.e.cells ?? [[p.e.ax, p.e.ay]]).map(([x, y]) => {
      quadros.push({ fonte: p.fonte, x, y });
      const n = quadros.length - 1;
      return [(n % COLUNAS) * cell, Math.floor(n / COLUNAS) * cell];
    });
    paleta.push({ ...p.e, cells, ax: cells[0][0], ay: cells[0][1] });
    indiceDe.set(item, paleta.length - 1);
    return paleta.length - 1;
  };
  const stacks = pilhas.map((p) => p.map(usar));
  const AW = COLUNAS * cell;
  const AH = Math.max(1, Math.ceil(quadros.length / COLUNAS)) * cell;
  const data = new Uint8ClampedArray(AW * AH * 4);
  quadros.forEach((q, n) => {
    const at = atlasDa(q.fonte).at;
    const dx = (n % COLUNAS) * cell, dy = Math.floor(n / COLUNAS) * cell;
    for (let j = 0; j < cell && q.y + j < at.h; j++) {
      const s = ((q.y + j) * at.w + q.x) * 4;
      data.set(at.data.subarray(s, s + Math.min(cell, at.w - q.x) * 4), ((dy + j) * AW + dx) * 4);
    }
  });
  const zeros = Array(W * H).fill(0);
  const andar = { stacks, blocked, opaque: zeros, avoid: zeros };
  const mapa = { width: W, height: H, cell, atlas: `cidades/${id}`, palette: paleta, z, levels: [z], floors: { [z]: andar }, fundos: {}, custom: true, ...andar };
  return { mapa, atlas: { w: AW, h: AH, data } };
}
