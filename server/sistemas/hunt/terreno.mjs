// O terreno da hunt: mapa capturado, pontos de nascimento no referencial do mapa, a grade andável.
// Parte de `cacadas.mjs` (dividido em 2026-09-25); a fachada continua lá.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATALOGO, ITEM_CATALOG, CITY_MAP, TREINO_MAP } from '../../nucleo/dados.mjs';
import * as Premium from '../premium.mjs';
import { andavelDoAndar } from './andares.mjs';
import { percursoDoMapa, percursoPelosBichos, percursoPelosSpawns } from './rotas.mjs';

/*
 * ---- Mapa REAL, capturado ao vivo, quando existe ----
 *
 * "vc pegou as sprits e os json de todas?" — por hunt, na medida em que
 * forem capturadas: `pedirMapa` (o mesmo comando que o cliente já manda
 * quando perde a paleta) devolve o `state.hunt.map` de verdade do servidor
 * original — atlas PRÓPRIO da hunt (`hunts/<id>.png`, baixado à parte),
 * `stacks`/`blocked` reais tile a tile, e até `route` (o caminho que a
 * Caça Automática seguia de verdade naquela hunt). Guardado em
 * `assets_raw/gamedata/hunts/<id>-map.json` + a imagem em
 * `assets_raw/gamedata/sprites/hunts/<id>.png`. Sem esse arquivo pra uma
 * hunt, cai no placeholder (polígono + atlas da cidade) mais abaixo.
 */
export const RAIZ_HUNTS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'assets_raw', 'gamedata', 'hunts');
export const mapasReaisCacheados = new Map();

/*
 * Doze hunts com mapa real chegam no catálogo SEM `posicoes` (medusa-cave,
 * putrid-mummies...) e entravam vazias. Os spawns delas são o primeiro
 * `state.hunt.monsters` que o original mandou ao entrar (Zoros, 2026-09-24).
 */
export const CAMINHO_SPAWNS = join(RAIZ_HUNTS, '..', 'hunts-spawns-capturados.json');
export const SPAWNS_CAPTURADOS = existsSync(CAMINHO_SPAWNS) ? JSON.parse(readFileSync(CAMINHO_SPAWNS, 'utf8')).hunts : {};

export function mapaRealCapturado(huntId) {
  if (mapasReaisCacheados.has(huntId)) return mapasReaisCacheados.get(huntId);
  const caminho = join(RAIZ_HUNTS, `${huntId}-map.json`);
  const mapa = existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')) : null;
  // Sala de boss fica como o original: a da Magma Bubble é chão de lava, e é
  // nele que o jogador entra e o boss nasce.
  if (mapa && !CATALOGO.bosses.some((b) => b.id === huntId)) bloquearLiquidos(mapa);
  mapasReaisCacheados.set(huntId, mapa);
  return mapa;
}

/*
 * ---- Os pontos de nascimento no referencial do mapa ----
 *
 * Em várias hunts o catálogo real dá os pontos (`posicoes`) num recorte e o mapa
 * capturado noutro: na Dark Pyramid só 6 dos 86 pontos caíam em chão livre, e
 * todos os 86 caem com (+18, +11); na Winter Dream Court 56/107 → 107/107 com
 * (+16, +2); na Golems 60/166 → 166/166 com (+17, +17). Nas que já batiam
 * (Troll Cave, Werelions, Amazon Camp) o melhor deslocamento é zero. O bicho
 * que caía em rocha sumia da hunt — "parece que não tem nenhum mob na parte de
 * baixo" —, e o de chão livre nascia fora do lugar.
 *
 * Nenhum dos dois arquivos guarda o deslocamento, então ele é medido: sem
 * deslocar, menos de `ENCAIXE_MINIMO` dos pontos em chão livre, procura-se até
 * `DESLOCAMENTO_MAXIMO` casas o que encaixa mais; só vale se encaixar pelo menos
 * `ENCAIXE_BOM` deles.
 */
export const ENCAIXE_MINIMO = 0.8;
export const ENCAIXE_BOM = 0.85;
export const DESLOCAMENTO_MAXIMO = 40;
export const pontosCacheados = new Map();

