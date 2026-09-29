
/*
 * De onde a pessoa veio, guardado no NAVEGADOR.
 *
 * O servidor ja grava um cookie com isso, mas o cookie nao chega no cadastro: a
 * conta nasce numa mensagem de WebSocket, e o aperto de mao do socket e' na
 * rota `/ws` — sem `?src=` e, dependendo do caminho que o visitante fez, sem o
 * cookie tambem. O resultado era 66 de 68 contas marcadas como "direto" com os
 * anuncios trazendo gente comprovadamente.
 *
 * Aqui a etiqueta e' lida da URL na chegada e fica no `localStorage`, que
 * sobrevive a navegacao entre paginas e volta junto na mensagem de cadastro.
 */
const ORIGEM_KEY = 'rvx_origem';

(function guardarOrigem() {
  try {
    const url = new URLSearchParams(location.search);
    const veio = (url.get('src') ?? url.get('utm_source') ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 40);
    // So grava se veio algo: navegar pelo site sem etiqueta nao apaga a origem
    // de quem chegou por um anuncio minutos antes.
    if (veio) localStorage.setItem(ORIGEM_KEY, veio);
  } catch {
    // Navegador com armazenamento bloqueado: segue sem origem, e o cookie do
    // servidor ainda pode salvar o caso.
  }
})();

const origemGuardada = () => {
  try {
    return localStorage.getItem(ORIGEM_KEY) || '';
  } catch {
    return '';
  }
};

// Portão de entrada: conta (e-mail/senha ou Google), lista e criação de
// personagem. Só depois de escolher um personagem o jogo aparece.
import { outfitCanvas, drawEffect, effectDuration } from './sprites.mjs';
import { artOrUiIcon } from './hud.mjs';
/*
 * O mesmo gerador de QR do donate. Ele mora em `packages/` porque o servidor
 * também o usa — e aqui ele desenha o quadrado da verificação em duas etapas
 * SEM que o segredo da conta saia desta máquina. Ver `desenharQrDoApp`.
 */
import { qrcode } from '/packages/shared/src/qrcode.mjs';

/*
 * Quantos personagens cabem numa conta.
 *
 * Quem decide é o servidor — ele manda `characterLimit` junto da conta, e é
 * esse número que vale. Este aqui só cobre o instante antes de a conta chegar,
 * e é o mesmo `MAXIMO_DE_PERSONAGENS` de `server/src/accounts.mjs`.
 */
const MAXIMO_DE_PERSONAGENS = 5;

const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const TOKEN_KEY = 'draevor:token';
const LAST_CHARACTER = 'draevor:character';

/*
 * ---- Entrar é uma coisa; VOLTAR é outra ----
 *
 * O `account` que chega do servidor é o mesmo nos dois casos, e por isso os
 * dois caíam na mesma resposta: entrar direto no último personagem. Quem
 * clicava "entrar no jogo" no site nunca via a lista — ia parar dentro do
 * personagem sem escolher.
 *
 * O que separa os dois não está na mensagem, está em QUEM abriu a conexão:
 *
 *   - carregar a página (o clique do site, um F5) é uma entrada nova, e nela a
 *     resposta certa é a lista;
 *   - o socket cair e voltar sozinho — servidor reiniciado, wi-fi, notebook
 *     fechado — é a MESMA sessão continuando, e ali a resposta certa é voltar
 *     para dentro do personagem, sem pedir nada.
 *
 * E é justamente isso que uma variável de módulo distingue de graça: ela nasce
 * `false` a cada carregamento da página e sobrevive a quantas reconexões o
 * `connect` fizer, porque ele religa o WebSocket sem recarregar nada (ver o
 * `close` em `main.mjs`). Guardá-la no `localStorage` ou no `sessionStorage`
 * seria errado pelo motivo oposto: os dois sobrevivem ao recarregamento, que é
 * exatamente o caso que precisa cair na lista.
 */
let entrouNestaAba = false;

/*
 * ---- O token e o personagem são DESTA ABA ----
 *
 * Report do dono: logado numa conta, abria outra aba e entrava noutra conta; ao
 * voltar para a primeira e tentar sair do personagem, a lista mostrava os chars
 * da OUTRA conta. O `localStorage` é um só para o navegador inteiro: o login da
 * segunda aba sobrescrevia o token, e o `resume` da primeira (o da caixa de
 * trocar, a cada três segundos) passava a pedir a conta errada.
 *
 * Agora cada aba guarda o seu na memória e no `sessionStorage` (que é por aba e
 * sobrevive ao F5). O `localStorage` continua sendo escrito, mas só serve de
 * ponto de partida para uma aba NOVA — que é quando "a última conta usada" é
 * mesmo a resposta certa.
 */
let tokenDestaAba = null;
let personagemDestaAba = null;

function tokenDaAba() {
  return tokenDestaAba ?? sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
}

function guardarToken(token) {
  tokenDestaAba = token;
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_KEY, token);
}

function esquecerToken() {
  const era = tokenDaAba();
  tokenDestaAba = null;
  sessionStorage.removeItem(TOKEN_KEY);
  // Só apaga o compartilhado se ele ainda for o desta aba: senão sair aqui
  // derrubaria o login que outra aba acabou de fazer.
  if (localStorage.getItem(TOKEN_KEY) === era) localStorage.removeItem(TOKEN_KEY);
}

function lembrarPersonagem(nome) {
  personagemDestaAba = nome;
  sessionStorage.setItem(LAST_CHARACTER, nome);
  localStorage.setItem(LAST_CHARACTER, nome);
}

function esquecerPersonagem() {
  personagemDestaAba = null;
  sessionStorage.removeItem(LAST_CHARACTER);
  localStorage.removeItem(LAST_CHARACTER);
}

function personagemDaAba() {
  return personagemDestaAba ?? sessionStorage.getItem(LAST_CHARACTER) ?? localStorage.getItem(LAST_CHARACTER);
}

/**
 * A ordem é a das cinco zonas de cor do fundo da tela de criação, da esquerda
 * para a direita. O looktype de cada sexo vem do outfits.xml do servidor — o
 * monge nasce com o outfit chamado Monk, e não com o Citizen.
 */
const VOCATION_INFO = {
  knight: {
    name: 'Knight',
    looks: { male: 131, female: 139 },
    /*
     * As perícias que a vocação sobe rápido, nos mesmos ícones da ficha.
     *
     * Elas substituem a enumeração que estava na descrição ("rápido no avanço
     * de sword, club e axe"): três ícones dizem isso numa linha, e a frase que
     * sobra fica com o que só se diz em palavras.
     */
    skills: ['melee'],
    efeito: 35, // CONST_ME_GROUNDSHAKER — o baque de quem bate de perto
    elementos: ['physical'],
    blurb: 'Mestre do combate corpo a corpo, e extremamente resistente.',
  },
  paladin: {
    name: 'Paladin',
    looks: { male: 129, female: 137 },
    skills: ['distance'],
    efeito: 40, // CONST_ME_HOLYDAMAGE — o sagrado do exori san
    elementos: ['holy'],
    blurb: 'Mestre da luta à distância, com um domínio leve das artes mágicas sagradas.',
  },
  druid: {
    name: 'Druid',
    looks: { male: 130, female: 138 },
    skills: ['magic'],
    elementos: ['ice', 'earth'],
    efeito: 44, // CONST_ME_ICEATTACK
    blurb: 'Mestre da cura e dos elementos criativos: terra e gelo.',
  },
  sorcerer: {
    name: 'Sorcerer',
    looks: { male: 133, female: 141 },
    skills: ['magic'],
    elementos: ['fire', 'energy'],
    efeito: 37, // CONST_ME_FIREATTACK
    blurb: 'Mestre das magias ofensivas e dos elementos destrutivos: fogo e energia.',
  },
  monk: {
    name: 'Monk',
    looks: { male: 1824, female: 1825 },
    skills: ['melee'],
    icone: 'fist', // o melee do monk é o punho: o ícone dele não é o da espada
    efeito: 10, // CONST_ME_HITAREA — o golpe seco, sem elemento
    elementos: ['physical'],
    blurb: 'Mestre da luta de punhos e da arte da cura.',
  },
};

const SEX_LABEL = { male: 'Masculino', female: 'Feminino' };

/*
 * ---- As regras do nome, ditas ANTES de o jogador errar ----
 *
 * Elas são as mesmas de `createPlayerCharacter`, em server/src/accounts.mjs, e
 * a repetição aqui é deliberada: o servidor continua sendo a lei — ele recusa
 * de novo, e recusaria mesmo que esta tela mentisse. Isto aqui é conveniência,
 * para a pessoa saber a regra enquanto digita em vez de descobrir clicando.
 *
 * Antes, escrever "Knight2", escolher a vocação e clicar em Criar era o único
 * jeito de aprender que número não vale. E se errasse de novo, aprendia de novo.
 *
 * `À-ÿ` continua valendo: acento e cedilha são letras, e um servidor brasileiro
 * que recusasse "Gonçalo" estaria errado.
 */
const NOME_VALIDO = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{2,19}$/;

