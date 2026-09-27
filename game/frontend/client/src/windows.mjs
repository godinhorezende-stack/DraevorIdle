// Janelas flutuantes: arrastar pelo título, redimensionar pelo canto,
// e posição/tamanho guardados por jogador no navegador.

const STORE_KEY = 'ravox:windows';
// O arranjo que o jogador guardou como o dele. É o que o botão de reorganizar
// devolve; sem nada guardado, ele cai no arranjo de fábrica.
const PRESET_KEY = 'ravox:windows-preset';

/*
 * Versão do arranjo de fábrica.
 *
 * O que o jogador arrastou fica guardado e ganha do padrão — é o certo. Só que
 * uma mudança de tamanho no padrão (janelas mais largas, por exemplo) nunca
 * chegava em quem já tinha mexido, e a diferença passava por engano. Subir este
 * número descarta o guardado uma vez: o jogador vê o arranjo novo e a partir
 * dali manda de novo.
 */
const LAYOUT_VERSION = 11;
const VERSION_KEY = 'ravox:windows-version';

const layout = (() => {
  try {
    const versao = Number(localStorage.getItem(VERSION_KEY) ?? 0);
    if (versao !== LAYOUT_VERSION) {
      localStorage.removeItem(STORE_KEY);
      localStorage.setItem(VERSION_KEY, String(LAYOUT_VERSION));
      return {};
    }
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
  } catch {
    return {};
  }
})();

const save = () => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(layout));
  } catch {
    /* modo privado: segue sem persistir */
  }
};

const registry = new Map();

/*
 * ---- A faixa de empilhamento das janelas ----
 *
 * `bringToFront` incrementava um contador SEM TETO a cada `pointerdown` numa
 * janela. Depois de umas três dezenas de cliques — o que acontece em poucos
 * minutos de jogo — o z-index das janelas passava de 30 (a topbar), de 50 (o
 * modal) e de 55 (a caixa de confirmação). A partir dali o inventário ficava
 * POR CIMA da confirmação de destruir item, e a caixinha "não perguntar
 * novamente" simplesmente não recebia o clique: o que estava embaixo do cursor
 * era a janela, não a caixa. Era um defeito que só aparecia depois de um tempo
 * de uso, e por isso parecia aleatório.
 *
 * Agora a faixa é fechada. Quando o topo chega no teto, os z-index são
 * reescritos de 10 para cima NA ORDEM ATUAL — a pilha continua exatamente a
 * mesma, só volta a caber — e o contador recomeça. As janelas nunca alcançam a
 * topbar, o modal nem a confirmação.
 */
const Z_PISO = 10;
const Z_TETO = 29;
let topZ = Z_PISO;

/** Reescreve os z-index de 10 para cima, mantendo a ordem em que estão. */
function reempilhar() {
  const janelas = [...document.querySelectorAll('.window')].sort(
    (a, b) => (Number(a.style.zIndex) || Z_PISO) - (Number(b.style.zIndex) || Z_PISO)
  );
  topZ = Z_PISO;
  for (const janela of janelas) {
    if (topZ >= Z_TETO) break;
    janela.style.zIndex = String(++topZ);
  }
}

/*
 * A moldura tem margem transparente, e a janela pode passar dela.
 *
 * `padrao.png` é 1362x1155 e o ornamento começa só depois de 47px vazios à
 * esquerda e à direita, 45 em cima e 51 embaixo — medido lendo o alfa da arte.
 * Essas margens entram nas fatias de nove pedaços e encolhem junto com elas:
 *
 *   esquerda/direita  47 x (22/110) = 9px
 *   topo              45 x (36/150) = 11px
 *   base              51 x (24/130) = 9px
 *
 * Ou seja, com a caixa encostada em `left: 0` o desenho ainda começava 9px para
 * dentro. Era esse o "não dá para chegar no canto": a janela chegava, o
 * ornamento não. Deixando a caixa passar exatamente o tamanho do vazio, o
 * ornamento é que encosta — e nada de verdade sai da tela.
 */
const MOLDURA_VAZIA = { esquerda: 9, direita: 9, topo: 11, base: 9 };

/*
 * Onde a área de jogo começa: o rodapé da topbar.
 *
 * A barra é `fixed` com z-index 30 e as janelas começam em 20, então uma janela
 * arrastada para cima some ATRÁS dela — e some de vez: o cabeçalho, que é a
 * alça do arrasto, fica coberto e não há como puxá-la de volta. O limite é
 * medido da barra e não escrito à mão para não descolar quando a altura dela
 * mudar (já mudou uma vez, de 52 para 62px).
 */
