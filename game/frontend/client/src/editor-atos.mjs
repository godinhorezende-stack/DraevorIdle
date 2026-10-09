// A aba "Atos" do editor de conteúdo: monta um ato visualmente (fases, ligações, boss final) sobre os cadastros da Biblioteca. NENHUMA regra
// mora aqui: o servidor valida (`systems/atos-modelo.mjs`) e grava (`admin/atos.mjs`); a tela só edita uma cópia e pede a validação a cada
// mudança. Os atos legados (os 4 de hoje) são somente leitura: "Duplicar" cria o rascunho editável.
// Recebe as ferramentas da página (`el`, `api`, a raiz, `msg`) em vez de importá-las, para não fechar ciclo com `editor-conteudo.mjs`.
import { confirmar, pedirTexto, descartarAlteracoes, tratarConflito } from './editor-ui.mjs';
import { editorDeDrops } from './editor-poe-telas.mjs';
import { retrato } from './editor-sprites.mjs';

const POE = '/api/mapas/_engine/itens-poe/';
const poeApi = async (rota, corpo) => (await fetch(POE + rota, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) } : {})).json();

/** O ID do ato: a tela só exige que não fique vazio — o formato é o servidor quem confere. */
const obrigatorio = (v) => (v ? null : 'Digite um ID.');

import { tabelaDeDrops } from './editor-drops.mjs';
import { vistaValidacao, vistaPrevia, vistaVersoes, vistaPublicacao } from './editor-atos-vistas.mjs';
import { vistaMapa } from './editor-atos-mapa.mjs';
import { organizarAto } from './atos-layout.mjs';

const NS = 'http://www.w3.org/2000/svg';
const L = 920;
const A = 520;
const RAIO = 24;
const CATEGORIAS_DE_HUNT = ['hunts', 'vips', 'especiais', 'divinas'];
const NIVEIS = ['facil', 'medio', 'dificil'];

/** Posição de cada fase: a gravada (`posicao`) ou uma grade automática por profundidade (colunas = passos desde a fase inicial). Pura. */
export function posicoesAutomaticas(ato) {
  const prof = new Map();
  const saidas = new Map(ato.fases.map((f) => [f.id, []]));
  for (const c of ato.conexoes) saidas.get(c.de)?.push(c.para);
  const fila = ato.inicio && saidas.has(ato.inicio) ? [[ato.inicio, 0]] : [];
  while (fila.length) {
    const [id, d] = fila.shift();
    if ((prof.get(id) ?? -1) >= d) continue;
    if (d > ato.fases.length) continue; // ciclo: o validador reclama; aqui só não trava
    prof.set(id, d);
    for (const p of saidas.get(id) ?? []) fila.push([p, d + 1]);
  }
  let extra = Math.max(-1, ...prof.values()) + 1;
  for (const f of ato.fases) if (!prof.has(f.id)) prof.set(f.id, extra++ % 8); // isoladas: espalha para ficarem visíveis
  const colunas = new Map();
  for (const f of ato.fases) {
    const d = prof.get(f.id);
    colunas.set(d, [...(colunas.get(d) ?? []), f.id]);
  }
  // Muitas colunas (ato longo): dobra em faixas de até 6 colunas, para os nós e nomes não se amontoarem.
  const largura = Math.max(1, ...colunas.keys()) + 1;
  const POR_FAIXA = 6;
  const cols = Math.min(largura, POR_FAIXA);
  const faixas = Math.ceil(largura / cols);
  const altura = A / faixas;
  const pos = new Map();
  for (const [d, ids] of colunas) {
    const faixa = Math.floor(d / cols);
    const c = d % cols;
    ids.forEach((id, i) => {
      const f = ato.fases.find((x) => x.id === id);
      const x = 70 + (cols > 1 ? (c * (L - 220)) / (cols - 1) : 0);
      const y = faixa * altura + (altura / (ids.length + 1)) * (i + 1);
      pos.set(id, f.posicao && Number.isFinite(f.posicao.x) ? { x: f.posicao.x, y: f.posicao.y } : { x, y });
    });
  }
  return pos;
}

