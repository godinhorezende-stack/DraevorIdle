// Render do mapa em tela cheia.
// Regra de ouro para o pixel art não borrar: tudo é desenhado em 1:1 (32px por
// tile) num canvas do tamanho da tela dividido pelo zoom, e o zoom é sempre
// inteiro, aplicado pelo CSS com image-rendering: pixelated.
import { casasDoEvento } from '/packages/shared/src/areas.mjs';
import { comecarPasso, teleportar } from './interpolacao.mjs';
import { desenharMarcadores, assinaturaDosEncontros } from './encontros-na-tela.mjs';
import { drawItem, drawCreature, outfitInfo, image, isAnimated, drawEffect, drawMissile, effectDuration, itemCanvas } from './sprites.mjs';
import { criarCamada, desenharEfeito, desenharProjetil, desenharContinuo, visuaisAtuais, desenharQuadroDeAsset, duracaoDoAsset } from './efeitos-visuais.mjs';
import { quadroDoCiclo, quadroDaChegada, casaDoPortal, ordemDaSaida, ORDEM_DA_CHEGADA, direcaoDoPasso, entradaNova } from './portal-ciclo.mjs';
/** A cortina "Traçando a rota" (`mostrarViagem`, main.mjs) está cobrindo a tela? */
const cortinaDeViagemNaTela = () => typeof document !== 'undefined' && document.getElementById('viagem')?.hidden === false;
/** Os eventos que a camada de efeitos desenha (os outros — números, falas — seguem aqui no mapa). */
const EVENTOS_DA_CAMADA = new Set(['skill', 'cast', 'fx', 'explosao', 'area', 'shot', 'dmg', 'portal']);
// As chaves de gráficos, escolhidas nos Ajustes da tela. Ver `graficos.mjs`.
import { graficoLigado, tetoDeQuadros } from './graficos.mjs';
import { NameplateDoJogador, escalaDoNameplate } from './nameplate-do-jogador.mjs';
import { ehTelefone } from './perfil.mjs';
// O contador de FPS do canto conta o quadro daqui. Ver `medidor.mjs`.
import { contarQuadro, marcarPassadaDoMonitor, intervaloDoMonitor } from './medidor.mjs';
import { camadasAcima, andaresAbaixo } from '/packages/shared/src/andar-visivel.mjs';
import { VIEW_TILES_X, VIEW_TILES_Y } from '/packages/shared/src/tela.mjs';

/*
 * A altura de um degrau na pilha de textos.
 *
 * Comecou em 15 e o dono achou largo: "o negocio anti-flood das mensagens que
 * ta subindo ta ruim, ta muito espacado, tem que ser tipo igual da base de
 * tibia". No client dele as linhas ficam praticamente coladas — sao doze
 * pixels para uma letra de doze —, e a pilha se le' como um bloco em vez de
 * seis textos soltos.
 *
 * Doze e' o minimo que ainda separa as linhas: com onze as maiusculas de uma
 * encostam nas descidas da outra.
 */
const ALTURA_DA_LINHA = 12;

/*
 * A folga de cada lado do numero dentro da placa de nivel do familiar.
 *
 * Quatro e' o minimo que ainda deixa a borda parecer moldura e nao contorno da
 * letra; com dois o algarismo encosta na linha e a placa some.
 */
const PLACA_FOLGA = 4;


/*
 * A que altura do tile a fala mais nova nasce, em pixels de tela.
 *
 * Contado para BAIXO do topo do tile: 26 poe a linha sobre o peito do boneco, o
 * mesmo lugar em que a fala saia antes de ela virar bloco.
 *
 * Do topo do tile, e nao da ancora do corpo, porque a do corpo passa pelo
 * `toScreen` e portanto ANDA com o zoom: medida dali, a fala ficava no lugar em
 * zoom 2 e subia sozinha em zoom 1.
 */
const ONDE_A_FALA_NASCE = 26;

/*
 * Quantas linhas o bloco de fala guarda.
 *
 * "o flood das mensagens sobe ate 6 mensagens e a setima ela elimina uma pra
 *  por outra? limite pra 3".
 *
 * Era seis. Seis linhas de magia empilhadas em cima do boneco tapam o proprio
 * boneco e os bichos em volta dele — e as tres de cima ja' sao historico velho
 * numa barra que dispara varios slots por segundo. Tres e' o que se le' de
 * relance sem o olho ter de procurar onde a coluna comeca.
 */
const LINHAS_DA_FALA = 3;

/*
 * Quanto tempo CADA linha de fala fica na tela.
 *
 * Por linha, e nao por bloco, e essa e' a correcao inteira: a linha nova
 * renovava o relogio do bloco, e com isso as anteriores voltavam do meio do
 * apagamento para a opacidade cheia.
 *
 * "vamos supor que eu usei 5 magias duma vez e matei o bixo e elas sairam da
 *  tela, quando eu vou pro proximo bixo e uso uma magia so' aparece as 5
 *  magias (...) quando elas sair ja' tem q sair de vez".
 *
 * Era exatamente isso: elas nao tinham saido, estavam quase transparentes — e
 * a magia seguinte as trazia de volta inteiras. Agora cada uma conta o tempo
 * dela desde que foi dita, some sozinha, e nada a traz de volta.
 */
const VIDA_DA_FALA = 2200;

/*
 * Por quanto tempo um numero de dano ainda 'ocupa lugar' na pilha.
 *
 * O degrau existe so' para dois numeros do MESMO instante nao sairem um em
 * cima do outro; passado esse tempo o texto ja' subiu mais que uma linha
 * sozinho (um tile por segundo contra 12px de degrau) e o lugar dele esta
 * livre de novo. Sem essa janela, o degrau somaria com a subida e a coluna ia
 * se abrindo sozinha — que foi exatamente o 'olha o tamanho da separacao'.
 */
const JANELA_DO_DEGRAU = 400;

/** Quantos efeitos e números a tela guarda ao mesmo tempo (ver `addEvents`). */
const TETO_DE_EFEITOS = 600;
const TETO_DE_NUMEROS = 300;
const TILE = 32;
/** Colunas por tira de linha: blocos fixos na grade do mapa (ver `copiarTiras`). */
const BLOCO_DA_TIRA = 8;
/** Quantas tiras ficam guardadas (blocos de 8 casas: ~15 linhas x ~5 blocos na tela, mais o que se andou). */
const LIMITE_DE_TIRAS = 700;

/*
 * Quanto o numero de dano sobe na vida dele, em pixels de MUNDO.
 *
 * Meio tile por segundo, que e' o ritmo lento com que ele sempre subiu aqui.
 *
 * Ele pediu mais rapido, viu o tile inteiro da base e voltou atras duas vezes:
 * "deixa demorado mesmo como ja era". Faz sentido — na base o numero e' um por
 * golpe, e aqui a barra dispara varios slots por segundo: subindo rapido, a
 * coluna vira um piscar que nao da' tempo de ler.
 *
 * De MUNDO, e nao de tela, isso sim ficou de la: com a medida em pixels de tela
 * a velocidade mudava com o zoom — em zoom 1 o numero subia o dobro do caminho
 * que em zoom 2, no mesmo segundo. Dezessete e' o que ele via no zoom 2 dele.
 */
const SUBIDA_DO_NUMERO = 17;
// Um tick do servidor: a folga que a pose de andar aguenta entre dois passos.
const WALK_GRACE = 125;

/**
 * Cores de vida do client do usuário, em degraus e não em gradiente — é o que
 * dá a leitura instantânea do Tibia.
 *
 * Copiadas de `modules/game_interface/gameinterface.lua` do Draevor OTClient:
 *
 *     if healthPercent > 94 then "#00C000FF"
 *     elseif healthPercent > 59 then "#60c060FF"
 *     elseif healthPercent > 29 then "#c0c000FF"
 *     elseif healthPercent > 9  then "#c03030FF"
 *     elseif healthPercent > 3  then "#c00000FF"
 *     else "#600000FF"
 *
 * Antes daqui saíam os valores genéricos do otclient upstream (92/60/30/8/3, com
 * outros tons). Os degraus não batiam com o que ele vê jogando.
 */
export function healthColor(percent) {
  if (percent > 94) return '#00c000';
  if (percent > 59) return '#60c060';
  if (percent > 29) return '#c0c000';
  if (percent > 9) return '#c03030';
  if (percent > 3) return '#c00000';
  return '#600000';
}

const NAME_GREEN = '#00eb00';
const HEALTH_BAR_WIDTH = 27;
const NAME_SIZE = 12;

// O tamanho da tela mudou de casa: quem recorta o mapa (o exportador) precisa
// saber dele tanto quanto quem desenha, e enquanto o número morou só aqui o
// recorte saía menor que a tela. Ver `packages/shared/src/tela.mjs`.

/*
 * ---- As duas folgas da imagem guardada do telhado ----
 *
 * A folga em volta da tela decide quantas casas dá para andar antes de refazer
 * a imagem. Folga grande parece só vantagem, e NÃO é: a imagem também vence
 * quando um sprite dela troca de quadro, e aí a folga vira área a mais paga a
 * cada vencimento.
 *
 * Foi medido, e foi o que me pegou: com quatro casas de folga em toda parte, os
 * lugares COM tocha no telhado ficaram PIORES que antes da otimização — 1.045
 * viraram 1.170 comandos por quadro, porque a imagem vencia a cada 30~50ms e
 * cada refação pagava uma área 2,3x maior que a tela.
 *
 * Então a folga se adapta ao que está na tela:
 *
 *   nada anima no telhado  ->  folga LARGA, e andar aproveita a imagem
 *   algo anima             ->  folga CURTA, e refazer custa o mesmo que o
 *                              código antigo custava todo quadro
 *
 * A curta é de uma casa porque a imagem começa alinhada na casa: a tela pode
 * estar até 31px à direita do começo dela, e sem essa casa a borda direita
 * ficaria de fora.
 */
const FOLGA_LARGA_DO_TETO = 4;
const FOLGA_CURTA_DO_TETO = 1;

/** `MAX_ELEVATION` do client: uma pilha de caixas levanta até aqui e para. */
const TETO_DA_ELEVACAO = 24;

/** Qual célula do atlas da hunt desenhar agora (tocha acesa, água, lava). */
function paletteCell(entry, time) {
  const cells = entry.cells;
  if (!cells?.length) return [entry.ax, entry.ay];
  if (cells.length === 1) return cells[0];

  const durations = entry.d ?? [];
  const total = durations.length ? durations.reduce((sum, value) => sum + value, 0) : cells.length * 200;
  let cursor = time % total;
  for (let frame = 0; frame < cells.length; frame++) {
    cursor -= durations[frame] ?? 200;
    if (cursor < 0) return cells[frame];
  }
  return cells[0];
}

/*
 * Quantos milissegundos faltam para ESTE sprite trocar de quadro.
 *
 * Irmão do `paletteCell`: aquele diz qual quadro mostrar agora, este diz até
 * quando ele vale. É o que permite ao desenho saber quando vai precisar
 * acontecer de novo — ver `podePularQuadro`.
 *
 * Sprite parado devolve `Infinity`: ele nunca é motivo para redesenhar.
 */
function restoDoQuadro(entry, time) {
  const cells = entry.cells;
  if (!cells || cells.length < 2) return Infinity;
  const durations = entry.d ?? [];
  const total = durations.length ? durations.reduce((soma, v) => soma + v, 0) : cells.length * 200;
  let cursor = time % total;
  for (let frame = 0; frame < cells.length; frame++) {
    const dura = durations[frame] ?? 200;
    if (cursor < dura) return dura - cursor;
    cursor -= dura;
  }
  return Infinity;
}

/*
 * ---- O resumo do que se VÊ num retrato ----
 *
 * Tudo o que o desenho do mapa pinta e que pode mudar entre um retrato e outro:
 * quem está na tela, em que casa, virado para onde, com quanta vida, e o que
 * está largado no chão. Fora disto o desenho é o mesmo — e um desenho igual não
 * precisa acontecer duas vezes (ver `podePularQuadro`).
 *
 * ---- Por que uma string, e não um hash ----
 *
 * Porque ela é comparada uma vez a cada retrato, oito por segundo, sobre umas
 * poucas dezenas de criaturas. Montar a string custa menos que o primeiro
 * `drawImage` que ela evita, e uma string é ÓBVIA: um hash que colidisse
 * deixaria a tela congelada, e ninguém acharia o motivo.
 *
 * O `hp` entra porque a barra de vida é desenhada; a direção, porque o boneco
 * vira sem sair do lugar; o `count` do chão, porque o número da pilha aparece.
 */
function assinaturaDoRetrato(payload) {
  const partes = [payload.z ?? 0, payload.mapId ?? ''];
  const quem = (lista) => {
    for (const e of lista ?? []) {
      // (+ a mana: o nameplate do aliado da party desenha a barra dela.)
      partes.push(e.uid ?? e.name ?? '', e.x, e.y, e.dir ?? 0, Math.round(e.hp ?? 0), Math.round(e.maxHp ?? 0), Math.round(e.mana ?? 0));
    }
  };
  quem(payload.monsters);
  quem(payload.players);
  quem(payload.npcs);
  quem(payload.aliados);
  if (payload.player) {
    const p = payload.player;
    partes.push('eu', p.x, p.y, p.dir ?? 0, Math.round(p.hp ?? 0));
  }
  for (const o of payload.objetos ?? []) partes.push('o', o.x, o.y, o.item ?? 0);
  for (const c of payload.chao ?? []) partes.push('c', c.x, c.y, c.item, c.count, c.sob, (c.pilha ?? []).length);
  /* As paredes de runa entram na assinatura: sem elas, plantar uma nao redesenharia. */
  for (const b of payload.barreiras ?? []) partes.push('b', b.x, b.y, b.item);
  // Baús e altares da caçada: aparecer, mudar de estado ou sumir redesenha.
  partes.push(assinaturaDosEncontros(payload.instancia?.encontros));
  return partes.join('|');
}

const OUTLINE = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/*
 * ---- O nome é desenhado UMA vez e depois só copiado ----
 *
 * Medido num telefone (412x915, dpr 3, CPU 4x mais lenta) dentro de uma caçada:
 * `drawNameplate` era o MAIOR custo de javascript do jogo, 8,4% de tudo.
 *
 * A conta explica sozinha: cada nome sai em nove passadas — as oito do contorno
 * preto (`OUTLINE`) mais a letra colorida. Com catorze bichos na tela são 126
 * `fillText` por quadro, e rasterizar texto é das coisas mais caras que um
 * navegador faz. A cinquenta quadros por segundo, seis mil por segundo.
 *
 * E o desenho é sempre o mesmo: o nome de um bicho não muda, e a cor sai de uma
 * lista de SETE (as seis de `healthColor` mais o verde dos que não têm vida).
 * Então ele é pintado uma vez numa telinha própria e daí em diante é um
 * `drawImage` — que é o caminho que a placa de vídeo faz de graça.
 *
 * ---- A chave leva o `ratio` ----
 *
 * A telinha é pintada em pixels FÍSICOS (o overlay desenha com
 * `setTransform(ratio, ...)`), senão o nome sairia embaçado numa tela de
 * celular. Quando o `devicePixelRatio` muda — o navegador foi para outro
 * monitor, ou a pessoa deu zoom — as telinhas velhas ficam na resolução antiga,
 * e por isso ele entra na chave em vez de ser ignorado.
 *
 * ---- E o teto de 150 ----
 *
 * Cada telinha ocupa memória de verdade (uns 50 KB numa tela de celular), e um
 * mapa com muita gente passando poderia encher isto sem fim. Na prática são
 * poucas: uma caçada tem dois ou três nomes de bicho, vezes as sete cores. O
 * teto é a rede de proteção, e quem sai é a mais antiga — que é a que está há
 * mais tempo sem aparecer na tela.
 */
/*
 * ---- Uma casa com quatro peças mostra as QUATRO ----
 *
 * "quando eu jogar um item por cima do outro no chão ele tem que mostrar a
 * sprite — se eu jogar uma armor no chão e depois um axe, lá na minha base ele
 * mostraria no chão a armor e por cima o axe."
 *
 * O servidor mandava só a peça de cima, e a tela desenhava uma figura por casa:
 * a casa com quatro peças era idêntica à casa com uma, e a única pista era o
 * "(e mais 3 embaixo)" do balão. Agora a pilha inteira viaja (ver `paraTela`,
 * em `chao.mjs`) e o desenho a empilha na ordem em que foi largada — a primeira
 * embaixo, a última por cima, que é o que ele descreveu.
 *
 * ---- O degrau de dois pixels ----
 *
 * É o `drawElevation` do OTClient, e ele existe para que a de baixo APAREÇA.
 * Desenhadas no mesmo ponto, as quatro ficariam exatamente uma atrás da outra e
 * a tela voltaria a mostrar só o topo — que é o defeito que isto conserta. Cada
 * peça sobe e recua dois pixels em relação à anterior.
 *
 * E o degrau tem TETO. Sem ele, uma casa com dez peças empurraria a de cima
 * vinte pixels para fora da própria casa, e o item pareceria estar na casa
 * vizinha. Quatro degraus (oito pixels) é onde a pilha ainda se lê como pilha
 * sem sair do quadrado.
 */
const DEGRAU_DA_PILHA = 2;
const DEGRAUS_NO_MAXIMO = 4;

function desenharPilhaDaCasa(ctx, objeto, px, py, now) {
  const pilha = objeto.pilha;
  // Sem pilha (um boneco de treino, um retrato velho de servidor antigo) é uma
  // figura só, no lugar de sempre.
  if (!Array.isArray(pilha) || pilha.length < 2) {
    return drawItem(ctx, objeto.item, px, py, { time: now });
  }
  for (let i = 0; i < pilha.length; i++) {
    const degrau = Math.min(i, DEGRAUS_NO_MAXIMO) * DEGRAU_DA_PILHA;
    drawItem(ctx, pilha[i].item, px - degrau, py - degrau, { time: now });
  }
}

const placasDeNome = new Map();
/*
 * 400 e não 150: agora os números de dano e as falas das magias também moram
 * aqui (ver `placaDeTexto`). Uma caçada movimentada tem algumas dezenas de
 * valores de dano diferentes por cor; o teto só protege a memória.
 */
const TETO_DAS_PLACAS = 400;

/*
 * ---- A telinha fica FORA da página ----
 *
 * "as animações ... só [fica liso] quando eu desmarco" — medido no jogo, numa
 * caçada: o recálculo de estilo da página inteira custava ~190 ms por segundo,
 * e boa parte dele era FORÇADA de dentro deste arquivo. Trocar `ctx.font` num
 * canvas que está na página obriga o navegador a resolver a fonte com o
 * estilo em dia — e, se o jogo acabou de mexer na interface, ele recalcula o
 * estilo da página inteira ali mesmo, no meio do quadro. `drawTexts` trocava de
 * fonte a cada número de dano e a cada fala: várias vezes por quadro.
 *
 * Uma `OffscreenCanvas` não pertence à página, e trocar a fonte dela não mexe
 * em estilo nenhum. A régua e a telinha moram numa; o canvas do mapa só recebe
 * o `drawImage` pronto.
 */
const telaFora = (largura, altura) =>
  typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(largura, altura)
    : Object.assign(document.createElement('canvas'), { width: largura, height: altura });
let reguaDeTexto = null;

/*
 * ---- As cores do nome por RARIDADE do mob (pedido do dono, 01/10) ----
 * Vêm do servidor no welcome (`gamedata/mobs/raridades.json`): a tela não sabe
 * nome de mob nem de modificador — só pinta com a cor da categoria.
 */
let coresDeRaridade = {};
export function definirCoresDeRaridade(cores) {
  coresDeRaridade = cores ?? {};
}
export const corDaRaridade = (r) => coresDeRaridade[r ?? 'normal']?.cor ?? null;
/** `{ nome, cor, resumo }` da raridade (o balão do mob). */
export const dadosDaRaridade = (r) => coresDeRaridade[r ?? 'normal'] ?? null;

function placaDoNome(texto, cor, ratio) {
  return placaDeTexto(texto, cor, NAME_SIZE, ratio);
}

/**
 * Um texto com o contorno preto de um pixel, pintado UMA vez numa telinha e
 * guardado. Serve o nome das criaturas, o número de dano e a fala da magia:
 * nove `fillText` viram um `drawImage`, e nenhuma troca de fonte na página.
 */
function placaDeTexto(texto, cor, tamanho, ratio) {
  const chave = `${texto}\u0000${cor}\u0000${tamanho}\u0000${ratio}`;
  const guardada = placasDeNome.get(chave);
  if (guardada) return guardada;

  const fonte = `bold ${tamanho}px Verdana, "Segoe UI", sans-serif`;
  reguaDeTexto ??= telaFora(1, 1).getContext('2d');
  reguaDeTexto.font = fonte;
  // Mais dois de cada lado: o contorno de um pixel fica FORA da caixa que o
  // `measureText` devolve, e sem a folga ele sairia cortado.
  const largura = Math.ceil(reguaDeTexto.measureText(texto).width) + 4;
  const altura = tamanho + 6;

  const lona = telaFora(Math.max(1, Math.ceil(largura * ratio)), Math.max(1, Math.ceil(altura * ratio)));
  const pincel = lona.getContext('2d');
  pincel.scale(ratio, ratio);
  pincel.font = fonte;
  pincel.textAlign = 'center';
  pincel.textBaseline = 'alphabetic';
  // A linha de base fica a `tamanho` do topo: é o que deixa o desenho aqui
  // dentro no mesmo lugar em que o `fillText` direto o punha.
  const base = tamanho + 2;
  pincel.fillStyle = '#000';
  for (const [dx, dy] of OUTLINE) pincel.fillText(texto, largura / 2 + dx, base + dy);
  pincel.fillStyle = cor;
  pincel.fillText(texto, largura / 2, base);

  const placa = { lona, largura, altura, base };
  if (placasDeNome.size >= TETO_DAS_PLACAS) placasDeNome.delete(placasDeNome.keys().next().value);
  placasDeNome.set(chave, placa);
  return placa;
}

/*
 * As cores do nome de um móvel do mapa. Ver `drawNomeDoObjeto`.
 *
 * São três tons por cor, e não um: o `halo` é o brilho difuso por trás, o
 * `brilho` é a pincelada que o halo espalha, e o `texto` é a letra em cima do
 * contorno preto. Uma cor só, aplicada nas três camadas, some no chão claro e
 * queima no escuro — este mapa tem os dois.
 */
const CORES_DE_OBJETO = {
  azul: { halo: '#3aa8ff', brilho: '#57c8ff', texto: '#7fd4ff' },
  laranja: { halo: '#ff7a1a', brilho: '#ffa347', texto: '#ffc061' },
  /*
   * O pátio do templo: Aventuras, Forja e Imbuementos (ver `MARCOS`, no servidor).
   *
   * Degradê pulsante como o da árvore, cada um no tom do que abre: ouro de
   * tesouro, brasa de forja (vermelho para laranja) e o violeta mágico do
   * imbuement. É o mesmo `pintaPulsante` — um gradiente por nome por quadro, o
   * que custa quase nada; o caro é o halo, que continua na chave dos brilhos.
   */
  dourado: { pulso: [[255, 214, 74], [255, 150, 30]], halo: '#e8b923' },
  vermelho: { pulso: [[255, 70, 40], [255, 176, 60]], halo: '#ff4a1f' },
  roxo: { pulso: [[190, 110, 255], [110, 190, 255]], halo: '#9b5cff' },
  // Boss Diários: sangue que pulsa para o dourado de troféu.
  boss: { pulso: [[235, 40, 60], [255, 200, 70]], halo: '#d4202f' },
  /*
   * ---- A árvore de habilidade: degradê pulsante ----
   *
   * "coloque o nome Arvore De Habilidade em degradê pulsante de verde e azul."
   *
   * `pulso` é o par de tons entre os quais a letra viaja, e a presença dele é o
   * que troca a pintura chapada por um degradê que anda. Ver `pintaPulsante`:
   * as paradas do degradê deslizam ao longo do texto, então o verde entra por
   * uma ponta e sai pela outra em vez de a palavra inteira piscar junto — que é
   * a diferença entre "pulsante" e "aviso de erro".
   */
  'verde-azul': { pulso: [[86, 232, 148], [82, 168, 255]], halo: '#3fd6b0' },
};

/** O ciclo do degradê, em milissegundos. Uma ida e volta completas. */
const CICLO_DO_PULSO = 2600;

/**
 * Mistura os dois tons de um `pulso`. `k` é a posição no ciclo, em voltas.
 *
 * O vaivém é por cosseno, e não por uma rampa que volta ao começo de repente: a
 * rampa daria um salto visível de azul para verde a cada volta, e o cosseno faz
 * a cor parar suavemente nas duas pontas — que é como uma coisa que respira se
 * comporta.
 */
function misturarPulso([a, b], k) {
  const p = (1 - Math.cos(k * Math.PI * 2)) / 2;
  const canal = (i) => Math.round(a[i] + (b[i] - a[i]) * p);
  return `rgb(${canal(0)}, ${canal(1)}, ${canal(2)})`;
}

/**
 * O degradê que anda ao longo do texto.
 *
 * Cinco paradas bastam: com três, a emenda entre a primeira e a última aparece
 * como uma faixa dura no meio da palavra; acima de cinco, ninguém distingue.
 */