export function pontosNoMapa(hunt, real) {
  if (!hunt?.posicoes?.length || !real?.floors) return hunt?.posicoes ?? [];
  if (pontosCacheados.has(hunt.id)) return pontosCacheados.get(hunt.id);
  const livre = (p, dx, dy) => {
    const andar = real.floors[p.z ?? real.z];
    const x = p.x + dx;
    const y = p.y + dy;
    return !!andar?.blocked && x >= 0 && y >= 0 && x < real.width && y < real.height && !andar.blocked[y * real.width + x];
  };
  const quantos = (dx, dy) => hunt.posicoes.reduce((n, p) => n + (livre(p, dx, dy) ? 1 : 0), 0);
  const total = hunt.posicoes.length;
  let melhor = { dx: 0, dy: 0, n: quantos(0, 0) };
  if (melhor.n < total * ENCAIXE_MINIMO) {
    const semDeslocar = melhor.n;
    for (let dy = -DESLOCAMENTO_MAXIMO; dy <= DESLOCAMENTO_MAXIMO; dy++) {
      for (let dx = -DESLOCAMENTO_MAXIMO; dx <= DESLOCAMENTO_MAXIMO; dx++) {
        const n = quantos(dx, dy);
        if (n > melhor.n) melhor = { dx, dy, n };
      }
    }
    if (melhor.n < total * ENCAIXE_BOM || melhor.n <= semDeslocar) melhor = { dx: 0, dy: 0, n: semDeslocar };
  }
  const pontos = melhor.dx || melhor.dy ? hunt.posicoes.map((p) => ({ ...p, x: p.x + melhor.dx, y: p.y + melhor.dy })) : hunt.posicoes;
  pontosCacheados.set(hunt.id, pontos);
  return pontos;
}

/*
 * ---- Ninguém anda na água ----
 *
 * "mobs nas fases não podem andar sobre a água e player também não". O
 * `blocked` capturado só bloqueia a água que o servidor original cercava:
 * o lago/mar FORA das paredes vinha como livre (winter-dream-court: 1.411
 * casas de água "andáveis"; hive-surface, werelions, dark-pyramid idem), e a
 * BFS atravessava por ali. O chão (`stacks[i][0]`) é o que diz se é líquido —
 * pelo nome real no `item-catalog.json`. "muddy floor" é lama de pisar, fica
 * andável.
 */
export const CHAO_LIQUIDO = /^(shallow water|water|swamp|lava|tar|muddy water|dirty water|bog water|ghostly water)$/;

export function bloquearLiquidos(mapa) {
  for (const [z, andar] of Object.entries(mapa.floors ?? { [mapa.z]: mapa })) {
    const { stacks, blocked } = andar;
    if (!stacks || !blocked) continue;
    for (let i = 0; i < stacks.length; i++) {
      const chao = mapa.palette[stacks[i]?.[0]]?.id;
      if (chao != null && CHAO_LIQUIDO.test(ITEM_CATALOG[chao]?.name ?? '')) blocked[i] = 1;
    }
    // O `blocked` do topo é o do andar da hunt — mesma lista, não uma cópia.
    if (Number(z) === mapa.z && mapa.blocked !== blocked) mapa.blocked = blocked;
  }
}

