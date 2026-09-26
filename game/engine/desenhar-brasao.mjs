/* =========================================================================
 * DESENHAR O BRASAO — o mesmo escudo no jogo e no site
 *
 * O catalogo (`brasao-de-guilda.mjs`) diz o que um brasao E'. Este arquivo diz
 * como ele se DESENHA, e mora ao lado dele pelo mesmo motivo: sao dois lados
 * lendo a mesma coisa.
 *
 *   o jogo   a janela de guildas, a cidade, o chat, o menu do botao direito
 *   o site   a tabela do ranking, quem esta online, a pagina do personagem
 *
 * Duas copias deste desenho seriam duas copias que um dia discordam — e a forma
 * dessa discordancia e' a pior possivel: a mesma guilda com dois escudos
 * diferentes, um em cada tela, e ninguem sabendo qual e' o certo.
 *
 * ---- O ESTILO VIAJA JUNTO ----
 *
 * As regras CSS estao aqui dentro, como texto, e sao injetadas num `<style>` na
 * primeira vez que alguem desenha. O jogo e o site tem folhas de estilo
 * diferentes; pendurar o desenho numa delas obrigaria a copiar na outra.
 *
 * ---- ELE NAO IMPORTA NADA DO CLIENTE ----
 *
 * Nem `el`, nem sprites, nem tooltip. O site nao carrega o cliente, e uma
 * importacao daqui para la' arrastaria o jogo inteiro para dentro de uma pagina
 * que so' quer um escudo de vinte pixels.
 * ========================================================================= */
import {
  CORES,
  TINTAS_DO_SIMBOLO,
  TINTA_PADRAO_DAS_LETRAS,
  arteDaForma,
  arteDoSimbolo,
  corPorId,
  tintaPorId,
  corDoContorno,
  corDoContornoDe,
  grossuraDaPeca,
  raioDoContorno,
  acabamentoDe,
  VERNIZ_FOSCO,
  fontePorId,
  FONTES,
  fonteDoBrasao,
  corQueSeVe,
  pinturaDe,
  letrasDoBrasao,
  tamanhoDasLetras,
  jeitoDaPeca,
  normalizarBrasao,
  brasaoPadrao,
} from './brasao-de-guilda.mjs';

