// A vista "Níveis da campanha" de Hunts e áreas: o level original e os levels alvo (Normal/Cruel/Merciless) de cada fase e boss de ato, mais a fase
// travada. É BALANCEAMENTO e PROGRESSÃO, então o fluxo é em quatro tempos e a tela mostra cada um: EDITAR (só aqui, na tela) → PRÉ-VISUALIZAR (o
// servidor devolve erros, avisos e o impacto na vida/dano/exp, sem gravar) → SALVAR (grava `gamedata/campanha.json`, com a cópia da versão
// anterior) → PUBLICAR (commit + deploy; o jogo lê no boot). Toda regra é do servidor (`admin/campanha-editor.mjs`); a tela só edita e apresenta.
import { el, cabecalho, confirmar, msg, tratarConflito } from './editor-ui.mjs';
import { num } from './editor-drops.mjs';

const DIFS = [['facil', 'Normal'], ['medio', 'Cruel'], ['dificil', 'Merciless']];

/** As edições locais viram o PROPOSTO que o servidor entende (só o que mudou). Pura. */
export function propostoDasEdicoes(original, edicoes) {
  const fases = [];
  for (const f of edicoes.fases) {
    const o = original.fases.find((x) => x.huntId === f.huntId);
    const p = { huntId: f.huntId };
    if (f.levelOriginal !== o.levelOriginal) p.levelOriginal = f.levelOriginal;
    const nivel = {};
    for (const [d] of DIFS) if (f.nivel[d] !== o.nivel[d]) nivel[d] = f.nivel[d];
    if (Object.keys(nivel).length) p.nivel = nivel;
    if (f.pular !== o.pular) p.pular = f.pular;
    if (Object.keys(p).length > 1) fases.push(p);
  }
  const bosses = [];
  for (const b of edicoes.bosses) {
    const o = original.bosses.find((x) => x.ato === b.ato);
    const p = { ato: b.ato };
    if (b.levelOriginal !== o.levelOriginal) p.levelOriginal = b.levelOriginal;
    const nivel = {};
    for (const [d] of DIFS) if (b.nivel[d] !== o.nivel[d]) nivel[d] = b.nivel[d];
    if (Object.keys(nivel).length) p.nivel = nivel;
    if (Object.keys(p).length > 1) bosses.push(p);
  }
  return { fases, bosses };
}

