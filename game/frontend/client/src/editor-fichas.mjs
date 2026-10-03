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

// ------------------------------------------------------------------ item

const SLOT = { weapon: 'arma', shield: 'escudo / mão secundária', head: 'cabeça', body: 'peito', legs: 'pernas', feet: 'pés', neck: 'amuleto', ring: 'anel', ammo: 'munição', backpack: 'mochila' };
export const nomeDoSlot = (s) => SLOT[s] ?? s ?? '—';
const RARIDADE_CLASSE = { comum: 'r-comum', incomum: 'r-incomum', raro: 'r-raro', 'épico': 'r-epico', 'lendário': 'r-lendario', 'mítico': 'r-mitico' };
const seloDaRaridade = (r, nome = r) => el('span', { class: `selo ${RARIDADE_CLASSE[r] ?? ''}` }, nome);
const pesos = (tab) => {
  const total = Object.values(tab ?? {}).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(tab ?? {}).map(([k, p]) => `${k} (${Math.round((p / total) * 100)}%)`).join(' · ');
};
const faixa = ([a, b]) => (a === b ? num(a) : `${num(a)}–${num(b)}`);
const CAMPO_DA_BASE = { attack: 'Ataque', defense: 'Defesa', armor: 'Armadura' };
const PODER = { lendario: 'poder lendário', mitico: 'poder mítico' };

/** As chances de N sockets abertos numa peça nova, na mesma conta do drop (o peso de N acima do máximo vira o máximo). */
function chancesDeSockets(regra, maximo) {
  const somas = {};
  for (const [n, p] of Object.entries(regra.abertos)) somas[Math.min(maximo, Number(n))] = (somas[Math.min(maximo, Number(n))] ?? 0) + p;
  const total = Object.values(somas).reduce((a, b) => a + b, 0) || 1;
  return Array.from({ length: maximo + 1 }, (_, n) => ((somas[n] ?? 0) / total) * 100);
}

/**
 * A FICHA DO ITEM em abas: Geral, Atributos, Sockets, Visual, Loot e Tooltip (a prévia com o balão do jogo).
 * `api` busca os dados do tooltip; `abrir` abre outro conteúdo (o monstro que solta o item).
 */
