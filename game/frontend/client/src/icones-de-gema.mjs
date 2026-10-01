/*
 * ---- OS ÍCONES DAS GEMAS (arte própria, 01/10) ----
 *
 * O dono pediu ícones de gema; os do Path of Exile não podem entrar (a arte é
 * deles). Aqui cada gema ganha um ícone DESENHADO no canvas, a partir dos dados
 * dela (`meta.gemaDef`, o mesmo que o servidor manda no catálogo):
 *
 *   ataque  → gema lapidada com facetas, na cor do ELEMENTO; o corte segue o
 *             tipo (alongado: projétil/alvo único; largo: área/onda; pipa: cadeia);
 *   cura    → cabochão redondo verde-água;
 *   reforço → lapidação quadrada (octógono) âmbar;
 *   suporte → pérola redonda, prateada (ou no tom do elemento que exige).
 *
 * Um tom levemente diferente por gema (pelo id), para duas do mesmo elemento
 * não ficarem idênticas. Gemas novas no catálogo ganham ícone sozinhas.
 */

const COR_DO_ELEMENTO = {
  fire: [12, 82, 52],
  ice: [196, 78, 64],
  energy: [268, 82, 64],
  earth: [104, 52, 46],
  holy: [46, 86, 60],
  death: [282, 48, 40],
  physical: [32, 14, 64],
};
const COR_DA_CATEGORIA = { cura: [158, 62, 52], reforco: [36, 84, 54], suporte: [214, 18, 72] };
// A support pela FAMÍLIA do efeito dela (a chave de `efeito`): o que ela faz dá a cor.
const COR_DA_SUPPORT = [
  [['igniteChance', 'ignitePct'], [14, 86, 54]],
  [['congelarChance'], [196, 80, 66]],
  [['lentidaoPct'], [262, 50, 58]],
  [['atordoarChance'], [52, 88, 56]],
  [['critChance', 'critDano'], [30, 90, 56]],
  [['alvosExtras', 'perfurar', 'bifurcar', 'encadear', 'retornar', 'explosaoPct', 'segundaExplosaoPct', 'areaExtra'], [208, 74, 58]],
  [['castTimePct', 'recargaPct', 'custoPct', 'custoEmVida'], [120, 52, 50]],
  [['leechVidaPct', 'leechManaPct', 'curaPct', 'duracaoPct'], [292, 46, 58]],
  [['danoPct'], [0, 68, 52]],
];
const ELEMENTOS = Object.keys(COR_DO_ELEMENTO);

/** Um número estável por gema (variação de tom). */
const hash = (n) => {
  let h = Number(n) * 2654435761;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h % 1000) / 1000;
};
const hsl = (h, s, l, a = 1) => `hsla(${h}, ${s}%, ${Math.max(0, Math.min(100, l))}%, ${a})`;

/** A cor base `[h, s, l]` da gema. */
function corDaGema(def, id) {
  const tags = def.tags ?? [];
  let base;
  if (def.categoria === 'ataque') base = COR_DO_ELEMENTO[ELEMENTOS.find((e) => tags.includes(e)) ?? 'physical'];
  else if (def.categoria === 'suporte') {
    // A support que EXIGE um elemento leva o tom dele; a genérica, prata.
    const el = (def.requer ?? []).find((t) => COR_DO_ELEMENTO[t]);
    const chaves = Object.keys(def.efeito ?? {});
    const familia = COR_DA_SUPPORT.find(([ks]) => ks.some((k) => chaves.includes(k)));
    base = el ? COR_DO_ELEMENTO[el] : familia ? familia[1] : COR_DA_CATEGORIA.suporte;
  } else base = COR_DA_CATEGORIA[def.categoria] ?? COR_DA_CATEGORIA.suporte;
  const v = hash(id) - 0.5;
  // Cura e reforço são uma cor só: variam mais de uma gema para outra.
  const amplo = def.categoria === 'cura' || def.categoria === 'reforco';
  return [base[0] + v * (amplo ? 36 : 14), base[1], base[2] + v * (amplo ? 14 : 8)];
}

/** O contorno da gema (pontos de -1..1) pelo corte. */
function corte(def) {
  const tags = def.tags ?? [];
  if (def.categoria === 'cura' || def.categoria === 'suporte') return null; // redonda
  if (def.categoria === 'reforco') {
    // Octógono (lapidação quadrada com cantos chanfrados).
    const c = 0.42;
    return [[-c, -1], [c, -1], [1, -c], [1, c], [c, 1], [-c, 1], [-1, c], [-1, -c]];
  }
  if (tags.includes('chain')) return [[0, -1], [0.8, -0.3], [0.45, 1], [-0.45, 1], [-0.8, -0.3]]; // pipa
  if (tags.includes('area') || tags.includes('wave') || tags.includes('line')) return [[-0.55, -0.8], [0.55, -0.8], [1, 0], [0.55, 0.85], [-0.55, 0.85], [-1, 0]]; // hexágono largo
  return [[0, -1], [0.7, -0.45], [0.7, 0.45], [0, 1], [-0.7, 0.45], [-0.7, -0.45]]; // alongado
}

