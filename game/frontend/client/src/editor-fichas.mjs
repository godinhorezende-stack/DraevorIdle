// As FICHAS da Engine: peças de apresentação de criatura compartilhadas pela Biblioteca, pela tela Mobs e pelo editor
// de Bosses únicos — elemento com cor e nome, cartão de ataque/magia, barras de resistência e a ficha do monstro em
// abas (Geral, Atributos, Combate, Loot, Visual). Só mostra o que o cadastro traz; o que falta sai "não cadastrado".
import { el, botaoCopiar } from './editor-ui.mjs';
import { retrato, previa } from './editor-sprites.mjs';

const NAO = 'não cadastrado';

/** Os elementos do jogo: nome em português e a cor do selo (a mesma família de cor do dano na tela). */
export const ELEMENTOS = {
  physical: { nome: 'físico', cor: '#c9ced8' },
  fire: { nome: 'fogo', cor: '#ff8a4c' },
  ice: { nome: 'gelo', cor: '#86d6ff' },
  earth: { nome: 'terra', cor: '#93c95a' },
  energy: { nome: 'energia', cor: '#c79bff' },
  death: { nome: 'morte', cor: '#b98bb0' },
  holy: { nome: 'sagrado', cor: '#ffe08a' },
  lifedrain: { nome: 'dreno de vida', cor: '#ff6f8c' },
  manadrain: { nome: 'dreno de mana', cor: '#6fa8ff' },
  drown: { nome: 'afogamento', cor: '#5fd0d3' },
};
export const nomeDoElemento = (e) => ELEMENTOS[e]?.nome ?? e ?? '—';
export const seloDoElemento = (e) => el('span', { class: 'eng-elemento', style: `--cor:${ELEMENTOS[e]?.cor ?? '#9aa3b2'}` }, nomeDoElemento(e));

const FORMA = { alvo: 'no alvo', area: 'em área', feixe: 'em feixe' };
const seg = (ms) => (ms == null ? null : `${Number((ms / 1000).toFixed(1))} s`);
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));

/**
 * Um ATAQUE como cartão (formato do `monstro-poderes.json` / `boss-poderes.json`: `tipo`, `elemento`, `min`, `max`,
 * `intervalo`, `chance`, `forma`, `raio`, `comprimento`, `alcance`, `noAlvo`). Sem JSON: cada número com o rótulo.
 */
export function cartaoDeAtaque(a) {
  const melee = a.tipo === 'melee';
  const detalhes = [
    ['Dano', `${num(a.min)} – ${num(a.max)}`],
    ['A cada', seg(a.intervalo ?? a.intervaloMs)],
    ['Chance', a.chance != null ? `${a.chance}%` : null],
    !melee && a.forma ? ['Forma', `${FORMA[a.forma] ?? a.forma}${a.noAlvo ? ' (centrada no alvo)' : ''}`] : null,
    !melee && a.raio ? ['Raio', `${a.raio} casa(s)`] : null,
    !melee && a.comprimento ? ['Comprimento', `${a.comprimento} casa(s)`] : null,
    !melee && a.alcance ? ['Alcance', `${a.alcance} casa(s)`] : null,
  ].filter((x) => x && x[1] != null);
  return el('div', { class: 'eng-ataque' },
    el('div', { class: 'eng-ataque-topo' }, el('b', {}, melee ? 'Corpo a corpo' : a.nome ?? 'Magia'), melee ? seloDoElemento('physical') : seloDoElemento(a.elemento)),
    el('dl', { class: 'eng-ataque-dl' }, detalhes.map(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])));
}
export function cartaoDeCura(c) {
  return el('div', { class: 'eng-ataque cura' },
    el('div', { class: 'eng-ataque-topo' }, el('b', {}, 'Cura'), el('span', { class: 'eng-elemento', style: '--cor:#5cc28a' }, 'vida')),
    el('dl', { class: 'eng-ataque-dl' }, [['Cura', `${num(c.min)} – ${num(c.max)}`], ['A cada', seg(c.intervalo)], ['Chance', c.chance != null ? `${c.chance}%` : null]].filter(([, v]) => v != null).map(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])));
}

/**
 * As RESISTÊNCIAS como barras: positivo = resiste (verde, para a direita), negativo = fraqueza (vermelho, para a
 * esquerda). Mostra o valor do cadastro; o jogo ainda aplica os tetos (resistência máxima, piso da fraqueza).
 */
export function barrasDeResistencia(mapa) {
  const pares = Object.entries(mapa ?? {}).filter(([, v]) => v != null && Number(v) !== 0);
  if (!pares.length) return el('span', { class: 'nao' }, 'nenhuma (dano normal de todos os elementos)');
  return el('div', { class: 'eng-resist' },
    pares.sort((a, b) => b[1] - a[1]).map(([e, v]) => el('div', { class: 'eng-resist-linha' },
      el('span', { class: 'eng-resist-nome' }, seloDoElemento(e)),
      el('div', { class: 'eng-resist-trilho' }, el('div', { class: `eng-resist-barra ${v > 0 ? 'resiste' : 'fraco'}`, style: `--pct:${Math.min(100, Math.abs(v))}` })),
      el('span', { class: `eng-resist-valor ${v > 0 ? 'resiste' : 'fraco'}` }, `${v > 0 ? '+' : ''}${v}%`))),
    el('div', { class: 'dica' }, 'Valores do cadastro (positivo = resiste, negativo = fraqueza). O jogo ainda aplica os tetos.'));
}

const linhas = (pares) => el('dl', { class: 'bib-dl' }, pares.map(([k, v]) => [el('dt', {}, k), el('dd', {}, v == null || v === '' ? el('span', { class: 'nao' }, NAO) : v)]));

