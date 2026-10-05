// HUD do canto superior esquerdo: retrato com o nível, nome, vocação, barras de
// vida, mana e experiência, e a linha de indicadores (stamina, prey, premium,
// blessings). É o mesmo arranjo do painel do jogo que serviu de referência.
import { outfitCanvas, itemCanvas } from './sprites.mjs';
import { tipPanel, tipTexto, tipFor } from './tooltip.mjs';
import { lootComGemas } from './loot-do-bicho.mjs';
import { healthColor } from './map.mjs';
import { ehCelular } from './mobile.mjs';
import { ehTelefone } from './perfil.mjs';
import { ARTES } from './artes.mjs';

const $ = (id) => document.getElementById(id);

/*
 * `hh:mm:ss`. Uma cópia curta da que o `main.mjs` tem.
 *
 * Importar de lá criaria um ciclo (`main` já importa este arquivo), e cinco
 * linhas duplicadas custam menos do que um terceiro módulo chamado "utilidades"
 * para servir a duas funções.
 */
const formatTime = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((parte) => String(parte).padStart(2, '0'))
    .join(':');
};

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const icon = (name, alt = '') => {
  const img = document.createElement('img');
  img.alt = alt;
  /*
   * Nome sem arte (o `prey-defense`, por exemplo): o `<img>` vazio e sem
   * `src`, como o `artOrUiIcon` faz — quem chamou tem o que anexar, e a rede
   * não leva um 404. Ver `tools/indice-de-artes.mjs`.
   */
  if (!ARTES.ui.has(name)) {
    img.className = 'ui-icon vazio';
    return img;
  }
  img.className = 'ui-icon';
  img.src = `/client/assets/ui/${name}.png`;
  img.onerror = () => img.remove();
  return img;
};

export const uiIcon = icon;

/*
 * Ícone desenhado por nós, com o do client como rede.
 *
 * As skills e os elementos existem nos dois lugares: os recortes antigos do
 * client em `ui/`, de 9x9 e 12x12, e os desenhos novos em `icons/`, de 128px.
 * Enquanto os quinze não estiverem todos prontos, os dois convivem — então em
 * vez de trocar o caminho de uma vez, pede-se o novo e cai no velho quando ele
 * não existe.
 *
 * A diferença não é só o arquivo: 128px descendo para 20 tem que ser suavizado,
 * e 9px subindo para 20 tem que ser `pixelated`. A classe muda junto com a
 * fonte, senão o desenho novo sai borrado ou o antigo sai numa papa cinzenta.
 *
 * Cada nome que falha fica guardado, para não pedir de novo a cada abertura.
 */
const semDesenhoNovo = new Set();
/*
 * E os que não existem em LUGAR NENHUM — nem em `icons/`, nem em `ui/`.
 *
 * `semDesenhoNovo` sozinho evitava só a primeira das duas buscas: um nome sem
 * arte alguma continuava pedindo o caminho antigo a cada desenho, levando 404
 * para sempre. Isso não incomodava enquanto quem chamava eram os quinze ícones
 * de perícia, que existem; passou a incomodar quando as ABAS começaram a pedir
 * `aba-<id>.png`, que hoje não existem — são oito pedidos por abertura de
 * janela, em toda janela com abas.
 *
 * Com os dois conjuntos, um nome sem arte custa duas buscas UMA vez na sessão,
 * e depois nada. E quando o PNG chegar na pasta, basta recarregar a página.
 */
const semDesenhoNenhum = new Set();

export function artOrUiIcon(name, alt = '') {
  const img = document.createElement('img');
  img.alt = alt;

  /*
   * O índice das pastas (`artes.mjs`) responde de antemão onde está a arte —
   * ou que ela não existe — e as duas buscas abaixo, com o 404 de cada uma,
   * ficam só de rede de segurança para um nome que o índice não conhece.
   */
  if (!ARTES.icons.has(name) && !ARTES.ui.has(name)) semDesenhoNenhum.add(name);
  else if (!ARTES.icons.has(name)) semDesenhoNovo.add(name);

  const cair = () => {
    semDesenhoNovo.add(name);
    img.className = 'ui-icon';
    img.onerror = () => {
      semDesenhoNenhum.add(name);
      img.remove();
    };
    img.src = `/client/assets/ui/${name}.png`;
  };

  /*
   * Já sabemos que não há arte: devolve o `<img>` vazio e sem `src`, para quem
   * chamou ter o que anexar. Ele não pede nada à rede e não desenha nada.
   */
  if (semDesenhoNenhum.has(name)) {
    img.className = 'ui-icon vazio';
    return img;
  }

  if (semDesenhoNovo.has(name)) {
    cair();
    return img;
  }

  img.className = 'ui-icon arte';
  img.onerror = cair;
  img.src = `/client/assets/icons/${name}.png`;
  return img;
}

const formatHours = (minutes) => `${Math.floor(minutes / 60)}h ${String(Math.floor(minutes % 60)).padStart(2, '0')}m`;

/* O Scroll Speed Exercise, para a pílula desenhar o item que o jogador comprou.
   É o mesmo id do `consumiveis.mjs` do servidor (55386). */
/*
 * O `Scroll Speed Exercise` do gamestore dele. Exportado porque a tela do
 * Exercise (em panels.mjs) passou a anunciá-lo também: um segundo `55386`
 * escrito lá seria o mesmo número em dois lugares esperando para divergir.
 */
export const ITEM_DO_PERGAMINHO = 55386;

let portraitKey = '';
// O último personagem desenhado: o card da promoção precisa se recolocar quando
// a ficha desce para o rodapé, e isso acontece fora do ciclo de render.
let ultimoPersonagem = null;

let hudCtx = null;

/*
 * O que a barra sabe fazer, para o modal de ajustes usar.
 * Preenchido pelo `initHud`; o modal mora em panels.mjs.
 */
export const ajustesDaBarra = {};

/*
 * ---- Os RELÓGIOS do que está ligado, e quais deles ficam na tela ----
 *
 * "essa opção de Buff Power na tela coloca junto as Exp Potions pra aparecer
 *  lá, o Exp Boost, a Divine Hunts Scroll, a Instance Hunts — só que em config
 *  eu posso escolher quais eu quero ativo. A princípio deixa todos ativos."
 *
 * Quatro grupos, e a razão de serem GRUPOS e não uma chave por pílula: quem
 * desliga "boosts de experiência" está desligando um assunto, e não a Exp
 * Potion de 50% em particular. Uma chave por item viraria uma tela de ajustes
 * com quinze interruptores.
 *
 * Todos nascem LIGADOS. Quem acabou de pagar por uma hora precisa ver o relógio
 * sem procurar; quem se incomodar desliga, e nada se perde — a experiência
 * continua na barra de experiência, os buffs continuam na ficha do personagem e
 * os passes continuam na aba Especial.
 *
 * No `localStorage` e não no personagem: é escolha de quem está olhando ESTA
 * tela. Dois computadores da mesma conta podem preferir coisas diferentes, e
 * nenhuma delas vale uma viagem ao servidor.
 *
 * A chave guarda o DESLIGADO ('0'), e não o ligado: assim o valor ausente — que
 * é o de todo mundo hoje — já significa "mostra", e ninguém precisa de migração.
 */
export const GRUPOS_DE_EFEITO = [
  { id: 'buffpower', nome: 'Buff Power', dica: 'Os três, com o tempo acumulado de cada um.' },
  { id: 'exp', nome: 'Boosts de experiência', dica: 'Exp Potion, XP Boost da loja e o Buff Power Exp.' },
  { id: 'instance', nome: 'Instance Hunts', dica: 'Quanto falta do passe de 24 horas.' },
  { id: 'divina', nome: 'Divine Hunts', dica: 'Quanto falta do passe de 24 horas.' },
];

/*
 * ---- Onde a faixa fica, deitada ou em pé, e de que tamanho ----
 *
 * "eu tinha que conseguir mover, ou aumentar e diminuir o tamanho, ou mover
 *  separadamente, ou colocar na vertical também. E a princípio deixa um pouco
 *  menor."
 *
 * Três escolhas, e as três moram no navegador de quem olha, como o resto desta
 * faixa: onde ela está, se ela deita ou fica em pé, e o tamanho.
 *
 * O TAMANHO nasce em 'P', que é o "um pouco menor" pedido. Quem quiser o de
 * antes tem o 'M'.
 *
 * A POSIÇÃO nasce vazia, e vazia quer dizer "no alto e no meio, empilhada
 * abaixo do que estiver lá" — que é o que `empilharNoTopo` faz. No instante em
 * que a pessoa arrasta, ela passa a mandar, e `empilharNoTopo` sai do caminho:
 * duas regras disputando o mesmo `top` fariam a faixa pular de volta sozinha,
 * que é o pior jeito de uma coisa arrastável se comportar.
 */
/*
 * ---- UM lugar, e não os dois ----
 *
 * "a pessoa tem que escolher entre o modo modal e o da tela, e não os 2."
 *
 * E está certo: os dois mostram a mesma coisa. Ligados juntos, o relógio do
 * mesmo buff aparecia duas vezes na tela, e desligar um grupo o tirava de um
 * lugar e o deixava no outro — a pessoa mexeria no ajuste e continuaria vendo o
 * que quis tirar.
 *
 * Então é uma escolha só, com dois valores. As PÍLULAS são o de fábrica: elas
 * não pedem para ser abertas, e quem acabou de pagar por uma hora precisa ver o
 * relógio sem procurar.
 *
 * Quais relógios (`GRUPOS_DE_EFEITO`) é outra pergunta, e vale para os dois
 * modos — é "o que eu quero ver", e não "onde".
 */
export const MODOS_DE_EFEITO = [
  { id: 'pilulas', nome: 'Na tela', dica: 'Pílulas pequenas no alto, que se arrastam.' },
  { id: 'janela', nome: 'Em janela', dica: 'A janela Buffs e Boosts, linha por linha.' },
];
const CHAVE_DO_MODO = 'draevor:efeitos-modo';
export const modoDosEfeitos = () => (localStorage.getItem(CHAVE_DO_MODO) === 'janela' ? 'janela' : 'pilulas');
export function trocarModoDosEfeitos(modo) {
  localStorage.setItem(CHAVE_DO_MODO, modo === 'janela' ? 'janela' : 'pilulas');
  // A faixa some (ou volta) na hora; quem abre e fecha a janela é quem chamou.
  if (hudCtx?.state?.character) renderPilulasDeEfeito(hudCtx.state.character);
}

const CHAVE_DO_ARRANJO = 'draevor:pilulas-arranjo';
const CHAVE_DO_TAMANHO = 'draevor:pilulas-tamanho';
const CHAVE_DA_POSICAO = 'draevor:pilulas-pos';

export const TAMANHOS_DA_PILULA = [
  { id: 'P', nome: 'Pequeno' },
  { id: 'M', nome: 'Médio' },
  { id: 'G', nome: 'Grande' },
];

export const arranjoDasPilulas = () => (localStorage.getItem(CHAVE_DO_ARRANJO) === 'em-pe' ? 'em-pe' : 'deitada');
export const tamanhoDasPilulas = () =>
  TAMANHOS_DA_PILULA.some((t) => t.id === localStorage.getItem(CHAVE_DO_TAMANHO))
    ? localStorage.getItem(CHAVE_DO_TAMANHO)
    : 'P';

export function posicaoDasPilulas() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CHAVE_DA_POSICAO) ?? 'null');
    return Number.isFinite(guardado?.x) && Number.isFinite(guardado?.y) ? guardado : null;
  } catch {
    // Um valor estragado não pode impedir a faixa de aparecer.
    return null;
  }
}

function guardarPosicao(pos) {
  if (pos) localStorage.setItem(CHAVE_DA_POSICAO, JSON.stringify(pos));
  else localStorage.removeItem(CHAVE_DA_POSICAO);
  aplicarArranjoDasPilulas();
}

export function moverPilulasParaOLugar() {
  guardarPosicao(null);
}

export function trocarArranjoDasPilulas(arranjo) {
  localStorage.setItem(CHAVE_DO_ARRANJO, arranjo === 'em-pe' ? 'em-pe' : 'deitada');
  aplicarArranjoDasPilulas();
}

export function trocarTamanhoDasPilulas(tamanho) {
  localStorage.setItem(CHAVE_DO_TAMANHO, tamanho);
  aplicarArranjoDasPilulas();
}

/*
 * Põe no elemento o que as três escolhas dizem.
 *
 * Uma função só, chamada por todas elas e por cada redesenho: as três mexem no
 * mesmo elemento, e três caminhos diferentes para escrever o mesmo `style` é
 * como um deles fica para trás.
 */
function aplicarArranjoDasPilulas() {
  const faixa = $('pilulas-de-efeito');
  if (!faixa) return;
  faixa.classList.toggle('em-pe', arranjoDasPilulas() === 'em-pe');
  for (const t of TAMANHOS_DA_PILULA) faixa.classList.toggle(`tamanho-${t.id}`, tamanhoDasPilulas() === t.id);

  const pos = posicaoDasPilulas();
  if (pos) {
    // Arrastada: ela manda. `left/top` em pixels e sem o `translateX(-50%)` do
    // CSS, que existe só para centralizar quem nunca foi movido.
    faixa.classList.add('arrastada');
    faixa.style.left = `${pos.x}px`;
    faixa.style.top = `${pos.y}px`;
  } else {
    faixa.classList.remove('arrastada');
    faixa.style.left = '';
    faixa.style.top = '';
    empilharNoTopo();
  }
}

/*
 * ---- Arrastar ----
 *
 * Ligado uma vez, no elemento, e não em cada pílula: as pílulas são refeitas a
 * cada quadro, e um listener por pílula seria religado sessenta vezes por
 * segundo.
 *
 * O × é a exceção — arrastar a partir dele não faz sentido e roubaria o clique.
 *
 * O limiar de 4 pixels separa CLIQUE de ARRASTO. Sem ele, um clique com dois
 * pixels de tremor moveria a faixa; com ele, o × continua clicável e o resto da
 * pílula continua abrindo o balão.
 */
