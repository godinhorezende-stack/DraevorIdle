/* =========================================================================
 * O BRASAO DA GUILDA — o catalogo, os precos e as regras
 *
 * "eu queria que o brasao das guilds seja mais customizado por quem esta
 *  criando (...) alguns efeitos de cor no brasao quero que seja exclusivo por
 *  ravox coins (...) e depois de ja criada a guilda, se a pessoa quiser mudar o
 *  brasao, seja 50 ravox coins."
 *
 * ---- POR QUE ESTE ARQUIVO E' COMPARTILHADO ----
 *
 * Os dois lados precisam da MESMA lista, por motivos diferentes: o servidor
 * para dizer se a escolha existe e quanto ela custa, o cliente para desenhar a
 * prateleira e a previa. Duas listas seriam duas listas que um dia discordam —
 * e a forma dessa discordancia e' a pior possivel: uma cor que aparece na tela,
 * o jogador escolhe, paga, e o servidor recusa por nao conhecer.
 *
 * Entao o CSS de cada cor mora aqui junto com o preco dela. O servidor ignora o
 * CSS, o cliente ignora o preco, e nenhum dos dois pode ficar para tras.
 *
 * ---- O BRASAO SAO SEIS ESCOLHAS ----
 *
 *   forma       o contorno do escudo      pode ser nenhuma
 *   simbolo     o objeto no meio          pode ser nenhum
 *   simboloTam  o tamanho dele            60 a 140, em % do que cabe
 *   simboloX    o quanto anda de lado     -35 a 35, em % do escudo
 *   simboloY    o quanto anda pra cima    -35 a 35, em % do escudo
 *   halo        o brilho do efeito pago   liga/desliga, desligado de fabrica
 *   cor         a pintura do escudo       obrigatorio, tem um padrao
 *   corSimbolo  a pintura do objeto       obrigatorio, tem um padrao
 *   corLetras   a tinta das iniciais      obrigatorio, tem um padrao
 *   letras      as iniciais               liga/desliga
 *   texto       quais letras              ate' tres; vazio = as do nome
 *   letrasTam   o tamanho delas           60 a 140, em % do que cabe
 *   letrasX     o quanto andam de lado    -35 a 35, em % do escudo
 *   letrasY     o quanto andam pra cima   -35 a 35, em % do escudo
 *   ordem       o objeto na frente/atras  'frente' ou 'atras'
 *
 * ---- POR QUE O SIMBOLO TEM COR PROPRIA ----
 *
 * "tem que ser possivel mudar a cor dos brasoes e objetos de dentro tambem."
 *
 * Com uma cor so', o simbolo era sempre creme, e duas guildas que escolhessem o
 * mesmo escudo azul com o mesmo leao ficavam identicas. Com duas, o mesmo par
 * forma+simbolo da dezoito por dezoito combinacoes — e' o que faz o brasao ser
 * DELA e nao de uma lista.
 *
 * O padrao do simbolo nao e' uma cor da paleta: e' o creme de antes, e ele mora
 * em `TINTA_PADRAO_DO_SIMBOLO`. Uma cor da paleta como padrao daria simbolo
 * azul em escudo azul, que some.
 *
 * ---- POR QUE A ORDEM ----
 *
 * "tem que ter opcao de escolher a sequencia: brasao na frente ou atras,
 *  objetos na frente ou atras."
 *
 * 'frente' e' o simbolo DENTRO do escudo, recortado por ele — a heraldica
 * normal. 'atras' e' o simbolo MAIOR que o escudo, aparecendo por tras dele
 * pelas beiradas — que e' o desenho classico das espadas cruzadas atras do
 * brasao, e muda completamente o que a mesma dupla de pecas parece.
 * ========================================================================= */

/* =========================================================================
 * AS FORMAS
 *
 * `base` e' o escudo que ja existia (`guilda-brasao-base.webp`) e continua
 * sendo o padrao: toda guilda fundada antes desta tela tem esta forma, e ela
 * precisa continuar existindo para elas nao virarem um buraco.
 * ========================================================================= */
export const FORMAS = [
  { id: 'base', nome: 'Clássico', arquivo: '/client/assets/ui/guilda-brasao-base.webp' },
  { id: 'gota', nome: 'Gota' },
  { id: 'normanda', nome: 'Normanda' },
  { id: 'torneio', nome: 'Torneio' },
  { id: 'viking', nome: 'Viking' },
  { id: 'circulo', nome: 'Medalhão' },
  { id: 'ogiva', nome: 'Ogiva' },
  { id: 'hexagono', nome: 'Hexágono' },
  { id: 'losango', nome: 'Losango' },
  { id: 'cruzada', nome: 'Cruzada' },
  { id: 'bifurcada', nome: 'Bifurcada' },
  { id: 'lamina', nome: 'Lâmina' },
  { id: 'serrilhada', nome: 'Serrilhada' },
  { id: 'flamejante', nome: 'Flamejante' },
  { id: 'estandarte', nome: 'Estandarte' },
  { id: 'pergaminho', nome: 'Pergaminho' },
  { id: 'real', nome: 'Real' },
];

/* =========================================================================
 * OS SIMBOLOS
 *
 * Agrupados porque a grade fica com vinte e tres desenhos: sem os tres titulos
 * ela e' uma parede de silhuetas brancas onde ninguem acha a coroa.
 * ========================================================================= */
export const SIMBOLOS = [
  { id: 'espadas-cruzadas', nome: 'Espadas cruzadas', grupo: 'Armas' },
  { id: 'espada-ereta', nome: 'Espada', grupo: 'Armas' },
  { id: 'machados', nome: 'Machados', grupo: 'Armas' },
  { id: 'flechas', nome: 'Flechas', grupo: 'Armas' },
  { id: 'arco', nome: 'Arco', grupo: 'Armas' },
  { id: 'martelo', nome: 'Martelo', grupo: 'Armas' },
  { id: 'lanca-e-escudo', nome: 'Lança e escudo', grupo: 'Armas' },
  { id: 'adaga-alada', nome: 'Adaga alada', grupo: 'Armas' },
  { id: 'leao', nome: 'Leão', grupo: 'Animais' },
  { id: 'dragao', nome: 'Dragão', grupo: 'Animais' },
  { id: 'lobo', nome: 'Lobo', grupo: 'Animais' },
  { id: 'aguia', nome: 'Águia', grupo: 'Animais' },
  { id: 'escorpiao', nome: 'Escorpião', grupo: 'Animais' },
  { id: 'serpente', nome: 'Serpente', grupo: 'Animais' },
  { id: 'corvo', nome: 'Corvo', grupo: 'Animais' },
  { id: 'coroa', nome: 'Coroa', grupo: 'Insígnias' },
  { id: 'caveira', nome: 'Caveira', grupo: 'Insígnias' },
  { id: 'chama', nome: 'Chama', grupo: 'Insígnias' },
  { id: 'raio', nome: 'Raio', grupo: 'Insígnias' },
  { id: 'torre', nome: 'Torre', grupo: 'Insígnias' },
  { id: 'arvore', nome: 'Árvore', grupo: 'Insígnias' },
  { id: 'lua-e-estrela', nome: 'Lua e estrela', grupo: 'Insígnias' },
  { id: 'olho', nome: 'Olho', grupo: 'Insígnias' },
];

/* =========================================================================
 * AS CORES, E OS EFEITOS QUE CUSTAM COIN
 *
 * "alguns efeitos de cor no brasao quero que seja exclusivo por ravox coins."
 *
 * ---- O CORTE ENTRE O QUE E' DE GRACA E O QUE SE PAGA ----
 *
 * De graca: DOZE cores chapadas. Sao todas as matizes do circulo, e com elas
 * qualquer guilda consegue a cor dela — ninguem e' obrigado a pagar para ter um
 * brasao azul.
 *
 * Pago: os EFEITOS. Eles nao sao cores, sao acabamentos — metal escovado,
 * degrade de duas pontas, brilho que anda. Uma guilda com o brasao de ouro
 * polido no meio da tabela se ve de longe, e isso e' o que se esta comprando:
 * ser notado, e nao ser azul.
 *
 * Esse corte importa: vender COR seria vender identidade, e uma guilda pobre
 * ficaria com um brasao feio. Vendendo acabamento, ela fica com um brasao
 * simples — que e' outra coisa.
 *
 * ---- O EFEITO E' DESTRAVADO UMA VEZ, POR GUILDA ----
 *
 * Nao e' cobrado a cada uso. Uma guilda que compra o Ouro e depois troca o
 * simbolo nao paga o Ouro de novo — ela ja o tem. O que ela paga na segunda vez
 * e' a troca do brasao (ver `CUSTO_DE_TROCAR`), que e' outra conta.
 *
 * Cobrar por uso puniria justamente quem mexe no brasao, que e' quem gosta
 * dele; e faria o jogador ter medo de abrir a tela.
 * ========================================================================= */

/* =========================================================================
 * AS DOZE CLASSICAS, E POR QUE ELAS CONTINUAM EXISTINDO
 *
 * A cor do escudo nao e' mais escolhida numa lista — e' escolhida numa RODA, e
 * pode ser qualquer uma (ver `ehCorLivre`). Entao para que doze cores fixas?
 *
 * Por DUAS coisas que a roda nao faz:
 *
 *   1. O PADRAO. Toda guilda fundada antes desta tela tem a cor que o hash do
 *      nome escolheu desta lista, e e' assim que as pessoas a reconhecem na
 *      tabela do servidor. Tirar a lista mudaria a cor de todas elas.
 *
 *   2. O QUE JA ESTA GUARDADO. O banco tem `cor: 'cobalto'` escrito em guildas
 *      que ja existem. Se `cobalto` deixasse de resolver, elas cairiam no
 *      padrao e trocariam de cor sozinhas.
 *
 * Elas nao aparecem mais como prateleira na tela. Sao um nome antigo que
 * continua valendo.
 * ========================================================================= */
const chapada = (id, nome, cor) => ({ id, nome, coins: 0, css: cor });

/* =========================================================================
 * MEXER NO TOM DE UM HEX
 *
 * Os efeitos de duas cores (ver `duasCores`, abaixo) recebem DOIS hex e tem de
 * devolver o mesmo desenho que tinham com as cores de fabrica — e esse desenho
 * nao e' feito de duas cores, e' feito de duas cores MAIS as sombras e os
 * reflexos delas. O aro de ouro da Orla tem seis paradas; duas sao o ouro, as
 * outras quatro sao ouro escurecido e ouro clareado.
 *
 * Entao o degrade se escreve em termos de UMA cor e de fatores, e quem calcula
 * os tons e' isto. A alternativa era pedir seis cores a quem so' quis trocar o
 * ouro por prata.
 *
 * Multiplicacao e nao mistura com branco: multiplicar mantem o MATIZ (um
 * vermelho clareado continua vermelho), enquanto misturar com branco anda para
 * o rosa. Acima de 1 ele estoura no 255, que e' o reflexo.
 * ========================================================================= */
const tom = (hex, fator) => {
  const cru = String(hex).replace('#', '');
  const canal = (i) => {
    const v = Math.round(parseInt(cru.slice(i, i + 2), 16) * fator);
    return Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  };
  return '#' + canal(0) + canal(2) + canal(4);
};

/*
 * Clarear e' misturar com BRANCO, e escurecer e' multiplicar — as duas coisas sao
 * diferentes e cada uma serve a um lado do metal.
 *
 * Multiplicar mantem o matiz (um dourado escurecido continua dourado), e e' o que
 * se quer nas sombras. Mas multiplicar por mais de 1 para clarear estoura os
 * canais um a um: o ouro `#d9a83a` vezes 1,55 vira `#ffff5a`, um amarelo-limao —
 * o vermelho e o verde batem no teto e o azul sobe sozinho, torcendo o matiz.
 *
 * O reflexo de um metal polido nao e' a cor mais saturada: e' a cor CAMINHANDO
 * para o branco. Por isso os brilhos sao interpolacao, e nao multiplicacao.
 */
