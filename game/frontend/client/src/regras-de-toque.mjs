/*
 * ---- Regras PURAS de toque e arrasto (testáveis sem navegador) ----
 *
 * O bug do socket no celular (01/10): segurar o dedo na fileira de sockets da peça VESTIDA
 * começava, no Android, um arrasto da própria peça (o slot é `draggable` e o toque longo é o
 * que inicia o arrasto). Soltando no mesmo lugar, o slot recebia a peça "de volta" e mandava
 * `equip` — e o servidor equipa lendo a MOCHILA: achando outra cópia do mesmo item lá, vestia
 * ESSA (com outros sockets: todos abertos e ligados, por exemplo) e devolvia a vestida, com as
 * gemas, para a mochila. Para quem olha, o cadeado "abria" e os sockets "se ligavam".
 */

/** O gesto começou numa área que não arrasta a peça (a fileira de sockets, por exemplo)? */
export const comecouSemArrasto = (alvo) => !!alvo?.closest?.('[data-sem-arrasto]');

/**
 * O que fazer com uma carga solta num slot de EQUIPAMENTO:
 *   'ignorar'  — veio do próprio corpo: não há o que vestir (o `equip` lê a mochila e trocaria a
 *                peça por outra cópia de lá);
 *   'aviso'    — da Store Inbox (tem de ir para a mochila antes);
 *   'gema'     — uma gema da mochila: encaixa no primeiro socket livre;
 *   'equipar'  — o resto (mochila, bolsa).
 */
export function acaoDaSolturaNoSlot(payload, ehGema) {
  if (!payload || payload.from === 'equipment') return 'ignorar';
  if (payload.from === 'storeInbox') return 'aviso';
  if (ehGema && payload.from === 'bag' && payload.pilha != null) return 'gema';
  return 'equipar';
}

/** Quanto tempo depois do dedo levantar o `click` do toque longo ainda pode chegar (e ser engolido). */
export const JANELA_DO_CLIQUE_ENGOLIDO_MS = 400;

/** O `click` que chegou agora é o do toque longo (e deve ser engolido)? Fora da janela, é um toque NOVO. */
export const engoleEsteClique = (armadoEm, agora) => armadoEm != null && agora - armadoEm <= JANELA_DO_CLIQUE_ENGOLIDO_MS;
