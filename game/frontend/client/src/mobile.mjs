import { engoleEsteClique } from './regras-de-toque.mjs';
/*
 * ---- O jogo na mão: analógico e o que mais o dedo precisa ----
 *
 * "vc tinha q mudar toda a interface pro celular pra ficar jogavel, inclusive
 * botar um analogico e barra de habilidade sem precisar scrolar."
 *
 * O CSS já tinha resolvido o que é LAYOUT — as janelas viraram gaveta, os
 * botões ganharam tamanho de dedo, a fileira de slots parou de rolar. O que
 * folha de estilo nenhuma resolve é o que falta aqui: no celular NÃO HÁ WASD, e
 * sem WASD não se anda. A pessoa entrava na cidade e ficava parada.
 *
 * ---- Por que ele fala pelo teclado, e não com o servidor ----
 *
 * O analógico não manda `walk` nem `huntWalk`. Ele acende e apaga TECLAS DE
 * MENTIRA no mesmo conjunto que o teclado usa, e chama as mesmas duas funções.
 *
 * Isso não é rodeio, é o contrário: o caminho do teclado já resolve quatro
 * coisas que teriam de ser reescritas aqui, e reescritas de novo a cada
 * mudança — a trava da caçada automática (onde quem manda no boneco é a rota),
 * a escolha entre `walk` da cidade e `huntWalk` da caçada, o reforço de 100ms
 * que impede o rumo de vencer no servidor, e o aviso de "soltei" sem o qual o
 * personagem anda meio segundo a mais. Duplicar isso aqui seria manter dois
 * caminhos que precisam concordar para sempre.
 *
 * ---- Oito direções, e não trezentos e sessenta ----
 *
 * O mapa é de casas quadradas e o servidor só entende `dx`/`dy` em -1, 0 e 1.
 * Um analógico contínuo seria uma promessa que o jogo não cumpre: o dedo a 22°
 * e o dedo a 44° dariam o mesmo passo, e a diferença entre os dois viraria
 * "não obedeceu".
 *
 * A ZONA MORTA existe pelo mesmo motivo de todo controle: o dedo pousado no
 * meio treme, e sem ela o boneco sairia andando sozinho.
 */

/*
 * ---- Quem decide se é celular é a FOLHA DE ESTILO ----
 *
 * Este arquivo tinha o próprio `matchMedia('(max-width: 820px)')`, uma cópia da
 * regra que está no CSS. Duas cópias da mesma decisão em arquivos diferentes é
 * a definição de uma divergir calada, e foi o que aconteceu: o CSS ganhou o
 * caso do telefone DEITADO (que tem 844px de largura e portanto não é
 * "estreito") e o analógico continuou com o corte velho — some na horizontal,
 * justamente onde mais se joga.
 *
 * Agora o CSS acende `--e-celular` e aqui só se lê. Uma regra, um lugar.
 */
export const ehCelular = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--e-celular').trim() === '1';

/* Da borda para dentro: abaixo disto o dedo está no meio e ninguém anda. */
const ZONA_MORTA = 0.28;

/*
 * O raio sai da MEDIDA do elemento, e não de um número escrito aqui.
 *
 * Ele já foi uma constante que tinha de casar com o tamanho no CSS — e casar à
 * mão dois números em dois arquivos é o mesmo erro do `max-width: 820px`
 * duplicado: um dia um muda e o outro não, e a zona morta passa a ser calculada
 * sobre um raio que não existe mais. Mudar o tamanho do controle agora é mexer
 * numa linha só, no CSS.
 */
const raioDe = (no) => (no?.getBoundingClientRect().width ?? 112) / 2;

let montado = null;
let controles = null;

/*
 * A partir de quanto de cada eixo a direção vira DIAGONAL.
 *
 * ---- Por que não são oito fatias iguais ----
 *
 * A primeira versão dividia a volta em oito de 45° — o desenho óbvio, e o
 * errado para um jogo de casas. Com fatias iguais, metade do círculo é
 * diagonal, e quem quer subir um corredor reto sai de esguelha a cada tremida
 * do polegar.
 *
 * O Ravera (o APK que o dono passou de referência) é o OTClient, e o
 * `modules/game_joystick/joystick.lua` dele resolve isso do jeito que este
 * arquivo copia: a diagonal exige os DOIS eixos puxados, e só nos cantos. O
 * resto do círculo é das quatro retas, com o eixo mais puxado ganhando.
 *
 * Na prática: andar reto é o gesto fácil, e a diagonal é uma escolha.
 */
const CANTO = 0.42;

/** As oito direções, com as retas ganhando espaço das diagonais. */
function rumoDoDedo(nx, ny) {
  if (Math.abs(nx) > CANTO && Math.abs(ny) > CANTO) return [Math.sign(nx), Math.sign(ny)];
  return Math.abs(ny) > Math.abs(nx) ? [0, Math.sign(ny)] : [Math.sign(nx), 0];
}