function topoUtil() {
  const barra = document.getElementById('topbar');
  return barra ? Math.round(barra.getBoundingClientRect().bottom) : 0;
}

function clampToViewport(node) {
  const rect = node.getBoundingClientRect();
  const minLeft = -MOLDURA_VAZIA.esquerda;
  // Desconta a margem vazia da moldura: assim quem encosta na barra é o
  // ornamento desenhado, do mesmo jeito que acontece nas outras três bordas.
  const minTop = topoUtil() - MOLDURA_VAZIA.topo;
  const maxLeft = Math.max(minLeft, window.innerWidth - rect.width + MOLDURA_VAZIA.direita);
  const maxTop = Math.max(minTop, window.innerHeight - rect.height + MOLDURA_VAZIA.base);
  node.style.left = `${Math.min(Math.max(minLeft, node.offsetLeft), maxLeft)}px`;
  node.style.top = `${Math.min(Math.max(minTop, node.offsetTop), maxTop)}px`;
}

/**
 * Cria uma janela flutuante.
 * `defaults` aceita left/top/right/bottom/width/height — âncoras à direita e
 * embaixo são convertidas para coordenadas assim que a janela aparece.
 */
export function createWindow({ id, title, defaults = {}, resizable = true, onClose }) {
  const node = document.createElement('section');
  node.className = 'window';
  node.dataset.windowId = id;
  /*
   * De que lado ela encosta no telefone DEITADO. Sai do arranjo de mesa: quem
   * o dono ancorou à direita (a bolsa, o analisador, a mochila) fica na coluna
   * da direita, e quem ele ancorou à esquerda (o chat, a party) na da
   * esquerda. Ver `soUmaGaveta` e a regra `--gaveta-em-coluna` no style.css.
   */
  node.dataset.lado = defaults.right != null ? 'dir' : 'esq';

  const header = document.createElement('header');
  const heading = document.createElement('h2');
  heading.textContent = title;
  const minimize = document.createElement('button');
  minimize.className = 'window-min';
  minimize.type = 'button';
  minimize.textContent = '—';
  minimize.title = 'minimizar';

  /*
   * A engrenagem: tudo que é sobre arranjo de janelas mora aqui.
   *
   * Antes eram três coisas em dois lugares — voltar ao tamanho era um botão em
   * cada janela, e salvar/reorganizar eram dois ícones perdidos na barra de
   * cima, longe das janelas de que falavam. Todas as três dizem respeito a
   * janela, então todas as três abrem a partir da janela.
   */
  const resetSize = document.createElement('button');
  resetSize.className = 'window-reset';
  resetSize.type = 'button';
  resetSize.textContent = '⚙';
  resetSize.title = 'arranjo das janelas';

  const close = document.createElement('button');
  close.className = 'window-close';
  close.type = 'button';
  close.textContent = '✕';
  close.title = 'fechar';
  header.append(heading, resetSize, minimize, close);

  const body = document.createElement('div');
  body.className = 'window-body';

  node.append(header, body);

  document.body.append(node);
  applyLayout(node, id, defaults);
  bindDrag(node, header, id);

  node.addEventListener('pointerdown', () => bringToFront(node), true);
  close.addEventListener('click', () => {
    setVisible(id, false);
    onClose?.();
  });
  minimize.addEventListener('click', (event) => {
    event.stopPropagation();
    setMinimized(id, !node.classList.contains('minimized'));
  });
  // Duplo clique no título encolhe a janela, como no client — no título, não
  // em cima de um botão: dois cliques na engrenagem são dois cliques, não um
  // pedido para minimizar.
  header.addEventListener('dblclick', (event) => {
    if (event.target.closest('button')) return;
    setMinimized(id, !node.classList.contains('minimized'));
  });

  const entry = { node, body, header, heading, defaults };

  if (resizable) {
    /*
     * ---- As oito bordas ----
     *
     * Havia UM punho, no canto de baixo à direita, e ele só sabia crescer para
     * a direita e para baixo. Quem quisesse mais chat para cima tinha de
     * esticar para baixo e depois arrastar a janela inteira de volta — dois
     * gestos para uma vontade só. E uma janela encostada na borda direita da
     * tela simplesmente não crescia mais.
     *
     * Agora as quatro bordas e os quatro cantos puxam, como em qualquer janela
     * de sistema. O canto de baixo à direita continua sendo o único DESENHADO
     * (as três listras de sempre): ele é a pista visual de que a janela estica,
     * e as outras sete se anunciam do jeito que essas coisas se anunciam há
     * trinta anos — o cursor muda quando o ponteiro chega perto.
     */
    for (const lado of Object.keys(LADOS)) {
      const punho = document.createElement('div');
      // O `se` herda a arte antiga; os outros sete são faixas invisíveis.
      punho.className = lado === 'se' ? 'window-grip' : 'window-lado';
      punho.dataset.lado = lado;
      punho.title = 'redimensionar';
      node.append(punho);
      bindResize(node, punho, lado, id, entry);
    }
    resetSize.addEventListener('click', (event) => {
      event.stopPropagation();
      // Clicar de novo fecha. Sem isto o `fechar` global removia o menu no
      // `pointerdown` e este `click` o reabria em seguida: ele parecia preso
      // aberto, e nenhum clique na engrenagem dava conta de sumir com ele.
      const aberto = document.querySelector('.window-menu');
      if (aberto?.dataset.dono === id) return void aberto.remove();
      abrirMenu(resetSize, entry, id);
    });
  } else {
    // Sem alça não há tamanho para desfazer, e o botão só ocuparia o canto.
    node.classList.add('fixed-size');
    resetSize.remove();
  }
  markResized(entry);

  registry.set(id, entry);
  // `hidden` do arranjo de fábrica só vale para quem nunca mexeu nas janelas:
  // depois disso quem manda é o que ficou guardado.
  node.hidden = layout[id] ? !!layout[id].hidden : !!defaults.hidden;
  /*
   * O arranjo é aplicado direto aqui, sem passar pelo `setVisible` — então a
   * regra de uma gaveta por vez precisa valer aqui também, senão o jogo ABRE
   * com as quatro empilhadas e só se desempilha no primeiro toque.
   *
   * Fica a primeira que o arranjo mandava abrir, e as outras esperam o botão.
   */
  const jaHaUmaAberta = [...registry.entries()].some(
    ([outro, e]) => outro !== id && !e.node.hidden && faixaDa(e.node) === faixaDa(node)
  );
  if (!node.hidden && emGaveta() && jaHaUmaAberta) node.hidden = true;
  marcarGavetaAberta();
  if (layout[id]?.minimized) applyMinimized(entry, true);
  return entry;
}

