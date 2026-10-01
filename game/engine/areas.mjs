// A GEOMETRIA das ÁREAS DE EFEITO — uma fonte só, para o servidor (que decide quem
// leva dano) e a tela (que desenha o mesmo espaço). Antes cada sistema tinha a sua
// conta: a forma girada das magias (acoes.mjs), o quadrado da explosão
// (golpes-secundarios.mjs), o círculo e o feixe dos bosses (poderes.mjs), a
// distância em quadrado das mecânicas dos mobs e da árvore. As formas NÃO mudaram:
// cada função aqui é a conta que já existia, agora num lugar só.
//
// Tudo em casas (tiles), coordenadas inteiras do mapa (x para a direita, y para
// BAIXO — norte é y negativo). Uma área é uma lista de `{ x, y }` sem repetição.

/** Distância em casas no grid (Chebyshev: a diagonal conta 1, como o passo). */
export const distancia = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** A chave de uma casa (`"x,y"`), para os índices por casa. */
export const chave = (c) => `${c.x},${c.y}`;

/** O QUADRADO de lado `2·raio + 1` centrado em `centro` (raio 1 = 3×3 = 9 casas). */
export function quadrado(centro, raio) {
  const casas = [];
  for (let dy = -raio; dy <= raio; dy++) for (let dx = -raio; dx <= raio; dx++) casas.push({ x: centro.x + dx, y: centro.y + dy });
  return casas;
}

/** O CÍRCULO de `raio` casas (a conta das áreas dos bosses: dx² + dy² ≤ r² + r). */
export function circulo(centro, raio) {
  const casas = [];
  for (let dy = -raio; dy <= raio; dy++) for (let dx = -raio; dx <= raio; dx++) if (dx * dx + dy * dy <= raio * raio + raio) casas.push({ x: centro.x + dx, y: centro.y + dy });
  return casas;
}

/**
 * A forma "pega só para a frente" (onda, feixe, varredura)? As formas do
 * catálogo vêm desenhadas olhando para o NORTE (só casas com dy <= 0).
 */
export const direcional = (forma) => (forma ?? []).some(([, dy]) => dy < 0) && !(forma ?? []).some(([, dy]) => dy > 0);

/** Gira um deslocamento desenhado para o norte para `dir` (0 norte, 1 leste, 2 sul, 3 oeste — o `dir` do personagem). */
export const girar = ([dx, dy], dir) => (dir === 1 ? [-dy, dx] : dir === 2 ? [-dx, -dy] : dir === 3 ? [dy, -dx] : [dx, dy]);

/** As casas de uma FORMA (lista de deslocamentos `[dx, dy]`) centrada em `centro`, girada para `dir` (null = sem girar). */
export const daForma = (forma, centro, dir = null) =>
  (forma ?? [[0, 0]]).map((d) => (dir == null ? d : girar(d, dir))).map(([dx, dy]) => ({ x: centro.x + dx, y: centro.y + dy }));

/** As casas de uma reta de `de` na direção de `para`, até `alcance` casas de `de` (sem `de`). */
export function reta(de, para, alcance) {
  const dx = para.x - de.x;
  const dy = para.y - de.y;
  const passos = Math.max(Math.abs(dx), Math.abs(dy));
  if (!passos) return [];
  const casas = [];
  for (let i = 1; i <= alcance; i++) casas.push({ x: Math.round(de.x + (dx * i) / passos), y: Math.round(de.y + (dy * i) / passos) });
  return casas;
}

/**
 * O FEIXE (e a onda, com `espalha`) que sai de `de` para o lado de `para` — o eixo
 * dominante —, `comprimento` casas; a onda abre uma casa de cada lado a cada duas.
 */
export function feixe(de, para, comprimento, espalha = false) {
  const dx = para.x - de.x;
  const dy = para.y - de.y;
  const [ux, uy] = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1];
  const casas = [];
  for (let passo = 1; passo <= comprimento; passo++) {
    const largura = espalha ? Math.floor((passo - 1) / 2) : 0;
    for (let l = -largura; l <= largura; l++) casas.push({ x: de.x + ux * passo + uy * l, y: de.y + uy * passo + ux * l });
  }
  return casas;
}

/**
 * A área aumentada (`n` > 0: toda casa a até `n` de uma casa da área entra) ou
 * concentrada (`n` < 0: tira a borda `|n|` vezes, sem sumir com tudo) — as gemas
 * Area of Effect / Concentrated Effect.
 */
export function mudar(casas, n) {
  if (!n || !casas?.length) return casas;
  let conjunto = new Map(casas.map((c) => [chave(c), c]));
  if (n > 0) {
    for (const c of casas) {
      for (let dx = -n; dx <= n; dx++) for (let dy = -n; dy <= n; dy++) {
        const k = `${c.x + dx},${c.y + dy}`;
        if (!conjunto.has(k)) conjunto.set(k, { x: c.x + dx, y: c.y + dy });
      }
    }
    return [...conjunto.values()];
  }
  for (let vez = 0; vez < -n; vez++) {
    const miolo = [...conjunto.values()].filter((c) => {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (!conjunto.has(`${c.x + dx},${c.y + dy}`)) return false;
      return true;
    });
    if (!miolo.length) break; // concentrar não apaga a área inteira
    conjunto = new Map(miolo.map((c) => [chave(c), c]));
  }
  return [...conjunto.values()];
}

/**
 * Quem (de `entidades`, com `x, y`) está DENTRO das `casas` — por índice de casa,
 * sem varrer área × entidades. Devolve na ordem de `entidades`.
 */
export function dentro(casas, entidades) {
  const nas = new Set(casas.map(chave));
  return entidades.filter((e) => nas.has(chave(e)));
}

/**
 * A área como vai para a TELA: um evento só, com o centro e os deslocamentos
 * (`[[dx, dy], ...]`) — o cliente desenha exatamente estas casas (`casasDoEvento`).
 */
export const paraTela = (casas, centro) => casas.map((c) => [c.x - centro.x, c.y - centro.y]);

/** As casas de um evento de área (`{ x, y, casas: [[dx, dy]] }` ou `{ x, y, lado }` da explosão). */
export function casasDoEvento(ev) {
  if (Array.isArray(ev?.casas)) return ev.casas.map(([dx, dy]) => ({ x: ev.x + dx, y: ev.y + dy }));
  return quadrado(ev, Math.floor((ev?.lado ?? 3) / 2));
}
