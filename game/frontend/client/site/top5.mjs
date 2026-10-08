/*
 * ---- O top 5 da capa ----
 *
 * A coluna da direita da capa, no lugar do antigo "O servidor agora": os cinco
 * primeiros do servidor com o boneco como ele anda no mapa (roupa, addons e
 * montaria), a vocação com o ícone da perícia dela (o mesmo da party no jogo)
 * e o valor da categoria.
 *
 * Embaixo, os ícones das categorias (level, magic e as skills) trocam o top 5
 * mostrado. São as mesmas categorias do ranking completo, mais abaixo.
 *
 * Separado do `site.mjs` pelo mesmo motivo do `drops.mjs`: o boneco precisa do
 * atlas de outfits, que é pesado. Sem o atlas o cartão sai igual, só sem o
 * desenho.
 */
import { loadSpriteData, outfitCanvas, emprestarDoCatalogo } from '/client/src/sprites.mjs';
/*
 * A GRADE DO EQUIPAMENTO saiu daqui e virou um componente.
 *
 * Ela era deste arquivo — a cruz do Tibia, a borda por raridade, o selo de tier
 * e as estrelas. O card do membro da guilda, no jogo, passou a precisar da MESMA
 * grade, e copiá-la para lá seria manter dois desenhos que precisam concordar
 * para sempre. Agora os dois chamam `gradeDeEquipamento`, e o CSS dela viaja
 * junto (o `site.css` não é carregado pelo jogo).
 *
 * O que ficou aqui é o que é DAQUI: como esta página lê a ficha pública.
 */
import { gradeDeEquipamento } from '/client/src/paperdoll.mjs';
// O balão da PEÇA (o mesmo do jogo e dos drops da capa): ao passar o mouse numa peça do inventário do balão.
import { fichaDeItem, juntarDados } from '/client/src/tooltip.mjs';
import { linhaDaGuilda } from '/client/site/brasao-no-site.mjs';

const $ = (id) => document.getElementById(id);
const numero = (valor) => Number(valor ?? 0).toLocaleString('pt-BR');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// O ponto antes do nome: verde conectado, amarelo caçando de aba fechada, apagado offline.
const pontoDe = (e) =>
  e.online
    ? '<i class="ponto" title="online agora"></i>'
    : e.cacandoOffline
      ? '<i class="ponto ausente" title="caçando offline"></i>'
      : '<i class="ponto off" title="offline"></i>';

const VOCACOES = { knight: 'Knight', paladin: 'Paladin', druid: 'Druid', sorcerer: 'Sorcerer', monk: 'Monk', none: 'Sem vocação' };
// O ícone da vocação é o da perícia dela, como no card da party (panels.mjs).
const ICONE_DA_VOCACAO = {
  knight: 'sk-sword', paladin: 'sk-distance', druid: 'sk-magic', sorcerer: 'sk-magic-sorcerer', monk: 'sk-fist',
};
// As mesmas artes das abas do ranking completo (site.mjs). "exp" fica de fora:
// o top 5 de experiência é o mesmo de level.
const CATEGORIAS = [
  ['level', 'Level', 'ficha-level'],
  ['magic', 'Magic', 'sk-magic'],
  ['melee', 'Melee', 'sk-melee'],
  ['distance', 'Distance', 'sk-distance'],
  ['shielding', 'Shielding', 'sk-shielding'],
  ['fishing', 'Fishing', 'sk-fishing'],
];

const sprites = loadSpriteData().then(() => true).catch(() => false);
let categoria = 'level';
/* As categorias que o SERVIDOR tem (`/api/status` → `categorias`). No jogo oficial (PoE) são só experiência e level: as abas das perícias
 * do Draevor somem, e o balão do personagem não mostra perícias (o PoE não tem). */
let categoriasDoServidor = null;
const oficial = () => !!categoriasDoServidor && !categoriasDoServidor.includes('magic');
let pedido = 0;

