// A TABELA VISUAL de drops da Engine: o mesmo componente para o loot esperado de uma hunt e para a prévia de uma recompensa de ato.
// Cada linha mostra o sprite real do item, o nome, a chance, a barra do que se espera por execução, o valor e a origem; clicar no
// cabeçalho reordena. Só apresentação: os números vêm do servidor (`admin/hunts.mjs`, `admin/atos.mjs`) — nenhuma conta de jogo aqui.
import { el } from './editor-ui.mjs';
import { retrato } from './editor-sprites.mjs';

const NAO = '—';
export const pct = (n) => (n == null ? NAO : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: n < 1 ? 4 : 2 })}%`);
export const num = (n, casas = 2) => (n == null ? NAO : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: casas }));

/**
 * `linhas`: `[{ id?, nome, desenho?, chancePct?, esperado?, valor?, origem?, aviso? }]`.
 * `esperado` = quedas por execução (a barra é proporcional ao maior da tabela, em escala RAIZ para o raro não sumir ao lado do comum).
 * `rotuloDoEsperado`: o nome da coluna ("Quedas / limpeza", "Esperado / execução"). Devolve o elemento (já ordenável).
 */
export function tabelaDeDrops(linhas, { rotuloDoEsperado = 'Esperado / execução', ordem = 'valor', vazio = 'Nenhum drop.', titulo = null } = {}) {
  const estado = { ordem, desc: true };
  const caixa = el('div', { class: 'drops-tabela' });
  const colunas = [
    ['nome', 'Item'],
    ['chancePct', 'Chance'],
    ['esperado', rotuloDoEsperado],
    ['valor', 'Valor (NPC)'],
    ['origem', 'Origem'],
  ];
  const cmp = (a, b) => {
    const x = a[estado.ordem];
    const y = b[estado.ordem];
    const r = typeof x === 'string' || typeof y === 'string' ? String(x ?? '').localeCompare(String(y ?? ''), 'pt-BR') : (x ?? -Infinity) - (y ?? -Infinity);
    return estado.desc && typeof x !== 'string' ? -r : r;
  };
  function pintar() {
    const maior = Math.max(0, ...linhas.map((l) => Math.sqrt(Math.max(0, l.esperado ?? 0))));
    const ordenadas = [...linhas].sort(cmp);
    caixa.replaceChildren(
      titulo ? el('div', { class: 'drops-titulo' }, titulo) : null,
      linhas.length
        ? el('table', { class: 'drops-grade' },
            el('thead', {}, el('tr', {}, colunas.map(([k, rot]) => el('th', { class: `${estado.ordem === k ? 'ordenada' : ''}`, onclick: () => { if (estado.ordem === k) estado.desc = !estado.desc; else { estado.ordem = k; estado.desc = k !== 'nome' && k !== 'origem'; } pintar(); } }, rot, estado.ordem === k ? (estado.desc ? ' ▼' : ' ▲') : '')))),
            el('tbody', {}, ordenadas.map((l) => el('tr', { class: l.aviso ? 'com-aviso' : '' },
              el('td', { class: 'drops-item' }, retrato(l.desenho ?? null, 32, { categoria: 'itens', rotulo: l.nome ?? String(l.id ?? '') }), el('span', {}, el('b', {}, l.nome ?? (l.id != null ? `item ${l.id}` : NAO)), l.id != null ? el('small', {}, `#${l.id}`) : null, l.aviso ? el('small', { class: 'drops-aviso' }, l.aviso) : null)),
              el('td', { class: 'num' }, pct(l.chancePct)),
              el('td', { class: 'drops-barra-celula' }, l.esperado == null ? NAO : [el('span', { class: 'num' }, num(l.esperado, 4)), el('i', { class: 'drops-barra', style: `width:${maior ? Math.round((Math.sqrt(Math.max(0, l.esperado)) / maior) * 100) : 0}%` })]),
              el('td', { class: 'num' }, l.valor == null ? NAO : num(l.valor, 0)),
              el('td', { class: 'drops-origem' }, l.origem ?? NAO)))))
        : el('div', { class: 'dica' }, vazio),
    );
  }
  pintar();
  return caixa;
}
