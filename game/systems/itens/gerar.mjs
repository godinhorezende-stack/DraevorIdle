// A geração de um item — o ÚNICO lugar com sorte de item no jogo.
//
//   DROP -> item base -> raridade -> quantos atributos -> quais (do pool do
//   equipamento, sem repetir) -> o nível de cada um -> o valor dentro da faixa
//   do nível -> o efeito especial (Lendário) ou supremo (Mítico) -> item final.
//
// Cada passo lê a tabela da configuração (`config.mjs`, gamedata/itens/*.json).
// O contexto diz de onde o drop veio: ato e dificuldade (enquanto não existem
// no jogo, o ato sai do level da hunt), se foi de boss, e o sorteio (`rng`,
// para os testes e a simulação serem reproduzíveis). Nada aqui toca banco,
// rede, Redis ou o estado do personagem — é uma função pura sobre o contexto,
// e roda igual online, na simulação offline e no worker.
//
// A raridade do MONSTRO (Normal/Champion/Elite/Boss) é outra coisa, e ainda
// não existe: quando existir, entra no contexto como variável própria.
import { ITEM_CATALOG } from '../dados.mjs';
import * as C from './config.mjs';
import * as Treino from '../treino.mjs';

/** Slots que recebem atributo no drop (a mochila não). */
export const SLOTS_COM_ATRIBUTO = new Set(Object.entries(C.POOLS).filter(([, p]) => p.length).map(([s]) => s));

/** O item-base recebe atributos? (equipável, não empilha, de um slot com pool) */
export function aceitaAtributos(id) {
  const meta = ITEM_CATALOG[id];
  return !!meta && !meta.stackable && SLOTS_COM_ATRIBUTO.has(meta.slot);
}

/** O pool DESTE item: o do slot, com a perícia da própria arma no lugar de `skill_da_arma`. */
export function poolDe(itemId) {
  const meta = ITEM_CATALOG[itemId];
  const pericia = meta?.wand ? 'magic' : Treino.canonica(meta?.skill);
  const lista = (C.POOLS[meta?.slot] ?? []).flatMap((id) => (id === 'skill_da_arma' ? (C.ATRIBUTOS[`skill_${pericia}`] ? [`skill_${pericia}`] : []) : [id]));
  return [...new Set(lista)];
}

/** Sorteia uma chave de `{chave: peso}` (pesos em %, ou qualquer escala). */
export function sortearChave(tabela, rng = Math.random) {
  const entradas = Object.entries(tabela);
  const total = entradas.reduce((a, [, p]) => a + Number(p), 0);
  let r = rng() * total;
  for (const [chave, p] of entradas) if ((r -= Number(p)) < 0) return chave;
  return entradas.at(-1)[0];
}

/** Sorteia o NÍVEL (1..5) pela tabela [p1..p5]. */
export function sortearNivel(tabela, rng = Math.random) {
  const total = tabela.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < tabela.length; i++) if ((r -= tabela[i]) < 0) return i + 1;
  return tabela.length;
}

/** Arredonda no formato do atributo: número inteiro, ou % com duas casas. */
export const arredondar = (id, v) => (C.ATRIBUTOS[id]?.tipo === 'flat' ? Math.round(v) : Math.round(v * 100) / 100);

/** Um valor dentro da faixa do nível, na posição `pos` (0 = mínimo, 1 = máximo). */
export function valorNaFaixa(id, nivel, pos) {
  const [lo, hi] = C.ATRIBUTOS[id].niveis[String(nivel)];
  return arredondar(id, lo + Math.min(1, Math.max(0, pos)) * (hi - lo));
}

/** O nível de um valor já pronto: o mais alto cuja faixa começa abaixo dele. */
export function nivelDoValor(id, valor) {
  const niveis = C.ATRIBUTOS[id]?.niveis;
  if (!niveis) return 1;
  let nivel = 1;
  for (let n = 1; n <= C.NIVEL_MAXIMO; n++) if (valor >= niveis[String(n)][0]) nivel = n;
  return nivel;
}

/** O ato e a dificuldade de onde o drop saiu (o boss usa a dificuldade de cima). */
export function origemDoDrop(ctx = {}) {
  const ato = String(ctx.ato ?? C.atoDoLevel(ctx.level));
  let dificuldade = ctx.dificuldade ?? C.RARIDADES.dificuldadePadrao;
  if (ctx.boss) dificuldade = C.dificuldadeAcima(dificuldade, C.RARIDADES.boss?.dificuldadeAMais ?? 0);
  return { ato, dificuldade };
}

/**
 * Gera o item de um drop. `ctx`: `{ itemId, level?, ato?, dificuldade?,
 * boss?, raridade? (forçar, p.ex. na simulação), rng? }`.
 *
 * Devolve a peça no formato que o inventário guarda: `{ id, count: 1 }` para
 * o item simples (não aceita atributo, ou saiu Comum sem nenhum), ou
 * `{ id, count: 1, raridade, af: [{ id, nivel, value }], efeito? }`.
 */
export function gerarItem(ctx) {
  const rng = ctx.rng ?? Math.random;
  const simples = { id: ctx.itemId, count: 1 };
  if (!aceitaAtributos(ctx.itemId)) return simples;
  const { ato, dificuldade } = origemDoDrop(ctx);
  const raridade = ctx.raridade ?? sortearChave(C.RARIDADES.chances[ato][dificuldade], rng);
  const def = C.RARIDADES.raridades[raridade];

  // Quantos, e quais: do pool do equipamento, sem repetir.
  const pool = poolDe(ctx.itemId);
  const quantos = Math.min(pool.length, Number(sortearChave(def.atributos, rng)));
  const restantes = [...pool];
  const tabela = C.NIVEIS.chances[ato][dificuldade][raridade];
  const af = [];
  for (let i = 0; i < quantos; i++) {
    const id = restantes.splice(Math.floor(rng() * restantes.length), 1)[0];
    const nivel = sortearNivel(tabela, rng);
    af.push({ id, nivel, value: valorNaFaixa(id, nivel, rng()) });
  }

  // O efeito é separado dos atributos: um por item, do catálogo da raridade.
  const tipo = def.efeito;
  const efeito = tipo && C.EFEITOS[tipo] ? { tipo, id: sortearChave(Object.fromEntries(Object.keys(C.EFEITOS[tipo]).map((k) => [k, 1])), rng) } : null;

  if (!af.length && !efeito && raridade === 'comum') return simples;
  return { ...simples, raridade, af, ...(efeito ? { efeito } : {}) };
}