function problemaNoNome(cru) {
  const nome = String(cru ?? '');
  if (!nome) return 'Escreva um nome.';
  if (nome !== nome.trim()) return 'Sem espaço no começo nem no fim.';
  if (nome.length < 3) return 'Pelo menos 3 letras.';
  if (nome.length > 20) return 'No máximo 20 letras.';
  if (/\s{2,}/.test(nome)) return 'Sem dois espaços seguidos.';
  if (!NOME_VALIDO.test(nome)) return 'Só letras e espaço, começando com letra.';
  return null;
}

/*
 * O que cada ícone da vocação quer dizer, por extenso.
 *
 * Os desenhos são os da ficha e quem já jogou os reconhece — mas quem está
 * criando o PRIMEIRO personagem nunca os viu, e é justamente essa pessoa que
 * está nesta tela.
 *
 * Duas linhas em cada um: o balão do jogo transforma a primeira em cabeçalho
 * (ver `showTexto` em tooltip.mjs), então o nome da perícia vira título e a
 * explicação vira o corpo, sem uma linha de CSS nova.
 */
/*
 * ---- A magia da vocação, ao escolher ----
 *
 * Um efeito do próprio jogo tocado em cima do boneco: o sagrado do paladino, o
 * gelo do druida, o baque do knight. Dura o que a animação dura e some.
 *
 * ---- A conta do centro ----
 *
 * `drawEffect` ancora o sprite pelo canto de baixo-direita do tile, e o
 * comentário dele registra uma medição que resolve o resto: o centro VISUAL de
 * cada efeito cai em (16, 16) do tile, mesmo nos que são 32x64 ou moram só num
 * quadrante do slot.
 *
 * Então a tela é de 96, o desenho começa transladado em (32, 32), e o centro
 * visual aterrissa em (48, 48) — o meio da tela. Um efeito de 64px ainda cabe
 * inteiro; foi por isso que 96, e não 64.
 */
const TELA_DO_EFEITO = 96;

function tocarEfeito(tela, id) {
  const duracao = effectDuration(id);
  if (!tela || !duracao) return;
  const ctx = tela.getContext('2d');
  const escala = (tela.width || 1) / TELA_DO_EFEITO;
  const inicio = performance.now();

  const quadro = (agora) => {
    const andado = (agora - inicio) / duracao;
    ctx.clearRect(0, 0, tela.width, tela.height);
    if (andado >= 1) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.scale(escala, escala);
    ctx.translate(32, 32);
    drawEffect(ctx, id, 0, 0, andado);
    ctx.restore();
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
}

const NOME_DA_PERICIA = {
  melee: 'Melee fighting\nPunho, clava, espada e machado: uma perícia só. Esta vocação sobe rápido nela.',
  distance: 'Distance fighting\nArco, besta e spear. Esta vocação sobe rápido nela.',
  magic: 'Magic level\nO poder das magias. Esta vocação sobe rápido nele.',
  shielding: 'Shielding\nDefesa com escudo.',
};

const NOME_DO_ELEMENTO = {
  physical: 'Dano físico\nO golpe da arma, o que a armadura do bicho apara.',
  holy: 'Dano sagrado\nO elemento das magias do paladino.',
  ice: 'Dano de gelo\nUm dos elementos do druida.',
  earth: 'Dano de terra\nUm dos elementos do druida.',
  fire: 'Dano de fogo\nUm dos elementos do sorcerer.',
  energy: 'Dano de energia\nUm dos elementos do sorcerer.',
};

/*
 * Quando este PERSONAGEM foi visto pela última vez.
 *
 * Quem sabe dizer há quanto tempo o jogador está fora é o navegador dele, e não
 * o servidor: ao recarregar a página, o socket antigo demora a fechar do lado
 * de lá — chega a ficar no ar depois de a aba nova já ter entrado —, e por isso
 * o servidor media a ausência em milésimos de segundo quando ela tinha sido de
 * minutos. O carimbo vai junto no `play` e o servidor faz a conta com ele.
 *
 * ---- Por que por PERSONAGEM, e não pela máquina ----
 *
 * O carimbo era um só, global. Isso bastava enquanto a única ausência possível
 * fosse "fechei a aba", mas some com o resumo justamente no caso que o dono
 * pediu: trocar de personagem. Jogando no segundo, a tela recebe estado quatro
 * vezes por segundo e reescreve o carimbo — então, ao voltar para o primeiro
 * depois de vinte minutos, o servidor via uma ausência de DOIS SEGUNDOS e
 * engolia o "enquanto você esteve fora".
 *
 * Um carimbo por personagem responde à pergunta certa — "há quanto tempo
 * ninguém olha para ESTE aqui" — e continua respondendo ao caso antigo: quem
 * recarrega a página volta ao mesmo personagem, cujo carimbo parou junto com a
 * aba.
 */
const CHAVE_VISTO = (nome) => `draevor:visto:${String(nome ?? '').toLowerCase()}`;

/*
 * "há 3h", "há 2 dias" — para o card do personagem parado.
 *
 * Uma data e hora completas não respondem à pergunta que se faz olhando a
 * lista, que é "faz muito tempo?". O corte em horas e dias é o bastante:
 * ninguém precisa do minuto exato de quando parou de jogar há uma semana.
 */
function desdeQuando(quando) {
  const minutos = Math.max(0, Math.round((Date.now() - Number(quando || 0)) / 60000));
  if (minutos < 1) return 'agora há pouco';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 48) return `há ${horas}h`;
  return `há ${Math.round(horas / 24)} dias`;
}

export function ultimoVisto(nome) {
  try {
    const doPersonagem = Number(localStorage.getItem(CHAVE_VISTO(nome))) || 0;
    if (doPersonagem) return doPersonagem;
    // Quem já jogava antes desta mudança tem só o carimbo antigo, global. Ele
    // serve de ponto de partida uma vez, e depois cada personagem passa a ter o
    // seu.
    return Number(localStorage.getItem('draevor:visto')) || 0;
  } catch {
    return 0;
  }
}

/** Marca que ESTE personagem está sendo visto agora. */
export function marcarVisto(nome, quando) {
  try {
    localStorage.setItem(CHAVE_VISTO(nome), String(quando));
  } catch {
    /* modo privado: segue sem carimbo, e o resumo da ausência não sai */
  }
}

/**
 * O card de um personagem: retrato, nome, vocação e o que ele está fazendo.
 *
 * Exportado porque agora ele aparece em DOIS lugares — na lista de personagens
 * e na caixa de trocar de personagem, de dentro do jogo. Duas cópias do mesmo
 * desenho é o começo de dois desenhos diferentes: uma ganha o addon, a outra
 * não; uma mostra o "caçando em", a outra fica no level de ontem.
 *
 * Ele não decide o que acontece ao clicar — quem monta liga o `onclick`. Da
 * lista, escolher é entrar; do jogo, é trocar. O card é o mesmo.
 */
export function cartaoDePersonagem(character, { atual = false, comBarra = false } = {}) {
  const card = el('button', `character-card${atual ? ' atual' : ''}`);
  card.type = 'button';
  /*
   * O retrato em 64, e não em 48.
   *
   * Este card é a vitrine da conta: é onde a pessoa vê o personagem dela com o
   * outfit e os addons que ela pagou. Em 48 o addon vira um borrão de três
   * pixels — o desenho está lá e não dá para reconhecer.
   */
  card.append(outfitCanvas(character.outfit?.type ?? 128, character.outfit, 64));
  const info = el('div');
  /*
   * A linha da vocação leva o ÍCONE dela.
   *
   * O desenho é o da primeira perícia da vocação (ver `VOCATION_INFO`): espada
   * para knight, arco para paladin, magia para druid e sorcerer, punho para
   * monk. São os mesmos ícones da ficha, então a lista e a ficha falam a mesma
   * língua — e não nasce uma segunda tabela de "vocação → desenho" para
   * divergir da primeira.
   *
   * `artOrUiIcon` se apaga sozinho quando não há desenho (ver hud.mjs), então
   * uma vocação nova sem ícone mostra só o texto, como hoje.
   */
  const ficha = VOCATION_INFO[character.vocation];
  const linha = el('span');
  if (ficha?.skills?.[0]) {
    const icone = artOrUiIcon(`sk-${ficha.icone ?? ficha.skills[0]}`, '');
    icone.classList.add('vocacao-ico');
    linha.append(icone);
  }
  // `vocationName`: o nome depois da promoção ("Elite Knight"), que o servidor manda.
  linha.append(document.createTextNode(`${character.vocationName ?? ficha?.name ?? 'Sem vocação'} · level ${character.level}`));
  info.append(el('b', null, character.name), linha);
  /*
   * ---- O que ele está fazendo agora ----
   *
   * Sair de um personagem não o tira do mundo: ele continua caçando enquanto
   * você joga no outro. Só que a lista não dizia isso, e quem tinha três
   * personagens não tinha como saber qual estava rendendo, nem onde — a
   * informação existia no servidor e morria lá.
   *
   * Quem está parado mostra o "visto por último". O ponto colorido separa os
   * dois de longe, sem precisar ler.
   */
  if (character.fazendo) {
    const agora = el('em', `character-fazendo ${character.fazendo.tipo}`);
    agora.append(el('i', 'character-ponto'), document.createTextNode(character.fazendo.onde));
    info.append(agora);
  } else if (character.lastSeen) {
    const parado = el('em', 'character-fazendo parado');
    // O mesmo ponto dos outros, apagado: as três linhas alinham entre si.
    parado.append(el('i', 'character-ponto'), document.createTextNode(`Parado · ${desdeQuando(character.lastSeen)}`));
    info.append(parado);
  }
  /*
   * ---- A barra da atividade ----
   *
   * Só na caixa de trocar de personagem (`comBarra`), e não na lista do
   * portão: lá a pessoa está escolhendo com quem jogar e o nome basta; aqui
   * ela está decidindo se vale a pena LARGAR o que está fazendo, e para isso
   * precisa ver o quanto cada um ainda tem.
   *
   * A tela não calcula nada. Fração, texto e tipo vêm prontos do servidor (ver
   * `oQueEstaFazendo`), porque cada atividade tem uma régua diferente — cargas,
   * experiência, 42h, 12h — e escolher qual usar aqui seria uma segunda regra,
   * longe da primeira, que um dia discorda dela.
   */
  const desenharBarra = (dados) => {
    if (!dados) return;
    const caixa = el('div', `hud-bar character-barra ${dados.tipo}`);
    const liquido = el('i');
    liquido.style.setProperty('--fill', `${Math.max(0, Math.min(100, (dados.fracao ?? 0) * 100))}%`);
    caixa.append(liquido, el('span', null, dados.texto ?? ''));
    info.append(caixa);
  };

  if (comBarra) {
    /*
     * A experiência vem SEMPRE, e a da atividade abaixo dela quando existe.
     *
     * A de exp é a régua que o jogador acompanha em todos os personagens — some
     * só em quem não está fazendo nada. Mesmo no boneco, que dá perícia e não
     * experiência, ela fica: tirá-la justo ali obrigaria a entrar no personagem
     * para saber onde ele parou.
     *
     * A segunda responde outra pergunta: quanto ainda dura. São perguntas
     * diferentes, então são duas barras e não uma que troca de significado.
     */
    desenharBarra(character.fazendo?.exp);
    desenharBarra(character.fazendo?.barra);
  }

  card.append(info);
  // Em quem você já está não se clica: ele fica marcado e desligado.
  if (atual) {
    info.append(el('em', 'character-fazendo atual-marca', 'Você está aqui'));
    card.disabled = true;
  }
  return card;
}