export function fichaDoItem(d, { abrir, api }) {
  const r = d.regras;
  const fontes = (d.usadoEm ?? []).filter((u) => u.categoria === 'monstros' || u.categoria === 'encontros');
  const abas = [['geral', 'Geral'], ...(r ? [['atributos', 'Atributos'], ...(r.sockets ? [['sockets', 'Sockets']] : [])] : []), ['visual', 'Visual'], ['loot', `Loot (${fontes.length})`], ['tooltip', 'Tooltip']];
  const corpo = (aba) => {
    if (aba === 'geral') {
      return [
        linhas([['Nome', d.nome], ['ID', el('span', { class: 'eng-id' }, d.id)], ['Tipo', d.tipo], ['Slot', d.slot ? nomeDoSlot(d.slot) : null], ['Equipável', d.equipavel ? 'sim' : 'não'],
          ['Raridade', d.equipavel ? el('span', { class: 'dica' }, 'definida no drop (cada peça sorteia a sua)') : d.raridade ? seloDaRaridade(d.raridade) : null],
          ['Nível mínimo', d.requisitos?.nivelMinimo], ['Vocações', d.requisitos?.vocacoes?.join(', ') ?? (d.equipavel ? 'todas' : null)],
          ['Peso', d.peso != null ? `${num(d.peso)} oz` : null], ['Empilhável', d.empilhavel ? 'sim' : 'não'], ['Compra (NPC)', d.compra != null ? `${num(d.compra)} gp` : null], ['Venda (NPC)', d.venda != null ? `${num(d.venda)} gp` : null], ['NPC', d.npc],
          ['Imbuements', d.imbuements ? `${d.imbuements.slots} slot(s)` : null]]),
        el('p', { class: 'dica' }, 'Descrição e lore: o catálogo de itens (Canary) não tem esses campos.'),
      ];
    }
    if (aba === 'atributos' && r) {
      const b = d.base ?? {};
      return [
        el('div', { class: 'eng-metricas' }, b.ataque != null ? metrica('Ataque', b.ataque) : null, b.defesa != null ? metrica('Defesa', `${b.defesa}${b.defesaExtra ? ` +${b.defesaExtra}` : ''}`) : null, b.armadura != null ? metrica('Armadura', b.armadura) : null, b.alcance != null ? metrica('Alcance', b.alcance) : null),
        b.elemento ? el('div', { class: 'linha' }, el('span', { class: 'dica', style: 'flex:none' }, 'Dano elemental:'), el('span', { style: 'flex:none' }, seloDoElemento(b.elemento.type)), el('b', { style: 'flex:none' }, `+${b.elemento.value}`), el('span')) : null,
        b.duasMaos ? el('p', { class: 'dica' }, 'Arma de duas mãos.') : null,
        el('h4', {}, 'O que cada raridade dá à peça'),
        el('div', { class: 'bib-tabela' }, el('table', {},
          el('thead', {}, el('tr', {}, ['Raridade', 'Atributos (quantos)', 'Faixa da base', 'Poder'].map((h) => el('th', {}, h)))),
          el('tbody', {}, Object.entries(r.porRaridade).map(([id, x]) => el('tr', {},
            el('td', {}, seloDaRaridade(id, x.nome)),
            el('td', {}, pesos(x.quantosAtributos)),
            el('td', {}, Object.entries(x.faixaDaBase).map(([c, f]) => el('div', {}, `${CAMPO_DA_BASE[c] ?? c} ${faixa(f)}`)), x.conteudoDaJoia ? el('div', { class: 'dica' }, pesos(x.conteudoDaJoia)) : null),
            el('td', {}, x.poder ? `${PODER[x.poder] ?? x.poder} (${Math.round((x.chanceDoPoder ?? 1) * 100)}%)` : '—')))))),
        el('p', { class: 'dica' }, 'Faixa da base = o número do catálogo × a faixa da raridade (piso mínimo a teto máximo). A armadura ainda vira Armour / Evasion / Energy Shield pela vocação da peça.'),
        el('h4', {}, `Atributos que podem sair (${r.atributosPossiveis.length})`),
        r.atributosPossiveis.length ? el('div', { class: 'bib-tabela' }, el('table', {},
          el('thead', {}, el('tr', {}, ['Atributo', 'Tipo', 'Peso', 'T1', 'T2', 'T3', 'T4', 'T5', 'Nível mín.'].map((h) => el('th', {}, h)))),
          el('tbody', {}, r.atributosPossiveis.map((a) => el('tr', {}, el('td', {}, a.nome), el('td', { class: 'dica' }, a.tipo === 'flat' ? 'valor' : a.tipo === 'pct' ? '%' : a.tipo ?? ''), el('td', { class: 'num' }, a.peso ?? '—'), ...[1, 2, 3, 4, 5].map((t) => el('td', { class: 'num' }, a.faixasPorTier?.[t] ? faixa(a.faixasPorTier[t]) : '—')), el('td', { class: 'num' }, a.nivelMinimo ?? '—')))))) : el('p', { class: 'nao' }, 'Este item não recebe atributos.'),
        el('p', { class: 'dica' }, 'Fonte: itens/raridades.json, pools.json e atributos.json (as mesmas regras do drop).'),
      ];
    }
    if (aba === 'sockets' && r?.sockets) {
      const s = r.sockets;
      return [
        el('div', { class: 'eng-metricas' }, metrica('Máximo do slot', s.maximo)),
        el('div', { class: 'eng-sockets' }, Array.from({ length: s.maximo }, (_, i) => [el('span', { class: 'eng-socket' }), i < s.maximo - 1 ? el('span', { class: 'eng-link' }) : null])),
        el('h4', {}, 'Sockets abertos numa peça nova, por raridade'),
        el('div', { class: 'bib-tabela' }, el('table', {},
          el('thead', {}, el('tr', {}, ['Raridade', ...Array.from({ length: s.maximo + 1 }, (_, n) => `${n} aberto(s)`), 'Chance de link'].map((h) => el('th', {}, h)))),
          el('tbody', {}, Object.entries(s.porRaridade).map(([id, regra]) => el('tr', {}, el('td', {}, seloDaRaridade(id)), ...chancesDeSockets(regra, s.maximo).map((p) => el('td', { class: 'num' }, p ? `${Number(p.toFixed(1))}%` : '—')), el('td', { class: 'num' }, `${Math.round(regra.chanceDeLink * 100)}%`)))))),
        el('p', { class: 'dica' }, 'Cada par de sockets vizinhos abertos é ligado com a chance de link da raridade. Sockets e links não contam como modificador. Não há cor de socket neste jogo: qualquer gema entra em qualquer socket aberto, e uma gema de suporte só vale para a gema ativa do mesmo grupo ligado quando as tags combinam.'),
      ];
    }
    if (aba === 'visual') {
      return [previa(d.desenho, { categoria: 'itens', tamanhos: [64, 128, 192] }), linhas([['Sprite nos atlas', d.desenho ? 'sim' : el('span', { class: 'nao' }, 'não — o jogo mostra o marcador "?"')]])];
    }
    if (aba === 'loot') {
      const chance = (u) => Number(/\(([\d.]+)%\)/.exec(u.como)?.[1] ?? 0);
      return [
        d.chanceBase != null ? linhas([['Chance base do catálogo', `${d.chanceBase}%`]]) : null,
        fontes.length ? el('div', { class: 'bib-usos' }, [...fontes].sort((a, b) => chance(b) - chance(a)).map((u) => el('button', { type: 'button', class: 'bib-uso', onclick: () => abrir(u.categoria, u.id) }, el('span', { class: 'selo' }, u.categoria === 'monstros' ? 'Monstro' : 'Encontro'), el('b', {}, u.nome), el('span', { class: 'dica' }, u.como)))) : el('p', { class: 'nao' }, 'Nenhum monstro nem encontro solta este item.'),
      ];
    }
    if (aba === 'tooltip') return previaDoTooltip(d, api);
    return null;
  };
  // As abas com tabela larga e o balão do jogo pedem o painel largo (a Biblioteca alarga sozinha nelas).
  return { abas, corpo, largas: ['atributos', 'sockets', 'tooltip'] };
}

