// Tooltip de item: nome, o que ele faz e os atributos, como no client.
// O level e o premium que os pergaminhos de acesso pedem. Ver
// `packages/shared/src/portas-de-acesso.mjs`.
import { ehTelefone } from './perfil.mjs';
import { portaDoItemDeAcesso } from '/packages/shared/src/portas-de-acesso.mjs';
import { itemCanvas, outfitCanvas, drawItem, drawEffect, drawMissile, effectDuration } from './sprites.mjs';
import { balaoPoe } from './itens-poe-balao.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const SLOT_NAMES = {
  head: 'elmo', neck: 'colar', body: 'armadura', legs: 'pernas', feet: 'botas',
  ring: 'anel', weapon: 'mão direita', shield: 'mão esquerda', ammo: 'munição', backpack: 'mochila', gloves: 'luvas',
};

const SKILL_NAMES = {
  // Tudo que é corpo a corpo (espada, machado, clava, punho) é UMA perícia, e o nome dela é "Skill Melee".
  melee: 'Skill Melee', fist: 'Skill Melee', club: 'Skill Melee', sword: 'Skill Melee', axe: 'Skill Melee',
  distance: 'distância', shielding: 'escudo', magic: 'magic level',
};

const ELEMENT_NAMES = {
  physical: 'físico', fire: 'fogo', ice: 'gelo', earth: 'terra',
  energy: 'energia', death: 'morte', holy: 'sagrado', poison: 'veneno',
  drown: 'afogamento', lifedrain: 'dreno de vida', manadrain: 'dreno de mana',
};

let node = null;
// O balão aberto agora veio do DEDO (segurar parado) — e não do mouse: a ficha do item vira a compacta com X.
let abertoPeloToque = false;
let getItems = () => ({});
/*
 * O personagem e o catalogo, para o balao poder falar dos IMBUEMENTS.
 *
 * Eles nao moram no item: `character.imbuements` e' por SLOT de equipamento, e
 * o que descreve cada um (nome, elemento, forca) esta' no catalogo. Sem os
 * dois, a linha "Imbuements" do balao so' sabia dizer "vazio, vazio" — mesmo
 * numa peca com tres imbuements caros dentro.
 */
let nodeVs = null;
let getPersonagem = () => null;
let getCatalogo = () => null;
// O catálogo de AÇÕES (magias e runas, com o dano de agora): o balão da gema mostra o que a skill dela faz.
let getCatalogoDeAcoes = () => null;
export const usarCatalogoDeAcoes = (fn) => (getCatalogoDeAcoes = fn);
const NOME_DA_CATEGORIA = { ataque: 'Gema de Ataque', cura: 'Gema de Cura', reforco: 'Gema de Reforço', suporte: 'Gema de Suporte' };
const AJUDA_DA_CATEGORIA = {
  ataque: 'Dá uma skill que causa dano.',
  cura: 'Dá uma skill que cura.',
  reforco: 'Dá uma skill de reforço: buff, postura, aura, escudo, velocidade ou familiar.',
  suporte: 'Não dá skill: fortalece a gema de skill LIGADA a ela.',
};

/*
 * "7h09" / "4min" / "45s" — o tempo de uso que resta numa peça.
 *
 * Uma cópia curta da de `panels.mjs`, e não um import: `panels.mjs` importa
 * ESTE arquivo, e fechar o círculo por causa de seis linhas de formatação
 * custaria mais do que as seis linhas. A diferença é o degrau dos segundos, que
 * lá não existe — um anel com 40 segundos precisa dizer 40 segundos, e "1min"
 * seria mentira justamente no instante em que o número importa.
 */
function tempoCurto(segundos) {
  const total = Math.max(0, Math.round(Number(segundos) || 0));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  if (horas) return minutos ? `${horas}h${String(minutos).padStart(2, '0')}` : `${horas}h`;
  if (minutos) return `${minutos}min`;
  return `${total}s`;
}

/*
 * Só os DADOS do balão, sem o balão flutuante nem os ouvintes da página: para
 * quem desenha a ficha (`fichaDeItem`) no próprio layout — os Últimos drops da
 * capa do site. `initTooltip` liga tudo; esta, só o catálogo/personagem.
 */
export function usarDados(itens, personagem = null, catalogo = null) {
  getItems = () => itens ?? {};
  getPersonagem = () => personagem;
  getCatalogo = () => catalogo;
}

export function initTooltip(itemsAccessor, personagemAccessor = () => null, catalogoAccessor = () => null) {
  getItems = itemsAccessor;
  getPersonagem = personagemAccessor;
  getCatalogo = catalogoAccessor;
  /*
   * Chamar duas vezes só troca os acessores.
   *
   * O balão passou a ser ligado ANTES do portão, para a tela de criar
   * personagem também ter os balões bonitos em vez da caixinha amarela do
   * sistema. Aí a chamada que já existia — a de quando o jogo entra — virou a
   * segunda, e sem esta saída ela criaria um segundo par de nós e um segundo
   * listener em `pointerover`: dois balões desenhados um por cima do outro.
   *
   * As três linhas acima ficam de fora da guarda de propósito: é exatamente
   * para isso que a segunda chamada existe — no portão não há personagem nem
   * catálogo, e quando eles passam a existir os acessores precisam ser trocados.
   */
  if (node) return;
  node = el('div', 'tooltip');
  node.hidden = true;
  document.body.append(node);
  /*
   * O segundo balao: o que esta VESTIDO, ao lado do que o mouse esta olhando.
   *
   * Sao dois elementos e nao um so' com duas colunas porque o balao ja tem
   * largura, cor de raridade e posicionamento proprios — reaproveitar a mesma
   * folha para os dois sai de graca, e o de comparacao herda tudo isso sem uma
   * linha de CSS nova alem da faixa "EQUIPADO".
   */
  nodeVs = el('div', 'tooltip');
  nodeVs.hidden = true;
  document.body.append(nodeVs);
  if (typeof ResizeObserver === 'function') new ResizeObserver(aoMudarDeTamanho).observe(node);

  // Um listener só na página: cada elemento marca o item em data-tip.
  document.addEventListener('pointerover', (event) => {
    /*
     * Todo `title` da página vira o balão do jogo.
     *
     * São mais de trinta lugares com `title` — botões da barra, slots, o "Stop"
     * do rodapé com a lista do ciclo dentro — e o navegador desenhava todos com
     * a caixinha amarela do sistema: fonte de sistema, sem cor, sem hierarquia,
     * e aparecendo dois segundos depois do mouse parar.
     *
     * Converter é melhor que reescrever os trinta: na primeira vez que o mouse
     * passa, o texto sai do `title` e vai para `data-tip-texto`. Com o atributo
     * fora do elemento o navegador não tem mais o que desenhar, e quem sabe do
     * texto somos nós. Vale também para o `title` que é reescrito a cada quadro:
     * na volta ele está lá de novo e é recolhido de novo.
     */
    const comTitulo = event.target.closest('[title]');
    if (comTitulo) recolherTitulo(comTitulo);

    /*
     * O dedo não "passa por cima": ele só encosta. No toque o navegador manda
     * um `pointerover` a cada batida, e o balão abria em TODO toque — num
     * botão, num slot, na barra — e ficava preso na tela, porque o
     * `pointerout` que o fecharia não vem até o próximo toque em outro lugar.
     * No toque, quem abre o balão é segurar parado (ver `ligarBalaoNoToque`).
     */
    if (event.pointerType === 'touch') return;
    // O ponteiro em cima do PRÓPRIO balão (o alto, que rola e aceita o ponteiro) não o fecha:
    // ele abria debaixo do dedo/mouse, recebia o "entrou" e se fechava na hora.
    if (event.target.closest?.('.tooltip')) return;

    const holder = event.target.closest(SELETOR);
    if (!holder) return hide();
    abertoPeloToque = false;
    mostrarBalao(holder);
  });
  document.addEventListener('pointerout', (event) => {
    if (event.pointerType === 'touch') return;
    if (event.relatedTarget?.closest?.('.tooltip.rolavel')) return; // foi para o balão alto, para rolar
    if (!event.relatedTarget || !event.relatedTarget.closest?.(SELETOR)) hide();
  });
  /*
   * Rolar fecha o balão só quando a rolagem MOVE a peça de onde ele saiu (a
   * página, ou a lista onde ela está). Rolar o próprio balão (o alto, no
   * celular) não fecha — e uma rolagem alheia também não: a barra de chat do
   * celular rola sozinha a cada linha nova, e fechava o balão que a pessoa
   * estava segurando o dedo para abrir.
   */
  window.addEventListener('scroll', (event) => {
    const alvo = event.target;
    if (alvo instanceof Element) {
      if (alvo.closest('.tooltip')) return;
      const aberto = holderAberto ?? holderPosicionado;
      if (aberto && !alvo.contains(aberto)) return;
    }
    hide();
  }, true);
  // Escape fecha o balão aberto (no computador; no celular há o X).
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && node && !node.hidden) hide();
  });
  // Girar o celular / mudar o tamanho da janela: a ficha compacta volta para o meio.
  window.addEventListener('resize', () => {
    if (node && !node.hidden && node.classList.contains('tip-movel') && holderPosicionado) posicionar(holderPosicionado);
  });
  // "Mostrar todos os atributos" da comparação: Shift com o balão de item aberto.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Shift' || event.repeat || node.hidden) return;
    if (!node.querySelector('.tip-vs')) return;
    alternarTodos();
  });
  ligarBalaoNoToque();
}

function mostrarBalao(holder) {
  if (holder.dataset.tipPanel) showPanel(holder);
  else if (holder.dataset.tipAction) showAction(holder);
  else if (holder.dataset.tip) show(holder);
  else showTexto(holder);
}

/*
 * ---- O balão no TOQUE: segurar parado ----
 *
 * Um toque rápido é um clique e nada mais — nada de balão. Segurar o dedo
 * parado em cima de algo que tem balão mostra o balão ainda com o dedo
 * encostado, e ele fica na tela depois de soltar, para dar tempo de ler; o
 * próximo toque (em qualquer lugar) ou uma rolagem o fecha.
 *
 * Isto só OLHA o dedo: não cancela nada. O toque longo continua valendo como
 * botão direito ao soltar (`mobile.mjs`), e o arrasto continua sendo do
 * navegador — se o dedo andar, o balão desiste.
 */
const BALAO_NO_TOQUE_MS = 450;
const TREMOR_DO_BALAO = 12;

function ligarBalaoNoToque() {
  let espera = null;
  const desistir = () => {
    if (!espera) return;
    clearTimeout(espera.timer);
    espera = null;
  };
  document.addEventListener(
    'pointerdown',
    (evento) => {
      if (evento.pointerType !== 'touch') return;
      // O "Mostrar todos" dentro do balão aberto: alterna e o balão fica.
      if (evento.target.closest?.('.tooltip .vs-todos')) {
        evento.preventDefault();
        alternarTodos();
        return;
      }
      // Dedo DENTRO do balão (o que rola, e o compacto do celular): ele fica aberto — o X fecha.
      if (evento.target.closest?.('.tooltip.rolavel, .tooltip.tip-movel')) return;
      hide();
      desistir();
      if (!evento.isPrimary) return;
      const comTitulo = evento.target.closest?.('[title]');
      if (comTitulo) recolherTitulo(comTitulo);
      const holder = evento.target.closest?.(SELETOR);
      if (!holder) return;
      espera = {
        id: evento.pointerId,
        x: evento.clientX,
        y: evento.clientY,
        timer: setTimeout(() => {
          espera = null;
          abertoPeloToque = true;
          if (holder.isConnected) mostrarBalao(holder);
        }, BALAO_NO_TOQUE_MS),
      };
    },
    true
  );
  document.addEventListener(
    'pointermove',
    (evento) => {
      if (!espera || evento.pointerId !== espera.id) return;
      if (Math.abs(evento.clientX - espera.x) > TREMOR_DO_BALAO || Math.abs(evento.clientY - espera.y) > TREMOR_DO_BALAO) desistir();
    },
    true
  );
  for (const nome of ['pointerup', 'pointercancel']) {
    document.addEventListener(nome, (evento) => { if (espera && evento.pointerId === espera.id) desistir(); }, true);
  }
}

const SELETOR = '[data-tip], [data-tip-action], [data-tip-panel], [data-tip-texto]';

const hide = () => {
  if (node) node.hidden = true;
  if (nodeVs) nodeVs.hidden = true;
};

/** Esconde o balão aberto (a janela das guildas usa ao trocar de página). */
export function esconderBalao() {
  hide();
}

/*
 * Tira o `title` do elemento e guarda o texto num dataset.
 *
 * Enquanto o atributo existir, o balão do sistema aparece por cima do nosso —
 * e ele é o último a sumir. Não dá para "desligar" o balão do navegador de
 * outro jeito: ou o atributo está lá, ou não está.
 *
 * Campo de texto fica de fora — formulário nativo tem regra própria e ali o
 * `title` às vezes é a mensagem de validação do próprio navegador.
 */
function recolherTitulo(elemento) {
  const texto = elemento.getAttribute('title');
  if (texto == null) return;
  if (elemento.matches('input, textarea, select')) return;
  elemento.removeAttribute('title');
  if (!texto.trim()) return;
  if (elemento.dataset.tipTexto !== texto) elemento.dataset.tipTexto = texto;
}

/**
 * Marca um elemento com texto de balão, sem passar por `title`.
 *
 * A conversão automática dá conta de quem escreve o `title` uma vez. Não dá
 * conta de quem reescreve a cada quadro — o botão do rodapé, as réguas do HUD:
 * lá o atributo volta quatro vezes por segundo, e entre uma volta e outra o
 * balão do sistema tem tempo de aparecer. Nesses o texto vai direto para cá.
 */
export function tipTexto(elemento, texto) {
  // Só grava o que mudou: a interface chama isto a cada quadro do servidor com
  // o mesmo texto, e cada gravação invalida o estilo (ver so-quando-muda.mjs).
  if (elemento.hasAttribute('title')) elemento.removeAttribute('title');
  if (texto) {
    if (elemento.dataset.tipTexto !== texto) elemento.dataset.tipTexto = texto;
  } else if ('tipTexto' in elemento.dataset) delete elemento.dataset.tipTexto;
  return elemento;
}

/*
 * Balão de texto puro, na moldura do jogo.
 *
 * Quando o texto tem várias linhas, a primeira vira cabeçalho — é assim que
 * esses textos foram escritos: "Ciclo de hunt ativo:" e depois a lista. Numa
 * linha só não há hierarquia para inventar, e ele fica sendo só a frase.
 */
function showTexto(holder) {
  const texto = holder.dataset.tipTexto;
  if (!texto) return hide();

  node.innerHTML = '';
  node.className = 'tooltip painel';

  const linhas = texto.split('\n').map((linha) => linha.trim()).filter(Boolean);
  const caixa = el('div', 'tip-texto');
  if (linhas.length > 1) {
    caixa.append(el('div', 'tip-bless-head', linhas[0]));
    const corpo = el('div', 'tip-texto-linhas');
    for (const linha of linhas.slice(1)) corpo.append(el('p', null, linha));
    caixa.append(corpo);
  } else {
    caixa.append(el('p', 'tip-texto-solo', linhas[0] ?? texto));
  }

  node.append(caixa);
  node.hidden = false;
  place(holder);
}

/** Marca um elemento para mostrar o tooltip de um item. */
/*
 * `slot` e' o slot de equipamento em que a peca esta, quando ela esta' vestida.
 *
 * So' com ele o balao consegue dizer o que ha' de imbuement dentro dela: os
 * imbuements sao guardados por slot, e nao no item. Sem slot (a peca na
 * mochila, na loja, no bestiario) o balao segue como sempre foi.
 */
/*
 * `peca` é a entrada de mochila (ou o anúncio do mercado) que está debaixo do
 * mouse — não só o id.
 *
 * Desde que tier e imbuement passaram a morar na peça, o balão não pode mais
 * responder pelo ID: com duas espadas iguais, uma tier 7 e outra limpa, os dois
 * balões diriam a mesma coisa. Vai no elemento e não no `dataset` porque é um
 * objeto, e `dataset` só guarda texto.
 */
export function tipFor(element, id, extra, slot = null, peca = null) {
  element.dataset.tip = id;
  if (extra) element.dataset.tipExtra = extra;
  if (slot) element.dataset.tipSlot = slot;
  element.__peca = peca ?? null;
  return element;
}

/*
 * Faixa de raridade.
 *
 * Quem calcula é o servidor, pela facilidade de conseguir o item: a melhor
 * chance de drop entre todos os monstros, com o level mínimo de reserva para o
 * que não cai de ninguém. Aqui só traduzimos o nome em classe de CSS. As cores
 * são as nossas: cinza para o comum, o teal do tema para o incomum, azul para o
 * raro, violeta para o épico, o cobre do tema para o lendário e o vermelho das
 * peças Draevor para o mítico.
 */
const TIER_KEYS = {
  comum: 'comum',
  incomum: 'incomum',
  raro: 'raro',
  'épico': 'epico',
  'lendário': 'lendario',
  'mítico': 'mitico',
};

const tierOf = (meta) => {
  const name = meta.rarity && TIER_KEYS[meta.rarity] ? meta.rarity : 'comum';
  return { name, key: TIER_KEYS[name] };
};

/*
 * A classe da raridade, para quem desenha item FORA do balão.
 *
 * As cores moram numa variável (`--tier`) que a classe define, e não numa regra
 * do `.tooltip` — de propósito, para o miolo poder ser desenhado na Cyclopedia
 * também. O menu do botão direito é o terceiro lugar: o nome dele saía sempre
 * no verde do tema, então o mesmo item era dourado no balão e verde no menu, e
 * a cor deixava de significar raridade em qualquer um dos dois.
 *
 * Recebe a ficha (`state.items[id]`) e devolve a classe; sem ficha, o comum.
 */
/** O efeito da peça ({tipo, nome, texto}): pronto nela, ou montado com o catálogo. */
function textoDoEfeitoDaPeca(peca) {
  const e = peca?.efeito;
  if (!e) return null;
  if (e.texto) return e;
  const ficha = getCatalogo()?.efeitosDeItem?.[e.tipo]?.[e.id];
  if (!ficha) return { tipo: e.tipo, nome: e.id, texto: '' };
  return { tipo: e.tipo, nome: ficha.nome, texto: String(ficha.texto ?? '').replace(/\{(\w+)\}/g, (_, k) => String(ficha[k] ?? '')) };
}

/*
 * A raridade de uma peça. Equipável (que não empilha): SÓ a do drop
 * (`peca.raridade`); sem ela — kit inicial, loja, peça antiga — é comum. O
 * dono: "dos itens equipáveis tire a raridade dos itens, o que define é o
 * drop". Comida, material e o resto seguem o catálogo. Igual a
 * `raridadeDaPeca`, em systems/itens/item.mjs.
 */
export const ehEquipavel = (meta) => !!meta?.slot && !meta.stackable;
export const raridadeDaPeca = (meta, peca = null) => peca?.raridade ?? (ehEquipavel(meta) ? 'comum' : meta?.rarity ?? 'comum');

export const classeDaRaridade = (meta, peca = null) => `tier-${tierOf({ rarity: raridadeDaPeca(meta, peca) }).key}`;

/*
 * ---- A cor da estrela diz o quanto o afixo é FORTE ----
 *
 * Quantas estrelas e quão boas são duas perguntas diferentes, e a cor respondia
 * a primeira duas vezes: ela saía da contagem, então ★★ era sempre roxo. Não
 * contava nada que os pontinhos já não contassem — um canal inteiro
 * desperdiçado, enquanto a informação que faltava (a peça saiu boa?) não
 * aparecia sem passar o mouse.
 *
 * Agora a contagem fica nas estrelas e a força fica na cor:
 *
 *     quantas ★  → quantos afixos   (bate com as linhas do balão)
 *     a COR      → quão bom o melhor deles saiu
 *
 * ---- Por que não é o tier ----
 *
 * O tier é uma faixa grossa. `death_res` T2 vai de 3% a 5%: um 5% é o topo da
 * faixa, quase uma peça de T3, e um 3% raspa o chão — e os dois sairiam roxos
 * iguais. O tier diz em que gaveta a peça caiu, não o quanto ela é boa dentro
 * dela, e é justamente a segunda coisa que a cor existe para contar.
 *
 * Então a conta é a POSIÇÃO do valor rolado na régua inteira daquele afixo, do
 * menor T1 ao maior T3, cortada em três:
 *
 *     death_res vai de 1% a 8%  →  até 3,3% azul · até 5,7% roxo · acima disso dourado
 *     capacity vai de 10 a 70   →  até 30 azul   · até 50 roxo   · acima disso dourado
 *
 * O efeito colateral é bom: dourado deixa de ser "é T3" e passa a ser "é T3 dos
 * bons", que é uma notícia bem mais rara e bem mais interessante. Um T3 na
 * beirada de baixo continua roxo, e é honesto — ele vale quase o que vale um T2
 * cheio.
 *
 * A régua começa no `min` do afixo, e não no zero: valor abaixo do `min` não
 * existe, então começar no zero jogaria fora um pedaço da escala de cor sem
 * nenhuma peça para pintar nele.
 *
 * ---- Uma estrela POR AFIXO, cada uma com a cor dela ----
 *
 * Não existe uma cor da peça: existe a cor de cada afixo. Uma peça de três
 * afixos desenha ★★★ onde a primeira pode ser azul, a segunda roxa e a terceira
 * dourada — porque é isso que ela é, três rolagens independentes, cada uma com
 * a sorte dela.
 *
 * Pintar as três da mesma cor (a do melhor) jogava fora duas leituras: um ★★★
 * com um afixo ótimo e dois banais ficava idêntico a um ★★★ com três ótimos, e
 * a diferença entre essas duas peças é enorme.
 *
 * Elas saem ordenadas da melhor para a pior, e as linhas do balão saem na mesma
 * ordem: assim a primeira estrela é a primeira linha, e a cor no canto do ícone
 * responde de relance a pergunta que importa ("tem alguma boa?") sem precisar
 * abrir nada.
 */
