// A FORJA DO PoE (dono, 07/10: "utilizando a forja refazendo para uso dos itens que têm efeito"): no modo PoE a Forja vira a bancada do
// PoE — escolhe a PEÇA (vestida ou na mochila; a gema, para o Prisma e a Lente), escolhe a MOEDA (as que você tem), vê o que ela faz e
// aplica. Quem decide e muda a peça é o servidor (`{t:'moeda', moeda, alvo}` → `itens-poe/moedas.mjs`); a resposta volta no estado, e
// a tela se redesenha com a peça nova. A moeda só é gasta quando a peça muda.
import { itemCanvas } from './sprites.mjs';
import { tipFor } from './tooltip.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const NOME_DO_SLOT = { weapon: 'arma', shield: 'mão secundária', head: 'elmo', body: 'armadura', gloves: 'luvas', feet: 'botas', legs: 'cinto', neck: 'amuleto', ring: 'anel', ring2: 'anel' };
const STATUS = { funciona: ['funciona', 'ok'], parcial: ['funciona em parte', 'parcial'], nao: ['sem efeito no jogo', 'nao'] };

let ctx = null;
let escolhaPeca = null; // { onde, slot | indice }
let escolhaMoeda = null; // itemId

/** A Forja do PoE está ligada? (o modo PoE manda as moedas no catálogo) */
export const temForjaPoe = (state) => Object.values(state?.items ?? {}).some((i) => i?.moedaPoe);

export function abrirForjaPoe(context, { moeda = null } = {}) {
  ctx = context;
  if (moeda != null) escolhaMoeda = Number(moeda);
  ctx.openModal('Forja do PoE', (body) => {
    ctx.redraw = () => desenhar(body);
    desenhar(body);
  });
}

function pecas(state) {
  const saida = [];
  for (const [slot, p] of Object.entries(state.character?.equipment ?? {})) if (p?.poe) saida.push({ alvo: { onde: 'equipment', slot }, peca: p, onde: `vestida · ${NOME_DO_SLOT[slot] ?? slot}` });
  (state.character?.inventory ?? []).forEach((p, indice) => {
    if (p?.poe) saida.push({ alvo: { onde: 'inventory', indice }, peca: p, onde: 'mochila' });
    else if (state.items?.[p?.id]?.gemaDef) saida.push({ alvo: { onde: 'inventory', indice }, peca: p, onde: 'gema na mochila', gema: true });
  });
  return saida;
}
const mesmaEscolha = (a, b) => a && b && a.onde === b.onde && (a.slot ?? a.indice) === (b.slot ?? b.indice);

