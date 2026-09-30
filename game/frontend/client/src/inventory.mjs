// Inventário: slots de equipamento com os PNGs do client, arrastar e soltar
// para equipar, menu de contexto por item e a loot pouch com venda rápida.
import { itemCanvas, itemSprite } from './sprites.mjs';
import { abrirSoquetes, temSoquetes } from './soquetes.mjs';
// O desenho da bolsa numa definição só, com a reserva. Ver o módulo.
import { ITEM_DA_BOSS_POUCH, ITEM_DA_BOSS_POUCH_RESERVA, ITEM_DA_STORE_INBOX } from '/packages/shared/src/boss-pouch.mjs';
import { pedirQuantidade, controleDeQuantidade } from './social.mjs';
import { seloPremium, seloBlessings } from './hud.mjs';
import {
  windowBody, setVisible, toggleWindow, fecharAoClicarFora, atalhosDaCaixa, botaoNoCabecalho,
} from './windows.mjs';
import { tipFor, tipTexto, tipPanel, previaDaMagia, classeDaRaridade, raridadeDaPeca, estrelasDosAfixos, seloDeEstrelas, marcaDeItem, numerosDoItem as ganhosDoItem, ehEssencia, ehVermelha } from './tooltip.mjs';
import { chatEscrevendo, inserirNoChat } from './chat.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

// Mesma disposição do client: mão direita à esquerda da tela, como no Tibia.
//
// A última fileira do client só tem as botas no meio, e os dois cantos ficavam
// vazios. É onde os selos de premium e de blessings entram — um embaixo do
// anel, o outro embaixo da munição — sem a janela crescer nada.
const SLOT_LAYOUT = ['neck', 'head', 'backpack', 'weapon', 'body', 'shield', 'ring', 'legs', 'ammo', '@premium', 'feet', '@blessings'];
/*
 * ---- Os dois slots que se trocam sozinhos ----
 *
 * A lista de prioridades da minibot dele, dentro do jogo: cada linha é uma peça
 * (ou "desequipar") com faixas de vida e de mana, e vale a PRIMEIRA que bate.
 *
 * Os nomes e o teto vivem no servidor (`joias.mjs`) — aqui só se desenham. Se
 * o teto mudar lá, esta tela continua certa: ela manda o que o jogador montou e
 * redesenha o que voltou no estado, que é a lista já limpa.
 */
const SLOTS_COM_REGRA = ['neck', 'ring'];
const MAX_REGRAS_NA_TELA = 8;

const SLOT_LABELS = {
  neck: 'colar', head: 'elmo', backpack: 'mochila', weapon: 'mão direita', body: 'armadura',
  shield: 'mão esquerda', ring: 'anel', legs: 'pernas', ammo: 'munição', feet: 'botas',
};
// Placeholders originais do client (data/images/game/slots).
const SLOT_ART = {
  neck: 'neck', head: 'head', backpack: 'back', weapon: 'right-hand', body: 'body',
  shield: 'left-hand', ring: 'finger', legs: 'legs', ammo: 'ammo', feet: 'feet',
};

let ctx = null; // { state, send, notice }

/*
 * Em que página da bolsa de loot se está.
 *
 * Mora aqui, e não no estado do jogo: é de quem está olhando esta aba agora, e
 * não do personagem. Duas abas do mesmo char podem estar em páginas diferentes,
 * e nenhuma das duas precisa contar isso ao servidor.
 */
let paginaDaBolsa = 0;
/* A mesma coisa para a Boss Pouch, que também tem mil vagas em páginas de cem. */
let paginaDaBossPouch = 0;
/*
 * ---- E a CABEÇA dela também sobrevive aos retratos ----
 *
 * É a mesma lição que a mochila já custou, com o mesmo sintoma: "esse botão
 * fica piscando igual o carai; aí tem que ficar apertando igual doido tentando
 * acertar o time". Ver a nota de `cabecaDaMochila`.
 *
 * Esta janela é redesenhada junto com a mochila e a bolsa de loot — a chave que
 * as governa é uma só (`bagKey`, em main.mjs) —, então caçando ela se refaz
 * várias vezes por segundo por causa do loot que cai na MOCHILA, mesmo com a
 * Boss Pouch parada. Refazendo o `body` inteiro, o `pointerdown` do jogador
 * pega um botão que o retrato seguinte joga fora e o `pointerup` cai noutro:
 * sem os dois no mesmo nó, o navegador não dispara `click`.
 *
 * O que muda a cada retrato é a GRADE, e é só ela que é refeita.
 */
let cabecaDaBolsaDeBoss = null;

/*
 * ---- Ninguém refaz a grade debaixo de um ARRASTO ----
 *
 * Report do Sabido: "arrastar o item buga o mouse e não dá mais pra clicar na
 * tela, tem que ficar atualizando a tela pra voltar o cursor e a função de
 * cliques ao normal".
 *
 * Na caçada cada loot muda a chave da mochila, e as grades são refeitas do zero
 * (`body.innerHTML = ''`). Se a peça que está sendo arrastada some no meio do
 * gesto, o arrasto do navegador perde o elemento de onde saiu: o `dragend` não
 * chega a lugar nenhum e o Chrome/Brave fica com a sessão de arrasto aberta —
 * cursor preso e clique morto até recarregar a página.
 *
 * Então, com um arrasto em curso (qualquer um: da mochila, da barra, do chão),
 * as quatro grades ANOTAM que precisam ser refeitas e esperam. O fim do arrasto
 * é ouvido no `window`, e não na célula — a célula é justamente o que pode ter
 * sumido —, e é ele que faz o redesenho que ficou esperando, com o loot novo.
 *
 * O vigia existe para o dia em que o fim nunca chegar (soltar fora da janela
 * num navegador que não avisa): passados quinze segundos a grade volta a se
 * redesenhar sozinha, em vez de ficar congelada.
 */
const VIGIA_DO_ARRASTO_MS = 15_000;
let arrastoEmCurso = false;
let vigiaDoArrasto = null;
const redesenhosAdiados = new Set();

function comecouArrasto(evento) {
  arrastoEmCurso = true;
  clearTimeout(vigiaDoArrasto);
  vigiaDoArrasto = setTimeout(terminouArrasto, VIGIA_DO_ARRASTO_MS);
  /*
   * Arrasto CANCELADO no próprio `dragstart` (o mapa faz isso quando não há
   * peça no chão debaixo do cursor) não termina com `dragend` — nunca começou.
   * Este ouvinte roda antes de quem cancela, então a pergunta fica para depois.
   */
  setTimeout(() => {
    if (evento?.defaultPrevented) terminouArrasto();
  }, 0);
}

function terminouArrasto() {
  clearTimeout(vigiaDoArrasto);
  vigiaDoArrasto = null;
  if (!arrastoEmCurso) return;
  arrastoEmCurso = false;
  const pendentes = [...redesenhosAdiados];
  redesenhosAdiados.clear();
  for (const redesenhar of pendentes) redesenhar();
}

/** Devolve true quando a grade tem de esperar o arrasto acabar. */
function esperaOArrasto(redesenhar) {
  if (!arrastoEmCurso) return false;
  redesenhosAdiados.add(redesenhar);
  return true;
}

if (typeof addEventListener === 'function') {
  addEventListener('dragstart', comecouArrasto, true);
  // Depois do `drop` do alvo: quem soltou manda o pedido com a grade que viu.
  for (const tipo of ['dragend', 'drop']) addEventListener(tipo, () => setTimeout(terminouArrasto, 0), true);
  addEventListener('blur', () => setTimeout(terminouArrasto, 0));
}

/** Para os testes: o prazo do vigia e o gatilho dele, sem esperar quinze segundos. */
export const _arrasto = { vigiaMs: VIGIA_DO_ARRASTO_MS, venceuOVigia: terminouArrasto };

export function initInventory(context) {
  ctx = context;
  document.addEventListener('click', () => closeMenu());
  document.addEventListener('contextmenu', (event) => {
    if (!event.target.closest('[data-item]')) closeMenu();
  });
}

// ---------- menu de contexto ----------

/* Exportado: o bloco da guilda no menu do jogador (social.mjs) fecha o menu. */
export function closeMenu() {
  const menu = document.getElementById('context-menu');
  menu.hidden = true;
  menu.innerHTML = '';
}