const clarear = (hex, quanto) => {
  const cru = String(hex).replace('#', '');
  const canal = (i) => {
    const v = parseInt(cru.slice(i, i + 2), 16);
    return Math.round(v + (255 - v) * quanto)
      .toString(16)
      .padStart(2, '0');
  };
  return '#' + canal(0) + canal(2) + canal(4);
};

/* =========================================================================
 * A RECEITA DO METAL POLIDO
 *
 * "o efeito de diamante e esmeralda tem que ser o mesmo efeito do ouro polido,
 *  so' que com as cores certas."
 *
 * As catorze paradas abaixo SAO as do Ouro polido, medidas dele: cada uma e' o
 * quanto aquele ponto se afasta da cor base. Negativo escurece (multiplicacao),
 * positivo clareia (caminho para o branco).
 *
 * O que faz metal nao e' a cor — e' o SALTO entre as bandas, e a assimetria
 * delas. Um degrade suave da a mesma cor e nao parece metal nenhum; estas
 * paradas, com a mesma cor, parecem.
 *
 * Escrever a receita uma vez e chamar tres vezes e' o que garante que o bronze, a
 * esmeralda e o diamante sejam de fato o MESMO efeito. Tres degrades escritos a
 * mao seriam tres desenhos parecidos que divergem no dia em que um for ajustado.
 * ========================================================================= */
const POLIDO = [
  [0, -0.65],
  [9, -0.38],
  [15, 0],
  [20, 0.72],
  [25, 0.2],
  [34, -0.29],
  [42, -0.51],
  [52, -0.08],
  [58, 0.8],
  [64, 0],
  [74, -0.38],
  [84, -0.65],
  [93, -0.14],
  [100, 0.55],
];

const metalPolido = (base) =>
  'linear-gradient(100deg, ' +
  POLIDO.map(([onde, quanto]) =>
    `${quanto < 0 ? tom(base, 1 + quanto) : clarear(base, quanto)} ${onde}%`,
  ).join(', ') +
  ')';

export const CORES_CLASSICAS = [
  chapada('rubi', 'Rubi', '#a8323c'),
  chapada('brasa', 'Brasa', '#b8602a'),
  chapada('ambar', 'Âmbar', '#b4922e'),
  chapada('musgo', 'Musgo', '#5d8a3a'),
  chapada('esmeralda', 'Esmeralda', '#2e8a63'),
  chapada('turquesa', 'Turquesa', '#2b8388'),
  chapada('cobalto', 'Cobalto', '#33689e'),
  chapada('safira', 'Safira', '#3a4e9e'),
  chapada('ametista', 'Ametista', '#6b46a0'),
  chapada('vinho', 'Vinho', '#8a3060'),
  chapada('ardosia', 'Ardósia', '#4a5560'),
  chapada('osso', 'Osso', '#9a927f'),
];

/* =========================================================================
 * OS EFEITOS — o que se paga
 *
 * Eles sao o oposto da roda: a roda da' QUALQUER cor, de graca, e por isso a
 * cor nunca foi o que se vende. O que se vende e' o ACABAMENTO — metal
 * escovado, degrade de duas pontas, brilho que anda —, e nenhum deles e' uma
 * cor: sao coisas que a roda nao sabe fazer.
 *
 * Esse corte e' o que mantem a coisa justa. Com a lista de doze, quem nao
 * pagasse ficava preso a doze cores; com a roda, quem nao paga tem a cor exata
 * que quiser e so' nao tem o brilho.
 *
 *   ---- OS PRECOS ----
 *
   * Os precos sobem com o quanto o acabamento CHAMA ATENCAO, e nao com o
   * trabalho de fazer (todos sao um degrade). O Ouro e a Prata sao metal parado;
   * a Aurora e o Vazio mudam de cor ao longo do escudo; o Fogo Vivo se mexe.
   *
 *   Sobem com o quanto o acabamento CHAMA ATENCAO, e nao com o trabalho de
 *   fazer (todos sao um degrade). O Ouro e a Prata sao metal parado; a Aurora e
 *   o Vazio mudam de cor ao longo do escudo; o Fogo Vivo se mexe.
 *
 *   Sao cinco numeros e moram todos nesta lista: mudar um preco e' mudar uma
 *   linha, e nao cacar `50` espalhado por tres arquivos.
 * ========================================================================= */
/* -------------------------------------------------------------------------
 * O QUE UM EFEITO TEM DE TER, E POR QUE ISTO FOI REFEITO
 *
 * "os efeitos especiais que sao comprados tem que ser diferente, algo mais top,
 *  pq se eu colocar por exemplo cor vermelha ja fica igual o efeito sangue — e
 *  isso os outros tambem."
 *
 * Estava certo, e a culpa era da roda: enquanto as cores eram doze, um degrade
 * de vermelho escuro para vermelho claro parecia outra coisa. Com a roda dando
 * qualquer vermelho, `linear-gradient(#e8595c, #a3121d)` virou o que sempre
 * foi — vermelho com sombra. Ninguem pagaria 75 coins por isso, e com razao.
 *
 * Entao a regra passou a ser: um efeito so' vale se a RODA NAO CONSEGUIR FAZER.
 * A roda faz uma cor chapada. Ela nao faz:
 *
 *   BANDA DURA      o degrade de metal muda de claro para escuro em saltos, e
 *                   nao suave. E' o que separa ouro de amarelo.
 *
 * ---- E O QUE NAO FUNCIONA: MUITA PARADA ----
 *
 * Tres efeitos foram refeitos por errarem a MESMA coisa. A Aurora tinha seis
 * matizes repetindo a cada 7%; o Prisma, onze facetas em volta do centro; o
 * Raiado, doze cunhas alternando.
 *
 * No papel sao desenhos. Num escudo de 28 pixels — que e' o tamanho em que o
 * brasao aparece na tabela do servidor, no chat e na cidade — cada faixa tem
 * dois pixels, e duas dezenas de faixas de dois pixels nao sao um desenho: sao
 * ruido. Pior, alternando claro e escuro elas se cancelam e a peca vira uma
 * mancha cinzenta chapada, que e' exatamente o que nao se queria.
 *
 * A regra que ficou: POUCAS regioes, GRANDES, de contraste forte. Um efeito
 * bom tem de se ler a 28 pixels e continuar valendo a 120 — e nao o contrario.
 *   MOVIMENTO       o brilho que corre pela peca. Esta' no `anima`.
 *   TEXTURA         as veias do sangue, feitas com `repeating-`. Nenhuma cor
 *                   chapada tem desenho por dentro.
 *   VARIAS MATIZES  a aurora passa por cinco cores no mesmo escudo.
 *   PROFUNDIDADE    o vazio e' radial: tem um dentro e uma beirada.
 *
 * E todos ganharam BRILHO — um halo da cor do efeito em volta do escudo, que a
 * cor chapada nao tem. E' o que faz o brasao pago se ver de longe na tabela,
 * que e' o que se esta' comprando.
 *
 * ---- SO' UMA IMAGEM POR EFEITO ----
 *
 * O `css` entra numa lista de tres camadas de `background-image` do escudo, e
 * uma virgula a mais aqui desmontaria a lista inteira (o brilho viraria o
 * relevo, o relevo viraria a pintura). Por isso cada um e' UM `gradient(` so' —
 * inclusive os texturados, que usam `repeating-`.
 * ------------------------------------------------------------------------- */
