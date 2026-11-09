// Os OBJETOS do editor: os doodads (doodads.xml, trees.xml, grass.xml, stones.xml, plants.xml — a peça solta sorteada ou a composta de várias casas),
// as PAREDES (walls.xml — a peça pela vizinhança, pelas tabelas do editor: `wall_brush.cpp` e `brush_tables.cpp`) e as MESAS (o barco por partes).
import { readFileSync } from 'node:fs';
import { TAB_PAREDE, TAB_PAREDE_REDUZIDA } from './motor.mjs';
const D = new URL('./dados/', import.meta.url);
const ler = (f) => readFileSync(new URL(f, D), 'utf8');
const itensDe = (txt) => [...txt.matchAll(/<item id="(\d+)"(?:\s+chance="(\d+)")?/g)].map((m) => ({ id: +m[1], chance: m[2] == null ? 1 : +m[2] }));

export const DOODADS = new Map();
for (const f of ['doodads.xml', 'trees.xml', 'grass.xml', 'stones.xml', 'plants.xml', 'flowers.xml']) {
  for (const m of ler(f).matchAll(/<brush name="([^"]+)" type="doodad"[^>]*>([\s\S]*?)<\/brush>/g)) {
    const [, nome, corpo] = m;
    const blocos = corpo.includes('<alternate>') ? [...corpo.matchAll(/<alternate>([\s\S]*?)<\/alternate>/g)].map((a) => a[1]) : [corpo];
    const alternativas = blocos.map((b) => {
      const compostos = [...b.matchAll(/<composite chance="(\d+)">([\s\S]*?)<\/composite>/g)].map((c) => ({
        chance: +c[1],
        casas: [...c[2].matchAll(/<tile x="(-?\d+)" y="(-?\d+)"(?: z="(-?\d+)")?>([\s\S]*?)<\/tile>/g)].map((t) => ({ x: +t[1], y: +t[2], z: +(t[3] ?? 0), itens: itensDe(t[4]).map((i) => i.id) })),
      }));
      const soltos = itensDe(b.replace(/<composite[\s\S]*?<\/composite>/g, ''));
      return { compostos, soltos };
    });
    DOODADS.set(nome, { nome, alternativas });
  }
}
export const PAREDES = new Map();
for (const m of ler('walls.xml').matchAll(/<brush name="([^"]+)" type="wall"[^>]*>([\s\S]*?)<\/brush>/g)) {
  const tipos = {};
  for (const t of m[2].matchAll(/<wall type="([^"]+)">([\s\S]*?)<\/wall>/g)) tipos[t[1]] = itensDe(t[2].replace(/<door[\s\S]*?\/>/g, ''));
  PAREDES.set(m[1], { nome: m[1], tipos });
}
export const MESAS = new Map();
for (const m of ler('doodads.xml').matchAll(/<brush name="([^"]+)" type="table"[^>]*>([\s\S]*?)<\/brush>/g)) {
  MESAS.set(m[1], Object.fromEntries([...m[2].matchAll(/<table align="([^"]+)">([\s\S]*?)<\/table>/g)].map((t) => [t[1], itensDe(t[2])])));
}

const sortear = (itens, rng) => { const tot = itens.reduce((t, x) => t + x.chance, 0); let r = rng() * tot; return (itens.find((x) => (r -= x.chance) < 0) ?? itens[0]).id; };

/** A camada de objetos: `x,y` → [ids] (por cima do chão e das bordas). */
export class Camada {
  constructor(W, H, existe = () => true) { this.W = W; this.H = H; this.m = new Map(); this.existe = existe; this.cima = new Map(); }
  em(x, y) { return this.m.get(`${x},${y}`) ?? []; }
  livre(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H && !this.m.has(`${x},${y}`); }
  por(x, y, id) { if (!this.existe(id)) return false; const k = `${x},${y}`; this.m.set(k, [...(this.m.get(k) ?? []), id]); return true; }
}

/**
 * Um DOODAD em (x, y): a alternativa `alt` (ou sorteada), o composto sorteado pela chance (ou a peça solta). Só põe se TODAS as casas estiverem
 * livres e os sprites existirem (`exigeLivre`). Devolve as casas usadas, ou null.
 */
export function porDoodad(cam, nome, x, y, rng = Math.random, { alt = null, exigeLivre = true, pode = () => true } = {}) {
  const d = DOODADS.get(nome);
  if (!d) throw new Error(`doodad desconhecido: ${nome}`);
  const a = d.alternativas[alt ?? Math.floor(rng() * d.alternativas.length)];
  const opcoes = [...a.compostos.map((c) => ({ chance: c.chance, casas: c.casas.filter((t) => t.z === 0) })), ...a.soltos.filter((s) => cam.existe(s.id)).map((s) => ({ chance: s.chance, casas: [{ x: 0, y: 0, itens: [s.id] }] }))]
    .filter((o) => o.casas.every((t) => t.itens.every((id) => cam.existe(id))));
  if (!opcoes.length) return null;
  const tot = opcoes.reduce((t, o) => t + o.chance, 0); let r = rng() * tot;
  const o = opcoes.find((q) => (r -= q.chance) < 0) ?? opcoes[0];
  if (o.casas.some((t) => (exigeLivre && !cam.livre(x + t.x, y + t.y)) || !pode(x + t.x, y + t.y))) return null;
  for (const t of o.casas) for (const id of t.itens) cam.por(x + t.x, y + t.y, id);
  return o.casas.map((t) => [x + t.x, y + t.y]);
}

// o nome do tipo no walls.xml de cada peça da tabela
const TIPO_DA_PECA = { 0: 'pole', 1: 'south end', 2: 'east end', 3: 'corner', 4: 'west end', 6: 'horizontal', 7: 'south T', 8: 'north end', 9: 'vertical', 11: 'east T', 13: 'west T', 14: 'north T', 15: 'intersection' };
/** Uma PAREDE pelas casas `celulas` (Set de "x,y"): a peça de cada uma pelos vizinhos (N, O, L, S), a cheia e, faltando, a reduzida. */
export function porParede(cam, nome, celulas, rng = Math.random) {
  const p = PAREDES.get(nome);
  if (!p) throw new Error(`parede desconhecida: ${nome}`);
  const tem = (t) => (p.tipos[t] ?? []).some((i) => cam.existe(i.id));
  for (const k of celulas) {
    const [x, y] = k.split(',').map(Number);
    const td = (celulas.has(`${x},${y - 1}`) ? 1 : 0) | (celulas.has(`${x - 1},${y}`) ? 2 : 0) | (celulas.has(`${x + 1},${y}`) ? 4 : 0) | (celulas.has(`${x},${y + 1}`) ? 8 : 0);
    let tipo = TIPO_DA_PECA[TAB_PAREDE[td]];
    if (!tipo || !tem(tipo)) tipo = TIPO_DA_PECA[TAB_PAREDE_REDUZIDA[td]];
    if (!tem(tipo)) tipo = ['horizontal', 'vertical', 'pole'].find(tem);
    cam.por(x, y, sortear(p.tipos[tipo].filter((i) => cam.existe(i.id)), rng));
  }
}
/** O BARCO (a "mesa" do editor) em linha: `vertical` (de cima para baixo) ou `horizontal`, `n` casas a partir de (x, y). */
export function porMesa(cam, nome, x, y, n, sentido = 'vertical', rng = Math.random) {
  const t = MESAS.get(nome);
  const [ini, meio, fim] = sentido === 'vertical' ? ['north', 'vertical', 'south'] : ['west', 'horizontal', 'east'];
  for (let i = 0; i < n; i++) {
    const al = i === 0 ? ini : i === n - 1 ? fim : meio;
    const itens = (t[al] ?? []).filter((it) => cam.existe(it.id));
    if (itens.length) cam.por(sentido === 'vertical' ? x : x + i, sentido === 'vertical' ? y + i : y, sortear(itens, rng));
  }
}