function applyLayout(node, id, defaults) {
  const saved = layout[id] ?? {};
  const width = saved.width ?? defaults.width;
  const height = saved.height ?? defaults.height;
  if (width) node.style.width = `${width}px`;
  if (height) node.style.height = `${height}px`;

  if (saved.left != null) {
    node.style.left = `${saved.left}px`;
    node.style.top = `${saved.top}px`;
    return;
  }

  // Primeira abertura: resolve as âncoras contra o tamanho da tela.
  const w = width ?? 260;
  const h = height ?? 240;
  const left = defaults.right != null ? window.innerWidth - defaults.right - w : defaults.left ?? 16;
  const top = defaults.bottom != null ? window.innerHeight - defaults.bottom - h : defaults.top ?? 70;
  node.style.left = `${Math.max(0, left)}px`;
  node.style.top = `${Math.max(0, top)}px`;
}

function bringToFront(node) {
  if (topZ >= Z_TETO) reempilhar();
  node.style.zIndex = String(++topZ);
}

function bindDrag(node, handle, id) {
  handle.addEventListener('pointerdown', (event) => {
    /*
     * Nenhum botao do cabecalho arrasta a janela - e nao e so uma questao de
     * gesto: o arrasto chamava `setPointerCapture` no cabecalho, e a partir dai
     * o `pointerup` era entregue ao cabecalho, nao ao botao. O navegador entao
     * dispara o `click` no ancestral comum dos dois, que e o proprio cabecalho.
     * O clique na engrenagem nunca chegava nela, e dois cliques seguidos viravam
     * um `dblclick` no cabecalho - que minimiza. Era por isso que abrir o
     * arranjo das janelas encolhia a bolsa.
     *
     * Antes so o fechar escapava daqui, porque so ele tinha sido testado.
     */
    if (event.target.closest('button')) return;
    event.preventDefault();
    // Alguns ponteiros (caneta que solta cedo, evento sintético de teste) já
    // não existem quando o captura chega; sem a rede o arrasto morria aqui.
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* segue sem captura: os listeners no próprio elemento dão conta */
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const originLeft = node.offsetLeft;
    const originTop = node.offsetTop;
    node.classList.add('dragging');

    const move = (moveEvent) => {
      node.style.left = `${originLeft + moveEvent.clientX - startX}px`;
      node.style.top = `${originTop + moveEvent.clientY - startY}px`;
      /*
       * Limita durante o arrasto, e não só ao soltar.
       *
       * Soltando é tarde: a janela vai até debaixo da barra e volta com um
       * pulo. Presa no limite, ela para na borda e fica claro que ali é o fim.
       * O passo seguinte continua saindo de `originTop + delta`, então a janela
       * não fica para trás quando o ponteiro volta para dentro.
       */
      clampToViewport(node);
    };
    const done = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', done);
      node.classList.remove('dragging');
      clampToViewport(node);
      layout[id] = { ...layout[id], left: node.offsetLeft, top: node.offsetTop };
      save();
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', done);
  });
}