export const ESTILO_DO_BRASAO = `/* =========================================================================
 * O BRASÃO
 *
 * Desenhado do nome (ver \`brasaoDe\`, no \`guildas.mjs\`). A forma é um escudo —
 * \`border-radius\` com quatro raios diferentes faz a ponta de baixo sem
 * \`clip-path\`, que serrilha em tela normal.
 *
 * O \`--brasao-giro\` no degradê é o que impede duas guildas de matiz parecida de
 * saírem idênticas: a cor pode repetir, a direção da luz não.
 * ========================================================================= */
/* =========================================================================
 * O BRASÃO — uma CAIXA de camadas, e não um elemento só
 *
 * Camadas, de baixo para cima:
 *
 *   .gb-simbolo.atras   o objeto MAIOR que o escudo, saindo pelas beiradas
 *   .gb-escudo          a forma, mascarada, pintada com a cor da guilda
 *   .gb-simbolo.dentro  o objeto dentro do contorno
 *   .gb-letras          as duas iniciais
 *
 * A caixa NÃO tem máscara. Isso é o que permite o símbolo de trás existir: o
 * que está dentro de um elemento mascarado é recortado por ele, e as pontas
 * das espadas saindo por fora do escudo são justamente o desenho.
 *
 * A sombra é \`drop-shadow\` na caixa e não \`box-shadow\`: depois das máscaras o
 * conjunto já não é um retângulo, e \`box-shadow\` desenharia a sombra do
 * retângulo que ele deixou de ser.
 * ========================================================================= */
/*
 * ---- \`display: block\`, e NAO grid — isto custou um escudo invisivel ----
 *
 * A caixa era \`display: grid; place-items: center\`, herdado de quando ela era o
 * proprio escudo e as iniciais eram o conteudo dela. Com as camadas, os filhos
 * passaram a ser ABSOLUTOS e sem conteudo nenhum — e aí o grid os matou.
 *
 * A regra: um filho absoluto de um container grid com \`justify-items: center\`
 * herda \`justify-self: center\`, e um bloco absoluto com \`width: auto\` e
 * alinhamento que nao seja \`stretch\` encolhe para caber no conteudo. Sem
 * conteudo, isso e' largura ZERO. \`inset: 0\` nao salva: ele so define o bloco
 * que contem, e o alinhamento decide o tamanho dentro dele.
 *
 * O sintoma foi exato: as letras apareciam (elas TEM conteudo) e o escudo e o
 * simbolo nao. Em bloco, \`inset: 0\` com \`width: auto\` estica, que e' o que se
 * quer. Quem centraliza as letras agora e' o proprio \`.gb-letras\`.
 */
.guilda-brasao {
  flex: none;
  position: relative;
  display: block;
  color: #fff3d6;
  font-family: var(--font-title); font-weight: 700; letter-spacing: .02em;
  user-select: none;
  filter: drop-shadow(0 2px 4px #0009);
}

/*
 * ---- O HALO DO EFEITO PAGO ----
 *
 * O acabamento (o metal em bandas, as veias do sangue) só se lê de perto. Na
 * tabela do servidor o brasão tem 28 pixels, e a 28 pixels toda pintura vira
 * uma mancha de cor — foi por isso que o efeito pago parecia cor chapada.
 *
 * O halo resolve na escala em que o problema existe: um brilho da cor do
 * efeito, em volta do contorno, que nenhuma cor da roda tem. É \`drop-shadow\` e
 * não \`box-shadow\` porque depois das máscaras o conjunto já não é um retângulo.
 */
.guilda-brasao.com-efeito {
  filter:
    drop-shadow(0 2px 4px #0009)
    drop-shadow(0 0 var(--raio-forma, 5px) var(--brasao-brilho, transparent));
}

/* =========================================================================
 * O MODO ÍCONE — o brasão a treze pixels
 *
 * "abaixo de ~20px o desenhista usa um modo ícone: forma com cor sólida, símbolo
 *  por cima, contorno 1px mais forte, e SEM iniciais."
 *
 * ---- POR QUE UM DESENHO DIFERENTE, E NAO O MESMO MENOR ----
 *
 * O escudo cheio tem quatro camadas: verniz, relevo, pintura e, por cima, o
 * símbolo e duas letras. A treze pixels isso não encolhe — vira média. O degradê
 * de catorze bandas do Ouro ocupa menos de um pixel por banda e o olho soma tudo
 * num cinza; as letras, com um pixel de altura por traço, viram uma mancha sobre
 * o símbolo, que já é a coisa que dava para reconhecer.
 *
 * O modo ícone joga fora o que não sobrevive a essa escala e reforça o que
 * sobrevive: UMA cor chapada, UM desenho grande em cima, e um contorno escuro que
 * separa o conjunto do fundo — que na cidade é um mapa cheio de textura.
 *
 * ---- O CONTORNO E' DUAS SOMBRAS DE UM PIXEL ----
 *
 * Uma só é um esfumado; duas do mesmo raio saturam o alfa junto da silhueta e
 * viram linha. Ele substitui a sombra suave do brasão grande, que a treze pixels
 * só embaçava a beirada.
 * ========================================================================= */
.guilda-brasao.icone {
  filter:
    drop-shadow(0 0 1px #000000e6)
    drop-shadow(0 0 1px #000000e6);
}
/*
 * O símbolo ocupa mais do escudo do que ocuparia no desenho grande. A margem que
 * existe para ele não encostar no contorno vale a 120 pixels; a treze ela é um
 * terço do desenho, e o que sobra do leão não é um leão.
 */
.guilda-brasao.icone .gb-simbolo.dentro { inset: 9% 11% 13%; opacity: 1; }
.guilda-brasao.icone.sem-forma .gb-simbolo.dentro { inset: 0; }
/* O de trás deixa de sair pelas beiradas: a treze pixels isso é serrilha. */
.guilda-brasao.icone .gb-simbolo.atras { inset: -4% -6%; opacity: 1; filter: none; }

.guilda-brasao > span,
.guilda-brasao > b { position: absolute; }

/* ---- A forma, com a pintura ---- */
.gb-escudo {
  inset: 0;
  /*
   * ---- TRÊS camadas, e a do meio é \`multiply\` e não \`overlay\` ----
   *
   * De cima para baixo: o brilho (CSS), o relevo (a arte), a pintura.
   *
   * A arte das formas é BRANCA — branco puro, sem quase nenhum cinza (o escudo
   * clássico tem o rebordo e os rebites em cinza claríssimo, e o resto é
   * chapado). E \`overlay\` com branco não é uma mistura: é um apagamento. A
   * fórmula do overlay com fonte 1 devolve 1 para todo backdrop acima de 0,5 e
   * o dobro do backdrop abaixo dela — ou seja, um rubi \`#a8323c\` saía rosa
   * lavado \`#ff667a\`. A cor escolhida nunca era a cor mostrada.
   *
   * \`multiply\` com branco devolve o backdrop INTACTO. A cor sai exatamente a
   * que se apontou na roda, e o cinza do rebordo continua fazendo sombra — que
   * era a única coisa que a arte tinha para dar.
   *
   * O brilho que o \`overlay\` dava de graça voltou como camada própria, em
   * branco e preto translúcidos: assim ele acende e escurece sem mexer no tom.
   *
   * Os padrões nas variáveis mantêm de pé qualquer escudo desenhado por uma
   * tela que ainda não aprendeu a mandá-las: sem eles, a máscara recorta tudo e
   * o brasão sai invisível.
   */
  /*
   * A primeira camada — o VERNIZ — virou variavel por causa do acabamento fosco.
   * Ela e' o brilho que faz todo escudo parecer envernizado, e num fosco isso
   * seria uma contradicao: a pintura diria "sem reflexo" e a camada de cima poria
   * o reflexo de volta. O padrao aqui e' o verniz de sempre, e quem desenha o
   * troca por \`VERNIZ_FOSCO\` quando a pintura pede.
   */
  background-image:
    var(--brasao-verniz, linear-gradient(157deg, #ffffff5e 0%, #ffffff1f 24%, #00000000 47%, #0000002b 80%, #00000047 100%)),
    var(--brasao-forma, url('/client/assets/ui/guilda-brasao-base.webp')),
    var(--brasao-pintura, linear-gradient(135deg, #3b4a4e, #161d20));
  background-size: 100% 100%, 100% 100%, 100% 100%;
  background-position: center, center, center;
  background-repeat: no-repeat, no-repeat, no-repeat;
  background-blend-mode: normal, multiply, normal;
  -webkit-mask-image: var(--brasao-forma, url('/client/assets/ui/guilda-brasao-base.webp'));
  mask-image: var(--brasao-forma, url('/client/assets/ui/guilda-brasao-base.webp'));
  -webkit-mask-size: 100% 100%; mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
}

/* =========================================================================
 * O CONTORNO DE CADA PECA
 *
 * "poder mudar o contorno do simbolo e das letras tambem, se quiser por
 *  contorno."
 *
 * O contorno era um so' — um brilho em volta do conjunto (ver \`.com-efeito\`).
 * Agora a forma, o objeto e as letras tem cada um o seu, e os tres se desenham
 * pela mesma tecnica: \`drop-shadow\` sem deslocamento.
 *
 * ---- POR QUE \`drop-shadow\` E NAO \`outline\` OU \`border\` ----
 *
 * O objeto e as letras nao sao retangulos. \`outline\` e \`border\` desenham a
 * beirada da CAIXA, e a caixa do leao e' um quadrado invisivel — sairia um
 * quadrado contornado com um leao dentro.
 *
 * \`drop-shadow\` segue o ALFA do que ja foi desenhado: no objeto isso e' a
 * mascara (a silhueta exata), nas letras e' o glifo. E' o unico jeito de
 * contornar um desenho em vez de uma caixa.
 *
 * ---- DUAS SOMBRAS IGUAIS, E NAO UMA ----
 *
 * Uma passada de \`drop-shadow\` e' um esfumado, e esfumado nao le' como
 * contorno: o alfa cai suave e a beirada fica indefinida. Empilhando duas do
 * mesmo raio, a segunda soma sobre o resultado da primeira, o alfa perto da
 * silhueta satura e o que sobra e' uma linha.
 *
 * ---- O RAIO E' PROPORCIONAL, E ELE TEM DE SER ----
 *
 * O mesmo escudo e' desenhado a 28 pixels na tabela do servidor e a 150 na
 * previa. Um raio cravado acertaria um dos dois: 5px a 28 engoliria o simbolo
 * inteiro, e 1px a 150 seria um fio invisivel. \`--contorno-raio\` vem de quem
 * desenha, calculado do tamanho.
 *
 * ---- O DO SIMBOLO MORA NUM ENVELOPE, E NAO NO SIMBOLO ----
 *
 * Isto nao e' arrumacao: e' a unica forma de ele aparecer. Num MESMO elemento, o
 * navegador aplica \`filter\` PRIMEIRO e \`mask\` depois — essa e' a ordem da
 * especificacao (filtro, corte, mascara, opacidade, mistura). O simbolo e' um
 * retangulo pintado recortado por mascara, entao um \`drop-shadow\` nele geraria o
 * brilho e, no passo seguinte, a mascara recortaria FORA justamente o brilho: o
 * contorno existiria e nao se veria nunca.
 *
 * Num elemento de fora, a mascara do filho ja aconteceu quando o filtro do pai
 * roda. O que o pai filtra e' a silhueta pronta — que e' exatamente o que se quer
 * contornar.
 *
 * (E' o mesmo motivo por que a sombra escura de \`.gb-simbolo.atras\` nunca
 * apareceu. Ela fica onde esta: fazer surgir uma sombra em todo brasao antigo do
 * modo "atras" e' outra conversa, e nao esta e' a hora de mudar o desenho de quem
 * nao pediu nada.)
 * ========================================================================= */
.gb-simbolo-cerca { position: absolute; inset: 0; pointer-events: none; }
.gb-simbolo-cerca.com-contorno {
  filter:
    drop-shadow(0 0 var(--raio-simbolo, 2px) var(--contorno-simbolo, transparent))
    drop-shadow(0 0 var(--raio-simbolo, 2px) var(--contorno-simbolo, transparent));
}
.gb-letras-texto.com-contorno {
  filter:
    drop-shadow(0 0 var(--raio-letras, 2px) var(--contorno-letras, transparent))
    drop-shadow(0 0 var(--raio-letras, 2px) var(--contorno-letras, transparent));
}

/* ---- O objeto ---- */
/*
 * \`position: absolute\` escrito aqui e nao herdado de \`.guilda-brasao > span\`:
 * com contorno o simbolo deixa de ser filho direto da caixa (ele entra no
 * envelope, acima) e aquela regra para de o alcancar. Sem isto ele voltaria a ser
 * um bloco no fluxo, e o escudo sairia com um retangulo vazio empurrando tudo.
 */
.gb-simbolo {
  position: absolute;
  background: var(--brasao-tinta, #fff6de);
  -webkit-mask-image: var(--brasao-simbolo, none);
  mask-image: var(--brasao-simbolo, none);
  -webkit-mask-size: contain; mask-size: contain;
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
  -webkit-mask-position: center; mask-position: center;
  pointer-events: none;
}
/*
 * DENTRO: em porcentagem, e não em pixels. O mesmo escudo é desenhado a 13px
 * na linha do chat e a 120px na prévia, e uma margem cravada acertaria um dos
 * dois. As formas estreitas (lâmina, losango) sobram de propósito — o símbolo
 * encolhe junto com o vão em vez de vazar.
 */
.gb-simbolo.dentro { inset: 16% 18% 20%; opacity: .92; }
/*
 * Sem escudo nao ha' contorno para caber dentro: a margem que existia para o
 * simbolo nao encostar na beirada do escudo vira espaco perdido, e o simbolo
 * sai pequeno no meio do nada. Colado nas beiradas, ele ocupa o lugar que o
 * escudo ocupava — que e' o que se quer ao tirar o escudo.
 */
.guilda-brasao.sem-forma .gb-simbolo.dentro { inset: 2% 2% 4%; }
/*
 * ATRÁS: maior que a caixa, e é por isso que ele aparece. A sombra própria o
 * separa do escudo — sem ela, símbolo e escudo da mesma cor viram uma mancha
 * só, que é o risco deste modo.
 */
.gb-simbolo.atras {
  inset: -14% -18%;
  opacity: .95;
  filter: drop-shadow(0 0 2px #000000b3);
}

/* =========================================================================
 * AS INICIAIS — e o símbolo que MUDAVA DE COR quando elas entravam
 *
 * "se eu colocar um símbolo animal e depois colocar as letras por cima, a cor
 *  do símbolo está mudando; arrume isso."
 *
 * Estava mesmo. Havia uma regra aqui que punha o símbolo de dentro a 34% de
 * opacidade quando as iniciais ligavam — ele virava marca d'água para as letras
 * lerem por cima. Só que opacidade não é sutileza: a 34% o leão escolhido
 * escarlate sai rosa-desbotado sobre o escudo, e quem escolheu a cor vê a cor
 * mudar sozinha ao mexer numa opção que não era de cor nenhuma.
 *
 * A regra saiu. O símbolo fica na cor que se escolheu, ligando ou desligando as
 * letras.
 *
 * ---- E COMO AS LETRAS CONTINUAM LEGÍVEIS ----
 *
 * Por conta própria, e não apagando o vizinho: elas têm tinta própria (a roda
 * de "Cor das iniciais") e um contorno escuro em volta — quatro sombras de um
 * pixel formando a borda, mais as duas sombras difusas que já havia.
 *
 * O contorno é a peça-chave: sobre um símbolo claro a letra clara sumiria, e é
 * a borda escura que a segura. Sobre um símbolo escuro quem segura é a própria
 * letra clara. Uma das duas sempre contrasta — e, se o gosto pedir outra
 * coisa, a roda está ali.
 * ========================================================================= */
.gb-letras {
  inset: 0;
  display: grid; place-items: center;
}
.gb-letras-texto {
  color: var(--brasao-letras, #fff3d6);
  text-shadow:
    1px 0 0 #000000b3, -1px 0 0 #000000b3, 0 1px 0 #000000b3, 0 -1px 0 #000000b3,
    0 1px 3px #000000cc, 0 0 7px #000000a6;
}

/* =========================================================================
 * AS INICIAIS COM EFEITO PAGO
 *
 * "tem que ter como pôr os efeitos especiais nas letras também."
 *
 * Um degradê não pinta texto por \`color\` — \`color\` só aceita uma cor. Quem
 * pinta é um FUNDO recortado pelo desenho das letras: \`background-clip: text\`
 * com \`color: transparent\`, e o ouro aparece dentro dos glifos.
 *
 * ---- O CONTORNO TROCA DE TÉCNICA JUNTO ----
 *
 * \`text-shadow\` desenha ATRÁS do glifo. Com o glifo transparente, a sombra
 * apareceria por dentro dele e a letra sairia embaçada de preto em vez de
 * dourada. Por isso as pintadas trocam a sombra por \`filter: drop-shadow\`, que
 * age sobre o resultado JÁ recortado — o contorno fica em volta da letra, que
 * é onde ele sempre devia estar.
 * ========================================================================= */
.gb-letras-texto.pintada {
  color: transparent;
  background-image: var(--brasao-letras-img, none);
  background-size: 100% 100%;
  background-repeat: no-repeat;
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: none;
  filter: drop-shadow(0 1px 1px #000000d9) drop-shadow(0 0 2px #000000b3);
}
/*
 * A letra PINTADA tem o glifo transparente, e por isso o contorno escuro dela ja
 * e' \`filter\` e nao \`text-shadow\`. Somar o contorno de cor exige reescrever a
 * lista inteira, pelo mesmo motivo do simbolo de tras.
 */
.gb-letras-texto.pintada.com-contorno {
  filter:
    drop-shadow(0 1px 1px #000000d9)
    drop-shadow(0 0 var(--raio-letras, 2px) var(--contorno-letras, transparent))
    drop-shadow(0 0 var(--raio-letras, 2px) var(--contorno-letras, transparent));
}
.gb-letras-texto.pintada.anima {
  background-size: 300% 100%;
  animation: brasao-fogo-liso 5s linear infinite;
}

/* =========================================================================
 * O EFEITO QUE SE MEXE
 *
 * Só o \`fogo-vivo\` tem \`anima: true\` no catálogo, e é o mais caro justamente
 * por isso: é o único que chama o olho de quem não estava olhando.
 *
 * No escudo, a PRIMEIRA camada (o relevo) fica parada e só a pintura corre —
 * senão o chanfro andaria junto e o escudo pareceria deslizar por baixo da
 * própria moldura.
 * ========================================================================= */
@keyframes brasao-fogo {
  0% { background-position: center, center, 0% 50%; }
  100% { background-position: center, center, 100% 50%; }
}
@keyframes brasao-fogo-liso {
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}

.gb-escudo.anima {
  background-size: 100% 100%, 100% 100%, 300% 100%;
  animation: brasao-fogo 5s linear infinite;
}
.gb-simbolo.anima {
  background-size: 300% 100%;
  animation: brasao-fogo-liso 5s linear infinite;
}
/* =========================================================================
 * O NOME DA GUILDA NA FONTE DELA
 *
 * "a fonte escolhida no editor tem que valer também para o NOME da guilda."
 *
 * A familia vem do \`style\` de cada no' (ver \`vestirNomeDaGuilda\`) e o que esta'
 * regra faz e' o resto: garantir que a troca de familia nao quebre a linha.
 *
 * ---- POR QUE A RETICENCIA E' OBRIGATORIA AQUI ----
 *
 * "conferir que nenhuma fonte (principalmente Pesada e Decorativa) estoura a
 *  linha; nome longo corta com reticências."
 *
 * As seis familias tem larguras bem diferentes na MESMA altura de letra: a Cinzel
 * Decorative e' uma capitular romana larga, a Impact e' condensada, a monoespacada
 * da' a mesma largura a toda letra. Um nome que caberia na fonte padrao pode passar
 * um terco da caixa na Decorativa — e numa linha de lista isso empurra os pontos e
 * o botao para fora.
 *
 * Por isso a fonte e o corte andam JUNTOS, na mesma funcao: nao ha' como pintar o
 * nome com a familia da guilda e esquecer o corte, porque e' um gesto so'.
 *
 * ---- E O TAMANHO NAO MUDA ----
 *
 * "onde o espaço é pequeno (linhas de lista, menu), manter o tamanho de letra
 *  atual; só a família muda."
 *
 * Nao ha' \`font-size\` nenhum aqui de proposito: cada lugar mantem o seu. O que a
 * fonte muda e' a cara do nome, e nao o espaco que ele ocupa na tela.
 */
.guilda-nome-fonte {
  min-width: 0; max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Quem pediu menos movimento não leva um brasão piscando na lista de membros. */
@media (prefers-reduced-motion: reduce) {
  .gb-escudo.anima { animation: none; background-size: 100% 100%, 100% 100%, 100% 100%; }
  .gb-simbolo.anima { animation: none; background-size: 100% 100%; }
  .gb-letras-texto.pintada.anima { animation: none; background-size: 100% 100%; }
}

`;

