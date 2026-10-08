/* =========================================================================
 * A JANELA DAS GUILDAS
 *
 * "a aba de guildas do servidor tem que ser bem bonita bem feita igual de jogo
 *  profissional, sem 9slice, igual a aba da arena — e a pessoa que nao esta em
 *  guild tem que poder se alistar a uma guilda e os donos podem aceitar ou nao."
 *
 * ---- "igual a aba da arena" quer dizer uma coisa concreta ----
 *
 * A janela da arena não é uma caixa com uma imagem dentro: ela É a moldura. A
 * arte é fatiada como `border-image`, o preto dela foi vazado, e uma segunda
 * cópia é repintada por cima do conteúdo para os cantos nunca serem tapados.
 * Esta janela usa a mesma receita — ver `.modal-box.guilda`, no `style.css`, e a
 * variável `--guilda-moldura`, que é o único ponto a mudar quando a arte própria
 * das guildas existir.
 *
 * ---- Três páginas, e qual abre não é escolha do jogador ----
 *
 *   MINHA      o estandarte, o recado, os membros com posto e boneco, e os
 *              gestos que o CARGO permite. É a página de quem tem guilda.
 *   SERVIDOR   a tabela, com pódio para as três primeiras. É onde se acha uma
 *              guilda — e onde fica o botão de pedir para entrar.
 *   PEDIDOS    a caixa de correio dos dois lados: os convites e os pedidos que
 *              eu fiz; e, para vice e líder, os pedidos que chegaram.
 *
 * Quem tem guilda abre na MINHA; quem não tem abre no SERVIDOR, que é o que ele
 * veio fazer. A escolha depois disso mora em `ctx.tabs.guilda`.
 *
 * ---- Os botões saem do CARGO, e o cargo vem do servidor ----
 *
 * Nada aqui recalcula quem pode o quê. O servidor manda `meuCargo` e a tela
 * compara com os três números que ele também define. Uma cópia da regra aqui
 * seria a segunda a discordar no dia em que a primeira mudar — e a tela é a que
 * mente sem dar erro.
 * ========================================================================= */
import { outfitCanvas, outfitInfo, itemCanvas } from './sprites.mjs';
import { artOrUiIcon } from './hud.mjs';
/*
 * O mapa de vocação -> ícone vem do `panels.mjs`, e não de uma cópia daqui: são
 * as mesmas cinco vocações que a party e a Cyclopedia desenham, e duas listas
 * acabariam discordando sobre qual é a do monge.
 */
import { PERICIA_DA_VOCACAO, NOME_DA_VOCACAO, confirmPurchase } from './panels.mjs';
import { tipTexto, tipPanel, esconderBalao, estrelasDosAfixos, classeDaEstrela } from './tooltip.mjs';
import { arteTeimosa } from './arte-teimosa.mjs';
import { fecharAoClicarFora, atalhosDaCaixa } from './windows.mjs';
/* =========================================================================
 * O BAU USA A CELULA DA MOCHILA, E NAO UMA PROPRIA
 *
 * "ao deixar o mouse em cima de um item no bau tem que mostrar o tooltip com
 *  todas as informaçoes igual e' no inventario — afixos, tier, imbui e etc, tudo
 *  bonito igualzinho como se fosse no inventario/mochila."
 *
 * `itemCell` E' a celula da mochila: ela ja' traz a raridade no fundo, o selo de
 * tier, o de imbuement, as estrelas de afixo, a contagem da pilha, o balao inteiro
 * do item e o ARRASTAR. O bau tinha uma celula propria (`quadroDeItem`) que
 * desenhava o sprite e a contagem, e mais nada — por isso o balao dele dizia so' o
 * nome.
 *
 * `aceitarSoltura` e' o outro lado: "faltou o sistema de arrastar direto da
 * mochila, igual como e' nos outros baus existentes".
 * ========================================================================= */
import { itemCell, aceitarSoltura, alvoDaPeca } from './inventory.mjs';
/*
 * A GRADE DO EQUIPAMENTO do card do membro é a MESMA do card do personagem na
 * capa do site — "o site já tem um card com o inventário organizado e bonito;
 * esse é o visual que eu quero no card do membro da guilda". Ela mora num
 * componente que os dois chamam. Ver `paperdoll.mjs`.
 */
import { gradeDeEquipamento } from './paperdoll.mjs';
/*
 * A CAIXA DE QUANTIDADE e' a mesma da mochila, do deposito e da troca — regua,
 * campo e os atalhos 1 / Metade / Tudo. "quando eu for guardar item com quantidade
 * tem que perguntar a quantidade que quero guardar, igual o funcionamento da
 * mochila": a unica forma de ser igual e' ser a mesma.
 */
import { pedirQuantidade } from './social.mjs';
/*
 * O catalogo do brasao e' o MESMO arquivo que o servidor le. Daqui sai o
 * desenho e a prateleira; de la' saem as regras e os precos. Ver o cabecalho do
 * modulo: duas listas seriam duas listas que um dia discordam, e a forma dessa
 * discordancia e' um jogador que escolhe uma cor, paga, e ouve que ela nao
 * existe.
 */
import {
  FORMAS,
  FORMA_NENHUMA,
  SIMBOLOS,
  EFEITOS,
  CORES_CLASSICAS,
  /* A engrenagem das duas cores e a identidade de compra de um efeito tingido. */
  tingir,
  idDoEfeito,
  PECAS_COM_CONTORNO,
  corQueOContornoTeria,
  segueQualPeca,
  GROSSURAS,
  GROSSURA_PADRAO,
  grossuraDoContorno,
  ACABAMENTOS,
  ACABAMENTO_PADRAO,
  acabamentoDe,
  tintaComAcabamento,
  hexDaPintura,
  FONTES,
  fonteDoBrasao,
  TINTAS_DO_SIMBOLO,
  pecasSemContraste,
  contrasteEntre,
  CONTRASTE_MINIMO,
  CUSTO_DE_TROCAR,
  arteDaForma,
  arteDoSimbolo,
  tintaPorId,
  ehCorLivre,
  TINTA_PADRAO_DAS_LETRAS,
  letrasDoBrasao,
  presoEntre,
  MAXIMO_DE_LETRAS,
  LIMITE_DO_TAMANHO,
  LIMITE_DO_LUGAR,
  ORDENS,
  brasaoPadrao,
  normalizarBrasao,
  mesmoBrasao,
  precoDoBrasao,
} from '/packages/shared/src/brasao-de-guilda.mjs';
import { desenharBrasao, movimentoDe, vestirNomeDaGuilda } from '/packages/shared/src/desenhar-brasao.mjs';
import { recusaDoNome, chaveDoNome, nomeArrumado } from '/packages/shared/src/nome-de-guilda.mjs';
/*
 * A ORDEM da tabela e o texto que a explica moram em `packages/shared` — o mesmo
 * arquivo que o servidor usa para ordenar e que o site usa para redesenhar. Ver o
 * cabecalho de la'.
 */
import { ordenarGuildas, CRITERIO_DA_ORDEM } from '/packages/shared/src/ordem-das-guildas.mjs';

/* O salto de linha dos balões de várias linhas. Ver `showTexto` em `tooltip.mjs`. */
const SALTO = String.fromCharCode(10);

const LIDER = 3;
const VICE = 2;

let ctx = null;

export function initGuildas(context) {
  ctx = context;
}

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

/** "há 3 dias" — a idade de uma guilda não se lê em data. */
function desdeQuando(ts) {
  const dias = Math.floor((Date.now() - (ts ?? 0)) / 86_400_000);
  if (dias < 1) return 'fundada hoje';
  if (dias === 1) return 'fundada ontem';
  if (dias < 30) return `fundada há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return `fundada há ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
}

/** "há 2h" — a idade de um pedido, que se lê de relance. */
function quandoCurto(ts) {
  const ms = Date.now() - (ts ?? 0);
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min}min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias}d`;
}

/* =========================================================================
 * A CAIXA DE CONFIRMAR
 *
 * "os botoes promover, expulsar, desfazer guild e etc, todos tem que ter botao
 *  de confirmar ou cancelar."
 *
 * ---- Por que ela nasceu aqui, e não em `panels.mjs` ----
 *
 * O código desta janela já chamava `ctx.confirmar` em quatro lugares, guardado
 * com `ctx.confirmar ? ... : ...` — e `ctx.confirmar` NUNCA EXISTIU. O guarda
 * fazia o caminho cair sempre no `else`, que manda direto. Quer dizer: nenhum
 * botão desta janela confirmava nada, e a tela parecia certa porque o `?:` não
 * dá erro. É o defeito que ele viu.
 *
 * O jogo tem a caixa (`.confirm-back` + `.confirm-box`), mas ela é montada à
 * mão em cada lugar que precisa, dentro de `panels.mjs`. Importar de lá para cá
 * fecharia um ciclo — `panels.mjs` não importa este arquivo hoje, mas os dois
 * vivem no mesmo contexto e a dependência inversa é a que costuma aparecer
 * depois. Aqui ela é uma função de vinte linhas que usa as MESMAS classes, e
 * por isso sai idêntica às outras sem depender de nenhuma.
 *
 * ---- Ela é uma caixa POR CIMA, e não um modal ----
 *
 * A janela de guildas JÁ é o `#modal`. Abrir a confirmação com `openModal`
 * substituiria o conteúdo dela, e confirmar fecharia a janela inteira — a
 * pessoa terminaria de expulsar alguém olhando para o mapa. É a mesma razão
 * escrita em `confirmarEntrega`.
 *
 * ---- O que ela pergunta ----
 *
 * O texto diz o que VAI ACONTECER, e não "tem certeza?". "Tem certeza?" não
 * acrescenta informação nenhuma: quem clicou já achava que tinha. O que falta
 * saber é a consequência — que o expulso perde a guilda na hora, que quem passa
 * a liderança vira vice, que a guilda desfeita libera o nome.
 */
function perguntar({ titulo, texto, botao = 'Confirmar', perigo = false, naoPerguntar = null }, aoConfirmar) {
  const fundo = el('div', 'confirm-back');
  const caixa = el('div', 'confirm-box');
  caixa.append(el('h3', null, titulo));
  caixa.append(el('p', 'shop-note', texto));

  const acoes = el('div', 'confirm-actions');
  /* =======================================================================
   * ---- A CAIXINHA DE "NAO PERGUNTAR NOVAMENTE" ----
   *
   * "o botão de confirmar ao guardar no baú comunitário tem que ter uma caixinha
   *  de (não perguntar novamente), que aí depois, sempre que eu tentar guardar
   *  qualquer item, não perguntar mais."
   *
   * Ela nasce so' quando quem chama pede (`naoPerguntar`), e nao em toda caixa: as
   * outras confirmacoes desta janela sao gestos raros e sem volta — expulsar,
   * desfazer a guilda, passar a lideranca. Uma caixinha de "nao perguntar mais"
   * em cima de um botao de expulsar seria um botao de expulsar sem confirmacao.
   *
   * O valor e' lido no CONFIRMAR e nao no clique da caixinha: marcar a caixinha e
   * depois cancelar nao pode valer como um acordo.
   * ======================================================================= */
  let marcada = null;
  if (naoPerguntar) {
    const rotulo = el('label', 'confirm-nao-perguntar');
    marcada = document.createElement('input');
    marcada.type = 'checkbox';
    rotulo.append(marcada, el('span', null, naoPerguntar.rotulo ?? 'não perguntar novamente'));
    acoes.append(rotulo);
  }
  const cancelar = el('button', 'ghost', 'Cancelar');
  cancelar.onclick = () => fundo.remove();
  const sim = el('button', perigo ? 'danger' : null, botao);
  sim.onclick = () => {
    if (marcada?.checked) naoPerguntar?.aoMarcar?.();
    fundo.remove();
    aoConfirmar();
  };
  acoes.append(cancelar, sim);
  caixa.append(acoes);

  fundo.append(caixa);
  fecharAoClicarFora(fundo, () => fundo.remove());
  /* Enter confirma, Escape desiste — como em toda caixa de confirmar do jogo. */
  atalhosDaCaixa(fundo, { confirmar: () => sim.click(), fechar: () => fundo.remove() });
  document.body.append(fundo);
  /*
   * O foco vai para CANCELAR quando o gesto é perigoso.
   *
   * Nas caixas comuns ele vai para o botão de confirmar, porque o Enter é o
   * caminho esperado. Expulsar e desfazer não são caminho esperado nenhum: ali
   * um Enter de reflexo — de quem acabou de digitar um nome no campo ao lado —
   * executaria o gesto sem ninguém ler a pergunta.
   */
  (perigo ? cancelar : sim).focus();
}

/* =========================================================================
 * O BRASÃO, DESENHADO DO NOME
 *
 * Nenhuma guilda tem arte, e nenhuma vai ter tão cedo: um brasão por guilda são
 * tantos arquivos quantas guildas houver, e ninguém vai desenhá-los.
 *
 * Então ele SAI DO NOME. Um hash das letras escolhe uma matiz, e as duas
 * iniciais vão no meio. Isso dá três coisas que uma arte genérica não daria: a
 * mesma guilda tem sempre a mesma cor (o hash é determinístico), duas guildas
 * diferentes quase nunca têm a mesma, e a tabela do servidor passa a ser lida
 * por cor antes de ser lida por nome — que é como se lê uma tabela de vinte
 * linhas.
 *
 * O ângulo do degradê também vem do hash, e é o que impede duas guildas de
 * matiz próxima de ficarem idênticas.
 * ========================================================================= */
function digitosDoNome(nome) {
  let soma = 0;
  const texto = String(nome ?? '');
  for (let i = 0; i < texto.length; i++) soma = (soma * 31 + texto.charCodeAt(i)) >>> 0;
  return soma;
}

/*
 * As iniciais moram no catalogo compartilhado (`iniciaisDoNome`), e nao aqui: o
 * site desenha o mesmo escudo, e duas copias desta regra dariam iniciais
 * diferentes para a mesma guilda em duas telas.
 */

/* =========================================================================
 * O ESCUDO
 *
 * Exportado porque o menu de botão direito e a ficha do chat desenham o MESMO
 * escudo (ver `social.mjs`).
 *
 * ---- QUEM DESENHA MORA EM `packages/shared` ----
 *
 * O desenho inteiro — as camadas, as máscaras, as tintas e o CSS delas — está
 * em `desenhar-brasao.mjs`, ao lado do catálogo. O motivo é o SITE: a tabela do
 * ranking, a lista de quem está online e a página do personagem desenham este
 * mesmo escudo, e o site não carrega o cliente.
 *
 * Duas cópias do desenho seriam duas cópias que um dia discordam, e a forma
 * dessa discordância é a pior possível: a mesma guilda com um escudo no jogo e
 * outro no site.
 *
 * O que sobra aqui é o `document` — o módulo recebe o documento em vez de
 * assumir um, para o mesmo desenho servir ao jogo, ao site e ao DOM de mentira
 * dos testes.
 * ========================================================================= */
export function brasaoDe(nome, tamanho = 44, escolha = null, opcoes = {}) {
  return desenharBrasao(document, nome, tamanho, escolha, opcoes);
}

/* =========================================================================
 * A RODA DE COR — HSV, porque e' o que a mao sabe fazer
 *
 * "em vez de ter cores pra escolher, faça ele negócio RGB, que a pessoa anda
 *  com o mouse e escolhe qualquer cor (...) seria uma bola com as cores RGB."
 *
 * A bola é HSV e não RGB, e a diferença importa: em RGB a pessoa mexeria em
 * três números que não se parecem com nada do que ela vê. Em HSV o ângulo é a
 * COR, a distância do meio é o quanto ela é forte, e a barra é o quanto ela é
 * clara — três coisas que se enxergam de olho.
 *
 * ---- POR QUE O DESENHO DA BOLA É CSS E NÃO CANVAS ----
 *
 * Um `conic-gradient` com as seis pontas dá o círculo de matiz exato, e um
 * `radial-gradient` branco por cima com alfa indo de 1 a 0 dá a saturação — e
 * isso não é aproximação: HSV com v=1 É a mistura linear entre o branco e a
 * cor pura, que é exatamente o que um degrade com alfa faz. O desenho e a
 * conta abaixo dão a MESMA cor, e é por isso que o que se aponta é o que se
 * leva.
 *
 * O escuro é uma camada preta por cima, com opacidade `1 - v`.
 * ========================================================================= */

