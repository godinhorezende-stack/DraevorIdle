// Os LIMITES do combate e a conta ÚNICA da resistência com penetração (decisão do dono, 02/10).
//
// Config em `gamedata/combate/limites.json`. Aqui só a conta, pura, sem sorteio nem estado de caçada: o golpe do jogador, o charm, o
// golpe do mob no jogador, o duelo e a ficha passam todos por estas funções — assim o teto e a penetração valem igual em todo lugar.
import { readFileSync } from 'node:fs';

export const LIMITES = JSON.parse(readFileSync(new URL('../../gamedata/combate/limites.json', import.meta.url), 'utf8'));

/** O elemento a que a penetração específica pertence: a elemental global vale em todos menos no físico. */
export const ELEMENTOS_DE_PENETRACAO = ['fire', 'ice', 'earth', 'energy', 'death', 'holy'];

/** `valor` entre 0 e `maximo` (a % que nunca passa do limite). */
export const limitar = (valor, maximo = 100) => Math.max(0, Math.min(maximo, Number(valor) || 0));

/** A resistência de um BICHO depois dos tetos: no máximo `resistenciaDoMob.maximo`, e a fraqueza só até −`fraquezaMaxima`. */
export function resistenciaDoMob(resistencia) {
  const r = Number(resistencia) || 0;
  return Math.max(-LIMITES.resistenciaDoMob.fraquezaMaxima, Math.min(LIMITES.resistenciaDoMob.maximo, r));
}

/** A resistência de um JOGADOR (a proteção do elemento): de 0 ao máximo. */
export const resistenciaDoJogador = (protecao) => limitar(protecao, LIMITES.resistenciaDoJogador.maximo);

/**
 * A penetração do atacante num tipo de dano: a física só no `physical`; a elemental é a global + a específica do elemento
 * (`{ fisica, elemental, porElemento }`, a que a ficha monta), nunca mais que o máximo — e nunca de um elemento em outro.
 */
export function penetracaoDe(penetracao, tipo) {
  if (!penetracao) return 0;
  const max = LIMITES.penetracao.maximo;
  if (tipo === 'physical') return limitar(penetracao.fisica, max);
  // (Penetração NEGATIVA do PoE — "Seus Acertos Lidam com a Resistência a Gelo como se fossem X% maiores" — aumenta a resistência efetiva.)
  const doElemento = Number(penetracao.porElemento?.[tipo]) || 0;
  if (doElemento < 0) return limitar(penetracao.elemental, max) + doElemento;
  return limitar(limitar(penetracao.elemental, max) + limitar(doElemento, max), max);
}

/** A resistência EFETIVA: a do alvo menos a penetração. A fraqueza (≤ 0) não muda; o resultado nunca passa de 100. */
export function resistenciaEfetiva(resistencia, penetracao = 0) {
  const r = Number(resistencia) || 0;
  // Penetração negativa (PoE: "como se fosse X% maior"): a resistência sobe.
  if (penetracao < 0) return Math.min(100, r - penetracao);
  if (r <= 0) return r;
  return Math.min(100, Math.max(0, r - limitar(penetracao, LIMITES.penetracao.maximo)));
}

/** O dano depois da resistência efetiva (sem arredondar: quem chama arredonda UMA vez). 100% = nada passa. */
export const danoAposResistencia = (valor, resistenciaEfetivaPct) => Math.max(0, valor * (1 - Math.min(100, resistenciaEfetivaPct) / 100));

/** Os tetos que a ficha e a tela mostram. */
export const tetos = () => ({
  resistenciaDoJogador: LIMITES.resistenciaDoJogador.maximo,
  critico: LIMITES.critico.chanceMaxima,
  resistenciaAControle: LIMITES.resistenciaAControle.maximo,
  ataqueDuplo: LIMITES.ataqueDuplo.chanceMaxima,
  penetracao: LIMITES.penetracao.maximo,
});
