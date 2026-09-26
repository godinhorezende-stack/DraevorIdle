/*
 * ---- A árvore de habilidades ----
 *
 * A arte é a tábua, com a treliça inteira ESCULPIDA nela: setenta e poucos
 * discos de bronze, cem hastes ligando-os, três medalhões no alto e um brasão
 * no pé. O que este arquivo desenha por cima é só a luz — o aro que acende e a
 * haste que corre quando o ponto é gasto.
 *
 * As posições e o grafo vêm do servidor em fração da imagem, medidos no png por
 * `tools/medir-treliça.mjs`: a arte manda, o dado obedece.
 *
 * ---- O painel é um RASCUNHO ----
 *
 * Clicar não gasta nada: monta um plano em cima do que já existe, e o plano só
 * vira árvore no botão Aplicar. Dá para montar meia árvore, ver o que ela daria
 * e desistir — coisa que antes exigia gastar de verdade e depois zerar tudo.
 *
 * E clicar num nó longe COMPRA O CAMINHO até ele, pelo trajeto mais barato.
 * Numa treliça há vários caminhos até o mesmo ponto; achar o de menor preço é
 * conta de computador, não trabalho de quem está jogando.
 */
import { fecharAoClicarFora, atalhosDaCaixa } from './windows.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

let ctx = null;

export function initArvore(context) {
  ctx = context;
}

export function openArvore() {
  ctx.send({ t: 'arvore' });
  ctx.openModal('Árvore de habilidades', (body) => {
    /*
     * ---- O rascunho só morre quando a ÁRVORE muda ----
     *
     * A intenção sempre foi esta: descartar o plano quando o servidor manda
     * árvore nova — ou o Aplicar deu certo (e o rascunho virou estado), ou o
     * personagem mudou por fora, e insistir num plano montado sobre um estado
     * velho seria pior do que recomeçar.
     *
     * O que estava errado era o gatilho. `redraw` é um gancho COMPARTILHADO:
     * quatorze tipos de mensagem o disparam — ranking, amigos, loja, charms,
     * montarias, arena, e o `actionCatalog`. E o `actionCatalog` é empurrado
     * pelo servidor toda vez que o personagem sobe de level ou de magic level,
     * porque é o que faz uma magia recém-liberada aparecer no editor de slot
     * sem reabrir o painel (ver `assinatura` em server/src/index.mjs).
     *
     * Ou seja: caçando, cada level novo apagava o plano que o jogador estava
     * montando. Ele marcava os pontos, o boneco subia de nível no meio, e a
     * seleção sumia sozinha — "vc tem que ficar tentando colocar o ponto e
     * apertar em aplicar mto rápido", como veio no report.
     *
     * A assinatura abaixo é a resposta: o rascunho sobrevive a qualquer
     * redesenho que não tenha mexido na árvore.
     */
    let assinatura = assinaturaDaArvore(ctx.state?.arvore);

    ctx.redraw = () => {
      const agora = assinaturaDaArvore(ctx.state?.arvore);
      if (agora !== assinatura) {
        assinatura = agora;
        rascunho = null;
      }
      renderArvore(body);
    };
    /*
     * ---- E ela só renasce quando a ÁRVORE muda ----
     *
     * O `redraw` acima já protegia o RASCUNHO de ser apagado por um redesenho
     * alheio, mas o redesenho acontecia mesmo assim: a assinatura global inclui
     * ouro, peso e mochila, e caçando isso refazia a tela 0,50 vez por segundo.
     * O plano sobrevivia; a rolagem, o balão aberto e o dedo no meio do clique,
     * não.
     *
     * Aqui a conta é a mesma que decide se o rascunho vale: mudou a árvore,
     * redesenha; não mudou, fica quieta.
     */
    ctx.redrawKey = () => assinaturaDaArvore(ctx.state?.arvore);
    rascunho = null;
    renderArvore(body);
  });
}

/*
 * O retrato da árvore que o servidor mandou: os pontos e o que já está gasto.
 *
 * É só o que faz um plano velho deixar de valer. O resto do `view` — nomes,
 * posições, preços das vias — é catálogo, e catálogo não muda no meio de uma
 * sessão.
 */
function assinaturaDaArvore(view) {
  if (!view) return '';
  /*
   * O que já está gasto mora em `no.gasto`, um por nó — é de lá que
   * `planoAtual` monta o aplicado. Os pontos entram junto porque subir de level
   * dá pontos novos sem mexer em nó nenhum.
   */
  // As habilidades escolhidas entram também: escolher uma não mexe em ponto nenhum,
  // e sem isto o painel continuava mostrando a vaga livre.
  return JSON.stringify([view.pontos, view.nos.map((no) => no.gasto ?? 0), view.habilidades?.escolhidas ?? [], view.montagens ?? []]);
}

/* ------------------------------------------------------------------ rótulos */

/*
 * A chave é `tipo` ou `tipo:alvo`, igual à que o servidor manda no nó. O
 * segundo campo diz como escrever o número (`pct` multiplica por cem) e o
 * terceiro é o ícone — o mesmo conjunto que a ficha do personagem usa, para o
 * jogador reconhecer cada linha sem ler.
 */
const ROTULOS = {
  absorb: ['Absorção', 'pct', 'ficha-elemental'],
  armorPenetration: ['Penetração de armadura', 'pct', 'ficha-armadura'],
  attackDamage: ['Dano', 'pct', 'ficha-dano'],
  attackInterval: ['Tempo entre golpes', 'pct', 'ficha-tempo'],
  attackRange: ['Alcance', 'cru', 'ficha-alcance'],
  blockChance: ['Chance de bloqueio', 'pct', 'ficha-bloqueio'],
  critChance: ['Chance de crítico', 'pct', 'ficha-critico'],
  critDamage: ['Dano crítico', 'pct', 'ficha-critico'],
  defense: ['Defesa', 'cru', 'ficha-defesa'],
  lifeLeech: ['Roubo de vida', 'pct', 'ficha-life-leech'],
  lifeOnHit: ['Vida por golpe', 'cru', 'ficha-life-leech'],
  lifeOnKill: ['Vida por abate', 'cru', 'bes-vida'],
  manaLeech: ['Roubo de mana', 'pct', 'ficha-mana-leech'],
  manaOnHit: ['Mana por golpe', 'cru', 'ficha-mana-leech'],
  manaOnKill: ['Mana por abate', 'cru', 'ficha-regen-mana'],
  maxHp: ['Vida', 'pct', 'bes-vida'],
  maxMana: ['Mana', 'pct', 'ficha-regen-mana'],
  regenHp: ['Regeneração de vida', 'pct', 'ficha-regen-vida'],
  custoDeMana: ['Custo de mana das magias', 'pct', 'ficha-regen-mana'],
  danoRecebido: ['Dano recebido', 'pct', 'ficha-defesa'],
  cura: ['Força de cura', 'pct', 'ficha-regen-vida'],
  flechaAtravessa: ['Flecha que atravessa', 'pct', 'sk-distance'],
  regenMana: ['Regeneração de mana', 'pct', 'ficha-regen-mana'],
  speed: ['Velocidade', 'cru', 'ficha-velocidade'],
  /*
   * O dano elemental da árvore AUMENTA o dano daquele elemento em tudo o que o
   * personagem causa — magia, runa e arma: "+10% de dano de gelo" é cada dano
   * de gelo sair 10% maior. (Até 12 de setembro era um segundo golpe, só na
   * arma; ver `danoPorElemento`, em character.mjs.)
   */
  'elemento:physical': ['Dano físico', 'pct', 'el-physical'],
  'elemento:fire': ['Dano de fogo', 'pct', 'el-fire'],
  'elemento:earth': ['Dano de terra', 'pct', 'el-earth'],
  'elemento:energy': ['Dano de energia', 'pct', 'el-energy'],
  'elemento:ice': ['Dano de gelo', 'pct', 'el-ice'],
  'elemento:holy': ['Dano sagrado', 'pct', 'el-holy'],
  'elemento:death': ['Dano de morte', 'pct', 'el-death'],
  'skill:melee': ['Skill corpo a corpo', 'cru', 'sk-sword'],
  'skill:distance': ['Skill de distância', 'cru', 'sk-distance'],
  'skill:fist': ['Skill de punho', 'cru', 'sk-fist'],
  'skill:magic': ['Magic level', 'cru', 'sk-magic'],
  'skill:shielding': ['Shielding', 'cru', 'sk-shielding'],
};

/*
 * Onde subir é PIORAR: quase todo bônus é melhor quanto maior, e por isso um
 * valor negativo é o custo da via. O intervalo entre golpes é o contrário.
 */
const PIOR_QUANDO_SOBE = new Set(['attackInterval', 'custoDeMana', 'danoRecebido']);
const ehCusto = (chave, valor) => (PIOR_QUANDO_SOBE.has(chave) ? valor > 0 : valor < 0);

const chaveDoNo = (no) => (no.alvo ? `${no.tipo}:${no.alvo}` : no.tipo);

const gold = (valor) => `${Math.round(Number(valor) || 0).toLocaleString('pt-BR')} gold`;

/*
 * O plano TIRA algum grau do que está aplicado? É o que o servidor cobra — ver
 * `precoParaRefazer`. Acrescentar é de graça; trocar de montagem quase sempre
 * tira alguma coisa, e por isso quase sempre cobra.
 */
const planoTiraGrau = (plano, aplicado) =>
  Object.keys({ ...plano, ...aplicado }).some((id) => (plano[id] ?? 0) < (aplicado[id] ?? 0));

function escrever(chave, valor) {
  const [, formato] = ROTULOS[chave] ?? [chave, 'cru'];
  const sinal = valor > 0 ? '+' : '';
  if (formato === 'pct') return `${sinal}${(valor * 100).toFixed(1).replace('.0', '')}%`;
  return `${sinal}${Math.round(valor * 100) / 100}`;
}

function icone(chave) {
  const [, , nome] = ROTULOS[chave] ?? [];
  if (!nome) return null;
  const img = document.createElement('img');
  img.className = 'arvore-ico';
  img.src = `/client/assets/icons/${nome}.png`;
  img.alt = '';
  return img;
}

/*
 * ---- Quanto de nó há em volta do raio medido ----
 *
 * `no.raio` mede o DISCO do nó, e o `0.82` de `medir` encolhe mais um pouco,
 * porque o aro dourado do nó comprado tem de ficar POR DENTRO do disco. Isso
 * está certo para o aro.
 *
 * Está errado para o realce, que precisa do contrário: cobrir o nó inteiro,
 * ornamento e tudo. E o ornamento não é proporcional ao disco — o medalhão tem
 * um anel de bronze largo em volta, o brasão do pé tem espinhos, e o nó comum
 * é uma bolinha lisa que acaba antes do próprio raio medido.
 *
 * Estes números saíram de medir na arte, com círculos desenhados por cima das
 * cinco treliças: o realce antigo (1,19 do raio, para todo mundo) cortava o
 * medalhão e o brasão nas cinco vocações, e sobrava nos nós comuns.
 *
 * São múltiplos de `p.r`, e não do raio medido — por isso já vêm com o 0.82
 * embutido. `1.9` de `p.r` é 1,55 do raio.
 */