function desenhar(body) {
  const { state, send } = ctx;
  body.replaceChildren();
  body.append(el('p', 'shop-note', 'Escolha a peça e a moeda. A moeda só é gasta se a peça mudar. Peça corrompida (Orbe Vaal) só aceita as moedas Corroídas; peça espelhada não aceita nenhuma.'));
  const layout = el('div', 'forja-poe');

  // ---- as moedas (as que você tem)
  const colMoedas = el('div', 'forja-poe-col');
  colMoedas.append(el('h4', null, 'Moedas'));
  const tem = new Map();
  for (const p of state.character?.inventory ?? []) if (state.items?.[p.id]?.moedaPoe) tem.set(p.id, (tem.get(p.id) ?? 0) + (p.count ?? 1));
  const gradeMoedas = el('div', 'forja-poe-moedas');
  if (!tem.size) gradeMoedas.append(el('p', 'empty', 'Você não tem moedas do PoE. Elas caem dos monstros, e as básicas a Zuma vende.'));
  const ordem = { funciona: 0, parcial: 1, nao: 2 };
  for (const [id, n] of [...tem].sort(([a], [b]) => ordem[state.items[a].moedaPoe.status] - ordem[state.items[b].moedaPoe.status] || state.items[a].name.localeCompare(state.items[b].name))) {
    const meta = state.items[id];
    const b = el('button', `forja-poe-moeda st-${meta.moedaPoe.status}${escolhaMoeda === id ? ' escolhida' : ''}`);
    b.type = 'button';
    b.append(itemCanvas(id, 32), el('i', 'forja-poe-conta', String(n)));
    tipFor(b, id);
    b.onclick = () => {
      escolhaMoeda = id;
      desenhar(body);
    };
    gradeMoedas.append(b);
  }
  colMoedas.append(gradeMoedas);

  // ---- as peças
  const colPecas = el('div', 'forja-poe-col');
  colPecas.append(el('h4', null, 'Peça'));
  const meta = escolhaMoeda != null ? state.items?.[escolhaMoeda] : null;
  const querGema = meta?.moedaPoe?.alvo === 'gema';
  const semAlvo = meta?.moedaPoe?.alvo === 'nenhum';
  const lista = pecas(state).filter((x) => (querGema ? x.gema : !x.gema));
  if (escolhaPeca && !lista.some((x) => mesmaEscolha(x.alvo, escolhaPeca))) escolhaPeca = null;
  const gradePecas = el('div', 'forja-poe-pecas');
  if (semAlvo) gradePecas.append(el('p', 'empty', 'Esta moeda não precisa de peça.'));
  else if (!lista.length) gradePecas.append(el('p', 'empty', querGema ? 'Nenhuma gema na mochila.' : 'Nenhuma peça do PoE (vestida ou na mochila).'));
  else for (const x of lista) {
    const poe = x.peca.poe;
    const b = el('button', `forja-poe-peca${mesmaEscolha(x.alvo, escolhaPeca) ? ' escolhida' : ''}`);
    b.type = 'button';
    b.append(itemCanvas(x.peca.id, 32));
    const t = el('div');
    const nome = el('b', null, poe?.nome ?? state.items?.[x.peca.id]?.gemaDef?.nome ?? state.items?.[x.peca.id]?.name ?? 'peça');
    if (poe?.cor) nome.style.color = poe.cor;
    t.append(nome, el('em', null, [x.onde, poe?.qualidade ? `${poe.qualidade}%` : null, poe?.corrompido ? 'corrompida' : null, poe?.espelhado ? 'espelhada' : null].filter(Boolean).join(' · ')));
    b.append(t);
    tipFor(b, x.peca.id, null, null, x.peca);
    b.onclick = () => {
      escolhaPeca = x.alvo;
      desenhar(body);
    };
    gradePecas.append(b);
  }
  colPecas.append(gradePecas);

  // ---- o que a moeda faz, a peça escolhida e o "Aplicar"
  const colAcao = el('div', 'forja-poe-col forja-poe-acao');
  colAcao.append(el('h4', null, 'Aplicar'));
  if (!meta) colAcao.append(el('p', 'empty', 'Escolha uma moeda.'));
  else {
    const [rotulo, classe] = STATUS[meta.moedaPoe.status] ?? STATUS.nao;
    const cab = el('div', 'forja-poe-cab');
    cab.append(itemCanvas(escolhaMoeda, 32), el('b', null, meta.name), el('span', `forja-poe-st ${classe}`, rotulo));
    colAcao.append(cab, el('p', 'forja-poe-desc', meta.descricao ?? ''));
    const escolhida = lista.find((x) => mesmaEscolha(x.alvo, escolhaPeca));
    if (escolhida?.peca?.poe) colAcao.append(resumoDaPeca(escolhida.peca.poe));
    const aplicar = el('button', 'primary', 'Aplicar');
    aplicar.type = 'button';
    aplicar.disabled = meta.moedaPoe.status === 'nao' || (!semAlvo && !escolhida);
    aplicar.onclick = () => {
      aplicar.disabled = true;
      send({ t: 'moeda', moeda: escolhaMoeda, ...(semAlvo ? {} : { alvo: escolhaPeca }) });
    };
    colAcao.append(aplicar);
  }
  layout.append(colMoedas, colPecas, colAcao);
  body.append(layout);
}

/** Os modificadores da peça escolhida (o que a moeda vai mexer). */
function resumoDaPeca(poe) {
  const caixa = el('div', 'forja-poe-resumo');
  const nome = el('b', null, `${poe.nome} (${poe.raridadeNome ?? poe.raridade}${poe.ilvl ? ` · iLvl ${poe.ilvl}` : ''})`);
  if (poe.cor) nome.style.color = poe.cor;
  caixa.append(nome);
  for (const i of poe.implicitos ?? []) caixa.append(el('div', 'impl', i.texto));
  for (const m of poe.prefixos ?? []) caixa.append(el('div', `pre${m.talhado ? ' talhado' : ''}`, `${m.texto}${m.talhado ? ' (talhado)' : ''}`));
  for (const m of poe.sufixos ?? []) caixa.append(el('div', `suf${m.talhado ? ' talhado' : ''}`, `${m.texto}${m.talhado ? ' (talhado)' : ''}`));
  for (const m of poe.modificadores ?? []) caixa.append(el('div', 'pre', m.texto));
  if (!(poe.prefixos?.length || poe.sufixos?.length || poe.modificadores?.length)) caixa.append(el('em', null, 'sem modificadores'));
  return caixa;
}
