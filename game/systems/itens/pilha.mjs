// O TAMANHO MÁXIMO DE UMA PILHA — um lugar só para a bolsa, a mochila (dar, juntar, organizar), as moedas e os orbes de socket.
//
// Fora do jogo oficial: 100, o do Tibia/OTServ. No jogo oficial (PoE): o tamanho da pilha do PoE (a ficha da moeda, `pilha`), até 20
// (dono, 08/10: "as pilhas podem ficar no máximo 20" — o Orbe do Remorso, 40 no PoE, fica 20; as de 10 continuam 10). Módulo folha (só o
// catálogo): `skills/gemas.mjs` e `itens-poe/moedas.mjs` não podem importar a mochila sem fechar um ciclo.
import { ITEM_CATALOG } from '../dados.mjs';
import { ligado as itensPoeLigado } from '../itens-poe/catalogo.mjs';

export const PILHA_MAX = 100;
export const PILHA_MAX_POE = 20;

/** Quantas unidades de `id` cabem numa pilha. */
export function pilhaMaxima(id) {
  if (!itensPoeLigado()) return PILHA_MAX;
  const doPoe = Math.floor(Number(ITEM_CATALOG[id]?.pilha)) || PILHA_MAX_POE;
  return Math.max(1, Math.min(PILHA_MAX_POE, doPoe));
}