/** Desenha o ícone de uma gema num canvas `tamanho` × `tamanho`. */
export function desenharGema(def, id, tamanho = 32) {
  const c = document.createElement('canvas');
  c.width = c.height = tamanho;
  const g = c.getContext('2d');
  const [h, s, l] = corDaGema(def, id);
  const cx = tamanho / 2;
  const cy = tamanho / 2 + 0.5;
  const r = tamanho * 0.4;
  const pontos = corte(def);
  const caminho = () => {
    g.beginPath();
    if (!pontos) g.arc(cx, cy, def.categoria === 'suporte' ? r * 0.82 : r * 0.92, 0, Math.PI * 2);
    else pontos.forEach(([x, y], i) => (i ? g.lineTo(cx + x * r, cy + y * r) : g.moveTo(cx + x * r, cy + y * r)));
    g.closePath();
  };
  // Sombra no chão.
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(cx + 1, cy + r * 0.95, r * 0.7, r * 0.18, 0, 0, Math.PI * 2);
  g.fill();
  // O corpo: degradê do tom (claro em cima, escuro embaixo).
  caminho();
  const corpo = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  corpo.addColorStop(0, hsl(h, s, l + 22));
  corpo.addColorStop(0.5, hsl(h, s, l));
  corpo.addColorStop(1, hsl(h, s, l - 24));
  g.fillStyle = corpo;
  g.fill();
  g.save();
  caminho();
  g.clip();
  if (pontos) {
    // As FACETAS: triângulos do centro até cada lado, com luz alternada.
    pontos.forEach(([x1, y1], i) => {
      const [x2, y2] = pontos[(i + 1) % pontos.length];
      const meioY = (y1 + y2) / 2;
      g.beginPath();
      g.moveTo(cx, cy - r * 0.1);
      g.lineTo(cx + x1 * r, cy + y1 * r);
      g.lineTo(cx + x2 * r, cy + y2 * r);
      g.closePath();
      g.fillStyle = meioY < 0 ? `rgba(255,255,255,${0.08 + (i % 2) * 0.1})` : `rgba(0,0,0,${0.06 + (i % 2) * 0.12})`;
      g.fill();
    });
    // A "mesa" (a face de cima, menor e mais clara).
    g.beginPath();
    pontos.forEach(([x, y], i) => {
      const px = cx + x * r * 0.45;
      const py = cy - r * 0.12 + y * r * 0.4;
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    });
    g.closePath();
    g.fillStyle = hsl(h, s - 10, l + 26, 0.55);
    g.fill();
  } else {
    // Redonda: o reflexo curvo e o brilho interno.
    const interno = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.05, cx, cy, r);
    interno.addColorStop(0, 'rgba(255,255,255,0.75)');
    interno.addColorStop(0.35, hsl(h, s, l + 10, 0.2));
    interno.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = interno;
    g.fillRect(0, 0, tamanho, tamanho);
    if (def.categoria === 'suporte') {
      // O aro da pérola (a support se "encaixa" nas outras).
      g.strokeStyle = hsl(h, s, l + 30, 0.6);
      g.lineWidth = tamanho / 32;
      g.beginPath();
      g.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      g.stroke();
    }
  }
  g.restore();
  // O contorno escuro e um fio de luz.
  caminho();
  g.strokeStyle = hsl(h, s, l - 36);
  g.lineWidth = Math.max(1, tamanho / 24);
  g.stroke();
  // O símbolo da categoria: "+" na cura, uma divisa (▲) no reforço.
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = Math.max(1.2, tamanho / 18);
  g.lineCap = 'round';
  if (def.categoria === 'cura') {
    g.beginPath();
    g.moveTo(cx - r * 0.32, cy);
    g.lineTo(cx + r * 0.32, cy);
    g.moveTo(cx, cy - r * 0.32);
    g.lineTo(cx, cy + r * 0.32);
    g.stroke();
  } else if (def.categoria === 'reforco') {
    g.beginPath();
    g.moveTo(cx - r * 0.34, cy + r * 0.2);
    g.lineTo(cx, cy - r * 0.2);
    g.lineTo(cx + r * 0.34, cy + r * 0.2);
    g.stroke();
  }
  // O brilho: um ponto branco no alto à esquerda.
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.arc(cx - r * 0.32, cy - r * 0.42, Math.max(1, tamanho / 22), 0, Math.PI * 2);
  g.fill();
  return c;
}
