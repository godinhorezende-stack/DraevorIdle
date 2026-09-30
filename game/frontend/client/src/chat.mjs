// Chat do canto inferior esquerdo, com as abas do servidor:
// Ajuda, Global, Local, Combate e Loot.
import { windowBody, fecharAoClicarFora, setVisible } from './windows.mjs';
import { textoComItens, idsNoTexto, classeDaRaridade, nomeDaPeca } from './tooltip.mjs';
import { artOrUiIcon } from './hud.mjs';

/*
 * ---- A VOCAÇÃO ao lado do level ----
 *
 * O mesmo desenho da tela de criar personagem: o ícone da perícia que a vocação
 * domina. Ele responde de relance a pergunta que se faz ao ler o Global — "isso
 * é um mago ou um cavaleiro?" —, que hoje só se responde abrindo a ficha da
 * pessoa.
 *
 * O ícone é o da PERÍCIA, e não um desenho novo por vocação, porque é assim que
 * a tela de criação já apresenta cada uma: espada para o knight, distance para
 * o paladin, punho para o monk. Quem viu a tela de criação uma vez já sabe ler
 * isto.
 *
 * ---- Menos os dois magos ----
 *
 * Druid e sorcerer dominam a MESMA perícia, então o mesmo ícone respondia "é
 * mago" para os dois — e numa linha de Global não é isso que se pergunta: um
 * cura e o outro explode. O sorcerer ganhou o mesmo cajado com a PONTA roxa
 * (`sk-magic-sorcerer`, gerado por `tools/gerar-icone-sorcerer.mjs` a partir do
 * próprio `sk-magic`), que foi o pedido do dono. O druida fica com o original.
 *
 * O atributo title vira o balão do jogo sozinho — o tooltip recolhe todo title da
 * pagina —, e e por ele que passar o mouse diz "Paladin".
 */
const VOCACAO_NO_CHAT = {
  knight: { icone: 'sk-sword', nome: 'Knight' },
  paladin: { icone: 'sk-distance', nome: 'Paladin' },
  druid: { icone: 'sk-magic', nome: 'Druid' },
  sorcerer: { icone: 'sk-magic-sorcerer', nome: 'Sorcerer' },
  monk: { icone: 'sk-fist', nome: 'Monk' },
};

/** O ícone da vocação, ou nada quando ela não é conhecida (personagem sem vocação). */
function seloDaVocacao(vocation) {
  const info = VOCACAO_NO_CHAT[vocation];
  if (!info) return null;
  const icone = artOrUiIcon(info.icone, info.nome);
  icone.className = `${icone.className} vocacao-no-chat`.trim();
  icone.title = info.nome;
  return icone;
}

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

/*
 * `enxurrada` marca as abas que o JOGO escreve sozinho, varias vezes por
 * segundo. Elas contam o que nao foi lido de outro jeito — ver `marcaDaAba`.
 */
/*
 * ---- As abas, na ordem do client dele ----
 *
 * Local primeiro, porque é onde a conversa acontece com quem está do lado — é a
 * aba que fica aberta. Depois o Global, depois o Help.
 *
 * `Help` com o nome dele, e não "Ajuda": é assim que a aba se chama no servidor
 * do dono, e é o nome que o jogador dele já procura.
 *
 * E `Servidor` é NOVA, para tirar o recado de sistema de dentro do Help. Eles
 * dividiam a mesma aba: "conexão perdida — reconectando..." caía no meio das
 * perguntas, e o canal onde alguém pede ajuda é o pior lugar para um aviso
 * automático — ele empurra a pergunta para cima e parece resposta.
 */
export const CHANNELS = [
  { id: 'local', name: 'Local', writable: true },
  { id: 'global', name: 'Global', writable: true },
  /* Mercado: compra e venda, para todo o servidor. Os anúncios novos do balcão também saem aqui. */
  { id: 'mercado', name: 'Mercado', writable: true },
  { id: 'sistema', name: 'Servidor', writable: false },
  { id: 'combat', name: 'Combate', writable: false, enxurrada: true, opcional: true },
  { id: 'loot', name: 'Loot', writable: false, enxurrada: true, opcional: true },
];

/*
 * ---- Combate e Loot nascem FECHADOS ----
 *
 * São as duas abas que o jogo escreve sozinho, várias linhas por segundo
 * durante a caçada. Quem quer ler o que o servidor diz, ou conversar, tinha
 * duas abas de enxurrada disputando espaço numa caixa estreita — e a maioria
 * dos jogadores nunca abre nenhuma das duas.
 *
 * Elas continuam existindo e continuam gravando: quem ligar encontra o que já
 * passou. O `+` da barra de título liga e desliga, e a escolha fica guardada
 * no navegador — ninguém quer remarcar isso toda vez que entra.
 */
const ABAS_ABERTAS = 'draevor:chat-abas';

/*
 * Quem chega encontra o Combate ABERTO, e o Loot fechado.
 *
 * São as duas do mesmo tipo, mas não são a mesma coisa para quem está
 * começando: o Combate é onde se descobre por que o personagem morreu, e um
 * jogador novo que não sabe que a aba existe não vai procurá-la. O Loot é
 * conferência — quem quer saber o que caiu tem a Bolsa de Loot e o analisador,
 * e a aba é enxurrada pura.
 *
 * A diferença entre "nunca escolhi" e "escolhi desligar" é o `null`: chave
 * ausente recebe o padrão, chave presente é a vontade do jogador — inclusive
 * uma lista vazia, que quer dizer "não quero nenhuma das duas".
 */
const PADRAO_ABERTAS = ['combat'];

function lerAbertas() {
  try {
    const cru = localStorage.getItem(ABAS_ABERTAS);
    if (cru == null) return new Set(PADRAO_ABERTAS);
    const lista = JSON.parse(cru);
    return new Set(Array.isArray(lista) ? lista : PADRAO_ABERTAS);
  } catch {
    // Chave estragada não pode derrubar o chat inteiro: volta ao padrão.
    return new Set(PADRAO_ABERTAS);
  }
}

const abertas = lerAbertas();

function alternarAba(id, ligada) {
  if (ligada) abertas.add(id);
  else abertas.delete(id);
  try {
    localStorage.setItem(ABAS_ABERTAS, JSON.stringify([...abertas]));
  } catch {
    /* navegador sem armazenamento: vale para esta sessão e pronto */
  }
}

/*
 * ---- Uma aba POR PESSOA, como no client dele ----
 *
 * O privado era uma aba so', com as duas pontas de todas as conversas
 * misturadas e uma seta dizendo quem falou com quem. A decisao antiga era de
 * espaco: cinco abas ja apertam numa caixa de 300px.
 *
 * So' que "com quem eu estou falando" e' a primeira pergunta de uma conversa, e
 * uma aba compartilhada respondia com uma seta no meio do texto. No Tibia cada
 * conversa abre a propria aba com o nome da pessoa em cima, e e' isso que o dono
 * pediu. O aperto se resolve sozinho: as abas ja rolam de lado, e uma conversa
 * fecha no proprio X quando acaba.
 *
 * O id leva o prefixo `pm:` para nunca colidir com um canal fixo.
 */
const PREFIXO_DO_PRIVADO = 'pm:';
const conversas = new Map();
/*
 * ---- O id da conversa NÃO liga para maiúscula ----
 *
 * Report do dono: "quando vou mandar privado pra alguém meio que duplica o
 * chat". Quem digitava "suiken" abria a aba `pm:suiken`; a resposta do servidor
 * chega com o nome de verdade, "Suiken", e abria uma SEGUNDA aba `pm:Suiken`.
 * O servidor já procura o jogador sem maiúscula — a tela é que separava.
 *
 * O id é o nome em minúsculas; o nome escrito na aba mora em `name`, e é
 * trocado pelo do servidor quando ele chega (ver `garantirConversa`).
 */
const idDaConversa = (nome) => `${PREFIXO_DO_PRIVADO}${String(nome ?? '').trim().toLowerCase()}`;
const ehConversa = (id) => String(id).startsWith(PREFIXO_DO_PRIVADO);
const nomeDaConversa = (id) => conversas.get(id)?.name ?? String(id).slice(PREFIXO_DO_PRIVADO.length);

/**
 * Garante a aba de uma pessoa. Devolve o id do canal dela.
 *
 * `doServidor` diz que o nome veio numa linha do servidor, e portanto está
 * escrito do jeito certo: a aba aberta com "suiken" passa a se chamar "Suiken".
 */
function garantirConversa(nome, doServidor = false) {
  const limpo = String(nome ?? '').trim();
  if (!limpo) return null;
  const id = idDaConversa(limpo);
  const existente = conversas.get(id);
  if (!existente) {
    conversas.set(id, { id, name: limpo, writable: true });
    logs[id] = [];
    unread[id] = 0;
  } else if (doServidor && existente.name !== limpo) {
    existente.name = limpo;
    if (comQuem && comQuem.toLowerCase() === limpo.toLowerCase()) comQuem = limpo;
    if (built) render();
  }
  return id;
}

/*
 * ---- A bolinha de online de cada conversa ----
 *
 * Verde: a pessoa está com o jogo aberto. Vermelha: offline, ou em jogo com a
 * aba fechada (caçando com o site fechado) — nos dois casos a mensagem não
 * chega. O servidor responde `presenca` ao pedido abaixo e também sozinho,
 * quando uma mensagem não pôde ser entregue.
 */
const presencas = new Map(); // nome em minúsculas -> 'on' | 'fechada' | 'off'
const PERGUNTAR_PRESENCA_MS = 15_000;

export function receberPresenca(nomes) {
  let mudou = false;
  for (const [nome, estado] of Object.entries(nomes ?? {})) {
    const chave = String(nome).toLowerCase();
    if (presencas.get(chave) !== estado) mudou = true;
    presencas.set(chave, estado);
  }
  if (mudou) atualizarAbas();
}

function perguntarPresenca() {
  if (!conversas.size || !send) return;
  send({ t: 'presenca', nomes: [...conversas.values()].map((conversa) => conversa.name) });
}
setInterval(() => {
  if (!document.hidden) perguntarPresenca();
}, PERGUNTAR_PRESENCA_MS);

/** Pinta (ou cria) a bolinha no botão da aba de uma conversa. */
function pintarPresenca(botao, canal) {
  if (!ehConversa(canal.id)) return;
  const estado = presencas.get(canal.name.toLowerCase());
  let ponto = botao.querySelector('.chat-presenca');
  if (!ponto) {
    ponto = el('i', 'chat-presenca');
    botao.prepend(ponto);
  }
  ponto.className = `chat-presenca ${estado ?? 'desconhecido'}`;
  ponto.title = estado === 'on' ? 'online'
    : estado === 'fechada' ? 'em jogo, com a aba fechada — não recebe mensagem'
      : estado === 'off' ? 'offline' : '';
}

/*
 * ---- Trocou de personagem, o chat começa limpo ----
 *
 * Pedido do dono. As conversas, os avisos e o combate eram do personagem de
 * antes, e ficavam na tela do novo como se fossem dele. Entrar de novo no MESMO
 * personagem (a conexão caiu e voltou) não apaga nada.
 */
let donoDoChat = null;
export function chatDoPersonagem(nome) {
  const novo = String(nome ?? '').toLowerCase();
  if (!novo) return;
  if (donoDoChat && donoDoChat !== novo) limparChat();
  donoDoChat = novo;
}

function limparChat() {
  for (const id of [...conversas.keys()]) {
    conversas.delete(id);
    delete logs[id];
    delete unread[id];
  }
  for (const canal of Object.keys(logs)) {
    for (const linha of logs[canal]) linha.remove();
    logs[canal] = [];
    unread[canal] = 0;
  }
  presencas.clear();
  comQuem = null;
  if (ehConversa(active)) {
    active = 'global';
    localStorage.setItem('draevor:chat', active);
  }
  if (built) render();
}

