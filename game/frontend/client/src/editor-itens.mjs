// O EDITOR DE ITENS da Engine: edita o catálogo POR CIMA do dado importado do Canary (camada de overrides: `systems/overrides.mjs`, `admin/overrides-itens.mjs`), sem tocar no original.
// Abas: Geral (nome, raridade, peso, NÍVEL EXIGIDO), Combate (atributos-base + painel de ITEM POWER com simulação em tempo real), Preços, Onde é usado e Histórico. Cada campo mostra o
// ORIGINAL ao lado e só vira override quando difere dele. Fluxo: editar → pré-visualizar (servidor: erros, avisos, impacto, Item Power) → salvar (arquivo + versão anterior; no ambiente
// local o Hot Reload aplica o catálogo em memória) → publicar (commit + deploy). Regras e fórmulas moram no servidor (`admin/item-power-editor.mjs`, `systems/item-power.mjs`): aqui só há tela.
import { el, cabecalho, confirmar, pedirTexto, msg, tratarConflito } from './editor-ui.mjs';
import { retrato } from './editor-sprites.mjs';
import { definirCampo, valorEfetivo, alterado, paraEnviar } from './editor-mobs.mjs';

const ABAS = [['geral', 'Geral'], ['combate', 'Combate'], ['precos', 'Preços'], ['usos', 'Onde é usado'], ['sprite', 'Sprite'], ['historico', 'Histórico']];
const CAMPOS = {
  geral: [['name', 'Nome', 'text'], ['rarity', 'Raridade-base', 'select'], ['weight', 'Peso', 'number'], ['minLevel', 'Nível exigido', 'number'], ['imbuementSlots', 'Slots de imbuement', 'number']],
  precos: [['buy', 'Preço de compra (NPC)', 'number'], ['sell', 'Preço de venda (NPC)', 'number']],
};
const SITUACAO = { abaixo: 'Abaixo do esperado', adequado: 'Adequado', acima: 'Acima do esperado', 'muito-acima': 'Muito acima do esperado', 'sem-poder': 'Sem atributos base', 'sem-level': 'Sem nível mínimo', 'sem-referencia': 'Sem referência' };
const COR = { abaixo: 'aviso', adequado: 'ok', acima: 'aviso', 'muito-acima': 'bloqueante', 'sem-poder': 'mudo', 'sem-level': 'mudo', 'sem-referencia': 'mudo' };
const ROTULO_EVENTO = { individual: 'edição individual (Item Power)', tabela: 'edição rápida', lote: 'edição em lote', 'itens-editor': 'editor de itens', restauracao: 'restauração', 'restauracao-de-versao': 'restauração de versão' };
const ROTULO_CAMPO = { name: 'Nome', minLevel: 'Nível exigido', rarity: 'Raridade', attack: 'Damage', defense: 'Block', armor: 'Armadura-base' };

/** Texto seguro para a tela: nunca "null", "undefined" nem "NaN" (campo ausente aparece como —). */
export const fmt = (v) => (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v)) ? '—' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toLocaleString('pt-BR', { maximumFractionDigits: 3 })) : String(v));
export const fmtPct = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1).replace('.', ',')}%`);
export const fmtDif = (v) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${fmt(v)}`);

