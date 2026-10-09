// A aba ABAS DO POEDB da engine (dono, 09/10: "quem tem cada um várias abas, entre em cada aba para extrair as coisas que faltam, utilizando
// para estudar o PoE e implementar tudo"): cada página de classe do poedb (Luvas For, Arcos, Anéis…) com as abas dela — Orbe Vaal, Síntese,
// Labirinto, Golpe, Mesa de Criação, Ungir, Exarca/Devorador e o Spread, Crucible… — e, para cada uma: quantos itens o poedb tem, quantos o
// jogo tem, o que faltava e foi importado, se algum sistema do jogo põe aquele pool numa peça (o "alcance") e o EFEITO dos mods naquela
// classe (a mesma conta da aba Pendências). O manifesto vem do tools/importar-poedb-abas.mjs (extraído com o Scrapling).
import { el, cabecalho } from './editor-ui.mjs';

const BASE = '/api/mapas/_engine/itens-poe/';
const api = async (rota) => (await fetch(BASE + rota)).json();
const ESTADOS = {
  ok: { nome: 'Igual ao poedb', simbolo: '✓', dica: 'tudo o que a aba do poedb tem, o jogo tem' },
  importado: { nome: 'Importado agora', simbolo: '+', dica: 'faltava no jogo e veio das abas do poedb (pools-poedb/)' },
  falta: { nome: 'Falta', simbolo: '!', dica: 'o poedb tem e o jogo ainda não' },
  referencia: { nome: 'Referência', simbolo: '·', dica: 'aba de consulta (habilidades da arma, wiki, atributos, Spread): nada a importar' },
};
const EFEITO = { funciona: 'Funciona', parcial: 'Parcial', pendente: 'Pendente', inexiste: 'Não existe no jogo', lembrete: 'Lembrete' };
const NOME_DO_POOL = {
  corrupted: 'Corrompido (Orbe Vaal)', synthesis: 'Síntese', synthesis_corrupted: 'Síntese corrompida', searing: 'Exarca Cauterizado', eater: 'Devorador de Mundos',
  master: 'Mesa de Criação', labirinto: 'Labirinto', golpe: 'Golpe (Heist)', orbe_incandescente: 'Orbe Incandescente', orbe_instigante: 'Orbe Instigante',
  ungir: 'Ungir (Óleos)', vislumbre_do_caos: 'Vislumbre do Caos', tintura: 'Tinturas', semente_harvest: 'Semente (Harvest)', crucible: 'Crucible',
};

/** A barra do efeito (funciona/parcial/pendente/inexiste) — as mesmas cores da aba Pendências. */
function barra(efeito) {
  if (!efeito) return el('span', { class: 'dica' }, '—');
  const total = Object.values(efeito).reduce((a, b) => a + b, 0) || 1;
  const ordem = ['funciona', 'parcial', 'pendente', 'inexiste', 'lembrete'].filter((k) => efeito[k]);
  return el('div', { class: 'abas-efeito', title: ordem.map((k) => `${EFEITO[k]}: ${efeito[k]}`).join(' · ') },
    el('div', { class: 'poe-cobertura' }, ordem.map((k) => el('span', { class: `pend-barra ${k}`, style: `flex-basis:${(efeito[k] / total) * 100}%` }))),
    el('span', { class: 'dica' }, `✓ ${efeito.funciona ?? 0} de ${total - (efeito.lembrete ?? 0)}`));
}

