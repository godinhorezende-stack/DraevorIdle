// A THREAD que calcula a assinatura de PIXELS de cada sprite (primeiro quadro) para a Biblioteca de sprites não repetir desenhos iguais em ids diferentes.
// Decodifica as folhas dos itens e das criaturas (o leitor de PNG do projeto) e devolve `{ itens: {id: sha1}, looks: {look: sha1} }` à thread principal.
import { parentPort, workerData } from 'node:worker_threads';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { decodificarPng } from '../engine/png-minimo.mjs';

const RAIZ = workerData.raiz;
const lerJson = (arq) => (existsSync(join(RAIZ, arq)) ? JSON.parse(readFileSync(join(RAIZ, arq), 'utf8')) : {});
const FOLHAS = new Map();
function folha(caminho) {
  if (!FOLHAS.has(caminho)) {
    try { FOLHAS.set(caminho, existsSync(caminho) ? decodificarPng(readFileSync(caminho)) : null); } catch { FOLHAS.set(caminho, null); }
  }
  return FOLHAS.get(caminho);
}
function assinatura(img, x, y, w, h) {
  if (!img?.data || x + w > img.w || y + h > img.h) return null;
  const hash = createHash('sha1').update(`${w}x${h}`);
  let algo = false;
  for (let lin = 0; lin < h; lin++) {
    const ini = ((y + lin) * img.w + x) * 4;
    const pedaco = img.data.subarray(ini, ini + w * 4);
    if (!algo) for (let i = 3; i < pedaco.length; i += 4) if (pedaco[i]) { algo = true; break; }
    hash.update(pedaco);
  }
  return algo ? hash.digest('hex') : 'vazio';
}
const itens = {};
for (const [id, sp] of Object.entries(lerJson('item-sprites.json'))) {
  const v = sp.s?.[0] ?? [0, sp.x, sp.y];
  itens[id] = assinatura(folha(join(RAIZ, 'sprites', 'items', `${sp.b ?? sp.p}${sp.b ? v[0] : ''}.png`)), v[1], v[2], sp.w ?? 32, sp.h ?? 32);
}
FOLHAS.clear();
const looks = {};
for (const [look, m] of Object.entries(lerJson('outfits.json'))) {
  looks[look] = assinatura(folha(join(RAIZ, 'sprites', 'outfits', `${look}.png`)), 0, 0, m.cw ?? 32, m.ch ?? 32);
  FOLHAS.clear();
}
// A construção do mapa: quais células da paleta de cada mapa têm DESENHO no atlas (o chão de muitos mapas está pintado numa camada de fundo pronta e a
// célula dele fica vazia). `celulas['<arquivo>|<índice>'] = 1` quando há pixel.
import { readdirSync } from 'node:fs';
const celulas = {};
const pasta = join(RAIZ, 'hunts');
for (const arq of existsSync(pasta) ? readdirSync(pasta).filter((a) => a.endsWith('-map.json')) : []) {
  let m;
  try { m = JSON.parse(readFileSync(join(pasta, arq), 'utf8')); } catch { continue; }
  const img = folha(join(RAIZ, 'sprites', `${m.atlas}.png`));
  if (!img?.data) continue;
  (m.palette ?? []).forEach((p, i) => {
    const [x, y] = p.cells?.[0] ?? [p.ax ?? 0, p.ay ?? 0];
    const w = p.w ?? 32;
    const h = p.h ?? 32;
    if (x + w > img.w || y + h > img.h) return;
    for (let lin = 0; lin < h; lin++) {
      const ini = ((y + lin) * img.w + x) * 4;
      for (let k = 3; k < w * 4; k += 4) if (img.data[ini + k]) { celulas[`${arq}|${i}`] = 1; return; }
    }
  });
  FOLHAS.clear();
}
parentPort.postMessage({ itens, looks, celulas });