const REALCE_DA_ESCALA = { medalhao: 1.9, base: 2.05, grande: 1.5, comum: 1.4 };

/*
 * Quanto o miolo de cada escala acende.
 *
 * A arte já hierarquiza por tamanho — o medalhão é seis vezes o rebite comum.
 * Acendendo todos com a mesma força, o canvas desfaz isso: cinquenta pontinhos
 * tão brilhantes quanto os três remates do alto, e o olho perde onde estão as
 * decisões grandes.
 */
const FORCA_DO_MIOLO = { medalhao: 0.42, base: 0.4, grande: 0.32, comum: 0.2 };

const CORES = {
  /* O ouro do Ravera, de onde esta paleta veio: `--gold` e `--gold2`. */
  aceso: '#d8a441',
  claro: '#f2e4c4',
  apagado: 'rgba(138, 106, 36, 0.40)',
  haste: 'rgba(138, 106, 36, 0.22)',
  brilho: 'rgba(216, 164, 65, 0.85)',
  /* O que é só rascunho sai em azul: vê-se o proposto sem confundir. */
  rascunho: '#8fbcd8',
  rascunhoBrilho: 'rgba(143, 188, 216, 0.8)',
  rascunhoClaro: '#bcdcf2',
  /*
   * O VÉU: a mesma cor da haste acesa, translúcida.
   *
   * É a camada larga que faz a luz, por baixo do fio. Ela precisa ser
   * transparente ao ponto de duas hastes que se cruzam somarem sem virar um
   * borrão — e são duzentas hastes numa treliça de druid.
   */
  veu: 'rgba(216, 164, 65, 0.14)',
  rascunhoVeu: 'rgba(143, 188, 216, 0.14)',
  /*
   * O BAFO: a luz que a haste derrama na pedra. Fraco ao ponto de não se ver
   * sozinho — o que se vê é a tábua em volta ficando menos escura.
   */
  bafo: 'rgba(216, 164, 65, 0.045)',
  rascunhoBafo: 'rgba(143, 188, 216, 0.045)',
  /*
   * O centro da pedra acesa. A força vem por fora (ver `FORCA_DO_MIOLO`): um
   * rebite comum e um medalhão não podem acender igual, ou a treliça vira um
   * campo de pontos idênticos e a hierarquia que a ARTE desenhou se perde.
   */
  miolo: (a) => `rgba(230, 186, 96, ${a})`,
  rascunhoMiolo: (a) => `rgba(160, 205, 232, ${a})`,
  /*
   * O FIO da haste acesa: ouro pálido, e não o creme de `claro`.
   *
   * O creme é quase branco, e branco sobre pedra escura lê como néon — a linha
   * parece desenhada POR CIMA da tábua em vez de ser a tábua acendendo. Este
   * tom fica meio caminho entre o ouro do entalhe e a luz, que é o que um metal
   * iluminado faz.
   */
  fio: '#eccf8e',
};

/* -------------------------------------------------------------- o rascunho */

let rascunho = null;

/*
 * ---- O realce: o que ESTE rumo compraria ----
 *
 * Passar o rato num rumo acende na treliça exatamente os nós que ele compraria
 * — não a via inteira, e sim o trajeto. É o detalhe que transforma três nomes
 * numa escolha: "Muralha" não quer dizer nada até você ver por onde ela anda e
 * quanto da tábua ela toma.
 *
 * Começou realçando a VIA, e isso tinha um buraco: o Equilibrado não tem via, e
 * era o único cartão que não acendia nada ao passar o rato. Realçar o trajeto
 * conserta os dois de uma vez — o Equilibrado ganha o realce que faltava, e os
 * outros três passam a mostrar o caminho de verdade em vez da região.
 *
 * Só quando não há trajeto a mostrar (a via já cheia, ou sem ponto à espera) é
 * que a região volta a servir: melhor ver onde a via fica do que não ver nada.
 *
 * Mora fora de `pintar` porque quem mexe é a coluna da esquerda e quem desenha
 * é o canvas, e os dois nascem em funções diferentes. `repintar` é o telefone
 * entre eles: `pintar` deixa o número aqui ao montar, e a coluna liga.
 */
let nosEmDestaque = null;
let repintar = null;

/*
 * ---- A ONDA ----
 *
 * Ao aplicar, a luz sai do brasão e sobe pela treliça até as pontas do que foi
 * comprado, uma fileira de nós por vez. Dura menos de um segundo e acaba.
 *
 * Ela existe porque aplicar é o único momento em que a árvore MUDA, e até aqui
 * a mudança acontecia sem nada acontecer na tela: a treliça simplesmente já
 * estava dourada no quadro seguinte. O ganho não era comemorado em lugar
 * nenhum, e um ganho que não se vê acontecer não parece um ganho.
 *
 * É por isso também que ela vai do BRASÃO para fora, e não de qualquer jeito:
 * a árvore cresce de lá, e a onda mostra o caminho que a luz percorreu — quem
 * comprou um ramo inteiro vê o ramo inteiro acender na ordem em que ele foi
 * conquistado.
 *
 * Roda UMA VEZ, disparada pelo servidor ter aceitado (ver `gastoAnterior`), e
 * não em laço: o que pisca sempre vira ruído de fundo e deixa de significar
 * qualquer coisa.
 */
const DURACAO_DA_ONDA = 950;
let acenderEm = 0;
let gastoAnterior = null;

const planoAtual = (view) => {
  const base = {};
  for (const no of view.nos) if (no.gasto) base[no.id] = no.gasto;
  return base;
};
const planoEmUso = (view) => rascunho ?? planoAtual(view);

function custoDoPlano(view, plano) {
  let total = 0;
  for (const no of view.nos)
    for (let g = 0; g < (plano[no.id] ?? 0); g++) total += no.custos[g] ?? 0;
  return total;
}

/*
 * ---- O caminho mais barato até um nó ----
 *
 * Numa treliça há vários trajetos até o mesmo ponto, e eles não custam a mesma
 * coisa: um passa por três nós comuns, outro por uma encruzilhada cara. Achar o
 * mais barato é Dijkstra, com o peso de ENTRAR num nó sendo o preço do primeiro
 * grau dele — nó que já tem grau custa zero, porque já está pago.
 *
 * Sem isso, clicar num nó do alto ou obrigava a comprar mão por mão, ou pegava
 * um caminho qualquer e cobrava mais caro do que precisava. O jogador aponta
 * aonde quer chegar; escolher por onde ir é conta, e conta é com o computador.
 */
function caminhoAte(view, plano, alvoId) {
  const porId = new Map(view.nos.map((no) => [no.id, no]));
  const custoDe = (id) => ((plano[id] ?? 0) > 0 ? 0 : (porId.get(id)?.custos[0] ?? Infinity));

  const dist = new Map();
  const veioDe = new Map();
  const fila = [];
  // As pontas: tudo o que já está comprado, e o brasão, que não depende de nada.
  for (const no of view.nos)
    if ((plano[no.id] ?? 0) > 0 || no.escala === 'base') {
      dist.set(no.id, custoDe(no.id));
      fila.push(no.id);
    }
  if (!fila.length) return null;

  const visto = new Set();
  while (fila.length) {
    fila.sort((a, b) => dist.get(a) - dist.get(b));
    const atual = fila.shift();
    if (visto.has(atual)) continue;
    visto.add(atual);
    if (atual === alvoId) break;
    for (const v of porId.get(atual)?.vizinhos ?? []) {
      const novo = dist.get(atual) + custoDe(v);
      if (novo < (dist.get(v) ?? Infinity)) {
        dist.set(v, novo);
        veioDe.set(v, atual);
        fila.push(v);
      }
    }
  }
  if (!dist.has(alvoId)) return null;

  const caminho = [];
  let passo = alvoId;
  while (passo != null) {
    caminho.unshift(passo);
    passo = veioDe.get(passo);
  }
  return caminho;
}

/* ------------------------------------------------------------------- rumos */

/*
 * ---- O ajudante de árvore ----
 *
 * Clicar num nó já compra o caminho até ele (ver `subir`), o que resolve metade
 * do problema: chegar a um lugar escolhido é uma clicada. A outra metade é
 * ESCOLHER O LUGAR — e é ela que faz alguém abrir a treliça, olhar setenta
 * bolinhas iguais e fechar sem gastar nada.
 *
 * O ajudante responde a essa metade. A árvore já se declara dividida em três
 * vias, cada uma com nome e uma frase do que ela faz ("Muralha — segura o que
 * vem"). Escolher um rumo é escolher uma dessas três; o resto é conta.
 *
 * ---- Por que ele é GULOSO, e não ótimo ----
 *
 * O trajeto ótimo dentro de um orçamento é mochila com grafo — caro de calcular
 * e impossível de explicar. O guloso compra sempre o grau mais barato POR
 * PROVEITO, e o proveito é só isto: um nó do rumo escolhido vale quatro vezes
 * um nó fora dele, e os nós grandes valem mais que os comuns.
 *
 * Isso basta porque o resultado não é obrigatório. Ele cai no RASCUNHO, em
 * azul, com o resumo do que dá e do que tira ao lado — o jogador vê a proposta
 * inteira antes de apertar Aplicar, e pode mexer nó a nó em cima dela. O
 * ajudante não decide a árvore de ninguém: ele tira a página em branco.
 */

/*
 * Quanto vale gastar um ponto neste nó. Divide o preço; menor é melhor.
 */
const PESO_DA_ESCALA = { medalhao: 4, grande: 2.2, base: 1, comum: 1 };

/*
 * ---- A bússola: a quantos saltos cada nó está da via escolhida ----
 *
 * Sem ela o guloso andava às cegas. A regra era "nó do rumo vale quatro vezes
 * um nó de fora", e nós de fora valiam todos o mesmo — então, enquanto a via
 * escolhida estivesse longe, ele comprava o mais barato da treliça inteira, em
 * qualquer direção, e só encontrava a via por acaso.
 *
 * O estrago aparecia nas vias do MEIO. O brasão fica no pé da tábua e o
 * medalhão do meio no alto: são muitos saltos, e com pouco ponto o guloso
 * gastava tudo antes de chegar. Escolher "Santificado" com sessenta pontos dava
 * exatamente a mesma árvore que escolher "Equilibrado" — mesmos nós, mesmos
 * números. Dois rumos que compram a mesma coisa não são duas escolhas.
 *
 * Uma busca em largura a partir da via inteira resolve: cada nó fica sabendo a
 * quantos saltos ele está dela, e o peso vira `1 / (1 + saltos)`. Nó da via
 * vale 1, vizinho dela 1/2, o de dois saltos 1/3. O caminho mais curto até a
 * via passa a ser o mais barato POR PROVEITO, e o guloso anda para lá em vez de
 * vagar.
 */