function linha(entrada, posicao, rotulo) {
  const li = document.createElement('li');
  li.className = `top5-item pos${posicao}`;
  const icone = ICONE_DA_VOCACAO[entrada.vocation];
  const link = `/personagem?nome=${encodeURIComponent(entrada.name)}`;
  // No jogo oficial a linha traz `classe` (o nome da classe do PoE — `comClasse`, systems/site.mjs): ela no lugar da vocação do Draevor.
  const vocacao = esc(entrada.classe ?? VOCACOES[entrada.vocation] ?? entrada.vocation ?? '—');
  // Numa skill, o level vai junto da vocação: o número grande é o da skill.
  const embaixo = categoria === 'level' ? vocacao : `${vocacao} · lv ${numero(entrada.level)}`;
  li.innerHTML = `
    <span class="top5-pos">${posicao}</span>
    <a class="top5-retrato" href="${link}" aria-hidden="true" tabindex="-1"></a>
    <div class="top5-info">
      <a class="top5-nome" href="${link}">${pontoDe(entrada)}<span class="top5-nome-txt">${esc(entrada.name)}</span></a>
      <span class="top5-voc">${icone ? `<img src="/client/assets/icons/${icone}.png" alt="">` : ''}${embaixo}</span>
    </div>
    <div class="top5-level"><small>${esc(rotulo)}</small><b>${numero(categoria === 'level' ? entrada.level : entrada.value)}</b></div>`;
  /*
   * O escudo é ACRESCENTADO depois do `innerHTML`, e não escrito dentro dele.
   *
   * O brasão é uma árvore de quatro camadas com variáveis CSS em cada uma —
   * costurá-lo em texto seria montar HTML à mão a partir de dados que vêm do
   * servidor, que é justamente por onde se escreve marcação sem querer. O
   * `desenharBrasao` devolve nós prontos, e `append` não interpreta nada.
   */
  /*
   * ---- A GUILDA FICA EMBAIXO DA VOCACAO ----
   *
   * Ela chegou a ir para DENTRO da linha da vocacao, e voltou: "a guild no site,
   * coloque como estava embaixo da vocaçao".
   *
   * O que sobrou da passagem — e que era o problema de verdade — foi o TAMANHO: o
   * escudo saiu de 12 para 18 pixels e agora desenha em modo icone, entao ele
   * aparece. Ver `seloDaGuilda`.
   */
  const daGuilda = linhaDaGuilda(entrada.guilda);
  if (daGuilda) li.querySelector('.top5-info')?.append(daGuilda);
  return li;
}

function pintarAbas() {
  const barra = $('top5-abas');
  if (!barra) return;
  if (barra.dataset.pronto !== '1') {
    barra.dataset.pronto = '1';
    for (const [chave, nome, arte] of CATEGORIAS) {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'top5-aba';
      botao.dataset.categoria = chave;
      botao.title = nome;
      botao.setAttribute('role', 'tab');
      botao.innerHTML = `<img src="/client/assets/icons/${arte}.png" alt="${esc(nome)}">`;
      botao.onclick = () => {
        if (categoria === chave) return;
        categoria = chave;
        pintar();
      };
      barra.append(botao);
    }
  }
  for (const botao of barra.children) {
    botao.setAttribute('aria-selected', String(botao.dataset.categoria === categoria));
    botao.hidden = !!categoriasDoServidor && !categoriasDoServidor.includes(botao.dataset.categoria);
  }
}

