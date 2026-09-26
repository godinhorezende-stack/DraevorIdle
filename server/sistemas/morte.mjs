// A conta da morte — quanto de experiência e de ouro ela custa — e as
// blessings, que é o que diminui a parte da experiência.
//
// Do original (`blessings` capturado de dois personagens: Zotod, level 89, e o
// da conta2, level 343 — `api-mapeada/servidor/{,conta2/}blessings.json`), e o
// texto do próprio cliente ("é a conta do crystalserver"):
// - Perda cheia: a curva do Tibia, (L+50)/100 × 50 × (L² − 5L + 8)
//   (520.138 no 89, 22.782.603 no 343 — os dois exatos).
// - Teto: 80% de um level (306.320 e 4.664.960, exatos), antes das bênçãos.
// - Desconto: 8% por bênção e mais 30% com a promoção, sobre o que o teto
//   deixou (4.664.960 × 70% = 3.265.472, exato). Morrer queima todas.
// - Ouro: 20% do que está CARREGADO (`Banqueiro.cobrarMorte`); o banco não.
// - Preço de cada bênção: 2.000 até o level 30, depois 200 × (L − 20) com teto
//   de 20.000 (13.800 no 89, 20.000 no 343); as aprimoradas custam o dobro.
//
// ESTIMADO: `itemChance` (a conta de item do Tibia) — o jogo não tira item na
// morte, e a view só mostrou o valor sem bênção (1).
import { CATALOGO } from '../nucleo/dados.mjs';
import * as R from '../nucleo/regras.mjs';
import { FRACAO_DO_OURO_NA_MORTE, cobrarMorte } from './banqueiro.mjs';
import * as Promocao from './promocao.mjs';

export const BLESSINGS = CATALOGO.blessings;
export const DESCONTO_POR_BLESSING = 8;
export const DESCONTO_DA_PROMOCAO = 30;
export const TETO_EM_LEVELS = 0.8;

const minhas = (estado) => (estado.blessings ?? []).filter((id) => BLESSINGS.some((b) => b.id === id));

export function precoDaBlessing(level, tipo) {
  const regular = level <= 30 ? 2000 : Math.min(20000, 200 * (level - 20));
  return tipo === 'enhanced' ? regular * 2 : regular;
}

/** A conta da morte AGORA, no formato do `resumo` do original. */
export function conta(estado) {
  const L = estado.level ?? 1;
  const umLevel = R.expForLevel(L + 1) - R.expForLevel(L);
  const expCheia = Math.round(((L + 50) / 100) * 50 * (L * L - 5 * L + 8));
  const teto = Math.round(umLevel * TETO_EM_LEVELS);
  const base = Math.min(expCheia, teto);
  const blessings = minhas(estado).length;
  const promocao = Promocao.promovido(estado);
  const descontoPercent = Math.min(100, blessings * DESCONTO_POR_BLESSING + (promocao ? DESCONTO_DA_PROMOCAO : 0));
  const expPerdida = Math.min(estado.xp ?? 0, Math.round(base * (1 - descontoPercent / 100)));
  return {
    expPerdida,
    expCheia,
    descontoPercent,
    teto,
    aparadoPeloTeto: expCheia > teto,
    emLevels: Math.round((expPerdida / umLevel) * 100) / 100,
    blessingsLost: blessings,
    promocao,
    ouroFracao: FRACAO_DO_OURO_NA_MORTE,
    itemChance: blessings ? 0 : 1,
    umLevel,
  };
}

/** `{t:'blessings'}`: a lista com preço e dono, o ouro e a conta da morte. */
export function vista(estado) {
  const tenho = new Set(minhas(estado));
  return {
    t: 'blessings',
    list: BLESSINGS.map((b) => ({ ...b, price: precoDaBlessing(estado.level ?? 1, b.type), owned: tenho.has(b.id) })),
    gold: estado.gold ?? 0,
    resumo: conta(estado),
  };
}

/** `{t:'bless', id}` compra uma; `{t:'bless', all:true}` as que faltam. */
export function comprar(estado, m) {
  const tenho = new Set(minhas(estado));
  const alvo = m.all ? BLESSINGS.filter((b) => !tenho.has(b.id)) : BLESSINGS.filter((b) => b.id === Number(m.id));
  if (!alvo.length) return { ok: false, erro: m.all ? 'Você já tem todas as bênçãos.' : 'Bênção desconhecida.' };
  if (!m.all && tenho.has(alvo[0].id)) return { ok: false, erro: 'Você já tem essa bênção.' };
  const preco = alvo.reduce((s, b) => s + precoDaBlessing(estado.level ?? 1, b.type), 0);
  if ((estado.gold ?? 0) < preco) return { ok: false, erro: `Faltam ${preco - (estado.gold ?? 0)} gold.` };
  estado.gold -= preco;
  estado.blessings = [...tenho, ...alvo.map((b) => b.id)];
  return { ok: true };
}

/**
 * Morreu: tira a experiência (podendo cair de level), 20% do ouro carregado e
 * queima as bênçãos. `descerDeLevel` refaz vida e mana do level novo (fica em
 * `hunt/combate.mjs`, ao lado do `subirDeLevel`). Devolve os campos do `death`.
 */
export function morrer(estado, descerDeLevel) {
  const c = conta(estado);
  const levelAntes = estado.level ?? 1;
  estado.xp = Math.max(0, (estado.xp ?? 0) - c.expPerdida);
  descerDeLevel(estado);
  const goldLost = cobrarMorte(estado);
  estado.blessings = [];
  return {
    lost: c.expPerdida,
    goldLost,
    levelPerdido: Math.max(0, levelAntes - (estado.level ?? levelAntes)),
    expCheia: c.expCheia,
    expSemProtecao: Math.min(c.expCheia, c.teto),
    teto: c.teto,
    aparadoPeloTeto: c.aparadoPeloTeto,
    descontoPercent: c.descontoPercent,
    blessings: c.blessingsLost,
    promocao: c.promocao,
  };
}