function saltosAteAVia(view, viaId) {
  const porId = new Map(view.nos.map((no) => [no.id, no]));
  const salto = new Map();
  const fila = [];
  for (const no of view.nos)
    if (no.via === viaId) {
      salto.set(no.id, 0);
      fila.push(no.id);
    }
  for (let f = 0; f < fila.length; f++) {
    const atual = fila[f];
    for (const v of porId.get(atual)?.vizinhos ?? [])
      if (!salto.has(v)) {
        salto.set(v, salto.get(atual) + 1);
        fila.push(v);
      }
  }
  return salto;
}

function alcancavelNoPlano(plano, no) {
  if (no.escala === 'base') return true;
  return no.vizinhos.some((v) => (plano[v] ?? 0) > 0);
}

/**
 * Gasta os pontos livres na direção de uma via. `viaId` nulo = sem preferência,
 * que na prática é "o mais barato primeiro, por toda a treliça".
 *
 * ---- Ele PARA quando a via enche ----
 *
 * As três vias não têm o mesmo tamanho, e a diferença é grande: a do meio tem
 * seis a dez nós (uns 60 pontos), as das pontas têm trinta ou sessenta. Quem
 * escolhesse a do meio com 200 pontos à espera veria 130 deles irem para outro
 * lugar — pediu Fôlego e levou Fúria.
 *
 * Então o rumo escolhido é um TETO: enchida a via, o que sobra fica sobrando, e
 * a nota embaixo diz quanto. Escolher outro rumo em seguida continua de onde
 * este parou, porque tudo isso é rascunho — dá para traçar Fôlego e depois
 * Muralha, e a árvore fica com as duas.
 *
 * Devolve `{ plano, gasto, sobrou }`, ou `null` se não deu para comprar nada.
 */
function gastarNoRumo(view, plano, viaId, livres) {
  const novo = { ...plano };
  const salto = viaId ? saltosAteAVia(view, viaId) : null;
  let restante = livres;
  let comprou = false;
  // Ainda há grau por comprar na via escolhida? Sem isso o guloso transbordaria
  // para as vizinhas assim que a via do meio enchesse.
  const faltaNoRumo = () =>
    !viaId || view.nos.some((no) => no.via === viaId && (novo[no.id] ?? 0) < no.graus);

  while (restante > 0 && faltaNoRumo()) {
    let alvo = null;
    let melhorNota = Infinity;
    for (const no of view.nos) {
      const grau = novo[no.id] ?? 0;
      if (grau >= no.graus) continue;
      const preco = no.custos[grau] ?? Infinity;
      if (preco > restante) continue;
      if (!grau && !alcancavelNoPlano(novo, no)) continue;
      // Sem rumo (o Equilibrado) todo nó está a zero saltos de "qualquer lugar".
      const perto = salto ? (salto.get(no.id) ?? 99) : 0;
      const nota = (preco * (1 + perto)) / (PESO_DA_ESCALA[no.escala] ?? 1);
      if (nota < melhorNota) {
        melhorNota = nota;
        alvo = no;
      }
    }
    if (!alvo) break;
    const grau = novo[alvo.id] ?? 0;
    novo[alvo.id] = grau + 1;
    restante -= alvo.custos[grau];
    comprou = true;
  }
  return comprou ? { plano: novo, gasto: livres - restante, sobrou: restante } : null;
}

/*
 * ---- O que o rumo MUDA ----
 *
 * A diferença entre o que o plano dá hoje e o que ele daria depois do rumo. É
 * a informação que decide, e ela só aparecia DEPOIS de clicar, na coluna da
 * direita — o que obrigava a experimentar os três rumos, um a um, para
 * comparar. Aqui ela está antes do clique, nos três ao mesmo tempo.
 *
 * ---- Por que passa por `bonusDoPlano`, e não pelo preço da via ----
 *
 * O cartão já mostrou o preço cru: `via.custo.por` vezes os graus. Ele batia
 * com a definição da via e NÃO batia com a tela — a Aljava cobrava 9,7% de
 * vida, o painel da direita dizia 6,5%, e o jogador via dois números com a
 * mesma palavra na frente.
 *
 * Os dois estavam certos e mediam coisas diferentes. O preço da via é bruto; o
 * painel é líquido, porque os nós de vida comprados pelo caminho devolvem parte
 * do que a via cobra, e `bonusDoPlano` soma tudo na mesma chave. Quem manda é o
 * líquido: é ele que acontece com o personagem.
 *
 * Então o cartão passou a chamar a MESMA função do painel e mostrar a mesma
 * subtração. Não há dois jeitos de contar; há um, e ele mora em `bonusDoPlano`.
 *
 * Só os três maiores de cada lado, e só ícone e número: o cartão tem 196px, e a
 * lista inteira faria dele um segundo painel. O nome vem no `title`, e a conta
 * completa aparece à direita assim que o rumo é traçado.
 *
 * A ordem é pela grandeza DO QUE SE LÊ: 2,4% e 2 pontos de skill viram 2,4 e 2.
 * Comparar unidades diferentes é sempre um pouco arbitrário; ordenar pelo
 * número que o jogador vê é o arbítrio menos surpreendente.
 */
function mudancaDoRumo(view, antes, depois) {
  const de = bonusDoPlano(view, antes).soma;
  const para = bonusDoPlano(view, depois).soma;
  const ganhos = [];
  const perdas = [];
  for (const chave of new Set([...Object.keys(de), ...Object.keys(para)])) {
    const delta = (para[chave] ?? 0) - (de[chave] ?? 0);
    if (!delta) continue;
    const [, formato] = ROTULOS[chave] ?? [chave, 'cru'];
    const item = { chave, delta, peso: formato === 'pct' ? Math.abs(delta * 100) : Math.abs(delta) };
    (ehCusto(chave, delta) ? perdas : ganhos).push(item);
  }
  const maiores = (lista) => lista.sort((x, y) => y.peso - x.peso).slice(0, 3);
  return { ganhos: maiores(ganhos), perdas: maiores(perdas) };
}

/** Quantos graus o plano tem numa via, e quantos ela comporta. */
function grausDaVia(view, plano, viaId) {
  let tem = 0;
  let cabe = 0;
  for (const no of view.nos) {
    if (no.via !== viaId) continue;
    tem += plano[no.id] ?? 0;
    cabe += no.graus;
  }
  return { tem, cabe };
}

/*
 * ---- COMO FICARIA: o quadro que abre ao parar o mouse num rumo ----
 *
 * O dono: "ao deixar o mouse em cima do traçar sozinho tinha que aparecer um
 * modal de como ficaria, mostrando os bônus com os ícones".
 *
 * O cartão só cabe os três maiores ganhos, e o realce na arte mostra POR ONDE
 * o rumo anda, não o que ele dá. O quadro mostra a árvore inteira depois do
 * rumo: cada bônus com o ícone, o total e quanto o rumo acrescenta, e a
 * habilidade de medalhão que ele completaria.
 *
 * Ele mora no `body`, e não no cartão: a coluna rola, e um filho dela seria
 * cortado pela borda. É um só, reaproveitado — e some junto do realce, no
 * `mouseleave` da coluna, pelo mesmo motivo que o realce some ali.
 */
let quadroDoRumo = null;

function esconderQuadroDoRumo() {
  if (quadroDoRumo) quadroDoRumo.hidden = true;
}

function mostrarQuadroDoRumo(view, antes, depois, titulo, subtitulo, ancora) {
  if (!quadroDoRumo || !quadroDoRumo.isConnected) {
    quadroDoRumo = el('div', 'arvore-quadro-rumo');
    document.body.append(quadroDoRumo);
  }
  const q = quadroDoRumo;
  q.innerHTML = '';
  q.append(el('b', 'arvore-quadro-rumo-titulo', titulo));
  if (subtitulo) q.append(el('small', null, subtitulo));

  const de = bonusDoPlano(view, antes).soma;
  const para = bonusDoPlano(view, depois).soma;
  const chaves = Object.keys(para).filter((chave) => para[chave]);
  if (!chaves.length) {
    q.append(el('p', 'empty', 'Nada ainda.'));
  } else {
    const lista = el('div', 'arvore-quadro-rumo-lista');
    for (const chave of chaves) {
      const linha = el('div', null);
      const ico = icone(chave);
      if (ico) linha.append(ico);
      linha.append(el('span', null, (ROTULOS[chave] ?? [chave])[0]));
      linha.append(el('b', null, escrever(chave, para[chave])));
      const delta = para[chave] - (de[chave] ?? 0);
      if (Math.abs(delta) > 1e-9) linha.append(el('i', ehCusto(chave, delta) ? 'custa' : 'ganha', escrever(chave, delta)));
      else linha.append(el('i', null, ''));
      lista.append(linha);
    }
    q.append(lista);
  }

  // As habilidades que o rumo deixaria prontas para escolher.
  const novas = view.nos.filter(
    (no) => no.especial && (depois[no.id] ?? 0) >= no.graus && (antes[no.id] ?? 0) < no.graus
  );
  for (const no of novas) {
    const hab = el('div', 'arvore-quadro-rumo-hab');
    hab.append(el('b', null, `Medalhão completo: ${no.especial.nome}`));
    hab.append(el('small', null, no.especial.texto));
    q.append(hab);
  }

  q.hidden = false;
  // Ao lado do cartão, por cima da arte; sem sair da tela.
  const r = ancora.getBoundingClientRect();
  const largura = q.offsetWidth || 280;
  const altura = q.offsetHeight || 300;
  const esquerda = Math.min(window.innerWidth - largura - 8, r.right + 10);
  const topo = Math.max(8, Math.min(window.innerHeight - altura - 8, r.top));
  q.style.left = `${Math.max(8, esquerda)}px`;
  q.style.top = `${topo}px`;
}

