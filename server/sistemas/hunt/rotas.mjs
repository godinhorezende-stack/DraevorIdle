// Montagem do percurso da Caça Automática: pelos bichos, pela rota gravada, pelas salas geradas.
// Parte de `cacadas.mjs` (dividido em 2026-09-25); a fachada continua lá.
import { destinoDaMudanca } from './andares.mjs';
import { VIZINHANCA_8, RAIO_DO_SPAWN, distancia } from './caminho.mjs';

/*
 * ---- O percurso: o laço que a Caça Automática roda sem parar ----
 *
 * "nas hunts parece que o boneco não entra em um loop infinito de caça andando"
 *
 * Cada mapa real capturado traz `route`: o caminho que a Caça Automática do
 * original anda, casa por casa (311 casas em Werelions -1), e na maioria das
 * hunts ele é um LAÇO — a última casa encosta na primeira. O original manda a
 * posição nele em todo quadro (`run: {passo: 158}`, capturado), e o client
 * conta as voltas completas (`huntLaps`: "Você já completou este percurso Nx").
 *
 * Aqui o servidor só usava `route[0]` como ponto de entrada, e o alvo era "o
 * bicho vivo mais perto em QUALQUER lugar do mapa": morto o que estava perto, o
 * personagem atravessava a caverna atrás do próximo, e com todos esperando
 * renascer ele ficava PARADO. Agora, sem bicho à vista, ele anda o percurso.
 *
 * Rota que sobe e desce escadas (Dark Pyramid vai do 5 ao 11) fica INTEIRA,
 * com o andar de cada waypoint: a troca de andar é o passo de um waypoint para
 * o seguinte (ver `passoNoPercurso` e o bloco "Os andares da hunt"). Antes os
 * waypoints de outro andar saíam e a hunt inteira acontecia num andar só.
 *
 * Rota de um andar só: o caminho entre dois waypoints longe um do outro é o
 * mesmo BFS de sempre (`proximoPassoAte`). Waypoint em casa bloqueada sai.
 */
export function percursoDoMapa(real, andavel) {
  const rota = real.route ?? [];
  if (new Set(rota.map((p) => p.z ?? real.z)).size > 1) {
    const livre = (p) => {
      const blocked = real.floors?.[p.z]?.blocked;
      return blocked && !blocked[p.y * real.width + p.x];
    };
    const pontos = rota.filter(livre).map(({ x, y, z }) => ({ x, y, z }));
    return pontos.length >= 2 ? pontos : null;
  }
  const pontos = rota.filter((p) => (p.z ?? real.z) === real.z && andavel.has(`${p.x},${p.y}`));
  /*
   * Só os waypoints da mesma ILHA do andar: o pedaço de chão ligado onde fica
   * a maior parte deles. Uma rota que sobe a escada e desce por outra deixa
   * waypoints em pedaços do andar sem ligação entre si (Medusa Tower: 41
   * waypoints no andar 7, espalhados) — inalcançáveis, eles eram pulados um
   * por tique e cada pulo no fim da lista contava uma volta (334 "voltas" em
   * 10 minutos).
   */
  const ilha = new Map();
  let proxima = 0;
  for (const chave of andavel) {
    if (ilha.has(chave)) continue;
    const fila = [chave];
    ilha.set(chave, proxima);
    for (let i = 0; i < fila.length; i++) {
      const [x, y] = fila[i].split(',').map(Number);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const v = `${x + dx},${y + dy}`;
          if ((dx || dy) && andavel.has(v) && !ilha.has(v)) {
            ilha.set(v, proxima);
            fila.push(v);
          }
        }
      }
    }
    proxima++;
  }
  const porIlha = new Map();
  for (const p of pontos) {
    const i = ilha.get(`${p.x},${p.y}`);
    porIlha.set(i, (porIlha.get(i) ?? 0) + 1);
  }
  const maior = [...porIlha].sort((a, b) => b[1] - a[1])[0]?.[0];
  const naIlha = pontos.filter((p) => ilha.get(`${p.x},${p.y}`) === maior);
  return naIlha.length >= 2 ? naIlha.map(({ x, y }) => ({ x, y })) : null;
}

