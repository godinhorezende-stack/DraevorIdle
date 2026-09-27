/*
 * ---- GRÁFICOS: uma chave para cada coisa que pesa na tela ----
 *
 * A primeira versão disto era um botão só, "modo lite", e ele cortava quadros:
 * o mapa passava a desenhar 20 vezes por segundo em vez de 60. O dono viu e
 * disse o que queria de verdade:
 *
 *   "o modo lite não era pro jogo ficar sem fps, era pra tirar os efeitos das
 *    magias, efeitos dos ícones e etc, sabe, pra ficar liso pra quem tem pc
 *    ruim — ou faz uma aba em opções de gráficos que aí a pessoa vai tirando o
 *    que quer"
 *
 * Ele está certo, e a diferença entre as duas coisas é grande. Cortar quadros
 * deixa o jogo mais BARATO e mais TRAVADO ao mesmo tempo — o boneco anda aos
 * pulos, e num idle em que se fica olhando o boneco isso é exatamente a
 * sensação de PC ruim que o modo existia para tirar. Tirar efeito é o
 * contrário: o que sobra roda liso, porque é menos trabalho para o mesmo
 * número de quadros.
 *
 * Por isso o teto de quadros continua existindo, mas como uma chave à parte que
 * nasce SEM LIMITE e que ninguém precisa tocar. Ele não entra no "deixar leve".
 *
 * ---- Por que uma chave por coisa, e não três níveis ----
 *
 * "aí a pessoa vai tirando o que quer". Um nível baixo/médio/alto decide pela
 * pessoa o que ela abre mão, e as trocas aqui não vêm no mesmo pacote: quem
 * joga em notebook fraco quer os números de dano (é como se lê a caçada) e não
 * liga para o halo dourado; quem joga com a aba no canto quer o contrário.
 *
 * O botão "Deixar leve" continua existindo por cima das chaves, porque a maior
 * parte das pessoas quer resolver e não escolher. Ele apaga as quatro chaves de
 * ENFEITE e não encosta nas outras — nem nos números, nem no ritmo, nem nos
 * quadros.
 *
 * ---- A regra que mantém isto legível ----
 *
 * Ficha ACESA quer dizer "o jogo está inteiro", apagada quer dizer "tirei isto".
 * Vale para todas, inclusive a do ritmo — que por isso se chama "Atualizações
 * completas" e não "Menos atualizações". Sem essa regra, uma fileira de fichas
 * em que uma acesa deixa o jogo mais leve e outra mais pesado não se lê.
 *
 * ---- Por que a escolha mora no NAVEGADOR ----
 *
 * `localStorage`, e não no personagem. A queixa é da máquina — "meu pc", "minha
 * internet" —, e a mesma pessoa entra do PC bom em casa e do notebook fraco
 * fora dela. Guardada no personagem, apagar os efeitos no notebook deixaria o
 * PC de casa sem efeito nenhum, e sem ninguém entender por quê.
 */

const CHAVE = 'draevor:graficos';

/*
 * ---- As chaves ----
 *
 * `leve` marca as que o botão "Deixar leve" apaga. São as quatro de enfeite:
 * o que sai delas é o brilho da coisa, e nunca uma informação.
 *
 * `numeros` e `ritmo` estão de fora do preset de propósito. O número de dano é
 * COMO SE LÊ a caçada — quem tira, tira sabendo; e o ritmo mexe na fluidez do
 * passo, que é o que o dono acabou de dizer que não quer perder sem pedir.
 */
