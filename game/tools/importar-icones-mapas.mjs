// IMPORTA os ícones dos MAPAS do endgame (T1–T16) — dono, 10/10: "aqui tem os assets com a imagem dos mapas dos tier que quero colocar".
//
// O ícone que veio do poedb (`MapNumbersN`) era só a CAMADA do número romano: no PoE o mapa é a moeda (`Base25`) com o número por cima,
// e o jogo mostrava o número solto. As imagens do dono já vêm montadas (a moeda e o número, nas cores do PoE — branco 1–5, amarelo 6–10,
// vermelho 11–16), mas em dois tamanhos (80×80 e 78×78): aqui cada uma é CENTRALIZADA num quadro de 80×80 transparente (o desenho não é
// redimensionado) e gravada como o ícone do tier (`gamedata/itens-poe/icones-itens/poe-itens/Mapas/icones/Map_Tier_N.png`, o caminho
// que `tools/montar-mapas-poe.mjs` põe nas bases).
//
//   node tools/importar-icones-mapas.mjs [pasta das imagens]     (padrão: ../mapas/imagens, com Tier_1.png … Tier_16.png)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { decodificarPng, codificarPng } from '../engine/png-minimo.mjs';

const RAIZ = dirname(fileURLToPath(import.meta.url));
export const LADO = 80;
export const DESTINO = join(RAIZ, '..', 'gamedata', 'itens-poe', 'icones-itens', 'poe-itens', 'Mapas', 'icones');

/** Centraliza o bitmap RGBA num quadro `lado`×`lado` transparente (sem redimensionar). Maior que o quadro: recusa. */
export function centralizar({ w, h, data }, lado = LADO) {
  if (w > lado || h > lado) throw new Error(`imagem de ${w}×${h}: maior que ${lado}×${lado}`);
  const saida = new Uint8ClampedArray(lado * lado * 4);
  const ox = Math.floor((lado - w) / 2);
  const oy = Math.floor((lado - h) / 2);
  for (let y = 0; y < h; y++) saida.set(data.subarray(y * w * 4, (y + 1) * w * 4), ((y + oy) * lado + ox) * 4);
  return { w: lado, h: lado, data: saida };
}

export function importar(pasta, destino = DESTINO) {
  mkdirSync(destino, { recursive: true });
  const feitos = [];
  for (let tier = 1; tier <= 16; tier++) {
    const origem = join(pasta, `Tier_${tier}.png`);
    if (!existsSync(origem)) throw new Error(`falta ${origem}`);
    const png = decodificarPng(readFileSync(origem));
    const quadro = centralizar(png);
    writeFileSync(join(destino, `Map_Tier_${tier}.png`), codificarPng(quadro));
    feitos.push({ tier, de: `${png.w}×${png.h}`, para: `${quadro.w}×${quadro.h}` });
  }
  return feitos;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pasta = resolve(process.argv[2] ?? join(RAIZ, '..', '..', 'mapas', 'imagens'));
  for (const f of importar(pasta)) console.log(`T${f.tier}: ${f.de} → ${f.para}`);
  console.log(`ícones gravados em ${DESTINO}`);
}