function desenharAnalogico() {
  const base = document.createElement('div');
  base.id = 'analogico';
  base.setAttribute('aria-hidden', 'true');
  const bola = document.createElement('i');
  bola.className = 'analogico-bola';
  base.append(bola);

  let dedo = null;
  let centro = { x: 0, y: 0 };
  /* Medido no `pointerdown`: o tamanho do controle mora no CSS. */
  let raio = 56;
  /* O último rumo enviado: sem isto, cada tremida do dedo mandaria mensagem. */
  let ultimo = '';

  const soltar = () => {
    dedo = null;
    ultimo = '';
    bola.style.transform = '';
    base.classList.remove('ativo');
    controles?.soltar();
  };

  base.addEventListener('pointerdown', (evento) => {
    /*
     * Destrancado, o controle é MÓVEL e não dirige: quem trata o toque é o
     * arrasto lá embaixo. Sem esta saída, arrastar o analógico para um canto
     * novo mandaria o personagem andar até lá no meio da mudança.
     */
    if (document.body.classList.contains('slots-livres')) return;
    if (dedo !== null) return;
    dedo = evento.pointerId;
    /*
     * A captura é o que faz o dedo continuar sendo ouvido depois de SAIR do
     * círculo — sem ela, arrastar até a borda solta o controle no meio do
     * gesto e o boneco para sozinho.
     *
     * Dentro de um `try` porque ela recusa um ponteiro que já não está ativo, e
     * isso derrubaria o `pointerdown` inteiro: o controle ficaria mudo em vez
     * de ficar sem captura. Perder a captura piora o gesto; perder o
     * `pointerdown` acaba com ele.
     */
    try { base.setPointerCapture(dedo); } catch { /* segue sem captura */ }
    base.classList.add('ativo');
    const caixa = base.getBoundingClientRect();
    centro = { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 };
    raio = caixa.width / 2;
    evento.preventDefault();
  });

  base.addEventListener('pointermove', (evento) => {
    if (evento.pointerId !== dedo) return;
    evento.preventDefault();
    const dx = evento.clientX - centro.x;
    const dy = evento.clientY - centro.y;
    const dist = Math.hypot(dx, dy);

    /*
     * A bola acompanha o dedo até a borda e para ali. Ela é o retorno visual do
     * gesto: sem ela o dedo cobre o controle e não se sabe se ele pegou.
     */
    const preso = Math.min(dist, raio);
    const ang = Math.atan2(dy, dx);
    bola.style.transform = `translate(${Math.cos(ang) * preso}px, ${Math.sin(ang) * preso}px)`;

    if (dist < raio * ZONA_MORTA) {
      if (ultimo) { ultimo = ''; controles?.soltar(); }
      return;
    }
    // Normalizado pelo raio: a regra do canto é a mesma em qualquer tamanho.
    const [rx, ry] = rumoDoDedo(dx / raio, dy / raio);
    const marca = `${rx},${ry}`;
    if (marca === ultimo) return;
    ultimo = marca;
    controles?.apontar(rx, ry);
  });

  for (const nome of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    base.addEventListener(nome, (evento) => {
      if (evento.pointerId !== dedo) return;
      soltar();
    });
  }

  return { base, soltar };
}

/*
 * ---- Os três ajustes da caçada, como ícones ----
 *
 * "perto disso deixa um ícone de alvo, de distância, de lurar até, que aí abre
 * e configura e não ocupa tanto a tela."
 *
 * Os seletores continuam sendo os DE VERDADE, os que já estão no `#actionbar`:
 * quem os esconde e quem os mostra é a folha de estilo, a partir do
 * `data-ajuste` que estes botões escrevem no `body` (ver o bloco de celular no
 * CSS). Aqui não há cópia de opção nenhuma — uma cópia envelheceria calada no
 * dia em que uma opção nova entrasse no jogo.
 *
 * Os glifos são texto, e não desenho novo: um ícone a mais é um arquivo a mais
 * para publicar e para o navegador buscar, e estes três são universais.
 */
const AJUSTES = [
  ['alvo', '◎', 'Alvo: em qual criatura bater primeiro'],
  ['distancia', '↔', 'Distância: de quão longe atacar'],
  ['lurar', '❖', 'Lurar até: com quantas criaturas juntas brigar'],
];

let painelDeAjustes = null;

/*
 * ---- Cada habilidade onde a pessoa quiser ----
 *
 * "a princípio vinha trancado e a pessoa poderia mover pra qualquer lugar os
 * action bar individualmente."
 *
 * ---- Guardado em FRAÇÃO da tela, e não em pixels ----
 *
 * Um telefone girado troca 390x844 por 844x390. Uma posição em pixels colocaria
 * metade dos ícones fora da tela na primeira vez que a pessoa deitasse o
 * aparelho — e ela não teria como trazê-los de volta, porque o que está fora da
 * tela não se arrasta. Em fração, cada um volta para o mesmo canto proporcional.
 *
 * ---- E por que reaplicar sempre ----
 *
 * O `#hotbar` é remontado inteiro pelo `actionbar.mjs` a cada mudança de
 * catálogo, de vocação ou de arranjo de teclas. Os nós antigos morrem e com
 * eles qualquer estilo posto aqui. Um `MutationObserver` devolve o lugar aos
 * slots assim que a fileira nasce de novo — sem ele, arrumar a tela duraria até
 * o primeiro level.
 */
const CHAVE_DOS_LUGARES = 'draevor:slots-soltos';

/*
 * ---- Um arranjo POR ORIENTAÇÃO ----
 *
 * "isso no modo horizontal ok, no vertical não fica bom."
 *
 * A fração resolve o tamanho do aparelho, mas não resolve o FORMATO dele. Uma
 * fileira de dez ícones ocupa 40% do rodapé numa tela deitada e 90% da mesma
 * tela em pé; uma coluna de seis sobe um terço deitada e um sexto em pé. O
 * mesmo desenho, convertido de um para o outro, sai esticado num eixo e
 * espremido no outro — foi exatamente o que ele viu.
 *
 * Então são dois arranjos, cada um guardado por si. Girar o aparelho troca de
 * arranjo em vez de deformar o que havia, e arrumar um não desarruma o outro.
 */