function ligarArrastoDasPilulas() {
  const faixa = $('pilulas-de-efeito');
  if (!faixa || faixa.dataset.arrastoLigado) return;
  faixa.dataset.arrastoLigado = '1';

  let de = null;
  faixa.addEventListener('pointerdown', (evento) => {
    if (evento.button !== 0 || evento.target.closest('.efeito-pill-fechar')) return;
    const r = faixa.getBoundingClientRect();
    de = { x: evento.clientX, y: evento.clientY, left: r.left, top: r.top, moveu: false };
    faixa.setPointerCapture(evento.pointerId);
    evento.preventDefault();
  });

  faixa.addEventListener('pointermove', (evento) => {
    if (!de) return;
    const dx = evento.clientX - de.x;
    const dy = evento.clientY - de.y;
    if (!de.moveu && Math.abs(dx) + Math.abs(dy) < 4) return;
    de.moveu = true;
    faixa.classList.add('arrastando');
    /*
     * Presa à janela: uma faixa arrastada para fora da tela some e não há como
     * trazê-la de volta a não ser pelas Opções. Sobra sempre um pedaço dela.
     */
    const r = faixa.getBoundingClientRect();
    const x = Math.min(Math.max(0, de.left + dx), window.innerWidth - Math.min(r.width, 80));
    const y = Math.min(Math.max(0, de.top + dy), window.innerHeight - Math.min(r.height, 40));
    faixa.classList.add('arrastada');
    faixa.style.left = `${Math.round(x)}px`;
    faixa.style.top = `${Math.round(y)}px`;
  });

  const soltar = (evento) => {
    if (!de) return;
    const moveu = de.moveu;
    de = null;
    faixa.classList.remove('arrastando');
    if (evento?.pointerId != null && faixa.hasPointerCapture?.(evento.pointerId)) {
      faixa.releasePointerCapture(evento.pointerId);
    }
    if (!moveu) return;
    const r = faixa.getBoundingClientRect();
    guardarPosicao({ x: Math.round(r.left), y: Math.round(r.top) });
  };
  faixa.addEventListener('pointerup', soltar);
  faixa.addEventListener('pointercancel', soltar);
}

const chaveDoGrupo = (id) => `draevor:efeito-na-tela:${id}`;
export const efeitoNaTela = (id) => localStorage.getItem(chaveDoGrupo(id)) !== '0';
export function mostrarEfeitoNaTela(id, mostrar) {
  localStorage.setItem(chaveDoGrupo(id), mostrar ? '1' : '0');
  // Some (ou volta) no mesmo instante, sem esperar o próximo empurrão de estado.
  if (hudCtx?.state?.character) renderPilulasDeEfeito(hudCtx.state.character);
}

/*
 * O desenho de cada fonte de experiência.
 *
 * As duas poções e o Buff Power Exp são ITENS e têm sprite; o XP Boost da loja
 * não é item nenhum — ele liga na compra e não passa pela mochila —, e por isso
 * cai no `null` e a pílula sai só com o texto. É o mesmo desvio que o card dele
 * na loja faz.
 */
const ITEM_DA_FONTE = {
  'pocao-50': 55343,
  'pocao-75': 55345,
  'buff-power': 55651,
  loja: null,
};

/*
 * Os dois pergaminhos de acesso. Escritos aqui e nao importados de
 * `panels.mjs`: aquele arquivo importa ESTE, e o caminho de volta fecharia um
 * ciclo. E o mesmo arranjo do `ITEM_DO_PERGAMINHO` logo acima.
 */
const ITEM_INSTANCE_HUNTS = 22771;
const ITEM_DIVINE_HUNTS = 55335;

const NOME_DA_FONTE_DE_EXP = {
  loja: 'XP Boost',
  'pocao-50': 'Exp Potion 50%',
  'pocao-75': 'Exp Potion 75%',
  'buff-power': 'Buff Power Exp',
};

export function initHud(ctx) {
  hudCtx = ctx;

  // O card não fecha — só encolhe. Ele é a ficha viva do personagem.
  const hud = $('hud');
  const minimize = $('hud-min');
  minimize.onclick = () => {
    hud.classList.toggle('minimized');
    minimize.textContent = hud.classList.contains('minimized') ? '▢' : '—';
    tipTexto(minimize, hud.classList.contains('minimized') ? 'Restaurar a ficha.' : 'Encolher a ficha.');
    localStorage.setItem('draevor:hud-min', hud.classList.contains('minimized') ? '1' : '');
  };
  if (localStorage.getItem('draevor:hud-min')) minimize.click();

  /*
   * O card pode descer para a barra de baixo.
   *
   * Quem joga com a tela cheia de janelas quer o canto superior esquerdo livre.
   * Em vez de duplicar as barras e os ícones lá embaixo — dois lugares para
   * manter em dia —, os mesmos elementos mudam de casa e voltam. Nada é
   * redesenhado, e todo `renderHud` continua achando os ids onde sempre esteve.
   *
   * Lá embaixo eles se separam, porque o rodapé não é um card: as três barras
   * ficam em pé à direita do "Sair da hunt", e os chips e os ícones de sistema
   * ficam centrados em cima dos slots.
   */
  const barsDock = $('hud-bars-dock');
  const dockButton = $('hud-dock-btn');

  const setDocked = (docked) => {
    /*
     * ---- Só as réguas mudam de casa ----
     *
     * O botão de hunt chegou a andar junto com elas: ele morava colado na barra
     * de vida, e ficar para trás o deixava sozinho numa coluna sem mais nada.
     * O arranjo mudou — ele agora mora na coluna da direita, com os arranjos de
     * hotkeys, e as réguas foram para cima dos slots. Sem vizinhança comum, não
     * há mais por que viajarem juntos: ele fica.
     *
     * Os chips foram para o inventário e os sistemas para a barra de cima.
     */
    /*
     * Os relogios das magias nao viajam mais com as reguas: eles flutuam soltos
     * acima da barra de acoes, fora de qualquer caixa que se mexa (ver
     * `renderBuffsDaMagia`). Foram morando aqui dentro e depois na fita do
     * rodape, e nos dois lugares dependiam de caber em algo — no primeiro
     * sumiam junto com o card encaixado, no segundo ficavam presos ao recorte
     * do rodape.
     */
    hud.classList.toggle('docked', docked);
    posicionarReguas();
    // Recolhido lá embaixo, o cabeçalho do card fica só com o retrato e o nome.
    dockButton.hidden = docked;
    localStorage.setItem('draevor:hud-dock', docked ? '1' : '');
    // A promoção mora colada embaixo do card: some o card, ela muda de lugar.
    if (ultimoPersonagem) placePromotion(ultimoPersonagem);
  };

  /*
   * ---- No telefone, as réguas ficam SEMPRE no topo ----
   *
   * O encaixe é uma preferência do computador, guardada no navegador. No
   * telefone a casca força o `#hud` visível (a faixa de status, com retrato e
   * nível) — e as réguas, levadas para o rodapé, iam para um `#hud-bars-dock`
   * que ali não aparece: sobrava o retrato ao lado de uma faixa vazia, sem vida
   * nem mana. A preferência fica guardada (volta a valer no computador); só a
   * casa das réguas segue o perfil, e é refeita quando ele muda (girar a tela).
   */
  function posicionarReguas() {
    const embaixo = hud.classList.contains('docked') && !ehTelefone();
    if (embaixo) barsDock.append($('hud-bars'));
    else $('hud-body').append($('hud-bars'));
    barsDock.hidden = !embaixo;
  }
  window.addEventListener('draevor:perfil', posicionarReguas);

  dockButton.onclick = () => setDocked(true);
  /*
   * O modal de ajustes precisa mexer no encaixe da ficha, e ele vive noutro
   * arquivo. Em vez de exportar meia dúzia de funções, a HUD publica o que
   * sabe fazer — é o mesmo padrão do `ctx` que os painéis já usam.
   */
  ajustesDaBarra.encaixarFicha = (encaixada) => setDocked(encaixada);
  ajustesDaBarra.fichaEncaixada = () => hud.classList.contains('docked');
  // Sempre, e não só quando está encaixada: é esta chamada que escreve o texto
  // do item do menu, e sem ela ele nascia dizendo "devolver" com a ficha já no
  // canto — oferecendo o que acabou de ser feito.
  setDocked(!!localStorage.getItem('draevor:hud-dock'));

  /*
   * A barra de ações se recolhe para baixo.
   *
   * Ela ocupa a largura da tela no rodapé, e quem está só olhando o personagem
   * caçar não precisa dos doze slots, do alvo e da distância o tempo todo.
   * Minimizada sobra a fita com os dois controles, no mesmo canto — a seta
   * troca de desenho e devolve tudo.
   *
   * Fica guardado no navegador como o encaixe da ficha: é preferência de
   * arrumação da tela, mora onde as outras moram e não custa uma ida ao
   * servidor.
   */
  const barra = $('actionbar');
  const minimizar = $('bar-min');

  const setMinimizada = (recolhida) => {
    barra.classList.toggle('minimizada', recolhida);
    minimizar.textContent = recolhida ? '▲' : '▼';
    minimizar.title = recolhida ? 'mostrar a barra' : 'minimizar a barra';
    localStorage.setItem('draevor:bar-min', recolhida ? '1' : '');
  };

  minimizar.onclick = () => setMinimizada(!barra.classList.contains('minimizada'));
  setMinimizada(!!localStorage.getItem('draevor:bar-min'));
  ajustesDaBarra.minimizar = setMinimizada;
  ajustesDaBarra.minimizada = () => barra.classList.contains('minimizada');

  /*
   * ---- A barra de CIMA recolhe também ----
   *
   * A de baixo já saía da frente; esta ficava, e são 62px de cromo permanente
   * por cima do mapa numa tela baixa. Mesmo gesto, mesma memória: a escolha
   * fica no navegador, como a da barra de baixo e a do encaixe da ficha.
   *
   * A classe vai no `body`, e não na barra: quem se pendura na altura dela é
   * gente de fora — a faixa de obra, o cartaz de beta e o HUD. Ver
   * `--altura-da-topbar` no CSS.
   */
  const topo = $('topbar-min');
  if (topo) {
    const recolherTopo = (recolhida) => {
      document.body.classList.toggle('topbar-recolhida', recolhida);
      topo.title = recolhida ? 'Mostrar a barra de cima' : 'Recolher a barra de cima';
      localStorage.setItem('draevor:topbar-min', recolhida ? '1' : '');
    };
    topo.onclick = () => recolherTopo(!document.body.classList.contains('topbar-recolhida'));
    recolherTopo(!!localStorage.getItem('draevor:topbar-min'));
  }

  /*
   * A engrenagem abre um modal, e não mais um menuzinho de um item só.
   *
   * O que havia pendurado ali era uma frase inteira dentro de um retângulo
   * flutuante — "Devolver a ficha para o canto superior esquerdo" —, larga
   * demais para a fita e sem lugar para as outras coisas que se quer ajustar.
   */
  /*
   * 15/09: o botão deixou de abrir os ajustes (eles continuam em Opções →
   * Interface) e passou a TROCAR a ficha de lugar direto — encaixada na barra
   * ou no canto de cima. O desenho é o de um card saindo para o canto.
   */
  const botaoDaFicha = $('bar-gear');
  const tituloDaFicha = () => {
    const encaixada = hud.classList.contains('docked');
    tipTexto(
      botaoDaFicha,
      encaixada
        ? 'Mandar a ficha do personagem para o canto de cima\n(vida, mana, experiência e stamina vão junto)'
        : 'Trazer a ficha do personagem para a barra de baixo'
    );
    botaoDaFicha.classList.toggle('ficha-no-canto', !encaixada);
  };
  botaoDaFicha.removeAttribute('title');
  botaoDaFicha.onclick = () => {
    setDocked(!hud.classList.contains('docked'));
    tituloDaFicha();
  };
  tituloDaFicha();

  // O botão de ficha abre a aba de atributos do personagem.
  $('hud-sheet').onclick = () => ctx?.openSheet?.();

  // Card dourado da promoção.
  $('hud-promotion').onclick = () => ctx?.openPromotion?.();
}

/**
 * O card fica colado embaixo da ficha, acompanhando a altura dela — a ficha
 * encolhe quando minimizada e o card sobe junto. Ficar sempre ABAIXO da ficha
 * (nunca ao lado) é o que garante nunca cobrir a ficha em nenhum tamanho de
 * tela. No celular a ficha já toma quase a largura inteira — copiar a LARGURA
 * dela também faria o card dominar boa parte da tela de jogo logo abaixo, daí
 * a largura pequena e fixa só no celular (`ehCelular()`, mesma leitura de
 * `--e-celular` de `mobile.mjs`); a posição continua a mesma conta nos dois.
 */
function placePromotion(character) {
  const card = $('hud-promotion');
  if (!card) return;

  const promotion = character.promotion;
  const show = !!promotion && !promotion.done && promotion.available;
  card.hidden = !show;
  if (!show) return;

  $('hud-promotion-text').textContent = `Torne-se ${promotion.name} por ${promotion.cost.toLocaleString('pt-BR')} gold`;
  tipTexto(card, `${promotion.from} → ${promotion.name}`);
  /*
   * Com o card descido para o rodapé ele some da tela, e um retângulo de zeros
   * jogaria a promoção para o canto de cima à esquerda, do tamanho de nada. Aí
   * ela ocupa o lugar que era do card.
   */
  const hud = $('hud').getBoundingClientRect();
  const vazio = hud.width === 0;
  const celular = ehCelular();
  /*
   * Nunca por baixo da barra de cima e da faixa "em desenvolvimento" (z-index maior que o do card):
   * com o card do personagem descido, o `72` fixo caía atrás da faixa — que no celular quebra em
   * duas linhas — e o título "Promotion" ficava cortado.
   */
  const estilo = getComputedStyle(document.documentElement);
  const topbar = parseFloat(estilo.getPropertyValue('--altura-da-topbar')) || 0;
  const faixa = document.getElementById('aviso-dev');
  const aviso = faixa && !faixa.hidden ? faixa.getBoundingClientRect().bottom : 0;
  const piso = Math.max(topbar, aviso) + 10;
  card.style.top = `${Math.round(Math.max(vazio ? 72 : hud.bottom + 8, piso))}px`;
  card.style.left = `${Math.round(vazio ? 12 : hud.left)}px`;
  card.style.width = celular ? 'min(240px, calc(100vw - 24px))' : `${Math.round(vazio ? 340 : hud.width)}px`;
}

/**
 * Os sistemas do servidor dentro do card: proficiência da arma equipada, charms
 * do bestiary, imbuements e prey. São só os ícones do client, lado a lado; o
 * resto da informação fica no tooltip e no modal que o clique abre.
 *
 * Os botões são montados uma vez e depois só mudam de título e de brilho. Antes
 * eles eram refeitos quatro vezes por segundo e o clique se perdia no meio —
 * era por isso que a proficiência e o imbuement só abriam na terceira tentativa.
 */
/*
 * A tira de sistemas do card acabou.
 *
 * Proficiência, charms, imbuements e prey subiram para a barra de cima, um a um,
 * conforme cada desenho ficou pronto. Lá são ícones de 38px com o mesmo
 * acabamento dos outros e acendem em dourado do mesmo jeito quando há ponto
 * para gastar; aqui embaixo eram glifos de 20px espremidos numa tira. O
 * maquinário que os montava saiu junto.
 */

/*
 * Premium e blessings, os dois selos do personagem.
 *
 * Stamina virou uma régua verde ao lado das outras — número em texto não diz
 * nada sobre estar acabando, e uma barra diz de relance. Os slots de prey já
 * têm o seu botão na barra de cima, com o mesmo número no tooltip.
 *
 * Eles moram nos dois buracos da grade do inventário: um embaixo do anel, o
 * outro embaixo da munição. A última fileira só tem as botas no meio, e os
 * dois cantos vazios estavam ali sem fazer nada — assim os selos entram sem a
 * janela crescer um pixel, que é o que uma faixa própria embaixo custava.
 *
 * Sem número ao lado: um selo de 22px encostado num slot de 44px não tem onde
 * escrever "13d" sem virar sopa de letrinha. Quantos dias faltam é coisa que se
 * pergunta de vez em quando, e a resposta está no tooltip.
 *
 * Os ícones são do client, cada um da tela onde ele já significa isso: a coroa
 * do entergame — com o visto verde quando o premium está ativo e o X vermelho
 * quando não — e o símbolo do botão de blessings do inventário.
 */
