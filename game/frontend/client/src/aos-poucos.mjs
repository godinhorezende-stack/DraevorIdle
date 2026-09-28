/*
 * ---- Listas longas, montadas AOS POUCOS no telefone ----
 *
 * Cyclopedia (até 300 itens), Bestiary (200 criaturas), Hunts (~50 cartões)
 * e Tasks montavam a lista inteira de uma vez: mais de mil elementos, cada
 * cartão com os seus canvases, para uma tela que mostra dez. No telefone é
 * o que mais pesa ao abrir a tela e ao filtrar.
 *
 * Aqui a lista nasce com um lote, e um marcador invisível no fim dela chama o
 * lote seguinte quando a rolagem chega perto (IntersectionObserver, que o
 * navegador responde sem medir nada a cada quadro). Quem monta a lista
 * continua sendo a mesma função de cada tela — este arquivo só decide QUANDO
 * cada item é desenhado. No computador, tudo de uma vez, como sempre foi.
 */
import { ehTelefone } from './perfil.mjs';

const LOTE = 40;

/**
 * Põe `itens` em `lista`, um `desenhar(item, i)` por item.
 * `desenhar` devolve o nó (ou nada, se ele mesmo já anexou).
 */
export function montarAosPoucos(lista, itens, desenhar, { lote = LOTE } = {}) {
  let marcador = null;
  // Antes do marcador: o que a tela pôs DEPOIS da lista (um "e mais...") fica no fim.
  const pôr = (de, ate) => {
    for (let i = de; i < ate; i++) {
      const no = desenhar(itens[i], i);
      if (!no) continue;
      if (marcador?.isConnected) marcador.before(no);
      else lista.append(no);
    }
  };
  if (!ehTelefone() || itens.length <= lote || typeof IntersectionObserver !== 'function') {
    pôr(0, itens.length);
    return;
  }
  marcador = document.createElement('div');
  marcador.className = 'aos-poucos-marcador';
  marcador.setAttribute('aria-hidden', 'true');
  lista.append(marcador);
  let feitos = 0;
  const mais = () => {
    // A tela foi redesenhada (filtro, aba): esta lista não existe mais.
    if (!marcador.isConnected) return olho.disconnect();
    const ate = Math.min(feitos + lote, itens.length);
    pôr(feitos, ate);
    feitos = ate;
    if (feitos >= itens.length) {
      olho.disconnect();
      marcador.remove();
      return;
    }
    // Um lote baixo pode não tirar o marcador da faixa, e aí o observador não
    // avisa de novo. Observar outra vez sempre gera um aviso com o estado de
    // agora — e ele respeita a rolagem de dentro da lista, que a conta pela
    // janela não enxerga.
    olho.unobserve(marcador);
    olho.observe(marcador);
  };
  const olho = new IntersectionObserver(
    (entradas) => {
      if (entradas.some((e) => e.isIntersecting)) mais();
    },
    // Meia tela antes do fim: o lote chega antes de a pessoa ver o buraco.
    { rootMargin: '0px 0px 600px 0px' }
  );
  pôr(0, Math.min(lote, itens.length));
  feitos = Math.min(lote, itens.length);
  olho.observe(marcador);
}