/*
 * Redimensionar pela alça do canto — nos dois sentidos.
 *
 * A moldura de nove fatias estica sem esgarçar (os cantos ficam intactos e só
 * as bordas retas crescem), então dá para deixar a bolsa larga o quanto o
 * jogador quiser. O piso existe só para a janela não virar um selo: abaixo dele
 * o cabeçalho já não cabe entre os ornamentos dos cantos.
 */
const MIN_WIDTH = 200;
const MIN_HEIGHT = 120;

/*
 * Para que lado cada punho puxa.
 *
 * O par é [x, y] e só admite três valores: `1` quer dizer "esta é a borda da
 * direita (ou de baixo)", `-1` quer dizer "é a da esquerda (ou de cima)" e `0`
 * quer dizer que este punho não mexe nesse eixo.
 *
 * O sinal é o que faz a conta funcionar sozinha para os oito, sem um `if` por
 * lado: puxar a borda direita para a direita aumenta (dx positivo, dirX 1);
 * puxar a esquerda para a esquerda também aumenta (dx negativo, dirX -1), e
 * `dirX * dx` dá positivo nos dois casos.
 */
const LADOS = {
  n: [0, -1],
  s: [0, 1],
  w: [-1, 0],
  e: [1, 0],
  ne: [1, -1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [-1, 1],
};

function bindResize(node, grip, lado, id, entry) {
  const [dirX, dirY] = LADOS[lado];
  grip.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      grip.setPointerCapture(event.pointerId);
    } catch {
      /* idem: sem captura o redimensionar ainda funciona */
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = node.offsetWidth;
    const startHeight = node.offsetHeight;
    // Só as bordas de cima e da esquerda precisam disto: nelas a janela cresce
    // para trás, e o canto oposto é que tem de ficar parado.
    const startLeft = node.offsetLeft;
    const startTop = node.offsetTop;
    node.classList.add('sizing');

    const move = (moveEvent) => {
      if (dirX) {
        const largura = Math.max(MIN_WIDTH, startWidth + dirX * (moveEvent.clientX - startX));
        node.style.width = `${largura}px`;
        /*
         * Puxando pela ESQUERDA, a borda direita não pode andar.
         *
         * Como a janela é posicionada por `left`, crescer para a esquerda é
         * crescer a largura E recuar o `left` na mesma medida. A diferença sai
         * da largura JÁ limitada pelo mínimo — usar o `dx` cru faria a janela
         * continuar deslizando depois de ela ter parado de encolher.
         */
        if (dirX < 0) node.style.left = `${startLeft + (startWidth - largura)}px`;
      }
      if (dirY) {
        const altura = Math.max(MIN_HEIGHT, startHeight + dirY * (moveEvent.clientY - startY));
        node.style.height = `${altura}px`;
        if (dirY < 0) node.style.top = `${startTop + (startHeight - altura)}px`;
      }
    };
    const done = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', done);
      node.classList.remove('sizing');
      clampToViewport(node);
      layout[id] = {
        ...layout[id],
        width: node.offsetWidth,
        height: node.offsetHeight,
        left: node.offsetLeft,
        top: node.offsetTop,
      };
      save();
      markResized(entry);
    };

    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', done);
  });
}

/** O botão de voltar ao padrão só acende quando há padrão para voltar. */
function markResized(entry) {
  const { node, defaults } = entry;
  const mudou =
    (defaults.width && node.offsetWidth !== defaults.width) ||
    (defaults.height && !node.classList.contains('minimized') && node.offsetHeight !== defaults.height);
  node.classList.toggle('resized', !!mudou);
}

/*
 * Quem avisa o jogador. `main.mjs` empresta o seu `notice` — o menu daqui
 * precisa dizer quantas janelas foram guardadas, e este módulo não conhece a
 * tela.
 */
let avisar = () => {};
export const setNotice = (fn) => (avisar = fn);