/*
 * ---- O percurso pelos bichos: passa onde eles nascem, em todos os andares ----
 *
 * "ele nunca anda o mapa todo ... na escada na parte de baixo ele vai e já volta
 * pra cima e parece não tem nenhum mob". A rota gravada (`route`) não passa
 * onde os bichos nascem: na Winter Dream Court 68% dos pontos ficam a mais de 8
 * casas dela (até 36), e no andar 8 ela desce e sobe na mesma escada, longe
 * dos 8 pontos de lá. Na Dark Pyramid só 23% ficam perto; na Golems, 22%.
 *
 * O percurso agora é montado pelos PONTOS DE NASCIMENTO: agrupados (um grupo a
 * cada `RAIO_DO_GRUPO` casas), e visitados sempre indo ao grupo mais perto A PÉ
 * — com as escadas do mapa (`mudanca`, `escada` e as trocas de andar da rota
 * gravada) como passagem entre andares —, e no fim volta ao começo. O andar
 * de baixo só entra se lá houver bicho, e entra pelo caminho que chega nele.
 *
 * Sai uma lista casa a casa com o andar (`{x, y, z}`), no mesmo formato da rota
 * gravada: `passoNoPercurso` anda até a casa da escada e troca de andar.
 */
export const RAIO_DO_GRUPO = 4;