/** HSV (0..360, 0..1, 0..1) para `#rrggbb`. */
function hsvParaHex(h, s, v) {
  const canal = (n) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${canal(5)}${canal(3)}${canal(1)}`;
}

/** O caminho de volta — é ele que põe a marca no lugar certo ao abrir a tela. */
function hexParaHsv(hex) {
  const n = Number.parseInt(String(hex).slice(1), 16) || 0;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const alto = Math.max(r, g, b);
  const baixo = Math.min(r, g, b);
  const d = alto - baixo;
  let h = 0;
  if (d) {
    if (alto === r) h = ((g - b) / d) % 6;
    else if (alto === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: alto ? d / alto : 0, v: alto };
}

/** O hex de uma cor guardada — ou `padrao`, quando ela é um efeito (um degradê). */
function hexDaEscolha(valor, padrao) {
  const css = tintaPorId(valor)?.css ?? '';
  return /^#[0-9a-f]{6}$/i.test(css) ? css.toLowerCase() : padrao;
}

/** O selo de coin que marca um efeito pago, com o preço dentro. */
function seloDeCoin(quanto) {
  const selo = el('span', 'brasao-coin');
  const arte = document.createElement('img');
  arte.alt = '';
  arte.width = 12;
  arte.height = 12;
  arteTeimosa(arte, '/client/assets/ui/coin-store.png');
  selo.append(arte, el('b', null, String(quanto)));
  return selo;
}

/* =========================================================================
 * OS SEIS ALVOS DE PINTURA — TRES PECAS, DUAS COISAS EM CADA
 *
 * "em cima, seletor segmentado com o que esta sendo pintado."
 * "so' faltou poder mudar o contorno do simbolo e das letras tambem."
 *
 * Eram quatro numa fileira: Escudo · Contorno · Simbolo · Iniciais. E aquele
 * "Contorno" era o do ESCUDO — o unico que existia. Com os tres contornos, uma
 * fileira de seis nao diria mais nada: "Contorno", "Contorno" e "Contorno" ao
 * lado de "Escudo", "Simbolo" e "Iniciais" e' uma lista que se le duas vezes.
 *
 * Entao a tira virou uma GRADE de dois por tres, e ela se explica pelos eixos:
 *
 *              Escudo    Simbolo   Iniciais
 *   Pintura      o          o          o        do que a peca e' feita
 *   Contorno     o          o          o        o que a cerca
 *
 * A pergunta "onde eu mudo o contorno do leao?" passa a ter resposta geometrica
 * em vez de textual: cruze a coluna do simbolo com a fileira do contorno.
 *
 * A lista mora fora do criador porque ela nao e' uma peca de tela: e' a mesma
 * lista que o catalogo cobra (`pinturasDe`) e que o desenho le. Escrita aqui em
 * cima, ela e' facil de comparar com a de la' — e discordar delas e' o defeito
 * que esta dupla ja teve duas vezes (o simbolo, e depois as iniciais).
 * ========================================================================= */
/* Sem objeto escolhido, e sem letras, nao ha' o que pintar nem o que cercar. */
const TEM_SIMBOLO = (b) => !!b.simbolo;
const TEM_LETRAS = (b) => b.letras !== false;

const ALVOS_DE_COR = [
  /*
   * "em vez de estar escrito Escudo tem que estar escrito Forma."
   *
   * A aba que escolhe esta peca chama-se Forma, e esta era a unica celula da tela
   * que a chamava de Escudo — duas palavras para o mesmo desenho, e quem procura
   * "onde mudo a cor da forma?" olhava para uma grade que nao tinha essa palavra.
   */
  {
    campo: 'cor',
    nome: 'Forma',
    tipo: 'pintura',
    padrao: '#33689e',
    dica: 'A pintura da forma do escudo.',
  },
  {
    campo: 'corSimbolo',
    nome: 'Símbolo',
    tipo: 'pintura',
    padrao: '#fff6de',
    dica: 'A pintura do objeto, separada da do escudo.',
    precisa: TEM_SIMBOLO,
  },
  {
    campo: 'corLetras',
    nome: 'Iniciais',
    tipo: 'pintura',
    padrao: TINTA_PADRAO_DAS_LETRAS,
    dica: 'A tinta das letras. Aceita também os efeitos pagos.',
    precisa: TEM_LETRAS,
  },
  /*
   * Os tres contornos. `peca` e `ligado` saem do catalogo (`PECAS_COM_CONTORNO`)
   * e nao estao escritos aqui de novo: o interruptor de cada um e' o mesmo campo
   * que o desenho le, e dois lugares com a lista discordariam no dia em que uma
   * quarta peca ganhasse contorno.
   *
   * `padrao: null` nao e' uma cor: e' "siga o escudo".
   */
  {
    campo: 'corContorno',
    nome: 'Forma',
    tipo: 'contorno',
    peca: 'forma',
    padrao: null,
    dica:
      'O brilho em volta da forma. É o que faz o brasão ser notado na tabela do' +
      ' servidor, em tamanho pequeno.',
  },
  {
    campo: 'corContornoSimbolo',
    nome: 'Símbolo',
    tipo: 'contorno',
    peca: 'simbolo',
    padrao: null,
    dica:
      'Uma linha em volta do objeto, seguindo a silhueta dele. Um leão creme' +
      ' contornado da cor do escudo é heráldica clássica.',
    precisa: TEM_SIMBOLO,
  },
  {
    campo: 'corContornoLetras',
    nome: 'Iniciais',
    tipo: 'contorno',
    peca: 'letras',
    padrao: null,
    dica: 'Uma linha em volta das letras, por fora do contorno escuro que elas já têm.',
    precisa: TEM_LETRAS,
  },
].map((alvo) => ({
  ...alvo,
  /* O campo do interruptor, quando o alvo e' um contorno. */
  ligado: PECAS_COM_CONTORNO.find((p) => p.peca === alvo.peca)?.ligado ?? null,
}));

/**
 * Monta o criador de brasão.
 *
 * `opcoes.jaExiste`      true na troca, false na fundação — muda o preço.
 * `opcoes.efeitos`       os efeitos que esta guilda já pagou.
 * `opcoes.nome`          de onde saem as iniciais (uma FUNÇÃO na fundação, que
 *                        muda enquanto a pessoa digita).
 * `opcoes.campoDeNome`   o input de nome, quando ele pertence a esta tela.
 * `opcoes.rotuloDoBotao` o texto do botão de confirmar; sem ele não há botão
 *                        (é a caixa de trocar, que tem o dela).
 * `opcoes.aoConfirmar`   recebe `(brasao, preco)`.
 * `opcoes.aoMudar`       recebe `(brasao, preco)` a cada clique.
 *
 * Devolve `{ elemento, valor(), repintar(), confirmar() }`.
 */
function criadorDeBrasao(inicial, opcoes = {}) {
  const nomeAgora = () => (typeof opcoes.nome === 'function' ? opcoes.nome() : opcoes.nome) || '??';
  let escolha = normalizarBrasao(inicial ?? brasaoPadrao(nomeAgora()), nomeAgora());
  /*
   * O ponto de partida, guardado para o "Recomeçar".
   *
   * É o brasão como a tela ABRIU, e não o padrão de fábrica — e a diferença importa
   * nos dois fluxos:
   *
   *   fundando    a tela abre no padrão, então os dois são a mesma coisa
   *   trocando    a tela abre no brasão que a guilda tem, e "recomeçar" significa
   *               desfazer o que eu mexi — não jogar fora o escudo da guilda
   *
   * Uma cópia e não uma referência: `escolha` é substituída a cada clique, mas um
   * `normalizarBrasao` que um dia devolvesse o mesmo objeto deixaria isto seguir
   * as mudanças, e o botão passaria a não fazer nada.
   */
  const doInicio = { ...escolha };

  const caixa = el('div', 'brasao-criador');
  const corpo = el('div', 'brasao-corpo');

  /*
   * O nome serve? Só a tela de fundar pergunta isso — na troca de brasão o nome
   * já existe, e por isso o padrão é `true`. Ver `conferirONome`.
   */
  let nomeServe = !opcoes.campoDeNome;

  /* =======================================================================
   * A COLUNA DA ESQUERDA — o palco, e SÓ ele
   *
   * "esquerda (~260px, fixa): prévia grande (~180px) sobre fundo escuro com
   *  brilho sutil + o mesmo brasão em 28px embaixo (como aparece no chat).
   *  Depois nome da guilda, ajuda, Sem custo e FUNDAR GUILDA. SÓ ISSO nessa
   *  coluna."
   *
   * Ela tinha virado depósito: as Camadas, as Iniciais, as réguas e uma roda de
   * cor moraram aqui porque era onde sobrava altura. O preço foi o que se viu no
   * print — três rodas, tudo empilhado, e a coluna mais alta que a tela.
   *
   * Com as abas do outro lado, a altura sobrou de novo do lado certo, e o palco
   * voltou a ser o palco: a pergunta ("como está ficando?") e a resposta
   * ("fundar"), sem nada no meio.
   * ======================================================================= */
  const palco = el('div', 'brasao-palco');
  const previa = el('div', 'brasao-previa');
  /*
   * ---- A PRÉVIA DIZ O QUE ELA ACEITA ----
   *
   * "e como faz pra aumentar o tamanho dos negócio pelo preview?"
   *
   * Não fazia — e a pergunta é o próprio defeito: arrastar já funcionava e ninguém
   * tinha como saber. Um controle que só existe no gesto é um controle que não
   * existe para quem não adivinha o gesto.
   *
   * A legenda mora DENTRO da prévia, colada na coisa que ela descreve, e diz qual
   * peça está em jogo — ela muda com a aba aberta, que é quem decide o que se move.
   */
  const dicaDaPrevia = el('i', 'brasao-previa-dica');
  /*
   * ---- E ELA MORA EMBAIXO DO QUADRO, NAO DENTRO ----
   *
   * "o texto 'arraste para mover...' está por cima da ponta do escudo."
   *
   * Estava: o quadro é um poço escuro com o escudo centralizado, e a ponta de
   * baixo do escudo desce até onde a legenda estava. Duas coisas no mesmo lugar, e
   * a que importa é a de baixo.
   *
   * Fora do quadro ela não cobre nada e continua colada na coisa que descreve.
   */
  palco.append(previa, dicaDaPrevia);

  /*
   * ---- O MESMO BRASÃO A 28 PIXELS ----
   *
   * "o mesmo brasão em 28px embaixo (como aparece no chat)."
   *
   * É a única prévia que diz a verdade sobre o que quase todo mundo vai ver: o
   * escudo aparece grande nesta tela e em nenhum outro lugar do jogo. Um Aurora
   * escolhido a 180px pode ser uma mancha a 28, e é melhor descobrir isso aqui
   * do que depois de pagar.
   */
  const fitaMini = el('div', 'brasao-previa-mini');
  const mini = el('div', 'brasao-mini-escudo');
  fitaMini.append(mini, el('i', null, 'como aparece no chat (2×)'));
  palco.append(fitaMini);

  /* =======================================================================
   * O AVISO DE CONTRASTE
   *
   * "se a cor do símbolo ou das iniciais ficar muito parecida com a da forma,
   *  mostrar aviso pequeno perto do preview de 28px. Só aviso, não bloqueia."
   *
   * Ele fica colado NO escudo de 28 pixels de propósito: é ali que o problema
   * existe. A 150 pixels dá para ver o contorno do desenho e achar que está bom;
   * a 13, na linha do chat, um leão cobalto num escudo cobalto é uma mancha.
   *
   * E é só aviso porque um escudo de uma cor só é uma escolha legítima —
   * heráldica monocromática existe. O que não pode é descobrir depois de fundar.
   * ======================================================================= */
  const avisoDeContraste = el('p', 'brasao-aviso escondido');
  palco.append(avisoDeContraste);

  if (opcoes.campoDeNome) {
    const campo = el('label', 'brasao-campo');
    campo.append(el('span', null, 'Nome da guilda'));
    campo.append(opcoes.campoDeNome);

    /* =====================================================================
     * O AVISO DE CAPS LOCK
     *
     * "na hora da criação da guild não dá pra distinguir se tô com caps lock
     *  ligado ou não."
     *
     * Não dava mesmo, e aqui isso custa mais caro que no normal: o campo é
     * `text-transform` nenhum, o nome é gravado exatamente como se digita, e o nome
     * de uma guilda **não se troca depois**. "GUILDA DOS REIS" e "Guilda dos Reis"
     * são dois nomes diferentes, e o primeiro fica para sempre.
     *
     * ---- POR QUE `getModifierState` E NAO ADIVINHAR PELA TECLA ----
     *
     * O truque comum — ver se veio uma maiúscula sem Shift — erra em tudo que não
     * seja letra e em teclado com acento morto. `getModifierState('CapsLock')`
     * pergunta ao sistema, e responde certo inclusive quando a tecla foi apertada
     * em outra janela.
     *
     * ---- POR QUE `keyup` TAMBEM ----
     *
     * No `keydown` do próprio Caps Lock, o estado ainda é o ANTERIOR — a tecla que
     * liga o Caps só surte efeito quando sobe. Só com `keydown`, o aviso apareceria
     * uma tecla atrasado: ligado sem aviso, e desligado com aviso.
     * ===================================================================== */
    /* =====================================================================
     * O NOME, CONFERIDO ENQUANTO SE DIGITA
     *
     * "checar disponibilidade enquanto digita, mostrando disponível / já existe /
     *  inválido ao lado do campo. O servidor continua validando no fundar."
     *
     * ---- SEM PEDIDO AO SERVIDOR, E SEM ESPERA ----
     *
     * A tabela de guildas do servidor JÁ está carregada nesta tela — é ela que a
     * aba Servidor desenha. A resposta está na memória do navegador, então não há
     * requisição para atrasar nem `debounce` para calibrar: ela sai na mesma tecla.
     *
     * (Um pedido por tecla, com espera, seria a solução se a lista não estivesse
     * aqui. Ela está, e uma viagem à rede para responder o que já se sabe é uma
     * espera inventada.)
     *
     * ---- E A REGRA E' A DO SERVIDOR, LITERALMENTE ----
     *
     * `recusaDoNome` é a função que o `fundarGuilda` chama, importada do pacote
     * compartilhado. Uma cópia dela aqui diria "pode" para um nome que o servidor
     * recusaria — depois de a pessoa ter montado o brasão inteiro.
     * ===================================================================== */
    const veredito = el('i', 'brasao-veredito escondido');
    const conferirONome = () => {
      const cru = opcoes.campoDeNome.value ?? '';
      const arrumado = nomeArrumado(cru);
      if (!arrumado) {
        veredito.className = 'brasao-veredito escondido';
        veredito.textContent = '';
        nomeServe = false;
        return;
      }
      const recusa = recusaDoNome(cru);
      if (recusa) {
        veredito.className = 'brasao-veredito ruim';
        veredito.textContent = `✗ ${recusa}`;
        nomeServe = false;
        return;
      }
      if ((opcoes.nomesUsados ?? new Set()).has(chaveDoNome(cru))) {
        veredito.className = 'brasao-veredito ruim';
        veredito.textContent = '✗ já existe uma guilda com esse nome';
        nomeServe = false;
        return;
      }
      veredito.className = 'brasao-veredito bom';
      veredito.textContent = '✓ disponível';
      nomeServe = true;
    };
    opcoes.campoDeNome.addEventListener('input', conferirONome);
    campo.append(veredito);

    const aviso = el('i', 'brasao-caps escondido', '⇪ Caps Lock ligado');
    const olharOCaps = (e) => {
      const ligado = e.getModifierState?.('CapsLock');
      /* `undefined` quer dizer "não sei" (navegador sem suporte): não se inventa. */
      if (typeof ligado === 'boolean') aviso.classList.toggle('escondido', !ligado);
    };
    opcoes.campoDeNome.addEventListener('keydown', olharOCaps);
    opcoes.campoDeNome.addEventListener('keyup', olharOCaps);
    /*
     * E um clique no campo também: quem chega com o Caps já ligado descobre ao pôr
     * o cursor, antes de digitar a primeira letra.
     */
    opcoes.campoDeNome.addEventListener('mousedown', olharOCaps);
    campo.append(aviso);

    campo.append(el('i', null, 'De 3 a 24 letras. As iniciais saem daqui.'));
    palco.append(campo);
  }

  /* =======================================================================
   * O NOME NA FONTE ESCOLHIDA, DEBAIXO DO ESCUDO
   *
   * "trocar a fonte atualiza as iniciais e o nome juntos, e o preview do editor
   *  mostra o nome na fonte escolhida."
   *
   * Existia so' no fluxo de TROCAR, escrito uma vez e nunca mais. Agora existe nos
   * dois e e' refeito a cada repintura, junto com o escudo — quem clica na fonte
   * Pesada ve' as iniciais E o nome mudarem no mesmo quadro, que e' a unica forma
   * de decidir se a dupla combina.
   *
   * ---- E O CAMPO DE DIGITAR CONTINUA NA FONTE DA INTERFACE ----
   *
   * De propósito. Ele ja' foi trocado uma vez para a Decorativa e o defeito foi
   * exatamente este: a Cinzel Decorative nao tem minusculas de verdade, e quem
   * digitava nao conseguia ver se estava com o Caps Lock ligado. A previa responde
   * "como vai ficar" sem que o campo deixe de responder "o que eu digitei".
   * ======================================================================= */
  const nomePrevia = el('div', 'brasao-nome-previa');
  palco.append(nomePrevia);

  const conta = el('div', 'brasao-conta');
  palco.append(conta);

  /* =======================================================================
   * RECOMEÇAR
   *
   * "tem que ter um botão que reseta tudo com confirmação."
   *
   * Um editor com quatro abas, seis alvos de cor, três contornos e nove réguas
   * chega num estado em que a pessoa não sabe mais o que mexeu — e o caminho de
   * volta, sem este botão, é fechar e reabrir a tela (que na troca de brasão nem
   * é óbvio que preserva o escudo da guilda).
   *
   * ---- POR QUE ELE PERGUNTA ----
   *
   * É o único gesto da tela que joga fora trabalho, e é irreversível: não há
   * "desfazer o recomeçar". Todo o resto aqui é uma escolha que a próxima escolha
   * corrige.
   *
   * ---- E POR QUE ELE FICA APAGADO QUANDO NADA MUDOU ----
   *
   * Apagado, ele responde de graça uma pergunta que a pessoa faria clicando:
   * "eu mexi em algo?". E um botão que pergunta antes de não fazer nada é um
   * botão que ensina a ignorar a pergunta.
   * ======================================================================= */
  const recomecar = el('button', 'brasao-recomecar', '↺ Recomeçar');
  recomecar.type = 'button';
  tipTexto(
    recomecar,
    opcoes.jaExiste
      ? 'Desfaz tudo o que você mexeu aqui e volta ao brasão que a guilda tem hoje.'
      : 'Desfaz tudo o que você escolheu e volta ao brasão inicial.',
  );
  recomecar.onclick = () => {
    perguntar(
      {
        titulo: 'Recomeçar o brasão',
        texto: opcoes.jaExiste
          ? 'Todas as escolhas desta tela voltam ao brasão que a guilda tem hoje. O brasão da guilda em si não muda — isso só acontece quando você confirma a troca.'
          : 'Todas as escolhas desta tela voltam ao começo: forma, símbolo, iniciais, cores, contornos e posições.',
        botao: 'Recomeçar',
      },
      () => {
        escolha = { ...doInicio };
        /* A roda volta para a forma: o alvo de antes pode nem existir mais. */
        alvo = 'cor';
        ladoDoEfeito = null;
        marcar();
        repintar();
      },
    );
  };
  /* =======================================================================
   * ALEATÓRIO
   *
   * "sorteia forma, símbolo e cores (só cores grátis, nunca efeitos pagos),
   *  garantindo contraste bom."
   *
   * Ele resolve a folha em branco: quarenta formas, vinte e quatro símbolos e uma
   * roda de cor infinita é um começo em que é mais fácil fechar a tela do que
   * escolher. Um sorteio dá um ponto de partida para editar.
   *
   * ---- NUNCA UM EFEITO PAGO ----
   *
   * Um sorteio que pusesse o Fogo Vivo criaria uma conta de 150 coins que a pessoa
   * não pediu, num botão cujo nome não avisa nada disso. O sorteio é de graça, e
   * é só das clássicas.
   *
   * ---- E O CONTRASTE E' GARANTIDO POR TENTATIVA ----
   *
   * Sortear a cor do símbolo e torcer daria escudos monocromáticos com frequência.
   * Ele tenta até achar uma cor que passe do piso — e desiste depois de algumas
   * voltas, caindo no creme, que contrasta com as doze. Um laço sem saída numa
   * função de clique é pior do que uma cor previsível.
   * ======================================================================= */
  /*
   * Classe propria, e nao a do "Recomecar": eles se PARECEM (sao os dois botoes
   * discretos da coluna) mas fazem coisas opostas, e um seletor que os confunde
   * confunde tambem quem procura um dos dois — foi o que aconteceu com o teste,
   * que pegou o primeiro dos dois e passou a medir o botao errado.
   */
  const aleatorio = el('button', 'brasao-aleatorio', '⚄ Aleatório');
  aleatorio.type = 'button';
  tipTexto(
    aleatorio,
    'Sorteia forma, símbolo e cores para você editar a partir daí.' +
      SALTO +
      'Só cores de graça — ele nunca escolhe um efeito pago.',
  );
  aleatorio.onclick = () => {
    const sorteie = (lista) => lista[Math.floor(Math.random() * lista.length)];
    /* Só as de graça: `coins` zerado tira os efeitos da urna. */
    const livres = CORES_CLASSICAS.filter((c) => !c.coins);
    const paraPeca = [...TINTAS_DO_SIMBOLO.filter((c) => !c.coins)];

    const corDaForma = sorteie(livres).id;
    const comContraste = (padrao) => {
      for (let i = 0; i < 24; i++) {
        const tenta = sorteie(paraPeca).id;
        if ((contrasteEntre(tenta, corDaForma) ?? 0) >= CONTRASTE_MINIMO) return tenta;
      }
      return padrao;
    };

    espiada = null;
    escolher({
      forma: sorteie(FORMAS).id,
      /* Uma em seis sem símbolo: um escudo liso com iniciais é um brasão legítimo. */
      simbolo: Math.random() < 0.84 ? sorteie(SIMBOLOS).id : null,
      cor: corDaForma,
      corSimbolo: comContraste('creme'),
      corLetras: comContraste(TINTA_PADRAO_DAS_LETRAS),
      ordem: Math.random() < 0.22 ? 'atras' : 'frente',
    });
  };

  const dupla = el('div', 'brasao-dupla');
  dupla.append(aleatorio, recomecar);
  palco.append(dupla);

  let botaoConfirmar = null;
  if (opcoes.rotuloDoBotao) {
    botaoConfirmar = el('button', 'guilda-botao primario', opcoes.rotuloDoBotao);
    botaoConfirmar.type = 'button';
    botaoConfirmar.disabled = !!opcoes.travado;
    palco.append(botaoConfirmar);
  }

  /* =======================================================================
   * A COLUNA DA DIREITA — QUATRO ABAS, UMA À VISTA
   *
   * "direita: abas internas separadas — [Forma] [Símbolo] [Iniciais] [Cores].
   *  Só a aba ativa aparece. O preview atualiza ao vivo em qualquer aba."
   *
   * ---- POR QUE ABAS, DEPOIS DE TER TIRADO AS ABAS ----
   *
   * Esta tela já foi em abas, virou pilha rolante, e depois quatro colunas lado
   * a lado — "coloque lado a lado as separações e não pra baixo". As colunas
   * cumpriram o "não rola", mas só enquanto as escolhas eram poucas: com as
   * réguas do símbolo, as das letras e TRÊS rodas de cor, não havia arranjo
   * lado a lado que caiba em 1080.
   *
   * O que mudou para as abas voltarem a servir é a prévia. O medo de aba é
   * escolher no escuro — clicar num símbolo sem ver o escudo. Com o palco fixo à
   * esquerda, sempre à vista, a aba esconde as PRATELEIRAS e nunca a resposta.
   *
   * E as quatro perguntas são de verdade sequenciais: que forma, que objeto, que
   * letras, que cores. Só a última precisa das outras três já decididas — e é
   * justamente ela que mostra o alvo de cada cor.
   * ======================================================================= */
  const direita = el('div', 'brasao-lado');
  const fileira = el('div', 'brasao-abas');
  direita.append(fileira);

  const paginas = {};
  const botoesDeAba = {};
  let abaAtual = 'forma';

  const mostrarAba = () => {
    for (const [id, pag] of Object.entries(paginas)) pag.classList.toggle('escondido', id !== abaAtual);
    for (const [id, b] of Object.entries(botoesDeAba)) b.classList.toggle('ligado', id === abaAtual);
  };

  const novaAba = (id, titulo) => {
    const b = el('button', 'brasao-aba', titulo);
    b.type = 'button';
    b.dataset.aba = id;
    b.onclick = () => {
      abaAtual = id;
      mostrarAba();
      /*
       * `marcar` e não só `mostrarAba`: a aba decide QUE PEÇA a prévia move, e é
       * `marcar` quem reescreve a legenda. Sem isto, trocar de aba mudaria o que o
       * arrasto faz sem mudar o que a tela diz que ele faz.
       */
      marcar();
    };
    fileira.append(b);
    botoesDeAba[id] = b;
    const pagina = el('div', 'brasao-pagina');
    pagina.dataset.pagina = id;
    paginas[id] = pagina;
    direita.append(pagina);
    return pagina;
  };

  const pagForma = novaAba('forma', 'Forma');
  const pagSimbolo = novaAba('simbolo', 'Símbolo');
  const pagIniciais = novaAba('iniciais', 'Iniciais');
  const pagCores = novaAba('cores', 'Cores');

  /*
   * ---- A EXPLICACAO MORA NO BALAO, E NUM ALVO PEQUENO ----
   *
   * "organiza pra nao ter toda essa escrita, pq ta poluindo a aba."
   * "tooltips (i) fora da roda e das cores, nunca em cima delas."
   *
   * Um balão nasce colado no dono. Pendurado num título de largura inteira — ou
   * pior, na própria roda de cor — ele nasce COBRINDO o que a pessoa ia clicar, e
   * como o dono é enorme o mouse não sai dele: a impressão é de que travou.
   *
   * Num `ⓘ` de doze pixels o balão nasce ao lado de um alvo pequeno, longe da
   * grade, e sair do alvo é um gesto de um pixel.
   */
  const marcaDeDica = (dica) => {
    const marca = el('i', 'brasao-dica-marca', 'i');
    marca.setAttribute('aria-label', dica);
    tipTexto(marca, dica);
    return marca;
  };

  const tituloDe = (texto, dica = null) => {
    const cabeca = el('h5', 'brasao-titulo', texto);
    if (dica) cabeca.append(marcaDeDica(dica));
    return cabeca;
  };

  /*
   * As três réguas mais o "Centralizar", numa peça só — porque ELAS SERVEM A
   * DUAS COISAS: às iniciais e ao símbolo.
   *
   * Duas cópias disto seriam duas cópias que um dia divergem: um símbolo que
   * anda de um jeito e uma letra que anda de outro, com os mesmos rótulos e os
   * mesmos limites na tela. Aqui os campos chegam por parâmetro e o resto é
   * idêntico por construção — inclusive a largura do rótulo, que é o que impede
   * "TAMANH O" e "HORIZON TAL" de voltarem.
   */
  const reguasDaPeca = (onde, campos, oQueMove) => {
    const barras = {};
    const regua = (rotulo, campo, limite, dica) => {
      const linha = el('label', 'brasao-linha');
      linha.append(el('span', null, rotulo));
      const barra = document.createElement('input');
      barra.type = 'range';
      barra.className = 'brasao-regua';
      barra.min = String(limite.minimo);
      barra.max = String(limite.maximo);
      barra.step = '1';
      barra.dataset.campo = campo;
      if (dica) tipTexto(barra, dica);
      barra.oninput = () => escolher({ [campo]: Number(barra.value) });
      linha.append(barra);
      onde.append(linha);
      barras[campo] = barra;
      return barra;
    };

    regua(
      'Tamanho',
      campos.tam,
      LIMITE_DO_TAMANHO,
      `100% é o tamanho que cabe. Os limites existem para ${oQueMove} não vazar do escudo.`,
    );
    regua('Horizontal', campos.x, LIMITE_DO_LUGAR, `Move ${oQueMove} para os lados.`);
    regua('Vertical', campos.y, LIMITE_DO_LUGAR, `Move ${oQueMove} para cima e para baixo.`);

    const centrar = el('button', 'brasao-chave', 'Centralizar');
    centrar.type = 'button';
    tipTexto(centrar, 'Devolve o tamanho e o lugar ao padrão.');
    centrar.onclick = () =>
      escolher({
        [campos.tam]: LIMITE_DO_TAMANHO.padrao,
        [campos.x]: LIMITE_DO_LUGAR.padrao,
        [campos.y]: LIMITE_DO_LUGAR.padrao,
      });
    onde.append(centrar);

    /* Põe as três no que está escolhido agora. */
    return () => {
      for (const [campo, barra] of Object.entries(barras)) {
        const limite = campo === campos.tam ? LIMITE_DO_TAMANHO : LIMITE_DO_LUGAR;
        barra.value = String(presoEntre(escolha[campo], limite));
      }
    };
  };

  /* =======================================================================
   * ABA FORMA — uma grade de seis
   *
   * "grade de 6 colunas."
   *
   * Grade de verdade (`grid-template-columns`) e não linha que quebra: com
   * quarenta amostras do mesmo tamanho, o que se faz aqui é VARRER, e varrer
   * exige colunas alinhadas. Numa fileira que quebra sozinha, o número de
   * colunas muda com a largura da janela e a mesma forma nunca está no mesmo
   * lugar duas vezes.
   * ======================================================================= */
  pagForma.append(tituloDe('Forma', 'O contorno do escudo. Ele recebe a cor da guilda.'));
  const gradeForma = el('div', 'brasao-grade seis');
  /*
   * "a pessoa tem que ter a opção de tirar a forma (...) e deixar só o símbolo."
   *
   * Primeiro item, como o "Nenhum" dos símbolos — e pela mesma razão: um brasão
   * sem escudo é uma escolha legítima, e sem este botão quem clicasse numa forma
   * por engano não teria como voltar a não ter nenhuma.
   */
  const semForma = el('button', 'brasao-opcao vazio', '—');
  semForma.type = 'button';
  semForma.dataset.forma = FORMA_NENHUMA;
  tipTexto(semForma, 'Sem forma — fica só o símbolo e as iniciais, sem escudo');
  semForma.onclick = () => escolher({ forma: FORMA_NENHUMA });
  gradeForma.append(semForma);

  for (const forma of FORMAS) {
    const b = el('button', 'brasao-opcao');
    b.type = 'button';
    b.dataset.forma = forma.id;
    const arte = el('span', 'brasao-amostra');
    arte.style.setProperty('--amostra', `url('${arteDaForma(forma.id)}')`);
    b.append(arte);
    tipTexto(b, forma.nome);
    b.onclick = () => escolher({ forma: forma.id });
    gradeForma.append(b);
  }
  pagForma.append(gradeForma);

  /* =======================================================================
   * O TAMANHO E O LUGAR DA FORMA
   *
   * "o tamanho e posicionamento da forma tem que ser alterável também (mas sem
   *  passar dos limites que quebrariam o modal)."
   *
   * As MESMAS réguas do símbolo e das iniciais, com os mesmos limites do catálogo
   * — é isso que cumpre o "sem passar dos limites": uma régua não tem como
   * devolver um valor fora da faixa, e a faixa está escrita num lugar só.
   *
   * Some quando não há forma escolhida: não há onde pôr um escudo que não existe.
   * ======================================================================= */
  const ajustesDaForma = el('div', 'brasao-sub');
  ajustesDaForma.append(
    tituloDe('Lugar e tamanho', 'Também dá para arrastar a forma na prévia grande.'),
  );
  const sincronizarReguasDaForma = reguasDaPeca(
    ajustesDaForma,
    { tam: 'formaTam', x: 'formaX', y: 'formaY' },
    'a forma',
  );
  pagForma.append(ajustesDaForma);

  /* =======================================================================
   * ABA SÍMBOLO — a grade de oito, as camadas e as réguas
   *
   * "Nenhum primeiro; Armas, Animais e Insígnias numa grade de 8 colunas com
   *  rótulos pequenos separando. Embaixo: Camadas. Mover o símbolo: réguas."
   *
   * Escolher o leão, decidir se ele fica dentro ou atrás do escudo e dizer onde
   * ele fica são a MESMA conversa. Espalhadas em três lugares (era assim: a
   * grade numa coluna, as camadas no palco, as réguas colada na grade), a pessoa
   * atravessava a tela para terminar uma frase.
   * ======================================================================= */
  pagSimbolo.append(tituloDe('Símbolo', 'O objeto do brasão. Pode não ter nenhum.'));
  const gradeSimbolo = el('div', 'brasao-grade oito');
  const semNada = el('button', 'brasao-opcao vazio', '—');
  semNada.type = 'button';
  semNada.dataset.simbolo = '';
  tipTexto(semNada, 'Sem símbolo — o escudo fica liso');
  semNada.onclick = () => escolher({ simbolo: null });
  gradeSimbolo.append(semNada);

  let grupoAtual = null;
  for (const simbolo of SIMBOLOS) {
    if (simbolo.grupo !== grupoAtual) {
      grupoAtual = simbolo.grupo;
      gradeSimbolo.append(el('span', 'brasao-grupo', grupoAtual));
    }
    const b = el('button', 'brasao-opcao');
    b.type = 'button';
    b.dataset.simbolo = simbolo.id;
    const arte = el('span', 'brasao-amostra simbolo');
    arte.style.setProperty('--amostra', `url('${arteDoSimbolo(simbolo.id)}')`);
    b.append(arte);
    tipTexto(b, simbolo.nome);
    b.onclick = () => escolher({ simbolo: simbolo.id });
    gradeSimbolo.append(b);
  }
  pagSimbolo.append(gradeSimbolo);

  /* ---- camadas ----
   *
   * "tem que ter opção de escolher por símbolo por cima da forma e vice-versa."
   *
   * Não é um detalhe de gosto: são dois desenhos diferentes. Dentro é a heráldica
   * normal — o objeto cabe no escudo. Atrás é o brasão de armas clássico, com as
   * espadas saindo pelas beiradas, e muda o que as MESMAS duas peças parecem.
   */
  const ajustesDoSimbolo = el('div', 'brasao-sub');
  ajustesDoSimbolo.append(tituloDe('Camadas', 'Onde o símbolo fica em relação ao escudo.'));
  const parOrdem = el('div', 'brasao-par');
  for (const ordem of ORDENS) {
    const b = el('button', 'brasao-chave', ordem.nome);
    b.type = 'button';
    b.dataset.ordem = ordem.id;
    tipTexto(
      b,
      ordem.id === 'frente'
        ? 'O objeto cabe dentro do contorno, como num brasão de heráldica.'
        : 'O objeto fica maior que o escudo e aparece pelas beiradas.',
    );
    b.onclick = () => escolher({ ordem: ordem.id });
    parOrdem.append(b);
  }
  ajustesDoSimbolo.append(parOrdem);

  ajustesDoSimbolo.append(
    tituloDe('Lugar e tamanho', 'Também dá para arrastar o símbolo na prévia grande.'),
  );
  const sincronizarReguasDoSimbolo = reguasDaPeca(
    ajustesDoSimbolo,
    { tam: 'simboloTam', x: 'simboloX', y: 'simboloY' },
    'o símbolo',
  );
  pagSimbolo.append(ajustesDoSimbolo);

  /* =======================================================================
   * ABA INICIAIS
   *
   * "Com/Sem, letras, réguas Tamanho, Horizontal, Vertical + Centralizar."
   *
   * Os três controles de lugar são RÉGUAS e não campos de número, e é isso que
   * cumpre o "sem quebrar, com limite": uma régua não tem como devolver um valor
   * fora da faixa, e a faixa está escrita no `min`/`max` que vêm do catálogo. O
   * campo de texto, que é o único que aceita digitação, passa pela peneira do
   * catálogo a cada tecla — três caracteres, letra ou número, e nada mais.
   * ======================================================================= */
  pagIniciais.append(
    tituloDe('Iniciais', 'As letras no meio do escudo. Vazio = as iniciais do nome da guilda.'),
  );
  const parLetras = el('div', 'brasao-par');
  for (const [ligado, titulo, texto] of [
    [true, 'Com', 'As letras do nome, no meio do escudo.'],
    [false, 'Sem', 'Só o escudo e o símbolo, sem letra nenhuma.'],
  ]) {
    const b = el('button', 'brasao-chave', titulo);
    b.type = 'button';
    b.dataset.letras = ligado ? '1' : '0';
    tipTexto(b, texto);
    b.onclick = () => escolher({ letras: ligado });
    parLetras.append(b);
  }
  pagIniciais.append(parLetras);

  const ajustes = el('div', 'brasao-sub');
  const campoTexto = document.createElement('input');
  campoTexto.type = 'text';
  campoTexto.className = 'guilda-campo brasao-letras-campo';
  campoTexto.maxLength = MAXIMO_DE_LETRAS;
  campoTexto.spellcheck = false;
  campoTexto.autocomplete = 'off';
  tipTexto(
    campoTexto,
    `Até ${MAXIMO_DE_LETRAS} letras ou números.${SALTO}Vazio = as iniciais do nome da guilda.`,
  );
  campoTexto.oninput = () => {
    /*
     * A caixa alta e o corte acontecem AQUI e não só no catálogo: sem isso, a
     * pessoa digita quatro letras, vê quatro no campo, e o escudo mostra três —
     * e a tela passa a discordar de si mesma enquanto se digita.
     */
    const limpo = campoTexto.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAXIMO_DE_LETRAS);
    if (campoTexto.value !== limpo) campoTexto.value = limpo;
    escolher({ texto: limpo || null });
  };
  const linhaTexto = el('label', 'brasao-linha');
  linhaTexto.append(el('span', null, 'Letras'));
  linhaTexto.append(campoTexto);
  ajustes.append(linhaTexto);

  ajustes.append(
    tituloDe('Lugar e tamanho', 'Também dá para arrastar as letras na prévia grande.'),
  );
  const sincronizarReguasDasLetras = reguasDaPeca(
    ajustes,
    { tam: 'letrasTam', x: 'letrasX', y: 'letrasY' },
    'as letras',
  );
  pagIniciais.append(ajustes);

  /* =======================================================================
   * A FONTE DAS INICIAIS — E DO NOME DA GUILDA
   *
   * "é possível ter opção pra escolher algumas fontes pro nome da guilda, ao
   *  criar? e nas iniciais? daria lag isso?"
   *
   * Dá, e não dá lag: nenhuma das seis baixa nada. Duas já vêm carregadas em toda
   * página do jogo e do site, e as outras quatro são pilhas de fonte do sistema.
   * A lista e o porquê de cada uma estão no catálogo (`FONTES`).
   *
   * ---- CADA TECLA ESCREVE NA PRÓPRIA FONTE ----
   *
   * O nome de uma fonte não diz nada a quem não conhece fontes — "Máquina" e
   * "Livro" são palavras. A tecla mostra as INICIAIS de verdade desenhadas nela,
   * que é a única coisa que responde a pergunta que a pessoa está fazendo.
   *
   * ---- POR QUE ELA MORA NAS INICIAIS ----
   *
   * Porque é ali que a fonte se vê. Ela também pinta o nome da guilda no cartaz e
   * na página do site, mas quem escolhe está olhando para as letras do escudo.
   * ======================================================================= */
  const linhaDaFonte = el('div', 'brasao-fonte-linha');
  const rotuloDaFonte = el('span', 'brasao-alvos-rotulo', 'Fonte');
  rotuloDaFonte.append(
    marcaDeDica(
      'A letra das iniciais, e também a do nome da guilda no cartaz.' +
        SALTO +
        'Nenhuma delas deixa o jogo mais lento: já estão todas carregadas.',
    ),
  );
  const parFonte = el('div', 'brasao-fontes');
  for (const fonte of FONTES) {
    const b = el('button', 'brasao-fonte');
    b.type = 'button';
    b.dataset.fonte = fonte.id;
    const amostra = el('b', 'brasao-fonte-amostra');
    amostra.style.fontFamily = fonte.css;
    b.append(amostra, el('span', null, fonte.nome));
    tipTexto(b, `${fonte.nome} — as iniciais e o nome da guilda nesta letra.`);
    b.onclick = () => escolher({ fonte: fonte.id });
    parFonte.append(b);
  }
  linhaDaFonte.append(rotuloDaFonte, parFonte);
  pagIniciais.append(linhaDaFonte);

  /* =======================================================================
   * ABA CORES — UMA RODA SÓ, E UM ALVO
   *
   * "apagar as três rodas separadas. Fica UMA roda + régua de brilho + nome da
   *  cor. Em cima, seletor segmentado com o que está sendo pintado."
   *
   * ---- POR QUE UMA RODA RESOLVE O QUE TRÊS NÃO RESOLVIAM ----
   *
   * Três rodas eram três vezes a mesma peça alta, e foi o que empilhou a tela
   * até passar de 1080 — e agora seriam QUATRO, com o contorno. Mas o motivo de
   * fundo não é espaço: é que uma roda de cor é um instrumento, e ter três
   * instrumentos idênticos na tela faz a pessoa perguntar qual é qual antes de
   * cada gesto. Um instrumento com um seletor de alvo responde essa pergunta uma
   * vez, e a resposta fica escrita na tela (o segmento aceso).
   *
   * As bolinhas do seletor são o que substitui as três rodas visíveis: elas dizem
   * de uma olhada que cor cada peça tem, que era a única coisa que ver as três
   * rodas ao mesmo tempo dava.
   * ======================================================================= */
  pagCores.append(
    tituloDe(
      'Cores',
      'Escolha primeiro o que vai pintar, depois a cor.' +
        SALTO +
        'A roda dá qualquer cor, de graça. Os efeitos são acabamentos que a roda não sabe fazer.',
    ),
  );

  /* Qual peça a roda está pintando agora. */
  let alvo = 'cor';
  /* =======================================================================
   * A ESPIADA — o efeito posto no escudo só enquanto o mouse está em cima
   *
   * "hover num efeito pago aplica temporariamente no preview da peça
   *  selecionada; sair do hover volta ao que estava."
   *
   * A amostra de 32 pixels mostra a RECEITA do efeito, e não o efeito na peça: o
   * Ouro num quadradinho e o Ouro num leão de doze pixels são coisas diferentes, e
   * era preciso comprar para descobrir qual.
   *
   * É uma variável separada de `escolha` de propósito. Ela NÃO passa por
   * `escolher` — não marca prateleira, não refaz a conta, não avisa o `aoMudar`.
   * Ela só troca o que o desenho lê. Se a espiada mexesse na escolha, sair do
   * mouse teria de desfazer, e um desfazer que erra deixa a pessoa com um efeito
   * de 150 coins que ela só passou por cima.
   * ======================================================================= */
  let espiada = null;
  /*
   * ---- E, DENTRO DE UM EFEITO DE DUAS CORES, QUAL DAS DUAS ----
   *
   * `null` = a roda pinta o alvo inteiro. `0`/`1` = ela pinta um dos dois lados
   * do efeito (ver a engrenagem, abaixo). É o mesmo instrumento nos dois casos,
   * e é por isso que a engrenagem não precisou de rodas próprias.
   */
  let ladoDoEfeito = null;

  const alvoAgora = () => ALVOS_DE_COR.find((a) => a.campo === alvo) ?? ALVOS_DE_COR[0];
  const alvoServe = (a) => !a.precisa || a.precisa(escolha);

  /**
   * A pintura que um alvo tem AGORA, já resolvida — é o que a bolinha mostra.
   *
   * Nos contornos ela pergunta ao catálogo (`corQueOContornoTeria`) e não lê o
   * campo: sem cor própria, o contorno segue o escudo, e uma bolinha vazia ali
   * esconderia justamente a cor que o brasão vai usar. Ela responde MESMO com o
   * contorno desligado — quem está escolhendo precisa ver antes de ligar.
   */
  const pinturaDoAlvo = (alvo) => {
    if (alvo.tipo === 'contorno') return corQueOContornoTeria(escolha, alvo.peca) ?? '#33689e';
    return tintaPorId(escolha[alvo.campo])?.css ?? '#33689e';
  };

  /** As duas cores de um efeito tingível, como estão agora. */
  const duasCoresDe = (valor) => {
    const tinta = tintaPorId(valor);
    const base = EFEITOS.find((e) => e.id === idDoEfeito(tinta));
    if (!base?.duasCores) return null;
    return { base, cores: tinta?.cores ?? base.duasCores.padrao };
  };

  /* ---- o seletor, em duas fileiras de tres ---- */
  const tiraDeAlvos = el('div', 'brasao-alvos');
  const botoesDeAlvo = {};
  for (const [tipo, rotulo, dica] of [
    ['pintura', 'Pintura', 'De que cor a peça é.'],
    ['contorno', 'Contorno', 'A linha em volta da peça. Cada uma tem a sua, e todas são opcionais.'],
  ]) {
    /*
     * O rótulo da fileira é a primeira célula da grade, e não um título acima
     * dela: assim ele fica NA linha dos três botões, e a leitura por cruzamento
     * (coluna da peça × fileira do tipo) funciona sem o olho subir.
     */
    const marca = el('span', 'brasao-alvos-rotulo', rotulo);
    marca.append(marcaDeDica(dica));
    tiraDeAlvos.append(marca);
    for (const a of ALVOS_DE_COR.filter((x) => x.tipo === tipo)) {
      const b = el('button', 'brasao-alvo');
      b.type = 'button';
      b.dataset.alvo = a.campo;
      const bolinha = el('span', 'brasao-alvo-bolinha');
      b.append(bolinha, el('b', null, a.nome));
      tipTexto(b, a.dica);
      b.onclick = () => {
        if (b.disabled) return;
        alvo = a.campo;
        /* Trocar de peça fecha a engrenagem: os dois lados eram do efeito de lá. */
        ladoDoEfeito = null;
        marcar();
      };
      tiraDeAlvos.append(b);
      botoesDeAlvo[a.campo] = { botao: b, bolinha };
    }
  }
  pagCores.append(tiraDeAlvos);

  /* =======================================================================
   * A LINHA QUE SÓ OS CONTORNOS TÊM
   *
   * Duas coisas existem para um contorno e não para uma pintura, e por isso a
   * linha aparece só quando o alvo selecionado é um dos três contornos:
   *
   *   Sem / Com     o contorno é opcional ("isso como padrão não pode acontecer,
   *                 só se a pessoa quiser"), e o interruptor é dele. Uma pintura
   *                 não tem "sem": a peça é de alguma cor.
   *   Seguir o      volta ao padrão `null` — a cor do escudo. Sem este botão, a
   *   escudo        pessoa que escolheu uma cor não teria como DESescolher, e o
   *                 contorno ficaria preso longe do escudo para sempre.
   *
   * ---- UMA LINHA PARA OS TRÊS, E NÃO TRÊS LINHAS ----
   *
   * Ela escreve no campo do alvo SELECIONADO (`alvoAgora().ligado`), que é a
   * mesma economia da roda: um instrumento, e um alvo. Três cópias desta linha
   * seriam três cópias que um dia divergem — um contorno que liga de um jeito e
   * outro que liga de outro, com os mesmos dois botões na tela.
   * ======================================================================= */
  const linhaDoContorno = el('div', 'brasao-contorno-linha');

  /* =======================================================================
   * QUÃO GROSSO, OU NADA
   *
   * "o contorno tem que ter opção pra selecionar o tamanho da sombra, ou se vai
   *  ser contorno fino etc."
   *
   * Quatro teclas e não um par Sem/Com mais uma régua de raio: "tem contorno?" e
   * "de que espessura?" são a MESMA pergunta com quatro respostas, e uma régua
   * pediria a quem quer um fio que descobrisse em que número fica um fio — número
   * que muda com o tamanho do brasão.
   * ======================================================================= */
  const rotuloDaGrossura = el('span', 'brasao-alvos-rotulo', 'Grossura');
  rotuloDaGrossura.append(marcaDeDica('A espessura da linha. "Sem" tira o contorno desta peça.'));
  const parGrossura = el('div', 'brasao-par');
  for (const passo of [{ id: '', nome: 'Sem', dica: 'Nada em volta desta peça.' }, ...GROSSURAS]) {
    const b = el('button', 'brasao-chave', passo.nome);
    b.type = 'button';
    b.dataset.grossura = passo.id;
    tipTexto(
      b,
      passo.dica ??
        `Contorno ${passo.nome.toLowerCase()}. No símbolo e nas iniciais ele acompanha o tamanho do brasão; na forma é um brilho de ${passo.halo}, cravado para se ver a 28 pixels.`,
    );
    b.onclick = () => {
      const campo = alvoAgora().ligado;
      if (campo) escolher({ [campo]: passo.id || false });
    };
    parGrossura.append(b);
  }

  /* =======================================================================
   * DE QUEM ELE PEGA A COR
   *
   * "o contorno da forma, quando eu clico em símbolo, tem que ter seguir com a
   *  forma; e quando eu clicar em forma e o símbolo estiver com contorno, seguir
   *  com o símbolo, e etc pra letras também."
   *
   * O caso comum de três contornos é os três da MESMA cor — é o que parece
   * desenhado de propósito. Sem estes botões, mudar essa cor seria mudar em três
   * lugares, e um esquecido deixaria um contorno de cor solta.
   *
   * A fileira é REDESENHADA a cada `marcar()` porque as opções dependem do alvo
   * (uma peça não se segue a si mesma) e de quais peças existem. Montada uma vez,
   * ela ofereceria "seguir o símbolo" num brasão sem símbolo.
   * ======================================================================= */
  const rotuloDoSegue = el('span', 'brasao-alvos-rotulo', 'Segue');
  rotuloDoSegue.append(
    marcaDeDica(
      'De quem este contorno pega a cor.' +
        SALTO +
        'Escolher uma cor na roda desliga o "segue" — a peça passa a ter cor própria.',
    ),
  );
  const parSegue = el('div', 'brasao-par');

  /*
   * ---- A COR QUE ESTAVA LA' ANTES DO "SEGUE" ----
   *
   * "quando eu tiver selecionado e clicar novamente, ele tira e volta pro padrão
   *  que eu tinha escolhido."
   *
   * Sem isto, pôr um contorno para seguir outro era uma porta de mão única: a cor
   * própria era sobrescrita pelo ponteiro, e desfazer o gesto queria dizer procurar
   * a cor de novo na roda — sem saber qual era, porque a tela já não a mostrava.
   *
   * Uma memória por campo, e só da cor PRÓPRIA: guardar um ponteiro aqui faria um
   * "voltar" devolver outro "segue", que não é voltar.
   */
  const corGuardada = {};

  linhaDoContorno.append(rotuloDaGrossura, parGrossura, rotuloDoSegue, parSegue);
  pagCores.append(linhaDoContorno);

  /** Remonta as opções de "segue" para o contorno que está selecionado. */
  const desenharSegue = () => {
    parSegue.innerHTML = '';
    const daVez = alvoAgora();
    if (daVez.tipo !== 'contorno') return;

    const seguindo = segueQualPeca(escolha[daVez.campo]);
    const proprio = escolha[daVez.campo] != null && !seguindo;

    /*
     * A primeira opção é `null`, o padrão de fábrica: a cor da PINTURA da forma.
     * Ela existe para todas as três — inclusive para o contorno da forma, e ali é
     * o caminho de volta depois de escolher uma cor.
     */
    const opcoes = [
      { valor: null, nome: 'A cor da forma', dica: 'O contorno usa a cor da pintura da forma, e muda junto com ela.' },
      ...PECAS_COM_CONTORNO.filter((x) => x.peca !== daVez.peca).map((x) => ({
        valor: `=${x.peca}`,
        peca: x.peca,
        nome: `Contorno ${x.peca === 'forma' ? 'da forma' : x.peca === 'simbolo' ? 'do símbolo' : 'das iniciais'}`,
        dica: `Usa a mesma cor do contorno ${x.nome.toLowerCase()}. Mudando lá, muda aqui.`,
      })),
    ];

    for (const opcao of opcoes) {
      const b = el('button', 'brasao-chave', opcao.nome);
      b.type = 'button';
      b.dataset.segue = opcao.valor ?? '';
      /*
       * Só se pode seguir uma peça que EXISTE. Apagado e não escondido: a fileira
       * não muda de largura, e o motivo ("não há símbolo") fica visível no lugar
       * onde a pessoa procurou.
       */
      const alvoDoSegue = opcao.peca ? ALVOS_DE_COR.find((x) => x.tipo === 'contorno' && x.peca === opcao.peca) : null;
      const serve = !alvoDoSegue || alvoServe(alvoDoSegue);
      b.disabled = !serve;
      b.classList.toggle('ligado', opcao.valor == null ? !proprio && !seguindo : seguindo === opcao.peca);
      tipTexto(b, serve ? opcao.dica : 'Esta peça não existe neste brasão.');
      b.onclick = () => {
        if (b.disabled) return;
        ladoDoEfeito = null;
        const atual = escolha[daVez.campo];
        const jaEhEste = opcao.valor == null ? atual == null : segueQualPeca(atual) === opcao.peca;
        if (jaEhEste) {
          /*
           * Clicar no que já está aceso DESLIGA, e devolve a cor que estava ali
           * antes — o gesto de ligar tem de ter o inverso, e o inverso não pode ser
           * "escolha tudo de novo".
           *
           * Sem memória nenhuma, volta para `null` (a cor da forma), que é o padrão
           * de fábrica: é a única resposta honesta quando não houve cor própria.
           */
          escolher({ [daVez.campo]: corGuardada[daVez.campo] ?? null });
          return;
        }
        /* Saindo de uma cor própria, ela fica guardada para a volta. */
        if (atual != null && !segueQualPeca(atual)) corGuardada[daVez.campo] = atual;
        escolher({ [daVez.campo]: opcao.valor });
      };
      parSegue.append(b);
    }
  };

  /* =======================================================================
   * A RODA
   *
   * Um `conic-gradient` com um radial branco por cima É a definição de HSV com
   * v=1 — ver o CSS. A conta abaixo usa o MESMO referencial (ângulo a partir do
   * topo, no sentido do relógio), e é isso que faz a cor debaixo do dedo ser a
   * cor que se leva.
   * ======================================================================= */
  const pratoDaRoda = el('div', 'brasao-prato');
  const roda = el('div', 'brasao-roda');
  const marcaDaRoda = el('span', 'brasao-roda-marca');
  roda.append(marcaDaRoda);

  const brilho = document.createElement('input');
  brilho.type = 'range';
  brilho.className = 'brasao-brilho';
  brilho.min = '5';
  brilho.max = '100';
  brilho.step = '1';

  const leitura = el('div', 'brasao-hex');
  const amostraDaLeitura = el('span', 'brasao-hex-cor');
  const escrito = el('b', null, '');
  leitura.append(amostraDaLeitura, escrito);

  const ladoDaRoda = el('div', 'brasao-roda-lado');
  ladoDaRoda.append(brilho, leitura);
  pratoDaRoda.append(roda, ladoDaRoda);
  pagCores.append(pratoDaRoda);

  /*
   * O estado da roda é SEPARADO da escolha, e tem de ser: quando a peça está
   * pintada com um efeito (um degradê, que não é um ponto do círculo), a roda
   * não teria onde se pôr. Guardando aqui a última cor, voltar do efeito para a
   * cor é um arrasto e não um recomeço.
   */
  let hsv = hexParaHsv('#33689e');

  /**
   * O hex do que a roda está pintando agora — ou `null` quando é um efeito.
   *
   * `null` é o que acende o "dormindo": a roda continua na tela, apagada, porque
   * ela é o caminho de volta. Escondê-la faria a pessoa que clicou no Ouro por
   * curiosidade achar que perdeu a roda.
   */
  const hexDoAlvo = () => {
    if (ladoDoEfeito != null) {
      const par = duasCoresDe(escolha[alvo]);
      if (par) return par.cores[ladoDoEfeito];
    }
    const valor = escolha[alvo];
    /*
     * Um contorno sem cor própria segue o escudo, e a roda mostra ESSA cor: é
     * dali que o próximo arrasto vai partir. Vale para os três contornos.
     *
     * A peneira do hex existe porque a cor herdada pode ser o `brilho` de um
     * efeito, e um dia pode não ser um `#rrggbb` — a roda não sabe se pôr num
     * valor que não seja um ponto do círculo.
     */
    if (alvoAgora().tipo === 'contorno' && valor == null) {
      const herdada = corQueOContornoTeria(escolha, alvoAgora().peca);
      return ehCorLivre(herdada) ? herdada.toLowerCase() : '#33689e';
    }
    /*
     * `hexDaPintura` e não `ehCorLivre`: uma cor com acabamento (`metal~a8323c`)
     * não é um hex, mas É um ponto do círculo com uma receita em volta — a roda
     * tem de continuar funcionando nela, senão escolher "metálica" apagaria a roda.
     */
    const livre = hexDaPintura(valor);
    if (livre) return livre;
    const posto = tintaPorId(valor);
    if (posto && !posto.coins) return hexDaEscolha(valor, alvoAgora().padrao ?? '#33689e');
    return null;
  };

  /**
   * Escreve uma pintura no alvo.
   *
   * Dois cuidados que não são do chamador:
   *
   *   o contorno      escolher a cor de um contorno desligado seria escolher a cor
   *   LIGA            de uma coisa que não aparece: o gesto não mudaria nada na
   *                   tela, e a pessoa concluiria que a roda não funciona neste
   *                   alvo. O interruptor continua ali para desligar de novo.
   *   dentro do       com um lado da engrenagem selecionado, a cor entra DENTRO
   *   efeito          do efeito e o campo continua guardando o efeito.
   */
  const pintar = (valor) => {
    const a = alvoAgora();
    const mudanca = { [a.campo]: valor };
    /* Liga no degrau do meio — o único que existia antes de haver degraus. */
    if (a.ligado && valor != null && !grossuraDoContorno(escolha[a.ligado])) {
      mudanca[a.ligado] = GROSSURA_PADRAO;
    }
    escolher(mudanca);
  };

  const pintarComHex = (hex) => {
    if (ladoDoEfeito != null) {
      const par = duasCoresDe(escolha[alvo]);
      if (par) {
        const cores = [...par.cores];
        cores[ladoDoEfeito] = hex;
        pintar(tingir(par.base.id, cores[0], cores[1]));
        return;
      }
    }
    /*
     * O acabamento SOBREVIVE ao arrasto. Sem isto, quem escolheu "metálica" e
     * depois mexeu na roda perderia o metal no primeiro movimento — e não teria
     * como saber por quê, porque o gesto que ele fez era sobre a cor.
     *
     * Só nas pinturas: um contorno é uma cor só, sem material.
     */
    const atual = alvoAgora().tipo === 'pintura' ? acabamentoDe(escolha[alvo]) : null;
    pintar(atual && atual !== ACABAMENTO_PADRAO ? tintaComAcabamento(hex, atual) : hex);
  };

  const mandarDaRoda = () => pintarComHex(hsvParaHex(hsv.h, hsv.s, hsv.v));

  const apontar = (e) => {
    const r = roda.getBoundingClientRect?.();
    const raio = Math.min(r?.width ?? 0, r?.height ?? 0) / 2;
    if (!raio) return;
    const dx = (e.clientX ?? 0) - (r.left + r.width / 2);
    const dy = (e.clientY ?? 0) - (r.top + r.height / 2);
    /*
     * O ângulo é medido a partir do TOPO e no sentido do relógio — que é o mesmo
     * referencial do `conic-gradient` que desenha a roda. Qualquer outro e a cor
     * debaixo do dedo não seria a cor escolhida.
     */
    hsv = {
      ...hsv,
      h: ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360,
      s: Math.min(1, Math.hypot(dx, dy) / raio),
    };
    mandarDaRoda();
  };

  let arrastandoARoda = false;
  roda.addEventListener('pointerdown', (e) => {
    arrastandoARoda = true;
    /*
     * A captura é o que faz o arrasto continuar valendo com o dedo FORA do
     * círculo — e sair do círculo é normal: é assim que se chega à cor pura da
     * beirada sem tremer.
     */
    roda.setPointerCapture?.(e.pointerId);
    e.preventDefault?.();
    apontar(e);
  });
  roda.addEventListener('pointermove', (e) => {
    if (arrastandoARoda) apontar(e);
  });
  const soltarARoda = () => {
    arrastandoARoda = false;
  };
  roda.addEventListener('pointerup', soltarARoda);
  roda.addEventListener('pointercancel', soltarARoda);

  brilho.oninput = () => {
    hsv = { ...hsv, v: Math.max(0.05, Number(brilho.value) / 100) };
    mandarDaRoda();
  };

  /* =======================================================================
   * AS DOZE PRONTAS
   *
   * "~12 cores prontas."
   *
   * Elas são as doze clássicas do catálogo — as mesmas que as guildas antigas
   * usam, e é isso que as torna as certas para a prateleira: já estão
   * equilibradas entre si e nenhuma delas fica invisível contra o creme do
   * símbolo. A roda continua dando qualquer cor; estas só poupam o arrasto no
   * caso comum.
   *
   * O que elas gravam é o HEX e não o id da clássica, e é de propósito: assim um
   * clique numa pronta e um arrasto até a mesma cor dão exatamente o mesmo
   * brasão, e a roda continua no lugar certo depois do clique.
   * ======================================================================= */
  /* =======================================================================
   * O ACABAMENTO — de que material a peça é feita
   *
   * "todas as cores têm que ter opção pra escolher cores sólida ou metálica ou
   *  fosca."
   *
   * Uma cor da roda saía sempre chapada — um material só, plástico. O acabamento
   * mantém a cor e troca a superfície: bandas de luz (metal) ou nenhuma (fosco).
   *
   * ---- ELA APARECE SÓ NAS PINTURAS, E SÓ SOBRE UMA COR DA RODA ----
   *
   * Num CONTORNO não faz sentido: o contorno é um `drop-shadow`, e um `drop-shadow`
   * quer uma cor — não há superfície para ter acabamento.
   *
   * Sobre um EFEITO pago também não: o Ouro já É um acabamento, com doze paradas de
   * metal. Um "fosco" por cima dele seria duas receitas disputando a mesma peça.
   * ======================================================================= */
  const linhaDoAcabamento = el('div', 'brasao-acabamento-linha');
  const rotuloDoAcabamento = el('span', 'brasao-alvos-rotulo', 'Acabamento');
  rotuloDoAcabamento.append(
    marcaDeDica(
      'A mesma cor em três materiais.' +
        SALTO +
        'A metálica é grátis e fica parada; o Ouro e a Prata são pagos, têm o dobro de bandas e se mexem.',
    ),
  );
  const parAcabamento = el('div', 'brasao-par');
  for (const acabamento of ACABAMENTOS) {
    const b = el('button', 'brasao-chave', acabamento.nome);
    b.type = 'button';
    b.dataset.acabamento = acabamento.id;
    tipTexto(b, acabamento.dica);
    b.onclick = () => {
      const hex = hexDaPintura(escolha[alvo]);
      if (hex) pintar(tintaComAcabamento(hex, acabamento.id));
    };
    parAcabamento.append(b);
  }
  linhaDoAcabamento.append(rotuloDoAcabamento, parAcabamento);
  pagCores.append(linhaDoAcabamento);

  const prontas = el('div', 'brasao-prontas');
  for (const pronta of CORES_CLASSICAS) {
    const b = el('button', 'brasao-pronta');
    b.type = 'button';
    b.dataset.cor = pronta.css;
    b.style.background = pronta.css;
    tipTexto(b, pronta.nome);
    b.onclick = () => pintarComHex(pronta.css);
    prontas.append(b);
  }
  pagCores.append(prontas);

  /* =======================================================================
   * OS EFEITOS, NUMA LINHA SÓ
   *
   * "os efeitos pagos (numa linha só) aplicam no alvo selecionado."
   *
   * Eram três fileiras (uma por roda) com os mesmos oito botões. Agora são oito
   * botões, e o que muda é para onde eles vão — que é a mesma economia do
   * seletor de alvo.
   * ======================================================================= */
  pagCores.append(
    tituloDe(
      'Efeitos',
      'Acabamentos que a roda não sabe fazer: metal em bandas, veias, brilho que anda.' +
        SALTO +
        'Cada um se paga UMA vez por guilda, e depois vale em qualquer peça.',
    ),
  );
  const tiraDeEfeitos = el('div', 'brasao-grade cores');
  for (const efeito of EFEITOS) {
    const b = el('button', 'brasao-cor paga');
    b.type = 'button';
    b.dataset.cor = efeito.id;
    b.style.setProperty('--amostra-cor', efeito.css);
    /* O mesmo halo do escudo: a amostra tem de parecer o que ela vende. */
    if (efeito.brilho) b.style.setProperty('--brasao-brilho', efeito.brilho);
    const movimento = movimentoDe(efeito).trim();
    if (movimento) b.classList.add(movimento);
    const jaTem = (opcoes.efeitos ?? []).includes(efeito.id);
    if (jaTem) b.classList.add('tenho');
    else b.append(seloDeCoin(efeito.coins));
    tipTexto(
      b,
      (jaTem
        ? `${efeito.nome} — a sua guilda já tem este efeito`
        : `${efeito.nome} — efeito exclusivo, ${efeito.coins} Draevor Coins (uma vez só)`) +
        (efeito.duasCores ? `${SALTO}Tem duas cores: escolha na engrenagem.` : ''),
    );
    b.onclick = () => {
      /*
       * Clicar no efeito fecha a engrenagem. Ela é sobre o efeito que ESTAVA
       * posto; mantê-la aberta faria a roda continuar pintando "o lado
       * esquerdo" de um efeito que pode não ter lados.
       */
      ladoDoEfeito = null;
      espiada = null;
      pintar(efeito.id);
    };
    /*
     * A espiada: o efeito entra no escudo enquanto o mouse está em cima, na peça
     * que estiver selecionada. `pointerenter`/`pointerleave` e não `over`/`out`
     * porque estes disparam de novo ao passar pelo selo do preço, que é filho do
     * botão — e a espiada piscaria.
     */
    b.addEventListener('pointerenter', () => {
      espiada = { [alvo]: efeito.id };
      repintar();
    });
    b.addEventListener('pointerleave', () => {
      espiada = null;
      repintar();
    });
    tiraDeEfeitos.append(b);
  }
  pagCores.append(tiraDeEfeitos);

  /* =======================================================================
   * A ENGRENAGEM DAS DUAS CORES
   *
   * "engrenagem dos efeitos de duas cores: fica aqui, aplicando no alvo
   *  selecionado. (Partido e companhia têm duas cores fixas.)"
   *
   * Estavam fixas mesmo: o Partido saía vermelho-e-azul para todo mundo, o
   * Sangue vermelho, a Orla dourada. Um efeito cuja ideia inteira é "duas
   * cores" com as duas cravadas é um efeito em que duas guildas ficam idênticas.
   *
   * ---- ELA NÃO TEM RODA PRÓPRIA ----
   *
   * Clicar em "Esquerda" não abre nada: passa a RODA DE CIMA a pintar aquele
   * lado. Uma segunda roda dentro de um painel seria a quinta roda de uma tela
   * que acabou de sair de três — e a pessoa teria de aprender duas vezes o mesmo
   * instrumento.
   *
   * Ela aparece só quando a peça selecionada está com um efeito de duas cores:
   * uma engrenagem sobre um Ouro (que tem doze paradas de metal) seria um botão
   * que não faz nada.
   * ======================================================================= */
  const caixaDaEngrenagem = el('div', 'brasao-engrenagem-caixa');
  /*
   * ---- ELA TEM NOME, E NAO SO' O DESENHO ----
   *
   * "as engrenagens têm que ser mais chamativas, porque a pessoa pode não ver —
   *  inclusive a de mudar a cor do efeito."
   *
   * Uma roda dentada de treze pixels ao lado de oito amostras coloridas perde a
   * disputa por atenção todas as vezes. Com a palavra ao lado ela deixa de ser um
   * ícone a decifrar e passa a ser uma frase: "duas cores".
   *
   * E ela só existe sobre um efeito que TEM duas cores, então o nome não mente
   * nunca — não é um rótulo genérico, é o que aquele efeito oferece.
   */
  const botaoDaEngrenagem = el('button', 'brasao-engrenagem');
  botaoDaEngrenagem.type = 'button';
  botaoDaEngrenagem.append(el('span', 'brasao-engrenagem-roda', '⚙'), el('b', null, 'Duas cores'));
  tipTexto(botaoDaEngrenagem, 'Este efeito tem duas cores. Clique para escolher cada uma.');
  const metadesDoEfeito = el('div', 'brasao-metades');
  botaoDaEngrenagem.onclick = () => {
    /* Fechar volta a roda para a peça inteira — senão ela ficaria sem alvo. */
    ladoDoEfeito = ladoDoEfeito == null ? 0 : null;
    marcar();
  };
  caixaDaEngrenagem.append(botaoDaEngrenagem, metadesDoEfeito);
  pagCores.append(caixaDaEngrenagem);

  const desenharLados = () => {
    metadesDoEfeito.innerHTML = '';
    const par = duasCoresDe(escolha[alvo]);
    caixaDaEngrenagem.classList.toggle('escondido', !par);
    if (!par) {
      /* Sem efeito de duas cores não há lado nenhum — a roda volta para a peça. */
      if (ladoDoEfeito != null) ladoDoEfeito = null;
      return;
    }
    botaoDaEngrenagem.classList.toggle('ligado', ladoDoEfeito != null);
    metadesDoEfeito.classList.toggle('escondido', ladoDoEfeito == null);
    par.base.duasCores.nomes.forEach((nome, i) => {
      const b = el('button', 'brasao-metade');
      b.type = 'button';
      b.dataset.lado = String(i);
      b.style.setProperty('--amostra-cor', par.cores[i]);
      b.append(el('span', 'brasao-metade-bolinha'), el('b', null, nome));
      b.classList.toggle('ligado', ladoDoEfeito === i);
      tipTexto(b, `${nome} do ${par.base.nome} — a roda passa a pintar este lado.`);
      b.onclick = () => {
        ladoDoEfeito = i;
        marcar();
      };
      metadesDoEfeito.append(b);
    });
  };

  /* =======================================================================
   * ARRASTAR NA PRÉVIA — e quem se move é a peça da ABA ABERTA
   *
   * "além de eu poder mudar o tamanho, horizontal e vertical ali pelos scroll,
   *  posso mexer pelo preview também?"
   *
   * Pode, nas três. E a aba é quem decide qual: na Forma arrasta-se o escudo, no
   * Símbolo o objeto, nas Iniciais as letras.
   *
   * ---- POR QUE A ABA, E NÃO UM CLIQUE NA PEÇA ----
   *
   * Pegar a peça que está debaixo do cursor seria o gesto óbvio, e é o errado
   * aqui: as três se sobrepõem no mesmo escudo de 150 pixels — as letras ficam em
   * cima do símbolo, que fica dentro da forma. Sem uma regra clara, arrastar o
   * centro moveria o que estivesse por cima, que quase nunca é o que se quer.
   *
   * Com a aba, a resposta está escrita na tela antes do gesto, e é a mesma peça
   * cujas réguas estão à vista naquele momento.
   *
   * ---- A CONTA DA CONVERSÃO ----
   *
   * O campo é uma porcentagem do TAMANHO DA PEÇA (é um `translate(x%)`, e
   * porcentagem de translate é da própria caixa), e o arrasto é em pixels de
   * tela. `offsetWidth` da peça é o divisor — e não a largura da prévia, que faria
   * o símbolo andar mais devagar que o dedo (ele ocupa uns dois terços da caixa).
   *
   * `offsetWidth` e não `getBoundingClientRect`: o rect JÁ inclui a escala do
   * `transform`, então a 140% ele devolveria a largura ampliada e o arrasto
   * ficaria proporcionalmente mais lento quanto maior a peça.
   * ======================================================================= */
  const PECA_DA_ABA = {
    forma: {
      nome: 'a forma',
      x: 'formaX',
      y: 'formaY',
      tam: 'formaTam',
      no: '.gb-escudo',
      existe: () => escolha.forma !== FORMA_NENHUMA,
    },
    simbolo: {
      nome: 'o símbolo',
      x: 'simboloX',
      y: 'simboloY',
      tam: 'simboloTam',
      no: '.gb-simbolo',
      existe: () => !!escolha.simbolo,
    },
    iniciais: {
      nome: 'as iniciais',
      x: 'letrasX',
      y: 'letrasY',
      tam: 'letrasTam',
      no: '.gb-letras',
      existe: () => escolha.letras !== false,
    },
  };

  const arrastarNaPrevia = () => {
    let de = null;
    previa.addEventListener('pointerdown', (e) => {
      const qual = PECA_DA_ABA[abaAtual];
      if (!qual || !qual.existe()) return;
      const peca = previa.querySelector?.(qual.no);
      if (!peca) return;
      de = {
        qual,
        x: e.clientX ?? 0,
        y: e.clientY ?? 0,
        px: presoEntre(escolha[qual.x], LIMITE_DO_LUGAR),
        py: presoEntre(escolha[qual.y], LIMITE_DO_LUGAR),
        largura: peca.offsetWidth || 1,
        altura: peca.offsetHeight || 1,
      };
      previa.setPointerCapture?.(e.pointerId);
      e.preventDefault?.();
    });
    previa.addEventListener('pointermove', (e) => {
      if (!de) return;
      escolher({
        [de.qual.x]: presoEntre(de.px + (((e.clientX ?? 0) - de.x) / de.largura) * 100, LIMITE_DO_LUGAR),
        [de.qual.y]: presoEntre(de.py + (((e.clientY ?? 0) - de.y) / de.altura) * 100, LIMITE_DO_LUGAR),
      });
    });
    const soltar = () => {
      de = null;
    };
    previa.addEventListener('pointerup', soltar);
    previa.addEventListener('pointercancel', soltar);

    /* =====================================================================
     * A RODA DO MOUSE MUDA O TAMANHO
     *
     * "e como faz pra aumentar o tamanho dos negócio pelo preview?"
     *
     * Rolar para ampliar é o gesto que toda tela de mapa, foto e desenho usa — e
     * ele completa o par: arrastar move, rolar redimensiona, e as duas coisas
     * acontecem no mesmo lugar em que se vê o resultado.
     *
     * ---- `passive: false` E O `preventDefault` ----
     *
     * Sem os dois, a roda continuaria ROLANDO A JANELA por baixo: o navegador
     * assume que um `wheel` é rolagem e, num ouvinte passivo, ignora o pedido para
     * não ser. O resultado seria o escudo crescendo enquanto a página foge.
     *
     * ---- DOIS POR CLIQUE ----
     *
     * A faixa é de 60 a 140, e um clique de roda anda 2. Oitenta passos para
     * atravessá-la inteira é muito para quem quer ir de ponta a ponta — e é a
     * régua que serve para isso. Aqui o gesto é de AJUSTE fino, com o olho na
     * prévia, e um passo grande passaria do ponto todas as vezes.
     * ===================================================================== */
    previa.addEventListener(
      'wheel',
      (e) => {
        const qual = PECA_DA_ABA[abaAtual];
        if (!qual || !qual.existe()) return;
        e.preventDefault?.();
        const agora = presoEntre(escolha[qual.tam], LIMITE_DO_TAMANHO);
        escolher({ [qual.tam]: presoEntre(agora + ((e.deltaY ?? 0) < 0 ? 2 : -2), LIMITE_DO_TAMANHO) });
      },
      { passive: false },
    );
  };
  arrastarNaPrevia();

  /* =======================================================================
   * O QUE ACONTECE A CADA CLIQUE
   * ======================================================================= */
  function escolher(mudanca) {
    escolha = normalizarBrasao({ ...escolha, ...mudanca }, nomeAgora());
    marcar();
    repintar();
  }

  /** Acende o que está escolhido. Uma função só, para as prateleiras não discordarem. */
  function marcar() {
    for (const b of gradeForma.querySelectorAll('.brasao-opcao')) {
      b.classList.toggle('ligado', b.dataset.forma === escolha.forma);
    }
    for (const b of gradeSimbolo.querySelectorAll('.brasao-opcao')) {
      b.classList.toggle('ligado', (b.dataset.simbolo || null) === (escolha.simbolo ?? null));
    }
    for (const b of parOrdem.querySelectorAll('.brasao-chave')) {
      b.classList.toggle('ligado', b.dataset.ordem === escolha.ordem);
    }
    for (const b of parLetras.querySelectorAll('.brasao-chave')) {
      b.classList.toggle('ligado', (b.dataset.letras === '1') === (escolha.letras !== false));
    }

    /* ---- as réguas e o campo das iniciais ---- */
    const comLetras = escolha.letras !== false;
    ajustes.classList.toggle('escondido', !comLetras);
    /*
     * O campo NÃO é reescrito enquanto ele tem o foco: um `value` trocado debaixo
     * do cursor joga o cursor para o fim, e digitar "ABC" vira "CBA" na terceira
     * tecla.
     */
    /*
     * A amostra de cada fonte mostra as INICIAIS de verdade, e não um "Aa": quem
     * escolhe quer ver as letras dela, e são elas que vão para o escudo. Duas
     * letras no máximo, porque a tecla é pequena.
     */
    const escritas = letrasDoBrasao(escolha, nomeAgora()).slice(0, 2);
    for (const b of parFonte.querySelectorAll('.brasao-fonte')) {
      b.classList.toggle('ligado', b.dataset.fonte === escolha.fonte);
      const amostra = b.children?.[0];
      if (amostra) amostra.textContent = escritas;
    }
    /* A fonte só existe se houver letras: sem iniciais, não há o que desenhar. */
    linhaDaFonte.classList.toggle('escondido', !comLetras);

    campoTexto.placeholder = letrasDoBrasao({ texto: null }, nomeAgora());
    if (document.activeElement !== campoTexto) campoTexto.value = escolha.texto ?? '';
    sincronizarReguasDasLetras();

    ajustesDoSimbolo.classList.toggle('escondido', !escolha.simbolo);
    sincronizarReguasDoSimbolo();

    ajustesDaForma.classList.toggle('escondido', escolha.forma === FORMA_NENHUMA);
    sincronizarReguasDaForma();

    /*
     * A legenda da prévia nomeia a peça da ABA ABERTA — é ela que o arrasto e a
     * roda movem. Some quando a peça não existe (sem símbolo, sem iniciais, sem
     * forma) e na aba Cores, onde não há nada para mover: uma instrução para um
     * gesto que não faz nada é pior do que instrução nenhuma.
     */
    const movivel = PECA_DA_ABA[abaAtual];
    const podeMover = !!movivel && movivel.existe();
    dicaDaPrevia.classList.toggle('escondido', !podeMover);
    if (podeMover) {
      dicaDaPrevia.textContent = `arraste para mover ${movivel.nome} · roda do mouse para o tamanho`;
    }

    /* ---- o alvo, e as bolinhas ---- */
    /*
     * "Símbolo = Nenhum ou Iniciais = Sem → alvo correspondente desabilitado."
     *
     * E se o alvo apagado era o SELECIONADO, a roda volta para o escudo: sem
     * isso, tirar o símbolo deixaria a roda pintando um campo que não aparece em
     * lugar nenhum, e a pessoa arrastaria a cor sem nada acontecer.
     */
    if (!alvoServe(alvoAgora())) {
      alvo = 'cor';
      ladoDoEfeito = null;
    }
    for (const a of ALVOS_DE_COR) {
      const { botao, bolinha } = botoesDeAlvo[a.campo];
      const serve = alvoServe(a);
      botao.disabled = !serve;
      botao.classList.toggle('ligado', a.campo === alvo);
      botao.classList.toggle('apagado', !serve);
      bolinha.style.background = pinturaDoAlvo(a);
      /*
       * A bolinha de um contorno DESLIGADO fica vazada: a cor existe (ela é a do
       * escudo, ou a que a pessoa escolheu antes de desligar), mas não está sendo
       * desenhada. Pintá-la cheia diria que a peça tem aquele contorno; apagá-la
       * esconderia de onde o próximo clique vai partir.
       */
      bolinha.classList.toggle('vazada', !!a.ligado && escolha[a.ligado] !== true);
    }

    /* ---- a linha que só os contornos têm ---- */
    const daVezEhContorno = alvoAgora().tipo === 'contorno';
    linhaDoContorno.classList.toggle('escondido', !daVezEhContorno);
    if (daVezEhContorno) {
      const grossuraAgora = grossuraDoContorno(escolha[alvoAgora().ligado]);
      for (const b of parGrossura.querySelectorAll('.brasao-chave')) {
        b.classList.toggle('ligado', (b.dataset.grossura || false) === grossuraAgora);
      }
      desenharSegue();
    }

    /* ---- e a que só as pinturas de cor livre têm ---- */
    /*
     * Ela some sobre um efeito pago e sobre um contorno — ver a nota na montagem.
     * Some e não fica apagada: uma fileira de três materiais apagada em cima de um
     * Ouro faria a pessoa procurar o que destravaria eles.
     */
    const hexDoAcabamento = alvoAgora().tipo === 'pintura' ? hexDaPintura(escolha[alvo]) : null;
    linhaDoAcabamento.classList.toggle('escondido', !hexDoAcabamento);
    if (hexDoAcabamento) {
      const agora = acabamentoDe(escolha[alvo]) ?? ACABAMENTO_PADRAO;
      for (const b of parAcabamento.querySelectorAll('.brasao-chave')) {
        b.classList.toggle('ligado', b.dataset.acabamento === agora);
        /* A tecla mostra o material NA cor que está escolhida — ela é a amostra. */
        b.style.setProperty('--amostra-cor', tintaPorId(tintaComAcabamento(hexDoAcabamento, b.dataset.acabamento))?.css ?? hexDoAcabamento);
      }
    }

    /* ---- a roda ---- */
    const hexAgora = hexDoAlvo();
    if (hexAgora) hsv = hexParaHsv(hexAgora);
    const hex = hsvParaHex(hsv.h, hsv.s, hsv.v);
    const rad = (hsv.h * Math.PI) / 180;
    roda.style.setProperty('--escuro', String(Math.max(0, 1 - hsv.v)));
    marcaDaRoda.style.left = `${50 + hsv.s * Math.sin(rad) * 50}%`;
    marcaDaRoda.style.top = `${50 - hsv.s * Math.cos(rad) * 50}%`;
    marcaDaRoda.style.background = hex;
    brilho.value = String(Math.round(hsv.v * 100));
    brilho.style.setProperty('--ponta', hsvParaHex(hsv.h, hsv.s, 1));
    /* Com um efeito posto e a engrenagem fechada, a roda não é o que está valendo. */
    roda.classList.toggle('dormindo', !hexAgora);

    const posto = tintaPorId(escolha[alvo]);
    const par = duasCoresDe(escolha[alvo]);
    amostraDaLeitura.style.background = pinturaDoAlvo(alvoAgora());
    escrito.textContent =
      ladoDoEfeito != null && par
        ? `${par.base.duasCores.nomes[ladoDoEfeito]}: ${par.cores[ladoDoEfeito].toUpperCase()}`
        : daVezEhContorno && escolha[alvo] == null
          ? 'Igual à forma'
          : daVezEhContorno && segueQualPeca(escolha[alvo])
            ? `Igual ao contorno ${segueQualPeca(escolha[alvo]) === 'forma' ? 'da forma' : segueQualPeca(escolha[alvo]) === 'simbolo' ? 'do símbolo' : 'das iniciais'}`
            : (posto?.nome ?? hex.toUpperCase());

    const escolhido = idDoEfeito(posto);
    for (const b of tiraDeEfeitos.querySelectorAll('.brasao-cor')) {
      /* `idDoEfeito` e não o valor cru: `partido~00ff00~0000ff` é o Partido. */
      b.classList.toggle('ligado', b.dataset.cor === escolhido);
    }
    for (const b of prontas.querySelectorAll('.brasao-pronta')) {
      b.classList.toggle('ligado', b.dataset.cor === escolha[alvo]);
    }
    desenharLados();
  }

  function repintar() {
    /*
     * A ESPIADA vale só para o desenho. A conta, as prateleiras e o `aoMudar`
     * continuam lendo `escolha`: o efeito por baixo do mouse ainda não foi
     * escolhido, e uma conta que subisse 150 coins ao passar o mouse seria um
     * preço que some quando se vai clicar nele.
     */
    const mostrado = espiada ? normalizarBrasao({ ...escolha, ...espiada }, nomeAgora()) : escolha;
    /*
     * A legenda é re-anexada porque `innerHTML = ''` leva tudo — inclusive ela. Um
     * nó guardado numa constante sobrevive à limpeza; recriá-lo a cada repintura
     * jogaria fora o texto que `marcar` acabou de escrever nele.
     */
    previa.innerHTML = '';
    previa.append(brasaoDe(nomeAgora(), 150, mostrado));
    mini.innerHTML = '';
    /* =====================================================================
     * A PRÉVIA DO CHAT DESENHA EM MODO ÍCONE
     *
     * "o preview 'como aparece no chat' passa a usar o mesmo modo ícone, para o
     *  jogador ver exatamente o resultado."
     *
     * Ela mostrava o desenho CHEIO a 28 pixels, e o chat mostra o ícone a 13 — a
     * prévia prometia iniciais e degradê que o chat não entrega.
     *
     * 26 pixels e `icone: true`: é o ícone de 13 ampliado exatamente duas vezes.
     * Desenhá-lo nos 13 de verdade seria fiel e inútil — não dá para avaliar um
     * desenho do tamanho de uma letra. O rótulo diz "(2×)" para a ampliação não
     * virar uma segunda promessa quebrada.
     * ===================================================================== */
    mini.append(brasaoDe(nomeAgora(), 26, mostrado, { icone: true }));

    /* O nome na fonte da guilda — a mesma funcao que a tabela, o menu e o site usam. */
    nomePrevia.textContent = nomeAgora();
    vestirNomeDaGuilda(nomePrevia, mostrado);

    conta.innerHTML = '';
    const preco = precoDoBrasao(escolha, {
      jaExiste: !!opcoes.jaExiste,
      destravados: opcoes.efeitos ?? [],
    });
    /*
     * As linhas vêm SEPARADAS do catálogo e são mostradas separadas. "100 coins"
     * sozinho parece erro para quem sabe que trocar custa 50 — as duas linhas
     * explicam a soma sem ninguém ter de perguntar.
     */
    for (const l of preco.linhas) {
      const linha = el('div', 'brasao-conta-linha');
      linha.append(el('span', null, l.o_que));
      linha.append(seloDeCoin(l.coins));
      conta.append(linha);
    }
    /* =====================================================================
     * O CUSTO TOTAL, SEMPRE
     *
     * "o 'Sem custo' embaixo do nome vira 'Custo: X', somando os efeitos
     *  escolhidos em todas as peças."
     *
     * A linha de total só aparecia com duas ou mais parcelas — e por isso o caso
     * mais comum (um efeito só) mostrava a parcela e nenhum total, deixando a
     * pergunta "então quanto é no fim?" sem uma linha que a respondesse.
     *
     * Agora ela é sempre a última linha, e diz "Sem custo" quando é zero. Uma
     * resposta, sempre no mesmo lugar.
     * ===================================================================== */
    const total = el('div', 'brasao-conta-total');
    if (preco.coins) {
      total.append(el('span', null, 'Custo'));
      total.append(seloDeCoin(preco.coins));
    } else {
      total.classList.add('sem-custo');
      total.append(el('span', null, opcoes.jaExiste ? 'Nada mudou' : 'Sem custo'));
    }
    conta.append(total);

    /* ---- o aviso de contraste ---- */
    /*
     * Ele lê `escolha` e não `mostrado`: um efeito espiado pode ter contraste ótimo
     * ou péssimo, e piscar o aviso ao passar o mouse diria algo sobre uma escolha
     * que ainda não foi feita.
     */
    const apagadas = pecasSemContraste(escolha);
    avisoDeContraste.classList.toggle('escondido', !apagadas.length);
    if (apagadas.length) {
      avisoDeContraste.textContent = `pouco contraste em ${apagadas
        .map((x) => x.nome)
        .join(' e ')} — pode sumir no chat`;
    }

    recomecar.disabled = mesmoBrasao(escolha, doInicio);
    atualizarOBotao(preco);
    opcoes.aoMudar?.(escolha, preco);
    return preco;
  }

  /* =========================================================================
   * O BOTÃO DIZ O PREÇO, E TRAVA COM O MOTIVO
   *
   * "o botão Fundar/Salvar mostra o valor. Se o jogador não tiver moedas
   *  suficientes, o botão desabilita com o motivo."
   *
   * Três coisas podem travá-lo, e a ordem em que são testadas é a ordem em que
   * importam para quem está olhando: o que não dá para consertar nesta tela vem
   * primeiro (level, premium), depois o nome, depois o dinheiro.
   *
   * O balão carrega o motivo porque um botão apagado sem explicação é um beco: a
   * pessoa clica, nada acontece, e ela não sabe o que mudar.
   * ========================================================================= */
  function atualizarOBotao(preco) {
    if (!botaoConfirmar) return;
    const meusCoins = ctx.state?.character?.coins ?? 0;
    const falta = preco.coins - meusCoins;

    const motivo = opcoes.travado
      ? opcoes.motivoDaTrava || 'você ainda não pode fundar uma guilda'
      : !nomeServe
        ? 'escolha um nome livre para a guilda'
        : falta > 0
          ? `faltam ${falta.toLocaleString('pt-BR')} Draevor Coins`
          : null;

    botaoConfirmar.disabled = !!motivo;
    botaoConfirmar.textContent = preco.coins
      ? `${opcoes.rotuloDoBotao} — ${preco.coins} coins`
      : opcoes.rotuloDoBotao;
    tipTexto(
      botaoConfirmar,
      motivo
        ? `Não dá ainda: ${motivo}.`
        : preco.coins
          ? `Custa ${preco.coins} Draevor Coins. Quem cobra é o servidor, na mesma resposta em que cria.`
          : 'Sem custo nenhum.',
    );
  }

  const confirmar = () => {
    if (opcoes.travado) return;
    const preco = precoDoBrasao(escolha, {
      jaExiste: !!opcoes.jaExiste,
      destravados: opcoes.efeitos ?? [],
    });
    opcoes.aoConfirmar?.(escolha, preco);
  };
  if (botaoConfirmar) botaoConfirmar.onclick = confirmar;

  corpo.append(palco, direita);
  caixa.append(corpo);
  mostrarAba();
  marcar();
  repintar();

  return { elemento: caixa, valor: () => escolha, repintar, confirmar };
}

