// O EDITOR DE MOBS da Engine: edita o bestiário POR CIMA do dado importado do Canary, sem tocar no original (camada de overrides:
// `systems/overrides.mjs`). Abas: Geral (nome, classe, vida, exp, armadura, velocidade), Resistências, Ataques, Loot, Sprite e Onde é usado. Cada campo mostra o ORIGINAL ao lado do valor
// efetivo e só vira override quando difere dele. Fluxo: editar (na tela) → pré-visualizar (servidor: erros, avisos, impacto) → salvar (arquivo, com
// versão anterior) → publicar (commit + deploy; o jogo aplica no boot). Toda regra é do servidor (`admin/overrides.mjs`).
import { el, cabecalho, confirmar, pedirTexto, msg, tratarConflito } from './editor-ui.mjs';
import { retrato } from './editor-sprites.mjs';
import { num } from './editor-drops.mjs';

const ESCALARES = [['name', 'Nome', 'text'], ['class', 'Classe', 'text'], ['stars', 'Estrelas (0–5)', 'number'], ['hp', 'Vida', 'number'], ['exp', 'Experiência', 'number'], ['armor', 'Armadura', 'number'], ['speed', 'Velocidade', 'number']];
const NOME_DO_ELEMENTO = { physical: 'Físico', energy: 'Energia', earth: 'Terra', fire: 'Fogo', lifedrain: 'Dreno de vida', manadrain: 'Dreno de mana', drown: 'Afogamento', ice: 'Gelo', holy: 'Sagrado', death: 'Morte', agony: 'Agonia' };
const ABAS = [['geral', 'Geral'], ['resist', 'Resistências'], ['ataques', 'Ataques'], ['loot', 'Loot'], ['sprite', 'Sprite'], ['usos', 'Onde é usado']];

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Define um campo no override mantendo-o MÍNIMO: se o valor novo é igual ao do original, o campo sai do override (volta ao original); senão entra.
 * `elements`: só as chaves que diferem do original. Devolve o override (muta e devolve o mesmo objeto). Pura.
 */
export function definirCampo(original, ov, campo, valor) {
  if (campo === 'elements') {
    const resto = {};
    for (const [e, v] of Object.entries(valor ?? {})) if (v !== (original.elements?.[e] ?? 0) || (original.elements?.[e] === undefined && v !== 0 && v !== undefined)) resto[e] = v;
    if (Object.keys(resto).length) ov.elements = resto; else delete ov.elements;
    return ov;
  }
  const o = original[campo];
  if (valor === undefined || valor === '' || igual(valor, o)) delete ov[campo]; else ov[campo] = valor;
  return ov;
}
/** O valor efetivo de um campo (override ou original). Pura. */
export const valorEfetivo = (original, ov, campo) => (ov[campo] !== undefined ? ov[campo] : original[campo]);
/** As resistências efetivas por elemento (original + override). Pura. */
export const resistenciasEfetivas = (original, ov) => ({ ...(original.elements ?? {}), ...(ov.elements ?? {}) });
/** Há alguma diferença a gravar? (ignora `ativo`, `base` e o nome de uma variação já existente) Pura. */
export const temDiferencas = (ov) => Object.keys(ov).some((c) => !['ativo'].includes(c));
/** O override em edição é diferente do que está gravado? (a base de uma variação já gravada não conta como alteração). Pura. */
export const alterado = (ov, gravado) => !igual({ ...ov, ativo: undefined }, { ...(gravado ?? {}), ativo: undefined });
/** O que mandar ao servidor: o override, ou `null` se não há nenhum. Pura. */
export const paraEnviar = (ov) => (Object.keys(ov).some((c) => c !== 'ativo') ? ov : null);