const orientacao = () => (window.innerWidth >= window.innerHeight ? 'deitado' : 'retrato');

/*
 * ---- E o que foi guardado por um DESENHO ANTIGO é jogado fora ----
 *
 * A barra do celular já foi um arco em volta do analógico, depois dois L nas
 * quinas, e agora é a fileira do site. Cada um daqueles arranjos deixou
 * posições gravadas no telefone de quem testou — e uma posição gravada tira o
 * slot da grade.
 *
 * O efeito: fileiras com buracos e ícones soltos parados em cantos que não
 * existem mais no desenho de hoje. Foi o que o dono viu, e não havia como
 * adivinhar olhando: a tela estava certa, o que estava velho era o que ela
 * mandava desenhar.
 *
 * O número abaixo sobe sempre que o arranjo padrão muda de forma. O que foi
 * guardado por um número menor é descartado — quem arrumou à mão perde o
 * trabalho uma vez, e é melhor do que herdar uma barra furada sem entender por
 * quê.
 */
const VERSAO_DO_ARRANJO = 3;

function lerGuardados() {
  const vazio = { retrato: {}, deitado: {} };
  try {
    const lido = JSON.parse(localStorage.getItem(CHAVE_DOS_LUGARES) ?? 'null');
    if (!lido || typeof lido !== 'object') return vazio;
    if (lido.v !== VERSAO_DO_ARRANJO) return vazio;
    return { retrato: lido.retrato ?? {}, deitado: lido.deitado ?? {} };
  } catch {
    // Chave estragada não pode derrubar a barra: volta ao arranjo de fábrica.
    return vazio;
  }
}

const guardados = lerGuardados();

function gravarLugares() {
  try {
    localStorage.setItem(CHAVE_DOS_LUGARES, JSON.stringify({ v: VERSAO_DO_ARRANJO, ...guardados }));
  } catch {
    /* navegador sem armazenamento: vale para esta sessão */
  }
}

/*
 * ---- O ANALÓGICO também se arrasta ----
 *
 * "eu faria o desenho de onde ficaria cada action bar e eu mexeria o analógico
 * e depois vc só aplicava."
 *
 * Os ícones já se arrastavam; o controle era a única peça do rodapé presa no
 * CSS. Sem ele, o desenho não fecha: a posição de todo o resto é escolhida em
 * relação a onde o polegar esquerdo descansa.
 *
 * Ele mora numa chave própria e não junto dos slots porque o `↺` apaga os
 * lugares dos slots — e "devolver as habilidades ao arranjo de fábrica" não
 * deve mexer em onde a pessoa pôs o controle.
 */
const CHAVE_DO_ANALOGICO = 'draevor:analogico-lugar';

function lerControles() {
  const vazio = { retrato: null, deitado: null };
  const eLugar = (v) => v && typeof v.x === 'number' && typeof v.y === 'number';
  try {
    const lido = JSON.parse(localStorage.getItem(CHAVE_DO_ANALOGICO) ?? 'null');
    if (!lido || typeof lido !== 'object') return vazio;
    /* Mesma regra dos slots: desenho velho não manda em tela nova. */
    if (lido.v !== VERSAO_DO_ARRANJO) return vazio;
    return { retrato: eLugar(lido.retrato) ? lido.retrato : null, deitado: eLugar(lido.deitado) ? lido.deitado : null };
  } catch {
    return vazio;
  }
}

const controlesGuardados = lerControles();
let lugarDoAnalogico = controlesGuardados[orientacao()];

function gravarLugarDoAnalogico(lugar) {
  lugarDoAnalogico = lugar;
  controlesGuardados[orientacao()] = lugar;
  try { localStorage.setItem(CHAVE_DO_ANALOGICO, JSON.stringify({ v: VERSAO_DO_ARRANJO, ...controlesGuardados })); } catch { /* sem armazenamento */ }
}

function acomodarAnalogico() {
  const no = document.getElementById('analogico');
  if (!no) return;
  if (!lugarDoAnalogico) {
    /* Sem lugar guardado ele volta para o CSS — não para um número daqui. */
    no.style.left = no.style.top = no.style.bottom = '';
    return;
  }
  const largura = no.offsetWidth || 88;
  const altura = no.offsetHeight || 88;
  const x = Math.min(Math.max(lugarDoAnalogico.x * window.innerWidth, 0), window.innerWidth - largura);
  const y = Math.min(Math.max(lugarDoAnalogico.y * window.innerHeight, 0), window.innerHeight - altura);
  no.style.left = `${Math.round(x)}px`;
  no.style.top = `${Math.round(y)}px`;
  /* `top` e `bottom` juntos esticariam o círculo: o CSS o ancora pelo chão. */
  no.style.bottom = 'auto';
}

let lugares = guardados[orientacao()];
let vigia = null;

/*
 * Girar o aparelho troca o arranjo em uso. Chamado antes de qualquer coisa que
 * leia ou escreva `lugares`: sem isto, um arrasto feito depois de girar cairia
 * no arranjo da orientação anterior.
 */
function afinarOrientacao() {
  lugares = guardados[orientacao()];
  lugarDoAnalogico = controlesGuardados[orientacao()];
}

