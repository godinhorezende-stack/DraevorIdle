// O EDITOR UNIVERSAL DE SPRITES E ANIMAÇÕES da Engine: monstros, outfits de personagem e montarias usam o mesmo formato de folha (uma imagem por `look`,
// um quadro por linha, direção/camada/addon/pose por coluna — ver `engine/sprite-folha.mjs`), então há UMA ferramenta, com os controles que cada categoria
// pede. Edita uma CÓPIA: o original nunca é tocado; salvar grava `gamedata/overrides/sprites/<look>.png` + o cadastro de quadros em
// `gamedata/overrides/sprites.json` (servidor: `admin/overrides-sprites.mjs`), e o jogo usa o override depois do commit + deploy.
//
// Toda regra de edição mora em `engine/sprite-edicao.mjs` (puro, testado); aqui só há tela: canvas de pixel, linha do tempo, painéis e pré-visualização.
import { el, cabecalho, confirmar, pedirTexto, msg, tratarConflito } from './editor-ui.mjs';
import { retrato, jogo } from './editor-sprites.mjs';
import { carregarBitmap, paraCanvas, bitmapDeBlob, paraPngBase64, paraPngBlob, baixar } from './editor-sprites-io.mjs';
import { criarPrevia, seletorDeCor, SLOTS_DE_COR } from './editor-sprites-preview.mjs';
import * as M from '/packages/shared/src/sprite-edicao.mjs';
import * as F from '/packages/shared/src/sprite-folha.mjs';

const CORES_PADRAO = { head: 78, body: 88, legs: 58, feet: 76 };
const NOME_DA_CATEGORIA = { monstros: 'Monstro', outfits: 'Outfit de personagem', montarias: 'Montaria', outros: 'Sprite animado' };
const FERRAMENTAS = [['lapis', 'Lápis', 'P'], ['borracha', 'Borracha', 'E'], ['conta-gotas', 'Conta-gotas', 'I'], ['balde', 'Preencher', 'F'], ['selecao', 'Seleção', 'M']];
const ZOOMS = [2, 3, 4, 6, 8, 10, 12, 16];
const MODOS_DE_IMPORTACAO = [
  ['direcoes-em-linhas', 'Cada linha é uma direção (colunas = quadros)'],
  ['direcoes-em-colunas', 'Cada coluna é uma direção (linhas = quadros)'],
  ['sequencia', 'Sequência: todas as células viram quadros de uma direção'],
  ['folha-do-jogo', 'Folha no formato do jogo (substitui o grupo inteiro)'],
  ['celula', 'Uma imagem só: vira a célula selecionada'],
];