export function seloPremium(character) {
  const temPremium = (character.premium ?? 0) > 0;
  const selo = el('div', `inv-badge premium${temPremium ? ' on' : ''}`);
  selo.append(icon(temPremium ? 'st-premium' : 'st-premium-off', 'premium'));
  tipPanel(selo, () => painelPremium(character));
  return selo;
}

/*
 * O selo das blessings é também o botão delas.
 *
 * Ele usa o ícone grande da barra de cima — 128px, o mesmo desenho — e não o
 * símbolo de 12x12 do client, que a esta altura já estava sendo ampliado duas
 * vezes. Com isso o botão da barra saiu: eram dois lugares para a mesma coisa,
 * e este é o lugar certo — blessing é estado do personagem.
 *
 * Passar o mouse continua mostrando quais estão ativas; clicar abre a compra.
 */
export function seloBlessings(character, catalog, aoClicar) {
  const ativas = (character.blessings ?? []).length;
  const selo = el('div', `inv-badge blessings${ativas ? ' on' : ''}`);

  const arte = document.createElement('img');
  arte.className = 'ui-icon';
  arte.src = '/client/assets/icons/blessings.png';
  arte.alt = 'blessings';
  selo.append(arte);

  if (aoClicar) {
    selo.onclick = aoClicar;
    selo.style.cursor = 'pointer';
  }
  tipPanel(selo, () => painelBlessings(character, catalog));
  return selo;
}

/**
 * Quanto falta de premium.
 *
 * O servidor manda o que sobra em milissegundos, contado na hora do envio —
 * então dá para dizer a data de fim sem guardar nada aqui.
 */
function painelPremium(character) {
  const resta = character.premium ?? 0;
  const caixa = el('div', 'tip-bless');
  caixa.append(el('div', 'tip-bless-head', resta > 0 ? 'Premium ativo' : 'Conta free'));

  if (resta > 0) {
    const dias = Math.floor(resta / 86400_000);
    const horas = Math.floor((resta % 86400_000) / 3600_000);
    const fim = new Date(Date.now() + resta);
    caixa.append(
      el('p', 'tip-bless-foot', dias >= 1 ? `Faltam ${dias} dia(s) e ${horas}h.` : `Faltam ${Math.ceil(resta / 3600_000)}h.`),
      el('p', 'tip-bless-foot', `Termina em ${fim.toLocaleDateString('pt-BR')}.`)
    );
  } else {
    caixa.append(el('p', 'tip-bless-foot', 'Premium se compra na Store, por coins.'));
  }
  return caixa;
}
/**
 * O que as blessings estão fazendo por você.
 *
 * O personagem carrega só os ids; nome e amuleto vêm do catálogo, que chega uma
 * vez no `hello`. Cada linha traz o sprite do próprio amuleto do servidor — a
 * lista em texto puro não dizia nada sobre o que cada uma é.
 */
function painelBlessings(character, catalog) {
  const todas = catalog?.blessings ?? [];
  const ativas = new Set(character.blessings ?? []);

  const caixa = el('div', 'tip-bless');
  caixa.append(el('div', 'tip-bless-head', `Blessings — ${ativas.size} de ${todas.length}`));

  if (!todas.length) {
    caixa.append(el('p', 'tip-bless-empty', 'catálogo ainda não chegou'));
    return caixa;
  }

  const lista = el('div', 'tip-bless-list');
  for (const bless of todas) {
    const tem = ativas.has(bless.id);
    const linha = el('div', `tip-bless-row${tem ? ' on' : ''}`);
    // O amuleto é um item do servidor: `charm` é o id dele.
    if (bless.charm) linha.append(itemCanvas(bless.charm, 20));
    else linha.append(el('span', 'tip-bless-gap'));
    linha.append(el('b', null, bless.name));
    if (bless.type === 'enhanced') linha.append(el('em', 'tip-bless-tag', 'enhanced'));
    linha.append(el('i', 'tip-bless-mark', tem ? '✔' : '—'));
    lista.append(linha);
  }
  caixa.append(lista);

  caixa.append(
    el(
      'p',
      'tip-bless-foot',
      ativas.size === todas.length
        ? 'Perda máxima ao morrer, com todas ativas.'
        : 'Cada blessing corta um pedaço do que se perde ao morrer.'
    )
  );
  return caixa;
}

/*
 * O quanto está cheio vira uma variável, não uma largura.
 *
 * Deitada a barra cresce para a direita; em pé, de baixo para cima. Escrever
 * `style.width` aqui prendia o desenho ao primeiro caso — e estilo em linha
 * ganha de qualquer regra da folha, então o CSS da barra vertical não tinha
 * como corrigir. Com `--fill`, cada orientação decide se é largura ou altura.
 */
/*
 * A régua de experiência é a única com painel no hover.
 *
 * As outras três já dizem tudo no `title`: vida é "4635/4635" e acabou. Esta
 * mostra "14% lvl 300" e esconde o resto — quanto falta em experiência, e todos
 * os outros níveis que o personagem tem. Distance, magic, axe, escudo: eles são
 * o progresso de verdade de quem está caçando, e estavam só na ficha, a dois
 * cliques de distância.
 */
const ROTULO_SKILL = {
  melee: 'melee', distance: 'distância', shielding: 'escudo', fishing: 'pesca', magic: 'magic level',
};

function painelExperiencia(character, catalog, party = null) {
  const caixa = el('div', 'tip-bless');
  caixa.append(el('div', 'tip-bless-head', `Level ${character.level}`));

  const progresso = character.progress ?? {};
  const linhas = el('div', 'tip-skills');

  const linha = (chave, rotulo, valor, percent, bonus) => {
    const item = el('div', 'tip-skill');
    item.append(artOrUiIcon(`sk-${chave}`, rotulo));
    item.append(el('span', null, rotulo));
    const total = el('b', null, bonus ? `${valor}+${bonus}` : String(valor));
    if (bonus) total.style.color = 'var(--accent)';
    item.append(total);
    item.append(el('em', null, `${Math.round((percent ?? 0) * 100)}%`));
    linhas.append(item);
  };

  // A experiência entra como se fosse mais uma linha, e vem primeiro: ela é a
  // régua que o jogador está olhando.
  linha('experience', 'experiência', character.level, progresso.percent);

  const bonus = character.derived?.skillBonus ?? {};
  for (const chave of catalog?.skills ?? []) {
    const skill = character.skills?.[chave];
    if (!skill) continue;
    linha(chave, ROTULO_SKILL[chave] ?? chave, skill.value, skill.percent, bonus[chave]);
  }
  if (character.magic) {
    linha('magic', ROTULO_SKILL.magic, character.magic.value, character.magic.percent, bonus.magic);
  }
  caixa.append(linhas);

  // As três contas que antes eram um `title` de três linhas neste mesmo lugar.
  // O `title` saiu junto: dois balões no mesmo elemento, um por cima do outro.
  const numero = (valor) => Math.round(valor ?? 0).toLocaleString('pt-BR');
  const rodape = el('div', 'tip-exp-foot');
  rodape.append(
    el('p', null, `${numero(progresso.current)} / ${numero(progresso.needed)} neste level`),
    el('p', null, `Faltam ${numero(progresso.toNext)} para o level ${character.level + 1}`),
    el('p', 'fraco', `Total acumulado ${numero(character.exp)}`)
  );
  caixa.append(rodape);

  /*
   * ---- O que está multiplicando a experiência AGORA ----
   *
   * A régua dizia quanto falta para o próximo level e nada mais. O que o
   * jogador quer saber ao passar o mouse nela é por que a barra anda rápido ou
   * devagar — e isso é a soma dos bônus ativos, que estava espalhada entre a
   * ficha, o relógio do boost e o quadradinho da stamina.
   *
   * Os números são os mesmos que o servidor usa para pagar cada morte
   * (`experienciaPessoal`, em hunt.mjs): bônus de level, os boosts de
   * experiência (que agora SOMAM entre si), premium, a prey de cada criatura e
   * o fator da stamina.
   */
  const bonusDaExp = el('div', 'tip-exp-bonus');
  bonusDaExp.append(el('div', 'tip-bless-head', 'O que está multiplicando'));

  const linhaDeBonus = (rotulo, valor, dono) => {
    const item = el('div', 'tip-exp-linha');
    item.append(el('span', null, rotulo));
    item.append(el('b', null, valor));
    if (dono) item.append(el('em', null, dono));
    bonusDaExp.append(item);
  };

  let somaGeral = character.derived?.expBonus ?? 0;
  linhaDeBonus('Bônus de level', `+${character.derived?.expBonus ?? 0}%`);

  /*
   * ---- As skins do familiar ----
   *
   * "isso seja bem explicado e apareça lá nas informações de exp na barra de exp".
   *
   * Uma linha só, com as duas origens ditas no rodapé dela: o que vem de TER as
   * skins e o que vem da que está VESTIDA. Duas linhas separadas encheriam a
   * régua — que já tem level, três boosts, premium, party, prey e stamina — para
   * dizer duas metades de um número que soma igual.
   *
   * O número é o mesmo que o servidor usa para pagar cada morte: ele vem pronto
   * do `derived` (ver `bonusDasSkins`), e não é recalculado aqui.
   */
  const skins = character.derived?.skinsDoSummon;
  if (skins?.exp) {
    somaGeral += skins.exp;
    linhaDeBonus(
      'Skins do summon',
      `+${skins.exp.toLocaleString('pt-BR')}%`,
      skins.daVestida?.tipo === 'exp'
        ? `${skins.tenho} skin(s) · ${skins.nomeDaVestida} vestida`
        : `${skins.tenho} skin(s)`,
    );
  }

  /*
   * ---- O PÓDIO DA ARENA ----
   *
   * "quem está no top 1 da arena x1 na semana ganha 8% de bônus de xp... e esse
   *  bônus de xp tem que mostrar lá na barra de experiência junto com os
   *  outros bônus."
   *
   * Ele entra logo depois do bônus de level e das skins, antes dos boosts
   * comprados, porque é dessa família: um bônus que a pessoa CONQUISTOU e que
   * não tem relógio correndo. Os de baixo vencem; este vence quando alguém
   * passa na frente.
   *
   * O rodapé diz o LUGAR, e não o prazo. É a informação que falta aqui: quem vê
   * "+8%" sem o "1º da semana" não sabe que basta perder o primeiro lugar para
   * o número cair — e é justamente isso que ele precisa saber para decidir se
   * vai defender o pódio hoje.
   */
  const podio = character.derived?.podioDaArena;
  if (podio?.exp) {
    somaGeral += podio.exp;
    linhaDeBonus('Pódio da arena', `+${podio.exp}%`, `${podio.lugar}º da semana`);
  }

  /*
   * ---- Uma linha POR FONTE, porque elas somam ----
   *
   * Havia uma linha só, escrita "+50%" à mão, de quando o XP Boost da loja era
   * a única fonte. Hoje são três e elas se somam (50 + 75 + 50 = +175%), então
   * uma linha só não diria nem quanto nem de onde — e a soma escrita à mão
   * estaria errada na primeira poção usada.
   */
  const NOME_DO_BOOST = {
    loja: 'XP Boost da loja',
    'pocao-50': 'Exp Potion 50%',
    'pocao-75': 'Exp Potion 75%',
    // Ver `boostDeExp`: ele chega como fonte, igual às outras três.
    'buff-power': 'Buff Power Exp',
  };
  for (const fonte of character.efeitos?.exp?.fontes ?? []) {
    somaGeral += fonte.percent;
    const minutos = Math.floor(fonte.restante / 60000);
    linhaDeBonus(
      NOME_DO_BOOST[fonte.fonte] ?? 'XP Boost',
      `+${fonte.percent}%`,
      `${Math.floor(minutos / 60)}h ${minutos % 60}min`
    );
  }
  if ((character.premium ?? 0) > 0) {
    somaGeral += 10;
    linhaDeBonus('Premium', '+10%');
  }

  /*
   * ---- A Shared Experience faltava na lista ----
   *
   * O relato: "shared exp nao aparece nos bonus da barra de XP quando passa o
   * mouse. deveria ficar 1.35 por exemplo ao inves de 1.0". Ele está certo — o
   * bônus de vocações diferentes é o maior multiplicador que existe no jogo
   * (+100% com quatro vocações, contra os +50% de um XP Boost) e era o único
   * que a régua não contava. A janela da party já o mostrava; quem olha a régua
   * via 1.0 e concluía que caçar em grupo não muda nada.
   *
   * Só com a partilha LIGADA, pela mesma razão da janela: com ela caída o bônus
   * não é aplicado, e mostrá-lo prometeria um número que ninguém vai receber.
   */
  const membrosDaParty = party?.membros?.length ?? 0;
  if (party?.ativa && party.bonus > 1) {
    const percentDaParty = Math.round((party.bonus - 1) * 100);
    somaGeral += percentDaParty;
    const quantas = party.vocacoes ?? 1;
    linhaDeBonus('Shared Experience', `+${percentDaParty}%`, `${quantas} vocaç${quantas === 1 ? 'ão' : 'ões'}`);
  }

  // Stamina não soma: ela MULTIPLICA o resultado, e é por isso que aparece à
  // parte. Os degraus são os do servidor (Player.getFinalBonusStamina).
  const stamina = character.stamina ?? 0;
  const temPremium = (character.premium ?? 0) > 0;
  const fator = character.efeitos?.exp?.fatorStamina ?? (stamina > 2340 && temPremium ? 1.5 : stamina <= 840 ? 0.5 : 1);
  // O estágio de level (x3 até o 50, x2 até o 100) também multiplica — vem do servidor.
  const estagio = character.efeitos?.exp?.estagio ?? 1;
  if (fator !== 1) {
    linhaDeBonus('Stamina', `×${fator}`, fator > 1 ? 'acima de 39h' : '14h ou menos');
  }

  if (estagio !== 1) linhaDeBonus('Estágio de level', `×${estagio}`, `até o level ${character.level <= 50 ? 50 : 100}`);

  bonusDaExp.append(el('div', 'tip-exp-total', `Em qualquer criatura: ×${((1 + somaGeral / 100) * fator * estagio).toFixed(2)}`));

  /*
   * A outra metade da party, dita à parte para o total não mentir.
   *
   * O bônus multiplica a experiência da criatura, e o que sobra é dividido
   * entre quem está caçando (`experienciaDividida`, no `party.mjs`) — dois
   * fatos, e só o primeiro é um "multiplicador". Somar a divisão ao total
   * daria um número menor que 1 e esconderia o bônus, que é justamente o que o
   * jogador pediu para ver.
   */
  if (party?.ativa && membrosDaParty > 1) {
    bonusDaExp.append(
      el(
        'div',
        'tip-exp-total',
        `E dividida entre ${membrosDaParty} da party: ×${(((1 + somaGeral / 100) * fator * estagio) / membrosDaParty).toFixed(2)} para você`
      )
    );
  }

  // A prey tem dono: ela só vale contra a criatura dela, e por isso vem depois
  // do total em vez de dentro dele.
  const preys = (character.prey ?? []).filter((slot) => slot.bonus === 'exp' && slot.left > 0);
  for (const slot of preys) {
    const nome = catalog?.bestiary?.[slot.key]?.name ?? slot.key;
    linhaDeBonus(`Prey — ${nome}`, `+${slot.percent}%`, 'só nessa criatura');
  }
  caixa.append(bonusDaExp);

  return caixa;
}