/*
 * ---- Sem isto, "fica tudo preto" ao entrar ----
 *
 * O comentário do próprio `map.mjs` avisa: sem `payload.map` num `mapId`
 * novo, "a tela fica assim: preta". Uma hunt não tem atlas/paleta capturados
 * (ninguém baixou `troll-cave.png`) — mas a cidade tem, e o cliente já
 * carregou aquele atlas. Reaproveitando `CITY_MAP.atlas`/`palette` (mesma
 * ideia de "chão reaproveita sprite de item" que valeu para a cidade antes
 * do mapa real chegar), só preciso de UM índice de paleta que já exista e
 * seja simples — `stacks[i]` guarda ÍNDICES no array `palette` (não o
 * `.id` de cada entrada, que é outra numeração), então o índice tem de vir
 * de um `stacks` real, não de um `.id` chutado.
 *
 * Índice `40` é de longe o mais comum nos dois lados (chão E bloqueado) do
 * `city-map.json` real — 1548 células de chão e 1282 bloqueadas o usam — e
 * é `f:1` (sem animação, um quadro só): a base sólida por baixo de tudo.
 * Primeira tentativa usou `634`, que parecia uma parede pela frequência mas
 * é `f:14` — um sprite ANIMADO (provavelmente vegetação balançando) — e
 * como a maioria da grade de uma hunt é bloqueada, isso pintava o mapa
 * inteiro de moitas piscando em vez de rocha. Piso e bloqueado usam o MESMO
 * índice por ora — sem uma sprite de parede real dedicada, a diferença
 * visual entre andável e bloqueado ainda não existe (a colisão do lado do
 * servidor continua real e funcionando; só o desenho é que não distingue).
 */
export const PISO_REAL = 40;
export const PAREDE_REAL = 40;

/**
 * A entrada do catálogo real para `huntId`, ou um substituto mínimo
 * (`{id: huntId}`) para um mapa feito no `/editor` — que não tem entrada
 * nenhuma em `CATALOGO.hunts`. `gradeDaHunt` só usa o `.id` desse objeto
 * pra achar o arquivo `<id>-map.json` quando ele não é uma das 48 hunts
 * reais, então o substituto basta.
 */
/** As hunts premium: Vip, Instance (`especiais`) e Divine (`divinas`). */
export const HUNTS_PREMIUM = [...(CATALOGO.vips ?? []), ...(CATALOGO.especiais ?? []), ...(CATALOGO.divinas ?? [])];
export const acharHunt = (huntId) => CATALOGO.hunts.find((h) => h.id === huntId) ?? HUNTS_PREMIUM.find((h) => h.id === huntId) ?? null;
export const huntOuMapaCustom = (huntId) =>
  acharHunt(huntId) ?? CATALOGO.bosses.find((b) => b.id === huntId) ?? { id: huntId };
export const nomeDaHunt = (huntId) => huntOuMapaCustom(huntId).name ?? huntId;

/** `true` só para as hunts com polígono de chão real (ver comentário do arquivo). */
export function temTerrenoReal(hunt) {
  return Object.values(hunt.limite?.andares ?? {}).some((poligono) => poligono.length >= 6);
}

/** Lista jogável: as hunts reais que também têm terreno real capturado. */
export function huntsJogaveis() {
  return CATALOGO.hunts.filter(temTerrenoReal).map((h) => ({ id: h.id, name: h.name, level: h.level, blurb: h.blurb }));
}

/*
 * ---- Rasterizar o polígono real num grid andável ----
 *
 * `limite.andares[z]` é uma lista plana [x0,y0,x1,y1,...] — o contorno real
 * da área andável daquele andar, capturado do OTBM original. Ray casting
 * clássico: um ponto está dentro se uma linha dele até o infinito cruza um
 * número ÍMPAR de lados do polígono. Cacheado por hunt — só roda uma vez.
 */
