// O TAMANHO MÁXIMO DE UMA PILHA — um lugar só para a bolsa, a mochila (dar, juntar, organizar), as moedas e os orbes de socket.
//
// 100 para todo empilhável, no jogo oficial e fora dele (dono, 09/10: "item empilháveis até 100"). De 08/10 a 09/10 o jogo oficial usou o
// tamanho da pilha do PoE até 20 ("as pilhas podem ficar no máximo 20"); a pilha que ficou menor naquele tempo só cresce. Módulo folha:
// `skills/gemas.mjs` e `itens-poe/moedas.mjs` não podem importar a mochila sem fechar um ciclo.
import { ligado as itensPoeLigado } from '../itens-poe/catalogo.mjs';

export const PILHA_MAX = 100;
/** O teto no jogo oficial (o mesmo do clássico desde 09/10); `itens-poe/moedas.mjs` o grava na ficha da moeda (o balão: "n / 100"). */
export const PILHA_MAX_POE = 100;

/** Quantas unidades de `id` cabem numa pilha (o mesmo teto para todo item hoje; os chamadores seguem perguntando por item). */
export function pilhaMaxima(id) {
  return itensPoeLigado() ? PILHA_MAX_POE : PILHA_MAX;
}
