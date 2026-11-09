// HIGHGATE (Ato 4, e o 9, que o PoE repete): a vila de pedra num platô entre as montanhas, em cima das minas. Os paredões de rocha
// fecham o mapa (a passagem a oeste é a estrada que chega); no paredão do norte, a entrada da mina com o andaime de madeira e o entulho
// da escavação; no platô de terra empoeirada, as casas de pedra em volta da praça, as trilhas, os braseiros e as rochas que rolaram.
// Os pontos do jogo (a chegada, os NPCs, os marcos) vêm de `cidades.json` (`def`).
import * as M from './motor.mjs';
import * as O from './objetos.mjs';
import { existe, bloqueia } from './sprites.mjs';
import { sorteio, ruidoSuave, porMarcos } from './comum.mjs';

export const W = 64, H = 48;

export function gerar(def, semente = 41) {
  const rng = sorteio(semente);
  const ruido = ruidoSuave(rng, W, H);

  // ---- a PLANTA: as montanhas na borda (a orla ondulada), a passagem a oeste, o platô; a praça e as trilhas
  const PASSAGEM = [22, 23, 24]; // a estrada que chega pelo oeste (y)
  const PRACA = { x: 33, y: 25, rx: 9, ry: 7 };
  const MINA = { x: 32, y: 6 }; // a boca da mina no paredão norte
  const borda = (x, y) => Math.min(x, y, W - 1 - x, H - 1 - y);
  const montanha = (x, y) => {
    if (PASSAGEM.includes(y) && x < 20) return false;
    if (x >= MINA.x - 3 && x <= MINA.x + 3 && y >= MINA.y && y <= 11) return false; // o recorte do pátio da mina
    return borda(x, y) < 2.5 + (ruido(x * 2, y * 2) - 0.5) * 4 + (y < 9 ? 2.5 : 0);
  };
  const naPraca = (x, y) => ((x - PRACA.x) / PRACA.rx) ** 2 + ((y - PRACA.y) / PRACA.ry) ** 2 + (ruido(x * 4, y * 4) - 0.5) * 0.3 < 1;
  // as trilhas (2 de largura): da passagem à praça, e da praça à mina
  const naTrilha = (x, y) => (PASSAGEM.slice(0, 2).includes(y) && x <= PRACA.x) || ((x === MINA.x || x === MINA.x + 1) && y >= MINA.y + 1 && y <= PRACA.y);
  const CASAS = [
    { x0: 13, y0: 9, x1: 21, y1: 15 }, { x0: 43, y0: 10, x1: 51, y1: 16 },
    { x0: 12, y0: 30, x1: 20, y1: 37 }, { x0: 26, y0: 35, x1: 33, y1: 41 }, { x0: 44, y0: 32, x1: 53, y1: 39 },
  ].map((c) => ({ ...c, porta: [Math.floor((c.x0 + c.x1) / 2), Math.floor((c.x0 + c.x1) / 2) + 1] }));
  const naCasa = (x, y) => CASAS.find((c) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1);
  let g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    if (montanha(x, y)) return 'mountain';
    if (naCasa(x, y)) return 'drab tiled stone floor';
    if (naPraca(x, y)) return 'rock soil';
    if (naTrilha(x, y)) return 'dirt';
    return ruido(x * 3, y * 3) > 0.6 ? 'rocky ground' : 'brown sand';
  }));
  // o filtro (sem pontas nem buracos de uma casa) na montanha e no chão solto
  const V8 = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  const solto = (c) => c === 'mountain' || c === 'rocky ground' || c === 'brown sand';
  for (let it = 0; it < 3; it++) g = g.map((l, y) => l.map((c, x) => { if (!solto(c) || naTrilha(x, y)) return c; const cont = {}; for (const [dx, dy] of V8) { const v = g[y + dy]?.[x + dx]; if (v && solto(v)) cont[v] = (cont[v] ?? 0) + 1; } const e = Object.entries(cont).sort((a, b) => b[1] - a[1])[0]; return e && e[1] >= 5 && e[0] !== c ? e[0] : c; }));

  const { pilhas, faltas } = M.pintar(g, { rng, existe });
  if (Object.keys(faltas).length) throw new Error(`Highgate: peças de borda sem sprite ${JSON.stringify(faltas)}`);
  const cam = new O.Camada(W, H, existe);

  // ---- os MARCOS do jogo primeiro; o lugar dos NPCs, da chegada e dos portais fica livre (e as trilhas)
  const duras = porMarcos(cam, def.objetos ?? []);
  const reservado = new Set([def.chegada, ...(def.npcs ?? [])].map((p) => `${p.x},${p.y}`));
  for (const o of def.objetos ?? []) if (o.acao === 'aventuras' || o.acao === 'boss-diarios') reservado.add(`${o.x},${o.y}`);
  const pode = (x, y) => !reservado.has(`${x},${y}`) && !naTrilha(x, y);

  // ---- a MINA: a boca no paredão, o andaime de madeira (as tábuas e os barrotes) e o entulho da escavação
  for (const x of [MINA.x, MINA.x + 1]) O.porDoodad(cam, 'cave enter2', x, MINA.y, rng, { exigeLivre: false, alt: 0 }); // a boca com as vigas de madeira
  O.porDoodad(cam, 'street sign', MINA.x + 2, MINA.y + 1, rng, { pode });
  for (const [n, x, y, alt] of [['leaning planks', MINA.x - 2, MINA.y + 2, 0], ['planks', MINA.x + 3, MINA.y + 2, 0], ['pallet', MINA.x - 3, MINA.y + 4, 0], ['wood pile', MINA.x + 3, MINA.y + 4, null], ['sandy rock pile', MINA.x - 2, MINA.y + 4, null], ['stones pile', MINA.x + 2, MINA.y + 5, null], ['coal basin (immovable)', MINA.x - 1, MINA.y + 3, 1], ['coal basin (immovable)', MINA.x + 2, MINA.y + 3, 1]]) O.porDoodad(cam, n, x, y, rng, { alt, pode });

  // ---- as CASAS de pedra: as paredes com a porta para a praça, a tocha ao lado da porta, e por dentro uma ou outra coisa
  for (const c of CASAS) {
    const parede = new Set();
    for (let x = c.x0; x <= c.x1; x++) for (const y of [c.y0, c.y1]) parede.add(`${x},${y}`);
    for (let y = c.y0; y <= c.y1; y++) for (const x of [c.x0, c.x1]) parede.add(`${x},${y}`);
    const yPorta = c.y1 < PRACA.y ? c.y1 : c.y0;
    for (const x of c.porta) parede.delete(`${x},${yPorta}`);
    O.porParede(cam, 'stone wall', parede, rng);
    O.porDoodad(cam, 'wall torch - lit', c.porta[0] - 1, yPorta, rng, { exigeLivre: false });
    for (const [n, dx, dy, alt] of [['large cask', 1, 1, 0], ['pallet', c.x1 - c.x0 - 2, 1, 0], ['wooden chair', 2, c.y1 - c.y0 - 2, 0], ['cot', c.x1 - c.x0 - 1, c.y1 - c.y0 - 2, 0]]) if (rng() < 0.75) O.porDoodad(cam, n, c.x0 + dx, c.y0 + dy, rng, { alt, pode });
  }

  // ---- a PRAÇA: os braseiros em roda, as tendas dos que chegaram das minas, os bancos, as caixas e os barris, a carroça, as bandeiras
  for (let k = 0; k < 6; k++) { const a = ((k + 0.5) / 6) * Math.PI * 2; O.porDoodad(cam, 'coal basin (immovable)', Math.round(PRACA.x + Math.cos(a) * (PRACA.rx - 1.5)), Math.round(PRACA.y + Math.sin(a) * (PRACA.ry - 1.5)), rng, { pode, alt: 1 }); }
  for (const [x, y] of [[27, 20], [39, 20], [40, 29]]) O.porDoodad(cam, 'gray striped tent', x, y, rng, { pode });
  for (const [x, y, alt] of [[31, 23, 0], [31, 28, 0]]) O.porDoodad(cam, 'bench', x, y, rng, { alt, pode });
  for (const [n, x, y, alt] of [['white caravan wagon', 25, 28, 0], ['new blue banner', 29, 19, null], ['new blue banner', 37, 19, null], ['street sign', 21, 21, null], ['weapon rack', 38, 31, 0]]) O.porDoodad(cam, n, x, y, rng, { alt, pode });
  const CAIXA = 2471, BARRIL = 2523;
  for (const [x, y, id] of [[28, 22, CAIXA], [29, 22, BARRIL], [41, 22, CAIXA], [41, 23, BARRIL], [27, 30, CAIXA], [36, 31, BARRIL]]) if (cam.livre(x, y) && pode(x, y)) cam.por(x, y, id);
  // o COFRE do depósito, ao lado de Tasuni
  cam.por(36, 21, 3497);

  // ---- a MONTANHA por dentro: as pedras pontudas e as rochas grandes (sem elas o miolo era um cinza liso), mais na beira do paredão
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== 'mountain' || !cam.livre(x, y)) continue;
    const r = rng();
    if (r < 0.09) O.porDoodad(cam, rng() < 0.5 ? 'stone 1 (4 SQMS)' : 'stone 4 (4 SQMS)', x, y, rng);
    else if (r < 0.12) O.porDoodad(cam, 'rocks (stone cave)', x, y, rng);
  }

  // ---- o PLATÔ: as rochas que rolaram da montanha, o cascalho, uma ou outra árvore seca; mais perto do paredão
  const pertoDaMontanha = (x, y) => V8.some(([dx, dy]) => g[y + dy]?.[x + dx] === 'mountain');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = g[y][x];
    if ((c !== 'brown sand' && c !== 'rocky ground') || !cam.livre(x, y) || !pode(x, y) || PASSAGEM.includes(y)) continue;
    const r = rng();
    const fator = pertoDaMontanha(x, y) ? 2.5 : 1;
    if (r < 0.03 * fator) O.porDoodad(cam, rng() < 0.5 ? 'gray rocks' : 'brown rocks', x, y, rng, { pode });
    else if (r < 0.05 * fator) O.porDoodad(cam, 'stone rocks (medium)', x, y, rng, { pode });
    else if (r < 0.065 * fator) O.porDoodad(cam, 'rocks (small)', x, y, rng);
    else if (r < 0.07 * fator) O.porDoodad(cam, 'dead trees', x, y, rng, { pode });
    else if (r < 0.09 * fator) O.porDoodad(cam, 'dry grass tufts', x, y, rng);
  }

  // ---- o BLOQUEIO: a montanha (pelo chão dos mapas capturados), os marcos de pé, as peças de pé; não bloqueiam o cascalho, o mato seco,
  // a tocha de parede, a boca da mina (por onde se olha, não se entra) e o portal
  const SOLTOS = new Set(['rocks (small)', 'dry grass tufts', 'wall torch - lit']
    .flatMap((n) => O.DOODADS.get(n).alternativas.flatMap((a) => [...a.soltos.map((s) => s.id), ...a.compostos.flatMap((cc) => cc.casas.flatMap((t) => t.itens))])));
  SOLTOS.add(25056);
  const blocked = pilhas.map((p, i) => {
    const x = i % W, y = Math.floor(i / W);
    const ob = cam.em(x, y);
    return duras.has(`${x},${y}`) || g[y][x] === 'mountain' || bloqueia(p[0]) || ob.some((id) => !SOLTOS.has(id)) ? 1 : 0;
  });
  const todas = pilhas.map((p, i) => [...p, ...cam.em(i % W, Math.floor(i / W))]);
  return { W, H, pilhas: todas, blocked, grade: g };
}