const MARCA = 'estilo-do-brasao';

/**
 * Poe o estilo na pagina, uma vez so'.
 *
 * O `id` e' a guarda: chamar isto mil vezes (uma por escudo desenhado) nao pode
 * encher o `<head>` de folhas iguais.
 */
export function garantirEstiloDoBrasao(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById?.(MARCA)) return;
  const folha = doc.createElement('style');
  folha.id = MARCA;
  folha.textContent = ESTILO_DO_BRASAO;
  doc.head.append(folha);
}

/* =========================================================================
 * VESTIR O NOME DA GUILDA
 *
 * "onde o nome da guilda aparece com a fonte: janela de guildas (card da Minha
 *  Guilda, pódio, lista do servidor), menu do jogador, chat e site (/guildas,
 *  ficha da guilda, Top 5, ranking, online, ficha do personagem)."
 *
 * Sao onze lugares em quatro arquivos, e por isso isto e' uma funcao e nao uma
 * linha repetida onze vezes: `no.style.fontFamily = fonteDoBrasao(b)` esquecido em
 * um deles seria uma guilda com duas caras no mesmo jogo, e o lugar esquecido seria
 * justamente o que ninguem olha.
 *
 * Ela faz DUAS coisas de propósito — a familia e o corte com reticencias. Ver a
 * nota da `.guilda-nome-fonte`, no estilo: trocar a familia sem garantir o corte e'
 * o defeito que a Decorativa e a Pesada produzem numa linha de lista.
 *
 * `brasao` pode ser nulo (guilda antiga, sem o campo): ai' `fonteDoBrasao` devolve
 * a fonte padrao, que e' a de sempre — "guildas antigas sem o campo usam a fonte
 * padrao atual".
 *
 * Devolve o proprio no', para caber num `append`.
 * ========================================================================= */
