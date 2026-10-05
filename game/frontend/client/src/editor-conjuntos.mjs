// A aba "Conjuntos" da Engine: os SETS DE EQUIPAMENTO do jogo, por classe — cada conjunto é uma lista de bases de equipamento (uma por slot) organizada por Ato, tier e faixa de level.
// É uma ferramenta de desenvolvimento e balanceamento: NÃO dá bônus de conjunto, não muda drop nem combate. Cada peça é só uma referência ao item do catálogo (nada é copiado: editar o
// item reflete aqui). Os conjuntos valem para Normal, Cruel e Merciless. Edita por override (a fábrica nunca muda): editar → prévia (valida) → salvar → publicar.
// Toda regra mora no servidor (`systems/conjuntos.mjs`, `admin/overrides-conjuntos.mjs`); aqui só há tela.
import { el, cabecalho, confirmar, msg, tratarConflito } from './editor-ui.mjs';
import { retrato } from './editor-sprites.mjs';

const STATUS = { valido: 'Válido', aviso: 'Com aviso', incompleto: 'Incompleto', erro: 'Erro', inativo: 'Inativo' };
const COR = { valido: 'ok', aviso: 'aviso', incompleto: 'aviso', erro: 'bloqueante', inativo: 'mudo' };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const limpo = (c) => { const { origem, pecasResolvidas, ...resto } = c; void origem; void pecasResolvidas; return resto; };
const nomeDaClasse = (c) => c.charAt(0).toUpperCase() + c.slice(1);

