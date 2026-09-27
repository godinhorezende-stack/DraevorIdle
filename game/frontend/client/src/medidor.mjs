/*
 * ---- O CONTADOR DE FPS E PING, no canto ----
 *
 * "faz uma opção pra ativar de mostrar o fps e ping no cantinho superior
 *  esquerdo ao ser ativado, e escolhe se quer que mostra fps+ping"
 *
 * Duas chaves independentes, e não um interruptor com três posições: quem quer
 * só o ping (a queixa é de internet) e quem quer só o fps (a queixa é do PC)
 * são pessoas diferentes, e as quatro combinações saem sozinhas de duas fichas.
 *
 * ---- O que cada número mede de verdade ----
 *
 * FPS: os quadros que o mapa REALMENTE desenhou, contados depois do teto de
 * `graficos.mjs`. Contá-los antes mostraria o ritmo do monitor com um nome
 * errado — e quem põe um teto de 30 quer justamente ver 30 ali.
 *
 * PING: a ida e volta de uma mensagem própria (`{t:'ping'}` → `{t:'pong'}`), e
 * não o intervalo entre os quadros de estado. São coisas diferentes: o estado
 * chega a cada 125ms porque o servidor manda de 125 em 125ms, e isso continuaria
 * marcando 125 numa conexão perfeita e numa péssima.
 *
 * O `ping` do protocolo do WebSocket, que o servidor já manda de trinta em
 * trinta segundos para achar aba morta, não serve: o navegador responde a ele
 * sozinho, na camada de baixo, e não deixa o JavaScript ver nem a ida nem a
 * volta.
 *
 * ---- E por que ele NÃO manda nada quando está desligado ----
 *
 * A banda deste jogo acabou de cair dez vezes por causa de três reports de
 * "puxando muita internet". Um medidor que pingasse o tempo todo para quem
 * nunca o ligou devolveria uma parte disso de graça. O relógio só existe
 * enquanto a ficha do ping está acesa — ver `religarOPing`.
 */
import { medidorLigado } from './graficos.mjs';

/** De quanto em quanto tempo o número na tela é reescrito. */
const RITMO_DA_PINTURA = 500;

/**
 * De quanto em quanto tempo sai um ping.
 *
 * Dois segundos: perto o bastante para o número acompanhar uma oscilação de
 * rede, e raro o bastante para ser irrelevante ao lado dos oito quadros de
 * estado por segundo que já trafegam.
 */
const RITMO_DO_PING = 1000;

/*
 * ---- A PULSACAO, que mede a travada da propria aba ----
 *
 * O ping sozinho mentia por omissao. Ele e' `performance.now()` na ida menos
 * `performance.now()` na volta, os DOIS tomados aqui dentro — entao tudo que
 * segurar a thread principal entra na conta e sai com nome de internet. Medido
 * em 21/09: com a thread saturada a 22 fps, o contador marcou 44ms enquanto a
 * rede de verdade estava em 0,3ms. O jogador le "minha internet esta ruim" e
 * troca de provedor por um problema de desenho.
 *
 * Esta batida e' o segundo numero. Um `setInterval` curto que so' anota QUANDO
 * conseguiu rodar: se ele pediu 8ms e voltou 110ms depois, a aba ficou 110ms
 * sem atender ninguem — e o pong daquele instante esperou junto.
 *
 * ---- Por que a PIOR da janela, e nao a media ----
 *
 * Porque e' a pior que o pong paga. A mensagem chega do sistema operacional
 * como uma tarefa, e tarefa so' roda quando a atual termina: com o laco do mapa
 * gastando um quadro inteiro, o pong espera o quadro INTEIRO, e nao metade
 * dele. Foi exatamente isso que a medida mostrou — 44ms de contador para 40ms
 * de quadro.
 *
 * ---- E por que NAO se subtrai um do outro ----
 *
 * Seria comodo mostrar "rede = ping - travada" e dar um numero limpo. Mas as
 * duas medidas vem de relogios diferentes e a subtracao erra para os dois
 * lados; um "rede" negativo, ou bom demais, seria pior do que nao ter numero.
 * Os dois sao mostrados crus, e a leitura e' simples:
 *
 *   ping alto e tela ALTA  -> e' o seu computador desenhando
 *   ping alto e tela BAIXA -> e' o fio ate' o servidor
 */