export function vestirNomeDaGuilda(no, brasao, doc = no?.ownerDocument) {
  if (!no) return no;
  garantirEstiloDoBrasao(doc ?? globalThis.document);
  no.style.fontFamily = fonteDoBrasao(brasao ?? null);
  /* `classList.add` e nao `className =`: o no' quase sempre ja' tem classe. */
  no.classList?.add('guilda-nome-fonte');
  return no;
}

/** O mesmo `el` de sempre, em miniatura — para nao importar nada do cliente. */
const criar = (doc, tag, classe, texto) => {
  const no = doc.createElement(tag);
  if (classe) no.className = classe;
  if (texto != null) no.textContent = texto;
  return no;
};

/*
 * A classe de MOVIMENTO de uma tinta: o degrade e' maior que a peca e escorrega
 * por baixo dela. Numa funcao so' para as quatro camadas que pintam (escudo,
 * simbolo, letras e a amostra da prateleira) nao discordarem.
 */
export const movimentoDe = (tinta, icone = false) =>
  /*
   * No icone NADA se mexe, e nao e' so' economia de tela: a pintura ali e' uma cor
   * chapada (ver `corQueSeVe`), entao a animacao arrastaria um degrade de uma cor
   * so' — trabalho de composicao a cada quadro para um resultado que nao muda.
   *
   * E a cidade cheia tem dezenas destas etiquetas ao mesmo tempo.
   */
  (!icone && tinta?.anima ? ' anima' : '');

