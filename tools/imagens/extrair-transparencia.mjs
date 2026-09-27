// A arte nova (moeda_draevor.png) veio sem canal alfa de verdade: o fundo
// "xadrez" de transparência do editor foi salvo como pixel cinza literal.
// Isto recupera o alfa: enche por flood-fill (a partir da borda) todo pixel
// cinza no tom do xadrez (dois tons: ~135 e ~195, sem saturação) que esteja
// CONECTADO à borda — assim um cinza parecido que por acaso apareça dentro do
// desenho (sombra, aço) não vira buraco, só o fundo de fato vira transparente.
import sharp from 'sharp';

function ehXadrez(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min > 12) return false; // teria de ser cinza puro
  // Os dois tons do xadrez (~135 e ~195) MAIS a faixa borrada entre eles nas
  // bordas de cada quadrado de 12px — sem isso sobrava uma grade fina cinza.
  return r >= 115 && r <= 215;
}

export async function removerXadrez(caminhoEntrada) {
  const { data, info } = await sharp(caminhoEntrada).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const fundo = new Uint8Array(w * h); // 1 = é fundo (vira transparente)
  const pilha = [];
  const marcar = (x, y) => {
    const idx = y * w + x;
    if (x < 0 || y < 0 || x >= w || y >= h || fundo[idx]) return;
    const i = idx * ch;
    if (!ehXadrez(data[i], data[i + 1], data[i + 2])) return;
    fundo[idx] = 1;
    pilha.push(idx);
  };
  for (let x = 0; x < w; x++) { marcar(x, 0); marcar(x, h - 1); }
  for (let y = 0; y < h; y++) { marcar(0, y); marcar(w - 1, y); }
  while (pilha.length) {
    const idx = pilha.pop();
    const x = idx % w, y = (idx / w) | 0;
    marcar(x + 1, y); marcar(x - 1, y); marcar(x, y + 1); marcar(x, y - 1);
  }
  /*
   * O que sobra não-xadrez tem lixo solto (rachaduras da textura que vazaram
   * do desenho, sujeira de compressão) que não é xadrez e por isso escapou do
   * flood-fill acima. Em vez de tentar reconhecer essa sujeira pela cor, acho
   * os componentes conectados do que sobrou e fico só com o MAIOR — a moeda
   * em si é sempre a maior mancha contígua; o resto vira transparente também.
   */
  const visitado = new Uint8Array(w * h);
  let maiorTamanho = 0;
  let maiorPixels = null;
  for (let ini = 0; ini < w * h; ini++) {
    if (fundo[ini] || visitado[ini]) continue;
    const pixels = [ini];
    visitado[ini] = 1;
    const pilha2 = [ini];
    while (pilha2.length) {
      const idx = pilha2.pop();
      const x = idx % w, y = (idx / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nidx = ny * w + nx;
        if (fundo[nidx] || visitado[nidx]) continue;
        visitado[nidx] = 1;
        pixels.push(nidx);
        pilha2.push(nidx);
      }
    }
    if (pixels.length > maiorTamanho) { maiorTamanho = pixels.length; maiorPixels = pixels; }
  }
  const mantido = new Uint8Array(w * h);
  if (maiorPixels) for (const idx of maiorPixels) mantido[idx] = 1;
  for (let idx = 0; idx < w * h; idx++) {
    if (!mantido[idx]) data[idx * ch + 3] = 0;
  }
  return sharp(data, { raw: { width: w, height: h, channels: ch } })
    .blur(0.4) // suaviza a serrilha do xadrez de 12px na borda do círculo
    .png();
}