export function createGate({ send, onPlay }) {
  let account = null;
  /*
   * Quem pediu o retrato da conta de DENTRO do jogo, se alguém pediu.
   *
   * Ver `atualizarConta` e o `t: 'account'` do `handle`: o mesmo aviso serve a
   * duas situações muito diferentes, e sem esta marca a segunda cai no caminho
   * da primeira — trocando a tela e reentrando no personagem.
   */
  let aoAtualizarConta = null;
  // Quantos `resume` de dentro do jogo ainda esperam resposta. Ver o `handle`.
  let pedidosDeConta = 0;
  let googleReady = false;
  let vocation = 'knight';
  let sex = 'male';

  const show = (pane) => {
    for (const id of ['pane-auth', 'pane-characters', 'pane-create']) $(id).hidden = id !== pane;
    // A criação tem fundo próprio e card largo: as cinco vocações em fileira.
    const criando = pane === 'pane-create';
    $('gate').classList.toggle('creating', criando);
    const box = document.querySelector('.gate-box');
    box.classList.toggle('creating', criando);
    // A lista de personagens pede largura própria: ver `.gate-box.escolhendo`.
    box.classList.toggle('escolhendo', pane === 'pane-characters');
    // Card largo pede moldura mais grossa, senão o ornamento some de tão fino.
    box.classList.toggle('ui-frame--wide', criando);
  };

  const fail = (message) => {
    for (const id of ['gate-error', 'gate-error-2', 'gate-error-3']) {
      $(id).textContent = '';
      // O aviso de sessão assumida é informação, não recusa: ele usa a mesma
      // caixa e precisa devolvê-la quando um erro de verdade aparece.
      $(id).classList.remove('aviso');
    }
    const visible = ['pane-auth', 'pane-characters', 'pane-create'].find((id) => !$(id).hidden);
    const target = { 'pane-auth': 'gate-error', 'pane-characters': 'gate-error-2', 'pane-create': 'gate-error-3' }[visible];
    if (target) $(target).textContent = message;
  };

  // ---------- abas entrar / criar conta ----------

  for (const button of document.querySelectorAll('[data-auth]')) {
    button.onclick = () => {
      const mode = button.dataset.auth;
      for (const other of document.querySelectorAll('[data-auth]')) {
        other.setAttribute('aria-selected', String(other === button));
      }
      $('form-login').hidden = mode !== 'login';
      $('form-register').hidden = mode !== 'register';
      $('gate-error').textContent = '';
    };
  }

  /*
   * Quem chegou pelo "Criar conta" da porta da rua cai na aba de criar conta.
   *
   * A pagina de entrada manda para `/jogar#criar`. Sem isto, os dois botoes de
   * la — "Jogar agora" e "Criar conta" — davam exatamente na mesma tela, e o
   * segundo era uma promessa que a porta seguinte nao cumpria.
   */
  if (location.hash === '#criar') {
    document.querySelector('[data-auth="register"]')?.click();
  }

  /*
   * Credencial nenhuma fica na barra de endereço.
   *
   * O formulário não declarava `method`, e formulário sem `method` envia por
   * GET para a própria página: bastava um Enter antes de este módulo carregar
   * para a URL virar `?email=...&password=...`. Dali em diante o endereço com a
   * senha fica no histórico, aparece no autocompletar da barra e viaja no
   * `Referer` de qualquer requisição para fora.
   *
   * O `action="#"` no HTML fecha a porta. Isto aqui limpa o que já entrou: se a
   * URL de agora tem esses campos, eles saem antes de qualquer outra coisa
   * acontecer, e o `replaceState` troca a entrada do histórico em vez de criar
   * outra — assim o endereço com a senha não fica no botão de voltar.
   */
  (() => {
    const url = new URL(location.href);
    const sujos = ['email', 'password', 'senha', 'confirm'].filter((chave) => url.searchParams.has(chave));
    if (!sujos.length) return;
    for (const chave of sujos) url.searchParams.delete(chave);
    history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    console.warn(
      'Credenciais foram removidas do endereço. Limpe o histórico do navegador: ' +
        'a URL antiga ainda está guardada lá.'
    );
  })();

  $('form-login').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    lembrarEntrada('senha');
    send({ t: 'login', email: data.get('email'), password: data.get('password') });
  });

  $('form-register').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    send({
      t: 'register',
      email: data.get('email'),
      password: data.get('password'),
      confirm: data.get('confirm'),
      origem: origemGuardada(),
    });
  });

  /* ==================================================================
   * SEGURANÇA DA CONTA: esqueci a senha, o código da entrada, e ligar
   * ou desligar a verificação em duas etapas.
   *
   * Tudo aqui é TELA. Quem recusa é o servidor — esconder um botão não
   * tranca nada, e mostrar um a mais não abre nada.
   * ================================================================== */

  // ---------- esqueci minha senha ----------

  const esqueciErro = (texto, bom = false) => {
    const caixa = $('esqueci-erro');
    caixa.textContent = texto;
    caixa.classList.toggle('bom', bom);
  };

  const abrirEsqueci = () => {
    // O e-mail que a pessoa já digitou no login entra sozinho: ela acabou de
    // escrevê-lo, e pedir de novo é fazer trabalho repetido no pior momento.
    const digitado = $('form-login')?.elements?.email?.value ?? '';
    $('esqueci-email').value = digitado;
    esqueciErro('');
    $('esqueci-overlay').hidden = false;
    $('esqueci-email').focus();
  };
  const fecharEsqueci = () => {
    $('esqueci-overlay').hidden = true;
    esqueciErro('');
  };

  $('esqueci-abrir').onclick = abrirEsqueci;
  $('esqueci-cancelar').onclick = fecharEsqueci;
  $('esqueci-enviar').onclick = () => {
    const email = $('esqueci-email').value.trim();
    if (!email) return esqueciErro('digite o e-mail da conta');
    esqueciErro('');
    send({ t: 'esqueciSenha', email });
  };
  $('esqueci-email').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('esqueci-enviar').click();
  });

  // ---------- o código da entrada ----------

  /*
   * O bilhete do desafio. Ele fica aqui e não viaja para lugar nenhum além do
   * `tfaConfirmar`: é ele que substitui a senha no segundo passo, e é por isso
   * que a senha não precisa ficar guardada em memória enquanto a pessoa digita.
   */
  let bilheteDoCodigo = null;

  const tfaErro = (texto, bom = false) => {
    const caixa = $('tfa-erro');
    caixa.textContent = texto;
    caixa.classList.toggle('bom', bom);
  };

  const fecharTfa = () => {
    $('tfa-overlay').hidden = true;
    $('tfa-codigo').value = '';
    bilheteDoCodigo = null;
    tfaErro('');
  };

  const abrirTfa = (message) => {
    bilheteDoCodigo = message.desafio;
    $('tfa-explica').textContent =
      message.tipo === 'app'
        ? 'Abra o aplicativo de autenticação e digite o código de seis dígitos que ele mostra.'
        : `Mandamos um código de seis dígitos para ${message.onde ?? 'o e-mail da conta'}. Ele vale dez minutos.`;
    // O botão de reenviar só faz sentido no e-mail: quem usa o aplicativo tem
    // o código na mão, e um "mandar de novo" ali só confundiria.
    $('tfa-de-novo').hidden = message.tipo !== 'email';
    $('tfa-codigo').value = '';
    tfaErro('');
    $('tfa-overlay').hidden = false;
    $('tfa-codigo').focus();
  };

  $('tfa-cancelar').onclick = fecharTfa;
  $('tfa-confirmar').onclick = () => {
    const codigo = $('tfa-codigo').value.trim();
    if (!codigo) return tfaErro('digite o código');
    tfaErro('');
    send({ t: 'tfaConfirmar', desafio: bilheteDoCodigo, codigo });
  };
  $('tfa-de-novo').onclick = () => {
    tfaErro('');
    send({ t: 'tfaDeNovo', desafio: bilheteDoCodigo });
  };
  $('tfa-codigo').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('tfa-confirmar').click();
  });

  // ---------- ligar e desligar a verificação ----------

  const segErro = (texto, bom = false) => {
    const caixa = $('seg-erro');
    caixa.textContent = texto;
    caixa.classList.toggle('bom', bom);
  };

  const mostrarPassoDaSeguranca = (qual) => {
    for (const id of ['seg-passo-escolher', 'seg-passo-codigo', 'seg-passo-reservas', 'seg-passo-desligar']) {
      $(id).hidden = id !== qual;
    }
  };

  const fecharSeguranca = () => {
    $('seg-overlay').hidden = true;
    $('seg-senha').value = '';
    $('seg-codigo').value = '';
    $('seg-codigo-desligar').value = '';
    $('seg-qr').innerHTML = '';
    segErro('');
  };

  /**
   * A linha da tela de personagens: o estado, e o botão que muda com ele.
   *
   * Conta que só entra pela Google não vê nada: sem senha, a verificação não
   * teria o que ser segunda DE — o convite para criar senha, logo acima, é o
   * passo que falta a ela.
   */
  function desenharLinhaDaSeguranca() {
    const linha = $('seg-aviso');
    if (!linha) return;
    if (!account || account.pelaGoogle) {
      linha.hidden = true;
      return;
    }
    linha.hidden = false;
    const ligada = !!account.doisFatores;
    const restam = account.reservasRestantes ?? 0;
    /*
     * ---- O texto é CURTO, e isso é layout ----
     *
     * A frase longa ("peça um código além da senha a cada entrada") enchia os
     * 476px da linha e empurrava o botão contra a borda direita: o par texto +
     * botão deixava de se ler como um par. Curto, os dois ficam centrados
     * juntos, com ar dos dois lados — e a linha continua com a mesma altura.
     */
    $('seg-estado').textContent = ligada
      ? `Verificação em duas etapas ligada (${account.doisFatores === 'app' ? 'aplicativo' : 'e-mail'})` +
        // O aviso que evita a ligação para o suporte: descobrir que os códigos
        // de reserva acabaram no dia em que o celular quebra é tarde demais.
        (restam <= 2 ? ` — restam ${restam} de reserva!` : '')
      : 'Proteja a conta com um código a cada entrada.';
    // No `span`, e não no botão: escrever no botão inteiro apagaria o ícone.
    $('seg-abrir-texto').textContent = ligada ? 'Desligar' : 'Ligar';
  }

  $('seg-abrir').onclick = () => {
    segErro('');
    if (account?.doisFatores) {
      mostrarPassoDaSeguranca('seg-passo-desligar');
      $('seg-overlay').hidden = false;
      $('seg-codigo-desligar').focus();
      return;
    }
    mostrarPassoDaSeguranca('seg-passo-escolher');
    $('seg-overlay').hidden = false;
    $('seg-senha').focus();
  };

  $('seg-cancelar').onclick = fecharSeguranca;
  $('seg-desligar-cancelar').onclick = fecharSeguranca;
  $('seg-voltar').onclick = () => {
    mostrarPassoDaSeguranca('seg-passo-escolher');
    segErro('');
  };

  $('seg-continuar').onclick = () => {
    const senha = $('seg-senha').value;
    if (!senha) return segErro('digite a senha da conta');
    const modo = document.querySelector('input[name="seg-modo"]:checked')?.value ?? 'app';
    segErro('');
    send({ t: 'tfaComecar', modo, password: senha });
  };

  $('seg-ligar').onclick = () => {
    const codigo = $('seg-codigo').value.trim();
    if (!codigo) return segErro('digite o código');
    segErro('');
    send({ t: 'tfaLigar', codigo });
  };

  $('seg-desligar-ok').onclick = () => {
    const codigo = $('seg-codigo-desligar').value.trim();
    if (!codigo) return segErro('digite o código para confirmar');
    segErro('');
    send({ t: 'tfaDesligar', codigo });
  };

  $('seg-pronto').onclick = fecharSeguranca;
  $('seg-copiar').onclick = async () => {
    const texto = [...$('seg-reservas').children].map((li) => li.textContent).join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      segErro('copiados — cole num lugar seguro', true);
    } catch {
      // Navegador sem permissão de área de transferência (ou página sem https):
      // os códigos continuam na tela, que é o que importa.
      segErro('não consegui copiar — anote os códigos da tela');
    }
  };

  for (const id of ['seg-codigo', 'seg-codigo-desligar', 'seg-senha']) {
    $(id).addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      if (id === 'seg-senha') $('seg-continuar').click();
      else if (id === 'seg-codigo') $('seg-ligar').click();
      else $('seg-desligar-ok').click();
    });
  }

  /**
   * Desenha o QR do aplicativo.
   *
   * O quadrado é feito AQUI, por código deste projeto (ver `qrcode`, em
   * packages/shared) — o mesmo do donate. O endereço de um QR de autenticação
   * carrega o SEGREDO da conta: mandá-lo para um site de terceiro virar
   * figurinha seria entregar a chave da conta a quem gera a imagem.
   */
  function desenharQrDoApp(texto) {
    const alvo = $('seg-qr');
    alvo.innerHTML = '';
    const canvas = document.createElement('canvas');
    const qr = qrcode(texto, 'M');
    const QUIETO = 4;
    const total = qr.lado + QUIETO * 2;
    const escala = Math.max(2, Math.floor(200 / total));
    canvas.width = canvas.height = total * escala;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    for (let y = 0; y < qr.lado; y++) {
      for (let x = 0; x < qr.lado; x++) {
        if (qr.modulos[y][x]) ctx.fillRect((x + QUIETO) * escala, (y + QUIETO) * escala, escala, escala);
      }
    }
    alvo.append(canvas);
  }

  const logout = () => {
    send({ t: 'logout', token: tokenDaAba() });
    esquecerToken();
    // Sem isto o `resume` da próxima conexão entrava direto no último
    // personagem e não dava para sair da conta de dentro do jogo.
    esquecerPersonagem();
    entrouNestaAba = false;
    account = null;
    document.getElementById('game').hidden = true;
    document.getElementById('gate').hidden = false;
    show('pane-auth');
  };
  $('do-logout').onclick = logout;

  /*
   * ---- Excluir personagem: nome, depois senha ----
   *
   * Duas portas, e a segunda só abre com a primeira fechada. O nome digitado
   * (e não um clique num card) é o que impede apagar o personagem errado; a
   * senha da conta é o que impede que quem sentou na máquina com a sessão
   * aberta apague qualquer um. Quem recusa de verdade é o servidor — isto aqui
   * é a tela, e tela não é tranca.
   *
   * Enquanto a caixa está aberta, o erro vai para DENTRO dela: o `gate-error-2`
   * fica atrás do véu e ninguém leria "senha incorreta" escrito lá.
   */
  let excluindo = null;
  /*
   * ---- A MESMA credencial da Google serve para duas coisas ----
   *
   * O GIS aceita UM callback por `initialize`, e ele já existe: é o do login
   * (ver `setupGoogle`). Um segundo `initialize` substituiria o primeiro, então
   * quem separa as duas intenções é esta marca — com ela ligada, a credencial
   * que voltar da Google confirma a exclusão em vez de entrar na conta.
   *
   * Ela vive junto de `excluindo` e morre junto: `fecharExcluir` apaga as duas,
   * e assim uma janela da Google que volte depois de a pessoa desistir cai no
   * caminho de login, que é o certo.
   */
  let esperandoGoogleParaExcluir = false;
  /* A caixa de criar senha está esperando a Google. Ver `fecharSenha`. */
  let esperandoGoogleParaSenha = false;
  /*
   * ---- A credencial ESPERA a confirmação ----
   *
   * Report do dono: "eu cliquei embaixo ali login na conta, e apenas excluiu —
   * tem que ter pelo menos uma confirmação antes, e qual char será apagado".
   *
   * Ele está certo, e o defeito era de simetria: pelo caminho da senha são dois
   * gestos (digitar a senha E clicar em "Apagar personagem"); pelo da Google era
   * UM — escolher a conta na janelinha apagava no mesmo movimento.
   *
   * Entrar na Google prova QUEM é você. Não diz que você quer apagar. Por isso
   * a credencial para aqui, e quem manda apagar é o clique seguinte.
   */
  let credencialDaGoogle = null;

  /*
   * ---- POR QUAL PORTA esta pessoa entrou ----
   *
   * A conta híbrida abre com senha e com Google, e a caixa de exclusão precisa
   * escolher UMA para perguntar. Quem sabe qual é esta aba: ela acabou de
   * entrar por uma delas.
   *
   * Fica no `localStorage`, ao lado do token, porque o `resume` de amanhã é
   * a mesma pessoa entrando pela mesma porta — e o servidor não guarda isso
   * (a tabela `sessions` tem token, conta e data, e mais nada).
   *
   * É só uma PREFERÊNCIA DE TELA: quem decide o que vale continua sendo o
   * servidor, que confere a senha ou o token da Google de verdade. Um valor
   * errado aqui mostra a pergunta errada, e nada além disso.
   */
  const ENTRADA_KEY = 'draevor:entrou-por';
  const lembrarEntrada = (porta) => {
    try {
      localStorage.setItem(ENTRADA_KEY, porta);
    } catch {
      /* navegador sem armazenamento: a tela escolhe pelo padrão */
    }
  };
  const entrouPor = () => {
    try {
      return localStorage.getItem(ENTRADA_KEY);
    } catch {
      return null;
    }
  };

  const excluirErro = (texto) => {
    const caixa = $('excluir-erro');
    if (caixa) caixa.textContent = texto ?? '';
  };

  const fecharExcluir = () => {
    excluindo = null;
    esperandoGoogleParaExcluir = false;
    $('excluir-overlay').hidden = true;
    $('excluir-passo-nome').hidden = false;
    $('excluir-passo-senha').hidden = true;
    $('excluir-passo-google').hidden = true;
    $('excluir-passo-confirmar').hidden = true;
    $('excluir-usar-google').hidden = true;
    $('excluir-usar-senha').hidden = true;
    // A credencial não sobrevive ao fechar, pelo mesmo motivo que a senha não
    // sobrevive: quem desistiu não deixa a prova em cima da mesa.
    credencialDaGoogle = null;
    $('excluir-nome').value = '';
    // A senha não sobrevive ao fechar: ela não tem por que continuar na memória
    // do campo depois que a pessoa desistiu.
    $('excluir-senha').value = '';
    excluirErro('');
  };

  const abrirExcluir = () => {
    if (!account?.characters?.length) return void fail('você ainda não tem personagem para apagar.');
    fecharExcluir();
    $('excluir-overlay').hidden = false;
    $('excluir-nome').focus();
  };

  $('do-delete-character').onclick = abrirExcluir;
  $('excluir-nome-cancelar').onclick = fecharExcluir;
  $('excluir-senha-cancelar').onclick = fecharExcluir;
  $('excluir-google-cancelar').onclick = fecharExcluir;
  $('excluir-final-cancelar').onclick = fecharExcluir;

  $('excluir-final-confirmar').onclick = () => {
    if (!excluindo || !credencialDaGoogle) return void fecharExcluir();
    excluirErro('');
    send({ t: 'deleteCharacter', name: excluindo, credential: credencialDaGoogle });
  };

  /*
   * Os dois atalhos da conta híbrida. Eles só trocam a pergunta — nenhum dos
   * dois apaga nada, e o personagem escolhido continua o mesmo.
   */
  $('excluir-usar-google').onclick = () => {
    if (!excluindo) return;
    lembrarEntrada('google');
    excluirErro('');
    abrirPassoDaGoogle(excluindo, true);
  };
  $('excluir-usar-senha').onclick = () => {
    if (!excluindo) return;
    lembrarEntrada('senha');
    esperandoGoogleParaExcluir = false;
    excluirErro('');
    abrirPassoDaSenha(excluindo, true);
  };

  $('excluir-nome-confirmar').onclick = () => {
    const digitado = $('excluir-nome').value.trim().replace(/\s+/g, ' ');
    if (!digitado) return void excluirErro('digite o nome do personagem.');

    /*
     * A conferência de dono acontece de novo no servidor. Aqui ela existe para
     * o erro chegar ANTES da senha: mandar alguém digitar a senha da conta para
     * depois ouvir "esse personagem não é seu" é pedir a senha à toa.
     */
    const alvo = account?.characters?.find((entry) => entry.name.toLowerCase() === digitado.toLowerCase());
    if (!alvo) return void excluirErro('você não tem nenhum personagem com esse nome.');

    excluindo = alvo.name;
    $('excluir-passo-nome').hidden = true;
    excluirErro('');

    /*
     * ---- A segunda porta é a chave que ESTA conta tem ----
     *
     * Conta com senha vê o campo de senha, como sempre. Conta que entra pela
     * Google vê o botão da Google — ela não tem senha neste banco, e pedir uma
     * seria pedir algo que não existe. Ver `pelaGoogle`, em accounts.mjs.
     */
    /*
     * ---- UMA chave por vez: a que a pessoa usou para entrar ----
     *
     * A conta híbrida (senha E Google) mostrava as duas de uma vez, e o dono
     * reagiu com "pq tem isso?". Era a pergunta errada: quem entrou pela Google
     * não está procurando um campo de senha, e quem entrou com senha não quer
     * uma janela da Google no meio de apagar um personagem.
     *
     * Qual foi, quem sabe é esta aba (ver `entrouPor`). A outra continua a um
     * clique de distância, porque a conta abre com as duas de verdade.
     */
    const soGoogle = !!account?.pelaGoogle;
    const hibrida = !soGoogle && !!account?.temGoogle;
    if (soGoogle || (hibrida && entrouPor() === 'google')) {
      abrirPassoDaGoogle(alvo.name, hibrida);
      return;
    }
    abrirPassoDaSenha(alvo.name, hibrida);
  };

  /** O passo do campo de senha. `hibrida` liga o atalho para a outra chave. */
  function abrirPassoDaSenha(nome, hibrida) {
    $('excluir-passo-google').hidden = true;
    $('excluir-alvo').textContent = nome;
    $('excluir-passo-senha').hidden = false;
    $('excluir-usar-google').hidden = !hibrida;
    $('excluir-senha').focus();
  }

  /** O passo do botão da Google. */
  function abrirPassoDaGoogle(nome, hibrida) {
    $('excluir-passo-senha').hidden = true;
    $('excluir-alvo-google').textContent = nome;
    $('excluir-passo-google').hidden = false;
    $('excluir-usar-senha').hidden = !hibrida;
    mostrarBotaoGoogleDeExcluir('excluir-google-slot');
  }

  /*
   * O botão da Google DENTRO da caixa de exclusão.
   *
   * `disableAutoSelect` é o que faz disto uma reconfirmação de verdade: sem
   * ele, o GIS pode devolver a credencial guardada da última entrada sem
   * mostrar nada, e o "confirme que é você" viraria um clique que não pergunta
   * nada. Com ele, a janela de escolher a conta aparece — e o servidor ainda
   * exige que o token seja recente (ver `tokenRecemFeito`).
   *
   * Desenhado a cada abertura, e não uma vez: o GIS pode ter carregado depois
   * da primeira, e um botão desenhado numa caixa escondida não sobrevive bem.
   */
  function mostrarBotaoGoogleDeExcluir(ondeDesenhar) {
    const vaga = $(ondeDesenhar);
    if (!vaga) return;
    vaga.replaceChildren();
    if (!window.google?.accounts?.id) {
      return void excluirErro('o login da Google ainda não carregou — feche e tente de novo.');
    }
    esperandoGoogleParaExcluir = true;
    window.google.accounts.id.disableAutoSelect();
    window.google.accounts.id.renderButton(vaga, { theme: 'filled_black', size: 'large', width: 260 });
  }

  $('excluir-senha-confirmar').onclick = () => {
    const senha = $('excluir-senha').value;
    if (!senha) return void excluirErro('digite a senha da sua conta.');
    if (!excluindo) return void fecharExcluir();
    excluirErro('');
    send({ t: 'deleteCharacter', name: excluindo, password: senha });
  };

  // ---------- criar senha na conta da Google ----------

  /*
   * A mesma credencial da Google serve para entrar, para apagar personagem e
   * agora para criar a senha. `esperandoGoogleParaSenha` é a intenção que o
   * callback do GIS lê para saber que é para cá — ver `setupGoogle`.
   */
  const senhaErro = (texto) => {
    const caixa = $('senha-erro');
    if (caixa) caixa.textContent = texto ?? '';
  };

  const fecharSenha = () => {
    esperandoGoogleParaSenha = false;
    $('senha-overlay').hidden = true;
    $('senha-passo-digitar').hidden = false;
    $('senha-passo-google').hidden = true;
    $('senha-nova').value = '';
    $('senha-repetir').value = '';
    senhaErro('');
  };

  $('senha-google-abrir').onclick = () => {
    fecharSenha();
    $('senha-email').value = account?.email ?? '';
    $('senha-overlay').hidden = false;
    $('senha-nova').focus();
  };
  $('senha-cancelar').onclick = fecharSenha;
  $('senha-google-cancelar').onclick = fecharSenha;

  $('senha-continuar').onclick = () => {
    const nova = $('senha-nova').value;
    // As mesmas regras que o servidor confere — aqui só para o erro chegar antes da Google.
    if (nova.length < 6) return void senhaErro('a senha precisa de 6 caracteres ou mais.');
    if (nova !== $('senha-repetir').value) return void senhaErro('as senhas não conferem.');
    senhaErro('');
    const vaga = $('senha-google-slot');
    vaga.replaceChildren();
    if (!window.google?.accounts?.id) {
      return void senhaErro('o login da Google ainda não carregou — feche e tente de novo.');
    }
    $('senha-passo-digitar').hidden = true;
    $('senha-passo-google').hidden = false;
    esperandoGoogleParaSenha = true;
    // Ver `mostrarBotaoGoogleDeExcluir`: sem isto o GIS confirmaria sem perguntar nada.
    window.google.accounts.id.disableAutoSelect();
    window.google.accounts.id.renderButton(vaga, { theme: 'filled_black', size: 'large', width: 260 });
  };
  $('senha-repetir').onkeydown = (evento) => {
    if (evento.key === 'Enter') $('senha-continuar').click();
  };

  // Enter confirma o passo em que a pessoa está — os dois campos são de uma
  // linha só, e em campo de uma linha o Enter é o botão.
  $('excluir-nome').onkeydown = (evento) => {
    if (evento.key === 'Enter') $('excluir-nome-confirmar').click();
  };
  $('excluir-senha').onkeydown = (evento) => {
    if (evento.key === 'Enter') $('excluir-senha-confirmar').click();
  };

  // ---------- personagens ----------

  /*
   * O aviso do nome e o botão andam juntos.
   *
   * Chamado a cada tecla e a cada troca de vocação, porque os dois dependem do
   * estado: o aviso, do que está escrito; o botão, da vocação escolhida.
   */
  function conferirNome() {
    const campo = $('form-create')?.elements?.name;
    const aviso = $('nome-aviso');
    const criar = $('form-create')?.querySelector('button[type="submit"]');
    if (!campo || !criar) return;

    const problema = problemaNoNome(campo.value);
    /*
     * Antes da primeira tecla, NADA.
     *
     * Nem o erro, nem a regra. Abrir a tela com "Escreva um nome" é repreender
     * quem ainda não fez nada, e abrir com a regra em cinza é dar aula antes de
     * alguém perguntar. A regra aparece no instante em que ela passa a ter uso:
     * quando há o que conferir.
     *
     * O lugar do aviso continua ocupado (o `min-height` do CSS), então ele
     * surgir não empurra o formulário para baixo do dedo de quem digita.
     */
    const escreveu = campo.value.length > 0;
    if (aviso) {
      aviso.textContent = !escreveu ? '' : problema ?? 'De 3 a 20 letras. Espaço vale no meio.';
      aviso.classList.toggle('ruim', !!(escreveu && problema));
      aviso.classList.toggle('ok', !!(escreveu && !problema));
    }
    campo.setAttribute('aria-invalid', String(!!(escreveu && problema)));

    // O botão diz o que vai criar: some a dúvida de "ficou selecionado o que eu
    // quis?" no instante do clique, que é quando ela importa.
    const nome = VOCATION_INFO[vocation]?.name ?? '';
    criar.textContent = nome ? `Criar ${nome}` : 'Criar';
    criar.disabled = !!problema;
  }

  $('new-character').onclick = () => {
    show('pane-create');
    renderSexes();
    renderVocations();
    const campo = $('form-create')?.elements?.name;
    if (campo) {
      campo.value = '';
      // O cursor já no campo: quem abriu esta tela veio escrever um nome.
      campo.focus();
    }
    conferirNome();
  };

  $('form-create')?.elements?.name?.addEventListener('input', conferirNome);
  $('cancel-create').onclick = () => show('pane-characters');

  $('form-create').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    send({ t: 'createCharacter', name: data.get('name'), vocation, sex });
  });

  function renderVocations() {
    const picker = $('vocation-picker');
    picker.innerHTML = '';
    for (const [id, info] of Object.entries(VOCATION_INFO)) {
      const button = el('button', null);
      button.type = 'button';
      // O CSS pinta o cenário de cada vocação por este atributo — ver
      // `.vocation-picker button[data-vocation=...]` em style.css.
      button.dataset.vocation = id;
      button.setAttribute('aria-selected', String(vocation === id));
      // O boneco acompanha o sexo escolhido: trocar o sexo troca o looktype.
      /*
       * A ordem: NOME, boneco, ícones, descrição.
       *
       * O nome vai no topo porque é ele que se procura — quem chega aqui já
       * sabe qual vocação quer, ou está lendo os cinco nomes para decidir. Com
       * o nome no meio era preciso pular o boneco para achá-lo.
       *
       * Os ícones ficam ENTRE o boneco e a frase: são a ponte entre o que se vê
       * e o que se lê. O `title` vira o balão do jogo sozinho (o tooltip
       * recolhe todo `title` da página), então não há nada a ligar aqui.
       */
      const pericias = el('div', 'vocation-skills');
      for (const skill of info.skills ?? []) {
        const icone = artOrUiIcon(`sk-${skill}`, skill);
        icone.title = NOME_DA_PERICIA[skill] ?? skill;
        pericias.append(icone);
      }
      /*
       * Os elementos vêm depois de um respiro. São outra família de coisa —
       * uma é o que a vocação treina, a outra é do que ela é feita —, e colados
       * pareceriam uma lista só.
       */
      if (info.elementos?.length) {
        pericias.append(el('i', 'vocation-sep'));
        for (const elemento of info.elementos) {
          const icone = artOrUiIcon(`el-${elemento}`, elemento);
          icone.title = NOME_DO_ELEMENTO[elemento] ?? elemento;
          pericias.append(icone);
        }
      }
      /*
       * O boneco e a tela do efeito, empilhados no mesmo lugar.
       *
       * A tela é maior que o boneco de propósito: efeito de 64px precisa de
       * espaço para transbordar, e um `groundshaker` cortado nas beiradas
       * pareceria defeito. Ela não recebe clique (`pointer-events: none` no
       * CSS), senão engoliria o clique do próprio botão.
       */
      const palco = el('div', 'vocation-palco');
      palco.append(outfitCanvas(info.looks[sex], null, 72));
      const tela = document.createElement('canvas');
      tela.className = 'vocation-efeito';
      tela.width = TELA_DO_EFEITO;
      tela.height = TELA_DO_EFEITO;
      palco.append(tela);

      button.append(el('b', null, info.name), palco, pericias, el('em', null, info.blurb));
      button.onclick = () => {
        vocation = id;
        renderVocations();
        // O botão diz o nome da vocação escolhida.
        renderSexes();
        conferirNome();
        /*
         * O efeito toca DEPOIS do redesenho, e no card novo.
         *
         * `renderVocations` refaz os cinco botões do zero, então a tela em que
         * eu tocaria aqui seria jogada fora no mesmo instante. Procurar o card
         * recém-criado é o que faz a animação acontecer onde se pode vê-la.
         */
        const cardNovo = picker.querySelector(`button[data-vocation="${id}"] .vocation-efeito`);
        if (cardNovo && info.efeito) tocarEfeito(cardNovo, info.efeito);
      };
      picker.append(button);
    }
  }

  /*
   * ---- Os dois sexos, mostrando o BONECO ----
   *
   * Eram dois botões escritos, "Masculino" e "Feminino". Agora cada um traz o
   * outfit daquele sexo NA VOCAÇÃO ESCOLHIDA — então a escolha deixa de ser
   * entre duas palavras e passa a ser entre as duas figuras com que se vai
   * jogar. É a mesma arte do card, sem nada novo para carregar.
   *
   * Por isso `renderVocations` chama este render também: trocar de vocação tem
   * de trocar os dois bonecos daqui, senão eles ficariam mostrando o knight
   * depois de a pessoa ter escolhido druida.
   */
  function renderSexes() {
    const picker = $('sex-picker');
    if (!picker) return;
    picker.innerHTML = '';
    for (const [id, label] of Object.entries(SEX_LABEL)) {
      const button = el('button', null);
      button.type = 'button';
      button.setAttribute('aria-selected', String(sex === id));
      button.title = label;
      /*
       * O SÍMBOLO, e não o boneco.
       *
       * O boneco já aparece — grande, com a roupa da vocação — no card ao lado,
       * e ele muda de sexo junto com esta escolha. Repeti-lo aqui em miniatura
       * era mostrar duas vezes a mesma coisa, e a menor das duas.
       *
       * O símbolo diz o que o botão faz sem depender do desenho do outfit, e
       * cada um traz a própria cor (azul e vermelho) — que é a única coisa
       * nesta tela que separa os dois de relance.
       */
      const icone = document.createElement('img');
      icone.src = `/client/assets/ui/sexo-${id === 'male' ? 'masculino' : 'feminino'}.webp`;
      icone.alt = label;
      icone.className = 'sexo-icone';
      button.append(icone, el('span', null, label));
      button.onclick = () => {
        sex = id;
        renderSexes();
        renderVocations();
      };
      picker.append(button);
    }
  }

  function renderCharacters() {
    const list = $('character-list');
    list.innerHTML = '';

    // Cinco personagens por conta: sem vaga, o botão de criar sai da frente.
    // Quem manda no número é o servidor (`characterLimit`); isto aqui é só o
    // palpite de quando a conta ainda não chegou.
    const limit = account?.characterLimit ?? MAXIMO_DE_PERSONAGENS;
    const usados = account?.characters.length ?? 0;
    const full = usados >= limit;
    const create = $('new-character');
    create.hidden = full;
    create.disabled = full;
    // Quantas vagas sobraram, para a conta não parecer travada em um.
    const vagas = $('character-slots');
    if (vagas) vagas.textContent = account ? `${usados} de ${limit} personagens` : '';
    // Só a conta que entra APENAS pela Google vê o convite para criar senha.
    const avisoDaSenha = $('senha-google-aviso');
    if (avisoDaSenha) avisoDaSenha.hidden = !account?.pelaGoogle;
    desenharLinhaDaSeguranca();

    if (!account?.characters.length) {
      list.append(el('p', 'gate-note', 'Nenhum personagem ainda. Crie o primeiro.'));
      return;
    }

    for (const character of account.characters) {
      /*
       * A moldura dos cards de boss task (`ui-frame--card`), a pedido: esta
       * lista é a primeira tela do jogo depois do login, e um retângulo liso
       * ali dá as boas-vindas com a cara de um formulário.
       */
      const card = cartaoDePersonagem(character);
      card.classList.add('character-card--vitrine');
      card.onclick = () => {
        lembrarPersonagem(character.name);
        // A partir daqui, uma queda de conexão volta sozinha para ele.
        entrouNestaAba = true;
        send({ t: 'play', name: character.name, visto: ultimoVisto(character.name) });
      };
      list.append(card);
    }
  }

  // ---------- Google ----------

  function setupGoogle(clientId) {
    if (googleReady) return;
    if (!clientId) {
      $('google-note').textContent =
        'Login com Google fica ativo assim que um googleClientId for definido no config.json.';
      return;
    }
    googleReady = true;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        /*
         * ---- Uma credencial, dois destinos ----
         *
         * O GIS aceita um callback só, e a mesma credencial serve para ENTRAR e
         * para CONFIRMAR uma exclusão. Quem separa é a intenção de quem pediu:
         * com a caixa de excluir esperando, ela vai para lá; fora disso, é
         * login, como sempre foi.
         *
         * A marca SOBREVIVE ao envio, e quem a apaga é `fecharExcluir` — no
         * sucesso e no cancelar. Apagá-la aqui quebrava a segunda tentativa: o
         * servidor recusa (token expirado, por exemplo), a caixa continua
         * aberta com o botão na tela, e o clique seguinte cairia no caminho de
         * LOGIN — trocando a conta da pessoa em vez de apagar o personagem.
         */
        callback: (response) => {
          // A caixa de criar senha: a senha já foi digitada, a Google é a prova.
          if (esperandoGoogleParaSenha && !$('senha-overlay').hidden) {
            senhaErro('');
            send({
              t: 'criarSenha',
              password: $('senha-nova').value,
              confirm: $('senha-repetir').value,
              credential: response.credential,
            });
            return;
          }
          if (esperandoGoogleParaExcluir && excluindo) {
            // Prova de identidade guardada; o APAGAR é o clique seguinte.
            // Ver `credencialDaGoogle`.
            credencialDaGoogle = response.credential;
            excluirErro('');
            $('excluir-passo-google').hidden = true;
            $('excluir-passo-senha').hidden = true;
            $('excluir-conta-final').textContent = account?.email ?? 'sua conta Google';
            $('excluir-alvo-final').textContent = excluindo;
            $('excluir-passo-confirmar').hidden = false;
            return;
          }
          lembrarEntrada('google');
          send({ t: 'google', credential: response.credential, origem: origemGuardada() });
        },
      });
      window.google?.accounts.id.renderButton($('google-slot'), { theme: 'filled_black', size: 'large', width: 290 });
    };
    script.onerror = () => ($('google-note').textContent = 'Não foi possível carregar o login da Google.');
    document.head.append(script);
  }

  return {
    /** Sai da conta e volta para a tela de login, de qualquer lugar do jogo. */
    logout,

    /**
     * Os personagens da conta, como o servidor os mandou.
     *
     * Serve à troca rápida de dentro do jogo (ver `confirmarSaida` em
     * main.mjs): a caixa de trocar mostra os mesmos cards da lista, e quem tem
     * os dados é este módulo. Devolve uma cópia rasa para ninguém de fora
     * mexer no que o `handle` guardou.
     */
    personagens: () => (account?.characters ?? []).slice(),

    /**
     * Pede um retrato novo da conta — é ele que traz o `fazendo` de cada um.
     *
     * `depois(conta)` é chamado quando a resposta chega. Ele existe porque este
     * pedido sai de dentro do jogo, e ali a chegada de uma conta NÃO pode
     * significar o que significa no portão (ver o `handle`).
     */
    atualizarConta(depois) {
      const token = tokenDaAba();
      if (!token) return;
      aoAtualizarConta = typeof depois === 'function' ? depois : null;
      pedidosDeConta++;
      send({ t: 'resume', token });
    },

    /*
     * Entra em OUTRO personagem sem passar pela lista.
     *
     * É o mesmo par de mensagens que a lista manda — `release` e depois `play`
     * —, na mesma ordem e pelo mesmo motivo: sem soltar o atual primeiro, o
     * servidor recebe o `play` com o socket ainda preso ao anterior.
     *
     * O `entrouNestaAba` também é o mesmo: a partir daqui, uma queda de
     * conexão volta sozinha para o personagem NOVO, e não para o de antes.
     */
    entrarEm(nome) {
      send({ t: 'release' });
      lembrarPersonagem(nome);
      entrouNestaAba = true;
      send({ t: 'play', name: nome, visto: ultimoVisto(nome) });
    },

    /** Volta para a lista de personagens sem sair da conta. */
    switchCharacter() {
      // Avisa o servidor para soltar o personagem atual antes de escolher outro.
      send({ t: 'release' });
      this.mostrarLista();
    },

    /**
     * Só a TELA: sai do jogo e mostra a lista de personagens.
     *
     * Existe separada do `switchCharacter` porque há um caminho em que o
     * servidor solta o personagem por conta própria e avisa depois — o treino
     * offline, que começa com "confirmar" e termina com o personagem fora do
     * jogo. Ali o `release` já aconteceu; mandar outro seria pedir de novo o que
     * já foi feito, e foi por isso que o `released` do servidor não trocava a
     * tela: ele limpava o estado e a tela do jogo continuava lá, vazia.
     */
    mostrarLista() {
      // Saiu do personagem de propósito: uma reconexão não deve trazê-lo de volta.
      entrouNestaAba = false;
      esquecerPersonagem();
      document.getElementById('game').hidden = true;
      document.getElementById('gate').hidden = false;
      show('pane-characters');
      renderCharacters();
    },

    /**
     * Esta aba deixou de mandar: outra entrou na mesma conta.
     *
     * Diferente de `switchCharacter`: aqui NÃO se manda `release`, porque não
     * fomos nós que soltamos o personagem — quem assumiu foi a outra aba, e
     * mandar release daqui derrubaria a caçada dela. O que se faz é sair da
     * tela do jogo e explicar.
     *
     * O último personagem continua guardado de propósito: reentrar é um clique,
     * e a caçada não parou enquanto isso.
     */
    sessionTaken({ character, assumiuCom }) {
      document.getElementById('game').hidden = true;
      document.getElementById('gate').hidden = false;
      show('pane-characters');
      renderCharacters();

      const alvo = document.getElementById('gate-error-2');
      if (alvo) {
        alvo.textContent =
          `Outra janela entrou nesta conta${assumiuCom ? ` com ${assumiuCom}` : ''} e assumiu o comando. ` +
          `${character ? `${character} continua` : 'Seu personagem continua'} no mundo, caçando — ` +
          'entre de novo para retomar de onde parou.';
        alvo.classList.add('aviso');
      }
    },

    /** Chamado assim que a conexão abre. */
    start(catalog) {
      if (catalog?.googleClientId != null) setupGoogle(catalog.googleClientId);
      /*
       * ---- A tela desenha o que ESTE servidor tem ----
       *
       * Sem e-mail configurado, o "esqueci minha senha" e a opção de receber o
       * código por e-mail somem em vez de falharem depois do clique. Quem for
       * pelo aplicativo continua igual — ele não depende de e-mail nenhum.
       *
       * `!== false` e não `=== true`: um servidor antigo, que ainda não manda
       * este campo, continua mostrando tudo como mostrava antes.
       */
      if (catalog?.emailLigado === false) {
        $('esqueci-abrir').hidden = true;
        const opcaoEmail = document.querySelector('input[name="seg-modo"][value="email"]');
        if (opcaoEmail) {
          opcaoEmail.closest('.seg-modo').hidden = true;
          // O rádio escondido continuaria marcado se fosse o escolhido; o do
          // aplicativo volta a ser o único caminho.
          document.querySelector('input[name="seg-modo"][value="app"]').checked = true;
        }
      }
      const token = tokenDaAba();
      if (token) {
        // A aba nova adota a última conta usada — e a partir daqui ela é DESTA aba.
        tokenDestaAba = token;
        sessionStorage.setItem(TOKEN_KEY, token);
        send({ t: 'resume', token });
      }
    },

    handle(message) {
      if (message.t === 'account') {
        account = message.account;
        /*
         * Entrou: a caixa do código já não tem o que fazer na tela. Ela fica
         * aberta atrás do véu se ninguém a fechar, e o bilhete gasto dentro
         * dela reapareceria na próxima vez que a pessoa saísse da conta.
         */
        if (!$('tfa-overlay').hidden) fecharTfa();
        if (!$('esqueci-overlay').hidden) fecharEsqueci();
        /*
         * O mesmo gancho de depuração que `window.__state` já é, e pelo mesmo
         * motivo: as sondas precisam ler o que a tela está vendo, e a conta
         * mora numa variável fechada aqui dentro.
         *
         * Não há segredo nisto: `accountView` nunca manda a senha nem o
         * `google_id` — só o booleano `pelaGoogle`, que diz qual confirmação
         * pedir. Ver `sonda-excluir-google.mjs`.
         */
        window.__conta = account;
        if (message.token) guardarToken(message.token);

        /*
         * Retrato pedido de dentro do jogo: atualiza e avisa, e para por aqui.
         *
         * Sem esta saída, o resto do bloco faria duas coisas que ali são
         * desastre: trocaria a tela para a lista de personagens por cima do
         * jogo, e mandaria um `play` do personagem atual — recarregando a
         * partida de quem só queria ver quem está caçando.
         */
        /*
         * ---- CONTANDO os pedidos, e não só guardando o último ----
         *
         * Report do dono: "às vezes vou em sair pra configurar o outro char e
         * fica aparecendo o progresso enquanto esteve fora". Dois pedidos saíam
         * seguidos (o relógio da caixa de trocar e a abertura dela), o segundo
         * sobrescrevia o gancho do primeiro, e a primeira resposta o consumia.
         * A SEGUNDA resposta chegava sem gancho, caía no caminho do portão e
         * mandava um `play` do próprio char — que reabria o jogo e mostrava o
         * resumo da ausência de um minuto de troca de tela.
         */
        if (pedidosDeConta > 0) {
          pedidosDeConta--;
          const avisar = aoAtualizarConta;
          if (pedidosDeConta === 0) aoAtualizarConta = null;
          avisar?.(account);
          return true;
        }

        // O catálogo pode não vir: ele já chegou no `hello` desta conexão (ver `start`).
        if (message.catalog) setupGoogle(message.catalog.googleClientId);
        show('pane-characters');
        renderCharacters();

        /*
         * Volta sozinho para o personagem SÓ se esta aba já estava nele.
         *
         * Ver `entrouNestaAba`: numa entrada nova a lista fica na tela e quem
         * escolhe é a pessoa; numa reconexão o jogo volta como estava.
         */
        const last = personagemDaAba();
        if (entrouNestaAba && last && account.characters.some((entry) => entry.name === last)) {
          send({ t: 'play', name: last, visto: ultimoVisto(last) });
        }
        return true;
      }

      if (message.t === 'authError') {
        // Token velho: volta para a tela de login em vez de travar.
        if (message.message === 'sessão expirada') esquecerToken();
        // Com a caixa de excluir aberta, o recado é dela: o `gate-error-2` está
        // atrás do véu e ninguém o leria.
        if (!$('excluir-overlay').hidden) {
          $('excluir-erro').textContent = message.message;
          return true;
        }
        // As caixas de segurança: com uma delas aberta, o recado é dela — o
        // `gate-error` está atrás do véu e ninguém o leria.
        if (!$('tfa-overlay').hidden) {
          tfaErro(message.message);
          return true;
        }
        if (!$('esqueci-overlay').hidden) {
          esqueciErro(message.message);
          return true;
        }
        if (!$('seg-overlay').hidden) {
          segErro(message.message);
          return true;
        }
        // O mesmo para a caixa de criar senha. Recusada, ela volta ao passo da
        // senha: a credencial usada não vale uma segunda vez.
        if (!$('senha-overlay').hidden) {
          esperandoGoogleParaSenha = false;
          $('senha-passo-google').hidden = true;
          $('senha-passo-digitar').hidden = false;
          senhaErro(message.message);
          return true;
        }
        fail(message.message);
        return true;
      }

      /*
       * ---- A conta pede o código ----
       *
       * A senha estava certa, mas ela não basta. Nenhuma sessão foi criada e
       * nenhuma conta veio junto: o que chega é o bilhete.
       */
      if (message.t === 'tfa') {
        abrirTfa(message);
        return true;
      }

      if (message.t === 'tfaErro') {
        /*
         * `recomecar` é o bilhete morto — vencido, ou rasgado no sexto erro. A
         * caixa fecha e a pessoa volta ao login: insistir num bilhete que já
         * não existe daria "código incorreto" para sempre, e ela culparia o
         * código.
         */
        if (message.recomecar) {
          fecharTfa();
          fail(message.message);
          return true;
        }
        // Com a caixa de ligar/desligar aberta, o recado é dela.
        if (!$('seg-overlay').hidden) segErro(message.message);
        else tfaErro(message.message);
        return true;
      }

      if (message.t === 'tfaMandado') {
        tfaErro('mandamos outro código — olhe o e-mail e o spam', true);
        return true;
      }

      /* O passo 1 de ligar: o QR (aplicativo) ou o aviso (e-mail). */
      if (message.t === 'tfaPreparado') {
        mostrarPassoDaSeguranca('seg-passo-codigo');
        const peloApp = message.tipo === 'app';
        $('seg-qr-bloco').hidden = !peloApp;
        $('seg-email-aviso').hidden = peloApp;
        if (peloApp) {
          desenharQrDoApp(message.endereco);
          $('seg-segredo').textContent = message.segredo ?? '';
        } else {
          $('seg-email-aviso').textContent =
            `Mandamos um código para ${message.onde ?? 'o e-mail da conta'}. Digite-o abaixo para ligar a verificação.`;
        }
        segErro('');
        $('seg-codigo').focus();
        return true;
      }

      /* Ligou (ou pediu reservas novas): os códigos aparecem UMA vez. */
      if (message.t === 'tfaLigado') {
        mostrarPassoDaSeguranca('seg-passo-reservas');
        const lista = $('seg-reservas');
        lista.innerHTML = '';
        for (const codigo of message.reservas ?? []) lista.append(el('li', '', codigo));
        segErro('');
        return true;
      }

      if (message.t === 'tfaDesligado') {
        fecharSeguranca();
        const aviso = $('gate-error-2');
        if (aviso) {
          aviso.textContent = 'Verificação em duas etapas desligada. Sua senha voltou a ser a única chave.';
          aviso.classList.add('aviso');
        }
        return true;
      }

      /*
       * O pedido de senha nova. A frase vem do servidor de propósito: ela é a
       * MESMA para e-mail que existe e para e-mail que não existe, e a tela não
       * pode inventar uma versão diferente para cada caso.
       */
      if (message.t === 'senhaPedida') {
        esqueciErro(message.message, true);
        return true;
      }

      if (message.t === 'senhaCriada') {
        fecharSenha();
        const aviso = $('gate-error-2');
        if (aviso) {
          aviso.textContent = `Senha criada! Agora você também entra com ${message.email ?? 'o seu e-mail'} e essa senha.`;
          aviso.classList.add('aviso');
        }
        return true;
      }

      /*
       * O personagem foi apagado. O `account` que vem logo atrás redesenha a
       * lista sem ele; aqui só se fecha a caixa e se apaga o rastro.
       */
      if (message.t === 'characterDeleted') {
        const apagado = String(message.name ?? '');
        // Sem isto, o "voltar sozinho para o último personagem" tentaria entrar
        // num personagem que não existe mais na próxima reconexão.
        if (personagemDaAba()?.toLowerCase() === apagado.toLowerCase()) esquecerPersonagem();
        fecharExcluir();
        const aviso = $('gate-error-2');
        if (aviso) {
          aviso.textContent = `${apagado} foi apagado. Os outros personagens da conta continuam como estavam.`;
          aviso.classList.add('aviso');
        }
        return true;
      }

      if (message.t === 'loggedOut') {
        show('pane-auth');
        return true;
      }

      /*
       * Outra janela entrou nesta conta e assumiu.
       *
       * Tratado aqui junto do resto da porta de entrada, e não no `handle` do
       * jogo, porque o efeito é sair da tela do jogo — é assunto da porta.
       */
      if (message.t === 'sessionTaken') {
        this.sessionTaken(message);
        return true;
      }
      return false;
    },

    enterGame() {
      $('gate').hidden = true;
      $('game').hidden = false;
      onPlay?.();
    },

    backToSelect() {
      $('gate').hidden = false;
      $('game').hidden = true;
      show('pane-characters');
      renderCharacters();
    },

    get account() {
      return account;
    },
  };
}
