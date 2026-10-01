// A RESISTÊNCIA do bicho ao tipo de dano — a mesma regra em todo golpe.
//
// Auditoria dos atributos (dono, 29/09): "o cálculo deve ser baseado no tipo
// de dano efetivamente produzido pelo ataque". Antes, só a parte elemental da
// arma, o imbuement e o charm passavam pela resistência do bicho; wand, magia,
// runa, golpe físico e familiar a ignoravam. Agora todo dano do jogador passa
// por aqui, pelo TIPO (physical, fire, energy, earth, ice, death, holy).
//
// `elements` do bestiário: +20 = resiste 20% (toma 80%), −10 = fraco (toma
// 110%). Na sala de boss a resistência tem teto (`RESISTENCIA_MAXIMA_DE_BOSS`).
import { BESTIARY } from './monstros.mjs';
import * as R from '../regras.mjs';

/** A resistência (em %) do bicho ao `tipo`, com o teto do boss. */
export function resistenciaDe(hunt, alvo, tipo) {
  // A do bestiário + a dos modificadores do mob (`resist`, ver `mobs/raridade.mjs`).
  const r = (BESTIARY[alvo?.key]?.elements?.[tipo] ?? 0) + (alvo?.resist?.[tipo] ?? 0);
  return hunt?.isBoss ? Math.min(R.RESISTENCIA_MAXIMA_DE_BOSS, r) : r;
}

/** `valor` de dano do `tipo` depois da resistência do bicho. */
export const resistido = (hunt, alvo, tipo, valor) => R.applyElement(valor, resistenciaDe(hunt, alvo, tipo));
