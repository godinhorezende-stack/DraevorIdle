// A BIBLIOTECA VISUAL da Engine: catálogo de TODOS os cadastros do jogo, com o sprite real em cada card, busca e
// filtros combináveis, grade ou lista, carregamento aos poucos (a paginação da API) e o painel de detalhes. Só
// leitura: os dados vêm de `admin/biblioteca.mjs` (`/api/mapas/_conteudo/biblioteca…`) — nada é copiado nem gravado.
// Também mora aqui a BUSCA GLOBAL (Ctrl+K), que procura em todas as categorias de uma vez.
import { el, icone, msg, copiar, botaoCopiar, cabecalho } from './editor-ui.mjs';
import { retrato, previa } from './editor-sprites.mjs';

const POR_PAGINA = 60;
const NAO = 'não cadastrado';
const RARIDADE = { comum: 'r-comum', incomum: 'r-incomum', raro: 'r-raro', 'épico': 'r-epico', 'lendário': 'r-lendario', 'mítico': 'r-mitico' };
const SITUACOES = [['', 'Todos'], ['sem-desenho', 'Sem sprite'], ['alerta', 'Com referência quebrada'], ['sem-uso', 'Sem uso']];
const ORDENS = [['nome', 'Nome'], ['nivel', 'Nível'], ['usos', 'Mais usados'], ['id', 'ID']];
/** Os nomes legíveis dos campos do detalhe (o que não está aqui aparece com a chave crua). */
const ROTULOS = {
  tipo: 'Tipo', descricao: 'Descrição', mapa: 'Mapa', nivel: 'Nível', monstros: 'Monstros', spawn: 'Spawn', dificuldade: 'Dificuldade', requisitos: 'Requisitos',
  cooldowns: 'Recarga', duracao: 'Duração', drops: 'Drops', recompensas: 'Recompensas', especiais: 'Especiais', sprite: 'Sprite', atributos: 'Atributos',
  resistencias: 'Resistências', habilidades: 'Habilidades', dano: 'Dano', arena: 'Arena', bossUnico: 'Boss único', raridade: 'Raridade', peso: 'Peso',
  empilhavel: 'Empilhável', compra: 'Compra', venda: 'Venda', npc: 'NPC', chanceBase: 'Chance base', arquivo: 'Arquivo', tamanhoBytes: 'Tamanho (bytes)',
  usadoPor: 'Usado por', observacao: 'Observação', encontros: 'Encontros', modelo: 'Modelo', tabela: 'Tabela', hp: 'Vida', exp: 'Experiência',
  armadura: 'Armadura', velocidade: 'Velocidade', raca: 'Raça', estrelas: 'Estrelas', chancePct: 'Chance %', item: 'Item', nome: 'Nome', key: 'Monstro',
  porMonstro: 'Por monstro', lootCount: 'Rolagens de loot', itensDaHunt: 'Itens da hunt', deEncontros: 'De encontros', doBoss: 'Do boss', itens: 'Itens',
  atual: 'Atual', campanha: 'Campanha', levelOriginal: 'Level original', acesso: 'Acesso', task: 'Task', horas: 'Horas', semEspera: 'Sem espera',
  naSalaMs: 'Tempo na sala (ms)', instancia: 'Instância', origem: 'Origem', largura: 'Largura', altura: 'Altura', partida: 'Partida', densidade: 'Densidade',
  forcaDosBichos: 'Força dos bichos', porAndar: 'Por andar', modo: 'Modo', versaoOnline: 'Versão online', escala: 'Escala', ato: 'Ato', exige: 'Exige',
  primeiraVitoria: 'Primeira vitória', bossDeAto: 'Boss de ato', naMao: 'Na mão', look: 'Look', lookItem: 'Look de item', cores: 'Cores', min: 'Mín', max: 'Máx',
};
const ESCONDIDOS = new Set(['id', 'nome', 'categoria', 'desenho', 'usadoEm', 'referenciasQuebradas']);
/** O que aparece primeiro no resumo (o resto segue na ordem do cadastro). */
const PRIMEIRO = ['descricao', 'monstros', 'atributos', 'nivel', 'habilidades', 'resistencias', 'drops', 'requisitos', 'recompensas', 'spawn'];
/** Números que são QUANTIDADE (ganham separador de milhar); coordenadas, ids e looks ficam crus. */
const QUANTIDADES = new Set(['hp', 'exp', 'compra', 'venda', 'tamanhoBytes', 'gold', 'moedasMedia', 'atual', 'facil', 'medio', 'dificil', 'naSalaMs', 'min', 'max', 'intervalo', 'peso']);

