// O EDITOR DE BOSSES ÚNICOS (`gamedata/bosses-unicos.json`): lista com o sprite da criatura-base, prévia grande com
// as habilidades, e o cadastro em abas — Identidade, Atributos, Combate, Comportamentos, Fases, Recompensas, Encontros
// e JSON. Comportamentos e fases têm FORMULÁRIO VISUAL (um cartão por item, campos por tipo) e o JSON avançado ao lado,
// sincronizado: o JSON válido redesenha o formulário; o formulário reescreve o JSON (nunca por cima de um texto com
// erro). NENHUMA regra mora aqui: a validação é a do servidor (`bosses-unicos/catalogo.mjs`), pedida a cada mudança.
import { el, msg, confirmar, descartarAlteracoes, editorJson, cabecalho, botaoCopiar } from './editor-ui.mjs';
import { retrato } from './editor-sprites.mjs';
import { ELEMENTOS, seloDoElemento, nomeDoElemento, cartaoDeAtaque, cartaoDeCura, barrasDeResistencia, metrica } from './editor-fichas.mjs';

/** Os exemplos de cada tipo (o mesmo ponto de partida do editor antigo). */
const MODELOS = {
  magia: { tipo: 'magia', nome: 'Raio', elemento: 'energy', min: 50, max: 90, forma: 'feixe', comprimento: 6, intervaloMs: 5000, chance: 100 },
  'area-telegrafada': { tipo: 'area-telegrafada', nome: 'Pancada no chão', elemento: 'physical', min: 100, max: 200, raio: 2, avisoMs: 1500, intervaloMs: 8000, chance: 100 },
  invocar: { tipo: 'invocar', criaturas: [{ key: 'troll', qtd: 2 }], maxVivos: 4, intervaloMs: 15000, chance: 100 },
  escudo: { tipo: 'escudo', pctVida: 10, duracaoMs: 8000, vulnerabilidade: { pct: 30, ms: 5000 }, intervaloMs: 30000, chance: 100 },
};
const TIPOS = { magia: 'Magia', 'area-telegrafada': 'Área telegrafada', invocar: 'Invocação', escudo: 'Escudo' };
const ICONE = { magia: '✦', 'area-telegrafada': '◎', invocar: '⚑', escudo: '⛨' };
const FASE_MODELO = () => ({ nome: 'Enfurecido', ate: 50, mods: { danoMult: 1.3 }, aoEntrar: { fala: 'Chega!' }, comportamentos: [] });
const VAZIO = () => ({ id: '', nome: '', categoria: 'miniboss', base: '', descricao: '', lore: '', atributos: { vidaMult: 5 }, melee: { min: 10, max: 30, intervaloMs: 2000 }, usaEscalaDaFase: true, comportamentos: [], fases: [], recompensas: { loot: [], primeiraVitoria: null } });
const ABAS = [['identidade', 'Identidade'], ['atributos', 'Atributos'], ['combate', 'Combate'], ['comportamentos', 'Comportamentos'], ['fases', 'Fases'], ['recompensas', 'Recompensas'], ['encontros', 'Encontros'], ['json', 'JSON']];
const copia = (x) => JSON.parse(JSON.stringify(x));
const n = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR'));

