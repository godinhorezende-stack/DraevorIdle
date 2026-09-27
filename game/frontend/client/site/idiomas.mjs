/*
 * Português e inglês, na mesma página.
 *
 * ---- Como funciona ----
 *
 * O HTML traz o texto em PORTUGUÊS escrito nele, e cada pedaço traduzível leva
 * um `data-t="chave"`. Trocar de idioma é varrer esses elementos e escrever a
 * frase do dicionário.
 *
 * O português ficar no HTML não é preguiça: é o que garante que a página
 * apareça inteira e legível mesmo se este módulo não carregar — rede ruim,
 * JavaScript bloqueado, um erro numa vírgula do dicionário. Uma página que
 * nasce vazia esperando tradução é uma página que às vezes fica vazia.
 *
 * O idioma escolhido fica no `localStorage`. Na primeira visita, quem chega com
 * o navegador em português vê português; todo o resto do mundo vê inglês.
 */
const CHAVE = 'draevor:idioma';

export const DICIONARIO = {
  en: {
    // ---- faixa e menu ----
    'faixa.teste': 'Test server · in development — expect bugs',
    'menu.ranking': 'Ranking',
    'menu.online': 'Online',
    'menu.donate': 'Donate',
    'menu.como': 'How it works',
    'menu.entrar': 'Play',
    'menu.discord': 'Discord',
    'menu.whatsapp': 'Draevor Idle WhatsApp group',
    'menu.idioma': 'Language',

    // ---- capa ----
    'capa.linha': 'The RPG that keeps playing without you.',
    'capa.chamada':
      'Pick a cave, set up your spell bar and let it run — your character hunts, collects loot and levels up with the tab closed. When you feel like playing hands-on, you take the wheel and call your friends.',
    'capa.entrar': 'Play now',
    'capa.criar': 'Create free account',
    'capa.promessa1': 'Runs in the browser — nothing to download',
    'capa.promessa2': 'Keeps hunting with the tab closed',
    'capa.promessa3': 'Group hunts, market and ranking',

    // ---- placar ----
    'placar.titulo': 'The server right now',
    'placar.online': 'Playing right now',
    'placar.personagens': 'Characters created',
    'placar.level': 'Highest level',
    'placar.hunts': 'Caves open',
    'placar.verOnline': "See who's online",
    'placar.verRanking': 'See the full ranking',
    'top5.titulo': 'Top 5 level',
    'topo.online': 'online',

    // ---- ranking ----
    'ranking.titulo': 'Ranking',
    'ranking.legenda': 'Top twenty in each category. The lit dot is who is playing now.',
    'ranking.personagem': 'Character',
    'ranking.vocacao': 'Vocation',
    'ranking.level': 'Level',
    'ranking.exp': 'Experience',
    'ranking.pontos': 'Points',
    'ranking.vazio': 'nobody in the ranking yet — be the first',
    'ranking.carregando': 'loading...',

    // ---- donate ----
    'doar.titulo': 'Draevor Coins',
    'doar.legenda':
      'Pix or credit card, through InfinitePay. Coins land in your account automatically once the payment clears — usually in seconds.',
    'doar.nota': 'Sign in with your game account and pay right here. The coins land in your account automatically.',
    'doar.coins': 'Draevor Coins',
    'doar.botao': 'Donate',
    'doar.entrar': 'Sign in with your game account. Same account, same password.',
    'doar.botaoEntrar': 'Sign in',
    'doar.ou': 'or with e-mail and password',
    'doar.dicaGoogle': 'signed up with Google in the game? use the button above',
    'doar.semConta': "Don't have an account yet? Create one in the game — it takes fifteen seconds.",
    'doar.conta': 'Account',
    'doar.cartao': 'Credit card',
    'doar.pixNota': 'instant',
    'doar.parcelado': 'in instalments — surcharge of',
    'doar.parcelado2': 'in instalments',
    'doar.abrindo': 'opening the charge...',
    'doar.pagar': 'Pay with your phone',
    'doar.passoPix':
      'Open your phone camera (not your bank app) and point it at the code. The page opens on your phone — choose Pix and the real code shows up there, with copy and paste.',
    'doar.passoCartao':
      'Open your phone camera and point it at the code. The page opens on your phone — choose Credit and enter your card details.',
    'doar.naoEhPix': 'This is the address of the payment page, not a Pix code.',
    'doar.aqui': 'Pay on this device',
    'doar.copiar': 'Copy link',
    'doar.copiado': 'copied!',
    'doar.automatico':
      'The Draevor Coins land in your account automatically once the payment clears — usually in seconds.',
    'doar.pedido': 'Order',
    'doar.titulo2': 'Draevor Coins',

    // ---- como funciona ----
    'como.titulo': 'How it works',
    'como.legenda': 'Three steps, and the rest is how far you want to go.',
    'como.passo1': 'Create your character',
    'como.passo1txt':
      'Knight, Paladin, Druid, Sorcerer or Monk. Account by e-mail or with Google, and you are in.',
    'como.passo2': 'Send it hunting',
    'como.passo2txt':
      'Pick the cave, the strategy and what to spend on supplies. It walks, fights and collects — with the tab closed too.',
    'como.passo3': 'Take over whenever',
    'como.passo3txt':
      'In Online Hunt you walk, aim the runes and cast the spells. Bring friends: each one brings their own bar.',

    // ---- fecho e rodapé ----
    'fecho.titulo': 'The cave is open',
    'fecho.legenda': 'Fifteen seconds to create an account. After that, just let it run.',
    'fecho.botao': 'Start now',
    'rodape.entrar': 'Play',
    'rodape.ranking': 'Ranking',

    // ---- quem está online ----
    'drops.titulo': 'Latest drops',
    'drops.legenda': 'The rarest things that dropped on the server: legendary or mythic BOSS drops with two stars or more, anything that rolled three golden stars, and the bags — from bosses or ordinary creatures. Hover to see its stats.',
    'drops.carregando': 'loading...',
    'drops.vazio': 'nothing has dropped yet — the bar fills itself as soon as something does',
    'drops.extras': 'Extra attributes',
    'drops.agora': 'now',
    'bags.titulo': 'Latest bags opened',
    'bags.legenda': 'What came out of the Bag You Desire, Covet, Primal and Draevor bags opened a moment ago — one piece per bag.',
    'bags.vazio': 'no bag opened yet — the bar fills itself as soon as one is',
    'drops.daBag': 'Came out of',
    'drops.entre': 'Draw',
    'drops.abriu': 'Opened by',
    'online.titulo': "Who's online",
    'online.legenda1': 'playing right now. The list refreshes itself every fifteen seconds.',
    'online.pessoa': 'person',
    'online.pessoas': 'people',
    'online.fazendo': 'What they are doing',
    'online.vazio': 'nobody online right now — the cave is yours',
    'online.cacando': 'Hunting',
    'online.online': 'Online Hunt',
    'online.boss': 'In a boss room',
    'online.patio': 'Training at the yard',
    'online.exercise': 'Training with exercise',
    'online.treinando': 'Training',
    'online.cidade': 'In town',
    'online.parado': 'Connected',

    // ---- categorias do ranking ----
    'cat.exp': 'Experience',
    'cat.level': 'Level',
  },
};