/** Devolve a cada slot o lugar guardado — e tira o de quem não tem nenhum. */
function acomodarSlots() {
  const barra = document.getElementById('hotbar');
  if (!barra) return;
  for (const slot of barra.querySelectorAll('.slot[data-slot]')) {
    const lugar = lugares[slot.dataset.slot];
    if (!lugar) {
      slot.classList.remove('solto');
      slot.style.left = slot.style.top = '';
      continue;
    }
    slot.classList.add('solto');
    /*
     * Preso dentro da tela na hora de aplicar, e não só na hora de soltar: a
     * fração é a mesma, mas a tela pode ter encolhido (barra do navegador
     * aparecendo, teclado abrindo) e um ícone meio fora fica meio inalcançável.
     */
    const largura = slot.offsetWidth || 34;
    const altura = slot.offsetHeight || 34;
    const x = Math.min(Math.max(lugar.x * window.innerWidth, 0), window.innerWidth - largura);
    const y = Math.min(Math.max(lugar.y * window.innerHeight, 0), window.innerHeight - altura);
    slot.style.left = `${Math.round(x)}px`;
    slot.style.top = `${Math.round(y)}px`;
  }
}


/*
 * O arrasto vive no DOCUMENTO, em captura, e não em cada slot.
 *
 * Os slots são refeitos a cada render: um ouvinte por slot seria um ouvinte
 * novo por render, e os antigos ficariam pendurados nos nós mortos. Em captura
 * porque o `pointerdown` do slot já faz outra coisa — usar a habilidade —, e
 * destrancado o gesto é outro.
 */
/*
 * Girar o aparelho troca o arranjo em uso. São dois, um por orientação: a mesma
 * fração vira uma fileira folgada deitada e uma fileira espremida em pé, e um
 * ícone arrastado para um canto em pé não tem por que ir para o mesmo canto
 * proporcional deitado.
 */
function aoGirar() {
  afinarOrientacao();
  acomodarSlots();
  acomodarAnalogico();
}

/** O arranjo que a pessoa fez à mão, em texto. */
function arranjoDeAgora() {
  const arredondar = (v) => Math.round(v * 1e4) / 1e4;
  const limpar = (mapa) => Object.fromEntries(
    Object.entries(mapa ?? {}).map(([chave, lugar]) => [chave, { x: arredondar(lugar.x), y: arredondar(lugar.y) }]),
  );
  const papeis = {};
  for (const slot of document.querySelectorAll('#hotbar .slot[data-slot]')) {
    papeis[slot.dataset.slot] = slot.dataset.papel ?? 'outro';
  }
  /*
   * Os DOIS arranjos, e não só o da tela de agora: girar o aparelho troca de
   * arranjo, e mandar só um deles descreveria metade do que a pessoa fez.
   */
  return {
    tela: [window.innerWidth, window.innerHeight],
    orientacao: orientacao(),
    retrato: { analogico: controlesGuardados.retrato, slots: limpar(guardados.retrato) },
    deitado: { analogico: controlesGuardados.deitado, slots: limpar(guardados.deitado) },
    papeis,
  };
}

/*
 * ---- A janelinha do "leva daqui" ----
 *
 * `navigator.clipboard` não existe fora de conexão segura, e a maior parte dos
 * telefones que vão abrir isto entra por `http://`. Então o texto SEMPRE
 * aparece numa caixa já selecionada — copiar pela mão é o caminho que funciona
 * em todo lugar — e a cópia automática é só um atalho quando o navegador
 * deixa.
 *
 * Estilo em linha, e não no `style.css`: isto é ferramenta de arrumar a tela,
 * não peça do jogo. Fica junto do que faz e sai daqui sem deixar rastro no
 * tema.
 */
function mostrarArranjo() {
  document.getElementById('arranjo-copia')?.remove();
  const texto = JSON.stringify(arranjoDeAgora());

  const fundo = document.createElement('div');
  fundo.id = 'arranjo-copia';
  fundo.style.cssText = 'position:fixed;inset:0;z-index:60;background:#000a;display:flex;align-items:center;justify-content:center;padding:16px;';

  const caixa = document.createElement('div');
  caixa.style.cssText = 'background:#121a1d;border:1px solid #2c373c;border-radius:8px;padding:12px;max-width:100%;display:flex;flex-direction:column;gap:8px;';

  const titulo = document.createElement('b');
  titulo.style.cssText = 'font-size:11px;color:#cbd8db;';
  titulo.textContent = 'Manda este texto para eu deixar como padrão:';

  const campo = document.createElement('textarea');
  campo.readOnly = true;
  campo.value = texto;
  campo.style.cssText = 'width:min(70vw,320px);height:120px;font-size:10px;background:#0a1012;color:#9fb0b4;border:1px solid #2c373c;border-radius:4px;padding:6px;';

  const aviso = document.createElement('i');
  aviso.style.cssText = 'font-size:10px;color:#8fa;min-height:12px;font-style:normal;';

  const fila = document.createElement('div');
  fila.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
  const copiar = document.createElement('button');
  copiar.type = 'button';
  copiar.textContent = 'Copiar';
  const fechar = document.createElement('button');
  fechar.type = 'button';
  fechar.textContent = 'Fechar';
  for (const b of [copiar, fechar]) b.style.cssText = 'font-size:11px;padding:6px 12px;';

  copiar.addEventListener('click', async () => {
    campo.select();
    campo.setSelectionRange(0, texto.length);
    let foi = false;
    try {
      await navigator.clipboard.writeText(texto);
      foi = true;
    } catch {
      /* sem conexão segura: fica a seleção, que é o que sempre funciona */
      try { foi = document.execCommand('copy'); } catch { foi = false; }
    }
    aviso.textContent = foi ? 'copiado' : 'selecionado — segure e escolha Copiar';
  });
  fechar.addEventListener('click', () => fundo.remove());
  fundo.addEventListener('pointerdown', (evento) => {
    if (evento.target === fundo) fundo.remove();
  });

  fila.append(copiar, fechar);
  caixa.append(titulo, campo, aviso, fila);
  fundo.append(caixa);
  document.body.append(fundo);
  campo.select();
}