/**
 * A PRÉVIA DO TOOLTIP: o balão REAL do jogo (`fichaDeItem` de tooltip.mjs, a mesma folha balao-item.css), para o item
 * como vem da loja/kit (sem atributos) e para peças de EXEMPLO sorteadas pelo gerador do jogo em cada raridade.
 */
function previaDoTooltip(d, api) {
  const caixa = el('div', { class: 'eng-tooltips' }, el('span', { class: 'dica' }, 'Carregando o balão do jogo…'));
  const estado = { itemLevel: '', semente: 1 };
  const pintar = async () => {
    const [Tooltip, dados] = await Promise.all([import('./tooltip.mjs'), api(`biblioteca/tooltip?${new URLSearchParams({ id: d.id, itemLevel: estado.itemLevel, semente: estado.semente })}`)]);
    if (dados.ok === false) return caixa.replaceChildren(el('p', { class: 'erro-txt' }, dados.erros?.[0] ?? 'Sem dados.'));
    estado.itemLevel = dados.itemLevel;
    Tooltip.usarDados(dados.itens, null, dados.catalogo);
    const balao = (peca) => {
      const f = Tooltip.fichaDeItem(Number(d.id), null, null, peca);
      if (!f) return el('span', { class: 'nao' }, 'sem balão');
      const no = el('div', { class: `tooltip ${f.classe}` });
      no.append(...f.partes);
      return no;
    };
    const nivel = el('input', { type: 'number', min: 1, max: 2000, value: estado.itemLevel, style: 'width:90px' });
    nivel.addEventListener('change', () => { estado.itemLevel = nivel.value; pintar(); });
    caixa.replaceChildren(
      el('div', { class: 'eng-tooltip-barra' },
        el('label', { class: 'campo', style: 'flex:none' }, 'Item Level dos exemplos', nivel),
        dados.exemplos.length ? el('button', { type: 'button', onclick: () => { estado.semente += 1; pintar(); } }, 'Sortear outros exemplos') : null,
        el('span', { class: 'dica' }, `semente ${dados.semente}`)),
      el('div', { class: 'eng-tooltip-grade' },
        el('figure', {}, el('figcaption', {}, 'Da loja / kit (sem atributos)'), balao(null)),
        dados.exemplos.map((x) => el('figure', {}, el('figcaption', {}, seloDaRaridade(x.raridade), ' exemplo sorteado'), balao(x.peca)))),
      el('p', { class: 'dica' }, dados.exemplos.length ? 'Os exemplos saem do MESMO sorteio do drop (gerarItem), com semente fixa: mostram o que pode cair, não uma peça de alguém. O balão é o do jogo — nada é escrito à mão aqui.' : 'Este item não recebe atributos: o balão é sempre este.'));
  };
  pintar();
  return caixa;
}

