// O RAIO DE ILUMINAÇÃO na tela da caçada (lote "luz", dono 02/11: "escuridão em volta"). Só no modo PoE: o servidor manda `luz` no retrato
// da caçada (`systems/itens-poe/iluminacao.mjs` → `snapshotDaHunt.luz`: o raio agora em casas e o tamanho do personagem); sem `luz` (a
// cidade, o modo clássico), nada muda.
//
//   - a ESCURIDÃO: um gradiente radial em volta do personagem — claro até `miolo` × o raio, escurecendo até `borda` × o raio, e daí para fora
//     um véu escuro de `escuridao` (não é preto total: a tela continua jogável e o mapa aparece por baixo);
//   - os MONSTROS fora da luz saem apagados (a transparência cai de 1 até `apagado` entre o raio e a borda);
//   - o TAMANHO: o desenho da criatura na escala (`luz.tamanho` no personagem, `escala` no monstro e no lacaio), pelos pés.
// Puro (sem DOM): o `map.mjs` chama com o contexto do canvas; os testes chamam as contas.

export const LUZ_DA_TELA = Object.freeze({ miolo: 0.6, borda: 1.3, escuridao: 0.72, apagado: 0.45, cor: '6,8,16', escalaMinima: 0.5, escalaMaxima: 2, velocidade: 6 });

/** O raio da luz em PIXELS do canvas (casas × o tamanho da casa), ou null sem luz. */
export function raioEmPixels(luz, tile = 32) {
  const r = Number(luz?.raio);
  return Number.isFinite(r) && r > 0 ? r * tile : null;
}

/** O gradiente da escuridão: os raios (interno, externo) e as paradas `[posição, cor]`. */
export function gradienteDaLuz(raioPx, opcoes = LUZ_DA_TELA) {
  const interno = Math.max(1, raioPx * opcoes.miolo);
  const externo = Math.max(interno + 1, raioPx * opcoes.borda);
  const a = opcoes.escuridao;
  return {
    interno,
    externo,
    paradas: [
      [0, `rgba(${opcoes.cor},0)`],
      [0.45, `rgba(${opcoes.cor},${(a * 0.45).toFixed(3)})`],
      [1, `rgba(${opcoes.cor},${a})`],
    ],
  };
}

/** Desenha a escuridão no canvas (`cx`, `cy`: o centro da luz em pixels do canvas). */
export function desenharEscuridao(ctx, cx, cy, raioPx, largura, altura, opcoes = LUZ_DA_TELA) {
  if (!ctx || !(raioPx > 0)) return false;
  const g = gradienteDaLuz(raioPx, opcoes);
  const grad = ctx.createRadialGradient(cx, cy, g.interno, cx, cy, g.externo);
  for (const [p, cor] of g.paradas) grad.addColorStop(p, cor);
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, largura, altura);
  ctx.restore();
  return true;
}

/** A transparência de uma criatura a `dist` pixels do centro da luz: 1 dentro do raio, caindo até `apagado` na borda. */
export function alfaNaLuz(dist, raioPx, opcoes = LUZ_DA_TELA) {
  if (!(raioPx > 0) || !(dist > raioPx)) return 1;
  const borda = raioPx * opcoes.borda;
  if (dist >= borda) return opcoes.apagado;
  const t = (dist - raioPx) / Math.max(1, borda - raioPx);
  return 1 - (1 - opcoes.apagado) * t;
}

/** Está fora da luz? */
export const foraDaLuz = (dist, raioPx) => raioPx > 0 && dist > raioPx;

/** A escala do desenho (× 1 = normal), nos limites. */
export function escalaDoDesenho(x, opcoes = LUZ_DA_TELA) {
  const n = Number(x);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(opcoes.escalaMinima, Math.min(opcoes.escalaMaxima, n));
}

/** O raio visto anda até o raio do servidor (sem pulo quando a vida cai): `dtMs` desde o último quadro. */
export function suavizarRaio(visto, alvo, dtMs, opcoes = LUZ_DA_TELA) {
  if (!(alvo > 0)) return null;
  if (!(visto > 0)) return alvo;
  const k = 1 - Math.exp((-opcoes.velocidade * Math.max(0, dtMs)) / 1000);
  const novo = visto + (alvo - visto) * k;
  return Math.abs(novo - alvo) < 0.25 ? alvo : novo;
}
