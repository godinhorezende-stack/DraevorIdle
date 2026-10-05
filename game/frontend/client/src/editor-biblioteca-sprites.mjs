// A BIBLIOTECA DE SPRITES da Engine: mobs, itens, efeitos, projéteis, outfits e montarias — cada desenho uma vez, com quem o usa (do PoE e do Draevor), o
// nome e as etiquetas que o dono dá (para organizar e achar). É daqui que a Engine puxa quando se adiciona algo novo: o seletor `escolherSprite` abre esta
// mesma lista numa janela (ex.: o desenho de um mob do PoE). Servidor: `admin/biblioteca-sprites.mjs` (só lê os índices do jogo; o nome e as etiquetas
// ficam em gamedata/biblioteca-sprites.json).
import { el, msg, cabecalho } from './editor-ui.mjs';
import { retrato, previa } from './editor-sprites.mjs';
import { miniatura } from './editor-ataques.mjs';

const api = async (rota, corpo) => (await fetch(`/api/mapas/_conteudo/${rota}`, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) } : {})).json();
const poe = async (rota, corpo) => (await fetch(`/api/mapas/_engine/itens-poe/${rota}`, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) } : {})).json();
export const SECOES = [['mobs', 'Mobs'], ['itens', 'Itens (utilizáveis)'], ['mapa', 'Construção do mapa'], ['efeitos', 'Efeitos de magia'], ['tiros', 'Projéteis'], ['outfits', 'Outfits'], ['montarias', 'Montarias']];
const NOME_DA_SECAO = Object.fromEntries(SECOES);

// O recorte de um atlas de mapa (a construção do mapa): a imagem do atlas é baixada uma vez e cada item desenha o seu pedaço.
const ATLAS = new Map();
function imagemDoAtlas(url) {
  if (!ATLAS.has(url)) {
    const img = new Image();
    const pronta = new Promise((ok) => { img.onload = () => ok(img); img.onerror = () => ok(null); });
    img.src = url;
    ATLAS.set(url, pronta);
  }
  return ATLAS.get(url);
}
export function recorteDoAtlas(d, tam = 64) {
  const c = el('canvas', { width: tam, height: tam, class: 'bs-recorte', style: `width:${tam}px;height:${tam}px` });
  imagemDoAtlas(d.url).then((img) => {
    if (!img) return;
    // Recorta só o que tem pixel (um chão de 32 px mora no canto de uma célula de 64) e amplia até encher o quadro.
    const tmp = document.createElement('canvas');
    tmp.width = d.w;
    tmp.height = d.h;
    const t = tmp.getContext('2d', { willReadFrequently: true });
    t.drawImage(img, d.x, d.y, d.w, d.h, 0, 0, d.w, d.h);
    const px = t.getImageData(0, 0, d.w, d.h).data;
    let [x0, y0, x1, y1] = [d.w, d.h, -1, -1];
    for (let yy = 0; yy < d.h; yy++) for (let xx = 0; xx < d.w; xx++) if (px[(yy * d.w + xx) * 4 + 3]) { if (xx < x0) x0 = xx; if (yy < y0) y0 = yy; if (xx > x1) x1 = xx; if (yy > y1) y1 = yy; }
    if (x1 < 0) return;
    const [bw, bh] = [x1 - x0 + 1, y1 - y0 + 1];
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const k = Math.min(tam / bw, tam / bh);
    const w = Math.round(bw * k);
    const h = Math.round(bh * k);
    g.drawImage(tmp, x0, y0, bw, bh, Math.round((tam - w) / 2), Math.round((tam - h) / 2), w, h);
  });
  return c;
}

/** O desenho de um sprite da biblioteca, no tamanho pedido. */
export function desenhoDoSprite(x, tam = 64) {
  if (x.desenho?.tipo === 'atlas') return recorteDoAtlas(x.desenho, tam);
  if (x.desenho?.tipo === 'efeito') return miniatura('efeito', x.desenho.id, tam);
  if (x.desenho?.tipo === 'tiro') return miniatura('tiro', x.desenho.id, tam);
  return retrato(x.desenho, tam, { categoria: x.desenho?.tipo === 'item' ? 'itens' : 'monstros' });
}

