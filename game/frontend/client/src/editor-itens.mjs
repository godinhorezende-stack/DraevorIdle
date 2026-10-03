// O EDITOR DE ITENS da Engine: edita o catálogo POR CIMA do dado importado do Canary (camada de overrides: `systems/overrides.mjs`,
// `admin/overrides-itens.mjs`), sem tocar no original. Abas: Geral (nome, raridade-base, peso, level mínimo), Combate (ataque, defesa, armadura),
// Preços (compra e venda) e Onde é usado. Cada campo mostra o ORIGINAL ao lado e só vira override quando difere dele. Fluxo igual ao dos mobs:
// editar → pré-visualizar (servidor: erros, avisos, impacto) → salvar (arquivo + versão anterior) → publicar (commit + deploy). Regras: servidor.
import { el, cabecalho, confirmar, msg, tratarConflito } from './editor-ui.mjs';
import { retrato } from './editor-sprites.mjs';
import { definirCampo, valorEfetivo, alterado, paraEnviar } from './editor-mobs.mjs';

const ABAS = [['geral', 'Geral'], ['combate', 'Combate'], ['precos', 'Preços'], ['usos', 'Onde é usado']];
const CAMPOS = {
  geral: [['name', 'Nome', 'text'], ['rarity', 'Raridade-base', 'select'], ['weight', 'Peso', 'number'], ['minLevel', 'Level mínimo', 'number'], ['imbuementSlots', 'Slots de imbuement', 'number']],
  combate: [['attack', 'Ataque', 'number'], ['defense', 'Defesa', 'number'], ['armor', 'Armadura', 'number']],
  precos: [['buy', 'Preço de compra (NPC)', 'number'], ['sell', 'Preço de venda (NPC)', 'number']],
};