/*
 * Os canais da vez: as CONVERSAS primeiro, depois os fixos.
 *
 * Elas ficavam no fim, atrás de seis abas — numa caixa de 300px isso é atrás da
 * rolagem. Quem abre um privado abriu porque quer falar agora, e a aba que
 * importa não pode ser a que precisa ser procurada. Os canais fixos não somem de
 * lugar entre si: só passam a começar depois das conversas.
 */
/*
 * As opcionais entram só quando ligadas. O resto da tela não precisa saber
 * disso: quem monta aba, conta não-lida e escolhe a ativa passa por aqui.
 */
const canais = () => [
  ...conversas.values(),
  ...CHANNELS.filter((canal) => !canal.opcional || abertas.has(canal.id)),
];

/** Fecha a aba de uma conversa. O historico dela vai junto. */
function fecharConversa(id) {
  conversas.delete(id);
  delete logs[id];
  delete unread[id];
  if (active === id) {
    active = 'global';
    localStorage.setItem('draevor:chat', active);
  }
}

/*
 * Com quem é a conversa privada aberta.
 *
 * Definido ao escolher "Mensagem privada" no menu de alguém, e atualizado a
 * cada mensagem que chega — responder é o caso comum, e ele não pode exigir
 * digitar o nome de novo.
 */
let comQuem = null;
export const conversaPrivada = () => comQuem;
export function abrirConversa(nome) {
  const id = garantirConversa(nome);
  if (!id) return;
  comQuem = nomeDaConversa(id);
  active = id;
  localStorage.setItem('draevor:chat', active);
  if (built) render();
  // A bolinha da aba nova não espera os 15s da próxima rodada.
  perguntarPresenca();
}

const logs = Object.fromEntries(CHANNELS.map((channel) => [channel.id, []]));
const unread = Object.fromEntries(CHANNELS.map((channel) => [channel.id, 0]));

let active = localStorage.getItem('draevor:chat') ?? 'global';
let send = null;
let built = false;

/*
 * ---- Quantas linhas cada aba guarda ----
 *
 * Duzentas. Uma caçada de dez horas produz dezenas de milhares de linhas de
 * loot, e nenhuma pessoa vai rolar ate' a de tres horas atras — o que ela
 * quer e' o que acabou de cair.
 */
const LIMITE_POR_ABA = 200;

/*
 * ---- O numerinho da aba nao conta ate' cinco mil ----
 *
 * O contador de nao-lidas subia sem teto, e numa caçada de alguma horas a aba
 * de Combate mostrava "5705". Duas coisas erradas nisso, e sao diferentes:
 *
 *   1. O NUMERO nao cabe. Uma aba e' um botao de sessenta pixels; quatro digitos
 *      empurram os outros botoes para fora da caixa, e foi isso que o dono viu.
 *   2. E, pior, o numero nao QUER dizer nada. "5705" nao e' uma informacao que
 *      alguem va usar: ninguem vai ler cinco mil linhas de dano, e a aba so'
 *      guarda as duzentas ultimas de qualquer jeito — o numero prometia um
 *      atraso que nem existe.
 *
 * Entao as abas que o jogo escreve sozinho (Combate e Loot) ganham um PONTO:
 * "tem coisa nova ai". E' o que a pessoa faz com a informacao de qualquer forma.
 * As abas de gente — Ajuda, Global, Local e as conversas — continuam contando,
 * porque ali cada linha e' uma frase que alguem escreveu e o numero diz quantas
 * faltam ler. Essas param no teto, e ele existe pela razao 1: e' o maior numero
 * que cabe no botao.
 *
 * O contador tambem para de subir no teto (`somar`), em vez de so' ser aparado
 * na hora de desenhar — um numero que cresce para sempre em memoria enquanto a
 * tela mostra "99+" e' um vazamento lento que ninguem ve.
 */
const TETO_DO_NUMERO = 99;

/** O que vai escrito no numerinho da aba, ou `null` quando nao ha marca. */
function marcaDaAba(canal, quantas) {
  if (!quantas) return null;
  if (canal.enxurrada) return '•';
  return quantas > TETO_DO_NUMERO ? `${TETO_DO_NUMERO}+` : String(quantas);
}

/**
 * Poe (ou tira) a marca de um botao de aba.
 *
 * Um lugar so' porque sao dois caminhos ate' ela — a montagem da janela e o
 * `atualizarAbas()` de cada mensagem — e um ponto desenhado de dois jeitos
 * diferentes e' o tipo de coisa que so' aparece quando a aba troca.
 */
function pintarMarca(botao, canal, quantas) {
  // O `×` de fechar e a bolinha de presença tambem sao `<i>`: a marca e' a que NAO e' nenhum dos dois.
  const atual = [...botao.querySelectorAll('i')].find((no) => !no.classList.contains('chat-fecha') && !no.classList.contains('chat-presenca'));
  const texto = marcaDaAba(canal, quantas);
  if (!texto) return void atual?.remove();
  const marca = atual ?? botao.insertBefore(el('i', null, texto), botao.querySelector('.chat-fecha'));
  marca.textContent = texto;
  marca.classList.toggle('chat-ponto', !!canal.enxurrada);
}

/** Soma uma nao-lida, sem passar do teto. */
function somar(canal) {
  const teto = CHANNELS.find((c) => c.id === canal)?.enxurrada ? 1 : TETO_DO_NUMERO + 1;
  unread[canal] = Math.min(teto, (unread[canal] ?? 0) + 1);
}

/**
 * Quantas nao-lidas uma aba tem. Existe para o `test-chat`.
 *
 * O que o teste precisa provar nao da' para ver na tela: que o CONTADOR para de
 * subir, e nao so' que o rotulo mostra "99+". Um numero que cresce para sempre
 * em memoria enquanto a tela mostra o teto e' um vazamento lento que ninguem ve
 * — e era exatamente o que acontecia antes.
 */
export const naoLidas = (canal) => unread[canal] ?? 0;

/*
 * ---- Os pedacos montados da janela ----
 *
 * ================ Por que o chat travava a aba ================
 *
 * Cada mensagem chamava `render()`, e `render()` desmonta e remonta a janela
 * INTEIRA: as abas, as duzentas linhas do canal e o campo de texto. Numa
 * caçada as linhas de loot e de combate chegam varias vezes por segundo — sao
 * varias reconstrucoes de duzentos nos por segundo, hora apos hora.
 *
 * E nao era so' lentidao. O campo de texto e' recriado junto: quem estivesse
 * escrevendo no Global perdia o que digitou toda vez que um bicho soltasse
 * loot, porque o `input` em que ele digitava deixava de existir.
 *
 * Agora `render()` monta a janela uma vez, e cada mensagem nova so' acrescenta
 * o SEU no' — ou nem isso, quando ela e' de uma aba que nao esta' aberta.
 */
let logEl = null;
let tabsEl = null;

/*
 * ---- O QUE JÁ FOI DITO, na seta para cima ----
 *
 * O gesto é o de todo client de Tibia e de todo terminal: seta para cima traz a
 * última frase, de novo traz a anterior, seta para baixo volta. Sem ele,
 * repetir um anúncio de venda — que é a coisa mais repetida que existe num
 * servidor — é redigitar a frase inteira toda vez.
 *
 * A lista vive no MÓDULO, e não na caixa de texto, porque `render()` refaz o
 * formulário inteiro a cada desenho da janela: um histórico preso ao input
 * morreria a cada troca de aba.
 *
 * `rascunho` guarda o que estava escrito antes de a primeira seta subir, para
 * a seta para baixo devolver — quem estava no meio de uma frase, espiou o
 * histórico e desistiu não perde o que tinha digitado.
 */
const HISTORICO_MAXIMO = 30;
const historico = [];
let ondeNoHistorico = -1;
let rascunho = '';

/** A caixa de escrever que está na tela, se houver uma. Ver `inserirNoChat`. */
let inputEl = null;
/*
 * A ABA a que a caixa de texto da vez pertence.
 *
 * O rascunho e' devolvido ao redesenho so' quando a aba nao mudou (ver o
 * comeco do `render`), e sem isto nao ha' como saber: quando o `render` roda,
 * o `active` ja' e' o novo.
 */
let canalDoInput = null;

/*
 * ---- Shift + clique num item entra na frase ----
 *
 * Estas duas existem para o inventário: ele precisa saber se vale a pena
 * (`chatEscrevendo`) e por onde entregar (`inserirNoChat`). O inventário não
 * conhece o chat por dentro, e o chat não conhece o inventário — as duas
 * respostas são toda a conversa entre eles.
 */
export const chatEscrevendo = () => !!inputEl && document.activeElement === inputEl;

/** Enfia um pedaço de texto onde o cursor está, e devolve o foco à caixa. */
export function inserirNoChat(texto) {
  if (!inputEl) return false;
  const antes = inputEl.value;
  /*
   * ---- Peças diferentes podem; a MESMA não ----
   *
   * O print do dono era uma linha só com cinco `wand of vortex` enfileiradas:
   * shift+clicar é rápido demais, e cinco cliques distraídos empurram a
   * conversa de todo mundo para cima.
   *
   * O que faz aquilo ser flood é a REPETIÇÃO, e não a quantidade. "Vendo a
   * espada e o escudo" é uma frase legítima e precisa das duas peças; "vendo a
   * espada, a espada, a espada" não diz nada que a primeira já não tenha dito.
   *
   * O teto de quantas cabem já existe e é o tamanho da linha: 200 caracteres.
   *
   * O servidor tem a mesma trava, e é ela que vale; esta aqui existe para o
   * gesto falhar na hora, com a frase ainda na mão, em vez de o envio ser
   * recusado depois de escrita.
   */
  const jaEscritos = idsNoTexto(antes);
  if (idsNoTexto(texto).some((id) => jaEscritos.includes(id))) return false;
  const de = inputEl.selectionStart ?? antes.length;
  const ate = inputEl.selectionEnd ?? de;
  /*
   * Um espaço antes, quando já há palavra colada: "vendo[[item:x]]" sairia
   * grudado, e quem escreveu não teria como separar depois — o pedaço é uma
   * marca só e o cursor não entra no meio dela.
   */
  const cola = de > 0 && !/\s$/.test(antes.slice(0, de)) ? ' ' : '';
  const novo = antes.slice(0, de) + cola + texto + ' ' + antes.slice(ate);
  if (novo.length > inputEl.maxLength) return false;
  inputEl.value = novo;
  const cursor = de + cola.length + texto.length + 1;
  inputEl.focus();
  inputEl.setSelectionRange(cursor, cursor);
  return true;
}

/*
 * ---- Enter abre a caixa de falar ----
 *
 * "quando eu apertar enter tem q ligar o chat automaticamente pra poder digitar
 * já, e enter de novo manda."
 *
 * É o gesto de todo jogo com chat, e aqui ele faltava: para dizer uma frase era
 * preciso achar a caixa com o mouse. O segundo Enter já funcionava sozinho — a
 * caixa vive dentro de um `form`, e Enter num campo de formulário envia.
 *
 * ---- Abrir é abrir MESMO ----
 *
 * A janela pode estar fechada, minimizada ou guardada fora da tela; `setVisible`
 * resolve os três (ver a nota dela). Chamá-la sempre — e não só quando está
 * escondida — também traz a janela para a frente, que é o que se quer de quem
 * acabou de pedir para falar.
 *
 * ---- E numa aba sem caixa, o Enter troca de aba ----
 *
 * As abas de combate e loot só mostram; quem aperta Enter nelas quer falar, e
 * não descobrir que ali não se fala. Manda para o global, que é o canal de
 * conversa.
 */
