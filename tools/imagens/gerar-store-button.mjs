// store-button.png tinha "RAVOX STORE" pintado direto nos pixels (não é
// texto de HTML) — foi o único botão assim que apareceu no HUD depois do
// rebrand de texto. Refaço no mesmo formato (pílula com moldura dourada e
// estudo de diamante nas pontas, linguagem dos outros ícones de UI).
import sharp from 'sharp';

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 126">
  <defs>
    <linearGradient id="fundo" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f3d3f"/>
      <stop offset="55%" stop-color="#0a2426"/>
      <stop offset="100%" stop-color="#071a1c"/>
    </linearGradient>
    <linearGradient id="borda" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffdf9b"/>
      <stop offset="45%" stop-color="#c9922f"/>
      <stop offset="100%" stop-color="#7a4d13"/>
    </linearGradient>
    <linearGradient id="ouro" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fff3cf"/>
      <stop offset="40%" stop-color="#f3c25c"/>
      <stop offset="70%" stop-color="#c9922f"/>
      <stop offset="100%" stop-color="#8a5a18"/>
    </linearGradient>
    <linearGradient id="diamante" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8ff3ff"/>
      <stop offset="100%" stop-color="#0f8f9e"/>
    </linearGradient>
  </defs>
  <rect x="5" y="5" width="510" height="116" rx="30" fill="url(#fundo)" stroke="url(#borda)" stroke-width="6"/>
  <rect x="12" y="11" width="496" height="40" rx="20" fill="#ffffff" opacity=".06"/>
  <g transform="translate(38,63)">
    <path d="M -14 0 L 0 -18 L 14 0 L 0 18 Z" fill="url(#diamante)" stroke="#0a2426" stroke-width="2"/>
    <path d="M -5 0 L 0 -7 L 5 0 L 0 7 Z" fill="#eafffe"/>
  </g>
  <g transform="translate(482,63)">
    <path d="M -14 0 L 0 -18 L 14 0 L 0 18 Z" fill="url(#diamante)" stroke="#0a2426" stroke-width="2"/>
    <path d="M -5 0 L 0 -7 L 5 0 L 0 7 Z" fill="#eafffe"/>
  </g>
  <text x="260" y="79" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700"
        font-size="48" letter-spacing="6" fill="url(#ouro)" stroke="#5a3410" stroke-width="1.5" paint-order="stroke">
    STORE
  </text>
</svg>`;

await sharp(Buffer.from(svg)).resize(520, 126).png()
  .toFile('C:/Desenvolvimento/DraevorIdle/assets_raw/client/assets/ui/store-button.png');
console.log('store-button.png regenerado');