export function criarEditorDeItens({ api, raiz, sujo = null, podeGravar = () => true, aoVoltar = null }) {
  const E = { q: '', filtro: '', slot: '', lista: null, id: null, ficha: null, ov: {}, previa: null, aba: 'geral', pedido: 0 };
  const orig = () => E.ficha.original;
  const dis = () => !podeGravar();
  const params = () => new URLSearchParams({ q: E.q, filtro: E.filtro, slot: E.slot, limite: 120 });

  async function desenhar(id = null) {
    E.lista = await api(`overrides/itens?${params()}`);
    if (id) await abrir(id);
    else pintar();
  }
  async function buscarLista() {
    E.lista = await api(`overrides/itens?${params()}`);
    document.getElementById('itm-lista')?.replaceWith(listaLateral());
  }
  async function abrir(id) {
    const f = await api(`overrides/itens/${encodeURIComponent(id)}`);
    if (f?.ok === false || !f?.id) return msg('Item não encontrado.', 'erro');
    E.id = String(id);
    E.ficha = f;
    E.ov = structuredClone(f.override ?? {});
    E.previa = null;
    sujo?.limpar();
    history.replaceState(null, '', `#itens/editar/${encodeURIComponent(id)}`);
    pintar();
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
    const r = await api('overrides/itens/validar', { id: E.id, override: paraEnviar(E.ov) });
    if (meu !== E.pedido) return;
    E.previa = r;
    pintarPrevia();
  }
  async function salvar() {
    await previsualizar();
    if (E.previa?.erros?.length) return msg('Corrija os erros antes de salvar.', 'erro');
    if (!alterado(E.ov, E.ficha.override)) return msg('Nenhuma alteração para salvar.', 'aviso');
    const avisos = E.previa?.avisos?.length ?? 0;
    if (!(await confirmar(`Salvar as alterações de ${valorEfetivo(orig(), E.ov, 'name')}?`, `${avisos ? `${avisos} aviso(s) (veja a pré-visualização). ` : ''}Grava gamedata/overrides/itens.json neste servidor (o catálogo do Canary não é tocado). O jogo só aplica depois do commit + deploy.`, { ok: 'Salvar', perigo: avisos > 0 }))) return;
    const r = await api('overrides/itens', { acao: 'salvar', id: E.id, override: paraEnviar(E.ov), revisao: E.ficha.revisao });
    if (await tratarConflito(r, () => abrir(E.id))) return;
    if (r.ok === false) return msg((r.erros ?? ['Não salvou.']).join(' '), 'erro');
    msg('Override salvo no arquivo. Publique com commit + deploy (o jogo aplica no boot).', 'ok');
    await abrir(E.id);
  }
  async function descartar() {
    if (alterado(E.ov, E.ficha.override) && !(await confirmar('Descartar as alterações?', 'Volta ao que está no arquivo. Nada foi gravado.', { ok: 'Descartar', perigo: true }))) return;
    await abrir(E.id);
  }
  async function reverter() {
    if (!E.ficha.override) return msg('Este item não tem override gravado.', 'aviso');
    if (!(await confirmar(`Reverter ${valorEfetivo(orig(), E.ov, 'name')} ao original?`, 'Apaga o override gravado: o valor do Canary volta no próximo boot.', { ok: 'Reverter', perigo: true }))) return;
    const r = await api('overrides/itens', { acao: 'reverter', id: E.id, revisao: E.ficha.revisao });
    if (await tratarConflito(r, () => abrir(E.id))) return;
    if (r.ok === false) return msg(r.erros.join(' '), 'erro');
    msg('Override apagado.', 'ok');
    await abrir(E.id);
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
    if (!(await confirmar(ligar ? 'Ligar a camada de overrides de itens?' : 'Desligar a camada de overrides de itens?', ligar ? 'Os overrides gravados voltam a valer no próximo boot.' : 'O jogo ignora TODOS os overrides de itens no próximo boot (nada é apagado).', { ok: ligar ? 'Ligar' : 'Desligar', perigo: !ligar }))) return;
    const r = await api('overrides/itens', { acao: 'ativo', ativo: ligar, revisao: E.lista.revisao });
    if (await tratarConflito(r, () => desenhar(E.id))) return;
    if (r.ok === false) return msg(r.erros.join(' '), 'erro');
    await desenhar(E.id);
  }

  function campo([c, rotulo, tipo]) {
    const v = valorEfetivo(orig(), E.ov, c);
    const mudado = E.ov[c] !== undefined;
    const entrada = tipo === 'select'
      ? el('select', { disabled: dis(), onchange: (e) => { definirCampo(orig(), E.ov, c, e.target.value); mudou(); pintarAba(); } }, E.ficha.rarezas.map((r) => el('option', { value: r, selected: r === v }, r)))
      : el('input', { type: tipo, value: v ?? '', step: tipo === 'number' ? 'any' : null, disabled: dis(), onchange: (e) => { definirCampo(orig(), E.ov, c, tipo === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value); mudou(); pintarAba(); } });
    return el('label', { class: `campo mob-campo${mudado ? ' mudou' : ''}` }, rotulo, entrada, el('small', { class: 'mob-original' }, `original: ${orig()[c] ?? '—'}`),
      mudado && !dis() ? el('button', { type: 'button', class: 'fantasma', onclick: () => { delete E.ov[c]; mudou(); pintarAba(); } }, 'voltar ao original') : null);
  }
  const corpo = (aba) => {
    if (aba === 'usos') return E.ficha.usos.length ? el('ul', { class: 'op-lista' }, E.ficha.usos.map((x) => el('li', {}, `${x.nome ?? x.id} `, el('small', { class: 'dica' }, x.categoria ?? x.tipo ?? '')))) : el('div', { class: 'dica' }, 'Este item não é usado em nenhuma hunt, boss ou encontro.');
    const extra = aba === 'combate' && !E.ficha.equipamento ? el('div', { class: 'dica' }, 'Este item não é um equipamento: ataque, defesa e armadura só fazem efeito onde o jogo lê esses campos.') : null;
    return el('div', {}, extra, el('div', { class: 'grade' }, CAMPOS[aba].map(campo)));
  };
  function pintarAba() { document.getElementById('itm-aba')?.replaceChildren(corpo(E.aba)); }

  function pintarPrevia() {
    const caixa = document.getElementById('itm-previa');
    if (!caixa) return;
    const p = E.previa;
    caixa.replaceChildren(
      !p || (!p.mudancas?.length && !p.erros?.length) ? el('div', { class: 'dica' }, 'Edite um campo: a pré-visualização mostra erros, avisos e o impacto antes de qualquer gravação.') : null,
      p?.erros?.length ? el('ul', { class: 'problemas' }, p.erros.map((x) => el('li', { class: 'erro' }, `✖ ${x}`))) : null,
      p?.avisos?.length ? el('ul', { class: 'problemas' }, p.avisos.map((x) => el('li', { class: 'aviso' }, `⚠ ${x}`))) : null,
      p?.mudancas?.length ? el('table', { class: 'bib-sub niv-impacto' }, el('thead', {}, el('tr', {}, ['Campo', 'Original', 'Efetivo', 'Variação'].map((h) => el('th', {}, h)))),
        el('tbody', {}, p.mudancas.map((m) => el('tr', {}, el('td', {}, m.campo), el('td', {}, String(m.antes ?? '—')), el('td', {}, String(m.depois ?? '—')), el('td', { class: m.variacaoPct != null && Math.abs(m.variacaoPct) >= 25 ? 'niv-forte' : '' }, m.variacaoPct != null ? `${m.variacaoPct > 0 ? '+' : ''}${m.variacaoPct}%` : '—'))))) : null,
      p && p.mudancas?.length && !p.erros?.length && !p.avisos?.length ? el('div', { class: 'selo ok' }, 'Sem erros nem avisos') : null);
  }
  function atualizarBarra() {
    const s = document.getElementById('itm-salvar');
    if (s) s.disabled = !alterado(E.ov, E.ficha.override) || dis();
    const d = document.getElementById('itm-descartar');
    if (d) d.disabled = !alterado(E.ov, E.ficha.override);
    const c = document.getElementById('itm-contagem');
    if (c) c.textContent = alterado(E.ov, E.ficha.override) ? 'alterações não salvas' : 'sem alterações';
  }

  function listaLateral() {
    const itens = E.lista?.itens ?? [];
    const slots = ['', 'weapon', 'head', 'body', 'legs', 'feet', 'shield', 'neck', 'ring', 'backpack', 'ammo'];
    let espera = null;
    return el('aside', { class: 'hunts-lista', id: 'itm-lista' },
      el('input', { type: 'search', placeholder: 'buscar item (2+ letras)…', value: E.q, oninput: (e) => { E.q = e.target.value; clearTimeout(espera); espera = setTimeout(buscarLista, 250); } }),
      el('div', { class: 'hunts-cats' }, [['', 'Busca'], ['com-override', `Com override (${E.lista?.comOverride ?? 0})`]].map(([id, n]) => el('button', { type: 'button', class: E.filtro === id ? 'ativa' : '', onclick: () => { E.filtro = id; buscarLista(); } }, n))),
      el('select', { onchange: (e) => { E.slot = e.target.value; buscarLista(); } }, slots.map((s) => el('option', { value: s, selected: s === E.slot }, s || 'todos os slots'))),
      el('div', { class: 'hunts-itens' }, itens.map((m) => el('button', { type: 'button', class: `hunts-item mob-item${m.id === E.id ? ' ativa' : ''}`, onclick: () => abrir(m.id) }, retrato(m.desenho, 32, { categoria: 'itens', rotulo: m.nome }), el('span', {}, el('b', {}, m.nome), el('small', {}, `#${m.id} · ${m.tipo ?? 'sem tipo'}${m.temOverride ? (m.ativo === false ? ' · override desligado' : ' · com override') : ''}`))))),
      E.lista?.dica ? el('div', { class: 'dica' }, E.lista.dica) : el('div', { class: 'dica' }, `${E.lista?.total ?? 0} item(ns)`));
  }

  function painel() {
    const f = E.ficha;
    if (!f) return el('div', { class: 'bib-painel-vazio' }, 'Busque um item à esquerda para editar. As alterações ficam num arquivo de overrides — o catálogo do Canary nunca é tocado.');
    return el('div', { class: 'hunt-painel' },
      el('div', { class: 'hunt-topo' }, retrato(f.desenho, 64, { categoria: 'itens', imediato: true }), el('div', {}, el('h2', {}, valorEfetivo(orig(), E.ov, 'name')), el('div', { class: 'dica' }, `#${f.id} · ${orig().type ?? 'sem tipo'}${orig().slot ? ` · slot ${orig().slot}` : ''}${f.override ? (f.override.ativo === false ? ' · override DESLIGADO' : ' · tem override gravado') : ' · original'}`))),
      dis() ? el('div', { class: 'bib-alerta' }, 'Somente leitura neste servidor (produção): para editar, rode a Engine localmente, salve, faça commit e publique pelo deploy.') : null,
      el('div', { class: 'niv-fluxo' }, ['1 · Editar (na tela)', '2 · Pré-visualizar (impacto)', '3 · Salvar (arquivo)', '4 · Publicar (commit + deploy)'].map((t, i) => el('span', { class: i === 0 ? 'ativa' : '' }, t))),
      el('div', { class: 'op-linha' }, el('b', { id: 'itm-contagem' }, 'sem alterações'), el('button', { type: 'button', id: 'itm-salvar', class: 'primario', disabled: true, onclick: salvar }, 'Salvar override'), el('button', { type: 'button', id: 'itm-descartar', disabled: true, onclick: descartar }, 'Descartar alterações'),
        el('button', { type: 'button', class: 'perigo', disabled: dis() || !f.override, onclick: reverter }, 'Reverter ao original'),
        f.override ? el('button', { type: 'button', disabled: dis(), onclick: alternarDeste }, f.override.ativo === false ? 'Ligar este override' : 'Desligar este override') : null),
      el('div', { class: 'eng-abas' }, ABAS.map(([id, n]) => el('button', { type: 'button', class: E.aba === id ? 'ativa' : '', onclick: () => { E.aba = id; pintarAba(); document.querySelectorAll('.eng-abas button').forEach((b) => b.classList.toggle('ativa', b.textContent === n)); } }, n))),
      el('div', { id: 'itm-aba', class: 'hunt-sec' }, corpo(E.aba)),
      el('section', { class: 'hunt-sec' }, el('h3', {}, 'Pré-visualização do impacto'), el('div', { id: 'itm-previa' })));
  }

  function pintar() {
    raiz().replaceChildren(
      cabecalho('Itens — editar', 'Edita o catálogo POR CIMA do dado importado do Canary: o original nunca é alterado. Salvar grava só as diferenças em gamedata/overrides/itens.json; o jogo aplica no boot (commit + deploy). Só itens que já existem.',
        aoVoltar ? el('button', { type: 'button', onclick: aoVoltar }, '← Consultar na Biblioteca') : null,
        el('button', { type: 'button', onclick: alternarGlobal, title: 'Liga/desliga todos os overrides de itens no próximo boot' }, E.lista?.ativo === false ? 'Camada DESLIGADA — ligar' : 'Camada ligada — desligar')),
      el('div', { class: 'hunts-duas' }, listaLateral(), painel()));
    atualizarBarra();
    pintarPrevia();
  }

  return { desenhar, abrir: (_c, id) => desenhar(id), focarBusca: () => document.querySelector('#itm-lista input')?.focus(), sujoAgora: () => !!E.ficha && alterado(E.ov, E.ficha.override) };
}
