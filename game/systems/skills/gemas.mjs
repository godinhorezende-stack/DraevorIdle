// GEMAS DE SKILL, SUPPORTS e SOCKETS — o modelo Path of Exile (pedido do
// dono, 30/09): a skill vem da GEMA ATIVA encaixada num socket de uma peça
// VESTIDA; as SUPPORT GEMS ligadas a ela (sockets vizinhos com link) a
// modificam. Sem gema, sem skill (a Action Bar só mostra o que está encaixado).
//
// Configuração em `gamedata/gemas/` (config, supports, exceções por skill, ids
// estáveis). As "gemas" do Gem Atelier (`systems/gemas.mjs`) são outra coisa.
//
// Onde mora cada coisa (o personagem é um JSON — nada de tabela nova):
//   - a gema solta é um ITEM (id de `ids.json`, um por gema), com a instância
//     `gema: { nivel, xp }` — anda pela mochila, depósito, mercado como item;
//   - a peça ganha `soquetes: { abertos, links: [bool], gemas: [{id, nivel, xp} | null] }`;
//     o MÁXIMO sai do slot (config), para a regra poder mudar sem migrar.
//
// Quem valida é o servidor: encaixar/tirar, a XP, o nível, o efeito na skill.
import { readFileSync } from 'node:fs';
import { ITEM_CATALOG, ACTION_CATALOG, ACTION_CATALOG_ALTO, LEVELS_DAS_CAPTURAS } from '../dados.mjs';
import * as Tags from './tags.mjs';
import * as R from '../regras.mjs';
import * as SocketsPoe from '../itens-poe/sockets.mjs';
import * as CompatSuportes from '../itens-poe/compat-suportes.mjs';
import * as ModsPoe from '../itens-poe/condicoes-poe.mjs';

const ler = (f) => JSON.parse(readFileSync(new URL(`../../gamedata/gemas/${f}.json`, import.meta.url), 'utf8'));
export const CONFIG = ler('config');
export const SUPPORTS = ler('supports').supports;
/** O nome em português dos supports (`nomes-pt.json`): só apresentação — o id e o `nome` em inglês seguem como chave. */
const NOMES_PT = ler('nomes-pt').suportes ?? {};
export const nomeDoSupportPt = (id) => NOMES_PT[id] ?? null;
const EXCECOES = ler('skills').gemas ?? {};
const IDS = ler('ids').ids;

/** As skills que viram gema: magias e runas (poções seguem itens — decisão do dono). */
const ACOES = new Map();
for (const c of [ACTION_CATALOG, ACTION_CATALOG_ALTO]) for (const e of [...(c?.spells ?? []), ...(c?.runes ?? [])]) if (!ACOES.has(e.id)) ACOES.set(e.id, e);
export const ehSkillDeGema = (entry) => entry?.kind === 'spell' || entry?.kind === 'rune';

/** O tempo de conjuração padrão de uma skill (ms), pelo tipo dela. */
function castTimePadrao(e) {
  const c = CONFIG.castTimePadrao;
  if (e.papeis?.[0] === 'attack') return e.kind === 'rune' ? c.runa : c.ataque;
  if (e.heals || e.papeis?.[0] === 'hp') return c.cura;
  return c.suporte;
}

// ---------------------------------------------------------------- definições

/** itemId → definição da gema. */
export const DEFS = new Map();
/** id da ação (magia/runa) → itemId da gema dela. */
export const ITEM_DA_ACAO = new Map();

/** Qual skill escala o dano da gema: 'melee' ou 'distance' (físicas, pela tag `ranged`) ou 'magic' (todo o resto). A tooltip lê esta mesma regra. */
export function habilidadeDeEscala(def) {
  // A exceção da gema (`skills.json`: `escala`) vence a regra das tags — a habilidade elemental que escala com Melee ou Distance.
  if (def?.escala) return def.escala;
  const tags = def?.tags ?? [];
  if (!tags.includes('physical')) return 'magic';
  return tags.includes('ranged') ? 'distance' : 'melee';
}

/**
 * O bônus (em %) do TREINO na skill (decisão do dono, 30/09: o dano base escala
 * pelo level E pelo magic level — melee/distance nas skills físicas): magic
 * level × `porMagicLevel` nas mágicas e curas; nas físicas, skill × `porSkill`:
 * melee de perto, distance de longe (tag `ranged`). Treinado + bônus.
 */
export function bonusDoTreino(estado, def, ficha = null) {
  // No PoE não há perícia (dono, 06/10): o dano da gema escala pelo nível dela e pelo level, não por skill.
  if (SocketsPoe.poeLigado()) return 0;
  const D = CONFIG.dano;
  const bonus = ficha?.skillBonus ?? {};
  // Magia de dano físico (decisão do dono, 30/09): de perto, level + MELEE; de longe (tag `ranged`), level + DISTANCE.
  const pericia = habilidadeDeEscala(def);
  if (pericia !== 'magic') {
    return ((estado.skills?.[pericia]?.value ?? 0) + (bonus[pericia] ?? 0)) * D.porSkill;
  }
  return ((estado.magic?.value ?? 0) + (bonus.magic ?? 0)) * D.porMagicLevel;
}

/*
 * ---- As CATEGORIAS de gema (como no Path of Exile; decisão do dono, 30/09) ----
 *  - ataque:  gema de skill que causa dano;
 *  - cura:    gema de skill que cura;
 *  - reforco: gema de skill que não bate nem cura — buffs, posturas, auras,
 *             escudo, velocidade, familiar, runas de campo;
 *  - suporte: não dá skill: modifica a gema de skill LIGADA a ela.
 */
export const CATEGORIAS = {
  ataque: 'Gema de Ataque',
  cura: 'Gema de Cura',
  reforco: 'Gema de Reforço',
  suporte: 'Gema de Suporte',
};
const categoriaDaAcao = (e) => (e?.heals ? 'cura' : e?.damage ? 'ataque' : 'reforco');

const elementoDaSprite = (e) => (e?.heals ? 'healing' : e?.element === 'poison' ? 'earth' : e?.element);
for (const [chave, itemId] of Object.entries(IDS)) {
  if (chave.startsWith('support:')) {
    const id = chave.slice(8);
    const s = SUPPORTS[id];
    if (!s) continue;
    DEFS.set(itemId, { itemId, tipo: 'support', categoria: 'suporte', id, nome: s.nome, nomePt: nomeDoSupportPt(id), levelMinimo: s.levelMinimo ?? 1, suporte: s });
    continue;
  }
  const e = ACOES.get(chave);
  if (!e) continue;
  const exc = EXCECOES[chave] ?? {};
  DEFS.set(itemId, {
    itemId,
    tipo: 'ativa',
    categoria: categoriaDaAcao(e),
    id: chave,
    acao: chave,
    nome: e.name,
    tags: Tags.tagsDaAcao(e),
    classeRecomendada: Tags.classeRecomendada(e),
    // Nenhuma trava (decisão do dono): qualquer personagem usa qualquer gema, em qualquer nível.
    // `levelDaMagia`: o level da magia no catálogo — só para o preço na loja.
    levelMinimo: 1,
    levelDaMagia: Math.max(1, e.level ?? 1),
    castTime: exc.castTime ?? castTimePadrao(e),
    progressao: exc.progressao ?? CONFIG.progressaoPadrao,
    // O balanceamento do dano da skill (× no dano; `skills.json`).
    fatorDeDano: exc.fatorDeDano ?? 1,
    // O balanceamento da CURA (× na cura) e do CUSTO de mana (× no custo do catálogo) — `skills.json`.
    fatorDeCura: exc.fatorDeCura ?? 1,
    fatorDeCusto: exc.fatorDeCusto ?? 1,
    // A skill/arma que escala o dano, quando não é a das tags (`skills.json`).
    ...(exc.escala ? { escala: exc.escala } : {}),
  });
  ITEM_DA_ACAO.set(chave, itemId);
}

/*
 * As gemas no CATÁLOGO DE ITENS (o cliente desenha e o inventário guarda como
 * qualquer item): nome, a pedra do elemento como figura (`spriteDe`), leve,
 * não empilha (cada uma tem nível e XP).
 */
for (const def of DEFS.values()) {
  const e = def.acao ? ACOES.get(def.acao) : null;
  ITEM_CATALOG[def.itemId] ??= {
    id: def.itemId,
    name: `gema: ${def.nome.toLowerCase()}`,
    // O nome que o jogador vê (supports em português); `name` segue como chave (testes, busca, save).
    ...(def.nomePt ? { nomeExibicao: `Gema: ${def.nomePt}` } : {}),
    weight: 0.1,
    stackable: false,
    type: 'gema',
    rarity: 'comum', // a de verdade é da instância (`raridade`)
    hasSprite: true,
    spriteDe: CONFIG.sprites[def.tipo === 'support' ? 'support' : elementoDaSprite(e)] ?? CONFIG.sprites.outro,
    gemaDef: def.tipo === 'support'
      ? { tipo: 'support', categoria: 'suporte', id: def.id, nome: def.nome, nomePt: def.nomePt, requer: def.suporte.requer ?? [], algum: def.suporte.algum ?? [], exclui: def.suporte.exclui ?? [], efeito: def.suporte.efeito, porNivel: def.suporte.porNivel ?? {}, mult: CONFIG.raridades.multiplicador }
      : { tipo: 'ativa', categoria: def.categoria, acao: def.acao, nome: def.nome, tags: def.tags, classeRecomendada: def.classeRecomendada, levelMinimo: def.levelMinimo, castTime: def.castTime, progressao: def.progressao, mult: CONFIG.raridades.multiplicador, nivelMaximo: CONFIG.niveis.maximo },
    sell: 0,
  };
}

