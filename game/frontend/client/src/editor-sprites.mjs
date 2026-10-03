// Os SPRITES na Engine: o retrato de criatura, item ou montaria desenhado pelo MESMO código do jogo (`sprites.mjs`:
// atlas reais, recorte, cores, animação no ritmo do appearance). Nenhuma imagem é inventada: o que não tem desenho
// nos atlas ganha um marcador neutro ("sem sprite").
//
// Desempenho: o índice dos atlas (`outfits.json` + `item-sprites.json`) é baixado UMA vez, e cada retrato só é
// montado quando o card entra na tela (IntersectionObserver) — uma página de 60 cards não pede 60 folhas de uma vez.
import { el, icone } from './editor-ui.mjs';

// O `sprites.mjs` do jogo entra só na primeira vez que um retrato é desenhado (tela sem sprite não baixa nada, e os
// módulos da Engine continuam importáveis fora do navegador, nos testes).
let Sprites = null;
let indice = null;
/** Carrega o código e o índice dos atlas (uma vez só; falha vira "sem sprite", nunca trava a tela). */
export const carregarSprites = () =>
  (indice ??= import('./sprites.mjs')
    .then((m) => {
      Sprites = m;
      return m.loadSpriteData();
    })
    .catch((e) => console.warn('[engine] sprites:', e.message)));

const MARCADOR = { hunts: 'mapa', vips: 'mapa', especiais: 'mapa', divinas: 'mapa', mapas: 'mapa', drops: 'livros', encontros: 'fase', bosses: 'coroa', monstros: 'painel', itens: 'painel' };

const pendentes = new Map();
const vigia = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        vigia.unobserve(e.target);
        pendentes.get(e.target)?.();
        pendentes.delete(e.target);
      }
    }, { rootMargin: '200px' })
  : null;

/** O canvas do desenho, já no tamanho pedido (criatura: recortada e ampliada; item: ampliado sem borrar). */
function canvasDo(desenho, tamanho, { animar, dir }) {
  if (!Sprites) return el('span');
  if (desenho.tipo === 'criatura') return Sprites.outfitCanvas(desenho.look, desenho.cores ?? undefined, tamanho, dir, animar);
  return Sprites.itemCanvas(desenho.id, tamanho);
}

/**
 * O retrato: uma caixa `tamanho`×`tamanho` com o sprite real (ou o marcador). `desenho` é o que a API da Biblioteca
 * manda (`{ tipo: 'criatura', look, cores }` ou `{ tipo: 'item', id }`); `categoria` escolhe o ícone do marcador.
 * `imediato`: desenha já (painel de detalhe), sem esperar entrar na tela.
 */
export function retrato(desenho, tamanho = 64, { categoria = null, animar = false, dir = 2, imediato = false, rotulo = null } = {}) {
  const caixa = el('div', { class: `eng-arte${desenho ? '' : ' vazia'}`, style: `--tam:${tamanho}px`, role: 'img', 'aria-label': rotulo ?? (desenho ? 'sprite' : 'sem sprite') });
  if (!desenho) {
    caixa.append(icone(MARCADOR[categoria] ?? 'painel'));
    if (tamanho >= 64 && ['monstros', 'itens', 'bosses'].includes(categoria)) caixa.append(el('span', {}, 'sem sprite'));
    return caixa;
  }
  const pintar = () => carregarSprites().then(() => caixa.replaceChildren(canvasDo(desenho, tamanho, { animar, dir })));
  if (imediato || !vigia) pintar();
  else {
    pendentes.set(caixa, pintar);
    vigia.observe(caixa);
  }
  return caixa;
}

/**
 * A PRÉ-VISUALIZAÇÃO grande (painel de detalhe): o retrato com controles que não mexem em dado nenhum — girar a
 * criatura nas 4 direções, animar/parar e o zoom.
 */
export function previa(desenho, { categoria = null, tamanhos = [96, 160, 224] } = {}) {
  const estado = { dir: 2, animar: true, tam: tamanhos[1] ?? tamanhos[0] };
  const palco = el('div', { class: 'eng-previa-palco' });
  const pintar = () => palco.replaceChildren(retrato(desenho, estado.tam, { categoria, animar: estado.animar, dir: estado.dir, imediato: true }));
  const criatura = desenho?.tipo === 'criatura';
  const DIRECOES = ['norte', 'leste', 'sul', 'oeste'];
  const rotuloDir = el('span', { class: 'dica' }, DIRECOES[estado.dir]);
  const controles = desenho
    ? el('div', { class: 'eng-previa-controles' },
        criatura ? el('button', { type: 'button', class: 'fantasma', title: 'Girar para a esquerda', onclick: () => { estado.dir = (estado.dir + 3) % 4; rotuloDir.textContent = DIRECOES[estado.dir]; pintar(); } }, '⟲') : null,
        criatura ? rotuloDir : null,
        criatura ? el('button', { type: 'button', class: 'fantasma', title: 'Girar para a direita', onclick: () => { estado.dir = (estado.dir + 1) % 4; rotuloDir.textContent = DIRECOES[estado.dir]; pintar(); } }, '⟳') : null,
        criatura ? el('button', { type: 'button', class: 'fantasma', title: 'Animar ou parar', onclick: (e) => { estado.animar = !estado.animar; e.currentTarget.textContent = estado.animar ? 'parar' : 'animar'; pintar(); } }, 'parar') : null,
        el('span', { style: 'flex:1' }),
        ...tamanhos.map((t) => el('button', { type: 'button', class: `fantasma${t === estado.tam ? ' ativo' : ''}`, title: `${t}px`, onclick: (e) => { estado.tam = t; for (const b of e.currentTarget.parentElement.querySelectorAll('.eng-zoom')) b.classList.toggle('ativo', b === e.currentTarget); pintar(); }, 'data-zoom': t }, `${Math.round(t / 32)}×`)).map((b) => (b.classList.add('eng-zoom'), b)))
    : null;
  pintar();
  return el('div', { class: 'eng-previa' }, palco, controles);
}