export function estrelasDosAfixos(af) {
  const fichas = getCatalogo()?.afixos ?? null;
  const postos = (Array.isArray(af) ? af : []).map((posto) => {
    const ficha = fichas?.[posto?.id];
    const valor = Number(posto?.value);
    let fracao;
    if (ficha && Number.isFinite(valor) && ficha.max > ficha.min) {
      fracao = (valor - ficha.min) / (ficha.max - ficha.min);
    } else {
      /*
       * Sem a régua (catálogo ainda não chegou, ou afixo que não existe mais),
       * cai no tier. É mais grosso, mas erra na direção certa: um afixo bom
       * continua parecendo bom, em vez de a estrela sumir ou ficar sempre azul.
       */
      fracao = ((Number(posto?.tier) || 1) - 1) / 2;
    }
    /*
     * ---- E a QUARTA estrela, acima do topo ----
     *
     * O teto de cima saiu daqui pelo mesmo motivo que saiu do servidor (ver
     * `fracaoDoAfixo`, em afixos.mjs): a essência vermelha vale 130% da régua,
     * e presa em 1 ela chegaria à tela pintada de dourado — igual às três
     * douradas que foram gastas para fazê-la.
     *
     * `q4` é o degrau que só a fusão fabrica. Nenhum drop, nenhum rerroll e
     * nenhuma transferência passam de `q3`, então a estrela vermelha significa
     * exatamente uma coisa, e não é preciso ler número nenhum para saber qual.
     */
    fracao = Math.max(0, fracao);
    /*
     * ---- Com o sistema de itens, a cor é a do NÍVEL do atributo ----
     * N1–N2 azul, N3–N4 roxa, N5 dourada; acima do teto do N5 (a essência
     * vermelha da fusão) vermelha. Peça sem `nivel` (catálogo velho) cai na
     * régua, como antes.
     */
    const nivel = Number(posto?.nivel) || null;
    const q = fracao > 1 ? 4 : nivel ? (nivel >= 5 ? 3 : nivel >= 3 ? 2 : 1) : fracao >= 2 / 3 ? 3 : fracao >= 1 / 3 ? 2 : 1;
    // `n`: a cor de CADA nível (N1 cinza, N2 verde, N3 azul, N4 roxa, N5 dourada;
    // 6 = acima do teto, a essência vermelha). `q` fica para os filtros de venda
    // e a cor da célula, que contam em três degraus.
    const n = q === 4 ? 6 : nivel ?? (q === 3 ? 5 : q === 2 ? 3 : 1);
    return { ...posto, fracao: nivel && fracao <= 1 ? (nivel - 1) / 4 + fracao / 100 : fracao, q, n };
  });
  return postos.sort((a, b) => b.fracao - a.fracao);
}

/** O degrau do MELHOR afixo da peça — é o que pinta a célula inteira. */
/** A classe de uma estrela: o degrau (`q`) e a cor do nível (`n`). */
export const classeDaEstrela = (posto) => `estrela q${posto.q}${posto.n ? ` n${posto.n}` : ''}`;

export const forcaDosAfixos = (af) => estrelasDosAfixos(af)[0]?.q ?? 1;

/*
 * As estrelas montadas, cada `<b>` com a cor do afixo que ela representa.
 *
 * ---- Por que cada estrela leva a classe `estrela` ----
 *
 * Ela não é decoração: é o que dá à regra de cor a especificidade de DUAS
 * classes. Sem isso o seletor era `.item-estrelas b`, uma classe e um elemento
 * — e empatava com qualquer `.alguma-coisa b` do resto da folha. Em empate
 * ganha quem vem depois no arquivo, o que faz a cor da estrela depender da
 * ORDEM das regras.
 *
 * Isso já mordeu três vezes: `.cell b` (o número da pilha) empilhou as três
 * estrelas num canto; o cabeçalho do menu as pôs em coluna; e `.tip-id b`, que
 * pinta o nome do item na cor da RARIDADE, pintava as três de uma cor só — a
 * peça inteira saía teal ou dourada, escondendo exatamente o que a cor existe
 * para contar.
 *
 * `<b>` é um elemento que meia dúzia de telas estilizam por descendência.
 * Disputar com elas uma a uma é um jogo que se perde na próxima regra escrita;
 * subir um degrau de especificidade encerra a disputa.
 */
export function seloDeEstrelas(classeBase, estrelas) {
  const selo = el('i', `${classeBase} q${estrelas[0]?.q ?? 1}`);
  for (const estrela of estrelas) selo.append(el('b', classeDaEstrela(estrela), '★'));
  return selo;
}

/*
 * ---- UM ITEM DENTRO DE UMA LINHA DE TEXTO ----
 *
 * O gesto do client dele: escrever "vendo", segurar shift e clicar na peça, e a
 * peça entra na frase com a cor da raridade e com o balão inteiro no mouse —
 * quem lê descobre o que é e o que faz sem perguntar.
 *
 * A linha de chat viaja como TEXTO, do começo ao fim: o servidor recebe uma
 * string, guarda uma string e reenvia uma string. Então a referência é uma
 * marca dentro do próprio texto — `[[item:3264]]` —, e não um campo à parte.
 * Isso não é economia: é o que faz a mesma frase funcionar no Global, no
 * privado e no aviso automático do saco de recompensa, sem que nenhum dos três
 * caminhos precise aprender o que é um item.
 *
 * ---- Por que a marca é numérica e curta ----
 *
 * Só dígitos, no máximo sete, e nada mais. Uma marca que aceitasse texto livre
 * seria uma porta para o jogador escrever qualquer coisa e ela sair desenhada
 * na tela dos outros; assim, o pior que alguém consegue mandar é um id que não
 * existe — e aí a marca fica literal na tela, que é o comportamento certo.
 *
 * O DESENHO nunca vem do texto. O nome é procurado no catálogo do cliente pelo
 * id, e o nó é montado com `textContent`; nada aqui toca `innerHTML`. Uma
 * linha de chat é texto de outra pessoa, e texto de outra pessoa não vira
 * marcação nunca.
 */
/*
 * ---- E o TIER viaja junto ----
 *
 * `[[item:3264]]` é a peça limpa; `[[item:3264:7]]` é a mesma peça no tier 7.
 * O tier tinha de entrar na marca, e não ser procurado depois pelo id, porque
 * ele não é do ITEM: é daquela peça. Duas espadas iguais na mesma mochila, uma
 * tier 7 e outra limpa, são o mesmo id — quem carregasse só o id mostraria as
 * duas iguais, e é justamente o tier que faz uma valer dez vezes a outra.
 *
 * Sem tier a marca não muda de forma, e nada a mais é escrito. Um "tier 0" ao
 * lado do nome seria ruído em cima de quase todo item do jogo.
 */
/*
 * ---- E os IMBUEMENTS também ----
 *
 * `[[item:3264]]` limpa, `[[item:3264:7]]` no tier 7, e
 * `[[item:3264:7:strike-1~34,void-2~5]]` no tier 7 com dois imbuements. Pelo
 * mesmo motivo do tier: imbuement é da PEÇA, e uma espada com dois imbuements
 * de 30h não é a mesma coisa que a espada limpa do mesmo id — quem anuncia uma
 * no chat está anunciando outra coisa.
 *
 * ---- E cada imbuement vai com o NOME, não só contado ----
 *
 * A primeira versão levava só a quantidade e as horas do maior ("2 de 34h"). Dá
 * para desenhar o selo com isso, e não dá para responder a pergunta que o mouse
 * faz: QUAIS são. O balão do inventário já sabe escrever "strike 19h, vazio,
 * vazio" — ele só precisa da lista, e é ela que passa a viajar.
 *
 * O id é o do catálogo (`strike-1`), e as horas são inteiras: "34h" é o que
 * decide uma compra, e "34,27h" é ruído numa linha de conversa.
 */
/*
 * ---- E os AFIXOS, pelo mesmo motivo dos outros dois ----
 *
 * `[[item:3264:0::crit_dmg~3~14,life_leech~2~1.6]]` é a peça com dois afixos.
 * Quarto campo, e o terceiro pode vir vazio: uma peça só com estrela não tem
 * tier nem imbuement, e as posições não podem escorregar.
 *
 * Cada afixo vai como `id~tier~valor`. O VALOR precisa viajar, e não só o
 * nome: é ele que decide a cor da estrela e é a única coisa que separa uma
 * spear ★ boa de uma ★ ruim. Anunciar "tem life leech" sem dizer quanto é
 * anunciar metade da peça.
 *
 * Nada disto é confiado. Do outro lado, cada afixo só entra na tela se o id
 * existir no catálogo do servidor, e o valor é GRAMPEADO na faixa daquele
 * afixo — senão bastaria escrever `crit_dmg~3~9999` na caixa do chat para
 * exibir uma peça que não existe. Ver `afixosDaMarca`.
 */
/*
 * ---- E o SLOT da essência, o quinto campo ----
 *
 * A essência é o único item do jogo cujo NOME não está no catálogo: o id é um
 * só, e o que a distingue — de que slot o afixo saiu, e se ela é a vermelha da
 * fusão — mora na instância (ver `nomeDaEssencia`). No chat ela saía como
 * "essência de afixo" para todo mundo, inclusive para a vermelha.
 *
 * A parte VERMELHA a marca já sabia responder sozinha: o afixo viaja com o
 * valor, e 130% da régua é uma coisa que só a fusão fabrica. O SLOT não — e
 * "essência vermelha" sem dizer de quê é meia frase numa venda.
 *
 * Quinto campo, e só ele é letras puras: `weapon`, `boots`, `head`. Os quatro
 * anteriores podem vir vazios, como já podiam.
 */
/* Numa linha só: o `test-marca-item` lê esta linha do próprio arquivo. */
const MARCA_DE_ITEM = /\[\[item:(\d{1,7})(?::(\d{1,2}))?(?::([a-z0-9~,-]{0,90}))?(?::([a-z0-9_~,.-]{1,160}))?(?::([a-z]{1,12}))?\]\]/g;

/** A marca que representa esta peça numa frase — com o tier, quando ela tem. */
export const marcaDeItem = (id, tier = 0, imbu = null, af = null, afixoDe = null, raridade = null) => {
  const grau = Math.floor(Number(tier) || 0);
  const vivos = (imbu ?? []).filter((x) => (x?.left ?? 0) > 0 && x?.id);
  const postos = (Array.isArray(af) ? af : []).filter((p) => p?.id && Number.isFinite(Number(p.value)));
  const partes = [`item:${Number(id) || 0}`];
  /*
   * O tier é a segunda parte e vem antes dos imbuements, então uma peça só com
   * imbuement precisa de um `0` no lugar dele — sem isso as posições
   * escorregariam e o id do imbuement cairia no campo do tier.
   */
  if (grau > 0 || vivos.length || postos.length) partes.push(String(grau));
  if (vivos.length || postos.length) {
    partes.push(
      vivos
        // Três encaixes é o teto de uma peça; o corte é contra uma linha de
        // chat gigante, não contra um caso real.
        .slice(0, 3)
        .map((x) => `${String(x.id).toLowerCase().replace(/[^a-z0-9-]/g, '')}~${Math.round(x.left / 3_600_000)}`)
        .join(',')
    );
  }
  if (postos.length) {
    partes.push(
      postos
        // Seis é o teto de atributos de uma peça (a Mítica, no sistema de itens).
        .slice(0, 6)
        .map((p) => {
          const id = String(p.id).toLowerCase().replace(/[^a-z0-9_]/g, '');
          // O "Nível do Atributo" (1–5); peça antiga manda o tier (1–3) no mesmo lugar.
          const grauDoAfixo = Math.min(5, Math.max(1, Math.floor(Number(p.nivel ?? p.tier) || 1)));
          // Uma casa decimal é o que o jogo escreve; mais do que isso é ruído
          // e engorda a marca sem mudar nada do que se lê.
          const valor = Math.round(Number(p.value) * 10) / 10;
          return `${id}~${grauDoAfixo}~${valor}`;
        })
        .join(',')
    );
  }
  /*
   * O slot só entra quando há afixo — ele existe para nomear a ESSÊNCIA, e uma
   * essência sem afixo não existe. Assim nenhuma peça normal engorda a marca.
   */
  /*
   * Peça normal (não essência) usa o mesmo campo para a RARIDADE do drop, sem
   * acento (a marca só aceita a–z): equipável sem ela sairia comum no chat.
   */
  const slot = String(afixoDe ?? SEM_ACENTO[raridade] ?? '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
  if (slot && postos.length) partes.push(slot);
  return `[[${partes.join(':')}]]`;
};
const SEM_ACENTO = { comum: 'comum', incomum: 'incomum', raro: 'raro', 'épico': 'epico', 'lendário': 'lendario', 'mítico': 'mitico' };
const COM_ACENTO = Object.fromEntries(Object.entries(SEM_ACENTO).map(([k, v]) => [v, k]));

/*
 * Os afixos de uma marca, de volta ao formato da mochila — e SÓ os legítimos.
 *
 * Uma linha de chat é texto de outra pessoa. Um id que o catálogo não conhece
 * é descartado (em vez de sair cru, como no balão da própria mochila, onde o
 * dado veio do servidor); e o valor é grampeado na faixa real do afixo, para
 * `crit_dmg~3~9999` virar o máximo verdadeiro em vez de uma peça inventada.
 */
function afixosDaMarca(bruto) {
  const fichas = getCatalogo()?.afixos;
  if (!bruto || !fichas) return [];
  const vistos = new Set();
  const saida = [];
  for (const pedaco of String(bruto).split(',')) {
    const [id, tier, valor] = pedaco.split('~');
    const ficha = fichas[id];
    const numero = Number(valor);
    if (!ficha || !Number.isFinite(numero) || vistos.has(id)) continue;
    vistos.add(id);
    saida.push({
      id,
      nivel: Math.min(5, Math.max(1, Math.floor(Number(tier) || 1))),
      /*
       * ---- O grampo fecha no TETO, e não no topo da sorte ----
       *
       * Ele existe para `crit_dmg~3~9999` não virar uma peça inventada. Preso
       * no `max`, porém, ele achatava justamente o único item do jogo que passa
       * do topo: a essência vermelha vale 130% da régua, e chegava ao chat como
       * 100% — estrela DOURADA, indistinguível das três douradas que foram
       * gastas para fazê-la. Era o que o dono via na linha.
       *
       * `teto` vem do catálogo, calculado pelo servidor a partir da mesma régua
       * (ver `catalogoDeAfixos`). A reserva no `max` é para um catálogo antigo,
       * de antes do campo existir.
       */
      value: Math.min(ficha.teto ?? ficha.max, Math.max(ficha.min, numero)),
    });
    if (saida.length >= 6) break; // o mesmo teto do `marcaDeItem`
  }
  return saida;
}

/**
 * O NOME de uma peça inteira (`{id, raridade, ilvl, base, af, efeito, tier}`)
 * como o chat escreve um item: na cor da raridade, com o tier e as estrelas, e
 * o balão completo do jogo (base, Item Level, modificadores, poder). É o que o
 * anúncio de drop raro usa — a marca `[[item:...]]` do texto não leva a base
 * sorteada nem o poder.
 */
export function nomeDaPeca(peca, nome = null) {
  const meta = getItems?.()?.[peca?.id];
  const marca = el('span', `item-no-chat ${classeDaRaridade(meta, peca)}`, titleCase(nome ?? meta?.name ?? `item ${peca?.id}`));
  if (peca?.tier > 0) marca.append(el('i', 'item-tier', `T${peca.tier}`));
  if (peca?.af?.length) marca.append(seloDeEstrelas('item-estrelas', estrelasDosAfixos(peca.af)));
  if (meta) tipFor(marca, peca.id, null, null, peca);
  return marca;
}

/**
 * Os ids das peças já escritas numa frase.
 *
 * É o que responde "esta peça já está aqui?" sem o chat precisar entender o
 * formato da marca — a forma dela mora neste arquivo, e só aqui.
 */
export function idsNoTexto(texto) {
  const achados = [];
  MARCA_DE_ITEM.lastIndex = 0;
  for (let m; (m = MARCA_DE_ITEM.exec(String(texto ?? ''))); ) achados.push(Number(m[1]));
  return achados;
}

/** Há alguma marca de item nesta frase? Para quem quer evitar o trabalho. */
export const temItemNoTexto = (texto) =>
  /\[\[item:\d{1,7}(?::\d{1,2})?(?::[a-z0-9~,-]{0,90})?(?::[a-z0-9_~,.-]{1,160})?(?::[a-z]{1,12})?\]\]/.test(String(texto ?? ''));

/**
 * A frase virada em nós: texto puro onde é texto, e o nome do item — colorido e
 * com balão — onde havia marca. Devolve um fragmento pronto para `append`.
 *
 * Id desconhecido fica como está: melhor a marca crua na tela do que sumir com
 * um pedaço da frase de alguém.
 */
export function textoComItens(texto) {
  const frase = String(texto ?? '');
  const frag = document.createDocumentFragment();
  const items = getItems?.() ?? {};
  let fim = 0;
  MARCA_DE_ITEM.lastIndex = 0;
  for (let achado; (achado = MARCA_DE_ITEM.exec(frase)); ) {
    const meta = items[achado[1]];
    if (!meta) continue;
    if (achado.index > fim) frag.append(document.createTextNode(frase.slice(fim, achado.index)));
    const tier = Math.floor(Number(achado[2]) || 0);
    /*
     * A lista de imbuements, de volta ao formato que o resto do cliente usa:
     * `{ id, left }` em milissegundos. É o mesmo formato da entrada da mochila,
     * e por isso o balão desenha a peça do chat exatamente como desenharia a da
     * mochila — sem um caminho separado para cada uma.
     */
    const imbu = (achado[3] ?? '')
      .split(',')
      .map((pedaco) => {
        const [id, horas] = pedaco.split('~');
        const restam = (Number(horas) || 0) * 3_600_000;
        /*
         * Id E horas, os dois. Sem esta exigência, `[[item:3074:strike-1]]`
         * — sem o `~20` — era aceito, e o texto entre os dois-pontos ia parar
         * dentro do balão como se fosse o nome de um imbuement. É texto que
         * outra pessoa escreveu: ele só entra na tela quando tem a forma
         * inteira que esta ponta espera. Achado pelo `test-marca-item`.
         */
        return id && restam > 0 ? { id, left: restam } : null;
      })
      .filter(Boolean);

    const af = afixosDaMarca(achado[4]);
    const afixoDe = achado[5] ?? null;

    /*
     * ---- A ESSÊNCIA não se chama pelo catálogo ----
     *
     * Todas as essências do jogo dividem um id, e o catálogo tem uma linha só
     * para ele: "essência de afixo", raridade comum. Era isso que saía no chat
     * — inclusive para a VERMELHA, que custa trezentos milhões e é a única
     * coisa no jogo que passa do topo da régua. Na linha ela era idêntica a uma
     * essência qualquer, com letra branca e estrela dourada.
     *
     * O nome sai de `nomeDaEssencia`, o mesmo que a mochila, a bancada e o
     * mercado usam; a cor sai de `ehVermelha`, a mesma conta do servidor. As
     * duas respondem pelo AFIXO, que viaja na marca — e não por uma marca
     * separada que pudesse se perder no caminho.
     */
    const essencia = ehEssencia(null, achado[1]) && af.length ? { af, afixoDe } : null;
    const nome = essencia ? nomeDaEssencia(essencia) : meta.name;
    /*
     * A vermelha é pintada de MÍTICO, que é o vermelho da régua de raridade. As
     * outras essências continuam com a cor do catálogo — elas são o que o
     * catálogo diz que são.
     */
    // Peça normal: o quinto campo é a raridade do drop (ver `marcaDeItem`).
    const doDrop = essencia ? null : { raridade: COM_ACENTO[afixoDe] ?? null };
    const cor = classeDaRaridade(essencia && ehVermelha(essencia) ? { rarity: 'mítico' } : meta, doDrop);

    const marca = el('span', `item-no-chat ${cor}`, nome);
    // Curto: numa linha de conversa "T7" diz o mesmo que "tier 7" e não empurra
    // a frase para fora da janela.
    if (tier > 0) marca.append(el('i', 'item-tier', `T${tier}`));
    /*
     * ---- A estrela GANHA selo na linha, ao contrário do imbuement ----
     *
     * O imbuement perdeu o dele porque o nome já vinha com cor de raridade e
     * selo de tier, e um terceiro enfeite comia meia linha de conversa.
     *
     * A estrela é o caso oposto, e por isso a decisão é outra: ela é a única
     * coisa que separa duas cópias do mesmo id numa venda. Sem ela, "vendo
     * spear" e "vendo spear ★★★" são a mesma frase na tela — e é justamente
     * essa diferença que a pessoa está anunciando. São três caracteres, e eles
     * carregam a cor de cada afixo junto.
     */
    if (af.length) marca.append(seloDeEstrelas('item-estrelas', estrelasDosAfixos(af)));
    /*
     * ---- O imbuement NÃO ganha selo na linha ----
     *
     * Ele teve um, e o dono mandou tirar. A razão se vê no print dele: o nome
     * do item já vem com a cor da raridade e o selo de tier, e um terceiro
     * enfeite fazia cada peça anunciada ocupar meia linha de conversa.
     *
     * Os imbuements CONTINUAM viajando na marca e continuam no balão, com nome
     * e horas — que é onde a pergunta "o que tem dentro?" é feita, com o mouse
     * já parado em cima. O que saiu foi só o desenho na linha.
     */
    /*
     * A peça vai como quinto argumento para o BALÃO também saber do tier e dos
     * imbuements: sem ela o balão responderia pelo id e desenharia a espada
     * limpa, contradizendo os selos escritos ao lado do nome.
     */
    /*
     * O balão recebe o `afixoDe` junto: sem ele a essência do chat abriria o
     * balão dizendo "sem slot de origem", enquanto a linha ao lado já diria
     * "essência vermelha · arma". Duas frases sobre a mesma peça, discordando.
     */
    const peca = tier > 0 || imbu.length || af.length ? { tier, imbu, af, afixoDe, ...(doDrop?.raridade ? { raridade: doDrop.raridade } : {}) } : null;
    tipFor(marca, Number(achado[1]), null, null, peca);
    frag.append(marca);
    fim = achado.index + achado[0].length;
  }
  if (fim < frase.length) frag.append(document.createTextNode(frase.slice(fim)));
  return frag;
}

/** Nome do tipo em português, sem o jargão do items.xml. */
const TYPE_NAMES = {
  'sword weapons': 'espada',
  'axe weapons': 'machado',
  'club weapons': 'clava',
  'distance weapons': 'arma de distância',
  'fist weapons': 'arma de punho',
  wands: 'varinha',
  rods: 'cajado',
  shields: 'escudo',
  spellbooks: 'grimório',
  helmets: 'elmo',
  armors: 'armadura',
  legs: 'perneira',
  gloves: 'luvas',
  boots: 'bota',
  rings: 'anel',
  'amulets and necklaces': 'amuleto',
  ammunition: 'munição',
  containers: 'bolsa',
  'creature products': 'despojo',
  'light sources': 'fonte de luz',
  'quest items': 'item de quest',
};

const VOCATION_NAMES = {
  knight: 'Knight', paladin: 'Paladin', druid: 'Druid', sorcerer: 'Sorcerer', monk: 'Monk',
};

/** Primeira letra de cada palavra em maiúscula, como o client mostra. */
const titleCase = (text) =>
  String(text ?? '').replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());

/**
 * Marca um elemento para mostrar o tooltip de uma ação da barra. Guardamos o
 * objeto inteiro porque magia não tem id de item para procurar depois.
 */
