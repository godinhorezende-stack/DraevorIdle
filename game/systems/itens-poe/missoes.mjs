// O REGISTRO DE MISSÕES do PoE (dono, 05/11: "verifique se todas essas missões e assets de itens de missões estão implementadas, se não
// implemente" — https://poedb.tw/pt/Quest; a aba Missões SUBSTITUI a aba Tasks da janela Tarefas; Atlas e liga entram, o que não tem
// caminho fica marcado). Só com o sistema do PoE ligado. Os dados: `gamedata/itens-poe/missoes.json` (tools/montar-missoes-poe.mjs).
//
// A CONCLUSÃO vem do que o personagem já fez — nada é gravado para concluir (e quem já tinha jogado ganha na hora o que o PoE daria):
//   - campanha: a fase do gatilho completa (`estado.campanha[dif].completas`) ou o chefe do ato vencido (`.bosses`), em qualquer dificuldade;
//   - Bandidos: as três fases deles completas; a ESCOLHA (matar todos ou ajudar um) é do jogador, uma vez (`estado.missoes.bandido`);
//   - Atlas: mapas concluídos (`estado.mapas.concluidos`), pináculo vencido e mapa único concluído (`estado.missoes.pinaculos/unicos`,
//     gravados a partir de 05/11 — `aoVencerPinaculo`, `aoConcluirMapa`).
// As RECOMPENSAS, pelo poedb:
//   - os Pontos de Habilidade Passiva (os Livros de Habilidade) somam no total da árvore (`pontos`, lido por passivas/arvore.mjs);
//   - os bônus dos Bandidos entram nos efeitos da árvore (`efeitos`, idem); a penalidade de resistência do Kitava a ficha já aplica;
//   - a ESCOLHA de um item (gema, moeda ou base Normal) fica pendente até o jogador escolher na aba (`escolher`); as missões das gemas por
//     classe continuam em missoes-de-gemas.mjs (a janela delas);
//   - os Pontos de Restituição aparecem, mas não têm efeito: no jogo do PoE o respec é grátis (dono, 09/10).
// Os ITENS DE MISSÃO (244 variantes do poedb, com o ícone) entram no catálogo de itens (`registrarItens`); a aba mostra os de cada missão
// como obtidos quando o passo deles é feito. Os 16 que já caíam dos monstros continuam caindo (drops-por-monstro.mjs).
import { readFileSync, existsSync } from 'node:fs';
import { ligado } from './catalogo.mjs';

const ARQUIVO = new URL('../../gamedata/itens-poe/missoes.json', import.meta.url);
const DADOS = existsSync(ARQUIVO) ? JSON.parse(readFileSync(ARQUIVO, 'utf8')) : { missoes: [], itens: [] };
export const MISSOES = DADOS.missoes;
export const ITENS = DADOS.itens;
const POR_SLUG = new Map(MISSOES.map((m) => [m.slug, m]));
export const missao = (slug) => POR_SLUG.get(slug) ?? null;

/** Os bandidos: o slug da missão de cada escolha. */
export const BANDIDOS = Object.fromEntries(MISSOES.filter((m) => m.gatilho?.bandido).map((m) => [m.gatilho.bandido, m.slug]));

const garantir = (estado) => {
  estado.missoes ??= {};
  estado.missoes.escolhas ??= {};
  return estado.missoes;
};
const dificuldades = (estado) => Object.values(estado?.campanha ?? {}).filter((d) => d && typeof d === 'object');
const faseFeita = (estado, fase) => dificuldades(estado).some((d) => Array.isArray(d.completas) && d.completas.includes(fase));
const chefeVencido = (estado, ato) => dificuldades(estado).some((d) => Array.isArray(d.bosses) && d.bosses.map(Number).includes(Number(ato)));

/** O gatilho da missão foi cumprido? (Bandidos: as três fases; a escolha é à parte.) */
export function gatilhoCumprido(estado, m) {
  const g = m?.gatilho;
  if (!g || m.semCaminho) return false;
  if (g.fase) return faseFeita(estado, g.fase);
  if (g.chefeDoAto) return chefeVencido(estado, g.chefeDoAto);
  if (g.fases) return g.fases.every((f) => faseFeita(estado, f));
  if (g.mapas) return (estado?.mapas?.concluidos ?? 0) >= g.mapas;
  if (g.pinaculo) return g.pinaculo.some((id) => !!estado?.missoes?.pinaculos?.[id]);
  if (g.unicos) return g.unicos.every((u) => !!estado?.missoes?.unicos?.[u]);
  return false;
}

/**
 * A missão está concluída? Bandidos: a escolhida conclui; as outras três ficam "não escolhidas" (no PoE, ajudar um abandona as outras).
 */
