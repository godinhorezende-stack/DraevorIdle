// Barra de ações: 22 slots em duas fileiras — 11 de se manter vivo em cima, 11
// de ataque embaixo — que o personagem dispara sozinho durante a hunt, cada um
// com as suas condições ("use quando a minha vida estiver abaixo de X").
// Quantos slots existem e onde a linha quebra vêm do servidor (`catalog.slots`
// e `catalog.slotsPorFileira`); aqui não há número de slot escrito à mão.
import { itemCanvas, outfitCanvas, outfitInfo } from './sprites.mjs';
import { tipForAction, previaDaMagia } from './tooltip.mjs';
import { artOrUiIcon } from './hud.mjs';
import { ehCelular } from './mobile.mjs';
// O relógio de cada slot chega como instante: ver `packages/shared/src/prazos.mjs`.
import { faltaDoCooldown } from '/packages/shared/src/prazos.mjs';

/*
 * ---- Um ícone para cada coisa que a tela mede ----
 *
 * O dono: "deixa a página de configurar ações melhor sabe com ícone de mana
 * ícone de vida ícone de distância essas coisa, tá meio confuso de mexer".
 *
 * A tela era uma pilha de linhas de texto com um campo numérico cada — "Mana
 * mínima (%)", "Mínimo de criaturas", "Máximo de criaturas" — e todas iguais.
 * Para saber o que se está mexendo é preciso LER, e ler cinco rótulos parecidos
 * é o que faz uma tela parecer confusa mesmo quando cada linha está clara.
 *
 * Os desenhos já existem: são os mesmos da ficha do personagem e do bestiary,
 * então o ícone de mana aqui é o mesmo ícone de mana de todo o resto do jogo.
 */
const ICONE = {
  vida: 'bes-vida',
  mana: 'ficha-regen-mana',
  criaturas: 'ficha-kills',
  distancia: 'ficha-alcance',
  alvo: 'ficha-combate',
};

/** O ícone de um assunto, do tamanho de um rótulo. */
function icone(qual, alt = '') {
  const img = artOrUiIcon(ICONE[qual] ?? qual, alt);
  img.classList.add('icone-do-campo');
  return img;
}

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const money = (value) => Number(value ?? 0).toLocaleString('pt-BR');

/*
 * O teto da faixa de criaturas, repetido aqui de propósito.
 *
 * O número de verdade é o `MAX_ALVOS` de `server/src/actions.mjs` — é ele que
 * decide, e ele apara qualquer valor que chegue. Este aqui é só para a tela não
 * oferecer um número que o servidor vai recusar; a pasta do servidor não é
 * servida ao navegador (ver `PASTAS_PUBLICAS` em index.mjs), então importar
 * dela é impossível. Se um dia mudar lá, muda aqui — o pior que acontece se
 * esquecerem é a tela oferecer menos do que o servidor aceita.
 */
const MAX_ALVOS = 25;

// A folha de ícones de magia do client: uma fila de sprites de 32x32, e o
// índice de cada magia vem do próprio spells.lua (clientId).
const SPELL_SHEET = '/client/assets/ui/spell-icons.png';

/*
 * Tamanho do sprite dentro do slot da barra (o slot tem 42px, no CSS).
 *
 * Era 44, e a folha de ícones de magia não tem margem transparente nenhuma: o
 * desenho ia de ponta a ponta dos 44px e encostava no contorno do slot, que
 * sumia debaixo dele. Numa fileira longa, o resultado era uma tira de figuras
 * coladas, sem quadro nenhum entre elas.
 *
 * Com 40 sobram 6px de cada lado — o bastante para a moldura respirar e para o
 * brilho dela aparecer em volta do desenho, e pouco o suficiente para o sprite
 * continuar reconhecível de relance, que é a razão de ele ser grande.
 *
 * ---- 34, depois 40, agora 34 de novo ----
 *
 * O par 52/40 chegou a virar 42/34 para poupar altura, voltou a 52/40 a pedido
 * do dono, e voltou a 42/34 quando a fileira precisou encolher de largura. O
 * que muda é o que está apertado; o que não muda é a regra: os dois números
 * andam JUNTOS, e a folga entre o sprite e a borda tem de ficar por volta de
 * 4px de cada lado (ver acima por quê).
 *
 * O número vive aqui e não no CSS porque a folha de magias é recortada por
 * tamanho (`backgroundSize`/`backgroundPosition` saem dele): mudar a largura
 * pelo CSS cortaria o ícone em vez de reduzi-lo. Mexer aqui pede mexer no
 * `.hotbar .slot canvas` do CSS junto — os dois têm de dar o mesmo número.
 */
const SLOT_ICON = 34;
/*
 * ---- E o sprite encolhe junto com o slot no celular ----
 *
 * "ao arrastar os slots a sprite tem que caber certinho, pq eu arrasto um slot
 * que tem magia e a sprite fica maior."
 *
 * O quadrado do telefone tem 29px e o desenho tinha 34: sobrava sprite para
 * fora por todos os lados. Ele não pode ser esticado pelo CSS — o ícone de
 * magia é um recorte de uma folha de sprites, e mudar a largura da caixa sem
 * mudar o recorte corta a figura ao meio em vez de encolhê-la. Quem escolhe o
 * tamanho é quem DESENHA o ícone, e é aqui.
 */
const SLOT_ICON_CELULAR = 24;
const tamanhoDoIcone = () => (ehCelular() ? SLOT_ICON_CELULAR : SLOT_ICON);

/*
 * Estreitar a janela até virar layout de celular (ou alargá-la de volta) troca
 * o tamanho do sprite — e o sprite é escolhido na hora de desenhar, não pelo
 * CSS. Sem este redesenho, a barra ficaria com os ícones do layout anterior até
 * a próxima mudança de catálogo.
 */
let ultimoTamanhoDoIcone = null;
window.addEventListener('resize', () => {
  const agora = tamanhoDoIcone();
  if (agora === ultimoTamanhoDoIcone) return;
  ultimoTamanhoDoIcone = agora;
  /*
   * Só depois de a barra existir. A janela é redimensionada antes de alguém
   * entrar no jogo — na tela de login, por exemplo — e ali `ctx` ainda é nulo:
   * redesenhar naquele instante rebentava o `renderActionBar` logo na primeira
   * mudança de tamanho.
   */
  if (!ctx?.state?.character) return;
  redesenharBarra();
});

/** Recorte da folha de magias como um elemento próprio. */
export function spellIcon(index, size = 26) {
  const node = document.createElement('i');
  node.className = 'spell-icon';
  node.style.width = `${size}px`;
  node.style.height = `${size}px`;
  node.style.backgroundImage = `url(${SPELL_SHEET})`;
  node.style.backgroundSize = `auto ${size}px`;
  node.style.backgroundPosition = `-${index * size}px 0`;
  return node;
}

/**
 * Ícone da ação: sprite do item para poção e runa, folha de magia para o resto.
 *
 * Exportado porque a Cyclopedia desenha as mesmas magias, runas e poções — e
 * antes ela não desenhava nada: era uma grade de cartões só com o nome. Quem
 * sabe recortar a folha de ícones é a barra, e é dela que a enciclopédia pega.
 */
export function actionIcon(entry, size = 26) {
  if (!entry) return el('span', 'plus', '+');
  if (entry.icon != null) return spellIcon(entry.icon, size);
  if (entry.itemId) return itemCanvas(entry.itemId, size);
  return el('span', 'rune-mark', entry.name.slice(0, 2).toUpperCase());
}

/*
 * Como uma tecla aparece escrita no canto do slot.
 *
 * O traço vira o sinal de menos, que é mais legível em 8px; o resto sobe para
 * maiúscula. Não há lista de teclas permitidas: quem recusa é o servidor, e ele
 * recusa só as que a tela precisa para si (as setas, o WASD, Escape).
 */
const ROTULO_DA_TECLA = { '-': '−', '=': '=', ' ': 'ESP' };
const escreverTecla = (tecla) => ROTULO_DA_TECLA[tecla] ?? String(tecla).toUpperCase();

const VOCATION_NAMES = {
  knight: 'Knight',
  paladin: 'Paladin',
  druid: 'Druid',
  sorcerer: 'Sorcerer',
  monk: 'Monk',
};

let ctx = null;
let catalog = null;
let editing = null; // { slot, draft, tab, filters }

export function initActionBar(context) {
  ctx = context;
  ctx.send({ t: 'actions' });
}

export function setActionCatalog(next) {
  // Com o editor aberto para OUTRO char, o catálogo que chega é o deste: guarda
  // de lado e devolve quando o editor fechar. Ver `editarBarraDeOutro`.
  if (deOutro) return void (deOutro.catalogoProprio = next);
  catalog = next;
  if (editing) renderEditor();
}

/*
 * ---- O MESMO editor, para um char da conta que não está aberto ----
 *
 * Pedido do dono: configurar as magias de cada char pela tela de trocar de
 * personagem. O editor desta barra é o maior pedaço de tela do jogo (condições,
 * prioridade, cura de amigo, exeta res...) e fazer um segundo para o outro char
 * seria manter dois que discordam na primeira mudança.
 *
 * Então é este, com três trocas enquanto ele estiver aberto: o personagem que
 * ele lê (`ctx.state.character`), o catálogo (magias da vocação e do level
 * DELE) e o `send`, que embrulha cada comando num `contaChar` com o nome dele.
 * Ao fechar, as três voltam. A barra do rodapé não é redesenhada nesse meio
 * tempo — ela é do char aberto, e pintá-la com a do outro seria mentir.
 */
let deOutro = null;

export function editarBarraDeOutro({ personagem, catalogo, enviar, slot, aoFechar }) {
  if (deOutro) return;
  deOutro = { ctxProprio: ctx, catalogoProprio: catalog, aoFechar };
  ctx = {
    ...deOutro.ctxProprio,
    state: { ...deOutro.ctxProprio.state, character: personagem },
    send: enviar,
  };
  catalog = catalogo;
  openEditor(slot);
}

/** O servidor mandou a barra nova do outro char: o editor aberto passa a ler dela. */
export function atualizarBarraDeOutro(personagem, catalogo) {
  if (!deOutro || ctx.state.character?.name !== personagem?.name) return;
  ctx = { ...ctx, state: { ...ctx.state, character: personagem } };
  if (catalogo) catalog = catalogo;
  if (editing) renderEditor();
}

function devolverBarraPropria({ avisar = true } = {}) {
  if (!deOutro) return;
  const { ctxProprio, catalogoProprio, aoFechar } = deOutro;
  deOutro = null;
  editing = null;
  ctx = ctxProprio;
  catalog = catalogoProprio;
  redesenharBarra();
  if (avisar) aoFechar?.();
}

/*
 * A rede por baixo: outra janela tomou o lugar do editor sem fechá-lo (um botão
 * da loja lá dentro, um aviso do servidor). O `openModal` não chama o fechamento
 * de quem sai, e sem isto a barra do rodapé ficaria esperando para sempre.
 */
function editorDeOutroSumiu() {
  if (!deOutro) return false;
  const caixa = document.getElementById('modal');
  const titulo = document.getElementById('modal-title')?.textContent;
  return !caixa || caixa.hidden || titulo !== deOutro.titulo;
}

const findEntry = (id) =>
  [...(catalog?.spells ?? []), ...(catalog?.runes ?? []), ...(catalog?.items ?? [])].find((entry) => entry.id === id);

/*
 * ---- Quem mais precisa saber desenhar uma ação ----
 *
 * O card da party mostra a barra dos companheiros, e tentava achar a magia em
 * `state.catalog` — que não existe: o catálogo mora AQUI, num módulo só. O
 * resultado era uma faixa em que só as poções apareciam (elas se resolvem pelo
 * `item-` do id) e magias e runas saíam em branco.
 *
 * O catálogo continua com um dono; o que ele ganha é uma porta.
 */
export const entradaDaAcao = (id) => findEntry(id) ?? null;

/** Uma linha curta dizendo o que as condições do slot exigem. */
function resumoDasCondicoes(conditions) {
  const partes = conditions.map((condition) => {
    if (condition.kind !== 'nome') {
      const quem = condition.who === 'target' ? 'alvo' : 'você';
      const sinal = condition.op === 'gte' ? '≥' : '≤';
      return `${quem} ${condition.stat === 'mana' ? 'mana' : 'vida'} ${sinal} ${condition.value}${condition.percent ? '%' : ''}`;
    }
    if (!condition.names?.length) return 'criatura (sem nomes)';
    const lista = condition.names.slice(0, 2).join(', ');
    const mais = condition.names.length > 2 ? ` +${condition.names.length - 2}` : '';
    return `criatura ${condition.op === 'diferente' ? '≠' : '='} ${lista}${mais}`;
  });
  return `só dispara com: ${partes.join(' e ')}`;
}

/*
 * O catálogo chega por mensagem, e pode chegar DEPOIS de uma tela que desenha
 * ações já ter sido montada. Quem guarda o desenho por assinatura precisa saber
 * disso, senão fica com os ícones de reserva para sempre.
 */
export const catalogoDeAcoesPronto = () => !!catalog;

// ---------- barra ----------

/*
 * A barra de ações só é remontada quando ela muda de verdade.
 *
 * Antes `renderActionBar` fazia `innerHTML = ''` quatro vezes por segundo. O
 * jogador apertava o slot, o `pointerdown` pegava um elemento que a próxima
 * atualização jogava fora, e o `pointerup` caía num elemento novo: sem os dois
 * no mesmo nó, o navegador não dispara `click`. Era sorte acertar a janelinha
 * entre dois desenhos — daí os “três ou mais cliques” para o editor abrir. A
 * mochila e o inventário já tinham passado por isto e foram resolvidos do mesmo
 * jeito, com uma chave do que está na tela.
 *
 * O cooldown continua andando a cada quadro, mas em cima dos slots que já
 * existem: a cortina e o número mudam de altura e de texto, e ninguém troca de
 * elemento debaixo do dedo de quem clicou.
 */