export function openMenu(event, entries) {
  event.preventDefault();
  event.stopPropagation();

  const menu = document.getElementById('context-menu');
  menu.innerHTML = '';
  for (const entry of entries) {
    if (!entry) continue;
    /* Um nó pronto (o bloco da guilda, em `social.mjs`) entra como está. */
    if (entry.nodeType === 1) {
      menu.append(entry);
      continue;
    }
    if (entry.divider) {
      menu.append(el('hr'));
      continue;
    }
    /*
     * ---- A CABEÇA do menu ----
     *
     * Era um botão desligado com o nome dentro — cinza, do mesmo tamanho das
     * opções, e clicável na aparência. Lia-se como "esta opção não está
     * disponível" quando o que ela diz é "este menu é sobre isto".
     *
     * Agora é um cabeçalho de verdade: o desenho da coisa à esquerda, o nome em
     * cima e a linha de contexto embaixo (o level de quem é gente, o tipo de um
     * item). Ele responde "de quem é este menu?" antes de a pessoa ler a
     * primeira opção.
     */
    if (entry.cabeca) {
      // `classe` carrega a raridade do item (`tier-lendario`), que é quem
      // define o `--tier` que o nome lê. Sem ela, cai no verde do tema.
      const cabeca = el('header', `menu-cabeca${entry.classe ? ` ${entry.classe}` : ''}`);
      if (entry.arte) cabeca.append(entry.arte);
      const texto = el('div', 'menu-cabeca-texto');
      texto.append(el('b', null, entry.cabeca));
      if (entry.sub) texto.append(el('em', null, entry.sub));
      /*
       * A terceira linha, quando ela existe: hoje é a guilda de quem se clicou,
       * com o brasão junto (ver `menuDeJogador` em `social.mjs`). Vem como NÓ e
       * não como texto porque ela traz um desenho dentro — e por isso quem monta
       * o menu decide o que ela é, e este arquivo só a coloca no lugar.
       */
      if (entry.linha) texto.append(entry.linha);
      cabeca.append(texto);
      /* O selo fica na ponta direita, do outro lado do desenho da esquerda. */
      if (entry.selo) cabeca.append(entry.selo);
      menu.append(cabeca);
      continue;
    }
    const button = el('button', entry.danger ? 'danger' : null, entry.label);
    button.disabled = !!entry.disabled;
    // A dica do porquê, quando a opção está apagada: "apagada e sem explicação"
    // é a única coisa pior do que a opção não existir.
    if (entry.porque) button.title = entry.porque;
    button.onclick = () => {
      closeMenu();
      entry.action?.();
    };
    menu.append(button);
  }

  menu.hidden = false;
  // Mantém o menu dentro da janela mesmo abrindo perto da borda.
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - width - 8)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - height - 8)}px`;
}

/*
 * A entrada de "subir tier", ou uma lista vazia.
 *
 * Devolve lista (e não `null`) para poder espalhar com `...` no meio do menu:
 * são duas linhas quando dá para subir — o preço e o que a peça vai ganhar — e
 * nenhuma quando não dá.
 */
function tierUpNoMenu(id, from) {
  const { state, send } = ctx;
  if (from !== 'equipment') return [];
  const custo = state.character.proximoTier?.[id];
  if (!custo) return [];

  const ouro = custo.ouro >= 1e6 ? `${Math.round(custo.ouro / 1e6)}kk` : custo.ouro.toLocaleString('pt-BR');
  const tenho = contarNaMochila(ITEM_TIER_UP);
  return [
    {
      label: `Subir para o tier ${custo.tier} — ${custo.cores}× Tier Up e ${ouro}`,
      disabled: tenho < custo.cores,
      action: () => confirmarTier(id, custo),
    },
  ];
}

/** Como a cabeça do menu chama cada slot, em uma palavra. */
const TIPO_CURTO = {
  weapon: 'arma', shield: 'escudo', head: 'elmo', body: 'armadura', legs: 'pernas',
  feet: 'botas', neck: 'amuleto', ring: 'anel', ammo: 'munição', backpack: 'mochila',
};

/** A pedra do Tier Up — a `Draevor Tier UP` do servidor, o mesmo id do `tiers.mjs`. */
const ITEM_TIER_UP = 50051;

/*
 * ---- A marca de tier em cima do item ----
 *
 * Uma peça no tier 6 tem de se distinguir de uma igual no tier 0 SEM abrir o
 * balão: na grade da mochila os dois desenhos são o mesmo pixel por pixel, e
 * quem tem duas espadas precisa saber qual é qual antes de arrastar.
 *
 * O selo vai no canto de cima à esquerda — o de baixo à direita já é da
 * quantidade da pilha — e brilha: é a única coisa da grade que se conquista, e
 * o brilho é o que a separa de um número qualquer.
 *
 * O tier vem do servidor (`character.tiers`), que já manda o mapa pronto.
 */
/*
 * ---- Os selos da PEÇA: tier e imbuement ----
 *
 * Isto lia `character.tiers[itemId]` — um mapa por id, que hoje só traz as
 * peças VESTIDAS. Desde que tier e imbuement passaram a morar na peça (ver
 * `EXTRAS_DA_PECA`, no servidor), a espada tier 3 guardada na mochila ficava
 * sem selo nenhum: parecia igual à cópia limpa ao lado dela.
 *
 * Agora lê a própria entrada — `peca.tier` e `peca.imbu` viajam no estado
 * junto com o item, então vale na mochila, na bolsa, no depósito e no corpo,
 * sem cada tela precisar saber de onde veio.
 */
export function selarTier(cell, peca, from = null) {
  // Aceita o id cru também: chamadas antigas passavam só o número.
  const entrada = typeof peca === 'object' && peca ? peca : null;
  const tier = Math.floor(Number(entrada?.tier) || 0);
  if (tier > 0) {
    /*
     * ---- O selo do tier é o DESENHO DA BASE ----
     *
     * Era um numerozinho num balão dourado desenhado em CSS. O client dele tem
     * a arte pronta — `data/images/game/items/tier-N.png`, dez desenhos de 9x8
     * —, e é ela que o jogador reconhece: o mesmo canto, o mesmo formato, a
     * mesma leitura de relance.
     *
     * Acima de 10 não há arte, e aí o número volta: melhor um selo diferente do
     * que nenhum.
     */
    cell.classList.add('com-tier');
    if (tier <= 10) {
      const arte = document.createElement('img');
      arte.className = 'selo-tier-arte';
      arte.src = `/client/assets/ui/tier/tier-${tier}.png`;
      arte.alt = `tier ${tier}`;
      // Sem arte por qualquer motivo, cai no selo escrito de sempre.
      arte.onerror = () => {
        arte.replaceWith(el('i', 'selo-tier', String(tier)));
      };
      cell.append(arte);
    } else {
      cell.append(el('i', 'selo-tier', String(tier)));
    }
  }

  const imbu = (entrada?.imbu ?? []).filter((x) => (x?.left ?? 0) > 0);
  if (imbu.length) {
    cell.classList.add('com-imbu');
    const horas = Math.max(...imbu.map((x) => x.left)) / 3_600_000;
    /*
     * ---- E o relógio parado, dito na própria legenda ----
     *
     * Report do Kemm: "não gastar imbuiment se estiver desequipado". Ele já não
     * gasta — `tickImbuements` percorre só as peças do corpo, e só dentro de uma
     * caçada — e mesmo assim o report existe, porque a tela nunca disse isso.
     * Um número de horas parado ao lado de um item guardado é indistinguível de
     * um número que está correndo: quem tem dúvida só pode reportar.
     *
     * A frase muda com o lugar da peça — vestida diz que corre, guardada diz que
     * não corre — porque é a diferença entre as duas que ele queria saber.
     */
    const legenda =
      `${imbu.length} imbuement(s), o maior com ${horas.toFixed(1)}h. ` +
      (from === 'equipment'
        ? 'O tempo só corre com a peça vestida e você caçando.'
        : 'Guardada, o tempo NÃO corre — ele só anda com a peça vestida, caçando.');
    /*
     * O mesmo desenho do selo de tier, no azul — ver `.selo-imbu-arte`. O
     * número dentro da arte é a QUANTIDADE de imbuements, que é o que este selo
     * sempre disse; acima de 10 não há desenho, e o selo escrito volta.
     */
    if (imbu.length <= 10) {
      const arte = document.createElement('img');
      arte.className = 'selo-imbu-arte';
      arte.src = `/client/assets/ui/tier/imbu-${imbu.length}.png`;
      arte.alt = legenda;
      arte.title = legenda;
      arte.onerror = () => {
        const escrito = el('i', 'selo-imbu', String(imbu.length));
        escrito.title = legenda;
        arte.replaceWith(escrito);
      };
      cell.append(arte);
    } else {
      const selo = el('i', 'selo-imbu', String(imbu.length));
      selo.title = legenda;
      cell.append(selo);
    }
  }
  return cell;
}

/** Quantos deste item estão na mochila e na bolsa, somando as pilhas. */
function contarNaMochila(id) {
  const { state } = ctx;
  let total = 0;
  for (const lista of [state.character.inventory ?? [], state.character.pouch ?? []]) {
    for (const entrada of lista) if (entrada.id === id) total += entrada.count;
  }
  return total;
}

/*
 * ---- A MIRA da pedra do Tier Up ----
 *
 * Clicou na pedra, o cursor vira cruz: o próximo clique numa peça é o alvo. É o
 * "usar com" do Tibia, e é o gesto que a mão já sabe — clicar no item e depois
 * no que ele afeta.
 *
 * A lista (`escolherPecaParaTier`) continua existindo no botão direito, para
 * quem prefere ler os preços lado a lado antes de decidir. Duas portas para o
 * mesmo quarto, e cada uma serve a um jeito de pensar.
 *
 * O estado é um só e mora no módulo: só existe uma mira por vez, e a segunda
 * chamada cancela a primeira em vez de empilhar.
 */
let mirando = false;

/** Liga a cruz e ensina a saída na mesma frase. */
function mirarComTierUp() {
  if (mirando) return pararMira();
  mirando = true;
  document.body.classList.add('mirando-tier');
  ctx.notice?.('Clique na peça que vai subir de tier — Esc cancela.');
  document.addEventListener('keydown', escCancela, true);
}

function pararMira() {
  mirando = false;
  document.body.classList.remove('mirando-tier');
  document.removeEventListener('keydown', escCancela, true);
}

const escCancela = (evento) => {
  if (evento.key !== 'Escape') return;
  evento.preventDefault();
  pararMira();
};

/**
 * O clique de quem está mirando. Devolve `true` quando ele foi consumido —
 * e aí quem chamou não faz o que faria normalmente com aquele clique.
 */
function cliqueDaMira(itemId) {
  if (!mirando) return false;
  pararMira();
  const custo = ctx.state.character.proximoTier?.[itemId];
  const nome = ctx.state.items[itemId]?.name ?? 'essa peça';
  if (!custo) {
    ctx.notice?.(`${nome} não aceita tier — vista uma arma, um elmo, uma armadura ou botas.`);
    return true;
  }
  confirmarTier(itemId, custo);
  return true;
}

/*
 * ---- A confirmação, SEMPRE ----
 *
 * Uma subida de tier consome pedras e milhões de ouro e não tem volta. O dono
 * pediu a pergunta em todos os caminhos — a mira, a lista e o menu da peça — e
 * ela é a mesma nos três: o que vai sair, o que vai entrar, e duas saídas.
 */
function confirmarTier(itemId, custo) {
  const { state, send } = ctx;
  const meta = state.items[itemId];
  const atual = state.character.tiers?.[itemId]?.tier ?? 0;
  const tenho = contarNaMochila(ITEM_TIER_UP);
  const ouro = state.character.gold ?? 0;
  const dá = tenho >= custo.cores && ouro >= custo.ouro;

  const back = el('div', 'confirm-back');
  const box = el('div', 'confirm-box');
  box.append(el('h3', null, 'Subir o tier'));

  const arte = itemCanvas(Number(itemId), 48);
  if (arte) box.append(arte);
  box.append(el('p', 'confirm-item', `${meta?.name ?? 'peça'} — tier ${atual} → ${custo.tier}`));

  const linhas = el('div', 'confirm-rows');
  const linha = (rotulo, valor, classe) => {
    const nó = el('div', classe);
    nó.append(el('span', null, rotulo), el('b', null, valor));
    linhas.append(nó);
  };
  linha('Tier Up', `− ${custo.cores} (você tem ${tenho})`, tenho >= custo.cores ? 'cost' : 'cost falta');
  linha('Ouro', `− ${custo.ouro.toLocaleString('pt-BR')}`, ouro >= custo.ouro ? 'cost' : 'cost falta');
  linha('Fica com', `${(ouro - custo.ouro).toLocaleString('pt-BR')} de ouro`, 'after');
  box.append(linhas);

  if (!dá) box.append(el('p', 'confirm-short', 'Falta material para esta subida.'));

  const acoes = el('div', 'confirm-actions');
  const cancelar = el('button', 'ghost', 'Cancelar');
  cancelar.onclick = () => back.remove();
  const confirmar = el('button', null, `Subir para o tier ${custo.tier}`);
  confirmar.disabled = !dá;
  confirmar.onclick = () => {
    back.remove();
    send({ t: 'tierUp', itemId: Number(itemId) });
  };
  acoes.append(cancelar, confirmar);
  box.append(acoes);

  back.append(box);
  document.body.append(back);
  // Clicar fora e o Esc fecham, como em toda caixa do jogo.
  back.onclick = (evento) => {
    if (evento.target === back) back.remove();
  };
  (dá ? confirmar : cancelar).focus();
}

/*
 * ---- Em qual peça usar a pedra ----
 *
 * A lista sai do servidor: `proximoTier` só traz as peças VESTIDAS que aceitam
 * tier, cada uma com o preço do próximo degrau. A tela não repete a regra — se
 * um dia a perna passar a aceitar tier, ela aparece aqui sozinha.
 *
 * Cada linha diz o que custa e se dá para pagar AGORA. Uma linha apagada com o
 * preço à vista é mais útil que uma linha escondida: ela responde "quanto falta"
 * sem obrigar a fechar a janela e ir contar na mochila.
 */
function escolherPecaParaTier() {
  const { state, send } = ctx;
  const pecas = Object.entries(state.character.proximoTier ?? {});
  const tenho = contarNaMochila(ITEM_TIER_UP);
  const ouroNaMao = state.character.gold ?? 0;

  ctx.openModal?.('Subir o tier', (body) => {
    if (!pecas.length) {
      body.append(el('p', 'empty', 'Nenhuma peça vestida aceita tier. Vista uma arma, um elmo, uma armadura ou botas.'));
      return;
    }
    body.append(
      el('p', 'shop-note', `Você tem ${tenho} Tier Up e ${(ouroNaMao).toLocaleString('pt-BR')} de ouro.`)
    );

    const grade = el('div', 'tier-escolha');
    for (const [itemId, custo] of pecas) {
      const meta = state.items[itemId];
      const atual = state.character.tiers?.[itemId];
      const dá = tenho >= custo.cores && ouroNaMao >= custo.ouro;

      const linha = el('button', `tier-peca${dá ? '' : ' nao-da'}`);
      linha.type = 'button';
      linha.disabled = !dá;
      const arte = itemCanvas(Number(itemId), 32);
      if (arte) linha.append(arte);

      const texto = el('div', 'tier-peca-texto');
      texto.append(el('b', null, meta?.name ?? `item ${itemId}`));
      texto.append(
        el('em', null, `tier ${atual?.tier ?? 0} → ${custo.tier} · ${custo.cores}× Tier Up e ${(custo.ouro / 1e6).toFixed(0)}kk`)
      );
      linha.append(texto);

      linha.onclick = () => {
        ctx.closeModal?.();
        // A pergunta vem sempre — ver `confirmarTier`.
        confirmarTier(Number(itemId), custo);
      };
      grade.append(linha);
    }
    body.append(grade);
  });
}

/**
 * ---- Os SOCKETS desenhados na própria peça (modelo Path of Exile) ----
 * Uma fileira pequena no pé da célula: bolinha cheia = gema (azul = support),
 * vazia = socket aberto, apagada = bloqueado; o traço entre duas = link.
 * Com `aoTocar` (a peça vestida), a fileira é um botão: abre a janela de sockets.
 */
function selarSoquetes(cell, peca, aoTocar = null) {
  const sq = peca?.soquetes;
  if (!sq?.gemas?.length) return;
  const itens = ctx.state.items;
  const fila = el(aoTocar ? 'button' : 'span', `selo-soquetes${aoTocar ? ' tocavel' : ''}`);
  if (aoTocar) {
    fila.type = 'button';
    fila.title = 'Sockets — encaixar gemas';
    const abrir = (event) => {
      event.preventDefault();
      event.stopPropagation();
      aoTocar();
    };
    fila.addEventListener('click', abrir);
    fila.addEventListener('contextmenu', abrir);
  }
  sq.gemas.forEach((g, i) => {
    const tipo = i >= (sq.abertos ?? 0) ? 'trancado' : !g ? 'vazio' : itens[g.id]?.gemaDef?.tipo === 'support' ? 'support' : 'ativa';
    fila.append(el('i', `sq ${tipo}`));
    if (i < sq.gemas.length - 1) fila.append(el('i', `lk${sq.links?.[i] ? ' ligado' : ''}`));
  });
  cell.append(fila);
}

/** Opções de um item, iguais em qualquer lista onde ele apareça. */
/*
 * ---- O BOTÃO DIREITO USA; O CTRL+DIREITO ABRE O MENU ----
 *
 * É a ordem do client dele, e ela é a certa por frequência: numa sessão se abre
 * uma dúzia de sacos e se bebe uma dúzia de poções, e se muda a regra de venda
 * de um item talvez uma vez por semana. O gesto de um toque tem de ser o que se
 * faz o tempo todo.
 *
 * O menu não sumiu — ele ganhou o Ctrl, que é onde o client dele põe o "olhar".
 *
 * ---- E o MENU é só do Ctrl ----
 *
 * Houve um meio-termo aqui: item sem uso próprio (uma espada, um troféu) caía
 * no menu, para o botão não ficar morto em cima da maior parte da mochila. O
 * dono viu e mandou tirar — na base dele o direito NUNCA abre menu, e um botão
 * que às vezes usa e às vezes abre uma lista é um botão que não se aprende.
 *
 * Então o direito faz uma coisa só: o que a peça faz. Não fazendo nada, não
 * acontece nada, e quem quer a lista segura o Ctrl.
 */
function acaoDoDireito(event, id, { from, pilha = null, alvo = null, peca = null }) {
  if (event.ctrlKey) return itemMenu(event, id, { from, pilha, alvo, peca });
  // O menu do navegador não aparece em cima da mochila em nenhum caso.
  event.preventDefault();
  const meta = ctx.state.items[id];
  /*
   * ---- O mesmo gesto abre e fecha ----
   *
   * Era `setVisible(true)`: o direito na mochila abria, e o direito na mochila
   * de novo abria outra vez — ou seja, não fazia nada visível. No client dele o
   * botão direito num container aberto o FECHA, e é o mesmo botão. Fechar sem
   * ter de procurar o x da janela é metade da utilidade do gesto.
   */
  if (meta?.container && from === 'equipment') {
    event.preventDefault();
    return void toggleWindow('container');
  }
  /*
   * `usavel` é carimbo do SERVIDOR (`consumiveis.mjs`), e é ele que separa o
   * saco de prêmio e a poção de boost de uma health potion qualquer. A tela não
   * adivinha pelo tipo do item — se adivinhasse, o direito falharia na maioria
   * das poções e o gesto perderia a confiança.
   */
  /*
   * `pedirUso` pergunta antes quando o item COBRA para ser usado (os Buff
   * Power); para todo o resto ele manda a mensagem direto, como esta linha
   * sempre fez. Ver `pedirUso`, em `panels.mjs`.
   */
  // Da Store Inbox o servidor precisa saber de onde: é lá que ele gasta (`usarDaStoreInbox`).
  const onde = from === 'storeInbox' ? 'storeInbox' : undefined;
  if (meta?.usavel) return void (ctx.pedirUso ? ctx.pedirUso(id, onde) : ctx.send({ t: 'usar', id, onde }));
}

/*
 * ---- Shift + clique esquerdo põe a peça na frase ----
 *
 * Com a caixa do chat aberta e o cursor nela, o shift+clique num item escreve
 * `[[item:id]]` onde o cursor está — e quem lê vê o nome na cor da raridade,
 * com o balão inteiro no mouse. Ver `textoComItens` em tooltip.mjs.
 *
 * ---- Por que no `mousedown`, e não no `click` ----
 *
 * Apertar o botão em cima de qualquer coisa TIRA o foco da caixa de texto, e
 * isso acontece antes de o `click` existir. No `click` a pergunta "o chat está
 * escrevendo?" já seria sempre não. O `preventDefault` no `mousedown` é o que
 * impede a caixa de perder o foco — sem ele a frase continuaria lá, mas o
 * cursor não.
 *
 * O `click` ainda vem depois e faria o gesto de sempre (dividir a pilha, levar
 * para a bolsa), então a marca abaixo o cancela.
 */
let mandadoParaOChat = 0;

/*
 * O `afixoDe` viaja junto porque a ESSÊNCIA não tem nome no catálogo: o id é um
 * só, e de que slot o afixo saiu é o que separa "essência vermelha · arma" de
 * "essência vermelha · bota". Ver a nota do quinto campo, em tooltip.mjs.
 */
function levarParaOChat(event, id, tier = 0, imbu = null, af = null, afixoDe = null, raridade = null) {
  if (event.button !== 0 || !event.shiftKey) return false;
  if (!chatEscrevendo()) return false;
  event.preventDefault();
  event.stopPropagation();
  if (inserirNoChat(marcaDeItem(id, tier, imbu, af, afixoDe, raridade))) mandadoParaOChat = Date.now();
  return true;
}

/** O clique que veio logo depois de um shift+clique mandado para o chat. */
const doChat = () => Date.now() - mandadoParaOChat < 400;

/*
 * `pilha` e `alvo` dizem QUAL cópia o dedo apontou — a célula clicada e a
 * assinatura dela (tier e afixos). Eles chegavam a `acaoDoDireito` e paravam
 * ali: aqui dentro eram nomes livres, e "Equipar" pelo menu estourava com
 * ReferenceError em vez de equipar. Ver `alvoDaPeca`.
 */
function itemMenu(event, id, { from, pilha = null, alvo = null, peca = null }) {
  const { state, send } = ctx;
  const meta = state.items[id];
  /*
   * ---- "Fixo no personagem" é da PEÇA, e não do item ----
   *
   * As exercise são presas inteiras, e o catálogo responde por elas
   * (`state.items[id].fixo`). O que sai da Recompensa Diária é preso por
   * CÓPIA: a pedra de tier do diário não sai do personagem, e a comprada com
   * coin sai — as duas com o mesmo id, em pilhas separadas na mochila.
   *
   * Por isso a resposta é a soma das duas perguntas. Quem recusa de verdade
   * continua sendo o servidor (`presos.mjs`); isto existe para a pessoa saber
   * ANTES de clicar.
   */
  const listaDaqui =
    from === 'pouch' ? state.character.pouch
    : from === 'storeInbox' ? state.character.storeInbox
    : from === 'bossPouch' ? state.character.bossPouch
    : state.character.inventory;
  const daPeca = Number.isFinite(alvo?.indice)
    ? (listaDaqui ?? [])[alvo.indice]
    : (listaDaqui ?? []).find((entrada) => entrada?.id === id);
  const presaNoPersonagem = !!meta?.fixo || !!daPeca?.fixo;
  const rules = state.character.itemRules ?? { noLoot: [], noSell: [] };
  const noLoot = rules.noLoot.includes(id);
  const noSell = rules.noSell.includes(id);
  /*
   * ---- O menu da BOSS POUCH é curto, e isso não é enfeite ----
   *
   * Quase toda linha deste menu manda um comando que lê a MOCHILA: equipar,
   * usar, vender ao NPC, pôr na troca e jogar no chão todos procuram a peça em
   * `character.inventory` (e a venda, na bolsa de loot). A Boss Pouch é uma
   * terceira lista, e nenhum desses caminhos a conhece.
   *
   * Deixá-las acesas aqui não daria erro — daria coisa PIOR: clicar "Vender" na
   * espada que está na bolsa venderia a cópia que está na mochila, com a
   * mensagem de sucesso e tudo. O engano seria invisível, e é exatamente a
   * classe de defeito que o dono pediu para não haver ("cuidado pra não haver
   * bugs de duplicação/clonagem de item ou perdas").
   *
   * Então só ficam os três gestos que sabem ler a bolsa: tirar de lá, as regras
   * por item (que são do ITEM e não da lista) e destruir — este último porque
   * `destroy` passou a aceitar `from: 'bossPouch'`. Vender em lote continua
   * existindo no botão "Vender" da janela, que é o caminho certo.
   */
  /*
   * A STORE INBOX (15/09) é outra lista que nenhum desses caminhos conhece: ela
   * entra na mesma regra, e com menos ainda — nem Destruir, que o servidor não
   * sabe fazer nela. Só a saída para a mochila e as regras do item.
   */
  const naStoreInbox = from === 'storeInbox';
  const naBolsaDeBoss = from === 'bossPouch' || naStoreInbox;

  openMenu(event, [
    // De quem é este menu: o desenho, o nome e o tipo da peça.
    {
      cabeca: meta?.name ?? `item ${id}`,
      sub: [raridadeDaPeca(meta, peca), TIPO_CURTO[meta?.slot] ?? meta?.type, from === 'equipment' ? 'vestido' : null]
        .filter(Boolean)
        .join(' · '),
      // A mesma cor do balão: dourado no lendário, violeta no épico, e assim
      // por diante. A palavra vai junto no `sub` — cor sozinha não é rótulo.
      classe: classeDaRaridade(meta, peca),
      arte: itemCanvas(id, 28),
    },
    { divider: true },
    /*
     * "Usar" primeiro, e só para quem tem efeito.
     *
     * `usavel` vem carimbado pelo servidor (`consumiveis.mjs`) porque o tipo do
     * item não distingue: a Exp Potion e uma health potion são as duas
     * `liquids`, e só uma delas faz alguma coisa neste servidor. Oferecer "Usar"
     * em tudo que parece poção seria ensinar um gesto que falha na maioria das
     * vezes.
     *
     * Em primeiro lugar na lista porque é o que se faz com o item: quem clicou
     * com o botão direito numa poção quer usá-la, não protegê-la da venda.
     */
    /*
     * A pedra do Tier Up se usa NELA, e não pela peça.
     *
     * Subir tier também está no menu da peça vestida (`tierUpNoMenu`), e é o
     * caminho de quem está olhando a espada. Este é o de quem está olhando a
     * pedra — "tenho isto aqui, para que serve?" — e é o gesto mais natural dos
     * dois: clicou no item, ele pergunta em qual peça usar.
     */
    id === ITEM_TIER_UP && !naBolsaDeBoss
      ? { label: 'Escolher a peça numa lista', action: () => escolherPecaParaTier() }
      : null,
    /* =====================================================================
     * A FERRAMENTA APONTADA: o machete
     *
     * "ou usar da mochila ao clicar com botao direito nela: fica um crosshair e
     *  eu tenho que selecionar onde eu quero cortar."
     *
     * Quem diz que este item é uma ferramenta é o SERVIDOR, no catálogo de
     * ações (`FERRAMENTAS`, em `actions.mjs`) — e não um id escrito aqui. É a
     * mesma regra que decide se ele pode ir num slot de suporte, e com uma
     * lista só a segunda ferramenta aparece nos dois lugares de graça.
     *
     * Só na Caça Online: fora dela não há casa para apontar, e o servidor
     * recusaria. Oferecer um gesto que dá erro é pior do que não oferecê-lo.
     * ===================================================================== */
    (() => {
      const ferramenta = (ctx.state?.actionCatalog?.items ?? []).find(
        (entry) => entry.ferramenta && entry.itemId === id,
      );
      if (!ferramenta || !ctx.state?.hunt?.manual || naBolsaDeBoss) return null;
      return {
        label: `Usar ${meta?.name ?? ferramenta.name} numa casa`,
        action: () => ctx.armarMiraDeItem?.(id, meta?.name ?? ferramenta.name),
      };
    })(),
    // Da Store Inbox também: o servidor usa as cópias de lá sem tirar (`usarDaStoreInbox`).
    meta?.usavel && (!naBolsaDeBoss || naStoreInbox)
      ? {
          label: `Usar ${meta.name}`,
          action: () => {
            const onde = naStoreInbox ? 'storeInbox' : undefined;
            return ctx.pedirUso ? ctx.pedirUso(id, onde) : send({ t: 'usar', id, onde });
          },
        }
      : null,
    meta?.slot && from !== 'equipment' && !naBolsaDeBoss
      ? { label: `Equipar ${meta.name}`, action: () => send({ t: 'equip', id, pilha, alvo }) }
      : null,
    from === 'equipment' ? { label: 'Desequipar', action: () => send({ t: 'unequip', slot: meta.slot }) } : null,
    // Os sockets da peça vestida: encaixar/tirar gemas de skill (ver soquetes.mjs).
    from === 'equipment' && temSoquetes(peca)
      ? { label: `Sockets (${peca.soquetes.gemas.filter(Boolean).length}/${peca.soquetes.gemas.length} gemas)`, action: () => abrirSoquetes(ctx, meta.slot) }
      : null,
    /*
     * ---- Subir o tier ----
     *
     * Só na peça VESTIDA, e é o servidor que diz quais aceitam: ele manda
     * `proximoTier` com o preço de cada uma, e a ausência de uma peça nesse mapa
     * é a resposta "esta aqui não sobe". A tela não repete a regra — se um dia a
     * perna passar a aceitar tier, este menu descobre sozinho.
     *
     * O preço vai NO RÓTULO porque ele muda a cada degrau: "3 Tier Up e 9kk" é o
     * que decide o clique, e escondê-lo atrás da confirmação faria a pessoa
     * abrir a caixa só para saber quanto custa.
     */
    ...tierUpNoMenu(id, from),
    meta?.container && from === 'equipment'
      ? { label: 'Abrir ou fechar a mochila', action: () => toggleWindow('container') }
      : null,
    /*
     * Só a VOLTA. A bolsa de loot não recebe nada da mão — ela se esvazia
     * sozinha na venda rápida, e o que fosse posto ali estaria a um tique de
     * ser vendido. Ver `movePouch`, no servidor, que é quem recusa de verdade.
     */
    // Com `pilha`/`alvo`: a peça estrelada tocada vai INTEIRA (ver `moverBolsa`).
    from === 'pouch' ? { label: 'Mover para a mochila', action: () => send({ t: 'pouch', id, count: 9999, to: 'bag', pilha, alvo }) } : null,
    /*
     * ---- Guardar no depósito, direto ----
     *
     * "eu tenho que conseguir tirar as coisas da loot pouch, seja pra mochila,
     * seja pro depósito."
     *
     * Só aparece com uma caixa ABERTA, porque é ela que diz PARA ONDE: sem
     * caixa escolhida a linha teria de perguntar em qual das dezesseis, e a
     * pergunta já está respondida na tela que a pessoa deixou aberta. Fora do
     * depósito ela some em vez de aparecer apagada — não é uma regra a
     * aprender, é um destino que ainda não existe.
     *
     * `onde` diz de qual lista a peça sai: com uma cópia do mesmo id na mochila
     * e outra na bolsa, sem ele o servidor levava a da mochila.
     */
    (from === 'pouch' || from === 'bag') && ctx.caixaDoDepositoAberta?.() != null
      ? {
          label: `Guardar no depósito`,
          action: () =>
            send({
              t: 'depot',
              action: 'store',
              id,
              count: state.items[id]?.stackable ? 9999 : 1,
              caixa: ctx.caixaDoDepositoAberta(),
              alvo: { ...(alvo ?? { indice: pilha }), onde: from === 'pouch' ? 'pouch' : 'bag' },
            }),
        }
      : null,
    /*
     * A saída da Boss Pouch — a peça APONTADA, e não todas as cópias do id.
     *
     * A linha da bolsa de loot leva `count: 9999` porque lá o que interessa é
     * esvaziar; aqui a bolsa guarda peça boa de boss, e duas espadas iguais com
     * tiers diferentes são duas coisas. `alvo` diz qual delas a mão apontou.
     */
    naBolsaDeBoss
      ? {
          label: 'Mover para a mochila',
          action: () =>
            send({
              t: naStoreInbox ? 'storeInbox' : 'bossPouch',
              mover: { id, count: meta?.stackable ? 9999 : 1, pilha, alvo },
            }),
        }
      : null,
    /*
     * ---- Jogar no chão ----
     *
     * Só onde há alguém decidindo o passo: a cidade e a Caça Online. Na Caça
     * Automática o boneco anda a rota sozinho, e a peça cairia numa casa que
     * nem o dono volta a visitar — por isso a linha some ali em vez de
     * aparecer apagada: não é uma regra a aprender, é um lugar onde o gesto
     * não existe.
     *
     * Ela cai na casa em que o personagem está, que é o que o arrastar do
     * client faz quando se solta em cima do próprio boneco. Quem recusa de
     * verdade — longe demais, casa cheia, peça fixa — é o servidor.
     */
    podeLargarAgora() && from !== 'equipment' && !naBolsaDeBoss && !presaNoPersonagem
      ? {
          label: 'Jogar no chão',
          // Da bolsa de loot o índice é o da BOLSA: `onde` avisa o servidor de qual lista ele é.
          action: () => largarNoChao(id, from, { ...(alvo ?? { indice: pilha }), onde: from === 'pouch' ? 'pouch' : 'bag' }),
        }
      : null,
    { divider: true },
    {
      label: noLoot ? 'Voltar a coletar' : 'Não coletar',
      action: () => send({ t: 'itemRule', rule: 'noLoot', id }),
    },
    {
      label: noSell ? 'Liberar venda' : 'Não vender (proteger)',
      action: () => send({ t: 'itemRule', rule: 'noSell', id }),
    },
    { divider: true },
    /*
     * ---- Vende A PEÇA CLICADA, e não todas as cópias ----
     *
     * Aqui ia `count: 9999` sempre. Numa pilha de carne isso é o certo — quem
     * vende carne vende a pilha. Numa peça que NÃO empilha é um desastre, e foi
     * um report: dois life rings, um com afixo que a jogadora queria guardar,
     * um clique para vender o outro, e o NPC levou os dois. A conta fechava, o
     * ouro entrava, e nada acusava que a peça boa tinha ido junto.
     *
     * Então o que não empilha sai UM, e sai o que a mão apontou (`alvo`), pelo
     * mesmo caminho que o equipar usa. O que empilha continua saindo inteiro.
     */
    /*
     * Na bolsa a venda é APAGADA, e não sumida: esconder a linha faria a regra
     * parecer defeito ("a bolsa não vende?"), quando ela vende — pelo botão,
     * em lote, com a marcação e as duas confirmações. O rótulo diz onde.
     */
    naStoreInbox
      ? { label: 'Leve para a mochila para vender', disabled: true }
      : naBolsaDeBoss
      ? { label: 'Vender pelo botão "Vender", aqui em cima', disabled: true }
      : meta?.sell
      ? {
          label: `Vender ao NPC — ${meta.sell.toLocaleString('pt-BR')}g${meta.stackable ? ' cada' : ''}`,
          disabled: noSell,
          action: () =>
            send({
              t: 'sell',
              id,
              count: meta.stackable ? 9999 : 1,
              pilha,
              alvo,
              from: from === 'pouch' ? 'pouch' : 'bag',
            }),
        }
      : { label: 'Nenhum NPC compra este item', disabled: true },
    /*
     * Pôr na troca só aparece quando existe uma troca aberta.
     *
     * Um item permanente no menu que diz "você não está trocando" seria ruído
     * em todos os outros cliques — e são quase todos.
     */
    state.troca && from !== 'equipment' && !naBolsaDeBoss
      ? { divider: true }
      : null,
    /*
     * Item fixo aparece APAGADO, e não sumido.
     *
     * Esconder a linha faria a regra parecer um defeito: o jogador procura "Pôr
     * na troca" no menu de uma arma, não acha, e conclui que a troca quebrou.
     * Apagada com o motivo escrito, ele aprende a regra no lugar onde tentou
     * usá-la. Quem recusa de verdade é o servidor (`trade.mjs`).
     */
    /*
     * E a troca também não alcança a Boss Pouch: `trade.mjs` tira da mochila e
     * da bolsa de loot. A linha some em vez de aparecer apagada porque aqui
     * não é uma regra a aprender — é um lugar onde o gesto não existe, como o
     * "Jogar no chão" na Caça Automática.
     */
    state.troca && from !== 'equipment' && !naBolsaDeBoss
      ? presaNoPersonagem
        ? { label: 'Fixa no personagem — não entra na troca', disabled: true }
        : {
            label: `Pôr na troca com ${state.troca.com}`,
            action: () => {
              const quanto = quantosTenho(id, from, { soLivres: true });
              pedirQuantidade({
                id,
                max: quanto,
                titulo: 'Quantos oferecer?',
                aoConfirmar: (count) => send({ t: 'trade', action: 'offer', id, count }),
              });
            },
          }
      : null,
    { divider: true },
    from !== 'equipment' && !naStoreInbox
      ? { label: 'Destruir item', danger: true, action: () => destroyItem(id, from) }
      : null,
  ]);
}

/*
 * ---- Dá para largar coisa aqui? ----
 *
 * Na cidade (sem caçada) e na Caça Online. A mesma pergunta que o servidor
 * faz em `chaoDoPersonagem`; repetida aqui só para o menu não oferecer um
 * gesto que ia falhar.
 */
const podeLargarAgora = () => !ctx.state?.hunt || !!ctx.state.hunt.manual;

/** A casa em que o boneco está, nos dois lugares em que ele anda pela mão. */
const minhaCasa = () => ctx.state.hunt?.player ?? ctx.state.city?.player ?? null;

/*
 * Larga a peça. Pilha grande pergunta QUANTAS antes.
 *
 * A pergunta existe porque o engano é caro nos dois sentidos: largar as 500
 * moedas quando se queria largar uma, e largar uma quando se queria esvaziar
 * a mochila. É a mesma caixa que a troca usa.
 */
function largarNoChao(id, from, alvo = null) {
  const casa = minhaCasa();
  if (!casa) return void ctx.toast?.('não dá para largar nada aqui');
  const quanto = quantosTenho(id, from, { soLivres: true });
  // `alvo`: a cópia apontada, para largar ESTA peça (com seus afixos) e não outra igual.
  if (quanto <= 1) return void ctx.send({ t: 'largar', id, count: 1, x: casa.x, y: casa.y, alvo });
  pedirQuantidade({
    id,
    max: quanto,
    titulo: 'Quantas jogar no chão?',
    aoConfirmar: (count) => ctx.send({ t: 'largar', id, count, x: casa.x, y: casa.y, alvo }),
  });
}

/**
 * Quantos desse item existem no lugar de onde ele foi clicado.
 *
 * `soLivres` deixa de fora as cópias presas ao personagem. Quem PASSA a peça
 * adiante (o chão, a troca) pergunta com ela; quem só conta (a régua de
 * separar pilha) pergunta sem.
 *
 * Isto não é a trava — a trava é do servidor (`presos.mjs`). É para a régua
 * não oferecer 3 quando só 1 pode sair: a pessoa escolheria 3, o servidor
 * recusaria, e ela concluiria que o jogo quebrou.
 */
function quantosTenho(id, from, { soLivres = false } = {}) {
  const lista =
    from === 'pouch'
      ? ctx.state.character.pouch
      : from === 'bossPouch'
        ? ctx.state.character.bossPouch
        : ctx.state.character.inventory;
  const presoInteiro = !!ctx.state.items?.[id]?.fixo;
  return (lista ?? [])
    .filter((entry) => entry.id === id && !(soLivres && (entry.fixo || presoInteiro)))
    .reduce((total, entry) => total + entry.count, 0);
}

/*
 * ---- "Não perguntar de novo" é POR ITEM ----
 *
 * Era uma chave só, ligada ou desligada: marcar a caixinha ao jogar fora um
 * osso calava a confirmação para TUDO, inclusive para o anel que caiu de um
 * boss. Uma preferência tomada num item barato virava risco no item caro, e não
 * havia como desfazer sem saber o nome da chave.
 *
 * Agora a marca guarda os IDS dos itens que dispensam a pergunta. Marcar em
 * "bolt" cala a pergunta de bolt, e só dela.
 *
 * Fica no navegador porque é preferência, e não progresso: quem entra de outra
 * máquina começa com a pergunta ligada, que é o lado seguro do engano.
 */
const SKIP_DESTROY_ASK = 'draevor:destroy-noask';
const DESTROY_SEM_PERGUNTA = 'draevor:destroy-noask-itens';

/** Os ids que já dispensam a confirmação. */
function semPerguntaDeDestruir() {
  /*
   * A chave ANTIGA, se existir, é apagada em vez de virar "vale para tudo".
   *
   * Quem a tinha ligada pediu silêncio quando silêncio era tudo ou nada;
   * transformar isso em "nunca mais pergunte por item nenhum" seria decidir por
   * ele no sentido perigoso. Voltar a perguntar é o engano barato.
   */
  if (localStorage.getItem(SKIP_DESTROY_ASK)) localStorage.removeItem(SKIP_DESTROY_ASK);
  try {
    const cru = JSON.parse(localStorage.getItem(DESTROY_SEM_PERGUNTA) ?? '[]');
    return new Set(Array.isArray(cru) ? cru.map(Number) : []);
  } catch {
    // Guardado torto (mão humana, versão antiga): recomeça perguntando.
    return new Set();
  }
}

function calarPerguntaDe(id) {
  const marcados = semPerguntaDeDestruir();
  marcados.add(Number(id));
  localStorage.setItem(DESTROY_SEM_PERGUNTA, JSON.stringify([...marcados]));
}

/*
 * ---- Destruir, escolhendo QUANTOS ----
 *
 * A caixa destruía exatamente o que tivesse recebido, e do menu do botão direito
 * isso era sempre 1: para jogar fora 87 piercing bolts eram 87 confirmações.
 *
 * Agora, quando há mais de um do item no lugar de onde ele foi clicado, a mesma
 * régua da caixa de "quantos?" entra aqui dentro (`controleDeQuantidade`), e o
 * nome no meio da caixa acompanha a régua enquanto ela é arrastada — o texto
 * nunca diz um número e o botão apaga outro.
 *
 * A régua começa no que veio, e não no máximo. Do menu vem 1; da lixeira vem a
 * pilha que foi arrastada. Destruir é para sempre, então quem não mexer em nada
 * destrói o mínimo — subir é um arrasto, e "Tudo" está a um clique.
 */
function destroyItem(id, from, count = 1) {
  const { state, send } = ctx;
  // A Store Inbox não destrói nada: `destroy` cairia na cópia da MOCHILA. Ver `naStoreInbox`.
  if (from === 'storeInbox') return void ctx.notice?.('Leve da Store Inbox para a mochila primeiro.');
  const meta = state.items[id];
  const tenho = Math.max(1, quantosTenho(id, from));
  const pedido = Math.min(tenho, Math.max(1, Math.floor(count) || 1));
  /*
   * `from` viaja inteiro para as TRES listas.
   *
   * Era `from === 'pouch' ? 'pouch' : 'bag'`, e com a Boss Pouch isso deixou de
   * ser inofensivo: destruir uma peca da bolsa apagaria a copia que estivesse na
   * MOCHILA, com a caixa de confirmacao dizendo o nome certo. O servidor conhece
   * as tres (ver o `destroy`, em index.mjs); quem tinha de parar de adivinhar
   * era esta linha.
   */
  const de = from === 'pouch' || from === 'bossPouch' ? from : 'bag';
  const drop = (quantos) => send({ t: 'destroy', id, count: quantos, from: de });

  // Um só não tem o que escolher: a régua seria um enfeite travado no 1.
  const escolher = tenho > 1;

  /*
   * ---- Pilha SEMPRE pergunta, mesmo marcada ----
   *
   * A marca calava a pergunta e mandava destruir a quantia que tivesse vindo —
   * do menu, 1. Marcar num item empilhável virava um destruidor de uma unidade
   * por clique: exatamente o contrário do que a marca promete, e sem jeito de
   * escolher a quantidade, que é a razão de a caixa existir para pilha.
   *
   * A marca vale para o item de UNIDADE, que é o caso em que a caixa não tem o
   * que perguntar — ela só confirma. Havendo mais de um, a pergunta volta,
   * porque a quantidade é uma escolha e escolha não se pula.
   *
   * Por isso a caixinha também só aparece quando não há o que escolher: prometer
   * silêncio que não vai acontecer é pior do que não oferecer.
   */
  if (!escolher && semPerguntaDeDestruir().has(Number(id))) return drop(pedido);

  const back = el('div', 'confirm-back');
  const box = el('div', `confirm-box${escolher ? ' quantia-box' : ''}`);
  box.append(el('h3', null, 'Destruir item'));
  box.append(itemCanvas(id, 40));

  const nome = meta?.name ?? `item ${id}`;
  const rotulo = el('p', 'confirm-item', `${pedido > 1 ? `${pedido}x ` : ''}${nome}`);
  box.append(rotulo);
  box.append(el('p', 'confirm-short', 'Você tem certeza? O item some para sempre.'));

  const quantia = escolher
    ? controleDeQuantidade({
        id,
        max: tenho,
        valor: pedido,
        aoMudar: (quantos) => (rotulo.textContent = `${quantos > 1 ? `${quantos}x ` : ''}${nome}`),
      })
    : null;
  if (quantia) box.append(quantia.node);

  /*
   * A caixinha só existe para item de unidade. Ver o bloco do `escolher`.
   *
   * O rótulo diz o NOME: a marca vale só para ele, e isso tem de estar escrito
   * antes de ela ser marcada, não depois.
   */
  let skipInput = null;
  if (!escolher) {
    const skip = el('label', 'switch');
    skipInput = document.createElement('input');
    skipInput.type = 'checkbox';
    skip.append(skipInput, document.createTextNode(`Não perguntar novamente para ${nome}`));
    box.append(skip);
  }

  const actions = el('div', 'confirm-actions');
  const cancel = el('button', 'ghost', 'Cancelar');
  cancel.onclick = () => back.remove();
  const confirm = el('button', 'danger', 'Destruir');
  confirm.onclick = () => {
    const quantos = quantia ? quantia.ler() : pedido;
    if (skipInput?.checked) calarPerguntaDe(id);
    back.remove();
    drop(quantos);
  };
  actions.append(cancel, confirm);
  box.append(actions);

  // Enter destrói, Escape cancela — o campo de número é onde a mão está.
  atalhosDaCaixa(back, { confirmar: () => confirm.click(), fechar: () => back.remove() });

  back.append(box);
  fecharAoClicarFora(back, () => back.remove());
  document.body.append(back);
  // O foco vai para o botão, e não para a régua: a caixa pergunta "tem
  // certeza?", e a resposta padrão não pode ser mexer no número.
  confirm.focus();
}

// ---------- arrastar e soltar ----------

/*
 * ---- Arrastar uma pilha pergunta QUANTOS ----
 *
 * Arrastar movia a pilha inteira (`count: 9999`), e por isso arrastar era um
 * gesto de tudo ou nada: para separar 20 de 137 gold coins não havia caminho
 * nenhum. É a caixa do client — régua, campo e OK —, e ela só aparece quando há
 * mais de um: com um item só, perguntar é um clique a mais para nada.
 */
function moverComQuantidade(id, de, para, pilha = null, alvo = null) {
  const lista = de === 'pouch' ? ctx.state.character.pouch : ctx.state.character.inventory;
  /*
   * O índice da célula que a mão pegou viaja com a carga do arrasto e vai junto
   * no pedido: é ele que diz ao servidor QUAL cópia sai. Ver `tirarPecas`.
   */
  const dePilha = Number.isInteger(Number(pilha)) ? Number(pilha) : null;

  /*
   * ---- Peça que não empilha vai inteira, sem perguntar ----
   *
   * A conta aqui somava TODAS as pilhas do mesmo id, e para uma peça que não
   * empilha isso é somar peças distintas: três `leather boots` com afixos
   * diferentes viravam "de 3" na régua, como se fossem três unidades de uma
   * coisa só. Perguntar "quantas?" para algo que existe uma por vez não tem
   * resposta certa, e a que o jogador desse moveria as cópias erradas.
   *
   * Uma peça não empilhável só pode significar a que está debaixo da mão.
   */
  const meta = ctx.state.items?.[id];
  const posto = dePilha != null ? (lista ?? [])[dePilha] : null;
  if (!meta?.stackable) {
    if (posto && posto.id !== id) return;
    ctx.send({ t: 'pouch', id, count: posto?.count ?? 1, to: para, pilha: dePilha, alvo });
    return;
  }

  const tem = (lista ?? []).filter((entry) => entry.id === id).reduce((total, entry) => total + entry.count, 0);
  if (tem <= 0) return;
  pedirQuantidade({
    id,
    max: tem,
    titulo: 'Quanto vai para a mochila?',
    aoConfirmar: (count) => ctx.send({ t: 'pouch', id, count, to: para, pilha: dePilha, alvo }),
  });
}

/*
 * ---- Arrastar leva a PILHA, e o shift pergunta quanto ----
 *
 * O arrasto levava um item por vez, sempre: mover 500 gold do deposito para a
 * mochila era quinhentos arrastos. Ninguem faz isso — o jogador desiste e o
 * recurso vira decoracao.
 *
 * O padrao agora e' a pilha inteira, que e' o gesto de quem esta arrumando a
 * mochila. Segurando SHIFT o arrasto pede a quantia na caixinha de sempre (a
 * mesma da troca, com regua e os atalhos 1 / Metade / Tudo).
 *
 * A pergunta e' feita na hora de SOLTAR, e nao de pegar: no arrasto do
 * navegador nao da' para abrir uma janela no meio do gesto sem cancelar o
 * arrasto. Entao o shift so' marca a carga, e quem larga e' que pergunta.
 */
/*
 * O que a tela VIU daquela peça, para o servidor conferir se a posição ainda
 * aponta para ela. Só tier e afixo: são o que distingue duas cópias do mesmo
 * id, e são pequenos o bastante para viajar em todo clique. Ver `pecaApontada`.
 */
/* Exportado: o baú da guilda guarda a peça CLICADA, não a primeira de mesmo id. */
export const alvoDaPeca = (entry, pilha) => ({
  indice: pilha,
  tier: Math.floor(Number(entry?.tier) || 0),
  af: Array.isArray(entry?.af) ? entry.af : null,
});

function makeDraggable(node, id, from, count = 1, pilha = null, entry = null) {
  node.draggable = true;
  node.addEventListener('dragstart', (event) => {
    event.dataTransfer.setData(
      'text/plain',
      JSON.stringify({
        id,
        from,
        count: Math.max(1, Math.floor(count) || 1),
        pedir: !!event.shiftKey,
        pilha,
        // A assinatura viaja com o arrasto pelo mesmo motivo do clique.
        alvo: entry ? alvoDaPeca(entry, pilha) : null,
      })
    );
    event.dataTransfer.effectAllowed = 'move';
    node.classList.add('dragging');
  });
  node.addEventListener('dragend', () => node.classList.remove('dragging'));
}

/**
 * Quantos itens esta carga quer mover — perguntando quando o shift pediu.
 *
 * Quem larga chama isto em vez de decidir sozinho: a regra de "tudo, ou o que o
 * jogador escolher" e' a mesma em toda area que aceita item, e escrita uma vez.
 */
export function quantosMover(carga, aoDecidir) {
  const total = Math.max(1, Math.floor(carga?.count) || 1);
  if (!carga?.pedir || total <= 1) return void aoDecidir(total);
  pedirQuantidade({ id: carga.id, max: total, titulo: 'Quantos mover?', aoConfirmar: aoDecidir });
}

/*
 * ---- Arrastar para OUTRA CASA do mesmo lugar SEPARA a pilha ----
 *
 * "se eu arrastar um item pra outro slot segurar shift seja na mochila ou
 * qualquer outro lugar tem que aparecer a opçao de separar".
 *
 * Separar já existia, mas só por shift + CLIQUE — um gesto que ninguém
 * descobre sozinho. Arrastar uma pilha para uma casa vazia é o que se faz no
 * client de verdade, e até aqui esse arrasto não fazia nada: a mochila só
 * escutava arrasto vindo do equipamento e da bolsa, e largar uma peça da
 * própria mochila nela mesma caía no `catch` em silêncio.
 *
 * ---- E o shift deixou de ser obrigatório ----
 *
 * Ele era: sem shift o arrasto dentro da mesma lista não fazia nada, com o
 * argumento de que "a ordem é do servidor, então o gesto seco não significa
 * nada". O argumento estava certo sobre a ORDEM e errado sobre o gesto — o
 * dono voltou dizendo "se eu arrastar um item que é de quantidade pra outro
 * slot da mochila era pra aparecer o modal pra separar".
 *
 * É o que o client de verdade faz, e é a leitura certa: arrastar uma pilha
 * para outro lugar da mesma mochila só pode querer dizer uma coisa. Um gesto
 * que não faz nada é indistinguível de um gesto quebrado — foi exatamente
 * assim que este pareceu quebrado.
 *
 * O shift continua valendo (ele marca a carga com `pedir`) e agora não muda
 * nada aqui: a régua abre de qualquer jeito. Onde ele ainda decide é no
 * arrasto entre lugares DIFERENTES — bolsa para mochila, mochila para o chão —,
 * em que o padrão é levar a pilha inteira.
 */
/*
 * ---- Soltar em cima de uma pilha IGUAL junta as duas ----
 *
 * "quando eu arrastar o mesmo item que é acumulativo no mesmo item acumulativo
 * ele junta direto ok" — sem régua, sem confirmação, como no client.
 *
 * A célula de destino sai do próprio evento: o `drop` é escutado na GRADE (uma
 * escuta em vez de uma por célula), e `event.target` é o nó de baixo do cursor.
 * `closest` sobe dele até a célula — o cursor pode ter parado em cima do
 * sprite ou do número da quantidade, que são filhos dela.
 *
 * Devolve `true` quando juntou, para quem chama não abrir a régua de separar
 * em seguida: soltar numa pilha igual e soltar no vazio são gestos diferentes.
 */
function juntarArrastando(payload, onde, event) {
  if (payload?.from !== onde || payload.pilha == null) return false;
  const alvo = event?.target?.closest?.('.cell');
  if (!alvo?.dataset?.pilha) return false;

  const paraPilha = Number(alvo.dataset.pilha);
  if (!Number.isInteger(paraPilha) || paraPilha === Number(payload.pilha)) return false;
  if (Number(alvo.dataset.item) !== Number(payload.id)) return false;
  if (!ctx.state.items?.[payload.id]?.stackable) return false;

  ctx.send({ t: 'juntar', de: Number(payload.pilha), para: paraPilha, from: onde });
  return true;
}

/*
 * ---- O BOTAOZINHO DE ORGANIZAR ----
 *
 * "ao lado da engrenagem um botao de reorganizar que reorganizaria os itens
 * automaticamente tambem em ordem ... o reorganizar seria por nome, e valeria
 * pra deposito e boss pouch tambem (cada um teria seu proprio botaozinho
 * pequeno de organizar)."
 *
 * Um por lugar, e nao um que arruma tudo: cada janela arruma a si. Quem ordena
 * e' o servidor — a ordem da lista dele E' a ordem da tela, entao ordenar aqui
 * seria uma ordem que o proximo retrato desfaria.
 *
 * `onde` e' o mesmo texto do `from` do arrasto ('bag', 'bossPouch',
 * 'depot:3'), de proposito: e' o unico nome que os dois gestos precisam
 * combinar, e o servidor confere os dois no mesmo lugar (`lugarDeOrganizar`).
 */
export function pedirParaOrganizar(onde) {
  ctx.send({ t: 'organizar', from: onde });
}

/*
 * ---- E SOLTAR EM CIMA DE OUTRO ITEM TROCA OS DOIS DE LUGAR ----
 *
 * "sobre o reorganizar itens na mochila ou deposito seria poder trocar de lugar
 * entre os itens de slot."
 *
 * Irmao de `juntarArrastando`, e vem DEPOIS dele: soltar gold em cima de gold
 * junta as duas pilhas (esse gesto ja tinha dono), e soltar em cima de qualquer
 * outra coisa troca as casas. Sao dois gestos parecidos com respostas
 * diferentes, e a ordem entre eles e' o que os separa.
 *
 * A casa VAZIA continua sendo o gesto de separar: ela nao tem `dataset.pilha`
 * (a tela desenha as vagas depois do fim da lista), entao o `closest` acha a
 * celula e a guarda abaixo devolve `false`.
 *
 * Com SHIFT, nao. O shift ja quer dizer "pergunte a quantidade" em todo arrasto
 * deste jogo, e quem segura shift para separar uma pilha nao esta' pedindo para
 * trocar de lugar — ele so' errou a mira por um quadradinho.
 */
export function trocarArrastando(payload, onde, event) {
  if (payload?.from !== onde || payload.pilha == null || payload.pedir) return false;
  const alvo = event?.target?.closest?.('.cell');
  if (!alvo?.dataset?.pilha) return false;

  const paraPilha = Number(alvo.dataset.pilha);
  if (!Number.isInteger(paraPilha) || paraPilha === Number(payload.pilha)) return false;

  ctx.send({ t: 'trocar', de: Number(payload.pilha), para: paraPilha, from: onde });
  return true;
}

function separarArrastando(payload, onde) {
  const id = Number(payload?.id);
  if (!id) return;
  const lista = onde === 'pouch' ? ctx.state.character.pouch : ctx.state.character.inventory;
  const total = (lista ?? [])
    .filter((entry) => entry.id === id)
    .reduce((soma, entry) => soma + (entry.count ?? 1), 0);

  /*
   * Uma peça só, ou peça que não empilha, não tem o que separar — e abrir a
   * régua para dizer isso seria pior do que não abrir nada.
   */
  if (total <= 1 || !ctx.state.items?.[id]?.stackable) return;

  pedirQuantidade({
    id,
    max: total,
    // Metade: separar a pilha inteira não separa nada. Ver `itemCell`.
    valor: Math.max(1, Math.floor(total / 2)),
    titulo: 'Separar quantos da pilha?',
    aoConfirmar: (quantos) => ctx.send({ t: 'split', id, count: quantos, from: onde }),
  });
}

/*
 * ---- Arrastar do CHÃO para dentro é recolher ----
 *
 * "eu tenho que conseguir pegar itens no chao tambem, e eles tem que poder
 * arrastar no chao igual da crystal server".
 *
 * O menu do botão direito no mapa já pegava. Faltava o gesto — e o gesto é o
 * que a pessoa tenta primeiro, porque é o que ela faz no client.
 *
 * A carga vem do canvas do mapa (ver o `dragstart` de `map.mjs`) e traz a CASA
 * de onde a peça saiu. O servidor pega o topo daquela pilha, que é exatamente a
 * peça desenhada — e é ele quem confere alcance e espaço na mochila.
 *
 * Devolve `true` quando tratou, para quem chama parar aí: um arrasto do chão
 * não é nem "guardar na bolsa" nem "separar pilha".
 */
function vindoDoChao(payload) {
  if (payload?.from !== 'chao') return false;
  /*
   * `indice` só vem do browse field — a janela que mostra a casa inteira e é o
   * único lugar em que se pode apontar uma peça que não é a de cima. Do mapa
   * ele não vem, e o servidor pega o topo, que é o que estava desenhado.
   */
  ctx.send({ t: 'pegar', x: payload.x, y: payload.y, indice: payload.indice ?? null });
  return true;
}

function makeDropSlot(node, slot) {
  node.addEventListener('dragover', (event) => {
    event.preventDefault();
    node.classList.add('drop-target');
  });
  node.addEventListener('dragleave', () => node.classList.remove('drop-target'));
  node.addEventListener('drop', (event) => {
    event.preventDefault();
    node.classList.remove('drop-target');
    try {
      const payload = JSON.parse(event.dataTransfer.getData('text/plain'));
      // O equipar lê a MOCHILA: vindo da Store Inbox vestiria a cópia de lá. Ver `naStoreInbox`.
      if (payload.from === 'storeInbox') return void ctx.notice?.('Leve da Store Inbox para a mochila primeiro.');
      // Uma GEMA arrastada da mochila até a peça vestida: encaixa no primeiro socket livre dela.
      if (ctx.state.items[payload.id]?.gemaDef && payload.from === 'bag' && payload.pilha != null) {
        return void ctx.send({ t: 'gema', action: 'encaixar', slot, de: payload.pilha });
      }
      if (payload.from === 'pouch') ctx.send({ t: 'pouch', id: payload.id, count: 1, to: 'bag' });
      ctx.send({ t: 'equip', id: payload.id, slot, pilha: payload.pilha, alvo: payload.alvo ?? null });
    } catch {
      /* arrasto de fora da página */
    }
  });
}

/*
 * ---- Largar um item numa area qualquer ----
 *
 * `makeDropSlot` e' do slot de EQUIPAMENTO: ele manda `equip`. A caixa do
 * deposito precisa da mesma mecanica com outro destino, e por isso a parte
 * comum sai daqui — quem chama diz o que fazer com o que caiu.
 *
 * Exportada porque quem usa e' o painel do deposito, noutro arquivo.
 */
export function aceitarSoltura(node, aoSoltar) {
  node.addEventListener('dragover', (event) => {
    event.preventDefault();
    node.classList.add('drop-target');
  });
  node.addEventListener('dragleave', () => node.classList.remove('drop-target'));
  node.addEventListener('drop', (event) => {
    event.preventDefault();
    node.classList.remove('drop-target');
    try {
      // O evento vai junto: quem precisa saber em QUAL celula a peca caiu —
      // o arrastar-para-trocar do deposito — so' descobre por ele.
      aoSoltar(JSON.parse(event.dataTransfer.getData('text/plain')), event);
    } catch {
      /* arrasto de fora da pagina */
    }
  });
}

function emptySlotArt(slot) {
  const art = document.createElement('img');
  art.className = 'slot-art';
  /*
   * A mochila (`back`) e a reserva de todo slot desconhecido.
   *
   * A ficha so pergunta pelos dez slots que ela desenha, mas a ESSENCIA de
   * afixo tambem chama esta funcao (ver `itemCell`) e ela guarda o slot da peca
   * de onde o afixo saiu — que pode ser um slot que esta tabela nao conheca, ou
   * nenhum. Sem a reserva o `src` viraria `undefined.png` e a figura sumiria.
   */
  const nome = SLOT_ART[slot] ?? 'back';
  art.src = `/client/assets/slots/${nome}.png`;
  art.alt = SLOT_LABELS[slot] ?? 'afixo';
  art.onerror = () => art.replaceWith(el('small', null, SLOT_LABELS[slot] ?? 'afixo'));
  return art;
}

/** Célula de item reutilizada pela mochila, bolsa, depot e container. */
/*
 * ---- A raridade sai do balão e vai para o ÍCONE ----
 *
 * Ela só existia no balão: para saber o que era o quê era preciso passar o
 * mouse peça por peça, e uma mochila cheia são quarenta passadas. Foi o que o
 * jogador pediu — "ao passar o mouse por cima dos itens, mostra a raridade
 * (comum, raro, epico), mas normalmente nao da pra saber qual é a raridade.
 * Poderiam diferenciar cada uma delas com um contorno no icone".
 *
 * A classe é a MESMA do balão (`classeDaRaridade`), então a cor de um item é uma
 * cor só no jogo inteiro: se o épico é roxo no balão, é roxo no ícone. Ela
 * carrega o `--tier`, e a luz atrás da peça é desenhada no CSS.
 *
 * `comum` sai apagado de propósito — ver a nota no `style.css`.
 */
/*
 * ---- As estrelas do afixo, no canto do ícone ----
 *
 * Canto de CIMA À DIREITA: o de baixo à direita é do número da pilha, o de cima
 * à esquerda é do selo de tier e o de baixo à esquerda é do imbuement. É o
 * último canto livre, e o afixo é a quarta coisa que uma peça pode ter.
 *
 * Cada estrela é UM afixo, e a cor dela é o quanto AQUELE afixo rolou bem
 * dentro do que ele podia dar (azul, roxo, dourado). Uma ★★★ pode sair azul,
 * roxa e dourada de uma vez — três rolagens, três sortes. Ver
 * `estrelasDosAfixos`.
 *
 * O degrau mora no CSS, não aqui: o mesmo vale no balão, e uma tabela só evita
 * os dois saírem do lugar um do outro.
 */
function selarAfixos(cell, entry) {
  const estrelas = estrelasDosAfixos(entry?.af);
  if (!estrelas.length) return;
  cell.classList.add('com-afixo');
  cell.append(seloDeEstrelas('selo-afixo', estrelas));
}

/*
 * ---- A barrinha de carga, no pé do quadro ----
 *
 * "os itens que têm carga têm que gastar e sumir igual no meu servidor, aí você
 * faz algo bonito pra aparecer a carga no próprio item, em formato de barrinha
 * bonita." — e, na volta: "a barrinha de itens com cargas tem que ser
 * melhorada".
 *
 * Ela vai POR CIMA do sprite, colada na borda de baixo, e não ao lado: o quadro
 * tem 32 pixels e qualquer coisa que empurre o desenho o encolhe. É o mesmo
 * lugar em que um jogo de RPG põe durabilidade, e é onde o olho já procura.
 *
 * ---- O que mudou na segunda volta ----
 *
 * 1. O NÚMERO. A barra dizia "está pela metade" e não dizia "faltam 10". Quem
 *    conta carga precisa do número — é assim que o client dele mostra, e era a
 *    única informação que só existia no `aria-label`, isto é, para ninguém.
 *    Ele fica no canto de baixo à esquerda, que é o único dos quatro ainda
 *    livre: o tier ocupa o de cima à esquerda, as estrelas o de cima à direita
 *    e a contagem da pilha o de baixo à direita.
 *
 * 2. QUATRO estágios em vez de três. O salto de verde para âmbar caía em 34% —
 *    num anel de 20 cargas isso é "de 7 para 6", tarde demais para trocar de
 *    peça no meio de uma caçada. Agora o amarelo entra na metade e o âmbar no
 *    último terço, e o vermelho continua sendo o último décimo.
 *
 * 3. A barra ficou mais alta (5px), ganhou um brilho no topo e uma sombra
 *    embaixo, e passou a acender na própria cor. A 32 pixels, três pixels
 *    chapados eram um risco cinzento em cima de um desenho colorido.
 *
 * 4. E ela aparece TAMBÉM na mochila, e não só no corpo. O jogador que tem três
 *    might rings precisa saber qual deles ainda tem carga ANTES de vesti-lo —
 *    era exatamente a pergunta que a barra não respondia, porque só existia
 *    depois de a peça já estar no dedo.
 *
 * Quem NÃO se gasta não recebe nada — nem barra vazia nem barra cheia. Uma
 * barra cheia em toda peça viraria ruído, e o que se quer notar é justamente a
 * peça que é diferente das outras.
 */

/*
 * O desgaste de uma peça olhada de fora do corpo.
 *
 * O servidor manda a conta pronta POR SLOT (`desgasteView`), e ela continua
 * mandando — o corpo é onde a peça se gasta, e é lá que ela some. A mochila é
 * outra história: são dezenas de células, mandar a conta de cada uma a cada
 * quadro seria repetir o catálogo inteiro no retrato do personagem.
 *
 * Então aqui a conta é refeita, e refeita com as MESMAS DUAS FONTES: o total
 * vem do catálogo (`charges`/`duration` do items.xml, que a tela já tem) e o
 * que resta vem da própria peça (`carga`, que viaja com ela). Sem `carga`
 * gravada, a peça está inteira — é a mesma regra do `cargaDaPeca` do servidor,
 * e é ela que dispensa migração de banco.
 */
function desgasteDaPeca(entry) {
  const meta = ctx.state.items?.[entry?.id];
  if (!meta) return null;
  const tipo = meta.charges > 0 ? 'carga' : meta.duration > 0 ? 'tempo' : null;
  if (!tipo) return null;

  const total = tipo === 'carga' ? meta.charges : meta.duration;
  const guardado = Number(entry.carga);
  const resta = Number.isFinite(guardado) ? Math.max(0, Math.min(total, guardado)) : total;
  return {
    tipo,
    total,
    resta: tipo === 'tempo' ? Math.ceil(resta) : resta,
    fracao: total > 0 ? Math.max(0, Math.min(1, resta / total)) : 0,
  };
}

/** O que cabe no canto: "14", "2h", "31m", "45s". */
function cargaCurta(desgaste) {
  if (desgaste.tipo === 'carga') {
    return desgaste.resta > 999 ? `${Math.floor(desgaste.resta / 1000)}k` : String(desgaste.resta);
  }
  const s = desgaste.resta;
  if (s >= 3600) return `${Math.floor(s / 3600)}h`;
  if (s >= 60) return `${Math.floor(s / 60)}m`;
  return `${s}s`;
}

/*
 * ---- A barra que ANDA ----
 *
 * O dono: "os itens com carga, a barra tem que ser fininha e mostrar a carga
 * sendo consumida em tempo real, tanto na barra quanto no número."
 *
 * A segunda metade era um defeito, e ele não estava aqui: estava na chave que
 * decide quando o inventário se redesenha (`bagKey`, no main.mjs). Ela olha
 * `id x count` de cada peça vestida — e a carga não é nem uma coisa nem outra.
 * Um anel de 1800 segundos no dedo gastava o tempo inteiro no servidor, o
 * retrato chegava com o número novo oito vezes por segundo, e a tela continuava
 * mostrando o primeiro que tinha desenhado. A barra parecia congelada porque
 * ninguém pedia para redesenhá-la.
 *
 * Pôr a carga na `bagKey` conserta e cobra caro: o inventário inteiro seria
 * refeito uma vez por segundo, para sempre, por causa de um anel. É o mesmo
 * motivo pelo qual o premium entra ali como "vip"/"-" e não em milissegundos.
 *
 * Então a barra passou a saber se ATUALIZAR sozinha. `aplicarDesgaste` mexe nos
 * três nós que ela tem — a largura, a cor e o número — sem tocar em mais nada
 * da tela, e `atualizarDesgaste` passa por todas as peças vestidas a cada
 * retrato. É uma dúzia de escritas em atributos contra uma reconstrução de
 * cinquenta quadradinhos com sprite.
 */
function selarDesgaste(cell, desgaste) {
  if (!desgaste) return;
  cell.classList.add('com-desgaste');

  const barra = el('div', 'desgaste');
  const cheio = el('i', 'desgaste-cheio');
  barra.append(cheio);
  /*
   * O número em texto também responde por quem não enxerga a cor — a barra é
   * pura cor, e cor sozinha não é informação.
   */
  const conta = el('i', 'desgaste-conta');
  conta.setAttribute('aria-hidden', 'true');

  cell.append(conta, barra);
  aplicarDesgaste(cell, desgaste);
}

/**
 * Escreve (ou apaga) o desgaste de uma célula que já existe na tela.
 *
 * Ela é chamada na montagem e a cada retrato do servidor. Sendo idempotente,
 * os dois caminhos são o mesmo caminho — e não há como a barra desenhada na
 * montagem discordar da barra atualizada depois.
 */
export function aplicarDesgaste(cell, desgaste) {
  const barra = cell.querySelector('.desgaste');
  const conta = cell.querySelector('.desgaste-conta');
  if (!barra || !conta) return;

  /*
   * Sem desgaste, a barra SAI. É o caso da peça que acabou de ser trocada por
   * outra sem carga no mesmo slot: deixar a barra do anel antigo em cima da
   * espada nova seria uma informação inventada.
   */
  if (!desgaste) {
    barra.remove();
    conta.remove();
    cell.classList.remove('com-desgaste');
    return;
  }

  const fracao = Math.max(0, Math.min(1, Number(desgaste.fracao) || 0));
  const nivel = fracao <= 0.1 ? 'critico' : fracao <= 0.34 ? 'baixo' : fracao <= 0.5 ? 'meio' : 'cheio';
  const texto = cargaCurta(desgaste);

  /*
   * Só escreve o que MUDOU.
   *
   * Reescrever `className` a cada retrato reinicia a animação do "pisca" do
   * estágio crítico — e uma barra que reinicia oito vezes por segundo não
   * pisca, fica acesa. Era o aviso do último décimo deixando de avisar
   * justamente por causa da atualização que veio para melhorá-lo.
   */
  const classeDaBarra = `desgaste ${nivel}`;
  if (barra.className !== classeDaBarra) barra.className = classeDaBarra;
  const classeDaConta = `desgaste-conta ${nivel}`;
  if (conta.className !== classeDaConta) conta.className = classeDaConta;

  const largura = `${(fracao * 100).toFixed(2)}%`;
  const cheio = barra.querySelector('.desgaste-cheio');
  if (cheio && cheio.style.width !== largura) cheio.style.width = largura;

  if (conta.textContent !== texto) conta.textContent = texto;

  barra.setAttribute(
    'aria-label',
    desgaste.tipo === 'carga'
      ? `${desgaste.resta} de ${desgaste.total} cargas`
      : `${desgaste.resta}s de ${desgaste.total}s de uso`
  );
}

/**
 * Passa por todas as peças VESTIDAS e põe nelas a carga do retrato de agora.
 *
 * Só as vestidas: é no corpo que a carga é gasta — por uso, no anel que apara o
 * golpe, e por tempo, no que conta enquanto está no dedo. A cópia guardada na
 * mochila não anda, e varrer a mochila junto seria trabalho por quadro para não
 * mudar nada.
 */
export function atualizarDesgaste() {
  const desgastes = ctx?.state?.character?.desgaste;
  if (!desgastes) return;
  for (const cell of document.querySelectorAll('.slot[data-slot]')) {
    if (!cell.dataset.item) continue;
    aplicarDesgaste(cell, desgastes[cell.dataset.slot] ?? null);
  }
}
/*
 * ---- A raridade da célula, com uma exceção ----
 *
 * Ela sai do CATÁLOGO, e tem de sair mesmo: a raridade é do item, não da cópia.
 * Duas prismatic legs são as duas lendárias.
 *
 * A ESSÊNCIA de afixo é a única peça do jogo em que isso não vale. Todas
 * compartilham um id (ver `ID_DA_ESSENCIA`), então no catálogo todas são
 * "comum" — e a qualidade que importa é a da peça de onde o afixo foi tirado,
 * que viaja na instância. Sem esta exceção, a essência de uma Draevor Knight Legs
 * mítica ficava com o mesmo quadradinho apagado de um hand axe.
 *
 * O dono: "quando eu tirar o afixo de um item mítico, a essência tem que ficar
 * com o fundo vermelho, igual o item mítico fica, e o lendário dourado igual o
 * lendário fica, na mochila ou no market também."
 *
 * E não é só bonito: a qualidade é METADE da regra de onde a essência pode
 * entrar (a outra metade é o slot, que a silhueta já conta). Era a metade
 * invisível.
 */
function vestirRaridade(cell, meta, daPeca = null) {
  const classe = daPeca ? `tier-${TIER_DA_PECA[daPeca] ?? 'comum'}` : classeDaRaridade(meta);
  cell.classList.add(classe);
  // Toda peça ganha o anel da raridade, o comum também (cinza) — o dono: "sempre deixar nos itens anel na moldura".
  cell.classList.add('raridade');
}

/* O acento sai: classe de CSS com acento é pedir problema — `épico` vira `epico`. */
const TIER_DA_PECA = {
  comum: 'comum',
  incomum: 'incomum',
  raro: 'raro',
  'épico': 'epico',
  'lendário': 'lendario',
  'mítico': 'mitico',
};

export function itemCell(entry, from, { size = 30, onClick, titulo, valorInicial, pilha = null } = {}) {
  const { state } = ctx;
  const meta = state.items[entry.id];
  const cell = el('div', 'cell');
  cell.dataset.item = entry.id;
  /*
   * ---- A raridade da essência, e a exceção DENTRO da exceção ----
   *
   * A essência já empresta a raridade da peça de onde saiu, e não a do catálogo
   * (ver `vestirRaridade`). A VERMELHA — a que sai da fusão de três douradas —
   * é o caso a mais:
   *
   *   "quando a essência for a que tem estrela vermelha, o fundo do item tem que
   *    ser vermelho igual de mítico, só que tem que ter um efeito a mais."
   *
   * Ela sai pintada de MÍTICO venha de onde vier, inclusive de peças comuns. Não
   * é o fundo mentindo sobre a qualidade: a qualidade continua escrita no nome e
   * no balão, e o que o vermelho conta aqui é outra coisa — que aquele afixo
   * passou do topo da régua, que é o único no jogo que passa. Três essências
   * douradas e trezentos milhões cabem naquele quadradinho, e ele não podia
   * parecer com o de um hand axe.
   *
   * O "efeito a mais" é o que a separa de uma essência que é mítica de verdade:
   * ver `.cell.essencia-vermelha`, no CSS.
   */
  const vermelha = ehEssencia(entry) && ehVermelha(entry);
  // Essência: a raridade da peça de onde saiu; peça: a raridade do DROP (sistema de itens), senão a do catálogo.
  vestirRaridade(cell, meta, ehEssencia(entry) ? (vermelha ? 'mítico' : entry.raridade ?? 'comum') : entry.raridade ?? null);
  if (vermelha) cell.classList.add('essencia-vermelha');
  /*
   * ---- Qual PILHA esta célula é ----
   *
   * A mochila é uma lista, e desde que existe `splitStack` a mesma peça pode
   * aparecer em duas células. Sem um número aqui, arrastar uma sobre a outra é
   * um gesto que não se sabe descrever: "junte gold com gold" não diz qual com
   * qual, e juntar todas mexeria numa terceira pilha que a pessoa deixou
   * separada de propósito.
   *
   * O número é a posição na lista do personagem — a mesma que o servidor usa.
   */
  if (pilha != null) cell.dataset.pilha = pilha;

  const rules = state.character.itemRules ?? { noLoot: [], noSell: [] };
  if (rules.noSell.includes(entry.id)) cell.classList.add('protected');
  if (rules.noLoot.includes(entry.id)) cell.classList.add('ignored');

  // A entrada inteira: é ela que tem o tier e os imbuements desta peça.
  tipFor(cell, entry.id, entry.count > 1 ? `${entry.count} unidades` : null, null, entry);
  // Os sockets da peça (só mostrar) e o nível da gema solta.
  selarSoquetes(cell, entry);
  if (meta?.gemaDef) cell.append(el('i', 'selo-gema', String(entry.gema?.nivel ?? 1)));
  /*
   * ---- A ESSÊNCIA de afixo desenha a SILHUETA do slot ----
   *
   * "ao tirar vem uma peça na backpack que seria igual do inventário quando tá
   * sem nada equipado, só que com as estrelas e o afixo que ela quis tirar."
   *
   * Ela não tem sprite de item — não vem do client do Tibia, é uma peça deste
   * jogo (ver `ID_DA_ESSENCIA`, em afixos-forja.mjs). Sem esta linha o quadrado
   * saía VAZIO: `itemCanvas` devolve um canvas em branco quando não conhece o
   * id, e um afixo guardado ficaria invisível na mochila.
   *
   * O desenho é o mesmo PNG da casa vazia da ficha, e é de propósito que seja o
   * mesmo: a pessoa reconhece "isto é de arma" sem ler nada. `afixoDe` guarda o
   * slot da peça de onde o afixo saiu.
   */
  if (entry.afixoDe) cell.append(emptySlotArt(entry.afixoDe));
  else cell.append(itemCanvas(entry.id, size, entry.count));
  if (entry.count > 1) cell.append(el('b', null, entry.count > 9999 ? '9k+' : entry.count));
  // Os selos de tier e imbuement, que são da PEÇA. Ver `selarTier`.
  selarTier(cell, entry);
  // E as estrelas do afixo, que também são da peça. Ver `selarAfixos`.
  selarAfixos(cell, entry);
  /*
   * A carga que resta, para a peça que se gasta. Aqui a conta é da tela e não
   * do servidor — ver `desgasteDaPeca` para o porquê.
   */
  selarDesgaste(cell, desgasteDaPeca(entry));

  makeDraggable(cell, entry.id, from, entry.count ?? 1, pilha, entry);
  cell.oncontextmenu = (event) => acaoDoDireito(event, entry.id, { from, pilha, alvo: alvoDaPeca(entry, pilha), peca: entry });
  cell.addEventListener(
    'mousedown',
    (event) => levarParaOChat(event, entry.id, entry.tier, entry.imbu, entry.af, entry.afixoDe, entry.raridade),
    true
  );

  /*
   * ---- O clique esquerdo, quando é a pedra do Tier Up ----
   *
   * Na própria pedra ele LIGA a mira; em qualquer outra peça, com a mira ligada,
   * ele é o alvo. Fora isso o clique segue para o que a tela dele faz (levar a
   * pilha para a mochila, para a bolsa, e por aí).
   *
   * `capture` porque o `onClick` de cada tela é registrado depois: sem isto o
   * clique na pedra durante a mira também moveria a pilha.
   */
  cell.addEventListener(
    'click',
    (event) => {
      // A peça acabou de entrar numa frase: o clique já foi gasto nisso.
      if (doChat()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (cliqueDaMira(entry.id)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      /*
       * ---- A mira do Tier Up só vale a partir da MOCHILA ----
       *
       * Report: "não consigo tirar o Draevor Tier Up do DP. Ao clicar, ele não
       * vai pra bag, abre uma cruz como se fosse pra usar".
       *
       * Este ouvinte era por ITEM, e não por LUGAR: ele engolia o clique em
       * qualquer célula que mostrasse a pedra — no depósito, na Store Inbox, na
       * Boss Pouch — e nessas telas o clique é o único jeito de tirar a peça de
       * lá. A pedra ficava presa, e a mira nem funcionava, porque `subirTier`
       * cobra a pedra da MOCHILA.
       *
       * Então a mira só começa de onde ela pode terminar. Nas outras telas o
       * clique volta a ser o que aquela tela faz com ele — tirar para a
       * mochila.
       */
      if (entry.id === ITEM_TIER_UP && from === 'bag') {
        event.preventDefault();
        event.stopPropagation();
        mirarComTierUp();
      }
    },
    true
  );
  /*
   * O clique tambem leva a pilha, e com shift pergunta. Quem recebe o clique e'
   * quem sabe para onde vai — por isso a escolha vem no segundo argumento, e
   * cada tela decide o que fazer com ela.
   */
  if (onClick) {
    cell.onclick = (event) => {
      if (!event.shiftKey || (entry.count ?? 1) <= 1) return void onClick(entry, entry.count ?? 1);
      /*
       * O titulo pode ser uma FUNCAO, e nao so' um texto.
       *
       * O mesmo shift na mochila faz duas coisas diferentes conforme o que esta
       * aberto na tela: com uma caixa do deposito aberta ele escolhe quanto
       * GUARDAR, e sem ela escolhe quanto SEPARAR da pilha. Isso so' se sabe no
       * instante do clique — a janela da mochila pode ter sido desenhada muito
       * antes de o deposito abrir —, entao quem chama passa a pergunta como
       * funcao e ela e' respondida aqui, na hora.
       */
      /*
       * Onde a régua COMEÇA também depende de para que ela serve.
       *
       * Guardar no depósito começa em tudo — quem abriu o armário quer guardar.
       * SEPARAR começa na metade, porque separar tudo não separa nada: a régua
       * no máximo fazia o OK não ter efeito nenhum, e era exatamente o que
       * acontecia ao tentar dividir uma pilha (o `escolhido` abaixo dava falso e
       * o clique morria em silêncio).
       *
       * Como o título, o valor pode vir como função: só no instante do clique se
       * sabe se há uma caixa do depósito aberta.
       */
      pedirQuantidade({
        id: entry.id,
        max: entry.count,
        valor: typeof valorInicial === 'function' ? valorInicial(entry) : valorInicial,
        titulo: (typeof titulo === 'function' ? titulo() : titulo) || 'Quantos mover?',
        aoConfirmar: (quantos) => onClick(entry, quantos),
      });
    };
  }
  return cell;
}

// ---------- janelas ----------

/** Esquece o que cada janela de itens desenhou: o próximo desenho é inteiro (a sonda `__redesenhar`). */
export function esquecerOsDesenhos() {
  for (const id of ['inventory', 'loot']) {
    const body = windowBody(id);
    if (body) {
      delete body.dataset.assinaturaDoInventario;
      delete body.dataset.assinaturaDaBolsa;
    }
  }
  if (cabecaDaMochila) cabecaDaMochila.assinatura = null;
}

export function renderInventory() {
  if (esperaOArrasto(renderInventory)) return;
  const body = windowBody('inventory');
  if (!body) return;
  const { state, send } = ctx;
  const character = state.character;

  /*
   * Remonta só quando algo que ela mostra mudou — pelo mesmo motivo da mochila
   * (ver `renderContainer`): ela é chamada a cada segundo junto com o relógio da
   * bolsa de loot, e apagava e refazia o equipamento inteiro a cada vez.
   */
  const assinatura = JSON.stringify([
    character.equipment, character.ammoChoices ?? null, character.ammoPending ?? null, character.municao ?? 0,
    character.derived?.capacity, character.weight, character.desgaste ?? null, character.joias ?? null,
    character.imbuements ?? null, character.itemRules ?? null, (character.premium ?? 0) > 0, character.blessings ?? null,
  ]);
  if (body.dataset.assinaturaDoInventario === assinatura && body.firstChild) return;
  body.dataset.assinaturaDoInventario = assinatura;

  body.innerHTML = '';

  const equipment = el('div', 'equipment');
  for (const slot of SLOT_LAYOUT) {
    // Os dois selos ocupam os buracos da grade: não são slots, não recebem
    // arrasto e não têm moldura de encaixe.
    if (slot === '@premium') {
      equipment.append(seloPremium(character));
      continue;
    }
    if (slot === '@blessings') {
      equipment.append(seloBlessings(character, state.catalog, () => ctx.abrirBlessings?.()));
      continue;
    }

    const cell = el('div', 'slot');

    cell.dataset.slot = slot;
    makeDropSlot(cell, slot);
    const equipped = character.equipment[slot];

    if (equipped) {
      cell.dataset.item = equipped.id;
      vestirRaridade(cell, state.items[equipped.id], equipped.raridade ?? null);
      // O slot vai junto: e' por ele que o balao acha os imbuements da peca.
      tipFor(cell, equipped.id, null, slot, equipped);
      cell.append(itemCanvas(equipped.id, 32, equipped.count));
      // O selo do tier — é aqui que ele mais importa: no corpo é que o efeito
      // do tier existe. Ver `selarTier`.
      selarTier(cell, equipped, 'equipment');
      selarAfixos(cell, equipped);
      // Os sockets da peça vestida, no próprio slot: um toque abre a janela (desktop e celular).
      selarSoquetes(cell, equipped, () => abrirSoquetes(ctx, slot));
      // A carga que resta, quando a peça se gasta. Ver `selarDesgaste`.
      selarDesgaste(cell, character.desgaste?.[slot]);
      /*
       * E é aqui que a mira da pedra aterrissa: só peça vestida sobe de tier, e
       * este é o quadro que o jogador vai clicar depois de pegar a pedra.
       */
      cell.addEventListener(
        'click',
        (event) => {
          if (!doChat() && !cliqueDaMira(equipped.id)) return;
          event.preventDefault();
          event.stopPropagation();
        },
        true
      );
      makeDraggable(cell, equipped.id, 'equipment');
      cell.addEventListener(
        'mousedown',
        (event) => levarParaOChat(event, equipped.id, equipped.tier, equipped.imbu, equipped.af, equipped.afixoDe, equipped.raridade),
        true
      );

      /*
       * O botão direito nos slots vestidos, em ordem:
       *
       *   Ctrl+direito           → o menu, como em toda peça
       *   direito na mochila     → abre a janela dela, e fecha se estiver aberta
       *   direito na aljava      → a escolha da munição (era o esquerdo)
       *   direito no resto       → a regra geral: usa, ou abre o menu
       */
      cell.oncontextmenu = (event) => {
        if (!event.ctrlKey && slot === 'backpack') {
          event.preventDefault();
          return void toggleWindow('container');
        }
        if (!event.ctrlKey && aljava) {
          event.preventDefault();
          return void openAmmoPicker();
        }
        acaoDoDireito(event, equipped.id, { from: 'equipment', peca: equipped });
      };
      /*
       * ---- A ALJAVA é o que se clica para escolher a flecha ----
       *
       * Era o slot de munição, e ele deixou de ser dela: agora é um slot de
       * acessório como os outros (é onde o Draevor Trinket vai), e a flecha
       * passou a pertencer à aljava — que é onde ela sempre esteve na ficção.
       *
       * A aljava aparece no slot de escudo quando o arco está na mão, e é uma
       * peça que não se pode tirar (`isFixedGear`); clicar nela para
       * desequipar nunca fez nada. Agora o clique abre a escolha da munição.
       */
      const aljava = slot === 'shield' && character.ammoChoices?.length && ehAljava(equipped.id);

      cell.onclick = () => {
        if (slot === 'backpack') return void setVisible('container', true);
        /*
         * ---- A aljava abre no BOTÃO DIREITO ----
         *
         * Ela estava no esquerdo, e o esquerdo num slot de equipamento é
         * "tirar a peça" em todo o resto da tela — a aljava era a única
         * exceção, e uma exceção que ninguém adivinha. No client dele quem abre
         * um container é o direito, e a aljava é um container.
         *
         * ---- E o ESQUERDO abre a lista de aljavas ----
         *
         * Ele não fazia nada, porque "tirar" não era resposta possível numa
         * peça fixa. Desde que a aljava passou a ser uma escolha — são onze, e
         * a Draevor dá +7 de magic — há o que responder ali: qual delas.
         *
         * Fica o par que o resto da tela já ensina: o esquerdo mexe na PEÇA
         * (qual aljava), o direito abre o que ela CONTÉM (qual flecha).
         */
        if (aljava) return void openQuiverPicker();
        /*
         * ---- Com uma caixa do depósito aberta, a peça VESTIDA vai para lá ----
         *
         * O dono: "quando eu tiver com o depósito aberto eu tenho que conseguir
         * mover itens pra lá clicando, até mesmo os itens que em tese era pra
         * equipar no inventário".
         *
         * A mochila já fazia isso (ver o `onClick` de `renderContainer`): com uma
         * caixa aberta, o destino do clique é a caixa. O corpo não fazia — o
         * clique aqui sempre significou "tirar", e a peça parava na mochila. Para
         * guardar o elmo que se está usando eram três gestos: tirar, achar na
         * mochila, clicar de novo.
         *
         * São duas mensagens porque são dois passos de verdade: a peça precisa
         * estar COM o personagem para poder ser guardada (`toDepot` tira da
         * mochila). O servidor atende na ordem em que chegam, então quando o
         * `store` roda a peça já desceu. É o mesmo par que a bolsa de loot usa
         * para chegar ao depósito.
         */
        const caixaAberta = ctx.caixaDoDepositoAberta?.();
        if (caixaAberta != null && slot !== 'backpack') {
          send({ t: 'unequip', slot });
          send({ t: 'depot', action: 'store', id: equipped.id, count: equipped.count ?? 1, caixa: caixaAberta });
          return;
        }
        send({ t: 'unequip', slot });
      };

      if (aljava) {
        /*
         * A aljava pisca enquanto a munição está pendente e fica com o anel
         * dourado depois de escolhida — os dois estados que eram do slot.
         *
         * A flecha carregada é desenhada POR CIMA, num canto: a aljava sozinha é
         * o mesmo desenho para uma diamond arrow e uma flecha comum, e a
         * diferença entre as duas é o motivo de a tela existir.
         */
        cell.classList.add(character.ammoPending ? 'pending' : 'loaded');
        if (character.municao) {
          const marca = el('i', 'aljava-municao');
          marca.append(itemCanvas(character.municao, 22));
          cell.append(marca);
        }
        cell.append(el('i', 'endless', '∞'));
        // O balão da aljava conta a munição, e não a aljava: ver `tipMunicao`.
        tipPanel(cell, () => tipMunicao(character));
      }

      // O selo de imbuement agora vem do `selarTier` acima, que lê a peça — a
      // marca por SLOT ficava só no corpo e não valia para a mochila.

    } else {
      cell.title = SLOT_LABELS[slot];
      cell.append(emptySlotArt(slot));
    }

    /*
     * ---- A engrenagem do amuleto e do anel ----
     *
     * "no slot de amuleto e de ring tem que ter uma engrenagenzinha que eu posso
     * clicar e configurar pra equipar x amuleto ou x ring com x vida ou x mana,
     * e desequipar."
     *
     * Ela aparece no slot VAZIO também: quem ainda não vestiu nada é
     * exatamente quem vai configurar a primeira regra, e esconder o botão até
     * haver peça no corpo tornaria a tela inalcançável para ele.
     *
     * `stopPropagation` porque o clique no slot é "tirar a peça" — sem isto,
     * abrir a configuração desequiparia o amuleto no mesmo gesto.
     */
    if (SLOTS_COM_REGRA.includes(slot)) {
      const engrenagem = el('i', 'slot-regra', '⚙');
      engrenagem.title = `Trocar ${SLOT_LABELS[slot]} sozinho, por vida e mana`;
      if (state.character.joias?.[slot]?.length) engrenagem.classList.add('ligada');
      engrenagem.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        abrirRegrasDaJoia(slot);
      };
      cell.append(engrenagem);
    }

    equipment.append(cell);
  }
  body.append(equipment);

  // O conteúdo da mochila fica só na janela própria — duas mochilas abertas
  // no mesmo lugar era confusão garantida.
  //
  // A capacidade fecha a janela: centrada e colada no rodapé, ela é o resumo do
  // que está vestido. Encostada à esquerda logo abaixo da grade parecia o
  // começo de uma lista que nunca vinha.
  /*
   * A lixeira.
   *
   * Destruir já existia no menu do botão direito, escondido atrás de dois
   * cliques e de saber que ele está lá. Arrastar para uma lixeira é o gesto que
   * o jogador já faz sem pensar — e ele cai na MESMA confirmação, inclusive no
   * "não perguntar novamente", porque perder um item por engano é igual em
   * qualquer caminho.
   */
  const lixeira = el('div', 'inv-trash');
  lixeira.append(el('span', 'inv-trash-can', '☒'), el('b', null, 'Lixeira'));
  lixeira.title = 'Arraste um item aqui para destruí-lo';
  lixeira.addEventListener('dragover', (event) => {
    event.preventDefault();
    lixeira.classList.add('over');
  });
  lixeira.addEventListener('dragleave', () => lixeira.classList.remove('over'));
  lixeira.addEventListener('drop', (event) => {
    event.preventDefault();
    lixeira.classList.remove('over');
    try {
      const carga = JSON.parse(event.dataTransfer.getData('text/plain'));
      // Só o que está guardado. O que está vestido tem que ser tirado antes —
      // `destroy` no servidor procura na mochila e na bolsa, e um item ainda
      // equipado não está em nenhuma das duas.
      if (carga?.from === 'equipment') return void ctx.notice?.('Tire o item antes de destruí-lo.');
      // A lixeira destroi a PILHA — e com shift pergunta quanto. Ver `quantosMover`.
      if (carga?.id) quantosMover(carga, (quantos) => destroyItem(Number(carga.id), carga.from, quantos));
    } catch {
      /* arrasto de fora da página */
    }
  });
  // Ela é anexada lá embaixo, DEPOIS da capacidade — ver o porquê logo adiante.

  /*
   * ---- A capacidade vira BARRA ----
   *
   * Ela era dois números soltos, e dois números não respondem a pergunta que o
   * jogador faz de verdade: "ainda cabe?". Para saber, era preciso dividir
   * 1448 por 12180 de cabeça no meio de uma caçada — ninguém faz isso, então
   * ninguém olhava, e a bolsa enchia sem aviso.
   *
   * A barra responde antes de ser lida: o tanto preenchido JÁ é a resposta. Os
   * números continuam lá dentro, para quem quiser o valor exato.
   *
   * É a mesma `hud-bar` da vida, da mana e da stamina — mesmo líquido, mesma
   * moldura, mesmo texto centrado. Uma barra própria aqui seria uma segunda
   * linguagem visual para dizer a mesma coisa.
   */
  const capacidade = Math.max(1, character.derived.capacity ?? 1);
  const peso = Math.max(0, character.weight ?? 0);
  const cheio = Math.min(100, (peso / capacidade) * 100);
  /*
   * Verde, amarelo, vermelho — e os cortes seguem a stamina, que já ensinou o
   * jogador o que cada cor quer dizer nesta tela.
   *
   * 70% é onde ainda dá para pegar um loot grande sem pensar; 90% é onde o
   * próximo item pode não caber. Abaixo de 70 não há o que avisar.
   */
  const grau = cheio >= 90 ? 'cheia' : cheio >= 70 ? 'enchendo' : 'ok';

  /*
   * "Cap" vai DENTRO da barra, e o rótulo de fora sumiu.
   *
   * Eram duas linhas para uma informação: a palavra "Capacidade" em cima e a
   * barra embaixo. A barra já tem um texto centrado — é o mesmo desenho da
   * vida e da mana —, então o nome cabe nele, e a linha que sobrava virou
   * altura que a janela não tinha.
   */
  const line = el('div', 'inv-cap');
  const barra = el('div', 'hud-bar cap');
  barra.dataset.grau = grau;
  const liquido = el('i');
  liquido.style.setProperty('--fill', `${cheio}%`);
  barra.append(liquido, el('span', null, `Cap ${peso.toFixed(2)} / ${capacidade} oz`));
  // O que sobra, em oz, para quem está decidindo se volta ou continua.
  barra.title = `${Math.max(0, capacidade - peso).toFixed(2)} oz livres (${(100 - cheio).toFixed(0)}%)`;
  line.append(barra);
  /*
   * A capacidade vem ANTES da lixeira.
   *
   * A ordem era o contrário e estava errada: a capacidade é o resumo do que
   * está vestido logo acima dela, e lida junto com a grade. A lixeira não é
   * leitura nenhuma — é um destino de arrasto, que só existe quando há um item
   * na mão. Ela desceu para o rodapé, que é onde uma coisa que quase nunca se
   * usa deve ficar.
   */
  body.append(line);
  body.append(lixeira);

}


/*
 * É munição Draevor? A mesma regra do servidor (`ehMunicaoDeMochila`), pelo nome.
 *
 * Repetida aqui de propósito: a tela precisa dela para escrever a linha certa
 * mesmo quando a lista de escolhas não está carregada — e quem DECIDE se o tiro
 * sai continua sendo o servidor, que confere a mochila de verdade.
 */
const ehMunicaoDraevor = (meta) => !!meta?.ammo && /draevor/i.test(meta.name ?? '');

/** Escolha da munição do arco ou da besta: infinita, cobrada em gold por tiro. */
/**
 * Como a tela chama o que a venda rápida paga.
 *
 * Taxa cheia é "preço de NPC" e ponto: escrever "100% do preço de NPC" faz o
 * leitor parar para conferir se leu certo. Abaixo disso, a porcentagem importa
 * e aparece.
 */
function precoDaVendaRapida(taxa) {
  const valor = Number(taxa ?? 1);
  return valor >= 1 ? 'preço de NPC' : `${Math.round(valor * 100)}% do preço de NPC`;
}

/** É a aljava do arco? É ela quem carrega a munição. */
const ehAljava = (id) => !!ctx.state.items?.[id]?.quiver;

/*
 * ---- O balão da aljava ----
 *
 * Ele conta a MUNIÇÃO, e não a aljava: o que o jogador quer saber ao parar o
 * mouse ali é qual flecha está carregada, quanto ela some do bolso a cada tiro
 * e quanto de ataque ela soma — três coisas que não estavam em lugar nenhum da
 * tela antes de abrir o modal.
 */
function tipMunicao(character) {
  const caixa = el('div', 'tip-municao');
  const meta = character.municao ? ctx.state.items?.[character.municao] : null;

  caixa.append(el('div', 'tip-bless-head', 'Munição da aljava'));
  if (!meta) {
    caixa.append(el('p', 'shop-note', 'Nenhuma flecha carregada. Clique para escolher.'));
    return caixa;
  }

  const topo = el('div', 'tip-municao-topo');
  topo.append(itemCanvas(character.municao, 32));
  topo.append(el('b', null, meta.name));
  caixa.append(topo);

  const linha = (rotulo, valor, className) => {
    const item = el('div', 'tip-exp-linha');
    item.append(el('span', null, rotulo));
    item.append(el('b', className, valor));
    caixa.append(item);
  };
  if (meta.attack) linha('Ataque da flecha', '+' + meta.attack, 'atk');
  /*
   * A Draevor não tem preço, tem estoque. Mostrar "0g" e logo abaixo "dá para
   * infinitos tiros" seria a leitura errada: ela acaba, só que em peças.
   */
  const daMochila = ehMunicaoDraevor(meta);
  if (daMochila) linha('Custo por tiro', 'não gasta ouro', null);
  else linha('Custo por tiro', (character.ammoCost ?? 0).toLocaleString('pt-BR') + 'g', 'ouro');
  /*
   * O ouro que ele TEM, ao lado do custo.
   *
   * A munição não acaba — o que acaba é o dinheiro, e a caçada para quando ele
   * acaba. "15g por tiro" só vira informação ao lado de quanto resta.
   */
  linha('Ouro no bolso', (character.gold ?? 0).toLocaleString('pt-BR') + 'g', 'ouro');
  if (daMochila) {
    const quantas = character.ammoChoices?.find((e) => e.id === character.municao)?.tem ?? 0;
    linha('Na mochila', quantas.toLocaleString('pt-BR') + (quantas === 1 ? ' peça' : ' peças'), null);
  } else if (character.ammoCost > 0) {
    linha('Dá para', Math.floor((character.gold ?? 0) / character.ammoCost).toLocaleString('pt-BR') + ' tiros', null);
  }
  caixa.append(el('p', 'shop-note', 'Clique na aljava para trocar de munição.'));
  return caixa;
}

/*
 * ---- A tela das regras de um slot ----
 *
 * Cada linha e' uma FRASE: "Use [peca] enquanto a [vida] estiver entre [x] e
 * [y]%". Ela nasceu com quatro campos por linha (vida e mana juntas), e o dono
 * pediu uma medida so' — com razao: dois dos quatro campos ficavam sempre em
 * 0–100, o "tanto faz", e ninguem le' "de 0 a 100" como "nao olho para isso".
 *
 * Quem quiser as duas condicoes escreve duas linhas, e a ORDEM decide qual
 * manda — que e' a mesma resposta que a lista ja dava para todo o resto.
 *
 * Tudo e' montado num rascunho local e so' vai ao servidor no "Salvar": mexer
 * em campos com o estado chegando quatro vezes por segundo faria a lista se
 * redesenhar debaixo do dedo (e' o mesmo defeito que a quantidade da loja
 * tinha).
 */
function abrirRegrasDaJoia(slot) {
  const { state, send } = ctx;
  const rotulo = SLOT_LABELS[slot] ?? slot;

  ctx.openModal(`Trocar ${rotulo} sozinho`, (modal) => {
    const character = state.character;
    const rascunho = (character.joias?.[slot] ?? []).map((regra) => ({ ...regra }));

    /*
     * O que se pode escolher: o que esta na mochila mais o que ja esta no
     * corpo. A peca vestida entra na lista porque configurar "mantenha ESTE
     * anel quando a mana estiver cheia" e' o caso mais comum, e ela nao esta na
     * mochila justamente por estar sendo usada.
     */
    const daMochila = (character.inventory ?? [])
      .filter((entry) => state.items[entry.id]?.slot === slot)
      .map((entry) => entry.id);
    const vestido = character.equipment?.[slot]?.id ?? null;
    const escolhas = [...new Set([...(vestido ? [vestido] : []), ...daMochila])];

    const ajuda = el('div', 'joia-ajuda');
    ajuda.append(
      el('p', null, `Cada linha e' uma ordem: "use esta peca enquanto a vida (ou a mana) estiver nesta faixa".`),
      el(
        'p',
        null,
        `O jogo confere de CIMA PARA BAIXO e obedece a PRIMEIRA linha que bater — as setas mudam a ordem. ` +
          `Se nenhuma bater, ele TIRA a peca que ele mesmo colocou; o que voce vestiu na mao fica onde esta.`
      ),
      el(
        'p',
        'joia-exemplo',
          `Cada faixa sao dois campos: mín e máx, escritos em cima deles. ` +
        `"vida mín 0 máx 30" quer dizer "enquanto a vida estiver de 0 a 30%".` +
        ` O "só sai com" no fim da linha segura a peca no corpo ate' aquela outra ` +
        `faixa bater: e' assim que se pede "poe com a vida abaixo de 60 e so' tira ` +
        `com a mana abaixo de 30".`
      )
    );
    modal.append(ajuda);

    const lista = el('div', 'joia-regras');

    const desenhar = () => {
      lista.innerHTML = '';
      if (!rascunho.length) {
        lista.append(el('p', 'empty', `Sem regra nenhuma — o ${rotulo} so' troca na mao.`));
      }
      for (const [i, regra] of rascunho.entries()) {
        const linha = el('div', 'joia-regra');
        linha.append(el('span', 'joia-ordem', `${i + 1}º`));

        // ---- a peca ----
        const arte = el('div', 'joia-arte');
        if (regra.itemId) arte.append(itemCanvas(regra.itemId, 28));
        else arte.append(el('span', 'joia-tirar', '✖'));
        linha.append(arte);

        const escolha = document.createElement('select');
        escolha.className = 'joia-peca';
        const tirar = document.createElement('option');
        tirar.value = '';
        tirar.textContent = `Tirar o ${rotulo}`;
        escolha.append(tirar);
        for (const id of escolhas) {
          const opcao = document.createElement('option');
          opcao.value = String(id);
          opcao.textContent = state.items[id]?.name ?? `item ${id}`;
          escolha.append(opcao);
        }
        // A peca guardada pode nao estar mais na mochila (foi vendida): ela
        // continua na lista, senao salvar apagaria a regra sem avisar.
        if (regra.itemId && !escolhas.includes(regra.itemId)) {
          const orfa = document.createElement('option');
          orfa.value = String(regra.itemId);
          orfa.textContent = `${state.items[regra.itemId]?.name ?? `item ${regra.itemId}`} (fora da mochila)`;
          escolha.append(orfa);
        }
        escolha.value = regra.itemId ? String(regra.itemId) : '';
        escolha.onchange = () => {
          regra.itemId = escolha.value ? Number(escolha.value) : null;
          desenhar();
        };
        linha.append(escolha);

        // ---- a condicao: vida OU mana ----

        const medida = document.createElement('select');
        medida.className = `joia-medida ${regra.medida === 'mana' ? 'mana' : 'vida'}`;
        for (const [valor, texto] of [
          ['vida', 'vida'],
          ['mana', 'mana'],
        ]) {
          const opcao = document.createElement('option');
          opcao.value = valor;
          opcao.textContent = texto;
          medida.append(opcao);
        }
        medida.value = regra.medida === 'mana' ? 'mana' : 'vida';
        medida.onchange = () => {
          regra.medida = medida.value;
          desenhar();
        };
        linha.append(medida);


        /*
         * ---- Cada numero diz o que ele e' ----
         *
         * "ta meio confuso entre quando campo e' o min e qual e' o maximo."
         *
         * Antes quem dizia isso eram as palavras em volta — "estiver entre X e Y"
         * —, e elas eram justamente o que fazia a linha nao caber. Trocar as
         * palavras por uma etiqueta de nove pixels em cima do campo resolve os
         * dois problemas com a mesma mudanca: ocupa menos largura e diz mais,
         * porque a resposta fica GRUDADA no campo em vez de depender da ordem em
         * que se le' a frase.
         *
         * `onde` e' o objeto que guarda a faixa: a regra (a de entrada) ou o
         * bloco `tirarQuando` (a de saida).
         */
        const numero = (onde, chave, padrao) => {
          const caixa = el('label', 'joia-campo');
          caixa.append(el('em', null, chave === 'min' ? 'mín' : 'máx'));
          const campo = document.createElement('input');
          campo.type = 'number';
          campo.className = 'joia-num';
          campo.min = '0';
          campo.max = '100';
          campo.value = String(onde[chave] ?? padrao);
          campo.oninput = () => {
            const n = Math.round(Number(campo.value));
            onde[chave] = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : padrao;
          };
          caixa.append(campo);
          return caixa;
        };
        linha.append(numero(regra, 'min', 0), numero(regra, 'max', 100), el('span', 'joia-liga', '%'));

        /*
         * ---- A segunda soleira: "so' tirar quando" ----
         *
         * Aqui morava o "+ e mana", que exigia as duas medidas ao mesmo tempo. O
         * dono pediu para trocar um pelo outro depois de usar os dois — e ele tem
         * razao, porque os dois respondem perguntas diferentes e so' um deles
         * responde a pergunta que se faz de verdade nesta tela.
         *
         * O "e a mana entre" apertava a faixa de ENTRADA: a peca entrava com a
         * vida baixa E a mana baixa. Nunca foi isso que se quer de um anel de
         * emergencia — quem escreve essa regra quer a peca ENTRANDO numa hora e
         * SAINDO noutra, que sao duas soleiras e nao uma faixa mais estreita.
         *
         * Ficar na mesma linha e' de proposito: a regra inteira se le' de uma vez
         * — "poe com a vida abaixo de 60, so' tira com a mana abaixo de 30" —, e
         * uma linha de baixo separava as duas metades de uma frase so'. (E os
         * campos herdam a pintura de `.joia-regra`, que e' o que a linha de baixo
         * nao herdava: eles saiam brancos.)
         */
        if (regra.tirarQuando) {
          linha.append(el('span', 'joia-liga joia-e', '· só sai com'));
          const qual = document.createElement('select');
          qual.className = `joia-medida ${regra.tirarQuando.medida === 'mana' ? 'mana' : 'vida'}`;
          for (const [valor, texto] of [['vida', 'vida'], ['mana', 'mana']]) {
            const opcao = document.createElement('option');
            opcao.value = valor;
            opcao.textContent = texto;
            qual.append(opcao);
          }
          qual.value = regra.tirarQuando.medida === 'mana' ? 'mana' : 'vida';
          qual.onchange = () => {
            regra.tirarQuando.medida = qual.value;
            desenhar();
          };
          linha.append(qual);
          linha.append(
            numero(regra.tirarQuando, 'min', 0),
            numero(regra.tirarQuando, 'max', 100),
            el('span', 'joia-liga', '%')
          );
          const semSaida = el('button', 'ghost joia-mais', '✕');
          semSaida.type = 'button';
          semSaida.title = 'Voltar a tirar assim que a faixa de cima passar';
          semSaida.onclick = () => {
            delete regra.tirarQuando;
            desenhar();
          };
          linha.append(semSaida);
        } else {
          const poeSaida = el('button', 'ghost joia-mais', '+ só sai com…');
          poeSaida.type = 'button';
          poeSaida.title = 'Segurar a peca no corpo ate esta outra faixa bater';
          poeSaida.onclick = () => {
            regra.tirarQuando = { medida: regra.medida === 'mana' ? 'vida' : 'mana', min: 0, max: 30 };
            desenhar();
          };
          linha.append(poeSaida);
        }
        // ---- ordem e remocao ----
        const botoes = el('div', 'joia-botoes');
        const sobe = el('button', 'ghost', '▲');
        sobe.type = 'button';
        sobe.disabled = i === 0;
        sobe.title = 'Subir — a de cima e conferida primeiro';
        sobe.onclick = () => {
          [rascunho[i - 1], rascunho[i]] = [rascunho[i], rascunho[i - 1]];
          desenhar();
        };
        const desce = el('button', 'ghost', '▼');
        desce.type = 'button';
        desce.disabled = i === rascunho.length - 1;
        desce.title = 'Descer';
        desce.onclick = () => {
          [rascunho[i + 1], rascunho[i]] = [rascunho[i], rascunho[i + 1]];
          desenhar();
        };
        const fora = el('button', 'ghost danger', '✕');
        fora.type = 'button';
        fora.title = 'Tirar esta regra';
        fora.onclick = () => {
          rascunho.splice(i, 1);
          desenhar();
        };
        botoes.append(sobe, desce, fora);
        linha.append(botoes);

        lista.append(linha);
      }
    };

    desenhar();
    modal.append(lista);

    const rodape = el('div', 'joia-rodape');
    const mais = el('button', 'ghost', '+ Regra');
    mais.type = 'button';
    mais.onclick = () => {
      if (rascunho.length >= MAX_REGRAS_NA_TELA) return void ctx.notice?.(`No maximo ${MAX_REGRAS_NA_TELA} regras.`);
      rascunho.push({ itemId: escolhas[0] ?? null, medida: 'vida', min: 0, max: 100 });
      desenhar();
    };
    const salvar = el('button', 'primary', 'Salvar');
    salvar.type = 'button';
    salvar.onclick = () => {
      send({ t: 'joias', slot, regras: rascunho });
      ctx.closeModal?.();
    };
    rodape.append(mais, salvar);
    modal.append(rodape);
  });
}