export function criarEditorDeNiveis({ api, raiz, sujo, aoVoltar, podeGravar = () => true }) {
  const N = { original: null, edicoes: null, previa: null, foco: null, versoes: [], pedido: 0 };

  const copiar = (d) => ({ fases: d.fases.map((f) => ({ ...f, nivel: { ...f.nivel } })), bosses: d.bosses.map((b) => ({ ...b, nivel: { ...b.nivel } })) });
  const proposto = () => propostoDasEdicoes(N.original, N.edicoes);
  const total = () => { const p = proposto(); return p.fases.length + p.bosses.length; };

  async function desenhar(foco = null) {
    N.original = await api('campanha');
    N.edicoes = copiar(N.original);
    N.versoes = (await api('campanha/versoes')).versoes;
    N.previa = null;
    N.foco = foco;
    sujo?.limpar();
    pintar();
    if (foco) document.getElementById(`niv-${foco}`)?.scrollIntoView({ block: 'center' });
  }

  let esperando = null;
  function mudou() {
    sujo?.[total() ? 'marcar' : 'limpar']();
    atualizarContagem();
    clearTimeout(esperando);
    esperando = setTimeout(previsualizar, 400); // a pré-visualização acompanha a edição (só leitura, nada é gravado)
  }
  async function previsualizar() {
    if (!total()) { N.previa = null; return pintarPrevia(); }
    const meu = ++N.pedido;
    const r = await api('campanha/validar', proposto());
    if (meu !== N.pedido) return;
    N.previa = r;
    pintarPrevia();
  }
  async function salvar() {
    if (!total()) return msg('Nenhuma alteração para salvar.', 'aviso');
    await previsualizar();
    if (N.previa?.erros?.length) return msg('Corrija os erros antes de salvar.', 'erro');
    const avisos = N.previa?.avisos?.length ?? 0;
    const ok = await confirmar('Salvar os níveis da campanha?', `${total()} alteração(ões). ${avisos ? `${avisos} aviso(s) de balanceamento/progressão (veja a pré-visualização). ` : ''}Grava gamedata/campanha.json neste servidor, guardando a versão anterior. O jogo só passa a usar depois do commit + deploy.`, { ok: 'Salvar', perigo: avisos > 0 });
    if (!ok) return;
    const r = await api('campanha', { ...proposto(), revisao: N.original.revisao });
    if (await tratarConflito(r, () => desenhar(N.foco))) return;
    if (r.ok === false) return msg((r.erros ?? ['Não salvou.']).join(' '), 'erro');
    msg(r.semMudancas ? 'Nada mudou.' : 'Níveis salvos no arquivo. Publique com commit + deploy (o jogo lê a campanha no boot).', 'ok');
    await desenhar(N.foco);
  }
  async function descartar() {
    if (total() && !(await confirmar('Descartar as alterações?', 'Os valores voltam aos do arquivo. Nada foi gravado.', { ok: 'Descartar', perigo: true }))) return;
    await desenhar(N.foco);
  }
  async function restaurar(v) {
    if (!(await confirmar(`Restaurar a versão ${v}?`, 'Grava o conteúdo dela como a campanha atual (a atual fica guardada como versão nova). O jogo só usa depois do deploy.', { ok: 'Restaurar', perigo: true }))) return;
    const r = await api('campanha/restaurar', { versao: v, revisao: N.original.revisao });
    if (await tratarConflito(r, () => desenhar())) return;
    if (r.ok === false) return msg(r.erros.join(' '), 'erro');
    msg(`Versão ${v} restaurada.`, 'ok');
    await desenhar();
  }

  // ------------------------------------------------------------------ pintura
  const campo = (valor, original, aoMudar, titulo) => el('input', { type: 'number', min: 1, max: 5000, value: valor, title: titulo ?? '', class: valor !== original ? 'niv-mudou' : '', disabled: !podeGravar(), onchange: (e) => { aoMudar(Number(e.target.value)); e.target.classList.toggle('niv-mudou', Number(e.target.value) !== original); mudou(); } });

  function linhaDeFase(f) {
    const o = N.original.fases.find((x) => x.huntId === f.huntId);
    return el('tr', { id: `niv-${f.huntId}`, class: f.huntId === N.foco ? 'foco' : '' },
      el('td', {}, f.indice + 1), el('td', {}, el('b', {}, f.nome), el('small', {}, f.huntId)),
      el('td', {}, campo(f.levelOriginal, o.levelOriginal, (v) => { f.levelOriginal = v; }, 'level do bicho no cadastro (a base da escala)')),
      ...DIFS.map(([d]) => el('td', {}, campo(f.nivel[d], o.nivel[d], (v) => { f.nivel[d] = v; }, 'level alvo: os bichos são escalados para ele'))),
      el('td', {}, el('input', { type: 'checkbox', checked: f.pular, disabled: !podeGravar(), title: 'Fase travada: ninguém entra e ela conta como completa', onchange: (e) => { f.pular = e.target.checked; mudou(); } })));
  }
  function linhaDeBoss(b) {
    const o = N.original.bosses.find((x) => x.ato === b.ato);
    return el('tr', { class: 'niv-boss' }, el('td', {}, '♛'), el('td', {}, el('b', {}, `Boss do Ato ${b.ato}`), el('small', {}, `${b.nome} · ${b.bossId}`)),
      el('td', {}, campo(b.levelOriginal, o.levelOriginal, (v) => { b.levelOriginal = v; })), ...DIFS.map(([d]) => el('td', {}, campo(b.nivel[d], o.nivel[d], (v) => { b.nivel[d] = v; }))), el('td', {}));
  }
  function tabelaDoAto(ato) {
    return el('section', { class: 'hunt-sec' }, el('h3', {}, `Ato ${ato}`),
      el('table', { class: 'niv-tabela' }, el('thead', {}, el('tr', {}, ['#', 'Fase', 'Level original', ...DIFS.map(([, n]) => `Alvo ${n}`), 'Travada'].map((h) => el('th', {}, h)))),
        el('tbody', {}, N.edicoes.fases.filter((f) => f.ato === ato).map(linhaDeFase), N.edicoes.bosses.filter((b) => b.ato === ato).map(linhaDeBoss))));
  }

  function pintarPrevia() {
    const caixa = document.getElementById('niv-previa');
    if (!caixa) return;
    const p = N.previa;
    caixa.replaceChildren(
      !total() ? el('div', { class: 'dica' }, 'Edite os valores acima: a pré-visualização mostra erros, avisos e o impacto na vida, dano e experiência dos bichos antes de qualquer gravação.') : null,
      p?.erros?.length ? el('ul', { class: 'problemas' }, p.erros.map((e) => el('li', { class: 'erro' }, `✖ ${e}`))) : null,
      p?.avisos?.length ? el('ul', { class: 'problemas' }, p.avisos.map((e) => el('li', { class: 'aviso' }, `⚠ ${e}`))) : null,
      p && total() && !p.erros.length && !p.avisos.length ? el('div', { class: 'selo ok' }, 'Sem erros nem avisos') : null,
      p?.mudancas?.length ? el('table', { class: 'bib-sub niv-impacto' }, el('thead', {}, el('tr', {}, ['O que muda', ...DIFS.map(([, n]) => `${n}: vida / dano / exp`)].map((h) => el('th', {}, h)))),
        el('tbody', {}, p.mudancas.filter((m) => m.tipo === 'fase').map((m) => el('tr', {}, el('td', {}, m.nome), ...DIFS.map(([d]) => { const i = m.impacto[d]; const f = (x) => `${x.variacaoPct > 0 ? '+' : ''}${x.variacaoPct}%`; return el('td', { class: Math.abs(i.vida.variacaoPct) >= 25 ? 'niv-forte' : '' }, `${f(i.vida)} / ${f(i.dano)} / ${f(i.exp)}`); }))))) : null);
  }
  function atualizarContagem() {
    const c = document.getElementById('niv-contagem');
    if (c) c.textContent = total() ? `${total()} alteração(ões) não salva(s)` : 'sem alterações';
    const s = document.getElementById('niv-salvar');
    if (s) s.disabled = !total() || !podeGravar();
    const d = document.getElementById('niv-descartar');
    if (d) d.disabled = !total();
  }

  function pintar() {
    const atos = [...new Set(N.original.fases.map((f) => f.ato))].sort((a, b) => a - b);
    const e = N.original.escala;
    raiz().replaceChildren(
      cabecalho('Níveis da campanha', 'Level original e levels alvo de cada fase e boss de ato. É dado de balanceamento e progressão: edite aqui, confira a pré-visualização, salve e publique por commit + deploy — nada muda no jogo antes disso.',
        aoVoltar ? el('button', { type: 'button', onclick: aoVoltar }, '← Painel por hunt') : null),
      !podeGravar() ? el('div', { class: 'bib-alerta' }, 'Somente leitura neste servidor (produção): para editar, rode a Engine localmente, salve, faça commit e publique pelo deploy.') : null,
      el('div', { class: 'niv-fluxo' }, ['1 · Editar (na tela)', '2 · Pré-visualizar (impacto)', '3 · Salvar (arquivo)', '4 · Publicar (commit + deploy)'].map((t, i) => el('span', { class: i === 0 ? 'ativa' : '' }, t))),
      el('div', { class: 'op-linha' }, el('b', { id: 'niv-contagem' }, 'sem alterações'), el('button', { type: 'button', id: 'niv-salvar', class: 'primario', disabled: true, onclick: salvar }, 'Salvar no arquivo'), el('button', { type: 'button', id: 'niv-descartar', disabled: true, onclick: descartar }, 'Descartar alterações')),
      el('section', { class: 'hunt-sec' }, el('h3', {}, 'Pré-visualização do impacto'), el('div', { id: 'niv-previa' })),
      ...atos.map(tabelaDoAto),
      el('section', { class: 'hunt-sec' }, el('h3', {}, 'Somente leitura: escala e faixas'),
        el('div', { class: 'dica' }, 'Os bichos de uma fase são multiplicados por (level alvo ÷ level original) elevado a estes expoentes. Mudar a escala altera TODA a campanha e não se faz aqui.'),
        el('table', { class: 'bib-sub' }, el('tbody', {}, [['Vida (expoente)', e.vida], ['Dano (expoente)', e.dano], ['Exp (expoente)', e.exp], ['Multiplicador mínimo', e.minimo], ...Object.entries(N.original.dificuldades).map(([, d]) => [`Faixa ${d.nome}`, `${d.faixa[0]} – ${d.faixa[1]}`])].map(([k, v]) => el('tr', {}, el('th', {}, k), el('td', {}, String(v))))))),
      el('section', { class: 'hunt-sec' }, el('h3', {}, `Versões anteriores (${N.versoes.length})`), N.versoes.length ? el('div', { class: 'op-linha' }, N.versoes.slice(0, 12).map((v) => el('button', { type: 'button', disabled: !podeGravar(), onclick: () => restaurar(v) }, `Restaurar v${v}`))) : el('div', { class: 'dica' }, 'Ainda sem versões: a primeira gravação guarda a anterior aqui.')));
    atualizarContagem();
    pintarPrevia();
  }

  return { desenhar, total };
}