// A LAPIDADORA: a moeda que sobe a qualidade da gema (empilha; cai de bicho).
const Q = CONFIG.qualidade;
export const LAPIDADORA = Q.lapidadora.itemId;
ITEM_CATALOG[LAPIDADORA] ??= {
  id: LAPIDADORA,
  name: Q.lapidadora.nome,
  weight: 0.1,
  stackable: true,
  type: 'moeda',
  rarity: 'raro',
  hasSprite: true,
  spriteDe: Q.lapidadora.sprite,
  descricao: `Use numa gema de skill: +${Q.lapidadora.ganho[0]}% a +${Q.lapidadora.ganho[1]}% de qualidade (até ${Q.maximo}%).`,
  sell: 0,
};

// A FUNDIDORA: a moeda que sorteia de novo os links da peça (empilha; cai de bicho).
const F = CONFIG.fundidora;
export const FUNDIDORA = F.itemId;
ITEM_CATALOG[FUNDIDORA] ??= {
  id: FUNDIDORA,
  name: F.nome,
  weight: 0.1,
  stackable: true,
  type: 'moeda',
  rarity: 'raro',
  hasSprite: true,
  spriteDe: F.sprite,
  descricao: 'Use numa peça vestida: sorteia de novo os links entre os sockets abertos (mais chance de ligar quanto mais rara a peça).',
  sell: 0,
};

// Os ORBES de socket (config `orbes`): itens reais da mochila, que empilham e o NPC não compra de volta.
const O = CONFIG.orbes;
export const ORBE_DE_ENCAIXE = O.encaixe.itemId;
export const ORBE_DE_LIGACAO = O.ligacao.itemId;
for (const o of [O.encaixe, O.ligacao]) {
  ITEM_CATALOG[o.itemId] ??= {
    id: o.itemId,
    name: o.nome,
    weight: 0.1,
    stackable: true,
    type: 'moeda',
    rarity: 'lendário',
    hasSprite: true,
    spriteDe: o.sprite,
    descricao: o.descricao,
    // Para a tela: que orbe é, e o máximo de sockets de cada slot (a peça sem `soquetes` ainda não diz).
    orbeDeSocket: o === O.encaixe ? 'encaixe' : 'ligacao',
    limitesDeSocket: CONFIG.sockets.maximo,
    sell: 0,
  };
}

// Os ORBES DO PoE (dono, 06/10: "os do PoE no lugar" — `itens-poe/regras.json` → `sockets.orbes`): Joalheiro, Fusão e Cromático. No modo
// PoE eles caem e a Zuma vende; os do Draevor (encaixe, ligação, fundidora) param de cair e de ser vendidos — quem já tem ainda usa.
export const ORBES_DO_POE = SocketsPoe.orbes();
for (const [tipo, o] of Object.entries(SocketsPoe.poeLigado() ? ORBES_DO_POE : {})) {
  if (!o?.itemId) continue;
  ITEM_CATALOG[o.itemId] ??= {
    id: o.itemId, name: o.nome, weight: 0.1, stackable: true, type: 'moeda', rarity: 'raro',
    hasSprite: true, spriteDe: F.sprite,
    // O ícone do PoE (`gamedata/itens-poe/icones-moedas`, servido em `/api/jogo/poe/icone/moeda/`).
    poeMoeda: { icone: o.icone },
    descricao: o.descricao,
    orbeDeSocket: tipo, orbeDoPoe: true,
    limitesDeSocket: CONFIG.sockets.maximo,
    sell: 0,
  };
}

/**
 * Registra uma gema ATIVA que não vem do catálogo do Draevor — as gemas do PoE (`itens-poe/gemas-poe.mjs`, só com ITENS_POE=1): a ação
 * (`entry`, já no catálogo de ações), a definição e o item. A progressão é a do PoE (o dano/custo vêm do nível da gema), então `progressao`
 * fica vazia; os suportes do Draevor valem pelas tags.
 */
export function registrarAtiva({ itemId, entry, gema, tabelaDeXp = gema, categoria, castTime, levelMinimo = 1 }) {
  ACOES.set(entry.id, entry);
  const def = {
    // As tags do Draevor (o molde) e as do PoE (`poe:Projétil`, `poe:Magia`...): os suportes do PoE conferem a compatibilidade por estas.
    // + a marca dos suportes do PoE que a suportam (`poe-sup:<bits>`, a lista do PoE — `itens-poe/compat-suportes.mjs`).
    itemId, tipo: 'ativa', categoria, id: entry.id, acao: entry.id, nome: gema.nome, tags: [...Tags.tagsDaAcao(entry), ...(gema.tags ?? []).map((t) => `poe:${t}`), ...(CompatSuportes.tagDaAtiva(gema.slug) ? [CompatSuportes.tagDaAtiva(gema.slug)] : [])], classeRecomendada: null,
    levelMinimo, levelDaMagia: levelMinimo, castTime, progressao: {}, fatorDeDano: 1, fatorDeCura: 1, fatorDeCusto: 1,
    poe: { slug: gema.slug, cor: gema.cor, icone: gema.icone ?? null, en: gema.en },
    // A XP por nível: a da gema ou, sem ela no arquivo, a da gema de base (`tabelaDeXp`, de `GemasPoe.gemaDaTabelaDeXp`).
    poeXp: tabelaDeXpDoPoe(tabelaDeXp),
  };
  DEFS.set(itemId, def);
  ITEM_DA_ACAO.set(entry.id, itemId);
  ITEM_CATALOG[itemId] = {
    id: itemId, name: `gema: ${gema.nome.toLowerCase()}`, nomeExibicao: `Gema: ${gema.nome}`, weight: 0.1, stackable: false, type: 'gema', rarity: 'comum',
    hasSprite: true, spriteDe: CONFIG.sprites[elementoDaSprite(entry)] ?? CONFIG.sprites.outro,
    // O ícone da gema do PoE (a coleção do dono): o cliente desenha ele no lugar da pedra.
    poeGema: { slug: gema.slug, cor: gema.cor, icone: gema.icone ?? null },
    gemaDef: { tipo: 'ativa', categoria, acao: entry.id, nome: gema.nome, tags: def.tags, classeRecomendada: null, levelMinimo, castTime, progressao: {}, mult: CONFIG.raridades.multiplicador, nivelMaximo: def.poeXp.maximo, poe: def.poe },
    sell: 0,
  };
  return def;
}
/**
 * A PROGRESSÃO da gema do PoE (dono, 06/10: "as gemas sempre dropam e se compram no nível 1, e sobem pela progressão que está nos
 * arquivos"): a tabela de níveis do poedb da gema — `Experiência` é a XP para ir do nível N ao N+1 (por nível, não acumulada) e
 * `RequerNível` o level do personagem que o nível pede. O máximo por XP é o último nível com XP + 1 (o 20 das gemas comuns).
 */
function tabelaDeXpDoPoe(gema) {
  const col = (nome) => gema.colunas?.indexOf(nome) ?? -1;
  const ix = col('Experiência');
  const ir = col('RequerNível');
  const num = (v) => Number(String(v ?? '').replace(/,/g, '')) || 0;
  const xp = (gema.linhas ?? []).map((l) => (ix >= 0 ? num(l[ix]) : 0));
  const req = (gema.linhas ?? []).map((l) => (ir >= 0 ? num(l[ir]) : 1));
  let ultimo = -1;
  xp.forEach((v, i) => { if (v > 0) ultimo = i; });
  return { xp, req, maximo: ultimo + 2 };
}

/**
 * Registra uma gema de SUPORTE do PoE (`itens-poe/suportes-poe.mjs`, só com ITENS_POE=1): a compatibilidade pelas tags do PoE da ativa
 * (`requer`: `poe:Projétil`...), o efeito NO NÍVEL (`efeitoDoPoe(nivel, qualidade, ativa)` → as mesmas chaves dos suportes do Draevor:
 * `danoPct`, `custoPct`, `castTimePct`...) e o gatilho, quando é um suporte de ativação. A XP é a da tabela dele.
 */
export function registrarSuporte({ itemId, suporte, requer = [], algum = [], exclui = [], efeitoDoPoe, gatilho = null, levelMinimo = 1 }) {
  const id = `poe-suporte:${suporte.slug}`;
  // O índice do suporte na lista do PoE (quais gemas ativas ele suporta — `itens-poe/compat-suportes.mjs`); sem lista, as tags.
  const indicePoe = CompatSuportes.indiceDoSuporte(suporte.slug);
  const def = {
    itemId, tipo: 'support', categoria: 'suporte', id, nome: suporte.nome, nomePt: suporte.nome, levelMinimo,
    suporte: { nome: suporte.nome, requer, algum, exclui, efeito: {}, porNivel: {}, efeitoDoPoe, gatilho, ...(indicePoe != null ? { indicePoe } : {}) },
    poe: { slug: suporte.slug, cor: suporte.cor, icone: suporte.icone ?? null, en: suporte.en, suporte: true },
    poeXp: tabelaDeXpDoPoe(suporte),
  };
  DEFS.set(itemId, def);
  ITEM_CATALOG[itemId] = {
    id: itemId, name: `gema: ${suporte.nome.toLowerCase()}`, nomeExibicao: `Gema: ${suporte.nome}`, weight: 0.1, stackable: false, type: 'gema', rarity: 'comum',
    hasSprite: true, spriteDe: CONFIG.sprites.support ?? CONFIG.sprites.outro,
    poeGema: { slug: suporte.slug, cor: suporte.cor, icone: suporte.icone ?? null, suporte: true },
    gemaDef: { tipo: 'support', categoria: 'suporte', id, nome: suporte.nome, nomePt: suporte.nome, requer, algum, exclui, ...(indicePoe != null ? { indicePoe } : {}), efeito: {}, porNivel: {}, mult: CONFIG.raridades.multiplicador, nivelMaximo: def.poeXp.maximo, poe: def.poe },
    sell: 0,
  };
  return def;
}
/** Com as gemas do PoE ligadas, as do Draevor saem de cena (drop, loja, iniciais): as ATIVAS quando há ativas do PoE, os SUPORTES quando há suportes do PoE. */
const soDoPoe = () => [...DEFS.values()].some((d) => d.poe && d.tipo === 'ativa');
const suportesDoPoe = () => [...DEFS.values()].some((d) => d.poe && d.tipo === 'support');
const valeNoModo = (def) => (def.tipo === 'support' ? !suportesDoPoe() || !!def.poe : !soDoPoe() || !!def.poe);