/** Clareia uma cor #rrggbb, para o topo do degradê da barra. */
function clarear(cor, quanto) {
  const n = parseInt(cor.slice(1), 16);
  const canal = (deslocamento) => {
    const v = (n >> deslocamento) & 0xff;
    return Math.round(v + (255 - v) * quanto);
  };
  return `rgb(${canal(16)}, ${canal(8)}, ${canal(0)})`;
}

/*
 * ---- As barras só escrevem quando o número muda ----
 *
 * `setBar` roda a cada estado do servidor — oito vezes por segundo — e
 * reescrevia o preenchimento, as duas cores e o texto das quatro barras toda
 * vez, mesmo com a vida parada. Num telefone eram 60 escritas de DOM por
 * segundo para deixar tudo como estava.
 *
 * O arredondamento ao décimo é o mesmo raciocínio do cooldown (ver
 * `pintarCooldowns`, no actionbar.mjs): sem ele a fração muda a cada ponto de
 * mana regenerado e a guarda não segura nada.
 */
function setBar(id, value, max, label) {
  const bar = $(`bar-${id}`);
  if (!bar) return;
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  const cheio = percent.toFixed(1);
  if (bar.dataset.cheio === cheio && bar.dataset.rotulo === String(label)) return;
  bar.dataset.cheio = cheio;
  bar.dataset.rotulo = String(label);
  bar.style.setProperty('--fill', `${percent}%`);
  /*
   * A vida do personagem muda de cor como a das criaturas.
   *
   * Ela era um vermelho fixo: cheia e quase vazia tinham a mesma cara, e o
   * único aviso era o comprimento. Os degraus são os do client do usuário
   * (`healthColor`, em map.mjs), e o tom claro do degradê sai do mesmo valor.
   */
  if (id === 'hp') {
    const cor = healthColor(percent);
    bar.style.setProperty('--liq-b', cor);
    bar.style.setProperty('--liq-a', clarear(cor, 0.45));
  }
  const text = $(`text-${id}`);
  if (text) text.textContent = label;
  // Em pé não cabe número dentro: o valor exato fica no hover, como no client.
  // Direto no dataset: este `title` era reescrito quatro vezes por segundo, e
  // a conversão automática não alcança quem volta a cada quadro.
  if (bar.parentElement) tipTexto(bar.parentElement, label);
}

/*
 * ---- A faixa do treino ----
 *
 * Duas réguas no alto: a perícia que está sendo treinada e o escudo.
 *
 * Ela só existe enquanto se treina, e some sozinha quando o treino acaba — não
 * há botão para fechá-la, porque um painel que aparece por conta própria e
 * exige um clique para sumir é pior do que um que vai embora sozinho.
 *
 * ---- Por que quatro casas depois da vírgula ----
 *
 * Numa perícia alta, um minuto de treino vale alguns milésimos de por cento.
 * Com duas casas o número fica parado e a faixa passa a mentir: ela promete
 * mostrar progresso e mostra `43,72%` por dez minutos seguidos. Com quatro, o
 * último dígito anda a cada poucos segundos — é a diferença entre uma régua e
 * um enfeite.
 */
const NOME_DA_PERICIA = {
  melee: 'melee fighting',
  distance: 'distance fighting',
  shielding: 'shielding',
  magic: 'magic level',
};

/** `0.437291` -> `43,7291%`. Vírgula porque o jogo inteiro é em português. */
const fracao = (v) => `${((v ?? 0) * 100).toFixed(4).replace('.', ',')}%`;

/*
 * ---- A pílula do Scroll Speed Exercise, dentro da faixa do treino ----
 *
 * O pergaminho deixou de ser um prazo de relógio de parede e virou um SALDO: ele
 * só desce enquanto o personagem bate com uma exercise weapon. Por isso ele
 * aparece exatamente ali — embaixo do botão de parar, dentro do painel do
 * treino que está gastando — e some no instante em que o treino para.
 *
 * O número que ele mostra é o que sobra do saldo, e é o único lugar do jogo em
 * que essa conta anda na frente de quem está olhando.
 */
/*
 * ---- Ela desce quando o cartaz de beta está aberto ----
 *
 * Os dois moram no mesmo lugar: o meio do alto da área de jogo, que é o único
 * pedaço que costuma estar livre. Com o cartaz aberto, a faixa nascia
 * exatamente atrás dele — visível para o código, invisível para quem joga.
 *
 * A altura é MEDIDA, e não um número escrito à mão: o cartaz muda de tamanho
 * com o texto que o servidor manda, e um `top` fixo estaria certo só para o
 * texto de hoje.
 */
/*
 * ---- A barra de vida do BOSS ----
 *
 * Report do Garibas: "nos BOSS, ao inves de ficar sem saber a vida dele, poderia
 * ter uma barra de vida grande na tela pro usuario ver mais facil a vida dele".
 *
 * ---- Como se sabe QUEM e o boss ----
 *
 * Sem campo novo no servidor, e nao por preguica: numa sala de boss vive UM
 * monstro de cada vez. O `povoarAndar` recusa nascer outro enquanto houver um de
 * pe (ver a nota do `state.isBoss`, em `hunt.mjs`), justamente para nao existirem
 * duas barras de vida do mesmo bicho. Entao, dentro da sala, o boss e o unico
 * vivo — e um campo `chefe` no retrato seria uma segunda fonte de verdade para a
 * mesma coisa, que e como as duas passam a discordar.
 *
 * Fora da sala ela nao aparece. A barrinha da cabeca continua sendo a de sempre
 * para os bichos comuns.
 */
/*
 * ---- O nome curto de cada elemento, para o título do ícone ----
 *
 * Os ícones vêm da mesma pasta que a ficha do personagem usa (`el-<id>.png`),
 * de propósito: quem já viu a caveirinha na sua própria ficha de resistências
 * reconhece a mesma caveirinha na barra do boss sem ler nada.
 */
const NOME_CURTO_DO_ELEMENTO = {
  physical: 'físico',
  fire: 'fogo',
  ice: 'gelo',
  earth: 'terra',
  energy: 'energia',
  death: 'morte',
  holy: 'sagrado',
};

/*
 * O que já está desenhado, para não remontar o retrato oito vezes por segundo.
 * O `uid` muda quando a sala troca de dono — é a chave certa, e não o nome:
 * dois bosses podem se chamar igual em salas diferentes.
 */
let bossDesenhado = null;
// De que altura o rastro do dano ainda está descendo.
let rastroDoBoss = { fatia: 1 };

/*
 * ---- A BARRA DO BOSS ----
 *
 * Report do Garibas: "Nos BOSS, ao invés de ficar sem saber a vida dele, poderia
 * ter uma barra de vida grande na tela pro usuário ver mais fácil a vida dele".
 *
 * E depois, o dono: "deixa a barra de vida do boss mais bonita, coloca a
 * caveirinha do elemento morte e etc".
 *
 * O que ela mostra, e por quê:
 *
 *   o RETRATO — é o que faz a barra pertencer àquela luta em vez de ser uma
 *     barra genérica no alto da tela. Montado uma vez por boss;
 *
 *   as RESISTÊNCIAS — a informação que muda o que o jogador faz nos próximos
 *     vinte minutos. Um boss imune a morte com um necromante batendo nele é uma
 *     luta perdida que ninguém entende por quê;
 *
 *   o RASTRO — a faixa clara que fica para trás quando a vida cai. O dano de
 *     área tira dez por cento de uma vez, e sem o rastro o pulo é só um número
 *     diferente. Com ele se VÊ o pedaço que saiu.
 */
function barraDoBoss(estado) {
  const caixa = $('barra-do-boss');
  if (!caixa) return;

  /*
   * O boss vem do servidor num objeto próprio (ver `bossDaSala`, em hunt.mjs) —
   * a lista de criaturas é enxuta e não carrega resistência nem cor. A lista
   * continua sendo a fonte da VIDA, porque ela chega a cada quadro; o objeto do
   * boss é a fonte da cara e das resistências, que não mudam durante a luta.
   */
  const dele = estado?.isBoss ? estado.boss : null;
  const naLista = dele ? (estado.monsters ?? []).find((m) => m.uid === dele.uid) : null;
  const chefe = naLista ?? dele;
  if (!chefe || (chefe.hp ?? 0) <= 0) {
    caixa.hidden = true;
    bossDesenhado = null;
    return;
  }

  const max = Math.max(1, chefe.maxHp ?? 1);
  const vida = Math.max(0, Math.min(max, chefe.hp ?? 0));
  const fatia = vida / max;

  caixa.hidden = false;
  caixa.classList.toggle('aperto', fatia <= 0.33);

  /*
   * ---- O que é montado UMA VEZ ----
   *
   * Esta função roda a cada quadro do estado — oito por segundo. Remontar o
   * retrato e os ícones aqui dentro jogaria fora o canvas do outfit (que anima
   * sozinho) e recomeçaria a animação dele oito vezes por segundo.
   */
  /*
   * ---- A chave da remontagem leva o NOME, e não só o uid ----
   *
   * Report do T T: "quando convidado de um boss, o nome dele no HUD e a imagem
   * estão errados. A vida desce normal, porém os dados errados. Fica certo
   * apenas no líder da party."
   *
   * A vida desce porque ela é escrita FORA deste `if`, a cada quadro. O nome e
   * o retrato são escritos DENTRO, uma vez só — e a guarda era o `uid`.
   *
   * `uid` é um contador POR SESSÃO: o primeiro bicho de qualquer caçada é 1.
   * `bossDesenhado` é de módulo e sobrevive à troca de sessão, então quem já
   * tinha visto uma barra de boss com aquele uid — o convidado que entrou de
   * outra caçada, tipicamente — encontrava a guarda satisfeita e ficava com o
   * nome e a cara do boss ANTERIOR, com a vida do atual descendo por cima.
   * O líder abriu a sala e não tinha barra nenhuma antes, então via certo.
   *
   * A chave passa a ser o que de fato identifica este boss nesta luta. Com o
   * nome dentro dela, um nome errado é impossível por construção: se o texto na
   * tela não é o do `chefe`, a chave não bate e a barra se remonta.
   */
  const chaveDoBoss = `${estado?.huntId ?? ''}:${dele?.uid ?? ''}:${chefe.name}:${dele?.look ?? dele?.lookItem ?? ''}`;
  if (bossDesenhado !== chaveDoBoss) {
    bossDesenhado = chaveDoBoss;
    rastroDoBoss = { fatia: 1 };
    $('boss-nome').textContent = chefe.name;

    const cara = $('boss-cara');
    cara.innerHTML = '';
    /*
     * Outfit ou sprite de ITEM: a Percht Queen e o Brain Head são criaturas
     * cujo `lookTypeEx` é um item, e sem esta segunda tentativa a moldura ficava
     * vazia justamente nos dois bosses mais estranhos. Ver `figuraDaCriatura`.
     */
    if (dele?.look) cara.append(outfitCanvas(dele.look, dele.colors ?? null, 44, 2, true));
    else if (dele?.lookItem) cara.append(itemCanvas(dele.lookItem, 44));

    const fila = $('boss-elementos');
    fila.innerHTML = '';
    /*
     * ---- Resiste em vermelho, fraco em verde ----
     *
     * Valor positivo é resistência (ver `resistenciaDe`, no servidor: fraqueza é
     * resistência negativa). Então o sinal já diz tudo, e a cor só repete o que o
     * sinal diz — para quem lê de relance no meio da luta, que é o caso.
     */
    for (const el_ of dele?.elementos ?? []) {
      const chip = el('span', `boss-el ${el_.valor > 0 ? 'resiste' : 'fraco'}`);
      chip.append(artOrUiIcon(`el-${el_.id}`, el_.id));
      chip.append(el('i', null, `${el_.valor > 0 ? '−' : '+'}${Math.abs(el_.valor)}%`));
      chip.title =
        el_.valor > 0
          ? `resiste a ${NOME_CURTO_DO_ELEMENTO[el_.id] ?? el_.id}: leva ${el_.valor}% a menos`
          : `fraco a ${NOME_CURTO_DO_ELEMENTO[el_.id] ?? el_.id}: leva ${Math.abs(el_.valor)}% a mais`;
      fila.append(chip);
    }
  }

  /*
   * O numero cru e a porcentagem, os dois. Em boss de milhoes a porcentagem e o
   * que responde "falta muito?"; o numero cru e o que deixa comparar uma luta com
   * a outra, e e ele que some quando so ha a barra.
   */
  $('boss-conta').textContent = `${vida.toLocaleString('pt-BR')} / ${max.toLocaleString('pt-BR')}`;
  $('boss-pct').textContent = `${(fatia * 100).toFixed(1)}%`;
  $('boss-cheio').style.width = `${(fatia * 100).toFixed(2)}%`;

  /*
   * O rastro só DESCE, e desce devagar: ele marca de onde a vida caiu. Subir
   * junto quando o boss se cura o faria virar uma segunda barra de vida, e duas
   * barras dizendo a mesma coisa não dizem nada.
   */
  if (fatia > rastroDoBoss.fatia) {
    // Curou: o rastro sobe junto, senão ele viraria uma segunda barra de vida.
    rastroDoBoss.fatia = fatia;
  } else {
    /*
     * Desce 1,2% do total por quadro do estado (oito por segundo): um golpe de
     * dez por cento leva pouco mais de um segundo para ser alcançado, que é
     * tempo de ver o pedaço que saiu sem a faixa ficar arrastando pela luta.
     */
    rastroDoBoss.fatia = Math.max(fatia, rastroDoBoss.fatia - 0.012);
  }
  $('boss-rastro').style.width = `${(rastroDoBoss.fatia * 100).toFixed(2)}%`;
}

