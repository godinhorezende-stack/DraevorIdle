// O EQUIPAMENTO GARANTIDO dos bosses de Ato (auditoria de loot, 02/10 — decisão do dono): o boss de fim de Ato não tinha nenhum equipamento
// no loot (só tokens, poções e gemas), então "matar o boss" rendia menos peça que uma hunt comum. Agora a vitória ACRESCENTA ao loot
// `equipamentoGarantido[dificuldade]` peças (1 no Normal, 2 no Cruel, 3 no Merciless), com a raridade do estágio (um degrau acima, como todo
// drop de boss) e, no Merciless — que não tem degrau acima —, no mínimo `raridadeMinima`. Config: `gamedata/itens/raridades.json` (`boss`).
//
// As peças saem entre as `janelaDePecas` de MAIOR level mínimo até o level do boss (da vocação de quem venceu): o boss do fim do jogo dá
// peça de fim de jogo, não a mais fraca do catálogo. Não repete a mesma peça na mesma vitória. A recarga do boss (`bosses.mjs`) segue
// valendo, então isto não vira farm obrigatório.
import { ITEM_CATALOG } from '../dados.mjs';
import { gerarItem, aceitaAtributos } from './gerar.mjs';
import * as C from './config.mjs';

const SLOTS = new Set(['weapon', 'shield', 'head', 'body', 'legs', 'feet', 'ring', 'neck']);
/** As peças de craft (Crafted Draevor) só saem da forja. */
const ehDeCraft = (i) => /^Crafted /.test(i.name ?? '');

/** As peças que o boss pode dar: equipamento que rola atributos, até `level`, da `vocacao`, das `janela` de maior level mínimo. */
export function poolDoBoss(level, vocacao, janela = C.RARIDADES.boss?.janelaDePecas ?? 40) {
  const todas = Object.values(ITEM_CATALOG).filter((i) => SLOTS.has(i.slot) && !i.stackable && !ehDeCraft(i) && aceitaAtributos(i.id) && (i.minLevel ?? 0) <= level && (!i.vocations?.length || i.vocations.includes(vocacao)));
  return todas.sort((a, b) => (b.minLevel ?? 0) - (a.minLevel ?? 0)).slice(0, janela);
}

/**
 * As peças garantidas de uma vitória: `ctx` = `{ ato, dificuldade, itemLevel }` (o contexto do drop da fase) e `vocacao`.
 * Devolve a lista de peças já geradas (raridade, atributos...), vazia fora da campanha.
 */
export function pecasGarantidas(ctx, vocacao, rng = Math.random) {
  const cfg = C.RARIDADES.boss ?? {};
  const quantas = cfg.equipamentoGarantido?.[ctx.dificuldade] ?? 0;
  if (!quantas || !ctx.dificuldade) return [];
  const pool = poolDoBoss(Math.max(1, ctx.itemLevel ?? 1), vocacao, cfg.janelaDePecas);
  const minima = cfg.raridadeMinima?.[ctx.dificuldade];
  const abaixo = (r) => minima && C.ORDEM.indexOf(r) < C.ORDEM.indexOf(minima);
  const sorteadas = [];
  const livres = [...pool];
  for (let i = 0; i < quantas && livres.length; i++) {
    const [item] = livres.splice(Math.floor(rng() * livres.length), 1);
    let peca = gerarItem({ itemId: item.id, ...ctx, boss: true, rng });
    if (abaixo(peca.raridade ?? 'comum')) peca = gerarItem({ itemId: item.id, ...ctx, boss: true, raridade: minima, rng });
    sorteadas.push(peca);
  }
  return sorteadas;
}
