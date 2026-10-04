// A aba "Classes" da Engine: o EDITOR DE CLASSES — cadastro, atributos iniciais, ganho por level, bônus por ponto de atributo (globais) e a prévia dos efeitos. Edita por override (a fábrica nunca muda):
// editar → prévia (servidor: valida, mostra impacto e a prévia dos efeitos) → salvar → aprovar versão/Git/deploy manuais. As regras e as contas moram no servidor (`systems/classes.mjs`); aqui só há tela.
import { el, cabecalho, confirmar, pedirTexto, msg, tratarConflito } from './editor-ui.mjs';

const ROT = { str: 'Força', dex: 'Destreza', int: 'Inteligência' };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const txt = (v) => (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v)) ? '—' : String(v));
const num = (v) => (v === '' || v == null ? undefined : Number(v));

export function criarTelaDeClasses({ api, raiz, sujo = null, podeGravar = () => true }) {
  const E = { dados: null, cfg: null, base: '', sel: null, q: '', previa: null, timer: null, pedido: 0, calc: { str: 20, dex: 20, int: 20 }, calcRes: null, excluidas: new Set(), comparacao: null, novo: { id: '', nome: '', base: 'knight' } };
  const dis = () => !podeGravar();
  const estadoDoDraft = () => JSON.stringify({ c: E.cfg.classes, e: E.cfg.efeitos, x: [...E.excluidas] });
  const alterado = () => E.base !== estadoDoDraft();
  const overrideAtual = () => ({ ativo: E.dados.override?.ativo !== false, classes: { ...E.cfg.classes, ...Object.fromEntries([...E.excluidas].map((id) => [id, { excluido: true }])) }, efeitos: E.cfg.efeitos });

  async function carregar() {
    E.dados = await api('classes');
    E.cfg = { classes: Object.fromEntries(E.dados.classes.map((c) => [c.id, structuredClone(c)])), efeitos: { ...E.dados.efeitos } };
    for (const c of Object.values(E.cfg.classes)) { delete c.personagens; delete c.previaDosIniciais; }
    E.excluidas = new Set(); E.base = estadoDoDraft(); E.previa = null;
    if (!E.sel || !E.cfg.classes[E.sel]) E.sel = Object.keys(E.cfg.classes)[0] ?? null;
    sujo?.limpar();
  }
  async function desenhar() { await carregar(); pintar(); await recalcular(); }
  function mudou() {
    sujo?.[alterado() ? 'marcar' : 'limpar']();
    atualizarBarra();
    clearTimeout(E.timer);
    E.timer = setTimeout(async () => { await validar(); await recalcular(); }, 350);
  }
  async function validar() {
    const meu = ++E.pedido;
    const r = await api('classes/validar', { override: overrideAtual() });
    if (meu !== E.pedido) return;
    E.previa = r;
    document.querySelector('#cls-previa')?.replaceWith(previa());
    atualizarBarra();
  }
  async function recalcular() {
    E.calcRes = (await api('classes/previa', { efeitos: E.cfg.efeitos, ...E.calc })).previa;
    document.querySelector('#cls-calc')?.replaceWith(calculadora());
    const c = E.cfg.classes[E.sel];
    if (c) { const r = await api('classes/previa', { efeitos: E.cfg.efeitos, ...c.atributosIniciais }); E.iniciaisRes = r.previa; document.querySelector('#cls-iniciais')?.replaceWith(previaDosIniciais()); }
  }
  function atualizarBarra() {
    const s = document.querySelector('#cls-salvar'); if (s) s.disabled = dis() || !alterado() || E.previa?.ok === false;
    const d = document.querySelector('#cls-descartar'); if (d) d.disabled = !alterado();
    const c = document.querySelector('#cls-contagem'); if (c) c.textContent = alterado() ? 'alterações não salvas' : (Object.keys(E.dados.override?.classes ?? {}).length || Object.keys(E.dados.override?.efeitos ?? {}).length ? 'override salvo' : 'sem override (valem as classes de fábrica)');
  }

  // ------------------------------------------------------------ ações
  async function salvar() {
    const r0 = await api('classes/validar', { override: overrideAtual() });
    if (!r0.ok) { E.previa = r0; document.querySelector('#cls-previa')?.replaceWith(previa()); return msg((r0.erros ?? []).join(' '), 'erro'); }
    if (!(await confirmar('Salvar as classes?', `${r0.impacto.length} classe(s) nova(s), alterada(s) ou removida(s) e ${r0.efeitosAlterados.length} bônus por ponto alterado(s). A fábrica não é tocada. O servidor local aplica na hora (Hot Reload); para valer na produção: aprovar versão, commit e deploy manuais.`, { ok: 'Salvar' }))) return;
    const r = await api('classes', { acao: 'salvar', override: overrideAtual(), revisao: E.dados.revisao });
    if (await tratarConflito(r, () => desenhar())) return;
    if (r.ok === false) return msg((r.erros ?? ['Não salvou.']).join(' '), 'erro');
    msg(`Classes salvas. ${r.comoPublicar ?? ''}`, 'ok');
    await desenhar();
  }
  async function descartar() {
    if (!(await confirmar('Descartar as alterações não salvas?', 'Volta ao último estado salvo.', { ok: 'Descartar', perigo: true }))) return;
    await desenhar();
  }
  async function reverterTudo() {
    if (!(await confirmar('Voltar tudo à fábrica?', 'Apaga TODAS as alterações de classes e bônus (a versão anterior vai para o histórico). Classes criadas por você somem (só se não tiverem personagens).', { ok: 'Voltar à fábrica', perigo: true }))) return;
    const r = await api('classes', { acao: 'reverter', revisao: E.dados.revisao });
    if (await tratarConflito(r, () => desenhar())) return;
    if (r.ok === false) return msg((r.erros ?? ['Não reverteu.']).join(' '), 'erro');
    await desenhar();
  }
  async function restaurarVersao(n) {
    if (!(await confirmar(`Restaurar a versão ${n}?`, 'A configuração atual vai para o histórico.', { ok: 'Restaurar' }))) return;
    const r = await api('classes', { acao: 'restaurar', versao: n, revisao: E.dados.revisao });
    if (await tratarConflito(r, () => desenhar())) return;
    if (r.ok === false) return msg((r.erros ?? ['Não restaurou.']).join(' '), 'erro');
    await desenhar();
  }
  async function compararVersao(de) { E.comparacao = de ? await api(`classes/comparar?${new URLSearchParams({ de, para: 'atual' })}`) : null; pintarLateral(); }
  function criarClasse() {
    const n = E.novo;
    if (!/^[a-z][a-z0-9_-]{2,31}$/.test(n.id)) return msg('ID: 3 a 32 caracteres (minúsculas, números, hífen e sublinhado; começa com letra).', 'erro');
    if (E.cfg.classes[n.id]) return msg(`Já existe uma classe com o ID "${n.id}".`, 'erro');
    if (!n.nome.trim()) return msg('Dê um nome à classe.', 'erro');
    const b = E.cfg.classes[n.base];
    E.cfg.classes[n.id] = { id: n.id, nome: n.nome.trim(), descricao: '', icone: b.icone, cor: b.cor, ativo: false, builtin: false, vocacaoBase: b.vocacaoBase, atributosIniciais: { ...b.atributosIniciais }, porLevel: { ...b.porLevel } };
    E.excluidas.delete(n.id); E.sel = n.id; E.novo = { id: '', nome: '', base: n.base }; mudou(); pintar();
  }
  function duplicar(id) {
    const o = E.cfg.classes[id];
    let k = 2; let novo; do { novo = `${id}-${k++}`.slice(0, 32); } while (E.cfg.classes[novo]);
    E.cfg.classes[novo] = { ...structuredClone(o), id: novo, nome: `${o.nome} (cópia)`, ativo: false, builtin: false, vocacaoBase: o.vocacaoBase };
    E.sel = novo; mudou(); pintar();
  }
  async function apagar(id) {
    const c = E.dados.classes.find((x) => x.id === id);
    if (c?.personagens > 0) return msg(`${c.personagens} personagem(ns) usam esta classe: migre-os (botão "Migrar personagens") antes de apagar.`, 'aviso');
    if (!(await confirmar(`Apagar a classe "${E.cfg.classes[id].nome}"?`, 'Só vale depois de salvar. Classes de fábrica não se apagam (desative).', { ok: 'Apagar', perigo: true }))) return;
    if (E.dados.original.classes[id]) return msg('Classe de fábrica: desative em vez de apagar.', 'aviso');
    delete E.cfg.classes[id]; E.excluidas.add(id); E.sel = Object.keys(E.cfg.classes)[0] ?? null; mudou(); pintar();
  }
  async function migrar(de) {
    const origem = E.dados.classes.find((x) => x.id === de);
    const opcoes = Object.values(E.cfg.classes).filter((c) => c.id !== de && c.ativo).map((c) => c.id);
    const para = await pedirTexto('Migrar personagens', { rotulo: `ID da classe de destino (ativa): ${opcoes.join(', ')}`, valor: opcoes[0] ?? '', validar: (v) => (opcoes.includes(v.trim()) ? '' : 'Use o ID de uma classe ativa da lista.') });
    if (!para) return;
    if (!(await confirmar(`Migrar ${origem.personagens} personagem(ns) de "${de}" para "${para}"?`, 'Altera personagens no BANCO (classe e vocação). Quem estiver online só muda no próximo login. Faça um backup antes em produção.', { ok: 'Migrar', perigo: true }))) return;
    const r = await api('classes', { acao: 'migrar', de, para: para.trim(), confirmar: true });
    if (r.ok === false) return msg((r.erros ?? ['Não migrou.']).join(' '), 'erro');
    msg(`${r.migrados} personagem(ns) migrado(s). ${r.aviso}`, 'ok'); await desenhar();
  }
  function carregarPerfilSugerido() {
    const p = E.dados.perfilSugerido; if (!p) return;
    for (const [id, a] of Object.entries(p.atributosIniciais)) if (E.cfg.classes[id]) E.cfg.classes[id].atributosIniciais = { ...a };
    E.cfg.efeitos = { ...E.cfg.efeitos, ...p.efeitos };
    msg('Perfil sugerido (valores de TESTE) carregado no rascunho. Nada foi salvo.', 'aviso'); mudou(); pintar(); recalcular();
  }

  // ------------------------------------------------------------ peças
  const campo = (rotulo, entrada, dica = null) => el('label', { class: 'campo cls-campo', title: dica ?? '' }, rotulo, entrada);
  const entradaNumero = (obj, chave, original, { passo = 'any', w = 90 } = {}) => el('span', { class: 'cls-num' },
    el('input', { type: 'number', step: passo, min: 0, value: obj[chave] ?? '', disabled: dis(), style: `width:${w}px`, class: original !== undefined && !igual(obj[chave], original) ? 'itm-modificado' : '', onchange: (e) => { const v = num(e.target.value); if (v === undefined) return; obj[chave] = v; mudou(); pintar(); } }),
    original !== undefined ? el('small', { class: 'dica' }, ` fábrica: ${txt(original)}`) : null,
    original !== undefined && !igual(obj[chave], original) && !dis() ? el('button', { type: 'button', class: 'fantasma', onclick: () => { obj[chave] = original; mudou(); pintar(); } }, 'restaurar') : null);

  function previa() {
    const p = E.previa;
    if (!p) return el('div', { id: 'cls-previa', class: 'dica' }, alterado() ? 'Calculando a prévia…' : 'Nenhuma alteração pendente.');
    return el('div', { id: 'cls-previa' },
      (p.erros ?? []).length ? el('ul', { class: 'problemas' }, p.erros.map((m) => el('li', { class: 'erro' }, `✖ ${m}`))) : null,
      (p.avisos ?? []).length ? el('ul', { class: 'problemas' }, p.avisos.map((m) => el('li', { class: 'aviso' }, `⚠ ${m}`))) : null,
      p.ok && (p.impacto?.length || p.efeitosAlterados?.length) ? el('div', { class: 'dica' }, `Impacto: ${p.impacto.map((i) => `${i.id} (${i.mudanca})`).join(', ') || 'nenhuma classe'}${p.efeitosAlterados.length ? ` · bônus: ${p.efeitosAlterados.map((x) => `${x.chave} ${txt(x.de)} → ${txt(x.para)}`).join(', ')}` : ''}` ) : null);
  }
  function calculadora() {
    const r = E.calcRes;
    return el('div', { id: 'cls-calc', class: 'ip-painel' }, el('h4', {}, 'Calculadora dos bônus (pelas regras configuradas)'),
      el('div', { class: 'linha' }, ['str', 'dex', 'int'].map((a) => campo(ROT[a], el('input', { type: 'number', min: 0, value: E.calc[a], style: 'width:80px', onchange: (e) => { E.calc[a] = Math.max(0, Number(e.target.value) || 0); recalcular(); } })))),
      r ? el('ul', { class: 'op-lista' },
        el('li', {}, `${ROT.str} ${E.calc.str}: vida adicional +${txt(r.str.vida)} · dano físico +${txt(r.str.danoFisicoPct)}%`),
        el('li', {}, `${ROT.dex} ${E.calc.dex}: precisão +${txt(r.dex.precisao)} · evasão +${txt(r.dex.evasaoRating)} (rating) e +${txt(r.dex.evasaoPct)}% · velocidade de ataque +${txt(r.dex.velocidadeDeAtaquePct)}%`),
        el('li', {}, `${ROT.int} ${E.calc.int}: mana adicional +${txt(r.int.mana)} · dano mágico +${txt(r.int.danoMagicoPct)}% · escudo de energia +${txt(r.int.energyShieldPct)}%`)) : null);
  }
  function previaDosIniciais() {
    const r = E.iniciaisRes; const c = E.cfg.classes[E.sel];
    return el('div', { id: 'cls-iniciais', class: 'dica' }, r && c ? `Com os atributos iniciais (FOR ${c.atributosIniciais.str} · DES ${c.atributosIniciais.dex} · INT ${c.atributosIniciais.int}): vida +${txt(r.str.vida)}, dano físico +${txt(r.str.danoFisicoPct)}%, precisão +${txt(r.dex.precisao)}, evasão +${txt(r.dex.evasaoRating)} / +${txt(r.dex.evasaoPct)}%, mana +${txt(r.int.mana)}, escudo de energia +${txt(r.int.energyShieldPct)}%.` : '');
  }
  function bonus() {
    const def = E.dados.definicaoDosEfeitos; const orig = E.dados.original.efeitos;
    return el('div', { class: 'ip-painel' }, el('h4', {}, 'Bônus por ponto de atributo (globais, valem para todas as classes)'),
      el('div', { class: 'dica' }, 'Aplicados pela engine em um lugar só (Atributos.efeitos → ficha). Evasão (%) e Energy Shield (%) nascem em 0: ligue aqui. Mudar vale no próximo cálculo, também para quem já joga.'),
      ['str', 'dex', 'int'].map((a) => el('fieldset', { class: 'ip-bloco' }, el('legend', {}, ROT[a]), el('div', { class: 'linha' }, Object.entries(def).filter(([, d]) => d.atributo === a).map(([k, d]) => campo(d.rotulo, entradaNumero(E.cfg.efeitos, k, orig[k], { passo: 'any', w: 80 }), `máximo ${d.max}`))))),
      el('div', { class: 'linha' }, el('button', { type: 'button', disabled: dis() || !E.dados.perfilSugerido, onclick: carregarPerfilSugerido, title: 'Carrega no rascunho os valores de teste sugeridos (atributos iniciais e bônus); nada é salvo' }, 'Carregar perfil sugerido (teste)')));
  }
  function lista() {
    const q = E.q.trim().toLowerCase();
    const itens = Object.values(E.cfg.classes).filter((c) => !q || `${c.nome} ${c.id}`.toLowerCase().includes(q));
    const cont = (id) => E.dados.classes.find((x) => x.id === id)?.personagens ?? 0;
    return el('div', { id: 'cls-lista', class: 'cls-lista' }, itens.map((c) => el('div', { class: `cls-card${E.sel === c.id ? ' ativa' : ''}${c.ativo ? '' : ' inativa'}`, style: `border-left:6px solid ${c.cor}`, onclick: () => { E.sel = c.id; pintar(); recalcular(); } },
      el('span', { class: 'cls-icone' }, c.icone), el('span', { class: 'cls-nome' }, el('b', {}, c.nome), el('small', { class: 'dica' }, ` ${c.id}${c.builtin ? '' : ` · sobre ${c.vocacaoBase}`}`)),
      el('span', { class: 'dica' }, `${cont(c.id)} personagem(ns)`), el('span', { class: `val-chip ${c.ativo ? 'ok' : 'mudo'}` }, c.ativo ? 'ativa' : 'inativa'),
      el('span', { class: 'cls-botoes' },
        el('button', { type: 'button', class: 'fantasma', disabled: dis(), onclick: (e) => { e.stopPropagation(); c.ativo = !c.ativo; mudou(); pintar(); } }, c.ativo ? 'desativar' : 'ativar'),
        el('button', { type: 'button', class: 'fantasma', disabled: dis(), onclick: (e) => { e.stopPropagation(); duplicar(c.id); } }, 'duplicar'),
        !c.builtin ? el('button', { type: 'button', class: 'fantasma', disabled: dis(), onclick: (e) => { e.stopPropagation(); apagar(c.id); } }, 'apagar') : null))));
  }
  function ficha() {
    const c = E.cfg.classes[E.sel];
    if (!c) return el('div', { class: 'dica' }, 'Escolha ou crie uma classe.');
    const o = E.dados.original.classes[c.id];
    const salvo = E.dados.classes.find((x) => x.id === c.id);
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'linha' }, el('h3', {}, `${c.icone} ${c.nome}`), el('span', { class: 'dica' }, c.builtin ? 'classe de fábrica' : `classe criada, sobre ${c.vocacaoBase} (herda magias, gemas, equipamento e sprites dela)`)),
      el('div', { class: 'grade' },
        campo('Nome', el('input', { type: 'text', value: c.nome, disabled: dis(), onchange: (e) => { c.nome = e.target.value; mudou(); pintar(); } })),
        campo('ID (único, não muda)', el('input', { type: 'text', value: c.id, disabled: true })),
        campo('Ícone (emoji ou símbolo)', el('input', { type: 'text', value: c.icone, maxlength: 8, style: 'width:90px', disabled: dis(), onchange: (e) => { c.icone = e.target.value; mudou(); pintar(); } })),
        campo('Cor de identificação', el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(c.cor) ? c.cor : '#888888', disabled: dis(), onchange: (e) => { c.cor = e.target.value; mudou(); pintar(); } })),
        campo('Vocação-base (mecânica)', el('select', { disabled: true }, E.dados.vocacoes.map((v) => el('option', { value: v, selected: v === c.vocacaoBase }, v)))),
        el('label', { class: 'conj-chk' }, el('input', { type: 'checkbox', checked: c.ativo, disabled: dis(), onchange: (e) => { c.ativo = e.target.checked; mudou(); pintar(); } }), 'ativa (aparece na criação de personagem)')),
      campo('Descrição', el('textarea', { rows: 2, style: 'width:100%', disabled: dis(), onchange: (e) => { c.descricao = e.target.value; mudou(); } }, c.descricao ?? '')),
      el('fieldset', { class: 'ip-bloco' }, el('legend', {}, 'Atributos iniciais (aplicados uma vez, ao nível 1; a progressão soma o ganho por level por cima)'),
        el('div', { class: 'linha' }, ['str', 'dex', 'int'].map((a) => campo(ROT[a], entradaNumero(c.atributosIniciais, a, o?.atributosIniciais[a], { passo: 1, w: 70 })))),
        previaDosIniciais()),
      el('fieldset', { class: 'ip-bloco' }, el('legend', {}, 'Ganho por level (pontos recebidos a cada nível)'),
        el('div', { class: 'linha' }, ['str', 'dex', 'int'].map((a) => campo(ROT[a], entradaNumero(c.porLevel, a, o?.porLevel[a], { passo: 0.01, w: 70 }))))),
      el('div', { class: 'linha' }, salvo?.personagens > 0 ? el('button', { type: 'button', class: 'perigo', disabled: dis(), onclick: () => migrar(c.id) }, `Migrar ${salvo.personagens} personagem(ns) para outra classe`) : null),
      el('div', { class: 'dica' }, `Personagens vinculados: ${salvo?.personagens ?? 0}. Apagar uma classe só é permitido sem personagens (use a migração explícita).`));
  }
  function pintarLateral() { document.querySelector('#cls-hist')?.replaceWith(historico()); }
  function historico() {
    const c = E.comparacao;
    return el('div', { id: 'cls-hist', class: 'ip-painel' }, el('h4', {}, 'Versões e comparação'),
      E.dados.versoes.length ? el('div', { class: 'linha' }, el('label', { class: 'campo' }, 'Comparar a versão', el('select', { onchange: (e) => compararVersao(e.target.value) }, [el('option', { value: '' }, '—'), ...E.dados.versoes.map((v) => el('option', { value: String(v) }, `v${v}`))])),
        el('label', { class: 'campo' }, 'Restaurar', el('select', { disabled: dis(), onchange: (e) => { if (e.target.value) restaurarVersao(Number(e.target.value)); e.target.value = ''; } }, [el('option', { value: '' }, '—'), ...E.dados.versoes.map((v) => el('option', { value: v }, `v${v}`))]))) : el('div', { class: 'dica' }, 'Ainda não há versões anteriores.'),
      c ? (c.ok ? (c.mudancas.length ? el('table', { class: 'mob-tabela' }, el('thead', {}, el('tr', {}, ['Classe', 'Campo', `v${c.de}`, 'Atual'].map((h) => el('th', {}, h)))), el('tbody', {}, c.mudancas.map((m) => el('tr', {}, el('td', {}, txt(m.classe)), el('td', {}, m.campo), el('td', {}, txt(m.de)), el('td', {}, txt(m.para)))))) : el('div', { class: 'dica' }, 'Iguais.')) : el('ul', { class: 'problemas' }, (c.erros ?? []).map((m) => el('li', { class: 'erro' }, m)))) : null);
  }

  function pintar() {
    const d = E.dados;
    raiz().replaceChildren(...[
      cabecalho('Classes', 'Cadastro das classes do jogo: atributos iniciais, ganho por level e bônus por ponto de atributo. Edita por override (a fábrica nunca muda); a classe é validada pelo servidor na criação do personagem.'),
      !podeGravar() ? el('div', { class: 'bib-alerta' }, 'Somente leitura neste servidor (produção): dá para ver e calcular, mas não salvar.') : null,
      d.carga?.erros?.length ? el('div', { class: 'bib-alerta' }, `O override gravado foi IGNORADO no boot (inválido): ${d.carga.erros.join(' | ')}`) : null,
      el('div', { class: 'op-linha' }, el('span', { id: 'cls-contagem', class: 'dica' }, ''), el('span', { class: 'dica' }, `${d.totalDePersonagens ?? '—'} personagem(ns) no total`),
        el('button', { id: 'cls-salvar', type: 'button', class: 'primario', disabled: true, onclick: salvar }, 'Salvar override'), el('button', { id: 'cls-descartar', type: 'button', disabled: true, onclick: descartar }, 'Descartar alterações'),
        el('button', { type: 'button', class: 'perigo', disabled: dis() || (!Object.keys(d.override?.classes ?? {}).length && !Object.keys(d.override?.efeitos ?? {}).length), onclick: reverterTudo }, 'Voltar tudo à fábrica')),
      previa(),
      el('div', { class: 'linha' }, el('input', { type: 'search', placeholder: 'buscar classe por nome…', value: E.q, oninput: (e) => { E.q = e.target.value; document.querySelector('#cls-lista')?.replaceWith(lista()); } }),
        el('input', { type: 'text', placeholder: 'id da nova classe', value: E.novo.id, style: 'width:140px', disabled: dis(), onchange: (e) => { E.novo.id = e.target.value.trim().toLowerCase(); } }),
        el('input', { type: 'text', placeholder: 'nome', value: E.novo.nome, style: 'width:140px', disabled: dis(), onchange: (e) => { E.novo.nome = e.target.value; } }),
        el('select', { disabled: dis(), onchange: (e) => { E.novo.base = e.target.value; } }, d.vocacoes.map((v) => el('option', { value: v, selected: E.novo.base === v }, `sobre ${v}`))),
        el('button', { type: 'button', class: 'primario', disabled: dis(), onclick: criarClasse }, '+ Criar classe')),
      el('div', { class: 'conj-duas' }, lista(), ficha()),
      bonus(), calculadora(), historico(),
    ].filter(Boolean));
    atualizarBarra();
  }
  return { desenhar, abrir: () => desenhar(), focarBusca: () => document.querySelector('#raiz input[type=search]')?.focus(), sujoAgora: () => !!E.dados && alterado() };
}