async function pintar() {
  const lista = $('top5');
  if (!lista) return;
  const meu = ++pedido;
  const [, nome] = CATEGORIAS.find(([chave]) => chave === categoria) ?? [null, 'Level'];
  if ($('top5-titulo')) $('top5-titulo').textContent = `Top 5 ${nome}`;
  pintarAbas();
  try {
    const resposta = await fetch(`/api/status?ranking=${encodeURIComponent(categoria)}`, { cache: 'no-store' });
    if (!resposta.ok || meu !== pedido) return;
    const dados = await resposta.json();
    if (meu !== pedido) return; // trocou de aba enquanto a resposta vinha
    if (Array.isArray(dados.categorias)) {
      categoriasDoServidor = dados.categorias;
      pintarAbas();
    }
    // Os dois cartazes de baixo vêm na MESMA resposta — ver `pintarTopExp`.
    pintarTopExp(dados);
    const top = (dados.highscore ?? []).slice(0, 5);
    if (!top.length) {
      lista.innerHTML = '<li class="vazio">ninguém no ranking ainda</li>';
      return;
    }
    const itens = top.map((entrada, i) => linha(entrada, i + 1, nome));
    // A lista é refeita a cada 30s: o balão da linha que sumiu some junto.
    if (linhaAtual) esconderInventario();
    itens.forEach((li, i) => ligarBalao(li, top[i]));
    lista.replaceChildren(...itens);
    if (!(await sprites) || meu !== pedido) return;
    top.forEach((entrada, i) => {
      if (!entrada.outfit?.type) return;
      try {
        itens[i].querySelector('.top5-retrato').append(outfitCanvas(entrada.outfit.type, entrada.outfit, 46));
      } catch { /* outfit sem desenho: fica a moldura */ }
    });
  } catch {
    // Servidor fora do ar: o cartão fica como está.
  }
}

/*
 * ---- Os dois cartazes de MOVIMENTO ----
 *
 * Pedido do dono: "embaixo do top 5 level, fora desse modal, coloca dois
 * negócios flutuantes bonitos: Top exp hoje e embaixo Top exp/hr — o top xp
 * total de hoje e o top xp/h que está agora. Só que esses 2 seriam pessoas
 * únicas."
 *
 * O top 5 de level responde "quem é o mais forte do servidor", e a resposta
 * dele é a mesma há semanas: quem começou ontem não aparece por mais que jogue.
 * Estes dois respondem a outra pergunta, a que muda o dia inteiro — quem está
 * jogando AGORA. Um recém-chegado que passa a tarde caçando aparece aqui.
 *
 * ---- Por que eles são "flutuantes", e fora da moldura ----
 *
 * Porque são outro placar. Postos dentro da moldura da Store, ao lado das
 * abas de level/magic/axe, pareceriam mais duas categorias do mesmo top 5 — e
 * não são: um mede acúmulo, os outros dois medem movimento.
 *
 * ---- Um NOME por cartaz, e estilo próprio ----
 *
 * "é pra mostrar o top xp e top xp/h só o PRIMEIRO, e não o segundo; e faz
 * ficar mais perto entre eles; e usa um estilo diferente do top 5 level."
 *
 * São três coisas que dizem a mesma: estes dois não são um segundo pódio. O
 * top 5 é uma lista e tem lugar para disputa; aqui a pergunta é "quem está
 * detonando agora", e a resposta é UM nome. Mostrar o segundo transformava o
 * cartaz numa lista curta e fazia a coluna inteira parecer três rankings
 * empilhados.
 *
 * ---- E os dois moram num cartaz SÓ ----
 *
 * "faz um card só, com a linha separada mais ou menos igual o do top level, e
 * deixa na mesma largura do top 5 level."
 *
 * Dois cartões empilhados eram duas molduras a seis pixels uma da outra, e a
 * coluna virava três placares. Num cartaz só eles voltam a ser o que são: a
 * mesma notícia — quem está detonando agora — em duas medidas, o dia e a hora.
 * O que separa as duas é uma linha, do jeito que as linhas do top 5 se separam.
 *
 * A cor continua sendo a diferença entre elas: dourado no do dia, verde-água no
 * do agora, que é a cor que o site já usa para o que está vivo. E cada faixa
 * tem um brilho que a atravessa na cor dela — em tempos diferentes, senão as
 * duas piscavam juntas e viravam uma coisa só de novo.
 *
 * O que continua igual ao top 5 é o que foi pedido antes e não mudou: o boneco
 * com a roupa dele, o nome, o level e a vocação com ícone.
 *
 * ---- De onde saem os números ----
 *
 * Da mesma resposta do `/api/status` que o top 5 já pede (`expHoje` e
 * `expHora`). Nenhum pedido a mais, e os três placares da coluna nunca ficam
 * de tempos diferentes.
 */