export function concluida(estado, m) {
  if (!ligado() || !m) return false;
  if (m.gatilho?.bandido) return gatilhoCumprido(estado, m) && estado?.missoes?.bandido === m.gatilho.bandido;
  return gatilhoCumprido(estado, m);
}

/** Os Pontos de Habilidade Passiva das missões concluídas (os Livros de Habilidade do PoE). */
export function pontos(estado) {
  if (!ligado() || !estado) return 0;
  let n = 0;
  for (const m of MISSOES) if (m.recompensas?.pontos && concluida(estado, m)) n += m.recompensas.pontos;
  return n;
}

/**
 * Os efeitos do bônus da missão concluída que dá bônus permanente (os Bandidos): `[{ add, valor } | { stat, pct } | { tag, dano }]`, no
 * formato da árvore (`recompensas.efeitos`, traduzidos pelo gerador com a tradução da árvore). A chave `versao` muda quando a escolha muda
 * (o cache dos efeitos da árvore).
 */
export function efeitos(estado) {
  const b = ligado() ? estado?.missoes?.bandido : null;
  const slug = b ? BANDIDOS[b] : null;
  const m = slug ? POR_SLUG.get(slug) : null;
  if (!m?.recompensas?.efeitos?.length || !gatilhoCumprido(estado, m)) return [];
  return m.recompensas.efeitos.map((ef) => ({ ...ef, fonte: `Missão: ${m.nome}` }));
}
/** O pedaço da chave do cache da árvore que depende das missões (só o bandido, por enquanto). */
export const versao = (estado) => (ligado() ? `${estado?.missoes?.bandido ?? ''}:${estado?.missoes?.bandido && gatilhoCumprido(estado, POR_SLUG.get(BANDIDOS[estado.missoes.bandido])) ? 1 : 0}` : '');

/** A escolha de recompensa que espera o jogador (a missão concluída com `escolha` e sem nada escolhido). */
export const escolhaPendente = (estado, m) => !!m?.recompensas?.escolha?.length && concluida(estado, m) && estado?.missoes?.escolhas?.[m.slug] == null;
/** O bandido esperando a escolha (as três fases feitas, nenhuma escolha). */
export const bandidoPendente = (estado) => ligado() && !estado?.missoes?.bandido && !!BANDIDOS.todos && gatilhoCumprido(estado, POR_SLUG.get(BANDIDOS.todos));

/** Quantas recompensas esperam o jogador (para o alerta da aba). */
export function pendentes(estado) {
  if (!ligado() || !estado) return 0;
  return MISSOES.filter((m) => escolhaPendente(estado, m)).length + (bandidoPendente(estado) ? 1 : 0);
}

/** Um passo foi feito? O da missão concluída, ou o passo cuja fase o personagem já completou. */
const passoFeito = (estado, m, p, feita) => feita || (!!p.fase && faseFeita(estado, p.fase));

/**
 * A ficha da aba Missões (o pedido `{t:'missoes'}`): só o ESTADO de cada missão — os dados (nome, passos, recompensas, itens) o cliente lê
 * do arquivo estático `/gamedata/itens-poe/missoes.json`.
 */
export function ficha(estado) {
  if (!ligado()) return { ligado: false, missoes: {} };
  const missoes = {};
  for (const m of MISSOES) {
    const feita = concluida(estado, m);
    const passos = (m.passos ?? []).filter((p) => passoFeito(estado, m, p, feita)).map((p) => p.n);
    const e = {};
    if (feita) e.concluida = true;
    if (m.gatilho?.bandido && gatilhoCumprido(estado, m) && !feita && estado?.missoes?.bandido) e.naoEscolhida = true;
    if (passos.length) e.passos = passos;
    if (escolhaPendente(estado, m)) e.escolher = true;
    const esc = estado?.missoes?.escolhas?.[m.slug];
    if (esc != null) e.escolhida = esc;
    if (Object.keys(e).length) missoes[m.slug] = e;
  }
  return { ligado: true, missoes, bandido: estado?.missoes?.bandido ?? null, bandidoPendente: bandidoPendente(estado), pontos: pontos(estado) };
}

/**
 * O pedido da aba: `{ action: 'bandido', bandido }` (todos | kraityn | alira | oak) ou `{ action: 'escolher', missao, opcao }` (o índice da
 * opção em `recompensas.escolha`). `criarPeca(base)`: a peça da base com a raridade sorteada (Normal, Mágico ou Raro — o jogo injeta `pecaDaRecompensa`, itens-poe/jogo.mjs); `darItem(estado, id, n)`
 * e `darGema(estado, id)`: como entram na mochila. Devolve `{ ok, erro?, notice? }`.
 */