let chaveHotbar = '';
let chavePresets = null;

/*
 * Qual slot está esperando uma tecla, ou `null`.
 *
 * É o "assign hotkey" do client: o cantinho da tecla vira botão, o slot fica
 * ouvindo, e a próxima tecla apertada passa a ser dele. Fica no módulo porque a
 * escuta é da PÁGINA (o `keydown` é global) e o desenho é da barra.
 */
let esperandoTecla = null;

/** Refaz a barra na hora, sem esperar a assinatura mudar. */
function redesenharBarra() {
  chaveHotbar = '';
  renderActionBar();
}

/**
 * A tecla que o jogador apertou, quando um slot está ouvindo.
 *
 * Devolve true quando consumiu a tecla — aí quem chamou não deve deixá-la
 * disparar magia nem andar. Quem valida se ela serve é o SERVIDOR: aqui só se
 * cancela no Esc, porque cancelar é da tela.
 */
export function capturarTecla(event) {
  if (esperandoTecla == null) return false;
  const slot = esperandoTecla;

  if (event.key === 'Escape') {
    esperandoTecla = null;
    redesenharBarra();
    ctx?.notice?.('Escolha de tecla cancelada.');
    return true;
  }
  // Modificador sozinho não é tecla: quem segura Shift para chegar no "%" não
  // quis atribuir o Shift.
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) return true;

  esperandoTecla = null;
  redesenharBarra();
  ctx.send({ t: 'actions', action: 'key', slot, key: event.key.toLowerCase() });
  return true;
}

/*
 * ---- A altura da barra, publicada para quem mora em cima dela ----
 *
 * Vários flutuantes se penduram acima da barra: o aviso de hunt vazia, o
 * presente, os dois convites. Eles diziam `bottom: 96px`, `118px`, `148px` e
 * `176px` — números medidos à mão numa barra de UMA fileira de slots, que dava
 * 69px de altura.
 *
 * No dia em que a barra virou duas fileiras ela foi para 126px, e os quatro
 * passaram a nascer DEBAIXO dela. O defeito não é o número de cada um: é que a
 * altura da barra estava escrita em cinco lugares, e quatro deles não sabiam
 * que tinham de mudar.
 *
 * Agora a barra MEDE a si mesma e publica em `--barra-altura`, e cada um deles
 * pede `calc(var(--barra-altura) + a folga dele)`. Minimizar a barra, mudar o
 * número de fileiras ou o tamanho do slot passa a acertar os quatro sozinho.
 *
 * O `ResizeObserver` e não uma conta na hora de montar: a barra também muda de
 * altura quando o jogador a minimiza, e ali ninguém chama esta função.
 */
/*
 * As duas medidas que sobraram: a ALTURA da barra e o DESLOCAMENTO dela.
 *
 * Houve mais duas — a largura da fileira de slots e a borda esquerda dela —,
 * para as réguas e os arranjos de hotkeys se alinharem com os slots morando
 * fora deles. As duas saíram quando os dois mudaram de casa: as réguas foram
 * para dentro da `.hotbar-stack`, que já tem a largura certa, e os arranjos
 * para a coluna da direita. Alinhamento resolvido pela ÁRVORE não precisa de
 * número medido, e é sempre a solução melhor quando ela está disponível.
 */
let observandoMedidas = false;
function publicarMedidasDaBarra() {
  const barra = document.getElementById('actionbar');
  const slots = document.getElementById('hotbar');
  if (!barra || !slots || observandoMedidas) return;
  observandoMedidas = true;
  const raiz = document.documentElement.style;
  const medir = () => {
    const daBarra = barra.getBoundingClientRect();
    const dosSlots = slots.getBoundingClientRect();
    if (daBarra.height > 0) raiz.setProperty('--barra-altura', `${Math.round(daBarra.height)}px`);

    /*
     * ---- Centrar os SLOTS na tela deslocando a barra inteira ----
     *
     * O personagem está no meio da tela, e é sob ele que os slots têm de ficar.
     * A barra é centrada (`left: 50%` + `translateX(-50%)`), mas ela não é
     * simétrica: à esquerda dos slots moram dois botões e à direita, quatro
     * controles. Centrar a BARRA deixa os slots à esquerda do personagem.
     *
     * A primeira solução foi uma grade `1fr auto 1fr`, que força as duas pontas
     * ao mesmo tamanho. Funcionou e custou 276px de vazio à esquerda — a ponta
     * magra tendo de engordar até o tamanho da gorda. O dono viu e reclamou, com
     * razão: era espaço de tela gasto para não fazer nada.
     *
     * Agora a barra volta a ter a largura do que tem dentro, e quem se desloca é
     * ELA. O deslocamento é a distância entre o meio dos slots e o meio da tela.
     * Nada estica, nada sobra, e os slots ficam sob o personagem do mesmo jeito.
     *
     * ---- Por que a conta desconta o deslocamento de agora ----
     *
     * `getBoundingClientRect` já vê a barra deslocada — é a posição de AGORA,
     * não a de origem. Somar a diferença medida sobre um valor que já a contém
     * afastaria a barra um pouco mais a cada medição. Então tudo é levado de
     * volta ao zero (`- atual`) antes de decidir o valor novo.
     *
     * Isto não entra em laço com o `ResizeObserver`: mover não muda tamanho, e
     * é só de tamanho que ele avisa.
     */
    /*
     * Recolhida, não há o que centrar.
     *
     * Os slots estão em `display: none` e o retângulo deles é zero — a conta
     * daria um deslocamento sem sentido, e ele ficaria guardado na variável
     * para quando a barra voltasse. O CSS já ignora a variável enquanto ela
     * está recolhida (ver `#actionbar.minimizada`); esta guarda evita que o
     * valor guardado fique errado enquanto isso.
     */
    if (dosSlots.width === 0) return;

    const atual = parseFloat(raiz.getPropertyValue('--desloca-barra')) || 0;
    const esquerdaDeOrigem = daBarra.left - atual;
    const meioDosSlotsDeOrigem = dosSlots.left + dosSlots.width / 2 - atual;
    let desloca = window.innerWidth / 2 - meioDosSlotsDeOrigem;

    /*
     * A barra não pode sair da tela por causa disso.
     *
     * Numa janela estreita o deslocamento que centra os slots joga a ponta
     * direita para fora, e o que estava lá — o botão de entrar na hunt — sairia
     * da vista. Centrar é um capricho; alcançar o botão não é. Os limites
     * ganham, e numa janela apertada a barra simplesmente para de deslocar.
     */
    const MARGEM = 4;
    const minimo = MARGEM - esquerdaDeOrigem;
    const maximo = window.innerWidth - MARGEM - esquerdaDeOrigem - daBarra.width;
    desloca = maximo < minimo ? 0 : Math.max(minimo, Math.min(maximo, desloca));
    raiz.setProperty('--desloca-barra', `${Math.round(desloca)}px`);
  };
  /*
   * Um observador para os dois. A barra muda de altura ao minimizar; a fileira
   * de slots muda de largura quando o número de slots ou o tamanho deles muda.
   * O `#hotbar` é esvaziado e remontado a cada redesenho, mas o ELEMENTO é
   * sempre o mesmo, então a inscrição sobrevive.
   */
  const olho = new ResizeObserver(medir);
  olho.observe(barra);
  olho.observe(slots);
  /*
   * Redimensionar a JANELA não muda o tamanho de nada aqui dentro — a barra tem
   * a largura do que tem dentro —, então o `ResizeObserver` fica quieto. Mas o
   * meio da tela andou, e é dele que sai o deslocamento. Por isso o `resize`
   * também: sem ele os slots saíam do centro ao mexer na janela e só voltavam
   * na próxima vez que a barra fosse remontada.
   */
  window.addEventListener('resize', medir);
  medir();
}

export function renderActionBar() {
  // O editor está aberto para outro char: a barra do rodapé espera. Ver `deOutro`.
  if (editorDeOutroSumiu()) devolverBarraPropria({ avisar: false });
  if (deOutro) return;
  publicarMedidasDaBarra();
  const bar = document.getElementById('hotbar');
  const { state } = ctx;
  const actions = state.character.actions ?? [];
  const total = catalog?.slots ?? 22;

  const chave = [
    total,
    catalog ? '1' : '0',
    // A tecla de cada slot entra na assinatura: trocá-la tem de redesenhar o
    // canto do slot, e sem isto a barra só mudava quando a AÇÃO mudava.
    (state.character.hotkeys ?? []).join(','),
    esperandoTecla ?? '-',
    ...Array.from({ length: total }, (_, index) => {
      const action = actions[index];
      if (!action) return '-';
      return `${action.id}:${action.enabled === false ? 0 : 1}:${action.conditions?.length ?? 0}`;
    }),
  ].join('|');

  if (chave !== chaveHotbar) {
    chaveHotbar = chave;
    montarHotbar(bar, actions, total);
  }
  atualizarCooldowns(bar, actions);

  // Os arranjos guardados mudam de vez em quando, não quatro vezes por segundo
  // — e refazê-los junto traria de volta o mesmo problema do clique perdido.
  // E os dois automáticos que moram ao lado do "Salvar hk": acender tem de refazer a coluna.
  const s = state.character.settings ?? {};
  const automaticos = state.hunt
    ? `${state.hunt.manual ? 'm' : 'a'}${+!!state.hunt.assistencia}${+!!state.hunt.autoBarra}`
    : `c${+!!s.assistencia}${+!!(s.autoBarra ?? s.assistencia)}`;
  const chaveArranjos = (state.character.actionPresets ?? []).map((preset) => preset.name).join('|') + '#' + automaticos;
  if (chaveArranjos !== chavePresets) {
    chavePresets = chaveArranjos;
    renderPresets();
  }
}

/*
 * De onde veio o arrasto em curso.
 *
 * O `dragover` não consegue ler o `dataTransfer` (o navegador esconde a carga
 * até soltar), então a origem fica guardada aqui enquanto o arrasto acontece.
 */
let arrastando = null;
const arrastandoDaBarra = () => arrastando;

/** Os dois cabem um no lugar do outro? Só para pintar o alvo antes de soltar. */
function trocaCabe(de, para) {
  const acoes = ctx.state.character.actions ?? [];
  const cabe = (acao, slot) => {
    if (!acao?.id) return true; // slot vazio aceita qualquer coisa
    const entry = findEntry(acao.id);
    const papel = catalog?.papelDoSlot?.[slot];
    if (!entry || !papel) return true;
    return (entry.papeis ?? []).includes(papel);
  };
  return cabe(acoes[de], para) && cabe(acoes[para], de);
}

