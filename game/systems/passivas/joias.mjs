// (15/10, lote 27) PÔR e TIRAR as JOIAS dos encaixes da árvore do PoE (`{t:'passivas', action:'encaixarJoia'|'retirarJoia'}`). Dono, 14/10:
// "Criar os encaixes de joia". Quais encaixes valem, a soma e o raio ficam em `passivas/arvore.mjs`; aqui só a peça entre a mochila e o
// encaixe — a que sai (a trocada ou a retirada) volta inteira para a mochila, nunca some.
import * as Passivas from './arvore.mjs';
import { ITEM_CATALOG } from '../dados.mjs';
import { nivelExigido } from '../inventario.mjs';

const erro = (motivo, texto) => ({ ok: false, motivo, erro: texto });
/**
 * (lote 29) A joia que SEGURA nós sem ligação (o Salto Intuitivo, o Fio de Esperança: "podem ser atribuídas sem estarem conectadas à sua
 * árvore") não sai nem é trocada enquanto houver nó alocado que só se liga por ela — como no PoE: tire os nós antes.
 */
function seguraNos(estado, encaixe) {
  // (só os que ficam sem ligação POR CAUSA da joia — os que já estavam soltos não contam)
  const antes = new Set(Passivas.ilhadosSemEles(estado, []));
  const presos = Passivas.ilhadosSemEles(estado, [], [encaixe]).filter((x) => !antes.has(x));
  return presos.length ? erro('JOIA_SEGURA_NOS', `Essa joia segura ${presos.length} nó(s) sem ligação com a árvore — tire-os antes.`) : null;
}
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
  // (lote 29) "Limitado a: N" (a joia única): não mais que N iguais nos encaixes (a que sai deste encaixe não conta).
  const limite = Passivas.dadosDaJoiaUnica(peca)?.limite;
  const iguais = Object.entries(p.joias ?? {}).filter(([id, j]) => id !== encaixe.id && j?.poe?.raridade === 'unico' && j.poe.unico === peca.poe?.unico).length;
  if (limite && iguais >= limite) return erro('LIMITE', `"Limitado a: ${limite}": já há ${iguais} ${peca.poe?.nome ?? 'desta joia'} nos encaixes.`);
  if (p.joias?.[encaixe.id]) {
    const preso = seguraNos(estado, encaixe.id);
    if (preso) return preso;
  }
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
  const preso = seguraNos(estado, id);
  if (preso) return preso;
  delete p.joias[id];
  p.joiasVersao = (p.joiasVersao ?? 0) + 1;
  (estado.inventory ??= []).push({ ...peca, count: 1 });
  return { ok: true, mudou: true };
}