function openAmmoPicker() {
  const { state, send } = ctx;

  ctx.openModal('Munição', (modal) => {
    const character = state.character;
    const equipped = character.municao ?? null;

    modal.append(
      el(
        'p',
        'shop-note',
        `A munição não acaba — cada tiro desconta o preço de NPC do seu gold. ` +
          `Hoje sai por ${(character.ammoCost ?? 0).toLocaleString('pt-BR')}g por disparo. ` +
          `As Draevor são a exceção: não custam ouro, e só atiram enquanto houver uma na mochila.`
      )
    );

    /*
     * ---- A previa da municao ----
     *
     * Os cartoes diziam "acerta em área" e paravam ai. A flecha de burst
     * estoura num 3x3 e a de diamante num losango de 21 casas — a diferenca
     * entre as duas e' justamente essa, e o rotulo era o mesmo para ambas.
     *
     * O desenho e' o MESMO da tela de magias (`previaDaMagia`): as casas vem do
     * script da propria municao (`forma`) e o efeito e' o numero que ela solta
     * no mapa. Sem area, a previa mostra o alvo unico no alcance da arma.
     *
     * Uma previa so', ao lado da grade, trocando conforme o mouse passa: catorze
     * canvas animados de uma vez seria peso sem ganho.
     */
    const previa = el('div', 'ammo-previa');
    const alcanceDaArma = character.derived?.attackRange ?? 4;
    const mostrar = (entry) => {
      previa.innerHTML = '';
      if (!entry) return;
      previa.append(el('b', null, entry.name));
      const desenho = previaDaMagia(
        {
          name: entry.name,
          efeito: entry.efeito,
          // O que a flecha comum tem para mostrar e' o VOO: sem isto a previa
          // dela caia na grade de quadradinhos. Ver `ammoChoices`.
          projetil: entry.projetil,
          forma: entry.forma,
          range: entry.forma?.length ? 0 : alcanceDaArma,
          group: 'attack',
          element: entry.element ?? null,
        },
        // A coluna da previa tem 300px com 10 de folga de cada lado, e a
        // moldura come 52: sobram 228 de miolo. Ver `larguraMaxima`.
        { comOutfit: true, larguraMaxima: 228 }
      );
      if (desenho) previa.append(desenho);
      else previa.append(el('p', 'shop-note', 'Tiro direto, sem efeito de área.'));
      if (entry.condicao) previa.append(el('em', null, 'Deixa uma condição no alvo.'));
      /*
       * A munição que troca o TIPO do golpe diz isso em uma linha.
       *
       * A Draevor Paladin Over Arrow bate holy: contra um morto-vivo ela vale o
       * dobro do que a conta do cartão sugere, e contra um bicho resistente a
       * holy vale menos. É informação de decisão, e não havia como chegar a ela
       * olhando a tela.
       */
      if (entry.element) previa.append(el('em', null, `Bate como dano ${entry.element}.`));
    };

    const grid = el('div', 'ammo-grid');
    for (const entry of character.ammoChoices ?? []) {
      const card = el('button', `ammo-card${entry.blocked ? ' blocked' : ''}`);
      card.setAttribute('aria-selected', String(entry.id === equipped));
      card.append(itemCanvas(entry.id, 32), el('b', null, entry.name));
      /*
       * A linha de baixo do card muda com a ESPÉCIE de munição.
       *
       * As de balcão não acabam e cobram por tiro; as Draevor não cobram nada e
       * valem enquanto houver peça na mochila. Escrever "0g por tiro" nas
       * segundas seria verdade e mentira ao mesmo tempo: elas de fato não
       * custam ouro, mas custam a peça, e é isso que a pessoa precisa saber.
       */
      card.append(
        el(
          'em',
          null,
          entry.daMochila
            ? `${entry.attack} de ataque · ${entry.tem ?? 0} com você`
            : `${entry.attack} de ataque · ${entry.cost.toLocaleString('pt-BR')}g por tiro`,
        ),
      );
      if (entry.daMochila) card.append(el('em', 'ammo-draevor', 'não gasta ouro — sai da mochila'));
      if (entry.area) card.append(el('em', 'ammo-area', 'acerta em área'));
      if (entry.blocked) card.append(el('em', 'ammo-block', entry.blocked));
      tipFor(card, entry.id);
      card.disabled = !!entry.blocked;
      // Passar o mouse ja mostra o que ela faz; o clique continua trocando.
      card.onpointerenter = () => mostrar(entry);
      card.onfocus = () => mostrar(entry);
      card.onclick = () => {
        send({ t: 'ammo', id: entry.id });
        ctx.closeModal();
      };
      grid.append(card);
    }
    if (!(character.ammoChoices ?? []).length) grid.append(el('p', 'empty', 'Equipe um arco ou uma besta primeiro.'));

    const lado = el('div', 'ammo-lado');
    lado.append(grid, previa);
    modal.append(lado);

    /*
     * ---- O BOLSO DA ALJAVA ----
     *
     * "faz ser possível guardar as arrow draevor e as bolt draevor dentro da quiver
     * e lá ficar seguro sem poder vender ou ser excluída acidentalmente".
     *
     * A Draevor não se gasta: quem tem uma tem para sempre, até o dia em que ela
     * sai junto num "vender tudo" ou num "limpar" — e ela não se repõe
     * caçando. O que está aqui não está na mochila nem na bolsa, e é por isso
     * que nenhuma das duas telas o alcança.
     *
     * A seção fica embaixo da grade porque ela responde a outra pergunta: a
     * grade é "qual flecha eu uso", esta é "onde as minhas flechas moram".
     * Ela some quando não há nenhuma Draevor em lugar nenhum — sem elas não há o
     * que guardar, e uma caixa vazia só ocuparia a tela.
     */
    const daAljava = character.aljavaGuardada ?? [];
    /*
     * As Draevor soltas na mochila. Sai de `ammoChoices`, que já sabe quais são
     * as que vêm da mochila (`daMochila`) — repetir a régua do nome aqui daria
     * duas, e a que divergisse seria justamente a da tela.
     */
    const draevorSoltas = (character.ammoChoices ?? []).filter((entry) => entry.daMochila && (entry.soltas ?? 0) > 0);
    const guardaveis = new Map();
    for (const entry of draevorSoltas) guardaveis.set(entry.id, entry);

    if (daAljava.length || guardaveis.size) {
      const caixa = el('div', 'aljava-bolso');
      caixa.append(el('b', null, 'Dentro da aljava'));
      caixa.append(
        el(
          'em',
          'shop-note',
          'O que está aqui não é vendido nem jogado fora por engano — e continua contando como munição. O peso é o mesmo.'
        )
      );

      const linhas = el('div', 'aljava-linhas');
      /*
       * Uma linha por TIPO de munição, com os dois lados: quantas estão
       * guardadas e quantas estão soltas. Duas listas separadas fariam a
       * pessoa procurar a mesma flecha em dois lugares da mesma caixa.
       */
      const tipos = new Set([...daAljava.map((e) => e.id), ...guardaveis.keys()]);
      for (const id of tipos) {
        const guardadas = daAljava.find((e) => e.id === id)?.count ?? 0;
        const soltas = guardaveis.get(id)?.soltas ?? 0;
        const linha = el('div', 'aljava-linha');
        linha.append(itemCanvas(id, 32));
        const texto = el('div');
        texto.append(el('b', null, guardaveis.get(id)?.name ?? state.items[id]?.name ?? `item ${id}`));
        texto.append(el('em', null, `${guardadas} na aljava · ${soltas} na mochila`));
        linha.append(texto);

        const botoes = el('div', 'aljava-botoes');
        const guardar = el('button', 'ghost', 'Guardar');
        guardar.disabled = !soltas;
        guardar.onclick = () => send({ t: 'aljavaGuardar', id, guardar: true });
        const tirar = el('button', 'ghost', 'Tirar');
        tirar.disabled = !guardadas;
        tirar.onclick = () => send({ t: 'aljavaGuardar', id, guardar: false });
        botoes.append(guardar, tirar);
        linha.append(botoes);
        linhas.append(linha);
      }
      caixa.append(linhas);
      modal.append(caixa);
    }
    // Comeca mostrando a que esta equipada: e' a referencia para comparar.
    mostrar((character.ammoChoices ?? []).find((entry) => entry.id === equipped) ?? (character.ammoChoices ?? [])[0]);
  });
}


