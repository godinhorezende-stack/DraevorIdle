// O ACAMPAMENTO DA PONTE (Ato 7): os exilados acampados em cima de uma ponte de pedra larga sobre o rio. O rio desce pelo meio do mapa;
// a ponte de lajes o cruza de leste a oeste, com a mureta de pedra dos dois lados (os braseiros e as lâmpadas nas pontas); em cima dela,
// o acampamento (as tendas, as caixas, a carroça, a fogueira); nas cabeceiras, as torres de guarda arruinadas; nas margens, a mata escura
// com as árvores secas e as pedras. Os pontos do jogo (a chegada, os NPCs, os marcos) vêm de `cidades.json` (`def`).
import * as M from './motor.mjs';
import * as O from './objetos.mjs';
import { existe, bloqueia } from './sprites.mjs';
import { sorteio, ruidoSuave, porMarcos } from './comum.mjs';

export const W = 64, H = 48;

export function gerar(def, semente = 71) {
  const rng = sorteio(semente);
  const ruido = ruidoSuave(rng, W, H);

  // ---- a PLANTA: o rio (as margens onduladas), a ponte (as lajes por cima da água, a mureta em volta), as cabeceiras de terra
  const PONTE = { y0: 19, y1: 28 }; // a largura da ponte (y), a mureta em y0 e y1
  const margemOeste = (y) => 17 + Math.round((ruido(2, y * 2) - 0.5) * 5);
  const margemLeste = (y) => 46 + Math.round((ruido(5, y * 2) - 0.5) * 5);
  const noRio = (x, y) => x >= margemOeste(y) && x <= margemLeste(y);
  const naPonte = (x, y) => y > PONTE.y0 && y < PONTE.y1 && x >= Math.min(margemOeste(PONTE.y0), margemOeste(PONTE.y1)) - 3 && x <= Math.max(margemLeste(PONTE.y0), margemLeste(PONTE.y1)) + 3;
  const naEstrada = (x, y) => y >= 22 && y <= 25;
  let g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    if (noRio(x, y)) return 'sea';
    if (naEstrada(x, y)) return 'dirt';
    return ruido(x * 3, y * 3) > 0.55 ? 'grass (dark)' : 'grass';
  }));
  const V8 = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  const grama = (c) => c === 'grass' || c === 'grass (dark)';
  for (let it = 0; it < 3; it++) g = g.map((l, y) => l.map((c, x) => { if (!grama(c)) return c; const cont = {}; for (const [dx, dy] of V8) { const v = g[y + dy]?.[x + dx]; if (v && grama(v)) cont[v] = (cont[v] ?? 0) + 1; } const e = Object.entries(cont).sort((a, b) => b[1] - a[1])[0]; return e && e[1] >= 5 && e[0] !== c ? e[0] : c; }));

  const { pilhas, faltas } = M.pintar(g, { rng, existe });
  if (Object.keys(faltas).length) throw new Error(`Ponte: peças de borda sem sprite ${JSON.stringify(faltas)}`);

  // a PONTE: as lajes por cima (do rio e das margens: a ponte começa em terra firme — o chão por baixo continua o de lá, as bordas ficam
  // inteiras), e a mureta de pedra nas duas bordas
  const LAJES = M.PINCEIS.get('gray stone tiles').itens.filter((i) => existe(i.id));
  const xsDaPonte = [...Array(W).keys()].filter((x) => naPonte(x, PONTE.y0 + 1));
  const [px0, px1] = [Math.min(...xsDaPonte), Math.max(...xsDaPonte)];
  const PISO = new Set();
  for (let y = PONTE.y0 + 1; y < PONTE.y1; y++) for (let x = px0; x <= px1; x++) {
    PISO.add(`${x},${y}`);
    pilhas[y * W + x] = [LAJES[Math.floor(rng() * LAJES.length)].id];
  }
  const cam = new O.Camada(W, H, existe);
  const mureta = new Set();
  for (let x = px0; x <= px1; x++) for (const y of [PONTE.y0, PONTE.y1]) mureta.add(`${x},${y}`);
  O.porParede(cam, 'stone wall', mureta, rng);

  // ---- os MARCOS do jogo primeiro; o lugar dos NPCs, da chegada e dos portais fica livre
  const duras = porMarcos(cam, def.objetos ?? []);
  const reservado = new Set([def.chegada, ...(def.npcs ?? [])].map((p) => `${p.x},${p.y}`));
  for (const o of def.objetos ?? []) if (o.acao === 'aventuras' || o.acao === 'boss-diarios') reservado.add(`${o.x},${o.y}`);
  const pode = (x, y) => !reservado.has(`${x},${y}`) && !(naEstrada(x, y) && !PISO.has(`${x},${y}`));

  // ---- as CABECEIRAS: as torres de guarda arruinadas (a parede quebrada) dos dois lados da estrada, nas duas pontas da ponte
  for (const [x0, y0] of [[px0 - 6, 15], [px0 - 6, 28], [px1 + 2, 15], [px1 + 2, 28]]) {
    const torre = new Set();
    for (let x = x0; x <= x0 + 4; x++) for (const y of [y0, y0 + 4]) torre.add(`${x},${y}`);
    for (let y = y0; y <= y0 + 4; y++) for (const x of [x0, x0 + 4]) torre.add(`${x},${y}`);
    for (const k of [...torre]) { const [x, y] = k.split(',').map(Number); if (ruido(x * 7, y * 7) > 0.6 && !((x === x0 || x === x0 + 4) && (y === y0 || y === y0 + 4))) torre.delete(k); }
    O.porParede(cam, 'ruin wall', torre, rng);
    O.porDoodad(cam, 'debris (bigger)', x0 + 2, y0 + 2, rng, { pode });
  }

  // ---- EM CIMA DA PONTE: as tendas encostadas na mureta, a fogueira, os braseiros nas pontas, as caixas, os barris e a carroça
  const meio = Math.round((px0 + px1) / 2);
  for (const x of [px0 + 3, px0 + 8, px1 - 8, px1 - 3]) for (const y of [PONTE.y0 + 2, PONTE.y1 - 1]) O.porDoodad(cam, 'gray striped tent', x, y, rng, { pode });
  O.porDoodad(cam, 'campfire', meio, 21, rng, { alt: 2 });
  for (const [x, y] of [[px0, PONTE.y0 + 1], [px0, PONTE.y1 - 1], [px1, PONTE.y0 + 1], [px1, PONTE.y1 - 1], [meio - 4, PONTE.y0 + 1], [meio + 4, PONTE.y1 - 1]]) O.porDoodad(cam, 'coal basin (immovable)', x, y, rng, { pode, alt: 1 });
  for (const [n, x, y, alt] of [['white caravan wagon', meio + 6, PONTE.y0 + 2, 1], ['new blue banner', meio - 2, PONTE.y0, null], ['new blue banner', meio + 2, PONTE.y0, null], ['bench', meio - 2, 21, 1], ['bench', meio + 2, 21, 1]]) O.porDoodad(cam, n, x, y, rng, { alt, pode, exigeLivre: n !== 'new blue banner' });
  const CAIXA = 2471, BARRIL = 2523;
  for (const [x, y, id] of [[px0 + 5, PONTE.y0 + 1, CAIXA], [px0 + 6, PONTE.y0 + 1, BARRIL], [px1 - 5, PONTE.y1 - 1, CAIXA], [px1 - 6, PONTE.y1 - 1, BARRIL], [meio - 7, PONTE.y1 - 1, CAIXA], [meio + 8, PONTE.y0 + 1, BARRIL]]) if (cam.livre(x, y) && pode(x, y)) cam.por(x, y, id);
  // o COFRE do depósito, ao lado de Weylam
  cam.por(meio - 5, PONTE.y0 + 1, 3497);

  // ---- as MARGENS: a mata escura (árvores verdes e secas), as samambaias e as plantas da beira do rio, as pedras; a estrada e a beira
  // da ponte limpas
  const perto = (x, y, c) => [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => g[y + dy]?.[x + dx] === c);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = g[y][x];
    if (!grama(c) || !cam.livre(x, y) || !pode(x, y) || naEstrada(x, y) || (y >= PONTE.y0 - 1 && y <= PONTE.y1 + 1 && x >= px0 - 8 && x <= px1 + 8)) continue;
    if (perto(x, y, 'sea')) { if (rng() < 0.2) O.porDoodad(cam, 'swamp plants', x, y, rng); continue; }
    const r = rng();
    const mata = c === 'grass (dark)' ? 0.5 : 0.18;
    if (r < mata) O.porDoodad(cam, rng() < 0.25 ? 'dead trees' : 'green trees', x, y, rng, { pode });
    else if (r < mata + 0.06) O.porDoodad(cam, 'jungle fern', x, y, rng);
    else if (r < mata + 0.08) O.porDoodad(cam, 'mossy rocks (small)', x, y, rng);
    else if (r < mata + 0.12) O.porDoodad(cam, 'grass tufts', x, y, rng);
  }

  // ---- o BLOQUEIO: a água (fora a ponte), a mureta, os marcos de pé, as peças de pé; não bloqueiam as plantas, os tufos, as pedrinhas
  const SOLTOS = new Set(['grass tufts', 'jungle fern', 'swamp plants', 'mossy rocks (small)']
    .flatMap((n) => O.DOODADS.get(n).alternativas.flatMap((a) => [...a.soltos.map((s) => s.id), ...a.compostos.flatMap((cc) => cc.casas.flatMap((t) => t.itens))])));
  SOLTOS.add(25056);
  const blocked = pilhas.map((p, i) => {
    const x = i % W, y = Math.floor(i / W);
    const ob = cam.em(x, y);
    if (PISO.has(`${x},${y}`)) return duras.has(`${x},${y}`) || ob.some((id) => !SOLTOS.has(id)) ? 1 : 0;
    return duras.has(`${x},${y}`) || bloqueia(p[0]) || ob.some((id) => !SOLTOS.has(id)) ? 1 : 0;
  });
  const todas = pilhas.map((p, i) => [...p, ...cam.em(i % W, Math.floor(i / W))]);
  return { W, H, pilhas: todas, blocked, grade: g };
}
