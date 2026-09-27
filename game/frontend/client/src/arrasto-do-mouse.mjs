/*
 * ---- O arrasto com o MOUSE é do jogo, e não do navegador ----
 *
 * Report do Sabido: "arrastar o item buga o mouse e não dá mais pra clicar na
 * tela, tem que ficar atualizando a tela pra voltar o cursor e a função de
 * cliques ao normal" — e de novo depois da primeira correção (não redesenhar
 * as grades no meio do gesto): "arrastar item ainda tá travando o mouse e só
 * destrava atualizando a página".
 *
 * O `draggable` abre uma sessão de arrasto do NAVEGADOR, e ela vive fora da
 * página. No Chrome/Brave essa sessão pode não fechar nunca — o jogo está
 * sempre ocupado (o mapa redesenha a cada quadro, as janelas se refazem a cada
 * retrato) e basta o `dragstart` chegar atrasado em relação ao botão solto.
 * Com a sessão presa, o cursor fica de arrasto e nenhum clique chega à página
 * até recarregar. Não existe chamada de javascript que feche essa sessão.
 *
 * Então, com mouse, o navegador nunca abre arrasto nenhum: o `preventDefault`
 * no `mousedown` de um elemento arrastável é o que o impede. Quem faz o gesto é
 * este arquivo, e ele entrega os MESMOS eventos (`dragstart`, `dragenter`,
 * `dragover`, `dragleave`, `drop`, `dragend`), com um `DataTransfer` de
 * verdade, aos mesmos ouvintes de sempre. A mochila, o equipamento, o
 * depósito, a lixeira, a barra de ações e o mapa não souberam da troca.
 *
 * O toque (celular) continua com o arrasto do navegador: lá o gesto é outro, e
 * o report é de mouse.
 *
 * Ver `sonda-arrasto-do-mouse`.
 */

/* Quantos pixels o mouse anda apertado antes de virar arrasto, e não clique. */
const LIMIAR = 4;

let tipoDoPonteiro = 'mouse';
let aperto = null;
let arrasto = null;
let engolirClique = false;

const editavel = (no) => !!no?.closest?.('input, textarea, select, [contenteditable="true"]');

function origemDoAperto(evento) {
  if (evento.button !== 0 || tipoDoPonteiro === 'touch') return null;
  if (evento.sourceCapabilities?.firesTouchEvents) return null;
  if (editavel(evento.target)) return null;
  return evento.target?.closest?.('[draggable="true"]') ?? null;
}

function dragEvent(tipo, base, dataTransfer, cancelavel = true) {
  return new DragEvent(tipo, {
    bubbles: true,
    cancelable: cancelavel,
    composed: true,
    clientX: base.clientX,
    clientY: base.clientY,
    screenX: base.screenX,
    screenY: base.screenY,
    shiftKey: !!base.shiftKey,
    ctrlKey: !!base.ctrlKey,
    altKey: !!base.altKey,
    metaKey: !!base.metaKey,
    button: 0,
    buttons: base.buttons ?? 0,
    dataTransfer,
  });
}

/*
 * Uma cópia que se possa pintar: `cloneNode` copia o canvas VAZIO, e quase todo
 * item deste jogo é desenhado num canvas.
 */
function copiaPintada(no) {
  const copia = no.cloneNode(true);
  const originais = no instanceof HTMLCanvasElement ? [no] : [...no.querySelectorAll('canvas')];
  const copias = copia instanceof HTMLCanvasElement ? [copia] : [...copia.querySelectorAll('canvas')];
  originais.forEach((original, i) => {
    try {
      copias[i]?.getContext('2d')?.drawImage(original, 0, 0);
    } catch {
      /* canvas sem pixels ainda: o fantasma sai sem aquele pedaço */
    }
  });
  return copia;
}

function criarFantasma(imagem, origem, evento) {
  const fonte = imagem?.no ?? origem;
  const caixa = fonte.getBoundingClientRect();
  const fantasma = copiaPintada(fonte);
  fantasma.classList?.remove('dragging', 'drop-target');
  fantasma.classList?.add('fantasma-do-arrasto');
  fantasma.removeAttribute?.('id');
  const largura = imagem ? fonte.width || caixa.width : caixa.width;
  const altura = imagem ? fonte.height || caixa.height : caixa.height;
  Object.assign(fantasma.style, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: `${largura}px`,
    height: `${altura}px`,
    margin: '0',
    pointerEvents: 'none',
    zIndex: '2147483647',
    opacity: '0.85',
    transform: 'none',
  });
  const dx = imagem ? imagem.x : evento.clientX - caixa.left;
  const dy = imagem ? imagem.y : evento.clientY - caixa.top;
  document.body.append(fantasma);
  return { fantasma, dx, dy };
}

function moverFantasma(evento) {
  if (!arrasto?.fantasma) return;
  arrasto.fantasma.style.left = `${Math.round(evento.clientX - arrasto.dx)}px`;
  arrasto.fantasma.style.top = `${Math.round(evento.clientY - arrasto.dy)}px`;
}