export const defDaGema = (itemId) => DEFS.get(Number(itemId)) ?? null;
export const ehGema = (id) => DEFS.has(Number(id));

// ---------------------------------------------------------------- níveis e XP

const N = CONFIG.niveis;
/**
 * A XP para sair do nível `nivel` da gema, com o personagem no `level` dele AGORA
 * (decisão do dono, 30/09): uma fração da exp de UM level do personagem nesse level —
 * 1–10 fácil, 10–20 normal, 20–30 difícil (`faixas`). Um level 50 e um level 500
 * levam o mesmo tempo para subir a gema.
 */
export function xpParaSubir(nivel, level = 1) {
  const n = Math.max(1, Math.floor(nivel));
  const L = Math.max(1, Math.floor(level));
  const umLevel = R.expDeUmLevel(L);
  const faixa = N.faixas.find((f) => n < f.ate) ?? N.faixas.at(-1);
  return Math.max(1, Math.round(umLevel * faixa.parteDaExpDoPersonagem));
}

/** O nível máximo POR XP da gema: o da tabela do PoE (20) ou o do Draevor (`niveis.maximo`). */
export const maximoDaGema = (def) => (def?.poeXp ? def.poeXp.maximo : N.maximo);
/** A XP para a gema sair do `nivel`: a da tabela do PoE dela ou a régua do Draevor (pelo level do personagem). */
export const xpDaGema = (def, nivel, level = 1) => (def?.poeXp ? def.poeXp.xp[Math.max(1, Math.floor(nivel)) - 1] || 0 : xpParaSubir(nivel, level));
/** O level do personagem que o `nivel` da gema do PoE pede (`RequerNível`); 0 nas do Draevor (sem trava). */
export const levelDoNivel = (def, nivel) => (def?.poeXp ? def.poeXp.req[Math.max(1, Math.floor(nivel)) - 1] ?? 0 : 0);
/** `xpProximo` da tela: a XP do nível ou 0 no máximo. */
export const xpProximoDaGema = (def, nivel, level = 1) => (nivel >= maximoDaGema(def) ? 0 : xpDaGema(def, nivel, level));

// ---------------------------------------------------------------- raridade

const RAR = CONFIG.raridades;
/** A raridade válida (o que não for uma delas vira comum). */
export const raridadeDaGema = (r) => (RAR.ordem.includes(r) ? r : 'comum');
/** Quanto a raridade multiplica o bônus da gema (nível da ativa, efeito da support). */
export const multiplicadorDaRaridade = (r) => RAR.multiplicador[raridadeDaGema(r)] ?? 1;
/** O fator de raridade do estágio (Ato × dificuldade da fase); 1 fora da campanha. */
export const fatorDoEstagio = (ato, dificuldade) => RAR.porEstagio?.[dificuldade]?.[Number(ato) - 1] ?? 1;
/** Sorteia a raridade de uma gema que cai de bicho (`raridades.pesoNoDrop`, pelo estágio da fase). */
export function sortearRaridade(rng = Math.random, { ato = null, dificuldade = null } = {}) {
  const fator = fatorDoEstagio(ato, dificuldade);
  // Raro para cima × o fator do estágio (e o mítico ainda × `fatorDoMitico`); o comum e o incomum ficam como estão.
  const pesos = Object.entries(RAR.pesoNoDrop).map(([r, p]) => [r, RAR.ordem.indexOf(r) >= RAR.ordem.indexOf('raro') ? p * fator * (r === 'mítico' ? RAR.fatorDoMitico ?? 1 : 1) : p]);
  let sorte = rng() * pesos.reduce((t, [, p]) => t + p, 0);
  for (const [r, p] of pesos) if ((sorte -= p) < 0) return r;
  return 'comum';
}

/** A qualidade válida (0..maximo, inteira). */
export const qualidadeDaGema = (q) => Math.max(0, Math.min(Q.maximo, Math.floor(Number(q) || 0)));

/** Uma gema nova (instância): `{ id, nivel, xp, raridade, qualidade }` — sempre no nível 1. */
export const novaGema = (itemId, raridade = 'comum', qualidade = 0) => ({ id: Number(itemId), nivel: 1, xp: 0, raridade: raridadeDaGema(raridade), qualidade: qualidadeDaGema(qualidade) });

/** O +N ao nível das gemas que a PEÇA dá (o add `gem_level`) — o que leva a gema além do 20. */
export const bonusDeNivelDaPeca = (peca) => (peca?.af ?? []).reduce((t, a) => t + (a.id === 'gem_level' ? Number(a.value) || 0 : 0), 0) + (Number(peca?.poe?.af?.gem_level) || 0);

/**
 * O NÍVEL e a QUALIDADE a mais de UMA gema pelos mods do PoE (07/10): os LOCAIS da peça em que ela está ("+1 ao Nível das Gemas de Fogo
 * Encaixadas", "+2 ao Nível de Gemas de Suporte Encaixadas", "+20% à Qualidade das Gemas Encaixadas") e os GLOBAIS de todas as peças
 * vestidas ("+1 ao Nível de todas as Gemas Habilidades de Magias de Fogo"). As condições são as tags da gema (`poe:Fogo`…), + `habilidade`
 * (gema ativa) ou `suporte`. `{ nivel, qualidade }`.
 */
export function extrasDaGemaPoe(estado, peca, def) {
  const tags = new Set([...ModsPoe.tagsDoPoe(def?.tags ?? []), def?.tipo === 'support' ? 'suporte' : 'habilidade']);
  const vale = (chave, base) => {
    const { stat, conds } = ModsPoe.partir(chave);
    return stat === base && conds.every((c) => tags.has(c));
  };
  const somar = (af, base) => Object.entries(af ?? {}).reduce((t, [k, v]) => t + (typeof v === 'number' && vale(k, base) ? v : 0), 0);
  let nivel = somar(peca?.poe?.af, 'gem_level_local');
  let qualidade = somar(peca?.poe?.af, 'gem_quality_local');
  for (const p of Object.values(estado?.equipment ?? {})) {
    if (!p?.poe?.af) continue;
    nivel += Object.entries(p.poe.af).reduce((t, [k, v]) => t + (typeof v === 'number' && ModsPoe.ehCondicional(k) && vale(k, 'gem_level') ? v : 0), 0);
    qualidade += Object.entries(p.poe.af).reduce((t, [k, v]) => t + (typeof v === 'number' && ModsPoe.ehCondicional(k) && vale(k, 'gem_quality') ? v : 0), 0);
  }
  return { nivel: Math.round(nivel), qualidade: Math.round(qualidade) };
}

// ---------------------------------------------------------------- sockets

/**
 * O máximo de sockets de uma peça (pelo slot do catálogo; 0 = não tem). Peça do PoE (`meta.poe`): pela classe e pelo item level dela
 * (`itens-poe/sockets.mjs`; sem a `peca`, o máximo da classe).
 */
// (PoE: "Possui N Encaixes" — a base com encaixe fixo, como o anel/amuleto/cinto Desmontado — e "Não Possui Encaixes".)
export const maximoDeSockets = (meta, peca = null) => {
  if (!meta?.poe) return CONFIG.sockets.maximo[meta?.slot] ?? 0;
  if (Number(peca?.poe?.af?.sem_encaixes) > 0) return 0;
  const fixos = Math.round(Number(peca?.poe?.af?.encaixes_fixos) || 0);
  return fixos > 0 ? fixos : SocketsPoe.maximo(SocketsPoe.classeDe(meta, peca), peca?.poe?.ilvl ?? null);
};

/** Os sockets de uma peça, normalizados ao máximo do slot (sem gravar). */
export function soquetesDe(peca) {
  const max = maximoDeSockets(ITEM_CATALOG[peca?.id], peca);
  if (!max) return null;
  const s = peca.soquetes ?? {};
  const abertos = Math.max(0, Math.min(max, Math.floor(Number(s.abertos) || 0)));
  const links = Array.from({ length: max - 1 }, (_, i) => !!s.links?.[i]);
  const gemas = Array.from({ length: max }, (_, i) => (i < abertos && s.gemas?.[i] && DEFS.has(Number(s.gemas[i].id)) ? s.gemas[i] : null));
  // No PoE os sockets têm COR (`itens-poe/sockets.mjs`).
  return { max, abertos, links, gemas, ...(SocketsPoe.poeLigado() ? { cores: coresDe(peca, max, gemas) } : {}) };
}

/** A cor de uma gema (a do PoE; a gema sem cor, as do Draevor, vale como branca). */
export const corDaGema = (g) => SocketsPoe.corDaGema(DEFS.get(Number(g?.id))?.poe?.cor);
/**
 * As CORES dos sockets da peça: as gravadas; a peça que ainda não tinha sorteia de um jeito FIXO (pelos requisitos de atributo da base),
 * e o socket que já tem gema fica com a cor dela — a gema que já estava encaixada nunca fica no socket errado.
 */
