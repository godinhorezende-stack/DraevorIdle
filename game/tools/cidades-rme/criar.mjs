// CRIA as CIDADES DOS ATOS do zero, com os sprites que o jogo já tem (08/11 — o dono: "Crie uma com os tags existentes", "Quero que vc seja um
// mapper profissional"). O chão e as bordas pelo auto-border do Remere's Map Editor (`motor.mjs`), os objetos pelos pincéis dele (`objetos.mjs`);
// a planta de cada cidade num gerador (`lioneye.mjs`…). Para cada cidade de `gamedata/cidades/cidades.json` com `mapa.gerador`:
//   gamedata/cidades/<id>-map.json    — o mapa no formato da cidade (`dados.CITY_MAP`)
//   gamedata/sprites/cidades/<id>.png — o atlas só com os sprites usados
// e confere que da chegada se alcança a pé cada NPC e cada marco.
//
//   node tools/cidades-rme/criar.mjs [id…] [--previa pasta]   (--previa: o desenho de cada uma, para conferir)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { codificarPng } from '../../engine/png-minimo.mjs';
import { G, desenhar } from './sprites.mjs';
import { compor, alcancaveis } from './comum.mjs';

const GERADORES = { lioneye: () => import('./lioneye.mjs'), floresta: () => import('./floresta.mjs'), sarn: () => import('./sarn.mjs'), highgate: () => import('./highgate.mjs') };

const args = process.argv.slice(2);
const iPrevia = args.indexOf('--previa');
const previa = iPrevia >= 0 ? args.splice(iPrevia, 2)[1] : null;
const dados = JSON.parse(readFileSync(join(G, 'cidades', 'cidades.json'), 'utf8'));
mkdirSync(join(G, 'sprites', 'cidades'), { recursive: true });
for (const def of dados.cidades) {
  if ((args.length && !args.includes(def.id)) || !def.mapa?.gerador) continue;
  const gerador = await GERADORES[def.mapa.gerador]?.();
  if (!gerador) throw new Error(`${def.id}: gerador desconhecido ${def.mapa.gerador}`);
  const { W, H, pilhas, blocked } = gerador.gerar(def, def.mapa.semente);

  // a conferência: a chegada é andável e alcança (encostando) cada NPC e cada marco
  const livre = (x, y) => !blocked[y * W + x];
  if (!livre(def.chegada.x, def.chegada.y)) throw new Error(`${def.id}: a chegada (${def.chegada.x},${def.chegada.y}) está bloqueada`);
  const vis = alcancaveis(W, H, livre, [def.chegada.x, def.chegada.y]);
  const encosta = (x, y) => [[0, 0], [0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => vis.has(`${x + dx},${y + dy}`));
  for (const p of [...(def.npcs ?? []), ...(def.objetos ?? [])]) if (!encosta(p.x, p.y)) throw new Error(`${def.id}: ${p.name ?? p.uid} em (${p.x},${p.y}) fora de alcance`);
  for (const n of def.npcs ?? []) if (!livre(n.x, n.y)) throw new Error(`${def.id}: ${n.name} em casa bloqueada`);
  for (const o of def.objetos ?? []) if (o.pisar && !livre(o.x, o.y)) throw new Error(`${def.id}: o marco ${o.uid} (de pisar) em casa bloqueada`);

  const { mapa, atlas } = compor({ id: def.id, W, H, pilhas, blocked });
  writeFileSync(join(G, 'cidades', `${def.id}-map.json`), JSON.stringify(mapa));
  writeFileSync(join(G, 'sprites', 'cidades', `${def.id}.png`), codificarPng(atlas));
  console.log(`${def.nome}: ${W}×${H}, ${mapa.palette.length} sprites, atlas ${atlas.w}×${atlas.h}, andáveis ${vis.size}`);
  if (previa) {
    const out = new Uint8ClampedArray(W * 32 * H * 32 * 4);
    pilhas.forEach((p, i) => { for (const id of p) desenhar(out, W * 32, H * 32, id, (i % W) * 32, Math.floor(i / W) * 32); });
    // os pontos do jogo, em quadrados coloridos: a chegada (verde), Aventuras (amarelo), Boss Diários (roxo), a forja (vermelho), a árvore
    // (verde-azulado) e os NPCs (azul)
    const COR = { chegada: [40, 220, 60], aventuras: [255, 200, 0], 'boss-diarios': [200, 40, 200], forja: [255, 60, 30], arvore: [0, 160, 140], npc: [0, 220, 255] };
    const quadro = (x, y, c) => { for (let j = 2; j < 30; j++) for (let k = 2; k < 30; k++) if (j < 5 || k < 5 || j >= 27 || k >= 27) { const d = ((y * 32 + j) * W * 32 + x * 32 + k) * 4; out.set([...c, 255], d); } };
    quadro(def.chegada.x, def.chegada.y, COR.chegada);
    for (const o of def.objetos ?? []) quadro(o.x, o.y, COR[o.acao]);
    for (const n of def.npcs ?? []) quadro(n.x, n.y, COR.npc);
    mkdirSync(previa, { recursive: true });
    writeFileSync(join(previa, `${def.id}.png`), codificarPng({ w: W * 32, h: H * 32, data: out }));
  }
}
