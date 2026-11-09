// A TORRE DO SUPERVISOR (Ato 5): o pátio nobre de Oriath ao pé da torre, onde os exilados acampam depois da fuga das celas. O muro de
// alabastro fecha o pátio de mármore (os portões ao sul, a oeste e a leste); no meio, o anel de mármore azul com o chafariz dourado; nos
// cantos, os canteiros com a cerca viva, as bétulas e as flores; ao norte, a torre de pedra ornamentada com o mármore negro por dentro (as
// estátuas, os livros, as lâmpadas); fora, a grama e as árvores, e a estrada de lajes que chega pelo sul. Os pontos do jogo vêm de
// `cidades.json` (`def`).
import * as M from './motor.mjs';
import * as O from './objetos.mjs';
import { existe, bloqueia } from './sprites.mjs';
import { sorteio, ruidoSuave, porMarcos } from './comum.mjs';

export const W = 64, H = 48;

export function gerar(def, semente = 53) {
  const rng = sorteio(semente);
  const ruido = ruidoSuave(rng, W, H);

  // ---- a PLANTA
  const PATIO = { x0: 15, y0: 15, x1: 48, y1: 41 };
  const PORTOES = { sul: [31, 32], oeste: [27, 28], leste: [27, 28] };
  const TORRE = { x0: 36, y0: 3, x1: 47, y1: 15, porta: [41, 42] };
  const ANEL = { x: 31.5, y: 28 };
  const CANTEIROS = [
    { x0: 18, y0: 18, x1: 24, y1: 22 }, { x0: 18, y0: 34, x1: 24, y1: 38 }, { x0: 39, y0: 34, x1: 45, y1: 38 }, { x0: 18, y0: 26, x1: 21, y1: 30 },
  ];
  const noPatio = (x, y) => x > PATIO.x0 && x < PATIO.x1 && y > PATIO.y0 && y < PATIO.y1;
  const naTorre = (x, y) => x > TORRE.x0 && x < TORRE.x1 && y > TORRE.y0 && y < TORRE.y1;
  // o anel: um octógono (o quadrado de lado 10 com os cantos cortados em 3) — o círculo saía em degraus
  const noAnel = (x, y) => { const dx = Math.abs(x - ANEL.x), dy = Math.abs(y - ANEL.y); return dx <= 5 && dy <= 5 && dx + dy <= 7.5; };
  const noCanteiro = (x, y) => CANTEIROS.some((c) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1);
  const naEstrada = (x, y) => PORTOES.sul.includes(x) && y >= PATIO.y1;
  const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    if (naTorre(x, y)) return 'black marble floor';
    if (noPatio(x, y)) return noCanteiro(x, y) ? 'grass' : noAnel(x, y) ? 'blue marble floor' : 'white marble floor';
    if (naEstrada(x, y) || ((PORTOES.oeste.includes(y)) && x <= PATIO.x0) || (PORTOES.leste.includes(y) && x >= PATIO.x1)) return 'new grass pavement';
    return 'grass';
  }));

  const { pilhas, faltas } = M.pintar(g, { rng, existe });
  if (Object.keys(faltas).length) throw new Error(`Torre: peças de borda sem sprite ${JSON.stringify(faltas)}`);
  const cam = new O.Camada(W, H, existe);

  // ---- os MARCOS do jogo primeiro; o lugar dos NPCs, da chegada e dos portais fica livre
  const duras = porMarcos(cam, def.objetos ?? []);
  const reservado = new Set([def.chegada, ...(def.npcs ?? [])].map((p) => `${p.x},${p.y}`));
  for (const o of def.objetos ?? []) if (o.acao === 'aventuras' || o.acao === 'boss-diarios') reservado.add(`${o.x},${o.y}`);
  const pode = (x, y) => !reservado.has(`${x},${y}`);

  // ---- o MURO de alabastro do pátio (os três portões), com as lâmpadas nos lados dos portões
  const muro = new Set();
  for (let x = PATIO.x0; x <= PATIO.x1; x++) for (const y of [PATIO.y0, PATIO.y1]) muro.add(`${x},${y}`);
  for (let y = PATIO.y0; y <= PATIO.y1; y++) for (const x of [PATIO.x0, PATIO.x1]) muro.add(`${x},${y}`);
  for (const x of PORTOES.sul) muro.delete(`${x},${PATIO.y1}`);
  for (const y of PORTOES.oeste) muro.delete(`${PATIO.x0},${y}`);
  for (const y of PORTOES.leste) muro.delete(`${PATIO.x1},${y}`);
  for (let x = TORRE.x0; x <= TORRE.x1; x++) muro.delete(`${x},${PATIO.y0}`); // a torre fecha o muro ali
  O.porParede(cam, 'alabaster wall', muro, rng);
  for (const [x, y] of [[PORTOES.sul[0] - 1, PATIO.y1], [PORTOES.sul.at(-1) + 1, PATIO.y1], [PATIO.x0, PORTOES.oeste[0] - 1], [PATIO.x0, PORTOES.oeste.at(-1) + 1], [PATIO.x1, PORTOES.leste[0] - 1], [PATIO.x1, PORTOES.leste.at(-1) + 1]]) O.porDoodad(cam, 'wall torch - lit', x, y, rng, { exigeLivre: false });

  // ---- a TORRE: a parede ornamentada (a porta para o pátio), por dentro o mármore negro com a deusa, os livros e as lâmpadas
  const parede = new Set();
  for (let x = TORRE.x0; x <= TORRE.x1; x++) for (const y of [TORRE.y0, TORRE.y1]) parede.add(`${x},${y}`);
  for (let y = TORRE.y0; y <= TORRE.y1; y++) for (const x of [TORRE.x0, TORRE.x1]) parede.add(`${x},${y}`);
  for (const x of TORRE.porta) parede.delete(`${x},${TORRE.y1}`);
  O.porParede(cam, 'ornamented wall', parede, rng);
  for (const [n, x, y, alt] of [['king statue', 40, 13, 0], ['king statue', 43, 13, 0], ['great wall lamp', 37, 8, 0], ['great wall lamp', 46, 8, 0], ['goddess statue', 41, 6, 0], ['elf bookcase', 38, 5, 0], ['elf bookcase', 39, 5, 0], ['elf bookcase', 44, 5, 0], ['elf bookcase', 45, 5, 0], ['sun coal basin 1', 38, 9, 0], ['sun coal basin 1', 45, 9, 0], ['new green banner', 40, 4, null], ['new green banner', 43, 4, null], ['brown bear skin rug', 41, 10, 0]]) O.porDoodad(cam, n, x, y, rng, { alt, pode, exigeLivre: n !== 'new green banner' });

  // ---- o PÁTIO: o chafariz dourado no anel; os canteiros com a cerca viva e as bétulas; as estátuas, os braseiros, as bandeiras; o
  // acampamento dos exilados (as tendas, as caixas) no lado oeste
  O.porDoodad(cam, 'golden fountain', 32, 28, rng, { pode });
  for (const c of CANTEIROS) {
    const cerca = new Set();
    for (let x = c.x0; x <= c.x1; x++) for (const y of [c.y0, c.y1]) cerca.add(`${x},${y}`);
    for (let y = c.y0; y <= c.y1; y++) for (const x of [c.x0, c.x1]) cerca.add(`${x},${y}`);
    O.porParede(cam, 'plant wall2', cerca, rng);
    for (let y = c.y0 + 1; y < c.y1; y++) for (let x = c.x0 + 1; x < c.x1; x++) {
      if (!cam.livre(x, y)) continue;
      const r = rng();
      if (r < 0.2) O.porDoodad(cam, 'birch trees', x, y, rng);
      else if (r < 0.55) O.porDoodad(cam, rng() < 0.5 ? 'flowers (yellow)' : 'sunflowers', x, y, rng);
    }
  }
  for (const [n, x, y, alt] of [['king statue', 26, 24, 0], ['king statue', 37, 24, 0], ['female statue with flame', 26, 32, 0], ['female statue with flame', 37, 32, 0],
    ['sun coal basin 1', 29, 18, 0], ['sun coal basin 1', 34, 18, 0], ['sun coal basin 1', 29, 38, 0], ['sun coal basin 1', 34, 38, 0],
    ['new green banner', 22, PATIO.y0, null], ['new green banner', 28, PATIO.y0, null], ['bench', 27, 28, 1], ['bench', 36, 28, 1]]) O.porDoodad(cam, n, x, y, rng, { alt, pode, exigeLivre: n !== 'new green banner' });
  for (const [x, y] of [[44, 19], [44, 23]]) O.porDoodad(cam, 'gray striped tent', x, y, rng, { pode });
  // a ALAMEDA do anel até a porta da torre: as estátuas com a chama e os braseiros dos dois lados
  for (const y of [17, 21]) for (const x of [TORRE.porta[0] - 2, TORRE.porta.at(-1) + 2]) O.porDoodad(cam, y === 17 ? 'female statue with flame' : 'sun coal basin 1', x, y, rng, { pode, alt: 0 });
  // os bancos e as estátuas na beira do anel, e os vasos de flores nos cantos do pátio
  for (const [n, x, y, alt] of [['bench', 31, 22, 0], ['bench', 31, 35, 0], ['amazon statue', 17, 17, 0], ['amazon statue', 46, 39, 0], ['amazon statue', 17, 39, 0]]) O.porDoodad(cam, n, x, y, rng, { alt, pode });
  const CAIXA = 2471, BARRIL = 2523;
  for (const [x, y, id] of [[42, 20, CAIXA], [42, 21, BARRIL], [46, 26, CAIXA], [46, 30, BARRIL], [17, 31, CAIXA], [17, 32, BARRIL]]) if (cam.livre(x, y) && pode(x, y)) cam.por(x, y, id);
  // o COFRE do depósito, ao lado de Bannon
  cam.por(37, 27, 3497);

  // ---- FORA: a grama com as árvores (mais densas longe do muro), os tufos e as flores; a estrada de lajes limpa
  const longe = (x, y) => x < PATIO.x0 - 2 || x > PATIO.x1 + 2 || y < PATIO.y0 - 2 || y > PATIO.y1 + 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== 'grass' || noPatio(x, y) || !cam.livre(x, y) || !pode(x, y) || (x >= TORRE.x0 - 1 && x <= TORRE.x1 + 1 && y <= TORRE.y1 + 1)) continue;
    const r = rng();
    const mancha = ruido(x * 3, y * 3, 8);
    if (longe(x, y) && r < (mancha > 0.55 ? 0.35 : 0.08)) O.porDoodad(cam, mancha > 0.7 ? 'birch trees' : 'green trees', x, y, rng, { pode });
    else if (r < 0.45 && rng() < 0.12) O.porDoodad(cam, 'grass tufts', x, y, rng);
    else if (r < 0.5 && rng() < 0.08) O.porDoodad(cam, 'flowers (yellow)', x, y, rng);
  }

  // ---- o BLOQUEIO: os marcos de pé, as peças de pé; não bloqueiam as flores, os tufos, o tapete, a tocha de parede, o portal
  const SOLTOS = new Set(['grass tufts', 'flowers (yellow)', 'sunflowers', 'brown bear skin rug', 'wall torch - lit']
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