export function focarChat() {
  setVisible('chat', true);
  if (!inputEl?.isConnected) {
    if (canais().find((canal) => canal.id === active)?.writable === false) {
      active = 'global';
      localStorage.setItem('draevor:chat', active);
    }
    render();
  }
  if (!inputEl) return false;
  inputEl.focus();
  const fim = inputEl.value.length;
  inputEl.setSelectionRange(fim, fim);
  return true;
}

/** Larga a caixa e devolve o teclado ao jogo — o WASD volta a andar. */
export function soltarChat() {
  if (!inputEl) return false;
  inputEl.blur();
  return true;
}

/** A janela ainda esta montada e na tela? */
const montado = () => built && logEl?.isConnected;

export function initChat(sendFn) {
  send = sendFn;
}

/*
 * A hora entra em toda linha, como no servidor.
 *
 * O Tibia carimba `HH:mm` na frente de tudo que aparece no chat, e é o que
 * responde "isso foi agora ou faz meia hora?" — numa aba de loot que rola
 * sozinha durante horas, sem a hora não dá para saber onde a sessão de hoje
 * começa. O carimbo é posto aqui, no caminho por onde toda linha passa, em vez
 * de em cada uma das quatro funções que escrevem no chat.
 */
function agora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/*
 * Quem mais quer saber da mensagem que chegou: a faixa do chat do celular
 * (celular.mjs) mostra a última da aba aberta sem ter o chat aberto.
 */
const ouvintesDoChat = new Set();
export const aoChegarNoChat = (fn) => ouvintesDoChat.add(fn);
export const abaDoChat = () => active;

function push(channel, node) {
  node.prepend(el('span', 'hora', agora()));
  for (const ouvir of ouvintesDoChat) ouvir(channel, node);
  // A hora de chegada, para o modo flutuante apagar as falas velhas.
  node.dataset.chegou = String(Date.now());
  const lista = logs[channel];
  lista.push(node);
  /*
   * A linha que sai da lista sai TAMBEM da tela.
   *
   * O `shift` sozinho tirava a referencia do array e deixava o no' pendurado
   * no documento — a lista ficava em duzentas e o DOM continuava crescendo.
   * Como o `render()` antigo remontava tudo do zero a cada mensagem, isso
   * nunca aparecia; agora que as linhas sao acrescentadas uma a uma, aparece.
   */
  while (lista.length > LIMITE_POR_ABA) lista.shift().remove();

  if (channel !== active) {
    somar(channel);
    atualizarAbas();
    return;
  }
  if (!montado()) return;

  /*
   * Rolar sozinho SO' se o jogador ja' estava no fim.
   *
   * Quem subiu para ler o que caiu ha' cinco minutos nao pode ser puxado de
   * volta para baixo pela proxima linha de loot — e numa caçada a proxima vem
   * em menos de um segundo. Uma folga de alguns pixels porque a rolagem do
   * navegador nem sempre fecha exatamente no fim.
   */
  const noFim = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 24;
  logEl.append(node);
  if (noFim) logEl.scrollTop = logEl.scrollHeight;
}

/*
 * So' os numerinhos das abas, sem remontar nada.
 *
 * E' o caminho de toda mensagem que chega numa aba fechada — o caso mais comum
 * de todos numa caçada, ja' que o jogador olha uma aba de cada vez.
 */
function atualizarAbas() {
  if (!montado() || !tabsEl) return;
  const botoes = tabsEl.children;
  /*
   * `canais()`, e nao `CHANNELS`: as conversas privadas sao abas como as
   * outras, e ficavam de fora deste laço — o numerinho delas so' aparecia no
   * proximo `render()` inteiro, que numa caçada pode nao vir nunca. Quem
   * recebia um privado enquanto olhava o loot nao via marca nenhuma.
   */
  canais().forEach((channel, i) => {
    const botao = botoes[i];
    if (!botao) return;
    // Só quando muda: este laço roda a cada linha de chat que chega.
    const selecionada = String(channel.id === active);
    if (botao.getAttribute?.('aria-selected') !== selecionada) botao.setAttribute('aria-selected', selecionada);
    pintarMarca(botao, channel, channel.id === active ? 0 : unread[channel.id]);
    pintarPresenca(botao, channel);
  });
}

/*
 * O nome de quem tem cargo, com a marca junto.
 *
 * A marca vem NA LINHA, e não de uma lista de gods consultada na hora de
 * desenhar: quem rolar a conversa para cima amanhã continua vendo quem era god
 * quando falou, e a tela não precisa saber quem é o quê hoje.
 */
function nomeComMarca(name, marca, nomeLimpo = null) {
  const quem = el('span', 'who');
  /*
   * O nome é CLICÁVEL.
   *
   * O texto desenhado pode trazer enfeite — no privado ele sai como "Fulano →"
   * —, então quem o clique abre vai no `data-quem`, limpo. Quem escuta é um
   * ouvinte só, lá no `main.mjs`: pendurar um `onclick` em cada linha de chat
   * seria um fechamento novo por mensagem, e numa caçada elas chegam às
   * dezenas por minuto.
   */
  quem.dataset.quem = nomeLimpo ?? name;
  quem.classList.add('who-clicavel');
  if (marca?.tag) {
    quem.classList.add('who-equipe', `who-${marca.tag.toLowerCase()}`);
    quem.append(el('i', 'tag-cargo', marca.tag), document.createTextNode(name));
  } else {
    quem.textContent = name;
  }
  return quem;
}

/* ---------------------------------------------------------------- áudio */

/*
 * ---- O áudio do chat ----
 *
 * O dono: "no chat colocar o esquema de mandar áudio — no máximo 30 segundos, e
 * depois de 5 minutos some; no global e no privado".
 *
 * Gravar: o 🎤 ao lado dos emotes. Um clique começa, o botão vira "■ 0:07" com o
 * relógio correndo, e o clique seguinte envia. O ✕ ao lado cancela. Aos trinta
 * segundos a gravação para e sai sozinha — é o teto do servidor, e cortar aqui
 * poupa a pessoa de gravar um minuto para ouvir "grande demais".
 *
 * Ouvir: a linha traz "▶ 0:12". O áudio só é buscado no servidor quando alguém
 * aperta o play (ver `ouvirAudio`, no index.mjs), e depois fica guardado nesta
 * aba até expirar, para o segundo play não buscar de novo.
 */
const SEGUNDOS_DO_AUDIO = 30;
let gravacao = null; // { recorder, stream, partes, inicio, canal, para, relogio, cancelada }
const audiosBaixados = new Map(); // id -> URL do blob
const botoesEsperando = new Map(); // id -> botão que pediu
let tocando = null; // { audio, botao, id, esperando } — ver `tocarAudio`

const tempo = (segundos) => {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** O formato que este navegador sabe gravar, na ordem de preferência. */
function formatoDeGravacao() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const tipo of ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported?.(tipo)) return tipo;
  }
  return '';
}

function pararGravacao({ cancelar = false } = {}) {
  if (!gravacao) return;
  gravacao.cancelada = cancelar;
  clearInterval(gravacao.relogio);
  if (gravacao.recorder.state !== 'inactive') gravacao.recorder.stop();
  else finalizarGravacao();
}

function finalizarGravacao() {
  const atual = gravacao;
  if (!atual) return;
  gravacao = null;
  for (const trilha of atual.stream.getTracks()) trilha.stop();
  if (built) render();
  if (atual.cancelada) return;

  const segundos = Math.min(SEGUNDOS_DO_AUDIO, (performance.now() - atual.inicio) / 1000);
  if (segundos < 0.6) return; // um clique duplo sem querer não vira áudio vazio
  const tipo = atual.recorder.mimeType || atual.partes[0]?.type || 'audio/webm';
  const blob = new Blob(atual.partes, { type: tipo });
  const leitor = new FileReader();
  leitor.onload = () => {
    const dados = String(leitor.result).split(',')[1] ?? '';
    send?.({ t: 'chatAudio', channel: atual.canal, to: atual.para, formato: tipo, dados, segundos });
  };
  leitor.readAsDataURL(blob);
}

async function comecarGravacao(canal, para) {
  if (gravacao) return;
  const formato = formatoDeGravacao();
  if (formato === null || !navigator.mediaDevices?.getUserMedia) {
    logSystem('Este navegador não consegue gravar áudio.');
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    logSystem('Sem acesso ao microfone — libere a permissão no navegador para mandar áudio.');
    return;
  }
  const opcoes = { audioBitsPerSecond: 32000 };
  if (formato) opcoes.mimeType = formato;
  const recorder = new MediaRecorder(stream, opcoes);
  gravacao = { recorder, stream, partes: [], inicio: performance.now(), canal, para, cancelada: false };
  recorder.ondataavailable = (evento) => {
    if (evento.data?.size) gravacao?.partes.push(evento.data);
  };
  recorder.onstop = finalizarGravacao;
  recorder.start(250);
  gravacao.relogio = setInterval(() => {
    const passados = (performance.now() - (gravacao?.inicio ?? 0)) / 1000;
    const botao = document.querySelector('.chat-mic.gravando');
    if (botao) botao.textContent = `■ ${tempo(passados)}`;
    if (passados >= SEGUNDOS_DO_AUDIO) pararGravacao();
  }, 200);
  if (built) render();
}

/** O botão de play de uma linha com áudio. */
function botaoDeAudio(audio) {
  const botao = el('button', 'chat-audio', `▶ ${tempo(audio.segundos)}`);
  botao.type = 'button';
  botao.dataset.audio = audio.id;
  botao.dataset.expira = String(audio.expiraEm);
  botao.dataset.segundos = String(audio.segundos);
  botao.title = 'áudio — some 5 minutos depois de enviado';
  if (Date.now() >= audio.expiraEm) marcarExpirado(botao);
  botao.onclick = () => tocarAudio(botao);
  return botao;
}

function marcarExpirado(botao) {
  botao.disabled = true;
  botao.classList.add('expirado');
  botao.textContent = '🎤 áudio expirado';
}

/*
 * ---- O áudio dos OUTROS não tocava ----
 *
 * O report: "se eu ou meu irmão mandar áudio pelo mic as pessoas escutam, mas
 * se outra pessoa mandar a gente não escuta."
 *
 * Não é o mic e não é a entrega. Medido com dois clientes, um mandando e o
 * outro ouvindo: a linha chega, o play é apertado, o servidor devolve o áudio
 * inteiro — e o navegador RECUSA tocar, com
 *
 *   NotAllowedError: play() failed because the user didn't interact with the
 *   document first
 *
 * A causa é a ordem das coisas. O navegador só deixa tocar som a partir de um
 * gesto do usuário, e o gesto aqui é o clique no play — mas o `play()` não
 * acontecia nele: acontecia lá adiante, quando a resposta do servidor chegava
 * pelo WebSocket. Nessa hora o gesto já passou, e o navegador vê um som
 * começando sozinho, do nada. Quem manda nunca percebe (não se ouve o próprio
 * áudio), e por isso o defeito chega como "só o dos outros não toca".
 *
 * E ele era MUDO: o `catch` do `play()` só devolvia o botão ao estado normal.
 * Do lado de quem clica, o botão pisca e não acontece nada — sem erro, sem
 * aviso, sem nada que se possa contar para quem vai consertar.
 *
 * ---- O conserto: o som nasce NO CLIQUE ----
 *
 * O elemento de áudio é criado e começa a tocar dentro do próprio clique,
 * ainda com o gesto valendo — tocando um silêncio de nada (`SILENCIO`)
 * enquanto os bytes de verdade não chegam. Quando eles chegam, é só trocar o
 * `src` do MESMO elemento: a permissão já é dele, e trocar a fonte de um áudio
 * que já tocou não pede gesto nenhum.
 *
 * É o mesmo truque que qualquer tocador da web usa para "tocar" uma faixa que
 * ainda está sendo baixada, e aqui ele cai bem por acidente feliz: o "…
 * carregando" que o botão já mostrava vira exatamente o tempo em que o
 * silêncio está no ar.
 *
 * E se ainda assim o navegador recusar (som bloqueado no site, aparelho sem
 * saída), o botão passa a DIZER — ver `naoDeuParaTocar`.
 */

