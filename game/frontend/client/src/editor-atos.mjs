// A aba "Atos" do editor de conteúdo: monta um ato visualmente (fases, ligações, boss final) sobre os cadastros da Biblioteca. NENHUMA regra
// mora aqui: o servidor valida (`systems/atos-modelo.mjs`) e grava (`admin/atos.mjs`); a tela só edita uma cópia e pede a validação a cada
// mudança. Os atos legados (os 4 de hoje) são somente leitura: "Duplicar" cria o rascunho editável.
// Recebe as ferramentas da página (`el`, `api`, a raiz, `msg`) em vez de importá-las, para não fechar ciclo com `editor-conteudo.mjs`.
import { confirmar, pedirTexto, descartarAlteracoes } from './editor-ui.mjs';
import { editorDeDrops } from './editor-poe-telas.mjs';

const POE = '/api/mapas/_engine/itens-poe/';
const poeApi = async (rota, corpo) => (await fetch(POE + rota, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) } : {})).json();

/** O ID do ato: a tela só exige que não fique vazio — o formato é o servidor quem confere. */
const obrigatorio = (v) => (v ? null : 'Digite um ID.');

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

export function criarEditorDeAtos({ el, api, raiz, msg }) {
  const E = { lista: [], opcoes: null, ato: null, somenteLeitura: false, fase: null, lig: null, ligando: null, problemas: [], limpo: '', picker: { alvo: null, q: '', itens: [], detalhe: null } };
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
    pintar();
  }
  let esperando = null;
  function mudou() {
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
    if (r.ok === false) return msg(r.erros?.join(' ') ?? 'Não salvou.', 'erro');
    E.ato = r.ato;
    E.limpo = JSON.stringify(E.ato);
    E.problemas = r.problemas;
    await carregarLista();
    msg(`Rascunho salvo (versão ${r.ato.versao}).${r.valido ? '' : ' Há erros na validação: o ato ainda não pode ir para beta.'}`, r.valido ? 'ok' : 'aviso');
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
  function novaFase() {
    const n = E.ato.fases.length + 1;
    let id = `fase-${n}`;
    while (faseDe(id)) id = `${id}-x`;
    E.ato.fases.push({ id, nome: `Fase ${n}`, descricao: '', ordem: n, huntId: null, tipo: 'hunt-normal', nivel: null, obrigatoria: true, requisitos: { exige: [] }, objetivos: [], conclusao: { tipo: 'limpar-hunt' }, recompensas: null, eventos: [], sobrescritas: {}, posicao: null });
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

  // ------------------------------------------------------------------ canvas
  function pintarCanvas() {
    const pos = posicoesAutomaticas(E.ato);
    const alcance = new Set(E.problemas.filter((p) => /isolada/.test(p.mensagem)).map((p) => p.onde.replace('fase ', '')));
    const comErro = new Set(E.problemas.filter((p) => p.nivel === 'erro' && p.onde.startsWith('fase ')).map((p) => p.onde.replace('fase ', '')));
    const svg = sv('svg', { viewBox: `0 0 ${L} ${A}`, class: 'atos-canvas', role: 'img', 'aria-label': 'Fluxo do ato' },
      sv('defs', {}, sv('marker', { id: 'seta', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, sv('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#8aa0c8' })),
        sv('marker', { id: 'seta-sel', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, sv('path', { d: 'M0 0 L10 5 L0 10 z', fill: '#ffd166' }))));
    // A imagem de fundo do ato (o mapa desenhado por trás do grafo).
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
    for (const f of E.ato.fases) {
      const p = pos.get(f.id);
      const sel = E.fase === f.id;
      const tipoOk = E.opcoes.tiposDeFase.find((t) => t.id === f.tipo)?.suportado;
      const g = sv('g', { transform: `translate(${p.x} ${p.y})`, style: 'cursor:pointer', tabindex: 0, role: 'button', 'aria-label': f.nome });
      g.append(sv('circle', { r: RAIO, fill: f.id === E.ato.inicio ? '#1f4a30' : '#1b2438', stroke: comErro.has(f.id) || alcance.has(f.id) ? '#ff6b6b' : sel ? '#ffd166' : E.ligando === f.id ? '#6bd0ff' : f.obrigatoria ? '#8aa0c8' : '#667', 'stroke-width': sel || E.ligando === f.id ? 3 : 2, 'stroke-dasharray': f.obrigatoria ? null : '4 3' }),
        sv('text', { y: 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 11 }, (f.ordem ?? '·').toString()),
        sv('text', { y: RAIO + 14, 'text-anchor': 'middle', fill: tipoOk ? '#cfd6e6' : '#ffb347', 'font-size': 10.5 }, f.nome.length > 16 ? `${f.nome.slice(0, 15)}…` : f.nome));
      let arrastou = false;
      g.addEventListener('pointerdown', (ev) => {
        if (E.somenteLeitura || E.ligando) return;
        const caixa = svg.getBoundingClientRect();
        const k = L / caixa.width;
        const ox = ev.clientX;
        const oy = ev.clientY;
        const x0 = p.x;
        const y0 = p.y;
        const mover = (m) => {
          if (Math.hypot(m.clientX - ox, m.clientY - oy) > 4) arrastou = true;
          if (!arrastou) return;
          f.posicao = { x: Math.round(Math.min(L - 30, Math.max(30, x0 + (m.clientX - ox) * k))), y: Math.round(Math.min(A - 40, Math.max(30, y0 + (m.clientY - oy) * k))) };
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
    svg.addEventListener('click', () => { E.fase = null; E.lig = null; E.ligando = null; pintar(); });
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
      R.previa ? el('table', { class: 'bib-sub' }, el('thead', {}, el('tr', {}, ['Item', 'Qtd', 'Chance', 'Esperado/exec.', 'Origem', 'Condição'].map((h) => el('th', {}, h)))), el('tbody', {}, R.previa.linhas.map((l) => el('tr', {}, el('td', {}, l.nome ?? l.item ?? '—'), el('td', {}, l.quantidade ?? '—'), el('td', {}, `${l.chancePct}%`), el('td', {}, l.esperadoPorExecucao ?? '—'), el('td', {}, l.origem), el('td', {}, l.condicao))))) : null,
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

  function painelDaConclusao(f) {
    const conc = f.conclusao ?? { tipo: 'limpar-hunt' };
    const T = E.opcoes.tiposDeConclusao.find((t) => t.id === conc.tipo) ?? {};
    const area = areaDaFase(f.huntId);
    const monstros = area?.monstros ?? [];
    const opMonstros = monstros.map((m) => [m.slug, `${m.nome}${m.unico ? ' (único)' : ''}${m.nivel ? ` · nv ${m.nivel}` : ''}`]);
    if (conc.monstro && !opMonstros.some(([v]) => v === conc.monstro)) opMonstros.unshift([conc.monstro, conc.nome ?? conc.monstro]);
    const mudar = (novo) => { f.conclusao = novo; mudou(); };
    const opItens = (E.missao ?? []).map((i) => [String(i.id), `${i.nome} — ${i.missao}`]);
    return el('fieldset', {}, el('legend', {}, 'Como a fase conclui'),
      el('div', { class: 'grade' },
        selecao('Conclusão', conc.tipo, E.opcoes.tiposDeConclusao.map((t) => [t.id, t.nome]), (v) => mudar({ tipo: v || 'limpar-hunt' })),
        T.exigeMonstro || conc.tipo === 'matar-n' ? selecao('Monstro', conc.monstro ?? '', opMonstros, (v) => { const m = monstros.find((x) => x.slug === v); mudar({ ...conc, monstro: v || undefined, nome: m?.nome }); }, conc.tipo === 'matar-n' ? '(qualquer monstro)' : '(escolha)') : null,
        T.exigeQuantidade ? campo('Quantidade', conc.quantidade, (v) => mudar({ ...conc, quantidade: numero(v) }), { type: 'number', min: 1 }) : null,
        T.exigeItem ? selecao('Item da missão', conc.item != null ? String(conc.item) : '', opItens, (v) => mudar({ ...conc, item: v ? Number(v) : undefined }), '(escolha)') : null),
      el('div', { class: 'dica' }, {
        'limpar-hunt': 'Conclui ao limpar a instância inteira.',
        'matar-chefe': 'Conclui quando o monstro escolhido morre (limpar a área sem ele não conclui).',
        'matar-n': 'Conclui ao matar a quantidade (do monstro escolhido, ou de qualquer um). O progresso fica salvo.',
        'item-de-missao': 'O monstro alvo solta o item da missão (a tabela de drop dele, abaixo) e pegá-lo conclui. Sem a linha na tabela, o item cai do mesmo jeito ao matar o alvo.',
      }[conc.tipo] ?? ''),
      f.objetivos?.length ? [el('b', {}, 'Missões desta área (Drive)'), el('ul', { class: 'atos-missoes' }, f.objetivos.map((o) => el('li', {}, el('b', {}, o.missao ?? ''), o.texto ? ` — ${o.texto}` : '')))] : null);
  }

  function painelDosMobs(f) {
    const area = areaDaFase(f.huntId);
    if (!f.huntId) return null;
    if (!area) return el('fieldset', {}, el('legend', {}, 'Mapa, mobs e drops'), el('div', { class: 'dica' }, 'Carregando…'));
    if (!area.poe) return el('fieldset', {}, el('legend', {}, 'Mobs da hunt'), el('div', { class: 'dica' }, area.monstros.map((m) => m.nome).join(', ') || 'sem monstros'), el('div', { class: 'dica' }, 'A tabela de drop por monstro vale para os monstros do PoE (com o PoE ligado).'));
    const sel = el('select', { disabled: E.somenteLeitura }, (E.mapas ?? [{ id: area.mapa, nome: area.nomeDoMapa }]).map((m) => el('option', { value: m.id, selected: m.id === area.mapa }, `${m.nome}${m.nivel ? ` (nv ${m.nivel})` : ''}`)));
    const trocar = el('button', { type: 'button', disabled: E.somenteLeitura, onclick: async () => {
      if (sel.value === area.mapa) return msg('Esse já é o mapa da área.', 'aviso');
      const r = await poeApi('campanha/mapa', { area: f.huntId, mapa: sel.value });
      if (!r.ok) return msg(r.erros?.[0] ?? 'Não deu.', 'erro');
      E.areas[f.huntId] = { poe: true, ...r.area };
      msg(`Mapa de ${area.nome} trocado (vale na próxima entrada).`, 'ok');
      pintar();
    } }, 'Trocar mapa');
    return el('fieldset', {}, el('legend', {}, 'Mapa, mobs e drops'),
      el('div', { class: 'linha' }, el('label', { class: 'campo', style: 'flex:1;min-width:0' }, 'Mapa (terreno do Draevor)', sel), trocar),
      el('div', { class: 'dica' }, `Nível ${area.nivel}. Os bichos são os do PoE (status do PoE, desenho do Draevor). Comuns caem pela tabela global do PoE; só os únicos têm drop próprio (clique para editar).`),
      el('div', { class: 'atos-mobs' }, area.monstros.map((m) => el('details', { class: 'atos-mob' },
        el('summary', {}, el('b', {}, m.nome), m.unico ? el('span', { class: 'selo aviso', style: 'margin-left:6px' }, 'único') : null, f.conclusao?.monstro === m.slug ? el('span', { class: 'selo usos', style: 'margin-left:6px' }, 'alvo da fase') : null,
          el('span', { class: 'dica' }, ` nv ${m.nivel} · ${Number(m.vida + (m.escudoDeEnergia ?? 0)).toLocaleString('pt-BR')} vida · golpe ${m.dano}${m.drops?.length ? ` · ${m.drops.length} drop(s)` : ''}`)),
        m.unico ? editorDeDrops(m.slug, m.drops ?? [], { somenteLeitura: E.somenteLeitura, aoSalvar: (drops) => { m.drops = drops; } }) : el('div', { class: 'dica' }, 'Monstro comum: sem item próprio (modelo do PoE). Cai pela tabela global: ~16% de chance (mais nos mágicos/raros), Item Level = o nível dele, qualquer base até esse nível, raridade pelos pesos.')))));
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

  function painelDaFase() {
    const f = faseDe(E.fase);
    if (!f) return null;
    const pos = (id) => (id === E.ato.inicio ? ' (início)' : '');
    const tipos = E.opcoes.tiposDeFase.map((t) => [t.id, `${t.nome}${t.suportado ? '' : ' — sem suporte no runtime'}`]);
    const hunt = f.huntId ? `${f.huntId}` : 'nenhuma';
    return el('fieldset', {}, el('legend', {}, `Fase: ${f.nome}${pos(f.id)}`),
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
      E.somenteLeitura ? null : el('div', { class: 'linha' }, el('button', { onclick: () => { E.ligando = f.id; msg(`Clique na fase de DESTINO para ligar "${f.nome}" a ela.`, 'aviso'); pintar(); } }, 'Ligar a outra fase →'), el('button', { class: 'perigo', onclick: () => removerFase(f.id) }, 'Remover fase')));
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

  // ------------------------------------------------------------------ tela
  function pintar() {
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
    alvo.replaceChildren(
      el('div', { class: 'linha' },
        el('button', { onclick: async () => { if (sujo() && !(await descartarAlteracoes('O ato aberto tem alterações não salvas'))) return; E.ato = null; await carregarLista(); pintar(); } }, '← Atos'),
        el('b', {}, `${E.ato.nome} `, el('span', { class: 'dica' }, `(${E.ato.id}, versão ${E.ato.versao})${sujo() ? ' • alterações não salvas' : ''}`)),
        E.somenteLeitura ? el('span', { class: 'selo' }, 'somente leitura — duplique para editar') : null,
        el('button', { onclick: duplicar }, 'Duplicar'),
        E.somenteLeitura ? null : el('button', { class: 'primario', onclick: salvar }, 'Salvar rascunho'),
        E.somenteLeitura ? null : el('button', { class: 'perigo', onclick: excluir }, 'Excluir')),
      E.somenteLeitura ? null : el('div', { class: 'linha' }, el('button', { onclick: novaFase }, '+ Fase'), el('span', { class: 'dica' }, E.ligando ? 'Modo ligar: clique na fase de destino.' : 'Arraste as fases para organizar; clique numa fase ou seta para editar. Borda tracejada = fase opcional; seta tracejada = caminho com requisito; verde = início; roxo = portal/boss final.')),
      el('div', { class: 'atos-duas' }, el('div', { class: 'atos-esquerda' }, pintarCanvas(), painelDeProblemas()), el('div', { class: 'atos-direita' }, lateral)));
  }

  return {
    async desenhar() {
      if (!E.opcoes) await carregarLista();
      else await carregarLista();
      pintar();
    },
    sujo,
  };
}
