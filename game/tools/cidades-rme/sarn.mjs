// O ACAMPAMENTO DE SARN (Ato 3, e o 8, que o PoE repete): os sobreviventes acampados na praça de uma cidade em ruínas. As ruas de pedra
// entre os quarteirões arruinados (paredes quebradas, chão de pedra, terrenos que desabaram em mato seco, entulho e estátuas caídas), a
// muralha da cidade em volta com o portão a oeste, e na praça de lajes o poço grande, as tendas, os braseiros e o que o acampamento juntou.
// Os pontos do jogo (a chegada, os NPCs, os marcos) vêm de `cidades.json` (`def`).
import * as M from './motor.mjs';
import * as O from './objetos.mjs';
import { existe, bloqueia } from './sprites.mjs';
import { sorteio, ruidoSuave, porMarcos } from './comum.mjs';

export const W = 64, H = 48;

export function gerar(def, semente = 31) {
  const rng = sorteio(semente);
  const ruido = ruidoSuave(rng, W, H);

  // ---- a PLANTA: a rua de pedra em tudo, a praça de lajes no meio, os quarteirões (o chão de pedra das casas ou o terreno desabado)
  const PRACA = { x0: 21, y0: 15, x1: 42, y1: 33 };
  const PORTAO = [23, 24, 25]; // o portão oeste da muralha (y)
  const QUARTEIROES = [
    [4, 3, 16, 12], [20, 3, 31, 11], [35, 3, 46, 11], [50, 3, 60, 13],
    [4, 16, 16, 20], [4, 28, 16, 33], [47, 17, 60, 27],
    [4, 37, 16, 44], [21, 37, 31, 44], [35, 37, 45, 44], [49, 32, 60, 44],
  ].map(([x0, y0, x1, y1]) => ({ x0, y0, x1, y1, desabou: rng() < 0.35 }));
  const naPraca = (x, y) => x >= PRACA.x0 && x <= PRACA.x1 && y >= PRACA.y0 && y <= PRACA.y1;
  const quarteiraoDe = (x, y) => QUARTEIROES.find((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
  let g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    if (naPraca(x, y)) return 'gray stone tiles';
    return quarteiraoDe(x, y) ? 'drab tiled stone floor' : 'cobblestone';
  }));

  const { pilhas, faltas } = M.pintar(g, { rng, existe });
  if (Object.keys(faltas).length) throw new Error(`Sarn: peças de borda sem sprite ${JSON.stringify(faltas)}`);
  const cam = new O.Camada(W, H, existe);

  // ---- os MARCOS do jogo primeiro; o lugar dos NPCs, da chegada e dos portais fica livre
  const duras = porMarcos(cam, def.objetos ?? []);
  const reservado = new Set([def.chegada, ...(def.npcs ?? [])].map((p) => `${p.x},${p.y}`));
  for (const o of def.objetos ?? []) if (o.acao === 'aventuras' || o.acao === 'boss-diarios') reservado.add(`${o.x},${o.y}`);
  const pode = (x, y) => !reservado.has(`${x},${y}`);

  // ---- a MURALHA da cidade (as pedras pesadas) na borda, com o portão a oeste
  const muralha = new Set();
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) muralha.add(`${x},${y}`);
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) if (!(x === 0 && PORTAO.includes(y))) muralha.add(`${x},${y}`);
  O.porParede(cam, 'stone wall', muralha, rng);
  for (const y of [PORTAO[0] - 1, PORTAO.at(-1) + 1]) O.porDoodad(cam, 'wall torch - lit', 0, y, rng, { exigeLivre: false });

  // ---- os QUARTEIRÕES: as casas de pé com as paredes quebradas (a porta para a rua, pedaços caídos); as que desabaram, só os cantos e
  // uns restos de parede, e o entulho por dentro
  for (const q of QUARTEIROES) {
    {
      const parede = new Set();
      for (let x = q.x0; x <= q.x1; x++) for (const y of [q.y0, q.y1]) parede.add(`${x},${y}`);
      for (let y = q.y0; y <= q.y1; y++) for (const x of [q.x0, q.x1]) parede.add(`${x},${y}`);
      // a porta (2 casas) no lado que dá para a praça, e as partes que caíram (os cantos ficam: é o que segura a casa)
      const meioX = Math.floor((q.x0 + q.x1) / 2), meioY = Math.floor((q.y0 + q.y1) / 2);
      const porta = q.y1 < PRACA.y0 ? [[meioX, q.y1], [meioX + 1, q.y1]] : q.y0 > PRACA.y1 ? [[meioX, q.y0], [meioX + 1, q.y0]] : q.x1 < PRACA.x0 ? [[q.x1, meioY], [q.x1, meioY + 1]] : [[q.x0, meioY], [q.x0, meioY + 1]];
      for (const [x, y] of porta) parede.delete(`${x},${y}`);
      for (const k of [...parede]) {
        const [x, y] = k.split(',').map(Number);
        const canto = (x === q.x0 || x === q.x1) && (y === q.y0 || y === q.y1);
        if (!canto && (q.desabou ? ruido(x * 5, y * 5) > 0.35 : ruido(x * 5, y * 5) > 0.66)) parede.delete(k);
      }
      O.porParede(cam, 'ruin wall', parede, rng);
      // dentro: o que sobrou (caixas quebradas, ossos, folhas, uma estátua caída) — e, na que desabou, as pedras do teto e o mato seco
      for (let y = q.y0 + 1; y < q.y1; y++) for (let x = q.x0 + 1; x < q.x1; x++) {
        if (!cam.livre(x, y) || !pode(x, y)) continue;
        const r = rng();
        if (q.desabou && r < 0.12) { O.porDoodad(cam, rng() < 0.5 ? 'debris (bigger)' : 'stones pile', x, y, rng, { pode }); continue; }
        if (q.desabou && r < 0.2) { O.porDoodad(cam, 'dry grass tufts', x, y, rng); continue; }
        if (q.desabou && r < 0.22) { O.porDoodad(cam, 'dead trees', x, y, rng, { pode }); continue; }
        if (r < 0.05) O.porDoodad(cam, 'debris (small)', x, y, rng);
        else if (r < 0.08) O.porDoodad(cam, 'wooden trash', x, y, rng);
        else if (r < 0.1) O.porDoodad(cam, 'leaves', x, y, rng);
        else if (r < 0.11) O.porDoodad(cam, 'bones', x, y, rng);
        else if (r < 0.12) O.porDoodad(cam, 'broken lizard statue', x, y, rng, { pode });
      }
    }
  }

  // ---- a PRAÇA: o poço grande no meio, os braseiros nos cantos, as tendas em volta, os bancos, as caixas e as bandeiras
  O.porDoodad(cam, 'large well - water', 30, 22, rng, { pode });
  for (const [x, y] of [[PRACA.x0 + 1, PRACA.y0 + 1], [PRACA.x1 - 1, PRACA.y0 + 1], [PRACA.x0 + 1, PRACA.y1 - 1], [PRACA.x1 - 1, PRACA.y1 - 1], [28, 25], [34, 25]]) O.porDoodad(cam, 'coal basin (immovable)', x, y, rng, { pode });
  for (const [x, y] of [[24, 18], [40, 21], [24, 31], [40, 31], [29, 32]]) O.porDoodad(cam, 'gray striped tent', x, y, rng, { pode });
  for (const [x, y, alt] of [[27, 21, 1], [34, 22, 1], [30, 19, 0], [30, 27, 0]]) O.porDoodad(cam, 'bench', x, y, rng, { alt, pode });
  for (const [n, x, y] of [['new blue banner', 25, 15], ['new blue banner', 38, 15], ['king statue', 22, 25], ['obelisk', 41, 26], ['street sign', 21, 23]]) O.porDoodad(cam, n, x, y, rng, { pode });
  const CAIXA = 2471, BARRIL = 2523;
  for (const [x, y, id] of [[26, 18, CAIXA], [27, 18, BARRIL], [41, 23, CAIXA], [25, 32, BARRIL], [26, 32, CAIXA], [39, 32, BARRIL]]) if (cam.livre(x, y) && pode(x, y)) cam.por(x, y, id);
  // o COFRE do depósito, ao lado de Hargan
  cam.por(35, 20, 3497);

  // ---- a RUA: o entulho espalhado, sem fechar o caminho (pouco e solto)
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (naPraca(x, y) || quarteiraoDe(x, y) || !cam.livre(x, y) || !pode(x, y) || PORTAO.includes(y)) continue;
    const r = rng();
    if (r < 0.025) O.porDoodad(cam, 'debris (small)', x, y, rng);
    else if (r < 0.035) O.porDoodad(cam, 'rubbish', x, y, rng);
  }

  // ---- o BLOQUEIO: o chão que bloqueia nos mapas capturados, os marcos de pé e as peças de pé; não bloqueiam o entulho miúdo, as folhas,
  // os ossos, o lixo, o mato seco e a tocha de parede
  const SOLTOS = new Set(['debris (small)', 'debris (medium)', 'wooden trash', 'leaves', 'bones', 'rubbish', 'dry grass tufts', 'wall torch - lit']
    .flatMap((n) => O.DOODADS.get(n).alternativas.flatMap((a) => [...a.soltos.map((s) => s.id), ...a.compostos.flatMap((c) => c.casas.flatMap((t) => t.itens))])));
  SOLTOS.add(25056); // o portal: pisa-se nele
  const blocked = pilhas.map((p, i) => {
    const x = i % W, y = Math.floor(i / W);
    const ob = cam.em(x, y);
    return duras.has(`${x},${y}`) || bloqueia(p[0]) || ob.some((id) => !SOLTOS.has(id)) ? 1 : 0;
  });
  const todas = pilhas.map((p, i) => [...p, ...cam.em(i % W, Math.floor(i / W))]);
  return { W, H, pilhas: todas, blocked, grade: g };
}