export function criarTelaDeConjuntos({ api, raiz, sujo = null, podeGravar = () => true, irPara = null }) {
  const E = { dados: null, edit: {}, base: '', sel: null, aba: 'editar', previa: null, timer: null, pedido: 0, filtro: { q: '', classe: '', ato: '', tier: '', de: '', ate: '', status: '' }, seletor: null, itens: new Map(), totais: null, nivelTotais: '', excluidos: new Set() };
  const dis = () => !podeGravar();
  const mapaBase = () => Object.fromEntries(E.dados.conjuntos.map((c) => [c.id, limpo(c)]));
  const alterado = () => E.base !== JSON.stringify(E.edit);

  async function carregar(manterSelecao = false) {
    E.dados = await api('conjuntos');
    E.edit = mapaBase();
    E.base = JSON.stringify(E.edit);
    E.excluidos = new Set();
    E.previa = null;
    for (const c of E.dados.conjuntos) for (const p of Object.values(c.pecasResolvidas ?? {})) if (p && !p.inexistente) E.itens.set(p.id, p);
    if (!manterSelecao || !E.edit[E.sel]) E.sel = E.sel && E.edit[E.sel] ? E.sel : Object.keys(E.edit)[0] ?? null;
    sujo?.limpar();
  }
  async function desenhar(resto = []) { await carregar(); if (resto?.[0] && E.edit[resto[0]]) E.sel = resto[0]; pintar(); }

  // ------------------------------------------------------------ override a partir da edição
  const overrideAtual = () => {
    const conjuntos = { ...E.edit };
    for (const id of Object.keys(E.dados.original.conjuntos ?? {})) if (!E.edit[id]) conjuntos[id] = { excluido: true };
    return { ativo: E.dados.override?.ativo !== false, conjuntos };
  };
  function mudou() {
    sujo?.[alterado() ? 'marcar' : 'limpar']();
    atualizarBarra();
    clearTimeout(E.timer);
    E.timer = setTimeout(previsualizar, 350);
  }
  async function previsualizar() {
    const meu = ++E.pedido;
    const r = await api('conjuntos/validar', { override: overrideAtual() });
    if (meu !== E.pedido) return;
    E.previa = r;
    for (const c of r.conjuntos ?? []) for (const p of Object.values(c.pecasResolvidas ?? {})) if (p && !p.inexistente) E.itens.set(p.id, p);
    pintarLista(); pintarDetalhes(); atualizarBarra();
    if (E.aba === 'progressao') pintarAba();
  }
  const painel = () => E.previa?.painel ?? E.dados.painel;
  const linhaDe = (id) => painel().linhas.find((l) => l.id === id);
  const errosDe = (id) => (E.previa ? (E.previa.erros ?? []) : E.dados.validacao.erros).filter((m) => m.startsWith(`conjunto ${id}:`));
  const avisosDe = (id) => (E.previa ? (E.previa.avisos ?? []) : E.dados.validacao.avisos).filter((m) => m.startsWith(`conjunto ${id}:`));
  const geraisAvisos = () => (E.previa ? (E.previa.avisos ?? []) : E.dados.validacao.avisos).filter((m) => !m.startsWith('conjunto '));
  const barraDeEstado = () => el('span', { id: 'conj-contagem', class: 'dica' }, alterado() ? 'alterações não salvas' : (Object.keys(E.dados.override?.conjuntos ?? {}).length ? 'override salvo' : 'sem override (valem os conjuntos da fábrica)'));
  function atualizarBarra() {
    document.querySelector('#conj-contagem')?.replaceWith(barraDeEstado());
    const b = document.querySelector('#conj-salvar');
    if (b) b.disabled = dis() || !alterado() || E.previa?.ok === false;
    const d = document.querySelector('#conj-descartar');
    if (d) d.disabled = !alterado();
  }

  // ------------------------------------------------------------ ações
  async function salvar() {
    const r0 = await api('conjuntos/validar', { override: overrideAtual() });
    if (!r0.ok) { E.previa = r0; pintarDetalhes(); return msg((r0.erros ?? []).join(' '), 'erro'); }
    if (!(await confirmar('Salvar os conjuntos (override)?', `${r0.impacto.length} conjunto(s) novo(s), alterado(s) ou removido(s). A fábrica não é tocada. O servidor local aplica na hora (Hot Reload); para valer na produção é commit + deploy. Conjuntos incompletos podem ser salvos.`, { ok: 'Salvar' }))) return;
    const r = await api('conjuntos', { acao: 'salvar', override: overrideAtual(), revisao: E.dados.revisao });
    if (await tratarConflito(r, () => carregar(true).then(pintar))) return;
    if (r.ok === false) return msg((r.erros ?? ['Não salvou.']).join(' '), 'erro');
    msg(`Conjuntos salvos. ${r.comoPublicar ?? ''}`, 'ok');
    await carregar(true); pintar();
  }
  async function descartar() {
    if (!(await confirmar('Descartar as alterações não salvas?', 'Volta ao último estado salvo.', { ok: 'Descartar', perigo: true }))) return;
    await carregar(true); pintar();
  }
  async function reverterTudo() {
    if (!(await confirmar('Voltar tudo ao original?', 'Apaga TODAS as alterações locais dos conjuntos (a versão anterior vai para o histórico). A fábrica não muda.', { ok: 'Voltar ao original', perigo: true }))) return;
    const r = await api('conjuntos', { acao: 'reverter', revisao: E.dados.revisao });
    if (await tratarConflito(r, () => carregar().then(pintar))) return;
    if (r.ok === false) return msg((r.erros ?? ['Não reverteu.']).join(' '), 'erro');
    msg('Conjuntos restaurados ao original.', 'ok');
    await carregar(); pintar();
  }
  async function restaurarConjunto(id) {
    if (!(await confirmar(`Restaurar "${id}" ao original?`, 'Apaga só a alteração local deste conjunto (um conjunto novo é removido).', { ok: 'Restaurar', perigo: true }))) return;
    const r = await api('conjuntos', { acao: 'reverter-conjunto', id, revisao: E.dados.revisao });
    if (await tratarConflito(r, () => carregar().then(pintar))) return;
    if (r.ok === false) return msg((r.erros ?? ['Não restaurou.']).join(' '), 'erro');
    await carregar(); pintar();
  }
  async function restaurarVersao(n) {
    if (!(await confirmar(`Restaurar a versão ${n}?`, 'A configuração atual vai para o histórico.', { ok: 'Restaurar' }))) return;
    const r = await api('conjuntos', { acao: 'restaurar', versao: n, revisao: E.dados.revisao });
    if (await tratarConflito(r, () => carregar().then(pintar))) return;
    if (r.ok === false) return msg((r.erros ?? ['Não restaurou.']).join(' '), 'erro');
    await carregar(); pintar();
  }
  function criar() {
    const classe = E.filtro.classe || E.dados.classes[0];
    let n = 1; let id;
    do { id = `${classe}_novo_${String(n++).padStart(2, '0')}`; } while (E.edit[id]);
    const a = E.dados.atos.find((x) => String(x.ato) === E.filtro.ato) ?? E.dados.atos[0];
    E.edit[id] = { id, nome: `${nomeDaClasse(classe)} — novo conjunto`, classe, ato: a.ato, tier: a.tiers[0], levelMin: a.de, levelMax: a.ate, ativo: false, completo: false, pecas: {} };
    E.sel = id; mudou(); pintar();
  }
  function duplicar() {
    const c = E.edit[E.sel];
    if (!c) return;
    let n = 2; let id;
    do { id = `${c.id.replace(/_copia\d*$/, '')}_copia${n++}`; } while (E.edit[id]);
    E.edit[id] = { ...structuredClone(c), id, nome: `${c.nome} (cópia)`, ativo: false };
    E.sel = id; mudou(); pintar();
  }
  async function excluir() {
    const c = E.edit[E.sel];
    if (!c || !(await confirmar(`Excluir "${c.nome}"?`, `O conjunto ${c.id} sai da lista${E.dados.original.conjuntos?.[c.id] ? ' (é da fábrica: fica marcado como excluído no override e dá para restaurar)' : ''}. Só vale depois de salvar.`, { ok: 'Excluir', perigo: true }))) return;
    delete E.edit[c.id];
    E.sel = Object.keys(E.edit)[0] ?? null; mudou(); pintar();
  }
  async function modelos() {
    const r = await api('conjuntos/modelos', {});
    const novos = r.conjuntos.filter((c) => !E.edit[c.id]);
    if (!novos.length) return msg('Os modelos iniciais já existem.', 'aviso');
    if (!(await confirmar('Gerar modelos iniciais?', `Cria ${novos.length} conjunto(s) VAZIOS e INATIVOS (${E.dados.classes.length} classes × ${E.dados.planejamento.conjuntosPorClasse}, levels ${E.dados.planejamento.de}–${E.dados.planejamento.ate}) só como rascunho na tela: nada é gravado até você salvar.`, { ok: 'Gerar modelos' }))) return;
    for (const c of novos) E.edit[c.id] = c;
    E.sel = novos[0].id; mudou(); pintar();
  }
  const editar = (campo, valor) => { const c = E.edit[E.sel]; if (valor === undefined) delete c[campo]; else c[campo] = valor; mudou(); };
  const definirPeca = (slot, id) => { const c = E.edit[E.sel]; c.pecas = { ...c.pecas, [slot]: id }; E.seletor = null; mudou(); pintarEditor(); };

  // ------------------------------------------------------------ peças da tela
  const chip = (status, texto = null) => el('span', { class: `val-chip ${COR[status] ?? 'mudo'}` }, texto ?? STATUS[status] ?? status);
  const campo = (rotulo, entrada) => el('label', { class: 'campo conj-campo' }, rotulo, entrada);
  const selecionarConjunto = (id) => { E.sel = id; E.seletor = null; E.totais = null; history.replaceState(null, '', `#conjuntos/${encodeURIComponent(id)}`); pintarLista(); pintarEditor(); };

  function filtrados() {
    const f = E.filtro;
    const q = f.q.trim().toLowerCase();
    return Object.values(E.edit).filter((c) => {
      const l = linhaDe(c.id);
      if (q && !`${c.nome} ${c.id}`.toLowerCase().includes(q)) return false;
      if (f.classe && c.classe !== f.classe) return false;
      if (f.ato && String(c.ato) !== f.ato) return false;
      if (f.tier && String(c.tier) !== f.tier) return false;
      if (f.de !== '' && c.levelMax < Number(f.de)) return false;
      if (f.ate !== '' && c.levelMin > Number(f.ate)) return false;
      if (f.status && (l?.status ?? 'valido') !== f.status) return false;
      return true;
    }).sort((a, b) => a.classe.localeCompare(b.classe) || a.levelMin - b.levelMin || a.nome.localeCompare(b.nome));
  }
  function filtros() {
    const f = E.filtro;
    const mudar = (campo) => (e) => { f[campo] = e.target.value; pintarLista(); };
    return el('div', { class: 'conj-filtros' },
      el('input', { type: 'search', placeholder: 'buscar conjunto (nome ou ID)…', value: f.q, oninput: mudar('q') }),
      el('div', { class: 'linha' },
        el('select', { onchange: mudar('classe') }, [el('option', { value: '' }, 'todas as classes'), ...E.dados.classes.map((c) => el('option', { value: c, selected: f.classe === c }, nomeDaClasse(c)))]),
        el('select', { onchange: mudar('ato') }, [el('option', { value: '' }, 'todos os Atos'), ...E.dados.atos.map((a) => el('option', { value: String(a.ato), selected: f.ato === String(a.ato) }, `Ato ${a.ato}`))])),
      el('div', { class: 'linha' },
        el('select', { onchange: mudar('tier') }, [el('option', { value: '' }, 'todos os tiers'), ...[...new Set(E.dados.atos.flatMap((a) => a.tiers))].sort((a, b) => a - b).map((t) => el('option', { value: String(t), selected: f.tier === String(t) }, `T${t}`))]),
        el('select', { onchange: mudar('status') }, [el('option', { value: '' }, 'todos os status'), ...Object.entries(STATUS).map(([v, n]) => el('option', { value: v, selected: f.status === v }, n))])),
      el('div', { class: 'linha' }, el('input', { type: 'number', placeholder: 'level de', value: f.de, style: 'width:80px', oninput: mudar('de') }), el('input', { type: 'number', placeholder: 'level até', value: f.ate, style: 'width:80px', oninput: mudar('ate') }), el('button', { type: 'button', class: 'fantasma', onclick: () => { E.filtro = { q: '', classe: '', ato: '', tier: '', de: '', ate: '', status: '' }; pintar(); } }, 'limpar')));
  }
  function lista() {
    const itens = filtrados();
    return el('div', { id: 'conj-lista', class: 'conj-lista' },
      el('div', { class: 'dica' }, `${itens.length} de ${Object.keys(E.edit).length} conjunto(s)`),
      itens.map((c) => {
        const l = linhaDe(c.id) ?? { status: 'valido', preenchidos: 0, total: 8 };
        return el('button', { type: 'button', class: `conj-card${E.sel === c.id ? ' ativa' : ''}`, onclick: () => selecionarConjunto(c.id) },
          el('b', {}, c.nome), el('span', { class: 'dica' }, `${nomeDaClasse(c.classe)} · Ato ${c.ato} · T${c.tier} · nv ${c.levelMin}–${c.levelMax}`),
          el('span', { class: 'conj-card-pe' }, el('span', { class: 'dica' }, `${l.preenchidos}/${l.total} slots`), chip(l.status), c.origem && c.origem !== 'original' ? el('span', { class: 'selo' }, c.origem === 'novo' ? 'novo' : 'alterado') : null));
      }));
  }
  const pintarLista = () => document.querySelector('#conj-lista')?.replaceWith(lista());

  // ---- slots
  function cartaoDoSlot(c, slot) {
    const id = c.pecas?.[slot];
    const ficha = id != null ? E.itens.get(Number(id)) : null;
    const rot = E.dados.rotulos[slot];
    const aberto = E.seletor?.slot === slot;
    return el('div', { class: `conj-slot${id == null ? ' vazio' : ''}${aberto ? ' aberto' : ''}${ficha?.problema ? ' problema' : ''}` },
      el('div', { class: 'conj-slot-topo' }, el('b', {}, rot), !dis() && id != null ? el('button', { type: 'button', class: 'fantasma', title: 'Remover a peça', onclick: () => definirPeca(slot, null) }, '✕') : null),
      el('button', { type: 'button', class: 'conj-slot-corpo', disabled: dis(), onclick: () => abrirSeletor(slot), title: id == null ? `Escolher ${rot.toLowerCase()}` : 'Trocar a peça' },
        retrato(ficha?.desenho ?? null, 40, { categoria: 'itens', imediato: true }),
        id == null ? el('span', { class: 'dica' }, 'vazio — clique para escolher') : ficha ? el('span', { class: 'conj-slot-info' }, el('b', {}, ficha.nome), el('small', { class: 'dica' }, `nv ${ficha.minLevel} · T${ficha.tier} · ${ficha.vocations.length ? ficha.vocations.join('/') : 'todas as classes'}${ficha.duasMaos ? ' · duas mãos' : ''}`), el('small', { class: 'dica' }, Object.entries(ficha.atributos).filter(([k]) => k !== 'weight').map(([k, v]) => `${k} ${v}`).join(' · '))) : el('span', { class: 'conj-slot-info' }, el('b', {}, `item #${id}`), el('small', { class: 'dica' }, 'carregando…'))),
      ficha?.problema || (id != null && !ficha) ? el('div', { class: 'conj-slot-erro' }, ficha?.problema ?? '') : null);
  }
  async function abrirSeletor(slot) {
    const c = E.edit[E.sel];
    E.seletor = { slot, q: '', classe: c.classe, tier: '', nivelMin: '', nivelMax: String(c.levelMax), itens: [], total: 0 };
    pintarEditor();
    await buscarItens();
  }
  async function buscarItens() {
    const s = E.seletor;
    if (!s) return;
    const p = new URLSearchParams({ slot: s.slot, q: s.q, classe: s.classe, tier: s.tier, nivelMin: s.nivelMin, nivelMax: s.nivelMax, limite: 60 });
    const r = await api(`conjuntos/itens?${p}`);
    if (E.seletor !== s) return;
    s.itens = r.itens; s.total = r.total;
    for (const i of r.itens) E.itens.set(i.id, i);
    document.querySelector('#conj-seletor')?.replaceWith(seletor());
  }
  function seletor() {
    const s = E.seletor;
    if (!s) return el('div', { id: 'conj-seletor' });
    const c = E.edit[E.sel];
    const entrada = (campo, ph, w) => el('input', { type: 'text', placeholder: ph, value: s[campo], style: `width:${w}px`, oninput: (e) => { s[campo] = e.target.value; clearTimeout(E.tBusca); E.tBusca = setTimeout(buscarItens, 220); } });
    return el('div', { id: 'conj-seletor', class: 'conj-seletor' },
      el('div', { class: 'conj-seletor-topo' }, el('b', {}, `Escolher: ${E.dados.rotulos[s.slot]}`), el('button', { type: 'button', class: 'fantasma', onclick: () => { E.seletor = null; pintarEditor(); } }, 'fechar')),
      el('div', { class: 'linha' }, entrada('q', 'buscar por nome ou ID…', 200),
        el('select', { onchange: (e) => { s.classe = e.target.value; buscarItens(); } }, [el('option', { value: '' }, 'todas as classes'), ...E.dados.classes.map((x) => el('option', { value: x, selected: s.classe === x }, nomeDaClasse(x)))]),
        el('select', { onchange: (e) => { s.tier = e.target.value; buscarItens(); } }, [el('option', { value: '' }, 'todos os tiers'), ...[...new Set(E.dados.atos.flatMap((a) => a.tiers))].map((t) => el('option', { value: String(t), selected: s.tier === String(t) }, `T${t}`))]),
        entrada('nivelMin', 'level de', 70), entrada('nivelMax', 'level até', 70), el('span', { class: 'dica' }, `${s.total} item(ns) — categoria: ${E.dados.rotulos[s.slot]}`)),
      el('div', { class: 'conj-itens' }, s.itens.length ? s.itens.map((i) => el('button', { type: 'button', class: `conj-item${c.pecas?.[s.slot] === i.id ? ' atual' : ''}`, onclick: () => definirPeca(s.slot, i.id) },
        retrato(i.desenho ?? null, 32, { categoria: 'itens' }), el('span', { class: 'conj-slot-info' }, el('b', {}, i.nome), el('small', { class: 'dica' }, `#${i.id} · nv ${i.minLevel} · T${i.tier} · ${i.vocations.length ? i.vocations.join('/') : 'todas as classes'}${i.duasMaos ? ' · duas mãos' : ''}`), el('small', { class: 'dica' }, Object.entries(i.atributos).filter(([k]) => k !== 'weight').map(([k, v]) => `${k} ${v}`).join(' · '))))) : el('div', { class: 'dica' }, 'Nenhum item com esses filtros.')));
  }

  // ---- editor
  function editor() {
    const c = E.edit[E.sel];
    if (!c) return el('div', { id: 'conj-editor', class: 'bib-painel-vazio' }, el('b', {}, 'Nenhum conjunto selecionado'), el('span', { class: 'dica' }, 'Crie um conjunto, gere os modelos iniciais ou escolha um na lista.'));
    const novo = c.origem === 'novo' || !E.dados.original.conjuntos?.[c.id];
    const ato = E.dados.atos.find((a) => a.ato === c.ato);
    const num = (campoNome, w = 80, extra = {}) => el('input', { type: 'number', value: c[campoNome] ?? '', disabled: dis(), style: `width:${w}px`, ...extra, onchange: (e) => { const t = e.target.value; editar(campoNome, t === '' ? undefined : Number(t)); pintarDetalhes(); pintarLista(); } });
    return el('div', { id: 'conj-editor', class: 'conj-editor' },
      el('div', { class: 'conj-cab' },
        campo('Nome', el('input', { type: 'text', value: c.nome, disabled: dis(), style: 'width:260px', onchange: (e) => { editar('nome', e.target.value); pintarLista(); } })),
        campo('ID', el('input', { type: 'text', value: c.id, disabled: true, style: 'width:200px', title: 'O ID não muda depois de criado (duplique para usar outro)' })),
        campo('Classe', el('select', { disabled: dis(), onchange: (e) => { editar('classe', e.target.value); pintarEditor(); pintarLista(); } }, E.dados.classes.map((x) => el('option', { value: x, selected: c.classe === x }, nomeDaClasse(x))))),
        campo('Ato', el('select', { disabled: dis(), onchange: (e) => { editar('ato', Number(e.target.value)); pintarEditor(); pintarLista(); } }, E.dados.atos.map((a) => el('option', { value: a.ato, selected: c.ato === a.ato }, `Ato ${a.ato} (${a.de}–${a.ate})`)))),
        campo('Tier', num('tier', 60, { min: 1 })), campo('Level mín.', num('levelMin')), campo('Level máx.', num('levelMax')), campo('Recomendado', num('levelRecomendado')),
        el('label', { class: 'conj-chk' }, el('input', { type: 'checkbox', checked: c.ativo !== false, disabled: dis(), onchange: (e) => { editar('ativo', e.target.checked); pintarLista(); } }), 'ativo'),
        el('label', { class: 'conj-chk', title: 'Marcado como completo: todos os slots obrigatórios precisam estar preenchidos' }, el('input', { type: 'checkbox', checked: !!c.completo, disabled: dis(), onchange: (e) => { editar('completo', e.target.checked); pintarLista(); } }), 'completo')),
      el('div', { class: 'dica' }, `${ato ? `Ato ${ato.ato}: levels ${ato.de}–${ato.ato === E.dados.atos.at(-1).ato ? E.dados.nivelMaximo : ato.ate}, tiers das bases ${ato.tiers.map((t) => `T${t}`).join('–')}. ` : ''}Os equipamentos vão até o level ${E.dados.nivelMaximo}. Vale para Normal, Cruel e Merciless.`),
      campo('Descrição (opcional)', el('input', { type: 'text', value: c.descricao ?? '', disabled: dis(), style: 'width:100%', onchange: (e) => editar('descricao', e.target.value || undefined) })),
      el('div', { class: 'conj-acoes' },
        el('button', { type: 'button', disabled: dis(), onclick: duplicar }, 'Duplicar'),
        el('button', { type: 'button', class: 'perigo', disabled: dis(), onclick: excluir }, 'Excluir'),
        !novo || (E.dados.override?.conjuntos ?? {})[c.id] ? el('button', { type: 'button', disabled: dis() || !(E.dados.override?.conjuntos ?? {})[c.id], onclick: () => restaurarConjunto(c.id), title: 'Apaga a alteração local deste conjunto' }, novo ? 'Remover do override' : 'Restaurar ao original') : null),
      el('div', { class: 'conj-slots' }, E.dados.slots.map((s) => cartaoDoSlot(c, s))),
      seletor(),
      el('div', { id: 'conj-detalhes' }, detalhes()));
  }
  function detalhes() {
    const c = E.edit[E.sel];
    if (!c) return el('div');
    const erros = errosDe(c.id); const avisos = avisosDe(c.id);
    const l = linhaDe(c.id);
    const t = E.totais;
    const totaisDe = () => {
      if (!t) return null;
      if (t.ok === false) return el('div', { class: 'bib-alerta' }, (t.erros ?? []).join(' '));
      const x = t.totais;
      return el('div', {}, el('div', { class: 'dica' }, `${t.classe} no level ${t.level}, vestindo ${t.pecas} peça(s) base (sem raridade nem atributos sorteados) — ${t.fonte}.`),
        t.avisos.map((a) => el('div', { class: 'dica' }, `⚠ ${a}`)),
        el('table', { class: 'mob-tabela' }, el('tbody', {}, [['Ataque', `${x.ataque.min}–${x.ataque.max}`], ['Defesa do escudo', x.defesaDoEscudo], ['Armadura', x.armadura], ['Evasão', x.evasao], ['Energy Shield', x.energyShield], ['Bloqueio', x.bloqueio], ['Crítico', `${x.critico} (×${x.multiplicadorCritico})`], ['Precisão', x.precisao], ['Intervalo do golpe (ms)', x.intervaloDoGolpeMs], ['Alcance', x.alcance]].map(([k, v]) => el('tr', {}, el('td', {}, k), el('td', {}, String(v)))))));
    };
    return el('section', { class: 'hunt-sec' },
      el('div', { class: 'val-geral' }, l ? chip(l.status) : null, el('span', { class: 'dica' }, `${l?.preenchidos ?? 0}/${l?.total ?? 8} slots · ${erros.length} erro(s) · ${avisos.length} aviso(s)`)),
      erros.length ? el('ul', { class: 'problemas' }, erros.map((m) => el('li', { class: 'erro' }, m.replace(/^conjunto [^:]+: /, '')))) : null,
      avisos.length ? el('ul', { class: 'problemas' }, avisos.map((m) => el('li', { class: 'aviso' }, m.replace(/^conjunto [^:]+: /, '')))) : null,
      el('div', { class: 'linha' }, el('b', {}, 'Atributos totais (ficha real do jogo)'), el('input', { type: 'number', placeholder: `level (${c.levelRecomendado ?? c.levelMax})`, value: E.nivelTotais, style: 'width:110px', oninput: (e) => { E.nivelTotais = e.target.value; } }),
        el('button', { type: 'button', onclick: async () => { E.totais = await api('conjuntos/totais', { conjunto: c, level: E.nivelTotais === '' ? undefined : Number(E.nivelTotais) }); document.querySelector('#conj-detalhes')?.replaceChildren(detalhes()); } }, 'Calcular')),
      totaisDe());
  }
  function pintarDetalhes() { document.querySelector('#conj-detalhes')?.replaceChildren(detalhes()); }
  function pintarEditor() { document.querySelector('#conj-editor')?.replaceWith(editor()); }

  // ---- painel de progressão
  function abaProgressao() {
    const p = painel();
    const linhas = [...p.linhas].sort((a, b) => a.classe.localeCompare(b.classe) || a.ato - b.ato || a.levelMin - b.levelMin);
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'dica' }, `Planejamento de referência: levels ${p.planejamento.de}–${p.planejamento.ate} (Normal), ${p.planejamento.conjuntosPorClasse} conjuntos por classe. ${E.dados.classes.length} classes × ${p.planejamento.conjuntosPorClasse} = ${E.dados.classes.length * p.planejamento.conjuntosPorClasse} conjuntos × 8 slots = ${E.dados.classes.length * p.planejamento.conjuntosPorClasse * 8} associações possíveis.`),
      el('div', { class: 'prog-cards' },
        el('div', { class: 'prog-card' }, el('b', {}, `${linhas.length} conjunto(s)`), el('span', { class: 'dica' }, E.dados.classes.map((c) => `${nomeDaClasse(c)} ${p.porClasse[c].conjuntos}`).join(' · '))),
        el('div', { class: 'prog-card' }, el('b', {}, `Slots: ${p.slots.preenchidos} preenchidos · ${p.slots.vazios} vazios`), el('span', { class: 'dica' }, `${p.incompletos} conjunto(s) incompleto(s)`)),
        el('div', { class: 'prog-card' }, el('b', {}, 'Por Ato'), el('span', { class: 'dica' }, E.dados.atos.map((a) => `Ato ${a.ato}: ${p.porAto[a.ato] ?? 0}`).join(' · ')))),
      el('h4', {}, 'Cobertura por classe (levels sem conjunto ativo)'),
      el('table', { class: 'mob-tabela' }, el('thead', {}, el('tr', {}, ['Classe', 'Conjuntos', 'Ativos', 'Lacunas'].map((h) => el('th', {}, h)))), el('tbody', {}, E.dados.classes.map((c) => el('tr', {}, el('td', {}, nomeDaClasse(c)), el('td', {}, p.porClasse[c].conjuntos), el('td', {}, p.porClasse[c].ativos), el('td', { class: p.porClasse[c].lacunas.length ? 'niv-forte' : '' }, p.porClasse[c].lacunas.length ? p.porClasse[c].lacunas.map(([a, b]) => `${a}–${b}`).join(', ') : 'nenhuma'))))),
      el('h4', {}, 'Conjuntos (clique para editar)'),
      el('table', { class: 'mob-tabela conj-tabela' }, el('thead', {}, el('tr', {}, ['Classe', 'Ato', 'Conjunto', 'Tier', 'Level', 'Slots preenchidos', 'Status'].map((h) => el('th', {}, h)))),
        el('tbody', {}, linhas.length ? linhas.map((l) => el('tr', { class: 'conj-linha', onclick: () => { E.aba = 'editar'; E.sel = l.id; pintar(); } }, el('td', {}, nomeDaClasse(l.classe)), el('td', {}, `Ato ${l.ato}`), el('td', {}, l.nome), el('td', {}, `T${l.tier}`), el('td', {}, `${l.levelMin}–${l.levelMax}`), el('td', {}, `${l.preenchidos}/${l.total}`), el('td', {}, chip(l.status)))) : [el('tr', {}, el('td', { colspan: 7, class: 'dica' }, 'Nenhum conjunto cadastrado.'))])),
      p.repetidos.length ? el('div', {}, el('h4', {}, 'Itens repetidos entre conjuntos'), el('ul', { class: 'problemas' }, p.repetidos.map((r) => el('li', { class: 'aviso' }, `${r.nome ?? r.item} (#${r.item}, ${E.dados.rotulos[r.slot]}) em ${r.conjuntos.join(', ')}`)))) : null,
      p.foraDaFaixa.length ? el('div', {}, el('h4', {}, 'Equipamentos fora da faixa esperada (level mínimo acima do máximo do conjunto)'), el('ul', { class: 'problemas' }, p.foraDaFaixa.map((r) => el('li', { class: 'aviso' }, `${r.conjunto}: ${r.nome} (${E.dados.rotulos[r.slot]}) exige level ${r.minLevel}`)))) : null,
      geraisAvisos().length ? el('div', {}, el('h4', {}, 'Outros avisos'), el('ul', { class: 'problemas' }, geraisAvisos().slice(0, 40).map((m) => el('li', { class: 'aviso' }, m)))) : null);
  }

  function pintarAba() { document.querySelector('#conj-aba')?.replaceWith(corpo()); }
  function corpo() {
    return el('div', { id: 'conj-aba' }, E.aba === 'progressao' ? abaProgressao() : el('div', { class: 'conj-duas' },
      el('div', { class: 'conj-esq' }, el('div', { class: 'linha' }, el('button', { type: 'button', class: 'primario', disabled: dis(), onclick: criar }, '+ Criar conjunto'), el('button', { type: 'button', disabled: dis(), onclick: modelos, title: 'Cria conjuntos vazios e inativos (rascunho) para a estrutura inicial: 5 classes × 6' }, 'Gerar modelos iniciais')), filtros(), lista()),
      editor()));
  }

  function pintar() {
    const d = E.dados;
    raiz().replaceChildren(
      cabecalho('Conjuntos', 'Os sets de equipamento do jogo, por classe: oito slots, Ato, tier e faixa de level. Ferramenta de balanceamento — não dá bônus de conjunto nem muda drop ou combate. Edita por override: a fábrica nunca é alterada.'),
      !podeGravar() ? el('div', { class: 'bib-alerta' }, 'Somente leitura neste servidor (produção): dá para ver e calcular, mas não salvar.') : null,
      d.carga?.erros?.length ? el('div', { class: 'bib-alerta' }, `O override gravado foi IGNORADO no boot (inválido): ${d.carga.erros.join(' | ')}`) : null,
      el('div', { class: 'op-linha' }, barraDeEstado(),
        el('button', { id: 'conj-salvar', type: 'button', class: 'primario', disabled: dis() || !alterado() || E.previa?.ok === false, onclick: salvar }, 'Salvar override'),
        el('button', { id: 'conj-descartar', type: 'button', disabled: !alterado(), onclick: descartar }, 'Descartar alterações'),
        el('button', { type: 'button', class: 'perigo', disabled: dis() || !Object.keys(d.override?.conjuntos ?? {}).length, onclick: reverterTudo }, 'Voltar tudo ao original'),
        d.versoes.length ? el('label', { class: 'prog-rot' }, 'restaurar versão', el('select', { disabled: dis(), onchange: (e) => { if (e.target.value) restaurarVersao(Number(e.target.value)); e.target.value = ''; } }, [el('option', { value: '' }, '—'), ...d.versoes.map((v) => el('option', { value: v }, `v${v}`))])) : null),
      el('div', { class: 'eng-abas' }, [['editar', 'Editar conjuntos'], ['progressao', 'Painel de progressão']].map(([id, n]) => el('button', { type: 'button', class: E.aba === id ? 'ativa' : '', onclick: () => { E.aba = id; pintar(); } }, n))),
      corpo());
  }
  return { desenhar, abrir: (_c, id) => desenhar([id]), focarBusca: () => document.querySelector('.conj-filtros input')?.focus(), sujoAgora: () => !!E.dados && alterado() };
}
