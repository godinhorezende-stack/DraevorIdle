// O "Organizar" do editor de atos (dono, 09/10: "o Ato 1 está organizado, os outros estão assim" — fases empilhadas umas sobre as outras):
// as fases num fluxo do canto de baixo à esquerda (o início, com a cidade ao lado) ao de cima à direita (a fase antes do chefe, com o BOSS
// logo depois), como o Ato 1 montado à mão sobre a ilustração. Colunas pela distância desde o início (o caminho mais curto); o caminho até a
// fase do chefe é a linha diagonal, e os ramos ficam acima e abaixo dela, perto de quem leva a eles. Nada se sobrepõe: na mesma coluna as
// fases ficam a uma `VAGA` (80 a 100 px); nas colunas vizinhas (perto demais para os nomes caberem lado a lado) a diagonal deixa as alturas diferentes.
// Pura, sem DOM: o editor e as ferramentas usam a mesma.

/** A área do editor (`editor-atos.mjs`: L × A). */
export const LARGURA = 920;
export const ALTURA = 520;
const X_INICIO = 150;
const X_FIM = 760; // a fase antes do chefe: o BOSS é desenhado 110 px à direita dela
const Y_BAIXO = 420;
const Y_ALTO = 100;
/** Distância entre fases da mesma coluna: a menor destas que deixa as colunas vizinhas a 32 px de altura uma da outra (os nomes). */
const VAGAS = [80, 85, 90, 95, 100];
const NOME = 115; // a largura de um nome sob a fase: colunas mais perto que isto precisam de alturas diferentes
const Y_MIN = 50;
const Y_MAX = 470;
const X_CIDADE = 85; // o nome da cidade (até ~24 letras) centrado sob ela, sem passar da borda

/** `{ fases: Map<id, {x, y}>, cidade: {x, y} | null }` — as posições organizadas de todas as fases do `ato` (e da cidade, se houver). */
export function organizarAto(ato) {
  const ids = (ato.fases ?? []).map((f) => f.id);
  const saidas = new Map(ids.map((id) => [id, []]));
  for (const c of ato.conexoes ?? []) saidas.get(c.de)?.push(c.para);
  // A distância desde o início e quem leva a cada fase no caminho mais curto.
  const prof = new Map();
  const pai = new Map();
  const inicio = saidas.has(ato.inicio) ? ato.inicio : ids[0];
  if (inicio != null) {
    prof.set(inicio, 0);
    const fila = [inicio];
    while (fila.length) {
      const u = fila.shift();
      for (const v of saidas.get(u) ?? []) {
        if (prof.has(v)) continue;
        prof.set(v, prof.get(u) + 1);
        pai.set(v, u);
        fila.push(v);
      }
    }
  }
  let colunas = Math.max(0, ...prof.values());
  // A fase antes do chefe fecha o ato: vai para a última coluna (o BOSS logo à direita).
  const fim = prof.has(ato.bossFinal?.faseAnterior) ? ato.bossFinal.faseAnterior : [...prof.keys()].sort((a, b) => prof.get(b) - prof.get(a))[0];
  const caminho = new Set();
  for (let id = fim; id != null; id = pai.get(id)) caminho.add(id);
  const coluna = new Map(prof);
  if (fim != null) coluna.set(fim, colunas);
  // Fase sem caminho desde o início (o validador reclama): na última coluna, para continuar visível.
  for (const id of ids) if (!coluna.has(id)) coluna.set(id, colunas);
  colunas = Math.max(colunas, 1);
  const xDa = (d) => Math.round(X_INICIO + (d * (X_FIM - X_INICIO)) / colunas);
  const linha = (d) => Y_BAIXO - ((Y_BAIXO - Y_ALTO) * d) / colunas;
  const desce = (Y_BAIXO - Y_ALTO) / colunas;
  const VAGA = (X_FIM - X_INICIO) / colunas >= NOME ? VAGAS[0] : VAGAS.find((v) => Math.min(desce % v, v - (desce % v)) >= 32) ?? 95;
  const pos = new Map();
  for (let d = 0; d <= colunas; d++) {
    const daColuna = ids.filter((id) => coluna.get(id) === d);
    const ocupadas = [];
    const principal = daColuna.find((id) => caminho.has(id));
    if (principal) {
      pos.set(principal, { x: xDa(d), y: Math.round(linha(d)) });
      ocupadas.push(Math.round(linha(d)));
    }
    // Os ramos: perto da altura de quem leva a eles (o de cima fica em cima), nas vagas livres em volta da diagonal.
    const resto = daColuna.filter((id) => id !== principal).sort((a, b) => (pos.get(pai.get(a))?.y ?? linha(d)) - (pos.get(pai.get(b))?.y ?? linha(d)));
    for (const id of resto) {
      const quer = pos.get(pai.get(id))?.y ?? linha(d);
      let melhor = null;
      for (const passo of [VAGA, VAGA / 2]) {
        for (let k = -6; k <= 6; k++) {
          const y = Math.round(linha(d) + k * passo);
          if (y < Y_MIN || y > Y_MAX || ocupadas.some((o) => Math.abs(o - y) < passo - 1)) continue;
          if (melhor == null || Math.abs(y - quer) < Math.abs(melhor - quer)) melhor = y;
        }
        if (melhor != null) break;
      }
      const y = melhor ?? Math.round(linha(d));
      ocupadas.push(y);
      pos.set(id, { x: xDa(d), y });
    }
  }
  // A vaga `y` na coluna `d` serve para `id`? Longe uma vaga das outras da coluna e, nas colunas vizinhas perto demais, a 32 px de altura.
  const vizinhasPerto = (X_FIM - X_INICIO) / colunas < NOME;
  const serve = (id, d, y) =>
    y >= Y_MIN && y <= Y_MAX &&
    ids.every((o) => o === id || !pos.has(o) || (coluna.get(o) === d ? Math.abs(pos.get(o).y - y) >= VAGA - 1 : !vizinhasPerto || Math.abs(coluna.get(o) - d) !== 1 || Math.abs(pos.get(o).y - y) >= 32));
  ajustar(pos, ids, coluna, caminho, ato.conexoes ?? [], (id, d) => Array.from({ length: 13 }, (_, i) => Math.round(linha(d) + (i - 6) * VAGA)).filter((y) => serve(id, d, y)));
  const cidade = ato.cidade ? { x: X_CIDADE, y: Math.max(Y_MIN, Math.round(linha(0) - 130)) } : null;
  return { fases: pos, cidade };
}