/*
 * Um WAV de zero amostras: 44 bytes de cabeçalho e mais nada.
 *
 * É a menor coisa que um navegador aceita como som, e é o que segura a
 * permissão do elemento enquanto o áudio de verdade não chega. Data URI para
 * não depender de arquivo nenhum — isto tem de funcionar no primeiro clique,
 * inclusive com a rede ruim que fez o áudio demorar.
 */
const SILENCIO = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';

/**
 * O botão volta ao ▶, e DIZ por que não tocou.
 *
 * Os três motivos que acontecem de verdade, e a resposta de cada um:
 *
 *   NotAllowedError     o navegador bloqueou o som desta aba. Acontece quando
 *                       a pessoa pôs "Som: bloquear" no site, ou quando o
 *                       aparelho está no mudo.
 *   formato recusado    o áudio foi gravado num formato que ESTE navegador não
 *                       toca. O caso real é o `audio/webm` do Chrome chegando
 *                       num iPhone: o Safari não toca webm, e aí quem manda é
 *                       ouvido por todos menos por quem está no telefone —
 *                       que é como este defeito costuma ser relatado.
 *   qualquer outro      o que o navegador disser, por extenso.
 */
function naoDeuParaTocar(botao, erro, formato = null) {
  if (!botao) return;
  botao.textContent = `▶ ${tempo(Number(botao.dataset.segundos))}`;
  /*
   * O motivo fica no `title`, e não numa linha de chat: não tocar é um
   * problema DESTA aba, e escrevê-lo no chat encheria a conversa de todo mundo
   * com uma coisa que só interessa a quem clicou. No botão, ele aparece
   * exatamente para quem tentou.
   */
  const recusaOFormato = formato && !new Audio().canPlayType(formato);
  botao.title = recusaOFormato
    ? `este navegador não toca ${formato} — no iPhone, áudio gravado no computador costuma cair aqui`
    : erro?.name === 'NotAllowedError'
      ? 'o navegador bloqueou o som desta aba — clique em qualquer lugar da página e tente de novo'
      : `não deu para tocar este áudio${erro?.message ? `: ${erro.message}` : ''}`;
  botao.classList.add('mudo');
}

function tocarAudio(botao) {
  const id = botao.dataset.audio;

  if (tocando) {
    const eraEste = tocando.botao === botao;
    tocando.audio.pause();
    tocando.botao.textContent = `▶ ${tempo(Number(tocando.botao.dataset.segundos))}`;
    tocando = null;
    if (eraEste) return;
  }
  if (Date.now() >= Number(botao.dataset.expira)) return marcarExpirado(botao);

  botao.classList.remove('mudo');
  botao.title = 'áudio — some 5 minutos depois de enviado';

  const url = audiosBaixados.get(id);
  const som = new Audio();
  /*
   * `esperando` diz que o que está no ar é o silêncio, e não o áudio. Sem essa
   * marca o `onended` do silêncio — que acaba na hora — devolveria o botão ao
   * ▶ antes de os bytes chegarem, e o play pareceria ter falhado sozinho.
   */
  tocando = { audio: som, botao, id, esperando: !url };
  som.onended = () => {
    if (tocando?.audio !== som || tocando.esperando) return;
    botao.textContent = `▶ ${tempo(Number(botao.dataset.segundos))}`;
    tocando = null;
  };

  som.src = url ?? SILENCIO;
  botao.textContent = url ? `❚❚ ${tempo(Number(botao.dataset.segundos))}` : '… carregando';
  // O play sai DAQUI, dentro do clique: é este gesto que dá a permissão.
  som.play().catch((erro) => {
    /*
     * Trocar o `src` no meio do silêncio ABORTA este play — e trocar o `src` é
     * exatamente o que fazemos quando os bytes chegam. O aborto aqui não é
     * falha nenhuma: é o conserto acontecendo. Quem responde pelo play de
     * verdade é o `catch` do `receberAudio`.
     */
    if (erro?.name === 'AbortError') return;
    if (tocando?.audio === som) tocando = null;
    naoDeuParaTocar(botao, erro);
  });

  if (!url) {
    botoesEsperando.set(id, botao);
    send?.({ t: 'ouvirAudio', id });
  }
}

/** A resposta do servidor ao play: `{ id, formato, dados }` ou `{ id, erro }`. */
export function receberAudio({ id, formato, dados, erro }) {
  const botao = botoesEsperando.get(id);
  botoesEsperando.delete(id);
  if (erro || !dados) {
    // Todas as linhas com esse áudio (a mesma pode estar em duas abas) expiram juntas.
    for (const b of document.querySelectorAll(`.chat-audio[data-audio="${id}"]`)) marcarExpirado(b);
    if (botao) marcarExpirado(botao);
    return;
  }
  const bytes = Uint8Array.from(atob(dados), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: formato }));
  audiosBaixados.set(id, url);
  const expira = Number(botao?.dataset.expira) || Date.now() + 5 * 60 * 1000;
  // Some daqui também quando expira no servidor: nada de áudio velho guardado na aba.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    audiosBaixados.delete(id);
  }, Math.max(0, expira - Date.now()));

  /*
   * O elemento que está tocando o silêncio recebe os bytes e segue.
   *
   * Trocar o `src` de um áudio que JÁ tocou não pede gesto nenhum — é por isso
   * que o conserto funciona. Chamar `tocarAudio` daqui, que era o que se fazia,
   * criava um elemento NOVO fora do gesto, e era esse que o navegador recusava.
   */
  if (tocando?.id === id && tocando.esperando && tocando.botao?.isConnected) {
    const alvo = tocando.botao;
    tocando.esperando = false;
    tocando.audio.src = url;
    alvo.textContent = `❚❚ ${tempo(Number(alvo.dataset.segundos))}`;
    /*
     * O `error` do elemento e a recusa do `play()` são dois caminhos para a
     * mesma coisa, e um áudio de formato estranho pega o primeiro: o navegador
     * nem tenta tocar, só marca o erro e fica quieto. Sem este `onerror` o
     * botão ficaria em ❚❚ para sempre, que era pior do que voltar ao ▶.
     */
    tocando.audio.onerror = () => {
      if (tocando?.id === id) tocando = null;
      naoDeuParaTocar(alvo, tocando?.audio?.error ?? null, formato);
    };
    tocando.audio.play().catch((falha) => {
      if (tocando?.id === id) tocando = null;
      naoDeuParaTocar(alvo, falha, formato);
    });
    return;
  }

  /*
   * Ninguém está mais esperando por ele — o jogador clicou noutro áudio no meio
   * do caminho, ou fechou a aba da conversa. O arquivo fica guardado, e o
   * próximo clique nesse botão toca na hora, sem ida ao servidor.
   */
}

// De tempos em tempos, as linhas cujos áudios já passaram do prazo mudam de cara.
setInterval(() => {
  const agora = Date.now();
  for (const botao of document.querySelectorAll('.chat-audio:not(.expirado)')) {
    if (agora >= Number(botao.dataset.expira) && tocando?.botao !== botao) marcarExpirado(botao);
  }
}, 10_000);

export function logChat({ channel = 'global', name, level, text, para, eu, marca, vocation, audio }) {
  // Com áudio, a fala da linha é o botão de play; o resto da linha é o mesmo.
  const fala = () => (audio?.id ? botaoDeAudio(audio) : textoComItens(text));
  const line = el('div');
  if (channel === 'private') {
    /*
     * A mensagem vai para a aba DA PESSOA — quem quer que seja a outra ponta.
     *
     * A seta continua: dentro da aba de Fulano aparecem as duas metades da
     * conversa, e sem ela "Fulano:" podia ser tanto o que ele escreveu quanto o
     * que voce escreveu para ele.
     */
    const meu = name === eu;
    const outro = meu ? para : name;
    /*
     * A aba ja' existia? Entao NAO ha' o que redesenhar: o `push` la' embaixo
     * pendura a linha e acerta o numerinho sozinho.
     *
     * Antes, toda mensagem privada remontava a janela inteira — as duzentas
     * linhas do historico, o formulario, a gaveta de emotes —, o que perdia a
     * rolagem, fechava a gaveta aberta e apagava o que estava sendo digitado.
     * Numa conversa de dez mensagens sao dez remontagens para pendurar dez
     * linhas.
     */
    const jaTinhaAba = conversas.has(idDaConversa(outro));
    const id = garantirConversa(outro, true);
    if (!id) return;
    comQuem = nomeDaConversa(id);
    // Uma linha que chegou prova que as duas pontas estão com o jogo aberto.
    receberPresenca({ [nomeDaConversa(id)]: 'on' });
    line.classList.add(meu ? 'privado-saiu' : 'privado-veio');
    /*
     * ---- A linha do privado é a MESMA do Global ----
     *
     * Pedido do dono: "o chat privado tem que mostrar o meu level pra pessoa e
     * o da pessoa pra mim, e o ícone da vocação, e poder clicar pra convidar".
     *
     * Ela era só nome e texto. O servidor JÁ mandava `level`, `vocation` e
     * `marca` na linha privada (ver o `channel === 'private'` no index.mjs) — a
     * tela e' que jogava os três fora. Agora a ordem é a do Global: ícone da
     * vocação, nome com a marca do cargo, level entre colchetes e a fala.
     *
     * ---- E o nome é o de QUEM FALOU, nos dois sentidos ----
     *
     * A linha que sai mostrava `→ Fulano`, o DESTINATÁRIO. Só que `level` e
     * `vocation` da mensagem são de quem escreveu — eu —, e pô-los ao lado do
     * nome dele diria que o Fulano é level 1500 quando o 1500 é meu. É o tipo de
     * erro que ninguém desconfia: o número está lá, só está na pessoa errada.
     *
     * Então o nome passa a ser o de quem falou, e a SETA continua dizendo a
     * direção — antes do nome quando a fala sai, depois quando a fala chega.
     * Quem é a outra ponta já está escrito na aba, em cima.
     */
    const seloDoPrivado = seloDaVocacao(vocation);
    if (meu) line.append(el('span', 'privado-seta', '→ '));
    if (seloDoPrivado) line.append(seloDoPrivado);
    /*
     * Clicável como no Global: o `data-quem` sai daqui e quem escuta é o
     * ouvinte único do `main.mjs`, que abre a ficha com convidar, party e
     * trocar. No próprio nome ele não faz nada, de propósito.
     */
    line.append(nomeComMarca(name, marca, name));
    if (level != null) line.append(el('span', 'lvl', ` [${level}] `));
    if (!meu) line.append(el('span', 'privado-seta', '→ '));
    line.append(fala());
    push(id, line);
    // So' a aba NOVA precisa de desenho — ela ainda nao existe na fileira.
    if (built && !jaTinhaAba) render();
    return;
  }
  /*
   * O texto vira nós, e não string: uma frase pode trazer `[[item:3264]]`, e
   * ali entra o nome do item com a cor da raridade e o balão. Ver
   * `textoComItens`. Sem marca nenhuma, o fragmento é um nó de texto só — o
   * mesmo de antes.
   */
  /*
   * O texto vira nós, e não string: uma frase pode trazer `[[item:3264]]`, e
   * ali entra o nome do item com a cor da raridade e o balão. Ver
   * `textoComItens`. Sem marca nenhuma, o fragmento é um nó de texto só — o
   * mesmo de antes.
   */
  /*
   * A ordem da linha: ícone, nome, level, fala.
   *
   * O ícone abre a linha porque é o que se lê primeiro ao correr o olho pelo
   * Global — antes de saber QUEM falou, vê-se O QUE falou. Depois do level ele
   * ficava espremido entre o colchete e a frase, e sumia.
   */
  const selo = seloDaVocacao(vocation);
  if (selo) line.append(selo);
  line.append(nomeComMarca(name, marca), el('span', 'lvl', ` [${level}] `), fala());
  /*
   * O anúncio do servidor chega com `channel: 'system'`, que não é aba nenhuma
   * — ele caía no Global, misturado com a conversa dos jogadores. A aba dele é
   * a `Servidor`, a mesma dos recados automáticos.
   */
  const aba = channel === 'system' ? 'sistema' : channel;
  push(logs[aba] ? aba : 'global', line);
}

