// Recorta e otimiza a logo e a moeda novas (Draevor) para os slots que a
// ravox-logo.webp e a coin-store.png ocupavam — ver README/estilo destes
// arquivos em client/assets/ui/.
import sharp from 'sharp';
import { removerXadrez } from './extrair-transparencia.mjs';

sharp.cache(false);

const UI = 'C:/Desenvolvimento/DraevorIdle/assets_raw/client/assets/ui';
const LOGO_ORIGEM = 'C:/Users/godra/Downloads/novo/draevor_idle.png';
const MOEDA_ORIGEM = 'C:/Users/godra/Downloads/novo/moeda_draevor.png';

// ---- Logo: mestre em PNG + versão leve em WebP (é o que o site pede: HTML
// referencia sempre o .webp direto, ver assets_raw/*.html) ----
async function logo() {
  const base = sharp(LOGO_ORIGEM).trim(); // corta a margem transparente sobrando
  await base.clone().resize({ width: 1600 }).png({ compressionLevel: 9 }).toFile(`${UI}/draevor-logo.png`);
  await base.clone().resize({ width: 1100 }).webp({ quality: 86 }).toFile(`${UI}/draevor-logo.webp`);
}

// ---- Moeda (Draevor Coins): tira o xadrez de "transparência" que veio
// pintado nos pixels, corta a margem e gera o ícone pequeno da carteira ----
async function moedaIcone() {
  const buf = await (await removerXadrez(MOEDA_ORIGEM)).toBuffer();
  const base = sharp(buf).trim();
  await base.clone().resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 }).toFile(`${UI}/coin-store.png`);
}

await logo();
await moedaIcone();
console.log('logo e moeda regeneradas em', UI);