function coresDe(peca, max, gemas) {
  const gravadas = peca.soquetes?.cores;
  const rng = SocketsPoe.sorteioFixo(`${peca.id}|${peca.poe?.ilvl ?? ''}|${JSON.stringify(peca.poe?.modificadores ?? peca.af ?? '')}`);
  const fixas = SocketsPoe.sortearCores(max, ITEM_CATALOG[peca.id]?.poe?.requisitos ?? null, rng);
  return Array.from({ length: max }, (_, i) => {
    const c = ['R', 'G', 'B', 'W'].includes(gravadas?.[i]) ? gravadas[i] : fixas[i];
    return gemas[i] && !SocketsPoe.cabe(c, corDaGema(gemas[i])) ? corDaGema(gemas[i]) : c;
  });
}
/** Grava os sockets `s` (de `soquetesDe`, mudados) na peça, sem perder campos extras. */
export function gravarSoquetes(peca, s) {
  peca.soquetes = { ...(peca.soquetes ?? {}), abertos: s.abertos, links: s.links, gemas: s.gemas, ...(s.cores ? { cores: s.cores } : {}) };
}
/** No PoE: grava as cores nas peças do personagem que ainda não têm (a tela lê da peça). Devolve quantas mudaram. */
export function gravarCores(estado) {
  if (!SocketsPoe.poeLigado()) return 0;
  let n = 0;
  const pecas = [...Object.values(estado?.equipment ?? {}), ...(estado?.inventory ?? []), ...(estado?.pouch ?? [])];
  for (const p of pecas) {
    if (!p || typeof p !== 'object' || !p.soquetes || p.soquetes.cores) continue;
    const s = soquetesDe(p);
    if (s?.cores) { gravarSoquetes(p, s); n++; }
  }
  return n;
}

/** Sockets novos, todos abertos e ligados (as peças que já existiam — decisão do dono). */
export function soquetesAbertos(meta) {
  const max = maximoDeSockets(meta);
  return max ? { abertos: max, links: Array(max - 1).fill(true), gemas: Array(max).fill(null) } : null;
}

/**
 * Os sockets de uma peça que CAI (`raridade`, `rng`): quantos abertos pelo peso
 * da raridade (sem passar do máximo do slot) e os links entre vizinhos abertos.
 */
export function sortearSoquetes(meta, raridade, rng = Math.random) {
  const max = maximoDeSockets(meta);
  if (!max) return null;
  const regra = CONFIG.sockets.drop[raridade] ?? CONFIG.sockets.drop.comum;
  const pesos = Object.entries(regra.abertos).map(([n, p]) => [Math.min(max, Number(n)), p]);
  let r = rng() * pesos.reduce((a, [, p]) => a + p, 0);
  let abertos = pesos[pesos.length - 1][0];
  for (const [n, p] of pesos) if ((r -= p) < 0) { abertos = n; break; }
  const links = Array.from({ length: max - 1 }, (_, i) => i + 1 < abertos && rng() < regra.chanceDeLink);
  return { abertos, links, gemas: Array(max).fill(null), ...(SocketsPoe.poeLigado() ? { cores: SocketsPoe.sortearCores(max, meta?.poe?.requisitos ?? null, rng) } : {}) };
}

// Os grupos ligados e a compatibilidade por tag: a MESMA regra que a tela usa (engine/sockets-de-gema.mjs).
export { gruposLigados, grupoDoSocket, compativel } from '../../engine/sockets-de-gema.mjs';
import { gruposLigados, compativel } from '../../engine/sockets-de-gema.mjs';
import { podeEntrar, MENSAGEM as SO_ITENS_DO_POE } from '../itens-poe/so-itens-do-poe.mjs';

// + as luvas, que no PoE têm slot próprio (e sockets).
// (+ o segundo anel do PoE, `ring2`: o anel com encaixe — "Possui 1 Encaixes" — vale nos dois lados.)
const SLOTS_COM_SOCKET = [...new Set([...Object.keys(CONFIG.sockets.maximo), 'gloves', 'ring2'])];

/**
 * A MESMA support duas vezes no grupo vale UMA vez (como no Path of Exile; pedido do
 * dono, 01/10): fica a de nível mais alto (empate: a de raridade/qualidade maior).
 * Antes somavam — duas Pierce davam 4 perfurações a 49%.
 */
function unicas(supports) {
  const melhor = new Map();
  const forca = (sp) => sp.nivel * 1e6 + multiplicadorDaRaridade(sp.raridade) * 1e3 + sp.qualidade;
  for (const sp of supports) {
    const ja = melhor.get(sp.def.id);
    if (!ja || forca(sp) > forca(ja)) melhor.set(sp.def.id, sp);
  }
  return [...melhor.values()];
}

/**
 * As SKILLS que este personagem tem agora: cada gema ativa encaixada numa peça
 * VESTIDA, com as supports compatíveis do MESMO grupo ligado.
 * `Map(idDaAcao → { acao, itemId, nivel, xp, def, supports: [{ def, nivel }], onde: {slot, indice} })`.
 * A mesma skill em dois sockets: vale a de nível mais alto.
 */
export function skillsAtivas(estado) {
  const saida = new Map();
  for (const slot of SLOTS_COM_SOCKET) {
    const peca = estado?.equipment?.[slot];
    const s = peca && soquetesDe(peca);
    if (!s) continue;
    const bonus = bonusDeNivelDaPeca(peca);
    for (const grupo of gruposLigados(s)) {
      const noGrupo = grupo.map((i) => ({ i, g: s.gemas[i], def: s.gemas[i] && DEFS.get(Number(s.gemas[i].id)) })).filter((x) => x.def);
      const supports = noGrupo.filter((x) => x.def.tipo === 'support');
      for (const x of noGrupo.filter((y) => y.def.tipo === 'ativa')) {
        const anterior = saida.get(x.def.acao);
        const doPoe = extrasDaGemaPoe(estado, peca, x.def);
        if (anterior && anterior.nivel >= x.g.nivel + bonus + doPoe.nivel) continue;
        saida.set(x.def.acao, {
          acao: x.def.acao,
          itemId: x.def.itemId,
          // O nível que VALE: o da gema + o bônus da peça (21+ só assim) + os do PoE. `nivelBase`: o da gema.
          nivel: x.g.nivel + bonus + doPoe.nivel,
          nivelBase: x.g.nivel,
          bonusDaPeca: bonus + doPoe.nivel,
          xp: x.g.xp ?? 0,
          raridade: raridadeDaGema(x.g.raridade),
          qualidade: qualidadeDaGema((x.g.qualidade ?? 0) + doPoe.qualidade),
          def: x.def,
          supports: unicas(
            supports
              .filter((sp) => compativel(sp.def.suporte, x.def.tags))
              .map((sp) => { const e = extrasDaGemaPoe(estado, peca, sp.def); return { def: sp.def, nivel: sp.g.nivel + bonus + e.nivel, raridade: raridadeDaGema(sp.g.raridade), qualidade: qualidadeDaGema((sp.g.qualidade ?? 0) + e.qualidade) }; }),
          ),
          onde: { slot, indice: x.i },
        });
      }
    }
  }
  return dasPecas(estado, saida);
}

/** As gemas pelo NOME (`slugDoNome`): as ativas e os suportes — o que as peças do PoE nomeiam ("Concede a Habilidade X"). */
let PELO_NOME = null;
function pelosNomes() {
  if (PELO_NOME && PELO_NOME.n === DEFS.size) return PELO_NOME;
  PELO_NOME = { n: DEFS.size, ativas: new Map(), suportes: new Map() };
  for (const d of DEFS.values()) {
    if (!d.poe) continue;
    (d.tipo === 'support' ? PELO_NOME.suportes : PELO_NOME.ativas).set(ModsPoe.slugDoNome(d.nome), d);
  }
  return PELO_NOME;
}
export const ativaPeloNome = (slug) => pelosNomes().ativas.get(slug) ?? null;
export const suportePeloNome = (slug) => pelosNomes().suportes.get(slug) ?? null;
ModsPoe.definirGemasConhecidas((slug) => !!(ativaPeloNome(slug) || suportePeloNome(slug)));

/**
 * As habilidades que as PEÇAS do PoE dão (únicos): "Concede a Habilidade X Nível N" (vira uma gema na barra), "Ativa X Nível N quando…"
 * (a gema existe, mas só sai pelo evento — `mods-poe.evento`) e "Gemas Encaixadas são Suportadas por X Nível N" (o suporte vale para as
 * ativas daquela peça). Entram em `skillsAtivas`.
 */
function dasPecas(estado, saida) {
  for (const [slot, peca] of Object.entries(estado?.equipment ?? {})) {
    const af = peca?.poe?.af;
    if (!af) continue;
    for (const [k, v] of Object.entries(af)) {
      if (typeof v !== 'number' || !(v > 0)) continue;
      const concede = /^concede:(.+)$/.exec(k);
      const gatilho = /^ev:\w+:gatilho:([^:@]+)/.exec(k);
      const nome = concede?.[1] ?? gatilho?.[1];
      if (!nome) continue;
      const def = ativaPeloNome(nome);
      if (!def || (saida.get(def.acao)?.nivel ?? 0) >= v) continue;
      saida.set(def.acao, { acao: def.acao, itemId: def.itemId, nivel: Math.round(v), nivelBase: Math.round(v), bonusDaPeca: 0, xp: 0, raridade: raridadeDaGema(null), qualidade: 0, def, supports: [], onde: { slot, indice: -1 }, daPeca: true, ...(gatilho ? { ativadaPorItem: true } : {}) });
    }
    // Os suportes da peça para as ativas encaixadas NELA.
    const suportes = Object.entries(af).map(([k, v]) => [/^suporte_local:(.+)$/.exec(k)?.[1], v]).filter(([n, v]) => n && v > 0).map(([n, v]) => [suportePeloNome(n), v]).filter(([d]) => d);
    if (!suportes.length) continue;
    for (const a of saida.values()) {
      if (a.onde?.slot !== slot) continue;
      for (const [d, nivel] of suportes) if (compativel(d.suporte, a.def.tags) && !a.supports.some((sp) => sp.def.id === d.id)) a.supports.push({ def: d, nivel: Math.round(nivel), raridade: raridadeDaGema(null), qualidade: 0 });
    }
  }
  return saida;
}

