// Busca de caminho na grade da hunt: distâncias, o próximo passo, a casa livre mais perto.
// Parte de `cacadas.mjs` (dividido em 2026-09-25); a fachada continua lá.

/*
 * ---- BFS de verdade: sem isso, a caverna real trava o passo "guloso" ----
 *
 * A primeira versão só apontava pro alvo (`Math.sign(dx)`) e tentava o eixo
 * sozinho se a diagonal travasse — funcionava na sala vazia dos testes, mas
 * a caverna REAL capturada tem corredor estreito e sinuoso: um beco sem
 * saída na direção do alvo trava esse jeito pra sempre (a única saída é
 * andar num sentido que por um instante afasta do alvo, e um passo guloso
 * nunca escolhe isso). BFS a partir do DESTINO — uma vez só, reaproveitada
 * por todo bicho perseguindo no mesmo tique — dá a distância real de cada
 * casa andável até lá; o próximo passo é sempre o vizinho com a menor
 * distância, o que sempre acerta o caminho por qualquer curva, sem nunca
 * ficar preso. Mapa de uma hunt tem ~1-2 mil casas andáveis —rodar isto a
 * 4x/s não pesa nada.
 */
export const VIZINHANCA_8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
/*
 * ---- Andar reto, diagonal só quando precisa ----
 *
 * "os bonecos andam reto de preferência, só se tiver tudo colidindo aí ainda
 * diagonal — tanto o player quanto o monstro". Como no Tibia (onde o passo
 * diagonal custa 3x): o caminho é buscado primeiro só com passos RETOS
 * (`VIZINHANCA_4`); a diagonal entra só quando não há caminho reto — parede,
 * ou outro bicho ocupando a casa.
 */
export const VIZINHANCA_4 = VIZINHANCA_8.slice(0, 4);

/*
 * `limite` corta a busca numa profundidade (os bichos só enxergam até
 * `ALCANCE_DE_PERCEPCAO`), e `alvo` para assim que o anel seguinte ao dele
 * fecha — é tudo o que `proximoPassoAte` precisa. Sem os dois, cada tique
 * varria o mapa inteiro (~15 mil casas) duas vezes; a caçada offline, que roda
 * milhares de tiques de uma vez, levava mais de um minuto para 2h fora.
 */
/*
 * ---- A mesma busca, numa grade de números ----
 *
 * Era um `Map` com a chave "x,y" em texto para cada casa visitada: no teste
 * de carga (tools/carga.mjs, 30 jogadores) a busca e o `moverMonstros` que a
 * chama eram 2 s de CPU em 12 s. Aqui a grade andável vira um `Uint8Array`
 * uma vez por mapa (`gradeNumerica`), e a distância, um `Int16Array`: mesma
 * ordem de visita, mesmos cortes, mesmo resultado (o teste
 * `testes/caminho.test.mjs` compara com a versão antiga, `bfsDistanciasAntiga`).
 */
export function gradeNumerica(grade) {
  if (grade.numerica) return grade.numerica;
  const x0 = grade.minX;
  const y0 = grade.minY;
  const W = grade.maxX - x0 + 1;
  const H = grade.maxY - y0 + 1;
  const livre = new Uint8Array(W * H);
  for (const k of grade.andavel) {
    const i = k.indexOf(',');
    const x = Number(k.slice(0, i)) - x0;
    const y = Number(k.slice(i + 1)) - y0;
    if (x >= 0 && x < W && y >= 0 && y < H) livre[y * W + x] = 1;
  }
  Object.defineProperty(grade, 'numerica', { value: { x0, y0, W, H, livre }, enumerable: false });
  return grade.numerica;
}

/** As distâncias de uma busca: `em(x, y)` (ou `get("x,y")`, como o `Map` de antes); `undefined` = não chegou. */
export class Distancias {
  constructor(g, dist) {
    this.g = g;
    this.dist = dist;
  }
  em(x, y) {
    const { x0, y0, W, H } = this.g;
    const X = x - x0;
    const Y = y - y0;
    if (X < 0 || Y < 0 || X >= W || Y >= H) return undefined;
    const d = this.dist[Y * W + X];
    return d < 0 ? undefined : d;
  }
  get(chave) {
    const i = chave.indexOf(',');
    return this.em(Number(chave.slice(0, i)), Number(chave.slice(i + 1)));
  }
  has(chave) {
    return this.get(chave) !== undefined;
  }
}

export function bfsDistancias(grade, origem, limite = Infinity, alvo = null, vizinhos = VIZINHANCA_8, bloqueado = null) {
  const g = gradeNumerica(grade);
  const { x0, y0, W, H, livre } = g;
  const dist = new Int16Array(W * H).fill(-1);
  const fila = new Int32Array(W * H + 1);
  const ox = origem.x - x0;
  const oy = origem.y - y0;
  // A origem entra mesmo fora da grade ou bloqueada (como antes); só não vira casa da fila fora dela.
  if (ox < 0 || oy < 0 || ox >= W || oy >= H) return new Distancias(g, dist);
  dist[oy * W + ox] = 0;
  let fim = 0;
  fila[fim++] = oy * W + ox;
  const alvoI = alvo && alvo.x - x0 >= 0 && alvo.y - y0 >= 0 && alvo.x - x0 < W && alvo.y - y0 < H ? (alvo.y - y0) * W + (alvo.x - x0) : -1;
  let ateOnde = limite;
  for (let i = 0; i < fim; i++) {
    const atual = fila[i];
    const d = dist[atual];
    if (d >= ateOnde) break;
    const ax = atual % W;
    const ay = (atual - ax) / W;
    for (const [dx, dy] of vizinhos) {
      const px = ax + dx;
      const py = ay + dy;
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const p = py * W + px;
      if (dist[p] >= 0 || !livre[p]) continue;
      if (bloqueado && p !== alvoI && bloqueado.has(`${px + x0},${py + y0}`)) continue;
      dist[p] = d + 1;
      fila[fim++] = p;
      if (p === alvoI) ateOnde = Math.min(ateOnde, d + 2);
    }
  }
  return new Distancias(g, dist);
}

