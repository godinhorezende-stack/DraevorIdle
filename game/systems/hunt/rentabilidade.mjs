// A RENTABILIDADE da caçada — o preço de venda ao NPC e as contas do Analisador, num lugar só.
//
// Auditoria de 01/10 ("o analisador mostra lucro negativo ou valores errados"): o Analisador
// somava `gold + lootValue + pouchValue` — e `lootValue` era só o que a VENDA AUTOMÁTICA tinha
// vendido, `pouchValue` o que estava na bolsa NAQUELE instante. Vender a bolsa pelo botão, levar
// um item para a mochila ou guardar uma peça pelo filtro tirava o valor da conta sem pôr em lugar
// nenhum (o lucro caía, até ficar negativo); e depois de "Zerar analisador" a bolsa de antes
// entrava como loot da sessão nova. Aqui o loot vale o que foi COLETADO na sessão, pelo preço do
// NPC (a mesma regra da venda) — não importa se já foi vendido, guardado ou ainda está na bolsa.
import { ITEM_CATALOG, CATALOGO } from '../dados.mjs';
import { VALOR_DA_MOEDA } from '../inventario.mjs';
import * as GemasDoAtelier from '../gemas.mjs';

/** A taxa da venda ao NPC (`quickSellRate` do catálogo: 1 = paga o preço cheio). */
export const TAXA_DE_VENDA = CATALOGO.quickSellRate ?? 1;

/**
 * O que o NPC paga por UMA unidade — a regra ÚNICA de preço (bolsa, mochila, baú, analisador).
 * 0 = o NPC não compra (sem `sell` no catálogo, ou gema do Gem Atelier). A raridade e os
 * atributos da peça não mudam o preço (decisão do dono: ver `itens/preco-de-venda.mjs`).
 */
export function precoNpc(id) {
  if (GemasDoAtelier.ehGema(Number(id))) return 0;
  return Math.floor((Number(ITEM_CATALOG[id]?.sell) || 0) * TAXA_DE_VENDA);
}

const ehMoeda = (id) => VALOR_DA_MOEDA[Number(id)] != null;

/**
 * O valor do que foi coletado (`{id: quantidade}`), pelo preço do NPC. As moedas ficam de fora
 * (o ouro delas já está em `gold`). Devolve também o que não tem preço (`semPreco`: quantos itens,
 * que contam 0) e a lista por item, do que mais vale para o que menos vale.
 */
export function valorDoLoot(loot = {}, preco = precoNpc) {
  let valor = 0;
  let semPreco = 0;
  let taxas = 0;
  const itens = [];
  for (const [chave, n] of Object.entries(loot ?? {})) {
    const id = Number(chave);
    const count = Number(n) || 0;
    // Moeda: já está no `gold`. Id inválido ("undefined" de sessão antiga): não é item.
    if (!count || ehMoeda(id) || !Number.isFinite(id)) continue;
    const unidade = preco(id);
    if (!(unidade > 0)) {
      semPreco += count;
      continue;
    }
    valor += unidade * count;
    taxas += Math.max(0, (Number(ITEM_CATALOG[id]?.sell) || 0) - unidade) * count;
    itens.push({ id, count, unidade, total: unidade * count });
  }
  itens.sort((a, b) => b.total - a.total);
  return { valor, semPreco, taxas, itens };
}

/** Quantas unidades UM drop dá, em média (a moeda de ouro sorteia em volta da exp do bicho; ver `quantasMoedas`). */
export function quantidadeMedia(bicho, id) {
  if (Number(id) !== 3031) return 1;
  return Math.max(1, bicho?.expDasMoedas ?? bicho?.exp ?? 10);
}

/**
 * A ESTIMATIVA pelas chances: para cada bicho morto (`mortes`: `{chaveDoBicho: n}`), cada item da
 * tabela dele vale `mortes × chance × quantidade média × preço`. É probabilidade, não o que caiu —
 * e usa as chances-base (sem Buff Power, prey, afixo de loot...). `bestiario`: `{chave: {loot}}`.
 * Devolve `{ gold, valor, itens }` (gold = moedas esperadas; valor = itens pelo preço do NPC).
 */
export function valorEsperado(mortes = {}, bestiario = {}, preco = precoNpc) {
  let gold = 0;
  let valor = 0;
  const porItem = new Map();
  for (const [chave, n] of Object.entries(mortes ?? {})) {
    const bicho = bestiario[chave];
    const kills = Number(n) || 0;
    if (!bicho || !kills) continue;
    for (const drop of bicho.loot ?? []) {
      if (drop.id == null) continue; // entrada sem id no bestiário: não é item (ver `combate.mjs`)
      const chance = Math.min(1, Math.max(0, Number(drop.chance) || 0)); // fração (0,001 = 0,1%), não porcentagem
      const quantidade = kills * chance * quantidadeMedia(bicho, drop.id);
      if (!quantidade) continue;
      if (ehMoeda(drop.id)) {
        gold += quantidade * VALOR_DA_MOEDA[drop.id];
        continue;
      }
      const unidade = preco(drop.id);
      const atual = porItem.get(drop.id) ?? { id: drop.id, quantidade: 0, unidade, total: 0 };
      atual.quantidade += quantidade;
      atual.total += quantidade * unidade;
      porItem.set(drop.id, atual);
      valor += quantidade * unidade;
    }
  }
  return { gold, valor, itens: [...porItem.values()].sort((a, b) => b.total - a.total) };
}

/**
 * As linhas do Analisador, separadas: bruto (ouro + loot), custos (suprimentos), taxas (o que a
 * venda desconta), líquido e por hora. Lucro negativo de verdade aparece negativo.
 */
export function resumo({ gold = 0, loot = 0, supplies = 0, taxas = 0, ms = 0 } = {}) {
  const bruto = gold + loot;
  const liquido = bruto - supplies;
  const horas = ms / 3_600_000;
  return { bruto, custos: supplies, taxas, liquido, porHora: horas > 0 ? Math.round(liquido / horas) : 0 };
}
