// O ACAMPAMENTO DE SARN (Ato 3, e o 8, que o PoE repete): os sobreviventes acampados na praça de uma cidade em ruínas, ao lado de um dos
// canais de Sarn. O canal corta a cidade de leste a oeste, com duas pontes de tábuas; ao sul dele, a praça de lajes (o
// chafariz, as barracas de pano, as tendas, a carroça, os braseiros); em volta, as ruas de pedra com mato nas frestas e os
// quarteirões arruinados — casas de tamanhos e formas diferentes (algumas em L), as paredes quebradas, o chão de pedra ou de lajotas com
// musgo, os restos da casa por dentro; as que desabaram, cheias de entulho. Os pontos do jogo vêm de `cidades.json` (`def`).
import * as M from './motor.mjs';
import * as O from './objetos.mjs';
import { existe, bloqueia } from './sprites.mjs';
import { sorteio, ruidoSuave, porMarcos } from './comum.mjs';

export const W = 64, H = 48;

export function gerar(def, semente = 31) {
  const rng = sorteio(semente);
  const ruido = ruidoSuave(rng, W, H);

  // ---- a PLANTA
  const CANAL = [10, 11, 12]; // as linhas do canal (y)
  const PONTES = [[16, 17], [46, 47]]; // as colunas das duas pontes (x)
  const PRACA = { x0: 20, y0: 17, x1: 43, y1: 35 };
  // os quarteirões: retângulos (e os em L: dois retângulos da mesma casa), o chão de cada um e se desabou
  const CASAS = [
    [[2, 1, 12, 8]], [[21, 2, 29, 8], [26, 2, 33, 5]], [[36, 1, 43, 8]], [[51, 2, 61, 8], [56, 2, 61, 6]],
    [[2, 16, 13, 23]], [[2, 27, 9, 34], [2, 27, 14, 30]], [[49, 16, 61, 22]], [[51, 26, 61, 33]],
    [[2, 38, 12, 46]], [[17, 39, 27, 46]], [[31, 39, 38, 46], [31, 42, 44, 46]], [[48, 37, 61, 46]],
  ].map((partes) => ({ partes, chao: rng() < 0.5 ? 'dark pavement' : 'stone floor2', desabou: rng() < 0.3 }));
  const naPraca = (x, y) => x >= PRACA.x0 && x <= PRACA.x1 && y >= PRACA.y0 && y <= PRACA.y1;
  const casaDe = (x, y) => CASAS.find((c) => c.partes.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1));
  const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    if (CANAL.includes(y)) return 'sea';
    if (naPraca(x, y)) return 'oramond pavement';
    const c = casaDe(x, y);
    if (c) return c.chao;
    return 'cobblestone';
  }));

  const { pilhas, faltas } = M.pintar(g, { rng, existe });
  if (Object.keys(faltas).length) throw new Error(`Sarn: peças de borda sem sprite ${JSON.stringify(faltas)}`);

  // as PONTES: tábuas por cima do canal (o chão continua água: as margens ficam inteiras), uma casa sobre cada margem
  const PONTE = new Set();
  const TABUAS = M.PINCEIS.get('grimy wooden plank vertical').itens;
  for (const xs of PONTES) for (const x of xs) for (let y = CANAL[0] - 1; y <= CANAL.at(-1) + 1; y++) {
    PONTE.add(`${x},${y}`);
    pilhas[y * W + x] = [TABUAS[Math.floor(rng() * TABUAS.length)].id];
  }
  const cam = new O.Camada(W, H, existe);

  // ---- os MARCOS do jogo primeiro; o lugar dos NPCs, da chegada e dos portais fica livre
  const duras = porMarcos(cam, def.objetos ?? []);
  const reservado = new Set([def.chegada, ...(def.npcs ?? [])].map((p) => `${p.x},${p.y}`));
  for (const o of def.objetos ?? []) if (o.acao === 'aventuras' || o.acao === 'boss-diarios') reservado.add(`${o.x},${o.y}`);
  const pode = (x, y) => !reservado.has(`${x},${y}`) && !PONTE.has(`${x},${y}`);

  // ---- as CASAS: o contorno das partes (sem as paredes de dentro do L), a porta para a rua, os pedaços que caíram (mais nas desabadas)
  for (const c of CASAS) {
    const dentro = (x, y) => c.partes.some(([x0, y0, x1, y1]) => x > x0 && x < x1 && y > y0 && y < y1);
    const contorno = new Set();
    for (const [x0, y0, x1, y1] of c.partes) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (dentro(x, y)) continue;
      if (x === x0 || x === x1 || y === y0 || y === y1) contorno.add(`${x},${y}`);
    }
    // a porta: duas casas no meio do lado de baixo (ou do de cima, nas casas ao sul da praça)
    const [x0, y0, x1, y1] = c.partes[0];
    const meio = Math.floor((x0 + x1) / 2);
    const yPorta = y0 > PRACA.y1 ? y0 : y1;
    for (const x of [meio, meio + 1]) contorno.delete(`${x},${yPorta}`);
    for (const k of [...contorno]) {
      const [x, y] = k.split(',').map(Number);
      const canto = c.partes.some(([a, b, cc, d]) => (x === a || x === cc) && (y === b || y === d));
      if (!canto && ruido(x * 5, y * 5) > (c.desabou ? 0.4 : 0.68)) contorno.delete(k);
    }
    O.porParede(cam, 'ruin wall', contorno, rng);
    // por dentro: na de pé, os restos da casa (uma mesa de pedra, madeira, lixo, uma estátua, ossos); na desabada, as pedras do teto e o mato
    for (const [a, b, cc, d] of c.partes) for (let y = b + 1; y < d; y++) for (let x = a + 1; x < cc; x++) {
      if (!cam.livre(x, y) || !pode(x, y) || !dentro(x, y)) continue;
      const r = rng();
      if (c.desabou) {
        if (r < 0.14) O.porDoodad(cam, rng() < 0.5 ? 'debris (bigger)' : 'stones pile', x, y, rng, { pode });
        else if (r < 0.22) O.porDoodad(cam, 'dry grass tufts', x, y, rng);
        else if (r < 0.24) O.porDoodad(cam, 'dead trees', x, y, rng, { pode });
        else if (r < 0.3) O.porDoodad(cam, 'debris (small)', x, y, rng);
      } else if (r < 0.02) O.porDoodad(cam, rng() < 0.5 ? 'large cask' : 'pallet', x, y, rng, { pode, alt: 0 });
      else if (r < 0.06) O.porDoodad(cam, 'pieces of wood', x, y, rng);
      else if (r < 0.09) O.porDoodad(cam, 'rubbish', x, y, rng);
      else if (r < 0.1) O.porDoodad(cam, 'broken lizard statue', x, y, rng, { pode });
      else if (r < 0.11) O.porDoodad(cam, 'bones', x, y, rng);
      else if (r < 0.15) O.porDoodad(cam, 'debris (small)', x, y, rng);
    }
  }

  // ---- a PRAÇA: o chafariz no meio; o acampamento em volta — as tendas, as barracas de pano (o toldo de pano sobre as caixas), a
  // carroça, os braseiros nos cantos, as bandeiras na beira do canal, os bancos, as estátuas que sobraram
  O.porDoodad(cam, 'golden fountain', 32, 25, rng, { pode });
  for (const [x, y] of [[PRACA.x0 + 1, PRACA.y0 + 1], [PRACA.x1 - 1, PRACA.y0 + 1], [PRACA.x0 + 1, PRACA.y1 - 1], [PRACA.x1 - 1, PRACA.y1 - 1], [29, 22], [35, 22], [29, 28], [35, 28]]) O.porDoodad(cam, 'coal basin (immovable)', x, y, rng, { pode, alt: 1 }); // o braseiro aceso (as outras variações: brasa fraca, fogo verde)
  for (const [x, y] of [[23, 20], [27, 19], [40, 20], [23, 33], [41, 33]]) O.porDoodad(cam, 'gray striped tent', x, y, rng, { pode });
  // as barracas: o pano (as paredes de pano) atrás, a mesa e as caixas na frente
  for (const [x, y, pano] of [[21, 26, 'gray cloth wall'], [22, 26, 'gray cloth wall'], [42, 25, 'brown cloth wall'], [43, 25, 'brown cloth wall']]) O.porDoodad(cam, pano, x, y, rng, { pode, alt: 0 });
  for (const [n, x, y, alt] of [['large cask', 21, 27, 0], ['pallet', 42, 26, 0], ['white caravan wagon', 38, 31, 1], ['new blue banner', 24, 17, null], ['new blue banner', 39, 17, null], ['king statue', 20, 30, null], ['amazon statue', 43, 30, null], ['street sign', 20, 23, null]]) O.porDoodad(cam, n, x, y, rng, { alt, pode });
  for (const [x, y, alt] of [[31, 21, 0], [31, 29, 0], [27, 25, 1], [37, 25, 1]]) O.porDoodad(cam, 'bench', x, y, rng, { alt, pode });
  const CAIXA = 2471, BARRIL = 2523;
  for (const [x, y, id] of [[25, 20, CAIXA], [25, 21, BARRIL], [26, 21, CAIXA], [21, 28, BARRIL], [42, 27, CAIXA], [43, 27, CAIXA], [42, 21, BARRIL], [24, 32, CAIXA], [25, 34, BARRIL], [39, 34, CAIXA], [40, 34, BARRIL]]) if (cam.livre(x, y) && pode(x, y)) cam.por(x, y, id);
  // o COFRE do depósito, ao lado de Hargan
  cam.por(36, 19, 3497);

  // ---- a RUA: o mato nas frestas, o entulho miúdo e o lixo (solto: não fecha o caminho)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (g[y][x] !== 'cobblestone' || !cam.livre(x, y) || !pode(x, y)) continue;
    const r = rng();
    if (r < 0.05) O.porDoodad(cam, 'dry grass tufts', x, y, rng);
    else if (r < 0.075) O.porDoodad(cam, 'debris (small)', x, y, rng);
    else if (r < 0.085) O.porDoodad(cam, 'rubbish', x, y, rng);
  }

  // ---- o BLOQUEIO: a água (pelo chão dos mapas capturados), os marcos de pé e as peças de pé; não bloqueiam o entulho miúdo, a madeira,
  // o lixo, as folhas, os ossos e o mato seco; a ponte é andável
  const SOLTOS = new Set(['debris (small)', 'wooden trash', 'pieces of wood', 'rubbish', 'bones', 'dry grass tufts', 'wall torch - lit']
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