/**
 * Os grupos de sockets ligados (nas peças VESTIDAS) com um SUPORTE DE GATILHO do PoE: `[{ chave, nome, nivel, gatilho: { quando,
 * recargaMs, limiar }, ataques: [idDaAcao], magias: [idDaAcao] }]`. `ataques`: as gemas de ataque do grupo (quem dispara o crítico/abate);
 * `magias`: as magias do grupo compatíveis com o suporte (as que saem ativadas).
 */
export function gruposComGatilho(estado) {
  const saida = [];
  for (const slot of SLOTS_COM_SOCKET) {
    const peca = estado?.equipment?.[slot];
    const s = peca && soquetesDe(peca);
    if (!s) continue;
    const bonus = bonusDeNivelDaPeca(peca);
    for (const grupo of gruposLigados(s)) {
      const noGrupo = grupo.map((i) => ({ i, g: s.gemas[i], def: s.gemas[i] && DEFS.get(Number(s.gemas[i].id)) })).filter((x) => x.def);
      for (const x of noGrupo.filter((y) => y.def.tipo === 'support' && y.def.suporte?.gatilho)) {
        const gat = typeof x.def.suporte.gatilho === 'function' ? x.def.suporte.gatilho(x.g.nivel + bonus) : x.def.suporte.gatilho;
        const ativas = noGrupo.filter((y) => y.def.tipo === 'ativa');
        saida.push({
          chave: `${slot}:${x.i}`, nome: x.def.nome, nivel: x.g.nivel + bonus, gatilho: gat,
          ataques: ativas.filter((y) => y.def.tags?.includes('poe:Ataque')).map((y) => y.def.acao),
          magias: ativas.filter((y) => y.def.tags?.includes('poe:Magia') && !y.def.tags?.includes('poe:Ataque') && compativel(x.def.suporte, y.def.tags)).map((y) => y.def.acao),
        });
      }
    }
  }
  return saida;
}
/** O suporte de gatilho que ativa esta magia (o nome), ou null: a magia ligada a ele não se conjura à mão. */
export function ativadaPor(estado, acao) {
  return gruposComGatilho(estado).find((g) => g.magias.includes(acao))?.nome ?? null;
}

/** Esta skill (magia/runa) está disponível (a gema dela está encaixada numa peça vestida)? */
export const temSkill = (estado, acao) => skillsAtivas(estado).has(acao);

/**
 * O EFEITO combinado da gema numa skill — o nível (a progressão dela) e as
 * supports ligadas: `{ nivel, danoPct, curaPct, castTimePct, custoPct,
 * recargaPct, critChance, critDano, alvosExtras, danoDosExtrasPct, supports: [nomes] }`.
 * Sem a gema: null. É o que o `disparar` aplica — e o balão mostra.
 */
// (+ os da Blasfêmia, que não escalam com a gema de suporte: a reserva sobreposta, a maldição em aura e o efeito dela.)
const CONTAGENS = new Set(['alvosExtras', 'perfurar', 'bifurcar', 'encadear', 'retornar', 'areaExtra', 'reservaSobreposta', 'maldicaoEmAura', 'efeitoMaldicaoPct']);
const MULTIPLICATIVOS = new Set(['danoDosExtrasPct', 'danoDaPerfuracaoPct', 'danoDaBifurcacaoPct', 'danoDoEncadeamentoPct', 'danoDoRetornoPct']);
export function efeitoNaSkill(estado, acao, ativas = skillsAtivas(estado)) {
  const a = ativas.get(acao);
  if (!a) return null;
  const e = { nivel: a.nivel, danoPct: 0, curaPct: 0, castTimePct: 0, custoPct: 0, recargaPct: 0, critChance: 0, critDano: 0, alvosExtras: 0, danoDosExtrasPct: 0, supports: [] };
  // O NÍVEL da gema é um bônus a mais (o dano/cura base é o da magia, pelo level e o magic level):
  // `progressao` % por nível acima do 1, × a raridade da gema.
  const acima = (a.nivel - 1) * multiplicadorDaRaridade(a.raridade);
  e.danoPct += (a.def.progressao?.dano ?? 0) * acima;
  e.curaPct += (a.def.progressao?.cura ?? 0) * acima;
  // A qualidade: +danoPorPonto% por 1% (separada do nível e da raridade).
  if (a.def.progressao?.dano) e.danoPct += a.qualidade * Q.danoPorPonto;
  if (a.def.progressao?.cura) e.curaPct += a.qualidade * Q.danoPorPonto;
  e.raridade = a.raridade;
  e.qualidade = a.qualidade;
  e.fatorDeDano = a.def.fatorDeDano ?? 1;
  for (const sp of a.supports) {
    const s = sp.def.suporte;
    // O suporte do PoE: os números DO NÍVEL dele (a tabela do poedb) e da qualidade, já prontos — sem a régua de raridade do Draevor.
    const doPoe = s.efeitoDoPoe ? s.efeitoDoPoe(sp.nivel, sp.qualidade, a.def) : null;
    const mult = doPoe ? 1 : multiplicadorDaRaridade(sp.raridade) * (1 + (sp.qualidade * Q.efeitoPorPonto) / 100);
    for (const [k, v] of Object.entries(doPoe ?? s.efeito ?? {})) {
      // CONTAGEM (projéteis, saltos, casas de área) é inteira e não escala; o resto × raridade/qualidade.
      const bruto = doPoe ? v : v + (s.porNivel?.[k] ?? 0) * (sp.nivel - 1);
      // O custo EXTRA de um suporte (positivo) não cresce com a raridade da gema (a rara não custa mais); a economia (negativo) cresce.
      const valor = CONTAGENS.has(k) || (k === 'custoPct' && bruto > 0) ? bruto : MULTIPLICATIVOS.has(k) ? Math.min(100, bruto * mult) : bruto * mult;
      // O % de um golpe SECUNDÁRIO (projéteis extras, perfuração...) se MULTIPLICA entre supports; o resto soma.
      if (MULTIPLICATIVOS.has(k)) e[k] = e[k] ? (e[k] * valor) / 100 : valor;
      // O CUSTO de mana dos suportes se MULTIPLICA (+30% e +20% são ×1,3 × ×1,2 = +56%, e −20% duas vezes são ×0,64), como no PoE.
      else if (k === 'custoPct') e.custoPct = ((1 + e.custoPct / 100) * (1 + valor / 100) - 1) * 100;
      // O "X% mais/menos Dano" dos suportes do PoE MULTIPLICA (como no PoE), por cima do fator da gema.
      else if (k === 'maisDanoPct') e.fatorDeDano *= Math.max(0, 1 + valor / 100);
      // O tempo de uso dos suportes do PoE também multiplica (40% mais velocidade e 20% menos são ×1/1,4 × ×1/0,8).
      else if (k === 'castTimePct' && doPoe) e.castTimePct = ((1 + (e.castTimePct ?? 0) / 100) * (1 + valor / 100) - 1) * 100;
      else e[k] = (e[k] ?? 0) + valor;
    }
    e.supports.push(sp.def.nome);
  }
  // "+N ao Nível das Gemas Suportadas" (Fortalecer, do PoE): o nível que vale (dano, custo, tempos da tabela).
  if (e.nivelExtra) e.nivel += e.nivelExtra;
  // O lado da explosão (a tela mostra "explode 3×3"): o mesmo número que o motor usa.
  if (e.explosaoPct || e.segundaExplosaoPct) e.explosaoLado = CONFIG.golpesSecundarios?.explosao?.lado ?? 3;
  return e;
}

/** O tempo de conjuração (ms) desta skill agora: o da gema × supports ÷ Cast Speed. 0 = instantânea. */
export function tempoDeConjuracao(estado, acao, castSpeedPct = 0, ativas = skillsAtivas(estado)) {
  const a = ativas.get(acao);
  if (!a || !(a.def.castTime > 0)) return 0;
  const e = efeitoNaSkill(estado, acao, ativas);
  return Math.max(0, Math.round((a.def.castTime * (1 + (e.castTimePct ?? 0) / 100)) / (1 + (castSpeedPct ?? 0) / 100)));
}

// ---------------------------------------------------------------- XP

/**
 * A XP de uma morte para TODAS as gemas encaixadas nas peças vestidas: sobe de
 * nível enquanto houver XP, até o `maximo` (sem trava de level — decisão do dono).
 * Devolve `[{ nome, nivel }]` das que subiram (para avisar).
 */
export function ganharXp(estado, exp) {
  const ganho = Math.max(0, Math.round((Number(exp) || 0) * N.parteDaExp));
  if (!ganho) return [];
  const subiram = [];
  for (const slot of SLOTS_COM_SOCKET) {
    const peca = estado?.equipment?.[slot];
    const gemas = peca?.soquetes?.gemas;
    if (!gemas) continue;
    for (const g of gemas) {
      const def = g && DEFS.get(Number(g.id));
      // Por XP a gema para no máximo dela (30 no Draevor, 20 no PoE); acima, só o add de nível das peças.
      const max = maximoDaGema(def);
      if (!def || g.nivel >= max) continue;
      g.xp = (g.xp ?? 0) + ganho;
      while (g.nivel < max && g.xp >= xpDaGema(def, g.nivel, estado.level)) {
        // A gema do PoE só passa de nível quando o personagem tem o level que o próximo nível pede (a XP fica cheia, esperando).
        if ((estado.level ?? 1) < levelDoNivel(def, g.nivel + 1)) break;
        g.xp -= xpDaGema(def, g.nivel, estado.level);
        g.nivel++;
        subiram.push({ nome: def.nome, nivel: g.nivel });
      }
      g.xp = g.nivel >= max ? 0 : Math.min(g.xp, xpDaGema(def, g.nivel, estado.level));
    }
  }
  return subiram;
}

// ---------------------------------------------------------------- encaixar / tirar

const erro = (e) => ({ ok: false, erro: e });

/**
 * Encaixa a gema da MOCHILA (`de`: índice em `estado.inventory`) no socket
 * `indice` da peça vestida em `slot`. Socket fechado recusa; ocupado troca (a
 * que estava volta para a mochila).
 */