/** A coluna da esquerda: escolher um rumo e deixar o resto com o computador. */
function colunaDeRumos(view, plano, livres, body) {
  const caixa = el('div', 'arvore-rumos');
  caixa.append(el('h4', null, 'Traçar sozinho'));

  const aplicar = (viaId, nome) => {
    const feito = gastarNoRumo(view, plano, viaId, livres);
    if (!feito) return void ctx.notice?.(`${nome} já está cheia`);
    nosEmDestaque = null;
    rascunho = feito.plano;
    renderArvore(body);
    const sobra = feito.sobrou ? `, sobraram ${feito.sobrou}` : '';
    ctx.notice?.(`${nome}: ${feito.gasto} pontos no rascunho${sobra} — confira e aplique`);
  };

  /*
   * O cartão é um BOTÃO com quatro informações, e cada uma responde a uma
   * pergunta diferente de quem está parado sem saber onde gastar:
   *
   *   o nome e a frase — o que é isto?
   *   a barra          — quanto dela eu já tenho?
   *   "gasta N"        — quanto vai me custar agora?
   *   o preço da via   — o que ela cobra em troca?
   *
   * O preço é a parte que ninguém procuraria sozinho, e é metade da decisão:
   * toda via desconta alguma coisa por grau gasto nela. Mostrá-lo aqui, já
   * multiplicado pelo que o rumo compraria, é a diferença entre escolher e
   * apostar.
   */
  /* Quanto custaria encher uma via inteira, do primeiro grau ao último. */
  const custoDaVia = (viaId) =>
    view.nos
      .filter((no) => no.via === viaId)
      .reduce((total, no) => total + no.custos.reduce((x, y) => x + y, 0), 0);

  /*
   * ---- O realce sempre mostra um TRAJETO ----
   *
   * Os nós que o rumo acrescentaria, ligados uns aos outros do brasão até onde
   * ele chega. É o que se quer ver ao passar o rato: por onde este rumo anda.
   *
   * O caso difícil é o personagem SEM ponto à espera — o level 8 recém-criado,
   * que é justamente quem mais precisa entender a árvore antes de escolher.
   * Sem orçamento não há proposta, e o realce caía num plano B ruim: a REGIÃO
   * da via, uma nuvem de pontos soltos que não parece caminho porque não é.
   *
   * Então, sem orçamento de verdade, empresta-se um: o que bastaria para
   * encher a via daquele cartão (o dobro, para pagar as pontes até ela; o
   * guloso para sozinho quando a via enche, então sobrar não faz mal). O
   * traçado que aparece é o mesmo que sairia de verdade no dia em que os
   * pontos existirem.
   *
   * O Equilibrado não tem via para encher, então empresta o orçamento da maior
   * das três — o suficiente para ele desenhar o leque característico dele, e
   * comparável em tamanho com os outros três.
   */
  const aRealcar = (via, previa) => {
    const mostra =
      previa ??
      gastarNoRumo(
        view,
        plano,
        via?.id ?? null,
        via ? custoDaVia(via.id) * 2 : Math.max(...view.vias.map((v) => custoDaVia(v.id))),
      );
    if (mostra)
      return new Set(
        Object.keys(mostra.plano).filter((id) => (mostra.plano[id] ?? 0) > (plano[id] ?? 0)),
      );
    // Só sobra este caso: a via já está cheia. Onde ela fica ainda é resposta.
    if (!via) return null;
    return new Set(view.nos.filter((no) => no.via === via.id).map((no) => no.id));
  };

  /*
   * O plano que o quadro "como ficaria" mostra: a proposta de verdade, ou — sem
   * ponto à espera — a mesma proposta com o orçamento emprestado do realce. Com
   * a via já cheia, a árvore como está.
   */
  const planoDoQuadro = (via, previa) =>
    previa?.plano ??
    gastarNoRumo(
      view,
      plano,
      via?.id ?? null,
      via ? custoDaVia(via.id) * 2 : Math.max(...view.vias.map((v) => custoDaVia(v.id))),
    )?.plano ??
    plano;

  const ligarRealce = (botao, via, previa) => {
    botao.onmouseenter = () => {
      nosEmDestaque = aRealcar(via, previa);
      repintar?.();
      const depois = planoDoQuadro(via, previa);
      const gasto = custoDoPlano(view, depois) - custoDoPlano(view, plano);
      const subtitulo = !gasto
        ? 'nada a acrescentar por este rumo'
        : previa
          ? `gasta ${gasto} ponto${gasto > 1 ? 's' : ''} agora`
          : `precisaria de ${gasto} pontos — você tem ${Math.max(0, livres)}`;
      mostrarQuadroDoRumo(view, plano, depois, `Como ficaria · ${via?.nome ?? 'Equilibrado'}`, subtitulo, botao);
    };
    botao.onmouseleave = () => {
      nosEmDestaque = null;
      repintar?.();
      esconderQuadroDoRumo();
    };
  };

  const fileira = (lista, classe) => {
    if (!lista.length) return null;
    const fila = el('div', `arvore-rumo-ganho${classe ? ' ' + classe : ''}`);
    for (const { chave, delta } of lista) {
      const item = el('span', null);
      const ico = icone(chave);
      if (ico) item.append(ico);
      item.append(el('b', null, escrever(chave, delta)));
      item.title = (ROTULOS[chave] ?? [chave])[0];
      fila.append(item);
    }
    return fila;
  };

  const linhasDaMudanca = (previa) => {
    if (!previa) return [];
    const { ganhos, perdas } = mudancaDoRumo(view, plano, previa.plano);
    return [fileira(ganhos, null), fileira(perdas, 'perde')].filter(Boolean);
  };

  const cartaoDaVia = (via) => {
    const previa = gastarNoRumo(view, plano, via.id, livres);
    const depois = previa?.plano ?? plano;
    const { tem, cabe } = grausDaVia(view, depois, via.id);
    const agora = grausDaVia(view, plano, via.id).tem;
    const cheia = agora >= cabe;

    const cartao = el('button', 'arvore-rumo');
    cartao.append(el('b', null, via.nome));
    if (via.resumo) cartao.append(el('small', null, via.resumo));

    // A barra mostra DOIS estados: o que já está no plano, e o que o rumo
    // acrescentaria — o pedaço claro é a proposta, e some se não houver ponto.
    const barra = el('div', 'arvore-rumo-barra');
    const feito = el('i', null);
    feito.style.width = `${cabe ? (agora / cabe) * 100 : 0}%`;
    const proposto = el('u', null);
    proposto.style.width = `${cabe ? ((tem - agora) / cabe) * 100 : 0}%`;
    barra.append(feito, proposto);
    cartao.append(barra);

    const linha = el('div', 'arvore-rumo-linha');
    linha.append(el('em', null, cheia ? 'completa' : `${agora}/${cabe} graus`));
    if (previa) linha.append(el('span', null, `gasta ${previa.gasto}`));
    cartao.append(linha);

    cartao.append(...linhasDaMudanca(previa));

    // `aria-disabled` e não `disabled`: botão desligado não recebe o mouse, e o
    // quadro "como ficaria" tem de abrir mesmo sem ponto para gastar.
    const semAcao = livres <= 0 || cheia;
    if (semAcao) cartao.classList.add('desligado');
    cartao.setAttribute('aria-disabled', semAcao ? 'true' : 'false');
    cartao.onclick = () => { if (!semAcao) aplicar(via.id, via.nome); };
    ligarRealce(cartao, via, previa);
    return cartao;
  };

  /*
   * O `mouseleave` da COLUNA, e não só o do cartão.
   *
   * Uma mensagem do servidor redesenha o painel inteiro, e o cartão que estava
   * sob o ponteiro é substituído por outro — o `mouseleave` dele nunca chega, e
   * o realce ficaria aceso para sempre. O da coluna chega, porque a coluna nova
   * nasce debaixo do ponteiro.
   */
  caixa.onmouseleave = () => {
    esconderQuadroDoRumo();
    if (!nosEmDestaque) return;
    nosEmDestaque = null;
    repintar?.();
  };

  for (const via of view.vias) caixa.append(cartaoDaVia(via));

  const equilibrado = gastarNoRumo(view, plano, null, livres);
  const misto = el('button', 'arvore-rumo arvore-rumo--misto');
  misto.append(el('b', null, 'Equilibrado'));
  misto.append(el('small', null, 'O mais barato primeiro, sem escolher lado.'));
  if (equilibrado) {
    const linha = el('div', 'arvore-rumo-linha');
    linha.append(el('em', null, 'as três vias'));
    linha.append(el('span', null, `gasta ${equilibrado.gasto}`));
    misto.append(linha);
    misto.append(...linhasDaMudanca(equilibrado));
  }
  const mistoSemAcao = livres <= 0 || !equilibrado;
  if (mistoSemAcao) misto.classList.add('desligado');
  misto.setAttribute('aria-disabled', mistoSemAcao ? 'true' : 'false');
  misto.onclick = () => { if (!mistoSemAcao) aplicar(null, 'equilibrado'); };
  ligarRealce(misto, null, equilibrado);
  caixa.append(misto);

  caixa.append(
    el(
      'p',
      'arvore-rumo-nota',
      livres <= 0
        ? 'Sem pontos à espera. Suba de level e volte aqui.'
        : 'Tudo cai no rascunho, em azul. Nada é aplicado até você clicar em Aplicar — e dá para traçar um rumo depois do outro.',
    ),
  );
  /*
   * O "Zerar a árvore" mora AQUI, embaixo dos rumos: o dono pediu para tirar
   * da coluna da direita, que ficou apertada, e esta tem espaço sobrando. E é
   * a coluna das decisões grandes sobre a árvore inteira — o lugar dele.
   */
  caixa.append(botaoZerar(custoDoPlano(view, planoAtual(view)), view.precoParaRefazer));
  return caixa;
}

/*
 * O que o plano dá, e DE ONDE cada número veio. Uma linha "Dano −1,5%" sem dono
 * é um mistério: o jogador não sabe se veio do que acabou de comprar ou do
 * preço de outra via.
 */
function bonusDoPlano(view, plano) {
  const soma = {};
  const donos = {};
  const grausDaVia = {};
  for (const no of view.nos) {
    const g = plano[no.id] ?? 0;
    if (!g) continue;
    const chave = chaveDoNo(no);
    soma[chave] = (soma[chave] ?? 0) + no.por * g;
    (donos[chave] ??= new Map()).set(no.nome, (donos[chave].get(no.nome) ?? 0) + g);
    if (no.via) grausDaVia[no.via] = (grausDaVia[no.via] ?? 0) + g;
  }
  for (const via of view.vias) {
    const g = grausDaVia[via.id];
    if (!g || !via.custo) continue;
    soma[via.custo.tipo] = (soma[via.custo.tipo] ?? 0) + via.custo.por * g;
    (donos[via.custo.tipo] ??= new Map()).set(`preço de ${via.nome}`, g);
  }
  /*
   * Skill e magic level saem inteiros, como no servidor (`bonusDaArvore`): o
   * painel não pode prometer "+12,47 de skill" quando o jogo dá 12.
   */
  for (const chave of Object.keys(soma))
    if (chave.startsWith('skill:')) soma[chave] = Math.floor(soma[chave] + 1e-9);
  return { soma, donos, grausDaVia };
}

/* ------------------------------------------------------------------ o painel */