/*
 * ---- A LISTA DE ALJAVAS ----
 *
 * A aljava era peça fixa: o arco entrava na mão e uma `quiver` crua nascia no
 * slot de escudo, sem que ninguém escolhesse nada. Enquanto só existia UMA
 * aljava, isso era o certo. Hoje são onze, e elas não valem o mesmo — a Draevor
 * Paladin dá +3 de magic, a Crafted V2 dá +7 e resistência a dreno —, e a
 * escolha entre elas é uma decisão de equipamento como qualquer outra.
 *
 * Uma linha por PEÇA (é o que o servidor manda em `quiverChoices`): duas Draevor,
 * uma tier 3 e uma crua, são duas escolhas diferentes e por isso são dois
 * cartões, cada um com o selo do tier e as estrelas dos afixos por cima do
 * desenho — as mesmas marcas da mochila, para não haver um segundo alfabeto.
 */
const ONDE_ESTA_A_ALJAVA = {
  corpo: 'vestida',
  padrao: 'vem com o arco',
  mochila: 'na mochila',
  bolsa: 'na bolsa de loot',
};

/** As duas ou três linhas de bônus de uma aljava, para caber no cartão. */
function ganhosDaAljava(id) {
  const meta = ctx.state.items?.[id];
  if (!meta) return [];
  const linhas = [];
  for (const ganho of ganhosDoItem(meta).values()) {
    const valor = Number(ganho.valor.toFixed(1));
    linhas.push(`${valor > 0 ? '+' : '−'}${String(Math.abs(valor)).replace('.', ',')}${ganho.sufixo} ${ganho.rotulo}`);
  }
  // Três chega: o cartão é um quadradinho, e o balão do mouse tem a ficha
  // inteira para quem quiser o resto.
  return linhas.slice(0, 3);
}