/* =========================================================================
 * TROCAR O BRASÃO DE UMA GUILDA QUE JÁ EXISTE
 *
 * "o mudar brasão com a guilda já criada, ao clicar nada acontece."
 *
 * Não acontecia mesmo: o botão chamava `abrirTrocaDeBrasao`, e esta função
 * NUNCA existiu. Um `onclick` que chama um nome inexistente lança
 * `ReferenceError` dentro do próprio manipulador — o navegador engole, nada
 * aparece na tela, e o botão parece morto. É o defeito típico desta janela, e é
 * exatamente o que o `test-tela-de-guildas.mjs` existe para pegar: ele monta as
 * telas, mas não CLICA em tudo, e este clique escapou.
 *
 * ---- É UMA CAIXA POR CIMA, E NÃO UM MODAL ----
 *
 * A janela de guildas já é o `#modal`. Abrir com `openModal` trocaria o
 * conteúdo dela, e confirmar fecharia a janela inteira — a pessoa terminaria de
 * trocar o brasão olhando para o mapa. Mesma razão do `perguntar`, acima.
 *
 * ---- O BOTÃO DIZ O PREÇO, E ELE MUDA ENQUANTO SE ESCOLHE ----
 *
 * "Trocar" seco esconde que a conta subiu de 50 para 150 quando a pessoa clicou
 * no Fogo Vivo. O rótulo carrega o número e o `aoMudar` o reescreve a cada
 * clique, junto com o travamento por saldo: quem não tem os coins vê o botão
 * apagado e o quanto falta, em vez de levar uma recusa do servidor.
 * ========================================================================= */
