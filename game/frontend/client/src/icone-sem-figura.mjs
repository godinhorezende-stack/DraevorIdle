/*
 * O ícone de um item SEM figura no atlas (o "?"), e o aviso — uma vez por id — no console.
 * Puro (só mexe no canvas que recebe): `sprites.mjs` usa, e os testes rodam sem navegador.
 * Ver a nota em `sprites.mjs` e `docs/auditoria-icones.md`.
 */
export const avisados = new Set();

export function desenhar(canvas, id, avisar = (texto) => console.warn(texto)) {
  canvas.dataset.semIcone = String(id);
  const ctx = canvas.getContext?.('2d');
  if (ctx) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.55)';
    ctx.setLineDash?.([3, 2]);
    ctx.lineWidth = 1;
    ctx.strokeRect(4.5, 4.5, w - 9, h - 9);
    ctx.setLineDash?.([]);
    ctx.fillStyle = 'rgba(220, 220, 220, 0.8)';
    ctx.font = `bold ${Math.round(h * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', w / 2, h / 2 + 1);
  }
  if (!avisados.has(id)) {
    avisados.add(id);
    avisar(`[ícone] item ${id} sem figura no atlas — desenhado o "?" (ver docs/auditoria-icones.md).`);
  }
}