/*
 * Cada cartaz: a chave da resposta, o título, a legenda, a marca da cor, o
 * rótulo do número e a ARTE do canto.
 *
 * As duas artes já existem e são as certas: a da experiência é a mesma da
 * ficha do personagem, e a ampulheta é a do relógio das janelas. Pedir um
 * `icone-xp.png` novo seria inventar arte para dizer o que a do jogo já diz.
 */
const CARTAZES = [
  ['expHoje', 'Top exp hoje', 'desde a meia-noite', 'hoje', 'xp hoje', 'ficha-exp'],
  ['expHora', 'Top exp/h', 'do analisador, agora', 'hora', 'xp/h', 'ficha-exp'],
];

/*
 * ---- "+3 levels hoje" no cartaz de HOJE ----
 *
 * "onde tá o top exp hoje, informa quantos level ele upou, tipo +x level hoje,
 * e mostra em verde."
 *
 * Ele fica colado no level atual porque é a mesma frase: "lv 2.018 +3 levels
 * hoje" se lê de uma vez, e diz de onde o número saiu. Numa linha própria seria
 * mais um número solto no cartaz, e o cartaz tem três.
 *
 * O verde é FIXO, e não a cor da faixa. É a única coisa do cartaz que não muda
 * de cor junto com ela: no site o verde já quer dizer "subiu, está vivo" (o
 * ponto de quem está online, os números do agora), e um "+3 levels" dourado no
 * meio de um cartaz dourado sumiria dentro dele.
 *
 * Zero não aparece. "+0 levels" é uma informação que ninguém pediu, e num
 * cartaz de três linhas ela ocuparia o lugar de nada — quem não subiu nenhum
 * nível hoje já sabe disso.
 *
 * O cartaz do xp/h não tem o selo: `levels` só existe no placar do dia (ver
 * `topDoDia`), e o do analisador é uma taxa, não um acumulado — "+3 levels por
 * hora" seria uma conta que ninguém fez.
 */
const selo = (levels) => {
  const n = Math.max(0, Math.floor(Number(levels) || 0));
  if (!n) return '';
  return ` <i class="top-exp-levels" title="${n} ${n === 1 ? 'nível' : 'níveis'} desde a meia-noite">+${n} ${n === 1 ? 'level' : 'levels'} hoje</i>`;
};