export function openQuiverPicker() {
  const { state, send } = ctx;

  ctx.openModal('Aljava', (modal) => {
    const character = state.character;
    const lista = character.quiverChoices ?? [];

    modal.append(
      el(
        'p',
        'shop-note',
        'A aljava mora no slot de escudo e só existe enquanto o arco está na mão. ' +
          'Trocar por aqui devolve a antiga para a mochila — a simples não ocupa lugar nenhum, ' +
          'porque ela vem junto com o arco.'
      )
    );

    /*
     * Report do ThorTormento: "pelo cel não consigo trocar o tipo de munição".
     * A munição só abria no botão direito da aljava, e no celular não existe
     * botão direito — o toque vira clique e cai AQUI. Então a porta para a
     * munição mora também nesta tela, e serve de atalho no desktop.
     */
    if (character.ammoChoices?.length) {
      const trocar = el('button', 'ghost', 'Trocar munição');
      trocar.type = 'button';
      trocar.onclick = () => {
        ctx.closeModal();
        openAmmoPicker();
      };
      modal.append(trocar);
    }

    const grid = el('div', 'ammo-grid');
    for (const entry of lista) {
      const card = el('button', `ammo-card${entry.blocked ? ' blocked' : ''}`);
      card.setAttribute('aria-selected', String(!!entry.equipada));

      /*
       * O desenho vai dentro de um quadro próprio porque os selos de tier e de
       * afixo se penduram nos CANTOS de quem os recebe: soltos no cartão, iriam
       * para os cantos do cartão inteiro, longe da peça a que se referem.
       */
      const arte = el('span', 'aljava-arte');
      arte.append(itemCanvas(entry.id, 32));
      selarTier(arte, entry);
      selarAfixos(arte, entry);
      card.append(arte, el('b', null, entry.name));
      card.append(el('em', null, ONDE_ESTA_A_ALJAVA[entry.onde] ?? entry.onde));
      for (const linha of ganhosDaAljava(entry.id)) card.append(el('em', 'aljava-ganho', linha));
      if (entry.blocked) card.append(el('em', 'ammo-block', entry.blocked));

      // O balão traz a ficha inteira da PEÇA — com o tier e os afixos dela.
      tipFor(card, entry.id, null, null, entry);
      card.disabled = !!entry.blocked || !!entry.equipada;
      card.onclick = () => {
        send({ t: 'aljava', id: entry.id, onde: entry.onde, pilha: entry.pilha });
        ctx.closeModal();
      };
      grid.append(card);
    }
    if (!lista.length) grid.append(el('p', 'empty', 'Equipe um arco ou uma besta primeiro.'));
    modal.append(grid);
  });
}

