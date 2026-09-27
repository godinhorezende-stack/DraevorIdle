/*
 * ---- Gem Atelier e Fragment Workshop ----
 *
 * Três abas, no desenho da janela da roda do client oficial:
 *
 *   Gem Atelier        à esquerda a revelação das gemas fechadas e a cruz dos
 *                      vessels; em cima o detalhe da gema escolhida, com as
 *                      ações; embaixo a grade das reveladas, com filtro,
 *                      cadeado e balão ao passar o mouse.
 *   Encaixes           os quatro domínios em volta da cruz, com os vessels que a
 *                      árvore já encheu.
 *   Fragment Workshop  a escada dos quatro graus do modificador escolhido e a
 *                      grade de ícones de todos os modificadores.
 *
 * Toda regra mora no servidor (`server/src/gemas.mjs`): a tela só mostra a view
 * e manda o pedido. É o mesmo arranjo da árvore.
 */
import { ehTelefone } from './perfil.mjs';
import { itemCanvas } from './sprites.mjs';
import { artOrUiIcon } from './hud.mjs';
import { spellIcon } from './actionbar.mjs';
import { tipPanel } from './tooltip.mjs';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const ouro = (n) => `${Math.round(n ?? 0).toLocaleString('pt-BR')} gold`;
const curto = (n) => (n >= 1_000_000 ? `${String(n / 1_000_000).replace('.', ',')}kk` : n >= 1000 ? `${String(n / 1000).replace('.', ',')}k` : String(n));

const NOME_DO_DOMINIO = { verde: 'Verde', vermelho: 'Vermelho', roxo: 'Roxo', azul: 'Azul' };
const NOME_DA_QUALIDADE = { lesser: 'Lesser', regular: 'Regular', greater: 'Greater' };
const VOCACAO = { knight: 'Knight', paladin: 'Paladin', sorcerer: 'Sorcerer', druid: 'Druid', monk: 'Monk' };
const NOME_DA_GEMA = { knight: 'Guardian', paladin: 'Marksman', sorcerer: 'Sage', druid: 'Mystic', monk: 'Spiritualist' };
const GRAUS = ['I', 'II', 'III', 'IV'];

/*
 * ---- As artes são as do client oficial ----
 *
 * Tiradas do `graphics_resources.rcc` do client (pasta `images/skillwheel`) e
 * do OTClient (`images/game/destiny_wheel`), postas em `client/assets/ui/gemas`.
 * As folhas têm quadros iguais, e o desenho é escolhido pela posição:
 *
 *   gem variants     60 × 32 px: vocação (5) × cor (4) × tamanho (3)
 *   domain affinity   4 × 26 px: verde, vermelho, azul, roxo
 *   basic mods       49 × 30 px: o id do modificador é o índice
 *   supreme mods     94 × 35 px: o índice vem do servidor (`icone`)
 *   modgrades         8 × 50 px: a moldura de cada grau (I a IV)
 */
const ARTE = '/client/assets/ui/gemas';
const INDICE_DA_COR = { verde: 0, vermelho: 1, azul: 2, roxo: 3 };
const INDICE_DO_TAMANHO = { lesser: 0, regular: 1, greater: 2 };

/** Um quadro de uma folha, ampliado sem borrar. */
function quadro(folha, lado, indice, escala, classe = '') {
  const node = el('i', `gemas-sprite ${classe}`);
  const px = lado * escala;
  node.style.width = `${px}px`;
  node.style.height = `${px}px`;
  node.style.backgroundImage = `url(${ARTE}/${folha}.png)`;
  node.style.backgroundPosition = `-${indice * px}px 0`;
  node.style.backgroundSize = `auto ${px}px`;
  return node;
}

/** A gema no formato da vocação e na cor do domínio. */
const desenhoDaGema = (view, dominio, qualidade, escala = 2, vocacao = view.folha?.vocacao ?? 0) =>
  quadro('icons-gematelier-gemvariants', 32, vocacao * 12 + INDICE_DA_COR[dominio] * 3 + INDICE_DO_TAMANHO[qualidade], escala, 'gemas-desenho');

const simboloDoDominio = (dominio, escala = 1) =>
  quadro('icons-gematelier-domainaffinity', 26, INDICE_DA_COR[dominio], escala, 'gemas-simbolo');

/** O ícone do modificador dentro da moldura do grau dele. */
function iconeDoModificador(mod, escala = 1, grau = mod.grau ?? 0) {
  const moldura = quadro('backdrop_modgrades', 50, Math.max(0, Math.min(3, grau)), escala, 'gemas-moldura');
  if (mod.icone != null) {
    const folha = mod.tipo === 'basico' ? ['icons-skillwheel-basicmods', 30] : ['icons-skillwheel-suprememods', 35];
    moldura.append(quadro(folha[0], folha[1], mod.icone, escala, 'gemas-icone-do-mod'));
  }
  return moldura;
}

/*
 * O texto de um modificador em partes, cada uma com o ícone dela: o elemento
 * na resistência, o coração na vida, o desenho da magia no supremo.
 */
function partesComIcone(partes, classe = 'gemas-partes') {
  const linha = el('span', classe);
  for (const parte of partes ?? []) {
    const pedaco = el('span', 'gemas-parte');
    if (parte.magia != null) pedaco.append(spellIcon(parte.magia, 16));
    if (parte.icone) {
      const icone = artOrUiIcon(parte.icone, '');
      icone.classList.add('gemas-parte-icone');
      pedaco.append(icone);
    }
    pedaco.append(el('span', null, parte.texto));
    linha.append(pedaco);
  }
  return linha;
}

