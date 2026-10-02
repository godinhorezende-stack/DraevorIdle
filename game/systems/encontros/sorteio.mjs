// O SORTEIO dos encontros: uma vez por INSTÂNCIA, com SEMENTE gravada nela.
//
// Decisão do dono: a probabilidade é rolada na criação da instância e nunca mais. Reconectar, recarregar a página,
// salvar e carregar o personagem ou receber o mesmo comando duas vezes NÃO re-rola — e, como o resultado é uma
// FUNÇÃO da semente e do id do encontro, mesmo recalcular dá o mesmo número. Cada encontro tem o seu sorteio
// independente (o sorteio de um não depende da ordem nem da existência dos outros).
import { randomInt } from 'node:crypto';

/** Uma semente nova para uma instância nova (32 bits). */
export const novaSemente = () => randomInt(0, 2 ** 32);

/** O número do encontro `chave` na instância de `semente`: uniforme em [0, 100). Determinístico. */
export function rolar(semente, chave) {
  let h = ((semente >>> 0) ^ 0x9e3779b9) >>> 0;
  for (const ch of String(chave)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 100;
}

/** Aparece nesta instância? 100 = sempre; 0 = nunca. */
export const aparece = (semente, chave, probabilidade) => rolar(semente, chave) < probabilidade;
