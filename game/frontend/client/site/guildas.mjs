/* =========================================================================
 * AS GUILDAS NO SITE
 *
 * "ao lado de online tem que ter uma nova aba chamada guilds; ao clicar vai pra
 *  aba de guilds mostrando todas as guilds do servidor: nome, emblema, nome do
 *  líder e etc. E ao clicar mostra informações como membros, pontos, level da
 *  guild, e já mostra os addons, level e vocação dos membros também, com ícone
 *  das vocações e o símbolo se tá online ou não."
 *
 * ---- DUAS TELAS, UMA PÁGINA ----
 *
 * A lista e a ficha de uma guilda moram no mesmo HTML e trocam pelo endereço:
 * `/guildas` mostra a lista, `/guildas?nome=Os%20Bravos` mostra a ficha. Duas
 * páginas dariam dois cabeçalhos, dois rodapés e duas cópias do menu para
 * manter iguais — e a segunda só existiria para uma tabela a mais.
 *
 * O endereço carrega o estado de propósito: assim um link para uma guilda pode
 * ser colado no Discord e abre na guilda certa, e o botão "voltar" do navegador
 * faz o que se espera.
 *
 * ---- OS BONECOS SÃO OS DO JOGO ----
 *
 * `outfitCanvas` é o mesmo desenhista da cidade e da janela de guildas, com
 * addons e montaria. Um retrato genérico aqui faria a lista de membros parecer
 * uma planilha; com o boneco, ela parece a guilda.
 * ========================================================================= */
import { loadSpriteData, outfitCanvas } from '/client/src/sprites.mjs';
import { seloDaGuilda } from '/client/site/brasao-no-site.mjs';
import { desenharBrasao, vestirNomeDaGuilda } from '/packages/shared/src/desenhar-brasao.mjs';
/*
 * A ORDEM da tabela e o texto que a explica vem do mesmo arquivo que o servidor
 * usa para ordenar e que a janela do jogo usa para redesenhar — "mesmo critério
 * no jogo e no site". Ver o cabecalho de `ordem-das-guildas.mjs`.
 */
import { ordenarGuildas, CRITERIO_DA_ORDEM } from '/packages/shared/src/ordem-das-guildas.mjs';
import { fonteDoBrasao } from '/packages/shared/src/brasao-de-guilda.mjs';

const $ = (id) => document.getElementById(id);
const numero = (v) => Number(v ?? 0).toLocaleString('pt-BR');

const VOCACOES = {
  knight: 'Knight',
  'elite knight': 'Elite Knight',
  paladin: 'Paladin',
  'royal paladin': 'Royal Paladin',
  druid: 'Druid',
  'elder druid': 'Elder Druid',
  sorcerer: 'Sorcerer',
  'master sorcerer': 'Master Sorcerer',
  monk: 'Monk',
  none: 'Sem vocação',
};

/*
 * O ícone é indexado pela vocação BASE (são cinco), e o personagem guarda a
 * promovida. Sem esta tradução, todo mundo promovido — que é justamente quem
 * está numa guilda — cairia no genérico.
 */
const FAMILIA = ['knight', 'paladin', 'sorcerer', 'druid', 'monk'];
const familiaDe = (v) => FAMILIA.find((base) => String(v ?? '').toLowerCase().includes(base)) ?? null;

const sprites = loadSpriteData().then(() => true).catch(() => false);