function ligarArrasto() {
  let arrastando = null;

  document.addEventListener('pointerdown', (evento) => {
    if (!document.body.classList.contains('slots-livres')) return;
    const slot = evento.target.closest?.('#hotbar .slot[data-slot], #analogico');
    if (!slot) return;
    evento.preventDefault();
    evento.stopPropagation();
    const caixa = slot.getBoundingClientRect();
    arrastando = {
      slot,
      // De onde DENTRO do ícone o dedo pegou: sem isto ele salta para debaixo
      // do dedo no primeiro pixel de movimento.
      dx: evento.clientX - caixa.left,
      dy: evento.clientY - caixa.top,
      x0: caixa.left,
      y0: caixa.top,
      largura: caixa.width,
      altura: caixa.height,
      controle: slot.id === 'analogico',
      /* Ficou parado ou andou? Ver o `largar`. */
      andou: false,
    };
    /* O controle já é `position: fixed` pelo CSS; só os slots precisam sair da
       grade para poderem ser postos por cima dela. */
    if (!arrastando.controle) slot.classList.add('solto');
    else slot.style.bottom = 'auto';
  }, true);

  document.addEventListener('pointermove', (evento) => {
    if (!arrastando) return;
    evento.preventDefault();
    const x = Math.min(Math.max(evento.clientX - arrastando.dx, 0), window.innerWidth - arrastando.largura);
    const y = Math.min(Math.max(evento.clientY - arrastando.dy, 0), window.innerHeight - arrastando.altura);
    if (Math.abs(x - arrastando.x0) > 3 || Math.abs(y - arrastando.y0) > 3) arrastando.andou = true;
    arrastando.slot.style.left = `${Math.round(x)}px`;
    arrastando.slot.style.top = `${Math.round(y)}px`;
  }, true);

  const largar = (evento) => {
    if (!arrastando) return;
    const { slot, controle, andou } = arrastando;
    const caixa = slot.getBoundingClientRect();
    const lugar = { x: caixa.left / window.innerWidth, y: caixa.top / window.innerHeight };
    if (controle) {
      gravarLugarDoAnalogico(lugar);
    } else {
      lugares[slot.dataset.slot] = lugar;
      gravarLugares();
    }
    /*
     * ---- E o CLIQUE que vem atrás do arrasto morre aqui ----
     *
     * Largar o ícone gera um `click` em quem estiver embaixo. Arrastando uma
     * habilidade por cima do mapa, do cartão de promoção ou de um botão da
     * barra, terminar o gesto APERTAVA aquilo: numa medição, soltar um ícone no
     * meio da tela abriu um modal que cobriu o rodapé inteiro — e o analógico,
     * que estava logo abaixo, ficou inalcançável para o arrasto seguinte.
     *
     * Só quando o dedo ANDOU: um toque parado em cima de um slot destrancado
     * continua sendo um toque, e engolir o clique dele tiraria da pessoa o
     * jeito de usar a habilidade sem trancar tudo de novo.
     */
    if (andou) {
      /*
       * E com PRAZO: nem todo arrasto termina em clique (largar fora da janela,
       * por exemplo, não gera nenhum). Um ouvinte `once` sem prazo ficaria de
       * tocaia e comeria o próximo clique de verdade — que pode ser minutos
       * depois, no meio de uma caçada.
       */
      const largou = { x: evento?.clientX ?? 0, y: evento?.clientY ?? 0 };
      const engolir = (clique) => {
        /*
         * E só o clique que nasce DESTE gesto: o que o navegador manda depois
         * de largar sai do mesmo ponto onde o dedo saiu. Um clique noutro canto
         * é de outra intenção — foi o que apareceu numa medição, em que o
         * cadeado, apertado logo depois de arrumar, era engolido junto.
         */
        if (Math.abs(clique.clientX - largou.x) > 24 || Math.abs(clique.clientY - largou.y) > 24) return;
        clique.preventDefault();
        clique.stopPropagation();
        document.removeEventListener('click', engolir, true);
        clearTimeout(prazo);
      };
      const prazo = setTimeout(() => document.removeEventListener('click', engolir, true), 350);
      document.addEventListener('click', engolir, true);
    }
    arrastando = null;
  };
  document.addEventListener('pointerup', largar, true);
  document.addEventListener('pointercancel', largar, true);

  /*
   * Girar o aparelho troca o arranjo em uso — e, se a orientação nova ainda não
   * tem nenhum, ganha um na hora. Sem isto, quem desenhou tudo deitado giraria
   * o telefone e encontraria a fileira de fábrica, sem entender por quê.
   */
  window.addEventListener('resize', aoGirar);
  window.addEventListener('orientationchange', aoGirar);

  /*
   * A fileira renasce a cada render do `actionbar.mjs`. O vigia devolve os
   * lugares assim que os nós novos entram.
   */
  const barra = document.getElementById('hotbar');
  if (barra && !vigia) {
    vigia = new MutationObserver(acomodarSlots);
    vigia.observe(barra, { childList: true });
  }
  acomodarSlots();
  acomodarAnalogico();
}