/*
 * O recado do próprio jogo — conexão, boss vencido, aviso do dono.
 *
 * Vai para a aba `Servidor` e não mais para o Help: no Help gente conversa, e
 * um aviso automático no meio de uma pergunta empurra a pergunta para cima e
 * ainda parece a resposta dela.
 */
/*
 * O aviso do servidor. Ele desenha item, e não é enfeite: é por aqui que passa
 * o "fulano abriu a Bag You Desire e ganhou tal peça", e a graça do aviso é
 * justamente poder olhar a peça.
 */
export const logSystem = (text) => {
  const line = el('div', 'sys');
  line.append(textoComItens(text));
  return push('sistema', line);
};

/*
 * O mesmo recado, mas na aba que o jogador está olhando.
 *
 * O saco de prêmio é uma conquista e ela é pública — o lugar dela é o Global,
 * junto da conversa, e não numa aba de avisos que fica fechada. Ver o
 * `broadcast` do saco em index.mjs.
 */
export const logAviso = (text, channel = 'global', para = null) => {
  const line = el('div', 'sys');
  line.append(textoComItens(text));
  // O aviso de um privado ("fulano está offline") cai na aba DA CONVERSA.
  if (channel === 'private' && para) {
    const jaTinhaAba = conversas.has(idDaConversa(para));
    const id = garantirConversa(para, true);
    if (id) {
      line.classList.add('privado-aviso');
      push(id, line);
      if (built && !jaTinhaAba) render();
      return;
    }
  }
  return push(logs[channel] ? channel : 'global', line);
};

/*
 * ---- O drop raro de alguém, no Global ----
 * "quando alguém dropa um item épico pra cima aparece para todo mundo o nome
 * do item e a pessoa que dropou" (o dono). A linha fica no Global, com o nome
 * da peça na cor dela e o balão completo; a faixa no alto da tela
 * (`anuncio-drop.mjs`) é o aviso de fora do chat.
 */
export function logDropRaro(m) {
  const line = el('div', 'sys drop-raro');
  line.append(`✦ ${m.quem ?? 'Alguém'} dropou `, nomeDaPeca(m.peca, m.nome));
  if (m.bicho) line.append(m.boss ? ` do boss ${m.bicho}` : ` de ${m.bicho}`);
  return push('global', line);
}

/*
 * ---- De que TIPO é cada linha do combate ----
 *
 * "quando eu estiver na aba combate, a princípio tinha que mostrar tudo como já
 * tem, e poderia ter sub-aba tipo: só recebidos, só aplicados, curas, magias."
 *
 * Cada linha sai com `data-tipo`, uma lista de palavras, e a sub-aba escolhida
 * vira um atributo no log (`data-filtro`). Quem esconde é o CSS: trocar de
 * sub-aba não remonta nada, e as 200 linhas continuam guardadas — voltar para
 * "Tudo" mostra de novo o que estava escondido.
 *
 * Uma linha pode ter mais de um tipo: o golpe de uma magia é "aplicado" E
 * "magia", o golpe crítico é "aplicado" E "critico".
 */
const SUBABAS_DO_COMBATE = [
  { id: 'tudo', nome: 'Tudo' },
  { id: 'aplicado', nome: 'Aplicados' },
  { id: 'recebido', nome: 'Recebidos' },
  { id: 'magia', nome: 'Magias' },
  { id: 'critico', nome: 'Crít./Fatal' },
  { id: 'cura', nome: 'Curas' },
  { id: 'morte', nome: 'Mortes' },
];
const CHAVE_DA_SUBABA = 'draevor:chat-combate-filtro';
let subabaDoCombate = (() => {
  try {
    const salva = localStorage.getItem(CHAVE_DA_SUBABA);
    return SUBABAS_DO_COMBATE.some((sub) => sub.id === salva) ? salva : 'tudo';
  } catch {
    return 'tudo';
  }
})();

/** Mensagens do combate e do loot vêm dos eventos da hunt. */
export function logCombat(text, kind = '', tipos = '') {
  ultimoGolpe = null;
  const linha = el('div', kind, text);
  if (tipos) linha.dataset.tipo = tipos;
  push('combat', linha);
}

/*
 * ---- [FATAL] e [CRÍTICO] na frente do golpe ----
 *
 * "quando aplicar dano crítico ou fatal tem que aparecer lá, tipo [FATAL] ou
 * [CRÍTICO], da cor bonita."
 *
 * A linha dizia "(crítico)" no fim, em letra comum — e só quando o golpe vinha
 * sozinho: somado com outro, a palavra sumia. O fatal não aparecia em lugar
 * nenhum.
 *
 * Agora é uma etiqueta na FRENTE, na cor do efeito que sobe no mapa (o roxo do
 * FATAL!, o vermelho do CRIT!), que é onde o olho bate correndo o canal. E o
 * fatal ganha do crítico quando os dois caem juntos, como no desenho do mapa
 * (ver `FATAL_EFFECT`, no servidor).
 */
function etiquetaDoGolpe(event) {
  if (event.onslaught) return { classe: 'marca-fatal', texto: '[FATAL]', chave: 'fatal' };
  if (event.crit) return { classe: 'marca-critico', texto: '[CRÍTICO]', chave: 'critico' };
  return null;
}

/*
 * Combate rápido não pode virar enxurrada.
 *
 * Um paladino com haste bate três vezes por segundo em cinco criaturas: linha
 * por golpe enche as 200 do canal em pouco mais de um minuto e o jogador não
 * lê nada. Golpes seguidos da MESMA origem no MESMO alvo, dentro de 1,5s, se
 * juntam numa linha só que soma o dano e conta os golpes — nada é escondido,
 * só somado.
 */
const JANELA_DE_AGRUPAMENTO = 1500;
let ultimoGolpe = null;

function logGolpe(chave, kind, valor, montarTexto, { etiqueta = null, tipos = '' } = {}) {
  const agoraMs = Date.now();
  /*
   * A etiqueta entra na CHAVE: um crítico só se soma com outro crítico. Somar
   * três golpes comuns e um crítico numa linha "[CRÍTICO] ... em 4 golpes"
   * diria que os quatro foram críticos.
   */
  if (etiqueta) chave = `${etiqueta.chave}:${chave}`;
  if (ultimoGolpe && ultimoGolpe.chave === chave && agoraMs - ultimoGolpe.em < JANELA_DE_AGRUPAMENTO) {
    ultimoGolpe.total += valor;
    ultimoGolpe.golpes += 1;
    ultimoGolpe.em = agoraMs;
    // A linha já está no canal: reescreve só o TEXTO — a hora e a etiqueta ficam.
    ultimoGolpe.texto.textContent = montarTexto(ultimoGolpe.total, ultimoGolpe.golpes);
    /*
     * Nada de `render()` aqui.
     *
     * A linha ja' esta' na tela e o que mudou foi o texto DELA — remontar a
     * janela inteira para trocar um numero era o caminho mais caro de todos, e
     * o mais frequente: um paladino com haste bate tres vezes por segundo, e
     * quase todo golpe cai neste ramo.
     */
    return;
  }
  const node = el('div', kind);
  if (tipos) node.dataset.tipo = tipos;
  if (etiqueta) node.append(el('b', `marca-do-golpe ${etiqueta.classe}`, etiqueta.texto), ' ');
  const texto = el('span', null, montarTexto(valor, 1));
  node.append(texto);
  ultimoGolpe = { chave, total: valor, golpes: 1, em: agoraMs, node, texto };
  push('combat', node);
}

export function logLoot(text, kind = 'drop') {
  push('loot', el('div', `loot-line ${kind}`, text));
}

/*
 * ---- A mesma linha de loot, com as RARIDADES dentro ----
 *
 * Do dono: "o chat de loot poderia indicar as raridades no texto. no fluxo
 * normal fica só um bloco de texto a ser acompanhado. se houver a raridade,
 * podemos 'bater o olho' e identificar os pontos principais."
 *
 * Ele descreveu o problema com precisão: numa caçada o canal de loot é uma
 * parede de frases iguais, e o que interessa — o item que caiu uma vez na hora
 * — passa no meio sem se distinguir de trinta gold coins. É um problema de
 * LEITURA, não de conteúdo: a informação já estava lá.
 *
 * Por isso a linha não muda de texto. O que muda é que cada nome sai na cor da
 * raridade dele (as mesmas seis do balão e do mercado, `classeDaRaridade`) e a
 * linha inteira ganha uma marca da MELHOR raridade que caiu ali. A primeira
 * serve para ler a linha; a segunda para não precisar lê-la — é a barrinha na
 * margem que o olho pega correndo o canal para baixo.
 *
 * `logLoot` continua existindo para as linhas que não têm item nenhum (a de
 * "nada", a de sem capacidade, a do bestiary).
 */
export function logLootComItens(partes, kind = 'drop', marca = null) {
  const linha = el('div', `loot-line ${kind}${marca ? ` tem-${marca}` : ''}`);
  for (const parte of partes) linha.append(parte);
  push('loot', linha);
}

/*
 * ---- O "+" ao lado da engrenagem: abrir um privado pelo nome ----
 *
 * Ate aqui so' havia UM jeito de comecar uma conversa privada: achar a pessoa
 * no mapa e clicar com o botao direito nela. Isso exige que ela esteja na tela,
 * o que quase nunca acontece — quem se quer chamar no privado costuma estar do
 * outro lado do servidor.
 *
 * O botao mora na barra de titulo da janela e nao no corpo dela porque e' onde
 * a engrenagem ja esta, e as duas sao a mesma familia de coisa: comandos DA
 * janela. E' posto uma vez so' (`chat-mais`), porque `render` roda a cada linha
 * que chega.
 */
/*
 * ---- O chat FLUTUANTE: 100% transparente, como o do Crossfire ----
 *
 * Pedido do dono, opcional. Sem moldura e sem fundo: as falas ficam soltas por
 * cima do mapa, com sombra no texto para dar para ler em qualquer chão. As
 * abas, a caixa de texto e a barra de título só aparecem com o mouse em cima
 * ou escrevendo (Enter abre, como sempre).
 *
 * E as falas velhas SOMEM depois de alguns segundos, como no jogo de tiro: o
 * chat não vira um bloco de texto parado em cima da caçada. Nada é apagado de
 * verdade — passar o mouse ou abrir a caixa traz tudo de volta.
 *
 * A escolha é deste navegador (localStorage), como o arranjo das janelas.
 */
const CHAVE_DO_FLUTUANTE = 'draevor:chat-flutuante';
const SOME_EM_MS = 12_000;
const lerFlutuante = () => {
  try { return localStorage.getItem(CHAVE_DO_FLUTUANTE) === '1'; } catch { return false; }
};
let flutuante = lerFlutuante();

