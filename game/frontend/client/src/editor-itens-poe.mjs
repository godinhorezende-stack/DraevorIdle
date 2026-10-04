// A tela "Referência PoE → Itens" da engine (Fase 1 do sistema de itens no modelo do PoE): SÓ LEITURA. Mostra o catálogo importado da
// coleção local (classes, bases com os ícones, o pool de prefixos/sufixos por família e tier, os únicos) e um GERADOR de peças de
// exemplo com as regras da documentação (Normal, Mágico, Raro 4–6, Único). Funciona só no servidor com `ITENS_POE=1`; nos outros,
// explica como ligar. Nada aqui muda o jogo atual.
import { el, copiar, cabecalho } from './editor-ui.mjs';

const BASE = '/api/mapas/_engine/itens-poe/';
const api = async (rota) => (await fetch(BASE + rota)).json();
const img = (caminho) => (caminho ? `${BASE}ref/${caminho.split('/').map(encodeURIComponent).join('/')}` : null);
const ROTULO = {
  armadura: 'Armadura', evasao: 'Evasão', escudo_energia: 'Escudo de Energia', velocidade_movimento_pct: 'Velocidade de Movimento',
  chance_bloqueio_pct: 'Chance de Bloqueio', dano_fisico: 'Dano Físico', chance_critico_pct: 'Chance de Crítico', ataques_por_segundo: 'Ataques por Segundo',
  alcance_metros: 'Alcance', dps_fisico_base: 'DPS físico base', protecao: 'Proteção', recupera: 'Recupera', cargas_por_uso: 'Cargas por uso',
  cargas_maximas: 'Cargas máximas', duracao_segundos: 'Duração', tier_talisma: 'Tier do talismã',
};
const SUFIXO = { velocidade_movimento_pct: '%', chance_bloqueio_pct: '%', chance_critico_pct: '%', alcance_metros: ' m', duracao_segundos: ' s' };
const valorDoAtributo = (k, v) => (v && typeof v === 'object' ? `${v.min}–${v.max}` : `${v}${SUFIXO[k] ?? ''}`);
const GRUPO = { Acessorios: 'Acessórios', Armadura: 'Armaduras', Armas_de_Uma_Mao: 'Armas de uma mão', Armas_de_Duas_Maos: 'Armas de duas mãos', Armas_Secundarias: 'Mão secundária', Frascos: 'Frascos', Joias: 'Joias' };
const humano = (id) => id.replace(/_/g, ' ');

/** O ícone da coleção (ou o marcador quando a base não tem imagem). */
const icone = (caminho, tam = 64) => (caminho ? el('img', { class: 'poe-icone', src: img(caminho), width: tam, height: tam, loading: 'lazy', alt: '', onerror: (e) => e.target.replaceWith(el('span', { class: 'poe-icone vazio', style: `width:${tam}px;height:${tam}px` }, '?')) }) : el('span', { class: 'poe-icone vazio', style: `width:${tam}px;height:${tam}px` }, '?'));

/**
 * O balão à moda do PoE para uma peça gerada: nome na cor da raridade (regras da documentação), a base, as propriedades, o implícito e
 * os prefixos/sufixos com o tier. Só desenho — os textos são os da coleção, com os valores sorteados.
 */
