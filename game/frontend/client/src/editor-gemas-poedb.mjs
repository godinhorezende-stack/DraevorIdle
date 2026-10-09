// A aba GEMAS × POEDB da engine (dono, 09/10: "mapeie Skill_Gems e Support_Gems e suas abas; ao entrar em cada gema verifique tudo — a
// missão, o level effect e a imagem da gema e da skill da barra — e confronte"; "colocar todas as gemas para funcionar, visualmente e
// efetivamente"): cada gema do poedb com as duas imagens (a da gema e a da habilidade, a que vai na barra), se está no jogo, o estado no
// motor (funciona/parcial, com os motivos) e o que difere do poedb (texto, tabela por nível, missão).
import { el, cabecalho } from './editor-ui.mjs';

const BASE = '/api/mapas/_engine/itens-poe/';
const api = async (rota) => (await fetch(BASE + rota)).json();
const ESTADO = {
  funciona: { nome: 'Funciona', simbolo: '✓' },
  parcial: { nome: 'Parcial', simbolo: '◐' },
  naoExiste: { nome: 'Não está no jogo', simbolo: '–' },
  semRegistro: { nome: 'Sem registro no motor', simbolo: '?' },
};
const TIPO = { ativa: 'Gemas de Habilidade', suporte: 'Gemas de Suporte', desperta: 'Suportes Despertos' };

/** A imagem (a da gema pelo poedb, a da habilidade pela do jogo); some se não houver. */
const imagem = (src, titulo, tamanho = 40) => (src ? el('img', { src, title: titulo, alt: '', width: tamanho, height: tamanho, loading: 'lazy', style: `width:${tamanho}px;height:${tamanho}px;object-fit:contain`, onerror: (e) => (e.target.style.opacity = '0.15') }) : el('span', { class: 'gp-sem-img', title: `${titulo}: não há` }, '—'));

