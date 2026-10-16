// A tela dos MERCENÁRIOS do PoE (dono, 16/10: o "Mercenário completo" — lote 38; o servidor é `systems/itens-poe/mercenarios.mjs`). Duas abas:
// CONTRATADOS (até 3: a ficha de cada um — vida e as gemas do arquétipo com o dano —, os 10 encaixes com o balão de cada peça, levar/deixar,
// reviver, despedir, tirar uma peça SUA e dar uma peça da mochila) e CONTRATAR (os candidatos sorteados, com o preço em ouro).
//
// A tela só mostra e pede. Quem confere as regras (70% do nível da peça, os atributos e as armas do arquétipo, os únicos que os nós
// liberam, o ouro), muda e grava é o servidor: `{t:'mercenario', action, ...}` → a tela inteira de novo (`{t:'mercenarios'}`).
import { itemCanvas } from './sprites.mjs';
import { tipFor, tipTexto } from './tooltip.mjs';
import { vestirRaridade } from './inventory.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const botao = (className, text, aoClicar, dica = null) => {
  const b = el('button', className, text);
  b.type = 'button';
  if (aoClicar) b.onclick = aoClicar;
  if (dica) tipTexto(b, dica);
  return b;
};
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('pt-BR');
const segundos = (ms) => `${(Math.max(0, Number(ms) || 0) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s`;

/** Os 10 encaixes, na ordem da tela, com o nome. */
const ENCAIXES = [['weapon', 'Arma'], ['shield', 'Mão secundária'], ['head', 'Elmo'], ['body', 'Armadura'], ['gloves', 'Luvas'], ['feet', 'Botas'], ['legs', 'Cinto'], ['neck', 'Amuleto'], ['ring', 'Anel'], ['ring2', 'Anel']];
const EQUIPAVEIS = new Set(['weapon', 'shield', 'head', 'body', 'gloves', 'feet', 'legs', 'neck', 'ring']);
const ELEMENTO = { physical: 'Físico', fire: 'Fogo', ice: 'Gelo', energy: 'Raio', chaos: 'Caos' };
const ATRIBUTO = { str: 'Força', dex: 'Destreza', int: 'Inteligência' };
const CLASSE = {
  One_Hand_Swords: 'Espadas de uma mão', Thrusting_One_Hand_Swords: 'Espadas de estocada', Two_Hand_Swords: 'Espadas de duas mãos', Two_Hand_Maces: 'Maças de duas mãos',
  Two_Hand_Axes: 'Machados de duas mãos', One_Hand_Maces: 'Maças de uma mão', One_Hand_Axes: 'Machados de uma mão', Bows: 'Arcos', Wands: 'Varinhas', Sceptres: 'Cetros',
  Staves: 'Cajados', Shields: 'Escudos', Quivers: 'Aljavas',
};

let ctx = null;
let redrawDaJanela = null;
/** A última tela que o servidor mandou (`{t:'mercenarios'}`). */
let tela = null;
const estado = { aba: 'contratados', darPara: null, despedir: null };

export function abrirMercenarios(context) {
  ctx = context;
  ctx.openModal('Mercenários', (body) => {
    redrawDaJanela = () => desenhar(body);
    ctx.redraw = redrawDaJanela;
    // Renasce quando a mochila ou o ouro mudam (a lista das peças para dar), e não a cada xp da caçada.
    ctx.redrawKey = assinatura;
    desenhar(body);
    pedir('ver');
  }, () => {
    redrawDaJanela = null;
    estado.darPara = null;
    estado.despedir = null;
  }, 'mercenarios');
}
/** A resposta do servidor: guarda e redesenha (se a janela está aberta). */
export function chegouMercenarios(m) {
  tela = m;
  if (ctx && redrawDaJanela && ctx.redraw === redrawDaJanela) redrawDaJanela();
}
const pedir = (action, extra = {}) => ctx?.send({ t: 'mercenario', action, ...extra });
function assinatura() {
  const c = ctx?.state?.character;
  return c ? JSON.stringify([(c.inventory ?? []).map((p) => p?.id), c.gold ?? 0, c.bank ?? 0]) : '';
}

function desenhar(body) {
  body.replaceChildren();
  const raiz = el('div', 'merc');
  if (!tela) {
    raiz.append(el('p', 'merc-vazio', 'Carregando os mercenários…'));
    body.append(raiz);
    return;
  }
  const cab = el('div', 'merc-cab');
  cab.append(
    el('span', 'merc-ouro', `Ouro: ${fmt(tela.ouro)} no bolso · ${fmt(tela.banco)} no banco`),
    el('span', 'merc-conta', `Contratados: ${tela.contratados.length} de ${tela.maximo}`),
  );
  const abas = el('div', 'merc-abas');
  for (const [id, nome] of [['contratados', 'Contratados'], ['contratar', 'Contratar']]) {
    const b = botao(`merc-aba${estado.aba === id ? ' ativa' : ''}`, nome, () => { estado.aba = id; redrawDaJanela?.(); });
    abas.append(b);
  }
  raiz.append(cab, abas);
  if (estado.aba === 'contratar') raiz.append(abaContratar());
  else raiz.append(abaContratados());
  body.append(raiz);
}

