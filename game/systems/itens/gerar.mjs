// A geração de um item — o ÚNICO lugar com sorte de item no jogo.
//
//   DROP -> item base -> raridade -> quantos atributos -> quais (do pool do
//   equipamento, sem repetir) -> o nível de cada um -> o valor dentro da faixa
//   do nível -> o efeito especial (Lendário) ou supremo (Mítico) -> item final.
//
// Cada passo lê a tabela da configuração (`config.mjs`, gamedata/itens/*.json).
// O contexto diz de onde o drop veio: ato e dificuldade (enquanto não existem
// no jogo, o ato sai do level da hunt), se foi de boss, e o sorteio (`rng`,
// para os testes e a simulação serem reproduzíveis). Nada aqui toca banco,
// rede, Redis ou o estado do personagem — é uma função pura sobre o contexto,
// e roda igual online, na simulação offline e no worker.
//
// A raridade do MONSTRO (Normal/Champion/Elite/Boss) é outra coisa, e ainda
// não existe: quando existir, entra no contexto como variável própria.
import { ITEM_CATALOG } from '../dados.mjs';
import * as C from './config.mjs';
import * as Atributos from '../personagem/atributos.mjs';
import * as Gemas from '../skills/gemas.mjs';
import * as Progressao from '../progressao.mjs';

/**
 * O TIPO do item, que escolhe o pool de adds (`pools.json`): arma corpo a
 * corpo, de distância (arco, besta, arremesso) ou mágica (wand/rod); munição;
 * escudo, spellbook (livro) ou aljava; armadura (elmo, peitoral, calça), bota;
 * anel, amuleto. `null`: não recebe add (mochila, item que não se veste).
 */
export function tipoDoItem(meta) {
  if (!meta?.slot || meta.stackable) return null;
  switch (meta.slot) {
    case 'weapon':
      return meta.wand || meta.skill === 'magic' ? 'arma_magica' : meta.skill === 'distance' ? 'arma_distancia' : 'arma_melee';
    case 'ammo':
      return 'municao';
    case 'shield':
      return meta.quiver ? 'aljava' : meta.type === 'spellbooks' ? 'livro' : 'escudo';
    case 'head':
    case 'body':
    case 'legs':
      return 'armadura';
    case 'feet':
      return 'bota';
    case 'ring':
      return 'anel';
    case 'neck':
      return 'amuleto';
    default:
      return null;
  }
}

/** O item-base recebe atributos? (equipável, não empilha, de um tipo com pool) */
export function aceitaAtributos(id) {
  const tipo = tipoDoItem(ITEM_CATALOG[id]);
  return !!tipo && (C.POOLS[tipo]?.length ?? 0) > 0;
}

/*
 * Os adds de DEFESA da base só saem se a base da peça tiver aquele tipo (anel
 * e amuleto: livres). Armour = o campo `armor` da base.
 */
const DEFESA_DO_ADD = { armor_flat: 'armor', armour_pct: 'armor', evasion: 'evasion', evasion_pct: 'evasion', energy_shield: 'es', es_pct: 'es' };

/**
 * O pool DESTE item, para ESTA peça: o do tipo dele, sem os adds que não caem
 * (`dropa: false`), os de Item Level mínimo acima do da peça, os que a
 * raridade não permite e — fora anel/amuleto — os de defesa que a base não tem.
 * `ctx`: `{ itemLevel, raridade, base }` (sem ctx, o pool inteiro do tipo).
 */
export function poolDe(itemId, ctx = null) {
  const meta = ITEM_CATALOG[itemId];
  const tipo = tipoDoItem(meta);
  const lista = [...new Set(C.POOLS[tipo] ?? [])];
  if (!ctx) return lista;
  const livre = tipo === 'anel' || tipo === 'amuleto';
  return lista.filter((id) => {
    const a = C.ATRIBUTOS[id];
    if (!a || a.dropa === false) return false;
    if ((a.nivelMinimo ?? 1) > (ctx.itemLevel ?? 1)) return false;
    if (ctx.raridade && a.raridades && !a.raridades.includes(ctx.raridade)) return false;
    const precisa = DEFESA_DO_ADD[id];
    if (precisa && !livre && !(ctx.base?.[precisa]?.[1] > 0)) return false;
    return true;
  });
}

