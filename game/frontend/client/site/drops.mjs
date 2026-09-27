/*
 * ---- A faixa de "Últimos drops" da porta da rua ----
 *
 * O pedido do dono:
 *
 *   "coloca um Ultimos Drops, que mostraria os ultimos drops do lendario ate o
 *    mitico, e quem dropou e o horario, tanto de boss como de hunt, e tambem
 *    mostraria as estrelas dos afixos e ao passar o mouse mostraria os stats
 *    tudo certinho e do que foi dropado (...) seria uma barra horizontal com os
 *    ultimos drop com a sprite de cada item, tudo bonitinho no tema da pagina."
 *
 * ---- Por que ela mora num módulo à parte ----
 *
 * Ela precisa do atlas de sprites do jogo, que é a coisa mais pesada que esta
 * página pode carregar — e o `site.mjs` (números, ranking) não precisa dele
 * para nada. Separados, a faixa carrega DEPOIS e sozinha: se o atlas demorar ou
 * falhar, o ranking e o botão de jogar já estão de pé, e a faixa some em vez de
 * levar a página junto.
 *
 * É a mesma decisão que a página de online já tinha tomado, e pelo mesmo
 * motivo.
 *
 * ---- Quem decide o que aparece ----
 *
 * O servidor (`ultimosdrops.mjs`), e ele manda as linhas do balão JÁ ESCRITAS.
 * Aqui não há régua de afixo nenhuma: a porta da rua não conhece o catálogo de
 * afixos do jogo, e ensinar a ela seria manter uma terceira cópia de uma conta
 * que já existe no servidor e no cliente.
 *
 * ---- Duas faixas, um módulo ----
 *
 * A de cima mostra o que CAIU; a de baixo, o que saiu das bags abertas. São o
 * mesmo card e o mesmo balão, e por isso o mesmo arquivo: separá-las daria dois
 * atlas carregados, dois `fetch` para a mesma rota e duas cópias do balão que
 * inevitavelmente iriam divergindo.
 */
import { loadSpriteData, itemCanvas } from '/client/src/sprites.mjs';
import { t } from '/client/site/idiomas.mjs';

const $ = (id) => document.getElementById(id);

const el = (tag, classe, texto) => {
  const node = document.createElement(tag);
  if (classe) node.className = classe;
  if (texto != null) node.textContent = texto;
  return node;
};

/* A cor do nome, pela raridade — a mesma escada do jogo. */
const CLASSE_DA_RARIDADE = {
  comum: 'r-comum',
  incomum: 'r-incomum',
  raro: 'r-raro',
  épico: 'r-epico',
  lendário: 'r-lendario',
  mítico: 'r-mitico',
};

/*
 * Quanto tempo faz, em português curto.
 *
 * Relativo e não relógio: "há 4 min" responde a pergunta que se faz olhando uma
 * faixa de últimos drops ("isso é de agora?"), e um horário obrigaria quem lê a
 * fazer a subtração de cabeça. O horário exato continua no balão, para quem
 * quiser o número.
 */
function quandoFoi(em) {
  const segundos = Math.max(0, Math.round((Date.now() - em) / 1000));
  if (segundos < 60) return t('drops.agora', 'agora');
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `${horas}h`;
  return `${Math.round(horas / 24)}d`;
}