/** A aba onde mora o campo que o erro do servidor aponta (`x.comportamentos[0]: …` → Comportamentos). */
export function abaDoErro(m) {
  if (/: base "/.test(m)) return 'identidade';
  if (/\.fases\[/.test(m)) return 'fases';
  if (/\.comportamentos\[/.test(m)) return 'comportamentos';
  if (/do loot não existe|chance do item|primeira vitória/i.test(m)) return 'recompensas';
  if (/melee/i.test(m)) return 'combate';
  if (/atributos|resistência/i.test(m)) return 'atributos';
  return 'identidade';
}

/**
 * Cria o editor. `opcoes` = as opções do editor de conteúdo (categorias, bestiário, limites); `sujo` liga ao aviso de
 * "Alterações não salvas" da página; `irPara(aba, id)` leva à fase do encontro.
 */
export function criarEditorDeBosses({ api, raiz, opcoes, irPara, sujo, aoMudarCadastro = async () => {} }) {
  const E = { lista: [], id: null, boss: null, original: null, aba: 'identidade', erros: [], validado: false, filtro: '', bases: new Map(), nomesDeItem: new Map(), json: null };
  const bicho = (key) => opcoes().bestiario.find((b) => b.key === key) ?? null;
  const desenhoDe = (key) => {
    const b = bicho(key);
    return b?.look ? { tipo: 'criatura', look: b.look, cores: b.colors ?? null } : null;
  };

  // ------------------------------------------------------------------ dados

  async function carregarLista() {
    E.lista = (await api('bosses')).bosses;
  }
  /** O detalhe da criatura-base na Biblioteca (magias e loot que o boss herda), com cache. */
  async function base(key) {
    if (!key || !bicho(key)) return null;
    if (!E.bases.has(key)) E.bases.set(key, api(`biblioteca/detalhe?${new URLSearchParams({ categoria: 'monstros', id: key })}`).catch(() => null));
    return E.bases.get(key);
  }
  async function nomeDoItem(id) {
    if (!id) return null;
    if (!E.nomesDeItem.has(id)) E.nomesDeItem.set(id, api(`itens?q=${encodeURIComponent(id)}`).then((r) => r.itens?.find((i) => String(i.id) === String(id))?.name ?? null).catch(() => null));
    return E.nomesDeItem.get(id);
  }
  let espera = null;
  function validar() {
    clearTimeout(espera);
    espera = setTimeout(async () => {
      if (!E.boss) return;
      const r = await api('bosses/validar', E.boss);
      E.erros = r.erros ?? [];
      E.validado = true;
      pintarRodape();
    }, 350);
  }
  /** Toda edição passa por aqui: acende o "não salvo", pede a validação, atualiza a prévia e o JSON aberto. */
  function mudou() {
    sujo.marcar();
    validar();
    pintarTopo();
    pintarRodape();
    E.json?.sincronizar?.();
  }

  // ------------------------------------------------------------------ campos (ligados a um objeto)

  function numero(rotulo, obj, chave, { opcional = true, dica = null, passo = 'any', sufixo = null, aoMudar = mudou } = {}) {
    const i = el('input', { type: 'number', step: passo, value: obj[chave] ?? '', placeholder: opcional ? '—' : '' });
    i.addEventListener('input', () => {
      if (i.value === '' && opcional) delete obj[chave];
      else obj[chave] = Number(i.value);
      aoMudar();
    });
    return el('label', { class: 'campo', title: dica ?? '' }, sufixo ? `${rotulo} (${sufixo})` : rotulo, i, dica ? el('span', { class: 'dica' }, dica) : null);
  }
  function texto(rotulo, obj, chave, { area = false, linhas = 3, lista = null, exemplo = '', dica = null, desligado = false, aoMudar = mudou } = {}) {
    const i = area ? el('textarea', { rows: linhas, placeholder: exemplo }, obj[chave] ?? '') : el('input', { type: 'text', value: obj[chave] ?? '', placeholder: exemplo, list: lista, disabled: desligado, spellcheck: 'false' });
    i.addEventListener('input', () => {
      obj[chave] = i.value;
      aoMudar();
    });
    return el('label', { class: 'campo' }, rotulo, i, dica ? el('span', { class: 'dica' }, dica) : null);
  }
  function selecao(rotulo, obj, chave, opcoesDoCampo, { vazio = null, aoMudar = mudou } = {}) {
    const s = el('select', {}, vazio ? el('option', { value: '' }, vazio) : null, opcoesDoCampo.map(([v, nome]) => el('option', { value: v, selected: String(obj[chave] ?? '') === String(v) }, nome)));
    s.addEventListener('change', () => {
      if (s.value === '' && vazio) delete obj[chave];
      else obj[chave] = s.value;
      aoMudar();
    });
    return el('label', { class: 'campo' }, rotulo, s);
  }
  function marca(rotulo, obj, chave, { aoMudar = mudou, dica = null } = {}) {
    const c = el('input', { type: 'checkbox' });
    c.checked = !!obj[chave];
    c.addEventListener('change', () => {
      if (c.checked) obj[chave] = true;
      else delete obj[chave];
      aoMudar();
    });
    return el('label', { class: 'marca', title: dica ?? '' }, c, rotulo);
  }
  /** Um bloco que liga/desliga um sub-objeto opcional (`obj[chave]`), redesenhando só ele. */
  function opcional(titulo, obj, chave, criar, desenhar) {
    const caixa = el('div', { class: 'boss-opcional' });
    const pintar = () => {
      const c = el('input', { type: 'checkbox' });
      c.checked = obj[chave] != null;
      c.addEventListener('change', () => {
        if (c.checked) obj[chave] = criar();
        else delete obj[chave];
        pintar();
        mudou();
      });
      caixa.replaceChildren(el('label', { class: 'marca' }, c, titulo), obj[chave] != null ? el('div', { class: 'boss-opcional-corpo' }, desenhar(obj[chave])) : null);
    };
    pintar();
    return caixa;
  }
  const elementos = Object.keys(ELEMENTOS).map((e) => [e, nomeDoElemento(e)]);
  /** Criatura do bestiário (com o retrato ao lado, conferido a cada tecla). */
  function campoDeCriatura(rotulo, obj, chave = 'key', { aoMudar = mudou } = {}) {
    const caixaArte = el('span', { class: 'boss-criatura-arte' });
    const nome = el('span', { class: 'dica' });
    const pintarArte = () => {
      const b = bicho(obj[chave]);
      caixaArte.replaceChildren(retrato(desenhoDe(obj[chave]), 36, { categoria: 'monstros', imediato: true }));
      nome.textContent = b ? `${b.name} · ${n(b.hp)} hp` : obj[chave] ? 'não é um monstro do bestiário' : '';
      nome.classList.toggle('erro-txt', !!obj[chave] && !b);
    };
    const i = el('input', { type: 'text', list: 'dl-bichos', value: obj[chave] ?? '', placeholder: 'nome ou key do monstro', spellcheck: 'false' });
    i.addEventListener('input', () => {
      obj[chave] = i.value.trim();
      pintarArte();
      aoMudar();
    });
    pintarArte();
    return el('label', { class: 'campo boss-criatura' }, rotulo, el('div', { class: 'linha' }, caixaArte, i), nome);
  }
  /** Item do catálogo: busca por nome (datalist) e guarda o número; mostra o ícone e o nome. */
  let buscaDeItens = null;
  function campoDeItem(obj, chave = 'id') {
    const arte = el('span', { class: 'boss-item-arte' });
    const nome = el('span', { class: 'dica boss-item-nome' });
    const pintar = async () => {
      arte.replaceChildren(retrato(obj[chave] ? { tipo: 'item', id: Number(obj[chave]) } : null, 28, { categoria: 'itens', imediato: true }));
      const nm = await nomeDoItem(obj[chave]);
      nome.textContent = obj[chave] ? nm ?? 'item inexistente' : '';
      nome.classList.toggle('erro-txt', !!obj[chave] && !nm);
    };
    const i = el('input', { type: 'text', list: 'dl-itens-boss', value: obj[chave] ?? '', placeholder: 'nome ou id do item', spellcheck: 'false' });
    i.addEventListener('input', () => {
      if (/^\d+$/.test(i.value)) {
        obj[chave] = Number(i.value);
        pintar();
        mudou();
        return;
      }
      clearTimeout(buscaDeItens);
      buscaDeItens = setTimeout(async () => {
        if (i.value.trim().length < 2) return;
        const r = await api(`itens?q=${encodeURIComponent(i.value.trim())}`);
        document.querySelector('#dl-itens-boss')?.replaceChildren(...(r.itens ?? []).map((x) => el('option', { value: String(x.id) }, x.name)));
      }, 220);
    });
    pintar();
    return el('div', { class: 'boss-item' }, arte, i, nome);
  }

  // ------------------------------------------------------------------ tela

  async function desenhar() {
    await carregarLista();
    if (!document.querySelector('#dl-itens-boss')) document.body.append(el('datalist', { id: 'dl-itens-boss' }));
    if (!document.querySelector('#dl-bichos')) document.body.append(el('datalist', { id: 'dl-bichos' }, opcoes().bestiario.map((b) => el('option', { value: b.key }, b.name))));
    raiz().replaceChildren(
      cabecalho('Bosses únicos', 'Os bosses de encontro (bosses-unicos.json): fases por % de vida e comportamentos. Quando e com que chance aparecem é configurado no encontro da fase.',
        el('button', { type: 'button', class: 'primario', onclick: novo }, '+ Novo boss')),
      el('div', { class: 'boss-v' },
        el('aside', { class: 'boss-lista' }, el('input', { type: 'search', placeholder: 'Filtrar bosses…', value: E.filtro, oninput: (e) => { E.filtro = e.target.value; pintarLista(); } }), el('div', { id: 'boss-itens' })),
        el('section', { class: 'boss-editor', id: 'boss-editor' })));
    pintarLista();
    if (E.boss) pintarEditor();
    else pintarVazio();
  }
  function pintarLista() {
    const t = E.filtro.trim().toLowerCase();
    const caixa = document.querySelector('#boss-itens');
    if (!caixa) return;
    caixa.replaceChildren(...E.lista.filter((b) => !t || b.nome.toLowerCase().includes(t) || b.id.includes(t)).map((b) => el('button', { type: 'button', class: `boss-item-lista${b.id === E.id ? ' ativo' : ''}`, onclick: () => escolher(b.id) },
      retrato(desenhoDe(b.base), 44, { categoria: 'bosses', rotulo: b.nome }),
      el('div', { class: 'boss-item-texto' }, el('b', {}, b.nome), el('div', { class: 'eng-card-selos' }, el('span', { class: 'selo boss' }, b.categoria), b.usos.length ? el('span', { class: 'selo usos' }, `${b.usos.length} encontro(s)`) : el('span', { class: 'selo aviso' }, 'sem uso'), b.fases?.length ? el('span', { class: 'selo' }, `${b.fases.length} fase(s)`) : null)))));
  }
  function pintarVazio() {
    document.querySelector('#boss-editor')?.replaceChildren(el('div', { class: 'bib-painel-vazio' }, el('b', {}, 'Escolha um boss à esquerda'), el('span', { class: 'dica' }, 'Ou crie um novo. O desenho, o nome e o loot padrão vêm da criatura-base do bestiário; o boss acrescenta atributos, comportamentos e fases.')));
  }

  async function podeSair() {
    return !sujo.esta() || descartarAlteracoes('O boss aberto tem alterações não salvas');
  }
  async function escolher(id) {
    if (id === E.id && E.boss) return;
    if (!(await podeSair())) return;
    sujo.limpar();
    const b = E.lista.find((x) => x.id === id);
    const { usos, ...def } = b;
    void usos;
    E.id = id;
    E.boss = copia(def);
    E.original = JSON.stringify(E.boss);
    E.erros = [];
    E.validado = false;
    pintarLista();
    pintarEditor();
    validar();
  }
  async function novo() {
    if (!(await podeSair())) return;
    E.id = null;
    E.boss = VAZIO();
    E.original = null;
    E.aba = 'identidade';
    E.erros = [];
    sujo.marcar();
    pintarLista();
    pintarEditor();
    validar();
  }
  function duplicar() {
    const b = copia(E.boss);
    b.id = `${b.id}-copia`;
    b.nome = `${b.nome} (cópia)`;
    E.id = null;
    E.boss = b;
    E.original = null;
    E.aba = 'identidade';
    sujo.marcar();
    msg('Cópia criada (ainda não salva): troque o ID e o nome antes de salvar.', 'aviso');
    pintarLista();
    pintarEditor();
    validar();
  }
  async function descartar() {
    if (!(await confirmar('Descartar as alterações deste boss?', 'Volta ao que está salvo no arquivo.', { ok: 'Descartar', perigo: true }))) return;
    sujo.limpar();
    if (E.id) {
      E.boss = JSON.parse(E.original);
      pintarEditor();
      validar();
    } else {
      E.boss = null;
      pintarVazio();
    }
  }
  async function salvar() {
    const r = await api('bosses', E.boss);
    if (!r.ok) {
      E.erros = r.erros ?? ['Não salvou.'];
      pintarRodape();
      msg('Não salvou: corrija os erros indicados abaixo.', 'erro');
      return;
    }
    sujo.limpar();
    E.id = E.boss.id;
    E.original = JSON.stringify(E.boss);
    await carregarLista();
    await aoMudarCadastro(); // a lista de bosses dos encontros (aba Fases) passa a ter o novo
    msg('Boss salvo (vale na hora neste servidor).', 'ok');
    pintarLista();
    pintarEditor();
  }
  async function excluir() {
    if (!(await confirmar(`Excluir o boss "${E.boss.nome}"?`, 'O cadastro sai de bosses-unicos.json. O servidor recusa se algum encontro ainda usa este boss.', { ok: 'Excluir', perigo: true }))) return;
    const r = await api('bosses', { excluir: E.id });
    if (!r.ok) return msg((r.erros ?? ['Não excluiu'])[0], 'erro');
    sujo.limpar();
    E.id = null;
    E.boss = null;
    await carregarLista();
    await aoMudarCadastro();
    msg('Boss excluído.', 'ok');
    pintarLista();
    pintarVazio();
  }

  // ---- editor (topo com a prévia, abas, corpo, rodapé)
  function pintarEditor() {
    const caixa = document.querySelector('#boss-editor');
    if (!caixa || !E.boss) return;
    caixa.replaceChildren(
      el('div', { id: 'boss-topo', class: 'boss-topo' }),
      el('div', { class: 'eng-abas boss-abas', role: 'tablist' }, ABAS.map(([id, nome]) => el('button', { type: 'button', role: 'tab', 'data-aba': id, class: E.aba === id ? 'ativa' : '', 'aria-selected': String(E.aba === id), onclick: () => trocarAba(id) }, rotuloDaAba(id, nome)))),
      el('div', { id: 'boss-corpo', class: 'boss-corpo' }),
      el('div', { id: 'boss-rodape', class: 'boss-rodape' }));
    pintarTopo();
    pintarCorpo();
    pintarRodape();
  }
  const rotuloDaAba = (id, nome) => (id === 'comportamentos' ? `${nome} (${E.boss.comportamentos?.length ?? 0})` : id === 'fases' ? `${nome} (${E.boss.fases?.length ?? 0})` : id === 'encontros' ? `${nome} (${usosDoBoss().length})` : nome);
  const usosDoBoss = () => E.lista.find((x) => x.id === E.id)?.usos ?? [];
  function trocarAba(id) {
    E.aba = id;
    for (const b of document.querySelectorAll('.boss-abas button')) {
      b.classList.toggle('ativa', b.dataset.aba === id);
      b.setAttribute('aria-selected', String(b.dataset.aba === id));
    }
    pintarCorpo();
  }
  function atualizarRotulosDasAbas() {
    for (const b of document.querySelectorAll('.boss-abas button')) b.textContent = rotuloDaAba(b.dataset.aba, ABAS.find(([id]) => id === b.dataset.aba)[1]);
  }

  /** A PRÉVIA: o sprite da criatura-base em destaque, a identidade e as habilidades resumidas (sem JSON). */
  function pintarTopo() {
    const caixa = document.querySelector('#boss-topo');
    if (!caixa) return;
    const b = E.boss;
    const baseB = bicho(b.base);
    const vida = b.atributos?.vida ?? (baseB?.hp && b.atributos?.vidaMult ? Math.round(baseB.hp * b.atributos.vidaMult) : baseB?.hp ?? null);
    const habilidades = [
      b.melee ? el('span', { class: 'boss-hab' }, el('i', {}, '⚔'), `Corpo a corpo ${n(b.melee.min)}–${n(b.melee.max)}`) : null,
      ...(b.comportamentos ?? []).map((c) => el('span', { class: 'boss-hab', title: TIPOS[c.tipo] ?? c.tipo }, el('i', {}, ICONE[c.tipo] ?? '•'), c.nome || TIPOS[c.tipo] || c.tipo, c.elemento ? seloDoElemento(c.elemento) : null)),
      ...(b.fases ?? []).map((f) => el('span', { class: 'boss-hab fase' }, el('i', {}, '◐'), `${f.nome || 'Fase'} ≤ ${f.ate}%`, f.comportamentos?.length ? ` +${f.comportamentos.length}` : '')),
      b.usaPoderesDoBase ? el('span', { class: 'boss-hab base' }, el('i', {}, '↺'), 'magias da criatura-base') : null,
    ].filter(Boolean);
    caixa.replaceChildren(
      el('div', { class: 'boss-topo-arte' }, retrato(desenhoDe(b.base), 128, { categoria: 'bosses', animar: true, imediato: true, rotulo: b.nome })),
      el('div', { class: 'boss-topo-info' },
        el('h2', { class: 'bib-nome' }, b.nome || 'Boss sem nome'),
        el('div', { class: 'linha' }, el('span', { class: 'eng-id', style: 'flex:none' }, b.id || '(sem ID)'), b.id ? botaoCopiar(b.id) : null, el('span')),
        el('div', { class: 'eng-card-selos' }, el('span', { class: 'selo boss' }, b.categoria || 'sem categoria'), b.nivel ? el('span', { class: 'selo' }, `nível ${b.nivel}`) : null, baseB ? el('span', { class: 'selo' }, `base: ${baseB.name}`) : el('span', { class: 'selo erro' }, 'sem criatura-base'), vida ? el('span', { class: 'selo vida' }, `${n(vida)} hp${b.usaEscalaDaFase !== false ? ' (antes da escala)' : ''}`) : null, sujo.esta() ? el('span', { class: 'selo aviso' }, 'não salvo') : null),
        el('div', { class: 'boss-habilidades' }, habilidades.length ? habilidades : el('span', { class: 'nao' }, 'Sem habilidades: o boss não faz nada na luta (ligue o corpo a corpo ou acrescente um comportamento).'))));
    atualizarRotulosDasAbas();
  }

  function pintarRodape() {
    const caixa = document.querySelector('#boss-rodape');
    if (!caixa || !E.boss) return;
    const erros = E.erros;
    caixa.replaceChildren(
      el('div', { class: 'boss-erros' }, erros.length
        ? el('ul', { class: 'problemas' }, erros.map((m) => el('li', { class: 'erro clicavel', title: 'Ir para o campo', onclick: () => trocarAba(abaDoErro(m)) }, m)))
        : el('span', { class: E.validado ? 'ok-txt' : 'dica' }, E.validado ? '✓ Cadastro válido para o servidor.' : 'Validando…')),
      el('div', { class: 'boss-acoes' },
        E.id ? el('button', { type: 'button', class: 'perigo', onclick: excluir }, 'Excluir') : null,
        E.id ? el('button', { type: 'button', onclick: duplicar }, 'Duplicar') : null,
        sujo.esta() ? el('button', { type: 'button', class: 'fantasma', onclick: descartar }, 'Descartar alterações') : null,
        el('button', { type: 'button', class: 'primario', disabled: !!erros.length || !E.validado, onclick: salvar }, E.id ? 'Salvar boss' : 'Criar boss')));
  }

  function pintarCorpo() {
    const caixa = document.querySelector('#boss-corpo');
    if (!caixa) return;
    E.json = null;
    const b = E.boss;
    const corpo = {
      identidade: abaIdentidade,
      atributos: abaAtributos,
      combate: abaCombate,
      comportamentos: () => abaComJson(() => listaDeComportamentos(b, 'comportamentos', 'Sempre ativos, em todas as fases.'), b, 'comportamentos', 'Comportamentos (JSON avançado)'),
      fases: () => abaComJson(() => listaDeFases(b), b, 'fases', 'Fases de combate (JSON avançado)'),
      recompensas: abaRecompensas,
      encontros: abaEncontros,
      json: abaJson,
    }[E.aba];
    caixa.replaceChildren(...[].concat(corpo?.() ?? []));
  }

  // ---- abas
  function abaIdentidade() {
    const b = E.boss;
    return [
      el('div', { class: 'grade' },
        texto('ID (minúsculas, números e hífen)', b, 'id', { desligado: !!E.id, dica: E.id ? 'O ID de um boss salvo não muda (os encontros apontam para ele). Para outro ID, use Duplicar.' : null, exemplo: 'senhor-das-cinzas' }),
        texto('Nome', b, 'nome', { exemplo: 'Senhor das Cinzas' }),
        selecao('Categoria', b, 'categoria', opcoes().categoriasDeBoss.map((c) => [c, c])),
        numero('Nível recomendado', b, 'nivel', { passo: 1 })),
      campoDeCriatura('Criatura-base (desenho, nome padrão e loot)', b, 'base', { aoMudar: () => { mudou(); } }),
      texto('Descrição', b, 'descricao', { area: true, linhas: 2, exemplo: 'O que o jogador vê ao encontrá-lo.' }),
      texto('Lore', b, 'lore', { area: true, linhas: 4 }),
    ];
  }
  function abaAtributos() {
    const b = E.boss;
    b.atributos ??= {};
    const a = b.atributos;
    const baseB = bicho(b.base);
    const resist = el('div', {});
    const pintarResist = () => {
      a.resistencias ??= {};
      const linhas = Object.entries(a.resistencias);
      resist.replaceChildren(
        el('div', { class: 'linhas' }, linhas.map(([elmt, v]) => el('div', { class: 'linha' },
          (() => { const s = el('select', {}, Object.keys(ELEMENTOS).map((e) => el('option', { value: e, selected: e === elmt }, nomeDoElemento(e)))); s.addEventListener('change', () => { const val = a.resistencias[elmt]; delete a.resistencias[elmt]; a.resistencias[s.value] = val; pintarResist(); mudou(); }); return s; })(),
          (() => { const i = el('input', { type: 'number', step: 1, value: v }); i.addEventListener('input', () => { a.resistencias[elmt] = Number(i.value); mudou(); }); return i; })(),
          el('button', { type: 'button', class: 'fantasma', title: 'Remover', onclick: () => { delete a.resistencias[elmt]; pintarResist(); mudou(); } }, '✕')))),
        el('button', { type: 'button', onclick: () => { const livre = Object.keys(ELEMENTOS).find((e) => !(e in a.resistencias)); if (livre) { a.resistencias[livre] = 10; pintarResist(); mudou(); } } }, '+ resistência'),
        el('div', { class: 'dica' }, 'Em %, somadas às da criatura-base (positivo = resiste, negativo = fraqueza).'));
      if (!Object.keys(a.resistencias).length) delete a.resistencias;
    };
    pintarResist();
    const herdadas = el('div', {});
    base(b.base).then((d) => herdadas.replaceChildren(d ? barrasDeResistencia(d.resistencias) : el('span', { class: 'nao' }, 'sem criatura-base')));
    return [
      baseB ? el('div', { class: 'eng-metricas' }, metrica('Vida da base', n(baseB.hp)), metrica('Vida do boss', a.vida != null ? n(a.vida) : a.vidaMult ? n(Math.round(baseB.hp * a.vidaMult)) : n(baseB.hp)), metrica('Dano', `×${a.danoMult ?? 1}`), metrica('Experiência', `×${a.expMult ?? 1}`)) : null,
      el('p', { class: 'dica' }, b.usaEscalaDaFase !== false ? 'Valores antes da escala da fase (vida, dano e XP crescem com o nível da fase, como em todo bicho da campanha).' : 'Este boss NÃO usa a escala da fase: os valores valem como estão.'),
      el('div', { class: 'grade' },
        numero('Vida absoluta', a, 'vida', { passo: 1, dica: 'Se preenchida, manda sobre o multiplicador.' }),
        numero('Vida × base', a, 'vidaMult', { dica: 'Multiplica a vida da criatura-base.' }),
        numero('Dano ×', a, 'danoMult'),
        numero('Armadura', a, 'armadura', { passo: 1 }),
        numero('Experiência ×', a, 'expMult')),
      el('h4', {}, 'Resistências próprias'),
      resist,
      el('h4', {}, 'Resistências herdadas da criatura-base'),
      herdadas,
    ];
  }
  function abaCombate() {
    const b = E.boss;
    const daBase = el('div', {});
    base(b.base).then((d) => daBase.replaceChildren(!d ? el('span', { class: 'nao' }, 'sem criatura-base') : d.habilidades?.length || d.curas?.length ? el('div', { class: 'eng-ataques' }, (d.habilidades ?? []).map(cartaoDeAtaque), (d.curas ?? []).map(cartaoDeCura)) : el('span', { class: 'nao' }, 'A criatura-base não tem magias cadastradas.')));
    return [
      opcional('Corpo a corpo (sem isto o boss não bate de perto)', b, 'melee', () => ({ min: 10, max: 30, intervaloMs: 2000 }), (m) => el('div', { class: 'grade' }, numero('Dano mínimo', m, 'min', { opcional: false, passo: 1 }), numero('Dano máximo', m, 'max', { opcional: false, passo: 1 }), numero('Intervalo', m, 'intervaloMs', { opcional: false, passo: 100, sufixo: 'ms' }))),
      el('div', { class: 'grade' },
        marca('Usa também as magias da criatura-base', b, 'usaPoderesDoBase'),
        (() => { const c = el('input', { type: 'checkbox' }); c.checked = b.usaEscalaDaFase !== false; c.addEventListener('change', () => { b.usaEscalaDaFase = c.checked; mudou(); }); return el('label', { class: 'marca' }, c, 'Vai na escala da fase (vida, dano e XP)'); })()),
      el('h4', {}, `Magias da criatura-base${b.usaPoderesDoBase ? ' (em uso)' : ' (desligadas)'}`),
      daBase,
      el('p', { class: 'dica' }, 'Os comportamentos próprios do boss (magias, áreas telegrafadas, invocações e escudos) ficam na aba Comportamentos; o que muda por % de vida, na aba Fases.'),
    ];
  }

  /** Uma aba com formulário visual + JSON avançado do MESMO dado, sincronizados. */
  function abaComJson(formulario, obj, chave, rotulo) {
    const area = el('div', { class: 'boss-form' });
    const pintarForm = () => area.replaceChildren(...[].concat(formulario()));
    pintarForm();
    const json = editorJson(rotulo, obj, chave, { aoMudar: () => { pintarForm(); sujo.marcar(); validar(); pintarTopo(); pintarRodape(); }, dica: 'Editar aqui redesenha o formulário acima. O formulário reescreve este texto, mas nunca por cima de um JSON com erro.' });
    E.json = json;
    return [area, el('details', { class: 'boss-avancado' }, el('summary', {}, 'JSON avançado'), json)];
  }

  // ---- comportamentos (cartões por tipo)
  function listaDeComportamentos(dono, chave, legenda) {
    dono[chave] ??= [];
    const lista = dono[chave];
    const caixa = el('div', { class: 'boss-comps' });
    const limite = opcoes().limitesDoBoss?.comportamentosPorFase ?? 8;
    const pintar = () => {
      caixa.replaceChildren(
        legenda ? el('p', { class: 'dica' }, legenda) : null,
        ...(lista.length ? lista.map((c, i) => cartaoDeComportamento(c, i, lista, pintar)) : [el('div', { class: 'boss-vazio' }, 'Nenhum comportamento.')]),
        el('div', { class: 'boss-mais' }, el('span', { class: 'dica' }, `Acrescentar (${lista.length}/${limite}):`), Object.entries(TIPOS).map(([t, nome]) => el('button', { type: 'button', disabled: lista.length >= limite, onclick: () => { lista.push(copia(MODELOS[t])); pintar(); mudou(); } }, `${ICONE[t]} ${nome}`))));
    };
    pintar();
    return caixa;
  }
  function cartaoDeComportamento(c, i, lista, repintar) {
    const mover = (d) => {
      const j = i + d;
      if (j < 0 || j >= lista.length) return;
      [lista[i], lista[j]] = [lista[j], lista[i]];
      repintar();
      mudou();
    };
    const corpo = el('div', { class: 'boss-comp-corpo' });
    const pintarCorpo = () => corpo.replaceChildren(...camposDoComportamento(c, pintarCorpo));
    pintarCorpo();
    return el('div', { class: `boss-comp tipo-${c.tipo}` },
      el('div', { class: 'boss-comp-topo' },
        el('span', { class: 'boss-comp-icone' }, ICONE[c.tipo] ?? '?'),
        el('b', {}, c.nome || TIPOS[c.tipo] || c.tipo),
        el('span', { class: 'selo' }, TIPOS[c.tipo] ?? `tipo desconhecido: ${c.tipo}`),
        c.elemento ? seloDoElemento(c.elemento) : null,
        el('span', { style: 'flex:1' }),
        el('button', { type: 'button', class: 'fantasma', title: 'Subir', disabled: i === 0, onclick: () => mover(-1) }, '↑'),
        el('button', { type: 'button', class: 'fantasma', title: 'Descer', disabled: i === lista.length - 1, onclick: () => mover(1) }, '↓'),
        el('button', { type: 'button', class: 'fantasma', title: 'Duplicar', onclick: () => { lista.splice(i + 1, 0, copia(c)); repintar(); mudou(); } }, '⧉'),
        el('button', { type: 'button', class: 'fantasma perigo-txt', title: 'Remover', onclick: async () => { if (await confirmar(`Remover "${c.nome || TIPOS[c.tipo]}"?`, '', { ok: 'Remover', perigo: true })) { lista.splice(i, 1); repintar(); mudou(); } } }, '✕')),
      corpo);
  }
  function camposDoComportamento(c, repintar) {
    const comum = [numero('Intervalo', c, 'intervaloMs', { opcional: false, passo: 100, sufixo: 'ms' }), numero('Chance', c, 'chance', { opcional: false, passo: 1, sufixo: '%' })];
    const dano = [selecao('Elemento', c, 'elemento', elementos), numero('Dano mínimo', c, 'min', { opcional: false, passo: 1 }), numero('Dano máximo', c, 'max', { opcional: false, passo: 1 })];
    const nome = texto('Nome (o que aparece no golpe)', c, 'nome', { exemplo: 'Raio' });
    if (c.tipo === 'magia') {
      return [
        el('div', { class: 'grade' }, nome, ...dano, selecao('Forma', c, 'forma', [['alvo', 'no alvo'], ['area', 'em área'], ['feixe', 'em feixe']], { aoMudar: () => { mudou(); repintar(); } })),
        el('div', { class: 'grade' },
          c.forma === 'area' ? numero('Raio', c, 'raio', { passo: 1, sufixo: 'casas' }) : null,
          c.forma === 'area' ? marca('Centrada no alvo (não no boss)', c, 'noAlvo') : null,
          c.forma === 'feixe' ? numero('Comprimento', c, 'comprimento', { passo: 1, sufixo: 'casas' }) : null,
          c.forma === 'feixe' ? marca('Abre em onda (espalha)', c, 'espalha') : null,
          numero('Alcance', c, 'alcance', { passo: 1, sufixo: 'casas', dica: 'Padrão 7.' }),
          ...comum),
        avancado([numero('Efeito na tela (id)', c, 'efeito', { passo: 1 }), numero('Projétil (id)', c, 'tiro', { passo: 1 })]),
      ];
    }
    if (c.tipo === 'area-telegrafada') {
      return [
        el('div', { class: 'grade' }, nome, ...dano),
        el('div', { class: 'grade' }, numero('Raio', c, 'raio', { opcional: false, passo: 1, sufixo: 'casas' }), numero('Aviso antes do dano', c, 'avisoMs', { opcional: false, passo: 100, sufixo: 'ms', dica: 'Tempo para o jogador ver e sair.' }), numero('Alcance', c, 'alcance', { passo: 1, sufixo: 'casas', dica: 'Padrão 7.' }), ...comum),
        avancado([numero('Efeito do aviso (id)', c, 'efeitoDoAviso', { passo: 1 }), numero('Efeito do impacto (id)', c, 'efeito', { passo: 1 })]),
      ];
    }
    if (c.tipo === 'invocar') return [listaDeCriaturas(c), el('div', { class: 'grade' }, numero('Máximo de lacaios vivos', c, 'maxVivos', { opcional: false, passo: 1 }), texto('Fala ao invocar', c, 'fala', { exemplo: 'Venham!' }), ...comum)];
    if (c.tipo === 'escudo') {
      return [
        el('div', { class: 'grade' }, numero('Escudo (% da vida)', c, 'pctVida', { opcional: false, passo: 1 }), numero('Duração', c, 'duracaoMs', { opcional: false, passo: 100, sufixo: 'ms' }), ...comum),
        opcional('Janela de vulnerabilidade depois que o escudo quebra', c, 'vulnerabilidade', () => ({ pct: 30, ms: 5000 }), (v) => el('div', { class: 'grade' }, numero('Resistência a menos', v, 'pct', { opcional: false, passo: 1, sufixo: '%' }), numero('Por', v, 'ms', { opcional: false, passo: 100, sufixo: 'ms' }))),
      ];
    }
    return [el('p', { class: 'erro-txt' }, `Tipo "${c.tipo}" desconhecido: corrija no JSON avançado.`)];
  }
  const avancado = (campos) => el('details', { class: 'boss-avancado-campos' }, el('summary', {}, 'Avançado'), el('div', { class: 'grade' }, campos));
  function listaDeCriaturas(c) {
    c.criaturas ??= [];
    const caixa = el('div', { class: 'boss-criaturas' });
    const pintar = () => caixa.replaceChildren(
      el('div', { class: 'bib-rotulo' }, 'Criaturas invocadas'),
      ...c.criaturas.map((x, i) => el('div', { class: 'linha' }, campoDeCriatura('', x, 'key'), numero('Qtd', x, 'qtd', { opcional: false, passo: 1 }), el('button', { type: 'button', class: 'fantasma', title: 'Remover', onclick: () => { c.criaturas.splice(i, 1); pintar(); mudou(); } }, '✕'))),
      el('button', { type: 'button', onclick: () => { c.criaturas.push({ key: E.boss.base || 'troll', qtd: 1 }); pintar(); mudou(); } }, '+ criatura'));
    pintar();
    return caixa;
  }

  // ---- fases (linha da vida + cartões)
  function listaDeFases(b) {
    b.fases ??= [];
    const caixa = el('div', { class: 'boss-fases' });
    const limite = opcoes().limitesDoBoss?.fases ?? 6;
    const pintar = () => {
      caixa.replaceChildren(
        linhaDaVida(b.fases),
        el('p', { class: 'dica' }, 'Cada fase começa quando a vida do boss cruza o seu "até %" — da vida cheia para a vazia, cada uma abaixo da anterior.'),
        ...b.fases.map((f, i) => cartaoDeFase(f, i, b.fases, pintar)),
        el('div', { class: 'boss-mais' }, el('button', { type: 'button', disabled: b.fases.length >= limite, onclick: () => { const ult = b.fases.at(-1)?.ate ?? 100; b.fases.push({ ...FASE_MODELO(), ate: Math.max(1, Math.floor(ult / 2)) }); pintar(); mudou(); } }, `+ Fase (${b.fases.length}/${limite})`)));
    };
    pintar();
    return caixa;
  }
  /** A barra de vida 100% → 0% com o trecho de cada fase (só desenho do que está cadastrado). */
  function linhaDaVida(fases) {
    const cortes = [{ nome: 'Início', de: 100 }, ...fases.map((f) => ({ nome: f.nome || 'Fase', de: Number(f.ate) }))];
    return el('div', { class: 'boss-vida' }, cortes.map((c, i) => {
      const ate = cortes[i + 1]?.de ?? 0;
      const largura = Math.max(0, c.de - ate);
      return el('div', { class: `boss-vida-trecho t${i % 4}`, style: `flex-basis:${largura}%`, title: `${c.nome}: ${c.de}% → ${ate}%` }, el('span', {}, `${c.nome} · ${c.de}%`));
    }));
  }
  function cartaoDeFase(f, i, fases, repintar) {
    f.mods ??= {};
    f.aoEntrar ??= {};
    return el('div', { class: 'boss-fase' },
      el('div', { class: 'boss-comp-topo' },
        el('span', { class: 'boss-comp-icone' }, '◐'),
        el('b', {}, f.nome || `Fase ${i + 1}`),
        el('span', { class: 'selo' }, `a partir de ${f.ate}% de vida`),
        el('span', { style: 'flex:1' }),
        el('button', { type: 'button', class: 'fantasma perigo-txt', title: 'Remover fase', onclick: async () => { if (await confirmar(`Remover a fase "${f.nome || i + 1}"?`, '', { ok: 'Remover', perigo: true })) { fases.splice(i, 1); repintar(); mudou(); } } }, '✕')),
      el('div', { class: 'boss-comp-corpo' },
        el('div', { class: 'grade' }, texto('Nome da fase', f, 'nome', { exemplo: 'Enfurecido' }), numero('Começa em (% de vida)', f, 'ate', { opcional: false, passo: 1, aoMudar: () => { mudou(); repintar(); } }), numero('Dano × (nesta fase)', f.mods, 'danoMult'), numero('Velocidade de ataque', f.mods, 'velocidadeDeAtaque')),
        el('h4', {}, 'Ao entrar na fase'),
        texto('Fala', f.aoEntrar, 'fala', { exemplo: 'Chega!' }),
        opcional('Ganha um escudo', f.aoEntrar, 'escudo', () => ({ pctVida: 10, duracaoMs: 8000 }), (e) => el('div', { class: 'grade' }, numero('Escudo (% da vida)', e, 'pctVida', { opcional: false, passo: 1 }), numero('Duração', e, 'duracaoMs', { opcional: false, passo: 100, sufixo: 'ms' }))),
        opcional('Invoca lacaios', f.aoEntrar, 'invocar', () => ({ criaturas: [{ key: E.boss.base || 'troll', qtd: 2 }], maxVivos: 4 }), (inv) => [listaDeCriaturas(inv), el('div', { class: 'grade' }, numero('Máximo vivos', inv, 'maxVivos', { passo: 1 }))]),
        el('h4', {}, 'Comportamentos extras nesta fase'),
        listaDeComportamentos(f, 'comportamentos', null)));
  }

  // ---- recompensas
  function abaRecompensas() {
    const b = E.boss;
    b.recompensas ??= { loot: [], primeiraVitoria: null };
    const r = b.recompensas;
    r.loot ??= [];
    const loot = el('div', { class: 'boss-loot' });
    const pintarLoot = () => loot.replaceChildren(
      ...r.loot.map((d, i) => el('div', { class: 'linha boss-loot-linha' }, campoDeItem(d), numero('Chance', d, 'chance', { opcional: false, sufixo: '%' }), el('button', { type: 'button', class: 'fantasma', title: 'Remover', onclick: () => { r.loot.splice(i, 1); pintarLoot(); mudou(); } }, '✕'))),
      el('button', { type: 'button', onclick: () => { r.loot.push({ id: '', chance: 10 }); pintarLoot(); mudou(); } }, '+ item'));
    pintarLoot();
    const daBase = el('div', {});
    if (!r.loot.length) base(b.base).then((d) => daBase.replaceChildren(d?.drops?.itens?.length ? el('div', { class: 'boss-loot-base' }, el('div', { class: 'dica' }, 'Sem loot próprio: o boss solta o loot da criatura-base:'), el('div', { class: 'boss-icones' }, d.drops.itens.slice(0, 24).map((l) => el('span', { class: 'boss-icone', title: `${l.nome ?? l.item} · ${l.chancePct}%` }, retrato({ tipo: 'item', id: Number(l.item) }, 28, { categoria: 'itens' }), el('small', {}, `${l.chancePct}%`))))) : null));
    return [
      el('h4', {}, 'Loot do boss'),
      el('p', { class: 'dica' }, 'Chance em % por item, sorteada a cada vitória. Preenchido, SUBSTITUI o loot da criatura-base.'),
      loot,
      daBase,
      el('h4', {}, 'Prêmio da primeira vitória'),
      opcional('Paga uma vez por personagem', r, 'primeiraVitoria', () => ({ gold: 0 }), (p) => el('div', { class: 'grade' }, numero('Ouro', p, 'gold', { passo: 1 }), numero('Experiência', p, 'exp', { passo: 1 }))),
      el('p', { class: 'dica' }, 'Itens no prêmio da primeira vitória: pelo JSON (aba JSON), campo recompensas.primeiraVitoria.itens.'),
    ];
  }
  function abaEncontros() {
    const usos = usosDoBoss();
    if (!E.id) return el('p', { class: 'dica' }, 'Salve o boss para poder usá-lo num encontro.');
    if (!usos.length) return [el('p', { class: 'nao' }, 'Nenhum encontro usa este boss ainda.'), el('p', { class: 'dica' }, 'Para ele aparecer no jogo, crie um encontro do tipo boss / miniboss / boss-secreto na aba Fases e encontros.')];
    return el('div', { class: 'bib-usos' }, usos.map((u) => el('button', { type: 'button', class: 'bib-uso', onclick: () => irPara('fase', u.huntId) }, el('span', { class: 'selo' }, 'Encontro'), el('b', {}, u.huntId), el('span', { class: 'dica' }, `encontro ${u.encontro} — abrir a fase`))));
  }
  function abaJson() {
    const caixa = { boss: E.boss };
    const json = editorJson('O cadastro inteiro (JSON avançado)', caixa, 'boss', { aoMudar: () => { E.boss = caixa.boss; sujo.marcar(); validar(); pintarTopo(); pintarRodape(); }, dica: 'O mesmo objeto que vai para bosses-unicos.json. O servidor valida ao salvar.' });
    E.json = { sincronizar: () => { caixa.boss = E.boss; json.sincronizar(); } };
    return json;
  }

  return { desenhar, sujo: () => sujo.esta() };
}