function desenharAjustesDaCaca() {
  const caixa = document.createElement('div');
  caixa.id = 'ajustes-da-caca';

  /*
   * ---- Duas caixas, e não uma ----
   *
   * "perto do analógico os botão de alvo, distância do alvo e lurar, e à
   * direita dos slots de action bar o cadeado."
   *
   * Os três ajustes da caçada e o cadeado são coisas diferentes e vão para
   * lugares diferentes: os ajustes mudam a caçada e ficam ao alcance do polegar
   * esquerdo, junto do controle; o cadeado mexe na barra e fica na ponta dela.
   * Juntos no meio do rodapé eles disputavam o mesmo espaço da fileira.
   */
  const travas = document.createElement('div');
  travas.id = 'travas-da-caca';

  const marcar = () => {
    for (const botao of caixa.querySelectorAll('[data-ajuste]')) {
      botao.setAttribute('aria-pressed', String(document.body.dataset.ajuste === botao.dataset.ajuste));
    }
  };

  for (const [chave, glifo, titulo] of AJUSTES) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.dataset.ajuste = chave;
    botao.textContent = glifo;
    botao.title = titulo;
    botao.setAttribute('aria-label', titulo);
    botao.setAttribute('aria-pressed', 'false');
    botao.addEventListener('click', (evento) => {
      evento.stopPropagation();
      // Tocar no mesmo ícone FECHA: é o que se espera de um botão que abriu.
      if (document.body.dataset.ajuste === chave) delete document.body.dataset.ajuste;
      else document.body.dataset.ajuste = chave;
      marcar();
    });
    caixa.append(botao);
  }

  /*
   * ---- No telefone: UM botão, que recolhe e mostra a fileira ----
   * "no deitado e em pé use isso [❖] para minimizar e maximizar esse negócio de
   * alvo, distância e lure". No telefone os seletores ficam numa fileira em
   * cima dos slots (ver o bloco de celular no style.css); os três ícones acima,
   * que abriam um de cada vez, viram este só. Recolhida, a fileira some e o mapa
   * ganha a altura dela; a escolha fica guardada no aparelho. O CSS mostra este
   * botão só nos perfis de telefone e os três só fora deles.
   */
  const CHAVE_RECOLHIDOS = 'draevor:ajustes-recolhidos';
  const recolher = document.createElement('button');
  recolher.type = 'button';
  recolher.dataset.recolher = '1';
  recolher.textContent = '❖';
  const pintarRecolher = () => {
    const recolhidos = document.body.classList.contains('ajustes-recolhidos');
    recolher.title = recolhidos ? 'Mostrar Alvo, Distância e Lurar até' : 'Esconder Alvo, Distância e Lurar até';
    recolher.setAttribute('aria-label', recolher.title);
    recolher.setAttribute('aria-pressed', String(!recolhidos));
  };
  try {
    document.body.classList.toggle('ajustes-recolhidos', localStorage.getItem(CHAVE_RECOLHIDOS) === '1');
  } catch {
    /* sem armazenamento: começa aberta */
  }
  pintarRecolher();
  recolher.addEventListener('click', (evento) => {
    evento.stopPropagation();
    const recolhidos = document.body.classList.toggle('ajustes-recolhidos');
    try {
      localStorage.setItem(CHAVE_RECOLHIDOS, recolhidos ? '1' : '');
    } catch {
      /* sem armazenamento: só não lembra */
    }
    pintarRecolher();
  });
  caixa.append(recolher);

  /*
   * ---- O cadeado, e o "voltar ao lugar" que só aparece destrancado ----
   *
   * Trancado é o estado de fábrica: no celular o toque que arrasta é o mesmo
   * que usa a habilidade, e um ícone que foge quando se tenta lançar uma magia
   * é pior do que um ícone parado.
   *
   * O botão de desfazer só existe enquanto está destrancado porque é aí que ele
   * é útil — e porque um "apagar tudo" à mão livre, ao lado dos ícones que se
   * apertam no meio de uma caçada, é um acidente esperando.
   */
  const cadeado = document.createElement('button');
  cadeado.type = 'button';
  cadeado.dataset.travar = '1';
  cadeado.title = 'Destrancar para arrastar as habilidades';
  cadeado.setAttribute('aria-label', cadeado.title);
  cadeado.textContent = '🔒';

  const desfazer = document.createElement('button');
  desfazer.type = 'button';
  desfazer.textContent = '↺';
  desfazer.title = 'Devolver as habilidades ao arranjo de fábrica';
  desfazer.setAttribute('aria-label', desfazer.title);
  desfazer.hidden = true;
  desfazer.addEventListener('click', (evento) => {
    evento.stopPropagation();
    /* Só a orientação de agora: arrumar em pé não desfaz o que se arrumou
       deitado. */
    for (const chave of Object.keys(lugares)) delete lugares[chave];
    gravarLugares();
    acomodarSlots();
  });

  cadeado.addEventListener('click', (evento) => {
    evento.stopPropagation();
    const livre = document.body.classList.toggle('slots-livres');
    cadeado.textContent = livre ? '🔓' : '🔒';
    cadeado.title = livre ? 'Trancar as habilidades no lugar' : 'Destrancar para arrastar as habilidades';
    cadeado.setAttribute('aria-label', cadeado.title);
    desfazer.hidden = !livre;
    copiar.hidden = !livre;
    // Destrancar fecha o painel aberto: ele fica por cima da área de arrasto.
    delete document.body.dataset.ajuste;
    marcar();
  });

  /*
   * O `⎘` tira o arranjo do telefone. Só destrancado, junto do `↺`: são os
   * botões de ARRUMAR, e nenhum dos dois tem o que fazer com o cadeado
   * fechado.
   */
  const copiar = document.createElement('button');
  copiar.type = 'button';
  copiar.textContent = '⎘';
  copiar.title = 'Copiar este arranjo para mandar ao desenvolvedor';
  copiar.setAttribute('aria-label', copiar.title);
  copiar.hidden = true;
  copiar.addEventListener('click', (evento) => {
    evento.stopPropagation();
    mostrarArranjo();
  });

  travas.append(cadeado, desfazer, copiar);

  /*
   * Tocar fora fecha. Sem isto o painel ficaria aberto por cima do jogo até
   * alguém lembrar de tocar no ícone de novo — e um painel aberto por engano no
   * meio de uma caçada tapa exatamente o que se quer ver.
   */
  const foraFecha = (evento) => {
    if (!document.body.dataset.ajuste) return;
    if (evento.target.closest?.('#ajustes-da-caca, #travas-da-caca, .controls')) return;
    delete document.body.dataset.ajuste;
    marcar();
  };
  document.addEventListener('pointerdown', foraFecha, true);

  return { caixa, travas, foraFecha, marcar };
}