/*
 * ---- AS BARRAS DA ARENA DE BOSS DIARIOS ----
 *
 * "dentro da sala de boss diario tem que ter a vida dos bosses que estao la
 *  sabe? igual a vida que aparece em bosses"
 *
 * Igual, sim, mas nao a MESMA. A de cima e' de sala de boss (`isBoss`), e a
 * arena nao e' sala de boss — e' de proposito, ver `paraABossPouch` no
 * hunt.mjs. E la' vive um so'; aqui vivem quantos a equipe plantar, entao aqui
 * e' uma pilha e nao uma barra.
 *
 * ---- Por que ela nao tem retrato nem resistencia ----
 *
 * Tres bosses com o retrato da barra de cima seriam trezentos pixels de altura
 * em cima do mapa. Aqui cada um e' uma linha: nome, quanto falta e o trilho.
 * Quem quiser a ficha do bicho tem a Cyclopedia; o que esta pilha responde e'
 * "quanto falta para ele cair", que e' a pergunta de quem esta' batendo.
 *
 * ---- E por que ela se remonta pela CHAVE ----
 *
 * Isto roda a cada quadro do estado, oito por segundo. Refazer os nos aqui
 * dentro jogaria fora o trilho no meio da transicao de largura, e a barra
 * andaria aos trancos. Entao os nos ficam, guardados por uid, e o que muda a
 * cada quadro e' so' a largura e o texto — a mesma economia do `bossCdVivo`,
 * no main.mjs.
 */
const barrasDaArenaVivas = { chave: null, linhas: new Map() };

/*
 * A grade de loot de um boss da arena, montada uma vez e guardada no no'.
 *
 * O teto de 40 linhas e' o mesmo da ficha do bestiary e do cartaz: 33 bichos
 * deste jogo passam disso, e uma parede de itens pendurada em cima do mapa
 * deixa de ser uma espiada e vira uma janela.
 */
function pintarLootDaArena(caixa, entry, catalog) {
  caixa.innerHTML = '';
  const lista = lootComGemas({ ...entry, loot: (entry.loot ?? []).slice(0, 40), boss: true }, catalog);
  const grade = el('div', 'bag');
  let quantos = 0;
  for (const drop of lista) {
    if (!drop.id) continue;
    const cela = el('div', 'cell');
    cela.append(itemCanvas(drop.id, 30));
    tipFor(cela, drop.id, `${(drop.chance * 100).toFixed(drop.chance < 0.01 ? 2 : 1)}% de chance`);
    grade.append(cela);
    quantos++;
  }
  caixa.append(el('b', null, quantos ? `O que ${entry.name} solta` : entry.name));
  caixa.append(quantos ? grade : el('p', 'empty', 'Este boss não tem tabela de loot.'));
}

function barrasDaArena(estado, catalog) {
  const caixa = $('barras-da-arena');
  if (!caixa) return;

  const bosses = estado?.bossesDaArena ?? null;
  if (!bosses?.length) {
    caixa.hidden = true;
    barrasDaArenaVivas.chave = null;
    barrasDaArenaVivas.linhas = new Map();
    return;
  }
  caixa.hidden = false;

  const chave = bosses.map((b) => `${b.uid}:${b.name}`).join('|');
  if (barrasDaArenaVivas.chave !== chave) {
    barrasDaArenaVivas.chave = chave;
    barrasDaArenaVivas.linhas = new Map();
    caixa.innerHTML = '';
    for (const boss of bosses) {
      const linha = el('div', 'arena-boss');

      /*
       * ---- O retrato ----
       *
       * "a barra de vida do boss tem que ter a imagem do boss tambem".
       *
       * Mesma moldura da barra de sala (`.boss-cara`), menor. E' ela que faz a
       * linha pertencer AQUELE boss: com tres deles na area, tres barras
       * vermelhas iguais obrigam a ler o nome para saber de quem e' cada uma.
       *
       * O desenho e montado UMA vez, aqui dentro — o canvas do outfit anima
       * sozinho, e refaze-lo oito vezes por segundo reiniciaria a animacao dele
       * oito vezes por segundo.
       */
      const cara = el('div', 'boss-cara arena-cara');
      if (boss.look) cara.append(outfitCanvas(boss.look, boss.colors ?? null, 30, 2, true));
      else if (boss.lookItem) cara.append(itemCanvas(boss.lookItem, 30));
      linha.append(cara);

      const corpo = el('div', 'arena-corpo');
      const topo = el('div', 'arena-topo');
      const conta = el('span', 'arena-conta');
      topo.append(el('b', null, boss.name));

      /*
       * ---- As resistencias, como na barra de sala ----
       *
       * "e as fraquezas e resistencias mostrar dos bosses na sala de boss
       *  diario tambem com o icone sabe? igual como e' la em boss normal"
       *
       * Mesmas classes e mesma leitura do `barraDoBoss`: valor positivo e'
       * resistencia (fraqueza e' resistencia negativa, ver `resistenciaDe`, no
       * servidor), entao o sinal ja' diz tudo e a cor so' repete o que o sinal
       * diz — para quem le de relance no meio da luta, que e' o caso.
       *
       * Montadas aqui dentro, uma vez: elas nao mudam durante a briga.
       */
      const fila = el('span', 'boss-elementos arena-elementos');
      for (const elemento of boss.elementos ?? []) {
        const chip = el('span', `boss-el ${elemento.valor > 0 ? 'resiste' : 'fraco'}`);
        chip.append(artOrUiIcon(`el-${elemento.id}`, elemento.id));
        chip.append(el('i', null, `${elemento.valor > 0 ? '−' : '+'}${Math.abs(elemento.valor)}%`));
        chip.title =
          elemento.valor > 0
            ? `resiste a ${NOME_CURTO_DO_ELEMENTO[elemento.id] ?? elemento.id}: leva ${elemento.valor}% a menos`
            : `fraco a ${NOME_CURTO_DO_ELEMENTO[elemento.id] ?? elemento.id}: leva ${Math.abs(elemento.valor)}% a mais`;
        fila.append(chip);
      }
      topo.append(conta);

      /*
       * ---- E o icone do loot ----
       *
       * "e o icone de loot que mostraria oq eles droopa".
       *
       * Mesmo gesto do cartaz: passar o mouse abre, o clique prende para quem
       * quiser ler com calma, e no celular o clique e' o unico gesto que ha'.
       */
      const caixaDoLoot = el('div', 'arena-loot-caixa');
      caixaDoLoot.hidden = true;
      const entry = boss.key ? catalog?.bestiary?.[boss.key] : null;
      if (entry) {
        const botao = el('button', 'arena-loot-botao');
        botao.type = 'button';
        botao.textContent = 'Loot';
        tipTexto(botao, `o que ${boss.name} solta`);

        let presa = false;
        const abrir = () => {
          if (!caixaDoLoot.childElementCount) pintarLootDaArena(caixaDoLoot, entry, catalog);
          caixaDoLoot.hidden = false;
          botao.classList.add('aberto');
        };
        const fechar = () => {
          if (presa) return;
          caixaDoLoot.hidden = true;
          botao.classList.remove('aberto');
        };
        botao.addEventListener('mouseenter', abrir);
        botao.addEventListener('mouseleave', fechar);
        caixaDoLoot.addEventListener('mouseleave', fechar);
        botao.addEventListener('click', () => {
          presa = !presa;
          if (presa) abrir();
          else { caixaDoLoot.hidden = true; botao.classList.remove('aberto'); }
        });
        topo.append(botao);
      }

      const trilho = el('div', 'boss-trilho arena-trilho');
      const cheio = el('i', 'arena-cheio');
      const pct = el('span', 'arena-pct');
      trilho.append(cheio, pct);

      /*
       * ---- As resistencias em LINHA PROPRIA ----
       *
       * "algumas fraquezas do card de boss do boss diario ta aparecendo
       *  cortado, olha".
       *
       * Estavam entre o nome e a contagem, como na barra de sala — e la' cabem
       * porque a barra so' tem nome, elementos e vida. Aqui a mesma fileira
       * disputa com o retrato, com a contagem E com o botao de Loot, e o
       * `overflow: hidden` que impede a segunda linha cortava o ultimo chip ao
       * meio: sobrava o icone e um "−".
       *
       * Entao ela desce. Cortar informacao para caber e' pior do que uma linha
       * a mais numa barra que ja' tem tres.
       */
      corpo.append(topo);
      if (fila.childElementCount) corpo.append(fila);
      corpo.append(trilho);
      linha.append(corpo, caixaDoLoot);
      caixa.append(linha);
      barrasDaArenaVivas.linhas.set(boss.uid, { linha, conta, cheio, pct });
    }
  }

  for (const boss of bosses) {
    const nos = barrasDaArenaVivas.linhas.get(boss.uid);
    if (!nos) continue;
    const max = Math.max(1, boss.maxHp ?? 1);
    const vida = Math.max(0, Math.min(max, boss.hp ?? 0));
    const fatia = vida / max;
    nos.conta.textContent = `${vida.toLocaleString('pt-BR')} / ${max.toLocaleString('pt-BR')}`;
    nos.pct.textContent = `${(fatia * 100).toFixed(1)}%`;
    nos.cheio.style.width = `${(fatia * 100).toFixed(2)}%`;
    /* Abaixo de um terco ela esquenta, como a barra de cima. */
    nos.linha.classList.toggle('aperto', fatia <= 0.33);
  }
}

function empilharNoTopo() {
  /*
   * O fundo da mais baixa das que estão em cena, MEDIDO — o cartaz muda de
   * tamanho com o texto que o servidor manda, e a faixa de treino cresce com as
   * barras, então nenhum número escrito à mão estaria certo por muito tempo.
   */
  const fundoDe = (...ids) => {
    let maior = 0;
    for (const id of ids) {
      const no = $(id);
      if (!no || no.hidden) continue;
      const r = no.getBoundingClientRect();
      if (r.height) maior = Math.max(maior, Math.round(r.bottom));
    }
    return maior;
  };

  const faixa = $('treino-faixa');
  if (faixa && !faixa.hidden) {
    const acima = fundoDe('cartaz-beta');
    faixa.style.top = acima ? `${acima + 8}px` : '';
  }

  /*
   * A dos relógios embaixo de todas: cartaz, novidades e treino. Ela é a única
   * que pode conviver com as outras três — quem tem um buff ligado costuma
   * estar caçando ou treinando —, e é por isso que ela é a que se empilha.
   *
   * A não ser que tenha sido ARRASTADA: aí quem manda é onde a pessoa a pôs, e
   * mexer nisso a faria pular de volta sozinha.
   */

  /*
   * A do boss embaixo de todas as faixas, e MEDIDA como as outras: "sem ficar
   * por cima das outras coisas" foi o pedido, e as faixas de cima aparecem e
   * somem sozinhas (o auto boss liga, o cartaz de beta e fechado, as novidades
   * saem quando lidas). Um numero cravado estaria errado metade do tempo.
   */
  const doBoss = $('barra-do-boss');
  if (doBoss && !doBoss.hidden) {
    const acima = fundoDe('cartaz-beta', 'faixa-novidades', 'faixa-autoboss', 'treino-faixa');
    doBoss.style.top = acima ? `${acima + 8}px` : '';
  }

  /*
   * A pilha da arena entra na mesma fila. Ela e a barra de sala de boss nunca
   * estao na tela juntas — a arena nao e' sala de boss —, mas as faixas de cima
   * aparecem em qualquer lugar, e e' delas que a pilha precisa se desviar.
   */
  const daArena = $('barras-da-arena');
  if (daArena && !daArena.hidden) {
    const acima = fundoDe('cartaz-beta', 'faixa-novidades', 'faixa-autoboss', 'treino-faixa', 'barra-do-boss');
    daArena.style.top = acima ? `${acima + 8}px` : '';
  }

  // A barra da fase da campanha, na mesma fila (nunca junto da do boss).
  const daFase = $('barra-da-fase');
  if (daFase && !daFase.hidden) {
    const acima = fundoDe('cartaz-beta', 'faixa-novidades', 'faixa-autoboss', 'treino-faixa');
    daFase.style.top = acima ? `${acima + 6}px` : '';
  }

  /*
   * As pílulas dos relógios (boosts, buffs) por ÚLTIMO, embaixo de TODAS as faixas —
   * inclusive a da fase, a do boss e a da arena. Antes ela só se desviava do cartaz,
   * das novidades e do treino, e caía em cima do nome da fase ("o boost fica em cima
   * do nome da fase").
   */
  const dosBuffs = $('pilulas-de-efeito');
  if (dosBuffs && !dosBuffs.hidden && !dosBuffs.classList.contains('arrastada')) {
    const acima = fundoDe('cartaz-beta', 'faixa-novidades', 'faixa-autoboss', 'treino-faixa', 'barra-do-boss', 'barras-da-arena', 'barra-da-fase');
    dosBuffs.style.top = acima ? `${acima + 8}px` : '';
  }
}

/*
 * ---- "Auto Boss ativo", no alto da tela ----
 *
 * A rotação é a única coisa do jogo que continua tomando decisões pelo jogador
 * enquanto ele olha para outra tela: ela entra em salas, gasta cooldown de doze
 * horas e conta entradas da leva. Um automático desse tamanho anunciado só
 * dentro da aba de Bosses é um automático invisível para quem não foi conferir.
 *
 * O resumo diz as duas coisas que decidem se ele quer parar: quantas entradas
 * da leva já foram e qual é o próximo da fila.
 */
/*
 * ---- Os relogios das magias ligadas ----
 *
 * "magias como utani hur, utamo tempo san, utito tempo, que ativam e ficam um
 * tempo, tem que mostrar o reloginho em cima da barra de vida e a sprite da
 * magia."
 *
 * E, depois de ver: "nao era dentro do card das barras debaixo, era um card
 * flutuando; em vez de ser a sprite e o relogio do lado, aumente em 20% o
 * cardzinho e coloque o tempo pequeno dentro."
 *
 * Entao ele e' um card so: a sprite ocupa o card inteiro e o tempo mora DENTRO,
 * no pe, por cima da figura. Ficar ao lado gastava a largura de tres cards para
 * mostrar dois, e numa fileira de quatro magias ligadas isso e' meia tela.
 *
 * A lista vem pronta do servidor (`hunt.buffs`), ja' filtrada e com o tempo que
 * RESTA em milissegundos — o relogio da sessao nao existe deste lado.
 *
 * Refeita a cada quadro de proposito: sao no maximo tres ou quatro cards, e
 * guardar os nos para so' trocar o texto custaria um segundo caminho para o
 * estado ficar velho — o mesmo argumento da faixa de efeitos logo acima.
 */
/** O lado do card, em pixels. Era 18 de sprite com o texto ao lado; +20%. */
const LADO_DO_RELOGIO = 22;

/*
 * ---- A altura da barra de ações, sem medir a cada quadro ----
 *
 * Medido com a Kina caçando: `renderBuffsDaMagia` era a função mais cara da
 * interface (~7 ms de CPU por segundo), e quase tudo era o `offsetHeight` lido
 * a CADA `state` para a assinatura — o que obriga o navegador a calcular o
 * layout na hora, no meio da atualização. A altura só muda quando a barra muda
 * de tamanho (recolhe, a ficha encaixa, a fita das réguas aparece); quem avisa
 * é o `ResizeObserver`, e a caixa dos buffs é reposicionada ali mesmo.
 */