export function encaixar(estado, { de, slot, indice }) {
  const peca = estado.equipment?.[slot];
  if (!peca) return erro('Não há peça nesse slot.');
  const s = soquetesDe(peca);
  if (!s) return erro('Essa peça não tem sockets.');
  // Sem `indice` (a gema arrastada até a peça): o primeiro socket aberto e vazio.
  const i = indice == null ? s.gemas.findIndex((g, k) => !g && k < s.abertos && (!s.cores || SocketsPoe.cabe(s.cores[k], corDaGema(estado.inventory?.[Math.floor(Number(de))])))) : Math.floor(Number(indice));
  if (indice == null && i < 0) return erro(s.cores ? 'Essa peça não tem socket livre da cor desta gema.' : 'Essa peça não tem socket livre.');
  if (!(i >= 0 && i < s.max)) return erro('Socket inexistente.');
  if (i >= s.abertos) return erro('Esse socket está bloqueado.');
  const inv = estado.inventory ?? [];
  const k = Math.floor(Number(de));
  const item = inv[k];
  if (!item || !ehGema(item.id)) return erro('Isso não é uma gema.');
  // No PoE: a gema só entra no socket da COR dela (o branco aceita qualquer uma; a gema branca entra em qualquer socket).
  if (s.cores && !SocketsPoe.cabe(s.cores[i], corDaGema(item))) return erro(`A gema ${SocketsPoe.NOME_DA_COR[corDaGema(item)]} precisa de um socket ${SocketsPoe.NOME_DA_COR[corDaGema(item)]} ou branco (este é ${SocketsPoe.NOME_DA_COR[s.cores[i]]}).`);
  const nova = novaGemaDoItem(item);
  inv.splice(k, 1);
  const antiga = s.gemas[i];
  s.gemas[i] = nova;
  gravarSoquetes(peca, s);
  if (antiga) inv.push(itemDaGema(antiga));
  return { ok: true };
}

/** Tira a gema do socket `indice` da peça vestida em `slot`, de volta para a mochila. */
export function tirar(estado, { slot, indice }) {
  const peca = estado.equipment?.[slot];
  const s = peca && soquetesDe(peca);
  if (!s) return erro('Essa peça não tem sockets.');
  const i = Math.floor(Number(indice));
  const g = s.gemas[i];
  if (!g) return erro('Não há gema nesse socket.');
  s.gemas[i] = null;
  gravarSoquetes(peca, s);
  (estado.inventory ??= []).push(itemDaGema(g));
  return { ok: true };
}

/** A gema solta (item) ↔ a gema no socket. */
// A raridade mora na instância: `raridade` no item (é o que pinta o balão e a mochila) e na gema do socket.
export const novaGemaDoItem = (item) => ({
  id: Number(item.id),
  nivel: Math.max(1, Number(item.gema?.nivel) || 1),
  xp: Math.max(0, Number(item.gema?.xp) || 0),
  raridade: raridadeDaGema(item.raridade ?? item.gema?.raridade),
  qualidade: qualidadeDaGema(item.gema?.qualidade),
});
export const itemDaGema = (g) => ({ id: Number(g.id), count: 1, raridade: raridadeDaGema(g.raridade), gema: { nivel: g.nivel, xp: g.xp ?? 0, qualidade: qualidadeDaGema(g.qualidade) } });

/**
 * Usa uma LAPIDADORA da mochila numa gema: `{ de }` (índice da gema na mochila)
 * ou `{ slot, indice }` (a gema num socket da peça vestida). +ganho% (sorteio), até o máximo.
 */
export function lapidar(estado, { de, slot, indice }, rng = Math.random) {
  const inv = (estado.inventory ??= []);
  const k = inv.findIndex((p) => Number(p.id) === LAPIDADORA && (p.count ?? 1) > 0);
  if (k < 0) return erro('Você não tem Lapidadora.');
  let alvo = null;
  if (slot != null) {
    const s = soquetesDe(estado.equipment?.[slot]);
    alvo = s?.gemas[Math.floor(Number(indice))] ?? null;
    if (alvo) alvo.qualidade = qualidadeDaGema(alvo.qualidade);
  } else {
    const item = inv[Math.floor(Number(de))];
    if (item && ehGema(item.id)) alvo = (item.gema ??= { nivel: 1, xp: 0 });
  }
  if (!alvo) return erro('Escolha uma gema.');
  const antes = qualidadeDaGema(alvo.qualidade);
  if (antes >= Q.maximo) return erro(`Essa gema já está com ${Q.maximo}% de qualidade.`);
  const [lo, hi] = Q.lapidadora.ganho;
  alvo.qualidade = qualidadeDaGema(antes + lo + Math.floor(rng() * (hi - lo + 1)));
  if ((inv[k].count ?? 1) > 1) inv[k].count -= 1;
  else inv.splice(inv.indexOf(inv[k]), 1);
  return { ok: true, notice: `A gema foi lapidada: ${antes}% → ${alvo.qualidade}% de qualidade.` };
}

/**
 * Usa uma FUNDIDORA da mochila na peça vestida em `slot`: cada par de sockets
 * abertos vizinhos liga com a `chanceDeLink` da raridade da peça.
 */
export function fundir(estado, { slot }, rng = Math.random) {
  const inv = (estado.inventory ??= []);
  const k = inv.findIndex((p) => Number(p.id) === FUNDIDORA && (p.count ?? 1) > 0);
  if (k < 0) return erro('Você não tem Fundidora.');
  const peca = estado.equipment?.[slot];
  const s = peca && soquetesDe(peca);
  if (!s) return erro('Essa peça não tem sockets.');
  if (s.abertos < 2) return erro('Precisa de pelo menos 2 sockets abertos para ligar.');
  const chance = (CONFIG.sockets.drop[peca.raridade] ?? CONFIG.sockets.drop.comum).chanceDeLink;
  const antes = s.links.filter(Boolean).length;
  const links = s.links.map((_, i) => i + 1 < s.abertos && rng() < chance);
  gravarSoquetes(peca, { ...s, links });
  if ((inv[k].count ?? 1) > 1) inv[k].count -= 1;
  else inv.splice(k, 1);
  return { ok: true, notice: `Links sorteados de novo: ${antes} → ${links.filter(Boolean).length}.` };
}

/** A Fundidora que cai de um bicho (ou null): a chance do ato. */
export function sortearFundidora({ ato = 1, fatorDeChance = 1 } = {}, rng = Math.random) {
  if (SocketsPoe.poeLigado()) return null; // no PoE: a Orbe da Fusão no lugar
  const c = F.chancePorAto;
  return rng() < (c[String(ato)] ?? c['1'] ?? 0) * fatorDeChance ? { id: FUNDIDORA, count: 1 } : null;
}

/** A Lapidadora que cai de um bicho (ou null): a chance do ato. */
export function sortearLapidadora({ ato = 1, fatorDeChance = 1 } = {}, rng = Math.random) {
  const c = Q.lapidadora.chancePorAto;
  return rng() < (c[String(ato)] ?? c['1'] ?? 0) * fatorDeChance ? { id: LAPIDADORA, count: 1 } : null;
}

// ---------------------------------------------------------------- orbes de socket

/** Põe `n` do item empilhável na mochila, em pilhas de até 100 (o mesmo teto de `darItem`; importá-lo daqui fecharia um ciclo de módulos). */
function empilhar(estado, itemId, n) {
  const inv = (estado.inventory ??= []);
  let falta = n;
  for (const pilha of inv) {
    if (falta <= 0) break;
    if (Number(pilha.id) !== itemId || pilha.af?.length || pilha.tier) continue;
    const cabe = Math.min(100 - (pilha.count ?? 1), falta);
    if (cabe > 0) {
      pilha.count = (pilha.count ?? 1) + cabe;
      falta -= cabe;
    }
  }
  while (falta > 0) {
    const c = Math.min(100, falta);
    inv.push({ id: itemId, count: c });
    falta -= c;
  }
}

/**
 * Comprar `count` orbes na loja (a Zuma), em gold: paga do bolso e depois do banco. Atômico: confere
 * o produto, a quantidade e o saldo ANTES de tirar um centavo; só então desconta e entrega, tudo
 * no mesmo passo síncrono (duas compras seguidas conferem o saldo uma depois da outra). O peso que
 * passar da capacidade vai para o depósito (o `aplicar` da sessão, como em toda compra).
 */
function comprarOrbe(estado, orbe, count) {
  if (!orbe.loja?.disponivel) return erro('Ela não vende isso agora.');
  const n = Math.max(1, Math.min(CONFIG.loja.porVez ?? 20, Math.floor(Number(count) || 1)));
  const total = orbe.loja.preco * n;
  if ((estado.gold ?? 0) + (estado.bank ?? 0) < total) return erro('Ouro insuficiente (bolso + banco).');
  const doBolso = Math.min(estado.gold ?? 0, total);
  estado.gold = (estado.gold ?? 0) - doBolso;
  estado.bank = (estado.bank ?? 0) - (total - doBolso);
  empilhar(estado, orbe.itemId, n);
  return { ok: true, notice: `Você comprou ${n}× ${orbe.nomeEn} por ${total.toLocaleString('pt-BR')} gold.` };
}

/*
 * ---- Abrir socket e ligar elo: as DUAS operações dos orbes ----
 *
 * Servidor é a fonte da verdade, e a ordem é sempre a mesma: (1) acha a peça e o orbe, (2) valida
 * TUDO, (3) muda a peça, (4) só então gasta o orbe. Nada é gravado antes de validar, então um erro
 * não deixa a peça pela metade nem gasta o orbe. É síncrono (um comando por vez por sessão): dois
 * cliques seguidos não gastam o mesmo orbe duas vezes.
 *
 * Preservação: as duas só ADICIONAM um socket ou MUDAM um elo — nunca tiram gema nem socket. Os
 * campos extras de `peca.soquetes` (as cores, se um dia houver) seguem como estavam.
 */