/** A loot pouch: tudo que cai na hunt entra aqui. */
/*
 * ---- O botão que o LOOT engolia ----
 *
 * Report: o filtro de loot precisa de vários cliques para abrir no meio de uma
 * caçada.
 *
 * Não é o filtro: é o botão. `renderPouch` começa com `body.innerHTML = ''` e
 * monta tudo de novo, e ele roda toda vez que a bolsa muda — ou seja, a cada
 * peça que cai. Um clique do mouse só vira `click` quando o apertar e o soltar
 * caem no MESMO elemento; caindo em dois, o navegador entrega o `click` ao
 * ancestral comum, que aqui é o corpo da janela — e o `onclick` do botão não
 * roda. Medido no navegador: sem redesenho o clique abre; com um redesenho
 * entre o apertar e o soltar, ele some (ver `test-botao-do-filtro`).
 *
 * O jogador não tem como saber disso. Do lado dele o botão simplesmente ignora
 * o clique, e ele clica de novo até acertar uma janela sem loot.
 *
 * ---- O conserto é o mesmo que o ⏱ já usa ----
 *
 * Logo acima, o atalho da auto-venda é montado UMA vez e vive no cabeçalho
 * justamente por isto — está escrito lá: "um botão que pisca junto com o loot
 * é um botão que ninguém acerta". Estes dois ficaram para trás.
 *
 * Aqui eles continuam onde estavam, no corpo e entre o cabeçalho e o loot: o
 * que muda é que o redesenho NÃO ENCOSTA neles.
 *
 * E tem de ser não encostar mesmo. Guardar o nó e prendê-lo de volta no mesmo
 * quadro não resolve — medido: o botão volta sendo o MESMO objeto, ligado à
 * página, e o clique some do mesmo jeito. O navegador desiste do clique no
 * instante em que o nó do `mousedown` sai da página, e não importa que ele
 * volte. Por isso `renderPouch` passou a limpar o corpo POUPANDO esta linha
 * (ver `limparPoupandoAsAcoes`), em vez de apagar tudo e remontar.
 *
 * O que varia é atualizado no lugar: o ON/OFF da venda, e a contagem do filtro.
 */
let linhaDeAcoes = null;

/**
 * Apaga o corpo da bolsa sem tirar a linha de botões da página.
 *
 * É o `body.innerHTML = ''` de antes, menos um filho. Ver `acoesDaBolsa`.
 */
function limparPoupandoAsAcoes(body) {
  const poupar = linhaDeAcoes?.caixa;
  for (const filho of [...body.childNodes]) if (filho !== poupar) filho.remove();
}

function acoesDaBolsa({ character, state, send, espera }) {
  if (!linhaDeAcoes) {
    const caixa = el('div', 'bag-actions');
    const toggle = el('button', 'autosell');
    toggle.append(el('b', null, ''));
    const filtro = el('button', 'loot-filter-button');
    // 23721 (gold pouch) não tem sprite exportado — a caixa vinha vazia e só
    // empurrava o texto para o lado. 2863 é o saco dourado, que tem.
    filtro.append(itemCanvas(2863, 22), el('b', null, 'Loot filter'), el('span', 'count'));
    filtro.onclick = () => ctx.openLootFilter?.();
    caixa.append(toggle, filtro);
    linhaDeAcoes = { caixa, toggle, filtro, conta: filtro.querySelector('.count') };
  }

  const { caixa, toggle, filtro, conta } = linhaDeAcoes;

  const auto = character.settings?.autoSellPouch !== false;
  toggle.className = `autosell ${auto ? 'on' : 'off'}`;
  toggle.querySelector('b').textContent = auto ? 'Auto venda ON' : 'Auto venda OFF';
  toggle.title = auto
    ? `na caçada e no boss, esvazia a bolsa a cada ${espera}s pelo ${precoDaVendaRapida(state.catalog.quickSellRate)}`
    : 'a bolsa não está sendo esvaziada — o loot fica guardado';
  /*
   * O `onclick` é refeito porque ele carrega o `auto` de AGORA: montado uma vez
   * só, o botão continuaria mandando o valor do primeiro desenho e a chave
   * pararia de virar depois do primeiro uso.
   */
  toggle.onclick = () => send({ t: 'settings', autoSellPouch: !auto });

  const rules = character.itemRules ?? { noSell: [], noLoot: [] };
  const marcados = (rules.noSell?.length ?? 0) + (rules.noLoot?.length ?? 0);
  conta.textContent = marcados ? String(marcados) : '';
  conta.hidden = !marcados;
  filtro.title = marcados ? `${marcados} item(ns) no filtro` : 'escolher o que não coletar e o que não vender';

  return caixa;
}