export const chatFlutuante = () => flutuante;

export function ligarChatFlutuante(ligado) {
  flutuante = !!ligado;
  try { localStorage.setItem(CHAVE_DO_FLUTUANTE, flutuante ? '1' : ''); } catch { /* sem armazenamento: vale só nesta aba */ }
  aplicarFlutuante();
}

function aplicarFlutuante() {
  const janela = windowBody('chat')?.closest?.('.window');
  if (!janela) return;
  janela.classList.toggle('chat-flutuante', flutuante);
  const botao = janela.querySelector('.chat-flutuar');
  if (botao) {
    botao.setAttribute('aria-pressed', String(flutuante));
    botao.title = flutuante ? 'voltar o chat com moldura' : 'chat transparente e flutuante (as falas somem depois de alguns segundos)';
  }
  apagarFalasVelhas();
}

/** Marca as falas que já passaram do tempo; o CSS esconde, o hover mostra. */
function apagarFalasVelhas() {
  if (!logEl?.isConnected) return;
  const limite = Date.now() - SOME_EM_MS;
  for (const linha of logEl.children) {
    const chegou = Number(linha.dataset.chegou) || 0;
    linha.classList.toggle('chat-velha', flutuante && chegou < limite);
  }
}
setInterval(() => {
  if (flutuante) apagarFalasVelhas();
}, 1000);

function porBotaoDeNovaConversa(body) {
  /*
   * Tudo opcional de proposito: este botao e' um extra da barra de titulo, e o
   * chat tem de montar mesmo sem ele. O teste do chat monta a janela num DOM de
   * mentira que nao tem `closest` — e um extra que derruba a janela inteira e'
   * pior do que extra nenhum.
   */
  // A barra de titulo e um `<header>` sem classe (ver `createWindow`), e nao
  // um `.window-header` — procurar pela classe nao achava nada.
  const cabecalho = body.closest?.('.window')?.querySelector?.('header');
  if (!cabecalho || cabecalho.querySelector('.chat-mais')) return;

  // O botão do modo flutuante, ao lado do "+". Ver `ligarChatFlutuante`.
  const flutuar = document.createElement('button');
  flutuar.type = 'button';
  flutuar.className = 'window-reset chat-flutuar';
  flutuar.textContent = '◐';
  flutuar.onclick = (evento) => {
    evento.stopPropagation();
    ligarChatFlutuante(!flutuante);
  };
  cabecalho.insertBefore(flutuar, cabecalho.querySelector('.window-reset'));

  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'window-reset chat-mais';
  botao.textContent = '+';
  botao.title = 'abrir abas (Combate, Loot) ou conversar no privado';
  botao.onclick = (evento) => {
    evento.stopPropagation();
    perguntarComQuem();
  };
  cabecalho.insertBefore(botao, cabecalho.querySelector('.window-reset'));
}

/** A caixinha de "com quem?", no mesmo desenho das outras confirmacoes. */
function perguntarComQuem() {
  document.querySelector('.confirm-back.chat-com-quem')?.remove();

  const back = el('div', 'confirm-back chat-com-quem');
  const box = el('div', 'confirm-box');
  box.append(el('b', null, 'Abas do chat'));

  /*
   * As abas que o jogo escreve sozinho ficam aqui, e não numa tela de opções.
   *
   * É o mesmo `+` que abre conversa: as duas coisas são "quero mais uma aba".
   * Separá-las em dois lugares faria o jogador procurar Combate dentro das
   * opções do jogo, que é onde ele não está.
   *
   * Marcar já vale: sem botão de confirmar, porque não há o que confirmar — a
   * aba aparece atrás da caixinha na hora, e desmarcar desfaz.
   */
  const opcionais = el('div', 'chat-abas-opcionais');
  for (const canal of CHANNELS.filter((c) => c.opcional)) {
    const linha = el('label', 'chat-aba-opcao');
    const marca = document.createElement('input');
    marca.type = 'checkbox';
    marca.checked = abertas.has(canal.id);
    marca.onchange = () => {
      alternarAba(canal.id, marca.checked);
      render();
    };
    linha.append(marca, el('span', null, canal.name));
    opcionais.append(linha);
  }
  box.append(opcionais);

  box.append(el('p', 'shop-note', 'Ou escreva o nome exato de um personagem para conversar no privado.'));

  const campo = document.createElement('input');
  campo.type = 'text';
  campo.className = 'quantia-campo';
  campo.placeholder = 'nome do personagem';
  campo.autocomplete = 'off';
  campo.maxLength = 32;
  box.append(campo);

  const fechar = () => back.remove();
  const confirmar = () => {
    const nome = campo.value.trim();
    fechar();
    if (nome) {
      abrirConversa(nome);
      render();
    }
  };

  const acoes = el('div', 'confirm-actions');
  const cancelar = el('button', 'ghost', 'Cancelar');
  cancelar.onclick = fechar;
  const ok = el('button', 'primary', 'Abrir');
  ok.onclick = confirmar;
  acoes.append(cancelar, ok);
  box.append(acoes);

  back.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      confirmar();
    } else if (evento.key === 'Escape') {
      evento.preventDefault();
      fechar();
    }
    // O jogo escuta teclas soltas (a barra de acoes): digitar um nome nao pode
    // sair disparando magia.
    evento.stopPropagation();
  });

  back.append(box);
  fecharAoClicarFora(back, fechar);
  document.body.append(back);
  campo.focus();
}

/*
 * ---- Os emotes ----
 *
 * "no chat adiciona pra ser possível enviar emotes."
 *
 * Nada de imagem nem de código próprio: são caracteres, como qualquer letra da
 * frase. Isso importa mais do que parece — significa que o servidor não muda
 * (ele já corta a linha em 200 e manda como está), o histórico funciona, a seta
 * para cima traz a frase de volta e quem estiver com o jogo aberto numa versão
 * antiga continua lendo tudo. Uma tabela de `:sorriso:` traduzida na tela seria
 * um segundo alfabeto para manter, e ninguém pediu um segundo alfabeto.
 *
 * A lista não é um teclado de emoji inteiro: numa conversa de jogo se ri, se
 * agradece, se combina uma caçada e se xinga um boss. Estas são essas.
 */
/*
 * A lista cresceu a pedido — "coloca mais alguns emotes" —, e cresceu por
 * FILEIRA e não a esmo: a gaveta tem oito por linha, e as linhas estão
 * agrupadas por assunto (caras, mãos, combate, tesouro, bicho, lugar, tempo,
 * sinal). Quem procura "o do dinheiro" olha a fileira do tesouro em vez de
 * varrer setenta e dois quadradinhos.
 */
const EMOTES = [
  '😀', '😂', '😅', '😎', '😉', '😜', '🙂', '😐',
  '😢', '😭', '😡', '😱', '🤔', '🥱', '🤤', '🤯',
  '😴', '🤒', '🥳', '😇', '🤡', '👀', '🙄', '😬',
  '🤝', '👍', '👎', '👏', '🙏', '💪', '✌️', '👋',
  '⚔️', '🛡️', '🏹', '🗡️', '🪓', '🔨', '🪄', '🔮',
  '💰', '💎', '🧪', '📜', '🔑', '🎁', '🏆', '👑',
  '❤️', '💙', '💚', '💛', '💀', '☠️', '🔥', '❄️',
  '⚡', '☢️', '🌪️', '✨', '⭐', '🌙', '☀️', '🌧️',
  '🐉', '🐺', '🕷️', '🦂', '🐀', '🦇', '👻', '👹',
];

/*
 * A gaveta de emotes, aberta pelo botão ao lado do "Enviar".
 *
 * Ela é montada UMA vez por render e fica escondida — e não criada a cada
 * clique — para o ouvinte de "clicou fora" ter sempre o mesmo nó para vigiar.
 *
 * O foco volta para a caixa de texto depois de cada emote, e o cursor fica
 * DEPOIS do que foi posto: quem clica em dois seguidos está escrevendo "😂😂",
 * e um cursor que volta para o começo escreveria ao contrário.
 */
function gavetaDeEmotes(input) {
  const gaveta = el('div', 'chat-emotes');
  gaveta.hidden = true;
  for (const emote of EMOTES) {
    const botao = el('button', 'chat-emote', emote);
    botao.type = 'button';
    botao.title = emote;
    /*
     * `mousedown` com `preventDefault` em vez de `click`: apertar o botão tira
     * o foco da caixa de texto antes de o clique existir, e aí `selectionStart`
     * já não diz onde o cursor estava. Barrando a ação padrão, o foco nunca sai.
     */
    botao.addEventListener('mousedown', (evento) => {
      evento.preventDefault();
      const antes = input.value;
      const de = input.selectionStart ?? antes.length;
      const ate = input.selectionEnd ?? de;
      input.value = antes.slice(0, de) + emote + antes.slice(ate);
      const fim = de + emote.length;
      input.setSelectionRange(fim, fim);
      input.focus();
    });
    gaveta.append(botao);
  }
  return gaveta;
}