export function tipForAction(element, entry, icon, extra) {
  if (!entry) return element;
  element.dataset.tipAction = '1';
  element._tipAction = entry;
  element._tipIcon = icon ?? null;
  if (extra) element.dataset.tipExtra = extra;
  return element;
}

/**
 * Tooltip de conteúdo livre: quem chama monta o miolo.
 *
 * Os outros dois sabem o que desenhar porque sabem o que é um item e o que é
 * uma ação da barra. Este não sabe nada — ele só empresta a moldura, o
 * posicionamento e o mesmo listener único da página. Serve para o que é de um
 * lugar só, como a lista de blessings ativas do card.
 */
export function tipPanel(element, build) {
  if (element.dataset.tipPanel !== '1') element.dataset.tipPanel = '1';
  element._tipPanel = build;
  return element;
}

function showPanel(holder) {
  const build = holder._tipPanel;
  if (!build) return hide();
  node.innerHTML = '';
  node.className = 'tooltip painel';
  const conteudo = build();
  if (!conteudo) return hide();
  node.append(...(Array.isArray(conteudo) ? conteudo : [conteudo]));
  node.hidden = false;
  place(holder);
}

const GROUP_NAMES = {
  attack: 'ataque',
  healing: 'cura',
  support: 'suporte',
  special: 'especial',
  focus: 'foco',
};

const segundos = (ms) => `${(ms / 1000).toFixed(ms % 1000 ? 1 : 0).replace('.', ',')}s`;

/**
 * Tooltip de magia, runa ou poção. Mesmo desenho do tooltip de item — faixa
 * colorida, nome, sprite emoldurado, ganhos em teal, regras embaixo — mas o
 * que ele responde é outro: quanto bate, quanto custa e por que não sai.
 */
function showAction(holder) {
  // Pode ser uma função: o balão pega a entrada do catálogo de AGORA (o dano e a gema mudam sem a barra se refazer).
  const entry = typeof holder._tipAction === 'function' ? holder._tipAction() : holder._tipAction;
  if (!entry) return hide();
  const ficha = fichaDeAcao(entry, holder._tipIcon, holder.dataset.tipExtra);
  node.innerHTML = '';
  node.className = `tooltip ${ficha.classe}`;
  node.append(...ficha.partes);
  node.hidden = false;
  place(holder);
}

/**
 * O MIOLO do balão de magia, runa ou poção, como uma lista de nós.
 *
 * Ele era o corpo do `showAction` e escrevia direto no balão. Virou função
 * porque a Cyclopedia mostra exatamente esta ficha — e antes ela tinha uma
 * versão própria, mais pobre, com os mesmos dados em texto corrido. Agora é o
 * mesmo desenho nos dois lugares, e mexer num muda o outro.
 */
/**
 * O bloco da GEMA de uma skill (servidor: `catalogo` → `gema`): nível e barra de XP,
 * raridade, qualidade, o bônus somado, as supports ligadas e a conjuração. Um só
 * desenho para o balão do slot da barra e para a tela "Configurar ação".
 */
export function blocoDaGemaDaSkill(entry) {
  const g = entry?.gema;
  if (!g) return null;
  const bloco = el('div', 'tip-gema');
  bloco.append(el('div', 'tip-gema-tipo', 'Gema de Skill'));
  const xp = g.xpProximo ? ` · XP ${Math.floor(g.xp).toLocaleString('pt-BR')} / ${g.xpProximo.toLocaleString('pt-BR')}` : ' · nível máximo';
  bloco.append(el('div', null, `Nível ${g.nivel}${xp}`));
  if (g.xpProximo) {
    const barra = el('div', 'tip-gema-xp');
    const cheio = el('i');
    cheio.style.width = `${Math.min(100, (100 * g.xp) / g.xpProximo)}%`;
    barra.append(cheio);
    bloco.append(barra);
  }
  const qualidade = g.efeito?.qualidade ?? 0;
  bloco.append(el('div', null, `${g.raridade ?? 'comum'}${g.multiplicador && g.multiplicador !== 1 ? ` (bônus ×${g.multiplicador.toLocaleString('pt-BR')})` : ''} · qualidade ${qualidade}%`));
  const e = g.efeito ?? {};
  const partes = [];
  if (e.danoPct) partes.push(`+${Math.round(e.danoPct * 10) / 10}% dano`);
  if (e.curaPct) partes.push(`+${Math.round(e.curaPct * 10) / 10}% cura`);
  if (e.custoPct) partes.push(`${Math.round(e.custoPct)}% mana`);
  if (e.recargaPct) partes.push(`${Math.round(e.recargaPct)}% recarga`);
  if (e.critChance) partes.push(`+${e.critChance}% crítico`);
  if (e.alvosExtras) partes.push(`+${e.alvosExtras} projéteis`);
  if (e.perfurar) partes.push(`perfura ${e.perfurar}`);
  if (e.bifurcar) partes.push(`divide em ${e.bifurcar}`);
  if (e.encadear) partes.push(`salta ${e.encadear}×`);
  if (e.retornar) partes.push('volta');
  // A explosão: em CADA impacto, um quadrado 3×3 em volta dele (o lado vem do servidor, `explosaoLado`).
  if (e.explosaoPct || e.segundaExplosaoPct) {
    const lado = e.explosaoLado ?? 3;
    partes.push(`explode ${lado}×${lado} a cada impacto (${Math.round(e.explosaoPct || e.segundaExplosaoPct)}%)`);
  }
  if (e.areaExtra) partes.push(`área ${e.areaExtra > 0 ? '+' : ''}${Math.round(e.areaExtra)}`);
  if (e.igniteChance) partes.push('queima');
  if (e.congelarChance) partes.push('congela');
  if (e.lentidaoPct) partes.push('lentidão');
  if (e.atordoarChance) partes.push('atordoa');
  if (e.leechVidaPct || e.leechManaPct) partes.push('leech');
  if (e.custoEmVida) partes.push('custo em vida');
  if (e.duracaoPct) partes.push(`+${Math.round(e.duracaoPct)}% duração`);
  if (partes.length) bloco.append(el('div', 'tip-gema-efeito', partes.join(' · ')));
  bloco.append(el('div', 'tip-gema-tags', g.supports?.length ? `Suportes ligados: ${g.supports.map((s) => `${s.nomePt ?? s.nome} ${s.nivel}`).join(', ')}` : 'Sem suporte ligado'));
  if (g.castTime) bloco.append(el('div', null, `Conjuração: ${(g.castTime / 1000).toLocaleString('pt-BR')} s`));
  return bloco;
}

/**
 * O bloco do BUFF (servidor: `catalogo` → `reforco`, de `Reforcos.descrever`): nome do tipo, o que faz com os números reais desta gema,
 * a duração, quem é afetado e as condições — o mesmo desenho para o balão da barra, a tela "Configurar ação" e o balão da gema.
 * Custo e recarga vêm da própria entrada (`mana`, `cooldown`).
 */
export function blocoDoReforco(entry) {
  const r = entry?.reforco;
  if (!r) return null;
  const bloco = el('div', 'tip-buff-gema');
  bloco.append(el('div', 'tip-buff-gema-tipo', `Buff · ${r.tipoNome}`));
  const efeitos = el('ul', 'tip-buff-gema-efeitos');
  for (const l of r.linhas) efeitos.append(el('li', null, l));
  if (r.linhas.length) bloco.append(efeitos);
  const linhas = el('div', 'tip-buff-gema-dados');
  const dado = (rotulo, valor) => { if (valor) { const row = el('div'); row.append(el('span', null, rotulo), el('b', null, valor)); linhas.append(row); } };
  dado('Duração', r.duracao);
  dado('Afeta', r.afeta);
  if (entry.mana && entry.kind !== 'item') dado('Custo', `${entry.mana} de mana`);
  if (entry.cooldown) dado('Recarga', segundos(entry.cooldown));
  bloco.append(linhas);
  for (const c of r.condicoes ?? []) bloco.append(el('div', 'tip-buff-gema-cond', c));
  return bloco;
}

export function fichaDeAcao(entry, icone = null, extra = null) {
  const partes = [];
  const node = { append: (...n) => partes.push(...n) };

  // A cor da faixa conta o que a ação faz: cura em teal, ataque em cobre,
  // suporte em violeta. Bloqueada fica vermelha.
  const tier = entry.blocked ? 'bloqueada' : entry.heals ? 'cura' : entry.kind === 'item' ? 'item' : entry.group === 'attack' ? 'ataque' : 'suporte';
  const classe = `acao-${tier}`;

  const head = el('div', 'tip-head');
  const identidade = el('div', 'tip-id');
  identidade.append(el('b', null, entry.name));
  const linha = [
    entry.kind === 'item' ? 'poção' : entry.kind === 'rune' ? 'runa' : 'magia',
    entry.group ? GROUP_NAMES[entry.group] ?? entry.group : null,
    entry.element && entry.element !== 'healing' ? ELEMENT_NAMES[entry.element] ?? entry.element : null,
  ]
    .filter(Boolean)
    .join(' · ');
  identidade.append(el('em', null, linha));
  if (entry.words) identidade.append(el('i', 'tip-words', entry.words));
  head.append(identidade);

  const arte = el('div', 'tip-art');
  // Magia não tem item: o desenho vem da folha de ícones, recortado pela barra.
  const desenho = icone?.();
  if (desenho) arte.append(desenho);
  else if (entry.itemId) arte.append(itemCanvas(entry.itemId, 40));
  head.append(arte);
  node.append(head);

  // ---- o que ela faz ----
  const stats = el('div', 'tip-stats');
  const add = (text, className) => text && stats.append(el('div', className, text));

  if (entry.damage) {
    const min = Math.abs(entry.damage.min);
    const max = Math.abs(entry.damage.max);
    const cor = entry.heals ? 'heal' : entry.element ? `el-${entry.element}` : 'atk';
    add(`${entry.heals ? 'Cura' : 'Dano'} de ${Math.round(min)} a ${Math.round(max)}`, cor);
  }
  if (entry.heal) add(`Cura de ${entry.heal[0]} a ${entry.heal[1]}`, 'heal');
  if (entry.mana && entry.kind === 'item') add(`Devolve ${entry.mana[0]} a ${entry.mana[1]} de mana`);
  if (entry.overTime) {
    add(
      `${entry.overTime.damage} por ${entry.overTime.rounds} rodadas, a cada ${segundos(entry.overTime.interval)}`,
      entry.element ? `el-${entry.element}` : 'atk'
    );
  }
  if (entry.area) add('Pega uma área', 'area');
  if (entry.range) add(`Alcance de ${entry.range} sqm`, 'plain');
  if (stats.children.length) node.append(stats);

  // O BUFF diz o que faz, por quanto tempo e em quem (o desenho de onde pega não tem o que mostrar aqui).
  const doBuff = blocoDoReforco(entry);
  if (doBuff) node.append(doBuff);

  // E o desenho de ONDE ela pega, que e' o que aquelas duas linhas nao dizem.
  const forma = previaDaMagia(entry);
  if (forma) node.append(forma);

  // ---- o que ela cobra ----
  const regras = el('div', 'tip-rules');
  const regra = (label, value, className) => {
    if (!value) return;
    const row = el('div', className);
    row.append(el('span', null, label), el('b', null, value));
    regras.append(row);
  };
  if (entry.kind !== 'item' && entry.mana) regra('Mana', String(entry.mana));
  if (entry.cost) regra('Custo', `${entry.cost.toLocaleString('pt-BR')}g`);
  if (entry.cooldown) regra('Recarga', segundos(entry.cooldown));
  // Só vale dizer quando o relógio do grupo é maior que o da própria magia.
  if (entry.groupCooldown && entry.groupCooldown !== entry.cooldown) {
    regra(`Grupo de ${GROUP_NAMES[entry.group] ?? entry.group}`, segundos(entry.groupCooldown), 'imbue');
  }
  // Skill de gema não pede level nem magic level (qualquer um usa qualquer gema).
  if (entry.level && entry.levelDaMagia == null) regra('Level mínimo', String(entry.level));
  if (entry.magicLevel && entry.levelDaMagia == null) regra('Magic level', String(entry.magicLevel));
  // A classe recomendada (não é trava: qualquer classe usa — modelo Path of Exile) e as tags da skill.
  if (entry.vocations?.length) regra('Classe recomendada', entry.vocations.map((v) => VOCATION_NAMES[v] ?? v).join(', '));
  if (entry.tags?.length) regra('Tags', entry.tags.join(' · '));
  // A afinidade da classe DESTE personagem nesta skill (a mesma conta do servidor: `Ficha.afinidadePara`).
  if (entry.afinidade?.pct) regra('Sua afinidade', `+${entry.afinidade.pct}% (${entry.afinidade.fontes.map((f) => `${f.especializacao} +${f.pct}%`).join(', ')})`, 'crit');
  if (regras.children.length) node.append(regras);

  // ---- a GEMA de onde a skill vem ----
  const daGema = blocoDaGemaDaSkill(entry);
  if (daGema) node.append(daGema);

  if (entry.blocked) node.append(el('div', 'tip-blocked', entry.blocked));
  if (extra) node.append(el('div', 'tip-extra', extra));

  return { classe, partes };
}

function show(holder) {
  holderAberto = holder;
  const id = Number(holder.dataset.tip);
  const slot = holder.dataset.tipSlot ?? null;
  const ficha = fichaDeItem(id, holder.dataset.tipExtra, slot, holder.__peca ?? null);
  if (!ficha) return hide();
  node.innerHTML = '';
  node.className = `tooltip ${ficha.classe}`;
  node.append(...ficha.partes);
  node.hidden = false;

  /*
   * ---- E, do lado, a peca que ele ja esta usando ----
   *
   * O balao ja dizia a diferenca em numeros ("ataque +47, defesa +21"), e isso
   * responde "vale a troca?". Nao responde "o que exatamente eu perco" — para
   * ver os imbuements, o alcance, o level e a vocacao da peca vestida o jogador
   * tinha de fechar o balao, achar o slot e passar o mouse la.
   *
   * Agora as duas fichas aparecem juntas, a vestida a esquerda com o selo, como
   * no client do dono. E' a MESMA `fichaDeItem` das duas: nada e resumido nem
   * reescrito para caber no lado.
   */
  const vestido = pecaVestidaPara(id, slot);
  if (!vestido) {
    nodeVs.hidden = true;
  } else {
    /*
     * A peça vestida INTEIRA vai como quarto argumento.
     *
     * Aqui ia só `vestido.id`, e o id é a parte da peça que menos a distingue:
     * tier, imbuement e afixo moram na ENTRADA. O lado "Equipado" saía sempre
     * limpo — a mastermind shield T2 do report aparecia sem o T2, e a
     * comparação convidava a trocar uma peça forjada por uma crua.
     */
    const outra = fichaDeItem(vestido.id, null, vestido.slot, vestido);
    if (!outra) {
      nodeVs.hidden = true;
    } else {
      nodeVs.innerHTML = '';
      nodeVs.className = `tooltip vs ${outra.classe}`;
      nodeVs.append(el('div', 'vs-selo', 'Equipado'), ...outra.partes);
      nodeVs.hidden = false;
    }
  }
  place(holder);
}

/*
 * A peca vestida no mesmo slot, quando ha' o que comparar.
 *
 * Devolve `null` quando: o item nao e' equipavel, o mouse esta justamente em
 * cima da peca vestida (`slot` preenchido), o slot esta vazio, ou o vestido e'
 * o proprio item olhado — comparar uma coisa com ela mesma nao diz nada.
 */
function pecaVestidaPara(id, slot) {
  if (slot) return null;
  const meta = getItems()[id];
  if (!meta?.slot) return null;
  const personagem = getPersonagem();
  const vestido = personagem?.equipment?.[meta.slot];
  if (!vestido || vestido.id === id) return null;
  // A entrada inteira, e não só o id: quem desenha a ficha precisa do tier, dos
  // imbuements e dos afixos, que moram nela. Ver a chamada em `show`.
  return { ...vestido, slot: meta.slot };
}

/**
 * O MIOLO do balão de item, como uma lista de nós.
 *
 * Mesma história da `fichaDeAcao`: era o corpo do `show`, escrevendo direto no
 * balão. A Cyclopedia tinha a própria versão — uma tabela de "rótulo: valor"
 * cinza, sem a faixa da raridade, sem as cores de ataque e de elemento, sem o
 * preço de NPC. Agora as duas telas mostram a mesma ficha, que é a que o
 * jogador já conhece de passar o mouse na mochila.
 *
 * Devolve `null` quando o item não existe no catálogo, e quem chama decide o
 * que fazer com isso.
 */
/*
 * A cor de um imbuement: a do que ele FAZ.
 *
 * Os que mexem em elemento (converter dano, reduzir dano) saem na cor do
 * elemento, as mesmas que o balao ja usa nas linhas de ataque. Os outros saem
 * na cor da familia deles — critico, leech, skill, velocidade —, tambem as
 * mesmas de cima. Nenhuma cor nova: a peca fica lendo como o resto do balao.
 */
function corDoImbuement(entrada) {
  const efeito = entrada?.effect ?? {};
  if (efeito.combat) return `el-${efeito.combat}`;
  if (efeito.type === 'speed') return 'speed';
  if (efeito.value === 'critical') return 'crit';
  if (efeito.value === 'lifeleech') return 'leech';
  if (efeito.value === 'manaleech') return 'mana';
  if (efeito.type === 'skill') return 'skill';
  return 'plain';
}

/** O que falta, do jeito que o jogador pensa: horas e minutos. */
export function restanteDoImbuement(ms) {
  const total = Math.max(0, Math.floor(ms / 60000));
  const horas = Math.floor(total / 60);
  const minutos = total % 60;
  if (horas) return `${horas}h${String(minutos).padStart(2, '0')}`;
  return `${minutos}min`;
}



/*
 * ---- O desenho da magia: onde ela pega ----
 *
 * "Pega uma área" e "alcance de 3 sqm" são frases para quem já jogou Tibia.
 * Para quem não jogou, elas não dizem nem o tamanho, nem o feitio, nem se a
 * magia nasce em volta de quem lança ou sai para a frente — e é justamente isso
 * que separa uma `exevo vis hur` de uma `exura`.
 *
 * O desenho responde as três de uma vez: uma gradinha com o personagem no meio
 * (o ponto claro) e as casas que a magia alcança pintadas na cor do elemento
 * dela. Ele é montado com o MESMO dado que o golpe usa — as casas vêm do
 * servidor, do `areaTiles` que decide quem leva dano.
 *
 * As formas são escritas viradas para o NORTE, que é como o servidor as guarda;
 * a legenda diz isso ("sai para a frente"), porque no jogo elas giram para o
 * lado que o personagem encara.
 *
 * Magia sem área e com alcance vira uma linha de casas até onde ela chega: é o
 * mesmo desenho respondendo "de tão longe eu acerto?".
 */

/** Quantas casas de cada lado do centro o desenho mostra, no máximo. */
const RAIO_MAXIMO_DA_PREVIA = 6;
/** O mesmo teto para o alvo único, que é desenhado deitado e cabe mais longe. */
const ALCANCE_MAXIMO_DA_PREVIA = 8;

/*
 * ---- A magia acontecendo, e nao um retangulo colorido ----
 *
 * A primeira versao pintava as casas atingidas com a cor do elemento. Respondia
 * "onde", mas nao respondia a pergunta de quem nunca jogou: "o que e isso na
 * tela?". Fogo, gelo e energia viravam o mesmo quadrado em cores diferentes.
 *
 * Aqui o desenho e o MESMO que o jogo faz no mapa: `drawEffect`, com o numero
 * de efeito que a propria magia declara no arquivo (`CONST_ME_HITBYFIRE` e
 * companhia), e o outfit do proprio jogador no meio. O que se ve na
 * previa e' exatamente o que vai aparecer na caverna.
 *
 * O laco e um `requestAnimationFrame` que se desliga sozinho quando o canvas
 * sai da pagina — o painel de escolha e' refeito a cada redesenho, e sem isso
 * cada abertura deixaria um laco vivo para sempre.
 */
const TILE_DA_PREVIA = 32;
const CICLO_DA_PREVIA = 1800;

/*
 * O chao da previa: o piso de pedra do mapa dele.
 *
 * Era um xadrez de dois cinzas — um fundo inventado, que nao existe em lugar
 * nenhum do jogo.
 *
 * Duas tentativas antes desta, e as duas valem a nota. O 351 e' o chao mais
 * comum do andar 8 da troll-cave e seria a escolha obvia, mas nao esta no
 * `item-sprites.json`: aquele arquivo tem os 4 mil itens que aparecem na
 * mochila, e chao de mapa e' desenhado pelo atlas da hunt, que o balao nao tem.
 * O 4543 esta la e se chama "gravel" — so' que e' a peca de BORDA do cascalho,
 * quase toda branca, e ladrilhada virava um gradeado de listras.
 *
 * O 7348 (`stony floor`) e' piso inteiro, cinza-terroso, e e' dos que o
 * pipeline ja extrai como cenario.
 */
const CHAO_DA_PREVIA = 7348;

/** Quanto tempo o projetil leva do conjurador ate o alvo. */
const VOO_DO_PROJETIL = 260;
/** Atraso por casa de distancia: e o que faz a forma SAIR do conjurador. */
const ATRASO_POR_CASA = 90;

/*
 * ---- O bicho de exemplo ----
 *
 * O dono pediu uma criatura na previa das magias e runas de ataque, e o motivo
 * fica claro assim que se ve o desenho sem ela: efeito caindo em casa vazia
 * mostra a FORMA da magia e esconde a unica coisa que interessa, que e' onde o
 * bicho precisa estar para levar o golpe.
 *
 * O troll (look 15) e' o alvo: e' a primeira criatura que qualquer personagem
 * enfrenta neste servidor, e o desenho dela cabe num tile sem addon nem cor.
 */
const BICHO_DE_EXEMPLO = { look: 15, colors: { type: 15, head: 0, body: 0, legs: 0, feet: 0, addons: 0, mount: 0 } };

/*
 * ---- Onde caem os bichos de uma magia em CADEIA ----
 *
 * 'exevo fur frigo' e as outras tres nao tem forma nem alvo unico: elas pegam
 * um bicho, saltam para o proximo a ate cinco casas dele, e assim por diante.
 * Desenhadas pelo 'range' — que e' o que a previa fazia — elas viravam UM
 * troll a sete casas, exatamente o mesmo desenho de uma 'exori con'. O que
 * separa as duas, que e' o salto, era a unica coisa que nao aparecia.
 *
 * Aqui a fila e' montada em ziguezague para o leste: cada pulo anda duas ou
 * tres casas e troca de lado, que e' o feitio de uma cadeia sem parecer uma
 * linha reta. Nao e' uma simulacao do algoritmo do servidor — e nem podia ser,
 * porque ele depende de onde os bichos estao —, e' o desenho do que ela faz.
 *
 * Quatro saltos no maximo: a 'exevo fur frigo' encadeia sete, e sete trolls em
 * fila viram uma tira de vinte casas de largura. Dentro do quadro cada casa
 * ficaria com quinze pixels, e ai nao se ve nem o troll nem o gelo. A legenda
 * embaixo diz o numero de verdade.
 */
