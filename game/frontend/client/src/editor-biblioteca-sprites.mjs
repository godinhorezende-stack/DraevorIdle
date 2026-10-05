// A BIBLIOTECA DE SPRITES da Engine: mobs, itens, efeitos, projéteis, outfits e montarias — cada desenho uma vez, com quem o usa (do PoE e do Draevor), o
// nome e as etiquetas que o dono dá (para organizar e achar). É daqui que a Engine puxa quando se adiciona algo novo: o seletor `escolherSprite` abre esta
// mesma lista numa janela (ex.: o desenho de um mob do PoE). Servidor: `admin/biblioteca-sprites.mjs` (só lê os índices do jogo; o nome e as etiquetas
// ficam em gamedata/biblioteca-sprites.json).
import { el, msg, cabecalho } from './editor-ui.mjs';
import { retrato, previa } from './editor-sprites.mjs';
import { miniatura } from './editor-ataques.mjs';

const api = async (rota, corpo) => (await fetch(`/api/mapas/_conteudo/${rota}`, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) } : {})).json();
const poe = async (rota, corpo) => (await fetch(`/api/mapas/_engine/itens-poe/${rota}`, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) } : {})).json();
export const SECOES = [['mobs', 'Mobs'], ['itens', 'Itens'], ['efeitos', 'Efeitos de magia'], ['tiros', 'Projéteis'], ['outfits', 'Outfits'], ['montarias', 'Montarias']];
const NOME_DA_SECAO = Object.fromEntries(SECOES);

/** O desenho de um sprite da biblioteca, no tamanho pedido. */
export function desenhoDoSprite(x, tam = 64) {
  if (x.desenho?.tipo === 'efeito') return miniatura('efeito', x.desenho.id, tam);
  if (x.desenho?.tipo === 'tiro') return miniatura('tiro', x.desenho.id, tam);
  return retrato(x.desenho, tam, { categoria: x.desenho?.tipo === 'item' ? 'itens' : 'monstros' });
}

/** A grade de sprites com busca, filtro e "carregar mais". `aoEscolher(x)`; `secoes`: as abas que aparecem. */
function grade({ tipo, secoes = SECOES.map(([s]) => s), aoEscolher, selecionado = null, aoMudarTipo = null }) {
  const E = { tipo, q: '', filtro: '', pagina: 0, itens: [], total: 0, contagens: {}, carregando: false };
  const caixa = el('div', { class: 'bs-grade-caixa' });
  const lista = el('div', { class: 'bs-grade' });
  const rodape = el('div', { class: 'bs-rodape' });
  let espera = null;
  async function buscar(mais = false) {
    E.carregando = true;
    if (!mais) E.pagina = 0;
    const r = await api(`sprites/biblioteca?${new URLSearchParams({ tipo: E.tipo, q: E.q, filtro: E.filtro, pagina: E.pagina, limite: 120 })}`);
    E.itens = mais ? [...E.itens, ...r.itens] : r.itens;
    E.total = r.total;
    E.contagens = r.contagens;
    E.comparando = !!r.comparandoPixels;
    E.carregando = false;
    pintar();
  }
  function pintar() {
    caixa.replaceChildren(
      el('div', { class: 'eng-abas bs-abas' }, secoes.map((s) => el('button', { type: 'button', class: E.tipo === s ? 'ativa' : '', onclick: () => { E.tipo = s; aoMudarTipo?.(s); buscar(); } }, `${NOME_DA_SECAO[s]}${E.contagens[s] != null ? ` (${E.contagens[s]})` : ''}`))),
      el('div', { class: 'linha bs-filtros' },
        el('input', { type: 'search', placeholder: 'Buscar por nome, id, etiqueta ou quem usa…', value: E.q, oninput: (e) => { E.q = e.target.value; clearTimeout(espera); espera = setTimeout(() => buscar(), 250); } }),
        el('select', { onchange: (e) => { E.filtro = e.target.value; buscar(); } }, [['', 'Todos'], ['com-uso', 'Usados no jogo'], ['sem-uso', 'Sem uso'], ['com-nome', 'Organizados (com nome/etiqueta)']].map(([v, n]) => el('option', { value: v, selected: v === E.filtro }, n))),
        el('span', { class: 'dica' }, `${E.total} desenho(s)${E.comparando ? ' — comparando os pixels para juntar os repetidos (alguns iguais ainda aparecem separados; recarregue em ~1 min)' : ''}`)),
      lista, rodape);
    lista.replaceChildren(...E.itens.map((x) => el('button', { type: 'button', class: `bs-card${selecionado && x.tipo === selecionado.tipo && x.id === selecionado.id ? ' ativo' : ''}`, title: `${x.nome} — ${x.totalDeUsos ? `usado por ${x.totalDeUsos}` : 'sem uso'}`, onclick: () => aoEscolher(x) },
      desenhoDoSprite(x, 56), el('b', {}, x.nome), el('small', {}, `#${x.id}${x.totalDeUsos ? ` · ${x.totalDeUsos} uso(s)` : ''}`), x.tags.length ? el('small', { class: 'bs-tags' }, x.tags.join(' · ')) : null)));
    rodape.replaceChildren(E.itens.length < E.total ? el('button', { type: 'button', disabled: E.carregando, onclick: () => { E.pagina++; buscar(true); } }, `Carregar mais (${E.total - E.itens.length})`) : null);
  }
  buscar();
  return { elemento: caixa, recarregar: () => buscar() };
}