function abrirTrocaDeBrasao(g) {
  const fundo = el('div', 'confirm-back');
  const caixa = el('div', 'confirm-box brasao-caixa');
  caixa.append(el('h3', null, 'Mudar o brasão'));

  const acoes = el('div', 'confirm-actions');
  const cancelar = el('button', 'ghost', 'Cancelar');
  cancelar.onclick = () => fundo.remove();
  const trocar = el('button', null, 'Trocar');
  acoes.append(cancelar, trocar);

  /*
   * O saldo sai do personagem porque é de lá que o HUD o lê (`char-coins`).
   * Ele é só para a tela avisar antes; quem confere de verdade é o servidor, na
   * mesma consulta em que desconta.
   */
  const meusCoins = () => ctx.state?.character?.coins ?? 0;

  const atualizar = (brasao, preco) => {
    const igual = mesmoBrasao(brasao, g.brasao);
    const falta = preco.coins - meusCoins();
    trocar.disabled = igual || falta > 0;
    trocar.textContent = igual
      ? 'Nada mudou'
      : preco.coins
        ? `Trocar por ${preco.coins} Draevor Coins`
        : 'Trocar';
    tipTexto(
      trocar,
      igual
        ? 'O brasão está igual ao que a guilda já tem.'
        : falta > 0
          ? `Faltam ${falta.toLocaleString('pt-BR')} Draevor Coins.`
          : `A troca custa ${CUSTO_DE_TROCAR}${preco.coins > CUSTO_DE_TROCAR ? ', mais o efeito de cor escolhido' : ''}.`,
    );
  };

  const criador = criadorDeBrasao(g.brasao, {
    jaExiste: true,
    efeitos: g.brasaoEfeitos ?? [],
    nome: g.nome,
    aoMudar: atualizar,
  });
  caixa.append(criador.elemento);
  caixa.append(acoes);

  trocar.onclick = () => {
    const brasao = criador.valor();
    const preco = precoDoBrasao(brasao, { jaExiste: true, destravados: g.brasaoEfeitos ?? [] });
    /*
     * ---- TROCAR O BRASAO E' UMA COMPRA, E AGORA PARECE UMA ----
     *
     * "quando eu for trocar o brasão tem que ter confirmação antes, saldo atual e
     *  etc, igual da Store."
     *
     * Antes o clique mandava direto: o rótulo dizia o preço e era só. Quem tinha
     * 200 coins e gastava 150 descobria o saldo novo no HUD, depois.
     *
     * A caixa sai POR CIMA desta, e não no lugar dela: cancelar tem de devolver a
     * pessoa ao brasão que ela montou, e não ao mapa.
     */
    confirmPurchase({
      cabecalho: 'Trocar o brasão',
      title: g.nome,
      cost: preco.coins,
      balance: ctx.state?.character?.coins ?? 0,
      preview: brasaoDe(g.nome, 56, brasao),
      note: preco.linhas.map((l) => `${l.o_que}: ${l.coins}`).join(' · ') + '.',
      onConfirm: () => {
        ctx.send({ t: 'guilda', action: 'brasao', brasao });
        fundo.remove();
      },
    });
  };

  fundo.append(caixa);
  fecharAoClicarFora(fundo, () => fundo.remove());
  /*
   * Só o Escape. `atalhosDaCaixa` com `confirmar` poria o Enter a gastar coins,
   * e esta caixa tem rodas que se arrastam e um campo nenhum — um Enter aqui é
   * sempre reflexo, nunca intenção.
   */
  atalhosDaCaixa(fundo, { fechar: () => fundo.remove() });
  document.body.append(fundo);
  cancelar.focus();
}

/* =========================================================================
 * O NOME QUE ENCOLHE PARA CABER
 *
 * "a letra da fonte do nome da guilda tem que dar para diminuir."
 *
 * O nome tinha um tamanho fixo e reticências: "Os Cavaleiros da Aurora" virava
 * "Os Cavaleiros da Au…" — e o nome de uma guilda é a coisa que ela escolheu,
 * cortá-lo é apagar metade dela.
 *
 * Então em vez de cortar, ele diminui. Começa no tamanho cheio e desce de um em
 * um até caber, com um PISO: abaixo dele ninguém leria de qualquer jeito, e aí
 * as reticências voltam a ser o mal menor. Um nome curto nunca é tocado.
 *
 * ---- POR QUE `requestAnimationFrame` ----
 *
 * `scrollWidth` e `clientWidth` só dizem a verdade depois que o elemento está
 * no documento e o navegador calculou o layout. Medindo na hora da montagem os
 * dois voltam zero, o laço não roda nenhuma vez, e o defeito é invisível — a
 * fonte simplesmente nunca encolhe.
 * ========================================================================= */
function nomeQueCabe(node, maximo, minimo = 12) {
  requestAnimationFrame(() => {
    let tamanho = maximo;
    node.style.fontSize = `${tamanho}px`;
    /*
     * Teto de voltas junto com o piso: sem ele, um elemento de largura zero (um
     * pai escondido, uma aba que ainda não abriu) faria `scrollWidth` nunca
     * caber e o laço só pararia no piso — que é o certo, mas o teto deixa isso
     * explícito em vez de depender da aritmética.
     */
    for (let i = 0; i < 40 && tamanho > minimo; i++) {
      if (node.scrollWidth <= node.clientWidth) break;
      tamanho -= 1;
      node.style.fontSize = `${tamanho}px`;
    }
  });
}

/** O boneco de um nome — ou a inicial, quando não há outfit para desenhar. */
function bonecoDe(pessoa, tamanho = 36) {
  const caixa = el('div', 'guilda-boneco');
  caixa.style.width = `${tamanho}px`;
  caixa.style.height = `${tamanho}px`;
  const look = pessoa?.outfit?.type;
  if (look && outfitInfo(look)) {
    caixa.append(outfitCanvas(look, pessoa.outfit, tamanho, 2, true));
  } else {
    /*
     * Sem boneco (personagem que o banco não devolveu, ou outfit que esta versão
     * do cliente não conhece) fica a inicial, e não um quadrado vazio: uma lista
     * com buracos parece defeito, e uma inicial parece escolha.
     */
    caixa.append(el('span', 'guilda-boneco-letra', String(pessoa?.nome ?? '?').slice(0, 1).toUpperCase()));
  }
  return caixa;
}

/** O nome curto da vocação, para a linha do membro. */
const VOCACAO_CURTA = {
  knight: 'EK',
  'elite knight': 'EK',
  paladin: 'RP',
  'royal paladin': 'RP',
  sorcerer: 'MS',
  'master sorcerer': 'MS',
  druid: 'ED',
  'elder druid': 'ED',
};
const vocacaoCurta = (v) => VOCACAO_CURTA[String(v ?? '').toLowerCase()] ?? '';

/*
 * A vocação BASE de uma promovida: "elite knight" -> "knight".
 *
 * O mapa de ícones é indexado pela base (são cinco), e o personagem guarda a
 * promovida. Sem esta tradução, todo mundo promovido cairia no ícone genérico —
 * e promovido é justamente quem está numa guilda.
 */
const FAMILIA = ['knight', 'paladin', 'sorcerer', 'druid', 'monk'];
const familiaDaVocacao = (v) => {
  const texto = String(v ?? '').toLowerCase();
  return FAMILIA.find((base) => texto.includes(base)) ?? 'none';
};

/* =========================================================================
 * A JANELA
 * ========================================================================= */
/* =========================================================================
 * ABRIR A JANELA JA' NA TABELA DO SERVIDOR
 *
 * "o nome da guilda vira link que abre a guilda na janela de guildas."
 *
 * `openGuildas` sozinho decide a pagina pelo ESTADO (quem tem guilda cai na
 * propria), e para quem clicou no nome de OUTRA guilda isso e' o lugar errado —
 * ele veria a guilda dele, nao a que apontou.
 *
 * Entao esta porta manda a pagina junto, e guarda o nome para a tabela acender a
 * linha dele (ver `renderTabela`): numa tabela de vinte linhas, abrir na tabela
 * certa ainda deixa a pessoa procurando.
 * ========================================================================= */
export function abrirGuildasNaTabela(nome) {
  openGuildas();
  ctx.tabs.guilda = 'servidor';
  ctx.guildaApontada = nome ?? null;
  ctx.redraw?.();
}

export function openGuildas() {
  ctx.send({ t: 'guilda' });
  /*
   * A página não é lembrada entre aberturas. Ela é decidida pelo ESTADO (tem
   * guilda ou não), e guardar a escolha faria quem espiou a tabela do servidor
   * uma vez reabrir sempre nela, com a própria guilda escondida atrás de um
   * botão.
   */
  ctx.tabs.guilda = null;
  ctx.openModal(
    'Guildas',
    (body) => {
      const draw = () => {
        /*
         * O balao sai ANTES da tela: o elemento que o abriu esta' prestes a
         * deixar de existir, e um balao sem dono nao recebe `pointerout` — ele
         * ficaria boiando sobre o desenho novo. Ver `esconderBalao`.
         */
        esconderBalao();
        body.innerHTML = '';
        renderGuildas(body);
      };
      ctx.redraw = draw;
      draw();
    },
    null,
    /* A variante é o que dá a esta janela a moldura e o fundo. Ver o style.css. */
    'guilda',
  );
}

function renderGuildas(body) {
  const view = ctx.state.guildas;
  if (!view) return void body.append(el('p', 'empty', 'Carregando as guildas...'));

  const minha = view.minha ?? null;
  const mando = (minha?.meuCargo ?? 0) >= VICE;
  const pedidosParaResponder = mando ? (minha.candidatos ?? []).length : 0;
  /* O que chega para MIM: convites na mão e pedidos meus esperando resposta. */
  const minhasCartas = (view.convites ?? []).length + (view.pedidos ?? []).length;
  const naCaixa = pedidosParaResponder + minhasCartas;

  const pagina = ctx.tabs.guilda ?? (minha ? 'minha' : 'servidor');

  /* =======================================================================
   * ---- NA ABA DO BAU, O FUNDO DEIXA O PONTEIRO PASSAR ----
   *
   * "não consigo arrastar os itens da mochila pro baú comunitário; é como se o
   *  modal impedisse o clique lá."
   *
   * Era isso mesmo, e não é um defeito novo — é o mesmo que a mesa de troca e o
   * Depósito já tiveram: `#modal` cobre a tela inteira e engole todo o ponteiro.
   * A janela ficava pedindo "arraste peças da sua mochila" para uma mochila
   * inalcançável, e o arrasto morria antes de começar.
   *
   * `solto` é a classe que os dois usam (ver `#modal.solto`, no CSS): o fundo fica
   * transparente e sem escuta, e só a caixa escuta.
   *
   * Ela é ligada SÓ na aba do baú, e desligada em todas as outras — as demais são
   * de leitura e decisão (a tabela, os pedidos, o estandarte), e ali o fundo opaco
   * é o certo: ele separa a janela do mapa e evita o clique perdido no jogo.
   * ======================================================================= */
  document.getElementById('modal')?.classList.toggle('solto', pagina === 'bau');

  /*
   * ---- O PILL DA GUILDA SAIU DO CABECALHO ----
   *
   * "tire o título GUILDAS e o pill; deixe abas à esquerda e ? + X à direita,
   *  numa linha só."
   *
   * Ele dizia "qual guilda é a minha" antes de a página carregar — e isso valia
   * quando o cabeçalho era uma faixa larga sobre a moldura. Com a moldura fina
   * e a linha única, ele disputava espaço com as abas e acabava por cima da
   * filigrana do canto.
   *
   * A resposta que ele dava não se perdeu: ela está no estandarte da própria
   * página "Minha guilda", em tamanho grande, que é onde se vai olhar de
   * qualquer jeito.
   */
  desenharPaginas(pagina, { temGuilda: !!minha, naCaixa });

  if (pagina === 'bau' && minha) return void renderBau(body, view);
  /*
   * A página de criar não tem botão na fileira de cima: chega-se a ela pelo
   * botão "Criar guilda", e sai-se pelo "Voltar". Uma aba fixa para ela seria
   * uma aba morta para todo mundo que já tem guilda — que é quase todo mundo.
   *
   * Quem já tem guilda cai para fora dela: o servidor recusaria de qualquer
   * jeito, e um formulário que não pode ser enviado é pior do que nenhum.
   */
  if (pagina === 'criar' && !minha) return void renderCriar(body, view);
  if (pagina === 'servidor') return void renderTabela(body, view);
  if (pagina === 'pedidos') return void renderPedidos(body, view);
  if (minha) return void renderMinhaGuilda(body, view);
  return void renderTabela(body, view);
}

/* =========================================================================
 * OS BOTÕES DE PÁGINA
 *
 * A mesma fileira do canto da arena, e de propósito: é o gesto desta casa para
 * trocar de página dentro de uma janela. A diferença é o CONTADOR na caixa de
 * pedidos — sem ele, o líder só descobre que alguém pediu para entrar se
 * resolver clicar ali por acaso, e um pedido que ninguém vê é um jogador que
 * desistiu do servidor.
 * ========================================================================= */