export function dentroDoPoligono(x, y, poligono) {
  let dentro = false;
  const n = poligono.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poligono[i * 2];
    const yi = poligono[i * 2 + 1];
    const xj = poligono[j * 2];
    const yj = poligono[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

export const gradesCacheadas = new Map();

/*
 * `limite.andares[z]` marca o CONTORNO BLOQUEADO (rocha/parede), não a área
 * andável — confirmado testando as duas mãos: com "dentro do polígono" como
 * andável, só 3 das 26 posições reais de spawn caíam dentro; invertido (fora
 * do polígono = andável), 23 das 26 caem, e o desenho resultante é uma
 * parede diagonal coerente, do jeito de uma caverna de verdade. A área total
 * jogável vem do retângulo das posições reais (spawns + itens do chão) com
 * uma margem — o próprio polígono só descreve o obstáculo, não os limites
 * do mapa.
 */
export function gradeDaHunt(hunt) {
  if (gradesCacheadas.has(hunt.id)) return gradesCacheadas.get(hunt.id);

  // O pátio de treino: a sala REAL do treino online (`TREINO_MAP`), não a cidade.
  if (hunt.id === 'treino') {
    const andavel = new Set();
    for (let y = 0; y < TREINO_MAP.height; y++) {
      for (let x = 0; x < TREINO_MAP.width; x++) if (!TREINO_MAP.blocked[y * TREINO_MAP.width + x]) andavel.add(`${x},${y}`);
    }
    // z 0: o que o `state.hunt` original manda dentro da sala.
    const grade = { z: 0, minX: 0, maxX: TREINO_MAP.width - 1, minY: 0, maxY: TREINO_MAP.height - 1, andavel, mapa: TREINO_MAP };
    gradesCacheadas.set(hunt.id, grade);
    return grade;
  }

  const real = mapaRealCapturado(hunt.id);
  if (real) {
    const andavel = andavelDoAndar(real, real.z);
    // Hunt normal: o percurso passa pelos bichos (ver `percursoPelosBichos`);
    // sem pontos de nascimento, a rota gravada.
    const ehBoss = hunt.boss || CATALOGO.bosses.some((b) => b.id === hunt.id);
    const pontos = ehBoss ? null : hunt.posicoes?.length ? pontosNoMapa(hunt, real) : SPAWNS_CAPTURADOS[hunt.id];
    const pelaRota = percursoDoMapa(real, andavel);
    const pelosBichos = pontos ? percursoPelosBichos(real, pontos, pelaRota?.[0] ?? real.route?.[0] ?? { x: 0, y: 0, z: real.z }) : null;
    const grade = {
      z: real.z,
      minX: 0,
      maxX: real.width - 1,
      minY: 0,
      maxY: real.height - 1,
      andavel,
      mapa: real,
      // `route[0]` é onde a Caça Automática de verdade começava a andar
      // naquela hunt — melhor ponto de entrada do que qualquer média.
      inicioReal: real.route?.[0] ?? null,
      percurso: pelosBichos ?? pelaRota,
    };
    gradesCacheadas.set(hunt.id, grade);
    return grade;
  }

  /*
   * ---- A sala do boss ----
   *
   * O catálogo real dá o tamanho da sala (`limite.caixas[z]`: w x h) e onde o
   * jogador entra (`partida`), mas não os tiles — esses só vêm de dentro da
   * sala no original (`pedirMapa`). Até lá, a sala é a caixa real com borda de
   * parede e o piso genérico (`construirMapa`).
   */
  if (Premium.trancaDaHunt(hunt) && !hunt.limite) {
    const grade = salaGerada(hunt);
    gradesCacheadas.set(hunt.id, grade);
    return grade;
  }

  if (hunt.boss) {
    const z = Number(Object.keys(hunt.limite?.caixas ?? { 7: 0 })[0]);
    const caixa = hunt.limite?.caixas?.[z] ?? { w: 20, h: 20 };
    const andavel = new Set();
    for (let y = 1; y < caixa.h - 1; y++) for (let x = 1; x < caixa.w - 1; x++) andavel.add(`${x},${y}`);
    const grade = { z, minX: 0, maxX: caixa.w - 1, minY: 0, maxY: caixa.h - 1, andavel, mapa: construirMapa(z, caixa.w - 1, caixa.h - 1, andavel) };
    gradesCacheadas.set(hunt.id, grade);
    return grade;
  }

  const z = Number(Object.keys(hunt.limite.andares)[0]);
  const poligono = hunt.limite.andares[z];
  const pontosReais = [...hunt.posicoes, ...(hunt.itens ?? [])];
  const MARGEM = 6;
  const minX = Math.min(...pontosReais.map((p) => p.x)) - MARGEM;
  const maxX = Math.max(...pontosReais.map((p) => p.x)) + MARGEM;
  const minY = Math.min(...pontosReais.map((p) => p.y)) - MARGEM;
  const maxY = Math.max(...pontosReais.map((p) => p.y)) + MARGEM;

  const andavel = new Set();
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!dentroDoPoligono(x + 0.5, y + 0.5, poligono)) andavel.add(`${x},${y}`);
    }
  }

  const grade = { z, minX, maxX, minY, maxY, andavel, mapa: construirMapa(z, maxX, maxY, andavel) };
  gradesCacheadas.set(hunt.id, grade);
  return grade;
}

