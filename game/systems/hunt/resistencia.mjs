// A RESISTÊNCIA do bicho ao tipo de dano — a mesma regra em todo golpe.
//
// Auditoria dos atributos (dono, 29/09): "o cálculo deve ser baseado no tipo
// de dano efetivamente produzido pelo ataque". Todo dano do jogador passa por
// aqui, pelo TIPO (physical, fire, energy, earth, ice, death, holy).
//
// `elements` do bestiário: +20 = resiste 20% (toma 80%), −10 = fraco (toma
// 110%). Na sala de boss a resistência tem teto (`RESISTENCIA_MAXIMA_DE_BOSS`).
//
// Limites e penetração (dono, 02/10): a resistência do bicho passa pelo teto dele (`combate/limites.json`), depois SUBTRAI a
// penetração do atacante naquele tipo (`combate/limites.mjs`) — uma conta só, a mesma do golpe, do charm e do balão.
import * as BuffsDeMob from '../mobs/buffs.mjs';
import { BESTIARY } from './monstros.mjs';
import * as R from '../regras.mjs';
import * as Limites from '../combate/limites.mjs';

/** A resistência (em %) do bicho ao `tipo`, com o teto do boss e o piso da fraqueza (antes do teto de resistência e da penetração). */
export function resistenciaDe(hunt, alvo, tipo) {
  // A do bestiário + a dos modificadores do mob (`resist`, ver `mobs/raridade.mjs`).
  // (+ a que os buffs das mecânicas dão por um tempo: Endurecido — `mobs/buffs.mjs`.)
  // (- a janela de vulnerabilidade de um boss único depois que o escudo dele quebra — `bosses-unicos/boss.mjs`.)
  const vulneravel = alvo?.boss?.vulnerabilidade && (hunt?.clock ?? 0) < alvo.boss.vulnerabilidade.ate ? alvo.boss.vulnerabilidade.pct : 0;
  const r = (BESTIARY[alvo?.key]?.elements?.[tipo] ?? 0) + (alvo?.resist?.[tipo] ?? 0) + BuffsDeMob.resistencia(alvo, hunt?.clock ?? 0, tipo) - vulneravel;
  const comBoss = hunt?.isBoss ? Math.min(R.RESISTENCIA_MAXIMA_DE_BOSS, r) : r;
  // A fraqueza só vai até o piso (`fraquezaMaxima`); o teto de cima fica para `resistenciaEfetivaDe`.
  return Math.max(-Limites.LIMITES.resistenciaDoMob.fraquezaMaxima, comBoss);
}

/**
 * A resistência EFETIVA do bicho a um golpe do atacante (`ficha`): a do bicho, no teto, menos a penetração do atacante naquele tipo.
 * Sem `ficha`, é a resistência do bicho no teto (sem penetração).
 */
export function resistenciaEfetivaDe(hunt, alvo, tipo, ficha = null) {
  return Limites.resistenciaEfetiva(Limites.resistenciaDoMob(resistenciaDe(hunt, alvo, tipo)), Limites.penetracaoDe(ficha?.penetracao, tipo));
}

/** `valor` de dano do `tipo` depois da resistência (e da penetração do atacante, se a `ficha` dele vier). */
export const resistido = (hunt, alvo, tipo, valor, ficha = null) => Math.max(0, Math.round(Limites.danoAposResistencia(valor, resistenciaEfetivaDe(hunt, alvo, tipo, ficha))));