export function criarTelaDasAbasPoedb({ raiz }) {
  const T = { dados: null, pagina: null, busca: '' };

  async function desenhar() {
    const e = await api('estado');
    if (!e.ligado) {
      raiz().replaceChildren(cabecalho('Abas do PoEDB', 'Este servidor está no Draevor clássico (DRAEVOR_CLASSICO=1): suba sem essa variável.'));
      return;
    }
    T.dados = await api('abas-poedb');
    if (T.dados.ok === false) {
      raiz().replaceChildren(cabecalho('Abas do PoEDB', T.dados.erros?.join(' ') ?? 'Sem o manifesto.'));
      return;
    }
    T.pagina ??= T.dados.paginas.find((p) => p.pagina === 'Gloves_str')?.pagina ?? T.dados.paginas[0]?.pagina;
    pintar();
  }

  /** O quadro dos POOLS: cada um, quantas abas, quantos itens, se o jogo alcança e o efeito geral. */
  function quadroDosPools() {
    const pools = Object.entries(T.dados.resumo.pools).sort((a, b) => (b[1].alcance ? 1 : 0) - (a[1].alcance ? 1 : 0) || b[1].poedb - a[1].poedb);
    return el('div', { class: 'bib-tabela abas-pools' }, el('table', {},
      el('thead', {}, el('tr', {}, ['Pool', 'Abas', 'Itens no poedb', 'Importados', 'No jogo', 'Efeito dos mods'].map((h) => el('th', {}, h)))),
      el('tbody', {}, pools.map(([k, r]) => el('tr', {},
        el('td', {}, el('b', {}, NOME_DO_POOL[k] ?? k)),
        el('td', {}, String(r.abas)),
        el('td', {}, r.poedb.toLocaleString('pt-BR')),
        el('td', {}, r.importados ? r.importados.toLocaleString('pt-BR') : '—'),
        el('td', { class: r.alcance ? '' : 'dica' }, r.alcance ?? 'ainda sem caminho'),
        el('td', {}, barra(r.efeito)))))));
  }

  function pintar() {
    const d = T.dados;
    const busca = T.busca.trim().toLowerCase();
    const paginas = d.paginas.filter((p) => !busca || p.pagina.toLowerCase().includes(busca) || (p.classe ?? '').toLowerCase().includes(busca));
    const atual = d.paginas.find((p) => p.pagina === T.pagina) ?? paginas[0];
    const contagem = (p) => {
      const r = {};
      for (const a of p.abas) r[a.estado] = (r[a.estado] ?? 0) + 1;
      return r;
    };
    const lista = el('div', { class: 'abas-lista' }, paginas.map((p) => {
      const c = contagem(p);
      return el('button', { type: 'button', class: `abas-pagina${p === atual ? ' ativa' : ''}`, onclick: () => { T.pagina = p.pagina; pintar(); } },
        el('span', {}, p.pagina.replace(/_/g, ' ')),
        el('span', { class: 'abas-chips' }, Object.keys(ESTADOS).filter((k) => c[k] && k !== 'referencia').map((k) => el('em', { class: `abas-chip ${k}`, title: ESTADOS[k].nome }, `${ESTADOS[k].simbolo}${c[k]}`))));
    }));
    const linha = (a) => el('tr', {},
      el('td', {}, el('em', { class: `abas-chip ${a.estado}`, title: ESTADOS[a.estado]?.dica }, `${ESTADOS[a.estado]?.simbolo ?? '?'} ${ESTADOS[a.estado]?.nome ?? a.estado}`)),
      el('td', {}, el('div', {}, el('b', {}, a.titulo)), a.pool ? el('div', { class: 'dica' }, `pool: ${NOME_DO_POOL[a.pool] ?? a.pool}`) : null, a.nota ? el('div', { class: 'dica' }, a.nota) : null),
      el('td', { class: 'num' }, a.poedb ? a.poedb.toLocaleString('pt-BR') : '—'),
      el('td', { class: 'num' }, a.tipo === 'referencia' || a.tipo === 'spread' ? '—' : a.jogo.toLocaleString('pt-BR')),
      el('td', { class: a.alcance ? '' : 'dica' }, a.pool ? (a.alcance ?? 'ainda sem caminho') : '—'),
      el('td', {}, a.pool ? barra(a.efeito) : el('span', { class: 'dica' }, '—')),
      el('td', { class: 'dica abas-exemplos' }, (a.exemplos ?? []).slice(0, 3).join(' · ')));
    const r = d.resumo.porEstado;
    raiz().replaceChildren(
      cabecalho('Abas do PoEDB', `Cada aba das ${d.paginas.length} páginas de classe do poedb, comparada com o jogo: ${r.ok ?? 0} iguais, ${r.importado ?? 0} importadas agora, ${r.falta ?? 0} faltando, ${r.referencia ?? 0} de referência. Extraído em ${new Date(d.geradoEm).toLocaleString('pt-BR')}.`,
        el('button', { type: 'button', onclick: async () => { T.dados = await api('abas-poedb?recalcular=1'); pintar(); } }, 'Recalcular efeito')),
      quadroDosPools(),
      el('div', { class: 'abas-corpo' },
        el('div', { class: 'abas-lado' },
          el('input', { type: 'search', id: 'abas-busca', placeholder: 'Buscar classe…', value: T.busca, oninput: (e) => { T.busca = e.target.value; pintar(); setTimeout(() => document.querySelector('#abas-busca')?.focus(), 0); } }),
          lista),
        atual ? el('div', { class: 'abas-detalhe' },
          el('div', { class: 'abas-titulo' }, el('b', {}, atual.pagina.replace(/_/g, ' ')), el('span', { class: 'dica' }, ` ${atual.classe ?? ''}${atual.variante && atual.variante !== '*' ? ` · ${atual.variante}` : ''} · `), el('a', { href: atual.fonte, target: '_blank', rel: 'noopener' }, 'abrir no poedb')),
          el('div', { class: 'bib-tabela abas-tabela' }, el('table', {},
            el('thead', {}, el('tr', {}, ['Estado', 'Aba', 'poedb', 'Jogo', 'No jogo', 'Efeito', 'Exemplos (o que faltava)'].map((h) => el('th', {}, h)))),
            el('tbody', {}, atual.abas.map(linha))))) : null),
    );
  }

  return { desenhar };
}