/** O menuzinho da engrenagem, ancorado no botão que o abriu. */
function abrirMenu(botao, entry, id) {
  document.querySelector('.window-menu')?.remove();

  const menu = document.createElement('div');
  menu.className = 'window-menu';
  menu.dataset.dono = id;

  const item = (texto, dica, acao) => {
    const linha = document.createElement('button');
    linha.type = 'button';
    linha.textContent = texto;
    linha.title = dica;
    linha.onclick = (event) => {
      event.stopPropagation();
      menu.remove();
      acao();
    };
    menu.append(linha);
    return linha;
  };

  item('Salvar posições das janelas', 'Guarda onde cada janela está agora', () => {
    const quantas = savePreset();
    avisar(`Arranjo salvo com ${quantas} janelas.`);
  });

  item(
    'Reorganizar janelas',
    hasPreset() ? 'Volta para o arranjo que você guardou' : 'Volta para o arranjo de fábrica',
    () => {
      resetLayout();
      avisar(hasPreset() ? 'Janelas de volta ao seu arranjo.' : 'Janelas de volta ao arranjo de fábrica.');
    }
  );

  if (hasPreset()) {
    item('Apagar o arranjo salvo', 'O reorganizar volta a usar o de fábrica', () => {
      clearPreset();
      avisar('Arranjo apagado — o reorganizar volta ao de fábrica.');
    });
  }

  const voltar = item('Voltar ao tamanho padrão', 'Só desta janela, sem mexer no lugar dela', () =>
    restoreSize(entry, id)
  );
  voltar.disabled = !entry.node.classList.contains('resized');

  const caixa = botao.getBoundingClientRect();
  menu.style.left = `${Math.round(caixa.left)}px`;
  menu.style.top = `${Math.round(caixa.bottom + 6)}px`;
  document.body.append(menu);

  // Encosta na direita da tela? Puxa para dentro.
  const meu = menu.getBoundingClientRect();
  if (meu.right > window.innerWidth - 8) {
    menu.style.left = `${Math.round(window.innerWidth - meu.width - 8)}px`;
  }

  /*
   * O botão que abriu escapa do fechar automático.
   *
   * Sem isto o `pointerdown` no próprio botão removia o menu, e o `click` que
   * vem logo atrás o reabria: ele parecia grudado, e nenhum clique no botão
   * dava conta de fechá-lo. Deixando o menu de pé aqui, quem fecha é a guarda
   * do próprio `click`, que é onde alternar faz sentido.
   */
  const fechar = (event) => {
    if (menu.contains(event.target) || botao.contains(event.target)) return;
    menu.remove();
    document.removeEventListener('pointerdown', fechar, true);
  };
  setTimeout(() => document.addEventListener('pointerdown', fechar, true), 0);
}

/** Devolve o tamanho desenhado, sem mexer em onde a janela está. */
function restoreSize(entry, id) {
  const { node, defaults } = entry;
  node.style.width = defaults.width ? `${defaults.width}px` : '';
  node.style.height = defaults.height ? `${defaults.height}px` : '';
  clampToViewport(node);
  layout[id] = {
    ...layout[id],
    width: defaults.width,
    height: defaults.height,
    left: node.offsetLeft,
    top: node.offsetTop,
  };
  save();
  markResized(entry);
}

function applyMinimized(entry, minimized) {
  const { node } = entry;
  node.classList.toggle('minimized', minimized);
  if (minimized) {
    // Guarda a altura para restaurar depois; o corpo some, o cabeçalho fica.
    entry.restoreHeight = node.style.height || `${node.offsetHeight}px`;
    node.style.height = '';
  } else if (entry.restoreHeight) {
    node.style.height = entry.restoreHeight;
  }
  node.querySelector('.window-min').textContent = minimized ? '▢' : '—';
  markResized(entry);
}

export function setMinimized(id, minimized) {
  const entry = registry.get(id);
  if (!entry) return;
  applyMinimized(entry, minimized);
  layout[id] = { ...layout[id], minimized };
  save();
}

/*
 * ---- Abrir tem de APARECER ----
 *
 * Isto era só `hidden = false`, e havia dois jeitos de a janela "abrir" sem
 * aparecer — os dois chegaram como report de janela que não abre:
 *
 *   1. ela estava guardada FORA da tela. Quem mudou de monitor, girou o tablet
 *      ou só encolheu o navegador tem posições gravadas de uma tela maior; o
 *      `hidden` saía e a janela ia existir a mil pixels da borda direita.
 *
 *   2. ela estava MINIMIZADA. Aí aparecia uma tira de título de 20px no meio da
 *      pilha de janelas — que é, para quem clicou, a mesma coisa que nada.
 *
 * Nenhum dos dois é um estado que alguém queira ao clicar em "abrir": clicar
 * para abrir é pedir para VER. O clamp só roda com a janela já visível, senão
 * mediria um retângulo de tamanho zero (`display: none`) e a encostaria no
 * canto de cima à esquerda.
 */