// ---------------------------------------------------------------- contratados

function abaContratados() {
  const caixa = el('div', 'merc-lista');
  caixa.append(el('p', 'merc-nota', `Ele veste a peça com ${Math.round((tela.fracaoDoNivel ?? 0.7) * 100)}% do nível dela, nos atributos e nas armas do arquétipo; únicos só nos tipos de peça que os seus nós do Luminary liberam${tela.unicosLiberados?.length ? ` (agora: ${[...new Set(tela.unicosLiberados.map(nomeDoEncaixe))].join(', ')})` : ' (nenhum ainda)'}. As peças que ele trouxe se perdem quando outra entra no lugar; as suas voltam para a mochila.`));
  if (!tela.contratados.length) {
    caixa.append(el('p', 'merc-vazio', tela.liberado ? 'Nenhum mercenário contratado ainda. Os candidatos estão na aba Contratar.' : 'Contratar mercenários pede o nó "Você pode contratar um mercenário de forma permanente" (Luminary).'));
    return caixa;
  }
  for (const m of tela.contratados) caixa.append(cartao(m, { contratado: true }));
  return caixa;
}
const nomeDoEncaixe = (slot) => ENCAIXES.find(([s]) => s === slot)?.[1] ?? slot;

function cartao(m, { contratado = false } = {}) {
  const ativo = contratado && tela.ativo === m.id;
  const card = el('section', `merc-card${ativo ? ' ativo' : ''}${m.morto ? ' morto' : ''}`);
  const topo = el('header', 'merc-topo');
  const titulo = el('div', 'merc-titulo');
  titulo.append(el('h4', null, m.nome), el('span', 'merc-sub', `${m.arquetipoNome} · nível ${m.nivel}`));
  topo.append(titulo);
  if (contratado) topo.append(el('span', `merc-selo${m.morto ? ' morto' : ativo ? ' ativo' : ''}`, m.morto ? 'Morto' : ativo ? 'Ao seu lado' : 'Na reserva'));
  card.append(topo);
  card.append(fichaDe(m));
  card.append(encaixes(m, contratado));
  const acoes = el('div', 'merc-acoes');
  if (contratado) {
    acoes.append(ativo ? botao('merc-botao', 'Deixar', () => pedir('deixar')) : botao('merc-botao forte', 'Levar comigo', () => pedir('levar', { id: m.id })));
    if (m.morto) acoes.append(botao('merc-botao forte', `Reviver (${fmt(m.custoReviver)} de ouro)`, () => pedir('reviver', { id: m.id }), 'Morto, ele só volta pagando ouro (como no PoE).'));
    acoes.append(botao(`merc-botao${estado.darPara === m.id ? ' aceso' : ''}`, 'Dar peça da mochila', () => { estado.darPara = estado.darPara === m.id ? null : m.id; redrawDaJanela?.(); }));
    const confirmando = estado.despedir === m.id;
    acoes.append(botao(`merc-botao perigo${confirmando ? ' aceso' : ''}`, confirmando ? 'Confirmar: despedir' : 'Despedir', () => {
      if (!confirmando) { estado.despedir = m.id; redrawDaJanela?.(); return; }
      estado.despedir = null;
      pedir('despedir', { id: m.id });
    }, 'Ele vai embora; as peças que você deu voltam para a mochila.'));
  } else {
    const cheio = tela.contratados.length >= tela.maximo;
    const preco = m.custo > 0 ? `${fmt(m.custo)} de ouro` : 'grátis';
    const b = botao('merc-botao forte', `Contratar (${preco})`, () => pedir('contratar', { id: m.id }), cheio ? `Você já tem ${tela.maximo} mercenários: despeça um antes.` : null);
    b.disabled = cheio;
    acoes.append(b);
  }
  card.append(acoes);
  if (contratado && estado.darPara === m.id) card.append(mochilaPara(m));
  return card;
}

