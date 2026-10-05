// A BIBLIOTECA DE SPRITES da Engine (pedido do dono, 05/10: "uma biblioteca de sprites — mobs, itens, efeitos de magia, outfits — sem repetir, de onde
// eu puxo quando adiciono algo novo"). Junta os índices que o jogo já tem e mostra cada DESENHO uma vez só, com quem o usa:
//   mobs      — os desenhos de criatura (`outfits.json`) usados por monstros do bestiário (o do Draevor/Tibia e os do PoE), um por look;
//   outfits   — os desenhos de personagem (`mounts-real.json` → outfits), um por look;
//   montarias — os desenhos de montaria, um por look;
//   itens     — os sprites de item (`item-sprites.json`), um por desenho (itens diferentes com o mesmo recorte do atlas viram um);
//   efeitos   — os efeitos de magia (`effect-sprites.json`); tiros — os projéteis (`missile-sprites.json`).
// O que o dono dá a cada sprite (nome e etiquetas, para organizar e achar) fica em `gamedata/biblioteca-sprites.json`. Só lê os índices; nada é copiado.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { statSync, mkdirSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ITEM_CATALOG, MONTARIAS_REAIS } from '../systems/dados.mjs';
import { BESTIARY } from '../systems/hunt/monstros.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', 'gamedata');
const ARQ_META = join(RAIZ, 'biblioteca-sprites.json');
const lerJson = (arq, padrao) => (existsSync(join(RAIZ, arq)) ? JSON.parse(readFileSync(join(RAIZ, arq), 'utf8')) : padrao);
export const TIPOS = ['mobs', 'itens', 'mapa', 'efeitos', 'tiros', 'outfits', 'montarias'];
/** Os tipos do catálogo que são CONSTRUÇÃO do mapa (chão, decoração) — não são itens utilizáveis. */
const TIPOS_DE_CONSTRUCAO = new Set(['natural tiles', 'artificial tiles', 'decoration']);
export const CATEGORIAS_DO_MAPA = { chao: 'Chão', cima: 'Bordas e decoração', solido: 'Paredes e sólidos' };

let INDICES = null;
const indices = () => (INDICES ??= { catalogoBruto: lerJson('item-catalog.json', {}), looks: lerJson('outfits.json', {}), itens: lerJson('item-sprites.json', {}), efeitos: lerJson('effect-sprites.json', {}), tiros: lerJson('missile-sprites.json', {}) });
const meta = () => (existsSync(ARQ_META) ? JSON.parse(readFileSync(ARQ_META, 'utf8')) : { sprites: {} });
const chave = (tipo, id) => `${tipo}:${id}`;

// ---- SEM REPETIR DE VERDADE: o mesmo desenho pode estar em ids (ou posições do atlas) diferentes — ex.: três "crate". A assinatura de um sprite são os
// PIXELS do primeiro quadro (`biblioteca-sprites-pixels.mjs`); sprites com a mesma assinatura viram um só. O cálculo decodifica todas as folhas (~1 min):
// roda numa THREAD à parte e fica em cache (game/database/dados, fora do git), refeito quando os índices mudam. Até ficar pronto, vale a comparação pelo
// recorte do atlas (e a tela avisa).
const ARQ_CACHE = join(RAIZ, '..', 'database', 'dados', 'cache-assinaturas-sprites.json');
const carimbo = () => ['outfits.json', 'item-sprites.json', 'hunts'].map((a) => (existsSync(join(RAIZ, a)) ? statSync(join(RAIZ, a)).mtimeMs : 0)).join('|');
let ASSINATURAS = null;
let CALCULANDO = false;
export const calculandoPixels = () => CALCULANDO;
/** `{ itens: Map, looks: Map }` ou null (ainda calculando: começa o cálculo na thread, se não começou). */
export function assinaturas() {
  if (ASSINATURAS) return ASSINATURAS;
  try {
    const c = existsSync(ARQ_CACHE) ? JSON.parse(readFileSync(ARQ_CACHE, 'utf8')) : null;
    if (c?.carimbo === carimbo() && c.celulas) return (ASSINATURAS = { itens: new Map(Object.entries(c.itens)), looks: new Map(Object.entries(c.looks)), celulas: c.celulas });
  } catch { /* cache ruim: refaz */ }
  if (!CALCULANDO) {
    CALCULANDO = true;
    const w = new Worker(new URL('./biblioteca-sprites-pixels.mjs', import.meta.url), { workerData: { raiz: RAIZ }, execArgv: [] });
    w.once('message', (r) => {
      ASSINATURAS = { itens: new Map(Object.entries(r.itens)), looks: new Map(Object.entries(r.looks)), celulas: r.celulas };
      CONSTRUCAO = null; // refaz a construção com as células que têm desenho
      CALCULANDO = false;
      try { mkdirSync(dirname(ARQ_CACHE), { recursive: true }); writeFileSync(ARQ_CACHE, JSON.stringify({ carimbo: carimbo(), ...r })); } catch { /* sem cache: refaz no próximo boot */ }
    });
    w.once('error', (e) => { CALCULANDO = false; console.warn('[biblioteca de sprites] comparação de pixels:', e.message); });
    w.unref(); // não segura o processo (testes, desligamento)
  }
  return null;
}