/** O idioma de agora. `pt` é o padrão, e o que está escrito no HTML. */
export function idioma() {
  const guardado = localStorage.getItem(CHAVE);
  if (guardado === 'pt' || guardado === 'en') return guardado;
  // Primeira visita: quem tem o navegador em português vê português.
  return (navigator.language ?? '').toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

/** Uma frase, no idioma de agora. Sem tradução, devolve o padrão que veio. */
export function t(chave, padrao = '') {
  const lingua = idioma();
  if (lingua === 'pt') return padrao;
  return DICIONARIO[lingua]?.[chave] ?? padrao;
}

/**
 * Escreve a página inteira no idioma escolhido.
 *
 * Guarda o texto original em português no próprio elemento na primeira passada
 * (`dataset.pt`): sem isso, voltar de inglês para português precisaria de um
 * segundo dicionário — e dois dicionários discordam no dia em que alguém mexer
 * só num deles.
 */
export function aplicarIdioma() {
  const lingua = idioma();
  document.documentElement.lang = lingua === 'pt' ? 'pt-BR' : 'en';

  for (const alvo of document.querySelectorAll('[data-t]')) {
    if (alvo.dataset.pt === undefined) alvo.dataset.pt = alvo.textContent;
    alvo.textContent = lingua === 'pt' ? alvo.dataset.pt : DICIONARIO.en[alvo.dataset.t] ?? alvo.dataset.pt;
  }
  for (const alvo of document.querySelectorAll('[data-t-title]')) {
    if (alvo.dataset.ptTitle === undefined) alvo.dataset.ptTitle = alvo.title;
    alvo.title =
      lingua === 'pt' ? alvo.dataset.ptTitle : DICIONARIO.en[alvo.dataset.tTitle] ?? alvo.dataset.ptTitle;
  }
}

export function escolherIdioma(lingua) {
  localStorage.setItem(CHAVE, lingua);
  aplicarIdioma();
  // A página avisa quem desenha conteúdo vindo do servidor (ranking, lista de
  // online): esses textos não estão no HTML e precisam ser refeitos.
  window.dispatchEvent(new CustomEvent('draevor:idioma', { detail: lingua }));
}

/**
 * A engrenagem, montada por código.
 *
 * Ela mora no menu de cima das duas páginas do site, e escrevê-la duas vezes no
 * HTML seria duas listas de idiomas para manter em dia.
 */
export function montarSeletor(dentro) {
  const caixa = document.createElement('div');
  caixa.className = 'idioma';

  const botao = document.createElement('button');
  botao.className = 'idioma-botao';
  botao.type = 'button';
  botao.title = 'Idioma / Language';
  botao.setAttribute('aria-label', 'Idioma');
  botao.innerHTML =
    '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">' +
    '<path fill="currentColor" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 6.2A2.2 2.2 0 1 1 12 9.8a2.2 2.2 0 0 1 0 4.4Z"/>' +
    '<path fill="currentColor" d="m19.4 13-.1-1 1.6-1.3a.7.7 0 0 0 .2-.9l-1.6-2.7a.7.7 0 0 0-.8-.3l-1.9.7a7.6 7.6 0 0 0-1.7-1l-.3-2a.7.7 0 0 0-.7-.6h-3.2a.7.7 0 0 0-.7.6l-.3 2c-.6.2-1.2.6-1.7 1l-1.9-.7a.7.7 0 0 0-.8.3L3.9 9.8a.7.7 0 0 0 .2.9L5.7 12l-.1 1 .1 1-1.6 1.3a.7.7 0 0 0-.2.9l1.6 2.7c.2.3.5.4.8.3l1.9-.7c.5.4 1.1.8 1.7 1l.3 2c0 .4.3.6.7.6h3.2c.4 0 .7-.2.7-.6l.3-2c.6-.2 1.2-.6 1.7-1l1.9.7c.3.1.6 0 .8-.3l1.6-2.7a.7.7 0 0 0-.2-.9L19.3 14l.1-1Z" opacity=".85"/>' +
    '</svg>';

  const menu = document.createElement('div');
  menu.className = 'idioma-menu';
  menu.hidden = true;

  for (const [chave, rotulo] of [['pt', 'Português'], ['en', 'English']]) {
    const opcao = document.createElement('button');
    opcao.type = 'button';
    opcao.textContent = rotulo;
    opcao.setAttribute('aria-selected', String(idioma() === chave));
    opcao.onclick = () => {
      escolherIdioma(chave);
      for (const outra of menu.children) {
        outra.setAttribute('aria-selected', String(outra === opcao));
      }
      menu.hidden = true;
    };
    menu.append(opcao);
  }

  botao.onclick = (evento) => {
    evento.stopPropagation();
    menu.hidden = !menu.hidden;
  };
  // Clique em qualquer outro lugar fecha: um menu que só fecha no próprio botão
  // fica aberto por cima da página enquanto a pessoa tenta clicar noutra coisa.
  document.addEventListener('click', () => (menu.hidden = true));

  caixa.append(botao, menu);
  dentro.append(caixa);
  return caixa;
}