function desenharPaginas(pagina, { temGuilda, naCaixa }) {
  const canto = ctx.acoesDoModal?.();
  if (!canto) return;

  /* =======================================================================
   * O "VOLTAR" MORA NESTA LINHA, E NÃO NO CORPO
   *
   * "o ← Voltar entra nessa mesma linha, à esquerda das abas (só na tela de
   *  criar)."
   *
   * Ele é a saída da página de criar, e as abas são as saídas de todas as
   * outras: são a mesma coisa, e estavam em dois lugares. No corpo ele também
   * empurrava o conteúdo uma linha para baixo e nascia desalinhado do painel
   * logo abaixo.
   *
   * Aparece SÓ na página de criar porque só ela não tem aba própria — nas
   * outras, o botão da aba atual já é o "onde eu estou".
   * ======================================================================= */
  if (pagina === 'criar') {
    const voltar = el('button', 'guilda-acao voltar', '← Voltar');
    voltar.type = 'button';
    tipTexto(voltar, 'Volta para a tabela do servidor. Nada do que você escolheu aqui é salvo.');
    voltar.onclick = () => {
      ctx.tabs.guilda = 'servidor';
      ctx.redraw?.();
    };
    canto.append(voltar);
  }

  const botao = (chave, palavra, balao, quantos = 0) => {
    const nela = pagina === chave;
    const node = el('button', `guilda-acao${nela ? ' ligado' : ''}`);
    node.type = 'button';
    node.append(el('span', null, palavra));
    if (quantos > 0) node.append(el('i', 'guilda-conta-bolha', String(quantos)));
    tipTexto(node, balao);
    node.onclick = () => {
      ctx.tabs.guilda = chave;
      ctx.redraw?.();
    };
    canto.append(node);
    return node;
  };

  if (temGuilda) botao('minha', 'Minha guilda', 'O estandarte, o recado e os membros');
  /*
   * O baú só existe para quem está dentro de uma guilda — é a mesma regra de
   * quem pode pegar dele. Uma aba que abre vazia para quem não tem guilda seria
   * um convite a clicar em nada.
   */
  if (temGuilda) {
    const daAba = botao(
      'bau',
      'Baú',
      ['Baú comunitário da guilda', 'Qualquer membro guarda e qualquer membro pega.'].join(SALTO),
    );
    /* =====================================================================
     * ---- A PREVIA DO BAU, ANTES DE ABRIR ----
     *
     * "ao colocar o mouse em cima do baú comunitário, antes de abrir, ele já tinha
     *  que ter um preview do que tem dentro."
     *
     * ---- E ELA NAO CUSTA NENHUMA IDA AO SERVIDOR ----
     *
     * O conteúdo do baú já viaja com a vista da guilda (`view.bau.itens`) — é ele
     * que a aba desenha. Perguntar ao servidor ao passar o mouse seria uma pergunta
     * por movimento de mouse, para responder com o que já está na memória.
     *
     * Por isso é `tipPanel` e não `tipTexto`: o balão é montado NA HORA de abrir, e
     * lê o estado daquele instante. Escrito como texto fixo aqui, ele mostraria o
     * baú de quando a aba foi desenhada — e alguém guardando uma peça do outro lado
     * do servidor deixaria a prévia mentindo até o próximo redesenho.
     * ===================================================================== */
    tipPanel(daAba, () => {
      const bau = ctx.state.guildas?.bau ?? null;
      if (!bau) return null;

      const painel = el('div', 'guilda-tip');
      painel.append(el('b', 'guilda-tip-titulo', bau.nome ?? 'Baú da guilda'));
      painel.append(el('span', 'guilda-tip-sub', `${bau.tipos} de ${bau.teto} vagas usadas`));

      if (!bau.itens?.length) {
        painel.append(el('p', 'guilda-tip-vazio', 'Está vazio. Qualquer membro pode guardar.'));
        return painel;
      }

      /*
       * Só as primeiras dezoito, e o resto vira uma linha de contagem.
       *
       * Um baú de cem vagas desenharia cem sprites num balão que abre ao passar o
       * mouse — e o balão ficaria mais alto que a janela. Dezoito são três fileiras
       * de seis: o bastante para reconhecer o que tem lá, que é a pergunta.
       */
      const QUANTOS = 18;
      const grade = el('div', 'guilda-tip-grade');
      for (const peca of bau.itens.slice(0, QUANTOS)) {
        const quadro = el('span', 'guilda-tip-quadro');
        /*
         * Sem sprite, o quadro fica vazio em vez de a prévia inteira morrer: um
         * item novo cuja arte ainda não foi empacotada não pode derrubar o balão.
         */
        try {
          quadro.append(itemCanvas(peca.id, 28, peca.count ?? 0));
        } catch {
          quadro.classList.add('sem-arte');
        }
        if ((peca.count ?? 1) > 1) {
          quadro.append(el('b', null, peca.count > 9999 ? '9k+' : String(peca.count)));
        }
        grade.append(quadro);
      }
      painel.append(grade);

      const sobrando = bau.itens.length - QUANTOS;
      if (sobrando > 0) {
        painel.append(el('span', 'guilda-tip-sub', `e mais ${sobrando} ${sobrando === 1 ? 'tipo' : 'tipos'}`));
      }
      painel.append(el('span', 'guilda-tip-sub', 'clique para abrir, guardar e pegar'));
      return painel;
    });
  }
  botao('servidor', 'Servidor', 'A tabela de guildas — e onde se pede para entrar');
  botao('pedidos', 'Pedidos', 'Convites e pedidos, dos dois lados', naCaixa);

  /* =======================================================================
   * ---- O HISTORICO, NUM BOTAO SO' ----
   *
   * "faz um botao que abre todos esses historicos divididos por abas (talvez seja
   *  melhor assim)."
   *
   * No cabecalho, ao lado do "?": sao as duas coisas da janela que nao sao uma
   * pagina — uma explica a regra, a outra conta o que aconteceu. Assim ele custa
   * ZERO altura enquanto ninguem o abre, que era o problema das tres caixas
   * embutidas.
   *
   * So' para quem esta' DENTRO: o historico de uma guilda e' assunto de dentro, e
   * quem nao tem guilda ve esta janela por causa da tabela e dos proprios convites.
   * ======================================================================= */
  /* =======================================================================
   * ---- OS DOIS ICONES SAO UM GRUPO, E NAO DOIS SOLTOS ----
   *
   * "o ícone redondo do baú hoje fica solto no meio da barra; mover para a
   *  direita, imediatamente à esquerda do '?', na ordem [histórico] [?] [X]."
   *
   * Ele JA' era criado logo antes do "?" — o que o punha no meio era o CSS. A
   * regra de lá empurrava para a direita (`margin-left: auto`) CADA ícone da
   * fileira, e num flex duas margens automáticas dividem a sobra entre si: o
   * primeiro ícone parava na metade do vão e o segundo na ponta.
   *
   * Com os dois dentro de uma caixa só, quem tem a margem automática é a CAIXA
   * — uma margem, uma sobra, e o grupo inteiro encosta no X. E não é só o
   * conserto de hoje: um terceiro ícone que apareça aqui amanhã entra no grupo
   * em vez de rachar a fileira de novo.
   * ======================================================================= */
  const cantoDireito = el('div', 'guilda-acoes-canto');

  if (temGuilda) {
    const historico = el('button', 'guilda-acao so-icone');
    historico.type = 'button';
    /*
     * ---- UM DESENHO, E NAO UM CARACTERE ----
     *
     * Era o glifo `🕮`, e na fonte da janela ele saiu como um QUADRADO VAZIO — o
     * botao ficava sem dizer nada. Um caractere so' aparece se a maquina de quem joga
     * tiver uma fonte com ele, e essa e' uma aposta que um botao de janela nao pode
     * fazer.
     *
     * `diario.png` e' o icone que o jogo ja' usa para a Recompensa Diaria: um livro
     * aberto. E' a mesma ideia — o que foi acontecendo, dia a dia.
     */
    /*
     * `diario` e nao `icons/diario`: `artOrUiIcon` ja' procura em
     * `/client/assets/icons/<nome>.png` e cai para `/client/assets/ui/<nome>.png`.
     * Com a pasta no nome, os dois caminhos viravam `icons/icons/...` e o botao
     * ficava vazio — que foi exatamente o que apareceu na tela.
     */
    historico.append(artOrUiIcon('diario', 'Histórico'));
    historico.setAttribute('aria-label', 'O que aconteceu na guilda');
    const diario = ctx.state.guildas?.minha?.diario ?? {};
    const quantos =
      (diario.contribuicoes?.length ?? 0) + (diario.membros?.length ?? 0) + (diario.bau?.length ?? 0);
    tipTexto(
      historico,
      [
        'O que aconteceu na guilda',
        'Contribuições, entradas e saídas, promoções e expulsões, e tudo o que entrou e saiu do baú.',
        quantos ? `${quantos} ${quantos === 1 ? 'registro' : 'registros'} guardados.` : 'Nada registrado ainda.',
      ].join(SALTO),
    );
    historico.onclick = () => abrirHistorico('contribuicoes');
    cantoDireito.append(historico);
  }

  const ajuda = el('button', 'guilda-acao so-icone', '?');
  ajuda.type = 'button';
  ajuda.setAttribute('aria-label', 'Como funcionam as guildas');
  const regras = ctx.state.guildas?.regras ?? {};
  const bau = ctx.state.guildas?.bau ?? null;
  tipTexto(
    ajuda,
    [
      'Como funcionam as guildas',
      `Fundar pede level ${regras.levelParaFundar ?? 500}, premium ativo e um nome livre. Entrar numa que já existe não pede nada disso.`,
      'São três postos: líder, vice-líder e membro. Vice convida, aceita pedidos e expulsa membro.',
      'Ninguém mexe em quem tem posto igual ou maior que o seu.',
      'O líder não sai da guilda: ele passa a liderança, e só pode desfazê-la quando for a última pessoa dentro.',
      'Quem não tem guilda pode pedir para entrar — a guilda aceita ou não.',
      '',
      `A guilda começa com ${regras.vagasDeFabrica ?? 10} vagas de membro. Qualquer membro pode contribuir com ouro para melhorá-la: cada nível abre mais ${regras.vagasPorNivel ?? 10} vagas, até ${regras.vagasNoMaximo ?? 100}.`,
      `O primeiro nível custa ${(regras.ouroDoPrimeiroDegrau ?? 1_000_000_000).toLocaleString('pt-BR')} de ouro, e cada degrau seguinte custa o dobro. O nível sobe sozinho quando a vaquinha enche, e o ouro dado não volta.`,
      '',
      `O baú comunitário começa com ${bau?.vagasNoMaximo ? bau.teto : 25} vagas e vai até ${bau?.vagasNoMaximo ?? 100}, a ${bau?.coinsPorCompra ?? 50} Draevor Coins por lote de ${bau?.vagasPorCompra ?? 25}.`,
      'ATENÇÃO: tudo o que entra no baú pode ser retirado por qualquer membro da guilda.',
      /*
       * "atualiza o interrogaçao la' de guilds com as novas informaçoes."
       *
       * O "?" e' o unico lugar em que as regras estao escritas por extenso, e ele
       * tinha parado na versao do bau de antes: sem o arrastar, sem a pergunta de
       * quantidade, sem o acordo de nao perguntar e sem os historicos. Cada linha
       * nova aqui e' uma coisa que a pessoa descobriria por tentativa.
       */
      'Com a aba do Baú aberta, arraste peças da janela da sua mochila para guardar — ou simplesmente clique nelas por lá, que é o mesmo gesto do depósito.',
      'Guardar sempre pergunta QUANTO e depois confirma; marcando "não perguntar novamente", a confirmação para de aparecer (a pergunta da quantidade continua). Tirar do baú também pergunta quanto.',
      'Tudo o que entra e sai fica registrado: quem guardou, quem pegou, o quê — com tier e afixos — e quando. Verde é o que entrou, vermelho é o que saiu.',
      '',
      'O botão ao lado deste "?" abre o que aconteceu na guilda, em três abas: as contribuições (com o placar de quem mais deu), as mudanças de membro (entradas, saídas, expulsões e promoções) e as movimentações do baú.',
      '',
      'Os pontos são o placar da guerra de guildas.',
      /*
       * "explicar o critério no ?".
       *
       * Uma tabela ordenada por quatro coisas parece desordenada quando duas
       * guildas de zero ponto trocam de lugar por causa do nível — que nao esta'
       * escrito em nenhuma coluna. O texto vem do mesmo arquivo que ORDENA, para
       * a explicacao nao envelhecer separada da regra.
       */
      CRITERIO_DA_ORDEM,
    ].join(SALTO),
  );
  cantoDireito.append(ajuda);
  canto.append(cantoDireito);
}

/* =========================================================================
 * FUNDAR — a página de quem não tem guilda e não quer pedir a ninguém
 * ========================================================================= */
/* =========================================================================
 * AS DUAS TRAVAS DE FUNDAR — uma conta só, usada em dois lugares
 *
 * "só pode criar guild com premium ativo e level 500+."
 *
 * A regra é do servidor (ver `fundarGuilda`); aqui a tela só não oferece o que
 * vai ser recusado. O que ela não pode fazer é apagar o botão dizendo UMA razão
 * quando faltam as duas: quem tem level 400 sem premium consertaria o level e
 * continuaria sem poder fundar, sem entender por quê.
 *
 * `character.premium` é o que sobra de premium em milissegundos — o mesmo
 * número que acende o selo do inventário (ver `hud.mjs`).
 * ========================================================================= */
function travasDeFundar(view) {
  const entrada = view.regras?.levelParaFundar ?? 500;
  const meuLevel = ctx.state.character?.level ?? 0;
  const precisaPremium = view.regras?.precisaDePremiumParaFundar !== false;
  const temPremium = (ctx.state.character?.premium ?? 0) > 0;
  const faltaLevel = meuLevel < entrada;
  const faltaPremium = precisaPremium && !temPremium;

  const faltas = [];
  if (faltaLevel) faltas.push(`faltam ${entrada - meuLevel} levels (você é ${meuLevel}, precisa de ${entrada})`);
  if (faltaPremium) faltas.push('o seu premium não está ativo');

  return { entrada, precisaPremium, faltaLevel, faltaPremium, travado: faltas.length > 0, faltas };
}

/* =========================================================================
 * NA ABA PRINCIPAL, SÓ O BOTÃO
 *
 * "o que vai ficar na aba principal de guildas é só o botão criar guilda."
 *
 * O formulário inteiro morava no pé da tabela do servidor: nome, prévia e,
 * depois do criador entrar, quatro prateleiras de opções. Quem abria a janela
 * para ver quais guildas existem levava tudo isso na cara, e a tabela — que era
 * o motivo de a aba existir — ficava espremida em cima.
 *
 * Agora é um convite de três linhas com um botão. Quem quer fundar clica; quem
 * não quer nem sabe que existe uma tela atrás dele.
 * ========================================================================= */
function renderChamadaParaFundar(body, view) {
  const t = travasDeFundar(view);

  /* =======================================================================
   * ---- ELE NAO PODE SUMIR COM A ROLAGEM ----
   *
   * "o fundar uma guilda tem que ficar visível ali sempre que uma pessoa não
   *  tiver guilda, mesmo se a página descer."
   *
   * Ele mora no pé da tabela, e a tabela cresce: com vinte guildas, quem rolava
   * para ler a lista perdia de vista a única saída de quem não quer entrar em
   * nenhuma delas — e ela não está em mais lugar nenhum da janela.
   *
   * Virou uma BARRA grudada no pé (`position: sticky`, no CSS), e por isso ela
   * encolheu para uma linha: um convite de três linhas pregado na tela comeria um
   * quinto da janela o tempo todo. O parágrafo que explicava virou o balão do
   * botão — a explicação continua a um passo de distância, e não na frente.
   *
   * `sticky` e não `fixed`: ele continua no fluxo, no lugar em que sempre esteve,
   * e só PARA de subir quando encosta no pé da área que rola. Numa janela em que a
   * tabela cabe inteira, nada muda — e é a maioria dos casos.
   * ======================================================================= */
  const caixa = el('section', 'guilda-chamada');

  const texto = el('div', 'guilda-chamada-texto');
  texto.append(el('b', null, 'Não está em nenhuma guilda'));
  /*
   * Travado, a linha diz o que FALTA — "Para fundar: faltam 490 levels" — e nao o
   * que a regra pede. Sao coisas diferentes: a regra a pessoa le uma vez, o que
   * falta ela precisa saber agora, e num botao apagado essa frase e' a unica coisa
   * que explica por que ele esta apagado.
   *
   * Ela fica VISIVEL e nao so' no balao do botao: um botao apagado nao convida
   * ninguem a passar o mouse em cima dele para descobrir o motivo.
   */
  texto.append(
    el(
      'span',
      null,
      t.travado
        ? `Para fundar: ${t.faltas.join(' e ')}. Entrar numa guilda que já existe não pede nada disso.`
        : 'Funde a sua: nome, escudo, símbolo e cores.',
    ),
  );
  caixa.append(texto);

  const botao = el('button', 'guilda-botao primario', 'Criar guilda');
  botao.disabled = t.travado;
  tipTexto(
    botao,
    t.travado
      ? `Para fundar: ${t.faltas.join(' e ')}.`
      : 'Abre o criador: nome, forma, símbolo, cores e as iniciais.' +
          SALTO +
          'Você entra como líder e o nome fica reservado enquanto a guilda existir.',
  );
  botao.onclick = () => {
    ctx.tabs.guilda = 'criar';
    ctx.redraw?.();
  };
  caixa.append(botao);
  body.append(caixa);
}

/* =========================================================================
 * A PÁGINA DE CRIAR — o criador inteiro, com espaço
 *
 * "na aba do criar guilda vai ter um campo bonito com Nome da guilda (...) e
 *  mostra o preview do brasão bonito ali e tudo separadinho."
 *
 * Quatro colunas lado a lado: o PALCO (o escudo grande, o nome e a conta), a
 * forma com as camadas, os símbolos e as duas rodas de cor. Nada rola, e é essa
 * a razão do arranjo — quem monta um brasão está comparando a forma com o
 * símbolo e o símbolo com a cor, e comparar exige ver ao mesmo tempo. Uma
 * pilha rolante mostrava tudo, mas nunca junto.
 * ========================================================================= */
function renderCriar(body, view) {
  const t = travasDeFundar(view);

  /* O "Voltar" desta página mora na linha do cabeçalho — ver `desenharPaginas`. */

  const caixa = el('section', 'guilda-painel');
  caixa.append(el('h4', 'guilda-titulo', 'Criar guilda'));

  const campo = document.createElement('input');
  campo.type = 'text';
  campo.maxLength = 24;
  campo.placeholder = 'Nome da guilda';
  campo.className = 'guilda-campo brasao-campo-nome';
  campo.disabled = t.travado;

  const criador = criadorDeBrasao(null, {
    jaExiste: false,
    efeitos: [],
    nome: () => campo.value.trim() || '??',
    campoDeNome: campo,
    /*
     * ---- A LISTA DE NOMES JA' TOMADOS ----
     *
     * "checar disponibilidade enquanto digita."
     *
     * Ela vem da MESMA `view.lista` que a aba Servidor desenha — a tabela inteira
     * de guildas já está carregada nesta tela. A resposta está na memória do
     * navegador, então não há pedido ao servidor para atrasar nem espera para
     * calibrar: ela sai na mesma tecla.
     *
     * Pela `chave` e não pelo nome cru: "Os Corvos" e "os  corvos" são a mesma
     * guilda para o banco, e a tela tem de dizer o mesmo.
     */
    nomesUsados: new Set((view.lista ?? []).map((g) => chaveDoNome(g.nome))),
    /* O motivo da trava, para o botão poder explicar por que está apagado. */
    motivoDaTrava: t.travado ? t.faltas.join(' e ') : null,
    /*
     * O botão de criar mora no criador, embaixo da conta: é lá que está o preço,
     * e um botão longe do preço é um botão que se aperta sem ler.
     */
    rotuloDoBotao: 'Fundar guilda',
    travado: t.travado,
    aoConfirmar: (brasao, preco) => {
      const nome = campo.value.trim();
      if (!nome) {
        campo.focus();
        return;
      }
      const fundar = () => {
        ctx.send({ t: 'guilda', action: 'fundar', nome, brasao });
        /* Deu certo ou não, a página volta: a resposta redesenha tudo. */
        ctx.tabs.guilda = null;
      };
      /* =====================================================================
       * ---- COM COIN NO MEIO, A CAIXA E' A DA LOJA ----
       *
       * "faça isso em todas as compras por Draevor Coins da aba de guilds, pra
       *  ficar igual à compra da Store."
       *
       * Ela mostra preço, saldo ATUAL e saldo DEPOIS — e esses dois últimos são
       * metade da decisão de quem vai gastar 175 coins num efeito.
       *
       * Sem coin nenhum, continua a pergunta simples: uma "confirmação de compra"
       * numa fundação de graça faria procurar o que foi comprado.
       * ===================================================================== */
      if (!preco.coins) {
        return void perguntar(
          {
            titulo: 'Fundar a guilda',
            texto: `A guilda "${nome}" vai ser criada e você entra como líder. O nome fica reservado enquanto ela existir.`,
            botao: 'Fundar',
          },
          fundar,
        );
      }
      confirmPurchase({
        cabecalho: 'Fundar a guilda',
        title: nome,
        cost: preco.coins,
        balance: ctx.state?.character?.coins ?? 0,
        /* O próprio escudo como prévia: é o que se está comprando. */
        preview: brasaoDe(nome, 56, brasao),
        note:
          preco.linhas.map((l) => `${l.o_que}: ${l.coins}`).join(' · ') +
          '. Você entra como líder e o nome fica reservado enquanto a guilda existir.',
        onConfirm: fundar,
      });
    },
  });

  campo.oninput = () => criador.repintar();
  campo.onkeydown = (e) => {
    if (e.key === 'Enter') criador.confirmar();
  };

  if (t.travado) {
    caixa.append(el('p', 'guilda-trava', `Para fundar: ${t.faltas.join(' e ')}.`));
    caixa.append(
      el('p', 'guilda-nota', 'Entrar numa guilda que já existe não pede nada disso — é só pedir na aba Servidor.'),
    );
  }

  caixa.append(criador.elemento);
  body.append(caixa);
  if (!t.travado) campo.focus();
}

/* =========================================================================
 * A MINHA GUILDA
 * ========================================================================= */
function renderMinhaGuilda(body, view) {
  const g = view.minha;
  const souLider = g.meuCargo === LIDER;
  const mando = g.meuCargo >= VICE;

  /* ---- O estandarte ---- */
  const cartaz = el('section', 'guilda-estandarte');
  cartaz.append(brasaoDe(g.nome, 66, g.brasao));

  const texto = el('div', 'guilda-estandarte-texto');
  const titulo = el('h3', null, g.nome);
  /*
   * ---- O NOME NA LETRA QUE A GUILDA ESCOLHEU ----
   *
   * "é possível ter opção pra escolher algumas fontes pro nome da guilda?"
   *
   * Aqui, e não na tabela do servidor: este cartaz é a guilda falando de si mesma,
   * e uma tabela de vinte linhas em seis letras diferentes deixaria de ser uma
   * tabela — a varredura depende de as linhas serem iguais.
   *
   * A família é posta ANTES do `nomeQueCabe`: ele mede o texto para decidir o
   * corpo, e medir com uma fonte e desenhar com outra daria a medida errada.
   */
  /*
   * A familia E o corte com reticencias, num gesto so' — ver `vestirNomeDaGuilda`.
   * Aqui havia so' a familia, e um nome de 24 letras na Decorativa passava da
   * coluna do cartaz.
   */
  vestirNomeDaGuilda(titulo, g.brasao);
  /* 22px é o tamanho cheio (ver o CSS); 13 é onde ele para de encolher. */
  nomeQueCabe(titulo, 22, 13);
  texto.append(titulo);
  texto.append(el('span', 'guilda-estandarte-sub', `${desdeQuando(g.criadaEm)} · líder ${g.dono}`));

  /* ---- O recado, escrito no próprio estandarte ---- */
  if (mando) {
    const campo = document.createElement('input');
    campo.type = 'text';
    campo.maxLength = 160;
    campo.className = 'guilda-campo guilda-recado-campo';
    campo.value = g.recado ?? '';
    campo.placeholder = 'escreva um recado para a guilda';
    /*
     * Grava no BLUR e no Enter, e não a cada tecla: um recado de 160 letras
     * daria 160 idas ao servidor, e cada uma reenvia a vista para todos os
     * membros online.
     */
    const gravar = () => {
      if ((campo.value ?? '') === (g.recado ?? '')) return;
      ctx.send({ t: 'guilda', action: 'recado', texto: campo.value });
    };
    campo.onblur = gravar;
    campo.onkeydown = (e) => {
      if (e.key === 'Enter') campo.blur();
    };
    texto.append(campo);
  } else if (g.recado) {
    /* =====================================================================
     * ---- O RECADO CORTADO MOSTRA O RESTO NO BALAO ----
     *
     * "a descricao que o lider coloca na guild, se for muito grande nao da' pra
     *  ler. Seria deixar o limite como esta' mas, ao passar o mouse em cima,
     *  mostrar o restante completo."
     *
     * A linha continua de UMA linha com reticencias, e e' de proposito: o recado
     * mora no estandarte, que e' um cartaz de tres linhas com os numeros da guilda
     * do lado: deixa-lo quebrar em quatro linhas empurraria a barra de nivel para
     * fora da primeira tela.
     *
     * O balao e' onde os 160 caracteres cabem inteiros, sem custar altura nenhuma a
     * quem nao esta' lendo o recado — e o texto que ele mostra e' o mesmo `g.recado`,
     * e nao uma segunda copia cortada em outro lugar.
     * ===================================================================== */
    const linha = el('p', 'guilda-recado-texto', `“${g.recado}”`);
    tipTexto(linha, `Recado da guilda${SALTO}“${g.recado}”`);
    texto.append(linha);
  }
  cartaz.append(texto);

  const numeros = el('div', 'guilda-numeros');
  const par = (rotulo, valor, balao) => {
    const caixa = el('div', 'guilda-numero');
    caixa.append(el('b', null, String(valor)));
    caixa.append(el('span', null, rotulo));
    if (balao) tipTexto(caixa, balao);
    return caixa;
  };
  /*
   * ---- Os membros agora vêm com DENOMINADOR ----
   *
   * "a guild criada vem com o limite de 10 pessoas."
   *
   * "12" sozinho não diz se cabe mais alguém. "12/20" responde a pergunta que
   * se faz antes de convidar, que é a única razão de olhar este número.
   */
  const nivel = g.nivel ?? null;
  numeros.append(
    par(
      'membros',
      nivel ? `${g.membros.length}/${nivel.vagas}` : String(g.membros.length),
      nivel
        ? [
            `${g.membros.length} de ${nivel.vagas} vagas ocupadas.`,
            nivel.noTopo
              ? 'A guilda está no nível máximo.'
              : `Melhorando para o nível ${nivel.nivel + 1} a guilda passa a caber ${nivel.vagasDoProximo}.`,
          ].join(SALTO)
        : null,
    ),
  );
  /*
   * Os pontos já aparecem valendo zero. Eles são o placar da guerra de guildas,
   * e a coluna existe desde agora — mostrar o zero é o que faz o número não ser
   * uma surpresa no dia em que o castelo abrir.
   */
  numeros.append(
    par(g.pontos === 1 ? 'ponto' : 'pontos', g.pontos, 'Pontos da guerra de guildas.\nQuem segurar o trono do castelo leva.'),
  );
  numeros.append(par('seu posto', g.meuPosto));
  cartaz.append(numeros);

  /* =======================================================================
   * O NÍVEL ENTRA NO CARD, NUMA LINHA SÓ
   *
   * "nível dentro do card da guilda, embaixo do nome: selo Nível X + barra fina
   *  + 0 / 1kkk + botão pequeno Contribuir na mesma linha."
   *
   * Ele era uma SEÇÃO inteira, com título, barra, legenda de duas partes, um
   * parágrafo sobre a vaquinha e um botão de tamanho cheio — cinco linhas para
   * um número que quase ninguém vai mexer hoje. As vagas, que eram metade do
   * assunto dele, já aparecem no chip de membros (`4/20`) logo acima.
   *
   * Numa linha, ele responde as três perguntas que valem — em que nível está,
   * o quanto falta, e por onde se contribui — e devolve quatro linhas de altura
   * para a lista de membros, que é o que a aba existe para mostrar.
   * ======================================================================= */
  if (g.nivel) cartaz.append(faixaDeNivel(g));
  /*
   * A engrenagem fica no CANTO do card (ver `.guilda-engrenagem` no CSS), e nao
   * na fileira dos numeros: ela nao e' um dado da guilda, e' a porta dos gestos
   * que quase nunca se faz. Ver `menuDaGuilda`.
   */
  cartaz.append(menuDaGuilda(g, { souLider }));
  body.append(cartaz);

  /* ---- Os membros ---- */
  const lista = el('section', 'guilda-painel');
  const cabeca = el('div', 'guilda-painel-cabeca');
  cabeca.append(el('h4', 'guilda-titulo', 'Membros'));
  const online = g.membros.filter((m) => m.online).length;
  cabeca.append(el('span', 'guilda-nota', `${online} de ${g.membros.length} online`));
  lista.append(cabeca);

  const grade = el('div', 'guilda-membros');
  for (const membro of g.membros) grade.append(linhaDeMembro(membro, g, { souLider, mando }));
  lista.append(grade);
  body.append(lista);

}

/* =========================================================================
 * A FAIXA DE NÍVEL — selo, barra, números e o botão, numa linha
 * ========================================================================= */
function faixaDeNivel(g) {
  const nivel = g.nivel;
  const faixa = el('div', 'guilda-nivel-faixa');

  const selo = el('span', 'guilda-nivel-selo');
  selo.append(el('i', null, 'Nível'));
  selo.append(el('b', null, String(nivel.nivel)));
  faixa.append(selo);

  const meio = el('div', 'guilda-nivel-meio');
  const trilho = el('div', 'guilda-barra');
  const cheio = el('i', 'guilda-barra-cheia');
  const parte = nivel.custo > 0 ? Math.min(1, nivel.guardado / nivel.custo) : 1;
  cheio.style.width = `${Math.round(parte * 100)}%`;
  trilho.append(cheio);
  meio.append(trilho);
  meio.append(
    el(
      'span',
      'guilda-nivel-conta',
      nivel.noTopo ? 'no nível máximo' : `${OURO_CURTO(nivel.guardado)} / ${OURO_CURTO(nivel.custo)}`,
    ),
  );
  /*
   * ---- O BALÃO FICA NO MEIO, E ABRE PARA BAIXO ----
   *
   * "o tooltip do nível abria em cima do escudo e do recado."
   *
   * Ele estava na barra, que é larga e mora logo abaixo do nome — um balão
   * nasce colado no dono, e de uma barra dessa largura ele cobria o escudo e o
   * recado. Preso a este bloco estreito, ele abre embaixo e ao lado, longe dos
   * dois. Ver `.guilda-nivel-meio` no CSS.
   */
  tipTexto(
    meio,
    nivel.noTopo
      ? `A guilda está no nível ${nivel.nivel}, o máximo — ${nivel.vagas} vagas.`
      : [
          `Nível ${nivel.nivel}: ${nivel.vagas} vagas de membro.`,
          `${nivel.guardado.toLocaleString('pt-BR')} de ${nivel.custo.toLocaleString('pt-BR')} de ouro guardados.`,
          `O nível ${nivel.nivel + 1} abre ${nivel.vagasDoProximo} vagas, e sobe sozinho quando a barra enche.`,
        ].join(SALTO),
  );
  faixa.append(meio);

  if (!nivel.noTopo) {
    const doar = el('button', 'guilda-mini', 'Contribuir');
    doar.type = 'button';
    tipTexto(doar, 'Qualquer membro pode dar ouro para melhorar a guilda.');
    doar.onclick = () => caixaDeContribuir(g);
    faixa.append(doar);
  }
  return faixa;
}

/* =========================================================================
 * A ENGRENAGEM DO LÍDER — e por que o rodapé morreu
 *
 * "remover o rodapé com Desfazer a guilda; criar um botão de engrenagem (só
 *  visível ao líder) no card da guilda com Passar liderança e Desfazer guilda."
 *
 * O rodapé tinha dois botões e um parágrafo explicando por que um deles estava
 * apagado — e os dois são gestos que um líder faz UMA vez na vida da guilda,
 * ocupando o pé de uma tela que se abre todo dia para ver quem está online.
 *
 * Num menu, eles continuam a um clique de distância e param de ser a última
 * coisa que todo mundo lê.
 *
 * ---- QUEM NÃO É LÍDER TAMBÉM TEM ENGRENAGEM ----
 *
 * Com "Sair da guilda" dentro. Ela era a outra metade do rodapé, e deixá-la
 * solta obrigaria a manter o rodapé vivo só para ela.
 * ========================================================================= */
function menuDaGuilda(g, { souLider }) {
  /*
   * ---- A ENGRENAGEM DIZ O QUE ELA E' ----
   *
   * "as engrenagens têm que ser mais chamativas, porque a pessoa pode não ver."
   *
   * Ela é a ÚNICA porta para mudar o brasão, passar a liderança, desfazer a guilda
   * e sair dela — tudo o que morava no rodapé. Um círculo cinza de 26 pixels no
   * canto de um card cheio de números não anuncia isso: quem não sabe que ele
   * existe não vai procurar por ele.
   *
   * A palavra é o que resolve. Um ícone se decifra; um rótulo se lê. E o ouro o põe
   * na mesma família visual dos botões que a janela já usa para AGIR, em vez de na
   * dos enfeites cinzas.
   */
  const botao = el('button', 'guilda-engrenagem');
  botao.type = 'button';
  botao.append(el('span', 'guilda-engrenagem-roda', '⚙'), el('b', null, 'Opções'));
  botao.setAttribute('aria-label', 'Ações da guilda');
  tipTexto(
    botao,
    souLider
      ? 'Mudar o brasão, passar a liderança, desfazer a guilda'
      : 'Sair da guilda',
  );

  botao.onclick = () => {
    /* Clicar de novo fecha — senão o gesto de abrir não tem o inverso. */
    const aberto = document.querySelector('.guilda-menu');
    if (aberto) return aberto.remove();

    const menu = el('div', 'guilda-menu');
    const item = (rotulo, dica, aoClicar, perigo = false) => {
      const b = el('button', `guilda-menu-item${perigo ? ' perigo' : ''}`, rotulo);
      b.type = 'button';
      if (dica) tipTexto(b, dica);
      b.onclick = () => {
        menu.remove();
        aoClicar();
      };
      menu.append(b);
    };

    if (souLider) {
      item(
        'Mudar o brasão',
        `Forma, símbolo, cores e iniciais. Trocar custa ${CUSTO_DE_TROCAR} Draevor Coins — e os efeitos exclusivos se pagam uma vez só.`,
        () => abrirTrocaDeBrasao(g),
      );
      item('Passar a liderança', 'Escolha para quem. Você vira vice na mesma hora.', () => caixaDePassarLideranca(g));
      /*
       * O desfazer só acende com a guilda VAZIA — a regra é do servidor (ver
       * `desfazerGuilda`). E ele fica no menu mesmo apagado: um líder que
       * procura como acabar com a guilda e não acha o item conclui que o jogo
       * não deixa; apagado com o porquê no balão, ele descobre o que falta.
       */
      const sozinho = g.membros.length <= 1;
      const quantos = g.membros.length - 1;
      const b = el('button', 'guilda-menu-item perigo', 'Desfazer a guilda');
      b.type = 'button';
      b.disabled = !sozinho;
      tipTexto(
        b,
        sozinho
          ? 'Some com a guilda. O nome fica livre e os pontos de guerra se perdem.'
          : quantos === 1
            ? 'Ainda há 1 membro na guilda. Ele precisa sair, ou ser expulso, antes.'
            : `Ainda há ${quantos} membros na guilda. Eles precisam sair, ou ser expulsos, antes.`,
      );
      b.onclick = () => {
        menu.remove();
        caixaDeDesfazer(g);
      };
      menu.append(b);
    } else {
      item(
        'Sair da guilda',
        'Você perde o posto e volta a ficar sem guilda.',
        () =>
          perguntar(
            {
              titulo: `Sair da ${g.nome}?`,
              texto:
                'Você perde o posto e volta a ficar sem guilda. Para voltar vai precisar de um convite ou de um pedido aceito.',
              botao: 'Sair',
              perigo: true,
            },
            () => ctx.send({ t: 'guilda', action: 'sair' }),
          ),
        true,
      );
    }

    botao.parentElement?.append(menu);
    fecharAoClicarFora(menu, () => menu.remove());
  };
  return botao;
}

