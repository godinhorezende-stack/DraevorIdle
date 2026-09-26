// Gera `<nome>.png.webp` ao lado de cada PNG do jogo (o PNG original fica).
// O servidor (game/backend/estaticos.mjs) manda o WebP no lugar do PNG para
// o navegador que aceita WebP — o cliente continua pedindo `.png`.
//
// - Sprites, mapas, arte: WebP SEM PERDA, conferido pixel a pixel (alfa igual e
//   a cor igual onde o pixel aparece). Deu diferença ou não ficou menor: o WebP
//   é apagado e fica o PNG.
// - `client/assets/icons/`: arte-mestra de 1254x1254 que a tela mostra com no
//   máximo ~50px (ver o CSS: abas 28–40px, HUD 18–30px). Reduzida para caber em
//   ICONE_MAX, que serve até 128px de tela em monitor de alta densidade.
//
// Uso: node tools/imagens/converter.mjs [pasta ...]   (padrão: as do jogo)
import sharp from 'sharp';
import { readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Sem o cache do sharp: no Windows ele segura o arquivo recém-escrito, e o
// WebP que não serve (maior, ou diferente) não conseguia ser apagado (EBUSY).
sharp.cache(false);

const RAIZ = fileURLToPath(new URL('../../game/frontend/', import.meta.url));
const PASTAS = process.argv.slice(2).length ? process.argv.slice(2) : ['client/assets', 'gamedata/sprites'];
const ICONE_MAX = 256;
const PARALELO = 4;

const eIcone = (arq) => relative(RAIZ, arq).split(sep).join('/').startsWith('client/assets/icons/');

const arquivos = [];
const andar = (d) => {
  for (const f of readdirSync(d)) {
    const q = join(d, f);
    const s = statSync(q);
    if (s.isDirectory()) andar(q);
    else if (/\.png$/i.test(f)) arquivos.push(q);
  }
};
for (const p of PASTAS) andar(join(RAIZ, p));

/** Os dois iguais para quem olha: mesmo alfa, e a mesma cor onde o pixel não é transparente. */
async function iguais(png, webp) {
  const a = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(webp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) return false;
  const x = a.data;
  const y = b.data;
  for (let i = 0; i < x.length; i += 4) {
    if (x[i + 3] !== y[i + 3]) return false;
    if (x[i + 3] && (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2])) return false;
  }
  return true;
}

const r = { convertidos: 0, reduzidos: 0, jaFeitos: 0, semGanho: 0, diferentes: 0, erros: 0, antes: 0, depois: 0 };
async function converter(png) {
  const saida = `${png}.webp`;
  const tamPng = statSync(png).size;
  if (existsSync(saida) && statSync(saida).mtimeMs >= statSync(png).mtimeMs) {
    r.jaFeitos++;
    r.antes += tamPng;
    r.depois += statSync(saida).size;
    return;
  }
  try {
    const meta = await sharp(png).metadata();
    const reduzir = eIcone(png) && Math.max(meta.width, meta.height) > ICONE_MAX;
    let img = sharp(png);
    if (reduzir) img = img.resize({ width: ICONE_MAX, height: ICONE_MAX, fit: 'inside', kernel: 'lanczos3' });
    await img.webp({ lossless: true, effort: 4 }).toFile(saida);
    const tamWebp = statSync(saida).size;
    if (!reduzir && !(await iguais(png, saida))) {
      unlinkSync(saida);
      r.diferentes++;
      console.log('DIFERENTE, fica o PNG:', relative(RAIZ, png));
      return;
    }
    if (tamWebp >= tamPng) {
      unlinkSync(saida);
      r.semGanho++;
      r.antes += tamPng;
      r.depois += tamPng;
      return;
    }
    r.convertidos++;
    if (reduzir) r.reduzidos++;
    r.antes += tamPng;
    r.depois += tamWebp;
  } catch (e) {
    r.erros++;
    console.log('ERRO', relative(RAIZ, png), e.message);
  }
}

const inicio = Date.now();
let i = 0;
async function trabalhador() {
  while (i < arquivos.length) {
    const arq = arquivos[i++];
    await converter(arq);
    if (i % 100 === 0) console.log(`${i}/${arquivos.length} (${((Date.now() - inicio) / 1000).toFixed(0)}s)`);
  }
}
await Promise.all(Array.from({ length: PARALELO }, trabalhador));
const mb = (n) => (n / 1048576).toFixed(1);
console.log(`FIM ${arquivos.length} PNG em ${((Date.now() - inicio) / 1000).toFixed(0)}s:`, JSON.stringify({ ...r, antes: `${mb(r.antes)} MB`, depois: `${mb(r.depois)} MB` }));
