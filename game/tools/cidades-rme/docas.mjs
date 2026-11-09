// AS DOCAS DE ORIATH (Ato 10): o porto da cidade, com Oriath em chamas atrás. Ao sul, o mar com os três píeres de tábuas mar adentro e
// os barcos amarrados; o cais de lajes ao longo da água; no meio, o largo do porto (o acampamento dos que fugiram: as tendas, as pilhas
// de carga, os braseiros); ao norte, as ruas de pedra e os armazéns de madeira — alguns ainda queimando. Os pontos do jogo vêm de
// `cidades.json` (`def`).
import * as M from './motor.mjs';
import * as O from './objetos.mjs';
import { existe, bloqueia } from './sprites.mjs';
import { sorteio, ruidoSuave, porMarcos } from './comum.mjs';

export const W = 64, H = 48;

export function gerar(def, semente = 101) {
  const rng = sorteio(semente);
  const ruido = ruidoSuave(rng, W, H);

  // ---- a PLANTA
  const MAR = 30; // a linha do mar (y): o cais acaba aqui
  const LARGO = { x0: 18, y0: 14, x1: 46, y1: 27 };
  const PIERES = [[10, 11, 12], [30, 31, 32], [50, 51, 52]]; // as colunas de cada píer (x)
  const FIM_DO_PIER = 41;
  const ARMAZENS = [
    { x0: 2, y0: 2, x1: 11, y1: 9, fogo: true }, { x0: 15, y0: 3, x1: 24, y1: 9 }, { x0: 39, y0: 3, x1: 48, y1: 9, fogo: true }, { x0: 52, y0: 2, x1: 61, y1: 10 },
    { x0: 2, y0: 15, x1: 10, y1: 22 }, { x0: 52, y0: 15, x1: 61, y1: 22, fogo: true },
  ].map((a) => ({ ...a, porta: [Math.floor((a.x0 + a.x1) / 2), Math.floor((a.x0 + a.x1) / 2) + 1] }));
  const noLargo = (x, y) => x >= LARGO.x0 && x <= LARGO.x1 && y >= LARGO.y0 && y <= LARGO.y1;
  const noArmazem = (x, y) => ARMAZENS.find((a) => x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1);
  const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    if (y >= MAR) return 'sea';
    if (noArmazem(x, y)) return 'darkest wooden floor';
    if (noLargo(x, y) || y >= MAR - 3) return 'gray stone tiles'; // o largo e o cais
    return 'cobblestone';
  }));

  const { pilhas, faltas } = M.pintar(g, { rng, existe });
  if (Object.keys(faltas).length) throw new Error(`Docas: peças de borda sem sprite ${JSON.stringify(faltas)}`);

  // os PÍERES: as tábuas por cima do mar (o chão continua mar: a beira do cais fica inteira), da beira do cais até o fim
  const PIER = new Set();
  const TABUAS = M.PINCEIS.get('grimy wooden plank vertical').itens;
  for (const xs of PIERES) for (const x of xs) for (let y = MAR - 1; y <= FIM_DO_PIER; y++) {
    PIER.add(`${x},${y}`);
    pilhas[y * W + x] = [TABUAS[Math.floor(rng() * TABUAS.length)].id];
  }
  const cam = new O.Camada(W, H, existe);

  // ---- os MARCOS do jogo primeiro; o lugar dos NPCs, da chegada e dos portais fica livre
  const duras = porMarcos(cam, def.objetos ?? []);
  const reservado = new Set([def.chegada, ...(def.npcs ?? [])].map((p) => `${p.x},${p.y}`));
  for (const o of def.objetos ?? []) if (o.acao === 'aventuras' || o.acao === 'boss-diarios') reservado.add(`${o.x},${o.y}`);
  const pode = (x, y) => !reservado.has(`${x},${y}`) && !PIER.has(`${x},${y}`);

  // ---- os ARMAZÉNS: as paredes de madeira com a porta para a rua, por dentro a carga (caixas, barris, pallets); os que queimam, com o
  // fogo e o entulho no lugar de parte da parede
  for (const a of ARMAZENS) {
    const parede = new Set();
    for (let x = a.x0; x <= a.x1; x++) for (const y of [a.y0, a.y1]) parede.add(`${x},${y}`);
    for (let y = a.y0; y <= a.y1; y++) for (const x of [a.x0, a.x1]) parede.add(`${x},${y}`);
    for (const x of a.porta) parede.delete(`${x},${a.y1}`);
    if (a.fogo) for (const k of [...parede]) { const [x, y] = k.split(',').map(Number); if (ruido(x * 6, y * 6) > 0.62 && !((x === a.x0 || x === a.x1) && (y === a.y0 || y === a.y1))) parede.delete(k); }
    O.porParede(cam, 'wooden wall', parede, rng);
    O.porDoodad(cam, 'wall torch - lit', a.porta[0] - 1, a.y1, rng, { exigeLivre: false });
    for (let y = a.y0 + 1; y < a.y1; y++) for (let x = a.x0 + 1; x < a.x1; x++) {
      if (!cam.livre(x, y) || !pode(x, y) || a.porta.includes(x)) continue;
      const r = rng();
      if (a.fogo && r < 0.12) O.porDoodad(cam, 'fire field (decaying)', x, y, rng);
      else if (a.fogo && r < 0.22) O.porDoodad(cam, rng() < 0.5 ? 'debris (medium)' : 'pieces of wood', x, y, rng);
      else if (!a.fogo && r < 0.12) cam.por(x, y, rng() < 0.5 ? 2471 : 2523);
      else if (!a.fogo && r < 0.16) O.porDoodad(cam, 'pallet', x, y, rng, { pode, alt: 0 });
      else if (!a.fogo && r < 0.18) O.porDoodad(cam, 'large cask', x, y, rng, { pode, alt: 0 });
    }
  }

  // ---- o LARGO: as tendas dos que fugiram, os braseiros, as pilhas de carga, a carroça, as bandeiras; o chafariz no meio
  O.porDoodad(cam, 'golden fountain', 32, 20, rng, { pode });
  for (const [x, y] of [[21, 16], [25, 15], [40, 15], [44, 17], [21, 26], [44, 26]]) O.porDoodad(cam, 'gray striped tent', x, y, rng, { pode });
  for (const [x, y] of [[LARGO.x0 + 1, LARGO.y0], [LARGO.x1 - 1, LARGO.y0], [LARGO.x0 + 1, LARGO.y1], [LARGO.x1 - 1, LARGO.y1], [28, 23], [36, 23]]) O.porDoodad(cam, 'coal basin (immovable)', x, y, rng, { pode, alt: 1 });
  for (const [n, x, y, alt] of [['white caravan wagon', 25, 24, 0], ['bench', 30, 24, 0], ['bench', 33, 24, 0], ['new blue banner', 30, LARGO.y0, null], ['new blue banner', 34, LARGO.y0, null], ['street sign', 17, 20, null]]) O.porDoodad(cam, n, x, y, rng, { alt, pode });
  // as pilhas de carga no cais (caixas e barris em blocos), entre os píeres
  const CAIXA = 2471, BARRIL = 2523;
  for (const [x0, y0] of [[4, 27], [18, 27], [24, 27], [38, 27], [44, 27], [57, 27]]) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 3; dx++) if (cam.livre(x0 + dx, y0 + dy) && pode(x0 + dx, y0 + dy) && rng() < 0.8) cam.por(x0 + dx, y0 + dy, rng() < 0.6 ? CAIXA : BARRIL);
  // o COFRE do depósito, ao lado de Bannon
  cam.por(37, 18, 3497);

  // ---- os BARCOS amarrados nos píeres, e as cordas (os postes) na ponta
  for (const xs of PIERES) {
    O.porMesa(cam, 'small boat', xs[0] - 2, MAR + 2, 4, 'vertical', rng);
    O.porMesa(cam, 'small boat', xs.at(-1) + 2, MAR + 5, 4, 'vertical', rng);
  }

  // ---- a RUA: o lixo e o entulho que a fuga deixou (solto)
  for (let y = 0; y < MAR - 3; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== 'cobblestone' || !cam.livre(x, y) || !pode(x, y)) continue;
    const r = rng();
    if (r < 0.03) O.porDoodad(cam, 'debris (small)', x, y, rng);
    else if (r < 0.045) O.porDoodad(cam, 'rubbish', x, y, rng);
  }

  // ---- o BLOQUEIO: o mar (fora os píeres), os marcos de pé, as peças de pé; não bloqueiam o entulho miúdo, o lixo, o fogo (que se
  // atravessa queimando) e a tocha de parede
  const SOLTOS = new Set(['debris (small)', 'debris (medium)', 'pieces of wood', 'rubbish', 'wall torch - lit', 'fire field (decaying)']
    .flatMap((n) => O.DOODADS.get(n).alternativas.flatMap((a) => [...a.soltos.map((s) => s.id), ...a.compostos.flatMap((cc) => cc.casas.flatMap((t) => t.itens))])));
  SOLTOS.add(25056);
  const blocked = pilhas.map((p, i) => {
    const x = i % W, y = Math.floor(i / W);
    const ob = cam.em(x, y);
    if (PIER.has(`${x},${y}`)) return ob.some((id) => !SOLTOS.has(id)) ? 1 : 0;
    return duras.has(`${x},${y}`) || bloqueia(p[0]) || ob.some((id) => !SOLTOS.has(id)) ? 1 : 0;
  });
  const todas = pilhas.map((p, i) => [...p, ...cam.em(i % W, Math.floor(i / W))]);
  return { W, H, pilhas: todas, blocked, grade: g };
}