function montarHotbar(bar, actions, total) {
  bar.innerHTML = '';

  /*
   * Onde a barra quebra a linha.
   *
   * O CSS monta a grade com `repeat(var(--slots-por-fileira), ...)`, então
   * basta dizer o número: os onze primeiros ficam em cima e o resto desce
   * sozinho. Quem manda é o servidor — ele é dono do `PAPEL_DO_SLOT`, e uma
   * quebra escrita no CSS partiria a fileira no meio de um ofício no dia em
   * que a divisão mudasse.
   */
  bar.style.setProperty('--slots-por-fileira', catalog?.slotsPorFileira ?? total);

  for (let index = 0; index < total; index++) {
    const action = actions[index];
    const slot = el('div', `slot${action ? ' filled' : ''}`);
    slot.dataset.slot = index;
    if (action && !action.enabled) slot.classList.add('off');

    if (action) {
      const entry = findEntry(action.id);
      slot.append(actionIcon(entry, tamanhoDoIcone()));
      // O tooltip rico diz o que a ação faz, quanto custa e por que não está
      // saindo — falta mana, cooldown do grupo, sem alvo, parede no caminho.
      // É a resposta para “por que a minha magia não dispara?”.
      tipForAction(
        slot,
        entry,
        // O desenho vem daqui pronto: só a barra sabe recortar a folha de
        // ícones de magia, e o tooltip não precisa aprender isso.
        () => actionIcon(entry, 40),
        motivos(action, index, null)
      );
      if (!entry) slot.title = action.id;
      if (action.conditions?.length) slot.append(el('i', 'cond', String(action.conditions.length)));

      /*
       * ---- O cooldown é um LEQUE, e não uma cortina ----
       *
       * A cortina subia de baixo para cima, e num slot quadrado de 40px isso
       * dá uma barra de altura — que a essa escala é quase indistinguível
       * entre 60% e 70%, e não diz de que lado do relógio a ação está.
       *
       * O leque é um ponteiro: a sombra varre em círculo a partir das doze
       * horas e some no sentido do relógio, então "quase pronto" é uma fatia
       * fina e óbvia. É o gesto que o client do Tibia usa, e o que todo jogo
       * com cooldown usa, justamente porque se lê de canto de olho.
       *
       * Quem desenha é o `conic-gradient` do CSS; daqui vai só a fração, numa
       * variável. Os dois nascem escondidos e `atualizarCooldowns` só muda o
       * número — nunca o elemento.
       */
      const veil = el('i', 'cooldown');
      const texto = el('b', 'cooldown-text');
      veil.hidden = true;
      texto.hidden = true;
      slot.append(veil, texto);
    } else {
      slot.append(el('span', 'plus', '+'));
      slot.title = 'configurar ação';
    }
    /*
     * O canto do slot mostra a TECLA, e não o número dele.
     *
     * Ele escrevia `index + 1`, o que já era mentira nos três últimos: o slot
     * 10 responde ao 0, o 11 ao traço e o 12 ao igual. Com a tecla escolhível,
     * a única fonte certa é a lista que o servidor manda. Slot sem tecla mostra
     * um traço baixinho: ele funciona no clique, só não no teclado.
     */
    const tecla = ctx.state.character.hotkeys?.[index] ?? null;
    const selo = el('u', `key${tecla ? '' : ' sem'}`, tecla ? escreverTecla(tecla) : '·');
    /*
     * ---- Atribuir a tecla NO PRÓPRIO SLOT ----
     *
     * A primeira tentativa foi uma grade de teclas dentro do editor de ação:
     * abria-se a ação, rolava-se até o fim e escolhia-se numa lista. Errado —
     * no client dele isso é "assign hotkey": você clica no slot, ele fica
     * esperando, você aperta a tecla e pronto. Aqui é isso: o cantinho da tecla
     * é o botão, e a próxima tecla apertada vira a dele.
     *
     * O clique no selo NÃO abre o editor da ação (`stopPropagation`): eles
     * ficam no mesmo quadradinho e fazem coisas diferentes.
     */
    if (esperandoTecla === index) selo.classList.add('ouvindo');
    selo.title =
      esperandoTecla === index
        ? 'aperte a tecla que vai disparar este slot (Esc cancela)'
        : tecla
          ? `tecla ${escreverTecla(tecla)} — clique para trocar`
          : 'sem tecla — clique para escolher uma';
    selo.onclick = (evento) => {
      evento.stopPropagation();
      esperandoTecla = esperandoTecla === index ? null : index;
      redesenharBarra();
      if (esperandoTecla === index) ctx.notice?.('Aperte a tecla para este slot (Esc cancela).');
    };
    // O direito tira a tecla, do mesmo jeito que tira a ação do slot.
    selo.oncontextmenu = (evento) => {
      evento.preventDefault();
      evento.stopPropagation();
      if (!tecla) return;
      esperandoTecla = null;
      ctx.send({ t: 'actions', action: 'key', slot: index, key: null });
    };
    slot.append(selo);

    /*
     * O desenho do ofício no canto de cima.
     *
     * É o que faz a barra se explicar sozinha: cinco corações, duas gotas de
     * mana, uma bota, três bênçãos e onze chamas dizem, sem abrir nada, o que
     * cabe em cada lugar — e por que a cura não pode ir para o meio da fila de
     * ataque.
     *
     * Com a barra em duas fileiras o desenho passou a fazer MAIS falta, e não
     * menos: a de baixo são onze quadrados idênticos, e é o ícone no canto que
     * diz de relance que ali só entra ataque.
     */
    const papel = catalog?.papelDoSlot?.[index];
    /*
     * O ofício também vai para o DOM.
     *
     * Ele já era usado aqui para o carimbo no canto do quadrado; o arranjo de
     * celular precisa dele para outra coisa — pôr METADE de cada ofício em
     * volta do analógico (metade das de vida, metade das de mana, metade das de
     * ataque). Ver `emVoltaDoAnalogico`, no mobile.mjs.
     *
     * No `dataset` e não numa lista exportada porque quem lê é a tela, e o que
     * a tela tem na mão é o elemento: uma lista à parte precisaria concordar
     * com a ordem dos slots para sempre.
     */
    if (papel) slot.dataset.papel = papel;
    const info = papel ? catalog?.papeis?.[papel] : null;
    if (info) {
      const marca = document.createElement('img');
      marca.className = 'papel';
      marca.src = `/client/assets/ui/${info.icone}.png`;
      marca.alt = '';
      marca.onerror = () => marca.remove();
      slot.append(marca);
      if (!action) slot.title = `Slot de ${info.nome}: ${info.dica}`;
    }

    /*
     * ---- No celular, tocar no slot USA a habilidade ----
     *
     * No computador o slot é onde se MONTA a barra (clique abre o editor) e a
     * tecla é o que dispara. Num telefone não há tecla: com o clique preso ao
     * editor, os vinte e dois quadrados viravam enfeite — dava para montar a
     * barra e nunca para usá-la.
     *
     * Montar continua possível, e num gesto que ninguém faz sem querer: com o
     * cadeado ABERTO, que é o modo de arrumar a barra, o toque volta a abrir o
     * editor.
     *
     * E também fora da hunt ou num slot vazio: aí não há o que disparar (o
     * servidor só respondia "Você não está numa hunt."), e o toque que sobra
     * é o de montar a barra.
     */
    slot.onclick = () => {
      if (ehCelular() && !document.body.classList.contains('slots-livres') && action && ctx.state?.hunt) {
        ctx.dispararSlot?.(index);
        return;
      }
      openEditor(index);
    };
    slot.oncontextmenu = (event) => {
      event.preventDefault();
      if (action) ctx.send({ t: 'actions', action: 'set', slot: index, value: null });
    };

    /*
     * ---- Arrastar de um slot para outro TROCA os dois ----
     *
     * Não havia arrasto nenhum na barra: mudar a ordem era esvaziar um slot e
     * montar tudo de novo pelo editor. E como a ordem da barra É a ordem de
     * disparo (slot 1 primeiro), mudar de ideia sobre a prioridade custava
     * refazer a fileira.
     *
     * Troca, e não sobrescrita: largar a cura em cima da magia manda a magia
     * para onde a cura estava. Nada é apagado, e a prioridade acompanha a
     * posição nova — é a mesma coisa.
     *
     * Quem valida se cada um cabe no ofício do slot de destino é o servidor;
     * aqui a tela só evita começar um arrasto que ela já sabe que não vai dar,
     * marcando o alvo em vermelho.
     */
    if (action) {
      slot.draggable = true;
      slot.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', JSON.stringify({ from: 'hotbar', slot: index }));
        event.dataTransfer.effectAllowed = 'move';
        arrastando = index;
        slot.classList.add('dragging');
      });
      slot.addEventListener('dragend', () => {
        arrastando = null;
        slot.classList.remove('dragging');
        for (const outro of bar.querySelectorAll('.slot')) outro.classList.remove('alvo', 'recusa');
      });
    }

    slot.addEventListener('dragover', (event) => {
      const origem = arrastandoDaBarra();
      if (origem == null || origem === index) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      slot.classList.add(trocaCabe(origem, index) ? 'alvo' : 'recusa');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('alvo', 'recusa'));
    slot.addEventListener('drop', (event) => {
      event.preventDefault();
      slot.classList.remove('alvo', 'recusa');
      let carga = null;
      try {
        carga = JSON.parse(event.dataTransfer.getData('text/plain'));
      } catch {
        return;
      }
      if (carga?.from !== 'hotbar' || carga.slot === index) return;
      ctx.send({ t: 'actions', action: 'swap', from: carga.slot, to: index });
    });

    bar.append(slot);
  }
}

