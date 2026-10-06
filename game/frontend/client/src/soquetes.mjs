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
// A MESMA regra do servidor (quais sockets estão ligados; a support vale pelas tags da skill).
import { grupoDoSocket, gruposLigados, compativel } from '/packages/shared/src/sockets-de-gema.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

let ctx = null;
let slotAberto = null;
let escolhido = null; // o índice do socket em que a próxima gema vai
let proposta = null; // a operação de orbe que o jogador está olhando: { tipo: 'encaixe' } ou { tipo: 'ligacao', elo, ligar }

/*
 * ---- Os ORBES (Orb of Socketing / Orb of Linking) ----
 * Itens reais da mochila (`orbeDeSocket` no catálogo). O servidor é quem decide e gasta o orbe
 * (`abrirSocket`, `ligarElo`); aqui só se MOSTRA a proposta e se pede a confirmação. Nada acontece por
 * toque ou toque longo numa casa: abrir socket e mexer num link exigem o botão "Confirmar" depois
 * de ver o que vai mudar.
 */
const itemDoOrbe = (tipo) => Object.values(ctx.state.items ?? {}).find((i) => i?.orbeDeSocket === tipo) ?? null;
const quantosOrbes = (tipo) => {
  const id = itemDoOrbe(tipo)?.id;
  return (ctx.state.character?.inventory ?? []).filter((p) => p.id === id).reduce((t, p) => t + (p.count ?? 1), 0);
};
/** O máximo de sockets do slot (a peça sem `soquetes` ainda não diz): o catálogo dos orbes traz a tabela. */
const limiteDoSlot = (slot) => (itemDoOrbe('encaixe') ?? itemDoOrbe('joalheiro'))?.limitesDeSocket?.[slot] ?? 0;
/** Os sockets da peça, ou os de uma peça que ainda não abriu nenhum (todos bloqueados). */
const soquetesDe = (peca, slot) => {
  if (peca?.soquetes?.gemas?.length) return peca.soquetes;
  const max = limiteDoSlot(slot);
  return max ? { abertos: 0, links: [], gemas: Array(max).fill(null) } : null;
};
/*
 * ---- As CORES dos sockets e os ORBES DO PoE (só no modo PoE) ----
 * R vermelho (Força), G verde (Destreza), B azul (Inteligência), W branco (aceita qualquer gema). A gema só entra no socket da cor
 * dela — a regra é do servidor (`Gemas.encaixar`); aqui só se mostra. Os orbes do PoE (`orbeDoPoe` no catálogo): Joalheiro (número
 * de sockets), Fusão (links) e Cromático (cores) — sorteios, com a proposta e o "Confirmar" como os outros orbes.
 */
const COR_DA_GEMA = { vermelha: 'R', verde: 'G', azul: 'B', branca: 'W' };
const NOME_DA_COR = { R: 'vermelho', G: 'verde', B: 'azul', W: 'branco' };
const corDaGemaDoItem = (meta) => COR_DA_GEMA[meta?.poeGema?.cor] ?? 'W';
const cabe = (socket, gema) => !socket || socket === 'W' || gema === 'W' || socket === gema;
const ORBES_DO_POE = ['joalheiro', 'fusao', 'cromatico'];
const modoPoe = () => !!itemDoOrbe('joalheiro');
const PARA_QUE_SERVE = { joalheiro: 'sorteia de novo o número de sockets', fusao: 'sorteia de novo os links', cromatico: 'sorteia de novo as cores' };
/** Por que o orbe do PoE não vale nesta peça (ou null). */
function motivoDoOrbePoe(tipo, sq, max) {
  const abertos = sq.abertos ?? 0;
  const comGema = (sq.gemas ?? []).some(Boolean);
  if (quantosOrbes(tipo) < 1) return `Você não tem ${itemDoOrbe(tipo)?.name ?? 'este orbe'}.`;
  if (tipo === 'joalheiro') return comGema ? 'Tire as gemas desta peça antes.' : abertos >= max ? `Já está no máximo (${max} sockets).` : null;
  if (tipo === 'fusao') return abertos < 2 ? 'Precisa de pelo menos 2 sockets.' : (sq.links ?? []).slice(0, abertos - 1).every(Boolean) ? 'Já está toda ligada.' : null;
  if (tipo === 'cromatico') return comGema ? 'Tire as gemas desta peça antes.' : abertos < 1 ? 'A peça não tem sockets.' : null;
  return null;
}

