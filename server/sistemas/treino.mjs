// Perícias (sword, axe, club, distance, fist, shielding) e magic level
// subindo com o uso — as fórmulas são as REAIS do client
// (`packages/shared/src/formulas.mjs`: `triesForSkill`, `manaForMagicLevel`),
// com as taxas de cada vocação. Antes todas ficavam em 10 para sempre (o valor
// fixo do molde) e o dano físico usava sempre `skill: 10`.
//
// Como no Tibia: cada golpe é 1 tentativa na perícia da arma, cada golpe
// recebido é 1 tentativa de shielding, e o magic level sobe com a MANA gasta.
import * as R from '../nucleo/regras.mjs';

export const PERICIAS = ['fist', 'club', 'sword', 'axe', 'distance', 'shielding', 'fishing'];
const INICIAL = 10;

/** Garante `estado.skills`/`estado.magic` (personagens salvos antes disto não têm). */
export function garantir(estado) {
  estado.skills ??= {};
  for (const k of PERICIAS) estado.skills[k] ??= { value: INICIAL, tries: 0 };
  estado.magic ??= { value: 0, mana: 0 };
}

/** O valor atual de uma perícia (10 se nunca treinou). */
export function valor(estado, pericia) {
  if (pericia === 'magic') return estado.magic?.value ?? 0;
  return estado.skills?.[pericia]?.value ?? INICIAL;
}

/** `n` tentativas numa perícia; sobe quantos níveis couberem. */
export function treinar(estado, pericia, n = 1) {
  if (!PERICIAS.includes(pericia)) return;
  garantir(estado);
  const s = estado.skills[pericia];
  s.tries += n;
  for (let precisa = R.triesForSkill(pericia, s.value, estado.vocation); s.tries >= precisa; precisa = R.triesForSkill(pericia, s.value, estado.vocation)) {
    s.tries -= precisa;
    s.value += 1;
  }
}

/** Mana gasta (magia, runa não, wand/rod sim) conta para o magic level. */
export function gastarMana(estado, mana) {
  if (!(mana > 0)) return;
  garantir(estado);
  const m = estado.magic;
  m.mana += mana;
  for (let precisa = R.manaForMagicLevel(m.value, estado.vocation); m.mana >= precisa; precisa = R.manaForMagicLevel(m.value, estado.vocation)) {
    m.mana -= precisa;
    m.value += 1;
  }
}

/**
 * A régua dos três modos de treino de magic level: no pátio o personagem gasta
 * em magia TODA a mana que regenera (maxMana x 0,006 por segundo, a regen base).
 * O offline rende metade disso e o Exercise cinco vezes — as mesmas proporções
 * das perícias (0,25 / 0,5 / 2,5 tentativas por segundo).
 */
export const manaDoPatioPorSegundo = (estado) => (estado.maxMana ?? 0) * 0.006;

/** No formato do personagem real: `{fist:{value, percent}, ...}` e `{value, percent}` (percent de 0 a 1). */
export function paraCliente(estado) {
  garantir(estado);
  const skills = {};
  for (const k of PERICIAS) {
    const s = estado.skills[k];
    skills[k] = { value: s.value, percent: s.tries / Math.max(1, R.triesForSkill(k, s.value, estado.vocation)) };
  }
  const m = estado.magic;
  return { skills, magic: { value: m.value, percent: m.mana / Math.max(1, R.manaForMagicLevel(m.value, estado.vocation)) } };
}