/** Distância do ponto `c` ao segmento `a`–`b`. */
function aoSegmento(c, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(c.x - (a.x + t * dx), c.y - (a.y + t * dy));
}
/** Os segmentos `a`–`b` e `c`–`d` se cruzam (sem contar a ponta em comum)? */
function cruzam(a, b, c, d) {
  const lado = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return lado(a, b, c) * lado(a, b, d) < 0 && lado(c, d, a) * lado(c, d, b) < 0;
}
/** O "feio" do desenho: linha passando por cima de uma fase (o pior), linhas se cruzando e o comprimento das linhas. */
function custo(pos, conexoes) {
  const linhas = conexoes.map((c) => [c.de, c.para, pos.get(c.de), pos.get(c.para)]).filter((l) => l[2] && l[3]);
  let total = 0;
  for (const [de, para, a, b] of linhas) {
    total += Math.hypot(b.x - a.x, b.y - a.y) * 0.05;
    for (const [id, c] of pos) if (id !== de && id !== para && aoSegmento(c, a, b) < 28) total += 1000;
  }
  for (let i = 0; i < linhas.length; i++) {
    for (let j = i + 1; j < linhas.length; j++) {
      const [d1, p1, a, b] = linhas[i];
      const [d2, p2, c, d] = linhas[j];
      if (d1 === d2 || d1 === p2 || p1 === d2 || p1 === p2) continue;
      if (cruzam(a, b, c, d)) total += 30;
    }
  }
  return total;
}
/**
 * O ajuste fino: em cada coluna, as fases fora da diagonal trocam de vaga (entre si — o conjunto de alturas da coluna não muda — ou para
 * uma vaga livre que `vagasLivres` aceita) enquanto isso deixa o desenho menos feio (`custo`). A diagonal não se mexe: os nomes continuam
 * sem se tocar.
 */
function ajustar(pos, ids, coluna, caminho, conexoes, vagasLivres) {
  let atual = custo(pos, conexoes);
  for (let rodada = 0; rodada < 6; rodada++) {
    let melhorou = false;
    for (const id of ids) {
      if (caminho.has(id)) continue;
      const d = coluna.get(id);
      const daColuna = ids.filter((o) => o !== id && coluna.get(o) === d);
      const antes = pos.get(id);
      const tentativas = [];
      // Trocar com outra fase da coluna (fora da diagonal).
      for (const o of daColuna) if (!caminho.has(o)) tentativas.push([[id, { ...antes, y: pos.get(o).y }], [o, { ...pos.get(o), y: antes.y }]]);
      // Ir para uma vaga livre (a mesma grade e as mesmas distâncias da primeira arrumação).
      for (const y of vagasLivres(id, d)) if (y !== antes.y) tentativas.push([[id, { ...antes, y }]]);
      for (const troca of tentativas) {
        const guardado = troca.map(([q]) => [q, pos.get(q)]);
        for (const [q, p] of troca) pos.set(q, p);
        const novo = custo(pos, conexoes);
        if (novo < atual - 0.5) {
          atual = novo;
          melhorou = true;
          break;
        }
        for (const [q, p] of guardado) pos.set(q, p);
      }
    }
    if (!melhorou) break;
  }
}
