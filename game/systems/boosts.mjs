// Boosts de experiência — o "XP Boost — 1 hora" da Store e as Exp
// Potions (50% e 75%) — no formato que o client lê (`character.efeitos.exp.fontes`:
// `[{fonte, percent, restante}]`, a janelinha com o relógio no topo e a linha na
// ficha). `fonte` é o id que o client conhece: 'loja', 'pocao-50', 'pocao-75'.
//
// O tempo corre só CAÇANDO ("+50% de experiência por uma hora de caçada", o
// texto da loja real): `consumir` é chamado pelo tique da hunt, e a caçada
// offline também gasta. Comprar/usar de novo SOMA mais tempo na mesma fonte.
import * as R from './regras.mjs';
import * as Stamina from './stamina.mjs';
import * as BuffPower from './buffpower.mjs';
import * as Afixos from './afixos.mjs';

export const POCOES_DE_EXP = { 55343: { fonte: 'pocao-50', percent: 50 }, 55345: { fonte: 'pocao-75', percent: 75 } };
const UMA_HORA = 3_600_000;

export function garantir(estado) {
  estado.boostsExp ??= [];
  return estado.boostsExp;
}

/** Liga (ou estende) uma fonte de exp. */
export function adicionar(estado, fonte, percent, ms = UMA_HORA) {
  const lista = garantir(estado);
  const ja = lista.find((b) => b.fonte === fonte);
  if (ja) ja.restante += ms;
  else lista.push({ fonte, percent, restante: ms });
}

/** Gasta `ms` de caçada de cada fonte ligada. */
export function consumir(estado, ms) {
  if (!(ms > 0) || !estado.boostsExp?.length) return;
  for (const b of estado.boostsExp) b.restante = Math.max(0, b.restante - ms);
  estado.boostsExp = estado.boostsExp.filter((b) => b.restante > 0);
}

/**
 * A exp que um bicho dá AGORA. Conferido com o dado real: o Troll (20 de exp no
 * bestiary) deu 26 para o Zotod, level 90 e sem boost — 20 x (1 + 28%), o
 * `levelBonus(90)`. As fontes somam entre si (o texto do client), e premium é +10%
 * (a linha "Premium" da ficha).
 */
export function expDoBicho(estado, base) {
  const boosts = garantir(estado).reduce((a, b) => a + b.percent, 0) + (BuffPower.fonteDeExp(estado)?.percent ?? 0) + Afixos.de(estado, 'exp_bonus');
  const premium = (estado.premiumAte ?? 0) > Date.now() ? 10 : 0;
  // A stamina não soma: MULTIPLICA o resultado (x1,5 / x1 / x0,5).
  return Math.round(base * (1 + (R.levelBonus(estado.level ?? 1) + boosts + premium) / 100) * Stamina.fatorDeExp(estado));
}

export function paraCliente(estado) {
  const buff = BuffPower.fonteDeExp(estado); // o Buff Power Exp é a fonte 'buff-power'
  return { fontes: [...garantir(estado).map((b) => ({ ...b })), ...(buff ? [buff] : [])] };
}
