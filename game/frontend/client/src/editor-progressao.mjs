// A tela "Progressão e loot" da Engine: a progressão de equipamentos (10 Atos, level 1–1000, tiers das bases — COMPARTILHADA pelas três dificuldades) e as regras de loot POR dificuldade
// (pesos de raridade, chance de drop de equipamento, chance de +1 modificador, pesos e teto dos tiers de modificador). Edita por override (o original nunca muda): editar → prévia (valida
// + impacto exato) → salvar → publicar. Inclui a comparação Normal × Cruel × Merciless, o simulador (o gerador REAL, com semente) e os perfis propostos (não aplicados).
// Toda regra mora no servidor (`systems/progressao.mjs`, `admin/overrides-progressao.mjs`, `systems/itens/simulador-de-loot.mjs`); aqui só há tela.
import { el, cabecalho, confirmar, msg, tratarConflito } from './editor-ui.mjs';

const DIFICULDADES = ['facil', 'medio', 'dificil'];
const RARIDADES = ['comum', 'incomum', 'raro', 'épico', 'lendário', 'mítico'];
const COR_DA_RARIDADE = { comum: '#9aa3b2', incomum: '#5cc28a', raro: '#7fa6e8', épico: '#c597f0', lendário: '#e9a94f', mítico: '#ef6f63' };
const SLOTS = [['', 'todos'], ['weapon', 'arma'], ['shield', 'escudo'], ['head', 'elmo'], ['body', 'armadura'], ['legs', 'calça'], ['feet', 'bota'], ['ring', 'anel'], ['neck', 'amuleto']];
const ABAS = [['ato', 'Atos e bases'], ['regras', 'Regras de loot'], ['comparar', 'Comparar dificuldades'], ['simulador', 'Simulador'], ['perfis', 'Perfis propostos']];
const pct = (x, casas = 1) => `${(x * 100).toFixed(casas)}%`;
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Lê `obj` pelo caminho `['loot','medio','chanceDeDrop']` (undefined se faltar). Pura. */
export const ler = (obj, caminho) => caminho.reduce((o, k) => (o == null ? undefined : o[k]), obj);
/** Grava (ou apaga, com `undefined`) o valor no caminho, criando os níveis e podando os objetos que ficam vazios. Muta `obj`. */
export function gravar(obj, caminho, valor) {
  const pais = [obj];
  for (const k of caminho.slice(0, -1)) { if (typeof pais.at(-1)[k] !== 'object' || pais.at(-1)[k] === null) { if (valor === undefined) return obj; pais.at(-1)[k] = {}; } pais.push(pais.at(-1)[k]); }
  const ultimo = caminho.at(-1);
  if (valor === undefined) delete pais.at(-1)[ultimo]; else pais.at(-1)[ultimo] = valor;
  for (let i = pais.length - 1; i > 0; i--) if (Object.keys(pais[i]).length === 0) delete pais[i - 1][caminho[i - 1]];
  return obj;
}