/* =========================================================================
 * O ESCUDO, EM CAMADAS
 *
 * De baixo para cima:
 *
 *   .gb-simbolo.atras   o objeto MAIOR que o escudo, saindo pelas beiradas
 *   .gb-escudo          a forma, mascarada, pintada com a cor da guilda
 *   .gb-simbolo.dentro  o objeto dentro do contorno
 *   .gb-letras          as iniciais
 *
 * A caixa de fora NAO tem mascara, e e' isso que permite o simbolo de tras
 * existir: o que esta' dentro de um elemento mascarado e' recortado por ele, e
 * as pontas das espadas saindo por fora do escudo sao justamente o desenho.
 * ========================================================================= */
/* =========================================================================
 * ABAIXO DESTE TAMANHO, O BRASAO VIRA ICONE
 *
 * Vinte pixels de largura. O numero saiu de onde o desenho cheio para de
 * funcionar: com vinte, o vao interno do escudo tem uns catorze pixels, e duas
 * letras com o corpo delas (0,38) dao sete — ja' no limite do que se le. Abaixo
 * disso as letras deixam de ser letras antes de qualquer outra coisa quebrar.
 *
 * Os tamanhos do jogo caem dos dois lados de proposito: o chat e a etiqueta da
 * cidade usam 13 (icone), a tabela do servidor usa 40 e o pódio 86 (cheio).
 * ========================================================================= */
