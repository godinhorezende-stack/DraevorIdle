// Entrada e saída de imagens do editor de sprites (só o que precisa do navegador): PNG ⇄ bitmap RGBA, download, base64. Sem regra de jogo.
import { criarBitmap } from '/packages/shared/src/sprite-folha.mjs';

/** Decodifica um Blob/File de imagem para bitmap RGBA SEM pré-multiplicar o alfa (o pixel volta como foi gravado). */
export async function bitmapDeBlob(blob) {
  const img = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  img.close?.();
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return { w: c.width, h: c.height, data: d.data };
}
const cache = new Map();
/** Baixa e decodifica uma imagem do servidor (cache por URL: a mesma folha não é decodificada duas vezes). */
export async function carregarBitmap(url) {
  if (cache.has(url)) return cache.get(url);
  const p = fetch(url).then((r) => { if (!r.ok) throw new Error(`Não consegui carregar ${url} (${r.status}).`); return r.blob(); }).then(bitmapDeBlob);
  cache.set(url, p);
  p.catch(() => cache.delete(url));
  return p;
}
export const esquecerBitmap = (url) => cache.delete(url);
/** Bitmap → canvas do mesmo tamanho. */
export function paraCanvas(b, canvas = null) {
  const c = canvas ?? document.createElement('canvas');
  if (c.width !== b.w) c.width = b.w;
  if (c.height !== b.h) c.height = b.h;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(b.data), b.w, b.h), 0, 0);
  return c;
}
export const bitmapDeCanvas = (c) => { const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); return { w: c.width, h: c.height, data: d.data }; };
export const vazio = (w, h) => criarBitmap(w, h);
/** Bitmap → PNG (Blob). Nada de suavização: o canvas guarda os pixels exatos. */
export const paraPngBlob = (b) => new Promise((ok, falha) => paraCanvas(b).toBlob((x) => (x ? ok(x) : falha(new Error('Não consegui gerar o PNG.'))), 'image/png'));
/** O PNG em base64 (sem o prefixo `data:`), como o servidor recebe. */
export async function paraPngBase64(b) {
  const bytes = new Uint8Array(await (await paraPngBlob(b)).arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
/** Baixa um Blob/texto como arquivo. */
export function baixar(conteudo, nome, tipo = 'application/octet-stream') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