/*
 * ---- Quando ele aparece ----
 *
 * Só em tela de celular, e só quando ANDAR É POSSÍVEL: na cidade e na Caça
 * Online. Na caçada automática quem escolhe o rumo é a rota, e um analógico que
 * não move nada é pior do que analógico nenhum — a pessoa acha que o jogo
 * travou.
 */
/*
 * ---- O TOQUE LONGO é o botão direito ----
 *
 * Report do Garibas: no celular, segurar o dedo em cima de uma coisa não faz o
 * que o botão direito faz.
 *
 * Ele está certo, e o buraco é maior do que parece de fora: aqui o direito não
 * é um atalho, é metade dos comandos do jogo. É ele que ataca no mapa, que usa
 * o item da mochila, que abre uma sacola, que desequipa uma peça, que marca
 * "não vender" no filtro de loot, que abre o depósito no locker da cidade.
 * Nada disso tinha como ser feito com o dedo — não havia caminho nenhum, e
 * quem joga no telefone simplesmente não alcançava essas ações.
 *
 * ---- Por que ele dispara ao SOLTAR, e não aos 500ms ----
 *
 * Porque o gesto já é de outra pessoa. No Android, arrastar um elemento
 * `draggable` COMEÇA com um toque longo — e a mochila, o equipamento, o
 * depósito e a barra de ações vivem de arrastar (ver `arrasto-do-mouse.mjs`:
 * no toque quem faz o arrasto é o navegador). Abrir o menu no meio da espera
 * tomaria o começo do arrasto de volta, e trocaríamos um comando que falta por
 * um que já existe e funciona.
 *
 * Soltando, os dois gestos ficam distintos sem ambiguidade nenhuma:
 *
 *   segurou e ANDOU com o dedo    é arrasto, e o navegador cuida dele
 *   segurou e soltou PARADO       é o botão direito
 *
 * ---- E o clique que vem atrás é engolido ----
 *
 * O navegador manda um `click` atrás do dedo levantado. Sem engolir esse,
 * segurar em cima de uma poção abriria o menu E beberia a poção — o toque
 * longo faria as duas coisas, que é pior do que não fazer nenhuma.
 */

/** Quanto tempo o dedo fica parado até o toque valer por direito. */
const TOQUE_LONGO_MS = 500;
/*
 * Quanto ele pode escorregar e ainda contar como parado.
 *
 * Dedo em vidro não fica imóvel: doze pixels é o tremor de quem está
 * segurando, e é bem menos do que o passo de quem quis arrastar.
 */
const TREMOR_DO_DEDO = 12;

let toque = null;
// Quando o toque longo disparou (o `click` dele chega logo depois — ou não chega, em alguns navegadores).
let engolirOClique = null;

const emCampoDeTexto = (no) => !!no?.closest?.('input, textarea, select, [contenteditable="true"]');

/**
 * Liga o toque longo. Uma vez só, no `initMobile`.
 *
 * Os ouvintes são de CAPTURA e não cancelam nada: eles só olham o dedo passar.
 * O único que interfere é o do `click`, e só depois de um toque longo ter
 * disparado de verdade.
 */