/*
 * ---- Quem quer ser avisado quando a janela ABRE ----
 *
 * Uma janela que só desenha aberta precisa de um empurrão no instante em que
 * ela abre — senão ela aparece vazia e só se enche no próximo estado que vier
 * do servidor. Na caçada isso seriam 125ms; parado na cidade, pode ser bem
 * mais, e o jogador vê uma janela em branco.
 *
 * Ele existe por causa do analisador (ver `renderAnalyzer`, no main.mjs), mas
 * nasce geral de propósito: toda janela que passar a economizar enquanto está
 * fechada vai precisar exatamente disto, e a alternativa é cada uma pendurar a
 * si mesma no clique do botão da barra — em três lugares diferentes, porque há
 * três jeitos de abrir uma janela (o botão, o atalho e o arranjo guardado).
 */
const aoAbrirJanela = new Map();
export const quandoAbrir = (id, fn) => aoAbrirJanela.set(id, fn);

/*
 * ---- No CELULAR, UMA gaveta por vez ----
 *
 * "ficou tudo amontoado."
 *
 * Numa tela de telefone toda janela vira a mesma gaveta — o CSS prende as
 * quatro em `left: 6px; right: 6px; bottom: barra + 8`, ver a regra de
 * `--e-celular` no style.css. Isso é o certo para UMA janela e é um empilhamento
 * para quatro: o jogo abre chat, loot, mochila e analisador, e as quatro caem no
 * mesmo retângulo, uma por cima da outra, com o texto de todas misturado.
 *
 * Numa tela de mesa elas ficam lado a lado e nada disso acontece — por isso o
 * defeito só existe no telefone, e por isso a regra só vale nele.
 *
 * ---- E ela NÃO é gravada ----
 *
 * O arranjo (`layout`) é o mesmo nos dois lugares. Se fechar a gaveta de baixo
 * gravasse "escondida", quem abrisse o jogo no telefone e voltasse ao
 * computador encontraria as janelas dele fechadas — o telefone teria decidido
 * pela tela grande. Então aqui o que muda é só o `hidden` do nó e a marca do
 * botão; o que a pessoa escolheu continua guardado como estava.
 */
const emGaveta = () => {
  try {
    return globalThis.getComputedStyle(globalThis.document.documentElement)
      .getPropertyValue('--e-celular').trim() === '1';
  } catch {
    return false;
  }
};

/*
 * ---- DEITADO, a faixa não é o rodapé: é o LADO ----
 *
 * "deixa o celular pra ficar igual as fotos."
 *
 * Nas fotos da base do dono (o Ravera, que é OTClient) o telefone deitado tem
 * os painéis encostados nas DUAS BORDAS e o mapa inteiro no meio. Aqui eles
 * eram uma gaveta no rodapé: com a mochila aberta, a metade de baixo da tela
 * virava janela e o personagem ficava atrás dela.
 *
 * Deitado sobra LARGURA e falta altura — exatamente o contrário do telefone em
 * pé. Então as janelas viram duas colunas de borda, uma de cada lado, e o meio
 * fica sendo o jogo.
 *
 * ---- E por isso "uma por vez" passa a ser "uma POR LADO" ----
 *
 * A regra de uma gaveta por vez existe porque as janelas dividiam o MESMO
 * retângulo. Em colunas, a da esquerda e a da direita não disputam nada: fechar
 * o chat ao abrir a mochila seria fechar uma janela que não estava no caminho —
 * e é justamente o arranjo da foto, chat de um lado e bolsa do outro.
 *
 * De qual lado cada uma cai sai do arranjo de mesa (`defaults.right` ou
 * `defaults.left`), escrito no `data-lado` quando a janela nasce: é a mesma
 * escolha que o dono já fez para a tela grande, e não uma segunda lista para
 * manter de acordo com a primeira.
 */
const emColunas = () => {
  try {
    return globalThis.getComputedStyle(globalThis.document.documentElement)
      .getPropertyValue('--gaveta-em-coluna').trim() === '1';
  } catch {
    return false;
  }
};

/** Que espaço esta janela ocupa: um dos lados, deitado; o rodapé, em pé. */
const faixaDa = (no) => (emColunas() ? no?.dataset.lado ?? 'dir' : 'rodape');

/** Esconde as outras gavetas DA MESMA FAIXA, sem tocar no arranjo guardado. */
function soUmaGaveta(id) {
  const minha = faixaDa(registry.get(id)?.node);
  for (const [outro, entry] of registry) {
    if (outro === id || entry.node.hidden) continue;
    if (faixaDa(entry.node) !== minha) continue;
    entry.node.hidden = true;
    document.querySelector(`[data-toggle="${outro}"]`)?.setAttribute('aria-selected', 'false');
  }
}