function renderArvore(body) {
  esconderQuadroDoRumo();
  const { state } = ctx;
  const view = state.arvore;
  body.innerHTML = '';
  if (!view) return void body.append(el('p', 'empty', 'carregando...'));

  const plano = planoEmUso(view);
  const aplicado = planoAtual(view);
  const custo = custoDoPlano(view, plano);
  const jaGasto = custoDoPlano(view, aplicado);

  /*
   * A onda dispara quando o gasto APLICADO cresce — ou seja, quando o servidor
   * aceitou. Não no clique: um plano recusado acenderia uma árvore que não
   * mudou, e a tela estaria mentindo sobre o que aconteceu.
   *
   * `gastoAnterior` começa nulo para a primeira abertura do painel não acender
   * nada: entrar no jogo não é ganhar a árvore.
   */
  if (gastoAnterior !== null && jaGasto > gastoAnterior) acenderEm = performance.now();
  gastoAnterior = jaGasto;
  const livres = Math.max(0, view.pontos.total - custo);
  const mexeu = JSON.stringify(plano) !== JSON.stringify(aplicado);

  const wrap = el('div', 'arvore');

  const quadro = el('div', 'arvore-quadro');
  const arte = document.createElement('img');
  arte.className = 'arvore-arte';
  arte.src = `/client/assets/ui/arvore2-${view.vocacao}.png`;
  arte.alt = '';
  arte.onerror = () => quadro.classList.add('sem-arte');
  quadro.append(arte);

  const tela = document.createElement('canvas');
  tela.className = 'arvore-tela';
  quadro.append(tela);

  const dica = el('div', 'arvore-dica');
  dica.hidden = true;
  quadro.append(dica);
  wrap.append(colunaDeRumos(view, plano, livres, body));
  wrap.append(quadro);

  // ----------------------------------------------------------------- o lado
  const lado = el('div', 'arvore-lado');

  const placar = el('div', 'arvore-placar');
  if (mexeu) placar.classList.add('mexido');
  placar.append(el('b', null, String(livres)));
  placar.append(el('span', null, livres === 1 ? 'ponto à espera' : 'pontos à espera'));
  placar.append(el('em', null, `${custo} de ${view.pontos.total} gastos`));
  /*
   * A PREVISÃO: quanto da árvore inteira os pontos deste level compram. Sem
   * ela, "750 pontos" não diz se falta muito ou pouco para fechar.
   */
  if (view.custoDaArvore) {
    const parte = Math.min(100, Math.floor((view.pontos.total / view.custoDaArvore) * 100));
    const previsao = parte >= 100
      ? 'seu level já compra a árvore inteira'
      : `seu level compra ${parte}% da árvore · completa no level ${view.levelCheio}`;
    placar.append(el('small', 'arvore-previsao', previsao));
  }
  if (mexeu) {
    const dif = custo - jaGasto;
    placar.append(el('i', 'arvore-mexido', `${dif > 0 ? '+' : ''}${dif} no rascunho`));
  }
  lado.append(placar);

  const acoes = el('div', 'arvore-acoes');
  const tira = mexeu && planoTiraGrau(plano, aplicado);
  const aplicar = el('button', 'primary', tira ? `Aplicar · ${gold(view.precoParaRefazer)}` : 'Aplicar');
  aplicar.disabled = !mexeu;
  if (tira) {
    aplicar.title = `Tirar graus (ou trocar de montagem) custa 100 mil gold por level: ${gold(view.precoParaRefazer)}.`;
    if (ctx.state.arvoreEmCacada) {
      aplicar.disabled = true;
      aplicar.title = 'Para tirar graus, só fora da caçada.';
    }
  }
  aplicar.onclick = () => ctx.send({ t: 'arvore', action: 'aplicar', plano });
  const cancelar = el('button', 'ghost', 'Cancelar');
  cancelar.disabled = !mexeu;
  cancelar.onclick = () => {
    rascunho = null;
    renderArvore(body);
  };
  acoes.append(aplicar, cancelar);
  lado.append(acoes);

  lado.append(barraDePredefinicoes(view, body));
  lado.append(resumoDosBonus(view, plano));

  wrap.append(lado);
  body.append(wrap);

  pintar(tela, quadro, arte, view, dica, body);
}

/* ---------------------------------------------------- o que a árvore dá */

/*
 * ---- As HABILIDADES dos medalhões, com as VAGAS ----
 *
 * Uma vaga a cada 700 levels (ver `vagasDoLevel`, no servidor). A habilidade
 * pede o medalhão completo E uma vaga escolhida para ela — é o que impede de
 * subir pelos três medalhões e ligar as três de uma vez.
 *
 * Cada linha diz o que falta para ela valer: completar o medalhão, abrir uma
 * vaga, ou só escolher. Aparece mesmo com a árvore vazia: ninguém vai atrás do
 * que não sabe que existe.
 */
function blocoDeHabilidades(view, plano) {
  const comHabilidade = view.nos.filter((no) => no.especial);
  const hab = el('div', 'arvore-resumo arvore-especiais');
  const info = view.habilidades ?? { escolhidas: [], vagas: 0, levelsPorVaga: 700 };
  const escolhidas = new Set(info.escolhidas);
  const livres = Math.max(0, info.vagas - escolhidas.size);
  const proxima = info.vagas < 3 ? (info.vagas + 1) * info.levelsPorVaga : null;

  hab.append(el('h4', null, `Habilidades · ${escolhidas.size} de ${info.vagas} vaga${info.vagas === 1 ? '' : 's'}`));
  hab.append(el('small', 'arvore-vagas-dica',
    proxima ? `Uma vaga a cada ${info.levelsPorVaga} levels — a próxima abre no level ${proxima}.` : 'Todas as três vagas abertas.'));

  /*
   * ---- Apagada só a que ainda NÃO dá para escolher, e dizendo o que falta ----
   *
   * O dono: "só deveria aparecer meio apagado as que não estão com level
   * suficiente ou o medalhão ativo, e o que falta". Antes, toda habilidade sem
   * escolha saía apagada — a que estava pronta para um clique parecia tão
   * travada quanto a que pedia mais quinhentos levels.
   *
   *   ativa        — escolhida e com o medalhão cheio: acesa, com "Tirar";
   *   disponível   — medalhão cheio e vaga livre: normal, com "Escolher";
   *   bloqueada    — falta o medalhão ou a vaga: apagada, com o que falta;
   *   escolhida mas o medalhão esvaziou (zerou a árvore): apagada, com o que
   *                  falta, e ainda com "Tirar" para liberar a vaga.
   */
  for (const no of comHabilidade) {
    const id = no.especial.id;
    // O que está APLICADO decide: o servidor só deixa escolher com o medalhão
    // cheio de verdade, e não num rascunho.
    const completo = (no.gasto ?? 0) >= no.graus;
    const escolhida = escolhidas.has(id);
    const ativa = completo && escolhida;

    let falta = null;
    if (!completo) falta = `Falta completar o medalhão ${no.nome} (${no.gasto ?? 0}/${no.graus}).`;
    else if (!escolhida && !livres)
      falta = proxima && info.vagas < 3 && escolhidas.size >= info.vagas
        ? `Falta vaga: a próxima abre no level ${proxima}.`
        : 'As vagas estão ocupadas: tire uma para escolher esta.';
    const estadoDaLinha = ativa ? 'ativa' : falta ? 'bloqueada' : 'disponivel';

    const grupo = el('div', `arvore-hab ${estadoDaLinha}`);
    const linha = el('div', estadoDaLinha);
    linha.append(el('span', null, no.especial.nome));
    if (ativa) linha.append(el('b', null, 'ativa'));

    if (escolhida) {
      const tirar = el('button', 'ghost arvore-hab-botao', 'Tirar');
      const preco = info.precoParaTirar ?? 0;
      tirar.title = `Tirar custa ${gold(preco)} (20 mil por level), só fora da caçada.`;
      tirar.disabled = !!ctx.state.arvoreEmCacada;
      tirar.onclick = () => confirmarTirarHabilidade(no.especial, preco);
      linha.append(tirar);
    } else if (!falta) {
      const escolher = el('button', 'ghost arvore-hab-botao', 'Escolher');
      escolher.title = 'Escolher (de graça).';
      escolher.onclick = () => ctx.send({ t: 'arvore', action: 'escolherHabilidade', id });
      linha.append(escolher);
    }
    grupo.append(linha);
    grupo.append(el('small', null, no.especial.texto));
    if (falta) grupo.append(el('small', 'arvore-hab-falta', falta));
    hab.append(grupo);
  }
  return hab;
}

function confirmarTirarHabilidade(especial, preco) {
  const back = el('div', 'confirm-back');
  const box = el('div', 'confirm-box');
  box.append(el('h3', null, 'Tirar habilidade'));
  box.append(el('p', 'confirm-item', especial.nome));
  box.append(el('p', 'confirm-short',
    `A vaga fica livre para outra. Custa ${gold(preco)} (20 mil por level), sai da carteira e depois do banco, e só dá para fazer fora da caçada.`));
  const acoes = el('div', 'confirm-actions');
  const cancelar = el('button', 'ghost', 'Cancelar');
  cancelar.onclick = () => back.remove();
  const tirar = el('button', 'danger', 'Tirar');
  tirar.onclick = () => {
    back.remove();
    ctx.send({ t: 'arvore', action: 'tirarHabilidade', id: especial.id });
  };
  acoes.append(cancelar, tirar);
  box.append(acoes);
  back.append(box);
  fecharAoClicarFora(back, () => back.remove());
  atalhosDaCaixa(back, { confirmar: () => tirar.click(), fechar: () => back.remove() });
  document.body.append(back);
  tirar.focus();
}

function resumoDosBonus(view, plano) {
  const caixa = el('div', 'arvore-resumos');
  const { soma, donos, grausDaVia } = bonusDoPlano(view, plano);

  /*
   * (Aqui ficava a contagem de graus por via — "Pontaria 101, Aljava 118". O
   * dono pediu para tirar e economizar espaço: a barra de cada rumo, na coluna
   * da esquerda, já diz o mesmo.)
   */
  /*
   * O dono pediu "o que a árvore dá" EM CIMA e as habilidades embaixo: os
   * números são o que se confere a cada ponto gasto; as habilidades mudam uma
   * vez a cada 700 levels.
   */
  const linhas = Object.entries(soma).filter(([, v]) => v);
  if (!linhas.length) {
    const vazio = el('div', 'arvore-resumo');
    vazio.append(el('h4', null, 'O que a árvore dá'));
    vazio.append(el('p', 'empty', 'Nada ainda — gaste um ponto.'));
    caixa.append(vazio);
    caixa.append(blocoDeHabilidades(view, plano));
    return caixa;
  }

  const bloco = (titulo, itens, classe) => {
    if (!itens.length) return null;
    const alvo = el('div', `arvore-resumo${classe ? ` ${classe}` : ''}`);
    alvo.append(el('h4', null, titulo));
    for (const [chave, valor] of itens) {
      const linha = el('div', classe || null);
      const ico = icone(chave);
      if (ico) linha.append(ico);
      const [rotulo] = ROTULOS[chave] ?? [chave];
      linha.append(el('span', null, rotulo));
      linha.append(el('b', null, escrever(chave, valor)));
      const de = donos[chave];
      if (de?.size) {
        linha.classList.add('tem-fonte');
        linha.title = [...de].map(([nome, g]) => `${nome} · ${g} graus`).join('\n');
      }
      alvo.append(linha);
    }
    return alvo;
  };

  const da = bloco('O que a árvore dá', linhas.filter(([c, v]) => !ehCusto(c, v)), null);
  const tira = bloco('O que a árvore tira', linhas.filter(([c, v]) => ehCusto(c, v)), 'custa');
  if (da) caixa.append(da);
  if (tira) caixa.append(tira);
  caixa.append(blocoDeHabilidades(view, plano));
  return caixa;
}