export function criarEditorDeSprites({ api, raiz, sujo = null, podeGravar = () => true, irPara = null }) {
  const E = {
    look: null, ficha: null, categoria: 'outros', sessao: null, verdadeiro: null,
    g: 0, i: 0, dir: 2, layer: 0, z: 0, addon: 0, sel: new Set(),
    ferramenta: 'lapis', cor: [255, 255, 255, 255], pincel: 1, zoom: 8, grade: true, vincular: true, cebola: false, tingir: true, tolerancia: 0,
    selecao: null, area: null, flutuante: null, traco: null, trabalho: null, copiaQuadro: null,
    modoPreview: 'isolado', vista: 'uma', zoomPreview: 3, tocando: true, velocidade: 1, gradePreview: false,
    cores: { ...CORES_PADRAO }, addons: 0, montado: false, montariaDeTeste: null, cavaleiro: { look: '128', addons: 3, cores: { ...CORES_PADRAO } },
    abertos: new Set(['cadastro']), validacao: null, imp: null, lista: null, q: '', cat: 'monstros', ocupado: false,
  };
  const estado = () => E.sessao.atual;
  const grupo = () => estado().meta.groups[E.g];
  const posAtual = (layer = E.layer) => ({ z: E.z, addon: E.addon, dir: E.dir, layer });
  const celulaAtual = (layer = E.layer) => M.lerCelula(estado(), E.g, E.i, posAtual(layer));
  const dis = () => !podeGravar();
  const chaves = () => ({ rascunho: `rascunho:${E.look}`, original: `original:${E.look}` });
  const coresAtivas = () => ((grupo().layers ?? 1) > 1 || (estado().meta.groups[0].layers ?? 1) > 1 ? E.cores : null);

  // ------------------------------------------------------------------ carregar
  async function abrir(look) {
    if (!/^\d+$/.test(String(look ?? ''))) return picker();
    const f = await api(`overrides/sprites/${encodeURIComponent(look)}`);
    if (!f || f.ok === false || !f.look) { msg('Esse look não existe nos desenhos do jogo.', 'erro'); return picker(); }
    E.ocupado = true;
    try {
      const originalPng = await carregarBitmap(`/gamedata/sprites/outfits/${f.look}.png`);
      E.verdadeiro = { meta: structuredClone(f.original), quadros: F.desmontar(f.original, originalPng) };
      let base = E.verdadeiro;
      if (f.override) {
        const sal = await carregarBitmap(`/gamedata/overrides/sprites/${f.look}.png?v=${f.override.hash}`);
        base = { meta: structuredClone(f.override.meta), quadros: F.desmontar(f.override.meta, sal) };
      }
      E.look = f.look; E.ficha = f; E.categoria = f.categoria;
      E.sessao = M.criarSessao(base);
      Object.assign(E, { g: 0, i: 0, dir: Math.min(2, (base.meta.groups[0].dirs ?? 1) - 1), layer: 0, z: 0, addon: 0, sel: new Set(), selecao: null, flutuante: null, validacao: null, imp: null });
      E.addons = (base.meta.groups[0].addons ?? 1) > 1 ? 3 : 0;
      E.montado = false;
      E.montariaDeTeste ??= await montariaDeTeste();
      sujo?.limpar();
      history.replaceState(null, '', `#sprites/${f.look}`);
      await registrarOriginal();
      await pintar();
      agendarRascunho(0);
    } catch (e) {
      msg(`Não consegui abrir o sprite: ${e.message}`, 'erro');
    } finally { E.ocupado = false; }
  }
  async function montariaDeTeste() {
    try { const r = await api(`biblioteca/lista?${new URLSearchParams({ categoria: 'montarias', limite: 1 })}`); return String(r.itens?.[0]?.desenho?.look ?? '368'); } catch { return '368'; }
  }
  async function registrarOriginal() {
    const J = await jogo();
    J.registrarVariante(chaves().original, { meta: E.verdadeiro.meta, fonte: `/gamedata/sprites/outfits/${E.look}.png` });
  }
  let tRascunho = null;
  /** O rascunho entra no renderer do jogo sob a chave `rascunho:<look>` (a pré-visualização contextual o desenha como qualquer look). */
  function agendarRascunho(espera = 140) {
    clearTimeout(tRascunho);
    tRascunho = setTimeout(async () => {
      if (!E.sessao) return;
      const J = await jogo();
      const m = F.montar(estado().meta, estado().quadros);
      E.canvasRascunho = paraCanvas(m.folha, E.canvasRascunho ?? null);
      J.registrarVariante(chaves().rascunho, { meta: m.meta, fonte: E.canvasRascunho });
    }, espera);
  }
  async function sair() {
    clearTimeout(tRascunho);
    previa.parar();
    document.removeEventListener('keydown', teclas);
    teclasLigadas = false;
    if (E.look) { const J = await jogo().catch(() => null); J?.removerVariante(chaves().rascunho); J?.removerVariante(chaves().original); }
  }

  // ------------------------------------------------------------------ mudanças (histórico)
  function mudar(rotulo, fn, { leve = false } = {}) {
    const nova = M.aplicar(E.sessao, rotulo, fn);
    if (nova === E.sessao) return false;
    E.sessao = nova;
    ajustarSelecao();
    aposMudar(leve);
    return true;
  }
  function ajustarSelecao() {
    const gr = estado().meta.groups;
    E.g = Math.min(E.g, gr.length - 1);
    E.i = Math.max(0, Math.min(E.i, gr[E.g].frames - 1));
    E.sel = new Set([...E.sel].filter((k) => k < gr[E.g].frames));
  }
  function aposMudar(leve = false) {
    sujo?.[M.sujo(E.sessao) ? 'marcar' : 'limpar']();
    E.validacao = null;
    desenharCelula();
    atualizarBarra();
    if (leve) atualizarMiniatura(E.i); else { pintarLinhaDoTempo(); pintarPaineis(); }
    agendarRascunho();
  }
  const desfazer = () => { if (!M.podeDesfazer(E.sessao)) return; E.sessao = M.desfazer(E.sessao); ajustarSelecao(); E.flutuante = null; aposMudar(); };
  const refazer = () => { if (!M.podeRefazer(E.sessao)) return; E.sessao = M.refazer(E.sessao); ajustarSelecao(); aposMudar(); };

  // ------------------------------------------------------------------ canvas de pixel
  let canvasPixel = null; let canvasGrade = null; let caixaSelecao = null; let palco = null; let tmp = null;
  const pixelDe = (ev) => {
    const r = canvasPixel.getBoundingClientRect();
    const { cw, ch } = estado().meta;
    return [Math.floor(((ev.clientX - r.left) / r.width) * cw), Math.floor(((ev.clientY - r.top) / r.height) * ch)];
  };
  function desenharCelula() {
    if (!canvasPixel?.isConnected) return;
    const { cw, ch } = estado().meta;
    if (canvasPixel.width !== cw || canvasPixel.height !== ch) { canvasPixel.width = cw; canvasPixel.height = ch; }
    const z = E.zoom;
    for (const c of [canvasPixel, canvasGrade]) { c.style.width = `${cw * z}px`; c.style.height = `${ch * z}px`; }
    palco.style.width = `${cw * z}px`;
    palco.style.height = `${ch * z}px`;
    const c = canvasPixel.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, cw, ch);
    if (E.cebola && E.i > 0) { tmp = paraCanvas(M.lerCelula(estado(), E.g, E.i - 1, posAtual()), tmp); c.globalAlpha = 0.28; c.drawImage(tmp, 0, 0); c.globalAlpha = 1; }
    const base = E.trabalho ?? celulaAtual();
    const mostrar = E.tingir && E.layer === 0 && coresAtivas() && !E.trabalho ? M.comporCelula(estado(), E.g, E.i, posAtual(0), coresAtivas()) : base;
    tmp = paraCanvas(mostrar, tmp);
    c.drawImage(tmp, 0, 0);
    if (E.flutuante) { c.globalAlpha = 0.9; c.drawImage(paraCanvas(E.flutuante.bitmap), E.flutuante.x, E.flutuante.y); c.globalAlpha = 1; }
    // grade de pixels
    canvasGrade.width = cw * z;
    canvasGrade.height = ch * z;
    const g = canvasGrade.getContext('2d');
    if (E.grade && z >= 4) {
      g.strokeStyle = 'rgba(255,255,255,.12)';
      g.beginPath();
      for (let x = 0; x <= cw; x++) { g.moveTo(x * z + .5, 0); g.lineTo(x * z + .5, ch * z); }
      for (let y = 0; y <= ch; y++) { g.moveTo(0, y * z + .5); g.lineTo(cw * z, y * z + .5); }
      g.stroke();
    }
    // o centro da célula (alinhamento) e a âncora do jogo (canto inferior direito do tile de 32)
    g.strokeStyle = 'rgba(217,178,95,.55)';
    g.setLineDash([4, 4]);
    g.strokeRect(Math.max(0, cw - 32) * z + .5, Math.max(0, ch - 32) * z + .5, Math.min(32, cw) * z - 1, Math.min(32, ch) * z - 1);
    g.setLineDash([]);
    const s = E.selecao;
    caixaSelecao.hidden = !s;
    if (s) Object.assign(caixaSelecao.style, { left: `${s.x * z}px`, top: `${s.y * z}px`, width: `${s.w * z}px`, height: `${s.h * z}px` });
  }
  function iniciarEventosDoCanvas() {
    palco.addEventListener('contextmenu', (e) => e.preventDefault());
    palco.addEventListener('pointerdown', (ev) => {
      if (dis() || E.ocupado) return;
      ev.preventDefault();
      palco.setPointerCapture(ev.pointerId);
      const [x, y] = pixelDe(ev);
      const ferr = ev.button === 2 ? 'borracha' : ev.altKey ? 'conta-gotas' : E.ferramenta;
      if (E.flutuante) {
        const f = E.flutuante;
        if (x >= f.x && y >= f.y && x < f.x + f.bitmap.w && y < f.y + f.bitmap.h) { E.arrasto = { dx: x - f.x, dy: y - f.y }; return; }
        confirmarFlutuante();
      }
      if (ferr === 'conta-gotas') {
        const p = M.pixelEm(celulaAtual(), x, y);
        if (p && p[3]) { E.cor = [...p]; atualizarFerramentas(); } else msg('Pixel transparente: nada para pegar.', 'aviso');
      } else if (ferr === 'balde') {
        mudar('preencher', (e) => M.aplicarNaCelula(e, E.g, E.i, posAtual(), (b) => M.balde(b, x, y, E.cor, E.tolerancia)), { leve: true });
      } else if (ferr === 'lapis' || ferr === 'borracha') {
        E.traco = { ferr, ultimo: [x, y] };
        E.trabalho = (ferr === 'lapis' ? M.lapis : (b, p, _c, t) => M.borracha(b, p, t))(celulaAtual(), [[x, y]], E.cor, E.pincel);
        desenharCelula();
      } else if (ferr === 'selecao') {
        E.selecaoOrigem = [x, y];
        E.selecao = { x, y, w: 1, h: 1 };
        desenharCelula();
      }
    });
    palco.addEventListener('pointermove', (ev) => {
      const [x, y] = pixelDe(ev);
      coord.textContent = `${x}, ${y}`;
      if (E.arrasto && E.flutuante) { E.flutuante.x = x - E.arrasto.dx; E.flutuante.y = y - E.arrasto.dy; desenharCelula(); return; }
      if (E.traco) {
        const pts = M.linhaDePontos(E.traco.ultimo[0], E.traco.ultimo[1], x, y);
        E.trabalho = E.traco.ferr === 'lapis' ? M.lapis(E.trabalho, pts, E.cor, E.pincel) : M.borracha(E.trabalho, pts, E.pincel);
        E.traco.ultimo = [x, y];
        desenharCelula();
      } else if (E.selecaoOrigem) {
        const [ox, oy] = E.selecaoOrigem;
        const { cw, ch } = estado().meta;
        const x0 = Math.max(0, Math.min(ox, x)); const y0 = Math.max(0, Math.min(oy, y));
        const x1 = Math.min(cw - 1, Math.max(ox, x)); const y1 = Math.min(ch - 1, Math.max(oy, y));
        E.selecao = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
        desenharCelula();
      }
    });
    const soltar = () => {
      E.arrasto = null;
      E.selecaoOrigem = null;
      if (E.traco && E.trabalho) {
        const feito = E.trabalho;
        const rotulo = E.traco.ferr === 'lapis' ? 'lápis' : 'borracha';
        E.traco = null; E.trabalho = null;
        mudar(rotulo, (e) => M.aplicarNaCelula(e, E.g, E.i, posAtual(), () => feito), { leve: true });
      }
    };
    palco.addEventListener('pointerup', soltar);
    palco.addEventListener('pointercancel', soltar);
  }
  const coord = el('span', { class: 'spr-coord' }, '—');

  // ------------------------------------------------------------------ ações de edição
  const aplicarCelula = (rotulo, fn, leve = true) => mudar(rotulo, (e) => M.aplicarNaCelula(e, E.g, E.i, posAtual(), fn, { vincular: E.vincular }), { leve });
  function confirmarFlutuante() {
    const f = E.flutuante;
    E.flutuante = null;
    if (f) mudar('colar', (e) => M.aplicarNaCelula(e, E.g, E.i, posAtual(), (b) => M.colarRegiao(b, f.bitmap, f.x, f.y)), { leve: true });
    else desenharCelula();
  }
  const copiarSelecao = () => { const s = E.selecao ?? { x: 0, y: 0, w: estado().meta.cw, h: estado().meta.ch }; E.area = M.copiarRegiao(celulaAtual(), s); msg(`Copiado ${E.area.w}×${E.area.h} px.`, 'ok'); };
  const recortarSelecao = () => { if (!E.selecao) return msg('Selecione uma região primeiro (ferramenta Seleção).', 'aviso'); copiarSelecao(); aplicarCelula('recortar', (b) => M.limparRegiao(b, E.selecao)); };
  const colarArea = () => { if (!E.area) return msg('A área de transferência está vazia: copie uma região antes.', 'aviso'); E.flutuante = { bitmap: E.area, x: E.selecao?.x ?? 0, y: E.selecao?.y ?? 0 }; desenharCelula(); msg('Arraste para posicionar e aperte Enter (ou clique fora) para colar; Esc cancela.', 'aviso'); };
  const limparSelecao = () => { if (E.selecao) aplicarCelula('apagar seleção', (b) => M.limparRegiao(b, E.selecao)); };
  const mover = (dx, dy, quadroInteiro = false) => (quadroInteiro ? mudar('deslocar o quadro', (e) => M.deslocarQuadro(e, E.g, E.i, dx, dy)) : aplicarCelula('deslocar', (b) => M.deslocar(b, dx, dy)));
  const irParaQuadro = (i) => { E.i = Math.max(0, Math.min(grupo().frames - 1, i)); E.sel = new Set([E.i]); desenharCelula(); pintarLinhaDoTempo(); atualizarPaineis(); };

  // ------------------------------------------------------------------ teclado
  let teclasLigadas = false;
  function teclas(ev) {
    if (!document.querySelector('.spr-tela')) return;
    const alvo = ev.target?.tagName;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(alvo)) return;
    const k = ev.key.toLowerCase();
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && k === 'z') { ev.preventDefault(); return ev.shiftKey ? refazer() : desfazer(); }
    if (ctrl && k === 'y') { ev.preventDefault(); return refazer(); }
    if (ctrl && k === 'c') { ev.preventDefault(); return copiarSelecao(); }
    if (ctrl && k === 'x') { ev.preventDefault(); return recortarSelecao(); }
    if (ctrl && k === 'v') { ev.preventDefault(); return colarArea(); }
    if (ctrl && k === 's') { ev.preventDefault(); return salvar(); }
    if (ctrl) return;
    const atalho = { p: 'lapis', e: 'borracha', i: 'conta-gotas', f: 'balde', m: 'selecao' }[k];
    if (atalho) { E.ferramenta = atalho; return atualizarFerramentas(); }
    if (k === 'enter' && E.flutuante) return confirmarFlutuante();
    if (k === 'escape') { E.flutuante = null; E.selecao = null; return desenharCelula(); }
    if (k === 'delete' || k === 'backspace') { ev.preventDefault(); return limparSelecao(); }
    if (k === 'h') { E.grade = !E.grade; return desenharCelula(); }
    if (k === '[') { E.pincel = Math.max(1, E.pincel - 1); return atualizarFerramentas(); }
    if (k === ']') { E.pincel = Math.min(8, E.pincel + 1); return atualizarFerramentas(); }
    if (k === '+' || k === '=') { E.zoom = ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.findIndex((v) => v >= E.zoom) + 1)]; return desenharCelula(); }
    if (k === '-') { E.zoom = ZOOMS[Math.max(0, ZOOMS.findIndex((v) => v >= E.zoom) - 1)]; return desenharCelula(); }
    if (k === ',') return irParaQuadro(E.i - 1);
    if (k === '.') return irParaQuadro(E.i + 1);
    if (['1', '2', '3', '4'].includes(k)) { E.dir = Math.min(Number(k) - 1, (grupo().dirs ?? 1) - 1); return aposTrocaDeVista(); }
    if (k === ' ') { ev.preventDefault(); E.tocando = !E.tocando; return previa.desenhar(); }
    const seta = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k];
    if (seta) { ev.preventDefault(); mover(seta[0], seta[1], ev.shiftKey); }
  }

  // ------------------------------------------------------------------ peças da tela
  const botao = (texto, onclick, { titulo = null, ativo = false, desabilitado = false, classe = '' } = {}) => el('button', { type: 'button', class: `${classe}${ativo ? ' ativa' : ''}`.trim(), title: titulo, disabled: desabilitado, onclick }, texto);
  const campoNumero = (rotulo, valor, aoMudar, { min = 0, max = 9999, passo = 1, largura = 70 } = {}) => el('label', { class: 'spr-rot' }, rotulo, el('input', { type: 'number', min, max, step: passo, value: valor, style: `width:${largura}px`, onchange: (e) => aoMudar(Number(e.target.value)) }));
  const secao = (id, titulo, corpo, dica = null) => {
    const aberto = E.abertos.has(id);
    return el('details', { class: 'spr-secao', open: aberto, ontoggle: (e) => { if (e.target.open) E.abertos.add(id); else E.abertos.delete(id); if (e.target.open && id === 'validacao') { /* validação sob demanda */ } } }, el('summary', {}, titulo, dica ? el('small', {}, dica) : null), el('div', { class: 'spr-secao-corpo' }, corpo));
  };

  function seletores() {
    const gr = grupo();
    const meta = estado().meta;
    const grupos = el('div', { class: 'spr-grupo-botoes' }, meta.groups.map((g, gi) => botao(`${gi === 0 ? 'Parado' : 'Caminhada'} (${g.frames})`, () => { E.g = gi; E.i = Math.min(E.i, g.frames - 1); E.sel = new Set([E.i]); aposTrocaDeVista(); }, { ativo: E.g === gi })));
    const dirs = gr.dirs > 1 ? el('div', { class: 'spr-grupo-botoes' }, F.DIRECOES.map((n, d) => botao(n, () => { E.dir = d; aposTrocaDeVista(); }, { ativo: E.dir === d, titulo: `${n} (${d + 1})` }))) : el('span', { class: 'dica' }, 'direção única');
    const camadas = gr.layers > 1 ? el('div', { class: 'spr-grupo-botoes' }, botao('Desenho', () => { E.layer = 0; aposTrocaDeVista(); }, { ativo: E.layer === 0 }), botao('Máscara de cores', () => { E.layer = 1; aposTrocaDeVista(); }, { ativo: E.layer === 1, titulo: 'amarelo = cabeça · vermelho = corpo · verde = pernas · azul = pés' })) : null;
    const poses = gr.depth > 1 ? el('div', { class: 'spr-grupo-botoes' }, botao('Em pé', () => { E.z = 0; aposTrocaDeVista(); }, { ativo: E.z === 0 }), botao('Montada', () => { E.z = 1; aposTrocaDeVista(); }, { ativo: E.z === 1, titulo: 'A pose do personagem quando está numa montaria' })) : null;
    const addons = gr.addons > 1 ? el('div', { class: 'spr-grupo-botoes' }, Array.from({ length: gr.addons }, (_, a) => botao(a === 0 ? 'Base' : `Addon ${a}`, () => { E.addon = a; aposTrocaDeVista(); }, { ativo: E.addon === a }))) : null;
    return el('div', { class: 'spr-seletores' }, grupos, dirs, camadas, poses, addons);
  }
  function aposTrocaDeVista() { pintarSeletores(); desenharCelula(); pintarLinhaDoTempo(); atualizarPaineis(); previa.desenhar(); }
  function pintarSeletores() { document.querySelector('.spr-seletores')?.replaceWith(seletores()); }

  function barraDeFerramentas() {
    const grupoDe = (titulo, ...itens) => el('details', { class: 'spr-ferr-grupo', open: true }, el('summary', {}, titulo), el('div', { class: 'spr-ferr-corpo' }, itens));
    const bt = ([id, nome, atalho]) => botao(`${nome}`, () => { E.ferramenta = id; atualizarFerramentas(); }, { ativo: E.ferramenta === id, titulo: `${nome} (${atalho})`, classe: 'spr-ferr' });
    const hexCor = M.paraHex(E.cor);
    const recentes = paletaDaCelula();
    return el('div', { class: 'spr-ferramentas' },
      grupoDe('Desenho', el('div', { class: 'spr-ferr-linha' }, FERRAMENTAS.map(bt)),
        el('div', { class: 'spr-ferr-linha' },
          el('input', { type: 'color', value: hexCor, title: 'Cor do desenho', oninput: (e) => { E.cor = M.deHex(e.target.value, E.cor[3]); } }),
          campoNumero('opac.', E.cor[3], (v) => { E.cor = [E.cor[0], E.cor[1], E.cor[2], Math.max(0, Math.min(255, v))]; atualizarFerramentas(); }, { min: 0, max: 255, largura: 56 }),
          campoNumero('pincel', E.pincel, (v) => { E.pincel = Math.max(1, Math.min(8, v)); }, { min: 1, max: 8, largura: 46 })),
        E.cor[3] !== 255 ? el('div', { class: 'dica' }, 'Opacidade menor que 255 cria pixels semitransparentes (suavização): pixel art costuma usar só opaco ou transparente.') : null,
        el('div', { class: 'spr-recentes', title: 'Cores desta célula (clique para pegar)' }, recentes.map((c) => el('button', { type: 'button', class: 'spr-amostra', style: `background:rgb(${c[0]},${c[1]},${c[2]})`, title: M.paraHex(c), onclick: () => { E.cor = [c[0], c[1], c[2], 255]; atualizarFerramentas(); } }))),
        E.ferramenta === 'balde' ? campoNumero('tolerância', E.tolerancia, (v) => { E.tolerancia = Math.max(0, Math.min(255, v)); }, { min: 0, max: 255, largura: 56 }) : null),
      grupoDe('Seleção', el('div', { class: 'spr-ferr-linha' }, botao('Copiar', copiarSelecao, { titulo: 'Ctrl+C' }), botao('Recortar', recortarSelecao, { titulo: 'Ctrl+X' }), botao('Colar', colarArea, { titulo: 'Ctrl+V' }), botao('Apagar', limparSelecao, { titulo: 'Delete' }))),
      grupoDe('Transformar',
        el('div', { class: 'spr-ferr-linha' }, botao('⇋ Espelhar H', () => aplicarCelula('espelhar horizontal', (b) => M.espelhar(b, 'h')), { titulo: 'Espelha esquerda ↔ direita' }), botao('⇅ Espelhar V', () => aplicarCelula('espelhar vertical', (b) => M.espelhar(b, 'v')))),
        el('div', { class: 'spr-ferr-linha spr-setas' }, botao('←', () => mover(-1, 0), { titulo: 'Mover 1px (setas; Shift = quadro inteiro)' }), botao('↑', () => mover(0, -1)), botao('↓', () => mover(0, 1)), botao('→', () => mover(1, 0)), botao('Centralizar', () => aplicarCelula('centralizar', (b) => M.centralizar(b)))),
        el('div', { class: 'spr-ferr-linha' }, botao('Mover o quadro todo →', () => mover(1, 0, true), { titulo: 'Desloca TODAS as direções e camadas do quadro (alinhamento)' }), botao('← ', () => mover(-1, 0, true)), botao('↑', () => mover(0, -1, true)), botao('↓', () => mover(0, 1, true))),
        el('label', { class: 'spr-rot' }, el('input', { type: 'checkbox', checked: E.vincular, onchange: (e) => { E.vincular = e.target.checked; } }), 'a máscara acompanha o desenho (espelhar, mover)'),
        el('div', { class: 'spr-ferr-linha' }, botao('Endurecer alfa', () => aplicarCelula('endurecer alfa', (b) => M.endurecerAlfa(b)), { titulo: 'Remove a suavização: transparente ou opaco' }), botao('Trocar cor…', trocarCor))),
      grupoDe('Visão',
        el('label', { class: 'spr-rot' }, 'zoom', el('select', { onchange: (e) => { E.zoom = Number(e.target.value); desenharCelula(); } }, ZOOMS.map((v) => el('option', { value: v, selected: v === E.zoom }, `${v}×`)))),
        el('label', { class: 'spr-rot' }, el('input', { type: 'checkbox', checked: E.grade, onchange: (e) => { E.grade = e.target.checked; desenharCelula(); } }), 'grade de pixels (H)'),
        el('label', { class: 'spr-rot' }, el('input', { type: 'checkbox', checked: E.cebola, onchange: (e) => { E.cebola = e.target.checked; desenharCelula(); } }), 'quadro anterior (cebola)'),
        coresAtivas() ? el('label', { class: 'spr-rot' }, el('input', { type: 'checkbox', checked: E.tingir, onchange: (e) => { E.tingir = e.target.checked; desenharCelula(); } }), 'ver com as cores do outfit') : null));
  }
  function paletaDaCelula() {
    const vistos = new Map();
    const b = celulaAtual();
    for (let i = 0; i < b.data.length && vistos.size < 24; i += 4) if (b.data[i + 3] === 255) vistos.set(`${b.data[i]},${b.data[i + 1]},${b.data[i + 2]}`, [b.data[i], b.data[i + 1], b.data[i + 2]]);
    return [...vistos.values()];
  }
  async function trocarCor() {
    const de = await pedirCor('Trocar a cor…', 'Cor a trocar (hexadecimal, ex.: #ff00ff):');
    if (!de) return;
    aplicarCelula('trocar cor', (b) => M.substituirCor(b, de, E.cor));
  }
  const pedirCor = async (titulo, rotulo) => {
    const t = await pedirTexto(titulo, { rotulo, valor: M.paraHex(E.cor), validar: (x) => (M.deHex(x) ? '' : 'Use o formato #rrggbb.') });
    if (t == null) return null;
    const c = M.deHex(t, 255);
    if (!c) { msg('Cor inválida: use #rrggbb.', 'erro'); return null; }
    return c;
  };
  function atualizarFerramentas() { document.querySelector('.spr-ferramentas')?.replaceWith(barraDeFerramentas()); }

  // ------------------------------------------------------------------ linha do tempo
  const miniaturas = new Map();
  function miniatura(i) {
    const e = estado();
    const bm = M.comporCelula(e, E.g, i, posAtual(0), coresAtivas());
    const c = paraCanvas(bm);
    c.className = 'spr-mini-canvas';
    const dur = e.meta.groups[E.g].animation?.durations?.[i];
    const ms = Array.isArray(dur) ? dur[0] : dur;
    const vazio = !F.temPixel(M.lerCelula(e, E.g, i, posAtual()));
    const n = el('div', { class: `spr-quadro${E.i === i ? ' atual' : ''}${E.sel.has(i) ? ' selecionado' : ''}${vazio ? ' vazio' : ''}`, draggable: 'true', 'data-i': i, title: `Quadro ${i + 1}${vazio ? ' (vazio nesta direção)' : ''} · arraste para reordenar`,
      onclick: (ev) => {
        if (ev.shiftKey && E.sel.size) { const [a] = [...E.sel]; const [lo, hi] = [Math.min(a, i), Math.max(a, i)]; E.sel = new Set(Array.from({ length: hi - lo + 1 }, (_, k) => lo + k)); E.i = i; }
        else if (ev.ctrlKey || ev.metaKey) { E.sel.has(i) ? E.sel.delete(i) : E.sel.add(i); E.i = i; }
        else { E.i = i; E.sel = new Set([i]); }
        desenharCelula(); pintarLinhaDoTempo(); atualizarPaineis();
      },
      ondragstart: (ev) => { ev.dataTransfer.setData('text/plain', String(i)); ev.dataTransfer.effectAllowed = 'move'; },
      ondragover: (ev) => { ev.preventDefault(); n.classList.add('alvo'); },
      ondragleave: () => n.classList.remove('alvo'),
      ondrop: (ev) => { ev.preventDefault(); const de = Number(ev.dataTransfer.getData('text/plain')); n.classList.remove('alvo'); if (Number.isInteger(de) && de !== i && mudar('reordenar quadros', (s) => M.moverQuadro(s, E.g, de, i))) { E.i = i; E.sel = new Set([i]); aposMudar(); } } },
      c, el('span', { class: 'spr-quadro-n' }, String(i + 1)), el('small', {}, ms ? `${ms}ms` : '200ms'));
    miniaturas.set(i, n);
    return n;
  }
  function atualizarMiniatura(i) { const n = miniaturas.get(i); if (n?.isConnected) n.replaceWith(miniatura(i)); }
  function linhaDoTempo() {
    miniaturas.clear();
    const e = estado();
    const gr = grupo();
    const alvo = () => [...(E.sel.size ? E.sel : new Set([E.i]))].sort((a, b) => a - b);
    const acao = (rotulo, fn) => () => { if (!dis()) mudar(rotulo, fn); };
    const duplicar = acao('duplicar quadros', (s) => alvo().reverse().reduce((x, i) => M.duplicarQuadro(x, E.g, i), s));
    const remover = async () => {
      if (dis()) return;
      const lista = alvo();
      if (lista.length >= gr.frames) return msg('O recurso precisa de pelo menos 1 quadro.', 'aviso');
      if (!(await confirmar('Remover quadro(s)?', `Remove ${lista.length} quadro(s) de TODAS as direções e camadas deste grupo (a linha da imagem inteira). Dá para desfazer com Ctrl+Z.`, { ok: 'Remover', perigo: true }))) return;
      mudar('remover quadros', (s) => lista.slice().reverse().reduce((x, i) => M.removerQuadro(x, E.g, i), s));
      E.sel = new Set([E.i]);
      aposMudar();
    };
    const mover = (delta) => () => { const i = E.i; const para = i + delta; if (para < 0 || para >= gr.frames) return; if (mudar('mover quadro', (s) => M.moverQuadro(s, E.g, i, para))) { E.i = para; E.sel = new Set([para]); aposMudar(); } };
    const ms = (() => { const d = gr.animation?.durations?.[E.i]; return Array.isArray(d) ? d[0] : (d ?? 200); })();
    return el('section', { class: 'spr-tempo hunt-sec' },
      el('div', { class: 'spr-tempo-topo' }, el('h3', {}, `Linha do tempo — ${E.g === 0 ? 'parado' : 'caminhada'} · ${F.DIRECOES[E.dir] ?? 'direção única'} · ${gr.frames} quadro(s)`),
        el('div', { class: 'spr-tempo-acoes' },
          botao('◀', () => irParaQuadro(E.i - 1), { titulo: 'Quadro anterior (,)' }), botao('▶', () => irParaQuadro(E.i + 1), { titulo: 'Próximo quadro (.)' }),
          botao(E.tocando ? '⏸' : '▶ play', () => { E.tocando = !E.tocando; previa.desenhar(); pintarLinhaDoTempo(); }, { titulo: 'Reproduzir / pausar (espaço)', ativo: E.tocando }),
          el('span', { class: 'spr-sep' }),
          botao('+ duplicar', duplicar, { desabilitado: dis() }), botao('+ vazio', acao('inserir quadro vazio', (s) => M.inserirQuadroVazio(s, E.g, E.i)), { desabilitado: dis() }),
          botao('copiar', () => { E.copiaQuadro = M.copiarQuadro(estado(), E.g, E.i); msg(`Quadro ${E.i + 1} copiado (todas as direções).`, 'ok'); }),
          botao('colar', acao('colar quadro', (s) => (E.copiaQuadro ? M.colarQuadro(s, E.g, E.i, E.copiaQuadro) : s)), { desabilitado: dis() || !E.copiaQuadro }),
          botao('← mover', mover(-1), { desabilitado: dis() }), botao('mover →', mover(1), { desabilitado: dis() }),
          botao('✕ remover', remover, { desabilitado: dis(), classe: 'perigo' }),
          el('span', { class: 'spr-sep' }),
          campoNumero('duração (ms)', ms, (v) => { if (!dis()) mudar('duração do quadro', (s) => M.definirDuracao(s, E.g, E.i, Math.max(10, Math.min(60000, v)))); }, { min: 10, max: 60000, passo: 10, largura: 70 }),
          campoNumero('FPS', M.fpsDoGrupo(e, E.g), (v) => { if (!dis()) mudar('FPS do grupo', (s) => M.definirFps(s, E.g, v)); }, { min: 1, max: 60, passo: 1, largura: 56 }))),
      el('div', { class: 'spr-quadros' }, Array.from({ length: gr.frames }, (_, i) => miniatura(i))),
      el('div', { class: 'dica' }, 'Clique para escolher o quadro · Ctrl/Shift para vários · arraste para reordenar. Os quadros são compartilhados pelas direções (o formato do jogo guarda uma linha por quadro): reordenar/duplicar/remover vale para todas.'));
  }
  function pintarLinhaDoTempo() { document.querySelector('.spr-tempo')?.replaceWith(linhaDoTempo()); }

  // ------------------------------------------------------------------ painéis
  const resumoDaFolha = () => { const m = estado().meta; const e = F.estruturaDe(m); return `${e.w}×${e.h} px · ${m.cw}×${m.ch} por quadro · ${e.cols} colunas × ${e.linhas} linhas`; };
  function painelCadastro() {
    const e = estado();
    const m = e.meta;
    const gr = grupo();
    const tamanho = { cw: m.cw, ch: m.ch };
    const aplicarTamanho = async () => {
      if (dis() || (tamanho.cw === m.cw && tamanho.ch === m.ch)) return;
      if (!(await confirmar('Mudar o tamanho do quadro?', `Muda TODAS as células de ${m.cw}×${m.ch} para ${tamanho.cw}×${tamanho.ch} (o desenho fica ancorado no canto inferior direito, como no jogo). O tamanho do quadro afeta o alinhamento no mapa: confira no modo contextual. Dá para desfazer.`, { ok: 'Mudar tamanho' }))) return;
      mudar('tamanho do quadro', (s) => M.redimensionarQuadros(s, tamanho.cw, tamanho.ch));
      E.imp = null; aposMudar(); desenharCelula();
    };
    const loop = gr.animation?.loop ?? 0;
    return el('div', { class: 'spr-cadastro' },
      el('div', { class: 'dica' }, resumoDaFolha()),
      el('div', { class: 'spr-linha' }, campoNumero('largura do quadro', m.cw, (v) => { tamanho.cw = v; }, { min: 8, max: 256, largura: 64 }), campoNumero('altura', m.ch, (v) => { tamanho.ch = v; }, { min: 8, max: 256, largura: 64 }), botao('Aplicar tamanho', aplicarTamanho, { desabilitado: dis() })),
      el('div', { class: 'spr-linha' }, campoNumero('deslocamento x (shift)', m.shift[0], (v) => { if (!dis()) mudar('shift', (s) => M.definirShift(s, v, s.meta.shift[1])); }, { min: -64, max: 64, largura: 60 }), campoNumero('y', m.shift[1], (v) => { if (!dis()) mudar('shift', (s) => M.definirShift(s, s.meta.shift[0], v)); }, { min: -64, max: 64, largura: 60 })),
      el('div', { class: 'dica' }, 'O shift fica no cadastro, mas o renderer atual do jogo ancora a criatura no canto do tile e NÃO o aplica (ver limitações). Para alinhar, mova os pixels (quadro inteiro).'),
      el('div', { class: 'spr-linha' }, el('label', { class: 'spr-rot' }, 'loop', el('select', { disabled: dis() || gr.frames < 2, onchange: (ev) => { mudar('loop', (s) => M.definirLoop(s, E.g, Number(ev.target.value))); } }, [[0, 'repete para sempre (0)'], [-1, 'vai e volta (-1)'], [1, '1 vez'], [2, '2 vezes'], [3, '3 vezes']].map(([v, n]) => el('option', { value: v, selected: v === loop }, n)))), el('small', { class: 'dica' }, 'guardado no cadastro; o renderer atual repete sempre')),
      el('div', { class: 'dica' }, `Estrutura (fixa, o jogo lê por ela): ${gr.dirs} direção(ões) × ${gr.layers} camada(s) × ${gr.addons} addon(s) × ${gr.depth} pose(s).`),
      el('details', { class: 'spr-tempos' }, el('summary', {}, `Duração de cada quadro (${E.g === 0 ? 'parado' : 'caminhada'})`),
        el('div', { class: 'spr-tempos-grade' }, Array.from({ length: gr.frames }, (_, i) => { const d = gr.animation?.durations?.[i]; return campoNumero(`#${i + 1}`, Array.isArray(d) ? d[0] : (d ?? 200), (v) => { if (!dis()) mudar('duração do quadro', (s) => M.definirDuracao(s, E.g, i, Math.max(10, Math.min(60000, v)))); }, { min: 10, max: 60000, passo: 10, largura: 62 }); }))));
  }

  // ---- cores do outfit (só quando há máscara)
  function painelDeCores() {
    if (!coresAtivas()) return el('div', { class: 'dica' }, 'Este desenho não tem máscara de cores: não há cor dinâmica para testar.');
    const trocar = (slot) => (i) => { E.cores = { ...E.cores, [slot]: i }; aposCores(); };
    const sorteio = () => { E.cores = Object.fromEntries(SLOTS_DE_COR.map(([s]) => [s, Math.floor(Math.random() * 133)])); pintarPaineis(); aposCores(); };
    return el('div', { class: 'spr-cores' },
      el('div', { class: 'dica' }, 'Visualização das cores dinâmicas do jogo: a máscara (amarelo/vermelho/verde/azul) decide onde cada cor cai. Os pixels da folha NÃO mudam — só a visualização.'),
      el('div', { class: 'spr-cores-slots' }, SLOTS_DE_COR.map(([slot, nome]) => seletorDeCor(nome, E.cores[slot], trocar(slot)))),
      el('div', { class: 'spr-linha' }, botao('Cores aleatórias', sorteio), botao('Padrão do jogo', () => { E.cores = { ...CORES_PADRAO }; pintarPaineis(); aposCores(); }),
        grupo().addons > 1 ? el('label', { class: 'spr-rot' }, 'addons vestidos', el('select', { onchange: (ev) => { E.addons = Number(ev.target.value); previa.desenhar(); } }, [[0, 'nenhum'], [1, 'addon 1'], [2, 'addon 2'], [3, 'os dois']].map(([v, n]) => el('option', { value: v, selected: v === E.addons }, n)))) : null,
        estado().meta.groups[0].depth > 1 && E.categoria !== 'montarias' ? el('label', { class: 'spr-rot' }, el('input', { type: 'checkbox', checked: E.montado, onchange: (ev) => { E.montado = ev.target.checked; previa.desenhar(); } }), 'montado (usa a montaria de teste)') : null));
  }
  function aposCores() { desenharCelula(); pintarLinhaDoTempo(); previa.desenhar(); }

  // ---- montaria: o cavaleiro de teste
  function painelDoCavaleiro() {
    if (E.categoria !== 'montarias') return null;
    return el('div', { class: 'spr-cavaleiro' },
      el('div', { class: 'dica' }, 'Personagem de teste montado: o jogo desenha a montaria no tile e o personagem por cima, no MESMO ponto, na pose montada do outfit dele. Para mexer na altura do cavaleiro, edite a pose "Montada" do outfit — vale para todas as montarias (o jogo não tem deslocamento por montaria; ver limitações).'),
      el('div', { class: 'spr-linha' }, campoNumero('outfit do cavaleiro (look)', E.cavaleiro.look, (v) => { E.cavaleiro.look = String(v); previa.desenhar(); }, { min: 1, max: 99999, largura: 80 }),
        el('label', { class: 'spr-rot' }, 'addons', el('select', { onchange: (ev) => { E.cavaleiro.addons = Number(ev.target.value); previa.desenhar(); } }, [[0, 'nenhum'], [1, 'addon 1'], [2, 'addon 2'], [3, 'os dois']].map(([v, n]) => el('option', { value: v, selected: v === E.cavaleiro.addons }, n))))),
      el('div', { class: 'spr-cores-slots' }, SLOTS_DE_COR.map(([slot, nome]) => seletorDeCor(nome, E.cavaleiro.cores[slot], (i) => { E.cavaleiro.cores = { ...E.cavaleiro.cores, [slot]: i }; pintarPaineis(); previa.desenhar(); }))));
  }

  // ---- importação
  function painelImportar() {
    const I = E.imp;
    const arquivo = el('input', { type: 'file', accept: 'image/png', onchange: async (ev) => { const f = ev.target.files?.[0]; if (f) await abrirImagem(f); } });
    if (!I) return el('div', {}, el('div', { class: 'dica' }, 'Importe um PNG individual ou uma spritesheet. Você vê os recortes antes de confirmar; nada é gravado até salvar.'), arquivo);
    const cel = F.estruturaDe(estado().meta);
    const { cw, ch } = estado().meta;
    const grade = I.modo === 'celula' ? null : gradeAtual();
    const sug = I.sugestoes?.length ? el('div', { class: 'spr-sugestoes' }, el('span', { class: 'dica' }, 'grades prováveis:'), I.sugestoes.map((s) => botao(`${s.cw}×${s.ch} (${s.cols}×${s.linhas})`, () => { Object.assign(I, { cw: s.cw, ch: s.ch, margemX: 0, margemY: 0, espacoX: 0, espacoY: 0 }); pintarPaineis(); }, { titulo: `${s.cheias} células com desenho · corte ${s.corte}` }))) : null;
    const alvo = el('div', { class: 'spr-linha' },
      el('label', { class: 'spr-rot' }, 'grupo', el('select', { onchange: (ev) => { I.g = Number(ev.target.value); pintarPaineis(); } }, estado().meta.groups.map((_, gi) => el('option', { value: gi, selected: I.g === gi }, gi === 0 ? 'parado' : 'caminhada')))),
      grupo().layers > 1 ? el('label', { class: 'spr-rot' }, 'camada', el('select', { onchange: (ev) => { I.camada = Number(ev.target.value); } }, [[0, 'desenho'], [1, 'máscara']].map(([v, n]) => el('option', { value: v, selected: I.camada === v }, n)))) : null,
      grupo().depth > 1 ? el('label', { class: 'spr-rot' }, 'pose', el('select', { onchange: (ev) => { I.z = Number(ev.target.value); } }, [[0, 'em pé'], [1, 'montada']].map(([v, n]) => el('option', { value: v, selected: I.z === v }, n)))) : null,
      grupo().addons > 1 ? el('label', { class: 'spr-rot' }, 'addon', el('select', { onchange: (ev) => { I.addon = Number(ev.target.value); } }, Array.from({ length: grupo().addons }, (_, a) => el('option', { value: a, selected: I.addon === a }, a === 0 ? 'base' : `addon ${a}`)))) : null,
      I.modo === 'sequencia' ? el('label', { class: 'spr-rot' }, 'direção', el('select', { onchange: (ev) => { I.dir = Number(ev.target.value); } }, F.DIRECOES.map((n, d) => el('option', { value: d, selected: I.dir === d }, n)))) : null,
      el('label', { class: 'spr-rot' }, 'ancorar', el('select', { onchange: (ev) => { I.ancora = ev.target.value; } }, [['baixo-direita', 'canto inferior direito (jogo)'], ['centro', 'centro'], ['cima-esquerda', 'canto superior esquerdo']].map(([v, n]) => el('option', { value: v, selected: I.ancora === v }, n)))));
    return el('div', { class: 'spr-importar' },
      el('div', { class: 'spr-linha' }, arquivo, el('span', { class: 'dica' }, `${I.nome} · ${I.bitmap.w}×${I.bitmap.h}`), botao('Descartar imagem', () => { E.imp = null; pintarPaineis(); })),
      el('label', { class: 'spr-rot' }, 'como distribuir', el('select', { onchange: (ev) => { I.modo = ev.target.value; pintarPaineis(); } }, MODOS_DE_IMPORTACAO.map(([v, n]) => el('option', { value: v, selected: I.modo === v }, n)))),
      I.modo !== 'celula' ? el('div', { class: 'spr-linha' },
        campoNumero('largura da célula', I.cw, (v) => { I.cw = v; pintarPaineis(); }, { min: 1, max: 1024, largura: 64 }), campoNumero('altura', I.ch, (v) => { I.ch = v; pintarPaineis(); }, { min: 1, max: 1024, largura: 64 }),
        campoNumero('margem x', I.margemX, (v) => { I.margemX = v; pintarPaineis(); }, { min: 0, max: 512, largura: 52 }), campoNumero('y', I.margemY, (v) => { I.margemY = v; pintarPaineis(); }, { min: 0, max: 512, largura: 52 }),
        campoNumero('espaço x', I.espacoX, (v) => { I.espacoX = v; pintarPaineis(); }, { min: 0, max: 512, largura: 52 }), campoNumero('y', I.espacoY, (v) => { I.espacoY = v; pintarPaineis(); }, { min: 0, max: 512, largura: 52 }),
        botao('Sugerir grade', () => { I.sugestoes = M.sugerirGrades(I.bitmap); if (I.sugestoes[0]) Object.assign(I, { cw: I.sugestoes[0].cw, ch: I.sugestoes[0].ch, margemX: 0, margemY: 0, espacoX: 0, espacoY: 0 }); pintarPaineis(); }, { titulo: 'Detecta o tamanho de quadro que divide a imagem sem cortar o desenho' }),
        botao('Detectar regiões', () => { I.regioes = M.detectarRegioes(I.bitmap); I.modo = 'sequencia'; I.usarRegioes = true; msg(`${I.regioes.length} região(ões) detectada(s) (recorte automático).`, 'ok'); pintarPaineis(); }, { titulo: 'Recorte automático por regiões soltas (separadas por linhas/colunas vazias)' })) : null,
      sug,
      el('div', { class: 'dica' }, I.modo === 'celula' ? `A imagem inteira (${I.bitmap.w}×${I.bitmap.h}) vira a célula selecionada (${cw}×${ch}).${I.bitmap.w !== cw || I.bitmap.h !== ch ? ' Tamanho diferente: será ajustada (recorte/margem transparente).' : ''}` : (grade ? `${grade.cols} coluna(s) × ${grade.linhas} linha(s) = ${grade.celulas.length} célula(s)${I.usarRegioes ? ' (regiões detectadas)' : ''}. O recurso usa ${cw}×${ch} por quadro e ${cel.cols} colunas.` : '')),
      alvo, previaDaImportacao(grade),
      el('div', { class: 'spr-linha' }, botao('Aplicar importação', aplicarImportacao, { desabilitado: dis(), classe: 'primario' }), el('span', { class: 'dica' }, 'Entra no histórico (dá para desfazer) e só vai para o arquivo ao salvar.')));
  }
  function gradeAtual() {
    const I = E.imp;
    if (I.usarRegioes && I.regioes?.length) {
      const celulas = M.regioesComoCelulas(I.bitmap, I.regioes, I.cw, I.ch, I.ancora).map((c, k) => ({ ...c, col: k, linha: 0 }));
      return { cols: celulas.length, linhas: 1, celulas };
    }
    const cols = Math.floor((I.bitmap.w - I.margemX + I.espacoX) / Math.max(1, I.cw + I.espacoX));
    const linhas = Math.floor((I.bitmap.h - I.margemY + I.espacoY) / Math.max(1, I.ch + I.espacoY));
    if (cols * linhas > 4096) return { cols: 0, linhas: 0, celulas: [] }; // grade absurda (células minúsculas): não recorta
    return M.recortarGrade(I.bitmap, { cw: I.cw, ch: I.ch, margemX: I.margemX, margemY: I.margemY, espacoX: I.espacoX, espacoY: I.espacoY });
  }
  function previaDaImportacao(grade) {
    const I = E.imp;
    const esc = Math.max(1, Math.min(3, Math.floor(420 / Math.max(1, I.bitmap.w))));
    const fonte = paraCanvas(I.bitmap);
    fonte.className = 'spr-imp-fonte spr-xadrez';
    fonte.style.width = `${I.bitmap.w * esc}px`;
    fonte.style.height = `${I.bitmap.h * esc}px`;
    const sobre = el('canvas', { class: 'spr-imp-sobre', width: I.bitmap.w * esc, height: I.bitmap.h * esc });
    const c = sobre.getContext('2d');
    c.strokeStyle = 'rgba(217,178,95,.9)';
    if (I.modo !== 'celula' && grade) for (const cel of grade.celulas.slice(0, 600)) { if (I.usarRegioes) c.strokeRect(cel.x * esc + .5, cel.y * esc + .5, cel.w * esc, cel.h * esc); else c.strokeRect(cel.x * esc + .5, cel.y * esc + .5, I.cw * esc, I.ch * esc); }
    // recorte MANUAL: arrastar um retângulo na imagem adiciona uma região
    let origem = null;
    const ponto = (ev) => { const r = sobre.getBoundingClientRect(); return [Math.max(0, Math.min(I.bitmap.w - 1, Math.floor(((ev.clientX - r.left) / r.width) * I.bitmap.w))), Math.max(0, Math.min(I.bitmap.h - 1, Math.floor(((ev.clientY - r.top) / r.height) * I.bitmap.h)))]; };
    sobre.addEventListener('pointerdown', (ev) => { origem = ponto(ev); sobre.setPointerCapture(ev.pointerId); });
    sobre.addEventListener('pointerup', (ev) => {
      if (!origem) return;
      const [x, y] = ponto(ev);
      const r = { x: Math.min(origem[0], x), y: Math.min(origem[1], y), w: Math.abs(x - origem[0]) + 1, h: Math.abs(y - origem[1]) + 1 };
      origem = null;
      if (r.w < 3 || r.h < 3) return;
      I.regioes = [...(I.usarRegioes ? I.regioes ?? [] : []), r]; I.usarRegioes = true; I.modo = I.modo === 'celula' ? 'sequencia' : I.modo;
      msg(`Recorte manual adicionado (${r.w}×${r.h}). Total: ${I.regioes.length}.`, 'ok'); pintarPaineis();
    });
    const miniaturasDasCelulas = grade && I.modo !== 'celula' ? el('div', { class: 'spr-imp-celulas' }, grade.celulas.slice(0, 96).map((cel, k) => { const cv = paraCanvas(cel.bitmap); cv.className = 'spr-xadrez'; cv.title = `célula ${k + 1}`; return cv; }), grade.celulas.length > 96 ? el('small', { class: 'dica' }, `+${grade.celulas.length - 96}…`) : null) : null;
    return el('div', { class: 'spr-imp-previa' }, el('div', { class: 'spr-imp-palco' }, fonte, sobre), el('div', { class: 'dica' }, 'Arraste na imagem para recortar manualmente uma região.'), I.usarRegioes ? botao('Limpar recortes', () => { I.regioes = []; I.usarRegioes = false; pintarPaineis(); }) : null, miniaturasDasCelulas);
  }
  async function abrirImagem(arquivo) {
    try {
      const bitmap = await bitmapDeBlob(arquivo);
      const { cw, ch } = estado().meta;
      const sugestoes = M.sugerirGrades(bitmap);
      const igual = bitmap.w === cw && bitmap.h === ch;
      E.imp = { bitmap, nome: arquivo.name, modo: igual ? 'celula' : (bitmap.w === F.estruturaDe(estado().meta).w ? 'folha-do-jogo' : 'direcoes-em-linhas'), cw: sugestoes[0]?.cw ?? cw, ch: sugestoes[0]?.ch ?? ch, margemX: 0, margemY: 0, espacoX: 0, espacoY: 0, g: E.g, camada: 0, z: E.z, addon: E.addon, dir: E.dir, ancora: 'baixo-direita', sugestoes };
      const avisos = [];
      if (!bitmap.data.some((v, i) => i % 4 === 3 && v === 0)) avisos.push('A imagem não tem nenhum pixel transparente (fundo sólido?).');
      if (avisos.length) msg(avisos.join(' '), 'aviso');
      E.abertos.add('importar');
      pintarPaineis();
    } catch (e) { msg(`Não consegui ler a imagem: ${e.message}`, 'erro'); }
  }
  function aplicarImportacao() {
    const I = E.imp;
    if (!I || dis()) return;
    let resultado;
    if (I.modo === 'celula') {
      const { cw, ch } = estado().meta;
      const aj = M.ajustarCelula(I.bitmap, cw, ch, I.ancora);
      const ok = mudar('importar PNG na célula', (e) => M.gravarCelula(e, E.g, E.i, posAtual(), aj));
      if (ok) msg(`Imagem importada na célula (quadro ${E.i + 1}).${I.bitmap.w !== cw || I.bitmap.h !== ch ? ' Foi ajustada ao tamanho do quadro.' : ''}`, 'ok');
      return;
    }
    const grade = gradeAtual();
    if (!grade.celulas.length) return msg('Nenhuma célula para importar: ajuste o tamanho da grade.', 'erro');
    resultado = M.distribuirImportacao(estado(), grade, { modo: I.modo, g: I.g, camada: I.camada ?? 0, z: I.z ?? 0, addon: I.addon ?? 0, dir: I.dir ?? 2, ancora: I.ancora });
    if (resultado.erro) return msg(resultado.erro, 'erro');
    mudar('importar spritesheet', () => resultado.estado);
    E.imp = null;
    aposMudar();
    msg(`Spritesheet importada.${resultado.avisos?.length ? ` ${resultado.avisos.join(' ')}` : ''}`, resultado.avisos?.length ? 'aviso' : 'ok');
  }

  // ---- exportação
  function painelExportar() {
    const e = estado();
    const nome = `${E.categoria}-${E.look}`;
    const faz = (fn) => async () => { try { await fn(); } catch (err) { msg(err.message, 'erro'); } };
    return el('div', { class: 'spr-exportar' },
      el('div', { class: 'spr-linha' },
        botao('PNG do quadro', faz(async () => baixar(await paraPngBlob(celulaAtual()), `${nome}-${F.DIRECOES[E.dir] ?? 'dir'}-q${E.i + 1}.png`)), { titulo: 'A célula atual (camada selecionada, pixels exatos)' }),
        botao('Sequência (faixa)', faz(async () => baixar(await paraPngBlob(M.faixaDeQuadros(Array.from({ length: grupo().frames }, (_, i) => M.lerCelula(e, E.g, i, posAtual())))), `${nome}-${E.g === 0 ? 'parado' : 'caminhada'}-${F.DIRECOES[E.dir] ?? 'dir'}.png`)), { titulo: 'Todos os quadros desta direção lado a lado' }),
        botao('Spritesheet completa', faz(async () => baixar(await paraPngBlob(F.montar(e.meta, e.quadros).folha), `${nome}-folha.png`)), { titulo: 'A folha no formato do jogo (pode ser reimportada)' }),
        botao('Configuração (JSON)', faz(async () => baixar(M.configuracaoDaAnimacao(e.meta, E.look), `${nome}-animacao.json`, 'application/json')))),
      el('div', { class: 'dica' }, 'Exportar não altera nada. A folha completa tem o mesmo formato do arquivo do jogo, então o que você exporta pode ser reimportado ("Folha no formato do jogo").'));
  }

  // ---- validação
  async function validar() {
    const e = estado();
    const m = F.montar(e.meta, e.quadros);
    const local = { erros: [], avisos: [] };
    const orig = { folha: F.montar(E.verdadeiro.meta, E.verdadeiro.quadros).folha, meta: E.verdadeiro.meta };
    const v1 = F.validarMeta(m.meta, E.verdadeiro.meta);
    const v2 = v1.erros.length ? { erros: [], avisos: [] } : F.validarPixels(m.folha, m.meta, orig);
    local.erros.push(...v1.erros, ...v2.erros); local.avisos.push(...v1.avisos, ...v2.avisos);
    let servidor = null;
    try { servidor = await api('overrides/sprites/validar', { look: E.look, meta: m.meta, png: await paraPngBase64(m.folha) }); } catch (err) { local.erros.push(`O servidor não validou: ${err.message}`); }
    E.validacao = { local, servidor, ok: !local.erros.length && servidor?.ok !== false, quando: Date.now() };
    pintarPaineis();
    return E.validacao;
  }
  function painelValidacao() {
    const v = E.validacao;
    const lista = (itens, classe) => (itens.length ? el('ul', { class: classe }, itens.map((t) => el('li', {}, t))) : null);
    return el('div', { class: 'spr-validacao' },
      el('div', { class: 'spr-linha' }, botao('Validar agora', validar, { classe: 'primario' }), el('span', { class: 'dica' }, 'Confere estrutura, quadros, direções, transparência, máscara e compatibilidade com o renderer — no navegador e no servidor.')),
      !v ? null : el('div', {},
        el('p', { class: v.ok ? 'dica' : 'bib-alerta' }, v.ok ? 'Sem erros. Pode salvar.' : 'Há erros que impedem salvar.'),
        lista([...new Set([...v.local.erros, ...(v.servidor?.erros ?? [])])], 'spr-erros'),
        lista([...new Set([...v.local.avisos, ...(v.servidor?.avisos ?? [])])], 'spr-avisos'),
        v.servidor?.estatisticas ? el('div', { class: 'dica' }, `Pixels: ${v.servidor.estatisticas.opacos} opacos · ${v.servidor.estatisticas.meios} semitransparentes · ${v.servidor.estatisticas.quadrosVazios} quadro(s) vazio(s).`) : null));
  }

  // ---- histórico
  function painelHistorico() {
    const h = M.historicoDe(E.sessao);
    return el('div', {}, el('div', { class: 'spr-linha' }, botao('↶ Desfazer', desfazer, { desabilitado: !M.podeDesfazer(E.sessao), titulo: 'Ctrl+Z' }), botao('↷ Refazer', refazer, { desabilitado: !M.podeRefazer(E.sessao), titulo: 'Ctrl+Y' }), el('span', { class: 'dica' }, `${h.length} alteração(ões) desde que abriu${E.sessao.futuro.length ? ` · ${E.sessao.futuro.length} para refazer` : ''}`)),
      h.length ? el('ol', { class: 'spr-historico' }, h.slice().reverse().slice(0, 40).map((r) => el('li', {}, r))) : el('div', { class: 'dica' }, 'Nada alterado ainda.'));
  }

  // ---- referências
  function painelReferencias() {
    const f = E.ficha;
    const u = f.usos;
    const lista = (titulo, itens, abrir) => (itens.length ? el('div', {}, el('b', {}, `${titulo} (${itens.length})`), el('div', { class: 'spr-refs' }, itens.slice(0, 30).map((i) => (abrir ? el('button', { type: 'button', class: 'fantasma', onclick: () => abrir(i) }, i.nome ?? i.key) : el('span', { class: 'selo' }, i.nome ?? i.key))))) : null);
    return el('div', { class: 'spr-referencias' },
      el('div', { class: 'dica' }, `look ${f.look} · ${resumoDoOriginal()}`),
      lista('Monstros que usam este desenho', u.monstros, irPara ? (m) => irPara('mobs', null, ['editar', m.key]) : null),
      lista('Montarias', u.montarias, null), lista('Outfits', u.outfits, null),
      !u.total ? el('div', { class: 'dica' }, 'Nenhum cadastro usa este look agora.') : el('div', { class: 'dica' }, 'Mudar o desenho muda a aparência de todos eles; os dados de combate, loot e comportamento não são tocados.'),
      el('div', { class: 'dica' }, 'Arquivos que o salvar grava: game/gamedata/overrides/sprites/<look>.png e game/gamedata/overrides/sprites.json. O original (outfits.json + sprites/outfits) fica intacto.'),
      f.versoes.length ? el('div', {}, el('b', {}, 'Versões anteriores da imagem'), el('ul', { class: 'spr-versoes' }, f.versoes.map((v) => el('li', {}, `v${v.versao} · ${v.hash} · quadros ${v.quadros.join('/')} `, !dis() ? botao('restaurar', () => restaurarVersao(v.versao)) : null)))) : null);
  }
  const resumoDoOriginal = () => { const m = E.verdadeiro.meta; return `original ${m.w}×${m.h} · ${m.cw}×${m.ch} por quadro · quadros ${m.groups.map((g) => g.frames).join('/')}`; };

  function pintarPaineis() {
    const alvo = document.querySelector('.spr-paineis');
    if (alvo) alvo.replaceWith(paineis());
  }
  function atualizarPaineis() { pintarPaineis(); }
  function paineis() {
    const outros = painelDoCavaleiro();
    return el('div', { class: 'spr-paineis' },
      secao('cadastro', 'Cadastro (quadros, tamanho, tempos)', painelCadastro(), resumoDaFolha()),
      coresAtivas() ? secao('cores', 'Cores do outfit (visualização)', painelDeCores()) : null,
      outros ? secao('cavaleiro', 'Cavaleiro de teste (montaria)', outros) : null,
      secao('importar', 'Importar PNG / spritesheet', painelImportar()),
      secao('exportar', 'Exportar', painelExportar()),
      secao('validacao', 'Validação', painelValidacao(), E.validacao ? (E.validacao.ok ? 'ok' : 'com erros') : null),
      secao('historico', 'Histórico', painelHistorico(), `${M.historicoDe(E.sessao).length}`),
      secao('refs', 'Referências, arquivos e versões', painelReferencias()));
  }

  // ------------------------------------------------------------------ salvar / descartar / restaurar
  const barra = () => el('div', { class: 'spr-acoes' },
    el('b', { id: 'spr-contagem' }),
    botao('↶', desfazer, { titulo: 'Desfazer (Ctrl+Z)', desabilitado: !M.podeDesfazer(E.sessao) }), botao('↷', refazer, { titulo: 'Refazer (Ctrl+Y)', desabilitado: !M.podeRefazer(E.sessao) }),
    botao('Validar', validar), botao('Descartar alterações', descartarTudo, { desabilitado: !M.sujo(E.sessao) }),
    botao('Salvar override', salvar, { classe: 'primario', desabilitado: dis() || !M.sujo(E.sessao), titulo: 'Ctrl+S' }),
    E.ficha?.override ? botao('Voltar ao original', voltarAoOriginal, { classe: 'perigo', desabilitado: dis(), titulo: 'Apaga o override deste look' }) : null,
    E.ficha?.override ? botao(E.ficha.override.ativo === false ? 'Ligar override' : 'Desligar override', alternarAtivo, { desabilitado: dis() }) : null);
  function atualizarBarra() {
    const b = document.querySelector('.spr-acoes');
    if (b) b.replaceWith(barra());
    const c = document.querySelector('#spr-contagem');
    if (c) c.textContent = M.sujo(E.sessao) ? `${M.historicoDe(E.sessao).length} alteração(ões) não salva(s)` : (E.ficha?.override ? 'override salvo' : 'sem alterações');
  }
  async function descartarTudo() {
    if (!M.sujo(E.sessao)) return;
    if (!(await confirmar('Descartar as alterações?', 'Volta ao último estado salvo. As alterações desta tela se perdem (o histórico também).', { ok: 'Descartar', perigo: true }))) return;
    E.sessao = M.descartar(E.sessao);
    E.flutuante = null; E.validacao = null;
    sujo?.limpar();
    ajustarSelecao();
    await pintar();
    agendarRascunho(0);
  }
  async function salvar() {
    if (dis()) return msg('Somente leitura neste servidor (produção): edite localmente, salve, faça commit e publique pelo deploy.', 'aviso');
    if (!M.sujo(E.sessao)) return msg('Sem alterações para salvar.', 'aviso');
    if (E.flutuante) confirmarFlutuante();
    const v = await validar();
    if (!v.ok) { E.abertos.add('validacao'); pintarPaineis(); return msg('Há erros: corrija antes de salvar (painel Validação).', 'erro'); }
    const e = estado();
    const m = F.montar(e.meta, e.quadros);
    const avisos = [...new Set([...v.local.avisos, ...(v.servidor?.avisos ?? [])])];
    const mudancas = v.servidor?.mudancasNoCadastro ?? [];
    const texto = [`Look ${E.look} (${NOME_DA_CATEGORIA[E.categoria] ?? ''}) — usado por ${E.ficha.usos.total} cadastro(s).`, mudancas.length ? `Cadastro: ${mudancas.join('; ')}.` : 'O cadastro de quadros não muda (só a imagem).', `Arquivos gravados: ${(v.servidor?.arquivosAfetados ?? []).join(', ')}.`, avisos.length ? `Atenção: ${avisos.slice(0, 4).join(' ')}` : '', 'O original não é tocado. O jogo só usa depois do commit + deploy.'].filter(Boolean).join('\n');
    if (!(await confirmar('Salvar o override de sprite?', texto, { ok: 'Salvar' }))) return;
    E.ocupado = true;
    try {
      const r = await api('overrides/sprites', { acao: 'salvar', look: E.look, meta: m.meta, png: await paraPngBase64(m.folha), revisao: E.ficha.revisao });
      if (await tratarConflito(r, () => abrir(E.look))) return;
      if (r.ok === false) return msg((r.erros ?? ['Não salvou.']).join(' '), 'erro');
      msg(`Override salvo. ${r.comoPublicar ?? ''}`, 'ok');
      sujo?.limpar();
      await abrir(E.look);
    } catch (err) { msg(`Não salvou: ${err.message}`, 'erro'); } finally { E.ocupado = false; }
  }
  async function voltarAoOriginal() {
    if (!(await confirmar('Voltar ao sprite original?', 'Apaga o override deste look (a imagem e o cadastro de quadros). O jogo volta ao desenho original depois do próximo deploy. A versão apagada fica no histórico de versões.', { ok: 'Apagar override', perigo: true }))) return;
    const r = await api('overrides/sprites', { acao: 'reverter', look: E.look, revisao: E.ficha.revisao });
    if (await tratarConflito(r, () => abrir(E.look))) return;
    if (r.ok === false) return msg((r.erros ?? ['Não reverteu.']).join(' '), 'erro');
    msg('Override removido: o look voltou ao original.', 'ok');
    sujo?.limpar();
    await abrir(E.look);
  }
  async function alternarAtivo() {
    const r = await api('overrides/sprites', { acao: 'ativo', look: E.look, ativo: E.ficha.override.ativo === false, revisao: E.ficha.revisao });
    if (await tratarConflito(r, () => abrir(E.look))) return;
    if (r.ok === false) return msg((r.erros ?? ['Não alterou.']).join(' '), 'erro');
    msg(E.ficha.override.ativo === false ? 'Override ligado.' : 'Override desligado (o jogo usa o original).', 'ok');
    await abrir(E.look);
  }
  async function restaurarVersao(v) {
    if (!(await confirmar(`Restaurar a versão ${v}?`, 'A imagem atual vai para o histórico e a versão escolhida volta a ser o override.', { ok: 'Restaurar' }))) return;
    const r = await api('overrides/sprites', { acao: 'restaurar', look: E.look, versao: v, revisao: E.ficha.revisao });
    if (await tratarConflito(r, () => abrir(E.look))) return;
    if (r.ok === false) return msg((r.erros ?? ['Não restaurou.']).join(' '), 'erro');
    msg(`Versão ${v} restaurada.`, 'ok');
    await abrir(E.look);
  }

  // ------------------------------------------------------------------ a tela
  const previa = criarPrevia({ E, atual: estado, original: () => E.verdadeiro, coresAtivas, get chaves() { return chaves(); } });
  async function pintar() {
    const f = E.ficha;
    const cab = cabecalho('Editor de sprites', 'Monstros, outfits e montarias num só editor: edita uma cópia (override) e nunca o original. Salvar grava o override; o jogo só usa depois do commit + deploy.',
      irPara ? botao('← Escolher outro sprite', () => irPara('sprites')) : null);
    palco = el('div', { class: 'spr-palco spr-xadrez' });
    canvasPixel = el('canvas', { class: 'spr-pixel' });
    canvasGrade = el('canvas', { class: 'spr-grade' });
    caixaSelecao = el('div', { class: 'spr-selecao', hidden: true });
    palco.append(canvasPixel, canvasGrade, caixaSelecao);
    iniciarEventosDoCanvas();
    raiz().replaceChildren(cab, el('div', { class: 'spr-tela' },
      el('div', { class: 'spr-titulo' },
        retrato({ tipo: 'criatura', look: E.look, cores: coresAtivas() ?? undefined }, 56, { categoria: 'monstros', imediato: true }),
        el('div', {}, el('h2', {}, `${nomeDoRecurso()}`), el('div', { class: 'dica' }, `${NOME_DA_CATEGORIA[f.categoria] ?? 'Sprite'} · look ${f.look} · ${f.override ? (f.override.ativo === false ? 'override DESLIGADO' : 'tem override salvo') : 'original'} · usado em ${f.usos.total} cadastro(s)`))),
      !podeGravar() ? el('div', { class: 'bib-alerta' }, 'Somente leitura neste servidor (produção): dá para ver, editar na tela e exportar, mas não salvar. Para salvar, rode a Engine localmente, faça commit e publique pelo deploy.') : null,
      barra(),
      el('div', { class: 'spr-fluxo niv-fluxo' }, ['1 · Editar (na tela)', '2 · Validar', '3 · Salvar override (arquivo)', '4 · Publicar (commit + deploy)'].map((t, i) => el('span', { class: i === 0 ? 'ativa' : '' }, t))),
      seletores(),
      el('div', { class: 'spr-principal' },
        barraDeFerramentas(),
        el('div', { class: 'spr-edicao' }, el('div', { class: 'spr-edicao-topo' }, el('b', {}, `Quadro ${E.i + 1} · ${F.DIRECOES[E.dir] ?? 'direção única'}`), coord, el('span', { class: 'dica' }, 'tracejado dourado = o tile de 32×32 do jogo (âncora no canto inferior direito)')), el('div', { class: 'spr-edicao-palco' }, palco)),
        el('div', { class: 'spr-lado' }, previa.elemento)),
      linhaDoTempo(),
      paineis()));
    desenharCelula();
    atualizarBarra();
    if (!teclasLigadas) { document.addEventListener('keydown', teclas); teclasLigadas = true; }
    await previa.desenhar();
  }
  const nomeDoRecurso = () => { const u = E.ficha.usos; return u.monstros[0]?.nome ?? u.montarias[0]?.nome ?? u.outfits[0]?.nome ?? `look ${E.look}`; };

  // ---- escolher o sprite
  async function picker() {
    await sair();
    E.look = null; E.sessao = null;
    sujo?.limpar();
    history.replaceState(null, '', '#sprites');
    const buscar = async () => {
      const q = E.q.trim();
      let itens = [];
      if (E.cat === 'com-override') {
        const r = await api('overrides/sprites');
        itens = await Promise.all(r.itens.map(async (i) => { const l = await api(`overrides/sprites/${i.look}`).catch(() => null); return { id: i.look, nome: l?.usos?.monstros?.[0]?.nome ?? l?.usos?.montarias?.[0]?.nome ?? l?.usos?.outfits?.[0]?.nome ?? `look ${i.look}`, desenho: { tipo: 'criatura', look: i.look }, look: i.look, override: true, ativo: i.ativo }; }));
      } else if (/^\d+$/.test(q) && E.cat === 'look') {
        itens = [{ id: q, nome: `look ${q}`, desenho: { tipo: 'criatura', look: q }, look: q }];
      } else {
        const r = await api(`biblioteca/lista?${new URLSearchParams({ categoria: E.cat, q, limite: 80, ordem: 'nome' })}`);
        itens = (r.itens ?? []).map((i) => ({ id: i.id, nome: i.nome ?? i.id, desenho: i.desenho, look: i.desenho?.look ?? null, tipo: i.tipo })).filter((i) => i.look != null);
      }
      lista.replaceChildren(...(itens.length ? itens.map((i) => el('button', { type: 'button', class: 'eng-card spr-card', onclick: () => irPara ? irPara('sprites', null, [String(i.look)]) : abrir(i.look) }, retrato(i.desenho, 64, { categoria: 'monstros' }), el('b', { class: 'eng-card-nome' }, i.nome), el('span', { class: 'eng-id' }, `look ${i.look}`), i.override ? el('span', { class: 'selo' }, i.ativo === false ? 'override desligado' : 'com override') : null)) : [el('div', { class: 'dica' }, 'Nada encontrado.')]));
    };
    const lista = el('div', { class: 'eng-cards spr-cards' });
    raiz().replaceChildren(
      cabecalho('Editor de sprites', 'Escolha o recurso (monstro, outfit ou montaria) ou digite um look. O editor abre a folha de sprites dele para editar quadros, direções e animação.'),
      el('div', { class: 'spr-busca' },
        el('select', { onchange: (e) => { E.cat = e.target.value; buscar(); } }, [['monstros', 'Monstros'], ['outfits', 'Outfits'], ['montarias', 'Montarias'], ['com-override', 'Com override'], ['look', 'Por número do look']].map(([v, n]) => el('option', { value: v, selected: E.cat === v }, n))),
        el('input', { type: 'search', placeholder: 'buscar por nome, ID ou número do look…', value: E.q, oninput: (e) => { E.q = e.target.value; clearTimeout(E.tBusca); E.tBusca = setTimeout(buscar, 200); } })),
      lista);
    await buscar();
  }

  async function desenhar(resto = []) {
    const look = Array.isArray(resto) ? resto[0] : resto;
    if (look) return abrir(look);
    return picker();
  }
  return { desenhar, abrir: (_c, id) => abrir(id), focarBusca: () => document.querySelector('.spr-busca input')?.focus(), sujoAgora: () => !!E.sessao && M.sujo(E.sessao), sair };
}