/* =========================================================================
 * PASSAR A LIDERANÇA — para quem?
 *
 * O gesto já existia na linha de cada membro, e continua lá. No menu ele
 * precisa de um alvo, e por isso abre esta lista: um item de menu que dissesse
 * "vá clicar na lista de membros" seria um item que não faz nada.
 * ========================================================================= */
function caixaDePassarLideranca(g) {
  const outros = g.membros.filter((m) => m.nome !== ctx.state?.character?.name);
  if (!outros.length) {
    return perguntar(
      {
        titulo: 'Não há para quem passar',
        texto: 'Você é a única pessoa na guilda. Convide alguém antes, ou desfaça a guilda.',
        botao: 'Entendi',
      },
      () => {},
    );
  }

  const fundo = el('div', 'confirm-back');
  const caixa = el('div', 'confirm-box');
  caixa.append(el('h3', null, 'Passar a liderança'));
  caixa.append(
    el('p', 'shop-note', 'Quem você escolher vira líder na mesma hora, e você vira vice. Só ele poderá devolver.'),
  );

  const lista = el('div', 'guilda-escolher');
  for (const m of outros.sort((a, b) => b.cargo - a.cargo || a.nome.localeCompare(b.nome, 'pt-BR'))) {
    const b = el('button', 'guilda-escolher-item');
    b.type = 'button';
    b.append(el('b', null, m.nome));
    b.append(el('span', null, `${m.posto} · level ${m.level ?? 0}`));
    b.onclick = () => {
      fundo.remove();
      perguntar(
        {
          titulo: `Passar a liderança para ${m.nome}?`,
          texto: 'Ele vira líder e você vira vice na mesma hora. Só ele poderá devolver — quem manda é quem tem o posto.',
          botao: 'Passar a liderança',
          perigo: true,
        },
        () => ctx.send({ t: 'guilda', action: 'passar', quem: m.nome }),
      );
    };
    lista.append(b);
  }
  caixa.append(lista);

  const acoes = el('div', 'confirm-actions');
  const cancelar = el('button', 'ghost', 'Cancelar');
  cancelar.onclick = () => fundo.remove();
  acoes.append(cancelar);
  caixa.append(acoes);

  fundo.append(caixa);
  document.body.append(fundo);
  fecharAoClicarFora(fundo, () => fundo.remove());
  atalhosDaCaixa(fundo, { fechar: () => fundo.remove() });
  cancelar.focus();
}

/* =========================================================================
 * DESFAZER A GUILDA — digitando o nome
 *
 * "desfazer com confirmação digitando o nome da guilda."
 *
 * Uma pergunta de sim ou não é respondida com um clique, e um clique é o que se
 * dá por reflexo. Digitar o nome custa alguns segundos e exige LER — e é o
 * único gesto desta tela que não tem volta: os pontos de guerra somem e o nome
 * fica livre para qualquer um pegar.
 * ========================================================================= */
function caixaDeDesfazer(g) {
  const fundo = el('div', 'confirm-back');
  const caixa = el('div', 'confirm-box');
  caixa.append(el('h3', null, `Desfazer a ${g.nome}?`));
  caixa.append(
    el(
      'p',
      'shop-note',
      'Você é a última pessoa dentro dela. Os pontos de guerra somem e o nome fica livre para qualquer um. Não tem volta.',
    ),
  );
  caixa.append(el('p', 'shop-note', `Para confirmar, escreva o nome da guilda: ${g.nome}`));

  const campo = document.createElement('input');
  campo.type = 'text';
  campo.className = 'guilda-campo';
  campo.autocomplete = 'off';
  campo.placeholder = g.nome;
  caixa.append(campo);

  const acoes = el('div', 'confirm-actions');
  const cancelar = el('button', 'ghost', 'Cancelar');
  const sim = el('button', 'danger', 'Desfazer');
  sim.disabled = true;
  acoes.append(cancelar, sim);
  caixa.append(acoes);

  /*
   * A comparação ignora caixa e espaços das pontas: quem digitou o nome certo
   * com um espaço sobrando leu tudo e quis — recusar ali seria castigar a
   * atenção em vez da falta dela.
   */
  const bate = () => campo.value.trim().toLowerCase() === g.nome.trim().toLowerCase();
  campo.oninput = () => {
    sim.disabled = !bate();
  };
  const fechar = () => fundo.remove();
  cancelar.onclick = fechar;
  sim.onclick = () => {
    if (!bate()) return campo.focus();
    fechar();
    ctx.send({ t: 'guilda', action: 'desfazer' });
  };

  fundo.append(caixa);
  document.body.append(fundo);
  fecharAoClicarFora(fundo, fechar);
  atalhosDaCaixa(fundo, { confirmar: () => !sim.disabled && sim.click(), fechar });
  campo.focus();
}

/* =========================================================================
 * O BALÃO DE UM MEMBRO — o que ele veste e onde ele está
 *
 * "faz mostrar os itens atuais e onde está caçando pra quem passar o mouse em
 *  cada membro da sua guild, igual como é no site."
 *
 * ---- Por que num balão, e não na linha ----
 *
 * São dez peças e um lugar por pessoa. Numa lista de trinta membros isso é
 * trezentos ícones na tela ao mesmo tempo, e a lista deixaria de responder a
 * pergunta que ela existe para responder — quem está na guilda e quem está
 * online. O balão põe a segunda pergunta a um movimento de mouse de distância,
 * e mantém a primeira legível.
 *
 * ---- O que ele mostra quando não há nada ----
 *
 * Quem está offline não tem lugar (ver `fichaDeMembro` no servidor: ele devolve
 * `onde: null`), e aí a linha do lugar não nasce em vez de dizer "na cidade" de
 * quem não está conectado. O equipamento continua aparecendo: ele é do save, e
 * é verdade estando a pessoa conectada ou não.
 *
 * Os NOMES dos itens saem de `state.items`, o catálogo que o cliente já tem.
 * Nada disso viaja por membro.
 * ========================================================================= */
const NOME_DO_SLOT = {
  head: 'Cabeça',
  neck: 'Pescoço',
  body: 'Corpo',
  legs: 'Pernas',
  feet: 'Pés',
  ring: 'Anel',
  weapon: 'Arma',
  shield: 'Escudo',
  ammo: 'Munição',
  backpack: 'Mochila',
  gloves: 'Luvas',
  ring2: 'Anel',
};

function balaoDoMembro(membro) {
  const caixa = el('div', 'guilda-tip ficha-membro');

  /* =======================================================================
   * ---- O CABEÇALHO, como o do card do site ----
   *
   * Boneco à esquerda; à direita o nome em serifada dourada, o posto com a
   * vocação, o "Level N" com o número em destaque e a linha de estado. É a
   * mesma pilha do `.top5-pop-cabeca`, com um fio embaixo separando do
   * equipamento.
   * ======================================================================= */
  const cabeca = el('div', 'ficha-membro-cabeca');
  cabeca.append(bonecoDe(membro, 64));
  const texto = el('div', 'ficha-membro-quem');
  texto.append(el('b', null, membro.nome));

  const voc = vocacaoCurta(membro.vocation);
  texto.append(el('span', null, [membro.posto, voc].filter(Boolean).join(' · ')));

  if (membro.level) {
    const nivel = el('span', null, 'Level ');
    nivel.append(el('em', null, Number(membro.level).toLocaleString('pt-BR')));
    texto.append(nivel);
  }

  /*
   * O estado na mesma pilha, e não numa faixa própria: no card do site ele é a
   * última linha do cabeçalho, com a bolinha na frente. Três estados, como
   * antes — caçando (com o lugar), na cidade, e fora. Quem está offline não tem
   * lugar nenhum: dizer "na cidade" de quem não está conectado seria a tela
   * inventando uma pessoa.
   */
  const onde = membro.onde;
  const estado = el('span', onde ? 'on' : 'off');
  estado.append(el('i', `ficha-membro-ponto${onde ? '' : ' off'}`));
  if (!onde) estado.append(document.createTextNode('offline'));
  else if (onde.cacando) estado.append(document.createTextNode(`Caçando em ${onde.lugar}`));
  else estado.append(document.createTextNode('Na cidade'));
  texto.append(estado);

  cabeca.append(texto);
  caixa.append(cabeca);

  const veste = membro.veste ?? [];
  if (!veste.length) {
    caixa.append(el('p', 'guilda-tip-vazio', 'Sem nada equipado.'));
    return caixa;
  }

  /* =======================================================================
   * ---- O EQUIPAMENTO, na cruz do Tibia ----
   *
   * "hoje o equipamento aparece como uma fileira solta de ícones, sem a ordem
   *  dos slots."
   *
   * Era uma fileira de cinco por linha, na ordem em que o servidor mandou: a
   * arma podia cair ao lado do anel, e de uma pessoa para outra as peças
   * trocavam de lugar. Na cruz, cada coisa tem um lugar fixo — quem procura a
   * arma olha sempre para a mesma célula, e a casa VAZIA continua desenhada,
   * então a grade não anda quando falta uma peça.
   *
   * A grade é a do site (`gradeDeEquipamento`); o que este arquivo faz é
   * TRADUZIR o que o servidor manda no formato que ela pede. Ver `paperdoll.mjs`.
   * ======================================================================= */
  const porSlot = new Map(veste.map((peca) => [peca.slot, peca]));
  caixa.append(el('div', 'ficha-membro-titulo', 'Equipamento'));
  caixa.append(
    gradeDeEquipamento((slot) => {
      const peca = porSlot.get(slot);
      if (!peca) return null;
      const nome = ctx.state.items?.[peca.id]?.name ?? `item ${peca.id}`;
      return {
        id: peca.id,
        tier: peca.tier,
        /*
         * O nome e a casa no `title` do quadrado: o balão do inventário não
         * cabe aqui — este card JÁ É um balão, e um balão não recebe mouse
         * (`.tooltip` é `pointer-events: none`). O título do navegador é o que o
         * card do site usa pelo mesmo motivo.
         */
        titulo: `${nome}${peca.tier ? ` +${peca.tier}` : ''} — ${NOME_DO_SLOT[peca.slot] ?? peca.slot}`,
        raridade: ctx.state.items?.[peca.id]?.rarity,
        // A peça do PoE: a borda na cor da raridade dela.
        corPoe: peca.poe?.cor ?? null,
        estrelas: estrelasDosAfixos(peca.af).map(({ q, n }) => ({ q, n })),
      };
    // O jogo oficial: a grade do PoE, a mesma do inventário (com as luvas e o segundo anel).
    }, { poe: !!ctx.state.classesPoe }),
  );

  const resumo = resumoDoConjunto(veste);
  if (resumo) caixa.append(resumo);
  return caixa;
}

/* =========================================================================
 * O QUE O CONJUNTO DÁ — a mesma leitura da ficha do site
 *
 * "em vez de mostrar igual na foto 1, tem que mostrar igual na foto 2."
 *
 * A foto 1 era a grade de quadradinhos, e ela responde "o que ele está usando".
 * A foto 2 é a ficha do site, que responde outra pergunta: "o que isso tudo DÁ".
 * São dez peças, até trinta afixos e quatro bônus de tier espalhados por elas —
 * somá-los na cabeça, olhando ícone por ícone, não é uma conta que alguém faça.
 *
 * As duas ficam: a grade em cima (reconhecer o set de relance) e este resumo
 * embaixo (o número). É a mesma ordem da ficha do site.
 *
 * ---- AS CONTAS SÃO AS DO JOGO, e não uma segunda cópia ----
 *
 * As estrelas saem de `estrelasDosAfixos` (a mesma do balão da mochila, com a
 * mesma régua e as mesmas quatro cores) e o bônus de tier sai da fórmula do
 * catálogo do servidor — a·t² + b·t + c —, a mesma linha que o balão do item
 * calcula. Uma segunda fórmula aqui seria um número que um dia discorda do
 * balão que está aberto ao lado.
 * ========================================================================= */

/** O valor de um afixo escrito como o balão da mochila o escreve. */
const valorDoAfixo = (ficha, valor) => {
  const n = Math.round((Number(valor) || 0) * 100) / 100;
  return ficha?.tipo === 'flat' ? `+${n}` : `+${String(n).replace('.', ',')}%`;
};

function resumoDoConjunto(veste) {
  const catalogo = ctx.state.catalog ?? null;

  /*
   * Os afixos SOMADOS POR TIPO, e não listados peça a peça: três peças com
   * "resistência a fogo" são um número só para quem apanha de fogo. Cada peça
   * continua visível nos selos da linha, que é de onde vem o "de onde sai".
   */
  const grupos = new Map();
  let comAfixo = 0;
  for (const peca of veste) {
    const estrelas = estrelasDosAfixos(peca.af);
    if (!estrelas.length) continue;
    comAfixo += 1;
    for (const posto of estrelas) {
      const grupo = grupos.get(posto.id) ?? { id: posto.id, total: 0, partes: [] };
      grupo.total += Number(posto.value) || 0;
      grupo.partes.push({ peca, posto });
      grupos.set(posto.id, grupo);
    }
  }

  /*
   * E os bônus do TIER da forja: cada slot tem o seu (Onslaught na arma,
   * Momentum no elmo, Ruse na armadura, Amplification na bota). O slot vem do
   * catálogo de itens e não do que o servidor mandou, pelo mesmo motivo de
   * sempre: quem sabe o slot de um id é o catálogo.
   */
  const tiers = [];
  for (const peca of veste) {
    const tier = Math.floor(Number(peca.tier) || 0);
    if (tier <= 0) continue;
    const slot = ctx.state.items?.[peca.id]?.slot ?? peca.slot;
    const efeito = catalogo?.efeitosDeTier?.[slot];
    if (!efeito) continue;
    tiers.push({ peca, tier, efeito, percent: efeito.a * tier * tier + efeito.b * tier + efeito.c });
  }

  const lista = [...grupos.values()].sort(
    (a, b) => b.partes.length - a.partes.length
      || String(catalogo?.afixos?.[a.id]?.nome ?? a.id).localeCompare(String(catalogo?.afixos?.[b.id]?.nome ?? b.id), 'pt-BR'),
  );
  /* Sem afixo e sem tier não há resumo nenhum: um título sozinho não diz nada. */
  if (!lista.length && !tiers.length) return null;

  const fora = el('div', 'ficha-membro-afx');
  const quantos = lista.reduce((soma, g) => soma + g.partes.length, 0);
  const partesDoTitulo = [];
  if (quantos) partesDoTitulo.push(`${quantos} afixo${quantos === 1 ? '' : 's'} em ${comAfixo} peça${comAfixo === 1 ? '' : 's'}`);
  if (tiers.length) partesDoTitulo.push(`${tiers.length} bônus de tier`);
  fora.append(el('div', 'ficha-membro-titulo', 'Afixos e tiers'));
  fora.append(el('div', 'ficha-membro-sub', partesDoTitulo.join(' · ')));
  /*
   * ---- A LISTA ROLA POR DENTRO ----
   *
   * "se a lista for longa, a seção de afixos rola por dentro do card; o
   *  cabeçalho e o equipamento ficam sempre visíveis."
   *
   * Um set inteiro estrelado passa de dez linhas, e é isso que fazia o card
   * descer até sair pela beirada de baixo da tela. Com o teto aqui, o que cresce
   * é esta caixa e não o card.
   *
   * A lista já vem ordenada pelo afixo que está em MAIS peças, então o que
   * eventualmente fica embaixo da dobra é o menos relevante — o que importa
   * porque um balão não recebe mouse e ninguém pode rolá-lo com a roda.
   */
  const caixa = el('div', 'guilda-tip-afx');

  /* Os tiers primeiro: são poucos, e são o que a forja cobrou caro. */
  for (const { peca, tier, efeito, percent } of tiers) {
    const linha = el('div', 'guilda-tip-afx-linha');
    const topo = el('div', 'guilda-tip-afx-topo');
    topo.append(
      el('span', null, efeito.nome ?? 'bônus de tier'),
      el('b', 'de-tier', `+${(Math.round(percent * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`),
    );
    linha.append(topo);
    const chips = el('div', 'guilda-tip-afx-chips');
    const chip = el('span', 'guilda-tip-afx-chip');
    try {
      chip.append(itemCanvas(peca.id, 16));
    } catch {
      /* sem sprite: o texto do chip ainda diz o tier */
    }
    chip.append(el('em', null, `Tier ${tier}`));
    chips.append(chip);
    linha.append(chips);
    caixa.append(linha);
  }

  for (const grupo of lista) {
    const ficha = catalogo?.afixos?.[grupo.id];
    const linha = el('div', 'guilda-tip-afx-linha');
    const topo = el('div', 'guilda-tip-afx-topo');
    topo.append(el('span', null, ficha?.nome ?? grupo.id), el('b', null, valorDoAfixo(ficha, grupo.total)));
    linha.append(topo);
    /*
     * Os selos: um por peça que tem este afixo, com o desenho dela, a estrela na
     * cor do degrau e o quanto ELA dá. É o que responde "de onde vem esse
     * número" sem precisar de uma segunda tela.
     */
    const chips = el('div', 'guilda-tip-afx-chips');
    for (const { peca, posto } of grupo.partes) {
      const chip = el('span', 'guilda-tip-afx-chip');
      try {
        chip.append(itemCanvas(peca.id, 16));
      } catch {
        /* sem sprite: a estrela e o valor bastam */
      }
      chip.append(el('b', classeDaEstrela(posto), '★'), el('em', null, valorDoAfixo(ficha, posto.value)));
      chips.append(chip);
    }
    linha.append(chips);
    caixa.append(linha);
  }
  fora.append(caixa);
  return fora;
}

/* =========================================================================
 * O PAINEL DE MELHORIA SAIU DAQUI
 *
 * Ele era uma secao inteira embaixo do card — titulo, barra, legenda de duas
 * partes, o paragrafo da vaquinha e um botao de tamanho cheio. Virou UMA LINHA
 * dentro do proprio card (ver `faixaDeNivel`): selo, barra fina, o quanto falta
 * e um botao pequeno.
 *
 * As vagas, que eram metade do assunto dele, ja' aparecem no chip de membros
 * (`4/20`) logo acima — e o recado da vaquinha foi para a caixa de contribuir,
 * que e' onde ele importa.
 * ========================================================================= */

/* =========================================================================
 * OURO EM TAMANHO CURTO — 1.500.000.000 vira "1,5kkk"
 *
 * E' como o jogo fala de ouro: ninguem escreve um bilhao por extenso no chat.
 * Numa barra de progresso e num botao pequeno, o numero por extenso ocupa mais
 * espaco do que a peca inteira tem.
 *
 * (Ele morava dentro do painel de melhoria, que saiu. Continua aqui porque tres
 * lugares o usam — a faixa de nivel, a caixa de contribuir e os atalhos dela.)
 * ========================================================================= */
const OURO_CURTO = (n) => {
  const valor = Math.max(0, Math.floor(Number(n) || 0));
  if (valor >= 1_000_000_000) return `${(valor / 1_000_000_000).toFixed(valor % 1_000_000_000 ? 1 : 0).replace('.', ',')}kkk`;
  if (valor >= 1_000_000) return `${(valor / 1_000_000).toFixed(valor % 1_000_000 ? 1 : 0).replace('.', ',')}kk`;
  if (valor >= 1_000) return `${Math.floor(valor / 1_000)}k`;
  return valor.toLocaleString('pt-BR');
};

/* =========================================================================
 * LER UM VALOR DE OURO DO QUE A PESSOA DIGITOU
 *
 * "campo numerico formatado com pontos (1.000.000) enquanto digita, aceitando
 *  tambem atalhos tipo 500k, 10kk, 1kkk."
 *
 * Os dois formatos convivem sem ambiguidade por causa de uma regra so': o PONTO
 * e' separador de milhar e a VIRGULA e' decimal — que e' como se escreve numero
 * em portugues, e e' como o proprio campo devolve o que formatou.
 *
 *   1.000.000   um milhao      (os pontos caem, viram 1000000)
 *   500k        quinhentos mil (mil por cada `k`)
 *   1,5kk       um milhao e meio
 *   1kkk        um bilhao
 *
 * Devolve `NaN` para o que nao e' numero — e `NaN` nao passa por nenhuma
 * comparacao, o que faz o botao ficar travado sem precisar de um caso a mais.
 * ========================================================================= */
function lerOuro(texto) {
  const limpo = String(texto ?? '').trim().toLowerCase().replace(/\s|\./g, '').replace(',', '.');
  const casa = /^(\d+(?:\.\d+)?)(k*)$/.exec(limpo);
  if (!casa) return Number.NaN;
  const valor = Number(casa[1]) * 1000 ** casa[2].length;
  return Number.isFinite(valor) ? Math.floor(valor) : Number.NaN;
}

/* =========================================================================
 * A CAIXA DE CONTRIBUIR
 *
 * Ela nao reusa `perguntar` porque tem um CAMPO dentro, e `perguntar` e' uma
 * pergunta de sim ou nao. O resto e' igual — o mesmo fundo, o mesmo fechar ao
 * clicar fora, o mesmo par de botoes — para nao parecer outra janela.
 *
 * ---- O QUE ELA MOSTRA ANTES DE PERGUNTAR ----
 *
 * "mostrar em cima: Voce tem X (bolso) + Y (banco) e Faltam Z."
 *
 * As duas linhas existem porque a pergunta "quanto voce quer dar" nao tem
 * resposta sem elas. Sem o saldo, a pessoa chuta e leva uma recusa; sem o que
 * falta, ela da' mais do que precisava e o troco nao volta.
 *
 * ---- O TETO E' CONFERIDO AQUI *E* NO SERVIDOR ----
 *
 * Aqui para a pessoa nao ser recusada depois de digitar; la' porque uma tela
 * nao e' uma trava (ver `contribuirParaAGuilda`). O texto explicativo da
 * vaquinha mora nesta caixa e saiu da tela principal: ele so' importa na hora
 * de dar o ouro.
 * ========================================================================= */
function caixaDeContribuir(g) {
  const nivel = g.nivel;
  const bolso = Math.max(0, Math.floor(Number(ctx.state?.character?.gold) || 0));
  const banco = Math.max(0, Math.floor(Number(ctx.state?.character?.bank) || 0));
  const saldo = bolso + banco;
  /*
   * O teto e' o MENOR entre o que se tem e o que falta — as duas recusas que o
   * servidor daria. Ver `contribuirParaAGuilda`.
   */
  const teto = Math.max(0, Math.min(saldo, nivel.falta));

  const fundo = el('div', 'confirm-back');
  const cartao = el('div', 'confirm-box guilda-doar');
  cartao.append(el('h3', null, `Contribuir para a ${g.nome}`));

  /* ---- os dois numeros que a decisao precisa ---- */
  const contas = el('div', 'doar-contas');
  const linhaSaldo = el('div', 'doar-conta');
  linhaSaldo.append(el('span', null, 'Você tem'));
  const valorSaldo = el('b', null, saldo.toLocaleString('pt-BR'));
  linhaSaldo.append(valorSaldo);
  linhaSaldo.append(el('i', null, `${OURO_CURTO(bolso)} no bolso + ${OURO_CURTO(banco)} no banco`));
  contas.append(linhaSaldo);

  const linhaFalta = el('div', 'doar-conta');
  linhaFalta.append(el('span', null, 'Faltam'));
  linhaFalta.append(el('b', 'ouro', nivel.falta.toLocaleString('pt-BR')));
  linhaFalta.append(el('i', null, `para o nível ${nivel.nivel + 1} — ${nivel.vagasDoProximo} vagas`));
  contas.append(linhaFalta);
  cartao.append(contas);

  /* ---- o campo ---- */
  const campo = document.createElement('input');
  /*
   * `text` e nao `number`: um campo numerico do navegador nao aceita ponto de
   * milhar nem `kk`, e ainda poe as setinhas de rolar que roubam largura. A
   * conferencia e' nossa de qualquer jeito.
   */
  campo.type = 'text';
  campo.inputMode = 'numeric';
  campo.autocomplete = 'off';
  campo.spellcheck = false;
  campo.className = 'guilda-campo doar-campo';
  campo.placeholder = 'quanto de ouro — ou 500k, 10kk, 1kkk';
  cartao.append(campo);

  const aviso = el('p', 'doar-aviso');
  cartao.append(aviso);

  /* ---- os atalhos ---- */
  const atalhos = el('div', 'doar-atalhos');
  const porFracao = (fracao, rotulo) => {
    const b = el('button', 'guilda-mini', rotulo);
    b.type = 'button';
    tipTexto(b, `${rotulo} do que você pode dar agora (${OURO_CURTO(Math.floor(teto * fracao))})`);
    b.onclick = () => {
      campo.value = Math.floor(teto * fracao).toLocaleString('pt-BR');
      medir();
      campo.focus();
    };
    atalhos.append(b);
  };
  porFracao(0.1, '10%');
  porFracao(0.25, '25%');
  porFracao(0.5, '50%');

  /*
   * O "Máximo" substituiu o "Dar os 1kkk que faltam", e o rótulo MUDA conforme
   * o caso: quem tem o suficiente vê "Máximo"; quem não tem vê quanto é que ele
   * vai dar. Um botão que promete o total para quem não o tem é um botão que
   * leva a uma recusa.
   */
  const maximo = el('button', 'guilda-mini primario', saldo >= nivel.falta ? 'Máximo' : `Dar tudo que tenho (${OURO_CURTO(saldo)})`);
  maximo.type = 'button';
  tipTexto(maximo, `${teto.toLocaleString('pt-BR')} de ouro — o menor entre o que você tem e o que falta.`);
  maximo.onclick = () => {
    campo.value = teto.toLocaleString('pt-BR');
    medir();
    campo.focus();
  };
  atalhos.append(maximo);
  cartao.append(atalhos);

  /* ---- a prévia da barra ---- */
  const previa = el('div', 'doar-previa');
  const trilho = el('div', 'guilda-barra');
  const cheioAgora = el('i', 'guilda-barra-cheia');
  const cheioDepois = el('i', 'guilda-barra-cheia doar-ganho');
  trilho.append(cheioAgora, cheioDepois);
  previa.append(trilho);
  const legenda = el('div', 'doar-previa-legenda');
  previa.append(legenda);
  cartao.append(previa);

  /* =======================================================================
   * ---- O HISTORICO SAIU DAQUI, E VIROU UM LINK ----
   *
   * "se os historico ocupar muito espaço desnecessario, faz (...) um botao que abre
   *  todos esses historicos divididos por abas."
   *
   * Ele esteve embutido nesta caixa: as ultimas contribuicoes e o placar, lado a
   * lado, acima dos botoes. Numa janela que ja' tem contas, campo, atalhos, previa,
   * dois botoes e o recado da vaquinha, eram mais cem pixels de altura — e a caixa
   * passava de uma tela em janela baixa.
   *
   * Agora e' um link de uma linha, e ele abre a caixa do historico JA' NA ABA das
   * contribuicoes: quem clica daqui esta' perguntando sobre ouro, e cair numa aba de
   * expulsoes seria um clique a mais.
   * ======================================================================= */
  const linhaDoDiario = el('p', 'guilda-nota doar-historico');
  const verHistorico = el('button', 'guilda-link', 'Ver quem já contribuiu');
  verHistorico.type = 'button';
  tipTexto(verHistorico, 'As últimas contribuições e o placar de quem mais deu.');
  verHistorico.onclick = () => abrirHistorico('contribuicoes');
  linhaDoDiario.append(verHistorico);
  cartao.append(linhaDoDiario);

  const acoes = el('div', 'confirm-actions');
  const cancelar = el('button', 'guilda-botao', 'Cancelar');
  const confirmar = el('button', 'guilda-botao primario', 'Contribuir');
  acoes.append(cancelar, confirmar);
  cartao.append(acoes);

  cartao.append(
    el(
      'p',
      'guilda-nota doar-recado',
      'O ouro sai do seu bolso e do seu banco na hora, e NÃO volta: a poupança da guilda não é um cofre, é uma vaquinha. O nível sobe sozinho quando a barra enche.',
    ),
  );

  /* =======================================================================
   * A CONTA, A CADA TECLA
   *
   * Uma função só, chamada pelo campo e pelos atalhos: se cada um fizesse a sua
   * parte, o botão ficaria destravado por um caminho e travado por outro.
   * ======================================================================= */
  let quanto = 0;
  function medir() {
    const cru = lerOuro(campo.value);
    const valido = Number.isFinite(cru) && cru > 0;
    /* Passar do teto TRAVA no teto, em vez de recusar: é o que a pessoa queria. */
    const passou = valido && cru > teto;
    quanto = valido ? Math.min(cru, teto) : 0;

    /*
     * O campo é reescrito formatado, e só quando o que está lá não tem `k`: com
     * `k` a pessoa ainda está escrevendo o atalho, e reformatar no meio apagaria
     * o que ela digitou. O cursor vai para o fim porque é de lá que se digita —
     * reposicioná-lo no meio de um número que mudou de tamanho é pior.
     */
    if (!/k/i.test(campo.value) && quanto > 0) {
      const formatado = quanto.toLocaleString('pt-BR');
      if (campo.value !== formatado) {
        campo.value = formatado;
        campo.setSelectionRange?.(formatado.length, formatado.length);
      }
    }

    aviso.textContent = passou
      ? saldo < nivel.falta
        ? `Você só tem ${OURO_CURTO(saldo)}.`
        : `Só faltam ${OURO_CURTO(nivel.falta)}.`
      : campo.value.trim() && !valido
        ? 'Escreva um número — ou 500k, 10kk, 1kkk.'
        : '';
    aviso.classList.toggle('ligado', !!aviso.textContent);

    confirmar.disabled = quanto <= 0;

    const parte = nivel.custo > 0 ? Math.min(1, nivel.guardado / nivel.custo) : 0;
    const depois = nivel.custo > 0 ? Math.min(1, (nivel.guardado + quanto) / nivel.custo) : 0;
    cheioAgora.style.width = `${Math.round(parte * 100)}%`;
    /* A fatia NOVA começa onde a antiga acaba — ela mostra o que este gesto soma. */
    cheioDepois.style.left = `${Math.round(parte * 100)}%`;
    cheioDepois.style.width = `${Math.round((depois - parte) * 100)}%`;
    legenda.textContent = quanto
      ? `${OURO_CURTO(nivel.guardado + quanto)} / ${OURO_CURTO(nivel.custo)}${nivel.guardado + quanto >= nivel.custo ? ' — o nível sobe' : ''}`
      : `${OURO_CURTO(nivel.guardado)} / ${OURO_CURTO(nivel.custo)}`;
  }

  campo.oninput = medir;
  const fechar = () => fundo.remove();
  cancelar.onclick = fechar;
  confirmar.onclick = () => {
    if (quanto <= 0) return campo.focus();
    ctx.send({ t: 'guilda', action: 'contribuir', quanto });
    fechar();
  };

  medir();
  fundo.append(cartao);
  document.body.append(fundo);
  fecharAoClicarFora(fundo, fechar);
  atalhosDaCaixa(fundo, { confirmar: () => !confirmar.disabled && confirmar.click(), fechar });
  campo.focus();
}