function ligarToqueLongo() {
  document.addEventListener(
    'pointerdown',
    (evento) => {
      if (evento.pointerType !== 'touch' || !evento.isPrimary) return void (toque = null);
      if (emCampoDeTexto(evento.target)) return void (toque = null);
      toque = {
        id: evento.pointerId,
        x: evento.clientX,
        y: evento.clientY,
        em: Date.now(),
        alvo: evento.target,
        andou: false,
        /*
         * O navegador pode abrir o menu dele sozinho no meio do caminho. Se
         * abrir, este toque já foi respondido e não se responde duas vezes —
         * um direito que chega em dobro no mapa ataca duas vezes.
         */
        jaRespondido: false,
      };
    },
    true
  );

  document.addEventListener('contextmenu', () => { if (toque) toque.jaRespondido = true; }, true);

  document.addEventListener(
    'pointermove',
    (evento) => {
      if (!toque || evento.pointerId !== toque.id) return;
      if (Math.abs(evento.clientX - toque.x) > TREMOR_DO_DEDO || Math.abs(evento.clientY - toque.y) > TREMOR_DO_DEDO) {
        toque.andou = true;
      }
    },
    true
  );

  for (const nome of ['pointercancel', 'lostpointercapture']) {
    document.addEventListener(nome, (evento) => { if (toque && evento.pointerId === toque.id) toque = null; }, true);
  }

  document.addEventListener(
    'pointerup',
    (evento) => {
      const atual = toque;
      toque = null;
      if (!atual || evento.pointerId !== atual.id) return;
      if (atual.andou || atual.jaRespondido) return;
      if (Date.now() - atual.em < TOQUE_LONGO_MS) return;
      /*
       * O alvo é lido pela POSIÇÃO do dedo agora, e não o elemento guardado no
       * `pointerdown`: meio segundo é tempo de sobra para a tela se refazer
       * embaixo dele (a mochila redesenha a cada quadro de estado), e um
       * elemento que saiu da página não responde a evento nenhum.
       */
      const alvo = document.elementFromPoint(evento.clientX, evento.clientY) ?? atual.alvo;
      if (!alvo || emCampoDeTexto(alvo)) return;
      engolirOClique = Date.now();
      alvo.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: evento.clientX,
          clientY: evento.clientY,
          /*
           * `button: 2` porque é isso que um direito é, e há código que olha
           * para ele. `buttons: 0` porque, no instante do menu, botão nenhum
           * está apertado — é o que o navegador manda.
           */
          button: 2,
          buttons: 0,
        })
      );
      // Uma batidinha, para a pessoa saber que o jogo ouviu.
      navigator.vibrate?.(12);
    },
    true
  );

  document.addEventListener(
    'click',
    (evento) => {
      if (engolirOClique == null) return;
      const armado = engolirOClique;
      engolirOClique = null;
      /*
       * Só o `click` do PRÓPRIO toque longo é engolido. Antes a marca ficava armada para sempre
       * quando o navegador não mandava esse `click` — e engolia o PRÓXIMO toque, em outro botão.
       */
      if (!engoleEsteClique(armado, Date.now())) return;
      evento.preventDefault();
      evento.stopPropagation();
    },
    true
  );
}

export function initMobile(ctx) {
  controles = ctx;
  // O botão direito do dedo. Uma vez só, e vale em toda a página.
  ligarToqueLongo();
  const acertar = () => {
    const querAnalogico = ehCelular() && ctx.podeAndar();
    /*
     * Os ícones de ajuste seguem a TELA, e não o "pode andar": eles valem na
     * caçada automática também — é justamente lá que se escolhe o alvo e a
     * distância sem tocar no boneco.
     */
    const querAjustes = ehCelular() && !!document.querySelector('#actionbar .controls');
    if (querAjustes && !painelDeAjustes) {
      painelDeAjustes = desenharAjustesDaCaca();
      document.body.append(painelDeAjustes.caixa, painelDeAjustes.travas);
      ligarArrasto();
    } else if (!querAjustes && painelDeAjustes) {
      document.removeEventListener('pointerdown', painelDeAjustes.foraFecha, true);
      painelDeAjustes.caixa.remove();
      painelDeAjustes.travas.remove();
      painelDeAjustes = null;
      delete document.body.dataset.ajuste;
      /*
       * Saindo do celular, os slots voltam para a grade: as posições ficam
       * guardadas, mas o layout de mesa não é lugar para ícone solto — lá a
       * barra é uma fileira emoldurada e um ícone fora dela ficaria boiando.
       */
      document.body.classList.remove('slots-livres');
      for (const slot of document.querySelectorAll('#hotbar .slot.solto')) {
        slot.classList.remove('solto');
        slot.style.left = slot.style.top = '';
      }
    }

    if (querAnalogico && !montado) {
      montado = desenharAnalogico();
      document.body.append(montado.base);
      document.body.classList.add('com-analogico');
      /*
       * O controle nasce de novo a cada ida e volta da caçada automática, e
       * nasce sempre na posição do CSS. Sem isto, quem o mudou de lugar o veria
       * pular de volta para o canto na primeira hunt.
       */
      acomodarAnalogico();
      return;
    }
    if (!querAnalogico && montado) {
      // Solta o rumo ANTES de sumir: um analógico que some com o dedo em cima
      // deixaria o personagem andando para sempre.
      montado.soltar();
      montado.base.remove();
      montado = null;
      document.body.classList.remove('com-analogico');
    }
  };

  /*
   * ---- A ⚙ e a ▼ saem do teclado no celular ----
   *
   * "no modo de celular tu pode tirar esse minimizar a barra e a engrenagem da
   * barra de habilidade."
   *
   * Elas eram `position: absolute` no canto de cima da barra, e no telefone
   * caíam EM CIMA do primeiro slot — foi o único que ele não conseguiu
   * arrastar no desenho ("o slot que tem engrenagem e setinha eu não consegui
   * mudar"). Some as duas (ver o `.bar-controls` no CSS), e com elas a gaveta
   * que a ▼ abria: os seletores de Alvo, Distância e Lurar já têm os três
   * ícones do rodapé, e o "Stop" passou a ficar no rodapé por conta própria.
   */

  /*
   * `resize` cobre girar o telefone, e `orientationchange` cobre os navegadores
   * que giram sem mudar a medida na hora. Os dois porque nenhum dos dois
   * sozinho pega todo aparelho.
   */
  window.addEventListener('resize', acertar);
  window.addEventListener('orientationchange', acertar);
  acertar();
  /*
   * E a cada quadro de estado: entrar numa hunt automática, sair dela ou chegar
   * na cidade muda a resposta de `podeAndar`, e nenhuma delas dispara evento de
   * mídia. Ver a chamada no `applyState`.
   */
  return acertar;
}