// ------------------------------------------------------------------ outfit e montaria

const BONECO_PADRAO = 128; // o Citizen masculino: o boneco que monta a montaria na prévia

/** A FICHA DO OUTFIT: Visual (direções), Variações (addons e montado) e Geral. */
export function fichaDoOutfit(d) {
  const abas = [['visual', 'Visual'], ['variacoes', 'Variações'], ['geral', 'Geral']];
  const desenho = (cores) => ({ tipo: 'criatura', look: d.look, cores });
  const corpo = (aba) => {
    if (aba === 'visual') return [previa(d.desenho, { categoria: 'outfits', tamanhos: [96, 160, 256] }), el('h4', {}, 'As 4 direções'), direcoes(d.desenho, 'outfits')];
    if (aba === 'variacoes') {
      return [
        el('h4', {}, 'Addons'),
        el('div', { class: 'eng-direcoes' }, [['sem addon', 0], ['addon 1', 1], ['addon 2', 2], ['os dois', 3]].map(([nome, n]) => el('figure', {}, retrato(desenho({ addons: n }), 88, { categoria: 'outfits', animar: true }), el('figcaption', {}, nome)))),
        el('p', { class: 'dica' }, 'Na paleta padrão do jogo (o jogador escolhe as cores de cabeça, corpo, pernas e pés). Outfit sem addon desenhado mostra o mesmo boneco nas quatro.'),
        el('h4', {}, 'Montado'),
        el('div', { class: 'eng-direcoes' }, ['norte', 'leste', 'sul', 'oeste'].map((n, i) => el('figure', {}, retrato(desenho({ mount: 368 }), 96, { categoria: 'outfits', dir: i, animar: true }), el('figcaption', {}, n)))),
        el('p', { class: 'dica' }, 'Sobre a Widow Queen (montaria 1), só para ver a pose montada.'),
      ];
    }
    if (aba === 'geral') return linhas([['Nome', d.nome], ['Look', el('span', { class: 'eng-id' }, d.look)], ['Sexo', d.tipo], ['Como se obtém', d.gratis ? 'grátis (todo personagem tem)' : 'Store'], ['Preço', d.gratis ? null : d.preco != null ? `${d.preco} moedas` : null], ['Premium', d.premium ? 'sim' : 'não'], ['Coleção', d.colecao ? `+${(d.colecao.criticoPorPeca * 100).toFixed(1)}% de chance de crítico por peça` : 'não conta (é grátis)']]);
    return null;
  };
  return { abas, corpo };
}

/** A FICHA DA MONTARIA: Visual, Com personagem (as 4 direções montado) e Geral. */
export function fichaDaMontaria(d) {
  const abas = [['visual', 'Visual'], ['montado', 'Com personagem'], ['geral', 'Geral']];
  const corpo = (aba) => {
    if (aba === 'visual') return [previa(d.desenho, { categoria: 'montarias', tamanhos: [96, 160, 256] }), el('h4', {}, 'As 4 direções'), direcoes(d.desenho, 'montarias')];
    if (aba === 'montado') return [direcoes({ tipo: 'criatura', look: BONECO_PADRAO, cores: { mount: d.look } }, 'montarias', 110), el('p', { class: 'dica' }, 'O Citizen (outfit padrão) montado, como o jogo desenha no mapa.')];
    if (aba === 'geral') return linhas([['Nome', d.nome], ['ID', el('span', { class: 'eng-id' }, d.id)], ['Look', el('span', { class: 'eng-id' }, d.look)], ['Velocidade', d.velocidade != null ? `+${d.velocidade}` : null], ['Como se obtém', { quest: 'quest', store: 'Store', arena: 'arena' }[d.tipo] ?? d.tipo], ['Preço', d.preco != null ? `${d.preco} moedas` : null], ['Premium', d.premium ? 'sim' : 'não'], ['Coleção', `+${(d.colecao.criticoPorPeca * 100).toFixed(1)}% de chance de crítico por peça`]]);
    return null;
  };
  return { abas, corpo };
}

const direcoes = (desenho, categoria, tam = 80) => el('div', { class: 'eng-direcoes' }, ['norte', 'leste', 'sul', 'oeste'].map((n, i) => el('figure', {}, retrato(desenho, tam, { categoria, dir: i, animar: true }), el('figcaption', {}, n))));