/*
 * ---- A sala das hunts premium ----
 *
 * As Hunts Vip, a Instance e as Divine chegam no catálogo real SEM terreno
 * (nem `limite`, nem `posicoes`): o chão delas só vem de dentro da hunt, e
 * entrar pede premium na conta original. Até capturar, a hunt é uma sala com
 * pilares, e os spawns saem do `spawnPorAndar` REAL (as criaturas e o peso de
 * cada uma) e da `density` da hunt. A semente é o id: a mesma hunt tem sempre
 * a mesma sala, e a caçada offline anda no mesmo chão que a online.
 */
export function salaGerada(hunt) {
  let semente = [...hunt.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const acaso = () => ((semente = (semente * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const W = 38;
  const H = 30;
  const [andar, lista] = Object.entries(hunt.spawnPorAndar ?? { 7: [] })[0] ?? [7, []];
  const z = Number(andar);
  const cx = Math.floor(W / 2);
  const cy = Math.floor(H / 2);
  const andavel = new Set();
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) andavel.add(`${x},${y}`);
  // Pilares 2x2 espalhados, longe do centro (onde o personagem nasce).
  for (let i = 0; i < 16; i++) {
    const px = 3 + Math.floor(acaso() * (W - 7));
    const py = 3 + Math.floor(acaso() * (H - 7));
    if (Math.abs(px - cx) < 4 && Math.abs(py - cy) < 4) continue;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) andavel.delete(`${px + dx},${py + dy}`);
  }
  const total = lista.reduce((a, s) => a + (s.weight ?? 1), 0) || 1;
  const sortear = () => {
    let r = acaso() * total;
    for (const s of lista) if ((r -= s.weight ?? 1) <= 0) return s.key;
    return lista[0]?.key;
  };
  const casas = [...andavel].map((k) => k.split(',').map(Number)).filter(([x, y]) => Math.max(Math.abs(x - cx), Math.abs(y - cy)) >= 5);
  const quantos = Math.min(casas.length, Math.round(16 * Math.max(1, hunt.density ?? 1)));
  const posicoes = [];
  for (let i = 0; i < quantos && lista.length; i++) {
    const [x, y] = casas.splice(Math.floor(acaso() * casas.length), 1)[0];
    posicoes.push({ key: sortear(), x, y });
  }
  return {
    z, minX: 0, maxX: W - 1, minY: 0, maxY: H - 1, andavel, mapa: construirMapa(z, W - 1, H - 1, andavel),
    inicioReal: { x: cx, y: cy }, posicoes, percurso: percursoPelosSpawns({ x: cx, y: cy }, posicoes),
  };
}

/*
 * O `map` que vai em `state.hunt` — mesmo formato do `CITY_MAP` (`width`,
 * `height`, `atlas`, `palette`, `stacks`, `blocked`...), indexado pelas
 * MESMAS coordenadas absolutas que `player`/`monsters` usam (`y*width+x`,
 * 0 a `maxX`/`maxY`) — não um recorte relativo, para não ter de traduzir
 * posição nenhuma na hora de desenhar.
 */
export function construirMapa(z, maxX, maxY, andavel) {
  const width = maxX + 1;
  const height = maxY + 1;
  const n = width * height;
  const stacks = new Array(n);
  const blocked = new Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const livre = andavel.has(`${x},${y}`);
      stacks[i] = livre ? [PISO_REAL] : [PAREDE_REAL];
      blocked[i] = livre ? 0 : 1;
    }
  }
  return {
    width,
    height,
    cell: CITY_MAP.cell,
    atlas: CITY_MAP.atlas,
    palette: CITY_MAP.palette,
    z,
    levels: [z],
    floors: { [z]: { stacks } },
    fundos: {},
    stacks,
    blocked,
    opaque: blocked,
    avoid: blocked,
    custom: true,
  };
}
