import './so-quando-muda.mjs';
import { anunciarDrop } from './anuncio-drop.mjs';
import { acompanharConjuracao } from './conjuracao.mjs';
import { loadSpriteData, loadEffectData, emprestarDoCatalogo, itemCanvas, outfitCanvas, outfitInfo, imagemPronta } from './sprites.mjs';
import { MapView, definirCoresDeRaridade, dadosDaRaridade } from './map.mjs';
import { encontroNaCasa, encontroPerto } from './encontros-na-tela.mjs';
import {
  createWindow, windowBody, toggleWindow, setVisible, isVisible, setNotice, fecharAoClicarFora, quandoAbrir, esconderSemGravar,
  // O browse field troca o título a cada casa que abre: "Chão em 100, 65".
  setTitle,
} from './windows.mjs';
import { createGate, marcarVisto, cartaoDePersonagem } from './auth.mjs';
import { initHud, renderHud, artOrUiIcon, linhasDeEfeito, modoDosEfeitos, pintarBotaoDaFase } from './hud.mjs';
import { ARTES } from './artes.mjs';
import { abrirNaPilha, fechouNaPilha, fechouNaPilhaTudoQue } from './pilha.mjs';
import { ligarPerfil, ehTelefone } from './perfil.mjs';
import { initCelular, atualizarCelular, analogicoLigado, ligarFonteMinima } from './celular.mjs';
import {
  initInventory,
  esquecerOsDesenhos,
  renderInventory,
  renderPouch,
  renderContainer,
  // A janela da Boss Pouch, que e' uma mochila de verdade. Ver `renderBossPouch`.
  renderBossPouch,
  // E a da Store Inbox, onde chega o que se compra na Store.
  renderStoreInbox,
  abrirStoreInbox,
  atualizarDesgaste,
  itemCell,
  openMenu,
  quantosMover,
  openQuiverPicker,
} from './inventory.mjs';
import {
  initChat,
  render as renderChat,
  logChat,
  logSystem,
  logAviso,
  logDropRaro,
  feedEvents,
  abrirConversa,
  focarChat,
  soltarChat,
  receberAudio,
  receberPresenca,
  chatDoPersonagem,
} from './chat.mjs';
import { initSocial, menuDeJogador, abrirCastigo, menuDeMim, perguntarTroca, corpoDaTroca, abrirPerfil, mostrarPerfil } from './social.mjs';
import {
  initActionBar,
  renderActionBar,
  setActionCatalog,
  reiniciarCatalogoDeAcoes,
  capturarTecla,
  catalogoDeAcoesPronto,
  spellIcon,
  actionIcon,
  editarBarraDeOutro,
  atualizarBarraDeOutro,
} from './actionbar.mjs';
import {
  initPanels, openHunts, openPrey, openImbuements, openBlessings, openQuests, openOutfits,
  renderAppearance, openStore, openMarket, openBank, openLocker, openRanking,
  openProficiency, openCharms, openLootFilter, openLimparBolsa, openLimparMochila, openVenderMochila, openVenderSacolas, openVenderBossPouch, openFriends, openParty, corpoDaJanelaDaParty, atualizarBarrasDaParty, openBarSettings, caixaDoDepositoAberta, openForja,
  openDiario, openLojaNpc, openTreinoOffline, abrirObterCoins,
  resumoDoPreyParaBalao, resumoDosCharmsParaBalao, resumoDaProficienciaParaBalao,
  resumoDosImbuementsParaBalao, resumoDasGemasParaBalao,
  resumoDaMorteLigado, ligarResumoDaMorte, aplicarEstiloDaRaridade,
  openArena,
  openCyclopedia, openBestiary, openReport, openExerciseRapido, openExercise, openLojaDeBossToken, openLojaDeTaskToken, openLobby, TITULO_DO_LOBBY, openPresente, openCaixaBoosted,
  escolhasDaPosicao, cartazDeBossLigado, redesenharJanelaAberta,
  chegouFichaDoBicho,
} from './panels.mjs';
import { lootComGemas } from './loot-do-bicho.mjs';
import { renderSheet as renderSheetInto } from './sheet.mjs';
import { initTooltip, tipFor, tipPanel, tipTexto, ligarComparacao, receberComparacao, usarCatalogoDeAcoes } from './tooltip.mjs';
// O QR do pagamento, desenhado aqui dentro: ver `packages/shared/src/qrcode.mjs`.
import { qrcode } from '/packages/shared/src/qrcode.mjs';
import { initArvore } from './arvore.mjs';
import { initPassivas, openPassivas, aoReceberPassivas, resumoDasPassivasParaBalao } from './passivas.mjs';
import { initGemas, openGemas } from './gemas.mjs';
/* As guildas — e, depois, o castle war. Ver `guildas.mjs`. */
import { initGuildas, openGuildas, bauDaGuildaAberto, guardarNoBauDaGuilda } from './guildas.mjs';
// As chaves de gráficos dos Ajustes da tela. Ver `graficos.mjs`.
import { avisarORitmo, aplicarNoBody, vigiarLentidao } from './graficos.mjs';
// O contador de FPS e ping do canto. Ver `medidor.mjs`.
import { atualizarMedidor, pongChegou } from './medidor.mjs';
// O remendo dentro dos campos do delta. Ver `juntarOsRemendos`.
import { aplicarRemendo } from '/packages/shared/src/remendo.mjs';
import { initMobile, ehCelular } from './mobile.mjs';
import { initMinimapa, atualizarMinimapa } from './minimapa.mjs';
import { instalarArrastoDoMouse } from './arrasto-do-mouse.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

// Erros viram atributo no body para aparecerem em inspeção automatizada.
const reportError = (message) => {
  document.body.dataset.error = String(message);
  console.error(message);
};
window.addEventListener('error', (event) => reportError(event.message));
window.addEventListener('unhandledrejection', (event) => reportError(event.reason?.message ?? event.reason));

const state = {
  character: null,
  hunt: null,
  city: null,
  catalog: null,
  items: {},
  ranking: [],
  online: 0,
};

let socket = null;
let mapView = null;
let windowsReady = false;

/*
 * ---- A tela de carregamento da entrada ----
 *
 * O jogo não abre de imediato: antes do portão aparecer ele busca os desenhos
 * (`outfits.json`, `item-sprites.json`), a tabela de efeitos e as artes da
 * própria porta de entrada. Numa conexão de casa isso é um instante; numa
 * conexão ruim eram segundos de tela preta, sem nada dizendo que havia algo
 * acontecendo — e tela preta parada é indistinguível de jogo quebrado.
 *
 * Cada passo escreve o que está fazendo e empurra a barra. O nome de cada um é
 * o que ele de fato faz, e não enfeite: quem está esperando merece saber se o
 * que demora são os sprites ou a interface.
 */
const bootPassos = [];
function boot(texto, fracao, detalhe = '') {
  const passo = $('boot-passo');
  const barra = $('boot-progresso');
  const nota = $('boot-detalhe');
  if (passo) passo.textContent = texto;
  if (barra) barra.style.width = `${Math.round(fracao * 100)}%`;
  if (nota) nota.textContent = detalhe;
  bootPassos.push(texto);
}

/** Espera uma imagem chegar — ou desistir dela, que é melhor que travar a entrada. */
const esperarImagem = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });

boot('carregando os desenhos', 0.15, 'sprites de item e de personagem');
await loadSpriteData();

/* A escolha de como a raridade aparece, antes de a primeira célula ser
 * desenhada — senão a mochila nasce com o padrão e troca na frente do jogador.
 * Ver `aplicarEstiloDaRaridade` no `panels.mjs`. */
aplicarEstiloDaRaridade();

boot('carregando os efeitos', 0.45, 'magias, tiros e animações');
await loadEffectData();

/*
 * As artes da porta de entrada, esperadas de propósito.
 *
 * Elas já vêm com `<link rel=preload>` no HTML, mas o preload só PEDE — ele não
 * segura ninguém. Sem esperar aqui, a tela de carregamento saía e o portão
 * aparecia sem moldura e sem fundo por um quadro ou dois. Como já foram
 * pedidas, esta espera quase sempre é instantânea: o navegador entrega do
 * cache.
 */
boot('preparando a interface', 0.8, 'molduras e cenário');
await Promise.all([
  esperarImagem('/client/assets/ui/gate-bg.webp'),
  esperarImagem('/client/assets/ui/panel-frame.webp'),
  esperarImagem('/client/assets/ui/draevor-logo.webp'),
  document.fonts?.ready ?? Promise.resolve(),
]);

boot('pronto', 1);
/*
 * As chaves de gráficos, ANTES do primeiro quadro.
 *
 * Elas moram em marcas no `body` e são lidas pelo CSS. Aplicadas depois, quem
 * joga sem animação veria a interface inteira entrar animada uma vez, a cada
 * abertura — que é exatamente o que a pessoa desligou.
 */
aplicarNoBody();
/*
 * ---- O facho dourado é um elemento, e não um pseudo-elemento ----
 *
 * O anel que dá voltas nos botões com alerta e na placa da Store era um
 * `::after` com um gradiente cônico cujo ÂNGULO era animado — e isso obriga o
 * navegador a repintar o anel a cada quadro. Girar precisa de um filho: a
 * máscara em anel fica no `span`, e o gradiente, pintado uma vez, gira dentro
 * dele (`transform`, que a placa de vídeo faz sozinha). Ver "ANIMAÇÕES LEVES".
 */
let vigiouLentidao = false;

function garantirFacho(botao) {
  if (!botao || botao.querySelector(':scope > .facho')) return;
  const facho = document.createElement('span');
  facho.className = 'facho';
  facho.setAttribute('aria-hidden', 'true');
  facho.append(document.createElement('i'));
  botao.prepend(facho);
}
garantirFacho($('store-button'));
/*
 * ---- Sem foco, o enfeite pausa ----
 *
 * O jogo aberto num segundo monitor, ou atrás de outro programa, continua
 * visível e caçando — e as animações de enfeite continuavam repintando para
 * ninguém. Sem foco elas param no quadro em que estavam; o mapa segue (ver
 * "PAUSA QUANDO NINGUÉM ESTÁ OLHANDO", no style.css).
 */
const marcarFoco = () => document.body.classList.toggle('sem-foco', !document.hasFocus());
window.addEventListener('blur', marcarFoco);
window.addEventListener('focus', marcarFoco);
marcarFoco();
/*
 * E o contador do canto, se alguém o deixou aceso. Ele fica fora do
 * `aplicarNoBody` de propósito: aquele é um par de marcas para o CSS ler, este
 * cria um elemento e um relógio. Ver `medidor.mjs`.
 */
/*
 * `(m) => send(m)` e não `send` direto: aqui em cima o `const send` ainda não
 * existe — ele é declarado umas linhas abaixo, e um `const` lido antes da
 * declaração ESTOURA (zona morta temporal). Este arquivo é um módulo, então o
 * estouro derruba o resto dele: o jogo inteiro ficava na tela de carregamento.
 *
 * A seta adia a leitura para a hora da chamada, quando ele já existe. Foi assim
 * que quebrou, e foi o `test-filtro-tela` — que abre o jogo num navegador de
 * verdade — que pegou; nenhum teste de DOM de mentira pegaria.
 */
atualizarMedidor((mensagem) => send(mensagem));
mapView = new MapView($('map'));
// O minimapa por cima do mapa, no canto superior direito da área de jogo (ver `minimapa.mjs`).
initMinimapa(mapView, { ehTelefone });

/*
 * A cortina sai com uma dissolvida, e só depois é removida do documento: um
 * `hidden` seco cortaria a transição no meio.
 */
const telaDeBoot = $('boot');
if (telaDeBoot) {
  telaDeBoot.classList.add('saindo');
  setTimeout(() => telaDeBoot.remove(), 400);
}
// Gancho de inspeção para as ferramentas de screenshot.
window.__map = mapView;

// ---------- conexão ----------

/*
 * ---- Treinando, o client nem pede para andar ----
 *
 * No pátio (treino online) e no Exercise o personagem fica no posto que o
 * SERVIDOR escolheu, a 1 SQM do boneco, e o servidor recusa todo movimento
 * (`Treinos.emTreino`). Isto aqui é só o espelho visual: teclado, WASD, setas,
 * clique, "Ir até lá" e o analógico do celular passam todos por `send`, então
 * um filtro só cobre todos. O "soltei a tecla" (`dx:0, dy:0`) passa.
 */
const COMANDOS_DE_ANDAR = new Set(['walk', 'walkTo', 'huntWalk', 'huntWalkTo', 'huntEscada']);
const treinandoAgora = () => state?.hunt?.huntId === 'treino' || !!state?.character?.exercicio?.treinando;
const send = (message) => {
  if (COMANDOS_DE_ANDAR.has(message?.t) && (message.dx || message.dy || message.x != null) && treinandoAgora()) return false;
  return socket?.readyState === 1 && socket.send(JSON.stringify(message));
};
// Gancho de inspeção para as ferramentas de screenshot.
window.__send = send;

/*
 * O balão do jogo é ligado ANTES do portão.
 *
 * Ele converte todo `title` da página no balão da moldura do jogo — mas era
 * ligado só ao entrar no personagem, então a tela de escolher e a de criar
 * ficavam com a caixinha amarela do sistema: fonte de sistema, sem cor, e
 * aparecendo dois segundos depois. São as duas primeiras telas que um jogador
 * novo vê.
 *
 * Os acessores ainda devolvem `null` aqui (não há personagem antes de entrar),
 * e não faz mal: no portão os balões são de texto puro. A chamada de dentro do
 * jogo continua existindo e é ela que passa o personagem e o catálogo.
 */
initTooltip(() => state.items, () => state.character, () => state.catalog);
// O balão da gema mostra o que a skill dela faz: lê o catálogo de ações de agora.
usarCatalogoDeAcoes(() => state.actionCatalog);
// A comparação de itens do balão pede ao servidor (ver `comparacaoComOEquipado`).
ligarComparacao(send);

const gate = createGate({ send, onPlay: () => buildWindows() });

/*
 * O aviso de conexão caída.
 *
 * Sem ele, cair a conexão era uma tela que simplesmente parava: o personagem
 * congelado, os números sem mexer e nenhuma explicação. A faixa diz o que
 * aconteceu, conta as tentativas e mostra uma barra andando — que é
 * indeterminada de propósito, porque ninguém sabe quanto falta.
 *
 * Ela não cobre a tela. O jogo continua rodando no servidor enquanto isso, e o
 * que o jogador quer ver é justamente que o personagem ainda está lá.
 */
let tentativas = 0;
let ultimoCarimbo = 0;

function avisoDeConexao(caiu) {
  const faixa = document.getElementById('reconectando');
  if (!faixa) return;
  faixa.hidden = !caiu;
  if (!caiu) return;
  const nota = document.getElementById('reconectando-nota');
  if (nota) {
    nota.textContent = tentativas <= 1 ? 'tentando reconectar...' : `tentando reconectar (tentativa ${tentativas})...`;
  }
}

function connect() {
  /*
   * `wss://` quando a página é https, `ws://` quando não é.
   *
   * Estava cravado em `ws://`, e isso quebra o jogo inteiro no dia em que ele
   * ganha um domínio com certificado: o navegador recusa WebSocket inseguro
   * dentro de página segura (conteúdo misto), e a tela fica em "conexão
   * perdida" sem dizer por quê. Em `http://localhost` nada muda.
   */
  const protocolo = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocolo}//${location.host}/ws`);
  socket.addEventListener('open', () => {
    if (tentativas) logSystem('conexão restabelecida.');
    tentativas = 0;
    avisoDeConexao(false);
    /*
     * Reconectou: se havia faixa de server save, o servidor ja' voltou — e o
     * aviso de um reinicio que ja' aconteceu so' assusta. Se a contagem ainda
     * estiver correndo (foi queda de rede, e nao o reinicio), o proprio
     * servidor manda a faixa de volta no `hello`.
     */
    esconderServerSave();
    /*
     * O ritmo desta conexão, dito na abertura.
     *
     * O servidor guarda a marca no SOCKET, e um socket novo — uma reconexão, um
     * F5 — nasce sem ela. Sem esta linha a chave do ritmo valeria até a primeira
     * queda de rede, e voltaria sozinha ao normal sem ninguém perceber.
     */
    /*
     * "Sei juntar um personagem parcial" — e é o `applyState` que sabe.
     *
     * O servidor só manda o delta para quem pede: as ferramentas locais (o
     * smoke, as sondas, os testes vivos) leem `message.character` direto do
     * quadro e continuam recebendo o personagem inteiro. Ver `pushState`.
     */
    // `sessao`: o analisador também chega picado. Ver `sessaoDelta`, abaixo.
    // `fundo`: e os campos que mudaram por dentro chegam como remendo. Ver `aplicarRemendo`.
    socket.send(JSON.stringify({ t: 'delta', on: true, sessao: true, fundo: true }));
    /*
     * "Já guardo o catálogo e os itens": depois da primeira vez, o servidor
     * deixa de mandá-los de novo nesta conexão (eram 4,8 MB em cada `account`
     * e em cada `welcome`). Ver `enviarComCatalogo` e o `welcome`, abaixo.
     */
    socket.send(JSON.stringify({ t: 'jaTenhoCatalogo' }));
    // Se esta aba já nasce escondida, o servidor precisa saber desde já.
    socket.send(JSON.stringify({ t: 'oculta', on: document.hidden === true }));
    avisarORitmo((mensagem) => socket.send(JSON.stringify(mensagem)));
    /*
     * E o relógio do ping recomeça: um socket novo é outro caminho até o
     * servidor, e o ping que ficou pendurado na conexão que caiu nunca volta.
     * Sem esta linha o número congelaria no último valor de antes da queda —
     * justo quando ele é mais útil.
     */
    atualizarMedidor(send);
  });
  socket.addEventListener('message', (event) => handle(JSON.parse(event.data)));
  socket.addEventListener('close', () => {
    if (!tentativas) logSystem('conexão perdida — reconectando...');
    tentativas += 1;
    avisoDeConexao(true);
    // Espera crescente até cinco segundos: religar quatro vezes por segundo
    // contra um servidor que está reiniciando não adianta nada e enche o log.
    setTimeout(connect, Math.min(5000, 1000 + tentativas * 500));
  });
}

/**
 * A faixa de "em obras", ligada pelo que o servidor mandou.
 *
 * Chamada a cada catálogo que chega — o `hello` e o `welcome` trazem o mesmo
 * texto, e escrever duas vezes o mesmo é mais barato do que descobrir depois
 * que um dos dois caminhos não passava por aqui.
 */
/*
 * O cartaz de beta foi minimizado NESTA sessao?
 *
 * Em memoria, e nao no `localStorage`, de proposito — ver o bloco do cartaz
 * dentro da funcao. E declarado ACIMA de quem o le: um `let` usado antes da
 * linha que o declara e' erro em tempo de execucao, do tipo que so' aparece
 * quando o catalogo chega.
 */
let cartazMinimizado = false;

function pintarAvisoDeObra() {
  const faixa = $('aviso-dev');
  if (!faixa) return;
  const texto = state.catalog?.avisoDeDesenvolvimento ?? '';
  $('aviso-dev-texto').textContent = texto;
  faixa.hidden = !texto;
  // A classe empurra a barra de cima e o HUD: ver `--altura-do-aviso` no CSS.
  document.body.classList.toggle('com-aviso', !!texto);

  /*
   * ---- O cartaz de beta ----
   *
   * A faixa fina acima e' o lembrete discreto; o cartaz e' o aviso, grande o
   * bastante para ninguem entrar no jogo sem ver.
   *
   * Ele volta a CADA entrada, e minimiza-lo vale so' para aquela sessao. E' o
   * contrario do que costuma ser certo num aviso — normalmente quem ja' leu
   * nao deve reler —, e aqui e' de proposito: o jogo esta em beta e cada
   * partida pode topar com um bug novo. Enquanto isso for verdade, o aviso e'
   * informacao, e nao estorvo. No dia em que sair do beta, quem apaga o aviso
   * e' o `avisoDeDesenvolvimento` do config: vazio, some o cartaz e a faixa.
   *
   * O `minimizado` fica em memoria, e nao no `localStorage`: e' isso que faz
   * ele voltar na proxima entrada sem precisar de nenhuma data de validade.
   */
  /*
   * ---- No CELULAR ele nasce MINIMIZADO ----
   *
   * "ficou tudo amontoado."
   *
   * O cartaz tem 117 pixels de altura. Numa tela de telefone de 915, somado à
   * barra de cima, à faixa fina, à faixa de novidades e ao card do personagem,
   * mais da metade da tela ia embora antes de o mapa começar — e o jogo é o
   * mapa.
   *
   * Minimizado ele não some: vira a faixa fina do topo, que continua dizendo
   * "em desenvolvimento, pode haver bugs" e continua com o botão REPORTAR do
   * lado. Ou seja, o aviso e o caminho do report ficam inteiros; o que sai é o
   * tamanho. Num telefone é a mesma informação por um oitavo do espaço.
   *
   * Na tela de mesa nada muda — lá há altura de sobra, e o cartaz grande é o
   * que faz ninguém entrar no jogo sem ver que ele está em beta.
   */
  const cartaz = $('cartaz-beta');
  if (!cartaz) return;
  const noCelular = getComputedStyle(document.documentElement).getPropertyValue('--e-celular').trim() === '1';
  cartaz.hidden = !texto || cartazMinimizado || noCelular;
}

/*
 * ---- A faixa de novidades ----
 *
 * O que um jogador escreveu: "as vezes o jogo atualiza e aquela tela some mt
 * rapido dai nao da pra gente saaber o que mudou". Ele tem razão — a caixa de
 * "versão nova" existe para EMPURRAR o recarregamento, e quem clica em
 * "Atualizar agora" (que é o que ela pede) some com a lista antes de ler.
 *
 * Então a lista ganhou vida própria: uma faixa no alto que fica lá até a
 * pessoa abrir e marcar como lido, e só volta quando a `versao` de
 * `novidades.mjs` mudar.
 *
 * Ela NÃO é um ícone na barra de cima, e isso foi pedido: um ícone a mais
 * entre vinte é um ícone que ninguém nota, e este aviso quer ser visto uma vez.
 */
function pintarNovidades() {
  const faixa = $('faixa-novidades');
  if (!faixa) return;
  const novidades = novidadesDaVez;
  const versao = novidades?.versao;
  const lida = state.character?.settings?.novidadesLidas ?? null;
  /*
   * Sem `versao` a faixa nunca aparece.
   *
   * É o lado seguro do erro: uma lista sem carimbo não tem como ser marcada
   * como lida, e a faixa ficaria na tela para sempre.
   */
  const mostrar = !!versao && !!novidades?.itens?.length && lida !== versao;
  faixa.hidden = !mostrar;
  document.body.classList.toggle('com-novidades', mostrar);
  if (!mostrar) return;
  const resumo = $('faixa-novidades-resumo');
  if (resumo) {
    const quantos = novidades.itens.length;
    resumo.textContent = `${quantos} ${quantos === 1 ? 'mudança' : 'mudanças'} no jogo${novidades.em ? ` · ${novidades.em}` : ''}`;
  }
}

/*
 * A lista inteira, e o botão que a apaga.
 *
 * Fechar no X NÃO marca como lido — foi o pedido, e ele está certo: fechar é o
 * gesto de quem vai ler depois, e apagar o aviso de quem não leu é exatamente o
 * defeito que o jogador reportou.
 */
function abrirNovidades() {
  const novidades = novidadesDaVez;
  if (!novidades?.itens?.length) return;

  openModal(novidades.titulo ?? 'O que mudou nesta versão', (body) => {
    /*
     * ---- OS BOTÕES VÊM PRIMEIRO, e ficam colados no topo ----
     *
     * Report do dono: "o botão de marcar como lido deveria vir no começo, pq
     * tem que rolar a página inteira até o fim de todas as atualizações para
     * chegar no botão".
     *
     * Ele estava no pé — e o pé desta janela fica depois da lista nova E de
     * trinta e cinco publicações anteriores. Dizer "já li" custava rolar tudo o
     * que a pessoa acabou de decidir não ler.
     *
     * `sticky` e não só "no começo": assim ele continua à mão mesmo para quem
     * desceu para ler o histórico, e a janela deixa de ter um lugar certo para
     * onde voltar.
     */
    const acoes = el('div', 'novidades-acoes');
    const depois = el('button', 'ghost', 'Ler depois');
    depois.onclick = () => closeModal();

    const lido = el('button', 'primary', 'Marcar como lido');
    lido.onclick = () => {
      /*
       * O carimbo vai para `settings` do personagem, no servidor: quem leu num
       * computador não relê no outro, e limpar o navegador não traz de volta a
       * faixa de uma versão antiga.
       *
       * A faixa some AQUI, sem esperar a volta do servidor: o `pushState` leva
       * um instante e o jogador acabou de dizer que leu. Se a gravação falhar,
       * a faixa volta no próximo `welcome` — que é o comportamento certo para
       * uma falha de gravação.
       *
       * `novidades.versao` já vem cortada no tamanho que o servidor grava (ver
       * `carimbo`, em novidades.mjs). Enquanto não vinha, o servidor guardava
       * uma versão pela metade, ela nunca mais batia com esta, e a faixa
       * voltava a cada F5 para todo mundo — foi o report do dono.
       */
      if (state.character) (state.character.settings ??= {}).novidadesLidas = novidades.versao;
      send({ t: 'settings', novidadesLidas: novidades.versao });
      pintarNovidades();
      closeModal();
    };
    acoes.append(depois, lido);
    body.append(acoes);

    if (novidades.em) body.append(el('p', 'novidades-quando', `Publicado em ${novidades.em}.`));

    const lista = document.createElement('ul');
    lista.className = 'novidades-lista';
    for (const item of novidades.itens) lista.append(el('li', null, item));
    body.append(lista);

    /*
     * ---- E o que mudou nas publicações ANTERIORES ----
     *
     * Antes a lista era reescrita por cima a cada publicação, e o que mudou no
     * mês passado sumia do jogo: quem voltou depois de umas semanas perdia
     * tudo o que aconteceu enquanto esteve fora.
     *
     * Elas entram abaixo da lista nova, em `<details>` fechado. Fechado porque
     * a pergunta que traz a pessoa aqui é "o que mudou AGORA" — o histórico não
     * pode empurrar a resposta para fora da tela. Mas quem quiser é um clique.
     *
     * `<details>` e não um botão nosso: ele já abre e fecha sozinho, já é
     * alcançável pelo teclado e já é lido por leitor de tela. Escrever isso à
     * mão seria três vezes mais código para chegar no mesmo lugar.
     */
    for (const antiga of novidades.anteriores ?? []) {
      if (!antiga?.itens?.length) continue;
      const bloco = document.createElement('details');
      bloco.className = 'novidades-antigas';
      const titulo = document.createElement('summary');
      titulo.textContent = `O que mudou em ${antiga.em ?? 'uma versão anterior'} (${antiga.itens.length})`;
      bloco.append(titulo);
      const antigos = document.createElement('ul');
      antigos.className = 'novidades-lista';
      for (const item of antiga.itens) antigos.append(el('li', null, item));
      bloco.append(antigos);
      body.append(bloco);
    }

  });
}

// A faixa vive dentro de `#game`; a página de entrada não a tem.
const faixaDeNovidades = $('faixa-novidades');
if (faixaDeNovidades) faixaDeNovidades.onclick = abrirNovidades;

/*
 * O `?.` guarda contra a tela de login, que carrega o mesmo `main.mjs` sem o
 * bloco do jogo montado.
 */
$('cartaz-beta-fechar')?.addEventListener('click', () => {
  cartazMinimizado = true;
  const cartaz = $('cartaz-beta');
  if (cartaz) cartaz.hidden = true;
});

/*
 * Os dois botões de reportar levam à mesma janela.
 *
 * O do cartaz abre já marcado como bug (é o que o cartaz fala); o da faixa
 * abre neutro, porque a faixa fica na tela o tempo todo e serve tanto para
 * "quebrou" quanto para "podia ser melhor".
 */
/*
 * Parar o treino pela faixa.
 *
 * O mesmo comando do botão da aba de Aventuras — e é de propósito que sejam o
 * mesmo: dois caminhos que param o treino de jeitos diferentes seriam dois
 * resumos diferentes, e o resumo é o que a pessoa foi ali buscar.
 */
$('treino-faixa-parar')?.addEventListener('click', () => send({ t: 'training', action: 'stop' }));

/*
 * O botão da barra da fase: alterna "Ficar na fase" (loop) e "Avançar sozinho"
 * (com a fase completa, vai para a próxima — na hora, se ela já está completa). A barra se redesenha com a resposta do
 * servidor; o texto troca na hora para o toque não parecer perdido.
 */
$('fase-modo')?.addEventListener('click', (evento) => {
  const botao = evento.currentTarget;
  const novo = botao.dataset.modo === 'seguir' ? 'repetir' : 'seguir';
  pintarBotaoDaFase(botao, novo);
  send({ t: 'aoCompletarFase', value: novo });
});


/*
 * ---- A faixa sai da TELA, e a diária vai para a barra de cima ----
 *
 * "tira de aparecer aquelas 'recompensa pra pegar' e 'recompensa diária' na
 *  tela, e faz aparecer o ícone de recompensa diária ou recompensa pra pegar
 *  quando tiver, lá do lado de Social, à direita, chamativo — mas só quando
 *  tiver pra pegar. Quando não tiver pra pegar no dia, ele nem aparece ali."
 *
 * A faixa ficava no meio de baixo, logo acima da barra de ações, e cobria o
 * chão exatamente onde o jogador clica para andar. Ela existia por um motivo
 * certo — ninguém volta para procurar um presente que nunca viu — e resolvia
 * isso do jeito mais caro possível: ocupando o meio da tela até alguém pegar ou
 * minimizar. Ter de MINIMIZAR um aviso já é a prova de que ele está no lugar
 * errado.
 *
 * Na barra de cima o aviso continua sendo a primeira coisa que se vê, com o
 * facho dourado dos outros pendentes, e não tapa nada. E some sozinho: o botão
 * só existe enquanto há o que pegar, então não há o que minimizar. Por isso o
 * "—" e as duas lembranças de dispensa foram embora com a faixa.
 *
 * Os dois continuam em Tarefas ("mas deixe os ícones lá em Tarefas também ok,
 * não mexe lá"), e só a diária ganha o botão da barra — ver `AVISOS_DA_BARRA`,
 * que explica por quê.
 */
function pintarPresente() {
  /*
   * O baú da diária acende com o dia para pegar E com uma ESCOLHA pendente — a
   * escolha é um prêmio que já saiu e ainda não foi recebido, e é o caso em que
   * se esquece mais fácil: para o jogador o dia já apareceu resgatado.
   *
   * A recompensa de level não entra aqui: ela não vence, e o dono a quis só em
   * Tarefas. Ver `AVISOS_DA_BARRA`.
   */
  const diario = state.character?.diario;
  const mostrar = !!diario?.podePegar || !!diario?.pendente;

  let mudou = false;
  const botao = document.querySelector('#tools [data-tool="aviso-diario"]');
  if (botao && botao.hidden === mostrar) {
    botao.hidden = !mostrar;
    mudou = true;
  }
  /*
   * A fileira é centrada no boneco por uma MEDIDA (ver `centrarNoBoneco`), e um
   * botão que aparece muda a largura dela. Sem esta linha, pegar a diária
   * deixaria a barra torta até o próximo redimensionamento da janela.
   */
  if (mudou) caberNaBarra();
}

$('cartaz-beta-report')?.addEventListener('click', () => openReport('bug'));
$('aviso-dev-report')?.addEventListener('click', () => openReport('bug'));

function handle(message) {
  if (gate.handle(message)) {
    if (message.catalog) {
      state.catalog = message.catalog;
      pintarAvisoDeObra();
    }
    // Sessão assumida por outra janela: o que era deste personagem sai da tela
    // junto com ele, senão a lista de personagens fica com o inventário e o
    // mapa do anterior desenhados por baixo.
    if (message.t === 'sessionTaken') resetCharacterState();
    return;
  }

  switch (message.t) {
    // O eco do contador do canto. Não mexe em estado nenhum: é uma régua.
    case 'pong':
      pongChegou(message.at);
      break;
    case 'hello':
      // A versão do jogo já na conexão: depois de um deploy, a aba sabe na hora.
      conferirVersao(message.versao);
      state.catalog = message.catalog;
      pintarAvisoDeObra();
      gate.start(state.catalog);
      break;
    case 'released':
      // Soltou o personagem: limpa tudo que era dele antes de escolher outro.
      resetCharacterState();
      /*
       * E MOSTRA a lista. Quando quem pediu foi o botão de trocar de
       * personagem, `switchCharacter` já trocou a tela e isto é inofensivo.
       * Quando quem soltou foi o SERVIDOR — o treino offline, que tira o
       * personagem do jogo ao confirmar —, esta linha é a única que troca: sem
       * ela o jogador confirmava, via o aviso "treinando magic offline" e
       * continuava olhando a tela do jogo com o personagem já fora dela.
       */
      closeModal();
      gate.mostrarLista();
      /*
       * O motivo, quando há um. Soltar pelo botão de trocar de personagem é
       * óbvio e não precisa de aviso; soltar porque o treino offline começou é
       * o contrário — e sem uma linha dizendo por quê isso lê como se o jogo
       * tivesse deslogado sozinho.
       */
      if (message.notice) notice(message.notice);
      break;
    case 'welcome':
      // Antes de qualquer coisa: o código desta aba ainda é o que o servidor
      // está servindo? Ver `conferirVersao`.
      conferirVersao(message.versao, message.novidades);
      // Máquina que não dá conta do enfeite: o jogo se deixa leve sozinho, uma
      // vez, e diz onde desfazer. Ver `vigiarLentidao`, em graficos.mjs.
      if (!vigiouLentidao) {
        vigiouLentidao = true;
        vigiarLentidao((fps) =>
          notice(`O jogo estava a ${fps} quadros por segundo nesta máquina, então tiramos os brilhos e animações de enfeite e limitamos o mapa a 30 quadros. Para trazer de volta: Opções → Gráficos.`)
        );
      }
      // Outro personagem que o de antes: o chat começa limpo. Ver `chatDoPersonagem`.
      chatDoPersonagem(message.character?.name);
      resetCharacterState();
      // As magias do editor da barra são da classe do personagem que saiu: pede as do novo.
      state.actionCatalog = null;
      reiniciarCatalogoDeAcoes();
      // Sem catálogo ou itens no quadro, valem os que já chegaram nesta conexão.
      if (message.catalog) state.catalog = message.catalog;
      pintarAvisoDeObra();
      // As cores do nome por raridade do mob (ver `definirCoresDeRaridade`, map.mjs).
      if (message.mobRaridades) definirCoresDeRaridade(message.mobRaridades);
      if (message.mobModificadores) textoDosModificadores = message.mobModificadores;
      if (message.items) {
        state.items = message.items;
        emprestarDoCatalogo(message.items);
      }
      state.ranking = message.ranking ?? [];
      state.online = message.online;
      gate.enterGame();
      applyState(message);
      // O mapa, a folha de itens e o sprite do personagem ainda estão vindo:
      // ver `entrarNoPersonagem`.
      entrarNoPersonagem(message);
      if (message.mail?.gold) notice(`Você recebeu ${message.mail.gold.toLocaleString('pt-BR')} gold do mercado.`);
      /*
       * ---- E o que chegou de ITEM, com o endereço ----
       *
       * O correio avisava do ouro e das coins e ficava calado sobre as peças —
       * e a peça é justamente a que pode não estar na mochila: sem espaço, ela
       * espera na caixa de Chegadas do depósito (ver `entregarChegada`, no
       * servidor). Sem esta linha, quem vende no mercado e volta no dia
       * seguinte não tem como saber que a peça chegou, nem onde ela está.
       */
      if (message.mail?.items?.length) {
        const lista = message.mail.items
          .map((peca) => `${peca.count > 1 ? `${peca.count}x ` : ''}${peca.name ?? 'item'}`)
          .join(', ');
        const guardadas = message.mail.items.filter((peca) => peca.onde === 'deposito');
        const onde = guardadas.length
          ? ` ${guardadas.length === message.mail.items.length ? 'Está' : 'Parte está'} na caixa ${guardadas[0].caixa}, no depósito.`
          : '';
        notice(`Chegou pelo correio: ${lista}.${onde}`);
      }
      if (message.mail?.coins) {
        const quem = message.mail.from?.length ? ` de ${[...new Set(message.mail.from)].join(', ')}` : '';
        notice(`Você recebeu ${message.mail.coins.toLocaleString('pt-BR')} Draevor Coins${quem}.`);
      }
      /*
       * A ordem importa: o pendente é o que explica por que o personagem está
       * no templo, e é o único que o jogador ainda não viu de jeito nenhum.
       */
      /*
       * Só existe UMA caixa de modal: abrir o relatório de ausência logo depois
       * do pendente o apagava antes de alguém ler. Report do Hotfriend — o char
       * morria caçando offline, a janela da morte sumia debaixo da de stamina e
       * ele achou que o personagem estava bugado. As outras esperam o OK.
       */
      const depoisDoPendente = () => {
        // O que o pátio de treino rendeu enquanto a aba estava fechada.
        // Também abre quando só houve GASTO: uma arma que queimou cargas sem
        // fechar nada de perícia ainda tem o que contar.
        if (message.treinoPendente?.ganho?.length || message.treinoPendente?.gastos?.length)
          mostrarGanhoDoTreino(message.treinoPendente.ganho, message.treinoPendente);
        else if (message.offline) showOfflineReport(message.offline);
        else if (message.andamento && message.morte) mostrarMorte({ ...message.morte, report: message.andamento, offline: true });
        else if (message.andamento) showAndamento(message.andamento);
      };
      if (message.pendente) {
        showPendente(message.pendente, depoisDoPendente);
        if (message.pendente.motivo) logSystem(message.pendente.motivo);
      } else depoisDoPendente();
      // As respostas guardadas vêm depois das outras janelas de boas-vindas: o
      // extrato da caçada é o que a pessoa entrou para ver.
      if (message.respostasDeReport?.length) avisarRespostaDeReport(message.respostasDeReport);
      break;
    case 'state':
      applyState(message);
      /*
       * Carimbo de "este PERSONAGEM estava sendo visto agora".
       *
       * Escrito no máximo a cada dois segundos: são quatro estados por segundo,
       * e o localStorage é síncrono. Por personagem e não pela máquina — ver
       * `ultimoVisto`, em auth.mjs: é o que faz o resumo da ausência aparecer
       * ao voltar de uma troca de personagem.
       */
      if (Date.now() - ultimoCarimbo > 2000 && state.character?.name) {
        ultimoCarimbo = Date.now();
        marcarVisto(state.character.name, ultimoCarimbo);
      }
      break;
    // A ficha de alguém, pedida ao clicar no nome dele no chat.
    case 'fichaDoBicho':
      chegouFichaDoBicho(message);
      break;
    case 'perfil':
      mostrarPerfil(message.perfil);
      break;
    case 'runReport':
      showRunReport(message.report, message.motivo, message.titulo);
      break;
    /*
     * A resposta do dono a um report que ESTE jogador escreveu.
     *
     * Chega por dois caminhos e a tela é a mesma: pelo socket, quando ele está
     * com o jogo aberto na hora em que o painel responde, e dentro do `welcome`,
     * quando estava fora. Ver `entregarResposta`, no servidor.
     */
    /*
     * O prêmio não coube na mochila e foi para o depósito.
     *
     * Uma janela e não um aviso na barra: o aviso some em segundos, e quem
     * acabou de pegar um set de nove peças vai abrir a mochila para vê-las. Não
     * achar e não saber por quê é o caminho mais curto para um report de "sumiu
     * meu prêmio".
     */
    case 'marcoNoDeposito':
      openModal(`Recompensa do level ${message.level}`, (body) => {
        body.append(
          el('p', 'gate-note', 'Sua mochila não tinha espaço ou capacidade para tudo.'),
          el('p', 'sheet-nota', 'O que não coube foi para o DEPÓSITO, na primeira caixa com lugar. Nada se perdeu.')
        );
        const lista = (itens, titulo) => {
          if (!itens?.length) return;
          body.append(el('b', 'deposito-titulo', titulo));
          const grade = el('div', 'marco-itens');
          for (const item of itens) {
            const caixa = el('div', 'marco-item');
            const arte = itemCanvas(item.itemId, 32);
            if (arte) caixa.append(arte);
            /*
             * O texto vai num bloco próprio, e não solto ao lado do desenho.
             *
             * Solto, ele era um item do mesmo flex do ícone e dividia a largura
             * com ele: num cartão estreito sobravam uns quarenta pixels, e
             * "Durable Exercise Rod" quebrava numa letra por linha. O bloco
             * recebe a largura que sobra INTEIRA e quebra por palavra.
             */
            const texto = el('div', 'marco-texto');
            texto.append(el('em', null, item.count > 1 ? `${item.name} x${item.count}` : item.name));
            caixa.append(texto);
            grade.append(caixa);
          }
          body.append(grade);
        };
        lista(message.mochila, 'Foi para a mochila');
        lista(message.deposito, 'Foi para o depósito');
        const acoes = el('div', 'confirm-actions');
        const fechar = el('button', 'primary', 'Entendi');
        fechar.onclick = () => closeModal();
        acoes.append(fechar);
        body.append(acoes);
      });
      break;
    /*
     * A compra que não coube na mochila.
     *
     * Mesma janela do marco, e pelo mesmo motivo: quem paga e não acha o que
     * comprou conclui que o item se perdeu. Aqui só o lado do depósito importa —
     * o que coube na mochila a pessoa já vê lá.
     */
    case 'compraNoDeposito':
      openModal('A compra foi para o depósito', (body) => {
        body.append(
          el('p', 'gate-note', `Sua mochila não tinha espaço ou capacidade para ${message.nome}.`),
          el('p', 'sheet-nota', 'Foi para o DEPÓSITO, na primeira caixa com lugar. Nada se perdeu.')
        );
        const grade = el('div', 'marco-itens');
        for (const item of message.deposito ?? []) {
          const caixa = el('div', 'marco-item');
          const arte = itemCanvas(item.itemId, 32);
          if (arte) caixa.append(arte);
          /*
             * Nome em cima, caixa embaixo — os dois num bloco só.
             *
             * Eram dois `em` soltos no flex do cartão, lado a lado com o
             * desenho: os três disputavam a mesma largura e o resultado era
             * "Cai xa I" escrito na vertical. Empilhados, cada um tem a linha
             * inteira.
             */
          const texto = el('div', 'marco-texto');
          texto.append(el('em', null, item.count > 1 ? `${item.name} x${item.count}` : item.name));
          if (item.caixa) texto.append(el('em', 'marco-caixa', item.caixa));
          caixa.append(texto);
          grade.append(caixa);
        }
        body.append(grade);
        const acoes = el('div', 'confirm-actions');
        const fechar = el('button', 'primary', 'Entendi');
        fechar.onclick = () => closeModal();
        acoes.append(fechar);
        body.append(acoes);
      });
      break;
    case 'reportResposta':
      avisarRespostaDeReport([
        {
          texto: message.texto,
          em: message.em,
          autor: message.autor,
          relato: message.relato,
          tipo: message.tipo,
          relatoEm: message.relatoEm,
        },
      ]);
      break;
    case 'treinoReport':
      mostrarGanhoDoTreino(message.ganho, {
        segundos: message.segundos ?? null,
        gastos: message.gastos ?? null,
        exercise: !!message.exercise,
      });
      break;
    case 'online':
      state.online = message.online;
      $('online-count').textContent = message.online;
      break;
    case 'chat':
      /*
       * `aviso` é a linha que o SERVIDOR escreve dentro de uma aba de conversa
       * — hoje só o "fulano abriu tal saco e ganhou tal peça". Ela não tem
       * autor nem level, então não passa pelo `logChat`, que desenharia um
       * "undefined [undefined]:" na frente.
       */
      if (message.aviso) logAviso(message.text, message.channel, message.para ?? null);
      // `eu` é o que deixa a aba do privado saber se a linha saiu ou chegou.
      else logChat({ ...message, eu: state.character?.name });
      break;
    // Épico para cima caiu para alguém: a linha no Global e a faixa no alto da tela (ver anuncios.mjs no servidor).
    case 'dropRaro':
      logDropRaro(message);
      anunciarDrop(message);
      break;
    // A bolinha de online das abas de privado. Ver `receberPresenca`.
    case 'presenca':
      receberPresenca(message.nomes);
      break;
    // O áudio do chat que alguém apertou para ouvir. Ver `receberAudio`.
    case 'audio':
      receberAudio(message);
      break;
    /*
     * Eventos de mapa fora do envio de estado.
     *
     * O caminho normal é o `events` que vem dentro do `state`, quatro vezes por
     * segundo. Este é para o que acontece ENTRE dois envios e não pode esperar:
     * o balão da fala do canal Local, que tem de sair no instante em que a
     * pessoa apertou enter — 250ms de atraso já se lê como travamento.
     *
     * Só o desenho: a fila do combate (`feedEvents`) não recebe nada daqui,
     * porque nada disto é golpe.
     */
    case 'events':
      if (!abaEscondida) mapView.addEvents(message.events ?? []);
      break;
    case 'ranking':
      state.ranking = message.ranking;
      panelCtx.redraw?.();
      break;
    case 'friends':
      state.friends = message;
      if (message.notice) notice(message.notice);
      // O contador no ícone da barra de cima muda na hora: aceitar um pedido
      // tem que apagar o "+1" sem esperar o próximo desenho geral.
      marcarPedidosDeAmizade();
      panelCtx.redraw?.();
      break;
    case 'partyInvite':
      mostrarConvite(message);
      break;
    /*
     * ---- O PEDIDO de entrar, que é o convite ao contrário ----
     *
     * Quem está na cidade apertou "Entrar na hunt" no card da party. O cartão
     * chega para quem ABRIU a caçada, e a decisão é dele — ver `party pedir`,
     * em index.mjs.
     */
    case 'pedidoDeEntrada':
      mostrarPedidoDeEntrada(message);
      break;
    /*
     * ---- Convite de PARTY, que não é convite de caçada ----
     *
     * O de cima leva para dentro de uma hunt agora; este monta o time. A caixa
     * é a mesma de sempre, e o texto diz a diferença — senão a pessoa aceita
     * achando que vai ser teleportada para uma caverna.
     */
    case 'grupoConvite':
      mostrarConviteDeParty(message);
      break;
    case 'shop':
      state.shop = message;
      panelCtx.redraw?.();
      break;
    case 'store':
      state.store = message.store;
      panelCtx.redraw?.();
      panelCtx.recarregarHistoricoDaLoja?.();
      /* O `+` da barra pediu o catálogo para poder abrir. Ver `pedirDraevorCoins`. */
      if (esperandoAsCoins) {
        esperandoAsCoins = false;
        abrirObterCoins();
      }
      break;
    /* O histórico da loja chega por pedido, e só a janela dele o desenha. */
    case 'historicoDaLoja':
      panelCtx.aoHistoricoDaLoja?.(message);
      break;
    // A resposta do pedido de troca de Tibia Coins / Rubini Coins. Ver `passoTroca`.
    case 'trocaTc':
      if (panelCtx.aoTrocaTc) panelCtx.aoTrocaTc(message);
      else if (!message.ok) notice(message.reason);
      break;
    /*
     * A Loja de Boss Token. Moeda à parte, vitrine à parte — e o mesmo desenho
     * de sempre: o servidor manda a lista, a tela redesenha.
     */
    case 'bossToken':
      state.bossToken = message.loja;
      panelCtx.redraw?.();
      break;
    /* A Loja de Task Token, a irmã dela: outra moeda, mesmo desenho. */
    case 'taskToken':
      state.taskToken = message.loja;
      panelCtx.redraw?.();
      break;
    /*
     * As tasks de criatura: 309 linhas, pedidas sob demanda em vez de viajarem
     * no estado. Ver o handler `tasksDeBicho`, no index.mjs.
     */
    case 'tasksDeBicho':
      state.tasksDeBicho = message.ficha;
      panelCtx.redraw?.();
      break;
    /*
     * ---- O pagamento abriu ----
     *
     * O servidor criou o pedido na InfinitePay e mandou o link. A aba nova e o
     * caminho certo: o jogo continua vivo por tras (a caçada nao para), e o
     * jogador volta para ela quando terminar de pagar.
     *
     * Quem credita as coins e o webhook, la no servidor — quando ele creditar,
     * o saldo chega sozinho por `state`, com o aviso. Por isso aqui nao se
     * promete nada: diz-se o que esta acontecendo.
     */
    case 'donate': {
      /*
       * ---- Direto para o pagamento, sem parada no meio ----
       *
       * O quadrado do meio confundia mais do que ajudava: ele e' o ENDERECO da
       * pagina (ver o comentario em `mostrarPagamento`), e o jogador apontava o
       * app do banco para ele e ouvia "codigo nao existe". Quem paga no proprio
       * computador nao precisava daquele passo — a InfinitePay ja desenha o QR
       * do Pix de verdade la dentro.
       *
       * O navegador costuma barrar `window.open` que nao nasce de um clique, e
       * este nasce da RESPOSTA do servidor, que chega depois. Quando ele barra,
       * `open` devolve nulo e a janela de sempre aparece — com o botao de ir
       * para o pagamento no lugar de honra. Nunca fica sem saida.
       */
      const abriuSozinho = message.url
        ? window.open(message.url, '_blank', 'noopener')
        : null;
      if (!abriuSozinho) mostrarPagamento(message);
      break;
    }
    case 'charms':
      state.charms = message.view;
      panelCtx.redraw?.();
      break;
    /*
     * O lobby da arena. Ele chega por pedido (ao abrir a janela) e também
     * depois de cada ação — desafiar, cancelar —, para a lista de quem está
     * livre e os convites pendentes não envelhecerem na tela de quem agiu.
     */
    /* O convite de x1, em cima do mapa. Ver `mostrarDesafioDeArena`. */
    case 'arenaDesafio':
      mostrarDesafioDeArena(message);
      break;
    /* O par feito pela fila do lobby: o mesmo cartão, sem aceitar (`mostrarDesafioDeArena(msg, true)`). */
    case 'arenaPar':
      mostrarDesafioDeArena(message, true);
      break;
    /* A tela de fim de luta do x1. Ver `mostrarFimDeArena`. */
    case 'arenaFim':
      mostrarFimDeArena(message.fim);
      break;
    case 'arena':
      state.arena = message.view;
      /*
       * O recado da compra vem DENTRO da vista, e nao num `notice` separado do
       * servidor: a vista ja precisa viajar depois da compra (a moeda mudou, e
       * a lista de "posso comprar" com ela), e um segundo envio so' para o texto
       * seria a mesma resposta partida em duas.
       */
      if (message.view?.aviso) notice(message.view.aviso);
      panelCtx.redraw?.();
      break;
    /*
     * A forja manda o retrato inteiro (peças, preços, ouro) a cada resposta —
     * inclusive DEPOIS de forjar. É o que faz a tela mostrar o tier novo e o
     * ouro novo sem ninguém fechar e reabrir a janela.
     */
    case 'forja':
      state.forja = message;
      panelCtx.redraw?.();
      break;
    /*
     * A aba de AFIXOS da forja: mesmo desenho do `forja` acima — o retrato
     * inteiro a cada resposta, inclusive depois de forjar, para a tela mostrar
     * as estrelas novas e o saldo novo sem ninguém fechar a janela.
     */
    case 'forjaAfixos':
      state.forjaAfixos = message;
      panelCtx.redraw?.();
      break;
    /*
     * E a prévia da transferência, que chega à parte porque ela é uma PERGUNTA
     * (só lê) e o retrato é uma resposta. Guardá-la no mesmo campo faria toda
     * prévia apagar a lista de peças enquanto a pessoa ainda escolhe.
     */
    case 'forjaAfixoPrevia':
      panelCtx.tabs.afixoPrevia = message;
      panelCtx.redraw?.();
      break;
    /*
     * As outras três prévias, cada uma no campo dela.
     *
     * Um campo só para as quatro pareceria economia e seria defeito: a bancada
     * de essências mostra a de RETIRAR e a de INSERIR na mesma tela (as duas
     * abas viraram uma, a pedido do dono), e um campo compartilhado faria a
     * segunda resposta apagar a primeira — a prévia certa piscando e sumindo
     * conforme a ordem em que o servidor respondesse.
     */
    case 'forjaAfixoPreviaRetirar':
      panelCtx.tabs.afixoPreviaRetirar = message;
      panelCtx.redraw?.();
      break;
    case 'forjaAfixoPreviaInserir':
      panelCtx.tabs.afixoPreviaInserir = message;
      panelCtx.redraw?.();
      break;
    case 'forjaAfixoPreviaFundir':
      panelCtx.tabs.afixoPreviaFundir = message;
      panelCtx.redraw?.();
      break;
    /*
     * O catálogo do craft chega separado do retrato da forja, e uma vocação por
     * vez: são 118 receitas com quinze materiais cada, e mandá-las junto faria
     * toda subida de tier arrastar o catálogo inteiro pelo socket.
     */
    case 'craft':
      state.craft = message;
      panelCtx.redraw?.();
      break;
    /*
     * A Máquina de Desmanche, pela mesma porta e pelo mesmo motivo: ela lista
     * 134 peças e só as que a pessoa TEM, então o retrato dela é pedido quando
     * a aba abre — e não junto do retrato da forja.
     */
    case 'desmanche':
      state.desmanche = message;
      panelCtx.redraw?.();
      break;
    /*
     * ---- A resposta de um NPC ----
     *
     * O Banker devolve "abra o banco" e a Zuma devolve a lista dela. Quem decide
     * o que fazer é o TIPO, e não o id: no dia em que houver um segundo
     * banqueiro, nada aqui muda.
     */
    case 'npcFala':
      if (message.tipo === 'banco') {
        notice(message.fala ?? `${message.nome} atende você.`);
        openBank();
        break;
      }
      state.npcLoja = message;
      /*
       * A janela abre no primeiro pedido e só se redesenha nos seguintes — o
       * comprar e o vender mandam a lista de volta, e reabrir o modal a cada
       * compra jogaria a rolagem para o topo.
       */
      if (!abertoPor || abertoPor !== 'npc-loja') {
        abertoPor = 'npc-loja';
        openLojaNpc(message.id);
      } else {
        panelCtx.redraw?.();
      }
      break;
    case 'gemas':
      state.gemas = message.view;
      panelCtx.redraw?.();
      break;
    /* A vista das guildas. Ver `guildas.mjs`. */
    case 'guilda':
      state.guildas = message.view;
      /*
       * O aviso vem DENTRO da vista, como o da loja da arena: o servidor ja
       * precisa reenviar a vista depois de todo gesto (a lista mudou), e um
       * segundo envio so' para o texto seria a mesma resposta partida em duas.
       */
      if (message.view?.aviso) notice(message.view.aviso);
      panelCtx.redraw?.();
      break;
    /* A árvore de passivas única (etapa 7). Ver `passivas.mjs`: ela se redesenha sozinha (canvas). */
    case 'passivas':
      aoReceberPassivas(message);
      if (message.aviso) notice(message.aviso);
      break;
    case 'arvore':
      state.arvore = message.view;
      state.arvoreEmCacada = message.emCacada;
      panelCtx.redraw?.();
      break;
    case 'proficiency':
      if (state.character) state.character.proficiency = message.view;
      if (message.list) state.proficiencyList = message.list;
      panelCtx.redraw?.();
      break;
    /*
     * As cinco respostas do balcão redesenham PRESERVANDO o foco e a rolagem.
     *
     * É a janela em que se digita e se escolhe o tempo todo, e cada escolha
     * pede uma lista nova ao servidor: sem isto, a resposta refazia o miolo e
     * tirava o cursor de dentro do campo de busca no meio da palavra. Ver
     * `redesenharPreservando`.
     */
    case 'market':
      state.market = message.market;
      if (message.notice) notice(message.notice);
      redesenharPreservando();
      break;
    case 'marketDetail':
      state.marketDetail = message.detail;
      redesenharPreservando();
      break;
    // O balcão da tela nova: uma linha por anúncio, já filtrado e paginado.
    case 'marketOffers':
      state.marketOffers = message.dados;
      redesenharPreservando();
      break;
    // O extrato do balcão: o que este personagem comprou e vendeu.
    case 'marketHistorico':
      state.marketHistorico = message.dados;
      redesenharPreservando();
      break;
    // O câmbio de Draevor Coins: as duas colunas de ordens, e as minhas.
    case 'coinMarket':
      state.coinMarket = message.dados;
      if (message.notice) notice(message.notice);
      redesenharPreservando();
      break;
    case 'npc':
      state.npc = message;
      panelCtx.redraw?.();
      break;
    /*
     * A prévia da venda manual da mochila: o que dá para vender, por quanto, e
     * o motivo de cada recusa.
     *
     * Ela chega do SERVIDOR e não é montada aqui de propósito. Quem decide o
     * que pode ser vendido é ele (tier, imbuement, afixo, "não vender"), e uma
     * segunda régua no cliente divergiria da primeira no dia em que uma das
     * duas mudasse — a tela prometeria vender o que a venda recusa.
     *
     * Ela também chega DEPOIS de cada venda, já refeita: a mochila mudou e os
     * índices andaram. Ver `venderMochila`, no index.mjs.
     */
    case 'venderMochila':
      state.vendaDaMochila = { lugar: message.lugar ?? 'bag', linhas: message.linhas ?? [], total: message.total ?? 0 };
      panelCtx.redraw?.();
      break;
    /*
     * ---- A BOSS POUCH ----
     *
     * A mesma prévia das outras duas, com as vagas junto: é a bolsa fixa onde
     * todo o baú de recompensa desemboca, e a tela dela vende e joga fora pelo
     * mesmo conjunto marcado. Ver `openVenderBossPouch`.
     *
     * Ela chega DEPOIS de cada venda e de cada limpeza, já refeita: a lista
     * mudou e os índices andaram.
     */
    case 'bossPouch':
      state.bossPouch = {
        linhas: message.linhas ?? [],
        total: message.total ?? 0,
        slots: message.slots ?? 1000,
        usados: message.usados ?? 0,
      };
      panelCtx.redraw?.();
      break;
    /* A irmã dela, para as sacolas de boss. Ver `openVenderSacolas`. */
    case 'venderSacolas':
      state.vendaDasSacolas = {
        linhas: message.linhas ?? [],
        total: message.total ?? 0,
        sacolas: message.sacolas ?? 0,
      };
      panelCtx.redraw?.();
      break;
    case 'mounts':
      state.mounts = { mounts: message.mounts, outfits: message.outfits };
      panelCtx.redraw?.();
      break;
    case 'blessings':
      state.blessings = message.list;
      // A conta da morte com as bênçãos atuais: é ela que o painel mostra, em
      // vez de um texto escrito à mão que envelhece a cada mudança de fórmula.
      state.blessingsResumo = message.resumo ?? null;
      panelCtx.redraw?.();
      break;
    /*
     * A arena de ONDAS, que nao tem botao em tela nenhuma hoje. Este `case` se
     * chamava `arena` e estava abaixo do `case 'arena'` do lobby de x1: em
     * JavaScript o primeiro ganha, entao ele nunca rodava. Ver `arenaDeOndas`,
     * no servidor.
     */
    case 'arenaOndas':
      state.arenaDeOndas = message.arena;
      panelCtx.redraw?.();
      break;
    case 'contaCharDados':
      chegaramDadosDoOutro(message);
      break;
    // A campanha inteira (as dificuldades, as 48 fases e os bosses): a lista de hunts pede ao abrir.
    case 'comparacao':
      receberComparacao(message);
      break;
    case 'campanha':
      state.campanha = message.campanha;
      panelCtx.redraw?.();
      break;
    case 'actionCatalog':
      setActionCatalog(message.catalog);
      // A Cyclopedia lê o mesmo catálogo: uma fonte só para a barra e para a
      // enciclopédia, e nada de pedir duas vezes ao servidor.
      state.actionCatalog = message.catalog;
      renderActionBar();
      panelCtx.redraw?.();
      break;
    case 'victory':
      // O loot do golpe final, que a sessão desfeita não entregou. Ver
      // `lootNaoEntregue`, no servidor. Só chat: nada disso é desenho de mapa.
      if (message.lootDoFim?.length) feedEvents(message.lootDoFim, state.items, state.character?.name);
      mostrarVitoria(message);
      logSystem(message.arena ? `Você venceu a onda ${message.arena.wave} da arena.` : `Você derrotou ${message.boss}.`);
      break;
    case 'death':
      // A caixa de morte toma a tela; o registro fica no chat para depois.
      mostrarMorte(message);
      logSystem(
        `Você foi derrotado: −${(message.lost ?? 0).toLocaleString('pt-BR')} de experiência` +
          (message.goldLost ? ` e −${message.goldLost.toLocaleString('pt-BR')} de ouro` : '') +
          (message.levelPerdido ? ` (caiu ${message.levelPerdido} level)` : '') +
          (message.descontoPercent ? `. Proteções pouparam ${message.descontoPercent}% da perda` : '') +
          (message.blessings ? `, e ${message.blessings} blessings foram consumidas` : '') +
          '.'
      );
      break;
    case 'error':
      notice(message.message);
      break;
    /*
     * ---- O aviso do Server Save, na TELA ----
     *
     * Ele chega de minuto em minuto enquanto a contagem corre, e tambem no
     * `hello` de quem conecta no meio dela. A faixa FICA — ao contrario do
     * `notice`, que pisca 3 segundos e some: quem olhar a tela a qualquer
     * momento dos quinze minutos tem de ver o aviso, e nao so' quem estava
     * olhando no segundo em que ele saiu.
     */
    case 'serversave':
      mostrarServerSave(message);
      break;
    /*
     * ---- O boss que acabou de nascer na area de Boss Diarios ----
     *
     * "quando eu soltar um boss nao e' pra aparecer no chat e pra aparecer na
     *  tela do jogador sabe bem bonito com o icone de boss e dps desaparece
     *  apos 10 segundos".
     *
     * Ao contrario do Server Save, este NAO fica: e' um acontecimento, e nao um
     * estado. Quem entrar depois nao precisa saber que o Ghazbaran nasceu ha
     * dez minutos — a area esta la', e a aba de Rotacao do painel e' quem
     * responde "quem esta' dentro agora".
     */
    case 'bossNaArena':
      mostrarCartazDoBoss(message);
      break;
    /*
     * ---- Quem está na arena de Boss Diários agora ----
     *
     * Chega no `hello` e depois só quando MUDA (ver `vigiarBossesDaArena`, no
     * index.mjs). Duas telas vivem disto: o nome embaixo do portal da cidade e
     * o atalho da aba de Bosses.
     *
     * Guardado no estado E no mapa: o mapa desenha oito vezes por segundo e não
     * pode ir perguntar ao `state` a cada nome que escreve.
     */
    case 'bossesNaArena':
      state.bossesNaArena = message.lista ?? [];
      mapView.bossesNaArena = state.bossesNaArena;
      /* A aba de Bosses, se estiver aberta, troca o selo na hora. */
      redesenharJanelaAberta();
      break;
    /*
     * O dia de escolha da Recompensa Diária: o servidor já marcou o dia como
     * pego e está esperando a escolha. Abrir o painel na hora é o que fecha o
     * ciclo sem o jogador ter de adivinhar que precisa voltar lá — e se ele
     * fechar assim mesmo, a escolha continua pendente e o painel a mostra da
     * próxima vez (ver `diario.mjs`).
     */
    case 'diarioEscolha':
      openDiario();
      break;
    /* Alguma coisa do diario mudou (o dia foi pego, a escolha foi feita). Se o
       painel estiver aberto ele se redesenha; se nao estiver, ninguem faz nada. */
    case 'diarioAtualizado':
      panelCtx.redraw?.();
      break;
    /*
     * A confirmação do report é curta e diz o NOME da pasta.
     *
     * Não é para o jogador — é para quando ele voltar dizendo "mandei um report
     * e não olharam". Com o nome na tela dele, os dois lados falam da mesma
     * coisa em vez de procurar por data.
     */
    case 'reportOk':
      notice(`Report enviado. Obrigado! (${message.pasta})`);
      break;

    /*
     * A caixa de boosted pede uma escolha antes de virar arma.
     *
     * O servidor manda a lista em vez de a tela tê-la escrita: as sete boosted
     * são as mesmas de `exercicios.mjs`, e uma segunda cópia aqui é uma cópia
     * para esquecer de atualizar no dia em que houver a oitava.
     */
    case 'escolherCaixa':
      openCaixaBoosted(message.escolhas);
      break;
  }
}

/** Zera o que pertencia ao personagem anterior ao trocar de char. */
function resetCharacterState() {
  /*
   * Não há mais o que zerar do presente: os dois avisos viraram botões da barra
   * de cima, e eles leem `state.character` direto — que acabou de ser trocado
   * aqui embaixo. Ver `pintarPresente`.
   */
  // O cartão de convite é do char que saiu: aceitar por ele, já como o novo,
  // mandava o aceite com o nome errado e o convite de verdade ficava preso.
  document.getElementById('convite')?.remove();
  state.character = null;
  state.hunt = null;
  state.city = null;
  /*
   * E a roda de hunts, que faltava aqui.
   *
   * O `welcome` não traz `run` — nunca trouxe —, e ele passa pelo `applyState`
   * como qualquer quadro. Enquanto a reposição não existia isso dava `undefined`
   * e limpava a roda por acidente; agora a reposição devolveria a roda do
   * personagem ANTERIOR, e ela ficaria na tela até o primeiro quadro de estado.
   * São 125 milissegundos, e mesmo assim é errado: quem esquece o personagem
   * esquece a roda dele junto.
   */
  state.run = null;
  // E a mobília das criaturas, que é do mapa do personagem anterior. As duas
  // memórias — esta e a do servidor — esvaziam juntas. Ver `juntarAsCriaturas`.
  mobiliaDasCriaturas.clear();
  state.charms = null;
  // A forja é do personagem: a lista de peças do anterior não vale para este.
  state.forja = null;
  // E o craft mostra o que ESTE personagem tem na mochila. Ver `craftView`.
  state.craft = null;
  // O desmanche também: ele lista as peças deste personagem. Ver `desmancheView`.
  state.desmanche = null;
  state.proficiencyList = null;
  state.shop = null;
  state.store = null;
  state.market = null;
  state.npc = null;
  state.mounts = null;
  lastBagKey = null;
  ultimoRelogioDaVenda = undefined;
  // E a do analisador, que é de outro personagem a partir daqui.
  assinaturaDoAnalisador = null;
  panelSignature = '';
  panelCtx.tabs = {};
  panelCtx.redraw = null;
  mapView.setSnapshot(null, null);
  atualizarMinimapa(false);
}

/*
 * A janela da troca é aberta e fechada pelo ESTADO, e não por um clique.
 *
 * Ela existe enquanto o servidor disser que existe uma troca — e ela some
 * quando o outro cancela, quando a troca se fecha ou quando alguém entra numa
 * caçada. Amarrar a janela ao estado é o que faz os dois lados verem a mesma
 * coisa sem uma segunda contabilidade aqui.
 */
let trocaAberta = false;
let conviteDeTrocaVisto = null;
let ultimaTroca = null;

/*
 * Fechar a janela CANCELA a troca.
 *
 * Uma troca aberta e invisível seria uma armadilha: o outro lado ficaria
 * esperando alguém que já saiu da mesa.
 */
const fecharTroca = () => {
  trocaAberta = false;
  if (state.troca) send({ t: 'trade', action: 'cancel' });
};

/*
 * ---- A janela da troca, e por que ela precisa se RE-registrar ----
 *
 * `openModal` zera `panelCtx.redraw` antes de chamar o `build` — de propósito:
 * todos os modais moram no mesmo `#modal-body`, e um painel deixando o
 * ponteiro de redesenho apontado para ele depois de fechado é o que fazia a
 * tela de prey substituir a busca no meio da digitação.
 *
 * A troca registrava o redesenho no primeiro `build` e o redesenho chamava um
 * `openModal` cujo `build` NÃO registrava nada. Ou seja: a janela se
 * redesenhava exatamente UMA vez e depois congelava. Na prática, arrastar um
 * item para a mesa mudava o estado no servidor, o outro lado via, e o meu lado
 * continuava mostrando oito casas vazias — foi o que a foto pegou.
 *
 * Agora o `build` é o mesmo nas duas vezes, e ele se re-registra. Uma função
 * só, chamada de dois lugares.
 */
function desenharTroca() {
  if (!state.troca) return;
  openModal(
    `Troca com ${state.troca.com}`,
    (corpo) => {
      panelCtx.redraw = desenharTroca;
      corpoDaTroca(corpo);
    },
    fecharTroca,
    /*
     * `solto`: o fundo deixa o ponteiro passar, e a mochila continua viva atrás.
     *
     * Sem isto a janela da troca era uma armadilha. `#modal` cobre a tela
     * inteira e engole todo o ponteiro — e o único jeito de pôr um item na
     * mesa é ir buscá-lo na mochila, que estava do outro lado desse fundo.
     * Arrastar não fazia nada, o botão direito não abria menu nenhum, e a
     * janela ficava dizendo "arraste um item da mochila" para uma mochila
     * inalcançável.
     *
     * É o mesmo que o depósito já fazia, e pela mesma razão.
     */
    'solto'
  );
}

function acompanharTroca(message) {
  state.troca = message.troca ?? null;

  if (state.troca && !trocaAberta) {
    trocaAberta = true;
    ultimaTroca = JSON.stringify(state.troca);
    desenharTroca();
  } else if (state.troca && trocaAberta) {
    /*
     * Redesenhar só quando a troca MUDA.
     *
     * O retrato chega quatro vezes por segundo; refazer a janela nesse ritmo
     * tirava o cursor do campo de ouro no meio da digitação. A assinatura é o
     * que a tela mostra — os dois lados, com item, quantidade e confirmação.
     */
    const assinatura = JSON.stringify(state.troca);
    if (assinatura !== ultimaTroca) {
      ultimaTroca = assinatura;
      desenharTroca();
    }
  } else if (!state.troca && trocaAberta) {
    trocaAberta = false;
    closeModal();
  }

  // O convite: perguntado uma vez por convite, e não a cada retrato.
  const convite = message.conviteDeTroca?.de ?? null;
  if (convite && convite !== conviteDeTrocaVisto) {
    conviteDeTrocaVisto = convite;
    perguntarTroca(convite, message.conviteDeTroca?.expiraEm ?? null);
  } else if (!convite) {
    conviteDeTrocaVisto = null;
  }
}

/*
 * ---- A aba no fundo: guardar o estado, não desenhar ----
 *
 * O servidor manda um retrato oito vezes por segundo, e cada um deles repinta a
 * interface inteira: a barra de cima, a mochila, o painel aberto. Isso é o certo
 * com alguém olhando — e é trabalho jogado fora com a aba minimizada, onde o
 * navegador para de desenhar mas os retratos continuam chegando e sendo
 * processados.
 *
 * O preço aparecia na VOLTA: ao reabrir a aba, o navegador tem de acertar de uma
 * vez tudo o que foi mexido enquanto ninguém via, e é essa conta atrasada que dá
 * a travada de um instante antes de o jogo ficar normal.
 *
 * Agora, com a aba escondida, o retrato ainda é GUARDADO (o estado do jogo
 * continua em dia, o chat continua chegando, os avisos continuam entrando), mas
 * a interface não é repintada e os efeitos de tela — números de dano, magias,
 * projéteis — são descartados: ninguém os veria mesmo.
 *
 * Ao voltar, um desenho só, com o estado mais recente.
 */
let abaEscondida = document.hidden;

document.addEventListener('visibilitychange', () => {
  const escondida = document.hidden;
  if (abaEscondida && !escondida) {
    mapView.reatar();
    renderAll();
  }
  // E o servidor passa a mandar um retrato por segundo, ou volta aos oito.
  // Ver `RITMO_OCULTO_MS`, no servidor.
  if (escondida !== abaEscondida) send({ t: 'oculta', on: escondida });
  abaEscondida = escondida;
});

/* Quando a tela pediu o mapa pela última vez. Ver `applyState`. */
let ultimoPedidoDeMapa = 0;

/*
 * O analógico do celular precisa saber quando ANDAR passa a ser possível — ao
 * chegar na cidade, ao entrar numa Caça Online, ao sair de uma automática.
 * Nenhuma dessas mudanças dispara evento de mídia, então quem avisa é o quadro
 * de estado. Preenchido lá embaixo, junto do teclado. Ver `mobile.mjs`.
 */
let acertarOAnalogico = null;

/*
 * ---- OS PRAZOS CHEGAM COMO INSTANTE E VIRAM CONTAGEM AQUI ----
 *
 * Report do Druid: "não precisa mandar quanto tempo falta pra expirar... manda
 * 1 vez o dia e hora que expira, aí fica armazenado e pronto. Não precisa ficar
 * lendo toda hora e atualizando 8x por segundo."
 *
 * Uma contagem regressiva é `prazo - agora`: ela muda em TODO quadro, por
 * definição. Como o delta do personagem compara campo a campo, um único
 * milissegundo diferente fazia o campo INTEIRO atravessar o fio — a espera de
 * todos os bosses, as três listas de prey com nove criaturas cada, o baú com os
 * itens de todos os bosses do dia — oito vezes por segundo, sem nada ter
 * acontecido.
 *
 * O servidor passou a mandar o INSTANTE, que não muda nunca. E a subtração
 * acontece aqui, na mesma porta onde os deltas são juntados e pela mesma razão:
 * daqui para baixo o personagem tem os campos que sempre teve, com os valores
 * que sempre teve, e nenhuma das telas que os leem — seis só de
 * `bossCooldowns` — precisa saber de nada disto.
 *
 * O relógio é o do NAVEGADOR. Isso é uma escolha, e ela é melhor do que a
 * anterior: o valor agora é exato no instante do desenho, em vez de ser o que
 * era quando o quadro saiu do servidor. O erro possível passa a ser o do
 * relógio da máquina de quem joga, que para prazos de horas e dias não importa
 * — e ele não decide nada: quem recusa a entrada num boss que ainda está em
 * espera é o servidor, com o relógio dele. Um relógio adiantado aqui mostra um
 * boss "pronto" e ganha a recusa de sempre, como já ganhava.
 *
 * O relógio da BARRA DE MAGIAS é o único que não passa por aqui, e por um bom
 * motivo: ele corre no `clock` da caçada, que vem no quadro. Ver
 * `faltaDoCooldown`, em packages/shared/src/prazos.mjs.
 */
function contarOsPrazos(character) {
  if (!character) return character;
  const agora = Date.now();
  const falta = (ate) => Math.max(0, (ate ?? 0) - agora);
  const pronto = { ...character };

  pronto.premium = falta(character.premiumAte);
  if (character.arena) pronto.arena = { ...character.arena, cooldown: falta(character.arena.cooldownAte) };
  if (character.bossCooldownsAte) {
    pronto.bossCooldowns = {};
    for (const [id, ate] of Object.entries(character.bossCooldownsAte)) pronto.bossCooldowns[id] = falta(ate);
  }
  if (character.prey) {
    pronto.prey = character.prey.map((slot) => ({ ...slot, freeReroll: falta(slot.freeRerollAte) }));
  }
  /*
   * As duas portas já mandavam o `ate` junto do `restante`; agora mandam só
   * ele. Ver `acessoView`, em instance.mjs.
   */
  for (const porta of ['instance', 'divina']) {
    if (character[porta]) pronto[porta] = { ...character[porta], restante: falta(character[porta].ate) };
  }
  return pronto;
}

/*
 * ---- AS CRIATURAS CHEGAM SEM A MOBÍLIA QUE JÁ ESTÁ AQUI ----
 *
 * O nome do bicho, o desenho dele, as cores, a velocidade do passo e a vida
 * cheia não mudam porque ele deu um passo — e eram 78% de tudo o que o `hunt`
 * mandava, medido criatura a criatura. Do outro lado, o servidor guarda o que
 * ESTA conexão já recebeu e manda só `{uid, x, y, dir, hp}` de quem ela já
 * conhece. Ver `soOQueAndou`, em pushState.
 *
 * Quem veio inteiro tem `name`; quem veio recortado não. Nenhuma marca nova.
 *
 * ---- A criatura que não está aqui ----
 *
 * Não deveria acontecer: o servidor só recorta quem ele TEM certeza de ter
 * mandado inteiro para esta conexão, e as duas memórias são esvaziadas juntas.
 * Se acontecer, a criatura fica de fora do quadro em vez de ir para a tela pela
 * metade — um `look` faltando quebraria o desenho do mapa inteiro, e um bicho
 * invisível por um quadro não quebra nada. O quadro inteiro que o servidor
 * manda a cada trinta segundos conserta sozinho.
 */
const mobiliaDasCriaturas = new Map();

function juntarAsCriaturas(bichos) {
  if (!Array.isArray(bichos)) return bichos;
  const agora = new Map();
  const lista = [];
  for (const bicho of bichos) {
    if (bicho.name !== undefined) {
      agora.set(bicho.uid, bicho);
      lista.push(bicho);
      continue;
    }
    const mobilia = mobiliaDasCriaturas.get(bicho.uid);
    if (!mobilia) continue;
    const cheio = { ...mobilia, ...bicho };
    agora.set(bicho.uid, cheio);
    lista.push(cheio);
  }
  /*
   * A memória é REFEITA com quem veio neste quadro, e não remendada: é a mesma
   * regra do outro lado, e é o que a mantém do tamanho da tela em vez do
   * tamanho da caçada.
   */
  mobiliaDasCriaturas.clear();
  for (const [uid, bicho] of agora) mobiliaDasCriaturas.set(uid, bicho);
  return lista;
}

/*
 * ---- O REMENDO: o que mudou DENTRO de um campo ----
 *
 * Com `{t:'delta', fundo:true}` o servidor manda alguns campos (a proficiência,
 * a party, o bestiário, os cooldowns, as listas do analisador...) como remendo
 * sobre o que ESTA aba já tem, e a marca `fundo` do quadro diz quais:
 *
 *   { "=": valor }                         troca o valor inteiro
 *   { "~": { chave: remendo }, "-": [..] } junta chave a chave; "-" são as que saíram
 *   { "~": { 3: remendo }, "#": 12 }       o mesmo numa lista, que continua com 12
 *
 * Ver `remendoEntre`, no servidor. Cada nível que muda vira um objeto NOVO, como
 * a junção do delta logo abaixo: tela que compara referência continua certa.
 *
 * Se a base não é a que o servidor pensa (a aba perdeu um quadro, o estado foi
 * limpo), o remendo não é aplicado: o campo fica como estava e a aba pede o
 * delta de novo, o que faz o próximo quadro vir inteiro.
 */
let pediuQuadroInteiro = false;

function juntarOsRemendos(message) {
  /*
   * Um quadro inteiro chegou: o pedido de antes foi atendido.
   *
   * `cityDelta` entra na conta desde que a cidade passou a remendar. Sem ele,
   * quem está na praça (e portanto não tem `huntDelta`) zeraria a trava no
   * quadro seguinte a uma falha, e a aba pediria quadro inteiro sem parar — um
   * pedido por quadro, oito por segundo, exatamente quando o remendo já estava
   * dando errado.
   */
  if (!message.charDelta && !message.huntDelta && !message.cityDelta) pediuQuadroInteiro = false;
  const fundo = message.fundo;
  if (!fundo) return;
  let falhou = false;
  const aplicar = (corpo, base, campos) => {
    for (const campo of campos ?? []) {
      if (!corpo || !Object.hasOwn(corpo, campo)) continue;
      try {
        corpo[campo] = aplicarRemendo(base?.[campo], corpo[campo]);
      } catch {
        // Sem base: o campo fica como está até o quadro inteiro chegar.
        delete corpo[campo];
        falhou = true;
      }
    }
  };
  if (message.charDelta) aplicar(message.character, state.character, fundo.character);
  // A praça: a lista de jogadores chega como remendo sobre a que esta aba já
  // tem. Ver `FUNDO_DA_CIDADE`, no servidor.
  if (message.cityDelta) aplicar(message.city, state.city, fundo.city);
  if (message.huntDelta) {
    aplicar(message.hunt, state.hunt, fundo.hunt);
    if (message.sessaoDelta) aplicar(message.hunt?.session, state.hunt?.session, fundo.session);
  }
  if (falhou && !pediuQuadroInteiro) {
    pediuQuadroInteiro = true;
    send({ t: 'delta', on: true, sessao: true, fundo: true });
  }
}

function applyState(message) {
  // Os remendos viram valores antes de qualquer outra coisa. Ver `aplicarRemendo`.
  juntarOsRemendos(message);
  /*
   * ---- O QUE NÃO VEIO É O QUE NÃO MUDOU ----
   *
   * O quadro só traz os campos que têm o que dizer: um delta sem nenhuma chave
   * dentro não viaja, e o `hunt: null` de quem está na praça é dito uma vez, e
   * não oito vezes por segundo pela caçada inteira que ele não está fazendo.
   * Ver o comentário do `nulosNoCliente`, em pushState.
   *
   * A reposição é a PRIMEIRA coisa que acontece, antes até da junção dos
   * deltas. Daqui para baixo o quadro tem as quatro chaves que sempre teve, e
   * nenhuma das trezentas linhas seguintes precisa saber que alguma faltou.
   *
   * Para `hunt`, `run` e `city` o que volta é o MESMO objeto que já estava na
   * tela — quem comparar "o de antes com o de agora" vai ver que não mudou
   * nada, que é a verdade. O `character` continua sendo refeito a cada quadro
   * porque `contarOsPrazos` o refaz; a razão está logo abaixo.
   */
  for (const campo of ['character', 'hunt', 'run', 'city']) {
    if (!(campo in message)) message[campo] = state[campo] ?? null;
  }
  /*
   * ---- O `character` chega SÓ COM O QUE MUDOU ----
   *
   * O servidor manda oito quadros por segundo, e quase tudo dentro do
   * personagem é igual ao quadro anterior — a tabela das tasks de montaria, a
   * lista de entregas, o depósito. Medido: 225 KB/s, 792 MB por hora e por aba.
   * Report do Garibas, e a causa dos dois reports de "vazamento de banda".
   *
   * Agora vem só o que mudou, com a marca `charDelta`. A junção acontece AQUI,
   * na porta: daqui para baixo `completo` é o personagem inteiro, como sempre
   * foi. Nada no resto do arquivo — nem no resto do cliente — precisa saber que
   * o dado chegou picado, e é isso que impede o delta de virar uma pegadinha
   * espalhada por vinte telas.
   *
   * Um objeto NOVO a cada quadro, e não `Object.assign` no que já existe: era
   * assim antes (o servidor mandava um objeto novo), e há tela que compara o
   * personagem de agora com o de antes para decidir se redesenha.
   */
  /*
   * E os prazos voltam a ser contagens no mesmo movimento, DEPOIS da junção: o
   * instante pode ter chegado num quadro e o resto do personagem noutro. Ver
   * `contarOsPrazos`.
   */
  const completo = contarOsPrazos(
    message.charDelta && state.character
      ? { ...state.character, ...message.character }
      : message.character
  );
  message = { ...message, character: completo };
  /*
   * ---- E a CAÇADA também ----
   *
   * Segunda passada do mesmo report. Depois que o personagem emagreceu, o peso
   * do fio virou quase todo o `hunt`: 17 KB/s dos 19,5 — e dentro dele, vinte e
   * cinco campos que nao mudam uma unica vez em dez segundos de caçada
   * (`huntId`, `mapId`, `startedAt`, `alcance`, `party`, `boss`...), mais os
   * `monsters` repetidos sessenta e uma vezes em oitenta envios.
   *
   * A junção é a mesma do personagem e acontece no mesmo lugar, na porta: daqui
   * para baixo `message.hunt` é a caçada inteira, e nem o mapa nem a barra de
   * ações precisam saber que ela chegou picada.
   *
   * O `map` nunca vem no delta — quem manda nele é o `sentMapId` do servidor —,
   * e é por isso que o espalhamento devolve o mapa que já estava aqui.
   */
  /*
   * O analisador (`session`) pode vir picado DENTRO do delta da caçada, com a
   * marca `sessaoDelta`: só os subcampos que mudaram — a lista do que foi
   * vendido não viaja de novo por causa de uma moeda. A junção é a mesma, um
   * nível mais fundo.
   */
  const juntada =
    message.huntDelta && state.hunt && message.hunt
      ? message.sessaoDelta && message.hunt.session && state.hunt.session
        ? { ...state.hunt, ...message.hunt, session: { ...state.hunt.session, ...message.hunt.session } }
        : { ...state.hunt, ...message.hunt }
      : message.hunt;
  /*
   * E as criaturas ganham de volta a mobília que o servidor não repetiu — só
   * quando a lista VEIO neste quadro. Se ela não veio, a que já está aqui está
   * completa e refazê-la seria trabalho à toa. Ver `juntarAsCriaturas`.
   */
  const cacadaInteira =
    juntada && message.hunt?.monsters
      ? { ...juntada, monsters: juntarAsCriaturas(juntada.monsters) }
      : juntada;
  message = message.huntDelta || cacadaInteira !== juntada ? { ...message, hunt: cacadaInteira } : message;
  /*
   * ---- E A CIDADE, que era a maior de todas ----
   *
   * Terceira passada do mesmo report, do Druid: "tenta mandar APENAS as
   * atualizações, pra não repetir dados sem alteração... tá mandando toda a
   * lista em todos os json; nem precisaria, só mandar 1 vez, depois só se
   * tivesse alterado".
   *
   * O quadro de quem está parado na praça custava 27,3 KB/s — 96 MB por hora e
   * por aba —, e 22,5 desses eram o `city`. Dentro dele, os bonecos de treino e
   * os NPCs: mobília que não se mexe, viajando inteira oito vezes por segundo.
   *
   * A junção é a mesma dos outros dois e acontece no mesmo lugar, na porta.
   * Daqui para baixo `message.city` é a cidade inteira, e nem o mapa nem a lista
   * de gente precisam saber que ela chegou picada.
   *
   * O `map` nunca vem no delta — quem manda nele é o `sentMapId` do servidor —,
   * e é por isso que o espalhamento devolve o mapa que já estava aqui.
   */
  const cidadeInteira =
    message.cityDelta && state.city && message.city
      ? { ...state.city, ...message.city }
      : message.city;
  message = message.cityDelta ? { ...message, city: cidadeInteira } : message;
  /* E a roda de hunts, pelo mesmo caminho: ela viajava inteira por causa de um
   * relógio em milissegundos, levando os nomes das hunts de carona. */
  const rodaInteira =
    message.runDelta && state.run && message.run ? { ...state.run, ...message.run } : message.run;
  message = message.runDelta ? { ...message, run: rodaInteira } : message;
  /*
   * ---- O lobby ABRE sozinho para quem foi chamado ----
   *
   * Quem arma o lobby é o líder, e a tela dele já abriu no clique. Os outros
   * não clicaram em nada: para eles o lobby aparece do nada, e um aviso de
   * canto que some em três segundos é a única coisa que eles veriam.
   *
   * Só na PRIMEIRA vez que ele aparece — senão a janela voltaria a se abrir a
   * cada estado, por cima do que a pessoa estivesse fazendo. E só com nada
   * aberto: interromper a tela do depósito de alguém para mostrar um lobby que
   * ele pode abrir pela party seria pior do que não mostrar.
   */
  /*
   * O "plano" do lobby: para onde e em que modo. É a troca DELE que abre a
   * janela — e não a de um "pronto" qualquer, que faria a tela pular na cara de
   * todo mundo a cada clique dos outros.
   */
  /*
   * ---- E QUEM VAI faz parte do plano ----
   *
   * Report do dono: "mesmo eu desmarcando alguém tá aparecendo o convite pra
   * pessoa". Duas coisas erravam juntas, e esta e a de cá: a chave do plano era
   * só a sala e o modo, então mudar a CONVOCAÇÃO não contava como plano novo.
   *
   * Ela entra na chave porque mudar quem vai apaga os prontos do time (ver
   * `armarLobby`): quem foi chamado precisa confirmar de novo, e a janela tem
   * de voltar para ele. Sem isto, o líder tirava uma pessoa, todo mundo perdia
   * o "pronto" e ninguém era avisado.
   */
  const planoDoLobby = (personagem) =>
    personagem?.lobby
      ? `${personagem.lobby.huntId}|${personagem.lobby.modo}|${(personagem.lobby.membros ?? [])
          .filter((m) => m.convocado !== false)
          .map((m) => m.nome)
          .join(',')}`
      : null;
  /*
   * Fui CHAMADO para esta?
   *
   * `convocado` só vem de servidores novos; `!== false` faz uma aba velha
   * continuar abrindo para todo mundo, como abria antes.
   */
  const chamadoNoLobby = (personagem) =>
    (personagem?.lobby?.membros ?? []).find((m) => m.eu)?.convocado !== false;
  const lobbyAntes = planoDoLobby(state.character);
  const lobbyAgora = planoDoLobby(message.character);
  const lobbyNaTela = !$('modal').hidden && $('modal-title').textContent === TITULO_DO_LOBBY;
  state.character = message.character;
  /*
   * ---- A janela abre MESMO com outra coisa aberta ----
   *
   * Ela só abria com a tela limpa, e o motivo estava escrito: não interromper o
   * depósito de alguém. O dono topou com o outro lado disso — "o char convidado
   * nao aparece pra dar pronto" — e o outro lado é mais caro.
   *
   * O lobby não é um aviso: é uma pergunta com prazo. Do outro lado há alguém
   * parado esperando a resposta para o time inteiro entrar, e numa sala de boss
   * a resposta custa doze horas de espera de cada um. Perder a pergunta porque
   * a mochila estava aberta é pior do que ter a mochila fechada na hora errada
   * — e reabrir a mochila custa um clique.
   *
   * Continua sendo UMA vez por plano: enquanto a sala e o modo forem os mesmos,
   * a janela não volta sozinha para cima do que a pessoa fizer depois.
   */
  /*
   * E ela NÃO abre para quem ficou de fora desta ida.
   *
   * Era a outra metade do report: a janela pulava na cara de quem o líder
   * acabara de desmarcar, pedindo "pronto" para uma caçada que não é dele. Ele
   * continua vendo o lobby se ABRIR a janela — o card dele aparece apagado,
   * dizendo que fica de fora —, mas nada salta na tela.
   */
  if (
    lobbyAgora &&
    lobbyAgora !== lobbyAntes &&
    !message.character?.lobby?.souLider &&
    chamadoNoLobby(message.character)
  ) {
    openLobby();
  } else if (!lobbyAgora && lobbyAntes && lobbyNaTela) {
    /*
     * E FECHA sozinha quando o lobby acaba — o líder começou ou cancelou.
     *
     * Sem isto, quem foi levado para a caçada continuava com a janela do lobby
     * por cima do mapa, dizendo "não há lobby aberto": a tela dava a impressão
     * de que a entrada tinha falhado, justamente no momento em que ela deu
     * certo.
     */
    closeModal();
  }
  /*
   * A faixa de novidades depende de `character.settings.novidadesLidas`, então
   * ela só sabe o que fazer DEPOIS que o personagem chega. Ficava junto de
   * `pintarAvisoDeObra`, e ali o `state.character` ainda é o do quadro
   * anterior: na primeira entrada não havia nenhum, e a faixa não aparecia.
   */
  pintarNovidades();
  state.hunt = message.hunt;
  /*
   * Entrou na área de Boss Diários com o cartaz na tela: ele sai na hora.
   *
   * A porta do `mostrarCartazDoBoss` só pega quem já estava lá dentro quando o
   * boss nasceu. Este caso é o contrário e é o comum: o aviso apareceu, a
   * pessoa correu para a área, e o cartaz iria junto — tapando o boss que ele
   * mesmo anunciou.
   */
  if (state.hunt?.arena) fecharCartazDoBoss(true);
  /* A contagem da arena de x1. Ver `acertarLargada`. */
  acertarLargada(state.hunt?.largadaEm ?? 0);
  // Entrou ou saiu de uma caçada: o analógico aparece ou some. Ver `mobile.mjs`.
  acertarOAnalogico?.();
  state.run = message.run ?? null;
  state.city = message.city;
  conferirPisada(message.city);
  acompanharTroca(message);

  mapView.setSnapshot(message.hunt ?? message.city, message.character);
  atualizarBotaoDeInteragir();
  // Só na fase (na cidade não): os pontos andam a cada retrato; a geometria é refeita só ao trocar de fase/andar.
  atualizarMinimapa(!!message.hunt);
  /*
   * ---- A tela em branco pede o mapa de volta ----
   *
   * Report do dono: "dependendo alguns momentos ao trocar de aba ou reconectar
   * algumas sprites fica invisivel ou fica com sprite de outro item".
   *
   * A paleta do mapa viaja UMA vez por mapa — ela é grande, e repeti-la a cada
   * quadro seria megabytes por segundo. O servidor marca o socket como
   * atendido; se aquele envio se perdeu no caminho, ele nunca mais manda, e a
   * tela fica sem como traduzir os índices que continuam chegando.
   *
   * Aqui a tela pede. Com freio: um pedido a cada três segundos, no máximo —
   * numa reconexão ruim, um pedido por quadro viraria uma enxurrada de mapas de
   * dois megabytes justamente quando a rede já está mal.
   */
  const faltando = mapView.faltaOMapa();
  if (faltando && Date.now() - ultimoPedidoDeMapa > 3000) {
    ultimoPedidoDeMapa = Date.now();
    /*
     * O contador fica no `window` de propósito, e não só para a sonda: quando
     * alguém reportar a tela em branco de novo, este número no console diz na
     * hora se o socorro foi pedido — e, se ele estiver subindo sem parar, que o
     * servidor não está respondendo. É a diferença entre "não pediu" e "pediu e
     * não veio", que são dois defeitos diferentes.
     */
    window.__pedidosDeMapa = (window.__pedidosDeMapa ?? 0) + 1;
    send({ t: 'pedirMapa' });
  }
  if (message.events?.length) {
    // Efeito de tela com a aba no fundo é desenho para ninguém.
    if (!abaEscondida) mapView.addEvents(message.events);
    feedEvents(message.events, state.items, state.character?.name);
    acompanharConjuracao(message.events, state.character?.name);

    // Falta de capacidade: a bolsa pulsa em vermelho e o aviso sobe na tela.
    // Sem isso, o loot sumindo parece defeito da venda automática.
    const semCap = message.events.find((event) => event.t === 'nocap');
    if (semCap) {
      notice(
        semCap.semLugar
          ? 'A bolsa de loot está no limite de linhas — o loot está ficando no chão. Limpe a bolsa.'
          : 'Sem capacidade — o loot está ficando no chão. Venda a bolsa.'
      );
    }
    for (const event of message.events) {
      if (event.t === 'bestiaryDone') notice(`Bestiary de ${event.name} completo: +${event.points} pontos de charm.`);
      /*
       * ---- A escada da arena subiu um degrau ----
       *
       * "a cada tempo os bixo dessas arena, se caso ninguem morra, a vida deles
       *  e dano vai aumentando em 15% a cada 2 minutos sabe, e informa na tela."
       *
       * O ACUMULADO junto do passo, e nao so' o passo: "+15%" no oitavo degrau
       * seria uma meia verdade tranquila, quando o bicho ja esta batendo mais
       * que o dobro. O numero que assusta e' o que informa.
       */
      if (event.t === 'arenaOnda') mostrarOndaDaArena(event);
      /*
       * ---- O boss da arena caiu: a mesma tela da sala de boss ----
       *
       * "quando eu mato os bosses na sala de boss diário tem que aparecer na
       *  tela o que foi dropado e informar que foi pro depósito, igual quando
       *  mata boss na área de boss em aventuras".
       *
       * É literalmente a mesma `mostrarVitoria`. Na sala ela sai quando a
       * sessão acaba e o jogador volta para a cidade; a arena não acaba — quem
       * matou continua lá dentro —, então o evento vem da própria caçada.
       *
       * O filtro pelo nome é obrigatório: o evento chega a todos os que estão
       * na arena, e cada um rolou a tabela dele. Sem isto, três pessoas veriam
       * três telas cada uma, duas delas com o loot de outro.
       */
      if (event.t === 'bossCaiu' && event.quem === state.character?.name) {
        /*
         * Fica dois terços do tempo da tela da sala de boss.
         *
         * "diminua o tempo da tela que mostra o loot do boss do boss diário
         *  pra 2/3 do que está".
         *
         * E o pedido tem motivo de sobra: na sala de boss a caçada ACABOU e o
         * jogador está voltando para a cidade — não há o que fazer enquanto a
         * faixa some. Na arena a luta continua, o boss seguinte pode já estar
         * no chão, e uma faixa no meio da tela é uma parede entre ele e o jogo.
         */
        mostrarVitoria({ boss: event.boss, loot: event.loot, fracaoDoTempo: 2 / 3 });
      }
    }
  }
  // A cortina sobe antes do aviso: ela é quem cobre a troca de mapa.
  if (message.viagem) mostrarViagem(message.viagem);
  if (message.notice) notice(message.notice);
  /*
   * Arco novo na mão: a lista de aljavas se abre sozinha.
   *
   * Quem manda o sinal é o servidor, e só quando há mais de uma escolha — ver o
   * `equip` em index.mjs. A tela não decide isso sozinha porque ela não sabe se
   * a arma ACABOU de entrar: ela vê o estado depois, e um arco equipado há dez
   * minutos é indistinguível de um equipado agora.
   */
  if (message.abrirAljava) openQuiverPicker();
  // Escondida, a interface não é repintada — o `visibilitychange` faz isso uma
  // vez quando a aba volta.
  if (!abaEscondida) renderAll();
}

connect();

// ---------- janelas ----------

const panelCtx = {
  state,
  send,
  tabs: {},
  openModal,
  closeModal,
  /*
   * ---- Qual caixa do depósito está aberta ----
   *
   * Ela EXISTIA, e no objeto errado: estava no contexto do `initHud`, e quem
   * precisa dela é a mochila — `initInventory(panelCtx)` recebe ESTE objeto.
   * `ctx.caixaDoDepositoAberta?.()` em `inventory.mjs` devolvia `undefined`, o
   * `caixa != null` dava falso, e o clique caía no `equip` logo abaixo.
   *
   * Do lado de quem joga: com o depósito aberto, clicar numa peça da mochila
   * VESTIA a peça em vez de guardá-la — e o comentário do `renderContainer`
   * descrevia, desde sempre, um comportamento que a ligação nunca entregou. O
   * `?.` é o que fazia isso falhar em silêncio: sem ele teria sido um erro na
   * primeira vez que alguém clicou.
   */
  caixaDoDepositoAberta,
  /* O baú da guilda: a outra caixa que pode estar esperando peça (ver `guildas.mjs`). */
  bauDaGuildaAberto,
  guardarNoBauDaGuilda,
  /*
   * A cruz armada por um ITEM da mochila (hoje, o machete).
   *
   * Vai pelo `ctx` e nao por `import`: a mochila ja recebe este objeto, e um
   * `import` dela para o `main.mjs` fecharia o ciclo que o `ctx` existe para
   * evitar. E' o mesmo caminho do `pedirUso`.
   */
  armarMiraDeItem,
  /*
   * ---- Disparar um slot pelo TOQUE ----
   *
   * No computador quem dispara é a tecla; no telefone não há tecla nenhuma, e
   * tocar no slot abria o editor da ação — "ao clicar em um slot no celular não
   * pode ter a função de colocar hotkey senão não consigo apertar".
   *
   * É a MESMA porta da tecla (`dispararSlot`) e não um `send` novo: a mira das
   * runas que pedem lugar mora lá dentro, e um caminho paralelo teria de
   * repeti-la — ou esqueceria dela, e a runa sairia sem alvo.
   */
  dispararSlot,
  // Aviso curto no canto, para os painéis que precisam confirmar uma ação.
  notice: (texto) => notice(texto),
  // A bolsa abre o filtro por aqui: inventory.mjs e panels.mjs não se importam
  // um ao outro, e o contexto compartilhado já é a ponte entre os dois.
  openLootFilter: () => openLootFilter(),
  // O mesmo caminho para a limpeza da bolsa.
  openLimparBolsa: () => openLimparBolsa(),
  openLimparMochila: () => openLimparMochila(),
  openVenderMochila: () => openVenderMochila(),
  // A mesma tela, na bolsa de loot. Ver `openVenderMochila`.
  openVenderBolsa: () => openVenderMochila('pouch'),
  /*
   * As telas de marcacao da Boss Pouch, que os dois botoes do cabecalho dela
   * abrem. O quadradinho da mochila abre a JANELA, e nao esta tela — ver
   * `celulaDaBossPouch`.
   */
  openVenderBossPouch: () => openVenderBossPouch(),
  // A Store Inbox, que a Store abre pelo botão ao lado de Histórico. Ver `abrirStoreInbox`.
  abrirStoreInbox: () => abrirStoreInbox(),
  /*
   * A bolsa também precisa levar à loja.
   *
   * O atalho do tempo da auto-venda mora no cabeçalho da janela da bolsa e abre
   * a prateleira de melhorias — o lugar onde se compra menos espera é a última
   * coisa que alguém vai procurar num menu de loja quando o que ele está
   * olhando é a bolsa cheia.
   */
  abrirLojaEm: (secao, busca = '', destaque = null) => {
    openStore();
    panelCtx.tabs.storeSection = secao;
    panelCtx.tabs.storeBusca = busca;
    panelCtx.tabs.storeDestaque = destaque;
    renderAll();
  },
  // O selo de blessings do inventário abre a compra por aqui — mesma ponte.
  abrirBlessings: () => openBlessings(),
  // Desligar a rotação de bosses, com a pergunta quando há sala em curso.
  pararAutoBoss,
  // E a saída de quem só está de carona nela: ver `sairDoAutoBossConvidado`.
  sairDoAutoBossConvidado,
  // A lixeira precisa avisar quando recusa um item ainda vestido.
  notice,
  /*
   * ---- As duas pontas soltas do menu do botao direito ----
   *
   * `social.mjs` chamava `ctx.abrirAparencia?.()` e `ctx.abrirChatPrivado?.()`,
   * e nenhuma das duas existia aqui. Com o `?.` no meio, clicar em "Aparencia"
   * ou em "Mensagem privada" nao dava erro nenhum: o menu fechava e nada
   * acontecia, que e o pior jeito de nao funcionar.
   *
   * As duas telas ja existiam e ja eram abertas por outros caminhos — a
   * aparencia pela aba da ficha, o privado pelo canal do chat. So faltava a
   * ponte.
   */
  // A aba de aparência da ficha é a 'look' (as abas são 'sheet' e 'look'); 'aparencia' não abria aba nenhuma.
  abrirAparencia: () => openCharacter('look'),
  abrirChatPrivado: (nome) => {
    abrirConversa(nome);
    // Sem isto a conversa abre numa janela que pode estar fechada ou minimizada.
    setVisible('chat', true);
    renderChat();
  },
  redraw: null,
  /*
   * ---- O redesenho que NÃO puxa o tapete ----
   *
   * `redraw` refaz a janela do zero: o campo que estava sob o dedo nasce de
   * novo, e com ele vai o foco, o cursor e a rolagem. Para quem desenha depois
   * de um clique isso não custa nada — o dedo já saiu do campo.
   *
   * Para quem desenha a cada TECLA custa a tela inteira. O filtro das tasks
   * chamava `redraw` no `oninput`, e o sintoma foi o que o dono descreveu:
   * "quando eu to digitando no filtro de tasks eu so consigo por uma letra e ai
   * tenho que clicar dnv". A primeira letra redesenhava, o campo novo nascia
   * sem foco, e a segunda ia para lugar nenhum.
   *
   * `redesenharPreservando` já resolvia isso desde o mercado, mas morava só aqui
   * — `panels.mjs` não importa `main.mjs` (a volta do círculo), então não tinha
   * como alcançá-la. A ponte é esta linha.
   */
  redrawSuave: () => redesenharPreservando(),
  /*
   * O canto do cabeçalho, ao lado do X.
   *
   * Devolve o elemento já LIMPO: quem chama está montando o cabeçalho dele
   * agora, e uma troca de aba não pode deixar o botão da aba anterior ali.
   */
  acoesDoModal: () => {
    const caixa = $('modal-acoes');
    caixa.innerHTML = '';
    return caixa;
  },
  /*
   * O canto esquerdo, para quem tem um NÚMERO a mostrar ao lado do título —
   * hoje os tickets da arena. Esvazia na chamada, como o irmão da direita: o
   * painel desenha a cada `redraw` e dois selos empilhados seriam o defeito.
   */
  seloDoModal: () => {
    const caixa = $('modal-selo');
    caixa.innerHTML = '';
    return caixa;
  },
};

function buildWindows() {
  if (windowsReady) return;
  windowsReady = true;

  /*
   * Arranjo de fábrica: **uma coluna à direita e o chat sozinho na esquerda.**
   *
   * Inventário em cima, mochila embaixo dele e a bolsa de loot no pé da coluna;
   * o chat no canto de baixo à esquerda. As três da direita são do mesmo
   * assunto — o que está vestido, o que está guardado, o que acabou de cair — e
   * ficam na ordem em que se olha para elas. O meio da tela fica livre para o
   * jogo, que é o que se olha o tempo todo.
   *
   * A bolsa saiu do meio da esquerda: lá ela dividia a coluna com o chat e as
   * duas viviam apertadas, e ainda por cima longe da mochila, que é para onde
   * o loot vai. O analisador continua fechado, a um clique na barra de cima.
   *
   * Ancoradas por `right`/`bottom`, e não por coordenada fixa: numa tela mais
   * estreita a coluna acompanha a borda em vez de sair pela direita.
   */
  /*
   * Cada janela na largura do que ela guarda, não numa largura só.
   *
   * A bolsa e o analisador ganham a largura do card do personagem (340px):
   * são listas, e estreitas cortavam o loot em quatro colunas. O inventário
   * não — ele é uma grade fixa de três colunas de 44px, e a 340 sobrava um
   * palmo de moldura vazia dos dois lados. A mochila fica no meio, com quatro
   * colunas. Quem quiser mais estica pela alça; o botão do cabeçalho traz de
   * volta para cá.
   */
  const LARGURA = 340;
  /*
   * ---- O arranjo de fábrica é o do dono ----
   *
   * As medidas abaixo saíram do arranjo que ele montou e salvou, e não de
   * números escolhidos no projeto. Todas as janelas ficaram mais ESTREITAS do
   * que os padrões antigos — 188 em vez de 230 e 250 à direita, 258 em vez de
   * 326 no chat —, o que diz uma coisa só: sobrava largura, e ela roubava mapa.
   *
   * As âncoras continuam sendo âncoras (`right`, `bottom`, `left`) e não
   * coordenadas fixas. Copiar o `left`/`top` do save prenderia o arranjo à tela
   * dele: numa tela menor a bolsa de loot nasceria fora do monitor. Ancorada,
   * ela nasce no mesmo canto em qualquer resolução.
   *
   * Quem já jogou não é afetado: só vale para quem não tem arranjo salvo no
   * navegador — conta nova, máquina nova, ou depois de "Esquecer o arranjo".
   */
  // A coluna da esquerda tem o card em cima e a barra de ações embaixo: sobram
  // uns 370px para a bolsa e o chat dividirem sem um passar por cima do outro.
  // No pé da coluna da direita, e estreita o bastante para não encostar na
  // barra de ações, que é centrada e chega a 1579px numa tela de 1920.
  /*
   * 288 de largura, e não 246.
   *
   * Com 246 o cabeçalho não cabe: sobram 64 pixels para "BOLSA DE LOOT" depois
   * do relógio, da contagem e dos quatro botões, e o nome sai como "BOLSA D…".
   * Medido no navegador, a conta fecha a partir de 276.
   *
   * Isto mexe só no tamanho de FÁBRICA — quem já arrastou a janela para o
   * tamanho que quer tem o arranjo guardado e não vê diferença. E a bolsa
   * ganhou mil espaços em cem por página: 246 dava seis colunas de loot.
   */
  createWindow({ id: 'loot', title: 'Bolsa de loot', defaults: { right: 12, bottom: 8, width: 288, height: 212 } });
  /*
   * O chat divide a coluna da esquerda com a barra de ações, que é centrada e
   * larga: em 400 ele passava por baixo dos slots. Na largura do card ele para
   * antes da borda dela.
   *
   * E ancorado embaixo, não numa altura fixa: quanto mais estreita a tela, mais
   * a barra avança para a esquerda, e aí só a largura não bastaria.
   */
  createWindow({ id: 'chat', title: 'Chat', defaults: { left: 8, bottom: 8, width: 258, height: 188 } });
  createWindow({ id: 'analyzer', title: 'Analisador de hunt', defaults: { right: 12, top: 72, width: LARGURA, height: 380, hidden: true } });
  // Fechado ele não desenha (ver `renderAnalyzer`): este é o empurrão de abrir.
  quandoAbrir('analyzer', () => renderAnalyzer());
  /*
   * ---- Buffs e Boosts ----
   *
   * "uma opção de modal que seria tipo o modal do Analisador, e linha por
   *  linha, e o nome do modal seria Buffs e Boosts."
   *
   * Janela de verdade e não um modal: modal tampa o jogo e fecha ao clicar
   * fora, e isto é uma coisa que se deixa ABERTA no canto enquanto se caça —
   * como o Analisador e a Bolsa de Loot. Ela se move, se redimensiona e guarda
   * o lugar junto das outras.
   *
   * Nasce fechada e abre pelas OPÇÕES, e não por um botão na barra de cima:
   * "não seria ícone clicável na topbar, seria nas próprias opções". A barra já
   * tem vinte botões, e este é o assunto da seção "Relógios na tela" — quem
   * está mexendo em como os buffs aparecem é quem quer esta janela.
   *
   * Baixinha de propósito: são poucas linhas, e uma janela alta e vazia parece
   * quebrada.
   */
  createWindow({ id: 'buffs', title: 'Buffs e Boosts', defaults: { right: 12, top: 460, width: LARGURA, height: 220, hidden: true } });
  /*
   * ---- Boss Cooldown ----
   *
   * "tira os bosses cooldown do analisador de hunt e faz um modal proprio que
   * seria o Boss Cooldown, parecido com o modal dos buffs e boosts, mostrando o
   * boss, o nome do boss e o tempo que falta. So' que deixa otimizado pra nao
   * gerar lag com tantos ticks. E pra abrir esse modal e' la' nas
   * configuracoes."
   *
   * Ela nasceu dentro do Analisador de hunt e nunca pertenceu a ele: o
   * analisador responde "como esta' indo ESTA cacada" — exp por hora, lucro,
   * loot — e a espera dos bosses e' uma pergunta de quem NAO esta' cacando,
   * feita justamente para decidir o que fazer agora. Um `details` dobrado no
   * fim de uma janela de sessao e' o pior lugar possivel para ela.
   *
   * Janela e nao modal, pelo mesmo motivo dos Buffs: modal tampa o jogo e fecha
   * ao clicar fora, e isto e' coisa de deixar aberta no canto. E ela abre pelas
   * OPCOES, como os Buffs — a barra de cima ja' tem vinte botoes.
   *
   * O cuidado com os "ticks" esta' em `renderBossCdJanela`, e ele e' a razao de
   * ela poder existir: sao noventa e tantas salas, e desenha-las oito vezes por
   * segundo seria noventa canvas por quadro.
   */
  createWindow({ id: 'bossCd', title: 'Boss Cooldown', defaults: { right: 12, top: 700, width: LARGURA, height: 240, hidden: true } });
  /*
   * ---- O card da party, no canto esquerdo ----
   *
   * Ele era uma faixa presa acima da barra de habilidade: não dava para mover,
   * não dava para fechar, e cabia uma linha de texto — com cinco pessoas na
   * caçada, cinco nomes espremidos num rodapé que já tem o alvo, a distância e
   * o lurar.
   *
   * Como janela ele ganha o que as outras têm de graça: arrastar, redimensionar
   * e minimizar. Nasce escondido e aparece sozinho quando há party (ver
   * `cuidarDaJanelaDaParty`), que é quando ele tem o que mostrar.
   */
  createWindow({ id: 'party', title: 'Party', defaults: { left: 8, top: 72, width: 232, height: 320, hidden: true } });
  // O inventário é a única que não estica: a grade é fixa em três colunas de
  // 44px e a linha de capacidade fecha embaixo — puxar só criaria moldura vazia
  // em volta de um desenho que já está do tamanho certo.
  createWindow({
    id: 'inventory',
    title: 'Inventário',
    /*
     * SEM altura fixa: ela é o que couber.
     *
     * Era um número escrito à mão (322, depois 372, depois 340), medido de uma
     * vez e desatualizado a cada mexida no que vai dentro. Errar para menos
     * corta o rodapé — foi o que aconteceu quando a capacidade virou barra e
     * ela nasceu fora da janela, cortada pelo `overflow: hidden`. Errar para
     * mais deixa um buraco embaixo do conteúdo.
     *
     * Sem `height`, o corpo é uma coluna flex e a janela fica exatamente da
     * altura das três peças que carrega. Esta é a única janela que pode fazer
     * isso, e justamente por ser a única que não estica: não há nada para o
     * jogador ajustar, então ela tem de nascer certa.
     */
    // `right: 0` e nao 12: a arte da moldura tem 9px transparentes de cada
    // lado, entao 12 de folga viram 21 de buraco na tela. Colada, ela encosta
    // na borda como no arranjo do dono — e a Mochila logo abaixo usa o mesmo
    // numero, senao as duas da coluna da direita ficam desalinhadas entre si.
    defaults: { right: 0, top: 72, width: 188 },
    resizable: false,
  });
  createWindow({ id: 'container', title: 'Mochila', defaults: { right: 0, top: 360, width: 188, height: 214 } });
  /*
   * ---- A casa do chão é uma JANELA, e não um modal ----
   *
   * "o browse field não seria em linha reta horizontal sabe? seria quadrado, e
   * não seria um modal assim, senão eu não consigo arrastar pra outros lado do
   * mapa."
   *
   * Ele está descrevendo o defeito exato de tê-lo feito modal: o `#modal` é uma
   * cortina por cima da tela inteira, e com ela aberta o mapa não recebe o
   * `drop` — a metade do pedido que era "arrastar pra outro sqm" simplesmente
   * não tinha como funcionar.
   *
   * Como janela, ela é a mesma coisa que a Mochila: flutua, arrasta pelo
   * título, e o mapa continua vivo embaixo. É também o que o client dele faz —
   * o browse field ABRE UM CONTAINER, e container ali é janelinha.
   *
   * Quadrada de propósito: quatro colunas de quadradinho, como uma bolsa. Em
   * linha, dez peças viravam uma fita atravessando a tela.
   *
   * Nasce escondida e não fica no arranjo de ninguém: ela é de UMA casa, aberta
   * pelo botão direito e fechada logo depois. Ver `abrirBrowseField`.
   */
  createWindow({
    id: 'browse',
    title: 'Chão',
    defaults: { right: 0, top: 590, width: 178, height: 186, hidden: true },
  });
  quandoAbrir('browse', () => renderBrowse(true));
  /*
   * ---- A BOSS POUCH É UMA MOCHILA, e não um modal ----
   *
   * "seria tipo você clica e ela abre como se fosse uma mochila mesmo, e aí
   * teria tudo que eu coletei lá, e eu conseguiria arrastar pra mochila ou pôr
   * esses itens no market e etc. E os botões ficariam em cima, sabe, a mesma
   * lógica da mochila — e não por modal."
   *
   * A primeira versão era um modal de marcar-e-vender, e ele resolvia só metade
   * do problema: dava para esvaziar a bolsa, não para USAR o que estava nela.
   * Modal tampa o jogo, fecha ao clicar fora e não recebe arrasto — três coisas
   * que uma bolsa precisa fazer.
   *
   * Como janela ela fica no canto, se move, se redimensiona e guarda o lugar
   * junto das outras; as peças saem dela para a mochila com um clique ou
   * arrastando, e do mercado em diante o caminho é o de sempre. Os dois botões
   * que existiam continuam existindo — no cabeçalho, como na mochila, e abrindo
   * as MESMAS telas de marcação (ver `openVenderBossPouch`).
   *
   * Nasce fechada: ela é grande e quase todo mundo passa o dia sem abri-la. A
   * porta é o quadradinho dentro da mochila, que é onde o dono a pôs.
   *
   * 288 de largura pelo mesmo motivo da Bolsa de Loot: com menos, o cabeçalho
   * com a contagem e os dois botões não cabe e o nome sai recortado.
   */
  createWindow({
    id: 'bossPouch',
    title: 'Boss Pouch',
    defaults: { right: 12, top: 200, width: 288, height: 260, hidden: true },
  });
  // A Store Inbox: onde chega o que se compra na Store. Janela como a Boss Pouch. Ver `renderStoreInbox`.
  createWindow({
    id: 'storeInbox',
    title: 'Store Inbox',
    defaults: { right: 12, top: 230, width: 288, height: 260, hidden: true },
  });

  initHud({
    /*
     * O estado do jogo, para o HUD saber em que caçada o personagem está.
     *
     * Ele não ia junto — o card do personagem só precisava do próprio
     * personagem, que chega por parâmetro em `renderHud`. A faixa do treino
     * precisa de mais: ela só aparece no PÁTIO, e quem sabe disso é
     * `state.hunt.huntId`. Sem esta linha ela ficava escondida lá, calada, e o
     * defeito não dava erro nenhum.
     *
     * É o MESMO objeto, e não uma cópia: `state` é mutado no lugar a cada
     * mensagem do servidor, e uma cópia congelaria o HUD no primeiro quadro.
     */
    state,
    openSheet: () => {
      panelCtx.tabs.character = 'sheet';
      openCharacter();
    },
    openProficiency,
    openCharms,
    // O botão da árvore no HUD abre a Árvore de Passivas única (a antiga, por vocação, saiu na etapa 7).
    openArvore: openPassivas,
    openImbuements,
    openPrey,
    openPromotion,
    // A engrenagem da barra abre o modal de ajustes da tela.
    abrirAjustesDaBarra: openBarSettings,
    // O x que tira os Buff Power da tela precisa dizer para onde eles foram.
    notice,
    /*
     * O recorte da folha de magias, para as pilulas de relogio das magias
     * ligadas. Pela ponte e nao por import: `actionbar.mjs` importa de
     * `hud.mjs`, e a volta fecharia um ciclo — a mesma razao do `abrirLojaEm`
     * logo abaixo.
     */
    spellIcon,
    // A faixa do alto e o botão da aba de Bosses desligam a rotação pela MESMA
    // porta — ver `pararAutoBoss`, logo abaixo do bloco do HUD.
    pararAutoBoss,
    // O mesmo botão da faixa, quando quem olha é convidado: ele sai da party.
    sairDoAutoBossConvidado,
    /*
     * Abre a loja JÁ na prateleira certa, e com a busca preenchida.
     *
     * O HUD não pode chamar 'openStore' direto: 'panels.mjs' importa 'hud.mjs',
     * e importar de volta fecharia um ciclo. O verbo entra pelo contexto, que é
     * por onde o HUD já fala com o resto da tela.
     */
    abrirLojaEm: (secao, busca = '', destaque = null) => {
      openStore();
      panelCtx.tabs.storeSection = secao;
      panelCtx.tabs.storeBusca = busca;
      // O card que deve acender e rolar para a vista. Ver `storeDestaque`.
      panelCtx.tabs.storeDestaque = destaque;
      panelCtx.redraw?.();
    },
    // Qual caixa do deposito esta aberta — o shift na mochila guarda nela.
    caixaDoDepositoAberta,
    // O menu do botão direito no próprio personagem abre a ficha já na
    // aparência, e a conversa privada abre a aba do chat com o destinatário.
    abrirAparencia: () => openCharacter('look'),
    abrirChatPrivado: (nome) => {
      abrirConversa(nome);
      setVisible('chat', true);
    },
  });
  // O personagem e o catalogo entram junto: e' deles que sai a linha de
  // imbuements do balao (o que esta encaixado mora no personagem, por slot).
  initTooltip(() => state.items, () => state.character, () => state.catalog);
  // A lista de amigos chega uma vez ao entrar: é dela que sai o "+1" do ícone.
  send({ t: 'friends', action: 'list' });
  // O menu da engrenagem precisa avisar quantas janelas guardou.
  setNotice(notice);
  initInventory(panelCtx);
  /*
   * ---- Clicar num nome do chat abre a ficha da pessoa ----
   *
   * Um ouvinte só, na página inteira. Cada linha de chat marca o nome com
   * `data-quem` (ver `nomeComMarca`), e numa caçada chegam dezenas de linhas por
   * minuto: pendurar um `onclick` em cada uma seria um fechamento novo por
   * mensagem, todos vivos enquanto a linha estiver no histórico.
   */
  document.addEventListener('click', (evento) => {
    const alvo = evento.target.closest?.('[data-quem]');
    if (!alvo) return;
    const nome = alvo.dataset.quem;
    // O próprio nome não abre nada: a ficha é para saber do OUTRO.
    if (!nome || nome === state.character?.name) return;
    evento.preventDefault();
    // O evento vai junto: o menu nasce no ponto do clique. Ver `abrirPerfil`.
    abrirPerfil(nome, evento);
  });

  initSocial(panelCtx);
  initPanels(panelCtx);
  initArvore(panelCtx);
  initPassivas(panelCtx);
  initGemas(panelCtx);
  initGuildas(panelCtx);
  initChat(send);
  initActionBar(panelCtx);
  renderChat();
  buildTopbar();
  /*
   * A tela de jogo do telefone (celular.mjs). Ela não tem ação própria: cada
   * botão chama a mesma função do botão do computador, e o "Mais" monta a
   * barra de cima com o mesmo `ferramentaLigada`.
   */
  initCelular({
    state: () => state,
    ferramentaLigada,
    grupos: () => BARRA.filter(Boolean),
    extras: () => [
      ARENA,
      { id: 'market', label: 'Mercado', icone: 'market', abre: () => openMarket(),
        tip: 'Comprar e vender com outros jogadores.' },
      /*
       * O banco aqui, só no telefone. No computador ele abre pelo número do ouro
       * na barra de cima (o dono tirou o ícone de lá de propósito — ver `openBank`
       * na barra); no telefone o número vai para o canto do status e ninguém
       * adivinha que ele é um botão. Esta lista (`extras`) só existe no "Mais".
       */
      { id: 'banco', label: 'Banco', icone: 'banco', abre: () => openBank(),
        tip: 'Depositar, sacar e transferir ouro.' },
      !$('hud-promotion')?.hidden && { id: 'promotion', label: 'Promotion', icone: 'character', abre: () => openPromotion(),
        tip: $('hud-promotion-text')?.textContent ?? 'A promoção de vocação.' },
      novidadesDaVez?.itens?.length && { id: 'novidades', label: 'Novidades', icone: 'diario', abre: () => abrirNovidades(),
        tip: 'O que mudou nesta versão.' },
      { id: 'options', label: 'Opções', icone: 'options', abre: () => openBarSettings(),
        tip: 'Ajustes da interface, da barra de atalhos e dos gráficos.' },
      { id: 'reportar', label: 'Reportar bug', icone: 'quests', abre: () => openReport('bug'),
        tip: 'Achou um bug? Conte pra gente.' },
      { id: 'trocar', label: 'Trocar personagem', icone: 'logout', abre: () => confirmarSaida(),
        tip: 'Trocar de personagem ou sair da conta.' },
    ],
    abrirFicha: () => openCharacter('sheet'),
    abrirParty: () => openParty(),
    abrirAparencia: () => openCharacter('look'),
    sistemas: () => SISTEMAS,
    janelaAberta: (id) => isVisible(id),
    abrirJanela: (id) => setVisible(id, true, { gravar: false }),
    fecharJanela: (id) => esconderSemGravar(id),
    abrirLoja: () => openStore(),
    abrirHunts: () => openHunts(),
    pararCaca: () => send({ t: 'stopHunt' }),
    abrirChat: () => setVisible('chat', true, { gravar: false }),
    esconderJanela: (id) => esconderSemGravar(id),
    temAlerta: () => !faixaDeNovidades?.hidden || botoesEmAlerta.some(({ alerta }) => !!alerta()),
    acertarAnalogico: () => acertarOAnalogico?.(),
  });

  for (const id of ['loot', 'chat', 'analyzer', 'inventory']) {
    document.querySelector(`[data-toggle="${id}"]`)?.setAttribute('aria-selected', String(isVisible(id)));
  }

  /*
   * No modo "em janela", ela abre sozinha ao entrar.
   *
   * Sem isto, quem escolheu a janela e recarregou a página não veria NADA: as
   * pílulas estão desligadas por causa do modo, e a janela nasce fechada. Um
   * ajuste que funciona até a pessoa dar F5 é pior do que não existir.
   */
  if (modoDosEfeitos() === 'janela') setVisible('buffs', true);
}

/*
 * O tooltip dos botões é o do jogo.
 *
 * O `title` do navegador escrevia "Bestiary" numa caixinha branca do sistema,
 * com a fonte do sistema, meio segundo depois do mouse parar. Não é a fonte do
 * jogo nem o tempo do jogo, e o nome sozinho não diz o que vai acontecer. O
 * tooltip é o mesmo dos itens: mesma moldura, mesma fonte, na hora.
 */

/*
 * A barra de ferramentas, na ordem em que ela é lida.
 *
 * Uma lista só, e não duas com um separador no meio: o que define um grupo é o
 * assunto, não o tipo de janela que o botão abre. Prey, charms, proficiência e
 * imbuements andam juntos porque são os quatro sistemas do personagem — o
 * primeiro abre modal e o inventário abre janela flutuante, e isso não importa
 * para quem olha.
 *
 * `null` é um respiro entre grupos.
 *
 * Cada entrada diz o que faz de um jeito só:
 *   `abre`   — modal; o botão fica aceso enquanto ele está na tela
 *   `janela` — janela flutuante; o botão alterna e acende com ela
 *   `acao`   — nem uma coisa nem outra, como voltar para a cidade
 */
/*
 * ---- Quatro gavetas, e não vinte e um ícones em fila ----
 *
 * O dono: "vai ter o ícone sistemastopicone.png que ao clicar aparece embaixo
 * pra abrir os sistemas prey, forja, árvore, gemas, charms, proficiência e
 * imbuements... o social com o ícone socialiconetop.png que ao clicar aparece
 * amigos, party, ranking, chat... os que sobraram lá na topbar deixa por
 * enquanto".
 *
 * A fileira tinha vinte e um botões e já não cabia: `caberNaBarra` existe
 * inteiro para encolhê-los até caberem, e num notebook de 1366 eles chegavam
 * ao piso e a legenda saía. Encolher o desenho é tratar o sintoma — o problema
 * é que vinte e um alvos lado a lado não formam uma barra, formam uma parede,
 * e ninguém lê parede.
 *
 * Agrupar troca "vinte e um lugares para procurar" por "quatro perguntas":
 * o que MELHORA o personagem, o que É o personagem, o que ele DEVE, e quem
 * está com ele. Cada gaveta abre embaixo do próprio botão, como o menu de
 * qualquer jogo — é o desenho que o dono mandou de referência.
 *
 * O que ficou fora é o que não responde a nenhuma das quatro: banco, depósito,
 * hunts e a volta para a cidade. Eles são atalhos de uma coisa só, e um atalho
 * escondido atrás de um clique deixa de ser atalho.
 *
 * Cada lista é um `const` próprio, e não um array dentro do array: assim as
 * entradas continuam na mesma indentação em que foram escritas, e um `git
 * diff` deste dia mostra o que MUDOU de lugar em vez de mostrar tudo.
 */

/*
 * ---- Sistemas ----
 *
 * Os sete painéis em que o jogador gasta alguma coisa para ficar mais forte —
 * ponto de árvore, fragmento de gema, ponto de charm, ouro na forja. É o grupo
 * que já andava junto na fileira antiga; ganhou uma porta.
 */
const SISTEMAS = [
  { id: 'prey', label: 'Prey', abre: () => openPrey(),
    tip: 'Escolhe a presa de cada slot e o bônus que ela dá.',
    /*
     * O balão mostra as três presas ATIVAS, e não só o que o botão faz.
     *
     * "quando eu passar o mouse no ícone de prey, gemas, charms, proficiência,
     *  imbuements, tem que mostrar o que tenho ativo — igual o da árvore."
     *
     * Ele tem razão e a Árvore prova: essa é a pergunta que se faz o tempo todo
     * caçando, e ela estava a dois cliques.
     */
    corpo: () => resumoDoPreyParaBalao(),
    alerta: () =>
      (state.character?.prey ?? []).some((slot) => slot.state !== 'locked' && (!slot.key || slot.left <= 0)) },
  /*
   * ---- A Forja, ao lado do Prey ----
   *
   * Foi onde o dono pediu, e o lugar fecha: Prey, Forja, Árvore, Charms,
   * Proficiência e Imbuements são os painéis em que o jogador MELHORA o
   * personagem gastando alguma coisa. A forja gasta ouro; a vizinhança é essa.
   */
  { id: 'forja', label: 'Forja', abre: () => openForja(),
    tip: 'Sobe o tier de uma peça pagando só ouro, ou passa o tier de uma peça para outra.' },
  /*
   * ---- A Recompensa Diária saiu daqui ----
   *
   * "pode tirar o ícone de diário lá de cima da top bar e deixa dentro de
   *  tarefas mesmo, ao lado de level reward."
   *
   * Ela agora é uma aba de Tarefas (ver `openQuests`), ao lado do Level Reward
   * — as duas respondem à mesma pergunta. O alerta veio junto: ele passou para
   * o botão de Tarefas, senão a barra deixaria de avisar que há o dia para
   * pegar, e o caminho até a aba é um clique mais longo do que era.
   *
   * O baú da faixa de baixo continua sendo o atalho curto.
   */
  /*
   * A Árvore fica colada no Prey de propósito: são os dois painéis em que o
   * jogador GASTA algo que o level deu, e ele vai procurar os dois no mesmo
   * lugar. O alerta acende quando há ponto parado — ponto guardado não faz nada.
   */
  { id: 'arvore', label: 'Árvore', abre: () => openPassivas(),
    tip: 'A Árvore de Passivas: gasta os pontos que o level dá. Uma árvore só para todas as classes — cada uma começa num lugar e pode andar para qualquer região.',
    /*
     * O balão deste botão mostra o que a árvore JÁ DÁ, e não só o que ele faz.
     *
     * É a informação que o jogador procura o tempo todo enquanto caça — quanto
     * de dano, quanto de vida — e que estava a dois cliques (abrir o painel,
     * achar a lista). Passar o mouse é mais barato que isso.
     */
    corpo: () => resumoDasPassivasParaBalao(),
    alerta: () => (state.character?.passivas?.pontos?.livres ?? 0) > 0 },
  /*
   * O Gem Atelier logo depois da Árvore: as gemas acendem com os vessels que a
   * árvore enche, e as duas telas são lidas juntas. Ver `gemas.mjs`.
   */
  { id: 'gemas', label: 'Gem Atelier', curto: 'Gemas', abre: () => openGemas(),
    tip: 'Revela gemas, encaixa nos domínios da árvore e sobe o grau dos modificadores com fragmentos.',
    corpo: () => resumoDasGemasParaBalao() },
  { id: 'charms', label: 'Charms', abre: () => openCharms(),
    tip: 'Gasta os pontos que as mortes do bestiary liberam.',
    corpo: () => resumoDosCharmsParaBalao(),
    /*
     * Acende quando dá para comprar algum charm, não quando há ponto no bolso.
     *
     * O mais barato custa 100 pontos, e o saldo passa meses entre 1 e 99: com a
     * regra antiga o ícone ficava dourado a caçada inteira sem haver nada para
     * fazer, e um aviso que está sempre aceso deixa de ser aviso. `charmNext`
     * vem do servidor — é o menor preço entre os charms que ainda podem subir,
     * e é `null` quando todos já estão no máximo.
     */
    alerta: () =>
      state.character?.charmNext != null && (state.character?.charmPoints ?? 0) >= state.character.charmNext },
  { id: 'proficiency', label: 'Proficiência', curto: 'Profic.', abre: () => openProficiency(),
    tip: 'A árvore da arma que está na mão. Sobe caçando com ela.',
    corpo: () => resumoDaProficienciaParaBalao(),
    alerta: () => !!state.character?.proficiency?.levels?.some((passo) => passo.unlocked && passo.chosen == null) },
  { id: 'imbuements', label: 'Imbuements', curto: 'Imbuem.', abre: () => openImbuements(),
    tip: 'Encanta o equipamento: dano elemental, vida por golpe, velocidade.',
    corpo: () => resumoDosImbuementsParaBalao() },

];

/*
 * ---- Personagem ----
 *
 * O que o personagem É e o que ele carrega: a ficha, a mochila, o que ele
 * rendeu (análise), o que caiu (loot) e a enciclopédia. Na ordem que o dono
 * pediu.
 *
 * Duas destas abrem janela flutuante e três abrem modal, e isso não aparece
 * para quem olha — ver o comentário da BARRA, mais abaixo.
 */
const DO_PERSONAGEM = [
  { id: 'character', label: 'Personagem', curto: 'Ficha', abre: () => openCharacter(),
    tip: 'Atributos, equipamento, proficiência e aparência.' },
  { id: 'inventory', label: 'Inventário', curto: 'Mochila', janela: 'inventory',
    tip: 'Mostra ou esconde o que está vestido, com a capacidade.' },
  { id: 'analyzer', label: 'Analisador', curto: 'Análise', janela: 'analyzer',
    tip: 'Três analisadores numa janela só.',
    corpo: () => resumoDosAnalisadores() },
  { id: 'loot', label: 'Bolsa de loot', curto: 'Loot', janela: 'loot',
    tip: 'Mostra ou esconde o que caiu e ainda não foi vendido.' },
  /*
   * O Bestiary não tem botão próprio: ele é uma ABA da Cyclopedia.
   *
   * Eram dois ícones na barra para a mesma enciclopédia — um abria o bestiary
   * inteiro, o outro abria a mesma coisa numa aba do meio. Numa barra de vinte
   * botões, dois que levam ao mesmo lugar é ruído; o conteúdo não mudou de
   * lugar, só o caminho até ele encurtou para um.
   */
  { id: 'cyclopedia', label: 'Cyclopedia', abre: () => openCyclopedia(),
    tip: 'Bestiary, itens, equipamentos, magias e runas — com o que cai de quem.' },
];

/*
 * ---- Tarefas ----
 *
 * "o quests agora será renomeado como tarefas e usará esse ícone que já está
 *  de quests, e ao clicar embaixo apareceria level reward, recompensa diária,
 *  tasks, outfits, montarias — aí você pode separar essas abas que estavam em
 *  tarefas".
 *
 * As cinco abas da janela viraram cinco botões — e depois a janela se dividiu.
 *
 * "quando eu abrir tasks, só tem que aparecer no modal tasks e montarias; o
 *  level reward, recompensa diária e outfits não deve ficar no mesmo modal."
 *
 * Ele tem razão e a lista aqui explica por quê: das cinco, só duas são TASK —
 * uma conta de mortes que fecha e paga. As outras três são de naturezas
 * diferentes, e estavam juntas por acidente de arrumação. Hoje três delas abrem
 * janela própria (`openLevelReward`, `openDiario`, `openOutfits`) e duas
 * dividem a de Tarefas.
 *
 * Para quem olha a barra nada mudou: os cinco botões continuam aqui, e o
 * caminho até cada um continua sendo um clique.
 */
const TAREFAS = [
  { id: 'tarefas-recompensas', label: 'Level Reward', curto: 'Level Rw.', icone: 'aba-recompensas',
    /* A janela do calendário já existe: é a do presente da faixa de baixo. */
    abre: () => openPresente(),
    tip: 'O calendário de recompensas por level: o que já abriu e o que ainda falta.',
    alerta: () =>
      (state.character?.presentes?.pendentes ?? 0) + (state.character?.presentes?.marcosAbertos ?? 0) > 0 },
  { id: 'tarefas-diario', label: 'Recompensa Diária', curto: 'Diária', icone: 'diario',
    abre: () => openDiario(),
    tip: 'O baú do dia. Pegar em dias seguidos sobe o prêmio.',
    alerta: () => !!state.character?.diario?.podePegar || !!state.character?.diario?.pendente },
  { id: 'tarefas-tasks', label: 'Tasks', icone: 'aba-tasks', abre: () => openQuests('tasks'),
    tip: 'As boss tasks e as tasks de criatura: matar até a conta fechar.' },
  { id: 'tarefas-outfits', label: 'Outfits', icone: 'aba-outfits', abre: () => openOutfits(),
    tip: 'Entrega o loot que o bicho larga e leva a roupa — ou o addon dela.' },
  /*
   * ---- Montarias saiu daqui ----
   *
   * "pode tirar o ícone da montaria dali já que ele vai ter a página dentro de
   *  tasks sabe."
   *
   * Ele tem razão, e é a regra que o resto desta gaveta já segue: o que abre
   * JANELA PRÓPRIA ganha botão; o que é aba de outra janela chega pela aba. As
   * Tasks de Montarias são a segunda aba de Tarefas — com botão aqui, a gaveta
   * teria dois caminhos para a mesma janela, um deles passando por uma aba que
   * já está à vista do outro.
   */
];

/*
 * ---- Social ----
 *
 * Quem mais está aqui: a lista de amigos, o time, a tabela do servidor e as
 * conversas. Na ordem que o dono pediu.
 */
const SOCIAL = [
  { id: 'amigos', label: 'Amigos', abre: () => openFriends(),
    tip: 'A sua lista de amigos e a sua party: quem está online, onde está caçando e quem vai com você.' },
  /*
   * Sempre aceso, e não só com party montada.
   *
   * Ele acendia apenas quando já havia uma — e aí quem estava sozinho não tinha
   * por onde COMEÇAR uma. O botão é a porta de entrada: sem party, a janela
   * abre com a lista de amigos online e um convite em cada um.
   */
  { id: 'party', label: 'Party', janela: 'party',
    tip: 'Quem está no seu time — e, sem time, de onde convidar alguém.' },
  /*
   * ---- GUILDAS ----
   *
   * "faça um botao la pra abrir guilds em social."
   *
   * Aqui e nao numa aba propria da barra de cima: guilda e gente, e esta gaveta
   * ja' e a das pessoas — amigos, party, ranking. Uma aba nova na barra seria um
   * botao a mais no topo para uma janela que se abre uma vez por semana.
   *
   * Depois de Party e antes do Ranking, que e' a ordem do tamanho do grupo: os
   * amigos, o time, a guilda, o servidor.
   */
  { id: 'guildas', label: 'Guildas', abre: () => openGuildas(),
    tip: 'A sua guilda, os convites e a tabela das guildas do servidor.' },
  { id: 'ranking', label: 'Highscores', curto: 'Ranking', abre: () => openRanking(),
    tip: 'A tabela do servidor: level, skills e quem está na frente.' },
  { id: 'chat', label: 'Chat', janela: 'chat',
    tip: 'Mostra ou esconde as conversas e o registro da caçada.' },
];

/*
 * ---- O aviso da diária, à direita de Social ----
 *
 * "faz aparecer o ícone de recompensa diária ou recompensa pra pegar quando
 *  tiver, lá do lado de Social, à direita, chamativo — mas só quando tiver pra
 *  pegar. Quando não tiver pra pegar no dia, ele nem aparece ali." E, logo
 *  depois: "na verdade deixa só o botão de recompensa diária exposto na topbar;
 *  o de Level Reward deixa só em Tarefas mesmo."
 *
 * Ele tem razão, e a diferença entre os dois é de PRAZO. A diária vence hoje:
 * quem não a pegar antes da virada perde o dia e volta ao começo da sequência.
 * A recompensa de level não vence nunca — ela espera na janela de Tarefas o
 * tempo que for, e um aviso permanente na barra para uma coisa que não corre
 * risco é um aviso que se aprende a ignorar. E aviso ignorado estraga o outro,
 * que estava ali ao lado.
 *
 * Ele não faz parte de `BARRA` de propósito: `BARRA` é a fileira FIXA, a mesma
 * em toda sessão, e este existe só enquanto há o que pegar. Entra no fim,
 * depois do laço, e `pintarPresente` o acende e o apaga.
 *
 * O desenho é o MESMO da entrada de Tarefas, que continua lá intacta ("mas
 * deixe os ícones lá em Tarefas também ok, não mexe lá") — junto com o Level
 * Reward, que agora só existe por lá. É o mesmo botão em dois lugares com
 * papéis diferentes: em Tarefas é o caminho de quem foi procurar; aqui é o
 * aviso de quem não ia.
 */
const AVISOS_DA_BARRA = [
  {
    id: 'aviso-diario', label: 'Diária', icone: 'diario',
    abre: () => openDiario(),
    tip: 'O baú do dia está aberto. Pegar em dias seguidos sobe o prêmio.',
    /* Sempre aceso: o botão só existe quando há o que pegar, e o facho dourado
       é justamente o "chamativo" que o dono pediu. */
    alerta: () => true,
    corpo: () =>
      el(
        'p',
        'tip-aviso',
        state.character?.diario?.pendente
          ? 'Falta escolher o prêmio de hoje.'
          : 'A recompensa de hoje ainda não foi pega.'
      ),
  },
];

/*
 * ---- A fileira, junta e sem separadores ----
 *
 * "os ícones da top bar, você não precisa mais separar tanto eles, junta eles
 *  meio que no meio sem aquele pontinho que separa eles, só o Sair e Opções
 *  que você deixa lá no canto direito."
 *
 * Os `null` eram os pontinhos, e eles faziam sentido quando a fileira tinha
 * vinte e um botões: sem marcas, aquilo era uma parede. Com as gavetas sobraram
 * seis, e seis coisas não precisam de placa dizendo onde um grupo acaba — o
 * separador virou o ruído que ele existia para evitar.
 *
 * Opções e Sair continuam à direita, e agora encostados nela de verdade: eles
 * não abrem nada do jogo, e misturá-los ao meio seria pôr a porta de saída no
 * meio da sala. Ver `canto-da-barra`, em `buildTopbar`.
 */
/*
 * ---- Depósito ----
 *
 * "lá em Depósito na topbar vai ter uma setinha também, e aí embaixo vai ter
 *  Baú, que será o depósito padrão, Baú da conta, que será o baú compartilhado
 *  da conta, e Chegadas."
 *
 * São as abas de dentro da janela viradas para fora, como já é em Tarefas: a
 * aba continua existindo lá, e o que muda é chegar direto nela. As três
 * especiais eram o motivo do pedido — elas viviam misturadas na parede de
 * dezesseis caixas numeradas iguais (ver `ABAS_DO_DEPOSITO`, em panels.mjs).
 *
 * A Recompensa de Boss entrou junto, e não estava no pedido: ela é a mais
 * usada das quatro — é onde cai tudo o que os bosses deixam, e a tela de
 * vitória manda o jogador para lá por nome. Deixá-la de fora seria a única das
 * quatro abas sem porta.
 */
/*
 * Os quatro desenhos são os que o dono mandou desenhar de propósito para esta
 * gaveta (ver `tools/prompt-icones-deposito.txt`): cada um usa o `aba-<id>` da
 * aba que ele abre, que é a mesma arte dos dois lados. Antes eram emprestados —
 * o armário genérico servia de porta E de Baú, e um prédio de banco fazia as
 * vezes do Baú da Conta.
 */
const DO_DEPOSITO = [
  { id: 'deposito-bau', label: 'Baú', icone: 'aba-deposito', abre: () => openLocker('deposito'),
    tip: 'As suas caixas numeradas — onde você guarda o que não está carregando.' },
  /*
   * Sem `curto`: os nomes vão por extenso.
   *
   * "onde está escrito lá nos ícones só Conta, escreva Baú da Conta, e Boss,
   *  Recompensa de Boss."
   *
   * O `curto` existe para a FILEIRA, onde cada botão tem 52px e o nome cheio
   * viraria reticências. Dentro da gaveta não há essa briga — ela cresce com o
   * que tem dentro —, e ali "Boss" e "Conta" eram palavras soltas que só quem
   * já sabia entendia.
   */
  { id: 'deposito-recompensa', label: 'Baú de Boss', icone: 'aba-recompensa',
    abre: () => openLocker('recompensa'),
    tip: 'Uma sacola por boss derrotado. Cada uma tem prazo para ser recolhida.',
    alerta: () => (state.character?.rewards ?? []).length > 0 },
  { id: 'deposito-conta', label: 'Baú da Conta', icone: 'aba-conta',
    abre: () => openLocker('conta'),
    tip: 'A caixa da CONTA: o que você guardar nela aparece em todos os seus personagens.' },
  { id: 'deposito-chegadas', label: 'Chegadas', icone: 'aba-chegadas', abre: () => openLocker('chegadas'),
    tip: 'Onde chega o que você comprou, o que veio pelo correio e o que não coube na mochila.' },
];

/*
 * ---- Voltar para a cidade, no canto da direita ----
 *
 * "o botão voltar pra cidade (cidade) que fica lá na topbar, coloque ele à
 *  esquerda do botão opções."
 *
 * O canto já era o lugar do que TIRA o jogador de onde ele está: Opções e Sair.
 * A volta para a cidade é a mesma família — ela encerra a caçada — e no meio da
 * fileira ela era o único botão que às vezes apagava, abrindo um buraco entre
 * os vizinhos sempre que o jogador estava na cidade.
 *
 * É uma entrada solta e não parte de `BARRA` porque o canto é montado à mão,
 * depois do laço. Ver `buildTopbar`.
 */
/*
 * ---- A Arena, à ESQUERDA do Mercado ----
 *
 * "à esquerda de Mercado você vai criar um ícone chamado Arena, com esse ícone
 *  que tenho na área de trabalho, aba-arena.png, que ao clicar aparece tipo um
 *  lobby que eu consigo desafiar alguém pra um x1."
 *
 * Entrada SOLTA, e não parte de `BARRA`, pelo mesmo motivo da Cidade: o começo
 * da fileira é montado à mão, porque o Mercado é um nó que vem do index.html e
 * é movido para dentro dela (ver `buildTopbar`). Para ficar à esquerda dele, a
 * Arena tem de ser anexada ANTES — e isso acontece fora do laço.
 *
 * Ela não vira gaveta: hoje há uma arena só (a Livraria de Fogo) e a escolha de
 * qual entrar é do lobby, que também é onde mora o desafio. Uma gaveta com um
 * botão dentro seria uma porta para uma sala de uma porta.
 */
/*
 * ---- O balão da topbar conta o PRÊMIO, e não só o que a aba é ----
 *
 * "inclusive no modal que ao deixar o mouse no ícone arena x1 da topbar tem que
 *  informar melhor."
 *
 * Ele dizia "desafie alguém, lute e suba no ranking" — verdadeiro e sem
 * consequência nenhuma. Quem passa o mouse num ícone que nunca clicou está
 * decidindo se vale a pena entrar, e o que decide isso é o que se ganha: um
 * bônus de experiência e de loot que vale nas caçadas normais, fora da arena.
 *
 * Os números estão escritos aqui, e isso é uma escolha: a topbar é desenhada
 * antes de qualquer resposta do servidor (ela existe na tela de carregamento) e
 * não tem de onde tirar a tabela. Quem manda de verdade é o `?` de dentro da
 * janela, que lê `premiosDoPodio` do servidor — se um dia os prêmios mudarem,
 * este texto é o segundo lugar a mudar. As primeiras duas linhas, que são as
 * que importam, continuam valendo de qualquer jeito.
 */
const ARENA = {
  id: 'arena', label: 'Arena x1', icone: 'aba-arena', abre: () => openArena(),
  tip: [
    'Arena x1',
    'Desafie alguém para um duelo. Ninguém perde experiência nem item: vocês lutam com a mesma força, seja qual for o level.',
    'Cada vitória vale um ponto na SEMANA e sobe a sua patente; cada derrota tira um. A tabela zera toda sexta às 18h.',
    'Quem fica no topo da semana ganha bônus de experiência e de loot nas caçadas normais — o 1º leva +8% de cada.',
    'Cada duelo custa um ticket, e você recebe 5 por dia.',
  ].join('\n'),
};

const CIDADE = {
  id: 'city', label: 'Voltar para a cidade', curto: 'Cidade', acao: () => send({ t: 'stopHunt' }),
  tip: 'Encerra a caçada e traz o personagem de volta para Draevor.',
  ativo: () => !!state.hunt,
};

const BARRA = [
  /*
   * ---- O Banco não tem mais ícone: ele abre no DINHEIRO ----
   *
   * "o ícone de banco não vai mais existir, você coloca pra abrir o banco
   *  quando clicar no dinheiro que você tem — não retira as funções do banco,
   *  apenas retira o ícone dele da topbar."
   *
   * O número do ouro na barra já É o banco: ele mostra bolso mais banco
   * somados desde sempre (ver `renderTopbar`). Ter um ícone à parte para abrir
   * o que o número já conta era o mesmo assunto em dois lugares — e o gesto
   * novo é o que qualquer um tentaria primeiro.
   *
   * Nada do banco mudou: `openBank` é o mesmo, chamado de outro lugar.
   */
  /*
   * O deposito, primeiro da fila: onde ficam as coisas que o personagem nao
   * esta carregando. O gesto do armario na cidade continua valendo; este e' o
   * caminho que funciona de qualquer lugar.
   */
  { id: 'locker', label: 'Depósito', curto: 'Depósito', icone: 'deposito',
    tip: 'O baú de recompensa dos bosses, as suas caixas, o baú da conta e as Chegadas.',
    gaveta: DO_DEPOSITO },

  {
    id: 'sistemas', label: 'Sistemas', icone: 'sistemastopicone', reserva: 'gemas',
    tip: 'Prey, forja, árvore, gemas, charms, proficiência e imbuements.',
    gaveta: SISTEMAS },

  // Para onde ir. Como VOLTAR mora no canto da direita — ver `CIDADE`.
  { id: 'hunts', label: 'Hunts', abre: () => openHunts(),
    tip: 'Escolhe onde caçar — uma hunt só ou um ciclo delas.' },

  { id: 'personagem', label: 'Personagem', icone: 'character',
    tip: 'A ficha, a mochila, a análise da caçada, a bolsa de loot e a Cyclopedia.',
    gaveta: DO_PERSONAGEM },
  { id: 'tarefas', label: 'Tarefas', icone: 'quests',
    tip: 'Level reward, recompensa diária, tasks, outfits e montarias.',
    gaveta: TAREFAS },

  { id: 'social', label: 'Social', icone: 'socialiconetop', reserva: 'amigos',
    tip: 'Amigos, party, highscores e o chat.',
    gaveta: SOCIAL },
];

/** Miolo do tooltip de um botão: sprite grande, nome e a frase do que ele faz. */
function tipDeFerramenta({ label, tip, icone, glifo, corpo }) {
  const caixa = el('div', 'tip-tool');
  const topo = el('div', 'tip-tool-head');

  if (icone) {
    const arte = document.createElement('img');
    arte.src = icone;
    arte.alt = '';
    // Ícone que ainda não existe não deixa um retângulo quebrado no tooltip.
    arte.onerror = () => arte.remove();
    topo.append(arte);
  } else if (glifo) {
    topo.append(el('span', 'tip-tool-glyph', glifo));
  }

  topo.append(el('b', null, label));
  caixa.append(topo);
  if (tip) caixa.append(el('p', null, tip));
  // Alguns botões trazem estado no balão, e não só a frase do que fazem.
  const extra = corpo?.();
  if (extra) caixa.append(extra);
  return caixa;
}

/*
 * Ícones que ainda vêm da barra do client do usuário, e não do nosso set.
 *
 * Estava vazio de propósito: Amigos usava o `friends.png` de 20x20 puxado do
 * client dele, e um desenho de 20px esticado para 30 na barra ficava borrado
 * ao lado de vizinhos desenhados em 128. A arte de verdade veio na pasta
 * "novos icones" e entra pelo caminho normal (`icons/<id>.png`), pelo
 * `tools/novos-icones.mjs`.
 */
/*
 * Botões cujo desenho já existe em `client/assets/ui/`, e não no gerado.
 *
 * A busca normal é `assets/icons/<id>.png` e, se ele não existir,
 * `assets/ui/tb-<id>.png`. O ícone da party que o dono desenhou não segue
 * nenhum dos dois nomes — ele é `assets/ui/party.png` —, e sem esta linha a
 * cadeia de fallback esgotava nos dois palpites e o botão ficava quebrado.
 *
 * ---- E ele aponta para a versão de 128px, não para o original ----
 *
 * `party.png` é a arte-mestra: 1254x1254 e 1,7 MB. Os outros ícones da barra
 * têm 128x128 e uns 25 KB — o dela sozinha pesava mais do que os vinte
 * restantes somados, e todo jogador a baixava a cada visita para desenhá-la num
 * quadrado de 30 pixels.
 *
 * `tb-party.png` é a mesma arte reduzida (média de área, ver o script que a
 * gerou): 26 KB. O original fica no repositório para quando for preciso
 * redesenhar.
 */
const ICONE_DO_CLIENT = { party: 'tb-party' };

/*
 * A legenda usa o nome curto quando existe.
 *
 * "Voltar para a cidade" não cabe embaixo de um ícone de 30px, e cortado com
 * reticências não diz nada. O nome cheio continua no tooltip, que é onde há
 * espaço para ele.
 */
/*
 * ---- Nenhum ícone da barra fica fora da tela ----
 *
 * O dono: "ajusta pra nenhum ícone da topbar sair da visão".
 *
 * A fileira tinha largura fixa por botão, e a conta era refeita à mão a cada
 * botão novo — três vezes, cada uma com um número diferente (62, 56, 52) e cada
 * uma medida num monitor só. Quem jogasse num 1366 continuava perdendo os
 * últimos; quem jogasse num 2560 via a fileira sobrando espaço.
 *
 * ---- O que ele faz ----
 *
 * Mede o que a barra tem para dar (a largura dela menos o que os vizinhos —
 * marca, personagem, carteira, loja — já ocupam) e divide pelo número de
 * botões. O resultado vira `--largura-do-botao`, e o CSS o usa.
 *
 * O teto é 52, que é o tamanho em que a legenda respira; o piso é 34, abaixo do
 * qual a legenda deixa de ser legível e encolher mais seria trocar um problema
 * por outro. No piso a rolagem que já existe continua sendo a saída.
 *
 * Roda ao montar a barra e a cada mudança de tamanho da janela — inclusive a de
 * abrir o console do navegador, que é como a maioria dos relatos aparece.
 */
const LARGURA_MAXIMA_DO_BOTAO = 52;
/*
 * 28, e a legenda some antes disso.
 *
 * O piso existia em 34 para a legenda continuar legível, e num notebook de 1366
 * ele não bastava: a fileira pedia 33px por botão e sobravam 33px de rolagem.
 * Escolher entre "a legenda cabe" e "o botão aparece" é fácil — um botão que
 * está fora da tela não tem legenda nenhuma.
 *
 * Abaixo de `LARGURA_COM_LEGENDA` o nome sai e sobra o desenho, que é o que a
 * fileira era antes de ganhar legenda. O balão do hover continua dizendo o
 * nome, então nada se perde de verdade.
 */
const LARGURA_MINIMA_DO_BOTAO = 28;
const LARGURA_COM_LEGENDA = 40;

function caberNaBarra() {
  const nav = $('tools');
  if (!nav) return;
  /*
   * Todos os botões, e não só os filhos diretos: Opções e Sair passaram a
   * morar dentro da caixa do canto, e contar seis onde há oito faria cada
   * passo do laço encolher de menos.
   */
  const botoes = nav.querySelectorAll('button').length;
  if (!botoes) return;

  /*
   * ---- A régua é a SOBRA MEDIDA, e não uma conta ----
   *
   * A primeira versão somava tudo o que a barra tem — vizinhos, respiros,
   * separadores, bordas — e dividia. A conta parecia certa e errava por vinte e
   * seis pixels: sobra sempre alguma coisa que ela não conhece (a margem da
   * própria fileira, a borda de um vizinho, o arredondamento de cada largura
   * fracionária). Vinte e dois botões um pixel largos demais são vinte e dois
   * pixels do último para fora da tela.
   *
   * Então em vez de prever, MEDE-SE: o navegador já responde exatamente quanto
   * está sobrando (`scrollWidth - clientWidth`, o quanto a fileira precisaria
   * rolar). Encolhe pelo tanto que falta, mede de novo, e para quando couber.
   *
   * O laço é curto de propósito. Cada volta lê `scrollWidth`, o que obriga o
   * navegador a refazer o layout; oito voltas é mais do que o bastante para
   * chegar do máximo ao mínimo em passos de um pixel por botão, e é pouco o
   * bastante para não custar nada num evento de redimensionar.
   */
  const aplicar = (px) => {
    nav.style.setProperty('--largura-do-botao', `${px}px`);
    // Botão apertado fica só com o desenho. Ver `LARGURA_COM_LEGENDA`.
    nav.classList.toggle('sem-legenda', px < LARGURA_COM_LEGENDA);
    /*
     * O mercado é VIZINHO da fileira, e não filho dela — placa própria, ao lado
     * (ver index.html). Com a fileira em modo enxuto ele ficava sendo o único
     * desenho da barra com nome embaixo, o que lê como sobra de outro layout.
     */
    document.body.classList.toggle('barra-enxuta', px < LARGURA_COM_LEGENDA);
    /*
     * O desenho segue a largura, com um piso próprio: abaixo de 20px o ícone
     * vira uma mancha, e aí é melhor ele encostar nas bordas do botão.
     */
    nav.style.setProperty('--tamanho-do-icone', `${Math.max(20, Math.min(30, px - 22))}px`);
  };
  const sobrando = () => nav.scrollWidth - nav.clientWidth;

  /*
   * Começa do MÁXIMO em toda medição, e não do valor de antes.
   *
   * Sem isto a barra só sabia encolher: quem apertasse a janela e depois a
   * abrisse de novo ficaria com os botões miúdos para sempre, porque partindo
   * de um valor que já cabe o laço nunca teria motivo para crescer.
   */
  let largura = LARGURA_MAXIMA_DO_BOTAO;
  aplicar(largura);

  for (let volta = 0; volta < 8 && largura > LARGURA_MINIMA_DO_BOTAO; volta++) {
    const falta = sobrando();
    if (falta <= 0) break;
    largura = Math.max(LARGURA_MINIMA_DO_BOTAO, largura - Math.max(1, Math.ceil(falta / botoes)));
    aplicar(largura);
  }

  // O número final fica guardado só para quem quiser conferir de fora.
  nav.dataset.largura = String(largura);
  centrarNoBoneco();
}

/*
 * ---- A fileira centrada no BONECO, e não no vão ----
 *
 * O dono, corrigindo o pedido anterior: "os ícones da topbar que eu pedi pra
 * você centralizar, na verdade centralize na posição do boneco, no centro, só
 * que lá em cima".
 *
 * A diferença é real e não é capricho. Centrado no vão entre a loja e o Opções,
 * o bloco fica onde sobrou espaço — e o espaço da esquerda depende de quantos
 * dígitos o ouro tem naquele segundo. O olho do jogador não mora ali: mora no
 * personagem, que é desenhado no meio do `#map`. Centrado nele, a fileira cai
 * numa coluna que o jogador já está olhando, e para de andar de um lado para o
 * outro quando o ouro passa de sete dígitos.
 *
 * A conta é feita à mão porque as duas margens automáticas de antes só sabem
 * repartir a sobra em partes IGUAIS — e o centro do boneco quase nunca é o meio
 * do vão.
 *
 * `#map` e não `window.innerWidth / 2`: é o `#map` que desenha o boneco no meio
 * dele mesmo, e no dia em que o mapa deixar de ocupar a tela inteira esta conta
 * continua certa sem ninguém lembrar de mexer aqui.
 */
function centrarNoBoneco() {
  const nav = $('tools');
  if (!nav) return;
  const canto = nav.querySelector('.canto-da-barra');
  const primeiro = nav.querySelector('button');
  if (!primeiro) return;

  // Mede com a margem zerada: com ela posta, a medida seria a de antes.
  primeiro.style.marginLeft = '0px';

  /*
   * Os escondidos ficam de fora da medida.
   *
   * O aviso da diária (ver `AVISOS_DA_BARRA`) fecha a fileira e passa quase
   * todo o dia com `hidden`. Um elemento escondido devolve um retângulo de
   * zeros, e como ele é o ÚLTIMO, a borda direita da fileira saía
   * como 0 — largura negativa, e a centragem desistia. A barra ficava encostada
   * na esquerda até alguém redimensionar a janela com um aviso aceso.
   */
  const doMeio = [...nav.children].filter((no) => no !== canto && no.getBoundingClientRect().width > 0);
  if (!doMeio.length) return;
  const esquerda = doMeio[0].getBoundingClientRect().left;
  const direita = doMeio[doMeio.length - 1].getBoundingClientRect().right;
  const largura = direita - esquerda;
  if (largura <= 0) return;

  const mapa = $('map')?.getBoundingClientRect();
  const boneco = mapa && mapa.width > 0 ? mapa.left + mapa.width / 2 : window.innerWidth / 2;

  /*
   * O empurrão nunca é negativo e nunca passa do que sobra: puxar para a
   * esquerda esconderia o primeiro botão atrás da loja, e empurrar demais
   * comeria o canto da direita — os dois transformariam "centralizar" em
   * "sumir com um botão".
   */
  const sobra = canto ? canto.getBoundingClientRect().left - direita : nav.getBoundingClientRect().right - direita;
  const empurrao = Math.max(0, Math.min(boneco - largura / 2 - esquerda, Math.max(0, sobra)));
  primeiro.style.marginLeft = `${Math.round(empurrao)}px`;
}

/*
 * A janela mudou de tamanho: a conta é refeita. `requestAnimationFrame` porque
 * o `resize` chega antes de o navegador ter aplicado o novo layout, e medir ali
 * devolveria a largura antiga.
 */
window.addEventListener('resize', () => requestAnimationFrame(caberNaBarra));

/*
 * ---- E a cada vez que os VIZINHOS mudam de tamanho ----
 *
 * A primeira medição, feita ao montar a barra, mede vizinhos que ainda não
 * terminaram: a marca e o retrato são imagens, e uma imagem sem tamanho ainda
 * ocupa zero. A sobra saía grande demais, os botões ficavam no tamanho máximo e
 * a fileira estourava — medido, 29px de rolagem num monitor de 1920, que é
 * exatamente o tipo de "quase cabe" que ninguém percebe existir.
 *
 * O observador resolve isso sem adivinhar quando parar de esperar: ele dispara
 * quando a barra ou qualquer vizinho muda de tamanho, seja porque a imagem
 * carregou, porque o nome do personagem entrou ou porque o ouro passou de seis
 * dígitos.
 */
if (typeof ResizeObserver === 'function') {
  const olho = new ResizeObserver(() => caberNaBarra());
  const ligar = () => {
    const barra = $('topbar');
    if (!barra) return;
    olho.observe(barra);
    for (const filho of barra.children) if (filho.id !== 'tools') olho.observe(filho);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar);
  else ligar();
}

function toolButton({ id, label, tip, curto, corpo, icone, reserva, semBalao = false }) {
  const button = el('button');
  // Sem `title`: o do navegador apareceria por cima do nosso.
  button.setAttribute('aria-label', label);

  /*
   * ---- A fila de desenhos, do melhor ao que sempre existe ----
   *
   * Eram dois palpites; agora são quatro, e os dois novos existem por motivos
   * diferentes:
   *
   *   `icone`   — o botão usa o desenho de OUTRO nome. É o caso dos grupos
   *               (Tarefas usa o antigo `quests.png`) e o das abas de Tarefas,
   *               que reaproveitam o ícone que a própria aba já tem;
   *   `reserva` — o desenho pedido ainda não existe no repositório. Os dois
   *               ícones novos da barra (`sistemastopicone`, `socialiconetop`)
   *               são arte que o dono ainda vai pôr na pasta, e até lá o botão
   *               tem de aparecer inteiro em vez de um retângulo quebrado.
   *               Quando o arquivo chegar, ele passa a valer sozinho — não há
   *               nada para mudar aqui.
   */
  const candidatos = [];
  if (icone) candidatos.push(`/client/assets/icons/${icone}.png`);
  if (ICONE_DO_CLIENT[id]) candidatos.push(`/client/assets/ui/${ICONE_DO_CLIENT[id]}.png`);
  candidatos.push(`/client/assets/icons/${id}.png`);
  if (reserva) candidatos.push(`/client/assets/icons/${reserva}.png`);
  candidatos.push(`/client/assets/ui/tb-${id}.png`);

  const icon = document.createElement('img');
  icon.className = 'icon';
  icon.alt = '';
  let tentativa = 0;
  icon.src = candidatos[0];
  icon.onerror = () => {
    tentativa += 1;
    if (tentativa >= candidatos.length) {
      icon.onerror = null;
      return;
    }
    // Os `tb-` são arte de 20px do client do usuário: pixelada e menor.
    if (candidatos[tentativa].includes('/ui/tb-')) button.classList.add('fallback');
    icon.src = candidatos[tentativa];
  };
  button.append(icon, el('span', 'label', curto ?? label));
  /*
   * ---- O botão de grupo NÃO tem balão ----
   *
   * "quando eu passar o mouse em cima não pode tampar o conteúdo dos ícones que
   *  abrem automaticamente."
   *
   * Ele mandou a foto: o balão de "Personagem" abrindo por cima da gaveta de
   * Personagem, tapando justamente os cinco botões que o hover acabou de
   * mostrar. Os dois respondem à mesma pergunta — "o que há aqui dentro?" — e a
   * gaveta responde melhor, porque nela dá para clicar.
   */
  if (!semBalao) tipPanel(button, () => tipDeFerramenta({ label, tip, icone: icon.src, corpo }));
  return button;
}

/*
 * O "+1" no ícone de Amigos.
 *
 * Um pedido de amizade chega enquanto o jogador está fazendo outra coisa, e ele
 * não vai abrir a lista para descobrir. O contador fica pendurado no ícone até
 * ele responder — e some no instante em que responde, porque o servidor manda a
 * lista nova junto.
 */
/*
 * ---- Abrir os pacotes de coins de qualquer lugar ----
 *
 * `abrirObterCoins` desiste em silêncio sem `state.store` (é a primeira linha
 * dela), e o catálogo só chega quando alguém abre a loja. Pelo rodapé da loja
 * isso nunca aparecia — lá o catálogo já estava em mãos; a partir da barra de
 * cima, o primeiro clique não faria nada e o segundo funcionaria, que é o pior
 * tipo de defeito: o que a pessoa aprende a contornar sozinha.
 *
 * Então: tem catálogo, abre; não tem, pede e abre quando ele chegar (ver o
 * `case 'store'`).
 */
let esperandoAsCoins = false;

function pedirDraevorCoins() {
  if (state.store) return void abrirObterCoins();
  esperandoAsCoins = true;
  send({ t: 'store' });
}

function marcarPedidosDeAmizade() {
  const quantos = (state.friends?.pedidos ?? []).length;
  /*
   * Dois botões, e o segundo é o que importa.
   *
   * Amigos mudou de casa: ele agora mora dentro da gaveta de Social, que fica
   * fechada quase o tempo todo. Um "+1" pendurado num botão que só aparece
   * depois de abrir a gaveta não avisa nada — é preciso avisar na PORTA.
   */
  for (const botao of document.querySelectorAll('[data-tool="amigos"], #tools [data-tool="social"]')) {
    let selo = botao.querySelector('.badge-pedidos');
    if (!quantos) {
      selo?.remove();
      continue;
    }
    if (!selo) {
      selo = el('i', 'badge-pedidos');
      botao.append(selo);
    }
    selo.textContent = `+${quantos}`;
    selo.title = quantos === 1 ? '1 pedido de amizade' : `${quantos} pedidos de amizade`;
  }
}

/*
 * ---- As gavetas: uma aberta de cada vez ----
 *
 * Elas moram no `body`, e não dentro da fileira, por uma razão medida e não
 * estética: `.tools` tem `overflow-y: hidden` (é o que impede a rolagem
 * horizontal de virar vertical), e qualquer coisa posicionada para BAIXO de um
 * botão seria cortada na borda da barra. De fora, `position: fixed` com a
 * esquerda calculada a partir do botão coloca a gaveta exatamente onde ela
 * parece estar presa.
 *
 * O preço é ter de fechá-las na mão: em qualquer clique fora, no Esc, quando a
 * janela muda de tamanho e quando a barra de cima se recolhe.
 */
const gavetasDaBarra = [];
let gavetaAberta = null;

function fecharGaveta() {
  segurarAGaveta();
  if (!gavetaAberta) return;
  gavetaAberta.caixa.hidden = true;
  gavetaAberta.botao.classList.remove('com-gaveta-aberta');
  gavetaAberta = null;
}

/**
 * Encosta a gaveta embaixo do botão, centrada nele e sem sair da tela.
 *
 * A largura é lida DEPOIS de mostrar (uma caixa escondida mede zero), e o
 * `visibility` evita que ela pisque no canto esquerdo no quadro entre uma
 * coisa e outra.
 */
function encostarGaveta(botao, caixa) {
  const onde = botao.getBoundingClientRect();
  caixa.style.visibility = 'hidden';
  caixa.style.left = '0px';
  const largura = caixa.offsetWidth;
  const centrada = onde.left + onde.width / 2 - largura / 2;
  const x = Math.max(6, Math.min(centrada, window.innerWidth - largura - 6));
  caixa.style.left = `${Math.round(x)}px`;
  caixa.style.top = `${Math.round(onde.bottom + 5)}px`;
  caixa.style.visibility = '';
}

function abrirGaveta(botao, caixa) {
  if (gavetaAberta?.caixa === caixa) return;
  fecharGaveta();
  caixa.hidden = false;
  botao.classList.add('com-gaveta-aberta');
  gavetaAberta = { botao, caixa };
  encostarGaveta(botao, caixa);
}

function alternarGaveta(botao, caixa) {
  // Clicar de novo no mesmo botão fecha: é o gesto de qualquer menu.
  if (gavetaAberta?.caixa === caixa) return void fecharGaveta();
  abrirGaveta(botao, caixa);
}

/*
 * ---- E o passar do mouse já abre ----
 *
 * "faz de eu só passar o mouse em cima dos ícones principais lá da topbar que
 *  têm setas pra ver as coisas, não precisar necessariamente do click."
 *
 * O clique continua valendo — ele é o que PRENDE a gaveta aberta (quem chegou
 * clicando não a perde ao tirar o mouse de cima, ver `presaPeloClique`). O
 * hover é o caminho rápido: correr o mouse pela fileira mostra o que há atrás
 * de cada porta sem gesto nenhum.
 *
 * O fechar é adiado por um instante de propósito. Entre o botão e a gaveta há
 * 5px de vão, e atravessá-lo dispara `pointerleave` antes de o `pointerenter`
 * da gaveta chegar: sem a folga, a gaveta fecharia na cara de quem está indo
 * até ela. A ponte invisível do CSS (`.gaveta-da-barra::before`) cobre o vão, e
 * a espera cobre o resto.
 */
const ESPERA_PARA_FECHAR = 140;
let relogioDeFechar = null;

function segurarAGaveta() {
  clearTimeout(relogioDeFechar);
  relogioDeFechar = null;
}

function fecharSeOMouseSaiu(caixa) {
  segurarAGaveta();
  relogioDeFechar = setTimeout(() => {
    if (gavetaAberta?.caixa !== caixa) return;
    // Quem chegou clicando fica: o hover não desfaz uma escolha deliberada.
    if (gavetaAberta.presaPeloClique) return;
    if (caixa.matches(':hover') || gavetaAberta.botao.matches(':hover')) return;
    fecharGaveta();
  }, ESPERA_PARA_FECHAR);
}

/*
 * Na CAPTURA, e em `pointerdown` e não em `click`.
 *
 * Um clique no mapa vira `walkTo`, e o mapa ouve `pointerdown`: fechando só no
 * `click` a gaveta continuaria aberta por cima enquanto o personagem já estava
 * andando. Na captura ela some antes de qualquer outro ouvinte responder.
 */
document.addEventListener('pointerdown', (evento) => {
  if (!gavetaAberta) return;
  if (gavetaAberta.caixa.contains(evento.target) || gavetaAberta.botao.contains(evento.target)) return;
  fecharGaveta();
}, true);
// Sem `stopPropagation`: o Esc continua fechando o modal de trás, se houver.
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') fecharGaveta();
});
// Mudou o tamanho da tela, a gaveta estaria pendurada no lugar antigo.
window.addEventListener('resize', fecharGaveta);

/** Um botão da fileira, já ligado ao que ele faz. Serve dentro da gaveta também. */
function ferramentaLigada(entry) {
  const button = toolButton(entry);
  button.dataset.tool = entry.id;
  if (entry.ativo) botoesCondicionais.push({ button, ativo: entry.ativo });
  if (entry.alerta) botoesEmAlerta.push({ button, alerta: entry.alerta });

  if (entry.janela) {
    button.classList.add('toggle');
    button.dataset.toggle = entry.janela;
    button.setAttribute('aria-selected', String(isVisible(entry.janela)));
    button.onclick = () => {
      toggleWindow(entry.janela);
      button.setAttribute('aria-selected', String(isVisible(entry.janela)));
    };
  } else {
    button.onclick = () => {
      if (entry.acao) return void entry.acao();
      abertoPor = entry.id;
      marcarAbertos();
      entry.abre();
    };
  }
  return button;
}

/*
 * `resumoDaGaveta` morava aqui e foi apagada junto com o balão do botão de
 * grupo: a gaveta É o resumo, e melhor — nela dá para clicar. Ver `semBalao`,
 * em `toolButton`.
 */
function buildTopbar() {
  const nav = $('tools');

  /*
   * ---- O Mercado passa a ser o primeiro da FILEIRA ----
   *
   * "o de mercado a esquerda do deposito."
   *
   * Ele era vizinho da fileira e nao filho dela — placa propria, colada na
   * Store. Com a fileira centrada no boneco, sobrou um vao entre os dois:
   * o Mercado ficava sozinho la atras e o Deposito comecava a meia tela de
   * distancia.
   *
   * O no e o MESMO do index.html: movido, nao recriado. Assim o `onclick` dele
   * (em `$('market-button').onclick`) e o `aria-selected` que a janela do
   * mercado acende continuam valendo sem ninguem religar nada.
   *
   * Ele e lido ANTES de esvaziar a fileira: numa segunda montagem ele ja esta
   * aqui dentro, e o `innerHTML = ''` o levaria junto.
   */
  const mercado = $('market-button');
  nav.innerHTML = '';
  /* A Arena abre a fileira, à esquerda do Mercado. Ver `ARENA`. */
  nav.append(ferramentaLigada(ARENA));
  if (mercado) nav.append(mercado);
  /*
   * ---- Os dois catálogos que o BALÃO precisa ----
   *
   * Prey, proficiência e imbuements viajam na atualização do personagem; charms
   * e gemas não — eles são pedidos, e quem pedia era o painel ao abrir. O balão
   * do ícone ficaria vazio até alguém abrir o painel uma vez, que é exatamente
   * a viagem que ele existe para poupar.
   *
   * Um pedido de cada, uma vez, ao montar a barra.
   */
  send({ t: 'charms' });
  send({ t: 'gemas' });
  // As gavetas moram no `body`: montar a barra de novo não pode deixar as
  // antigas penduradas lá.
  for (const velha of document.querySelectorAll('.gaveta-da-barra')) velha.remove();
  gavetasDaBarra.length = 0;
  gavetaAberta = null;

  /*
   * O botão fica aceso enquanto a janela dele está aberta.
   *
   * Para janela flutuante isso já existia — `aria-selected` acende o halo. Para
   * modal não havia marca nenhuma: com o bestiary aberto, o ícone dele ficava
   * igual ao dos fechados. `abertoPor` guarda quem mandou abrir e o
   * `closeModal` apaga.
   */
  for (const entry of BARRA) {
    if (!entry) {
      nav.append(el('span', 'divider'));
      continue;
    }

    /*
     * ---- Um grupo: o botão é uma porta, e não uma ferramenta ----
     *
     * Ele não abre janela nenhuma; abre a fileira de baixo. Por isso não entra
     * em `abertoPor` — quem acende é o que estiver aberto LÁ DENTRO, e essa
     * conta é refeita em `marcarAbertos`.
     */
    if (entry.gaveta) {
      const caixa = el('div', 'gaveta-da-barra');
      caixa.hidden = true;
      caixa.dataset.gaveta = entry.id;
      for (const dentro of entry.gaveta) {
        const filho = ferramentaLigada(dentro);
        // Escolheu: a gaveta sai da frente. Depois do `onclick`, que já rodou.
        filho.addEventListener('click', () => fecharGaveta());
        caixa.append(filho);
      }
      document.body.append(caixa);

      const porta = toolButton({ ...entry, semBalao: true });
      porta.dataset.tool = entry.id;
      porta.classList.add('grupo');
      porta.setAttribute('aria-haspopup', 'true');
      porta.onclick = () => {
        alternarGaveta(porta, caixa);
        // Clicou: a gaveta fica até um clique fora, o Esc ou outra porta.
        if (gavetaAberta) gavetaAberta.presaPeloClique = true;
      };
      porta.addEventListener('pointerenter', (evento) => {
        // Só mouse: no toque, `pointerenter` chega junto com o clique e os dois
        // brigariam — abrir e fechar no mesmo gesto.
        if (evento.pointerType === 'touch') return;
        segurarAGaveta();
        abrirGaveta(porta, caixa);
      });
      porta.addEventListener('pointerleave', () => fecharSeOMouseSaiu(caixa));
      caixa.addEventListener('pointerenter', segurarAGaveta);
      caixa.addEventListener('pointerleave', () => fecharSeOMouseSaiu(caixa));

      /*
       * O facho dourado do grupo é o dos filhos, somado.
       *
       * Sem isto, ter ponto de árvore para gastar deixaria de aparecer na barra
       * no instante em que a Árvore entrou na gaveta — o aviso existiria, mas
       * atrás de uma porta fechada, que é o mesmo que não existir.
       */
      const comAlerta = entry.gaveta.filter((dentro) => dentro.alerta);
      if (comAlerta.length) {
        botoesEmAlerta.push({ button: porta, alerta: () => comAlerta.some((dentro) => dentro.alerta()) });
      }

      gavetasDaBarra.push({ entry, botao: porta, caixa });
      nav.append(porta);
      continue;
    }

    nav.append(ferramentaLigada(entry));
  }

  /*
   * O aviso fecha a fileira, à direita de Social. Nasce escondido: quem o
   * acende é `pintarPresente`, no primeiro estado que chegar.
   */
  for (const aviso of AVISOS_DA_BARRA) {
    const botao = ferramentaLigada(aviso);
    botao.classList.add('aviso-da-barra');
    botao.hidden = true;
    nav.append(botao);
  }

  caberNaBarra();

  // O botão da cidade acende só quando há caçada para encerrar.
  const marcarCondicionais = () => {
    for (const { button, ativo } of botoesCondicionais) button.disabled = !ativo();
    for (const { button, alerta } of botoesEmAlerta) {
      const acende = !!alerta();
      button.classList.toggle('alerta', acende);
      // O facho que gira em volta do botão (ver "ANIMAÇÕES LEVES", no style.css).
      if (acende) garantirFacho(button);
    }
  };
  marcarCondicionais();
  atualizarBotoes = marcarCondicionais;

  /*
   * O botão de sair fica no fim, separado dos outros: ele não abre nada do
   * jogo, sai dele.
   */
  const doCanto = (id, glifo, label, tip) => {
    const button = el('button', null, glifo);
    button.setAttribute('aria-label', label);
    const arte = document.createElement('img');
    arte.className = 'icon';
    arte.src = `/client/assets/icons/${id}.png`;
    arte.alt = '';
    const legenda = el('span', 'label', label);
    arte.onload = () => {
      // Só troca o glifo pelo desenho quando o desenho chega de verdade.
      button.textContent = '';
      button.append(arte, legenda);
    };
    arte.onerror = () => {
      arte.remove();
      // Sem desenho fica o glifo, e a legenda vai junto: a fileira precisa
      // ficar alinhada mesmo quando um ícone falta.
      button.append(legenda);
    };
    tipPanel(button, () =>
      tipDeFerramenta({ label, tip: tip(), icone: arte.parentElement ? arte.src : null, glifo })
    );
    return button;
  };

  /*
   * Um botão só para sair, e ele sai do PERSONAGEM.
   *
   * Havia dois lado a lado, quase iguais no desenho: "trocar de personagem" e
   * "sair da conta" — e o segundo derrubava a conta inteira com um clique, sem
   * perguntar nada. Quem queria só trocar de personagem e errava o alvo caía na
   * tela de login.
   *
   * Agora "Sair" pergunta e devolve para a lista de personagens, com a conta
   * ainda aberta. Sair da conta de verdade é um botão DA lista de personagens,
   * que é onde essa decisão faz sentido.
   */
  const exit = doCanto('logout', '⏻', 'Sair', () =>
    'Volta para a lista de personagens da conta. A caçada é encerrada e salva.'
  );
  exit.onclick = () => confirmarSaida();

  /*
   * Opções, à ESQUERDA do Sair.
   *
   * Os ajustes da tela viviam só na engrenagem do canto da barra de ações — um
   * botão de 18px escondido acima dos slots, que ninguém acha sem procurar. Ele
   * continua lá; aqui em cima está o mesmo modal, no lugar em que qualquer
   * jogo põe as opções: no fim da fileira, junto do sair.
   */
  const opcoes = doCanto('options', '⚙', 'Opções', () =>
    'Arranjo das janelas, encaixe da ficha e a barra de ações.'
  );
  opcoes.onclick = () => openBarSettings();

  /*
   * Opções antes de Sair.
   *
   * Sair é o último botão da fileira porque é o único que tira o jogador do
   * jogo: o que fecha vai no fim, e o que ajusta vem antes dele. Estavam
   * trocados.
   */
  /*
   * E os dois vão num canto próprio, empurrado para a direita.
   *
   * A fileira deixou de ser `space-between` e passou a ser centrada (ver o CSS
   * de `.tools`): sem esta caixa, Opções e Sair ficariam colados no meio junto
   * com o resto, que é exatamente o que o dono não quis. O `margin-left: auto`
   * dela come toda a sobra e joga os dois para a borda.
   */
  const canto = el('span', 'canto-da-barra');
  /* Cidade, Opções, Sair: os três que tiram o jogador de onde ele está. */
  canto.append(ferramentaLigada(CIDADE), opcoes, exit);
  nav.append(canto);
}

/*
 * ---- "Você morreu" ----
 *
 * A morte era um aviso de canto, do mesmo tamanho de "venda automática: +120
 * gold": três segundos e sumia. Perder um level e meio e voltar para a cidade
 * não é um recado de canto — é o acontecimento mais importante de uma sessão, e
 * o jogador tem de ver o que aconteceu, quanto custou e para onde ele foi.
 *
 * A caixa toma a tela porque o personagem já não está mais fazendo nada: ele
 * está no templo. Ela fecha sozinha quando a caçada volta, e antes disso o
 * relógio conta essa volta — assim ninguém fica esperando sem saber o quê.
 *
 * A tela não decide nada aqui: quem tira o personagem da caverna, quem o põe no
 * templo e quem o manda de volta é o servidor. Isto é o retrato disso.
 */
/*
 * ---- "Parabens, voce derrotou X" ----
 *
 * Derrubar um boss e o unico acontecimento do jogo que so acontece uma vez por
 * dia por boss, e ele estava saindo do mesmo jeito que "comprou uma potion":
 * uma linha de `notice` no canto, que some em tres segundos e some tambem se
 * outro aviso chegar antes.
 *
 * O dono pediu uma mensagem bonita E pediu que ela nao precise ser fechada. Sao
 * duas exigencias, e a segunda manda no desenho: nada de botao, nada de modal
 * que trave o jogo por tras. A faixa entra por cima da tela, fica um tempo e
 * sai sozinha — e some antes se o jogador clicar, porque quem ja leu nao deve
 * esperar.
 */
const TEMPO_DA_FAIXA_DE_VITORIA = 6500;


/*
 * ---- A TELA DE FIM DE LUTA DA ARENA ----
 *
 * O dono: "aparece na tela uma janela de vitoria e derrota, e informando o
 * ranking adquirido, as moedas ou perdido."
 *
 * ---- Por que ela e' UMA tela e nao duas ----
 *
 * Vitoria e derrota mostram exatamente as mesmas cinco coisas — contra quem,
 * quantos pontos, quanto de moeda, a patente e o placar — e so o SINAL muda. Um
 * par de funcoes seria duas copias da mesma tela, e a segunda envelheceria: o
 * dia em que a vitoria ganhasse uma linha nova, a derrota ficaria sem ela.
 *
 * O que muda e' a cor, o titulo e o verbo. E' pouco, e e' exatamente o que uma
 * variante de classe resolve.
 *
 * ---- O que ela responde, e por que nessa ordem ----
 *
 *   1. ganhei ou perdi, e de quem. E' a primeira pergunta e ela ocupa o topo;
 *   2. o que mudou no placar — em DIFERENCA ("6 -> 7"), porque um numero
 *      absoluto nao responde "o que esta luta me rendeu";
 *   3. a patente, e so quando ela MUDOU. Mostrar "Bronze" depois de toda luta
 *      seria repetir o que o lobby ja diz; mostrar "subiu para Prata" e' a
 *      unica vez em que a patente e noticia;
 *   4. o level de volta. Essa linha e para o perdedor, e ela nao e decoracao:
 *      quem acabou de lutar com o corpo de um level 400 tem todo direito de
 *      querer ver, escrito, que voltou ao dele.
 *
 * Ela NAO some sozinha rapido: quinze segundos, e um clique fecha. A faixa de
 * boss some em seis e meio porque o jogo continua atras dela; aqui a luta
 * acabou e a pessoa esta de pe na cidade, sem nada disputando a atencao.
 */
const TEMPO_DA_TELA_DE_ARENA = 15000;

/* =========================================================================
 * A LARGADA DA ARENA
 *
 * "quando os desafiantes entrar na arena o modal da arena tem que fechar
 *  sozinho — fecha sozinho e os 2 entra e aparece um contador na tela, uma
 *  contagem regressiva do 5 ate 1 e depois Derrote-o."
 *
 * Quem manda é o servidor, num campo só: `hunt.largadaEm`, os milissegundos que
 * FALTAM. Não há recado avulso de "começou a contagem" por um motivo prático —
 * quem cair e voltar no meio dela receberia o recado tarde demais ou nunca, e
 * entraria num duelo já em andamento sem saber. O número que falta chega em
 * todo quadro de estado, então a contagem se conserta sozinha.
 *
 * A trava de andar e bater NÃO mora aqui. Ela é do servidor (`naLargada`, no
 * hunt.mjs); esta tela só desenha. Um cliente alterado que apagasse este
 * arquivo inteiro continuaria sem conseguir dar um passo.
 * ========================================================================= */

/*
 * O servidor tranca por 6 segundos e a tela conta 5.
 *
 * O segundo que sobra é da cortina de viagem (`VIAGEM_MINIMO`, 1100ms), que
 * cobre a troca de mapa. Contar por baixo da cortina faria o jogador ver a
 * contagem começar no 4 — o número aparece no instante em que ela levanta.
 */
const LARGADA_VISIVEL = 5000;
/* Quanto "Derrote-o!" fica na tela depois do 1. */
const LARGADA_FRASE_MS = 1300;

let largadaAte = 0;
let largadaQuadro = null;
let largadaNumero = null;

function esconderLargada() {
  if (largadaQuadro) cancelAnimationFrame(largadaQuadro);
  largadaQuadro = null;
  largadaAte = 0;
  largadaNumero = null;
  document.getElementById('arena-largada')?.remove();
}

/*
 * Chamada a cada quadro de estado com o que falta. Zero quer dizer "não há
 * largada" — e é o que chega em toda caçada normal, o tempo todo: por isso a
 * primeira linha sai fora sem tocar em nada.
 */
function acertarLargada(falta) {
  if (!falta || falta <= 0) {
    /*
     * A contagem nao some no zero: ela vira "Derrote-o!" e fica um segundo.
     * Quem se apaga aqui e so quem nunca chegou ao fim — sair da arena no meio,
     * morrer, cair a conexao.
     *
     * ---- E a folga de 250ms nao e enfeite ----
     *
     * No instante em que a contagem acaba, o servidor passa a mandar zero. O
     * relogio do navegador foi acertado pelo ultimo quadro, que pode ter
     * chegado 40ms antes com 50ms de sobra — e ai `largadaAte` ainda esta no
     * futuro quando o zero chega. Sem a folga, o primeiro quadro de depois da
     * largada apagaria justamente o "Derrote-o!", que e a unica parte que o
     * jogador precisa ler.
     *
     * Quem sai da arena no meio esta sempre a mais de um quarto de segundo do
     * fim; e se nao estiver, a caixa se apaga sozinha 1,3s depois de qualquer
     * jeito.
     */
    if (largadaAte && Date.now() < largadaAte - 250) esconderLargada();
    return;
  }

  /* Já contando: só acerta o relógio, sem recomeçar a animação. */
  if (largadaAte) {
    largadaAte = Date.now() + falta;
    return;
  }

  largadaAte = Date.now() + falta;

  /*
   * ---- O modal fecha AQUI ----
   *
   * No começo da contagem e não na entrada da caçada: é o mesmo instante para o
   * jogador, e este é o único ponto do código que sabe que um duelo começou
   * para ELE. Fechar em `state.hunt.pvp` fecharia a janela de quem só abriu o
   * lobby para olhar enquanto outros dois lutam.
   */
  closeModal();

  /*
   * ---- O contador é um PAINEL, e não um número solto ----
   *
   * "arruma o contador ao entrar na arena que ele ta meio torto, deixa mais ou
   *  menos igual a aba de vitoriosa mas mais pequeno."
   *
   * Ele era um número gigante em cima de um anel, flutuando no mapa — e ficava
   * torto porque não tinha caixa: o número, o anel e a legenda eram três peças
   * centradas por conta própria, e qualquer diferença de altura de linha
   * desalinhava as três.
   *
   * Agora é a mesma peça da tela de vitória (`.vitoria-painel`): uma caixa com
   * borda de ouro, fundo escuro e a mesma animação de entrada — menor, porque
   * esta fica cinco segundos e aquela é o fim da luta. Uma caixa só, e o que
   * está dentro dela se alinha sozinho.
   */
  /*
   * ---- Só o NÚMERO, sem caixa ----
   *
   * "a contagem regressiva na tela nao precisa ter o fundo retangular sabe?
   *  deixa so o numero na tela bem bonito em vermelho com efeito."
   *
   * A caixa entrou na rodada passada para consertar um número que nascia torto
   * — ele, o anel e a legenda se centravam cada um por conta própria. O
   * alinhamento continua resolvido sem ela: agora é uma coluna só (`grid` com
   * `justify-items: center`), e o que segura tudo é o contêiner, não a moldura.
   */
  const caixa = el('div', 'arena-largada');
  caixa.id = 'arena-largada';
  caixa.setAttribute('role', 'status');

  const painel = el('div', 'arena-largada-painel');
  const numero = el('div', 'arena-largada-numero');
  painel.append(numero);

  /*
   * O nome do adversário embaixo do número. "Derrote-o" pergunta quem, e a
   * resposta está a um passo daqui — o mapa tem dois bonecos e um deles é o
   * próprio jogador.
   */
  const eu = state.character?.name;
  const outro = (state.hunt?.aliados ?? []).map((quem) => quem?.name).find((nome) => nome && nome !== eu);
  /*
   * ---- E ele precisa ser LIDO ----
   *
   * "o contador ficou perfeito, mas o ''contra fulano'' quase nao da pra ver."
   *
   * Ele nasceu cinza e pequeno de propósito, para não disputar com o número. Só
   * que o fundo dele não é uma tela escura: é o MAPA, com chão claro, bichos e
   * dois bonecos passando por baixo — e um cinza fraco sobre isso não é
   * discreto, é invisível.
   *
   * A solução não é competir em tamanho com o número: é dar ao nome o mesmo
   * contorno escuro que faz o número existir, e pôr a palavra "contra" — que é
   * só cola — num tom mais apagado que o nome, que é a informação.
   */
  const nota = el('p', 'arena-largada-nota');
  if (outro) {
    nota.append(el('span', 'arena-largada-contra', 'contra'));
    nota.append(el('b', 'arena-largada-quem', outro));
  } else {
    nota.append(el('span', 'arena-largada-contra', 'prepare-se'));
  }
  painel.append(nota);

  caixa.append(painel);
  document.body.append(caixa);

  const passo = () => {
    const restante = largadaAte - Date.now();

    if (restante > LARGADA_VISIVEL) {
      /* Ainda debaixo da cortina de viagem: nada na tela. */
      caixa.classList.add('esperando');
    } else if (restante > 0) {
      caixa.classList.remove('esperando');
      const conta = Math.ceil(restante / 1000);
      if (conta !== largadaNumero) {
        largadaNumero = conta;
        numero.textContent = String(conta);
        /*
         * A animação é reiniciada: trocar só o texto não repete o
         * `@keyframes`, e o número cresceria uma vez e ficaria parado. Adiar
         * o `add` para o próximo quadro (em vez de ler `offsetWidth` só para
         * obrigar a remoção a valer na hora) reinicia igual, sem forçar um
         * reflow síncrono no meio de um tique.
         */
        numero.classList.remove('bate');
        requestAnimationFrame(() => numero.classList.add('bate'));
      }
    } else if (restante > -LARGADA_FRASE_MS) {
      if (largadaNumero !== 0) {
        largadaNumero = 0;
        caixa.classList.remove('esperando');
        caixa.classList.add('vai');
        numero.textContent = 'Derrote-o!';
        numero.classList.remove('bate');
        requestAnimationFrame(() => numero.classList.add('bate'));
      }
    } else {
      esconderLargada();
      return;
    }

    largadaQuadro = requestAnimationFrame(passo);
  };

  passo();
}

/* =========================================================================
 * O DEGRAU DA ARENA: "os bichos ficaram mais fortes"
 *
 * "conforme os bixo fica mais forte tem que aparecer uma msg na tela que ficou
 *  mais forte x%."
 *
 * Era um `notice` — o balãozinho de canto, o mesmo que anuncia que uma poção
 * acabou. No meio de uma luta em que a coisa que mudou é que os bichos passaram
 * a bater mais forte, um balãozinho de canto é a informação certa no lugar em
 * que ninguém está olhando.
 *
 * ---- Em CIMA, e não no meio ----
 *
 * A contagem de largada mora no meio da tela porque naquele instante não há
 * luta para tapar. Esta chega no meio da briga: um painel no centro cobriria
 * justamente os dois bonecos e os bichos que o aviso está anunciando. Ela desce
 * do alto, fica quatro segundos e sai.
 * ========================================================================= */
const TEMPO_DA_ONDA = 4200;
let ondaTimer = null;

function mostrarOndaDaArena(event) {
  if (!event) return;
  clearTimeout(ondaTimer);
  document.getElementById('arena-onda')?.remove();

  const caixa = el('div', 'arena-onda');
  caixa.id = 'arena-onda';
  caixa.setAttribute('role', 'status');

  const painel = el('div', 'arena-onda-painel');
  painel.append(el('b', 'arena-onda-passo', `+${event.passo}%`));

  const texto = el('div', 'arena-onda-texto');
  texto.append(el('strong', null, 'Os bichos ficaram mais fortes'));
  /*
   * ---- O ACUMULADO junto do passo ----
   *
   * "+15%" no oitavo degrau seria uma meia verdade tranquila, quando o bicho já
   * está batendo mais que o dobro. O número que assusta é o que informa.
   */
  texto.append(el('span', null, `${event.degrau}ª vez · ${event.total}% acima do normal`));
  painel.append(texto);

  caixa.append(painel);
  document.body.append(caixa);

  ondaTimer = setTimeout(() => {
    caixa.classList.add('saindo');
    setTimeout(() => caixa.remove(), 400);
  }, TEMPO_DA_ONDA);
}

/* O mesmo atalho de tela que a largada e o fim de luta têm. Ver `__arenaFim`. */
window.__arenaOnda = (degrau = 1, passo = 15, total = 15) => mostrarOndaDaArena({ t: 'arenaOnda', degrau, passo, total });

/* =========================================================================
 * O DESAFIO DE x1 NA TELA
 *
 * "o desafio, e quem desafiou e o elo da pessoa, tinha que aparecer na tela da
 *  pessoa (desde que ela esteja na cidade)."
 *
 * Era um `notice` — o balãozinho de canto, o mesmo de uma poção que acabou. Um
 * convite de duelo tem PRAZO e do outro lado há alguém parado esperando: some
 * em quatro segundos no canto da tela de quem estava olhando o inventário, e a
 * pessoa nunca soube que foi chamada.
 *
 * ---- Só na CIDADE ----
 *
 * Quem está caçando não pode aceitar (o servidor recusa, ver a `barra` em
 * `index.mjs`), então o cartão não aparece: seria um botão que dá erro. O
 * `notice` continua saindo nos dois casos, e é ele que deixa o rastro no chat
 * para quem voltar depois.
 * ========================================================================= */
const TEMPO_DO_DESAFIO = 30000;
let desafioTimer = null;

function esconderDesafioDeArena() {
  clearTimeout(desafioTimer);
  desafioTimer = null;
  document.getElementById('arena-desafio')?.remove();
}

function mostrarDesafioDeArena(msg, par = false) {
  if (!msg?.de) return;
  /* Caçando, o convite não pode ser aceito — então ele não é oferecido. */
  if (state.hunt) return;
  esconderDesafioDeArena();

  const caixa = el('div', 'arena-desafio');
  caixa.id = 'arena-desafio';
  caixa.setAttribute('role', 'alert');

  const painel = el('div', 'arena-desafio-painel');

  /*
   * O palco só nasce se houver boneco. Uma moldura vazia ao lado do nome não é
   * "sem roupa", parece defeito — e há casos reais em que o outfit não chega
   * (sprite que o cliente ainda não baixou, personagem antigo sem `outfit`).
   */
  if (msg.outfit?.type && outfitInfo(msg.outfit.type)) {
    const palco = el('div', 'arena-desafio-boneco');
    palco.append(outfitCanvas(msg.outfit.type, msg.outfit, 52, 2, true));
    painel.append(palco);
  } else {
    painel.classList.add('sem-boneco');
  }

  const texto = el('div', 'arena-desafio-texto');
  texto.append(el('span', 'arena-desafio-rotulo', par ? 'Você foi desafiado para um x1' : 'Desafio de x1'));

  const quem = el('div', 'arena-desafio-quem');
  quem.append(el('b', null, msg.de));
  /*
   * ---- O ELO junto do nome ----
   *
   * É a informação que decide se vale aceitar: um Bronze e um Lenda são duas
   * lutas diferentes, e o nome sozinho não diz qual das duas está sendo
   * oferecida.
   */
  if (msg.patente?.id) {
    /*
     * O selo a mao, e nao o `seloDaPatente` do panels.mjs: este arquivo nao
     * importa daquele (a dependencia corre no outro sentido), e a peca sao
     * quatro linhas. A mesma forma que `mostrarFimDeArena` usa logo abaixo.
     */
    const selo = document.createElement('img');
    selo.className = 'arena-desafio-selo';
    selo.src = `/client/assets/icons/patente-${msg.patente.id}.png`;
    selo.alt = msg.patente.nome ?? '';
    selo.width = 18;
    selo.height = 18;
    selo.onerror = () => selo.remove();
    quem.append(selo);
    quem.append(el('span', 'arena-desafio-elo', msg.patente.nome ?? ''));
  }
  texto.append(quem);
  texto.append(el('span', 'arena-desafio-onde', `level ${msg.level ?? '?'} · ${msg.arena ?? 'arena'}`));
  painel.append(texto);

  const botoes = el('div', 'arena-desafio-botoes');
  if (par) {
    /* =====================================================================
     * O PAR FEITO: "Abrir o lobby", e nada de aceitar
     *
     * "aparecia na tela 'voce foi desafiado pra um x1', e botao de abrir o
     *  lobby pros dois, da o pronto e comecar."
     *
     * Nao ha' Aceitar porque nao ha' o que aceitar: quem estava na fila ja'
     * disse que queria, quem clicou no card tambem, e a sala JA' ESTA ABERTA no
     * servidor para os dois. Um botao de aceitar aqui mentiria sobre o estado
     * do mundo — e um clique nele daria erro.
     *
     * E nao ha' Recusar pelo mesmo motivo: o jeito de desistir e' sair da sala,
     * de dentro dela, que e' o unico lugar em que o OUTRO fica sabendo. "Depois"
     * so' tira o cartao da frente; a sala continua la', esperando os dois
     * prontos, e o icone da barra de cima leva ate' ela.
     * ===================================================================== */
    const abrir = el('button', 'arena-pronto', 'Abrir o lobby');
    abrir.onclick = () => {
      esconderDesafioDeArena();
      openArena();
    };
    const depois = el('button', 'ghost', 'Depois');
    depois.onclick = () => esconderDesafioDeArena();
    botoes.append(abrir, depois);
  } else {
    const aceitar = el('button', 'arena-pronto', 'Aceitar');
    aceitar.onclick = () => {
      send({ t: 'arena', action: 'aceitar', quem: msg.de, arenaId: msg.arenaId });
      esconderDesafioDeArena();
      /*
       * ---- ACEITAR ABRE A JANELA DA ARENA ----
       *
       * "quando aparecer o convite de desafio na tela da pessoa e ela aceitar,
       *  ela tem que ir direto pro modal da arena, pra poder da pronto e etc."
       *
       * Antes, aceitar daqui abria uma SALA DE DUELO que a pessoa não via: o
       * cartão sumia, nada acontecia na tela, e o PRONTO ficava atrás de um botão
       * da barra de cima que ela não tinha motivo para procurar. Do outro lado,
       * alguém esperando um "pronto" que nunca vinha.
       *
       * `openArena` pede a vista e abre a janela; a sala já vem dentro dela, com
       * os dois bonecos e o botão. A ordem importa: o `aceitar` vai primeiro, pelo
       * mesmo socket, então a vista que chegar depois já conhece a sala.
       */
      openArena();
    };
    const recusar = el('button', 'ghost', 'Recusar');
    recusar.onclick = () => esconderDesafioDeArena();
    botoes.append(aceitar, recusar);
  }
  painel.append(botoes);

  caixa.append(painel);
  document.body.append(caixa);

  /* =======================================================================
   * ELE FICA ACIMA DA BARRA DE BAIXO, e a altura dela e' MEDIDA
   *
   * "o convite de desafio ... nao e pra ficar la encima, e pra ficar no centro
   *  embaixo perto da barra de xp, acima da barra de habilidade."
   *
   * A altura da barra de ações não é uma constante: ela muda com o número de
   * fileiras de atalhos, encolhe quando o jogador a minimiza e some fora da
   * caçada. Um `bottom` cravado em pixels acertaria um desses casos e erraria os
   * outros — no melhor deles o cartão flutuaria no meio do nada, no pior ficaria
   * por baixo dos atalhos.
   *
   * Medir custa uma leitura de layout, uma vez, na hora em que o cartão nasce.
   */
  const barraDeBaixo = document.getElementById('actionbar');
  const alturaDaBarra = barraDeBaixo ? Math.round(barraDeBaixo.getBoundingClientRect().height) : 0;
  caixa.style.bottom = `${alturaDaBarra + 14}px`;

  /*
   * O cartão sai sozinho antes do convite vencer. Trinta segundos contra os
   * sessenta da validade: um cartão que some no mesmo instante em que o botão
   * deixa de funcionar deixaria o último clique dar erro.
   */
  desafioTimer = setTimeout(esconderDesafioDeArena, TEMPO_DO_DESAFIO);
}

/* O mesmo atalho de tela que a largada e o fim de luta têm. */
window.__arenaDesafio = (de = 'Fulano') =>
  mostrarDesafioDeArena({
    de,
    level: 700,
    arena: 'Livraria de Fogo',
    patente: { id: 'ouro', nome: 'Ouro', cor: '#e0a84a' },
    /* Com roupa: sem ela a foto de conferência sai com a moldura do boneco vazia. */
    outfit: { type: 131, head: 78, body: 88, legs: 58, feet: 76, addons: 3 },
  });

function mostrarFimDeArena(fim) {
  if (!fim) return;
  document.getElementById('arena-fim')?.remove();

  const venceu = !!fim.venceu;
  const caixa = el('div', `vitoria arena-fim ${venceu ? 'venceu' : 'perdeu'}`);
  caixa.id = 'arena-fim';
  caixa.setAttribute('role', 'status');

  const painel = el('div', 'vitoria-painel arena-fim-painel');

  /*
   * O SELO e' a patente de agora, desenhada grande.
   *
   * Um trofeu generico diria a mesma coisa em toda luta. A patente diz onde a
   * pessoa esta na escada, e e' a imagem que ela quer ver crescer.
   */
  const patente = fim.patente?.agora;
  if (patente) {
    const selo = document.createElement('img');
    selo.className = 'arena-fim-selo';
    selo.src = `/client/assets/icons/patente-${patente.id}.png`;
    selo.alt = '';
    selo.onerror = () => selo.remove();
    if (patente.cor) selo.style.setProperty('--patente-cor', patente.cor);
    painel.append(selo);
  }

  painel.append(el('h2', null, venceu ? 'Vitória' : 'Derrota'));
  painel.append(
    el(
      'p',
      'vitoria-quem',
      fim.adversario
        ? `${venceu ? 'Você venceu' : 'Você perdeu para'} ${fim.adversario} na ${fim.arena}`
        : `O x1 na ${fim.arena} acabou`,
    ),
  );

  /*
   * ---- O que mudou, em diferenca ----
   *
   * O sinal na frente e o numero de antes atras: "+1" responde o que a luta
   * rendeu, "7" responde onde ela chegou, e as duas perguntas sao feitas ao
   * mesmo tempo por quem olha.
   */
  const mudou = el('div', 'vitoria-ganhos arena-fim-conta');
  const linhaDe = (rotulo, de, para, arte) => {
    const delta = para - de;
    const linha = el('div', delta < 0 ? 'baixou' : delta > 0 ? 'subiu' : null);
    if (arte) linha.append(arte);
    linha.append(el('b', null, `${delta > 0 ? '+' : ''}${delta}`));
    linha.append(el('span', null, `${rotulo} · ${de} → ${para}`));
    mudou.append(linha);
  };

  const moeda = () => {
    const img = document.createElement('img');
    img.className = 'arena-fim-moeda';
    img.src = '/client/assets/icons/arena-moeda.png';
    img.alt = '';
    img.width = 20;
    img.height = 20;
    img.onerror = () => img.remove();
    return img;
  };

  if (fim.pontos) linhaDe('pontos de arena', fim.pontos.antes, fim.pontos.agora, null);
  if (fim.moedas) linhaDe('moedas de arena', fim.moedas.antes, fim.moedas.agora, moeda());
  painel.append(mudou);

  /* A patente so aparece quando ela MUDOU: e' a unica vez em que e noticia. */
  const de = fim.patente?.antes;
  const para = fim.patente?.agora;
  if (de && para && de.id !== para.id) {
    const subiu = el('p', 'arena-fim-patente');
    subiu.style.setProperty('--patente-cor', para.cor ?? '#e0a84a');
    subiu.textContent = `Você subiu de ${de.nome} para ${para.nome}.`;
    painel.append(subiu);
  } else if (para?.proxima) {
    painel.append(
      el(
        'p',
        'arena-fim-falta',
        para.proxima.falta === 1
          ? `${para.nome} · falta 1 ponto para ${para.proxima.nome}.`
          : `${para.nome} · faltam ${para.proxima.falta} pontos para ${para.proxima.nome}.`,
      ),
    );
  }

  if (fim.placar) {
    painel.append(
      el('p', 'arena-fim-placar', `${fim.placar.vitorias} vitória${fim.placar.vitorias === 1 ? '' : 's'} · ${fim.placar.derrotas} derrota${fim.placar.derrotas === 1 ? '' : 's'}`),
    );
  }

  /*
   * A frase que fecha a tela, e ela e' a mais importante das duas.
   *
   * Quem perdeu lutou com o corpo de um level 400 e morreu. Sem esta linha, a
   * primeira coisa que ele faz e abrir a ficha para conferir se perdeu
   * experiencia — e essa duvida e exatamente a que o pedido do dono queria
   * evitar ("cuidado pra nao bugar o char quando sair da arena").
   */
  painel.append(
    el(
      'p',
      'arena-fim-nota',
      venceu
        ? `Você voltou para a cidade no level ${fim.level}, com a vida e a mana que tinha.`
        : `Você acordou no templo no level ${fim.level}. Nada foi perdido: nem experiência, nem ouro, nem item.`,
    ),
  );

  caixa.append(painel);
  document.body.append(caixa);

  const sair = () => {
    caixa.classList.add('saindo');
    setTimeout(() => caixa.remove(), 400);
  };
  const relogio = setTimeout(sair, TEMPO_DA_TELA_DE_ARENA);
  caixa.onclick = () => {
    clearTimeout(relogio);
    sair();
  };
}

/*
 * A porta de teste da tela de fim de luta.
 *
 * Ela nasce de um duelo de verdade, e um duelo de verdade leva dois
 * personagens, duas contas e alguns minutos — caro demais para conferir se um
 * numero esta alinhado. Do mesmo jeito que `window.__abrir` expoe as janelas
 * por nome, esta expoe a tela por payload.
 */
window.__arenaFim = (fim) => mostrarFimDeArena(fim);
/*
 * O mesmo atalho para a CONTAGEM, e pela mesma razao que o de cima existe: ver
 * a tela de largada de verdade custa dois personagens, um desafio aceito e seis
 * segundos — e a luta so acontece uma vez. Com o gancho, o `shot.mjs` pede a
 * contagem em qualquer numero e fotografa.
 *
 * Ele nao abre porta nenhuma: quem tranca o passo e o golpe e o servidor (ver
 * `naLargada`). Chamar isto aqui desenha um numero e mais nada.
 */
window.__arenaLargada = (ms = 6000) => acertarLargada(ms);

function mostrarVitoria(message) {
  document.getElementById('vitoria')?.remove();

  const caixa = el('div', 'vitoria');
  caixa.id = 'vitoria';
  // Nao rouba o clique do jogo: a faixa e' aviso, nao janela.
  caixa.setAttribute('role', 'status');

  const painel = el('div', 'vitoria-painel');
  painel.append(el('div', 'vitoria-selo', '⚔'));
  painel.append(el('h2', null, 'Parabens!'));
  painel.append(
    el('p', 'vitoria-quem', message.arena ? `Voce venceu a onda ${message.arena.wave} da arena` : `Voce derrotou ${message.boss}`)
  );

  const ganhos = el('div', 'vitoria-ganhos');
  const ganho = (valor, rotulo) => {
    const linha = el('div');
    linha.append(el('b', null, valor));
    linha.append(el('span', null, rotulo));
    ganhos.append(linha);
  };
  if (message.exp) ganho(`+${message.exp.toLocaleString('pt-BR')}`, 'de experiencia');
  if (message.arena?.reward) ganho(`+${message.arena.reward.toLocaleString('pt-BR')}`, 'de ouro');
  if (ganhos.childElementCount) painel.append(ganhos);

  /*
   * Boss de task: esta vitoria foi a UNICA, e a tela diz isso agora.
   *
   * Sem esta linha o jogador volta a aba de Bosses, nao acha mais o card e
   * conclui que sumiu por defeito. A hora de contar e' aqui, junto da vitoria —
   * e nao quando ele for procurar.
   */
  if (message.taskFechada) {
    painel.append(
      el(
        'p',
        'vitoria-task',
        `Boss task ${message.taskFechada.name} encerrada — ${message.taskFechada.boss} sai uma vez por personagem, e essa foi a sua.`,
      ),
    );
  }

  /*
   * ---- O que caiu, desenhado ----
   *
   * A faixa dizia "3 itens no baú de recompensa". Um numero nao e' a
   * recompensa: derrubar um boss que so nasce de doze em doze horas e ver um
   * "3" e ficar sem saber se valeu. Aqui saem os proprios itens, com o balao de
   * sempre em cada um.
   *
   * `message.loot` e' o extrato da sessao (`session.loot`), um mapa de
   * id -> quantidade.
   */
  /*
   * ---- E sai TUDO, e não os doze primeiros ----
   *
   * Saíam doze e um "+6" no canto. O dono: "quando eu mata o boss tem que
   * aparecer o loot todo na tela e nao alguns so".
   *
   * O corte existia para a faixa não crescer sem fim, e ele cortava justamente
   * o que a faixa existe para mostrar — a ordem do extrato não é por valor,
   * então o "+6" tinha a mesma chance de esconder a arma que de esconder seis
   * pedaços de couro. Quem derruba um boss de doze em doze horas quer ver o que
   * caiu, e "+6" é a única linha da tela que não responde nada.
   *
   * O tamanho passa a ser problema do CSS: `.vitoria-loot` ganhou um teto de
   * altura e rola por dentro. Uma faixa que rola mostra tudo; um número não
   * mostra nada.
   */
  const caiu = Object.entries(message.loot ?? {}).filter(([, quantos]) => quantos > 0);
  if (caiu.length) {
    /*
     * Onde o loot foi parar, escrito por extenso.
     *
     * "informar que foi pro depósito" — e é verdade nas duas telas: o baú de
     * recompensa mora no Depósito, tanto o da sala de boss quanto o da arena.
     * Dizer só "baú de recompensa" obriga a pessoa a saber de antemão onde
     * fica essa coisa.
     */
    painel.append(
      el('p', 'vitoria-caiu', `Foi para o Baú de Recompensa, no Depósito (${caiu.length} tipos):`)
    );
    const grade = el('div', 'vitoria-loot');
    for (const [id, quantos] of caiu) {
      const cela = el('div', 'cell');
      cela.append(itemCanvas(Number(id), 30, quantos));
      if (quantos > 1) cela.append(el('b', null, String(quantos)));
      tipFor(cela, Number(id));
      grade.append(cela);
    }
    painel.append(grade);
  }

  caixa.append(painel);
  document.body.append(caixa);

  const sair = () => {
    caixa.classList.add('saindo');
    setTimeout(() => caixa.remove(), 400);
  };
  /*
   * Quanto mais caiu, mais tempo ela fica.
   *
   * Seis segundos e meio bastavam para ler "derrotou X, +90.750 de experiência"
   * e olhar meia dúzia de figuras. Com o extrato inteiro na tela (ver acima),
   * um boss que solta vinte tipos precisa de mais do que isso — e uma faixa que
   * some no meio da leitura obriga a abrir o baú para saber o que se ganhou,
   * que é a viagem que ela existe para poupar. Meio segundo por tipo, até o
   * dobro do tempo: quem já leu fecha com um clique, como sempre.
   */
  /*
   * `fracaoDoTempo` encolhe a espera sem mexer na conta: quem chama de um lugar
   * em que a faixa atrapalha (a arena, que não acaba) pede uma fração dela.
   * Ver o `bossCaiu`, no laço de eventos.
   */
  const cheio = Math.min(TEMPO_DA_FAIXA_DE_VITORIA * 2, TEMPO_DA_FAIXA_DE_VITORIA + caiu.length * 500);
  const espera = Math.round(cheio * (message.fracaoDoTempo ?? 1));
  const relogio = setTimeout(sair, espera);
  caixa.onclick = () => {
    clearTimeout(relogio);
    sair();
  };
}

/*
 * ---- A foto, aberta em cima de tudo ----
 *
 * Na caixa de morte ela mede 420px de largura para caber ao lado do extrato, e
 * nesse tamanho o que matou o personagem é um borrão de quatro pixels. O clique
 * abre a mesma imagem no maior tamanho que a tela comporta.
 *
 * `z-index` acima da própria caixa de morte (80): ela é o fundo desta, e uma
 * lupa que abrisse ATRÁS do que se está olhando não seria lupa.
 *
 * Fecha em qualquer clique e no Esc. Não há botão de fechar porque não há nada
 * mais para fazer aqui além de olhar e sair — e um X pequeno num canto seria o
 * único alvo válido numa tela inteira que já é um alvo.
 */
function abrirFoto(src, legenda = null) {
  document.getElementById('foto-lupa')?.remove();

  const fundo = el('div', 'foto-lupa');
  fundo.id = 'foto-lupa';
  const img = document.createElement('img');
  img.src = src;
  img.alt = legenda ?? 'foto';
  fundo.append(img);
  if (legenda) fundo.append(el('em', null, legenda));

  const fechar = () => {
    fundo.remove();
    document.removeEventListener('keydown', naTecla);
  };
  const naTecla = (evento) => {
    if (evento.key === 'Escape') {
      // A caixa de morte não pode fechar junto: o Esc some só com a lupa.
      evento.stopPropagation();
      fechar();
    }
  };
  fundo.onclick = fechar;
  // Na fase de CAPTURA, para chegar antes do Esc que fecha o modal de trás.
  document.addEventListener('keydown', naTecla, true);

  document.body.append(fundo);
}

/*
 * ---- A foto do instante da morte ----
 *
 * Sai dos canvas do próprio jogo, e não de `getDisplayMedia`: aquela pede
 * permissão e só funciona a partir de um clique do jogador, e ninguém clica em
 * nada no instante em que morre. Aqui a foto é tirada no momento em que a
 * mensagem chega, antes de qualquer redesenho — é o último quadro que esteve na
 * tela, que é exatamente o que o dono pediu para ver.
 *
 * São duas camadas, e as duas importam:
 *   `#map`         o mundo — chão, criaturas, o boneco;
 *   `#map-overlay` os nomes, as barras de vida e os números de dano, que são a
 *                  metade da resposta para "o que me matou".
 *
 * O overlay cobre a JANELA inteira e o mapa não; por isso ele entra recortado
 * pelo retângulo do mapa, senão as duas camadas sairiam desencontradas.
 *
 * Em cima disso vai uma faixa com o que o HUD dizia naquele segundo — nome,
 * level, vida e mana. O HUD é DOM e não entra num canvas sem uma biblioteca
 * inteira; redesenhar as três linhas que importam custa vinte linhas e não
 * carrega nada.
 */
function fotoDaMorte() {
  const mapa = document.getElementById('map');
  if (!mapa?.width) return null;

  try {
    const caixaDoMapa = mapa.getBoundingClientRect();
    if (!caixaDoMapa.width || !caixaDoMapa.height) return null;

    const largura = 420;
    const proporcao = caixaDoMapa.height / caixaDoMapa.width;
    const alturaDoMapa = Math.round(largura * proporcao);
    const faixa = 34;

    const foto = document.createElement('canvas');
    foto.width = largura;
    foto.height = alturaDoMapa + faixa;
    const pincel = foto.getContext('2d');
    pincel.imageSmoothingEnabled = false;
    pincel.drawImage(mapa, 0, 0, largura, alturaDoMapa);

    const overlay = document.getElementById('map-overlay');
    if (overlay?.width) {
      const caixaDoOverlay = overlay.getBoundingClientRect();
      // O canvas do overlay é desenhado em pixels do dispositivo; a conta leva
      // isso junto em vez de supor `devicePixelRatio`.
      const escala = overlay.width / (caixaDoOverlay.width || 1);
      pincel.drawImage(
        overlay,
        (caixaDoMapa.left - caixaDoOverlay.left) * escala,
        (caixaDoMapa.top - caixaDoOverlay.top) * escala,
        caixaDoMapa.width * escala,
        caixaDoMapa.height * escala,
        0,
        0,
        largura,
        alturaDoMapa
      );
    }

    // ---- a faixa do HUD ----
    const eu = state.character ?? {};
    // O derivado mora DENTRO do personagem (`character.derived`), que é de onde
    // o HUD lê a vida e a mana máximas. Ver `renderHud`.
    const derived = eu.derived ?? {};
    pincel.fillStyle = 'rgba(8, 12, 14, .92)';
    pincel.fillRect(0, alturaDoMapa, largura, faixa);
    pincel.fillStyle = '#e6f2ef';
    pincel.font = '600 12px Georgia, serif';
    pincel.textBaseline = 'middle';
    pincel.fillText(`${eu.name ?? '—'} — level ${eu.level ?? 0}`, 8, alturaDoMapa + 11);

    const barra = (x, y, w, h, fracao, cor) => {
      pincel.fillStyle = 'rgba(255,255,255,.12)';
      pincel.fillRect(x, y, w, h);
      pincel.fillStyle = cor;
      pincel.fillRect(x, y, Math.max(0, Math.min(1, fracao)) * w, h);
    };
    const maxHp = derived.maxHp || eu.maxHp || 1;
    const maxMana = derived.maxMana || eu.maxMana || 1;
    barra(8, alturaDoMapa + 21, 150, 7, (eu.hp ?? 0) / maxHp, '#c0392b');
    barra(168, alturaDoMapa + 21, 150, 7, (eu.mana ?? 0) / maxMana, '#2c74b3');
    pincel.font = '10px Georgia, serif';
    pincel.fillStyle = '#a8bdb8';
    pincel.fillText(`${Math.max(0, Math.round(eu.hp ?? 0))} hp`, 324, alturaDoMapa + 25);

    return foto.toDataURL('image/jpeg', 0.82);
  } catch {
    // Canvas "sujo" por alguma imagem de outra origem: sem foto, o resto vai.
    return null;
  }
}

/*
 * ---- "Saiu uma versão nova" ----
 *
 * Quem estava com a aba aberta durante um deploy continua rodando o código
 * antigo contra um servidor novo. O jogo não avisa nada e às vezes nem parece
 * quebrado — só uma tela que não abre, um botão que responde erro. A pessoa
 * conclui que o jogo bugou, e o report que chega é esse.
 *
 * A versão vem no `welcome` (ver `versaoDoCliente`, no servidor). A primeira que
 * chega é a que esta aba está rodando; qualquer outra depois dela significa que
 * o servidor trocou de código embaixo dos pés.
 *
 * A caixa não tem como ser fechada, e é de propósito: o dono pediu para
 * OBRIGAR, e continuar jogando numa aba velha é justamente o que produz o bug
 * que ninguém consegue reproduzir. O botão faz a única coisa que resolve.
 */
/*
 * ---- A versão agora é AUTOMÁTICA ----
 *
 * Ela era a `versao` do `novidades.json`, trocada à mão, e ninguém trocava: de
 * 26/09 em diante nenhum deploy avisou ninguém. Agora é a impressão digital do
 * código do cliente (`versao-do-cliente.mjs`, no servidor), e chega já no
 * `hello` — a aba que se reconecta depois de um deploy fica sabendo antes mesmo
 * de escolher personagem. Deploy só de servidor não muda a versão.
 *
 * "O que mudou" só aparece se a lista de novidades for NOVA (outra `versao` que
 * a da primeira que esta aba viu): mostrar a lista de antes como se fosse desta
 * atualização seria contar novidade velha.
 */
let versaoDoJogo = null;
let novidadesDaVez = null;
let novidadesQueEstaAbaViu = null;

function conferirVersao(versao, novidades) {
  // A lista chega em todo `welcome`; a que vale é sempre a última que chegou,
  // porque é a da versão que está no ar agora.
  if (novidades) {
    novidadesQueEstaAbaViu ??= novidades.versao ?? null;
    novidadesDaVez = novidades;
    pintarNovidadesDaAtualizacao();
  }
  if (!versao) return;
  if (versaoDoJogo == null) {
    versaoDoJogo = versao;
    return;
  }
  if (versao === versaoDoJogo) return;
  mostrarAtualizacao();
}

/** A lista "o que mudou" dentro da janela — refeita se as novidades chegarem depois dela (o `welcome` vem depois do `hello`). */
function pintarNovidadesDaAtualizacao() {
  const lugar = document.getElementById('atualizar-novidades');
  if (!lugar) return;
  const novidades = novidadesDaVez;
  const nova = !!novidades?.itens?.length && (novidades.versao ?? null) !== novidadesQueEstaAbaViu;
  lugar.replaceChildren();
  lugar.hidden = false;
  if (!nova) {
    lugar.className = 'atualizar-novidades atualizar-generico';
    lugar.append(el('span', null, 'Melhorias e correções no jogo.'));
    return;
  }
  lugar.className = 'atualizar-novidades';
  lugar.append(el('b', null, novidades.titulo ?? 'O que mudou nesta versão'));
  const lista = document.createElement('ul');
  for (const item of novidades.itens) lista.append(el('li', null, item));
  lugar.append(lista);
}

/*
 * ---- Recarregar sozinho em 15 s — menos quando a pessoa está no controle ----
 *
 * Na caçada automática, na cidade ou treinando, recarregar é inofensivo (a
 * caçada roda no servidor) e quem está com a aba no fundo atualiza sem precisar
 * voltar. Na Caça Online (a pessoa está andando e mirando) e numa sala de boss,
 * um recarregamento no meio da ação seria um susto: ali a contagem PAUSA, e só o
 * botão atualiza. Saindo de lá, ela recomeça.
 */
const SEGUNDOS_PARA_ATUALIZAR = 15;
const atualizarPodeSerSozinho = () => !(state.hunt?.manual || state.hunt?.isBoss);

function recarregarJogo() {
  /*
   * `reload()` sozinho pode devolver a mesma cópia do cache. O parâmetro na
   * URL muda o endereço e obriga a busca — e some da barra na navegação
   * seguinte, porque o `replace` não deixa histórico. Os módulos do jogo têm a
   * versão no endereço (`?v=`, ver estaticos.mjs): nada de limpar cache.
   */
  const url = new URL(window.location.href);
  url.searchParams.set('v', String(Date.now()));
  window.location.replace(url.toString());
}

function mostrarAtualizacao() {
  if (document.getElementById('atualizar')) return;

  const caixa = el('div', 'atualizar');
  caixa.id = 'atualizar';
  /*
   * A moldura é a mesma de toda janela do jogo (`ui-frame--miudo`).
   *
   * A caixa nasceu com uma borda de 1px desenhada no CSS, e ao lado das janelas
   * do jogo — que têm ornamento de verdade — ela lia como um alerta do
   * navegador. A moldura é `border-image`, então o miolo precisa de um elemento
   * próprio: `.ui-frame` zera fundo e padding de propósito.
   */
  const painel = el('div', 'atualizar-painel ui-frame ui-frame--miudo');
  const dentro = el('div', 'atualizar-dentro');
  caixa.setAttribute('role', 'alertdialog');
  caixa.setAttribute('aria-modal', 'true');
  caixa.setAttribute('aria-labelledby', 'atualizar-titulo');
  const selo = el('div', 'atualizar-selo', '⟳');
  selo.setAttribute('aria-hidden', 'true');
  const titulo = el('h2', null, 'Nova versão disponível');
  titulo.id = 'atualizar-titulo';
  dentro.append(selo, titulo);
  dentro.append(
    el(
      'p',
      null,
      'O Draevor foi atualizado. Esta aba ainda está com a versão anterior — atualize para continuar sem erros.'
    )
  );
  /*
   * O que mudou, quando o servidor manda a lista NOVA (ver
   * `pintarNovidadesDaAtualizacao`). Ela vem de `novidades.mjs`, e não daqui:
   * esta aba está rodando o cliente ANTIGO, então uma lista escrita no cliente
   * seria a da versão passada — a que o jogador já conhece.
   */
  const novidades = el('div', 'atualizar-novidades');
  novidades.id = 'atualizar-novidades';
  dentro.append(novidades);

  dentro.append(
    el('p', 'atualizar-nota', 'Seu personagem está salvo no servidor e a caçada continua durante a atualização.')
  );

  const botao = el('button', 'recompensa-pegar', 'Atualizar agora');
  const contagem = el('p', 'atualizar-contagem');
  contagem.setAttribute('aria-live', 'polite');
  const trilho = el('div', 'atualizar-trilho');
  const cheio = el('i');
  trilho.append(cheio);
  let atualizando = false;
  const atualizar = () => {
    if (atualizando) return;
    atualizando = true;
    botao.disabled = true;
    botao.textContent = 'Atualizando...';
    contagem.textContent = '';
    recarregarJogo();
  };
  botao.onclick = atualizar;
  dentro.append(botao, trilho, contagem);

  painel.append(dentro);
  caixa.append(painel);
  document.body.append(caixa);
  pintarNovidadesDaAtualizacao();
  botao.focus({ preventScroll: true });

  // A contagem: anda de 250 em 250 ms, pausa na Caça Online / sala de boss.
  let falta = SEGUNDOS_PARA_ATUALIZAR * 1000;
  const relogio = setInterval(() => {
    if (!caixa.isConnected || atualizando) return clearInterval(relogio);
    if (!atualizarPodeSerSozinho()) {
      caixa.classList.add('pausado');
      contagem.textContent = 'Você está no controle agora — atualize quando puder.';
      return;
    }
    caixa.classList.remove('pausado');
    falta -= 250;
    cheio.style.width = `${Math.max(0, (falta / (SEGUNDOS_PARA_ATUALIZAR * 1000)) * 100)}%`;
    const s = Math.ceil(falta / 1000);
    contagem.textContent = `Atualizando automaticamente em ${s} s`;
    if (falta <= 0) {
      clearInterval(relogio);
      atualizar();
    }
  }, 250);
}

function mostrarMorte(message) {
  document.getElementById('morte')?.remove();

  const caixa = el('div', 'morte');
  caixa.id = 'morte';

  const painel = el('div', 'morte-painel');

  /*
   * O selo, SE o desenho existir.
   *
   * Mesmo caminho do `artOrUiIcon` das abas: pede o PNG e, não achando, some do
   * documento. Enquanto o desenho não chega a caixa fica exatamente como está
   * hoje — sem buraco e sem quadrado quebrado. O arquivo é
   * `client/assets/ui/morte-selo.png`.
   */
  const selo = document.createElement('img');
  selo.className = 'morte-selo';
  selo.alt = '';
  selo.onerror = () => selo.remove();
  selo.src = '/client/assets/ui/morte-selo.png';
  painel.append(selo);

  painel.append(el('h2', null, message.offline ? 'Você morreu enquanto estava fora' : 'Você morreu'));
  /*
   * Morte OFFLINE: a mesma caixa, e uma linha dizendo a que período o extrato
   * se refere — ele vai do início da ausência até a morte, não até agora.
   */
  if (message.offline && message.report) {
    painel.append(
      el(
        'p',
        'morte-nota',
        `O resumo abaixo é da caçada offline: do momento em que você saiu até a morte (${formatTime((message.report.minutos ?? 0) * 60000)}). O loot e a experiência dele já estão com você.`
      )
    );
  }

  const perdas = el('div', 'morte-perdas');
  const perda = (rotulo, valor, classe) => {
    const linha = el('div', classe);
    linha.append(el('b', null, valor));
    linha.append(el('span', null, rotulo));
    perdas.append(linha);
  };
  perda('de experiência', `−${(message.lost ?? 0).toLocaleString('pt-BR')}`, 'exp');
  // "carregado", e nao "da cacada": desde a mudanca a fracao sai do bolso.
  if (message.goldLost) perda('do ouro carregado', `−${message.goldLost.toLocaleString('pt-BR')}`, 'ouro');
  if (message.levelPerdido) perda(message.levelPerdido === 1 ? 'level' : 'levels', `−${message.levelPerdido}`, 'level');
  painel.append(perdas);

  /*
   * O que as bênçãos pouparam, em pontos.
   *
   * "As blessings tiraram 56% da perda" não diz nada a quem não sabe qual era a
   * perda cheia. Com os dois números — o que custaria e o que custou — dá para
   * ver se elas valeram o preço, que é a única razão de comprá-las.
   */
  /*
   * A conta de referência é a JÁ APARADA pelo teto, não a curva crua.
   *
   * O teto de 80% de um level entra antes do desconto; a curva do servidor
   * (`expCheia`) continua vindo só para mostrar o quanto o teto segurou. Dizer
   * "sem proteção teriam sido 15 milhões" quando o teto já cortava para 3,5
   * fazia a tela creditar às bênçãos um alívio que era do teto.
   */
  const semProtecao = message.expSemProtecao ?? message.expCheia;
  if (message.descontoPercent && semProtecao) {
    const poupado = Math.max(0, semProtecao - (message.lost ?? 0));
    painel.append(
      el(
        'p',
        'morte-bencao',
        `Sem proteção teriam sido ${semProtecao.toLocaleString('pt-BR')} — ` +
          `${message.blessings ? `${message.blessings} bênçãos` : 'a promoção'}` +
          `${message.blessings && message.promocao ? ' e a promoção' : ''} pouparam ` +
          `${poupado.toLocaleString('pt-BR')} (${message.descontoPercent}%).`
      )
    );
  } else if (semProtecao) {
    painel.append(
      el('p', 'morte-sem-bencao', 'Sem nenhuma bênção ativa: a perda foi a cheia. Compre-as antes da próxima caçada.')
    );
  }

  // E o que o teto segurou, quando ele entrou: é a diferença entre perder um
  // level e perder quatro, e sem esta linha ele é invisível.
  if (message.aparadoPeloTeto && message.expCheia && message.teto) {
    painel.append(
      el(
        'p',
        'morte-nota',
        `A curva do servidor pediria ${message.expCheia.toLocaleString('pt-BR')}; o teto de segurança ` +
          `aparou em ${message.teto.toLocaleString('pt-BR')} (80% de um level) antes das bênçãos.`
      )
    );
  }

  if (message.blessings) {
    painel.append(el('p', 'morte-nota', `${message.blessings} bênçãos foram consumidas e precisam ser compradas de novo.`));
  }

  /*
   * ---- A foto e o extrato ----
   *
   * A foto é tirada AGORA, no primeiro instante em que a mensagem chega: um
   * quadro depois o servidor já mandou o personagem para o templo e o mapa é
   * outro. O extrato vem junto da mensagem (ver `report` em `index.mjs`).
   *
   * Quem desligou nos Ajustes recebe só a conta da perda — e uma linha dizendo
   * onde religar, porque uma opção que some sem deixar rastro é uma opção que
   * ninguém encontra de volta.
   */
  // Offline: o extrato é o único registro do que a caçada rendeu — não some pela opção da tela de morte.
  if (message.offline || resumoDaMorteLigado()) {
    /*
     * ---- Foto e extrato LADO A LADO ----
     *
     * Empilhados, os dois faziam uma coluna de mil e cem pixels: a caixa não
     * cabia na tela, e o "Continuar" ficava abaixo da dobra — numa tela que
     * aparece sem ser chamada, o botão de sair não pode estar fora do campo de
     * visão. A foto é larga e o extrato é alto; um ao lado do outro eles se
     * completam em vez de somar altura.
     *
     * Numa janela estreita a grade volta para uma coluna sozinha, pelo CSS.
     */
    const colunas = el('div', 'morte-colunas');

    // Offline não há um instante da morte: o mapa na tela é o da cidade.
    const foto = message.offline ? null : fotoDaMorte();
    if (foto) {
      /*
       * A MOLDURA inteira é o botão, e não só a imagem.
       *
       * Com o alvo só na imagem, o clique na legenda ou na borda não fazia nada
       * — e é onde o dedo cai quando a foto é pequena. Um alvo de 420px é o que
       * essa mão espera.
       */
      const moldura = el('div', 'morte-foto');
      moldura.setAttribute('role', 'button');
      moldura.tabIndex = 0;
      const img = document.createElement('img');
      img.src = foto;
      img.alt = 'O instante da morte';
      moldura.append(img);
      moldura.append(el('em', null, 'o instante da morte — clique para ampliar'));
      moldura.onclick = () => abrirFoto(foto, 'o instante da morte');
      moldura.onkeydown = (evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') moldura.onclick();
      };
      colunas.append(moldura);
    }

    if (message.report) {
      const extrato = el('div', 'morte-extrato');
      extrato.append(el('div', 'ajustes-titulo', 'O que a caçada rendeu'));
      corpoDoRelatorio(extrato, message.report, false);
      colunas.append(extrato);
    }

    if (colunas.childElementCount) {
      // Duas colunas pedem uma caixa larga; uma só continua na largura de antes.
      if (colunas.childElementCount > 1) painel.classList.add('morte-largo');
      painel.append(colunas);
    }

    if (!message.offline) {
      const ocultar = el('button', 'ghost morte-ocultar', 'Não mostrar mais a foto e o resumo');
      ocultar.onclick = () => {
        ligarResumoDaMorte(false);
        ocultar.replaceWith(el('p', 'morte-nota', 'Ocultado. Para trazer de volta: Opções → Tela de morte.'));
        document.querySelector('#morte .morte-foto')?.remove();
        document.querySelector('#morte .morte-extrato')?.remove();
      };
      painel.append(ocultar);
    }
  } else {
    painel.append(el('p', 'morte-nota', 'A foto e o resumo estão ocultos — Opções → Tela de morte para trazê-los de volta.'));
  }

  // Para onde ele foi, e o que vem depois.
  const destino = el('p', 'morte-destino');
  painel.append(destino);

  const acoes = el('div', 'confirm-actions');
  const fechar = el('button', 'primary', 'Continuar');
  fechar.onclick = () => {
    caixa.remove();
    if (message.offline) send({ t: 'ackAusencia' });
  };
  acoes.append(fechar);
  painel.append(acoes);

  caixa.append(painel);
  document.body.append(caixa);

  /*
   * O relógio da volta.
   *
   * Quando a caçada continua — ciclo, ou limite de mortes ligado —, o servidor
   * segura o personagem no templo por alguns segundos e então o manda de volta.
   * A caixa conta esses segundos e some sozinha no fim; quem não quiser esperar
   * fecha no botão, e a volta acontece do mesmo jeito.
   */
  if (message.continua && message.voltaEm) {
    const fim = Date.now() + message.voltaEm;
    const contar = () => {
      if (!caixa.isConnected) return;
      const falta = Math.max(0, Math.ceil((fim - Date.now()) / 1000));
      destino.textContent = falta
        ? `Você acordou no templo de Draevor. Voltando para ${message.hunt ?? 'a caçada'} em ${falta}s...`
        : `Voltando para ${message.hunt ?? 'a caçada'}...`;
      if (!falta) return void setTimeout(() => caixa.remove(), 600);
      setTimeout(contar, 250);
    };
    contar();
  } else {
    destino.textContent = message.offline
      ? 'Você está no templo de Draevor. A caçada offline foi encerrada pela morte.'
      : 'Você acordou no templo de Draevor. A caçada foi encerrada.';
  }
}

/*
 * "Deseja sair deste personagem?"
 *
 * Sair encerra a caçada e salva — o servidor faz isso ao soltar o personagem —,
 * então não é um clique para acontecer por engano. A confirmação usa a mesma
 * caixa das outras, para não inventar um terceiro estilo de diálogo.
 */
/*
 * ---- Este botão dizia o contrário do que faz ----
 *
 * O texto era "a caçada em andamento é encerrada". Ela não é: trocar solta o
 * personagem como quem fecha a aba (`soltarPersonagem`, no servidor), e a
 * caçada ou o exercise seguem OFFLINE — a volta consolida o que rendeu. É a
 * promessa do idle.
 *
 * O dono pediu "um botão de trocar de personagem sem tirar esse de caçar", e a
 * resposta é que ele já existia e estava escondido atrás de um aviso que
 * assustava. Agora a caixa diz o que acontece de verdade, e o botão tem o nome
 * do que faz.
 *
 * Dois da conta NO MUNDO ao mesmo tempo só com + Party / ➜ Hunt: o outro vem
 * sem aba e fica enquanto estiver na party (ver `contaChar`, no servidor).
 */
function confirmarSaida() {
  openModal('Trocar de personagem', (body) => {
    /*
     * ---- A ordem da caixa: os personagens primeiro ----
     *
     * Antes ela abria com dois parágrafos de explicação e três botões, e a
     * lista vinha depois — quem quisesse trocar lia um texto sobre trocar antes
     * de poder trocar. Agora os cards vêm no topo, porque são a AÇÃO; o texto
     * e os botões descem para o rodapé, onde ficam as saídas.
     *
     * O "Ver todos os personagens" saiu: a lista aqui já mostra todos, e o
     * "Sair do personagem" continua levando para a tela de personagens, que é
     * onde se cria personagem e se sai da conta.
     */
    const lista = el('div', 'troca-rapida');
    body.append(lista);

    const desenharLista = (personagens) => {
      lista.replaceChildren();
      const meu = state.character?.name;
      for (const personagem of personagens) {
        /*
         * TODOS aparecem, inclusive aquele em que você já está.
         *
         * Ele vinha filtrado fora, e o buraco confundia: numa conta de quatro,
         * a caixa mostrava três e a pessoa procurava o que faltava. Ele entra
         * marcado e desligado — está na lista, e não dá para clicar.
         */
        const atual = personagem.name === meu;
        const card = cartaoDePersonagem(personagem, { atual, comBarra: true });
        if (atual) {
          lista.append(card);
          continue;
        }
        card.onclick = () => {
          closeModal();
          gate.entrarEm(personagem.name);
        };

        /*
         * ---- Convidar e chamar SEM entrar no outro char ----
         *
         * Report do Garibas: "se entro em 1 char da minha conta, pra convidar
         * outro precisaria entrar nele também... e pra chamar pra hunt também".
         * Os botões ficam FORA do card, que é um botão — botão dentro de botão
         * não existe, e o clique iria parar no "entrar nele".
         *
         * Quem decide se pode é o servidor (`contaChar`): level, cooldown de
         * boss, teto da party e da conta. A tela só apaga o "chamar" quando
         * não há caçada para onde chamar.
         */
        const item = el('div', 'troca-char');
        const acoesDoChar = el('div', 'troca-char-acoes');
        const naParty = (state.character?.party?.membros ?? []).some((m) => m.name === personagem.name);
        // Pílulas curtas com ícone; o texto inteiro fica no balão (`title`).
        const pilula = (icone, texto) => {
          const botao = el('button');
          botao.type = 'button';
          botao.append(el('b', null, icone), document.createTextNode(texto));
          return botao;
        };
        const convidar = pilula(naParty ? '✓' : '+', 'Party');
        convidar.disabled = naParty;
        convidar.title = naParty ? `${personagem.name} já está na sua party` : `Convida ${personagem.name} para a sua party, sem entrar nele.`;
        convidar.onclick = () => send({ t: 'contaChar', name: personagem.name, op: 'party' });
        const chamar = pilula('➜', 'Hunt');
        chamar.disabled = !state.hunt;
        chamar.title = state.hunt
          ? `Leva ${personagem.name} para a sua caçada agora. Se ele estiver caçando em outro lugar, aquela caçada acaba e o extrato dela aparece aqui para você.`
          : 'Entre numa caçada para chamar alguém para ela.';
        chamar.onclick = () => send({ t: 'contaChar', name: personagem.name, op: 'hunt' });
        const configurar = pilula('⚙', 'Config');
        configurar.title = `Alvo, distância, lure e a barra de magias de ${personagem.name}, sem entrar nele.`;
        configurar.onclick = () => abrirConfigDeOutro(personagem.name);
        acoesDoChar.append(convidar, chamar, configurar);
        item.append(card, acoesDoChar);
        lista.append(item);
      }
    };

    // Desenha JÁ com o que se sabe, para a caixa não abrir vazia esperando a
    // rede; o retrato novo chega em seguida e só corrige o que mudou.
    desenharLista(gate.personagens());

    /*
     * O "fazendo" de cada um envelhece: ele veio junto da conta, na entrada, e
     * de lá para cá o outro personagem pode ter trocado de hunt, morrido ou
     * parado. Um retrato novo agora faz a caixa mostrar o estado da hora.
     */
    gate.atualizarConta((conta) => desenharLista(conta?.characters ?? []));

    /*
     * ---- Em tempo real, enquanto a caixa estiver aberta ----
     *
     * A experiência sobe, as cargas caem e a stamina anda — e a graça de ver
     * isso é ver ANDAR. Um retrato só, tirado na abertura, envelhece nos vinte
     * segundos em que a pessoa fica decidindo.
     *
     * Três segundos, e não trezentos milissegundos: nenhuma dessas barras se
     * mexe rápido o bastante para justificar mais, e cada volta é uma ida ao
     * servidor para uma janela que quase sempre fica aberta por pouco tempo.
     *
     * O relógio morre com a janela — `openModal` devolve o corpo, e quando ele
     * sai do documento não há mais o que atualizar. Sem isto ficaria um pedido
     * a cada três segundos pelo resto da sessão.
     */
    const relogio = setInterval(() => {
      /*
       * `body.isConnected` nunca ficava falso: o `#modal-body` é UM só, reusado
       * por todas as janelas, e nunca sai do documento. O relógio seguia pedindo
       * a conta a cada três segundos pelo resto da sessão. A janela está aberta
       * quando o modal está à vista e o título ainda é o desta caixa.
       */
      if ($('modal').hidden || $('modal-title').textContent !== 'Trocar de personagem') return clearInterval(relogio);
      gate.atualizarConta((conta) => desenharLista(conta?.characters ?? []));
    }, 3000);

    // ---- o rodapé: o que cada saída faz, e as saídas ----
    body.append(
      el(
        'p',
        'sheet-nota',
        'Clicar num personagem entra nele, e este aqui CONTINUA de onde parou: caçando ou treinando, segue ' +
          'offline, como se você fechasse a aba; na cidade, fica parado. + PARTY e ➜ HUNT trazem o outro para ' +
          'o mundo junto com você (sem aba) enquanto ele estiver na sua party — até 2 chars da conta ao mesmo ' +
          'tempo, ou mais com "Slot de party".'
      ),
      el('p', 'sheet-nota', 'DEIXAR CAÇANDO OFFLINE: volta para a lista e o personagem continua a caça automática, o boss ou o exercise, como se você fechasse a aba.'),
      el('p', 'sheet-nota', 'SAIR DO PERSONAGEM: encerra a caçada agora, mostra o extrato e manda o personagem para o templo.')
    );

    const acoes = el('div', 'confirm-actions');
    const cancelar = el('button', 'ghost', 'Cancelar');
    cancelar.onclick = () => closeModal();

    /*
     * SAIR é o comportamento antigo, e continua existindo porque é uma coisa
     * que se quer de verdade: fechar a conta do que rendeu, guardar o extrato e
     * mandar o boneco para o templo. Vermelho porque desfaz trabalho — a caçada
     * em andamento acaba ali.
     *
     * O `stopHunt` vai antes do `switchCharacter` de propósito: soltar o socket
     * primeiro deixaria o pedido de encerrar sem ninguém para receber a
     * resposta, e o extrato daquela caçada ficaria para a próxima entrada em
     * vez de aparecer agora.
     */
    const sair = el('button', 'danger', 'Sair do personagem');
    sair.onclick = () => {
      closeModal();
      if (state.hunt) send({ t: 'stopHunt' });
      gate.switchCharacter();
    };

    /*
     * ---- DEIXAR CAÇANDO OFFLINE: o mesmo que fechar a aba, por um botão ----
     *
     * O dono: "a única maneira de deixar caçando offline é fechando a aba ou o
     * navegador". Laranja, entre o Cancelar e o Sair, e apagado onde o
     * personagem não tem o que fazer sozinho — a regra é a do servidor, que
     * recusa do mesmo jeito (ver `porQueNaoDaParaDeixarOffline`).
     */
    const motivo = porQueNaoDaParaDeixarOffline();
    const offline = el('button', 'laranja', 'Deixar caçando offline');
    offline.disabled = !!motivo;
    offline.title = motivo ?? 'Volta para a lista de personagens e o personagem continua o que está fazendo.';
    offline.onclick = () => {
      if (porQueNaoDaParaDeixarOffline()) return;
      closeModal();
      send({ t: 'deixarOffline' });
    };

    acoes.append(cancelar, offline, sair);
    body.append(acoes);
    if (motivo) body.append(el('p', 'sheet-nota', `Deixar offline está apagado: ${motivo}`));
  });
}

/*
 * ---- ⚙ Configurar um char da conta sem entrar nele ----
 *
 * Pedido do dono: na tela de trocar de personagem, configurar ali mesmo "as
 * magias que ele ia soltar, distância do bicho e etc".
 *
 * Os seletores são CLONES dos da barra do rodapé (`#strategy`, `#distance`,
 * `#lure`, `#lure-volta`): mesmas opções e mesmos textos, e uma opção nova que
 * entrar lá aparece aqui sem ninguém lembrar. Cada mudança vai como
 * `contaChar op: cmd`, e o servidor responde com a configuração nova inteira
 * (`contaCharDados`) — a tela nunca supõe que a mudança pegou.
 *
 * A barra de magias abre o MESMO editor da barra do rodapé, trocado para o
 * outro char. Ver `editarBarraDeOutro`, em actionbar.mjs.
 */
let configDeOutro = null;

function abrirConfigDeOutro(nome) {
  configDeOutro = { nome, dados: null };
  send({ t: 'contaChar', name: nome, op: 'dados' });
  desenharConfigDeOutro();
}

const tituloDaConfig = (nome) => `Configurar ${nome}`;

function desenharConfigDeOutro() {
  const alvo = configDeOutro;
  if (!alvo) return;
  const enviar = (cmd) => send({ t: 'contaChar', name: alvo.nome, op: 'cmd', cmd });

  openModal(
    tituloDaConfig(alvo.nome),
    (body) => {
      if (!alvo.dados) return void body.append(el('p', 'empty', 'carregando...'));
      const { character, catalog } = alvo.dados;
      const ajustes = character.settings ?? {};

      body.append(
        el('p', 'sheet-nota', `${character.name} · level ${character.level}. As mudanças valem na hora, mesmo com ele caçando.`)
      );

      // ---- a caçada: os mesmos seletores da barra do rodapé ----
      const linha = el('div', 'config-outro-linha');
      const seletor = (rotulo, idDoOriginal, valor, aoMudar) => {
        const original = document.getElementById(idDoOriginal);
        const campo = original ? original.cloneNode(true) : document.createElement('select');
        campo.removeAttribute('id');
        campo.value = String(valor);
        campo.onchange = () => aoMudar(campo.value);
        const caixa = el('label', 'config-outro-campo');
        caixa.append(el('span', 'rotulo', rotulo), campo);
        linha.append(caixa);
      };
      seletor('Alvo', 'strategy', ajustes.strategy ?? 'nearest', (v) => enviar({ t: 'strategy', value: v }));
      seletor('Distância', 'distance', ajustes.distance ?? 0, (v) => enviar({ t: 'distance', value: Number(v) }));
      seletor('Lurar até', 'lure', ajustes.lure ?? 0, (v) => enviar({ t: 'lure', value: Number(v) }));
      seletor('Voltar', 'lure-volta', ajustes.lureVolta ?? 0, (v) => enviar({ t: 'lure', volta: Number(v) }));
      body.append(linha);

      // ---- a party: as mesmas escolhas da janela de party, para ESTE char ----
      body.append(el('h3', null, 'Party'));
      const caixinha = (texto, chave, dica) => {
        const rotulo = el('label', 'party-opcao');
        const marca = document.createElement('input');
        marca.type = 'checkbox';
        marca.checked = !!ajustes[chave];
        marca.onchange = () => enviar({ t: 'settings', [chave]: marca.checked });
        rotulo.append(marca, el('span', null, texto));
        rotulo.title = dica;
        body.append(rotulo);
      };
      /*
       * Sempre à vista, e não só para quem já está numa party como membro: a
       * marca fica gravada no char e passa a valer assim que ele entrar numa
       * party de outro líder. Esconder a caixa fazia parecer que a opção não
       * existia.
       */
      const naParty = character.party;
      caixinha(
        'Seguir líder em qualquer ocasião',
        'seguirLider',
        (naParty?.souLider
          ? 'Ele é o líder agora — a marca passa a valer quando ele estiver na party de outro. '
          : naParty
            ? `Vai junto com ${naParty.lider}. `
            : 'Vale quando ele estiver numa party. ') +
          'Hunt, boss, instance, troca de hunt, volta para a cidade e morte do líder — respeitando level, premium, task e cooldown de boss.'
      );
      caixinha(
        'Permitir entrar na caçada',
        'entrarSemConvite',
        'Quem está na party dele entra na caçada dele direto, sem pedir.'
      );
      caixinha(
        'Aceitar boss automaticamente',
        'autoPronto',
        'Fica pronto sozinho quando o líder abrir o lobby de boss.'
      );
      /*
       * Quem vai na frente, andar atrás de quem e a quantas casas: o MESMO
       * pedaço da janela de party (`escolhasDaPosicao`), com um `state` de
       * mentira que diz "eu sou este char" e um `send` que embrulha no
       * `contaChar`. Só aparece caçando em grupo no automático, como lá.
       */
      if (alvo.dados.grupo) {
        const formacao = el('div', 'config-outro-formacao');
        escolhasDaPosicao(formacao, alvo.dados.grupo, { character: { name: character.name }, hunt: null }, enviar, {
          dicas: true,
        });
        body.append(formacao);
      } else {
        body.append(el('p', 'sheet-nota', 'Quem vai na frente e quem seguir aparecem quando ele estiver caçando em grupo.'));
      }

      // ---- a barra de magias, runas e itens (é aqui que mora a cura) ----
      body.append(el('h3', null, 'Barra de ações'));
      body.append(el('p', 'sheet-nota', 'Clique num slot para escolher a magia, a runa ou a poção e as condições — a cura mora aqui também.'));
      const todas = [...(catalog?.spells ?? []), ...(catalog?.runes ?? []), ...(catalog?.items ?? [])];
      const grade = el('div', 'config-outro-barra');
      const total = catalog?.slots ?? 22;
      for (let slot = 0; slot < total; slot++) {
        const acao = character.actions?.[slot] ?? null;
        const entrada = acao?.id ? todas.find((e) => e.id === acao.id) : null;
        const botao = el('button', `config-outro-slot${acao?.enabled === false ? ' desligado' : ''}`);
        botao.type = 'button';
        if (entrada) botao.append(actionIcon(entrada, 30));
        else botao.append(el('span', null, '+'));
        botao.append(el('em', null, String(slot + 1)));
        botao.title = entrada
          ? `${entrada.name}${acao.enabled === false ? ' (desligada)' : ''} — arraste para outro slot para trocar, botão direito para tirar`
          : `Slot ${slot + 1} vazio`;
        botao.dataset.slot = String(slot);

        /*
         * ---- Arrastar troca de lugar; botão direito tira ----
         *
         * O mesmo gesto da barra do rodapé, com os mesmos comandos (`swap` e
         * `set` vazio) — só que embrulhados no `contaChar`. O arraste é de
         * ponteiro e não o arraste nativo do navegador: foi o nativo que deixava
         * item grudado no cursor (ver `arrasto-do-mouse.mjs`). Quem recusa a
         * troca de ofício (poção de vida no slot de ataque) é o servidor, e a
         * recusa chega como aviso.
         */
        botao.oncontextmenu = (evento) => {
          evento.preventDefault();
          if (acao) enviar({ t: 'actions', action: 'set', slot, value: null });
        };
        let arrasto = null;
        botao.onpointerdown = (evento) => {
          if (evento.button !== 0 || !acao) return;
          arrasto = { x: evento.clientX, y: evento.clientY, andou: false };
          botao.setPointerCapture(evento.pointerId);
        };
        botao.onpointermove = (evento) => {
          if (!arrasto) return;
          if (!arrasto.andou && Math.hypot(evento.clientX - arrasto.x, evento.clientY - arrasto.y) > 5) {
            arrasto.andou = true;
            botao.classList.add('arrastando');
          }
          if (!arrasto.andou) return;
          for (const outro of grade.querySelectorAll('.config-outro-slot.alvo')) outro.classList.remove('alvo');
          const sob = document.elementFromPoint(evento.clientX, evento.clientY)?.closest('.config-outro-slot');
          if (sob && sob !== botao) sob.classList.add('alvo');
        };
        botao.onpointerup = (evento) => {
          const estava = arrasto;
          arrasto = null;
          botao.classList.remove('arrastando');
          for (const outro of grade.querySelectorAll('.config-outro-slot.alvo')) outro.classList.remove('alvo');
          if (!estava?.andou) return;
          // Foi arraste: o clique que vem logo depois não pode abrir o editor.
          botao.dataset.soltou = '1';
          const sob = document.elementFromPoint(evento.clientX, evento.clientY)?.closest('.config-outro-slot');
          const destino = sob ? Number(sob.dataset.slot) : NaN;
          if (Number.isInteger(destino) && destino !== slot) {
            enviar({ t: 'actions', action: 'swap', from: slot, to: destino });
          }
        };
        botao.onpointercancel = () => {
          arrasto = null;
          botao.classList.remove('arrastando');
        };

        botao.onclick = () => {
          if (botao.dataset.soltou) return void delete botao.dataset.soltou;
          abrirEditor();
        };
        const abrirEditor = () =>
          editarBarraDeOutro({
            personagem: character,
            catalogo: catalog,
            enviar: (cmd) => enviar(cmd),
            slot,
            // Fechou o editor: volta para este painel, com a barra já atualizada.
            aoFechar: () => desenharConfigDeOutro(),
          });
        grade.append(botao);
      }
      body.append(grade);

      const acoes = el('div', 'confirm-actions');
      const voltar = el('button', 'ghost', 'Voltar para a troca');
      voltar.onclick = () => {
        configDeOutro = null;
        confirmarSaida();
      };
      acoes.append(voltar);
      body.append(acoes);
    },
    () => {
      if (configDeOutro === alvo) configDeOutro = null;
    }
  );
}

/** A resposta do servidor com a configuração do outro char. */
function chegaramDadosDoOutro(message) {
  const alvo = configDeOutro;
  // O editor de ações pode estar aberto por cima: ele também passa a ler a barra nova.
  atualizarBarraDeOutro(message.character, message.catalog);
  if (!alvo || alvo.nome !== message.name) return;
  alvo.dados = { character: message.character, catalog: message.catalog, grupo: message.grupo ?? null };
  // Só redesenha o painel se ele ainda é o que está na tela — com o editor de
  // ações por cima, redesenhar aqui fecharia o editor no meio da edição.
  if (!$('modal').hidden && $('modal-title').textContent === tituloDaConfig(alvo.nome)) desenharConfigDeOutro();
}

/** O mesmo que o servidor confere; null quando pode deixar offline. */
function porQueNaoDaParaDeixarOffline() {
  const hunt = state.hunt;
  if (hunt) {
    if (hunt.huntId === 'treino') return 'o pátio de treino para quando você sai; use o exercise.';
    if (hunt.manual) return 'na Caça Online o personagem só anda com você na tela.';
    return null;
  }
  if (state.character?.exercicio?.treinando) return null;
  return 'na cidade não há nada para continuar.';
}

// As placas da loja e do mercado ficam na topbar, ao lado de quem está online.
$('store-button').onclick = () => openStore();
$('market-button').onclick = () => openMarket();



// ---------- movimento na cidade ----------

const held = new Set();
const KEYS = {
  w: [0, -1], arrowup: [0, -1],
  s: [0, 1], arrowdown: [0, 1],
  a: [-1, 0], arrowleft: [-1, 0],
  d: [1, 0], arrowright: [1, 0],
  /*
   * As diagonais numa tecla só (report do O O: "implementar as diagonais tb...
   * q, e, z e c"). O servidor já andava na diagonal com duas teclas juntas; estas
   * só mandam o mesmo rumo. Numa Caça Online em que alguma delas é tecla de slot,
   * o slot vence — ver a busca em `hotkeys` no keydown.
   */
  q: [-1, -1], e: [1, -1],
  z: [-1, 1], c: [1, 1],
};

document.addEventListener('keydown', (event) => {
  /*
   * Um slot esperando tecla come a tecla, antes de tudo.
   *
   * Antes do Escape, de propósito: com um slot ouvindo, o Escape cancela a
   * escolha em vez de fechar a janela aberta atrás dela.
   */
  if (capturarTecla(event)) {
    event.preventDefault();
    return;
  }
  if (event.key === 'Escape') {
    // A cruz armada come o Escape: cancelar o arremesso vem antes de fechar
    // uma janela que talvez nem esteja aberta.
    if (mirando !== null || mirandoItem !== null) return desarmarMira();
    /*
     * Escrevendo, o Escape LARGA a caixa de falar — é o par do Enter que a
     * abriu, e a saída para quem abriu o chat sem querer. Vem antes do
     * `closeModal` porque quem está com o cursor piscando numa caixa espera
     * que o Escape fale com ela, e não com uma janela atrás.
     */
    if (document.body.classList.contains('typing') && soltarChat()) return;
    return closeModal();
  }
  const escrevendo =
    document.body.classList.contains('typing') || event.target?.matches?.('input, select, textarea');

  /*
   * ---- Os atalhos com Ctrl, que valem até escrevendo ----
   *
   * Eles vêm ANTES da saída do "está digitando" de propósito. Ctrl+Q e a virada
   * do boneco não competem com o texto — ninguém escreve Ctrl+W dentro de uma
   * frase —, e sair aqui faria os atalhos morrerem justamente na situação mais
   * comum, que é a caixa do chat aberta esperando a próxima frase.
   */
  if (event.ctrlKey && !event.altKey) {
    const tecla = event.key.toLowerCase();

    /*
     * ---- Ctrl+Q volta para a lista de personagens ----
     *
     * O mesmo destino do botão "Sair" do canto, e a mesma pergunta antes: a
     * caçada é encerrada e salva. O atalho não pula a confirmação — ele encurta
     * o caminho até ela, e um atalho de uma tecla que derruba a caçada sem
     * perguntar seria um acidente esperando acontecer.
     */
    if (tecla === 'q') {
      event.preventDefault();
      confirmarSaida();
      return;
    }

    /*
     * ---- Ctrl + WASD (ou setas) VIRA o boneco, sem sair do lugar ----
     *
     * É o gesto da base dele: encarar um lado para soltar a onda para lá, ou só
     * para olhar. Sem isto, a única forma de virar era andar — e andar para
     * virar é justamente o que se quer evitar quando se está posicionado.
     *
     * ---- Sobre o Ctrl+W ----
     *
     * O `preventDefault` cobre o atalho do JOGO. O "fechar aba" do navegador é
     * outra coisa: Chrome, Edge e Firefox reservam Ctrl+W para si e ignoram o
     * `preventDefault` de uma página comum — é uma trava do navegador contra
     * páginas que prendem o usuário, e não há como uma aba normal desligá-la.
     * Ela só não existe quando o jogo roda como aplicativo instalado (janela
     * própria, sem barra de abas), e aí o Ctrl+W chega aqui inteiro.
     */
    // As diagonais (Q, E, Z, C) não viram: Ctrl+C e Ctrl+Z são copiar e desfazer.
    const rumo = KEYS[tecla]?.[0] && KEYS[tecla]?.[1] ? null : KEYS[tecla];
    const daSeta = tecla.startsWith('arrow');

    /*
     * O Ctrl+W morre aqui de qualquer jeito — escrevendo ou não, na cidade ou
     * na caçada. É a metade do pedido que depende só de nós.
     */
    if (tecla === 'w') event.preventDefault();

    /*
     * ---- Escrevendo, só as SETAS viram ----
     *
     * Com a caixa do chat aberta, Ctrl+A é "selecionar tudo" e Ctrl+S, Ctrl+D
     * são gestos de texto que a pessoa tem na mão. Tomá-los para virar o boneco
     * trocaria coisas que se usam o tempo todo por uma que quase ninguém faria
     * no meio de uma frase. As setas não têm esse conflito: dentro de um
     * `input` com Ctrl elas não fazem nada que se perca.
     */
    if (rumo && (daSeta || !escrevendo)) {
      event.preventDefault();
      /*
       * Duas mensagens para o mesmo gesto, porque são dois mapas: dentro da
       * caçada quem sabe virar é a sessão, na cidade é a presença. Na caçada
       * AUTOMÁTICA não se manda nada — ali quem escolhe o rumo é a IA, e uma
       * virada na mão seria desfeita no tique seguinte.
       */
      if (!event.repeat) {
        if (state.hunt?.manual) send({ t: 'huntVirar', dx: rumo[0], dy: rumo[1] });
        else if (!state.hunt) send({ t: 'virar', dx: rumo[0], dy: rumo[1] });
      }
      return;
    }
    if (tecla === 'w') return;
  }

  if (escrevendo) return;

  /*
   * ---- Enter abre a caixa de falar ----
   *
   * O pedido: "quando eu apertar enter tem q ligar o chat automaticamente pra
   * poder digitar já, e enter de novo manda." O segundo Enter já funcionava —
   * a caixa mora num `form`. Faltava o primeiro.
   *
   * NÃO com uma janela aberta. Ali o Enter é do botão em foco: confirmar a
   * compra, o OK da régua de quantidade, o "Entendi" de um aviso. Roubá-lo
   * faria toda confirmação por teclado deixar de existir — e o pior tipo de
   * atalho novo é o que apaga um antigo em silêncio.
   *
   * As duas perguntas são duas porque são duas camadas: `#modal` é a janela
   * única do jogo, e `.confirm-back` é o fundo das caixinhas de confirmar, que
   * são nós soltos no `body`. Cada uma tem o seu Enter.
   */
  if (event.key === 'Enter') {
    if (!$('modal').hidden) return;
    if (document.querySelector('.confirm-back')) return;
    event.preventDefault();
    focarChat();
    return;
  }

  const key = event.key.toLowerCase();

  /*
   * Caça Online: a tecla de cada slot dispara aquele slot.
   *
   * A tabela era fixa — 1..9, 0, - e = na ordem dos slots — e por isso a magia
   * de ataque, que mora nos slots do fim, caía sempre nas teclas mais longe da
   * mão. Agora quem diz qual tecla é de qual slot é o PERSONAGEM
   * (`character.hotkeys`, montado e guardado no servidor); aqui só se procura.
   *
   * Cada tecla é uma ordem única — nada de repetir enquanto se segura, senão a
   * primeira magia queimaria a mana toda no cooldown do grupo.
   */
  if (state.hunt?.manual && !event.repeat) {
    const slot = (state.character?.hotkeys ?? []).indexOf(key);
    if (slot >= 0) {
      event.preventDefault();
      dispararSlot(slot);
      return;
    }
  }

  if (!KEYS[key]) return;
  event.preventDefault();
  /*
   * O auto-repetir do teclado dispara `keydown` sem parar enquanto a tecla
   * esta' apertada. Tecla que ja' esta' na mao nao mudou rumo nenhum: sai aqui,
   * senao o aviso abaixo viraria uma mensagem a cada repeticao do sistema.
   */
  if (held.has(key)) return;
  held.add(key);
  /*
   * ---- O rumo viaja na hora da tecla, e nao no proximo tique de 100ms ----
   *
   * O reforco de 100ms la' embaixo era o UNICO lugar que mandava o rumo, entao
   * apertar W custava esperar ate' 100ms so' para a intencao sair daqui — e
   * depois ainda os ate' 125ms do tique do servidor, mais a ida e volta.
   *
   * Medido em localhost, do "apertei" ate' o boneco sair do lugar: 145ms na
   * mediana esperando o tique do cliente, contra 65ms mandando na hora. Era o
   * que fazia o WASD da cidade PARECER mais lento que a caminhada da caçada —
   * o ritmo do passo sempre foi o mesmo (250ms nos dois, pela mesma formula),
   * o que se sentia era a partida.
   *
   * O reforco continua existindo, e continua sendo o que segura a tecla
   * apertada: ele so' deixou de ser a primeira noticia.
   */
  mandarRumo();
});

/*
 * Soltar a tecla precisa AVISAR o servidor.
 *
 * Quem anda agora é o tique do servidor, a partir do rumo guardado — é o que
 * dá à caminhada na mão o mesmo ritmo da automática. O outro lado disso é que
 * o rumo não some sozinho: sem este aviso, o personagem seguiria andando meio
 * segundo além da tecla (o prazo de validade do rumo).
 */
const pararDeAndar = () => {
  /*
   * A cidade tambem tem rumo agora.
   *
   * Ela andava um passo por mensagem, e por isso soltar a tecla nao precisava
   * avisar ninguem: parava sozinho. Agora quem anda e' o tique do servidor, a
   * partir do rumo guardado — sem este aviso o personagem seguiria meio segundo
   * alem da tecla, que e' o prazo de validade do rumo.
   */
  if (state.hunt?.manual) send({ t: 'huntWalk', dx: 0, dy: 0 });
  else if (!state.hunt) send({ t: 'walk', dx: 0, dy: 0 });
};
document.addEventListener('keyup', (event) => {
  if (!held.delete(event.key.toLowerCase())) return;
  // Soltou UMA de duas teclas: o rumo mudou (a diagonal virou reta) e o
  // servidor precisa saber agora, pelo mesmo motivo do `keydown`.
  if (!held.size) pararDeAndar();
  else mandarRumo();
});
window.addEventListener('blur', () => {
  if (!held.size) return;
  held.clear();
  pararDeAndar();
});

/** Diz ao servidor para onde as teclas apontam agora. */
function mandarRumo() {
  if (!held.size) return;
  // Na caçada automática o teclado não anda: quem manda no boneco é a rota.
  if (state.hunt && !state.hunt.manual) return;
  let dx = 0;
  let dy = 0;
  for (const key of held) {
    dx += KEYS[key][0];
    dy += KEYS[key][1];
  }
  if (!dx && !dy) return;
  const passo = { dx: Math.sign(dx), dy: Math.sign(dy) };
  send(state.hunt ? { t: 'huntWalk', ...passo } : { t: 'walk', ...passo });
}

/*
 * O reforco da tecla segurada.
 *
 * Quem da' a PRIMEIRA noticia e' o `keydown`; este laco existe para o rumo nao
 * vencer no servidor (`VALIDADE_DO_RUMO`, meio segundo) enquanto a tecla
 * continua apertada. O servidor decide o ritmo do passo; aqui so' repetimos a
 * intencao.
 */
setInterval(mandarRumo, 100);

/*
 * ---- O ANALÓGICO do celular é um teclado de mentira ----
 *
 * Ele não manda `walk` nem `huntWalk`: acende e apaga as mesmas teclas no
 * `held` e chama as mesmas duas funções que o teclado chama.
 *
 * O motivo está escrito por extenso no `mobile.mjs`, e o resumo é: o caminho
 * do teclado já resolve a trava da caçada automática, a escolha entre o `walk`
 * da cidade e o `huntWalk` da caçada, o reforço de 100ms e o aviso de "soltei".
 * Um segundo caminho seria duas implementações que precisam concordar para
 * sempre — e a segunda envelheceria calada, porque ninguém testa no celular.
 */
const TECLAS_DO_RUMO = ['w', 'a', 's', 'd'];
// O perfil (retrato, deitado, tablet, desktop) antes de tudo que depende dele.
ligarPerfil();
// O piso de 12px vale desde o portão (a lista de personagens também).
ligarFonteMinima();
acertarOAnalogico = initMobile({
  apontar(dx, dy) {
    for (const tecla of TECLAS_DO_RUMO) held.delete(tecla);
    if (dx < 0) held.add('a');
    if (dx > 0) held.add('d');
    if (dy < 0) held.add('w');
    if (dy > 0) held.add('s');
    mandarRumo();
  },
  soltar() {
    for (const tecla of TECLAS_DO_RUMO) held.delete(tecla);
    /*
     * Só avisa que parou se não houver MAIS NADA apertado: num tablet com
     * teclado, soltar o analógico com o W na mão não pode parar o boneco.
     */
    if (held.size) mandarRumo();
    else pararDeAndar();
  },
  /*
   * Andar só existe na cidade e na Caça Online. Na automática quem escolhe o
   * rumo é a rota, e um controle que não move nada faz o jogo parecer travado.
   */
  podeAndar: () => !!state.character && (!state.hunt || !!state.hunt.manual) && analogicoLigado(),
});

/*
 * ---- Os dois botões do mouse no mapa ----
 *
 * Como no client: ESQUERDO ANDA, DIREITO ATACA.
 *
 * Antes os dois faziam a mesma coisa e essa coisa era mirar, então na Caça
 * Online não havia como andar com o mouse — só com o teclado. Agora o esquerdo
 * manda o personagem até a casa clicada (o `walkTo` da cidade tem um irmão
 * dentro da caçada, `huntWalkTo`, que usa o pathfinder da hunt) e o direito
 * escolhe o alvo.
 *
 * Clicar com o direito numa casa vazia larga o alvo — é como se solta o bicho
 * no client. A criatura é procurada pela posição, que é o que o clique conhece.
 */
/*
 * ---- A cruz do arremesso ----
 *
 * Runa de área não cai em cima do próprio pé: no client dele o cursor vira uma
 * cruz e o jogador clica na casa onde quer que ela caia. Aqui é o mesmo gesto —
 * apertar a tecla do slot ARMA a runa, e o clique seguinte diz onde.
 *
 * `mirando` guarda o slot armado. Enquanto ele existe, o esquerdo lança em vez
 * de andar, e o direito (ou Esc, ou apertar a tecla de novo) desarma.
 *
 * Quem decide se a runa pede lugar é o catálogo, no campo `miraNoChao` — a
 * mesma resposta que o servidor usa para centrar a área. Com a assistência
 * ligada ela não pede nada: aí a mira é da máquina, e a runa sai sozinha onde
 * houver mais bicho.
 */
let mirando = null;
/* =========================================================================
 * E A CRUZ TAMBÉM PODE VIR DE UM ITEM DA MOCHILA
 *
 * "ou usar da mochila ao clicar com botao direito nela: fica um crosshair e eu
 *  tenho que selecionar onde eu quero cortar."
 *
 * Duas variáveis e não uma com dois formatos. `mirando` guarda um SLOT (um
 * número, e o zero é um slot válido — por isso as comparações com `null`);
 * `mirandoItem` guarda um id de item. Enfiar os dois no mesmo campo pediria um
 * discriminador e um `typeof` em todo lugar que hoje só pergunta se há mira.
 *
 * As duas nunca valem juntas: armar uma desarma a outra.
 * ========================================================================= */
let mirandoItem = null;

export function armarMiraDeItem(itemId, nome) {
  desarmarMira();
  mirandoItem = Number(itemId);
  document.body.classList.add('mirando');
  notice(`${nome ?? 'Item'}: clique na casa (Esc cancela).`);
}

function acaoDoSlot(slot) {
  const id = state.character?.actions?.[slot]?.id;
  if (!id) return null;
  /*
   * `actionCatalog`, e nao `catalog`.
   *
   * Sao dois catalogos diferentes e o nome parecido escondeu isso: `catalog` e'
   * o estatico do jogo (hunts, vocacoes, skills) e NAO tem magia nenhuma
   * dentro; quem tem as magias, as runas e as pocoes — com o campo
   * `miraNoChao` — e' o `actionCatalog`, que chega na mensagem do mesmo nome.
   *
   * O efeito do engano era exatamente este: a busca nunca achava a runa, o
   * `miraNoChao` saia `undefined`, e a avalanche voava direto no alvo em vez de
   * abrir a cruz para escolher onde cai.
   */
  const catalogo = state.actionCatalog ?? {};
  return (
    [...(catalogo.spells ?? []), ...(catalogo.runes ?? []), ...(catalogo.items ?? [])].find(
      (entry) => entry.id === id
    ) ?? null
  );
}

function armarMira(slot) {
  mirandoItem = null;
  mirando = slot;
  document.body.classList.add('mirando');
  const acao = acaoDoSlot(slot);
  notice(`${acao?.name ?? 'Runa'}: clique onde ela cai (Esc cancela).`);
}

function desarmarMira() {
  if (mirando === null && mirandoItem === null) return;
  mirando = null;
  mirandoItem = null;
  document.body.classList.remove('mirando');
}

/** A tecla de um slot: dispara na hora, ou arma a cruz se a runa pedir lugar. */
function dispararSlot(slot) {
  if (mirando === slot) return desarmarMira();
  const acao = acaoDoSlot(slot);
  // Com assistência a máquina mira: a runa sai sozinha, como na automática.
  if (acao?.miraNoChao && !state.hunt?.assistencia && !state.hunt?.autoBarra) return armarMira(slot);
  send({ t: 'huntAction', slot });
}

/*
 * ---- O balão do MOB com raridade (fase 3 dos modificadores) ----
 *
 * Parou o mouse em cima de um mob que não é normal: o nome na cor da raridade,
 * o level, o que a raridade muda (vida, dano, exp, loot) e cada modificador com
 * o que ele FAZ. O texto vem do servidor no welcome (`mobModificadores`), gerado
 * dos mesmos dados que o combate usa — nenhuma frase escrita aqui.
 */
let textoDosModificadores = {};
let balaoDoMob = null;
let chaveDoBalao = null;

function esconderBalaoDoMob() {
  if (balaoDoMob) balaoDoMob.hidden = true;
  chaveDoBalao = null;
}

function mostrarBalaoDoMob(bicho, evento) {
  const chave = `${bicho.uid}|${bicho.raridade}|${(bicho.mods ?? []).join(',')}|${bicho.nivel}|${bicho.lvExtra}`;
  if (!balaoDoMob) {
    balaoDoMob = document.createElement('div');
    balaoDoMob.className = 'tooltip painel balao-do-mob';
    document.body.append(balaoDoMob);
  }
  if (chave !== chaveDoBalao) {
    chaveDoBalao = chave;
    const r = dadosDaRaridade(bicho.raridade);
    balaoDoMob.style.setProperty('--tier', r?.cor ?? 'var(--copper)');
    balaoDoMob.innerHTML = '';
    const cabeca = document.createElement('div');
    cabeca.className = 'balao-do-mob-cabeca';
    const nome = document.createElement('strong');
    nome.textContent = bicho.name;
    nome.style.color = r?.cor ?? '';
    cabeca.append(nome);
    if (bicho.nivel != null) {
      const lv = document.createElement('span');
      // Com os levels a mais da raridade: "Lv 20 (8 +12)".
      lv.textContent = bicho.lvExtra ? `Lv ${bicho.nivel} (${bicho.nivel - bicho.lvExtra} +${bicho.lvExtra})` : `Lv ${bicho.nivel}`;
      cabeca.append(lv);
    }
    const raridade = document.createElement('div');
    raridade.className = 'balao-do-mob-raridade';
    raridade.textContent = [r?.nome ?? bicho.raridade, r?.resumo].filter(Boolean).join(' — ');
    raridade.style.color = r?.cor ?? '';
    balaoDoMob.append(cabeca, raridade);
    if (bicho.mods?.length) {
      const lista = document.createElement('div');
      lista.className = 'balao-do-mob-mods';
      for (const m of bicho.mods) {
        const linha = document.createElement('p');
        const titulo = document.createElement('b');
        titulo.textContent = m;
        linha.append(titulo);
        if (textoDosModificadores[m]) linha.append(document.createTextNode(` — ${textoDosModificadores[m]}`));
        lista.append(linha);
      }
      balaoDoMob.append(lista);
    }
  }
  balaoDoMob.hidden = false;
  // Ao lado do ponteiro, sem sair da tela.
  const { innerWidth: w, innerHeight: h } = window;
  const caixa = balaoDoMob.getBoundingClientRect();
  const x = evento.clientX + 18 + caixa.width > w ? evento.clientX - 12 - caixa.width : evento.clientX + 18;
  const y = Math.min(h - caixa.height - 8, evento.clientY + 14);
  balaoDoMob.style.left = `${Math.max(8, x)}px`;
  balaoDoMob.style.top = `${Math.max(8, y)}px`;
}

mapView.onTileHover = (casa, evento) => {
  if (!casa || !state.hunt) return esconderBalaoDoMob();
  const bicho = (state.hunt.monsters ?? []).find((m) => m.x === casa.x && m.y === casa.y && m.hp > 0 && m.raridade && m.raridade !== 'normal');
  if (!bicho) return esconderBalaoDoMob();
  mostrarBalaoDoMob(bicho, evento);
};

/*
 * ---- Baús e altares da caçada ----
 * Os marcadores vêm do servidor (`instancia.encontros`). Tocar no encontro ao alcance pede para interagir; o servidor
 * confere distância, requisitos e "uma vez só". Longe, o clique segue como um passo normal.
 */
function pedirInteracao(encontro) {
  if (encontro.decisao && encontro.estado === 'disponivel') return abrirJanelaDeDecisao(encontro);
  send({ t: 'interagir', id: encontro.id });
}

/** A janela de decisão (área secreta, escolta): quem decide é o líder da party (ou quem está sozinho) — o servidor confere. */
function abrirJanelaDeDecisao(encontro) {
  document.getElementById('janela-decisao')?.remove();
  const janela = el('div', 'janela-decisao');
  janela.id = 'janela-decisao';
  const fechar = () => janela.remove();
  const responder = (aceitar) => {
    send({ t: 'decidir', id: encontro.id, aceitar });
    fechar();
  };
  const aceitar = el('button', 'decisao-sim', encontro.tipo === 'escolta' ? 'Partir' : 'Entrar');
  const recusar = el('button', 'decisao-nao', 'Recusar');
  const depois = el('button', 'decisao-depois', 'Decidir depois');
  aceitar.type = recusar.type = depois.type = 'button';
  aceitar.onclick = () => responder(true);
  recusar.onclick = () => responder(false);
  depois.onclick = fechar;
  janela.append(el('h3', '', encontro.nome), el('p', '', encontro.descricao ?? (encontro.tipo === 'escolta' ? 'Alguém precisa de proteção na travessia.' : 'Uma passagem escondida.')), el('p', 'decisao-dica', 'Em grupo, quem decide é o líder. Recusar descarta esta oportunidade.'), el('div', 'decisao-botoes'));
  janela.lastChild.append(aceitar, recusar, depois);
  document.body.append(janela);
}

/** O botão "Interagir": aparece (só na caça online) quando há um baú ou altar ao alcance, e some quando não há. */
function atualizarBotaoDeInteragir() {
  const hunt = state.hunt;
  const perto = hunt?.manual ? encontroPerto(hunt.instancia?.encontros, hunt.player ?? {}, hunt.z) : null;
  let botao = document.getElementById('btn-interagir');
  if (!perto) return void botao?.setAttribute('hidden', '');
  if (!botao) {
    botao = el('button', 'btn-interagir');
    botao.id = 'btn-interagir';
    botao.type = 'button';
    document.body.append(botao);
  }
  botao.dataset.encontro = perto.id;
  botao.textContent = perto.tipo === 'altar' ? `Ativar: ${perto.nome}` : perto.tipo === 'sobrevivencia' || perto.tipo === 'fenda' ? `Iniciar: ${perto.nome}` : perto.tipo === 'aprisionado' ? `Libertar: ${perto.nome}` : perto.decisao && perto.estado === 'disponivel' ? `Decidir: ${perto.nome}` : `Abrir: ${perto.nome}`;
  botao.onclick = () => pedirInteracao(perto);
  botao.removeAttribute('hidden');
}

mapView.onTileClick = (x, y) => {
  // Clique esquerdo no boneco de um NPC fala com ele. Ver `falarComNpcEm`.
  if (!state.hunt && falarComNpcEm(x, y)) return;
  /*
   * ---- E num móvel do mapa, abre o que ele faz ----
   *
   * O boneco de treino e o skill trainer OCUPAM a casa deles (é assim que dá
   * para encostar em vez de pisar em cima), então um clique esquerdo ali não
   * tem caminho e voltava com "não dá para chegar lá" — que lê como móvel
   * quebrado. O direito já abria a escolha da arma; agora o esquerdo abre
   * também, que é o gesto que se faz num objeto novo na tela.
   */
  if (!state.hunt && abrirObjetoEm(x, y)) return;
  if (!state.hunt) return send({ t: 'walkTo', x, y });
  if (!state.hunt.manual) return;
  const encontroAqui = encontroNaCasa(state.hunt.instancia?.encontros, x, y, state.hunt.z);
  if (encontroAqui && encontroPerto([encontroAqui], state.hunt.player ?? {}, state.hunt.z)) return pedirInteracao(encontroAqui);
  /*
   * A mira de ITEM vem antes da de slot por uma razão boba e real: as duas
   * nunca valem juntas, mas se um dia valerem, o gesto que o jogador acabou de
   * armar é o que ele quer — e ele é este.
   */
  if (mirandoItem !== null) {
    const id = mirandoItem;
    desarmarMira();
    return send({ t: 'usarNoChao', id, x, y });
  }
  if (mirando !== null) {
    const slot = mirando;
    desarmarMira();
    return send({ t: 'huntAction', slot, x, y });
  }
  /*
   * ---- No CELULAR, tocar no bicho ataca ----
   *
   * "eu preciso conseguir atacar os bixos na caça online pelo celular clicando
   * no bixo."
   *
   * No computador a divisão é a do Tibia: esquerdo anda, direito ataca. Num
   * telefone não existe botão direito — e o toque, que é o único gesto que há,
   * caía no "anda até lá". Dava para andar em cima do bicho e nunca para
   * atacá-lo: a Caça Online era injogável no celular.
   *
   * Então no celular o toque decide pelo que está NA CASA: bicho vivo ali,
   * ataca; casa vazia, anda. É a mesma escolha que o jogador faria, e é o que
   * todo jogo de toque faz com um alvo.
   *
   * O mesmo `huntTarget` do botão direito, de propósito — o alvo é um só, e
   * dois caminhos para escolhê-lo seriam dois lugares para consertar.
   */
  if (ehCelular()) {
    const bicho = (state.hunt.monsters ?? []).find((m) => m.x === x && m.y === y && m.hp > 0);
    if (bicho) return send({ t: 'huntTarget', uid: bicho.uid });
  }
  send({ t: 'huntWalkTo', x, y });
};

/*
 * ---- O botão direito, em ordem de prioridade ----
 *
 *   1. Ctrl + direito em MIM        → aparência e montaria
 *   2. direito em OUTRA PESSOA      → mensagem, amizade, party, troca
 *   3. direito em qualquer outro lugar → o que ele já fazia (mirar, andar)
 *
 * Gente vem antes de bicho porque uma pessoa e um monstro nunca dividem a
 * mesma casa: se há alguém ali, é com ela que se quer falar.
 */
/*
 * ---- Soltar a peça numa casa do mapa ----
 *
 * A regra de ONDE dá para largar é do servidor (`chaoDoPersonagem`): cidade e
 * Caça Online, os dois lugares em que alguém decide o passo. Aqui só se evita
 * o pedido que já se sabe que vai voltar recusado — na Caça Automática o mapa
 * está na tela, e arrastar para ele sem aviso nenhum parece um bug.
 *
 * O shift pergunta quanto, como em toda outra área que aceita item: é o mesmo
 * `quantosMover` da mochila, da bolsa e do depósito.
 */
/*
 * ---- Clique esquerdo no NPC fala com ele ----
 *
 * O direito abre o menu, e o menu é a saída completa. Mas ninguém clica com o
 * direito num boneco novo: clica-se com o esquerdo, e um esquerdo que só anda
 * até a casa dele faz o NPC parecer decoração.
 *
 * A casa do NPC é chão livre, então o "ir até lá" continua acontecendo — ele
 * apenas para ao lado, porque o corpo ocupa a casa. O que se ganha é a janela
 * abrindo no gesto que a pessoa já fez.
 */
const falarComNpcEm = (x, y) => {
  const npc = (state.city?.npcs ?? []).find((quem) => quem.x === x && quem.y === y);
  if (!npc) return false;
  send({ t: 'falarComNpc', id: npc.id });
  return true;
};

/**
 * O móvel do mapa que ocupa esta casa, se houver.
 *
 * A lista vem do retrato da cidade — os `exercise dummy` que o dono desenhou,
 * os que um god plantou, e os marcos como o `skill trainer` —, então nem o
 * clique esquerdo nem o direito precisam perguntar nada ao servidor.
 */
const objetoEm = (x, y) => (state.city?.objetos ?? []).find((o) => o.x === x && o.y === y) ?? null;

/*
 * ---- O que cada móvel abre ----
 *
 * Quem decide é o SERVIDOR, no campo `acao` de cada objeto: ele é quem sabe o
 * que é cada coisa que plantou no mapa. Aqui só há o despacho.
 *
 * Era por eliminação — "está na lista de objetos, logo é boneco de treino" —, e
 * isso funcionou exatamente até a lista ganhar um segundo tipo de móvel: o
 * skill trainer teria aberto a escolha de arma de exercise.
 */
const ABERTURAS_DE_OBJETO = {
  exercise: () => openExerciseRapido(),
  'treino-offline': () => openTreinoOffline(),
  arvore: () => openPassivas(),
  aventuras: () => openHunts(),
  forja: () => openForja(),
  imbuements: () => openImbuements(),
  // Não é janela: é a porta da arena. Quem decide se entra é o servidor.
  'boss-diarios': () => send({ t: 'entrarNaArena' }),
};

/*
 * ---- Pisar no portal de Aventuras abre a janela ----
 *
 * O dono: "ao pisar ou clicar". O clique já vem pelo `abrirObjetoEm`; o pisar é
 * aqui, a cada retrato da cidade: quando o personagem CHEGA numa casa marcada
 * com `pisar`, a janela abre uma vez. Ficar parado em cima não reabre a cada
 * quadro — só sair e voltar.
 */
let casaPisada = null;
function conferirPisada(cidade) {
  const eu = cidade?.player;
  const chave = eu ? `${eu.x},${eu.y},${eu.z ?? 7}` : null;
  if (chave === casaPisada) return;
  const antes = casaPisada;
  casaPisada = chave;
  // A primeira casa depois de entrar não conta: ninguém "pisou", ele nasceu ali.
  if (!eu || antes === null) return;
  const objeto = (cidade.objetos ?? []).find((o) => o.pisar && o.x === eu.x && o.y === eu.y);
  if (objeto) ABERTURAS_DE_OBJETO[objeto.acao]?.();
}

/** Abriu alguma coisa? `false` quando não há móvel na casa, ou ele é mudo. */
const abrirObjetoEm = (x, y) => {
  const abrir = ABERTURAS_DE_OBJETO[objetoEm(x, y)?.acao];
  if (!abrir) return false;
  abrir();
  return true;
};

mapView.onTileDrop = (x, y, carga) => {
  if (!carga?.id) return;
  if (state.hunt && !state.hunt.manual) {
    return notice('Na Caça Automática não dá para largar nada no chão.');
  }
  if (!state.hunt && !state.city) return;
  /*
   * Peça que já estava no chão: é uma mudança de casa, e não uma largada.
   *
   * Ela não passa pela mochila — nem o peso nem o espaço entram na conta, como
   * no client. Ver o `mover` de `chao.mjs`.
   */
  if (carga.from === 'chao') {
    if (carga.x === x && carga.y === y) return;
    /*
     * `deIndice` só vem do browse field, que é o único lugar em que se aponta
     * uma peça que não é a de cima. Arrastando do mapa, a peça apontada É a de
     * cima — é a única desenhada — e o servidor faz o de sempre.
     */
    return send({ t: 'largar', de: { x: carga.x, y: carga.y }, x, y, deIndice: carga.indice ?? null });
  }
  /*
   * A bolsa de loot é outra sacola, e o servidor larga da MOCHILA.
   *
   * Arrastar da bolsa direto para o chão daria "você não tem esse item", que é
   * verdade e não ajuda ninguém. A peça passa pela mochila primeiro — o mesmo
   * caminho que o jogador faria com dois arrastos.
   */
  // Largar lê a MOCHILA: vindo da Store Inbox largaria a cópia de lá.
  if (carga.from === 'storeInbox') return notice('Leve da Store Inbox para a mochila primeiro.');
  quantosMover(carga, (quantos) => {
    if (carga.from === 'pouch') send({ t: 'pouch', id: carga.id, count: quantos, to: 'bag' });
    // Da mochila, a cópia arrastada (`alvo`); da bolsa ela passa pela mochila e o índice não vale.
    send({ t: 'largar', id: carga.id, count: quantos, x, y, alvo: carga.from === 'pouch' ? null : carga.alvo ?? null });
  });
};

/*
 * ---- BROWSE FIELD: a casa aberta como uma sacola ----
 *
 * "tem que ter a função browse field também."
 *
 * No client do dono é a mesma janela de container apontada para um tile: a
 * pilha aparece inteira, de cima para baixo, e dali se tira qualquer peça. Aqui
 * ele é um modal pela mesma razão que o depósito é — a tela do telefone não
 * comporta mais uma janela flutuante, e esta se abre para fazer uma coisa e
 * fecha.
 *
 * ---- Nada é perguntado ao servidor ----
 *
 * A pilha inteira já vem no retrato do lugar (`chao[].pilha`, ver `paraTela` em
 * `chao.mjs`), então abrir não custa uma viagem e a lista se corrige sozinha a
 * cada quadro: se um companheiro levar a peça de baixo enquanto a janela está
 * aberta, ela some da lista em vez de virar um clique que falha.
 *
 * ---- A ordem é a da TELA, e o índice é o do SERVIDOR ----
 *
 * A pilha mora do fundo para o topo (é a ordem em que foi largada). Quem olha
 * quer ver de cima para baixo, que é a ordem em que as peças saem. A lista é
 * desenhada ao contrário e cada linha leva o índice de verdade junto — traduzir
 * é trabalho de quem desenha, e mandar "a terceira que você está vendo" seria
 * pedir ao servidor para adivinhar de que ponta se está contando.
 */
/* Qual casa a janela do chão está mostrando agora. `null` = fechada. */
let casaDoBrowse = null;
/* O que ela desenhou por último, para não refazer a grade a cada quadro. */
let chaveDoBrowse = null;

const pilhaDoBrowse = () =>
  casaDoBrowse
    ? (mapView.chao ?? []).find((peca) => peca.x === casaDoBrowse.x && peca.y === casaDoBrowse.y)?.pilha ?? []
    : [];

/*
 * Redesenha a janela do chão — e só quando a casa MUDOU.
 *
 * Ela é chamada a cada retrato do servidor (oito por segundo numa caçada), e
 * refazer a grade em todos custaria o mesmo que o analisador custava antes de
 * ser preso: DOM refeito debaixo do dedo de quem está arrastando. A chave é a
 * pilha em texto; enquanto ela não muda, não há nada a desenhar.
 *
 * `forcar` é para o momento da abertura, quando não há chave anterior.
 */
function renderBrowse(forcar = false) {
  if (!isVisible('browse') || !casaDoBrowse) return;
  const pilha = pilhaDoBrowse();
  const chave = pilha.map((peca) => `${peca.item}x${peca.count}`).join('|');
  if (!forcar && chave === chaveDoBrowse) return;
  chaveDoBrowse = chave;

  const { x, y } = casaDoBrowse;
  const body = windowBody('browse');
  if (!body) return;
  body.innerHTML = '';

  if (!pilha.length) {
    body.append(el('p', 'campo-aviso', 'Não há mais nada nesta casa.'));
    return;
  }

  const caixa = el('div', 'browse-field');
  const grade = el('div', 'browse-grade');
  // De cima para baixo: a última largada é a primeira que sai, e é a que o
  // olho encontra primeiro num container.
  for (let i = pilha.length - 1; i >= 0; i--) {
    const peca = pilha[i];
    /*
     * O MESMO quadradinho da mochila (`itemCell`): moldura da raridade,
     * contagem no canto, balão ao apontar e — o que importa aqui — o
     * arrasto já ligado. É o que faz a casa do chão se comportar como uma
     * sacola sem ninguém aprender um gesto novo.
     */
    const cela = itemCell({ id: peca.item, count: peca.count ?? 1 }, 'chao', {
      size: 30,
      titulo: `${peca.nome ?? `item ${peca.item}`} — arraste para a mochila ou para outra casa; clique para pegar`,
      onClick: () => send({ t: 'pegar', x, y, indice: i }),
    });
    /*
     * ---- E o arrasto leva a CASA e o ÍNDICE ----
     *
     * `itemCell` monta a carga que a mochila usa: id, quantos, a pilha. Ela
     * não tem como saber de que casa do mapa a peça veio nem qual das dez
     * da pilha ela é — são coisas do chão, e o chão é o único lugar onde
     * elas existem.
     *
     * Um segundo ouvinte de `dragstart` reescreve a carga: `setData` com o
     * mesmo formato substitui o que o primeiro pôs, e os dois rodam na
     * ordem em que foram registrados. Sai mais barato do que uma segunda
     * `itemCell` com dois parâmetros a mais que só esta tela usaria.
     *
     * O índice é o de VERDADE (contado do fundo), e não o da posição na
     * grade — ver a nota do `pegar`, em `chao.mjs`. O servidor confere se
     * ele ainda existe antes de tirar: entre desenhar e soltar o dedo, um
     * companheiro pode ter levado a peça de cima.
     */
    cela.addEventListener('dragstart', (evento) => {
      evento.dataTransfer.setData(
        'text/plain',
        JSON.stringify({
          id: peca.item,
          from: 'chao',
          count: peca.count ?? 1,
          x,
          y,
          indice: i,
          pedir: !!evento.shiftKey,
        })
      );
      evento.dataTransfer.effectAllowed = 'move';
    });
grade.append(cela);
  }
  caixa.append(grade);
  caixa.append(el('span', 'browse-nota', 'Clique para pegar, ou arraste para onde quiser.'));
  body.append(caixa);
}

/*
 * ---- BROWSE FIELD: a casa do chão aberta como uma sacola ----
 *
 * "tem que ter a função browse field também." E, depois de vê-lo como modal:
 * "seria quadrado, e não seria um modal assim, senão eu não consigo arrastar
 * pra outros lado do mapa."
 *
 * A pilha inteira já vem no retrato do lugar (`chao[].pilha`, ver `paraTela` em
 * `chao.mjs`), então abrir não custa uma viagem ao servidor e a lista se
 * corrige sozinha: se um companheiro levar a peça de baixo com a janela aberta,
 * ela some da grade em vez de virar um clique que falha.
 */
function abrirBrowseField(x, y) {
  casaDoBrowse = { x, y };
  chaveDoBrowse = null;
  setTitle('browse', `Chão em ${x}, ${y}`);
  setVisible('browse', true);
  renderBrowse(true);
}

mapView.onTileRight = (x, y, evento) => {
  // Runa armada: o direito é o "deixa pra lá" do client dele.
  if (mirando !== null || mirandoItem !== null) return desarmarMira();
  const eu = state.hunt?.player ?? state.city?.player;
  if (evento?.ctrlKey && eu && eu.x === x && eu.y === y) return menuDeMim(evento);

  /*
   * ---- O NPC vem antes de tudo ----
   *
   * Ele fica parado numa casa só, e é justamente por isso que a casa dele é
   * clicada de propósito: ninguém acerta o Banker por acaso. O que estivesse
   * embaixo dele (o chão, o armário do banco, a pilha) só apareceria se o menu
   * do NPC não existisse.
   */
  const npc = (state.city?.npcs ?? []).find((quem) => quem.x === x && quem.y === y);
  if (npc && evento) {
    return openMenu(evento, [
      {
        cabeca: npc.name,
        sub: npc.tipo === 'banco' ? 'banqueiro de Draevor' : 'mercadora',
        arte: outfitCanvas(npc.colors ?? { type: npc.look }, 32),
      },
      { divider: true },
      {
        label: npc.tipo === 'banco' ? 'Abrir o banco' : 'Ver o que ela vende',
        action: () => send({ t: 'falarComNpc', id: npc.id }),
      },
      { label: 'Ir até lá', action: () => send({ t: 'walkTo', x, y }) },
    ]);
  }

  const gente = [...(state.city?.players ?? []), ...(state.hunt?.aliados ?? [])];
  const alguem = gente.find((quem) => quem.x === x && quem.y === y);
  /*
   * ---- NA ARENA, O DIREITO ATACA ----
   *
   * O dono: "nessa area ao clicar com o botao direito na pessoa tem que atacar
   * ela e nao abrir o modal pra enviar mensagem sabe?"
   *
   * Ele tem razao, e o motivo e' o mesmo do resto do mapa: dentro de uma
   * caçada, o botao direito num BICHO ja ataca sem perguntar nada. Uma pessoa
   * dentro de uma arena de x1 e' a mesma coisa que um bicho numa caverna — e'
   * o que se veio fazer ali. Abrir um menu com "Mensagem privada" no meio de um
   * duelo e' o jogo perguntando duas vezes o obvio.
   *
   * O Ctrl continua abrindo o menu, e isso nao e' consolo: e' a MESMA regra que
   * a escada de mao e o inventario ja seguem nesta tela — o gesto curto faz, o
   * gesto com Ctrl pergunta. E' por ali que se chega em "Mensagem privada",
   * "Adicionar aos amigos" e nas ferramentas de quem modera.
   *
   * Fora de um lugar de pvp nada muda: `state.hunt.pvp` e' falso na cidade, nas
   * setenta e cinco hunts, no patio e na area de Boss Diarios.
   */
  if (alguem && evento && state.hunt?.pvp && !evento.ctrlKey) {
    const noDuelo = (state.hunt?.aliados ?? []).some((quem) => quem.name === alguem.name);
    if (noDuelo) return send({ t: 'huntTarget', uid: `aliado:${alguem.name}` });
  }
  if (alguem && evento) return menuDeJogador(evento, alguem.name);

  /*
   * ---- Pegar o que está no chão ----
   *
   * Antes do locker e antes do boneco de propósito: uma peça largada é a coisa
   * mais nova naquela casa, e é dela que o clique fala. Um item em cima do
   * armário do banco não pode virar "abrir o depósito".
   *
   * O menu diz o NOME em vez de pegar direto. Pegar é o gesto certo em quase
   * todo clique, mas não em todos — a casa pode ter uma peça de outra pessoa
   * que ela largou de propósito, e uma mochila cheia devolve um erro que não
   * explica o que se estava tentando fazer. Com o nome na linha, o clique é
   * uma escolha.
   *
   * A lista vem do retrato do lugar (`chao`), então nada é perguntado ao
   * servidor para montar o menu. Quem confere alcance e mochila é ele.
   */
  const noChao = (mapView.chao ?? []).find((peca) => peca.x === x && peca.y === y);
  if (noChao && evento) {
    const quantas = noChao.count > 1 ? `${noChao.count}x ` : '';
    const embaixo = noChao.sob ? ` (e mais ${noChao.sob} embaixo)` : '';
    return openMenu(evento, [
      {
        cabeca: noChao.nome ?? `item ${noChao.item}`,
        sub: `no chão${embaixo}`,
        arte: itemCanvas(noChao.item, 28),
      },
      { divider: true },
      {
        label: `Pegar ${quantas}${noChao.nome ?? 'item'}`,
        action: () => send({ t: 'pegar', x, y }),
      },
      /*
       * ---- Browse field ----
       *
       * "e tem que ter a função browse field também."
       *
       * É a casa aberta como se fosse uma sacola: a pilha inteira, de cima para
       * baixo, e dali se tira qualquer peça. Sem ele, a armor que ficou embaixo
       * do axe só sai depois de tirar o axe — e numa casa com dez peças isso são
       * dez cliques para chegar na primeira.
       *
       * Só aparece quando há mais de uma peça. Com uma só, ele mostraria
       * exatamente a linha de cima com um passo a mais.
       */
      ...(noChao.sob
        ? [{ label: `Ver o chão (${(noChao.sob ?? 0) + 1} peças)`, action: () => abrirBrowseField(x, y) }]
        : []),
      { label: 'Ir até lá', action: () => send({ t: state.hunt ? 'huntWalkTo' : 'walkTo', x, y }) },
    ]);
  }
  /*
   * ---- O locker abre com o botao direito ----
   *
   * E o gesto do client do dono: direito em cima do armario abre o bau de
   * recompensa e o depot. A marca sai do proprio mapa que ja esta na tela — a
   * pilha do tile guarda indices da paleta, e a paleta guarda o id do item —,
   * entao a tela nao precisa perguntar nada ao servidor para saber se ha um
   * locker ali.
   */
  if (!state.hunt && lockerPorPerto(x, y)) return openLocker();

  /*
   * ---- Direito num móvel do mapa abre o que ele faz ----
   *
   * O mesmo gesto do locker, e pelo mesmo motivo: o objeto está ali na tela, e
   * o caminho oficial até ele são quatro cliques em três telas diferentes
   * (Aventuras → Treino → Exercise → escolher, ou → Treino offline). Quem está
   * encostado nele já sabe o que quer.
   *
   * A lista vem do retrato da cidade, então não é preciso perguntar nada ao
   * servidor para saber o que há naquela casa.
   */
  if (!state.hunt && abrirObjetoEm(x, y)) return;

  // Fora da caçada não há o que atacar: o direito anda igual ao esquerdo, que
  // é o que ele já fazia na cidade.
  if (!state.hunt) return send({ t: 'walkTo', x, y });
  if (!state.hunt.manual) return;

  /*
   * ---- A escada de mão pede clique, e não passo ----
   *
   * Rampa, degrau e buraco levam para outro andar só de pisar em cima — quem
   * cuida disso é o servidor, dentro do passo. A escada de mão (o `type=ladder`
   * do items.xml dele, 17 itens) não: ela é uma `Action`, e no client dele se
   * sobe apertando o botão direito em cima dela. Aqui é o mesmo gesto.
   *
   * A marca vem do mapa que já está na tela (`floors[z].escada`), então o menu
   * não precisa perguntar nada ao servidor para saber se há escada ali.
   */
  const bicho = (state.hunt.monsters ?? []).find((m) => m.x === x && m.y === y && m.hp > 0);
  if (!bicho) {
    const passagem = passagemNoTile(x, y);
    /*
     * ---- A escada SOBE, não abre menu ----
     *
     * Havia um menu de um item só: "Subir a escada". No client dele o botão
     * direito em cima da escada sobe, ponto — e um menu cujo único item é o
     * óbvio é um clique a mais para dizer sim duas vezes.
     *
     * O Ctrl+direito continua abrindo o menu, que é a mesma regra do
     * inventário: o gesto curto faz, o gesto com Ctrl pergunta. É por ali que
     * ainda se chega no "Cancelar alvo".
     */
    if (passagem) {
      if (!evento?.ctrlKey) return send({ t: 'huntEscada', x, y });
      return openMenu(evento, [
        { label: passagem.rotulo, action: () => send({ t: 'huntEscada', x, y }) },
        { divider: true },
        { label: 'Cancelar alvo', action: () => send({ t: 'huntTarget', uid: null }) },
      ]);
    }
  }
  send({ t: 'huntTarget', uid: bicho?.uid ?? null });
};

/*
 * Ha um locker nesta casa da cidade?
 *
 * 3499 e o `locker` do items.xml dele — o mesmo id que o desenho ja trata a
 * parte por causa da elevacao de 8px. A pilha guarda indices da paleta, e por
 * isso a busca e por `palette[indice].id`, e nao pelo indice cru: a paleta e
 * montada por exportacao e o numero dela nao vale entre um mapa e outro.
 */
/*
 * Os quatro armarios do client dele. Os quatro dizem "You see a locker" e os
 * quatro sao a mesma coisa: o que muda e' so o desenho, porque um locker de
 * quatro casas usa um item diferente em cada canto.
 */
const IDS_DO_LOCKER = new Set([3497, 3498, 3499, 3500]);

function lockerNoTile(x, y) {
  const mapa = state.city?.map;
  if (!mapa?.width || !mapa.palette) return false;
  const pilha = (mapa.floors?.[state.city.z ?? 0]?.stacks ?? mapa.stacks)?.[y * mapa.width + x];
  if (!pilha?.length) return false;
  return pilha.some((indice) => IDS_DO_LOCKER.has(mapa.palette[indice]?.id));
}

/*
 * ---- O locker tambem abre clicando ao lado dele ----
 *
 * A casa do armario e BLOQUEADA, como tem de ser: ninguem pisa dentro de um
 * movel. Quem esta jogando fica na casa da frente, e e nela que o cursor quase
 * sempre esta quando se aperta o botao direito — o clique caia no chao e nao
 * acontecia nada, sem nenhum aviso de que faltava um pixel para o lado.
 *
 * Entao a pergunta passa a ser "ha um locker aqui ou encostado aqui?". As nove
 * casas incluem a do proprio clique. Nao ha ambiguidade a temer: nao existe
 * mais nada na cidade que o botao direito faca numa casa vazia alem de andar,
 * e andar para cima de um armario nunca foi possivel.
 */
function lockerPorPerto(x, y) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) if (lockerNoTile(x + dx, y + dy)) return true;
  }
  return false;
}

/** 1 quando o tile tem escada de subir, 2 de descer, 0 quando não tem escada. */
/*
 * O que este tile oferece no botão direito, ou `null`.
 *
 * Três coisas levam para outro andar, e o jogador não tem por que saber a
 * diferença entre elas:
 *
 *   escada de mão  só por clique (o `type=ladder` do items.xml dele);
 *   rampa/degrau   por passo, e agora também por clique;
 *   buraco         idem, descendo.
 *
 * O rótulo diz o GESTO ("Subir"/"Descer") e não o objeto, porque objeto o
 * jogador já está vendo — ele acabou de clicar nele.
 *
 * As duas marcas vêm do mapa que já está na tela, então o menu não precisa
 * perguntar nada ao servidor para saber se há passagem ali.
 */
function passagemNoTile(x, y) {
  const mapa = state.hunt?.map;
  if (!mapa?.width) return null;
  const andar = mapa.floors?.[state.hunt.z ?? 0];
  const local = y * mapa.width + x;

  const mao = andar?.escada?.[local] ?? 0;
  if (mao) return { rotulo: mao === 1 ? 'Subir a escada' : 'Descer a escada' };

  /*
   * `DESCE` é o bit 1 do `TILESTATE_FLOORCHANGE_*` (ver `andares.mjs`);
   * qualquer outro bit é rampa ou degrau, e todos sobem.
   */
  const marca = andar?.mudanca?.[local] ?? 0;
  if (!marca) return null;
  return { rotulo: marca & 1 ? 'Descer aqui' : 'Subir aqui' };
}

/* Os motivos que o servidor devolve, em português de tela. */
/*
 * ---- O escudo e o balão da party saíram daqui ----
 *
 * Eles serviam à faixa que ficava acima da barra de habilidade, e ela virou a
 * janela `party` — com os mesmos cards do painel de Amigos, em `panels.mjs`.
 * Manter uma segunda cópia do desenho aqui era garantir que as duas telas
 * divergissem com o tempo.
 *
 * O escudo do MAPA continua onde sempre esteve (`map.mjs`): ele é desenhado em
 * canvas, ao lado do nome, e não tem nada a ver com este.
 */



/*
 * O convite para caçar junto.
 *
 * Ele chega no meio de qualquer coisa que o jogador esteja fazendo, então não
 * toma a tela: é um cartão no canto, com aceitar e recusar, e ele some sozinho
 * depois de um minuto — um convite velho não serve para nada, porque a caçada
 * do outro já pode ter acabado.
 */
/*
 * ---- Convite de PARTY, que não é convite de caçada ----
 *
 * O cartão é o mesmo — ele não bloqueia o jogo, pelo mesmo motivo — e o texto é
 * o que muda. Aceitar aqui monta o time; entrar na caverna é outro convite, que
 * vem depois e sai do card da party. Sem essa frase a pessoa aceita achando que
 * vai ser levada para uma hunt agora.
 */
/*
 * ---- Quando a janela da party aparece ----
 *
 * Sozinho ela não tem o que mostrar, e uma janela vazia ocupando o canto é
 * ruído. Então ela abre sozinha ao entrar numa party e some ao sair — e o
 * jogador pode fechar, mover, redimensionar e minimizar como qualquer outra.
 *
 * `fechadaPeloJogador` é o respeito à decisão dele: fechou, fica fechada até a
 * party mudar. Sem isso a janela voltaria a abrir no quadro seguinte, quatro
 * vezes por segundo, e não haveria como se livrar dela.
 */
let partyVistaComo = null;
let partyFechadaPeloJogador = false;
let pediuAmigos = false;
let partyDesenhadaComo = null;

function cuidarDaJanelaDaParty() {
  const party = state.character?.party ?? null;
  const marca = party ? `${party.id}:${party.membros.length}` : null;

  if (marca !== partyVistaComo) {
    partyVistaComo = marca;
    // A party mudou (entrou, saiu, alguém entrou): a janela volta a valer.
    partyFechadaPeloJogador = false;
    // No telefone a Party é o modal (celular.mjs): a gaveta não abre sozinha por cima do mapa.
    if (party && !ehTelefone()) setVisible('party', true);
  }
  if (!isVisible('party')) {
    if (party) partyFechadaPeloJogador = true;
    return;
  }
  /*
   * Sem party, a janela mostra os amigos online para começar uma — e para isso
   * ela precisa da lista, que só é buscada quando o painel de Amigos abre.
   * Uma vez por abertura basta: `pediuAmigos` evita um pedido por quadro.
   */
  if (!party && !pediuAmigos) {
    pediuAmigos = true;
    send({ t: 'friends', action: 'list' });
  }
  if (party) pediuAmigos = false;

  /*
   * ---- Só redesenha quando MUDA ----
   *
   * Ela era refeita a cada envio de estado, quatro vezes por segundo. Para os
   * cards tanto faz; para os dois seletores não: a lista aberta era destruída
   * no quadro seguinte e não dava para escolher nada. É o mesmo defeito que a
   * faixa do rodapé tinha, e pelo mesmo motivo.
   *
   * A assinatura é o que a janela DESENHA: quem está, o cargo, a vida, o estado
   * da partilha e as escolhas de posição de cada um. A vida entra porque as
   * barras a mostram; o que não entra não precisa de redesenho.
   */
  /*
   * ---- A assinatura é da ESTRUTURA, e não dos números ----
   *
   * Ela incluía a vida e a mana de cada um. Isso a fazia mudar a todo tique —
   * a regeneração sozinha basta — e a janela era refeita quatro vezes por
   * segundo mesmo com a guarda no lugar. Os seletores continuavam fechando, e
   * a guarda parecia não funcionar; ela funcionava, era a assinatura que estava
   * errada.
   *
   * Aqui entra só o que MONTA a tela: quem está, o cargo, o estado da partilha,
   * as escolhas de posição. As barras são atualizadas por fora, sem remontar
   * nada — é uma largura em CSS, e não precisa de um `<select>` novo.
   */
  const marcaDoDesenho = JSON.stringify([
    party?.membros?.map((m) => [
      m.name, m.level, m.lider, m.online, m.naMinhaCacada, m.podeChamar, m.cacandoPorFora,
      /*
       * Os botões de entrar aparecem e somem com isto, e `hunt` também DESENHA:
       * ele é a linha "caçando em X" embaixo da barra de experiência. Ver
       * `podePedirEntrada` e `podeEntrarDireto`.
       */
      m.podePedirEntrada, m.podeEntrarDireto, m.hunt,
    ]),
    /* E o aviso de quem pediu para entrar na MINHA caçada. */
    state.pedidoDeEntrada?.de ?? null,
    party?.souLider,
    state.hunt?.party?.ativa,
    state.hunt?.party?.motivo,
    state.hunt?.party?.frente,
    state.hunt?.party?.mandaNaFila,
    state.hunt?.party?.coleira,
    /* `estado` entra porque é ele que decide o escudo de cada um: sem ele, a
     * janela só descobria que alguém parou de partilhar no próximo redesenho
     * por outro motivo. */
    state.hunt?.party?.membros?.map((m) => [m.name, m.coleira, m.estado]),
    state.hunt?.manual,
    (state.friends?.amigos ?? []).map((a) => `${a.name}${a.online}`),
    /*
     * ---- A barra dos companheiros também MONTA a tela ----
     *
     * Ela faltava aqui, e era por isso que "ver as habilidades do grupo" não
     * aparecia: marcar a caixa fazia o servidor mandar as ações, mas a
     * assinatura não mexia um fio — então a janela não era refeita e a faixa de
     * magias nunca chegava a ser desenhada. Desmarcar tinha o mesmo problema ao
     * contrário.
     *
     * Entram os IDs, e não os cooldowns: o que sobra de cada relógio muda a
     * cada quadro e traria de volta o redesenho contínuo que fecha os
     * seletores. O número é escrito por fora, em `atualizarBarrasDaParty`.
     */
    !!state.character?.settings?.verAcoesDaParty,
    /* O catálogo pode chegar depois da janela: os ícones dependem dele. */
    catalogoDeAcoesPronto(),
    state.hunt?.party?.membros?.map((m) => (m.acoes ?? []).map((a) => a.id).join(',')),
  ]);
  if (marcaDoDesenho !== partyDesenhadaComo) {
    partyDesenhadaComo = marcaDoDesenho;
    corpoDaJanelaDaParty(windowBody('party'));
    return;
  }
  // Estrutura igual: só os números se mexem.
  atualizarBarrasDaParty(windowBody('party'), party, state.hunt?.party ?? null);
}

function mostrarConviteDeParty({ from }) {
  document.getElementById('convite')?.remove();

  const caixa = el('div', 'convite');
  caixa.id = 'convite';
  caixa.append(el('b', null, `${from} quer montar uma party com você`));
  caixa.append(el('span', null, 'Party não é caçada'));
  caixa.append(el('em', null, 'Vocês ficam no mesmo time; o convite para caçar junto vem depois.'));

  const acoes = el('div', 'convite-acoes');
  const aceitar = el('button', 'primary', 'Entrar na party');
  aceitar.onclick = () => {
    send({ t: 'grupo', action: 'aceitar' });
    caixa.remove();
  };
  const recusar = el('button', 'ghost', 'Recusar');
  recusar.onclick = () => {
    send({ t: 'grupo', action: 'recusar' });
    caixa.remove();
  };
  acoes.append(recusar, aceitar);
  caixa.append(acoes);
  document.body.append(caixa);
}

function mostrarConvite({ from, hunt, faixa, expiraEm }) {
  document.getElementById('convite')?.remove();

  const caixa = el('div', 'convite');
  caixa.id = 'convite';
  caixa.append(el('b', null, `${from} chamou você para caçar`));
  caixa.append(el('span', null, hunt ?? ''));
  if (faixa) {
    caixa.append(el('em', null, `Faixa de partilha: level ${faixa.min} a ${faixa.max}.`));
  }

  const acoes = el('div', 'convite-acoes');
  const aceitar = el('button', 'primary', 'Aceitar');
  aceitar.onclick = () => {
    send({ t: 'party', action: 'accept' });
    caixa.remove();
  };
  const recusar = el('button', 'ghost', 'Recusar');
  recusar.onclick = () => {
    send({ t: 'party', action: 'decline' });
    caixa.remove();
  };
  acoes.append(recusar, aceitar);
  caixa.append(acoes);

  /*
   * O cartão NÃO bloqueia o jogo.
   *
   * Sem fundo escurecido, sem `focus`, sem prender o teclado: quem está no meio
   * de uma luta continua andando, atacando e bebendo poção com o convite na
   * tela. Um convite que impede de jogar mata o personagem de quem recebeu.
   *
   * Por isso ele também não usa o modal: o modal é a caixa que toma a tela.
   */
  document.body.append(caixa);

  // Ele some sozinho quando o convite expira no servidor, e não um segundo
  // depois: os dois lados combinam, e aceitar um cartão morto dá erro.
  const resta = Math.max(5_000, (expiraEm ?? Date.now() + 60_000) - Date.now());
  const relogio = el('i', 'convite-relogio');
  caixa.append(relogio);
  const tique = setInterval(() => {
    const falta = Math.max(0, Math.ceil(((expiraEm ?? 0) - Date.now()) / 1000));
    relogio.textContent = falta ? `expira em ${falta}s` : 'expirado';
    if (!falta) clearInterval(tique);
  }, 1000);
  relogio.textContent = `expira em ${Math.ceil(resta / 1000)}s`;

  setTimeout(() => {
    clearInterval(tique);
    caixa.remove();
  }, resta);
}

/*
 * ---- O cartão de quem PEDIU para entrar na sua caçada ----
 *
 * Report do painel: "na PT, opção de 'Entrar na hunt' / dar TP para quem já
 * está nela".
 *
 * É o irmão do `mostrarConvite` e segue as mesmas regras dele: não escurece a
 * tela, não prende o teclado e some sozinho quando o prazo do servidor vence.
 * Quem recebe este cartão está NO MEIO DE UMA CAÇADA — uma caixa que tomasse a
 * tela mataria o personagem dele.
 */
function mostrarPedidoDeEntrada({ from, level, vocation, hunt, expiraEm }) {
  document.getElementById('pedido-de-entrada')?.remove();

  const caixa = el('div', 'convite');
  caixa.id = 'pedido-de-entrada';
  caixa.append(el('b', null, `${from} quer entrar na sua caçada`));
  const quem = [level ? `level ${level}` : null, vocation && vocation !== 'none' ? vocation : null]
    .filter(Boolean)
    .join(' · ');
  caixa.append(el('span', null, quem || hunt || ''));
  if (quem && hunt) caixa.append(el('em', null, hunt));

  const acoes = el('div', 'convite-acoes');
  const deixar = el('button', 'primary', 'Deixar entrar');
  deixar.onclick = () => {
    send({ t: 'party', action: 'aceitarPedido' });
    caixa.remove();
  };
  const recusar = el('button', 'ghost', 'Agora não');
  recusar.onclick = () => {
    send({ t: 'party', action: 'recusarPedido' });
    caixa.remove();
  };
  acoes.append(recusar, deixar);
  caixa.append(acoes);
  document.body.append(caixa);

  const resta = Math.max(5_000, (expiraEm ?? Date.now() + 60_000) - Date.now());
  const relogio = el('i', 'convite-relogio');
  caixa.append(relogio);
  const tique = setInterval(() => {
    const falta = Math.max(0, Math.ceil(((expiraEm ?? 0) - Date.now()) / 1000));
    relogio.textContent = falta ? `expira em ${falta}s` : 'expirado';
    if (!falta) clearInterval(tique);
  }, 1000);
  relogio.textContent = `expira em ${Math.ceil(resta / 1000)}s`;
  setTimeout(() => {
    clearInterval(tique);
    caixa.remove();
  }, resta);
}

/*
 * A sonda de teste precisa abrir painel também.
 *
 * As fotos automatizadas (`tools/shot.mjs`) rodam num Edge headless e não têm
 * como caçar o botão certo na barra de cima quando ele é um ícone sem texto.
 * Expor as aberturas por nome é o mesmo que o `window.__state` já faz com o
 * estado: nada do jogo depende disto, e sem isto não há como conferir uma tela
 * sem abrir o navegador à mão.
 */
window.__abrir = {
  blessings: () => openBlessings(),
  /*
   * O menu de botao direito num nome, e a caixa de castigo dele. Sao as duas
   * telas de moderacao, e as duas nascem de um gesto que a sonda nao tem como
   * fazer: um clique com o botao direito em cima de um jogador que precisa
   * estar em campo. Ver `sonda-castigo`.
   */
  menuDeJogador: (nome) => menuDeJogador({ clientX: 420, clientY: 300, preventDefault() {}, stopPropagation() {} }, nome),
  castigo: (nome, tipo) => abrirCastigo(nome, tipo),
  hunts: () => openHunts(),
  mercado: () => openMarket(),
  /*
   * A Proficiência: é a tela do report do Garibas — "deixo na hunt, vou
   * escolher perk da proficiência da arma, fica difícil, pq a tela fica
   * re-renderizando o tempo todo". Sem este gancho não há como contar os
   * redesenhos sem abrir o navegador à mão.
   */
  proficiencia: () => openProficiency(),
  // A Store, para a sonda conferir a coluna das prateleiras e o desenho
  // de cada produto. Ver `sonda-loja-draevor`.
  draevorStore: (secao = null) => {
    openStore();
    if (secao) panelCtx.tabs.storeSection = secao;
    renderAll();
  },
  aparencia: () => openCharacter('aparencia'),
  deposito: () => openLocker(),
  arvore: () => openPassivas(),
  // A faixa de novidades tem um clique só, e ele mora fora de `panels.mjs`.
  novidades: () => abrirNovidades(),
  forja: () => openForja(),
  // As duas telas de 'Limpar' e o bestiary: sao os tres reports desta leva, e
  // as tres so se conferem com a janela montada. Ver `sonda-telas-report.mjs`.
  limparMochila: () => openLimparMochila(),
  venderMochila: () => openVenderMochila(),
  // E a irmã dela, para as sacolas de boss — ver `openVenderSacolas`.
  venderSacolas: () => openVenderSacolas(),
  // E a bolsa fixa onde o baú desemboca: a JANELA e a tela de marcação dela.
  bossPouch: () => {
    setVisible('bossPouch', true);
    renderBossPouch();
  },
  venderBossPouch: () => openVenderBossPouch(),
  // A Store Inbox, para a sonda abrir a janela. Ver `abrirStoreInbox`.
  storeInbox: () => abrirStoreInbox(),
  /*
   * A janela Boss Cooldown. A sonda precisa da abertura E de um jeito de pedir
   * o redesenho imediato: a janela anda de segundo em segundo de proposito (ver
   * `renderBossCdJanela`), e um teste que abre e mede no mesmo instante mediria
   * o quadro anterior. Zerar a `chave` e' o mesmo que dizer "esta lista mudou".
   */
  bossCd: () => {
    setVisible('bossCd', true);
    bossCdVivo.chave = null;
    renderBossCdJanela();
  },
  limparBolsa: () => openLimparBolsa(),
  bestiary: () => openBestiary(),
  // A tela do Exercise, para a sonda da estimativa de tempo. Ver `sonda-treino`.
  treino: () => openExercise(),
  /*
   * Charms e Imbuements: as duas telas que o dono mandou repaginar. Sem os
   * ganchos não há como fotografar o antes e o depois no mesmo lugar, e "ficou
   * mais compacta" é exatamente o tipo de afirmação que precisa de medida.
   */
  charms: () => openCharms(),
  imbuements: () => openImbuements(),
  bossToken: () => openLojaDeBossToken(),
  taskToken: () => openLojaDeTaskToken(),
  lobby: () => openLobby(),
  // A loja de um NPC precisa saber de QUAL: a sonda abre a da Zuma.
  loja: (id = 'zuma') => openLojaNpc(id),
};

/*
 * O contexto dos painéis, para a sonda poder pedir um redesenho.
 *
 * É o que permite conferir o efeito da forja sem gastar 75 milhões de ouro de
 * uma conta de teste: a sonda escreve o campo `forjou` no retrato e manda
 * redesenhar, que é exatamente o que a resposta do servidor faz.
 */
window.__panelCtx = panelCtx;

/*
 * Redesenhar o inventário sob demanda, para a sonda.
 *
 * Ela precisa conferir o DESENHO de uma barra de carga sem esperar um tique do
 * servidor — e sem isto o único jeito seria gastar um anel de verdade dentro do
 * navegador, que é uma conferência que leva meia hora e depende do que a conta
 * de teste tem no dedo.
 */
window.__redesenhar = () => { esquecerOsDesenhos(); renderInventory(); renderContainer(); renderPouch(); };
/*
 * E o mesmo para a barrinha de carga, que se atualiza SEM redesenhar nada.
 * Sao dois gestos diferentes e a sonda precisa dos dois separados: um mede o
 * desenho, o outro mede que a barra anda sozinha. Ver `aplicarDesgaste`.
 */
window.__atualizarDesgaste = () => atualizarDesgaste();
/*
 * E o aviso da diária, pelo mesmo motivo: ele acende dentro do desenho do
 * personagem, e a sonda precisa acendê-lo sem esperar o servidor mandar um dia
 * novo. Ver `pintarPresente`.
 */
window.__pintarPresente = () => pintarPresente();

// A sonda de teste precisa enxergar o estado; não custa nada e não muda nada.
window.__state = state;
Object.defineProperty(window, '__ws', { get: () => socket });

// ---------- render ----------

/*
 * ---- A CHAVE DA BOLSA é de referências, e não de texto ----
 *
 * Inventário, bolsa, mochila e Store Inbox só são redesenhados quando mudam de
 * verdade, e quem responde "mudou?" é esta chave. Ela era um TEXTO montado a
 * cada quadro: `id x count` de cada item da mochila, da bolsa de loot (mil
 * vagas), da boss pouch (mil) e da Store Inbox (duas mil), mais dois
 * `JSON.stringify`. Oito vezes por segundo, no navegador de quem joga — e quanto
 * mais cheia a bolsa, mais caro, justo em quem mais caça.
 *
 * Agora compara REFERÊNCIA. O que faz isso valer é o delta: o servidor só manda
 * o campo que mudou, e a junção cria um objeto novo em cada campo que chegou
 * (ver `applyState` e `aplicarRemendo`) e mantém o de antes — o mesmo objeto —
 * no que não chegou. Referência diferente é, exatamente, campo que mudou. Os
 * números soltos (peso, munição, premium) continuam por valor.
 *
 * Quem não pede delta recebe o personagem inteiro a cada quadro, com objetos
 * novos: para essa aba tudo é sempre "mudou", que é o que já acontecia.
 */
let lastBagKey = null;
/** O último `vendaFaltaSegundos` desenhado na bolsa. Ver "O relógio da auto-venda, sozinho". */
let ultimoRelogioDaVenda;

// O clique só termina no pointerup: enquanto isso, nada de redesenhar por baixo.
/*
 * Ninguém troca o DOM debaixo de um botão apertado.
 *
 * `dragend` e `drop` entram na lista porque um arrasto nativo engole o
 * `pointerup`: quem começasse a arrastar deixava esta trava ligada para sempre,
 * e daí em diante nenhum painel aberto se redesenhava mais.
 */
let pointerDown = false;
window.addEventListener('pointerdown', () => (pointerDown = true), true);
window.addEventListener('pointerup', () => (pointerDown = false), true);
window.addEventListener('pointercancel', () => (pointerDown = false), true);
/*
 * O menu do navegador não abre em cima do jogo.
 *
 * O botão direito aqui é um botão do jogo: desequipa, apaga arranjo, tira item
 * do slot. Junto com a ação vinha o menu do Brave por cima — "Copiar",
 * "Pesquisar no Brave", "Inspecionar" —, que não tem nada a ver com o que
 * acabou de acontecer e ainda tapa metade da tela.
 *
 * Campo de texto é exceção: lá o menu do navegador é o único jeito de colar
 * sem teclado, e tirar isso seria pior do que o incômodo que ele causa.
 */
window.addEventListener('contextmenu', (event) => {
  if (event.target.closest('input, textarea')) return;
  event.preventDefault();
});

window.addEventListener('dragend', () => (pointerDown = false), true);
window.addEventListener('drop', () => (pointerDown = false), true);

// Arrastar com o mouse sem abrir o arrasto do navegador. Ver `arrasto-do-mouse.mjs`.
instalarArrastoDoMouse();

/*
 * A cortina de viagem.
 *
 * A troca de mapa é instantânea do lado do servidor: a sessão antiga morre e a
 * nova nasce no mesmo tick. Sem nada por cima, o personagem simplesmente
 * aparecia noutro lugar, e a impressão era de defeito e não de viagem.
 *
 * Ela fica pelo menos `MINIMO` para não piscar — uma cortina que aparece e some
 * em 80ms é pior que nenhuma — e sai assim que o primeiro quadro da hunt nova
 * chega, o que for mais tarde. Se o quadro nunca chegar (queda de conexão), o
 * teto de `TETO` derruba a cortina de qualquer jeito: melhor ver o jogo parado
 * do que uma tela de carregamento eterna.
 */
const VIAGEM_MINIMO = 1100;
const VIAGEM_TETO = 6000;
const artesQuebradas = new Set();
let viagemAte = 0;
let viagemTimer = null;

const TITULO_VIAGEM = {
  partida: 'Traçando a rota',
  rota: 'Percurso concluído',
  relogio: 'Trocando de hunt',
};
const NOTA_VIAGEM = {
  partida: 'preparando o terreno e posicionando as criaturas',
  rota: 'o último waypoint foi alcançado — seguindo o ciclo',
  relogio: 'tempo nesta hunt esgotado — seguindo o ciclo',
};

function mostrarViagem({ hunt, motivo }) {
  const caixa = $('viagem');
  if (!caixa) return;

  $('viagem-titulo').textContent = TITULO_VIAGEM[motivo] ?? 'Viajando';
  $('viagem-hunt').textContent = hunt ?? '';
  $('viagem-nota').textContent = NOTA_VIAGEM[motivo] ?? '';

  /*
   * Uma arte por motivo: partir e chegar são momentos diferentes.
   *
   * Enquanto o arquivo não existe a faixa some sozinha — e o nome fica no
   * `artesQuebradas`, para não pedir de novo. Sem isso cada início de hunt
   * deixava um 404 no console, e um console sujo esconde o erro que importa.
   */
  const arte = $('viagem-arte');
  const nome = motivo === 'partida' ? 'partida' : 'rota';
  if (artesQuebradas.has(nome) || !ARTES.ui.has(`viagem-${nome}`)) {
    arte.hidden = true;
  } else {
    arte.hidden = false;
    arte.onerror = () => {
      artesQuebradas.add(nome);
      arte.hidden = true;
    };
    arte.src = `/client/assets/ui/viagem-${nome}.png`;
  }

  caixa.hidden = false;
  viagemAte = Date.now() + VIAGEM_MINIMO;
  clearTimeout(viagemTimer);
  viagemTimer = setTimeout(() => esconderViagem(true), VIAGEM_TETO);
}

/*
 * ---- Entrando no personagem ----
 *
 * Escolher o personagem e cair direto no jogo parecia rápido e não era: o mapa
 * ainda estava chegando (1,6 MB na cidade, até 4,8 MB numa hunt), a folha de
 * itens também (4,8 MB), e o sprite do próprio boneco idem. O jogo abria
 * "pronto" e engasgava nos primeiros segundos — justamente quando o jogador
 * abre a mochila, olha o mapa e mexe em tudo.
 *
 * Esta tela espera as TRÊS coisas que fazem o jogo travar depois, e só sai
 * quando elas chegam. O que não é essencial (as outras folhas de item) é pedido
 * junto, mas sem segurar ninguém: quando o jogador precisar delas, já estarão
 * no cache do navegador.
 */
const ENTRADA_TETO = 15000;

/** As folhas de sprite que a entrada espera, na ordem em que fazem falta. */
function pecasDaEntrada() {
  const pecas = [];

  /*
   * ---- O mapa que VAI aparecer, e não o que estava na tela no `welcome` ----
   *
   * O `welcome` traz a cidade; quem entra caçando só recebe a hunt no primeiro
   * `state`, um instante depois (e o mapa dela quando o `pedirMapa` volta).
   * Esta peça lia o mapa na hora do `welcome` — a cidade — e fazia a entrada
   * esperar os 3,8 MB do `city.png` para uma tela que o jogador nem via. Agora
   * o `src` é perguntado a cada volta da espera: vale o mapa que estiver na
   * tela quando ele tiver atlas. Caçando, o servidor já manda a cidade sem mapa
   * (ver o `welcome`, sessao.mjs), então a peça espera o atlas da hunt.
   */
  pecas.push({ passo: 'carregando o mapa', src: () => atlasNaTela(), opcional: true });

  /*
   * `items32-0.png` é a folha principal: é dela que saem os ícones da mochila,
   * do inventário e do chão. As outras três (`items32-1`, `items32-2`,
   * `items64-0`) são pedidas depois, sem espera — juntas passam de 12 MB, e
   * segurar tudo isso antes de entrar seria trocar um engasgo por uma espera.
   */
  pecas.push({ passo: 'carregando os itens', src: '/gamedata/sprites/items/items32-0.png' });

  /*
   * O outfit sai do PERSONAGEM, e não do boneco no mapa.
   *
   * O boneco às vezes ainda não existe quando esta tela monta a lista — o
   * retrato do mapa chega no mesmo pacote, mas a cidade e a hunt guardam o
   * jogador em campos diferentes. O `outfit.type` do personagem está sempre
   * lá, e é o mesmo número da folha de sprite.
   */
  const eu = state.hunt?.player ?? state.city?.player;
  const look = state.character?.outfit?.type ?? eu?.look;
  if (Number.isFinite(look)) {
    pecas.push({ passo: 'carregando o personagem', src: `/gamedata/sprites/outfits/${look}.png` });
  }
  return pecas;
}

/** O atlas do mapa na tela agora, ou `null` se ele ainda não chegou (ou não tem). */
function atlasNaTela() {
  const mapa = mapView?.snapshot?.map;
  return mapa?.atlas ? `/gamedata/sprites/${mapa.atlas}.png` : null;
}

/*
 * Quanto a peça `opcional` (o mapa) espera por um mapa com atlas. Passou disto
 * sem nenhum, a entrada segue: há mapa sem atlas próprio, e o `ENTRADA_TETO`
 * seria tempo demais de tela parada por uma coisa que não vai chegar.
 */
const ESPERA_PELO_MAPA = 4000;

async function entrarNoPersonagem(message) {
  const tela = $('entrada');
  if (!tela) return;

  $('entrada-nome').textContent = message.character?.name ?? state.character?.name ?? '';
  $('entrada-passo').textContent = 'preparando';
  $('entrada-detalhe').textContent = '';
  $('entrada-progresso').style.width = '0%';
  tela.classList.remove('saindo');
  tela.hidden = false;

  const pecas = pecasDaEntrada();
  const fim = Date.now() + ENTRADA_TETO;

  for (let i = 0; i < pecas.length; i++) {
    const { passo, opcional } = pecas[i];
    const qual = () => (typeof pecas[i].src === 'function' ? pecas[i].src() : pecas[i].src);
    $('entrada-passo').textContent = passo;
    $('entrada-detalhe').textContent = `${i + 1} de ${pecas.length}`;
    $('entrada-progresso').style.width = `${Math.round((i / pecas.length) * 100)}%`;

    /*
     * O teto vale por cima de tudo.
     *
     * Uma folha que nunca chega (rede caiu no meio, arquivo faltando no
     * servidor) não pode prender o jogador numa tela de carregamento eterna: é
     * melhor entrar com o desenho faltando e ver o jogo do que não entrar.
     */
    const desistirSemMapa = Date.now() + ESPERA_PELO_MAPA;
    for (;;) {
      const src = qual();
      if (src ? imagemPronta(src) : opcional && Date.now() >= desistirSemMapa) break;
      if (Date.now() >= fim) break;
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  /*
   * O resto das folhas de item vai sem espera: entram no cache enquanto se joga.
   * No TELEFONE, não: são ~2,5 MB de download e, desenhadas, 48 MB de bitmap
   * (três folhas de 2048²) para ícones que talvez nem apareçam na sessão. Lá
   * cada folha chega quando o primeiro item dela for desenhado — `image()` já
   * busca sob demanda.
   */
  if (!ehTelefone()) {
    for (const src of ['/gamedata/sprites/items/items32-1.png', '/gamedata/sprites/items/items32-2.png', '/gamedata/sprites/items/items64-0.png']) {
      imagemPronta(src);
    }
  }

  $('entrada-passo').textContent = 'pronto';
  $('entrada-progresso').style.width = '100%';
  tela.classList.add('saindo');
  setTimeout(() => {
    tela.hidden = true;
    tela.classList.remove('saindo');
  }, 350);
}

/**
 * O atlas da hunt já chegou?
 *
 * Cada hunt tem o atlas dela (a troll-cave são 4,8 MB), e ele é buscado quando
 * o primeiro quadro tenta desenhar. Enquanto ele não chega o mapa sai VAZIO —
 * era isso que aparecia por baixo da cortina quando ela saía cedo demais: o
 * jogador via o boneco parado num fundo preto e achava que a hunt tinha
 * quebrado.
 */
function mapaCarregado() {
  const mapa = mapView?.snapshot?.map;
  if (!mapa?.atlas) return true; // cidade e mapas gerados não têm atlas próprio
  return !!imagemPronta(`/gamedata/sprites/${mapa.atlas}.png`);
}

function esconderViagem(forcado = false) {
  const caixa = $('viagem');
  if (!caixa || caixa.hidden) return;
  if (!forcado && Date.now() < viagemAte) return;
  /*
   * E, além do tempo mínimo, o mapa tem de estar carregado.
   *
   * A cortina existe para cobrir a troca; sair antes do atlas chegar é trocar
   * uma cortina por uma tela preta. O `TETO` continua valendo por cima disto —
   * se o atlas nunca chegar, é melhor ver o jogo do que uma tela de
   * carregamento eterna.
   */
  if (!forcado && !mapaCarregado()) {
    $('viagem-nota').textContent = 'carregando o mapa desta hunt…';
    clearTimeout(viagemTimer);
    viagemTimer = setTimeout(() => esconderViagem(), 200);
    return;
  }
  clearTimeout(viagemTimer);
  caixa.hidden = true;
}

/*
 * ---- Desligar a rotação PERGUNTA quando há uma luta em curso ----
 *
 * "e a confirmaçao se ela quer informando que ela vai perder o boss atual que
 * esta lutando".
 *
 * Dois botões desligam a rotação — o da faixa no alto da tela e o da aba de
 * Bosses —, e os dois passam por aqui. Fossem duas cópias da pergunta, uma
 * delas ficaria para trás na primeira vez que o texto mudasse, e a versão sem
 * aviso é justamente a perigosa.
 *
 * O que ele desfaz é caro: parar no meio da sala encerra a caçada, e o cooldown
 * de doze horas daquele boss JÁ foi cobrado na entrada — ele não volta. Um
 * clique errado custa meio dia daquele boss.
 *
 * Fora da sala não há o que perder: entre um boss e o próximo o personagem está
 * no templo, e perguntar ali seria só um passo a mais. A pergunta aparece onde
 * a resposta muda alguma coisa.
 */
function pararAutoBoss() {
  if (!state.hunt) return void send({ t: 'autoBoss', action: 'stop' });

  /*
   * O retrato da caçada manda `huntId`, e não o nome — quem tem os nomes é o
   * catálogo. Dizer "você está lutando Alptramun" em vez de "um boss" é a
   * diferença entre a pessoa reconhecer o que vai perder e não reconhecer.
   */
  const nomeDoBoss = state.catalog?.bosses?.find((boss) => boss.id === state.hunt?.huntId)?.name ?? 'um boss';

  openModal('Desativar o Auto Boss', (body) => {
    body.append(
      el(
        'p',
        'shop-note',
        `Você está lutando ${nomeDoBoss} agora. Desativar encerra esta luta e volta para a cidade — ` +
          'e o cooldown de 12 horas deste boss já foi cobrado na entrada: ele não volta.',
      ),
    );
    body.append(el('p', 'shop-note', 'A leva também não é devolvida: as entradas já usadas continuam usadas.'));

    const acoes = el('div', 'confirm-actions');
    const ficar = el('button', 'ghost', 'Continuar a rotação');
    ficar.onclick = () => closeModal();
    const sair = el('button', 'danger', 'Desativar e sair da sala');
    sair.onclick = () => {
      closeModal();
      send({ t: 'autoBoss', action: 'stop' });
      send({ t: 'stopHunt' });
    };
    acoes.append(ficar, sair);
    body.append(acoes);
  });
}

/*
 * ---- E a saida de quem foi LEVADO pela rotacao de outro ----
 *
 * O convidado nao tem rotacao para desativar: a lista, a leva e o botao de
 * ligar sao de quem a ligou. O que ele pode desfazer e a CARONA, e a porta
 * dela e a party — que e' de onde `seguirAutoBoss` tira o time a cada sala.
 *
 * A pergunta existe pelo mesmo motivo da outra: dentro da sala o clique custa
 * caro. Sair da party tira o personagem da caçada na hora (e' o que o
 * `action: 'sair'` do servidor faz com quem esta la por convite), e o cooldown
 * de doze horas daquele boss ja foi cobrado na entrada dele — nao volta.
 */
function sairDoAutoBossConvidado() {
  const dono = state.character?.autoBoss?.convidadoPor ?? 'o líder';

  openModal('Sair da rotação de bosses', (body) => {
    body.append(
      el(
        'p',
        'shop-note',
        `Você está indo junto na rotação de ${dono}. Sair da party tira você dela — e você para de ser levado para as próximas salas.`,
      ),
    );
    if (state.hunt) {
      body.append(
        el(
          'p',
          'shop-note',
          'Você está numa sala AGORA: sair encerra esta luta e volta para a cidade, e o cooldown de 12 horas deste boss já foi cobrado na entrada — ele não volta.',
        ),
      );
    }
    body.append(el('p', 'shop-note', 'A sua leva também não é devolvida: as entradas já usadas continuam usadas.'));

    const acoes = el('div', 'confirm-actions');
    const ficar = el('button', 'ghost', 'Continuar junto');
    ficar.onclick = () => closeModal();
    const sair = el('button', 'danger', 'Sair da party');
    sair.onclick = () => {
      closeModal();
      // O servidor ja tira da caçada quem estava nela por convite; mandar um
      // `stopHunt` junto seria uma segunda saida para a mesma pessoa.
      send({ t: 'party', action: 'sair' });
    };
    acoes.append(ficar, sair);
    body.append(acoes);
  });
}

/*
 * ---- As janelas de itens só se desenham ABERTAS ----
 *
 * Medido na auditoria do celular: caçando, a bolsa muda a cada loot, e as
 * cinco janelas de itens eram refeitas juntas — mesmo fechadas. Eram ~400
 * elementos em janelas escondidas e cinco mutações de DOM por segundo que
 * ninguém via; no telefone, onde só cabe uma gaveta aberta por vez, é quase
 * tudo desperdício.
 *
 * A regra é a mesma do analisador: fechada não desenha, só anota que ficou
 * para trás; o `quandoAbrir` desenha na hora em que ela abre, então ela nunca
 * aparece velha.
 */
const JANELAS_DA_BOLSA = {
  loot: renderPouch,
  inventory: renderInventory,
  container: renderContainer,
  bossPouch: renderBossPouch,
  storeInbox: renderStoreInbox,
};
const bolsaAtrasada = new Set();
function desenharSeAberta(id) {
  if (isVisible(id)) {
    bolsaAtrasada.delete(id);
    JANELAS_DA_BOLSA[id]();
    return;
  }
  if (bolsaAtrasada.has(id)) return;
  bolsaAtrasada.add(id);
  quandoAbrir(id, () => {
    if (bolsaAtrasada.delete(id)) JANELAS_DA_BOLSA[id]();
  });
}

function renderAll() {
  const character = state.character;
  if (!character) return;

  /*
   * O número da topbar é o PATRIMÔNIO: bolso mais banco.
   *
   * Ele mostrava só o que estava no bolso, e o banco é para onde vão as moedas
   * grandes da caçada (platinum e crystal) — quem via "3.400" no topo depois de
   * uma hora de hunt achava que tinha perdido o resto. O tooltip abre as duas
   * partes, porque só o que está no bolso se perde ao morrer.
   *
   * Ouro entrando dá um pulo no número: caçando, o contador sobe sozinho e sem
   * isso a chegada de loot passa despercebida no canto da tela.
   */
  const ouro = $('char-gold');
  const banco = Math.round(character.bank ?? 0);
  const total = Math.round(character.gold) + banco;
  const antes = Number(ouro.dataset.value ?? total);
  if (total > antes) {
    // Reinicia a animação mesmo em ganhos seguidos — sem um reflow forçado
    // (`offsetWidth`) no meio: o navegador já aplica a remoção da classe
    // antes do próximo quadro, então adiar o `add` para lá (em vez de ler
    // uma medida só para obrigar isso a acontecer na hora) tem o mesmo
    // efeito sem travar a thread principal lendo layout.
    ouro.classList.remove('gained');
    requestAnimationFrame(() => ouro.classList.add('gained'));
  }
  ouro.dataset.value = String(total);
  ouro.textContent = total.toLocaleString('pt-BR');
  /*
   * ---- O dinheiro é o botão do banco ----
   *
   * "você coloca pra abrir o banco quando clicar no dinheiro que você tem, e
   *  aí quando eu passar o mouse em cima do dinheiro, além de ter as
   *  informações, tem que ter 'clique pra abrir o banco'."
   *
   * A carteira já sabe do banco — o número dela é bolso mais banco —, então
   * ela era o lugar mais curto para essa porta desde sempre. O ícone da barra
   * saiu (ver `BARRA`); a função não.
   *
   * O `onclick` é posto a cada desenho, e não uma vez no arranque: `renderTopbar`
   * roda a cada atualização do personagem e o elemento é o mesmo, então repor
   * o mesmo fechamento é mais barato do que um ouvinte separado num módulo que
   * teria de esperar a carteira existir.
   */
  const carteira = ouro.parentElement;
  carteira.classList.add('abre-banco');
  carteira.onclick = () => openBank();
  /*
   * ---- Sem desenho ao lado do número ----
   *
   * Houve um `banco.png` aqui, e o dono mandou tirar: "pode retirar o ícone do
   * banco ao lado do gold". A carteira inteira continua sendo o botão — o
   * `onclick` acima e a moldura que acende no hover são o que diz que há o que
   * clicar, e o balão termina contando.
   */
  tipTexto(
    carteira,
    `${character.gold.toLocaleString('pt-BR')} no bolso · ${banco.toLocaleString('pt-BR')} no banco. ` +
      'Só o que está no bolso se perde ao morrer. Clique para abrir o banco.'
  );
  $('char-coins').textContent = (character.coins ?? 0).toLocaleString('pt-BR');
  /*
   * ---- O `+` das Draevor Coins ----
   *
   * "em cima da quantidade de draevor coins que tenho coloca um botão + que ao
   *  clicar abre a tela de donate."
   *
   * O caminho até ali eram três cliques — abrir a loja, achar o rodapé, achar
   * "Obter Draevor Coins" —, e é o caminho que o jogo mais quer que seja curto.
   * O `+` colado no saldo é o gesto de qualquer jogo com moeda paga.
   *
   * Pendurado uma vez só, pelo mesmo motivo do ícone do banco acima.
   */
  /*
   * Ele fica pendurado no NÚMERO, e não ao lado dele.
   *
   * "coloca ele meio dourado e sem o fundo, e meio que em cima do valor, tipo
   *  na borda de cima do último dígito." É um `+` de expoente: sai do fluxo
   *  (`position: absolute` sobre o próprio número) e não empurra mais nada da
   *  barra, que é o que um botão ao lado fazia.
   */
  /*
   * E ele mora na CARTEIRA, não dentro do `<b>` do número.
   *
   * A linha acima faz `textContent = ...` no `<b>` a cada atualização do
   * personagem, e isso apaga tudo o que estiver dentro dele — o botão seria
   * recriado várias vezes por segundo, e o balão dele nasceria de novo junto.
   * Fora do fluxo e ancorado na borda direita da carteira, ele cai exatamente
   * em cima do último dígito e sobrevive aos redesenhos.
   */
  const bolsoDeCoins = $('char-coins').parentElement;
  if (!bolsoDeCoins.querySelector('.carteira-mais')) {
    const mais = el('button', 'carteira-mais', '+');
    mais.type = 'button';
    mais.setAttribute('aria-label', 'Obter Draevor Coins');
    tipTexto(mais, 'Comprar Draevor Coins — Pix, cartão ou internacional.');
    mais.onclick = (evento) => {
      // Sem isto o clique sobe para a carteira e o balão dela responde junto.
      evento.stopPropagation();
      pedirDraevorCoins();
    };
    bolsoDeCoins.append(mais);
  }
  $('online-count').textContent = state.online;

  renderGoldIcon();
  // A party da caçada vai junto: o balão da régua de experiência precisa dela
  // para mostrar a Shared Experience entre os multiplicadores. Ver `renderHud`.
  /*
   * O escudo de mana vem de duas fontes e as duas moram aqui: o anel esta no
   * personagem (o servidor ja diz se ele vale para a vocacao) e a magia esta
   * nos buffs da caçada. O HUD so' pinta o resultado.
   */
  const comEscudoDeMana =
    !!character.escudoDoAnel || (state.hunt?.buffs ?? []).some((buff) => buff.tipo === 'shield');
  renderHud(character, state.catalog, state.hunt?.party ?? null, comEscudoDeMana, state.hunt);
  // O presente vive do mesmo estado: aparece e some junto com o resto da tela.
  pintarPresente();
  atualizarBotoes();
  renderActionBar();
  renderAnalyzer();
  renderBuffsJanela();
  renderBossCdJanela();
  renderRunControls();
  atualizarCelular();

  // Inventário, bolsa e mochila só são redesenhados quando mudam de verdade.
  // Reconstruir o DOM quatro vezes por segundo trocava o elemento no meio do
  // clique, e por isso equipar um item só funcionava na segunda ou terceira vez.
  const bagKey = [
    character.inventory,
    character.pouch,
    /*
     * A Boss Pouch entra na chave porque ela virou uma JANELA: sem isto, matar
     * um boss e pegar a recompensa nao redesenhava a grade dela, e a peca so'
     * aparecia no proximo item que caisse na mochila.
     *
     * Ela e' um campo frio no servidor (ver `CAMPOS_FRIOS`), entao esta linha
     * muda no maximo uma vez por segundo — nao e' ela que vai refazer a mochila
     * o tempo todo.
     */
    character.bossPouch ?? null,
    // A Store Inbox, pelo mesmo motivo: uma compra tem de aparecer na janela e no contador da mochila.
    character.storeInbox ?? null,
    character.equipment,
    character.itemRules ?? null,
    character.ammoPending,
    /*
     * A munição carregada entra na chave.
     *
     * Ela deixou de morar no `equipment` (foi para a aljava, ver `municao` no
     * servidor) e a chave continuou olhando só o equipamento — então trocar de
     * flecha não mexia em nada aqui, o inventário não se redesenhava, e o
     * desenho da munição em cima da aljava continuava sendo o da anterior.
     */
    character.municao ?? 0,
    character.weight,
    character.settings?.autoSellPouch,
    character.pouchValue ?? null,
    character.imbuements ?? null,
    // Os dois selos da grade moram no inventário: comprar premium ou uma
    // blessing tem que acender o ícone na hora, e perder tem que apagar. Sem
    // isto a janela só se atualizava no próximo item que entrasse na mochila.
    //
    // O premium chega em milissegundos e desce sozinho a cada quadro — a chave
    // guarda só se está ativo ou não, senão ela mudaria quatro vezes por segundo
    // e o inventário voltaria a ser refeito o tempo todo. Quantos dias faltam
    // está no tooltip, que é montado na hora de mostrar.
    (character.premium ?? 0) > 0 ? 'vip' : '-',
    character.blessings ?? null,
  ];

  if (!lastBagKey || bagKey.some((parte, i) => parte !== lastBagKey[i])) {
    lastBagKey = bagKey;
    ultimoRelogioDaVenda = character.vendaFaltaSegundos;
    for (const id of Object.keys(JANELAS_DA_BOLSA)) desenharSeAberta(id);
  }

  /*
   * ---- O relógio da auto-venda, sozinho ----
   *
   * "próxima venda em 50s" muda a cada segundo e não é da `bagKey`. Para ele
   * andar, o servidor reenviava junto o `pouchValue` inteiro (~3 KB, a bolsa
   * item a item) todo segundo — e esse objeto novo mudava a `bagKey`: mochila,
   * inventário e caixas conferidos por segundo, em todo jogador. Agora só o
   * número muda: `renderPouch` com a bolsa igual cai no atalho dela
   * (inventory.mjs, "Só o relógio mudou?") e troca o texto.
   */
  else if (character.vendaFaltaSegundos !== ultimoRelogioDaVenda) {
    ultimoRelogioDaVenda = character.vendaFaltaSegundos;
    desenharSeAberta('loot');
  }

  /*
   * A janela do chão (o browse field) acompanha a casa que ela mostra.
   *
   * Fora da `bagKey` de propósito: o que ela desenha não é a mochila, é a pilha
   * de uma casa do mapa — ela muda quando um companheiro larga ou leva alguma
   * coisa ali, e isso não mexe em peça nenhuma do personagem. Ela tem a própria
   * guarda lá dentro, e sai na primeira linha quando está fechada.
   */
  renderBrowse();

  /*
   * ---- E a carga anda mesmo sem redesenho ----
   *
   * A `bagKey` acima olha `id x count` de cada peça, e a carga não é nem uma
   * coisa nem outra: um anel gastando no dedo não muda a chave, o inventário
   * não se refazia e a barrinha ficava parada no primeiro número que tinha
   * desenhado. Era o "mostrar a carga sendo consumida em tempo real" que o
   * dono pediu — e o servidor já mandava o número certo o tempo todo.
   *
   * Pôr a carga na chave consertaria e cobraria caro: o inventário inteiro
   * refeito uma vez por segundo por causa de um anel. É o mesmo motivo pelo
   * qual o premium entra ali como "vip"/"-". Então quem se atualiza é só a
   * barra, nos três atributos dela. Ver `aplicarDesgaste`.
   */
  atualizarDesgaste();

  // O primeiro quadro da hunt nova derruba a cortina — respeitado o mínimo.
  if (state.hunt) {
    if (Date.now() >= viagemAte) esconderViagem();
    else setTimeout(() => esconderViagem(), viagemAte - Date.now());
  }

  $('stage-empty').hidden = !!state.hunt || !!state.city;
  if (state.hunt) {
    $('strategy').value = state.hunt.strategy;
    $('distance').value = String(state.hunt.distance ?? 0);  } else {
    $('distance').value = String(character.settings?.distance ?? 0);
  }
  /*
   * ---- O campo de distancia nao pode mentir ----
   *
   * Ele oferecia de 0 a 6 sqm sempre, e a caçada limitava em silencio ao
   * alcance de quem esta jogando: com uma rod de 3 o jogador escolhia 5 e o
   * boneco ficava a 3, sem nada na tela explicando. Agora as opcoes fora do
   * alcance dizem de quanto ele e — continuam escolhiveis, porque equipar uma
   * arma mais longa ou por uma runa na barra muda o numero na hora.
   */
  /*
   * ---- O aviso encurtou, e o motivo é a LARGURA DA CAIXA ----
   *
   * O texto era `2 sqm — voce alcanca 1`. Um `<select>` fechado tem a largura
   * da MAIOR opção da lista, não a da escolhida — então esse aviso, que só
   * aparece nas opções fora do alcance, esticava a caixa para 190px mesmo com
   * "Corpo a corpo" (98px) selecionado. Cinquenta pixels de barra gastos com um
   * texto que ninguém está vendo.
   *
   * `· máx 1` diz a mesma coisa no lugar de doze caracteres, e a frase inteira
   * foi para o `title`: ela continua inteira para quem parar o mouse em cima,
   * que é quando a pergunta "por que não posso escolher 5?" de fato aparece.
   * O `.fora-do-alcance` continua pintando a opção, e é ele que dá o aviso de
   * relance.
   */
  /*
   * ---- E elas só são reescritas quando o ALCANCE muda ----
   *
   * Este laço reescrevia o texto, o title e a classe das oito opções a cada
   * estado do servidor — 106 escritas de DOM por segundo para escrever
   * exatamente as mesmas oito frases. O alcance muda quando a pessoa troca de
   * arma; entre uma troca e outra, não há nada a fazer aqui.
   */
  const alcance = state.hunt?.alcance ?? character.derived?.attackRange ?? 1;
  if (alcance !== ultimoAlcanceDaLista) {
  ultimoAlcanceDaLista = alcance;
  for (const opcao of $('distance').options) {
    const sqm = Number(opcao.value);
    const passa = sqm === 0 || sqm <= alcance;
    opcao.textContent = sqm === 0 ? 'Corpo a corpo' : `${sqm} sqm${passa ? '' : ` · máx ${alcance}`}`;
    opcao.title = passa ? '' : `A sua arma alcança ${alcance} sqm — escolhendo ${sqm} o personagem vai parar a ${alcance}.`;
    opcao.classList.toggle('fora-do-alcance', !passa);
  }
  }
  /*
   * Caça Online: a barra troca de cara.
   *
   * "Alvo" e "Distância do alvo" mandam na mira automática, e no modo manual
   * quem mira é o jogador — deixá-los ligados seria oferecer um controle que
   * não controla nada. No lugar deles entra a linha do que cada tecla faz.
   */
  /*
   * Na Caça Online eles voltam QUANDO a assistência liga.
   *
   * "Alvo", "Distância do alvo" e "Lurar" mandam na mira automática. Sem ajuda
   * quem mira é o jogador, e deixá-los ligados seria oferecer um controle que
   * não controla nada. Com a ajuda ligada eles voltam a valer — é justamente o
   * que ela liga —, e por isso reaparecem juntos com ela.
   */
  const manual = !!state.hunt?.manual;
  const assistencia = !!state.hunt?.assistencia;
  const semMira = manual && !assistencia;
  document.body.classList.toggle('manual', manual);
  document.body.classList.toggle('assistencia', assistencia);
  /*
   * ---- No braço, só o ALVO volta (15/09) ----
   *
   * O dono: "quando for caça online e as assistências ligadas não precisa ter a
   * distância do alvo nem o lurar até, porque a pessoa vai andar na mão". É
   * isso no servidor também: com `manual` o personagem nunca anda sozinho (nem
   * persegue, nem recua, nem lura), então Distância e Lurar não mandariam em
   * nada. O Alvo manda — é a regra do ataque automático.
   */
  const semAndarSozinho = manual;
  for (const [id, escondido] of [['strategy', semMira], ['lure', semAndarSozinho]]) {
    // `closest`, e nao `parentElement`: o seletor do lure passou a morar dentro
    // de um `.lure-dupla` (ele tem um irmao agora), e esconder o irmao em vez
    // do rotulo deixava "Lurar ate" flutuando sozinho na barra.
    const campo = $(id)?.closest('label');
    if (campo) campo.hidden = escondido;
  }
  const campoDistancia = $('distance')?.parentElement;
  if (campoDistancia) campoDistancia.hidden = semAndarSozinho;

  /*
   * ---- O interruptor da ajuda saiu do meio da barra ----
   *
   * Ele nascia entre os controles e os doze slots, com o texto inteiro
   * ("⚙ Assistência ligada") empurrando a barra para o lado toda vez que
   * alguem ligava ou desligava. E' um ajuste de caçada, e nao uma acao: mora
   * agora nos Ajustes da tela (a engrenagem da propria barra) e nas Opcoes do
   * jogo, que sao os dois lugares onde os outros ajustes ja moram.
   *
   * Ver `secaoDaAssistencia`, em panels.mjs, que desenha os dois.
   */
  $('assist-btn')?.remove();

  /*
   * A faixa "Caça Online — nada dispara sozinho" saiu.
   *
   * Ela ficava colada acima das barras de vida e mana, roubando uma linha da
   * tela durante a caçada inteira para repetir uma coisa que o jogador já sabe
   * — ele escolheu o modo dois cliques antes. A frase continua onde ela serve:
   * no botão da Caça Online, na tela de antes de entrar.
   *
   * Uma faixa antiga ainda pendurada na tela é removida aqui.
   */
  $('manual-dica')?.remove();

  /*
   * ---- O painel do grupo virou JANELA ----
   *
   * Ele era uma faixa presa aqui, acima da barra de habilidade: não dava para
   * mover, não dava para fechar, e cabia uma linha de texto. Com cinco pessoas
   * na caçada eram cinco nomes espremidos num rodapé que já tem o alvo, a
   * distância e o lurar.
   *
   * Agora é a janela `party`, com os mesmos cards do painel de Amigos — e o que
   * sobrou aqui é só decidir quando ela aparece.
   */
  cuidarDaJanelaDaParty();

  $('lure').value = String(character.settings?.lure ?? 0);

  /*
   * ---- O segundo seletor: com quantos ele VOLTA a juntar ----
   *
   * "o char lura 8 bichos e essa opção de voltar a lurar quando tiver 4 bicho —
   * ele volta a lurar até virar 8".
   *
   * Ele vive colado no primeiro porque é a outra metade da mesma decisão, e
   * some quando o lure está desligado: sem meta não há de onde voltar, e um
   * controle morto na fileira só ocupa espaço numa barra que já está cheia.
   *
   * As opções acima da meta são DESLIGADAS em vez de removidas: "voltar em 8
   * de 8" é um personagem que nunca briga, e ver a opção apagada explica o
   * limite melhor do que ela não existir.
   */
  {
    const meta = Number(character.settings?.lure ?? 0);
    const seletor = $('lure-volta');
    const separador = $('lure-sep');
    if (seletor) {
      const ligado = meta > 0;
      seletor.hidden = !ligado;
      if (separador) separador.hidden = !ligado;
      /*
       * Só escreve o que MUDOU. Este bloco roda a cada quadro do servidor, e
       * atribuir o mesmo valor ainda conta como mudança para o navegador: eram
       * 72 escritas por segundo só nas opções deste seletor, cada uma
       * invalidando o estilo da barra. (medido no perfil do cliente, numa caçada).
       */
      for (const opcao of seletor.options) {
        const desligada = Number(opcao.value) > 0 && Number(opcao.value) >= meta;
        if (opcao.disabled !== desligada) opcao.disabled = desligada;
      }
      const pedido = Number(character.settings?.lureVolta ?? 0);
      const valor = String(pedido > 0 && pedido < meta ? pedido : 0);
      if (seletor.value !== valor) seletor.value = valor;
      /*
       * Com "auto" marcado, o rótulo diz o número que o servidor está usando —
       * senão "auto" não diz nada, e é justamente o padrão de quase todo mundo.
       */
      const automatico = seletor.options[0];
      if (automatico) {
        const efetivo = state.hunt?.levaVolta ?? 0;
        const rotulo = efetivo > 0 ? `voltar: auto (${efetivo})` : 'voltar: auto';
        if (automatico.textContent !== rotulo) automatico.textContent = rotulo;
      }
    }
  }
  /*
   * Enquanto ele está juntando a leva, o seletor conta em voz alta: "lurando
   * 3/5". Sem isso o jogador vê o personagem passar reto por um bicho e acha
   * que a mira quebrou.
   */
  const rotuloLure = $('lure').closest('label');
  if (rotuloLure) {
    const juntando = state.hunt?.lurando;
    /*
     * O denominador é a meta EFETIVA, e não a pedida.
     *
     * O servidor limita o pedido ao que a leva viva do andar sustenta: marcar 8
     * num andar de 5 vira 5. Mostrando o 8 daqui, o contador subia até 4/8 e
     * parava para brigar — parecia quebrado, e o número certo já vinha pronto.
     */
    const metaDaLeva = state.hunt?.levaAlvo || character.settings?.lure || 0;
    rotuloLure.firstChild.textContent = juntando ? `Lurando ${state.hunt.leva ?? 0}/${metaDaLeva} ` : 'Lurar até ';
    rotuloLure.classList.toggle('lurando', !!juntando);
  }
  titulosDosControles();

  refreshOpenPanel(character);
}

/*
 * ---- Os seletores da barra em palavra curta (15/09) ----
 *
 * No computador os seletores viram ícone + palavra curta + setinha (ver
 * `.controls-row` no style.css). Nasceu no Alvo da Caça Online ("prox, -vida,
 * +vida") e o dono pediu o mesmo para os da caçada automática. Cada entrada diz
 * como encurtar a escolha, o título do menu e o nome no balão do mouse.
 */
const CONTROLES_DA_BARRA = [
  {
    id: 'strategy', nome: 'Alvo', titulo: 'Alvo do ataque',
    curto: (v) => ({ nearest: 'prox', lowest: '-vida', highest: '+vida' })[v] ?? '',
    ajuda:
      'Alvo\nQual criatura o personagem ataca primeiro.\nMais perto: a que está mais próxima.\nMenos vida: a mais perto de morrer.\nMais vida: a com a maior porcentagem de vida.',
  },
  {
    id: 'distance', nome: 'Distância do alvo', titulo: 'Distância do alvo', curto: (v) => (v === '0' ? 'corpo' : `${v}sqm`),
    ajuda:
      'Distância do alvo\nA quantos sqm o personagem fica do bicho enquanto luta.\nCorpo a corpo: cola no bicho.\n1 a 6 sqm: recua e ataca de longe (bom para paladino e mago).',
  },
  {
    id: 'lure', nome: 'Lurar até', titulo: 'Lurar até quantos monstros', curto: (v) => (v === '0' ? 'não' : `${v}`),
    ajuda:
      'Lurar até\nEm vez de parar no primeiro bicho, o personagem segue a rota juntando criaturas atrás dele.\nSó para e luta quando juntar essa quantidade.\nNão lurar: luta com cada bicho que encontra.',
  },
  {
    id: 'lure-volta', nome: 'Voltar a lurar com', titulo: 'Voltar a lurar com', curto: (v) => (v === '0' ? 'auto' : `${v}`),
    ajuda:
      'Voltar a lurar\nQuando sobrarem essa quantidade de bichos na leva, ele larga a briga e volta a juntar mais.\nAuto: volta quando sobrar um terço da leva.',
  },
];

function titulosDosControles() {
  for (const controle of CONTROLES_DA_BARRA) {
    const seletor = $(controle.id);
    if (!seletor) continue;
    let curto = seletor.previousElementSibling?.classList.contains('ctl-curto') ? seletor.previousElementSibling : null;
    if (!curto) {
      curto = document.createElement('span');
      curto.className = 'ctl-curto';
      curto.dataset.para = controle.id;
      seletor.before(curto);
    }
    curto.hidden = seletor.hidden;
    let texto = controle.curto(seletor.value);
    // Juntando a leva, a palavra do Lurar vira a conta: "3/5". Ver `rotuloLure`.
    const rotulo = seletor.closest('label');
    if (controle.id === 'lure' && rotulo?.classList.contains('lurando')) {
      texto = rotulo.firstChild.textContent.match(/\d+\/\d+/)?.[0] ?? texto;
    }
    if (curto.textContent !== texto) curto.textContent = texto;
    /*
     * ---- O balão do mouse diz O QUE O CONTROLE FAZ (15/09) ----
     *
     * "quando colocar o mouse em cima tem que informar o que faz, pra pessoa não
     * ficar perdida, só não pode ficar na frente das seleções". A escolha já está
     * escrita na caixa; o balão explica a regra. Enquanto a lista está aberta ele
     * é tirado (ver `abrirMenuDoSeletor`), e volta quando ela fecha.
     */
    const ondeVaiOBalao = controle.id === 'lure-volta' ? seletor : rotulo;
    if (ondeVaiOBalao && !ondeVaiOBalao.dataset.menuAberto && ondeVaiOBalao.dataset.tipTexto !== controle.ajuda) {
      tipTexto(ondeVaiOBalao, controle.ajuda);
    }
  }
}
// Um resumo do que os painéis mostram. Redesenhar quatro vezes por segundo uma
// grade de 160 montarias seria desperdício; comparar isto custa quase nada.
let panelSignature = '';

/**
 * O modal aberto acompanha o estado: depositar no banco tem que mudar o saldo
 * na hora, sem fechar e abrir. O foco e o que está digitado voltam para o lugar
 * depois do redesenho.
 */
function refreshOpenPanel(character) {
  if (!panelCtx.redraw) return;

  /*
   * O que acompanha o quadro a quadro roda SEMPRE, e é barato de propósito:
   * mexe em texto e largura de barra, não refaz DOM. Ver `openModal`.
   */
  try {
    panelCtx.aoVivo?.();
  } catch {
    /* um painel com defeito no ao-vivo não pode derrubar o quadro inteiro */
  }

  /*
   * E o painel que declarou o que o faz renascer é medido só por isso. A
   * assinatura grande abaixo continua valendo para quem não declarou nada.
   */
  if (panelCtx.redrawKey) {
    let chave;
    try {
      chave = panelCtx.redrawKey();
    } catch {
      chave = null;
    }
    /*
     * Devolver `null` é dizer "para esta aba, use a assinatura grande". A ficha
     * do personagem usa isso: a aba Personagem MOSTRA os números que sobem
     * caçando e tem de acompanhá-los, enquanto a de Aparência não mostra
     * nenhum — e é nela que se escolhe roupa, que é o que um redesenho no meio
     * do clique estraga.
     */
    if (chave != null) {
      if (chave === panelSignature) return;
      panelSignature = chave;
      if (pointerDown) return;
      redesenharPreservando();
      return;
    }
  }

  /*
   * ---- A ORDEM de uma lista de itens, num número só ----
   *
   * Report do dono: "o organizar por nome no depósito só atualiza os itens
   * após alguma outra ação."
   *
   * A assinatura contava `inventory.length` e mais nada sobre listas de item —
   * e o depósito nem isso. Organizar não cria nem apaga peça nenhuma: ele
   * MUDA A ORDEM, e o comprimento fica igual. A tela então não via motivo para
   * renascer, e a caixa só aparecia arrumada no clique seguinte.
   *
   * É um número, e não a lista de ids escrita por extenso, por causa do
   * tamanho: dezessete caixas de até cem peças dariam uma string de milhares de
   * letras montada a cada estado que chega. A posição entra na conta (`i + 1`),
   * que é o que faz duas ordens diferentes das MESMAS peças darem números
   * diferentes.
   *
   * Colisão é possível e não custa nada: o pior caso é um redesenho que não
   * acontece — que é exatamente o que já acontecia antes desta linha.
   */
  const marcaDaOrdem = (lista, tempero = 1) =>
    (lista ?? []).reduce((soma, peca, i) => (soma + (peca?.id ?? 0) * (i + 1) * tempero) % 2147483647, 7);

  const signature = [
    character.gold, character.bank, character.coins, character.wildcards,
    character.level, character.weight.toFixed(1),
    character.charmPoints, character.charmNext,
    /*
     * A proficiência entra pelo NÍVEL e pelos perks por escolher — não pelo XP.
     *
     * Com a proficiência de verdade no servidor, o XP muda a cada bicho morto;
     * na assinatura, ele refazia a tela inteira (mochila, bolsa, depósito) a
     * cada morte: FPS caindo e o ping subindo junto, porque a página demorava
     * a ler o pong. A barra de XP da janela anda sozinha (`aoVivo`, panels.mjs).
     */
    character.proficiency?.itemId, character.proficiency?.level,
    (character.proficiency?.levels ?? []).reduce((n, passo) => n + (passo.unlocked && passo.chosen == null ? 1 : 0), 0),
    character.inventory.length, character.pouch.length, (character.mounts ?? []).length,
    /* A ORDEM da mochila, da bolsa e das caixas. Ver `marcaDaOrdem`. */
    marcaDaOrdem(character.inventory),
    marcaDaOrdem(character.pouch),
    marcaDaOrdem(character.bossPouch),
    marcaDaOrdem(character.storeInbox),
    (character.deposito ?? []).reduce((soma, caixa, n) => soma ^ marcaDaOrdem(caixa?.itens, n + 1), 0),
    (character.outfitsOwned ?? []).length, character.ammoPending,
    /*
     * A marca de "continuar com a próxima arma do mesmo tipo".
     *
     * Ela mora em `settings`, que não estava na assinatura — e o efeito era
     * este: a tela do Exercise mostra a estimativa do tipo inteiro só com a
     * marca ligada, e ligar a marca NÃO redesenhava a tela. O checkbox mudava
     * de cara e o resto ficava no quadro anterior, como se o clique não tivesse
     * chegado ao servidor — quando tinha.
     *
     * Foi a sonda `sonda-treino` que pegou isto, e não o teste de unidade: a
     * conta estava certa dos dois lados, e o que faltava era o redesenho.
     */
    character.settings?.exerciseAuto,
    /*
     * O bolso da aljava, e ele precisa de linha PRÓPRIA.
     *
     * Guardar munição não muda o peso (de propósito: guardar protege, não
     * some com o peso) e nem sempre muda `inventory.length` — mover 3 de
     * uma pilha de 5 não tira nenhuma vaga. Sem esta linha, a janela de
     * munição ficava com os números do quadro anterior e o clique parecia
     * não ter chegado ao servidor, quando tinha.
     */
    (character.aljavaGuardada ?? []).map((entrada) => `${entrada.id}x${entrada.count}`).join(','), 
    // E a estimativa em si: ela muda quando uma arma acaba, sem clique nenhum.
    character.exercicioFalta?.segundosTipo,
    /*
     * ---- O LOBBY inteiro, e é a linha que faz a tela dele funcionar ----
     *
     * O dono: "ta meio bugado o lobby — o char convidado nao aparece pra dar
     * pronto, e o do lider so aparece o modal correto pra iniciar se eu reabrir
     * o modal do boss".
     *
     * Não era o lobby: era este redesenho. A tela do lobby se monta uma vez e
     * depois só se refaz quando esta assinatura muda — e nada aqui olhava para
     * ela. Então TUDO o que acontece no lobby depois de a janela abrir ficava
     * invisível: o convidado que abria a janela um quadro antes de o lobby
     * existir ficava para sempre no "não há lobby aberto", e o líder ficava
     * para sempre no "esperando o time" mesmo com todo mundo pronto. Fechar e
     * abrir de novo mostrava o estado certo — que é exatamente o sintoma que
     * ele descreveu.
     *
     * Entra INTEIRO, pessoa por pessoa: quem está pronto e quem está barrado
     * mudam sem que nada mais no personagem mude, e é justamente essa mudança
     * que a janela precisa acompanhar.
     */
    character.lobby
      ? [
          character.lobby.huntId,
          character.lobby.modo,
          character.lobby.podeComecar ? 1 : 0,
          /*
           * ---- QUEM VAI NA FRENTE entra na assinatura ----
           *
           * Report do dono: "troquei quem vai na frente e pros outros ainda
           * aparece o que ia na frente antes".
           *
           * O servidor mandava a troca na hora — a sonda com dois personagens
           * prova isso —, mas a janela do lobby so' se refaz quando esta
           * assinatura muda, e nada aqui olhava para a ponta. O time inteiro
           * ficava vendo a formacao anterior ate' alguem dar "pronto", que e' o
           * que mexia numa das linhas de baixo.
           *
           * E nao e' so' um nome desenhado errado: as caixas de formacao
           * dependem de quem esta' na ponta. Quem esta' la' NAO ve "andar atras
           * de" (ele nao segue ninguem), e quem saiu de la' passa a ver — entao
           * o lider que se tirava da frente continuava sem as caixas que
           * acabara de ganhar, e quem foi posto na ponta continuava com as que
           * acabara de perder. Ver `escolhasDaPosicao`.
           */
          character.lobby.frente ?? '',
          // O automatico entra junto: o card dele muda de texto sem que o
          // "pronto" mude, e sem esta letra a janela aberta nao acompanharia.
          /*
           * E `convocado` junto: desmarcar alguem apaga o card dele e o tira da
           * lista de quem pode ir na ponta, sem mexer em mais nada aqui.
           */
          ...character.lobby.membros.map(
            (m) => `${m.nome}:${m.pronto ? 1 : 0}:${m.auto ? 1 : 0}:${m.convocado === false ? 0 : 1}:${m.impedido ?? ''}`
          ),
        ].join('~')
      : '-',
    /*
     * As hunts favoritas entram INTEIRAS na assinatura.
     *
     * Sem esta linha o coração não mudava de cara ao ser clicado: o servidor
     * gravava e mandava o estado novo, mas o painel aberto só se redesenha
     * quando a assinatura muda — e nada aqui olhava para a lista. A hunt só
     * aparecia marcada depois de fechar e reabrir a janela, que é exatamente o
     * "não funciona direito" que o dono viu.
     */
    (character.favoritas ?? []).join('.'),
    Object.values(character.equipment).map((entry) => entry?.id ?? 0).join('.'),
    /*
     * As listas do filtro entram inteiras, e não só pelo tamanho: mover um item
     * de "não vender" para "não coletar" não muda quantos são.
     *
     * Sem elas a assinatura não mexia, o filtro aberto nunca se redesenhava, e
     * o `rules` que os manipuladores seguravam ficava preso a um `character`
     * que o servidor já tinha substituído. Marcar não aparecia; arrastar
     * pintava num objeto morto e o redesenho seguinte trazia de volta o estado
     * de antes — o item "pulava" para a outra lista.
     */
    (character.itemRules?.noSell ?? []).join('.'),
    (character.itemRules?.noLoot ?? []).join('.'),
    /*
     * Os slots de prey entram inteiros — e a lista de opções junto.
     *
     * Sem isso o painel aberto nunca se redesenhava quando a lista trocava, e
     * os botões na tela continuavam sendo os de antes. Clicar num deles mandava
     * uma criatura que o servidor já tinha descartado, e a resposta era
     * "criatura não está na lista" — o erro aparecia justamente depois de um
     * reroll, que é quando a lista muda.
     *
     * `left` fica de fora do jeito que vem: ele desce a cada quadro e faria a
     * assinatura mudar quatro vezes por segundo, redesenhando o painel sem
     * parar e levando o clique junto. Em minutos ele muda uma vez por minuto,
     * que é o suficiente para a barra de tempo acompanhar.
     */
    (character.prey ?? [])
      .map((slot) =>
        [
          slot.state,
          slot.key ?? '-',
          slot.bonus ?? '-',
          slot.rarity ?? 0,
          Math.ceil((slot.left ?? 0) / 60_000),
          slot.freeReroll > 0 ? 1 : 0,
          (slot.options ?? []).join(','),
        ].join(':')
      )
      .join('|'),
  ].join('|');
  if (signature === panelSignature) return;
  panelSignature = signature;

  // Enquanto o botão está apertado, ninguém troca o DOM debaixo do clique.
  if (pointerDown) return;

  redesenharPreservando();
}

/*
 * ---- Redesenhar sem puxar o tapete de quem está usando a janela ----
 *
 * Isto morava dentro do `refreshOpenPanel`, e por isso só valia para o
 * redesenho automático — o que acontece quando o personagem muda. O redesenho
 * PEDIDO (a resposta do servidor a um filtro, a uma página, a uma compra)
 * chamava `panelCtx.redraw()` cru, e levava junto o foco e a rolagem.
 *
 * No mercado isso era visível: digitar no campo de busca dispara uma consulta
 * depois de um quarto de segundo, a resposta refazia a janela inteira, e as
 * letras seguintes caíam fora do campo. Do lado de quem joga, o filtro
 * "resetava sozinho" — que é a metade do report do Kemm que o casamento de
 * campos (ver abaixo) não explicava.
 *
 * `chamar` existe para quem quer desenhar OUTRA coisa (a janela de troca tem o
 * seu próprio desenho); sem ele, é o painel aberto.
 */
export function redesenharPreservando(chamar = null) {
  const desenhar = chamar ?? panelCtx.redraw;
  if (!desenhar) return;

  /*
   * ---- Quem estava com o dedo em qual campo ----
   *
   * O endereço do campo é guardado por TRÊS coisas, e a ordem importa: o id,
   * depois o placeholder, e por último a posição dele na fila de campos da
   * janela. Foi a falta desse terceiro degrau que fazia os filtros do mercado
   * "resetarem" sozinhos — o porquê está escrito na busca do campo de volta,
   * mais abaixo.
   */
  const camposDoModal = () => [...document.querySelectorAll('#modal input, #modal select')];
  const active = document.activeElement;
  const typing =
    active && active.closest?.('#modal') && (active.tagName === 'INPUT' || active.tagName === 'SELECT')
      ? {
          id: active.id,
          placeholder: active.placeholder,
          value: active.value,
          at: active.selectionStart,
          tag: active.tagName,
          indice: camposDoModal().indexOf(active),
        }
      : null;

  /*
   * Onde a rolagem estava.
   *
   * O redesenho troca o `innerHTML` inteiro, e um miolo novo nasce no topo. Em
   * listas longas — a loja, o bestiary — bastava o ouro mudar para o jogador
   * ser jogado de volta ao começo no meio da leitura. Ele parecia um puxão
   * automático; era o painel se refazendo debaixo dele.
   *
   * Quem rola nem sempre é o `#modal-body`: na loja é a prateleira lá dentro.
   * Então cada elemento rolado é guardado com o caminho até ele — tag, classes
   * e posição entre os irmãos —, que é o que sobrevive a um redesenho que
   * refaz a mesma estrutura. Casar por ordem de aparição não servia: a lista
   * dos que rolam antes e depois nem sempre é a mesma.
   */
  const caminho = (node, raiz) => {
    const partes = [];
    for (let n = node; n && n !== raiz; n = n.parentElement) {
      const irmaos = [...(n.parentElement?.children ?? [])];
      const classe = n.className && typeof n.className === 'string'
        ? '.' + n.className.trim().split(/\s+/).join('.')
        : '';
      partes.unshift(`${n.tagName}${classe}:${irmaos.indexOf(n)}`);
    }
    return partes.join('>');
  };

  const corpo = $('modal-body');
  const rolados = [];
  if (corpo) {
    if (corpo.scrollTop > 0) rolados.push(['', corpo.scrollTop]);
    for (const n of corpo.querySelectorAll('*')) {
      if (n.scrollTop > 0) rolados.push([caminho(n, corpo), n.scrollTop]);
    }
  }

  desenhar();

  // O conteúdo pode ter encurtado; o navegador limita sozinho ao máximo novo.
  for (const [onde, quanto] of rolados) {
    if (!onde) {
      corpo.scrollTop = quanto;
      continue;
    }
    const alvo = [...corpo.querySelectorAll('*')].find((n) => caminho(n, corpo) === onde);
    if (alvo) alvo.scrollTop = quanto;
  }

  if (!typing) return;

  /*
   * ---- O campo de volta tem de ser O MESMO campo ----
   *
   * Report do Kemm, e o dono viu de perto: "os filtros do mercado vão meio que
   * resetando quando o char faz alguma ação caçando". Não era o mercado — era
   * esta busca aqui.
   *
   * Ela procurava assim:
   *
   *     (typing.id && field.id === typing.id) || field.placeholder === typing.placeholder
   *
   * Os seletores de filtro do mercado não tinham id nem placeholder. Então
   * `typing.placeholder` era `undefined`, `field.placeholder` de um `<select>`
   * TAMBÉM é `undefined`, e `undefined === undefined` é verdade: o primeiro
   * seletor da janela casava com qualquer outro. Escolher "raridade: raro" e
   * esperar um quadro escrevia `raro` dentro do seletor de SLOT — que não tem
   * essa opção e ficava em branco —, e levava o foco junto. O filtro parecia
   * ter se apagado sozinho, e o gatilho era qualquer coisa que mudasse o
   * personagem: matar um bicho, pegar um loot, ganhar ouro.
   *
   * Agora casa por id, por placeholder DE VERDADE, ou pela posição na fila com
   * a mesma etiqueta — e nada casa por acaso.
   */
  const fields = camposDoModal();
  const back =
    (typing.id && fields.find((field) => field.id === typing.id)) ||
    (typing.placeholder && fields.find((field) => field.placeholder === typing.placeholder)) ||
    (typing.indice >= 0 && fields[typing.indice]?.tagName === typing.tag ? fields[typing.indice] : null);
  if (!back) return;

  /*
   * E num `<select>` quem manda é o desenho novo, não o que estava na tela.
   *
   * O campo de texto guarda um rascunho — o que a pessoa digitou e ainda não
   * mandou —, e devolvê-lo é o certo. Um seletor não: ele acabou de ser montado
   * com o valor que vale agora, e sobrescrevê-lo com o de antes é reescrever o
   * estado a partir da tela. Só o FOCO volta. E se o valor antigo nem existe na
   * lista nova, escrevê-lo deixaria o seletor em branco — que é exatamente o
   * defeito de cima.
   */
  if (back.tagName !== 'SELECT') back.value = typing.value;
  back.focus();
  try {
    back.setSelectionRange(typing.at, typing.at);
  } catch {
    /* select não tem seleção de texto */
  }
}

// A moeda da barra superior é a pilha de 100 crystal coins do próprio client.
let goldIconDrawn = false;
function renderGoldIcon() {
  if (goldIconDrawn) return;
  goldIconDrawn = true;
  const holder = $('coin-gold');
  holder.innerHTML = '';
  holder.append(itemCanvas(3043, 18, 100));
}

const formatTime = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
};

/*
 * ---- O balão do ícone de Análise ----
 *
 * Ele dizia "mostra ou esconde exp por hora, lucro e o loot da sessão" — uma
 * frase que já não descrevia a janela depois que ela ganhou o dano por
 * elemento. Balão que promete menos do que existe é pior que balão nenhum.
 *
 * Então ele mostra o que há dentro, com o número mais útil de cada um: quanto a
 * caçada rendeu e de que elemento vem o grosso do dano.
 *
 * A espera dos bosses SAIU daqui junto com a seção que a desenhava — ela virou
 * a janela Boss Cooldown, que se abre pelas Opções. Ver `renderBossCdJanela`.
 */
function resumoDosAnalisadores() {
  const session = state.hunt?.session;
  const caixa = el('div', 'tip-arvore');

  const linha = (titulo, valor) => {
    const item = el('div');
    item.append(el('b', null, titulo), el('em', null, valor));
    caixa.append(item);
  };

  linha('Sessão', session ? `${(session.exp ?? 0).toLocaleString('pt-BR')} de exp` : 'fora da caçada');

  const causado = session?.porElemento?.causado ?? {};
  const maior = Object.entries(causado).sort((a, b) => b[1] - a[1])[0];
  const total = Object.values(causado).reduce((t, v) => t + v, 0);
  const NOMES = {
    physical: 'físico', fire: 'fogo', earth: 'terra', energy: 'energia',
    ice: 'gelo', holy: 'sagrado', death: 'morte',
  };
  linha(
    'Dano por elemento',
    maior && total ? `${NOMES[maior[0]] ?? maior[0]} em ${Math.round((maior[1] / total) * 100)}%` : 'nada ainda',
  );

  return caixa;
}

/*
 * ---- A janela Buffs e Boosts, linha por linha ----
 *
 * Uma linha por coisa correndo: o desenho, o nome, o que ela dá e o relógio.
 * Sem gráfico e sem total — a pergunta que ela responde é "o que está ligado e
 * quanto falta", e um resumo somado responderia outra.
 *
 * Ela e as pílulas são EXCLUSIVAS — ver `MODOS_DE_EFEITO`, em `hud.mjs`: a
 * pessoa escolhe uma das duas, e não as duas juntas mostrando o mesmo relógio
 * duas vezes.
 *
 * A lista vem de `linhasDeEfeito`, a mesma das pílulas — uma fonte só, para as
 * duas telas nunca discordarem, e os grupos desligados ficam de fora das duas.
 */
function renderBuffsJanela() {
  const body = windowBody('buffs');
  if (!body || !state.character) return;

  /*
   * ---- Fechada não faz nada, e aberta só refaz o que mudou ----
   *
   * Medido no perfil do cliente numa caçada: esta janela era apagada e
   * remontada — com um canvas novo por linha — duas vezes a cada quadro do
   * servidor, e FECHADA, que é como ela fica para quase todo mundo (`windowBody`
   * devolve o corpo mesmo escondido). Mesmo aberta, o relógio mais fino dela é o
   * segundo: das dezesseis remontagens por segundo, quinze desenhavam a mesma
   * coisa. É o mesmo arranjo da janela Boss Cooldown, logo abaixo.
   */
  if (!isVisible('buffs')) {
    // Só apaga se houver o que apagar: reescrever o atributo com o mesmo valor
    // ainda é uma escrita no DOM — quatro por segundo, com a janela fechada.
    if (body.dataset.assinatura) body.dataset.assinatura = '';
    return;
  }
  const linhas = linhasDeEfeito(state.character);
  const assinatura = JSON.stringify(
    linhas.map((linha) => [linha.classe, linha.item, linha.arte, linha.nome, linha.balao, formatTime(linha.restante), linha.estado])
  );
  if (body.dataset.assinatura === assinatura) return;
  body.dataset.assinatura = assinatura;
  body.innerHTML = '';

  if (!linhas.length) {
    body.append(
      el(
        'p',
        'empty',
        'Nada correndo agora. Poções de experiência, XP Boost, os Buff Power e os passes de Instance e Divine Hunts aparecem aqui com o tempo de cada um.'
      )
    );
    return;
  }

  const lista = el('div', 'buffs-lista');
  for (const linha of linhas) {
    const item = el('div', `buffs-linha ${linha.classe}`);

    const arte = linha.item ? itemCanvas(linha.item, 26) : artOrUiIcon(linha.arte ?? '', '');
    if (arte) item.append(arte);

    const texto = el('div', 'buffs-texto');
    texto.append(el('b', null, linha.nome));
    texto.append(el('em', null, linha.balao));
    item.append(texto);

    const relogio = el('div', 'buffs-relogio');
    relogio.append(el('b', null, formatTime(linha.restante)));
    relogio.append(el('span', null, linha.estado));
    item.append(relogio);

    lista.append(item);
  }
  body.append(lista);
}

/*
 * ---- A janela Boss Cooldown ----
 *
 * Uma linha por sala em espera: o bicho, o nome e quanto falta. O desenho e' o
 * mesmo dos Buffs — mesma grade, mesma coluna de relogio — porque foi assim que
 * o dono pediu e porque as duas respondem a mesma forma de pergunta ("o que
 * esta' correndo e quanto falta").
 *
 * ---- Por que ela mostra so' QUEM ESTA ESPERANDO ----
 *
 * A lista de espera do personagem tem uma entrada para CADA boss do jogo — sao
 * mais de noventa, e a esmagadora maioria com zero. Uma janela chamada Boss
 * Cooldown que abre com noventa linhas escritas "pronto" nao responde nada: a
 * resposta esta' nas quatro ou cinco que estao fechadas. Quantas sobraram
 * prontas cabe numa frase, e ela fica no alto.
 *
 * ---- E os "ticks", que sao o pedido explicito ----
 *
 * "deixa otimizado pra nao gerar lag com tantos ticks."
 *
 * Tres cortes, do mais barato para o mais caro:
 *
 *   1. FECHADA ela nao faz nada — nem a volta na lista de bosses. `windowBody`
 *      devolve o corpo mesmo com a janela escondida, entao sem esta linha ela
 *      trabalharia de graca para todo mundo que nunca a abriu.
 *
 *   2. ABERTA ela anda de SEGUNDO em segundo, e nao de quadro em quadro. O
 *      relogio mais fino aqui e' o segundo; refazer a conta oito vezes por
 *      segundo escreveria exatamente o mesmo texto sete vezes.
 *
 *   3. E o DOM so' e' refeito quando a lista muda de gente. Redesenhar as
 *      linhas por segundo significaria criar um canvas novo por boss por
 *      segundo — e um canvas de outfit e' a coisa mais cara que esta tela
 *      desenha. Entao os nos ficam, guardados por id, e o que anda e' o texto
 *      do relogio. A `chave` e' a lista de ids em ordem: quando um boss fica
 *      pronto ele sai dela, e so' ai' a janela se refaz.
 */
const bossCdVivo = { chave: null, segundo: 0, relogios: new Map() };

/** O bicho do boss, com a cor do bestiario. Igual ao card de Aventuras. */
function figuraDoBoss(boss, tamanho) {
  const criatura = (boss.creatures ?? [])[0];
  if (!criatura) return null;
  const entry = state.catalog?.bestiary?.[criatura.key];
  /*
   * A cor vem do BESTIARIO e nao do arquivo da sala: sem a mascara de cores um
   * humanoide sai todo branco. Ver `figuraDaCriatura`, em panels.mjs — mesma
   * regra, e de proposito.
   */
  const cores = criatura.colors ?? entry?.colors ?? null;
  const item = criatura.lookItem ?? entry?.lookItem ?? 0;
  if (outfitInfo(criatura.look)) return outfitCanvas(criatura.look, cores, tamanho, 2, true);
  if (item) return itemCanvas(item, tamanho);
  return null;
}

function renderBossCdJanela() {
  const body = windowBody('bossCd');
  if (!body || !state.character) return;

  /* 1. fechada, ela nao custa nada. */
  if (!isVisible('bossCd')) {
    bossCdVivo.chave = null;
    return;
  }

  /* 2. e aberta ela anda de segundo em segundo. */
  const segundo = Math.floor(Date.now() / 1000);
  if (bossCdVivo.chave && segundo === bossCdVivo.segundo) return;
  bossCdVivo.segundo = segundo;

  const espera = state.character.bossCooldowns ?? {};
  const todos = state.catalog?.bosses ?? [];
  const esperando = todos
    .map((boss) => ({ boss, falta: espera[boss.id] ?? 0 }))
    .filter((linha) => linha.falta > 0)
    .sort((a, b) => a.falta - b.falta || a.boss.name.localeCompare(b.boss.name, 'pt-BR'));

  /* 3. e o DOM so' se refaz quando a lista muda de gente. */
  const chave = todos.length + '|' + esperando.map((linha) => linha.boss.id).join(',');
  if (chave !== bossCdVivo.chave) {
    bossCdVivo.chave = chave;
    bossCdVivo.relogios = new Map();
    body.innerHTML = '';

    const prontos = todos.length - esperando.length;
    body.append(
      el(
        'p',
        'bosscd-conta',
        todos.length
          ? prontos + (prontos === 1 ? ' sala pronta' : ' salas prontas') + ' de ' + todos.length + '.'
          : 'Nenhuma sala de boss no catálogo.'
      )
    );

    if (!esperando.length) {
      body.append(
        el(
          'p',
          'empty',
          'Nenhum boss em espera — todas as salas estão abertas. Quem entra numa sala aparece aqui com o tempo até ela reabrir.'
        )
      );
      return;
    }

    const lista = el('div', 'buffs-lista');
    for (const { boss, falta } of esperando) {
      const item = el('div', 'buffs-linha bosscd');

      const arte = figuraDoBoss(boss, 26);
      /*
       * A grade tem tres colunas fixas e a primeira e' o desenho: um boss sem
       * sprite (bicho de `lookTypeEx` que o bestiario ainda nao conhece) tem de
       * deixar a coluna ali, ou o nome dele escorrega para a esquerda e a lista
       * desalinha na altura dele.
       */
      item.append(arte ?? el('span', 'hunt-bicho-vazio'));

      const texto = el('div', 'buffs-texto');
      texto.append(el('b', null, boss.name));
      texto.append(el('em', null, 'level ' + boss.level + '+'));
      item.append(texto);

      const relogio = el('div', 'buffs-relogio');
      const conta = el('b', null, formatTime(falta));
      relogio.append(conta, el('span', null, 'até reabrir'));
      item.append(relogio);

      bossCdVivo.relogios.set(boss.id, conta);
      lista.append(item);
    }
    body.append(lista);
    return;
  }

  /* E no segundo seguinte anda so' o texto do relogio. */
  for (const { boss, falta } of esperando) {
    const conta = bossCdVivo.relogios.get(boss.id);
    if (conta) conta.textContent = formatTime(falta);
  }
}

/*
 * ---- FECHADO, o analisador não desenha nada ----
 *
 * Medido num telefone (412x915, dpr 3, CPU 4x mais lenta), com o personagem
 * PARADO na cidade: a interface fazia mil escritas de DOM por segundo, e
 * QUINHENTAS delas eram esta função — que refaz o painel inteiro
 * (`conteudo.innerHTML = ''` e dezenas de elementos) a cada estado que chega do
 * servidor, oito vezes por segundo.
 *
 * E a janela estava FECHADA. `windowBody` devolve o corpo mesmo escondido, e a
 * função nunca perguntou se alguém estava olhando: todo mundo que nunca abriu o
 * analisador pagava o preço dele o tempo todo.
 *
 * É a regra 1 das três que a janela de cooldown de boss já segue e documenta
 * (ver a nota do `bossCdVivo`, mais acima): fechada não faz nada. O `quandoAbrir`
 * cuida do instante em que ela abre, para não aparecer vazia.
 *
 * As outras duas regras de lá — andar de segundo em segundo e só refazer o DOM
 * quando muda — valem aqui também e ficam para uma segunda passada: esta
 * sozinha já tira o custo da tela de quem tem a janela fechada, que é a maioria.
 */
/* O último alcance com que a lista de distância foi escrita. Ver `renderAll`. */
let ultimoAlcanceDaLista = null;

/*
 * ---- O analisador se redesenha UMA vez por segundo ----
 *
 * Ele monta o painel inteiro do zero — os doze números, a lista do loot, a do
 * vendido, a do dano por elemento, com um ícone por item — e isso acontecia a
 * cada quadro do servidor: oito vezes por segundo, no navegador de quem está
 * caçando com a janela aberta (que é quase todo mundo).
 *
 * E não precisa: tudo o que ele mostra ou é um relógio em SEGUNDOS (sessão,
 * próximo level) ou vem do analisador e da bolsa, que são objetos — e, com o
 * delta, objeto só é trocado quando muda de verdade (ver `applyState` e a
 * `bagKey`). A assinatura junta os dois: mudou o segundo ou mudou um objeto,
 * redesenha; senão, o painel que já está na tela continua certo.
 *
 * O `childElementCount` do corpo entra junto por segurança: se alguém esvaziar
 * a janela (fechar e abrir, trocar de personagem), a conta muda e o painel é
 * montado de novo mesmo que nada mais tenha mudado.
 */
let assinaturaDoAnalisador = null;

function renderAnalyzer() {
  const body = windowBody('analyzer');
  if (!body || !isVisible('analyzer') || !state.character) return;

  const hunt = state.hunt;
  const session = hunt?.session;
  const elapsed = hunt ? Date.now() - hunt.startedAt : 0;
  const assinatura = [
    hunt?.startedAt ?? 0,
    Math.floor(elapsed / 1000),
    session ?? null,
    state.character.pouchValue ?? null,
    state.character.progress ?? null,
    state.character.name,
    body.childElementCount,
  ];
  if (assinaturaDoAnalisador && assinatura.every((parte, i) => parte === assinaturaDoAnalisador[i])) return;
  assinaturaDoAnalisador = assinatura;
  const hours = elapsed / 3600000;
  const supplies = session?.supplies ?? 0;
  /*
   * ---- O loot vale o que foi COLETADO, pelo preço do NPC ----
   *
   * Antes: ouro + o que a venda automática vendeu + a bolsa de AGORA. Vender a bolsa no botão,
   * levar um item para a mochila ou guardar uma peça tirava o valor da conta (o lucro caía, até
   * ficar negativo), e depois de zerar o analisador a bolsa de antes entrava na sessão nova. Agora
   * o servidor manda a análise (`session.analise`, ver `hunt/rentabilidade.mjs`) com a mesma regra
   * de preço da venda. Servidor antigo (sem ela): a conta de antes.
   */
  const analise = session?.analise ?? null;
  const pending = state.character.pouchValue?.gold ?? 0;
  const income = analise ? analise.bruto : (session?.gold ?? 0) + (session?.lootValue ?? 0) + pending;
  const profit = analise ? analise.liquido : income - supplies;
  const perHour = hours > 0.01 ? (session?.exp ?? 0) / hours : 0;

  /*
   * ---- O botão de zerar NÃO é redesenhado ----
   *
   * O dono: "às vezes tem que clicar umas 3x em zerar analisador pra
   * funcionar".
   *
   * É o mesmo defeito que o inventário já tinha, e está escrito lá em cima com
   * todas as letras: reconstruir o DOM quatro vezes por segundo troca o
   * elemento no meio do clique. O navegador só dispara `click` quando o
   * apertar e o soltar caem no MESMO elemento — e o estado chega do servidor a
   * cada ação da caçada, então um redesenho no meio dos cem milissegundos do
   * clique come o clique inteiro, sem erro nenhum na tela.
   *
   * O conteúdo continua sendo refeito (são números, e eles mudam a cada
   * golpe); o BOTÃO é criado uma vez e fica. Só o `disabled` dele acompanha.
   */
  let conteudo = body.querySelector('.analyzer-conteudo');
  let reset = body.querySelector('.analyzer-zerar');
  if (!conteudo || !reset) {
    body.innerHTML = '';
    conteudo = el('div', 'analyzer-conteudo');
    reset = el('button', 'wide analyzer-zerar', 'Zerar analisador');
    reset.onclick = () => send({ t: 'resetAnalyzer' });
    body.append(conteudo, reset);
  }
  conteudo.innerHTML = '';
  reset.disabled = !hunt;

  const grid = el('div', 'grid2');
  const add = (label, value, color) => {
    const cell = el('div');
    const span = el('span', null, value);
    if (color) span.style.color = color;
    cell.append(el('b', null, label), span);
    grid.append(cell);
  };

  add('Sessão', hunt ? formatTime(elapsed) : '--:--:--');
  add('Próximo level', perHour > 0 ? formatTime((state.character.progress.toNext / perHour) * 3600000) : '--');
  /*
   * ---- Em grupo, a XP é a SUA ----
   *
   * O servidor manda `session.exp` já como a experiência de quem está olhando
   * (ver o `snapshot`), porque os bônus são de cada um: com um char de XP boost
   * e outro sem, um número somado seria errado para os dois.
   *
   * O total do grupo não some — vira uma linha própria, que é a resposta para
   * "quanto esta caçada rendeu" sem atrapalhar a resposta para "quanto EU
   * ganhei".
   */
  add('XP total', (session?.exp ?? 0).toLocaleString('pt-BR'));
  add('XP/h', hours > 0.001 ? Math.round(perHour).toLocaleString('pt-BR') : '0');
  if (session?.emGrupo) {
    add('XP do grupo', (session.expDoGrupo ?? 0).toLocaleString('pt-BR'));
    const doGrupoHora = hours > 0.01 ? (session.expDoGrupo ?? 0) / hours : 0;
    add('XP/h do grupo', hours > 0.001 ? Math.round(doGrupoHora).toLocaleString('pt-BR') : '0');
  }
  add('Loot (bruto)', income.toLocaleString('pt-BR'));
  add('Suprimentos', `-${supplies.toLocaleString('pt-BR')}`, 'var(--danger)');
  add('Lucro líquido', profit.toLocaleString('pt-BR'), profit < 0 ? 'var(--danger)' : 'var(--accent)');
  add('Lucro/h', hours > 0.001 ? Math.round(profit / hours).toLocaleString('pt-BR') : '0');
  add('Kills', String(session?.kills ?? 0));
  add('Dano causado', (session?.damageDealt ?? 0).toLocaleString('pt-BR'));
  conteudo.append(grid);

  /*
   * ---- De onde vem o valor, e o que as chances dariam ----
   *
   * O bruto separado (ouro das moedas + itens pelo preço do NPC), o aviso dos itens sem preço (que
   * contam 0 — em vez de um número que parece completo), os itens que mais pesam e, à parte e
   * marcada como ESTIMATIVA, o que as chances de drop dos bichos mortos dariam (chance × mortes ×
   * preço, sem os bônus de loot): é probabilidade, não o que caiu.
   */
  if (analise) {
    const detalhe = el('div', 'analyzer-detalhe');
    const linha = (texto, cor) => {
      const p = el('p', null, texto);
      if (cor) p.style.color = cor;
      detalhe.append(p);
    };
    linha(`Ouro (moedas) ${(analise.gold ?? 0).toLocaleString('pt-BR')} + itens pelo preço do NPC ${(analise.valorDoLoot ?? 0).toLocaleString('pt-BR')}`);
    if (analise.semPreco) linha(`${analise.semPreco.toLocaleString('pt-BR')} item(ns) sem preço de NPC — contam 0.`, 'var(--muted)');
    if (analise.principais?.length) {
      linha('Os que mais valem:');
      for (const i of analise.principais) {
        const nome = state.items?.[i.id]?.name ?? `item ${i.id}`;
        linha(`• ${i.count}x ${nome} — ${i.unidade.toLocaleString('pt-BR')} cada = ${i.total.toLocaleString('pt-BR')}`, 'var(--muted)');
      }
    }
    const est = analise.estimativa;
    if (est && (session?.kills ?? 0) > 0) {
      linha(`Estimativa pelas chances de drop: ${(est.gold + est.valor).toLocaleString('pt-BR')} bruto, ${est.liquido.toLocaleString('pt-BR')} líquido (probabilidade, sem bônus de loot — não é o que caiu).`, 'var(--muted)');
    }
    conteudo.append(detalhe);
  }

  const tally = el('div', 'tally');
  for (const [name, count] of Object.entries(session?.byMonster ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    const row = el('div');
    row.append(el('b', null, `${count}x `), document.createTextNode(name));
    tally.append(row);
  }
  conteudo.append(tally);

  /*
   * Analisador de loot.
   *
   * A lista de kills diz o que morreu; esta diz o que caiu. São ícones pequenos
   * com a quantidade no canto, ordenados do mais numeroso para o menos — em
   * texto a lista viraria uma coluna de vinte linhas e a janela dobraria de
   * altura. Fica dobrável, e o estado é lembrado.
   */
  const loot = Object.entries(session?.loot ?? {})
    .map(([id, count]) => [Number(id), count])
    .filter(([id]) => state.items[id])
    .sort((a, b) => b[1] - a[1]);

  const caixa = el('details', 'loot-tally');
  caixa.open = localStorage.getItem('draevor:loot-tally') !== '0';
  caixa.ontoggle = () => localStorage.setItem('draevor:loot-tally', caixa.open ? '1' : '0');
  caixa.append(el('summary', null, `Loot da sessão (${loot.length})`));

  if (loot.length) {
    const grade = el('div', 'loot-tally-grid');
    for (const [id, count] of loot) {
      const cell = el('div', 'loot-chip');
      cell.append(itemCanvas(id, 24));
      cell.append(el('i', null, count > 999 ? `${Math.round(count / 1000)}k` : String(count)));
      tipFor(cell, id);
      grade.append(cell);
    }
    caixa.append(grade);
  } else {
    caixa.append(el('p', 'empty', 'nada ainda'));
  }
  conteudo.append(caixa);

  /*
   * ---- O que a caçada CONSUMIU ----
   *
   * O lucro já mostrava "suprimentos: 240.000" — um número que não sugere nada.
   * Duzentos e quarenta mil pode ser potion demais, flecha demais ou uma runa
   * cara, e as três pedem decisões diferentes: trocar de potion, comprar flecha
   * mais barata, parar de soltar a runa.
   *
   * Então é a MESMA grade do loot, do outro lado da conta: o que entrou em cima,
   * o que saiu embaixo. Cada peça traz a quantidade (que é como o jogador pensa
   * nisso — "gastei 400 flechas") e o ouro que ela levou.
   */
  const gastos = Object.entries(session?.gastos ?? {})
    .map(([id, linha]) => [Number(id), linha])
    .filter(([id, linha]) => state.items[id] && linha?.qtd > 0)
    .sort((a, b) => b[1].gold - a[1].gold);

  /** Número curto: a grade tem 24px de largura por peça, não cabe "1.240.000". */
  const curto = (valor) => {
    if (valor >= 1_000_000) return `${(valor / 1_000_000).toFixed(1).replace('.', ',')}kk`;
    if (valor >= 1000) return `${(valor / 1000).toFixed(valor >= 10_000 ? 0 : 1).replace('.', ',')}k`;
    return String(Math.round(valor));
  };

  const gastoBox = el('details', 'loot-tally');
  gastoBox.open = localStorage.getItem('draevor:gastos') !== '0';
  gastoBox.ontoggle = () => localStorage.setItem('draevor:gastos', gastoBox.open ? '1' : '0');
  /*
   * O total vem com a MOEDA, e não com um "g" colado no número.
   *
   * É a mesma pilha de crystal coins do resto do jogo (item 3043, `count: 1`):
   * a linha se lê de relance como dinheiro, sem depender da letra.
   */
  const somaGasto = el('span', 'gasto-total');
  somaGasto.append(itemCanvas(3043, 13, 1));
  somaGasto.append(el('b', null, curto(session?.supplies ?? 0)));
  const tituloGasto = el('summary', null, 'Suprimentos da sessão');
  tituloGasto.append(somaGasto);
  gastoBox.append(tituloGasto);

  if (gastos.length) {
    const grade = el('div', 'loot-tally-grid');
    for (const [id, linha] of gastos) {
      const cell = el('div', 'loot-chip gasto');
      // 30px, contra os 24 do loot: aqui cada peça carrega duas linhas de
      // número embaixo, e no tamanho do loot o desenho sumia entre elas.
      cell.append(itemCanvas(id, 30));
      cell.append(el('i', null, curto(linha.qtd)));
      cell.append(el('u', null, curto(linha.gold)));
      tipFor(cell, id);
      grade.append(cell);
    }
    gastoBox.append(grade);
  } else {
    gastoBox.append(el('p', 'empty', 'nada gasto ainda'));
  }
  conteudo.append(gastoBox);

  /*
   * ---- Analisador de dano, por elemento ----
   *
   * "Dano causado: 1.240.000" responde à pergunta fácil. A que decide compra é
   * de QUÊ: quem apanha 60% de fogo compra resistência a fogo, e quem bate 70%
   * de físico não ganha nada com um imbuement de gelo. Os dois lados numa
   * tabela só porque a decisão é a mesma — o que eu dou e o que eu levo.
   *
   * Barra proporcional em vez de porcentagem escrita: sete linhas de números
   * exigem comparar de cabeça; sete barras se leem de uma vez.
   */
  const elementos = ['physical', 'fire', 'earth', 'energy', 'ice', 'holy', 'death'];
  const NOME_DO_ELEMENTO = {
    physical: 'físico', fire: 'fogo', earth: 'terra', energy: 'energia',
    ice: 'gelo', holy: 'sagrado', death: 'morte',
  };
  const porElemento = session?.porElemento ?? { causado: {}, recebido: {} };

  const danoBox = el('details', 'loot-tally');
  danoBox.open = localStorage.getItem('draevor:dano-elem') === '1';
  danoBox.ontoggle = () => localStorage.setItem('draevor:dano-elem', danoBox.open ? '1' : '0');
  danoBox.append(el('summary', null, 'Dano por elemento'));

  const lado = (titulo, dados, cor) => {
    const total = Object.values(dados ?? {}).reduce((t, v) => t + v, 0);
    const bloco = el('div', 'dano-lado');
    bloco.append(el('h5', null, `${titulo} — ${total.toLocaleString('pt-BR')}`));
    const linhas = elementos
      .map((tipo) => [tipo, dados?.[tipo] ?? 0])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    if (!linhas.length) {
      bloco.append(el('p', 'empty', 'nada ainda'));
      return bloco;
    }
    for (const [tipo, valor] of linhas) {
      const linha = el('div', 'dano-linha');
      const barra = el('i');
      barra.style.width = `${Math.round((valor / total) * 100)}%`;
      barra.style.background = cor;
      const trilho = el('div', 'dano-barra');
      trilho.append(barra);
      linha.append(
        artOrUiIcon(`el-${tipo}`, NOME_DO_ELEMENTO[tipo]),
        el('b', null, NOME_DO_ELEMENTO[tipo]),
        trilho,
        el('span', null, `${Math.round((valor / total) * 100)}%`),
      );
      linha.title = `${valor.toLocaleString('pt-BR')} de dano`;
      bloco.append(linha);
    }
    return bloco;
  };
  danoBox.append(
    lado('Causado', porElemento.causado, 'var(--accent, #6fc)'),
    lado('Recebido', porElemento.recebido, 'var(--danger, #c55)'),
  );
  conteudo.append(danoBox);

  /*
   * ---- Analisador de dano do FAMILIAR ----
   *
   * O dono: "coloca o analisador de dano do summon dentro do analisador de
   * hunt".
   *
   * O golpe do familiar sempre entrou no "Dano causado" — e é ali que ele deve
   * entrar. O que não dava para saber é QUANTO daquele número era dele, que é a
   * única pergunta que decide alguma coisa: o nível do familiar custa Summon
   * Upgrade, e sem a fatia não há como saber se o próximo compensa.
   *
   * A média por acerto está aqui para ser comparada com a do dono: o familiar
   * bate uma fração do golpe dele (ver `fracaoDoDano`), e ver as duas lado a
   * lado é o que transforma "ele bate" em "ele bate tanto assim".
   */
  const summon = state.character.summon;
  const doFamiliar = session?.danoDoFamiliar ?? 0;
  if (doFamiliar > 0 || summon?.familiar) {
    const totalDano = session?.damageDealt ?? 0;
    const fatia = totalDano > 0 ? Math.round((doFamiliar / totalDano) * 100) : 0;
    const acertos = session?.acertosDoFamiliar ?? 0;

    const famBox = el('details', 'loot-tally');
    famBox.open = localStorage.getItem('draevor:dano-familiar') === '1';
    famBox.ontoggle = () => localStorage.setItem('draevor:dano-familiar', famBox.open ? '1' : '0');
    // O nome do familiar DELE no título: quem pôs nome ou skin reconhece o seu.
    const quem = summon?.familiar?.nome ?? 'familiar';
    famBox.append(el('summary', null, `Dano do ${quem} — ${fatia}% do total`));

    const fam = el('div', 'grid2');
    const addFam = (rotulo, valor) => {
      const cell = el('div');
      cell.append(el('b', null, rotulo), el('span', null, valor));
      fam.append(cell);
    };
    addFam('Dano do familiar', doFamiliar.toLocaleString('pt-BR'));
    addFam('Fatia do total', `${fatia}%`);
    addFam('Dano/h', hours > 0.001 ? Math.round(doFamiliar / hours).toLocaleString('pt-BR') : '0');
    addFam('Acertos', acertos.toLocaleString('pt-BR'));
    addFam('Média por acerto', acertos > 0 ? Math.round(doFamiliar / acertos).toLocaleString('pt-BR') : '0');
    if (summon) addFam('Nível do familiar', `${summon.nivel ?? 0} de ${summon.teto ?? 0}`);
    famBox.append(fam);

    /*
     * Em grupo, de QUEM foi cada golpe.
     *
     * O extrato é da caçada, mas cada um tem o SEU familiar — e "o meu está
     * rendendo?" não se responde com o total do grupo. A quebra só aparece
     * quando há mais de um: com um familiar só ela repetiria a linha de cima.
     */
    const porNome = Object.entries(session?.familiarPorNome ?? {})
      .map(([nome, linha]) => [nome, linha?.dano ?? 0])
      .filter(([, dano]) => dano > 0)
      .sort((a, b) => b[1] - a[1]);
    if (porNome.length > 1) {
      const lista = el('div', 'boss-cd');
      for (const [nome, dano] of porNome) {
        const linha = el('div');
        linha.append(
          el('b', null, nome),
          el('span', null, `${dano.toLocaleString('pt-BR')} (${Math.round((dano / doFamiliar) * 100)}%)`),
        );
        lista.append(linha);
      }
      famBox.append(lista);
    }
    conteudo.append(famBox);
  }

}

// ---------- avisos e modal ----------

let noticeTimer = null;
/**
 * Confirmação da promoção: diz quanto custa, quanto sobra e o que muda. Como no
 * NPC do servidor, é uma vez só.
 */
function openPromotion() {
  const promotion = state.character?.promotion;
  if (!promotion || promotion.done) return;

  openModal('Promotion', (modal) => {
    const gold = state.character.gold;
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    };

    // "Knight → Elite Knight" em destaque, e o que ganha em linhas grandes (não num parágrafo cinza).
    const deParaAte = el('div', 'promotion-deparas');
    deParaAte.append(el('span', 'de', promotion.from), el('span', 'seta', '→'), el('span', null, promotion.name));
    modal.append(deParaAte);

    const ganhos = el('ul', 'promotion-ganhos');
    const linhaDeGanho = (rotulo, valor) => {
      const li = el('li');
      li.append(el('span', null, rotulo), el('b', null, valor));
      ganhos.append(li);
    };
    linhaDeGanho('Regeneração de vida', `+${Math.round((promotion.hp - 1) * 100)}%`);
    linhaDeGanho('Regeneração de mana', `+${Math.round((promotion.mana - 1) * 100)}%`);
    modal.append(ganhos);

    const table = document.createElement('table');
    table.className = 'list promotion-tabela';
    for (const [label, value] of [
      ['Custo', `${promotion.cost.toLocaleString('pt-BR')} gold`],
      ['Saldo atual', `${gold.toLocaleString('pt-BR')} gold`],
      ['Saldo depois', `${(gold - promotion.cost).toLocaleString('pt-BR')} gold`],
    ]) {
      const row = document.createElement('tr');
      row.append(el('td', null, label), el('td', 'gold', value));
      table.append(row);
    }
    modal.append(table);

    const confirm = el('button', 'promotion-confirm', gold >= promotion.cost ? 'Quero me promover' : 'Ouro insuficiente');
    confirm.disabled = gold < promotion.cost;
    confirm.onclick = () => {
      send({ t: 'promote' });
      closeModal();
    };
    modal.append(confirm);
  });
}

/*
 * A faixa do Server Save: aparece, conta, e sai quando o servidor volta.
 *
 * O temporizador de seguranca existe porque o fim normal desta faixa e' o
 * processo MORRER — e se o reinicio nao vier (o dono desligou o server save no
 * meio da contagem, ou o servidor esta' fora do systemd e nao sai), ela ficaria
 * na tela para sempre anunciando um reinicio que nao vai acontecer.
 */
let serverSaveTimer = null;
function esconderServerSave() {
  clearTimeout(serverSaveTimer);
  const faixa = $('faixa-serversave');
  if (faixa) faixa.hidden = true;
  document.body.classList.remove('com-serversave');
}
function mostrarServerSave({ faltam, texto } = {}) {
  const faixa = $('faixa-serversave');
  if (!faixa) return;
  faixa.hidden = false;
  document.body.classList.add('com-serversave');
  $('faixa-serversave-conta').textContent =
    faltam > 0 ? (faltam === 1 ? 'em 1 minuto' : `em ${faltam} minutos`) : 'agora';
  $('faixa-serversave-texto').textContent = texto ?? '';
  // Pisca so' no ultimo minuto: piscar os quinze inteiros vira ruido.
  faixa.classList.toggle('urgente', !(faltam > 1));
  clearTimeout(serverSaveTimer);
  serverSaveTimer = setTimeout(esconderServerSave, faltam > 0 ? (faltam + 2) * 60_000 : 120_000);
}

/*
 * ---- O cartaz do boss ----
 *
 * O desenho vem do BESTIARIO, com a chave que o servidor mandou: o cliente ja'
 * tem o bestiario inteiro em `state.catalog.bestiary`, com o outfit e as cores
 * de cada bicho, entao a mensagem precisa carregar so' um nome de chave.
 *
 * A cor vem de la' pelo mesmo motivo do card de Aventuras (ver `figuraDoBoss`):
 * um humanoide sem a mascara de cores sai todo branco.
 */
function figuraDoBichoDoBestiario(key, tamanho) {
  const entry = state.catalog?.bestiary?.[key];
  if (!entry) return null;
  if (outfitInfo(entry.look)) return outfitCanvas(entry.look, entry.colors, tamanho, 2, true);
  if (entry.lookItem) return itemCanvas(entry.lookItem, tamanho);
  return null;
}

/*
 * Dez segundos de cartaz, e sai sozinho.
 *
 * Sao DOIS tempos, e nao um: aos dez segundos ele comeca a sumir, e so' depois
 * de a transicao acabar e' que o `hidden` volta. Esconder no mesmo instante
 * cortaria o desvanecer pela metade — o cartaz sumiria com um tranco, que e' o
 * contrario do que "bem bonito" pede.
 *
 * Os dois relogios sao limpos na entrada porque dois bosses podem nascer
 * colados (o dono soltando um na mao logo depois da agenda): sem isso, o
 * relogio do primeiro apagaria o cartaz do segundo no meio.
 */
/*
 * ---- Um MINUTO, e um X para quem nao quer esperar ----
 *
 * "em vez de ficar so 10 segundos deixa ele aparecer la durante 1 minuto a
 *  menos que a pessoa clique no x do card pra fechar".
 *
 * Dez segundos era pouco para o que o cartaz passou a carregar: com o botao de
 * loot nele, dez segundos nao dao tempo de olhar o que o boss solta. Um minuto
 * da', e o X e' a saida de quem ja' viu.
 */
const TEMPO_DO_CARTAZ_DE_BOSS = 60_000;
let cartazDoBossTimer = null;
let cartazDoBossSaida = null;
/* A chave do boss que esta' no cartaz agora: e' dela que sai a lista de loot. */
let bossDoCartaz = null;

function fecharCartazDoBoss(naHora = false) {
  const cartaz = $('cartaz-boss');
  if (!cartaz) return;
  clearTimeout(cartazDoBossTimer);
  clearTimeout(cartazDoBossSaida);
  esconderLootDoCartaz();
  const sumir = () => {
    cartaz.hidden = true;
    cartaz.classList.remove('saindo');
    $('cartaz-boss-arte').innerHTML = '';
    bossDoCartaz = null;
  };
  if (naHora) return sumir();
  cartaz.classList.add('saindo');
  cartazDoBossSaida = setTimeout(sumir, 700);
}

/*
 * ---- O loot, no passar do mouse ----
 *
 * "tem que ter um botao no card que se eu passar o mouse eu posso ver o loot".
 *
 * Sai do BESTIARIO, pelo `lootComGemas` — o mesmo ajudante das outras quatro
 * telas que respondem "o que cai deste bicho". Chamar a tabela crua aqui seria
 * a queixa das gemas de novo ("nao aparece na descricao dos drop dos bichos"),
 * so' que numa tela nova.
 */
function esconderLootDoCartaz() {
  const caixa = $('cartaz-boss-lootbox');
  if (caixa) { caixa.hidden = true; caixa.innerHTML = ''; }
  $('cartaz-boss-loot')?.classList.remove('aberto');
}

function mostrarLootDoCartaz() {
  const caixa = $('cartaz-boss-lootbox');
  const entry = bossDoCartaz ? state.catalog?.bestiary?.[bossDoCartaz] : null;
  if (!caixa || !entry) return;
  caixa.innerHTML = '';

  /*
   * O teto de 40 e' o mesmo da ficha do bestiary, e pelo mesmo motivo: trinta e
   * tres bichos deste jogo passam disso, e uma parede de itens num cartaz que
   * vive sobre o mapa deixa de ser uma espiada e vira uma janela.
   */
  const lista = lootComGemas({ ...entry, loot: (entry.loot ?? []).slice(0, 40), boss: true }, state.catalog);
  const grade = el('div', 'bag');
  let quantos = 0;
  for (const drop of lista) {
    if (!drop.id || !state.items[drop.id]) continue;
    const cela = el('div', 'cell');
    cela.append(itemCanvas(drop.id, 30));
    tipFor(cela, drop.id, `${(drop.chance * 100).toFixed(drop.chance < 0.01 ? 2 : 1)}% de chance`);
    grade.append(cela);
    quantos++;
  }
  caixa.append(el('b', null, quantos ? `O que ${entry.name} solta` : entry.name));
  caixa.append(quantos ? grade : el('p', 'empty', 'Este boss não tem tabela de loot.'));
  caixa.hidden = false;
  $('cartaz-boss-loot')?.classList.add('aberto');
}

function mostrarCartazDoBoss({ key, nome, texto } = {}) {
  const cartaz = $('cartaz-boss');
  if (!cartaz) return;
  /*
   * ---- Duas portas antes de ele aparecer ----
   *
   * "tem que ter a opcao na config de sempre ocultar o card de boss" — a
   * primeira, em Ajustes da tela, e' de quem nao quer o aviso nunca.
   *
   * "quando entrar na area de boss diario ele some tambem" — a segunda. Dentro
   * da area o aviso nao avisa nada: o boss esta' ali, com a vida na tela. O
   * cartaz so' seria um retangulo tapando justamente a luta.
   */
  if (!cartazDeBossLigado()) return;
  if (state.hunt?.arena) return;
  clearTimeout(cartazDoBossTimer);
  clearTimeout(cartazDoBossSaida);
  esconderLootDoCartaz();
  bossDoCartaz = key ?? null;

  const arte = $('cartaz-boss-arte');
  arte.innerHTML = '';
  const figura = figuraDoBichoDoBestiario(key, 44);
  /*
   * Bicho sem sprite (um `lookTypeEx` que o bestiario ainda nao conhece) deixa
   * a coluna do desenho ali, vazia: sem ela o nome escorrega para a esquerda e
   * o cartaz nasce torto justo na vez em que o dono esta' olhando.
   */
  arte.append(figura ?? el('span', 'hunt-bicho-vazio'));

  $('cartaz-boss-nome').textContent = nome ?? '';
  $('cartaz-boss-texto').textContent = texto ?? '';
  /* Sem bestiario daquele bicho nao ha' loot para mostrar, e o botao sai. */
  const botao = $('cartaz-boss-loot');
  if (botao) botao.hidden = !state.catalog?.bestiary?.[key];

  cartaz.hidden = false;
  cartaz.classList.remove('saindo');

  /*
   * ---- Ele nasce ABAIXO do que ja' estiver no alto, e colado ----
   *
   * Um `top` cravado estaria errado metade do tempo: o cartaz de beta e'
   * fechado, as novidades saem quando lidas, a faixa de auto boss liga e
   * desliga, a barra de vida do boss so' existe na luta e as barras da arena
   * so' existem dentro dela. A primeira versao nasceu debaixo do cartaz de beta
   * e so' aparecia uma tira dele.
   *
   * E' a mesma conta do `empilharNoTopo`, no hud.mjs, feita aqui porque ali ela
   * roda a cada quadro e este cartaz e' um so' — medir na hora em que ele
   * aparece e' o suficiente e nao custa nada.
   */
  let acima = 0;
  for (const id of ['cartaz-beta', 'faixa-novidades', 'faixa-autoboss', 'faixa-serversave', 'treino-faixa', 'barra-do-boss', 'barras-da-arena', 'barra-da-fase']) {
    const no = $(id);
    if (!no || no.hidden) continue;
    const r = no.getBoundingClientRect();
    if (r.height) acima = Math.max(acima, Math.round(r.bottom));
  }
  cartaz.style.top = acima ? `${acima + 8}px` : '';

  /* Reinicia a animacao de entrada quando o cartaz ja' estava na tela. */
  void cartaz.offsetWidth;

  cartazDoBossTimer = setTimeout(() => fecharCartazDoBoss(), TEMPO_DO_CARTAZ_DE_BOSS);
}

/*
 * Os tres gestos do cartaz, ligados uma vez so'.
 *
 * O `mouseenter` e' o que o dono pediu; o `click` existe para o celular, que
 * nao tem passar de mouse — e para quem quiser prender a lista para ler com
 * calma, porque no clique ela nao sai sozinha no `mouseleave`.
 */
{
  const botao = $('cartaz-boss-loot');
  const caixa = $('cartaz-boss-lootbox');
  let presa = false;
  botao?.addEventListener('mouseenter', () => mostrarLootDoCartaz());
  botao?.addEventListener('click', () => {
    presa = !presa;
    if (presa) mostrarLootDoCartaz();
    else esconderLootDoCartaz();
  });
  const sair = () => { if (!presa) esconderLootDoCartaz(); };
  botao?.addEventListener('mouseleave', sair);
  caixa?.addEventListener('mouseleave', sair);
  $('cartaz-boss-fecha')?.addEventListener('click', () => { presa = false; fecharCartazDoBoss(); });
}

function notice(text) {
  const node = $('notice');
  node.textContent = text;
  node.classList.add('show');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => node.classList.remove('show'), 3200);
}

let onModalClose = null;
// Qual botão da barra abriu o modal que está na tela, para ele ficar aceso.
let abertoPor = null;
// Botões que acendem ou apagam conforme o estado do jogo, como o da cidade.
const botoesCondicionais = [];
// Botões com ponto para gastar: acendem em dourado e pulsam.
const botoesEmAlerta = [];
let atualizarBotoes = () => {};

function marcarAbertos() {
  for (const button of document.querySelectorAll('#tools [data-tool], .gaveta-da-barra [data-tool]')) {
    button.setAttribute('aria-selected', String(button.dataset.tool === abertoPor));
  }
}

/*
 * ---- A porta NÃO acende pelo que está aberto lá dentro ----
 *
 * Havia aqui uma `acenderGrupos`: com a Mochila aberta, o botão Personagem
 * ficava verde. O dono cortou: "os ícones lá de cima, os principais, não
 * precisam mudar de cor pra verde quando eu seleciono algo do subícone".
 *
 * Ele tem razão, e o motivo é o que a cor significa na barra: verde é "isto
 * aqui está aberto", e a porta não abre nada — ela abre a gaveta. Com cinco
 * portas e seis janelas flutuantes que ficam abertas o tempo todo (mochila,
 * loot, chat), metade da fileira vivia acesa, e um destaque que está sempre
 * ligado deixa de destacar.
 *
 * O que continua acendendo é a porta com a GAVETA aberta — `com-gaveta-aberta`,
 * no CSS —, que dura o tempo do gesto e diz onde o mouse está.
 */

/**
 * Desenha um QR num canvas, do tamanho que couber.
 *
 * A zona de silêncio (as quatro casas de margem branca) não é enfeite: sem ela
 * o leitor não acha as bordas do quadrado, e a câmera fica procurando. É a
 * razão de o canvas ser maior que o desenho.
 */
function desenharQr(canvas, texto, lado = 260) {
  const qr = qrcode(texto, 'M');
  const QUIETO = 4;
  const total = qr.lado + QUIETO * 2;
  // Escala inteira: meio pixel num QR borra a borda do módulo e atrapalha a
  // leitura. Melhor um quadrado um pouco menor e nítido.
  const escala = Math.max(2, Math.floor(lado / total));
  canvas.width = canvas.height = total * escala;
  canvas.style.width = canvas.style.height = `${total * escala}px`;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  for (let y = 0; y < qr.lado; y++) {
    for (let x = 0; x < qr.lado; x++) {
      if (qr.modulos[y][x]) ctx.fillRect((x + QUIETO) * escala, (y + QUIETO) * escala, escala, escala);
    }
  }
  return qr;
}

/*
 * ---- A tela do pagamento ----
 *
 * Abrir outra aba funcionava e era ruim: quem joga no computador paga com o
 * CELULAR, e o link aberto no navegador do PC não ajuda em nada — ele teria de
 * copiar o endereço para o telefone de algum jeito.
 *
 * Com o QR na tela, ele aponta a câmera e paga. Os outros dois caminhos ficam
 * ali do lado para quem prefere: abrir aqui mesmo e copiar o endereço.
 *
 * O quadrado é desenhado no navegador, por código que mora neste projeto — nada
 * de serviço externo de imagem. O endereço de um pagamento não sai daqui para
 * um site de terceiro só para virar figurinha.
 */
function mostrarPagamento({ url, coins, pedido, metodo, centavos }) {
  const stripe = metodo === 'stripe';
  const pix = metodo !== 'cartao' && !stripe;
  const valor = Number.isFinite(centavos)
    ? (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '';

  const back = el('div', 'coins-back');
  const box = el('div', 'coins-box pagamento');
  const fechar = () => back.remove();

  const cabeca = el('div', 'coins-head');
  const titulo = el('div', 'coins-title');
  titulo.append(el('h3', null, 'Pague pelo celular'));
  cabeca.append(titulo);
  const x = el('button', 'coins-x', '×');
  x.onclick = fechar;
  cabeca.append(x);
  box.append(cabeca);

  const corpo = el('div', 'coins-body');
  box.append(corpo);

  corpo.append(el('p', 'donate-intro', `${(coins ?? 0).toLocaleString('pt-BR')} Draevor Coins${valor ? ` — ${valor}` : ''}`));

  /*
   * ---- Este código NÃO é um Pix, e a tela precisa dizer isso ----
   *
   * O dono apontou o app do banco para o quadrado e o banco recusou: "não é um
   * código Pix". Estava certo, e a tela é que estava errada em deixá-lo tentar.
   *
   * O que a InfinitePay entrega quando se cria uma cobrança é um ENDEREÇO da
   * página de pagamento — foi medido: o `/links` responde só `{ url }`, e mandar
   * `payment_method: "pix"` devolve um link que continua oferecendo as três
   * formas. Não existe, por essa porta, o "copia e cola" do Pix (o BR Code), que
   * é o único formato que o app do banco lê.
   *
   * Então o quadrado é o endereço, e serve para a CÂMERA: ela abre a página no
   * celular, e é lá dentro que o Pix de verdade aparece, com QR e copia e cola.
   * Dizer "aponte a câmera, não o banco" custa uma linha e evita a tentativa
   * frustrada que ele fez.
   */
  corpo.append(
    el(
      'p',
      'donate-passos',
      stripe
        ? 'Pagamento seguro pelo Stripe, com cartão internacional, Apple Pay ou Google Pay. O valor é cobrado em reais (BRL) e o seu banco converte na fatura. / Secure payment via Stripe — international card, Apple Pay or Google Pay. Charged in BRL; your bank converts it.'
        : pix
        ? 'Abra a câmera do celular (não o app do banco) e aponte para o código. A página abre no telefone — escolha Pix e o código de verdade aparece lá, com copia e cola.'
        : 'Abra a câmera do celular e aponte para o código. A página abre no telefone — escolha Crédito e informe os dados do cartão.'
    )
  );

  /*
   * O botao vem ANTES do quadrado.
   *
   * A maioria paga no mesmo aparelho em que joga; o codigo e' para o caso
   * minoritario de jogar no computador e pagar pelo celular. Estava na ordem
   * inversa, e o passo do meio virava o caminho principal.
   */
  const irAgora = el('button', 'primary', 'Ir para o pagamento');
  irAgora.style.width = '100%';
  irAgora.onclick = () => window.open(url, '_blank', 'noopener');
  corpo.append(irAgora);

  corpo.append(el('em', 'donate-nota', 'ou pague pelo celular apontando a câmera:'));

  const caixa = el('div', 'donate-qr');
  const canvas = document.createElement('canvas');
  caixa.append(canvas);
  corpo.append(caixa);
  try {
    desenharQr(canvas, url, 260);
  } catch (erro) {
    caixa.remove();
    corpo.append(el('p', 'donate-nota', `Não deu para desenhar o código (${erro.message}). Use os botões abaixo.`));
  }

  if (!stripe) corpo.append(el('em', 'donate-nota', 'É o endereço da página de pagamento, não um código Pix.'));

  const botoes = el('div', 'donate-botoes');

  const abrir = el('button', 'ghost', 'Abrir de novo');
  abrir.onclick = () => window.open(url, '_blank', 'noopener');

  const copiar = el('button', 'ghost', 'Copiar link');
  copiar.onclick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      copiar.textContent = 'copiado!';
      setTimeout(() => (copiar.textContent = 'Copiar link'), 1500);
    } catch {
      // Sem permissão de área de transferência (acontece fora de https): o
      // link vai para o chat, de onde dá para copiar à mão.
      logSystem(`Pagamento: ${url}`);
      notice('O link foi para o chat — copie de lá.');
    }
  };

  botoes.append(abrir, copiar);
  corpo.append(botoes);

  corpo.append(
    el(
      'small',
      'donate-rodape',
      'As Draevor Coins entram na sua conta sozinhas assim que o pagamento for confirmado — normalmente em segundos. Pode fechar esta janela e continuar jogando.'
    )
  );
  if (pedido) corpo.append(el('small', 'donate-rodape', `Pedido ${pedido}`));

  back.append(box);
  fecharAoClicarFora(back, fechar);
  document.body.append(back);
}

/*
 * ---- A resposta do dono chega como BALÃO, e não como janela ----
 *
 * "quando eu apertar em resolvido no reports tem que aparecer um balãozinho no
 * topo da tela do jogador pra ele ver, e ele pode fechar, ocultar, fazer o que
 * quiser. Mas não pode aparecer o modal na tela direto, senão ele pode estar
 * caçando e morrer."
 *
 * Ele está certo, e o defeito era meu: uma janela que abre sozinha no meio de
 * uma caçada rouba o teclado, cobre a barra de vida e faz a pessoa morrer
 * lendo um "obrigado por avisar". O momento de ler é escolha de quem lê.
 *
 * Então a notícia e o texto viraram duas coisas:
 *
 *   - o BALÃO avisa que chegou. Fica no alto, não engole clique nenhum do
 *     jogo, e sai com um × — ou fica ali a caçada inteira, se for o caso;
 *   - a JANELA só abre no "ler", que é um clique de quem parou para ler.
 *
 * ---- E fica também no chat ----
 *
 * O balão some quando fecha, e ninguém devolve: a fila do servidor foi
 * esvaziada na entrega (ver `entregarResposta`). Uma linha no chat é o
 * comprovante — quem fechou sem querer ainda acha o que foi dito.
 */
function avisarRespostaDeReport(respostas) {
  const lista = (respostas ?? []).filter((r) => r?.texto);
  if (!lista.length) return;

  const pilha = $('recados');
  for (const resposta of lista) {
    logAviso(`Draevor respondeu o seu report: ${resposta.texto}`);

    const balao = el('div', 'recado');
    const abrir = () => {
      balao.remove();
      abrirRespostaDeReport([resposta]);
    };

    const corpo = el('button', 'recado-corpo');
    corpo.type = 'button';
    corpo.append(
      el('span', 'recado-selo', 'Resposta'),
      /*
       * O texto entra APARADO na largura pelo CSS, e não cortado aqui com
       * reticências: o balão tem de caber numa tela de 1280 e numa de 2560, e
       * um corte contado em letras acerta uma e erra a outra.
       */
      el('span', 'recado-texto', resposta.texto),
      el('em', 'recado-ler', 'ler')
    );
    corpo.onclick = abrir;

    const fechar = el('button', 'recado-fecha', '×');
    fechar.type = 'button';
    fechar.title = 'fechar o aviso';
    fechar.setAttribute('aria-label', 'fechar o aviso');
    fechar.onclick = (evento) => {
      // Senão o clique no × subiria para o corpo e abriria a janela que ele
      // acabou de recusar.
      evento.stopPropagation();
      balao.remove();
    };

    balao.append(corpo, fechar);
    pilha.append(balao);
  }
}

/**
 * A janela da resposta do dono a um report — aberta pelo "ler" do balão.
 *
 * Uma janela e não uma linha no chat: a pessoa escreveu um texto e esperou dias
 * por uma resposta; entregá-la numa linha que sobe com o resto do chat é perder
 * de propósito o que ela veio ler. O que mudou foi QUANDO ela abre — ver
 * `avisarRespostaDeReport`, logo acima.
 */
function abrirRespostaDeReport(respostas) {

  const lista = (respostas ?? []).filter((r) => r?.texto);
  if (!lista.length) return;
  openModal(lista.length > 1 ? 'Respostas ao seu report' : 'Resposta ao seu report', (body) => {
    body.append(
      el('p', 'gate-note', lista.length > 1
        ? 'O Draevor respondeu aos reports que você mandou.'
        : 'O Draevor respondeu ao report que você mandou.')
    );
    for (const resposta of lista) {
      /*
       * O relato PRIMEIRO, a resposta depois.
       *
       * Quem escreveu esperou dias e quase sempre já não lembra qual report
       * era — "arrumado" sozinho não diz arrumado o quê. Com o próprio texto em
       * cima, a janela vira uma conversa em vez de um bilhete solto. O relato
       * fica em tom apagado, porque ele é o contexto e não a notícia.
       */
      if (resposta.relato) {
        const meu = el('div', 'report-meu');
        const quandoMandei = resposta.relatoEm ? new Date(resposta.relatoEm) : null;
        meu.append(
          el('b', null, resposta.tipo === 'melhoria' ? 'Você sugeriu' : 'Você reportou'),
          quandoMandei ? el('em', null, quandoMandei.toLocaleString('pt-BR')) : null,
          el('p', null, resposta.relato)
        );
        body.append(meu);
      }

      const caixa = el('div', 'report-resposta');
      const quando = resposta.em ? new Date(resposta.em) : null;
      caixa.append(
        el('b', null, resposta.autor || 'Draevor'),
        quando ? el('em', null, quando.toLocaleString('pt-BR')) : null,
        el('p', null, resposta.texto)
      );
      body.append(caixa);
    }
    const acoes = el('div', 'confirm-actions');
    const fechar = el('button', 'primary', 'Fechar');
    fechar.onclick = () => closeModal();
    acoes.append(fechar);
    body.append(acoes);
  });
}

function openModal(title, build, onClose, variant) {
  $('modal-title').textContent = title;
  const body = $('modal-body');
  body.innerHTML = '';
  // O canto de ações do cabeçalho é de quem está abrindo agora. Ver
  // `acoesDoModal`, logo abaixo.
  $('modal-acoes').innerHTML = '';
  /*
   * E o canto ESQUERDO junto. Ele é esvaziado aqui e não no `closeModal`
   * porque nem toda troca de janela passa por fechar: abrir a Arena por cima
   * do Depósito substitui o conteúdo sem fechar nada, e o selo da anterior
   * ficaria pendurado no cabeçalho da seguinte.
   */
  $('modal-selo').innerHTML = '';
  /*
   * Cada modal traz o seu proprio redesenho — ou nenhum.
   *
   * Todos os modais moram no MESMO `#modal-body`. O painel de prey guarda o
   * seu `redraw` em `panelCtx`, e ao abrir a busca de criatura por cima dele o
   * ponteiro continuava apontando para o painel antigo. Dentro da hunt o ouro,
   * o peso e a bolsa mudam a cada segundo, o `refreshOpenPanel` disparava, e a
   * tela de busca era substituida pela de prey no meio da digitacao. Fora da
   * hunt nada mudava, e por isso o defeito so' aparecia cacando.
   *
   * Zerando aqui, quem quiser acompanhar o estado registra de novo dentro do
   * proprio `build`; quem nao registrar fica quieto na tela, como a busca.
   */
  panelCtx.redraw = null;
  /*
   * ---- E o painel novo também escolhe QUANDO renascer ----
   *
   * Report do Garibas: "deixo na hunt, vou escolher perk da proficiência da
   * arma, fica difícil, pq a tela fica re-renderizando o tempo todo... está
   * enviando dados demais o tempo todo, ao invés de mandar apenas as
   * alterações".
   *
   * Ele tem razão, e a causa não era o que chega do servidor — era esta tela.
   * O `refreshOpenPanel` comparava UMA assinatura só, a mesma para todos os
   * painéis, e ela inclui ouro, peso, tamanho da mochila e experiência de
   * proficiência. Caçando, os quatro mudam várias vezes por segundo. Então
   * QUALQUER painel aberto era refeito do zero: medido, a Proficiência
   * renascia 0,40 vez por segundo, o Mercado 0,65 e a Árvore 0,50 — e cada
   * renascimento troca o `innerHTML` inteiro debaixo do dedo de quem está
   * escolhendo. Na cidade, onde nada disso muda, o mesmo painel ficava parado:
   * zero redesenhos.
   *
   * `redrawKey` é a resposta: o painel devolve uma string com o que ELE mostra,
   * e só renasce quando ela muda. Quem não registrar nenhuma continua com a
   * assinatura antiga — nenhum painel quebra por omissão.
   *
   * `aoVivo` é a outra metade: o que precisa acompanhar o quadro a quadro (a
   * barra de XP que sobe caçando) se atualiza NO LUGAR, sem refazer nada.
   */
  panelCtx.redrawKey = null;
  panelCtx.aoVivo = null;
  onModalClose = onClose ?? null;
  // Trocou de tela: os "detalhes" da anterior saem da pilha do voltar.
  fechouNaPilhaTudoQue('detalhe:');
  // A loja ganha a moldura dourada; o resto usa a padrão.
  document.querySelector('.modal-box').className = variant ? `modal-box ${variant}` : 'modal-box';
  /*
   * A variante tambem vai no FUNDO, e nao so' na caixa.
   *
   * E' o fundo que decide se o resto do jogo continua clicavel: `#modal` cobre
   * a tela inteira e engole todo o ponteiro. O deposito precisa do contrario —
   * arrastar da mochila para a caixa exige que a mochila continue viva atras.
   */
  $('modal').className = variant ? variant : '';
  build(body);
  // Onde esta caixa foi deixada da última vez — ver `recolocarModal`.
  recolocarModal(title);
  $('modal').hidden = false;
  // Com o modal por cima, o enfeite de trás pausa (ver 'PAUSA QUANDO NINGUÉM ESTÁ
  // OLHANDO', no style.css). Classe no body, e não `:has()`: medido, o `:has` no
  // body fazia CADA recálculo de estilo reavaliar a página inteira (24 ms -> 10 ms).
  document.body.classList.add('com-modal');
  // No telefone, o voltar fecha o modal em vez de sair do jogo (pilha.mjs).
  abrirNaPilha('modal', closeModal);
}

function closeModal() {
  // O modal leva junto os "detalhes" abertos dentro dele (lista-detalhe.mjs).
  fechouNaPilhaTudoQue('detalhe:', 'modal');
  $('modal').hidden = true;
  document.body.classList.remove('com-modal');
  panelCtx.redraw = null;
  abertoPor = null;
  marcarAbertos();
  onModalClose?.();
  onModalClose = null;
}


/*
 * ---- O modal SAI DO LUGAR quando o jogador quer ----
 *
 * A caixa é uma só (`.modal-box`), centrada por `place-items: center`, e ficava
 * pregada ali. Na maior parte das telas tanto faz — mas o depósito é uma tela
 * de ARRASTAR: pega-se da mochila e solta-se na caixa, e a mochila é uma janela
 * flutuante que o modal cobria. O report é literalmente isso: "a janela de
 * deposito fica fixa e eh dificil mover da bp para o dp".
 *
 * O empurrão é um `translate`, e não `left`/`top`: assim a centragem do CSS
 * continua sendo a origem, e uma janela de navegador redimensionada recentra a
 * caixa sozinha, levando o deslocamento junto.
 *
 * O deslocamento é lembrado POR TÍTULO. Guardar um só para todos faria a tela
 * seguinte nascer torta por causa de onde a anterior foi parar; guardar por
 * título faz o depósito voltar onde o jogador o deixou e o resto continuar no
 * meio. Dois cliques no cabeçalho devolvem a caixa ao centro.
 */
const CHAVE_DOS_MODAIS = 'draevor:modal-pos';

const posDosModais = (() => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_DOS_MODAIS) ?? '{}') ?? {};
  } catch {
    return {};
  }
})();

let modalArrastado = null;

/*
 * O deslocamento possível, para a caixa não poder ser jogada fora da tela.
 *
 * `ALCA` é a altura do cabeçalho, que mora ACIMA da caixa (`top: -34px`): sem
 * ela a alça do arrasto sairia por cima da borda e não haveria como puxar a
 * caixa de volta. `MARGEM` é o pedaço da caixa que continua aparecendo de cada
 * lado — o suficiente para se ver o que se está agarrando.
 */
function limitarModal(caixa, dx, dy) {
  const MARGEM = 140;
  const ALCA = 46;
  const esquerda = (window.innerWidth - caixa.offsetWidth) / 2;
  const topo = (window.innerHeight - caixa.offsetHeight) / 2;
  const entre = (valor, baixo, alto) => Math.min(Math.max(valor, baixo), Math.max(baixo, alto));
  return {
    dx: entre(dx, -esquerda - caixa.offsetWidth + MARGEM, window.innerWidth - esquerda - MARGEM),
    dy: entre(dy, ALCA - topo, window.innerHeight - topo - MARGEM),
  };
}

function porModalEm(dx, dy, lembrar = true) {
  const caixa = document.querySelector('.modal-box');
  if (!caixa) return;
  const posto = limitarModal(caixa, dx, dy);
  caixa.style.transform = posto.dx || posto.dy ? `translate(${posto.dx}px, ${posto.dy}px)` : '';
  if (!modalArrastado) return;
  if (lembrar) posDosModais[modalArrastado] = posto;
  else delete posDosModais[modalArrastado];
  try {
    localStorage.setItem(CHAVE_DOS_MODAIS, JSON.stringify(posDosModais));
  } catch {
    /* Navegador sem armazenamento: a caixa continua arrastável, só não lembra. */
  }
}

/** Põe a caixa onde este modal foi deixado da última vez — ou no meio. */
function recolocarModal(titulo) {
  modalArrastado = String(titulo ?? '');
  const guardado = posDosModais[modalArrastado];
  const caixa = document.querySelector('.modal-box');
  if (!caixa) return;
  caixa.style.transform = '';
  if (guardado) porModalEm(guardado.dx ?? 0, guardado.dy ?? 0);
}

function ligarArrastoDoModal() {
  const alca = document.querySelector('.modal-box > header');
  if (!alca) return;
  alca.addEventListener('pointerdown', (evento) => {
    // O X, os botões do canto de ações e os campos continuam sendo eles mesmos.
    if (evento.button !== 0 || evento.target.closest('button, input, select, textarea, label, a')) return;
    const caixa = document.querySelector('.modal-box');
    if (!caixa) return;
    // `transform: none` não é uma matriz — `new DOMMatrixReadOnly('none')`
    // estoura, e é o estado de toda caixa que ainda não foi arrastada.
    const desenhado = getComputedStyle(caixa).transform;
    const inicio = new DOMMatrixReadOnly(desenhado && desenhado !== 'none' ? desenhado : '');
    const x0 = evento.clientX;
    const y0 = evento.clientY;
    evento.preventDefault();
    alca.setPointerCapture(evento.pointerId);

    const mover = (mexeu) => porModalEm(inicio.m41 + mexeu.clientX - x0, inicio.m42 + mexeu.clientY - y0);
    const soltar = () => {
      alca.removeEventListener('pointermove', mover);
      alca.removeEventListener('pointerup', soltar);
      alca.removeEventListener('pointercancel', soltar);
    };
    alca.addEventListener('pointermove', mover);
    alca.addEventListener('pointerup', soltar);
    alca.addEventListener('pointercancel', soltar);
  });
  // Dois cliques no cabeçalho: de volta ao meio, e esquece onde estava.
  alca.addEventListener('dblclick', (evento) => {
    if (evento.target.closest('button, input, select, textarea, label, a')) return;
    porModalEm(0, 0, false);
  });
}

ligarArrastoDoModal();

$('modal-close').onclick = closeModal;
$('modal').addEventListener('click', (event) => {
  if (event.target === $('modal')) closeModal();
});

// ---------- personagem e outfit ----------

function openCharacter(aba = null) {
  panelCtx.tabs.character = aba ?? panelCtx.tabs.character ?? 'sheet';
  // O rascunho de aparência começa do zero a cada abertura da ficha.
  panelCtx.tabs.outfitDraft = null;
  send({ t: 'mounts' });

  openModal(state.character.name, (body) => {
    const draw = () => {
      body.innerHTML = '';
      const tabs = el('div', 'tabs');
      for (const [id, label] of Object.entries({ sheet: 'Personagem', look: 'Aparência' })) {
        const button = el('button', null, label);
        button.setAttribute('aria-selected', String(panelCtx.tabs.character === id));
        button.onclick = () => {
          panelCtx.tabs.character = id;
          draw();
        };
        tabs.append(button);
      }
      body.append(tabs);

      if (panelCtx.tabs.character === 'sheet') renderSheetInto(body, { state, send, closeModal });
      else renderAppearance(body);
    };
    panelCtx.redraw = draw;
    /*
     * ---- A Aparência não tem número que suba ----
     *
     * A aba Personagem mostra level, experiência, skills e peso: ela PRECISA
     * acompanhar o quadro a quadro, e por isso devolve `null` e continua com a
     * assinatura grande.
     *
     * A de Aparência mostra roupa, cores e montarias — nada disso muda caçando.
     * Mesmo assim ela renascia 0,50 vez por segundo junto com a outra, e cada
     * renascimento jogava de volta ao topo quem estava rolando a lista de
     * outfits para escolher um.
     */
    panelCtx.redrawKey = () => {
      /*
       * `!== 'sheet'` e não `=== 'look'`: a aba de aparência é aberta por dois
       * nomes — `look`, que é o id dos botões, e `aparencia`, que é como o
       * atalho da sonda e o menu a chamam. Comparando pelo nome certo, um dos
       * dois caminhos caía fora da regra sem ninguém notar.
       */
      if (panelCtx.tabs.character === 'sheet') return null;
      const c = state.character;
      return [
        'look',
        JSON.stringify(c?.outfit ?? null),
        JSON.stringify(c?.mount ?? null),
        (c?.outfitsOwned ?? []).length,
        (c?.mounts ?? []).length,
        JSON.stringify(panelCtx.tabs.outfitDraft ?? null),
      ].join('|');
    };
    draw();
  });
}

function showOfflineReport(report) {
  openModal('Enquanto você esteve fora', (body) => {
    /*
     * O treino não aparece mais aqui: ele tem tela própria (`treinoReport`),
     * montada contra o retrato de quando o treino começou. Este relatório é o
     * da CAÇADA, e misturar os dois dava duas janelas para o mesmo jogador.
     */
    const rows = el('div', 'rows');
    const add = (label, value) => {
      const row = el('div');
      row.append(el('span', null, label), el('b', null, value));
      rows.append(row);
    };

    /*
     * Relatório SEM caçada: só a stamina que voltou.
     *
     * Acontece com quem passou o tempo fora treinando offline ou parado. Antes
     * este caminho não existia porque todo relatório vinha de uma caçada, e
     * `report.exp.toLocaleString` derrubava a tela inteira num `undefined` —
     * uma janela em branco no lugar da primeira coisa que o jogador vê ao
     * entrar.
     */
    if (report.exp == null) {
      body.append(
        el('p', null, `Você esteve fora por ${formatTime((report.minutes ?? 0) * 60000)}.`),
      );
      if (report.stamina) add('Stamina recuperada', formatTime(report.stamina * 60000));
      body.append(rows);
      return;
    }

    if (report.died) {
      const onde = report.hunt ? ` em ${report.hunt}` : '';
      body.append(el('p', 'relatorio-motivo', `Seu personagem morreu caçando offline${onde} e voltou para a cidade.`));
    }
    body.append(el('p', null, `Seu personagem caçou por ${formatTime(report.minutes * 60000)}.`));
    add('Experiência', `+${report.exp.toLocaleString('pt-BR')}`);
    add('Níveis ganhos', report.levels);
    add('Monstros mortos', report.kills.toLocaleString('pt-BR'));
    add('Ouro', `+${report.gold.toLocaleString('pt-BR')}`);
    if (report.died) add('Aviso', 'você morreu durante a ausência');
    body.append(rows);
  });
}

/*
 * O extrato de itens do relatório: o que foi pego, vendido, ignorado e perdido.
 *
 * As quatro listas respondem a mesma pergunta por ângulos diferentes — "cadê o
 * loot?". O que o filtro recusou e o que não coube na capacidade são as duas
 * respostas que ninguém adivinha olhando só o total em gold, e são justamente
 * as que fazem o jogador achar que alguma coisa quebrou.
 */
function blocoDeItens(itens) {
  if (!itens) return null;

  const grupos = [
    ['loot', 'Coletado', 'o que entrou na bolsa'],
    ['vendido', 'Vendido', 'a venda automática pagou por isto'],
    /*
     * O que SAIU, ao lado do que entrou.
     *
     * O resumo trazia "Suprimentos: -240.000" e parava aí. Duzentos e quarenta
     * mil pode ser potion demais, flecha demais ou uma runa cara, e as três
     * pedem decisões diferentes — o extrato é que responde qual foi.
     */
    ['gastos', 'Gasto', 'munição, poções e runas que a caçada consumiu'],
    ['ignorado', 'Ignorado', 'o filtro de loot recusou, ou não valia o peso'],
    ['perdido', 'Ficou no chão', 'faltou capacidade para carregar'],
  ];

  const caixa = el('div', 'relatorio-itens');
  let algum = false;

  for (const [chave, titulo, dica] of grupos) {
    const lista = Object.entries(itens[chave] ?? {})
      // Três formatos: número solto (`loot`), `{ count, gold }` (`vendido`) e
      // `{ qtd, gold }` (`gastos`). Ver `quantidadeDe` em rotation.mjs.
      .map(([id, valor]) => ({
        id: Number(id),
        count: typeof valor === 'number' ? valor : valor?.count ?? valor?.qtd ?? 0,
        gold: valor?.gold ?? 0,
      }))
      .filter((entry) => entry.count > 0 && state.items[entry.id])
      .sort((a, b) => b.count - a.count);
    if (!lista.length) continue;

    algum = true;
    const bloco = el('div', 'relatorio-grupo');
    const cabeca = el('div', 'relatorio-cabeca');
    cabeca.append(el('b', null, titulo), el('span', null, `${lista.length} tipo(s)`));
    tipTexto(cabeca, dica);
    bloco.append(cabeca);

    const grade = el('div', 'filter-grid rolagem');
    for (const entry of lista) grade.append(itemCell(entry, 'relatorio'));
    bloco.append(grade);
    caixa.append(bloco);
  }

  return algum ? caixa : null;
}

/*
 * O corpo dos dois relatórios de caçada.
 *
 * "Caçada encerrada" e "Progresso enquanto você esteve fora" mostram a mesma
 * coisa — o que rendeu num pedaço de tempo — e só diferem no título e em parar
 * ou não a caçada. Uma função só evita que um ganhe uma linha e o outro não.
 */
function corpoDoRelatorio(body, report, comOk = true) {
  body.append(el('p', null, `${report.hunts.join(' → ')} — ${formatTime(report.minutos * 60000)}.`));

  const rows = el('div', 'rows');
  const add = (label, value, className) => {
    const row = el('div');
    row.append(el('span', null, label), el('b', className, value));
    rows.append(row);
  };
  const ouro = (value) => `${value < 0 ? '-' : '+'}${Math.abs(value).toLocaleString('pt-BR')} gold`;
  add('Experiência', `+${report.exp.toLocaleString('pt-BR')}`);
  add('Por hora', `${report.expHora.toLocaleString('pt-BR')} xp/h`);
  add('Níveis', report.levels ? `${report.levelStart} → ${report.levelNow}` : 'nenhum');
  add('Monstros mortos', report.kills.toLocaleString('pt-BR'));
  // Ouro das moedas + o loot COLETADO pelo preço do NPC (vendido ou não). Relatório de servidor antigo
  // (sem `valorDoLoot`) cai no que foi vendido, como antes.
  add('Ouro (moedas)', ouro(report.gold));
  add('Loot (preço do NPC)', ouro(report.valorDoLoot ?? report.lootValue));
  if (report.semPreco) add('Sem preço de NPC', `${report.semPreco.toLocaleString('pt-BR')} item(ns) — contam 0`);
  add('Suprimentos', ouro(-report.supplies));
  add('Lucro', ouro(report.lucro), report.lucro >= 0 ? 'good' : 'bad');
  add('Lucro por hora', ouro(report.lucroHora), report.lucroHora >= 0 ? 'good' : 'bad');
  body.append(rows);

  const itens = blocoDeItens(report.itens);
  if (itens) body.append(itens);

  /*
   * Um "OK" centrado no pé, que é o único caminho de saída que a tela oferece.
   *
   * Menos quando este corpo é usado DENTRO de outra caixa — a de morte —, que
   * já tem o próprio botão de sair. Dois "OK" na mesma janela, um fechando o
   * modal que não existe, seria um botão morto.
   */
  if (!comOk) return;
  const acoes = el('div', 'relatorio-ok');
  const ok = el('button', 'primary', 'OK');
  ok.onclick = () => closeModal();
  acoes.append(ok);
  body.append(acoes);
}

/**
 * O resumo da caçada ao parar: vale para a hunt única e para o ciclo, e soma
 * tudo que a corrida rendeu — inclusive as hunts anteriores do ciclo, que já
 * tinham fechado a própria sessão.
 */
/*
 * O resumo do fim da caçada.
 *
 * `motivo` só vem quando quem encerrou não foi você — o líder parou e o grupo
 * inteiro voltou. Sem essa linha, o convidado via o mapa sumir e o extrato
 * aparecer sem nenhuma explicação de por quê.
 */
/*
 * ---- O que o treino rendeu ----
 *
 * Uma tela separada do extrato da caçada, de propósito. O extrato fala de
 * experiência, loot, ouro e mortes, e no pátio nada disso acontece: mostrá-lo
 * ali seria seis linhas zeradas em volta da única que interessa.
 *
 * A linha é "de quanto para quanto, COM A PORCENTAGEM". Meia hora de treino
 * quase nunca fecha um nível inteiro, e uma tela que só mostrasse níveis diria
 * "nada subiu" depois de trinta minutos batendo — o que é falso e faz o
 * jogador achar que o treino está quebrado. Com a fração, o avanço aparece
 * sempre: "axe 42 (10%) -> 42 (63%), +0,53".
 */
/**
 * As linhas de "o que subiu", numa lista só.
 *
 * Duas telas mostram isto — o fim do treino no boneco e o resumo de quem voltou
 * depois de treinar offline —, e são a mesma informação. Duplicar a montagem
 * garantiria que uma das duas ficasse para trás no dia em que a outra mudasse.
 */
function linhasDoGanho(body, ganho) {
  const lista = el('div', 'treino-ganho');
  for (const linha of ganho) {
    const nome = linha.skill === 'magic' ? 'magic level' : linha.skill;
    const item = el('div', 'treino-linha');
    /*
     * ---- A unidade acompanha o tamanho do ganho ----
     *
     * Três degraus, e cada um existe porque o de cima chega a zero:
     *
     *   fechou nível        "+2 níveis"     — o que a pessoa quer ouvir
     *   não fechou          "+0,8%"         — do próximo nível
     *   nem 0,05% de avanço "+40 pontos"    — a contagem crua de treino
     *
     * O terceiro degrau é o que faltava. Numa perícia alta, dez minutos valem
     * alguns centésimos de por cento: a linha saía "+0,0%" e a tela inteira lia
     * como quebrada. Ponto de treino é um número interno, e por isso ele é o
     * ÚLTIMO recurso — mas dizer "+40 pontos" é verdade, e "+0,0%" não era.
     */
    const pontos = linha.paraPercent - linha.dePercent;
    const avanco =
      linha.niveis > 0
        ? `+${linha.niveis} ${linha.niveis === 1 ? 'nível' : 'níveis'}`
        : pontos >= 0.05
          ? `+${pontos.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
          : (() => {
              const n = Math.max(1, Math.round(linha.golpes ?? 0));
              return `+${n.toLocaleString('pt-BR')} ${n === 1 ? 'ponto' : 'pontos'}`;
            })();
    item.append(
      artOrUiIcon(`sk-${linha.skill}`, nome),
      el('b', null, nome),
      el(
        'span',
        'de-para',
        `${linha.de} (${linha.dePercent.toFixed(1)}%) → ${linha.para} (${linha.paraPercent.toFixed(1)}%)`,
      ),
      el('em', null, avanco),
    );
    lista.append(item);
  }
  body.append(lista);
}

/*
 * ---- O que o treino rendeu ----
 *
 * Uma tela separada do extrato da caçada, de propósito. O extrato fala de
 * experiência, loot, ouro e mortes, e no pátio nada disso acontece: mostrá-lo
 * ali seria seis linhas zeradas em volta da única que interessa.
 */
function mostrarGanhoDoTreino(ganho, contexto = null) {
  openModal(contexto?.offline ? 'Treino offline encerrado' : 'Treino encerrado', (body) => {
    /*
     * Quanto tempo, antes do quanto subiu. "+0,8% de machado" sozinho não diz
     * se o treino é bom ou ruim; "em 40 minutos, +0,8%" diz.
     */
    if (contexto?.segundos != null) {
      body.append(
        el('p', 'relatorio-motivo', `Você treinou por ${formatTime(contexto.segundos * 1000)}.`),
      );
    }
    if (!ganho?.length) body.append(el('p', 'empty', 'Nada mudou — foi pouco tempo.'));
    else linhasDoGanho(body, ganho);
    /*
     * ---- O que o treino CUSTOU ----
     *
     * A metade que faltava. O que subiu já estava aqui; o que foi gasto, não —
     * e no exercise o que se gasta é uma arma comprada com coins. Sem esta
     * lista, o jogador via a perícia andar e não fazia ideia de quanto da arma
     * tinha ido embora, nem de qual arma, se trocou no meio.
     */
    if (contexto?.gastos?.length) {
      body.append(el('h4', 'treino-gastos-titulo', 'Cargas gastas'));
      const lista = el('div', 'treino-gastos');
      for (const linha of contexto.gastos) {
        const item = el('div', 'treino-gasto');
        const arte = itemCanvas(linha.itemId, 28);
        if (arte) item.append(arte);
        item.append(el('b', null, linha.name));
        item.append(el('em', null, `${linha.cargas.toLocaleString('pt-BR')} cargas`));
        lista.append(item);
      }
      body.append(lista);
    }
    const acoes = el('div', 'relatorio-ok');
    const ok = el('button', 'primary', 'OK');
    ok.onclick = () => closeModal();
    acoes.append(ok);
    body.append(acoes);
  });
}

// `titulo`: o extrato de OUTRO char da conta (o ➜ Hunt da troca de personagem encerrou a caçada dele).
function showRunReport(report, motivo = null, titulo = null) {
  if (!report) return;
  openModal(titulo ?? (report.mode === 'cycle' ? 'Ciclo encerrado' : 'Caçada encerrada'), (body) => {
    if (motivo) body.append(el('p', 'relatorio-motivo', motivo));
    corpoDoRelatorio(body, report);
  });
}

/*
 * O extrato que ficou esperando por este personagem.
 *
 * Ele chega no `welcome` quando a caçada acabou sem ninguém olhando — morte de
 * madrugada, limite de capacidade batido, ou a conta tendo entrado noutro
 * personagem. O motivo vem escrito porque, sem ele, o jogador só encontra o
 * boneco parado no templo e nenhuma explicação.
 *
 * Sem extrato (a caçada não chegou a render nada) a caixa é só o motivo: ainda
 * assim é preciso dizer por que ele não está mais onde estava.
 */
function showPendente({ report, motivo }, depois = null) {
  const titulo = /morreu/i.test(motivo ?? '') ? 'Seu personagem morreu' : 'Enquanto você esteve fora';
  if (!report) {
    if (!motivo) return void depois?.();
    openModal(titulo, (body) => {
      body.append(el('p', 'relatorio-motivo', motivo));
      const acoes = el('div', 'relatorio-ok');
      const ok = el('button', 'primary', 'OK');
      ok.onclick = () => closeModal();
      acoes.append(ok);
      body.append(acoes);
    }, depois);
    return;
  }
  openModal(titulo, (body) => {
    if (motivo) body.append(el('p', 'relatorio-motivo', motivo));
    corpoDoRelatorio(body, report);
  }, depois);
}

/*
 * O mesmo resumo, com a caçada ainda de pé.
 *
 * Chega ao reabrir a aba quando o personagem continuou caçando sozinho. Não
 * para nada e não pergunta nada: é só a conta do que aconteceu enquanto a aba
 * esteve fechada, que sem isto era um salto silencioso nos números.
 */
function showAndamento(report) {
  if (!report) return;
  openModal(
    'Progresso enquanto você esteve fora',
    (body) => {
      // "A stamina acabou..." e afins: antes só quem abria pelo `runReport` lia o motivo.
      if (report.motivo) body.append(el('p', 'relatorio-motivo', report.motivo));
      corpoDoRelatorio(body, report);
    },
    // O servidor guarda o relatório até o OK: reconectar antes dele mostra de novo.
    () => send({ t: 'ackAusencia' })
  );
}

/*
 * O botão do rodapé tem três caras, e cada uma é o próximo passo daquele momento.
 *
 * Fora da caçada ele é **Hunts** e abre a escolha: um "Sair da hunt" apagado
 * ali era um botão morto ocupando o lugar mais visível da tela, e começar a
 * caçar exigia achar o ícone lá em cima. Dentro de uma hunt ele é **Sair da
 * hunt**; num ciclo, **Parar ciclo**.
 */
function renderRunControls() {
  const button = $('leave-hunt');
  const run = state.run;
  const cacando = !!state.hunt;
  const ciclo = cacando && run?.mode === 'cycle';

  button.classList.toggle('cycle', ciclo);
  /*
   * E o CORPO diz se ha' cacada em curso.
   *
   * O celular esconde o botao quando ele e' "Hunts" e o mostra quando ele e'
   * "Stop" (ver style.css), e uma regra de CSS nao consegue ler o texto de um
   * botao. Uma classe no `body` e' o unico jeito de o layout saber disso.
   */
  document.body.classList.toggle('em-caca', cacando);
  // "Stop", nos dois casos de estar caçando: é a mesma ação, e cabe na placa sem
  // encolher a fonte. Que é ciclo, quem conta é o pulsar da placa e o tooltip.
  button.textContent = cacando ? 'Stop' : 'Hunts';

  if (!cacando) {
    tipTexto(button, 'Escolhe onde caçar: uma hunt só ou um ciclo entre várias.');
    return;
  }

  if (!ciclo) {
    tipTexto(button, 'Volta para a cidade e mostra o resumo da caçada.');
    return;
  }

  /*
   * No ciclo, a troca é pelo fim do percurso — não pelo relógio.
   *
   * O tooltip mostrava só "troca de hunt em 09:12", e com isso o botão inteiro
   * parecia um cronômetro de quinze minutos. O tempo continua no fim da lista,
   * porque ele ainda é o teto e ainda é quem manda nas hunts de mapa gerado,
   * que não têm percurso para terminar.
   */
  const linhas = [
    // Por faixa, o cabeçalho diz a regra: a roda não é uma lista escolhida a
    // dedo, ela cresce sozinha conforme o personagem sobe de level.
    run.faixa ? `Ciclo por level ${run.faixa.min} a ${run.faixa.max}:` : 'Ciclo de hunt ativo:',
    ...run.hunts.map((name, index) => `${index === run.atual ? '▸' : ' '} ${name}`),
  ];
  // O instante vem do servidor e a conta é daqui. Ver `contarOsPrazos`.
  const trocaEm = Math.max(0, (run.trocaAte ?? 0) - Date.now());
  if (run.temRota) {
    linhas.push(
      `troca ao chegar no fim do percurso — waypoint ${run.passo + 1} de ${run.passos}`,
      `(ou em ${formatTime(trocaEm)}, o que vier antes)`
    );
  } else {
    linhas.push('esta hunt não tem percurso: a troca é pelo relógio', `troca em ${formatTime(trocaEm)}`);
  }
  linhas.push('clique para parar o ciclo e voltar para a cidade');
  tipTexto(button, linhas.join('\n'));
}

// ---------- controles ----------

/*
 * ---- O menu dos seletores da barra (15/09) ----
 *
 * O dono: "deixa esse modalzinho mais bonito". A lista que abria era a do
 * NAVEGADOR (a de todo `<select>`), branca e sem cara de jogo. No computador,
 * onde os seletores são ícone + palavra curta + setinha, o clique abre um menu
 * nosso por cima da barra. O `<select>` continua sendo a fonte: as opções, a
 * explicação (`title`) e as desligadas saem dele, e escolher dispara o mesmo
 * `change`. Ver `CONTROLES_DA_BARRA`.
 */
const barraCompacta = () => window.matchMedia('(min-width: 901px)').matches;

function abrirMenuDoSeletor(controle, ancora) {
  document.querySelector('.alvo-menu')?.remove();
  const seletor = $(controle.id);
  /*
   * ---- Uma lista simples, ONDE se clicou (15/09) ----
   *
   * O dono: "deixa quase igual o que era, e pra abrir onde é clicado, e não
   * acima". A primeira versão tinha título, etiqueta e explicação por opção, e
   * abria em cima da barra inteira. Agora é a lista do navegador com a cara do
   * jogo: um nome por linha, o escolhido aceso, a explicação no balão do mouse,
   * colada na caixa clicada — embaixo dela, ou em cima quando embaixo não cabe
   * (a barra mora no rodapé).
   */
  const menu = document.createElement('div');
  menu.className = 'alvo-menu';
  menu.dataset.para = controle.id;
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', controle.titulo);
  let escolhido = null;
  for (const opcao of seletor.options) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.setAttribute('role', 'option');
    const ativo = opcao.value === seletor.value;
    if (ativo) escolhido = botao;
    botao.classList.toggle('ativo', ativo);
    botao.setAttribute('aria-selected', String(ativo));
    botao.disabled = opcao.disabled;
    // Sem balão nas opções: ele cobria as de baixo. A explicação mora no balão do controle.
    botao.textContent = opcao.textContent;
    botao.onclick = () => {
      fechar();
      if (seletor.value === opcao.value) return;
      seletor.value = opcao.value;
      seletor.dispatchEvent(new Event('change'));
    };
    menu.append(botao);
  }
  document.body.append(menu);
  const caixa = seletor.getBoundingClientRect();
  menu.style.minWidth = `${Math.round(Math.max(caixa.width, 110))}px`;
  const meu = menu.getBoundingClientRect();
  const cabeEmbaixo = caixa.bottom + 2 + meu.height <= window.innerHeight - 6;
  const topo = cabeEmbaixo ? caixa.bottom + 2 : caixa.top - 2 - meu.height;
  menu.style.left = `${Math.round(Math.max(6, Math.min(window.innerWidth - meu.width - 6, caixa.left)))}px`;
  menu.style.top = `${Math.round(Math.max(6, topo))}px`;
  escolhido?.scrollIntoView({ block: 'nearest' });
  /*
   * O balão do mouse sai do caminho enquanto a lista está aberta: "só não pode
   * ficar na frente das seleções". Tira o texto dos DOIS rótulos que o mouse
   * pode estar tocando (o do Lurar cobre o Voltar) e esconde o que já estava
   * aberto — o `scroll` é o gatilho de esconder do tooltip.mjs.
   */
  const comBalao = [...new Set([seletor, seletor.closest('label')].filter(Boolean))];
  const baloes = comBalao.map((e) => e.dataset.tipTexto);
  for (const e of comBalao) {
    e.dataset.menuAberto = '1';
    delete e.dataset.tipTexto;
    e.removeAttribute('title');
  }
  window.dispatchEvent(new Event('scroll'));
  function fechar(event) {
    if (event?.type === 'keydown' && event.key !== 'Escape') return;
    if (event?.type === 'pointerdown' && (menu.contains(event.target) || ancora.contains(event.target))) return;
    menu.remove();
    comBalao.forEach((e, i) => {
      delete e.dataset.menuAberto;
      if (baloes[i]) e.dataset.tipTexto = baloes[i];
    });
    document.removeEventListener('pointerdown', fechar, true);
    document.removeEventListener('keydown', fechar, true);
  }
  setTimeout(() => {
    document.addEventListener('pointerdown', fechar, true);
    document.addEventListener('keydown', fechar, true);
  }, 0);
}

{
  /*
   * De quem é o clique. O Alvo e a Distância têm um rótulo cada; o Lurar e o
   * Voltar dividem o mesmo, e aí a coluna decide: o ícone de volta (`#lure-sep`),
   * a palavra curta e a setinha do Voltar abrem o menu do Voltar.
   */
  const controleDoClique = (alvo) => {
    const marcado = alvo.closest('[data-para]')?.dataset.para ?? alvo.closest('select')?.id;
    if (alvo.closest('#lure-sep')) return 'lure-volta';
    if (marcado && CONTROLES_DA_BARRA.some((c) => c.id === marcado)) return marcado;
    const rotulo = alvo.closest('label');
    return CONTROLES_DA_BARRA.find((c) => rotulo?.contains($(c.id)))?.id ?? null;
  };
  for (const controle of CONTROLES_DA_BARRA) {
    // `mousedown` é onde o navegador abre a lista dele: é ali que se barra.
    $(controle.id)?.addEventListener('mousedown', (event) => {
      if (barraCompacta()) event.preventDefault();
    });
  }
  for (const rotulo of new Set(CONTROLES_DA_BARRA.map((c) => $(c.id)?.closest('label')).filter(Boolean))) {
    rotulo.addEventListener('click', (event) => {
      if (!barraCompacta()) return;
      event.preventDefault();
      const id = controleDoClique(event.target);
      const controle = CONTROLES_DA_BARRA.find((c) => c.id === id);
      if (!controle || $(controle.id).hidden) return;
      const aberto = document.querySelector('.alvo-menu');
      if (aberto) {
        aberto.remove();
        rotulo.querySelectorAll('[data-menu-aberto]').forEach((e) => delete e.dataset.menuAberto);
        delete rotulo.dataset.menuAberto;
        if (aberto.dataset.para === id) return;
      }
      abrirMenuDoSeletor(controle, rotulo);
    });
  }
}

// A palavra curta muda na hora, sem esperar o estado voltar. Ver `titulosDosControles`.
$('strategy').onchange = (event) => {
  send({ t: 'strategy', value: event.target.value });
  titulosDosControles();
};
$('distance').onchange = (event) => {
  send({ t: 'distance', value: event.target.value });
  titulosDosControles();
};
$('lure').onchange = (event) => {
  send({ t: 'lure', value: event.target.value });
  titulosDosControles();
};
// O segundo seletor manda só o `volta`: os dois campos viajam separados para um
// não apagar a escolha do outro. Ver o comando `lure`, no servidor.
$('lure-volta').onchange = (event) => {
  send({ t: 'lure', volta: event.target.value });
  titulosDosControles();
};
// Fora da caçada ele abre a escolha de hunts; dentro, ele sai.
$('leave-hunt').onclick = () => (state.hunt ? send({ t: 'stopHunt' }) : openHunts());

setInterval(() => state.hunt && renderAnalyzer(), 1000);