function balao(p, regras, baseInfo) {
  const R = regras.raridades[p.raridade] ?? {};
  const linhas = (lista, classe) => lista.map((m) => el('div', { class: `poe-mod ${classe}` }, el('span', {}, m.texto), m.tier != null ? el('i', { title: `${m.familia} · iLvl ${m.ilvl}` }, `${classe === 'pre' ? 'P' : 'S'} T${m.tier}`) : null));
  const sep = () => el('div', { class: 'poe-sep' });
  return el('div', { class: `poe-balao r-${p.raridade}`, style: `--cor:${R.cor ?? '#ddd'}` },
    el('div', { class: 'poe-topo' }, el('b', {}, p.nome), p.nome !== baseInfo?.nome ? el('span', {}, baseInfo?.nome) : null),
    el('div', { class: 'poe-props' }, el('div', { class: 'poe-raridade' }, `${R.nome ?? p.raridade} · Item Level ${p.ilvl}`), Object.entries(p.atributos ?? {}).filter(([k]) => ROTULO[k]).map(([k, v]) => el('div', {}, `${ROTULO[k]}: `, el('b', {}, valorDoAtributo(k, v))))),
    p.implicitos?.length ? [sep(), linhas(p.implicitos, 'imp')] : null,
    p.prefixos?.length || p.sufixos?.length ? [sep(), linhas(p.prefixos ?? [], 'pre'), linhas(p.sufixos ?? [], 'suf')] : null,
    p.modificadores?.length ? [sep(), p.modificadores.map((m) => el('div', { class: 'poe-mod uni' }, m.texto))] : null,
    p.aviso ? el('div', { class: 'poe-aviso' }, p.aviso) : null,
    p.erro ? el('div', { class: 'poe-aviso' }, p.erro) : null);
}