export const GRAFICOS = [
  {
    id: 'efeitos',
    nome: 'Efeitos de magia',
    leve: true,
    dica:
      'A explosão, o raio, a faísca do golpe. É o que mais aparece numa caçada movimentada — ' +
      'uma dezena de desenhos por segundo, cada um com quadros próprios.',
  },
  {
    id: 'projeteis',
    nome: 'Projéteis',
    leve: true,
    dica: 'A flecha, a pedra e a runa voando até o alvo. O dano continua saindo igual.',
  },
  {
    id: 'brilhos',
    nome: 'Brilhos e halos',
    leve: true,
    dica:
      'O halo em volta dos nomes no mapa, as sombras dos painéis e o desfoque atrás das janelas. ' +
      'Desfoque é o item mais caro da interface inteira para a placa de vídeo.',
  },
  {
    id: 'animacoes',
    nome: 'Animações da interface',
    leve: true,
    dica:
      'Ícones que pulsam, molduras que giram, botões que acendem. São dezenas de animações ' +
      'rodando em cima do jogo, e várias delas nunca param.',
  },
  {
    id: 'numeros',
    nome: 'Números de dano',
    leve: false,
    dica:
      'Os números que sobem do boneco, o "+xp" e o "bloqueou". Fora do botão de propósito: ' +
      'é por eles que se lê a caçada.',
  },
  {
    id: 'ritmo',
    nome: 'Atualizações completas',
    leve: false,
    dica:
      'Apagada, o servidor manda metade dos retratos (um a cada 250ms em vez de 125). ' +
      'Gasta metade da internet; em troca o passo do boneco fica um pouco menos liso. ' +
      'Aviso, morte e venda continuam chegando na hora.',
  },
];

/*
 * ---- O teto de desenho do mapa ----
 *
 * "e pq não tem a opção de 144 fps?"
 *
 * Porque ela já era o padrão, e eu tinha escrito o nome errado. O mapa é
 * pintado em `requestAnimationFrame`, que dispara no ritmo do MONITOR: num
 * monitor de 144Hz o laço roda 144 vezes por segundo, e o que a lista chamava
 * de "60 fps" era na verdade "sem limite nenhum" — o valor 60 só desligava a
 * conta.
 *
 * O nome mentia para todo mundo com monitor rápido, então virou `0`, que é
 * "sem limite" e é o que sempre foi. E os degraus abaixo dele passaram a ir até
 * 144, porque num monitor de 240Hz travar em 144 é uma escolha legítima.
 *
 * ---- O que um teto pode e o que não pode ----
 *
 * Ele só SEGURA quadros; não inventa nenhum. Nenhum valor daqui faz o jogo
 * passar do que o monitor entrega — pedir 144 num monitor de 60Hz continua
 * dando 60, e não há software que mude isso.
 *
 * E o que sai é quantizado pelo monitor: só dá para dividir o ritmo dele por um
 * número inteiro. Num monitor de 144Hz, "60" cai no degrau de 72 (144÷2), que é
 * o mais perto que existe. Por isso a dica na tela fala em "até".
 */
export const TETOS = [0, 144, 60, 30, 20];

/** O nome de cada degrau na tela. `0` não é um número de quadros. */
export const rotuloDoTeto = (teto) => (teto ? `até ${teto}` : 'Sem limite');

/*
 * ---- O contador do canto ----
 *
 * "faz uma opção pra ativar de mostrar o fps e ping no cantinho superior
 *  esquerdo, e escolhe se quer que mostra fps+ping"
 *
 * Duas chaves independentes, e não um interruptor de três posições: as quatro
 * combinações saem sozinhas de duas fichas, e quem quer só o ping (a queixa é
 * de internet) não é quem quer só o fps (a queixa é do PC).
 *
 * Elas moram nesta lista à parte, e não em `GRAFICOS`, porque a regra das duas
 * é o CONTRÁRIO: uma chave de gráficos nasce acesa e apagá-la tira coisa da
 * tela; estas nascem apagadas e acendê-las PÕE coisa. Misturadas na mesma
 * fileira, "ficha acesa é o jogo inteiro" deixaria de valer — e é essa regra
 * que faz a fileira toda ser legível sem ler.
 */
export const MEDIDORES = [
  {
    id: 'fps',
    nome: 'FPS',
    dica:
      'Quantos quadros o mapa desenhou no último meio segundo. É o número que diz se o problema ' +
      'é a sua máquina — e o que mostra o efeito de apagar as chaves acima.',
  },
  {
    id: 'ping',
    nome: 'Ping e travada',
    /*
     * ---- A dica mudou porque a antiga estava errada ----
     *
     * Ela dizia "diz se a demora e' da sua internet e nao do jogo", e isso nao
     * era verdade: o ping e' medido DENTRO da pagina, entao uma aba travada
     * entra no numero com nome de internet. Medido em 21/09 — 44ms de ping com
     * a rede em 0,3ms, so' porque a tela estava saturada.
     *
     * Por isso agora sao dois numeros, e a dica ensina a LER os dois juntos: e'
     * a comparacao que responde, nenhum deles sozinho.
     */
    dica:
      'Dois números. O ping é a ida e volta até o servidor; a travada é o maior tempo que a sua ' +
      'aba passou sem conseguir atender nada, no último segundo. Leia os dois juntos: ping alto ' +
      'com travada alta é o seu computador desenhando, ping alto com travada baixa é a sua ' +
      'internet. Só sai mensagem enquanto esta ficha está acesa.',
  },
];