export const LIMITE_DO_ICONE = 20;

/**
 * Desenha o brasao.
 *
 * `opcoes.icone` forca o modo icone em qualquer tamanho — e' o que a previa "como
 * aparece no chat" do editor usa para mostrar o resultado ampliado.
 */
export function desenharBrasao(doc, nome, tamanho = 44, escolha = null, opcoes = {}) {
  garantirEstiloDoBrasao(doc);

  /*
   * `escolha` nula quer dizer "esta guilda nunca abriu a tela do brasao" — e
   * `brasaoPadrao` responde por ela com a MESMA cor que o hash do nome dava
   * antes desta tela existir. E' o que faz as guildas antigas continuarem
   * identicas, e o que faz esta funcao nunca desenhar um buraco quando a
   * etiqueta vem de uma tela que ainda nao aprendeu a mandar o brasao.
   */
  const b = normalizarBrasao(escolha ?? brasaoPadrao(nome), nome);
  const cor = corPorId(b.cor) ?? CORES[0];
  const tinta = tintaPorId(b.corSimbolo) ?? TINTAS_DO_SIMBOLO[0];
  const tintaDasLetras = tintaPorId(b.corLetras) ?? { css: TINTA_PADRAO_DAS_LETRAS };
  const arte = arteDoSimbolo(b.simbolo);
  const formaArte = arteDaForma(b.forma);
  const atras = !!arte && b.ordem === 'atras';

  /* =======================================================================
   * ---- INTEIRO, E SO' INTEIRO ----
   *
   * "nada de tamanhos fracionados."
   *
   * Uma largura de 13,5px poe o escudo em meio pixel de tela: a mascara e' redimen-
   * sionada para um retangulo nao inteiro e a beirada sai com uma fileira de pixels
   * meio transparentes — que a treze pixels e' um decimo do desenho borrado.
   *
   * A altura sai da largura pela mesma conta de sempre (1,12), tambem arredondada,
   * e o corpo da fonte idem — ja era.
   *
   * (Nao ha' canvas nenhum aqui: o brasao e' feito de elementos com mascara, e
   * quem cuida da densidade de tela e' o navegador. O que cabe a este arquivo e'
   * nao pedir um tamanho que nao existe em pixels.)
   * ======================================================================= */
  const largura = Math.max(1, Math.round(tamanho));

  /*
   * O modo icone: escolhido pelo tamanho, ou forcado por quem desenha (a previa do
   * editor). Ver `LIMITE_DO_ICONE`.
   */
  const icone = opcoes.icone ?? largura < LIMITE_DO_ICONE;

  const classes = ['guilda-brasao'];
  if (icone) classes.push('icone');
  /*
   * ---- NO ICONE, AS LETRAS SO' ENTRAM SE NAO HOUVER SIMBOLO ----
   *
   * "e SEM iniciais. Se nao houver simbolo, ai sim mostra as iniciais — mas so' a
   *  primeira letra."
   *
   * As duas coisas empilhadas a treze pixels se destroem: a letra cobre o meio do
   * simbolo, que e' onde ele tem desenho. Uma das duas tem de sair, e a que fica e'
   * a que se reconhece mais rapido — um leao se identifica de relance, duas letras
   * de um pixel de traço nao.
   */
  const comLetras = icone ? b.letras && !arte : b.letras;
  if (comLetras) classes.push('com-letras');
  if (atras) classes.push('simbolo-atras');
  /* Sem escudo, o simbolo deixa de ter contorno para caber dentro. Ver o CSS. */
  if (!formaArte) classes.push('sem-forma');
  /*
   * ---- O CONTORNO E' UM ALVO DE PINTURA, E NAO UM BRINDE DO EFEITO ----
   *
   * Ele nasceu como o brilho da cor do efeito em volta do conjunto, para o
   * brasao pago se ver na tabela do servidor, a 28 pixels. Duas coisas mudaram,
   * nesta ordem:
   *
   *   1. ele deixou de vir LIGADO com o efeito ("isso como padrao nao pode
   *      acontecer, so' se a pessoa quiser") — quem poe o Ouro no simbolo quer o
   *      simbolo dourado, e ganhava de brinde um contorno luminoso em volta do
   *      escudo inteiro;
   *   2. ele ganhou cor propria ("a cor do contorno tem que ter opcao de
   *      escolher cor e efeitos tambem") — antes ele so' sabia repetir a cor de
   *      quem estava pago.
   *
   * Quem decide a cor e' `corDoContorno`, no catalogo, e nao uma cadeia escrita
   * aqui: o site desenha o mesmo escudo por esta mesma funcao, mas a caixa de
   * escolher cor (que mostra a bolinha do alvo "Contorno") vive so' no jogo. Com
   * a cadeia num lugar so', a bolinha e o escudo nao tem como discordar.
   *
   * Ela devolve `null` quando `halo` esta desligado — e' o mesmo `if`.
   */
  /*
   * Os contornos nao entram no icone. Eles sao acabamento — um brilho de cinco
   * pixels em volta de um desenho de treze o engole, e as linhas de silhueta do
   * simbolo e das letras somem na sombra escura que o icone ja' tem.
   */
  const tintaDoContorno = icone ? null : corDoContorno(b);
  if (tintaDoContorno) classes.push('com-efeito');
  /*
   * E os contornos das OUTRAS duas pecas. Eles nao entram nas classes da caixa:
   * cada um e' desenhado pela peca dele, porque um `drop-shadow` na caixa
   * seguiria a silhueta do conjunto — sairia um contorno em volta do escudo e
   * nao em volta do leao.
   */
  const contornoDoSimbolo = icone ? null : corDoContornoDe(b, 'simbolo');
  const contornoDasLetras = icone ? null : corDoContornoDe(b, 'letras');

  const caixa = criar(doc, 'div', classes.join(' '));
  caixa.style.width = largura + 'px';
  caixa.style.height = Math.round(largura * 1.12) + 'px';

  /* No icone, UMA letra — ver a nota do `comLetras`. */
  const escrito = icone ? letrasDoBrasao(b, nome).slice(0, 1) : letrasDoBrasao(b, nome);
  /*
   * O chao de 6px: num escudo de 13 pixels (a linha do chat) o minimo do
   * multiplicador daria quatro pixels, que nao e' letra, e' sujeira.
   */
  /*
   * ---- A FONTE DAS INICIAIS ----
   *
   * Inline e nao por classe: a familia vem do catalogo e muda por guilda, e uma
   * classe por fonte seria seis regras a manter num arquivo que o site tambem le.
   *
   * A `escala` corrige a largura: `tamanhoDasLetras` foi medido na Decorativa, e a
   * monoespacada ocupa bem mais por letra. Ela e' sempre <= 1, entao a conta que
   * garante que cinco letras cabem continua valendo como TETO para todas.
   *
   * O chao de 6px: num escudo de 13 pixels (a linha do chat) o minimo do
   * multiplicador daria quatro pixels, que nao e' letra, e' sujeira.
   */
  const fonte = fontePorId(b.fonte) ?? FONTES[0];
  caixa.style.fontFamily = fonte.css;
  caixa.style.fontSize =
    Math.max(6, Math.round(largura * tamanhoDasLetras(escrito, b.letrasTam) * fonte.escala)) + 'px';
  caixa.style.setProperty('--brasao-tinta', icone ? (corQueSeVe(b.corSimbolo) ?? tinta.css) : tinta.css);
  caixa.style.setProperty(
    '--brasao-letras',
    icone ? (corQueSeVe(b.corLetras) ?? tintaDasLetras.css) : tintaDasLetras.css,
  );
  if (!icone && tintaDasLetras.coins) {
    caixa.style.setProperty('--brasao-letras-img', pinturaDe(tintaDasLetras.css));
  }
  /*
   * ---- CADA CONTORNO TEM A GROSSURA DELE ----
   *
   * "o contorno tem que ter opcao pra selecionar o tamanho da sombra, ou se vai
   *  ser contorno fino etc."
   *
   * Tres variaveis e nao uma: as tres pecas podem estar em degraus diferentes, e
   * uma variavel so' faria a mais grossa mandar nas outras duas. Quem converte o
   * degrau em pixel e' o catalogo (`raioDoContorno`), porque a regra e' diferente
   * para a forma (pixel cravado, para se ver a 28) e para as outras duas (fracao
   * do tamanho, para acompanhar a silhueta em qualquer escala).
   */
  if (tintaDoContorno) {
    caixa.style.setProperty('--brasao-brilho', tintaDoContorno);
    caixa.style.setProperty('--raio-forma', raioDoContorno(grossuraDaPeca(b, 'forma'), tamanho, 'forma'));
  }
  if (contornoDoSimbolo) {
    caixa.style.setProperty('--contorno-simbolo', contornoDoSimbolo);
    caixa.style.setProperty('--raio-simbolo', raioDoContorno(grossuraDaPeca(b, 'simbolo'), largura, 'simbolo'));
  }
  if (contornoDasLetras) {
    caixa.style.setProperty('--contorno-letras', contornoDasLetras);
    caixa.style.setProperty('--raio-letras', raioDoContorno(grossuraDaPeca(b, 'letras'), largura, 'letras'));
  }
  /*
   * ---- O VERNIZ DO FOSCO ----
   *
   * Um escudo pintado de fosco com o verniz de sempre por cima sai brilhante: a
   * camada de cima desmentiria a pintura. A troca e' so' da forma — o simbolo e as
   * letras nao tem camada de verniz, elas sao a pintura e mais nada.
   */
  if (acabamentoDe(b.cor) === 'fosco') caixa.style.setProperty('--brasao-verniz', VERNIZ_FOSCO);
  if (arte) caixa.style.setProperty('--brasao-simbolo', "url('" + arte + "')");

  /*
   * O tamanho e o lugar do simbolo. Vale para as duas posicoes — dentro e
   * atras —, e e' a MESMA conta das letras (ver `jeitoDaPeca`).
   *
   * `transform` e nao `inset`: a mascara acompanha a transformacao, entao o
   * desenho cresce e anda inteiro. Mexendo no `inset` seria a CAIXA que muda de
   * tamanho, e a mascara, sendo `contain`, redesenharia o simbolo dentro dela —
   * o resultado seria o mesmo simbolo num retangulo diferente.
   */
  const jeitoDoSimbolo = jeitoDaPeca({ x: b.simboloX, y: b.simboloY, tamanho: b.simboloTam });

  /*
   * O envelope do contorno — ver o CSS. Ele so' existe quando ha' contorno: um
   * elemento a mais em cada um dos escudos de 13 pixels da linha do chat, para
   * carregar um filtro que ninguem pediu, e' custo sem troco.
   */
  const envelopar = (peca) => {
    if (!contornoDoSimbolo) return peca;
    const cerca = criar(doc, 'span', 'gb-simbolo-cerca com-contorno');
    cerca.append(peca);
    return cerca;
  };

  /* O de tras vem primeiro no documento — e' o que o poe embaixo. */
  if (atras) {
    const fundo = criar(doc, 'span', 'gb-simbolo atras' + movimentoDe(tinta, icone));
    if (jeitoDoSimbolo) fundo.style.transform = jeitoDoSimbolo;
    caixa.append(envelopar(fundo));
  }

  /*
   * Sem forma, nao ha' camada de escudo — e nao um escudo transparente. Um
   * elemento com mascara vazia continuaria pintando o retangulo inteiro, que e'
   * o oposto do que se pediu.
   */
  if (formaArte) {
    const escudo = criar(doc, 'span', 'gb-escudo' + movimentoDe(cor, icone));
    escudo.style.setProperty('--brasao-forma', "url('" + formaArte + "')");
    /*
     * `pinturaDe` e nao `cor.css` cru: o escudo pinta com `background-image`, e
     * um hex nao e' uma imagem. Sem isto a propriedade inteira cai e o escudo
     * fica INVISIVEL — o que acontecia com todas as cores chapadas.
     */
    /*
     * ---- NO ICONE, A PINTURA E' UMA COR SO' ----
     *
     * "efeitos viram a cor media/predominante do efeito."
     *
     * Quem responde qual e' essa cor e' `corQueSeVe`, no catalogo — a mesma funcao
     * que decide a cor de um contorno, pelo mesmo motivo: e' a cor que o catalogo
     * ja elegeu como a que MANDA naquele efeito.
     *
     * Sem isto, as catorze bandas do Ouro num escudo de treze pixels dao menos de
     * um pixel por banda, e o olho soma tudo num cinza — o efeito pago vira uma
     * mancha, que e' justamente o que se paga para nao ter.
     */
    escudo.style.setProperty(
      '--brasao-pintura',
      pinturaDe(icone ? (corQueSeVe(b.cor) ?? cor.css) : cor.css),
    );
    /*
     * ---- O TAMANHO E O LUGAR DA FORMA ----
     *
     * "o tamanho e posicionamento da forma tem que ser alteravel tambem."
     *
     * A MESMA conta do simbolo e das iniciais (`jeitoDaPeca`), e por `transform`
     * pela mesma razao: a mascara acompanha a transformacao, entao o escudo cresce
     * e anda inteiro, com o recorte junto. Mexer no `inset` mudaria a CAIXA, e a
     * mascara, esticada a `100% 100%`, redesenharia a forma deformada dentro dela.
     *
     * Devolve `''` quando nada foi mexido, e ai nenhum `transform` e' pendurado —
     * e' o que mantem intacto todo brasao que nunca abriu esta tela.
     */
    const jeitoDaForma = jeitoDaPeca({ x: b.formaX, y: b.formaY, tamanho: b.formaTam });
    if (jeitoDaForma) escudo.style.transform = jeitoDaForma;
    caixa.append(escudo);
  }

  /*
   * O de dentro e' irmao do escudo e NAO filho dele, mesmo estando por cima: a
   * mascara do escudo recortaria um filho, e o que se quer e' o simbolo caber
   * no contorno por desenho — o `inset` em porcentagem faz isso — e nao por
   * corte, que deixaria meio leao cortado numa lamina estreita.
   */
  if (arte && !atras) {
    const dentro = criar(doc, 'span', 'gb-simbolo dentro' + movimentoDe(tinta, icone));
    if (jeitoDoSimbolo) dentro.style.transform = jeitoDoSimbolo;
    caixa.append(envelopar(dentro));
  }

  if (comLetras) {
    const letreiro = criar(doc, 'b', 'gb-letras');
    /*
     * O lugar e' `transform` e nao `top`/`left`: a caixa das letras ocupa o
     * escudo inteiro (`inset: 0`) e centraliza por dentro, entao mexer nas
     * beiradas dela mudaria o centro em vez de mover o texto. `translate` em
     * PORCENTAGEM anda a mesma fracao do escudo em qualquer tamanho.
     */
    const jeito = jeitoDaPeca({ x: b.letrasX, y: b.letrasY, tamanho: 100 });
    if (jeito) letreiro.style.transform = jeito;

    const marca = ['gb-letras-texto'];
    /* A letra pintada com degrade e' recortada pelo glifo — some a um pixel de traço. */
    if (!icone && tintaDasLetras.coins) marca.push('pintada');
    if (contornoDasLetras) marca.push('com-contorno');
    const movimento = movimentoDe(tintaDasLetras, icone).trim();
    if (movimento) marca.push(movimento);
    letreiro.append(criar(doc, 'span', marca.join(' '), escrito));
    caixa.append(letreiro);
  }

  return caixa;
}