const imagem = (arquivo, px, classe = '', altura = px) => {
  const node = el('img', `gemas-img ${classe}`);
  node.src = `${ARTE}/${arquivo}.png`;
  node.alt = '';
  node.width = px;
  node.height = altura;
  return node;
};

let ctx = null;
let aba = 'gemas';
/*
 * ---- O que sobrevive ao redesenho ----
 *
 * Cada ação devolve a view nova e a janela é refeita; perder a gema escolhida,
 * o filtro ou a seleção a cada clique seria pior do que não ter.
 */
const filtro = { dominio: '', qualidade: '', busca: '', trancadas: false };
const selecionadas = new Set();
let escolhendo = false;
let gemaEscolhida = null;
const oficina = { busca: '', tipo: 'uso', escolhido: null };
const grausVistos = new Map();

export function initGemas(context) {
  ctx = context;
}

export function openGemas() {
  ctx.send({ t: 'gemas' });
  ctx.openModal(
    'Gem Atelier',
    (body) => {
      const draw = () => {
        const rolagem = body.querySelector('.gemas-grade, .gemas-oficina-grade')?.scrollTop ?? 0;
        body.innerHTML = '';
        renderGemas(body);
        const nova = body.querySelector('.gemas-grade, .gemas-oficina-grade');
        if (nova) nova.scrollTop = rolagem;
      };
      ctx.redraw = draw;
      draw();
    },
    null,
    'gemas'
  );
}

const pedir = (action, extra = {}) => ctx.send({ t: 'gemas', action, ...extra });

function botao(texto, classe, acao, desligado = false, dica = '') {
  const b = el('button', classe, texto);
  b.type = 'button';
  b.disabled = !!desligado;
  if (dica) b.title = dica;
  b.onclick = acao;
  return b;
}

/* ================================================================ moldura */

function renderGemas(body) {
  const view = ctx.state.gemas;
  if (!view) return void body.append(el('p', 'empty', 'carregando...'));

  const abas = el('div', 'gemas-abas');
  for (const [id, rotulo, arte] of [
    ['gemas', 'Gem Atelier', 'icon-gematelier'],
    ['encaixes', 'Encaixes', 'icon-socketed'],
    ['oficina', 'Fragment Workshop', 'icon-fragmentworkshop'],
  ]) {
    const b = el('button', `gemas-aba${aba === id ? ' ativa' : ''}`);
    b.type = 'button';
    b.append(imagem(arte, 28), el('span', null, rotulo));
    b.onclick = () => {
      aba = id;
      ctx.redraw?.();
    };
    abas.append(b);
  }
  body.append(abas);

  if (!view.pode) body.append(el('p', 'gemas-aviso', view.motivo));

  if (aba === 'gemas') renderAtelier(body, view);
  else if (aba === 'encaixes') renderEncaixes(body, view);
  else renderOficina(body, view);

  body.append(rodape(view));
}

/** O rodapé do client: ouro, os dois fragmentos e os bônus aplicados. */
function rodape(view) {
  const barra = el('div', 'gemas-rodape');
  const caixa = (conteudo, dica) => {
    const c = el('span', 'gemas-rodape-caixa');
    c.append(...conteudo);
    if (dica) c.title = dica;
    return c;
  };
  const gold = (ctx.state.character?.gold ?? 0) + (ctx.state.character?.bank ?? 0);
  barra.append(
    caixa([el('b', null, gold.toLocaleString('pt-BR')), itemCanvas(3031, 16)], 'Ouro (mão e banco)'),
    caixa([el('b', null, String(view.fragmentos.menor ?? 0)), imagem('icon-fragments-lesser', 18)], 'Lesser Fragments'),
    caixa([el('b', null, String(view.fragmentos.maior ?? 0)), imagem('icon-fragments-greater', 18)], 'Greater Fragments')
  );
  const pilula = el('span', 'gemas-pilula');
  pilula.append(imagem('icon-skillwheel-vesselresonance-supreme', 18), el('span', null, `Bônus aplicados (${view.totais?.linhas?.length ?? 0})`));
  tipPanel(pilula, () => balaoDosBonusDasGemas(ctx.state.gemas));
  barra.append(pilula);
  return barra;
}

/* ============================================================== balões */

/*
 * ---- Os bônus aplicados, somados, ao passar o mouse ----
 *
 * A soma vem pronta do servidor (`totaisView`), a mesma que entra na ficha.
 */
export function balaoDosBonusDasGemas(view) {
  const totais = view?.totais;
  const caixa = el('div', 'tip-gemas');
  caixa.append(el('b', 'tip-gemas-titulo', 'Bônus das gemas aplicados'));
  if (!totais?.linhas?.length) {
    caixa.append(el('em', null, 'Nenhum modificador aceso. Encaixe uma gema e encha os vessels do domínio dela na árvore.'));
    return caixa;
  }
  for (const linha of totais.linhas) {
    const nó = el('div', 'tip-gemas-linha');
    const icones = el('span', 'tip-gemas-icones');
    if (linha.magia != null) icones.append(spellIcon(linha.magia, 16));
    if (linha.icone) icones.append(artOrUiIcon(linha.icone, ''));
    nó.append(icones, el('span', null, linha.rotulo), el('b', null, linha.valor));
    caixa.append(nó);
  }
  caixa.append(
    el(
      'em',
      'tip-gemas-total',
      `Total: ${totais.modificadores} modificador${totais.modificadores === 1 ? '' : 'es'} aceso${totais.modificadores === 1 ? '' : 's'} · ${totais.linhas.length} bônus`
    )
  );
  return caixa;
}