/** Os grupos ligados (a MESMA regra do servidor) como texto: "1+2 | 3". */
const gruposComoTexto = (sq, links) => gruposLigados({ abertos: sq.abertos, links }).map((g) => g.map((n) => n + 1).join('+')).join(' | ');


/** A peça vestida em `slot` tem sockets? (o menu da peça só oferece a janela quando tem). */
export const temSoquetes = (peca) => !!peca?.soquetes?.gemas?.length;

export function abrirSoquetes(context, slot, modo = null) {
  ctx = context;
  slotAberto = slot;
  escolhido = null;
  // Veio de um orbe: a proposta já nasce para ele (encaixe: abrir o próximo socket; ligação: o jogador escolhe o elo).
  proposta = modo === 'encaixe' ? { tipo: 'encaixe' } : modo === 'ligacao' ? { tipo: 'ligacao', elo: null } : ORBES_DO_POE.includes(modo) ? { tipo: 'poe', orbe: modo } : null;
  desenhar();
}

/**
 * Usar um orbe: o jogador escolhe a PEÇA de destino (só as vestidas que aceitam aquele orbe) e cai na
 * janela de sockets com a proposta aberta. Abre pelo direito/menu do orbe na mochila — um gesto
 * explícito, que no celular é o toque longo ao soltar (`mobile.mjs`), o mesmo de qualquer item.
 */
export function usarOrbe(context, tipo) {
  ctx = context;
  const orbe = itemDoOrbe(tipo);
  const nome = orbe?.name ?? 'orbe';
  ctx.openModal(`Usar ${nome}`, (body) => {
    body.append(el('p', 'shop-note', orbe?.descricao ?? ''));
    body.append(el('p', 'shop-note dica', `Você tem ${quantosOrbes(tipo)}. Escolha a peça vestida:`));
    const lista = el('div', 'soquetes-gemas');
    let algum = false;
    for (const [slot, peca] of Object.entries(ctx.state.character?.equipment ?? {})) {
      const max = peca?.soquetes?.gemas?.length || limiteDoSlot(slot);
      if (!peca || !max) continue;
      algum = true;
      const sq = soquetesDe(peca, slot);
      const meta = ctx.state.items?.[peca.id];
      const motivo = ORBES_DO_POE.includes(tipo)
        ? motivoDoOrbePoe(tipo, sq, max)
        : tipo === 'encaixe'
          ? sq.abertos >= max ? `no máximo (${max} sockets)` : null
          : sq.abertos < 2 ? 'precisa de 2 sockets abertos' : null;
      const linha = el('button', 'soquetes-gema');
      linha.type = 'button';
      linha.append(itemCanvas(peca.id, 28));
      const texto = el('div', null);
      texto.append(el('b', null, meta?.name ?? 'peça'), el('em', null, `${sq.abertos}/${max} sockets${motivo ? ` — ${motivo}` : ''}`));
      linha.append(texto);
      linha.disabled = !!motivo;
      linha.onclick = () => abrirSoquetes(ctx, slot, tipo);
      lista.append(linha);
    }
    body.append(algum ? lista : el('p', 'empty', 'Nenhuma peça vestida aceita sockets.'));
  });
}

