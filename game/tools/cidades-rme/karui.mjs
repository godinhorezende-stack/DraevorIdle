// A COSTA KARUI (Ato 11 — o Epílogo; o dono, 09/11: "faz o mapa do ato 11 assim mesmo", para quando o Epílogo entrar): a aldeia dos Karui
// numa praia tropical. O mar a leste e ao sul, a praia larga com as canoas puxadas na areia; no interior, a mata de selva (as palmeiras,
// as plantas, o bambu); no meio, a clareira de terra da aldeia com a grande fogueira e os totens, e as cabanas de bambu em roda (as portas
// para a fogueira); o canto da pesca (o peixe secando, a lenha). Os pontos do jogo vêm de `cidades.json` (`def`).
import * as M from './motor.mjs';
import * as O from './objetos.mjs';
import { existe, bloqueia } from './sprites.mjs';
import { sorteio, ruidoSuave, porMarcos } from './comum.mjs';

export const W = 64, H = 48;

export function gerar(def, semente = 111) {
  const rng = sorteio(semente);
  const ruido = ruidoSuave(rng, W, H);

  // ---- a PLANTA: a costa (o mar a leste e ao sul), a praia, a mata de selva; a clareira da aldeia; as cabanas
  const ALDEIA = { x: 26, y: 22, r: 9.5 };
  const CABANAS = [
    { x0: 14, y0: 11, x1: 19, y1: 15 }, { x0: 23, y0: 8, x1: 29, y1: 12 }, { x0: 33, y0: 11, x1: 38, y1: 15 },
    { x0: 12, y0: 26, x1: 17, y1: 30 }, { x0: 34, y0: 27, x1: 39, y1: 31 },
  ];
  // a porta de cada cabana: duas casas no lado que dá para a fogueira
  for (const c of CABANAS) {
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    const dx = ALDEIA.x - cx, dy = ALDEIA.y - cy;
    if (Math.abs(dy) >= Math.abs(dx)) { const x = Math.floor(cx); c.porta = [[x, dy > 0 ? c.y1 : c.y0], [x + 1, dy > 0 ? c.y1 : c.y0]]; } else { const y = Math.floor(cy); c.porta = [[dx > 0 ? c.x1 : c.x0, y], [dx > 0 ? c.x1 : c.x0, y + 1]]; }
  }
  const costa = (x, y) => Math.min(47 + (ruido(x, y) - 0.5) * 8 - x, 37 + (ruido(y, x) - 0.5) * 6 - y);
  const naCabana = (x, y) => CABANAS.find((c) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1);
  const naAldeia = (x, y) => Math.hypot(x - ALDEIA.x, (y - ALDEIA.y) * 1.1) + (ruido(x * 4, y * 4) - 0.5) * 2 < ALDEIA.r;
  let g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    const d = costa(x, y);
    if (d <= 0) return 'sea';
    if (naCabana(x, y)) return 'darkest wooden floor';
    if (naAldeia(x, y)) return 'jungle dirt';
    return d <= 6 + ruido(x * 2, y) * 3 ? 'sand' : 'grass (jungle)';
  }));
  const V8 = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  const solto = (c) => c === 'sand' || c === 'grass (jungle)' || c === 'sea';
  for (let it = 0; it < 3; it++) g = g.map((l, y) => l.map((c, x) => { if (!solto(c)) return c; const cont = {}; for (const [dx, dy] of V8) { const v = g[y + dy]?.[x + dx]; if (v && solto(v)) cont[v] = (cont[v] ?? 0) + 1; } const e = Object.entries(cont).sort((a, b) => b[1] - a[1])[0]; return e && e[1] >= 5 && e[0] !== c ? e[0] : c; }));

  const { pilhas, faltas } = M.pintar(g, { rng, existe });
  if (Object.keys(faltas).length) throw new Error(`Karui: peças de borda sem sprite ${JSON.stringify(faltas)}`);
  const cam = new O.Camada(W, H, existe);

  // ---- os MARCOS do jogo primeiro; o lugar dos NPCs, da chegada e dos portais fica livre
  const duras = porMarcos(cam, def.objetos ?? []);
  const reservado = new Set([def.chegada, ...(def.npcs ?? [])].map((p) => `${p.x},${p.y}`));
  for (const o of def.objetos ?? []) if (o.acao === 'aventuras' || o.acao === 'boss-diarios') reservado.add(`${o.x},${o.y}`);
  const portas = new Set(CABANAS.flatMap((c) => c.porta.map(([x, y]) => `${x},${y}`)));
  const pode = (x, y) => !reservado.has(`${x},${y}`) && !portas.has(`${x},${y}`);

  // ---- as CABANAS de bambu (a porta para a fogueira) e por dentro a esteira de palha, a lenha, os barris
  for (const c of CABANAS) {
    const parede = new Set();
    for (let x = c.x0; x <= c.x1; x++) for (const y of [c.y0, c.y1]) parede.add(`${x},${y}`);
    for (let y = c.y0; y <= c.y1; y++) for (const x of [c.x0, c.x1]) parede.add(`${x},${y}`);
    for (const k of portas) parede.delete(k);
    O.porParede(cam, 'bamboo wall', parede, rng);
    O.porDoodad(cam, 'straw mat 2sqm', c.x0 + 1, c.y0 + 1, rng, { pode, alt: 0 });
    if (rng() < 0.7) O.porDoodad(cam, rng() < 0.5 ? 'large cask' : 'wood pile', c.x1 - 1, c.y1 - 1, rng, { pode, alt: 0 });
  }

  // ---- a CLAREIRA: a grande fogueira com os troncos em volta, os totens Karui, o canto da pesca (o peixe, os pallets, a lenha)
  O.porDoodad(cam, 'campfire', ALDEIA.x, ALDEIA.y - 1, rng, { alt: 2 });
  for (const [x, y, alt] of [[ALDEIA.x - 2, ALDEIA.y - 2, 1], [ALDEIA.x + 2, ALDEIA.y - 1, 1], [ALDEIA.x, ALDEIA.y - 3, 0], [ALDEIA.x - 1, ALDEIA.y + 1, 0]]) O.porDoodad(cam, 'bench', x, y, rng, { alt, pode });
  for (const [x, y] of [[ALDEIA.x - 6, ALDEIA.y - 4], [ALDEIA.x + 6, ALDEIA.y - 4], [ALDEIA.x - 6, ALDEIA.y + 5], [ALDEIA.x + 7, ALDEIA.y + 4]]) O.porDoodad(cam, 'totem poles', x, y, rng, { pode });
  for (const [n, x, y, alt] of [['fish', 33, 23, null], ['fish', 34, 23, null], ['pallet', 33, 24, 0], ['wood pile', 19, 21, null], ['wood pile', 19, 22, null], ['coal basin (immovable)', ALDEIA.x - 4, ALDEIA.y - 1, 1], ['coal basin (immovable)', ALDEIA.x + 4, ALDEIA.y - 1, 1]]) O.porDoodad(cam, n, x, y, rng, { alt, pode });
  // o COFRE do depósito, ao lado de Utula
  cam.por(30, 21, 3497);

  // ---- as CANOAS puxadas na areia (umas fixas na praia do sul e do leste, e outras soltas perto da água), e as conchas
  for (const [x, y, sentido] of [[14, 35, 'horizontal'], [30, 35, 'horizontal'], [41, 30, 'vertical'], [43, 14, 'vertical']]) if (g[y][x] === 'sand') O.porMesa(cam, 'small boat', x, y, 3, sentido, rng);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== 'sand' || !cam.livre(x, y) || !pode(x, y)) continue;
    const pertoDoMar = V8.some(([dx, dy]) => g[y + dy]?.[x + dx] === 'sea');
    const r = rng();
    if (pertoDoMar && r < 0.025) O.porMesa(cam, 'small boat', x, y, 3, rng() < 0.5 ? 'horizontal' : 'vertical', rng);
    else if (r < 0.03) O.porDoodad(cam, 'sea shells', x, y, rng);
    else if (!pertoDoMar && r < 0.06) O.porDoodad(cam, 'palm trees', x, y, rng, { pode });
  }
  // ---- a MATA de selva: palmeiras e árvores, as plantas grandes, o bambu, as samambaias
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== 'grass (jungle)' || !cam.livre(x, y) || !pode(x, y)) continue;
    const r = rng();
    const densa = ruido(x * 3, y * 3, 8) > 0.5 ? 0.45 : 0.25;
    if (r < densa) O.porDoodad(cam, rng() < 0.45 ? 'palm trees' : 'green trees', x, y, rng, { pode });
    else if (r < densa + 0.06) O.porDoodad(cam, 'jungle umbrella plants', x, y, rng);
    else if (r < densa + 0.1) O.porDoodad(cam, 'jungle plants', x, y, rng);
    else if (r < densa + 0.13) O.porDoodad(cam, 'bamboo plant', x, y, rng);
    else if (r < densa + 0.18) O.porDoodad(cam, 'jungle fern', x, y, rng);
  }

  // ---- o BLOQUEIO: o mar, os marcos de pé, as peças de pé; não bloqueiam a esteira, as plantas baixas, as conchas, o peixe
  const SOLTOS = new Set(['straw mat 2sqm', 'jungle fern', 'jungle plants', 'sea shells', 'fish']
    .flatMap((n) => O.DOODADS.get(n).alternativas.flatMap((a) => [...a.soltos.map((s) => s.id), ...a.compostos.flatMap((cc) => cc.casas.flatMap((t) => t.itens))])));
  SOLTOS.add(25056);
  const blocked = pilhas.map((p, i) => {
    const x = i % W, y = Math.floor(i / W);
    const ob = cam.em(x, y);
    return duras.has(`${x},${y}`) || bloqueia(p[0]) || ob.some((id) => !SOLTOS.has(id)) ? 1 : 0;
  });
  const todas = pilhas.map((p, i) => [...p, ...cam.em(i % W, Math.floor(i / W))]);
  return { W, H, pilhas: todas, blocked, grade: g };
}
