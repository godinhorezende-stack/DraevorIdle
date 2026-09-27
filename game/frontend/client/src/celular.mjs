/*
 * ---- A TELA DE JOGO no telefone ----
 *
 * A auditoria mediu o que sobrava para jogar num telefone em pé: de 3% a 27%
 * da tela era mapa tocável na cidade. O resto era a barra do computador (15
 * botões, 11 cabendo), o card do HUD, a bolsa aberta, dois avisos e o
 * analógico — todos por cima do mapa.
 *
 * No telefone o jogo passa a ter a organização dele (perfil.mjs):
 *
 *   em pé     status (48px) · MAPA · atalhos paginados · chat (1 linha) · navegação
 *   deitado   trilho de navegação à esquerda · status numa linha · MAPA ·
 *             atalhos numa fileira · painel lateral à direita
 *
 * A navegação tem cinco entradas: Herói · Mochila · CAÇAR · Loja · Mais. O
 * botão do meio muda com o momento — Caçar, Parar (na caça) ou Parar treino.
 *
 * ---- Nada aqui é uma segunda implementação ----
 *
 * Cada botão chama a MESMA função que o botão do computador chama: `abrir` é o
 * `openCharacter`/`openStore`/`openHunts` de sempre, e o "Mais" monta as
 * entradas com o `ferramentaLigada` da barra de cima — a mesma lista (`BARRA`),
 * os mesmos balões, os mesmos alertas. Uma entrada nova na barra aparece no
 * "Mais" sem ninguém lembrar deste arquivo.
 *
 * Os elementos que já existem (o HUD com as barras, as carteiras, a barra de
 * atalhos, as janelas) continuam sendo os mesmos nós, com os mesmos ids e os
 * mesmos desenhos; o CSS da casca (`html[data-perfil]`) só os reorganiza. As
 * carteiras são o único nó que MUDA de lugar, e voltam quando o perfil deixa
 * de ser telefone.
 */
import { perfil, ehTelefone } from './perfil.mjs';
import { abrirFolha, fecharFolha, folhaAberta } from './folha.mjs';
import { aoChegarNoChat, abaDoChat } from './chat.mjs';

const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};

const icone = (nome) => {
  const img = document.createElement('img');
  img.className = 'cel-ico';
  img.alt = '';
  img.src = `/client/assets/icons/${nome}.png`;
  img.onerror = () => img.remove();
  return img;
};

/*
 * ---- O analógico é opção, e começa desligado ----
 *
 * Tocar no mapa já anda (o mesmo `walkTo`/`huntWalkTo` do clique). Com isso o
 * analógico passou a ser uma preferência de quem gosta dele, e não um disco
 * permanente em cima do mapa. Só nos perfis de telefone: no tablet ele segue
 * como era.
 */
const CHAVE_DO_ANALOGICO = 'draevor:analogico';
export function analogicoLigado() {
  if (!ehTelefone()) return true;
  try {
    return localStorage.getItem(CHAVE_DO_ANALOGICO) === '1';
  } catch {
    return false;
  }
}
function ligarAnalogico(ligado) {
  try {
    localStorage.setItem(CHAVE_DO_ANALOGICO, ligado ? '1' : '0');
  } catch {
    /* sem armazenamento: vale só nesta sessão, pelo acertar() abaixo */
  }
  api.acertarAnalogico?.();
}

let api = null;
let nos = null;
const carteiraOrigem = { pai: null, antes: null };

/*
 * ---- CAÇAR, PARAR, PARAR TREINO ----
 *
 * O botão do meio é o que o jogador mais aperta, e ele é grande: um toque sem
 * querer no meio da caça mandaria o personagem para a cidade. Parar pede o
 * segundo toque — o botão vira "Confirmar" por três segundos.
 */
let confirmandoAte = 0;
let relogioDaConfirmacao = 0;

function momento() {
  const hunt = api.state().hunt;
  if (!hunt) return 'cidade';
  return hunt.huntId === 'treino' ? 'treino' : 'caca';
}

function tocarNoCentro() {
  const agora = momento();
  if (agora === 'cidade') {
    api.abrirHunts();
    return;
  }
  if (Date.now() < confirmandoAte) {
    confirmandoAte = 0;
    clearTimeout(relogioDaConfirmacao);
    api.pararCaca();
    pintarCentro();
    return;
  }
  confirmandoAte = Date.now() + 3000;
  clearTimeout(relogioDaConfirmacao);
  relogioDaConfirmacao = setTimeout(() => {
    confirmandoAte = 0;
    pintarCentro();
  }, 3000);
  pintarCentro();
}