export function criarTelaDasGemasPoedb({ raiz }) {
  const T = { dados: null, tipo: 'ativa', filtro: 'problemas', busca: '', limite: 200 };

  async function desenhar() {
    const e = await api('estado');
    if (!e.ligado) {
      raiz().replaceChildren(cabecalho('Gemas × PoEDB', 'Este servidor está no Draevor clássico (DRAEVOR_CLASSICO=1): suba sem essa variável.'));
      return;
    }
    T.dados = await api('gemas-poedb');
    if (T.dados.ok === false) {
      raiz().replaceChildren(cabecalho('Gemas × PoEDB', T.dados.erros?.join(' ') ?? 'Sem o manifesto.'));
      return;
    }
    pintar();
  }

  function pintar() {
    const d = T.dados;
    const busca = T.busca.trim().toLowerCase();
    const FILTROS = {
      todas: () => true,
      problemas: (g) => g.problemas.length || g.estado !== 'funciona',
      parcial: (g) => g.estado === 'parcial',
      naoExiste: (g) => !g.noJogo,
      niveis: (g) => g.problemas.includes('tabela por nível'),
      missao: (g) => g.problemas.includes('missão'),
      icone: (g) => g.problemas.includes('sem ícone de habilidade'),
    };
    const lista = d.gemas.filter((g) => g.tipo === T.tipo && FILTROS[T.filtro](g) && (!busca || g.nome.toLowerCase().includes(busca) || g.slug.toLowerCase().includes(busca)));
    const contaTipo = (t) => d.gemas.filter((g) => g.tipo === t).length;
    const linha = (g) => {
      const c = g.comparacao;
      const detalhes = [];
      if (c?.niveis && (c.niveis.diferentes || c.niveis.niveisPoedb !== c.niveis.niveisJogo)) detalhes.push(`tabela por nível: ${c.niveis.diferentes} de ${c.niveis.niveisPoedb} níveis diferentes (agora o jogo usa a do poedb)`);
      for (const o of c?.missao?.faltamNoJogo ?? []) detalhes.push(`missão — falta no jogo: ${o.tipo} em "${o.missao}" (Ato ${o.ato}) para ${o.classes.join(', ')}`);
      for (const o of c?.missao?.soNoJogo ?? []) detalhes.push(`missão — só no jogo: ${o.tipo} em "${o.missao}" (Ato ${o.ato}) para ${o.classes.join(', ')}`);
      for (const k of ['tags', 'propriedades', 'mods', 'qualidade']) if (c && !c[k].iguais) detalhes.push(`${k}: no poedb "${c[k].soNoPoedb.join(' · ')}" / no jogo "${c[k].soNoJogo.join(' · ')}"`);
      return el('tr', {},
        el('td', { class: 'gp-imgs' }, imagem(g.iconeGema, 'a gema (poedb)'), imagem(g.iconeHabilidade ? `/api/jogo/poe/icone/habilidade/${encodeURIComponent(g.iconeHabilidade)}` : null, 'a habilidade (a barra de slots)')),
        el('td', {}, el('b', {}, g.nome), el('div', { class: 'dica' }, `${g.slug}${g.transfigurada ? ' · transfigurada' : ''} · `, el('a', { href: g.fonte, target: '_blank', rel: 'noopener', class: 'gp-link' }, 'poedb'))),
        el('td', {}, el('em', { class: `gp-estado ${g.estado}`, title: (g.motivos ?? []).join('\n') }, `${ESTADO[g.estado]?.simbolo ?? '?'} ${ESTADO[g.estado]?.nome ?? g.estado}`),
          (g.motivos ?? []).length ? el('div', { class: 'gp-motivos' }, g.motivos.slice(0, 4).map((m) => el('div', {}, `· ${m}`))) : null),
        el('td', { class: 'gp-detalhes' }, detalhes.length ? detalhes.slice(0, 6).map((x) => el('div', {}, x)) : el('span', { class: 'dica' }, 'igual ao poedb')));
    };
    const r = d.resumo;
    raiz().replaceChildren(
      cabecalho('Gemas × PoEDB', `As ${r.total} gemas do poedb (${contaTipo('ativa')} de habilidade, ${contaTipo('suporte')} de suporte, ${contaTipo('desperta')} despertas) comparadas com o jogo: ${r.noJogo} no jogo, ${r.porEstado.funciona ?? 0} funcionando inteiras, ${r.porEstado.parcial ?? 0} em parte.`,
        el('button', { type: 'button', onclick: async () => { T.dados = await api('gemas-poedb?recalcular=1'); pintar(); } }, 'Recalcular')),
      el('div', { class: 'gp-resumo' }, Object.entries(r.problemas).sort((a, b) => b[1] - a[1]).map(([k, v]) => el('span', { class: 'gp-chip' }, `${k}: ${v}`))),
      el('div', { class: 'eng-tooltip-barra' },
        el('select', { onchange: (e) => { T.tipo = e.target.value; T.limite = 200; pintar(); } }, Object.entries(TIPO).map(([v, n]) => el('option', { value: v, selected: v === T.tipo }, `${n} (${contaTipo(v)})`))),
        el('select', { onchange: (e) => { T.filtro = e.target.value; T.limite = 200; pintar(); } }, [['problemas', 'Com algo a fazer'], ['todas', 'Todas'], ['parcial', 'Funciona em parte'], ['naoExiste', 'Não estão no jogo'], ['niveis', 'Tabela por nível diferente'], ['missao', 'Missão diferente'], ['icone', 'Sem ícone de habilidade']].map(([v, n]) => el('option', { value: v, selected: v === T.filtro }, n))),
        el('input', { type: 'search', id: 'gp-busca', placeholder: 'Buscar gema…', value: T.busca, oninput: (e) => { T.busca = e.target.value; T.limite = 200; pintar(); setTimeout(() => document.querySelector('#gp-busca')?.focus(), 0); } }),
        el('span', { class: 'dica' }, `${lista.length} gemas`)),
      el('div', { class: 'bib-tabela gp-tabela' }, el('table', {},
        el('thead', {}, el('tr', {}, ['Gema · Habilidade', 'Nome', 'No jogo', 'Diferente do poedb'].map((h) => el('th', {}, h)))),
        el('tbody', {}, lista.slice(0, T.limite).map(linha)))),
      lista.length > T.limite ? el('button', { type: 'button', onclick: () => { T.limite += 200; pintar(); } }, `Mostrar mais (${lista.length - T.limite})`) : null,
    );
  }

  return { desenhar };
}