// ---- A CONSTRUÇÃO DO MAPA: os itens que montam os mapas (chão, bordas, paredes, árvores, decoração) — a paleta dos mapas de hunt, cada item com o desenho
// tirado do atlas de um mapa que o usa. A categoria vem de COMO ele é usado nos mapas de verdade: na base da pilha da casa = chão; por cima e em casa
// bloqueada na maior parte das vezes = parede/sólido; por cima sem bloquear = borda/decoração.
let CONSTRUCAO = null;
let PROVISORIA = null;
function construcao() {
  if (CONSTRUCAO) return CONSTRUCAO;
  if (PROVISORIA && !assinaturas()) return PROVISORIA;
  const por = new Map();
  const pasta = join(RAIZ, 'hunts');
  for (const arq of existsSync(pasta) ? readdirSync(pasta).filter((a) => a.endsWith('-map.json')) : []) {
    let m;
    try { m = JSON.parse(readFileSync(join(pasta, arq), 'utf8')); } catch { continue; }
    const pal = m.palette ?? [];
    const nomeDoMapa = arq.replace(/-map\.json$/, '');
    for (const [z, f] of Object.entries(m.floors ?? {})) {
      const principal = Number(z) === m.z;
      const pilhas = f.stacks ?? (principal ? m.stacks : null) ?? [];
      const bloq = f.blocked ?? (principal ? m.blocked : null) ?? [];
      pilhas.forEach((pilha, i) => (pilha ?? []).forEach((pi, pos) => {
        const p = pal[pi];
        if (!p) return;
        let x = por.get(p.id);
        if (!x) por.set(p.id, (x = { id: String(p.id), chao: 0, cima: 0, bloq: 0, n: 0, mapas: new Map(), desenho: null }));
        x.n++;
        if (pos === 0) x.chao++; else x.cima++;
        if (bloq[i]) x.bloq++;
        x.mapas.set(nomeDoMapa, (x.mapas.get(nomeDoMapa) ?? 0) + 1);
        // O desenho: de um mapa onde a célula do item TEM pixel no atlas (o "tapa" e o chão pintado na camada de fundo ficam em branco), na menor variação.
        const cel = assinaturas()?.celulas;
        const tapado = cel ? !cel[`${arq}|${pi}`] : !!p.tapa;
        const melhor = !x.desenho || (x.desenho.tapado && !tapado) || (x.desenho.tapado === tapado && (p.variant ?? 0) < x.desenho.variante);
        if (melhor) x.desenho = { tipo: 'atlas', url: `/gamedata/sprites/${m.atlas}.png`, x: p.cells?.[0]?.[0] ?? p.ax ?? 0, y: p.cells?.[0]?.[1] ?? p.ay ?? 0, w: p.w ?? 32, h: p.h ?? 32, variante: p.variant ?? 0, variantes: p.variants ?? 1, tapado };
      }));
    }
  }
  const pronta = [...por.values()].map((x) => ({ ...x, categoria: x.chao >= x.cima ? 'chao' : x.bloq / x.n > 0.6 ? 'solido' : 'cima', semDesenho: !!x.desenho?.tapado }));
  if (assinaturas()) { CONSTRUCAO = pronta; PROVISORIA = null; } else PROVISORIA = pronta; // a provisória vale até as células ficarem prontas
  return pronta;
}

