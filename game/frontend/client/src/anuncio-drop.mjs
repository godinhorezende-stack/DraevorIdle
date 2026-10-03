/*
 * ---- O ANÚNCIO de drop raro, fora do chat ----
 *
 * O dono: "quando alguém dropa um item épico pra cima aparece para todo mundo
 * o nome do item e a pessoa que dropou" — e "queria que o anúncio fosse fora
 * do chat também". Uma faixa no alto da tela, uma de cada vez: a figura do
 * item, o nome na cor da raridade (com o balão completo ao passar o mouse ou
 * segurar o dedo), quem dropou e de que bicho. Some sozinha; tocar fecha.
 *
 * Numa hora de muito drop elas não se empilham na tela: entram numa fila curta
 * (as mais velhas saem), para o anúncio não virar uma parede sobre o jogo.
 */
import { itemCanvas } from './sprites.mjs';
import { nomeDaPeca } from './tooltip.mjs';

const TEMPO_NA_TELA_MS = 6000;
const TEMPO_DO_AVISO_MS = 15000;
const FILA_MAXIMA = 3;
const fila = [];
let atual = null;
let faixa = null;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

function montarSistema(m) {
  const cartao = el('div', 'anuncio-drop anuncio-sistema');
  cartao.setAttribute('role', 'alert');
  cartao.append(el('div', 'anuncio-figura', '⚠'), el('div', 'anuncio-texto anuncio-aviso', m.texto));
  cartao.addEventListener('click', () => proximo());
  return cartao;
}

function montar(m) {
  if (m.t === 'avisoGlobal') return montarSistema(m);
  const cartao = el('div', `anuncio-drop raridade-${String(m.peca?.raridade ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')}`);
  cartao.setAttribute('role', 'status');
  const figura = el('div', 'anuncio-figura');
  try {
    figura.append(itemCanvas(m.peca.id, 32));
  } catch {
    // Sem sprite: a faixa sai só com o texto.
  }
  const texto = el('div', 'anuncio-texto');
  const linha1 = el('div', 'anuncio-quem');
  linha1.append(el('b', null, m.quem ?? 'Alguém'), ` dropou${m.boss ? ' do boss' : ''}${m.bicho ? ` ${m.boss ? m.bicho : `de ${m.bicho}`}` : ''}`);
  const linha2 = el('div', 'anuncio-item');
  linha2.append(nomeDaPeca(m.peca, m.nome));
  texto.append(linha1, linha2);
  cartao.append(figura, texto);
  cartao.addEventListener('click', () => proximo());
  return cartao;
}

function proximo() {
  if (atual) {
    clearTimeout(atual.timer);
    const saindo = atual.node;
    saindo.classList.add('saindo');
    setTimeout(() => saindo.remove(), 250);
    atual = null;
  }
  const m = fila.shift();
  if (!m) return;
  faixa ??= document.body.appendChild(el('div', 'anuncios-drop'));
  const node = montar(m);
  faixa.append(node);
  atual = { node, timer: setTimeout(proximo, m.t === 'avisoGlobal' ? TEMPO_DO_AVISO_MS : TEMPO_NA_TELA_MS) };
}

/** Um `{t:'avisoGlobal', texto}` do servidor (a mesma faixa do drop raro; fica mais tempo, porque é um aviso). */
export function anunciarSistema(m) {
  if (!m?.texto) return;
  fila.push({ ...m, t: 'avisoGlobal' });
  while (fila.length > FILA_MAXIMA) fila.shift();
  if (!atual) proximo();
}

/** Um `{t:'dropRaro', ...}` do servidor. */
export function anunciarDrop(m) {
  if (!m?.peca?.id) return;
  fila.push(m);
  while (fila.length > FILA_MAXIMA) fila.shift();
  if (!atual) proximo();
}