export const EFEITOS = [
  {
    id: 'ouro',
    nome: 'Ouro polido',
    coins: 50,
    /* Bandas duras e um reflexo branco: e' o salto de claro/escuro que faz metal. */
    css:
      'linear-gradient(100deg, #4a3208 0%, #8a6516 9%, #d9a83a 15%, #fff3c4 20%, #e8c86a 25%, ' +
      '#9a7318 34%, #6a4a0e 42%, #c9962c 52%, #fff8dc 58%, #d9a83a 64%, #8a6516 74%, ' +
      '#4a3208 84%, #b9862a 93%, #f6e3a1 100%)',
    brilho: '#ffd98a',
    anima: true,
  },
  {
    id: 'prata',
    nome: 'Prata velha',
    coins: 50,
    css:
      'linear-gradient(100deg, #39424a 0%, #6b7780 9%, #b9c4cc 15%, #ffffff 20%, #ccd6dd 25%, ' +
      '#77838c 34%, #4a545c 42%, #9aa6b0 52%, #ffffff 58%, #b9c4cc 64%, #6b7780 74%, ' +
      '#39424a 84%, #8d99a3 93%, #eef2f5 100%)',
    brilho: '#d6e4ee',
    anima: true,
  },
  {
    id: 'sangue',
    nome: 'Sangue coalhado',
    coins: 75,
    /*
     * Veias, e nao degrade: `repeating-` poe um desenho DENTRO da peca, que e'
     * exatamente o que uma cor chapada nao tem. De longe le como vermelho
     * escuro; de perto tem fio.
     */
    css:
      'repeating-linear-gradient(28deg, #2a0206 0px, #6e0a14 4px, #c3182a 7px, #7d0c18 10px, ' +
      '#3a020a 15px, #1a0104 20px, #58060f 24px, #2a0206 30px)',
    brilho: '#c3182a',
    /*
     * Fundo e veia. As oito paradas do desenho continuam sendo oito: o que sai
     * das duas cores sao os tons intermediarios, que e' o que da' fio ao
     * coalho. Com outras duas cores o mesmo desenho vira seiva, ferrugem ou
     * limo — e continua sendo um desenho, e nao uma cor chapada.
     */
    duasCores: {
      nomes: ['Fundo', 'Veia'],
      padrao: ['#2a0206', '#c3182a'],
      brilho: 1,
      pintar: (fundo, veia) =>
        `repeating-linear-gradient(28deg, ${fundo} 0px, ${tom(veia, 0.55)} 4px, ${veia} 7px, ` +
        `${tom(veia, 0.62)} 10px, ${tom(fundo, 1.35)} 15px, ${tom(fundo, 0.6)} 20px, ` +
        `${tom(veia, 0.44)} 24px, ${fundo} 30px)`,
    },
  },
  {
    id: 'aurora',
    nome: 'Aurora',
    coins: 100,
    /*
     * UMA faixa luminosa atravessando um ceu escuro — e nao seis matizes
     * repetindo. O que se le a 28 pixels e' o contraste entre o fundo quase
     * preto e a banda acesa; o roxo e o verde so' aparecem de perto, que e' o
     * lugar deles.
     *
     * Ela ainda escorrega (`anima`), e agora isso tem efeito: a faixa ATRAVESSA
     * o escudo devagar, como a aurora de verdade. Na versao antiga o degrade
     * era tao repetido que andar nao mudava nada — parecia parado.
     */
    css:
      'linear-gradient(152deg, #070c1e 0%, #14264e 22%, #2f7fa8 40%, #7ff0d0 50%, ' +
      '#8a68e0 62%, #1b1b4a 80%, #05060f 100%)',
    brilho: '#7ff0d0',
    anima: true,
  },
  {
    id: 'vazio',
    nome: 'Vazio',
    coins: 100,
    /* Radial: tem um DENTRO. O escudo fica com fundo e beirada, e nao com face. */
    css:
      'radial-gradient(circle at 42% 30%, #8a6ae8 0%, #4a2f9e 14%, #23164f 38%, ' +
      '#0b0618 70%, #000000 100%)',
    brilho: '#6a4ad0',
  },
  {
    id: 'fogo-vivo',
    nome: 'Fogo vivo',
    coins: 150,
    /*
     * O mais caro, e o unico com nucleo branco: e' a peca que chama o olho de
     * quem nao estava olhando. A animacao arrasta um degrade maior que o escudo
     * — ver `.gb-escudo.anima` no CSS.
     */
    css:
      'repeating-linear-gradient(112deg, #fff6d0 0%, #ffd166 5%, #f79020 11%, #d43a12 17%, ' +
      '#8a1408 23%, #d43a12 29%, #f79020 35%, #ffd166 41%, #fff6d0 46%)',
    brilho: '#ff8a2a',
    anima: true,
  },
  {
    id: 'bronze',
    nome: 'Bronze batido',
    coins: 50,
    /*
     * ---- A MESMA RECEITA DO OURO, EM OUTRO METAL ----
     *
     * "um seria igual o do ouro polido so' que de bronze."
     *
     * A estrutura e' identica de proposito: o que faz metal e' o SALTO entre as
     * bandas, e nao a cor. Trocando so' os tons, o bronze fica irmao do ouro e da
     * prata — tres metais da mesma familia, que e' o que se quer de um conjunto.
     *
     * Os tons sao mais fechados que os do ouro: o bronze nao tem reflexo branco,
     * ele para no creme alaranjado. E' isso que impede os dois de se confundirem
     * a 28 pixels.
     */
    css: metalPolido('#b06a2c'),
    brilho: '#d9964e',
    anima: true,
  },
  {
    /*
     * ---- O ID NAO PODE SER `esmeralda` ----
     *
     * `esmeralda` ja e' uma das doze cores classicas, e `CORES` e' a lista das duas
     * juntas com as classicas na frente. Um efeito com o mesmo id ficaria
     * INALCANCAVEL: `corPorId('esmeralda')` acharia a cor chapada e devolveria um
     * efeito de zero coin — o efeito sairia de graca e desenhado errado.
     *
     * E' o tipo de colisao que nao quebra nada na hora: o escudo aparece, so' que
     * verde chapado, e a cobranca simplesmente nao acontece.
     */
    id: 'esmeralda-lapidada',
    nome: 'Esmeralda lapidada',
    coins: 100,
    /*
     * ---- O MESMO POLIDO DO OURO, EM VERDE ----
     *
     * "tem que ser o mesmo efeito do ouro polido, so' que com as cores certas."
     *
     * Era um radial de pedra lapidada, com mesa e beirada. Virou o polido: as
     * mesmas catorze bandas do Ouro, a partir do verde-esmeralda. Uma gema
     * facetada e um metal polido refletem do mesmo jeito — em bandas duras —, e e'
     * isso que os tres tem em comum agora.
     */
    css: metalPolido('#12a866'),
    brilho: '#3fd18a',
    anima: true,
  },
  {
    id: 'diamante',
    nome: 'Diamante',
    coins: 175,
    /*
     * ---- O MESMO POLIDO, EM AZUL GELO ----
     *
     * O mais caro, e a unica peca CLARA da lista: uma peca clara num escudo escuro
     * e' a que mais se destaca numa tabela cheia.
     *
     * A base e' um azul frio e nao o branco. Branco puro nao teria sombra nenhuma
     * para as bandas escuras do polido morderem, e o resultado seria um borrao
     * cinza; com o azul, as sombras ficam geladas e os reflexos batem no branco —
     * que e' exatamente a cara de um diamante.
     */
    css: metalPolido('#a8cfe6'),
    brilho: '#dff1ff',
    anima: true,
  },
  {
    id: 'partido',
    nome: 'Partido',
    coins: 75,
    /*
     * ---- DUAS METADES, E MAIS NADA ----
     *
     * Na heraldica isto e' um escudo "partido": uma linha vertical no meio e
     * dois esmaltes, um de cada lado. E' das particoes mais antigas que
     * existem, e e' o efeito mais simples desta lista de proposito — ele se le
     * a TREZE pixels, na linha do chat, onde todo o resto vira mancha.
     *
     * Sao duas regioes grandes de contraste forte, que e' a regra inteira. As
     * paradas sao duras (`0 50%` e `50% 100%`), sem transicao nenhuma: um
     * degrade suave no meio borraria justamente a coisa que se ve.
     */
    css: 'linear-gradient(90deg, #9e1622 0 50%, #16213f 50% 100%)',
    brilho: '#c9a227',
    /*
     * ---- E AS DUAS METADES SAO ESCOLHIDAS ----
     *
     * "engrenagem de cor dos efeitos (Partido e companhia tem duas cores
     *  fixas)."
     *
     * Estavam fixas mesmo, e era o defeito mais visivel da lista: um efeito
     * cuja ideia INTEIRA e' "duas cores, uma de cada lado" vinha com vermelho e
     * azul-noite cravados, e duas guildas que o comprassem saiam identicas.
     *
     * `pintar` recebe as duas e devolve o mesmo degrade. Ele continua sendo UMA
     * imagem e continua com as paradas duras (`0 50%` / `50% 100%`): e' isso que
     * faz o Partido se ler a treze pixels, e nao as cores.
     */
    duasCores: {
      nomes: ['Esquerda', 'Direita'],
      padrao: ['#9e1622', '#16213f'],
      /* Ver `brilhoDe`, abaixo: qual das duas manda no halo. */
      brilho: 0,
      pintar: (a, b) => `linear-gradient(90deg, ${a} 0 50%, ${b} 50% 100%)`,
    },
  },
  {
    id: 'orla',
    nome: 'Orla de ouro',
    coins: 125,
    /*
     * ---- O CAMPO COM UM ARO ----
     *
     * Um campo escuro, um aro de ouro perto da beirada, e o escuro de novo por
     * fora dele. E' o desenho de uma medalha, e ele funciona pequeno pelo mesmo
     * motivo que o Partido: sao TRES regioes grandes, e a do meio e' a unica
     * clara.
     *
     * O aro acompanha o contorno porque o raio e' em porcentagem — num escudo
     * de 28 e num de 120 ele fica na mesma fracao da distancia ate' a beirada,
     * e nunca vira um fio de um pixel.
     *
     * E' o mais caro dos tres porque e' o que mais parece feito a mao: o ouro
     * so' aparece onde a luz pegaria, e o resto e' campo.
     */
    css:
      'radial-gradient(circle at 50% 48%, #1d2740 0 52%, #8a6a1e 55%, #f4dc8a 62%, ' +
      '#c9a227 66%, #16203a 70%, #0b1020 100%)',
    brilho: '#f4dc8a',
    /*
     * Campo e aro, que sao as duas regioes que o desenho TEM. As outras quatro
     * paradas saem destas duas por `tom`: o aro escuro que faz a sombra do
     * relevo, o claro que faz a luz, e o campo escurecendo para fora.
     *
     * Trocar o ouro por prata, por cobre ou por esmeralda e' a mesma medalha em
     * outro metal — o desenho nao muda, e era o desenho que se comprou.
     */
    duasCores: {
      nomes: ['Campo', 'Aro'],
      padrao: ['#1d2740', '#f4dc8a'],
      brilho: 1,
      pintar: (campo, aro) =>
        `radial-gradient(circle at 50% 48%, ${campo} 0 52%, ${tom(aro, 0.58)} 55%, ` +
        `${tom(aro, 1.22)} 62%, ${tom(aro, 0.84)} 66%, ${tom(campo, 0.76)} 70%, ${tom(campo, 0.42)} 100%)`,
    },
  },
];

/*
 * A lista inteira, que e' o que resolve um id guardado. A tela nao desenha mais
 * isto como prateleira — quem le daqui e' `corPorId`, para dizer o que um
 * `'cobalto'` do banco quer dizer.
 */
export const CORES = [...CORES_CLASSICAS, ...EFEITOS];

/** Quanto custa trocar o brasao depois que a guilda ja existe. */
export const CUSTO_DE_TROCAR = 50;

/* Os padroes: e' assim que fica uma guilda que nunca abriu esta tela. */
export const FORMA_PADRAO = 'base';
export const COR_PADRAO = 'cobalto';

/*
 * O creme do simbolo. Nao e' uma cor da paleta de proposito: um padrao tirado
 * da paleta daria simbolo azul em escudo azul, e o desenho sumiria justamente
 * para quem nunca mexeu em nada.
 *
 * Claro e nao branco puro: branco sobre as cores claras (o Osso, o Ambar) tem
 * pouco contraste. O creme le nas dezoito.
 */
export const TINTA_PADRAO_DO_SIMBOLO = 'creme';

/* =========================================================================
 * A TINTA DAS INICIAIS
 *
 * "tem que poder mudar a cor da letra do emblema da guilda tambem."
 *
 * O padrao e' o creme que as iniciais sempre tiveram — escrito como hex e nao
 * como id de catalogo, porque ele nunca foi uma escolha de paleta: e' a cor que
 * estava cravada na folha de estilo desde antes desta tela existir. Guildas
 * antigas continuam com as letras exatamente como estavam.
 *
 * ---- AS LETRAS ACEITAM EFEITO PAGO ----
 *
 * "tem que ter como por os efeitos especiais nas letras tambem."
 *
 * Elas nao aceitavam, e a razao era a conta: `precoDoBrasao` varria a cor do
 * escudo e a do simbolo, e um Ouro que entrasse por um terceiro campo sem ser
 * varrido sairia DE GRACA. Ou se cobra nos tres, ou se aceita so' cor livre
 * num deles — e a escolha certa e' cobrar nos tres.
 *
 * Entao a varredura passou a ser dos TRES campos (ver `precoDoBrasao` e
 * `efeitosUsados`), e o `vistos` que ja' existia cuida do resto: o mesmo Ouro
 * no escudo e nas letras e' UMA compra, nao duas.
 *
 * Duas letras de dez pixels mostram pouco de um degrade, e' verdade — mas
 * Iniciais de ouro com halo dourado se veem, e quem paga sabe o que esta'
 * comprando melhor do que uma regra escrita aqui.
 * ========================================================================= */
export const TINTA_PADRAO_DAS_LETRAS = '#fff3d6';

/* =========================================================================
 * A FONTE DO BRASAO
 *
 * "e' possivel ter opcao pra escolher algumas fontes pro nome da guilda, ao
 *  criar? e nas iniciais? daria lag isso?"
 *
 * ---- NAO DA' LAG, E E' POR CAUSA DESTA LISTA ----
 *
 * Nenhuma das seis baixa nada. Duas ja vem carregadas em TODA pagina do jogo e
 * do site (Cinzel e Cinzel Decorative, no `<link>` do Google Fonts que ja existe)
 * e as outras quatro sao pilhas de fonte do SISTEMA — elas ja estao no computador
 * de quem joga.
 *
 * Uma fonte nova por guilda e' que daria: cada familia sao 20 a 60 KB, e um
 * brasao com fonte que a pagina nao carregou apareceria com a fonte errada ate' o
 * arquivo chegar (e com a errada para sempre em quem esta offline). Com esta
 * lista, o escudo sai igual no jogo, no chat e no site, na primeira pintura.
 *
 * ---- POR QUE O OSWALD FICOU DE FORA ----
 *
 * Ele e' carregado no JOGO e nao no site. Um brasao com Oswald sairia condensado
 * na janela de guildas e com a fonte de reserva na pagina da guilda — duas caras
 * para o mesmo escudo, que e' a coisa que este arquivo inteiro existe para
 * impedir.
 *
 * ---- A `escala` ----
 *
 * `tamanhoDasLetras` foi medido na Decorativa. As outras nao tem a mesma largura
 * por letra: a monoespacada e' bem mais larga, as de texto um pouco. A escala
 * corrige isso, e e' sempre <= 1 de proposito — assim a conta que garante que
 * cinco letras cabem no escudo continua sendo um TETO para todas as fontes, e nao
 * so' para a padrao.
 * ========================================================================= */
export const FONTES = [
  {
    id: 'titulo',
    nome: 'Decorativa',
    /* A de sempre: e' ela que da' ao escudo a cara de heraldica. */
    css: '"Cinzel Decorative", "Cinzel", Georgia, serif',
    escala: 1,
  },
  { id: 'classica', nome: 'Clássica', css: '"Cinzel", Georgia, serif', escala: 1 },
  { id: 'livro', nome: 'Livro', css: 'Georgia, "Times New Roman", serif', escala: 0.95 },
  {
    id: 'moderna',
    nome: 'Moderna',
    css: '"Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif',
    escala: 0.95,
  },
  /*
   * ---- A "PESADA" SAIU ----
   *
   * "retira a fonte 'Pesada' de existir la' em guilds."
   *
   * Ela era a Impact, e o que a tornava boa num escudo de 28 pixels — condensada e
   * cheia — e' o que a tornava estranha no NOME da guilda, que agora usa a mesma
   * familia (ver `vestirNomeDaGuilda`). Uma guilda com a fonte de um meme no nome,
   * no podio e no site nao era o que a escolha prometia.
   *
   * O id fica fora da lista e NAO vira um caso especial em lugar nenhum: quem tiver
   * 'pesada' gravado cai no padrao sozinho, porque `normalizarBrasao` resolve a
   * fonte por `fontePorId(bruto.fonte)?.id ?? padrao.fonte` — um id que nao existe
   * mais nao e' um id conhecido.
   */
  {
    id: 'maquina',
    nome: 'Máquina',
    css: 'ui-monospace, Consolas, "Courier New", monospace',
    escala: 0.88,
  },
];

