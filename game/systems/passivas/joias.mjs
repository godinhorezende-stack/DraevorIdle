// (15/10, lote 27) PÔR e TIRAR as JOIAS dos encaixes da árvore do PoE (`{t:'passivas', action:'encaixarJoia'|'retirarJoia'}`). Dono, 14/10:
// "Criar os encaixes de joia". Quais encaixes valem, a soma e o raio ficam em `passivas/arvore.mjs`; aqui só a peça entre a mochila e o
// encaixe — a que sai (a trocada ou a retirada) volta inteira para a mochila, nunca some.
import * as Passivas from './arvore.mjs';
import { ITEM_CATALOG } from '../dados.mjs';
import { nivelExigido } from '../inventario.mjs';

const erro = (motivo, texto) => ({ ok: false, motivo, erro: texto });
/** A peça é uma joia de encaixe (`itens-poe/jogo.JOIAS`)? */
export const ehJoia = (peca) => !!peca && !!ITEM_CATALOG[peca.id]?.joia;

/**
 * Põe a joia da mochila (`pilha`: o índice; `id`: o item, para conferir) no encaixe `no` — alocado. A joia que estava nele volta para a
 * mochila. Pede o level da peça, como vestir.
 */
export function encaixar(estado, { no, pilha, id } = {}) {
  const { passivas: p } = Passivas.garantir(estado);
  if (Passivas.arvore().id !== 'poe') return erro('SEM_ENCAIXES', 'A árvore em uso não tem encaixes de joia.');
  const encaixe = Passivas.arvore().porId.get(String(no ?? ''));
  if (!Passivas.ehEncaixeDeJoia(encaixe)) return erro('NAO_E_ENCAIXE', 'Esse nó não é um encaixe de joia.');
  if (!p.alocados.includes(encaixe.id)) return erro('ENCAIXE_SEM_PONTO', 'Aloque o encaixe antes de pôr a joia.');
  const mochila = (estado.inventory ??= []);
  // (a mochila pode ter mudado no caminho: o índice só vale se ainda for a mesma peça)
  let i = Number(pilha);
  if (!Number.isInteger(i) || (id != null && mochila[i]?.id !== Number(id))) i = id != null ? mochila.findIndex((x) => x?.id === Number(id)) : -1;
  const peca = i >= 0 ? mochila[i] : null;
  if (!ehJoia(peca)) return erro('NAO_E_JOIA', 'Essa peça não é uma joia.');
  const nivel = nivelExigido(ITEM_CATALOG[peca.id], peca);
  if (nivel > (estado.level ?? 0)) return erro('NIVEL', `Precisa do level ${nivel}.`);
  if ((peca.count ?? 1) > 1) peca.count -= 1;
  else mochila.splice(i, 1);
  const antes = p.joias?.[encaixe.id];
  (p.joias ??= {})[encaixe.id] = { ...peca, count: 1 };
  if (antes) mochila.push({ ...antes, count: 1 });
  p.joiasVersao = (p.joiasVersao ?? 0) + 1;
  return { ok: true, mudou: true };
}

/** Tira a joia do encaixe `no` (alocado ou não) para a mochila. */
export function retirar(estado, { no } = {}) {
  const { passivas: p } = Passivas.garantir(estado);
  const id = String(no ?? '');
  const peca = p.joias?.[id];
  if (!peca) return erro('ENCAIXE_VAZIO', 'Esse encaixe está vazio.');
  delete p.joias[id];
  p.joiasVersao = (p.joiasVersao ?? 0) + 1;
  (estado.inventory ??= []).push({ ...peca, count: 1 });
  return { ok: true, mudou: true };
}