/** Uma linha da lista de membros, com boneco, posto e os gestos do cargo. */
function linhaDeMembro(membro, g, { souLider, mando }) {
  const linha = el('div', `guilda-membro cargo-${membro.cargo}${membro.online ? ' online' : ''}`);
  /*
   * O balão vai na LINHA inteira, e não só no nome: a área de acerto é o que se
   * vê, e uma pessoa que quer espiar o equipamento de alguém passa o mouse na
   * linha dele, não em cima das quatro letras do nome.
   *
   * Os filhos que têm balão próprio (a bolinha de online, a coroa) continuam
   * ganhando: `closest` acha o mais interno primeiro.
   */
  tipPanel(linha, () => balaoDoMembro(membro));
  linha.append(bonecoDe(membro, 36));

  const nome = el('div', 'guilda-membro-nome');
  const cima = el('div', 'guilda-membro-cima');
  cima.append(el('b', null, membro.nome));
  if (membro.cargo === LIDER) {
    const coroa = el('i', 'guilda-coroa', '♛');
    tipTexto(coroa, 'Líder');
    cima.append(coroa);
  } else if (membro.cargo === VICE) {
    const escudo = el('i', 'guilda-vice', '❖');
    tipTexto(escudo, 'Vice-líder');
    cima.append(escudo);
  }
  nome.append(cima);

  const baixo = el('div', 'guilda-membro-baixo');
  baixo.append(el('span', 'guilda-posto', membro.posto));
  if (membro.level) {
    baixo.append(el('span', null, `level ${membro.level}`));
    /*
     * ---- O ÍCONE DA VOCAÇÃO, ao lado da sigla ----
     *
     * "lá em guild, em membros, ao lado da vocação coloca o ícone da vocação
     *  também."
     *
     * É o mesmo ícone de perícia que o card da party usa — espada para o
     * knight, arco para o paladin. Ele lê-se de relance, que é o que a sigla de
     * duas letras não faz: numa lista de trinta, "EK" e "ED" a 10px de altura
     * são a mesma mancha.
     *
     * A sigla FICA junto, e não é substituída: o ícone diz a família e a sigla
     * diz a promoção (um `knight` e um `elite knight` têm o mesmo ícone).
     */
    const voc = vocacaoCurta(membro.vocation);
    if (membro.vocation) {
      const marca = artOrUiIcon(PERICIA_DA_VOCACAO[familiaDaVocacao(membro.vocation)] ?? 'sk-misc', '');
      marca.classList.add('guilda-voc-icone');
      tipTexto(marca, NOME_DA_VOCACAO[familiaDaVocacao(membro.vocation)] ?? membro.vocation);
      baixo.append(marca);
    }
    if (voc) baixo.append(el('span', 'guilda-voc-sigla', voc));
  }
  nome.append(baixo);
  linha.append(nome);

  const ponto = el('span', `guilda-ponto${membro.online ? ' aceso' : ''}`);
  tipTexto(ponto, membro.online ? 'online agora' : 'offline');
  linha.append(ponto);

  const acoes = el('div', 'guilda-membro-acoes');
  const euMesmo = membro.nome === ctx.state.character?.name;

  /*
   * Os gestos aparecem por CARGO, e o alvo tem de valer menos que quem olha — a
   * mesma conta do `podeMexerEm` no servidor. Aqui ela serve para não oferecer
   * o que vai ser recusado; lá ela é a regra.
   */
  if (souLider && !euMesmo) {
    if (membro.cargo === VICE) {
      const rebaixar = el('button', 'guilda-mini', 'Rebaixar');
      rebaixar.onclick = () =>
        perguntar(
          {
            titulo: `Rebaixar ${membro.nome}?`,
            texto: 'Ele volta a ser Membro e perde o direito de convidar, aceitar pedidos e expulsar.',
            botao: 'Rebaixar',
          },
          () => ctx.send({ t: 'guilda', action: 'posto', quem: membro.nome, cargo: 1 }),
        );
      acoes.append(rebaixar);
    } else {
      const promover = el('button', 'guilda-mini', 'Promover');
      tipTexto(promover, 'Vice-líder convida, aceita pedidos e expulsa membro.');
      promover.onclick = () =>
        perguntar(
          {
            titulo: `Promover ${membro.nome} a vice-líder?`,
            texto: 'Como vice ele passa a convidar, aceitar pedidos e expulsar membros. Ele não mexe em você nem nos outros vices.',
            botao: 'Promover',
          },
          () => ctx.send({ t: 'guilda', action: 'posto', quem: membro.nome, cargo: VICE }),
        );
      acoes.append(promover);
    }
    const passar = el('button', 'guilda-mini', 'Dar liderança');
    passar.onclick = () =>
      perguntar(
        {
          titulo: `Passar a liderança para ${membro.nome}?`,
          texto: 'Ele vira líder e você vira vice na mesma hora. Só ele poderá devolver — quem manda é quem tem o posto.',
          botao: 'Passar a liderança',
          perigo: true,
        },
        () => ctx.send({ t: 'guilda', action: 'passar', quem: membro.nome }),
      );
    acoes.append(passar);
  }
  if (mando && !euMesmo && membro.cargo < g.meuCargo) {
    const fora = el('button', 'guilda-mini perigo', 'Expulsar');
    fora.onclick = () =>
      perguntar(
        {
          titulo: `Expulsar ${membro.nome}?`,
          texto: 'Ele sai da guilda na hora e a tela dele muda no mesmo instante. Para voltar vai precisar de um convite novo.',
          botao: 'Expulsar',
          perigo: true,
        },
        () => ctx.send({ t: 'guilda', action: 'expulsar', quem: membro.nome }),
      );
    acoes.append(fora);
  }
  linha.append(acoes);
  return linha;
}

/* =========================================================================
 * O BAÚ COMUNITÁRIO
 *
 * "um cofre comunitário da guild que as pessoas podem colocar itens lá e
 *  qualquer pessoa membra da guild pode pegar, e seria igual o baú do depósito,
 *  e pode colocar o mesmo ícone do baú da conta e nomear como baú comunitário
 *  (tem que avisar a pessoa que esse baú todo mundo da guild atual dela
 *  consegue pegar)."
 *
 * ---- Duas grades, e não uma lista com botões ----
 *
 * O baú de um lado, a mochila do outro, e um clique move a peça. É o desenho do
 * depósito, e é o que ele pediu — "igual o baú do depósito". A alternativa (uma
 * lista com "guardar" e "pegar" escritos) transformaria em leitura o que aqui é
 * reconhecimento: as pessoas acham o item pelo desenho dele.
 *
 * ---- O AVISO fica em cima, sempre ----
 *
 * "tem que avisar a pessoa que esse baú todo mundo da guild atual dela consegue
 *  pegar."
 *
 * Ele vem do SERVIDOR (`view.bau.aviso`) e não some nunca. Um aviso que aparece
 * uma vez é um aviso que quem entrou na guilda depois nunca viu — e é
 * justamente quem entrou ontem que vai guardar a peça errada.
 *
 * ---- E guardar PERGUNTA, pegar não ----
 *
 * Guardar é o gesto irreversível aqui: a peça passa a ser de trinta pessoas, e
 * a que a tirar não precisa devolver. Pegar é só pegar — se foi engano, guarda
 * de volta. Por isso a caixa de confirmar está de um lado só.
 * ========================================================================= */
function renderBau(body, view) {
  const bau = view.bau ?? null;
  if (!bau) return void body.append(el('p', 'empty', 'Só quem está numa guilda tem baú comunitário.'));

  const cabecalho = el('section', 'guilda-painel');
  const linha = el('div', 'guilda-painel-cabeca');
  linha.append(el('h4', 'guilda-titulo', bau.nome));
  linha.append(el('span', 'guilda-nota', `${bau.tipos} de ${bau.teto} vagas`));
  cabecalho.append(linha);
  cabecalho.append(el('p', 'guilda-aviso', bau.aviso));
  body.append(cabecalho);

  /* ---- O baú ---- */
  const caixa = el('section', 'guilda-painel');
  const topo = el('div', 'guilda-painel-cabeca');
  topo.append(el('h4', 'guilda-titulo', 'No baú'));
  const ferramentas = el('div', 'guilda-bau-ferramentas');
  const organizar = el('button', 'guilda-mini', 'Organizar');
  tipTexto(organizar, 'Põe o baú na mesma ordem do depósito.');
  organizar.onclick = () => ctx.send({ t: 'guilda', action: 'bauOrganizar' });
  ferramentas.append(organizar);
  if (bau.podeComprarVagas) {
    const comprar = el('button', 'guilda-mini', `+${bau.vagasPorCompra} vagas`);
    tipTexto(
      comprar,
      [
        `Mais ${bau.vagasPorCompra} vagas por ${bau.coinsPorCompra} Draevor Coins`,
        `O baú vai até ${bau.vagasNoMaximo} vagas.`,
        'As vagas são da GUILDA e ficam com ela — quem paga não as leva embora ao sair.',
      ].join(SALTO),
    );
    comprar.onclick = () =>
      /*
       * "até mesmo comprando as vagas do baú compartilhado da guilda."
       *
       * A mesma caixa da loja. A nota carrega o que a caixa da loja não tem como
       * saber: as vagas são da GUILDA, e quem paga não as leva embora ao sair.
       */
      confirmPurchase({
        cabecalho: 'Comprar vagas do baú',
        title: `+${bau.vagasPorCompra} vagas`,
        cost: bau.coinsPorCompra,
        balance: ctx.state?.character?.coins ?? 0,
        note:
          `O baú passa a ter ${Math.min(bau.vagasNoMaximo, bau.teto + bau.vagasPorCompra)} vagas, de ${bau.vagasNoMaximo} possíveis. ` +
          'As vagas são da GUILDA e ficam com ela — quem paga não as leva embora ao sair.',
        onConfirm: () => ctx.send({ t: 'guilda', action: 'bauVagas' }),
      });
    ferramentas.append(comprar);
  }
  topo.append(ferramentas);
  caixa.append(topo);

  /* =======================================================================
   * A GRADE, COM AS VAGAS VAZIAS — a mesma do depósito
   *
   * "arruma o que eu te pedi dos slots do baú mostrarem daquele jeito, igual o baú
   *  normal lá."
   *
   * As classes sao as DE LA' (`locker-grade caixa-quadrada`), e nao uma cópia com
   * outro nome: duas caixas que guardam item do mesmo jeito nao podem ter dois
   * tamanhos de quadradinho e dois espacamentos.
   *
   * ---- E AS VAGAS VAZIAS NAO SAO ENFEITE ----
   *
   * Numa caixa com quatro coisas, sao elas que dizem que ainda cabem vinte e uma.
   * Sem elas, o bau com quatro itens e o bau CHEIO tem o mesmo desenho — so' de
   * comprimentos diferentes —, e quem chega com a mochila cheia nao tem como saber
   * se vale a pena comprar vagas.
   *
   * ---- ARRASTAR DA MOCHILA CAI AQUI ----
   *
   * "faltou o sistema de arrastar direto da mochila, igual como e' nos outros baus
   *  existentes."
   *
   * A area de largar e' a GRADE INTEIRA, e nao cada celula: soltar em cima de um
   * item para guardar OUTRO nao quer dizer nada, e mirar um quadradinho de 38px e'
   * pior do que mirar a caixa toda. Mesma escolha do deposito.
   * ======================================================================= */
  /*
   * ---- A MARCA E' PROPRIA, E NAO A DO DEPOSITO ----
   *
   * Ela era `deposito-alvo`, emprestada de la' por causa da moldura tracejada do
   * arrasto. E' a mesma classe que `caixaDoDepositoAberta` (panels.mjs) procura no
   * `#modal` para responder "ha' uma caixa do deposito esperando item?" — e com o
   * bau da guilda aberto ela respondia SIM, apontando a ultima caixa que aquele
   * jogador tivesse aberto no dia. O clique na mochila mandaria a peca para o
   * deposito, com o bau da guilda na tela.
   *
   * Duas caixas diferentes nao podem responder ao mesmo nome. A moldura do arrasto
   * continua a mesma — o CSS lista as duas classes lado a lado.
   */
  const grade = el('div', 'locker-grade caixa-quadrada guilda-bau-alvo');
  aceitarSoltura(grade, (carga) => {
    /*
     * Da bolsa de loot ou da Store Inbox o item NAO vai direto: o bau le' a mochila,
     * e guardar de la' guardaria uma copia que nao esta' onde o servidor vai procurar.
     * O deposito diz o mesmo, com as mesmas palavras.
     */
    if (carga?.from === 'storeInbox') {
      return void ctx.notice?.('Leve da Store Inbox para a mochila primeiro.');
    }
    if (carga?.from === 'pouch') {
      return void ctx.notice?.('Leve da bolsa de loot para a mochila primeiro.');
    }
    /*
     * A peca arrastada pode nao ser a pilha inteira da mochila. `guardarNoBau` pede a
     * quantidade e depois confirma — o mesmo caminho do clique, para o arrasto e o
     * clique nao terem regras diferentes.
     *
     * E o ALVO vem junto: o arrasto ja' o escreve (ver `makeDraggable`), e e' ele que
     * garante que a peca guardada e' a que foi arrastada, e nao a primeira do mesmo id
     * — "vamo supor que eu tenho 2 itens iguais na mochila mas quero pôr um com um
     * afixo diferente".
     */
    guardarNoBau({ id: carga?.id, count: carga?.count ?? 1 }, null, carga?.alvo ?? null);
  });

  /* =======================================================================
   * ---- O CLIQUE E' NOSSO, E NAO O DA `itemCell` ----
   *
   * `itemCell` aceita um `onClick`, e ele tem uma regra propria: clique simples leva
   * a PILHA INTEIRA, e so' o shift pergunta quanto. E' a regra certa para a mochila,
   * em que mover demais se desfaz movendo de volta.
   *
   * Aqui nao serve. "quando eu for guardar item com quantidade tem que perguntar a
   * quantidade que quero guardar" — e num bau em que qualquer membro tira, guardar
   * 4.000 de ouro querendo guardar 500 nao se desfaz: alguem ja' pode ter levado.
   *
   * Por isso a celula nasce SEM `onClick` e o clique e' ligado aqui: assim todo
   * clique — com shift ou sem — passa pela regua do bau (`guardarNoBau`/`tirarDoBau`),
   * que pergunta a quantia e, do lado de guardar, confirma.
   * ======================================================================= */
  (bau.itens ?? []).forEach((peca, pos) => {
    const celula = itemCell(peca, 'guildaBau', { pilha: pos });
    celula.onclick = () => tirarDoBau(peca, pos);
    grade.append(celula);
  });
  /* As vagas que faltam para o teto — ver a nota acima. Nunca mais do que o teto. */
  const cabem = Math.max((bau.itens ?? []).length, bau.teto ?? 0);
  for (let vaga = (bau.itens ?? []).length; vaga < cabem; vaga++) {
    grade.append(el('div', 'cell vaga'));
  }
  caixa.append(grade);

  if (!(bau.itens ?? []).length) {
    caixa.append(
      el('p', 'guilda-nota', 'O baú está vazio. Arraste uma peça da janela da mochila — ou clique nela por lá.'),
    );
  }
  body.append(caixa);

  /* =======================================================================
   * ---- A MOCHILA SAIU DAQUI ----
   *
   * "o bau comunitario, em vez de ter a mochila la' embaixo, os itens tem que ser
   *  arrastados ou clicados direto da mochila pra ir pra la', igual dessa foto."
   *
   * A foto e' o Deposito: a janela mostra SO' a caixa, e o que entra vem arrastado da
   * janela da mochila, que fica ao lado. Esta aba tinha uma copia da mochila no pe' —
   * uma segunda lista dos mesmos itens, com outro comportamento de clique, dentro de
   * uma janela que ja' tinha uma grade.
   *
   * O que substitui e' o que ja' foi feito: a grade aceita soltura (`aceitarSoltura`)
   * e a celula da mochila e' arrastavel (`itemCell`). O caminho passa a ser o mesmo
   * de todas as outras caixas do jogo, e some a pergunta "por que esta mochila e'
   * diferente da minha mochila".
   *
   * A nota abaixo da grade e' o que resta dela: uma linha dizendo de onde os itens
   * vem — a mesma frase que o Deposito usa.
   * ======================================================================= */
  const comoGuardar = el('p', 'guilda-nota');
  if (bauSemPerguntar()) {
    comoGuardar.append(
      el('span', null, 'Arraste peças da sua mochila para guardar. O clique guarda direto · '),
    );
    const voltar = el('button', 'guilda-link', 'perguntar de novo');
    voltar.type = 'button';
    tipTexto(voltar, 'Volta a pedir confirmação antes de guardar qualquer coisa no baú.');
    voltar.onclick = () => {
      gravarAcordoDoBau(false);
      ctx.redraw?.();
    };
    comoGuardar.append(voltar);
  } else {
    comoGuardar.textContent =
      'Arraste peças da janela da sua mochila para guardar — ou clique nelas por lá.';
  }
  caixa.append(comoGuardar);

  /* =======================================================================
   * ---- QUEM POS E QUEM LEVOU ----
   *
   * Numa caixa em que qualquer membro tira sem pedir licenca, o historico e' o que
   * substitui a permissao: nao ha' cadeado, ha' testemunha. Sem ele, um bau que
   * amanhece vazio e' uma discussao sem nenhum fato.
   *
   * Num BOTAO e nao numa caixa embutida: a aba do bau ja' tem duas grades de
   * quadradinhos, e uma terceira lista embaixo delas empurraria a mochila para fora
   * da tela. Ver `abrirHistorico`.
   */
  const verMovimentos = el('button', 'guilda-mini', 'Movimentações');
  verMovimentos.type = 'button';
  tipTexto(verMovimentos, 'Quem guardou, quem pegou, o quê e quando.');
  verMovimentos.onclick = () => abrirHistorico('bau');
  ferramentas.append(verMovimentos);
}

/* =========================================================================
 * O ACORDO DE NAO PERGUNTAR MAIS, NO BAU
 *
 * "que aí depois, SEMPRE que eu tentar guardar qualquer item, não perguntar mais."
 *
 * ---- POR QUE GRAVADO, E NAO SO' NA SESSAO ----
 *
 * O jogo tem um "não perguntar de novo NESTA SESSÃO" (a entrega da loja), e aqui
 * seria menos do que foi pedido: quem marca a caixinha esta' dizendo que ja'
 * entendeu a regra do bau, e recarregar a pagina nao desfaz ter entendido.
 *
 * ---- E POR QUE ELE E' DESFAZIVEL ----
 *
 * Guardar no bau e' irreversivel do ponto de vista de quem guarda — qualquer membro
 * pode tirar, e quem tira nao devolve. Um acordo permanente e escondido seria uma
 * armadilha: por isso o cabecalho da mochila passa a dizer que o clique guarda
 * direto, e oferece o link que liga a pergunta de volta. Ver `renderBau`.
 *
 * O `try` existe porque `localStorage` estoura em aba anonima e com dados de site
 * bloqueados. Sem ele, a janela do bau inteira morreria por causa de uma preferencia.
 * ========================================================================= */
const CHAVE_DO_ACORDO = 'draevor:bau-sem-perguntar';
const bauSemPerguntar = () => {
  try {
    return localStorage.getItem(CHAVE_DO_ACORDO) === '1';
  } catch {
    return false;
  }
};
const gravarAcordoDoBau = (vale) => {
  try {
    if (vale) localStorage.setItem(CHAVE_DO_ACORDO, '1');
    else localStorage.removeItem(CHAVE_DO_ACORDO);
  } catch {
    /* Sem armazenamento a pergunta continua aparecendo, que é o lado seguro. */
  }
};

/** O nome de uma peça, do catálogo que o cliente já tem. */
const nomeDoItem = (peca) => ctx.state.items?.[peca?.id]?.name ?? `item ${peca?.id}`;

/* =========================================================================
 * GUARDAR NO BAU — quanto, e depois confirmar
 *
 * "quando eu for guardar item com quantidade tem que perguntar a quantidade que
 *  quero guardar, igual o funcionamento da mochila."
 *
 * Antes o clique mandava a PILHA INTEIRA. Quem tinha 4.000 de ouro na mochila e
 * queria dar 500 para a guilda dava 4.000 — e nao havia como desfazer, porque
 * qualquer membro ja' podia ter tirado.
 *
 * ---- A ORDEM DAS DUAS PERGUNTAS ----
 *
 * QUANTO primeiro, CONFIRMAR depois. A confirmacao fala do que vai acontecer com o
 * que esta' sendo guardado, e sem o numero ela nao teria como dizer quanto e'.
 *
 * `pedirQuantidade` devolve na hora quando so' ha' um (`teto <= 1`), entao uma peca
 * unica nao ganha uma caixa a mais para dizer "1".
 * ========================================================================= */
function guardarNoBau(peca, pilha = null, alvoPronto = null, quantiaPronta = null) {
  const total = Math.max(1, Math.floor(Number(peca?.count) || 1));

  /* =======================================================================
   * ---- A PECA CLICADA, E NAO "QUALQUER UMA IGUAL" ----
   *
   * "vamo supor que eu tenho 2 itens iguais na mochila mas quero pôr um com um afixo
   *  diferente no bau comunitario — ele pega qualquer um da lista que seja igual."
   *
   * Era isso mesmo: o pedido levava `id` e `count`, e o servidor pegava a PRIMEIRA
   * pilha daquele id. Com duas espadas iguais e afixos diferentes, guardar a de baixo
   * guardava a de cima — e, num bau em que qualquer membro tira, nao havia como
   * desfazer.
   *
   * O `alvo` e' o mesmo do deposito e do mercado (`alvoDaPeca`): a CASA da pilha, o
   * tier e os afixos. A casa sozinha nao bastaria — a mochila pode ter mudado entre
   * o desenho e o clique —, e o tier e os afixos sozinhos tambem nao: duas copias
   * identicas existem. Juntos, o servidor confere a casa e, se ela nao bater mais,
   * procura por tier e afixo. Ver `pecaApontada`, no servidor.
   * ======================================================================= */
  const alvo = alvoPronto ?? (pilha == null ? null : alvoDaPeca(peca, pilha));

  const mandar = (quanto) =>
    ctx.send({ t: 'guilda', action: 'bauGuardar', id: peca.id, count: quanto, alvo });

  const depoisDaQuantidade = (quanto) => {
    /* O acordo pula a confirmacao, e so' ela — a quantidade continua sendo perguntada. */
    if (bauSemPerguntar()) return void mandar(quanto);
    perguntar(
      {
        titulo: total > 1 ? `Guardar ${quanto}× ${nomeDoItem(peca)}?` : `Guardar ${nomeDoItem(peca)}?`,
        texto: 'Qualquer membro da guilda vai poder tirar do baú, e quem tirar não precisa devolver.',
        botao: 'Guardar',
        naoPerguntar: {
          rotulo: 'não perguntar novamente',
          aoMarcar: () => gravarAcordoDoBau(true),
        },
      },
      () => mandar(quanto),
    );
  };

  /*
   * ---- QUANDO A QUANTIA JA' FOI ESCOLHIDA ----
   *
   * O shift numa peca da mochila abre a regua LA', na celula da mochila, antes de
   * chegar aqui (ver `encherGradeDaMochila`). Perguntar de novo seria a mesma
   * pergunta duas vezes na mesma acao — e a segunda regua ainda pareceria um erro,
   * porque a primeira ja' tinha sido respondida.
   *
   * Sem quantia pronta (o clique seco, o arrasto, a celula do bau) a regua e' aqui,
   * que e' o que garante que guardar 500 de 4.000 nao seja um gesto de dois passos.
   */
  if (quantiaPronta != null) {
    return void depoisDaQuantidade(Math.max(1, Math.min(total, Math.floor(Number(quantiaPronta) || 1))));
  }

  pedirQuantidade({
    id: peca.id,
    max: total,
    titulo: `Guardar quantos no baú?`,
    aoConfirmar: depoisDaQuantidade,
  });
}

/* =========================================================================
 * ---- O CLIQUE NA MOCHILA, COM O BAU ABERTO ----
 *
 * "com a aba do bau da guilda aberto, alem do arrastar o item pro bau
 *  compartilhado, ao clicar em um item da mochila ja' tem que ir pro bau da guild."
 *
 * E' o gesto que o deposito ja' tem, e a mochila ja' o pergunta: ela olha o que esta'
 * ABERTO na tela antes de decidir o que o clique faz (`caixaDoDepositoAberta`). Estas
 * duas portas sao a mesma ideia com o bau da guilda no lugar da caixa.
 *
 * Elas viajam pelo `ctx` (ver `main.mjs`) e nao por `import`: `guildas.mjs` JA'
 * importa de `inventory.mjs` — a celula, o arrasto e o alvo da pilha —, e um import
 * de volta fecharia o ciclo.
 * ========================================================================= */

/**
 * O bau da guilda esta' na tela AGORA?
 *
 * Olha o `hidden` antes da grade pelo mesmo motivo que `caixaDoDepositoAberta`:
 * `closeModal` nao esvazia o `#modal-body`, so' esconde. Sem essa pergunta, depois de
 * abrir o bau uma vez e fechar, todo clique na mochila continuaria guardando na
 * guilda — para sempre.
 */
export const bauDaGuildaAberto = () => {
  const modal = document.getElementById('modal');
  if (!modal || modal.hidden) return false;
  return !!modal.querySelector('.guilda-bau-alvo');
};

/**
 * Guarda no bau uma peca da MOCHILA, pelo clique.
 *
 * `pilha` e' a casa dela, e e' o que faz a peca guardada ser a que foi clicada, e nao
 * a primeira do mesmo id. `quantia` vem preenchida so' quando o shift ja' perguntou.
 */
export const guardarNoBauDaGuilda = (peca, pilha = null, quantia = null) =>
  guardarNoBau(peca, pilha, null, quantia);

/*
 * TIRAR do bau, com a mesma regua.
 *
 * Tirar nao pergunta "tem certeza" — se foi engano, guarda de volta. Mas a
 * QUANTIDADE vale pelo mesmo motivo de guardar: uma pilha de 4.000 de ouro no bau
 * comunitario nao pode ser tudo-ou-nada, senao quem precisa de 500 leva 4.000 e o
 * resto da guilda encontra o bau vazio.
 */
function tirarDoBau(peca, pos) {
  pedirQuantidade({
    id: peca.id,
    max: Math.max(1, Math.floor(Number(peca?.count) || 1)),
    titulo: 'Pegar quantos do baú?',
    aoConfirmar: (quanto) => ctx.send({ t: 'guilda', action: 'bauTirar', id: peca.id, count: quanto, pos }),
  });
}

/*
 * ---- O QUADRADINHO PROPRIO DO BAU SAIU ----
 *
 * Ele desenhava o sprite, a contagem e o tier, e o balao dele era uma linha de
 * texto com o nome do item. "ao deixar o mouse em cima de um item no bau tem que
 * mostrar o tooltip com todas as informaçoes igual e' no inventario."
 *
 * Nao havia como acrescentar "todas as informaçoes" aqui sem reescrever o balao do
 * inventario numa segunda copia — com os afixos, o tier, os imbuements, a raridade
 * e as estrelas. O bau passou a usar a celula de la' (`itemCell`), que ja' faz tudo
 * isso e ainda e' arrastavel. Ver `renderBau`.
 */

/* =========================================================================
 * A CAIXA DE PEDIDOS — os dois lados na mesma página
 *
 * Ela junta quatro coisas que parecem diferentes e são a mesma: alguém
 * esperando resposta de alguém.
 *
 *   convites recebidos    uma guilda chamou você
 *   pedidos que eu fiz    você chamou uma guilda
 *   pedidos recebidos     alguém quer entrar na sua (vice e líder respondem)
 *   convidar por nome     o gesto de chamar
 *
 * Numa aba só porque é uma só pergunta: "o que está pendente?". Espalhadas pela
 * janela, cada uma seria vista por acaso.
 * ========================================================================= */
function renderPedidos(body, view) {
  const minha = view.minha ?? null;
  const mando = (minha?.meuCargo ?? 0) >= VICE;
  let temAlgo = false;

  /* ---- Convites que chegaram para mim ---- */
  if (view.convites?.length) {
    temAlgo = true;
    const caixa = el('section', 'guilda-painel');
    caixa.append(el('h4', 'guilda-titulo', view.convites.length > 1 ? 'Convites para você' : 'Convite para você'));
    for (const convite of view.convites) {
      const linha = el('div', 'guilda-carta');
      linha.append(brasaoDe(convite.nome, 34, convite.brasao));
      const texto = el('div', 'guilda-carta-texto');
      texto.append(el('b', null, convite.nome));
      texto.append(el('span', null, `chamou você — líder ${convite.dono} · ${quandoCurto(convite.em)}`));
      linha.append(texto);

      const entrar = el('button', 'guilda-botao primario', 'Entrar');
      entrar.onclick = () =>
        perguntar(
          {
            titulo: `Entrar na ${convite.nome}?`,
            texto: 'Você entra como Membro. Os outros convites e os pedidos que você tiver em aberto somem junto.',
            botao: 'Entrar',
          },
          () => ctx.send({ t: 'guilda', action: 'aceitar', guildaId: convite.guildaId }),
        );
      const recusar = el('button', 'guilda-botao', 'Recusar');
      recusar.onclick = () =>
        perguntar(
          {
            titulo: `Recusar o convite da ${convite.nome}?`,
            texto: 'O convite some. Eles podem convidar de novo depois.',
            botao: 'Recusar',
          },
          () => ctx.send({ t: 'guilda', action: 'recusar', guildaId: convite.guildaId }),
        );
      linha.append(entrar, recusar);
      caixa.append(linha);
    }
    body.append(caixa);
  }

  /* ---- Pedidos que chegaram PARA a minha guilda ---- */
  if (mando) {
    temAlgo = true;
    const caixa = el('section', 'guilda-painel');
    const cabeca = el('div', 'guilda-painel-cabeca');
    cabeca.append(el('h4', 'guilda-titulo', 'Querem entrar na sua guilda'));
    cabeca.append(el('span', 'guilda-nota', `${(minha.candidatos ?? []).length} pedido(s)`));
    caixa.append(cabeca);

    if (!(minha.candidatos ?? []).length) {
      caixa.append(el('p', 'empty', 'Ninguém pediu para entrar ainda.'));
    }
    for (const quem of minha.candidatos ?? []) {
      const linha = el('div', 'guilda-carta');
      linha.append(bonecoDe(quem, 36));
      const texto = el('div', 'guilda-carta-texto');
      const cima = el('div', 'guilda-membro-cima');
      cima.append(el('b', null, quem.nome));
      if (quem.online) {
        const ponto = el('span', 'guilda-ponto aceso');
        tipTexto(ponto, 'online agora');
        cima.append(ponto);
      }
      texto.append(cima);
      const voc = vocacaoCurta(quem.vocation);
      texto.append(
        el(
          'span',
          null,
          `${quem.level ? `level ${quem.level}` : 'level ?'}${voc ? ` · ${voc}` : ''} · pediu ${quandoCurto(quem.em)}`,
        ),
      );
      /* O recado de quem se alistou, quando ele escreveu um. */
      if (quem.texto) texto.append(el('em', 'guilda-carta-recado', `“${quem.texto}”`));
      linha.append(texto);

      const aceitar = el('button', 'guilda-botao primario', 'Aceitar');
      aceitar.onclick = () =>
        perguntar(
          {
            titulo: `Aceitar ${quem.nome} na guilda?`,
            texto: `Ele entra como Membro na hora${quem.level ? `, com level ${quem.level}` : ''}. Os outros pedidos dele somem junto.`,
            botao: 'Aceitar',
          },
          () => ctx.send({ t: 'guilda', action: 'aceitarPedido', quem: quem.nome }),
        );
      const recusar = el('button', 'guilda-botao', 'Recusar');
      recusar.onclick = () =>
        perguntar(
          {
            titulo: `Recusar o pedido de ${quem.nome}?`,
            texto: 'O pedido some da caixa. Ele não recebe aviso nenhum, e pode pedir de novo.',
            botao: 'Recusar',
          },
          () => ctx.send({ t: 'guilda', action: 'recusarPedido', quem: quem.nome }),
        );
      linha.append(aceitar, recusar);
      caixa.append(linha);
    }

    /* ---- E o convite por nome, que é o gesto contrário ---- */
    const convite = el('div', 'guilda-linha-campo');
    const campo = document.createElement('input');
    campo.type = 'text';
    campo.className = 'guilda-campo';
    campo.placeholder = 'convidar alguém pelo nome';
    const botao = el('button', 'guilda-botao', 'Convidar');
    const convidar = () => {
      const alvo = campo.value.trim();
      if (!alvo) return;
      perguntar(
        {
          titulo: `Convidar ${alvo}?`,
          texto: 'Ele recebe o convite na tela e decide. O convite vale sete dias.',
          botao: 'Convidar',
        },
        () => {
          ctx.send({ t: 'guilda', action: 'convidar', quem: alvo });
          campo.value = '';
        },
      );
    };
    botao.onclick = convidar;
    campo.onkeydown = (e) => {
      if (e.key === 'Enter') convidar();
    };
    convite.append(campo, botao);
    caixa.append(convite);

    if (minha.convidados?.length) {
      caixa.append(el('p', 'guilda-nota', `Esperando resposta: ${minha.convidados.map((c) => c.nome).join(', ')}`));
    }
    body.append(caixa);
  }

  /* ---- Pedidos que EU fiz ---- */
  if (view.pedidos?.length) {
    temAlgo = true;
    const caixa = el('section', 'guilda-painel');
    const cabeca = el('div', 'guilda-painel-cabeca');
    cabeca.append(el('h4', 'guilda-titulo', 'Seus pedidos'));
    cabeca.append(el('span', 'guilda-nota', `${view.pedidos.length} de ${view.regras?.pedidosPorPessoa ?? 5} em aberto`));
    caixa.append(cabeca);
    for (const pedido of view.pedidos) {
      const linha = el('div', 'guilda-carta');
      linha.append(brasaoDe(pedido.nome, 34, pedido.brasao));
      const texto = el('div', 'guilda-carta-texto');
      texto.append(el('b', null, pedido.nome));
      texto.append(el('span', null, `líder ${pedido.dono} · pedido ${quandoCurto(pedido.em)}`));
      linha.append(texto);
      const cancelar = el('button', 'guilda-botao', 'Cancelar');
      cancelar.onclick = () =>
        perguntar(
          {
            titulo: `Cancelar o pedido para a ${pedido.nome}?`,
            texto: 'Ele some da caixa deles e você libera uma das cinco vagas de pedido.',
            botao: 'Cancelar o pedido',
          },
          () => ctx.send({ t: 'guilda', action: 'cancelarPedido', guildaId: pedido.guildaId }),
        );
      linha.append(cancelar);
      caixa.append(linha);
    }
    body.append(caixa);
  }

  if (!temAlgo) {
    const caixa = el('section', 'guilda-painel');
    caixa.append(el('h4', 'guilda-titulo', 'Nada pendente'));
    caixa.append(
      el(
        'p',
        'empty',
        minha
          ? 'Nenhum convite e nenhum pedido esperando você.'
          : 'Você não tem convite nenhum. Peça para entrar em uma guilda na aba Servidor.',
      ),
    );
    body.append(caixa);
  }

}