/** Sorteia `quantos` adds do pool, SEM repetir, pelo `peso` de cada um. */
export function sortearAdds(pool, quantos, rng = Math.random) {
  const restantes = [...pool];
  const escolhidos = [];
  for (let i = 0; i < quantos && restantes.length; i++) {
    const pesos = restantes.map((id) => C.ATRIBUTOS[id]?.peso ?? 1);
    let r = rng() * pesos.reduce((a, b) => a + b, 0);
    let k = pesos.findIndex((p) => (r -= p) < 0);
    if (k < 0) k = restantes.length - 1;
    escolhidos.push(restantes.splice(k, 1)[0]);
  }
  return escolhidos;
}

/** Sorteia uma chave de `{chave: peso}` (pesos em %, ou qualquer escala). */
export function sortearChave(tabela, rng = Math.random) {
  const entradas = Object.entries(tabela);
  const total = entradas.reduce((a, [, p]) => a + Number(p), 0);
  let r = rng() * total;
  for (const [chave, p] of entradas) if ((r -= Number(p)) < 0) return chave;
  return entradas.at(-1)[0];
}

/** Sorteia o NÍVEL (1..5) pela tabela [p1..p5]. */
export function sortearNivel(tabela, rng = Math.random) {
  const total = tabela.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < tabela.length; i++) if ((r -= tabela[i]) < 0) return i + 1;
  return tabela.length;
}

/** Arredonda no formato do atributo: número inteiro, ou % com duas casas. */
export const arredondar = (id, v) => (C.ATRIBUTOS[id]?.tipo === 'flat' ? Math.round(v) : Math.round(v * 100) / 100);

/** Um valor dentro da faixa do nível, na posição `pos` (0 = mínimo, 1 = máximo). */
export function valorNaFaixa(id, nivel, pos) {
  const [lo, hi] = C.ATRIBUTOS[id].niveis[String(nivel)];
  return arredondar(id, lo + Math.min(1, Math.max(0, pos)) * (hi - lo));
}

/** O nível de um valor já pronto: o mais alto cuja faixa começa abaixo dele. */
export function nivelDoValor(id, valor) {
  const niveis = C.ATRIBUTOS[id]?.niveis;
  if (!niveis) return 1;
  let nivel = 1;
  for (let n = 1; n <= C.NIVEL_MAXIMO; n++) if (valor >= niveis[String(n)][0]) nivel = n;
  return nivel;
}

/**
 * Os números do item-base que cada peça sorteia na faixa da raridade (ver
 * `rolarBase`): dano (`attack`), bloqueio do escudo (`defense`) e as três
 * defesas — Armour (`armor`), Evasion (`evasion`) e Energy Shield (`es`).
 * `marmor` (a armadura mágica de antes) só existe nas peças antigas: a
 * migração v4 a converte em Energy Shield.
 */
export const CAMPOS_DA_BASE = ['attack', 'defense', 'armor', 'evasion', 'es', 'marmor'];

/** Slots de joia: anel e amuleto quase nunca têm armadura no catálogo, mas também sorteiam a armadura física/mágica. */
export const SLOTS_DE_JOIA = new Set(['ring', 'neck']);

/** O valor-base de armadura da peça: o do catálogo, ou — anel/amuleto sem ele — `nível mínimo / 12` (mínimo 2). */
export function armaduraBase(meta) {
  const doCatalogo = Number(meta?.armor);
  if (doCatalogo > 0) return doCatalogo;
  return SLOTS_DE_JOIA.has(meta?.slot) ? Math.max(2, Math.round((meta.minLevel ?? 1) / 12)) : 0;
}

/** O valor-base de ataque de um anel/amuleto (o catálogo não tem): `nível mínimo / 6`, mínimo 2. */
export const ataqueBaseDaJoia = (meta) => Math.max(2, Math.round((meta?.minLevel ?? 1) / 6));

/** Peça com as duas armaduras: cada tipo fica com esta fração do valor sorteado. */
export const FATOR_DAS_DUAS = 0.75;

/**
 * A FAIXA desta peça: para cada número do catálogo (ataque, defesa, armadura),
 * `[piso, teto]` em inteiros. O piso sai da faixa `piso` da raridade e o teto
 * da faixa `teto` (`raridades.json`, `base`, em % do valor do catálogo) — e o
 * maior piso possível é o menor teto possível, então o teto NUNCA fica abaixo
 * do piso. Ataque 20: Comum 2–16 / 16–20 (nunca passa de 20), Épico 17–22 /
 * 22–27. Cada golpe sorteia dentro da faixa (`ataqueDoGolpe`, em ficha.mjs).
 * Devolve `{}` se o item não tem nenhum desses números.
 */
