// (15/10, lote 28) A janela dos ENCAIXES ABISSAIS das peças vestidas (o Torno Estígio, os únicos com "Tem N Encaixes Abissal"): cada peça
// com os encaixes dela — a Joia Abissal encaixada (o ícone com o balão, "Retirar") ou vazio — e as Joias Abissais da mochila para pôr.
// Quem decide é o servidor (`{t:'abissal', action:'encaixar'|'retirar', slot, indice, pilha, id}` — `itens-poe/abissais.mjs`); a resposta
// volta como estado, que redesenha esta janela pelo `redraw`.
import { itemCanvas } from './sprites.mjs';
import { tipFor } from './tooltip.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const NOME_DO_SLOT = { weapon: 'Arma', shield: 'Mão secundária', head: 'Elmo', body: 'Armadura', gloves: 'Luvas', feet: 'Botas', legs: 'Cinto', neck: 'Amuleto', ring: 'Anel (esquerdo)', ring2: 'Anel (direito)' };

let ctx = null;
let escolhido = null; // { slot, indice }: o encaixe em que a próxima joia vai

/** Quantos Encaixes Abissais a peça tem (o `encaixes_abissais` da tradução). */
export const encaixesAbissais = (peca) => Math.max(0, Math.round(Number(peca?.poe?.af?.encaixes_abissais) || 0));
/** As peças vestidas com Encaixe Abissal: `[[slot, peça]]`. */
const pecasComAbissais = (state) => Object.entries(state.character?.equipment ?? {}).filter(([slot, p]) => p && slot !== 'backpack' && encaixesAbissais(p) > 0);

/** Abre a janela (na peça `slot`, ou em todas as vestidas com Encaixe Abissal). */
export function abrirAbissais(context, slot = null) {
  ctx = context;
  escolhido = slot ? { slot, indice: 0 } : null;
  desenhar();
}

function joiaComBalao(p, tamanho = 30) {
  const icone = el('span', 'abis-icone');
  icone.append(itemCanvas(p.id, tamanho));
  tipFor(icone, p.id, null, null, p);
  return icone;
}

function desenhar() {
  const { state, send } = ctx;
  ctx.openModal('Encaixes Abissais', (body) => {
    ctx.redraw = desenhar;
    const pecas = pecasComAbissais(state);
    if (!pecas.length) return void body.append(el('p', 'empty', 'Nenhuma peça vestida tem Encaixe Abissal (o Torno Estígio e alguns únicos têm).'));
    body.append(el('p', 'shop-note', 'Só Joias Abissais vão nos Encaixes Abissais. A joia fica dentro da peça: vai junto quando ela sai do corpo.'));
    if (!escolhido || !pecas.some(([s]) => s === escolhido.slot)) escolhido = { slot: pecas[0][0], indice: 0 };
    for (const [slot, peca] of pecas) {
      const caixa = el('div', `abis-peca${slot === escolhido.slot ? ' escolhida' : ''}`);
      const meta = state.items?.[peca.id];
      caixa.append(el('h4', null, `${NOME_DO_SLOT[slot] ?? slot} — ${peca.poe?.nome ?? meta?.name ?? ''}`));
      if (Number(peca.poe?.af?.consome_abissais_raras) > 0) caixa.append(el('p', 'dica', 'As Joias Abissais Raras encaixadas aqui são consumidas: um mod delas, sorteado, fica na peça.'));
      const fila = el('div', 'abis-fila');
      for (let i = 0; i < encaixesAbissais(peca); i++) {
        const joia = peca.poe?.abissais?.[i] ?? null;
        const casa = el('div', `abis-casa${escolhido.slot === slot && escolhido.indice === i ? ' escolhida' : ''}`);
        casa.onclick = () => { escolhido = { slot, indice: i }; desenhar(); };
        if (joia) {
          casa.append(joiaComBalao(joia), el('span', `abis-nome raridade-${joia.poe?.raridade ?? 'normal'}`, joia.poe?.nome || state.items?.[joia.id]?.name || 'Joia Abissal'));
          const tirar = el('button', 'ghost', 'Retirar');
          tirar.onclick = (ev) => { ev.stopPropagation(); send({ t: 'abissal', action: 'retirar', slot, indice: i }); };
          casa.append(tirar);
        } else casa.append(el('span', 'abis-vazio', `Encaixe ${i + 1} vazio`));
        fila.append(casa);
      }
      caixa.append(fila);
      body.append(caixa);
    }
    // As Joias Abissais da mochila: "Encaixar" no encaixe escolhido.
    const mochila = (state.character?.inventory ?? []).map((p, i) => [p, i]).filter(([p]) => state.items?.[p?.id]?.abissal);
    body.append(el('b', 'abis-titulo', mochila.length ? `Pôr no encaixe ${escolhido.indice + 1} (${NOME_DO_SLOT[escolhido.slot] ?? escolhido.slot}):` : 'Nenhuma Joia Abissal na mochila.'));
    for (const [p, i] of mochila) {
      const linha = el('div', 'abis-linha');
      const por = el('button', 'primary', 'Encaixar');
      por.onclick = () => send({ t: 'abissal', action: 'encaixar', slot: escolhido.slot, indice: escolhido.indice, pilha: i, id: p.id });
      linha.append(joiaComBalao(p), el('span', `abis-nome raridade-${p.poe?.raridade ?? 'normal'}`, p.poe?.nome || state.items?.[p.id]?.name || 'Joia Abissal'), por);
      body.append(linha);
    }
  });
}