const achaOrbe = (estado, itemId) => (estado.inventory ??= []).findIndex((p) => Number(p.id) === itemId && (p.count ?? 1) > 0);
function gastaOrbe(estado, k) {
  const inv = estado.inventory;
  if ((inv[k].count ?? 1) > 1) inv[k].count -= 1;
  else inv.splice(k, 1);
}
/** A peça vestida em `slot` que aceita a operação, com os sockets normalizados; ou `{ erro }`. */
function pecaComSockets(estado, slot) {
  const peca = estado.equipment?.[slot];
  if (!peca) return { erro: 'Não há nada vestido nesse slot.' };
  const max = maximoDeSockets(ITEM_CATALOG[peca.id], peca);
  if (!max) return { erro: 'Esse tipo de peça não tem sockets.' };
  return { peca, max, s: soquetesDe(peca) };
}

/** O ORBE DE ENCAIXE: abre UM socket novo (vazio e sem link) na peça vestida em `slot`. Até o `maximo` do slot. */
export function abrirSocket(estado, { slot }) {
  const { peca, max, s, erro: e } = pecaComSockets(estado, slot);
  if (e) return erro(e);
  if (s.abertos >= max) return erro(`Esta peça já tem o máximo de sockets (${max}). O orbe não foi gasto.`);
  const k = achaOrbe(estado, ORBE_DE_ENCAIXE);
  if (k < 0) return erro('Você não tem Orbe de Encaixe.');
  const links = [...s.links];
  if (s.abertos > 0) links[s.abertos - 1] = false; // o socket novo nasce SEM link com o vizinho
  gravarSoquetes(peca, { ...s, abertos: s.abertos + 1, links });
  gastaOrbe(estado, k);
  return { ok: true, notice: `Socket aberto: agora são ${s.abertos + 1} de ${max}.` };
}

/**
 * O ORBE DE LIGAÇÃO: põe o elo `elo` (entre o socket `elo` e o `elo + 1`) no estado pedido — `ligar:
 * true` liga, `false` desliga. Os dois sockets precisam estar abertos. É o estado DESEJADO, e não
 * "inverter": pedir o que já está não faz nada e não gasta o orbe (um clique duplo não desfaz o que
 * o primeiro fez). Desligar também gasta um orbe (é a operação de remover link).
 */
export function ligarElo(estado, { slot, elo, ligar }) {
  const { peca, s, erro: e } = pecaComSockets(estado, slot);
  if (e) return erro(e);
  const i = Number(elo);
  if (!Number.isInteger(i) || i < 0 || i + 1 >= s.abertos) return erro('Esse elo não existe: os dois sockets precisam estar abertos.');
  if (typeof ligar !== 'boolean') return erro('Diga se é para ligar ou desligar.');
  if (s.links[i] === ligar) return erro(ligar ? 'Esses sockets já estão ligados. O orbe não foi gasto.' : 'Esses sockets já estão sem link. O orbe não foi gasto.');
  const k = achaOrbe(estado, ORBE_DE_LIGACAO);
  if (k < 0) return erro('Você não tem Orbe de Ligação.');
  const links = [...s.links];
  links[i] = ligar;
  gravarSoquetes(peca, { ...s, links });
  gastaOrbe(estado, k);
  const grupos = gruposLigados({ abertos: s.abertos, links }).map((g) => g.map((n) => n + 1).join('+')).join(' | ');
  return { ok: true, notice: `${ligar ? 'Sockets ligados' : 'Link desfeito'}. Grupos agora: ${grupos}.` };
}

/**
 * Usa um ORBE DO PoE (`tipo`: 'joalheiro' | 'fusao' | 'cromatico') na peça vestida em `slot`. Mesma ordem dos orbes do Draevor: valida
 * tudo, muda a peça e só então gasta o orbe. Joalheiro e Cromático pedem a peça SEM gema (nenhuma gema sai sozinha); a Fusão não mexe
 * nas gemas. Recusa sem gastar quando não haveria mudança (peça no máximo de sockets, peça toda ligada).
 */
export function usarOrbeDoPoe(estado, { slot, tipo }, rng = Math.random) {
  if (!SocketsPoe.poeLigado()) return erro('Este orbe é do modo PoE.');
  const o = ORBES_DO_POE[tipo];
  if (!o?.itemId) return erro('Orbe desconhecido.');
  const { peca, max, s, erro: e } = pecaComSockets(estado, slot);
  if (e) return erro(e);
  const k = achaOrbe(estado, o.itemId);
  if (k < 0) return erro(`Você não tem ${o.nome}.`);
  const req = ITEM_CATALOG[peca.id]?.poe?.requisitos ?? null;
  const comGema = s.gemas.some(Boolean);
  const cores = (c, n) => c.slice(0, n).map((x) => SocketsPoe.NOME_DA_COR[x]).join(', ') || 'nenhum';
  let notice;
  if (tipo === 'joalheiro') {
    if (comGema) return erro('Tire as gemas desta peça antes: o Joalheiro refaz os sockets. O orbe não foi gasto.');
    if (s.abertos >= max) return erro(`Esta peça já está no máximo (${max} sockets). O orbe não foi gasto.`);
    // A qualidade da peça melhora o resultado (poedb › Quality): mais sockets e links ficam qualidade% mais prováveis.
    const qualidade = Number(peca.poe?.qualidade) || 0;
    const n = SocketsPoe.sortearNumero(s.abertos, max, rng, qualidade);
    if (n == null) return erro('Não há outro número de sockets para esta peça. O orbe não foi gasto.');
    const chance = Math.min(0.95, Number(SocketsPoe.orbes().joalheiro?.chanceDeLink ?? 0.5) * (1 + qualidade / 100));
    const links = Array.from({ length: max - 1 }, (_, i) => i + 1 < n && rng() < chance);
    gravarSoquetes(peca, { ...s, abertos: n, links, cores: SocketsPoe.sortearCores(max, req, rng) });
    notice = `Sockets: ${s.abertos} → ${n}.`;
  } else if (tipo === 'fusao') {
    if (s.abertos < 2) return erro('Precisa de pelo menos 2 sockets para ligar. O orbe não foi gasto.');
    if (s.links.slice(0, s.abertos - 1).every(Boolean)) return erro('Esta peça já está toda ligada. O orbe não foi gasto.');
    const links = SocketsPoe.sortearLinks(s.abertos, max, rng, Number(peca.poe?.qualidade) || 0);
    gravarSoquetes(peca, { ...s, links });
    notice = `Links sorteados de novo. Grupos agora: ${gruposLigados({ abertos: s.abertos, links }).map((g) => g.map((x) => x + 1).join('+')).join(' | ')}.`;
  } else if (tipo === 'cromatico') {
    if (comGema) return erro('Tire as gemas desta peça antes: o Cromático troca as cores dos sockets. O orbe não foi gasto.');
    if (s.abertos < 1) return erro('Esta peça não tem sockets. O orbe não foi gasto.');
    const novas = SocketsPoe.sortearOutrasCores(s.cores ?? [], s.abertos, req, rng);
    gravarSoquetes(peca, { ...s, cores: novas });
    notice = `Cores: ${cores(s.cores ?? [], s.abertos)} → ${cores(novas, s.abertos)}.`;
  } else return erro('Orbe desconhecido.');
  gastaOrbe(estado, k);
  return { ok: true, notice };
}

/** Os orbes do PoE que caem de um bicho (no modo PoE): cada um com a chance do ato dele. */
export function sortearOrbesDoPoe({ ato = 1, fatorDeChance = 1 } = {}, rng = Math.random) {
  if (!SocketsPoe.poeLigado()) return [];
  return Object.values(ORBES_DO_POE).filter((o) => o?.itemId && rng() < (o.chancePorAto?.[String(ato)] ?? o.chancePorAto?.['1'] ?? 0) * fatorDeChance).map((o) => ({ id: o.itemId, count: 1 }));
}

/** O orbe que cai de um bicho (ou null): `tipo` 'encaixe' | 'ligacao'; a chance do ato (zero até haver balanceamento). */
export function sortearOrbe(tipo, { ato = 1, fatorDeChance = 1 } = {}, rng = Math.random) {
  if (SocketsPoe.poeLigado()) return null; // no PoE: os orbes do PoE no lugar (`sortearOrbesDoPoe`)
  const o = O[tipo];
  const c = o?.drop?.chancePorAto ?? {};
  const chance = (c[String(ato)] ?? c['1'] ?? 0) * fatorDeChance;
  return chance > 0 && rng() < chance ? { id: o.itemId, count: 1 } : null;
}

// ---------------------------------------------------------------- migração

/*
 * ---- As skills que o personagem já usava viram gemas (decisão do dono) ----
 * Uma vez por personagem: cada magia/runa da barra dele vira a gema dela, no
 * nível que o level dele permite, encaixada nos sockets livres das peças
 * vestidas (arma, armadura, escudo, elmo, pernas, bota, anel, amuleto); a que
 * não couber vai para a mochila. As peças já ganharam todos os sockets abertos
 * e ligados (ver `itens/item.mjs`, versão 5).
 */
const ORDEM_DE_ENCAIXE = ['weapon', 'body', 'shield', 'head', 'legs', 'feet', 'ring', 'neck'];
export function migrarPersonagem(estado) {
  const acoes = [...new Set((estado.actions ?? []).map((a) => a?.id).filter((id) => ITEM_DA_ACAO.has(id)))];
  const jaTem = new Set();
  for (const slot of SLOTS_COM_SOCKET) for (const g of estado.equipment?.[slot]?.soquetes?.gemas ?? []) if (g) jaTem.add(Number(g.id));
  for (const it of estado.inventory ?? []) if (ehGema(it.id)) jaTem.add(Number(it.id));
  let criadas = 0;
  for (const acao of acoes) {
    const itemId = ITEM_DA_ACAO.get(acao);
    if (jaTem.has(itemId)) continue;
    // Sempre no nível 1 (decisão do dono) — o nível 1 é o dano de antes das gemas.
    encaixarOndeCouber(estado, novaGema(itemId));
    criadas++;
  }
  return criadas;
}