function pintaPulsante(ctx, cor, meio, largura, agora) {
  const ciclo = (agora % CICLO_DO_PULSO) / CICLO_DO_PULSO;
  const gradiente = ctx.createLinearGradient(meio - largura / 2, 0, meio + largura / 2, 0);
  for (let i = 0; i <= 4; i++) {
    const parada = i / 4;
    gradiente.addColorStop(parada, misturarPulso(cor.pulso, parada + ciclo));
  }
  return gradiente;
}

/**
 * Quadro da animação parada, respeitando a duração que o appearance declara
 * (`animation.durations`, em milissegundos por quadro).
 */
/*
 * ---- A caminhada com Speed alta ----
 *
 * A animação era um ciclo inteiro POR PASSO: `floor(cycle * frames) % frames`,
 * com `cycle` reiniciando do zero a cada tile. Em velocidade normal isso passa
 * despercebido; com o passo em 125ms — o piso do servidor, alcançado por
 * qualquer personagem de level alto com haste e montaria — cada quadro durava
 * 40ms e a perna voltava ao primeiro quadro a cada tile. O que se vê é o boneco
 * tremendo, não andando.
 *
 * Aqui a fase da animação é CONTÍNUA: ela não sabe quando um tile acabou e o
 * outro começou, só continua girando enquanto ele anda — é assim que o otclient
 * faz, e é por isso que lá a corrida rápida continua parecendo uma corrida.
 *
 * `QUADRO_MINIMO` é o divórcio entre as duas velocidades que o pedido pede: o
 * deslocamento continua no ritmo do servidor (a posição é interpolada pelo
 * `duration` de verdade, e nada disto toca nela), mas a perna nunca troca de
 * quadro mais rápido do que se consegue ver.
 */
const QUADRO_MINIMO = 90;

function quadroDeCaminhada(entity, frames, now) {
  const duracaoDoQuadro = Math.max(QUADRO_MINIMO, (entity.duration ?? 500) / frames);

  if (entity.faseEm == null) {
    entity.fase = 0;
    entity.faseEm = now;
  }
  // Um salto de aba em segundo plano não pode adiantar dez ciclos de uma vez.
  const decorrido = Math.min(500, Math.max(0, now - entity.faseEm));
  entity.fase = (entity.fase ?? 0) + decorrido / duracaoDoQuadro;
  entity.faseEm = now;

  return Math.floor(entity.fase) % frames;
}

function idleFrame(group, time) {
  const frames = group.frames ?? 1;
  const durations = group.animation?.durations;
  if (!durations?.length) return Math.floor(time / 200) % frames;

  const step = (index) => {
    const entry = durations[index % durations.length];
    const value = Array.isArray(entry) ? entry[0] : entry;
    return value > 0 ? value : 200;
  };

  let total = 0;
  for (let i = 0; i < frames; i++) total += step(i);

  let cursor = time % total;
  for (let i = 0; i < frames; i++) {
    cursor -= step(i);
    if (cursor < 0) return i;
  }
  return 0;
}

/*
 * ---- As três faixas do Summon Level ----
 *
 * Do dono, ao pé da letra: "até o level 33 aparece em verde, até o 66 amarelo,
 * até o 100 vermelho".
 *
 * Os números moram aqui e não no servidor porque é COR, e cor é assunto de
 * quem desenha. O servidor manda o nível; o que ele significa de relance é
 * decisão da tela.
 */
const FAIXAS_DO_SUMMON = [
  [33, '#4ade80'],
  [66, '#facc15'],
  [Infinity, '#f87171'],
];
const corDoNivelDoSummon = (nivel) => (FAIXAS_DO_SUMMON.find(([teto]) => nivel <= teto) ?? FAIXAS_DO_SUMMON[2])[1];

/**
 * O que o `block` do servidor quer dizer: só o BLOQUEIO de verdade (chance da ficha, do escudo e da arma)
 * escreve "bloqueou". Esquiva (gema), Dodge (charm) e Ruse (tier) são "esquivou"; a armadura que engole
 * o golpe inteiro é "absorveu" — antes tudo saía "bloqueou" e parecia que o bloqueio era bem maior que a ficha.
 */
function textoDoBloqueio(event) {
  if (event.absorvido) return 'absorveu';
  if (event.esquiva || event.ruse || event.charm) return 'esquivou';
  return 'bloqueou';
}