/** A linha de baixo do tooltip: ordem, condições e o que está segurando a ação. */
function motivos(action, index, cooldown) {
  return [
    `${index + 1}º na fila de disparo`,
    /*
     * O resumo do slot dizia só o NÚMERO de condições. Com a de criatura isso
     * ficou pouco: "2 condições" não lembra a ninguém que uma delas está
     * segurando a magia num bicho específico — que é exatamente o que a pessoa
     * precisa lembrar quando a magia não sai.
     */
    action.conditions?.length ? resumoDasCondicoes(action.conditions) : null,
    action.enabled === false ? 'slot desligado' : cooldown?.reason ? `parado: ${cooldown.reason}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/*
 * ---- O cooldown anda sozinho entre um estado e outro ----
 *
 * O servidor manda o que falta oito vezes por segundo, e desenhar SO' nessas
 * horas dava um leque aos saltos: oito degraus por segundo num movimento que o
 * olho espera contínuo. O número tinha o mesmo problema ao ganhar decimal —
 * "1,7" ficaria parado por 125ms e pularia para "1,5".
 *
 * Então o que chega do servidor não é mais o desenho: é o INSTANTE em que cada
 * cooldown termina. Daí em diante quem desenha é o quadro do navegador, que
 * roda a 60 por segundo, e a chegada do próximo estado só acerta o relógio.
 *
 * O laço morre sozinho quando não há mais nada recarregando — nenhum quadro é
 * gasto com a barra parada.
 */
const relogiosDeCooldown = new Map();
/*
 * ---- Os relógios de FORA da barra ----
 *
 * O card da party desenha o mesmo leque para os companheiros, e ele não pode
 * entrar no mapa de cima: `atualizarCooldowns` limpa aquele inteiro a cada
 * estado que chega, e os slots da party sumiriam junto.
 *
 * Ficam aqui, no mesmo laço de quadros — o desenho é o mesmo, e um segundo
 * `requestAnimationFrame` só para eles seria dois laços fazendo a mesma conta.
 * Slot que saiu da árvore (a janela fechou, o card foi refeito) é esquecido
 * sozinho na varredura.
 */
const relogiosDeFora = new Map();
let quadroDoCooldown = 0;

/**
 * Acompanha o cooldown de um slot que não é da barra. `left` e `total` em ms;
 * `left <= 0` apaga o leque.
 */
export function acompanharCooldown(slot, left, total) {
  if (!slot) return;
  if (!(left > 0)) {
    relogiosDeFora.delete(slot);
    apagarCooldown(slot);
    return;
  }
  relogiosDeFora.set(slot, { fim: performance.now() + left, total: Math.max(1, total || left) });
  if (!quadroDoCooldown) pintarCooldowns();
}

/** Segundos com uma casa até dez, inteiro daí para cima. */
function escreverSegundos(ms) {
  const segundos = ms / 1000;
  // Uma casa decimal só enquanto ela cabe e informa: "12,4" num slot de 40px
  // não se lê, e a essa altura a diferença de um décimo não muda decisão.
  if (segundos >= 10) return String(Math.ceil(segundos));
  return segundos.toFixed(1).replace('.', ',');
}

function apagarCooldown(slot) {
  const veil = slot.querySelector('.cooldown');
  const texto = slot.querySelector('.cooldown-text');
  // Só o que ainda está à mostra: esta função roda para todo slot parado a cada quadro.
  if (veil && !veil.hidden) veil.hidden = true;
  if (texto && !texto.hidden) texto.hidden = true;
}

function pintarCooldowns() {
  quadroDoCooldown = 0;
  const agora = performance.now();
  let vivos = 0;

  for (const [mapa, [slot, relogio]] of [
    ...[...relogiosDeCooldown].map((par) => [relogiosDeCooldown, par]),
    ...[...relogiosDeFora].map((par) => [relogiosDeFora, par]),
  ]) {
    const falta = relogio.fim - agora;
    const veil = slot.querySelector('.cooldown');
    const texto = slot.querySelector('.cooldown-text');
    // Slot que saiu da árvore não é mais desenhado por ninguém.
    if (!veil || falta <= 0 || !slot.isConnected) {
      apagarCooldown(slot);
      mapa.delete(slot);
      continue;
    }
    vivos++;
    /*
     * ---- Só escreve o que MUDOU ----
     *
     * Este laço roda a cada quadro, e escrevia as quatro coisas todas as vezes:
     * num telefone davam 300 escritas de DOM por segundo, e quase todas
     * gravavam por cima o mesmo valor. Cada uma delas suja o elemento e obriga
     * o navegador a recalcular estilo de novo.
     *
     * O véu é arredondado ao DÉCIMO de por cento antes da comparação. Sem
     * arredondar, `falta` muda a cada quadro e a guarda não guardaria nada; com
     * o décimo, a barra continua lisa (um décimo de por cento num slot de 40px
     * é 4 centésimos de pixel) e a escrita só acontece quando o desenho mudaria
     * de verdade.
     *
     * O `hidden = false` entra na conta: atribuir uma propriedade refletida em
     * atributo mexe no elemento mesmo quando o valor é o mesmo.
     */
    if (veil.hidden) veil.hidden = false;
    if (texto.hidden) texto.hidden = false;
    /*
     * ---- E o véu anda em ~20 passos por segundo, não em 60 ----
     *
     * A guarda acima só segura o que não mudou, e `falta` muda a cada quadro:
     * sozinha, ela não segurava o véu. O passo é calculado da DURAÇÃO do
     * cooldown para dar sempre cerca de vinte passos por segundo — num
     * cooldown de 30s isso são 0,17% de cada vez, e num de 1s são 5%.
     *
     * Vinte por segundo é o que o olho pede num véu de 40 pixels; sessenta era
     * o que o `requestAnimationFrame` cobrava. E o passo sai do tempo, e não um
     * número fixo, porque um passo fixo de 1% seria liso num cooldown curto e
     * picotado num longo — exatamente ao contrário do que se quer.
     */
    const passo = Math.max(0.05, 100 / Math.max(1, (relogio.total / 1000) * 20));
    const bruto = Math.min(100, (falta / relogio.total) * 100);
    const cheio = (Math.ceil(bruto / passo) * passo).toFixed(2);
    if (relogio.veuEscrito !== cheio) {
      relogio.veuEscrito = cheio;
      veil.style.setProperty('--cd', `${cheio}%`);
    }
    const conta = escreverSegundos(falta);
    if (relogio.textoEscrito !== conta) {
      relogio.textoEscrito = conta;
      texto.textContent = conta;
    }
  }

  if (vivos) quadroDoCooldown = requestAnimationFrame(pintarCooldowns);
}

function atualizarCooldowns(bar, actions) {
  const cooldowns = ctx.state.hunt?.cooldowns ?? {};
  const agora = performance.now();
  relogiosDeCooldown.clear();

  for (const slot of bar.children) {
    const index = Number(slot.dataset.slot);
    const action = actions[index];
    if (!action) continue;

    const cooldown = cooldowns[action.id];
    // Só quando muda: roda a cada quadro, e escrever o mesmo texto ainda é uma mutação.
    const extra = motivos(action, index, cooldown);
    if (slot.dataset.tipExtra !== extra) slot.dataset.tipExtra = extra;
    if (!slot.querySelector('.cooldown')) continue;

    /*
     * O relógio chega como INSTANTE e vira contagem aqui.
     *
     * A tela já fazia esta conversão de qualquer jeito — `fim: agora +
     * cooldown.left` é um prazo local, para o leque ser pintado a 60 quadros
     * por segundo sem depender do servidor. O que mudou é de onde vem o
     * número: de um campo que não viaja, em vez de um que viajava a cada
     * tique. Ver `faltaDoCooldown`.
     */
    const falta = faltaDoCooldown(cooldown, ctx.state.hunt?.clock ?? 0);
    if (falta > 0) {
      relogiosDeCooldown.set(slot, { fim: agora + falta, total: Math.max(1, cooldown.total) });
    } else {
      apagarCooldown(slot);
    }
  }

  // Um quadro só de cada vez: sem esta guarda, cada estado que chega abriria
  // mais um laço e a barra passaria a ser pintada oito vezes por quadro.
  if (relogiosDeCooldown.size && !quadroDoCooldown) {
    pintarCooldowns();
  }
}

/*
 * Arranjos da barra.
 *
 * Uma barra de caçar não serve para o boss, e refazer doze slots na mão a cada
 * troca é trabalho à toa. Aqui o jogador guarda a barra atual com um nome e
 * traz de volta com um clique. Os arranjos ficam no personagem, no servidor,
 * então atravessam troca de navegador.
 */
function renderPresets() {
  const holder = document.getElementById('hotbar-presets');
  if (!holder) return;
  const { state } = ctx;
  const presets = state.character.actionPresets ?? [];
  holder.innerHTML = '';

  /*
   * ---- Os dois automáticos, ao lado do "Salvar hk" (15/09) ----
   *
   * O dono: "além de ter essa opção na configuração, tinha que ter ali pra
   * ativar, ao lado de salvar hk, sem quebrar". Dois quadradinhos de tamanho
   * FIXO — acender não muda a largura, então a barra não pula (foi o que tirou
   * o interruptor antigo do meio dela). O mesmo `huntAssist` das Opções.
   *
   * Fora da caçada eles guardam a escolha para a próxima; na caçada automática
   * ficam apagados e travados, porque lá tudo já é automático.
   */
  const hunt = state.hunt;
  const ajustes = state.character.settings ?? {};
  const automatica = !!hunt && !hunt.manual;
  const ataque = hunt?.manual ? !!hunt.assistencia : !!ajustes.assistencia;
  const barra = hunt?.manual ? !!hunt.autoBarra : !!(ajustes.autoBarra ?? ajustes.assistencia);
  const interruptor = (tipo, ligado, icone, nome, explica) => {
    const botao = el('button', `auto-toggle${ligado ? ' ligado' : ''}`, icone);
    botao.disabled = automatica;
    botao.setAttribute('aria-pressed', String(ligado));
    botao.setAttribute('aria-label', nome);
    botao.title = automatica
      ? `${nome}: na caçada automática já está sempre ligado.`
      : `${nome}: ${ligado ? 'LIGADO' : 'desligado'} — clique para ${ligado ? 'desligar' : 'ligar'}.\n${explica}`;
    botao.onclick = () => ctx.send({ t: 'huntAssist', tipo, on: !ligado });
    return botao;
  };
  holder.append(
    interruptor('ataque', ataque, '⚔', 'Ataque automático', 'Escolhe o alvo sozinho e dá o ataque básico.'),
    interruptor('barra', barra, '', 'Barra automática', 'Magias, runas, curas e poções saem sozinhas com as condições da barra.')
  );
  /*
   * O da barra é desenho, e não letra: a mão conjurando da folha de grupos de
   * magia do Tibia (`spellgroup-icons.png`, o 5º quadro). O ✦ não dizia "magia".
   */
  holder.lastElementChild.classList.add('auto-toggle-magia');

  // "Salvar hk" e não "+ salvar": um "+" sozinho não dizia salvar O QUÊ, e
  // "salvar hotkey" por extenso alargava a coluna do Hunts, que é estreita de
  // propósito. "hk" é como o jogador escreve no chat.
  const save = el('button', 'preset-save', 'Salvar hk');
  save.title = 'guardar as hotkeys atuais com um nome';
  save.onclick = () => askPresetName(presets.length + 1);
  holder.append(save);

  /*
   * Os arranjos guardados ficam atrás de uma setinha.
   *
   * Soltos aqui eles eram um chip cada, e a coluna crescia a cada arranjo novo:
   * a barra de baixo subia junto e comia a tela do jogo — salvar três conjuntos
   * bastava para empurrar tudo. Numa lista que abre por cima, a barra não muda
   * de altura, e quem tem dez arranjos vê os dez.
   */
  if (!presets.length) return;

  const abrir = el('button', 'preset-open', '▴');
  abrir.title = `${presets.length} conjunto(s) de hotkeys guardado(s)`;
  abrir.onclick = (event) => {
    event.stopPropagation();
    // Clicar de novo fecha: o `fechar` global já removeu no `pointerdown`, e
    // sem esta guarda este clique reabriria o menu na sequência.
    const aberto = document.querySelector('.preset-menu');
    if (aberto) return void aberto.remove();
    abrirPresets(abrir, presets);
  };
  holder.append(abrir);
}

/** A lista de arranjos, ancorada acima da setinha que a abriu. */
function abrirPresets(botao, presets) {
  const { send } = ctx;
  document.querySelector('.preset-menu')?.remove();

  const menu = el('div', 'preset-menu');
  menu.append(el('header', null, 'Hotkeys salvas'));

  for (const preset of presets) {
    const linha = el('button', 'preset-chip', preset.name);
    linha.title = `${preset.slots} ação(ões) — clique para aplicar, botão direito para apagar`;
    linha.append(el('i', null, `${preset.slots}`));
    linha.onclick = () => {
      send({ t: 'actionPreset', action: 'apply', name: preset.name });
      menu.remove();
    };
    linha.oncontextmenu = (event) => {
      event.preventDefault();
      send({ t: 'actionPreset', action: 'delete', name: preset.name });
      menu.remove();
    };
    menu.append(linha);
  }

  document.body.append(menu);

  // Acima da barra inteira, não só do botão: a barra mora no rodapé e para
  // baixo não há tela. Ancorada no botão ela subia só o próprio tamanho e
  // ficava por cima das réguas de vida e mana, que estão logo acima dele.
  const caixa = botao.getBoundingClientRect();
  const rodape = document.getElementById('actionbar')?.getBoundingClientRect() ?? caixa;
  const meu = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(8, Math.round(caixa.left))}px`;
  // O MENOR dos dois topos: o botão saiu de dentro da barra e passou a morar
  // acima dela, então subir só até o topo do rodapé deixaria o menu por cima do
  // próprio botão que o abriu.
  const teto = Math.min(caixa.top, rodape.top);
  menu.style.top = `${Math.max(8, Math.round(teto - meu.height - 8))}px`;

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

/**
 * Pede o nome do conjunto num modal do jogo.
 *
 * O `prompt` do navegador abre uma caixa do Chrome no alto da tela, com a URL
 * do servidor no título — feia e fora do jogo. Este fica na moldura de sempre.
 */
function askPresetName(proximo) {
  const { send } = ctx;
  ctx.openModal('Salvar hotkeys', (body) => {
    body.append(el('p', 'shop-note', 'Guarda os doze slots como estão agora. Um nome que já existe é substituído.'));

    const campo = document.createElement('input');
    campo.className = 'search';
    campo.maxLength = 24;
    campo.value = `Hotkeys ${proximo}`;
    campo.placeholder = 'nome do conjunto';
    body.append(campo);

    const acoes = el('div', 'confirm-actions');
    const confirmar = el('button', 'primary', 'Salvar');
    const gravar = () => {
      const nome = campo.value.trim();
      if (!nome) return;
      send({ t: 'actionPreset', action: 'save', name: nome });
      ctx.closeModal();
    };
    confirmar.onclick = gravar;
    campo.onkeydown = (event) => {
      if (event.key === 'Enter') gravar();
    };

    const cancelar = el('button', 'ghost', 'Cancelar');
    cancelar.onclick = () => ctx.closeModal();

    acoes.append(cancelar, confirmar);
    body.append(acoes);
    // Nome já selecionado: quem quiser outro só digita por cima.
    setTimeout(() => campo.select(), 30);
  });
}

// ---------- editor ----------

function openEditor(slot) {
  const action = ctx.state.character.actions?.[slot];
  editing = {
    slot,
    tab: action ? (action.kind === 'item' ? 'items' : action.kind === 'rune' ? 'runes' : 'spells') : 'spells',
    filters: { search: '', level: 0, vocation: ctx.state.character.vocation ?? '' },
    draft: action
      ? {
          ...action,
          minMana: action.minMana ?? 0,
          minTargets: action.minTargets ?? 1,
          /*
           * ---- O padrão é SEM TETO, e não 12 ----
           *
           * Doze era o valor máximo escolhível, e ele nasceu como padrão por
           * ser "o maior". Só que na barra `0` quer dizer "não tem máximo", e é
           * isso que a pessoa quer quando não mexeu em nada: a magia de área
           * dispara com quantos bichos houver.
           *
           * Com 12 de fábrica, o slot desligava sozinho justamente na onda
           * grande — o momento em que a magia de área mais serve —, e sem nada
           * na tela explicando por quê.
           */
          maxTargets: action.maxTargets ?? 0,
          // Quem a magia de curar amigo cura: eu, o mais ferido, ou um nome.
          curarQuem: action.curarQuem ?? 'eu',
          curarNome: action.curarNome ?? '',
          // A partir de quanto de vida DELE a magia sai. 100 é "qualquer arranhão".
          curarAte: action.curarAte ?? 100,
          // O exeta res: de quem tirar os bichos, quantos, e de quanto em quanto.
          desafiarQuem: action.desafiarQuem ?? 'perto',
          desafiarNome: action.desafiarNome ?? '',
          desafiarMinimo: action.desafiarMinimo ?? 1,
          desafiarCada: action.desafiarCada ?? 0,
          summonPerto: action.summonPerto ?? 3,
          summonAlcance: action.summonAlcance ?? 3,
          conditions: action.conditions.map((condition) => ({ ...condition })),
          // A lista que TIRA o escudo, ao lado da que decide o disparo.
          tirarQuando: (action.tirarQuando ?? []).map((condition) => ({ ...condition })),
          // No exana vita: esperar o utamo vita poder voltar. Ver `ehMagiaDeTirarEscudo`.
          soComUtamoPronto: action.soComUtamoPronto === true,
        }
      : {
          id: null,
          enabled: true,
          minMana: 0,
          minTargets: 1,
          // Zero é "sem máximo". Ver a nota acima.
          maxTargets: 0,
          curarQuem: 'eu',
          curarNome: '',
          curarAte: 100,
          desafiarQuem: 'perto',
          desafiarNome: '',
          desafiarMinimo: 1,
          desafiarCada: 0,
          summonPerto: 3,
          summonAlcance: 3,
          conditions: [],
          tirarQuando: [],
          soComUtamoPronto: false,
        },
  };

  const titulo = deOutro ? `Configurar ação — ${ctx.state.character.name}` : 'Configurar ação';
  if (deOutro) deOutro.titulo = titulo;
  ctx.openModal(titulo, () => renderEditor(), () => {
    editing = null;
    devolverBarraPropria();
  });
  if (!catalog) ctx.send({ t: 'actions' });
}

/** O ofício do slot que está sendo editado: vida, mana, velocidade ou ataque. */
function papelDoSlot(slot) {
  return catalog?.papelDoSlot?.[slot] ?? null;
}

/** Aplica o ofício do slot, a busca por nome, o level mínimo e a vocação. */
function filtered(entries) {
  const { search, level, vocation } = editing.filters;
  const needle = search.trim().toLowerCase();
  const papel = papelDoSlot(editing.slot);
  return entries.filter((entry) => {
    /*
     * Fora do ofício do slot, nem aparece.
     *
     * Mostrar tudo e recusar no clique seria uma lista cheia de coisas que não
     * dá para escolher; o servidor recusa de qualquer jeito, mas quem tem de
     * dizer "aqui só cabe cura" é a tela, antes do clique.
     */
    if (papel && !(entry.papeis ?? []).includes(papel)) return false;
    if (needle && !`${entry.name} ${entry.words ?? ''}`.toLowerCase().includes(needle)) return false;
    if (level && (entry.level ?? 0) < level) return false;
    if (vocation && entry.vocations?.length && !entry.vocations.includes(vocation)) return false;
    return true;
  });
}

/*
 * ---- O que o familiar É, na caixa em que se configura a magia dele ----
 *
 * "na magia do summon você consegue colocar informações sobre o summon upgrades
 *  e as skins que dão bônus e o rename, e botão indicando pra ir pra store
 *  comprar?"
 *
 * Ele está certo, e o buraco era de desenho: a caixa configurava DUAS distâncias
 * e mais nada. Tudo o que decide se o familiar vale a pena — o nível, o que ele
 * bate, quanto espera para voltar, as skins — morava em três lugares diferentes
 * (a loja, a aba Extras e a régua da experiência), e nenhum deles é onde a pessoa
 * está quando pensa no familiar.
 *
 * Aqui é onde ela está. Os números vêm todos do servidor (`summonView`), então
 * esta caixa não recalcula nada — ela só mostra, e por isso não pode divergir do
 * que o jogo paga.
 */
/*
 * ---- Ela DEVOLVE o bloco, e quem chama decide onde por ----
 *
 * "tem que ser la pra cima pra ficar visivel; se vc quiser deixa la pra baixo o
 *  preview da magia e as informacoes da magia, e coloca essas coisas pra cima".
 *
 * Ela anexava direto no `detail`, e por isso caia no fim da coluna — depois do
 * resumo da magia, do desenho da area e da prioridade. Tudo o que decide se o
 * familiar vale a pena ficava abaixo da dobra, e quem abria a caixa via a ficha
 * tecnica de uma magia que ele ja' escolheu.
 *
 * Devolvendo o bloco, o chamador o poe no TOPO (`detail.prepend`). Vale so' para
 * a magia de summon: nas outras nao ha nada disto para mostrar.
 */
function fichaDoFamiliar() {
  // Ele vem no PERSONAGEM e nao no catalogo: `summonView` entra em
  // `publicCharacter` (ver index.mjs), junto do nivel e do ouro — sao dados
  // desta pessoa, e nao a tabela do jogo.
  const summon = ctx?.state?.character?.summon;
  if (!summon?.familiar) return null;
  const detail = el('div', 'familiar-ficha');

  const pct = (v) => `${Number(v).toFixed(1).replace('.', ',')}%`;
  const minutos = (ms) => {
    const seg = Math.round(ms / 1000);
    const m = Math.floor(seg / 60);
    const rest = seg % 60;
    return rest ? `${m}min${String(rest).padStart(2, '0')}` : `${m} min`;
  };

  // ---- o nível, com a barra, e o boneco ao lado ----
  detail.append(el('h3', null, 'Nível do familiar'));

  /*
   * O familiar DELE, do jeito que está agora.
   *
   * "tem que ter a imagem do summon". E é o desenho de verdade: se ele vestiu
   * uma skin, é a skin que aparece aqui — `summon.familiar.look` já vem resolvido
   * pelo servidor (ver `lookDoFamiliar`). Sem isto a caixa falava de um bicho que
   * a pessoa não estava vendo.
   */
  const cabecalho = el('div', 'familiar-cabeca');
  if (outfitInfo(summon.familiar.look)) {
    cabecalho.append(outfitCanvas(summon.familiar.look, { addons: 3, mount: 0 }, 56));
  }
  const aoLado = el('div');
  aoLado.append(el('b', null, summon.familiar.nome));

  const trilho = el('div', 'familiar-trilho');
  const cheio = el('i');
  cheio.style.width = `${Math.round((summon.nivel / summon.teto) * 100)}%`;
  trilho.append(cheio);
  const cabeca = el('div', 'familiar-nivel');
  cabeca.append(el('b', null, `${summon.nivel}`), el('span', null, `de ${summon.teto}`));
  aoLado.append(cabeca, trilho);
  cabecalho.append(aoLado);
  detail.append(cabecalho);

  detail.append(
    el(
      'p',
      'shop-note',
      `Hoje ele bate ${pct(summon.fracao * 100)} do seu golpe e volta a cada ` +
        `${minutos(summon.recarga)}, ficando ${minutos(summon.duracao)} em campo — ` +
        `${Math.round(summon.presenca * 100)}% do tempo ao seu lado. ` +
        `No ${summon.teto} ele bate ${pct(summon.fracaoMaxima * 100)} e não sai mais.`,
    ),
  );

  detail.append(
    el(
      'p',
      'shop-note',
      `Dois caminhos para subir: o Summon Upgrade Store, na aba Melhorias (vai até o ` +
        `${summon.loja.teto}), e o Summon Upgrade Dropped, que cai de qualquer boss a ` +
        `${Math.round((summon.dropado.chance ?? 0) * 100)}% — são ${summon.dropado.precisa} dele por ` +
        `nível, e ele vai até o ${summon.dropado.teto}.`,
    ),
  );
  detail.append(botaoDaLoja('Ver na aba Melhorias', 'upgrades', 'summon-upgrade'));

  // ---- as skins e o nome ----
  const skins = summon.bonusDasSkins ?? { tenho: 0, exp: 0, loot: 0, dano: 0 };
  detail.append(el('h3', null, 'Aparência, nome e bônus'));

  const pedacos = [];
  if (skins.exp) pedacos.push(`+${pct(skins.exp)} de experiência`);
  if (skins.loot) pedacos.push(`+${pct(skins.loot)} de loot`);
  if (skins.dano) pedacos.push(`+${pct(skins.dano)} de dano`);

  detail.append(
    el(
      'p',
      'shop-note',
      skins.tenho
        ? `Você tem ${skins.tenho} skin(s), e elas estão dando ${pedacos.join(', ')}. ` +
          (skins.nomeDaVestida
            ? `A vestida é a ${skins.nomeDaVestida}, e o bônus grande é dela.`
            : 'Vista uma para ganhar o bônus grande dela.')
        : 'Cada skin vale +0,5% de experiência e +0,5% de loot só por ter, e a que você vestir ' +
          'soma o bônus dela: +5% de experiência, +5% de loot ou +10% de dano, conforme a skin.',
    ),
  );

  detail.append(
    el(
      'p',
      'shop-note',
      summon.nome
        ? `Na tela ele se chama ${summon.nome}. Trocar o nome também é na aba Extras.`
        : `Na tela ele se chama ${summon.familiar.nomeDeFabrica ?? summon.familiar.nome}. ` +
          'Dá para pôr o nome que você quiser nele.',
    ),
  );
  detail.append(gradeDeSkins(summon.catalogoDeSkins ?? []));
  detail.append(botaoDaLoja('Abrir a aba Extras', 'extras'));
  return detail;
}

/*
 * ---- As nove skins, com desenho e prêmio ----
 *
 * "as skins pra pessoa ver qual skin tem e os bônus e etc".
 *
 * Uma grade e não uma lista de texto: a skin É um desenho, e o nome dela sozinho
 * ("Elemental de Terra") não diz qual das nove figuras é. Aqui dá para bater o
 * olho e ver as três coisas de uma vez — qual é, se é dela, e o que paga.
 *
 * O que NÃO é dela sai apagado em vez de sumir: metade da razão de olhar esta
 * grade é descobrir o que falta comprar. A vestida ganha moldura acesa.
 *
 * Ela não vende nada — quem vende é a loja, e o botão logo abaixo leva lá. Uma
 * compra escondida dentro da caixa de configurar uma magia seria o último lugar
 * onde alguém espera gastar coins.
 */
function gradeDeSkins(catalogo) {
  // Dentro da funcao, e nao no modulo: como estes ajudantes moram ACIMA de quem
  // os chama, um `const` de modulo declarado depois da chamada fica em zona morta
  // (`Cannot access before initialization`) e derruba a tela inteira.
  const PREMIO_CURTO = { dano: 'dano', exp: 'exp', loot: 'loot' };
  const grade = el('div', 'familiar-skins');
  for (const skin of catalogo) {
    const classe = `familiar-skin${skin.tenho ? ' tem' : ''}${skin.vestida ? ' vestida' : ''}`;
    const caixa = el('div', classe);
    if (outfitInfo(skin.look)) caixa.append(outfitCanvas(skin.look, { addons: 3, mount: 0 }, 40));
    caixa.append(el('b', null, skin.nome));
    caixa.append(
      el('em', null, `+${skin.aplicada.valor}% ${PREMIO_CURTO[skin.aplicada.tipo] ?? skin.aplicada.tipo}`),
    );
    if (skin.vestida) caixa.append(el('span', 'familiar-skin-tag', 'vestida'));
    else if (!skin.tenho) caixa.append(el('span', 'familiar-skin-tag', 'na loja'));
    grade.append(caixa);
  }
  return grade;
}

/*
 * O botão que leva à prateleira certa da loja.
 *
 * `ctx.abrirLojaEm` é a ponte que já existe (o HUD e a bolsa usam a mesma): a
 * barra de ações não pode chamar `openStore` direto porque `panels.mjs` importa
 * este arquivo, e importar de volta fecharia um ciclo.
 */
function botaoDaLoja(rotulo, secao, destaque = null) {
  const botao = el('button', 'familiar-loja');
  botao.type = 'button';
  botao.append(artOrUiIcon('coin-store', ''), document.createTextNode(rotulo));
  botao.onclick = () => ctx?.abrirLojaEm?.(secao, '', destaque);
  return botao;
}

export function renderEditor() {
  if (!editing) return;
  const body = document.getElementById('modal-body');
  body.innerHTML = '';

  if (!catalog) return void body.append(el('p', 'empty', 'carregando...'));

  const tabs = el('div', 'tabs');
  for (const [id, label] of Object.entries({ spells: 'Magias', runes: 'Runas', items: 'Itens' })) {
    const button = el('button', null, label);
    button.setAttribute('aria-selected', String(editing.tab === id));
    button.onclick = () => {
      editing.tab = id;
      renderEditor();
    };
    tabs.append(button);
  }
  body.append(tabs);

  const layout = el('div', 'action-editor');
  const left = el('div', 'action-side');

  // ---- filtros ----
  const filters = el('div', 'action-filters');

  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Buscar por nome ou palavras';
  search.value = editing.filters.search;
  search.oninput = () => {
    editing.filters.search = search.value;
    redrawList();
  };
  filters.append(search);

  const row = el('div', 'filter-row');
  const levelInput = document.createElement('input');
  levelInput.type = 'number';
  levelInput.min = '0';
  levelInput.placeholder = 'level mín.';
  levelInput.value = editing.filters.level || '';
  levelInput.oninput = () => {
    editing.filters.level = Number(levelInput.value) || 0;
    redrawList();
  };

  const vocationSelect = document.createElement('select');
  for (const [id, label] of Object.entries({ '': 'Todas as vocações', ...VOCATION_NAMES })) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = label;
    vocationSelect.append(option);
  }
  vocationSelect.value = editing.filters.vocation;
  vocationSelect.onchange = () => {
    editing.filters.vocation = vocationSelect.value;
    redrawList();
  };

  row.append(levelInput, vocationSelect);
  filters.append(row);
  left.append(filters);

  // ---- lista ----
  const list = el('div', 'action-list');
  left.append(list);
  layout.append(left);

  const redrawList = () => {
    list.innerHTML = '';
    const entries = filtered(catalog[editing.tab] ?? []);
    for (const entry of entries) {
      /*
       * A mesma classe de funcao do balao (`acao-ataque`, `acao-cura`, ...), para
       * o nome ja sair na cor certa na LISTA — e nao so' depois de clicado. E' o
       * dourado da `scorch` que o dono viu no balao da barra.
       */
      const funcaoDaLinha = entry.blocked
        ? 'bloqueada'
        : entry.heals
          ? 'cura'
          : entry.kind === 'item'
            ? 'item'
            : entry.group === 'attack'
              ? 'ataque'
              : 'suporte';
      const item = el('button', `action-item acao-${funcaoDaLinha}${entry.blocked ? ' blocked' : ''}`);
      item.setAttribute('aria-selected', String(editing.draft.id === entry.id));
      item.append(actionIcon(entry));

      const text = el('div', 'action-text');
      text.append(el('b', null, entry.name));
      // As palavras da magia em dourado, como aparecem no client.
      if (entry.words) text.append(el('em', 'words', entry.words));
      else if (entry.level) text.append(el('em', 'words', `level ${entry.level}`));
      item.append(text);

      if (entry.cost) item.append(el('span', 'action-cost', `${money(entry.cost)}g`));
      else if (typeof entry.mana === 'number' && entry.mana) item.append(el('span', 'action-cost', `${entry.mana} mana`));

      item.onclick = () => {
        editing.draft.id = entry.id;
        renderEditor();
      };
      list.append(item);
    }
    if (!entries.length) list.append(el('p', 'empty', 'nada com esse filtro'));
  };
  redrawList();

  // ---- detalhe ----
  const detail = el('div', 'action-detail');
  const entry = findEntry(editing.draft.id);

  if (!entry) {
    detail.append(el('p', 'empty', 'Escolha uma magia, runa ou item à esquerda.'));
  } else {
    const head = el('div', 'action-head');
    head.append(actionIcon(entry, 32));
    const title = el('div', 'action-text');
    title.append(el('b', null, entry.name));
    if (entry.words) title.append(el('em', 'words', entry.words));
    head.append(title);

    /*
     * ---- O que ela faz a esquerda, onde ela pega a direita ----
     *
     * O desenho estava EMBAIXO das linhas de texto, e com ele o painel de
     * escolha ficou alto demais: para ver a grade de uma magia de area era
     * preciso rolar, e a lista de magias fica ao lado — rolar o detalhe
     * escondia o que estava sendo comparado. Lado a lado, os dois cabem sem
     * rolagem e a leitura fica a mesma: leio o que faz, olho onde pega.
     */
    /*
     * ---- As MESMAS cores do balao da barra ----
     *
     * O balao que aparece ao passar o mouse num slot da barra pinta tudo: a
     * faixa do topo pela funcao da acao (ataque em cobre, cura em teal, poção
     * em roxo, bloqueada em vermelho) e cada linha pelo elemento dela — fogo
     * laranja, gelo azul, energia violeta.
     *
     * Este painel, que e' onde a magia e' ESCOLHIDA, saia todo cinza. Duas
     * telas falando da mesma magia com aparencias diferentes: o dono reparou na
     * `scorch`, dourada num lugar e cinza no outro.
     *
     * As classes sao as mesmas (`acao-*`, `el-*`, `heal`, `atk`, `area`), e a
     * folha de estilo passou a aplica-las nos dois lugares em vez de so' dentro
     * de `.tooltip`.
     */
    const funcao = entry.blocked
      ? 'bloqueada'
      : entry.heals
        ? 'cura'
        : entry.kind === 'item'
          ? 'item'
          : entry.group === 'attack'
            ? 'ataque'
            : 'suporte';
    const resumo = el('div', `action-resumo acao-${funcao}`);
    const texto = el('div', 'action-resumo-texto');
    texto.append(head);
    resumo.append(texto);
    detail.append(resumo);

    // Cada linha com a cor do que ela diz, como no balao.
    const lines = [];
    const cor = entry.heals ? 'heal' : entry.element ? `el-${entry.element}` : 'atk';
    if (entry.damage && entry.overTime) {
      lines.push([`${money(entry.damage.min)} de dano ao longo de ${entry.overTime.rounds} rodadas.`, cor]);
    } else if (entry.damage) {
      lines.push([`${entry.heals ? 'Cura' : 'Dano'} de ${money(entry.damage.min)} a ${money(entry.damage.max)}.`, cor]);
    }
    if (entry.heal) lines.push([`Cura de ${entry.heal[0]} a ${entry.heal[1]} de vida.`, 'heal']);
    if (Array.isArray(entry.mana)) lines.push([`Restaura de ${entry.mana[0]} a ${entry.mana[1]} de mana.`, 'mana']);
    if (typeof entry.mana === 'number' && entry.mana) {
      lines.push([`${entry.mana} de mana · ${(entry.cooldown / 1000).toFixed(0)}s de cooldown`, 'mana']);
    }
    // A postura não bate nem cura: o que ela faz só existe escrito. Vem do
    // servidor junto do catálogo (`postura`), ao lado da regra que a aplica.
    if (entry.postura) lines.push([entry.postura, 'heal']);
    // O desafio (exeta res) também só existe escrito: ele muda em quem o bicho
    // bate, e isso não cabe em nenhum dos números acima.
    if (entry.desafio) lines.push([entry.desafio, 'area']);
    if (entry.cost) lines.push([`Custa ${money(entry.cost)} gold por uso.`, 'ouro']);
    // A cadeia vem antes da área: é o que a magia faz de mais característico, e
    // nenhuma das que encadeiam tem área para disputar a linha.
    if (entry.cadeia) {
      lines.push([
        `Salta em até ${entry.cadeia.targets} criaturas, a ${entry.cadeia.distance} sqm uma da outra.`,
        'area',
      ]);
    }
    /*
     * ---- "Pega uma área" nao diz ONDE ----
     *
     * Cinco magias caem na casa que o jogador escolhe com a cruz do mouse, do
     * mesmo jeito que a avalanche no modo online, e nao em volta de quem lanca.
     * E' a diferenca entre apontar e conjurar, e nada na tela dizia isso: quem
     * punha a 'exevo mort ora' na barra descobria a cruz quando ela aparecia.
     */
    if (entry.area) {
      const onde = entry.miraNoChao
        ? 'Cai na casa que você escolher com o mouse.'
        : entry.alvoNoCentro
          ? 'Pega uma área em volta do alvo.'
          : 'Pega uma área.';
      lines.push([onde, 'area']);
    }
    if (entry.range) lines.push([`Alcance de ${entry.range} sqm.`, 'plain']);
    if (entry.vocations?.length) lines.push([`Vocações: ${entry.vocations.join(', ')}.`, 'plain']);
    if (entry.level) {
      lines.push([`Requer level ${entry.level}${entry.magicLevel ? ` e magic level ${entry.magicLevel}` : ''}.`, 'plain']);
    }
    for (const [line, className] of lines) texto.append(el('p', className, line));

    /*
     * O desenho de onde a magia pega, logo abaixo do que ela faz.
     *
     * E' aqui que se ESCOLHE a magia, e "pega uma area" nao diz o tamanho nem o
     * feitio dela. Quem nunca jogou Tibia nao tem como saber que a `exevo vis
     * hur` sai para a frente e a `exevo gran mas frigo` nasce em volta.
     */
    const forma = previaDaMagia(entry, { comOutfit: true });
    if (forma) resumo.append(forma);

    if (entry.blocked) detail.append(el('p', 'blocked-note', `Você ainda não pode usar: ${entry.blocked}.`));
  }

  /*
   * A ordem saiu daqui.
   *
   * Era um número de 0 a 11 dentro de cada ação, dizendo a mesma coisa que a
   * posição na barra — e quando os dois discordavam, a barra mostrava uma
   * ordem e o personagem disparava outra. Agora quem manda é o slot: o 1 tenta
   * primeiro, o 12 por último, e mudar a ordem é mudar de slot.
   */

  // ---- ataque: mana mínima e faixa de criaturas ----
  const isAttack = entry?.group === 'attack';
  if (isAttack) {
    detail.append(el('h3', null, 'Quando atacar'));
    /*
     * A nota diz a verdade de CADA magia, e não uma verdade média.
     *
     * O texto único ("quantos monstros estão a até 4 sqm") era certo para a
     * magia de alvo único e errado para a de área — e foi exatamente essa
     * diferença que gerou o relato do jogador: ele pôs mínimo 3 numa magia de
     * área e ela saiu batendo em 2, porque a conta era de quem estava POR
     * PERTO. Agora a conta é de quem a área pega, e a tela diz isso.
     */
    detail.append(
      el(
        'p',
        'shop-note',
        entry?.area
          ? 'Nas magias de área a faixa conta quantas criaturas a área PEGA de verdade com a mira do momento — e não quantas estão por perto.'
          : 'A faixa conta quantos monstros estão a até 4 sqm com linha de tiro.'
      )
    );
    detail.append(
      numberRow(
        'Mana mínima (%)',
        editing.draft.minMana,
        0,
        100,
        (value) => {
          editing.draft.minMana = value;
        },
        'mana'
      )
    );
    detail.append(
      numberRow(
        'Mínimo de criaturas',
        editing.draft.minTargets,
        1,
        MAX_ALVOS,
        (value) => {
          editing.draft.minTargets = value;
        },
        'criaturas'
      )
    );
    /*
     * O máximo desce até ZERO, e zero é "sem máximo".
     *
     * O mínimo continua começando em 1 porque zero criatura não é uma faixa —
     * nenhuma magia sai sem bicho por perto. No máximo, o zero é o único
     * número que sobrava para dizer "nunca pare", e é o que faltava: a magia
     * de área desligava sozinha na onda grande, que é quando ela mais serve.
     */
    detail.append(
      numberRow(
        'Máximo de criaturas',
        editing.draft.maxTargets,
        0,
        MAX_ALVOS,
        (value) => {
          editing.draft.maxTargets = value;
        },
        'criaturas'
      )
    );
    detail.append(el('p', 'shop-note', `Máximo em 0 quer dizer sem máximo — a magia sai com quantas criaturas houver. O teto é ${MAX_ALVOS}.`));
  }

  /*
   * ---- Quem esta magia cura ----
   *
   * `exura sio` e as duas irmãs dela curam OUTRA pessoa: no servidor elas pedem
   * um alvo justamente porque não é em quem lança que elas caem. Sem esta
   * escolha a magia existia na barra e curava o próprio conjurador, que já tem
   * a `exura` dele — era a magia errada saindo no lugar certo.
   *
   * Três respostas, e a do meio é a que quase sempre se quer: "o mais ferido"
   * escolhe a cada disparo quem estiver com a menor fração de vida na caçada.
   * O nome fixo é para quando o druida está cuidando de alguém em particular.
   */
  if (entry?.curaOutro) {
    detail.append(el('h3', null, 'Quem curar'));
    detail.append(
      el('p', 'shop-note', 'Esta magia cura outra pessoa da caçada. Sem escolher ninguém, ela cai em você mesmo.')
    );

    const escolha = document.createElement('select');
    for (const [id, label] of Object.entries({
      eu: 'Eu mesmo',
      ferido: 'Qualquer um da party (o mais ferido)',
      nome: 'Uma pessoa pelo nome',
    })) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = label;
      escolha.append(option);
    }
    escolha.value = editing.draft.curarQuem ?? 'eu';
    escolha.onchange = () => {
      editing.draft.curarQuem = escolha.value;
      renderEditor();
    };
    const linha = el('label', 'field');
    linha.append(el('span', null, 'Curar'), escolha);
    detail.append(linha);

    if (editing.draft.curarQuem === 'nome') {
      const nome = document.createElement('input');
      nome.type = 'text';
      nome.placeholder = 'nome do personagem';
      nome.maxLength = 32;
      nome.value = editing.draft.curarNome ?? '';
      nome.oninput = () => {
        editing.draft.curarNome = nome.value;
      };
      const campo = el('label', 'field');
      campo.append(el('span', null, 'Nome'), nome);
      detail.append(campo);
      detail.append(
        el('p', 'shop-note', 'Enquanto essa pessoa não estiver na caçada, a magia não sai.')
      );
    }

    /*
     * ---- A partir de QUANTO de vida ----
     *
     * Sem isto a magia saía com o companheiro em 99% de vida: 120 de mana por
     * um arranhão, a cada dois segundos. É a mesma pergunta que o slot de vida
     * do próprio personagem faz, apontada para o outro.
     */
    if (editing.draft.curarQuem !== 'eu') {
      const vida = document.createElement('input');
      vida.type = 'number';
      vida.min = '1';
      vida.max = '100';
      vida.step = '1';
      vida.value = String(editing.draft.curarAte ?? 100);
      vida.oninput = () => {
        const n = Math.round(Number(vida.value));
        editing.draft.curarAte = Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 100;
      };
      const faixa = el('label', 'field');
      faixa.append(el('span', null, 'Curar com a vida em até (%)'), vida);
      detail.append(faixa);
      detail.append(
        el(
          'p',
          'shop-note',
          editing.draft.curarQuem === 'ferido'
            ? `A magia só sai quando alguém da caçada estiver com ${editing.draft.curarAte ?? 100}% de vida ou menos.`
            : `A magia só sai quando essa pessoa estiver com ${editing.draft.curarAte ?? 100}% de vida ou menos.`
        )
      );
    }
  }

  /*
   * ---- Quando o exeta res vale a pena ----
   *
   * O pedido: "só quando os bichos virarem em [alguém] — e o nome do player, e
   * quantidade de bichos que estiverem atacando o outro player, e opção de pôr
   * pra usar a cada tempo também".
   *
   * O desafio é a única magia da barra cuja utilidade não depende de quem lança
   * e sim de QUEM ESTÁ APANHANDO. Sem estas três perguntas ele saía na recarga,
   * o tempo todo, inclusive quando ninguém precisava — 30 de mana a cada dois
   * segundos e o cavaleiro puxando bicho que o mago já ia matar.
   */
  /*
   * ---- As duas distâncias do familiar ----
   *
   * "eu tenho que escolher a qual distância o summon tem que ficar de mim e a
   * qual distância atacar o alvo."
   *
   * Elas são a única configuração que uma magia de summon aceita, e por isso
   * moram aqui e não num painel próprio: quem quer mexer nelas está olhando
   * para o slot em que a magia está.
   *
   * O padrão dos dois é 3, que é o número da base dele — quem não abrir esta
   * caixa nunca vê diferença.
   */
  if (entry?.summon) {
    /*
     * A ficha do familiar vai para o TOPO da coluna, acima do resumo da magia.
     *
     * `prepend` e nao `append`: o que a pessoa veio ver aqui e' o familiar dela,
     * e o resumo da magia ela ja' leu na lista da esquerda para escolher.
     */
    const ficha = fichaDoFamiliar();
    if (ficha) detail.prepend(ficha);

    /*
     * E aqui embaixo ficam so' as DISTANCIAS — o unico ajuste que esta caixa
     * grava na acao. O titulo mudou de "O familiar" para nao haver dois blocos
     * com o mesmo nome na mesma coluna: o de cima e' quem ele e', este e' onde
     * ele fica.
     */
    detail.append(el('h3', null, 'Distâncias do familiar'));
    detail.append(el('p', 'shop-note', entry.summon));

    const numero = (rotulo, campo, min, max, nota) => {
      const caixa = document.createElement('input');
      caixa.type = 'number';
      caixa.min = String(min);
      caixa.max = String(max);
      caixa.step = '1';
      caixa.value = String(editing.draft[campo] ?? 3);
      caixa.oninput = () => {
        const n = Math.round(Number(caixa.value));
        editing.draft[campo] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 3;
      };
      const linha = el('label', 'field');
      linha.append(el('span', null, rotulo), caixa);
      detail.append(linha);
      detail.append(el('p', 'shop-note', nota));
    };

    numero(
      'Fica a até (casas) de você',
      'summonPerto',
      1,
      5,
      'Passando disso ele reaparece do seu lado. Menor gruda mais; maior deixa ele para trás por mais tempo.'
    );
    numero(
      'Bate num raio de (casas) do alvo',
      'summonAlcance',
      1,
      7,
      'O golpe dele sai em volta do SEU alvo. Maior pega mais bicho de uma vez; menor concentra em quem você está matando.'
    );
  }

  if (entry?.desafio) {
    detail.append(el('h3', null, 'Quando chamar'));
    detail.append(el('p', 'shop-note', entry.desafio));

    const deQuem = document.createElement('select');
    for (const [id, label] of Object.entries({
      perto: 'Sempre que houver bicho no alcance',
      qualquer: 'Quando alguém da party estiver apanhando',
      nome: 'Quando uma pessoa pelo nome estiver apanhando',
    })) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = label;
      deQuem.append(option);
    }
    deQuem.value = editing.draft.desafiarQuem ?? 'perto';
    deQuem.onchange = () => {
      editing.draft.desafiarQuem = deQuem.value;
      renderEditor();
    };
    const linhaDeQuem = el('label', 'field');
    linhaDeQuem.append(el('span', null, 'Chamar'), deQuem);
    detail.append(linhaDeQuem);

    if (editing.draft.desafiarQuem === 'nome') {
      const nome = document.createElement('input');
      nome.type = 'text';
      nome.placeholder = 'nome do personagem';
      nome.maxLength = 32;
      nome.value = editing.draft.desafiarNome ?? '';
      nome.oninput = () => {
        editing.draft.desafiarNome = nome.value;
      };
      const campo = el('label', 'field');
      campo.append(el('span', null, 'Nome'), nome);
      detail.append(campo);
    }

    if (editing.draft.desafiarQuem !== 'perto') {
      const quantos = document.createElement('input');
      quantos.type = 'number';
      quantos.min = '1';
      quantos.max = '12';
      quantos.step = '1';
      quantos.value = String(editing.draft.desafiarMinimo ?? 1);
      quantos.oninput = () => {
        const n = Math.round(Number(quantos.value));
        editing.draft.desafiarMinimo = Number.isFinite(n) ? Math.min(12, Math.max(1, n)) : 1;
      };
      const campo = el('label', 'field');
      campo.append(el('span', null, 'Com pelo menos (bichos em cima)'), quantos);
      detail.append(campo);
      detail.append(
        el(
          'p',
          'shop-note',
          'Conta os bichos que estão mirando NELE, e não os que estão em você — o desafio existe para tirar bicho dos outros.'
        )
      );
    }

    const cada = document.createElement('input');
    cada.type = 'number';
    cada.min = '0';
    cada.max = '600';
    cada.step = '1';
    cada.value = String(editing.draft.desafiarCada ?? 0);
    cada.oninput = () => {
      const n = Math.round(Number(cada.value));
      editing.draft.desafiarCada = Number.isFinite(n) ? Math.min(600, Math.max(0, n)) : 0;
    };
    const linhaCada = el('label', 'field');
    linhaCada.append(el('span', null, 'No máximo uma vez a cada (s)'), cada);
    detail.append(linhaCada);
    detail.append(
      el(
        'p',
        'shop-note',
        Number(editing.draft.desafiarCada ?? 0) > 0
          ? `Mesmo com tudo batendo, ela espera ${editing.draft.desafiarCada}s entre um chamado e outro.`
          : 'Zero é sem espera extra: vale a recarga da própria magia.'
      )
    );
  }

  // ---- condições ----
  detail.append(el('h3', null, 'Condições'));
  /*
   * ---- A explicação é do TIPO da condição, e não uma frase só ----
   *
   * O dono pediu: "a nova condição que fizemos tem que ser melhor explicada pro
   * player saber o que ela faz". Uma linha dizendo "vida, mana ou o nome da
   * criatura" nomeia a condição sem dizer o que ela FAZ — e a de criatura é a
   * única das duas que não se adivinha pelo nome.
   *
   * Então são três parágrafos curtos: a regra geral (todas precisam bater), o
   * que a de criatura decide, e o exemplo que motivou o pedido — a SD que não
   * pode sair na criatura imune a morte.
   */
  detail.append(
    el(
      'p',
      'shop-note',
      isAttack
        ? 'Opcional para ataque. A ação só sai quando TODAS as condições estiverem batendo.'
        : 'A ação só sai quando TODAS as condições estiverem batendo.'
    )
  );
  detail.append(
    el(
      'p',
      'shop-note',
      'Vida/Mana olha um número seu ou do alvo. Bichos por perto conta as criaturas em volta. Criatura olha o NOME de quem está mirado: ' +
        '“é uma de” só deixa sair nas criaturas da lista, “não é nenhuma de” deixa sair em todas menos nelas.'
    )
  );
  detail.append(
    el(
      'p',
      'shop-note dica',
      'Exemplo: numa hunt com criaturas imunes a morte, ponha “Criatura · não é nenhuma de · ghost, phantasm” ' +
        'na Death Strike e deixe outra magia de alvo único sem condição — a SD para de sair no bicho imune e a outra cobre o resto.'
    )
  );

  for (const [index, condition] of editing.draft.conditions.entries()) {
    detail.append(conditionRow(condition, index));
  }

  const add = el('button', 'ghost', '+ Adicionar condição');
  add.onclick = () => {
    editing.draft.conditions.push({ kind: 'stat', who: 'self', stat: 'hp', op: 'lte', value: 70, percent: true });
    renderEditor();
  };
  detail.append(add);

  /*
   * ---- "Tirar o escudo quando": o exana vita mora aqui dentro ----
   *
   * "coloque a funcao do exana vita pra ter dentro das condicoes do utamo
   *  vita".
   *
   * As duas magias sao uma decisao so' — ligar o escudo e saber quando
   * desligar. Separadas em dois slots, quem punha uma e esquecia a outra
   * ficava sem a metade que salva: o escudo gasta a mana ate' o fim, e mana e'
   * o que paga a cura.
   *
   * A secao so' aparece na magia do escudo. Numa magia de ataque ela seria uma
   * pergunta sem resposta.
   */
  if (ehMagiaDeEscudo(entry)) {
    detail.append(el('h3', null, 'Tirar o escudo quando'));
    detail.append(
      el(
        'p',
        'shop-note',
        'Com o escudo de pé, o golpe sai da MANA — que é o mesmo bolso que paga a cura. ' +
          'Estas faixas lançam o exana vita sozinho e devolvem o dano para a vida, que se cura com poção.'
      )
    );
    detail.append(
      el('p', 'shop-note dica', 'Exemplo: “Você · Mana · menor ou igual a · 25%” — o escudo cai antes de a mana acabar, e sobra com que curar.')
    );
    editing.draft.tirarQuando ??= [];
    for (const [i, condicao] of editing.draft.tirarQuando.entries()) {
      detail.append(conditionRow(condicao, i, editing.draft.tirarQuando));
    }
    const maisUma = el('button', 'ghost', '+ Tirar quando');
    maisUma.onclick = () => {
      editing.draft.tirarQuando.push({ kind: 'stat', who: 'self', stat: 'mana', op: 'lte', value: 25, percent: true });
      renderEditor();
    };
    detail.append(maisUma);
  }

  /*
   * ---- No exana vita: "só tirar se o utamo vita já pode voltar" ----
   *
   * Report do Garibas: "remover magic shield apenas se cooldown do utamo vita
   * já tiver passado". Um slot separado de exana vita tirava o escudo logo
   * depois de posto, e o jogador ficava os 14 s da recarga sem poder religar.
   * A regra mora no servidor (`tentarAcao`); aqui é só a chave.
   */
  if (ehMagiaDeTirarEscudo(entry)) {
    const chave = el('label', 'switch');
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = !!editing.draft.soComUtamoPronto;
    caixa.onchange = () => (editing.draft.soComUtamoPronto = caixa.checked);
    chave.append(caixa, document.createTextNode('Só tirar o escudo se o utamo vita já puder ser lançado de novo'));
    detail.append(chave);
    detail.append(
      el('p', 'shop-note dica', 'Assim o escudo não cai durante a recarga do utamo vita, quando não daria para pô-lo de volta.')
    );
  }

  /*
   * ---- Prioridade de disparo ----
   *
   * Havia um campo "prioridade" de 0 a 11 dentro de cada ação, e ele saiu por
   * um bom motivo: dizia a mesma coisa que a posição na barra, só que escondido
   * — e quando os dois discordavam, o jogador via a barra numa ordem e o
   * personagem disparava noutra.
   *
   * O que ele NÃO deveria ter levado junto foi o controle: sem ele, mudar a
   * prioridade virou arrastar slot com slot, e não havia nada na tela dizendo
   * qual das cinco magias de ataque tenta primeiro.
   *
   * Ele volta como o que sempre foi de verdade: a POSIÇÃO. As setas trocam esta
   * ação com a do slot vizinho DO MESMO OFÍCIO — cura sobe entre cura, ataque
   * entre ataque — pelo mesmo `swap` que o arrasto usa. Continua havendo uma
   * fonte só da ordem, e agora ela tem botão.
   */
  const papelDaqui = papelDoSlot(editing.slot);
  const irmaos = (catalog?.papelDoSlot ?? [])
    .map((papel, indice) => (papel === papelDaqui ? indice : -1))
    .filter((indice) => indice >= 0);
  const posicao = irmaos.indexOf(editing.slot);

  if (irmaos.length > 1 && posicao >= 0) {
    const nomeDoPapel = catalog?.papeis?.[papelDaqui]?.nome ?? papelDaqui;
    /*
     * A prioridade é montada aqui embaixo, mas ENTRA lá em cima.
     *
     * Ela era a última seção, depois das quatro condições e do botão de
     * acrescentar — quem quisesse mudar qual magia tenta primeiro tinha de
     * rolar a caixa inteira para descobrir que o controle existe. E é a
     * pergunta mais comum de quem tem cinco magias de ataque na barra.
     *
     * O código fica no fim porque depende do `papelDaqui` e dos irmãos, que só
     * existem depois do resto; a POSIÇÃO na tela é decidida no `insertBefore`
     * do fim do bloco: antes do primeiro `h3`, logo abaixo do resumo da magia.
     */
    const bloco = el('div', 'bloco-prioridade');
    bloco.append(el('h3', null, 'Prioridade'));
    bloco.append(
      el(
        'p',
        'shop-note',
        `A barra dispara de cima para baixo: o primeiro slot tenta antes do segundo. ` +
          `Digite a posição desta ação entre os ${irmaos.length} slots de ${nomeDoPapel.toLowerCase()} — ` +
          `1 é a primeira a tentar.`
      )
    );

    const linha = el('div', 'prioridade');

    const mover = (direcao) => {
      const destino = irmaos[posicao + direcao];
      if (destino === undefined) return;
      /*
       * A ação em rascunho é gravada ANTES da troca.
       *
       * O `swap` mexe no que está guardado no servidor; o que está aberto aqui
       * pode ter mudanças ainda não salvas (uma condição nova, o piso de mana).
       * Sem gravar antes, subir de posição jogaria essas mudanças fora.
       */
      if (entry) ctx.send({ t: 'actions', action: 'set', slot: editing.slot, value: editing.draft });
      ctx.send({ t: 'actions', action: 'swap', from: editing.slot, to: destino });
      // O editor segue a ação para o novo slot: quem clicou em "subir" quer
      // continuar mexendo na mesma magia, e não na que veio para cá.
      editing.slot = destino;
      renderEditor();
    };

    /*
     * ---- A prioridade se DIGITA ----
     *
     * As setas ▲/▼ movem de um em um, e com cinco magias de ataque tirar a
     * última para a frente custava quatro cliques e quatro idas ao servidor.
     * O campo era assim na primeira versão e é assim que se pensa nisso: "esta
     * é a minha segunda magia".
     *
     * O que ele NÃO é: um número guardado dentro da ação. Aquele campo escondido
     * dizia a mesma coisa que a posição na barra e podia discordar dela — o
     * jogador via a barra numa ordem e o personagem disparava noutra. Aqui o
     * número é a posição: digitar 2 REALOCA a ação para o segundo slot do
     * ofício, empurrando quem estava no caminho. A barra continua sendo a única
     * fonte da ordem, e agora ela responde a um número.
     *
     * As setas continuam, porque um passo de cada vez é o gesto mais comum.
     */
    const irPara = (alvo) => {
      const destino = Math.max(0, Math.min(irmaos.length - 1, Math.floor(alvo) - 1));
      if (destino === posicao) return;
      // Grava o rascunho antes de mexer na ordem — vale o mesmo que em `mover`.
      if (entry) ctx.send({ t: 'actions', action: 'set', slot: editing.slot, value: editing.draft });
      /*
       * Andar casa a casa, e não pular direto.
       *
       * Um `swap` do 5º para o 2º trocaria os dois de lugar e deixaria o que
       * estava em 2º lá no fim — o resto da fila embaralhado. Trocando com o
       * vizinho até chegar, os outros DESLIZAM uma posição, que é o que
       * "passar para a frente" quer dizer.
       */
      const passo = destino > posicao ? 1 : -1;
      for (let atual = posicao; atual !== destino; atual += passo) {
        ctx.send({ t: 'actions', action: 'swap', from: irmaos[atual], to: irmaos[atual + passo] });
      }
      editing.slot = irmaos[destino];
      renderEditor();
    };

    const subir = el('button', 'ghost', '▲');
    subir.disabled = posicao === 0;
    subir.title = subir.disabled ? 'já é o primeiro a tentar' : `troca com o slot ${irmaos[posicao - 1] + 1}`;
    subir.onclick = () => mover(-1);

    const descer = el('button', 'ghost', '▼');
    descer.disabled = posicao === irmaos.length - 1;
    descer.title = descer.disabled ? 'já é o último a tentar' : `troca com o slot ${irmaos[posicao + 1] + 1}`;
    descer.onclick = () => mover(1);

    const campo = document.createElement('input');
    campo.type = 'number';
    campo.className = 'prioridade-campo';
    campo.min = '1';
    campo.max = String(irmaos.length);
    campo.step = '1';
    campo.value = String(posicao + 1);
    campo.title = `Digite de 1 a ${irmaos.length} — 1 é a primeira a tentar`;
    // No Enter e ao sair do campo, não a cada dígito: digitar "12" passaria
    // por "1" no caminho e realocaria duas vezes.
    const aplicar = () => {
      const pedido = Number(campo.value);
      if (!Number.isFinite(pedido)) return void (campo.value = String(posicao + 1));
      irPara(pedido);
    };
    campo.onkeydown = (evento) => {
      if (evento.key === 'Enter') { evento.preventDefault(); campo.blur(); }
    };
    campo.onblur = aplicar;

    linha.append(subir, campo, el('em', 'prioridade-de', `de ${irmaos.length}`), descer);
    bloco.append(linha);
    /*
     * Antes do primeiro `h3` — que é "Quando atacar", "Quem curar" ou
     * "Condições", conforme o tipo da ação. Assim a prioridade fica logo abaixo
     * do resumo da magia, sem rolagem, qualquer que seja a ação escolhida.
     *
     * `insertBefore` com `null` no segundo argumento vira `append`, então uma
     * ação sem nenhuma seção (se um dia houver) não quebra: a prioridade só cai
     * para o fim, que é onde ela estava.
     *
     * ---- `:scope >` não é enfeite ----
     *
     * Era um `querySelector('h3')` seco, e ele varre os DESCENDENTES: no dia em que
     * a ficha do familiar entrou no topo — um `div` com `h3` dentro —, o alvo achado
     * passou a ser neto e não filho, e o `insertBefore` estourou com
     * `NotFoundError`. A caixa inteira parava de montar.
     *
     * O que se quer aqui é a primeira SEÇÃO desta coluna, e seção é filha direta.
     */
    detail.insertBefore(bloco, detail.querySelector(':scope > h3'));
  }

  // ---- rodapé ----
  const footer = el('div', 'action-footer');
  const remove = el('button', 'danger', 'Remover');
  remove.onclick = () => {
    ctx.send({ t: 'actions', action: 'set', slot: editing.slot, value: null });
    ctx.closeModal();
  };

  const toggle = el('label', 'switch');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = editing.draft.enabled;
  input.onchange = () => (editing.draft.enabled = input.checked);
  toggle.append(input, document.createTextNode('Ativada'));

  const save = el('button', null, 'Salvar');
  save.disabled = !entry;
  save.onclick = () => {
    ctx.send({ t: 'actions', action: 'set', slot: editing.slot, value: editing.draft });
    ctx.closeModal();
  };

  footer.append(remove, toggle, save);
  detail.append(footer);

  layout.append(detail);
  body.append(layout);
}