const PADRAO = { quadros: 0 };
for (const chave of GRAFICOS) PADRAO[chave.id] = true;
// O contador nasce APAGADO: ele é uma ferramenta de quem foi procurar um
// problema, e não parte do jogo.
for (const chave of MEDIDORES) PADRAO[chave.id] = false;

/*
 * `try` nos dois lados: navegador em janela anônima, com armazenamento
 * bloqueado, ESTOURA no acesso — não devolve vazio. Sem isto o jogo não abriria
 * para quem joga anônimo, e por causa de uma preferência de tela.
 */
/*
 * ---- A versão do que está guardado, e por que ela existe ----
 *
 * "eu acho que tá sempre limitando 60 fps mesmo que eu coloque 144 ou sem
 *  limite, confere aí"
 *
 * Estava mesmo, e a culpa é da troca de significado. Na primeira versão o teto
 * era `[60, 30, 20]` e o `60` QUERIA DIZER "sem limite" — era o valor que
 * desligava a conta. Quem mexeu em qualquer ficha naquele dia ficou com
 * `quadros: 60` gravado no navegador.
 *
 * Aí o `60` virou um teto de verdade. O mesmo número guardado passou a dizer o
 * contrário do que dizia, e o jogo travava em 60 exatamente para quem já tinha
 * usado a tela — sem erro nenhum, e sem jeito de a pessoa desconfiar.
 *
 * A versão conserta isso de uma vez: sem `v`, o `60` guardado é lido como o
 * "sem limite" que ele significava. Um `60` escolhido de hoje em diante sai com
 * `v: 2` e é respeitado como teto.
 */
const VERSAO = 2;

/*
 * ---- No CELULAR o jogo nasce leve ----
 *
 * "tão reclamando que no mobile está muito lagado, muito travado."
 *
 * Medido num telefone simulado (412x915, dpr 3, CPU 4x mais lenta) com o
 * personagem PARADO na cidade: vinte e quatro animações de CSS rodando o tempo
 * todo, e a thread principal ocupada em mais de 90% antes de o jogo acontecer.
 * Elas animam sombra, filtro e posição de fundo — as três coisas que obrigam o
 * navegador a repintar o elemento a cada quadro.
 *
 * Num PC isso é de graça e fica bonito. Num telefone comum é a diferença entre
 * andar e não andar, e quem está no telefone não vai procurar a tela de
 * ajustes para descobrir isso.
 *
 * ---- Nasce, e não FICA ----
 *
 * Só vale para quem nunca escolheu nada (`!cru`). Quem já mexeu nas chaves
 * mantém o que escolheu, no telefone e no PC — a preferência é dele. E quem
 * quiser o jogo inteiro no celular acende as chaves em Ajustes → Gráficos, ou
 * desliga o "Deixar leve" de uma vez.
 *
 * As chaves acesas continuam sendo as que NÃO são enfeite: o número de dano e o
 * ritmo ficam ligados, porque tirá-los é perder informação e fluidez — ver a
 * nota do `leve`, lá em cima.
 */
/*
 * A MESMA pergunta que o `mobile.mjs` faz (`ehCelular`), e pela mesma fonte: a
 * variável `--e-celular`, que o CSS acende na largura em que a interface troca
 * de forma. Importá-la de lá era o certo, mas `mobile.mjs` mexe no documento ao
 * ser carregado e este módulo precisa continuar sendo importável por um teste
 * de linha de comando (ver a nota do `aplicarNoBody`) — por isso a pergunta é
 * refeita aqui, em três linhas, com o `try` que devolve "não é celular" fora do
 * navegador.
 */
function noCelular() {
  try {
    return globalThis.getComputedStyle(globalThis.document.documentElement)
      .getPropertyValue('--e-celular').trim() === '1';
  } catch {
    return false;
  }
}

