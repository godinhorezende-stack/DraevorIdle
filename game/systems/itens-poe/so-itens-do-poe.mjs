// SÓ ITENS DO PoE ENTRAM NO JOGO OFICIAL (dono, 07/10: "só vai entrar no jogo itens do PoE" — em todo caminho: loot, NPC, loja, baús,
// guilda, mercado, troca, chão, créditos). Esta é a regra de "é do PoE"; cada caminho por onde um item NOVO entra no personagem pergunta a
// ela (`podeEntrar`). Os movimentos internos (equipar, tirar, mochila ↔ depósito ↔ bolsa) NÃO perguntam: o que já é do personagem nunca
// some por causa desta regra.
//
// É do PoE: as bases, os frascos e os itens de missão (`itens-poe/jogo.mjs`, ids 7.000.000+), os suportes (914.001+), as moedas (915.001+) e
// as gemas (916.001+) do PoE, e toda peça gerada pelo sistema do PoE (`peca.poe`). Fora disso só passam o DINHEIRO (gold/platinum/crystal
// coin viram ouro no bolso na hora: `Inventario.VALOR_DA_MOEDA`) e a MOCHILA do personagem (o contêiner, não um item de jogo).
import { ligado } from './catalogo.mjs';

/** As faixas de id dos itens do PoE: `[de, até]`. */
export const FAIXAS_DO_POE = Object.freeze([
  [7_000_000, Number.MAX_SAFE_INTEGER], // bases, frascos e itens de missão
  [914_001, 914_999], // suportes
  [915_001, 915_999], // moedas
  [916_001, 916_999], // gemas
]);

/** Dinheiro (vira ouro no bolso) e a mochila do personagem: passam sempre. */
const SEMPRE = new Set([3031, 3035, 3043, 2854]);

/** O item é do PoE? (`peca`: a peça, quando houver — a gerada pelo sistema do PoE leva `poe`) */
export function ehDoPoe(id, peca = null) {
  if (peca?.poe) return true;
  const n = Number(id);
  return FAIXAS_DO_POE.some(([de, ate]) => n >= de && n <= ate);
}

/** Este item pode ENTRAR no personagem? No modo clássico, sempre; no oficial, só o do PoE (mais o dinheiro e a mochila). */
export const podeEntrar = (id, peca = null) => !ligado() || SEMPRE.has(Number(id)) || ehDoPoe(id, peca);

/** A frase da recusa (mercado, troca, guilda, chão, caixa da loja). */
export const MENSAGEM = 'Só itens do Path of Exile entram no jogo oficial.';