/** Linha "rótulo − valor +", usada pelos limites numéricos. */
/*
 * `qual` é o assunto do campo, e é ele que escolhe o desenho. Opcional: as
 * linhas que não têm um assunto com ícone continuam só com o rótulo.
 */
function numberRow(label, current, min, max, onChange, qual = null) {
  const row = el('div', 'condition number-row');
  const rotulo = el('span', 'number-label');
  if (qual) rotulo.append(icone(qual, label));
  rotulo.append(el('b', null, label));
  row.append(rotulo);

  const input = document.createElement('input');
  input.type = 'number';
  input.min = String(min);
  input.max = String(max);
  input.value = current;

  const commit = (value) => {
    const clamped = Math.max(min, Math.min(max, Math.round(value) || 0));
    input.value = clamped;
    onChange(clamped);
  };
  input.oninput = () => onChange(Math.max(min, Math.min(max, Number(input.value) || 0)));

  const minus = el('button', 'step', '−');
  minus.onclick = () => commit(Number(input.value) - 1);
  const plus = el('button', 'step', '+');
  plus.onclick = () => commit(Number(input.value) + 1);

  row.append(minus, input, plus);
  return row;
}

/*
 * ---- Os nomes das criaturas, para a lista de escolha ----
 *
 * Vêm do bestiary, que o cliente já recebe inteiro: é a única lista de
 * criaturas que existe do lado de cá, e ela tem o nome de todas — inclusive as
 * que o jogador ainda não matou. É o certo aqui: a condição serve para EVITAR
 * um bicho, e quem está montando a barra antes de entrar na hunt precisa poder
 * escrever o nome dele sem ter morrido para ele antes.
 *
 * Sai ordenado e sem repetição, e é guardado: são ~1800 nomes e a lista não
 * muda durante a partida.
 */