/** O balão de uma gema: o que cada modificador dá, com ícone e porcentagem. */
function balaoDaGema(gema, view) {
  const caixa = el('div', `tip-gema dominio-${gema.dominio}`);
  const cabeca = el('div', 'tip-gema-cabeca');
  cabeca.append(desenhoDaGema(view, gema.dominio, gema.qualidade, 1.5));
  const titulo = el('div');
  const nome = el('b', null, `${NOME_DA_QUALIDADE[gema.qualidade]} ${NOME_DA_GEMA[view.vocacao] ?? ''} Gem`);
  const linha = el('span', 'tip-gema-dominio');
  linha.append(simboloDoDominio(gema.dominio, 0.7), el('span', null, `Domínio ${NOME_DO_DOMINIO[gema.dominio].toLowerCase()}`));
  titulo.append(nome, linha);
  cabeca.append(titulo);
  caixa.append(cabeca);
  for (const mod of gema.modificadores) {
    const l = el('div', `tip-gema-mod ${mod.tipo}${gema.ativa ? (mod.aceso ? ' aceso' : ' apagado') : ''}`);
    const texto = el('div');
    texto.append(el('b', null, `${mod.nome} · grau ${mod.grauNome}`), partesComIcone(mod.partes));
    l.append(iconeDoModificador(mod, 0.7), texto);
    caixa.append(l);
  }
  const estado = [];
  if (gema.ativa) estado.push('encaixada');
  if (gema.trancada) estado.push('trancada');
  if (gema.ativa && gema.modificadores.some((m) => !m.aceso)) estado.push('os apagados acendem com mais vessels cheios');
  if (estado.length) caixa.append(el('em', 'tip-gema-estado', estado.join(' · ')));
  return caixa;
}

function balaoDoModificador(mod) {
  const caixa = el('div', 'tip-gema');
  const cabeca = el('div', 'tip-gema-cabeca');
  cabeca.append(iconeDoModificador(mod, 0.8));
  const titulo = el('div');
  titulo.append(el('b', null, mod.nome), el('span', 'tip-gema-dominio', `${mod.tipo === 'basico' ? 'Básico' : 'Supremo'} · grau ${mod.grauNome}`));
  cabeca.append(titulo);
  caixa.append(cabeca, partesComIcone(mod.partes));
  return caixa;
}

/* ========================================================== confirmações */

function caixaDeConfirmacao(titulo, montar, rotulo, acao) {
  const back = el('div', 'confirm-back');
  const box = el('div', 'confirm-box gemas-confirmar');
  box.append(el('h3', null, titulo));
  montar(box);
  const acoes = el('div', 'confirm-actions');
  const cancelar = el('button', 'ghost', 'Cancelar');
  cancelar.onclick = () => back.remove();
  const confirmar = el('button', 'primary gemas-perigo', rotulo);
  confirmar.onclick = () => {
    back.remove();
    acao();
  };
  acoes.append(cancelar, confirmar);
  box.append(acoes);
  back.append(box);
  back.onclick = (evento) => {
    if (evento.target === back) back.remove();
  };
  back.onkeydown = (evento) => {
    if (evento.key === 'Escape') back.remove();
  };
  document.body.append(back);
  cancelar.focus();
}

const FAIXA_DE_FRAGMENTOS = { lesser: ['menor', 1, 5], regular: ['menor', 2, 10], greater: ['maior', 1, 5] };

function confirmarDestruir(gema, view) {
  caixaDeConfirmacao(
    'Destruir gema',
    (box) => {
      const pedra = el('div', `gemas-pedra dominio-${gema.dominio}`);
      pedra.append(desenhoDaGema(view, gema.dominio, gema.qualidade, 2));
      box.append(pedra, balaoDaGema(gema, view));
      const [tipo, min, max] = FAIXA_DE_FRAGMENTOS[gema.qualidade];
      const aviso = el('p', 'confirm-short');
      aviso.append(
        el('span', null, `Ela vira ${min} a ${max}`),
        imagem(tipo === 'maior' ? 'icon-fragments-greater' : 'icon-fragments-lesser', 18),
        el('span', null, `${tipo === 'maior' ? 'Greater' : 'Lesser'} Fragments e não volta.`)
      );
      box.append(aviso);
    },
    'Destruir',
    () => pedir('destruir', { id: gema.id })
  );
}

function confirmarDestruirVarias(view) {
  const gemas = view.lista.filter((g) => selecionadas.has(g.id) && !g.trancada);
  if (!gemas.length) return;
  caixaDeConfirmacao(
    `Destruir ${gemas.length} gema${gemas.length === 1 ? '' : 's'}`,
    (box) => {
      const vitrine = el('div', 'gemas-confirmar-vitrine');
      for (const g of gemas.slice(0, 60)) vitrine.append(desenhoDaGema(view, g.dominio, g.qualidade, 1));
      if (gemas.length > 60) vitrine.append(el('span', 'gemas-lote-conta', `+${gemas.length - 60}`));
      box.append(vitrine);
      const soma = { menor: [0, 0], maior: [0, 0] };
      for (const g of gemas) {
        const [tipo, min, max] = FAIXA_DE_FRAGMENTOS[g.qualidade];
        soma[tipo][0] += min;
        soma[tipo][1] += max;
      }
      const rende = el('div', 'confirm-rows');
      for (const [tipo, nome, arte] of [['menor', 'Lesser Fragments', 'icon-fragments-lesser'], ['maior', 'Greater Fragments', 'icon-fragments-greater']]) {
        if (!soma[tipo][1]) continue;
        const linha = el('div', 'after');
        const rotulo = el('span');
        rotulo.append(imagem(arte, 16), el('span', null, ` ${nome}`));
        linha.append(rotulo, el('b', null, `${soma[tipo][0]} a ${soma[tipo][1]}`));
        rende.append(linha);
      }
      box.append(rende);
      const encaixadas = gemas.filter((g) => g.ativa).length;
      if (encaixadas) box.append(el('p', 'confirm-short', `${encaixadas} delas sai${encaixadas === 1 ? '' : 'em'} do encaixe.`));
      box.append(el('p', 'confirm-short', 'As gemas destruídas não voltam.'));
    },
    `Destruir ${gemas.length}`,
    () => {
      pedir('destruirVarias', { ids: gemas.map((g) => g.id) });
      selecionadas.clear();
      escolhendo = false;
    }
  );
}