/** Os sprites de um tipo, cada desenho uma vez: `[{ tipo, id, nome, desenho, usos: [{ nome, ref }], tags }]`. */
function todos(tipo) {
  const I = indices();
  const M = meta().sprites ?? {};
  const com = (x) => ({ ...x, nome: M[chave(tipo, x.id)]?.nome || x.nome, tags: M[chave(tipo, x.id)]?.tags ?? [] });
  if (tipo === 'mobs') {
    const porLook = new Map();
    const A = assinaturas()?.looks ?? new Map();
    for (const [key, b] of Object.entries(BESTIARY)) {
      if (!b?.look || !I.looks[b.look]) continue;
      const grupo = A.get(String(b.look)) && A.get(String(b.look)) !== 'vazio' ? A.get(String(b.look)) : `look:${b.look}`;
      const x = porLook.get(grupo) ?? { tipo, id: String(b.look), nome: null, desenho: { tipo: 'criatura', look: b.look, cores: b.colors ?? null }, usos: [], poe: 0, iguais: [] };
      if (String(b.look) !== x.id && !x.iguais.includes(String(b.look))) x.iguais.push(String(b.look));
      if (key.startsWith('poe-')) x.poe++;
      else x.usos.push({ nome: b.name ?? key, ref: key });
      x.nome ??= key.startsWith('poe-') ? null : b.name ?? key;
      porLook.set(grupo, x);
    }
    return [...porLook.values()].map((x) => com({ ...x, nome: x.nome ?? `look ${x.id}`, usos: x.poe ? [...x.usos, { nome: `${x.poe} monstro(s) do PoE`, ref: null }] : x.usos }));
  }
  if (tipo === 'outfits' || tipo === 'montarias') {
    const lista = tipo === 'outfits' ? MONTARIAS_REAIS.outfits ?? [] : MONTARIAS_REAIS.mounts ?? [];
    const porLook = new Map();
    const A = assinaturas()?.looks ?? new Map();
    for (const o of lista) {
      if (!o?.look || !I.looks[o.look]) continue;
      const grupo = A.get(String(o.look)) && A.get(String(o.look)) !== 'vazio' ? A.get(String(o.look)) : `look:${o.look}`;
      const x = porLook.get(grupo) ?? { tipo, id: String(o.look), nome: o.name ?? `look ${o.look}`, desenho: { tipo: 'criatura', look: o.look, cores: tipo === 'outfits' ? { head: 78, body: 69, legs: 58, feet: 76 } : null }, usos: [], iguais: [] };
      if (String(o.look) !== x.id && !x.iguais.includes(String(o.look))) x.iguais.push(String(o.look));
      x.usos.push({ nome: `${o.name ?? o.look}${tipo === 'outfits' ? ` (${o.vocation === 1 ? 'masculino' : 'feminino'})` : ''}${o.premium ? ' · premium' : ''}`, ref: null });
      porLook.set(grupo, x);
    }
    return [...porLook.values()].map(com);
  }
  if (tipo === 'itens') {
    // O mesmo recorte do atlas (folha + posições) = o mesmo desenho, mesmo em itens diferentes.
    const porDesenho = new Map();
    for (const [id, s] of Object.entries(I.itens)) {
      if (TIPOS_DE_CONSTRUCAO.has(ITEM_CATALOG[id]?.type ?? I.catalogoBruto[id]?.type)) continue; // chão e decoração: seção "Construção do mapa"
      const px = assinaturas()?.itens.get(id);
      const assinatura = px && px !== 'vazio' ? px : `${s.b ?? s.p}|${JSON.stringify(s.s ?? [[0, s.x, s.y]])}`;
      const x = porDesenho.get(assinatura) ?? { tipo, id: String(id), nome: ITEM_CATALOG[id]?.name ?? `sprite ${id}`, desenho: { tipo: 'item', id: Number(id) }, usos: [], iguais: [] };
      if (String(id) !== x.id) x.iguais.push(String(id));
      if (x.nome.startsWith('sprite ') && ITEM_CATALOG[id]?.name) x.nome = ITEM_CATALOG[id].name;
      if (ITEM_CATALOG[id]) x.usos.push({ nome: ITEM_CATALOG[id].name ?? `item ${id}`, ref: String(id) }); // sprite do atlas que nenhum item do catálogo usa: "sem uso"
      porDesenho.set(assinatura, x);
    }
    return [...porDesenho.values()].map(com);
  }
  if (tipo === 'mapa') {
    return construcao().filter((x) => !x.semDesenho).map((x) => com({ tipo, id: x.id, nome: ITEM_CATALOG[x.id]?.name ?? `item ${x.id}`, categoria: x.categoria, desenho: x.desenho, usos: [...x.mapas.entries()].sort((a, b) => b[1] - a[1]).map(([mapa, n]) => ({ nome: `${mapa} (${n} casa${n > 1 ? 's' : ''})`, ref: mapa })), resumo: `${CATEGORIAS_DO_MAPA[x.categoria]} · ${x.n} casas em ${x.mapas.size} mapa(s)${x.bloq ? ` · ${Math.round((x.bloq / x.n) * 100)}% bloqueia` : ''}` }));
  }
  if (tipo === 'efeitos' || tipo === 'tiros') return Object.keys(tipo === 'efeitos' ? I.efeitos : I.tiros).map((id) => com({ tipo, id, nome: `${tipo === 'efeitos' ? 'Efeito' : 'Projétil'} #${id}`, desenho: { tipo: tipo === 'efeitos' ? 'efeito' : 'tiro', id: Number(id) }, usos: [] }));
  return [];
}

