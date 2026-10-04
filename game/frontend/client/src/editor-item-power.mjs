// A aba "Item Power" da Engine: o ITEM POWER BASE — um indicador de COMPARAÇÃO dos atributos base dos equipamentos (Damage, Block, Armour, Evasion, Energy Shield), uma curva de
// referência por level e as ferramentas de balanceamento de onde cada item cai. NÃO é DPS, força real do personagem nem garantia de equilíbrio em combate, e nada aqui altera
// item, drop ou combate. A fórmula, a curva e as regras são editadas por override (a fábrica nunca muda): editar → prévia (valida e mostra o impacto) → salvar → publicar.
// Toda regra mora no servidor (`systems/item-power.mjs`, `admin/overrides-item-power.mjs`, `admin/item-power-analise.mjs`); aqui só há tela.
import { el, cabecalho, confirmar, msg, tratarConflito } from './editor-ui.mjs';
import { retrato } from './editor-sprites.mjs';

const SITUACAO = { abaixo: 'Abaixo do esperado', adequado: 'Adequado', acima: 'Acima do esperado', 'muito-acima': 'Muito acima', 'sem-poder': 'Sem atributos base', 'sem-level': 'Sem level mínimo', 'sem-referencia': 'Sem referência' };
const COR = { abaixo: 'aviso', adequado: 'ok', acima: 'aviso', 'muito-acima': 'bloqueante', 'sem-poder': 'mudo', 'sem-level': 'mudo', 'sem-referencia': 'mudo' };
const ABAS = [['itens', 'Itens'], ['curva', 'Curva de referência'], ['formula', 'Fórmula e pesos'], ['comparar', 'Comparar'], ['marcos', 'Presentes de marco'], ['distribuicao', 'Distribuição e alertas']];
const DIFICULDADES = [['facil', 'Normal'], ['medio', 'Cruel'], ['dificil', 'Merciless']];
const BLOCOS = { pesos: 'Pesos', normalizacao: 'Normalização (fator aplicado ao atributo antes do peso)', classificacao: 'Classificação (diferença % como fração: 0,25 = 25%)', alertas: 'Alertas' };
const DICAS = { blockDaArma: 'fração da defesa da ARMA que conta como Block (a ficha do jogo usa a metade)', danoDoCajado: 'peso do dano legado de cajados/rods (a ficha do jogo não o usa: 0)', abaixoDe: 'abaixo disto = "Abaixo do esperado"', acimaDe: 'acima disto = "Acima do esperado"', muitoAcimaDe: 'acima disto = "Muito acima"', saltoAbruptoFator: 'inclinação da curva > fator × mediana = salto', lacunaFator: 'razão de IP entre itens vizinhos que vira lacuna', huntsDemais: 'item em mais hunts que isto gera alerta', margemDeLevel: 'item com level mínimo acima do level da hunt + margem gera alerta', itemMuitoAbaixoPct: 'diferença (negativa) abaixo da qual o item é "muito abaixo" para a hunt' };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const num = (v) => (v === '' || v == null ? undefined : Number(v));
const pct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`);

export function criarTelaDeItemPower({ api, raiz, sujo = null, podeGravar = () => true }) {
  const E = { dados: null, cfg: null, base: '', aba: 'itens', previa: null, timer: null, pedido: 0, lista: null, filtro: { q: '', slot: '', classe: '', raridade: '', nivelMin: '', nivelMax: '', situacao: '', ordem: 'level', pagina: 0 }, sel: null, detalhe: null, sim: {}, simRes: null, categoria: 'weapon', curva: null, comp: [], compRes: null, marcos: null, dif: 'facil', alertas: null, filtroAlerta: '', hunts: null, hunt: null, huntRes: null, regraRes: null };
  const dis = () => !podeGravar();
  const alterado = () => E.base !== JSON.stringify(E.cfg);
  const chip = (s, t = null) => el('span', { class: `val-chip ${COR[s] ?? 'mudo'}` }, t ?? SITUACAO[s] ?? s);

  async function carregar() {
    E.dados = await api('item-power');
    E.cfg = structuredClone(E.dados.efetiva);
    E.base = JSON.stringify(E.cfg);
    E.previa = null;
    sujo?.limpar();
  }
  async function desenhar() { await carregar(); E.lista = null; pintar(); await abrirAba(E.aba); }
  const overrideAtual = () => ({ ativo: E.dados.override?.ativo !== false, ...E.cfg });
  function mudou() {
    sujo?.[alterado() ? 'marcar' : 'limpar']();
    atualizarBarra();
    clearTimeout(E.timer);
    E.timer = setTimeout(previsualizar, 400);
  }
  async function previsualizar() {
    const meu = ++E.pedido;
    const r = await api('item-power/validar', { override: overrideAtual() });
    if (meu !== E.pedido) return;
    E.previa = r;
    document.querySelector('#ip-previa')?.replaceWith(previa());
    atualizarBarra();
  }
  function atualizarBarra() {
    const s = document.querySelector('#ip-salvar'); if (s) s.disabled = dis() || !alterado() || E.previa?.ok === false;
    const d = document.querySelector('#ip-descartar'); if (d) d.disabled = !alterado();
    const c = document.querySelector('#ip-contagem'); if (c) c.textContent = alterado() ? 'alterações não salvas' : (Object.keys(E.dados.override ?? {}).filter((k) => !['ativo', '_nota'].includes(k)).length ? 'override salvo' : 'sem override (vale a fábrica)');
  }

  // ------------------------------------------------------------ ações
  async function salvar() {
    const r0 = await api('item-power/validar', { override: overrideAtual() });
    if (!r0.ok) { E.previa = r0; document.querySelector('#ip-previa')?.replaceWith(previa()); return msg((r0.erros ?? []).join(' '), 'erro'); }
    if (!(await confirmar('Salvar a configuração do Item Power?', `Versão da fórmula ${r0.impacto.versaoAntes} → ${r0.impacto.versaoDepois}; ${r0.impacto.mudaramDeSituacao} item(ns) mudam de situação. A fábrica não é tocada e nenhum item, drop ou combate muda. O servidor local aplica na hora (Hot Reload); para valer na produção é commit + deploy.`, { ok: 'Salvar' }))) return;
    const r = await api('item-power', { acao: 'salvar', override: overrideAtual(), revisao: E.dados.revisao });
    if (await tratarConflito(r, () => desenhar())) return;
    if (r.ok === false) return msg((r.erros ?? ['Não salvou.']).join(' '), 'erro');
    msg(`Item Power salvo. ${r.comoPublicar ?? ''}`, 'ok');
    E.lista = E.curva = E.alertas = E.marcos = null; await desenhar();
  }
  async function descartar() {
    if (!(await confirmar('Descartar as alterações não salvas?', 'Volta ao último estado salvo.', { ok: 'Descartar', perigo: true }))) return;
    await carregar(); pintar(); await abrirAba(E.aba);
  }
  async function reverterTudo() {
    if (!(await confirmar('Voltar tudo ao original?', 'Apaga o override do Item Power (a versão anterior vai para o histórico). A fábrica não muda.', { ok: 'Voltar ao original', perigo: true }))) return;
    const r = await api('item-power', { acao: 'reverter', revisao: E.dados.revisao });
    if (await tratarConflito(r, () => desenhar())) return;
    if (r.ok === false) return msg((r.erros ?? ['Não reverteu.']).join(' '), 'erro');
    E.lista = E.curva = E.alertas = E.marcos = null; await desenhar();
  }
  async function restaurarVersao(n) {
    if (!(await confirmar(`Restaurar a versão ${n}?`, 'A configuração atual vai para o histórico.', { ok: 'Restaurar' }))) return;
    const r = await api('item-power', { acao: 'restaurar', versao: n, revisao: E.dados.revisao });
    if (await tratarConflito(r, () => desenhar())) return;
    if (r.ok === false) return msg((r.erros ?? ['Não restaurou.']).join(' '), 'erro');
    E.lista = E.curva = E.alertas = E.marcos = null; await desenhar();
  }

  // ------------------------------------------------------------ peças comuns
  const campo = (rotulo, entrada, dica = null) => el('label', { class: 'campo ip-campo', title: dica ?? '' }, rotulo, entrada);
  const entradaNum = (obj, chave, { w = 90, passo = 'any' } = {}) => el('input', { type: 'number', step: passo, value: obj[chave] ?? '', disabled: dis(), style: `width:${w}px`, onchange: (e) => { const v = num(e.target.value); if (v === undefined) delete obj[chave]; else obj[chave] = v; mudou(); } });
  const tabela = (cabs, linhas) => el('table', { class: 'mob-tabela' }, el('thead', {}, el('tr', {}, cabs.map((h) => el('th', {}, h)))), el('tbody', {}, linhas));
  const aviso = () => el('div', { class: 'dica ip-aviso' }, E.dados.aviso);

  function previa() {
    const p = E.previa;
    if (!p) return el('div', { id: 'ip-previa', class: 'dica' }, alterado() ? 'Calculando a prévia…' : 'Nenhuma alteração pendente.');
    const erros = p.erros ?? [];
    const imp = p.impacto;
    return el('div', { id: 'ip-previa', class: 'hunt-sec' },
      erros.length ? el('ul', { class: 'problemas' }, erros.map((m) => el('li', { class: 'erro' }, m))) : null,
      (p.avisos ?? []).length ? el('ul', { class: 'problemas' }, p.avisos.map((m) => el('li', { class: 'aviso' }, m))) : null,
      imp ? el('div', {}, el('div', { class: 'dica' }, `Fórmula v${imp.versaoAntes} → v${imp.versaoDepois} · ${imp.mudaramDeSituacao} item(ns) mudam de situação.`),
        tabela(['Situação', 'Agora', 'Depois'], ['abaixo', 'adequado', 'acima', 'muito-acima'].map((s) => el('tr', {}, el('td', {}, SITUACAO[s]), el('td', {}, String(imp.antes[s])), el('td', {}, String(imp.depois[s]))))),
        imp.exemplos.length ? el('details', {}, el('summary', {}, 'Quem muda de situação (primeiros 40)'), el('ul', {}, imp.exemplos.map((x) => el('li', {}, `${x.nome} (${E.dados.rotulosDoSlot[x.slot]}): ${SITUACAO[x.de]} → ${SITUACAO[x.para]} (IP ${x.ipAntes} → ${x.ipDepois})`)))) : null) : null);
  }

  // ------------------------------------------------------------ aba Itens
  async function buscar() {
    const f = E.filtro;
    E.lista = await api(`item-power/itens?${new URLSearchParams({ ...f, limite: 50 })}`);
    document.querySelector('#ip-lista')?.replaceWith(lista());
  }
  function filtros() {
    const f = E.filtro;
    const aoMudar = (k) => (e) => { f[k] = e.target.value; f.pagina = 0; clearTimeout(E.tBusca); E.tBusca = setTimeout(buscar, 220); };
    const sel = (k, opcoes, todos) => el('select', { onchange: aoMudar(k) }, [el('option', { value: '' }, todos), ...opcoes.map(([v, n]) => el('option', { value: v, selected: f[k] === v }, n))]);
    return el('div', { class: 'linha ip-filtros' },
      el('input', { type: 'search', placeholder: 'nome ou ID…', value: f.q, oninput: aoMudar('q') }),
      sel('slot', E.dados.slots.map((s) => [s, E.dados.rotulosDoSlot[s]]), 'todas as categorias'),
      sel('classe', ['knight', 'paladin', 'druid', 'sorcerer', 'monk'].map((c) => [c, c]), 'todas as classes'),
      sel('raridade', ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico'].map((c) => [c, c]), 'todas as raridades'),
      sel('situacao', Object.entries(SITUACAO), 'todas as situações'),
      el('input', { type: 'number', placeholder: 'level de', value: f.nivelMin, style: 'width:80px', oninput: aoMudar('nivelMin') }),
      el('input', { type: 'number', placeholder: 'level até', value: f.nivelMax, style: 'width:80px', oninput: aoMudar('nivelMax') }),
      el('select', { onchange: aoMudar('ordem') }, [['level', 'ordenar por level'], ['ip', 'por IP'], ['diferenca', 'por diferença'], ['nome', 'por nome']].map(([v, n]) => el('option', { value: v, selected: f.ordem === v }, n))));
  }
  function lista() {
    const l = E.lista;
    if (!l) return el('div', { id: 'ip-lista', class: 'dica' }, 'Carregando…');
    const f = E.filtro; const ult = Math.max(0, Math.ceil(l.total / 50) - 1);
    return el('div', { id: 'ip-lista' },
      el('div', { class: 'linha' }, el('span', { class: 'dica' }, `${l.total} equipamento(s) · página ${f.pagina + 1} de ${ult + 1}`),
        el('button', { type: 'button', class: 'fantasma', disabled: f.pagina <= 0, onclick: () => { f.pagina--; buscar(); } }, '‹'), el('button', { type: 'button', class: 'fantasma', disabled: f.pagina >= ult, onclick: () => { f.pagina++; buscar(); } }, '›')),
      tabela(['', 'Item', 'Categoria', 'Level', 'Raridade', 'IP', 'Esperado', 'Dif.', 'Situação', ''], l.itens.map((i) => el('tr', { class: `conj-linha${E.sel === i.id ? ' ativa' : ''}`, onclick: () => escolher(i.id) },
        el('td', {}, retrato(i.desenho ?? null, 28, { categoria: 'itens' })), el('td', {}, `${i.nome} `, el('span', { class: 'dica' }, `#${i.id}`)), el('td', {}, E.dados.rotulosDoSlot[i.slot]), el('td', {}, i.minLevel ?? '—'), el('td', {}, i.raridade ?? '—'),
        el('td', {}, String(i.ip)), el('td', {}, i.esperado ?? '—'), el('td', {}, pct(i.diferencaPct)), el('td', {}, chip(i.situacao)),
        el('td', {}, el('button', { type: 'button', class: 'fantasma', title: 'Adicionar à comparação', onclick: (e) => { e.stopPropagation(); if (!E.comp.includes(i.id)) E.comp.push(i.id); msg(`${i.nome} na comparação (${E.comp.length}).`, 'ok'); } }, '+ comparar'))))));
  }
  async function escolher(id) {
    E.sel = id; E.sim = {}; E.simRes = null;
    E.detalhe = await api(`item-power/item/${id}?dif=${E.dif}`);
    document.querySelector('#ip-detalhe')?.replaceWith(detalhe());
    document.querySelectorAll('#ip-lista .conj-linha').forEach((tr) => tr.classList.remove('ativa'));
  }
  const ATRS = [['damageMin', 'Damage mín.'], ['damageMax', 'Damage máx.'], ['defesa', 'Defesa (Block)'], ['armour', 'Armour'], ['evasion', 'Evasion'], ['energyShield', 'Energy Shield']];
  async function simular() {
    const r = await api('item-power/simular', { itemId: E.sel, atributos: E.sim, config: alterado() ? overrideAtual() : null });
    E.simRes = r;
    document.querySelector('#ip-detalhe')?.replaceWith(detalhe());
  }
  function detalhe() {
    const d = E.detalhe;
    if (!d) return el('div', { id: 'ip-detalhe', class: 'dica' }, 'Escolha um equipamento na lista para ver o detalhamento da pontuação.');
    const s = E.simRes?.ok ? E.simRes : null;
    const contrib = (s ?? d).contribuicao;
    return el('div', { id: 'ip-detalhe', class: 'hunt-sec' },
      el('h4', {}, `${d.nome} `, chip(s ? s.situacao : d.situacao)),
      el('div', { class: 'dica' }, `${E.dados.rotulosDoSlot[d.slot]} · ${d.categoria} · level ${s?.level ?? d.minLevel ?? '—'} (recomendado = mínimo) · ${d.raridade ?? 'sem raridade'} · ${d.vocations.length ? d.vocations.join('/') : 'todas as classes'}`),
      el('div', {}, el('b', {}, `Item Power ${s ? s.ip : d.ip}`), ` · esperado ${s ? s.esperado ?? '—' : d.esperado ?? '—'} · diferença ${s ? s.diferenca ?? '—' : d.diferenca ?? '—'} (${pct(s ? s.diferencaPct : d.diferencaPct)})`, s ? el('span', { class: 'selo' }, 'simulação') : null),
      tabela(['Atributo', 'Valor', 'Fator', 'Peso', 'Pontos'], E.dados.atributos.map((a) => el('tr', {}, el('td', {}, E.dados.rotulosDoAtributo[a]), el('td', {}, String(contrib[a].valor)), el('td', {}, String(contrib[a].normalizado === contrib[a].valor ? 1 : (contrib[a].valor ? contrib[a].normalizado / contrib[a].valor : 1))), el('td', {}, String(contrib[a].peso)), el('td', {}, String(contrib[a].pontos))))),
      el('h4', {}, 'Simular outros atributos (nada é gravado)'),
      el('div', { class: 'linha' }, ATRS.map(([k, n]) => campo(n, el('input', { type: 'number', min: 0, step: 'any', value: E.sim[k] ?? '', placeholder: String(d.atributos[{ damageMin: 'damageMin', damageMax: 'damageMax', defesa: 'block', armour: 'armour', evasion: 'evasion', energyShield: 'energyShield' }[k]] ?? ''), style: 'width:90px', oninput: (e) => { E.sim[k] = e.target.value; } }))),
        el('button', { type: 'button', onclick: simular }, 'Recalcular'), el('button', { type: 'button', class: 'fantasma', onclick: () => { E.sim = {}; E.simRes = null; document.querySelector('#ip-detalhe')?.replaceWith(detalhe()); } }, 'Limpar')),
      s === null && E.simRes && E.simRes.ok === false ? el('ul', { class: 'problemas' }, (E.simRes.erros ?? []).map((m) => el('li', { class: 'erro' }, m))) : null,
      el('h4', {}, 'Onde cai'),
      d.ondeCai?.length ? tabela(['Hunt', 'Level', 'Ato', 'Chance', 'Monstros'], d.ondeCai.map((o) => el('tr', {}, el('td', {}, o.nome), el('td', {}, o.level ?? '—'), el('td', {}, o.ato ?? '—'), el('td', {}, `${(o.chance * 100).toFixed(3)}%`), el('td', {}, o.monstros.join(', '))))) : el('div', { class: 'dica' }, 'Nenhuma hunt do catálogo dropa este equipamento.'));
  }
  const abaItens = () => el('div', { class: 'ip-duas' }, el('div', { class: 'ip-esq' }, filtros(), lista()), detalhe());

  // ------------------------------------------------------------ aba Curva
  function pontosEditaveis() {
    const c = E.cfg.curva; const cat = E.categoria;
    if (!c.categorias[cat]) c.categorias[cat] = structuredClone(c.padrao); // editar cria a curva própria (o "padrão" não é alterado)
    return c.categorias[cat];
  }
  const nivelMax = () => E.dados.nivelMaximo;
  function interpolar(pts, level) {
    const p = [...pts].sort((a, b) => a.level - b.level);
    if (!p.length) return 0;
    if (level <= p[0].level) return p[0].ip; if (level >= p.at(-1).level) return p.at(-1).ip;
    for (let i = 1; i < p.length; i++) if (level <= p[i].level) { const a = p[i - 1]; const b = p[i]; return b.level === a.level ? b.ip : a.ip + ((b.ip - a.ip) * (level - a.level)) / (b.level - a.level); }
    return p.at(-1).ip;
  }
  function grafico() {
    const pts = [...(E.cfg.curva.categorias[E.categoria] ?? E.cfg.curva.padrao)].sort((a, b) => a.level - b.level);
    const itens = E.curva?.itens ?? [];
    const W = 760; const H = 280; const m = { l: 44, r: 10, t: 10, b: 24 };
    const maxIp = Math.max(1, ...itens.map((i) => i.ip), ...pts.map((p) => p.ip)) * 1.05;
    const x = (l) => m.l + (l / nivelMax()) * (W - m.l - m.r); const y = (v) => H - m.b - (v / maxIp) * (H - m.t - m.b);
    const NS = 'http://www.w3.org/2000/svg';
    const no = (tag, atr, texto) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(atr)) n.setAttribute(k, v); if (texto) n.textContent = texto; return n; };
    const svg = no('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ip-grafico', role: 'img', 'aria-label': `Curva de Item Power esperado: ${E.dados.rotulosDoSlot[E.categoria]}` });
    for (let i = 0; i <= 4; i++) { const v = (maxIp / 4) * i; svg.append(no('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: 'currentColor', 'stroke-opacity': 0.12 }), no('text', { x: 4, y: y(v) + 4, 'font-size': 10, fill: 'currentColor', 'fill-opacity': 0.7 }, v.toFixed(0))); }
    for (let l = 0; l <= nivelMax(); l += 100) svg.append(no('text', { x: x(l), y: H - 6, 'font-size': 10, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.7 }, String(l)));
    for (const i of itens) svg.append(no('circle', { cx: x(i.level), cy: y(i.ip), r: 2.2, fill: { 'muito-acima': '#d9534f', acima: '#f0ad4e', adequado: '#5cb85c', abaixo: '#5bc0de' }[i.situacao] ?? '#999', 'fill-opacity': 0.55 }));
    svg.append(no('polyline', { points: pts.map((p) => `${x(p.level)},${y(p.ip)}`).join(' '), fill: 'none', stroke: 'var(--eng-destaque, #6aa7ff)', 'stroke-width': 2 }));
    for (const p of pts) svg.append(no('circle', { cx: x(p.level), cy: y(p.ip), r: 4, fill: 'var(--eng-destaque, #6aa7ff)' }));
    return svg;
  }
  async function carregarCurva() { E.curva = await api(`item-power/curva/${E.categoria}`); }
  function abaCurva() {
    const c = E.cfg.curva; const propria = !!c.categorias[E.categoria];
    const pts = c.categorias[E.categoria] ?? c.padrao;
    const salvosAbrupto = E.curva?.saltos ?? [];
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'linha' },
        campo('Categoria', el('select', { onchange: async (e) => { E.categoria = e.target.value; await carregarCurva(); pintarAba(); } }, E.dados.slots.map((s) => el('option', { value: s, selected: E.categoria === s }, E.dados.rotulosDoSlot[s])))),
        el('span', { class: 'dica' }, propria ? 'curva própria desta categoria' : 'usa a curva padrão (editar cria uma curva própria)'),
        propria ? el('button', { type: 'button', class: 'fantasma', disabled: dis(), onclick: () => { delete c.categorias[E.categoria]; mudou(); pintarAba(); } }, 'Voltar ao padrão') : null),
      el('div', { class: 'dica' }, 'A linha é o IP esperado por level (interpolação linear entre os pontos); os pontos coloridos são os equipamentos do catálogo (vermelho = muito acima, laranja = acima, verde = adequado, azul = abaixo). A curva é independente da fórmula.'),
      el('div', { id: 'ip-grafico-caixa' }, grafico()),
      salvosAbrupto.length ? el('ul', { class: 'problemas' }, salvosAbrupto.map((s) => el('li', { class: 'aviso' }, s.mensagem))) : el('div', { class: 'dica' }, 'Nenhum salto abrupto nem queda na curva salva.'),
      tabela(['Level', 'IP esperado', 'Inclinação até o próximo', ''], [...pts].sort((a, b) => a.level - b.level).map((p, i, arr) => el('tr', {},
        el('td', {}, el('input', { type: 'number', min: 1, max: nivelMax(), value: p.level, disabled: dis(), style: 'width:90px', onchange: (e) => { p.level = Number(e.target.value); mudou(); pintarAba(); } })),
        el('td', {}, el('input', { type: 'number', min: 0, step: 'any', value: p.ip, disabled: dis(), style: 'width:100px', onchange: (e) => { p.ip = Number(e.target.value); mudou(); pintarAba(); } })),
        el('td', { class: 'dica' }, arr[i + 1] ? `${(((arr[i + 1].ip - p.ip) / Math.max(1, arr[i + 1].level - p.level))).toFixed(3)} IP/level` : '—'),
        el('td', {}, el('button', { type: 'button', class: 'fantasma', disabled: dis() || arr.length <= 2, onclick: () => { const alvo = pontosEditaveis(); alvo.splice(alvo.indexOf(p), 1); mudou(); pintarAba(); } }, 'remover'))))),
      el('div', { class: 'linha' },
        el('button', { type: 'button', disabled: dis(), onclick: () => { const alvo = pontosEditaveis(); const ult = [...alvo].sort((a, b) => a.level - b.level).at(-1); const l = Math.min(nivelMax(), (ult?.level ?? 0) + 50); alvo.push({ level: alvo.some((p) => p.level === l) ? Math.max(1, l - 1) : l, ip: Math.round(interpolar(alvo, l) * 10) / 10 }); mudou(); pintarAba(); } }, '+ ponto'),
        el('span', { class: 'dica' }, 'Ao editar, o servidor revalida (levels únicos de 1 a o máximo, IP ≥ 0) e avisa dos saltos na prévia abaixo.')),
      previa());
  }

  // ------------------------------------------------------------ aba Fórmula
  function abaFormula() {
    const c = E.cfg;
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'dica' }, 'IP = Σ (atributo × fator de normalização × peso). Damage = média de mín. e máx. Só os atributos BASE do item entram: nada de atributos principais, vida, resistências, crítico, velocidade, afixos, gemas, conjuntos ou sinergias.'),
      campo('Versão da fórmula', entradaNum(c, 'versaoDaFormula', { w: 80, passo: 1 }), 'suba a versão ao mudar pesos ou normalização: ela fica registrada no histórico'),
      Object.entries(BLOCOS).map(([bloco, titulo]) => el('fieldset', { class: 'ip-bloco' }, el('legend', {}, titulo),
        el('div', { class: 'linha' }, Object.keys(c[bloco]).map((k) => campo(E.dados.rotulosDoAtributo[k] ?? k, entradaNum(c[bloco], k), DICAS[k]))))),
      el('div', { class: 'dica' }, 'As unidades do catálogo: Damage = Attack (valor único); Block = defesa do escudo (rating, não %); Armour, Evasion e Energy Shield = absolutos. Nenhum é percentual, por isso a normalização vale 1; o fator existe para converter unidades se isso mudar.'),
      previa());
  }

  // ------------------------------------------------------------ aba Comparar
  async function comparar() { E.compRes = E.comp.length >= 2 ? await api('item-power/comparar', { ids: E.comp }) : { ok: false, erros: ['Escolha ao menos dois equipamentos (use "+ comparar" na aba Itens ou o ID abaixo).'] }; pintarAba(); }
  function abaComparar() {
    const r = E.compRes;
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'linha' }, campo('Adicionar por ID', el('input', { type: 'number', id: 'ip-comp-id', style: 'width:110px' })), el('button', { type: 'button', onclick: () => { const v = Number(document.querySelector('#ip-comp-id').value); if (v && !E.comp.includes(v)) E.comp.push(v); comparar(); } }, 'Adicionar e comparar'),
        el('button', { type: 'button', class: 'fantasma', onclick: () => { E.comp = []; E.compRes = null; pintarAba(); } }, 'Limpar')),
      el('div', { class: 'dica' }, `Na comparação: ${E.comp.length ? E.comp.join(', ') : 'nenhum'}. O PRIMEIRO é a referência das diferenças.`),
      r?.ok === false ? el('ul', { class: 'problemas' }, (r.erros ?? []).map((m) => el('li', { class: 'erro' }, m))) : null,
      r?.ok ? el('div', {}, tabela(['Item', 'Level', 'Categoria', 'Raridade', 'IP', 'Damage', 'Block', 'Armour', 'Evasion', 'Energy Shield', 'Dif. (abs)', 'Dif. (%)', 'Mais pesa'], r.itens.map((i) => el('tr', {},
        el('td', {}, `${i.nome} #${i.id}`), el('td', {}, i.minLevel ?? '—'), el('td', {}, E.dados.rotulosDoSlot[i.slot]), el('td', {}, i.raridade ?? '—'), el('td', {}, el('b', {}, String(i.ip))),
        ...E.dados.atributos.map((a) => el('td', {}, `${i.contribuicao[a].valor} (${i.contribuicao[a].pontos} pts)`)), el('td', {}, String(i.contraReferencia.diferenca)), el('td', {}, pct(i.contraReferencia.diferencaPct)), el('td', {}, i.contraReferencia.maiorContribuinte ? E.dados.rotulosDoAtributo[i.contraReferencia.maiorContribuinte] : '—')))), el('div', { class: 'dica' }, r.aviso)) : null);
  }

  // ------------------------------------------------------------ aba Marcos
  function abaMarcos() {
    const m = E.marcos;
    if (!m) return el('div', { class: 'dica' }, 'Carregando…');
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'dica' }, `${m.aviso} O baú de marco entrega UM item da lista: o total do conjunto soma, por slot, a média dos itens possíveis; "melhor escolha" soma o melhor de cada slot.`),
      m.desequilibrios.length ? el('ul', { class: 'problemas' }, m.desequilibrios.map((d) => el('li', { class: 'aviso' }, d.mensagem))) : el('div', { class: 'dica' }, 'Nenhuma classe foge da média por mais que o limite de "acima do esperado".'),
      tabela(['Classe', 'Level', 'IP total (média por slot)', 'Melhor escolha', 'Desvio da média', 'Slots sem peça'], m.linhas.map((l) => el('tr', {}, el('td', {}, l.classe), el('td', {}, l.level), el('td', {}, el('b', {}, String(l.totalMedio))), el('td', {}, String(l.totalMaximo)), el('td', {}, pct(l.desvioDaMediaPct)), el('td', { class: 'dica' }, l.slotsSemPeca.map((s) => E.dados.rotulosDoSlot[s]).join(', ') || '—')))),
      m.linhas.map((l) => el('details', {}, el('summary', {}, `${l.classe} · level ${l.level} — ${l.pecas.length} peça(s)`),
        tabela(['Slot', 'Item', 'IP individual', 'Damage', 'Block', 'Armour', 'Evasion', 'Energy Shield'], l.pecas.map((p) => el('tr', {}, el('td', {}, p.slot ? E.dados.rotulosDoSlot[p.slot] : '—'), el('td', {}, `${p.nome} #${p.id}`), el('td', {}, String(p.ip)), ...E.dados.atributos.map((a) => el('td', {}, p.contribuicao ? String(p.contribuicao[a].pontos) : '—'))))))));
  }

  // ------------------------------------------------------------ aba Distribuição
  async function carregarAlertas() { E.alertas = await api(`item-power/alertas?dif=${E.dif}&limite=400`); }
  async function analisarHunt() { E.huntRes = E.hunt ? await api(`item-power/hunt/${encodeURIComponent(E.hunt)}?dif=${E.dif}`) : null; pintarAba(); }
  function regraEditavel(r, i) {
    const lista = (k) => el('input', { type: 'text', value: (r[k] ?? []).join(', '), disabled: dis(), style: 'width:180px', onchange: (e) => { const v = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); if (v.length) r[k] = v; else delete r[k]; mudou(); } });
    return el('fieldset', { class: 'ip-bloco' }, el('legend', {}, `Regra ${r.id}`),
      el('div', { class: 'linha' },
        campo('Nome', el('input', { type: 'text', value: r.nome ?? '', disabled: dis(), onchange: (e) => { r.nome = e.target.value || undefined; mudou(); } })),
        campo('Level mín.', entradaNum(r, 'levelMin', { w: 70, passo: 1 })), campo('Level máx.', entradaNum(r, 'levelMax', { w: 70, passo: 1 })),
        campo('IP mín.', entradaNum(r, 'ipMin', { w: 80 })), campo('IP máx.', entradaNum(r, 'ipMax', { w: 80 })), campo('Chance (0–1)', entradaNum(r, 'chance', { w: 80 }), 'chance de drop alvo, só informativa')),
      el('div', { class: 'linha' }, campo('Slots', lista('slots')), campo('Raridades', lista('raridades')), campo('Dificuldades (facil, medio, dificil)', lista('dificuldades')), campo('Hunts (ids)', lista('hunts')), campo('Chefes (chaves)', lista('chefes')), campo('Ato', entradaNum(r, 'ato', { w: 60, passo: 1 }))),
      el('div', { class: 'linha' }, el('button', { type: 'button', onclick: async () => { E.regraRes = { id: r.id, ...(await api('item-power/regra', { regra: r })) }; pintarAba(); } }, 'Avaliar regra'),
        el('button', { type: 'button', class: 'perigo', disabled: dis(), onclick: () => { E.cfg.regras.splice(i, 1); mudou(); pintarAba(); } }, 'Excluir regra')));
  }
  function abaDistribuicao() {
    const a = E.alertas;
    const tipos = a ? Object.entries(a.porTipo) : [];
    const lista = a ? a.alertas.filter((x) => !E.filtroAlerta || x.tipo === E.filtroAlerta) : [];
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'dica' }, 'Só leitura: nenhuma chance de drop muda sem a sua aprovação nos editores de loot. O level da hunt é o da campanha na dificuldade escolhida (ou o do cadastro); a chance usa o fator de drop da dificuldade.'),
      el('div', { class: 'linha' }, campo('Dificuldade', el('select', { onchange: async (e) => { E.dif = e.target.value; await carregarAlertas(); await analisarHunt(); } }, DIFICULDADES.map(([v, n]) => el('option', { value: v, selected: E.dif === v }, n)))),
        campo('Tipo de alerta', el('select', { onchange: (e) => { E.filtroAlerta = e.target.value; pintarAba(); } }, [el('option', { value: '' }, `todos (${a?.total ?? 0})`), ...tipos.map(([t, n]) => el('option', { value: t, selected: E.filtroAlerta === t }, `${t} (${n})`))]))),
      a ? el('ul', { class: 'problemas' }, lista.slice(0, 120).map((x) => el('li', { class: x.gravidade === 'aviso' ? 'aviso' : 'dica' }, x.mensagem))) : el('div', { class: 'dica' }, 'Carregando alertas…'),
      el('h4', {}, 'Análise de uma hunt'),
      el('div', { class: 'linha' }, campo('Hunt', el('select', { onchange: (e) => { E.hunt = e.target.value; analisarHunt(); } }, [el('option', { value: '' }, '—'), ...(E.hunts ?? []).map((h) => el('option', { value: h.id, selected: E.hunt === h.id }, `${h.nome} (nv ${h.level ?? '—'})`))]))),
      E.huntRes ? el('div', {}, el('div', { class: 'dica' }, `${E.huntRes.nome} · level ${E.huntRes.level ?? '—'} · ato ${E.huntRes.ato ?? '—'} · ${E.huntRes.monstros} monstro(s) · ${E.huntRes.itens.length} equipamento(s)`),
        tabela(['Item', 'Slot', 'Level mín.', 'IP', 'Esperado na hunt', 'Dif.', 'Situação', 'Chance', 'Monstros (categoria)'], E.huntRes.itens.slice(0, 80).map((i) => el('tr', {}, el('td', {}, i.nome), el('td', {}, E.dados.rotulosDoSlot[i.slot]), el('td', {}, i.minLevel ?? '—'), el('td', {}, String(i.ip)), el('td', {}, i.esperadoNaHunt ?? '—'), el('td', {}, pct(i.diferencaPct)), el('td', {}, chip(i.situacao)), el('td', {}, `${(i.chance * 100).toFixed(3)}%`), el('td', { class: 'dica' }, `${i.monstros.join(', ')} (${i.categoriasDoMonstro.join('/')})`))))) : null,
      el('h4', {}, 'Regras de distribuição (planejamento)'),
      el('div', { class: 'dica' }, 'Cada regra descreve uma faixa permitida (level, IP, raridade, slot) e as hunts/chefes que a seguem. "Avaliar" lista os equipamentos que cabem e os drops atuais que fogem — não muda nenhum drop.'),
      (E.cfg.regras ?? []).map((r, i) => regraEditavel(r, i)),
      el('button', { type: 'button', disabled: dis(), onclick: () => { let n = (E.cfg.regras.length || 0) + 1; let id; do { id = `regra-${String(n++).padStart(2, '0')}`; } while (E.cfg.regras.some((r) => r.id === id)); E.cfg.regras.push({ id, nome: 'Nova regra', levelMin: 1, levelMax: 100 }); mudou(); pintarAba(); } }, '+ Nova regra'),
      E.regraRes ? el('div', { class: 'hunt-sec' }, el('b', {}, `Regra ${E.regraRes.id}: ${E.regraRes.candidatos} equipamento(s) cabem; ${E.regraRes.foraDaRegra} drop(s) fogem.`),
        E.regraRes.fuga?.length ? tabela(['Origem', 'Monstro', 'Item', 'IP', 'Level mín.', 'Raridade', 'Chance'], E.regraRes.fuga.map((f) => el('tr', {}, el('td', {}, `${f.tipoDeOrigem}: ${f.origem}`), el('td', {}, f.monstro), el('td', {}, f.nome), el('td', {}, String(f.ip)), el('td', {}, f.minLevel ?? '—'), el('td', {}, f.raridade ?? '—'), el('td', {}, `${(f.chance * 100).toFixed(3)}%`)))) : null,
        E.regraRes.exemplos?.length ? el('details', {}, el('summary', {}, 'Equipamentos que cabem (amostra)'), el('ul', {}, E.regraRes.exemplos.map((x) => el('li', {}, `${x.nome} — ${E.dados.rotulosDoSlot[x.slot]}, level ${x.minLevel}, IP ${x.ip}`)))) : null) : null,
      previa());
  }

  // ------------------------------------------------------------ montagem
  const corpoDaAba = () => ({ itens: abaItens, curva: abaCurva, formula: abaFormula, comparar: abaComparar, marcos: abaMarcos, distribuicao: abaDistribuicao })[E.aba]();
  const pintarAba = () => document.querySelector('#ip-aba')?.replaceWith(corpo());
  const corpo = () => el('div', { id: 'ip-aba' }, corpoDaAba());
  async function abrirAba(id) {
    E.aba = id;
    if (id === 'itens' && !E.lista) await buscar2();
    if (id === 'curva' && !E.curva) await carregarCurva();
    if (id === 'marcos' && !E.marcos) E.marcos = await api('item-power/marcos');
    if (id === 'distribuicao') { if (!E.alertas) await carregarAlertas(); if (!E.hunts) E.hunts = (await api('item-power/hunts')).hunts; }
    pintar();
  }
  const buscar2 = async () => { E.lista = await api(`item-power/itens?${new URLSearchParams({ ...E.filtro, limite: 50 })}`); };

  function pintar() {
    const d = E.dados;
    raiz().replaceChildren(
      cabecalho('Item Power', 'Indicador de COMPARAÇÃO dos atributos base dos equipamentos (Damage, Block, Armour, Evasion, Energy Shield), com curva de referência por level e ferramentas de distribuição. Não é DPS nem força real; nada aqui muda item, drop ou combate.'),
      aviso(),
      !podeGravar() ? el('div', { class: 'bib-alerta' }, 'Somente leitura neste servidor (produção): dá para ver e calcular, mas não salvar.') : null,
      d.carga?.erros?.length ? el('div', { class: 'bib-alerta' }, `O override gravado foi IGNORADO no boot (inválido): ${d.carga.erros.join(' | ')}`) : null,
      el('div', { class: 'op-linha' }, el('span', { id: 'ip-contagem', class: 'dica' }, ''), el('span', { class: 'dica' }, `fórmula v${d.efetiva.versaoDaFormula}`),
        el('button', { id: 'ip-salvar', type: 'button', class: 'primario', disabled: true, onclick: salvar }, 'Salvar override'),
        el('button', { id: 'ip-descartar', type: 'button', disabled: true, onclick: descartar }, 'Descartar alterações'),
        el('button', { type: 'button', class: 'perigo', disabled: dis() || !Object.keys(d.override ?? {}).filter((k) => !['ativo', '_nota'].includes(k)).length, onclick: reverterTudo }, 'Voltar tudo ao original'),
        d.versoes.length ? el('label', { class: 'prog-rot' }, 'restaurar versão', el('select', { disabled: dis(), onchange: (e) => { if (e.target.value) restaurarVersao(Number(e.target.value)); e.target.value = ''; } }, [el('option', { value: '' }, '—'), ...d.versoes.map((v) => el('option', { value: v }, `v${v}`))])) : null),
      el('div', { class: 'eng-abas' }, ABAS.map(([id, n]) => el('button', { type: 'button', class: E.aba === id ? 'ativa' : '', onclick: () => abrirAba(id) }, n))),
      corpo());
    atualizarBarra();
  }
  return { desenhar, abrir: () => desenhar(), focarBusca: () => document.querySelector('.ip-filtros input')?.focus() };
}