const SALTOS_DESENHADOS = 4;
const PASSOS_DA_CADEIA = [
  { x: 2, y: 0 },
  { x: 2, y: -1 },
  { x: 2, y: 1 },
  { x: 2, y: -1 },
];

function saltosDaCadeia(cadeia) {
  const quantos = Math.min(cadeia.targets ?? 2, SALTOS_DESENHADOS);
  const fila = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < quantos; i++) {
    const passo = PASSOS_DA_CADEIA[i % PASSOS_DA_CADEIA.length];
    x += passo.x;
    y += passo.y;
    fila.push({ x, y });
  }
  return fila;
}

/*
 * Onde por o bicho: a casa atingida mais LONGE do conjurador.
 *
 * Numa magia de alvo unico so' existe uma casa, e e' essa. Numa de area, a mais
 * distante e' a que responde "de tao longe eu pego?" — e e a que menos atrapalha
 * a leitura do desenho, porque nao fica embaixo do proprio boneco.
 */
function casaDoAlvo(casas) {
  let melhor = null;
  let maior = -1;
  for (const chave of casas.keys()) {
    const virgula = chave.indexOf(',');
    const x = Number(chave.slice(0, virgula));
    const y = Number(chave.slice(virgula + 1));
    if (x === 0 && y === 0) continue; // a casa do proprio conjurador nao serve
    const d = Math.max(Math.abs(x), Math.abs(y));
    if (d > maior) {
      maior = d;
      melhor = { x, y };
    }
  }
  return melhor;
}

/*
 * ---- A caixa do desenho: so' o que tem alguma coisa dentro ----
 *
 * O palco era um QUADRADO de lado `2 * raio + 1`, centrado no conjurador. Numa
 * magia de area isso e' quase justo. Numa de alvo unico a sete casas era um
 * quadrado de 13 por 13 para desenhar duas figuras — 169 casas, das quais 167
 * eram chao vazio. E como o palco cabe numa coluna de 190px, cada casa ficava
 * com 13 pixels: o boneco e o bicho viravam dois borroes. E a queixa do dono.
 *
 * Aqui a caixa e' a menor que cabe o conjurador, as casas atingidas e UMA casa
 * de folga em volta. Na mesma coluna de 190px, as sete casas em fila viram 20
 * pixels por casa em vez de 13 — e a altura cai de 13 fileiras para 3, que e' o
 * "recorta a parte de baixo" que ele pediu.
 */