export function render() {
  const body = windowBody('chat');
  if (!body) return;
  built = true;
  porBotaoDeNovaConversa(body);

  /*
   * ---- O que estava sendo DIGITADO sobrevive ao redesenho ----
   *
   * Report do Garibas: "se to digitando e vc me manda msg, ele ta apagando tudo
   * que eu digitei".
   *
   * `render()` limpa o corpo da janela e monta um `input` NOVO, vazio. Quem
   * estivesse no meio de uma frase perdia a frase — e o gatilho mais comum era
   * justamente uma mensagem privada chegando, que e' quando a pessoa esta'
   * escrevendo a resposta.
   *
   * Guardado ANTES de limpar o corpo, porque depois disso o `input` esta' solto
   * do documento e o `document.activeElement` ja' e' outro.
   *
   * ---- E o rascunho e' DA ABA em que foi escrito ----
   *
   * Trocar de aba nao carrega o texto junto. "manda ouro ai" escrito no Global e
   * levado para a aba de um privado sairia, no Enter seguinte, para uma pessoa
   * so' — e a pessoa errada. Cada caixa devolve o que foi escrito NELA.
   */
  const oQueEstavaEscrito = inputEl?.isConnected
    ? {
        canal: canalDoInput,
        texto: inputEl.value,
        de: inputEl.selectionStart ?? inputEl.value.length,
        ate: inputEl.selectionEnd ?? inputEl.value.length,
        focado: document.activeElement === inputEl,
      }
    : null;

  body.innerHTML = '';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';

  // Uma aba gravada que nao existe mais (a conversa foi fechada, ou o formato
  // antigo com a aba unica de "Privado") volta para o global.
  if (!canais().some((canal) => canal.id === active)) active = 'global';

  const tabs = el('div', 'chat-tabs');
  tabsEl = tabs;
  for (const channel of canais()) {
    const button = el('button', ehConversa(channel.id) ? 'chat-conversa' : null, channel.name);
    button.setAttribute('aria-selected', String(channel.id === active));
    pintarMarca(button, channel, channel.id === active ? 0 : unread[channel.id]);
    pintarPresenca(button, channel);
    button.onclick = () => {
      active = channel.id;
      unread[channel.id] = 0;
      if (ehConversa(active)) comQuem = nomeDaConversa(active);
      localStorage.setItem('draevor:chat', active);
      render();
    };
    // A conversa fecha no proprio X — canal fixo nao fecha.
    if (ehConversa(channel.id)) {
      const fechar = el('i', 'chat-fecha', '×');
      fechar.title = `fechar a conversa com ${channel.name}`;
      fechar.onclick = (evento) => {
        evento.stopPropagation();
        fecharConversa(channel.id);
        render();
      };
      button.append(fechar);
    }
    tabs.append(button);
  }
  body.append(tabs);

  const log = el('div', 'chat-log');
  logEl = log;
  if (active === 'combat') {
    const subabas = el('div', 'chat-subabas');
    const botoes = [];
    for (const sub of SUBABAS_DO_COMBATE) {
      const botao = el('button', null, sub.nome);
      botao.type = 'button';
      botao.setAttribute('aria-selected', String(sub.id === subabaDoCombate));
      botao.onclick = () => {
        subabaDoCombate = sub.id;
        try { localStorage.setItem(CHAVE_DA_SUBABA, sub.id); } catch { /* vale só nesta aba */ }
        log.dataset.filtro = sub.id;
        for (const outro of botoes) outro.setAttribute('aria-selected', String(outro === botao));
        // Trocar o filtro muda o que está no fim: leva a vista para a linha mais nova.
        log.scrollTop = log.scrollHeight;
      };
      botoes.push(botao);
      subabas.append(botao);
    }
    body.append(subabas);
    log.dataset.filtro = subabaDoCombate;
  }
  for (const line of logs[active]) log.append(line);
  body.append(log);
  aplicarFlutuante();

  const channel = canais().find((entry) => entry.id === active);
  const daConversa = ehConversa(active) ? nomeDaConversa(active) : null;
  if (channel?.writable) {
    const form = el('form', 'chat-form');
    const input = el('input');
    inputEl = input;
    canalDoInput = active;
    // Numa conversa a caixa diz PARA QUEM se esta escrevendo — o nome ja esta
    // na aba, e aqui ele confirma para quem a linha vai sair.
    input.placeholder = daConversa ? `falar com ${daConversa}...` : `falar em ${channel.name.toLowerCase()}...`;
    input.disabled = false;
    input.autocomplete = 'off';
    input.maxLength = 200;
    // O jogo anda com WASD: enquanto o chat tem foco, as teclas são do texto.
    input.addEventListener('focus', () => document.body.classList.add('typing'));
    input.addEventListener('blur', () => document.body.classList.remove('typing'));

    /*
     * ---- As setas andam pelo que já foi dito ----
     *
     * Ver `historico`, acima. `preventDefault` porque a seta dentro de um
     * `input` leva o cursor para a ponta do texto, e isso brigaria com a troca
     * de frase: a frase nova apareceria com o cursor no lugar errado.
     *
     * O cursor vai para o FIM da frase trazida, que é onde se continua
     * escrevendo.
     */
    /*
     * ---- Tab troca de aba ----
     *
     * O dono: "ao estar no chat e apertar tab tem que alternar entre os chats
     * abertos". Shift+Tab volta. Só as abas em que se ESCREVE entram na roda —
     * Servidor, Combate e Loot não têm caixa, e parar numa delas tiraria o
     * cursor do chat: o Tab seguinte já não chegaria aqui.
     */
    input.addEventListener('keydown', (evento) => {
      if (evento.key !== 'Tab' || evento.ctrlKey || evento.altKey) return;
      const roda = canais().filter((canal) => canal.writable);
      if (roda.length < 2) return;
      evento.preventDefault();
      const aqui = roda.findIndex((canal) => canal.id === active);
      const proxima = roda[(aqui + (evento.shiftKey ? -1 : 1) + roda.length) % roda.length];
      active = proxima.id;
      unread[active] = 0;
      if (ehConversa(active)) comQuem = nomeDaConversa(active);
      localStorage.setItem('draevor:chat', active);
      render();
      inputEl?.focus();
    });

    input.addEventListener('keydown', (evento) => {
      if (evento.key !== 'ArrowUp' && evento.key !== 'ArrowDown') return;
      if (!historico.length) return;
      evento.preventDefault();
      if (evento.key === 'ArrowUp') {
        // A primeira subida guarda o que estava escrito, para a descida devolver.
        if (ondeNoHistorico < 0) rascunho = input.value;
        ondeNoHistorico = Math.min(ondeNoHistorico + 1, historico.length - 1);
      } else {
        ondeNoHistorico -= 1;
      }
      if (ondeNoHistorico < 0) {
        ondeNoHistorico = -1;
        input.value = rascunho;
      } else {
        input.value = historico[ondeNoHistorico];
      }
      const fim = input.value.length;
      input.setSelectionRange(fim, fim);
    });

    /*
     * O botão dos emotes fica ENTRE a caixa e o "Enviar".
     *
     * Ali ele está no caminho da mão que já vai clicar em enviar, e não numa
     * barra própria que comeria uma linha da janela — o chat tem 300px, e cada
     * linha vale uma fala a menos na tela.
     */
    const gaveta = gavetaDeEmotes(input);
    const emotes = el('button', 'chat-emotes-botao', '☺');
    emotes.type = 'button';
    emotes.title = 'Emotes';
    emotes.setAttribute('aria-label', 'emotes');
    /*
     * Fechar clicando fora é escrito aqui, e não com o `fecharAoClicarFora` do
     * windows.mjs: aquele espera um FUNDO que cobre a tela e fecha quando o
     * clique cai nele mesmo. A gaveta é um retângulo de 200px sem fundo nenhum,
     * e clicar no mapa nunca chegaria nele.
     *
     * O ouvinte é posto no documento e tirado ao fechar — deixá-lo pendurado
     * acumularia um por abertura, e o chat se redesenha a cada mensagem.
     */
    const foraDaGaveta = (evento) => {
      if (gaveta.contains(evento.target) || evento.target === emotes) return;
      fecharGaveta();
    };
    const fecharGaveta = () => {
      gaveta.hidden = true;
      document.removeEventListener('pointerdown', foraDaGaveta, true);
    };
    /*
     * ---- A gaveta é posicionada NA TELA, e não dentro da janela ----
     *
     * Report do dono: "dependendo do chat os emotes nao mostram todos".
     *
     * Ela era `position: absolute` dentro do formulário, subindo a partir da
     * caixa de texto. São nove fileiras de emote — perto de 250px de altura —, e
     * a janela do chat não tem tanto espaço acima do rodapé quando está baixa
     * ou perto do topo do monitor: as primeiras fileiras eram cortadas pela
     * borda da janela, e ficavam invisíveis e inclicáveis. As últimas apareciam,
     * o que fazia parecer que a lista era menor do que é.
     *
     * `fixed` tira a gaveta de dentro de qualquer recorte de ancestral, e as
     * coordenadas são calculadas na ABERTURA a partir do botão: ela sobe dele,
     * encosta na borda de cima quando não cabe e aí ROLA por dentro (o
     * `max-height` do CSS). Nunca some, nunca sai da tela.
     *
     * Calculado na abertura, e não uma vez só: a janela do chat se arrasta e se
     * redimensiona, e uma posição guardada estaria velha no clique seguinte.
     */
    const posicionarGaveta = () => {
      const caixa = emotes.getBoundingClientRect();
      const largura = Math.min(292, window.innerWidth - 16);
      // Alinhada pela direita do botão, presa dentro da tela dos dois lados.
      const esquerda = Math.max(8, Math.min(caixa.right - largura, window.innerWidth - largura - 8));
      gaveta.style.width = `${largura}px`;
      gaveta.style.left = `${Math.round(esquerda)}px`;
      // Sobe a partir do botão; o teto de altura mora no CSS e faz a rolagem.
      gaveta.style.bottom = `${Math.round(window.innerHeight - caixa.top + 6)}px`;
    };
    emotes.onclick = () => {
      if (gaveta.hidden) {
        gaveta.hidden = false;
        posicionarGaveta();
        document.addEventListener('pointerdown', foraDaGaveta, true);
      } else {
        fecharGaveta();
        input.focus();
      }
    };

    const submit = el('button', null, 'Enviar');
    submit.type = 'submit';
    form.append(gaveta, input, emotes);

    /*
     * O 🎤, só no Global e nas conversas: é onde o dono quis o áudio. No Local a
     * fala vira balão em cima do boneco, e um balão não toca som.
     */
    if (active === 'global' || daConversa) {
      const canal = daConversa ? 'private' : 'global';
      const gravandoAqui = gravacao && gravacao.canal === canal && (gravacao.para ?? null) === (daConversa ?? null);
      const mic = el('button', `chat-mic${gravandoAqui ? ' gravando' : ''}`, gravandoAqui ? `■ ${tempo((performance.now() - gravacao.inicio) / 1000)}` : '🎤');
      mic.type = 'button';
      mic.title = gravandoAqui ? 'Parar e enviar o áudio' : `Gravar áudio (até ${SEGUNDOS_DO_AUDIO}s)`;
      mic.setAttribute('aria-label', mic.title);
      mic.disabled = !!gravacao && !gravandoAqui;
      mic.onclick = () => (gravandoAqui ? pararGravacao() : comecarGravacao(canal, daConversa));
      form.append(mic);
      if (gravandoAqui) {
        const cancelar = el('button', 'chat-mic-cancelar', '✕');
        cancelar.type = 'button';
        cancelar.title = 'Cancelar o áudio';
        cancelar.onclick = () => pararGravacao({ cancelar: true });
        form.append(cancelar);
        input.disabled = true;
        input.placeholder = 'gravando áudio...';
      }
    }
    form.append(submit);
    form.onsubmit = (event) => {
      event.preventDefault();
      if (input.value.trim()) {
        // O privado leva o destinatário junto; os outros canais são para todos.
        if (daConversa) {
          send?.({ t: 'chat', channel: 'private', to: daConversa, text: input.value });
        } else {
          send?.({ t: 'chat', channel: active, text: input.value });
        }
      }
      /*
       * Guarda no histórico o que FOI ENVIADO, e só uma vez seguida: mandar a
       * mesma frase três vezes não pode encher a lista com três cópias, senão a
       * seta para cima precisaria de três toques para chegar na anterior.
       */
      const dito = input.value.trim();
      if (dito && historico[0] !== dito) {
        historico.unshift(dito);
        if (historico.length > HISTORICO_MAXIMO) historico.length = HISTORICO_MAXIMO;
      }
      ondeNoHistorico = -1;
      rascunho = '';
      input.value = '';
      /*
       * ---- E o foco SAI da caixa ----
       *
       * Sem isto, o Enter que abre a caixa vira uma armadilha: a pessoa fala,
       * aperta W para andar e escreve "w" na caixa em vez de dar um passo. O
       * jogo anda com o teclado, e uma caixa de texto que fica com o foco
       * depois de enviada é uma caixa que sequestrou o teclado.
       *
       * Dois Enters: um abre e um manda. É o mesmo par de todo jogo que anda
       * com WASD, e é o que o Escape também faz — ver o `naTecla` do main.
       */
      input.blur();
    };
    body.append(form);
    /*
     * Depois do `append`: `focus()` so' pega num elemento que ja' esta' na tela,
     * e o cursor volta para onde estava — nao para o fim, senao quem corrigia o
     * meio da frase perdia o lugar.
     */
    if (oQueEstavaEscrito && oQueEstavaEscrito.canal === active) {
      input.value = oQueEstavaEscrito.texto;
      if (oQueEstavaEscrito.focado) {
        input.focus();
        input.setSelectionRange(oQueEstavaEscrito.de, oQueEstavaEscrito.ate);
      }
    }
  } else {
    // Sem caixa nesta aba: quem apontava para a de antes tem de largar, senão o
    // shift+clique num item escreveria numa caixa que não está mais na tela.
    inputEl = null;
    canalDoInput = null;
    body.append(el('p', 'chat-readonly', 'Este canal só mostra o que acontece na hunt.'));
  }

  log.scrollTop = log.scrollHeight;
}

/** Milhar com ponto, como o resto do jogo. */
const money = (valor) => Math.round(Number(valor) || 0).toLocaleString('pt-BR');