let alturaDaBarraDeAcoes = null;
let vigiaDaBarraDeAcoes = null;
function alturaDaBarra() {
  const barra = $('actionbar');
  if (!barra) return 0;
  if (!vigiaDaBarraDeAcoes && typeof ResizeObserver === 'function') {
    vigiaDaBarraDeAcoes = new ResizeObserver(() => {
      alturaDaBarraDeAcoes = barra.offsetHeight;
      const caixa = $('hud-buffs');
      if (caixa && !caixa.hidden) caixa.style.bottom = `${alturaDaBarraDeAcoes + 6}px`;
    });
    vigiaDaBarraDeAcoes.observe(barra);
  }
  alturaDaBarraDeAcoes ??= barra.offsetHeight;
  return alturaDaBarraDeAcoes;
}

/*
 * Acima de um minuto o relogio conta MINUTOS. O magic shield dura mais de
 * tres minutos, e "204s" e' um numero que ninguem le' de relance.
 */
const relogioDoBuff = (segundos) =>
  segundos >= 60 ? `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}` : `${segundos}`;
const balaoDoBuff = (buff, segundos) =>
  `${buff.nome} — ${segundos >= 60 ? `${Math.floor(segundos / 60)}min ${segundos % 60}s` : `${segundos}s`} restantes`;

function renderBuffsDaMagia(hunt) {
  const caixa = $('hud-buffs');
  if (!caixa) return;

  const buffs = hunt?.buffs ?? [];
  /*
   * ---- Os cartões só são REMONTADOS quando o conjunto de magias muda ----
   *
   * Antes a caixa inteira (com o ícone de canvas de cada magia) era apagada e
   * refeita a cada segundo, só porque o relógio mudou. Agora, com as mesmas
   * magias na mesma ordem, o relógio, o piscar dos últimos cinco segundos e o
   * balão de cada cartão são trocados no lugar.
   */
  const estrutura = buffs.map((buff) => `${buff.icone}:${buff.nome}`).join(',');
  // As cargas do PoE (Tolerância, Frenesi, Poder): o número muda o nome, então o cartão é refeito quando ganha ou perde carga.
  if (buffs.length && !caixa.hidden && caixa.dataset.estrutura === estrutura && caixa.children.length === buffs.length) {
    buffs.forEach((buff, i) => {
      const card = caixa.children[i];
      const segundos = Math.ceil(buff.resta / 1000);
      const texto = card.querySelector('b');
      if (texto) texto.textContent = relogioDoBuff(segundos);
      // Os ultimos cinco segundos piscam: e' quando renovar ainda vale a pena.
      card.classList.toggle('acabando', segundos <= 5);
      tipTexto(card, balaoDoBuff(buff, segundos));
    });
    return;
  }
  if (!buffs.length && caixa.hidden) return;
  caixa.dataset.estrutura = estrutura;
  caixa.hidden = !buffs.length;
  caixa.innerHTML = '';
  if (!buffs.length) return;

  // O card flutua solto na pagina: fica logo acima de onde a barra de acoes termina.
  caixa.style.bottom = `${alturaDaBarra() + 6}px`;

  for (const buff of buffs) {
    const card = document.createElement('div');
    card.className = 'hud-buff';
    // A sprite da magia, do mesmo indice que a barra de acoes usa.
    if (buff.icone != null) card.append(hudCtx.spellIcon(buff.icone, LADO_DO_RELOGIO));
    // Carga do PoE: a bolinha da cor dela (Tolerância vermelha, Frenesi verde, Poder azul) com o número.
    else if (buff.carga) {
      const bola = document.createElement('span');
      bola.className = `hud-carga carga-${buff.carga}`;
      bola.textContent = String(buff.n ?? '');
      card.append(bola);
    }
    const segundos = Math.ceil(buff.resta / 1000);
    const texto = document.createElement('b');
    texto.textContent = relogioDoBuff(segundos);
    if (segundos <= 5) card.classList.add('acabando');
    card.append(texto);
    tipTexto(card, balaoDoBuff(buff, segundos));
    caixa.append(card);
  }
}

function renderAutoBossFaixa(character) {
  const faixa = $('faixa-autoboss');
  if (!faixa) return;

  const auto = character.autoBoss ?? null;
  /*
   * ---- Ela aparece para QUEM FOI LEVADO também ----
   *
   * `ligado` é de quem ligou a rotação. O convidado nunca ligou nada — e era
   * justamente ele quem estava sendo levado de sala em sala sem nada na tela
   * dizendo por quem, com que leva, nem como sair. O automático mais invisível
   * do jogo era o dos outros.
   *
   * `convidadoPor` vem do servidor com o nome de quem está levando (ver
   * `rotacaoQueMeLeva`), e é nulo quando a rotação é a dele.
   */
  const convidado = !auto?.ligado && !!auto?.convidadoPor;
  if (!auto?.ligado && !convidado) {
    faixa.hidden = true;
    return;
  }
  faixa.hidden = false;

  const selo = faixa.querySelector('.selo');
  if (selo) selo.textContent = convidado ? `Auto Boss de ${auto.convidadoPor}` : 'Auto Boss ativo';

  const resumo = $('faixa-autoboss-resumo');
  if (resumo && convidado) {
    /*
     * A leva do convidado é a DELE, e o número dela é o que ele precisa ver: a
     * carona gasta a mesma cota de quinze que ele gastaria sozinho. Fechada,
     * ele fica no templo enquanto a rotação segue sem ele — dizer isso aqui
     * evita a leitura de que a party o esqueceu.
     *
     * O relógio exato mora na aba de Bosses ("próxima leva em ..."). Aqui não:
     * a faixa é uma linha, e ela responde "o que está acontecendo comigo".
     */
    resumo.textContent = auto.passe
      ? 'você vai junto · sem limite de bosses'
      : auto.espera > 0
        ? `sua leva fechou — você fica de fora das próximas salas`
        : `você vai junto · ${auto.usados} de ${auto.teto} da SUA leva`;
  } else if (resumo) {
    /*
     * Com o passe não há leva para contar — dizer "3 de 15" a quem comprou
     * justamente o fim da conta seria mostrar um limite que não existe mais.
     */
    const leva = auto.passe ? 'sem limite de bosses' : `${auto.usados} de ${auto.teto} desta leva`;
    /*
     * A fila é o que FALTA, e não a lista inteira.
     *
     * Com quinze bosses marcados, escrever os quinze encheria a faixa de nomes
     * que já foram — e o que ela precisa responder é "o que vem agora". Três
     * cabem na largura; o resto vira um número.
     */
    const feitos = new Set(auto.feitos ?? []);
    const faltam = (auto.bosses ?? [])
      .map((id, i) => ({ id, nome: auto.nomes?.[i] ?? id }))
      .filter((entrada) => !feitos.has(entrada.id));
    const fila = faltam.length
      ? ` · a seguir: ${faltam.slice(0, 3).map((entrada) => entrada.nome).join(', ')}` +
        (faltam.length > 3 ? ` +${faltam.length - 3}` : '')
      : '';
    resumo.textContent = `${leva}${fila}`;
  }

  const parar = $('faixa-autoboss-parar');
  /*
   * O botão muda de dono junto com a faixa. Para quem ligou, ele desativa a
   * rotação; para quem foi levado, não há rotação para desativar — o que ele
   * pode fazer é sair da party, e é isso que o botão diz.
   *
   * Religado a cada quadro, e não uma vez só: `!parar.onclick` guardava o
   * primeiro modo em que a faixa apareceu, e quem entrasse numa party depois
   * de ter tido rotação própria ficaria com o botão do dono.
   *
   * As duas perguntas moram em `main.mjs`: elas precisam do modal, e o HUD não
   * o conhece.
   */
  if (parar) {
    parar.textContent = convidado ? 'Sair da party' : 'Desativar';
    parar.onclick = convidado
      ? () => hudCtx?.sairDoAutoBossConvidado?.()
      : () => hudCtx?.pararAutoBoss?.();
  }
}

function renderEfeitosFaixa(character) {
  const faixa = $('efeitos-faixa');
  if (!faixa) return;

  /*
   * Duas condições, e as duas são necessárias: ter o pergaminho E estar
   * treinando com exercise. É o único momento em que ele gasta — fora dele o
   * saldo fica parado, e um relógio parado na tela pergunta mais do que
   * responde.
   */
  const scroll = character.efeitos?.exerciseSpeed ?? null;
  const treinando = !!character.exercicio?.treinando;

  // A oferta mora na LINHA DO TÍTULO, ao lado do relógio. Ver 'renderOferta'.
  renderOferta(treinando && !scroll);

  if (!treinando || !scroll) {
    faixa.hidden = true;
    faixa.innerHTML = '';
    return;
  }

  faixa.hidden = false;
  /*
   * Refeita a cada quadro, e é barato: um '<canvas>' de 22px e três textos. O
   * relógio anda de segundo em segundo, então guardar o nó para só trocar o
   * texto economizaria quase nada e custaria um segundo caminho para o estado
   * ficar velho.
   */
  faixa.innerHTML = '';
  const pill = el('div', 'efeito-pill gastando');
  pill.append(itemCanvas(ITEM_DO_PERGAMINHO, 22));

  const texto = el('div', 'efeito-pill-texto');
  texto.append(el('span', 'efeito-pill-nome', `Scroll Speed ×${scroll.fator}`));
  const linha = el('div', 'efeito-pill-linha');
  linha.append(el('b', 'efeito-pill-tempo', formatTime(scroll.restante)));
  linha.append(el('em', 'efeito-pill-estado', 'de treino dobrado'));
  texto.append(linha);
  pill.append(texto);
  faixa.append(pill);
}


/*
 * ---- Os relógios do que está ligado ----
 *
 * Faixa própria, e não a do pergaminho: aquela mora dentro de `#treino-faixa`,
 * que fica fora da tela quando ninguém está treinando. Pôr estas pílulas lá
 * dentro as deixava no documento e invisíveis — o pior defeito possível, porque
 * o código parece certo e o teste de DOM passa.
 *
 * Cada grupo (`GRUPOS_DE_EFEITO`) monta as pílulas dele e pode ser desligado.
 * Uma função por grupo, e não um `if` grande: o que muda de um para o outro é
 * só de onde sai o número e qual é o desenho.
 */
function pilulasDosBuffs(character) {
  return (character.efeitos?.buffPower ?? [])
    .filter((linha) => linha.restante > 0)
    .map((buff) => ({
      classe: `buff-${buff.cor ?? 'dourado'}`,
      item: buff.item,
      nome: buff.nome,
      restante: buff.restante,
      estado: 'restantes',
      balao: buff.resumo,
    }));
}

function pilulasDeExp(character) {
  return (character.efeitos?.exp?.fontes ?? [])
    .filter((fonte) => fonte.restante > 0)
    /*
     * O Buff Power Exp já tem a linha dele no grupo dos Buff Power (report:
     * "buff power EXP tá duplicado"). Aqui ele só entra se aquele grupo foi
     * tirado da tela — senão o mesmo relógio aparecia duas vezes.
     */
    .filter((fonte) => !(fonte.fonte === 'buff-power' && efeitoNaTela('buffpower')))
    .map((fonte) => ({
      classe: 'buff-verde',
      item: ITEM_DA_FONTE[fonte.fonte] ?? null,
      arte: ITEM_DA_FONTE[fonte.fonte] == null ? 'ficha-exp' : null,
      nome: `${NOME_DA_FONTE_DE_EXP[fonte.fonte] ?? 'XP Boost'} +${fonte.percent}%`,
      restante: fonte.restante,
      estado: 'de experiência',
      balao: `+${fonte.percent}% de experiência enquanto durar. As fontes somam entre si.`,
    }));
}

/*
 * Os dois passes. `instance` e `divina` chegam do servidor como `{ ate }` ou
 * nulo — ver `acessoView`, em `instance.mjs`. O `restante` é posto aqui dentro
 * por `contarOsPrazos`, na porta de entrada do estado: o servidor manda o
 * INSTANTE do vencimento, que não muda, e a conta é de quem desenha.
 */
function pilulaDoPasse(character, campo, item, nome) {
  const acesso = character[campo];
  if (!(acesso?.restante > 0)) return [];
  return [
    {
      classe: 'buff-dourado',
      item,
      nome,
      restante: acesso.restante,
      estado: 'de acesso',
      balao: `${nome} liberadas. Usar outro pergaminho soma mais 24 horas.`,
    },
  ];
}

const PILULAS_DO_GRUPO = {
  buffpower: pilulasDosBuffs,
  exp: pilulasDeExp,
  instance: (character) => pilulaDoPasse(character, 'instance', ITEM_INSTANCE_HUNTS, 'Instance Hunts'),
  divina: (character) => pilulaDoPasse(character, 'divina', ITEM_DIVINE_HUNTS, 'Divine Hunts'),
};

/*
 * ---- Tudo o que está correndo agora, numa lista só ----
 *
 * Uma fonte para as duas telas: as pílulas do alto e a janela "Buffs e Boosts".
 * Se cada uma montasse a própria lista, uma delas ficaria para trás no dia em
 * que um efeito novo entrasse — que é exatamente o que aconteceu com a barra de
 * experiência e o Buff Power Exp.
 *
 * Os grupos desligados ficam de fora das DUAS: "quais relógios eu quero ver" é
 * uma pergunta sobre o conteúdo, e não sobre onde ele aparece. Se a janela
 * mostrasse o que a pessoa tirou, ela mexeria no ajuste e continuaria vendo o
 * que quis tirar — só que noutro canto.
 */
export function linhasDeEfeito(character) {
  const linhas = [];
  if (!character) return linhas;
  for (const grupo of GRUPOS_DE_EFEITO) {
    if (!efeitoNaTela(grupo.id)) continue;
    for (const linha of PILULAS_DO_GRUPO[grupo.id]?.(character) ?? []) {
      linhas.push({ ...linha, grupo });
    }
  }
  return linhas;
}