function comecar(evento) {
  const { origem, inicio } = aperto;
  aperto = null;
  if (!origem.isConnected) return;

  const dataTransfer = new DataTransfer();
  let imagem = null;
  /*
   * O mapa troca o fantasma pelo sprite da peça (`setDragImage`) e tira o nó da
   * tela logo depois: a cópia tem de ser feita AGORA, dentro do `dragstart`.
   */
  dataTransfer.setDragImage = (no, x, y) => {
    if (no instanceof Element) imagem = { no: copiaPintada(no), x: Number(x) || 0, y: Number(y) || 0 };
  };
  const inicial = dragEvent('dragstart', { ...inicio, buttons: 1 }, dataTransfer);
  origem.dispatchEvent(inicial);
  if (inicial.defaultPrevented) return;

  /* A cópia do `setDragImage` está fora do documento: entra só para ser medida. */
  if (imagem) document.body.append(imagem.no);
  const { fantasma, dx, dy } = criarFantasma(imagem, origem, inicio);
  imagem?.no?.remove();

  arrasto = { origem, dataTransfer, fantasma, dx, dy, alvo: null, aceitou: false };
  document.documentElement.classList.add('arrastando-item');
  sobre(evento);
}

function sobre(evento) {
  moverFantasma(evento);
  const alvo = document.elementFromPoint(evento.clientX, evento.clientY);
  if (alvo !== arrasto.alvo) {
    if (arrasto.alvo?.isConnected) arrasto.alvo.dispatchEvent(dragEvent('dragleave', evento, arrasto.dataTransfer, false));
    alvo?.dispatchEvent(dragEvent('dragenter', evento, arrasto.dataTransfer));
    arrasto.alvo = alvo;
  }
  if (arrasto.origem.isConnected) arrasto.origem.dispatchEvent(dragEvent('drag', evento, arrasto.dataTransfer));
  arrasto.dataTransfer.dropEffect = 'none';
  const passando = dragEvent('dragover', evento, arrasto.dataTransfer);
  alvo?.dispatchEvent(passando);
  arrasto.aceitou = !!alvo && passando.defaultPrevented;
}

function terminar(evento, soltou) {
  const atual = arrasto;
  arrasto = null;
  document.documentElement.classList.remove('arrastando-item');
  atual.fantasma?.remove();

  if (soltou && atual.aceitou && atual.alvo?.isConnected) {
    atual.alvo.dispatchEvent(dragEvent('drop', evento, atual.dataTransfer));
  } else {
    if (atual.alvo?.isConnected) atual.alvo.dispatchEvent(dragEvent('dragleave', evento, atual.dataTransfer, false));
    atual.dataTransfer.dropEffect = 'none';
  }
  /*
   * A célula de origem pode ter sido refeita no meio do gesto; o `dragend` tem
   * de chegar ao `window` mesmo assim, porque é lá que a mochila espera por ele.
   */
  const fim = dragEvent('dragend', evento, atual.dataTransfer, false);
  (atual.origem.isConnected ? atual.origem : document).dispatchEvent(fim);
}

export function instalarArrastoDoMouse() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (typeof DataTransfer !== 'function' || typeof DragEvent !== 'function') return;

  window.addEventListener('pointerdown', (evento) => (tipoDoPonteiro = evento.pointerType || 'mouse'), true);

  window.addEventListener(
    'mousedown',
    (evento) => {
      const origem = origemDoAperto(evento);
      if (!origem) return;
      /* Sem isto o navegador abre o arrasto dele. */
      evento.preventDefault();
      aperto = {
        origem,
        chegouAoFim: false,
        inicio: {
          clientX: evento.clientX,
          clientY: evento.clientY,
          screenX: evento.screenX,
          screenY: evento.screenY,
          shiftKey: evento.shiftKey,
          ctrlKey: evento.ctrlKey,
          altKey: evento.altKey,
          metaKey: evento.metaKey,
        },
      };
      /*
       * O `preventDefault` também segura o FOCO: apertar numa peça não tirava
       * mais o cursor do chat. Isso é o que o shift+clique para o chat quer (e
       * ele para a propagação), e é o contrário do que todo o resto quer. Então
       * o foco sai como sairia sem nós — a não ser que alguém tenha parado o
       * evento no caminho.
       */
      const esteAperto = aperto;
      setTimeout(() => {
        if (!esteAperto.chegouAoFim) return;
        const ativo = document.activeElement;
        if (ativo && ativo !== document.body && editavel(ativo) && !origem.contains(ativo)) ativo.blur();
      }, 0);
    },
    true
  );
  window.addEventListener('mousedown', () => {
    if (aperto) aperto.chegouAoFim = true;
  });

  window.addEventListener(
    'mousemove',
    (evento) => {
      if (arrasto) {
        /* Botão solto fora da janela: o `mouseup` nunca veio. */
        if (!(evento.buttons & 1)) return terminar(evento, false);
        return sobre(evento);
      }
      if (!aperto) return;
      if (!(evento.buttons & 1)) {
        aperto = null;
        return;
      }
      const andou = Math.hypot(evento.clientX - aperto.inicio.clientX, evento.clientY - aperto.inicio.clientY);
      if (andou > LIMIAR) comecar(evento);
    },
    true
  );

  window.addEventListener(
    'mouseup',
    (evento) => {
      aperto = null;
      if (!arrasto || evento.button !== 0) return;
      sobre(evento);
      terminar(evento, true);
      /* O arrasto do navegador não termina em clique; o nosso também não. */
      engolirClique = true;
      setTimeout(() => (engolirClique = false), 0);
    },
    true
  );

  window.addEventListener(
    'click',
    (evento) => {
      if (!engolirClique) return;
      engolirClique = false;
      evento.preventDefault();
      evento.stopImmediatePropagation();
    },
    true
  );

  const cancelar = (evento) => {
    aperto = null;
    if (arrasto) terminar(evento ?? {}, false);
  };
  window.addEventListener('blur', () => cancelar({ clientX: 0, clientY: 0 }));
  window.addEventListener(
    'keydown',
    (evento) => {
      if (evento.key === 'Escape' && arrasto) cancelar(evento);
    },
    true
  );
}