const RITMO_DA_PULSACAO = 8;

/*
 * A janela em que a pior travada e' procurada. Um segundo acompanha o olho: e'
 * curto o bastante para o numero reagir quando a pessoa entra numa rua cheia, e
 * longo o bastante para nao piscar a cada quadro.
 */
const JANELA_DA_TRAVADA = 1000;

let caixa = null;
let enviar = null;
let relogioDoPing = null;
let relogioDaPintura = null;
let primeiroPing = null;

let quadros = 0;
let desdeQuando = 0;
let fps = 0;
let ping = null;
/*
 * O último ping que saiu e ainda não voltou. Ele existe para o número não
 * congelar numa queda: sem isto, uma conexão que parou de responder continuaria
 * mostrando os 40ms do último pong que chegou, para sempre.
 */
let pingEnviadoEm = 0;

/* A pulsacao: quando ela bateu pela ultima vez, e as paradas recentes. */
let relogioDaPulsacao = null;
let ultimaPulsacao = 0;
let paradas = [];

/** Um quadro foi desenhado. Chamado pelo laço do mapa, depois do teto. */
export function contarQuadro() {
  quadros += 1;
}

/*
 * ---- O ritmo do MONITOR, que é outra coisa ----
 *
 * "eu acho que tá sempre limitando 60 fps mesmo que eu coloque 144 ou sem
 *  limite, confere aí"
 *
 * Depois de tirar o teto que estava travado por engano (ver `lerDoNavegador`,
 * em `graficos.mjs`), sobra uma pergunta que o jogo não sabia responder: o
 * número é 60 porque alguém limitou, ou porque o monitor entrega 60?
 *
 * Quem responde é isto. `requestAnimationFrame` dispara uma vez por atualização
 * de tela, então o intervalo entre duas passadas do laço É o ritmo do monitor —
 * medido ANTES de qualquer descarte, senão passaria a medir o próprio teto.
 *
 * A tela de ajustes mostra o número na ficha "Sem limite", e com isso "o jogo
 * está me limitando" vira uma coisa que se lê em vez de se desconfiar.
 */
let intervalo = 0;
let ultimaPassada = 0;

export function marcarPassadaDoMonitor(agora) {
  const desde = agora - (ultimaPassada || agora);
  ultimaPassada = agora;
  if (desde <= 0) return;
  /*
   * `Math.min` corta o salto de uma aba que voltou do segundo plano: ali o
   * navegador congela o laço e o primeiro intervalo vem em segundos, o que
   * puxaria a média para baixo por vários segundos depois.
   */
  const amostra = Math.min(desde, 100);
  intervalo = intervalo ? intervalo * 0.9 + amostra * 0.1 : amostra;
}

/** Quanto tempo o monitor leva entre um quadro e outro, em ms. */
export const intervaloDoMonitor = () => intervalo || 16.7;

/** E o mesmo número em quadros por segundo. `0` enquanto ninguém mediu. */
export const quadrosDoMonitor = () => (intervalo ? Math.round(1000 / intervalo) : 0);

/** O `pong` voltou. `at` é o carimbo que foi na ida. */
export function pongChegou(at) {
  if (typeof at !== 'number') return;
  ping = Math.max(0, Math.round(performance.now() - at));
  pingEnviadoEm = 0;
}

function mandarPing() {
  /*
   * Um ping por vez. Se o anterior não voltou, o número passa a mostrar quanto
   * tempo faz que ele saiu — é o que transforma "42ms" congelado em um número
   * que sobe e diz "a conexão travou".
   */
  if (pingEnviadoEm) {
    ping = Math.round(performance.now() - pingEnviadoEm);
    return;
  }
  pingEnviadoEm = performance.now();
  enviar?.({ t: 'ping', at: pingEnviadoEm });
}