function desenhar() {
  const { state } = ctx;
  const peca = state.character?.equipment?.[slotAberto];
  const meta = peca ? state.items?.[peca.id] : null;
  ctx.openModal(`Sockets — ${meta?.name ?? 'peça'}`, (body) => {
    ctx.redraw = desenhar;
    const sq = soquetesDe(peca, slotAberto);
    if (!sq) {
      body.append(el('p', 'empty', 'Esta peça não tem sockets.'));
      return;
    }
    corpo(body, { ...peca, soquetes: sq });
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
  // Os LINKS explicados: são da peça, e não se trocam (ainda).
  body.append(
    el(
      'p',
      'shop-note dica',
      'Links: o traço dourado entre dois sockets é um link — os sockets ligados formam um grupo, e as supports do grupo valem para as skills do mesmo grupo. ' +
        'Sem traço, os sockets não conversam. ' +
        (modoPoe()
          ? 'Como no PoE, cada socket tem COR: vermelho (Força), verde (Destreza), azul (Inteligência) ou branco (qualquer gema) — a gema só entra na cor dela. O Orbe do Joalheiro, a Orbe da Fusão e o Orbe Cromático sorteiam de novo o número, os links e as cores.'
          : 'Os links vêm na peça: a que cai sorteia (quanto mais rara, mais chance de link) e as peças de antes das gemas vieram todas ligadas.')
    )
  );

  // O limite da peça e os grupos ligados de agora (cada grupo com a sua cor na fila).
  body.append(
    el(
      'p',
      'soquetes-limite',
      `Sockets abertos: ${abertos} de ${max}${abertos >= max ? ' (o máximo desta peça)' : ''} · grupos: ${abertos ? gruposComoTexto(sq, sq.links ?? []) : 'nenhum'}`
    )
  );
  const grupos = gruposLigados({ abertos, links: sq.links ?? [] });
  const grupoDe = (i) => grupos.findIndex((g) => g.includes(i));
  const defDe = (g) => (g ? state.items?.[g.id]?.gemaDef ?? null : null);
  // As gemas do grupo ligado ao socket `i` (sem ele mesmo): o que valeria se algo entrasse ali.
  const vizinhas = (i) => grupoDoSocket(sq, i).filter((k) => k !== i).map((k) => defDe(sq.gemas[k])).filter(Boolean);
  // A support encaixada vale se há, no grupo dela, uma skill compatível.
  const valeAgora = (i, def) => vizinhas(i).some((d) => d.tipo === 'ativa' && compativel(def, d.tags));
  const fila = el('div', 'soquetes-fila');
  for (let i = 0; i < max; i++) {
    const g = sq.gemas[i];
    const trancado = i >= abertos;
    const nGrupo = trancado ? -1 : grupoDe(i);
    const emGrupo = nGrupo >= 0 && grupos[nGrupo].length > 1;
    const cor = !trancado ? sq.cores?.[i] ?? null : null;
    const casa = el('button', `soquete-casa${cor ? ` cor-${cor}` : ''}${trancado ? ' trancado' : ''}${escolhido === i ? ' escolhido' : ''}${emGrupo ? ` grupo grupo-${nGrupo % 4}` : ''}${trancado && proposta?.tipo === 'encaixe' && i === abertos ? ' proximo' : ''}`);
    casa.type = 'button';
    if (trancado) {
      casa.append(el('span', null, '🔒'));
      casa.disabled = true;
      casa.title = 'Socket bloqueado';
    } else if (!g && cor) {
      casa.title = `Socket ${NOME_DA_COR[cor]}${cor === 'W' ? ' (aceita qualquer gema)' : ''}`;
    } else if (g) {
      const def = state.items?.[g.id]?.gemaDef;
      if (def?.tipo === 'support' && !valeAgora(i, def)) {
        casa.classList.add('sem-efeito');
        casa.title = 'Sem efeito: não está ligada a uma gema de skill compatível';
      }
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
    if (i < max - 1) {
      const aberto = i + 1 < abertos; // os DOIS sockets do elo precisam estar abertos
      const ligado = aberto && !!sq.links?.[i];
      const classe = `soquete-elo${ligado ? ' ligado' : ''}${ligado && emGrupo ? ` grupo-${nGrupo % 4}` : ''}${proposta?.tipo === 'ligacao' && proposta.elo === i ? ' escolhido' : ''}`;
      if (!aberto || (modoPoe() && quantosOrbes('ligacao') < 1)) fila.append(el('span', classe, aberto ? (ligado ? '━' : '·') : ''));
      else {
        // Um BOTÃO: tocar nele só mostra a proposta (abaixo) — quem muda o link é o "Confirmar".
        const elo = el('button', classe, ligado ? '━' : '·');
        elo.type = 'button';
        elo.title = ligado ? `Link entre os sockets ${i + 1} e ${i + 2} — toque para propor desfazer` : `Sem link entre os sockets ${i + 1} e ${i + 2} — toque para propor ligar`;
        elo.onclick = () => {
          proposta = { tipo: 'ligacao', elo: i, ligar: !ligado };
          desenhar();
        };
        fila.append(elo);
      }
    }
  }
  body.append(fila);

  // A FUNDIDORA (moeda): sorteia de novo os links desta peça.
  const fundidoraId = Object.values(state.items ?? {}).find((i) => i?.type === 'moeda' && i?.name === 'fundidora')?.id;
  const fundidoras = (state.character?.inventory ?? []).filter((p) => p.id === fundidoraId).reduce((t, p) => t + (p.count ?? 1), 0);
  const fundir = el('button', 'ghost', `Fundir links · ${fundidoras} Fundidora${fundidoras === 1 ? '' : 's'}`);
  fundir.title = 'Sorteia de novo os links entre os sockets abertos desta peça (mais chance quanto mais rara a peça).';
  fundir.disabled = !fundidoras || abertos < 2;
  /*
   * Refazer os links é uma ação que MUDA a peça (e gasta a moeda): pede confirmação — o primeiro
   * toque só arma ("Confirmar: fundir links"), o segundo, em até 4 s, manda. Um toque perdido no
   * celular (o dedo que escorrega depois de segurar um socket) não refaz os links de ninguém.
   */
  let armadoAte = 0;
  fundir.onclick = () => {
    if (Date.now() > armadoAte) {
      armadoAte = Date.now() + 4000;
      fundir.textContent = 'Confirmar: fundir links (toque de novo)';
      fundir.classList.add('perigo');
      setTimeout(() => {
        if (Date.now() >= armadoAte && fundir.isConnected) {
          fundir.textContent = `Fundir links · ${fundidoras} Fundidora${fundidoras === 1 ? '' : 's'}`;
          fundir.classList.remove('perigo');
        }
      }, 4000);
      return;
    }
    armadoAte = 0;
    send({ t: 'gema', action: 'fundir', slot: slotAberto });
  };
  const barraDaPeca = el('div', 'soquetes-acoes');
  // No PoE a Orbe da Fusão faz isto; a Fundidora só aparece para quem ainda tem alguma.
  if (!modoPoe() || fundidoras > 0) barraDaPeca.append(fundir);
  if (barraDaPeca.children.length) body.append(barraDaPeca);
  orbes(body, sq, max, abertos);

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
  // O que está ligado a ESTE socket — é contra isso que cada gema abaixo é conferida.
  const doGrupo = vizinhas(escolhido);
  const ativasDoGrupo = doGrupo.filter((d) => d.tipo === 'ativa');
  const supportsDoGrupo = doGrupo.filter((d) => d.tipo === 'support');
  body.append(
    el(
      'p',
      'shop-note',
      grupoDoSocket(sq, escolhido).length > 1
        ? `Ligado a: ${doGrupo.length ? doGrupo.map((d) => d.nomePt ?? d.nome).join(', ') : 'sockets vazios'}.`
        : 'Este socket não tem link: uma support aqui não vale para nada.'
    )
  );
  // A prévia de cada gema: para quem a support valeria; que supports a skill receberia.
  const previa = (def) => {
    const p = el('span', 'soquetes-previa');
    const bom = (t) => p.append(el('i', 'vale', t));
    const ruim = (t) => p.append(el('i', 'nao-vale', t));
    if (def.tipo === 'support') {
      const vale = ativasDoGrupo.filter((a) => compativel(def, a.tags));
      const nao = ativasDoGrupo.filter((a) => !compativel(def, a.tags));
      if (vale.length) bom(`vale para: ${vale.map((a) => a.nome).join(', ')}`);
      if (nao.length) ruim(`não vale para: ${nao.map((a) => a.nome).join(', ')}`);
      if (!ativasDoGrupo.length) ruim('sem skill ligada: não vale para nada');
    } else {
      const recebe = supportsDoGrupo.filter((s) => compativel(s, def.tags));
      const nao = supportsDoGrupo.filter((s) => !compativel(s, def.tags));
      if (recebe.length) bom(`recebe: ${recebe.map((s) => s.nomePt ?? s.nome).join(', ')}`);
      if (nao.length) ruim(`não recebe: ${nao.map((s) => s.nomePt ?? s.nome).join(', ')}`);
      if (!supportsDoGrupo.length) p.append(el('i', null, 'nenhuma support ligada'));
    }
    return p;
  };
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
    texto.append(el('b', null, meta.gemaDef.nomePt ?? meta.gemaDef.nome), el('em', null, `${meta.gemaDef.tipo === 'support' ? 'suporte' : 'skill'} · ${item.raridade ?? 'comum'} · nível ${item.gema?.nivel ?? 1} · ${item.gema?.qualidade ?? 0}%`));
    texto.append(previa(meta.gemaDef));
    linha.classList.add(classeDaRaridade(meta, item));
    // A cor (PoE): a gema da cor errada não entra neste socket.
    const corGema = corDaGemaDoItem(meta);
    const corSocket = sq.cores?.[escolhido] ?? null;
    if (corSocket) {
      texto.querySelector('b')?.prepend(el('i', `cor-gema cor-${corGema}`));
      if (!cabe(corSocket, corGema)) {
        linha.classList.add('cor-errada');
        linha.disabled = true;
        texto.append(el('i', 'nao-vale', `gema ${NOME_DA_COR[corGema]}: precisa de socket ${NOME_DA_COR[corGema]} ou branco`));
      }
    }
    linha.append(texto);
    tipFor(linha, item.id, null, null, item);
    linha.onclick = () => send({ t: 'gema', action: 'encaixar', slot: slotAberto, indice: escolhido, de: indice });
    lista.append(linha);
  }
  body.append(lista);
}

/*
 * O painel dos ORBES: quantos você tem, o que cada um faria NESTA peça, a proposta (o que muda) e
 * o "Confirmar". Quando não dá para usar, diz por quê — e o orbe não é gasto.
 */
function orbes(body, sq, max, abertos) {
  const { send } = ctx;
  const caixa = el('div', 'soquetes-orbes');
  if (modoPoe()) {
    orbesDoPoe(caixa, sq, max);
    // Os orbes do Draevor só para quem ainda tem algum (no PoE eles não caem nem se compram mais).
    if (quantosOrbes('encaixe') < 1 && quantosOrbes('ligacao') < 1) {
      body.append(caixa);
      return;
    }
  }
  const nEncaixe = quantosOrbes('encaixe');
  const nLigacao = quantosOrbes('ligacao');
  const nomeEncaixe = itemDoOrbe('encaixe')?.name ?? 'orbe de encaixe';
  const nomeLigacao = itemDoOrbe('ligacao')?.name ?? 'orbe de ligação';

  // --- Encaixe: abrir o próximo socket
  const encaixe = el('div', 'orbe-linha');
  const motivoEncaixe = abertos >= max ? `Esta peça já está no máximo (${max} sockets).` : nEncaixe < 1 ? `Você não tem ${nomeEncaixe}.` : null;
  const abrir = el('button', 'ghost', `Abrir o socket ${abertos + 1} · ${nomeEncaixe} (${nEncaixe})`);
  abrir.type = 'button';
  abrir.disabled = !!motivoEncaixe;
  abrir.onclick = () => {
    proposta = { tipo: 'encaixe' };
    desenhar();
  };
  encaixe.append(abrir);
  if (motivoEncaixe) encaixe.append(el('em', 'orbe-motivo', motivoEncaixe));
  caixa.append(encaixe);

  // --- Ligação: o elo escolhido na fila
  const ligacao = el('div', 'orbe-linha');
  const semLigacao = abertos < 2 ? 'Precisa de pelo menos 2 sockets abertos.' : nLigacao < 1 ? `Você não tem ${nomeLigacao}.` : null;
  ligacao.append(el('em', 'orbe-motivo', semLigacao ?? `${nomeLigacao} (${nLigacao}): toque no elo entre dois sockets da fila para propor ligar ou desligar.`));
  caixa.append(ligacao);

  // --- A proposta
  if (proposta?.tipo === 'encaixe' && !motivoEncaixe) {
    const p = el('div', 'orbe-proposta');
    p.append(
      el('b', null, `Proposta: abrir o socket ${abertos + 1} de ${max}`),
      el('p', null, `Ele nasce vazio e sem link. Gasta 1 ${nomeEncaixe} (sobram ${nEncaixe - 1}). Nenhuma gema nem link é mexido.`)
    );
    p.append(botoesDaProposta(() => send({ t: 'gema', action: 'abrirSocket', slot: slotAberto })));
    caixa.append(p);
  } else if (proposta?.tipo === 'ligacao' && proposta.elo != null) {
    const i = proposta.elo;
    const depois = [...(sq.links ?? [])];
    depois[i] = proposta.ligar;
    const p = el('div', 'orbe-proposta');
    if (semLigacao) {
      p.append(el('b', null, 'Não dá para usar agora'), el('p', null, semLigacao));
    } else {
      const grupoAntes = gruposComoTexto(sq, sq.links ?? []);
      const grupoDepois = gruposComoTexto(sq, depois);
      p.append(
        el('b', null, proposta.ligar ? `Proposta: ligar os sockets ${i + 1} e ${i + 2}` : `Proposta: desfazer o link entre os sockets ${i + 1} e ${i + 2}`),
        el('p', null, `Grupos: ${grupoAntes}  →  ${grupoDepois}. Gasta 1 ${nomeLigacao} (sobram ${nLigacao - 1}).`)
      );
      // Desligar pode apagar o efeito de uma support que estava neste grupo: avisa antes.
      if (!proposta.ligar && (sq.gemas[i] || sq.gemas[i + 1])) {
        p.append(el('p', 'orbe-aviso', 'Atenção: há gema neste link. Se for uma support, ela deixa de valer para a skill do outro lado. As gemas não saem do lugar.'));
      }
      p.append(botoesDaProposta(() => send({ t: 'gema', action: 'ligarElo', slot: slotAberto, elo: i, ligar: proposta.ligar })));
    }
    caixa.append(p);
  }
  body.append(caixa);
}

/** Os orbes do PoE nesta peça: um botão por orbe (com quantos você tem e o motivo quando não dá) e a proposta com o "Confirmar". */
function orbesDoPoe(caixa, sq, max) {
  const { send } = ctx;
  const linha = el('div', 'soquetes-acoes');
  for (const tipo of ORBES_DO_POE) {
    const item = itemDoOrbe(tipo);
    if (!item) continue;
    const motivo = motivoDoOrbePoe(tipo, sq, max);
    const b = el('button', 'ghost orbe-poe');
    b.type = 'button';
    b.append(itemCanvas(item.id, 22), el('span', null, `${item.name} (${quantosOrbes(tipo)})`));
    b.title = motivo ?? `${item.name}: ${PARA_QUE_SERVE[tipo]}.`;
    b.disabled = !!motivo;
    b.onclick = () => {
      proposta = { tipo: 'poe', orbe: tipo };
      desenhar();
    };
    linha.append(b);
  }
  caixa.append(linha);
  if (proposta?.tipo !== 'poe') return;
  const tipo = proposta.orbe;
  const item = itemDoOrbe(tipo);
  const motivo = motivoDoOrbePoe(tipo, sq, max);
  const p = el('div', 'orbe-proposta');
  if (motivo) p.append(el('b', null, 'Não dá para usar agora'), el('p', null, motivo));
  else {
    p.append(
      el('b', null, `Proposta: usar ${item?.name ?? 'o orbe'} nesta peça`),
      el('p', null, `${PARA_QUE_SERVE[tipo][0].toUpperCase()}${PARA_QUE_SERVE[tipo].slice(1)} (é sorteio: o resultado pode ser pior). Gasta 1 (sobram ${quantosOrbes(tipo) - 1}).${tipo === 'fusao' ? ' As gemas ficam onde estão.' : ''}`)
    );
    p.append(botoesDaProposta(() => send({ t: 'gema', action: 'orbePoe', tipo, slot: slotAberto })));
  }
  caixa.append(p);
}

/** "Confirmar" e "Cancelar" de uma proposta. Confirmar manda UMA vez (o botão se desliga) e limpa a proposta. */
function botoesDaProposta(aoConfirmar) {
  const linha = el('div', 'soquetes-acoes');
  const confirmar = el('button', 'primary', 'Confirmar');
  confirmar.type = 'button';
  confirmar.onclick = () => {
    confirmar.disabled = true;
    proposta = null;
    aoConfirmar();
  };
  const cancelar = el('button', 'ghost', 'Cancelar');
  cancelar.type = 'button';
  cancelar.onclick = () => {
    proposta = null;
    desenhar();
  };
  linha.append(confirmar, cancelar);
  return linha;
}
