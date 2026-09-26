// A promoção de vocação (Knight → Elite Knight...) — o cartão "Torne-se Elite
// Knight por 20.000 gold" do HUD manda `{t:'promote'}`.
//
// Do original: `character.promotion` = {name, from, level: 20, cost: 20000,
// done, available, missing, hp, mana} (welcomes do Zoros; o molde, level 8:
// missing 12); os multiplicadores de cada vocação vêm do `catalog.vocations`
// capturado em 2026-09-25 (`hello-catalogo-0925.json`). O que ela faz, pelo
// próprio cliente: acelera a regeneração ("vida +50%" no knight) — e, na morte,
// tira mais 30% da perda de experiência (`morte.mjs`).
//
// ESTIMADO: o custo e o level são os do knight capturado para todas as vocações.

import { CATALOGO } from './dados.mjs';

const VOCACOES = Object.fromEntries((CATALOGO.vocations ?? []).map((v) => [v.id, v]));

export const LEVEL_DA_PROMOCAO = 20;
export const CUSTO_DA_PROMOCAO = 20000;

const PROMOCOES = {
  knight: { name: 'Elite Knight', from: 'Knight', hp: 1.5, mana: 1 },
  paladin: { name: 'Royal Paladin', from: 'Paladin', hp: 1.333, mana: 1.333 },
  sorcerer: { name: 'Master Sorcerer', from: 'Sorcerer', hp: 1, mana: 1.5 },
  druid: { name: 'Elder Druid', from: 'Druid', hp: 1, mana: 1.5 },
  monk: { name: 'Exalted Monk', from: 'Monk', hp: 1.4, mana: 1.333 },
};

export const promovido = (estado) => !!estado.promovido;

export function paraCliente(estado) {
  const p = PROMOCOES[estado.vocation];
  if (!p) return null;
  const level = estado.level ?? 1;
  const done = promovido(estado);
  return {
    name: p.name,
    from: p.from,
    level: LEVEL_DA_PROMOCAO,
    cost: CUSTO_DA_PROMOCAO,
    done,
    available: !done && level >= LEVEL_DA_PROMOCAO,
    missing: Math.max(0, LEVEL_DA_PROMOCAO - level),
    hp: p.hp,
    mana: p.mana,
  };
}

export function promover(estado) {
  const p = paraCliente(estado);
  if (!p) return { ok: false, erro: 'Esta vocação não tem promoção.' };
  if (p.done) return { ok: false, erro: 'Você já foi promovido.' };
  if (!p.available) return { ok: false, erro: `A promoção abre no level ${LEVEL_DA_PROMOCAO}.` };
  if ((estado.gold ?? 0) < p.cost) return { ok: false, erro: `Faltam ${p.cost - (estado.gold ?? 0)} gold.` };
  estado.gold -= p.cost;
  estado.promovido = true;
  return { ok: true, notice: `Agora você é ${p.name}.` };
}

/**
 * Os campos da promoção no `derived`, como o original manda (Zoros promovido:
 * vocationName "Elite Knight", promoted true, hpRegen 9 = 6 × 1,5, e `regen` =
 * a promoção × a "Regeneração" da árvore — 1,5 × 1,1129 = 1,6694).
 */
export function derivados(estado, daArvore = { hp: 0, mana: 0 }) {
  const voc = VOCACOES[estado.vocation];
  const f = fatorDeRegeneracao(estado);
  return {
    vocationName: nomeDaClasse(estado),
    promoted: promovido(estado),
    hpRegen: Math.round((voc?.hpRegen ?? 6) * f.hp),
    manaRegen: Math.round((voc?.manaRegen ?? 6) * f.mana),
    regen: { hp: f.hp * (1 + (daArvore?.hp ?? 0)), mana: f.mana * (1 + (daArvore?.mana ?? 0)) },
  };
}

/** O nome de exibição da classe: "Elite Knight" depois da promoção, "Knight" antes. */
export function nomeDaClasse(estado) {
  const p = promovido(estado) && PROMOCOES[estado.vocation];
  return p ? p.name : VOCACOES[estado.vocation]?.name ?? 'Sem vocação';
}

/** O quanto a regeneração acelera: {hp, mana} (1 sem promoção). */
export function fatorDeRegeneracao(estado) {
  const p = promovido(estado) && PROMOCOES[estado.vocation];
  return p ? { hp: p.hp, mana: p.mana } : { hp: 1, mana: 1 };
}