function botaoZerar(jaGasto, preco = 0) {
  const zerar = el('button', 'ghost arvore-zerar', jaGasto && preco ? `Zerar a árvore · ${gold(preco)}` : 'Zerar a árvore');
  if (!jaGasto) {
    zerar.disabled = true;
  } else if (ctx.state.arvoreEmCacada) {
    zerar.disabled = true;
    zerar.title = 'Só fora da caçada.';
  } else {
    zerar.onclick = () => confirmarZerar(jaGasto, preco);
  }
  return zerar;
}

/* --------------------------------------------------------- as montagens */

/*
 * ---- Duas MONTAGENS, guardadas no personagem ----
 *
 * Moravam no navegador, em lista sem fim. O dono pediu duas vagas, guardar de
 * graça e trocar entre elas com 70% de desconto sobre o preço de refazer — e
 * um preço só se cobra do que o servidor guardou. Ver `guardarMontagem` e
 * `usarMontagem`, em arvore.mjs.
 *
 * Cada vaga numa linha: o nome, o que ela tem, e os botões. "Guardar" grava a
 * árvore que está na TELA (o rascunho, se houver) e as habilidades escolhidas.
 * "Usar" troca tudo de uma vez, e diz o preço antes — de graça quando a
 * montagem só acrescenta.
 */
function barraDePredefinicoes(view, body) {
  /*
   * A barra compacta de antes — a escolha numa lista e os botões ao lado. O
   * dono viu a versão em cartões e pediu a de volta: "não precisa ser
   * bonitinho, pode ser como era". O que mudou é só o que está POR TRÁS: duas
   * vagas no servidor, e o "Usar" com o preço.
   */
  const caixa = el('div', 'arvore-pre');
  const montagens = view.montagens ?? [null, null];
  const emCacada = !!ctx.state.arvoreEmCacada;

  const escolha = document.createElement('select');
  montagens.forEach((m, vaga) => {
    const op = el('option', null, m ? `${vaga + 1}. ${m.nome}` : `${vaga + 1}. vazia`);
    op.value = String(vaga);
    escolha.append(op);
  });
  // Abre na primeira vaga ocupada, se houver: é a que se quer usar.
  const primeiraCheia = montagens.findIndex(Boolean);
  escolha.value = String(barraDePredefinicoes.vaga ?? (primeiraCheia >= 0 ? primeiraCheia : 0));
  caixa.append(escolha);

  const guardar = el('button', 'ghost', 'Guardar');
  guardar.title = 'guarda na vaga escolhida a árvore que está na tela e as habilidades escolhidas — de graça';
  guardar.onclick = () => {
    const vaga = Number(escolha.value);
    pedirNomeDaMontagem(view, vaga, montagens[vaga]?.nome ?? '', planoEmUso(view));
  };

  const usar = el('button', 'ghost', 'Usar');
  const apagar = el('button', 'ghost', '✕');
  apagar.title = 'apagar a montagem escolhida';

  const atualizar = () => {
    const vaga = Number(escolha.value);
    barraDePredefinicoes.vaga = vaga;
    const m = montagens[vaga];
    usar.disabled = !m || emCacada;
    usar.textContent = m?.preco ? `Usar · ${gold(m.preco)}` : 'Usar';
    usar.title = !m
      ? 'vaga vazia'
      : emCacada
        ? 'para trocar de montagem, só fora da caçada'
        : m.preco
          ? `tira graus ou habilidades: custa ${gold(m.preco)} (30 mil por level, 70% a menos que refazer)`
          : 'só acrescenta: de graça';
    apagar.disabled = !m;
  };
  escolha.onchange = atualizar;
  usar.onclick = () => {
    const vaga = Number(escolha.value);
    if (montagens[vaga]) confirmarUsarMontagem(montagens[vaga], vaga);
  };
  apagar.onclick = () => {
    const vaga = Number(escolha.value);
    if (montagens[vaga]) ctx.send({ t: 'arvore', action: 'apagarMontagem', vaga });
  };
  atualizar();

  caixa.append(guardar, usar, apagar);
  return caixa;
}

function confirmarUsarMontagem(m, vaga) {
  if (!m.preco) return void ctx.send({ t: 'arvore', action: 'usarMontagem', vaga });
  const back = el('div', 'confirm-back');
  const box = el('div', 'confirm-box');
  box.append(el('h3', null, 'Trocar de montagem'));
  box.append(el('p', 'confirm-item', `${m.nome} · ${m.pontos} pontos`));
  box.append(el('p', 'confirm-short',
    `A árvore e as habilidades passam a ser as desta montagem. Custa ${gold(m.preco)} (30 mil por level), sai da carteira e depois do banco.`));
  const acoes = el('div', 'confirm-actions');
  const cancelar = el('button', 'ghost', 'Cancelar');
  cancelar.onclick = () => back.remove();
  const usar = el('button', 'primary', 'Trocar');
  usar.onclick = () => {
    back.remove();
    ctx.send({ t: 'arvore', action: 'usarMontagem', vaga });
  };
  acoes.append(cancelar, usar);
  box.append(acoes);
  back.append(box);
  fecharAoClicarFora(back, () => back.remove());
  atalhosDaCaixa(back, { confirmar: () => usar.click(), fechar: () => back.remove() });
  document.body.append(back);
  usar.focus();
}

function pedirNomeDaMontagem(view, vaga, nomeAtual, plano) {
  const back = el('div', 'confirm-back');
  const box = el('div', 'confirm-box');
  box.append(el('h3', null, `Guardar na vaga ${vaga + 1}`));
  box.append(el('p', 'confirm-item', `${custoDoPlano(view, plano)} pontos · ${view.habilidades?.escolhidas?.length ?? 0} habilidade(s)`));

  const campo = document.createElement('input');
  campo.type = 'text';
  campo.maxLength = 24;
  campo.value = nomeAtual;
  campo.placeholder = 'nome — ex.: hunt, boss';
  campo.className = 'arvore-pre-nome';
  box.append(campo);

  const acoes = el('div', 'confirm-actions');
  const cancelar = el('button', 'ghost', 'Cancelar');
  cancelar.onclick = () => back.remove();
  const ok = el('button', 'primary', 'Guardar');
  ok.onclick = () => {
    back.remove();
    ctx.send({ t: 'arvore', action: 'guardarMontagem', vaga, nome: campo.value.trim(), plano: { ...plano } });
  };
  acoes.append(cancelar, ok);
  box.append(acoes);

  back.append(box);
  fecharAoClicarFora(back, () => back.remove());
  atalhosDaCaixa(back, { confirmar: () => ok.click(), fechar: () => back.remove() });
  document.body.append(back);
  campo.focus();
}

/* ------------------------------------------------------------------ o desenho */