let nomesDeCriaturas = null;
function listaDeCriaturas() {
  if (nomesDeCriaturas) return nomesDeCriaturas;
  const bestiary = ctx?.state?.catalog?.bestiary;
  if (!bestiary) return [];
  nomesDeCriaturas = [...new Set(Object.values(bestiary).map((c) => c.name).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );
  return nomesDeCriaturas;
}

/*
 * ---- A condição de NOME ----
 *
 * "tem hunt que tem criaturas imunes, que deveria evitar SD e poder colocar
 * uma outra magia single target" — então a forma da regra é uma LISTA, e não
 * um nome só: numa hunt mista são três ou quatro imunes, e obrigar uma
 * condição por bicho gastaria as quatro que cabem no slot.
 *
 * Os nomes ficam como fichas com um ✕, e não como texto separado por vírgula:
 * assim dá para tirar um do meio sem reescrever o resto, e não há como errar a
 * pontuação e a regra silenciosamente deixar de valer.
 */
function linhaDeNome(condition, index, select) {
  const row = el('div', 'condition nome');

  /*
   * O rótulo diz sobre QUEM a regra fala.
   *
   * Sem ele a linha começava por "é uma de" e não havia nada dizendo que o
   * assunto era a criatura mirada — nem que a regra não vale para o alvo que
   * ainda não existe. As duas coisas cabem numa palavra e num balão.
   */
  const rotulo = el('span', 'rotulo', 'A criatura mirada');
  rotulo.title =
    'O nome da criatura que está no alvo no momento do disparo. Sem alvo, "é uma de" segura a ação e "não é nenhuma de" deixa passar.';
  row.append(rotulo);

  row.append(
    select({ igual: 'é uma de', diferente: 'não é nenhuma de' }, condition.op ?? 'igual', (value) => {
      condition.op = value;
    })
  );

  const fichas = el('div', 'fichas');
  const redesenhar = () => {
    fichas.textContent = '';
    if (!condition.names?.length) {
      fichas.append(el('i', 'vazio', 'nenhuma criatura escolhida — a condição não faz nada'));
    }
    for (const [i, nome] of (condition.names ?? []).entries()) {
      const ficha = el('span', 'ficha', nome);
      const tirar = el('button', 'step', '✕');
      tirar.onclick = () => {
        condition.names.splice(i, 1);
        redesenhar();
      };
      ficha.append(tirar);
      fichas.append(ficha);
    }
  };

  const busca = document.createElement('input');
  busca.type = 'text';
  busca.placeholder = 'nome da criatura';
  busca.setAttribute('list', 'lista-de-criaturas');
  const juntar = () => {
    const nome = busca.value.trim().toLowerCase();
    if (!nome) return;
    condition.names ??= [];
    // Vinte é o mesmo teto do servidor (MAX_NOMES); passar disso seria a tela
    // aceitar o que o save descarta calado.
    if (!condition.names.includes(nome) && condition.names.length < 20) condition.names.push(nome);
    busca.value = '';
    redesenhar();
  };
  busca.onkeydown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    juntar();
  };
  // A escolha na lista do navegador não dispara Enter: ela dispara change.
  busca.onchange = () => juntar();
  const por = el('button', 'step', '+');
  por.onclick = juntar;

  /*
   * A lista de sugestões é UMA no documento inteiro, e não uma por linha: são
   * ~1800 nomes, e quatro condições abertas montariam sete mil nós à toa.
   */
  if (!document.getElementById('lista-de-criaturas')) {
    const datalist = document.createElement('datalist');
    datalist.id = 'lista-de-criaturas';
    for (const nome of listaDeCriaturas()) {
      const option = document.createElement('option');
      option.value = nome;
      datalist.append(option);
    }
    document.body.append(datalist);
  }

  const drop = el('button', 'danger step', '✕');
  drop.onclick = () => {
    lista.splice(index, 1);
    renderEditor();
  };

  redesenhar();
  row.append(busca, por, drop, fichas);
  return row;
}