export function criarTelaDeProgressao({ api, raiz, sujo = null, podeGravar = () => true }) {
  const E = { dados: null, ov: {}, ato: 1, dif: 'medio', aba: 'ato', previa: null, detalhe: null, slot: '', timer: null, pedido: 0, sim: { modo: 'equipamentos', ato: 1, dificuldade: 'todas', slot: '', itemId: '', monstro: 'troll', huntId: 'troll-cave', n: 10000, semente: 1, usarEdicao: false }, resultado: null, simulando: false };
  const dis = () => !podeGravar();
  const original = () => E.dados.original;
  const efetivoEditando = () => E.previa?.distribuicoes ?? E.dados.distribuicoes;
  const alterado = () => !igual(E.ov, E.dados.override ?? { ativo: true });

  async function carregar() {
    E.dados = await api('progressao');
    E.ov = structuredClone(E.dados.override ?? { ativo: true });
    E.previa = null;
    await carregarAto();
    sujo?.limpar();
  }
  async function carregarAto() { E.detalhe = await api(`progressao/ato/${E.ato}${E.slot ? `?slot=${E.slot}` : ''}`); }
  async function desenhar() { await carregar(); pintar(); }

  // ------------------------------------------------------------ edição + prévia
  const valorEfetivo = (caminho) => { const v = ler(E.ov, caminho); return v !== undefined ? v : ler(E.dados.efetivo, caminho); };
  function editar(caminho, valor) {
    const orig = ler(original(), caminho);
    gravar(E.ov, caminho, valor === undefined || igual(valor, orig) ? undefined : valor);
    sujo?.[alterado() ? 'marcar' : 'limpar']();
    atualizarBarra();
    clearTimeout(E.timer);
    E.timer = setTimeout(previsualizar, 400);
  }
  async function previsualizar() {
    const meu = ++E.pedido;
    const r = await api('progressao/validar', { override: E.ov });
    if (meu !== E.pedido) return;
    E.previa = r;
    document.querySelector('#prog-previa')?.replaceWith(blocoDaPrevia());
    if (E.aba === 'comparar') pintarAba();
    atualizarBarra();
  }
  const barraDeEstado = () => el('span', { id: 'prog-contagem', class: 'dica' }, alterado() ? 'alterações não salvas' : (E.dados.override && Object.keys(E.dados.override).some((k) => k !== 'ativo' && k !== '_nota') ? 'override salvo' : 'sem override (valem os originais)'));
  function atualizarBarra() {
    document.querySelector('#prog-contagem')?.replaceWith(barraDeEstado());
    const b = document.querySelector('#prog-salvar');
    if (b) b.disabled = dis() || !alterado() || E.previa?.ok === false;
  }

  async function salvar() {
    const r0 = await api('progressao/validar', { override: E.ov });
    if (!r0.ok) { E.previa = r0; pintarAba(); return msg((r0.erros ?? []).join(' '), 'erro'); }
    const linhas = r0.impacto.length ? `${r0.impacto.length} combinação(ões) de Ato × dificuldade mudam (ver "Impacto").` : 'As distribuições exatas não mudam (só valores sem efeito na comparação, como a chance de drop).';
    if (!(await confirmar('Salvar o override de progressão e loot?', `${linhas} O original não é tocado. O servidor local aplica na hora (Hot Reload); para valer na produção é commit + deploy.`, { ok: 'Salvar' }))) return;
    const r = await api('progressao', { acao: 'salvar', override: E.ov, revisao: E.dados.revisao });
    if (await tratarConflito(r, desenhar)) return;
    if (r.ok === false) return msg((r.erros ?? ['Não salvou.']).join(' '), 'erro');
    msg(`Override salvo. ${r.comoPublicar ?? ''}`, 'ok');
    await desenhar();
  }
  async function reverter() {
    if (!(await confirmar('Voltar aos valores originais?', 'Apaga as diferenças gravadas (o arquivo de override fica sem alterações; a versão anterior vai para o histórico).', { ok: 'Voltar ao original', perigo: true }))) return;
    const r = await api('progressao', { acao: 'reverter', revisao: E.dados.revisao });
    if (await tratarConflito(r, desenhar)) return;
    if (r.ok === false) return msg((r.erros ?? ['Não reverteu.']).join(' '), 'erro');
    msg('Valores originais restaurados.', 'ok');
    await desenhar();
  }
  async function restaurar(n) {
    if (!(await confirmar(`Restaurar a versão ${n}?`, 'A configuração atual vai para o histórico e a versão escolhida volta a valer.', { ok: 'Restaurar' }))) return;
    const r = await api('progressao', { acao: 'restaurar', versao: n, revisao: E.dados.revisao });
    if (await tratarConflito(r, desenhar)) return;
    if (r.ok === false) return msg((r.erros ?? ['Não restaurou.']).join(' '), 'erro');
    msg(`Versão ${n} restaurada.`, 'ok');
    await desenhar();
  }

  // ------------------------------------------------------------ peças
  const barra = (frac, cor = 'var(--eng-info)') => el('div', { class: 'prog-barra', title: pct(frac, 2) }, el('div', { style: `width:${Math.max(0, Math.min(100, frac * 100))}%;background:${cor}` }));
  const campo = (rotulo, caminho, { passo = 'any', min = 0, max = null, vazioNull = false, dica = null } = {}) => {
    const orig = ler(original(), caminho);
    const atual = valorEfetivo(caminho);
    const mudou = ler(E.ov, caminho) !== undefined;
    const entrada = el('input', { type: 'number', step: passo, min, ...(max != null ? { max } : {}), value: atual ?? '', disabled: dis(), style: 'width:90px', onchange: (e) => { const t = e.target.value; editar(caminho, t === '' ? (vazioNull ? null : undefined) : Number(t)); } });
    return el('label', { class: `campo prog-campo${mudou ? ' mudou' : ''}` }, rotulo, entrada, el('small', { class: 'dica' }, `original: ${orig === null || orig === undefined ? (vazioNull ? 'sem teto' : 'neutro') : orig}`), dica ? el('small', { class: 'dica' }, dica) : null);
  };

  function blocoDaPrevia() {
    const p = E.previa;
    if (!p) return el('div', { id: 'prog-previa' });
    return el('section', { id: 'prog-previa', class: 'hunt-sec' },
      el('h3', {}, 'Prévia (sem gravar)'),
      p.erros?.length ? el('ul', { class: 'problemas' }, p.erros.map((m) => el('li', { class: 'erro' }, m))) : el('div', { class: 'dica' }, 'Sem erros: pode salvar.'),
      p.avisos?.length ? el('ul', { class: 'problemas' }, p.avisos.map((m) => el('li', { class: 'aviso' }, m))) : null,
      p.impacto?.length ? el('table', { class: 'mob-tabela' }, el('thead', {}, el('tr', {}, ['Ato', 'Dificuldade', 'Raro ou melhor', 'Modificadores/item', 'Tier médio', 'Tier ≥ 4', 'Drop equip.'].map((h) => el('th', {}, h)))),
        el('tbody', {}, p.impacto.map((l) => { const d = l.delta; const f = (a, b, x, mult = 1) => el('td', { class: Math.abs(x) < 1e-6 ? '' : x > 0 ? 'niv-forte' : 'dica' }, `${(a * mult).toFixed(mult === 100 ? 1 : 2)} → ${(b * mult).toFixed(mult === 100 ? 1 : 2)}`); return l.novo ? el('tr', {}, el('td', {}, l.ato), el('td', {}, nomeDe(l.dificuldade)), el('td', { colspan: 5 }, 'novo')) : el('tr', {}, el('td', {}, l.ato), el('td', {}, nomeDe(l.dificuldade)), f(l.antes.raroOuMelhor, l.depois.raroOuMelhor, d.raroOuMelhor, 100), f(l.antes.modificadoresPorItem, l.depois.modificadoresPorItem, d.modificadoresPorItem), f(l.antes.tierMedio, l.depois.tierMedio, d.tierMedio), f(l.antes.tierAlto, l.depois.tierAlto, d.tierAlto, 100), f(l.antes.chanceDeDrop, l.depois.chanceDeDrop, d.chanceDeDrop)); }))) : el('div', { class: 'dica' }, 'Sem mudança nas distribuições exatas.'));
  }
  const nomeDe = (d) => E.dados.efetivo.dificuldades[d]?.nome ?? d;

  // ------------------------------------------------------------ abas
  function abaAto() {
    const f = E.dados.efetivo.progressao.atos.find((a) => a.ato === E.ato);
    const d = E.detalhe;
    const cob = E.dados.cobertura.find((c) => c.ato === E.ato);
    const dist = efetivoEditando().find((a) => a.ato === E.ato);
    const estagio = valorEfetivo(['progressao', 'estagioDeRaridade', String(E.ato)]);
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'prog-cards' },
        el('div', { class: 'prog-card' }, el('b', {}, `Faixa de equipamento: level ${f.de}–${f.ate}`), el('span', { class: 'dica' }, 'IGUAL nas três dificuldades (Normal, Cruel e Merciless reutilizam o mesmo Ato e as mesmas bases).')),
        el('div', { class: 'prog-card' }, el('b', {}, `Tiers das bases: ${dist.tiersDasBases.map((t) => `T${t}`).join('–')}`), el('span', { class: 'dica' }, `tier da base = ⌊(level + ${E.dados.efetivo.progressao.tier.deslocamento} − 1) ÷ ${E.dados.efetivo.progressao.tier.largura}⌋ + 1 · o máximo é T${Math.floor((E.dados.nivelMaximo + E.dados.efetivo.progressao.tier.deslocamento - 1) / E.dados.efetivo.progressao.tier.largura) + 1} no level ${E.dados.nivelMaximo}.`)),
        el('div', { class: 'prog-card' }, el('b', {}, 'Estágio da tabela de raridade'), el('label', { class: `campo prog-campo${ler(E.ov, ['progressao', 'estagioDeRaridade', String(E.ato)]) !== undefined ? ' mudou' : ''}` }, 'estágio (1–4)', el('select', { disabled: dis(), onchange: (e) => editar(['progressao', 'estagioDeRaridade', String(E.ato)], Number(e.target.value)) }, [1, 2, 3, 4].map((v) => el('option', { value: v, selected: v === estagio }, v)))), el('span', { class: 'dica' }, `original: ${ler(original(), ['progressao', 'estagioDeRaridade', String(E.ato)])}. Qual das 4 tabelas de raridade este Ato usa (a dificuldade escolhe a coluna).`)),
        el('div', { class: 'prog-card' }, el('b', {}, `${cob.bases} base(s) de equipamento no catálogo`), el('span', { class: 'dica' }, cob.bases ? `por slot: ${Object.entries(cob.porSlot).map(([s, n]) => `${s} ${n}`).join(' · ')}` : 'Nenhuma base neste Ato: o catálogo importado quase não tem peça acima do level 600.'))),
      el('div', { class: 'linha' }, el('label', { class: 'prog-rot' }, 'filtrar bases por slot', el('select', { onchange: async (e) => { E.slot = e.target.value; await carregarAto(); pintarAba(); } }, SLOTS.map(([v, n]) => el('option', { value: v, selected: v === E.slot }, n)))), el('span', { class: 'dica' }, `${d.total} base(s) · ${Object.entries(d.porTier).map(([t, n]) => `${t}: ${n}`).join(' · ') || '—'}`)),
      d.bases.length ? el('table', { class: 'mob-tabela' }, el('thead', {}, el('tr', {}, ['Base', 'Slot', 'Level mínimo', 'Tier'].map((h) => el('th', {}, h)))), el('tbody', {}, d.bases.slice(0, 80).map((b) => el('tr', {}, el('td', {}, `${b.nome} #${b.id}`), el('td', {}, b.slot), el('td', {}, b.minLevel), el('td', {}, `T${b.tier}`))))) : el('div', { class: 'dica' }, 'Nenhuma base neste Ato (com este filtro).'),
      d.bases.length > 80 ? el('div', { class: 'dica' }, `mostrando 80 de ${d.total}`) : null,
      el('h4', {}, 'Grupos de sets (presentes de marco por vocação) nesta faixa'),
      d.marcos?.length ? el('ul', { class: 'op-lista' }, d.marcos.map((m) => el('li', {}, `${m.vocacao} — level ${m.level}: `, el('small', { class: 'dica' }, m.pecas.map((p) => p.nome).join(', '))))) : el('div', { class: 'dica' }, 'Nenhum set de marco cai nesta faixa. Os grupos de sets são os mesmos nas três dificuldades.'));
  }

  function abaRegras() {
    const dif = E.dif;
    const pesos = (rotulo, base, chaves, cor) => el('div', { class: 'prog-grade' }, el('b', {}, rotulo), chaves.map((k) => campo(cor ? k : `T${k}`, [...base, k], { min: 0, passo: 0.05 })));
    const tab = valorEfetivo(['progressao', 'tiersDeModificador']);
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'linha' }, el('label', { class: 'prog-rot' }, 'dificuldade', el('select', { onchange: (e) => { E.dif = e.target.value; pintarAba(); } }, DIFICULDADES.map((d) => el('option', { value: d, selected: d === dif }, nomeDe(d))))), el('span', { class: 'dica' }, 'Neutro (1 / 0 / vazio) = igual ao que existe hoje. A dificuldade só inclina as chances; não muda o level nem a base do equipamento.')),
      el('div', { class: 'prog-grade' },
        campo('chance de drop de equipamento (×)', ['loot', dif, 'chanceDeDrop'], { min: 0.01, max: 10, passo: 0.05, dica: 'multiplica a chance de EQUIPAMENTO cair; moedas, gemas e poções não mudam' }),
        campo('chance de +1 modificador (0–1)', ['loot', dif, 'chanceDeModificadorExtra'], { min: 0, max: 1, passo: 0.01, dica: 'limitada ao pool e ao teto da raridade + 1' }),
        campo('tier máximo dos modificadores (1–5)', ['loot', dif, 'tierMaximo'], { min: 1, max: 5, passo: 1, vazioNull: true, dica: 'nunca libera mais do que o Item Level já libera' })),
      pesos('pesos de raridade (× o peso da tabela, depois normaliza para 100%)', ['loot', dif, 'pesosDeRaridade'], RARIDADES, true),
      pesos('pesos dos tiers de modificador (× o peso base, entre os que o Item Level libera)', ['loot', dif, 'pesosDeTier'], [1, 2, 3, 4, 5], false),
      el('h4', {}, 'Tiers de modificador liberados pelo Item Level (igual nas três dificuldades)'),
      el('div', { class: 'dica' }, tab == null ? 'Usando a tabela original de `itens/tiers.json` (pensada para levels muito acima do máximo de equipamento atual: T4 só acima de 600 e T5 só acima de 1200 — com equipamentos só até o level 1000, T5 não é alcançável).' : 'Tabela da progressão em uso.'),
      el('table', { class: 'mob-tabela' }, el('thead', {}, el('tr', {}, ['Até o level', 'Tiers liberados'].map((h) => el('th', {}, h)))), el('tbody', {}, (tab?.itemLevel ?? E.dados.tiersOriginais ?? []).map((f, i, todas) => el('tr', {}, el('td', {}, f.ate ?? 'acima'), el('td', {}, el('input', { value: f.tiers.join(','), disabled: dis() || tab == null, style: 'width:120px', onchange: (e) => { const nova = structuredClone(tab.itemLevel); nova[i].tiers = e.target.value.split(',').map((x) => Number(x.trim())).filter(Number.isFinite); editar(['progressao', 'tiersDeModificador'], { itemLevel: nova }); } })))))),
      !dis() ? el('div', { class: 'linha' }, tab == null ? el('button', { type: 'button', onclick: () => { editar(['progressao', 'tiersDeModificador'], { itemLevel: structuredClone(E.dados.tiersOriginais ?? []) }); pintarAba(); } }, 'Personalizar a tabela de tiers (começa igual à original)') : el('button', { type: 'button', class: 'fantasma', onclick: () => { editar(['progressao', 'tiersDeModificador'], undefined); pintarAba(); } }, 'Voltar à tabela original')) : null);
  }

  function abaComparar() {
    const dist = efetivoEditando();
    const a = dist.find((x) => x.ato === E.ato);
    const linha = (rotulo, fn) => el('tr', {}, el('th', {}, rotulo), DIFICULDADES.map((d) => el('td', {}, fn(a.dificuldades[d]))));
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'dica' }, `Ato ${E.ato} — equipamentos de level ${a.de}–${a.ate} (tiers das bases ${a.tiersDasBases.map((t) => `T${t}`).join('–')}; Item Level de referência ${a.dificuldades.facil.itemLevel}). Distribuições EXATAS das mesmas tabelas que o gerador lê${E.previa ? ' — com as suas edições' : ''}.`),
      el('table', { class: 'mob-tabela prog-comparar' }, el('thead', {}, el('tr', {}, [el('th'), ...DIFICULDADES.map((d) => el('th', {}, nomeDe(d)))])),
        el('tbody', {},
          RARIDADES.map((r) => linha(r, (x) => el('div', { class: 'prog-celula' }, barra(x.raridade[r], COR_DA_RARIDADE[r]), el('span', {}, pct(x.raridade[r], x.raridade[r] < 0.01 ? 3 : 1))))),
          linha('raro ou melhor', (x) => el('b', {}, pct(x.raroOuMelhor, 2))),
          linha('modificadores por item', (x) => x.modificadoresPorItem.toFixed(2)),
          [1, 2, 3, 4, 5].map((t) => linha(`tier de modificador T${t}`, (x) => el('div', { class: 'prog-celula' }, barra(x.tiersFracao[t], 'var(--eng-ouro)'), el('span', {}, pct(x.tiersFracao[t]))))),
          linha('tier médio', (x) => x.tierMedio.toFixed(2)),
          linha('tier 4 ou 5', (x) => pct(x.tierAlto)),
          linha('drop de equipamento', (x) => `${x.chanceDeDrop}×`))),
      el('h4', {}, 'Raro ou melhor, em todos os Atos'),
      el('table', { class: 'mob-tabela' }, el('thead', {}, el('tr', {}, ['Ato', 'Level', ...DIFICULDADES.map(nomeDe), 'tier médio (N / C / M)'].map((h) => el('th', {}, h)))), el('tbody', {}, dist.map((x) => el('tr', { class: x.ato === E.ato ? 'ativa' : '' }, el('td', {}, x.ato), el('td', {}, `${x.de}–${x.ate}`), DIFICULDADES.map((d) => el('td', {}, pct(x.dificuldades[d].raroOuMelhor, 1))), el('td', {}, DIFICULDADES.map((d) => x.dificuldades[d].tierMedio.toFixed(2)).join(' / '))))))
    );
  }

  async function simular() {
    const s = E.sim;
    E.simulando = true; pintarAba();
    try {
      const corpo = { modo: s.modo, ato: s.ato, dificuldade: s.dificuldade, n: s.n, semente: s.semente, slot: s.slot || null, itemId: s.itemId || null, monstro: s.monstro, huntId: s.huntId, ...(s.usarEdicao ? { override: E.ov } : {}) };
      E.resultado = await api('simulador/loot', corpo);
      if (E.resultado.ok === false && E.resultado.erros) msg(E.resultado.erros.join(' '), 'erro');
    } catch (e) { msg(`Não simulou: ${e.message}`, 'erro'); } finally { E.simulando = false; }
    pintarAba();
  }
  function abaSimulador() {
    const s = E.sim;
    const sel = (rotulo, campo, opcoes) => el('label', { class: 'prog-rot' }, rotulo, el('select', { onchange: (e) => { s[campo] = e.target.value; if (campo === 'modo') pintarAba(); } }, opcoes.map(([v, n]) => el('option', { value: v, selected: String(s[campo]) === String(v) }, n))));
    const num = (rotulo, campo, min, max) => el('label', { class: 'prog-rot' }, rotulo, el('input', { type: 'number', min, max, value: s[campo], style: 'width:90px', onchange: (e) => { s[campo] = Number(e.target.value); } }));
    const txt = (rotulo, campo) => el('label', { class: 'prog-rot' }, rotulo, el('input', { type: 'text', value: s[campo], style: 'width:140px', onchange: (e) => { s[campo] = e.target.value.trim(); } }));
    const r = E.resultado;
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'dica' }, 'O simulador usa o gerador REAL de itens (`gerarItem`) com semente: mesma semente = mesmo resultado. Até 50 mil sorteios por pedido.'),
      el('div', { class: 'prog-sim' },
        sel('o que simular', 'modo', [['equipamentos', 'drops de equipamento (por Ato)'], ['monstro', 'abates de um monstro'], ['hunt', 'abates de uma hunt']]),
        sel('Ato (progressão)', 'ato', Array.from({ length: E.dados.efetivo.progressao.atos.length }, (_, i) => [i + 1, `Ato ${i + 1}`])),
        sel('dificuldade', 'dificuldade', [['todas', 'comparar as três'], ...DIFICULDADES.map((d) => [d, nomeDe(d)])]),
        s.modo === 'equipamentos' ? sel('slot', 'slot', SLOTS) : null, s.modo === 'equipamentos' ? txt('base (ID, opcional)', 'itemId') : null,
        s.modo === 'monstro' ? txt('monstro (chave)', 'monstro') : null, s.modo === 'hunt' ? txt('hunt (id)', 'huntId') : null,
        num('quantidade', 'n', 100, 50000), num('semente', 'semente', 1, 4294967295),
        el('label', { class: 'prog-rot' }, el('input', { type: 'checkbox', checked: s.usarEdicao, onchange: (e) => { s.usarEdicao = e.target.checked; } }), 'usar as minhas edições (proposta, sem aplicar)'),
        el('button', { type: 'button', class: 'primario', disabled: E.simulando, onclick: simular }, E.simulando ? 'Simulando…' : 'Simular')),
      r ? (r.ok === false ? el('div', { class: 'bib-alerta' }, r.erro ?? (r.erros ?? []).join(' ')) : resultado(r)) : el('div', { class: 'dica' }, 'Escolha o cenário e clique em Simular.'));
  }
  function resultado(r) {
    const colunas = r.dificuldades ?? [r];
    const nome = (x, i) => x.nome ?? (x.entrada?.dificuldade ? nomeDe(x.entrada.dificuldade) : `#${i + 1}`);
    const linha = (rotulo, fn) => el('tr', {}, el('th', {}, rotulo), colunas.map((x, i) => el('td', {}, fn(x))));
    return el('div', {},
      el('div', { class: 'dica' }, `Semente ${colunas[0].entrada?.semente} · ${colunas[0].amostras ?? colunas[0].entrada?.n} amostra(s)${colunas[0].basesUsadas?.fallback ? ` · SEM bases no Ato: usadas as do Ato ${colunas[0].basesUsadas.atoDasBases} (a distribuição depende do Item Level e da dificuldade, não da base)` : ''}${colunas[0].entrada?.usouConfigProposta ? ' · proposta' : ''}`),
      el('table', { class: 'mob-tabela prog-comparar' }, el('thead', {}, el('tr', {}, [el('th'), ...colunas.map((x, i) => el('th', {}, nome(x, i)))])),
        el('tbody', {},
          colunas[0].equipamentosPorAbate != null ? linha('equipamentos por abate', (x) => x.equipamentosPorAbate.toFixed(3)) : null,
          RARIDADES.map((rr) => linha(rr, (x) => el('div', { class: 'prog-celula' }, barra(x.raridadeFracao[rr], COR_DA_RARIDADE[rr]), el('span', {}, pct(x.raridadeFracao[rr], 2))))),
          linha('raro ou melhor', (x) => el('b', {}, pct(x.raroOuMelhor, 2))),
          linha('modificadores por item', (x) => x.mediaDeModificadores.toFixed(2)),
          el('tr', {}, el('th', {}, 'itens com 0/1/2/3/4+ mods'), colunas.map((x) => el('td', {}, [0, 1, 2, 3, 4].map((k) => (k < 4 ? x.modificadoresPorItem[k] ?? 0 : Object.entries(x.modificadoresPorItem).filter(([m]) => Number(m) >= 4).reduce((a, [, v]) => a + v, 0))).join(' / ')))),
          [1, 2, 3, 4, 5].map((t) => linha(`modificadores de tier T${t}`, (x) => el('div', { class: 'prog-celula' }, barra(x.tiersFracao[t], 'var(--eng-ouro)'), el('span', {}, pct(x.tiersFracao[t]))))),
          linha('tier médio', (x) => x.mediaDeTier.toFixed(2)),
          linha('combinações melhores', (x) => `${pct(x.combinacoesMelhores.fracao, 2)}`),
          linha('(critério)', (x) => el('small', { class: 'dica' }, x.combinacoesMelhores.criterio)),
          colunas[0].teorica ? linha('teórico: raro ou melhor', (x) => pct(x.teorica.raridade.raroOuMelhor, 2)) : null)));
  }

  function abaPerfis() {
    const perfis = Object.entries(E.dados.perfis).filter(([k]) => !k.startsWith('_'));
    return el('div', { class: 'hunt-sec' },
      el('div', { class: 'dica' }, 'Perfis são PROPOSTAS de balanceamento guardadas no arquivo de fábrica: nada vale até você carregar no editor, conferir a comparação e salvar como override.'),
      perfis.length ? perfis.map(([nome, p]) => el('div', { class: 'prog-card' }, el('b', {}, nome), el('span', { class: 'dica' }, p._nota ?? ''),
        el('div', { class: 'linha' },
          el('button', { type: 'button', disabled: dis(), onclick: () => { E.ov = { ativo: true, ...(p.progressao ? { progressao: structuredClone(p.progressao) } : {}), ...(p.loot ? { loot: structuredClone(p.loot) } : {}) }; sujo?.marcar(); previsualizar(); E.aba = 'comparar'; pintar(); msg(`Perfil "${nome}" carregado no editor (ainda não salvo).`, 'aviso'); } }, 'Carregar no editor'),
          el('button', { type: 'button', onclick: () => { E.sim.usarEdicao = true; E.ov = { ativo: true, ...(p.progressao ? { progressao: structuredClone(p.progressao) } : {}), ...(p.loot ? { loot: structuredClone(p.loot) } : {}) }; E.aba = 'simulador'; previsualizar().then(pintar); } }, 'Carregar e ir ao simulador')))) : el('div', { class: 'dica' }, 'Nenhum perfil proposto.'));
  }

  const CORPO = { ato: abaAto, regras: abaRegras, comparar: abaComparar, simulador: abaSimulador, perfis: abaPerfis };
  function pintarAba() { document.querySelector('#prog-aba')?.replaceWith(el('div', { id: 'prog-aba' }, CORPO[E.aba]())); }
  async function trocarAto(n) { E.ato = n; await carregarAto(); pintar(); }

  function pintar() {
    const d = E.dados;
    raiz().replaceChildren(
      cabecalho('Progressão e loot', 'A progressão de equipamentos (Atos, level 1–1000, tiers das bases) é a MESMA nas três dificuldades; a dificuldade só muda as chances de loot. Edita por override: o original nunca é alterado.'),
      el('div', { class: 'bib-alerta prog-aviso' }, `Os equipamentos vão somente até o level ${d.nivelMaximo}. Cruel e Merciless NÃO criam levels de equipamento novos nem novas bases: reutilizam os mesmos Atos e aumentam as oportunidades de itens melhores.`),
      !podeGravar() ? el('div', { class: 'bib-alerta' }, 'Somente leitura neste servidor (produção): dá para ver, comparar e simular, mas não salvar.') : null,
      d.carga?.erros?.length ? el('div', { class: 'bib-alerta' }, `O override gravado foi IGNORADO no boot (inválido): ${d.carga.erros.join(' | ')}`) : null,
      el('div', { class: 'op-linha' }, barraDeEstado(),
        el('button', { id: 'prog-salvar', type: 'button', class: 'primario', disabled: dis() || !alterado() || E.previa?.ok === false, onclick: salvar }, 'Salvar override'),
        el('button', { type: 'button', class: 'perigo', disabled: dis() || !d.override || !Object.keys(d.override).some((k) => !['ativo', '_nota'].includes(k)), onclick: reverter }, 'Reverter ao original'),
        d.versoes.length ? el('label', { class: 'prog-rot' }, 'restaurar versão', el('select', { disabled: dis(), onchange: (e) => { if (e.target.value) restaurar(Number(e.target.value)); e.target.value = ''; } }, [el('option', { value: '' }, '—'), ...d.versoes.map((v) => el('option', { value: v }, `v${v}`))])) : null),
      el('div', { class: 'linha prog-seletores' },
        el('label', { class: 'prog-rot' }, 'Ato', el('select', { onchange: (e) => trocarAto(Number(e.target.value)) }, d.efetivo.progressao.atos.map((a) => el('option', { value: a.ato, selected: a.ato === E.ato }, `Ato ${a.ato} · level ${a.de}–${a.ate}`)))),
        el('label', { class: 'prog-rot' }, 'Dificuldade', el('select', { onchange: (e) => { E.dif = e.target.value; pintarAba(); } }, DIFICULDADES.map((x) => el('option', { value: x, selected: x === E.dif }, nomeDe(x)))))),
      el('div', { class: 'eng-abas' }, ABAS.map(([id, n]) => el('button', { type: 'button', class: E.aba === id ? 'ativa' : '', onclick: () => { E.aba = id; pintar(); } }, n))),
      el('div', { id: 'prog-aba' }, CORPO[E.aba]()),
      blocoDaPrevia());
  }
  return { desenhar, abrir: () => desenhar(), focarBusca: () => {}, sujoAgora: () => !!E.dados && alterado() };
}
