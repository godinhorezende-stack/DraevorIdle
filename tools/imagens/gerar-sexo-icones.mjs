// Gera os medalhões de sexo (masculino/feminino) da tela de criação de
// personagem — assets_raw/client/assets/ui/sexo-masculino.webp e
// sexo-feminino.webp — que faltavam (auth.mjs já os referenciava).
//
// Uma placa de pedra redonda com o símbolo pintado na cor do sexo (azul para
// Marte/masculino, vermelho para Vênus/feminino), moldura na mesma cor do
// símbolo — é o que o CSS de style.css (.sexo-icone) já espera.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

sharp.cache(false);

const SAIDA = fileURLToPath(new URL('../../assets_raw/client/assets/ui/', import.meta.url));

function placa({ corClara, corEscura, aro }) {
  return `
    <radialGradient id="pedra" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#9a9ca3"/>
      <stop offset="55%" stop-color="#6c6e75"/>
      <stop offset="100%" stop-color="#3d3f45"/>
    </radialGradient>
    <linearGradient id="aro" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${corClara}"/>
      <stop offset="100%" stop-color="${corEscura}"/>
    </linearGradient>
    <radialGradient id="simbolo" cx="35%" cy="25%" r="80%">
      <stop offset="0%" stop-color="${corClara}"/>
      <stop offset="100%" stop-color="${corEscura}"/>
    </radialGradient>
    <circle cx="100" cy="100" r="94" fill="url(#pedra)" stroke="url(#aro)" stroke-width="${aro}"/>
    <circle cx="100" cy="100" r="94" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/>
    <ellipse cx="72" cy="58" rx="46" ry="26" fill="#fff" opacity=".08"/>
  `;
}

const marte = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>${placa({ corClara: '#5b9dff', corEscura: '#1c3f8f', aro: 7 })}</defs>
  <g fill="none" stroke="url(#simbolo)" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="82" cy="126" r="30" stroke-width="15"/>
    <path d="M 103 105 L 138 70" stroke-width="15"/>
    <path d="M 110 62 L 141 62 L 141 93" stroke-width="15"/>
  </g>
</svg>`;

const venus = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>${placa({ corClara: '#ff6b85', corEscura: '#8f1c33', aro: 7 })}</defs>
  <g fill="none" stroke="url(#simbolo)" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="100" cy="82" r="32" stroke-width="15"/>
    <path d="M 100 114 L 100 158" stroke-width="15"/>
    <path d="M 76 138 L 124 138" stroke-width="15"/>
  </g>
</svg>`;

async function gerar(nome, svg) {
  const destino = join(SAIDA, `sexo-${nome}.webp`);
  await sharp(Buffer.from(svg)).resize(256, 256).webp({ quality: 92 }).toFile(destino);
  console.log('gerado', destino);
}

await gerar('masculino', marte);
await gerar('feminino', venus);
