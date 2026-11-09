// AS CARTAS DE ADIVINHAÇÃO do PoE (08/11 — o dono, nos mapas únicos: "Criar as cartas": as cartas do poedb, a pilha, a troca na Zuma pelo item
// da carta; o chefe do Claustro Pútrido as derruba e o Baralho Empilhado abre uma). Só no modo PoE.
//
// Os dados: `gamedata/itens-poe/cartas.json` (`tools/importar-cartas.mjs` ← o poedb): cada carta com a pilha (quantas trocam pela recompensa), o
// texto da recompensa, a recompensa no jogo (`recompensa` — o importador explica os tipos) e o peso do sorteio. A carta cuja recompensa o jogo
// não tem (o fragmento, o escaravelho, a Essência…) não sai do sorteio.
//
//   - a carta é um item empilhável (o ícone do inventário do PoE, o mesmo para todas), com a recompensa no balão;
//   - a TROCA é na loja da Zuma ("Cartas de Adivinhação"): com a pilha completa, as N cartas saem e a recompensa entra na mochila;
//   - o SORTEIO pesa pela carta (as caras quase nunca) e só entre as de DropLevel até o nível: o chefe do Claustro Pútrido (3 cartas — o poedb
//     só diz que ele derruba), o Baralho Empilhado (uma carta qualquer) e os Synthesis Globais ("chance de derrubar uma Carta").
import { readFileSync } from 'node:fs';
import { ITEM_CATALOG } from '../dados.mjs';
import { PILHA_MAX_POE } from '../itens/pilha.mjs';
import * as Catalogo from './catalogo.mjs';
import * as Jogo from './jogo.mjs';
import { gerarPeca, caiNoSorteio } from './gerar.mjs';
import * as Mapas from './mapas.mjs';
import * as SinteseMapas from './sintese-mapas.mjs';
import { OLEOS } from './ungir.mjs';
import * as Tatuagens from '../passivas/tatuagens.mjs';

export const DADOS = JSON.parse(readFileSync(new URL('../../gamedata/itens-poe/cartas.json', import.meta.url), 'utf8'));
export const CARTAS = Object.freeze(DADOS.cartas ?? []);
const POR_ID = new Map(CARTAS.map((c) => [c.id, c]));
const POR_SLUG = new Map(CARTAS.map((c) => [c.slug, c]));
/** As que existem no jogo (a recompensa tem o item). */
export const NO_JOGO = Object.freeze(CARTAS.filter((c) => c.recompensa));
export const daCarta = (id) => POR_ID.get(Number(id)) ?? null;
export const ehCarta = (id) => POR_ID.has(Number(id));
/** Quantas cartas o chefe do Claustro Pútrido derruba (o poedb: "map unique boss drops divination cards" — sem o número). */
export const DO_CHEFE_DO_CLAUSTRO = 3;

// (os módulos que o ciclo de imports não deixa trazer direto: as moedas e as gemas — `iniciar` recebe)
let Moedas = null;
let Gemas = null;

/** Registra as cartas no catálogo de itens (uma vez) e liga a troca na loja e o Baralho Empilhado. Devolve quantas entraram. */
export function iniciar({ moedas, gemas } = {}) {
  if (!Catalogo.ligado()) return 0;
  Moedas = moedas ?? Moedas;
  Gemas = gemas ?? Gemas;
  SinteseMapas.definirCartas(() => NO_JOGO.length > 0);
  Moedas?.usarCartas({ sortear, linhasDaLoja });
  Gemas?.usarTrocaDeCartas((estado, id, count) => trocar(estado, id, { count }));
  let n = 0;
  for (const c of CARTAS) {
    const cartaPoe = { slug: c.slug, pilha: c.pilha, noJogo: !!c.recompensa };
    const descricao = `${c.recompensaTexto || c.recompensaEn || 'Sem recompensa'} — troque ${c.pilha} na Zuma.${c.recompensa ? '' : ` Sem efeito no jogo: ${c.motivo}.`}`;
    if (ITEM_CATALOG[c.id]) {
      Object.assign(ITEM_CATALOG[c.id], { cartaPoe, descricao, pilha: PILHA_MAX_POE });
      continue;
    }
    ITEM_CATALOG[c.id] = {
      id: c.id, name: c.nome, weight: 0.1, stackable: true, type: 'moeda', rarity: 'raro', hasSprite: true, spriteDe: 9655,
      poeMoeda: { icone: DADOS.icone }, cartaPoe, descricao, sell: 0, pilha: PILHA_MAX_POE,
    };
    n++;
  }
  return n;
}