/*
 * Marca no corpo que há uma gaveta aberta.
 *
 * Quem lê é o CSS: o aviso de presente e os ícones de buff flutuam no mesmo
 * pedaço de tela que a gaveta ocupa, e precisam subir acima dela — ver
 * `body.com-gaveta` no style.css. Não dá para o CSS descobrir isso sozinho:
 * eles não são irmãos da janela nem filhos dela.
 */
function marcarGavetaAberta() {
  const corpo = globalThis.document?.body;
  if (!corpo) return;
  corpo.classList.toggle('com-gaveta', [...registry.values()].some((e) => !e.node.hidden));
}

export function setVisible(id, visible) {
  const entry = registry.get(id);
  if (!entry) return;
  const estavaFechada = entry.node.hidden;
  entry.node.hidden = !visible;
  if (visible) {
    if (entry.node.classList.contains('minimized')) setMinimized(id, false);
    clampToViewport(entry.node);
    bringToFront(entry.node);
    // No telefone, abrir uma fecha as outras: elas dividem o mesmo retângulo.
    if (emGaveta()) soUmaGaveta(id);
    marcarGavetaAberta();
    // Só na TRANSIÇÃO: `setVisible(id, true)` numa janela já aberta (o
    // `bringToFront` de um clique, por exemplo) não é motivo para redesenhar.
    if (estavaFechada) aoAbrirJanela.get(id)?.();
  }
  if (!visible) marcarGavetaAberta();
  layout[id] = { ...layout[id], hidden: !visible };
  save();
  document.querySelector(`[data-toggle="${id}"]`)?.setAttribute('aria-selected', String(visible));
}

export function toggleWindow(id) {
  const entry = registry.get(id);
  if (entry) setVisible(id, entry.node.hidden);
}

export const windowBody = (id) => registry.get(id)?.body;

/*
 * ---- UM BOTAO PROPRIO DA JANELA, COLADO NA ENGRENAGEM ----
 *
 * "ao lado da engrenagem um botao de reorganizar."
 *
 * A engrenagem fala do ARRANJO DAS JANELAS e e' igual em todas; este e' o
 * contrario — e' da janela que o pede, e so' dela. Por isso ele nao entra em
 * `createWindow` junto dos outros tres: nascer em toda janela poria um
 * "Organizar" no chat e no mapa.
 *
 * Nasce UMA vez e sobrevive aos retratos: o corpo da janela e' reescrito a cada
 * loot, e o cabecalho nao. A classe e' a identidade dele — pedir duas vezes
 * devolve o mesmo botao, com o clique novo por cima.
 *
 * Devolve `null` quando a janela ainda nao existe, e quem chama pode ignorar:
 * o proximo retrato acontece com ela de pe'.
 */
export function botaoNoCabecalho(id, { classe, texto, titulo, aoClicar, desligado = false }) {
  const cabecalho = registry.get(id)?.node?.querySelector('header');
  if (!cabecalho) return null;
  let botao = cabecalho.querySelector(`button.${classe}`);
  if (!botao) {
    botao = document.createElement('button');
    botao.className = classe;
    botao.type = 'button';
    // Antes da engrenagem: os tres botoes da direita (arranjo, minimizar,
    // fechar) sao a mesma trinca em toda janela, e furar o meio dela faria a
    // mao errar o "fechar" de uma janela para a outra.
    cabecalho.insertBefore(botao, cabecalho.querySelector('.window-reset'));
  }
  botao.textContent = texto;
  botao.title = titulo;
  botao.disabled = desligado;
  botao.onclick = (evento) => {
    evento.stopPropagation();
    aoClicar();
  };
  return botao;
}
export const isVisible = (id) => !registry.get(id)?.node.hidden;

export function setTitle(id, title) {
  const entry = registry.get(id);
  if (entry) entry.heading.textContent = title;
}

/** O arranjo guardado pelo jogador, se houver. */
const readPreset = () => {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const hasPreset = () => !!readPreset();

/**
 * Guarda as janelas como estão agora — posição, tamanho, quem está aberta e
 * quem está minimizada. É esse retrato que o botão de reorganizar devolve
 * depois.
 */
export function savePreset() {
  const preset = {};
  for (const [id, entry] of registry) {
    const node = entry.node;
    preset[id] = {
      left: node.offsetLeft,
      top: node.offsetTop,
      width: node.offsetWidth,
      height: node.classList.contains('minimized') ? undefined : node.offsetHeight,
      hidden: node.hidden,
      minimized: node.classList.contains('minimized'),
    };
  }
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(preset));
  } catch {
    /* modo privado: segue sem persistir */
  }
  return Object.keys(preset).length;
}