function renderPilulasDeEfeito(character) {
  const faixa = $('pilulas-de-efeito');
  if (!faixa) return;

  // No modo janela, a faixa não existe: é uma escolha só, e não as duas.
  const linhas = modoDosEfeitos() === 'pilulas' ? linhasDeEfeito(character) : [];

  if (!linhas.length) {
    faixa.hidden = true;
    faixa.innerHTML = '';
    // Sem isto, a faixa voltaria vazia: a assinatura antiga bateria com a nova
    // e o bloco de cima trocaria o texto de nós que não existem mais.
    delete faixa.dataset.assinatura;
    return;
  }

  faixa.hidden = false;
  ligarArrastoDasPilulas();
  aplicarArranjoDasPilulas();

  /*
   * ---- Refeita SÓ quando a lista muda ----
   *
   * "às vezes eu tenho que clicar umas 3x pra conseguir fechar o relógio na
   *  tela no xiszinho."
   *
   * E era isso: a faixa era remontada a cada quadro, quatro vezes por segundo.
   * Um clique é `pointerdown` num nó e `pointerup` no MESMO nó — se o botão for
   * trocado por outro no meio, o navegador não dispara `click` nenhum. Com o ×
   * nascendo de novo 250ms depois de cada quadro, acertá-lo era sorte: pegava
   * quem soltasse o botão dentro da mesma fatia de tempo em que apertou.
   *
   * Agora a assinatura da lista decide. Enquanto ela for a mesma — mesmas
   * pílulas, mesma ordem —, só o TEXTO DO RELÓGIO é reescrito, e os nós (o × e
   * o balão junto) continuam os mesmos o tempo todo. Quando um buff entra,
   * vence ou é desligado, a assinatura muda e a faixa é remontada uma vez.
   *
   * A assinatura não inclui o tempo de propósito: ele muda a cada segundo, e
   * incluí-lo seria voltar a remontar tudo.
   */
  const assinatura = linhas.map((linha) => `${linha.grupo.id}:${linha.item ?? linha.arte}:${linha.nome}`).join('|');
  if (faixa.dataset.assinatura === assinatura) {
    const relogios = faixa.querySelectorAll('.efeito-pill-tempo');
    linhas.forEach((linha, i) => {
      const alvo = relogios[i];
      const texto = formatTime(linha.restante);
      // Só escreve quando mudou: escrever o mesmo texto refaz o nó de texto e
      // atrapalha uma seleção do usuário sobre ele.
      if (alvo && alvo.textContent !== texto) alvo.textContent = texto;
    });
    return;
  }
  faixa.dataset.assinatura = assinatura;

  faixa.innerHTML = '';
  for (const linha of linhas) {
    const pill = el('div', `efeito-pill ${linha.classe}`);
    const arte = linha.item ? itemCanvas(linha.item, 22) : artOrUiIcon(linha.arte ?? '', '');
    if (arte) pill.append(arte);

    const texto = el('div', 'efeito-pill-texto');
    texto.append(el('span', 'efeito-pill-nome', linha.nome));
    const tempo = el('div', 'efeito-pill-linha');
    tempo.append(el('b', 'efeito-pill-tempo', formatTime(linha.restante)));
    tempo.append(el('em', 'efeito-pill-estado', linha.estado));
    texto.append(tempo);
    pill.append(texto);
    /*
     * O que ele dá vai no BALÃO e não na pílula: "+3000 HP, +3000 Mana, +15% de
     * dano crítico, +10% de life leech e +10% de mana leech" não cabe numa
     * faixa de canto, e o que se olha de relance é o relógio.
     */
    tipTexto(pill, `${linha.balao} Clique no × para tirar ${linha.grupo.nome} da tela.`);

    /*
     * O × fica na PRÓPRIA pílula, e não só nas Opções, e desliga O GRUPO dela.
     *
     * Quem quer esconder isto está olhando para isto, agora. Mandar procurar um
     * menu é transformar um incômodo de um clique num de quatro — e quem não
     * achar o menu vai conviver com o incômodo em vez de resolvê-lo.
     */
    const fechar = el('button', 'efeito-pill-fechar', '×');
    fechar.type = 'button';
    tipTexto(fechar, `Tirar ${linha.grupo.nome} da tela. Para trazer de volta: Opções → Relógios na tela.`);
    /*
     * No APERTAR, e não no clique inteiro.
     *
     * O clique exige que o botão sobreviva do apertar ao soltar, e esta faixa
     * vive num canto que se redesenha. A assinatura acima já resolve o caso
     * comum; isto fecha o resto — o quadro em que a lista muda de verdade
     * (outro buff venceu no mesmo instante) continuaria comendo o clique.
     *
     * `stopPropagation` para o arrasto não começar por baixo, e `preventDefault`
     * para o navegador não emitir o clique depois num nó que já não existe.
     */
    fechar.onpointerdown = (evento) => {
      evento.stopPropagation();
      evento.preventDefault();
      mostrarEfeitoNaTela(linha.grupo.id, false);
      hudCtx?.notice?.(`${linha.grupo.nome} fora da tela. Opções → Relógios na tela traz de volta.`);
    };
    pill.append(fechar);

    faixa.append(pill);
  }
}

/*
 * ---- A oferta do pergaminho, LOGO ACIMA do "Parar treino" ----
 *
 * Ela já esteve na linha do título, espremida ao lado do relógio: ali cabia uma
 * linha de dez pixels, e duas linhas com o nome do item não cabiam de jeito
 * nenhum — o botão saía apertado e o alvo do clique ficava fino demais para se
 * acertar sem mirar.
 *
 * Aqui ela é uma faixa da largura do cartaz, imediatamente acima do botão de
 * parar: o mesmo lugar para onde o olho já vai quando se pensa no treino, e
 * espaço de sobra para as duas linhas e para o dedo.
 *
 * Discreta ainda: quem está treinando não pode ser interrompido por um anúncio,
 * mas deve enxergar a porta quando olhar para lá.
 *
 * O nó é criado UMA vez e escondido depois: refazê-lo a cada quadro tiraria o
 * clique de baixo do dedo quatro vezes por segundo.
 */
function renderOferta(mostrar) {
  const faixa = $('treino-faixa');
  const parar = $('treino-faixa-parar');
  if (!faixa || !parar) return;

  let oferta = faixa.querySelector('.efeito-oferta');
  if (!oferta) {
    oferta = el('button', 'efeito-oferta');
    oferta.type = 'button';
    oferta.append(itemCanvas(ITEM_DO_PERGAMINHO, 22));
    /*
     * Duas linhas: a CHAMADA em cima e o NOME DO ITEM embaixo.
     *
     * "Treine mais rápido" diz o que a pessoa ganha; "Scroll Speed Exercise"
     * diz o que ela vai procurar na loja. Uma linha só teria de escolher entre
     * as duas — e quem só lê o nome do produto não sabe para que ele serve.
     */
    const texto = el('div', 'oferta-texto');
    texto.append(el('span', 'oferta-chamada', 'Treine mais rápido'));
    texto.append(el('em', 'oferta-item', 'Scroll Speed Exercise'));
    oferta.append(texto);
    tipTexto(
      oferta,
      'Scroll Speed Exercise: dobra a velocidade das exercise weapons, e só gasta enquanto você treina. Clique para ver na loja.'
    );
    /*
     * Sem termo de busca: a prateleira de Boosts é curta e o card fica em
     * destaque nela (ver 'storeDestaque', em panels.mjs). A busca da loja não
     * varre esta prateleira, e mandar um termo que ela não acha abriria a loja
     * numa tela dizendo "nada encontrado".
     */
    oferta.onclick = () => hudCtx?.abrirLojaEm?.('boosts', '', ITEM_DO_PERGAMINHO);
    // Acima do botão de parar, e não no fim da faixa: o `insertBefore` é o que
    // garante a ordem mesmo quando a pílula do saldo já está montada embaixo.
    faixa.insertBefore(oferta, parar);
  }
  oferta.hidden = !mostrar;
}

function renderTreinoFaixa(character) {
  const faixa = $('treino-faixa');
  if (!faixa) return;

  /*
   * Três treinos, dois deles com régua.
   *
   * O do pátio vive na sessão da caçada (`state.hunt.treino`); o de exercise
   * vive no personagem. O offline não tem régua porque quem o usa não está
   * olhando a tela — é o ponto dele.
   */
  /*
   * O pátio se reconhece pelo `huntId`, e não por uma bandeira própria.
   *
   * O retrato da caçada (`snapshot`) manda `huntId`, e o do pátio é `treino` —
   * o mesmo id que `treino.mjs` dá à hunt dele. Acrescentar um campo só para
   * esta faixa seria um segundo jeito de dizer a mesma coisa.
   */
  const noPatio = hudCtx?.state?.hunt?.huntId === 'treino';
  const exercicio = character.exercicio?.treinando ? character.exercicio : null;
  const pericia = exercicio ? exercicio.skill : noPatio ? character.derived?.skillName : null;
  if (!pericia) {
    faixa.hidden = true;
    return;
  }
  faixa.hidden = false;
  // Onde ela cai — embaixo do cartaz de beta e da pílula dos efeitos, se
  // houver. Ver `empilharNoTopo`.

  const progresso = (skill) => (skill === 'magic' ? character.magic : character.skills?.[skill]);
  const encher = (id, dados) => {
    const barra = $(`bar-${id}`);
    if (!barra) return;
    barra.style.setProperty('--fill', `${Math.max(0, Math.min(100, (dados?.percent ?? 0) * 100))}%`);
    const texto = $(`text-${id}`);
    if (texto) texto.textContent = `${dados?.value ?? 0} · ${fracao(dados?.percent)}`;
  };

  $('treino-faixa-modo').textContent = exercicio
    ? `Exercise · ${exercicio.name} · ${exercicio.restantes.toLocaleString('pt-BR')} cargas`
    : 'Treinando no boneco';

  /*
   * Há quanto tempo ele treina.
   *
   * Os dois modos carimbam a hora de começar em lugares diferentes — o pátio no
   * `startedAt` da sessão, o exercise no retrato das perícias —, e é de
   * propósito: cada um é o mesmo carimbo que o RESUMO daquele modo usa. Se a
   * faixa tivesse um relógio próprio, ela e o resumo diriam números diferentes
   * para a mesma sessão.
   */
  const desde = exercicio ? exercicio.desde : hudCtx?.state?.hunt?.startedAt;
  const relogio = $('treino-faixa-tempo');
  if (relogio) relogio.textContent = desde ? formatTime(Date.now() - desde) : '';
  $('treino-faixa-nome').textContent = NOME_DA_PERICIA[pericia] ?? pericia;
  encher('treino', progresso(pericia));

  /*
   * O escudo só aparece no PÁTIO.
   *
   * Lá ele sobe junto — quem apanha do boneco aprende a se defender. Com arma
   * de exercise, não: cada arma treina a perícia dela e nada mais, e é isso que
   * faz a `exercise shield` valer o preço. Uma régua parada ao lado de uma que
   * anda não informa nada; some, e a faixa passa a dizer só a verdade.
   */
  const caixaEscudo = $('treino-faixa-escudo');
  const mostraEscudo = noPatio && pericia !== 'shielding';
  caixaEscudo.hidden = !mostraEscudo;
  if (mostraEscudo) {
    tipTexto(caixaEscudo, 'No pátio o escudo sobe junto com a arma.');
    encher('treino-escudo', progresso('shielding'));
  }
}

/*
 * ---- O balão das réguas de vida e mana ----
 *
 * "1645/1645" responde quanto cabe, e nenhuma das perguntas que se faz olhando
 * para uma régua de vida: quanto volta por segundo, quanto tempo até encher, e
 * o que exatamente está fazendo aquilo subir.
 *
 * A conta tem três parcelas, e é justamente por serem três que ninguém as junta
 * de cabeça:
 *
 *   1. a NATURAL, que é uma fração da vida máxima (0,4%/s de vida, 0,6%/s de
 *      mana) — quem tem mais vida recupera mais;
 *   2. a PROMOÇÃO, um multiplicador em cima dela (o Master Sorcerer recupera
 *      mana uma vez e meia mais rápido que o Sorcerer);
 *   3. o EQUIPAMENTO, uma soma fixa que não olha para o tamanho do personagem
 *      (o `healthgain`/`managain` de cada peça).
 *
 * Os números são os mesmos do laço do servidor (`hunt.mjs`), e a terceira
 * parcela é aberta peça por peça: a pergunta "de onde vem isso?" só tem
 * resposta útil se ela disser o nome do anel.
 */
const SLOTS_DA_RECUPERACAO = ['neck', 'head', 'backpack', 'weapon', 'body', 'shield', 'ring', 'legs', 'feet'];
/** A fração da vida/mana máxima que volta por segundo, sem promoção nem peça. */
const FRACAO_NATURAL = { hp: 0.004, mana: 0.006 };

function painelDeRecuperacao(character, qual) {
  const derived = character.derived ?? {};
  const teto = qual === 'hp' ? derived.maxHp ?? 0 : derived.maxMana ?? 0;
  const agora = qual === 'hp' ? character.hp ?? 0 : character.mana ?? 0;
  const multiplicador = derived.regen?.[qual] ?? 1;
  const natural = teto * FRACAO_NATURAL[qual] * multiplicador;
  const doEquipamento = derived.regenFlat?.[qual] ?? 0;
  const total = natural + doEquipamento;

  const caixa = el('div', 'tip-stamina');
  const cor = qual === 'hp' ? 'heal' : 'mana';
  caixa.append(el('div', 'tip-bless-head', qual === 'hp' ? 'Vida' : 'Mana'));

  const topo = el('div', 'tip-stamina-topo');
  topo.append(el('b', null, Math.round(agora).toLocaleString('pt-BR')));
  topo.append(el('span', null, `de ${Math.round(teto).toLocaleString('pt-BR')}`));
  caixa.append(topo);

  const linha = (rotulo, valor, className) => {
    const item = el('div', 'tip-exp-linha');
    item.append(el('span', null, rotulo));
    item.append(el('b', className, valor));
    caixa.append(item);
  };
  const porSegundo = (valor) => `+${valor.toFixed(1)}/s`;

  linha('Recupera', porSegundo(total), cor);
  /*
   * Quanto falta para encher, em tempo de relógio.
   *
   * É a tradução do "+9,9/s" para a unidade em que se decide alguma coisa:
   * ninguém espera "por 640 de mana", espera "um minuto". Some quando está
   * cheia, porque aí não há espera nenhuma.
   */
  const faltam = Math.max(0, teto - agora);
  if (faltam > 0.5 && total > 0) linha('Para encher', formatTime((faltam / total) * 1000), null);

  caixa.append(el('div', 'tip-recuperacao-titulo', 'De onde vem'));
  linha('Natural', porSegundo(teto * FRACAO_NATURAL[qual]), null);
  /*
   * A promoção só aparece quando ela EXISTE e muda alguma coisa: o Elite Knight
   * não recupera mana mais rápido, e uma linha "×1" nesse balão diria que a
   * promoção fez algo por ela quando não fez.
   */
  if (multiplicador !== 1) {
    linha(
      `Promoção (${derived.vocationName ?? 'promovido'})`,
      `×${String(multiplicador).replace('.', ',')}`,
      cor
    );
  }

  /*
   * E as peças, uma a uma.
   *
   * A soma já apareceu lá em cima; o que esta lista acrescenta é o NOME —
   * "Draevor Ring +5" é o que permite decidir se vale trocar o anel. Sem ela o
   * balão diria "+9 do equipamento" e deixaria a pergunta seguinte sem resposta.
   */
  const catalogo = hudCtx?.state?.items ?? {};
  const pecas = [];
  for (const slot of SLOTS_DA_RECUPERACAO) {
    const vestida = character.equipment?.[slot];
    const meta = vestida && catalogo[vestida.id];
    const valor = meta?.regen?.[qual] ?? 0;
    if (valor > 0) pecas.push({ nome: meta.name ?? `item ${vestida.id}`, valor, id: vestida.id });
  }
  for (const peca of pecas) {
    const item = el('div', 'tip-exp-linha tip-recuperacao-peca');
    const nome = el('span', null);
    const arte = itemCanvas(peca.id, 18);
    if (arte) nome.append(arte);
    nome.append(el('em', null, peca.nome));
    item.append(nome);
    item.append(el('b', cor, porSegundo(peca.valor)));
    caixa.append(item);
  }
  if (!pecas.length) {
    caixa.append(
      el(
        'p',
        'shop-note',
        qual === 'hp'
          ? 'Nenhuma peça vestida regenera vida. Anéis, amuletos e a mochila da loja regeneram.'
          : 'Nenhuma peça vestida regenera mana. Anéis, amuletos e a mochila da loja regeneram.'
      )
    );
  }
  return caixa;
}