/** Uma carta ao acaso pelo peso, entre as do jogo com DropLevel até `nivel` (sem nível: todas). Devolve a carta, ou null. */
export function sortear(nivel = Infinity, rng = Math.random) {
  const lista = NO_JOGO.filter((c) => (c.dropLevel ?? 1) <= nivel && c.peso > 0);
  const total = lista.reduce((t, c) => t + c.peso, 0);
  if (!(total > 0)) return null;
  let sorte = rng() * total;
  return lista.find((c) => (sorte -= c.peso) < 0) ?? lista[lista.length - 1];
}
/** `n` cartas sorteadas, como itens (`{ id, count }`, as iguais juntas). */
export function cartasSorteadas(n, nivel = Infinity, rng = Math.random) {
  const saida = new Map();
  for (let i = 0; i < n; i++) {
    const c = sortear(nivel, rng);
    if (c) saida.set(c.id, (saida.get(c.id) ?? 0) + 1);
  }
  return [...saida].map(([id, count]) => ({ id, count }));
}

// ---------------------------------------------------------------- a RECOMPENSA

const umDe = (lista, rng) => lista[Math.floor(rng() * lista.length)];
const ondeHaUnicos = (classes) => classes.flatMap((cl) => (Catalogo.catalogo()?.classes?.[cl]?.unicos ?? []).filter((u) => caiNoSorteio(u)).map((u) => ({ classe: cl, u })));
/** Um Único pelo slug (o da carta), na base dele, com o item level `ilvl`. */
function unicoPeloSlug(slug, ilvl, rng) {
  const cat = Catalogo.catalogo();
  for (const [classe, c] of Object.entries(cat?.classes ?? {})) {
    const u = (c.unicos ?? []).find((x) => x.slug === slug);
    if (!u) continue;
    const b = (c.bases ?? []).find((x) => x.nome === u.base);
    return b ? Jogo.pecaDoJogo(gerarUnico(b.id, slug, ilvl, rng), Catalogo.REGRAS, rng) : null;
  }
  return null;
}
const gerarUnico = (base, unico, ilvl, rng) => gerarPeca({ catalogo: Catalogo.catalogo(), regras: Catalogo.REGRAS, base, raridade: 'unico', ilvl, rng, unico });