function pintar(tela, quadro, arte, view, dica, body) {
  const porId = new Map(view.nos.map((no) => [no.id, no]));
  let pontos = new Map();
  let pronto = false;

  const plano = planoEmUso(view);
  const aplicado = planoAtual(view);

  /*
   * A quantos passos do brasão cada nó comprado está, andando SÓ pelo que está
   * comprado. É essa fileira que a onda acende de cada vez — e é por isso que
   * ela sobe pelo caminho em vez de aparecer inteira: dois nós vizinhos na
   * tábua podem estar a dez passos um do outro no grafo, e é o grafo que conta.
   */
  const profundidade = (() => {
    const passo = new Map();
    const base = view.nos.find((no) => no.escala === 'base' && (plano[no.id] ?? 0) > 0);
    if (!base) return passo;
    passo.set(base.id, 0);
    const fila = [base.id];
    for (let f = 0; f < fila.length; f++) {
      const atual = fila[f];
      for (const v of porId.get(atual)?.vizinhos ?? [])
        if (!passo.has(v) && (plano[v] ?? 0) > 0) {
          passo.set(v, passo.get(atual) + 1);
          fila.push(v);
        }
    }
    return passo;
  })();
  const fundoMaisFundo = Math.max(0, ...profundidade.values());

  /*
   * Onde a frente da onda está, e quanto ela acende num nó daquela fundura.
   * Zero quando a onda acabou — e aí nada disto é desenhado.
   */
  const LARGURA_DA_ONDA = 2.6;
  function ondaEm(fundura, agora) {
    if (!acenderEm) return 0;
    const t = (agora - acenderEm) / DURACAO_DA_ONDA;
    if (t < 0 || t > 1) return 0;
    const frente = t * (fundoMaisFundo + LARGURA_DA_ONDA * 2);
    const perto = 1 - Math.abs(frente - fundura) / LARGURA_DA_ONDA;
    // some no fim para a onda não sumir de uma vez no último quadro
    return Math.max(0, perto) * Math.min(1, (1 - t) * 4);
  }

  const medir = () => {
    const largura = quadro.clientWidth;
    const altura = quadro.clientHeight;
    if (!largura || !altura) return false;
    const escala = window.devicePixelRatio || 1;
    tela.width = Math.round(largura * escala);
    tela.height = Math.round(altura * escala);
    tela.style.width = `${largura}px`;
    tela.style.height = `${altura}px`;

    /*
     * ---- Medir A IMAGEM, e em espaço de LAYOUT ----
     *
     * As posições dos nós são fração DA ARTE. Converter com a largura do QUADRO
     * aposta que os dois retângulos sejam o mesmo, e basta uma diferença pequena
     * para tudo escorregar. E a medida sai por `offsetLeft/offsetWidth`, não por
     * `getBoundingClientRect`: o primeiro é espaço de layout, o mesmo em que o
     * canvas desenha; o segundo já vem transformado por qualquer `zoom` de um
     * ancestral. Misturar os dois é o defeito clássico de canvas sobreposto.
     */
    const temArte = arte.naturalWidth > 0 && arte.offsetHeight > 0;
    const x0 = temArte ? arte.offsetLeft : 0;
    const y0 = temArte ? arte.offsetTop : 0;
    const largArte = temArte ? arte.offsetWidth : largura;
    const altArte = temArte ? arte.offsetHeight : altura;

    pontos = new Map();
    for (const no of view.nos)
      pontos.set(no.id, {
        x: x0 + no.ponto.x * largArte,
        y: y0 + no.ponto.y * altArte,
        // O raio vem medido na arte; 0,82 dele deixa o aro por dentro do disco.
        r: Math.max(4, no.raio * largArte * 0.82),
      });
    pronto = true;
    return { largura, altura, escala, largArte };
  };

  /*
   * `quando` é o instante do quadro, e vem do `requestAnimationFrame` da onda.
   *
   * Ele é CONFERIDO, e não recebido num parâmetro com valor padrão: esta mesma
   * função é o ouvinte do `onload` da arte, do `error` dela e do
   * `ResizeObserver`, e os três chamam com os argumentos deles — dois Events e
   * um array. Um valor padrão só cobre `undefined`, e um Event dividido por mil
   * vira `NaN`, que desce até o raio de um degradê e derruba o desenho inteiro.
   */
  const desenhar = (quando) => {
    const m = medir();
    if (!m) return;
    const agora = Number.isFinite(quando) ? quando : performance.now();
    const g = tela.getContext('2d');
    g.setTransform(m.escala, 0, 0, m.escala, 0, 0);
    g.clearRect(0, 0, m.largura, m.altura);

    /*
     * Linha FINA. O brilho é que faz o volume, não a espessura: traço grosso
     * vira cano dourado por cima do entalhe e some com a arte.
     */
    const grosso = m.largArte * 0.005;
    const fino = m.largArte * 0.003;

    /*
     * ---- O realce do rumo ----
     *
     * Um halo verde-azulado por baixo de tudo, nos nós que o rumo sob o
     * ponteiro compraria. Verde e não dourado de propósito: o ouro já quer
     * dizer "comprado" nesta tela, e um realce da mesma cor faria o trajeto
     * proposto parecer pago.
     *
     * Vai ANTES das hastes para ficar por baixo delas — é chão, não marcação.
     */
    if (nosEmDestaque) {
      for (const no of view.nos) {
        if (!nosEmDestaque.has(no.id)) continue;
        const p = pontos.get(no.id);
        if (!p) continue;
        g.save();
        const alcance = p.r * (REALCE_DA_ESCALA[no.escala] ?? 1.4);
        g.beginPath();
        g.arc(p.x, p.y, alcance, 0, Math.PI * 2);
        g.fillStyle = 'rgba(63, 191, 168, 0.15)';
        g.shadowColor = 'rgba(63, 191, 168, 0.5)';
        g.shadowBlur = alcance * 0.75;
        g.fill();
        g.restore();
      }
    }

    /*
     * ---- A haste acende quando OS DOIS pontos dela estão comprados ----
     *
     * Acesa num lado só, o desenho mentiria: sugeriria um caminho que não
     * existe, porque o vínculo só serve de caminho quando ambas as pontas foram
     * pagas. Apagada, ela fica um fantasma — quem desenha a haste de verdade é
     * o entalhe da arte; o canvas só diz por onde a luz passa.
     */
    for (const [a, b] of view.vinculos) {
      const pa = pontos.get(a);
      const pb = pontos.get(b);
      if (!pa || !pb) continue;
      const aceso = (plano[a] ?? 0) > 0 && (plano[b] ?? 0) > 0;
      const novo = aceso && ((aplicado[a] ?? 0) === 0 || (aplicado[b] ?? 0) === 0);
      g.save();
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(pa.x, pa.y);
      g.lineTo(pb.x, pb.y);

      if (!aceso) {
        g.strokeStyle = CORES.haste;
        g.lineWidth = fino;
        g.stroke();
      } else {
        /*
         * ---- Duas passadas: o VÉU faz a luz, o FIO faz a linha ----
         *
         * Antes era uma passada só, larga, com muita sombra, repetida para
         * adensar. Numa treliça de sessenta hastes aquilo lia como luz; numa de
         * DUZENTAS, que é o que a árvore do druid virou, o halo de cada haste
         * encosta no da vizinha e a tábua inteira fica preenchida — some o
         * desenho e sobra uma mancha dourada.
         *
         * O conserto é separar as duas coisas que o traço grosso fazia ao mesmo
         * tempo. O véu é largo e translúcido: ele é o brilho, e por ser
         * transparente duas hastes cruzadas somam sem empastar. O fio é de um
         * pixel e opaco: ele é a linha, e é dele que vem a leitura de para onde
         * o caminho vai.
         *
         * A sombra do fio é pequena de propósito — ela só cola o fio no véu.
         * Grande, ela refaz o borrão que o véu foi feito para evitar.
         */
        /*
         * O véu soma como LUZ (`lighter`), e não como tinta.
         *
         * Com a mistura normal, duas hastes cruzadas ficam da cor da de cima e
         * o cruzamento some. Somando, o ponto de cruzamento fica mais claro —
         * que é o que a luz faz de verdade, e é o que dá volume a uma treliça
         * de duzentas hastes sem precisar engrossar nenhuma delas.
         *
         * É também o que permite baixar tanto a opacidade: 14% empastaria numa
         * mistura normal e some; somando, ele acende onde há acúmulo e
         * desaparece onde há uma haste só.
         */
        /*
         * ---- TRÊS camadas, e cada uma faz uma coisa que as outras não fazem ----
         *
         * O BAFO é largo e quase invisível (4% de opacidade). Sozinho não se vê;
         * o que ele faz é derramar luz na PEDRA em volta da haste. É a camada
         * que dá a impressão de que a treliça ilumina a tábua em vez de estar
         * colada nela — e é a diferença entre um desenho e uma coisa acesa.
         *
         * O VÉU é o brilho da haste em si.
         *
         * O FIO é a linha. Ele vai num DEGRADÊ ao longo do comprimento: claro
         * junto dos dois nós, mais fraco no meio do vão. É como um metal aceso
         * se comporta — a luz nasce nos pontos e corre pela haste, perdendo
         * força no caminho. Traço de cor única lê como cabo; assim lê como luz.
         *
         * As três somam como LUZ (`lighter`), e não como tinta: duas hastes que
         * se cruzam ficam mais claras no cruzamento, que é o que a luz faz de
         * verdade. É o que permite manter cada camada tão fraca.
         */
        g.globalCompositeOperation = 'lighter';

        g.shadowColor = novo ? CORES.rascunhoBrilho : CORES.brilho;
        g.shadowBlur = m.largArte * 0.012;
        g.strokeStyle = novo ? CORES.rascunhoBafo : CORES.bafo;
        g.lineWidth = grosso * 3.2;
        g.stroke();

        g.shadowBlur = m.largArte * 0.0045;
        g.strokeStyle = novo ? CORES.rascunhoVeu : CORES.veu;
        g.lineWidth = grosso * 1.05;
        g.stroke();

        /*
         * A CRISTA da onda: uma quarta passada, larga e branca, só nos poucos
         * quadros em que a frente passa por esta haste. Ela não substitui
         * nenhuma das três — soma por cima, e é justamente o excesso momentâneo
         * que faz a luz parecer correr.
         */
        const cristaAqui = ondaEm(Math.max(profundidade.get(a) ?? 0, profundidade.get(b) ?? 0), agora);
        if (cristaAqui > 0.02) {
          g.shadowBlur = m.largArte * 0.02 * cristaAqui;
          g.strokeStyle = `rgba(255, 244, 214, ${(cristaAqui * 0.5).toFixed(3)})`;
          g.lineWidth = grosso * (1.2 + cristaAqui * 2.4);
          g.stroke();
        }

        const fio = g.createLinearGradient(pa.x, pa.y, pb.x, pb.y);
        const claro = novo ? CORES.rascunhoClaro : CORES.fio;
        const meio = novo ? CORES.rascunho : CORES.aceso;
        fio.addColorStop(0, claro);
        fio.addColorStop(0.42, meio);
        fio.addColorStop(0.58, meio);
        fio.addColorStop(1, claro);
        g.globalCompositeOperation = 'source-over';
        g.shadowBlur = m.largArte * 0.0014;
        g.strokeStyle = fio;
        g.lineWidth = Math.max(1, m.largArte * 0.0015);
        g.stroke();
      }
      g.restore();
    }

    /*
     * ---- Só aro, e o brilho por FORA dele ----
     *
     * O miolo fica VAZIO: quem se vê por dentro é o disco esculpido da imagem, e
     * o que o jogo acrescenta é o halo em volta. O progresso vira um ARCO no
     * próprio aro, de cima e girando com o relógio.
     */
    for (const no of view.nos) {
      const p = pontos.get(no.id);
      if (!p) continue;
      const g1 = plano[no.id] ?? 0;
      const g0 = aplicado[no.id] ?? 0;
      const parte = no.graus ? g1 / no.graus : 0;
      const cheio = g1 >= no.graus;
      const novo = g1 !== g0;
      /*
       * O nó CHEIO sai em ouro mesmo sendo rascunho.
       *
       * O azul quer dizer "isto é uma proposta, ainda não paguei". Mas o que o
       * olho procura na tela é outra coisa — o que já está no máximo, para
       * saber onde não vale mais gastar. Deixar o cheio em azul escondia essa
       * informação atrás da outra, e a de "está no máximo" é a que se usa a
       * cada clique.
       *
       * O aviso de rascunho não se perde: o placar mostra quantos pontos ele
       * custa, e os nós pela metade continuam azuis.
       */
      const cor = novo && !cheio ? CORES.rascunho : CORES.aceso;
      const halo = novo && !cheio ? CORES.rascunhoBrilho : CORES.brilho;

      g.save();
      g.lineCap = 'round';

      /*
       * O halo do aro segue a mesma regra das hastes: uma passada larga e
       * translúcida para a luz, e o aro fino por cima para o desenho. Duas
       * passadas de traço grosso — o que havia aqui — engordavam o aro junto
       * com o brilho, e numa treliça cheia os aros encostavam nas hastes.
       */
      if (g1 > 0) {
        /*
         * ---- O nó comprado tem MIOLO ----
         *
         * Um degradê radial fraco por dentro do aro, somado como luz. O aro
         * sozinho é um contorno, e contorno é uma coisa vazia; com o miolo o
         * disco vira uma pedra acesa encaixada na tábua, que é o que a arte
         * desenhou e o canvas antes apagava.
         *
         * Ele é bem menor que o disco (65% do raio) e some antes da borda, de
         * propósito: preenchido até o aro, viraria um botão chapado.
         */
        g.save();
        g.globalCompositeOperation = 'lighter';
        const miolo = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 0.95);
        const tinta = novo && !cheio ? CORES.rascunhoMiolo : CORES.miolo;
        miolo.addColorStop(0, tinta(FORCA_DO_MIOLO[no.escala] ?? 0.2));
        miolo.addColorStop(0.55, novo && !cheio ? CORES.rascunhoVeu : CORES.veu);
        miolo.addColorStop(1, 'rgba(0,0,0,0)');
        g.beginPath();
        g.arc(p.x, p.y, p.r * 0.95, 0, Math.PI * 2);
        g.fillStyle = miolo;
        g.fill();

        g.strokeStyle = novo && !cheio ? CORES.rascunhoVeu : CORES.veu;
        g.shadowColor = halo;
        g.shadowBlur = p.r * (cheio ? 1.0 : 0.7);
        g.lineWidth = Math.max(1, p.r * 0.22);
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.stroke();

        // e o nó estoura junto quando a onda chega nele
        const cristaNo = ondaEm(profundidade.get(no.id) ?? 0, agora);
        if (cristaNo > 0.02) {
          g.shadowBlur = p.r * 2.2 * cristaNo;
          g.strokeStyle = `rgba(255, 246, 220, ${(cristaNo * 0.75).toFixed(3)})`;
          g.lineWidth = Math.max(1, p.r * 0.16);
          g.beginPath();
          g.arc(p.x, p.y, p.r * (1 + cristaNo * 0.22), 0, Math.PI * 2);
          g.stroke();
        }
        g.restore();
        g.shadowBlur = 0;
      }

      g.strokeStyle = g1 > 0 ? cor : CORES.apagado;
      g.lineWidth = Math.max(1, p.r * (g1 > 0 ? 0.1 : 0.08));
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.stroke();

      if (g1 > 0 && !cheio) {
        g.strokeStyle = CORES.claro;
        g.lineWidth = Math.max(1.2, p.r * 0.14);
        g.beginPath();
        g.arc(p.x, p.y, p.r, -Math.PI / 2, -Math.PI / 2 + parte * Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }
  };

  /* ---- clique e dica ---- */

  const noEm = (evento) => {
    if (!pronto) return null;
    const caixa = tela.getBoundingClientRect();
    const x = evento.clientX - caixa.left;
    const y = evento.clientY - caixa.top;
    /*
     * O mais PERTO ganha, e não o primeiro que couber.
     *
     * Os discos grandes têm alvo grande e podem cobrir um nozinho vizinho:
     * percorrendo a lista em ordem, o clique em cima do nozinho caía no
     * medalhão só porque ele aparece antes na lista.
     */
    let melhor = null;
    let menor = Infinity;
    for (const no of view.nos) {
      const p = pontos.get(no.id);
      if (!p) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= p.r * 1.25 && d < menor) {
        menor = d;
        melhor = no;
      }
    }
    return melhor;
  };

  /*
   * ---- Clicar num nó COMPRA O CAMINHO até ele ----
   *
   * Pelo trajeto mais barato, e não por um qualquer. Se os pontos não derem
   * para o caminho inteiro, ele é comprado ATÉ ONDE DER: recusar tudo por
   * faltar um ponto seria pior — a pessoa apontou aonde quer chegar, e chegar
   * perto é melhor do que não sair do lugar.
   */
  const subir = (no) => {
    const antes = planoEmUso(view);
    const proposta = { ...antes };
    const atual = proposta[no.id] ?? 0;
    if (atual >= no.graus) return void ctx.notice?.(`${no.nome} já está no máximo`);

    let gasto = custoDoPlano(view, proposta);
    const cabe = (preco) => gasto + preco <= view.pontos.total;

    if (atual === 0) {
      const caminho = caminhoAte(view, proposta, no.id);
      if (!caminho) return void ctx.notice?.('não há caminho até aí');
      for (const id of caminho) {
        if ((proposta[id] ?? 0) > 0) continue;
        const preco = porId.get(id).custos[0];
        if (!cabe(preco)) break;
        gasto += preco;
        proposta[id] = 1;
      }
      if (!proposta[no.id]) {
        const andou = JSON.stringify(proposta) !== JSON.stringify(antes);
        ctx.notice?.(andou ? 'os pontos acabaram no meio do caminho' : 'sem pontos para isso');
        if (!andou) return;
      }
    } else {
      const preco = no.custos[atual];
      if (!cabe(preco)) return void ctx.notice?.('sem pontos para isso');
      proposta[no.id] = atual + 1;
    }
    rascunho = proposta;
    renderArvore(body);
  };

  /*
   * ---- Tirar um grau derruba quem ficou sem apoio ----
   *
   * Num grafo isso não é "os descendentes": é tudo o que deixa de ter caminho
   * até o brasão. Refaço o alcance a partir da base e jogo fora o que não for
   * alcançado — assim o rascunho nunca fica num estado que o servidor recusaria
   * inteiro, sem o jogador entender por quê.
   */
  const descer = (no) => {
    const proposta = { ...planoEmUso(view) };
    if (!proposta[no.id]) return;
    proposta[no.id] -= 1;
    if (!proposta[no.id]) delete proposta[no.id];

    const comprados = new Set(Object.keys(proposta));
    const vivos = new Set();
    const fila = view.nos
      .filter((n) => n.escala === 'base' && comprados.has(n.id))
      .map((n) => n.id);
    for (const id of fila) vivos.add(id);
    for (let f = 0; f < fila.length; f++)
      for (const v of porId.get(fila[f]).vizinhos)
        if (comprados.has(v) && !vivos.has(v)) {
          vivos.add(v);
          fila.push(v);
        }
    for (const id of comprados) if (!vivos.has(id)) delete proposta[id];

    rascunho = proposta;
    renderArvore(body);
  };

  tela.onclick = (evento) => {
    const no = noEm(evento);
    if (no) subir(no);
  };
  // Botão direito tira um grau — é como se desfaz sem apagar o rascunho inteiro.
  tela.oncontextmenu = (evento) => {
    const no = noEm(evento);
    if (!no) return;
    evento.preventDefault();
    descer(no);
  };

  tela.onmousemove = (evento) => {
    const no = noEm(evento);
    tela.style.cursor = no ? 'pointer' : 'default';
    if (!no) return void (dica.hidden = true);

    const chave = chaveDoNo(no);
    const [rotulo, formato] = ROTULOS[chave] ?? [no.tipo, 'cru'];
    const passo =
      formato === 'pct'
        ? `+${(no.por * 100).toFixed(1).replace('.0', '')}% por grau`
        : `+${no.por} por grau`;
    const g1 = plano[no.id] ?? 0;
    const g0 = aplicado[no.id] ?? 0;
    const via = view.vias.find((v) => v.id === no.via);

    dica.innerHTML = '';
    dica.append(el('b', null, no.nome));
    dica.append(el('span', null, `${rotulo} · ${passo}`));
    if (via) dica.append(el('em', null, via.preco ? `via ${via.nome} · custa ${via.preco}` : `via ${via.nome}`));
    /*
     * O total da árvore CHEIA para este efeito — somando todos os nós que o dão,
     * e não só este. É o que diz quanto falta: "+0,6 por grau" sozinho não diz.
     */
    if (no.teto != null) dica.append(el('em', null, `árvore cheia: ${escrever(chave, no.teto)}`));
    if (no.especial) {
      dica.append(el('b', 'arvore-dica-especial', no.especial.nome));
      dica.append(el('span', null, `${no.especial.texto} (com o medalhão completo e escolhida numa vaga)`));
    }
    dica.append(el('em', null, `${g1} / ${no.graus}${g1 !== g0 ? ` (aplicado: ${g0})` : ''}`));
    dica.append(
      el(
        'small',
        null,
        g1 >= no.graus
          ? 'no máximo'
          : `próximo grau: ${no.custos[g1]} ponto${no.custos[g1] > 1 ? 's' : ''}`,
      ),
    );
    dica.hidden = false;
    const caixa = tela.getBoundingClientRect();
    dica.style.left = `${evento.clientX - caixa.left + 14}px`;
    dica.style.top = `${evento.clientY - caixa.top + 14}px`;
  };
  tela.onmouseleave = () => (dica.hidden = true);

  // A arte manda no tamanho: só dá para medir depois que ela carrega.
  // O número que a coluna da esquerda liga para acender uma via.
  repintar = () => desenhar();

  /*
   * ---- O laço da onda ----
   *
   * Ele existe só enquanto a onda dura, e morre de três jeitos — nenhum deles
   * precisa de alguém lembrar de desligar:
   *
   *   - o tempo acaba (`DURACAO_DA_ONDA`), e o `acenderEm` é zerado;
   *   - `tela.isConnected` fica falso, o que acontece ao fechar o modal E a
   *     cada mensagem do servidor que redesenhe o painel (aí o painel novo
   *     começa o seu, ainda dentro da mesma janela de tempo);
   *   - nem chega a começar, se não houve aplicação nenhuma.
   */
  const correr = (t) => {
    if (!tela.isConnected) return;
    if (!acenderEm || t - acenderEm > DURACAO_DA_ONDA) {
      acenderEm = 0;
      desenhar();
      return;
    }
    desenhar(t);
    requestAnimationFrame(correr);
  };

  if (arte.complete) desenhar();
  if (acenderEm && performance.now() - acenderEm < DURACAO_DA_ONDA) requestAnimationFrame(correr);
  arte.onload = desenhar;
  arte.addEventListener('error', desenhar);
  new ResizeObserver(desenhar).observe(quadro);
}