/** Apaga o arranjo guardado; o reorganizar volta a usar o de fábrica. */
export function clearPreset() {
  try {
    localStorage.removeItem(PRESET_KEY);
  } catch {
    /* modo privado */
  }
}

/**
 * Devolve tudo para o lugar: o arranjo que o jogador guardou, ou o de fábrica
 * se ele nunca guardou nenhum.
 */
export function resetLayout() {
  const preset = readPreset();
  for (const key of Object.keys(layout)) delete layout[key];

  for (const [id, entry] of registry) {
    const alvo = preset?.[id] ?? entry.defaults;
    const node = entry.node;

    node.hidden = !!preset?.[id]?.hidden;
    node.classList.toggle('minimized', !!preset?.[id]?.minimized);
    node.querySelector('.window-min').textContent = preset?.[id]?.minimized ? '▢' : '—';
    node.style.width = alvo.width ? `${alvo.width}px` : '';
    node.style.height = alvo.height ? `${alvo.height}px` : '';
    applyLayout(node, id, alvo);
    // O que foi aplicado passa a ser o layout corrente, senão o próximo
    // carregamento da página perde o arranjo.
    layout[id] = {
      left: node.offsetLeft,
      top: node.offsetTop,
      width: alvo.width,
      height: alvo.height,
      hidden: node.hidden,
      minimized: !!preset?.[id]?.minimized,
    };
    markResized(entry);
    // As abas da barra de cima acendem conforme a janela está aberta. O
    // `setVisible` cuidava disso, mas aqui a visibilidade é escrita direto —
    // sem esta linha, reorganizar deixava o halo mentindo.
    document.querySelector(`[data-toggle="${id}"]`)?.setAttribute('aria-selected', String(!node.hidden));
  }
  save();
}

window.addEventListener('resize', () => {
  // Só as que estão na tela: uma janela escondida mede 0x0 (`display: none`) e
  // o clamp a "consertaria" para o canto de cima à esquerda — encolher a janela
  // do navegador embaralhava a posição de tudo o que estava fechado. Quem abre
  // já clampa sozinho, em `setVisible`.
  for (const entry of registry.values()) if (!entry.node.hidden) clampToViewport(entry.node);
});

/*
 * ---- Fechar clicando fora, SEM cancelar o clique de dentro ----
 *
 * Todas as caixas de confirmar do jogo tinham esta linha:
 *
 *     back.onclick = (evento) => evento.target === back && fechar();
 *
 * Ela funciona para fechar. O defeito está no que ela DEVOLVE: quando o clique
 * foi lá dentro, `evento.target === back` é falso, o `&&` curto-circuita e a
 * função devolve `false`. Num handler atribuído por `onclick`, devolver `false`
 * é o mesmo que chamar `preventDefault()` — uma regra do HTML dos anos 90 que
 * ninguém escreve de propósito hoje.
 *
 * O clique continuava chegando aos botões (eles agem no próprio handler), então
 * quase tudo parecia certo. Mas o que depende da AÇÃO PADRÃO do clique parava
 * de funcionar dentro de qualquer caixa dessas — e a caixinha de marcar é
 * exatamente isso. Era o "não perguntar novamente" que não marcava: o clique
 * chegava, o navegador marcava e o `return false` desmarcava de volta.
 *
 * Aqui o corpo é um bloco, então a função devolve `undefined` e o navegador faz
 * o que ia fazer.
 */
export function fecharAoClicarFora(fundo, fechar) {
  fundo.onclick = (evento) => {
    if (evento.target === fundo) fechar();
  };
}

/*
 * ---- Enter confirma, Escape fecha — em TODA caixa de confirmar ----
 *
 * Duas das quatro caixas do jogo tratavam teclado e duas não: comprar na loja e
 * criar oferta no leilão só saíam no mouse. Quem acabou de digitar a quantidade
 * está com a mão no teclado, e o Enter não fazer nada ali é o tipo de atrito
 * que ninguém reporta e todo mundo sente.
 *
 * O `stopPropagation` no fim é o que impede a tecla de vazar para o jogo atrás
 * da caixa — o Escape fecharia a janela de trás junto, e as teclas de ação
 * disparariam magia com um modal aberto.
 *
 * `confirmar` recebe o evento: quem tem um campo de texto dentro da caixa às
 * vezes precisa deixar o Enter passar (uma busca, por exemplo).
 */
export function atalhosDaCaixa(fundo, { confirmar, fechar }) {
  fundo.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      confirmar?.(evento);
    } else if (evento.key === 'Escape') {
      evento.preventDefault();
      fechar?.(evento);
    }
    evento.stopPropagation();
  });
}