export class MapView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.entities = new Map();
    this.texts = [];
    // A fala nao entra na mesma lista: ela e' um bloco de linhas parado acima
    // da cabeca, e o numero de dano e' um texto solto que voa. Ver `addEvents`.
    this.falas = [];
    // Efeitos mágicos tocando agora e projéteis no ar.
    this.effects = [];
    this.missiles = [];
    this.snapshot = null;
    /*
     * ---- O que o desenho lembra do quadro anterior ----
     *
     * Ver `podePularQuadro`: um quadro que sairia igual ao que ja esta na tela
     * nao e desenhado. Estes quatro campos sao a memoria disso.
     *
     * `precisaDesenhar` nasce ligado: o primeiro quadro nunca pode ser pulado,
     * porque a tela ainda esta vazia.
     */
    this.precisaDesenhar = true;
    /* O resumo do ultimo retrato que mexeu na tela. Ver `assinaturaDoRetrato`. */
    this.assinaturaDesenhada = null;
    this.desenhadoEm = -Infinity;
    this.cameraDesenhada = null;
    /* Quando a animacao de mapa mais proxima troca de quadro. */
    this.trocaDeAnimacaoEm = Infinity;
    /* O menor resto visto NESTE desenho; vira `trocaDeAnimacaoEm` no fim dele. */
    this.trocaDeAnimacao = Infinity;
    this.groundCache = null;
    this.groundKey = '';
    /*
     * ---- As linhas do mapa já desenhadas, guardadas como imagem ----
     *
     * Ver `tiraDaLinha`. Chave: `andar|linha|primeira coluna`.
     */
    this.tiras = new Map();
    /* As linhas que têm criatura ou objeto e por isso são desenhadas casa a
     * casa. Montada por `render` antes de chamar `drawMapa`. */
    this.linhasVivas = null;
    /*
     * O telhado já desenhado, UMA imagem por andar, com folga em volta.
     * Chave: `mapa|andar de onde estou|andar do telhado:deslocamento`.
     * Ver `drawTeto`.
     */
    this.tetosGuardados = new Map();
    this.animated = [];
    this.camera = { x: 0, y: 0 };
    this.floor = 0;
    this.onTileClick = null;
    this.onTileHover = null;
    /* Quem está na arena de Boss Diários agora — o portal da cidade escreve
       embaixo do nome dele. Ver `drawNomeDoObjeto` e `vigiarBossesDaArena`. */
    this.bossesNaArena = [];
    this.onTileRight = null;
    /*
     * Arrastar uma peça da mochila para uma casa do mapa.
     *
     * "tem que da pra jogar itens no chao" — e o gesto do client é este: pega a
     * peça na mochila e solta no chão. O menu do botão direito na peça também
     * larga (na casa em que o boneco está), mas quem quer largar UMA casa ao
     * lado — para o amigo pegar, para marcar caminho — precisa apontar, e
     * apontar é arrastar.
     */
    this.onTileDrop = null;

    this.setupOverlay();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    /*
     * Os dois botões fazem coisas DIFERENTES, como no client.
     *
     * Os dois chamavam o mesmo `onTileClick`, e na Caça Online isso queria
     * dizer que qualquer clique no mapa mirava — não havia como andar com o
     * mouse, só com o teclado. Agora é a divisão do Tibia: esquerdo anda até
     * onde se clicou, direito ataca o que estiver ali.
     *
     * O menu do navegador continua cancelado: ele não pode abrir por cima do
     * mapa.
     */
    canvas.addEventListener('click', (event) => this.handleClick(event, 'esquerdo'));
    canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.handleClick(event, 'direito');
    });

    /*
     * ---- O mapa aceita o que a mochila solta ----
     *
     * `dragover` com `preventDefault` é o que diz ao navegador "aqui pode
     * soltar": sem ele o cursor mostra o sinal de proibido e o `drop` nunca
     * chega. É a metade do gesto que costuma faltar.
     *
     * A carga é o mesmo JSON que a mochila põe no arrasto (`makeDraggable`) —
     * id, de onde veio, quantas e se o shift estava apertado.
     */
    /*
     * ---- E o mapa também é ORIGEM de arrasto ----
     *
     * "eu tenho que conseguir pegar itens no chao tambem, e eles tem que poder
     * arrastar no chao igual da crystal server".
     *
     * O canvas só vira arrastável quando o ponteiro está em cima de uma casa
     * que TEM peça. Deixá-lo arrastável o tempo todo tomaria o clique de andar:
     * qualquer arrastar-para-olhar viraria um arrasto de item, e o mapa é a
     * área onde mais se clica.
     */
    /*
     * ---- E no TOQUE isso também precisa acontecer ----
     *
     * "arrastar o item da mochila pro chão tá aparecendo a spritezinha, mas
     * deveria aparecer a spritezinha no reverso também."
     *
     * O caminho de volta — do chão para a mochila — simplesmente não existia no
     * telefone, e o fantasma era só o sintoma. O canvas do mapa só vira
     * arrastável quando o ponteiro está sobre uma casa que TEM peça, e essa
     * marcação era feita no `mousemove`: um evento que um dedo NUNCA dispara.
     * No celular o mapa nunca era arrastável, então não havia arrasto, e sem
     * arrasto não há `dragstart` — que é onde o sprite do fantasma é escolhido.
     *
     * `pointerdown` chega dos dois (mouse e dedo) e acontece ANTES de o
     * navegador decidir abrir o arrasto no toque longo do Android, que é a
     * janela exata em que o `draggable` precisa já estar de pé.
     */
    const marcarPecaSob = (event) => {
      const casa = this.casaDoEvento(event);
      const peca = casa && (this.chao ?? []).find((p) => p.x === casa.x && p.y === casa.y);
      this.pecaSobOCursor = peca ?? null;
      canvas.draggable = !!peca;
      return peca;
    };
    canvas.addEventListener('pointerdown', marcarPecaSob);
    canvas.addEventListener('mousemove', (event) => {
      const peca = marcarPecaSob(event);
      /*
       * ---- E o ponteiro vira MÃO ABERTA em cima da peça ----
       *
       * "quando arrastar o mouse o ponteiro tem que ser de arraste."
       *
       * O canvas do mapa ocupa a tela inteira e é arrastável só quando o
       * ponteiro está sobre uma casa que tem peça (é a linha acima). Sem dizer
       * isso ao ponteiro, o único jeito de descobrir que dali sai um arrasto
       * era tentar — e o mapa é justamente a área onde mais se clica para
       * outras coisas.
       *
       * O estilo é escrito direto no nó, e não numa classe: o canvas é um
       * elemento só e isto muda a cada movimento do mouse; uma classe custaria
       * o mesmo e exigiria uma regra de CSS para dizer a mesma palavra.
       */
      canvas.style.cursor = peca ? 'grab' : '';
      // A casa sob o ponteiro, para quem quiser um balão dela (o do mob raro — ver main.mjs).
      this.onTileHover?.(this.casaDoEvento(event), event);
    });
    canvas.addEventListener('mouseleave', () => {
      this.onTileHover?.(null, null);
      this.pecaSobOCursor = null;
      canvas.draggable = false;
      canvas.style.cursor = '';
    });
    canvas.addEventListener('dragstart', (event) => {
      const peca = this.pecaSobOCursor;
      if (!peca) return void event.preventDefault();
      event.dataTransfer.setData(
        'text/plain',
        // O mesmo formato do arrasto da mochila (`makeDraggable`), com `from`
        // dizendo que a peça vem do chão e de qual casa.
        JSON.stringify({ id: peca.item, from: 'chao', count: peca.count ?? 1, x: peca.x, y: peca.y, pedir: !!event.shiftKey })
      );
      event.dataTransfer.effectAllowed = 'move';

      /*
       * ---- O que o cursor carrega é a PEÇA, e não o mapa ----
       *
       * O dono viu isto: "quando to arrastando item do chao ta bugando a camera
       * sabe? como se eu tivesse mechendo a camera e nao aparece o item".
       *
       * Não era a câmera. O elemento arrastável é o CANVAS DO MAPA, que ocupa a
       * tela inteira, e sem instrução em contrário o navegador usa o elemento
       * arrastado como fantasma do cursor: a tela do jogo inteira, translúcida,
       * seguindo o mouse. Parece exatamente a câmera saindo do lugar.
       *
       * `setDragImage` troca o fantasma pelo sprite do item. Ele exige um nó que
       * o navegador possa pintar, então o sprite entra fora da tela por um
       * instante e sai no quadro seguinte — o navegador tira a foto dele durante
       * o `dragstart`, e depois disso o nó não serve mais para nada.
       */
      const fantasma = itemCanvas(peca.item, 32, peca.count ?? 1);
      fantasma.style.position = 'fixed';
      fantasma.style.top = '-1000px';
      fantasma.style.left = '-1000px';
      fantasma.style.pointerEvents = 'none';
      document.body.append(fantasma);
      event.dataTransfer.setDragImage(fantasma, 16, 16);
      setTimeout(() => fantasma.remove(), 0);
    });

    canvas.addEventListener('dragover', (event) => {
      if (!this.onTileDrop) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    canvas.addEventListener('drop', (event) => {
      if (!this.onTileDrop) return;
      event.preventDefault();
      const casa = this.casaDoEvento(event);
      if (!casa) return;
      let carga = null;
      try {
        carga = JSON.parse(event.dataTransfer.getData('text/plain'));
      } catch {
        return;
      }
      if (carga) this.onTileDrop(casa.x, casa.y, carga, event);
    });
    requestAnimationFrame(this.render);
  }

  /**
   * O zoom sai da regra de campo de visão: o maior fator inteiro que ainda
   * mostra 11 sqm para cada lado e 6 para cima e para baixo. Com ele definido,
   * o canvas ocupa a tela inteira — sobra um pouco de mundo além do mínimo, e
   * nunca menos. Fator inteiro é o que mantém o pixel art nítido.
   */
  resize() {
    // Mexer em `canvas.width` APAGA o canvas: o proximo quadro nao pode ser
    // pulado, ou a tela fica preta ate alguem se mexer. Ver `podePularQuadro`.
    this.precisaDesenhar = true;
    // O canvas tem sempre 23x13 tiles — 11 sqm para cada lado do personagem e 6
    // para cima e para baixo. Esse enquadramento é o combinado e vem antes de
    // tudo: o CSS amplia até encher a tela, mesmo que o fator saia quebrado.
    this.canvas.width = VIEW_TILES_X * TILE;
    this.canvas.height = VIEW_TILES_Y * TILE;
    this.ctx.imageSmoothingEnabled = false;

    // O zoom preenche a tela inteira: pega o maior dos dois fatores, então o
    // eixo mais folgado transborda um pouco em vez de deixar tarja preta.
    const fit = Math.max(window.innerWidth / this.canvas.width, window.innerHeight / this.canvas.height);
    this.zoom = Math.max(1, fit);

    const width = this.canvas.width * this.zoom;
    const height = this.canvas.height * this.zoom;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.offset = {
      x: Math.round((window.innerWidth - width) / 2),
      y: Math.round((window.innerHeight - height) / 2),
    };
    this.canvas.style.left = `${this.offset.x}px`;
    this.canvas.style.top = `${this.offset.y}px`;
    this.resizeOverlay();
  }

  /**
   * Em que casa do mundo caiu este ponteiro. `null` fora do mapa.
   *
   * Saiu de dentro do `handleClick` para o arrasto poder fazer a MESMA conta:
   * duplicá-la era o jeito de o clique e o arrasto discordarem de uma casa
   * depois de um zoom.
   */
  casaDoEvento(event) {
    if (!this.snapshot) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / this.zoom;
    const y = (event.clientY - rect.top) / this.zoom;
    if (x < 0 || y < 0 || x > this.canvas.width || y > this.canvas.height) return null;
    return {
      x: Math.floor((x + this.camera.x) / TILE),
      y: Math.floor((y + this.camera.y) / TILE),
    };
  }

  /** Converte um clique da tela em coordenada de tile. */
  handleClick(event, botao = 'esquerdo') {
    const responder = botao === 'direito' ? this.onTileRight : this.onTileClick;
    if (!responder) return;
    // Com o portal de saída na tela, a cena é a de onde se sai (congelada): um clique nela mandaria a casa errada para o mapa novo.
    if (this.portalDeSaida) return;
    const casa = this.casaDoEvento(event);
    if (!casa) return;
    // O evento vai junto: o menu do botão direito precisa saber ONDE abrir.
    responder(casa.x, casa.y, event);
  }

  /**
   * `payload` vem do servidor: uma hunt em andamento ou a cidade compartilhada.
   * O mapa chega uma vez por sessão e fica guardado aqui.
   */
  setSnapshot(payload, character) {
    /*
     * ---- Este retrato MUDA alguma coisa na tela? ----
     *
     * Ele chega oito vezes por segundo, venha o que vier dentro dele. Marcar
     * "precisa desenhar" em todos custava, medido num telefone comum, oito
     * redesenhos por segundo de um mapa que leva 60ms cada — meia thread para
     * repintar uma cidade parada.
     *
     * Mas ignorá-los também não dá: um bicho que NASCE parado ao lado do
     * personagem, um item largado no chão, uma barra de vida que cai sem
     * ninguém andar — nada disso mexe a câmera nem põe efeito no ar, e o
     * `podePularQuadro` não teria como perceber.
     *
     * Então o retrato é resumido: quem está na tela, onde, virado para onde e
     * com quanta vida. Enquanto esse resumo não muda, não há o que redesenhar.
     * Ver `assinaturaDoRetrato`.
     */
    this.character = character;
    // Os buffs ligados do personagem (com a skill: `sk`) — o visual CONTÍNUO deles (a aura) é desenhado sob o boneco.
    this.buffsDoJogador = (payload?.buffs ?? []).filter((b) => b.sk && visuaisAtuais().skills?.[b.sk]?.continuo);
    if (!payload) {
      this.snapshot = null;
      this.entities.clear();
      this.texts = [];
      this.falas = [];
      // Sair do mapa e uma mudanca como qualquer outra: a tela tem de apagar.
      this.precisaDesenhar = true;
      this.assinaturaDesenhada = null;
      return;
    }

    /*
     * A conferencia vem DEPOIS da saida de cima: sem retrato nao ha o que
     * resumir, e calcular a assinatura antes estourava em `payload.z` — era o
     * jogo nao entrando.
     */
    const assinatura = assinaturaDoRetrato(payload);
    if (assinatura !== this.assinaturaDesenhada) {
      this.assinaturaDesenhada = assinatura;
      this.precisaDesenhar = true;
    }

    const now = performance.now();

    if (payload.map) {
      // Mapa novo: ninguém "vem andando" do mapa antigo. Sem limpar as
      // entidades, o personagem aparecia na posição velha e deslizava pela tela
      // inteira até o lugar certo ao entrar numa hunt ou criar a conta.
      if (this.mapId !== payload.mapId) {
        this.entities.clear();
        this.texts = [];
        this.falas = [];
        this.effects = [];
        this.missiles = [];
      }
      this.mapData = payload.map;
      this.mapId = payload.mapId;
      this.groundKey = '';
    }

    // ENTRADA nova no mesmo mapa (a instância nova do loop da fase, a sala da party) também é um recomeço: o boneco aparece na entrada,
    // sem ser "puxado" pela instância de antes (`entradaNova`, portal-ciclo.mjs). Os eventos da cena nova chegam depois deste retrato.
    if (entradaNova(this.entrada, payload.entrada)) {
      this.entities.clear();
      this.texts = [];
      this.falas = [];
      this.effects = [];
      this.missiles = [];
    }
    if (payload.entrada != null) this.entrada = payload.entrada;

    // Troca de andar também é um recomeço: o mapa é o mesmo, as posições não.
    if (this.floor !== (payload.z ?? 0)) {
      this.floor = payload.z ?? 0;
      this.entities.clear();
    }
    if (payload.mapId !== this.mapId && !payload.map) {
      /*
       * Mudou de mapa e o novo ainda não chegou: nada para desenhar.
       *
       * ---- E, se ele NÃO vier, alguém tem de pedir ----
       *
       * O servidor manda a paleta uma vez por mapa e marca o socket
       * (`sentMapId`). Se aquele envio se perdeu — aba trocada no meio,
       * reconexão, rede engasgada —, ele não manda de novo, e a tela fica
       * assim: preta, ou com sprite trocada, até a pessoa entrar noutra hunt.
       *
       * Esta marca é o pedido de socorro. Quem a lê é o `applyState`, que pede
       * a paleta de volta — e o servidor tem um comando só para isso
       * (`pedirMapa`). É a rede de segurança para todas as causas, inclusive as
       * que ainda não conhecemos.
       */
      this.snapshot = null;
      this.faltando = payload.mapId ?? true;
      return;
    }
    this.faltando = null;
    payload.map = payload.map ?? this.mapData;

    this.snapshot = payload.map ? payload : null;
    if (!payload.map) return;

    const seen = new Set();
    if (payload.player) {
      seen.add('player');
      this.track(
        'player',
        {
          ...payload.player,
          look: character.outfit.type,
          colors: character.outfit,
          mount: character.outfit.mount,
          addons: character.outfit.addons ?? 0,
          name: character.name,
          marca: character.marca ?? null,
          hp: character.hp,
          maxHp: character.derived.maxHp,
          // A esfera de nível e a barra de mana do nameplate (a do aliado da party vem em `aliados`).
          level: character.level,
          mana: character.mana,
          maxMana: character.derived.maxMana,
          // O Escudo de Energia (cinza por cima da vida, como no HUD).
          es: character.es ?? character.derived.energyShield ?? 0,
          esMax: character.derived.energyShield ?? 0,
        },
        now
      );
    }

    /*
     * Os objetos soltos do retrato: hoje, os bonecos de treino da cidade.
     *
     * Eles não são criatura (não andam, não têm vida) nem estão nas pilhas do
     * mapa exportado (o god os planta em jogo, e reexportar a cidade a cada
     * mudança seria absurdo). Por isso viajam numa lista própria e são
     * desenhados na mesma passada casa a casa das criaturas — assim quem está
     * ao sul do boneco aparece na frente dele, como manda a ordem do tabuleiro.
     */
    /*
     * O chão largado entra na MESMA lista dos bonecos, e por isso não precisa
     * de passada nova: quem está ao sul da peça aparece na frente dela, como
     * manda a ordem do tabuleiro.
     *
     * O `nome` é retirado de propósito. O desenho escreve o nome de todo
     * objeto que tem um (é assim que o boneco de treino se identifica), e uma
     * cidade com trinta peças largadas viraria trinta legendas por cima do
     * mapa. O nome continua vindo do servidor e é usado onde ele responde uma
     * pergunta: no menu do botão direito, ao apontar para a casa.
     */
    this.chao = payload.chao ?? [];
    /*
     * ---- As paredes de runa ----
     *
     * "magic wall rune, wild growth rune."
     *
     * Elas entram como OBJETO de casa, e nao como pilha de chao: pilha se pega
     * (o menu do botao direito oferece "Pegar"), e uma parede que o adversario
     * cata e guarda na mochila nao e' uma parede.
     *
     * O `item` e o id do catalogo (2128 e 2130), entao o desenho ja existe e
     * nao ha sprite nova para carregar.
     */
    this.barreiras = payload.barreiras ?? [];
    this.objetos = [
      ...(payload.objetos ?? []),
      ...this.chao.map(({ nome, ...resto }) => resto),
      ...this.barreiras.map((b) => ({ x: b.x, y: b.y, item: b.item, count: 1 })),
    ];

    for (const monster of payload.monsters ?? []) {
      seen.add(monster.uid);
      this.track(monster.uid, monster, now);
    }
    for (const other of payload.players ?? []) {
      seen.add(other.uid);
      this.track(other.uid, { ...other, isOther: true }, now);
    }
    /*
     * ---- Os NPCs da cidade ----
     *
     * Desenhados como gente, porque são gente: mesma roupa, mesmo nome por
     * cima da cabeça. `isOther` é o que os põe na mesma família de desenho dos
     * outros jogadores; `npc` é o que o clique usa para saber que ali não se
     * convida para party — se fala.
     *
     * A lista já vem filtrada pelo andar de quem olha (ver `npcsDoAndar`).
     */
    this.npcs = payload.npcs ?? [];
    for (const npc of this.npcs) {
      seen.add(npc.uid);
      this.track(npc.uid, { ...npc, isOther: true, npc: true }, now);
    }
    // Os companheiros de caçada: gente de verdade, desenhada como os outros
    // jogadores da cidade — com nome, barra de vida e a roupa deles.
    for (const aliado of payload.aliados ?? []) {
      seen.add(aliado.uid);
      this.track(aliado.uid, { ...aliado, isOther: true, aliado: true }, now);
    }
    /*
     * ---- Os familiares: o meu e os do grupo ----
     *
     * Desenhados na família dos OUTROS (`isOther`) porque é isso que eles são
     * na tela: um boneco com nome por cima da cabeça, e não um monstro que se
     * clica para atacar.
     *
     * Sem `hp` nem `maxHp` de propósito, e é a única diferença que importa:
     * `drawEntity` só desenha a barra de vida de quem tem os dois, e o familiar
     * daqui não apanha — ele não é alvo de nada. Uma barra cheia parada em
     * cima dele prometeria uma luta que não existe.
     *
     * `summonsDoGrupo` traz o dos companheiros. Sem ele, numa caçada de três,
     * cada um veria só o seu e a caverna pareceria ter um familiar quando tem
     * três.
     */
    // + os LACAIOS e os TOTENS das gemas do PoE (como o familiar: andam com o dono, não são alvo).
    for (const summon of [payload.summon, ...(payload.summonsDoGrupo ?? []), ...(payload.lacaios ?? [])]) {
      if (!summon) continue;
      seen.add(summon.uid);
      this.track(summon.uid, { ...summon, isOther: true, summon: true }, now);
    }
    /*
     * ---- O escudo da party mora no BONECO, não num painel ----
     *
     * É onde ele fica no cliente do Tibia: colado no personagem, ao lado do
     * nome, para se ver de relance quem está no grupo e se a experiência está
     * sendo dividida AGORA. Num painel no rodapé a informação existe e ninguém
     * olha — no meio de uma caçada os olhos estão no mapa.
     *
     * A lista vem pronta do servidor (`snapshot.party`), então aqui só se
     * guarda um mapa por nome: quem é líder e se a partilha está valendo. Sem
     * grupo, `null` — e o desenho nem é tentado.
     */
    // O próprio nome fica guardado: `addEvents` não recebe o personagem, e é lá
    // que se decide se um evento é meu ou de um companheiro.
    this.meuNome = character?.name ?? this.meuNome ?? null;

    /*
     * ---- O escudo vale na CIDADE também ----
     *
     * Ele saía só de `payload.party`, que é a party da CAÇADA: na cidade, com o
     * time montado e ninguém caçando, os escudos sumiam — e é justamente ali que
     * se monta a party e se quer ver quem está nela.
     *
     * Então há duas fontes, nesta ordem: a caçada, que sabe quem está de fato
     * na sessão e se a partilha vale; e, na falta dela, a PARTY (o time), que
     * vale em qualquer lugar. Fora de caçada não há partilha — o escudo aparece
     * vazio, dizendo o cargo e mais nada, que é a verdade.
     */
    /*
     * ---- E a partilha é de CADA UM ----
     *
     * `ativa` valia para o desenho inteiro: quem estivesse na party ganhava o
     * escudo cheio, mesmo estando fora da caçada. As duas fontes se somam — na
     * caçada mandam os membros da SESSÃO, e quem só está no time entra depois,
     * com o escudo vazio, que é a verdade sobre ele.
     */
    /*
     * ---- Aqui se bate em gente? ----
     *
     * O mesmo campo que o menu do jogador já usa para oferecer "Atacar" (ver
     * `snapshot`, no hunt.mjs). Aqui ele serve para uma coisa só: trocar o
     * escudo da party pela caveira. Ver `drawCaveiraDoDuelo`.
     */
    this.pvp = !!payload.pvp;

    this.party = null;
    const porNome = new Map();
    const ativa = !!payload.party?.ativa;
    for (const membro of payload.party?.membros ?? []) {
      const ok = (membro.estado ?? 'ok') === 'ok';
      porNome.set(membro.name, { lider: !!membro.lider, ok, partilhando: ativa && ok });
    }
    for (const membro of character?.party?.membros ?? []) {
      if (porNome.has(membro.name)) continue;
      // No time, fora da caçada: o cargo, e partilha nenhuma.
      porNome.set(membro.name, { lider: !!membro.lider, ok: true, partilhando: false });
    }
    if (porNome.size > 1) this.party = { ativa, porNome };

    this.targetUid = payload.targetUid ?? null;
    for (const key of [...this.entities.keys()]) if (!seen.has(key)) this.entities.delete(key);
  }

  track(key, data, now) {
    let entity = this.entities.get(key);
    if (!entity) {
      entity = { x: data.x, y: data.y, fromX: data.x, fromY: data.y, since: now - 9999, duration: 1 };
      this.entities.set(key, entity);
    }

    // O TELETRANSPORTE (a viagem entre cidades — `teleporte`, o contador do servidor): o boneco aparece na casa nova, sem o desenho do caminho
    // (antes ele era "puxado" pela praça até lá); a câmera vai junto, e o portal de chegada é um evento à parte.
    if (data.teleporte != null && data.teleporte !== entity.teleporte) {
      entity.teleporte = data.teleporte;
      entity.x = data.x;
      entity.y = data.y;
      teleportar(entity, now);
    } else if (entity.x !== data.x || entity.y !== data.y) {
      // Continua de onde o desenho parou: nada de teleporte quando dois passos
      // se encavalam entre dois pacotes do servidor.
      // (A conta, com a folga contra o jitter da rede, mora em `interpolacao.mjs` e é testada lá.)
      comecarPasso(entity, now, data.moveMs);
      /*
       * Carência de andar.
       *
       * O passo dura um múltiplo do tick do servidor, mas o `since` é marcado
       * quando o pacote chega, não quando o passo começou de verdade. Com o
       * atraso da rede a interpolação acaba antes do próximo pacote e a
       * criatura voltava à pose parada por uns 90ms no meio da caminhada — o
       * piscar do orc warrior. Segurar a pose de andar por mais um tick cobre
       * essa folga sem prender criatura nenhuma parada: quem parou de fato só
       * anima 125ms a mais, o que é o passo terminando.
       */
      entity.walkUntil = now + entity.duration + WALK_GRACE;
    }

    Object.assign(entity, {
      uid: data.uid ?? key,
      x: data.x,
      y: data.y,
      dir: data.dir ?? entity.dir ?? 2,
      look: data.look,
      // Criatura sem outfit, desenhada com o sprite de um item. Ver `drawEntity`.
      lookItem: data.lookItem ?? 0,
      colors: data.colors,
      mount: data.mount ?? 0,
      addons: data.addons ?? 0,
      name: data.name,
      hp: data.hp,
      maxHp: data.maxHp,
      mana: data.mana,
      maxMana: data.maxMana,
      es: data.es ?? 0,
      esMax: data.esMax ?? 0,
      level: data.level,
      // O cargo de quem é da equipe, para a tag por cima do nome. `null` em
      // jogador — e é `null` explícito, e não ausente, para uma promoção ou um
      // rebaixamento valerem no quadro seguinte sem sobra do estado anterior.
      marca: data.marca ?? null,
      isPlayer: key === 'player',
      isOther: !!data.isOther,
      // O familiar. Ele nao e alvo, nao se convida e nao tem barra de vida —
      // ver a nota do laco que o registra, em setSnapshot.
      summon: !!data.summon,
      /*
       * Companheiro de SESSAO — na arena de x1, o adversario.
       *
       * Ele ja chegava marcado em `setSnapshot` (`{ ...aliado, aliado: true }`)
       * e morria aqui: este `Object.assign` copia campo a campo, e o que nao
       * esta na lista nao existe do lado de fora. Nada lia `entity.aliado` ate
       * a caveira do duelo precisar dele, entao a falta nunca deu erro — ela
       * so faria a caveira aparecer num boneco so.
       */
      aliado: !!data.aliado,
      // O Summon Level do dono dele, desenhado ao lado do nome. Ver `corDoNivelDoSummon`.
      // (No MOB é o level dele, ao lado do nome — ver `drawNameplate`.)
      nivel: data.nivel,
      // A raridade e os modificadores do mob (a cor do nome e a linha de cima — ver `drawNameplate`).
      raridade: data.raridade ?? null,
      mods: data.mods ?? null,
      // Os estados ativos do mob (congelado, atordoado, lento, queimando): um ícone de cada ao lado da barra.
      estados: data.estados ?? null,
    });
  }

  /**
   * Recomeço limpo depois de a aba voltar do fundo.
   *
   * Números de dano, efeitos e projéteis que nasceram enquanto ninguém olhava
   * não têm mais o que mostrar: eles apareceriam todos de uma vez, atrasados,
   * em cima de uma cena que já mudou. Jogar fora é o desenho certo — e é uma
   * lista curta, não um vazamento.
   */
  /**
   * O mapa que a tela está esperando e não recebeu, ou `null` quando está tudo
   * no lugar. Ver a nota em `setSnapshot`.
   */
  faltaOMapa() {
    return this.faltando ?? null;
  }

  reatar() {
    this.texts = [];
    this.falas = [];
    this.effects = [];
    this.missiles = [];
    this.objetos = [];
    this.chao = [];
    this.barreiras = [];
    this.npcs = [];
  }

  addEvents(events = []) {
    const now = performance.now();
    /*
     * ---- As chaves de gráficos, no NASCIMENTO do evento ----
     *
     * Recusar aqui e não só no desenho: um evento que entra na fila custa o
     * `push`, custa a varredura de idade em todo quadro e custa a memória até
     * expirar. Numa caçada de área com meia dúzia de bichos são dezenas por
     * segundo, e quem apagou a chave apagou justamente por causa disso.
     *
     * A FALA (`say`) não tem chave e continua entrando: ela é o nome da magia
     * saindo do boneco, no máximo quatro linhas paradas, e é informação e não
     * enfeite.
     */
    const querNumeros = graficoLigado('numeros');
    const querEfeitos = graficoLigado('efeitos');
    const querProjeteis = graficoLigado('projeteis');
    for (const event of events) {
      /*
       * ---- Os EFEITOS e os PROJÉTEIS: a camada de efeitos (`efeitos-visuais.mjs`) ----
       * A mesma da Arena de Efeitos da engine: sem visual configurado para a skill (`sk`), o desenho de sempre; com, o da skill
       * (lançamento, projétil, impacto, área, no alvo). Antes do filtro dos números: o efeito "no alvo" vem do evento de dano.
       */
      if (event.t === 'portal') {
        // O portal de viagem de quem saiu noutro andar não aparece neste; o da CHEGADA espera a cortina "Traçando a rota" sair (é
        // por baixo dela que a caçada começa) — `drawEffects` o solta.
        if (event.z != null && event.z !== (this.snapshot?.z ?? this.floor ?? 0)) continue;
        if (event.chegada && cortinaDeViagemNaTela()) {
          (this.portaisDepoisDaCortina ??= []).push(event);
          continue;
        }
      }
      if (EVENTOS_DA_CAMADA.has(event.t)) {
        // De quem é o lançamento nesta tela (a mesma regra do `deQuem` logo abaixo: o meu boneco é 'player', o do aliado `aliado:<nome>`).
        const uidDe = (e) => (!e.quem ? e.uid : e.quem === this.meuNome ? 'player' : `aliado:${e.quem}`);
        const novos = (this.camadaDeEfeitos ??= criarCamada()).receber(event, now, { uidDe });
        // O portal do chefe do ato aparece mesmo com os efeitos desligados: é dele que o chefe sai (não é enfeite).
        if (querEfeitos || event.t === 'portal') this.effects.push(...novos.efeitos);
        if (querProjeteis) this.missiles.push(...novos.projeteis);
      }
      if (!querNumeros && (event.t === 'dmg' || event.t === 'heal' || event.t === 'kill' || event.t === 'block')) continue;
      if (!querEfeitos && (event.t === 'fx' || event.t === 'explosao' || event.t === 'area')) continue;
      if (!querProjeteis && event.t === 'shot') continue;
      // A cor de cada número vem do servidor, com a mesma tabela do
      // combatGetTypeInfo: físico vermelho, energia roxo, gelo azul-claro...
      /*
       * ---- De quem é este número, nesta tela ----
       *
       * Os eventos da caçada são da SESSÃO: um só, entregue a todo mundo que
       * está caçando junto. O servidor mandava `uid: 'player'` para o que
       * acontecia com uma pessoa — e `'player'` quer dizer "o boneco de quem
       * está olhando". Resultado: a magia que o knight lançava aparecia saindo
       * do druida na tela do druida, e o dano que o druida levava subia em cima
       * do knight na tela do knight.
       *
       * Agora vem o NOME (`quem`), e a resolução é local: meu nome é 'player',
       * o de outro é o aliado daquele nome. Sem `quem` — evento de um servidor
       * antigo — vale o `uid` como antes.
       */
      const deQuem = (event) => {
        if (!event.quem) return event.uid;
        return event.quem === this.meuNome ? 'player' : `aliado:${event.quem}`;
      };

      /*
       * ---- Onde este numero entra na pilha ----
       *
       * "os danos sobem separados sabe? danos recebidos e aplicados sobem junto
       *  e os da magias soltadas sobem junto"
       *
       * Sao duas pilhas, e nao uma: numero de dano aqui, fala no bloco de baixo.
       * Eu tinha juntado as duas numa coluna so', e alem de misturar as coisas
       * isso abria a separacao — o degrau somava com a subida propria de cada
       * texto, entao dois numeros do mesmo tique iam se afastando sozinhos.
       *
       * O degrau serve so' para o instante do nascimento: dois numeros do mesmo
       * tique sairiam colados um no outro. Depois de `JANELA_DO_DEGRAU` o texto
       * ja' subiu mais que uma linha por conta propria e devolve o lugar — e por
       * isso a pilha nao cresce enquanto a caçada anda, so' enquanto chegam
       * numeros juntos.
       */
      const degrauDoNumero = (uid) => {
        let degrau = 0;
        for (const texto of this.texts) {
          if (texto.uid === uid && now - texto.born < Math.min(JANELA_DO_DEGRAU, texto.life)) degrau += 1;
        }
        return Math.min(5, degrau);
      };
      if (event.t === 'dmg' || event.t === 'heal') {
        /*
         * ---- Zero não sobe ----
         *
         * Quem manda o número é o servidor, e ele já não manda zero (ver o
         * `if (damage <= 0)` do `hunt.mjs`): o golpe que não passa vira só a
         * faísca do bloqueio, como no crystalserver. A trava fica aqui também
         * porque a fila de eventos é aberta — uma cura de zero, um golpe de uma
         * versão antiga do servidor ainda em pé — e um "0" ou um "+0" na tela é
         * sempre ruído.
         *
         * O efeito não passa por aqui: ele é um evento `fx`, e continua
         * desenhado normalmente.
         */
        if (!event.v) continue;
      }

      if (event.t === 'dmg') {
        this.texts.push({
          uid: deQuem(event),
          x: event.x,
          y: event.y,
          text: `${event.v}`,
          color: event.color ?? '#ff0000',
          /*
           * Crítico e Onslaught engordam o número do mesmo jeito.
           *
           * São as duas sortes que multiplicam o golpe, e o que a pessoa lê
           * num número que passa voando é "esse aí saiu grande" — dois
           * tamanhos diferentes para dizer isso seriam uma tabela a decorar.
           * Sem nenhuma marca, um tier 10 de wand era invisível.
           */
          size: event.crit || event.onslaught ? 15 : 13,
          degrau: degrauDoNumero(deQuem(event)),
          born: now,
          life: 1000,
          /*
           * Sem deriva horizontal: no client dele a pilha e' uma COLUNA, todos os
           * textos no mesmo x. A deriva existia para dois numeros simultaneos nao
           * se cobrirem, e quem faz esse trabalho agora e' o degrau — mantendo os
           * dois, a pilha saia torta, que foi metade do "ta ruim".
           */
          drift: 0,
        });
      } else if (event.t === 'heal') {
        this.texts.push({ uid: deQuem(event), x: event.x, y: event.y, text: `+${event.v}`, color: event.color ?? '#ff6666', size: 13, born: now, life: 900, drift: 0, degrau: degrauDoNumero(deQuem(event)) });
      } else if (event.t === 'kill') {
        // Preso ao boneco de quem ganhou: em grupo sai um por pessoa, e sem o
        // `uid` os dois números ficariam plantados no chão, longe de quem
        // recebeu. Ver `deQuem`.
        this.texts.push({ uid: deQuem(event), x: event.x, y: event.y, text: `+${event.exp} xp`, color: event.color ?? '#ffffff', size: 13, born: now, life: 1200, drift: 0, degrau: degrauDoNumero(deQuem(event)) });
      } else if (event.t === 'say') {
        /*
         * ---- A fala e' um BLOCO, e nao um texto por palavra ----
         *
         * "os da magias soltadas sobem junto"
         *
         * Na base a fala nao voa: ela fica parada acima da cabeca, e quando sai
         * outra ela entra por BAIXO e o bloco inteiro cresce para cima. E' isso
         * que faz as magias 'subirem juntas' — elas nao sobem uma a uma, o
         * bloco e' que fica mais alto.
         *
         * Enquanto eram textos soltos, cada palavra tinha idade propria e subia
         * no ritmo dela: duas magias no mesmo tique saiam encavaladas e depois
         * se descolavam torto. Como bloco elas nascem alinhadas, andam juntas e
         * apagam juntas.
         *
         * O relogio e' de cada LINHA, e nao do bloco (ver `VIDA_DA_FALA`): o
         * bloco e' so' a caixa que as empilha, e ele morre quando a ultima linha
         * dele morre.
         */
        const deQuemFala = deQuem(event);
        const bloco = this.falas.find((fala) => fala.uid === deQuemFala);
        const linha = { text: event.text, color: event.color ?? '#f36500', born: now };
        if (bloco) {
          bloco.linhas.push(linha);
          /*
           * A mais velha sai para a nova entrar — o teto e' de linhas VIVAS.
           *
           * Ele leu certo o que acontecia: "a setima ela elimina uma pra por
           * outra". Continua sendo assim, so' que a partir da quarta.
           */
          while (bloco.linhas.length > LINHAS_DA_FALA) bloco.linhas.shift();
          bloco.x = event.x;
          bloco.y = event.y;
        } else {
          this.falas.push({ uid: deQuemFala, x: event.x, y: event.y, linhas: [linha] });
        }
      } else if (event.t === 'block') {
        this.texts.push({ uid: deQuem(event), x: event.x, y: event.y, text: textoDoBloqueio(event), color: event.color ?? '#999999', size: 12, born: now, life: 700, drift: 0, degrau: degrauDoNumero(deQuem(event)) });
      }
      // `fx`, `explosao`/`area` (cada casa que pegou — `casasDoEvento`) e `shot` (60 ms por casa, como no client): na camada de efeitos, acima.
    }
    /*
     * ---- Os TETOS da tela não podem cortar uma área no meio ----
     *
     * Eram 60 efeitos e 60 números: uma magia de 85 casas (Rage of the Skies, Wrath of
     * Nature) chegava num lote só, e o corte — que fica com os ÚLTIMOS — jogava fora os
     * 25 primeiros, que são a parte de CIMA da área (a forma é listada de cima para
     * baixo). O dano saía em todas as casas; a tela é que não mostrava nem o efeito nem
     * o número lá em cima. Os tetos agora cabem as maiores áreas (e explosões em
     * cadeia) com folga; continuam existindo para segurar uma enxurrada.
     */
    if (this.texts.length > TETO_DE_NUMEROS) this.texts.splice(0, this.texts.length - TETO_DE_NUMEROS);
    if (this.falas.length > 20) this.falas.splice(0, this.falas.length - 20);
    if (this.effects.length > TETO_DE_EFEITOS) this.effects.splice(0, this.effects.length - TETO_DE_EFEITOS);
    if (this.missiles.length > 40) this.missiles.splice(0, this.missiles.length - 40);
  }

  // ---------- câmera ----------

  updateCamera(now) {
    const player = this.entities.get('player');
    const map = this.snapshot.map;
    const viewW = this.canvas.width;
    const viewH = this.canvas.height;
    const worldW = map.width * TILE;
    const worldH = map.height * TILE;

    let cx = worldW / 2;
    let cy = worldH / 2;
    if (player) {
      const pos = this.position(player, now);
      cx = pos.x + TILE / 2;
      cy = pos.y + TILE / 2;
    }

    /*
     * ---- O limite da hunt manda na câmera ----
     *
     * Uma hunt pode declarar o retângulo em que se joga (`map.limite`, escolhido
     * no editor). Ele é onde o personagem pode andar — quem o cobra é o
     * `isBlocked` do servidor — e é também o que a câmera pode mostrar.
     *
     * A segunda metade é a que resolve o buraco preto. O recorte de uma hunt tem
     * beirada, e depois da beirada não há mapa nenhum: casa vazia é desenhada
     * preta. Com a câmera parando no limite, o vazio não entra na tela — não há
     * o que esconder, porque não há para onde olhar. É a beirada do mapa de
     * qualquer Tibia: o boneco chega na borda e a tela para.
     *
     * Sem limite (as hunts anteriores a ele, e a cidade) o retângulo é o mapa
     * inteiro, que é como sempre foi.
     *
     * A caixa é a do ANDAR em que se está: o limite virou um desenho a lápis,
     * feito nível por nível no editor, e o do andar de cima de uma caverna
     * quase nunca tem o tamanho do de baixo. Andar sem caixa é andar sem
     * limite — o mapa inteiro, como antes.
     */
    const limite = map.limite?.caixas
      ? map.limite.caixas[this.snapshot.z ?? this.floor ?? 0] ?? null
      : map.limite;
    const areaX = limite ? limite.x * TILE : 0;
    const areaY = limite ? limite.y * TILE : 0;
    const areaW = limite ? limite.w * TILE : worldW;
    const areaH = limite ? limite.h * TILE : worldH;

    // Pixel inteiro na câmera também: meio pixel faz o cenário tremer.
    this.camera.x =
      areaW <= viewW
        ? Math.round(areaX + (areaW - viewW) / 2)
        : Math.round(Math.min(Math.max(cx - viewW / 2, areaX), areaX + areaW - viewW));
    this.camera.y =
      areaH <= viewH
        ? Math.round(areaY + (areaH - viewH) / 2)
        : Math.round(Math.min(Math.max(cy - viewH / 2, areaY), areaY + areaH - viewH));
  }

  position(entity, now) {
    const elapsed = now - entity.since;
    const progress = Math.min(1, elapsed / entity.duration);
    return {
      x: (entity.fromX + (entity.x - entity.fromX) * progress) * TILE,
      y: (entity.fromY + (entity.y - entity.fromY) * progress) * TILE,
      progress,
      // Quanto do passo já rodou, sem travar no 1: é o que faz a animação de
      // andar continuar girando na folga entre um pacote e o próximo.
      cycle: elapsed / entity.duration,
      moving: progress < 1,
      // A criatura só volta à pose parada depois da carência (veja `track`).
      walking: now < (entity.walkUntil ?? 0),
    };
  }

  // ---------- camadas ----------

  /**
   * O chão é caro de desenhar, então vai para um canvas em cache. O que anima
   * (tocha, água, lava) fica de fora e é redesenhado a cada quadro.
   */
  /*
   * ---- O chão dos mapas gerados, assado uma vez ----
   *
   * Só o caminho ANTIGO passa por aqui: mapa sem paleta, três camadas fixas
   * (`ground`, `overlay`, `decor`) e nenhum sprite alto. Nele não há pilha, e
   * por isso não há ordem para errar — o cache resolve.
   *
   * Os mapas de verdade (paleta + pilha por casa) são desenhados casa a casa a
   * cada quadro em `drawMapa`. Veja o comentário de lá.
   */
  buildGround() {
    const map = this.snapshot.map;
    if (map.palette) {
      // Nada a assar: o desenho é por casa, na hora.
      this.groundCache = null;
      this.animated = [];
      return;
    }
    const key = `${map.width}x${map.height}:${map.ground?.join(',')}`;
    if (this.groundKey === key) return;

    const cache = document.createElement('canvas');
    cache.width = map.width * TILE;
    cache.height = map.height * TILE;
    const ctx = cache.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const animated = [];
    let complete = true;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const index = y * map.width + x;
        for (const id of [map.ground[index], map.overlay?.[index], map.decor?.[index]]) {
          if (!id) continue;
          if (isAnimated(id)) {
            animated.push({ id, x, y });
            continue;
          }
          complete = drawItem(ctx, id, x * TILE, y * TILE) && complete;
        }
      }
    }

    this.groundCache = cache;
    this.animated = animated;
    // Só congela o cache quando todos os sprites já estavam carregados.
    if (complete) this.groundKey = key;
  }

  /**
   * O fundo (os andares de baixo vistos pelos buracos, o véu, as escadas) pintado
   * direto em `this.ctx`. Era o corpo do `drawMapa`; saiu para cá sem mudar uma
   * linha, e é o que `desenharFundoGuardado` chama por baixo, com o pincel trocado.
   */
  pintarFundo(map, atlas, cell, time, stacks, z, camadas) {
    const ctx = this.ctx;
    /*
     * As casas que deixam ver o andar de baixo, além das vazias.
     *
     * Ver `buracosDoAndar`: a escada de descida e o buraco no chão têm um
     * item em cima, e a máscara "só onde o chão daqui não existe" os tratava
     * como chão fechado. O resultado era um quadrado PRETO no meio da sala,
     * exatamente onde o Tibia mostra o andar de baixo pelo buraco.
     */
    const { comuns, escadas } = this.buracosDoAndar(map, z);
    for (let profundidade = camadas.length - 1; profundidade >= 0; profundidade--) {
      /*
       * ---- O andar de baixo entra DESLOCADO, e essa era a metade que faltava ----
       *
       * A conta do Tibia é uma só (`offset = z - nz`, do
       * `GetMapDescription`): o andar de cima é lido em `x+1, y+1` e o de
       * baixo em `x-1, y-1`. O de cima já fazia a sua parte; este aqui
       * passava `0`, e o `andar-visivel.mjs` tinha a dívida anotada há
       * tempos — "pela conta do offset elas deveriam entrar uma casa para
       * baixo e para a direita".
       *
       * O sintoma é exatamente o que o dono descreveu na cidade: "o subsolo
       * ta ok, o andar principal ta ok, mas quando sobe 1 andar ele esta
       * descentralizado — o andar de cima teria que ser 1 sqm pra cima e um
       * pra esquerda". As duas contas discordavam em UMA casa, e dava para
       * ver de qual lado:
       *
       *   de pé no z7, o telhado do z6 aparecia em `x+1, y+1`  (certo)
       *   de pé no z6, o chão do z7 aparecia em `x, y`         (uma casa fora)
       *
       * Subir uma escada movia a cidade inteira uma casa debaixo dos pés.
       * Com o deslocamento aqui, as duas vistas passam a contar a mesma
       * coisa — e o telhado fica onde a parede que o sustenta está.
       */
      this.desenharCamada(camadas[profundidade], map, atlas, cell, time, stacks, -(profundidade + 1), comuns);
    }
    /*
     * O véu que escurece o que está lá embaixo. Ele vem AQUI, e o que for
     * desenhado depois dele não é escurecido — ver a casa de descer, logo
     * abaixo.
     */
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    /*
     * ---- E a CASA DE DESCER, numa passada própria, depois do véu ----
     *
     * Ela é a escada, o alçapão, a escotilha de clicar. A sprite dela não
     * tapa o tile inteiro (`tapa` é falso, medido pixel a pixel no export):
     * tem madeira em volta e o miolo vazado. Pelo vazado se vê o degrau de
     * chegada — é assim na base do dono, e foi a foto que ele mandou como o
     * certo.
     *
     * Duas coisas a separam da passada de cima, e as duas vieram de ver
     * errado na tela:
     *
     *   SEM DESLOCAMENTO. A perspectiva do Tibia vale para o chão visto de
     *   longe; a escada é a casa para onde se DESCE, e o que tem de aparecer
     *   nela é o que está exatamente embaixo. Com o deslocamento, a escada da
     *   Draken Walls mostrava o mar que fica uma casa a noroeste.
     *
     *   DEPOIS DO VÉU. O véu existe para afundar o andar de baixo visto pelos
     *   buracos do chão. O degrau ao pé da escada não está longe — está um
     *   passo abaixo —, e escurecê-lo dava o "tá com sombra" que o dono viu:
     *   um quadrado quase preto onde a base mostra madeira.
     *
     * (Foi tentado também não desenhar nada atrás dela. Ficou certo onde a
     * sprite tapa o tile, e preto nas 543 casas do jogo em que ela não tapa —
     * o dono viu na hunt dos minotauros.)
     */
    if (escadas.size) {
      for (let profundidade = camadas.length - 1; profundidade >= 0; profundidade--) {
        this.desenharCamada(camadas[profundidade], map, atlas, cell, time, stacks, 0, escadas, null, escadas);
      }
    }
  }

  /*
   * ---- O fundo, pintado UMA vez e copiado ----
   *
   * Medido (auditoria 2026-09-28, werelions-1, desktop sem limite de CPU):
   * 15.880 dos 23.755 `drawImage` por segundo — 67% de todo o desenho — eram
   * esta passada, casa a casa, a cada quadro: o andar de baixo não tem o cache
   * de linha do andar atual (`podeUsarTira` é falso com deslocamento/buracos), e
   * no z11 da werelions 69% das casas contam como buraco. E nada nele depende de
   * criatura: é chão parado, que só muda quando a câmera sai dele, o andar muda
   * ou um sprite animado troca de quadro.
   *
   * Então é o mesmo esquema do `drawTeto`: a pintura inteira (camadas, véu e
   * escadas, na mesma ordem) vai para uma lona com folga em volta da tela, e a
   * lona é copiada enquanto cobrir a tela e o sprite animado mais apressado dela
   * não trocar de quadro. UMA lona, e não uma por camada como no teto: o véu
   * escurece o conjunto, e a ordem só é exata copiando o conjunto.
   *
   * Pixel a pixel igual: `source-over` é associativo — pintar A, depois o véu,
   * depois B numa lona transparente e copiar a lona dá o mesmo que pintar os
   * três direto (o véu sobre casa vazia vira preto a 45%, que é o que ele faria
   * sobre o fundo escuro). `semCacheDoFundo = true` volta ao desenho direto.
   */
  desenharFundoGuardado(map, atlas, cell, time, stacks, z, camadas) {
    const chave = `${map.atlas ?? ''}|${z}`;
    const g = this.fundoGuardado?.chave === chave && this.fundoGuardado.map === map && this.fundoGuardado.stacks === stacks ? this.fundoGuardado : null;
    const cabeDentro = g &&
      this.camera.x >= g.origemX && this.camera.y >= g.origemY &&
      this.camera.x + this.canvas.width <= g.origemX + g.lona.width &&
      this.camera.y + this.canvas.height <= g.origemY + g.lona.height;
    if (g && cabeDentro && time < g.valeAte) {
      this.ctx.drawImage(g.lona, g.origemX - this.camera.x, g.origemY - this.camera.y);
      const resto = g.valeAte === Infinity ? Infinity : g.valeAte - time;
      if (resto < this.trocaDeAnimacao) this.trocaDeAnimacao = resto;
      return;
    }
    // Folga como a do teto: venceu por animação, a folga encolhe (área a mais é
    // paga a cada vencimento); parado, folga larga para andar sem refazer.
    const folga = (g && g.resto !== Infinity ? FOLGA_CURTA_DO_TETO : FOLGA_LARGA_DO_TETO) * TILE;
    const largura = this.canvas.width + folga * 2;
    const altura = this.canvas.height + folga * 2;
    const origemX = Math.floor(this.camera.x / TILE) * TILE - folga;
    const origemY = Math.floor(this.camera.y / TILE) * TILE - folga;
    const lona = this.fundoGuardado?.lona ?? document.createElement('canvas');
    if (lona.width !== largura || lona.height !== altura) {
      lona.width = largura;
      lona.height = altura;
    }
    const pincel = lona.getContext('2d');
    pincel.imageSmoothingEnabled = false;
    pincel.clearRect(0, 0, largura, altura);
    const ctxAntes = this.ctx;
    const cameraAntes = this.camera;
    const canvasAntes = this.canvas;
    const trocaAntes = this.trocaDeAnimacao;
    this.trocaDeAnimacao = Infinity;
    try {
      this.ctx = pincel;
      this.camera = { x: origemX, y: origemY };
      this.canvas = lona;
      this.pintarFundo(map, atlas, cell, time, stacks, z, camadas);
    } finally {
      this.ctx = ctxAntes;
      this.camera = cameraAntes;
      this.canvas = canvasAntes;
    }
    const resto = this.trocaDeAnimacao;
    this.trocaDeAnimacao = Math.min(trocaAntes, resto);
    this.fundoGuardado = { chave, map, stacks, lona, origemX, origemY, resto, valeAte: resto === Infinity ? Infinity : time + resto };
    this.ctx.drawImage(lona, origemX - this.camera.x, origemY - this.camera.y);
  }

  /*
   * ---- O mapa desenhado casa a casa, na ordem do client ----
   *
   * ================ Por que o cache do chão saiu daqui ================
   *
   * O desenho era: assar o mapa inteiro num canvas, blitar esse canvas, e só
   * então passar por cima com o que é animado (água, tocha, teleporte). Isso
   * quebra a ordem, porque "animado" não quer dizer "na frente": um teleporte é
   * pintado no meio da pilha, como qualquer item, e a parede da linha de baixo
   * tem de cobri-lo. Com a passada dos animados no fim, o teleporte aparecia
   * POR CIMA da parede.
   *
   * A tentativa seguinte foi uma terceira passada — a "cobertura" —, repintando
   * depois dos animados os sprites altos que tapavam alguma casa animada. Ela
   * consertava aquele caso e criava outro, pior: repintado no fim, um sprite
   * alto passava na frente de TUDO o que tinha sido desenhado depois dele no
   * cache. Duas paredes vizinhas trocavam de ordem, a metade de cima do baú
   * saltava para a frente da escada, e cada exceção nova quebrava um vizinho.
   * Estreitar o filtro da cobertura reduzia o estrago, mas o defeito é da
   * ideia: não existe ordem certa para uma passada que acontece FORA da ordem.
   *
   * ==================== O que é feito agora ====================
   *
   * O que o client faz, e é uma coisa só: percorrer as casas de cima para baixo
   * e, em cada uma, desenhar a PILHA INTEIRA na ordem em que ela está guardada
   * — animado ou não, tanto faz, porque a animação escolhe o quadro e não o
   * lugar na fila. Um sprite de 64px é ancorado no canto de baixo da casa e
   * sobe uma linha; como a linha de cima já foi desenhada, ele a cobre, que é
   * exatamente o que se quer. Quem está mais ao sul fica na frente, sempre, sem
   * exceção nenhuma.
   *
   * O cache sumiu, e o custo disso é pequeno: só as casas VISÍVEIS são
   * desenhadas — 23 por 13, mais uma de folga em cima e à esquerda para o
   * sprite alto que entra pela borda. Medido nos mapas do jogo, a pilha tem em
   * média 1,9 sprite por casa (a cidade; as hunts ficam entre 0,8 e 1,4), o que
   * dá cerca de 700 desenhos por quadro vindos de um atlas só.
   */
  drawMapa(time, porCasa = null) {
    const map = this.snapshot?.map;
    if (!map?.palette) return;
    const atlas = image(`/gamedata/sprites/${map.atlas}.png`);
    if (!atlas.ready) return;

    const z = this.snapshot.z ?? 0;
    // Hunt de vários andares guarda um conjunto de pilhas por nível.
    const stacks = map.floors?.[z]?.stacks ?? map.stacks;
    if (!stacks) return;
    const cell = map.cell ?? 64;
    const ctx = this.ctx;

    /*
     * ---- Primeiro o que se vê pelos buracos do chão ----
     *
     * Debaixo da terra, uma casa sem chão não é o vazio: é o andar de baixo,
     * visto de cima. Sem isto a caverna aparecia cercada de preto onde o mapa
     * dele mostra lava — a lava está um andar abaixo.
     *
     * As camadas vêm da mais funda para a mais rasa e são pintadas ANTES do
     * andar em que se está, que depois passa por cima delas. O véu escuro no
     * meio é o que separa "onde eu piso" de "o que eu só enxergo": no client é
     * a mesma ideia, o andar de baixo entra mais escuro.
     */
    /*
     * As camadas de baixo vêm de dois lugares, e a ordem entre eles importa.
     *
     * Desde que as escadas passaram a trazer os andares vizinhos para dentro da
     * hunt, o andar logo abaixo costuma existir INTEIRO em `floors` — e o
     * arquivo deixou de gravar uma cópia dele em `fundos` (eram 152 KB de
     * duplicata na troll-cave). Quando a camada vem como `null`, é isso que ela
     * quer dizer: "o conteúdo está em `floors[z + profundidade]`".
     *
     * O que o arquivo deixou de fazer, o desenho passou a fazer: a máscara. Só
     * se pinta o andar de baixo onde o chão DAQUI não existe — que é o que a
     * palavra "buraco" quer dizer. Sem ela, o andar inteiro seria pintado
     * debaixo do que se está pisando: invisível na maioria das casas, e um
     * borrão nas casas de conteúdo transparente.
     */
    const camadas = this.camadasDeFundo(map, z);
    if (camadas.length) {
      // Ver `desenharFundoGuardado`: a mesma pintura, feita uma vez e copiada.
      if (this.semCacheDoFundo) this.pintarFundo(map, atlas, cell, time, stacks, z, camadas);
      else this.desenharFundoGuardado(map, atlas, cell, time, stacks, z, camadas);
    }

    /*
     * A folga da borda.
     *
     * Uma casa a mais em cima e à esquerda porque o sprite alto é ancorado no
     * canto de baixo: o que está na linha logo acima da tela ainda pinta
     * dentro dela. Sem a folga, paredes e árvores apareciam cortadas na borda
     * de cima ao andar para o norte.
     */
    const x0 = Math.max(0, Math.floor(this.camera.x / TILE) - 1);
    const y0 = Math.max(0, Math.floor(this.camera.y / TILE) - 1);
    const x1 = Math.min(map.width - 1, Math.ceil((this.camera.x + this.canvas.width) / TILE));
    const y1 = Math.min(map.height - 1, Math.ceil((this.camera.y + this.canvas.height) / TILE));

    this.desenharCamada(stacks, map, atlas, cell, time, null, 0, null, porCasa);
  }

  /*
   * ---- As casas por onde se enxerga o andar de baixo ----
   *
   * A máscara do fundo era só "o chão daqui não existe": casa com pilha vazia
   * mostra o de baixo, casa com qualquer coisa em cima tapa.
   *
   * Isso deixa de fora justamente o BURACO. A escada de descida e o alçapão têm
   * um item na casa — é o desenho da própria escada, e ele é vazado no meio,
   * feito para o andar de baixo aparecer por dentro dele. Com a casa contando
   * como chão fechado, o vazado ficava preto: um quadrado escuro com moldura no
   * meio da sala, que é o que se vê na foto do dono.
   *
   * Quem sabe quais casas são essas é o `mudanca`, a marca de travessia que o
   * exportador grava (o `TILESTATE_FLOORCHANGE_DOWN` do servidor). Ela já vinha
   * no arquivo e nunca tinha sido lida aqui.
   *
   * ---- E o buraco que não é buraco nenhum: a casa que não TAPA ----
   *
   * A máscara ainda errava um caso muito maior que a escada. Uma casa com um
   * osso e mais nada tem pilha, e não esconde nada: no Tibia o andar de baixo
   * aparece em volta do osso. Aqui ela contava como chão fechado, o andar de
   * baixo não era pintado, e o que sobrava era a cor de fundo da tela — um
   * quadrado preto com um osso dentro. Na muralha de Zao eram 2.594 casas; na
   * walking-pillar, 1.672 (e mais 4.896 de um chão que existe e é INVISÍVEL, o
   * item 20660, que o exportador agora nem põe na pilha).
   *
   * Quem responde é o `tapa` da paleta: o exportador mediu o pixel de cada
   * desenho e marcou os que enchem os 32x32 da casa (ver `cobreOTile`). Só o
   * PRIMEIRO da pilha conta — é o único desenhado sem a elevação de quem veio
   * antes, e portanto o único que cai exatamente em cima da casa.
   *
   * Guardado por andar: a conta é uma varredura do andar inteiro, e o desenho
   * roda sessenta vezes por segundo.
   */
  buracosDoAndar(map, z) {
    this._buracos ??= new Map();
    const chave = `${map.atlas ?? ''}:${z}`;
    const guardado = this._buracos.get(chave);
    if (guardado) return guardado;

    const marcas = map.floors?.[z]?.mudanca;
    /*
     * ---- Duas espécies de buraco, e elas se desenham diferente ----
     *
     * `escadas` são as casas de DESCER: a escada, o alçapão, o buraco com
     * degrau. `comuns` é o resto — chão que falta, e chão que não tapa.
     *
     * Eles ficaram separados quando o andar de baixo passou a entrar deslocado
     * (ver o desenho das camadas de fundo). O deslocamento é a perspectiva do
     * Tibia e vale para o CHÃO: o piso lá embaixo aparece uma casa para baixo e
     * para a direita, e é isso que faz o telhado cair em cima da parede que o
     * sustenta.
     *
     * A escada de descer não é chão visto de longe: é a casa PARA ONDE se
     * desce, e ela tem de mostrar o que está exatamente embaixo dela. Com o
     * deslocamento, a escada da Draken Walls passou a mostrar o mar que está
     * uma casa a noroeste dela, e a do minotauro mostrou meia parede. O dono viu
     * na base dele: "no andar de cima mostra o sqm da escada correto".
     */
    const escadas = new Set();
    // `DESCE = 1`, o mesmo bit do `ANDAR` do exportador. Só ele: as outras
    // marcas são de SUBIR, e por elas não se vê nada para baixo.
    for (const [indice, bits] of Object.entries(marcas ?? {})) {
      if (Number(bits) & 1) escadas.add(Number(indice));
    }
    /*
     * ---- E a escada de CLICAR, que mora noutra grade ----
     *
     * São duas coisas diferentes no arquivo, e é fácil achar que são uma:
     *
     *   `mudanca`  a rampa e o buraco em que se DESCE PISANDO. Bit 1 = desce.
     *   `escada`   a escada de mão, o alçapão, a escotilha — a que se USA
     *              CLICANDO. Valor 1 sobe, valor 2 desce (ver `usarEscadaCity`,
     *              em city.mjs, onde a conta é `tipo === 1 ? z - 1 : z + 1`).
     *
     * Só a de pisar estava aqui, e o dono viu a diferença na tela: "a escada de
     * passar andando ficou bom agora, mas a de click ainda mostra errado". A de
     * clicar caía na regra do chão comum e mostrava a casa a noroeste dela.
     *
     * Só o valor 2. A de subir não é buraco nenhum — por ela não se vê nada
     * para baixo, e tratá-la como buraco abriria um poço onde há degrau.
     */
    const deClicar = map.floors?.[z]?.escada;
    if (deClicar) {
      for (const [indice, tipo] of Object.entries(deClicar)) {
        if (Number(tipo) === 2) escadas.add(Number(indice));
      }
    }
    const comuns = new Set();
    const pilhas = map.floors?.[z]?.stacks ?? [];
    for (let i = 0; i < pilhas.length; i++) {
      if (!pilhas[i]?.length) continue;
      if (escadas.has(i)) continue;
      if (!map.palette[pilhas[i][0]]?.tapa) comuns.add(i);
    }
    const resposta = { comuns, escadas };
    this._buracos.set(chave, resposta);
    return resposta;
  }

  /**
   * O que se vê pelos buracos do chão deste andar, da mais rasa para a mais
   * funda. Cada camada é um conjunto de pilhas do mesmo tamanho do mapa.
   */
  camadasDeFundo(map, z) {
    const gravadas = map.fundos?.[z] ?? [];
    const camadas = [];
    /*
     * Quantas profundidades? A regra da base, e não um número escolhido aqui.
     *
     * Aqui esteve `4`, e antes dele `2`. Nenhum dos dois era leitura da base:
     * o 2 veio do "o Tibia mostra dois andares debaixo da terra" (certo, para
     * uma caverna) e o 4 veio do acampamento das amazonas, onde o 2 deixava
     * 80% da tela preta. Nenhum dos dois servia para a muralha de Zao, onde a
     * rota anda no z1 e o chão da cidade está SEIS andares abaixo.
     *
     * `andaresAbaixo` responde pela conta do `Game::updateSpectatorsVision`:
     * dois debaixo da terra, e ao ar livre até o nível do mar — uma distância
     * que depende do andar, que é justamente o que uma constante não sabe ser.
     *
     * O laço não PARA numa profundidade vazia, só a pula. Andar vazio é o caso
     * normal de uma plataforma: entre o alto da muralha e o chão da cidade há
     * andares de puro ar, e parar no primeiro deles é parar antes do chão.
     *
     * Cada camada só é pintada onde as de cima têm buraco (`buracos`), então
     * as camadas fundas custam desenho apenas onde havia preto — que é
     * exatamente onde elas são necessárias.
     */
    for (let profundidade = 1; profundidade <= andaresAbaixo(z); profundidade++) {
      const doArquivo = gravadas[profundidade - 1];
      if (doArquivo) {
        camadas.push(doArquivo);
        continue;
      }
      const andar = map.floors?.[z + profundidade];
      if (andar?.stacks) camadas.push(andar.stacks);
    }
    return camadas;
  }

  /**
   * O teto: os andares ACIMA que a tela mostra, do mais fundo para o mais alto.
   *
   * Debaixo da terra o Tibia mostra dois andares para cada lado (o
   * `MAP_LAYER_VIEW_LIMIT` do crystalserver), mas o de cima só aparece onde o
   * teto tem buraco — quem decide isso é a regra do `andar-visivel.mjs`, e a
   * resposta dela dentro de uma caverna fechada é "nenhum". É o que faz este
   * desenho ser seguro: o defeito que ele poderia causar, o chão do nível de
   * cima cobrindo o personagem, é exatamente o que a regra impede.
   *
   * A ordem é a do client: o andar mais fundo primeiro, e o mais alto por cima
   * dele. E tudo isto vem DEPOIS das criaturas — o que está acima da cabeça de
   * alguém é desenhado por cima dela, o dia em que estiver visível.
   */
  camadasDeTeto(map, z) {
    const player = this.entities.get('player');
    if (!map.floors || !player) return [];
    /*
     * Quais andares entram e com que deslocamento é conta do módulo
     * compartilhado — a mesma que o `tools/test-teto.mjs` confere. Aqui fica
     * só o desenho.
     */
    return camadasAcima(map, z, Math.round(player.x), Math.round(player.y));
  }

  /*
   * Uma camada de casas, na ordem da varredura.
   *
   * Separada de `drawMapa` porque o andar em que se está e os andares que se
   * enxergam por baixo são desenhados exatamente do mesmo jeito — muda só quem
   * vem antes de quem, e o véu entre eles.
   *
   * ---- Deslocamento e elevação ----
   *
   * Dois números que vêm do `appearances` do client e que estavam sendo
   * ignorados. Eles são o que faz mesa, balcão e armário terem volume:
   *
   *   `dx`/`dy` (shift)  desenham o sprite alguns pixels acima e à esquerda do
   *                      canto da casa. É do item, e vale só para ele.
   *
   *   `el` (elevation)   levanta o que for desenhado DEPOIS dele na mesma casa,
   *                      somando pilha acima até o teto de 24px. É o que põe a
   *                      garrafa em cima da mesa em vez de dentro dela.
   *
   * Sem os dois, `table` (2322, shift 8/8 e elevação 8) e `locker` (3499,
   * elevação 8) ficavam achatados no chão.
   */
  /**
   * Uma camada de casas.
   *
   * `porCasa(x, y)` é chamado depois de cada casa ficar pronta, e é o que
   * permite intercalar as CRIATURAS no meio do mapa em vez de desenhá-las todas
   * por cima dele no fim.
   *
   * Por CASA e não por linha — é o que o client faz: `Tile::draw` pinta os itens
   * da casa e SÓ ENTÃO a criatura que está nela. Por linha, a criatura saía
   * depois de todas as casas da fileira, inclusive das que estão a leste dela, e
   * passava por cima de coisa que devia estar na frente.
   */
  desenharCamada(stacks, map, atlas, cell, time, cobertura = null, deslocamento = 0, buracos = null, porCasa = null, restrito = null) {
    const ctx = this.ctx;
    const x0 = Math.max(0, Math.floor(this.camera.x / TILE) - 1);
    const y0 = Math.max(0, Math.floor(this.camera.y / TILE) - 1);
    const x1 = Math.min(map.width - 1, Math.ceil((this.camera.x + this.canvas.width) / TILE));
    const y1 = Math.min(map.height - 1, Math.ceil((this.camera.y + this.canvas.height) / TILE));

    /*
     * A tira só vale para a camada em que se ANDA — a que leva `porCasa` e não
     * leva máscara nem deslocamento. As camadas de fundo são recortadas casa a
     * casa pelos buracos, e a de teto é lida deslocada; nas duas a tira
     * desenharia outra coisa. Ver `tiraDaLinha`.
     */
    const podeUsarTira = !!porCasa && !cobertura && !deslocamento && !buracos && !restrito;

    for (let y = y0; y <= y1; y++) {
      const linha = y * map.width;
      const py = y * TILE - this.camera.y;

      /*
       * Linha sem criatura e sem objeto: copiada pronta, um comando no lugar de
       * cinquenta. Com criatura no meio ela cai no laço de sempre, porque é ali
       * que a ordem entre a casa e o bicho é decidida.
       *
       * `porCasa` não é chamado aqui de propósito: ele existe para intercalar
       * criatura e objeto, e esta linha não tem nenhum dos dois.
       */
      if (podeUsarTira && !this.linhasVivas?.has(y)) {
        // As pontas SOBEM para a grade de blocos: a chave da tira não depende de onde está a câmera.
        this.copiarTiras(map, atlas, cell, y, x0 - (x0 % BLOCO_DA_TIRA), Math.min(map.width - 1, x1 - (x1 % BLOCO_DA_TIRA) + BLOCO_DA_TIRA - 1), stacks, time, py);
        continue;
      }

      if (podeUsarTira && !this.semPedacos && this.desenharLinhaEmPedacos(map, atlas, cell, y, x0, x1, stacks, time, py, porCasa)) {
        continue;
      }

      for (let x = x0; x <= x1; x++) {
        /*
         * A casa DESENHADA é `x, y`; a casa LIDA pode ser outra.
         *
         * O andar de cima entra deslocado: a casa da tela que mostra `x, y`
         * daqui mostra `x+1, y+1` do nível de cima (o `offset` do
         * `GetMapDescription`, ver `andar-visivel.mjs`). Sem isto a pedra do
         * teto cairia em cima do chão que ela cobre, e não da parede que a
         * sustenta.
         */
        /*
         * O `>= 0` é do andar de BAIXO, que entra com deslocamento NEGATIVO.
         * Enquanto só o teto se deslocava, bastava conferir o teto do mapa; com
         * um número negativo, `(y-1) * width + (x-1)` na primeira linha cai na
         * ÚLTIMA do mapa em vez de cair fora — a borda de cima apareceria
         * costurada com a de baixo, e ninguém adivinharia de onde veio.
         */
        const dy = y + deslocamento;
        const dx = x + deslocamento;
        const lido = deslocamento
          ? (dy >= 0 && dx >= 0 && dy < map.height && dx < map.width
              ? dy * map.width + dx
              : -1)
          : linha + x;
        const pilha = lido < 0 ? null : stacks[lido];
        if (!pilha?.length) {
          // Casa sem pilha também entrega a criatura dela: chão faltando não é
          // motivo para o bicho sumir da tela.
          porCasa?.(x, y);
          continue;
        }
        // Camada de baixo: só aparece onde o chão de cima tem buraco — a casa
        // vazia, ou a que É um buraco (escada de descida, alçapão). Ver
        // `buracosDoAndar`.
        /*
         * `restrito`: esta passada desenha SÓ estas casas. É o que deixa a casa
         * de descer ser desenhada numa passada própria, com outro deslocamento
         * e depois do véu, sem repintar a tela inteira.
         */
        if (restrito && !restrito.has(linha + x)) continue;
        if (cobertura && cobertura[linha + x]?.length && !buracos?.has(linha + x)) continue;
        const px = x * TILE - this.camera.x;
        let altura = 0;
        for (const index of pilha) {
          const entry = map.palette[index];
          if (!entry) continue;
          // A animação escolhe QUAL quadro, nunca ONDE ele entra na pilha.
          let ax = entry.ax;
          let ay = entry.ay;
          if ((entry.cells?.length ?? 1) > 1) {
            [ax, ay] = paletteCell(entry, time);
            /*
             * Até quando este quadro vale. O desenho guarda o MENOR de todos os
             * sprites visíveis: é o instante em que a tela deixa de estar em
             * dia, e é o que permite ao laço dormir até lá. Ver
             * `podePularQuadro`.
             */
            const resto = restoDoQuadro(entry, time);
            if (resto < this.trocaDeAnimacao) this.trocaDeAnimacao = resto;
          }
          ctx.drawImage(
            atlas.image,
            ax + (cell - entry.w), ay + (cell - entry.h), entry.w, entry.h,
            px - (entry.w - TILE) - (entry.dx ?? 0) - altura,
            py - (entry.h - TILE) - (entry.dy ?? 0) - altura,
            entry.w, entry.h
          );
          if (entry.el) altura = Math.min(TETO_DA_ELEVACAO, altura + entry.el);
        }
        porCasa?.(x, y);
      }
    }
  }

  /**
   * Copia as casas `a..b` da linha `y` em tiras de blocos FIXOS.
   *
   * "FPS cai a quase zero andando." Medido (cidade e caçada, celular emulado,
   * CPU 4x): a chave da tira levava a coluna da ESQUERDA DA CÂMERA, então a cada
   * casa andada na horizontal as ~15 linhas visíveis ganhavam chave nova e eram
   * todas refeitas no mesmo quadro — 1283 `drawImage` num quadro só (390 tiras
   * refeitas em 12 s de caminhada), mais caro que desenhar casa a casa, que era
   * o que a tira queria evitar.
   *
   * Agora a linha é cortada em blocos de `BLOCO_DA_TIRA` colunas ALINHADOS À
   * GRADE DO MAPA (0-7, 8-15...). Andar reaproveita os blocos que continuam na
   * tela e só constrói o que entrou: ~8 casas por linha a cada 8 casas andadas,
   * em vez da linha inteira a cada casa. A ordem de desenho é a mesma (os
   * blocos saem da esquerda para a direita e o transbordo de um cobre o
   * anterior, exatamente como os pedaços de `desenharLinhaEmPedacos`).
   */
  copiarTiras(map, atlas, cell, y, a, b, stacks, time, py) {
    const ctx = this.ctx;
    for (let de = a; de <= b; ) {
      const ate = Math.min(b, de - (de % BLOCO_DA_TIRA) + BLOCO_DA_TIRA - 1);
      const tira = this.tiraDaLinha(map, atlas, cell, y, de, ate, stacks, time);
      ctx.drawImage(tira.lona, de * TILE - this.camera.x - tira.transbordo.x, py - tira.transbordo.y);
      /*
       * A tela precisa saber quando o desenho dela vence, senão o laço
       * dormiria com a água parada. Ver `podePularQuadro`.
       *
       * O que vale é `valeAte - agora`, e NÃO o `resto` guardado: `resto` é o
       * que faltava quando a tira nasceu. Num acerto de cache 300 ms depois,
       * devolver o `resto` velho diria "não muda nada nos próximos 500 ms"
       * quando a troca é em 200 — e `trocaDeAnimacao` dormiria por cima
       * dela. Era um congelamento de animação que só aparecia andando devagar.
       */
      const resto = tira.valeAte === Infinity ? Infinity : tira.valeAte - time;
      if (resto < this.trocaDeAnimacao) this.trocaDeAnimacao = resto;
      de = ate + 1;
    }
  }

  /*
   * ---- A linha COM criatura, em pedaços prontos ----
   *
   * "O que ainda pesa: ... o mapa sendo redesenhado a cada quadro." Medido numa
   * caçada: as linhas sem ninguém já saíam prontas (~16 comandos por quadro), e
   * as linhas com criatura ou item no chão saíam casa a casa — ~62 comandos
   * por quadro, a ~34 µs cada no Chrome do dono (ver `tiraDaLinha`).
   *
   * A ordem de desenho numa linha é: casa, quem está nela, a casa seguinte... O
   * que importa é que a casa à DIREITA de uma criatura seja desenhada DEPOIS
   * dela — o sprite alto transborda para a esquerda e passa na frente do bicho.
   * Isso não exige desenhar casa a casa: basta cortar a linha nas colunas onde
   * há alguém. O pedaço até a coluna (inclusive), quem está nela, o pedaço
   * seguinte... Cada pedaço é uma tira pronta (`tiraDaLinha` com as pontas do
   * pedaço), e o transbordo dele cobre a criatura à esquerda — que é o que o
   * desenho casa a casa fazia.
   *
   * O pedaço só é refeito quando a criatura muda de casa (a ponta muda, a chave
   * muda); entre um passo e outro, que é a maior parte dos quadros, ele é só
   * copiado. `this.semPedacos` desliga isto, para comparar os dois desenhos.
   */
  desenharLinhaEmPedacos(map, atlas, cell, y, x0, x1, stacks, time, py, porCasa) {
    const vivas = this.colunasVivas?.get(y);
    if (!vivas?.size) return false;
    const colunas = [...vivas].filter((x) => x >= x0 && x <= x1).sort((a, b) => a - b);
    const ctx = this.ctx;
    const copiar = (a, b) => this.copiarTiras(map, atlas, cell, y, a, b, stacks, time, py);
    // As pontas da linha (e só elas) seguem a câmera: sobem para a grade de blocos, como em `desenharCamada`.
    let inicio = x0 - (x0 % BLOCO_DA_TIRA);
    for (const x of colunas) {
      copiar(inicio, x);
      porCasa(x, y);
      inicio = x + 1;
    }
    const fim = Math.min(map.width - 1, x1 - (x1 % BLOCO_DA_TIRA) + BLOCO_DA_TIRA - 1);
    if (inicio <= fim) copiar(inicio, fim);
    return true;
  }

  /*
   * ---- Quanto um sprite transborda da casa dele ----
   *
   * O desenho ancora no canto de BAIXO e à DIREITA: um sprite de 64px numa casa
   * de 32 sobra 32 para a esquerda e para cima, e `dx`/`dy` (o shift do item) e
   * a elevação empurram mais um tanto para o mesmo lado. Para a direita e para
   * baixo ele nunca passa da casa.
   *
   * A tira de uma linha precisa de margem exatamente desse tamanho, senão o
   * pedaço que sobra sai cortado — e sairia cortado justamente na parede alta,
   * que é o que mais transborda.
   *
   * Medido da paleta, e não chutado: um número folgado desperdiça memória em
   * toda tira, e um número curto corta o desenho.
   */
  transbordoDaPaleta(map) {
    const chave = `${map.atlas ?? ''}`;
    this._transbordo ??= new Map();
    const guardado = this._transbordo.get(chave);
    if (guardado) return guardado;

    let x = 0;
    let y = 0;
    for (const entry of map.palette ?? []) {
      if (!entry) continue;
      x = Math.max(x, (entry.w ?? TILE) - TILE + (entry.dx ?? 0));
      y = Math.max(y, (entry.h ?? TILE) - TILE + (entry.dy ?? 0));
    }
    // A elevação soma por cima de tudo, e é a mesma nos dois eixos.
    const transbordo = { x: x + TETO_DA_ELEVACAO, y: y + TETO_DA_ELEVACAO };
    this._transbordo.set(chave, transbordo);
    return transbordo;
  }

  /*
   * ---- Uma linha de casas, desenhada UMA vez e depois só copiada ----
   *
   * ================ por que isto existe ================
   *
   * "pq na cidade e tao pouco fps"
   *
   * Medido no navegador do dono, com 26 pessoas na praça: o quadro leva 44,3 ms
   * e `drawMapa` responde por 834 dos 918 comandos de desenho — 91%.
   *
   * E o custo é do NÚMERO de comandos, não do que eles pintam. A prova foi
   * desenhar o mapa duas e três vezes:
   *
   *     1x  44,3 ms      2x  75,9 ms      3x  122,0 ms
   *
   * Perfeitamente linear. O Chrome dele roda com
   * `Canvas out-of-process rasterization` ligado, e aí cada `drawImage`
   * atravessa a fronteira entre dois processos: ~34 µs por comando, não importa
   * o tamanho do que se copia. Por isso nada do que se tentou antes mudou nada
   * — nem janela menor, nem textura menor, nem menos pixel.
   *
   * Se o preço é por COMANDO, o conserto é mandar menos comandos. Uma linha de
   * 25 casas com 2,2 itens cada são 55 comandos; a mesma linha copiada de uma
   * imagem pronta é UM.
   *
   * ================ e a ordem de desenho continua a mesma ================
   *
   * Esta é a parte que não pode dar errado. A ordem (casa a casa, de cima para
   * baixo e da esquerda para a direita, com a criatura logo depois da casa
   * dela) é o que faz o pilar passar na frente do boneco e o telhado cobrir o
   * bicho.
   *
   * A tira preserva isso porque ela é a MESMA varredura, só que assada antes:
   * dentro dela a ordem entre as casas é idêntica, e ela é copiada no exato
   * ponto da sequência em que aquela linha seria desenhada. O transbordo para
   * cima vai junto na imagem e cobre a linha de cima ao ser copiado — que é o
   * que acontecia antes.
   *
   * O que NÃO pode virar tira é a linha que tem criatura ou objeto no meio:
   * ali a ordem se quebraria (a criatura sairia na frente das casas a leste
   * dela, na mesma linha). Essas continuam desenhadas casa a casa, como sempre
   * foram — ver `linhasVivas`, em `render`.
   *
   * ================ quando a tira é jogada fora ================
   *
   * Quando a coluna da esquerda muda (a câmera andou de lado), quando o mapa ou
   * o andar mudam, e quando a animação dela vence — água e tocha trocam de
   * quadro, e a tira guarda até quando o desenho dela vale (`valeAte`).
   *
   * Andar para o NORTE ou para o SUL não joga nada fora: a chave leva o número
   * da linha no mapa, então as linhas que continuam na tela continuam válidas e
   * só a que entrou é desenhada.
   */
  tiraDaLinha(map, atlas, cell, y, x0, x1, stacks, time) {
    const z = this.snapshot?.z ?? 0;
    const chave = `${map.atlas ?? ''}|${z}|${y}|${x0}|${x1}`;
    const guardada = this.tiras.get(chave);
    if (guardada && time < guardada.valeAte) {
      // Vai para o fim da fila (a despejada é a mais antiga, não a que está na tela) — mas só de vez em
      // quando: reordenar um Map a cada cópia, ~75 por quadro, custava mais que o ganho.
      if (time - guardada.vistaEm > 2000) {
        guardada.vistaEm = time;
        this.tiras.delete(chave);
        this.tiras.set(chave, guardada);
      }
      return guardada;
    }

    const transbordo = this.transbordoDaPaleta(map);
    const largura = (x1 - x0 + 1) * TILE + transbordo.x;
    const altura = TILE + transbordo.y;

    // Reaproveita a lona da tira vencida: alocar canvas a cada troca de quadro
    // de animação seria trocar um desperdício por outro.
    const lona = guardada?.lona ?? document.createElement('canvas');
    if (lona.width !== largura || lona.height !== altura) {
      lona.width = largura;
      lona.height = altura;
    }
    const pincel = lona.getContext('2d');
    pincel.imageSmoothingEnabled = false;
    pincel.clearRect(0, 0, largura, altura);

    /*
     * Dentro da tira, a casa `x0` começa em `transbordo.x` e a linha em
     * `transbordo.y` — é a margem que recebe o que sobra dos sprites altos.
     */
    let resto = Infinity;
    const linha = y * map.width;
    for (let x = x0; x <= x1; x++) {
      const pilha = stacks[linha + x];
      if (!pilha?.length) continue;
      const px = (x - x0) * TILE + transbordo.x;
      const py = transbordo.y;
      let elevacao = 0;
      for (const index of pilha) {
        const entry = map.palette[index];
        if (!entry) continue;
        let ax = entry.ax;
        let ay = entry.ay;
        if ((entry.cells?.length ?? 1) > 1) {
          [ax, ay] = paletteCell(entry, time);
          const quanto = restoDoQuadro(entry, time);
          if (quanto < resto) resto = quanto;
        }
        pincel.drawImage(
          atlas.image,
          ax + (cell - entry.w), ay + (cell - entry.h), entry.w, entry.h,
          px - (entry.w - TILE) - (entry.dx ?? 0) - elevacao,
          py - (entry.h - TILE) - (entry.dy ?? 0) - elevacao,
          entry.w, entry.h
        );
        if (entry.el) elevacao = Math.min(TETO_DA_ELEVACAO, elevacao + entry.el);
      }
    }

    const tira = { lona, transbordo, resto, valeAte: resto === Infinity ? Infinity : time + resto, vistaEm: time };
    /*
     * A chave leva a coluna da esquerda, então andar de lado cria tiras novas e
     * as velhas ficam para trás. Quinze linhas cabem numa tela; o teto é a rede
     * de proteção para uma caminhada longa, e esvaziar é mais barato (e mais
     * óbvio) do que manter fila de descarte para uma coisa que se refaz sozinha.
     */
    // 400 e não 120: as linhas com criatura agora também viram tiras, em
    // pedaços (ver `desenharLinhaEmPedacos`), e cada passo de bicho cria um par novo.
    if (this.tiras.size > LIMITE_DE_TIRAS) {
      // Despeja as mais antigas (um quarto), e não tudo: esvaziar tudo refazia a tela inteira de uma vez.
      let sobra = LIMITE_DE_TIRAS >> 2;
      for (const velha of this.tiras.keys()) {
        if (sobra-- <= 0) break;
        this.tiras.delete(velha);
      }
    }
    this.tiras.delete(chave);
    this.tiras.set(chave, tira);
    return tira;
  }

  /**
   * O andar de cima, quando há buraco no teto. Ver `camadasDeTeto`.
   *
   * Devolve `true` quando de fato pintou alguma coisa. Quem chama usa isso para
   * decidir se precisa repintar o personagem por cima — e não precisar é o caso
   * comum: a céu aberto, ou num andar sem nada acima, `camadasDeTeto` devolve
   * lista vazia e não há teto nenhum para cobrir ninguém.
   */
  /*
   * ---- O telhado inteiro numa imagem só ----
   *
   * A contagem por casa mostrou o telhado como o MAIOR gasto que restava: até
   * 283 comandos de desenho por quadro embaixo dos telhados da cidade, contra 0
   * no lugar de nascer. Era por isso que a cidade continuava caindo "em alguns
   * lugares" depois das tiras — as tiras nunca valeram para o telhado.
   *
   * E o telhado é o caso mais fácil que existe, não o mais difícil: ele é
   * desenhado DEPOIS de todas as criaturas, inteiro, sem nada se intercalar
   * nele. Não há ordem a preservar entre ele e mais ninguém. Então ele não
   * precisa de uma tira por linha: cabe numa imagem só, e o quadro passa a
   * gastar UM comando no lugar de 283.
   *
   * ---- A folga em volta, que é o que faz valer andando ----
   *
   * A imagem é desenhada alinhada na casa e com `MARGEM_DO_TETO` casas de folga
   * de cada lado. Enquanto a tela couber dentro dela, andar não refaz nada —
   * só desliza. Sem a folga, atravessar uma casa já obrigaria a refazer tudo, e
   * andar é exatamente quando o dono sentiu o tranco.
   *
   * A folga também é o que garante que nada sai cortado: o sprite mais alto
   * transborda 56px para cima e para a esquerda, e a folga é de 128px.
   */
  drawTeto(time) {
    const map = this.snapshot?.map;
    if (!map?.palette || !map.floors) return false;
    const atlas = image(`/gamedata/sprites/${map.atlas}.png`);
    if (!atlas.ready) return false;

    const z = this.snapshot.z ?? 0;
    const camadas = this.camadasDeTeto(map, z);
    if (!camadas.length) return false;

    /*
     * UMA IMAGEM POR CAMADA, e não uma para o telhado todo.
     *
     * Medido: com uma imagem só, uma tocha acesa no telhado de UM andar fazia os
     * três serem refeitos juntos, e o ganho dentro das casas caía para 1,2x. Cada
     * andar guardado por conta própria deixa a tocha derrubar só o andar dela.
     *
     * A ordem continua exata de graça: no código antigo cada camada já era
     * desenhada INTEIRA antes da seguinte, nunca intercalada. Então copiar as
     * imagens na mesma ordem dá o mesmo resultado, pixel a pixel.
     */
    this.tetosGuardados ??= new Map();
    for (const { andar, deslocamento } of camadas) {
      const chave = `${map.atlas ?? ''}|${z}|${andar}:${deslocamento}`;
      const g = this.tetosGuardados.get(chave);

      /*
       * Serve a imagem de antes? Ela tem de cobrir a tela INTEIRA de agora — por
       * isso a conta é com o tamanho guardado nela, e não com o que a folga de
       * hoje daria: a folga muda conforme aquele andar anime ou não.
       */
      const cabeDentro = g &&
        this.camera.x >= g.origemX && this.camera.y >= g.origemY &&
        this.camera.x + this.canvas.width <= g.origemX + g.lona.width &&
        this.camera.y + this.canvas.height <= g.origemY + g.lona.height;
      if (g && cabeDentro && time < g.valeAte) {
        this.ctx.drawImage(g.lona, g.origemX - this.camera.x, g.origemY - this.camera.y);
        // `valeAte - agora`, e não o resto de quando a imagem nasceu. Ver a
        // mesma conta em `desenharCamada`.
        const resto = g.valeAte === Infinity ? Infinity : g.valeAte - time;
        if (resto < this.trocaDeAnimacao) this.trocaDeAnimacao = resto;
        continue;
      }

      /*
       * A folga de AGORA sai do que a imagem anterior DESTE andar mostrou: se ela
       * venceu por animação, tem tocha ali e a folga encolhe — folga grande é
       * área a mais paga a cada vencimento, e foi o que me pegou na primeira
       * versão. Erra no máximo uma vez, ao chegar num lugar novo, e se corrige.
       */
      const folga = (g && g.resto !== Infinity ? FOLGA_CURTA_DO_TETO : FOLGA_LARGA_DO_TETO) * TILE;
      const largura = this.canvas.width + folga * 2;
      const altura = this.canvas.height + folga * 2;
      const origemX = Math.floor(this.camera.x / TILE) * TILE - folga;
      const origemY = Math.floor(this.camera.y / TILE) * TILE - folga;
      const lona = g?.lona ?? document.createElement('canvas');
      if (lona.width !== largura || lona.height !== altura) {
        lona.width = largura;
        lona.height = altura;
      }
      const pincel = lona.getContext('2d');
      pincel.imageSmoothingEnabled = false;
      pincel.clearRect(0, 0, largura, altura);

      /*
       * A camada é desenhada pelo MESMO `desenharCamada` de sempre — só com o
       * pincel, a câmera e a tela trocados por baixo. Reescrever o laço aqui
       * seria manter duas cópias da regra de deslocamento e de elevação, e elas
       * iriam divergir.
       */
      const ctxAntes = this.ctx;
      const cameraAntes = this.camera;
      const canvasAntes = this.canvas;
      const trocaAntes = this.trocaDeAnimacao;
      this.trocaDeAnimacao = Infinity;
      try {
        this.ctx = pincel;
        this.camera = { x: origemX, y: origemY };
        this.canvas = lona;
        this.desenharCamada(map.floors[andar].stacks, map, atlas, map.cell ?? 64, time, null, deslocamento);
      } finally {
        this.ctx = ctxAntes;
        this.camera = cameraAntes;
        this.canvas = canvasAntes;
      }
      // O prazo da imagem é o do sprite animado mais apressado que entrou nela.
      const resto = this.trocaDeAnimacao;
      this.trocaDeAnimacao = Math.min(trocaAntes, resto);

      this.tetosGuardados.set(chave, {
        lona, origemX, origemY, resto,
        valeAte: resto === Infinity ? Infinity : time + resto,
      });
      this.ctx.drawImage(lona, origemX - this.camera.x, origemY - this.camera.y);
    }
    /*
     * Rede de proteção para quem atravessa a cidade inteira: cada andar de cada
     * mapa deixa uma lona para trás. Passar de doze é sinal de que o personagem
     * andou muito, e refazer é mais barato do que manter fila de descarte.
     */
    if (this.tetosGuardados.size > 12) this.tetosGuardados.clear();
    return true;
  }

  /*
   * ---- O teto encosta no sprite do personagem na casa `x, y`? ----
   *
   * O boneco (64px) ocupa a casa dele e as de cima e da esquerda; um desenho do
   * teto pintado na casa da TELA `sx, sy` ocupa `sx-1..sx` e `sy-1..sy`. Então
   * as casas de tela que podem tapá-lo são as nove em volta dele. Cada uma é
   * lida no andar de cima com o deslocamento da camada, como em `drawTeto`.
   */
  tetoCobre(x, y) {
    const map = this.snapshot?.map;
    if (!map?.floors) return false;
    const z = this.snapshot.z ?? 0;
    for (const { andar, deslocamento } of this.camadasDeTeto(map, z)) {
      const pilhas = map.floors[andar]?.stacks;
      if (!pilhas) continue;
      for (let sy = y - 1; sy <= y + 1; sy++) {
        for (let sx = x - 1; sx <= x + 1; sx++) {
          const lx = sx + deslocamento;
          const ly = sy + deslocamento;
          if (lx < 0 || ly < 0 || lx >= map.width || ly >= map.height) continue;
          if (pilhas[ly * map.width + lx]?.length) return true;
        }
      }
    }
    return false;
  }

  /*
   * O que pisca nos mapas GERADOS, que não têm pilha.
   *
   * Nos mapas de paleta isto não existe mais: lá o animado é desenhado no lugar
   * dele dentro da pilha, por `drawMapa`.
   */
  drawAnimated(time) {
    const ctx = this.ctx;
    for (const item of this.animated) {
      const px = item.x * TILE - this.camera.x;
      const py = item.y * TILE - this.camera.y;
      if (px < -64 || py < -64 || px > this.canvas.width || py > this.canvas.height) continue;
      drawItem(ctx, item.id, px, py, { time });
    }
  }

  /**
   * Uma criatura.
   *
   * `semNome` existe para o único caso em que a mesma criatura é desenhada duas
   * vezes: o personagem, repintado por cima do teto. O NOME não vai no canvas do
   * mapa — ele vai numa camada de texto própria —, então repintá-lo empilharia
   * dois traçados no mesmo lugar. Foi assim que o boneco virou um borrão escuro.
   */
  drawEntity(entity, now, semNome = false) {
    const pos = this.position(entity, now);
    /*
     * ---- O PERSONAGEM NA VIAGEM PELO PORTAL (`portal-ciclo.mjs`) ----
     * O portal abre na casa AO LADO dele. Na saída ele fica virado para o portal e, no fim da abertura, anda a casa para dentro (e some
     * lá); na chegada ele surge no portal e anda a casa até o lugar dele (a casa de verdade, a do servidor). O desenho anda junto
     * (`passo`), com a passada de quem anda; a posição dele não muda.
     */
    const viagem = entity.isPlayer ? this.viagemDoPersonagem(now) : null;
    const andando = pos.walking || !!viagem?.andando;
    const px = Math.round(pos.x - this.camera.x + (viagem?.dx ?? 0));
    const py = Math.round(pos.y - this.camera.y + (viagem?.dy ?? 0));
    if (px < -64 || py < -64 || px > this.canvas.width + 64 || py > this.canvas.height + 64) return;

    const ctx = this.ctx;
    const info = outfitInfo(entity.look);
    // O jogador tem um grupo só para andar; o monstro anima com o único grupo
    // que tem. Sem esse fallback a criatura desliza pelo chão sem mexer as patas.
    const group = (andando && info?.groups?.[1]) || info?.groups?.[0];
    const frames = group?.frames ?? 1;

    // Um ciclo completo de animação por passo: é isso que dá o andar do Tibia.
    // Parado, a criatura continua respirando no ritmo do próprio appearance —
    // 260ms fixos deixavam os outfits animados quase três vezes mais lentos.
    // Parado, a fase da caminhada zera: quem volta a andar começa a passada do
    // começo, e não de onde parou meia hora atrás.
    if (!andando) entity.faseEm = null;
    const frame = frames <= 1 ? 0 : andando ? quadroDeCaminhada(entity, frames, now) : idleFrame(group, now);

    /*
     * ---- A criatura que nao tem outfit ----
     *
     * O report: "o percht queen e o braiin head ta sem sprite".
     *
     * Ela existe no `monster.lua` do servidor dele: bicho com `lookTypeEx` em
     * vez de `lookType`, ou seja, desenhado com o sprite de um ITEM. E comum
     * para o que nao anda — uma cabeca presa na parede, um trono, uma estatua
     * viva. `outfitInfo(0)` nao acha nada, `drawCreature` devolve false, e o
     * boss lutava invisivel.
     *
     * Um sprite de item nao tem direcao nem passada, entao os quadros acima
     * nao entram: o unico movimento e o do proprio item, e quem o toca e o
     * `time`. Tudo o mais — moldura de alvo, nome, barra de vida — continua
     * valendo, e e por isso que este e um `if` no meio e nao uma saida cedo.
     */
    /*
     * ---- A ABSORÇÃO no portal de saída (`portal-ciclo.mjs`) ----
     * No fechamento do portal o personagem some junto, encolhendo para o centro da casa — a sensação de ser puxado para dentro. O nome
     * dele sai enquanto o portal está aberto: a barra do portal fica no lugar.
     */
    // (Na CHEGADA, o contrário: ele surge do portal — e o nome volta quando a barra sai.)
    const chegando = entity.isPlayer && !this.portalDeSaida && this.portalDeChegada ? this.quadroDaChegadaAgora(now) : null;
    const absorcao = entity.isPlayer && this.portalDeSaida ? this.quadroDoPortal(now)?.personagem : chegando?.personagem ?? null;
    const semONome = !!(entity.isPlayer && this.portalDeSaida) || chegando?.fase === 'surgindo' || chegando?.fase === 'saindo';
    if (absorcao && absorcao.alpha <= 0.01) return;
    if (absorcao) {
      ctx.save();
      ctx.globalAlpha *= absorcao.alpha;
      const cx = px + TILE / 2;
      const cy = py + TILE / 2;
      ctx.translate(cx, cy);
      ctx.scale(absorcao.escala, absorcao.escala);
      ctx.translate(-cx, -cy);
    }
    if (!info && entity.lookItem) {
      drawItem(ctx, entity.lookItem, px, py, { time: now });
    } else {
      drawCreature(
        ctx,
        {
          look: entity.look,
          colors: entity.colors,
          dir: viagem?.dir ?? entity.dir,
          frame,
          walking: andando,
          mount: entity.mount,
          addons: entity.addons,
        },
        px,
        py
      );
    }
    if (absorcao) ctx.restore();
    if (semONome) return;

    // Moldura vermelha em cima do alvo, como o quadrado de ataque do client.
    if (this.targetUid != null && entity.uid === this.targetUid) {
      ctx.strokeStyle = '#ff2020';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      ctx.strokeStyle = '#7a0000';
      ctx.strokeRect(px - 0.5, py - 0.5, TILE + 1, TILE + 1);
    }

    if (semNome || !entity.name) return;
    // Coordenadas do mundo: quem converte para a tela é a camada de texto.
    this.drawNameplate(entity, pos.x + TILE / 2, pos.y);
  }

  /**
   * Nome, barra de vida e números de dano vão para um canvas próprio, na
   * resolução real da tela. O mapa continua em 1:1 e ampliado por número
   * inteiro (é o que mantém o pixel art nítido), mas texto ampliado assim fica
   * serrilhado — daí a segunda camada.
   */
  setupOverlay() {
    this.overlay = document.createElement('canvas');
    this.overlay.id = 'map-overlay';
    this.canvas.parentNode.insertBefore(this.overlay, this.canvas.nextSibling);
    this.octx = this.overlay.getContext('2d');
    // O nameplate dos jogadores (esfera de nível, nome, vida e mana): ver `nameplate-do-jogador.mjs`.
    this.nameplates = new NameplateDoJogador({ criarTela: telaFora });
  }

  /*
   * Encaixa uma coordenada na grade de pixels FÍSICOS da tela.
   *
   * O nome era desenhado em `screen.x` cru, e `screen.x` é fracionário: o zoom
   * do mapa é o fator que enche a tela (1,83 numa janela de 1680), e a posição
   * do boneco é interpolada entre dois tiles. Texto num x quebrado é rasterizado
   * entre dois pixels — o navegador mistura as duas colunas e a letra sai
   * embaçada. Parado, o número acabava caindo redondo e o nome ficava nítido;
   * andando, ele mudava a cada quadro. É exatamente o "borra quando anda".
   *
   * A grade é a de pixels físicos e não a de CSS: o overlay desenha com
   * `setTransform(ratio, ...)`, então uma coordenada CSS inteira ainda pode cair
   * no meio de um pixel físico numa tela com escala 1,25 ou 1,5.
   */
  nitido(valor) {
    const ratio = this.overlayRatio();
    return Math.round(valor * ratio) / ratio;
  }

  /*
   * ---- Teto de DPR só no overlay ----
   *
   * O overlay (nomes/texto) é redesenhado INTEIRO todo quadro — em DPR 3 num
   * celular isso mede 23 FPS e até 40 "long tasks" em 20s (o pior, 187ms); em
   * DPR 2, 36 FPS e 1 long task (medido com `tools/perf/perfil-cliente.mjs`).
   * O canvas PRINCIPAL do jogo não usa `devicePixelRatio` (pixel art em
   * resolução fixa, ampliada por CSS) — só este overlay lê o ratio do
   * dispositivo, e por isso só ele precisa de teto. Texto em DPR 2 numa tela
   * DPR 3 continua nítido a olho (é justamente o que os números acima
   * sustentam) — por isso o teto, e não simplesmente baixar para 1.
   *
   * Um helper só, chamado em TODO lugar que hoje lê `window.devicePixelRatio`
   * para o overlay (`resizeOverlay`, aqui, e as duas chamadas de
   * `placaDoNome`/`placaDeTexto`) — um teto pela metade (só aqui, por
   * exemplo) desalinharia o `setTransform` do canvas com o ratio guardado na
   * CHAVE do cache das placas de texto, e o texto saía borrado ou cortado.
   */
  overlayRatio() {
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  /*
   * ---- Limpar o overlay INTEIRO, custe o que custar o zoom ----
   *
   * Isto era `clearRect(0, 0, overlay.width, overlay.height)` e estava errado
   * por uma troca de unidade: `overlay.width` é pixel FÍSICO, e o `clearRect`
   * roda nas coordenadas do transform — que é `setTransform(ratio, ...)`. A
   * área apagada acabava sendo `width × ratio` pixels físicos.
   *
   * Com `ratio >= 1` isso limpa mais do que precisa e ninguém nota. Com
   * `ratio < 1` — navegador reduzido no Ctrl+−, ou uma escala de Windows que
   * caia abaixo de 1 — a faixa da DIREITA e a de BAIXO nunca eram limpas: tudo
   * que fosse pintado ali ficava, quadro após quadro. O sintoma era uma coluna
   * de nomes empilhados na borda direita, cada um de um instante diferente, que
   * não sumia nem trocando de personagem — porque não era dado, era tinta
   * acumulada.
   *
   * Zerar o transform antes de limpar tira a unidade da conta: `clearRect` no
   * espaço do dispositivo apaga a tela toda, com qualquer `ratio`.
   */
  limparOverlay() {
    const ctx = this.octx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    ctx.restore();
  }

  resizeOverlay() {
    const ratio = this.overlayRatio();
    this.overlay.width = Math.ceil(window.innerWidth * ratio);
    this.overlay.height = Math.ceil(window.innerHeight * ratio);
    this.overlay.style.width = `${window.innerWidth}px`;
    this.overlay.style.height = `${window.innerHeight}px`;
    this.octx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  /** Coordenada do mundo (em pixels de tile) para pixel de tela. */
  toScreen(x, y) {
    return {
      x: (x - this.camera.x) * this.zoom + (this.offset?.x ?? 0),
      y: (y - this.camera.y) * this.zoom + (this.offset?.y ?? 0),
    };
  }

  /**
   * Nome e barra de vida no formato do client: barra de 27x4 com moldura preta
   * e o nome logo acima, na mesma cor da barra — no Tibia o nome escurece junto
   * com a vida da criatura.
   */
  /*
   * ---- O nome de um objeto do cenário ----
   *
   * Hoje: o `Exercise Dummy` da cidade.
   *
   * MESMA fonte e mesmo contorno dos nomes de criatura — o dono pediu depois de
   * ver a primeira versão: ela usava a serifa dos títulos, que a doze pixels em
   * cima de um chão claro simplesmente não se lê. Nome no mapa é para ser lido
   * de relance; a fonte bonita é para título de janela, onde há tamanho.
   *
   * O que muda é a COR e o brilho. Azul porque ele não é bicho nem jogador: o
   * verde diria "isto anda e pode ser atacado", e ele não faz nem uma coisa nem
   * outra. O halo é o efeito, e vem por baixo do contorno preto — assim ele
   * acende em volta da letra sem borrar a forma dela.
   *
   * Vai no canvas de TEXTO, e não no do mapa: lá ele seria coberto pelo próximo
   * sprite alto da linha de baixo, e o nome sumiria justamente quando alguém
   * passasse na frente.
   */
  drawNomeDoObjeto(objeto, x, y, agora = 0) {
    const ctx = this.octx;
    // Coordenadas do MUNDO: é `toScreen` quem desconta a câmera. Descontá-la
    // aqui também jogaria o nome para o outro lado da tela.
    // `nomeDx`/`nomeDy` (em casas) centram o nome em sprite grande. Ver `MARCOS`.
    const screen = this.toScreen((x + (objeto.nomeDx ?? 0)) * TILE + TILE / 2, (y + (objeto.nomeDy ?? 0)) * TILE);
    const meio = this.nitido(screen.x);
    const linha = this.nitido(screen.y - 10);

    ctx.font = `bold ${NAME_SIZE}px Verdana, "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    /*
     * ---- A cor vem do SERVIDOR, e é o que separa um móvel do outro ----
     *
     * O dono pediu o nome do skill trainer em laranja. Ele podia ser azul como
     * o dos bonecos, e a tela ficaria mais uniforme — e é justamente o que não
     * se quer: são dois móveis que fazem coisas diferentes, plantados no mesmo
     * chão, e a cor é o que se lê antes de ler a palavra. Quem já sabe que
     * laranja é treino offline não precisa mais ler nada.
     *
     * O azul continua sendo o padrão de quem não pede cor nenhuma.
     */
    const cor = CORES_DE_OBJETO[objeto.cor] ?? CORES_DE_OBJETO.azul;
    /*
     * A tinta da letra: um degradê que anda, quando a cor tem `pulso`, e um tom
     * chapado quando não tem. A largura sai do próprio texto — o degradê tem de
     * começar e acabar na palavra, e não na tela.
     */
    const tinta = cor.pulso
      ? pintaPulsante(ctx, cor, meio, ctx.measureText(objeto.nome).width, agora)
      : cor.texto;

    /*
     * O halo primeiro, por baixo de tudo — e só com a chave dos brilhos acesa.
     *
     * `shadowBlur` é o desenho mais caro que existe no canvas 2D: cada passada
     * é um borrão calculado pixel a pixel, e aqui ele acontece por nome e por
     * quadro. Apagado, não se perde nada de legível: o contorno preto e a cor
     * cheia vêm logo abaixo, sempre.
     */
    if (graficoLigado('brilhos')) {
      ctx.save();
      ctx.shadowColor = cor.halo;
      ctx.shadowBlur = 8 * this.zoom;
      ctx.fillStyle = cor.brilho ?? tinta;
      ctx.fillText(objeto.nome, meio, linha);
      ctx.restore();
    }

    // O mesmo contorno preto de 1px dos nomes de criatura, e a cor por cima.
    ctx.fillStyle = '#000';
    for (const [dx, dy] of OUTLINE) ctx.fillText(objeto.nome, meio + dx, linha + dy);
    ctx.fillStyle = tinta;
    ctx.fillText(objeto.nome, meio, linha);

    /*
     * ---- E quem está lá dentro, embaixo do nome do portal ----
     *
     * O dono: "dá pra fazer, quando tiver um boss lá dentro, aqui onde pisa pra
     *  entrar, informar o boss que tem lá dentro no momento?".
     *
     * A lista vem do servidor (ver `vigiarBossesDaArena`, no index.mjs) e é
     * espalhada só quando MUDA. Aqui ela é só desenhada.
     *
     * Uma segunda linha, menor e logo abaixo — e não no lugar do nome: o nome
     * é a porta, e quem já sabe onde ela fica está procurando a outra
     * informação. Com a área vazia não se escreve nada: "nenhum boss" ocuparia
     * o mesmo espaço para dizer que não há motivo para ler.
     */
    if (objeto.acao !== 'boss-diarios') return;
    const dentro = this.bossesNaArena ?? [];
    if (!dentro.length) return;

    /*
     * ---- "Na Área:" e o nome do boss, em duas cores ----
     *
     * O dono: "a letra no teleport, o boss que está no momento tem que ser
     *  diferente sabe, e ter meio que 'Na Área:'".
     *
     * A primeira versão escrevia o nome do boss na MESMA cor e no mesmo pulso
     * do "Boss Diarios" de cima — e duas linhas idênticas viram um nome de duas
     * linhas. O que se quer ler ali são duas coisas diferentes: onde é a porta,
     * e quem está atrás dela.
     *
     * Então o rótulo sai apagado, como rubrica, e o nome sai em ouro CHAPADO —
     * o portal pulsa, este não. A diferença de brilho é o que separa os dois de
     * relance, sem ninguém precisar ler.
     */
    const rotulo = 'Na Área: ';
    const quem = dentro.length === 1 ? dentro[0].nome : `${dentro.length} bosses`;
    const abaixo = this.nitido(screen.y + 3);

    ctx.font = `bold ${Math.max(8, NAME_SIZE - 2)}px Verdana, "Segoe UI", sans-serif`;
    /*
     * Duas cores numa linha só: o canvas pinta um `fillText` por vez, então a
     * linha é medida inteira e desenhada da ESQUERDA, em dois pedaços. Centrar
     * cada pedaço por conta própria os empilharia um em cima do outro.
     */
    ctx.textAlign = 'left';
    const larguraRotulo = ctx.measureText(rotulo).width;
    const comeco = meio - (larguraRotulo + ctx.measureText(quem).width) / 2;

    if (graficoLigado('brilhos')) {
      ctx.save();
      ctx.shadowColor = '#e8b923';
      ctx.shadowBlur = 7 * this.zoom;
      ctx.fillStyle = '#ffd76a';
      ctx.fillText(quem, comeco + larguraRotulo, abaixo);
      ctx.restore();
    }
    ctx.fillStyle = '#000';
    for (const [dx, dy] of OUTLINE) {
      ctx.fillText(rotulo, comeco + dx, abaixo + dy);
      ctx.fillText(quem, comeco + larguraRotulo + dx, abaixo + dy);
    }
    ctx.fillStyle = '#c99a86';
    ctx.fillText(rotulo, comeco, abaixo);
    ctx.fillStyle = '#ffd76a';
    ctx.fillText(quem, comeco + larguraRotulo, abaixo);

    /* Devolvido ao que o resto dos nomes espera encontrar. */
    ctx.textAlign = 'center';
  }

/*
   * ---- O escudo da party, desenhado no boneco ----
   *
   * Quatro figuras, como na base do dono (`utils_definitions.hpp`): amarelo
   * para o líder e azul para o membro, cada um com e sem a marca de Shared
   * Experience — `SHIELD_YELLOW_SHAREDEXP`, `SHIELD_BLUE_NOSHAREDEXP` e as
   * outras duas. A COR diz o cargo; a marca no meio diz se a experiência está
   * sendo dividida neste instante.
   *
   * Cheio contra vazio, e não dois tons da mesma cor: a diferença precisa ser
   * lida de canto de olho, em cima de um mapa cheio de textura, sem ninguém
   * parar para comparar.
   */
  drawEscudoDaParty(entity, meio, linhaDoNome, xEsquerdo = null) {
    /*
     * ---- Na arena de x1 não há party, há adversário ----
     *
     * "nessa area nao precisa ter o simbolo da party sabe? vc coloca esse
     *  simbolo skullred.png."
     *
     * O escudo aparecia ali por um acidente honesto do motor: os dois duelistas
     * entram na MESMA sessão (é o que faz os dois se verem e se acertarem), e
     * quem está na mesma sessão viaja no `snapshot.party`. O desenho estava
     * certo e a leitura errada — aquele boneco não é companheiro, é quem se tem
     * de matar.
     *
     * O desvio é aqui, no DESENHO, e não no que o servidor manda. Tirar a party
     * do quadro apagaria junto o card do adversário e a barra de vida dele, que
     * são justamente o que se olha num x1 — e mexeria numa estrutura que as
     * setenta e cinco caçadas usam. Aqui o alcance é uma arena de pvp e um
     * sprite.
     */
    if (this.pvp) return this.drawCaveiraDoDuelo(entity, meio, linhaDoNome, xEsquerdo);

    const party = this.party;
    if (!party || !entity.name) return;
    const quem = party.porNome.get(entity.name);
    if (!quem) return;

    /*
     * ---- Os escudos são os SPRITES do cliente, e não um desenho meu ----
     *
     * `data/images/game/shields` do OTClient do dono — os mesmos 11x11 que o
     * jogador vê no Tibia global. Um escudo desenhado à mão acerta a regra e
     * erra o reconhecimento: quem joga há anos identifica aquele desenho de
     * relance, e qualquer aproximação parece outra coisa.
     *
     * A escolha do arquivo é `Player::getPartyShield`, na base:
     *
     *   partilha valendo               -> _shared
     *   partilha caída, ele está em ordem -> _not_shared
     *   partilha caída, a culpa é dele    -> _not_shared piscando
     *
     * A COR é o cargo e nunca muda: amarelo é quem abriu a caçada, azul é
     * membro.
     */
    const partilhando = !!quem.partilhando;
    const piscando = !partilhando && !quem.ok;
    // Meio segundo aceso, meio apagado — o ritmo do cliente.
    if (piscando && Math.floor(Date.now() / 500) % 2 === 0) return;

    const cor = quem.lider ? 'yellow' : 'blue';
    const arte = image(`/client/assets/ui/shields/shield_${cor}${partilhando ? '_shared' : '_not_shared'}.png`);
    if (!arte?.ready) return;

    const ctx = this.octx;
    /*
     * ---- Do tamanho da LETRA, e não do zoom do mapa ----
     *
     * Ele acompanhava o zoom em passos inteiros e saía com 22 ou 33 pixels —
     * três vezes a altura do nome, um brasão pendurado no boneco. No cliente do
     * Tibia o escudo é um adorno do nome: cabe na linha dele e não chama mais
     * atenção que o próprio nome.
     *
     * O nome é desenhado nesta mesma camada, em `NAME_SIZE` pixels reais, e o
     * escudo segue essa medida — um pouco menor que a caixa da letra, que é o
     * que faz os dois assentarem na mesma linha.
     */
    const lado = Math.round(NAME_SIZE * 0.9);
    const meiaPalavra = ctx.measureText(entity.name).width / 2;
    // `xEsquerdo`: o nameplate do jogador cola o escudo na esquerda da ESFERA, e não do nome.
    const x = xEsquerdo ?? Math.round(meio - meiaPalavra - lado - 2);
    // Alinhado pela base da letra, e não pelo topo: `linhaDoNome` é a linha de
    // base do texto, então descer um pixel encaixa o escudo com o nome.
    const y = Math.round(linhaDoNome - lado + 1);

    const suave = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(arte.image, x, y, lado, lado);
    ctx.imageSmoothingEnabled = suave;
  }





  /*
   * ---- A caveira vermelha do duelo ----
   *
   * "o simbolo da caveira nessa area que fica ao lado do char tem que estar nos
   *  2 desafiantes ok, e nao so no que esta contra, e nao pode estar nos bixo."
   *
   * Ela vai nos DOIS, e a correção tem razão de ser: eu a tinha posto só no
   * adversário, lendo-a como mira. Mas a caveira aqui não é mira — é o estado
   * em que os dois estão. Quem está marcado está em luta de morte, e isso vale
   * para o dono da tela tanto quanto para o outro. É também o que o Tibia faz:
   * a red skull é uma condição da pessoa, e ela a vê em si mesma.
   *
   * ---- Gente SIM, bicho NÃO ----
   *
   * O teste é POSITIVO — só o próprio jogador (`isPlayer`) e os companheiros de
   * sessão (`aliado`), que numa arena de x1 são o adversário. Perguntar "não é
   * bicho?" teria sido mais curto e errado: no dia em que o motor ganhar uma
   * família nova de criatura (um invocado, um npc de evento), ela nasceria com
   * a caveira por não ter sido lembrada na lista de exceções. Do jeito que
   * está, o que não foi lembrado simplesmente não recebe a marca.
   *
   * Mesmo tamanho e mesmo lugar do escudo que ela substitui: a caveira é do
   * cliente do Tibia, 9x9, e sobe para a altura da letra do nome — um brasão
   * grande pendurado no boneco foi o defeito que o escudo já teve uma vez.
   */
  drawCaveiraDoDuelo(entity, meio, linhaDoNome, xEsquerdo = null) {
    if (!entity.name) return;
    if (!entity.isPlayer && !entity.aliado) return;

    const arte = image('/client/assets/ui/shields/skull-red.png');
    if (!arte?.ready) return;

    const ctx = this.octx;
    const lado = Math.round(NAME_SIZE * 0.9);
    const meiaPalavra = ctx.measureText(entity.name).width / 2;
    // `xEsquerdo`: o nameplate do jogador cola o escudo na esquerda da ESFERA, e não do nome.
    const x = xEsquerdo ?? Math.round(meio - meiaPalavra - lado - 2);
    const y = Math.round(linhaDoNome - lado + 1);

    const suave = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(arte.image, x, y, lado, lado);
    ctx.imageSmoothingEnabled = suave;
  }

  /**
   * Os estados que as gemas põem no mob (Freeze, Stun, Slow, Ignite): um ícone de 9 px de cada, ao lado da barra de vida. Formas
   * desenhadas (sem emoji, sem imagem): losango azul-gelo = congelado, estrela amarela = atordoado, anel azul com traço = lento,
   * gota laranja = queimando. A cor não é a única pista: cada um tem a sua FORMA.
   */
  drawEstadosDoMob(estados, x0, y) {
    const ctx = this.octx;
    const r = 4.5;
    let x = this.nitido(x0 + r);
    const cy = this.nitido(y + 2);
    ctx.save();
    ctx.lineWidth = 1.4;
    for (const estado of estados) {
      ctx.beginPath();
      if (estado === 'congelado') {
        ctx.moveTo(x, cy - r); ctx.lineTo(x + r, cy); ctx.lineTo(x, cy + r); ctx.lineTo(x - r, cy); ctx.closePath();
        ctx.fillStyle = '#9fe8ff';
        ctx.fill();
      } else if (estado === 'atordoado') {
        for (let i = 0; i < 8; i++) {
          const raio = i % 2 ? r * 0.45 : r;
          const ang = (i * Math.PI) / 4 - Math.PI / 2;
          ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(ang) * raio, cy + Math.sin(ang) * raio);
        }
        ctx.closePath();
        ctx.fillStyle = '#ffe066';
        ctx.fill();
      } else if (estado === 'lento') {
        ctx.arc(x, cy, r - 0.5, 0, Math.PI * 2);
        ctx.strokeStyle = '#7fb6ff';
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 1.6, cy); ctx.lineTo(x + 1.6, cy);
        ctx.stroke();
      } else if (estado === 'enregelado') {
        // Enregelamento (dano contínuo de gelo): um losango azul-claro vazado (o congelado é cheio).
        ctx.moveTo(x, cy - r); ctx.lineTo(x + r, cy); ctx.lineTo(x, cy + r); ctx.lineTo(x - r, cy); ctx.closePath();
        ctx.strokeStyle = '#9fe8ff';
        ctx.stroke();
      } else if (estado === 'envenenado' || estado === 'sangrando') {
        // Gota verde (veneno) ou vermelha (sangramento), com um ponto claro: a forma de gota é a do dano contínuo; a cor diz qual.
        ctx.moveTo(x, cy - r); ctx.quadraticCurveTo(x + r * 1.5, cy + r * 0.3, x, cy + r); ctx.quadraticCurveTo(x - r * 1.5, cy + r * 0.3, x, cy - r);
        ctx.fillStyle = estado === 'envenenado' ? '#5fd35f' : '#d03030';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - 1, cy + 0.5, 1, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fill();
      } else if (estado === 'eletrizado' || estado === 'amaldicoado' || estado === 'ofuscado') {
        // Os outros efeitos de dano contínuo: um quadrado pequeno, na cor do elemento.
        ctx.rect(x - r + 1, cy - r + 1, (r - 1) * 2, (r - 1) * 2);
        ctx.fillStyle = estado === 'eletrizado' ? '#8fb6ff' : estado === 'amaldicoado' ? '#9a6bd6' : '#fff1a8';
        ctx.fill();
      } else if (estado === 'queimando') {
        ctx.moveTo(x, cy - r); ctx.quadraticCurveTo(x + r * 1.5, cy + r * 0.3, x, cy + r); ctx.quadraticCurveTo(x - r * 1.5, cy + r * 0.3, x, cy - r);
        ctx.fillStyle = '#ff8a1f';
        ctx.fill();
      }
      x += r * 2 + 2;
    }
    ctx.restore();
  }

  /*
   * O nameplate de GENTE: o próprio jogador, os outros jogadores da praça e os companheiros de party/duelo. NPCs, o
   * familiar e as criaturas seguem no desenho de sempre (abaixo).
   */
  ehJogador(entity) {
    return entity.isPlayer || !!entity.aliado || (entity.isOther && !entity.npc && !entity.summon);
  }

  drawNameplateDoJogador(entity, cx, py) {
    const ctx = this.octx;
    const screen = this.toScreen(cx, py);
    const ratio = this.overlayRatio();
    const escala = escalaDoNameplate({ zoom: this.zoom, telefone: ehTelefone() });
    const caixa = this.nameplates.desenhar(
      ctx,
      {
        nome: entity.name,
        nivel: entity.level,
        hp: entity.hp,
        maxHp: entity.maxHp,
        mana: entity.mana,
        maxMana: entity.maxMana,
        es: entity.es,
        esMax: entity.esMax,
        propria: entity.isPlayer,
        cx: screen.x,
        topoDaCasa: screen.y,
        escala,
      },
      { telaL: this.overlay.width / ratio, telaA: this.overlay.height / ratio, nitido: (v) => this.nitido(v), ratio },
    );
    if (!caixa) return; // fora da tela: nada mais a desenhar
    const lado = Math.round(NAME_SIZE * 0.9 * escala);
    // O escudo da party (ou a caveira do duelo) à esquerda da esfera, na altura do centro dela.
    this.drawEscudoDaParty(entity, screen.x, caixa.esferaCY + lado / 2 - 1, Math.round(caixa.esq - lado - 2));
    // Os estados ativos do jogador (controle, dano contínuo): à direita das barras, na linha da vida.
    if (entity.isPlayer && entity.estados?.length) this.drawEstadosDoMob(entity.estados, caixa.dir + 3, caixa.vidaH ? caixa.vidaTopo : caixa.nomeTopo + caixa.nomeH);
    // A tag de cargo (GOD...) por cima do conjunto.
    if (entity.marca?.tag) this.drawMarcaDoJogador(entity, screen.x, caixa.topo - 3);
  }

  drawMarcaDoJogador(entity, meio, topo) {
    const ctx = this.octx;
    /*
     * ---- A tag de cargo, por cima do nome ----
     *
     * `GOD` em dourado com brilho, na fonte de título do jogo — a mesma dos
     * painéis, para a marca pertencer ao jogo e não parecer colada.
     *
     * O brilho é feito de duas passadas de sombra em vez de uma: uma larga e
     * fraca dá o halo, uma curta e forte dá o contorno aceso. Uma só faz o
     * texto parecer borrado em cima do mapa, que é fundo com muita textura.
     *
     * Ela vem da LINHA do servidor (`marca`), e não de uma lista de gods no
     * cliente: quem for rebaixado deixa de ter a tag no quadro seguinte, sem
     * nada para limpar aqui.
     */
    const dourado = entity.marca.nivel >= 3;
    const cor = dourado ? '#ffd76a' : '#dcecf6';
    const halo = dourado ? '#ffb32e' : '#9fc4d8';

    /*
     * A MESMA fonte dos nomes, e não a serifa dos títulos.
     *
     * Ela estava em Cinzel, que é bonita e ilegível a nove pixels em cima do
     * mapa — o dono viu e pediu para voltar ao padrão. O que sobra de
     * "bonito" é o EFEITO: o dourado, o halo em duas passadas e o contorno.
     * Isso se lê e continua chamando o olho.
     */
    ctx.font = `bold ${Math.max(8, NAME_SIZE - 1)}px Verdana, "Segoe UI", sans-serif`;
    // As duas passadas de halo saem com a chave dos brilhos apagada — o
    // dourado e o contorno abaixo seguram a marca sozinhos. Ver
    // `drawNomeDoObjeto`, que faz a mesma conta pelo mesmo motivo.
    if (graficoLigado('brilhos')) {
      ctx.save();
      ctx.shadowColor = halo;
      ctx.shadowBlur = 9 * this.zoom;
      ctx.fillStyle = cor;
      ctx.fillText(entity.marca.tag, meio, topo);
      ctx.shadowBlur = 3 * this.zoom;
      ctx.fillText(entity.marca.tag, meio, topo);
      ctx.restore();
    }

    // O contorno preto por último, como nos nomes: sobre chão claro o dourado
    // sozinho some, e o halo não segura a forma da letra.
    ctx.fillStyle = '#000';
    for (const [dx, dy] of OUTLINE) ctx.fillText(entity.marca.tag, meio + dx, topo + dy);
    ctx.fillStyle = cor;
    ctx.fillText(entity.marca.tag, meio, topo);
    ctx.font = `bold ${NAME_SIZE}px Verdana, "Segoe UI", sans-serif`;
  }

  drawNameplate(entity, cx, py) {
    if (this.ehJogador(entity)) return this.drawNameplateDoJogador(entity, cx, py);
    const ctx = this.octx;
    const screen = this.toScreen(cx, py);
    const percent = entity.maxHp ? Math.max(0, Math.min(100, (entity.hp / entity.maxHp) * 100)) : 100;
    const color = entity.maxHp ? healthColor(percent) : NAME_GREEN;

    // Tudo encaixado na grade de pixels: é o que mantém a letra nítida em
    // movimento. Veja `nitido`.
    const meio = this.nitido(screen.x);
    const barTop = this.nitido(screen.y - 8);
    const width = Math.round(HEALTH_BAR_WIDTH * this.zoom * 0.75);

    /*
     * Nome acima da barra, com contorno preto de 1px em volta — pintado uma vez
     * e copiado daí em diante. Ver `placaDoNome`.
     *
     * O canto de cima sai da linha de base de antes (`barTop - 4`) menos a
     * altura que a letra ocupa acima dela: é o que mantém o nome exatamente
     * onde estava. E ele passa pelo `nitido` pelo mesmo motivo de sempre —
     * copiar uma imagem para meio pixel a borra igual.
     */
    /*
     * O MOB: o nome na cor da RARIDADE (normal, modificado, raro, elite...), o
     * level à direita e, em cima, os modificadores — a vida continua na barra
     * (decisão do dono). Jogador e familiar seguem como eram.
     */
    const ehMob = !entity.isPlayer && !entity.isOther && !entity.summon && !entity.aliado;
    const corDoMob = ehMob ? corDaRaridade(entity.raridade) : null;
    const placa = placaDoNome(entity.name, corDoMob ?? color, this.overlayRatio());
    const nomeX = this.nitido(meio - placa.largura / 2);
    const nomeY = this.nitido(barTop - 4 - placa.base);
    ctx.drawImage(placa.lona, nomeX, nomeY, placa.largura, placa.altura);
    if (ehMob && entity.nivel != null) {
      const lv = placaDeTexto(`Lv ${entity.nivel}`, '#b9b2a2', Math.max(8, NAME_SIZE - 2), this.overlayRatio());
      ctx.drawImage(lv.lona, this.nitido(nomeX + placa.largura - 1), this.nitido(nomeY + (placa.altura - lv.altura)), lv.largura, lv.altura);
    }
    // Os estados ativos: do mob (gemas do jogador) e do próprio JOGADOR (controle de boss/elite e dano contínuo dos mobs).
    if (ehMob && entity.estados?.length) this.drawEstadosDoMob(entity.estados, meio + width / 2 + 3, barTop);
    if (ehMob && entity.mods?.length) {
      const linha = placaDeTexto(entity.mods.join(' · '), corDoMob ?? '#cfc7b4', Math.max(8, NAME_SIZE - 2), this.overlayRatio());
      ctx.drawImage(linha.lona, this.nitido(meio - linha.largura / 2), this.nitido(nomeY - linha.altura + 3), linha.largura, linha.altura);
    }

    /*
     * ---- O Summon Level, colado no nome do familiar ----
     *
     * "ao lado do summon tem que aparecer o level dele, até 33 verde, até 66
     * amarelo, até 100 vermelho."
     *
     * À DIREITA e não centralizado junto: o nome já está centrado no boneco, e
     * refazer a centragem com o número dentro moveria o nome de lugar toda vez
     * que o nível passasse de um dígito para dois.
     *
     * A cor é a única coisa que o número diz de relance, e por isso ela não é
     * decoração: verde é começo, amarelo é meio, vermelho é quem chegou lá.
     */
    /*
     * ---- E ele virou uma PLACA ----
     *
     * "o level ao lado do summon tem que ser mais bonito, não sei o que pode ser
     *  feito".
     *
     * Era um número solto colado no nome, e o problema é esse: um algarismo em cima
     * do mapa não se lê como insígnia, se lê como um pedaço do nome que ficou
     * torto. Nada dizia que aquele 42 era o NÍVEL de alguma coisa.
     *
     * Agora é uma plaquinha: fundo escuro arredondado, borda e número na cor da
     * faixa. Três coisas mudam de uma vez —
     *
     *   ela se separa do nome sozinha, sem depender de um espaço em branco;
     *   o fundo escuro segura a cor em cima de chão claro, onde o verde sumia;
     *   e a forma diz "isto é um selo", que é o que o número é.
     *
     * A cor continua sendo a única informação de relance (verde começo, amarelo
     * meio, vermelho quem chegou lá) e continua vindo de `corDoNivelDoSummon`.
     */
    if (entity.summon && entity.nivel != null) {
      const rotulo = String(entity.nivel);
      const cor = corDoNivelDoSummon(entity.nivel);

      // Um ponto menor que o nome: a placa é do lado dele, e o número não pode
      // competir com quem ela acompanha.
      ctx.font = `bold ${NAME_SIZE - 2}px Verdana, "Segoe UI", sans-serif`;
      const largura = Math.ceil(ctx.measureText(rotulo).width) + PLACA_FOLGA * 2;
      const altura = NAME_SIZE + 2;
      /*
       * Oito de folga, e nao quatro.
       *
       * "o nivel do summon tem que ficar um tiquinho a mais pra direita, senao pega
       *  um pouco da ultima letra".
       *
       * O `measureText` mede a CAIXA da palavra, e o contorno preto de um pixel que
       * todo nome leva (ver `OUTLINE`) fica fora dessa conta — some por baixo da
       * borda da placa. Quatro viravam tres na pratica, e a moldura encostava na
       * ultima letra.
       */
      const x = this.nitido(meio + ctx.measureText(entity.name).width / 2 + 8);
      const y = this.nitido(barTop - 4 - altura + 3);

      /*
       * `roundRect` não existe em todo canvas antigo; o retângulo comum é o
       * plano B, e a placa continua legível quadrada.
       */
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, largura, altura, 3);
      else ctx.rect(x, y, largura, altura);
      ctx.fillStyle = 'rgba(6, 8, 10, 0.78)';
      ctx.fill();
      ctx.strokeStyle = cor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = cor;
      ctx.fillText(rotulo, x + largura / 2, y + altura - 3);
      ctx.font = `bold ${NAME_SIZE}px Verdana, "Segoe UI", sans-serif`;
    }

    if (!entity.maxHp) return;
    const left = this.nitido(meio - width / 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(left - 1, barTop - 1, width + 2, 6);
    ctx.fillStyle = color;
    ctx.fillRect(left, barTop, Math.round((width * percent) / 100), 4);
  }

  drawTexts(now) {
    const ctx = this.octx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // Com a chave dos números apagada a fila é esvaziada, e não só ignorada:
    // o que já estava voando some junto, em vez de continuar preso na memória.
    this.texts = graficoLigado('numeros')
      ? this.texts.filter((text) => now - text.born < text.life)
      : [];

    for (const text of this.texts) {
      const progress = (now - text.born) / text.life;
      /*
       * O número segue a criatura, não o tile.
       *
       * O evento traz o tile em que o servidor viu o golpe, mas o boneco é
       * desenhado na posição interpolada: com a criatura andando, os dois não
       * coincidem e o número saía do lado dela. Enquanto o dono do texto está
       * vivo na tela, a âncora é ele; morto ou fora de vista, sobra o tile.
       *
       * A altura é meio tile abaixo da borda de cima, mais um respiro — antes
       * o número começava alto demais, na cabeça em vez do corpo.
       */
      const dono = text.uid != null ? this.entities.get(text.uid) : null;
      const base = dono
        ? this.position(dono, now)
        : { x: text.x * TILE, y: text.y * TILE };
      const world = {
        x: base.x + TILE / 2 + text.drift,
        y: base.y + TILE / 2 + 10,
      };
      const screen = this.toScreen(world.x, world.y);
      /*
       * O numero de dano voa do corpo para cima, e o `degrau` so' desencosta os
       * que nasceram no mesmo instante (ver `degrauDoNumero`).
       *
       * Ele sai do corpo mesmo, sem deslocamento nenhum: cruzar a plaqueta com o
       * nome no caminho e' o que o numero faz na base tambem. Ja' tentei subir a
       * origem dele para nao cruzar, e ai ele nascia em cima da fala.
       */
      const y =
        screen.y - progress * SUBIDA_DO_NUMERO * this.zoom - (text.degrau ?? 0) * ALTURA_DA_LINHA;
      ctx.globalAlpha = Math.max(0, 1 - progress ** 2);
      // Pintado uma vez e colado (ver `placaDeTexto`): sem trocar a fonte do mapa.
      const placa = placaDeTexto(String(text.text), text.color, text.size, this.overlayRatio());
      ctx.drawImage(placa.lona, screen.x - placa.largura / 2, y - placa.base, placa.largura, placa.altura);
    }

    /*
     * ---- E os blocos de fala, a outra pilha ----
     *
     * Parados acima da cabeca, a linha mais nova embaixo: o bloco cresce para
     * cima conforme as magias saem, e some inteiro de uma vez.
     */
    /*
     * Cada linha morre sozinha, e o bloco morre quando esvazia.
     *
     * Tirar a de CIMA nao mexe nas outras: as alturas sao contadas de baixo
     * para cima (a mais nova no zero), entao a segunda de tres e a primeira de
     * duas caem no mesmo lugar. A coluna encolhe pelo alto, sem pulo.
     */
    for (const fala of this.falas) {
      fala.linhas = fala.linhas.filter((linha) => now - linha.born < VIDA_DA_FALA);
    }
    this.falas = this.falas.filter((fala) => fala.linhas.length);
    for (const fala of this.falas) {
      const dono = fala.uid != null ? this.entities.get(fala.uid) : null;
      const base = dono
        ? this.position(dono, now)
        : { x: fala.x * TILE, y: fala.y * TILE };
      const screen = this.toScreen(base.x + TILE / 2, base.y);
      for (let i = 0; i < fala.linhas.length; i += 1) {
        const linha = fala.linhas[i];
        // O apagamento e' de cada linha: a de cima some antes da de baixo.
        const progress = (now - linha.born) / VIDA_DA_FALA;
        ctx.globalAlpha = Math.min(1, (1 - progress) * 3);
        /*
         * A ultima da lista e' a mais nova, e nasce no degrau zero: sobre o peito
         * do boneco, que e' onde a fala sempre saiu aqui.
         *
         * Cheguei a por o bloco uma linha ACIMA da plaqueta com o nome, que e' onde
         * a fala fica no client — e o dono achou alto demais: "o nome das magias
         * que sai pode ser onde ja estava, ficou muito pra cima". Faz sentido: a
         * fala aqui e' quase toda dele, saindo da barra de acao, e ele le ela junto
         * do boneco e nao no meio dos bichos de cima.
         *
         * Nascendo abaixo do nome, o bloco so' passa por cima dele quando a barra
         * dispara muita magia junta — que e' de novo o que acontecia antes.
         */
        const y = screen.y + ONDE_A_FALA_NASCE - (fala.linhas.length - 1 - i) * ALTURA_DA_LINHA;
        const placa = placaDeTexto(String(linha.text), linha.color, 12, this.overlayRatio());
        ctx.drawImage(placa.lona, screen.x - placa.largura / 2, y - placa.base, placa.largura, placa.altura);
      }
    }
    ctx.globalAlpha = 1;
  }

  /*
   * ---- O PORTAL DE SAÍDA da viagem (dono, 10/10 — `portal-ciclo.mjs`) ----
   * Quem chama é a tela (`main.mjs`), com a cena de onde se sai congelada: aberto `abertoMs` com a barra diminuindo acima dele, e o
   * fechamento em `fechamentoMs`, o portal e o personagem sumindo juntos. Tudo no relógio local: nenhuma mensagem por quadro.
   */
  abrirPortalDeSaida({ x, y, dir = 2, ciclo, agora = performance.now() }) {
    // O portal abre AO LADO dele (de preferência à frente); ele fica virado para o portal.
    const portal = casaDoPortal({ x, y }, ordemDaSaida(dir), (cx, cy) => this.casaLivreParaOPortal(cx, cy));
    // O portal de viagem que o servidor abriu sob ele (a troca de instância) é este: não ficam dois.
    this.effects = this.effects.filter((e) => !(e.rotulo === 'portal' && ((e.x === x && e.y === y) || (e.x === portal.x && e.y === portal.y))));
    this.portalDeSaida = { x, y, portal, dir: direcaoDoPasso({ x, y }, portal, dir), ciclo, inicio: agora };
    this.precisaDesenhar = true;
  }

  /** A casa (x, y) do andar na tela é andável e livre de criatura (para o portal abrir nela)? */
  casaLivreParaOPortal(x, y) {
    const mapa = this.snapshot?.map;
    if (!mapa || x < 0 || y < 0 || x >= mapa.width || y >= mapa.height) return false;
    const andar = mapa.floors?.[this.snapshot.z ?? mapa.z];
    const i = y * mapa.width + x;
    const pilhas = andar?.stacks ?? mapa.stacks;
    const bloqueado = andar?.blocked ?? mapa.blocked;
    if (pilhas && !(Array.isArray(pilhas[i]) ? pilhas[i].length : pilhas[i])) return false;
    if (bloqueado?.[i]) return false;
    for (const e of this.entities.values()) if (!e.isPlayer && Math.round(e.x) === x && Math.round(e.y) === y) return false;
    return true;
  }

  /**
   * Onde e como desenhar o personagem na viagem pelo portal: `{ dx, dy }` (px, a partir da casa dele), `dir`, `andando`. Saída: da
   * casa dele para a do portal (`passo` 0 → 1); chegada: da casa do portal para a dele (o desenho termina exatamente no lugar dele).
   */
  viagemDoPersonagem(now) {
    if (this.portalDeSaida) {
      const q = this.quadroDoPortal(now);
      const { x, y, portal, dir } = this.portalDeSaida;
      const passo = q?.passo ?? 0;
      return { dx: (portal.x - x) * TILE * passo, dy: (portal.y - y) * TILE * passo, dir, andando: !!q?.andando };
    }
    if (this.portalDeChegada) {
      const q = this.quadroDaChegadaAgora(now);
      if (!q || q.fase === 'fechando' || q.fase === 'fim') return null;
      const { x, y, portal, dir } = this.portalDeChegada;
      const falta = 1 - (q.passo ?? 0);
      return { dx: (portal.x - x) * TILE * falta, dy: (portal.y - y) * TILE * falta, dir, andando: !!q.andando };
    }
    return null;
  }

  fecharPortalDeSaida() {
    if (!this.portalDeSaida) return;
    this.portalDeSaida = null;
    this.precisaDesenhar = true;
  }

  /** O quadro do ciclo agora (`quadroDoCiclo`), ou null sem portal. */
  quadroDoPortal(now) {
    const p = this.portalDeSaida;
    return p ? quadroDoCiclo(now - p.inicio, p.ciclo) : null;
  }

  drawPortalDeSaida(now) {
    const q = this.quadroDoPortal(now);
    if (!q || q.fase === 'fim') return;
    const { portal, inicio } = this.portalDeSaida;
    this.desenharVortice(portal.x, portal.y, q, now - inicio);
    // A barra: na camada de texto (nítida em qualquer zoom), logo acima do portal, acompanhando a casa dele na tela.
    this.drawBarraDoPortal(portal.x, portal.y, q);
  }

  /*
   * ---- O PORTAL DE CHEGADA (dono, 10/10 — `portal-ciclo.mjs`, `quadroDaChegada`) ----
   * Na cena nova, onde ele chega: o personagem surge do portal (`surgindoMs`, com a barra) e depois o portal fecha SOZINHO
   * (`fechamentoMs`) — o personagem fica. Some da tela por conta própria no fim (nenhum efeito fica).
   */
  abrirPortalDeChegada({ x, y, ciclo, agora = performance.now() }) {
    // O portal abre AO LADO de onde ele fica (de preferência a um lado): ele surge lá e anda a casa até o lugar dele.
    const portal = casaDoPortal({ x, y }, ORDEM_DA_CHEGADA, (cx, cy) => this.casaLivreParaOPortal(cx, cy));
    // O portal de chegada que o servidor mandou para a casa dele é este (não ficam dois).
    this.effects = this.effects.filter((e) => !(e.rotulo === 'portal' && ((e.x === x && e.y === y) || (e.x === portal.x && e.y === portal.y))));
    this.portalDeChegada = { x, y, portal, dir: direcaoDoPasso(portal, { x, y }, 2), ciclo, inicio: agora };
    this.precisaDesenhar = true;
  }

  fecharPortalDeChegada() {
    if (!this.portalDeChegada) return;
    this.portalDeChegada = null;
    this.precisaDesenhar = true;
  }

  /** O quadro da chegada agora (`quadroDaChegada`), ou null sem portal de chegada. */
  quadroDaChegadaAgora(now) {
    const p = this.portalDeChegada;
    return p ? quadroDaChegada(now - p.inicio, p.ciclo) : null;
  }

  drawPortalDeChegada(now) {
    const q = this.quadroDaChegadaAgora(now);
    if (!q) return;
    if (q.fase === 'fim') {
      this.portalDeChegada = null;
      return;
    }
    const { portal, inicio } = this.portalDeChegada;
    this.desenharVortice(portal.x, portal.y, q, now - inicio);
    if (q.barra > 0) this.drawBarraDoPortal(portal.x, portal.y, q);
  }

  /** O vórtice (o halo que pulsa, o desenho da Arena de Efeitos e o anel girando) na casa (x, y), no quadro `q` do ciclo. */
  desenharVortice(x, y, q, decorrido) {
    const ctx = this.ctx;
    const cx = x * TILE + TILE / 2 - this.camera.x;
    const cy = y * TILE + TILE / 2 - this.camera.y;
    const fechando = q.fase === 'fechando';
    ctx.save();
    // A energia: um halo que pulsa (violeta no aberto, brasa no fechamento) e o anel girando.
    const raio = TILE * 0.78 * q.portal.escala;
    const halo = ctx.createRadialGradient(cx, cy, raio * 0.15, cx, cy, raio * 1.35);
    halo.addColorStop(0, fechando ? 'rgba(255,170,120,0.55)' : 'rgba(205,170,255,0.55)');
    halo.addColorStop(0.55, fechando ? 'rgba(170,40,30,0.32)' : 'rgba(110,60,190,0.32)');
    halo.addColorStop(1, 'rgba(10,6,16,0)');
    ctx.globalAlpha = q.portal.alpha * (0.65 + 0.35 * q.energia);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, raio * 1.35, 0, Math.PI * 2);
    ctx.fill();
    // O vórtice da Arena de Efeitos (`fabrica-portal-de-viagem`), quando o servidor publicou o desenho dele.
    const asset = visuaisAtuais().assets?.['fabrica-portal-de-viagem'];
    if (asset) {
      ctx.globalAlpha = q.portal.alpha;
      ctx.translate(cx, cy);
      ctx.scale(q.portal.escala, q.portal.escala);
      const natural = duracaoDoAsset(asset) || 600;
      desenharQuadroDeAsset(ctx, asset, (decorrido % natural) / natural, 0, 0);
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = q.portal.alpha * (0.7 + 0.3 * q.energia);
    ctx.strokeStyle = fechando ? '#e0663f' : '#b78cff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.lineDashOffset = -(decorrido / 40);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, raio, raio * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawBarraDoPortal(x, y, q) {
    const ctx = this.octx;
    const tela = this.toScreen(x * TILE + TILE / 2, y * TILE);
    const telefone = ehTelefone();
    const largura = Math.round(Math.max(telefone ? 46 : 40, TILE * 1.1 * this.zoom * 0.75));
    const altura = Math.max(telefone ? 6 : 5, Math.round(2.6 * this.zoom));
    const esq = this.nitido(tela.x - largura / 2);
    const topo = this.nitido(tela.y - altura - 10);
    const fechando = q.fase === 'fechando';
    ctx.save();
    ctx.globalAlpha = fechando ? Math.max(0.35, q.portal.alpha) : 1;
    // A moldura escura (legível sobre chão claro e escuro) e o fundo.
    ctx.fillStyle = 'rgba(8,6,12,0.85)';
    ctx.fillRect(esq - 2, topo - 2, largura + 4, altura + 4);
    ctx.strokeStyle = fechando ? '#5a2018' : '#3d2a5c';
    ctx.lineWidth = 1;
    ctx.strokeRect(esq - 1.5, topo - 1.5, largura + 3, altura + 3);
    const cheio = Math.max(0, Math.round(largura * q.barra));
    if (cheio > 0) {
      const g = ctx.createLinearGradient(esq, topo, esq, topo + altura);
      g.addColorStop(0, fechando ? '#ffb07a' : '#dcc4ff');
      g.addColorStop(1, fechando ? '#a3271b' : '#6b3fb3');
      ctx.fillStyle = g;
      ctx.fillRect(esq, topo, cheio, altura);
    }
    ctx.restore();
  }

  /*
   * ---- As SAFE ZONES na tela (dono, 10/10 — `systems/protecao.mjs`) ----
   * As casas seguras do andar (`map.seguras[z]`, marcadas no editor de mapas): um véu claro e a borda da área, só nas casas que a câmera
   * vê. O conjunto é montado uma vez por mapa/andar.
   */
  drawZonasSeguras() {
    const mapa = this.snapshot?.map;
    const z = this.snapshot?.z ?? mapa?.z;
    const lista = mapa?.seguras?.[z];
    if (!lista?.length) return;
    if (this.zonasSeguras?.lista !== lista) this.zonasSeguras = { lista, casas: new Set(lista.map(([cx, cy]) => cx * 65536 + cy)) };
    const casas = this.zonasSeguras.casas;
    const ctx = this.ctx;
    const x0 = Math.floor(this.camera.x / TILE) - 1;
    const y0 = Math.floor(this.camera.y / TILE) - 1;
    const x1 = Math.ceil((this.camera.x + this.canvas.width) / TILE) + 1;
    const y1 = Math.ceil((this.camera.y + this.canvas.height) / TILE) + 1;
    const segura = (cx, cy) => casas.has(cx * 65536 + cy);
    ctx.save();
    ctx.fillStyle = 'rgba(150,200,255,0.10)';
    ctx.strokeStyle = 'rgba(170,215,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (!segura(cx, cy)) continue;
        const px = cx * TILE - this.camera.x;
        const py = cy * TILE - this.camera.y;
        ctx.fillRect(px, py, TILE, TILE);
        // A borda: só os lados que dão para fora da zona.
        if (!segura(cx, cy - 1)) { ctx.moveTo(px, py + 0.5); ctx.lineTo(px + TILE, py + 0.5); }
        if (!segura(cx, cy + 1)) { ctx.moveTo(px, py + TILE - 0.5); ctx.lineTo(px + TILE, py + TILE - 0.5); }
        if (!segura(cx - 1, cy)) { ctx.moveTo(px + 0.5, py); ctx.lineTo(px + 0.5, py + TILE); }
        if (!segura(cx + 1, cy)) { ctx.moveTo(px + TILE - 0.5, py); ctx.lineTo(px + TILE - 0.5, py + TILE); }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * O SELO no alto do mapa: "Protegido" enquanto o servidor segura a caçada à espera do mapa (`snapshot.protegido`) e "Zona segura" com o
   * personagem numa casa segura — lá ele não ataca nem apanha.
   */
  drawSeloDeProtecao() {
    const snap = this.snapshot;
    const eu = snap?.player;
    const chegada = this.quadroDaChegadaAgora(performance.now())?.fase;
    if (!snap || !eu || this.portalDeSaida || chegada === 'surgindo' || chegada === 'saindo') return;
    const naZona = !!this.zonasSeguras?.casas?.has(eu.x * 65536 + eu.y) && this.zonasSeguras.lista === snap.map?.seguras?.[snap.z ?? snap.map?.z];
    const texto = snap.protegido ? 'Protegido — preparando o mapa' : naZona ? 'Zona segura' : null;
    if (!texto) return;
    const ctx = this.octx;
    const tela = this.toScreen(this.camera.x + this.canvas.width / 2, this.camera.y);
    ctx.save();
    ctx.font = `600 ${ehTelefone() ? 13 : 12}px Verdana, "Segoe UI", sans-serif`;
    const largura = Math.ceil(ctx.measureText(texto).width) + 20;
    const esq = this.nitido(tela.x - largura / 2);
    const topo = this.nitido(tela.y + 10);
    ctx.fillStyle = 'rgba(8,10,16,0.78)';
    ctx.fillRect(esq, topo, largura, 22);
    ctx.strokeStyle = snap.protegido ? 'rgba(183,140,255,0.8)' : 'rgba(170,215,255,0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(esq + 0.5, topo + 0.5, largura - 1, 21);
    ctx.fillStyle = snap.protegido ? '#dcc4ff' : '#cfe6ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, esq + largura / 2, topo + 11.5);
    ctx.restore();
  }

  /** Efeitos e projéteis passam por cima das criaturas. */
  drawEffects(now) {
    const ctx = this.ctx;
    // A aura ligada (o efeito contínuo do buff), no boneco do jogador.
    if (this.buffsDoJogador?.length) {
      const eu = this.entities.get('player');
      if (eu) {
        const p = this.position(eu, now);
        for (const b of this.buffsDoJogador) desenharContinuo(ctx, b.sk, p.x - this.camera.x, p.y - this.camera.y, now);
      }
    }
    // Os portais de chegada guardados enquanto a cortina de viagem cobria a tela: abrem agora.
    if (this.portaisDepoisDaCortina?.length && !cortinaDeViagemNaTela()) {
      const portais = this.portaisDepoisDaCortina.map((ev) => ({ ...ev, chegada: false }));
      this.portaisDepoisDaCortina = [];
      this.addEvents(portais);
    }
    this.effects = this.effects.filter((effect) => now - effect.born < effect.life);
    for (const effect of this.effects) {
      // Golpe de alvo único segue o boneco; magia de área fica no chão, que é
      // onde ela cai — por isso só o efeito com dono é interpolado.
      const dono = effect.uid != null ? this.entities.get(effect.uid) : null;
      const base = dono ? this.position(dono, now) : { x: effect.x * TILE, y: effect.y * TILE };
      desenharEfeito(ctx, effect, base.x - this.camera.x, base.y - this.camera.y, now);
    }
  }

  drawMissiles(now) {
    const ctx = this.ctx;
    this.missiles = this.missiles.filter((shot) => now - shot.born < shot.life);
    for (const shot of this.missiles) {
      // Na altura do corpo, não do chão: meio tile acima do centro do tile (`desenharProjetil`).
      desenharProjetil(ctx, shot, now, this.camera);
    }
  }

  /*
   * ---- Este quadro sairia igual ao que já está na tela? ----
   *
   * A resposta tem de ser BARATA e ter de errar sempre para o mesmo lado: na
   * dúvida, desenha. Um quadro desenhado à toa custa alguns milissegundos; um
   * quadro pulado por engano é a tela do jogo congelada, que é o pior defeito
   * que este arquivo pode ter.
   *
   * Por isso a lista abaixo é de motivos para NÃO pular, e qualquer um deles
   * basta. E por isso existe o teto de meio segundo no fim: aconteça o que
   * acontecer, a tela é repintada duas vezes por segundo. Se um dia alguém
   * acrescentar algo que se mexe e esquecer de listar aqui, o defeito vai ser
   * "está meio travado", e não "congelou".
   */
  podePularQuadro(now) {
    // Sem retrato não há o que comparar, e a tela precisa do fundo preto.
    if (!this.snapshot) return false;
    // Os portais de saída e de chegada animam a cada quadro (a energia, a barra, o fade).
    if (this.portalDeSaida || this.portalDeChegada) return false;
    // Redraw obrigatório: o canvas foi redimensionado (e portanto apagado), ou
    // chegou um retrato novo do servidor.
    if (this.precisaDesenhar) {
      this.precisaDesenhar = false;
      return false;
    }
    // A rede de segurança: no máximo meio segundo sem repintar.
    if (now - (this.desenhadoEm ?? -Infinity) > 500) return false;
    // A câmera está deslizando (alguém está andando).
    if (this.camera.x !== this.cameraDesenhada?.x || this.camera.y !== this.cameraDesenhada?.y) return false;
    // Alguma animação de mapa (água, tocha, portal) trocou de quadro.
    if (now >= this.trocaDeAnimacaoEm) return false;
    // Efeito, projétil, número de dano ou fala no ar.
    if (this.effects.length || this.missiles.length || this.texts.length || this.falas.length || this.buffsDoJogador?.length) return false;
    /*
     * E qualquer criatura andando ou em pose de andar. `position` é a mesma
     * conta que o desenho faz, e ela é barata: são poucas entidades, e o caro
     * é o mapa embaixo delas.
     */
    for (const entity of this.entities.values()) {
      const pos = this.position(entity, now);
      if (pos.moving || pos.walking) return false;
    }
    return true;
  }

  render = () => {
    requestAnimationFrame(this.render);
    const ctx = this.ctx;
    const now = performance.now();

    /*
     * ---- Quanto tempo o MONITOR leva entre um quadro e outro ----
     *
     * "e pq não tem a opção de 144 fps?"
     *
     * Porque quem manda no ritmo é o monitor, e não este arquivo:
     * `requestAnimationFrame` dispara uma vez por atualização de tela — 60 por
     * segundo num monitor comum, 144 num de 144Hz. Sem teto, o jogo já roda em
     * 144 para quem tem 144.
     *
     * A média mora no `medidor.mjs` porque ela tem DOIS leitores: a folga do
     * teto, logo abaixo, e a tela de ajustes — que mostra o número para separar
     * "o jogo me limitou" de "meu monitor entrega 60". Ela é medida ANTES de
     * qualquer descarte, senão passaria a medir o próprio teto.
     */
    marcarPassadaDoMonitor(now);

    /*
     * ---- O teto de desenho, quando alguém pede um ----
     *
     * Este laço roda no ritmo do monitor para mostrar um estado que chega 8
     * vezes por segundo. As passadas do meio existem para a animação de
     * caminhada e para os efeitos.
     *
     * O teto nasce em `0` — sem limite — e é isto que mudou depois do "o modo
     * lite não era pro jogo ficar sem fps". Cortar quadros economiza, mas o que
     * se sente é o boneco andando aos pulos, que é a própria queixa que o
     * ajuste deveria resolver. Quem quiser, escolhe; o "Deixar leve" não
     * escolhe por ninguém, e tira efeito em vez de quadro.
     *
     * ---- A folga, e por que ela é MEIO QUADRO DO MONITOR ----
     *
     * Sem folga nenhuma, um teto de 30 num monitor de 60Hz vira 20: a passada
     * certa chega décimos cedo demais, é descartada, e a próxima só vem 16ms
     * depois. Quem pediu 30 recebe 20 sem entender.
     *
     * Ela também não pode ser um número fixo: 8ms é meio quadro de 60Hz e é
     * MAIS que um quadro inteiro de 144Hz — num monitor rápido, um teto de 144
     * deixaria tudo passar e não seria teto nenhum. Meio quadro do monitor
     * medido serve aos dois.
     *
     * O que sai continua quantizado pelo monitor: só dá para dividir o ritmo
     * dele por um inteiro. Num monitor de 144Hz o teto de 60 cai em 72, que é o
     * degrau mais perto que existe — por isso a tela diz "até 60", e não "60".
     *
     * O `return` vem DEPOIS do `requestAnimationFrame` lá em cima: pular o
     * agendamento pararia o laço de vez, e a tela congelaria no primeiro quadro
     * pulado.
     */
    const teto = tetoDeQuadros();
    if (teto) {
      const folga = intervaloDoMonitor() / 2;
      if (now - (this.ultimoDesenho ?? 0) < 1000 / teto - folga) return;
      this.ultimoDesenho = now;
    }

    /*
     * O contador do canto conta AQUI, depois do teto: são os quadros que o mapa
     * realmente desenhou. Contando antes, ele mostraria o ritmo do monitor com
     * o nome errado — e quem pôs um teto de 30 quer ver 30 ali.
     */
    contarQuadro();

    /*
     * ---- Quadro igual ao anterior não é desenhado ----
     *
     * "no celular eu precisava que fosse bem otimizado."
     *
     * Medido num telefone comum (412x915, dpr 3, CPU 4x mais lenta) com o
     * personagem PARADO na cidade: a thread ficava 87% ocupada e 67% de tudo
     * era `drawImage` — 836 desenhos de mapa por quadro, quarenta mil por
     * segundo, para repintar uma tela que não mudou um pixel.
     *
     * Num jogo de caçada automática esse é o estado em que o aparelho passa a
     * maior parte do tempo: aberto no bolso, com o boneco parado ou rendendo
     * sozinho. Redesenhar ali não entrega nada a ninguém — só esquenta o
     * telefone e come bateria.
     *
     * ---- Não é corte de quadros ----
     *
     * O `tetoDeQuadros` lá em cima corta quadros que TERIAM mudado, e o dono já
     * recusou isso como padrão pelo motivo certo: "o modo lite não era pro jogo
     * ficar sem fps", o boneco anda aos pulos. Aqui é o contrário — só se pula o
     * quadro que sairia IDÊNTICO ao que já está na tela. No instante em que
     * qualquer coisa se mexe, o desenho volta a acontecer a cada passada do
     * monitor.
     *
     * O `contarQuadro` fica ACIMA de propósito: a tela está mostrando a imagem
     * certa e em dia, e o número do canto continua dizendo a verdade.
     */
    /*
     * A camera e' remedida ANTES da pergunta, e nao depois.
     *
     * Ela e' calculada dentro do desenho, a partir do instante: enquanto o
     * boneco anda, ela desliza alguns pixels por quadro. Perguntando antes de
     * remedi-la, a comparacao seria sempre com ela mesma — e o quadro seria
     * pulado justamente durante o passo, que e' quando mais se precisa
     * desenhar. Medido: com a ordem trocada, andar saia a 18 desenhos por
     * segundo em vez de acompanhar o monitor.
     *
     * Remedir e' aritmetica, custa nada, e nao pinta pixel nenhum.
     */
    if (this.snapshot) this.updateCamera(now);
    if (this.podePularQuadro(now)) return;
    this.trocaDeAnimacao = Infinity;

    ctx.fillStyle = '#06080a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.limparOverlay();
    if (!this.snapshot) return;
    /*
     * O mapa: uma passada só, na ordem do client.
     *
     * `drawMapa` cuida dos mapas de paleta (cidade e hunts) desenhando cada
     * casa com a pilha inteira; `buildGround` + `drawAnimated` são o caminho
     * antigo, dos mapas gerados de três camadas. Um dos dois trabalha por vez.
     */
    this.buildGround();
    if (this.groundCache) ctx.drawImage(this.groundCache, -this.camera.x, -this.camera.y);
    this.drawAnimated(now);

    /*
     * ---- A ordem de desenho ----
     *
     * As criaturas são pintadas DENTRO da casa delas, e não todas juntas depois
     * do mapa. É a ordem do `Tile::draw` do client — itens da casa, depois a
     * criatura — e é ela que resolve as duas coisas que se pediram aqui:
     *
     * 1. O PILAR PASSA NA FRENTE. O que é desenhado depois cobre: as casas mais
     *    ao sul e à direita, e o que é alto nelas.
     *
     * 2. O TELHADO ESCONDE O BICHO, E O NOME FICA. Estando embaixo de um andar
     *    de cima, a criatura do MEU andar não pode aparecer por cima da laje —
     *    era o defeito da foto, com sete minotauros pintados sobre o telhado. O
     *    teto vem depois das criaturas e as cobre.
     *
     *    E o nome continua legível sem nenhum trabalho extra: ele não é
     *    desenhado no canvas do mapa, e sim numa camada de texto por cima de
     *    tudo. Some o corpo, fica o nome — que é exatamente o que se pediu.
     *
     * A única exceção é o PERSONAGEM. Debaixo de uma laje ele sumia inteiro, e
     * num jogo em que se assiste o próprio boneco isso é pior que a laje fora de
     * ordem. Ele é repintado depois do teto, sem o nome — repintar o nome
     * empilharia dois traçados e o escureceria.
     */
    const entities = [...this.entities.values()].sort((a, b) => a.y - b.y || (a.isPlayer ? 1 : -1));

    /*
     * ---- Em que CASA a criatura é desenhada, enquanto ela anda ----
     *
     * `entity.x` e `entity.y` são a casa de DESTINO: elas mudam no instante em
     * que o passo começa, e o sprite só chega lá no fim dele. Desenhando pela
     * casa de destino, quem anda passa o passo inteiro atrás das casas que ainda
     * está deixando — porque essas casas são desenhadas DEPOIS.
     *
     * A varredura vai de cima para baixo e da esquerda para a direita, então o
     * defeito só aparecia em DUAS das quatro direções: indo para o norte e indo
     * para o oeste. Para o sul e para o leste o destino já é a casa desenhada
     * mais tarde, e nada cobria ninguém. Foi assim que apareceu — primeiro o
     * norte, e depois de consertado só o oeste, que é a mesma coisa um eixo ao
     * lado.
     *
     * A regra vale para os dois eixos e é uma só: durante o passo a criatura
     * ocupa as duas casas, então ela sai na que a varredura desenha por ÚLTIMO —
     * a mais ao sul, a mais à direita.
     */
    const andando = (entity) => now - entity.since < entity.duration;
    const casaDe = (entity, eixo) => {
      const destino = Math.round(entity[eixo]);
      const veio = Math.round(entity[eixo === 'x' ? 'fromX' : 'fromY'] ?? entity[eixo]);
      if (veio === destino || !andando(entity)) return destino;
      return Math.max(veio, destino);
    };

    const porCasa = new Map();
    const chaveDaCasa = (x, y) => y * 4096 + x;
    for (const entity of entities) {
      const k = chaveDaCasa(casaDe(entity, 'x'), casaDe(entity, 'y'));
      if (!porCasa.has(k)) porCasa.set(k, []);
      porCasa.get(k).push(entity);
    }

    /*
     * As casas que o mapa de fato varreu.
     *
     * `desenharCamada` só percorre o retângulo da câmera, e desiste cedo sem
     * mapa carregado ou com o atlas ainda baixando. Quem estivesse numa casa não
     * varrida não seria desenhado — bicho invisível batendo em você, bem pior
     * que um pilar fora de ordem.
     */
    /*
     * Os objetos soltos, indexados por casa como as criaturas — e desenhados
     * ANTES delas na mesma casa: o boneco é cenário, quem bate nele fica na
     * frente.
     */
    const objetosPorCasa = new Map();
    for (const objeto of this.objetos ?? []) {
      const k = chaveDaCasa(objeto.x, objeto.y);
      if (!objetosPorCasa.has(k)) objetosPorCasa.set(k, []);
      objetosPorCasa.get(k).push(objeto);
    }

    /*
     * ---- Quais linhas NÃO podem virar imagem pronta ----
     *
     * As que têm criatura ou objeto no meio: é dentro delas que a ordem entre a
     * casa e quem está nela é decidida, e uma tira pronta desenharia a linha
     * inteira antes da criatura. Ver `tiraDaLinha`.
     *
     * A chave da casa é `y * 4096 + x`, então a linha sai da divisão.
     */
    /*
     * O NOME de um letreiro não conta, e é quase tudo o que há.
     *
     * Medido na praça: 18 objetos, DEZOITO deles sem figura — são placas
     * ("Treino Offline", "Exercise Dummy"), e o nome delas não é desenhado no
     * canvas do mapa, e sim na camada de texto por cima. Contar essas linhas
     * como vivas deixava 13 das 15 linhas da tela fora do cache por causa de um
     * desenho que nem acontece ali.
     *
     * Só a figura obriga: ela sim é pintada no mapa, dentro da casa, e a ordem
     * dela em relação às vizinhas importa.
     */
    this.linhasVivas = new Set();
    // E EM QUE COLUNAS de cada linha viva há alguém: é ali que a linha é cortada
    // em pedaços prontos (ver `desenharLinhaEmPedacos`).
    this.colunasVivas = new Map();
    const marcarViva = (k) => {
      const y = Math.floor(k / 4096);
      this.linhasVivas.add(y);
      if (!this.colunasVivas.has(y)) this.colunasVivas.set(y, new Set());
      this.colunasVivas.get(y).add(k % 4096);
    };
    for (const k of porCasa.keys()) marcarViva(k);
    for (const [k, lista] of objetosPorCasa) {
      if (lista.some((objeto) => objeto.item)) marcarViva(k);
    }

    const varridas = new Set();
    this.drawMapa(now, (x, y) => {
      const k = chaveDaCasa(x, y);
      varridas.add(k);
      for (const objeto of objetosPorCasa.get(k) ?? []) {
        // Sem figura: o boneco que está DESENHADO no mapa já foi pintado pela
        // pilha da casa, e o registro dele só existe para o nome e para o
        // clique. Pintá-lo de novo seria o mesmo sprite duas vezes.
        if (objeto.item) {
          desenharPilhaDaCasa(
            this.ctx,
            objeto,
            x * TILE - this.camera.x,
            y * TILE - this.camera.y,
            now
          );
        }
        if (objeto.nome) this.drawNomeDoObjeto(objeto, x, y, now);
      }
      for (const entity of porCasa.get(k) ?? []) this.drawEntity(entity, now);
    });
    for (const [k, lista] of porCasa) {
      if (varridas.has(k)) continue;
      for (const entity of lista) this.drawEntity(entity, now);
    }
    /*
     * E o nome dos letreiros que ficaram numa linha copiada pronta.
     *
     * Ele vai na camada de TEXTO, que é outro canvas: a ordem dele em relação
     * ao mapa não existe, e em relação aos outros nomes só muda se dois se
     * sobrepuserem — o que o `tools/test-mapa-identico.mjs` confere.
     */
    for (const [k, lista] of objetosPorCasa) {
      if (varridas.has(k)) continue;
      const x = k % 4096;
      const y = Math.floor(k / 4096);
      for (const objeto of lista) {
        if (objeto.nome) this.drawNomeDoObjeto(objeto, x, y, now);
      }
    }

    // O teto cobre o mapa E as criaturas. Os nomes ficam: outra camada.
    const teveTeto = this.drawTeto(now);

    /*
     * Só o personagem volta por cima da laje, e sem repintar o nome.
     *
     * ---- E só quando a laje encosta NELE ----
     *
     * Report do dono, com foto: o boneco passava POR CIMA de pilar e parede
     * que deviam cobri-lo ("alguns pilares têm que mostrar o boneco atrás").
     * `drawTeto` diz "pintei algum andar de cima", e isso é verdade em qualquer
     * lugar a céu aberto perto de um prédio — o telhado lá do lado conta. A
     * repintura então saía em toda a praça, e ela passa por cima de TUDO: o
     * pilar da casa de baixo, que a varredura tinha acabado de pôr na frente
     * do boneco, ficava atrás dele. Onde nenhum andar de cima aparece (a
     * posição 32394,32216 da cidade) já saía certo, e é por isso que parecia
     * coisa de um item e não de lugar.
     *
     * Agora a repintura só acontece se o teto tem pilha numa das casas que
     * podem tapar o sprite do personagem. Fora disso vale a ordem da varredura.
     */
    if (teveTeto) {
      const eu = entities.find((entity) => entity.isPlayer);
      if (eu && this.tetoCobre(casaDe(eu, 'x'), casaDe(eu, 'y'))) this.drawEntity(eu, now, true);
    }

    /*
     * O efeito vem depois das criaturas: o acerto sai por cima do corpo do
     * alvo, como no client — antes ele ficava escondido atrás do bicho.
     *
     * As três chamadas são guardadas pelas chaves de gráficos, e não só o
     * `push` lá no `addEvents`: quem apaga a chave no meio de uma caçada tem
     * uma fila de até um segundo já na memória, e ela apagaria na cara da
     * pessoa que acabou de pedir para não ver mais aquilo.
     *
     * `drawTexts` continua sendo chamado com os números desligados porque ele
     * também desenha as FALAS — o nome da magia saindo do boneco, que é outra
     * coisa e não está na chave.
     */
    // Baús e altares (se a caçada tem): por cima do chão e das criaturas, antes dos efeitos.
    if (this.snapshot?.instancia?.encontros?.length) {
      desenharMarcadores(this.ctx, this.snapshot.instancia.encontros, { camX: this.camera.x, camY: this.camera.y, tile: TILE, z: this.snapshot.z, jogador: this.snapshot.player, desenharItem: drawItem });
    }
    // As SAFE ZONES do andar (`map.seguras`, o editor de mapas): um véu e a borda, por baixo dos efeitos.
    this.drawZonasSeguras();
    if (graficoLigado('efeitos')) this.drawEffects(now);
    if (graficoLigado('projeteis')) this.drawMissiles(now);
    // O portal de saída da viagem: sempre (não é enfeite — é a viagem), por cima de tudo, com a barra na camada de texto.
    this.drawPortalDeSaida(now);
    this.drawPortalDeChegada(now);
    this.drawTexts(now);
    this.drawSeloDeProtecao();

    /*
     * ---- E o desenho anota o que acabou de pintar ----
     *
     * E com isto que o quadro seguinte descobre se tem algo novo a fazer. Fica
     * no FIM, depois de tudo: anotado no comeco, um `return` no meio (atlas
     * ainda baixando, retrato que sumiu) deixaria a memoria dizendo que a tela
     * esta em dia quando ela nao esta.
     *
     * `trocaDeAnimacao` foi sendo baixado por `desenharCamada` a cada sprite
     * animado visivel; `Infinity` quer dizer que nao ha nenhum, e af a tela so
     * volta a ser pintada quando alguma coisa se mexer.
     */
    this.desenhadoEm = now;
    this.cameraDesenhada = { x: this.camera.x, y: this.camera.y };
    this.trocaDeAnimacaoEm = now + this.trocaDeAnimacao;
  };
}