/** Encaixa a gema no primeiro socket aberto e vazio das peças vestidas (na ordem de `ORDEM_DE_ENCAIXE`); sem lugar, vai para a mochila. */
function encaixarOndeCouber(estado, gema) {
  for (const slot of ORDEM_DE_ENCAIXE) {
    const peca = estado.equipment?.[slot];
    const s = peca && soquetesDe(peca);
    if (!s) continue;
    const livre = s.gemas.findIndex((g, i) => !g && i < s.abertos && (!s.cores || SocketsPoe.cabe(s.cores[i], corDaGema(gema))));
    if (livre < 0) continue;
    s.gemas[livre] = gema;
    gravarSoquetes(peca, s);
    return true;
  }
  (estado.inventory ??= []).push(itemDaGema(gema));
  return false;
}

/**
 * As gemas do personagem NOVO (config `iniciais`, por classe): entregues uma vez,
 * no primeiro login — quando as peças iniciais já têm sockets. Marca: `gemasIniciais`
 * (posta na criação). Devolve quantas deu.
 */
export function darGemasIniciais(estado) {
  if (!estado?.gemasIniciais) return 0;
  delete estado.gemasIniciais;
  let n = 0;
  for (const acao of CONFIG.iniciais?.[estado.vocation] ?? []) {
    const itemId = ITEM_DA_ACAO.get(acao);
    // No PoE as gemas ativas do Draevor não são dadas (as do PoE caem e vêm das missões).
    if (!itemId || !valeNoModo(DEFS.get(itemId))) continue;
    encaixarOndeCouber(estado, novaGema(itemId));
    n++;
  }
  return n;
}

// ---------------------------------------------------------------- vista

/** Os sockets de uma peça para a tela: `{ max, abertos, links, gemas: [{ id, nome, tipo, nivel, xp, xpProximo } | null] }`. */
export function vistaDosSoquetes(peca, level = 1) {
  const s = soquetesDe(peca);
  if (!s) return null;
  return {
    ...s,
    gemas: s.gemas.map((g) => {
      const def = g && DEFS.get(Number(g.id));
      return def ? { id: g.id, nome: def.nome, tipo: def.tipo, nivel: g.nivel, xp: g.xp ?? 0, xpProximo: xpProximoDaGema(def, g.nivel, level), levelDoProximo: levelDoNivel(def, g.nivel + 1), raridade: raridadeDaGema(g.raridade) } : null;
    }),
  };
}

// ---------------------------------------------------------------- drop

/**
 * A gema que cai de um bicho (ou null): a chance do ato (`config.drop`); uma
 * fração vira support. A ativa sai entre as skills que um personagem no
 * gemas do jogo (sem trava de level — a gema cai no nível 1).
 */
export function sortearDrop({ ato = 1, levelDaFase = 1, fatorDeChance = 1, dificuldade = null } = {}, rng = Math.random) {
  const d = CONFIG.drop;
  const chance = (d.chancePorAto[String(ato)] ?? d.chancePorAto['1'] ?? 0) * fatorDeChance;
  if (!(rng() < chance)) return null;
  const supports = [...DEFS.values()].filter((x) => x.tipo === 'support');
  // No PoE: só as gemas do PoE, e só as que o nível da área já dá (o nível exigido da gema até o da fase).
  const ativas = [...DEFS.values()].filter((x) => x.tipo === 'ativa' && valeNoModo(x) && x.levelMinimo <= Math.max(1, levelDaFase));
  const lista = rng() < d.parteSupport && supports.length ? supports : ativas.length ? ativas : supports;
  const def = lista[Math.floor(rng() * lista.length)];
  const [qlo, qhi] = Q.noDrop;
  return def ? itemDaGema(novaGema(def.itemId, sortearRaridade(rng, { ato, dificuldade }), qlo + Math.floor(rng() * (qhi - qlo + 1)))) : null;
}

// ---------------------------------------------------------------- loja (Zuma Magehide)

/** O preço de uma gema na loja: ativa pelo level mínimo da skill; support, o preço fixo — × o fator da raridade. */
export const precoNaLoja = (def, raridade = 'comum') =>
  (def.tipo === 'support' ? CONFIG.loja.precoDoSupport : CONFIG.loja.precoBase + CONFIG.loja.precoPorLevel * (def.levelDaMagia ?? 1)) * (CONFIG.loja.precoPorRaridade?.[raridade] ?? 1);

/** As raridades que a loja vende (decisão do dono, 30/09: todas as gemas, só na comum — as outras caem de bicho). */
export const RARIDADES_DA_LOJA = CONFIG.loja.raridades ?? ['comum'];

/**
 * A lista da loja (o formato do balcão de NPC do cliente — `npcFala`, `tipo: 'loja'`):
 * a gema de cada skill (pelo level) e os supports, no nível 1, em cada raridade da loja.
 * `chave` distingue as linhas do mesmo item (a raridade); `id` é o item (a figura).
 */
export function catalogoDaLoja(estado) {
  const tenho = (id, r) => (estado.inventory ?? []).filter((p) => Number(p.id) === id && raridadeDaGema(p.raridade) === r).length;
  // Pela categoria (Ataque, Cura, Reforço, Suporte), e dentro dela pelo level da magia e o nome.
  const ordem = Object.keys(CATEGORIAS);
  // As do PoE: TODAS (dono, 06/10: "na loja do Zuma não aparecem todas as gemas"), sempre no nível 1.
  const defs = [...DEFS.values()].filter((d) => valeNoModo(d)).sort((a, b) => ordem.indexOf(a.categoria) - ordem.indexOf(b.categoria) || (a.levelDaMagia ?? 0) - (b.levelDaMagia ?? 0) || a.nome.localeCompare(b.nome));
  const gemas = defs.flatMap((def) =>
    RARIDADES_DA_LOJA.map((r) => ({
      id: def.itemId,
      chave: `${def.itemId}:${r}`,
      raridade: r,
      categoria: def.categoria,
      categoriaNome: CATEGORIAS[def.categoria],
      nome: `Gema: ${def.nomePt ?? def.nome} (${r})${def.tipo === 'support' ? ' · suporte' : ''}`,
      buy: precoNaLoja(def, r),
      tenho: tenho(def.itemId, r),
    }))
  );
  // Os orbes de socket, depois das gemas (mesma loja, mesmo balcão).
  return [...gemas, ...linhasDosOrbes(estado)];
}

/** As linhas da loja dos orbes que estão à venda (`orbes.*.loja`). */
/*
 * As MOEDAS DO PoE na loja (`itens-poe/moedas.mjs` registra aqui o que vende — os preços em `regras.json → moedas.loja`): no modo PoE
 * elas substituem a linha dos orbes (o Cromático, o Joalheiro e a Fusão estão entre elas).
 */
let lojaDeMoedas = null;
export const usarLojaDeMoedas = (f) => (lojaDeMoedas = f);
export function linhasDosOrbes(estado) {
  if (SocketsPoe.poeLigado() && lojaDeMoedas) return lojaDeMoedas(estado);
  const tenho = (id) => (estado.inventory ?? []).filter((p) => Number(p.id) === id).reduce((t, p) => t + (p.count ?? 1), 0);
  // No PoE: os orbes do PoE no lugar dos do Draevor.
  return (SocketsPoe.poeLigado() ? Object.values(ORBES_DO_POE).filter((o) => o?.itemId) : [O.encaixe, O.ligacao])
    .filter((o) => o.loja?.disponivel)
    .map((o) => ({
      id: o.itemId,
      chave: `${o.itemId}:orbe`,
      categoria: 'orbes',
      categoriaNome: 'Orbes de socket',
      nome: `${o.nomeEn} (${o.nome})`,
      buy: o.loja.preco,
      tenho: tenho(o.itemId),
    }));
}

/** Comprar `count` gemas (nível 1, na `raridade` pedida) na loja: paga do bolso e depois do banco; vão para a mochila. */
export function comprarNaLoja(estado, { id, count = 1, raridade = 'comum' }) {
  const orbe = (SocketsPoe.poeLigado() ? (lojaDeMoedas ? lojaDeMoedas(estado) : Object.values(ORBES_DO_POE).filter((o) => o?.itemId)) : [O.encaixe, O.ligacao]).find((o) => o.itemId === Number(id));
  if (orbe) return comprarOrbe(estado, orbe, count);
  const def = DEFS.get(Number(id));
  if (!def) return { ok: false, erro: 'Ela não vende isso.' };
  if (!podeEntrar(def.itemId)) return { ok: false, erro: SO_ITENS_DO_POE };
  if (!RARIDADES_DA_LOJA.includes(raridade)) return { ok: false, erro: 'Ela só vende gemas comuns. As de outras raridades caem dos bichos.' };
  const n = Math.max(1, Math.min(CONFIG.loja.porVez ?? 20, Math.floor(Number(count) || 1)));
  const total = precoNaLoja(def, raridade) * n;
  if ((estado.gold ?? 0) + (estado.bank ?? 0) < total) return { ok: false, erro: 'Ouro insuficiente (bolso + banco).' };
  const doBolso = Math.min(estado.gold ?? 0, total);
  estado.gold = (estado.gold ?? 0) - doBolso;
  estado.bank = (estado.bank ?? 0) - (total - doBolso);
  for (let i = 0; i < n; i++) (estado.inventory ??= []).push(itemDaGema(novaGema(def.itemId, raridade)));
  return { ok: true, notice: `Você comprou ${n}× gema de ${def.nome} (${raridade}).` };
}
