// A janela dos SOCKETS de uma peça vestida (gemas de skill, à Path of Exile).
//
// A skill vem da gema encaixada num socket de uma peça VESTIDA; as supports
// ligadas (mesmo grupo de sockets ligados) a modificam. Esta janela mostra os
// sockets da peça em fila — trancados, vazios, com gema — e os links entre
// eles, e deixa encaixar uma gema da mochila ou tirar a que está lá.
// Quem decide tudo é o servidor (`{t:'gema', action:'encaixar'|'tirar'}`,
// systems/skills/gemas.mjs); a resposta volta como estado + `actionCatalog`,
// que redesenha esta janela pelo `redraw`.
import { itemCanvas } from './sprites.mjs';
import { tipFor, classeDaRaridade } from './tooltip.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

let ctx = null;
let slotAberto = null;
let escolhido = null; // o índice do socket em que a próxima gema vai

/** A peça vestida em `slot` tem sockets? (o menu da peça só oferece a janela quando tem). */
export const temSoquetes = (peca) => !!peca?.soquetes?.gemas?.length;

export function abrirSoquetes(context, slot) {
  ctx = context;
  slotAberto = slot;
  escolhido = null;
  desenhar();
}

function desenhar() {
  const { state } = ctx;
  const peca = state.character?.equipment?.[slotAberto];
  const meta = peca ? state.items?.[peca.id] : null;
  ctx.openModal(`Sockets — ${meta?.name ?? 'peça'}`, (body) => {
    ctx.redraw = desenhar;
    if (!temSoquetes(peca)) {
      body.append(el('p', 'empty', 'Esta peça não tem sockets.'));
      return;
    }
    corpo(body, peca);
  });
}

function corpo(body, peca) {
  const { state, send } = ctx;
  const sq = peca.soquetes;
  const max = sq.gemas.length;
  const abertos = sq.abertos ?? 0;

  body.append(
    el(
      'p',
      'shop-note',
      'A gema de skill dá a skill enquanto a peça estiver vestida. Uma support só vale para a gema de skill LIGADA a ela (o traço dourado).'
    )
  );

  const fila = el('div', 'soquetes-fila');
  for (let i = 0; i < max; i++) {
    const g = sq.gemas[i];
    const trancado = i >= abertos;
    const casa = el('button', `soquete-casa${trancado ? ' trancado' : ''}${escolhido === i ? ' escolhido' : ''}`);
    casa.type = 'button';
    if (trancado) {
      casa.append(el('span', null, '🔒'));
      casa.disabled = true;
      casa.title = 'Socket bloqueado';
    } else if (g) {
      casa.append(itemCanvas(g.id, 32));
      casa.append(el('i', 'soquete-nivel', String(g.nivel)));
      tipFor(casa, g.id, null, null, { id: g.id, count: 1, raridade: g.raridade, gema: { nivel: g.nivel, xp: g.xp, qualidade: g.qualidade } });
    }
    casa.onclick = () => {
      if (trancado) return;
      escolhido = escolhido === i ? null : i;
      desenhar();
    };
    fila.append(casa);
    if (i < max - 1) fila.append(el('span', `soquete-elo${sq.links?.[i] ? ' ligado' : ''}`, sq.links?.[i] ? '━' : ''));
  }
  body.append(fila);

  if (escolhido == null) {
    body.append(el('p', 'shop-note dica', 'Clique num socket para encaixar ou tirar uma gema.'));
    return;
  }

  const atual = sq.gemas[escolhido];
  // A Lapidadora (moeda): sobe a qualidade da gema (até 20%).
  const lapidadoraId = Object.values(state.items ?? {}).find((i) => i?.type === 'moeda' && i?.name === 'lapidadora')?.id;
  const lapidadoras = (state.character?.inventory ?? []).filter((p) => p.id === lapidadoraId).reduce((t, p) => t + (p.count ?? 1), 0);
  if (atual) {
    const acoes = el('div', 'soquetes-acoes');
    const tirar = el('button', 'ghost', 'Tirar a gema (volta para a mochila)');
    tirar.onclick = () => send({ t: 'gema', action: 'tirar', slot: slotAberto, indice: escolhido });
    acoes.append(tirar);
    const lapidar = el('button', 'ghost', `Lapidar · qualidade ${atual.qualidade ?? 0}% (${lapidadoras} Lapidadora${lapidadoras === 1 ? '' : 's'})`);
    lapidar.disabled = !lapidadoras || (atual.qualidade ?? 0) >= 20;
    lapidar.onclick = () => send({ t: 'gema', action: 'lapidar', slot: slotAberto, indice: escolhido });
    acoes.append(lapidar);
    body.append(acoes);
  }

  // As gemas da mochila, pelo ÍNDICE (cada uma tem nível e XP próprios).
  const soltas = (state.character?.inventory ?? [])
    .map((item, indice) => ({ item, indice, meta: state.items?.[item.id] }))
    .filter((x) => x.meta?.gemaDef);
  body.append(el('h3', null, atual ? 'Trocar por' : 'Encaixar'));
  if (!soltas.length) {
    body.append(el('p', 'empty', 'Nenhuma gema na mochila. A Zuma Magehide vende; os bichos também dropam.'));
    return;
  }
  const lista = el('div', 'soquetes-gemas');
  for (const { item, indice, meta } of soltas) {
    const linha = el('button', 'soquetes-gema');
    linha.type = 'button';
    linha.append(itemCanvas(item.id, 28));
    const texto = el('div', null);
    texto.append(el('b', null, meta.gemaDef.nome), el('em', null, `${meta.gemaDef.tipo === 'support' ? 'support' : 'skill'} · ${item.raridade ?? 'comum'} · nível ${item.gema?.nivel ?? 1} · ${item.gema?.qualidade ?? 0}%`));
    linha.classList.add(classeDaRaridade(meta, item));
    linha.append(texto);
    tipFor(linha, item.id, null, null, item);
    linha.onclick = () => send({ t: 'gema', action: 'encaixar', slot: slotAberto, indice: escolhido, de: indice });
    lista.append(linha);
  }
  body.append(lista);
}