export function criarEditorDeAtos({ el, api, raiz, msg, modo = 'atos', irPara = null }) {
  // `modo: 'fases'`: a MESMA edição, organizada por fase (aba Campanha → Fases): a lista das fases do ato à esquerda e, à direita, os painéis da fase
  // (dados, como conclui, mapa e mobs, recompensa) — sem o grafo (as ligações ficam na aba Acts).
  const E = { vista: 'fluxo', difPrevia: 'facil', lista: [], opcoes: null, ato: null, somenteLeitura: false, fase: null, lig: null, ligando: null, problemas: [], limpo: '', picker: { alvo: null, q: '', itens: [], detalhe: null },
    // Ferramentas: histórico (desfazer/refazer), grade, zoom/arrasto do grafo, a ajuda de atalhos.
    hist: { passado: [], futuro: [], ultimo: '' }, grade: true, zoom: 1, pan: { x: 0, y: 0 }, ajuda: false, ferramentas: false };
  const sv = (tag, attrs = {}, ...filhos) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v);
    for (const f of filhos.flat()) if (f != null) n.append(f.nodeType ? f : document.createTextNode(String(f)));
    return n;
  };
  const sujo = () => E.ato && JSON.stringify(E.ato) !== E.limpo;
  const faseDe = (id) => E.ato?.fases.find((f) => f.id === id);
  const campo = (rotulo, valor, aoMudar, props = {}) => el('label', { class: 'campo' }, rotulo, el('input', { value: valor ?? '', disabled: E.somenteLeitura, ...props, onchange: (e) => aoMudar(e.target.value) }));
  const numero = (v) => (v === '' || v == null ? null : Number(v));
  const selecao = (rotulo, valor, opcoes, aoMudar, vazio = null) =>
    el('label', { class: 'campo' }, rotulo, el('select', { disabled: E.somenteLeitura, onchange: (e) => aoMudar(e.target.value || null) }, vazio ? el('option', { value: '' }, vazio) : null, opcoes.map(([v, n]) => el('option', { value: v, selected: v === valor }, n))));

  // ------------------------------------------------------------------ dados
  async function carregarLista() {
    const r = await api('atos-editor');
    E.lista = r.atos;
    E.opcoes = { tiposDeFase: r.tiposDeFase, tiposDeConclusao: r.tiposDeConclusao ?? [], estados: r.estados };
  }
  async function abrir(id) {
    if (sujo() && !(await descartarAlteracoes('O ato aberto tem alterações não salvas'))) return;
    const r = await api(`atos-editor/${id}`);
    E.ato = r.ato;
    E.somenteLeitura = !!r.ato.legado?.somenteLeitura;
    E.limpo = JSON.stringify(E.ato);
    E.problemas = r.problemas;
    E.fase = null;
    E.lig = null;
    E.ligando = null;
    E.vista = 'fluxo';
    E.hist = { passado: [], futuro: [], ultimo: JSON.stringify(E.ato) };
    E.zoom = 1;
    E.pan = { x: 0, y: 0 };
    pintar();
  }
  let esperando = null;
  /** Guarda o passo no histórico (o que estava antes desta mudança) — o Ctrl+Z volta para ele. */
  function lembrar() {
    const agora = JSON.stringify(E.ato);
    if (agora === E.hist.ultimo) return;
    E.hist.passado.push(E.hist.ultimo);
    if (E.hist.passado.length > 100) E.hist.passado.shift();
    E.hist.futuro = [];
    E.hist.ultimo = agora;
  }
  function voltarPara(json, de, para) {
    if (!json) return;
    para.push(JSON.stringify(E.ato));
    E.ato = JSON.parse(json);
    E.hist.ultimo = json;
    if (E.fase && !faseDe(E.fase)) E.fase = null;
    if (E.lig != null && !E.ato.conexoes[E.lig]) E.lig = null;
    pintar();
    revalidar();
  }
  const desfazer = () => voltarPara(E.hist.passado.pop(), E.hist.passado, E.hist.futuro);
  const refazer = () => voltarPara(E.hist.futuro.pop(), E.hist.futuro, E.hist.passado);
  function revalidar() {
    clearTimeout(esperando);
    esperando = setTimeout(async () => {
      const r = await api('atos-editor/validar', E.ato);
      E.problemas = r.problemas ?? [];
      pintarProblemas();
    }, 350);
  }
  function mudou() {
    lembrar();
    pintar();
    clearTimeout(esperando);
    esperando = setTimeout(async () => {
      const r = await api('atos-editor/validar', E.ato);
      E.problemas = r.problemas ?? [];
      pintarProblemas();
    }, 350);
  }
  async function salvar() {
    const r = await api('atos-editor', E.ato);
    if (await tratarConflito(r, async () => { E.limpo = JSON.stringify(E.ato); await abrir(E.ato.id); })) return;
    if (r.ok === false) return msg(r.erros?.join(' ') ?? 'Não salvou.', 'erro');
    E.ato = r.ato;
    E.limpo = JSON.stringify(E.ato);
    E.problemas = r.problemas;
    await carregarLista();
    msg(`Rascunho salvo (versão ${r.ato.versao}).${r.valido ? '' : ' Há erros na validação: o ato ainda não pode ir para beta.'}`, r.valido ? 'ok' : 'aviso');
    pintar();
  }
  async function restaurar(n) {
    if (!(await confirmar(`Restaurar a versão ${n}?`, 'Cria uma versão NOVA com o conteúdo dela, como rascunho. Nada é apagado.', { ok: 'Restaurar' }))) return;
    const r = await api(`atos-editor/${E.ato.id}/restaurar`, { versao: n });
    if (r.ok === false) return msg(r.erros.join(' '), 'erro');
    E.ato = r.ato;
    E.limpo = JSON.stringify(E.ato);
    E.problemas = r.problemas;
    await carregarLista();
    msg(`Versão ${n} restaurada como versão ${r.ato.versao} (rascunho).`, 'ok');
    pintar();
  }
  async function mudarEstado(estado) {
    if (E.ato.estado === estado) return msg(`O ato já está em ${estado}.`, 'aviso');
    const antes = E.ato.estado;
    E.ato.estado = estado;
    const r = await api('atos-editor', E.ato);
    if (await tratarConflito(r, async () => { E.limpo = JSON.stringify(E.ato); await abrir(E.ato.id); })) { E.ato.estado = antes; return; }
    if (r.ok === false) { E.ato.estado = antes; msg(r.erros.join(' '), 'erro'); return pintar(); }
    E.ato = r.ato;
    E.limpo = JSON.stringify(E.ato);
    E.problemas = r.problemas;
    await carregarLista();
    msg(`Estado do ato: ${estado} (versão ${r.ato.versao}). ${['beta', 'publicado'].includes(estado) ? 'Vale no próximo boot do servidor (com o deploy).' : ''}`, 'ok');
    pintar();
  }
  async function duplicar() {
    const novoId = await pedirTexto('Duplicar ato', { rotulo: 'ID do novo ato (minúsculas, números e hífen)', valor: `${E.ato.id}-copia`.replace(/^legado-/, 'ato-'), validar: obrigatorio });
    if (!novoId) return;
    const r = await api('atos-editor', { duplicar: E.ato.id, novoId });
    if (r.ok === false) return msg(r.erros.join(' '), 'erro');
    await carregarLista();
    E.limpo = '';
    await abrir(r.ato.id);
    msg('Cópia criada como rascunho. As hunts continuam as do original: troque-as antes de validar.', 'ok');
  }
  async function novo() {
    const id = await pedirTexto('Novo ato', { rotulo: 'ID do novo ato (minúsculas, números e hífen)', valor: 'ato-novo', validar: obrigatorio });
    if (!id) return;
    const r = await api('atos-editor', { id, nome: 'Novo ato', fases: [], conexoes: [] });
    if (r.ok === false) return msg(r.erros.join(' '), 'erro');
    await carregarLista();
    E.limpo = '';
    await abrir(id);
  }
  async function excluir() {
    if (!(await confirmar(`Excluir o rascunho "${E.ato.id}"?`, 'Os cadastros do jogo não são tocados.', { ok: 'Excluir', perigo: true }))) return;
    const r = await api('atos-editor', { excluir: E.ato.id });
    if (r.ok === false) return msg(r.erros.join(' '), 'erro');
    E.ato = null;
    E.limpo = '';
    await carregarLista();
    pintar();
  }

  // ------------------------------------------------------------------ edição
  function novaFase(posicao = null) {
    const n = E.ato.fases.length + 1;
    let id = `fase-${n}`;
    while (faseDe(id)) id = `${id}-x`;
    E.ato.fases.push({ id, nome: `Fase ${n}`, descricao: '', ordem: n, huntId: null, tipo: 'hunt-normal', nivel: null, obrigatoria: true, requisitos: { exige: [] }, objetivos: [], conclusao: { tipo: 'limpar-hunt' }, recompensas: null, eventos: [], sobrescritas: {}, posicao: null });
    if (posicao) E.ato.fases.at(-1).posicao = { x: Math.round(posicao.x), y: Math.round(posicao.y) };
    if (!E.ato.inicio) E.ato.inicio = id;
    E.fase = id;
    mudou();
  }
  function removerFase(id) {
    E.ato.fases = E.ato.fases.filter((f) => f.id !== id);
    E.ato.conexoes = E.ato.conexoes.filter((c) => c.de !== id && c.para !== id);
    for (const f of E.ato.fases) f.requisitos.exige = f.requisitos.exige.filter((x) => x !== id);
    if (E.ato.inicio === id) E.ato.inicio = E.ato.fases[0]?.id ?? null;
    if (E.ato.bossFinal?.faseAnterior === id) E.ato.bossFinal.faseAnterior = null;
    E.fase = null;
    mudou();
  }
  function renomearFase(velho, novoId) {
    if (!novoId || faseDe(novoId)) return msg('ID de fase vazio ou já usado.', 'erro');
    const f = faseDe(velho);
    f.id = novoId;
    for (const c of E.ato.conexoes) {
      if (c.de === velho) c.de = novoId;
      if (c.para === velho) c.para = novoId;
      if (c.requisito?.exige) c.requisito.exige = c.requisito.exige.map((x) => (x === velho ? novoId : x));
    }
    for (const g of E.ato.fases) g.requisitos.exige = g.requisitos.exige.map((x) => (x === velho ? novoId : x));
    if (E.ato.inicio === velho) E.ato.inicio = novoId;
    if (E.ato.bossFinal?.faseAnterior === velho) E.ato.bossFinal.faseAnterior = novoId;
    E.fase = novoId;
    mudou();
  }
  function ligar(de, para) {
    if (de === para) return msg('A fase não pode se ligar a si mesma.', 'erro');
    if (E.ato.conexoes.some((c) => c.de === de && c.para === para)) return msg('Essa ligação já existe.', 'aviso');
    E.ato.conexoes.push({ de, para, requisito: null, rotulo: '' });
    E.lig = E.ato.conexoes.length - 1;
    E.fase = null;
    mudou();
  }

  // ------------------------------------------------------------------ ferramentas do grafo
  /** Zoom em torno de um ponto (frações da tela, 0..1). 1 = o ato inteiro. */
  function zoomEm(fator, fx = 0.5, fy = 0.5) {
    const z = Math.min(4, Math.max(1, E.zoom * fator));
    const wx = E.pan.x + fx * (L / E.zoom);
    const wy = E.pan.y + fy * (A / E.zoom);
    E.zoom = z;
    E.pan = z === 1 ? { x: 0, y: 0 } : { x: Math.max(-L / 2, Math.min(L, wx - fx * (L / z))), y: Math.max(-A / 2, Math.min(A, wy - fy * (A / z))) };
    pintar();
  }
  /** Centraliza a vista numa fase (busca, Page Up/Down). */
  function focarFase(id) {
    const p = posicoesAutomaticas(E.ato).get(id);
    E.fase = id;
    E.lig = null;
    if (p && E.zoom > 1) E.pan = { x: p.x - L / E.zoom / 2, y: p.y - A / E.zoom / 2 };
    pintar();
  }
  /** Organiza as fases automaticamente: o fluxo do início (embaixo à esquerda, a cidade ao lado) à fase do chefe (em cima à direita), sem nada
   * sobreposto (`atos-layout.mjs`). */
  function organizar() {
    lembrar();
    const { fases, cidade } = organizarAto(E.ato);
    for (const f of E.ato.fases) { const p = fases.get(f.id); if (p) f.posicao = p; }
    if (E.ato.cidade && cidade) E.ato.cidade.posicao = cidade;
    mudou();
  }
  /** A fase anterior/seguinte (pela ordem) à selecionada. */
  function vizinhaDaSelecionada(passo) {
    const l = [...E.ato.fases].sort((a, b) => (a.ordem ?? 1e9) - (b.ordem ?? 1e9));
    const i = l.findIndex((f) => f.id === E.fase);
    const alvo = l[i < 0 ? 0 : (i + passo + l.length) % l.length];
    if (alvo) focarFase(alvo.id);
  }
  function moverSelecionada(dx, dy) {
    const f = faseDe(E.fase);
    if (!f || E.somenteLeitura) return;
    const p = f.posicao ?? posicoesAutomaticas(E.ato).get(f.id) ?? { x: 100, y: 100 };
    f.posicao = { x: Math.min(L - 30, Math.max(30, p.x + dx)), y: Math.min(A - 40, Math.max(30, p.y + dy)) };
    mudou();
  }

  // ------------------------------------------------------------------ canvas
  function pintarCanvas() {
    const pos = posicoesAutomaticas(E.ato);
    const alcance = new Set(E.problemas.filter((p) => /isolada/.test(p.mensagem)).map((p) => p.onde.replace('fase ', '')));
    const comErro = new Set(E.problemas.filter((p) => p.nivel === 'erro' && p.onde.startsWith('fase ')).map((p) => p.onde.replace('fase ', '')));
    const svg = sv('svg', { viewBox: `${E.pan.x} ${E.pan.y} ${L / E.zoom} ${A / E.zoom}`, class: 'atos-canvas', role: 'img', 'aria-label': 'Fluxo do ato' },
      sv('defs', {}, sv('marker', { id: 'seta', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, sv('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#8aa0c8' })),
        sv('marker', { id: 'seta-sel', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, sv('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#ffd166' }))));
    if (E.grade) {
      const linhas = [];
      for (let x = 0; x <= L; x += 20) linhas.push(sv('line', { x1: x, y1: 0, x2: x, y2: A, stroke: 'rgba(140,160,200,0.07)', 'stroke-width': 1 }));
      for (let y = 0; y <= A; y += 20) linhas.push(sv('line', { x1: 0, y1: y, x2: L, y2: y, stroke: 'rgba(140,160,200,0.07)', 'stroke-width': 1 }));
      svg.append(sv('g', { 'pointer-events': 'none' }, ...linhas));
    }
    // A imagem de fundo do ato (o mapa desenhado por trás do grafo).
    // `slice` cobre o espaço todo cortando a sobra — a MESMA regra da tela do jogo (world-arte.mjs): o nó cai no mesmo ponto da arte nos dois.
    if (E.ato.imagem) svg.append(sv('image', { href: `/api/mapas/_conteudo/atos-imagem/${encodeURIComponent(E.ato.imagem)}?v=${E.versaoDaImagem ?? 0}`, x: 0, y: 0, width: L, height: A, preserveAspectRatio: 'xMidYMid slice', opacity: 0.55 }));
    E.ato.conexoes.forEach((c, i) => {
      const a = pos.get(c.de);
      const b = pos.get(c.para);
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const x1 = a.x + (dx / d) * RAIO;
      const y1 = a.y + (dy / d) * RAIO;
      const x2 = b.x - (dx / d) * (RAIO + 4);
      const y2 = b.y - (dy / d) * (RAIO + 4);
      const sel = E.lig === i;
      const g = sv('g', { class: 'atos-lig', style: 'cursor:pointer', onclick: null });
      g.addEventListener('click', (ev) => { ev.stopPropagation(); E.lig = i; E.fase = null; pintar(); });
      g.append(sv('line', { x1, y1, x2, y2, stroke: 'transparent', 'stroke-width': 14 }), sv('line', { x1, y1, x2, y2, stroke: sel ? '#ffd166' : '#8aa0c8', 'stroke-width': sel ? 3 : 2, 'marker-end': `url(#${sel ? 'seta-sel' : 'seta'})`, 'stroke-dasharray': c.requisito?.exige?.length ? '6 4' : null }));
      svg.append(g);
    });
    // Ligação do boss final: da fase anterior ao portal.
    const bf = E.ato.bossFinal;
    const ult = bf?.faseAnterior ? pos.get(bf.faseAnterior) : null;
    if (ult) {
      const bx = Math.min(L - 50, ult.x + 110);
      svg.append(sv('line', { x1: ult.x + RAIO, y1: ult.y, x2: bx - 26, y2: ult.y, stroke: '#b57bff', 'stroke-width': 2, 'stroke-dasharray': '2 5', 'marker-end': 'url(#seta)' }),
        sv('circle', { cx: bx, cy: ult.y, r: 24, fill: '#2a1a40', stroke: '#b57bff', 'stroke-width': 2 }), sv('text', { x: bx, y: ult.y + 4, 'text-anchor': 'middle', fill: '#e8c8ff', 'font-size': 10 }, 'BOSS'),
        sv('text', { x: bx, y: ult.y + 42, 'text-anchor': 'middle', fill: '#b57bff', 'font-size': 10 }, bf.bossId ? bf.bossId.slice(0, 18) : 'sem boss'));
    }
    // A CIDADE (o nó de partida, verde — dono, 07/10): no Fluxo só se mostra, com as estradas dela; posiciona-se na vista Mapa.
    if (E.ato.cidade) {
      const c = E.ato.cidade;
      const pc = c.posicao ?? { x: 40, y: A / 2 };
      for (const id of c.conexoes ?? []) { const b = pos.get(id); if (b) svg.append(sv('line', { x1: pc.x, y1: pc.y, x2: b.x, y2: b.y, stroke: '#4fae4a', 'stroke-width': 2, 'stroke-dasharray': '6 4', 'marker-end': 'url(#seta)' })); }
      svg.append(sv('g', { transform: `translate(${pc.x} ${pc.y})` }, sv('circle', { r: RAIO, fill: '#1f4a30', stroke: '#4fae4a', 'stroke-width': 2.5 }), sv('text', { y: 4, 'text-anchor': 'middle', fill: '#dfffe0', 'font-size': 11 }, '⌂'), sv('text', { y: RAIO + 14, 'text-anchor': 'middle', fill: '#9ad99a', 'font-size': 10.5 }, c.nome)));
    }
    for (const f of E.ato.fases) {
      const p = pos.get(f.id);
      const sel = E.fase === f.id;
      const tipoOk = E.opcoes.tiposDeFase.find((t) => t.id === f.tipo)?.suportado;
      const g = sv('g', { transform: `translate(${p.x} ${p.y})`, style: 'cursor:pointer', tabindex: 0, role: 'button', 'aria-label': f.nome });
      g.append(sv('circle', { r: RAIO, fill: f.id === E.ato.inicio ? '#1f4a30' : '#1b2438', stroke: comErro.has(f.id) || alcance.has(f.id) ? '#ff6b6b' : sel ? '#ffd166' : E.ligando === f.id ? '#6bd0ff' : f.obrigatoria ? '#8aa0c8' : '#667', 'stroke-width': sel || E.ligando === f.id ? 3 : 2, 'stroke-dasharray': f.obrigatoria ? null : '4 3' }),
        sv('text', { y: 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 11 }, (f.ordem ?? '·').toString()),
        seloDaConclusao(f) ? sv('g', { transform: `translate(${RAIO - 4} ${-RAIO + 4})` }, sv('circle', { r: 9, fill: '#2a1f12', stroke: '#d9b25f', 'stroke-width': 1.5 }), sv('text', { y: 4, 'text-anchor': 'middle', fill: '#f3dca4', 'font-size': 10 }, seloDaConclusao(f))) : null,
        sv('text', { y: RAIO + 14, 'text-anchor': 'middle', fill: tipoOk ? '#cfd6e6' : '#ffb347', 'font-size': 10.5 }, f.nome.length > 16 ? `${f.nome.slice(0, 15)}…` : f.nome));
      let arrastou = false;
      g.addEventListener('pointerdown', (ev) => {
        if (E.somenteLeitura || E.ligando) return;
        const caixa = svg.getBoundingClientRect();
        const k = L / E.zoom / caixa.width;
        const ox = ev.clientX;
        const oy = ev.clientY;
        const x0 = p.x;
        const y0 = p.y;
        const mover = (m) => {
          if (Math.hypot(m.clientX - ox, m.clientY - oy) > 4) arrastou = true;
          if (!arrastou) return;
          const naGrade = (v) => (E.grade && !m.altKey ? Math.round(v / 20) * 20 : Math.round(v)); // Alt solta da grade
          f.posicao = { x: naGrade(Math.min(L - 30, Math.max(30, x0 + (m.clientX - ox) * k))), y: naGrade(Math.min(A - 40, Math.max(30, y0 + (m.clientY - oy) * k))) };
          p.x = f.posicao.x;
          p.y = f.posicao.y;
          g.setAttribute('transform', `translate(${p.x} ${p.y})`);
        };
        const soltar = () => {
          window.removeEventListener('pointermove', mover);
          window.removeEventListener('pointerup', soltar);
          if (arrastou) mudou();
        };
        window.addEventListener('pointermove', mover);
        window.addEventListener('pointerup', soltar);
      });
      g.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (arrastou) return (arrastou = false);
        if (E.ligando) {
          const de = E.ligando;
          E.ligando = null;
          return ligar(de, f.id);
        }
        E.fase = f.id;
        E.lig = null;
        pintar();
      });
      svg.append(g);
    }
    svg.addEventListener('dblclick', (ev) => {
      if (E.somenteLeitura || ev.target.closest('g')) return;
      const caixa = svg.getBoundingClientRect();
      const k = L / E.zoom / caixa.width;
      const naGrade = (v) => (E.grade && !ev.altKey ? Math.round(v / 20) * 20 : Math.round(v));
      lembrar();
      novaFase({ x: naGrade(Math.min(L - 30, Math.max(30, E.pan.x + (ev.clientX - caixa.left) * k))), y: naGrade(Math.min(A - 40, Math.max(30, E.pan.y + (ev.clientY - caixa.top) * k))) });
    });
    let moveuAVista = false;
    svg.addEventListener('pointerdown', (ev) => {
      if (ev.target !== svg && ev.target.tagName !== 'image' && ev.target.tagName !== 'line') return;
      if (E.zoom === 1) return;
      const caixa = svg.getBoundingClientRect();
      const k = L / E.zoom / caixa.width;
      const o = { x: ev.clientX, y: ev.clientY, px: E.pan.x, py: E.pan.y };
      moveuAVista = false;
      const mover = (m) => {
        if (Math.hypot(m.clientX - o.x, m.clientY - o.y) > 4) moveuAVista = true;
        E.pan = { x: o.px - (m.clientX - o.x) * k, y: o.py - (m.clientY - o.y) * k };
        svg.setAttribute('viewBox', `${E.pan.x} ${E.pan.y} ${L / E.zoom} ${A / E.zoom}`);
      };
      const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); };
      window.addEventListener('pointermove', mover);
      window.addEventListener('pointerup', soltar);
    });
    svg.addEventListener('wheel', (ev) => {
      if (!ev.ctrlKey && !ev.altKey) return; // roda sozinha rola a página; Ctrl/Alt + roda = zoom
      ev.preventDefault();
      const caixa = svg.getBoundingClientRect();
      const fx = (ev.clientX - caixa.left) / caixa.width;
      const fy = (ev.clientY - caixa.top) / caixa.height;
      zoomEm(ev.deltaY < 0 ? 1.25 : 0.8, fx, fy);
    }, { passive: false });
    svg.addEventListener('click', () => { if (moveuAVista) { moveuAVista = false; return; } E.fase = null; E.lig = null; E.ligando = null; pintar(); });
    return svg;
  }

  // ------------------------------------------------------------------ recompensas (fase e boss final)
  // Uma por contexto ('fase:<id>' ou 'boss'): prévia, simulador, alertas e busca de item vêm do servidor.
  const RC = {};
  const chaveRc = (k) => (RC[k] ??= { previa: null, simulacao: null, problemas: [], q: '', itens: [], esperando: null });
  const idRc = (k) => `rc-${k.replace(/\W/g, '_')}`;
  const rotulosDe = (k) => (k === 'boss' ? { titulo: 'Recompensa do boss final (conclusão do ato)', primeira: 'Primeira vitória (uma vez por personagem)', cada: 'A cada vitória' } : { titulo: 'Recompensa da fase', primeira: 'Primeira limpeza (uma vez por personagem)', cada: 'A cada limpeza' });
  const lerRec = (k) => (k === 'boss' ? E.ato.bossFinal?.recompensas : faseDe(E.fase)?.recompensas);
  const gravarRec = (k, v) => { if (k === 'boss') E.ato.bossFinal.recompensas = v; else faseDe(E.fase).recompensas = v; };
  async function atualizarRc(k, origem, huntId) {
    const R = chaveRc(k);
    const rec = lerRec(k);
    if (!rec) { R.previa = null; R.simulacao = null; R.problemas = []; return; }
    const r = await api('atos-editor/previa', { recompensa: rec, origem, huntId, simular: !!R.simulacao });
    R.previa = r.previa;
    R.problemas = r.problemas ?? [];
    if (R.simulacao) R.simulacao = r.simulacao;
    document.getElementById(idRc(k))?.replaceWith(painelDeRecompensa(k, origem, huntId));
  }
  function painelDeRecompensa(k, origem, huntId) {
    const rot = rotulosDe(k);
    const rec = lerRec(k);
    const R = chaveRc(k);
    const id = idRc(k);
    const repintar = () => document.getElementById(id)?.replaceWith(painelDeRecompensa(k, origem, huntId));
    const mudarRec = (fn) => { fn(lerRec(k)); mudou(); clearTimeout(R.esperando); R.esperando = setTimeout(() => atualizarRc(k, origem, huntId), 300); };
    if (rec && !R.previa && !R.carregando) {
      R.carregando = true;
      setTimeout(() => atualizarRc(k, origem, huntId).finally(() => { R.carregando = false; }), 0);
    }
    if (!rec) return el('fieldset', { id }, el('legend', {}, rot.titulo), el('div', { class: 'dica' }, 'Sem recompensa configurada (vale só o loot normal da hunt/boss).'), E.somenteLeitura ? null : el('button', { onclick: () => { gravarRec(k, { drops: [], rolagens: 1 }); mudou(); atualizarRc(k, origem, huntId); } }, 'Configurar recompensa'));
    const buscar = async (q) => { R.q = q; R.itens = q.length >= 2 ? (await api(`itens?q=${encodeURIComponent(q)}`)).itens : []; repintar(); };
    const pc = rec.primeiraConclusao;
    const nomeDe = (iid) => R.previa?.linhas.find((l) => l.item === iid)?.nome ?? '';
    const linhaDrop = (d, i) => el('div', { class: 'linha' }, el('span', {}, `${d.id} ${nomeDe(d.id)}`), el('input', { type: 'number', step: 'any', value: d.chance, title: 'chance em % (individual por item)', disabled: E.somenteLeitura, onchange: (e) => mudarRec((x) => { x.drops[i].chance = Number(e.target.value); }) }), el('span', { class: 'dica' }, '%'), E.somenteLeitura ? null : el('button', { onclick: () => mudarRec((x) => x.drops.splice(i, 1)) }, '✕'));
    const linhaPrimeira = (it, i) => el('div', { class: 'linha' }, el('span', {}, `${it.id} ${nomeDe(it.id)}`), el('input', { type: 'number', value: it.count, title: 'quantidade', disabled: E.somenteLeitura, onchange: (e) => mudarRec((x) => { x.primeiraConclusao.itens[i].count = Number(e.target.value); }) }), E.somenteLeitura ? null : el('button', { onclick: () => mudarRec((x) => x.primeiraConclusao.itens.splice(i, 1)) }, '✕'));
    const garantirPc = (x) => (x.primeiraConclusao ??= { gold: 0, exp: 0, itens: [] });
    return el('fieldset', { id }, el('legend', {}, rot.titulo),
      el('div', { class: 'dica' }, `Modelo: ${R.previa?.modelo ?? 'chance individual por item (cada linha sorteia por conta própria).'} Passa pelo loot normal do jogo (bônus, filtros, capacidade, party).`),
      el('b', {}, `${rot.cada}: drops (chance individual, %)`),
      el('div', { class: 'linhas' }, (rec.drops ?? []).map(linhaDrop), (rec.drops ?? []).length ? null : el('span', { class: 'dica' }, 'nenhum drop')),
      el('div', { class: 'grade' }, campo('Rolagens (a lista é sorteada N vezes, 1–5)', rec.rolagens ?? 1, (v) => mudarRec((x) => { x.rolagens = Number(v) || 1; }), { type: 'number' }), campo('Média de moedas por rolagem', rec.moedasMedia, (v) => mudarRec((x) => { x.moedasMedia = v === '' ? undefined : Number(v); }), { type: 'number' })),
      el('b', {}, rot.primeira),
      el('div', { class: 'grade' }, campo('Ouro', pc?.gold ?? 0, (v) => mudarRec((x) => { garantirPc(x).gold = Number(v) || 0; }), { type: 'number' }), campo('Experiência', pc?.exp ?? 0, (v) => mudarRec((x) => { garantirPc(x).exp = Number(v) || 0; }), { type: 'number' })),
      el('div', { class: 'linhas' }, (pc?.itens ?? []).map(linhaPrimeira)),
      E.somenteLeitura ? null : el('div', { class: 'linha' }, el('input', { placeholder: 'buscar item (nome ou ID) para adicionar', value: R.q, onchange: (e) => buscar(e.target.value) })),
      R.itens.length ? el('div', { class: 'linhas' }, R.itens.map((it) => el('div', { class: 'linha' }, el('span', {}, `${it.id} ${it.name}`), el('button', { onclick: () => mudarRec((x) => (x.drops ??= []).push({ id: it.id, chance: 1 })) }, '+ drop'), el('button', { onclick: () => mudarRec((x) => garantirPc(x).itens.push({ id: it.id, count: 1 })) }, '+ 1ª vez')))) : null,
      R.problemas.length ? el('ul', { class: 'problemas' }, R.problemas.map((p) => el('li', { class: p.nivel }, `${p.nivel === 'erro' ? '✖' : '⚠'} ${p.mensagem}`))) : (R.previa ? el('div', { class: 'selo ok' }, 'Sem alertas') : null),
      R.previa ? tabelaDeDrops(R.previa.linhas.map((l) => ({ id: l.item, nome: l.quantidade != null ? `${l.nome ?? l.item ?? ''} × ${l.quantidade.toLocaleString('pt-BR')}` : l.nome, desenho: l.desenho, chancePct: l.chancePct, esperado: l.esperadoPorExecucao ?? (l.tipo === 'primeira vez' ? null : null), valor: l.valorPorExecucao ?? null, origem: `${l.origem} · ${l.condicao}` })), { rotuloDoEsperado: 'Esperado / execução', ordem: 'chancePct', vazio: 'Sem linhas.' }) : null,
      R.previa ? el('div', { class: 'dica' }, `Valor esperado por execução (ouro de NPC, sem a 1ª vez): ${R.previa.valorEsperadoPorExecucao.toLocaleString('pt-BR')}`) : null,
      el('div', { class: 'linha' }, el('button', { onclick: async () => { R.simulacao = { pendente: true }; await atualizarRc(k, origem, huntId); } }, 'Simular 10.000 execuções'), E.somenteLeitura ? null : el('button', { class: 'perigo', onclick: () => { gravarRec(k, null); R.previa = null; R.simulacao = null; mudou(); } }, 'Remover recompensa')),
      R.simulacao?.itens ? el('div', {}, el('div', { class: 'dica' }, R.simulacao.aviso), el('table', { class: 'bib-sub' }, el('tbody', {}, R.simulacao.itens.map((i) => el('tr', {}, el('td', {}, i.nome ?? i.item), el('td', {}, `${i.quedasPorExecucao} quedas/exec.`), el('td', {}, `${i.execucoesComQueda}% das execuções com queda`), el('td', {}, i.execucoesParaUmaQueda ? `1 queda a cada ~${i.execucoesParaUmaQueda} exec.` : 'nunca caiu')))))) : null);
  }

  // ------------------------------------------------------------------ imagem de fundo
  function enviarImagem(arquivo) {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = async () => {
      const r = await api('atos-editor/imagem', { ato: E.ato.id, dados: leitor.result });
      if (r.ok === false) return msg(r.erros?.join(' ') ?? 'Não enviou.', 'erro');
      E.ato.imagem = r.imagem;
      E.versaoDaImagem = Date.now();
      msg('Imagem enviada. Salve o ato para guardar a escolha.', 'ok');
      mudou();
    };
    leitor.readAsDataURL(arquivo);
  }

  // ------------------------------------------------------------------ mapa, mobs e drops da fase (áreas do PoE: a campanha do PoE)
  E.areas = {};
  E.missao = null;
  /** Os monstros da hunt da fase: a área do PoE (status, drops) ou os bichos do cadastro do Draevor. Carrega uma vez e repinta. */
  function areaDaFase(huntId) {
    if (!huntId) return null;
    if (E.areas[huntId] !== undefined) return E.areas[huntId];
    E.areas[huntId] = null;
    const poe = huntId.startsWith('poe-a');
    (poe ? poeApi(`campanha/area?id=${encodeURIComponent(huntId)}`) : api(`biblioteca/detalhe?${new URLSearchParams({ categoria: 'hunts', id: huntId })}`))
      .then((d) => {
        E.areas[huntId] = poe ? { poe: true, ...d } : { poe: false, monstros: (d?.monstros ?? []).map((m) => ({ slug: m.key, nome: m.nome ?? m.key })) };
        if (faseDe(E.fase)?.huntId === huntId) pintar();
      })
      .catch(() => {});
    if (poe && !E.mapas) poeApi('campanha').then((c) => { E.mapas = c.mapas ?? []; if (faseDe(E.fase)?.huntId === huntId) pintar(); }).catch(() => {});
    if (poe && !E.missao) poeApi('itens-de-missao').then((r) => { E.missao = r.itens ?? []; if (faseDe(E.fase)?.huntId === huntId) pintar(); }).catch(() => {});
    return null;
  }

  // ---- COMO A FASE CONCLUI: cada tipo tem a sua tela (cartões com o desenho dos mobs, a ficha do alvo, a quantidade, o item da missão).
  const TIPOS_VISUAIS = {
    'limpar-hunt': { icone: '🧹', titulo: 'Limpar a área', texto: 'matar todos os bichos da instância' },
    'matar-chefe': { icone: '☠', titulo: 'Matar o chefe', texto: 'um monstro escolhido precisa morrer' },
    'matar-n': { icone: '⚔', titulo: 'Matar N monstros', texto: 'uma quantidade (de um tipo ou qualquer)' },
    'item-de-missao': { icone: '📜', titulo: 'Missão: item', texto: 'o alvo solta o item; pegar conclui' },
  };
  /** O selo da conclusão no nó do grafo. */
  const seloDaConclusao = (f) => ({ 'matar-chefe': '☠', 'matar-n': `×${f.conclusao?.quantidade ?? '?'}`, 'item-de-missao': '📜' })[f.conclusao?.tipo] ?? null;
  const vidaDe = (m) => Number(m.vida ?? 0) + Number(m.escudoDeEnergia ?? 0);
  /** Um cartão de mob (desenho, nome, nível, vida) — clicável quando `aoEscolher`. */
  const cartaoDoMob = (m, { ativo = false, aoEscolher = null, pequeno = false } = {}) => el(aoEscolher ? 'button' : 'div', { type: aoEscolher ? 'button' : undefined, class: `conc-mob${ativo ? ' ativo' : ''}${m.unico ? ' unico' : ''}${pequeno ? ' pequeno' : ''}`, disabled: aoEscolher ? E.somenteLeitura : undefined, onclick: aoEscolher ? () => aoEscolher(m) : undefined, title: m.nome },
    retrato(m.desenho ?? null, pequeno ? 40 : 56, { categoria: 'monstros' }), el('b', {}, m.nome), el('small', {}, `nv ${m.nivel ?? '?'} · ${vidaDe(m).toLocaleString('pt-BR')} vida${m.unico ? ' · único' : ''}`));
  /** Os mobs da área ordenados: únicos primeiro, depois pela vida. */
  const mobsOrdenados = (area) => [...(area?.monstros ?? [])].sort((a, b) => Number(!!b.unico) - Number(!!a.unico) || vidaDe(b) - vidaDe(a));

  function painelDaConclusao(f) {
    const conc = f.conclusao ?? { tipo: 'limpar-hunt' };
    const area = areaDaFase(f.huntId);
    const monstros = mobsOrdenados(area);
    const mudar = (novo) => { f.conclusao = novo; mudou(); };
    const alvo = monstros.find((m) => m.slug === conc.monstro) ?? null;
    if (area?.poe && !E.missao) poeApi('itens-de-missao').then((r) => { E.missao = r.itens ?? []; if (faseDe(E.fase)?.huntId === f.huntId) pintar(); }).catch(() => {});
    // Os quatro tipos como cartões (o escolhido aceso).
    const tipos = el('div', { class: 'conc-tipos' }, E.opcoes.tiposDeConclusao.map((t) => {
      const v = TIPOS_VISUAIS[t.id] ?? { icone: '•', titulo: t.nome, texto: '' };
      return el('button', { type: 'button', class: `conc-tipo${conc.tipo === t.id ? ' ativo' : ''}`, disabled: E.somenteLeitura, onclick: () => conc.tipo !== t.id && mudar(t.id === 'matar-n' ? { tipo: t.id, quantidade: 25 } : t.id === 'item-de-missao' ? { tipo: t.id, item: E.missao?.find((i) => i.area === f.huntId)?.id } : { tipo: t.id }) },
        el('span', { class: 'conc-icone' }, v.icone), el('b', {}, v.titulo), el('small', {}, v.texto));
    }));
    const semMobs = !area ? el('div', { class: 'dica' }, 'Carregando os mobs da área…') : !monstros.length ? el('div', { class: 'dica' }, 'A área não tem monstros (escolha a hunt da fase).') : null;
    let corpo = null;
    if (conc.tipo === 'limpar-hunt') {
      corpo = [el('div', { class: 'dica' }, `Conclui quando a instância inteira é limpa. ${monstros.length} tipo(s) de monstro nesta área:`),
        semMobs ?? el('div', { class: 'conc-grade' }, monstros.map((m) => cartaoDoMob(m, { pequeno: true })))];
    } else if (conc.tipo === 'matar-chefe') {
      corpo = [
        alvo ? el('div', { class: 'conc-alvo' }, retrato(alvo.desenho ?? null, 96, { categoria: 'monstros', animar: true }), el('div', {},
          el('div', { class: 'conc-rotulo' }, 'Alvo da fase'), el('h3', {}, alvo.nome), el('div', { class: 'dica' }, `nível ${alvo.nivel} · ${vidaDe(alvo).toLocaleString('pt-BR')} de vida · golpe ${alvo.dano} a cada ${Number(alvo.tempoAtaque ?? 0).toFixed(2)} s${alvo.convertidas?.length ? ` · ${alvo.convertidas.length} habilidade(s)` : ''}`),
          el('div', { class: 'dica' }, 'Limpar a área sem ele não conclui; matar ele conclui na hora.'))) : el('div', { class: 'conc-aviso' }, '☠ Escolha o chefe da fase entre os mobs da área (os únicos vêm primeiro).'),
        semMobs ?? el('div', { class: 'conc-grade' }, monstros.map((m) => cartaoDoMob(m, { ativo: m.slug === conc.monstro, aoEscolher: (x) => mudar({ ...conc, monstro: x.slug, nome: x.nome }) })))];
    } else if (conc.tipo === 'matar-n') {
      const q = conc.quantidade ?? 25;
      corpo = [
        el('div', { class: 'conc-contador' },
          el('button', { type: 'button', disabled: E.somenteLeitura, onclick: () => mudar({ ...conc, quantidade: Math.max(1, q - 5) }) }, '−5'),
          el('input', { type: 'number', min: 1, value: q, disabled: E.somenteLeitura, onchange: (e) => mudar({ ...conc, quantidade: Math.max(1, Math.round(Number(e.target.value) || 1)) }) }),
          el('button', { type: 'button', disabled: E.somenteLeitura, onclick: () => mudar({ ...conc, quantidade: q + 5 }) }, '+5'),
          [10, 25, 50, 100].map((n) => el('button', { type: 'button', class: n === q ? 'ativo' : '', disabled: E.somenteLeitura, onclick: () => mudar({ ...conc, quantidade: n }) }, String(n)))),
        el('div', { class: 'dica' }, `Matar ${q} ${alvo ? alvo.nome : 'monstros (qualquer um da área)'}. O progresso fica salvo entre as entradas.`),
        semMobs ?? el('div', { class: 'conc-grade' },
          el('button', { type: 'button', class: `conc-mob qualquer${conc.monstro ? '' : ' ativo'}`, disabled: E.somenteLeitura, onclick: () => mudar({ tipo: 'matar-n', quantidade: q }) }, el('span', { class: 'conc-icone' }, '⚔'), el('b', {}, 'Qualquer monstro'), el('small', {}, 'conta todos')),
          monstros.map((m) => cartaoDoMob(m, { ativo: m.slug === conc.monstro, pequeno: true, aoEscolher: (x) => mudar({ ...conc, monstro: x.slug, nome: x.nome }) })))];
    } else if (conc.tipo === 'item-de-missao') {
      const item = (E.missao ?? []).find((i) => Number(i.id) === Number(conc.item));
      const linha = alvo?.drops?.find((d) => Number(d.id) === Number(conc.item));
      corpo = [
        el('div', { class: 'conc-missao' },
          alvo ? cartaoDoMob(alvo) : el('div', { class: 'conc-mob vazio' }, el('span', { class: 'conc-icone' }, '?'), el('b', {}, 'Escolha o monstro'), el('small', {}, 'que carrega o item')),
          el('span', { class: 'conc-seta' }, '→ solta →'),
          el('div', { class: `conc-item${item ? '' : ' vazio'}` }, el('span', { class: 'conc-icone' }, '📜'), el('b', {}, item?.nome ?? 'Escolha o item'), el('small', {}, item ? `missão "${item.missao}"` : 'da missão'))),
        el('div', { class: 'dica' }, !alvo || !item ? 'Escolha o monstro e o item abaixo.' : linha ? `Na tabela de drop de ${alvo.nome}: ${linha.chance}%${linha.missao ? ', só enquanto a missão está aberta' : ''}. Pegar o item conclui a fase.` : `Sem a linha na tabela de drop de ${alvo.nome}: o item cai do mesmo jeito ao matar o alvo (100%).`),
        el('div', { class: 'conc-rotulo' }, 'Quem carrega'),
        semMobs ?? el('div', { class: 'conc-grade' }, monstros.map((m) => cartaoDoMob(m, { ativo: m.slug === conc.monstro, pequeno: true, aoEscolher: (x) => mudar({ ...conc, monstro: x.slug, nome: x.nome }) }))),
        el('div', { class: 'conc-rotulo' }, 'Item da missão'),
        el('div', { class: 'conc-grade' }, (E.missao ?? []).sort((a, b) => Number(b.area === f.huntId) - Number(a.area === f.huntId) || a.ato - b.ato).map((i) => el('button', { type: 'button', class: `conc-item${Number(i.id) === Number(conc.item) ? ' ativo' : ''}`, disabled: E.somenteLeitura, onclick: () => mudar({ ...conc, item: Number(i.id) }) },
          el('span', { class: 'conc-icone' }, '📜'), el('b', {}, i.nome), el('small', {}, `${i.ato === 11 ? 'Epílogo' : `Ato ${i.ato}`}${i.area === f.huntId ? ' · desta área' : ''}`))))];
    }
    return el('fieldset', { class: 'conc' }, el('legend', {}, 'Como a fase conclui'), tipos, corpo,
      f.objetivos?.length ? el('details', { class: 'conc-missoes' }, el('summary', {}, `Missões desta área no Drive (${f.objetivos.length})`), el('ul', { class: 'atos-missoes' }, f.objetivos.map((o) => el('li', {}, el('b', {}, o.missao ?? ''), o.texto ? ` — ${o.texto}` : '')))) : null);
  }

  /** Os mobs da área em edição (uma cópia; "Salvar mobs da área" grava e vale na próxima entrada). */
  E.mobsEditando = {};
  const CAMPOS_DO_MOB = [['nivel', 'Nível', 1], ['vida', 'Vida', 1], ['escudoDeEnergia', 'Escudo de Energia', 1], ['dano', 'Golpe', 1], ['tempoAtaque', 'Tempo de ataque (s)', 0.01], ['armadura', 'Armadura', 1], ['evasao', 'Evasão', 1], ['experiencia', 'Experiência', 1]];
  const RES = [['fire', 'Res. fogo'], ['ice', 'Res. gelo'], ['energy', 'Res. raio'], ['chaos', 'Res. caos']];
  const limparMob = (m) => ({ slug: m.slug, nome: m.nome, unico: !!m.unico, nivel: m.nivel, vida: m.vida, escudoDeEnergia: m.escudoDeEnergia ?? 0, dano: m.dano, tempoAtaque: m.tempoAtaque, armadura: m.armadura ?? 0, evasao: m.evasao ?? 0, experiencia: m.experiencia, resistencias: { ...(m.resistencias ?? {}) }, ...(m.habilidades?.length ? { habilidades: m.habilidades } : {}) });

  function painelDosMobs(f) {
    const area = areaDaFase(f.huntId);
    if (!f.huntId) return null;
    if (!area) return el('fieldset', {}, el('legend', {}, 'Mapa e mobs da área'), el('div', { class: 'dica' }, 'Carregando…'));
    if (!area.poe) return el('fieldset', {}, el('legend', {}, 'Mobs da hunt'), el('div', { class: 'dica' }, area.monstros.map((m) => m.nome).join(', ') || 'sem monstros'), el('div', { class: 'dica' }, 'Os mobs editáveis por área são os da campanha do PoE (com o PoE ligado).'));
    const sel = el('select', { disabled: E.somenteLeitura }, (E.mapas ?? [{ id: area.mapa, nome: area.nomeDoMapa }]).map((m) => el('option', { value: m.id, selected: m.id === area.mapa }, `${m.nome}${m.nivel ? ` (nv ${m.nivel})` : ''}`)));
    const trocar = el('button', { type: 'button', disabled: E.somenteLeitura, onclick: async () => {
      if (sel.value === area.mapa) return msg('Esse já é o mapa da área.', 'aviso');
      const r = await poeApi('campanha/mapa', { area: f.huntId, mapa: sel.value });
      if (!r.ok) return msg(r.erros?.[0] ?? 'Não deu.', 'erro');
      E.areas[f.huntId] = { poe: true, ...r.area };
      msg(`Mapa de ${area.nome} trocado (vale na próxima entrada).`, 'ok');
      pintar();
    } }, 'Trocar mapa');
    // A edição: começa da lista da área; cada mudança marca "não salvo".
    const ed = (E.mobsEditando[f.huntId] ??= { lista: area.monstros.map(limparMob), sujo: false });
    const marcar = () => { ed.sujo = true; pintar(); };
    // Mudar um número não redesenha a tela (o campo continua onde está): só acende o "Salvar".
    const idDoSalvar = `mobs-salvar-${f.huntId}`;
    const marcarCampo = () => {
      ed.sujo = true;
      const b = document.getElementById(idDoSalvar);
      if (b) { b.disabled = false; b.className = 'primario'; b.textContent = 'Salvar mobs da área'; }
    };
    if (!E.mobsPoe) poeApi('mobs').then((r) => { E.mobsPoe = r.mobs ?? []; if (faseDe(E.fase)?.huntId === f.huntId) pintar(); }).catch(() => {});
    const porSlug = new Map(area.monstros.map((m) => [m.slug, m]));
    const acrescentar = (slug) => {
      const mob = (E.mobsPoe ?? []).find((x) => x.slug === slug);
      if (!mob) return;
      // Os status da ocorrência de nível mais perto do nível da área (ajuste depois, se quiser).
      const o = [...mob.ocorrencias].sort((a, b) => Math.abs(a.nivel - area.nivel) - Math.abs(b.nivel - area.nivel))[0];
      ed.lista.push(limparMob({ ...o, slug: mob.slug, nome: mob.nome, unico: mob.unico, nivel: o.nivel }));
      marcar();
    };
    const salvar = async () => {
      const r = await poeApi('campanha/area/monstros', { area: f.huntId, monstros: ed.lista });
      if (!r.ok) return msg(r.erros?.slice(0, 3).join(' ') ?? 'Não salvou.', 'erro');
      E.areas[f.huntId] = { poe: true, ...r.area };
      delete E.mobsEditando[f.huntId];
      E.mobsPoe = null;
      msg(`Mobs de ${area.nome} salvos (valem na próxima entrada na área).`, 'ok');
      pintar();
    };
    return el('fieldset', {}, el('legend', {}, 'Mapa e mobs da área'),
      el('div', { class: 'linha' }, el('label', { class: 'campo', style: 'flex:1;min-width:0' }, 'Mapa (terreno do Draevor)', sel), trocar),
      el('div', { class: 'dica' }, `Nível ${area.nivel}. Os bichos são os do PoE (status do PoE, desenho do Draevor). Edite os status, tire ou acrescente monstros e salve. Comuns caem pela tabela global do PoE; só os únicos têm drop próprio.`),
      el('div', { class: 'atos-mobs' }, ed.lista.map((m, i) => {
        const original = porSlug.get(m.slug);
        return el('details', { class: 'atos-mob' },
          el('summary', {}, el('b', {}, m.nome), m.unico ? el('span', { class: 'selo aviso', style: 'margin-left:6px' }, 'único') : null, f.conclusao?.monstro === m.slug ? el('span', { class: 'selo usos', style: 'margin-left:6px' }, 'alvo da fase') : null,
            el('span', { class: 'dica' }, ` nv ${m.nivel} · ${Number(m.vida + (m.escudoDeEnergia ?? 0)).toLocaleString('pt-BR')} vida · golpe ${m.dano} a cada ${Number(m.tempoAtaque).toFixed(2)} s`)),
          el('div', { class: 'grade atos-mob-campos' },
            CAMPOS_DO_MOB.map(([k, rot, passo]) => campo(rot, m[k], (v) => { m[k] = Number(v); marcarCampo(); }, { type: 'number', step: passo, min: 0 })),
            RES.map(([k, rot]) => campo(rot, m.resistencias?.[k] ?? 0, (v) => { m.resistencias = { ...(m.resistencias ?? {}), [k]: Number(v) }; marcarCampo(); }, { type: 'number', step: 1, min: -100, max: 90 }))),
          E.somenteLeitura ? null : el('div', { class: 'linha' }, el('button', { type: 'button', class: 'perigo', onclick: () => { ed.lista.splice(i, 1); marcar(); } }, 'Tirar da área')),
          m.unico && original ? [el('b', {}, 'Drops deste único'), editorDeDrops(m.slug, original.drops ?? [], { somenteLeitura: E.somenteLeitura, aoSalvar: (drops) => { original.drops = drops; } })] : null);
      })),
      E.somenteLeitura ? null : el('div', { class: 'linha' },
        el('select', { onchange: (e) => { if (e.target.value) acrescentar(e.target.value); } }, el('option', { value: '' }, E.mobsPoe ? '+ acrescentar monstro do PoE…' : 'carregando monstros…'),
          (E.mobsPoe ?? []).filter((x) => !ed.lista.some((m) => m.slug === x.slug)).map((x) => el('option', { value: x.slug }, `${x.nome}${x.unico ? ' (único)' : ''} — nv ${x.ocorrencias[0]?.nivel ?? '?'}`))),
        el('button', { type: 'button', id: idDoSalvar, class: ed.sujo ? 'primario' : '', disabled: !ed.sujo, onclick: salvar }, ed.sujo ? 'Salvar mobs da área' : 'Mobs salvos'),
        ed.sujo ? el('button', { type: 'button', onclick: () => { delete E.mobsEditando[f.huntId]; pintar(); } }, 'Desfazer') : null));
  }

  // ------------------------------------------------------------------ painéis
  function painelDoAto() {
    const a = E.ato;
    const outros = E.lista.filter((x) => x.id !== a.id).map((x) => [x.id, x.nome]);
    return el('fieldset', {}, el('legend', {}, 'Ato'),
      el('div', { class: 'grade' },
        campo('ID', a.id, () => {}, { disabled: true }),
        campo('Nome', a.nome, (v) => { a.nome = v; mudou(); }),
        campo('Nível recomendado', a.nivelRecomendado, (v) => { a.nivelRecomendado = numero(v); mudou(); }, { type: 'number' }),
        campo('Ordem na campanha', a.ordem, (v) => { a.ordem = numero(v); mudou(); }, { type: 'number' }),
        selecao('Ato anterior', a.anterior, outros, (v) => { a.anterior = v; mudou(); }, '(nenhum)'),
        selecao('Ato seguinte', a.seguinte, outros, (v) => { a.seguinte = v; mudou(); }, '(nenhum)'),
        selecao('Estado', a.estado, E.opcoes ? [['rascunho', 'Rascunho'], ['desativado', 'Desativado'], ['beta', 'Beta (vale só com o modo beta ligado)'], ['publicado', 'Publicado']] : [], (v) => { a.estado = v; mudou(); }),
        el('div', { class: 'campo' }, 'Imagem de fundo (o mapa do ato)',
          el('div', { class: 'linha' },
            el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml', disabled: E.somenteLeitura, onchange: (e) => enviarImagem(e.target.files?.[0]) }),
            a.imagem && !E.somenteLeitura ? el('button', { type: 'button', onclick: () => { a.imagem = null; mudou(); } }, 'Tirar') : null),
          el('span', { class: 'dica' }, a.imagem ? `${a.imagem} — aparece por trás do grafo` : 'nenhuma'))),
      el('label', { class: 'campo' }, 'Descrição', el('textarea', { rows: 2, disabled: E.somenteLeitura, onchange: (e) => { a.descricao = e.target.value; mudou(); } }, a.descricao)),
      el('div', { class: 'dica' }, 'Beta/Publicado só gravam com a validação limpa e valem no PRÓXIMO BOOT do servidor (reinício controlado): o arquivo vai para o jogo com o deploy. A ordem é o número do ato no jogo (5 em diante).'));
  }

  /** A CIDADE do ato: o nó de partida do mapa (sem hunt). O nome e para que fases as estradas dela vão. */
  function painelDaCidade() {
    const a = E.ato;
    if (!a.cidade) return el('fieldset', {}, el('legend', {}, 'Cidade'), el('div', { class: 'dica' }, 'O ato ainda não tem o nó da cidade (a ramificação inicial do mapa).'),
      E.somenteLeitura ? null : el('button', { type: 'button', onclick: () => { lembrar(); a.cidade = { nome: 'Cidade', posicao: null, conexoes: a.inicio ? [a.inicio] : [] }; mudou(); } }, 'Criar a cidade'));
    const c = a.cidade;
    const fases = [...a.fases].sort((x, y) => (x.ordem ?? 1e9) - (y.ordem ?? 1e9));
    return el('fieldset', {}, el('legend', {}, 'Cidade'),
      campo('Nome', c.nome, (v) => { c.nome = v; mudou(); }),
      el('div', { class: 'campo' }, 'Estradas da cidade (as fases a que ela liga)',
        el('div', { class: 'atos-mobs' }, fases.map((f) => el('label', { class: 'linha' }, el('input', { type: 'checkbox', checked: c.conexoes.includes(f.id), disabled: E.somenteLeitura, onchange: (e) => { lembrar(); c.conexoes = e.target.checked ? [...new Set([...c.conexoes, f.id])] : c.conexoes.filter((x) => x !== f.id); mudou(); } }), ` ${f.ordem ?? '·'} · ${f.nome}`)))),
      el('div', { class: 'dica' }, c.posicao ? `posição ${c.posicao.x}, ${c.posicao.y} — arraste na vista Mapa` : 'sem posição: arraste a cidade na vista Mapa'),
      E.somenteLeitura ? null : el('button', { type: 'button', onclick: () => { lembrar(); a.cidade = null; mudou(); } }, 'Tirar a cidade'));
  }

  function painelDaFase() {
    const f = faseDe(E.fase);
    if (!f) return null;
    const pos = (id) => (id === E.ato.inicio ? ' (início)' : '');
    const tipos = E.opcoes.tiposDeFase.map((t) => [t.id, `${t.nome}${t.suportado ? '' : ' — sem suporte no runtime'}`]);
    const hunt = f.huntId ? `${f.huntId}` : 'nenhuma';
    return el('fieldset', {}, el('legend', {}, `Fase: ${f.nome}${pos(f.id)}`),
      el('div', { class: 'linha' }, el('button', { type: 'button', title: 'Fase anterior (Page Up)', onclick: () => vizinhaDaSelecionada(-1) }, '◀ anterior'), el('button', { type: 'button', title: 'Fase seguinte (Page Down)', onclick: () => vizinhaDaSelecionada(1) }, 'próxima ▶'), el('span', { class: 'dica' }, `${E.ato.fases.findIndex((x) => x.id === f.id) + 1} de ${E.ato.fases.length}`)),
      el('div', { class: 'grade' },
        campo('ID da fase', f.id, (v) => renomearFase(f.id, v)),
        campo('Nome', f.nome, (v) => { f.nome = v; mudou(); }),
        campo('Ordem', f.ordem, (v) => { f.ordem = numero(v); mudou(); }, { type: 'number' }),
        selecao('Tipo de fase', f.tipo, tipos, (v) => { f.tipo = v; mudou(); })),
      el('label', { class: 'campo' }, 'Descrição', el('textarea', { rows: 2, disabled: E.somenteLeitura, onchange: (e) => { f.descricao = e.target.value; mudou(); } }, f.descricao)),
      el('div', { class: 'linha' }, el('span', {}, el('b', {}, 'Hunt (cadastro original): '), hunt), E.somenteLeitura ? null : el('button', { onclick: () => abrirPicker('hunt') }, 'Escolher na Biblioteca')),
      el('div', { class: 'grade' },
        ...NIVEIS.map((n) => campo(`Nível (${n})`, f.nivel?.[n], (v) => { f.nivel = { facil: null, medio: null, dificil: null, ...(f.nivel ?? {}), [n]: numero(v) }; mudou(); }, { type: 'number' }))),
      el('div', { class: 'linha' },
        el('label', { class: 'marca' }, el('input', { type: 'checkbox', checked: f.obrigatoria, disabled: E.somenteLeitura, onchange: (e) => { f.obrigatoria = e.target.checked; mudou(); } }), 'Fase obrigatória'),
        el('label', { class: 'marca' }, el('input', { type: 'checkbox', checked: f.id === E.ato.inicio, disabled: E.somenteLeitura, onchange: () => { E.ato.inicio = f.id; mudou(); } }), 'Fase inicial')),
      el('label', { class: 'campo' }, 'Requisitos (IDs de fases que precisam estar completas, separados por vírgula)', el('input', { value: f.requisitos.exige.join(', '), disabled: E.somenteLeitura, onchange: (e) => { f.requisitos.exige = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); mudou(); } })),
      el('div', { class: 'dica' }, 'A conclusão da fase, o mapa, os mobs e o que cada mob solta: painéis abaixo. Recompensa da fase (por limpeza / 1ª vez): mais abaixo.'),
      E.somenteLeitura ? null : el('div', { class: 'linha' }, modo === 'fases' ? null : el('button', { onclick: () => { E.ligando = f.id; msg(`Clique na fase de DESTINO para ligar "${f.nome}" a ela.`, 'aviso'); pintar(); } }, 'Ligar a outra fase →'), el('button', { class: 'perigo', onclick: () => removerFase(f.id) }, 'Remover fase')));
  }

  function painelDaLigacao() {
    const c = E.ato.conexoes[E.lig];
    if (!c) return null;
    return el('fieldset', {}, el('legend', {}, `Ligação: ${c.de} → ${c.para}`),
      campo('Rótulo do caminho (ex.: Caminho A)', c.rotulo, (v) => { c.rotulo = v; mudou(); }),
      el('label', { class: 'campo' }, 'Requisito do caminho (fases que precisam estar completas, separadas por vírgula)', el('input', { value: (c.requisito?.exige ?? []).join(', '), disabled: E.somenteLeitura, onchange: (e) => { const l = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); c.requisito = l.length ? { exige: l } : null; mudou(); } })),
      E.somenteLeitura ? null : el('button', { class: 'perigo', onclick: () => { E.ato.conexoes.splice(E.lig, 1); E.lig = null; mudou(); } }, 'Remover ligação'));
  }

  function painelDoBoss() {
    const a = E.ato;
    const b = a.bossFinal;
    const fasesOpt = a.fases.map((f) => [f.id, f.nome]);
    return el('fieldset', {}, el('legend', {}, 'Boss final do ato'),
      b ? el('div', { class: 'dica' }, `${faseDe(b.faseAnterior)?.nome ?? 'Fase anterior?'} → limpar a hunt NESTA execução → portal aberto → ${b.bossId ?? 'boss?'}`) : el('div', { class: 'dica' }, 'Sem boss final.'),
      el('div', { class: 'linha' }, el('span', {}, el('b', {}, 'Boss: '), b?.bossId ?? 'nenhum'), E.somenteLeitura ? null : el('button', { onclick: () => abrirPicker('boss') }, 'Escolher na Biblioteca'), !E.somenteLeitura && b ? el('button', { class: 'perigo', onclick: () => { a.bossFinal = null; mudou(); } }, 'Tirar') : null),
      b ? selecao('Fase anterior ao boss (a que abre o portal)', b.faseAnterior, fasesOpt, (v) => { b.faseAnterior = v; mudou(); }, '(escolha)') : null,
      el('div', { class: 'dica' }, 'Regras fixas do jogo para o boss final: o portal só abre ao limpar a hunt na execução atual (o histórico não vale), sem cooldown de entrada; na Caça Automática o personagem entra sozinho. Recompensas e drops do boss final: painel abaixo.'));
  }

  function painelDeProblemas() {
    const erros = E.problemas.filter((p) => p.nivel === 'erro').length;
    const avisos = E.problemas.length - erros;
    return el('fieldset', { id: 'atos-problemas' }, el('legend', {}, `Validação — ${erros} erro(s), ${avisos} aviso(s)`),
      E.problemas.length ? el('ul', { class: 'problemas' }, E.problemas.map((p) => el('li', { class: p.nivel, style: p.onde.startsWith('fase ') ? 'cursor:pointer' : '', onclick: () => { if (p.onde.startsWith('fase ')) { E.fase = p.onde.slice(5); E.lig = null; pintar(); } } }, `${p.nivel === 'erro' ? '✖' : '⚠'} [${p.onde}] ${p.mensagem}`))) : el('div', { class: 'selo ok' }, 'Nenhum problema encontrado.'));
  }
  function pintarProblemas() {
    const n = document.getElementById('atos-problemas');
    if (n) n.replaceWith(painelDeProblemas());
  }

  // ------------------------------------------------------------------ Biblioteca embutida (escolher hunt/boss)
  function abrirPicker(alvo) {
    E.picker = { alvo, q: '', itens: [], detalhe: null };
    buscarPicker();
  }
  async function buscarPicker() {
    const cats = E.picker.alvo === 'boss' ? ['bosses'] : CATEGORIAS_DE_HUNT;
    const rs = await Promise.all(cats.map((c) => api(`biblioteca/lista?${new URLSearchParams({ categoria: c, q: E.picker.q, limite: 60 })}`)));
    E.picker.itens = rs.flatMap((r) => r.itens ?? []).sort((x, y) => String(x.nome).localeCompare(String(y.nome)));
    pintar();
  }
  async function verNoPicker(i) {
    E.picker.detalhe = await api(`biblioteca/detalhe?${new URLSearchParams({ categoria: i.categoria, id: i.id })}`);
    pintar();
  }
  function usarDoPicker(d) {
    if (E.picker.alvo === 'boss') E.ato.bossFinal = { ...(E.ato.bossFinal ?? { faseAnterior: null, arena: null, recompensas: null, drops: null }), bossId: d.id };
    else {
      const f = faseDe(E.fase);
      f.huntId = d.id;
      if (!f.nome || /^Fase \d+$/.test(f.nome)) f.nome = d.nome ?? f.nome;
      const tipo = d.categoria === 'vips' ? 'hunt-vip' : ['especiais', 'divinas'].includes(d.categoria) ? 'hunt-especial' : null;
      if (tipo && f.tipo === 'hunt-normal') f.tipo = tipo;
    }
    E.picker.alvo = null;
    mudou();
  }
  function painelPicker() {
    const p = E.picker;
    if (!p.alvo) return null;
    const d = p.detalhe;
    const linhaDe = (k, v) => el('div', { class: 'bib-campo' }, el('b', {}, k), el('span', { class: v == null ? 'dica' : '' }, v == null ? 'não cadastrado' : typeof v === 'object' ? JSON.stringify(v) : String(v)));
    return el('fieldset', {}, el('legend', {}, p.alvo === 'boss' ? 'Escolher o boss final (Biblioteca)' : 'Escolher a hunt (Biblioteca)'),
      el('div', { class: 'linha' }, el('input', { placeholder: 'buscar por nome ou ID', value: p.q, onchange: (e) => { p.q = e.target.value; buscarPicker(); } }), el('button', { onclick: () => { p.alvo = null; pintar(); } }, 'Fechar')),
      el('div', { class: 'bib-duas' },
        el('div', { class: 'bib-lista' }, el('table', {}, el('tbody', {}, p.itens.map((i) => el('tr', { class: `clicavel${d?.id === i.id ? ' ativa' : ''}`, onclick: () => verNoPicker(i) }, el('td', {}, i.nome ?? i.id), el('td', {}, i.tipo), el('td', {}, i.nivel ?? '—')))))),
        el('div', { class: 'bib-detalhe' }, d?.id ? [el('h4', {}, `${d.nome ?? d.id} (${d.id})`), linhaDe('Tipo', d.tipo), linhaDe('Mapa', d.mapa?.arquivo), linhaDe('Nível', d.nivel?.atual ?? d.nivel), linhaDe('Monstros', d.monstros?.map((m) => m.nome ?? m.key).join(', ') || null), linhaDe('Acesso', d.requisitos?.acesso), linhaDe('Cooldown', d.cooldowns?.horas), linhaDe('Drops de encontros', d.drops?.deEncontros?.length ?? null), el('button', { class: 'primario', onclick: () => usarDoPicker(d) }, 'Usar este') ] : el('div', { class: 'dica' }, 'Clique numa linha para ver o detalhe do cadastro.'))));
  }

  // ------------------------------------------------------------------ barra de ferramentas, atalhos e ferramentas do ato
  const ATALHOS = [
    ['Ctrl+S', 'Salvar o ato'], ['Ctrl+Z', 'Desfazer'], ['Ctrl+Y ou Ctrl+Shift+Z', 'Refazer'], ['N', 'Nova fase'], ['L', 'Ligar a fase selecionada a outra (clique no destino)'],
    ['Delete', 'Remover a fase ou a ligação selecionada'], ['Duplo clique no fundo', 'Nova fase naquele ponto (no Fluxo e no Mapa)'], ['Esc', 'Cancelar / desmarcar'], ['Setas', 'Mover a fase selecionada (Shift: 1 px; sem Shift: 20 px)'],
    ['Page Up / Page Down', 'Fase anterior / seguinte (pela ordem)'], ['F ou /', 'Buscar fase'], ['+ / −  (ou Ctrl+roda)', 'Zoom do grafo'], ['0', 'Ver o ato inteiro'], ['G', 'Grade liga/desliga (Alt ao arrastar solta da grade)'],
    ['O', 'Organizar automático'], ['?', 'Esta ajuda'],
  ];
  function barraDeFerramentas() {
    const busca = el('input', { type: 'search', id: 'atos-busca', placeholder: 'Buscar fase… (F)', style: 'width:180px', onkeydown: (e) => {
      if (e.key !== 'Enter') return;
      const t = e.target.value.trim().toLowerCase();
      const f = E.ato.fases.find((x) => x.nome.toLowerCase().includes(t) || x.id.includes(t));
      if (f) focarFase(f.id); else msg('Nenhuma fase com esse nome.', 'aviso');
    } });
    const b = (rotulo, titulo, acao, extra = {}) => el('button', { type: 'button', title: titulo, onclick: acao, ...extra }, rotulo);
    return el('div', { class: 'atos-ferramentas' },
      E.somenteLeitura ? null : b('+ Fase', 'Nova fase (N)', novaFase),
      E.somenteLeitura ? null : b('↶', 'Desfazer (Ctrl+Z)', desfazer, { disabled: !E.hist.passado.length }),
      E.somenteLeitura ? null : b('↷', 'Refazer (Ctrl+Y)', refazer, { disabled: !E.hist.futuro.length }),
      el('span', { class: 'atos-sep' }),
      b('−', 'Afastar (−)', () => zoomEm(0.8)), el('span', { class: 'dica', style: 'min-width:38px;text-align:center' }, `${Math.round(E.zoom * 100)}%`), b('+', 'Aproximar (+)', () => zoomEm(1.25)), b('⤢', 'Ver o ato inteiro (0)', () => { E.zoom = 1; E.pan = { x: 0, y: 0 }; pintar(); }),
      el('span', { class: 'atos-sep' }),
      E.somenteLeitura ? null : b('Organizar', 'Organizar as fases automaticamente (O)', organizar),
      b(E.grade ? 'Grade: ligada' : 'Grade: desligada', 'Alinhar à grade de 20 px ao arrastar (G)', () => { E.grade = !E.grade; pintar(); }),
      busca,
      el('span', { class: 'atos-sep' }),
      E.somenteLeitura ? null : b('Ferramentas do ato', 'Ajustes em todas as áreas de uma vez', () => { E.ferramentas = !E.ferramentas; pintar(); }, { class: E.ferramentas ? 'ativo' : '' }),
      b('?', 'Atalhos de teclado (?)', () => { E.ajuda = !E.ajuda; pintar(); }),
      el('span', { class: 'dica' }, E.ligando ? 'Modo ligar: clique na fase de destino (Esc cancela).' : 'Clique numa fase para editar o mapa, os mobs e a conclusão.'));
  }
  function painelDeAtalhos() {
    return el('div', { class: 'atos-ajuda' }, el('b', {}, 'Atalhos de teclado'), el('table', {}, el('tbody', {}, ATALHOS.map(([k, d]) => el('tr', {}, el('td', {}, el('kbd', {}, k)), el('td', {}, d))))), el('button', { type: 'button', onclick: () => { E.ajuda = false; pintar(); } }, 'Fechar'));
  }

  /** Ajustes em TODAS as áreas do ato (as do PoE): níveis das fases e status dos mobs, de uma vez — grava área por área. */
  function painelDeFerramentasDoAto() {
    const F = (E.ferramentasEstado ??= { nivel: 0, vida: 100, dano: 100, exp: 100, ocupado: false });
    const fasesPoe = E.ato.fases.filter((f) => f.huntId?.startsWith('poe-a'));
    const num = (rot, chave, sufixo, props = {}) => el('label', { class: 'campo' }, rot, el('div', { class: 'linha' }, el('input', { type: 'number', value: F[chave], style: 'width:90px', ...props, onchange: (e) => { F[chave] = Number(e.target.value); } }), el('span', { class: 'dica' }, sufixo)));
    const aplicarNiveis = () => {
      if (!F.nivel) return msg('Digite quantos níveis somar (pode ser negativo).', 'aviso');
      for (const f of E.ato.fases) if (f.nivel) for (const d of NIVEIS) f.nivel[d] = Math.max(1, (f.nivel[d] ?? 1) + F.nivel);
      if (E.ato.bossFinal?.nivel) for (const d of NIVEIS) E.ato.bossFinal.nivel[d] = Math.max(1, (E.ato.bossFinal.nivel[d] ?? 1) + F.nivel);
      msg(`Nível de ${E.ato.fases.length} fase(s) ${F.nivel > 0 ? '+' : ''}${F.nivel}. Salve o ato (Ctrl+S).`, 'ok');
      mudou();
    };
    const aplicarMobs = async () => {
      if (F.vida === 100 && F.dano === 100 && F.exp === 100) return msg('Mude algum percentual (100% = sem mudança).', 'aviso');
      if (!(await confirmar(`Ajustar os mobs de ${fasesPoe.length} área(s) do ${E.ato.nome}?`, `Vida ${F.vida}% · golpe ${F.dano}% · experiência ${F.exp}%. Grava área por área (vale na próxima entrada).`, { ok: 'Ajustar' }))) return;
      F.ocupado = true;
      pintar();
      let feitas = 0;
      for (const f of fasesPoe) {
        const a = await poeApi(`campanha/area?id=${encodeURIComponent(f.huntId)}`);
        const lista = a.monstros.map((m) => ({ ...limparMob(m), vida: Math.max(1, Math.round(m.vida * F.vida / 100)), escudoDeEnergia: Math.round((m.escudoDeEnergia ?? 0) * F.vida / 100), dano: Math.round(m.dano * F.dano / 100), experiencia: Math.round(m.experiencia * F.exp / 100) }));
        const r = await poeApi('campanha/area/monstros', { area: f.huntId, monstros: lista });
        if (r.ok) { feitas++; E.areas[f.huntId] = { poe: true, ...r.area }; delete E.mobsEditando[f.huntId]; }
      }
      F.ocupado = false;
      msg(`Mobs ajustados em ${feitas} de ${fasesPoe.length} área(s).`, feitas === fasesPoe.length ? 'ok' : 'aviso');
      pintar();
    };
    return el('fieldset', { class: 'atos-ferramentas-do-ato' }, el('legend', {}, `Ferramentas do ato — ${E.ato.nome}`),
      el('div', { class: 'linha', style: 'flex-wrap:wrap;align-items:flex-end' }, num('Somar ao nível de todas as fases', 'nivel', 'níveis'), el('button', { type: 'button', onclick: aplicarNiveis }, 'Aplicar nos níveis')),
      fasesPoe.length ? el('div', { class: 'linha', style: 'flex-wrap:wrap;align-items:flex-end' }, num('Vida dos mobs', 'vida', '%', { min: 1 }), num('Golpe dos mobs', 'dano', '%', { min: 0 }), num('Experiência', 'exp', '%', { min: 0 }),
        el('button', { type: 'button', class: 'primario', disabled: F.ocupado, onclick: aplicarMobs }, F.ocupado ? 'Ajustando…' : `Aplicar nos mobs de ${fasesPoe.length} áreas`)) : null,
      el('div', { class: 'dica' }, 'Os níveis entram no ato (salve com Ctrl+S). Os mobs gravam direto, área por área (a aba Acts → área → mobs mostra o resultado).'));
  }

  // Os atalhos valem só com a aba Acts aberta no fluxo e o foco fora de um campo (Ctrl+S vale sempre).
  document.addEventListener('keydown', (e) => {
    if (!E.ato || (modo === 'fases' ? !document.querySelector('.fases-modo') : !['fluxo', 'mapa'].includes(E.vista) || !document.querySelector('.atos-canvas, .atos-mapa'))) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (ctrl && k === 's') { e.preventDefault(); if (!E.somenteLeitura) salvar(); return; }
    const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '') || document.activeElement?.isContentEditable;
    if (digitando || document.querySelector('dialog[open]')) return;
    if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); return desfazer(); }
    if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); return refazer(); }
    if (ctrl || e.altKey) return;
    const feito = () => e.preventDefault();
    if (modo === 'fases') {
      if (e.key === 'PageDown') { feito(); vizinhaDaSelecionada(1); }
      if (e.key === 'PageUp') { feito(); vizinhaDaSelecionada(-1); }
      return;
    }
    if (e.key === 'Escape') { feito(); E.ligando = null; E.fase = null; E.lig = null; E.ajuda = false; return pintar(); }
    if (e.key === '?') { feito(); E.ajuda = !E.ajuda; return pintar(); }
    if (k === 'f' || e.key === '/') { feito(); return document.getElementById('atos-busca')?.focus(); }
    if (e.key === '+' || e.key === '=') { feito(); return zoomEm(1.25); }
    if (e.key === '-') { feito(); return zoomEm(0.8); }
    if (e.key === '0') { feito(); E.zoom = 1; E.pan = { x: 0, y: 0 }; return pintar(); }
    if (k === 'g') { feito(); E.grade = !E.grade; return pintar(); }
    if (e.key === 'PageDown') { feito(); return vizinhaDaSelecionada(1); }
    if (e.key === 'PageUp') { feito(); return vizinhaDaSelecionada(-1); }
    if (E.somenteLeitura) return;
    if (k === 'n') { feito(); return novaFase(); }
    if (k === 'o') { feito(); return organizar(); }
    if (k === 'l' && E.fase) { feito(); E.ligando = E.fase; msg('Clique na fase de DESTINO (Esc cancela).', 'aviso'); return pintar(); }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      feito();
      if (E.lig != null) { E.ato.conexoes.splice(E.lig, 1); E.lig = null; return mudou(); }
      if (E.fase) return confirmar(`Remover a fase "${faseDe(E.fase)?.nome}"?`, 'As ligações dela saem junto. Ctrl+Z desfaz.', { ok: 'Remover', perigo: true }).then((sim) => sim && removerFase(E.fase));
      return;
    }
    const passo = e.shiftKey ? 1 : 20;
    const setas = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] };
    if (setas[e.key] && E.fase) { feito(); return moverSelecionada(...setas[e.key]); }
  });

  // ------------------------------------------------------------------ tela
  function pintarFases() {
    const alvo = raiz();
    const atos = E.lista.filter((a) => !a.somenteLeitura);
    const selAto = el('select', { onchange: async (e) => { await abrir(e.target.value); E.fase = E.ato?.fases[0]?.id ?? null; pintar(); } }, atos.map((a) => el('option', { value: a.id, selected: a.id === E.ato?.id }, `${a.nome} (${a.fases} fases)`)));
    const cabeca = el('div', { class: 'eng-cabeca' }, el('div', {}, el('h1', {}, 'Fases'), el('p', {}, 'Cada fase do ato: os dados, como ela conclui, o mapa ligado a ela e os mobs. As ligações entre as fases (o caminho do ato) ficam na aba Acts.')));
    if (!E.ato) return alvo.replaceChildren(el('div', { class: 'fases-modo' }, cabeca, el('div', { class: 'linha' }, el('label', { class: 'campo', style: 'flex:none' }, 'Ato', selAto)), el('div', { class: 'dica' }, 'Escolha um ato.')));
    const fases = [...E.ato.fases].sort((a, b) => (a.ordem ?? 1e9) - (b.ordem ?? 1e9));
    if (!faseDe(E.fase)) E.fase = fases[0]?.id ?? null;
    const f = faseDe(E.fase);
    const lista = el('div', { class: 'fases-lista' }, fases.map((x) => el('button', { type: 'button', class: `fases-item${x.id === E.fase ? ' ativo' : ''}`, onclick: () => { E.fase = x.id; pintar(); } },
      el('span', { class: 'fases-ordem' }, String(x.ordem ?? '·')),
      el('div', { class: 'fases-texto' }, el('b', {}, x.nome), el('small', {}, `nv ${x.nivel?.facil ?? '?'} · ${TIPOS_VISUAIS[x.conclusao?.tipo ?? 'limpar-hunt']?.titulo ?? ''}${x.id === E.ato.inicio ? ' · início' : ''}${x.id === E.ato.bossFinal?.faseAnterior ? ' · antes do chefe' : ''}`)),
      seloDaConclusao(x) ? el('span', { class: 'fases-selo' }, seloDaConclusao(x)) : null)));
    const direita = f ? [painelDaFase(), painelDaConclusao(f), painelDosMobs(f), painelDeRecompensa(`fase:${f.id}`, 'fase', f.huntId, rotulosDe('fase'))].filter(Boolean) : [el('div', { class: 'dica' }, 'Escolha uma fase.')];
    alvo.replaceChildren(el('div', { class: 'fases-modo' }, cabeca,
      el('div', { class: 'atos-ferramentas' },
        el('label', { class: 'campo', style: 'flex:none' }, 'Ato', selAto),
        E.somenteLeitura ? null : el('button', { type: 'button', class: sujo() ? 'primario' : '', onclick: salvar, title: 'Ctrl+S' }, sujo() ? 'Salvar o ato (Ctrl+S)' : 'Salvo'),
        E.somenteLeitura ? null : el('button', { type: 'button', title: 'Desfazer (Ctrl+Z)', disabled: !E.hist.passado.length, onclick: desfazer }, '↶'),
        E.somenteLeitura ? null : el('button', { type: 'button', title: 'Refazer (Ctrl+Y)', disabled: !E.hist.futuro.length, onclick: refazer }, '↷'),
        irPara ? el('button', { type: 'button', onclick: () => irPara('atos', null, [E.ato.id, E.fase]) }, 'Ver no grafo (Acts) →') : null,
        el('span', { class: 'dica' }, `${fases.length} fases · Page Up/Down troca de fase`)),
      el('div', { class: 'fases-duas' }, el('aside', { class: 'fases-esq' }, lista), el('section', { class: 'fases-dir' }, direita)),
      painelDeProblemas()));
  }

  function pintar() {
    if (modo === 'fases') return pintarFases();
    const alvo = raiz();
    if (!E.ato) {
      alvo.replaceChildren(
        el('div', { class: 'dica' }, 'Atos do jogo (legados, somente leitura) e os do editor. Só beta/publicado são executados pelo jogo (no próximo boot); rascunho e desativado não.'),
        el('div', { class: 'linha' }, el('button', { class: 'primario', onclick: novo }, 'Novo ato')),
        el('table', {}, el('thead', {}, el('tr', {}, ['ID', 'Nome', 'Estado', 'Versão', 'Fases', 'Boss final', ''].map((h) => el('th', {}, h)))),
          el('tbody', {}, E.lista.map((a) => el('tr', { class: 'clicavel', onclick: () => abrir(a.id) }, el('td', {}, a.id), el('td', {}, a.nome), el('td', {}, el('span', { class: 'selo' }, a.estado)), el('td', {}, a.versao), el('td', {}, a.fases), el('td', {}, a.bossFinal ?? '—'), el('td', {}, a.somenteLeitura ? el('span', { class: 'selo' }, 'somente leitura') : ''))))));
      return;
    }
    const fase = faseDe(E.fase);
    const recFase = fase ? painelDeRecompensa(`fase:${fase.id}`, 'fase', fase.huntId, rotulosDe('fase')) : null;
    const recBoss = E.ato.bossFinal ? painelDeRecompensa('boss', 'boss', null, rotulosDe('boss')) : null;
    const lateral = [painelDoAto(), painelDaFase(), fase ? painelDaConclusao(fase) : null, fase ? painelDosMobs(fase) : null, recFase, painelDaLigacao(), painelDoBoss(), recBoss, painelPicker()].filter(Boolean);
    const VISTAS = [['fluxo', 'Fluxo'], ['mapa', 'Mapa'], ['validacao', 'Validação'], ['previa', 'Pré-visualização'], ['versoes', 'Versões'], ['publicacao', 'Publicação']];
    const barraDeVistas = el('div', { class: 'eng-abas atos-vistas' }, VISTAS.map(([id, nome]) => el('button', { type: 'button', class: E.vista === id ? 'ativa' : '', onclick: () => { E.vista = id; pintar(); } }, nome, id === 'validacao' && E.problemas.length ? el('span', { class: `selo ${E.problemas.some((p) => p.nivel === 'erro') ? 'erro' : 'aviso'}` }, String(E.problemas.length)) : null)));
    if (E.vista !== 'fluxo') {
      const corpo = el('div', { class: 'atos-vista-corpo' }, el('div', { class: 'dica' }, 'Carregando…'));
      const completar = async () => {
        // O nome do chefe na placa (como o jogo mostra), da Biblioteca — uma vez por chefe.
        const idDoBoss = E.ato.bossFinal?.bossId;
        if (E.vista === 'mapa' && idDoBoss && !(E.nomesDeBoss ??= new Map()).has(idDoBoss)) {
          E.nomesDeBoss.set(idDoBoss, (await api(`biblioteca/detalhe?${new URLSearchParams({ categoria: 'bosses', id: idDoBoss })}`).catch(() => null))?.nome ?? null);
        }
        if (E.vista === 'mapa') corpo.replaceChildren(vistaMapa(E.ato, posicoesAutomaticas(E.ato), {
          nomeDoBoss: idDoBoss ? E.nomesDeBoss.get(idDoBoss) : null,
          imagem: E.ato.imagem ? `/api/mapas/_conteudo/atos-imagem/${encodeURIComponent(E.ato.imagem)}?v=${E.versaoDaImagem ?? 0}` : null,
          fase: E.fase, somenteLeitura: E.somenteLeitura,
          aoMover: (f, p) => { lembrar(); f.posicao = p; mudou(); },
          aoEscolher: (id) => { E.fase = id; E.lig = null; pintar(); },
          aoMoverCidade: (p) => { lembrar(); E.ato.cidade.posicao = p; mudou(); },
          aoCriar: (p) => { lembrar(); novaFase(p); },
          aoEscolherCidade: () => { E.fase = null; E.lig = null; pintar(); },
        }), ...[painelDoAto(), painelDaCidade(), painelDaFase()].filter(Boolean));
        else if (E.vista === 'validacao') corpo.replaceChildren(vistaValidacao(E.problemas, { irParaFase: (id) => { E.fase = id; E.lig = null; E.vista = 'fluxo'; pintar(); } }));
        else if (E.vista === 'previa') corpo.replaceChildren(vistaPrevia(E.ato, { dif: E.difPrevia, aoMudarDif: (d) => { E.difPrevia = d; pintar(); } }));
        else if (E.vista === 'versoes') corpo.replaceChildren(await vistaVersoes({ api, ato: E.ato, sujo: sujo(), aoRestaurar: restaurar }));
        else if (E.vista === 'publicacao') corpo.replaceChildren(await vistaPublicacao({ api, ato: E.ato, sujo: sujo(), aoMudarEstado: mudarEstado }));
      };
      alvo.replaceChildren(
        el('div', { class: 'linha' }, el('button', { onclick: async () => { if (sujo() && !(await descartarAlteracoes('O ato aberto tem alterações não salvas'))) return; E.ato = null; await carregarLista(); pintar(); } }, '← Atos'), el('b', {}, `${E.ato.nome} `, el('span', { class: 'dica' }, `(${E.ato.id}, versão ${E.ato.versao}, ${E.ato.estado})${sujo() ? ' • alterações não salvas' : ''}`)), E.somenteLeitura ? null : el('button', { class: 'primario', onclick: salvar }, 'Salvar rascunho')),
        barraDeVistas, corpo);
      completar();
      return;
    }
    alvo.replaceChildren(
      barraDeVistas,
      el('div', { class: 'linha' },
        el('button', { onclick: async () => { if (sujo() && !(await descartarAlteracoes('O ato aberto tem alterações não salvas'))) return; E.ato = null; await carregarLista(); pintar(); } }, '← Atos'),
        el('b', {}, `${E.ato.nome} `, el('span', { class: 'dica' }, `(${E.ato.id}, versão ${E.ato.versao})${sujo() ? ' • alterações não salvas' : ''}`)),
        E.somenteLeitura ? el('span', { class: 'selo' }, 'somente leitura — duplique para editar') : null,
        el('button', { onclick: duplicar }, 'Duplicar'),
        E.somenteLeitura ? null : el('button', { class: 'primario', onclick: salvar }, 'Salvar rascunho'),
        E.somenteLeitura ? null : el('button', { class: 'perigo', onclick: excluir }, 'Excluir')),
      barraDeFerramentas(),
      E.ajuda ? painelDeAtalhos() : null,
      E.ferramentas ? painelDeFerramentasDoAto() : null,
      el('div', { class: 'atos-duas' }, el('div', { class: 'atos-esquerda' }, pintarCanvas(), painelDeProblemas()), el('div', { class: 'atos-direita' }, lateral)));
  }

  return {
    async desenhar(resto = []) {
      await carregarLista();
      // Abrir num ato/fase (link de outra tela: `#poe-fases/<ato>/<fase>` ou `#atos/<ato>/<fase>`); a aba Fases abre o primeiro ato do PoE.
      const alvoAto = resto[0] ?? (modo === 'fases' && !E.ato ? (E.lista.find((a) => a.id.startsWith('poe-ato-')) ?? E.lista.find((a) => !a.somenteLeitura))?.id : null);
      // Sem alteração pendente, relê do servidor (a outra aba — Acts ou Fases — pode ter salvo o mesmo ato).
      if (alvoAto && (alvoAto !== E.ato?.id || !sujo()) && E.lista.some((a) => a.id === alvoAto)) await abrir(alvoAto);
      if (resto[1] && faseDe(resto[1])) E.fase = resto[1];
      pintar();
    },
    sujo,
  };
}
