// O ACAMPAMENTO DA FLORESTA (Ato 2): a clareira dos caçadores de Greust no meio da mata fechada. A estrada leste–oeste atravessa a
// paliçada pelos dois portões e cruza o riacho por uma ponte de tábuas; dentro, a terra batida com as tendas, a fogueira, os
// totens e o que a caça deixa (peles, chifres, lenha). Os pontos do jogo (a chegada, os NPCs, os marcos) vêm de `cidades.json` (`def`).
import * as M from './motor.mjs';
import * as O from './objetos.mjs';
import { existe, bloqueia } from './sprites.mjs';
import { sorteio, ruidoSuave, porMarcos } from './comum.mjs';

export const W = 64, H = 48;

export function gerar(def, semente = 23) {
  const rng = sorteio(semente);
  const ruido = ruidoSuave(rng, W, H);

  // ---- a PLANTA do chão: a grama escura da mata, o riacho, a clareira de terra, a estrada
  const PAL = { x0: 18, y0: 10, x1: 46, y1: 36 }; // a paliçada
  const ESTRADA = [23, 24]; // as duas linhas da estrada leste–oeste (y)
  const rio = (y) => 8 + Math.round(Math.sin(y / 6) * 2 + (ruido(3, y * 2) - 0.5) * 2); // a margem oeste do riacho (x), 3 de largura
  let g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    if (x >= rio(y) && x < rio(y) + 3) return 'sea';
    // a clareira: um oval irregular de grama clara em volta da paliçada
    const dx = (x - 32) / 19, dy = (y - 23) / 15;
    return dx * dx + dy * dy + (ruido(x * 2, y * 2) - 0.5) * 0.35 < 1 ? 'grass' : 'grass (dark)';
  }));
  const dentro = (x, y) => x > PAL.x0 && x < PAL.x1 && y > PAL.y0 && y < PAL.y1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // o terreiro de terra (borda irregular, a franja de grama junto às toras)
    const dx = (x - 32) / 12.5, dy = (y - 23) / 11;
    if (dentro(x, y) && x > PAL.x0 + 1 && x < PAL.x1 - 1 && y > PAL.y0 + 1 && y < PAL.y1 - 1 && dx * dx + dy * dy + (ruido(x * 3, y * 3) - 0.5) * 0.3 < 1) g[y][x] = 'dirt';
    if (ESTRADA.includes(y) && g[y][x] !== 'sea') g[y][x] = 'dirt';
  }
  // o filtro de maioria (sem pontas nem buracos de uma casa) fora da terra e da água
  const V8 = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  const fixo = (x, y) => g[y][x] === 'dirt' || g[y][x] === 'sea';
  for (let it = 0; it < 3; it++) g = g.map((l, y) => l.map((c, x) => { if (fixo(x, y)) return c; const cont = {}; for (const [dx, dy] of V8) { const v = g[y + dy]?.[x + dx]; if (v && v !== 'dirt' && v !== 'sea') cont[v] = (cont[v] ?? 0) + 1; } const e = Object.entries(cont).sort((a, b) => b[1] - a[1])[0]; return e && e[1] >= 5 && e[0] !== c ? e[0] : c; }));
  for (let it = 0; it < 2; it++) g = g.map((l, y) => l.map((c, x) => { if (fixo(x, y)) return c; const o = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => g[y + dy]?.[x + dx] ?? c); if (o.filter((v) => v === c).length >= 2) return c; const cont = {}; for (const v of o) if (v !== 'dirt' && v !== 'sea') cont[v] = (cont[v] ?? 0) + 1; const e = Object.entries(cont).sort((a, b) => b[1] - a[1])[0]; return e ? e[0] : c; }));

  const { pilhas, faltas } = M.pintar(g, { rng, existe });
  if (Object.keys(faltas).length) throw new Error(`Floresta: peças de borda sem sprite ${JSON.stringify(faltas)}`);

  // a PONTE: as tábuas por cima do riacho na estrada (o chão continua água — as bordas das margens ficam inteiras), e mais UMA casa sobre
  // cada margem: sem ela, entre a terra da estrada e a primeira tábua aparecia a borda da margem com a água (o dono: "aqui tá estranho")
  const PONTE = new Set();
  const TABUAS = M.PINCEIS.get('grimy wooden plank horizontal').itens;
  const naAgua = (x) => ESTRADA.some((y) => g[y][x] === 'sea');
  const xs = [...Array(W).keys()].filter(naAgua);
  const [px0, px1] = [Math.min(...xs) - 1, Math.max(...xs) + 1];
  for (const y of ESTRADA) for (let x = px0; x <= px1; x++) {
    PONTE.add(`${x},${y}`);
    pilhas[y * W + x] = [TABUAS[Math.floor(rng() * TABUAS.length)].id];
  }
  const cam = new O.Camada(W, H, existe);
  // o guarda-corpo (o pincel "bridge" do editor) nas duas bordas da ponte, por cima da água e das margens
  const CORRIMAO = O.PAREDES.get('bridge').tipos.horizontal.map((i) => i.id).find(existe);
  if (CORRIMAO) for (let x = px0; x <= px1; x++) for (const y of [ESTRADA[0] - 1, ESTRADA.at(-1) + 1]) cam.por(x, y, CORRIMAO);

  // ---- os MARCOS do jogo primeiro; o lugar dos NPCs, da chegada e dos portais fica livre
  const duras = porMarcos(cam, def.objetos ?? []);
  const reservado = new Set([def.chegada, ...(def.npcs ?? [])].map((p) => `${p.x},${p.y}`));
  for (const o of def.objetos ?? []) if (o.acao === 'aventuras' || o.acao === 'boss-diarios') reservado.add(`${o.x},${o.y}`);
  const pode = (x, y) => !reservado.has(`${x},${y}`);

  // ---- a PALIÇADA, com os portões a oeste e a leste na estrada, e as tochas nos lados dos portões
  const toras = new Set();
  for (let x = PAL.x0; x <= PAL.x1; x++) for (const y of [PAL.y0, PAL.y1]) toras.add(`${x},${y}`);
  for (let y = PAL.y0; y <= PAL.y1; y++) for (const x of [PAL.x0, PAL.x1]) if (!ESTRADA.includes(y)) toras.add(`${x},${y}`);
  O.porParede(cam, 'wooden wall', toras, rng);
  for (const x of [PAL.x0, PAL.x1]) for (const y of [ESTRADA[0] - 1, ESTRADA.at(-1) + 1]) O.porDoodad(cam, 'wall torch - lit', x, y, rng, { exigeLivre: false });

  // ---- DENTRO: a fogueira dos caçadores, as tendas em roda, os totens, o canto da caça e o das armas
  const cx = 32, cy = 19;
  O.porDoodad(cam, 'campfire', cx, cy, rng, { alt: 2 });
  for (const [x, y, alt] of [[cx - 2, cy - 1, 1], [cx + 2, cy, 1], [cx, cy - 2, 0], [cx - 1, cy + 2, 0]]) O.porDoodad(cam, 'bench', x, y, rng, { alt, pode });
  for (const [x, y] of [[22, 13], [27, 12], [38, 12], [42, 14], [22, 32], [28, 33], [41, 32]]) O.porDoodad(cam, 'gray striped tent', x, y, rng, { pode });
  for (const [n, x, y, alt] of [['wolf hide', 30, 17, null], ['brown bear skin rug', 29, 27, 0], ['wood pile', 21, 20, null], ['wood pile', 21, 21, null], ['branch stump', 22, 27, null], ['lumberjack stuff', 23, 27, null], ['stuck axe', 24, 26, null], ['archery target', 44, 27, 0], ['archery target', 44, 29, 0], ['weapon rack', 36, 31, 0], ['rack weapons', 37, 31, 0], ['white caravan wagon', 20, 30, 0]]) O.porDoodad(cam, n, x, y, rng, { alt, pode });
  // os chifres de cervo pendurados na paliçada, ao lado do portão leste
  O.porDoodad(cam, 'deer antlers', PAL.x1, ESTRADA[0] - 3, rng, { exigeLivre: false });
  const CAIXA = 2471, BARRIL = 2523;
  for (const [x, y, id] of [[24, 14, CAIXA], [25, 14, BARRIL], [40, 14, CAIXA], [43, 16, BARRIL], [24, 33, CAIXA], [39, 34, BARRIL], [40, 34, CAIXA]]) if (cam.livre(x, y) && pode(x, y)) cam.por(x, y, id);
  // o COFRE do depósito, ao lado de Greust
  cam.por(30, 14, 3497);

  // ---- a NATUREZA: a mata fechada em volta da clareira (pinheiros escuros e árvores verdes em manchas), as plantas do riacho, os tufos
  // (nem árvore cobrindo a ponte: em volta dela fica só o mato rasteiro)
  const juntoDaPonte = (x, y) => x >= px0 - 1 && x <= px1 + 2 && y >= ESTRADA[0] - 2 && y <= ESTRADA.at(-1) + 3;
  const naoCaminho = (x, y) => !ESTRADA.includes(y) && pode(x, y) && !PONTE.has(`${x},${y}`) && !juntoDaPonte(x, y);
  const perto = (x, y, c) => [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => g[y + dy]?.[x + dx] === c);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!cam.livre(x, y) || !naoCaminho(x, y) || dentro(x, y) || (x >= PAL.x0 - 1 && x <= PAL.x1 + 1 && y >= PAL.y0 - 1 && y <= PAL.y1 + 1)) continue;
    const c = g[y][x];
    if (c === 'sea') continue;
    if (perto(x, y, 'sea') || ESTRADA.includes(y - 1) || ESTRADA.includes(y + 1)) { if (rng() < 0.18) O.porDoodad(cam, c === 'grass (dark)' ? 'swamp plants' : 'grass tufts', x, y, rng); continue; }
    if (c === 'grass (dark)') {
      const mancha = ruido(x * 3, y * 3, 8);
      if (rng() < (mancha > 0.5 ? 0.7 : 0.45)) { O.porDoodad(cam, 'green trees', x, y, rng, { pode }); continue; }
      if (rng() < 0.08) { O.porDoodad(cam, 'grass tufts', x, y, rng); continue; }
      if (rng() < 0.02) O.porDoodad(cam, 'mossy rocks (small)', x, y, rng);
    } else if (rng() < 0.05) O.porDoodad(cam, rng() < 0.5 ? 'grass tufts' : 'flowers (yellow)', x, y, rng);
    else if (rng() < 0.04) O.porDoodad(cam, 'green trees', x, y, rng, { pode });
  }

  // ---- o BLOQUEIO: o chão que bloqueia nos mapas capturados (a água), os marcos de pé e as peças de pé; não bloqueiam tapete, pele, tufo,
  // flor, planta do riacho, pedrinha, tocha de parede e lenha no chão
  const SOLTOS = new Set(['grass tufts', 'flowers (yellow)', 'swamp plants', 'mossy rocks (small)', 'brown bear skin rug', 'wolf hide', 'wall torch - lit', 'lumberjack stuff', 'branch stump', 'stuck axe']
    .flatMap((n) => O.DOODADS.get(n).alternativas.flatMap((a) => [...a.soltos.map((s) => s.id), ...a.compostos.flatMap((c) => c.casas.flatMap((t) => t.itens))])));
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