/** Traduz os eventos da simulação para as abas de combate e loot. */
/*
 * ---- Qual raridade "vale mais" ----
 *
 * `classeDaRaridade` traduz uma ficha em cor, e é tudo o que o balão precisa.
 * Para marcar a LINHA é preciso comparar, e comparar exige uma ordem — nenhuma
 * conta sobre as palavras "raro" e "épico" diz qual das duas é maior.
 *
 * A escada é a do `content.mjs`, que é quem atribui a raridade a partir da
 * chance de drop. As três primeiras ficam de fora da MARCA de propósito: quase
 * todo loot de caçada é comum ou incomum, e uma barrinha em toda linha não
 * marca nada — marcar tudo é o mesmo que não marcar.
 */
const ORDEM_DA_RARIDADE = ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico'];
const MARCA_A_PARTIR_DE = ORDEM_DA_RARIDADE.indexOf('raro');

function melhorRaridade(metas) {
  let melhor = -1;
  for (const meta of metas) {
    const posto = ORDEM_DA_RARIDADE.indexOf(meta?.rarity ?? 'comum');
    if (posto > melhor) melhor = posto;
  }
  if (melhor < MARCA_A_PARTIR_DE) return null;
  return classeDaRaridade({ rarity: ORDEM_DA_RARIDADE[melhor] });
}

export function feedEvents(events, items, eu = null) {
  for (const event of events) {
    // Golpe que não passou não vira linha de log: ver a mesma trava no `map.mjs`.
    if ((event.t === 'dmg' || event.t === 'heal') && !event.v) continue;
    if (event.t === 'dmg') {
      /*
       * O log de combate diz QUEM fez o quê.
       *
       * Era uma coluna de números — "Você causou 12.450 de dano." — sem dizer
       * em quem, nem de quem veio o que se levou. Com dez criaturas na tela e
       * várias magias na barra, o canal não servia para entender nada.
       */
      if (event.foe) {
        const emQuem = event.alvo ? ` em ${event.alvo}` : '';
        const comOQue = event.spell
          ? `${event.spell} causou`
          : event.charm
            ? `O charm ${event.charm} causou`
            : event.veneno
              ? 'O veneno causou'
              : 'Você causou';
        const etiqueta = etiquetaDoGolpe(event);
        logGolpe(
          `saiu:${comOQue}:${event.alvo ?? ''}`,
          'hit',
          event.v,
          (total, golpes) => `${comOQue} ${money(total)} de dano${emQuem}${golpes > 1 ? ` em ${golpes} golpes` : ''}.`,
          {
            etiqueta,
            tipos: ['aplicado', event.spell ? 'magia' : '', etiqueta ? 'critico' : ''].filter(Boolean).join(' '),
          }
        );
      } else {
        const quem = event.de ?? 'Algo';
        const comOQue = event.golpe ? ` ${event.golpe}` : '';
        logGolpe(
          `levou:${quem}:${event.golpe ?? ''}`,
          'hurt',
          event.v,
          (total, golpes) =>
            `${quem} causou ${money(total)} de dano${comOQue} em você${golpes > 1 ? ` (${golpes}x)` : ''}.`,
          { tipos: 'recebido' }
        );
      }
    } else if (event.t === 'kill') {
      logCombat(`Você matou ${event.name} e ganhou ${money(event.exp)} de experiência.`, 'kill', 'morte');
    } else if (event.t === 'heal') {
      // A cura diz o nome da magia ou do item que curou.
      logCombat(
        event.fonte
          ? `${event.fonte} curou você em ${money(event.v)} HP.`
          : `Você recuperou ${money(event.v)} de vida.`,
        'heal',
        'cura'
      );
    } else if (event.t === 'say') {
      // A fala do combate é a palavra da magia que acabou de sair.
      logCombat(event.text, 'say', 'magia');
    } else if (event.t === 'loot') {
      /*
       * A linha do canal de loot é a do servidor: o que caiu de cada bicho.
       *
       * Em grupo o servidor manda também COM QUEM cada drop ficou — o rodízio da
       * divisão só é visível se a linha disser o nome. Sozinho o campo não vem e
       * a linha é a de sempre.
       */
      const caiu = event.items ?? [];
      if (!caiu.length) {
        logLoot(`Loot de ${event.name}: nada.`, 'empty');
      } else {
        /*
         * Cada nome vira um `<span>` com a classe da raridade — e só o NOME: a
         * quantidade fica na cor do texto, senão um "30" dourado diria que o
         * número é lendário.
         */
        const pecas = (lista) => {
          const saida = [];
          lista.forEach((entry, i) => {
            if (i) saida.push(', ');
            if (entry.count > 1) saida.push(`${entry.count} `);
            const meta = items[entry.id];
            saida.push(el('span', classeDaRaridade(meta, entry), meta?.name ?? `item ${entry.id}`));
          });
          return saida;
        };
        /*
         * ---- Em grupo: o SEU loot, e o dos outros a um clique ----
         *
         * Primeiro o dono pediu "mostrar o que cada pessoa dropou, mas
         * organizado", e a linha virou uma fileira por pessoa. Ficou legível —
         * e aí o problema passou a ser o tamanho: "poluiu muito o chat". Com
         * quatro pessoas, cada bicho morto ocupava cinco linhas.
         *
         * O pedido seguinte resolve as duas coisas: "mostra o seu loot, e se
         * estiver em party aparece ver loot de x, ver loot de y".
         *
         * A linha volta a ter o tamanho de sempre, com o que caiu para VOCÊ (e
         * a moeda, que não é de ninguém). Os outros viram botõezinhos "ver loot
         * de Frida" no fim; clicar abre a fileira dela logo abaixo, clicar de
         * novo fecha. A fileira aberta continua aberta ao trocar de aba — a
         * linha é o mesmo nó, e o estado mora nele.
         *
         * Sozinho não há `quem` em nenhuma peça, e a linha é a de sempre.
         */
        const emGrupo = caiu.some((entry) => entry.quem);
        const partes = [`Loot de ${event.name}:`];
        let paraAMarca = caiu;
        if (!emGrupo) {
          partes.push(' ', ...pecas(caiu), '.');
        } else {
          const porPessoa = new Map();
          const doGrupo = [];
          for (const entry of caiu) {
            if (!entry.quem) {
              doGrupo.push(entry);
              continue;
            }
            const dela = porPessoa.get(entry.quem) ?? new Map();
            const ja = dela.get(entry.id);
            dela.set(entry.id, { id: entry.id, count: (ja?.count ?? 0) + (entry.count ?? 1) });
            porPessoa.set(entry.quem, dela);
          }
          const meu = [...doGrupo, ...(eu && porPessoa.has(eu) ? porPessoa.get(eu).values() : [])];
          partes.push(' ', ...(meu.length ? pecas(meu) : [el('i', 'loot-nada', 'nada para você')]), '.');
          /*
           * A barrinha da margem fala do SEU loot. Ela existe para o olho parar
           * onde vale a pena, e um "lendário" que caiu para outra pessoa não é
           * motivo para você parar — ele está a um clique, no botão dela.
           */
          paraAMarca = meu;

          const outros = [...porPessoa.keys()].filter((nome) => nome !== eu);
          if (outros.length) {
            const botoes = el('span', 'loot-ver');
            for (const nome of outros) {
              const botao = el('button', 'loot-ver-botao', `ver loot de ${nome}`);
              botao.type = 'button';
              const fileiraDela = () => {
                const fileira = el('div', 'loot-pessoa');
                const dela = el('span', 'loot-pecas');
                dela.append(...pecas([...porPessoa.get(nome).values()]));
                fileira.append(el('b', 'loot-quem', nome), dela);
                return fileira;
              };
              /*
               * ---- Passar o MOUSE já mostra ----
               *
               * "em vez de ver o loot da party através do click, só de passar o
               * mouse já mostraria."
               *
               * O loot dela sobe num balão logo acima do botão e some quando o
               * mouse sai. É um balão, e não a fileira aberta dentro da linha:
               * abrir e fechar a linha a cada passada de mouse faria o chat
               * inteiro pular para cima e para baixo enquanto o ponteiro corre
               * pelos botões.
               *
               * O clique continua, e é para o TELEFONE: lá não existe passar o
               * mouse, e sem ele o loot dos outros ficaria inalcançável. Por isso
               * o balão só atende ponteiro de mouse (`pointerType`) — um toque
               * dispara `pointerenter` também, e abriria balão e fileira juntos.
               */
              let balao = null;
              const fecharBalao = () => {
                balao?.remove();
                balao = null;
              };
              botao.addEventListener('pointerenter', (evento) => {
                if (evento.pointerType !== 'mouse') return;
                fecharBalao();
                balao = el('div', 'loot-balao');
                balao.append(fileiraDela());
                document.body.append(balao);
                // Um clique em qualquer lugar (trocar de aba, fechar o chat) tira o balão
                // junto: sem isso ele ficava órfão quando o botão saía da tela sem
                // o mouse passar por fora dele.
                window.addEventListener('pointerdown', fecharBalao, { once: true });
                const caixa = botao.getBoundingClientRect();
                const largura = balao.offsetWidth;
                const esquerda = Math.max(6, Math.min(window.innerWidth - largura - 6, caixa.left));
                balao.style.left = `${esquerda}px`;
                // Acima do botão; sem espaço em cima, embaixo dele.
                const topo = caixa.top - balao.offsetHeight - 6;
                balao.style.top = `${topo >= 6 ? topo : caixa.bottom + 6}px`;
              });
              botao.addEventListener('pointerleave', fecharBalao);
              let fileira = null;
              botao.onclick = (evento) => {
                evento.stopPropagation();
                /*
                 * No telefone, o jeito de ver. No mouse, clicar FIXA a fileira na linha
                 * (o `pointerdown` acima já tirou o balão), para quem quer deixá-la
                 * aberta enquanto lê outra coisa.
                 */
                if (fileira) {
                  fileira.remove();
                  fileira = null;
                  botao.classList.remove('aberto');
                  return;
                }
                fileira = fileiraDela();
                botao.closest('.loot-line')?.append(fileira);
                botao.classList.add('aberto');
              };
              botoes.append(botao);
            }
            partes.push(' ', botoes);
          }
        }
        /*
         * A marca da linha é a MELHOR raridade que caiu. Ver `ORDEM_DA_RARIDADE`
         * — a ordem precisa estar escrita em algum lugar, porque "épico > raro"
         * não é uma conta que se faça com as strings.
         */
        logLootComItens(partes, 'drop', melhorRaridade(paraAMarca.map((entry) => items[entry.id])));
      }
    } else if (event.t === 'nocap') {
      // Loot que ficou no chão por falta de capacidade.
      const left = (event.items ?? [])
        .map((entry) => `${entry.count > 1 ? `${entry.count} ` : ''}${items[entry.id]?.name ?? `item ${entry.id}`}`)
        .join(', ');
      logLoot(
        event.semLugar
          ? `A bolsa está no limite de linhas: ${left || 'parte do loot'} ficou no chão. Limpe a bolsa.`
          : `Sem capacidade: ${left || 'parte do loot'} ficou no chão. Venda a bolsa.`,
        'nocap'
      );
    } else if (event.t === 'bestiaryDone') {
      logLoot(`Bestiary de ${event.name} completo: +${event.points} pontos de charm.`, 'charm');
    } else if (event.t === 'equip') {
      // Em grupo o upgrade pode ter sido do companheiro, e a frase diz de quem.
      const oque = event.name ?? items[event.id]?.name ?? 'um item';
      logCombat(event.quem ? `${event.quem} equipou ${oque}.` : `Você equipou ${oque}.`, 'heal');
    }
  }
}