/** A versão antiga, só para o teste provar que a nova dá o mesmo resultado. */
export function bfsDistanciasAntiga(grade, origem, limite = Infinity, alvo = null, vizinhos = VIZINHANCA_8, bloqueado = null) {
  const dist = new Map([[`${origem.x},${origem.y}`, 0]]);
  const fila = [origem];
  const chaveDoAlvo = alvo ? `${alvo.x},${alvo.y}` : null;
  let ateOnde = limite;
  for (let i = 0; i < fila.length; i++) {
    const atual = fila[i];
    const d = dist.get(`${atual.x},${atual.y}`);
    if (d >= ateOnde) break;
    for (const [dx, dy] of vizinhos) {
      const prox = { x: atual.x + dx, y: atual.y + dy };
      const chave = `${prox.x},${prox.y}`;
      if (dist.has(chave) || !grade.andavel.has(chave) || (bloqueado?.has(chave) && chave !== chaveDoAlvo)) continue;
      dist.set(chave, d + 1);
      fila.push(prox);
      if (chave === chaveDoAlvo) ateOnde = Math.min(ateOnde, d + 2);
    }
  }
  return dist;
}

/** O vizinho andável de `origem` com a menor distância até `destino` (ou `null` se não há caminho). */
export function proximoPassoAte(grade, origem, destino, ocupado = null, bloqueado = null) {
  // Primeiro contornando os bichos (`bloqueado`), só passos retos; depois com
  // diagonal; e só sem caminho nenhum assim, atravessando a leva (o passo em
  // si ainda não pisa em bicho — `ocupado`).
  const tentativas = [
    [VIZINHANCA_4, bloqueado],
    [VIZINHANCA_8, bloqueado],
    [VIZINHANCA_4, null],
    [VIZINHANCA_8, null],
  ].filter(([, b], k) => b || k >= 2);
  for (const [vizinhos, bloq] of tentativas) {
    const dist = bfsDistancias(grade, destino, Infinity, origem, vizinhos, bloq);
    let melhor = null;
    let melhorD = dist.em(origem.x, origem.y) ?? Infinity;
    for (const [dx, dy] of vizinhos) {
      const viz = { x: origem.x + dx, y: origem.y + dy };
      const d = dist.em(viz.x, viz.y);
      if (d == null || d >= melhorD || ocupado?.(viz)) continue;
      melhorD = d;
      melhor = viz;
    }
    if (melhor) return melhor;
  }
  return null;
}

/** A casa andável mais perto de `(x,y)` — em espiral, para nunca nascer numa casa bloqueada. */
export function casaAndavelMaisProxima(grade, x, y) {
  if (grade.andavel.has(`${x},${y}`)) return { x, y };
  for (let raio = 1; raio < 40; raio++) {
    for (let dx = -raio; dx <= raio; dx++) {
      for (let dy = -raio; dy <= raio; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== raio) continue;
        const cx = x + dx;
        const cy = y + dy;
        if (grade.andavel.has(`${cx},${cy}`)) return { x: cx, y: cy };
      }
    }
  }
  return { x, y };
}

/** Até quantas casas do ponto de spawn o bicho ainda nasce (ver a densidade, em `entrar`). */
export const RAIO_DO_SPAWN = 3;

/** A casa andável e livre (`ocupada`) mais perto de `p`, a até `RAIO_DO_SPAWN` casas — ou `null`. */
export function casaLivrePerto(grade, p, ocupada) {
  for (let raio = 0; raio <= RAIO_DO_SPAWN; raio++) {
    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== raio) continue;
        const c = { x: p.x + dx, y: p.y + dy };
        if (grade.andavel.has(`${c.x},${c.y}`) && !ocupada(c)) return c;
      }
    }
  }
  return null;
}

/** Distância de Chebyshev — a mesma regra de alcance do resto do jogo (ver `inventario.mjs`). */
export const distancia = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/*
 * ---- Andar até onde se clicou/tocou ----
 *
 * O clique (desktop) e o toque (celular) no mapa viram o mesmo pedido — `walkTo`
 * na cidade, `huntWalkTo` na Caça Online — e os dois andam pela MESMA busca de
 * sempre: um passo por vez, `proximoPassoAte` recalculado a cada passo (os bichos
 * andam, a casa livre de agora pode não ser a de daqui a pouco), no ritmo do
 * passo do servidor. Aqui fica só a validação do pedido: a casa tem caminho a
 * partir de onde ele está, em até `CAMINHO_MAXIMO` passos? (Uma busca só, na
 * hora do clique, e não a cada tique.)
 */
export const CAMINHO_MAXIMO = 128;
export function temCaminho(grade, origem, destino, limite = CAMINHO_MAXIMO) {
  if (origem.x === destino.x && origem.y === destino.y) return true;
  return bfsDistancias(grade, destino, limite, origem).em(origem.x, origem.y) != null;
}