/** A grade de sprites com busca, filtro e "carregar mais". `aoEscolher(x)`; `secoes`: as abas que aparecem. */
function grade({ tipo, secoes = SECOES.map(([s]) => s), aoEscolher, selecionado = null, aoMudarTipo = null }) {
  const E = { tipo, q: '', filtro: '', categoria: '', pagina: 0, itens: [], total: 0, contagens: {}, categorias: null, carregando: false };
  const NOME_DA_CATEGORIA = { chao: 'Chão', cima: 'Bordas e decoração', solido: 'Paredes e sólidos' };
  const caixa = el('div', { class: 'bs-grade-caixa' });
  const lista = el('div', { class: 'bs-grade' });
  const rodape = el('div', { class: 'bs-rodape' });
  let espera = null;
  async function buscar(mais = false) {
    E.carregando = true;
    if (!mais) E.pagina = 0;
    const r = await api(`sprites/biblioteca?${new URLSearchParams({ tipo: E.tipo, q: E.q, filtro: E.filtro, categoria: E.tipo === 'mapa' ? E.categoria : '', pagina: E.pagina, limite: 120 })}`);
    E.categorias = r.categorias;
    E.semDesenho = r.semDesenho ?? 0;
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
      E.tipo === 'mapa' && E.categorias ? el('div', { class: 'bs-categorias' }, el('button', { type: 'button', class: E.categoria ? '' : 'ativo', onclick: () => { E.categoria = ''; buscar(); } }, 'Todas'),
        Object.entries(NOME_DA_CATEGORIA).map(([c, n]) => el('button', { type: 'button', class: E.categoria === c ? 'ativo' : '', onclick: () => { E.categoria = c; buscar(); } }, `${n} (${E.categorias[c] ?? 0})`)),
        el('span', { class: 'dica' }, `A categoria vem de como o item é usado nos mapas de verdade (base da casa = chão; por cima e bloqueando = parede/sólido).${E.semDesenho ? ` ${E.semDesenho} item(ns) ficam de fora: nenhum mapa guarda o desenho deles solto (o chão já vem pintado no fundo).` : ''}`)) : null,
      lista, rodape);
    lista.replaceChildren(...E.itens.map((x) => el('button', { type: 'button', class: `bs-card${selecionado && x.tipo === selecionado.tipo && x.id === selecionado.id ? ' ativo' : ''}`, title: `${x.nome} — ${x.totalDeUsos ? `usado por ${x.totalDeUsos}` : 'sem uso'}`, onclick: () => aoEscolher(x) },
      desenhoDoSprite(x, 56), el('b', {}, x.nome), el('small', {}, `#${x.id}${x.totalDeUsos ? ` · ${x.totalDeUsos} ${x.tipo === 'mapa' ? 'mapa(s)' : 'uso(s)'}` : ''}`), x.tags.length ? el('small', { class: 'bs-tags' }, x.tags.join(' · ')) : null)));
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
      x.desenho?.tipo === 'atlas' ? el('div', { class: 'bs-grande' }, recorteDoAtlas(x.desenho, 160)) : criatura || x.desenho?.tipo === 'item' ? previa(x.desenho, { categoria: criatura ? 'monstros' : 'itens', tamanhos: criatura ? [96, 160, 224] : [64, 128, 192] }) : el('div', { class: 'bs-grande' }, desenhoDoSprite(x, 160)),
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
      x.resumo ? el('p', { class: 'dica' }, x.resumo, x.desenho?.variantes > 1 ? ` · ${x.desenho.variantes} variações (o mapa sorteia ou alterna)` : '') : null,
      x.iguais?.length ? el('p', { class: 'dica' }, `O mesmo desenho também está em: ${x.iguais.map((i) => `#${i}`).join(', ')} (juntados aqui para não repetir).`) : null,
      el('h4', {}, `Quem usa (${x.totalDeUsos})`),
      x.usos.length ? el('ul', { class: 'bs-usos' }, x.usos.map((u) => el('li', {}, u.nome))) : el('p', { class: 'dica' }, x.tipo === 'efeitos' || x.tipo === 'tiros' ? `Use o número #${x.id} num ataque: aba Mobs → Ataques e efeitos.` : 'Ninguém usa este desenho ainda.'),
      criatura ? [el('h4', {}, 'Usar'), el('div', { class: 'linha' }, el('a', { href: `#sprites/${x.id}`, class: 'botao' }, 'Abrir no Editor de sprites →'), x.tipo === 'mobs' || x.tipo === 'outfits' || x.tipo === 'montarias' ? el('button', { type: 'button', onclick: () => usarNoMob(x) }, 'Usar como desenho de um mob do PoE…') : null), el('div', { id: 'bs-usar' })] : null));
  }
  return { desenhar };
}
