// A aba "Item Power" da Engine: o ITEM POWER BASE — um indicador de COMPARAÇÃO dos atributos base dos equipamentos (Damage, Block, Armour, Evasion, Energy Shield), uma curva de
// referência por level e as ferramentas de balanceamento de onde cada item cai. NÃO é DPS, força real do personagem nem garantia de equilíbrio em combate, e nada aqui altera
// item, drop ou combate. A fórmula, a curva e as regras são editadas por override (a fábrica nunca muda): editar → prévia (valida e mostra o impacto) → salvar → publicar.
// Toda regra mora no servidor (`systems/item-power.mjs`, `admin/overrides-item-power.mjs`, `admin/item-power-analise.mjs`); aqui só há tela.
import { el, cabecalho, confirmar, msg, tratarConflito } from './editor-ui.mjs';
import { retrato } from './editor-sprites.mjs';

const SITUACAO = { abaixo: 'Abaixo do esperado', adequado: 'Adequado', acima: 'Acima do esperado', 'muito-acima': 'Muito acima', 'sem-poder': 'Sem atributos base', 'sem-level': 'Sem level mínimo', 'sem-referencia': 'Sem referência' };
const COR = { abaixo: 'aviso', adequado: 'ok', acima: 'aviso', 'muito-acima': 'bloqueante', 'sem-poder': 'mudo', 'sem-level': 'mudo', 'sem-referencia': 'mudo' };
const ABAS = [['itens', 'Itens'], ['curva', 'Curva de referência'], ['formula', 'Fórmula e pesos'], ['comparar', 'Comparar'], ['lote', 'Edição em lote'], ['historico', 'Histórico de edições'], ['marcos', 'Presentes de marco'], ['distribuicao', 'Distribuição e alertas']];
const DIFICULDADES = [['facil', 'Normal'], ['medio', 'Cruel'], ['dificil', 'Merciless']];
const BLOCOS = { pesos: 'Pesos', normalizacao: 'Normalização (fator aplicado ao atributo antes do peso)', classificacao: 'Classificação (diferença % como fração: 0,25 = 25%)', alertas: 'Alertas' };
const DICAS = { blockDaArma: 'fração da defesa da ARMA que conta como Block (a ficha do jogo usa a metade)', danoDoCajado: 'peso do dano legado de cajados/rods (a ficha do jogo não o usa: 0)', abaixoDe: 'abaixo disto = "Abaixo do esperado"', acimaDe: 'acima disto = "Acima do esperado"', muitoAcimaDe: 'acima disto = "Muito acima"', saltoAbruptoFator: 'inclinação da curva > fator × mediana = salto', lacunaFator: 'razão de IP entre itens vizinhos que vira lacuna', huntsDemais: 'item em mais hunts que isto gera alerta', margemDeLevel: 'item com level mínimo acima do level da hunt + margem gera alerta', itemMuitoAbaixoPct: 'diferença (negativa) abaixo da qual o item é "muito abaixo" para a hunt' };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const num = (v) => (v === '' || v == null ? undefined : Number(v));
const pct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`);

export function criarTelaDeItemPower({ api, raiz, sujo = null, podeGravar = () => true }) {
  const E = { dados: null, cfg: null, base: '', aba: 'itens', previa: null, timer: null, pedido: 0, lista: null, filtro: { q: '', slot: '', classe: '', raridade: '', nivelMin: '', nivelMax: '', situacao: '', ordem: 'level', pagina: 0 }, sel: null, detalhe: null, sim: {}, simRes: null, categoria: 'weapon', curva: null, comp: [], compRes: null, marcos: null, dif: 'facil', alertas: null, filtroAlerta: '', hunts: null, hunt: null, huntRes: null, regraRes: null, edit: null, rapida: false, sujos: {}, lote: { filtros: { categoria: '', classe: '', tier: '', ato: '', nivelMin: '', nivelMax: '', raridade: '', q: '' }, ops: [{ campo: 'damage', op: 'multiplicar', valor: '' }], res: null, aprovarTodos: false }, hist: null, comparacaoDeVersoes: null, curvaProp: null, curvaFiltro: { categoria: '', classe: '', raridade: '', nivelMin: '', nivelMax: '', minimoDeItens: 3, descartarAtipicos: true, monotonica: true } };
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
  async function desenhar(resto = []) {
    await carregar(); E.lista = null;
    const id = /^\d+$/.test(String(resto?.[0] ?? '')) ? Number(resto[0]) : null;
    if (id != null) { E.aba = 'itens'; E.filtro.q = String(id); }
    pintar(); await abrirAba(E.aba);
    if (id != null) await escolher(id);
  }
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
  const campoRapido = (i, k, atual) => el('input', { type: 'number', min: 0, step: 1, value: E.sujos[i.id]?.[k] ?? atual ?? '', style: 'width:72px', class: E.sujos[i.id]?.[k] !== undefined ? 'ip-sujo' : '', disabled: dis(), onclick: (e) => e.stopPropagation(),
    onchange: (e) => { const v = e.target.value === '' ? undefined : Number(e.target.value); const ed = (E.sujos[i.id] ??= {}); if (v === undefined || v === atual) delete ed[k]; else ed[k] = v; if (!Object.keys(ed).length) delete E.sujos[i.id]; atualizarRapida(); } });
  function atualizarRapida() { const n = Object.keys(E.sujos).length; const b = document.querySelector('#ip-rapida-salvar'); if (b) { b.disabled = dis() || !n; b.textContent = `Salvar alterações (${n})`; } const c = document.querySelector('#ip-rapida-cancelar'); if (c) c.disabled = !n; sujo?.[n ? 'marcar' : 'limpar'](); }
  function lista() {
    const l = E.lista;
    if (!l) return el('div', { id: 'ip-lista', class: 'dica' }, 'Carregando…');
    const f = E.filtro; const ult = Math.max(0, Math.ceil(l.total / 50) - 1); const r = E.rapida;
    const marca = (i) => (i.modificado ? el('span', { class: 'selo', title: `original: nível ${i.original?.minLevel ?? '—'}, Damage ${i.original?.attack}, Block ${i.original?.defense}, armadura-base ${i.original?.armor}, IP ${i.original?.ip}` }, 'modificado') : null);
    const orig = (i, k, atual) => (i.modificado && i.original && (i.original[k] ?? 0) !== (atual ?? 0) ? el('div', { class: 'dica ip-orig' }, `orig. ${i.original[k] ?? '—'}`) : null);
    return el('div', { id: 'ip-lista' },
      el('div', { class: 'linha' }, el('span', { class: 'dica' }, `${l.total} equipamento(s) · página ${f.pagina + 1} de ${ult + 1} · ${l.modificados} modificado(s) no total`),
        el('button', { type: 'button', class: 'fantasma', disabled: f.pagina <= 0, onclick: () => { f.pagina--; buscar(); } }, '‹'), el('button', { type: 'button', class: 'fantasma', disabled: f.pagina >= ult, onclick: () => { f.pagina++; buscar(); } }, '›'),
        el('label', { class: 'conj-chk', title: 'Edita nível, Damage, Block e armadura-base direto na tabela (nada é gravado até salvar)' }, el('input', { type: 'checkbox', checked: r, disabled: dis(), onchange: (e) => { E.rapida = e.target.checked; document.querySelector('#ip-lista')?.replaceWith(lista()); } }), 'edição rápida'),
        el('label', { class: 'conj-chk' }, el('input', { type: 'checkbox', checked: f.modificado === '1', onchange: (e) => { f.modificado = e.target.checked ? '1' : ''; f.pagina = 0; buscar(); } }), 'só modificados')),
      r ? el('div', { class: 'linha' }, el('button', { id: 'ip-rapida-salvar', type: 'button', class: 'primario', disabled: true, onclick: salvarRapida }, 'Salvar alterações (0)'), el('button', { id: 'ip-rapida-cancelar', type: 'button', disabled: true, onclick: () => { E.sujos = {}; document.querySelector('#ip-lista')?.replaceWith(lista()); atualizarRapida(); } }, 'Cancelar'),
        el('span', { class: 'dica' }, 'Valores originais aparecem em cinza. Armadura-base define Armour/Evasion/Energy Shield pelo tipo da peça.')) : null,
      tabela(r ? ['', 'Item', 'Categoria', 'Nível', 'Damage', 'Block', 'Armadura-base', 'IP', 'Esperado', 'Dif.', 'Situação', ''] : ['', 'Item', 'Categoria', 'Level', 'Raridade', 'IP', 'Esperado', 'Dif.', 'Situação', ''],
        l.itens.map((i) => (r
          ? el('tr', { class: `conj-linha${E.sel === i.id ? ' ativa' : ''}`, onclick: () => escolher(i.id) },
            el('td', {}, retrato(i.desenho ?? null, 28, { categoria: 'itens' })), el('td', {}, `${i.nome} `, el('span', { class: 'dica' }, `#${i.id}`), ' ', marca(i)), el('td', {}, E.dados.rotulosDoSlot[i.slot]),
            el('td', {}, campoRapido(i, 'minLevel', i.minLevel), orig(i, 'minLevel', i.minLevel)), el('td', {}, campoRapido(i, 'damage', i.atributos.attack), orig(i, 'attack', i.atributos.attack)), el('td', {}, campoRapido(i, 'block', i.atributos.defense), orig(i, 'defense', i.atributos.defense)), el('td', {}, campoRapido(i, 'armor', i.atributos.armor), orig(i, 'armor', i.atributos.armor)),
            el('td', {}, String(i.ip)), el('td', {}, i.esperado ?? '—'), el('td', {}, pct(i.diferencaPct)), el('td', {}, chip(i.situacao)),
            el('td', {}, el('button', { type: 'button', class: 'fantasma', onclick: (e) => { e.stopPropagation(); abrirEdicao(i.id); } }, 'editor completo')))
          : el('tr', { class: `conj-linha${E.sel === i.id ? ' ativa' : ''}`, onclick: () => escolher(i.id) },
            el('td', {}, retrato(i.desenho ?? null, 28, { categoria: 'itens' })), el('td', {}, `${i.nome} `, el('span', { class: 'dica' }, `#${i.id}`), ' ', marca(i)), el('td', {}, E.dados.rotulosDoSlot[i.slot]), el('td', {}, i.minLevel ?? '—'), el('td', {}, i.raridade ?? '—'),
            el('td', {}, String(i.ip)), el('td', {}, i.esperado ?? '—'), el('td', {}, pct(i.diferencaPct)), el('td', {}, chip(i.situacao)),
            el('td', {}, el('button', { type: 'button', class: 'fantasma', title: 'Adicionar à comparação', onclick: (e) => { e.stopPropagation(); adicionarNaComparacao({ id: i.id, versao: 'atual' }); msg(`${i.nome} na comparação (${E.comp.length}).`, 'ok'); } }, '+ comparar')))))));
  }
  async function salvarRapida() { await confirmarESalvar({ ...E.sujos }, 'tabela', 'Edição rápida na tabela', () => { E.sujos = {}; }); }
  async function escolher(id) {
    E.sel = id; E.sim = {}; E.simRes = null; if (E.edit && E.edit.id !== id) E.edit = null;
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
    if (E.edit && E.edit.id === d.id && E.edit.dados) return editorCompleto();
    const s = E.simRes?.ok ? E.simRes : null;
    const contrib = (s ?? d).contribuicao;
    return el('div', { id: 'ip-detalhe', class: 'hunt-sec' },
      el('div', { class: 'linha' }, el('h4', {}, `${d.nome} `, chip(s ? s.situacao : d.situacao)), el('button', { type: 'button', class: 'primario', disabled: dis(), onclick: () => abrirEdicao(d.id) }, 'Editar equipamento')),
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
      blocoRecalcularCurva(),
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
  const adicionarNaComparacao = (e) => { if (!E.comp.some((x) => x.id === e.id && x.versao === e.versao)) E.comp.push(e); };
  async function comparar() {
    E.compRes = E.comp.length >= 2 ? await api('item-power/comparar', { entradas: E.comp }) : { ok: false, erros: ['Escolha ao menos dois equipamentos (use "+ comparar" na aba Itens, o ID abaixo ou os atalhos).'] };
    pintarAba();
  }
  const ROTULO_VERSAO = { atual: 'atual', original: 'original', editada: 'editada (não salva)' };
  async function atalhoDeComparacao(tipo) {
    const base = E.detalhe ?? (E.comp[0] ? await api(`item-power/item/${E.comp[0].id}`) : null);
    if (!base) return msg('Escolha um equipamento na aba Itens primeiro.', 'aviso');
    const id = base.id;
    if (tipo === 'original-editada') { adicionarNaComparacao({ id, versao: 'original' }); adicionarNaComparacao(E.edit?.id === id ? { id, versao: 'editada', edicao: edicaoDoFormulario() } : { id, versao: 'atual' }); }
    else if (tipo === 'equivalentes') { const p = await api(`item-power/itens?${new URLSearchParams({ slot: base.slot, classe: base.vocations[0] ?? '', nivelMin: Math.max(0, (base.minLevel ?? 0) - 25), nivelMax: (base.minLevel ?? 0) + 25, ordem: 'ip', limite: 4 })}`); adicionarNaComparacao({ id, versao: 'atual' }); for (const i of p.itens.filter((x) => x.id !== id).slice(0, 3)) adicionarNaComparacao({ id: i.id, versao: 'atual' }); }
    else { const t = base.tier ?? 1; const alvo = tipo === 'tier-anterior' ? t - 1 : t + 1; const p = await api(`item-power/itens?${new URLSearchParams({ slot: base.slot, classe: base.vocations[0] ?? '', nivelMin: Math.max(1, (alvo - 1) * 100 - 50), nivelMax: alvo * 100 + 49, ordem: 'ip', limite: 3 })}`); adicionarNaComparacao({ id, versao: 'atual' }); for (const i of p.itens.filter((x) => x.id !== id && x.minLevel != null).slice(0, 2)) adicionarNaComparacao({ id: i.id, versao: 'atual' }); }
    await comparar();
  }
  function abaComparar() {
    const r = E.compRes;
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'linha' }, campo('Adicionar por ID', el('input', { type: 'number', id: 'ip-comp-id', style: 'width:110px' })), el('button', { type: 'button', onclick: () => { const v = Number(document.querySelector('#ip-comp-id').value); if (v) adicionarNaComparacao({ id: v, versao: 'atual' }); comparar(); } }, 'Adicionar e comparar'),
        el('button', { type: 'button', class: 'fantasma', onclick: () => { E.comp = []; E.compRes = null; pintarAba(); } }, 'Limpar')),
      el('div', { class: 'linha' }, el('span', { class: 'dica' }, 'Atalhos (usam o equipamento escolhido na aba Itens):'),
        el('button', { type: 'button', onclick: () => atalhoDeComparacao('original-editada') }, 'Original × atual/editado'), el('button', { type: 'button', onclick: () => atalhoDeComparacao('equivalentes') }, 'Mesma classe e nível próximo'),
        el('button', { type: 'button', onclick: () => atalhoDeComparacao('tier-anterior') }, 'Tier anterior'), el('button', { type: 'button', onclick: () => atalhoDeComparacao('tier-seguinte') }, 'Tier seguinte')),
      el('div', { class: 'dica' }, `Na comparação: ${E.comp.length ? E.comp.map((x) => `#${x.id} (${ROTULO_VERSAO[x.versao]})`).join(', ') : 'nenhum'}. O PRIMEIRO é a referência das diferenças. Classes diferentes podem ser comparadas, mas têm funções diferentes.`),
      r?.ok === false ? el('ul', { class: 'problemas' }, (r.erros ?? []).map((m) => el('li', { class: 'erro' }, m))) : null,
      r?.ok ? el('div', {}, tabela(['Item', 'Nível', 'Classe', 'Categoria', 'Tier', 'Raridade', 'Damage', 'Block', 'Armour', 'Evasion', 'Energy Shield', 'Item Power', 'Esperado', 'Situação (curva)', 'Dif. (abs)', 'Dif. (%)', 'Mais pesa'], r.itens.map((i) => el('tr', {},
        el('td', {}, i.rotulo ?? `${i.nome} #${i.id}`), el('td', {}, i.minLevel ?? '—'), el('td', {}, i.vocations.length ? i.vocations.join('/') : 'todas'), el('td', {}, E.dados.rotulosDoSlot[i.slot]), el('td', {}, i.tier != null ? `T${i.tier}` : '—'), el('td', {}, i.raridade ?? '—'),
        ...E.dados.atributos.map((a) => el('td', {}, `${i.contribuicao[a].valor} (${i.contribuicao[a].pontos} pts)`)), el('td', {}, el('b', {}, String(i.ip))), el('td', {}, i.esperado ?? '—'), el('td', {}, chip(i.situacao)),
        el('td', {}, String(i.contraReferencia.diferenca)), el('td', {}, pct(i.contraReferencia.diferencaPct)), el('td', {}, i.contraReferencia.maiorContribuinte ? E.dados.rotulosDoAtributo[i.contraReferencia.maiorContribuinte] : '—')))), el('div', { class: 'dica' }, r.aviso)) : null);
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

  // ------------------------------------------------------------ editar equipamento (nível e atributos-base, por override de itens)
  const atributoLinhas = [['damage', 'Damage', 'attack', 'Damage = Attack do item (valor único: mínimo = máximo)'], ['block', 'Block', 'defense', 'Block = defesa do escudo (rating); a defesa da arma conta metade'], ['armour', 'Armour', 'armour', 'Derivado da armadura-base pelo tipo da peça'], ['evasion', 'Evasion', 'evasion', 'Derivado da armadura-base pelo tipo da peça e pelo nível'], ['energyShield', 'Energy Shield', 'energyShield', 'Derivado da armadura-base pelo tipo da peça e pelo nível']];
  async function abrirEdicao(id) {
    await escolher(id);
    const dados = await api(`item-power/edicao/${id}`);
    const a = dados.atual; const mo = dados.metaOriginal; const ov = dados.override ?? {};
    E.edit = { id: dados.id, dados, previa: dados, aprov: new Set(), form: { name: ov.name ?? mo.name, minLevel: a.minLevel ?? '', rarity: ov.rarity ?? mo.rarity ?? '', damage: a.atributos.attack, block: a.atributos.defense, armor: a.atributos.armor, alvo: null }, erros: [] };
    document.querySelector('#ip-detalhe')?.replaceWith(detalhe());
  }
  function edicaoDoFormulario() {
    const f = E.edit.form; const ed = {};
    if (f.name !== '') ed.name = f.name;
    if (f.minLevel !== '' && f.minLevel != null) ed.minLevel = Number(f.minLevel);
    if (f.rarity) ed.rarity = f.rarity;
    if (f.damage !== '') ed.damage = Number(f.damage);
    if (f.block !== '') ed.block = Number(f.block);
    if (f.alvo) ed[f.alvo.tipo] = Number(f.alvo.valor); else if (f.armor !== '') ed.armor = Number(f.armor);
    return ed;
  }
  async function previaDaEdicao() {
    const e = E.edit; if (!e) return;
    const meu = (e.pedido = (e.pedido ?? 0) + 1);
    const r = await api('item-power/edicao-previa', { edicoes: { [e.id]: edicaoDoFormulario() } });
    if (!E.edit || meu !== E.edit.pedido) return;
    E.edit.previa = r.itens?.[0] ? { ...r.itens[0], revisao: r.revisao } : { erros: r.erros ?? [], alertas: [], mudancas: [], avisos: [] };
    E.edit.previa.revisao = r.revisao;
    sujo?.[E.edit.previa.mudancas?.length ? 'marcar' : 'limpar']();
    document.querySelector('#ip-detalhe')?.replaceWith(detalhe());
  }
  const agendarPrevia = () => { clearTimeout(E.edit.timer); E.edit.timer = setTimeout(previaDaEdicao, 300); };
  function editorCompleto() {
    const e = E.edit; const d = e.dados; const p = e.previa; const f = e.form; const mo = d.metaOriginal;
    const orig = d.original?.atributos ?? {}; const cand = p.candidato ?? d.candidato; const atual = d.atual;
    const tipos = d.tiposDeDefesa ?? [];
    const restaurarCampo = (fn) => () => { fn(); agendarPrevia(); document.querySelector('#ip-detalhe')?.replaceWith(detalhe()); };
    const entrada = (tipo, valor, onchange, extra = {}) => el('input', { type: tipo, value: valor ?? '', disabled: dis(), onchange: (ev) => { onchange(ev.target.value); agendarPrevia(); }, ...extra });
    const fonte = (k) => ({ damage: [orig.attack, atual.atributos.attack, cand?.atributos.attack], block: [orig.defense, atual.atributos.defense, cand?.atributos.defense], armour: [orig.armour, atual.atributos.armour, cand?.atributos.armour], evasion: [orig.evasion, atual.atributos.evasion, cand?.atributos.evasion], energyShield: [orig.energyShield, atual.atributos.energyShield, cand?.atributos.energyShield] })[k];
    const linhaDeAtributo = ([k, nome, , dica]) => {
      const [o, a, c] = fonte(k); const defesa = ['armour', 'evasion', 'energyShield'].includes(k); const editavel = !defesa || tipos.includes(k);
      const valorDoCampo = k === 'damage' ? f.damage : k === 'block' ? f.block : (f.alvo?.tipo === k ? f.alvo.valor : c);
      const restaurar = k === 'damage' ? () => { f.damage = orig.attack; } : k === 'block' ? () => { f.block = orig.defense; } : () => { f.armor = orig.armor; f.alvo = null; };
      return el('tr', { title: dica }, el('td', {}, nome), el('td', {}, String(o ?? 0)), el('td', {}, String(a ?? 0)),
        el('td', {}, editavel ? entrada('number', valorDoCampo, (v) => { if (k === 'damage') f.damage = v; else if (k === 'block') f.block = v; else { f.alvo = { tipo: k, valor: v }; f.armor = ''; } }, { min: 0, step: 1, style: 'width:90px' }) : el('span', { class: 'dica', title: 'A base desta peça não tem este tipo de defesa' }, '—')),
        el('td', {}, String(c ?? 0)), el('td', {}, `${(c ?? 0) - (o ?? 0) > 0 ? '+' : ''}${(c ?? 0) - (o ?? 0)}`), el('td', {}, editavel ? el('button', { type: 'button', class: 'fantasma', disabled: dis(), onclick: restaurarCampo(restaurar) }, 'restaurar') : null));
    };
    const alertas = p.alertas ?? [];
    return el('div', { id: 'ip-detalhe', class: 'hunt-sec ip-editor' },
      el('div', { class: 'linha' }, el('h4', {}, `Editando: ${d.nome} `, chip(cand?.situacao ?? d.candidato.situacao)), el('span', { class: 'selo' }, 'edição — nada foi gravado')),
      el('div', { class: 'dica' }, 'Aqui só entram os ATRIBUTOS-BASE do item (e o nível). Não são editados: modificadores aleatórios, atributos adicionais, bônus de conjunto, atributos do personagem nem derivados de combate. As alterações vão para o override de itens (o catálogo importado não muda).'),
      el('fieldset', { class: 'ip-bloco' }, el('legend', {}, 'Identificação e progressão'),
        el('div', { class: 'linha' },
          campo('Nome', entrada('text', f.name, (v) => { f.name = v; }, { style: 'width:220px' })),
          campo('Nível exigido', entrada('number', f.minLevel, (v) => { f.minLevel = v; }, { min: 0, step: 1, style: 'width:90px' })),
          campo('Raridade', el('select', { disabled: dis(), onchange: (ev) => { f.rarity = ev.target.value; agendarPrevia(); } }, ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico'].map((r) => el('option', { value: r, selected: f.rarity === r }, r)))),
          campo('Tier (derivado do nível)', el('input', { type: 'text', disabled: true, value: cand?.tier != null ? `T${cand.tier}` : '—', style: 'width:60px', title: d.somenteLeituraMotivos.tier }))),
        el('div', { class: 'linha' },
          campo('Categoria', el('input', { type: 'text', disabled: true, value: E.dados.rotulosDoSlot[d.slot], style: 'width:110px', title: d.somenteLeituraMotivos.slot })),
          campo('Tipo', el('input', { type: 'text', disabled: true, value: mo.type ?? '—', style: 'width:140px', title: d.somenteLeituraMotivos.type })),
          campo('Classe compatível', el('input', { type: 'text', disabled: true, value: (mo.vocations ?? []).join('/') || 'todas', style: 'width:200px', title: d.somenteLeituraMotivos.vocations })),
          el('button', { type: 'button', class: 'fantasma', disabled: dis(), onclick: restaurarCampo(() => { f.name = mo.name; f.minLevel = mo.minLevel ?? ''; f.rarity = mo.rarity ?? ''; }) }, 'restaurar identificação')),
        el('div', { class: 'dica' }, 'Categoria, tipo e classe são somente leitura: a camada de overrides não os suporta e mudá-los altera quem pode equipar e a base de defesa (passe o mouse para o motivo).')),
      el('fieldset', { class: 'ip-bloco' }, el('legend', {}, 'Atributos-base'),
        tabela(['Atributo', 'Original', 'Atual (salvo)', 'Editar', 'Resultado (prévia)', 'Dif. (resultado − original)', ''], atributoLinhas.map(linhaDeAtributo)),
        el('div', { class: 'linha' }, campo('Armadura-base (armor)', entrada('number', f.alvo ? '' : f.armor, (v) => { f.armor = v; f.alvo = null; }, { min: 0, step: 1, style: 'width:90px' })), el('span', { class: 'dica' }, `original ${orig.armor ?? 0}. Armour/Evasion/Energy Shield são DERIVADOS dela pelo tipo da peça (${tipos.length ? tipos.join(' + ') : 'sem armadura-base'}) e pelo nível: editar um deles resolve a armadura-base que o produz.`),
          el('button', { type: 'button', class: 'fantasma', disabled: dis(), onclick: restaurarCampo(() => { f.armor = orig.armor; f.alvo = null; }) }, 'restaurar'))),
      el('fieldset', { class: 'ip-bloco' }, el('legend', {}, 'Impacto no Item Power'),
        cand ? el('div', {}, el('div', {}, el('b', {}, `Item Power ${cand.ip}`), ` (atual ${atual.ip}, original ${d.original?.ip}) · esperado ${cand.esperado ?? '—'} · diferença ${cand.diferenca ?? '—'} (${pct(cand.diferencaPct)}) · `, chip(cand.situacao)),
          el('div', { class: 'dica' }, `Nível ${cand.minLevel ?? '—'} · tier ${cand.tier != null ? `T${cand.tier}` : '—'}`),
          p.equivalentes?.length ? el('details', { open: true }, el('summary', {}, `Comparação com ${p.equivalentes.length} equivalente(s) (mesmo slot, classe compatível, nível ±25)`), tabela(['Equivalente', 'Nível', 'Item Power', 'Este item vs. ele'], p.equivalentes.map((q) => el('tr', {}, el('td', {}, `${q.nome} #${q.id}`), el('td', {}, q.minLevel), el('td', {}, String(q.ip)), el('td', {}, pct(q.ip ? (cand.ip - q.ip) / q.ip : null)))))) : el('div', { class: 'dica' }, 'Sem equivalentes suficientes para comparar.')) : el('div', { class: 'dica' }, 'Calculando…'),
        el('div', { class: 'dica' }, 'A curva de referência NÃO muda com esta edição (só se você a recalcular na aba Curva).')),
      (p.erros ?? []).length ? el('ul', { class: 'problemas' }, p.erros.map((m) => el('li', { class: 'erro' }, m))) : null,
      (p.avisos ?? []).length ? el('ul', { class: 'problemas' }, p.avisos.map((m) => el('li', { class: 'dica' }, m))) : null,
      alertas.length ? el('div', {}, el('b', {}, 'Alertas — precisam da sua aprovação para salvar:'), el('ul', { class: 'problemas' }, alertas.map((a) => el('li', { class: 'aviso' }, el('label', {}, el('input', { type: 'checkbox', checked: e.aprov.has(a.codigo), disabled: dis(), onchange: (ev) => { if (ev.target.checked) e.aprov.add(a.codigo); else e.aprov.delete(a.codigo); } }), ` Aprovar: ${a.mensagem}`))))) : null,
      el('div', { class: 'linha' },
        el('button', { type: 'button', class: 'primario', disabled: dis() || !p.mudancas?.length || (p.erros ?? []).length > 0, onclick: () => salvarEdicao(false) }, 'Salvar alterações'),
        el('button', { type: 'button', disabled: dis() || !p.mudancas?.length || (p.erros ?? []).length > 0, onclick: () => salvarEdicao(true), title: 'Salva e confirma a recarga (Hot Reload) agora, informando o resultado' }, 'Aplicar alterações'),
        el('button', { type: 'button', onclick: () => { E.edit = null; sujo?.limpar(); document.querySelector('#ip-detalhe')?.replaceWith(detalhe()); } }, 'Cancelar'),
        el('button', { type: 'button', class: 'perigo', disabled: dis() || !d.override || !Object.keys(d.override).some((k) => ['name', 'minLevel', 'rarity', 'attack', 'defense', 'armor'].includes(k)), onclick: restaurarOriginais }, 'Restaurar valores originais'),
        el('button', { type: 'button', class: 'fantasma', onclick: async () => { adicionarNaComparacao({ id: e.id, versao: 'original' }); adicionarNaComparacao({ id: e.id, versao: 'editada', edicao: edicaoDoFormulario() }); msg('Original × editada na comparação (aba Comparar).', 'ok'); } }, 'comparar original × editada')),
      el('div', { class: 'dica' }, 'Salvar grava o override; o Hot Reload local atualiza o catálogo em memória (Item Power, ficha e próximos drops). Peças já geradas mantêm a faixa que sortearam.'));
  }
  async function salvarEdicao(aplicar) {
    const e = E.edit; const p = e.previa;
    const pendentes = (p.alertas ?? []).filter((a) => !e.aprov.has(a.codigo));
    if (pendentes.length) return msg(`Aprove (marque) os ${pendentes.length} alerta(s) abaixo para salvar um caso justificado.`, 'aviso');
    await confirmarESalvar({ [e.id]: edicaoDoFormulario() }, 'individual', null, () => { E.edit = null; sujo?.limpar(); }, { aprovados: [...e.aprov], aplicar, confirmacao: false });
  }
  async function restaurarOriginais() {
    const e = E.edit;
    if (!(await confirmar('Restaurar os valores originais deste equipamento?', 'Remove só o override de nome, nível, raridade, Damage, Block e armadura-base deste item (preço, peso e outros itens não mudam).', { ok: 'Restaurar', perigo: true }))) return;
    const r = await api('item-power/edicao', { acao: 'restaurar', ids: [e.id], rotulo: 'restauração individual', aplicar: true, revisao: e.previa.revisao ?? e.dados.revisao });
    if (await tratarConflito(r, () => abrirEdicao(e.id))) return;
    if (r.ok === false) return msg((r.erros ?? ['Não restaurou.']).join(' '), 'erro');
    msg('Valores originais restaurados.', 'ok');
    E.edit = null; sujo?.limpar(); await recarregarListaEDetalhe(e.id);
  }
  async function recarregarListaEDetalhe(id) {
    await new Promise((r) => setTimeout(r, 400));
    await buscar();
    if (id != null) { E.detalhe = await api(`item-power/item/${id}?dif=${E.dif}`).catch(() => null); document.querySelector('#ip-detalhe')?.replaceWith(detalhe()); }
    E.curva = null; E.marcos = null; E.alertas = null;
  }
  /** Prévia → (alertas: confirmação com aprovação) → salva numa gravação só → recarrega. `opcoes.aprovados`: códigos já aprovados (editor completo). */
  async function confirmarESalvar(edicoes, origem, rotulo, aposSucesso, opcoes = {}) {
    if (!Object.keys(edicoes).length) return false;
    const p = await api('item-power/edicao-previa', { edicoes, origem });
    if (!p.ok) { msg((p.erros ?? ['Edição inválida.']).slice(0, 5).join(' '), 'erro'); return false; }
    let aprovarTodos = false;
    if (opcoes.aprovados === undefined || opcoes.confirmacao !== false) {
      const linhas = p.alertas.slice(0, 8).map((a) => `• ${a.mensagem}`).join('\n');
      const ok = await confirmar(p.alertas.length ? `Salvar ${p.resumo.comMudanca} item(ns) COM ${p.alertas.length} alerta(s)?` : `Salvar ${p.resumo.comMudanca} item(ns)?`, `${p.alertas.length ? `Os alertas não bloqueiam, mas precisam da sua aprovação:\n${linhas}${p.alertas.length > 8 ? `\n…e mais ${p.alertas.length - 8}` : ''}\n\n` : ''}Grava em overrides/itens.json numa única operação (tudo ou nada); a fábrica não muda e dá para restaurar. Item Power é um indicador dos atributos base, não simulação de combate.`, { ok: p.alertas.length ? 'Aprovar alertas e salvar' : 'Salvar' });
      if (!ok) return false;
      aprovarTodos = p.alertas.length > 0 && opcoes.aprovados === undefined;
    }
    const r = await api('item-power/edicao', { acao: 'salvar', edicoes, origem, rotulo, aprovados: opcoes.aprovados, aprovarTodos, aplicar: opcoes.aplicar === true, revisao: p.revisao });
    if (await tratarConflito(r, () => buscar())) return false;
    if (r.ok === false) { msg((r.erros ?? ['Não salvou.']).join(' '), 'erro'); return false; }
    if (r.semMudancas) { msg('Nada mudou.', 'aviso'); return false; }
    const hot = r.hotReload && typeof r.hotReload === 'object' ? r.hotReload : null;
    msg(`${r.alterados.length} item(ns) salvo(s). ${hot ? (hot.aplicado ? `Hot Reload aplicou: ${hot.resumo ?? 'catálogo atualizado'}.` : `Hot Reload NÃO aplicou (${hot.motivo}): reinicie o ambiente local para o jogo ver a mudança.`) : 'O Hot Reload local aplica em instantes (se estiver ligado; senão, reinicie o ambiente local).'}`, hot && !hot.aplicado ? 'aviso' : 'ok');
    aposSucesso?.();
    atualizarRapida();
    await recarregarListaEDetalhe(E.sel);
    return true;
  }

  // ------------------------------------------------------------ aba Edição em lote
  const OPS_LOTE = [['definir', 'definir para'], ['somar', 'somar'], ['multiplicar', 'multiplicar por']];
  const CAMPOS_LOTE = [['nivel', 'Nível'], ['damage', 'Damage'], ['block', 'Block'], ['armour', 'Armour'], ['evasion', 'Evasion'], ['energyShield', 'Energy Shield']];
  const pedidoDoLote = () => ({ filtros: Object.fromEntries(Object.entries(E.lote.filtros).filter(([, v]) => v !== '')), operacoes: E.lote.ops.filter((o) => o.valor !== '').map((o) => ({ ...o, valor: Number(o.valor) })) });
  async function previaDoLote() { E.lote.res = await api('item-power/lote-previa', pedidoDoLote()); E.lote.aprovarTodos = false; pintarAba(); }
  async function aplicarLote() {
    const r = E.lote.res;
    if (!r?.ok) return;
    const pend = r.alertas.length && !E.lote.aprovarTodos;
    if (pend) return msg(`Há ${r.alertas.length} alerta(s): marque "Aprovar os alertas" para aplicar este lote.`, 'aviso');
    if (!(await confirmar(`Aplicar o lote a ${r.afetados} item(ns)?`, `${r.totalIgnorados} item(ns) ignorado(s). Grava numa única operação (tudo ou nada) em overrides/itens.json; dá para restaurar depois. Nada acontece fora dos itens listados na prévia.`, { ok: `Aplicar a ${r.afetados} itens` }))) return;
    const rr = await api('item-power/edicao', { acao: 'salvar', aplicar: true, edicoes: r.edicoes, origem: 'lote', rotulo: JSON.stringify(pedidoDoLote()).slice(0, 300), aprovarTodos: E.lote.aprovarTodos, revisao: r.revisao });
    if (await tratarConflito(rr, () => previaDoLote())) return;
    if (rr.ok === false) return msg((rr.erros ?? ['Não aplicou.']).join(' '), 'erro');
    msg(`Lote aplicado a ${rr.alterados?.length ?? 0} item(ns). ${rr.hotReload?.aplicado ? 'Catálogo recarregado agora.' : `Hot Reload não aplicou (${rr.hotReload?.motivo ?? 'desligado'}): reinicie o ambiente local.`}`, rr.hotReload?.aplicado ? 'ok' : 'aviso');
    E.lote.res = null; E.hist = null; await recarregarListaEDetalhe(null); pintarAba();
  }
  async function restaurarFiltrados() {
    const filtros = Object.fromEntries(Object.entries(E.lote.filtros).filter(([, v]) => v !== ''));
    const sel = await api(`item-power/selecionar?${new URLSearchParams(filtros)}`);
    if (!(await confirmar(`Restaurar ao original os itens do filtro (${sel.total} no filtro)?`, 'Só os itens que têm alteração de nome, nível, raridade, Damage, Block ou armadura-base são afetados; preço, peso e os demais não mudam.', { ok: 'Restaurar', perigo: true }))) return;
    const r = await api('item-power/edicao', { acao: 'restaurar', filtros, rotulo: 'restauração em lote', aplicar: true, revisao: revisaoDosItens() });
    if (await tratarConflito(r, () => buscar())) return;
    if (r.ok === false) return msg((r.erros ?? ['Nada para restaurar.']).join(' '), 'aviso');
    msg(`${r.restaurados.length} item(ns) restaurado(s). ${r.hotReload ? (r.hotReload.aplicado ? 'Catálogo recarregado.' : `${r.hotReload.motivo}: reinicie o ambiente local.`) : ''}`, 'ok');
    E.hist = null; await recarregarListaEDetalhe(null); pintarAba();
  }
  const revisaoDosItens = () => E.lista?.revisaoItens;
  function abaLote() {
    const L = E.lote; const f = L.filtros; const r = L.res;
    const sel = (k, opcoes, todos) => el('select', { onchange: (e) => { f[k] = e.target.value; L.res = null; }, disabled: dis() }, [el('option', { value: '' }, todos), ...opcoes.map(([v, n]) => el('option', { value: v, selected: f[k] === v }, n))]);
    const num = (k, ph) => el('input', { type: 'number', placeholder: ph, value: f[k], style: 'width:90px', onchange: (e) => { f[k] = e.target.value; L.res = null; } });
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'dica' }, 'Altera VÁRIOS equipamentos de uma vez (nível e atributos-base) pela camada de overrides, numa gravação só: ou tudo, ou nada. Sempre há prévia, alertas de excesso e confirmação; nada é silencioso.'),
      el('fieldset', { class: 'ip-bloco' }, el('legend', {}, '1. Quais itens'),
        el('div', { class: 'linha' }, sel('classe', ['knight', 'paladin', 'druid', 'sorcerer', 'monk'].map((c) => [c, c]), 'todas as classes'), sel('categoria', E.dados.slots.map((s) => [s, E.dados.rotulosDoSlot[s]]), 'todas as categorias'),
          sel('tier', Array.from({ length: 11 }, (_, i) => [String(i + 1), `T${i + 1}`]), 'todos os tiers'), sel('ato', E.dados.atos.map((a) => [String(a.ato), `Ato ${a.ato}`]), 'todos os Atos'), sel('raridade', ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico'].map((c) => [c, c]), 'todas as raridades'),
          num('nivelMin', 'nível de'), num('nivelMax', 'nível até'), el('input', { type: 'search', placeholder: 'nome ou ID…', value: f.q, onchange: (e) => { f.q = e.target.value; L.res = null; } }))),
      el('fieldset', { class: 'ip-bloco' }, el('legend', {}, '2. O que fazer'),
        L.ops.map((o, i) => el('div', { class: 'linha' },
          el('select', { disabled: dis(), onchange: (e) => { o.campo = e.target.value; L.res = null; } }, CAMPOS_LOTE.map(([v, n]) => el('option', { value: v, selected: o.campo === v }, n))),
          el('select', { disabled: dis(), onchange: (e) => { o.op = e.target.value; L.res = null; } }, OPS_LOTE.filter(([v]) => !(o.campo === 'nivel' && v === 'multiplicar')).map(([v, n]) => el('option', { value: v, selected: o.op === v }, n))),
          el('input', { type: 'number', step: 'any', value: o.valor, placeholder: o.op === 'multiplicar' ? 'fator (ex.: 1.1)' : 'valor', style: 'width:110px', disabled: dis(), onchange: (e) => { o.valor = e.target.value; L.res = null; } }),
          el('button', { type: 'button', class: 'fantasma', disabled: dis() || L.ops.length <= 1, onclick: () => { L.ops.splice(i, 1); L.res = null; pintarAba(); } }, 'remover'))),
        el('button', { type: 'button', class: 'fantasma', disabled: dis(), onclick: () => { L.ops.push({ campo: 'damage', op: 'multiplicar', valor: '' }); pintarAba(); } }, '+ operação'),
        el('div', { class: 'dica' }, 'Armour/Evasion/Energy Shield só atingem itens que têm esse tipo de defesa (a armadura-base é única; os outros tipos acompanham). Item sem o atributo é ignorado e listado.')),
      el('div', { class: 'linha' }, el('button', { type: 'button', class: 'primario', disabled: dis(), onclick: previaDoLote }, '3. Pré-visualizar'), el('button', { type: 'button', class: 'perigo', disabled: dis(), onclick: restaurarFiltrados }, 'Restaurar originais (todos os modificados)')),
      r?.ok === false ? el('ul', { class: 'problemas' }, (r.erros ?? []).map((m) => el('li', { class: 'erro' }, m))) : null,
      r?.ok ? el('div', { class: 'hunt-sec' },
        el('b', {}, `${r.afetados} item(ns) serão alterados; ${r.totalIgnorados} ignorado(s).`),
        r.alertas.length ? el('div', {}, el('ul', { class: 'problemas' }, r.alertas.slice(0, 40).map((a) => el('li', { class: 'aviso' }, a.mensagem))), r.alertas.length > 40 ? el('div', { class: 'dica' }, `…e mais ${r.alertas.length - 40} alerta(s).`) : null,
          el('label', { class: 'conj-chk' }, el('input', { type: 'checkbox', checked: L.aprovarTodos, onchange: (e) => { L.aprovarTodos = e.target.checked; } }), ` Aprovar os ${r.alertas.length} alerta(s) (caso justificado)`)) : el('div', { class: 'dica' }, 'Sem alertas de excesso.'),
        tabela(['Item', 'Categoria', 'Mudanças (de → para)', 'IP antes', 'IP depois', 'Situação depois'], r.linhas.slice(0, 120).map((l) => el('tr', {}, el('td', {}, `${l.nome} #${l.id}`), el('td', {}, E.dados.rotulosDoSlot[l.slot]), el('td', {}, l.mudancas.map((m) => `${m.rotulo.split(' ')[0]} ${m.atual ?? '—'} → ${m.candidato ?? '—'}`).join(' · ') || 'sem mudança'), el('td', {}, String(l.ipAntes ?? '—')), el('td', {}, String(l.ipDepois ?? '—')), el('td', {}, l.situacaoDepois ? chip(l.situacaoDepois) : '—')))),
        r.afetados > 120 ? el('div', { class: 'dica' }, `Mostrando 120 de ${r.afetados}.`) : null,
        r.ignorados.length ? el('details', {}, el('summary', {}, `Ignorados (${r.totalIgnorados})`), el('ul', {}, r.ignorados.map((i) => el('li', {}, `#${i.id} ${i.nome ?? ''}: ${i.motivo}`)))) : null,
        el('button', { type: 'button', class: 'primario', disabled: dis(), onclick: aplicarLote }, `4. Aplicar a ${r.afetados} itens`)) : null);
  }

  // ------------------------------------------------------------ aba Histórico
  async function carregarHistorico() { E.hist = await api('item-power/historico'); }
  async function compararVersao(de) { E.comparacaoDeVersoes = await api(`item-power/versoes-comparar?${new URLSearchParams({ de, para: 'atual' })}`); pintarAba(); }
  async function restaurarDaVersao(n) {
    if (!(await confirmar(`Restaurar a versão ${n} do itens.json?`, 'O arquivo atual vai para o histórico; vale para TODOS os overrides de itens (inclusive preços e outros editados no editor de Itens).', { ok: 'Restaurar versão', perigo: true }))) return;
    const r = await api('item-power/edicao', { acao: 'restaurar-versao', versao: n, aplicar: true, revisao: revisaoDosItens() });
    if (r.ok === false) return msg((r.erros ?? ['Não restaurou.']).join(' '), 'erro');
    msg(`Versão ${n} restaurada.`, 'ok'); E.hist = null; await recarregarListaEDetalhe(null); await abrirAba('historico');
  }
  const ROTULO_EVENTO = { individual: 'edição individual', tabela: 'edição rápida (tabela)', lote: 'edição em lote', restauracao: 'restauração', 'restauracao-de-versao': 'restauração de versão' };
  function abaHistorico() {
    const h = E.hist; const c = E.comparacaoDeVersoes;
    if (!h) return el('div', { class: 'dica' }, 'Carregando…');
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'dica' }, 'Cada gravação do editor fica registrada (individual, tabela, lote ou restauração), e cada versão anterior do itens.json é guardada. Restaurar remove só o que foi pedido.'),
      h.eventos.length ? tabela(['Quando', 'Tipo', 'Itens', 'Detalhe'], h.eventos.map((e) => el('tr', {}, el('td', {}, new Date(e.quando).toLocaleString('pt-BR')), el('td', {}, ROTULO_EVENTO[e.tipo] ?? e.tipo), el('td', {}, String((e.ids ?? []).length || '—')),
        el('td', { class: 'dica' }, e.rotulo ? `${e.rotulo} ` : '', (e.itens ?? []).slice(0, 3).map((i) => `${i.nome}: ${i.mudancas.map((m) => `${m.campo} ${m.de ?? '—'}→${m.para ?? '—'}`).join(', ')}`).join(' | '))))) : el('div', { class: 'dica' }, 'Nenhuma edição registrada ainda.'),
      el('h4', {}, 'Versões do itens.json'),
      h.versoes.length ? tabela(['Versão', ''], h.versoes.map((v) => el('tr', {}, el('td', {}, `v${v}`), el('td', {}, el('button', { type: 'button', class: 'fantasma', onclick: () => compararVersao(String(v)) }, 'comparar com a atual'), el('button', { type: 'button', class: 'fantasma', disabled: dis(), onclick: () => restaurarDaVersao(v) }, 'restaurar'))))) : el('div', { class: 'dica' }, 'Ainda não há versões anteriores.'),
      c ? (c.ok ? el('div', {}, el('b', {}, `v${c.de} → atual: ${c.total} diferença(s)`), c.total ? tabela(['Item', 'Campo', 'Versão', 'Atual'], c.mudancas.map((m) => el('tr', {}, el('td', {}, `${m.nome ?? ''} #${m.id}`), el('td', {}, m.rotulo), el('td', {}, String(m.de ?? '—')), el('td', {}, String(m.para ?? '—'))))) : el('div', { class: 'dica' }, 'Iguais.')) : el('ul', { class: 'problemas' }, (c.erros ?? []).map((m) => el('li', { class: 'erro' }, m)))) : null);
  }

  // ------------------------------------------------------------ recalcular a curva a partir dos dados atuais
  async function propostaDeCurva() { E.curvaProp = await api('item-power/curva-proposta', { filtros: Object.fromEntries(Object.entries({ categoria: E.curvaFiltro.categoria || '', classe: E.curvaFiltro.classe, raridade: E.curvaFiltro.raridade, nivelMin: E.curvaFiltro.nivelMin, nivelMax: E.curvaFiltro.nivelMax }).filter(([, v]) => v !== '')), minimoDeItens: Number(E.curvaFiltro.minimoDeItens) || 3, descartarAtipicos: E.curvaFiltro.descartarAtipicos, monotonica: E.curvaFiltro.monotonica }); pintarAba(); }
  async function usarProposta() {
    const pr = E.curvaProp;
    if (!(await confirmar('Usar esta proposta como curva de referência?', `Substitui a curva de ${Object.keys(pr.proposta).length} categoria(s) no rascunho (ainda é preciso Salvar override). Considerou ${pr.itensConsiderados} item(ns); valores atípicos foram descartados.`, { ok: 'Usar proposta' }))) return;
    for (const [cat, pontos] of Object.entries(pr.proposta)) E.cfg.curva.categorias[cat] = structuredClone(pontos);
    mudou(); E.curvaProp = null; await carregarCurva(); pintarAba();
  }
  function blocoRecalcularCurva() {
    const F = E.curvaFiltro; const pr = E.curvaProp;
    const sel = (k, opcoes, todos) => el('select', { onchange: (e) => { F[k] = e.target.value; } }, [el('option', { value: '' }, todos), ...opcoes.map(([v, n]) => el('option', { value: v, selected: F[k] === v }, n))]);
    return el('fieldset', { class: 'ip-bloco' }, el('legend', {}, 'Recalcular a curva com os dados atuais (opcional)'),
      el('div', { class: 'dica' }, 'A curva é independente dos itens: ela só muda se você pedir aqui e confirmar. A proposta usa a MEDIANA por faixa de nível e descarta valores atípicos, para um item exagerado não distorcer tudo.'),
      el('div', { class: 'linha' }, sel('categoria', E.dados.slots.map((s) => [s, E.dados.rotulosDoSlot[s]]), 'todas as categorias'), sel('classe', ['knight', 'paladin', 'druid', 'sorcerer', 'monk'].map((c) => [c, c]), 'todas as classes'), sel('raridade', ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico'].map((c) => [c, c]), 'todas as raridades'),
        el('input', { type: 'number', placeholder: 'nível de', value: F.nivelMin, style: 'width:90px', onchange: (e) => { F.nivelMin = e.target.value; } }), el('input', { type: 'number', placeholder: 'nível até', value: F.nivelMax, style: 'width:90px', onchange: (e) => { F.nivelMax = e.target.value; } }),
        campo('mín. de itens por faixa', el('input', { type: 'number', min: 1, value: F.minimoDeItens, style: 'width:70px', onchange: (e) => { F.minimoDeItens = e.target.value; } })),
        el('label', { class: 'conj-chk' }, el('input', { type: 'checkbox', checked: F.descartarAtipicos, onchange: (e) => { F.descartarAtipicos = e.target.checked; } }), 'descartar valores atípicos'), el('label', { class: 'conj-chk' }, el('input', { type: 'checkbox', checked: F.monotonica, onchange: (e) => { F.monotonica = e.target.checked; } }), 'curva sempre crescente'),
        el('button', { type: 'button', onclick: propostaDeCurva }, 'Pré-visualizar proposta')),
      pr ? el('div', {}, el('b', {}, `${pr.itensConsiderados} equipamento(s) considerado(s).`),
        Object.entries(pr.porCategoria).map(([cat, v]) => el('details', {}, el('summary', {}, `${E.dados.rotulosDoSlot[cat]}: ${v.considerados} considerado(s), ${v.totalDescartados} descartado(s) como atípico(s)`),
          v.descartados.length ? el('div', { class: 'dica' }, `Descartados: ${v.descartados.map((d) => `${d.nome} (IP ${d.ip})`).join(', ')}`) : null,
          tabela(['Nível', 'Itens na faixa', 'Mediana', 'Atual', 'Proposta'], pr.proposta[cat].map((p, i) => el('tr', {}, el('td', {}, p.level), el('td', {}, v.buckets[i].itens), el('td', {}, v.buckets[i].mediana ?? '—'), el('td', {}, String(Math.round(esperadoLocal(pr.atual[cat], p.level) * 10) / 10)), el('td', {}, el('b', {}, String(p.ip)))))))),
        el('button', { type: 'button', class: 'primario', disabled: dis(), onclick: usarProposta }, 'Usar esta proposta (vai para o rascunho da curva)')) : null);
  }
  const esperadoLocal = (pts, level) => interpolar(pts, level);

  // ------------------------------------------------------------ montagem
  const corpoDaAba = () => ({ itens: abaItens, curva: abaCurva, formula: abaFormula, comparar: abaComparar, lote: abaLote, historico: abaHistorico, marcos: abaMarcos, distribuicao: abaDistribuicao })[E.aba]();
  const pintarAba = () => document.querySelector('#ip-aba')?.replaceWith(corpo());
  const corpo = () => el('div', { id: 'ip-aba' }, corpoDaAba());
  async function abrirAba(id) {
    E.aba = id;
    if (id === 'itens' && !E.lista) await buscar2();
    if (id === 'curva' && !E.curva) await carregarCurva();
    if (id === 'historico') await carregarHistorico();
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
  return { desenhar, abrir: (_c, id) => desenhar(id != null ? [id] : []), focarBusca: () => document.querySelector('.ip-filtros input')?.focus() };
}