export function comando(estado, m, { criarPeca, darItem, darGema, darPeca } = {}) {
  if (!m?.action) return { ok: true };
  if (!ligado()) return { ok: false, erro: 'As missões do PoE não estão ligadas.' };
  if (m.action === 'bandido') {
    if (estado?.missoes?.bandido) return { ok: false, erro: 'A escolha dos Bandidos já foi feita.' };
    const slug = BANDIDOS[m.bandido];
    if (!slug) return { ok: false, erro: 'Escolha inválida.' };
    if (!gatilhoCumprido(estado, POR_SLUG.get(slug))) return { ok: false, erro: 'Enfrente os três Lordes Bandidos (Ponte Quebrada, Floresta Ocidental e Terras Inundadas) primeiro.' };
    garantir(estado).bandido = m.bandido;
    const missao = POR_SLUG.get(slug);
    const premio = m.bandido === 'todos' ? `${missao.recompensas.pontos} Ponto${missao.recompensas.pontos === 1 ? '' : 's'} de Habilidade Passiva` : missao.recompensas.bonus.join(', ');
    return { ok: true, notice: `${missao.nome}: ${premio}.` };
  }
  if (m.action === 'escolher') {
    const missao = POR_SLUG.get(m.missao);
    if (!missao) return { ok: false, erro: 'Missão desconhecida.' };
    if (!concluida(estado, missao)) return { ok: false, erro: 'Essa missão ainda não foi concluída.' };
    if (estado?.missoes?.escolhas?.[missao.slug] != null) return { ok: false, erro: 'A recompensa desta missão já foi escolhida.' };
    const op = missao.recompensas?.escolha?.[Number(m.opcao)];
    if (!op) return { ok: false, erro: 'Essa não é uma das recompensas desta missão.' };
    if (op.tipo === 'gema') darGema(estado, op.id);
    else if (op.tipo === 'moeda') darItem(estado, op.id, 1);
    else {
      const peca = criarPeca(op.base);
      if (!peca) return { ok: false, erro: 'Esse item não está no jogo.' };
      darPeca(estado, peca);
    }
    garantir(estado).escolhas[missao.slug] = Number(m.opcao);
    return { ok: true, notice: `Recompensa de ${missao.nome}: ${op.nome} na mochila.` };
  }
  return { ok: false, erro: 'Ação desconhecida.' };
}

/**
 * (05/11, dono: "tem que ser só PoE") As PRÉVIAS das recompensas de base para o balão da aba: a peça Normal de cada base (a do PoE, com o
 * balão do PoE — a raridade só é sorteada ao resgatar), no Item Level `ilvl`. `criarPrevia(base, ilvl)`: a do jogo (`pecaNormalDaBase`).
 * Guardadas por Item Level (as bases e as linhas não mudam).
 */
const PREVIAS = new Map();
export function previasDasRecompensas(ilvl, criarPrevia) {
  const nivel = Math.max(1, Math.round(Number(ilvl) || 1));
  if (!PREVIAS.has(nivel)) {
    const saida = {};
    for (const m of MISSOES) for (const op of m.recompensas?.escolha ?? []) if (op.tipo === 'base' && !(op.base in saida)) saida[op.base] = criarPrevia(op.base, nivel) ?? null;
    PREVIAS.set(nivel, saida);
  }
  return PREVIAS.get(nivel);
}

/** Um pináculo caiu (hunt/combate.mjs `vitoriaNoBoss`): fica registrado para as missões do Atlas. */
export function aoVencerPinaculo(estado, bossId) {
  if (!ligado() || !bossId || !MISSOES.some((m) => m.gatilho?.pinaculo?.includes(bossId))) return;
  (garantir(estado).pinaculos ??= {})[bossId] ??= Date.now();
}
/** Um mapa único foi concluído (itens-poe/mapa-aberto.mjs `encerrar`): fica registrado (Segmentos da Originadora). */
export function aoConcluirMapa(estado, unico) {
  if (!ligado() || !unico || !MISSOES.some((m) => m.gatilho?.unicos?.includes(unico))) return;
  (garantir(estado).unicos ??= {})[unico] ??= Date.now();
}

/**
 * Põe os itens de missão no catálogo de itens: os novos com o ícone do poedb; os 16 que já existiam (drops-por-monstro.mjs, que caem dos
 * monstros) ganham o ícone e as linhas. Sem o sistema ligado, nada.
 */
export function registrarItens(itemCatalog) {
  if (!ligado()) return 0;
  for (const it of ITENS) {
    const poe = it.icone ? { icone: it.icone, iconeLado: 64 } : undefined;
    const ja = itemCatalog[it.itemId];
    const extra = { ...(poe ? { poe } : {}), missaoPoe: { tipo: it.tipo, slug: it.slug, linhas: it.linhas ?? [], sabor: it.sabor ?? null } };
    if (ja) Object.assign(ja, extra);
    else itemCatalog[it.itemId] = { id: it.itemId, name: it.nome, type: 'quest items', weight: 0, hasSprite: false, rarity: 'comum', stackable: false, ...extra };
  }
  return ITENS.length;
}