export function rolarBase(itemId, raridade, rng = Math.random, itemLevel = null) {
  const meta = ITEM_CATALOG[itemId];
  const faixa = C.RARIDADES.raridades[raridade]?.base ?? { piso: [1, 1], teto: [1, 1] };
  const sortear = ([lo, hi]) => lo + rng() * (hi - lo);
  const base = {};
  // Anel/amuleto: a peça pode vir sem nada, só com armadura, só com ataque ou com os dois (`joia` da raridade).
  const joia = SLOTS_DE_JOIA.has(meta?.slot);
  const conteudo = joia ? sortearChave(C.RARIDADES.raridades[raridade]?.joia ?? { armadura: 1 }, rng) : null;
  const querArmadura = !joia || conteudo === 'armadura' || conteudo === 'ambos';
  const querAtaque = joia && (conteudo === 'ataque' || conteudo === 'ambos');
  for (const campo of ['attack', 'defense', 'armor']) {
    const valor = campo === 'armor' ? (querArmadura ? armaduraBase(meta) : 0) : joia ? (campo === 'attack' && querAtaque ? ataqueBaseDaJoia(meta) : 0) : Number(meta?.[campo]);
    if (!(valor > 0)) continue;
    const piso = Math.max(1, Math.round(valor * sortear(faixa.piso)));
    const teto = Math.max(piso, Math.round(valor * sortear(faixa.teto)));
    base[campo] = [piso, teto];
  }
  // Joia que veio sem armadura mas TEM no catálogo: zera (senão a peça voltaria ao valor cheio dele).
  if (joia && !querArmadura && Number(meta?.armor) > 0) base.armor = [0, 0];
  /*
   * ---- O TIPO da base de defesa: Armour, Evasion, Energy Shield ou híbrida ----
   * Pela vocação da peça (e o peso, na de todas as vocações) — decisão do dono
   * (`Atributos.tiposDaBase`). A faixa sorteada da armadura do catálogo vira o
   * valor de cada tipo: Armour igual, Evasion e Energy Shield pelo Item Level.
   * Anel/amuleto com armadura: Armour.
   */
  if (base.armor?.[1] > 0) {
    const tipos = joia ? ['armour'] : Atributos.tiposDaBase(meta);
    const il = itemLevel ?? meta?.minLevel ?? 1;
    const [piso, teto] = base.armor;
    const dePiso = Atributos.valoresDaBase(tipos, piso, il);
    const deTeto = Atributos.valoresDaBase(tipos, teto, il);
    const faixa = (k) => [Math.max(1, Math.round(dePiso[k])), Math.max(1, Math.round(deTeto[k]))];
    base.armor = dePiso.armour != null ? faixa('armour') : [0, 0];
    if (dePiso.evasion != null) base.evasion = faixa('evasion');
    if (dePiso.es != null) base.es = faixa('es');
  }
  return base;
}

/** O ato e a dificuldade de onde o drop saiu (o boss usa a dificuldade de cima). */
export function origemDoDrop(ctx = {}) {
  const ato = String(ctx.ato ?? C.atoDoLevel(ctx.level));
  let dificuldade = ctx.dificuldade ?? C.RARIDADES.dificuldadePadrao;
  if (ctx.boss) dificuldade = C.dificuldadeAcima(dificuldade, C.RARIDADES.boss?.dificuldadeAMais ?? 0);
  return { ato, dificuldade };
}

/**
 * O ITEM LEVEL de um drop: o que o contexto traz (o level alvo da fase onde
 * caiu — `contextoDoDrop` na caçada); sem ele, o level do ato/hunt; o boss do
 * ato dá `bonusDoBoss` a mais (decisão do dono).
 */
export function itemLevelDoDrop(ctx = {}) {
  const base = Math.max(1, Math.round(ctx.itemLevel ?? ctx.level ?? ITEM_CATALOG[ctx.itemId]?.minLevel ?? 1));
  return ctx.boss ? Math.round(base * (1 + (C.TIERS.bonusDoBoss ?? 0))) : base;
}