/*
 * ---- O balão da stamina ----
 *
 * Ele era uma frase de três palavras no `title` do quadradinho: "Stamina cheia
 * — experiência integral". Não dizia o que mais importa quando ela está
 * enchendo, que é QUANTO ela rende ali — e o ritmo muda de faixa (um minuto a
 * cada três abaixo de 39h, um a cada seis acima) e some inteiro quando o
 * personagem entra numa caçada.
 *
 * Os números são os do servidor, que os manda em `staminaRegen`. Deduzi-los
 * aqui seria escrever a regra dele uma segunda vez.
 */
function painelStamina(character, grau, enchendo) {
  const caixa = el('div', 'tip-stamina');
  const stamina = character.stamina ?? 0;
  const teto = character.maxStamina ?? 2520;
  const regen = character.staminaRegen ?? {};

  caixa.append(el('div', 'tip-bless-head', 'Stamina'));

  const topo = el('div', 'tip-stamina-topo');
  topo.append(el('b', null, formatHours(stamina)));
  topo.append(el('span', null, `de ${formatHours(teto)}`));
  caixa.append(topo);

  const linha = (rotulo, valor, className) => {
    const item = el('div', 'tip-exp-linha');
    item.append(el('span', null, rotulo));
    item.append(el('b', className, valor));
    caixa.append(item);
  };

  if (enchendo) {
    /*
     * Quanto ela sobe POR HORA de relógio, que é a unidade em que a pessoa
     * pensa ("deixo aqui uma hora e ganho quanto?"). Os minutos por minuto
     * seriam 0,33 — um número que não diz nada.
     */
    const porHora = Math.round(3600 / (regen.segundosPorMinuto || 180));
    caixa.append(el('div', 'tip-stamina-carregando', `Carregando ${regen.onde ?? ''}`.trim()));
    linha('Ritmo', `+1 min a cada ${Math.round((regen.segundosPorMinuto || 180) / 60)} min`, 'heal');
    linha('Por hora parado', `+${porHora} min de stamina`, 'heal');
    const faltam = Math.max(0, teto - stamina);
    if (faltam > 0) {
      linha('Para encher', formatHours(Math.round((faltam * (regen.segundosPorMinuto || 180)) / 60)), null);
    }
  } else if (regen.ativo) {
    caixa.append(el('div', 'tip-stamina-carregando', 'Cheia — no teto de 42 horas'));
  } else {
    linha('Gasto', '−1 min por minuto de caçada', 'dano');
  }

  // O que a faixa vale na experiência. É o motivo de a barra ter cor.
  const fator = grau === 'verde' ? '×1,5' : grau === 'media' || grau === 'zerada' ? '×0,5' : '×1';
  linha(
    'Experiência',
    fator,
    grau === 'verde' ? 'heal' : grau === 'alta' ? null : 'dano'
  );
  caixa.append(
    el(
      'p',
      'shop-note',
      grau === 'verde'
        ? 'Acima de 39h com premium — 50% a mais em qualquer criatura.'
        : grau === 'alta'
          ? 'Acima de 14h — experiência integral.'
          : stamina > 0
            ? '14h ou menos — metade da experiência. Descanse na cidade.'
            : 'Esgotada — metade da experiência. Descanse na cidade.'
    )
  );
  return caixa;
}

/*
 * `hunt` e o retrato da cacada, ou nulo na cidade: e dele que sai a barra do
 * boss. Entra como parametro e nao como import para o hud nao passar a conhecer
 * o estado global — ele desenha o que recebe.
 */
/*
 * ---- A barra da FASE da campanha ----
 * "a fase vai ter um número x de mobs e vai aparecer na tela e se ele completar
 * ele desbloqueia o seguinte" (o dono). Uma faixa estreita no alto: o ato, a
 * fase, a dificuldade e quantos faltam. Na sala do boss do ato, a barra do boss
 * já ocupa o lugar.
 */
/** O botão da barra da fase: ícone e texto (longo no desktop, curto no celular — o CSS escolhe). */
export function pintarBotaoDaFase(botao, modo) {
  const seguir = modo === 'seguir';
  botao.dataset.modo = seguir ? 'seguir' : 'repetir';
  botao.querySelector('.modo-icone').textContent = seguir ? '⏭' : '🔁';
  botao.querySelector('.modo-longo').textContent = seguir ? 'Avançar sozinho' : 'Ficar na fase';
  botao.querySelector('.modo-curto').textContent = seguir ? 'Avançar' : 'Ficar';
}

function barraDaFase(hunt) {
  const caixa = $('barra-da-fase');
  if (!caixa) return;
  const f = hunt?.fase;
  if (!f || f.tipo !== 'fase') {
    caixa.hidden = true;
    return;
  }
  caixa.hidden = false;
  caixa.classList.toggle('completa', !!f.completa);
  $('fase-titulo').textContent = `Ato ${f.ato} · Fase ${f.numero} · ${f.nome} · ${f.nomeDaDificuldade}`;
  /*
   * A LIMPEZA DO MAPA: quanto da instância já foi limpo, em % (sem respawn —
   * ver `hunt/instancia.mjs`). Em 100%, o "Hunt Clear!" e o que vem depois,
   * conforme o botão: outra instância, a próxima fase, ou o boss.
   */
  const inst = hunt.instancia;
  const pct = inst ? inst.percentual : f.completa ? 100 : 0;
  const depois = f.aoCompletar !== 'seguir' || !f.completa ? 'nova instância...' : f.fimDoAto ? 'boss liberado' : 'próxima fase...';
  $('fase-conta').textContent = !inst
    ? (f.completa ? 'completa ✓' : '')
    : inst.status === 'limpa'
      ? `Hunt Clear! · ${depois}`
      : `${pct}% limpo${f.completa ? ' ✓' : ''}`;
  $('fase-conta').title = inst ? `${inst.concluidos} de ${inst.total} objetivos de limpeza` : '';
  caixa.classList.toggle('limpa', inst?.status === 'limpa');
  $('fase-cheio').style.width = `${pct}%`;
  // "Repetir" / "Seguir" ao completar (o clique está em main.mjs).
  const modo = $('fase-modo');
  if (modo && modo.dataset.modo !== f.aoCompletar) pintarBotaoDaFase(modo, f.aoCompletar ?? 'repetir');
}

export function renderHud(character, catalog, party = null, escudoDeMana = false, hunt = null) {
  barraDoBoss(hunt);
  barraDaFase(hunt);
  barrasDaArena(hunt, catalog);
  const { derived, progress } = character;

  // ---- retrato e identidade ----
  const key = `${character.outfit.type}-${character.outfit.head}-${character.outfit.body}-${character.outfit.legs}-${character.outfit.feet}-${character.level}`;
  if (portraitKey !== key) {
    portraitKey = key;
    const holder = $('hud-portrait');
    holder.innerHTML = '';
    holder.append(outfitCanvas(character.outfit.type, character.outfit, 46));
    holder.append(el('b', 'hud-level', character.level));
  }

  $('hud-name').textContent = character.name;
  // Depois da promoção o card mostra o nome novo: Paladin vira Royal Paladin.
  $('hud-vocation').textContent =
    character.derived?.vocationName ??
    catalog?.vocations.find((v) => v.id === character.vocation)?.name ??
    'Sem vocação';

  // ---- barras ----
  setBar('hp', character.hp, derived.maxHp, `${character.hp}/${derived.maxHp}`);
  setBar('mana', character.mana, derived.maxMana, `${character.mana}/${derived.maxMana}`);
  /*
   * ---- A barra de mana BRILHA quando e' ela que esta apanhando ----
   *
   * "quando eu tiver com o utamo vita ou o energy ring usando, a barra de mana
   *  tem que brilhar mais forte".
   *
   * O pedido e' de aviso, e nao de enfeite: com o escudo de pe' a mana deixa de
   * ser so' o combustivel das magias e passa a ser a vida da pessoa. Uma mana
   * caindo depressa quer dizer coisas opostas nos dois casos, e a barra estava
   * igual nos dois.
   *
   * Quem decide e' o CLIENTE, e nao um campo novo do servidor: as duas fontes
   * ja chegam aqui. O escudo da magia e' um buff da caçada (`tipo: 'shield'`,
   * que a faixa de relogios ja desenha) e o do anel esta no dedo — e um anel
   * no dedo e' a coisa mais visivel que existe no estado.
   */
  /*
   * `escudoDeMana` chega PRONTO de quem chama, e a primeira versao disto era
   * um `state.items[...]` aqui dentro — um `state` que este arquivo nao tem.
   * Ele levantava ReferenceError a cada quadro e derrubava o render inteiro:
   * inventario e mochila vaziam, a barra de experiencia zerava, e nada disso
   * apontava para a barra de mana. O modulo do HUD desenha o que recebe.
   */
  const reguaDaMana = $('bar-mana')?.parentElement;
  if (reguaDaMana) reguaDaMana.classList.toggle('com-escudo', !!escudoDeMana);
  /*
   * ---- O que as duas réguas escondiam ----
   *
   * Elas diziam "1645/1645" e mais nada. A pergunta de quem olha para elas é
   * outra — "quanto eu recupero por segundo, e de onde vem isso?" —, e a
   * resposta estava espalhada por três lugares que ninguém junta de cabeça: a
   * fração natural da vida máxima, o multiplicador da promoção e a soma dos
   * `healthgain`/`managain` de cada peça vestida.
   *
   * O painel junta os três e mostra PEÇA POR PEÇA quem está dando o quê. É o
   * mesmo desenho do balão da experiência, logo abaixo.
   */
  for (const qual of ['hp', 'mana']) {
    const regua = $(`bar-${qual}`)?.parentElement;
    if (!regua) continue;
    tipTexto(regua, null);
    tipPanel(regua, () => painelDeRecuperacao(character, qual));
  }
  setBar('exp', progress.percent * 100, 100, `${(progress.percent * 100).toFixed(0)}% lvl ${character.level}`);
  /*
   * O painel é montado na hora de mostrar, então basta apontar para o
   * personagem do momento uma vez por quadro — e o `title` sai do caminho, senão
   * o balão do navegador aparece por cima do nosso.
   */
  const reguaExp = $('bar-exp')?.parentElement;
  if (reguaExp) {
    // Esta não usa o balão de texto que o `setBar` acabou de pôr: ela tem
    // painel próprio, com as skills todas. Limpar o texto evita as duas marcas
    // no mesmo elemento.
    tipTexto(reguaExp, null);
    tipPanel(reguaExp, () => painelExperiencia(character, catalog, party));
  }
  /*
   * Stamina fecha a fileira, e ela muda de cor porque é a única régua cujo
   * número não conta a história toda: acima de 14h a experiência é cheia,
   * abaixo cai pela metade, e no zero não vem nada (`hunt.mjs`). Verde, amarelo
   * e vermelho são exatamente esses três degraus — o quadradinho ao lado avisa
   * antes de o jogador reparar no relógio.
   */
  /*
   * Quatro degraus, e não três: falta o de cima.
   *
   * O servidor dá 1,5x de experiência acima de 39 horas para conta premium
   * (`Player.getFinalBonusStamina`), e essa faixa — a "verde" do Tibia — não
   * aparecia em lugar nenhum: quem tinha 41 horas via a mesma coisa que quem
   * tinha 20 e não sabia que estava ganhando 50% a mais.
   */
  const stamina = character.stamina ?? 0;
  const temPremium = (character.premium ?? 0) > 0;
  const grau =
    stamina > 2340 ? (temPremium ? 'verde' : 'alta') : stamina > 840 ? 'alta' : stamina > 0 ? 'media' : 'zerada';
  setBar('stamina', stamina, character.maxStamina ?? 2520, formatHours(stamina));
  /*
   * ---- Piscando quando ENCHE ----
   *
   * Quem manda é o servidor (`staminaRegen`), e não uma dedução da tela: a
   * regra de onde a stamina sobe — cidade e pátio de treino, sim; caçada, não —
   * é dele, e escrevê-la aqui de novo daria duas versões dela para divergirem
   * no dia em que um terceiro lugar passasse a encher.
   *
   * O teto desliga o pisca: cheia, não há o que encher, e um brilho pulsando
   * ali prometeria um ganho que não existe.
   */
  const enchendo = !!character.staminaRegen?.ativo && stamina < (character.maxStamina ?? 2520);
  const reguaStamina = $('bar-stamina')?.parentElement;
  if (reguaStamina) {
    reguaStamina.dataset.grau = grau;
    reguaStamina.classList.toggle('enchendo', enchendo);
  }
  const quadrado = $('dot-stamina');
  if (quadrado) {
    quadrado.dataset.grau = grau;
    quadrado.classList.toggle('enchendo', enchendo);
  }
  /*
   * ---- O "+" que aparece enquanto ela enche ----
   *
   * Ele já existiu DENTRO da régua, encostado na borda direita — e ali ninguém
   * o via: a régua tem quinze pixels de altura, `overflow: hidden`, e o número
   * das horas passa por cima. O dono pediu duas vezes.
   *
   * Agora ele mora na CAIXA da régua e não na régua: solto acima dela, no canto
   * direito, mordendo a borda de cima. Fora do recorte, com espaço para ser
   * grande e para brilhar.
   *
   * (Na fita do rodapé as quatro réguas ficam num estojo recortado, e ali este
   * nó não caberia; lá quem avisa é o "＋" que a folha de estilo põe na frente
   * do próprio número. Ver `.bars-dock` em style.css.)
   *
   * Criado uma vez e escondido depois: refazer o nó a cada quadro tiraria a
   * animação do começo quatro vezes por segundo.
   */
  const caixaStamina = reguaStamina?.parentElement;
  if (caixaStamina) {
    let mais = caixaStamina.querySelector('.bar-mais');
    if (!mais) {
      mais = el('i', 'bar-mais', '＋');
      caixaStamina.append(mais);
    }
    mais.hidden = !enchendo;
  }
  /*
   * O balão da stamina: um painel, e não uma frase.
   *
   * `setBar` já pôs um texto simples ali ("39h 12m"); trocá-lo por `null` é o
   * que impede os dois balões no mesmo elemento — o mesmo cuidado que a régua
   * da experiência toma logo acima.
   */
  if (reguaStamina) {
    tipTexto(reguaStamina, null);
    tipPanel(reguaStamina, () => painelStamina(character, grau, enchendo));
  }
  renderTreinoFaixa(character);
  // A pílula mora DENTRO da faixa, então ela vem depois — e o empilhamento
  // depois das duas, porque ele mede a faixa já com a pílula dentro.
  renderEfeitosFaixa(character);
  renderPilulasDeEfeito(character);
  renderAutoBossFaixa(character);
  renderBuffsDaMagia(hudCtx?.state?.hunt);
  empilharNoTopo();
  ultimoPersonagem = character;
  placePromotion(character);
}