export const FONTE_PADRAO = 'titulo';

export const fontePorId = (id) => FONTES.find((f) => f.id === id) ?? null;

/**
 * A familia CSS de um brasao — a mesma para as iniciais e para o nome da guilda.
 *
 * Quem pergunta e' o desenho do escudo E a tela que escreve o nome, em dois
 * arquivos diferentes. Com a resposta aqui, os dois nao tem como discordar.
 */
export const fonteDoBrasao = (brasao) =>
  (fontePorId(brasao?.fonte) ?? FONTES[0]).css;

/* =========================================================================
 * QUAIS LETRAS, ONDE, E DE QUE TAMANHO
 *
 * "a pessoa pode escolher ate 3 letras pra colocar no brasao, e ela pode
 *  reposicionar essas letras e aumentar ou diminuir a fonte (sem quebrar, com
 *  limite ok)."
 *
 * ---- O TEXTO E' TRES CARACTERES, E SO' LETRA E NUMERO ----
 *
 * Tres porque quatro nao cabe: num escudo de 28 pixels da tabela do servidor,
 * quatro letras dao sete pixels cada uma e viram uma mancha.
 *
 * E a peneira e' uma LISTA DO QUE PODE (A-Z e 0-9), e nao uma lista do que nao
 * pode. Este texto aparece na cidade, no chat e na tabela para todo mundo, sem
 * passar por nenhuma outra tela — e uma peneira de proibidos sempre esquece
 * alguma coisa. Fora da lista, o campo volta a ser as iniciais do nome.
 *
 * Acento fica de fora junto com o resto. Nao e' desprezo pelo portugues: sao
 * duas letras dentro de um escudo, e "Ç" ao lado de "C" no mesmo tamanho e' uma
 * diferenca que ninguem ve — e a peneira fica simples de conferir dos dois
 * lados.
 *
 * ---- O TAMANHO E' UM MULTIPLICADOR, E NAO UM TAMANHO ----
 *
 * "sem quebrar, com limite."
 *
 * Se fosse um tamanho em pixels, tres letras no maximo estourariam o escudo, e
 * uma letra no minimo sumiria. Aqui 100 quer dizer "o tamanho que cabe", e ele
 * ja' leva em conta QUANTAS letras sao (ver `tamanhoDasLetras`): uma letra
 * sozinha ganha mais, tres ganham menos. O que a pessoa mexe e' de 60% a 140%
 * disso — e nas duas pontas ainda e' um brasao, e nao um estrago.
 * ========================================================================= */
/* =========================================================================
 * MOVER E REDIMENSIONAR — as letras E o simbolo
 *
 * "tem que poder movimentar os simbolos tambem."
 *
 * Os dois usam os MESMOS limites, e isso nao e' preguica: um simbolo que
 * pudesse crescer mais que uma letra sairia do escudo, e um que pudesse crescer
 * menos ficaria perdido no meio dele. O que cabe num escudo e' o mesmo para as
 * duas coisas.
 *
 * E os dois sao MULTIPLICADORES, e nao tamanhos: 100 quer dizer "o tamanho que
 * cabe", que ja' leva em conta o desenho (o `inset` do simbolo, o numero de
 * letras). O que a pessoa mexe e' de 60% a 140% disso — nas duas pontas ainda
 * e' um brasao, e nao um estrago.
 * ========================================================================= */
/* =========================================================================
 * ATE' CINCO INICIAIS
 *
 * "qual o limite de iniciais possivel aparecer no emblema? da' pra mudar o maximo
 *  pra 5? sem quebrar nada e sem aparecer bugado?"
 *
 * Da', e o que segura o "sem aparecer bugado" e' `tamanhoDasLetras`: a fonte
 * encolhe sozinha conforme entram letras. Cinco letras no corpo de tres sairiam
 * pelas beiradas do escudo — entao o corpo e' funcao da quantidade, e nao um
 * numero fixo que a pessoa tem de acertar na regua.
 * ========================================================================= */
export const MAXIMO_DE_LETRAS = 5;
const SO_LETRA_E_NUMERO = /^[A-Z0-9]{1,5}$/;

export const LIMITE_DO_TAMANHO = { minimo: 60, maximo: 140, padrao: 100 };
export const LIMITE_DO_LUGAR = { minimo: -35, maximo: 35, padrao: 0 };

/** Limpa o texto escolhido. Devolve `null` quando nao sobra nada que sirva. */
export function textoDasLetras(bruto) {
  const limpo = String(bruto ?? '')
    .trim()
    .toUpperCase()
    .slice(0, MAXIMO_DE_LETRAS);
  return SO_LETRA_E_NUMERO.test(limpo) ? limpo : null;
}

/** Prende um numero entre dois limites. Texto e lixo caem no padrao. */
export function presoEntre(valor, { minimo, maximo, padrao }) {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n)) return padrao;
  return Math.min(maximo, Math.max(minimo, n));
}

/*
 * A fracao do escudo que UMA letra ocupa, pelo numero delas. E' o "100%" que o
 * multiplicador multiplica.
 *
 * Os tres numeros sao o que cabe de verdade: `0.38` e' o tamanho que as duas
 * iniciais sempre tiveram, e os outros dois sao ele corrigido pela largura que
 * uma letra a mais ou a menos pede.
 */
/*
 * O corpo da fonte, como fracao do tamanho do brasao.
 *
 * ---- ELE CAI COM A QUANTIDADE, E CAI MAIS DEVAGAR QUE ELA ----
 *
 * A largura que cinco letras ocupam nao e' cinco vezes a de uma: os glifos tem
 * espaco entre si e o escudo e' mais largo no meio. Se o corpo caisse como `1/n`,
 * cinco letras sairiam minusculas no meio de um escudo vazio.
 *
 * Os numeros sao medidos no escudo classico, com a letra mais larga do alfabeto
 * (o "W") repetida — e' o pior caso, e e' o que tem de caber.
 *
 * O multiplicador da regua entra POR CIMA disto. Quem quiser as cinco letras
 * maiores pode aumentar ate' 140%, e ai elas encostam nas beiradas de proposito;
 * o que nao pode e' o PADRAO sair quebrado.
 */
/*
 * A conta que decide estes numeros, para quem for mexer neles:
 *
 *   largura ocupada = quantas x corpo x 0,9      (0,9 = a largura do "W" em `em`)
 *   e ela tem de caber em 0,76 da caixa          (o vao interno do escudo classico)
 *
 * ---- POR QUE 0,76 E NAO 0,8 ----
 *
 * "conferir se iniciais de 3+ caracteres cabem no escudo grande do podio — o
 *  '34534' quase estoura."
 *
 * Quase estourava mesmo: tres letras com corpo 0,29 ocupavam 0,783 do vao, o que
 * e' caber pela casa decimal. Num escudo de 28 pixels ninguem nota; a 86, no
 * podio, um "W" encostando na beirada do contorno se ve.
 *
 * Os tres valores desceram juntos para a folga ficar igual em toda quantidade —
 * uma folga que muda de 2% para 8% conforme o numero de letras seria um desenho
 * inconsistente, e o olho pega isso antes de saber o porque.
 *
 * O `test-brasao-de-guilda.mjs` refaz esta conta e falha se algum passar — foi
 * assim que 0,235 e 0,195, que eu tinha chutado, cairam.
 */
const CORPO_DA_LETRA = { 1: 0.5, 2: 0.38, 3: 0.275, 4: 0.205, 5: 0.165 };

export function tamanhoDasLetras(texto, multiplicador = 100) {
  const quantas = Math.max(1, Math.min(MAXIMO_DE_LETRAS, String(texto ?? '').length));
  const base = CORPO_DA_LETRA[quantas] ?? CORPO_DA_LETRA[MAXIMO_DE_LETRAS];
  return base * (presoEntre(multiplicador, LIMITE_DO_TAMANHO) / 100);
}

/** As duas ordens possiveis, e o que cada uma quer dizer na tela. */
export const ORDENS = [
  { id: 'frente', nome: 'Dentro do escudo' },
  { id: 'atras', nome: 'Atrás do escudo' },
];

/* =========================================================================
 * AS TRES PECAS SAO OPCIONAIS — forma, simbolo e letras
 *
 * "a pessoa tem que ter a opcao de tirar a forma, e a letra se ela quiser, e
 *  deixar so o simbolo por exemplo, e vice-versa."
 *
 * O simbolo e as letras ja' podiam sair (`simbolo: null`, `letras: false`). A
 * FORMA nao podia: ela caia no padrao quando o id nao existia, e nao havia como
 * dizer "nenhuma" — um id desconhecido e uma escolha deliberada de nao ter
 * escudo chegavam iguais aqui.
 *
 * `FORMA_NENHUMA` separa as duas coisas. Ele e' um id de verdade, guardado no
 * banco como qualquer outro, e o desenho sabe que com ele nao ha' escudo — so'
 * o simbolo e as letras, soltos.
 *
 * O `null` continua querendo dizer "nao sei o que e' isso" e cai no padrao. E'
 * a diferenca entre uma versao velha da tela pedindo uma forma que saiu do
 * catalogo (que tem de cair no escudo classico) e alguem pedindo um brasao sem
 * escudo (que tem de sair sem escudo).
 * ========================================================================= */
export const FORMA_NENHUMA = 'nenhuma';

export const formaPorId = (id) =>
  (id === FORMA_NENHUMA ? { id: FORMA_NENHUMA, nome: 'Sem forma', vazia: true } : FORMAS.find((f) => f.id === id)) ??
  null;
export const simboloPorId = (id) => SIMBOLOS.find((s) => s.id === id) ?? null;

/* =========================================================================
 * A COR LIVRE — o hex que a roda produziu
 *
 * "em vez de ter cores pra escolher, faca ele negocio RGB, que a pessoa anda
 *  com o mouse e escolhe qualquer cor; seria uma bola com as cores RGB."
 *
 * Entao a cor de um brasao passou a ser TRES coisas no mesmo campo:
 *
 *   '#a8323c'   uma cor livre, saida da roda. De graca, sempre.
 *   'ouro'      um efeito do catalogo. Custa, uma vez por guilda.
 *   'cobalto'   uma classica antiga, que continua resolvendo.
 *
 * Um campo so' para os tres, e nao um campo de cor mais um de efeito, porque
 * eles sao EXCLUSIVOS: um escudo tem uma pintura. Dois campos abririam a
 * pergunta "e se a pessoa escolher os dois?", que nao tem resposta boa.
 *
 * O formato e' `#rrggbb`, minusculo, e SO' ele: aceitar `rgb()` ou os nomes de
 * cor do CSS seria aceitar texto do cliente direto numa folha de estilo, e o
 * que entra por ali sai pintado na tela de todo mundo que ve a guilda.
 * ========================================================================= */
const HEX = /^#[0-9a-f]{6}$/;

export function ehCorLivre(valor) {
  return typeof valor === 'string' && HEX.test(valor.trim().toLowerCase());
}

/** A cor livre com a cara de uma entrada do catalogo, para o resto nao ver diferenca. */
export function corLivre(valor) {
  const hex = String(valor).trim().toLowerCase();
  return { id: hex, nome: hex.toUpperCase(), coins: 0, css: hex, livre: true };
}