/**
 * Gera o item de um drop. `ctx`: `{ itemId, itemLevel?, level?, ato?,
 * dificuldade?, boss?, raridadeDoMob?, raridade? (forçar), origem? ('boss' | 'bau' | 'guardiao': a raridade mínima), rng? }`.
 *
 *   DROP → item base → raridade (ato × dificuldade) → Item Level → base
 *   (dano/defesa, em faixa) → quantos adds (raridade) → quais (pool do tipo do
 *   item, pelo PESO) → o TIER de cada um (Item Level + viés da raridade) → o
 *   valor dentro da faixa do tier → o poder (Lendário: chance; Mítico: sempre)
 *
 * Devolve a peça: `{ id, count: 1 }` (simples), ou `{ id, count: 1, raridade,
 * ilvl, base?, af: [{ id, nivel, value }], efeito? }` — `nivel` é o TIER (1–5).
 */
export function gerarItem(ctx) {
  const rng = ctx.rng ?? Math.random;
  const simples = { id: ctx.itemId, count: 1 };
  if (!aceitaAtributos(ctx.itemId)) return simples;
  const meta = ITEM_CATALOG[ctx.itemId];
  const { ato, dificuldade } = origemDoDrop(ctx);
  // A raridade do mob inclina a QUALIDADE (o boss de Ato conta como `boss`); sem ela, a tabela do estágio (mob normal).
  // A DIFICULDADE do conteúdo (não a do degrau do boss) decide o `loot` configurado: pesos de raridade, chance de +1 modificador, pesos e teto dos tiers (`progressao.mjs`; neutro por padrão).
  const loot = ctx.lootConfig ?? Progressao.lootDa(ctx.dificuldade ?? C.RARIDADES.dificuldadePadrao);
  let raridade = ctx.raridade ?? sortearChave(Progressao.aplicarPesosDeRaridade(C.inclinarTabela(C.RARIDADES.chances[ato][dificuldade], ctx.boss ? 'boss' : ctx.raridadeDoMob), loot.pesosDeRaridade), rng);
  // A origem do drop (boss, baú, guardião) tem uma raridade MÍNIMA: sobe a que saiu abaixo dela (nunca baixa nem muda uma raridade forçada).
  const minima = ctx.raridade ? null : C.raridadeMinimaDe(ctx.origem);
  if (minima && C.ORDEM.indexOf(raridade) < C.ORDEM.indexOf(minima)) raridade = minima;
  const def = C.RARIDADES.raridades[raridade];
  const itemLevel = itemLevelDoDrop(ctx);

  const base = rolarBase(ctx.itemId, raridade, rng, itemLevel);
  const pool = poolDe(ctx.itemId, { itemLevel, raridade, base });
  let quantos = Math.min(pool.length, Number(sortearChave(def.atributos, rng)));
  // Chance de +1 modificador (só quando configurada: sem ela o sorteio não gasta uma chamada do rng, e as sementes antigas seguem iguais). Teto: o máximo da raridade + 1.
  if (loot.chanceDeModificadorExtra > 0 && rng() < loot.chanceDeModificadorExtra) quantos = Math.min(pool.length, quantos + 1, Math.max(...Object.keys(def.atributos).map(Number)) + 1);
  const amuleto = meta?.slot === 'neck';
  const af = sortearAdds(pool, quantos, rng).map((id) => {
    const nivel = C.sortearTier(itemLevel, raridade, rng, { amuleto, pesos: loot.pesosDeTier, maximo: loot.tierMaximo });
    // Add cujo valor é da RARIDADE da peça e não do tier (o +N ao nível das gemas).
    const fixo = C.ATRIBUTOS[id]?.valorPorRaridade?.[raridade];
    if (fixo != null) return { id, nivel, value: fixo };
    return { id, nivel, value: valorNaFaixa(id, nivel, rng()) };
  });

  // O poder é separado dos adds: Lendário com chance (`chanceDoEfeito`), Mítico sempre.
  const tipo = def.efeito;
  const chance = def.chanceDoEfeito ?? 1;
  const efeito = tipo && C.EFEITOS[tipo] && rng() < chance ? { tipo, id: sortearChave(Object.fromEntries(Object.keys(C.EFEITOS[tipo]).filter((k) => !k.startsWith('_')).map((k) => [k, 1])), rng) } : null;

  const temBase = Object.keys(base).length > 0;
  // Os sockets (e links) da peça: sorteados pela raridade, até o máximo do slot — não contam como mod.
  const soquetes = Gemas.sortearSoquetes(meta, raridade, rng);
  if (!af.length && !efeito && raridade === 'comum' && !temBase && !soquetes?.abertos) return simples;
  return { ...simples, raridade, ilvl: itemLevel, ...(temBase ? { base } : {}), af, ...(efeito ? { efeito } : {}), ...(soquetes ? { soquetes } : {}) };
}
