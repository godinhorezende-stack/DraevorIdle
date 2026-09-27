// Lista os PNG de uma pasta (os maiores primeiro) com as dimensões.
// Uso: node tools/imagens/inventario.mjs game/frontend/client/assets [quantos]
import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const raiz = process.argv[2];
const quantos = Number(process.argv[3] ?? 25);
const arqs = [];
const andar = (d) => {
  for (const f of readdirSync(d)) {
    const q = join(d, f);
    const s = statSync(q);
    if (s.isDirectory()) andar(q);
    else if (/\.png$/i.test(f)) arqs.push({ q, n: s.size });
  }
};
andar(raiz);
arqs.sort((a, b) => b.n - a.n);
for (const { q, n } of arqs.slice(0, quantos)) {
  const m = await sharp(q).metadata();
  console.log(`${(n / 1024).toFixed(0).padStart(6)} KB  ${`${m.width}x${m.height}`.padEnd(10)} ${relative(raiz, q).replaceAll('\\', '/')}`);
}
const tot = arqs.reduce((a, x) => a + x.n, 0);
console.log(`total ${(tot / 1048576).toFixed(1)} MB em ${arqs.length} PNG`);