function pintarCentro() {
  if (!nos) return;
  const agora = momento();
  const botao = nos.centro;
  const confirmando = agora !== 'cidade' && Date.now() < confirmandoAte;
  const rotulo = confirmando ? 'Parar?' : agora === 'cidade' ? 'Caçar' : agora === 'treino' ? 'Parar treino' : 'Parar';
  if (botao.dataset.rotulo === rotulo) return;
  botao.dataset.rotulo = rotulo;
  botao.dataset.momento = agora;
  botao.classList.toggle('confirmando', confirmando);
  botao.querySelector('.cel-nav-rotulo').textContent = rotulo;
  botao.setAttribute(
    'aria-label',
    agora === 'cidade' ? 'Caçar: escolher uma hunt' : confirmando ? 'Toque de novo para parar' : `${rotulo}: voltar para a cidade`
  );
  const img = botao.querySelector('.cel-ico');
  const arte = agora === 'cidade' ? 'hunts' : 'city';
  if (img && !img.src.endsWith(`/${arte}.png`)) img.src = `/client/assets/icons/${arte}.png`;
}

function botaoDaNav(id, rotulo, arte, aoTocar) {
  const b = el('button', 'cel-nav-botao');
  b.type = 'button';
  b.dataset.cel = id;
  b.append(icone(arte), el('span', 'cel-nav-rotulo', rotulo));
  b.setAttribute('aria-label', rotulo);
  b.onclick = aoTocar;
  return b;
}

/*
 * ---- O "Mais": a barra de cima inteira, em grade ----
 *
 * Os grupos da barra viram seções com título; cada entrada é o botão da
 * própria barra (`ferramentaLigada`), então o balão, o alerta e o que ele abre
 * são os mesmos. Tocar numa entrada fecha a folha antes de abrir a tela, para
 * ela não ficar por baixo.
 */
function abrirMais() {
  abrirFolha({
    id: 'mais',
    titulo: 'Mais',
    classe: 'folha-mais',
    montar: (corpo) => {
      const secao = (titulo, entradas) => {
        const itens = entradas.filter(Boolean);
        if (!itens.length) return;
        const bloco = el('section', 'cel-mais-secao');
        bloco.append(el('h3', null, titulo));
        const grade = el('div', 'cel-mais-grade');
        for (const entrada of itens) {
          // O nome inteiro: o `curto` ("Profic.") só existe para caber na barra de cima.
          const botao = api.ferramentaLigada({ ...entrada, curto: entrada.label });
          botao.classList.add('cel-mais-item');
          botao.addEventListener('click', () => {
            if (folhaAberta() === 'mais') fecharFolha();
          });
          grade.append(botao);
        }
        bloco.append(grade);
        corpo.append(bloco);
      };
      for (const grupo of api.grupos()) {
        if (grupo.gaveta) secao(grupo.label, grupo.gaveta);
        else secao(grupo.label, [grupo]);
      }
      secao('Mais', api.extras());

      // O analógico, a preferência que só existe no telefone.
      const linha = el('label', 'cel-mais-opcao');
      const caixa = document.createElement('input');
      caixa.type = 'checkbox';
      caixa.checked = analogicoLigado();
      caixa.onchange = () => ligarAnalogico(caixa.checked);
      linha.append(caixa, el('span', null, 'Mostrar o analógico (andar também tocando no mapa)'));
      corpo.append(linha);
    },
  });
}

/*
 * ---- A faixa do chat ----
 *
 * Uma linha: a última mensagem da aba aberta. Tocar abre o chat inteiro (a
 * gaveta de sempre, com o teclado). As abas fechadas continuam contando as
 * mensagens novas no próprio chat.
 */