/** "há 3 dias" — a idade de uma guilda não se lê em data. */
function desdeQuando(ts) {
  const dias = Math.floor((Date.now() - (ts ?? 0)) / 86_400_000);
  if (dias < 1) return 'fundada hoje';
  if (dias === 1) return 'fundada ontem';
  if (dias < 30) return `fundada há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'fundada há 1 mês' : `fundada há ${meses} meses`;
}

const linkDaGuilda = (nome) => `/guildas?nome=${encodeURIComponent(nome)}`;
const linkDoChar = (nome) => `/personagem?nome=${encodeURIComponent(nome)}`;

/** Uma célula de tabela, para as três tabelas desta página saírem iguais. */
function celula(classe, ...dentro) {
  const td = document.createElement('td');
  if (classe) td.className = classe;
  td.append(...dentro.filter(Boolean));
  return td;
}

function vazio(corpo, texto, colunas = 5) {
  corpo.innerHTML = '';
  const linha = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = colunas;
  td.className = 'vazio';
  td.textContent = texto;
  linha.append(td);
  corpo.append(linha);
}

/* =========================================================================
 * A LISTA
 * ========================================================================= */
function pintarLista(lista) {
  /*
   * A lista chega ordenada do servidor e e' reordenada aqui pelo MESMO criterio —
   * a pagina numera as linhas, e uma pagina que numera tem de poder responder
   * pela numeracao sozinha.
   */
  const guildas = ordenarGuildas(lista);
  const corpo = $('lista-guildas');
  /*
   * O criterio explicado onde a ordem e' afirmada: no cabecalho da coluna de
   * pontos, que e' a unica das quatro chaves da ordenacao que aparece na tabela.
   * Quem estranhar duas guildas de zero ponto em ordens diferentes passa o mouse
   * ali e le' a regra inteira, que vem do mesmo arquivo que ORDENA.
   */
  const cabecaPontos = corpo.closest('table')?.querySelector('thead .num:last-child');
  if (cabecaPontos) cabecaPontos.title = CRITERIO_DA_ORDEM;
  $('quantas').textContent = numero(guildas.length);
  $('quantas-rotulo').textContent = guildas.length === 1 ? 'guilda' : 'guildas';

  if (!guildas.length) return vazio(corpo, 'nenhuma guilda fundada ainda — funde a primeira');

  corpo.innerHTML = '';
  guildas.forEach((g, i) => {
    const linha = document.createElement('tr');
    if (i === 0) linha.className = 'top1';

    /*
     * O escudo numa coluna própria, e maior que o da tabela do ranking: aqui a
     * guilda é o assunto da página, e não um detalhe ao lado de um nome.
     */
    const escudo = celula('brasao-col');
    /* "inclusive na aba de guilds do site" — a mesma medida da tabela do jogo. */
    escudo.append(desenharBrasao(document, g.nome, 46, g.brasao ?? null));

    const nome = celula('nome');
    const link = document.createElement('a');
    link.className = 'link-personagem';
    link.href = linkDaGuilda(g.nome);
    link.textContent = g.nome;
    /* A mesma fonte da ficha e do escudo — ver `vestirNomeDaGuilda`. */
    vestirNomeDaGuilda(link, g.brasao ?? null);
    nome.append(link);
    const idade = document.createElement('div');
    idade.className = 'guilda-idade';
    idade.textContent = desdeQuando(g.criadaEm);
    nome.append(idade);

    const dono = celula('vocacao');
    const linkDono = document.createElement('a');
    linkDono.className = 'link-personagem';
    linkDono.href = linkDoChar(g.dono);
    linkDono.textContent = g.dono;
    dono.append(linkDono);

    linha.append(escudo, nome, dono, celula('num', document.createTextNode(numero(g.membros))));
    linha.append(celula('num', document.createTextNode(numero(g.pontos))));
    corpo.append(linha);
  });
}

/* =========================================================================
 * A FICHA DE UMA GUILDA
 * ========================================================================= */
async function pintarFicha(g) {
  const cabeca = $('guilda-cabeca');
  cabeca.innerHTML = '';

  const escudo = document.createElement('div');
  escudo.className = 'guilda-cabeca-escudo';
  /* Na pagina da guilda o brasao e' o retrato dela: e' o maior do site. */
  escudo.append(desenharBrasao(document, g.nome, 104, g.brasao ?? null));
  cabeca.append(escudo);

  const texto = document.createElement('div');
  texto.className = 'guilda-cabeca-texto';
  const h2 = document.createElement('h2');
  h2.textContent = g.nome;
  /*
   * ---- O NOME NA LETRA QUE A GUILDA ESCOLHEU ----
   *
   * A mesma família das iniciais do escudo, e a mesma da janela do jogo — quem
   * responde é `fonteDoBrasao`, no catálogo, e não uma tabela escrita aqui. Duas
   * respostas seriam dois nomes com cara diferente para a mesma guilda, que é
   * exatamente o que este arquivo compartilhado existe para impedir.
   *
   * Só aqui, na página DELA. Na tabela de guildas o nome fica na letra de sempre:
   * vinte linhas em seis fontes diferentes deixariam de ser uma tabela.
   */
  vestirNomeDaGuilda(h2, g.brasao ?? null);
  texto.append(h2);

  const sub = document.createElement('p');
  sub.className = 'legenda';
  sub.textContent = `${desdeQuando(g.criadaEm)} · líder ${g.dono}`;
  texto.append(sub);

  /*
   * Os números como chips, e não como frases: são quatro respostas curtas a
   * quatro perguntas diferentes, e numa frase só elas viram um parágrafo que
   * ninguém lê até o fim.
   */
  const chips = document.createElement('div');
  chips.className = 'guilda-chips';
  const chip = (rotulo, valor) => {
    const c = document.createElement('span');
    c.className = 'guilda-chip';
    const b = document.createElement('b');
    b.textContent = valor;
    c.append(b, document.createTextNode(rotulo));
    chips.append(c);
  };
  chip('nível', `${g.nivel?.nivel ?? 1}`);
  chip('membros', `${g.membros.length}/${g.nivel?.vagas ?? g.membros.length}`);
  chip('pontos', numero(g.pontos));
  chip('online', String(g.membros.filter((m) => m.online).length));
  texto.append(chips);

  if (g.recado) {
    const recado = document.createElement('p');
    recado.className = 'guilda-recado-site';
    recado.textContent = g.recado;
    texto.append(recado);
  }
  cabeca.append(texto);

  /* ---- os membros ---- */
  const corpo = $('lista-membros');
  if (!g.membros.length) return vazio(corpo, 'esta guilda não tem ninguém');

  corpo.innerHTML = '';
  const desenhista = await sprites;
  for (const m of g.membros) {
    const linha = document.createElement('tr');

    const retrato = celula('retrato-col');
    if (desenhista && m.outfit?.type) {
      try {
        const boneco = outfitCanvas(m.outfit.type, m.outfit, 44);
        boneco.className = 'retrato';
        retrato.append(boneco);
      } catch {
        /* Outfit que a folha não conhece: a linha sai sem boneco em vez de a
           página inteira parar. O nome e o level continuam valendo. */
      }
    }

    const nome = celula('nome');
    const ponto = document.createElement('i');
    ponto.className = `ponto${m.online ? '' : ' off'}`;
    ponto.title = m.online ? 'online agora' : 'offline';
    const link = document.createElement('a');
    link.className = 'link-personagem';
    link.href = linkDoChar(m.nome);
    link.textContent = m.nome;
    nome.append(ponto, link);

    const posto = celula('vocacao');
    const selo = document.createElement('span');
    selo.className = `guilda-posto cargo-${m.cargo}`;
    selo.textContent = m.posto;
    posto.append(selo);

    const vocacao = celula('vocacao');
    const icone = familiaDe(m.vocation);
    if (icone) {
      const img = document.createElement('img');
      img.className = 'voc-icone';
      img.src = `/client/assets/icons/${icone}.png`;
      img.alt = '';
      vocacao.append(img);
    }
    vocacao.append(document.createTextNode(VOCACOES[m.vocation] ?? m.vocation ?? '—'));

    linha.append(retrato, nome, posto, vocacao, celula('num', document.createTextNode(numero(m.level))));
    corpo.append(linha);
  }
}

/* =========================================================================
 * QUAL DAS DUAS TELAS
 * ========================================================================= */
async function abrir() {
  const nome = new URLSearchParams(location.search).get('nome')?.trim() ?? '';
  const lista = $('tela-lista');
  const ficha = $('tela-ficha');

  if (!nome) {
    ficha.hidden = true;
    lista.hidden = false;
    try {
      const r = await fetch('/api/guildas', { cache: 'no-store' });
      if (!r.ok) return;
      pintarLista((await r.json()).guildas ?? []);
    } catch {
      vazio($('lista-guildas'), 'não deu para falar com o servidor agora');
    }
    return;
  }

  lista.hidden = true;
  ficha.hidden = false;
  document.title = `${nome} — Draevor Idle`;
  try {
    const r = await fetch(`/api/guilda?nome=${encodeURIComponent(nome)}`, { cache: 'no-store' });
    const d = await r.json();
    if (!d.ok) {
      $('guilda-cabeca').textContent = d.reason ?? 'essa guilda não existe';
      return vazio($('lista-membros'), '—');
    }
    await pintarFicha(d.guilda);
  } catch {
    vazio($('lista-membros'), 'não deu para falar com o servidor agora');
  }
}

abrir();
/*
 * Meio minuto. A lista de guildas muda devagar — uma guilda nova por dia é
 * muito —, e o que de fato se mexe é quem está online, que é a única coisa que
 * vale pedir de novo.
 */
setInterval(abrir, 30_000);