/* ========================================================= Gem Atelier */

function renderAtelier(body, view) {
  const grade = el('div', 'gemas-atelier');

  /* ---- coluna da esquerda: vessels e revelação ---- */
  const esquerda = el('div', 'gemas-atelier-esquerda');
  const vessels = el('section', 'gemas-painel');
  vessels.append(el('h5', 'gemas-painel-titulo', 'Vessels'));
  vessels.append(cruzPequena(view));
  esquerda.append(vessels);

  const revelar = el('section', 'gemas-painel gemas-revelar');
  revelar.append(el('h5', 'gemas-painel-titulo', 'Revelar gemas'));
  for (const qualidade of ['lesser', 'regular', 'greater']) {
    const f = view.fechadas[qualidade];
    const bloco = el('div', `gemas-revelar-item${f.quantas ? '' : ' vazio'}`);
    const moldura = el('span', 'gemas-revelar-moldura');
    moldura.append(itemCanvas(f.itemId, 32, 0));
    bloco.append(moldura, el('b', null, `${NOME_DA_QUALIDADE[qualidade]} ${NOME_DA_GEMA[view.vocacao] ?? ''} Gem (x ${f.quantas})`));
    const acao = el('div', 'gemas-revelar-acao');
    acao.append(
      botao('Revelar', 'ghost', () => pedir('revelar', { qualidade }), !view.pode || !f.quantas),
      el('span', `gemas-preco-caixa${(ctx.state.character?.gold ?? 0) + (ctx.state.character?.bank ?? 0) < view.precos.revelar[qualidade] ? ' falta' : ''}`, curto(view.precos.revelar[qualidade]))
    );
    acao.lastChild.append(itemCanvas(3031, 16));
    bloco.append(acao);
    revelar.append(bloco);
  }
  if (view.paraTriturar.length) {
    const triturar = el('div', 'gemas-triturar');
    triturar.append(el('em', null, `Triturar em fragments (${view.precos.triturar} gold):`));
    for (const g of view.paraTriturar) {
      const b = botao('', 'ghost gemas-triturar-item', () => pedir('triturar', { itemId: g.itemId }), !view.pode, `${NOME_DA_QUALIDADE[g.qualidade]} gem de ${VOCACAO[g.vocacao]} — triturar uma`);
      b.append(itemCanvas(g.itemId, 24, g.quantas));
      triturar.append(b);
    }
    revelar.append(triturar);
  }
  esquerda.append(revelar);
  grade.append(esquerda);

  /* ---- à direita: o detalhe e a grade ---- */
  const direita = el('div', 'gemas-atelier-direita');
  const existentes = new Set(view.lista.map((g) => g.id));
  for (const id of [...selecionadas]) if (!existentes.has(id)) selecionadas.delete(id);
  if (gemaEscolhida != null && !existentes.has(gemaEscolhida)) gemaEscolhida = null;
  const visiveis = gemasFiltradas(view);
  if (gemaEscolhida == null && visiveis.length) gemaEscolhida = visiveis[0].id;
  direita.append(detalheDaGema(view.lista.find((g) => g.id === gemaEscolhida), view));
  direita.append(barraDoFiltro(view, visiveis));

  const celulas = el('div', `gemas-grade${escolhendo ? ' escolhendo' : ''}`);
  if (!view.lista.length) celulas.append(el('p', 'empty', 'Nenhuma gema revelada ainda. Gemas fechadas caem de monstros fortes e de bosses.'));
  else if (!visiveis.length) celulas.append(el('p', 'empty', 'Nenhuma gema passa neste filtro.'));
  for (const gema of visiveis) celulas.append(celulaDaGema(gema, view));
  direita.append(celulas);
  grade.append(direita);
  body.append(grade);
}

/** A cruz dos vessels, pequena, com as gemas encaixadas. */
function cruzPequena(view) {
  const cruz = el('div', 'gemas-cruz pequena');
  cruz.append(imagem('socket-gematelier', 120, 'gemas-cruz-arte'));
  for (const dominio of ['verde', 'vermelho', 'azul', 'roxo']) {
    const gema = view.lista.find((g) => g.id === view.ativas?.[dominio]);
    const vaga = el('div', `gemas-cruz-vaga pos-${dominio}${gema ? ' cheia' : ''}`);
    if (gema) {
      vaga.append(desenhoDaGema(view, dominio, gema.qualidade, 1));
      tipPanel(vaga, () => balaoDaGema(gema, view));
      vaga.onclick = () => {
        gemaEscolhida = gema.id;
        ctx.redraw?.();
      };
    }
    cruz.append(vaga);
  }
  return cruz;
}