const horaCheia = (em) =>
  new Date(em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** As estrelas, cada uma na cor do afixo que ela representa. */
function selo(drop) {
  if (!drop.estrelas) return null;
  const caixa = el('i', 'drop-estrelas');
  const cores = drop.afixos ?? [];
  for (let i = 0; i < drop.estrelas; i++) {
    caixa.append(el('b', `estrela q${cores[i]?.q ?? drop.forca ?? 1}`, '★'));
  }
  return caixa;
}

/*
 * O balão. Ele é um elemento só, movido pela tela — um por card criaria trinta
 * nós escondidos e o mesmo problema de sobreposição trinta vezes.
 */
let balao = null;

/*
 * ---- O balão, com a cara do balão do jogo ----
 *
 * "o modal de quando passa o mouse no item no site tem que ser bonito e bem
 * detalhado igual o do jogo, e tem que mostrar qual bixo que dropou ou qual
 * boss."
 *
 * A mesma anatomia do `fichaDeItem` de dentro do jogo, e de propósito: cabeça
 * (desenho + nome na cor da raridade + o que é), números da peça, atributos
 * extras com a estrela de cada afixo, quem pode usar, e o rodapé de onde veio.
 * Quem já jogou reconhece o balão antes de ler.
 *
 * O que ele NÃO faz é importar o balão do jogo: aquele precisa do catálogo de
 * itens inteiro, do personagem e das réguas de afixo carregados. Esta página
 * recebe a ficha pronta do servidor (ver `ultimosdrops.mjs`) e só desenha.
 */
/*
 * O catalogo guarda a vocacao como PALAVRA ('knight'), e nao como o numero do
 * servidor. O mapa cobre os dois: se vier numero, traduz; se vier palavra, so
 * poe a maiuscula — o balao do jogo escreve "Knight", e nao "knight".
 */
const NOME_DA_VOCACAO = { 0: 'None', 1: 'Sorcerer', 2: 'Druid', 3: 'Paladin', 4: 'Knight', 5: 'Monk' };
const vocacao = (v) =>
  NOME_DA_VOCACAO[v] ?? String(v).charAt(0).toUpperCase() + String(v).slice(1);
const NOME_DO_SLOT = {
  weapon: 'Mão direita',
  shield: 'Mão esquerda',
  armor: 'Armadura',
  helmet: 'Elmo',
  legs: 'Pernas',
  boots: 'Botas',
  ring: 'Anel',
  amulet: 'Amuleto',
  backpack: 'Mochila',
  ammo: 'Munição',
};
const NOME_DA_PERICIA = {
  sword: 'Espada',
  axe: 'Machado',
  club: 'Clava',
  distance: 'Distância',
  fist: 'Briga',
  shielding: 'Escudo',
  magic: 'Magia',
};

/** "1 em 10.000" — o número que faz a palavra "raro" significar alguma coisa. */
function quaoRaro(chance) {
  if (!chance || chance >= 1) return null;
  const um = Math.round(1 / chance);
  return `${(chance * 100).toFixed(chance < 0.01 ? 3 : 1).replace('.', ',')}%  ·  1 em ${um.toLocaleString('pt-BR')}`;
}

function montarBalao(drop) {
  const node = el('div', 'drop-balao');

  // ---- cabeça: desenho, nome e o que é
  const cabeca = el('div', 'db-head');
  const arte = el('div', 'db-art');
  try {
    arte.append(itemCanvas(drop.id, 44, drop.count > 1 ? drop.count : 0));
  } catch {
    /* sem sprite o balão continua, só sem a figura */
  }
  cabeca.append(arte);

  const ident = el('div', 'db-id');
  const nome = el('b', CLASSE_DA_RARIDADE[drop.raridade] ?? 'r-comum', drop.nome);
  if (drop.count > 1) nome.append(el('span', 'db-qtd', ` ×${drop.count}`));
  ident.append(nome);

  const oQueE = [drop.raridade];
  if (drop.tier) oQueE.push(`Tier ${drop.tier}`);
  if (drop.slot) oQueE.push(NOME_DO_SLOT[drop.slot] ?? drop.slot);
  else if (drop.tipo) oQueE.push(drop.tipo);
  ident.append(el('em', null, oQueE.join(' · ')));

  if (drop.estrelas) {
    const selo = el('i', 'db-estrelas');
    for (let i = 0; i < drop.estrelas; i++) {
      selo.append(el('b', `estrela q${drop.afixos?.[i]?.q ?? drop.forca ?? 1}`, '★'));
    }
    ident.append(selo);
  }
  cabeca.append(ident);
  node.append(cabeca);

  // ---- os números da peça
  const numeros = el('div', 'db-stats');
  const linha = (classe, texto) => numeros.append(el('div', classe, texto));
  if (drop.atk) linha('atk', `Ataque ${drop.atk}`);
  if (drop.elemento?.value) {
    linha(`el-${drop.elemento.type}`, `+${drop.elemento.value} de dano ${drop.elemento.type}`);
  }
  if (drop.def) linha('def', `Defesa ${drop.def}${drop.defExtra ? ` +${drop.defExtra}` : ''}`);
  if (drop.armor) linha('def', `Armadura ${drop.armor}`);
  if (drop.container) linha('plain', `${drop.container} espaços`);
  if (numeros.childElementCount) node.append(numeros);

  // ---- os atributos extras, cada um com a estrela dele
  if (drop.afixos?.length) {
    const extras = el('div', 'db-afixos');
    extras.append(el('div', 'db-afixos-titulo', t('drops.extras', 'Atributos extras')));
    for (const posto of drop.afixos) {
      const item = el('div', 'db-afixo');
      item.append(el('span', null, posto.texto));
      const marca = el('i', `db-afixo-tier q${posto.q}`);
      marca.append(el('b', 'estrela', '★'), el('span', null, ` T${posto.tier} · ${posto.pct}%`));
      item.append(marca);
      extras.append(item);
    }
    node.append(extras);
  }

  // ---- quem pode usar, e quanto pesa
  const regras = el('div', 'db-rules');
  const regra = (rotulo, valor) => {
    if (!valor) return;
    const l = el('div');
    l.append(el('span', null, rotulo), el('b', null, valor));
    regras.append(l);
  };
  regra(t('drops.level', 'Level mínimo'), drop.minLevel ? String(drop.minLevel) : null);
  regra(t('drops.pericia', 'Perícia'), NOME_DA_PERICIA[drop.skill] ?? null);
  regra(
    t('drops.vocacoes', 'Vocações'),
    drop.vocacoes?.length ? drop.vocacoes.map(vocacao).join(', ') : null
  );
  regra(t('drops.peso', 'Peso'), drop.peso ? `${String(drop.peso).replace('.', ',')} oz` : null);
  regra(t('drops.chance', 'Chance de cair'), quaoRaro(drop.chance));
  if (regras.childElementCount) node.append(regras);

  /*
   * ---- O rodapé: de quem, de onde e quando ----
   *
   * O BICHO em primeiro lugar e em destaque: é a pergunta que se faz olhando um
   * drop bom ("de onde sai isso?"), e é a única aqui que a pessoa pode usar.
   */
  const pe = el('div', 'db-pe');
  if (drop.bicho) {
    const de = el('div', 'db-de');
    de.append(el('span', null, drop.boss ? t('drops.boss', 'Boss') : t('drops.bicho', 'Largado por')));
    de.append(el('b', drop.boss ? 'db-boss' : null, drop.bicho));
    pe.append(de);
  }
  /*
   * A linha da BAG ocupa o lugar da linha do bicho, e pelo mesmo motivo: é a
   * pergunta que se faz olhando a peça ("de onde sai isso?"). Aqui a resposta
   * não é um monstro, é um saco — e o "1 entre 21" ao lado é o que diz o
   * tamanho da sorte.
   */
  if (drop.bagNome) {
    const de = el('div', 'db-de');
    de.append(el('span', null, t('drops.daBag', 'Saiu de')));
    de.append(el('b', 'db-bag', drop.bagNome));
    pe.append(de);
    if (drop.entre > 1) {
      const sorteio = el('div');
      sorteio.append(el('span', null, t('drops.entre', 'Sorteio')), el('b', null, `1 / ${drop.entre}`));
      pe.append(sorteio);
    }
  }
  const quem = el('div');
  quem.append(
    el('span', null, drop.bagNome ? t('drops.abriu', 'Aberta por') : t('drops.quem', 'Achado por')),
    el('b', null, drop.quem)
  );
  pe.append(quem);
  /*
   * A caverna, quando ela diz algo que o bicho ja nao disse. Numa sala de boss
   * as duas sao a mesma palavra ("Boss: The Primal Menace / Em: The Primal
   * Menace"), e repetir a linha e ruido.
   */
  if (drop.onde && drop.onde !== drop.bicho) {
    const onde = el('div');
    onde.append(el('span', null, t('drops.onde', 'Em')), el('b', null, drop.onde));
    pe.append(onde);
  }
  const quando = el('div');
  quando.append(el('span', null, t('drops.quando', 'Quando')), el('b', null, horaCheia(drop.em)));
  pe.append(quando);
  node.append(pe);

  return node;
}

function mostrarBalao(card, drop) {
  esconderBalao();
  balao = montarBalao(drop);
  document.body.append(balao);
  const caixa = card.getBoundingClientRect();
  const largura = balao.offsetWidth;
  /*
   * Preso à janela, e não ao card: o primeiro e o último da faixa ficam nas
   * bordas, e um balão centrado neles sairia meio para fora da tela.
   */
  const esquerda = Math.max(8, Math.min(window.innerWidth - largura - 8, caixa.left + caixa.width / 2 - largura / 2));
  const acimaCabe = caixa.top > balao.offsetHeight + 14;
  balao.style.left = `${esquerda}px`;
  balao.style.top = acimaCabe
    ? `${caixa.top - balao.offsetHeight - 10}px`
    : `${caixa.bottom + 10}px`;
}

function esconderBalao() {
  balao?.remove();
  balao = null;
}

/*
 * Um card. O MESMO para as duas faixas — o que muda é o selo do canto (a
 * caçamba do boss ou a figura da bag) e a linha de baixo.
 */
function cardDoDrop(drop) {
  const daBag = !!drop.bagNome;
  const card = el('article', `drop-card${drop.boss ? ' de-boss' : ''}${daBag ? ' de-bag' : ''}`);

  const figura = el('div', 'drop-figura');
  try {
    const desenho = itemCanvas(drop.id, 40, drop.count > 1 ? drop.count : 0);
    figura.append(desenho);
  } catch {
    // Item sem sprite na folha: o card sai com o nome e nada mais, em vez de
    // a faixa inteira parar num item que o atlas não conhece.
  }
  const estrelas = selo(drop);
  if (estrelas) figura.append(estrelas);
  if (drop.boss) figura.append(el('i', 'drop-boss', '☠'));
  if (daBag && drop.bag != null) {
    // A bag de onde a peça saiu, desenhada pequena no canto. É o que permite
    // reconhecer a fileira de relance, sem ler o nome de cada card.
    const marca = el('i', 'drop-bag');
    try {
      marca.append(itemCanvas(drop.bag, 16));
      figura.append(marca);
    } catch {
      /* sem sprite da bag o card continua, só sem o selo */
    }
  }
  card.append(figura);

  card.append(el('b', `drop-nome ${CLASSE_DA_RARIDADE[drop.raridade] ?? 'r-comum'}`, drop.nome));
  if (daBag) card.append(el('span', 'drop-de-bag', drop.bagNome));
  card.append(el('span', 'drop-quem', drop.quem));
  /*
   * ---- E de QUE BICHO caiu, embaixo do nome de quem pegou ----
   *
   * "nos últimos drops do site coloque pra aparecer o nome do bixo que dropou
   *  também, embaixo do nome do jogador."
   *
   * Estava só no balão, que é onde se olha DEPOIS de a peça chamar a atenção.
   * Na fileira ela responde a pergunta que faz alguém parar de rolar a página:
   * "de onde sai isso?".
   *
   * Nas bags abertas não há bicho — o card já diz de que bag saiu, na linha de
   * cima —, e por isso a linha só aparece quando há um.
   */
  if (drop.bicho) card.append(el('span', 'drop-bicho', drop.bicho));
  card.append(el('span', 'drop-quando', quandoFoi(drop.em)));

  card.onmouseenter = () => mostrarBalao(card, drop);
  card.onmouseleave = esconderBalao;
  // No telefone não há "passar o mouse": o toque abre e o toque fora fecha.
  card.onclick = () => (balao ? esconderBalao() : mostrarBalao(card, drop));

  return card;
}

function pintar(onde, linhas, vazio) {
  const faixa = $(onde);
  if (!faixa) return;
  faixa.innerHTML = '';

  if (!linhas.length) {
    faixa.append(el('p', 'vazio', vazio));
    return;
  }

  for (const linha of linhas) faixa.append(cardDoDrop(linha));
}

async function atualizar() {
  try {
    const resposta = await fetch('/api/drops', { cache: 'no-store' });
    if (!resposta.ok) return;
    const dados = await resposta.json();
    pintar(
      'drops-faixa',
      dados.drops ?? [],
      t('drops.vazio', 'nada caiu ainda — a barra enche sozinha assim que cair')
    );
    pintar(
      'bags-faixa',
      dados.bags ?? [],
      t('bags.vazio', 'nenhuma bag aberta ainda — a barra enche sozinha na primeira')
    );
  } catch {
    // Rede ruim: a faixa fica como estava.
  }
}

/*
 * O atlas primeiro, e só depois a faixa: um card sem figura é meio card, e a
 * espera aqui não segura nada — o resto da página já está de pé.
 */
loadSpriteData()
  .then(atualizar)
  .catch(() => {
    // Sem atlas não há faixa. Elas somem inteiras em vez de virar uma fileira
    // de retângulos vazios com nome de item.
    document.getElementById('drops')?.remove();
    document.getElementById('bags')?.remove();
  });

window.addEventListener('draevor:idioma', atualizar);
window.addEventListener('scroll', esconderBalao, { passive: true });
setInterval(atualizar, 30_000);