export function percursoPelosBichos(real, posicoes, inicio) {
  const W = real.width;
  const H = real.height;
  const N = W * H;
  const andares = Object.keys(real.floors ?? {})
    .map(Number)
    .filter((z) => real.floors[z]?.blocked)
    .sort((a, b) => a - b);
  if (!andares.length || !posicoes?.length) return null;
  const ordem = new Map(andares.map((z, i) => [z, i]));
  const no = (x, y, z) => ordem.get(z) * N + y * W + x;
  const doNo = (n) => {
    const i = n % N;
    return { x: i % W, y: (i - (i % W)) / W, z: andares[(n - i) / N] };
  };
  // 1 = chão andável; 2 = casa que só leva a outro andar (escada de pisar).
  const pode = new Uint8Array(N * andares.length);
  for (const z of andares) {
    const { blocked, mudanca = {} } = real.floors[z];
    const base = ordem.get(z) * N;
    for (let i = 0; i < N; i++) if (!blocked[i] && !mudanca[i]) pode[base + i] = 1;
  }
  // A casa andável mais perto de (x, y) no andar z, a até `raio` casas.
  const encaixar = (x, y, z, raio = 1) => {
    if (!ordem.has(z)) return -1;
    for (let r = 0; r <= raio; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const cx = x + dx;
          const cy = y + dy;
          if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
          if (pode[no(cx, cy, z)] === 1) return no(cx, cy, z);
        }
      }
    }
    return -1;
  };
  const saltos = new Map();
  const saltar = (de, para) => {
    if (para < 0) return;
    if (!pode[de]) pode[de] = 2;
    (saltos.get(de) ?? saltos.set(de, []).get(de)).push(para);
  };
  for (const z of andares) {
    const { mudanca = {}, escada = {} } = real.floors[z];
    for (const i of Object.keys(mudanca)) {
      const x = Number(i) % W;
      const y = (Number(i) - x) / W;
      const d = destinoDaMudanca(real, z, x, y);
      if (d) saltar(no(x, y, z), encaixar(d.x, d.y, d.z));
    }
    for (const [i, tipo] of Object.entries(escada)) {
      const x = Number(i) % W;
      const y = (Number(i) - x) / W;
      const z2 = Number(tipo) === 1 ? z - 1 : Number(tipo) === 2 ? z + 1 : null;
      if (z2 != null) saltar(no(x, y, z), encaixar(x, y, z2));
    }
  }
  // As trocas de andar que a rota gravada fez e o mapa não marca (Asura Palace).
  const rota = real.route ?? [];
  for (let k = 1; k < rota.length; k++) {
    const [a, b] = [rota[k - 1], rota[k]];
    if (a.z !== b.z && ordem.has(a.z)) saltar(no(a.x, a.y, a.z), encaixar(b.x, b.y, b.z));
  }

  const busca = (origem) => {
    const dist = new Int32Array(pode.length).fill(-1);
    const pai = new Int32Array(pode.length).fill(-1);
    const fila = new Int32Array(pode.length);
    let fim = 0;
    dist[origem] = 0;
    fila[fim++] = origem;
    for (let k = 0; k < fim; k++) {
      const n = fila[k];
      const visitar = (m) => {
        if (dist[m] >= 0 || !pode[m]) return;
        dist[m] = dist[n] + 1;
        pai[m] = n;
        fila[fim++] = m;
      };
      for (const m of saltos.get(n) ?? []) visitar(m);
      if (pode[n] === 2) continue; // em cima da escada, o único caminho é descer/subir
      const i = n % N;
      const x = i % W;
      const y = (i - x) / W;
      const base = n - i;
      for (const [dx, dy] of VIZINHANCA_8) {
        const cx = x + dx;
        const cy = y + dy;
        if (cx >= 0 && cy >= 0 && cx < W && cy < H) visitar(base + cy * W + cx);
      }
    }
    return { dist, pai };
  };

  const partida = encaixar(inicio.x, inicio.y, inicio.z ?? real.z, 3);
  if (partida < 0) return null;
  const alcance = busca(partida);
  // Um ponto por grupo: o primeiro de cada canto do andar.
  const grupos = [];
  for (const p of posicoes) {
    const n = encaixar(p.x, p.y, p.z ?? real.z, RAIO_DO_SPAWN);
    if (n < 0 || alcance.dist[n] < 0) continue;
    const c = doNo(n);
    if (grupos.some((g) => g.z === c.z && distancia(g, c) <= RAIO_DO_GRUPO)) continue;
    grupos.push({ ...c, n });
  }
  if (!grupos.length) return null;

  const caminho = [partida];
  let atual = partida;
  let atualBusca = alcance;
  const anexar = (alvo, b) => {
    const trecho = [];
    for (let m = alvo; m !== atual; m = b.pai[m]) trecho.push(m);
    caminho.push(...trecho.reverse());
  };
  let falta = grupos;
  while (falta.length) {
    let melhor = null;
    for (const g of falta) if (atualBusca.dist[g.n] >= 0 && (!melhor || atualBusca.dist[g.n] < atualBusca.dist[melhor.n])) melhor = g;
    if (!melhor) break;
    anexar(melhor.n, atualBusca);
    atual = melhor.n;
    falta = falta.filter((g) => g !== melhor);
    if (falta.length) atualBusca = busca(atual);
  }
  // E volta ao começo: o laço fecha.
  const volta = busca(atual);
  if (volta.dist[partida] > 0) anexar(partida, volta);
  if (caminho.at(-1) === partida && caminho.length > 1) caminho.pop();
  return caminho.length >= 2 ? caminho.map(doNo) : null;
}

/*
 * ---- O laço das salas sem mapa capturado ----
 *
 * As Hunts Vip (e a Instance e as Divine) não têm `route`: o terreno delas só
 * existe de dentro, com premium no original. Sem laço, na Caça Automática o
 * personagem ficava parado quando a sala esvaziava. Aqui o laço passa por todos
 * os pontos de nascimento, sempre para o mais perto ainda não visitado, e volta
 * ao começo — é o caminho que um jogador faria para limpar a sala. NÃO é o
 * percurso real (esse só vem capturando a hunt por dentro).
 */
export function percursoPelosSpawns(inicio, posicoes) {
  const falta = posicoes.map(({ x, y }) => ({ x, y }));
  const laco = [{ ...inicio }];
  let atual = inicio;
  while (falta.length) {
    let k = 0;
    for (let i = 1; i < falta.length; i++) if (distancia(atual, falta[i]) < distancia(atual, falta[k])) k = i;
    atual = falta.splice(k, 1)[0];
    laco.push(atual);
  }
  return laco.length >= 2 ? laco : null;
}