/*
 * Quem pediu ao SISTEMA menos movimento (Windows: "Mostrar animações" apagado;
 * celular: "reduzir movimento") já disse o que quer — o jogo nasce leve para
 * essa pessoa também, pelo mesmo caminho do celular.
 */
function pediuMenosMovimento() {
  try {
    return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function padraoDaMaquina() {
  const padrao = { ...PADRAO };
  if (!noCelular() && !pediuMenosMovimento()) return padrao;
  for (const chave of GRAFICOS) if (chave.leve) padrao[chave.id] = false;
  return padrao;
}

function lerDoNavegador() {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return padraoDaMaquina();
    const lido = JSON.parse(cru);
    const escolha = padraoDaMaquina();
    for (const chave of [...GRAFICOS, ...MEDIDORES]) {
      if (typeof lido[chave.id] === 'boolean') escolha[chave.id] = lido[chave.id];
    }
    const antigo = lido.v !== VERSAO;
    const quadros = antigo && lido.quadros === 60 ? 0 : lido.quadros;
    if (TETOS.includes(quadros)) escolha.quadros = quadros;
    return escolha;
  } catch {
    return padraoDaMaquina();
  }
}

let escolhas = lerDoNavegador();

function guardar() {
  try {
    // `v` é o que separa um `60` escolhido hoje (um teto) do `60` que a versão
    // antiga gravava quando a pessoa queria "sem limite". Ver `lerDoNavegador`.
    localStorage.setItem(CHAVE, JSON.stringify({ ...escolhas, v: VERSAO }));
  } catch {
    /* sem armazenamento: vale para esta sessão, e é melhor do que não valer */
  }
}

/** Esta chave está acesa? Chave desconhecida conta como acesa. */
export const graficoLigado = (id) => escolhas[id] !== false;

/*
 * O contador tem o teste ao contrário do resto, e é de propósito: `=== true` e
 * não `!== false`. Uma chave de gráficos desconhecida tem de contar como ACESA
 * (o jogo inteiro é o padrão), e um medidor desconhecido tem de contar como
 * APAGADO — senão um `localStorage` de uma versão futura ligaria o contador na
 * tela de quem nunca o pediu.
 */
export const medidorLigado = (id) => escolhas[id] === true;

/** Liga ou apaga um número do contador do canto. */
export function trocarMedidor(id, quer) {
  escolhas[id] = !!quer;
  guardar();
  return escolhas[id];
}

/** Quantas vezes por segundo o mapa pode ser pintado. `0` é sem limite. */
export const tetoDeQuadros = () => escolhas.quadros ?? 0;

/** O servidor deve mandar em ritmo econômico? É o `{t:'lite'}` de sempre. */
export const ritmoLeve = () => !graficoLigado('ritmo');

/**
 * Liga ou apaga uma chave, guarda e pinta o `body`.
 *
 * `avisar` só é usado pela chave do ritmo — é quem manda a mensagem, e vem de
 * fora para este arquivo não precisar conhecer o socket.
 */
export function trocarGrafico(id, quer, avisar) {
  escolhas[id] = !!quer;
  guardar();
  aplicarNoBody();
  if (id === 'ritmo') avisar?.(ritmoLeve());
  return escolhas[id];
}

/** Troca o teto de desenho do mapa. */
export function trocarTeto(quadros) {
  escolhas.quadros = TETOS.includes(quadros) ? quadros : 0;
  guardar();
  return escolhas.quadros;
}

/** Todas as chaves de enfeite estão apagadas? É o estado do botão. */
export const noModoLeve = () => GRAFICOS.filter((c) => c.leve).every((c) => !graficoLigado(c.id));

/**
 * O botão "Deixar leve": apaga (ou reacende) as quatro chaves de enfeite de uma
 * vez, sem encostar nas outras. Ver o cabeçalho.
 */
export function deixarLeve(quer) {
  for (const chave of GRAFICOS) {
    if (chave.leve) escolhas[chave.id] = !quer;
  }
  guardar();
  aplicarNoBody();
  return noModoLeve();
}

/** Alguém já mexeu nas chaves neste navegador? (Anônimo sem armazenamento conta como sim.) */
function jaEscolheu() {
  try {
    return !!localStorage.getItem(CHAVE);
  } catch {
    return true;
  }
}

/*
 * ---- O jogo percebe sozinho que está pesado ----
 *
 * "quero otimizar isso deixando liso para o jogador"
 *
 * O "Deixar leve" existe desde o "modo lite", mas mora em Opções → Gráficos, e
 * quem sofre com o travamento não vai procurar lá. Então o jogo mede: depois
 * de entrar (5s para o mapa assentar), conta os quadros que o navegador
 * consegue entregar por 8s. Abaixo de 40 por segundo, a máquina não dá conta
 * do enfeite, e as quatro chaves de enfeite apagam — com um aviso dizendo
 * onde desfazer.
 *
 * Só para quem nunca escolheu nada, como o celular: quem já mexeu nas chaves
 * tem a palavra final. E roda uma vez só — ao apagar, a escolha fica guardada,
 * então a próxima entrada já nasce leve e não mede de novo. A contagem pausa
 * com a aba escondida (o navegador nem desenha), para não confundir aba no
 * fundo com máquina fraca. O que se mede é o `requestAnimationFrame`, que é o
 * ritmo que o navegador consegue de fato — e não o teto de desenho do mapa.
 */
export const FPS_PARA_DEIXAR_LEVE = 40;

export function vigiarLentidao(aoDeixarLeve) {
  if (jaEscolheu() || noModoLeve() || !globalThis.requestAnimationFrame) return;
  let inicio = 0;
  let quadros = 0;
  const passo = (agora) => {
    if (globalThis.document?.hidden) {
      inicio = 0;
      quadros = 0;
      return void requestAnimationFrame(passo);
    }
    if (!inicio) inicio = agora;
    quadros += 1;
    const passou = agora - inicio;
    if (passou < 8000) return void requestAnimationFrame(passo);
    const fps = (quadros * 1000) / passou;
    if (fps < FPS_PARA_DEIXAR_LEVE && !jaEscolheu()) {
      deixarLeve(true);
      /*
       * E o mapa passa a ter teto de 30 quadros.
       *
       * Caçando, o personagem anda o percurso sem parar e a câmera vai junto:
       * todo quadro tem de ser desenhado, e o custo do mapa é proporcional a
       * quantos quadros por segundo ele desenha (medido: pular quadro não
       * ajuda andando). Numa máquina que não passou de 40, desenhar 30 com
       * folga é melhor do que tentar 60 e entregar 25 aos trancos. Só baixa:
       * quem já tinha escolhido 20 continua em 20.
       */
      if (!tetoDeQuadros() || tetoDeQuadros() > 30) trocarTeto(30);
      aoDeixarLeve?.(Math.round(fps));
    }
  };
  setTimeout(() => requestAnimationFrame(passo), 5000);
}

/**
 * Marca no `body` o que a folha de estilo precisa saber.
 *
 * As duas chaves de interface são apagadas por CSS, e não por JavaScript: elas
 * valem para dezenas de animações e centenas de sombras espalhadas por dez mil
 * linhas de folha, e nenhuma tela precisa ser reescrita para obedecê-las. Uma
 * tela nova nasce obedecendo sem que ninguém se lembre disto.
 */
export function aplicarNoBody() {
  /*
   * `globalThis.document?.` e não `document.`: fora do navegador o nome não
   * existe e o acesso ESTOURA — não devolve `undefined`. É o que deixa este
   * módulo ser importado por um teste de linha de comando, que é onde a regra
   * do preset e a leitura do armazenamento são conferidas de verdade.
   */
  const corpo = globalThis.document?.body;
  if (!corpo) return;
  corpo.classList.toggle('sem-animacao', !graficoLigado('animacoes'));
  corpo.classList.toggle('sem-brilho', !graficoLigado('brilhos'));
}

/**
 * Diz ao servidor em que ritmo esta conexão quer o estado.
 *
 * Mandado a CADA conexão, e não só quando a pessoa mexe na chave: o servidor
 * guarda a marca no socket, e um socket novo (uma reconexão, um F5) nasce sem
 * ela. Sem este aviso a escolha valeria até a primeira queda de rede.
 */
export const avisarORitmo = (enviar) => enviar({ t: 'lite', on: ritmoLeve() });
