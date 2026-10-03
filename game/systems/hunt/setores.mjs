// SETORES da instância, DERIVADOS do mapa (sem mexer nos mapas nem no editor): cada andar, nas casas alcançáveis, é dividido numa grade
// de até 3×3 regiões (menos quando o mapa é pequeno), as regiões muito pequenas se fundem à vizinha maior, e cada região vira um setor
// com nome de bússola (Norte, Sudeste, Centro...). O bicho recebe o setor onde NASCE (`m.setor`) e a instância guarda o total por setor
// (`instancia.setores`), então o progresso ("restam 3 de 12 no Leste") vem da contagem dos vivos contra o total, no servidor.
//
// O id é `z:LC/RC` (andar, linha e coluna da região, e quantas linhas e colunas o andar tem): dele sai o nome, sem tabela guardada.
export const CONFIG_SETORES = Object.freeze({ divisoes: 3, casasPorDivisao: 14, minimoDeCasas: 30 });

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const cache = new WeakMap(); // alcançáveis (Map z -> Set) -> mapa de setores

/** Quantas linhas/colunas um andar de `largura × altura` casas ganha. */
function divisoesDe(largura, altura, cfg) {
  const n = (v) => clamp(Math.round(v / cfg.casasPorDivisao), 1, cfg.divisoes);
  return { cols: n(largura), linhas: n(altura) };
}

/** `{ setorDe(x, y, z), ids: [{ id, z, casas }] }` para as casas alcançáveis (`Map z -> Set('x,y')`). Memoizado por mapa. */
export function mapaDeSetores(alcancaveis, cfg = CONFIG_SETORES) {
  if (!alcancaveis) return { setorDe: () => null, ids: [] };
  const guardado = cache.get(alcancaveis);
  if (guardado) return guardado;
  const porAndar = new Map();
  for (const [z, casas] of alcancaveis) {
    const pts = [...casas].map((k) => k.split(',').map(Number));
    if (!pts.length) continue;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const { cols, linhas } = divisoesDe(maxX - minX + 1, maxY - minY + 1, cfg);
    const celula = (x, y) => [clamp(Math.floor(((y - minY) * linhas) / (maxY - minY + 1)), 0, linhas - 1), clamp(Math.floor(((x - minX) * cols) / (maxX - minX + 1)), 0, cols - 1)];
    const contagem = new Map();
    for (const [x, y] of pts) {
      const [l, c] = celula(x, y);
      const k = `${l}${c}`;
      contagem.set(k, (contagem.get(k) ?? 0) + 1);
    }
    // Funde as regiões pequenas à vizinha grande mais perto (ou, se nenhuma é grande, tudo numa só).
    const grandes = [...contagem].filter(([, n]) => n >= cfg.minimoDeCasas).map(([k]) => k);
    const destino = new Map();
    for (const k of contagem.keys()) {
      if (grandes.includes(k) || !grandes.length) {
        destino.set(k, grandes.length ? k : [...contagem.keys()].sort()[0]);
        continue;
      }
      const [l, c] = [Number(k[0]), Number(k[1])];
      const perto = grandes.map((g) => [g, Math.abs(Number(g[0]) - l) + Math.abs(Number(g[1]) - c)]).sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))[0][0];
      destino.set(k, perto);
    }
    porAndar.set(z, { celula, destino, linhas, cols, contagem });
  }
  const setorDe = (x, y, z) => {
    const a = porAndar.get(z);
    if (!a) return null;
    const [l, c] = a.celula(x, y);
    const d = a.destino.get(`${l}${c}`) ?? [...a.destino.values()][0];
    return `${z}:${d}/${a.linhas}${a.cols}`;
  };
  const ids = [];
  for (const [z, a] of porAndar) for (const d of new Set(a.destino.values())) ids.push({ id: `${z}:${d}/${a.linhas}${a.cols}`, z, casas: [...a.destino].filter(([, v]) => v === d).reduce((s, [k]) => s + a.contagem.get(k), 0) });
  const mapa = { setorDe, ids, andares: porAndar.size };
  cache.set(alcancaveis, mapa);
  return mapa;
}

/** O nome de um setor pelo id (`z:LC/RC`); `comAndar` acrescenta "Andar z" quando o mapa tem vários. */
export function nomeDoSetor(id, comAndar = false) {
  const m = /^(-?\d+):(\d)(\d)\/(\d)(\d)$/.exec(String(id));
  if (!m) return String(id);
  const [z, l, c, linhas, cols] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
  const v = linhas > 1 ? (l === 0 ? 'Norte' : l === linhas - 1 ? 'Sul' : '') : '';
  const h = cols > 1 ? (c === 0 ? 'Oeste' : c === cols - 1 ? 'Leste' : '') : '';
  const composto = { 'Norte|Leste': 'Nordeste', 'Norte|Oeste': 'Noroeste', 'Sul|Leste': 'Sudeste', 'Sul|Oeste': 'Sudoeste' }[`${v}|${h}`];
  const nome = composto ?? (v || h || (linhas === 1 && cols === 1 ? 'Área única' : 'Centro'));
  return comAndar ? `Andar ${z} · ${nome}` : nome;
}

/** O setor em que `morto` acabou de cair ficou VAZIO (nenhum bicho vivo da instância nele)? Devolve o nome do setor, ou `null`. */
export function setorQueAcabou(morto, bichos, instancia, mapa) {
  if (!morto?.setor || !instancia?.setores?.[morto.setor] || morto.instancia !== instancia.id) return null;
  if (bichos.some((m) => m !== morto && m.hp > 0 && m.setor === morto.setor && m.instancia === instancia.id && !m.opcional)) return null;
  return nomeDoSetor(morto.setor, (mapa?.andares ?? 1) > 1);
}

/** Soma o peso de cada bicho no seu setor: o `instancia.setores` do nascimento. */
export function contarSetores(bichos) {
  const total = {};
  for (const m of bichos) if (m.setor) total[m.setor] = (total[m.setor] ?? 0) + (m.objetivo ?? 1);
  return total;
}

/**
 * O progresso por setor: `[{ id, nome, total, vivos, concluido, jogadores }]`.
 * `vivos`: os bichos da instância ainda vivos naquele setor; `jogadores`: quem está lá agora (`[{nome, x, y, z}]` → setor pelo mapa).
 */
export function resumoDosSetores({ instancia, bichos, mapa, jogadores = [] }) {
  const totais = instancia?.setores;
  if (!totais || !mapa) return null;
  const vivos = {};
  for (const m of bichos) if (m.hp > 0 && m.instancia === instancia.id && !m.opcional && m.setor) vivos[m.setor] = (vivos[m.setor] ?? 0) + (m.objetivo ?? 1);
  const quem = {};
  for (const j of jogadores) {
    const id = mapa.setorDe(j.x, j.y, j.z);
    if (id) (quem[id] ??= []).push(j.nome);
  }
  const comAndar = (mapa.andares ?? 1) > 1;
  return Object.keys(totais).sort().map((id) => ({ id, nome: nomeDoSetor(id, comAndar), total: totais[id], vivos: vivos[id] ?? 0, concluido: (vivos[id] ?? 0) === 0, jogadores: quem[id] ?? [] }));
}