function fichaDe(m) {
  const caixa = el('div', 'merc-ficha');
  const atributos = (m.atributos ?? []).map((a) => ATRIBUTO[a] ?? a).join(' e ');
  const armas = [...(m.armas ?? []), m.secundaria].filter(Boolean).map((c) => CLASSE[c] ?? c).join(', ');
  caixa.append(el('p', 'merc-linha', `Vida: ${fmt(m.ficha?.vida)} · Peças de ${atributos} · ${armas}`));
  // (lote 39, P060) a aura dele: vale nele e em você enquanto ele vive (com a mesma aura sua ligada, vale a sua)
  const aura = m.ficha?.aura;
  if (aura) caixa.append(el('p', 'merc-linha', `Aura: ${aura.nome} (nível ${aura.nivel})${aura.fator > 1 ? ` · efeito +${Math.round((aura.fator - 1) * 100)}%` : ''} — vale nele e em você enquanto ele vive`));
  const ul = el('ul', 'merc-habilidades');
  for (const h of m.ficha?.habilidades ?? []) {
    const li = el('li');
    li.append(
      el('b', null, `${h.nome} (nível ${h.nivel})`),
      el('span', null, ` — ${fmt(h.dano?.min)}–${fmt(h.dano?.max)} de ${ELEMENTO[h.elemento] ?? h.elemento} · ${segundos(h.usoMs)} · alcance ${h.alcance} ${h.alcance === 1 ? 'casa' : 'casas'}`),
    );
    if (h.suportes?.length) li.append(el('small', null, ` · Suportes: ${h.suportes.join(', ')}`));
    ul.append(li);
  }
  if (!ul.children.length) ul.append(el('li', 'merc-vazio', 'Sem habilidades (a gema do arquétipo não está no jogo).'));
  caixa.append(ul);
  return caixa;
}

function encaixes(m, contratado) {
  const grade = el('div', 'merc-encaixes');
  for (const [slot, nome] of ENCAIXES) {
    const p = m.equipment?.[slot];
    const cell = el(p && contratado ? 'button' : 'div', `cell merc-encaixe${p ? '' : ' vazio'}`);
    if (p) {
      const meta = ctx.state.items?.[p.id];
      vestirRaridade(cell, meta, p.raridade ?? null, p.poe ?? null);
      cell.append(itemCanvas(p.id, 32));
      const sua = !!m.doJogador?.[slot];
      if (sua) cell.append(el('i', 'merc-sua', 'sua'));
      tipFor(cell, p.id, `${nome} · ${sua ? (contratado ? 'Sua peça — clique para tirar (volta para a mochila)' : 'Sua peça') : 'Peça dele — se perde quando outra entra no lugar'}`, null, p);
      if (contratado && sua) {
        cell.type = 'button';
        cell.onclick = () => pedir('tirar', { id: m.id, slot });
      }
    } else {
      cell.append(el('span', 'merc-encaixe-nome', nome));
    }
    grade.append(cell);
  }
  return grade;
}

/** As peças do PoE da mochila que vestem algum encaixe: clicar dá a peça ao mercenário (o servidor confere as regras). */
function mochilaPara(m) {
  const caixa = el('div', 'merc-mochila');
  caixa.append(el('h5', null, `Dar a ${m.nome}: clique numa peça da mochila`));
  const grade = el('div', 'merc-mochila-grade');
  const mochila = ctx.state.character?.inventory ?? [];
  mochila.forEach((p, i) => {
    const meta = ctx.state.items?.[p?.id];
    if (!p?.poe || !EQUIPAVEIS.has(meta?.slot)) return;
    const cell = el('button', 'cell merc-peca');
    cell.type = 'button';
    vestirRaridade(cell, meta, p.raridade ?? null, p.poe ?? null);
    cell.append(itemCanvas(p.id, 32));
    tipFor(cell, p.id, `Dar a ${m.nome}`, null, p);
    cell.onclick = () => pedir('equipar', { id: m.id, item: p.id, pilha: i });
    grade.append(cell);
  });
  if (!grade.children.length) grade.append(el('p', 'merc-vazio', 'Nenhuma peça do PoE de vestir na mochila.'));
  caixa.append(grade);
  return caixa;
}

// ---------------------------------------------------------------- contratar

function abaContratar() {
  const caixa = el('div', 'merc-lista');
  if (!tela.liberado) {
    caixa.append(el('p', 'merc-vazio', 'Contratar mercenários pede o nó "Você pode contratar um mercenário de forma permanente" (Luminary, a ascendência da Herdeira).'));
    return caixa;
  }
  const minutos = tela.renovaEm ? Math.max(0, Math.ceil((tela.renovaEm - Date.now()) / 60000)) : null;
  caixa.append(el('p', 'merc-nota', `${tela.primeiraGratis ? 'A sua primeira contratação é grátis. ' : ''}O nível dele fica preso no da contratação (como no PoE). Morto, ele só volta pagando ouro.${minutos != null ? ` Novos candidatos em ${minutos} min.` : ''}`));
  if (!tela.candidatos.length) caixa.append(el('p', 'merc-vazio', 'Nenhum candidato agora.'));
  for (const c of tela.candidatos) caixa.append(cartao(c));
  return caixa;
}