/* ------------------------------------------------------------------ zerar */

function confirmarZerar(usados, preco = 0) {
  const back = el('div', 'confirm-back');
  const box = el('div', 'confirm-box');
  box.append(el('h3', null, 'Zerar a árvore'));
  box.append(el('p', 'confirm-item', `${usados} ponto${usados > 1 ? 's' : ''} de volta`));
  box.append(el('p', 'confirm-short',
    `Todos os graus voltam a zero. Custa ${gold(preco)} (100 mil por level), sai da carteira e depois do banco, e só dá para fazer fora da caçada.`));

  const acoes = el('div', 'confirm-actions');
  const cancelar = el('button', 'ghost', 'Cancelar');
  cancelar.onclick = () => back.remove();
  const zerar = el('button', 'danger', 'Zerar');
  zerar.onclick = () => {
    back.remove();
    ctx.send({ t: 'arvore', action: 'zerar' });
  };
  acoes.append(cancelar, zerar);
  box.append(acoes);

  back.append(box);
  fecharAoClicarFora(back, () => back.remove());
  atalhosDaCaixa(back, { confirmar: () => zerar.click(), fechar: () => back.remove() });
  document.body.append(back);
  zerar.focus();
}

/*
 * ---- O resumo que o balão do ícone da barra mostra ----
 *
 * Sai daqui, e não do painel, porque o painel pode nunca ter sido aberto: o
 * `state.character.arvoreBonus` chega em toda atualização.
 */
export function resumoDaArvoreParaBalao() {
  const bonus = ctx?.state?.character?.arvoreBonus;
  const pontos = ctx?.state?.character?.arvorePontos;
  const linhas = Object.entries(bonus ?? {}).filter(([, v]) => v);
  if (!linhas.length && !pontos?.livres) return null;

  const caixa = el('div', 'tip-arvore');
  if (pontos?.livres)
    caixa.append(el('b', null, `${pontos.livres} ponto${pontos.livres === 1 ? '' : 's'} à espera`));
  if (!linhas.length) {
    caixa.append(el('em', null, 'nenhum ponto gasto ainda'));
    return caixa;
  }

  linhas.sort((a, b) => Number(ehCusto(...a)) - Number(ehCusto(...b)));
  for (const [chave, valor] of linhas) {
    const linha = el('div', ehCusto(chave, valor) ? 'custa' : null);
    const ico = icone(chave);
    if (ico) linha.append(ico);
    const [rotulo] = ROTULOS[chave] ?? [chave];
    linha.append(el('span', null, rotulo));
    linha.append(el('b', null, escrever(chave, valor)));
    caixa.append(linha);
  }
  return caixa;
}
