// Perícias (melee, distance, shielding) e magic level
// subindo com o uso — as fórmulas são as REAIS do client
// (`packages/shared/src/formulas.mjs`: `triesForSkill`, `manaForMagicLevel`),
// com as taxas de cada vocação. Antes todas ficavam em 10 para sempre (o valor
// fixo do molde) e o dano físico usava sempre `skill: 10`.
//
// Como no Tibia: cada golpe é 1 tentativa na perícia da arma, cada golpe
// recebido é 1 tentativa de shielding, e o magic level sobe com a MANA gasta.
import * as R from './regras.mjs';
import { ligado as itensPoeLigado } from './itens-poe/catalogo.mjs';

export const PERICIAS = ['melee', 'distance', 'shielding', 'fishing'];
const INICIAL = 10;

/*
 * Melee é UMA perícia: punho, clava, espada e machado (que eram quatro) treinam
 * o mesmo número. `canonica` traduz qualquer nome antigo — de item, de afixo, de
 * imbuement, de mensagem de cliente — para a perícia de hoje.
 */
const LEGADAS_DO_MELEE = ['fist', 'club', 'sword', 'axe'];
export const canonica = (pericia) => (LEGADAS_DO_MELEE.includes(pericia) ? 'melee' : pericia);

/** Garante `estado.skills`/`estado.magic` (personagens salvos antes disto não têm). */
export function garantir(estado) {
  estado.skills ??= {};
  // Personagem salvo com as quatro perícias antigas: o melee fica com a melhor
  // delas (valor e, no empate, as tentativas) e as antigas somem.
  if (LEGADAS_DO_MELEE.some((k) => estado.skills[k])) {
    let melhor = estado.skills.melee ?? null;
    for (const k of LEGADAS_DO_MELEE) {
      const s = estado.skills[k];
      if (s && (!melhor || s.value > melhor.value || (s.value === melhor.value && s.tries > melhor.tries))) melhor = s;
      delete estado.skills[k];
    }
    estado.skills.melee = { value: melhor?.value ?? INICIAL, tries: melhor?.tries ?? 0 };
  }
  for (const k of PERICIAS) estado.skills[k] ??= { value: INICIAL, tries: 0 };
  estado.magic ??= { value: 0, mana: 0 };
}

/** O valor atual de uma perícia (10 se nunca treinou). */
export function valor(estado, pericia) {
  pericia = canonica(pericia);
  if (pericia === 'magic') return estado.magic?.value ?? 0;
  if (LEGADAS_DO_MELEE.some((k) => estado.skills?.[k])) garantir(estado);
  return estado.skills?.[pericia]?.value ?? INICIAL;
}

/** `n` tentativas numa perícia; sobe quantos níveis couberem. */
export function treinar(estado, pericia, n = 1) {
  // Com o PoE ligado não há perícia (dono, 06/10: "o personagem não vai ter mais skill de treino"): nada sobe.
  if (itensPoeLigado()) return;
  pericia = canonica(pericia);
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
  if (!(mana > 0) || itensPoeLigado()) return;
  garantir(estado);
  const m = estado.magic;
  m.mana += mana;
  for (let precisa = R.manaForMagicLevel(m.value, estado.vocation); m.mana >= precisa; precisa = R.manaForMagicLevel(m.value, estado.vocation)) {
    m.mana -= precisa;
    m.value += 1;
  }
}


/** No formato do personagem real: `{fist:{value, percent}, ...}` e `{value, percent}` (percent de 0 a 1). */
export function paraCliente(estado) {
  garantir(estado);
  const skills = {};
  for (const k of PERICIAS) {
    const s = estado.skills[k];
    const precisa = Math.max(1, R.triesForSkill(k, s.value, estado.vocation));
    // `tries`/`precisa`: as tentativas de agora e as que faltam para o próximo nível (a ficha mostra "x / y"); `percent` segue como era.
    skills[k] = { value: s.value, percent: s.tries / precisa, tries: s.tries, precisa };
  }
  const m = estado.magic;
  const manaPrecisa = Math.max(1, R.manaForMagicLevel(m.value, estado.vocation));
  return { skills, magic: { value: m.value, percent: m.mana / manaPrecisa, mana: m.mana, precisa: manaPrecisa } };
}