export function criarEditorDeItens({ api, raiz, sujo = null, podeGravar = () => true, aoVoltar = null, irPara = null }) {
  const E = { q: '', filtro: '', slot: '', lista: null, id: null, ficha: null, ov: {}, previa: null, aba: 'geral', pedido: 0, poder: null, pedidoPoder: 0, rapido: false, sujos: {}, hist: null, comparacao: null, versaoComparada: '', armaPrevia: { qualidade: 0, locais: {} }, sprite: null, rascunhoDoSprite: null };
  const orig = () => E.ficha.original;
  const dis = () => !podeGravar();
  const params = () => new URLSearchParams({ q: E.q, filtro: E.filtro, slot: E.slot, limite: 120 });
  const chip = (s, t = null) => el('span', { class: `val-chip ${COR[s] ?? 'mudo'}` }, t ?? SITUACAO[s] ?? s);
  const tabela = (cabs, linhas) => el('div', { class: 'itm-rolagem' }, el('table', { class: 'bib-sub niv-impacto' }, el('thead', {}, el('tr', {}, cabs.map((h) => el('th', {}, h)))), el('tbody', {}, linhas)));

  async function desenhar(id = null) {
    E.lista = await api(`overrides/itens?${params()}`);
    if (id) await abrir(id);
    else pintar();
  }
  async function buscarLista() {
    E.lista = await api(`overrides/itens?${params()}`);
    document.getElementById('itm-lista')?.replaceWith(listaLateral());
    atualizarRapido();
  }
  async function abrir(id) {
    const f = await api(`overrides/itens/${encodeURIComponent(id)}`);
    if (f?.ok === false || !f?.id) return msg('Item não encontrado.', 'erro');
    E.id = String(id);
    E.ficha = f;
    E.ov = structuredClone(f.override ?? {});
    E.previa = null; E.poder = null; E.hist = null; E.comparacao = null; E.armaPrevia = { qualidade: 0, locais: {} }; E.sprite = null; E.rascunhoDoSprite = null;
    sujo?.limpar();
    history.replaceState(null, '', `#itens/editar/${encodeURIComponent(id)}`);
    pintar();
    await pedirPoder();
  }

  let esperando = null;
  function mudou() {
    sujo?.[alterado(E.ov, E.ficha.override) ? 'marcar' : 'limpar']();
    atualizarBarra();
    clearTimeout(esperando);
    esperando = setTimeout(() => { previsualizar(); pedirPoder(); }, 350);
  }
  async function previsualizar() {
    const meu = ++E.pedido;
    const r = await api('overrides/itens/validar', { id: E.id, override: paraEnviar(E.ov) });
    if (meu !== E.pedido) return;
    E.previa = r;
    pintarPrevia();
  }
  /** O painel de Item Power: tudo calculado pelo servidor com a fórmula real do módulo, sobre o RASCUNHO da tela (nada é gravado). */
  async function pedirPoder() {
    if (!E.id) return;
    const meu = ++E.pedidoPoder;
    const r = await api('overrides/itens/poder', { id: E.id, override: paraEnviar(E.ov), arma: E.armaPrevia });
    if (meu !== E.pedidoPoder) return;
    E.poder = r;
    pintarAba();
  }
  const aprovacoesDoPoder = () => (E.poder?.alertas ?? []);
  async function salvar() {
    await previsualizar();
    if (E.previa?.erros?.length) return msg('Corrija os erros antes de salvar.', 'erro');
    if (!alterado(E.ov, E.ficha.override)) return msg('Nenhuma alteração para salvar.', 'aviso');
    await pedirPoder();
    const avisos = E.previa?.avisos?.length ?? 0; const alertas = aprovacoesDoPoder();
    const texto = `${alertas.length ? `Alertas de balanceamento (não bloqueiam; confirme se são justificados):\n${alertas.slice(0, 6).map((a) => `• ${a.mensagem}`).join('\n')}${alertas.length > 6 ? `\n…e mais ${alertas.length - 6}` : ''}\n\n` : ''}${avisos ? `${avisos} aviso(s) (veja a pré-visualização). ` : ''}Grava gamedata/overrides/itens.json neste servidor (o catálogo do Canary não é tocado). No ambiente local o Hot Reload atualiza o catálogo em memória; para valer na produção: commit + deploy.`;
    if (!(await confirmar(alertas.length ? `Salvar ${valorEfetivo(orig(), E.ov, 'name')} COM ${alertas.length} alerta(s)?` : `Salvar as alterações de ${valorEfetivo(orig(), E.ov, 'name')}?`, texto, { ok: alertas.length ? 'Aprovar alertas e salvar' : 'Salvar', perigo: avisos > 0 }))) return;
    const r = await api('overrides/itens', { acao: 'salvar', id: E.id, override: paraEnviar(E.ov), revisao: E.ficha.revisao, aplicar: true });
    if (await tratarConflito(r, () => abrir(E.id))) return;
    if (r.ok === false) return msg((r.erros ?? ['Não salvou.']).join(' '), 'erro');
    msg(`Override salvo. ${mensagemDoHotReload(r.hotReload)}`, r.hotReload?.aplicado ? 'ok' : 'aviso');
    await abrir(E.id);
    buscarLista();
  }
  const mensagemDoHotReload = (h) => (h?.aplicado ? 'Hot Reload aplicou o catálogo em memória (Item Power, ficha e próximos drops leem o valor novo; peças já geradas mantêm a faixa sorteada).' : `Hot Reload NÃO aplicou (${h?.motivo ?? 'desligado'}): reinicie o ambiente local para o jogo ver a mudança.`);
  async function descartar() {
    if (alterado(E.ov, E.ficha.override) && !(await confirmar('Descartar as alterações?', 'Volta ao que está no arquivo. Nada foi gravado.', { ok: 'Descartar', perigo: true }))) return;
    await abrir(E.id);
  }
  function restaurarTudoNoRascunho() {
    const manter = E.ov.ativo === false ? { ativo: false } : {};
    E.ov = manter; mudou(); pintarAba();
    msg('Todos os campos voltaram ao original NO RASCUNHO. Salve para gravar (ou descarte).', 'aviso');
  }
  async function reverter() {
    if (!E.ficha.override) return msg('Este item não tem override gravado.', 'aviso');
    if (!(await confirmar(`Reverter ${valorEfetivo(orig(), E.ov, 'name')} ao original?`, 'Apaga TODO o override gravado deste item (o valor do Canary volta). Para restaurar só um campo, use "voltar ao original" no campo.', { ok: 'Reverter', perigo: true }))) return;
    const r = await api('overrides/itens', { acao: 'reverter', id: E.id, revisao: E.ficha.revisao, aplicar: true });
    if (await tratarConflito(r, () => abrir(E.id))) return;
    if (r.ok === false) return msg(r.erros.join(' '), 'erro');
    msg(`Override apagado. ${mensagemDoHotReload(r.hotReload)}`, r.hotReload?.aplicado ? 'ok' : 'aviso');
    await abrir(E.id);
    buscarLista();
  }
  /** Cria um item NOVO como cópia deste (ou do item-base, se este já é um item novo): ID livre, mesmo slot, tipo, atributos e sprite; depois se edita como qualquer item. */
  async function criarNovo() {
    const idBase = E.ficha.novo ? E.ficha.override.base : Number(E.id);
    const nome = await pedirTexto('Criar item novo', { rotulo: `Nome do novo item (cópia de ${valorEfetivo(orig(), E.ov, 'name')})`, valor: `${valorEfetivo(orig(), E.ov, 'name')} (novo)`, validar: (v) => (v.trim().length >= 1 && v.length <= 80 ? null : 'De 1 a 80 caracteres.'), ok: 'Criar' });
    if (nome == null) return;
    const r = await api('overrides/itens', { acao: 'duplicar', base: idBase, nome, aplicar: true, revisao: E.ficha.revisao });
    if (await tratarConflito(r, () => abrir(E.id))) return;
    if (r.ok === false) return msg((r.erros ?? ['Não criou.']).join(' '), 'erro');
    msg(`Item #${r.id} criado como cópia de #${idBase}. ${mensagemDoHotReload(r.hotReload)} O sprite é o do item-base até você trocar na aba Sprite.`, r.hotReload?.aplicado ? 'ok' : 'aviso');
    await buscarLista();
    await abrir(String(r.id));
  }
  async function alternarDeste() {
    const ligado = E.ficha.override?.ativo !== false;
    const r = await api('overrides/itens', { acao: 'ativo', ativo: !ligado, id: E.id, revisao: E.ficha.revisao });
    if (await tratarConflito(r, () => abrir(E.id))) return;
    if (r.ok === false) return msg(r.erros.join(' '), 'erro');
    msg(`Override de ${E.id} ${ligado ? 'desligado (o jogo usa o original)' : 'ligado'}.`, 'ok');
    await abrir(E.id);
  }
  async function alternarGlobal() {
    const ligar = !E.lista.ativo;
    if (!(await confirmar(ligar ? 'Ligar a camada de overrides de itens?' : 'Desligar a camada de overrides de itens?', ligar ? 'Os overrides gravados voltam a valer (Hot Reload local ou próximo boot).' : 'O jogo ignora TODOS os overrides de itens (nada é apagado).', { ok: ligar ? 'Ligar' : 'Desligar', perigo: !ligar }))) return;
    const r = await api('overrides/itens', { acao: 'ativo', ativo: ligar, revisao: E.lista.revisao });
    if (await tratarConflito(r, () => desenhar(E.id))) return;
    if (r.ok === false) return msg(r.erros.join(' '), 'erro');
    await desenhar(E.id);
  }

  // ---------------------------------------------------------------- campos genéricos (Geral e Preços)
  function campo([c, rotulo, tipo]) {
    const v = valorEfetivo(orig(), E.ov, c);
    const mudado = E.ov[c] !== undefined;
    const entrada = tipo === 'select'
      ? el('select', { disabled: dis(), onchange: (e) => { definirCampo(orig(), E.ov, c, e.target.value); mudou(); pintarAba(); } }, E.ficha.rarezas.map((r) => el('option', { value: r, selected: r === v }, r)))
      : el('input', { type: tipo, value: v ?? '', step: tipo === 'number' ? 'any' : null, disabled: dis(), onchange: (e) => { definirCampo(orig(), E.ov, c, tipo === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value); mudou(); pintarAba(); } });
    return el('label', { class: `campo mob-campo${mudado ? ' mudou' : ''}` }, rotulo, entrada, el('small', { class: 'mob-original' }, `original: ${orig()[c] ?? '—'}`),
      mudado && !dis() ? el('button', { type: 'button', class: 'fantasma', onclick: () => { delete E.ov[c]; mudou(); pintarAba(); } }, 'voltar ao original') : null);
  }

  // ---------------------------------------------------------------- aba Combate: atributos-base e Item Power
  function entradaDeAtributo(c, valor, desabilitar = false) {
    return el('input', { type: 'number', min: 0, step: 1, value: valor ?? '', disabled: dis() || desabilitar, class: E.ov[c] !== undefined ? 'itm-modificado' : '', style: 'width:100px', placeholder: 'ausente',
      onchange: (e) => { definirCampo(orig(), E.ov, c, e.target.value === '' ? undefined : Number(e.target.value)); mudou(); pintarAba(); } });
  }
  const restaurarCampo = (c) => (E.ov[c] !== undefined && !dis() ? el('button', { type: 'button', class: 'fantasma', onclick: () => { delete E.ov[c]; mudou(); pintarAba(); } }, 'restaurar') : null);
  async function alvoDeDefesa(tipo, valor) {
    if (valor === '') return;
    const r = await api('item-power/resolver-defesa', { id: E.id, override: paraEnviar(E.ov), tipo, valor: Number(valor) });
    if (r.ok === false) { msg((r.erros ?? ['Valor inválido.']).join(' '), 'erro'); return pintarAba(); }
    definirCampo(orig(), E.ov, 'armor', r.armor); mudou(); pintarAba();
    msg((r.avisos ?? []).join(' ') || 'Armadura-base ajustada.', 'ok');
  }
  function linhaRaw(c, p) {
    const d = p.campos[c];
    return el('tr', { class: d.modificado ? 'itm-linha-mod' : '' },
      el('td', {}, d.rotulo, d.presente ? null : el('small', { class: 'dica' }, ' (ausente no original)')), el('td', {}, fmt(d.original)), el('td', {}, fmt(d.atual)),
      el('td', {}, entradaDeAtributo(c, valorEfetivo(orig(), E.ov, c))), el('td', {}, fmt(d.simulado)), el('td', {}, fmtDif(d.diferenca)), el('td', {}, fmtPct(d.diferencaPct)), el('td', {}, restaurarCampo(c)));
  }
  function linhaDerivada(d, p) {
    const editavel = ['armour', 'evasion', 'energyShield'].includes(d.atributo) && p.tiposDeDefesa.includes(d.atributo);
    return el('tr', {}, el('td', {}, d.rotulo, d.derivado ? el('small', { class: 'dica' }, ' (derivado da armadura-base)') : null), el('td', {}, fmt(d.original)), el('td', {}, fmt(d.atual)),
      el('td', {}, editavel ? el('input', { type: 'number', min: 0, step: 1, disabled: dis(), style: 'width:100px', value: '', placeholder: `alvo (${fmt(d.simulado)})`, title: 'Digite o valor desejado: o servidor resolve a armadura-base que o produz neste tipo e nível', onchange: (e) => alvoDeDefesa(d.atributo, e.target.value) }) : el('span', { class: 'dica' }, d.derivado ? 'a base da peça não tem este tipo (0)' : '—')),
      el('td', {}, fmt(d.simulado)), el('td', {}, fmtDif(d.diferenca)), el('td', {}, fmtPct(d.diferencaPct)), el('td', {}));
  }
  function blocoDeAtributos(p) {
    const aplicaveis = ['attack', 'defense', 'armor'].filter((c) => p.campos[c].aplicavel);
    const naoAplicaveis = ['attack', 'defense', 'armor'].filter((c) => !p.campos[c].aplicavel);
    const der = (a) => p.derivados.find((x) => x.atributo === a);
    const cab = ['Atributo', 'Original', 'Atual (salvo)', 'Editar', 'Simulado', 'Dif.', 'Dif. %', ''];
    return el('div', {},
      el('h4', {}, 'Atributos ofensivos'),
      p.slot === 'weapon' || p.campos.attack.presente ? tabela(cab, [linhaRaw('attack', p),
        el('tr', {}, el('td', {}, 'Damage mínimo / máximo'), el('td', { colspan: 7, class: 'dica' }, `O catálogo guarda um valor só: mínimo = máximo = Damage (${fmt(p.campos.attack.simulado)}). A fórmula usa a média dos dois.`))]) : el('div', { class: 'dica' }, 'Este item não tem atributo ofensivo-base (Damage).'),
      el('h4', {}, 'Atributos defensivos'),
      p.slot !== 'weapon' || p.campos.defense.presente
        ? tabela(cab, [p.campos.defense.aplicavel ? linhaRaw('defense', p) : null, p.campos.armor.aplicavel ? linhaRaw('armor', p) : null, ...(p.slot === 'weapon' ? [] : ['armour', 'evasion', 'energyShield'].map((a) => linhaDerivada(der(a), p)))]) // sempre as três, com 0 quando a base da peça não tem o tipo
        : el('div', { class: 'dica' }, 'Este item não tem atributos defensivos-base.'),
      naoAplicaveis.length ? el('details', {}, el('summary', {}, `Campos sem aplicação neste slot (${naoAplicaveis.map((c) => p.campos[c].rotulo).join(', ')})`), el('div', { class: 'dica' }, 'Não são mostrados como zero: o item simplesmente não tem esse atributo (ausente ≠ 0). O override só cria o campo se você inseri-lo na aba/linha própria.'),
        tabela(['Campo', 'Original', 'Editar'], naoAplicaveis.map((c) => el('tr', {}, el('td', {}, p.campos[c].rotulo), el('td', {}, fmt(p.campos[c].original)), el('td', {}, entradaDeAtributo(c, valorEfetivo(orig(), E.ov, c))))))) : null,
      aplicaveis.length ? null : null,
      p.outros.length ? el('details', {}, el('summary', {}, `Outros atributos do catálogo (somente leitura: ${p.outros.length})`), el('ul', { class: 'op-lista' }, p.outros.map((o) => el('li', {}, `${o.rotulo}: ${fmt(o.valor)} `, el('small', { class: 'dica' }, o.nota))))) : null,
      el('details', {}, el('summary', {}, 'O que NÃO é editado aqui'), el('ul', { class: 'op-lista' }, [
        'Atributos-base (editáveis aqui): Damage = attack, Block = defense, armadura-base = armor; nível exigido na aba Geral.',
        'Derivados: Armour / Evasion / Energy Shield saem da armadura-base pelo tipo da peça e pelo nível (editar um deles resolve a armadura-base).',
        'Modificadores / afixos: rolados no drop; não são do catálogo.', 'Bônus de conjunto: o jogo não tem; conjuntos aqui só agrupam itens.', 'Atributos do personagem e valores de combate: calculados pela ficha; não entram no Item Power.'].map((t) => el('li', {}, t)))));
  }
  function painelDePoder(p) {
    if (!p.ehEquipamento || !p.ip) return el('div', { class: 'dica' }, 'Item Power só existe para equipamentos dos 8 slots (arma, escudo, cabeça, corpo, pernas, botas, anel, amuleto).');
    const i = p.ip; const n = p.nivel; const cur = p.curva;
    const mudou = i.simulado !== i.atual;
    return el('div', { class: 'ip-painel' },
      el('div', { class: 'linha' }, el('h4', {}, 'Item Power'), chip(i.situacaoSimulada), i.mudouDeSituacao ? el('span', { class: 'dica' }, `(original: ${SITUACAO[i.situacaoOriginal]})`) : null),
      el('div', { class: 'ip-grande' }, el('b', {}, `Item Power ${fmt(i.simulado)}`), mudou ? el('span', { class: 'selo' }, 'simulado, não salvo') : null),
      el('div', {}, `Esperado para o nível ${fmt(n.simulado)}: ${fmt(i.esperado)} · diferença ${fmtDif(i.diferencaEsperado)} · variação ${fmtPct(i.diferencaEsperadoPct)}`),
      cur?.faixaAdequada ? el('div', { class: 'dica' }, `Faixa "adequado" da curva: ${fmt(cur.faixaAdequada[0])} a ${fmt(cur.faixaAdequada[1])} (categoria ${p.slot}). ${cur.independente}`) : null,
      tabela(['Indicador', 'Original', 'Atual (salvo)', 'Simulado', 'Dif. (sim. − orig.)', 'Dif. %'], [
        el('tr', {}, el('td', {}, 'Nível exigido'), el('td', {}, fmt(n.original)), el('td', {}, fmt(n.atual)), el('td', {}, fmt(n.simulado)), el('td', {}, fmtDif(n.simulado != null && n.original != null ? n.simulado - n.original : null)), el('td', {}, '—')),
        ...p.derivados.map((d) => el('tr', {}, el('td', {}, d.rotulo), el('td', {}, fmt(d.original)), el('td', {}, fmt(d.atual)), el('td', {}, fmt(d.simulado)), el('td', {}, fmtDif(d.diferenca)), el('td', {}, fmtPct(d.diferencaPct)))),
        el('tr', { class: 'itm-total' }, el('td', {}, 'Item Power'), el('td', {}, fmt(i.original)), el('td', {}, fmt(i.atual)), el('td', {}, fmt(i.simulado)), el('td', {}, fmtDif(i.diferencaSimuladoOriginal)), el('td', {}, fmtPct(i.pctSimuladoOriginal))),
        el('tr', {}, el('td', {}, 'Situação na curva'), el('td', {}, SITUACAO[i.situacaoOriginal]), el('td', {}, SITUACAO[i.situacaoAtual]), el('td', {}, SITUACAO[i.situacaoSimulada]), el('td', { colspan: 2 }, i.mudouDeSituacao ? 'mudou' : 'igual'))]),
      p.atributosQueMudaram.length ? el('div', { class: 'dica' }, `O que provocou a mudança (pontos do salvo para o simulado): ${p.atributosQueMudaram.map((a) => `${a.rotulo} ${fmtDif(a.diferenca)}`).join(' · ')}`) : null,
      n.tierOriginal !== n.tierSimulado ? el('div', { class: 'dica' }, `O tier derivado do nível muda: T${fmt(n.tierOriginal)} → T${fmt(n.tierSimulado)}.`) : null,
      el('details', {}, el('summary', {}, 'Composição do cálculo (fórmula, fatores e pesos reais)'),
        tabela(['Atributo', 'Valor', 'Fator', 'Peso', 'Pontos'], [...p.composicao.map((c) => el('tr', {}, el('td', {}, c.rotulo), el('td', {}, fmt(c.valor)), el('td', {}, fmt(c.fator)), el('td', {}, fmt(c.peso)), el('td', {}, fmt(c.pontos)))), el('tr', { class: 'itm-total' }, el('td', {}, 'Total'), el('td', {}), el('td', {}), el('td', {}), el('td', {}, fmt(i.simulado)))]),
        el('div', { class: 'dica' }, 'IP = Σ valor × fator × peso. Damage = média de mín. e máx.; o Block da arma conta metade. Atributo ausente ou zero soma 0 pontos.')),
      p.alertas.length ? el('div', {}, el('b', {}, 'Alertas de balanceamento (não bloqueiam; você confirma ao salvar):'), el('ul', { class: 'problemas' }, p.alertas.map((a) => el('li', { class: 'aviso' }, a.mensagem)))) : el('div', { class: 'dica' }, 'Sem alertas de balanceamento para esta simulação.'),
      p.equivalentes.length ? el('details', { open: true }, el('summary', {}, `Comparação com ${p.equivalentes.length} equipamento(s) equivalente(s) (mesmo slot, classe compatível, nível ±25)`), tabela(['Equivalente', 'Nível', 'Item Power', 'Este item vs. ele', ''], p.equivalentes.map((q) => el('tr', {}, el('td', {}, `${q.nome} #${q.id}`), el('td', {}, fmt(q.minLevel)), el('td', {}, fmt(q.ip)), el('td', {}, fmtPct(q.ip ? (i.simulado - q.ip) / q.ip : null)), el('td', {}, irPara ? el('button', { type: 'button', class: 'fantasma', onclick: () => abrir(q.id) }, 'abrir') : null))))) : el('div', { class: 'dica' }, 'Sem equivalentes suficientes para comparar.'),
      el('div', { class: 'linha' }, irPara ? el('button', { type: 'button', onclick: () => irPara('itempower', null, [E.id]) }, 'Abrir no Item Power completo (comparar, lote, histórico)') : null,
        irPara ? el('button', { type: 'button', class: 'fantasma', onclick: () => irPara('itempower') }, 'Recalcular a curva de referência (no Item Power)') : null),
      el('div', { class: 'dica ip-aviso' }, p.aviso));
  }
  // ---- ARMA: base original × modificadores locais × qualidade → valores finais (a conta é a de `engine/arma.mjs`, calculada no servidor) ----
  const aoMudarPrevia = () => { clearTimeout(esperando); esperando = setTimeout(pedirPoder, 250); };
  const campoDaBase = (c, rotulo, passo, padrao) => el('label', { class: `campo mob-campo${E.ov[c] !== undefined ? ' mudou' : ''}` }, rotulo,
    el('input', { type: 'number', min: 0, step: passo, value: E.ov[c] ?? '', placeholder: fmt(padrao), disabled: dis(), class: E.ov[c] !== undefined ? 'itm-modificado' : '',
      onchange: (e) => { definirCampo(orig(), E.ov, c, e.target.value === '' ? undefined : Number(e.target.value)); mudou(); pintarAba(); } }),
    el('small', { class: 'mob-original' }, `original: ${orig()[c] ?? '—'}`), E.ov[c] !== undefined && !dis() ? el('button', { type: 'button', class: 'fantasma', onclick: () => { delete E.ov[c]; mudou(); pintarAba(); } }, 'voltar ao original') : null);
  const campoLocal = (k, rotulo, passo = 1) => el('label', { class: 'campo mob-campo' }, rotulo, el('input', { type: 'number', step: passo, value: E.armaPrevia.locais[k] ?? '', placeholder: '0', disabled: dis(), onchange: (e) => { if (e.target.value === '') delete E.armaPrevia.locais[k]; else E.armaPrevia.locais[k] = Number(e.target.value); aoMudarPrevia(); } }));
  function blocoDaArma(p) {
    const a = p.arma; const b = a.base.editada; const f = a.final; const o = a.original; const real = a.golpeBasicoReal;
    const alterouAlgo = f.qualidade > 0 || Object.values(f.locais).some((v) => v !== 0);
    return el('div', { class: 'ip-painel itm-arma' },
      el('h4', {}, `Arma — ${fmt(a.tipo)}${a.duasMaos ? ' (duas mãos)' : ''}`),
      a.nota ? el('div', { class: 'dica' }, a.nota) : null,
      el('fieldset', { class: 'ip-bloco' }, el('legend', {}, '1 · Base ORIGINAL (editável; vira override do item)'),
        el('div', { class: 'dica' }, a.rotulos.base),
        el('div', { class: 'linha' }, campoDaBase('attackMin', 'Dano físico mínimo', 1, b.danoMin), campoDaBase('attackMax', 'Dano físico máximo', 1, b.danoMax), campoDaBase('aps', 'Ataques por segundo (APS)', 0.01, b.aps),
          campoDaBase('critChance', 'Chance de crítico (centésimos de %: 500 = 5%)', 1, b.critChance), campoDaBase('range', 'Alcance (casas)', 1, b.alcance)),
        el('div', { class: 'linha' }, campoDaBase('reqStr', 'Requer STR', 1, null), campoDaBase('reqDex', 'Requer DEX', 1, null), campoDaBase('reqInt', 'Requer INT', 1, null),
          el('span', { class: 'dica' }, `Nível exigido: ${fmt(b.nivel)} (aba Geral). Os requisitos preenchidos valem de verdade (a engine confere ao equipar, e o personagem precisa de TODOS); vazios, vale a regra derivada da classe e do nível.`)),
        el('div', { class: 'dica' }, `Sem faixa própria, o dano usa o ataque único (${fmt(orig().attack)}); sem APS, o do jogo hoje (${fmt(a.apsPadrao)} = 1 golpe a cada 2 s).`)),
      el('fieldset', { class: 'ip-bloco' }, el('legend', {}, '2 · Qualidade e modificadores LOCAIS (prévia: ficam na peça, não no catálogo)'),
        el('div', { class: 'dica' }, a.rotulos.locais),
        el('div', { class: 'linha' }, el('label', { class: 'campo mob-campo' }, `Qualidade (0 a ${a.qualidadeMaxima}%)`, el('input', { type: 'number', min: 0, max: a.qualidadeMaxima, step: 1, value: E.armaPrevia.qualidade || '', placeholder: '0', disabled: dis(), onchange: (e) => { E.armaPrevia.qualidade = Math.max(0, Math.min(a.qualidadeMaxima, Number(e.target.value) || 0)); aoMudarPrevia(); } }),
          el('input', { type: 'range', min: 0, max: a.qualidadeMaxima, step: 1, value: E.armaPrevia.qualidade, disabled: dis(), oninput: (e) => { E.armaPrevia.qualidade = Number(e.target.value); aoMudarPrevia(); } })),
          campoLocal('addMin', 'Dano físico adicional mín.'), campoLocal('addMax', 'Dano físico adicional máx.'), campoLocal('pctDano', '% dano físico (local)'), campoLocal('pctVelocidade', '% velocidade de ataque (local)'), campoLocal('pctCritico', '% chance de crítico (local)')),
        el('div', { class: 'dica' }, 'Qualidade aumenta o dano físico mín./máx. e o APS; não mexe em crítico, alcance, requisitos nem dano elemental. É aplicada UMA vez, na etapa 4.'),
        alterouAlgo ? el('button', { type: 'button', class: 'fantasma', onclick: () => { E.armaPrevia = { qualidade: 0, locais: {} }; pedirPoder(); } }, 'zerar a prévia') : null),
      el('fieldset', { class: 'ip-bloco' }, el('legend', {}, '3 · Valores FINAIS da arma (regra de cálculo: base → adicional local → % local → qualidade)'),
        el('div', { class: 'dica' }, a.rotulos.final),
        tabela(['Atributo', 'Base original', 'Base editada', 'Após adicional local', 'Após % local', 'FINAL (com qualidade)', 'Dif. vs original'], [
          el('tr', {}, el('td', {}, 'Dano físico'), el('td', {}, `${fmt(o.dano.base[0])}–${fmt(o.dano.base[1])}`), el('td', {}, `${fmt(f.dano.base[0])}–${fmt(f.dano.base[1])}`), el('td', {}, `${fmt(f.dano.aposAdicional[0])}–${fmt(f.dano.aposAdicional[1])}`), el('td', {}, `${fmt(f.dano.aposPercentual[0])}–${fmt(f.dano.aposPercentual[1])}`), el('td', {}, el('b', {}, `${fmt(f.danoMin)}–${fmt(f.danoMax)}`)), el('td', {}, fmtPct(o.danoMedio ? (f.danoMedio - o.danoMedio) / o.danoMedio : null))),
          el('tr', {}, el('td', {}, 'Ataques por segundo'), el('td', {}, fmt(o.aps.base)), el('td', {}, fmt(f.aps.base)), el('td', {}, '—'), el('td', {}, fmt(f.aps.aposLocal)), el('td', {}, el('b', {}, fmt(f.apsFinal))), el('td', {}, fmtPct(o.apsFinal ? (f.apsFinal - o.apsFinal) / o.apsFinal : null))),
          el('tr', {}, el('td', {}, 'Chance de crítico (qualidade não entra)'), el('td', {}, `${fmt(o.critChance.base / 100)}%`), el('td', {}, `${fmt(f.critChance.base / 100)}%`), el('td', {}, '—'), el('td', {}, '—'), el('td', {}, el('b', {}, `${fmt(f.critChance.final / 100)}%`)), el('td', {}, '—')),
          el('tr', { class: 'itm-total' }, el('td', {}, 'Dano médio por ataque'), el('td', {}, fmt(o.danoMedio)), el('td', {}, '—'), el('td', {}, '—'), el('td', {}, '—'), el('td', {}, fmt(f.danoMedio)), el('td', {}, fmtPct(o.danoMedio ? (f.danoMedio - o.danoMedio) / o.danoMedio : null))),
          el('tr', { class: 'itm-total' }, el('td', {}, 'DPS físico da arma'), el('td', {}, fmt(o.dpsFisico)), el('td', {}, '—'), el('td', {}, '—'), el('td', {}, '—'), el('td', {}, el('b', {}, fmt(f.dpsFisico))), el('td', {}, fmtPct(o.dpsFisico ? (f.dpsFisico - o.dpsFisico) / o.dpsFisico : null)))]),
        alterouAlgo ? el('div', { class: 'dica' }, `A qualidade acrescentou ${fmt(f.ganhoDaQualidade.danoMin)}–${fmt(f.ganhoDaQualidade.danoMax)} de dano e ${fmt(f.ganhoDaQualidade.aps)} de APS (aplicada uma vez).`) : null),
      el('fieldset', { class: 'ip-bloco' }, el('legend', {}, '4 · Golpe básico REAL (a regra do combate, personagem de referência)'),
        el('div', { class: 'dica' }, a.rotulos.real),
        real ? tabela(['Referência', 'Dano por golpe', 'Intervalo', 'Golpes/s', 'Dano médio', 'DPS do golpe básico'], [el('tr', {}, el('td', {}, `${real.classe} nv ${real.level} (${real.pericia} ${real.valorDaPericia})`), el('td', {}, `${fmt(real.danoMin)}–${fmt(real.danoMax)}`), el('td', {}, `${fmt(real.intervaloMs)} ms`), el('td', {}, fmt(real.golpesPorSegundo)), el('td', {}, fmt(real.danoMedio)), el('td', {}, fmt(real.dpsDoGolpeBasico)))]) : el('div', { class: 'dica' }, 'Não calculável para este item.'),
        el('div', { class: 'dica' }, 'Diferente do DPS físico da arma: aqui entram perícia, level, STR/INT, velocidade global (DEX) e o intervalo da engine. Habilidades, gemas, críticos e efeitos NÃO entram (dependem de gema, alvo e rotação).')));
  }
  function abaCombate() {
    const p = E.poder;
    if (!p) return el('div', { class: 'dica' }, 'Carregando atributos e Item Power…');
    if (p.ok === false && !p.id) return el('ul', { class: 'problemas' }, (p.erros ?? []).map((m) => el('li', { class: 'erro' }, m)));
    return el('div', {},
      !p.ehEquipamento ? el('div', { class: 'dica' }, 'Este item não é um equipamento dos 8 slots: ataque, defesa e armadura só fazem efeito onde o jogo lê esses campos. Os campos abaixo aparecem como no catálogo (ausente ≠ 0).') : null,
      p.erros?.length ? el('ul', { class: 'problemas' }, p.erros.map((m) => el('li', { class: 'erro' }, `✖ ${m}`))) : null,
      el('div', { class: 'itm-legenda' }, el('span', { class: 'itm-modificado-ex' }, 'campo modificado (rascunho)'), el('span', {}, 'original = catálogo do Canary'), el('span', {}, 'atual = salvo no override'), el('span', {}, 'simulado = rascunho na tela (nada gravado)')),
      p.arma ? blocoDaArma(p) : null, blocoDeAtributos(p), painelDePoder(p));
  }
  function abaGeral() {
    const p = E.poder; const n = p?.nivel;
    return el('div', {}, el('div', { class: 'grade' }, CAMPOS.geral.map(campo)),
      n ? el('div', { class: 'ip-painel' }, el('h4', {}, 'Nível exigido e progressão'),
        tabela(['', 'Original', 'Atual (salvo)', 'Simulado'], [
          el('tr', {}, el('td', {}, 'Nível exigido do item'), el('td', {}, fmt(n.original)), el('td', {}, fmt(n.atual)), el('td', {}, fmt(n.simulado))),
          el('tr', {}, el('td', {}, 'Tier da base (derivado do nível)'), el('td', {}, n.tierOriginal != null ? `T${n.tierOriginal}` : '—'), el('td', {}, '—'), el('td', {}, n.tierSimulado != null ? `T${n.tierSimulado}` : '—')),
          el('tr', {}, el('td', {}, 'Act de referência (derivado)'), el('td', {}, fmt(n.atoOriginal)), el('td', {}, '—'), el('td', {}, fmt(n.atoSimulado))),
          el('tr', {}, el('td', {}, 'Nível recomendado'), el('td', {}, fmt(n.original)), el('td', {}, fmt(n.atual)), el('td', {}, fmt(n.recomendado))),
          el('tr', {}, el('td', {}, 'IP esperado para o nível'), el('td', {}, fmt(p.curva?.esperadoOriginal)), el('td', {}, '—'), el('td', {}, fmt(p.curva?.esperado)))]),
        el('div', { class: 'dica' }, n.nota), el('div', { class: 'dica' }, `O nível vai de 1 a ${n.nivelMaximo} na progressão atual.`),
        (p.alertas ?? []).filter((a) => a.tipo === 'nivel-distante').map((a) => el('div', { class: 'aviso' }, `⚠ ${a.mensagem}`)),
        p.ip ? el('div', {}, `Item Power simulado ${fmt(p.ip.simulado)} (esperado ${fmt(p.ip.esperado)}, ${fmtPct(p.ip.diferencaEsperadoPct)}) — detalhes na aba Combate.`) : null) : null);
  }

  // ---------------------------------------------------------------- aba Histórico do item
  async function carregarHistorico() {
    E.hist = await api(`item-power/historico?${new URLSearchParams({ id: E.id, limite: 50 })}`);
    pintarAba();
  }
  async function compararVersao(de) {
    E.versaoComparada = de;
    E.comparacao = de ? await api(`item-power/versoes-comparar?${new URLSearchParams({ de, para: 'atual', id: E.id })}`) : null;
    pintarAba();
  }
  async function restaurarCampoSalvo(c) {
    if (!(await confirmar(`Restaurar "${ROTULO_CAMPO[c]}" ao original?`, 'Remove só o override deste campo; os outros campos e itens não mudam.', { ok: 'Restaurar', perigo: true }))) return;
    const r = await api('item-power/edicao', { acao: 'restaurar', ids: [Number(E.id)], campos: [c], rotulo: 'restauração de campo (editor de itens)', aplicar: true, revisao: E.ficha.revisao });
    if (await tratarConflito(r, () => abrir(E.id))) return;
    if (r.ok === false) return msg((r.erros ?? ['Não restaurou.']).join(' '), 'erro');
    msg(`Campo restaurado. ${mensagemDoHotReload(r.hotReload)}`, r.hotReload?.aplicado ? 'ok' : 'aviso');
    await abrir(E.id);
    await carregarHistorico();
  }
  function abaHistorico() {
    const h = E.hist;
    if (!h) { carregarHistorico(); return el('div', { class: 'dica' }, 'Carregando…'); }
    const salvos = Object.keys(E.ficha.override ?? {}).filter((k) => k in ROTULO_CAMPO);
    return el('div', {},
      el('h4', {}, 'Campos com override salvo'),
      salvos.length ? tabela(['Campo', 'Original', 'Salvo', ''], salvos.map((c) => el('tr', {}, el('td', {}, ROTULO_CAMPO[c]), el('td', {}, fmt(orig()[c])), el('td', {}, fmt(E.ficha.override[c])), el('td', {}, el('button', { type: 'button', class: 'fantasma', disabled: dis(), onclick: () => restaurarCampoSalvo(c) }, 'restaurar só este campo'))))) : el('div', { class: 'dica' }, 'Este item está igual ao original (nenhum campo editável com override).'),
      el('h4', {}, 'Alterações registradas neste item'),
      h.eventos.length ? tabela(['Quando', 'Origem', 'O que mudou'], h.eventos.map((e) => el('tr', {}, el('td', {}, new Date(e.quando).toLocaleString('pt-BR')), el('td', {}, ROTULO_EVENTO[e.tipo] ?? e.tipo),
        el('td', { class: 'dica' }, (e.itens ?? []).filter((i) => String(i.id) === E.id).map((i) => (i.mudancas ?? []).map((m) => `${ROTULO_CAMPO[m.campo] ?? m.campo} ${fmt(m.de)} → ${fmt(m.para)}`).join(' · ')).join('') || (e.campos ? `restaurou ${e.campos.map((c) => ROTULO_CAMPO[c] ?? c).join(', ')}` : e.rotulo ?? '—'))))) : el('div', { class: 'dica' }, 'Nenhuma alteração registrada para este item.'),
      el('h4', {}, 'Comparar com uma versão anterior do arquivo'),
      el('div', { class: 'linha' }, el('select', { onchange: (e) => compararVersao(e.target.value) }, [el('option', { value: '' }, 'escolha uma versão…'), ...h.versoes.map((v) => el('option', { value: String(v), selected: E.versaoComparada === String(v) }, `v${v}`))])),
      E.comparacao ? (E.comparacao.ok ? (E.comparacao.mudancas.length ? tabela(['Campo', `v${E.comparacao.de}`, 'Atual'], E.comparacao.mudancas.map((m) => el('tr', {}, el('td', {}, m.rotulo), el('td', {}, fmt(m.de)), el('td', {}, fmt(m.para))))) : el('div', { class: 'dica' }, 'Este item é igual nas duas versões.')) : el('ul', { class: 'problemas' }, (E.comparacao.erros ?? []).map((m) => el('li', { class: 'erro' }, m)))) : null);
  }

  // ---------------------------------------------------------------- aba Sprite (override da figura do item)
  async function carregarSprite() { E.sprite = await api(`sprites-itens/${encodeURIComponent(E.id)}`); pintarAba(); }
  async function lerArquivo(arquivo) {
    const dataUrl = await new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => falha(new Error('Não consegui ler o arquivo.')); r.readAsDataURL(arquivo); });
    E.rascunhoDoSprite = { png: dataUrl, nome: arquivo.name, frames: E.rascunhoDoSprite?.frames ?? 1, validacao: null };
    await validarSprite();
  }
  async function validarSprite() {
    const r = E.rascunhoDoSprite; if (!r) return;
    r.validacao = await api('sprites-itens/validar', { id: E.id, png: r.png, frames: r.frames });
    pintarAba();
  }
  async function salvarSprite() {
    const r = E.rascunhoDoSprite;
    if (!r?.validacao?.ok) return msg('Escolha uma imagem válida primeiro.', 'aviso');
    if (!(await confirmar('Trocar o sprite deste item?', `Grava a imagem em overrides/sprites/itens/${E.id}.png e o cadastro em overrides/itens-sprites.json (o atlas original não é tocado). Quem abrir o jogo depois de recarregar a página vê a figura nova.`, { ok: 'Salvar sprite' }))) return;
    const resp = await api('sprites-itens', { acao: 'salvar', id: E.id, png: r.png, frames: r.frames, revisao: E.sprite?.revisao });
    if (await tratarConflito(resp, () => carregarSprite())) return;
    if (resp.ok === false) return msg((resp.erros ?? ['Não salvou.']).join(' '), 'erro');
    msg(`Sprite salvo. ${resp.comoPublicar}`, 'ok');
    E.rascunhoDoSprite = null; await carregarSprite();
  }
  async function restaurarSprite() {
    if (!(await confirmar('Voltar ao sprite original?', 'Remove só a imagem trocada deste item.', { ok: 'Restaurar', perigo: true }))) return;
    const resp = await api('sprites-itens', { acao: 'reverter', id: E.id, revisao: E.sprite?.revisao });
    if (await tratarConflito(resp, () => carregarSprite())) return;
    if (resp.ok === false) return msg((resp.erros ?? ['Não restaurou.']).join(' '), 'erro');
    msg('Sprite original restaurado (recarregue a página para ver no jogo).', 'ok'); await carregarSprite();
  }
  function abaSprite() {
    const s = E.sprite;
    if (!s) { carregarSprite(); return el('div', { class: 'dica' }, 'Carregando…'); }
    const r = E.rascunhoDoSprite; const v = r?.validacao;
    return el('div', {},
      el('div', { class: 'dica' }, 'Troca a figura deste item por uma imagem PNG (override): o atlas original nunca é alterado e dá para voltar ao original a qualquer momento. Um item novo usa o sprite do item-base até ganhar o seu.'),
      el('div', { class: 'linha' }, el('div', {}, el('b', {}, 'Original'), el('div', {}, retrato(f_desenho(), 64, { categoria: 'itens', imediato: true })), el('div', { class: 'dica' }, s.original ? `${s.original.w}×${s.original.h}px · ${s.original.quadros} quadro(s)` : 'sem figura no atlas')),
        s.override ? el('div', {}, el('b', {}, 'Sprite alterado (salvo)'), el('div', {}, el('img', { src: s.url, width: Math.min(128, s.override.w * 2), style: 'image-rendering:pixelated;background:#222' })), el('div', { class: 'dica' }, `${s.override.w}×${s.override.h}px × ${s.override.frames} quadro(s)`)) : null,
        r?.png ? el('div', {}, el('b', {}, 'Rascunho (não salvo)'), el('div', {}, el('img', { src: r.png, width: Math.min(256, (v?.quadro?.w ?? 32) * (r.frames || 1) * 2), style: 'image-rendering:pixelated;background:#222' }))) : null),
      s.herdaDoItemBase != null ? el('div', { class: 'dica' }, `Este item novo usa o sprite do item #${s.herdaDoItemBase} enquanto não tiver o seu.`) : null,
      el('div', { class: 'linha' }, el('label', { class: 'campo mob-campo' }, 'Imagem PNG (quadros lado a lado)', el('input', { type: 'file', accept: 'image/png', disabled: dis(), onchange: (e) => { if (e.target.files?.[0]) lerArquivo(e.target.files[0]); } })),
        el('label', { class: 'campo mob-campo' }, 'Quadros (animação)', el('input', { type: 'number', min: 1, max: s.limites.quadrosMax, value: r?.frames ?? 1, style: 'width:80px', disabled: dis() || !r, onchange: (e) => { r.frames = Math.max(1, Number(e.target.value) || 1); validarSprite(); } }))),
      v ? (v.erros?.length ? el('ul', { class: 'problemas' }, v.erros.map((m) => el('li', { class: 'erro' }, `✖ ${m}`))) : el('div', { class: 'selo ok' }, `Imagem válida: ${v.quadro.w}×${v.quadro.h}px por quadro`)) : null,
      v?.avisos?.length ? el('ul', { class: 'problemas' }, v.avisos.map((m) => el('li', { class: 'aviso' }, `⚠ ${m}`))) : null,
      el('div', { class: 'linha' }, el('button', { type: 'button', class: 'primario', disabled: dis() || !v?.ok, onclick: salvarSprite }, 'Salvar sprite'), el('button', { type: 'button', disabled: !r, onclick: () => { E.rascunhoDoSprite = null; pintarAba(); } }, 'Descartar rascunho'),
        el('button', { type: 'button', class: 'perigo', disabled: dis() || !s.override, onclick: restaurarSprite }, 'Voltar ao sprite original')),
      el('div', { class: 'dica' }, 'No jogo, recarregue a página (F5) para carregar o sprite novo; limites: quadro de 8 a 128 px, até 32 quadros, 600 KB.'));
  }
  const f_desenho = () => E.ficha?.desenho ?? null;

  const corpo = (aba) => {
    if (aba === 'usos') return el('div', {}, E.ficha.usos.length ? el('ul', { class: 'op-lista' }, E.ficha.usos.map((x) => el('li', {}, `${x.nome ?? x.id} `, el('small', { class: 'dica' }, x.categoria ?? x.tipo ?? '')))) : el('div', { class: 'dica' }, 'Este item não é usado em nenhuma hunt, boss ou encontro.'), (E.ficha.conjuntos ?? []).length ? el('div', {}, el('h4', {}, 'Conjuntos que usam este item'), el('ul', { class: 'op-lista' }, E.ficha.conjuntos.map((c) => el('li', {}, `${c.nome} `, el('small', { class: 'dica' }, `${c.classe} · Ato ${c.ato} · ${c.slot}${c.ativo ? '' : ' · inativo'}`), ' ', irPara ? el('button', { type: 'button', class: 'fantasma', onclick: () => irPara('conjuntos', null, [c.id]) }, 'abrir conjunto') : null)))) : el('div', { class: 'dica' }, 'Nenhum conjunto usa este item.'));
    if (aba === 'combate') return abaCombate();
    if (aba === 'geral') return abaGeral();
    if (aba === 'historico') return abaHistorico();
    if (aba === 'sprite') return abaSprite();
    return el('div', {}, el('div', { class: 'grade' }, CAMPOS[aba].map(campo)));
  };
  function pintarAba() { document.getElementById('itm-aba')?.replaceChildren(corpo(E.aba)); }

  function pintarPrevia() {
    const caixa = document.getElementById('itm-previa');
    if (!caixa) return;
    const p = E.previa;
    const filhos = [
      !p || (!p.mudancas?.length && !p.erros?.length) ? el('div', { class: 'dica' }, 'Edite um campo: a pré-visualização mostra erros, avisos e o impacto antes de qualquer gravação.') : null,
      p?.erros?.length ? el('ul', { class: 'problemas' }, p.erros.map((x) => el('li', { class: 'erro' }, `✖ ${x}`))) : null,
      p?.avisos?.length ? el('ul', { class: 'problemas' }, p.avisos.map((x) => el('li', { class: 'aviso' }, `⚠ ${x}`))) : null,
      p?.mudancas?.length ? tabela(['Campo', 'Original', 'Efetivo', 'Variação'], p.mudancas.map((m) => el('tr', {}, el('td', {}, ROTULO_CAMPO[m.campo] ?? m.campo), el('td', {}, fmt(m.antes)), el('td', {}, fmt(m.depois)), el('td', { class: m.variacaoPct != null && Math.abs(m.variacaoPct) >= 25 ? 'niv-forte' : '' }, m.variacaoPct != null ? `${m.variacaoPct > 0 ? '+' : ''}${m.variacaoPct}%` : '—')))) : null,
      p && p.mudancas?.length && !p.erros?.length && !p.avisos?.length ? el('div', { class: 'selo ok' }, 'Sem erros nem avisos') : null,
    ].filter((x) => x != null); // replaceChildren(null) escreveria o texto "null" na tela
    caixa.replaceChildren(...filhos);
  }
  function atualizarBarra() {
    const s = document.getElementById('itm-salvar');
    if (s) s.disabled = !alterado(E.ov, E.ficha.override) || dis();
    const d = document.getElementById('itm-descartar');
    if (d) d.disabled = !alterado(E.ov, E.ficha.override);
    const c = document.getElementById('itm-contagem');
    if (c) c.textContent = alterado(E.ov, E.ficha.override) ? 'alterações não salvas' : 'sem alterações';
  }

  // ---------------------------------------------------------------- lista lateral (com edição rápida)
  const campoRapido = (m, k, atual) => el('input', { type: 'number', min: 0, step: 1, value: E.sujos[m.id]?.[k] ?? atual ?? '', placeholder: '—', class: E.sujos[m.id]?.[k] !== undefined ? 'itm-modificado' : '', style: 'width:56px', title: { minLevel: 'nível', damage: 'Damage', block: 'Block', armor: 'armadura-base' }[k], disabled: dis(),
    onclick: (e) => e.stopPropagation(),
    onchange: (e) => { const v = e.target.value === '' ? undefined : Number(e.target.value); const ed = (E.sujos[m.id] ??= {}); if (v === undefined || v === atual) delete ed[k]; else ed[k] = v; if (!Object.keys(ed).length) delete E.sujos[m.id]; atualizarRapido(); } });
  function atualizarRapido() {
    const n = Object.keys(E.sujos).length;
    const b = document.getElementById('itm-rapido-salvar'); if (b) { b.disabled = dis() || !n; b.textContent = `Salvar (${n})`; }
    const c = document.getElementById('itm-rapido-cancelar'); if (c) c.disabled = !n;
  }
  async function salvarRapido() {
    const edicoes = { ...E.sujos };
    const p = await api('item-power/edicao-previa', { edicoes, origem: 'tabela' });
    if (!p.ok) return msg((p.erros ?? ['Edição inválida.']).slice(0, 4).join(' '), 'erro');
    const alertas = p.alertas ?? [];
    if (!(await confirmar(alertas.length ? `Salvar ${p.resumo.comMudanca} item(ns) COM ${alertas.length} alerta(s)?` : `Salvar ${p.resumo.comMudanca} item(ns)?`, `${alertas.length ? `Alertas (não bloqueiam; confirme se são justificados):\n${alertas.slice(0, 6).map((a) => `• ${a.mensagem}`).join('\n')}\n\n` : ''}Mesma gravação do editor completo: overrides/itens.json, numa operação só (tudo ou nada).`, { ok: alertas.length ? 'Aprovar alertas e salvar' : 'Salvar' }))) return;
    const r = await api('item-power/edicao', { acao: 'salvar', edicoes, origem: 'tabela', rotulo: 'edição rápida (editor de itens)', aprovarTodos: alertas.length > 0, aplicar: true, revisao: p.revisao });
    if (await tratarConflito(r, () => buscarLista())) return;
    if (r.ok === false) return msg((r.erros ?? ['Não salvou.']).join(' '), 'erro');
    msg(`${(r.alterados ?? []).length} item(ns) salvo(s). ${mensagemDoHotReload(r.hotReload)}`, r.hotReload?.aplicado ? 'ok' : 'aviso');
    const aberto = E.id && E.sujos[E.id] !== undefined;
    E.sujos = {};
    await buscarLista();
    if (aberto) await abrir(E.id);
  }
  function listaLateral() {
    const itens = E.lista?.itens ?? [];
    const slots = ['', 'weapon', 'head', 'body', 'legs', 'feet', 'shield', 'neck', 'ring', 'backpack', 'ammo'];
    let espera = null;
    const linha = (m) => el('div', { class: `hunts-item mob-item itm-linha${m.id === E.id ? ' ativa' : ''}`, onclick: () => abrir(m.id), role: 'button', tabindex: 0 },
      retrato(m.desenho, 32, { categoria: 'itens', rotulo: m.nome }),
      el('span', {}, el('b', {}, m.nome), el('small', {}, `#${m.id} · ${m.tipo ?? 'sem tipo'}${m.temOverride ? (m.ativo === false ? ' · override desligado' : ' · com override') : ''}`),
        el('small', { class: 'itm-mini' }, m.ip != null ? `IP ${fmt(m.ip)} ` : '', m.minLevel != null ? `· nv ${m.minLevel} ` : '', m.novo ? el('span', { class: 'selo' }, 'novo') : null, m.atributosEditados ? el('span', { class: 'selo', title: m.original ? `original: nível ${fmt(m.original.minLevel)}, Damage ${fmt(m.original.attack)}, Block ${fmt(m.original.defense)}, armadura ${fmt(m.original.armor)}` : '' }, 'modificado') : null),
        E.rapido && m.slot ? el('span', { class: 'itm-rapido' }, campoRapido(m, 'minLevel', m.minLevel), campoRapido(m, 'damage', m.attack), campoRapido(m, 'block', m.defense), campoRapido(m, 'armor', m.armor)) : null));
    return el('aside', { class: 'hunts-lista', id: 'itm-lista' },
      el('input', { type: 'search', placeholder: 'buscar item (2+ letras)…', value: E.q, oninput: (e) => { E.q = e.target.value; clearTimeout(espera); espera = setTimeout(buscarLista, 250); } }),
      el('div', { class: 'hunts-cats' }, [['', 'Busca'], ['com-override', `Com override (${E.lista?.comOverride ?? 0})`], ['novos', 'Itens novos']].map(([id, n]) => el('button', { type: 'button', class: E.filtro === id ? 'ativa' : '', onclick: () => { E.filtro = id; buscarLista(); } }, n))),
      el('select', { onchange: (e) => { E.slot = e.target.value; buscarLista(); } }, slots.map((s) => el('option', { value: s, selected: s === E.slot }, s || 'todos os slots'))),
      el('label', { class: 'conj-chk', title: 'Edita nível, Damage, Block e armadura-base direto na lista; a gravação é a mesma do editor completo' }, el('input', { type: 'checkbox', checked: E.rapido, disabled: dis(), onchange: (e) => { E.rapido = e.target.checked; document.getElementById('itm-lista')?.replaceWith(listaLateral()); } }), 'edição rápida (nível · Damage · Block · armadura)'),
      E.rapido ? el('div', { class: 'linha' }, el('button', { id: 'itm-rapido-salvar', type: 'button', class: 'primario', disabled: true, onclick: salvarRapido }, 'Salvar (0)'), el('button', { id: 'itm-rapido-cancelar', type: 'button', disabled: true, onclick: () => { E.sujos = {}; document.getElementById('itm-lista')?.replaceWith(listaLateral()); } }, 'Cancelar')) : null,
      el('div', { class: 'hunts-itens' }, itens.map(linha)),
      E.lista?.dica ? el('div', { class: 'dica' }, E.lista.dica) : el('div', { class: 'dica' }, `${E.lista?.total ?? 0} item(ns)`));
  }

  function painel() {
    const f = E.ficha;
    if (!f) return el('div', { class: 'bib-painel-vazio' }, 'Busque um item à esquerda para editar. As alterações ficam num arquivo de overrides — o catálogo do Canary nunca é tocado.');
    return el('div', { class: 'hunt-painel' },
      el('div', { class: 'hunt-topo' }, retrato(f.desenho, 64, { categoria: 'itens', imediato: true }), el('div', {}, el('h2', {}, valorEfetivo(orig(), E.ov, 'name')), el('div', { class: 'dica' }, `${f.novo ? 'ITEM NOVO · ' : ''}#${f.id} · ${orig().type ?? 'sem tipo'}${orig().slot ? ` · slot ${orig().slot}` : ''}${f.override ? (f.override.ativo === false ? ' · override DESLIGADO' : ' · tem override gravado') : ' · original'}`))),
      dis() ? el('div', { class: 'bib-alerta' }, 'Somente leitura neste servidor (produção): para editar, rode a Engine localmente, salve, faça commit e publique pelo deploy.') : null,
      el('div', { class: 'niv-fluxo' }, ['1 · Editar (na tela)', '2 · Pré-visualizar (impacto e Item Power)', '3 · Salvar (arquivo + Hot Reload local)', '4 · Publicar (commit + deploy)'].map((t, i) => el('span', { class: i === 0 ? 'ativa' : '' }, t))),
      el('div', { class: 'op-linha' }, el('b', { id: 'itm-contagem' }, 'sem alterações'), el('button', { type: 'button', id: 'itm-salvar', class: 'primario', disabled: true, onclick: salvar }, 'Salvar override'), el('button', { type: 'button', id: 'itm-descartar', disabled: true, onclick: descartar }, 'Descartar alterações'),
        el('button', { type: 'button', disabled: dis(), onclick: restaurarTudoNoRascunho, title: 'Volta todos os campos ao original no rascunho (ainda é preciso salvar)' }, 'Restaurar todos os campos'),
        el('button', { type: 'button', disabled: dis(), onclick: criarNovo, title: 'Cria um item novo (ID livre) como cópia deste, para editar à vontade' }, 'Criar item novo (duplicar)'),
        el('button', { type: 'button', class: 'perigo', disabled: dis() || !f.override, onclick: reverter }, f.novo ? 'Apagar este item novo' : 'Reverter ao original (gravado)'),
        f.override ? el('button', { type: 'button', disabled: dis(), onclick: alternarDeste }, f.override.ativo === false ? 'Ligar este override' : 'Desligar este override') : null),
      el('div', { class: 'eng-abas' }, ABAS.map(([id, n]) => el('button', { type: 'button', class: E.aba === id ? 'ativa' : '', onclick: () => { E.aba = id; pintarAba(); document.querySelectorAll('.eng-abas button').forEach((b) => b.classList.toggle('ativa', b.textContent === n)); } }, n))),
      el('div', { id: 'itm-aba', class: 'hunt-sec' }, corpo(E.aba)),
      el('section', { class: 'hunt-sec' }, el('h3', {}, 'Pré-visualização do impacto'), el('div', { id: 'itm-previa' })));
  }

  function pintar() {
    raiz().replaceChildren(
      cabecalho('Itens — editar', 'Edita o catálogo POR CIMA do dado importado do Canary: o original nunca é alterado. Salvar grava só as diferenças em gamedata/overrides/itens.json; no ambiente local o Hot Reload atualiza o catálogo em memória, e para valer na produção é commit + deploy. Só itens que já existem.',
        aoVoltar ? el('button', { type: 'button', onclick: aoVoltar }, '← Consultar na Biblioteca') : null,
        el('button', { type: 'button', onclick: alternarGlobal, title: 'Liga/desliga todos os overrides de itens' }, E.lista?.ativo === false ? 'Camada DESLIGADA — ligar' : 'Camada ligada — desligar')),
      el('div', { class: 'hunts-duas' }, listaLateral(), painel()));
    atualizarBarra();
    pintarPrevia();
    atualizarRapido();
  }

  return { desenhar, abrir: (_c, id) => desenhar(id), focarBusca: () => document.querySelector('#itm-lista input')?.focus(), sujoAgora: () => !!E.ficha && alterado(E.ov, E.ficha.override) };
}