function detalheDaGema(gema, view) {
  const painel = el('section', 'gemas-painel gemas-detalhe');
  if (!gema) {
    painel.append(el('h5', 'gemas-painel-titulo', 'Clique numa gema para ver os modificadores'));
    return painel;
  }
  painel.classList.add(`dominio-${gema.dominio}`);
  painel.append(el('h5', 'gemas-painel-titulo', `${NOME_DA_QUALIDADE[gema.qualidade]} ${NOME_DA_GEMA[view.vocacao] ?? ''} Gem`));
  const corpo = el('div', 'gemas-detalhe-corpo');

  const lado = el('div', 'gemas-detalhe-pedra');
  const pedra = el('div', 'gemas-pedra');
  pedra.append(desenhoDaGema(view, gema.dominio, gema.qualidade, 2));
  const dominio = el('div', 'gemas-detalhe-dominio');
  dominio.append(el('span', null, 'Domínio'), simboloDoDominio(gema.dominio, 1));
  lado.append(pedra, dominio);
  corpo.append(lado);

  const mods = el('div', 'gemas-detalhe-mods');
  for (const mod of gema.modificadores) {
    const bloco = el('div', `gemas-detalhe-mod ${mod.tipo}${gema.ativa ? (mod.aceso ? ' aceso' : ' apagado') : ''}`);
    bloco.append(iconeDoModificador(mod, 1));
    const texto = el('div', 'gemas-detalhe-texto');
    texto.append(el('b', null, mod.nome), partesComIcone(mod.partes));
    if (gema.ativa && !mod.aceso) texto.append(el('em', null, `acende com ${mod.precisa} vessel${mod.precisa > 1 ? 's' : ''} cheio${mod.precisa > 1 ? 's' : ''}`));
    bloco.append(texto);
    mods.append(bloco);
  }
  corpo.append(mods);
  painel.append(corpo);

  const acoes = el('div', 'gemas-detalhe-acoes');
  acoes.append(
    botao(gema.ativa ? 'Tirar do vessel' : 'Pôr no vessel', gema.ativa ? 'ghost' : 'primary', () => pedir('encaixar', { id: gema.id }), !view.pode),
    cadeado(gema, true)
  );
  const direita = el('div', 'gemas-detalhe-acoes-direita');
  const trocar = el('span', 'gemas-com-preco');
  trocar.append(
    botao('Trocar domínio', 'ghost', () => pedir('trocarDominio', { id: gema.id }), !view.pode || gema.trancada, gema.trancada ? 'Destranque para trocar' : ''),
    el('span', 'gemas-preco-caixa', curto(view.precos.trocarDominio[gema.qualidade]))
  );
  trocar.lastChild.append(itemCanvas(3031, 16));
  direita.append(trocar, botao('Destruir', 'ghost perigo', () => confirmarDestruir(gema, view), !view.pode || gema.trancada, gema.trancada ? 'Destranque para destruir' : ''));
  acoes.append(direita);
  painel.append(acoes);
  return painel;
}

/** O cadeadinho do client (`icon-locked` / `icon-unlocked`). */
function cadeado(gema, comTexto = false) {
  const b = el('button', `gemas-cadeado${gema.trancada ? ' trancada' : ''}${comTexto ? ' com-texto' : ''}`);
  b.type = 'button';
  b.append(imagem(gema.trancada ? 'icon-locked' : 'icon-unlocked', 12, '', 18));
  if (comTexto) b.append(el('span', null, gema.trancada ? 'Trancada' : 'Trancar'));
  b.title = gema.trancada ? 'Trancada: não destrói nem troca de domínio. Clique para destrancar.' : 'Trancar esta gema';
  b.onclick = (evento) => {
    evento.stopPropagation();
    pedir('trancar', { id: gema.id });
  };
  return b;
}