/*
 * A batida. Ela nao faz nada alem de anotar que conseguiu rodar — e e' isso que
 * a torna uma medida: o que interessa e' o atraso, nao o trabalho.
 */
function pulsar() {
  const agora = performance.now();
  const desde = agora - (ultimaPulsacao || agora);
  ultimaPulsacao = agora;
  /*
   * So' o que passou do combinado e' travada. Os 8ms pedidos nao sao atraso, e
   * o navegador ainda arredonda o temporizador para cima por conta propria.
   */
  const parada = desde - RITMO_DA_PULSACAO;
  if (parada > 1) paradas.push({ em: agora, ms: parada });
}

/** A pior travada da ultima janela, em ms. */
function travadaDaAba() {
  const corte = performance.now() - JANELA_DA_TRAVADA;
  /*
   * A poda e' aqui, e nao no `pulsar`: assim a lista encolhe quando alguem
   * pergunta, e o caminho quente (a batida, 125 vezes por segundo) nao varre
   * array nenhum.
   */
  if (paradas.length) paradas = paradas.filter((p) => p.em >= corte);
  let pior = 0;
  for (const p of paradas) if (p.ms > pior) pior = p.ms;
  return Math.round(pior);
}

/** A faixa em que o número cai, para a cor. */
const faixaDoPing = (ms) => (ms < 90 ? 'bom' : ms < 200 ? 'medio' : 'ruim');
const faixaDoFps = (n) => (n >= 50 ? 'bom' : n >= 25 ? 'medio' : 'ruim');
/*
 * A travada e' julgada mais duro que o ping de proposito: 16ms e' um quadro a
 * 60fps, entao passar disso ja' e' um quadro perdido, e 50ms e' a fronteira do
 * que o olho le como "engasgou".
 */
const faixaDaTravada = (ms) => (ms < 16 ? 'bom' : ms < 50 ? 'medio' : 'ruim');

function pintar() {
  if (!caixa) return;
  const agora = performance.now();
  const passou = agora - desdeQuando;
  if (passou > 0) {
    fps = Math.round((quadros * 1000) / passou);
    quadros = 0;
    desdeQuando = agora;
  }

  caixa.textContent = '';
  if (medidorLigado('fps')) {
    const parte = document.createElement('b');
    parte.className = `medidor-valor ${faixaDoFps(fps)}`;
    parte.textContent = `${fps} fps`;
    caixa.append(parte);
  }
  if (medidorLigado('ping')) {
    const parte = document.createElement('b');
    /*
     * `—` até o primeiro pong voltar. Um "0 ms" na abertura seria uma medição
     * boa demais que ninguém fez.
     */
    parte.className = `medidor-valor ${ping == null ? '' : faixaDoPing(ping)}`;
    parte.textContent = ping == null ? '— ms' : `${ping} ms`;
    caixa.append(parte);

    /*
     * ---- O segundo numero: quanto do ping e' a SUA tela ----
     *
     * Ele nasceu de uma medida: o ping marcava 130ms e a rede custava 21ms. Os
     * outros 109 eram a aba travada, e nao havia como saber disso olhando.
     */
    const trava = document.createElement('b');
    const travada = travadaDaAba();
    trava.className = `medidor-valor ${faixaDaTravada(travada)}`;
    /*
     * ---- O rotulo vem ANTES do numero, e nao depois ----
     *
     * O ping continua sendo so' `130 ms`, sem rotulo, porque e' o que ele
     * sempre foi e ha' ferramenta que o procura por esse formato. Se a travada
     * tambem terminasse em "ms", os dois ficariam indistinguiveis um ao lado do
     * outro — e um contador que precisa de legenda nao e' um contador.
     *
     * O nome e' o MESMO da ficha em Graficos ("Ping e travada"). Um numero que
     * se chama de um jeito na tela e de outro nos ajustes custa uma pergunta.
     *
     * E ele e' a PIOR travada da janela, nao uma fatia do ping: os dois nao
     * somam, e nao deviam. A travada responde "o quanto o jogo congelou", que
     * e' a queixa de verdade; o ping responde "quanto demorou a ida e volta".
     *
     * Nada de `title` aqui: o `#medidor` e' `pointer-events: none` (ele flutua
     * sobre os botoes do card do personagem), entao balao nenhum abre. A
     * explicacao mora na dica da ficha, em Graficos, que e' onde se pode ler.
     */
    trava.textContent = `travada ${travada} ms`;
    caixa.append(trava);
  }
}

