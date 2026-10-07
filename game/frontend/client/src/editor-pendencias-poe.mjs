// A aba PENDÊNCIAS DE MODIFICADORES da engine (dono, 07/10): o estado de cada mod do PoE que pode cair no jogo — afixos, implícitos, únicos
// e frascos — no jogo: funciona, parcial, pendente, não existe no jogo (com o porquê) e lembrete. A mesma tradução do balão da peça.
import { el, cabecalho } from './editor-ui.mjs';

const BASE = '/api/mapas/_engine/itens-poe/';
const api = async (rota) => (await fetch(BASE + rota)).json();
const ESTADOS = {
  funciona: { nome: 'Funciona', simbolo: '✓', dica: 'todas as partes do mod têm efeito no jogo' },
  parcial: { nome: 'Parcial', simbolo: '◐', dica: 'parte do mod tem efeito, parte ainda não' },
  pendente: { nome: 'Pendente', simbolo: '○', dica: 'ainda sem efeito no jogo' },
  inexiste: { nome: 'Não existe no jogo', simbolo: '–', dica: 'mecânica do PoE que o jogo não tem (o porquê ao passar o mouse)' },
  lembrete: { nome: 'Lembrete', simbolo: '·', dica: 'texto de lembrete do PoE (entre parênteses): não é mod' },
};
const ORIGENS = { afixo: 'Afixos (prefixos e sufixos)', implicito: 'Implícitos das bases', unico: 'Únicos', frasco: 'Frascos' };
const PARTE = { equivalente: '✓', aproximado: '≈', novo: '◆', inerte: '–', lembrete: '·', registrado: '○' };

export function criarTelaDasPendenciasPoe({ raiz }) {
  const T = { dados: null, origem: 'todas', estado: 'pendente', busca: '', limite: 300 };

  async function desenhar() {
    const e = await api('estado');
    if (!e.ligado) {
      raiz().replaceChildren(cabecalho('Pendências de modificadores', 'Só no servidor local com ITENS_POE=1.'));
      return;
    }
    T.dados = await api('pendencias');
    pintar();
  }

  function cartao(origem) {
    const r = T.dados.resumo[origem] ?? {};
    const total = Object.values(r).reduce((a, b) => a + b, 0) || 1;
    return el('div', { class: 'eng-painel pend-cartao' }, el('div', { class: 'eng-painel-corpo' },
      el('b', {}, ORIGENS[origem]),
      el('div', { class: 'poe-cobertura' }, Object.keys(ESTADOS).filter((k) => r[k]).map((k) => el('span', { class: `pend-barra ${k}`, style: `flex-basis:${(r[k] / total) * 100}%`, title: `${ESTADOS[k].nome}: ${r[k]}` }))),
      el('div', { class: 'pend-numeros' }, Object.keys(ESTADOS).filter((k) => r[k]).map((k) => el('button', { type: 'button', class: `pend-num ${k}`, title: ESTADOS[k].dica, onclick: () => { T.origem = origem; T.estado = k; pintar(); } }, `${ESTADOS[k].simbolo} ${ESTADOS[k].nome}: ${r[k]}`)))));
  }

  function pintar() {
    const d = T.dados;
    const busca = T.busca.trim().toLowerCase();
    const filtradas = d.linhas.filter((l) => (T.origem === 'todas' || l.origem === T.origem) && (T.estado === 'todos' || l.estado === T.estado)
      && (!busca || l.modelo.toLowerCase().includes(busca) || l.itens.some((i) => i.toLowerCase().includes(busca))));
    // Os mais pesados primeiro (afixos: o peso de drop; únicos: em quantos itens aparece).
    filtradas.sort((a, b) => (b.peso - a.peso) || (b.totalDeItens - a.totalDeItens) || a.modelo.localeCompare(b.modelo));
    const selOrigem = el('select', { onchange: (e) => { T.origem = e.target.value; T.limite = 300; pintar(); } }, [['todas', 'Todas as origens'], ...Object.entries(ORIGENS)].map(([v, n]) => el('option', { value: v, selected: v === T.origem }, n)));
    const selEstado = el('select', { onchange: (e) => { T.estado = e.target.value; T.limite = 300; pintar(); } }, [['todos', 'Todos os estados'], ...Object.entries(ESTADOS).map(([k, v]) => [k, v.nome])].map(([v, n]) => el('option', { value: v, selected: v === T.estado }, n)));
    const campo = el('input', { type: 'search', placeholder: 'Buscar texto do mod ou nome do único…', value: T.busca, oninput: (e) => { T.busca = e.target.value; T.limite = 300; pintar(); setTimeout(() => document.querySelector('#pend-busca')?.focus(), 0); }, id: 'pend-busca' });
    const linha = (l) => el('tr', {},
      el('td', {}, el('em', { class: `pend-marca ${l.estado}`, title: ESTADOS[l.estado]?.dica }, ESTADOS[l.estado]?.simbolo ?? '?')),
      el('td', {}, el('div', {}, l.modelo), l.partes.length > 1
        ? el('div', { class: 'pend-partes' }, l.partes.map((p) => el('span', { class: `poe-tr ${p.estado}`, title: p.nota ?? p.estado }, `${PARTE[p.estado] ?? '?'} ${p.texto}`)))
        : null, l.partes.find((p) => p.nota) ? el('div', { class: 'dica' }, l.partes.find((p) => p.nota).nota) : null),
      el('td', { class: 'dica' }, ORIGENS[l.origem]?.split(' ')[0] ?? l.origem),
      el('td', { class: 'dica' }, l.itens.length ? `${l.itens.slice(0, 3).join(', ')}${l.totalDeItens > 3 ? ` +${l.totalDeItens - 3}` : ''}` : l.classes.slice(0, 3).join(', ')));
    const u = d.unicos;
    raiz().replaceChildren(
      cabecalho('Pendências de modificadores', `O estado de cada mod do PoE que pode cair no jogo, pela mesma tradução do balão da peça. Únicos com todos os mods funcionando: ${u.completos} de ${u.total}.`),
      el('div', { class: 'pend-cartoes' }, Object.keys(ORIGENS).map(cartao)),
      el('div', { class: 'eng-tooltip-barra' }, selOrigem, selEstado, campo, el('button', { type: 'button', onclick: async () => { T.dados = await api('pendencias?recalcular=1'); pintar(); } }, 'Recalcular'), el('span', { class: 'dica' }, `${filtradas.length} mods`)),
      el('div', { class: 'bib-tabela' }, el('table', {},
        el('thead', {}, el('tr', {}, ['', 'Mod', 'Origem', 'Onde aparece'].map((h) => el('th', {}, h)))),
        el('tbody', {}, filtradas.slice(0, T.limite).map(linha)))),
      filtradas.length > T.limite ? el('button', { type: 'button', onclick: () => { T.limite += 300; pintar(); } }, `Mostrar mais (${filtradas.length - T.limite})`) : null,
    );
  }

  return { desenhar };
}