/* =========================================================================
 * O HISTÓRICO — um botão, três abas
 *
 * "se os historico ocupar muito espaço desnecessario, faz (...) um botao que abre
 *  todos esses historicos divididos por abas (talvez seja melhor assim)."
 *
 * ---- POR QUE ELES SAIRAM DE DENTRO DAS PAGINAS ----
 *
 * Eram tres caixas embutidas: uma no pé do Baú, uma no pé dos Pedidos e uma dentro
 * da tela de contribuir. Cada uma custava altura numa página que já tinha o seu
 * assunto, e a de contribuir era a pior — ela dividia a janela com as contas, o
 * campo, os atalhos, a prévia e dois botões.
 *
 * Num botão só, o histórico custa ZERO altura enquanto ninguém o abre. E juntas, as
 * três listas viram o que elas sempre foram: uma pergunta só ("o que aconteceu
 * nesta guilda"), cortada em três.
 *
 * ---- O QUE CADA LINHA MOSTRA ----
 *
 * "tem que ter o nome da pessoa, o outfit da pessoa, a contribuiçao com o icone do
 *  dinheiro la' que usamos no banco, e se for item tem que mostrar no tooltip o item
 *  que saiu, igual no inventario que mostra afixos tier imbuiments tudo certinho."
 *
 * O BONECO vem dos membros da guilda, que já viajam com a roupa (ver `comBoneco`, no
 * servidor). Quem saiu ou foi expulso não está mais na lista — aí a linha fica sem
 * boneco, e não com um boneco genérico que seria de outra pessoa.
 *
 * A MOEDA é `itemCanvas(3031)`, o mesmo desenho do ouro no banco, na loja e nas
 * gemas. O ITEM é a `itemCell` da mochila, que traz o balão inteiro — afixos, tier,
 * imbuements — pelo mesmo motivo do baú: escrever um segundo balão seria escrever
 * duas verdades sobre a mesma peça.
 * ========================================================================= */

/** O nome do cargo, para as linhas de promocao. O numero e' o dado; isto e' rotulo. */
const POSTO_DO_CARGO = { 3: 'Líder', 2: 'Vice-líder', 1: 'Membro' };

/**
 * A frase de um evento, sem o nome de quem fez — ele vai ao lado do boneco.
 *
 * Montada AQUI e nao no servidor: o servidor guarda o fato (quem, sobre quem,
 * quanto) e a tela escreve a frase. Guardada pronta, ela envelheceria — um item que
 * mudasse de nome no catalogo ficaria com o nome velho no historico para sempre.
 */
function fraseDoEvento(evento) {
  const alvo = evento?.alvo ?? '';
  const quanto = Math.max(0, Math.floor(Number(evento?.quanto) || 0));
  switch (evento?.tipo) {
    case 'contribuiu': return 'contribuiu com';
    case 'entrou': return 'entrou na guilda';
    case 'aceitou': return `aceitou ${alvo}`;
    case 'saiu': return 'saiu da guilda';
    case 'expulsou': return `expulsou ${alvo}`;
    case 'promoveu': return `promoveu ${alvo} a ${POSTO_DO_CARGO[quanto] ?? 'Vice-líder'}`;
    case 'rebaixou': return `rebaixou ${alvo} a ${POSTO_DO_CARGO[quanto] ?? 'Membro'}`;
    case 'guardou': return `guardou ${quanto}×`;
    case 'tirou': return `pegou ${quanto}×`;
    default: return String(evento?.tipo ?? '');
  }
}

/** A linha de um evento: boneco, nome, o que fez, e o ouro ou a peça. */
function linhaDoEvento(evento, porNome) {
  /* =======================================================================
   * ---- ENTROU E SAIU NAO PODEM TER A MESMA COR ----
   *
   * "em movimentaçoes do bau tem que ter uma diferença de cor pra facilitar a
   *  visualizaçao e saber rapidamente o que foi guardado e o que foi pego."
   *
   * Numa lista em que todas as linhas comecam com o nome de alguem, "guardou" e
   * "pegou" sao duas palavras parecidas no meio de uma frase — e a pergunta que se
   * faz ao abrir esta aba e' justamente "o que ANDOU SAINDO daqui". A cor responde
   * antes da leitura.
   *
   * Verde da casa para o que ENTROU e o vermelho do aviso para o que SAIU: as mesmas
   * duas cores que o resto do jogo usa para ganhar e perder.
   *
   * E nao e' SO' cor: a seta (▼ entrou, ▲ saiu) diz o mesmo sem depender de
   * enxergar a diferenca entre verde e vermelho.
   * ======================================================================= */
  const doBau = evento?.tipo === 'guardou' || evento?.tipo === 'tirou';
  const linha = el(
    'div',
    `guilda-hist-linha${doBau ? (evento.tipo === 'guardou' ? ' hist-entrou' : ' hist-saiu') : ''}`,
  );

  /*
   * O boneco vem do membro, que ja' viaja com a roupa. Quem saiu nao esta' mais na
   * lista: a linha fica sem boneco, e nao com um generico que seria de outra pessoa.
   */
  const membro = porNome.get(String(evento?.quem ?? '').toLowerCase()) ?? null;
  const retrato = el('div', 'guilda-hist-retrato');
  const look = membro?.outfit?.type;
  if (look && outfitInfo(look)) {
    try {
      retrato.append(outfitCanvas(look, membro.outfit, 28, 2, true));
    } catch {
      /* Sem a folha de sprites o retrato fica vazio — a linha continua legivel. */
    }
  }
  linha.append(retrato);

  const texto = el('div', 'guilda-hist-texto');
  const dito = el('div', 'guilda-hist-frase');
  /* A seta antes do nome: ela e' a leitura de relance, e vem na frente da frase. */
  if (doBau) dito.append(el('i', 'guilda-hist-seta', evento.tipo === 'guardou' ? '▼' : '▲'));
  dito.append(el('b', null, evento?.quem ?? 'alguém'));
  /* O verbo pintado — "guardou" verde, "pegou" vermelho. Ver a nota acima. */
  dito.append(el('span', doBau ? 'guilda-hist-verbo' : null, fraseDoEvento(evento)));

  if (evento?.tipo === 'contribuiu') {
    /* O ouro com a MOEDA do banco — o mesmo `itemCanvas(3031)` do resto do jogo. */
    const ouro = el('span', 'guilda-hist-ouro');
    try {
      ouro.append(itemCanvas(3031, 14));
    } catch {
      /* sem sprite: o número sozinho ainda diz tudo */
    }
    const quanto = Math.max(0, Math.floor(Number(evento?.quanto) || 0));
    ouro.append(el('b', null, quanto.toLocaleString('pt-BR')));
    dito.append(ouro);
  }
  texto.append(dito);
  linha.append(texto);

  /*
   * A PECA, com o balao inteiro do inventario. `itemCell` sem `onClick` nao vira
   * botao: aqui ela e' um retrato do que saiu, e nao um gesto — clicar no historico
   * para pegar seria pegar do bau por um caminho que nao confere espaco nem vaga.
   */
  if (evento?.tipo === 'guardou' || evento?.tipo === 'tirou') {
    const id = Number(evento?.alvo);
    if (Number.isFinite(id) && id > 0) {
      /*
       * ---- A PECA COM O TIER E OS AFIXOS DELA ----
       *
       * "no historico tem que mostrar os afixo e tier do item que foi pego."
       *
       * O `extra` e' o que o servidor gravou da peca no instante do movimento: tier,
       * afixos e imbuements. Sem ele, a celula desenharia o item do CATALOGO — e um
       * soul bleeder tier 6 com tres afixos dourados apareceria igual a uma copia
       * limpa, que e' justamente a diferenca que faz alguem abrir o historico.
       *
       * O JSON vem do banco e pode estar velho ou truncado; um `catch` aqui vale a
       * celula sem os extras, e nao a caixa inteira sem a linha.
       */
      let extras = null;
      try {
        extras = evento?.extra ? JSON.parse(evento.extra) : null;
      } catch {
        extras = null;
      }
      try {
        linha.append(
          itemCell(
            { id, count: Math.max(1, Math.floor(Number(evento?.quanto) || 1)), ...(extras ?? {}) },
            'guildaHistorico',
          ),
        );
      } catch {
        /* Item fora do catalogo desta versao: a frase ja' diz o quanto. */
      }
    }
  }

  const quando = el('i', 'guilda-hist-quando', quandoCurto(evento?.em));
  if (evento?.em) tipTexto(quando, new Date(evento.em).toLocaleString('pt-BR'));
  linha.append(quando);
  return linha;
}

/** A lista de uma aba, ou a frase de quando nao ha' nada. */
function listaDoHistorico(linhas, vazio, porNome) {
  const lista = Array.isArray(linhas) ? linhas : [];
  if (!lista.length) return el('p', 'guilda-diario-vazio', vazio);
  const rolo = el('div', 'guilda-hist-rolo');
  for (const evento of lista) rolo.append(linhaDoEvento(evento, porNome));
  return rolo;
}

/**
 * O placar de quem mais contribuiu — a soma por pessoa, e nao a ordem do tempo.
 *
 * Sao duas perguntas diferentes: a lista do tempo diz "o que andou acontecendo" e o
 * placar diz "quem carrega esta guilda". Uma doacao de 1kkk de ontem some da
 * primeira assim que quinze pessoas derem dez moedas hoje — e continua no topo desta.
 */
function caixaDoPlacar(linhas, porNome) {
  const lista = (Array.isArray(linhas) ? linhas : []).filter((l) => (Number(l?.total) || 0) > 0);
  if (!lista.length) return null;

  const caixa = el('div', 'guilda-placar');
  caixa.append(el('h5', 'guilda-diario-titulo', 'Quem mais contribuiu'));
  for (const [i, quem] of lista.entries()) {
    const linha = el('div', 'guilda-hist-linha guilda-placar-linha');
    /* A posicao com a cor da medalha nas tres primeiras — as mesmas do podio. */
    linha.append(el('b', `guilda-placar-pos lugar-${i + 1}`, `${i + 1}º`));

    const membro = porNome.get(String(quem?.quem ?? '').toLowerCase()) ?? null;
    const retrato = el('div', 'guilda-hist-retrato');
    const look = membro?.outfit?.type;
    if (look && outfitInfo(look)) {
      try {
        retrato.append(outfitCanvas(look, membro.outfit, 28, 2, true));
      } catch { /* sem sprites */ }
    }
    linha.append(retrato);

    linha.append(el('div', 'guilda-hist-texto', quem.quem ?? '—'));

    const total = Math.max(0, Math.floor(Number(quem.total) || 0));
    const ouro = el('span', 'guilda-hist-ouro');
    try {
      ouro.append(itemCanvas(3031, 14));
    } catch { /* sem sprite */ }
    ouro.append(el('b', null, OURO_CURTO(total)));
    tipTexto(
      ouro,
      `${total.toLocaleString('pt-BR')} de ouro em ${quem.vezes ?? 1} ${(quem.vezes ?? 1) === 1 ? 'contribuição' : 'contribuições'}`,
    );
    linha.append(ouro);
    caixa.append(linha);
  }
  /*
   * A ressalva importa: o placar soma o que o DIARIO ainda guarda, e nao a historia
   * inteira da guilda. Sem ela, quem doou muito no mes passado e viu o proprio nome
   * sumir acharia que a conta esta' errada.
   */
  caixa.append(el('p', 'guilda-diario-vazio', 'entre as contribuições mais recentes'));
  return caixa;
}

/* As tres abas, escritas uma vez — o botao e a caixa leem daqui. */
const ABAS_DO_HISTORICO = [
  {
    chave: 'contribuicoes',
    nome: 'Contribuições',
    vazio: 'Ninguém contribuiu ainda.',
  },
  {
    chave: 'membros',
    nome: 'Membros',
    vazio: 'Nada mudou ainda: ninguém entrou, saiu, foi promovido nem expulso.',
  },
  {
    chave: 'bau',
    nome: 'Baú',
    vazio: 'Nada entrou nem saiu do baú ainda.',
    /*
     * A legenda explica a cor UMA vez, em cima da lista — e so' nesta aba, que e' a
     * unica em que ha' duas coisas opostas para distinguir. Sem ela, o verde e o
     * vermelho sao enfeite ate' a pessoa deduzir sozinha o que cada um quer dizer.
     */
    legenda: [
      ['hist-entrou', '▼', 'guardado'],
      ['hist-saiu', '▲', 'pego'],
    ],
  },
];

/** Abre o historico da guilda, na aba pedida. */
function abrirHistorico(inicial = 'contribuicoes') {
  const minha = ctx.state.guildas?.minha ?? null;
  const diario = minha?.diario ?? {};
  /*
   * Os membros por nome em minusculas: e' daqui que sai o boneco de cada linha, e o
   * nome gravado no diario e' o nome de verdade — mas comparar sem caixa e' o que o
   * resto do jogo faz.
   */
  const porNome = new Map(
    (minha?.membros ?? []).map((m) => [String(m.nome ?? '').toLowerCase(), m]),
  );

  const fundo = el('div', 'confirm-back');
  const cartao = el('div', 'confirm-box guilda-historico');
  cartao.append(el('h3', null, `O que aconteceu na ${minha?.nome ?? 'guilda'}`));

  const barra = el('div', 'guilda-hist-abas');
  const corpo = el('div', 'guilda-hist-corpo');
  let atual = ABAS_DO_HISTORICO.some((a) => a.chave === inicial) ? inicial : 'contribuicoes';

  const pintar = () => {
    for (const botao of barra.children) botao.classList.toggle('ligado', botao.dataset.aba === atual);
    corpo.innerHTML = '';
    const aba = ABAS_DO_HISTORICO.find((a) => a.chave === atual);
    /*
     * O PLACAR so' na aba das contribuicoes, e em cima: e' a leitura rapida ("quem
     * carrega isto"), e a lista do tempo embaixo e' a leitura demorada.
     */
    if (atual === 'contribuicoes') {
      const placar = caixaDoPlacar(diario.placar ?? [], porNome);
      if (placar) corpo.append(placar);
    }
    /* A legenda das cores, quando a aba tem duas coisas opostas para separar. */
    if (aba?.legenda && (diario[atual] ?? []).length) {
      const faixa = el('div', 'guilda-hist-legenda');
      for (const [classe, seta, nome] of aba.legenda) {
        const marca = el('span', `guilda-hist-chave ${classe}`);
        marca.append(el('i', 'guilda-hist-seta', seta), el('span', null, nome));
        faixa.append(marca);
      }
      corpo.append(faixa);
    }
    corpo.append(listaDoHistorico(diario[atual] ?? [], aba?.vazio ?? 'Nada ainda.', porNome));
  };

  for (const aba of ABAS_DO_HISTORICO) {
    const botao = el('button', 'guilda-mini', aba.nome);
    botao.type = 'button';
    botao.dataset.aba = aba.chave;
    /* A contagem na aba: ela diz onde ha' o que ler antes de a pessoa clicar. */
    const quantos = (diario[aba.chave] ?? []).length;
    if (quantos) botao.append(el('i', 'guilda-conta-bolha', String(quantos)));
    botao.onclick = () => {
      atual = aba.chave;
      pintar();
    };
    barra.append(botao);
  }
  cartao.append(barra, corpo);

  const acoes = el('div', 'confirm-actions');
  const fechar = el('button', 'guilda-botao', 'Fechar');
  fechar.onclick = () => fundo.remove();
  acoes.append(fechar);
  cartao.append(acoes);

  pintar();
  fundo.append(cartao);
  fecharAoClicarFora(fundo, () => fundo.remove());
  atalhosDaCaixa(fundo, { confirmar: () => fundo.remove(), fechar: () => fundo.remove() });
  document.body.append(fundo);
  fechar.focus();
}

/* =========================================================================
 * A TABELA DO SERVIDOR
 *
 * Ordenada por PONTOS, e depois por nível, membros e idade — o critério inteiro
 * mora em `packages/shared/src/ordem-das-guildas.mjs`, e é o mesmo que o servidor
 * aplica antes de mandar e que o site aplica antes de desenhar. É a ordem da
 * guerra de guildas, e não a alfabética.
 *
 * As três primeiras ganham pódio, como o ranking da arena: uma tabela de vinte
 * linhas iguais não tem topo, e o topo é a razão de ela existir.
 * ========================================================================= */

/* =========================================================================
 * O BOTAO DE ENTRADA — um so', para o podio e para as linhas
 *
 * O pódio pediu o mesmo botão que as linhas já tinham, com os mesmos três
 * estados (convidado, já pedi, posso pedir). Copiá-lo seria copiar também a
 * regra de qual estado mostra o quê — e o dia em que um dos dois lugares
 * mudasse, o outro passaria a oferecer um gesto que o servidor recusa.
 *
 * `null` quando não há gesto nenhum a oferecer (quem já tem guilda) — quem chama
 * escreve `const b = botaoDeEntrada(...); if (b) linha.append(b)`, e a linha fica
 * exatamente como era antes de o botão existir.
 * ========================================================================= */
function botaoDeEntrada(g, { semGuilda, jaPedi, jaConvidado }) {
  if (!semGuilda) return null;

  if (jaConvidado.has(g.id)) {
    const entrar = el('button', 'guilda-mini primario', 'Entrar');
    tipTexto(entrar, 'Esta guilda convidou você.');
    entrar.onclick = () =>
      perguntar(
        {
          titulo: `Entrar na ${g.nome}?`,
          texto: 'Você entra como Membro. Os outros convites e os pedidos que você tiver em aberto somem junto.',
          botao: 'Entrar',
        },
        () => ctx.send({ t: 'guilda', action: 'aceitar', guildaId: g.id }),
      );
    return entrar;
  }

  if (jaPedi.has(g.id)) {
    const pedido = el('button', 'guilda-mini', 'Pedido enviado');
    pedido.disabled = true;
    tipTexto(pedido, 'Você já pediu para entrar. Cancele na aba Pedidos.');
    return pedido;
  }

  /*
   * ---- "PEDIR ENTRADA", E NAO "PEDIR PARA ENTRAR" ----
   *
   * "nas linhas, mais respiro entre 0 PT e o botão; se precisar, botão menor."
   *
   * O rótulo longo empurrava o botão para o lado dos pontos até os dois se
   * encostarem, e a coisa mais parecida com um número clicável é um botão colado
   * nele. Duas palavras dizem o mesmo e devolvem o respiro — o balão continua
   * explicando o que acontece.
   */
  const pedir = el('button', 'guilda-mini primario', 'Pedir entrada');
  tipTexto(pedir, `Manda um pedido para a ${g.nome}. O líder aceita ou não.`);
  pedir.onclick = () =>
    perguntar(
      {
        titulo: `Pedir para entrar na ${g.nome}?`,
        texto: `O líder ${g.dono} vê o seu pedido e decide. Você pode ter até cinco pedidos em aberto ao mesmo tempo.`,
        botao: 'Pedir',
      },
      () => ctx.send({ t: 'guilda', action: 'candidatar', guildaId: g.id }),
    );
  return pedir;
}

function renderTabela(body, view) {
  /*
   * A lista chega ordenada do servidor e é reordenada aqui pelo MESMO critério.
   * Não é desconfiança: é que a ordem é uma afirmação — o pódio escreve "1º" — e
   * uma tela que afirma tem de poder responder pela afirmação sozinha.
   */
  const lista = ordenarGuildas(view.lista ?? []);
  const minhaId = view.minha?.id ?? null;
  const semGuilda = !view.minha;
  /* Para não oferecer duas vezes o que já foi pedido. */
  const jaPedi = new Set((view.pedidos ?? []).map((p) => p.guildaId));
  const jaConvidado = new Set((view.convites ?? []).map((c) => c.guildaId));
  const estado = { semGuilda, jaPedi, jaConvidado };

  if (!lista.length) {
    const caixa = el('section', 'guilda-painel');
    caixa.append(el('h4', 'guilda-titulo', 'Guildas do servidor'));
    caixa.append(el('p', 'empty', 'Nenhuma guilda ainda. A primeira abre a tabela.'));
    body.append(caixa);
    if (semGuilda) renderChamadaParaFundar(body, view);
    return;
  }

  /* =======================================================================
   * ---- O PODIO, E A LISTA COMECANDO NO 4º ----
   *
   * "voltar a mostrar o top 3, mas sem duplicar: as 3 primeiras ficam SÓ no
   *  pódio e a lista começa no 4º lugar."
   *
   * Ele já existiu e foi escondido enquanto ninguém tinha ponto; agora volta em
   * outra forma, e a regra de esconder saiu: um pódio de três guildas de zero
   * ponto mostra quem está na frente pelos outros critérios — que é o que a
   * tabela diz mesmo assim, e agora está dito no "?".
   *
   * A duplicação é o que mudou de verdade. Antes as três primeiras apareciam no
   * pódio E nas três primeiras linhas, e quem contava a lista contava seis
   * guildas onde havia três. Agora `slice(3)` tira o que o pódio já mostrou, e a
   * numeração das linhas começa onde ele parou.
   *
   * Menos de três guildas: o pódio mostra as que existem (o CSS trata o caso de
   * uma e de duas colunas), e a lista fica vazia — e uma lista vazia não é
   * desenhada.
   * ======================================================================= */
  const tres = lista.slice(0, 3);
  const podio = el('section', 'guilda-podio');
  for (const [i, g] of tres.entries()) {
    const lugar = el('div', `guilda-podio-lugar lugar-${i + 1}${g.id === minhaId ? ' eu' : ''}`);

    /* =====================================================================
     * ---- CADA COISA NA SUA LINHA ----
     *
     * "está quebrado: o texto está grudado (Golden eagles company0 PT1 membro),
     *  sem espaço entre nome, pontos e membros, e os cards ficaram apertados."
     *
     * Ele estava deitado — medalha, escudo e uma coluna de texto lado a lado —, e
     * o defeito era real: numa coluna de 290px, o escudo de 58 mais a medalha
     * deixavam 200px para nome, pontos, membros e líder. Com um nome de 21 letras
     * ("Golden eagles company") a reticência comia a linha inteira e o que sobrava
     * encostava no número seguinte.
     *
     * Em pé, cada coisa tem a LARGURA INTEIRA do card e uma linha só para ela:
     * posição, escudo, nome, "0 PT · 2 membros", "líder Fulano", botão. Nada
     * disputa espaço horizontal com nada, e por isso nada encosta em nada.
     * ===================================================================== */
    lugar.append(el('span', 'guilda-podio-pos', `${i + 1}º`));

    /*
     * "brasão ~56px (desenho completo)."
     *
     * O podio e' o lugar em que o brasao E' o assunto — e' o unico ponto do jogo em
     * que ele aparece grande para quem nao e' da guilda. 56 no 2º e no 3º, 62 no
     * primeiro: seis pixels de escudo mais o enchimento maior do CSS levantam o card
     * do meio sem nenhuma altura escrita a mao.
     *
     * Bem acima do corte do modo icone (20), entao aqui sai o desenho cheio —
     * simbolo, iniciais e o efeito que a guilda pagou.
     */
    lugar.append(brasaoDe(g.nome, i === 0 ? 62 : 56, g.brasao));

    /* O nome na fonte da guilda, com o corte que a familia larga exige. */
    lugar.append(vestirNomeDaGuilda(el('b', 'guilda-podio-nome', g.nome), g.brasao));

    /*
     * Pontos e membros na mesma linha, com o ponto do meio separando — sao os dois
     * numeros da guilda, e cada um numa linha faria um card de sete linhas.
     */
    lugar.append(
      el(
        'span',
        'guilda-podio-pontos',
        `${g.pontos ?? 0} PT · ${g.membros} membro${g.membros === 1 ? '' : 's'}`,
      ),
    );
    /*
     * O líder numa linha própria e em letra menor: e' a terceira pergunta do card, e
     * o nome dele nao tem tamanho maximo pequeno — grudado nos numeros, ele seria o
     * que estourava a linha.
     */
    lugar.append(el('span', 'guilda-podio-sub', `líder ${g.dono}`));

    /*
     * ---- O PE DO CARD TEM ALTURA FIXA ----
     *
     * "botão Pedir entrada (ou Sua guilda, sem botão, se for a do jogador)."
     *
     * Quem já tem outra guilda não vê gesto nenhum — e é justamente por isso que o
     * pé existe mesmo vazio: sem ele, o card do meio (a guilda da pessoa, com um
     * rótulo em vez de botão) ficaria mais baixo que os vizinhos, e três cards de
     * alturas diferentes não parecem um pódio.
     */
    const pe = el('div', 'guilda-podio-pe');
    if (g.id === minhaId) {
      pe.append(el('span', 'guilda-podio-minha', 'Sua guilda'));
    } else {
      const botao = botaoDeEntrada(g, estado);
      if (botao) pe.append(botao);
    }
    lugar.append(pe);

    podio.append(lugar);
  }
  body.append(podio);

  /* ---- A tabela, do 4º para baixo ---- */
  const resto = lista.slice(tres.length);
  if (resto.length) {
    const caixa = el('section', 'guilda-painel');
    const cabeca = el('div', 'guilda-painel-cabeca');
    cabeca.append(el('h4', 'guilda-titulo', 'Guildas do servidor'));
    cabeca.append(el('span', 'guilda-nota', `${lista.length} no total`));
    caixa.append(cabeca);

    /* =====================================================================
     * ---- O ROLO E' DA LISTA, E NAO DA ABA ----
     *
     * "cabe sem scroll com até ~8 guildas visíveis em 1920x1080; mais que isso
     *  rola só a lista."
     *
     * A aba inteira rolava, e com trinta guildas isso levava embora o pódio, o
     * cabeçalho e a barra de fundar — as três coisas que não são lista. Agora as
     * LINHAS moram numa caixa com teto de altura própria (no CSS), e é ela que
     * rola: o que está em volta fica onde está.
     * ===================================================================== */
    const rolo = el('div', 'guilda-lista-rolo');

    for (const [i, g] of resto.entries()) {
      const linha = el('div', `guilda-linha${g.id === minhaId ? ' eu' : ''}`);
      /* A numeração continua de onde o pódio parou — ver o `slice` acima. */
      linha.append(el('span', 'guilda-pos', `${i + tres.length + 1}º`));
      /* A linha que veio do menu do jogador nasce acesa — ver `abrirGuildasNaTabela`. */
      if (ctx.guildaApontada && chaveDoNome(ctx.guildaApontada) === chaveDoNome(g.nome)) {
        linha.classList.add('apontada');
      }
      /*
       * 40 e nao 28: a linha ja tinha 10px de folga vertical por causa do nome e do
       * subtitulo, entao o escudo cresce DENTRO da altura que a linha ja tinha — a
       * tabela nao fica mais comprida, e o brasao passa a ser reconhecivel de relance.
       */
      linha.append(brasaoDe(g.nome, 40, g.brasao));

      const texto = el('div', 'guilda-linha-texto');
      /* O nome na fonte da guilda, com o corte que a familia larga exige. */
      texto.append(vestirNomeDaGuilda(el('b', null, g.nome), g.brasao));
      texto.append(el('span', null, `líder ${g.dono} · ${desdeQuando(g.criadaEm)}`));
      linha.append(texto);

      linha.append(el('span', 'guilda-conta', `${g.membros} membro${g.membros === 1 ? '' : 's'}`));
      linha.append(el('span', 'guilda-pontos', `${g.pontos ?? 0} pt`));

      /*
       * ---- O BOTÃO DE SE ALISTAR ----
       *
       * "a pessoa que nao esta em guild tem que poder se alistar a uma guilda."
       *
       * Ele só existe para quem não tem guilda, e muda de cara assim que o pedido
       * é feito — ver `botaoDeEntrada`, que é o mesmo botão do pódio.
       */
      const botao = botaoDeEntrada(g, estado);
      if (botao) linha.append(botao);

      rolo.append(linha);
    }
    caixa.append(rolo);
    body.append(caixa);
  }

  /* Quem não tem guilda vê a fundação no pé da tabela: são as duas saídas. */
  if (semGuilda) renderChamadaParaFundar(body, view);
}