/**
 * A lista da biblioteca: `{ tipo, total, itens, contagens }`. `q` busca no nome, no id, nas etiquetas e em quem usa; `filtro`: 'com-uso' | 'sem-uso' |
 * 'com-nome' (os que o dono organizou) | ''; paginada.
 */
export function listar({ tipo = 'mobs', q = '', filtro = '', categoria = '', pagina = 0, limite = 120 } = {}) {
  if (!TIPOS.includes(tipo)) tipo = 'mobs';
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const t = norm(q).trim();
  const M = meta().sprites ?? {};
  let l = todos(tipo).filter((x) => {
    if (filtro === 'com-uso' && !x.usos.length) return false;
    if (filtro === 'sem-uso' && x.usos.length) return false;
    if (filtro === 'com-nome' && !M[chave(tipo, x.id)]) return false;
    if (categoria && x.categoria !== categoria) return false;
    if (!t) return true;
    return x.id === t || norm(x.nome).includes(t) || x.tags.some((g) => norm(g).includes(t)) || x.usos.some((u) => norm(u.nome).includes(t));
  });
  l.sort((a, b) => b.usos.length - a.usos.length || Number(a.id) - Number(b.id));
  const lim = Math.min(300, Math.max(1, Number(limite) || 120));
  const p = Math.max(0, Number(pagina) || 0);
  const contagens = Object.fromEntries(TIPOS.map((x) => [x, todos(x).length]));
  return { tipo, total: l.length, pagina: p, comparandoPixels: CALCULANDO, categorias: tipo === 'mapa' ? Object.fromEntries(Object.keys(CATEGORIAS_DO_MAPA).map((c) => [c, construcao().filter((x) => x.categoria === c && !x.semDesenho).length])) : null, semDesenho: tipo === 'mapa' ? construcao().filter((x) => x.semDesenho).length : 0, itens: l.slice(p * lim, (p + 1) * lim).map((x) => ({ ...x, usos: x.usos.slice(0, 40), totalDeUsos: x.usos.length })), contagens };
}

/** Grava o nome e as etiquetas de um sprite (organização do dono). `{ ok, erros? }`. */
export function salvarMeta(tipo, id, { nome = '', tags = [] } = {}) {
  if (!TIPOS.includes(tipo)) return { ok: false, erros: ['Tipo de sprite desconhecido.'] };
  if (!todos(tipo).some((x) => x.id === String(id))) return { ok: false, erros: ['Sprite não encontrado.'] };
  const n = String(nome ?? '').trim().slice(0, 60);
  const g = [...new Set((Array.isArray(tags) ? tags : String(tags).split(',')).map((x) => String(x).trim().toLowerCase()).filter(Boolean))].slice(0, 12);
  const d = meta();
  d.sprites ??= {};
  if (!n && !g.length) delete d.sprites[chave(tipo, id)];
  else d.sprites[chave(tipo, id)] = { ...(n ? { nome: n } : {}), ...(g.length ? { tags: g } : {}) };
  writeFileSync(ARQ_META, `${JSON.stringify({ _nota: 'Biblioteca de sprites da Engine: o nome e as etiquetas que o dono dá a cada sprite (tipo:id).', sprites: d.sprites }, null, 1)}\n`);
  return { ok: true };
}

/** O look existe nos atlas de criatura? (para usar um desenho da biblioteca num monstro) */
export const lookExiste = (look) => !!indices().looks[String(look)];

// No boot do servidor: começa a comparação de pixels em segundo plano (com o cache válido, só lê o arquivo).
setTimeout(() => assinaturas(), 3000).unref();