function celulaDaGema(gema, view) {
  const marcada = escolhendo && selecionadas.has(gema.id);
  const celula = el(
    'div',
    `gemas-celula dominio-${gema.dominio}${gema.id === gemaEscolhida ? ' escolhida' : ''}${gema.ativa ? ' ativa' : ''}${marcada ? ' marcada' : ''}`
  );
  celula.append(cadeado(gema));
  if (gema.ativa) {
    const selo = imagem('icon-socketed', 12, 'gemas-celula-encaixada');
    selo.title = 'Encaixada';
    celula.append(selo);
  }
  const topo = el('div', 'gemas-celula-pedra');
  topo.append(desenhoDaGema(view, gema.dominio, gema.qualidade, 1));
  celula.append(topo);
  const mods = el('div', 'gemas-celula-mods');
  for (const mod of gema.modificadores) {
    const icone = iconeDoModificador(mod, 0.8);
    if (gema.ativa && !mod.aceso) icone.classList.add('apagado');
    mods.append(icone);
  }
  celula.append(mods);
  if (escolhendo) {
    const marca = el('i', 'gemas-marca', marcada ? '✓' : '');
    celula.append(marca);
  }
  tipPanel(celula, () => balaoDaGema(gema, view));
  celula.onclick = () => {
    if (escolhendo) {
      if (gema.trancada) return;
      if (selecionadas.has(gema.id)) selecionadas.delete(gema.id);
      else selecionadas.add(gema.id);
    } else gemaEscolhida = gema.id;
    ctx.redraw?.();
    // No telefone o detalhe fica ACIMA da grade: tocar numa gema leva até ele.
    if (!escolhendo && ehTelefone()) {
      requestAnimationFrame(() => document.querySelector('#modal .gemas-detalhe')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    }
  };
  return celula;
}

/** As reveladas que passam no filtro, na ordem da tela. */
function gemasFiltradas(view) {
  const busca = filtro.busca.trim().toLowerCase();
  return [...view.lista]
    .filter((g) => !filtro.dominio || g.dominio === filtro.dominio)
    .filter((g) => !filtro.qualidade || g.qualidade === filtro.qualidade)
    .filter((g) => !filtro.trancadas || g.trancada)
    .filter((g) => !busca || g.modificadores.some((m) => `${m.nome} ${m.texto}`.toLowerCase().includes(busca)))
    .sort((a, b) => Number(b.ativa) - Number(a.ativa) || b.id - a.id);
}

function seletor(rotulo, valor, opcoes, mudar) {
  const caixa = el('select', 'gemas-filtro-campo');
  caixa.title = rotulo;
  for (const [v, texto] of opcoes) caixa.append(new Option(texto, v));
  caixa.value = valor;
  caixa.onchange = () => mudar(caixa.value);
  return caixa;
}

function campoDeBusca(valor, placeholder, mudar, classe) {
  const busca = el('input', `gemas-filtro-busca ${classe}`);
  busca.type = 'search';
  busca.placeholder = placeholder;
  busca.value = valor;
  /* Só redesenha depois de parar de digitar: refazer a janela a cada tecla tira o foco da caixa. */
  let espera = 0;
  busca.oninput = () => {
    clearTimeout(espera);
    espera = setTimeout(() => {
      mudar(busca.value);
      ctx.redraw?.();
      const nova = document.querySelector(`.${classe}`);
      if (nova) {
        nova.focus();
        nova.setSelectionRange(nova.value.length, nova.value.length);
      }
    }, 350);
  };
  return busca;
}

function barraDoFiltro(view, visiveis) {
  const barra = el('div', 'gemas-filtro');
  const redesenhar = () => ctx.redraw?.();
  barra.append(
    campoDeBusca(filtro.busca, 'Buscar modificador (vida, gelo, crítico...)', (v) => (filtro.busca = v), 'busca-das-gemas'),
    seletor('Domínio', filtro.dominio, [['', 'Todos os domínios'], ['verde', 'Verde'], ['vermelho', 'Vermelho'], ['azul', 'Azul'], ['roxo', 'Roxo']], (v) => {
      filtro.dominio = v;
      redesenhar();
    }),
    seletor('Tamanho', filtro.qualidade, [['', 'Todos os tamanhos'], ['lesser', 'Lesser'], ['regular', 'Regular'], ['greater', 'Greater']], (v) => {
      filtro.qualidade = v;
      redesenhar();
    })
  );
  const soTrancadas = el('label', 'gemas-filtro-check');
  const check = el('input');
  check.type = 'checkbox';
  check.checked = filtro.trancadas;
  check.onchange = () => {
    filtro.trancadas = check.checked;
    redesenhar();
  };
  soTrancadas.append(check, imagem('icon-locked', 8, '', 12), el('span', null, 'Só trancadas'));
  barra.append(soTrancadas, el('span', 'gemas-filtro-conta', `${visiveis.length} de ${view.lista.length} gemas`));

  const lote = el('div', 'gemas-lote');
  if (!escolhendo) {
    lote.append(
      botao('Destruir várias...', 'ghost perigo', () => {
        escolhendo = true;
        selecionadas.clear();
        redesenhar();
      }, !view.pode || !view.lista.length)
    );
  } else {
    const podem = visiveis.filter((g) => !g.trancada && !g.ativa);
    lote.append(
      el('span', 'gemas-lote-conta', `${selecionadas.size} marcada${selecionadas.size === 1 ? '' : 's'}`),
      botao(`Marcar as ${podem.length} do filtro`, 'ghost', () => {
        for (const g of podem) selecionadas.add(g.id);
        redesenhar();
      }, !podem.length, 'Trancadas e encaixadas ficam de fora'),
      botao('Desmarcar', 'ghost', () => {
        selecionadas.clear();
        redesenhar();
      }, !selecionadas.size),
      botao(`Destruir ${selecionadas.size}`, 'primary gemas-perigo', () => confirmarDestruirVarias(view), !selecionadas.size),
      botao('Cancelar', 'ghost', () => {
        escolhendo = false;
        selecionadas.clear();
        redesenhar();
      })
    );
  }
  barra.append(lote);
  return barra;
}

/* ============================================================ Encaixes */

function renderEncaixes(body, view) {
  body.append(
    el(
      'p',
      'gemas-legenda',
      'Cada domínio aceita uma gema. Os vessels enchem com a árvore de habilidades: 1 vessel acende o primeiro modificador, 2 o segundo (Regular e Greater) e 3 o supremo (só Greater).'
    )
  );
  const palco = el('div', 'gemas-palco');
  const centro = el('div', 'gemas-cruz');
  centro.append(imagem('socket-gematelier', 228, 'gemas-cruz-arte'));
  for (const dominio of ['verde', 'vermelho', 'azul', 'roxo']) {
    const gema = view.lista.find((g) => g.id === view.ativas?.[dominio]);
    const vaga = el('div', `gemas-cruz-vaga pos-${dominio}${gema ? ' cheia' : ''}`);
    if (gema) {
      vaga.append(desenhoDaGema(view, dominio, gema.qualidade, 1.75));
      tipPanel(vaga, () => balaoDaGema(gema, view));
    }
    centro.append(vaga);
  }

  const caixas = {};
  for (const dominio of ['verde', 'vermelho', 'azul', 'roxo']) {
    const caixa = el('div', `gemas-dominio dominio-${dominio}`);
    const cheios = view.vessels?.[dominio] ?? 0;
    const cabeca = el('div', 'gemas-dominio-cabeca');
    const nome = el('div', 'gemas-dominio-nome');
    nome.append(simboloDoDominio(dominio, 1), el('b', null, NOME_DO_DOMINIO[dominio]));
    cabeca.append(nome, el('em', null, view.vessels?.nomes?.[dominio] ?? ''));
    caixa.append(cabeca);
    const linhaDosVessels = el('div', 'gemas-vessels');
    view.marcas.forEach((marca, i) => {
      const arte = i === 2 ? 'icon-skillwheel-vesselresonance-supreme' : 'icon-skillwheel-vesselresonance-basic';
      const v = imagem(arte, 20, `gemas-vessel${i < cheios ? ' cheio' : ''}`);
      v.title = `Vessel ${i + 1}: ${Math.round(marca * 100)}% ${dominio === 'verde' ? 'da árvore' : 'da via'}${i < cheios ? ' — cheio' : ''}`;
      linhaDosVessels.append(v);
    });
    const fracao = Math.round((view.vessels?.fracao?.[dominio] ?? 0) * 100);
    const barra = el('div', 'gemas-barra');
    const cheio = el('i');
    cheio.style.width = `${Math.min(100, fracao)}%`;
    barra.append(cheio);
    for (const marca of view.marcas) {
      const risco = el('b');
      risco.style.left = `${marca * 100}%`;
      barra.append(risco);
    }
    linhaDosVessels.append(barra, el('span', 'gemas-vessel-texto', `${fracao}%`));
    caixa.append(linhaDosVessels);
    const gema = view.lista.find((g) => g.id === view.ativas?.[dominio]);
    if (gema) {
      const resumo = el('div', 'gemas-dominio-gema');
      resumo.append(desenhoDaGema(view, dominio, gema.qualidade, 1.25));
      const mods = el('div', 'gemas-dominio-mods');
      for (const mod of gema.modificadores) {
        const l = el('div', `gemas-dominio-mod${mod.aceso ? ' aceso' : ' apagado'}`);
        l.append(iconeDoModificador(mod, 0.6), partesComIcone(mod.partes));
        mods.append(l);
      }
      resumo.append(mods);
      tipPanel(resumo, () => balaoDaGema(gema, view));
      caixa.append(resumo);
    } else caixa.append(el('p', 'empty', 'Nenhuma gema encaixada.'));
    const opcoes = view.lista.filter((g) => g.dominio === dominio && !g.ativa);
    if (opcoes.length) {
      const trocar = el('select', 'gemas-escolha');
      trocar.append(new Option(gema ? 'Trocar por...' : 'Encaixar...', ''));
      for (const g of opcoes) trocar.append(new Option(`${NOME_DA_QUALIDADE[g.qualidade]} — ${g.modificadores.map((m) => m.nome).join(', ')}`, String(g.id)));
      trocar.onchange = () => trocar.value && pedir('encaixar', { id: Number(trocar.value) });
      trocar.disabled = !view.pode;
      caixa.append(trocar);
    } else if (gema) {
      caixa.append(botao('Tirar do vessel', 'ghost', () => pedir('encaixar', { id: gema.id }), !view.pode));
    }
    caixas[dominio] = caixa;
  }
  const esquerda = el('div', 'gemas-lado');
  esquerda.append(caixas.verde, caixas.azul);
  const direita = el('div', 'gemas-lado');
  direita.append(caixas.vermelho, caixas.roxo);
  palco.append(esquerda, centro, direita);
  body.append(palco);
}

/* ===================================================== Fragment Workshop */

/*
 * ---- O Fragment Workshop do client ----
 *
 * À esquerda, a escada do modificador escolhido: os quatro graus de cima (IV)
 * para baixo (I), cada um com o ícone na moldura daquele grau, o anel verde
 * (`backdrop_grades_circle_mid`) nos que já foram alcançados, a haste
 * (`backdrop_grades_line`) ligando um ao outro e o texto do que o grau dá. Embaixo,
 * o botão de aprimorar com o preço em ouro e fragmentos.
 *
 * À direita, a grade de ícones: quantas gemas suas têm cada modificador
 * aparece no canto (x N), como no client.
 */
function renderOficina(body, view) {
  const todos = [...view.oficina.basicos, ...view.oficina.supremos];
  const contagem = new Map();
  for (const gema of view.lista) for (const m of gema.modificadores) contagem.set(`${m.tipo}:${m.id}`, (contagem.get(`${m.tipo}:${m.id}`) ?? 0) + 1);
  const chaveDe = (mod) => `${mod.tipo}:${mod.id}`;
  const busca = oficina.busca.trim().toLowerCase();
  const visiveis = todos
    .filter((m) => oficina.tipo === 'todos' || (oficina.tipo === 'uso' ? contagem.has(chaveDe(m)) || m.grau > 0 : m.tipo === oficina.tipo))
    .filter((m) => !busca || `${m.nome} ${m.texto}`.toLowerCase().includes(busca))
    .sort((a, b) => (contagem.get(chaveDe(b)) ?? 0) - (contagem.get(chaveDe(a)) ?? 0) || b.grau - a.grau || Number(a.tipo === 'supremo') - Number(b.tipo === 'supremo'));
  if (!oficina.escolhido || !todos.some((m) => chaveDe(m) === oficina.escolhido)) oficina.escolhido = visiveis[0] ? chaveDe(visiveis[0]) : null;
  const escolhido = todos.find((m) => chaveDe(m) === oficina.escolhido);

  const grade = el('div', 'gemas-oficina-layout');
  grade.append(escadaDoModificador(escolhido, view));

  const direita = el('section', 'gemas-painel gemas-oficina-lista');
  const barra = el('div', 'gemas-filtro');
  barra.append(
    campoDeBusca(oficina.busca, 'Buscar modificador...', (v) => (oficina.busca = v), 'busca-da-oficina'),
    seletor('Mostrar', oficina.tipo, [['uso', 'Das minhas gemas'], ['todos', 'Todos'], ['basico', 'Básicos'], ['supremo', 'Supremos']], (v) => {
      oficina.tipo = v;
      ctx.redraw?.();
    }),
    el('span', 'gemas-filtro-conta', `${visiveis.length} modificadores`)
  );
  direita.append(barra);
  const celulas = el('div', 'gemas-oficina-grade');
  if (!visiveis.length) celulas.append(el('p', 'empty', oficina.tipo === 'uso' ? 'Suas gemas ainda não têm modificadores. Escolha "Todos" para ver a lista inteira.' : 'Nenhum modificador passa na busca.'));
  for (const mod of visiveis) {
    const chave = chaveDe(mod);
    const celula = el('div', `gemas-oficina-celula${chave === oficina.escolhido ? ' escolhida' : ''}${mod.grau >= 3 ? ' no-maximo' : ''}`);
    celula.append(iconeDoModificador(mod, 1));
    const n = contagem.get(chave);
    if (n) celula.append(el('span', 'gemas-oficina-conta', `x ${n}`));
    celula.append(el('span', 'gemas-oficina-grau', GRAUS[mod.grau]));
    tipPanel(celula, () => balaoDoModificador(mod));
    celula.onclick = () => {
      oficina.escolhido = chave;
      ctx.redraw?.();
    };
    celulas.append(celula);
  }
  direita.append(celulas);
  grade.append(direita);
  body.append(grade);
}

function escadaDoModificador(mod, view) {
  const painel = el('section', 'gemas-painel gemas-escada');
  painel.append(el('h5', 'gemas-painel-titulo', 'Aprimorar grau do modificador'));
  if (!mod) {
    painel.append(el('p', 'empty', 'Escolha um modificador na grade.'));
    return painel;
  }
  const chave = `${mod.tipo}:${mod.id}`;
  const subiu = grausVistos.has(chave) && grausVistos.get(chave) < mod.grau;
  grausVistos.set(chave, mod.grau);

  painel.append(el('b', 'gemas-escada-nome', mod.nome));
  const escada = el('div', 'gemas-escada-degraus');
  for (let g = 3; g >= 0; g--) {
    const alcancado = g <= mod.grau;
    const degrau = el('div', `gemas-degrau${alcancado ? ' alcancado' : ''}${g === mod.grau ? ' atual' : ''}${g === mod.grau + 1 ? ' proximo' : ''}`);
    const circulo = el('span', 'gemas-degrau-circulo');
    if (alcancado) circulo.append(imagem('backdrop_grades_circle_mid', 58, 'gemas-degrau-anel'));
    circulo.append(iconeDoModificador(mod, 0.9, g));
    if (g === mod.grau + 1) circulo.append(quadro('icons-modgrades-potential', 50, g, 0.9, 'gemas-selo-potencial'));
    if (subiu && g === mod.grau) {
      const brilho = el('i', 'gemas-brilho');
      brilho.style.backgroundImage = `url(${ARTE}/backdrop_grades_circle_mid_anim.png)`;
      circulo.append(brilho);
    }
    const texto = el('div', 'gemas-degrau-texto');
    texto.append(el('b', null, `Grau ${GRAUS[g]}`), partesComIcone(mod.porGrau?.[g] ?? []));
    degrau.append(circulo, texto);
    escada.append(degrau);
    if (g > 0) escada.append(el('i', `gemas-degrau-haste${g <= mod.grau ? ' alcancada' : ''}`));
  }
  painel.append(escada);

  const rodape2 = el('div', 'gemas-escada-rodape');
  if (mod.proximo) {
    const fragmentos = mod.tipo === 'basico' ? view.fragmentos.menor : view.fragmentos.maior;
    const gold = (ctx.state.character?.gold ?? 0) + (ctx.state.character?.bank ?? 0);
    const faltaFragmento = fragmentos < mod.proximo.fragmentos;
    const faltaOuro = gold < mod.proximo.ouro;
    rodape2.append(
      botao(`Aprimorar para ${GRAUS[mod.grau + 1]}`, faltaFragmento || faltaOuro ? 'ghost' : 'primary', () => pedir('melhorar', { tipo: mod.tipo, modId: mod.id }), !view.pode || faltaFragmento || faltaOuro)
    );
    const precoOuro = el('span', `gemas-preco-caixa${faltaOuro ? ' falta' : ''}`, curto(mod.proximo.ouro));
    precoOuro.append(itemCanvas(3031, 16));
    const precoFragmento = el('span', `gemas-preco-caixa${faltaFragmento ? ' falta' : ''}`, String(mod.proximo.fragmentos));
    precoFragmento.append(imagem(mod.tipo === 'basico' ? 'icon-fragments-lesser' : 'icon-fragments-greater', 14));
    precoFragmento.title = `Você tem ${fragmentos}`;
    rodape2.append(precoOuro, precoFragmento);
  } else {
    rodape2.append(imagem('icon-modgrade4', 16), el('span', 'gemas-maximo', 'Grau máximo'));
  }
  painel.append(rodape2);
  return painel;
}