const GEMA = {
  vaal: (d) => /^Vaal_/.test(d.poe.slug) && d.tipo !== 'support',
  suporte: (d) => d.tipo === 'support' && !/^Awakened_/.test(d.poe.slug),
  magia: (d) => d.tipo !== 'support' && (d.tags ?? []).includes('poe:Magia'),
  lacaio: (d) => d.tipo !== 'support' && (d.tags ?? []).includes('poe:Lacaio'),
  ataque: (d) => d.tipo !== 'support' && (d.tags ?? []).includes('poe:Ataque'),
  aura: (d) => d.tipo !== 'support' && (d.tags ?? []).includes('poe:Aura'),
  caos: (d) => d.tipo !== 'support' && (d.tags ?? []).includes('poe:Caos'),
  armadilha: (d) => d.tipo !== 'support' && (d.tags ?? []).includes('poe:Armadilha'),
  golem: (d) => d.tipo !== 'support' && (d.tags ?? []).includes('poe:Golem'),
  excepcional: (d) => (d.tags ?? []).includes('poe:Excepcional') && !/^Awakened_/.test(d.poe.slug),
  despertada: (d) => /^Awakened_/.test(d.poe.slug),
  qualquer: (d) => !/^Awakened_/.test(d.poe.slug),
};
/** A gema transfigurada: "<gema>_of_<algo>" com a gema de base no jogo (o Relâmpago Armado de Faíscas). */
const transfigurada = (d, slugs) => { const m = /^(.+)_of_[A-Z]/.exec(d.poe.slug); return !!m && slugs.has(m[1]) && d.tipo !== 'support'; };
function gemaDa(r, rng) {
  if (!Gemas) return null;
  const defs = [...Gemas.DEFS.values()].filter((d) => d.poe?.slug && !d.soDoItem);
  const slugs = new Set(defs.map((d) => d.poe.slug));
  const filtro = r.slug ? (d) => d.poe.slug === r.slug
    : r.filtro === 'transfigurada' ? (d) => transfigurada(d, slugs)
      : r.filtro === 'golemTransfigurada' ? (d) => transfigurada(d, slugs) && GEMA.golem(d)
        : GEMA[r.filtro] ?? GEMA.qualquer;
  const lista = defs.filter(filtro);
  if (!lista.length) return null;
  const d = umDe(lista, rng);
  return Gemas.itemDaGema({ id: d.itemId, raridade: 'comum', nivel: r.nivel ?? 1, qualidade: r.qualidade ?? 0, ...(r.corrompido ? { corrompida: true } : {}) });
}
/** As peças/itens que a carta dá (`{ id, count }` ou a peça do PoE). `nivel`: o item level quando a carta não diz (o do personagem). */
export function itensDaRecompensa(r, { nivel = 68, rng = Math.random } = {}) {
  if (!r) return [];
  const ilvl = Math.max(1, Math.min(100, r.ilvl ?? nivel));
  const corromper = (p) => { if (p?.poe && r.corrompido) p.poe.corrompido = true; return p; };
  const n = Math.max(1, Math.round(r.n ?? 1));
  switch (r.tipo) {
    case 'moeda': {
      if (!Moedas) return [];
      if (r.grupo) {
        const lista = r.grupo === 'oleo' ? OLEOS : SinteseMapas.MOEDAS_DE_QUALIDADE;
        const saida = new Map();
        for (let i = 0; i < n; i++) { const id = Moedas.idDa(umDe(lista, rng)); if (id) saida.set(id, (saida.get(id) ?? 0) + 1); }
        return [...saida].map(([id, count]) => ({ id, count }));
      }
      if (!r.slug) return Moedas.moedasAvulsas(n, rng);
      const id = Moedas.idDa(r.slug);
      return id ? [{ id, count: n }] : [];
    }
    case 'tatuagem': {
      const lista = Tatuagens.TATUAGENS.filter((t) => !r.jornada || /Journey/.test(t.slug));
      return lista.length ? Array.from({ length: n }, () => ({ id: umDe(lista, rng).itemId, count: 1 })) : [];
    }
    case 'carta':
      return r.slug ? (POR_SLUG.get(r.slug)?.recompensa ? [{ id: POR_SLUG.get(r.slug).id, count: n }] : []) : cartasSorteadas(n, Infinity, rng);
    case 'unico': {
      const slug = r.slug ?? (r.slugs?.length ? umDe(r.slugs, rng) : null);
      const p = slug ? unicoPeloSlug(slug, ilvl, rng) : null;
      return p ? [corromper(p)] : [];
    }
    case 'unicoDaBase': {
      const [classe] = String(r.base).split('/');
      const c = Catalogo.catalogo()?.classes?.[classe];
      const nomeDaBase = c?.bases?.find((b) => b.id === r.base)?.nome;
      const lista = (c?.unicos ?? []).filter((u) => u.base === nomeDaBase && caiNoSorteio(u));
      const p = lista.length ? unicoPeloSlug(umDe(lista, rng).slug, ilvl, rng) : null;
      return p ? [corromper(p)] : [];
    }
    case 'unicoDaClasse': {
      const lista = ondeHaUnicos(r.classes ?? []);
      const p = lista.length ? unicoPeloSlug(umDe(lista, rng).u.slug, ilvl, rng) : null;
      return p ? [corromper(p)] : [];
    }
    case 'peca': {
      const classe = r.base ? null : umDe(r.classes ?? [], rng);
      let p = r.base ? Jogo.pecaSorteada(ilvl, rng, Catalogo.REGRAS, 0, r.base) : Jogo.pecaDaClasse(classe, ilvl, { raridade: r.raridade ?? 'normal', rng });
      // (a base fixa sai na raridade da carta: a do sorteio é refeita até bater — no máximo 20 vezes)
      for (let i = 0; r.base && p && p.poe?.raridade !== (r.raridade ?? 'normal') && i < 20; i++) p = Jogo.pecaSorteada(ilvl, rng, Catalogo.REGRAS, 0, r.base);
      if (!p?.poe) return [];
      if (r.influencia) p.poe.influencias = [r.influencia];
      if (r.links > 0) {
        const max = Math.max(r.links, p.poe.soquetes?.cores?.length ?? 0);
        p.poe.soquetes = { abertos: r.links, links: Array.from({ length: max - 1 }, (_, i) => i + 1 < r.links), gemas: Array(max).fill(null), cores: Array.from({ length: max }, (_, i) => p.poe.soquetes?.cores?.[i] ?? 'W') };
      }
      if (r.qualidade > 0) { p.poe.qualidade = r.qualidade; Jogo.recalcular(p); }
      return [corromper(p)];
    }
    case 'mapa': {
      const p = Jogo.mapaSorteado(Math.max(1, Math.min(Mapas.TIER_MAXIMO, r.tier ?? 16)), { raridade: r.raridade ?? 'normal', rng });
      return p ? [corromper(p)] : [];
    }
    case 'gema': {
      const g = gemaDa(r, rng);
      return g ? [g] : [];
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------- a TROCA (a loja da Zuma)

const naMochila = (estado, id) => (estado.inventory ?? []).filter((p) => Number(p?.id) === Number(id)).reduce((t, p) => t + (p.count ?? 1), 0);
/** Tira `n` itens `id` da mochila (das pilhas, da última para a primeira). */
function tirar(estado, id, n) {
  let falta = n;
  const inv = estado.inventory ?? [];
  for (let i = inv.length - 1; i >= 0 && falta > 0; i--) {
    if (Number(inv[i]?.id) !== Number(id)) continue;
    const q = inv[i].count ?? 1;
    if (q <= falta) { falta -= q; inv.splice(i, 1); } else { inv[i].count = q - falta; falta = 0; }
  }
}
/** As linhas da loja da Zuma: as cartas que você tem (a troca vale com a pilha completa). */
export function linhasDaLoja(estado) {
  if (!Catalogo.ligado()) return [];
  const linhas = [];
  for (const c of CARTAS) {
    const tenho = naMochila(estado, c.id);
    if (!tenho) continue;
    linhas.push({ id: c.id, chave: `${c.id}:carta`, categoria: 'cartas', categoriaNome: 'Cartas de Adivinhação', nome: `Trocar ${c.nome} (${Math.min(tenho, c.pilha)}/${c.pilha}) → ${c.recompensaTexto || '?'}`, buy: 0, tenho, troca: { pilha: c.pilha, pronta: tenho >= c.pilha && !!c.recompensa, ...(c.recompensa ? {} : { motivo: c.motivo }) } });
  }
  return linhas;
}
/** Troca a pilha da carta `id` pela recompensa (`count`: quantas trocas). `{ ok, notice }` ou `{ ok: false, erro }`; null: não é carta. */
export function trocar(estado, id, { count = 1, rng = Math.random } = {}) {
  const c = daCarta(id);
  if (!c) return null;
  if (!c.recompensa) return { ok: false, erro: `${c.nome}: a recompensa não existe no jogo (${c.motivo}).` };
  const vezes = Math.max(1, Math.min(Math.floor(naMochila(estado, c.id) / c.pilha), Math.floor(Number(count) || 1)));
  if (naMochila(estado, c.id) < c.pilha) return { ok: false, erro: `${c.nome}: são ${c.pilha} cartas para trocar (você tem ${naMochila(estado, c.id)}).` };
  const ganhos = [];
  for (let v = 0; v < vezes; v++) ganhos.push(...itensDaRecompensa(c.recompensa, { nivel: Math.min(100, estado.level ?? 68), rng }));
  if (!ganhos.length) return { ok: false, erro: `${c.nome}: não consegui montar a recompensa agora.` };
  tirar(estado, c.id, c.pilha * vezes);
  for (const g of ganhos) {
    if (g.poe || g.gema) (estado.inventory ??= []).push(g);
    else {
      const pilha = (estado.inventory ??= []).find((p) => Number(p.id) === Number(g.id) && !p.poe && (p.count ?? 1) < (ITEM_CATALOG[g.id]?.pilha ?? PILHA_MAX_POE));
      if (pilha) pilha.count = (pilha.count ?? 1) + g.count;
      else estado.inventory.push({ id: g.id, count: g.count });
    }
  }
  const nomes = ganhos.map((g) => (g.poe?.nome ?? ITEM_CATALOG[g.id]?.name ?? '?') + (g.count > 1 ? ` ×${g.count}` : ''));
  return { ok: true, notice: `${c.nome}: ${nomes.join(', ')}.` };
}
