// (15/10, lote 28) Os ENCAIXES ABISSAIS das peças do PoE ("Tem N Encaixes Abissal": o Torno Estígio e os únicos — dono, 15/10: "faça as
// pendências"). Pôr e tirar as Joias Abissais nas peças VESTIDAS (`{t:'abissal', action:'encaixar'|'retirar', slot, indice, pilha, id}`).
// A joia fica DENTRO da peça (`poe.abissais`), como no PoE: vai junto quando ela sai do corpo, vai para a mochila, o depósito ou a troca.
// O que ela dá soma em `Afixos.somaDeItens` (× o "Efeito das Joias Abissais Encaixadas" da peça). O Elmo Fiel único ("Joias Abissais raras
// encaixadas serão consumidas / Um modificador das joias consumidas será mantido"): a Rara encaixada some e UM mod dela, sorteado, passa a
// ser da peça (× a "Magnitude dos Modificadores Explícitos" dela).
import { ITEM_CATALOG } from '../dados.mjs';
import { nivelExigido } from '../inventario.mjs';
import { recalcular } from './jogo.mjs';
import { comMagnitude } from './gerar.mjs';

const erro = (texto) => ({ ok: false, erro: texto });
/** Quantos Encaixes Abissais a peça tem. */
export const encaixesAbissais = (peca) => Math.max(0, Math.round(Number(peca?.poe?.af?.encaixes_abissais) || 0));
/** A peça é uma Joia Abissal (`itens-poe/jogo.JOIAS`)? */
export const ehJoiaAbissal = (peca) => !!peca && !!ITEM_CATALOG[peca.id]?.abissal;

const pecaVestida = (estado, slot) => (slot && slot !== 'backpack' ? estado?.equipment?.[slot] ?? null : null);

/** Põe a Joia Abissal da mochila (`pilha`, conferida pelo `id`) no encaixe `indice` da peça vestida em `slot`; a que estava volta. */
export function encaixar(estado, { slot, indice, pilha, id } = {}, rng = Math.random) {
  const peca = pecaVestida(estado, slot);
  const n = encaixesAbissais(peca);
  if (!n) return erro('Essa peça não tem Encaixe Abissal.');
  const i = Math.floor(Number(indice));
  if (!(i >= 0 && i < n)) return erro('Esse Encaixe Abissal não existe.');
  const mochila = (estado.inventory ??= []);
  let k = Number(pilha);
  if (!Number.isInteger(k) || (id != null && mochila[k]?.id !== Number(id))) k = id != null ? mochila.findIndex((x) => x?.id === Number(id)) : -1;
  const joia = k >= 0 ? mochila[k] : null;
  if (!ehJoiaAbissal(joia)) return erro('Só Joias Abissais vão nos Encaixes Abissais.');
  const nivel = nivelExigido(ITEM_CATALOG[joia.id], joia);
  if (nivel > (estado.level ?? 0)) return erro(`Precisa do level ${nivel}.`);
  if ((joia.count ?? 1) > 1) joia.count -= 1;
  else mochila.splice(k, 1);
  // (o Elmo Fiel: a Rara é consumida e um mod dela fica na peça)
  if (Number(peca.poe.af?.consome_abissais_raras) > 0 && joia.poe?.raridade === 'raro') {
    const mods = [...(joia.poe.prefixos ?? []), ...(joia.poe.sufixos ?? [])].filter((m) => m?.modelo);
    const mod = mods[Math.floor(rng() * mods.length)];
    if (mod) {
      const comMag = comMagnitude({ ...mod, valores: [...(mod.valores ?? [])] }, Number(peca.poe.af?.magnitude_explicitos) || 0);
      (peca.poe.modificadores ??= []).push({ tipo: 'explicit', modelo: comMag.modelo, texto: comMag.texto, valores: comMag.valores, consumido: joia.poe.nome ?? ITEM_CATALOG[joia.id]?.name ?? 'Joia Abissal' });
      recalcular(peca);
    }
    return { ok: true, notice: mod ? `A joia foi consumida: "${mod.texto}" passa a ser do ${peca.poe.nome ?? 'elmo'}.` : 'A joia foi consumida.' };
  }
  const abissais = (peca.poe.abissais ??= []);
  while (abissais.length < n) abissais.push(null);
  const antes = abissais[i];
  abissais[i] = { ...joia, count: 1 };
  if (antes) mochila.push({ ...antes, count: 1 });
  return { ok: true };
}

/** Tira a Joia Abissal do encaixe `indice` da peça vestida em `slot` para a mochila. */
export function retirar(estado, { slot, indice } = {}) {
  const peca = pecaVestida(estado, slot);
  const joia = peca?.poe?.abissais?.[Math.floor(Number(indice))];
  if (!joia) return erro('Esse Encaixe Abissal está vazio.');
  peca.poe.abissais[Math.floor(Number(indice))] = null;
  (estado.inventory ??= []).push({ ...joia, count: 1 });
  return { ok: true };
}