/**
 * Cria a Biblioteca. `api` é a da página (descarta leituras de uma tela que já saiu); `raiz()` é onde desenhar;
 * `irPara(aba, id)` leva a outra ferramenta (Atos, Fases, Bosses únicos) a partir do "onde é usado".
 */
export function criarBiblioteca({ api, raiz, irPara }) {
  const B = {
    categorias: [], categoria: 'monstros', q: '', tipo: '', raridade: '', situacao: '', nivelMin: '', nivelMax: '', ordem: '',
    vista: lerPreferencia('vista', 'grade'), itens: [], total: 0, tipos: [], raridades: [], temNivel: false, carregando: false, pedido: 0,
    detalhe: null, abaDoDetalhe: 'resumo',
  };
  const categoriaDe = (id) => B.categorias.find((c) => c.id === id);
  const ehDaBiblioteca = (cat) => !!categoriaDe(cat);

  // ------------------------------------------------------------------ dados

  const parametros = (deslocamento) =>
    new URLSearchParams({ categoria: B.categoria, q: B.q, tipo: B.tipo, raridade: B.raridade, situacao: B.situacao, nivelMin: B.nivelMin, nivelMax: B.nivelMax, ordem: B.ordem, limite: POR_PAGINA, deslocamento });

  /** Busca a primeira página (filtro mudou) ou a próxima (rolou até o fim). Respostas de um filtro antigo são ignoradas. */
  async function buscar({ mais = false } = {}) {
    if (mais && (B.carregando || B.itens.length >= B.total)) return;
    const meu = ++B.pedido;
    B.carregando = true;
    pintarContagem();
    const r = await api(`biblioteca/lista?${parametros(mais ? B.itens.length : 0)}`);
    if (meu !== B.pedido) return;
    B.carregando = false;
    if (r.ok === false) {
      msg(r.erros?.[0] ?? 'Não deu para buscar.', 'erro');
      return;
    }
    B.itens = mais ? [...B.itens, ...r.itens] : r.itens;
    B.total = r.total;
    B.tipos = r.tipos ?? [];
    B.raridades = r.raridades ?? [];
    B.temNivel = !!r.temNivel;
    if (mais) acrescentarCards(r.itens);
    else pintarResultados();
    pintarFiltrosDependentes();
  }

  async function abrir(categoria, id, aba = 'resumo') {
    if (categoria !== B.categoria) {
      // Veio de um link, do "onde é usado" ou da busca global: a lista passa a mostrar a categoria inteira (sem a busca antiga).
      B.categoria = categoria;
      B.q = '';
      limparFiltros();
      await buscar();
      pintarFiltros();
    }
    const d = await api(`biblioteca/detalhe?${new URLSearchParams({ categoria, id })}`);
    if (d.ok === false) return msg(d.erros?.[0] ?? 'Conteúdo não encontrado.', 'erro');
    B.detalhe = d;
    B.abaDoDetalhe = aba;
    history.replaceState(null, '', `#biblioteca/${categoria}/${encodeURIComponent(id)}`);
    marcarSelecionado();
    pintarDetalhe();
  }
  const limparFiltros = () => Object.assign(B, { tipo: '', raridade: '', situacao: '', nivelMin: '', nivelMax: '' });

  // ------------------------------------------------------------------ tela

  async function desenhar(resto = []) {
    if (!B.categorias.length) B.categorias = (await api('biblioteca')).categorias;
    const [cat, id] = resto;
    if (cat && ehDaBiblioteca(cat)) B.categoria = cat;
    raiz().replaceChildren(
      cabecalho('Biblioteca', 'Todos os cadastros do jogo, com o sprite real. Somente leitura — o que o cadastro não traz aparece como "não cadastrado".',
        el('div', { class: 'eng-alternar', role: 'group', 'aria-label': 'Vista' },
          el('button', { type: 'button', class: B.vista === 'grade' ? 'ativo' : '', onclick: () => trocarVista('grade') }, 'Grade'),
          el('button', { type: 'button', class: B.vista === 'lista' ? 'ativo' : '', onclick: () => trocarVista('lista') }, 'Lista'))),
      el('div', { class: 'bib-v' },
        el('aside', { class: 'bib-filtros', id: 'bib-filtros' }),
        el('section', { class: 'bib-resultados', id: 'bib-resultados' }, el('div', { class: 'bib-contagem', id: 'bib-contagem' }), el('div', { id: 'bib-cards' }), el('div', { id: 'bib-fim' })),
        el('aside', { class: 'bib-painel', id: 'bib-painel' })));
    pintarFiltros();
    pintarDetalhe();
    await buscar();
    vigiarFim();
    if (cat && id) await abrir(cat, decodeURIComponent(id));
  }

  function trocarVista(v) {
    B.vista = v;
    gravarPreferencia('vista', v);
    for (const b of document.querySelectorAll('.eng-alternar button')) b.classList.toggle('ativo', b.textContent.toLowerCase() === v);
    pintarResultados();
  }

  // ---- filtros
  const mudar = (chave, valor) => {
    B[chave] = valor;
    buscar();
  };
  const buscarDepois = (() => {
    let t;
    return (v) => {
      clearTimeout(t);
      t = setTimeout(() => mudar('q', v), 220);
    };
  })();

  function pintarFiltros() {
    const caixa = document.querySelector('#bib-filtros');
    if (!caixa) return;
    const busca = el('input', { type: 'search', id: 'bib-busca', placeholder: 'Nome ou ID…  ( / )', value: B.q, 'aria-label': 'Buscar na categoria', oninput: (e) => buscarDepois(e.target.value.trim()) });
    caixa.replaceChildren(
      el('div', { class: 'bib-busca' }, busca),
      el('div', { class: 'bib-grupo' }, el('div', { class: 'bib-rotulo' }, 'Categoria'),
        el('div', { class: 'bib-categorias' }, B.categorias.map((c) => el('button', { type: 'button', class: `bib-cat${c.id === B.categoria ? ' ativa' : ''}`, onclick: () => trocarCategoria(c.id) }, el('span', {}, c.nome), el('span', { class: 'bib-num' }, c.total.toLocaleString('pt-BR')))))),
      el('div', { id: 'bib-dependentes' }));
    pintarFiltrosDependentes();
  }
  /** Os filtros que dependem da categoria (tipos, raridades, nível): refeitos a cada busca. */
  function pintarFiltrosDependentes() {
    const caixa = document.querySelector('#bib-dependentes');
    if (!caixa) return;
    const selecao = (rotulo, chave, opcoes, vazio = 'Todos') => el('label', { class: 'campo' }, rotulo, el('select', { onchange: (e) => mudar(chave, e.target.value) }, el('option', { value: '' }, vazio), opcoes.map((o) => (Array.isArray(o) ? o : [o, o])).filter(([v]) => v !== '').map(([v, n]) => el('option', { value: v, selected: v === B[chave] }, n))));
    const numero = (rotulo, chave) => el('label', { class: 'campo' }, rotulo, el('input', { type: 'number', value: B[chave], min: 0, onchange: (e) => mudar(chave, e.target.value) }));
    const ativos = ['tipo', 'raridade', 'situacao', 'nivelMin', 'nivelMax'].filter((k) => B[k] !== '');
    caixa.replaceChildren(
      el('div', { class: 'bib-grupo' },
        B.tipos.length > 1 ? selecao('Tipo', 'tipo', B.tipos) : null,
        B.raridades.length ? selecao(B.categoria === 'itens' ? 'Raridade' : 'Classificação', 'raridade', B.raridades, 'Todas') : null,
        B.temNivel ? el('div', { class: 'bib-par' }, numero('Nível mín.', 'nivelMin'), numero('Nível máx.', 'nivelMax')) : null,
        selecao('Situação', 'situacao', SITUACOES.slice(1)),
        selecao('Ordenar por', 'ordem', ORDENS.filter(([v]) => v !== 'nome' && (v !== 'nivel' || B.temNivel)), 'Nome')),
      ...(ativos.length ? [el('button', { type: 'button', class: 'fantasma bib-limpar', onclick: () => { limparFiltros(); buscar(); pintarFiltros(); } }, `Limpar filtros (${ativos.length})`)] : []));
  }
  function trocarCategoria(id) {
    B.categoria = id;
    limparFiltros();
    B.detalhe = null;
    history.replaceState(null, '', `#biblioteca/${id}`);
    pintarFiltros();
    pintarDetalhe();
    buscar();
  }

  // ---- resultados
  function pintarContagem() {
    const c = document.querySelector('#bib-contagem');
    if (!c) return;
    const nome = categoriaDe(B.categoria)?.nome ?? B.categoria;
    c.replaceChildren(
      el('b', {}, nome),
      el('span', { class: 'dica' }, B.carregando && !B.itens.length ? 'buscando…' : `${B.total.toLocaleString('pt-BR')} resultado(s)${B.itens.length < B.total ? ` · mostrando ${B.itens.length}` : ''}`));
  }
  function pintarResultados() {
    pintarContagem();
    const caixa = document.querySelector('#bib-cards');
    if (!caixa) return;
    caixa.className = B.vista === 'grade' ? 'bib-grade' : 'bib-linhas';
    caixa.replaceChildren(...(B.itens.length ? B.itens.map(card) : [vazio()]));
    document.querySelector('#bib-resultados')?.scrollTo({ top: 0 });
    marcarSelecionado();
  }
  function acrescentarCards(novos) {
    pintarContagem();
    document.querySelector('#bib-cards')?.append(...novos.map(card));
    marcarSelecionado();
  }
  const vazio = () =>
    el('div', { class: 'bib-vazio' }, el('b', {}, 'Nada encontrado com esses filtros'), el('span', { class: 'dica' }, 'Tente outro nome ou limpe os filtros.'));

  /** Carregamento aos poucos: quando o fim da lista aparece, pede a próxima página da API. */
  function vigiarFim() {
    const fim = document.querySelector('#bib-fim');
    const area = document.querySelector('#bib-resultados');
    if (!fim || typeof IntersectionObserver !== 'function') return;
    new IntersectionObserver((e) => e[0].isIntersecting && buscar({ mais: true }), { root: area, rootMargin: '300px' }).observe(fim);
  }

  function selos(i) {
    return [
      i.tipo ? el('span', { class: 'selo' }, i.tipo) : null,
      i.nivel != null ? el('span', { class: 'selo' }, `nv ${i.nivel}`) : null,
      i.raridade ? el('span', { class: `selo ${RARIDADE[i.raridade] ?? ''}` }, i.raridade) : null,
      i.hp != null ? el('span', { class: 'selo vida' }, `${i.hp.toLocaleString('pt-BR')} hp`) : null,
      i.slot ? el('span', { class: 'selo' }, i.slot) : null,
      i.usos ? el('span', { class: 'selo usos', title: 'Onde é usado' }, `${i.usos} uso(s)`) : null,
      i.alertas ? el('span', { class: 'selo erro', title: 'Referência a item que não existe' }, `${i.alertas} alerta(s)`) : null,
      !i.desenho && ['monstros', 'itens', 'bosses'].includes(i.categoria) ? el('span', { class: 'selo aviso' }, 'sem sprite') : null,
    ];
  }
  function card(i) {
    const grade = B.vista === 'grade';
    const acoes = el('div', { class: 'eng-card-acoes' },
      el('button', { type: 'button', title: 'Ver detalhes', onclick: (e) => { e.stopPropagation(); abrir(i.categoria, i.id); } }, 'Ver'),
      el('button', { type: 'button', title: `Copiar o ID ${i.id}`, onclick: (e) => { e.stopPropagation(); copiar(i.id); } }, 'Copiar ID'),
      el('button', { type: 'button', title: 'Onde é usado', onclick: (e) => { e.stopPropagation(); abrir(i.categoria, i.id, 'usos'); } }, 'Usos'));
    return el('div', {
      class: `eng-card${grade ? '' : ' em-linha'}`, tabindex: 0, role: 'button', 'data-id': i.id, 'aria-label': `${i.nome ?? i.id} (${i.id})`,
      onclick: () => abrir(i.categoria, i.id),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(i.categoria, i.id); } },
    },
    el('div', { class: 'eng-card-arte' }, retrato(i.desenho, grade ? 72 : 36, { categoria: i.categoria, rotulo: i.nome })),
    el('div', { class: 'eng-card-info' },
      el('b', { class: 'eng-card-nome' }, i.nome ?? NAO),
      el('span', { class: 'eng-id' }, i.id),
      el('div', { class: 'eng-card-selos' }, selos(i))),
    acoes);
  }
  function marcarSelecionado() {
    for (const c of document.querySelectorAll('#bib-cards .eng-card')) c.classList.toggle('selecionado', B.detalhe?.categoria === B.categoria && c.dataset.id === String(B.detalhe?.id));
  }

  // ---- detalhe
  function pintarDetalhe() {
    const caixa = document.querySelector('#bib-painel');
    if (!caixa) return;
    const d = B.detalhe;
    if (!d) {
      caixa.replaceChildren(el('div', { class: 'bib-painel-vazio' }, icone('livros'), el('b', {}, 'Selecione um conteúdo'), el('span', { class: 'dica' }, 'Clique num card para ver sprite, atributos, drops e onde ele é usado. Ctrl+K busca em todas as categorias.')));
      return;
    }
    const quebrados = d.referenciasQuebradas?.itens ?? [];
    const abas = [['resumo', 'Resumo'], ['usos', `Usos (${d.usadoEm?.length ?? 0})`], ['json', 'JSON']];
    caixa.replaceChildren(
      el('div', { class: 'bib-painel-topo' },
        previa(d.desenho, { categoria: d.categoria }),
        el('div', { class: 'bib-painel-titulo' },
          el('h2', { class: 'bib-nome' }, d.nome ?? NAO),
          el('div', { class: 'linha' }, el('span', { class: 'eng-id', style: 'flex:none' }, `${d.categoria}:${d.id}`), botaoCopiar(d.id, `o ID ${d.id}`), botaoCopiar(`${d.categoria}:${d.id}`, 'a referência'), el('span')),
          el('div', { class: 'eng-card-selos' }, d.tipo ? el('span', { class: 'selo' }, d.tipo) : null, d.raridade ? el('span', { class: `selo ${RARIDADE[d.raridade] ?? ''}` }, d.raridade) : null),
          quebrados.length ? el('div', { class: 'bib-alerta' }, `Referência a ${quebrados.length} item(ns) que não existem no catálogo: ${quebrados.join(', ')}`) : null)),
      el('div', { class: 'eng-abas', role: 'tablist' }, abas.map(([id, nome]) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(B.abaDoDetalhe === id), class: B.abaDoDetalhe === id ? 'ativa' : '', onclick: () => { B.abaDoDetalhe = id; pintarDetalhe(); } }, nome))),
      el('div', { class: 'bib-painel-corpo' }, B.abaDoDetalhe === 'usos' ? blocoDeUsos(d) : B.abaDoDetalhe === 'json' ? blocoJson(d) : blocoResumo(d)));
  }

  function blocoDeUsos(d) {
    const usos = d.usadoEm ?? [];
    if (!usos.length) return el('p', { class: 'dica' }, 'Nenhuma referência encontrada nos cadastros (hunts, loot dos monstros, encontros, campanha e bosses únicos).');
    return el('div', { class: 'bib-usos' }, usos.map((u) => {
      const destino = ehDaBiblioteca(u.categoria) ? () => abrir(u.categoria, u.id) : u.categoria === 'atos' ? () => irPara('atos') : u.categoria === 'encontros' ? () => irPara('fase', u.id) : u.categoria === 'bosses-unicos' ? () => irPara('bosses') : null;
      return el(destino ? 'button' : 'div', { type: destino ? 'button' : null, class: 'bib-uso', onclick: destino }, el('span', { class: 'selo' }, categoriaDe(u.categoria)?.nome ?? u.categoria), el('b', {}, u.nome), el('span', { class: 'dica' }, u.como));
    }));
  }
  function blocoJson(d) {
    const { desenho, usadoEm, ...dados } = d;
    void desenho;
    void usadoEm;
    const texto = JSON.stringify(dados, null, 2);
    return el('div', { class: 'eng-json' }, el('div', { class: 'eng-json-barra' }, el('span', { class: 'dica' }, 'Somente leitura: o cadastro como o servidor o entrega.'), el('button', { type: 'button', onclick: () => copiar(texto, 'o JSON') }, 'Copiar JSON')), el('pre', { class: 'bib-json' }, texto));
  }

  // O resumo legível: cada campo do detalhe vira um bloco; listas de objetos viram tabela (com o ícone do item ou o
  // retrato do monstro quando a coluna é uma referência); nada de JSON cru em linha.
  function blocoResumo(d) {
    const blocos = [];
    const ordem = (k) => (PRIMEIRO.includes(k) ? PRIMEIRO.indexOf(k) : PRIMEIRO.length);
    for (const [k, v] of Object.entries(d).sort(([a], [b]) => ordem(a) - ordem(b))) {
      if (ESCONDIDOS.has(k) || (k === 'tipo' && typeof v === 'string') || k === 'raridade') continue;
      blocos.push(el('section', { class: 'bib-sec' }, el('h4', {}, ROTULOS[k] ?? k), valor(v, k)));
    }
    return blocos.length ? blocos : el('p', { class: 'dica' }, 'Sem mais dados no cadastro.');
  }
  function valor(v, chave = '') {
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return el('span', { class: 'nao' }, NAO);
    if (Array.isArray(v)) {
      if (chave === 'monstros' && v.every((m) => m && typeof m === 'object' && 'key' in m)) return gradeDeMonstros(v);
      if (v.every((x) => x && typeof x === 'object' && !Array.isArray(x))) return tabela(v);
      return el('span', {}, v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', '));
    }
    if (typeof v === 'object') {
      const pares = Object.entries(v);
      return el('dl', { class: 'bib-dl' }, pares.map(([k2, v2]) => [el('dt', {}, ROTULOS[k2] ?? k2), el('dd', {}, valor(v2, k2))]));
    }
    if (typeof v === 'boolean') return el('span', {}, v ? 'sim' : 'não');
    if (typeof v === 'number') return el('span', { class: 'num' }, QUANTIDADES.has(chave) ? v.toLocaleString('pt-BR') : String(v));
    return el('span', {}, String(v));
  }
  function gradeDeMonstros(lista) {
    return el('div', { class: 'bib-monstros' }, lista.map((m) => el('button', { type: 'button', class: 'bib-monstro', title: m.key, onclick: () => (m.nome ? abrir('monstros', m.key) : null) },
      retrato(m.desenho, 40, { categoria: 'monstros' }),
      el('span', {}, m.nome ?? m.key),
      m.hp != null ? el('span', { class: 'dica' }, `${m.hp.toLocaleString('pt-BR')} hp`) : null)));
  }
  function tabela(linhas) {
    const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))].filter((c) => !['desenho', 'look'].includes(c));
    return el('div', { class: 'bib-tabela' }, el('table', {},
      el('thead', {}, el('tr', {}, colunas.map((c) => el('th', {}, ROTULOS[c] ?? c)))),
      el('tbody', {}, linhas.slice(0, 300).map((l) => el('tr', {}, colunas.map((c) => el('td', {}, celula(c, l[c], l))))))),
      linhas.length > 300 ? el('div', { class: 'dica' }, `Mostrando 300 de ${linhas.length}.`) : null);
  }
  function celula(coluna, v, linha) {
    if (v == null) return el('span', { class: 'nao' }, '—');
    if (coluna === 'item' && (typeof v === 'number' || /^\d+$/.test(String(v)))) {
      return el('button', { type: 'button', class: 'bib-ref', title: `Abrir o item ${v}`, onclick: () => abrir('itens', String(v)) }, retrato({ tipo: 'item', id: Number(v) }, 24, { categoria: 'itens' }), el('span', { class: 'eng-id' }, String(v)));
    }
    if (coluna === 'chancePct' && typeof v === 'number') return el('span', { class: 'num' }, `${v}%`);
    if (coluna === 'key' && linha?.nome !== undefined) return el('button', { type: 'button', class: 'bib-ref', onclick: () => abrir('monstros', v) }, String(v));
    if (typeof v === 'object') return el('span', { class: 'mono' }, JSON.stringify(v));
    if (typeof v === 'number') return el('span', { class: 'num' }, QUANTIDADES.has(coluna) ? v.toLocaleString('pt-BR') : String(v));
    return String(v);
  }

  // ------------------------------------------------------------------ busca global (Ctrl+K)

  let paleta = null;
  async function buscaGlobal() {
    if (paleta) return paleta.querySelector('input').focus();
    if (!B.categorias.length) B.categorias = (await api('biblioteca')).categorias;
    const entrada = el('input', { type: 'search', placeholder: 'Buscar em todos os cadastros: nome ou ID…', 'aria-label': 'Busca global', spellcheck: 'false' });
    const lista = el('div', { class: 'eng-paleta-lista', role: 'listbox' });
    let resultados = [];
    let ativo = 0;
    let vez = 0;
    const pintarLista = () => {
      lista.replaceChildren(...(resultados.length
        ? resultados.map((r, i) => el('div', { class: `eng-paleta-item${i === ativo ? ' ativo' : ''}`, role: 'option', 'aria-selected': String(i === ativo), onclick: () => escolher(i), onmousemove: () => { if (ativo !== i) { ativo = i; pintarLista(); } } },
            retrato(r.desenho, 32, { categoria: r.categoria }), el('div', {}, el('b', {}, r.nome ?? r.id), el('span', { class: 'eng-id' }, ` ${r.id}`)), el('span', { class: 'selo' }, categoriaDe(r.categoria)?.nome ?? r.categoria)))
        : [el('div', { class: 'dica', style: 'padding:14px' }, entrada.value.trim().length < 2 ? 'Digite pelo menos 2 letras. Enter abre; ↑↓ escolhe; Esc fecha.' : 'Nada encontrado.')]));
      lista.querySelector('.ativo')?.scrollIntoView({ block: 'nearest' });
    };
    const procurar = async () => {
      const q = entrada.value.trim();
      const minha = ++vez;
      if (q.length < 2) {
        resultados = [];
        return pintarLista();
      }
      const cats = B.categorias.filter((c) => c.total > 0 && c.id !== 'drops').map((c) => c.id);
      const rs = await Promise.all(cats.map((c) => api(`biblioteca/lista?${new URLSearchParams({ categoria: c, q, limite: 6, ordem: 'usos' })}`).catch(() => null)));
      if (minha !== vez) return;
      resultados = rs.flatMap((r) => r?.itens ?? []).sort((a, b) => peso(a, q) - peso(b, q)).slice(0, 40);
      ativo = 0;
      pintarLista();
    };
    let t;
    entrada.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(procurar, 180);
    });
    entrada.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        ativo = Math.max(0, Math.min(resultados.length - 1, ativo + (e.key === 'ArrowDown' ? 1 : -1)));
        pintarLista();
      } else if (e.key === 'Enter' && resultados[ativo]) {
        e.preventDefault();
        escolher(ativo);
      }
    });
    const escolher = async (i) => {
      const r = resultados[i];
      fechar();
      // Já na Biblioteca: só abre o detalhe (sem redesenhar a tela e perder os filtros).
      if (document.querySelector('#bib-painel')) await abrir(r.categoria, r.id);
      else await irPara('biblioteca', null, [r.categoria, r.id]);
    };
    const fechar = () => {
      paleta?.close();
    };
    paleta = el('dialog', { class: 'eng-modal eng-paleta', 'aria-label': 'Busca global' }, el('div', { class: 'eng-paleta-busca' }, entrada), lista);
    paleta.addEventListener('close', () => {
      paleta.remove();
      paleta = null;
    });
    document.body.append(paleta);
    paleta.showModal();
    pintarLista();
    entrada.focus();
  }

  return { desenhar, abrir, buscaGlobal, focarBusca: () => document.querySelector('#bib-busca')?.focus() };
}

/** Ordem da busca global: nome exato, depois começa com, depois contém; empate pelos mais usados. */
function peso(r, q) {
  const n = String(r.nome ?? '').toLowerCase();
  const t = q.toLowerCase();
  const base = n === t || String(r.id) === t ? 0 : n.startsWith(t) ? 1 : 2;
  return base * 1e6 - (r.usos ?? 0);
}

function lerPreferencia(chave, padrao) {
  try {
    return localStorage.getItem(`engine:${chave}`) ?? padrao;
  } catch {
    return padrao;
  }
}
function gravarPreferencia(chave, valor) {
  try {
    localStorage.setItem(`engine:${chave}`, valor);
  } catch {
    /* sem armazenamento: só não lembra a vista */
  }
}
