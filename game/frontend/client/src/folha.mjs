/*
 * ---- A FOLHA: o painel que sobe de baixo ----
 *
 * O segundo dos três contêineres da casca do celular (os outros são a tela
 * cheia — o `#modal` — e o balão). É onde moram as listas curtas que não
 * merecem tirar o mapa da frente inteiro: o "Mais", o chat, a mochila rápida.
 *
 * Em pé ela sobe do rodapé até no máximo 85% da altura, com a alça para
 * arrastar para baixo. Deitado ela entra pela DIREITA, na altura toda: deitado
 * falta altura e sobra largura, e uma folha que subisse do rodapé cobriria o
 * personagem.
 *
 * Uma folha por vez. Abrir outra troca o conteúdo; o voltar do telefone, o ✕,
 * tocar fora ou arrastar a alça fecham (ver pilha.mjs).
 */
import { abrirNaPilha, fechouNaPilha } from './pilha.mjs';

let no = null;
let aberta = null; // { id, aoFechar }

const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};

function montarNo() {
  if (no) return no;
  const fundo = el('div', 'folha-fundo');
  fundo.hidden = true;
  const caixa = el('section', 'folha');
  caixa.setAttribute('role', 'dialog');
  caixa.setAttribute('aria-modal', 'true');
  const alca = el('div', 'folha-alca');
  alca.setAttribute('aria-hidden', 'true');
  const topo = el('header', 'folha-topo');
  const titulo = el('h2', 'folha-titulo');
  const fechar = el('button', 'folha-fechar', '✕');
  fechar.type = 'button';
  fechar.setAttribute('aria-label', 'Fechar');
  fechar.onclick = () => fecharFolha();
  topo.append(titulo, fechar);
  const corpo = el('div', 'folha-corpo');
  caixa.append(alca, topo, corpo);
  fundo.append(caixa);
  fundo.addEventListener('click', (evento) => {
    if (evento.target === fundo) fecharFolha();
  });
  ligarArrastoDaAlca(caixa, alca);
  document.body.append(fundo);
  no = { fundo, caixa, titulo, corpo };
  return no;
}

/*
 * Arrastar a alça para baixo fecha: é o gesto que todo telefone ensinou. Mais
 * de um terço da altura da folha, ou um puxão rápido, e ela vai embora; menos
 * que isso, ela volta para o lugar.
 */
function ligarArrastoDaAlca(caixa, alca) {
  let inicio = null;
  const alvos = [alca, caixa.querySelector('.folha-topo')];
  for (const alvo of alvos) {
    alvo?.addEventListener('pointerdown', (evento) => {
      if (evento.target.closest('button')) return;
      if (document.documentElement.dataset.perfil !== 'retrato') return;
      inicio = { y: evento.clientY, em: performance.now(), id: evento.pointerId };
      alvo.setPointerCapture?.(evento.pointerId);
      caixa.style.transition = 'none';
    });
    alvo?.addEventListener('pointermove', (evento) => {
      if (!inicio || evento.pointerId !== inicio.id) return;
      const dy = Math.max(0, evento.clientY - inicio.y);
      caixa.style.transform = `translateY(${dy}px)`;
    });
    const soltar = (evento) => {
      if (!inicio || evento.pointerId !== inicio.id) return;
      const dy = Math.max(0, evento.clientY - inicio.y);
      const rapido = dy / Math.max(1, performance.now() - inicio.em) > 0.6;
      inicio = null;
      caixa.style.transition = '';
      caixa.style.transform = '';
      if (dy > caixa.offsetHeight / 3 || (rapido && dy > 24)) fecharFolha();
    };
    alvo?.addEventListener('pointerup', soltar);
    alvo?.addEventListener('pointercancel', soltar);
  }
}

/**
 * Abre (ou troca) a folha.
 * `montar(corpo, fechar)` enche o corpo; `aoFechar` roda quando ela sai.
 */
export function abrirFolha({ id, titulo, montar, aoFechar = null, classe = '' }) {
  const n = montarNo();
  if (aberta && aberta.id !== id) fecharFolha();
  n.titulo.textContent = titulo;
  n.corpo.innerHTML = '';
  n.caixa.className = `folha${classe ? ` ${classe}` : ''}`;
  n.caixa.dataset.folha = id;
  n.caixa.setAttribute('aria-label', titulo);
  montar(n.corpo, fecharFolha);
  const jaEstava = aberta?.id === id;
  aberta = { id, aoFechar };
  n.fundo.hidden = false;
  document.body.classList.add('com-folha');
  if (!jaEstava) abrirNaPilha(`folha:${id}`, () => fecharFolha({ peloVoltar: true }));
  return { corpo: n.corpo, fechar: fecharFolha };
}

export function fecharFolha({ peloVoltar = false } = {}) {
  if (!aberta || !no) return;
  const { id, aoFechar } = aberta;
  aberta = null;
  no.fundo.hidden = true;
  no.corpo.innerHTML = '';
  document.body.classList.remove('com-folha');
  if (!peloVoltar) fechouNaPilha(`folha:${id}`);
  aoFechar?.();
}

export const folhaAberta = () => aberta?.id ?? null;