function caixaDoPalco(casas) {
  let x0 = 0;
  let x1 = 0;
  let y0 = 0;
  let y1 = 0;
  for (const chave of casas.keys()) {
    const virgula = chave.indexOf(',');
    const x = Number(chave.slice(0, virgula));
    const y = Number(chave.slice(virgula + 1));
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  // Uma casa de folga: sem ela o boneco encosta na borda e o sprite alto, que
  // sobe para fora do proprio tile, sai cortado em cima.
  return { x0: x0 - 1, x1: x1 + 1, y0: y0 - 1, y1: y1 + 1 };
}

/*
 * ---- O quadro tem SEMPRE o mesmo tamanho; quem se ajusta e' o desenho ----
 *
 * Cada magia tem uma forma de um tamanho: o `exevo gran mas frigo` estoura em
 * 61 casas, o `exori min flam` acerta uma so'. Com o canvas mandando no
 * tamanho do cartao, o painel inteiro mudava de altura a cada magia clicada na
 * lista — e' o "fica quebrando o menu toda hora" que o dono descreveu.
 *
 * Agora o cartao e' fixo e o desenho e' escalado para caber nele: a magia
 * grande encolhe, a pequena AMPLIA. Um alvo unico a 3 casas passa a ser
 * desenhado maior que um a 7, que e' a leitura certa — o que muda entre as duas
 * e' a distancia, e ela continua visivel na contagem de casas do chao.
 */
/*
 * ---- O quadro ACOMPANHA o desenho, em vez de recorta-lo ----
 *
 * A largura era fixa em 176px e o desenho era escalado com `max` para cobrir o
 * quadro: o que passasse do limite era cortado. Numa magia de alvo unico a 7
 * sqm o desenho e' uma tira de dez casas de largura por tres de altura — a
 * escala que cobre 120px de altura joga a largura para 400px, e do que sobrava
 * dentro dos 176 visiveis nao aparecia NEM o conjurador NEM o bicho: so' o chao
 * do meio da tira. Era o quadro de terra batida que o dono viu.
 *
 * Agora o desenho CABE (`min`) e a moldura toma o tamanho dele. Magia comprida
 * estica o quadro para o lado ate o teto da coluna; magia redonda continua
 * quadrada. Como as duas medidas saem da mesma escala, nao sobra faixa preta em
 * lado nenhum — nao ha o que sobrar, o miolo tem exatamente o tamanho da arte.
 *
 * A altura e' o teto, e nao um valor fixo: e' o que segura o painel quieto
 * quando se clica de uma magia para outra.
 */
const LARGURA_MAXIMA_DO_QUADRO = 320;
const ALTURA_DO_QUADRO = 120;

function palcoDaMagia(
  casas,
  caixa,
  entry,
  outfit,
  direcao,
  comAlvo,
  larguraMaxima = LARGURA_MAXIMA_DO_QUADRO,
  { saltos = null, centro = null } = {}
) {
  const colunas = caixa.x1 - caixa.x0 + 1;
  const linhas = caixa.y1 - caixa.y0 + 1;
  // Onde cai a casa (0,0) — a do conjurador — dentro do canvas.
  const eixoX = -caixa.x0;
  const eixoY = -caixa.y0;
  const canvas = document.createElement('canvas');
  canvas.className = 'magia-palco-arte';
  canvas.width = colunas * TILE_DA_PREVIA;
  canvas.height = linhas * TILE_DA_PREVIA;
  /*
   * ---- O desenho CABE, e a moldura se ajusta a ele ----
   *
   * `min` das duas razoes: o desenho inteiro entra no espaco disponivel, sem
   * corte nenhum. Quem sobra nao e' o desenho — e' o quadro, que logo abaixo
   * recebe a medida exata da arte (`quadro.style.width/height` em
   * `previaDaMagia`). Sem descompasso entre os dois nao existe faixa preta.
   *
   * Uma forma redonda bate no teto de altura e fica quadrada; uma tira de alvo
   * unico bate no teto de largura e sai deitada, esticada para o lado — que e'
   * a leitura certa de "acerto de longe".
   */
  const escala = Math.min(larguraMaxima / canvas.width, ALTURA_DO_QUADRO / canvas.height);
  canvas.style.width = `${Math.round(canvas.width * escala)}px`;
  canvas.style.height = `${Math.round(canvas.height * escala)}px`;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const alvo = comAlvo ? casaDoAlvo(casas) : null;
  /*
   * Numa magia em cadeia sao VARIOS bichos, e e' a fila deles que conta a
   * historia: o gelo sai da mao, pega o primeiro, pula para o segundo. Com um
   * troll so' no fim da tira, o desenho dizia "acerto de longe" — que e' outra
   * magia.
   */
  /*
   * 'centro' e' a casa ESCOLHIDA com a cruz do mouse: nas magias que caem onde
   * se clica, e' ali que esta o bicho e e' dali que a forma se abre. Sem ele o
   * bicho ia para a casa mais longe do estouro, na quina.
   */
  const alvos = comAlvo ? (saltos ?? (centro ? [centro] : alvo ? [alvo] : [])) : [];

  /*
   * ---- De onde a forma SAI ----
   *
   * Cada casa acende com um atraso proporcional a distancia deste ponto, e e'
   * esse escalonamento que faz a magia parecer sair de algum lugar em vez de
   * acender inteira de uma vez.
   *
   * O ponto era sempre o conjurador, e com projetil isso punha um buraco no
   * meio da animacao: a runa voava os 260ms ate o alvo, chegava — e o efeito
   * ainda esperava a distancia dela ate o conjurador para comecar. Numa bolt de
   * 7 casas sao 630ms parados entre a chegada e o estouro. E' o atraso que o
   * dono viu ("quando acerta o alvo da um delay pro efeito pegar"), e ele
   * crescia com o alcance — quanto mais longe o tiro, pior.
   *
   * Com projetil o foco passa a ser a CASA DO ALVO. A casa atingida tem
   * distancia zero e acende no instante em que a runa cai; se a magia tiver
   * area, ela se abre a partir dali, que e' de onde ela sai de verdade. Sem
   * projetil nada muda: a forma continua nascendo no conjurador.
   */
  const foco = centro ?? (entry.projetil && alvo ? alvo : { x: 0, y: 0 });

  const lista = [...casas.entries()].map(([chave, tipo]) => {
    const virgula = chave.indexOf(',');
    const x = Number(chave.slice(0, virgula));
    const y = Number(chave.slice(virgula + 1));
    /*
     * Na cadeia quem manda no relogio e' a ORDEM do salto, e nao a distancia:
     * as casas acendem uma depois da outra, no instante em que o projetil chega
     * em cada uma. Pela distancia, dois bichos a mesma distancia do conjurador
     * acenderiam juntos — e ai nao ha cadeia nenhuma, ha um estouro.
     */
    if (saltos) {
      const ordem = saltos.findIndex((salto) => salto.x === x && salto.y === y);
      return { x, y, tipo, atraso: (ordem + 1) * VOO_DO_PROJETIL };
    }
    const distancia = Math.max(Math.abs(x - foco.x), Math.abs(y - foco.y));
    return { x, y, tipo, atraso: distancia * ATRASO_POR_CASA };
  });

  const duracao = effectDuration(entry.efeito) || 600;
  /*
   * O laco e' longo o bastante para a magia inteira caber dentro dele.
   *
   * Com quatro saltos de 260ms mais o efeito do ultimo, uma cadeia passa de um
   * segundo e meio: no ciclo fixo de 1,8s ela recomecava por cima do proprio
   * fim, e o ultimo bicho era o unico que nunca chegava a acender.
   */
  const ciclo = Math.max(CICLO_DA_PREVIA, (saltos ? saltos.length * VOO_DO_PROJETIL : 0) + duracao + 400);
  // Sem cadeia, o efeito espera o projetil chegar; com cadeia, cada casa ja
  // carrega o proprio tempo de voo no 'atraso' acima.
  const esperaOVoo = !!entry.projetil && !!(centro ?? alvo) && !saltos;
  const inicio = performance.now();
  let boneco = null;
  let bicho = null;

  /*
   * ---- Esperar a folha de sprite, e nao um relogio ----
   *
   * Antes o boneco e o bicho eram remontados durante dois segundos fixos, na
   * esperanca de que as folhas tivessem chegado. Se chegassem em 200ms, a
   * previa passava 1,8s remontando a toa; se demorassem mais, ficava vazia para
   * sempre. Os dois casos apareciam — o dono reparou na demora.
   *
   * `pronto` olha o que interessa: o canvas tem pixel dentro? Assim que tiver,
   * para de remontar. O teto existe so' para o caso de a folha nunca chegar.
   */
  const pronto = (canvasDoBoneco) => {
    if (!canvasDoBoneco?.width) return false;
    const dados = canvasDoBoneco.getContext('2d').getImageData(0, 0, canvasDoBoneco.width, canvasDoBoneco.height).data;
    for (let i = 3; i < dados.length; i += 4) if (dados[i] > 8) return true;
    return false;
  };
  const TETO_DA_ESPERA = 8000;

  const quadro = (agora) => {
    // O painel foi refeito ou fechado: o laco morre com ele.
    if (!canvas.isConnected) return;
    /*
     * Na página mas sem aparecer (balão escondido, janela fechada com
     * `hidden`): não há o que desenhar. Sem esta espera o laço seguia a 60
     * quadros por segundo desenhando para ninguém. Olha de novo a cada meio
     * segundo — reabrir a janela retoma a animação sozinho.
     */
    if (canvas.getClientRects().length === 0) {
      setTimeout(() => requestAnimationFrame(quadro), 500);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // O chao de verdade. Enquanto a folha nao chega, o cinza de reserva segura
    // o lugar — sem ele a grade pisca transparente no primeiro quadro.
    for (let gy = 0; gy < linhas; gy++) {
      for (let gx = 0; gx < colunas; gx++) {
        const px = gx * TILE_DA_PREVIA;
        const py = gy * TILE_DA_PREVIA;
        if (!drawItem(ctx, CHAO_DA_PREVIA, px, py)) {
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(px, py, TILE_DA_PREVIA, TILE_DA_PREVIA);
        }
      }
    }

    /*
     * O conjurador, virado para onde a magia sai.
     *
     * Desenhado com `outfitCanvas` e nao com `drawCreature` direto: o segundo
     * ancora o sprite pelo canto de baixo do tile e ainda precisa da composicao
     * das camadas de cor num canvas de rascunho — e o primeiro ja faz as duas
     * coisas e devolve o boneco recortado. Chamar `drawCreature` na mao punha o
     * boneco para fora da casa do meio.
     *
     * Ele e' remontado por dois segundos porque as folhas de sprite carregam
     * sozinhas: enquanto nao chegam, `outfitCanvas` devolve um canvas vazio.
     * Depois disso fica o que ficou — nada mais vai mudar.
     */
    if (outfit) {
      if (!pronto(boneco) && agora - inicio < TETO_DA_ESPERA) {
        boneco = outfitCanvas(outfit.look ?? outfit.type, outfit, TILE_DA_PREVIA, direcao, false);
      }
      ctx.drawImage(boneco, eixoX * TILE_DA_PREVIA, eixoY * TILE_DA_PREVIA);
    }

    /*
     * O bicho vem ANTES do efeito, para o fogo cair em cima dele e nao atras.
     * E' a mesma ordem do mapa: criatura primeiro, efeito por cima.
     */
    if (alvos.length) {
      if (!pronto(bicho) && agora - inicio < TETO_DA_ESPERA) {
        bicho = outfitCanvas(BICHO_DE_EXEMPLO.look, BICHO_DE_EXEMPLO.colors, TILE_DA_PREVIA, OLHANDO_PARA_O_SUL, false);
      }
      // O mesmo canvas em todas as casas: e' um desenho so', montado uma vez.
      for (const onde of alvos) {
        ctx.drawImage(bicho, (onde.x + eixoX) * TILE_DA_PREVIA, (onde.y + eixoY) * TILE_DA_PREVIA);
      }
    }

    const passado = (agora - inicio) % ciclo;

    /*
     * ---- O projetil saindo da mao ate o alvo ----
     *
     * Sai ANTES de tudo acender: o efeito de cada casa ja espera o tempo dela
     * (`atraso`), e o voo ocupa justamente o comeco do ciclo. Assim a leitura
     * fica na ordem certa — a runa voa, chega, e ai a forma estoura.
     *
     * So' onde ha um alvo desenhado: um projetil voando para uma casa vazia nao
     * diz nada, e magia de area que nasce em volta nao arremessa coisa nenhuma.
     */
    const meio = TILE_DA_PREVIA / 2;
    const noCanvas = (casa) => ({
      x: (casa.x + eixoX) * TILE_DA_PREVIA + meio,
      y: (casa.y + eixoY) * TILE_DA_PREVIA + meio,
    });

    if (entry.projetil && saltos) {
      /*
       * Na cadeia o projetil nao sai do conjurador para todos: ele faz UM
       * trecho de cada vez, do conjurador ao primeiro bicho e de cada bicho ao
       * seguinte. E' o salto que da nome a magia, e desenha-lo e' a unica
       * maneira de a previa dizer o que ela faz de diferente.
       */
      const total = saltos.length * VOO_DO_PROJETIL;
      if (passado < total) {
        const trecho = Math.floor(passado / VOO_DO_PROJETIL);
        const parte = (passado % VOO_DO_PROJETIL) / VOO_DO_PROJETIL;
        const de = noCanvas(trecho === 0 ? { x: 0, y: 0 } : saltos[trecho - 1]);
        const para = noCanvas(saltos[trecho]);
        const origem = trecho === 0 ? { x: 0, y: 0 } : saltos[trecho - 1];
        drawMissile(
          ctx,
          entry.projetil,
          de.x + (para.x - de.x) * parte,
          de.y + (para.y - de.y) * parte,
          saltos[trecho].x - origem.x,
          saltos[trecho].y - origem.y
        );
      }
    } else if (entry.projetil && (centro ?? alvo) && passado < VOO_DO_PROJETIL) {
      const onde = centro ?? alvo;
      const parte = passado / VOO_DO_PROJETIL;
      const de = noCanvas({ x: 0, y: 0 });
      const para = noCanvas(onde);
      drawMissile(ctx, entry.projetil, de.x + (para.x - de.x) * parte, de.y + (para.y - de.y) * parte, onde.x, onde.y);
    }

    for (const casa of lista) {
      // Com projetil, a forma so' comeca depois de ele chegar.
      const desde = passado - casa.atraso - (esperaOVoo ? VOO_DO_PROJETIL : 0);
      if (desde < 0 || desde > duracao) continue;
      drawEffect(
        ctx,
        entry.efeito,
        (casa.x + eixoX) * TILE_DA_PREVIA,
        (casa.y + eixoY) * TILE_DA_PREVIA,
        desde / duracao
      );
    }
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
  return canvas;
}

/**
 * A grade de uma magia, ou `null` quando não há o que desenhar.
 *
 * `entry` é uma entrada do catálogo de ações: `forma` traz as casas da área e
 * `range` o alcance de uma magia de alvo único.
 */
/*
 * `larguraMaxima` e' o teto do quadro NESTA tela.
 *
 * O painel de magias tem a largura do modal inteiro para dividir; a tela de
 * municao tem uma coluna estreita ao lado da grade de flechas. Um teto unico
 * cravado aqui dentro serviria a uma e estouraria a outra — e estourar quer
 * dizer o desenho passando por fora da coluna. Quem sabe do espaco e' quem
 * chama.
 */
export function previaDaMagia(entry, { comOutfit = false, larguraMaxima = LARGURA_MAXIMA_DO_QUADRO } = {}) {
  if (!entry) return null;

  const casas = new Map();
  const marcar = (x, y, tipo) => casas.set(`${x},${y}`, tipo);

  let legenda = '';
  /*
   * A magia sai para a frente, ou nasce em volta? Decidido dentro do ramo da
   * area e usado tambem la embaixo, para virar o boneco. Uma magia de alvo
   * unico (so `range`) tambem "sai para a frente": a linha de alcance e'
   * desenhada para o norte.
   */
  let paraFrente = true;
  /*
   * A ordem dos pulos de uma magia em cadeia, quando e' uma. Vai para o palco
   * porque o projetil tem de voar de bicho em bicho, e nao do conjurador para
   * todos ao mesmo tempo.
   */
  let saltos = null;
  /*
   * ---- A casa que a CRUZ do mouse escolhe ----
   *
   * Cinco magias caem onde se clica, e nao em volta de quem lanca: a 'exevo
   * mort ora', as duas barragens, a 'exori mas amp pug' e a 'exevo tempo mas
   * san'. A previa desenhava a forma delas centrada no conjurador — o boneco
   * plantado no meio do proprio estouro, que e' a leitura oposta da verdade.
   *
   * Aqui a forma anda para o leste ate sair de cima dele: o boneco fica na
   * ponta, olhando para o estouro, e a legenda diz que a casa e' escolhida. O
   * desvio e' o raio da forma mais duas casas — o bastante para o boneco ficar
   * de fora — e nunca passa do alcance, senao o desenho prometeria uma distancia
   * que a magia nao tem.
   */
  let centro = null;
  if (entry.forma?.length) {
    if (entry.miraNoChao && entry.range) {
      const raio = Math.max(...entry.forma.map(([dx, dy]) => Math.max(Math.abs(dx), Math.abs(dy))));
      centro = { x: Math.min(raio + 2, entry.range, ALCANCE_MAXIMO_DA_PREVIA), y: 0 };
    } else if (entry.alvoNoCentro && entry.range) {
      // Aqui a casa não é escolhida: é a do bicho marcado, no alcance da magia.
      centro = { x: Math.min(entry.range, ALCANCE_MAXIMO_DA_PREVIA), y: 0 };
    }
    for (const [dx, dy] of entry.forma) {
      if (Math.abs(dx) > RAIO_MAXIMO_DA_PREVIA || Math.abs(dy) > RAIO_MAXIMO_DA_PREVIA) continue;
      marcar(dx + (centro?.x ?? 0), dy, 'area');
    }
    /*
     * ---- Sai para a frente, ou nasce em volta? ----
     *
     * A primeira tentativa perguntou se a forma inclui a casa do próprio
     * conjurador, e estava errada: a `AREA_SQUAREWAVE5` inclui — a onda começa
     * no pé de quem lança e vai embora dali. O que separa as duas é o SENTIDO.
     *
     * As formas são escritas viradas para o norte. Uma que não tem casa nenhuma
     * ao sul de quem lança só existe para um lado: é onda, feixe, rajada. Uma
     * que tem casa dos dois lados é um círculo em volta dele.
     */
    paraFrente = entry.forma.every(([, dy]) => dy <= 0) && entry.forma.some(([, dy]) => dy < 0);
    legenda = paraFrente
      ? `${entry.forma.length} casas, na direção em que você estiver virado`
      : `${entry.forma.length} casas em volta de você`;
    // A forma que anda para a casa escolhida nao sai "para a frente" nem "em
    // volta": ela sai de onde o clique mandar, e o boneco vira para la.
    if (centro) {
      paraFrente = 'leste';
      legenda = entry.miraNoChao
        ? `${entry.forma.length} casas, na casa que você escolher — até ${entry.range} sqm`
        : `${entry.forma.length} casas em volta do alvo, a até ${entry.range} sqm`;
    }
  } else if (entry.cadeia) {
    for (const salto of saltosDaCadeia(entry.cadeia)) marcar(salto.x, salto.y, 'alvo');
    saltos = [...casas.keys()].map((chave) => {
      const virgula = chave.indexOf(',');
      return { x: Number(chave.slice(0, virgula)), y: Number(chave.slice(virgula + 1)) };
    });
    paraFrente = 'leste';
    legenda = `salta em até ${entry.cadeia.targets} criaturas, a ${entry.cadeia.distance} sqm uma da outra`;
  } else if (entry.range) {
    /*
     * ---- Alvo unico e' UMA casa, e nao uma linha ----
     *
     * O desenho antigo pintava todas as casas do caminho ate o alcance — tres
     * quadrados em fila para uma "strike" de alcance 3. Lido de fora, isso diz
     * "a magia pega as tres casas", que e' o oposto do que ela faz: ela pega um
     * bicho so', e o alcance e' so ate onde ela consegue chegar.
     *
     * Agora so' a casa do alvo e' marcada, na ponta do alcance. O quao longe
     * ela chega continua sendo dito — pela distancia do bicho ate o conjurador,
     * que e' o que a grade mostra, e pela legenda.
     */
    /*
     * ---- De pe ela nao cabe; deitada, cabe ----
     *
     * A casa do alvo ia para o NORTE, como as formas de area. Numa magia de
     * alcance 7 isso e' uma tira de 8 casas de ALTURA, e a coluna da previa e
     * mais larga do que alta: para caber, o desenho inteiro encolhia ate a
     * criatura virar um borrao de treze pixels.
     *
     * Deitada e' o contrario: 8 casas de largura e 3 de altura entram na mesma
     * coluna com a casa quase no tamanho de verdade. Foi o que o dono pediu com
     * todas as letras — "coloca o bixo na horizontal a 7 sqms e amplia".
     *
     * O boneco vira para o leste junto (ver `direcaoDoConjurador`): ele tem de
     * estar olhando para onde a magia vai.
     */
    /*
     * ---- O alvo pode ir mais longe que a forma de area ----
     *
     * `RAIO_MAXIMO_DA_PREVIA` existe para uma forma de area nao virar um mapa: 13
     * casas de lado ja e' mais do que o quadro le'. Mas ele tambem cortava o
     * alvo unico em 6, e uma magia de alcance 7 desenhava o bicho na casa 6 —
     * o desenho contradizendo a legenda logo abaixo dele.
     *
     * Deitada, a tira cabe: 7 casas de distancia ocupam a largura e sobra
     * altura. O teto so' segue existindo para o caso de uma arma de alcance
     * absurdo aparecer.
     */
    const alcance = Math.min(entry.range, ALCANCE_MAXIMO_DA_PREVIA);
    marcar(alcance, 0, 'alvo');
    paraFrente = 'leste';
    legenda = `atinge um alvo só, a até ${entry.range} sqm`;
  } else if (entry.efeito) {
    /*
     * ---- A magia que cai em VOCÊ ----
     *
     * Sem forma e sem alcance a previa desistia e devolvia nada, e o painel de
     * escolha ficava com o texto de um lado e um vazio do outro. Sao 125 das
     * 252 magias do jogo: toda cura, todo buff, e as sete posturas novas — quer
     * dizer, justamente as que a pergunta "onde ela pega?" responde numa
     * palavra, e nao as que ela nao tem resposta.
     *
     * A resposta e' o desenho de uma casa so': voce, com o efeito acendendo em
     * cima. E' curto de ler e e' a verdade.
     *
     * As tres que curam OUTRA pessoa ('exura sio' e irmas) sao a excecao dentro
     * da excecao: o azul cai numa casa ao lado, porque nelas cair em voce mesmo
     * seria a leitura errada — e' a magia errada saindo no lugar certo.
     */
    if (entry.curaOutro) {
      marcar(3, 0, 'area');
      paraFrente = 'leste';
      legenda = 'cai em outra pessoa da caçada';
    } else {
      marcar(0, 0, 'area');
      paraFrente = false;
      legenda = 'cai em você mesmo';
    }
  } else {
    return null;
  }

  // A caixa e' a menor que cabe o desenho, e nao um quadrado em volta do
  // conjurador: ver `caixaDoPalco`. As duas previas — a grade do balao e o
  // palco desenhado — usam a MESMA, senao uma delas mentiria sobre a outra.
  const caixa = caixaDoPalco(casas);

  const grade = el('div', 'magia-grade');
  grade.style.setProperty('--colunas', String(caixa.x1 - caixa.x0 + 1));
  for (let y = caixa.y0; y <= caixa.y1; y++) {
    for (let x = caixa.x0; x <= caixa.x1; x++) {
      const tipo = casas.get(`${x},${y}`);
      const centro = x === 0 && y === 0;
      const casa = el('i', `magia-casa${tipo ? ` ${tipo}` : ''}${centro ? ' eu' : ''}`);
      /*
       * ---- A magia SAI, em vez de ficar acesa ----
       *
       * A grade pintava as casas atingidas e parava por ai. Um desenho parado
       * responde "onde", mas nao responde "como": uma onda que varre para a
       * frente e um circulo que estoura em volta viram o mesmo retangulo
       * colorido, e era justamente a diferenca entre elas que o desenho existia
       * para mostrar.
       *
       * Cada casa acende com um atraso proporcional a distancia do conjurador,
       * e o laco reinicia. O efeito e a magia saindo do centro para as bordas,
       * na mesma ordem em que o golpe pega os tiles. `--atraso` e por casa; a
       * animacao em si esta na folha de estilo.
       */
      if (tipo) {
        const distancia = Math.max(Math.abs(x), Math.abs(y));
        casa.style.setProperty('--atraso', `${distancia * 90}ms`);
      }
      grade.append(casa);
    }
  }

  /*
   * O boneco no meio, e nao um ponto claro.
   *
   * O centro era uma casa com contorno branco, e quem nunca jogou nao tem por
   * que adivinhar que aquilo e ele. Com o outfit do proprio personagem no meio
   * a grade se le sozinha: isto sou eu, e a magia sai daqui.
   *
   * So no painel de escolha (`comOutfit`) — no balao de 9px por casa o boneco
   * nao caberia, e la o desenho e' uma referencia rapida e nao a decisao.
   */
  const bloco = el('div', `magia-previa${entry.element ? ` el-${entry.element}` : ''}`);

  /*
   * ---- Duas previas, e a diferenca e' o espaco ----
   *
   * No painel de ESCOLHA (`comOutfit`) ha lugar para o desenho de verdade: o
   * efeito da magia saindo, com o boneco no meio, no mesmo `drawEffect` do
   * mapa. E' onde a decisao e tomada, e onde a pergunta "o que essa magia faz?"
   * merece resposta cheia.
   *
   * No BALAO da barra a casa tem nove pixels e o balao aparece de passagem: ali
   * a grade de quadradinhos continua sendo o certo — ela le' de relance, e o
   * canvas animado seria peso a cada passada de mouse.
   */
  const personagem = comOutfit ? getPersonagem() : null;
  /*
   * O palco desenhado vale para quem tem efeito OU projetil.
   *
   * A pergunta era so' "tem efeito?", e uma flecha comum nao tem: ela nao
   * estoura nada, ela voa. As catorze municoes da tela caiam todas na grade de
   * quadradinhos, e trocar de flecha mostrava o mesmo desenho cinza — que era
   * exatamente o que a previa existia para deixar de ser.
   */
  if (comOutfit && (entry.efeito || entry.projetil)) {
    // O bicho de exemplo so' em magia e runa de ATAQUE: por um troll no desenho
    // de "exura" diria que a cura serve para bater em alguem.
    const deAtaque = entry.group === 'attack' || !!entry.damage;
    /*
     * O palco dentro de um quadro de tamanho fixo, com a moldura de nove fatias
     * que o resto do jogo usa. Antes era uma borda de 1px inventada aqui — o
     * dono pediu a moldura de sempre, e ela ja existe na folha de estilo.
     */
    const quadro = el("div", "magia-quadro ui-frame--miudo");
    const arte = palcoDaMagia(
      casas,
      caixa,
      entry,
      personagem?.outfit ?? null,
      direcaoDoConjurador(paraFrente),
      deAtaque,
      larguraMaxima,
      { saltos, centro }
    );
    /*
     * O miolo do quadro com a medida EXATA da arte.
     *
     * A folha de estilo nao tem como saber o feitio da magia clicada, e um
     * tamanho fixo la' so' pode errar de dois jeitos: sobrando moldura vazia em
     * volta de um desenho pequeno, ou cortando um comprido. `palcoDaMagia` acaba
     * de calcular as duas medidas para caber — sao estas que a moldura veste.
     */
    quadro.style.width = arte.style.width;
    quadro.style.height = arte.style.height;
    quadro.append(arte);
    bloco.append(quadro);
  } else {
    const palco = el('div', 'magia-palco');
    palco.append(grade);
    if (comOutfit && personagem?.outfit) {
      const boneco = el('div', 'magia-boneco');
      // 26px, e nao o tamanho cheio: com 34 ele tapava as casas coladas no
      // conjurador — justamente as que uma onda acende primeiro.
      boneco.append(
        outfitCanvas(
          personagem.outfit.look ?? personagem.outfit.type,
          personagem.outfit,
          26,
          direcaoDoConjurador(paraFrente),
          true
        )
      );
      palco.append(boneco);
    }
    bloco.append(palco);
  }
  bloco.append(el('span', 'magia-legenda', legenda));
  return bloco;
}

/*
 * Para que lado o boneco olha na previa.
 *
 * As formas do servidor sao escritas viradas para o NORTE — as casas atingidas
 * ficam com `dy` negativo, isto e', para cima no desenho. Um conjurador
 * desenhado de frente para o observador enquanto o fogo sai por cima da cabeca
 * dele mostra a coisa errada: no jogo ele estaria olhando para onde a magia
 * vai. Entao forma que sai para a frente vira o boneco para o norte (0), e
 * magia que nasce em volta o deixa de frente (2), que e como o jogador esta
 * acostumado a se ver.
 *
 * O terceiro caso e' a magia de alvo unico, que a previa desenha DEITADA para
 * caber (ver `previaDaMagia`): ali o alvo esta a leste, e o boneco olha para
 * la — 1, na ordem do client (norte, leste, sul, oeste).
 */
const OLHANDO_PARA_O_NORTE = 0;
const OLHANDO_PARA_O_LESTE = 1;
const OLHANDO_PARA_O_SUL = 2;
const direcaoDoConjurador = (sentido) =>
  sentido === 'leste' ? OLHANDO_PARA_O_LESTE : sentido ? OLHANDO_PARA_O_NORTE : OLHANDO_PARA_O_SUL;

/*
 * ---- O que um item muda em relação ao que você JÁ usa ----
 *
 * Passar o mouse numa espada respondia "quanto ela dá". A pergunta de quem está
 * com a mochila aberta é outra: "vale trocar?". Respondê-la de cabeça pede
 * abrir o inventário, achar a peça daquele slot, ler os números dela e subtrair
 * — para cada item que cai.
 *
 * Aqui a conta sai pronta, e só onde ela faz sentido: um item que se veste, que
 * NÃO é o que já está vestido. A peça equipada não se compara com ela mesma, e
 * poção não se compara com nada.
 *
 * Verde é a favor da peça nova, vermelho é contra. O que empata não aparece —
 * uma lista de "= 0" esconderia as duas linhas que importam.
 */

/** Os números de um item, achatados numa chave por linha. */
/*
 * Exportada como `ganhosDoItem`: a lista de aljavas resume o bônus de cada uma
 * no cartão, e ela tem de somar exatamente o que o balão mostra. Duas contas
 * separadas para o mesmo número acabariam discordando.
 */
export function numerosDoItem(meta) {
  const fora = new Map();
  const por = (chave, rotulo, valor, classe, sufixo = '') => {
    if (!valor) return;
    fora.set(chave, { rotulo, valor, classe, sufixo });
  };

  por('attack', 'ataque', meta.attack, 'atk');
  // O número de defesa (escudo OU arma) é o BLOQUEIO (a chance de aparar vem só dele — ver `blockChance`).
  por('defense', 'bloqueio', meta.defense, 'def');
  por('armor', 'Armour', meta.armor, 'def');
  por('evasion', 'Evasion', meta.evasion, 'def');
  por('es', 'Energy Shield', meta.es, 'mana');
  por('range', 'alcance', meta.range, 'plain', ' sqm');
  por('speed', 'velocidade', meta.speed, 'speed');
  if (meta.element) {
    const nome = ELEMENT_NAMES[meta.element.type] ?? meta.element.type;
    por(`element:${meta.element.type}`, `dano de ${nome}`, meta.element.value, `el-${meta.element.type}`);
  }
  return fora;
}

/** `+3` / `-1,5`, com vírgula decimal e sem casas quando é inteiro. */
function diferenca(valor) {
  const arredondado = Number(valor.toFixed(1));
  const texto = Number.isInteger(arredondado)
    ? String(Math.abs(arredondado))
    : String(Math.abs(arredondado)).replace('.', ',');
  return `${arredondado > 0 ? '+' : '−'}${texto}`;
}

/*
 * ---- A COMPARAÇÃO vem do SERVIDOR ----
 *
 * O dono: "considerar todos os atributos do item, usando o mesmo sistema de
 * atributos do personagem, e funcionar para atributos futuros". A conta de
 * antes (`numerosDoItem`) só via o catálogo: duas espadas iguais, uma N1 e
 * outra N5, davam "os mesmos números". Agora o servidor veste a peça numa
 * cópia do personagem e recalcula a ficha pelo mesmo `Ficha.combate` do
 * combate (ver `systems/itens/comparar.mjs`), e devolve duas listas: a
 * diferença atributo a atributo e o impacto no personagem — com os nomes dos
 * registros, sem campo nenhum escrito aqui.
 *
 * O balão desenha na hora com "comparando..." e pede; a resposta preenche o
 * bloco que ainda estiver aberto (`data-comparacao`) e fica guardada um
 * pouco, para passar o mouse de novo não pedir outra vez.
 */
const comparacoes = new Map(); // chave -> { em, r }
const pedidas = new Map(); // chave -> quando pediu
const VALIDADE_DA_COMPARACAO_MS = 30_000;
let enviarComparacao = null;

/** Liga o balão ao `send` do jogo (main.mjs). */
export function ligarComparacao(enviar) {
  enviarComparacao = enviar;
}

// A peça inteira que importa para a conta: a base sorteada (dano, Armour, Evasion, ES), os adds e o tier.
const pecaParaComparar = (id, peca) => ({ id, ...(peca?.base ? { base: peca.base } : {}), ...(peca?.af?.length ? { af: peca.af.map((a) => ({ id: a.id, nivel: a.nivel, value: a.value })) } : {}), ...(peca?.tier ? { tier: peca.tier } : {}) });
const chaveDaComparacao = (nova, vestida) =>
  JSON.stringify([nova.id, nova.base ?? null, nova.af ?? [], nova.tier ?? 0, vestida?.id ?? 0, vestida?.base ?? null, vestida?.af ?? [], vestida?.tier ?? 0]);

/*
 * "Mostrar todos os atributos": a comparação mostra só o que MUDA; ligado, a
 * ficha inteira (atual → novo). O balão some ao tirar o mouse, então no
 * computador quem alterna é o Shift (com o balão aberto); no celular, tocar na
 * linha "Mostrar todos" dentro do balão.
 */
let mostrarTodos = false;
let holderAberto = null;
function alternarTodos() {
  mostrarTodos = !mostrarTodos;
  if (holderAberto?.isConnected && node && !node.hidden) show(holderAberto);
}

/** A resposta do servidor (`{t:'comparacao', chave, ...}`): guarda e preenche o balão aberto. */
export function receberComparacao(m) {
  pedidas.delete(m.chave);
  comparacoes.set(m.chave, { em: Date.now(), r: m });
  for (const bloco of document.querySelectorAll('.tip-vs[data-comparacao]')) {
    if (bloco.dataset.comparacao === m.chave) preencherComparacao(bloco, m);
  }
  // O balão aberto cresceu com a resposta: arruma o tamanho (colunas/rolagem) e a posição de novo.
  if (node && !node.hidden && holderAberto?.isConnected && node.querySelector(`.tip-vs[data-comparacao="${CSS.escape(m.chave)}"]`)) place(holderAberto);
}

function preencherComparacao(bloco, r) {
  bloco.textContent = '';
  if (!r.ok) {
    bloco.append(el('div', 'vs-igual', r.erro ?? 'sem comparação'));
    return;
  }
  bloco.append(el('div', 'vs-cabeca', 'Ao equipar'));
  bloco.append(el('div', 'vs-titulo', r.contra ? `no lugar de ${titleCase(r.contra.nome)}` : `${SLOT_NAMES[r.slot] ?? r.slot} vazio`));
  const numero = (v, sufixo) => `${String(Number(v.toFixed(2))).replace('.', ',')}${sufixo}`;
  // Atual → novo → diferença, agrupado pelas seções da ficha (Atributos, Recursos, Ofensivo...).
  // Só o que muda, até LIMITE_DO_AO_EQUIPAR linhas (as maiores mudanças); o resto, no "Mostrar todos".
  const LIMITE_DO_AO_EQUIPAR = 10;
  let lista = mostrarTodos ? r.todos ?? r.personagem : r.personagem;
  let escondidas = 0;
  if (!mostrarTodos && lista.length > LIMITE_DO_AO_EQUIPAR) {
    const maiores = new Set([...lista].sort((a, b) => Math.abs(b.delta) / (Math.abs(b.de) || 1) - Math.abs(a.delta) / (Math.abs(a.de) || 1)).slice(0, LIMITE_DO_AO_EQUIPAR));
    escondidas = lista.length - maiores.size;
    lista = lista.filter((l) => maiores.has(l));
  }
  let secaoAtual = null;
  for (const linha of lista) {
    if (linha.secao && linha.secao !== secaoAtual) {
      secaoAtual = linha.secao;
      bloco.append(el('div', 'vs-secao', secaoAtual));
    }
    const row = el('div', `vs-linha ${linha.delta > 0 ? 'vs-melhor' : linha.delta < 0 ? 'vs-pior' : 'vs-mesmo'}`);
    row.append(
      el('span', 'vs-nome', linha.nome),
      el('em', 'vs-de', `${numero(linha.de, linha.sufixo)} → ${numero(linha.para, linha.sufixo)}`),
      el('b', null, linha.delta ? `${diferenca(linha.delta)}${linha.sufixo}` : '='),
    );
    bloco.append(row);
  }
  if (escondidas) bloco.append(el('div', 'vs-igual', `+${escondidas} outras mudanças`));
  if (!r.personagem.length) bloco.append(el('div', 'vs-igual', 'nada muda no personagem'));
  if (r.tiraOEscudo) bloco.append(el('div', 'vs-aviso', 'usa as duas mãos — o escudo sai'));
  // A diferença peça a peça (base e adds) vem junto quando pede tudo.
  if (mostrarTodos && r.atributos?.length) {
    bloco.append(el('div', 'vs-secao', 'Diferença entre as peças'));
    for (const linha of r.atributos) {
      const row = el('div', `vs-linha ${linha.delta > 0 ? 'vs-melhor' : 'vs-pior'}`);
      row.append(el('span', 'vs-nome', linha.nome), el('em', 'vs-de', ''), el('b', null, `${diferenca(linha.delta)}${linha.sufixo}`));
      bloco.append(row);
    }
  }
  const todos = el('div', 'vs-todos', mostrarTodos ? 'Mostrar só o que muda' : 'Mostrar todos os atributos');
  todos.append(el('kbd', null, ehTelefone() ? 'toque' : 'Shift'));
  bloco.append(todos);
}

/**
 * O bloco de comparação, ou `null` quando não há com o que comparar.
 *
 * `slot` vem preenchido quando a peça JÁ está vestida — e aí não há comparação
 * a fazer, ela é o que está vestido.
 */
function comparacaoComOEquipado(meta, slot, peca = null) {
  if (slot || !meta.slot || meta.stackable || meta.slot === 'backpack') return null;
  const personagem = getPersonagem();
  if (!personagem?.equipment) return null;
  const vestida = personagem.equipment[meta.slot] ?? null;
  const nova = pecaParaComparar(meta.id, peca);
  // Ela mesma: a peça vestida, olhada de dentro do inventário.
  if (vestida && vestida.id === meta.id && chaveDaComparacao(nova, vestida) === chaveDaComparacao(pecaParaComparar(vestida.id, vestida), vestida) && peca === vestida) return null;
  const chave = chaveDaComparacao(nova, vestida ? pecaParaComparar(vestida.id, vestida) : null);
  const bloco = el('div', 'tip-vs');
  bloco.dataset.comparacao = chave;
  const guardada = comparacoes.get(chave);
  if (guardada && Date.now() - guardada.em < VALIDADE_DA_COMPARACAO_MS) {
    preencherComparacao(bloco, guardada.r);
    return bloco;
  }
  bloco.append(el('div', 'vs-igual', 'comparando com o que você veste...'));
  if (enviarComparacao && Date.now() - (pedidas.get(chave) ?? 0) > 3000) {
    pedidas.set(chave, Date.now());
    enviarComparacao({ t: 'compararPeca', chave, peca: nova });
  }
  return bloco;
}

/*
 * ---- A ESSÊNCIA DE AFIXO, no balão ----
 *
 * Ela é o único item do jogo cujo NOME não está no catálogo. Tem de ser assim:
 * o id é um só (ver `ID_DA_ESSENCIA`, no servidor) e o que a distingue — de que
 * slot o afixo saiu, de que qualidade era a peça, e se ela é a vermelha da
 * fusão — mora na instância.
 *
 * O dono pediu as três coisas de uma vez: "o nome das essências tem que ser tipo
 * 'essência de afixo slot boots'; essas essências têm que estar na mesma
 * qualidade da peça que foi retirada; e seria interessante, ao passar o mouse
 * por cima da essência, ter escrito embaixo de qual peça essa essência veio."
 *
 * A frase é montada AQUI e não recebida pronta do servidor porque o balão
 * aparece em telas que não falam com a forja — a mochila, o depósito, a vitrine
 * do mercado —, e todas elas já têm a peça na mão. O servidor manda a mesma
 * frase no `nome` da bancada; as duas dizem o mesmo, e a daqui é a que
 * funciona sem pedir nada.
 */
export const ID_DA_ESSENCIA = 900001;
export const ehEssencia = (peca, id) => Number(id ?? peca?.id) === ID_DA_ESSENCIA;

/*
 * ---- Ela é a VERMELHA? ----
 *
 * A fusão carimba `mitica` na peça, e essa é a resposta rápida. A segunda é
 * intrínseca: o afixo de uma vermelha vale 130% da régua, e NADA MAIS no jogo
 * passa do topo — `estrelasDosAfixos` devolve `q4` só nesse caso.
 *
 * Perguntar as duas cobre o caminho em que a marca se perde (uma cópia velha,
 * uma tela que monta a peça campo a campo e esquece um). O afixo não se perde:
 * ele É a peça. Mesma conta que o `ehVermelha` do servidor.
 */
export const ehVermelha = (peca) =>
  !!peca?.mitica || estrelasDosAfixos(peca?.af)[0]?.q === 4;

const NOME_DO_SLOT_DA_ESSENCIA = {
  head: 'elmo', neck: 'colar', body: 'armadura', legs: 'perneira', feet: 'bota',
  ring: 'anel', weapon: 'arma', shield: 'escudo', ammo: 'munição', backpack: 'mochila',
};

export function nomeDaEssencia(peca) {
  const vermelha = ehVermelha(peca);
  const partes = [vermelha ? 'essência vermelha' : 'essência de afixo'];
  const slot = NOME_DO_SLOT_DA_ESSENCIA[peca?.afixoDe] ?? null;
  if (slot) partes.push(slot);
  /*
   * A vermelha não diz qualidade nenhuma: ela entra em QUALQUER qualidade do
   * slot dela. Escrever "comum" no nome de uma essência que entra numa mítica
   * seria a informação mais enganosa possível ali.
   */
  const raridade = peca?.raridade ?? peca?.essenciaDe ?? null;
  if (!vermelha && raridade && raridade !== 'comum') partes.push(raridade);
  return partes.join(' · ');
}

/** A linha de baixo do nome: qualidade, slot e o que ela é. */
/*
 * A linha de baixo do nome. Ela diz o que a essência EXIGE, e não o que ela é —
 * o que ela é já está no nome, logo acima, e repetir a palavra duas vezes em
 * duas linhas seguidas é ruído.
 */
function linhaDaEssencia(peca) {
  const slot = NOME_DO_SLOT_DA_ESSENCIA[peca?.afixoDe] ?? null;
  const raridade = peca?.raridade ?? peca?.essenciaDe ?? 'comum';
  /*
   * A linha diz o que a essência EXIGE. Para a vermelha a exigência é MENOR, e
   * é isso que precisa estar escrito: só o slot, em qualquer qualidade. Ela
   * dizendo "só entra em arma comum" — que foi o que o dono viu — é a frase
   * exatamente ao contrário do que a regra faz.
   */
  if (ehVermelha(peca)) {
    return [slot ? `entra em qualquer ${slot}` : 'sem slot de origem', 'fundida · 130% da régua']
      .filter(Boolean)
      .join(' · ');
  }
  return [
    slot ? `só entra em ${slot} ${raridade}` : `sem slot de origem · ${raridade}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/*
 * A silhueta do slot de onde o afixo saiu, no lugar da sprite que ela não tem.
 *
 * ---- E ela sai NA COR da peça de origem ----
 *
 * "a essência do afixo tem que ficar com a cor da raridade do item que foi
 * retirado."
 *
 * A cor não é enfeite aqui: a qualidade é METADE da regra de onde a essência
 * pode entrar (a outra metade é o slot), e ela era a metade invisível — a
 * silhueta era cinza em todas, e só o texto distinguia uma mítica de uma comum.
 * Com a cor, uma mochila de essências se lê de relance, do mesmo jeito que a
 * ficha se lê pela borda das peças.
 *
 * A classe é a MESMA do resto do jogo (`tier-mitico` e companhia), então a
 * paleta é uma só: o dia em que a cor do mítico mudar, muda aqui junto.
 */
function arteDoSlotDaEssencia(peca, size) {
  // A vermelha da fusão sai de mítico venha de onde vier; a classe extra é o
  // efeito que a separa de uma essência mítica de verdade.
  const vermelha = ehVermelha(peca);
  const raridade = vermelha ? 'mítico' : peca?.raridade ?? peca?.essenciaDe ?? 'comum';
  const caixa = el('div', `tip-essencia-arte ${classeDaRaridade({ rarity: raridade })}${vermelha ? ' vermelha' : ''}`);
  const img = document.createElement('img');
  img.width = size;
  img.height = size;
  img.src = `/client/assets/slots/${ARTE_DO_SLOT_DA_ESSENCIA[peca?.afixoDe] ?? 'back'}.png`;
  img.alt = '';
  img.onerror = () => img.remove();
  caixa.append(img);
  return caixa;
}

/*
 * O nome do ARQUIVO de cada silhueta.
 *
 * ---- Três deles NÃO se chamam como o slot ----
 *
 * `weapon` é `right-hand.png`, `shield` é `left-hand.png` e `ring` é
 * `finger.png` — os arquivos foram nomeados pela PARTE DO CORPO, e não pelo
 * campo. Esta tabela nasceu adivinhando, e as três adivinhações erradas eram
 * exatamente as que o dono viu: "a sprite dentro do tooltip da essência está
 * sem". Uma essência de escudo pedia `shield.png`, que não existe, e o
 * `onerror` tirava a figura — quadro vazio, sem erro nenhum no console.
 *
 * É a mesma tabela do `SLOT_ART` do inventário, copiada e não importada: são
 * dez pares de string, e uma dependência entre duas telas que não se falam
 * sairia mais cara. O que faltava era copiar CERTO.
 */
const ARTE_DO_SLOT_DA_ESSENCIA = {
  neck: 'neck', head: 'head', backpack: 'back', weapon: 'right-hand', body: 'body',
  shield: 'left-hand', ring: 'finger', legs: 'legs', ammo: 'ammo', feet: 'feet',
};

/**
 * O item do catálogo com a FAIXA que ESTA peça sorteou no drop (`peca.base`:
 * `[piso, teto]` de ataque, defesa e armadura). O campo vira a média (é o que a
 * ficha e a comparação usam) e `faixas` guarda o piso e o teto para o balão.
 */
const comBaseDaPeca = (meta, peca) => {
  // Sem faixa sorteada: a defesa padrão do tipo da base (Evasion/Energy Shield), que o servidor anota no catálogo.
  if (meta?.defesaPadrao && !peca?.base) return { ...meta, ...meta.defesaPadrao };
  if (!meta || !peca?.base) return meta;
  const saida = { ...meta, faixas: {} };
  for (const campo of ['attack', 'defense', 'armor', 'evasion', 'es']) {
    const bruto = peca.base[campo];
    const [a, b] = Array.isArray(bruto) ? bruto : [bruto, bruto];
    const piso = Math.floor(Number(a));
    const teto = Math.floor(Number(b));
    // [0, 0] vale: a peça de Energy Shield/Evasion tem o Armour zerado.
    if (!((piso > 0 && teto > 0) || (Array.isArray(bruto) && piso === 0 && teto === 0))) continue;
    saida[campo] = Math.round((piso + Math.max(piso, teto)) / 2);
    saida.faixas[campo] = [piso, Math.max(piso, teto)];
  }
  return saida;
};

/** "+20–25" quando a peça tem faixa; "+20" quando é um valor só. */
const numeroOuFaixa = (meta, campo) => {
  const sinal = (v) => (v > 0 ? `+${v}` : String(v));
  const f = meta.faixas?.[campo];
  return f && f[0] !== f[1] ? `${sinal(f[0])}–${f[1]}` : sinal(meta[campo]);
};

const NOME_DO_ATRIBUTO = { str: 'STR', dex: 'DEX', int: 'INT' };

/**
 * Este personagem cumpre o requisito de atributo da peça? Devolve o texto do que
 * falta, ou null. O requisito vem pronto do servidor (`meta.requisito`, ver
 * `personagem/requisitos.mjs`); aqui só a comparação: basta UM dos atributos.
 */
export function faltaRequisito(meta, personagem) {
  const req = meta?.requisito;
  const atributos = personagem?.derived?.atributos;
  if (!req || !atributos) return null;
  if (req.atributos.some((a) => (atributos[a] ?? 0) >= req.valor)) return null;
  return `Requer ${req.atributos.map((a) => `${req.valor} ${NOME_DO_ATRIBUTO[a] ?? a}`).join(' ou ')}`;
}

const NOME_DO_EFEITO_DA_SUPPORT = {
  danoPct: 'dano',
  curaPct: 'cura',
  castTimePct: 'tempo de conjuração',
  custoPct: 'custo de mana',
  recargaPct: 'recarga',
  critChance: 'chance de crítico',
  critDano: 'dano crítico',
  alvosExtras: 'projéteis extras',
  danoDosExtrasPct: 'do dano em cada projétil extra',
  perfurar: 'bichos atravessados (perfura)',
  danoDaPerfuracaoPct: 'do dano ao atravessar',
  bifurcar: 'projéteis ao se dividir no alvo',
  danoDaBifurcacaoPct: 'do dano em cada divisão',
  encadear: 'saltos de bicho em bicho',
  danoDoEncadeamentoPct: 'do dano em cada salto',
  retornar: 'volta (acerta de novo)',
  danoDoRetornoPct: 'do dano na volta',
  explosaoPct: 'do dano numa explosão em volta do alvo',
  segundaExplosaoPct: 'do dano numa segunda explosão',
  areaExtra: 'casas de raio na área',
  leechVidaPct: 'do dano volta em vida',
  leechManaPct: 'do dano volta em mana',
  custoEmVida: 'paga o custo com VIDA, e não mana',
  duracaoPct: 'de duração do reforço',
  igniteChance: 'de chance de queimar o bicho',
  // As durações e regras abaixo são as de `gamedata/gemas/config.json` (`estados`) — um teste (`estados.test.mjs`) confere que o texto bate.
  ignitePct: 'do acerto em queimadura por 4 s (uma queimadura por bicho: vale a maior)',
  congelarChance: 'de chance de congelar o bicho por 1,5 s (não anda nem ataca; depois fica 3 s imune; chefe é imune, elite leva metade)',
  lentidaoPct: 'de lentidão no bicho por 3 s (anda e ataca mais devagar; no máximo 40%; chefe leva metade, elite metade do tempo)',
  atordoarChance: 'de chance de atordoar o bicho por 1,5 s (não anda nem ataca; depois fica 3 s imune; chefe é imune, elite leva metade)',
  venenoPct: 'do acerto em veneno por 6 s (empilha até 10×; a resistência a terra vale em cada pulso)',
  sangramentoPct: 'do acerto em sangramento por 5 s (reaplicar renova a duração; a resistência física vale em cada pulso)',
};
// Contagem sai "+2"; os % dos golpes secundários saem "70% do dano..." (não "+70%").
const CONTAGENS_DA_SUPPORT = new Set(['alvosExtras', 'perfurar', 'bifurcar', 'encadear', 'retornar', 'areaExtra']);
const PORCENTO_DO_GOLPE = new Set(['danoDosExtrasPct', 'danoDaPerfuracaoPct', 'danoDaBifurcacaoPct', 'danoDoEncadeamentoPct', 'danoDoRetornoPct', 'explosaoPct', 'segundaExplosaoPct', 'leechVidaPct', 'leechManaPct', 'igniteChance', 'ignitePct', 'congelarChance', 'lentidaoPct', 'atordoarChance']);
// A lentidão que pega nunca passa deste teto (`config.estados.lento.maximo`): o balão mostra o que vale de verdade.
const LENTIDAO_MAXIMA = 40;
const numeroDoEfeito = (chave, v) => (chave === 'lentidaoPct' ? (v = Math.min(LENTIDAO_MAXIMA, v)) && `${v}%` : chave === 'custoEmVida' ? '' : CONTAGENS_DA_SUPPORT.has(chave) ? `${v > 0 ? '+' : ''}${v}` : PORCENTO_DO_GOLPE.has(chave) ? `${v}%` : `${v > 0 ? '+' : ''}${v}%`);

const TAG_PT = {
  physical: 'físico', fire: 'fogo', earth: 'terra', energy: 'energia', ice: 'gelo', holy: 'sagrado', death: 'morte',
  spell: 'magia', projectile: 'projétil', area: 'área', wave: 'onda', line: 'linha', hit: 'golpe direto', single: 'alvo único',
  melee: 'corpo a corpo', ranged: 'à distância', healing: 'cura', buff: 'reforço',
};

const COMPATIBILIDADE_SIMPLES = {
  spell: 'magias (não vale para runas)', projectile: 'habilidades de projétil', healing: 'habilidades de cura', buff: 'habilidades de reforço',
  physical: 'habilidades de dano físico', fire: 'habilidades de dano de fogo', earth: 'habilidades de dano de terra', energy: 'habilidades de dano de energia',
  ice: 'habilidades de dano de gelo', holy: 'habilidades de dano sagrado', death: 'habilidades de dano de morte', hit: 'habilidades que causam dano direto',
};

/** A compatibilidade do suporte em português: `requer` (todas), `algum` (uma delas); sem nada, qualquer habilidade. */
export function textoDaCompatibilidade(def) {
  const nome = (t) => TAG_PT[t] ?? t;
  const requer = def.requer ?? [];
  const algum = def.algum ?? [];
  if (algum.length >= 7) return 'qualquer habilidade de dano';
  if (requer.length === 1 && !algum.length) return COMPATIBILIDADE_SIMPLES[requer[0]] ?? `habilidades com ${nome(requer[0])}`;
  if (!requer.length && algum.length && algum.every((t) => ['area', 'wave', 'line'].includes(t))) return 'habilidades de área, onda ou linha';
  if (!requer.length && !algum.length) return 'qualquer habilidade';
  const partes = [];
  if (requer.length) partes.push(`${requer.map(nome).join(' + ')}`);
  if (algum.length) partes.push(`${requer.length ? 'e ' : ''}${algum.length > 1 ? 'ao menos um de: ' : ''}${algum.map(nome).join(' ou ')}`);
  return `habilidades com ${partes.join(' ')}`;
}

const ETIQUETA_DO_EFEITO = [
  ['alvosExtras', 'PROJÉTIL'], ['perfurar', 'PROJÉTIL'], ['bifurcar', 'PROJÉTIL'], ['encadear', 'PROJÉTIL'], ['retornar', 'PROJÉTIL'],
  ['areaExtra', 'ÁREA'], ['explosaoPct', 'EXPLOSÃO'], ['segundaExplosaoPct', 'EXPLOSÃO'],
  ['critChance', 'CRÍTICO'], ['critDano', 'CRÍTICO'], ['castTimePct', 'CONJURAÇÃO'], ['custoPct', 'CUSTO'], ['custoEmVida', 'CUSTO'],
  ['recargaPct', 'RECARGA'], ['curaPct', 'CURA'], ['duracaoPct', 'DURAÇÃO'], ['leechVidaPct', 'ROUBO'], ['leechManaPct', 'ROUBO'],
  ['igniteChance', 'QUEIMADURA'], ['venenoChance', 'VENENO'], ['sangramentoChance', 'SANGRAMENTO'], ['congelarChance', 'CONTROLE'], ['lentidaoPct', 'CONTROLE'], ['atordoarChance', 'CONTROLE'],
];

/** A ficha do suporte: etiqueta, linhas do efeito (com os números reais) e contrapartidas. Mesma conta do servidor (`efeitoNaSkill`). */
export function fichaDoSuporte(def, nivel, qualidade, mult) {
  const fmt = (v) => (Math.round(v * 10) / 10).toLocaleString('pt-BR');
  const f = mult * (1 + qualidade / 100);
  const v = {};
  for (const [chave, base] of Object.entries(def.efeito ?? {})) {
    const bruto = base + (def.porNivel?.[chave] ?? 0) * (nivel - 1);
    v[chave] = CONTAGENS_DA_SUPPORT.has(chave) ? bruto : PORCENTO_DO_GOLPE.has(chave) && chave.startsWith('danoD') ? Math.min(100, bruto * f) : bruto * f;
  }
  const principais = [];
  const contrapartidas = [];
  const plural = (n, um, varios) => (n === 1 ? um : varios);
  const dano = v.danoPct;
  if (dano > 0) principais.push(`Aumenta em ${fmt(dano)}% o dano da habilidade (soma com as outras gemas de dano).`);
  else if (dano < 0) contrapartidas.push(`Contrapartida: ${fmt(dano)}% de dano.`);
  if (v.curaPct) principais.push(`Aumenta em ${fmt(v.curaPct)}% a cura.`);
  if (v.castTimePct) principais.push(`Reduz em ${fmt(-v.castTimePct)}% o tempo de conjuração.`);
  if (v.custoPct) principais.push(`Reduz em ${fmt(-v.custoPct)}% o custo de mana.`);
  if (v.recargaPct) principais.push(`Reduz em ${fmt(-v.recargaPct)}% a recarga própria da habilidade (não reduz o intervalo global entre ataques).`);
  if (v.critChance) principais.push(`+${fmt(v.critChance)} pontos de chance de crítico.`);
  if (v.critDano) principais.push(`+${fmt(v.critDano)} pontos de dano crítico.`);
  if (v.alvosExtras) principais.push(`Dispara +${v.alvosExtras} ${plural(v.alvosExtras, 'projétil extra', 'projéteis extras')}; cada um causa ${fmt(v.danoDosExtrasPct)}% do dano.`);
  if (v.perfurar) principais.push(`Atravessa ${v.perfurar} ${plural(v.perfurar, 'criatura', 'criaturas')}; ${fmt(v.danoDaPerfuracaoPct)}% do dano ao atravessar.`);
  if (v.bifurcar) principais.push(`Ao acertar, divide-se em ${v.bifurcar} projéteis; ${fmt(v.danoDaBifurcacaoPct)}% do dano em cada um.`);
  if (v.encadear) principais.push(`Salta por ${v.encadear} ${plural(v.encadear, 'criatura', 'criaturas')} a mais; ${fmt(v.danoDoEncadeamentoPct)}% do dano em cada salto.`);
  if (v.retornar) principais.push(`Volta ${v.retornar} ${plural(v.retornar, 'vez', 'vezes')}; ${fmt(v.danoDoRetornoPct)}% do dano na volta.`);
  if (v.areaExtra > 0) principais.push(`Aumenta o raio da área em ${v.areaExtra} ${plural(v.areaExtra, 'casa', 'casas')}.`);
  else if (v.areaExtra < 0) contrapartidas.push(`Contrapartida: reduz o raio da área em ${-v.areaExtra} ${plural(-v.areaExtra, 'casa', 'casas')}.`);
  if (v.explosaoPct) principais.push(`Explode em volta do alvo, causando ${fmt(v.explosaoPct)}% do dano.`);
  if (v.segundaExplosaoPct) principais.push(`Uma segunda explosão causa ${fmt(v.segundaExplosaoPct)}% do dano.`);
  if (v.leechVidaPct) principais.push(`${fmt(v.leechVidaPct)}% do dano causado volta como vida.`);
  if (v.leechManaPct) principais.push(`${fmt(v.leechManaPct)}% do dano causado volta como mana.`);
  if (v.custoEmVida) contrapartidas.push('Contrapartida: paga o custo da habilidade com VIDA, e não com mana.');
  if (v.duracaoPct) principais.push(`Aumenta em ${fmt(v.duracaoPct)}% a duração do reforço.`);
  if (v.ignitePct) principais.push(`${v.igniteChance < 100 ? `${fmt(v.igniteChance)}% de chance de queimar: ` : 'Queima a criatura atingida: '}${fmt(v.ignitePct)}% do acerto em 4 s (uma queimadura por criatura: vale a maior).`);
  if (v.venenoPct) principais.push(`${v.venenoChance < 100 ? `${fmt(v.venenoChance)}% de chance de envenenar: ` : 'Envenena a criatura atingida: '}${fmt(v.venenoPct)}% do acerto em veneno por 6 s (empilha até 10×; a resistência a terra vale em cada pulso).`);
  if (v.sangramentoPct) principais.push(`${v.sangramentoChance < 100 ? `${fmt(v.sangramentoChance)}% de chance de sangrar: ` : 'Faz sangrar a criatura atingida: '}${fmt(v.sangramentoPct)}% do acerto em sangramento por 5 s (reaplicar renova a duração; a resistência física vale em cada pulso).`);
  if (v.congelarChance) principais.push(`${fmt(Math.min(100, v.congelarChance))}% de chance de congelar por 1,5 s (não anda nem ataca; depois fica 3 s imune; chefe é imune, elite leva metade).`);
  if (v.lentidaoPct) principais.push(`Lentidão de ${fmt(Math.min(LENTIDAO_MAXIMA, v.lentidaoPct))}% por 3 s (anda e ataca mais devagar; chefe leva metade, elite metade do tempo).`);
  if (v.atordoarChance) principais.push(`${fmt(Math.min(100, v.atordoarChance))}% de chance de atordoar por 1,5 s (não anda nem ataca; depois fica 3 s imune; chefe é imune, elite leva metade).`);

  const elemento = (def.requer ?? []).find((t) => ['physical', 'fire', 'earth', 'energy', 'ice', 'holy', 'death'].includes(t));
  let etiqueta = ETIQUETA_DO_EFEITO.find(([c]) => v[c] !== undefined && c !== 'custoEmVida')?.[1];
  if (!etiqueta && v.custoEmVida) etiqueta = 'CUSTO';
  if (!etiqueta) etiqueta = elemento ? TAG_PT[elemento].toUpperCase() : (def.algum ?? []).includes('fire') && (def.algum ?? []).length < 7 ? 'ELEMENTAL' : (def.requer ?? []).includes('projectile') ? 'PROJÉTIL' : (def.algum ?? []).includes('area') ? 'ÁREA' : 'DANO';
  return { etiqueta, principais, contrapartidas };
}

const ESCALA_DA_GEMA = { melee: 'Melee', distance: 'Distance', magic: 'Magic Level' };
const ORIGEM_DO_PODER = { melee: 'o poder da arma corpo a corpo', distance: 'o poder da arma de distância', magic: 'o Magic Attack da wand/rod' };
const nomeDoElemento = (e) => {
  const n = ELEMENT_NAMES[e] ?? e;
  return n.charAt(0).toUpperCase() + n.slice(1);
};

/** A linha de etiquetas da gema de ataque, em português: ELEMENTO · (CORPO A CORPO/À DISTÂNCIA) · FORMA. As tags internas não vão ao jogador. */
function etiquetasDaGema(x, def) {
  const tags = new Set(x?.tags ?? def?.tags ?? []);
  const partes = [];
  const el1 = x?.element ?? ['physical', 'fire', 'ice', 'earth', 'energy', 'death', 'holy'].find((t) => tags.has(t));
  if (el1 && !x?.heals) partes.push(nomeDoElemento(el1 === 'poison' ? 'earth' : el1));
  if (tags.has('melee')) partes.push('Corpo a corpo');
  else if (tags.has('ranged')) partes.push('À distância');
  if (x?.overTime) partes.push('Dano contínuo');
  else if (x?.cadeia || tags.has('chain')) partes.push('Cadeia');
  else if (tags.has('projectile') && tags.has('area')) partes.push('Projétil', 'Área');
  else if (tags.has('projectile')) partes.push('Projétil');
  else if (tags.has('wave')) partes.push('Onda');
  else if (tags.has('line')) partes.push('Linha');
  else if (tags.has('area')) partes.push('Área');
  else if (tags.has('single')) partes.push('Alvo único');
  return partes.map((p) => p.toUpperCase()).join(' · ');
}

/** A ficha da gema (ativa ou support): nível/XP da instância, tags e o efeito. */
function blocoDaGema(def, gema, raridade = 'comum') {
  const bloco = el('div', 'tip-gema');
  const nivel = gema?.nivel ?? 1;
  const qualidade = gema?.qualidade ?? 0;
  const mult = def.mult?.[raridade] ?? 1;
  const categoria = def.categoria ?? (def.tipo === 'support' ? 'suporte' : 'ataque');
  const ehSuporte = def.tipo === 'support';
  bloco.append(el('div', 'tip-gema-tipo', ehSuporte ? `${raridade.toUpperCase()} · ${(NOME_DA_CATEGORIA[categoria] ?? 'Gema').toUpperCase()}` : NOME_DA_CATEGORIA[categoria] ?? 'Gema'));
  if (!ehSuporte) bloco.append(el('div', 'tip-gema-ajuda', AJUDA_DA_CATEGORIA[categoria] ?? ''));
  // Modelo Path of Exile: nível até 20 por XP (21+ só com o add da peça) e qualidade separada, até 20%.
  bloco.append(el('div', null, `Nível ${nivel} / ${def.nivelMaximo ?? 30}${gema?.xp ? ` · ${Math.floor(gema.xp).toLocaleString('pt-BR')} XP` : ''}`));
  bloco.append(el('div', null, `Qualidade: +${qualidade}%`));
  if (mult !== 1) bloco.append(el('div', 'tip-gema-efeito', `Raridade ${raridade}: ${ehSuporte ? 'efeito' : 'bônus'} ×${mult.toLocaleString('pt-BR')}`));
  if (def.tipo === 'support') {
    // Tooltip padronizada do suporte (auditoria de 02/10): etiqueta, o que faz em frase (com o número real: nível, raridade e
    // qualidade), a contrapartida em linha própria, a compatibilidade em português e o que a qualidade faz.
    const f = fichaDoSuporte(def, nivel, qualidade, mult);
    bloco.append(el('div', 'tip-gema-tags', `SUPORTE · ${f.etiqueta}`));
    for (const t of f.principais) bloco.append(el('div', 'tip-gema-efeito', t));
    for (const t of f.contrapartidas) bloco.append(el('div', 'tip-gema-penalidade', t));
    bloco.append(el('div', 'tip-gema-ajuda', `Compatível com: ${textoDaCompatibilidade(def)}.`));
    if (qualidade) bloco.append(el('div', 'tip-gema-ajuda', `Qualidade +${qualidade}%: aumenta em ${qualidade}% o efeito desta gema (os números inteiros — projéteis, saltos, casas — não crescem).`));
    bloco.append(el('div', 'tip-gema-ajuda', 'Encaixe num socket ligado ao da habilidade.'));
  } else {
    // ---- O que a skill FAZ, com os números do seu personagem (o catálogo de ações do servidor) ----
    const cat = getCatalogoDeAcoes();
    const x = [...(cat?.spells ?? []), ...(cat?.runes ?? [])].find((a) => a.id === def.acao);
    if (x) {
      const faz = el('div', 'tip-gema-faz');
      const linha = (t, c = null) => faz.append(el('div', c, t));
      const ehCura = !!x.heals;
      const etiquetas = etiquetasDaGema(x, def);
      if (etiquetas) bloco.append(el('div', 'tip-gema-tags', etiquetas));
      // O número é o BASE do personagem (sem o bônus da gema); o da gema vem na linha "+X% ... da gema", logo abaixo.
      const d = x.danoBase ?? x.damage;
      if (x.overTime && x.damage) linha(`${d.min.toLocaleString('pt-BR')} de dano ao longo de ${x.overTime.rounds} rodadas${x.element ? ` (${nomeDoElemento(x.element)})` : ''}`, 'tip-gema-numero');
      else if (x.damage) linha(`${ehCura ? 'Cura' : 'Dano'} de ${d.min.toLocaleString('pt-BR')} a ${d.max.toLocaleString('pt-BR')}${x.element && !ehCura ? ` (${nomeDoElemento(x.element)})` : ''} por golpe`, 'tip-gema-numero');
      // O buff tem bloco próprio (números reais, duração, quem é afetado); o texto antigo do catálogo só vale sem ele.
      if (x.postura && !x.reforco) linha(x.postura);
      if (x.desafio && !x.reforco) linha(x.desafio);
      const area = x.forma?.length ? `área de ${x.forma.length} casas` : null;
      const alvo = x.cadeia ? `salta em até ${x.cadeia.targets} criaturas` : null;
      const alcance = x.range > 1 ? `alcance ${x.range} sqm` : null;
      const custo = [typeof x.mana === 'number' && x.mana ? `${x.mana} de mana` : null, x.cooldown ? `recarga ${(x.cooldown / 1000).toLocaleString('pt-BR')} s` : null, alcance, area, alvo].filter(Boolean).join(' · ');
      if (custo) linha(custo);
      // A ORIGEM do dano (a fórmula do servidor): o dano NORMAL da ficha (com wand/rod, o Magic Attack é o ataque dele).
      const escala = x.escalaCom ? ESCALA_DA_GEMA[x.escalaCom] : null;
      const a = x.armaDoDano;
      if (a?.pelaFicha) linha(`Escala com o seu dano normal (${a.danoNormal.min.toLocaleString('pt-BR')}–${a.danoNormal.max.toLocaleString('pt-BR')}: ataque da arma, perícia e level)${escala ? ` e o ${escala}` : ''}.`, 'tip-gema-ajuda');
            bloco.append(faz);
      const doBuff = blocoDoReforco(x);
      if (doBuff) bloco.append(doBuff);
    } else if (def.tags?.length && def.categoria === 'ataque') {
      // Sem entrada no catálogo (ex.: runas de campo): só a linha de tags, sem números.
      bloco.append(el('div', 'tip-gema-tags', etiquetasDaGema(null, def)));
    }
    // O dano/cura base é o da magia (level + magic level, ou melee nas físicas); a gema soma o bônus dela.
    const porNivel = def.progressao?.dano ?? def.progressao?.cura ?? 0;
    const bonus = porNivel * (nivel - 1) * mult + (porNivel ? qualidade : 0);
    if (bonus) bloco.append(el('div', 'tip-gema-efeito', `+${Math.round(bonus * 10) / 10}% de ${def.progressao?.dano ? 'dano' : 'cura'} (nível${mult !== 1 ? ', raridade' : ''}${qualidade ? ' e qualidade' : ''})`));
    if (def.castTime) bloco.append(el('div', null, `Conjuração: ${(def.castTime / 1000).toLocaleString('pt-BR')} s`));
    bloco.append(el('div', 'tip-gema-ajuda', 'Encaixe num socket de uma peça vestida para ganhar a skill.'));
  }
  return bloco;
}

/** Os sockets da peça: `[💎]─[🔹]─[ ] [🔒]` — ligados por traço, trancados com cadeado. */
function blocoDosSoquetes(sq) {
  const bloco = el('div', 'tip-soquetes');
  const max = sq.gemas?.length ?? 0;
  const itens = getItems();
  const fila = el('div', 'tip-soquetes-fila');
  const nomes = [];
  for (let i = 0; i < max; i++) {
    const g = sq.gemas[i];
    const def = g ? itens[g.id]?.gemaDef : null;
    const cls = i >= (sq.abertos ?? 0) ? 'trancado' : !g ? 'vazio' : def?.tipo === 'support' ? 'support' : 'ativa';
    const casa = el('span', `soquete ${cls}`, cls === 'trancado' ? '🔒' : cls === 'vazio' ? '' : cls === 'support' ? '🔹' : '💎');
    if (g) casa.title = `${def?.nome ?? g.id} (nível ${g.nivel})`;
    fila.append(casa);
    if (i < max - 1) fila.append(el('span', `soquete-link${sq.links?.[i] ? ' ligado' : ''}`, sq.links?.[i] ? '─' : ' '));
    if (g) nomes.push(`${def?.nome ?? g.id} ${g.nivel}`);
  }
  bloco.append(el('div', 'tip-soquetes-titulo', `Sockets ${sq.abertos ?? 0}/${max}`), fila);
  if (nomes.length) bloco.append(el('div', 'tip-soquetes-gemas', nomes.join(' · ')));
  return bloco;
}

export function fichaDeItem(id, extra = null, slot = null, peca = null) {
  // A peça do sistema de itens do PoE (só existe com ITENS_POE=1 no servidor): o balão próprio, com Prefixos e Sufixos separados.
  if (peca?.poe) {
    const metaPoe = getItems()[id];
    // Os requisitos da base (nível e atributos, como no PoE) vêm do catálogo.
    const requisitos = { nivel: metaPoe?.minLevel ?? 0, ...(metaPoe?.poe?.requisitos ?? {}) };
    const eu = getPersonagem();
    const at = eu?.derived?.atributos;
    const tem = eu ? { nivel: eu.level ?? 0, str: at?.str ?? 0, dex: at?.dex ?? 0, int: at?.int ?? 0 } : null;
    return { classe: 'tip-poe', partes: [balaoPoe(peca.poe, { nomeDaBase: metaPoe?.name ?? null, requisitos, tem })] };
  }
  const meta = comBaseDaPeca(getItems()[id], peca);
  if (!meta) return null;

  const partes = [];
  const node = { append: (...n) => partes.push(...n) };

  const essencia = ehEssencia(peca, id);

  /*
   * ---- A cor do balão da ESSÊNCIA é a da peça em que ela ENTRA ----
   *
   * "os afixos, a letra do tooltip tem que estar na cor da raridade que ele pode
   * ser aplicado também: tipo mítico, a escrita da essência tem que estar em
   * vermelho, e etc."
   *
   * A classe daqui é o que pinta o NOME no alto do balão, e ela saía do catálogo
   * — onde toda essência é "comum", porque todas compartilham um id. O nome dizia
   * "· LENDÁRIO" e saía cinza, que é a cor de dizer o contrário.
   *
   * E não é enfeite: a qualidade é METADE da regra de onde a essência entra (a
   * outra metade é o slot). Uma essência lendária não entra numa peça mítica, e a
   * cor é como isso se lê sem abrir tabela nenhuma — é a mesma pergunta que a cor
   * responde na mochila.
   *
   * A VERMELHA da fusão sai de mítico venha de onde vier, pelo mesmo motivo da
   * célula: ela é a única peça do jogo acima do topo da régua.
   */
  const raridadeDoBalao = essencia
    ? ehVermelha(peca)
      ? 'mítico'
      : peca?.raridade ?? peca?.essenciaDe ?? 'comum'
    : // A raridade do DROP; equipável sem ela é comum (ver `raridadeDaPeca`).
      raridadeDaPeca(meta, peca);
  const tier = tierOf({ rarity: raridadeDoBalao });
  // `tip-item`: o visual do balão de item (à Path of Exile — ver style.css).
  const classe = `tier-${tier.key} tip-item`;

  // ---- cabeçalho: nome à esquerda, sprite grande à direita ----
  const head = el('div', 'tip-head');
  const identidade = el('div', 'tip-id');
  identidade.append(el('b', null, titleCase(essencia ? nomeDaEssencia(peca) : meta.nomeExibicao ?? meta.name)));
  /*
   * ---- O tier da peça, ao lado do nome ----
   *
   * Quem subiu uma espada para o tier 4 precisa ver isso na espada, e não numa
   * janela à parte: a marca vai junto do nome, como no client dele.
   *
   * O número e a chance vêm prontos do servidor (`tiersView`), porque a fórmula
   * é de lá. A linha do efeito entra logo abaixo, entre os outros atributos.
   */
  // (`tier`, logo abaixo, ja e o nome da RARIDADE do item — outra coisa.)
  /*
   * O tier vem da PECA quando ela foi passada — e ela e' passada em toda tela
   * que desenha item (mochila, deposito, mercado). O mapa do personagem fica de
   * reserva: ele so' conhece as pecas VESTIDAS, e por ele a espada tier 7 na
   * mochila apareceria sem tier nenhum.
   */
  const tierDestaPeca = Number(peca?.tier) || getPersonagem()?.tiers?.[meta.id]?.tier || 0;
  if (tierDestaPeca) identidade.append(el('i', 'item-tier', `tier ${tierDestaPeca}`));
  /*
   * ---- As estrelas dos afixos, coladas no nome ----
   *
   * Elas são da INSTÂNCIA, como o tier: duas cópias da mesma spear podem ter
   * contagens diferentes, e por isso quem manda é `peca` e não o catálogo.
   *
   * Cada estrela é pintada pelo afixo dela, e a lista sai ordenada da melhor
   * para a pior — é a MESMA ordem em que as linhas de "Atributos extras" saem
   * logo abaixo, então a primeira estrela é a primeira linha. Ver
   * `estrelasDosAfixos`.
   */
  const afixosDaPeca = estrelasDosAfixos(peca?.af);
  if (afixosDaPeca.length) identidade.append(seloDeEstrelas('item-estrelas', afixosDaPeca));
  /*
   * A descrição do efeito é calculada AQUI, com a tabela do servidor.
   *
   * Ela vinha pronta de `tiersView`, que só conhece as peças VESTIDAS — e por
   * isso a espada tier 7 da mochila e o anúncio tier 4 do mercado apareciam
   * sem efeito nenhum, que é exatamente o que o dono viu sumir.
   *
   * A fórmula continua sendo UMA: os coeficientes vêm no catálogo
   * (`efeitosDeTier`), e são os mesmos que o servidor usa. O que muda é onde a
   * conta acontece — na peça que está debaixo do mouse.
   */
  const efeitoDoSlot = getCatalogo()?.efeitosDeTier?.[meta.slot] ?? null;
  const efeitoDesteTier =
    tierDestaPeca > 0 && efeitoDoSlot
      ? {
          tier: tierDestaPeca,
          nome: efeitoDoSlot.nome,
          resumo: efeitoDoSlot.resumo,
          percent:
            efeitoDoSlot.a * tierDestaPeca * tierDestaPeca + efeitoDoSlot.b * tierDestaPeca + efeitoDoSlot.c,
        }
      : null;
  const linha = [
    tier.name,
    TYPE_NAMES[meta.type] ?? meta.type,
    meta.twoHanded ? 'duas mãos' : null,
    // A Draevor Over não se distingue da Draevor normal por nenhum número: a
    // diferença é o golpe pegar em área. Ver a linha inteira logo abaixo.
    meta.area ? 'bate em área' : null,
    // Na linha do TIPO porque é o que a pessoa procura de relance quando compara
    // duas armas da mesma vocação: uma bufa magia, a outra não.
    meta.augments?.length ? 'bufa magia' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  /*
   * A essência empresta a raridade da PEÇA de onde saiu, e não a do catálogo —
   * lá ela é sempre "comum", porque o item é um só. É essa raridade que decide
   * onde ela pode entrar, então é ela que a linha tem de dizer.
   */
  identidade.append(el('em', null, essencia ? linhaDaEssencia(peca) : linha));
  // O Item Level: o da fase onde a peça caiu (libera os tiers dos adds); peça sem drop, o level do item-base.
  if (!essencia && meta.slot) identidade.append(el('em', 'item-level', `Item Level ${peca?.ilvl ?? meta.minLevel ?? 1}`));
  head.append(identidade, el('div', 'tip-art', null));
  /*
   * E o DESENHO: a silhueta do slot, a mesma que a casa vazia da ficha mostra.
   * `itemCanvas` desenharia um buraco — a essência não tem sprite própria, e é
   * daí que vinha o "a sprite não mostra às vezes".
   */
  head.lastChild.append(essencia ? arteDoSlotDaEssencia(peca, 44) : itemCanvas(id, 44));
  node.append(head);

  // ---- o que ele faz ----
  const stats = el('div', 'tip-stats');
  // Devolve a linha: quem precisa apagá-la ou pôr um `title` (ver os augments,
  // logo abaixo) precisa do nó, e não só do efeito colateral.
  const add = (text, className) => {
    if (!text) return null;
    const linha = el('div', className, text);
    stats.append(linha);
    return linha;
  };
  // Uma propriedade da base como no Path of Exile: "Armour: 8" (rótulo apagado, valor claro).
  const prop = (rotulo, valor, className) => {
    const linha = el('div', `prop ${className ?? ''}`);
    linha.append(el('span', null, `${rotulo}: `), el('b', null, valor));
    stats.append(linha);
    return linha;
  };

  const sinal = (value) => (value > 0 ? `+${value}` : String(value));
  // Cada linha sai na cor do que ela fala: ataque em vermelho, defesa em
  // aço, e tudo que é elemental na cor do próprio elemento — as mesmas do
  // combatGetTypeInfo que o jogo já usa nos números de dano.
  /*
   * ---- BATE EM ÁREA ----
   *
   * O dono: "quando clicar em um item over pra ver a receita, tem que informar que
   * bate em área".
   *
   * É a primeira linha porque é a única coisa que separa uma Draevor Over de uma
   * Draevor comum: os números de ataque, defesa e perícia são parecidos, e quem
   * compara as duas no balão não tem como adivinhar que uma acerta vinte e cinco
   * casas. Vindo depois do ataque, ela era lida como um detalhe do ataque.
   *
   * `centro` muda o que a pessoa faz com a arma: o machado e a maça explodem
   * EM VOLTA DELA (é preciso estar no meio da leva), a varinha e o bastão explodem
   * NO ALVO (é preciso mirar o bicho do meio). São duas jogadas diferentes, e é por
   * isso que o texto diz qual das duas.
   */
  if (meta.area) {
    const forma = `${meta.area.largura}x${meta.area.altura}`;
    const onde = meta.area.centro === 'alvo' ? 'em volta do alvo' : 'em volta de você';
    add(`Bate em ÁREA ${onde} — ${meta.area.casas} casas (${forma})`, 'area');
  }
  /*
   * ---- O item que BUFA UMA MAGIA ----
   *
   * O dono: "alguns itens bufam as magias, e aqui acho que tá sem ou nem tá
   * aparecendo no modal do item", com a linha da base dele:
   *
   *   Augments: (Divine Caldera -> +10% base damage).
   *
   * Sai no mesmo formato e em primeiro entre os atributos: é a coisa mais
   * incomum que um item pode ter, e a única cujo valor DEPENDE da magia que a
   * pessoa usa. Um paladino que não solta Divine Caldera não tem motivo para
   * preferir este arco, e é isso que a linha diz.
   *
   * O que o servidor ainda não aplica vem com `vale: false` e sai apagado, com
   * o porquê no `title`. Esconder seria pior: o item TEM a propriedade, e quem
   * compara com a base acharia que o nosso é outro item.
   */
  /*
   * ---- A joia que só vale VESTIDA ----
   *
   * Dez joias trocam de item ao serem equipadas, e os números abaixo são os da
   * forma vestida (o servidor já manda assim — ver `fichaVestida`). Sem esta
   * linha o balão mostraria os bônus sem dizer que eles dependem de a peça estar
   * no corpo, e quem olhasse na mochila acharia que já os tem.
   */
  if (meta.aoVestir) add('Os atributos abaixo valem com a peça VESTIDA', 'plain');
  // As moedas de uso (lapidadora, fundidora, orbes de socket) dizem o que fazem.
  if (meta.type === 'moeda' && meta.descricao) add(meta.descricao, 'plain');
  for (const aug of meta.augments ?? []) {
    const linha = add(aug.texto, aug.vale ? 'area' : 'plain');
    if (linha && !aug.vale) {
      linha.style.opacity = '0.55';
      linha.title = 'ainda não aplicado aqui — magia neste servidor não crita nem suga vida/mana';
    }
  }
  /*
   * ---- BASE ----
   * A reestruturação (29/09): o balão diz o que é do item-base — o dano (a
   * faixa sorteada no drop), o bloqueio e a defesa pelo TIPO da base (Armour,
   * Evasion, Energy Shield ou híbrida) — separado dos adds desta cópia
   * (Modificadores, abaixo). Os implícitos (perícia, crítico, resistência...)
   * saíram do jogo: o catálogo não os traz mais.
   */
  const temBase = meta.magicAttack || meta.attack || meta.defense || meta.armor || meta.evasion || meta.es || meta.range || meta.speed || meta.element || meta.wand?.element;
  if (temBase) add('Base', 'tip-sec');
  // A faixa do dano sai sem o "+" ("10–26"): é o que cada golpe sorteia.
  if (meta.attack) prop('Dano', numeroOuFaixa(meta, 'attack').replace(/^\+/, ''), 'atk');
  // O Magic Attack da wand e da rod (fixo, `armas/poder.mjs`) × a raridade da peça: é o atributo base que escala as gemas de ataque mágicas.
  // As armas físicas não mostram o "Poder da arma" (decisão do dono, 02/10).
  if (meta.magicAttack) {
    const fator = getCatalogoDeAcoes()?.poderDasArmas?.raridade?.[peca?.raridade ?? 'comum'] ?? 1;
    prop('Magic Attack', String(Math.round(meta.magicAttack * fator)), 'mana');
  }
  if (meta.defense) prop('Bloqueio', `${numeroOuFaixa(meta, 'defense').replace(/^\+/, '')}${meta.extraDefense ? ` (${sinal(meta.extraDefense)})` : ''}`, 'def');
  // A defesa sai num número só: a média da faixa sorteada, que é o que a ficha usa
  // (a faixa "5–10" parecia sinal de menos, e só o dano da arma sorteia a cada golpe).
  if (meta.armor) prop('Armour', String(meta.armor), 'def');
  if (meta.evasion) prop('Evasion', String(meta.evasion), 'def');
  if (meta.es) prop('Energy Shield', String(meta.es), 'mana');
  if (meta.range) prop('Alcance', `${meta.range} sqm`, 'plain');
  if (meta.speed) prop('Velocidade', sinal(meta.speed), 'speed');
  // Elemento é um segundo golpe, não uma fatia do primeiro: o servidor roda a
  // mesma fórmula com este valor no lugar do ataque da arma e soma o resultado.
  if (meta.element) {
    add(`+${meta.element.value} de dano de ${ELEMENT_NAMES[meta.element.type] ?? meta.element.type}`, `el-${meta.element.type}`);
  }
  if (meta.wand?.element) {
    add(`Converte o golpe em ${ELEMENT_NAMES[meta.wand.element] ?? meta.wand.element}`, `el-${meta.wand.element}`);
  }
  if (meta.container) add(`Guarda ${meta.container} itens`, 'plain');
  /*
   * Cargas e tempo de uso NÃO aparecem no balão: nenhuma peça vestida gasta carga nem tempo (só a arma de treino, que tem a barra própria),
   * então "20 minutos de uso" ou "5 cargas" anunciariam algo que não acontece.
   */
  /*
   * O que o TIER da peça dá — Onslaught, Momentum, Ruse, Amplification.
   *
   * A chance vem pronta do servidor: ela sai de um polinômio do tier, e refazer
   * essa conta aqui daria dois lugares para ela mudar. A linha só existe quando
   * a peça subiu; no tier zero não há efeito nenhum a anunciar.
   */
  if (efeitoDesteTier?.tier) {
    add(
      `${efeitoDesteTier.nome}: ${efeitoDesteTier.percent.toFixed(2).replace('.', ',')}% — ${efeitoDesteTier.resumo}`,
      'crit'
    );
  }
  if (stats.children.length) node.append(stats);

  /*
   * ---- "Atributos extras": o que esta CÓPIA tem a mais ----
   *
   * Bloco próprio, abaixo dos stats base e com cor diferente, porque ele
   * responde outra pergunta. Os de cima são "o que é uma prismatic legs"; estes
   * são "o que é ESTA prismatic legs". Misturar os dois faria o jogador achar
   * que o catálogo mudou.
   *
   * O nome de cada afixo vem do catálogo do servidor (`catalog.afixos`); sem ele
   * — conexão velha, catálogo ainda não chegou — sai o id cru, que é feio mas
   * honesto, e nunca uma linha vazia.
   */
  if (afixosDaPeca.length) {
    const extras = el('div', 'tip-afixos');
    extras.append(el('div', 'tip-afixos-titulo', essencia ? 'O atributo guardado' : 'Modificadores'));
    for (const posto of afixosDaPeca) {
      const ficha = getCatalogo()?.afixos?.[posto.id];
      // Dano em faixa ("Dano adicional 10–20"): o valor é o mínimo e o máximo é `proporcaoDoMaximo` vezes ele.
      const valor = ficha?.proporcaoDoMaximo
        ? `${posto.value}–${Math.round(posto.value * ficha.proporcaoDoMaximo)}`
        : ficha?.tipo === 'flat'
          ? `+${posto.value}`
          : `+${String(posto.value).replace('.', ',')}%`;
      const linha = el('div', 'tip-afixo');
      /*
       * O selo da linha é a estrela DELA, na cor dela, e não mais só "T3".
       *
       * Sem isto a cor no ícone fica sem explicação: o jogador vê uma estrela
       * dourada e uma azul no canto e não tem como saber qual afixo é qual. Com
       * a estrela repetida na linha, o balão amarra as duas coisas sozinho.
       *
       * O tier continua junto porque é o que diz de que fonte a peça veio, e o
       * percentual porque é literalmente a régua que escolheu a cor.
       */
      const selo = el('i', `tip-afixo-tier q${posto.q} n${posto.n}`);
      // O TIER do add: T1 (o mais fraco) a T5 (o mais forte) — liberado pelo Item Level.
      const nivelDoPosto = Number(posto.nivel ?? posto.tier) || 1;
      selo.append(el('b', 'estrela', '★'), el('span', null, ` T${nivelDoPosto}`));
      linha.append(el('span', null, `${valor} ${ficha?.nome ?? posto.id}`), selo);
      extras.append(linha);
    }
    /*
     * ---- "De qual peça essa essência veio" ----
     *
     * Pedido literal do dono. Ela é a única coisa que a essência carrega e que
     * não muda nada mecanicamente — não decide onde ela entra, não muda o bônus.
     * Serve para uma pergunta que só aparece três dias depois, com quatro
     * essências parecidas na mochila: "esta aqui, de onde veio mesmo?"
     */
    if (essencia && peca?.origem) extras.append(el('div', 'tip-afixo-origem', `saiu de ${peca.origem}`));
    /*
     * E a regra dela, escrita: a vermelha é a única que não pergunta a qualidade
     * da peça, e isso é o que faz dela o prêmio da fusão. Sem esta linha, quem a
     * tem não descobre — a lista de destinos simplesmente fica maior.
     */
    if (essencia && ehVermelha(peca)) {
      extras.append(el('div', 'tip-afixo-origem', 'entra em qualquer qualidade deste slot'));
    }
    node.append(extras);
  }

  /*
   * ---- ✨ O efeito Lendário / Supremo ----
   * Separado dos atributos: um atributo soma um número; o efeito muda uma regra.
   * O texto vem da peça (o site manda pronto) ou do catálogo do servidor
   * (`efeitosDeItem`, no hello), com os números da configuração.
   */
  const efeitoDaPeca = textoDoEfeitoDaPeca(peca);
  if (efeitoDaPeca) {
    const bloco = el('div', `tip-efeito tip-efeito-${efeitoDaPeca.tipo}`);
    bloco.append(el('div', 'tip-efeito-titulo', efeitoDaPeca.tipo === 'mitico' ? '✨ Poder Mítico' : '✨ Poder Lendário'));
    bloco.append(el('b', null, efeitoDaPeca.nome), el('div', null, efeitoDaPeca.texto));
    node.append(bloco);
  }

  // ---- a GEMA de skill: nível, XP, tags e o que faz ----
  if (meta.gemaDef) node.append(blocoDaGema(meta.gemaDef, peca?.gema, raridadeDaPeca(meta, peca)));

  // ---- sockets e links (não são afixos: não contam no limite de modificadores) ----
  if (peca?.soquetes) node.append(blocoDosSoquetes(peca.soquetes));

  // ---- quem pode usar, e onde ----
  const regras = el('div', 'tip-rules');
  const regra = (label, value, className) => {
    if (!value) return;
    const row = el('div', className);
    row.append(el('span', null, label), el('b', null, value));
    regras.append(row);
  };
  regra('Level mínimo', meta.minLevel ? String(meta.minLevel) : null);
  regra('Classe recomendada', meta.vocations?.length ? meta.vocations.map((v) => VOCATION_NAMES[v] ?? v).join(', ') : null);
  // O requisito de atributo (modelo Path of Exile): em vermelho se o personagem não cumpre.
  if (meta.requisito) {
    const falta = faltaRequisito(meta, getPersonagem());
    regra('Requer', meta.requisito.atributos.map((a) => `${meta.requisito.valor} ${NOME_DO_ATRIBUTO[a] ?? a}`).join(' ou '), falta ? 'tip-falta' : null);
  }
  regra('Slot', SLOT_NAMES[meta.slot] ?? null);
  /*
   * ---- "Fixo ao personagem" ----
   *
   * Duas origens, e as duas precisam aparecer aqui:
   *
   *   `meta.fixo`  o ITEM inteiro é preso — é o caso das exercise, venham de
   *                onde vierem;
   *   `peca.fixo`  só ESTA cópia é presa — o que sai da Recompensa Diária. A
   *                mesma pedra de tier comprada com coin continua livre, e as
   *                duas convivem na mochila em pilhas separadas.
   *
   * Por isso a resposta vem da peça quando há peça, e do catálogo quando não
   * há (o balão do chat, a vitrine, a lista de recompensas — lugares em que se
   * fala do item, e não de uma cópia).
   *
   * Fica entre as REGRAS, junto de "Level mínimo" e "Vocações", porque é a
   * mesma pergunta que elas respondem: o que dá para fazer com isto? E a
   * resposta muda a decisão de comprar — "não posso revender" é preço.
   */
  if (peca?.fixo || meta.fixo) regra('Fixo ao personagem', 'não troca nem vende', 'tip-fixo');
  /*
   * ---- O que os pergaminhos de acesso PEDEM ----
   *
   * "no modal tooltip do item tem que informar level mínimo e necessário
   *  premium."
   *
   * `minLevel` de um item é o de EQUIPAR, e um pergaminho não se equipa: ele
   * tem zero, e o balão não dizia nada. O level que importa é o da hunt do
   * outro lado da porta — e é ele que o servidor cobra ao usar (`ligarAcesso`).
   *
   * Sai como linha de REGRA, ao lado de "Level mínimo" e "Vocações", porque é
   * a mesma pergunta: quem pode usar isto? E sai do mesmo lugar de onde o
   * servidor tira o número, para os dois não divergirem.
   */
  const porta = portaDoItemDeAcesso(id);
  if (porta) {
    regra('Level mínimo', String(porta.level));
    regra('Exige', 'premium ativo');
  }
  /*
   * ---- Os imbuements DE VERDADE ----
   *
   * Aqui saia `vazio, vazio` sempre, mesmo numa peca com tres imbuements
   * dentro: a linha era montada so' com o numero de encaixes do item, e o que
   * esta' encaixado nao mora no item — mora em `character.imbuements[slot]`.
   *
   * Cada um sai numa linha propria, com o quanto falta e na COR do que ele faz.
   * O balao e' o unico lugar em que se pergunta "o que tem nesta peca?" com o
   * mouse ja em cima dela; mandar abrir o painel de imbuements para descobrir
   * era trocar uma resposta por uma viagem.
   */
  /*
   * ---- O que a PEÇA tem manda mais que o que o catálogo diz ----
   *
   * A guarda era só `meta.imbuementSlots`, e por isso a Wand of Vortex do dono
   * — com um `strike-1` de 20h dentro, gravado no banco — não mostrava
   * imbuement nenhum no balão: o item não declara encaixe no catálogo
   * (`imbuementSlots: undefined`), e a linha inteira era pulada. O mesmo valia
   * na mochila e no chat, porque os dois passam por aqui.
   *
   * Quem tem a resposta é a peça. Se há imbuement ativo dentro dela, ele é
   * mostrado — o catálogo pode estar incompleto, mas o que está gravado na peça
   * aconteceu de verdade e o jogador pagou por isso.
   *
   * O número de encaixes desenhados passa a ser o maior entre o que o item
   * declara e o que a peça carrega: uma peça de três encaixes com um cheio
   * continua mostrando "cheio, vazio, vazio", e uma peça sem encaixe declarado
   * mostra só o que tem.
   */
  const imbuDaPeca = (peca?.imbu ?? []).filter((imbued) => (imbued?.left ?? 0) > 0);
  if (meta.imbuementSlots || imbuDaPeca.length) {
    /*
     * ---- O que ha' DENTRO DESTA peca ----
     *
     * A lista vinha de `imbuements[slot]`, isto e', do slot de equipamento. Uma
     * arma na mochila nao esta em slot nenhum, e para ela o balao sempre
     * escrevia "vazio, vazio, vazio" — mesmo com tres imbuements pagos dentro.
     *
     * Desde que o imbuement passou a morar no ITEM (ver `imbuementsDoItem`, no
     * servidor), a resposta certa esta em `imbuementsPorItem[id]`, e vale para
     * a peca vestida e para a que esta na mochila do mesmo jeito. O `slot` fica
     * de reserva para um estado gravado antes da mudanca.
     */
    const personagem = getPersonagem();
    /*
     * Da PECA primeiro, pelo mesmo motivo do tier: duas copias do mesmo item
     * tem imbuements diferentes, e `imbuementsPorItem` responde por id — com
     * duas imbuidas, ele so' pode devolver uma das duas.
     */
    const ativos = imbuDaPeca.length
      ? imbuDaPeca
      : personagem?.imbuementsPorItem?.[String(id)] ??
        (slot ? personagem?.imbuements?.[slot] ?? [] : []);
    const catalogo = getCatalogo()?.imbuements ?? [];

    /*
     * ---- Uma linha so', com o que esta e o que falta ----
     *
     * Eram duas: os cheios em linhas proprias e, embaixo, uma linha "Imbuements
     * vazio, vazio" com o resto. Lido de cima para baixo isso da' a impressao de
     * que a peca tem dois conjuntos de encaixes.
     *
     * O dono pediu o formato do servidor dele: `Imbuements: strike 19h, vazio,
     * vazio` — os tres encaixes na ordem, numa linha, o que esta' preenchido com
     * nome e relogio e o que nao esta' com a palavra vazio.
     */
    const linha = el('div', 'imbue');
    linha.append(el('span', null, 'Imbuements'));
    const encaixes = el('b', 'tip-imbuements');
    const encaixesDesenhados = Math.max(meta.imbuementSlots ?? 0, ativos.length);
    for (let i = 0; i < encaixesDesenhados; i++) {
      const imbuido = ativos[i];
      if (i) encaixes.append(el('i', 'tip-imbue-virgula', ', '));
      if (!imbuido) {
        encaixes.append(el('i', 'tip-imbue-vazio', 'vazio'));
        continue;
      }
      const entrada = catalogo.find((entry) => entry.id === imbuido.id);
      const nome = [imbuido.name ?? entrada?.name ?? imbuido.id, entrada?.subgroup].filter(Boolean).join(' ');
      const cheio = el('i', `tip-imbue-cheio ${corDoImbuement(entrada)}`);
      cheio.append(el('span', null, nome));
      cheio.append(el('em', null, restanteDoImbuement(imbuido.left ?? 0)));
      encaixes.append(cheio);
    }
    linha.append(encaixes);
    regras.append(linha);
  }
  regra('Peso', `${meta.weight} oz`);
  // A chance conta de onde saiu a raridade — sem ela o rótulo parece chute.
  // Só a chance que é chance (0 a 1): 57 itens vieram da captura com números maiores que 1 (136, 10, 2,5...), que não são uma probabilidade — e saíam como "13600%".
  if (meta.dropChance > 0 && meta.dropChance <= 1) {
    const pct = meta.dropChance >= 0.01 ? (meta.dropChance * 100).toFixed(1) : (meta.dropChance * 100).toFixed(2);
    regra('Chance de drop', `${pct.replace('.', ',')}%`);
  }
  if (regras.children.length) node.append(regras);

  // ---- e o que ele muda em relação ao que você já usa ----
  const contra = comparacaoComOEquipado(meta, slot, peca);
  if (contra) node.append(contra);

  /*
   * ---- O que pode sair desta bag ----
   *
   * "ao passar o mouse das bags — seja desire, covet, primal, draevor ou draevor
   *  bag set — tem que mostrar no modal 'itens que podem vir'."
   *
   * A lista é a MESMA que o servidor sorteia (`SACOS_DE_PREMIO`, mandada no
   * catálogo como `sacos`), então ela não pode discordar do que de fato sai.
   *
   * Desenho e nome, em duas colunas: só o desenho obrigaria a reconhecer 25
   * peças de set por 32 pixels, e só o nome faria uma lista de texto num balão
   * que é todo figura. O sorteio é de peso igual — uma entre as N —, e isso
   * está dito no título, porque é a informação que decide se vale abrir.
   */
  /*
   * ---- O que este Buff Power faz, no balão dele ----
   *
   * "nos próprios Buff Power o item tem que mostrar no modal do tooltip dele o
   *  que ele faz e etc."
   *
   * O balão mostrava peso e nada mais: eles não se equipam, não têm dano nem
   * slot, e a descrição do items.xml não chega aqui. Um item de 200 coins que
   * não diz o que faz é um item que ninguém clica.
   *
   * As três coisas que decidem o clique, nesta ordem: o que ele DÁ, o que cada
   * hora CUSTA e quanto ainda sobra. O custo vem antes do relógio de propósito
   * — é a informação que o dono pediu para destacar, porque comprar o item não
   * é ligar o bônus.
   *
   * Tudo sai de `efeitos.buffPower`, que o servidor manda no personagem: a
   * mesma lista que a loja e a ficha leem, e por isso nenhuma das três pode
   * anunciar um preço que as outras desmintam.
   */
  const doBuff = (getPersonagem()?.efeitos?.buffPower ?? []).find((linha) => linha.item === meta.id);
  if (doBuff) {
    const caixa = el('div', 'tip-buff');
    caixa.append(el('b', 'tip-buff-titulo', 'Ao usar, por 1 hora'));
    caixa.append(el('span', 'tip-buff-bonus', doBuff.resumo));

    const custo = el('div', 'tip-buff-custo');
    custo.append(el('em', null, 'cada hora custa'));
    custo.append(
      el(
        'b',
        null,
        doBuff.custo?.moeda === 'coins'
          ? `${doBuff.custo.quanto} Draevor Coins`
          : `${(doBuff.custo?.quanto ?? 0).toLocaleString('pt-BR')} de ouro`
      )
    );
    caixa.append(custo);

    caixa.append(
      el(
        'span',
        'tip-buff-regra',
        'O item NÃO some: fica na mochila para sempre e o que se gasta é o preço. ' +
          'Usar de novo soma mais uma hora, até dez acumuladas.'
      )
    );
    if (doBuff.restante > 0) {
      caixa.append(el('span', 'tip-buff-relogio', `Ligado agora — ${tempoCurto(Math.round(doBuff.restante / 1000))} restantes.`));
    }
    node.append(caixa);
  }

  const sorteio = getCatalogo()?.sacos?.[meta.id];
  if (sorteio?.length) {
    const caixa = el('div', 'tip-saco');
    caixa.append(el('b', 'tip-saco-titulo', `Itens que podem vir — uma entre ${sorteio.length}`));
    const grade = el('div', 'tip-saco-grade');
    for (const premio of sorteio) {
      const linha = el('div', 'tip-saco-item');
      try {
        linha.append(itemCanvas(premio, 18));
      } catch {
        /* sem sprite a linha continua, só com o nome */
      }
      linha.append(el('span', null, titleCase(getItems()[premio]?.name ?? `item ${premio}`)));
      grade.append(linha);
    }
    caixa.append(grade);
    node.append(caixa);
  }

  // ---- preço de NPC ----
  const prices = el('div', 'tip-prices');
  /*
   * As duas pontas do balcão, ditas do ponto de vista do JOGADOR.
   *
   * "NPC paga" e "NPC vende" obrigavam a virar a frase de cabeça para saber de
   * que lado do balcão o número estava — e as duas começam igual, então bater o
   * olho não bastava. `sell` é o que você RECEBE ao vender, `buy` é o que você
   * PAGA para comprar.
   */
  if (meta.sell) prices.append(el('span', null, `NPC compra por ${meta.sell.toLocaleString('pt-BR')}g`));
  if (meta.buy) prices.append(el('span', null, `você paga ${meta.buy.toLocaleString('pt-BR')}g no NPC`));
  if (prices.children.length) node.append(prices);

  if (extra) node.append(el('div', 'tip-extra', extra));

  return { classe, partes };
}

/** Encosta o tooltip no elemento sem sair da janela. */
function place(holder) {
  /*
   * No telefone o par (o balão e o do que está vestido, lado a lado) é mais
   * largo que a tela: fica só o principal, dentro das bordas. A comparação
   * continua no computador, onde cabe.
   */
  if (ehTelefone() && nodeVs) nodeVs.hidden = true;
  /*
   * ---- A ficha do ITEM aberta pelo DEDO: compacta, centrada, com X ----
   *
   * Report de 01/10: no celular a ficha do item (o balão alto que rola) ocupava a tela inteira
   * menos 8px de cada lado — e, como o toque DENTRO dele não fecha (é para rolar), sobrava só
   * essa borda para sair. Agora ela tem largura e altura limitadas (CSS `.tip-movel`), fica no
   * meio deixando a tela em volta à vista (tocar fora fecha, como antes), rola por dentro, e tem
   * um X fixo no alto, de 44px, que fecha com um toque. No computador nada muda.
   */
  if (abertoPeloToque && node.classList.contains('tip-item')) {
    node.classList.remove('duas-colunas', 'rolavel');
    node.classList.add('tip-movel');
    const fechar = el('button', 'tip-fechar', '✕');
    fechar.type = 'button';
    fechar.setAttribute('aria-label', 'Fechar');
    fechar.onclick = (evento) => {
      evento.preventDefault();
      evento.stopPropagation();
      hide();
    };
    node.prepend(fechar);
    node.scrollTop = 0;
    posicionar(holder);
    holderPosicionado = holder;
    return;
  }
  const anchor = holder.getBoundingClientRect();
  /*
   * ---- O balão de item mais ALTO que a tela ----
   * Com "Ao equipar", poder e requisitos ele passa dos 900px — mais que um
   * desktop de 768 e mais que o dobro do celular deitado. Primeiro, havendo
   * largura, duas colunas (o cabeçalho ocupa as duas); se nem assim couber,
   * ele rola por dentro (no toque, o dedo rola sem fechar).
   */
  node.classList.remove('duas-colunas', 'rolavel');
  // Mede no canto (0,0), com a largura toda: no lugar antigo, perto da borda direita, o texto
  // quebrava em mais linhas depois de medido e o balão passava da borda de baixo.
  node.style.left = '0px';
  node.style.top = '0px';
  const alturaLivre = window.innerHeight - 16;
  if (node.classList.contains('tip-item') && node.getBoundingClientRect().height > alturaLivre) {
    if (window.innerWidth >= 600) node.classList.add('duas-colunas');
    // Colunas com altura presa vazam para o LADO: sem caber em duas, volta a uma coluna que rola.
    if (node.getBoundingClientRect().height > alturaLivre) {
      node.classList.remove('duas-colunas');
      node.classList.add('rolavel');
    }
  }
  posicionar(holder);
  holderPosicionado = holder;
}

/*
 * A fonte de algum símbolo (★, →, ✨) pode chegar um instante DEPOIS do
 * primeiro desenho, e o balão crescer umas linhas já posicionado — no celular
 * em pé isso o empurrava para fora da borda de baixo. Mudou de tamanho aberto:
 * rola (se passou da tela) e reposiciona.
 */
let holderPosicionado = null;
function aoMudarDeTamanho() {
  if (!node || node.hidden || !holderPosicionado?.isConnected) return;
  if (node.classList.contains('tip-item') && !node.classList.contains('rolavel') && !node.classList.contains('tip-movel') && node.getBoundingClientRect().height > window.innerHeight - 16) {
    node.classList.remove('duas-colunas');
    node.classList.add('rolavel');
  }
  posicionar(holderPosicionado);
}

/** Põe o balão (e o do vestido, ao lado) perto da peça, dentro da janela. */
function posicionar(holder) {
  const box = node.getBoundingClientRect();
  if (node.classList.contains('tip-movel')) {
    // No meio da tela (a altura máxima e as áreas seguras do aparelho moram no CSS).
    node.style.left = `${Math.max(8, Math.round((window.innerWidth - box.width) / 2))}px`;
    node.style.top = `${Math.max(8, Math.round((window.innerHeight - box.height) / 2))}px`;
    return;
  }
  const anchor = holder.getBoundingClientRect();

  /*
   * Com o balao de comparacao aberto, o par ocupa a largura dos dois mais a
   * folga, e e' o PAR que precisa caber na janela: encostar so o da direita na
   * borda jogava o "Equipado" para fora da tela.
   */
  const comparando = nodeVs && !nodeVs.hidden;
  const larguraVs = comparando ? nodeVs.getBoundingClientRect().width + FOLGA_ENTRE_BALOES : 0;
  const largura = box.width + larguraVs;

  const esquerdaDoPar = Math.max(8, Math.min(anchor.left - larguraVs, window.innerWidth - largura - 8));
  const acima = anchor.top - box.height - 8;
  // Sem espaço em cima nem embaixo (balão alto, tela baixa): o mais alto que couber.
  const topo = acima > 8 ? acima : Math.max(8, Math.min(anchor.bottom + 8, window.innerHeight - box.height - 8));

  node.style.left = `${esquerdaDoPar + larguraVs}px`;
  node.style.top = `${topo}px`;
  if (comparando) {
    nodeVs.style.left = `${esquerdaDoPar}px`;
    // Alinhados pela base: as duas fichas raramente tem a mesma altura, e o
    // topo desencontrado fazia parecer que faltava conteudo numa delas.
    const alturaVs = nodeVs.getBoundingClientRect().height;
    nodeVs.style.top = `${Math.max(8, topo + box.height - alturaVs)}px`;
  }
}

/** Espaco entre a ficha vestida e a olhada. */
const FOLGA_ENTRE_BALOES = 10;