/* =========================================================================
 * O EFEITO TINGIDO — `partido~9e1622~16213f`
 *
 * "engrenagem de cor dos efeitos (Partido e companhia tem duas cores fixas)."
 *
 * ---- POR QUE AS DUAS CORES MORAM DENTRO DO MESMO CAMPO ----
 *
 * Um brasao tem quatro pinturas (escudo, contorno, simbolo, iniciais). Guardar
 * as duas cores de um efeito em campos proprios seria OITO campos novos
 * (`corA`/`corB` vezes quatro), cada um a ser normalizado, comparado em
 * `mesmoBrasao`, validado no servidor e gravado no banco — e sete deles vazios
 * na quase totalidade dos brasoes.
 *
 * O campo de pintura ja era de tres formas (hex livre, id de efeito, classica
 * antiga). Esta e' a quarta, e ela cabe na mesma peneira: continua sendo UMA
 * string, continua passando por `corPorId`, continua sendo comparada por `===`.
 *
 * ---- O `~` E OS SEIS DIGITOS SEM `#` ----
 *
 * O formato e' fechado por regex, como o hex livre, e pelo mesmo motivo: esta
 * string vira folha de estilo na tela de todo mundo que ve a guilda. `~` porque
 * ele nao aparece em nenhum id do catalogo e nao e' nada em CSS; sem `#` para o
 * valor inteiro continuar sendo uma palavra so'.
 *
 * ---- `base` E' A IDENTIDADE DA COMPRA ----
 *
 * O objeto devolvido tem `id` igual ao valor guardado (para `normalizarBrasao`
 * ir e voltar sem perder as cores) e `base` igual ao id do efeito. Quem cobra e
 * quem destrava leem `base`: senao cada tom novo do Partido seria uma compra
 * nova, e a guilda pagaria 75 coins por mudar de vermelho para verde.
 * ========================================================================= */
const EFEITO_TINGIDO = /^([a-z][a-z-]{1,14})~([0-9a-f]{6})~([0-9a-f]{6})$/;

/** Este efeito aceita a engrenagem das duas cores? */
export const temDuasCores = (id) => !!EFEITOS.find((e) => e.id === id)?.duasCores;

export function efeitoTingido(valor) {
  if (typeof valor !== 'string') return null;
  const achado = EFEITO_TINGIDO.exec(valor.trim().toLowerCase());
  if (!achado) return null;
  const base = EFEITOS.find((e) => e.id === achado[1] && e.duasCores);
  if (!base) return null;
  const cores = ['#' + achado[2], '#' + achado[3]];
  return {
    ...base,
    id: `${base.id}~${achado[2]}~${achado[3]}`,
    base: base.id,
    cores,
    css: base.duasCores.pintar(cores[0], cores[1]),
    /*
     * ---- QUAL DAS DUAS ACENDE O HALO ----
     *
     * Nao e' sempre a primeira. O halo e' um brilho, e brilho de cor escura nao
     * se ve: no Sangue e na Orla a cor que MANDA no desenho e' a segunda (a veia,
     * o aro) e a primeira e' o campo quase preto. Um halo do campo seria um halo
     * invisivel, que e' pior do que nenhum — a pessoa liga o contorno e conclui
     * que o botao esta quebrado.
     *
     * `duasCores.brilho` diz qual, e ele mora no catalogo junto do desenho: quem
     * escrever o quarto efeito de duas cores decide ali, olhando para o degrade.
     */
    brilho: cores[base.duasCores.brilho ?? 0],
  };
}

/** Escreve o valor guardado de um efeito com as duas cores escolhidas. */
export function tingir(idDoEfeito, a, b) {
  const hex = (c, queda) => (ehCorLivre(c) ? String(c).trim().toLowerCase().slice(1) : queda);
  const base = EFEITOS.find((e) => e.id === idDoEfeito && e.duasCores);
  if (!base) return idDoEfeito;
  const [pa, pb] = base.duasCores.padrao;
  return `${base.id}~${hex(a, pa.slice(1))}~${hex(b, pb.slice(1))}`;
}

/**
 * A identidade de COMPRA de uma pintura — o id do efeito, sem os tons.
 *
 * Uma funcao so' porque tres lugares precisam dela e um deles esquecido custaria
 * uma cobranca repetida: `precoDoBrasao`, `efeitosUsados` e a prateleira da tela
 * (que acende o efeito escolhido).
 */
export const idDoEfeito = (tinta) => tinta?.base ?? tinta?.id ?? null;

/* =========================================================================
 * O ACABAMENTO — sólida, metálica ou fosca
 *
 * "todas as cores tem que ter opcao pra escolher cores solida ou metalica ou
 *  fosca."
 *
 * Uma cor da roda saía sempre CHAPADA: `linear-gradient(c, c)`, a mesma tinta de
 * ponta a ponta. Isso é um material só — plástico. O acabamento diz de que
 * MATERIAL a peça é feita, com a mesma cor:
 *
 *   sólida    a de sempre. Chapada, limpa, e continua sendo o padrão.
 *   metálica  bandas de claro e escuro na diagonal. É o que faz uma superfície
 *             parecer metal: não a cor, e sim o SALTO entre luz e sombra.
 *   fosca     baixo contraste e nenhuma banda clara, mais escura no pé. Pedra,
 *             feltro, tinta de parede — o oposto do reflexo.
 *
 * ---- ISTO NAO E' O OURO POLIDO, E A DIFERENCA E' DE PROPOSITO ----
 *
 * O Ouro e a Prata custam 50 coins e são "metal em bandas", então um metálico de
 * graça em qualquer cor os esvaziaria. A diferença tem de ser visível, e é:
 *
 *   metálica (grátis)   sete paradas, clareamento até 1,35, PARADA
 *   Ouro polido (pago)  quinze paradas, núcleo branco puro, e ANDA (`anima`)
 *
 * Um é o material, o outro é o tratamento. Cetim contra espelho polido.
 *
 * ---- O FORMATO MORA NO MESMO CAMPO ----
 *
 * `metal~a8323c`, como o `partido~..~..` dos efeitos de duas cores, e pela mesma
 * razão: uma pintura é UMA string, e um campo de acabamento à parte multiplicaria
 * por seis (são seis alvos) para guardar "sólida" em quase todos.
 *
 * A sólida não tem prefixo — ela continua sendo `#a8323c`. É o que faz todo
 * brasão já gravado continuar idêntico sem nenhuma conversão.
 * ========================================================================= */
export const ACABAMENTOS = [
  { id: 'solida', nome: 'Sólida', dica: 'A cor chapada, sem brilho nenhum. É como ela sempre saiu.' },
  {
    id: 'metal',
    nome: 'Metálica',
    dica: 'Bandas de luz e sombra na diagonal, na mesma cor. Menos que o Ouro polido, que é pago e se mexe.',
  },
  { id: 'fosco', nome: 'Fosca', dica: 'Sem reflexo nenhum, e um pouco mais escura no pé. Pedra, feltro, tinta de parede.' },
];

export const ACABAMENTO_PADRAO = 'solida';

const COM_ACABAMENTO = /^(metal|fosco)~([0-9a-f]{6})$/;

/*
 * As receitas. Cada uma e' UMA imagem — o `css` entra numa lista de tres camadas
 * de `background-image`, e uma virgula de topo a mais desmontaria a lista.
 */
const RECEITA = {
  /*
   * Sete paradas numa diagonal quase horizontal. O que le' como metal e' a
   * alternancia dura entre 1,35 e 0,62 — nao a cor, e nao o numero de paradas.
   */
  metal: (c) =>
    `linear-gradient(104deg, ${tom(c, 0.6)} 0%, ${tom(c, 0.92)} 17%, ${tom(c, 1.35)} 33%, ` +
    `${tom(c, 1.02)} 45%, ${tom(c, 0.66)} 61%, ${tom(c, 0.98)} 81%, ${tom(c, 1.22)} 100%)`,
  /*
   * Tres paradas e nenhuma acima de 1,05: o fosco e' a AUSENCIA de banda clara.
   * A queda para 0,82 no pe e' a sombra que qualquer superficie tem, e e' ela que
   * impede o resultado de parecer um erro de renderizacao.
   */
  fosco: (c) =>
    `linear-gradient(160deg, ${tom(c, 1.05)} 0%, ${tom(c, 0.93)} 54%, ${tom(c, 0.8)} 100%)`,
};

/*
 * O verniz do escudo — a camada de brilho que mora POR CIMA da pintura (ver
 * `.gb-escudo` em `desenhar-brasao.mjs`).
 *
 * Ela e' o que faz todo escudo parecer envernizado, e para o fosco isso seria uma
 * contradicao: a pintura diria "sem reflexo" e a camada de cima poria um reflexo
 * de volta. Entao o fosco troca o verniz por um quase nada.
 */
export const VERNIZ_FOSCO =
  'linear-gradient(157deg, #ffffff14 0%, #ffffff08 26%, #00000000 48%, #0000001f 82%, #00000033 100%)';

/** A cor livre com acabamento, com a cara de uma entrada do catalogo. */
export function corComAcabamento(valor) {
  if (typeof valor !== 'string') return null;
  const achado = COM_ACABAMENTO.exec(valor.trim().toLowerCase());
  if (!achado) return null;
  const [, acabamento, cru] = achado;
  const hex = '#' + cru;
  return {
    id: `${acabamento}~${cru}`,
    nome: `${hex.toUpperCase()} ${ACABAMENTOS.find((a) => a.id === acabamento).nome.toLowerCase()}`,
    coins: 0,
    css: RECEITA[acabamento](hex),
    livre: true,
    acabamento,
    hex,
  };
}

/** Escreve o valor guardado de uma cor com um acabamento. */
export function tintaComAcabamento(hex, acabamento) {
  if (!ehCorLivre(hex)) return hex;
  const limpo = String(hex).trim().toLowerCase();
  return acabamento && acabamento !== ACABAMENTO_PADRAO && RECEITA[acabamento]
    ? `${acabamento}~${limpo.slice(1)}`
    : limpo;
}

/** O acabamento de uma pintura — `null` quando ela nao aceita acabamento. */
export function acabamentoDe(valor) {
  const pronto = corComAcabamento(valor);
  if (pronto) return pronto.acabamento;
  /* Toda cor chapada esta em algum acabamento, e o dela e' o solido. */
  return hexDaPintura(valor) ? ACABAMENTO_PADRAO : null;
}

/**
 * O hex de uma pintura livre, com acabamento ou sem — `null` para o resto.
 *
 * E' o que a roda de cor pergunta para saber onde se por: ela nao sabe se por num
 * efeito (um degrade de doze paradas), mas um metalico E' um ponto do circulo com
 * uma receita em volta, e a roda tem de continuar funcionando nele.
 */
export function hexDaPintura(valor) {
  if (ehCorLivre(valor)) return String(valor).trim().toLowerCase();
  const pronto = corComAcabamento(valor);
  if (pronto) return pronto.hex;
  /*
   * ---- E AS CLASSICAS TAMBEM ----
   *
   * `'rubi'` e' uma cor chapada guardada por nome, e e' com ela que TODO brasao
   * novo nasce (o padrao sai do hash do nome). Sem esta linha, a fileira de
   * acabamento e a roda so' apareceriam depois de a pessoa mexer na cor uma vez —
   * e a pergunta "posso deixar meu escudo fosco?" ficaria sem resposta justamente
   * na tela recem-aberta.
   *
   * So' as de graca: um efeito pago tem `css` de degrade e nao e' um ponto do
   * circulo.
   */
  const posto = tintaPorId(valor);
  const css = String(posto?.css ?? '').trim().toLowerCase();
  return posto && !posto.coins && HEX.test(css) ? css : null;
}

export const corPorId = (id) =>
  (ehCorLivre(id)
    ? corLivre(id)
    : corComAcabamento(id) ?? efeitoTingido(id) ?? CORES.find((c) => c.id === id)) ?? null;

/* =========================================================================
 * DE UMA COR PARA UMA PINTURA — e isto custou um escudo invisivel
 *
 * O escudo pinta com `background-image`, porque um efeito e' um degrade. E
 * `background-image: #a8323c` NAO E' VALIDO: um hex nao e' uma imagem.
 *
 * O resultado nao era "a cor errada", era NADA: a propriedade inteira caia
 * (invalida no tempo do valor computado), o escudo ficava sem fundo, e a
 * mascara recortava o vazio. Escudo invisivel — e so' nas cores chapadas, que
 * eram justamente as de graca. Os efeitos, que ja sao degrades, apareciam.
 *
 * `linear-gradient(c, c)` e' a mesma cor chapada escrita como imagem.
 * ========================================================================= */