/**
 * O SELETOR: abre a biblioteca numa janela e devolve o sprite escolhido (ou null). `tipo`: a seção inicial; `secoes`: as que podem ser escolhidas.
 */
export function escolherSprite({ tipo = 'mobs', secoes = [tipo], titulo = 'Escolher da Biblioteca de sprites' } = {}) {
  return new Promise((resolver) => {
    const fechar = (x) => { fundo.remove(); resolver(x); };
    const g = grade({ tipo, secoes, aoEscolher: (x) => fechar(x) });
    const fundo = el('div', { class: 'bs-janela-fundo', onclick: (e) => { if (e.target === fundo) fechar(null); } },
      el('div', { class: 'bs-janela', role: 'dialog' }, el('div', { class: 'linha' }, el('b', { style: 'flex:1' }, titulo), el('button', { type: 'button', onclick: () => fechar(null) }, 'Fechar (Esc)')), g.elemento));
    const esc = (e) => { if (e.key === 'Escape') { document.removeEventListener('keydown', esc); fechar(null); } };
    document.addEventListener('keydown', esc);
    document.body.append(fundo);
  });
}

// ---------------------------------------------------------------- a tela
export function criarTelaDaBibliotecaDeSprites({ raiz }) {
  const T = { tipo: 'mobs', sel: null, mobsPoe: null };
  let G = null;
  async function desenhar(resto = []) {
    if (resto[0] && NOME_DA_SECAO[resto[0]]) T.tipo = resto[0];
    G = grade({ tipo: T.tipo, aoEscolher: (x) => { T.sel = x; pintarPainel(); }, aoMudarTipo: (s) => { T.tipo = s; T.sel = null; pintarPainel(); } });
    raiz().replaceChildren(
      cabecalho('Biblioteca de sprites', 'Todos os desenhos do jogo num lugar só, cada um uma vez — mobs, itens, efeitos de magia, projéteis, outfits e montarias, do Draevor e do PoE —, com quem usa cada um. Dê nome e etiquetas para organizar; ao adicionar algo novo na Engine (o desenho de um mob, o efeito de um ataque), a escolha vem daqui.'),
      el('div', { class: 'poe-v painel-largo' }, el('section', { id: 'bs-lista', style: 'grid-column: span 2' }, G.elemento), el('aside', { class: 'bib-painel', id: 'bs-painel' })));
    pintarPainel();
  }
  async function usarNoMob(x) {
    T.mobsPoe ??= (await poe('mobs')).mobs ?? [];
    const sel = el('select', {}, el('option', { value: '' }, 'escolha o mob do PoE…'), T.mobsPoe.map((m) => el('option', { value: m.slug }, `${m.nome}${m.unico ? ' (único)' : ''}`)));
    const caixa = document.querySelector('#bs-usar');
    caixa?.replaceChildren(el('div', { class: 'linha' }, sel, el('button', { type: 'button', class: 'primario', onclick: async () => {
      if (!sel.value) return msg('Escolha o mob.', 'aviso');
      const r = await poe('mobs/desenho', { slug: sel.value, desenho: `look:${x.id}` });
      msg(r.ok ? `Desenho #${x.id} aplicado ao mob (vale na próxima entrada nas áreas dele).` : r.erros?.[0] ?? 'Não deu.', r.ok ? 'ok' : 'erro');
    } }, 'Usar este desenho')));
  }
  function pintarPainel() {
    const caixa = document.querySelector('#bs-painel');
    if (!caixa) return;
    const x = T.sel;
    if (!x) return caixa.replaceChildren(el('div', { class: 'bib-painel-vazio' }, el('b', {}, 'Escolha um sprite'), el('span', { class: 'dica' }, 'Veja quem usa, dê nome e etiquetas, e use o desenho num mob do PoE ou abra no Editor de sprites.')));
    const nome = el('input', { value: x.nome ?? '', placeholder: 'Nome' });
    const tags = el('input', { value: x.tags.join(', '), placeholder: 'etiquetas, separadas por vírgula (ex.: esqueleto, cripta, ato 1)' });
    const criatura = x.desenho?.tipo === 'criatura';
    caixa.replaceChildren(el('div', { class: 'bib-painel-corpo' },
      criatura || x.desenho?.tipo === 'item' ? previa(x.desenho, { categoria: criatura ? 'monstros' : 'itens', tamanhos: criatura ? [96, 160, 224] : [64, 128, 192] }) : el('div', { class: 'bs-grande' }, desenhoDoSprite(x, 160)),
      el('h2', { class: 'bib-nome' }, x.nome), el('span', { class: 'eng-id' }, `${NOME_DA_SECAO[x.tipo]} #${x.id}`),
      el('h4', {}, 'Organizar'),
      el('label', { class: 'campo' }, 'Nome', nome), el('label', { class: 'campo' }, 'Etiquetas', tags),
      el('button', { type: 'button', onclick: async () => {
        const r = await api('sprites/biblioteca/meta', { tipo: x.tipo, id: x.id, nome: nome.value, tags: tags.value });
        if (!r.ok) return msg(r.erros?.[0] ?? 'Não salvou.', 'erro');
        msg('Nome e etiquetas salvos.', 'ok');
        x.nome = nome.value || x.nome;
        x.tags = tags.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
        G.recarregar();
      } }, 'Salvar nome e etiquetas'),
      x.iguais?.length ? el('p', { class: 'dica' }, `O mesmo desenho também está em: ${x.iguais.map((i) => `#${i}`).join(', ')} (juntados aqui para não repetir).`) : null,
      el('h4', {}, `Quem usa (${x.totalDeUsos})`),
      x.usos.length ? el('ul', { class: 'bs-usos' }, x.usos.map((u) => el('li', {}, u.nome))) : el('p', { class: 'dica' }, x.tipo === 'efeitos' || x.tipo === 'tiros' ? `Use o número #${x.id} num ataque: aba Mobs → Ataques e efeitos.` : 'Ninguém usa este desenho ainda.'),
      criatura ? [el('h4', {}, 'Usar'), el('div', { class: 'linha' }, el('a', { href: `#sprites/${x.id}`, class: 'botao' }, 'Abrir no Editor de sprites →'), x.tipo === 'mobs' || x.tipo === 'outfits' || x.tipo === 'montarias' ? el('button', { type: 'button', onclick: () => usarNoMob(x) }, 'Usar como desenho de um mob do PoE…') : null), el('div', { id: 'bs-usar' })] : null));
  }
  return { desenhar };
}
