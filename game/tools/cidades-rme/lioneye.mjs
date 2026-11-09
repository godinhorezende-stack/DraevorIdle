// A VIGÍLIA DE LIONEYE (Ato 1; e, com `guerra`, a do Ato 6 — o dono: "uma vigília depois da guerra"): o acampamento dos exilados na praia. A paliçada de toras com os portões a leste e ao
// sul, o pátio de terra com as tendas, a fogueira e o poço, o caminho até o píer com os barcos, a mata fechando o norte e o oeste. Os pontos do
// jogo (a chegada, os NPCs, os marcos) vêm de `cidades.json` (`def`).
import * as M from './motor.mjs';
import * as O from './objetos.mjs';
import { existe, bloqueia } from './sprites.mjs';
import { sorteio, ruidoSuave, porMarcos } from './comum.mjs';

export const W = 64, H = 48;

export function gerar(def, semente = 11, { guerra = false } = {}) {
  const rng = sorteio(semente);
  const ruido = ruidoSuave(rng, W, H);

  // ---- a PLANTA do chão
  const PAL = { x0: 13, y0: 9, x1: 39, y1: 31 }; // a paliçada (o retângulo das toras)
  const PORTAO_L = [19, 20, 21]; // o portão leste (y)
  const PORTAO_S = [25, 26, 27]; // o portão sul (x)
  const costa = (x, y) => Math.min(49 + (ruido(x, y) - 0.5) * 8 - x, 38 + (ruido(y, x) - 0.5) * 6 - y);
  let g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => { const d = costa(x, y); return d <= 0 ? 'sea' : d <= 3.5 + ruido(x * 2, y) * 2.5 ? 'sand' : 'grass'; }));
  const dentro = (x, y) => x > PAL.x0 && x < PAL.x1 && y > PAL.y0 && y < PAL.y1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // o terreiro de terra dentro da paliçada (com a franja de grama junto às toras) e os caminhos até a praia
    if (x > PAL.x0 + 1 && x < PAL.x1 - 1 && y > PAL.y0 + 1 && y < PAL.y1 - 1) g[y][x] = 'dirt';
    if (PORTAO_L.includes(y) && x >= PAL.x1 - 2 && g[y][x] === 'grass') g[y][x] = 'dirt';
    if (PORTAO_S.includes(x) && y >= PAL.y1 - 2 && g[y][x] === 'grass') g[y][x] = 'dirt';
    // (guerra) a grama queimada em manchas em volta do acampamento
    if (guerra && g[y][x] === 'grass' && ruido(x * 3 + 7, y * 3 + 5, 8) > 0.55) g[y][x] = 'grass (dried)';
  }
  // o filtro de maioria (sem pontas nem buracos de uma casa) fora do que é desenhado à mão
  const V8 = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
  const fixo = (x, y) => g[y][x] === 'dirt';
  for (let it = 0; it < 3; it++) g = g.map((l, y) => l.map((c, x) => { if (fixo(x, y)) return c; const cont = {}; for (const [dx, dy] of V8) { const v = g[y + dy]?.[x + dx]; if (v && v !== 'dirt') cont[v] = (cont[v] ?? 0) + 1; } const e = Object.entries(cont).sort((a, b) => b[1] - a[1])[0]; return e && e[1] >= 5 && e[0] !== c ? e[0] : c; }));
  for (let it = 0; it < 2; it++) g = g.map((l, y) => l.map((c, x) => { if (fixo(x, y)) return c; const o = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => g[y + dy]?.[x + dx] ?? c); if (o.filter((v) => v === c).length >= 2) return c; const cont = {}; for (const v of o) if (v !== 'dirt') cont[v] = (cont[v] ?? 0) + 1; const e = Object.entries(cont).sort((a, b) => b[1] - a[1])[0]; return e ? e[0] : c; }));

  // o chão e as bordas (o auto-border do editor)
  const { pilhas, faltas } = M.pintar(g, { rng, existe });
  if (Object.keys(faltas).length) throw new Error(`Lioneye: peças de borda sem sprite ${JSON.stringify(faltas)}`);

  // o PÍER: do fim do caminho leste, mar adentro (2 de largura) — as tábuas por cima do mar (o chão continua mar, e a borda da praia fica inteira)
  const PIER = new Set();
  let pierX0 = null;
  for (let x = PAL.x1; x < W; x++) if (g[PORTAO_L[1]][x] === 'sea') { pierX0 = x; break; }
  const TABUAS = M.PINCEIS.get('grimy wooden plank horizontal').itens;
  if (pierX0 != null) for (let x = pierX0; x < Math.min(W - 2, pierX0 + 7); x++) for (const y of [PORTAO_L[0], PORTAO_L[1]]) {
    PIER.add(`${x},${y}`);
    pilhas[y * W + x] = [TABUAS[Math.floor(rng() * TABUAS.length)].id];
  }
  const cam = new O.Camada(W, H, existe);

  // ---- os MARCOS do jogo primeiro (o portal, a forja, a árvore), e o lugar dos NPCs e da chegada fica livre
  const duras = porMarcos(cam, def.objetos ?? []);
  const reservado = new Set([def.chegada, ...(def.npcs ?? [])].map((p) => `${p.x},${p.y}`));
  for (const o of def.objetos ?? []) if (o.acao === 'aventuras' || o.acao === 'boss-diarios') reservado.add(`${o.x},${o.y}`);
  const pode = (x, y) => !reservado.has(`${x},${y}`);

  // ---- a PALIÇADA (a parede de toras), com os dois portões abertos, e as tochas acesas nos lados dos portões
  const toras = new Set();
  for (let x = PAL.x0; x <= PAL.x1; x++) for (const y of [PAL.y0, PAL.y1]) if (!(y === PAL.y1 && PORTAO_S.includes(x))) toras.add(`${x},${y}`);
  for (let y = PAL.y0; y <= PAL.y1; y++) for (const x of [PAL.x0, PAL.x1]) if (!(x === PAL.x1 && PORTAO_L.includes(y))) toras.add(`${x},${y}`);
  // (guerra) os trechos da paliçada que caíram na invasão (os cantos ficam de pé): no lugar, as toras partidas
  const caidas = [];
  if (guerra) for (const k of [...toras]) {
    const [x, y] = k.split(',').map(Number);
    const canto = (x === PAL.x0 || x === PAL.x1) && (y === PAL.y0 || y === PAL.y1);
    if (!canto && ruido(x * 5 + 3, y * 5 + 1, 8) > 0.6) { toras.delete(k); caidas.push([x, y]); }
  }
  O.porParede(cam, 'wooden wall', toras, rng);
  for (const [x, y] of [[PAL.x1, PORTAO_L[0] - 1], [PAL.x1, PORTAO_L.at(-1) + 1], [PORTAO_S[0] - 1, PAL.y1], [PORTAO_S.at(-1) + 1, PAL.y1]]) O.porDoodad(cam, 'wall torch - lit', x, y, rng, { exigeLivre: false });

  // ---- DENTRO: a fogueira com os bancos virados para ela, as tendas, o poço, os barris e as caixas, o canto das armas, a carroça
  const cx = 26, cy = 20;
  O.porDoodad(cam, 'campfire', cx, cy, rng, { alt: 2 });
  for (const [x, y, alt] of [[cx - 2, cy - 1, 1], [cx + 2, cy, 1], [cx, cy - 2, 0], [cx - 1, cy + 2, 0]]) O.porDoodad(cam, 'bench', x, y, rng, { alt, pode });
  // (guerra) as tendas que queimaram viram o entulho delas, uma ainda em brasa
  const TENDAS = [[16, 12], [20, 12], [32, 12], [35, 12], [16, 26], [20, 27], [33, 26]];
  TENDAS.forEach(([x, y], i) => {
    if (guerra && i % 2 === 1) {
      for (const [n, dx, dy] of [['wooden trash', 0, 0], ['debris (medium)', -1, 0], ['pieces of wood', 0, -1], ['debris (small)', -1, -1]]) O.porDoodad(cam, n, x + dx, y + dy, rng, { pode });
      if (i === 3) O.porDoodad(cam, 'fire field (decaying)', x - 1, y + 1, rng, { pode });
    } else O.porDoodad(cam, 'gray striped tent', x, y, rng, { pode });
  });
  O.porDoodad(cam, 'water well', 31, 19, rng, { pode });
  const CAIXA = 2471, BARRIL = 2523;
  for (const [x, y, id] of [[18, 14, CAIXA], [19, 14, BARRIL], [34, 14, CAIXA], [37, 13, BARRIL], [18, 29, CAIXA], [36, 28, BARRIL], [36, 27, CAIXA]]) if (cam.livre(x, y) && pode(x, y)) cam.por(x, y, id);
  for (const [n, x, y, alt] of [['weapon rack', 21, 18, 0], ['rack weapons', 25, 17, 0], ['archery target', 15, 21, 0], ['archery target', 15, 23, 0], ['white caravan wagon', 37, 25, 0], ['lumberjack stuff', 25, 28, null], ['pallet', 29, 28, 0], ['brown bear skin rug', 28, 15, 0], ['street sign', 38, 18, 0]]) O.porDoodad(cam, n, x, y, rng, { alt, pode });
  // o COFRE do depósito (o "Baú" do PoE), ao lado de Tarkleigh
  cam.por(23, 13, 3497);

  // ---- os BARCOS ao lado do píer (na guerra, sobrou um)
  if (pierX0 != null) { O.porMesa(cam, 'small boat', pierX0 + 2, PORTAO_L[1] + 2, 4, 'vertical', rng); if (!guerra) O.porMesa(cam, 'small boat', pierX0 + 5, PORTAO_L[0] - 5, 4, 'vertical', rng); }

  // ---- (guerra) o que a invasão deixou: as toras partidas onde a paliçada caiu, os totens dos Karui fincados nos portões, os ossos, o
  // sangue e o entulho espalhados pelo pátio
  if (guerra) {
    for (const [x, y] of caidas) O.porDoodad(cam, rng() < 0.5 ? 'pieces of wood' : 'debris (bigger)', x, y, rng, { pode });
    for (const [x, y] of [[PAL.x1 + 1, PORTAO_L[0] - 2], [PAL.x1 + 1, PORTAO_L.at(-1) + 2], [PORTAO_S[0] - 2, PAL.y1 + 1], [PORTAO_S.at(-1) + 2, PAL.y1 + 1]]) O.porDoodad(cam, 'totem poles', x, y, rng, { pode });
    for (let y = PAL.y0 + 1; y < PAL.y1; y++) for (let x = PAL.x0 + 1; x < PAL.x1; x++) {
      if (!cam.livre(x, y) || !pode(x, y)) continue;
      const r = rng();
      if (r < 0.025) O.porDoodad(cam, 'bones', x, y, rng);
      else if (r < 0.04) O.porDoodad(cam, 'blood', x, y, rng);
      else if (r < 0.06) O.porDoodad(cam, 'debris (small)', x, y, rng);
      else if (r < 0.065) O.porDoodad(cam, 'skeletons', x, y, rng);
    }
  }

  // ---- a NATUREZA: a mata que fecha o norte e o oeste, as árvores em grupos, as palmeiras e pedras na praia, os tufos
  const longe = (x, y) => !(x >= PAL.x0 - 2 && x <= PAL.x1 + 2 && y >= PAL.y0 - 2 && y <= PAL.y1 + 2);
  const naoCaminho = (x, y) => !(PORTAO_L.includes(y) && x > PAL.x1) && !(PORTAO_S.includes(x) && y > PAL.y1) && pode(x, y);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!cam.livre(x, y) || !naoCaminho(x, y)) continue;
    const c = g[y][x];
    if (c === 'grass' && longe(x, y)) {
      const mata = Math.min(x, y) <= 3 ? 0.75 : ruido(x * 3, y * 3, 8) > 0.68 ? 0.45 : 0.02;
      if (rng() < mata) { O.porDoodad(cam, guerra && rng() < 0.3 ? 'dead trees' : 'green trees', x, y, rng, { pode }); continue; }
      if (rng() < 0.06) { O.porDoodad(cam, 'grass tufts', x, y, rng); continue; }
      if (rng() < 0.012) O.porDoodad(cam, 'mossy rocks (small)', x, y, rng);
    } else if (c === 'grass' && !dentro(x, y) && rng() < 0.05) O.porDoodad(cam, 'grass tufts', x, y, rng);
    else if (c === 'grass (dried)' && longe(x, y) && rng() < 0.12) O.porDoodad(cam, rng() < 0.6 ? 'dead trees' : 'dry grass tufts', x, y, rng, { pode });
    else if (c === 'grass (dried)' && rng() < 0.06) O.porDoodad(cam, 'dry grass tufts', x, y, rng);
    else if (c === 'sand') {
      const perto = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => g[y + dy]?.[x + dx] === 'grass');
      if (perto && rng() < 0.12) O.porDoodad(cam, 'palm trees', x, y, rng, { pode });
      else if (rng() < 0.025) O.porDoodad(cam, 'rocks (small)', x, y, rng);
    }
  }

  // ---- o BLOQUEIO: o chão que bloqueia nos mapas capturados (a água), os marcos de pé, e as peças de pé (árvores, tendas, poço, mobília): tudo
  // menos tapete, tufo, pedrinha, tocha de parede e lenha no chão
  const SOLTOS = new Set(['grass tufts', 'rocks (small)', 'brown bear skin rug', 'wall torch - lit', 'lumberjack stuff', 'dry grass tufts', 'bones', 'blood', 'debris (small)', 'debris (medium)', 'wooden trash', 'pieces of wood', 'skeletons', 'fire field (decaying)']
    .flatMap((n) => O.DOODADS.get(n).alternativas.flatMap((a) => [...a.soltos.map((s) => s.id), ...a.compostos.flatMap((c) => c.casas.flatMap((t) => t.itens))])));
  SOLTOS.add(25056); // o portal: pisa-se nele
  const blocked = pilhas.map((p, i) => {
    const x = i % W, y = Math.floor(i / W);
    if (PIER.has(`${x},${y}`)) return 0;
    const ob = cam.em(x, y);
    return duras.has(`${x},${y}`) || bloqueia(p[0]) || ob.some((id) => !SOLTOS.has(id)) ? 1 : 0;
  });
  const todas = pilhas.map((p, i) => [...p, ...cam.em(i % W, Math.floor(i / W))]);
  return { W, H, pilhas: todas, blocked, grade: g, pier: [...PIER].map((k) => k.split(',').map(Number)) };
}