/*
 * As tres familias de degrade, com ou sem `repeating-`, mais `url()`. A lista
 * era escrita por extenso e faltava `repeating-conic-gradient` — o Raiado saiu
 * embrulhado num `linear-gradient(repeating-conic-gradient(...), ...)`, que nao
 * e' nada, e o escudo sumiu. E' o mesmo defeito do hex, por outra porta.
 */
const JA_E_IMAGEM = /^(?:(?:repeating-)?(?:linear|radial|conic)-gradient|url|image-set)\(/i;

export function pinturaDe(css) {
  const valor = String(css ?? '').trim();
  if (!valor) return 'linear-gradient(#3b4a4e, #161d20)';
  return JA_E_IMAGEM.test(valor) ? valor : `linear-gradient(${valor}, ${valor})`;
}

/*
 * A paleta do SIMBOLO e' a mesma das cores, mais o creme padrao na frente. O
 * creme nao entra em `CORES` para nao virar uma opcao de ESCUDO: um escudo cor
 * de osso ja existe (a cor `osso`), e duas entradas quase iguais na mesma
 * prateleira sao duas que ninguem sabe distinguir.
 */
export const TINTAS_DO_SIMBOLO = [
  { id: 'creme', nome: 'Creme', coins: 0, css: '#fff6de' },
  { id: 'carvao', nome: 'Carvão', coins: 0, css: '#1b2225' },
  ...CORES,
];

export const tintaPorId = (id) =>
  (ehCorLivre(id)
    ? corLivre(id)
    : corComAcabamento(id) ?? efeitoTingido(id) ?? TINTAS_DO_SIMBOLO.find((c) => c.id === id)) ??
  null;

/*
 * Nao ha' peneira separada para as letras: os tres campos leem a MESMA lista e
 * pagam pela mesma conta. Uma lista restrita para as letras era o que as
 * impedia de ter efeito, e foi isso que caiu.
 */

/** O caminho da arte de uma forma. `base` tem arquivo proprio; o resto e' a pasta nova. */
export function arteDaForma(id) {
  const forma = formaPorId(id) ?? formaPorId(FORMA_PADRAO);
  /* Sem forma nao ha' arte — quem desenha ve o `null` e nao monta a camada. */
  if (forma.vazia) return null;
  return forma.arquivo ?? `/client/assets/ui/brasao/forma-${forma.id}.png`;
}

/** O caminho da arte de um simbolo, ou `null` quando nao ha simbolo. */
export function arteDoSimbolo(id) {
  const s = simboloPorId(id);
  return s ? `/client/assets/ui/brasao/simbolo-${s.id}.png` : null;
}

/* =========================================================================
 * O BRASAO DE UMA GUILDA QUE NUNCA ESCOLHEU NADA
 *
 * As guildas que ja existem nao tem brasao guardado, e elas nao podem virar
 * todas iguais no dia em que esta tela entrar — hoje cada uma tem a cor dela,
 * tirada de um hash do nome, e essa cor ja e' como as pessoas as reconhecem na
 * tabela do servidor.
 *
 * Entao o padrao CONTINUA saindo do nome: o mesmo hash escolhe uma das doze
 * cores de graca. Quem nunca abrir a tela de brasao nao ve diferenca nenhuma —
 * e quem abrir ja encontra a cor atual dela selecionada, em vez de um formulario
 * em branco.
 * ========================================================================= */
/* =========================================================================
 * AS LETRAS QUE VAO NO ESCUDO
 *
 * O texto escolhido manda; sem ele, as iniciais do nome — as primeiras letras
 * das duas primeiras palavras, ou as duas primeiras letras de uma palavra so'.
 *
 * Mora aqui e nao no cliente porque o SITE desenha o mesmo escudo, e duas
 * copias desta regra dariam iniciais diferentes na mesma guilda em duas telas.
 * ========================================================================= */
export function iniciaisDoNome(nome) {
  const palavras = String(nome ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (palavras.length >= 2) return (palavras[0][0] + palavras[1][0]).toUpperCase();
  return String(nome ?? '??')
    .slice(0, 2)
    .toUpperCase();
}

/* =========================================================================
 * O `transform` DE UMA PECA QUE SE MOVE
 *
 * Mora aqui, e nao no desenho, porque o simbolo e as letras usam a MESMA conta:
 * andar em porcentagem e crescer por multiplicador. Duas copias dela dariam um
 * simbolo que anda de um jeito e uma letra que anda de outro.
 *
 * ---- POR QUE PORCENTAGEM, E NAO PIXEL ----
 *
 * O mesmo brasao e' desenhado a 13 pixels na linha do chat e a 180 na previa.
 * Um deslocamento em pixels acertaria um dos dois e erraria o outro — em
 * porcentagem, a peca anda a mesma FRACAO do escudo em qualquer tamanho, e o
 * desenho e' o mesmo em todos os lugares.
 *
 * Devolve `''` quando nada foi mexido, para o desenho nao pendurar um
 * `transform` inutil em todo escudo do jogo.
 * ========================================================================= */
export function jeitoDaPeca({ x, y, tamanho }) {
  const dx = presoEntre(x, LIMITE_DO_LUGAR);
  const dy = presoEntre(y, LIMITE_DO_LUGAR);
  const escala = presoEntre(tamanho, LIMITE_DO_TAMANHO) / 100;
  const partes = [];
  if (dx || dy) partes.push(`translate(${dx}%, ${dy}%)`);
  if (escala !== 1) partes.push(`scale(${escala})`);
  return partes.join(' ');
}

/** O que o escudo escreve: o texto escolhido, ou as iniciais do nome. */
export function letrasDoBrasao(brasao, nome) {
  return textoDasLetras(brasao?.texto) ?? iniciaisDoNome(nome);
}

export function digitosDoNome(nome) {
  let soma = 0;
  const texto = String(nome ?? '');
  for (let i = 0; i < texto.length; i++) soma = (soma * 31 + texto.charCodeAt(i)) >>> 0;
  return soma;
}

export function brasaoPadrao(nome) {
  return {
    forma: FORMA_PADRAO,
    /* =====================================================================
     * A FORMA TAMBEM SE MOVE E MUDA DE TAMANHO
     *
     * "o tamanho e posicionamento da forma tem que ser alteravel tambem (mas sem
     *  passar dos limites que quebrariam o modal)."
     *
     * Os limites sao os MESMOS do simbolo e das iniciais — `LIMITE_DO_TAMANHO` e
     * `LIMITE_DO_LUGAR` —, e e' isso que cumpre o "sem passar dos limites": as
     * reguas nao tem como devolver um valor fora da faixa, e a faixa esta escrita
     * num lugar so'. Uma faixa propria para a forma seria um segundo limite a
     * manter, e o dia em que os dois discordassem seria um escudo vazando da
     * janela.
     * ===================================================================== */
    formaTam: LIMITE_DO_TAMANHO.padrao,
    formaX: LIMITE_DO_LUGAR.padrao,
    formaY: LIMITE_DO_LUGAR.padrao,
    simbolo: null,
    cor: CORES_CLASSICAS[digitosDoNome(nome) % CORES_CLASSICAS.length].id,
    corSimbolo: TINTA_PADRAO_DO_SIMBOLO,
    simboloTam: LIMITE_DO_TAMANHO.padrao,
    simboloX: LIMITE_DO_LUGAR.padrao,
    simboloY: LIMITE_DO_LUGAR.padrao,
    corLetras: TINTA_PADRAO_DAS_LETRAS,
    fonte: FONTE_PADRAO,
    letras: true,
    /* =====================================================================
     * O HALO NASCE DESLIGADO
     *
     * "quando eu coloco os efeitos comprados, alem de aplicar o efeito no
     *  simbolo esta aplicando um contorno em volta da forma; isso como padrao
     *  nao pode acontecer, so se a pessoa quiser."
     *
     * Ele entrou para o efeito pago se ver na tabela do servidor, a 28 pixels,
     * onde toda pintura vira mancha — e isso continua valendo. O erro foi ligar
     * sozinho: quem compra o Ouro compra o ACABAMENTO, e ganhava de brinde um
     * contorno luminoso em volta do escudo inteiro que ninguem pediu.
     *
     * Agora e' uma escolha. Desligado, o efeito pinta a peca e mais nada.
     * ===================================================================== */
    halo: false,
    /* =====================================================================
     * O CONTORNO TEM COR PROPRIA, E `null` QUER DIZER "A DO ESCUDO"
     *
     * "a cor do contorno tem que ter opcao de escolher cor e efeitos tambem, e
     *  da' pra aplicar individualmente na forma, simbolo, letra."
     *
     * `null` e' um valor com sentido e nao a ausencia de um: ele diz "siga o
     * escudo". E' o que o contorno sempre fez — ele nasceu como o brilho da cor
     * do escudo —, e e' o padrao certo: quem liga o contorno sem pensar em cor
     * quer o contorno da cor que ja' escolheu.
     *
     * O dia em que isto virasse um hex de fabrica, todo contorno ligado passaria
     * a nascer com uma cor que ninguem pediu, e mudar a cor do escudo deixaria
     * de mudar a do contorno. Ver `corDoContorno`.
     * ===================================================================== */
    corContorno: null,
    /* =====================================================================
     * E O CONTORNO E' DE CADA PECA, E NAO DO BRASAO
     *
     * "so' faltou poder mudar o contorno do simbolo e das letras tambem, se
     *  quiser por contorno."
     *
     * O contorno nasceu como UM: um brilho em volta do conjunto, para o brasao
     * pago se ver a 28 pixels. Mas um brasao tem tres desenhos com silhueta
     * propria — a forma, o objeto e as letras —, e cada um deles pode querer o
     * seu: um leao creme contornado de cobalto e' heraldica classica, e nao
     * havia como pedir isso.
     *
     * ---- POR QUE UM PAR DE CAMPOS POR PECA, E NAO UM SO' ----
     *
     * Sao TRES estados e nao dois: desligado, ligado seguindo a peca, e ligado
     * com cor escolhida. O interruptor guarda o primeiro contra os outros dois,
     * e a cor distingue os dois ultimos — com `null` querendo dizer "siga",
     * exactamente como em `corContorno`.
     *
     * Um campo so' teria de inventar um valor de sentinela para o "siga", e um
     * dia alguem escolheria uma cor com esse nome.
     *
     * ---- E POR QUE O DA FORMA CONTINUA SE CHAMANDO `halo` ----
     *
     * Porque ele esta gravado assim no banco de todas as guildas que ligaram o
     * contorno. Renomear seria uma migracao para ganhar simetria de nome — e o
     * comentario custa menos do que a migracao.
     * ===================================================================== */
    contornoSimbolo: false,
    corContornoSimbolo: null,
    contornoLetras: false,
    corContornoLetras: null,
    /* `null` quer dizer "as iniciais do nome" — ver `letrasDoBrasao`. */
    texto: null,
    letrasTam: LIMITE_DO_TAMANHO.padrao,
    letrasX: LIMITE_DO_LUGAR.padrao,
    letrasY: LIMITE_DO_LUGAR.padrao,
    ordem: 'frente',
  };
}

/* =========================================================================
 * NORMALIZAR — o que chega do cliente nunca entra como veio
 *
 * Uma escolha desconhecida vira o padrao em vez de virar erro, e isso e'
 * deliberado: o caso comum de um id que nao existe nao e' fraude, e' uma versao
 * velha da tela pedindo uma forma que saiu do catalogo. Recusar ali deixaria o
 * jogador travado sem entender; cair no padrao o deixa seguir e ver o que
 * aconteceu.
 *
 * O que NAO cai no padrao e' o preco: quem pagar decide depois, olhando para o
 * brasao ja normalizado (ver `precoDoBrasao`).
 * ========================================================================= */
export function normalizarBrasao(bruto, nome) {
  const padrao = brasaoPadrao(nome);
  if (!bruto || typeof bruto !== 'object') return padrao;

  /*
   * A cor de um contorno: uma tinta, um ponteiro para outra peca, ou `null`.
   *
   * O `!== peca` e' a primeira das duas guardas do ciclo: uma peca que seguisse a
   * si mesma seria uma pergunta sem resposta. Ela volta ao padrao, que e' o que
   * todo valor invalido faz aqui.
   */
  const corDeContorno = (campo, peca) => {
    const segue = segueQualPeca(bruto[campo]);
    if (segue) return segue === peca ? null : `=${segue}`;
    return tintaPorId(bruto[campo])?.id ?? null;
  };

  return {
    forma: formaPorId(bruto.forma)?.id ?? padrao.forma,
    formaTam: presoEntre(bruto.formaTam, LIMITE_DO_TAMANHO),
    formaX: presoEntre(bruto.formaX, LIMITE_DO_LUGAR),
    formaY: presoEntre(bruto.formaY, LIMITE_DO_LUGAR),
    /*
     * A grossura E' o interruptor: `false` ou um dos tres degraus. `true` (o dado
     * de quem ligou o contorno antes de haver grossura) vira o medio.
     */
    halo: grossuraDoContorno(bruto.halo),
    simbolo: simboloPorId(bruto.simbolo)?.id ?? null,
    cor: corPorId(bruto.cor)?.id ?? padrao.cor,
    corSimbolo: tintaPorId(bruto.corSimbolo)?.id ?? padrao.corSimbolo,
    simboloTam: presoEntre(bruto.simboloTam, LIMITE_DO_TAMANHO),
    simboloX: presoEntre(bruto.simboloX, LIMITE_DO_LUGAR),
    simboloY: presoEntre(bruto.simboloY, LIMITE_DO_LUGAR),
    corLetras: tintaPorId(bruto.corLetras)?.id ?? padrao.corLetras,
    /*
     * O ID e nao a familia: o que chega do cliente nunca vira folha de estilo. Um
     * `font-family` cru daqui sairia escrito na tela de todo mundo que ve a guilda,
     * e `font-family` aceita bem mais coisa do que parece.
     */
    fonte: fontePorId(bruto.fonte)?.id ?? padrao.fonte,
    /*
     * Aqui o `?? null` NAO e' "cai no padrao": e' o proprio padrao. Uma cor de
     * contorno que nao exista mais no catalogo volta a seguir o escudo, que e'
     * o comportamento de quem nunca escolheu — e nao uma cor sorteada.
     */
    corContorno: corDeContorno('corContorno', 'forma'),
    /* Ausente e' desligado: e' o que faz todo brasao antigo continuar igual. */
    contornoSimbolo: grossuraDoContorno(bruto.contornoSimbolo),
    corContornoSimbolo: corDeContorno('corContornoSimbolo', 'simbolo'),
    contornoLetras: grossuraDoContorno(bruto.contornoLetras),
    corContornoLetras: corDeContorno('corContornoLetras', 'letras'),
    letras: bruto.letras !== false,
    texto: textoDasLetras(bruto.texto),
    letrasTam: presoEntre(bruto.letrasTam, LIMITE_DO_TAMANHO),
    letrasX: presoEntre(bruto.letrasX, LIMITE_DO_LUGAR),
    letrasY: presoEntre(bruto.letrasY, LIMITE_DO_LUGAR),
    /* Qualquer coisa que nao seja 'atras' e' 'frente' — inclusive o ausente. */
    ordem: bruto.ordem === 'atras' ? 'atras' : 'frente',
  };
}

/** Dois brasoes sao o mesmo desenho? */
export function mesmoBrasao(a, b) {
  return (
    !!a &&
    !!b &&
    a.forma === b.forma &&
    presoEntre(a.formaTam, LIMITE_DO_TAMANHO) === presoEntre(b.formaTam, LIMITE_DO_TAMANHO) &&
    presoEntre(a.formaX, LIMITE_DO_LUGAR) === presoEntre(b.formaX, LIMITE_DO_LUGAR) &&
    presoEntre(a.formaY, LIMITE_DO_LUGAR) === presoEntre(b.formaY, LIMITE_DO_LUGAR) &&
    (a.simbolo ?? null) === (b.simbolo ?? null) &&
    a.cor === b.cor &&
    (a.corSimbolo ?? TINTA_PADRAO_DO_SIMBOLO) === (b.corSimbolo ?? TINTA_PADRAO_DO_SIMBOLO) &&
    (a.corLetras ?? TINTA_PADRAO_DAS_LETRAS) === (b.corLetras ?? TINTA_PADRAO_DAS_LETRAS) &&
    (fontePorId(a.fonte)?.id ?? FONTE_PADRAO) === (fontePorId(b.fonte)?.id ?? FONTE_PADRAO) &&
    (a.corContorno ?? null) === (b.corContorno ?? null) &&
    grossuraDoContorno(a.contornoSimbolo) === grossuraDoContorno(b.contornoSimbolo) &&
    (a.corContornoSimbolo ?? null) === (b.corContornoSimbolo ?? null) &&
    grossuraDoContorno(a.contornoLetras) === grossuraDoContorno(b.contornoLetras) &&
    (a.corContornoLetras ?? null) === (b.corContornoLetras ?? null) &&
    (a.texto ?? null) === (b.texto ?? null) &&
    presoEntre(a.simboloTam, LIMITE_DO_TAMANHO) === presoEntre(b.simboloTam, LIMITE_DO_TAMANHO) &&
    presoEntre(a.simboloX, LIMITE_DO_LUGAR) === presoEntre(b.simboloX, LIMITE_DO_LUGAR) &&
    presoEntre(a.simboloY, LIMITE_DO_LUGAR) === presoEntre(b.simboloY, LIMITE_DO_LUGAR) &&
    grossuraDoContorno(a.halo) === grossuraDoContorno(b.halo) &&
    presoEntre(a.letrasTam, LIMITE_DO_TAMANHO) === presoEntre(b.letrasTam, LIMITE_DO_TAMANHO) &&
    presoEntre(a.letrasX, LIMITE_DO_LUGAR) === presoEntre(b.letrasX, LIMITE_DO_LUGAR) &&
    presoEntre(a.letrasY, LIMITE_DO_LUGAR) === presoEntre(b.letrasY, LIMITE_DO_LUGAR) &&
    (a.ordem === 'atras') === (b.ordem === 'atras') &&
    a.letras !== false === (b.letras !== false)
  );
}

/* =========================================================================
 * O CONTRASTE — "pouco contraste, pode sumir no chat"
 *
 * Um leao azul-cobalto num escudo azul-cobalto e' invisivel. Na previa de 150
 * pixels da' para ver o contorno do desenho e achar que esta bom; na linha do
 * chat, a 13 pixels, ele vira uma mancha de uma cor so'.
 *
 * ---- POR QUE LUMINANCIA, E NAO "DISTANCIA ENTRE AS CORES" ----
 *
 * Duas cores podem estar longe no circulo (um vermelho e um verde) e ainda assim
 * terem o mesmo BRILHO — e e' o brilho que desenha a forma quando a peca e'
 * pequena demais para o olho separar matizes. A conta e' a luminancia relativa da
 * WCAG, que e' a mesma que decide se um texto se le sobre um fundo.
 *
 * ---- E' AVISO, E NAO TRAVA ----
 *
 * Um escudo monocromatico e' uma escolha legitima — heraldica de uma cor so'
 * existe. O que nao pode e' a pessoa descobrir depois de fundar.
 * ========================================================================= */

/** A luminancia relativa (WCAG) de um `#rrggbb`, de 0 (preto) a 1 (branco). */
export function luminanciaDe(hex) {
  const cru = String(hex ?? '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(cru)) return null;
  const canal = (i) => {
    const v = parseInt(cru.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}

/**
 * A cor que uma pintura MOSTRA — o hex de uma cor chapada, ou o `brilho` de um
 * efeito.
 *
 * Um efeito e' um degrade de muitas paradas e nao tem "uma" cor; o `brilho` e' a
 * que o catalogo ja elegeu como a que manda nele (e' a que acende o contorno).
 */
export function corQueSeVe(valor) {
  const hex = hexDaPintura(valor);
  if (hex) return hex;
  const tinta = tintaPorId(valor);
  return tinta?.brilho ?? null;
}

/** Quao diferentes em brilho sao duas pinturas — 1 (iguais) a 21 (preto e branco). */
export function contrasteEntre(a, b) {
  const la = luminanciaDe(corQueSeVe(a));
  const lb = luminanciaDe(corQueSeVe(b));
  if (la == null || lb == null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/*
 * O piso. 1,6 e' baixo de proposito: nao se esta pedindo que o desenho seja
 * LEGIVEL como texto (a WCAG pede 4,5 para isso), e sim que ele nao suma. Abaixo
 * de 1,6 as duas pecas ja viram uma mancha so' num escudo de 13 pixels.
 */
export const CONTRASTE_MINIMO = 1.6;

/**
 * As pecas que estao sumindo no fundo — uma lista, possivelmente vazia.
 *
 * So' compara com a FORMA, que e' o fundo de todas as outras. Sem forma nao ha'
 * fundo com que comparar: o brasao fica sobre o que estiver atras dele na tela, e
 * isso muda de lugar para lugar.
 */
export function pecasSemContraste(brasao) {
  if (!brasao || brasao.forma === FORMA_NENHUMA) return [];
  const fundo = brasao.cor;
  const saida = [];
  if (brasao.simbolo) {
    const c = contrasteEntre(brasao.corSimbolo, fundo);
    if (c != null && c < CONTRASTE_MINIMO) saida.push({ peca: 'simbolo', nome: 'o símbolo', contraste: c });
  }
  if (brasao.letras !== false) {
    const c = contrasteEntre(brasao.corLetras, fundo);
    if (c != null && c < CONTRASTE_MINIMO) saida.push({ peca: 'letras', nome: 'as iniciais', contraste: c });
  }
  return saida;
}

/* =========================================================================
 * A CONTA
 *
 * Duas parcelas, e elas respondem a perguntas diferentes:
 *
 *   TROCA    50 coins, e so' depois que a guilda existe. Na fundacao e' de
 *            graca: cobrar para escolher o brasao na hora de criar seria
 *            cobrar para criar, e o pedido foi "DEPOIS de ja criada".
 *
 *   EFEITO   o preco da cor, e so' se a guilda ainda nao a tiver destravado.
 *            Vale tambem na fundacao: quem quer o Ouro no primeiro dia paga o
 *            Ouro, e nao a troca.
 *
 * Elas somam. Trocar o brasao para um efeito novo custa os dois — e a tela diz
 * as duas linhas separadas, porque "150 coins" sem explicacao parece erro.
 * ========================================================================= */
/* =========================================================================
 * AS QUATRO PINTURAS DE UM BRASAO — numa lista so'
 *
 * Escudo, contorno, simbolo e iniciais. Quem cobra (`precoDoBrasao`) e quem
 * destrava (`efeitosUsados`) leem ESTA lista, e a razao e' um defeito que essa
 * dupla ja teve: os dois liam os campos a mao, e no dia em que as iniciais
 * ganharam efeito uma das duas foi atualizada e a outra nao.
 *
 * A consequencia de discordarem e' cara e silenciosa: um campo que a conta cobra
 * e a lista nao destrava faz a guilda pagar o mesmo Ouro TODA vez que abre a
 * tela. Com uma lista so', elas nao tem como discordar.
 * ========================================================================= */
const pinturasDe = (brasao) => [
  brasao?.cor,
  brasao?.corContorno,
  brasao?.corSimbolo,
  brasao?.corContornoSimbolo,
  brasao?.corLetras,
  brasao?.corContornoLetras,
];

/* =========================================================================
 * A COR DO CONTORNO, RESOLVIDA
 *
 * `corContorno: null` quer dizer "siga o escudo", e e' aqui que essa frase se
 * transforma numa cor. A cadeia e' a MESMA que o desenho usava antes de o
 * contorno ter campo proprio, para os brasoes antigos nao mudarem de cara:
 *
 *   1. a cor escolhida para o contorno, se houver
 *   2. o efeito do escudo
 *   3. o efeito do simbolo (era o que valia quando so' o simbolo era pago)
 *   4. a cor chapada do escudo
 *
 * Devolve `null` quando nao ha' contorno a desenhar, e quem desenha ve o `null`
 * e nao monta a camada.
 * ========================================================================= */
/*
 * As tres pecas que podem ter contorno, e os campos de cada uma. Uma tabela e
 * nao tres `if`: a tela, o desenho e a conta leem daqui, e um `if` a mais num
 * dos tres seria uma peca com contorno num lugar e sem contorno no outro.
 */
/* =========================================================================
 * A GROSSURA DO CONTORNO
 *
 * "o contorno tem que ter opcao pra selecionar o tamanho da sombra sabe? ou se
 *  vai ser contorno fino etc."
 *
 * ---- TRES DEGRAUS COM NOME, E NAO UMA REGUA ----
 *
 * Uma regua de raio pediria a quem quer "um fio" que descobrisse em que numero
 * fica um fio, e o numero certo muda com o tamanho do brasao. "Fino", "Medio" e
 * "Grosso" sao a pergunta que a pessoa esta fazendo.
 *
 * ---- E ELES MORAM NO CAMPO DO INTERRUPTOR ----
 *
 * `halo` era `true`/`false`. Agora e' `false | 'fino' | 'medio' | 'grosso'` — a
 * grossura E' o interruptor, porque "quao grosso" e "tem ou nao" sao uma pergunta
 * so' com quatro respostas. Um campo de grossura a parte seria um terceiro campo
 * por peca (nove no total) guardando 'medio' em todos.
 *
 * O `true` gravado no banco de quem ja ligou o contorno vira o padrao — ver
 * `grossuraDoContorno`. Nenhuma migracao, e nenhum brasao muda de cara.
 *
 * ---- POR QUE A FORMA MEDE EM PIXEL E AS OUTRAS DUAS EM FRACAO ----
 *
 * Sao duas coisas diferentes com o mesmo nome. O da forma e' um BRILHO por fora
 * do escudo, e ele existe para se ver a 28 pixels, na tabela do servidor: o valor
 * dele e' cravado justamente para nao encolher junto com o brasao (5px era o
 * unico valor que havia, e continua sendo o medio).
 *
 * Os do simbolo e das letras sao LINHAS que acompanham uma silhueta. Uma linha
 * cravada acertaria um tamanho so': 5px a 28 pixels engoliria o leao inteiro.
 * ========================================================================= */
export const GROSSURAS = [
  { id: 'fino', nome: 'Fino', halo: '3px', fator: 0.022, piso: 0.8 },
  { id: 'medio', nome: 'Médio', halo: '5px', fator: 0.04, piso: 1.2 },
  { id: 'grosso', nome: 'Grosso', halo: '9px', fator: 0.075, piso: 2 },
];

export const GROSSURA_PADRAO = 'medio';

/**
 * A grossura guardada num campo de contorno — `false` quando nao ha' contorno.
 *
 * `true` e' o dado antigo: quem ligou o contorno antes de haver grossura fica com
 * o unico valor que existia, que e' o medio.
 */
export function grossuraDoContorno(valor) {
  if (valor === true) return GROSSURA_PADRAO;
  return GROSSURAS.find((g) => g.id === valor)?.id ?? false;
}

/** O raio, em CSS, do contorno de uma peca num brasao de `tamanho` pixels. */
export function raioDoContorno(grossura, tamanho, peca = 'forma') {
  const passo = GROSSURAS.find((g) => g.id === grossura) ?? GROSSURAS[1];
  if (peca === 'forma') return passo.halo;
  return `${Math.max(passo.piso, tamanho * passo.fator).toFixed(1)}px`;
}

export const PECAS_COM_CONTORNO = [
  /*
   * "em vez de estar escrito Escudo tem que estar escrito Forma."
   *
   * E' o nome da aba que escolhe a peca, e era o unico lugar da tela que a chamava
   * de outra coisa — duas palavras para o mesmo desenho.
   */
  { peca: 'forma', ligado: 'halo', cor: 'corContorno', nome: 'Forma' },
  { peca: 'simbolo', ligado: 'contornoSimbolo', cor: 'corContornoSimbolo', nome: 'Símbolo' },
  { peca: 'letras', ligado: 'contornoLetras', cor: 'corContornoLetras', nome: 'Iniciais' },
];

/* =========================================================================
 * UM CONTORNO PODE SEGUIR O DE OUTRA PECA
 *
 * "o contorno da forma, quando eu clico em simbolo, tem que ter seguir com a
 *  forma; e quando eu clicar em forma e o simbolo estiver com contorno, 'seguir
 *  com o simbolo', e etc pra letras tambem."
 *
 * O caso comum de tres contornos e' os tres da MESMA cor — e' o que parece
 * desenhado de proposito. Sem isto, mudar essa cor seria mudar em tres lugares, e
 * um esquecido deixaria o brasao com um contorno de cor solta.
 *
 * O valor guardado e' `=forma`, `=simbolo` ou `=letras`. Um ponteiro e nao uma
 * copia: mudar a cor da peca apontada muda as que a seguem, que e' justamente o
 * "seguir" — copiar exigiria repetir o gesto a cada mudanca.
 *
 * ---- O CICLO ----
 *
 * Ponteiros entre tres campos que o cliente escolhe abrem a porta para forma
 * seguir simbolo e simbolo seguir forma. Duas defesas, e as duas sao necessarias:
 *
 *   ao gravar    uma peca nao pode seguir a si mesma (`normalizarBrasao`)
 *   ao resolver  um conjunto de visitados corta a volta e cai na pintura da forma
 *
 * A primeira nao basta: A→B→A nao tem auto-referencia nenhuma. A segunda sozinha
 * bastaria, mas deixaria passar para o banco um brasao com um ciclo dentro, que
 * e' um dado que nao quer dizer nada.
 * ========================================================================= */
const SEGUE_OUTRA = /^=(forma|simbolo|letras)$/;

/** A peca que este valor de contorno segue — `null` quando ele nao segue ninguem. */
export const segueQualPeca = (valor) =>
  typeof valor === 'string' ? (SEGUE_OUTRA.exec(valor.trim().toLowerCase())?.[1] ?? null) : null;

/** A grossura do contorno de uma peca — `false` quando ela nao tem contorno. */
export function grossuraDaPeca(brasao, peca = 'forma') {
  const qual = PECAS_COM_CONTORNO.find((x) => x.peca === peca);
  return qual ? grossuraDoContorno(brasao?.[qual.ligado]) : false;
}

/*
 * A cor que um contorno usa quando nao escolheram nenhuma — o "siga o escudo".
 *
 * A cadeia e' a MESMA que o desenho usava antes de o contorno ter campo proprio,
 * e por isso os brasoes antigos nao mudam de cara:
 *
 *   1. o efeito do escudo
 *   2. o efeito do simbolo (era o que valia quando so' o simbolo era pago)
 *   3. a cor chapada do escudo
 *
 * Ela serve as TRES pecas, e nao so' a forma. Para o simbolo e para as letras a
 * escolha tambem e' a certa, por outro motivo: um contorno da cor da propria
 * peca seria invisivel — ele so' engrossaria o desenho. A cor do escudo e' a que
 * contrasta com um simbolo creme e com letras cremes, que e' como os dois nascem,
 * e um objeto claro contornado da cor do campo e' heraldica classica.
 */
function corPadraoDoContorno(brasao) {
  const doEscudo = tintaPorId(brasao?.cor);
  if (doEscudo?.coins) return doEscudo.brilho ?? doEscudo.css;
  const doSimbolo = tintaPorId(brasao?.corSimbolo);
  if (doSimbolo?.coins) return doSimbolo.brilho ?? doSimbolo.css;
  /* `hex` antes de `css` — ver a nota em `corQueOContornoTeria`. */
  return doEscudo?.hex ?? doEscudo?.css ?? null;
}

/**
 * A cor do contorno de UMA peca — `null` quando ela nao tem contorno.
 *
 * Quem desenha ve o `null` e nao monta o brilho, e quem mostra a bolinha na tela
 * pergunta pela cor mesmo com o contorno desligado (ver `corQueOContornoTeria`).
 */
export function corDoContornoDe(brasao, peca = 'forma') {
  const qual = PECAS_COM_CONTORNO.find((p) => p.peca === peca);
  if (!qual || !grossuraDoContorno(brasao?.[qual.ligado])) return null;
  return corQueOContornoTeria(brasao, peca);
}

/**
 * A cor que o contorno desta peca teria, ligado ou nao.
 *
 * Tres respostas possiveis, na ordem em que sao tentadas:
 *
 *   `=outra`    ela segue outra peca — a pergunta se repete naquela
 *   uma tinta   a cor escolhida (ou o `brilho` do efeito escolhido)
 *   `null`      ela segue a PINTURA da forma, que e' o padrao de fabrica
 */
export function corQueOContornoTeria(brasao, peca = 'forma') {
  /*
   * O conjunto de visitados e' a guarda do ciclo. Sem ele, forma→simbolo→forma
   * seria um laco infinito dentro de uma funcao que desenha cada brasao da tela.
   */
  const vistos = new Set();
  let atual = peca;
  while (atual && !vistos.has(atual)) {
    vistos.add(atual);
    const qual = PECAS_COM_CONTORNO.find((x) => x.peca === atual);
    if (!qual) break;
    const valor = brasao?.[qual.cor];
    const seguindo = segueQualPeca(valor);
    if (seguindo) {
      atual = seguindo;
      continue;
    }
    const propria = tintaPorId(valor);
    /*
     * `hex` antes de `css`: um contorno e' um `drop-shadow`, e `drop-shadow` quer
     * UMA cor. Uma pintura com acabamento (metalica, fosca) tem `css` de degrade e
     * derrubaria o filtro inteiro — mas ela guarda o hex de onde saiu, e e' ele que
     * serve aqui. Um efeito pago responde pelo `brilho`, pelo mesmo motivo.
     */
    if (propria) return propria.brilho ?? propria.hex ?? propria.css;
    break;
  }
  return corPadraoDoContorno(brasao);
}

/** O contorno da forma, que e' o que ja existia. */
export const corDoContorno = (brasao) => corDoContornoDe(brasao, 'forma');

export function precoDoBrasao(brasao, { jaExiste = true, destravados = [] } = {}) {
  const linhas = [];
  if (jaExiste) linhas.push({ o_que: 'Trocar o brasão', coins: CUSTO_DE_TROCAR });

  /*
   * ---- AS TRES PINTURAS PAGAM ----
   *
   * O efeito pode estar no escudo, no simbolo, nas iniciais, ou nos tres. Cada
   * um que ainda nao esteja destravado entra uma vez.
   *
   * `vistos` existe para o caso de a pessoa por o MESMO efeito em mais de um:
   * ali e' uma compra so'. Cobrar duas vezes o mesmo Ouro seria cobrar pela
   * repeticao em vez de pelo que se ganhou.
   *
   * Esta lista e' a MESMA de `efeitosUsados`, e tem de continuar sendo: se uma
   * cobrasse um campo que a outra nao destrava, a guilda pagaria o Ouro toda
   * vez que abrisse a tela.
   */
  const vistos = new Set(destravados);
  for (const id of pinturasDe(brasao)) {
    const tinta = tintaPorId(id);
    /*
     * `idDoEfeito` e nao `tinta.id`: com a engrenagem das duas cores, o valor
     * guardado carrega os tons (`partido~00ff00~0000ff`). Cobrando pelo valor
     * inteiro, cada troca de tom seria uma compra nova — a guilda pagaria 75
     * coins por mexer numa roda.
     */
    const chave = idDoEfeito(tinta);
    if (!tinta?.coins || vistos.has(chave)) continue;
    vistos.add(chave);
    linhas.push({ o_que: `Efeito ${tinta.nome}`, coins: tinta.coins, efeito: chave });
  }

  return { linhas, coins: linhas.reduce((s, l) => s + l.coins, 0) };
}

/** Os efeitos pagos que este brasao usa — os que o servidor tem de destravar. */
export function efeitosUsados(brasao) {
  const saida = [];
  for (const id of pinturasDe(brasao)) {
    const tinta = tintaPorId(id);
    const chave = idDoEfeito(tinta);
    if (tinta?.coins && !saida.includes(chave)) saida.push(chave);
  }
  return saida;
}