/*
 * `lista` e' de onde esta linha saiu: a das condicoes de DISPARO, ou a do
 * "tirar o escudo quando". Ela existe so' para o botao de remover saber o que
 * apagar — antes ele apagava sempre da primeira, e as duas listas usam a
 * mesma linha de propósito: e' a mesma pergunta.
 */
/*
 * E' esta a magia do escudo de mana? Pelas PALAVRAS, que e' o que nao muda —
 * o nome vem traduzido do catalogo e o id e' montado a partir dele.
 */
const ehMagiaDeEscudo = (entry) => (entry?.words ?? '').toLowerCase() === 'utamo vita';
/** A magia que TIRA o escudo. A mesma lista do servidor: `PALAVRAS_QUE_TIRAM`, em escudo.mjs. */
const ehMagiaDeTirarEscudo = (entry) => (entry?.words ?? '').toLowerCase() === 'exana vita';

function conditionRow(condition, index, lista = editing.draft.conditions) {
  const select = (options, value, onChange) => {
    const node = document.createElement('select');
    for (const [id, label] of Object.entries(options)) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = label;
      node.append(option);
    }
    node.value = value;
    node.onchange = () => onChange(node.value);
    return node;
  };

  /*
   * O tipo vem primeiro em toda linha, e é ele que troca o resto dos controles.
   *
   * As condições gravadas antes desta tela não têm o campo, e todas elas são de
   * número — o mesmo padrão que o servidor usa ao higienizar.
   */
  const tipo = () =>
    select(
      { stat: 'Vida/Mana', nome: 'Criatura', perto: 'Bichos por perto' },
      condition.kind ?? 'stat',
      (value) => {
        condition.kind = value;
        if (value === 'nome') {
          condition.op = 'igual';
          condition.names ??= [];
        } else if (value === 'perto') {
          /*
           * "Pelo menos 1" é o que quase todo mundo quer da primeira vez: ela
           * nasceu para as posturas, e a pergunta delas é "tem bicho?".
           */
          condition.op = 'gte';
          condition.value = 1;
        } else {
          condition.who ??= 'self';
          condition.stat ??= 'hp';
          condition.op = 'lte';
          condition.value ??= 70;
          condition.percent ??= true;
        }
        renderEditor();
      }
    );

  /*
   * ---- A linha de "bichos por perto" ----
   *
   * Ela é curta de propósito: tipo, comparação e número, e mais nada. Não tem
   * "Você/Alvo" (o número é do campo, não de ninguém) nem o `%` (não existe
   * porcentagem de bicho) — e cada controle a mais numa linha que não precisa
   * dele é uma pergunta a mais para quem está só tentando ligar uma postura.
   */
  if ((condition.kind ?? 'stat') === 'perto') {
    const row = el('div', 'condition');
    row.append(tipo());
    row.append(
      select({ gte: 'pelo menos', lte: 'no máximo' }, condition.op === 'lte' ? 'lte' : 'gte', (value) => {
        condition.op = value;
      })
    );
    const quantos = document.createElement('input');
    quantos.type = 'number';
    quantos.min = '0';
    quantos.max = '25';
    quantos.step = '1';
    quantos.value = String(condition.value ?? 1);
    quantos.oninput = () => {
      const n = Math.round(Number(quantos.value));
      condition.value = Number.isFinite(n) ? Math.min(25, Math.max(0, n)) : 1;
    };
    const menos = el('button', 'step', '−');
    const mais = el('button', 'step', '+');
    menos.onclick = () => {
      condition.value = Math.max(0, (condition.value ?? 1) - 1);
      quantos.value = String(condition.value);
    };
    mais.onclick = () => {
      condition.value = Math.min(25, (condition.value ?? 1) + 1);
      quantos.value = String(condition.value);
    };
    const fora = el('button', 'danger step', '✕');
    fora.onclick = () => {
      lista.splice(index, 1);
      renderEditor();
    };
    row.append(menos, quantos, mais, el('span', 'condition-unidade', 'criaturas'), fora);
    return row;
  }

  if ((condition.kind ?? 'stat') === 'nome') {
    const row = linhaDeNome(condition, index, select);
    row.prepend(tipo());
    return row;
  }

  const row = el('div', 'condition');
  row.append(tipo());

  row.append(
    select({ self: 'Você', target: 'Alvo' }, condition.who, (value) => {
      condition.who = value;
      renderEditor();
    })
  );
  /*
   * O ícone acompanha a escolha: trocar de HP para Mana troca o desenho ao
   * lado, e é assim que se lê a linha inteira de relance sem soletrá-la.
   */
  const selo = icone(condition.stat === 'mana' ? 'mana' : 'vida', condition.stat === 'mana' ? 'mana' : 'vida');
  row.append(selo);
  row.append(
    select({ hp: 'Vida', mana: 'Mana' }, condition.stat, (value) => {
      condition.stat = value;
      renderEditor();
    })
  );
  row.append(
    select({ lte: 'menor ou igual a', gte: 'maior ou igual a' }, condition.op, (value) => {
      condition.op = value;
    })
  );

  const minus = el('button', 'step', '−');
  const value = document.createElement('input');
  value.type = 'number';
  value.value = condition.value;
  value.min = '0';
  value.oninput = () => (condition.value = Number(value.value) || 0);
  const plus = el('button', 'step', '+');
  minus.onclick = () => {
    condition.value = Math.max(0, condition.value - 5);
    value.value = condition.value;
  };
  plus.onclick = () => {
    condition.value += 5;
    value.value = condition.value;
  };

  const percent = el('label', 'switch');
  const percentInput = document.createElement('input');
  percentInput.type = 'checkbox';
  percentInput.checked = condition.percent;
  percentInput.onchange = () => (condition.percent = percentInput.checked);
  percent.append(percentInput, document.createTextNode('%'));

  const drop = el('button', 'danger step', '✕');
  drop.onclick = () => {
    lista.splice(index, 1);
    renderEditor();
  };

  row.append(minus, value, plus, percent, drop);
  return row;
}