export function renderPouch() {
  if (esperaOArrasto(renderPouch)) return;
  const body = windowBody('loot');
  if (!body) return;
  const { state, send } = ctx;
  const character = state.character;
  const pouch = character.pouch ?? [];

  /*
   * ---- Só o relógio mudou? Então só o relógio muda ----
   *
   * Medido numa caçada (MutationObserver, 5 s): esta janela era a maior fonte
   * de mudança no documento — a grade inteira apagada e remontada a cada
   * segundo, ~40 nós por segundo, porque o servidor manda o relógio da venda
   * automática (`vendaFaltaSegundos`) a cada segundo e isso chamava esta
   * função. Cada remontagem obriga o navegador a recalcular o estilo.
   *
   * A grade depende do que está na bolsa, das regras de item (as marcas das
   * células), da página, e de capacidade e peso (o aviso de sem capacidade).
   * Nada disso mudou: troca o número do relógio e sai.
   */
  const espera0 = character.vendaEmSegundos ?? 120;
  const falta0 = character.vendaFaltaSegundos;
  const assinatura = JSON.stringify([
    pouch, character.pouchSlots, espera0, falta0 == null, character.derived?.capacity, character.weight,
    character.itemRules, paginaDaBolsa, state.catalog?.quickSellRate,
  ]);
  const relogioNaTela = body.querySelector('.bag-timer b');
  if (relogioNaTela && body.dataset.assinaturaDaBolsa === assinatura) {
    const texto = falta0 == null ? `venda a cada ${espera0}s` : `próxima venda em ${falta0}s`;
    if (relogioNaTela.textContent !== texto) relogioNaTela.textContent = texto;
    relogioNaTela.classList.toggle('agora', falta0 != null && falta0 <= 10);
    // O interruptor e o filtro se atualizam sozinhos (ver `acoesDaBolsa`).
    acoesDaBolsa({ character, state, send, espera: espera0 });
    return;
  }
  body.dataset.assinaturaDaBolsa = assinatura;

  // Tudo menos a linha de botões, que não pode piscar. Ver `acoesDaBolsa`.
  limparPoupandoAsAcoes(body);

  /*
   * ---- O atalho para diminuir a espera da auto-venda ----
   *
   * Ele fica no CABEÇALHO da janela, ao lado da engrenagem, e não no corpo:
   * o corpo é redesenhado a cada tique com o loot que caiu, e um botão que
   * pisca junto com o loot é um botão que ninguém acerta. O cabeçalho fica
   * parado.
   *
   * Por isso ele também é montado uma vez só — `renderPouch` roda muitas vezes
   * por segundo, e reinserir o botão a cada passagem o faria perder o hover no
   * meio do clique.
   */
  const janelaDaBolsa = body.closest('.window');
  const cabecalho = janelaDaBolsa?.querySelector('header');
  if (cabecalho && !cabecalho.querySelector('.bag-store')) {
    const atalho = el('button', 'bag-store', '⏱');
    atalho.type = 'button';
    tipTexto(atalho, 'Diminuir o tempo da auto-venda — abre a loja');
    atalho.onclick = (evento) => {
      evento.stopPropagation();
      ctx.abrirLojaEm?.('upgrades');
    };
    cabecalho.insertBefore(atalho, cabecalho.querySelector('.window-reset'));
  }

  /*
   * ---- A contagem de tipos foi para o TÍTULO da janela ----
   *
   * Ela morava na primeira linha do corpo, ao lado de "preço de NPC". Com mil
   * espaços de fábrica ela quase nunca é uma notícia — e estava ocupando a
   * linha mais valiosa da bolsa com um número que não muda de importância.
   *
   * No título ela fica onde se lê o nome da janela, e a linha de dentro passa a
   * mostrar o que muda o tempo todo e o que dá para fazer a respeito: quanto
   * falta para a próxima venda, e o botão de encurtar isso.
   */
  /*
   * ---- E ela fica AO LADO do título, não DENTRO dele ----
   *
   * Dentro do `<h2>` ela sumia por completo: o título tem `overflow: hidden` e
   * `text-overflow: ellipsis`, e na largura de fábrica da janela (246px) faltam
   * 30 pixels — medido, não estimado. O que aparecia era "BOLSA DE LOOT…", com
   * o "5 / 1000" recortado fora da tela. Uma contagem que ninguém vê é pior do
   * que contagem nenhuma, porque ocupa espaço no código e não na tela.
   *
   * Como irmã do título ela tem largura própria e nunca encolhe; quem encolhe
   * é o nome da janela, que é o dado que dá para adivinhar. Ver a regra de
   * `[data-window-id="loot"]` na folha de estilo.
   */
  const slots = character.pouchSlots ?? 1000;
  if (cabecalho) {
    let conta = cabecalho.querySelector('.bag-count');
    if (!conta) {
      conta = el('span', 'bag-count');
      const titulo = cabecalho.querySelector('h2');
      cabecalho.insertBefore(conta, titulo ? titulo.nextSibling : cabecalho.firstChild);
    }
    conta.textContent = `${pouch.length} / ${slots}`;
    conta.classList.toggle('full', pouch.length >= slots);
  }

  /*
   * ---- A linha de cima: o relógio da venda e o botão de encurtá-lo ----
   *
   * "100% do preço de NPC" saiu daqui: é uma taxa que não muda há meses e que
   * ninguém decide nada olhando. O que se olha o tempo todo é quando a bolsa vai
   * esvaziar — e é justamente o número que a loja vende.
   *
   * O "+" leva para a melhoria. Ele fica COLADO no número que ele muda, e não
   * escondido num menu: é a diferença entre anunciar uma compra e responder a
   * uma pergunta que a pessoa acabou de fazer olhando o relógio.
   */
  const espera = character.vendaEmSegundos ?? 120;
  const falta = character.vendaFaltaSegundos;
  const head = el('div', 'bagline');

  const relogio = el('span', 'bag-timer');
  relogio.append(
    el('i', null, '⏱'),
    el(
      'b',
      falta != null && falta <= 10 ? 'agora' : null,
      falta == null ? `venda a cada ${espera}s` : `próxima venda em ${falta}s`
    )
  );
  tipTexto(
    relogio,
    falta == null
      ? `A venda automática só roda na caçada e na sala de boss: lá a bolsa se esvazia a cada ${espera}s, pelo ${precoDaVendaRapida(state.catalog.quickSellRate)}. Na cidade, use o botão Vender.`
      : `A bolsa se esvazia a cada ${espera}s, pelo ${precoDaVendaRapida(state.catalog.quickSellRate)}.`
  );
  head.append(relogio);

  const noMaximo = espera <= 20;
  const mais = el('button', 'bag-timer-buy', noMaximo ? '✓' : '+');
  mais.disabled = noMaximo;
  tipTexto(
    mais,
    noMaximo
      ? 'A auto-venda já está no tempo mínimo.'
      : 'Comprar "Diminuir o tempo da auto-venda" na Store: −20s por compra, até 20s.'
  );
  mais.onclick = () => ctx.abrirLojaEm?.('upgrades');

  /*
   * ---- Os botões viajam JUNTOS, num bloco só ----
   *
   * Report do Appa: "os textos e ícones dos botões vazam pra fora se a janela
   * fica muito pequena". E o dono: "dependendo da largura que eu deixo a
   * mochila os botões tá quebrando e inverte o lado do botão vender com o de
   * limpar".
   *
   * As duas queixas são a mesma linha. Ela era um `flex` com `space-between` e
   * `nowrap`: estreitando a janela, o conteúdo não cabia e transbordava para
   * fora do painel; e quando a quebra foi ligada, o último botão caía sozinho
   * numa segunda linha — onde o `space-between` o joga para a ESQUERDA. Daí a
   * inversão: o Vender aparecia do lado do Limpar.
   *
   * Num bloco só eles quebram juntos, na ordem em que foram escritos, e
   * continuam à direita. O que encolhe é o texto da esquerda, que é o que pode
   * encolher.
   */
  const botoes = el('div', 'bag-botoes');
  botoes.append(mais);
  head.append(botoes);

  /*
   * Esvaziar a bolsa, na própria linha da contagem.
   *
   * Ele vive ao lado do número que dá o motivo dele: quando "20 / 20 tipos"
   * acende, o loot bom começa a ficar no chão por falta de vaga, e é aí que se
   * quer jogar fora o que ninguém compra. Miúdo e nesta linha ele não disputa
   * espaço com o loot nem fica encostado nos botões que se apertam sem pensar.
   * Aqui ele só abre a confirmação; quem destrói é ela.
   */
  const limpar = el('button', 'bag-clear', 'Limpar');
  limpar.disabled = !pouch.length;
  tipTexto(
    limpar,
    pouch.length
      ? 'Joga fora o que está na bolsa. A tela seguinte mostra o que vai sumir e deixa escolher o que fica.'
      : 'A bolsa está vazia.'
  );
  limpar.onclick = () => ctx.openLimparBolsa?.();
  botoes.append(limpar);

  /*
   * ---- E o VENDER, ao lado do Limpar, como na mochila ----
   *
   * O dono: "ao lado do limpar na bolsa de loot tem que ter um botão vender
   * que seria igual o da mochila". Abre a MESMA tela da mochila, apontada para
   * a bolsa (`openVenderMochila('pouch')`), e paga o preço cheio do NPC — o
   * que faz dele o jeito de vender na cidade, onde a venda automática não roda.
   *
   * Depois do Limpar, pelo mesmo motivo da mochila: o destrutivo não fica na
   * ponta onde a mão vai sem olhar.
   */
  const vender = el('button', 'bag-clear bag-sell', 'Vender');
  vender.disabled = !pouch.length;
  tipTexto(
    vender,
    pouch.length
      ? 'Vende para o NPC o que você marcar, pelo preço cheio. Peça com tier ou imbuement só sai com a segunda confirmação.'
      : 'A bolsa está vazia.'
  );
  vender.onclick = () => ctx.openVenderBolsa?.();
  botoes.append(vender);

  // Antes da linha de botões, que já está no lugar e não se mexe daqui.
  body.insertBefore(head, linhaDeAcoes?.caixa ?? null);

  /*
   * Os dois interruptores ficam entre o cabeçalho e o loot, centrados.
   *
   * Nenhum dos dois é uma ação do dia a dia — a venda automática fica ligada
   * por meses e o filtro se mexe uma vez. Botão grande embaixo roubava a
   * atenção do que importa, que é o que caiu. Aqui eles ficam à vista, miúdos,
   * e sem passar por cima de nada.
   */
  // Os MESMOS dois botões de sempre, e não dois botões novos. Ver `acoesDaBolsa`.
  // Entra UMA vez; das outras ela já está aqui, e mover seria tirar da página.
  const caixaDasAcoes = acoesDaBolsa({ character, state, send, espera });
  if (caixaDasAcoes.parentElement !== body) body.append(caixaDasAcoes);

  /*
   * Os dois avisos flutuam no rodapé da janela, fora do fluxo.
   *
   * Empilhados aqui dentro eles empurravam o loot para baixo e comiam metade
   * da bolsa justamente quando ela mais precisava ser vista. Presos no rodapé,
   * avisam sem tomar o lugar de nada.
   */
  const janela = body.closest('.window');
  janela?.querySelector('.bag-alert')?.remove();

  const free = Math.max(0, (character.derived?.capacity ?? 0) - (character.weight ?? 0));
  const semCap = free < 20;
  const cheia = pouch.length >= slots;
  janela?.classList.toggle('nocap', semCap || cheia);

  if (janela && (semCap || cheia)) {
    const alerta = el('div', 'bag-alert');
    alerta.append(
      el('b', null, semCap ? 'Sem capacidade' : 'Bolsa cheia'),
      el(
        'em',
        null,
        semCap
          ? `restam ${free.toFixed(2)} oz — o loot está ficando no chão`
          : `${slots} tipos é o limite — venda ou jogue fora o que não presta`
      )
    );
    janela.append(alerta);
  }

  const grid = el('div', 'bag');
  grid.addEventListener('dragover', (event) => event.preventDefault());
  grid.addEventListener('drop', (event) => {
    event.preventDefault();
    try {
      const payload = JSON.parse(event.dataTransfer.getData('text/plain'));
      // Arrastado do CHÃO para dentro: é recolher. Ver `vindoDoChao`.
      if (vindoDoChao(payload)) return;
      if (juntarArrastando(payload, 'pouch', event)) return;
      if (trocarArrastando(payload, 'pouch', event)) return;
      /*
       * Só o que JÁ está na bolsa se mexe aqui — juntar duas pilhas e separar
       * uma. Vindo da mochila o arrasto morre calado: o servidor recusaria de
       * qualquer jeito, e um aviso a cada vez que a peça passa por cima da
       * janela seria barulho. Ver `movePouch`.
       */
      if (payload.from === 'pouch') separarArrastando(payload, 'pouch');
    } catch {
      /* ignora */
    }
  });

  /*
   * ---- Cem por página ----
   *
   * A bolsa tem mil espaços, e mil quadradinhos de item numa janela flutuante
   * não é uma bolsa: é uma parede. Pior, é uma parede que o navegador redesenha
   * várias vezes por segundo enquanto a caçada corre.
   *
   * Cem cabem numa janela grande sem rolagem infinita e cabem no orçamento do
   * desenho. O resto está a um clique.
   *
   * A página vive no MÓDULO e não no estado do jogo: ela é de quem está olhando
   * agora, não do personagem. Ela também se corrige sozinha quando o loot é
   * vendido e a bolsa encolhe — sem isso, a venda automática deixaria a pessoa
   * parada numa página 7 que já não existe, olhando o vazio.
   */
  const POR_PAGINA = 100;
  const paginas = Math.max(1, Math.ceil(pouch.length / POR_PAGINA));
  if (paginaDaBolsa >= paginas) paginaDaBolsa = paginas - 1;
  const inicio = paginaDaBolsa * POR_PAGINA;
  const nesta = pouch.slice(inicio, inicio + POR_PAGINA);

  for (const [ordem, entry] of nesta.entries()) {
    // A bolsa ja levava tudo no clique; com shift agora da' para escolher.
    grid.append(
      itemCell(entry, 'pouch', {
        // O índice é o da lista INTEIRA, e não o da página: é ele que o
        // servidor conhece. Ver `mergeStacks`.
        pilha: inicio + ordem,
        /*
         * ---- Com uma caixa do depósito aberta, o destino é ELA ----
         *
         * "eu tenho que conseguir tirar as coisas da loot pouch, seja pra
         * mochila, seja pro depósito."
         *
         * É o mesmo gesto que a mochila já tem, com a mesma regra: clique seco
         * guarda a pilha inteira, shift pergunta quanto. Sem isto, guardar o
         * loot era sempre dois passos — bolsa para mochila, mochila para caixa
         * —, e o passo do meio esbarra nas vinte vagas da mochila justamente
         * quando ela está cheia, que é quando se vai ao depósito.
         */
        titulo: () =>
          ctx.caixaDoDepositoAberta?.() != null ? 'Quanto vai para a caixa?' : 'Quanto vai para a mochila?',
        // Guardar começa em tudo; mover para a mochila também. Ver `itemCell`.
        onClick: (_, quantos) => {
          const pilha = inicio + ordem;
          const alvo = alvoDaPeca(entry, pilha);
          const caixa = ctx.caixaDoDepositoAberta?.();
          if (caixa != null) {
            /*
             * `alvo` leva `onde: 'pouch'` para o servidor procurar na BOLSA e
             * não na mochila — com uma cópia do mesmo id nas duas, era a da
             * mochila que ia para a caixa. Ver `takeItemComExtras`.
             */
            return void send({
              t: 'depot',
              action: 'store',
              id: entry.id,
              count: quantos ?? entry.count,
              caixa,
              alvo: { ...alvo, onde: 'pouch' },
            });
          }
          // A `pilha` diz QUAL cópia vai: sem ela o servidor pega a primeira do id.
          send({ t: 'pouch', id: entry.id, count: quantos ?? entry.count, to: 'bag', pilha, alvo });
        },
      })
    );
  }
  if (!pouch.length) grid.append(el('p', 'empty', 'A bolsa está vazia — vá caçar.'));
  body.append(grid);

  /*
   * A barra de páginas só aparece quando há mais de uma.
   *
   * Uma barra dizendo "1 de 1" é uma linha de interface que nunca informa nada
   * — e ela ficaria na tela de todo mundo, o tempo todo, já que a bolsa passa a
   * vida com menos de cem tipos dentro.
   */
  if (paginas > 1) {
    const barra = el('div', 'bag-pages');
    const ir = (para) => {
      paginaDaBolsa = Math.max(0, Math.min(paginas - 1, para));
      renderPouch();
    };
    const botao = (rotulo, destino, ligado) => {
      const b = el('button', null, rotulo);
      b.disabled = !ligado;
      b.onclick = () => ir(destino);
      return b;
    };
    barra.append(
      botao('‹', paginaDaBolsa - 1, paginaDaBolsa > 0),
      el('span', null, `${inicio + 1}–${inicio + nesta.length} de ${pouch.length}`),
      botao('›', paginaDaBolsa + 1, paginaDaBolsa < paginas - 1)
    );
    body.append(barra);
  }
}

/*
 * ---- A JANELA DA BOSS POUCH ----
 *
 * "seria tipo você clica e ela abre como se fosse uma mochila mesmo, e aí teria
 * tudo que eu coletei lá e eu conseguiria arrastar pra mochila ou pôr esses
 * itens no market e etc, e os botões ficariam em cima sabe, a mesma lógica da
 * mochila e não por modal."
 *
 * Então ela é isto: a mesma grade de células da mochila e da bolsa de loot, com
 * os mesmos gestos. Clique leva a pilha para a mochila, shift+clique pergunta
 * quanto, arrastar para a janela da mochila leva também, e o botão direito abre
 * o menu de sempre.
 *
 * ---- O mercado não precisou de porta nova ----
 *
 * Anunciar tira da MOCHILA (ver `createOffer`, no servidor). Com a saída para
 * a mochila existindo, "pôr no market" é o caminho de sempre em dois passos —
 * e uma segunda porta ("anunciar direto da bolsa") seria um segundo lugar de
 * onde a mesma peça sai de uma lista. É assim que nasce um clone.
 *
 * ---- Os dois botões em cima abrem as telas que já existiam ----
 *
 * "Vender" e "Limpar" ficam no cabeçalho, como na mochila, e abrem a MESMA tela
 * de marcação de antes (`openVenderBossPouch`) — com confirmação, cancelar,
 * marcar tudo e marcar só o que o NPC compra. O modal não foi jogado fora: ele
 * deixou de ser a porta da bolsa e virou o que sempre foi bom em ser, uma tela
 * de escolher em lote.
 */
export function renderBossPouch() {
  if (esperaOArrasto(renderBossPouch)) return;
  const body = windowBody('bossPouch');
  if (!body) return;
  const { state, send } = ctx;
  const character = state.character;
  const bolsa = character.bossPouch ?? [];
  const slots = character.bossPouchSlots ?? 1000;

  /*
   * A contagem vai para o CABEÇALHO, ao lado do nome da janela — o mesmo lugar
   * e o mesmo motivo da Bolsa de Loot: dentro do `<h2>` ela seria recortada
   * pelo `text-overflow`, e uma contagem que ninguém vê é pior do que nenhuma.
   */
  const cabecalho = body.closest('.window')?.querySelector('header');
  if (cabecalho) {
    let conta = cabecalho.querySelector('.bag-count');
    if (!conta) {
      conta = el('span', 'bag-count');
      const titulo = cabecalho.querySelector('h2');
      cabecalho.insertBefore(conta, titulo ? titulo.nextSibling : cabecalho.firstChild);
    }
    conta.textContent = `${bolsa.length} / ${slots}`;
    conta.classList.toggle('full', bolsa.length >= slots);
  }

  /*
   * A cabeça serve enquanto ela estiver PENDURADA neste corpo. O sistema de
   * janelas pode ter refeito o `body` por baixo (fechar e reabrir a bolsa), e
   * uma cabeça órfã continuaria existindo na variável sem aparecer na tela.
   * Mesma guarda de `renderContainer`.
   */
  if (cabecaDaBolsaDeBoss && cabecaDaBolsaDeBoss.head.parentNode === body) {
    atualizarCabecaDaBolsaDeBoss(cabecaDaBolsaDeBoss, bolsa, slots);
    // O botao do cabecalho sobrevive ao retrato; so' o `disabled` muda.
    botaoNoCabecalho('bossPouch', {
      classe: 'window-organizar',
      texto: '⇅',
      titulo: 'Organizar a Boss Pouch por nome — não junta pilhas, não vende e não joga nada fora',
      desligado: bolsa.length < 2,
      aoClicar: () => pedirParaOrganizar('bossPouch'),
    });
    encherGradeDaBolsaDeBoss(cabecaDaBolsaDeBoss.grid, bolsa, send);
    /* A barra de páginas nasce e morre com a contagem: ela é refeita junto. */
    cabecaDaBolsaDeBoss.paginas.replaceChildren();
    barraDasPaginasDaBolsa(cabecaDaBolsaDeBoss.paginas, bolsa);
    return;
  }

  body.innerHTML = '';
  const head = el('div', 'bagline');
  const titulo = el('span', 'bag-titulo');
  titulo.append(el('span', null, 'Boss Pouch'), el('b', null, `${bolsa.length} / ${slots}`));
  tipTexto(
    titulo,
    'Tudo o que você tira do baú de recompensa de boss cai aqui, e não na mochila.\n' +
      'Ela é fixa no personagem: não sai, não pode ser retirada, e continua com tudo se você trocar de mochila.'
  );
  head.append(titulo);

  /*
   * Os dois botões viajam juntos num bloco só, pelo mesmo motivo da bolsa de
   * loot: estreitando a janela eles quebram na ordem em que foram escritos e
   * continuam à direita, em vez de o último cair sozinho numa segunda linha e
   * trocar de lado. Ver a nota do `bag-botoes`, em `renderPouch`.
   *
   * E o destrutivo vem PRIMEIRO, como na mochila: quem entra sem olhar entra
   * pela ponta, e a ponta não pode ser o botão que apaga.
   */
  const botoes = el('div', 'bag-botoes');
  const limpar = el('button', 'bag-clear', 'Limpar');
  limpar.disabled = !bolsa.length;
  tipTexto(
    limpar,
    bolsa.length
      ? 'Joga fora o que você marcar. A tela seguinte mostra o que vai sumir, já guarda o que tem estrela, tier ou imbuement, e pergunta antes.'
      : 'A Boss Pouch está vazia.'
  );
  limpar.onclick = () => ctx.openVenderBossPouch?.();

  const vender = el('button', 'bag-clear bag-sell', 'Vender');
  vender.disabled = !bolsa.length;
  tipTexto(
    vender,
    bolsa.length
      ? 'Vende para o NPC o que você marcar. Paga o preço cheio, e peça com tier ou imbuement não entra sem a segunda confirmação.'
      : 'A Boss Pouch está vazia.'
  );
  vender.onclick = () => ctx.openVenderBossPouch?.();

  botoes.append(limpar, vender);
  head.append(botoes);
  body.append(head);

  /* O mesmo botao da mochila, na janela dela. Ver `botaoNoCabecalho`. */
  botaoNoCabecalho('bossPouch', {
    classe: 'window-organizar',
    texto: '⇅',
    titulo: 'Organizar a Boss Pouch por nome — não junta pilhas, não vende e não joga nada fora',
    desligado: bolsa.length < 2,
    aoClicar: () => pedirParaOrganizar('bossPouch'),
  });

  const grid = el('div', 'bag');
  /*
   * A janela não RECEBE nada: a bolsa é abastecida pelo baú de recompensa e por
   * mais nada (ver `addToBossPouch`). Mil vagas que aceitassem qualquer coisa
   * seriam um depósito de graça no bolso, e o jogo já tem depósito.
   *
   * O arrasto vindo de fora morre calado, como na bolsa de loot: o servidor
   * recusaria de qualquer jeito, e um aviso a cada vez que a peça passa por
   * cima da janela seria barulho.
   */
  grid.addEventListener('dragover', (event) => event.preventDefault());
  /*
   * De FORA nao entra nada (a nota acima), mas de dentro para dentro sim: e' o
   * arrastar-para-trocar, e a Boss Pouch e' justamente a que mais precisa dele
   * — ela tem mil vagas e enche na ordem em que os bosses morreram.
   */
  grid.addEventListener('drop', (event) => {
    event.preventDefault();
    try {
      trocarArrastando(JSON.parse(event.dataTransfer.getData('text/plain')), 'bossPouch', event);
    } catch {
      /* arrasto de fora da pagina */
    }
  });
  encherGradeDaBolsaDeBoss(grid, bolsa, send);
  body.append(grid);

  /* A barra de páginas mora num nó próprio, que é esvaziado e refeito. */
  const paginas = el('div', 'bag-pages-caixa');
  barraDasPaginasDaBolsa(paginas, bolsa);
  body.append(paginas);

  cabecaDaBolsaDeBoss = { head, titulo, limpar, vender, grid, paginas };
}

/** Reescreve só o que muda na linha de cima: a contagem e os dois `disabled`. */
function atualizarCabecaDaBolsaDeBoss(cabeca, bolsa, slots) {
  const contador = cabeca.titulo.querySelector('b');
  if (contador) contador.textContent = `${bolsa.length} / ${slots}`;
  cabeca.limpar.disabled = !bolsa.length;
  cabeca.vender.disabled = !bolsa.length;
}

/*
 * A grade da bolsa, do zero. Ela é o que MUDA, e por isso é a única parte
 * refeita nos retratos seguintes — a linha de cima sobrevive.
 */
function encherGradeDaBolsaDeBoss(grid, bolsa, send) {
  grid.innerHTML = '';
  const POR_PAGINA = 100;
  const paginas = Math.max(1, Math.ceil(bolsa.length / POR_PAGINA));
  if (paginaDaBossPouch >= paginas) paginaDaBossPouch = paginas - 1;
  const inicio = paginaDaBossPouch * POR_PAGINA;

  for (const [ordem, entry] of bolsa.slice(inicio, inicio + POR_PAGINA).entries()) {
    // O índice é o da lista INTEIRA, e não o da página: é ele que o servidor
    // conhece. Ver `tirarPecas`.
    const pilha = inicio + ordem;
    grid.append(
      itemCell(entry, 'bossPouch', {
        size: 32,
        pilha,
        titulo: 'Quanto vai para a mochila?',
        onClick: (_, quantos) =>
          send({
            t: 'bossPouch',
            mover: { id: entry.id, count: quantos ?? entry.count, pilha, alvo: alvoDaPeca(entry, pilha) },
          }),
      })
    );
  }
  if (!bolsa.length) {
    grid.append(el('p', 'empty', 'A Boss Pouch está vazia — o baú de recompensa de boss desemboca aqui.'));
  }
}

/*
 * A barra de páginas, dentro do nó que a guarda. Ela só aparece quando há mais
 * de uma — "1 de 1" é uma linha que nunca informa nada, e a bolsa passa a vida
 * com menos de cem tipos dentro. Ver a nota em `renderPouch`.
 */
function barraDasPaginasDaBolsa(caixa, bolsa) {
  const POR_PAGINA = 100;
  const paginas = Math.max(1, Math.ceil(bolsa.length / POR_PAGINA));
  if (paginas <= 1) return;
  const inicio = paginaDaBossPouch * POR_PAGINA;
  const nesta = bolsa.slice(inicio, inicio + POR_PAGINA);

  const barra = el('div', 'bag-pages');
  const ir = (para) => {
    paginaDaBossPouch = Math.max(0, Math.min(paginas - 1, para));
    renderBossPouch();
  };
  const botao = (rotulo, destino, ligado) => {
    const b = el('button', null, rotulo);
    b.disabled = !ligado;
    b.onclick = () => ir(destino);
    return b;
  };
  barra.append(
    botao('‹', paginaDaBossPouch - 1, paginaDaBossPouch > 0),
    el('span', null, `${inicio + 1}–${inicio + nesta.length} de ${bolsa.length}`),
    botao('›', paginaDaBossPouch + 1, paginaDaBossPouch < paginas - 1)
  );
  caixa.append(barra);
}

/*
 * ---- A STORE INBOX, a janela ----
 *
 * O dono (15/09): "as coisas compradas na store chegam num lugar exclusivo,
 * igual a crystalserver", "dentro da mochila e dentro da store, ao lado de
 * Histórico", "com páginas, uns 2000 itens", "sem poder colocar coisas dentro".
 *
 * É a Boss Pouch sem o Vender e o Limpar: o que se compra não é entulho de
 * baú, e jogar fora uma compra por engano não tem volta. Os gestos são os
 * mesmos — clique leva a pilha para a mochila, shift+clique pergunta quanto,
 * arrastar para a mochila leva também, e dentro dela dá para reorganizar.
 * Nada de fora entra (ver `STORE_INBOX_SLOTS`, no servidor).
 */
let paginaDaStoreInbox = 0;
let cabecaDaStoreInbox = null;
const POR_PAGINA_DA_INBOX = 100;

export function renderStoreInbox() {
  if (esperaOArrasto(renderStoreInbox)) return;
  const body = windowBody('storeInbox');
  if (!body) return;
  const { state, send } = ctx;
  const inbox = state.character.storeInbox ?? [];
  const slots = state.character.storeInboxSlots ?? 2000;

  const cabecalho = body.closest('.window')?.querySelector('header');
  if (cabecalho) {
    let conta = cabecalho.querySelector('.bag-count');
    if (!conta) {
      conta = el('span', 'bag-count');
      const titulo = cabecalho.querySelector('h2');
      cabecalho.insertBefore(conta, titulo ? titulo.nextSibling : cabecalho.firstChild);
    }
    conta.textContent = `${inbox.length} / ${slots}`;
    conta.classList.toggle('full', inbox.length >= slots);
  }
  botaoNoCabecalho('storeInbox', {
    classe: 'window-organizar',
    texto: '⇅',
    titulo: 'Organizar a Store Inbox por nome — não junta pilhas e não joga nada fora',
    desligado: inbox.length < 2,
    aoClicar: () => pedirParaOrganizar('storeInbox'),
  });

  if (!(cabecaDaStoreInbox && cabecaDaStoreInbox.head.parentNode === body)) {
    body.innerHTML = '';
    const head = el('div', 'bagline');
    const titulo = el('span', 'bag-titulo');
    const contador = el('b', null, '');
    titulo.append(el('span', null, 'Store Inbox'), contador);
    tipTexto(
      titulo,
      'Tudo o que você compra na Store chega aqui, e não na mochila.\n' +
        'Nada pode ser colocado dentro dela. Sem cap ou sem vaga, a compra vai para a caixa Chegadas do depósito.'
    );
    head.append(titulo);
    body.append(head);

    const grid = el('div', 'bag');
    grid.addEventListener('dragover', (event) => event.preventDefault());
    // De fora não entra nada; de dentro para dentro é o arrastar-para-trocar.
    grid.addEventListener('drop', (event) => {
      event.preventDefault();
      try {
        trocarArrastando(JSON.parse(event.dataTransfer.getData('text/plain')), 'storeInbox', event);
      } catch {
        /* arrasto de fora da pagina */
      }
    });
    body.append(grid);
    const paginas = el('div', 'bag-pages-caixa');
    body.append(paginas);
    cabecaDaStoreInbox = { head, contador, grid, paginas };
  }

  const { contador, grid, paginas } = cabecaDaStoreInbox;
  contador.textContent = `${inbox.length} / ${slots}`;

  grid.innerHTML = '';
  const total = Math.max(1, Math.ceil(inbox.length / POR_PAGINA_DA_INBOX));
  if (paginaDaStoreInbox >= total) paginaDaStoreInbox = total - 1;
  const inicio = paginaDaStoreInbox * POR_PAGINA_DA_INBOX;
  for (const [ordem, entry] of inbox.slice(inicio, inicio + POR_PAGINA_DA_INBOX).entries()) {
    const pilha = inicio + ordem;
    grid.append(
      itemCell(entry, 'storeInbox', {
        size: 32,
        pilha,
        titulo: 'Quanto vai para a mochila?',
        onClick: (_, quantos) =>
          send({ t: 'storeInbox', mover: { id: entry.id, count: quantos ?? entry.count, pilha, alvo: alvoDaPeca(entry, pilha) } }),
      })
    );
  }
  if (!inbox.length) grid.append(el('p', 'empty', 'A Store Inbox está vazia — o que você comprar na Store chega aqui.'));

  paginas.replaceChildren();
  if (total > 1) {
    const nesta = inbox.slice(inicio, inicio + POR_PAGINA_DA_INBOX);
    const barra = el('div', 'bag-pages');
    const botao = (rotulo, destino, ligado) => {
      const b = el('button', null, rotulo);
      b.disabled = !ligado;
      b.onclick = () => {
        paginaDaStoreInbox = Math.max(0, Math.min(total - 1, destino));
        renderStoreInbox();
      };
      return b;
    };
    barra.append(
      botao('‹', paginaDaStoreInbox - 1, paginaDaStoreInbox > 0),
      el('span', null, `${inicio + 1}–${inicio + nesta.length} de ${inbox.length}`),
      botao('›', paginaDaStoreInbox + 1, paginaDaStoreInbox < total - 1)
    );
    paginas.append(barra);
  }
}