/**
 * Liga ou desliga o relógio do ping conforme a ficha.
 *
 * Chamado tanto ao trocar a opção quanto ao (re)conectar: um socket novo é
 * outro caminho até o servidor, e o número tem de voltar a andar sozinho.
 */
function religarOPing() {
  clearInterval(relogioDoPing);
  clearTimeout(primeiroPing);
  clearInterval(relogioDaPulsacao);
  relogioDoPing = null;
  primeiroPing = null;
  relogioDaPulsacao = null;
  if (!medidorLigado('ping')) {
    ping = null;
    pingEnviadoEm = 0;
    /* A lista some junto: numero velho de uma ficha apagada nao volta a tela. */
    paradas = [];
    ultimaPulsacao = 0;
    return;
  }
  pingEnviadoEm = 0;

  /*
   * A pulsacao anda com o ping, e nao com a ficha do fps: ela existe para
   * explicar o ping, e ligar um temporizador de 8ms para quem so' quis ver
   * quadros seria cobrar de quem nao pediu.
   */
  paradas = [];
  ultimaPulsacao = performance.now();
  relogioDaPulsacao = setInterval(pulsar, RITMO_DA_PULSACAO);

  /*
   * ---- O primeiro ping sai um TIQUE depois, e nunca na mesma pilha ----
   *
   * Ele existe para o número não ficar dois segundos parado em "— ms". Mas
   * mandá-lo aqui dentro, na mesma pilha de quem chamou, é uma armadilha: quem
   * chama na abertura é o `main.mjs`, no meio do próprio corpo do módulo, e o
   * `send` dele é um `const` declarado mais abaixo. Ler um `const` antes da
   * declaração ESTOURA (zona morta temporal), e num módulo o estouro derruba o
   * resto — o jogo inteiro ficava na tela de carregamento.
   *
   * Já quebrou assim uma vez. Passar `(m) => send(m)` em vez de `send` não
   * bastou: a seta adia a leitura, e esta chamada acontecia na mesma hora.
   *
   * O `setTimeout` de zero resolve de verdade porque o corpo do módulo termina
   * antes de qualquer tarefa agendada rodar — e resolve para todo mundo que
   * chamar isto no futuro, sem depender de ninguém lembrar da ordem.
   */
  primeiroPing = setTimeout(mandarPing, 0);
  relogioDoPing = setInterval(mandarPing, RITMO_DO_PING);
}

/**
 * Põe o contador na tela, ou tira. Chamado na abertura e a cada troca de ficha.
 *
 * `enviarMensagem` vem de fora — é o `send` do `main.mjs`. Este arquivo não
 * conhece o socket, do mesmo jeito que `graficos.mjs` não conhece.
 */
export function atualizarMedidor(enviarMensagem) {
  if (enviarMensagem) enviar = enviarMensagem;
  const quer = medidorLigado('fps') || medidorLigado('ping');

  /*
   * A marca no `body` é o que faz o card do personagem descer a altura do
   * contador, em vez de ficar embaixo dele. Ver `#medidor` na folha de estilo.
   */
  document.body?.classList.toggle('com-medidor', quer);

  if (!quer) {
    caixa?.remove();
    caixa = null;
    clearInterval(relogioDaPintura);
    relogioDaPintura = null;
    religarOPing();
    return;
  }

  if (!caixa) {
    caixa = document.createElement('div');
    caixa.id = 'medidor';
    document.body.append(caixa);
    quadros = 0;
    desdeQuando = performance.now();
  }
  if (!relogioDaPintura) relogioDaPintura = setInterval(pintar, RITMO_DA_PINTURA);
  religarOPing();
  pintar();
}