export function criarTelaDeItensPoe({ raiz }) {
  const T = { estado: null, classes: null, classe: null, dados: null, base: null, aba: 'gerar', raridade: 'raro', ilvl: 84, semente: 1, pool: null, filtro: '' };

  async function desenhar() {
    T.estado = await api('estado');
    if (!T.estado.ligado) {
      raiz().replaceChildren(
        cabecalho('Itens (PoE)', 'O sistema de itens no modelo do PoE — Fase 1, só leitura, desligado em produção.'),
        el('div', { class: 'eng-painel' }, el('div', { class: 'eng-painel-corpo' },
          el('p', {}, 'Desligado neste servidor. Para ver o catálogo importado da sua coleção:'),
          el('pre', { class: 'bib-json' }, 'node tools/importar-poe-itens.mjs\nITENS_POE=1 PORTA=8099 node game/backend/index.mjs'),
          el('p', { class: 'dica' }, `Catálogo esperado em ${T.estado.arquivo}. Em produção a coleção não existe: a tela fica sempre assim lá.`))));
      return;
    }
    const c = await api('classes');
    T.classes = c.classes;
    T.relatorio = c.relatorio;
    raiz().replaceChildren(
      cabecalho('Itens (PoE)', `Catálogo importado da coleção (PoEDB): ${c.relatorio.classes} classes, ${c.relatorio.bases} bases, ${c.relatorio.familias} famílias de mod, ${c.relatorio.unicos} únicos. Só leitura — referência local, fora do repositório.`),
      el('div', { class: 'poe-v' }, el('aside', { class: 'poe-classes', id: 'poe-classes' }), el('section', { class: 'poe-bases', id: 'poe-bases' }), el('aside', { class: 'bib-painel', id: 'poe-painel' })));
    pintarClasses();
    await abrirClasse(T.classe ?? T.classes.find((x) => x.id === 'Body_Armours')?.id ?? T.classes[0].id);
  }

  function pintarClasses() {
    const porGrupo = {};
    for (const c of T.classes) (porGrupo[c.grupo] ??= []).push(c);
    document.querySelector('#poe-classes')?.replaceChildren(...Object.entries(porGrupo).flatMap(([g, lista]) => [
      el('div', { class: 'bib-rotulo' }, GRUPO[g] ?? humano(g)),
      ...lista.map((c) => el('button', { type: 'button', class: `bib-cat${c.id === T.classe ? ' ativa' : ''}`, onclick: () => abrirClasse(c.id) }, el('span', {}, humano(c.id)), el('span', { class: 'bib-num' }, c.bases))),
    ]));
  }

  async function abrirClasse(id) {
    T.classe = id;
    T.dados = await api(`classe?id=${encodeURIComponent(id)}`);
    T.base = null;
    pintarClasses();
    pintarBases();
    pintarPainel();
  }

  function pintarBases() {
    const d = T.dados;
    const t = T.filtro.trim().toLowerCase();
    const lista = d.bases.filter((b) => !t || b.nome?.toLowerCase().includes(t) || b.slug.toLowerCase().includes(t));
    const req = (r) => [r?.nivel ? `nv ${r.nivel}` : null, r?.forca ? `${r.forca} For` : null, r?.destreza ? `${r.destreza} Des` : null, r?.inteligencia ? `${r.inteligencia} Int` : null].filter(Boolean).join(' · ');
    document.querySelector('#poe-bases')?.replaceChildren(
      el('div', { class: 'bib-contagem' }, el('b', {}, humano(d.id)), el('span', { class: 'dica' }, `${d.bases.length} bases · ${d.unicos.length} únicos · pools: ${d.paginas.join(', ')}`), el('input', { type: 'search', placeholder: 'Filtrar bases…', value: T.filtro, oninput: (e) => { T.filtro = e.target.value; pintarBases(); } })),
      el('div', { class: 'bib-grade' }, lista.map((b) => el('div', { class: `eng-card${T.base?.id === b.id ? ' selecionado' : ''}`, tabindex: 0, role: 'button', onclick: () => abrirBase(b), onkeydown: (e) => e.key === 'Enter' && abrirBase(b) },
        el('div', { class: 'eng-card-arte' }, icone(b.icone, 64)),
        el('div', { class: 'eng-card-info' }, el('b', { class: 'eng-card-nome' }, b.nome), el('span', { class: 'eng-id' }, b.slug), el('div', { class: 'eng-card-selos' }, req(b.requisitos) ? el('span', { class: 'selo' }, req(b.requisitos)) : null, b.pool ? el('span', { class: 'selo' }, `pool ${b.pool}`) : el('span', { class: 'selo aviso' }, 'sem pool'), b.implicitos.length ? el('span', { class: 'selo usos' }, 'implícito') : null))))));
  }

  async function abrirBase(b) {
    T.base = b;
    T.pool = null;
    pintarBases();
    await pintarPainel();
  }

  async function pintarPainel() {
    const caixa = document.querySelector('#poe-painel');
    if (!caixa) return;
    const b = T.base;
    document.querySelector('.poe-v')?.classList.toggle('painel-largo', !!b);
    if (!b) return caixa.replaceChildren(el('div', { class: 'bib-painel-vazio' }, el('b', {}, 'Escolha uma base'), el('span', { class: 'dica' }, 'Veja o pool de mods dela, gere peças de exemplo em cada raridade e os únicos da classe.')));
    const abas = [['gerar', 'Gerar'], ['pool', 'Mods do pool'], ['unicos', `Únicos (${T.dados.unicos.filter((u) => u.base === b.nome).length})`]];
    const corpo = el('div', { class: 'bib-painel-corpo' }, el('span', { class: 'dica' }, 'Carregando…'));
    caixa.replaceChildren(
      el('div', { class: 'bib-painel-topo poe-topo-base' }, icone(b.icone, 96), el('div', { class: 'bib-painel-titulo' }, el('h2', { class: 'bib-nome' }, b.nome), el('div', { class: 'linha' }, el('span', { class: 'eng-id', style: 'flex:none' }, b.id), el('button', { type: 'button', class: 'eng-copiar', onclick: () => copiar(b.id) }, 'copiar'), el('span')),
        el('div', { class: 'poe-props' }, Object.entries(b.atributos).filter(([k]) => ROTULO[k]).map(([k, v]) => el('div', {}, `${ROTULO[k]}: `, el('b', {}, valorDoAtributo(k, v)))), b.implicitos.map((i) => el('div', { class: 'poe-mod imp' }, i))))),
      el('div', { class: 'eng-abas', role: 'tablist' }, abas.map(([id, nome]) => el('button', { type: 'button', role: 'tab', class: T.aba === id ? 'ativa' : '', onclick: () => { T.aba = id; pintarPainel(); } }, nome))),
      corpo);
    if (T.aba === 'gerar') return corpo.replaceChildren(...(await abaGerar(b)));
    if (T.aba === 'pool') return corpo.replaceChildren(...(await abaPool(b)));
    return corpo.replaceChildren(...abaUnicos(b));
  }

  async function abaGerar(b) {
    const regras = T.estado.regras;
    const selRar = el('select', { onchange: (e) => { T.raridade = e.target.value; pintarPainel(); } }, regras.ordem.map((r) => el('option', { value: r, selected: r === T.raridade }, regras.raridades[r].nome)));
    const nivel = el('input', { type: 'number', min: 1, max: 100, value: T.ilvl, style: 'width:80px', onchange: (e) => { T.ilvl = Number(e.target.value) || 84; pintarPainel(); } });
    const r = await api(`gerar?${new URLSearchParams({ base: b.id, raridade: T.raridade, ilvl: T.ilvl, semente: T.semente, n: 6 })}`);
    return [
      el('div', { class: 'eng-tooltip-barra' }, el('label', { class: 'campo', style: 'flex:none' }, 'Raridade', selRar), el('label', { class: 'campo', style: 'flex:none' }, 'Item Level', nivel),
        el('button', { type: 'button', onclick: () => { T.semente++; pintarPainel(); } }, 'Sortear outras'), el('span', { class: 'dica' }, `semente ${T.semente}`)),
      el('div', { class: 'eng-tooltip-grade' }, r.pecas.map((p) => balao(p, regras, b))),
      el('p', { class: 'dica' }, `Regras da documentação (poe-itens/Raridades): ${regras.ordem.map((x) => { const R = regras.raridades[x]; return R.fixos ? `${R.nome} = mods fixos` : `${R.nome} até ${R.maxPrefixos}+${R.maxSufixos}`; }).join(' · ')}. Quantos mods (regras do dono): ${['magico', 'raro'].map((x) => { const q = regras.raridades[x].quantidade; const t = Object.values(q).reduce((a, b) => a + b, 0); return `${regras.raridades[x].nome} ${Object.entries(q).map(([n, p]) => `${n} = ${Math.round((p / t) * 100)}%`).join(', ')}`; }).join(' · ')}.`),
    ];
  }

  async function abaPool(b) {
    if (!b.pool) return [el('p', { class: 'nao' }, 'A coleção não tem pool de mods para esta base (as peças dela saem sem mods).')];
    const d = await api(`pool?${new URLSearchParams({ base: b.id, ilvl: T.ilvl })}`);
    const tabela = (lista, titulo) => [el('h4', {}, `${titulo} (${lista.length} famílias)`), el('div', { class: 'bib-tabela' }, el('table', {},
      el('thead', {}, el('tr', {}, ['Família', 'Tags', 'Tiers', 'iLvl', '% no lado', `Liberados no iLvl ${d.ilvl}`].map((h) => el('th', {}, h)))),
      el('tbody', {}, lista.map((g) => el('tr', { title: g.tiers.map((t) => `T${t.tier} (iLvl ${t.ilvl}): ${t.texto}`).join('\n') }, el('td', {}, humano(g.familia)), el('td', { class: 'dica' }, g.tags.join(', ')), el('td', { class: 'num' }, g.tiers.length), el('td', { class: 'num' }, `${g.ilvlMin}–${g.ilvlMax ?? '?'}`), el('td', { class: 'num' }, `${g.pct}%`), el('td', { class: 'num' }, g.liberados))))))];
    return [el('p', { class: 'dica' }, `Pool "${d.pagina}" (drop normal). Passe o mouse numa linha para ver os tiers. Item Level dos "liberados": ${d.ilvl} (troque na aba Gerar).`), ...tabela(d.prefixos, 'Prefixos'), ...tabela(d.sufixos, 'Sufixos')];
  }

  function abaUnicos(b) {
    const lista = T.dados.unicos.filter((u) => u.base === b.nome);
    if (!lista.length) return [el('p', { class: 'nao' }, 'Nenhum único desta base na coleção.')];
    return [el('div', { class: 'poe-unicos' }, lista.map((u) => el('div', { class: 'poe-unico' }, icone(u.icone, 64), el('div', {}, el('b', {}, u.nome), u.modificadores.map((m) => el('div', { class: 'poe-mod uni' }, m))))))];
  }

  return { desenhar };
}