/** Métrica grande (vida, exp…), para o topo de uma aba. */
export const metrica = (rotulo, valor, classe = '') => el('div', { class: `eng-metrica ${classe}` }, el('span', {}, rotulo), el('b', {}, valor == null ? '—' : valor));

/**
 * A FICHA DO MONSTRO em abas. `d` é o detalhe da Biblioteca (`categoria: 'monstros'`). `abrir(categoria, id)` abre
 * outro conteúdo (o item do loot). Devolve `{ abas, corpo(aba) }`.
 */
export function fichaDoMonstro(d, { abrir }) {
  const at = d.atributos ?? {};
  const loot = d.drops?.itens ?? [];
  const habilidades = d.habilidades ?? [];
  const abas = [['geral', 'Geral'], ['atributos', 'Atributos'], ['combate', `Combate (${habilidades.length + (d.curas?.length ?? 0)})`], ['loot', `Loot (${loot.length})`], ['visual', 'Visual']];
  const corpo = (aba) => {
    if (aba === 'geral') {
      const b = d.bestiario ?? {};
      return [
        linhas([['Nome', d.nome], ['ID', el('span', { class: 'eng-id' }, d.id)], ['Classe', b.classe], ['Raça', at.raca], ['Estrelas', at.estrelas != null ? '★'.repeat(at.estrelas) || '0' : null], ['Boss do bestiário', d.tipo === 'boss' ? 'sim' : 'não']]),
        el('h4', {}, 'Bestiário'),
        linhas([['Abates para completar', b.abatesParaCompletar != null ? num(b.abatesParaCompletar) : null], ['Pontos de charm', b.pontosDeCharm], ['Ocorrência', b.ocorrencia], ['Onde vive (Tibia)', b.ondeVive]]),
        el('h4', {}, 'Descrição e lore'),
        el('p', { class: 'nao' }, 'O bestiário não tem descrição nem lore para monstros comuns (só os bosses únicos têm).'),
        el('p', { class: 'dica' }, 'Nível: o monstro não tem nível próprio — ele vem da hunt (e dos modificadores de raridade).'),
      ];
    }
    if (aba === 'atributos') {
      return [
        el('div', { class: 'eng-metricas' }, metrica('Vida', num(at.hp)), metrica('Experiência', num(at.exp)), metrica('Armadura', at.armadura ?? '—'), metrica('Velocidade', at.velocidade ?? '—')),
        el('h4', {}, 'Resistências'),
        barrasDeResistencia(d.resistencias),
        el('p', { class: 'dica' }, 'Atributos base do bestiário. Na hunt eles são escalados pelo nível da fase e pela raridade do bicho.'),
      ];
    }
    if (aba === 'combate') {
      return [
        habilidades.length ? el('div', { class: 'eng-ataques' }, habilidades.map(cartaoDeAtaque)) : el('p', { class: 'nao' }, 'Sem ataques cadastrados em monstro-poderes.json (usa o corpo a corpo padrão do jogo).'),
        d.curas?.length ? [el('h4', {}, 'Defesas'), el('div', { class: 'eng-ataques' }, d.curas.map(cartaoDeCura))] : null,
        el('p', { class: 'dica' }, 'Fonte: monstro-poderes.json / boss-poderes.json (os monster.lua do Canary). O comportamento de IA e movimento é o padrão do jogo para todos os monstros.'),
      ];
    }
    if (aba === 'loot') {
      if (!loot.length) return el('p', { class: 'nao' }, 'Sem loot cadastrado.');
      return [
        el('div', { class: 'bib-tabela' }, el('table', {},
          el('thead', {}, el('tr', {}, ['Item', 'Nome', 'Chance', '1 em'].map((h) => el('th', {}, h)))),
          el('tbody', {}, [...loot].sort((a, b) => (b.chancePct ?? 0) - (a.chancePct ?? 0)).map((l) => el('tr', {},
            el('td', {}, el('button', { type: 'button', class: 'bib-ref', title: `Abrir o item ${l.item}`, onclick: () => abrir('itens', String(l.item)) }, retrato({ tipo: 'item', id: Number(l.item) }, 28, { categoria: 'itens' }), el('span', { class: 'eng-id' }, String(l.item)))),
            el('td', {}, l.nome ?? el('span', { class: 'nao' }, 'item inexistente')),
            el('td', { class: 'num' }, l.chancePct != null ? `${l.chancePct}%` : '—'),
            el('td', { class: 'num dica' }, l.chancePct ? num(Math.round(100 / l.chancePct)) : '—')))))),
        el('p', { class: 'dica' }, d.drops?.modelo ?? ''),
      ];
    }
    if (aba === 'visual') {
      const sp = d.sprite ?? {};
      const criatura = d.desenho?.tipo === 'criatura';
      return [
        previa(d.desenho, { categoria: 'monstros', tamanhos: [96, 160, 256] }),
        criatura ? [el('h4', {}, 'As 4 direções'), el('div', { class: 'eng-direcoes' }, ['norte', 'leste', 'sul', 'oeste'].map((n, i) => el('figure', {}, retrato(d.desenho, 72, { categoria: 'monstros', dir: i, animar: true }), el('figcaption', {}, n))))] : null,
        el('h4', {}, 'Referências do sprite'),
        linhas([['Look (outfit)', sp.look || null], ['Look de item', sp.lookItem || null], ['Cores', sp.cores ? `cabeça ${sp.cores.head} · corpo ${sp.cores.body} · pernas ${sp.cores.legs} · pés ${sp.cores.feet}` : null]]),
        el('div', { class: 'linha' }, d.desenho ? botaoCopiar(JSON.stringify(d.desenho), 'a referência do sprite') : el('span', { class: 'nao' }, 'sem sprite nos atlas do cliente'), el('span')),
      ];
    }
    return null;
  };
  return { abas, corpo };
}