/** 1.234.567 vira "1,2M" — a coluna é estreita e o número é enorme. */
function curto(valor) {
  const n = Number(valor ?? 0);
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace('.', ',')}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace('.', ',')}k`;
  return numero(n);
}

function pintarTopExp(dados) {
  const caixa = $('top-exp');
  if (!caixa) return;

  // Um cartaz só, e as duas faixas dentro dele. Ver a nota acima.
  const cartaz = document.createElement('article');
  cartaz.className = 'top-exp-cartaz';

  const feitos = [];
  for (const [chave, titulo, legenda, marca, rotulo, arte] of CARTAZES) {
    // Só o primeiro. Ver a nota acima: o cartaz é um nome, não uma lista.
    const dono = (dados?.[chave] ?? [])[0] ?? null;

    const faixa = document.createElement('section');
    faixa.className = `top-exp-faixa ${marca}`;

    const cabeca = document.createElement('h3');
    cabeca.innerHTML =
      `<img class="top-exp-arte" src="/client/assets/icons/${arte}.png" alt="">` +
      `<span>${esc(titulo)}</span><em>${esc(legenda)}</em>`;
    faixa.append(cabeca);

    if (!dono) {
      const vazio = document.createElement('p');
      vazio.className = 'top-exp-vazio';
      vazio.textContent = chave === 'expHora' ? 'ninguém caçando agora' : 'ninguém ganhou experiência hoje';
      faixa.append(vazio);
      cartaz.append(faixa);
      feitos.push({ faixa, dono: null });
      continue;
    }

    const link = `/personagem?nome=${encodeURIComponent(dono.name)}`;
    const icone = ICONE_DA_VOCACAO[dono.vocation];
    const corpo = document.createElement('div');
    corpo.className = 'top-exp-corpo';
    corpo.innerHTML = `
      <a class="top-exp-retrato" href="${link}" aria-hidden="true" tabindex="-1"></a>
      <div class="top-exp-quem">
        <a class="top-exp-nome" href="${link}">${pontoDe(dono)}<span class="top-exp-nome-txt">${esc(dono.name)}</span></a>
        <span class="top-exp-voc">${icone ? `<img src="/client/assets/icons/${icone}.png" alt="">` : ''}${esc(dono.classe ?? VOCACOES[dono.vocation] ?? dono.vocation ?? '—')} · lv ${numero(dono.level)}${selo(dono.levels)}</span>
      </div>
      <div class="top-exp-valor">
        <small>${esc(rotulo)}</small>
        <b title="${numero(dono.value)} de experiência"><img src="/client/assets/icons/${arte}.png" alt=""><span>${curto(dono.value)}</span></b>
      </div>`;
    /*
     * ---- A GUILDA, EMBAIXO DA VOCAÇÃO ----
     *
     * "faltou mostrar a guild embaixo da vocação no shield em top 5 level e top
     *  exp hoje."
     *
     * O mesmo selo das outras tabelas — mesmo escudo, mesma fonte do nome, mesmo
     * link para a página da guilda —, porque é a mesma peça em todas elas. Ver
     * `linhaDaGuilda`, em `brasao-no-site.mjs`.
     *
     * Dentro do `.top-exp-quem` e depois da vocação: o cartaz é uma coluna de
     * nome → vocação → guilda, e um `append` na faixa a jogaria para baixo do
     * número da experiência, do outro lado do cartaz.
     *
     * Quem não tem guilda não ganha linha nenhuma — a função devolve `null`.
     */
    const daGuilda = linhaDaGuilda(dono.guilda);
    if (daGuilda) corpo.querySelector('.top-exp-quem')?.append(daGuilda);
    faixa.append(corpo);
    /*
     * ---- E o balão do equipamento também abre aqui ----
     *
     * "ao colocar o mouse em cima dos top exp e top exp/h tinha que mostrar o
     * set e as coisas igual no top 5 level."
     *
     * É a MESMA função das linhas do top 5 (`ligarBalao`), e não uma cópia: o
     * balão pede a ficha pública, guarda por um minuto e desenha a grade do
     * Tibia com tier, estrelas e raridade. Duplicar isso aqui seria manter duas
     * telas que precisam concordar para sempre — e o cartaz já é a mesma
     * pergunta feita sobre outra pessoa.
     */
    ligarBalao(faixa, dono);
    cartaz.append(faixa);
    feitos.push({ faixa, dono });
  }

  caixa.replaceChildren(cartaz);

  // O boneco, depois que o atlas chegar — como no top 5.
  sprites.then((pronto) => {
    if (!pronto) return;
    for (const { faixa, dono } of feitos) {
      if (!dono?.outfit?.type) continue;
      const retrato = faixa.querySelector('.top-exp-retrato');
      if (!retrato || retrato.firstChild) continue;
      try {
        retrato.append(outfitCanvas(dono.outfit.type, dono.outfit, 42));
      } catch { /* outfit sem desenho: fica a moldura */ }
    }
  });
}

/*
 * ---- O inventário ao passar o mouse ----
 *
 * Parar o mouse numa linha abre, ao lado do cartão, a moldura do antigo "O
 * servidor agora" (panel-frame) com o boneco e o que a pessoa está vestindo,
 * na grade do Tibia: tier no canto, estrelas dos afixos e a cor da raridade.
 *
 * Os dados são os da ficha pública (`/api/personagem`), pedidos só na hora do
 * mouse e guardados por um minuto — passar o mouse de cima a baixo não vira
 * cinco pedidos a cada vez.
 */
/* A ordem das casas mora no componente — ver `ORDEM_DO_PAPERDOLL`. */
// As perícias embaixo do inventário, na ordem e com os ícones da ficha (personagem.html).
// A da categoria aberta no top 5 fica acesa.
const PERICIAS = [
  ['magic', 'ML'], ['melee', 'Melee'], ['distance', 'Dist'], ['shielding', 'Def'], ['fishing', 'Fish'],
];
// Só as que importam para cada vocação (pedido do dono). Sem vocação: todas menos fishing.
const PERICIAS_DA_VOCACAO = {
  knight: ['melee', 'magic', 'shielding'],
  paladin: ['distance', 'magic', 'shielding'],
  sorcerer: ['magic', 'shielding'],
  druid: ['magic', 'shielding'],
  monk: ['melee', 'magic', 'shielding'],
};
const periciasDa = (vocacao) => {
  const ordem = PERICIAS_DA_VOCACAO[vocacao] ?? PERICIAS.map(([chave]) => chave).filter((chave) => chave !== 'fishing');
  return ordem.map((chave) => PERICIAS.find(([k]) => k === chave));
};
const FICHA_VALE_MS = 60_000;
const fichas = new Map(); // nome -> { quando, promessa }

function fichaDe(nome) {
  const guardada = fichas.get(nome);
  if (guardada && Date.now() - guardada.quando < FICHA_VALE_MS) return guardada.promessa;
  const promessa = fetch(`/api/personagem?nome=${encodeURIComponent(nome)}`, { cache: 'no-store' })
    .then((r) => r.json())
    .then((d) => (d.ok ? d.personagem : null))
    .catch(() => null);
  fichas.set(nome, { quando: Date.now(), promessa });
  return promessa;
}

// A cor de cada estrela, pela régua do afixo (a mesma conta de `estrelasDosAfixos`).
function estrelas(af, catalogo) {
  return (Array.isArray(af) ? af : []).map((posto) => {
    const ficha = catalogo?.afixos?.[posto?.id];
    const valor = Number(posto?.value);
    const fracao = ficha && Number.isFinite(valor) && ficha.max > ficha.min
      ? Math.max(0, (valor - ficha.min) / (ficha.max - ficha.min))
      : ((Number(posto?.tier) || 1) - 1) / 2;
    return fracao > 1 ? 4 : fracao >= 2 / 3 ? 3 : fracao >= 1 / 3 ? 2 : 1;
  }).sort((a, b) => b - a);
}

let balao = null;
let linhaAtual = null;
let espera = null;
// O balão da peça (os atributos) e o prazo para o balão do inventário fechar depois que o mouse sai da linha — o tempo de ir até ele.
let balaoDaPeca = null;
let fechando = null;

function esconderPeca() {
  balaoDaPeca?.remove();
  balaoDaPeca = null;
}

/** O balão do jogo para a peça da casa (a peça inteira — a do PoE com raridade e modificadores), ao lado do balão do inventário. */
function mostrarPeca(casa, peca, inteira, slot) {
  esconderPeca();
  const ficha = fichaDeItem(peca.id, null, slot, inteira);
  if (!ficha) return;
  balaoDaPeca = document.createElement('div');
  balaoDaPeca.className = `tooltip ${ficha.classe}`;
  balaoDaPeca.style.position = 'fixed';
  balaoDaPeca.style.zIndex = '40';
  balaoDaPeca.style.pointerEvents = 'none';
  balaoDaPeca.append(...ficha.partes);
  document.body.append(balaoDaPeca);
  const caixa = (balao ?? casa).getBoundingClientRect();
  const { width, height } = balaoDaPeca.getBoundingClientRect();
  let left = caixa.left - width - 8;
  if (left < 8) left = Math.min(caixa.right + 8, innerWidth - width - 8);
  const alvo = casa.getBoundingClientRect();
  const top = Math.max(8, Math.min(alvo.top, innerHeight - height - 8));
  balaoDaPeca.style.left = `${Math.round(left)}px`;
  balaoDaPeca.style.top = `${Math.round(top)}px`;
}

function garantirBalao() {
  if (balao) return balao;
  balao = document.createElement('div');
  balao.className = 'top5-pop';
  balao.hidden = true;
  // O balão aceita o mouse (para passar nas peças): entrar nele segura; sair dele fecha.
  balao.addEventListener('pointerenter', () => clearTimeout(fechando));
  balao.addEventListener('pointerleave', () => esconderInventario());
  // O rodapé promete: o clique abre a ficha completa de quem está no balão.
  balao.addEventListener('click', () => { if (balao.dataset.nome) location.href = `/personagem?nome=${encodeURIComponent(balao.dataset.nome)}`; });
  document.body.append(balao);
  return balao;
}

function posicionar(li) {
  /*
   * A COLUNA da direita, e não o cartão do top 5.
   *
   * Era `li.closest('.top5')`, e isso valia enquanto o balão só abria nas
   * linhas do top 5. Desde que os cartazes de experiência também o abrem
   * (`ligarBalao`, lá embaixo), o `closest` devolvia `null` para eles — eles
   * são irmãos do `.top5`, não filhos — e o balão aparecia e estourava no
   * mesmo quadro.
   *
   * A coluna serve aos dois e não muda nada para o top 5: ela é a célula da
   * grade que o cartão preenche, então as bordas esquerda e direita são as
   * mesmas. E é o que se quer dos cartazes também — o balão encosta na coluna,
   * e não em cada cartaz, senão ele dançaria de lugar entre um e outro.
   */
  const cartao = (li.closest('.capa-direita') ?? li.closest('.top5') ?? li).getBoundingClientRect();
  const linhaRet = li.getBoundingClientRect();
  const { width, height } = balao.getBoundingClientRect();
  // À esquerda do cartão, que mora na coluna da direita; sem espaço, à direita.
  let left = cartao.left - width - 10;
  if (left < 8) left = Math.min(cartao.right + 10, innerWidth - width - 8);
  // Nunca por baixo da barra fixa de cima (faixa de teste + menu).
  const piso = (document.querySelector('.topo')?.getBoundingClientRect().bottom ?? 0) + 6;
  const top = Math.max(piso, Math.min(linhaRet.top + linhaRet.height / 2 - height / 2, innerHeight - height - 8));
  balao.style.left = `${Math.round(left)}px`;
  balao.style.top = `${Math.round(top)}px`;
}

async function mostrarInventario(li, entrada) {
  garantirBalao();
  balao.dataset.nome = entrada.name;
  const p = await fichaDe(entrada.name);
  // Os ícones das peças do PoE vêm do catálogo da ficha (sem isto, "?" no inventário do balão).
  if (p?.itens) emprestarDoCatalogo(p.itens);
  if (linhaAtual !== li) return; // o mouse já saiu
  if (!p) return esconderInventario();
  balao.innerHTML = `
    <div class="top5-pop-cabeca">
      <div class="top5-pop-boneco"></div>
      <div>
        <b>${esc(p.nome)}</b>
        <span class="top5-pop-voc">${esc(p.vocacaoNome ?? VOCACOES[p.vocacao] ?? p.vocacao ?? '')}</span>
        <span>Level <em>${numero(p.level)}</em></span>
        ${p.jogando
          ? '<span class="on"><i class="ponto"></i>online agora</span>'
          : p.atividade?.onde === 'cacando-offline'
            ? '<span class="ausente"><i class="ponto ausente"></i>caçando offline</span>'
            : '<span class="off"><i class="ponto off"></i>offline</span>'}
      </div>
    </div>
    <div class="top5-pop-titulo">Inventory</div>
    <div class="top5-pop-equipamento"></div>
    ${oficial() ? '' : `<div class="top5-pop-titulo">Skills</div>
    <div class="top5-pop-skills" style="grid-template-columns: repeat(${periciasDa(p.vocacao).length}, 1fr)">${periciasDa(p.vocacao).map(([chave, rotulo]) => `
      <div class="top5-pop-skill${chave === categoria ? ' atual' : ''}" title="${rotulo}">
        <img src="/client/assets/icons/sk-${chave}.png" alt=""><b>${numero(chave === 'magic' ? p.magic : p.skills?.[chave])}</b><span>${rotulo}</span>
      </div>`).join('')}</div>`}
    <div class="top5-pop-rodape">clique para abrir a ficha completa</div>`;
  const temSprites = await sprites;
  /*
   * O ADAPTADOR desta página: a ficha pública devolve um mapa por casa, com a
   * peça inteira dentro (`.peca`), a raridade num mapa de itens e a régua dos
   * afixos no catálogo. A grade não conhece nada disso — ela recebe a peça já
   * traduzida. Ver `gradeDeEquipamento`.
   */
  balao.querySelector('.top5-pop-equipamento')?.append(
    gradeDeEquipamento(
      (slot) => {
        const peca = p.equipamento?.[slot];
        if (!peca) return null;
        const inteira = peca.peca ?? { id: peca.id, tier: peca.tier };
        return {
          id: peca.id,
          tier: inteira.tier,
          count: peca.count,
          // (Sem `titulo`: o balão da peça, ao passar o mouse, já diz tudo.)
          raridade: p.itens?.[peca.id]?.rarity,
          // A peça do PoE: a borda na cor da raridade dela.
          corPoe: inteira.poe?.cor ?? null,
          estrelas: estrelas(inteira.af, p.catalogo),
        };
      },
      { comSprites: temSprites },
    ),
  );
  /*
   * ---- A GUILDA NO CARTAO DO PERSONAGEM ----
   *
   * "no card do personagem na home (o de INVENTORY/SKILLS), mostrar a linha da guilda
   *  embaixo da vocação, no mesmo formato."
   *
   * O mesmo selo das tabelas, e por isso o mesmo escudo, o mesmo corte e o mesmo
   * link. `insertAdjacentElement('afterend')` e nao um `append` no bloco: ela tem de
   * ficar EMBAIXO da vocacao e ACIMA do level, e um `append` a jogaria para o fim,
   * depois do "online agora".
   *
   * E vem ANTES do `await sprites`: o escudo nao depende da folha de sprites, e
   * pendura-lo depois dela faria a guilda sumir do cartao sempre que a folha
   * falhasse — por uma coisa que nao tem nada a ver com ela.
   */
  // O balão de cada peça: o catálogo da ficha JUNTO do que a capa já tem (os drops usam o mesmo balão).
  juntarDados(p.itens ?? {}, p.catalogo ?? null);
  for (const casa of balao.querySelectorAll('.top5-pop-equipamento .pd-slot[data-slot]')) {
    const slot = casa.dataset.slot;
    const peca = p.equipamento?.[slot];
    if (!peca) continue;
    const inteira = peca.peca ?? { id: peca.id, tier: peca.tier };
    casa.addEventListener('pointerenter', () => mostrarPeca(casa, peca, inteira, slot));
    casa.addEventListener('pointerleave', esconderPeca);
  }
  const daGuilda = linhaDaGuilda(p.guilda);
  if (daGuilda) balao.querySelector('.top5-pop-voc')?.insertAdjacentElement('afterend', daGuilda);

  if (temSprites && p.outfit?.type) {
    try { balao.querySelector('.top5-pop-boneco').append(outfitCanvas(p.outfit.type, p.outfit, 64, 2, true)); } catch { /* sem boneco */ }
  }
  if (linhaAtual !== li) return;
  balao.hidden = false;
  posicionar(li);
}

function esconderInventario() {
  clearTimeout(espera);
  clearTimeout(fechando);
  linhaAtual = null;
  esconderPeca();
  if (balao) balao.hidden = true;
}

function ligarBalao(li, entrada) {
  li.addEventListener('pointerenter', (evento) => {
    if (evento.pointerType === 'touch') return; // no toque o link já abre a ficha
    clearTimeout(espera);
    linhaAtual = li;
    espera = setTimeout(() => mostrarInventario(li, entrada), 120);
  });
  // Sair da linha fecha com um respiro: dá tempo de levar o mouse até o balão (que segura enquanto o mouse está nele).
  li.addEventListener('pointerleave', () => {
    if (linhaAtual !== li) return;
    clearTimeout(fechando);
    fechando = setTimeout(() => { if (!balao?.matches(':hover')) esconderInventario(); }, 180);
  });
  // A linha inteira abre a ficha, como o rodapé do balão promete.
  li.addEventListener('click', (evento) => {
    if (evento.target.closest('a')) return;
    location.href = `/personagem?nome=${encodeURIComponent(entrada.name)}`;
  });
}
window.addEventListener('scroll', esconderInventario, { passive: true });

pintar();
// Trinta segundos, o mesmo ritmo do resto da capa.
setInterval(pintar, 30_000);
