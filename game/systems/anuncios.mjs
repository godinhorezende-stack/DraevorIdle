// O ANÚNCIO de drop raro para o servidor inteiro.
//
// O dono: "quando alguém dropa um item épico pra cima aparece para todo mundo
// o nome do item e a pessoa que dropou". Toda peça Épica, Lendária ou Mítica
// que cai (de bicho na caçada ou na sacola do boss) vira uma mensagem
// `dropRaro` para todo mundo online — quem dropou, a PEÇA inteira (o nome sai
// com o balão do jogo: base, Item Level, modificadores, poder), de que bicho e
// onde. Um `JSON.stringify` só para todos, como o chat Global.
//
// A projeção da caçada OFFLINE não anuncia: aquilo é a conta de horas fora,
// não um drop que acabou de acontecer.
import { ITEM_CATALOG } from './dados.mjs';
import { camposDaPeca } from './itens/item.mjs';

/** As raridades que o servidor anuncia (Épico para cima). */
export const RARIDADES_ANUNCIADAS = new Set(['épico', 'lendário', 'mítico']);

let vivas = new Map(); // nome -> Sessao (injetado por sessao.mjs)
export const ligar = (mapa) => void (vivas = mapa);

/** Vale anunciar esta peça? */
// (E o ÚNICO do PoE — dono, 07/10: "item únicos são anunciados para todos no servidor, tanto no chat quanto lá na parte de cima".)
export const vale = (peca) => !!peca?.id && (RARIDADES_ANUNCIADAS.has(peca.raridade) || peca.poe?.raridade === 'unico') && !!ITEM_CATALOG[peca.id];

/** A mensagem do anúncio (exportada para os testes). */
export function mensagem({ quem, peca, bicho = null, boss = false, onde = null, em = Date.now() }) {
  return {
    t: 'dropRaro',
    quem,
    bicho,
    boss: !!boss,
    onde,
    em,
    // (A peça do PoE tem o nome dela — o do Único, não o da base.)
    nome: peca.poe?.nome ?? ITEM_CATALOG[peca.id]?.name ?? `item ${peca.id}`,
    peca: { id: peca.id, count: peca.count ?? 1, ...camposDaPeca(peca) },
  };
}

/** Anuncia a peça para todo mundo online (quem dropou inclusive). Devolve para quantos foi. */
export function dropRaro(dados) {
  if (!vale(dados?.peca)) return 0;
  const texto = JSON.stringify(mensagem(dados));
  let n = 0;
  for (const s of vivas.values()) {
    if (!s?.personagem) continue;
    s.enviarPronto(texto);
    n++;
  }
  return n;
}