function ligarFaixaDoChat() {
  aoChegarNoChat((canal, noDaMensagem) => {
    if (!nos || canal !== abaDoChat()) return;
    // Hora, nome e fala são nós irmãos sem espaço entre eles.
    const texto = [...noDaMensagem.childNodes]
      .map((parte) => parte.textContent.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');
    nos.chatTexto.textContent = texto;
  });
}

function montar() {
  const game = document.getElementById('game');
  const nav = el('nav', 'cel-nav');
  nav.id = 'cel-nav';
  nav.setAttribute('aria-label', 'Navegação principal');
  const centro = botaoDaNav('cacar', 'Caçar', 'hunts', tocarNoCentro);
  centro.classList.add('cel-nav-centro');
  nav.append(
    botaoDaNav('heroi', 'Herói', 'character', () => api.abrirHeroi()),
    botaoDaNav('mochila', 'Mochila', 'inventory', () => api.abrirMochila()),
    centro,
    botaoDaNav('loja', 'Loja', 'store', () => api.abrirLoja()),
    botaoDaNav('mais', 'Mais', 'options', abrirMais)
  );

  const chat = el('button', 'cel-chat');
  chat.id = 'cel-chat';
  chat.type = 'button';
  chat.setAttribute('aria-label', 'Abrir o chat');
  const chatTexto = el('span', 'cel-chat-texto', 'Chat');
  chat.append(icone('chat'), chatTexto);
  chat.onclick = () => api.abrirChat();

  const carteira = el('div', 'cel-carteira');
  carteira.id = 'cel-carteira';

  const nivel = el('button', 'cel-nivel');
  nivel.id = 'cel-nivel';
  nivel.type = 'button';
  nivel.setAttribute('aria-label', 'Abrir o Herói');
  nivel.onclick = () => api.abrirHeroi();

  const paginas = el('div', 'cel-paginas');
  paginas.id = 'cel-paginas';
  paginas.setAttribute('aria-hidden', 'true');

  game.append(nav, chat, carteira, nivel, paginas);
  nos = { nav, centro, chat, chatTexto, carteira, nivel, paginas };
}

/*
 * As carteiras (ouro e coins) moram na barra de cima do computador. No
 * telefone a barra de cima não existe — elas vão para o canto do status, o
 * mesmo nó com os mesmos ids, e voltam quando o perfil deixa de ser telefone.
 */
function acomodarCarteira() {
  const carteiras = document.querySelector('.wallets');
  if (!carteiras || !nos) return;
  if (ehTelefone()) {
    if (carteiras.parentElement !== nos.carteira) {
      carteiraOrigem.pai = carteiras.parentElement;
      carteiraOrigem.antes = carteiras.nextSibling;
      nos.carteira.append(carteiras);
    }
  } else if (carteiraOrigem.pai && carteiras.parentElement === nos.carteira) {
    carteiraOrigem.pai.insertBefore(carteiras, carteiraOrigem.antes);
  }
}

/*
 * ---- Os atalhos em páginas ----
 *
 * Os 22 slots de sempre, numa fileira só que rola de lado e para de página em
 * página (scroll-snap, no CSS). Os pontos embaixo dizem em que página se está.
 * Nenhum slot muda de índice: arrastar, configurar e as teclas continuam
 * valendo para o mesmo slot.
 */
function ligarPaginas() {
  const barra = document.getElementById('hotbar');
  if (!barra || !nos) return;
  const pintar = () => {
    if (!ehTelefone()) return;
    const largura = barra.clientWidth;
    if (!largura) return;
    const total = Math.max(1, Math.ceil(barra.scrollWidth / largura - 0.05));
    const atual = Math.min(total - 1, Math.round(barra.scrollLeft / largura));
    if (nos.paginas.childElementCount !== total) {
      nos.paginas.replaceChildren(...Array.from({ length: total }, () => el('i')));
    }
    [...nos.paginas.children].forEach((ponto, i) => ponto.classList.toggle('atual', i === atual));
    nos.paginas.hidden = total < 2;
  };
  barra.addEventListener('scroll', pintar, { passive: true });
  new ResizeObserver(pintar).observe(barra);
  window.addEventListener('draevor:perfil', pintar);
  pintar();
}

/*
 * No telefone o jogo abre com o MAPA livre: as gavetas que o arranjo do
 * computador deixava abertas (chat, bolsa) esperam o toque. A regra não é
 * gravada — no computador elas continuam abertas como a pessoa deixou.
 */
function mapaLivreNaEntrada() {
  if (!ehTelefone()) return;
  for (const janela of document.querySelectorAll('.window')) {
    if (janela.hidden || !janela.dataset.windowId) continue;
    api.esconderJanela(janela.dataset.windowId);
  }
}

export function initCelular(ferramentas) {
  api = ferramentas;
  // Trocar de personagem refaz o jogo, não a casca: ela é montada uma vez.
  if (nos) {
    mapaLivreNaEntrada();
    return atualizarCelular();
  }
  montar();
  ligarFaixaDoChat();
  acomodarCarteira();
  ligarPaginas();
  mapaLivreNaEntrada();
  const aoMudarDePerfil = () => {
    acomodarCarteira();
    api.acertarAnalogico?.();
    if (!ehTelefone()) fecharFolha();
  };
  window.addEventListener('draevor:perfil', aoMudarDePerfil);
  atualizarCelular();
}

/** A cada estado: o botão do meio, o selo de nível e os alertas. */
export function atualizarCelular() {
  if (!nos || !api) return;
  pintarCentro();
  const personagem = api.state().character;
  if (personagem) {
    const texto = String(personagem.level ?? '');
    if (nos.nivel.textContent !== texto) nos.nivel.textContent = texto;
  }
  const alerta = api.temAlerta?.() ?? false;
  nos.nav.querySelector('[data-cel="mais"]').classList.toggle('alerta', alerta);
  document.documentElement.dataset.momento = momento();
  void perfil;
}