export function criarEditorDeMobs({ api, raiz, sujo = null, podeGravar = () => true, irPara = null, aoVoltar = null }) {
  const E = { q: '', filtro: '', lista: null, key: null, ficha: null, ov: {}, previa: null, aba: 'geral', buscaItens: [], pedido: 0 };
  const orig = () => E.ficha.original;

  async function desenhar(key = null) {
    E.lista = await api(`overrides/monstros?${new URLSearchParams({ q: E.q, filtro: E.filtro, limite: 120 })}`);
    if (key) await abrir(key, false);
    else if (!E.key) pintar();
    else pintar();
  }
  async function buscarLista() {
    E.lista = await api(`overrides/monstros?${new URLSearchParams({ q: E.q, filtro: E.filtro, limite: 120 })}`);
    document.getElementById('mob-lista')?.replaceWith(listaLateral());
  }
  async function abrir(key, repintar = true) {
    const f = await api(`overrides/monstros/${encodeURIComponent(key)}`);
    if (f?.ok === false || !f?.key) return msg('Monstro não encontrado.', 'erro');
    E.key = key;
    E.ficha = f;
    E.ov = structuredClone(f.override ?? {});
    E.previa = null;
    sujo?.limpar();
    history.replaceState(null, '', `#mobs/editar/${encodeURIComponent(key)}`);
    if (repintar !== false) pintar(); else pintar();
  }

  let esperando = null;
  function mudou() {
    sujo?.[alterado(E.ov, E.ficha.override) ? 'marcar' : 'limpar']();
    atualizarBarra();
    clearTimeout(esperando);
    esperando = setTimeout(previsualizar, 400);
  }
  async function previsualizar() {
    const meu = ++E.pedido;
    const r = await api('overrides/validar', { key: E.key, override: paraEnviar(E.ov) });
    if (meu !== E.pedido) return;
    E.previa = r;
    pintarPrevia();
  }
  async function salvar() {
    await previsualizar();
    if (E.previa?.erros?.length) return msg('Corrija os erros antes de salvar.', 'erro');
    if (!alterado(E.ov, E.ficha.override)) return msg('Nenhuma alteração para salvar.', 'aviso');
    const avisos = E.previa?.avisos?.length ?? 0;
    if (!(await confirmar(`Salvar as alterações de ${valorEfetivo(orig(), E.ov, 'name')}?`, `${avisos ? `${avisos} aviso(s) (veja a pré-visualização). ` : ''}Grava gamedata/overrides/monstros.json neste servidor (o original do Canary não é tocado). O jogo só aplica depois do commit + deploy.`, { ok: 'Salvar', perigo: avisos > 0 }))) return;
    const r = await api('overrides', { acao: 'salvar', key: E.key, override: paraEnviar(E.ov), revisao: E.ficha.revisao });
    if (await tratarConflito(r, () => abrir(E.key))) return;
    if (r.ok === false) return msg((r.erros ?? ['Não salvou.']).join(' '), 'erro');
    msg('Override salvo no arquivo. Publique com commit + deploy (o jogo aplica no boot).', 'ok');
    await abrir(E.key);
  }
  async function descartar() {
    if (alterado(E.ov, E.ficha.override) && !(await confirmar('Descartar as alterações?', 'Volta ao que está no arquivo. Nada foi gravado.', { ok: 'Descartar', perigo: true }))) return;
    await abrir(E.key);
  }
  async function reverter() {
    const tem = !!E.ficha.override;
    if (!tem) return msg('Este monstro não tem override gravado.', 'aviso');
    if (!(await confirmar(`Reverter ${valorEfetivo(orig(), E.ov, 'name')} ao original?`, E.ficha.ehVariacao ? 'É uma VARIAÇÃO: apagar remove o monstro (se não estiver em uso).' : 'Apaga o override gravado: o valor do Canary volta no próximo boot.', { ok: 'Reverter', perigo: true }))) return;
    const r = await api('overrides', { acao: 'reverter', key: E.key, revisao: E.ficha.revisao });
    if (await tratarConflito(r, () => abrir(E.key))) return;
    if (r.ok === false) return msg(r.erros.join(' '), 'erro');
    msg('Override apagado.', 'ok');
    if (E.ficha.ehVariacao) { E.key = null; E.ficha = null; await desenhar(); history.replaceState(null, '', '#mobs/editar'); } else await abrir(E.key);
  }
  /** Cria um mob NOVO como cópia de `base` (a chave aberta, ou uma que se digita): chave nova, nome e todos os campos do original; depois se edita (atributos, loot, ataques, sprite…). */
  async function criarMob() {
    let base = E.key;
    if (!base) {
      base = await pedirTexto('Criar mob novo', { rotulo: 'Chave do mob existente em que o novo se baseia (ex.: troll)', valor: '', validar: (v) => (v.trim() ? '' : 'Informe a chave de um mob existente.') });
      if (!base) return;
    }
    await duplicar(base.trim());
  }
  async function duplicar(base = E.key) {
    const nomeDaBase = base === E.key && E.ficha ? valorEfetivo(orig(), E.ov, 'name') : base;
    const novaKey = await pedirTexto(base === E.key && E.ficha ? 'Duplicar como variação' : 'Criar mob novo', { rotulo: 'Chave do mob novo (minúsculas, números e hífen)', valor: `${base}-novo`, validar: (v) => (/^[a-z0-9][a-z0-9-]{1,59}$/.test(v) ? '' : 'Use 2 a 60 caracteres: minúsculas, números e hífen.') });
    if (!novaKey) return;
    const revisao = base === E.key && E.ficha ? E.ficha.revisao : E.lista?.revisao;
    const r = await api('overrides', { acao: 'duplicar', key: base, novaKey, novoNome: `${nomeDaBase} (variação)`, revisao });
    if (await tratarConflito(r, () => (E.key ? abrir(E.key) : desenhar()))) return;
    if (r.ok === false) return msg(r.erros.join(' '), 'erro');
    msg(`Variação "${novaKey}" criada. Edite-a e coloque-a em um mapa para aparecer no jogo.`, 'ok');
    await desenhar(novaKey);
  }
  async function alternarDesteMonstro() {
    const ligado = E.ficha.override?.ativo !== false;
    const r = await api('overrides', { acao: 'ativo', ativo: !ligado, key: E.key, revisao: E.ficha.revisao });
    if (await tratarConflito(r, () => abrir(E.key))) return;
    if (r.ok === false) return msg(r.erros.join(' '), 'erro');
    msg(`Override de ${E.key} ${ligado ? 'desligado (o jogo usa o original)' : 'ligado'}.`, 'ok');
    await abrir(E.key);
  }
  async function alternarGlobal() {
    const ligar = !E.lista.ativo;
    if (!(await confirmar(ligar ? 'Ligar a camada de overrides?' : 'Desligar a camada de overrides?', ligar ? 'Os overrides gravados voltam a valer no próximo boot.' : 'O jogo ignora TODOS os overrides de monstros no próximo boot (nada é apagado).', { ok: ligar ? 'Ligar' : 'Desligar', perigo: !ligar }))) return;
    const r = await api('overrides', { acao: 'ativo', ativo: ligar, revisao: E.lista.revisao });
    if (await tratarConflito(r, () => desenhar(E.key))) return;
    if (r.ok === false) return msg(r.erros.join(' '), 'erro');
    await desenhar(E.key);
  }

  // ------------------------------------------------------------------ pintura
  const dis = () => !podeGravar();
  const origem = (texto) => el('small', { class: 'mob-original', title: 'Valor do original (Canary)' }, `original: ${texto}`);

  function campoEscalar([campo, rotulo, tipo]) {
    const v = valorEfetivo(orig(), E.ov, campo);
    const mudado = E.ov[campo] !== undefined;
    return el('label', { class: `campo mob-campo${mudado ? ' mudou' : ''}` }, rotulo,
      el('input', { type: tipo, value: v ?? '', disabled: dis(), onchange: (e) => { definirCampo(orig(), E.ov, campo, tipo === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value); mudou(); pintarAba(); } }),
      origem(orig()[campo] ?? '—'), mudado && !dis() ? el('button', { type: 'button', class: 'fantasma', onclick: () => { delete E.ov[campo]; mudou(); pintarAba(); } }, 'voltar ao original') : null);
  }
  function abaGeral() {
    return el('div', { class: 'grade' }, ESCALARES.map(campoEscalar));
  }
  function abaResist() {
    const ef = resistenciasEfetivas(orig(), E.ov);
    return el('div', {}, el('div', { class: 'dica' }, 'Resistência em % (100 = imune, negativo = fraco). Só as que diferem do original entram no override.'),
      el('div', { class: 'grade' }, E.ficha.elementos.map((e) => {
        const mudado = E.ov.elements?.[e] !== undefined;
        return el('label', { class: `campo mob-campo${mudado ? ' mudou' : ''}` }, NOME_DO_ELEMENTO[e] ?? e, el('input', { type: 'number', value: ef[e] ?? 0, min: -1000, max: 1000, disabled: dis(), onchange: (ev) => { const n = { ...ef, [e]: Number(ev.target.value) }; definirCampo(orig(), E.ov, 'elements', n); mudou(); pintarAba(); } }), origem(orig().elements?.[e] ?? 0));
      })));
  }
  function abaAtaques() {
    const ataques = E.ov.ataques ?? orig().ataques;
    const mudado = E.ov.ataques !== undefined;
    const comOriginal = (fn) => { const lista = structuredClone(E.ov.ataques ?? orig().ataques); fn(lista); E.ov.ataques = lista; if (igual(lista, orig().ataques)) delete E.ov.ataques; mudou(); pintarAba(); };
    return el('div', {}, el('div', { class: 'dica' }, 'Os ataques SUBSTITUEM os do original quando você muda qualquer um. Dano em pontos (min–max); chance em % por tentativa; intervalo em ms.'),
      mudado && !dis() ? el('button', { type: 'button', class: 'fantasma', onclick: () => { delete E.ov.ataques; mudou(); pintarAba(); } }, 'voltar aos ataques do original') : null,
      el('table', { class: 'mob-tabela' }, el('thead', {}, el('tr', {}, ['Tipo', 'Elemento', 'Mín', 'Máx', 'Intervalo (ms)', 'Chance %', ''].map((h) => el('th', {}, h)))),
        el('tbody', {}, ataques.map((a, i) => el('tr', {},
          el('td', {}, el('select', { disabled: dis(), onchange: (e) => comOriginal((l) => { l[i].tipo = e.target.value; if (e.target.value === 'melee') delete l[i].elemento; else l[i].elemento ??= 'physical'; }) }, ['melee', 'magia'].map((t) => el('option', { value: t, selected: a.tipo === t }, t)))),
          el('td', {}, a.tipo === 'magia' ? el('select', { disabled: dis(), onchange: (e) => comOriginal((l) => { l[i].elemento = e.target.value; }) }, E.ficha.elementos.map((x) => el('option', { value: x, selected: a.elemento === x }, NOME_DO_ELEMENTO[x] ?? x))) : '—'),
          ...['min', 'max', 'intervalo', 'chance'].map((c) => el('td', {}, el('input', { type: 'number', value: a[c] ?? '', disabled: dis(), onchange: (e) => comOriginal((l) => { l[i][c] = Number(e.target.value); }) }))),
          el('td', {}, dis() ? null : el('button', { type: 'button', class: 'fantasma', onclick: () => comOriginal((l) => l.splice(i, 1)) }, '✕')))))),
      dis() ? null : el('button', { type: 'button', onclick: () => comOriginal((l) => l.push({ tipo: 'melee', min: 0, max: 10, intervalo: 2000, chance: 100 })) }, '+ ataque'),
      el('h4', {}, 'Ataques do original'), el('div', { class: 'dica' }, orig().ataques.length ? orig().ataques.map((a) => `${a.tipo}${a.elemento ? ` ${a.elemento}` : ''} ${a.min}–${a.max} / ${a.intervalo} ms / ${a.chance}%`).join(' · ') : 'sem ataques cadastrados (usa o ataque padrão do jogo)'));
  }
  function abaLoot() {
    const loot = E.ov.loot ?? orig().loot ?? [];
    const mudado = E.ov.loot !== undefined;
    const trocar = (fn) => { const l = structuredClone(E.ov.loot ?? orig().loot ?? []); fn(l); E.ov.loot = l; if (igual(l.map(({ id, chance }) => ({ id, chance })), (orig().loot ?? []).map(({ id, chance }) => ({ id, chance })))) delete E.ov.loot; mudou(); pintarAba(); };
    // Busca ENQUANTO digita (sem esperar Enter), com o sprite ao lado; os itens já no loot também mostram o sprite.
    const pintarBusca = () => { const c = document.querySelector('#mob-busca-itens'); if (c) c.replaceChildren(...resultadosDaBusca()); };
    const buscar = (q) => { clearTimeout(E.tBusca); const t = q.trim(); if (t.length < 2) { E.buscaItens = []; pintarBusca(); return; } E.tBusca = setTimeout(async () => { const r = await api(`itens?q=${encodeURIComponent(t)}`); if (t === document.querySelector('#mob-busca-input')?.value.trim()) { E.buscaItens = r.itens; pintarBusca(); } }, 200); };
    const resultadosDaBusca = () => (E.buscaItens.length ? E.buscaItens.map((it) => el('div', { class: 'linha mob-resultado' }, retrato(it.desenho, 32, { categoria: 'itens', rotulo: it.name }), el('span', {}, `${it.name} #${it.id}`), el('button', { type: 'button', onclick: () => { E.buscaItens = []; E.desenhosDoLoot[String(it.id)] = it.desenho; document.querySelector('#mob-busca-input').value = ''; trocar((x) => x.push({ id: it.id, name: it.name, chance: 0.1 })); } }, '+ adicionar'))) : (document.querySelector('#mob-busca-input')?.value.trim().length >= 2 ? [el('div', { class: 'dica' }, 'Nenhum item encontrado.')] : []));
    E.desenhosDoLoot ??= {};
    const faltam = loot.map((l) => String(l.id)).filter((id) => !(id in E.desenhosDoLoot));
    if (faltam.length) { for (const id of faltam) E.desenhosDoLoot[id] = null; api(`itens?ids=${faltam.join(',')}`).then((r) => { for (const i of r.itens) E.desenhosDoLoot[String(i.id)] = i.desenho; if (E.aba === 'loot') pintarAba(); }).catch(() => {}); }
    return el('div', {}, el('div', { class: 'dica' }, 'O loot SUBSTITUI a lista do original quando você muda qualquer linha. A chance é uma fração (0,36 = 36%), por morte, por item.'),
      mudado && !dis() ? el('button', { type: 'button', class: 'fantasma', onclick: () => { delete E.ov.loot; mudou(); pintarAba(); } }, 'voltar ao loot do original') : null,
      el('table', { class: 'mob-tabela' }, el('thead', {}, el('tr', {}, ['Item', 'Chance (fração)', ''].map((h) => el('th', {}, h)))),
        el('tbody', {}, loot.map((l, i) => el('tr', {}, el('td', { class: 'mob-item-cel' }, retrato(E.desenhosDoLoot[String(l.id)], 32, { categoria: 'itens', rotulo: l.name }), el('span', {}, `${l.name ?? ''} #${l.id}`)), el('td', {}, el('input', { type: 'number', step: 'any', min: 0, max: 1, value: l.chance, disabled: dis(), onchange: (e) => trocar((x) => { x[i].chance = Number(e.target.value); }) })), el('td', {}, dis() ? null : el('button', { type: 'button', class: 'fantasma', onclick: () => trocar((x) => x.splice(i, 1)) }, '✕')))))),
      dis() ? null : el('div', { class: 'linha' }, el('input', { id: 'mob-busca-input', autocomplete: 'off', placeholder: 'buscar item (nome ou ID) para adicionar', oninput: (e) => buscar(e.target.value) })),
      el('div', { id: 'mob-busca-itens', class: 'linhas' }, resultadosDaBusca()));
  }
  function abaSprite() {
    const look = valorEfetivo(orig(), E.ov, 'look');
    return el('div', { class: 'mob-sprite' }, retrato(look ? { tipo: 'criatura', look, cores: valorEfetivo(orig(), E.ov, 'colors') ?? orig().colors } : null, 160, { categoria: 'monstros', imediato: true }),
      el('div', {}, irPara && look ? el('button', { type: 'button', class: 'primario', onclick: () => irPara('sprites', null, [String(look)]) }, 'Abrir no editor de sprites (quadros e animação)') : null, el('div', { class: 'dica' }, 'O sprite é um desenho que já existe no jogo (look). Informe o número de outro monstro ou outfit para trocar a aparência.'),
        el('label', { class: `campo mob-campo${E.ov.look !== undefined ? ' mudou' : ''}` }, 'Look (sprite)', el('input', { type: 'number', value: look ?? '', disabled: dis(), onchange: (e) => { definirCampo(orig(), E.ov, 'look', e.target.value === '' ? undefined : Number(e.target.value)); mudou(); pintarAba(); } }), origem(orig().look ?? '—'))));
  }
  function abaUsos() {
    const u = E.ficha.usos;
    return u.length ? el('ul', { class: 'op-lista' }, u.map((x) => el('li', {}, `${x.nome ?? x.id} `, el('small', { class: 'dica' }, x.categoria ?? x.tipo ?? '')))) : el('div', { class: 'dica' }, 'Não é usado em nenhuma hunt, mapa ou boss.');
  }
  const CORPO = { geral: abaGeral, resist: abaResist, ataques: abaAtaques, loot: abaLoot, sprite: abaSprite, usos: abaUsos };
  function pintarAba() { document.getElementById('mob-aba')?.replaceChildren(CORPO[E.aba]()); }

  function pintarPrevia() {
    const caixa = document.getElementById('mob-previa');
    if (!caixa) return;
    const p = E.previa;
    caixa.replaceChildren(
      !p || (!p.mudancas?.length && !p.erros?.length) ? el('div', { class: 'dica' }, 'Edite um campo: a pré-visualização mostra erros, avisos e o impacto antes de qualquer gravação.') : null,
      p?.erros?.length ? el('ul', { class: 'problemas' }, p.erros.map((x) => el('li', { class: 'erro' }, `✖ ${x}`))) : null,
      p?.avisos?.length ? el('ul', { class: 'problemas' }, p.avisos.map((x) => el('li', { class: 'aviso' }, `⚠ ${x}`))) : null,
      p?.mudancas?.length ? el('table', { class: 'bib-sub niv-impacto' }, el('thead', {}, el('tr', {}, ['Campo', 'Original', 'Efetivo', 'Variação'].map((h) => el('th', {}, h)))),
        el('tbody', {}, p.mudancas.map((m) => { const v = m.valorEsperado?.variacaoPct ?? m.danoPorSegundo?.variacaoPct ?? m.variacaoPct; const f = (x) => (typeof x === 'object' ? (Array.isArray(x) ? `${x.length} linha(s)` : JSON.stringify(x)) : String(x ?? '—')); return el('tr', {}, el('td', {}, m.campo === 'ataques' && m.danoPorSegundo ? 'ataques (dano/s)' : m.campo), el('td', {}, m.danoPorSegundo ? num(m.danoPorSegundo.antes, 0) : m.valorEsperado ? `${num(m.valorEsperado.antes, 0)} (valor do loot)` : f(m.antes)), el('td', {}, m.danoPorSegundo ? num(m.danoPorSegundo.depois, 0) : m.valorEsperado ? `${num(m.valorEsperado.depois, 0)} (valor do loot)` : f(m.depois)), el('td', { class: v != null && Math.abs(v) >= 25 ? 'niv-forte' : '' }, v != null ? `${v > 0 ? '+' : ''}${v}%` : '—')); }))) : null,
      p && p.mudancas?.length && !p.erros?.length && !p.avisos?.length ? el('div', { class: 'selo ok' }, 'Sem erros nem avisos') : null);
  }
  function atualizarBarra() {
    const s = document.getElementById('mob-salvar');
    if (s) s.disabled = !alterado(E.ov, E.ficha.override) || dis();
    const d = document.getElementById('mob-descartar');
    if (d) d.disabled = !alterado(E.ov, E.ficha.override);
    const c = document.getElementById('mob-contagem');
    if (c) c.textContent = alterado(E.ov, E.ficha.override) ? 'alterações não salvas' : 'sem alterações';
  }

  function listaLateral() {
    const itens = E.lista?.itens ?? [];
    return el('aside', { class: 'hunts-lista', id: 'mob-lista' },
      el('input', { type: 'search', placeholder: 'buscar monstro…', value: E.q, oninput: (e) => { E.q = e.target.value; buscarListaComEspera(); } }),
      el('button', { type: 'button', class: 'primario', disabled: dis(), onclick: criarMob, title: 'Cria um mob novo como cópia de um existente (o aberto, ou o que você digitar)' }, '+ Criar mob (duplicar)'),
      el('div', { class: 'hunts-cats' }, [['', 'Todos'], ['com-override', `Com override (${E.lista?.comOverride ?? 0})`]].map(([id, n]) => el('button', { type: 'button', class: E.filtro === id ? 'ativa' : '', onclick: () => { E.filtro = id; buscarLista(); } }, n))),
      el('div', { class: 'hunts-itens' }, itens.map((m) => el('button', { type: 'button', class: `hunts-item mob-item${m.key === E.key ? ' ativa' : ''}`, onclick: () => abrir(m.key) }, retrato(m.desenho, 32, { categoria: 'monstros', rotulo: m.nome }), el('span', {}, el('b', {}, m.nome), el('small', {}, `${m.key}${m.variacaoDe ? ` · variação de ${m.variacaoDe}` : ''}${m.temOverride ? (m.ativo === false ? ' · override desligado' : ' · com override') : ''}`))))),
      el('div', { class: 'dica' }, `${E.lista?.total ?? 0} monstro(s)`));
  }
  let esperaLista = null;
  const buscarListaComEspera = () => { clearTimeout(esperaLista); esperaLista = setTimeout(buscarLista, 250); };

  function painel() {
    const f = E.ficha;
    if (!f) return el('div', { class: 'bib-painel-vazio' }, 'Escolha um monstro à esquerda para editar. As alterações ficam num arquivo de overrides — o original do Canary nunca é tocado.');
    const nome = valorEfetivo(orig(), E.ov, 'name');
    return el('div', { class: 'hunt-painel' },
      el('div', { class: 'hunt-topo' }, retrato(f.desenho, 64, { categoria: 'monstros', imediato: true }), el('div', {}, el('h2', {}, nome), el('div', { class: 'dica' }, `${f.key}${f.ehVariacao ? ` · variação de ${f.base}` : ''}${f.override ? (f.override.ativo === false ? ' · override DESLIGADO' : ' · tem override gravado') : ' · original'}`))),
      !podeGravar() ? el('div', { class: 'bib-alerta' }, 'Somente leitura neste servidor (produção): para editar, rode a Engine localmente, salve, faça commit e publique pelo deploy.') : null,
      el('div', { class: 'niv-fluxo' }, ['1 · Editar (na tela)', '2 · Pré-visualizar (impacto)', '3 · Salvar (arquivo)', '4 · Publicar (commit + deploy)'].map((t, i) => el('span', { class: i === 0 ? 'ativa' : '' }, t))),
      el('div', { class: 'op-linha' }, el('b', { id: 'mob-contagem' }, 'sem alterações'), el('button', { type: 'button', id: 'mob-salvar', class: 'primario', disabled: true, onclick: salvar }, 'Salvar override'), el('button', { type: 'button', id: 'mob-descartar', disabled: true, onclick: descartar }, 'Descartar alterações'),
        el('button', { type: 'button', disabled: dis(), onclick: duplicar }, 'Duplicar como variação'),
        el('button', { type: 'button', class: 'perigo', disabled: dis() || !f.override, onclick: reverter }, f.ehVariacao ? 'Apagar variação' : 'Reverter ao original'),
        f.override ? el('button', { type: 'button', disabled: dis(), onclick: alternarDesteMonstro }, f.override.ativo === false ? 'Ligar este override' : 'Desligar este override') : null),
      el('div', { class: 'eng-abas' }, ABAS.map(([id, n]) => el('button', { type: 'button', class: E.aba === id ? 'ativa' : '', onclick: () => { E.aba = id; pintarAba(); document.querySelectorAll('.eng-abas button').forEach((b) => b.classList.toggle('ativa', b.textContent === n)); } }, n))),
      el('div', { id: 'mob-aba', class: 'hunt-sec' }, CORPO[E.aba]()),
      el('section', { class: 'hunt-sec' }, el('h3', {}, 'Pré-visualização do impacto'), el('div', { id: 'mob-previa' })));
  }

  function pintar() {
    raiz().replaceChildren(
      cabecalho('Mobs — editar', 'Edita o bestiário POR CIMA do dado importado do Canary: o original nunca é alterado. Salvar grava só as diferenças em gamedata/overrides/monstros.json; o jogo aplica no boot (commit + deploy).',
        aoVoltar ? el('button', { type: 'button', onclick: aoVoltar }, '← Consultar na Biblioteca') : null,
        el('button', { type: 'button', onclick: alternarGlobal, title: 'Liga/desliga todos os overrides de monstros no próximo boot' }, E.lista?.ativo === false ? 'Camada DESLIGADA — ligar' : 'Camada ligada — desligar')),
      el('div', { class: 'hunts-duas' }, listaLateral(), painel()));
    atualizarBarra();
    pintarPrevia();
  }

  return { desenhar, abrir: (_c, key) => desenhar(key), focarBusca: () => document.querySelector('#mob-lista input')?.focus(), sujoAgora: () => !!E.ficha && alterado(E.ov, E.ficha.override) };
}
