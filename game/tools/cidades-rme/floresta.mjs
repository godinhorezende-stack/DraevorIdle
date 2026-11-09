// O ACAMPAMENTO DA FLORESTA (Ato 2): o acampamento dos caçadores de Greust numa clareira da mata fechada. A estrada leste–oeste atravessa
// a paliçada (de cantos cortados) pelos dois portões e cruza o riacho por uma ponte de tábuas com guarda-corpo. Dentro: o pátio de terra
// em volta da fogueira e as trilhas até os portões e as cabanas; as duas cabanas de madeira (a de Greust, com o cofre, e a de Eramir); as
// tendas em arco ao sul; o canto do lenhador, o campo de treino com os alvos e o poço; o resto é grama com flores e tufos. Fora, a mata
// (árvores verdes, bétulas, uma ou outra seca, samambaias). Os pontos do jogo (a chegada, os NPCs, os marcos) vêm de `cidades.json`.
import * as M from './motor.mjs';
import * as O from './objetos.mjs';
import { existe, bloqueia } from './sprites.mjs';
import { sorteio, ruidoSuave, porMarcos } from './comum.mjs';

export const W = 64, H = 48;

export function gerar(def, semente = 23) {
  const rng = sorteio(semente);
  const ruido = ruidoSuave(rng, W, H);

  // ---- a PLANTA
  const PAL = { x0: 16, y0: 8, x1: 47, y1: 38, corte: 4 }; // a paliçada: o retângulo com os quatro cantos cortados em degrau
  const ESTRADA = [23, 24]; // a estrada leste–oeste (y)
  const PATIO = { x: 32, y: 22, r: 6.5 };
  const CABANAS = [
    { x0: 19, y0: 10, x1: 26, y1: 16 }, // a de Greust (o cofre)
    { x0: 37, y0: 10, x1: 44, y1: 16 }, // a de Eramir
  ].map((c) => ({ ...c, porta: [Math.floor((c.x0 + c.x1) / 2), Math.floor((c.x0 + c.x1) / 2) + 1] }));
  const rio = (y) => 8 + Math.round(Math.sin(y / 6) * 2 + (ruido(3, y * 2) - 0.5) * 2);
  // dentro da paliçada (a linha de toras incluída): o retângulo menos os cantos cortados
  const corteEm = (x, y) => {
    const dx = Math.min(x - PAL.x0, PAL.x1 - x), dy = Math.min(y - PAL.y0, PAL.y1 - y);
    return dx + dy < PAL.corte;
  };
  const naPalicada = (x, y) => x >= PAL.x0 && x <= PAL.x1 && y >= PAL.y0 && y <= PAL.y1 && !corteEm(x, y);
  // (por dentro: os 8 vizinhos dentro — assim a linha de toras dos cantos cortados sai em degraus em L, ligados pelo lado: com só os 4, os
  // degraus se tocavam na diagonal e o pincel de parede os desenhava como postes soltos)
  const dentro = (x, y) => [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].every(([dx, dy]) => naPalicada(x + dx, y + dy));
  const naCabana = (x, y) => CABANAS.find((c) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1);
  // as trilhas: do pátio às portas das cabanas (2 de largura, descendo) e a estrada
  const naTrilha = (x, y) => ESTRADA.includes(y) || CABANAS.some((c) => c.porta.includes(x) && y > c.y1 && y <= PATIO.y);
  const noPatio = (x, y) => { const dx = x - PATIO.x, dy = (y - PATIO.y) * 1.15; return Math.sqrt(dx * dx + dy * dy) + (ruido(x * 4, y * 4) - 0.5) * 1.6 < PATIO.r; };
  let g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    if (x >= rio(y) && x < rio(y) + 3) return 'sea';
    if (naCabana(x, y)) return 'darkest wooden floor';
    if (dentro(x, y) && (noPatio(x, y) || naTrilha(x, y))) return 'dirt';
    if (ESTRADA.includes(y)) return 'dirt';
    // a clareira (grama clara) em volta da paliçada, a mata (grama escura) no resto
    const dx = (x - 31.5) / 20, dy = (y - 23) / 17;
    return dx * dx + dy * dy + (ruido(x * 2, y * 2) - 0.5) * 0.3 < 1 ? 'grass' : 'grass (dark)';
  }));
  // o filtro de maioria (sem pontas nem buracos de uma casa) só na grama
  const V8 = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  const grama = (c) => c === 'grass' || c === 'grass (dark)';
  for (let it = 0; it < 3; it++) g = g.map((l, y) => l.map((c, x) => { if (!grama(c)) return c; const cont = {}; for (const [dx, dy] of V8) { const v = g[y + dy]?.[x + dx]; if (v && grama(v)) cont[v] = (cont[v] ?? 0) + 1; } const e = Object.entries(cont).sort((a, b) => b[1] - a[1])[0]; return e && e[1] >= 5 && e[0] !== c ? e[0] : c; }));

  const { pilhas, faltas } = M.pintar(g, { rng, existe });
  if (Object.keys(faltas).length) throw new Error(`Floresta: peças de borda sem sprite ${JSON.stringify(faltas)}`);

  // a PONTE: as tábuas por cima do riacho na estrada (o chão continua água), mais UMA casa sobre cada margem (sem ela, entre a terra da
  // estrada e a primeira tábua aparecia a borda da margem com a água — o dono: "aqui tá estranho")
  const PONTE = new Set();
  const TABUAS = M.PINCEIS.get('grimy wooden plank horizontal').itens;
  const xsDaAgua = [...Array(W).keys()].filter((x) => ESTRADA.some((y) => g[y][x] === 'sea'));
  const [px0, px1] = [Math.min(...xsDaAgua) - 1, Math.max(...xsDaAgua) + 1];
  for (const y of ESTRADA) for (let x = px0; x <= px1; x++) {
    PONTE.add(`${x},${y}`);
    pilhas[y * W + x] = [TABUAS[Math.floor(rng() * TABUAS.length)].id];
  }
  const cam = new O.Camada(W, H, existe);
  // o guarda-corpo (o pincel "bridge" do editor) nas duas bordas da ponte
  const CORRIMAO = O.PAREDES.get('bridge').tipos.horizontal.map((i) => i.id).find(existe);
  if (CORRIMAO) for (let x = px0; x <= px1; x++) for (const y of [ESTRADA[0] - 1, ESTRADA.at(-1) + 1]) cam.por(x, y, CORRIMAO);

  // ---- os MARCOS do jogo primeiro; o lugar dos NPCs, da chegada e dos portais fica livre
  const duras = porMarcos(cam, def.objetos ?? []);
  const reservado = new Set([def.chegada, ...(def.npcs ?? [])].map((p) => `${p.x},${p.y}`));
  for (const o of def.objetos ?? []) if (o.acao === 'aventuras' || o.acao === 'boss-diarios') reservado.add(`${o.x},${o.y}`);
  const pode = (x, y) => !reservado.has(`${x},${y}`) && !naTrilha(x, y);

  // ---- a PALIÇADA: a borda do contorno de cantos cortados, com os portões na estrada, e as tochas nos lados dos portões
  const toras = new Set();
  for (let y = PAL.y0; y <= PAL.y1; y++) for (let x = PAL.x0; x <= PAL.x1; x++) if (naPalicada(x, y) && !dentro(x, y) && !ESTRADA.includes(y)) toras.add(`${x},${y}`);
  O.porParede(cam, 'wooden wall', toras, rng);
  for (const x of [PAL.x0, PAL.x1]) for (const y of [ESTRADA[0] - 1, ESTRADA.at(-1) + 1]) O.porDoodad(cam, 'wall torch - lit', x, y, rng, { exigeLivre: false });

  // ---- as CABANAS: as paredes de madeira com a porta embaixo, e por dentro (a de Greust: o cofre, o barril, a pele, as armas; a de Eramir:
  // os livros, a cadeira, a cama); por fora, os chifres e o lobo pendurados
  for (const c of CABANAS) {
    const parede = new Set();
    for (let x = c.x0; x <= c.x1; x++) for (const y of [c.y0, c.y1]) parede.add(`${x},${y}`);
    for (let y = c.y0; y <= c.y1; y++) for (const x of [c.x0, c.x1]) parede.add(`${x},${y}`);
    for (const x of c.porta) parede.delete(`${x},${c.y1}`);
    O.porParede(cam, 'wooden wall', parede, rng);
    O.porDoodad(cam, 'wall torch - lit', c.porta[0] - 1, c.y1, rng, { exigeLivre: false });
  }
  const [GREUST, ERAMIR] = CABANAS;
  cam.por(GREUST.x0 + 2, GREUST.y0 + 1, 3497); // o COFRE do depósito
  for (const [n, x, y, alt] of [
    ['large cask', GREUST.x0 + 1, GREUST.y0 + 2, 0], ['wood pile', GREUST.x1 - 1, GREUST.y0 + 1, null], ['brown bear skin rug', GREUST.x0 + 3, GREUST.y0 + 3, 0], ['weapon rack', GREUST.x1 - 1, GREUST.y0 + 3, 0],
    ['elf bookcase', ERAMIR.x0 + 1, ERAMIR.y0 + 1, 0], ['elf bookcase', ERAMIR.x0 + 2, ERAMIR.y0 + 1, 0], ['wooden chair', ERAMIR.x1 - 2, ERAMIR.y0 + 2, 0], ['cot', ERAMIR.x1 - 1, ERAMIR.y0 + 3, 0],
  ]) O.porDoodad(cam, n, x, y, rng, { alt, pode });
  for (const [x, y] of [[GREUST.x0, GREUST.y0 + 3], [ERAMIR.x1, ERAMIR.y0 + 3]]) O.porDoodad(cam, 'deer antlers', x, y, rng, { exigeLivre: false });
  O.porDoodad(cam, 'hanging wolf', GREUST.x1, GREUST.y0 + 4, rng, { exigeLivre: false });

  // ---- o PÁTIO: a fogueira com os bancos, o poço; as TENDAS em arco ao sul; o LENHADOR (sudoeste); o TREINO (sudeste)
  O.porDoodad(cam, 'campfire', PATIO.x, PATIO.y - 1, rng, { alt: 2 });
  for (const [x, y, alt] of [[PATIO.x - 2, PATIO.y - 2, 1], [PATIO.x + 2, PATIO.y - 1, 1], [PATIO.x, PATIO.y - 3, 0], [PATIO.x - 1, PATIO.y + 1, 0]]) O.porDoodad(cam, 'bench', x, y, rng, { alt, pode });
  O.porDoodad(cam, 'water well', 38, 26, rng, { pode });
  for (const [x, y] of [[22, 31], [27, 34], [33, 35], [39, 34], [43, 31]]) O.porDoodad(cam, 'gray striped tent', x, y, rng, { pode });
  for (const [n, x, y, alt] of [
    ['wood pile', 19, 27, null], ['wood pile', 19, 28, null], ['wood pile', 20, 27, null], ['branch stump', 21, 29, null], ['stuck axe', 22, 28, null], ['lumberjack stuff', 20, 30, null], ['pieces of wood', 23, 29, null],
    ['archery target', 45, 26, 0], ['archery target', 45, 28, 0], ['rack weapons', 41, 27, 0], ['wolf hide', 29, 27, null], ['white caravan wagon', 18, 19, 0],
  ]) O.porDoodad(cam, n, x, y, rng, { alt, pode });
  const CAIXA = 2471, BARRIL = 2523;
  for (const [x, y, id] of [[24, 32, CAIXA], [25, 32, BARRIL], [30, 35, CAIXA], [36, 35, BARRIL], [41, 33, CAIXA], [44, 33, BARRIL], [19, 21, BARRIL], [19, 26, CAIXA]]) if (cam.livre(x, y) && pode(x, y)) cam.por(x, y, id);
  // a grama de dentro: flores e tufos
  for (let y = PAL.y0; y <= PAL.y1; y++) for (let x = PAL.x0; x <= PAL.x1; x++) {
    if (!dentro(x, y) || g[y][x] !== 'grass' || !cam.livre(x, y) || !pode(x, y)) continue;
    const r = rng();
    if (r < 0.06) O.porDoodad(cam, 'grass tufts', x, y, rng);
    else if (r < 0.09) O.porDoodad(cam, rng() < 0.5 ? 'flowers (yellow)' : 'sunflowers', x, y, rng);
  }

  // ---- a NATUREZA de fora: a mata fechada (árvores verdes e bétulas em manchas, uma ou outra seca), as samambaias e o mato do riacho;
  // sem árvore cobrindo a ponte nem a estrada
  const juntoDaPonte = (x, y) => x >= px0 - 1 && x <= px1 + 2 && y >= ESTRADA[0] - 2 && y <= ESTRADA.at(-1) + 3;
  const perto = (x, y, c) => [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => g[y + dy]?.[x + dx] === c);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!cam.livre(x, y) || naPalicada(x, y) || ESTRADA.includes(y) || PONTE.has(`${x},${y}`) || juntoDaPonte(x, y) || !pode(x, y)) continue;
    const c = g[y][x];
    if (c === 'sea') continue;
    // a faixa junto da paliçada e da estrada fica limpa (o "aceiro"), com mato baixo
    const aceiro = (x >= PAL.x0 - 2 && x <= PAL.x1 + 2 && y >= PAL.y0 - 2 && y <= PAL.y1 + 2) || ESTRADA.includes(y - 1) || ESTRADA.includes(y + 1);
    if (perto(x, y, 'sea') || aceiro) { if (rng() < 0.12) O.porDoodad(cam, perto(x, y, 'sea') ? 'swamp plants' : 'grass tufts', x, y, rng); continue; }
    const mancha = ruido(x * 3, y * 3, 8);
    const densa = c === 'grass (dark)' ? (mancha > 0.5 ? 0.62 : 0.42) : 0.08;
    if (rng() < densa) { O.porDoodad(cam, mancha > 0.62 ? 'birch trees' : rng() < 0.04 ? 'dead trees' : 'green trees', x, y, rng, { pode }); continue; }
    const r = rng();
    if (r < 0.06) O.porDoodad(cam, 'jungle fern', x, y, rng);
    else if (r < 0.12) O.porDoodad(cam, 'grass tufts', x, y, rng);
    else if (r < 0.14) O.porDoodad(cam, 'mossy rocks (small)', x, y, rng);
  }

  // ---- o BLOQUEIO: o chão que bloqueia (a água), os marcos de pé, as peças de pé; não bloqueiam tapete, pele, tufo, flor, samambaia,
  // planta do riacho, pedrinha, tocha de parede, lenha no chão e o toco com o machado
  const SOLTOS = new Set(['grass tufts', 'flowers (yellow)', 'sunflowers', 'swamp plants', 'jungle fern', 'mossy rocks (small)', 'brown bear skin rug', 'wolf hide', 'wall torch - lit', 'lumberjack stuff', 'pieces of wood', 'branch stump', 'stuck axe']
    .flatMap((n) => O.DOODADS.get(n).alternativas.flatMap((a) => [...a.soltos.map((s) => s.id), ...a.compostos.flatMap((cc) => cc.casas.flatMap((t) => t.itens))])));
  SOLTOS.add(25056); // o portal: pisa-se nele
  const blocked = pilhas.map((p, i) => {
    const x = i % W, y = Math.floor(i / W);
    if (PONTE.has(`${x},${y}`)) return 0;
    const ob = cam.em(x, y);
    return duras.has(`${x},${y}`) || bloqueia(p[0]) || ob.some((id) => !SOLTOS.has(id)) ? 1 : 0;
  });
  const todas = pilhas.map((p, i) => [...p, ...cam.em(i % W, Math.floor(i / W))]);
  return { W, H, pilhas: todas, blocked, grade: g };
}