/** Abre a janela da Store Inbox e a desenha na hora. A mesma porta da mochila e da Store. */
export function abrirStoreInbox() {
  setVisible('storeInbox', true);
  renderStoreInbox();
}

/** Da Store Inbox para a mochila, pelo ARRASTO. O mesmo corpo de `soltarDaBossPouch`. */
function soltarDaStoreInbox(payload) {
  const lista = ctx.state.character.storeInbox ?? [];
  const dePilha = Number.isInteger(Number(payload.pilha)) ? Number(payload.pilha) : null;
  const posto = dePilha != null ? lista[dePilha] : null;
  if (posto && posto.id !== payload.id) return;
  const mandar = (count) =>
    ctx.send({ t: 'storeInbox', mover: { id: payload.id, count, pilha: dePilha, alvo: payload.alvo ?? null } });
  if (!ctx.state.items?.[payload.id]?.stackable) return void mandar(posto?.count ?? 1);
  quantosMover(payload, mandar);
}

/*
 * O desenho da Store Inbox: o item 55368 (`ITEM_DA_STORE_INBOX`), escolhido
 * pelo dono. Se o atlas vier sem ele, o ícone da Coleção da ficha.
 */
function iconeDaStoreInbox() {
  if (itemSprite(ITEM_DA_STORE_INBOX)) return itemCanvas(ITEM_DA_STORE_INBOX, 32);
  const img = document.createElement('img');
  img.className = 'store-inbox-icone';
  img.alt = '';
  img.width = 32;
  img.height = 32;
  img.src = '/client/assets/icons/ficha-colecao.png';
  img.onerror = () => img.replaceWith(itemCanvas(3503, 32));
  return img;
}

function celulaDaStoreInbox(character) {
  const inbox = character.storeInbox ?? [];
  const slots = character.storeInboxSlots ?? 2000;
  const cell = el('div', 'cell store-inbox-cell');
  cell.append(iconeDaStoreInbox());
  if (inbox.length) cell.append(el('b', 'count', String(inbox.length)));
  tipTexto(
    cell,
    `Store Inbox — ${inbox.length} de ${slots} vagas.\n` +
      'Tudo o que você compra na Store chega aqui.\n' +
      'Clique para abrir: de lá as compras saem para a mochila.\n' +
      'Itens usáveis também se usam direto de lá (botão direito → Usar).'
  );
  cell.onclick = () => {
    toggleWindow('storeInbox');
    renderStoreInbox();
  };
  return cell;
}

/*
 * Tira uma peça da Boss Pouch e põe na mochila — o caminho do ARRASTO.
 *
 * O clique não passa por aqui: `itemCell` já resolve o shift dele com a régua.
 * Quem larga é que pergunta, porque no arrasto do navegador não dá para abrir
 * uma janela no meio do gesto. Ver `quantosMover`.
 */
function soltarDaBossPouch(payload) {
  const lista = ctx.state.character.bossPouch ?? [];
  const dePilha = Number.isInteger(Number(payload.pilha)) ? Number(payload.pilha) : null;
  const posto = dePilha != null ? lista[dePilha] : null;
  // A célula arrastada já não é a que estava ali: o retrato andou no meio do
  // gesto. Melhor não mover nada do que mover a peça errada.
  if (posto && posto.id !== payload.id) return;
  const mandar = (count) =>
    ctx.send({ t: 'bossPouch', mover: { id: payload.id, count, pilha: dePilha, alvo: payload.alvo ?? null } });
  // Peça que não empilha vai inteira: "quantas?" não tem resposta certa quando
  // existe uma por vez. Mesma regra do `moverComQuantidade`.
  if (!ctx.state.items?.[payload.id]?.stackable) return void mandar(posto?.count ?? 1);
  quantosMover(payload, mandar);
}

/*
 * ---- A CABECA da mochila nao e' refeita a cada retrato ----
 *
 * O report do Sabido: "conforme tu ta upando, esse botao fica piscando igual o
 * carai; ai tem que ficar apertando igual doido tentando acertar o time p
 * conseguir". O print e' esta janela, com o Limpar e o Vender.
 *
 * E' o mesmo defeito que a barra de acoes ja teve, com a mesma causa e a mesma
 * cura (ver a nota do `chaveHotbar`, em actionbar.mjs). `renderContainer` fazia
 * `body.innerHTML = ''` e montava tudo de novo — e ela roda toda vez que a
 * `bagKey` muda, ou seja, a cada item que cai no loot. Cacando, isso e' varias
 * vezes por segundo.
 *
 * O `pointerdown` do jogador pegava um botao que o retrato seguinte jogava
 * fora, e o `pointerup` caia num botao NOVO: sem os dois no mesmo no', o
 * navegador nao dispara `click`. Acertar era ter sorte com a janelinha entre
 * dois desenhos — literalmente o "acertar o time" do report.
 *
 * A grade de itens continua sendo refeita: ela MUDA a cada loot, e e' para isso
 * que o retrato existe. O que passa a sobreviver e' a linha de cima, que nao
 * muda quase nunca — dela so' o texto do contador e o `disabled` dos dois
 * botoes sao reescritos, nos nos que ja estao la'.
 */
let cabecaDaMochila = null;

/** O conteúdo da mochila equipada, aberto com o botão direito no slot. */
export function renderContainer() {
  if (esperaOArrasto(renderContainer)) return;
  const body = windowBody('container');
  if (!body) return;
  const { state } = ctx;
  const character = state.character;
  const backpack = character.equipment.backpack;

  if (!backpack) {
    cabecaDaMochila = null;
    body.innerHTML = '';
    body.append(el('p', 'empty', 'Nenhuma mochila equipada.'));
    return;
  }

  /*
   * A cabeca serve enquanto ela estiver PENDURADA neste corpo. O sistema de
   * janelas pode ter refeito o `body` por baixo (fechar e reabrir a mochila), e
   * uma cabeca orfa continuaria existindo na variavel sem aparecer na tela.
   */
  if (cabecaDaMochila && cabecaDaMochila.head.parentNode === body) {
    const meta = state.items[backpack.id];
    atualizarCabecaDaMochila(cabecaDaMochila, character, meta);
    // O botão do cabeçalho sobrevive ao retrato — ele mora na moldura da
    // janela, e não neste corpo. Só o `disabled` anda com a mochila.
    botaoNoCabecalho('container', {
      classe: 'window-organizar',
      texto: '⇅',
      titulo: 'Organizar a mochila por nome — não junta pilhas, não vende e não joga nada fora',
      desligado: character.inventory.length < 2,
      aoClicar: () => pedirParaOrganizar('bag'),
    });
    /*
     * A grade só é remontada quando o que ELA mostra mudou.
     *
     * Esta função é chamada com as outras janelas de itens sempre que a chave da
     * mochila muda (`bagKey`, em main.mjs) — e essa chave inclui o valor da bolsa
     * de loot, que o servidor manda a cada segundo junto com o relógio da venda.
     * Medido numa caçada: a grade inteira da mochila e a faixa da Boss Pouch eram
     * apagadas e remontadas a cada segundo sem nada nelas ter mudado.
     */
    const assinatura = JSON.stringify([
      character.inventory, character.itemRules ?? null, character.bossPouch ?? null,
      character.storeInbox ?? null, character.imbuements ?? null,
    ]);
    if (cabecaDaMochila.assinatura === assinatura) return;
    cabecaDaMochila.assinatura = assinatura;
    cabecaDaMochila.grid.innerHTML = '';
    encherGradeDaMochila(cabecaDaMochila.grid, character, state);
    // A faixa da Boss Pouch tem o contador dela, que anda junto.
    encherFaixaDaBolsa(cabecaDaMochila.faixaDaBolsa, character, state);
    return;
  }

  body.innerHTML = '';
  const meta = state.items[backpack.id];
  const head = el('div', 'bagline');
  // O nome é o único que pode encolher — ver a nota do `bag-botoes`, na bolsa.
  const titulo = el('span', 'bag-titulo');
  const nomeDaPeca = el('span', null, meta?.name ?? 'mochila');
  const contador = el('b', null, `${character.inventory.length} / ${meta?.container ?? 20}`);
  titulo.append(nomeDaPeca, contador);
  head.append(titulo);
  const botoes = el('div', 'bag-botoes');
  head.append(botoes);
  /*
   * ---- E o Limpar, no mesmo lugar em que ele está na bolsa de loot ----
   *
   * "coloca um botão Limpar na mochila igual tem na bolsa de loot." Mesmo
   * botão, mesma linha, ao lado do mesmo número — porque é esse número que dá
   * o motivo dele: quando 20/20 acende, o loot bom começa a ficar no chão.
   *
   * Aqui ele só abre a tela; quem destrói é ela, e ela pergunta duas vezes.
   * Ver `openLimparMochila`.
   */
  const limpar = el('button', 'bag-clear', 'Limpar');
  limpar.disabled = !character.inventory.length;
  tipTexto(
    limpar,
    character.inventory.length
      ? 'Joga fora o que está na mochila. A tela seguinte mostra o que vai sumir, já guarda o que tem estrela, tier ou imbuement, e pergunta duas vezes.'
      : 'A mochila está vazia.'
  );
  limpar.onclick = () => ctx.openLimparMochila?.();
  botoes.append(limpar);

  /*
   * ---- E o Vender, ao lado dele ----
   *
   * "criar um botão na mochila ao lado de limpar que seria vender, que ao
   * clicar abre um modal com os itens pra vender pro npc — igual na loot pouch
   * só que manual."
   *
   * Os dois botões respondem à mesma pressão — a mochila cheia — por caminhos
   * opostos: um joga fora, o outro troca por ouro. Ficam lado a lado porque a
   * escolha entre eles é a mesma decisão, tomada no mesmo instante, olhando o
   * mesmo "20 / 20".
   *
   * A ordem importa: Vender ANTES de Limpar seria pôr o botão que destrói na
   * ponta, onde a mão vai sem pensar. Aqui o destrutivo é o que já estava, e o
   * novo entra depois dele.
   *
   * Este também só abre a tela. Quem vende é ela, e ela vende só o que estiver
   * marcado. Ver `openVenderMochila`.
   */
  const vender = el('button', 'bag-clear bag-sell', 'Vender');
  vender.disabled = !character.inventory.length;
  tipTexto(
    vender,
    character.inventory.length
      ? 'Vende para o NPC o que você marcar. Paga o preço cheio, e peça com tier ou imbuement não entra.'
      : 'A mochila está vazia.'
  );
  vender.onclick = () => ctx.openVenderMochila?.();
  botoes.append(vender);
  body.append(head);

  /*
   * O "Organizar" da mochila vive no CABECALHO DA JANELA, colado na
   * engrenagem, e nao nesta linha de botoes: "ao lado da engrenagem". A linha
   * de baixo e' dos dois botoes que MEXEM no que existe (jogar fora, vender);
   * este so' muda a ordem, e misturar os tres poria o inofensivo ao lado do
   * que apaga. Ver `botaoNoCabecalho`.
   */
  botaoNoCabecalho('container', {
    classe: 'window-organizar',
    texto: '⇅',
    titulo: 'Organizar a mochila por nome — não junta pilhas, não vende e não joga nada fora',
    desligado: character.inventory.length < 2,
    aoClicar: () => pedirParaOrganizar('bag'),
  });

  /*
   * A faixa da Boss Pouch, entre o cabeçalho e a grade. Ver `celulaDaBossPouch`.
   *
   * Ela é refeita a cada retrato junto com a grade — o contador dela muda
   * quando alguém pega uma recompensa —, e por isso é guardada no
   * `cabecaDaMochila`, como a grade é.
   */
  const faixaDaBolsa = el('div', 'bag-boss-pouch');
  body.append(faixaDaBolsa);

  const grid = el('div', 'bag');
  cabecaDaMochila = { head, nomeDaPeca, contador, limpar, vender, grid, faixaDaBolsa };
  grid.addEventListener('dragover', (event) => event.preventDefault());
  grid.addEventListener('drop', (event) => {
    event.preventDefault();
    try {
      const payload = JSON.parse(event.dataTransfer.getData('text/plain'));
      if (vindoDoChao(payload)) return;
      if (juntarArrastando(payload, 'bag', event)) return;
      if (trocarArrastando(payload, 'bag', event)) return;
      if (payload.from === 'equipment') ctx.send({ t: 'unequip', slot: state.items[payload.id]?.slot });
      else if (payload.from === 'pouch') moverComQuantidade(payload.id, 'pouch', 'bag', payload.pilha, payload.alvo ?? null);
      // E da Boss Pouch, que é a saída dela: "eu conseguiria arrastar pra
      // mochila". Ver `soltarDaBossPouch`.
      else if (payload.from === 'bossPouch') soltarDaBossPouch(payload);
      // E da Store Inbox, que só tem saída. Ver `soltarDaStoreInbox`.
      else if (payload.from === 'storeInbox') soltarDaStoreInbox(payload);
      else if (payload.from === 'bag') separarArrastando(payload, 'bag');
    } catch {
      /* ignora */
    }
  });

  encherFaixaDaBolsa(faixaDaBolsa, character, state);
  encherGradeDaMochila(grid, character, state);
  body.append(grid);
}

/*
 * A grade da mochila, do zero. Ela e' o que MUDA a cada loot, e por isso e' a
 * unica parte refeita nos retratos seguintes — a linha de cima sobrevive. Ver
 * a nota de `cabecaDaMochila`.
 */
/*
 * ---- A BOSS POUCH, presa no primeiro quadradinho da mochila ----
 *
 * Pedido do dono: "dentro da mochila que a pessoa estiver equipada vai ser um
 * negócio chamado Boss Pouch, que terá a sprite da Loot Pouch. E como vai
 * funcionar isso: ao abrir vai ter 1.000 slots, com botão limpar, vender igual
 * da mochila normal e etc."
 *
 * Ela é DESENHADA dentro da mochila e não MORA nela: por baixo é uma lista
 * própria do personagem (ver `addToBossPouch`, no servidor), e é isso que a faz
 * ser fixa, não sair, e sobreviver à troca de mochila sem nenhum caminho de
 * mover, vender ou jogar fora precisar saber que ela existe.
 *
 * Ela não conta nos `20 / 20` da mochila pela mesma razão: não ocupa vaga
 * nenhuma, porque não está lá dentro.
 *
 * ---- E ela fica ACIMA da grade, não DENTRO dela ----
 *
 * A primeira versão a punha como primeira célula da `.bag`, e isso quebrou uma
 * invariante que meio cliente usa sem dizer: a grade da mochila tem UMA célula
 * por entrada do inventário, na mesma ordem. Quem lê `cells[i]` para achar a
 * peça `i` passou a achar a bolsa.
 *
 * O `test-deposito-tela` pegou isso no mesmo minuto — ele procura a grade pelo
 * número de células e clica na de índice `i`. Consertar o teste seria consertar
 * o termômetro: a invariante é boa e vale mais do que a posição do
 * quadradinho.
 *
 * Numa faixa própria logo acima, ela continua sendo "dentro da mochila" para
 * quem olha, e a grade continua sendo o que ela sempre foi.
 *
 * ---- A sprite é a da GOLD POUCH ----
 *
 * "a sprite da boss pouch tem que ser a de gold pouch."
 *
 * A primeira versão usava a `golden bag` (2863) porque a gold pouch de verdade
 * não estava no atlas: ela é um container da gamestore dele, e nenhuma das
 * regras do pipeline a alcançava — não cai de bicho, não se veste, não tem
 * preço. `itemCanvas(23721)` desenhava um quadrado vazio.
 *
 * Agora ela existe (ver `packages/shared/src/boss-pouch.mjs`), e a `golden bag`
 * ficou como reserva: se um dia o atlas vier sem ela, uma bolsa parecida é
 * melhor do que um buraco no meio da mochila.
 */
/*
 * O id que a bolsa desenha: a gold pouch, ou a golden bag se o atlas vier sem
 * ela. A pergunta é ao MANIFESTO de sprites e não ao catálogo de itens — é ele
 * que decide se `itemCanvas` tem o que desenhar, e é ele que uma reextração
 * pode deixar para trás.
 */
const desenhoDaBossPouch = () =>
  itemSprite(ITEM_DA_BOSS_POUCH) ? ITEM_DA_BOSS_POUCH : ITEM_DA_BOSS_POUCH_RESERVA;

function celulaDaBossPouch(character, state) {
  const bolsa = character.bossPouch ?? [];
  const slots = character.bossPouchSlots ?? 1000;
  // `cell` é a classe que todo quadradinho do jogo usa — ver `itemCell`.
  const cell = el('div', 'cell boss-pouch-cell');
  cell.append(itemCanvas(desenhoDaBossPouch(), 32));
  if (bolsa.length) cell.append(el('b', 'count', String(bolsa.length)));
  tipTexto(
    cell,
    `Boss Pouch — ${bolsa.length} de ${slots} vagas.\n` +
      'Tudo o que você tira do baú de recompensa de boss cai aqui, e não na mochila.\n' +
      'Clique para abrir a bolsa: de lá as peças saem para a mochila, e é lá que ficam o Vender e o Limpar.'
  );
  /*
   * Abre a JANELA, e não mais o modal de marcação.
   *
   * `toggleWindow` e não `setVisible(true)`: é o mesmo gesto no mesmo lugar, e
   * fechar sem procurar o x da janela é metade da utilidade dele — a mesma
   * razão do botão direito na mochila equipada.
   */
  cell.onclick = () => {
    toggleWindow('bossPouch');
    /*
     * E desenha na hora. O sistema de janelas nao avisa ninguem quando uma
     * janela aparece, e o corpo desta so' e' refeito quando a `bagKey` muda —
     * numa bolsa parada isso pode nao acontecer tao cedo, e ela abriria vazia.
     */
    renderBossPouch();
  };
  return cell;
}

/** Desenha (ou redesenha) a faixa da Boss Pouch. Ver `celulaDaBossPouch`. */
function encherFaixaDaBolsa(faixa, character, state) {
  if (!faixa) return;
  faixa.innerHTML = '';
  /*
   * As duas coladas, sem o nome e as vagas ao lado (pedido do dono, 15/09): quem
   * diz o que é cada uma é a etiqueta pequena DENTRO do desenho ("boss" /
   * "store"); nome completo e vagas ficam no balão do mouse.
   */
  const bolsa = celulaDaBossPouch(character, state);
  const inbox = celulaDaStoreInbox(character);
  // A divisãozinha com o nome das duas, em cima (pedido do dono).
  // Cada uma numa coluna: o nome em cima e o quadrado da largura do nome.
  const coluna = (classe, nome, cell) => {
    const c = el('div', 'bag-bolsa-coluna');
    c.append(el('span', `bag-bolsa-nome ${classe}`, nome), cell);
    return c;
  };
  faixa.append(coluna('bag-bolsas-boss', 'Boss Pouch', bolsa), coluna('bag-bolsas-store', 'Store Inbox', inbox));
}

function encherGradeDaMochila(grid, character, state) {
  for (const [pilha, entry] of character.inventory.entries()) {
    grid.append(
      itemCell(entry, 'bag', {
        size: 32,
        pilha,
        /*
         * ---- O que o clique faz depende do que esta ABERTO ----
         *
         * O gesto e' o mesmo da bolsa de loot, que o jogador ja conhece:
         *
         *   clique seco    leva a PILHA INTEIRA
         *   shift + clique abre a regua e pergunta QUANTO
         *
         * Com uma caixa do deposito aberta, o destino e' aquela caixa: um
         * clique guarda a pilha toda ali, e o shift guarda so' a parte
         * escolhida. Antes era o contrario — clique num empilhavel abria a
         * caixinha —, e para guardar uma pilha inteira eram sempre dois passos.
         *
         * Sem deposito aberto, o shift SEPARA a pilha em duas dentro da propria
         * mochila, e o clique seco continua equipando o que for equipavel.
         *
         * Item que nao empilha nao tem o que perguntar: vai inteiro nos dois
         * casos.
         */
        titulo: () =>
          ctx.bauDaGuildaAberto?.()
            ? 'Quanto vai para o baú da guilda?'
            : ctx.caixaDoDepositoAberta?.() != null
              ? 'Quanto vai para a caixa?'
              : 'Separar quantos da pilha?',
        // Guardar começa em tudo; separar começa na metade. Ver `itemCell`.
        valorInicial: (item) =>
          ctx.bauDaGuildaAberto?.() || ctx.caixaDoDepositoAberta?.() != null
            ? item.count
            : Math.max(1, Math.floor((item.count ?? 1) / 2)),
        onClick: (item, quantos) => {
          const meta = state.items[item.id];
          const total = item.count ?? 1;
          // A quantia so' e' uma ESCOLHA quando difere da pilha inteira: sem
          // shift, `itemCell` manda o total, que e' o clique seco.
          const escolhido = quantos != null && quantos !== total;
          const caixa = ctx.caixaDoDepositoAberta?.();

          /* Com o baú da guilda aberto, o clique na mochila guarda nele (igual ao oficial). */
          if (ctx.bauDaGuildaAberto?.()) {
            return void ctx.guardarNoBauDaGuilda?.(item, pilha, escolhido ? quantos : null);
          }

          if (caixa != null) {
            return void ctx.send({
              t: 'depot',
              action: 'store',
              id: item.id,
              count: escolhido ? quantos : total,
              caixa,
              /*
               * E QUAL cópia. Faltava: com duas espadas do mesmo id na mochila
               * — uma tier 9 e uma limpa —, guardar a limpa mandava a primeira
               * que o servidor achasse. Mesmo endereço que o equipar usa.
               */
              alvo: { ...alvoDaPeca(item, pilha), onde: 'bag' },
            });
          }

          if (meta?.stackable && total > 1) {
            /*
             * Separar a pilha inteira não separa nada, e antes isso não dizia
             * nada: o clique caía no `equip` de um item que não veste e morria
             * em silêncio. Agora ele explica, que é o mínimo que uma ação
             * recusada deve.
             */
            if (!escolhido) return void ctx.notice?.('Escolha menos que a pilha inteira para separá-la.');
            return void ctx.send({ t: 'split', id: item.id, count: quantos });
          }
          if (meta?.slot) ctx.send({ t: 'equip', id: item.id, pilha, alvo: alvoDaPeca(item, pilha) });
        },
      })
    );
  }
  /*
   * O "vazia" saiu: a grade nunca está vazia — a Boss Pouch está sempre nela.
   * Dizer "vazia" ao lado de um quadradinho desenhado seria a tela se
   * contradizendo, e o contador do cabeçalho (`0 / 20`) já responde a pergunta.
   */
}

/*
 * Reescreve so' o que muda na linha de cima: o contador e o `disabled` dos dois
 * botoes. Os nos sao os mesmos de sempre, e e' isso que impede o clique de se
 * perder entre dois retratos.
 */
function atualizarCabecaDaMochila(cabeca, character, meta) {
  const cheia = character.inventory.length;
  cabeca.nomeDaPeca.textContent = meta?.name ?? 'mochila';
  cabeca.contador.textContent = `${cheia} / ${meta?.container ?? 20}`;
  cabeca.limpar.disabled = !cheia;
  cabeca.vender.disabled = !cheia;
  tipTexto(
    cabeca.limpar,
    cheia
      ? 'Joga fora o que está na mochila. A tela seguinte mostra o que vai sumir, já guarda o que tem estrela, tier ou imbuement, e pergunta duas vezes.'
      : 'A mochila está vazia.'
  );
  tipTexto(
    cabeca.vender,
    cheia
      ? 'Vende para o NPC o que você marcar. Paga o preço cheio, e peça com tier ou imbuement não entra.'
      : 'A mochila está vazia.'
  );
}
