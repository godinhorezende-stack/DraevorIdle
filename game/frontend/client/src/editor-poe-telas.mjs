// As três telas da engine para o PoE (grupo "Referência PoE", só com ITENS_POE=1 no servidor):
//   CAMPANHA — os atos com o grafo das áreas (o mesmo que o runtime de atos usa), o mapa do Draevor de cada área (dá para trocar: vale na
//              hora e fica salvo), os monstros com os status do PoE e o desenho do Draevor, as habilidades e o chefe do ato;
//   ÁRVORE   — a árvore passiva do PoE inteira (nós, maestrias, keystones) e as ascendências, com o texto do PoE, a tradução de cada
//              linha e o estado (tem efeito / registrado);
//   CHEFES   — os pináculos e os chefes de ato: status (PoE e no jogo), habilidades convertidas e arena.
import { el, msg, cabecalho, botaoCopiar } from './editor-ui.mjs';
import { retrato } from './editor-sprites.mjs';
import { cartaoDeAtaque, metrica, barrasDeResistencia, seloDoElemento } from './editor-fichas.mjs';

const BASE = '/api/mapas/_engine/itens-poe/';
const api = async (rota, corpo) => (await fetch(BASE + rota, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) } : {})).json();
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
const SIMBOLO = { equivalente: '✓', aproximado: '≈', novo: '◆', registrado: '○', nota: '·' };
const ESTADO = { equivalente: 'tem efeito no Draevor (mesma conta)', aproximado: 'tem efeito no Draevor (com diferença)', novo: 'atributo novo do PoE, com efeito', registrado: 'registrado, ainda sem efeito', nota: 'texto explicativo (sem número)' };
const marca = (e) => el('em', { class: `poe-tr ${e}`, title: ESTADO[e] ?? e }, SIMBOLO[e] ?? '?');
const ROTULO_COMP = { magia: 'Magia', 'area-telegrafada': 'Área avisada', area: 'Área avisada', invocar: 'Invocação', escudo: 'Escudo' };

/** Sem o sistema ligado, a mesma explicação nas três telas. */
async function ligado(raiz, titulo) {
  const e = await api('estado');
  if (e.ligado) return true;
  raiz().replaceChildren(cabecalho(titulo, 'Referência do PoE — só no servidor local com ITENS_POE=1.'),
    el('div', { class: 'eng-painel' }, el('div', { class: 'eng-painel-corpo' }, el('p', {}, 'Desligado neste servidor.'), el('pre', { class: 'bib-json' }, 'ITENS_POE=1 PORTA=8099 node game/backend/index.mjs'))));
  return false;
}

/** Uma habilidade convertida (o formato dos comportamentos do boss único / dos poderes) como cartão. */
function cartaoDeHabilidade(c) {
  if (c.tipo === 'invocar') {
    return el('div', { class: 'eng-ataque' }, el('div', { class: 'eng-ataque-topo' }, el('b', {}, c.nome ?? 'Invocação'), el('span', { class: 'selo' }, 'invoca')),
      el('dl', { class: 'eng-ataque-dl' }, el('dt', {}, 'A cada'), el('dd', {}, `${Number(((c.intervaloMs ?? 0) / 1000).toFixed(1))} s`), c.criaturas ? [el('dt', {}, 'Criaturas'), el('dd', {}, c.criaturas.map((x) => `${x.qtd}× ${x.key}`).join(', '))] : null));
  }
  const card = cartaoDeAtaque({ ...c, tipo: 'magia', intervalo: c.intervaloMs ?? c.intervalo, nome: `${c.nome ?? 'Magia'}` });
  card.querySelector('.eng-ataque-dl')?.append(el('dt', {}, 'Tipo'), el('dd', {}, ROTULO_COMP[c.tipo] ?? c.tipo));
  return card;
}

/** As habilidades de origem (poedb) numa tabela: nome, tags, dano no nível, elemento, tempo, recarga. */
function tabelaDeHabilidades(lista) {
  if (!lista?.length) return el('p', { class: 'dica' }, 'Sem habilidades no poedb (só o corpo a corpo).');
  return el('div', { class: 'bib-tabela' }, el('table', {},
    el('thead', {}, el('tr', {}, ['Habilidade (poedb)', 'Tags', 'Dano no nível', 'Elemento', 'Tempo', 'Recarga'].map((h) => el('th', {}, h)))),
    el('tbody', {}, lista.map((h) => el('tr', { title: h.descricao ?? '' }, el('td', {}, el('b', {}, h.nome ?? h.interno), h.interno && h.interno !== h.nome ? el('div', { class: 'eng-id' }, h.interno) : null),
      el('td', { class: 'dica' }, (h.tags ?? []).slice(0, 5).join(', ')), el('td', { class: 'num' }, h.dano ? `${h.dano.min}–${h.dano.max}` : '—'),
      el('td', {}, h.elemento ? seloDoElemento(h.elemento) : h.dano ? seloDoElemento('physical') : '—'), el('td', { class: 'num' }, h.tempo ? `${h.tempo} s` : '—'), el('td', { class: 'num' }, h.recarga ? `${h.recarga} s` : '—'))))));
}

/** Os status do PoE de um monstro (vida, ES, dano, ritmo, defesas, exp) como métricas. */
const metricasDoMonstro = (m) => el('div', { class: 'eng-metricas' },
  metrica('Nível', m.nivel), metrica('Vida', num(m.vida)), m.escudoDeEnergia ? metrica('Escudo de Energia', num(m.escudoDeEnergia)) : null, metrica('Dano do golpe', num(m.dano)),
  metrica('Tempo de ataque', `${Number(m.tempoAtaque).toFixed(2)} s`), metrica('Armadura', num(m.armadura)), metrica('Evasão', num(m.evasao)), metrica('Experiência', num(m.experiencia)));

// ================================================================ CAMPANHA

export function criarTelaDaCampanhaPoe({ raiz }) {
  const T = { dados: null, ato: 1, area: null, detalhe: null, monstro: null };

  async function desenhar(resto = []) {
    if (!(await ligado(raiz, 'Campanha do PoE'))) return;
    T.dados = await api('campanha');
    if (resto[0]) T.ato = Number(resto[0]) || T.ato;
    raiz().replaceChildren(
      cabecalho('Campanha do PoE', `Os ${T.dados.atos.length} atos do Path of Exile no lugar da campanha do Draevor: cada área usa o terreno de um mapa do Draevor e os monstros do PoE (status do PoE, desenho do Draevor). As ligações são as do runtime de atos (a cidade liga os dois lados). Troque o mapa de uma área no painel.`),
      el('div', { class: 'poe-v poe-larga poe-camp' }, el('aside', { class: 'poe-classes', id: 'pc-atos' }), el('section', { id: 'pc-grafo' }), el('aside', { class: 'bib-painel', id: 'pc-painel' })));
    pintarAtos();
    pintarGrafo();
    pintarPainel();
  }

  function pintarAtos() {
    document.querySelector('#pc-atos')?.replaceChildren(el('div', { class: 'bib-rotulo' }, 'Atos'), ...T.dados.atos.map((a) => el('button', { type: 'button', class: `bib-cat${a.numero === T.ato ? ' ativa' : ''}`, onclick: () => { T.ato = a.numero; T.area = null; T.detalhe = null; pintarAtos(); pintarGrafo(); pintarPainel(); } },
      el('span', {}, a.nome), el('span', { class: 'bib-num' }, a.areas.filter((id) => !T.dados.areas[id]?.cidade).length))));
  }

  function pintarGrafo() {
    const ato = T.dados.atos.find((a) => a.numero === T.ato);
    const A = T.dados.areas;
    const ids = ato.areas.filter((id) => A[id]);
    const pos = (id) => A[id].posicao ?? { x: 40 + (ids.indexOf(id) % 6) * 150, y: 60 + Math.floor(ids.indexOf(id) / 6) * 110 };
    const NS = 'http://www.w3.org/2000/svg';
    const svg = (tag, attrs = {}, ...filhos) => {
      const e = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
      for (const f of filhos.flat()) if (f != null) e.append(f.nodeType ? f : document.createTextNode(String(f)));
      return e;
    };
    const linhas = [];
    // As ligações do mapa do PoE (as das cidades em tracejado) e, por cima, as do runtime (a ordem de liberação, com seta).
    for (const id of ids) for (const v of A[id].conexoes) if (A[v] && ids.includes(v) && id < v) linhas.push(svg('line', { x1: pos(id).x, y1: pos(id).y, x2: pos(v).x, y2: pos(v).y, class: 'pc-liga-mapa' }));
    for (const c of ato.conexoes) linhas.push(svg('line', { x1: pos(c.de).x, y1: pos(c.de).y, x2: pos(c.para).x, y2: pos(c.para).y, class: 'pc-liga', 'marker-end': 'url(#pc-seta)' }));
    const nos = ids.map((id) => {
      const a = A[id];
      const p = pos(id);
      const chefe = id === ato.faseDoChefe;
      return svg('g', { class: `pc-no${a.cidade ? ' cidade' : ''}${id === T.area ? ' ativo' : ''}${a.unicos.length ? ' com-unico' : ''}${a.trocado ? ' trocado' : ''}`, transform: `translate(${p.x},${p.y})`, tabindex: 0, role: 'button' },
        svg('title', {}, `${a.nome} — nível ${a.nivel}${a.cidade ? ' (cidade)' : `\nMapa: ${a.nomeDoMapa}\n${a.monstros} monstros${a.unicos.length ? `\nÚnicos: ${a.unicos.join(', ')}` : ''}`}`),
        svg('circle', { r: a.cidade ? 9 : 13 }),
        svg('text', { y: 4, class: 'pc-nv' }, a.nivel),
        svg('text', { y: a.cidade ? 26 : 32, class: 'pc-nome' }, a.nome.length > 22 ? `${a.nome.slice(0, 21)}…` : a.nome),
        chefe && ato.chefe ? svg('text', { y: -20, class: 'pc-chefe' }, `☠ ${ato.chefe.nome.split(',')[0]}`) : null);
    });
    const caixa = el('div', { class: 'pc-grafo' });
    const desenho = svg('svg', { viewBox: '-70 -40 1080 610', class: 'pc-svg' },
      svg('defs', {}, svg('marker', { id: 'pc-seta', viewBox: '0 0 10 10', refX: 22, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', class: 'pc-seta' }))),
      ...linhas, ...nos);
    nos.forEach((g, i) => {
      const abrir = () => abrirArea(ids[i]);
      g.addEventListener('click', abrir);
      g.addEventListener('keydown', (e) => e.key === 'Enter' && abrir());
    });
    caixa.append(desenho);
    const lista = el('div', { class: 'bib-tabela' }, el('table', {},
      el('thead', {}, el('tr', {}, ['Área', 'Nível', 'Mapa do Draevor', 'Monstros', 'Únicos'].map((h) => el('th', {}, h)))),
      el('tbody', {}, ids.filter((id) => !A[id].cidade).map((id) => el('tr', { class: id === T.area ? 'selecionada' : '', style: 'cursor:pointer', onclick: () => abrirArea(id) },
        el('td', {}, A[id].nome, id === ato.faseDoChefe ? el('span', { class: 'selo aviso', style: 'margin-left:6px' }, 'antes do chefe') : null), el('td', { class: 'num' }, A[id].nivel),
        el('td', {}, A[id].nomeDoMapa ?? '—', A[id].trocado ? el('span', { class: 'selo usos', style: 'margin-left:6px' }, 'trocado') : null), el('td', { class: 'num' }, A[id].monstros), el('td', { class: 'dica' }, A[id].unicos.join(', ') || '—'))))));
    document.querySelector('#pc-grafo')?.replaceChildren(
      el('div', { class: 'bib-contagem' }, el('b', {}, ato.nome), el('span', { class: 'dica' }, `${ids.filter((id) => !A[id].cidade).length} áreas · chefe: ${ato.chefe ? `${ato.chefe.nome} (nível ${ato.chefe.nivel})` : 'nenhum'} · seta = ordem de liberação; tracejado = ligação do mapa do PoE`)),
      caixa, lista);
  }

  async function abrirArea(id) {
    T.area = id;
    T.detalhe = await api(`campanha/area?id=${encodeURIComponent(id)}`);
    pintarGrafo();
    pintarPainel();
  }

  function pintarPainel() {
    const caixa = document.querySelector('#pc-painel');
    if (!caixa) return;
    const d = T.detalhe;
    if (!d) {
      const ato = T.dados.atos.find((a) => a.numero === T.ato);
      return caixa.replaceChildren(el('div', { class: 'bib-painel-vazio' }, el('b', {}, 'Escolha uma área no grafo'), el('span', { class: 'dica' }, 'Veja o mapa (e troque), os monstros com os status do PoE e as habilidades.'),
        ato.chefe ? el('div', { style: 'margin-top:12px;display:flex;gap:10px;align-items:center' }, retrato(ato.chefe.desenho, 64, { categoria: 'monstros' }), el('div', {}, el('b', {}, ato.chefe.nome), el('div', { class: 'dica' }, `Chefe do ${ato.nome} · nível ${ato.chefe.nivel} · ${num(ato.chefe.vida)} de vida · na área ${ato.chefe.area}`))) : null));
    }
    if (d.cidade) return caixa.replaceChildren(el('div', { class: 'bib-painel-topo' }, el('h2', { class: 'bib-nome' }, d.nome)), el('div', { class: 'bib-painel-corpo' }, el('p', { class: 'dica' }, 'Cidade: não tem combate (no jogo, liga as áreas dos dois lados).')));
    const sel = el('select', {}, T.dados.mapas.map((m) => el('option', { value: m.id, selected: m.id === d.mapa }, `${m.nome}${m.nivel ? ` (nv ${m.nivel})` : ''}`)));
    const salvar = el('button', { type: 'button', onclick: async () => {
      if (sel.value === d.mapa) return msg('Esse já é o mapa da área.', 'aviso');
      salvar.disabled = true;
      const r = await api('campanha/mapa', { area: d.id, mapa: sel.value });
      salvar.disabled = false;
      if (!r.ok) return msg(r.erros?.[0] ?? 'Não deu.', 'erro');
      msg(`Mapa de ${d.nome} trocado (vale na próxima entrada na área).`, 'ok');
      T.detalhe = r.area;
      T.dados = await api('campanha');
      pintarGrafo();
      pintarPainel();
    } }, 'Trocar mapa');
    caixa.replaceChildren(
      el('div', { class: 'bib-painel-topo' }, el('div', { class: 'bib-painel-titulo' }, el('h2', { class: 'bib-nome' }, d.nome), el('div', { class: 'linha' }, el('span', { class: 'eng-id', style: 'flex:none' }, d.id), botaoCopiar(d.id), d.poedb ? el('a', { href: d.poedb, target: '_blank', rel: 'noopener', style: 'flex:none' }, 'poedb ↗') : null, el('span')),
        el('div', { class: 'dica' }, `${d.ato === 11 ? 'Epílogo' : `Ato ${d.ato}`} · nível ${d.nivel}${d.tags.length ? ` · tags: ${d.tags.join(', ')}` : ''}`), d.notas ? el('p', { class: 'dica' }, `“${d.notas}”`) : null)),
      el('div', { class: 'bib-painel-corpo' },
        el('h4', {}, 'Mapa (terreno do Draevor)'),
        el('div', { class: 'eng-tooltip-barra' }, el('label', { class: 'campo', style: 'flex:1;min-width:0' }, 'Mapa', sel), salvar),
        el('p', { class: 'dica' }, `No jogo agora: ${d.mapaNoJogo}${d.trocado ? ' (trocado na engine — salvo em campanha-mapas.json)' : ' (escolha automática por ambientação)'}. O terreno, a grade e as posições dos spawns são os do mapa; os bichos são os do PoE.`),
        el('h4', {}, `Monstros (${d.monstros.length})`),
        el('div', { class: 'pc-monstros' }, d.monstros.map((m) => el('details', { class: 'pc-monstro', open: m.unico && d.monstros.length < 6 },
          el('summary', {}, retrato(m.desenho, 40, { categoria: 'monstros' }), el('div', { style: 'min-width:0' }, el('b', {}, m.nome), m.unico ? el('span', { class: 'selo aviso', style: 'margin-left:6px' }, 'Único') : null,
            el('div', { class: 'dica' }, `nv ${m.nivel} · ${num(m.vida + m.escudoDeEnergia)} vida · golpe ${num(m.dano)} a cada ${Number(m.tempoAtaque).toFixed(2)} s${m.desenhoDe ? ` · desenho: ${m.desenhoDe}` : ''}`))),
          metricasDoMonstro(m),
          el('div', { class: 'linha' }, el('span', { class: 'dica', style: 'flex:none' }, 'Resistências:'), barrasDeResistencia(m.resistencias)),
          m.convertidas.length ? [el('h5', {}, 'No jogo (habilidades convertidas)'), el('div', { class: 'eng-ataques' }, m.convertidas.map(cartaoDeHabilidade))] : null,
          m.habilidades.length > 1 ? [el('h5', {}, 'Habilidades no poedb'), tabelaDeHabilidades(m.habilidades)] : null,
          el('h5', {}, 'Drops deste monstro'), m.unico ? editorDeDrops(m.slug, m.drops ?? []) : el('div', { class: 'dica' }, 'Monstro comum: sem item próprio (modelo do PoE). Cai pela tabela global: ~16% de chance (mais nos mágicos/raros), Item Level = o nível dele, qualquer base até esse nível, raridade pelos pesos.')))),
        d.chefeDoAto ? [el('h4', {}, `Chefe do ato: ${d.chefeDoAto.nome}`), fichaDoChefe(d.chefeDoAto)] : null));
  }

  return { desenhar };
}

// ================================================================ CHEFES

/** A ficha de um chefe (pináculo ou de ato). */
function fichaDoChefe(c) {
  if (c.tipo === 'ato') {
    const s = c.status;
    return el('div', { class: 'pc-chefe-ficha' },
      el('div', { class: 'linha', style: 'gap:12px;align-items:center' }, retrato(c.desenho, 96, { categoria: 'monstros', animar: true }), el('div', {},
        el('b', {}, c.nome), el('div', { class: 'dica' }, `Chefe do ${c.ato === 11 ? 'Epílogo' : `Ato ${c.ato}`} · ${c.area} · desenho: ${c.base}`), el('span', { class: 'eng-id' }, c.id))),
      el('h5', {}, 'Status do PoE (no nível da área, com os bônus de Único)'), metricasDoMonstro(s),
      el('div', { class: 'linha' }, el('span', { class: 'dica', style: 'flex:none' }, 'Resistências:'), barrasDeResistencia(s.resistencias)),
      c.noJogo ? [el('h5', {}, 'No jogo (boss único)'), el('div', { class: 'eng-metricas' }, metrica('Vida (com ES)', num(c.noJogo.vida)), c.noJogo.melee ? metrica('Corpo a corpo', `${num(c.noJogo.melee.min)}–${num(c.noJogo.melee.max)} a cada ${Number(c.noJogo.melee.intervaloMs / 1000).toFixed(2)} s`) : null),
        c.noJogo.comportamentos.length ? el('div', { class: 'eng-ataques' }, c.noJogo.comportamentos.map(cartaoDeHabilidade)) : el('p', { class: 'dica' }, 'Só o corpo a corpo (nenhuma habilidade do poedb vira comportamento).')] : el('p', { class: 'nao' }, 'Não registrado no jogo.'),
      c.arena ? el('p', { class: 'dica' }, `Arena: ${c.arena.deOutroBoss ? `a do boss "${c.arena.nome}" do Draevor (mesma criatura de desenho)` : 'sala padrão de boss (40×40)'}.`) : null,
      el('h5', {}, 'Habilidades no poedb'), tabelaDeHabilidades(s.habilidades),
      c.acompanhantes?.length ? el('p', { class: 'dica' }, `Acompanhantes no PoE: ${c.acompanhantes.map((a) => a.nome ?? a).join(', ')}.`) : null);
  }
  return el('div', { class: 'pc-chefe-ficha' },
    el('div', { class: 'linha', style: 'gap:12px;align-items:center' }, retrato(c.desenho, 96, { categoria: 'monstros', animar: true }), el('div', {},
      el('b', {}, c.nome), el('div', { class: 'dica' }, `Pináculo · nível ${c.nivel} · desenho e poderes de: ${c.baseNome}`), el('span', { class: 'eng-id' }, c.id), c.poedb ? el('a', { href: c.poedb, target: '_blank', rel: 'noopener', style: 'margin-left:8px' }, 'poedb ↗') : null)),
    el('h5', {}, 'No PoE'), el('div', { class: 'eng-metricas' }, metrica('Vida', `${num(c.poe.vidaPct)}%`), metrica('Dano', `${num(c.poe.danoPct)}%`), metrica('Experiência', `${num(c.poe.expPct)}%`), c.poe.raridadeDoDropPct ? metrica('Raridade do drop', `+${num(c.poe.raridadeDoDropPct)}%`) : null),
    c.noJogo ? [el('h5', {}, 'No jogo'), el('div', { class: 'eng-metricas' }, metrica('Vida', num(c.noJogo.vida)), metrica('Experiência', num(c.noJogo.exp)), metrica('Vida ×', c.noJogo.vidaMult), metrica('Dano ×', c.noJogo.danoMult), metrica('Recarga', `${c.noJogo.cooldownHoras} h`)),
      el('div', { class: 'linha' }, el('span', { class: 'dica', style: 'flex:none' }, 'Resistências:'), barrasDeResistencia(c.noJogo.resistencias))] : el('p', { class: 'nao' }, 'Não registrado (a criatura de desenho não existe no bestiário).'),
    el('h5', {}, `Ataques (os poderes de ${c.baseNome}, × dano)`), c.ataques.length ? el('div', { class: 'eng-ataques' }, c.ataques.map((a) => cartaoDeAtaque(a))) : el('p', { class: 'dica' }, 'Sem poderes cadastrados.'),
    el('p', { class: 'dica' }, `Arena: ${c.arena ? `a do boss "${c.arena}" do Draevor` : 'sala padrão de boss'}.`),
    el('h5', {}, `Únicos exclusivos (${c.unicos.length})`),
    el('div', { class: 'eng-card-selos' }, c.unicos.map((u) => el('span', { class: 'selo', title: `${u.nomeOriginal ?? ''} — ${u.base ?? ''}` }, `${u.nome} (${u.base})`))));
}

export function criarTelaDosChefesPoe({ raiz }) {
  const T = { dados: null, sel: null };
  async function desenhar(resto = []) {
    if (!(await ligado(raiz, 'Chefes do PoE'))) return;
    T.dados = await api('chefes');
    T.sel = resto[0] ?? T.sel;
    raiz().replaceChildren(
      cabecalho('Chefes do PoE', `${T.dados.pinaculos.length} pináculos (endgame, nível ${T.dados.regra.nivel}) e ${T.dados.atos.length} chefes de ato da campanha. Pináculo: a vida, o dano e a experiência do PoE em % por cima de uma criatura do Draevor. Chefe de ato: os status e as habilidades do poedb no nível da área.`),
      el('div', { class: 'poe-v painel-largo' }, el('section', { id: 'ch-lista', style: 'grid-column: span 2' }), el('aside', { class: 'bib-painel', id: 'ch-painel' })));
    pintar();
  }
  const todos = () => [...T.dados.pinaculos, ...T.dados.atos];
  function pintar() {
    const card = (c) => el('div', { class: `eng-card${c.id === T.sel ? ' selecionado' : ''}`, tabindex: 0, role: 'button', onclick: () => { T.sel = c.id; pintar(); }, onkeydown: (e) => e.key === 'Enter' && ((T.sel = c.id), pintar()) },
      el('div', { class: 'eng-card-arte' }, retrato(c.desenho, 64, { categoria: 'monstros' })),
      el('div', { class: 'eng-card-info' }, el('b', { class: 'eng-card-nome' }, c.nome), el('span', { class: 'eng-id' }, c.id),
        el('div', { class: 'eng-card-selos' }, el('span', { class: 'selo' }, `nv ${c.nivel}`), c.tipo === 'ato' ? el('span', { class: 'selo' }, `Ato ${c.ato}`) : el('span', { class: 'selo aviso' }, 'pináculo'),
          el('span', { class: 'selo usos' }, `${num(c.tipo === 'ato' ? c.noJogo?.vida : c.noJogo?.vida)} vida`), c.tipo === 'ato' ? el('span', { class: 'selo' }, `${c.noJogo?.comportamentos.length ?? 0} habilidades`) : el('span', { class: 'selo' }, `${c.unicos.length} únicos`))));
    document.querySelector('#ch-lista')?.replaceChildren(
      el('h4', {}, 'Pináculos'), el('div', { class: 'bib-grade' }, T.dados.pinaculos.map(card)),
      el('h4', {}, 'Chefes de ato'), el('div', { class: 'bib-grade' }, T.dados.atos.map(card)));
    const c = todos().find((x) => x.id === T.sel);
    document.querySelector('#ch-painel')?.replaceChildren(c ? el('div', { class: 'bib-painel-corpo' }, fichaDoChefe(c)) : el('div', { class: 'bib-painel-vazio' }, el('b', {}, 'Escolha um chefe'), el('span', { class: 'dica' }, 'Status do PoE e no jogo, habilidades convertidas, arena e os únicos.')));
  }
  return { desenhar };
}

// ================================================================ ÁRVORE

const COR_DO_TIPO = { small: '#7d8597', notable: '#e2b85c', keystone: '#ff7a59', mastery: '#7fc8ff', start: '#ffffff' };
const COR_DO_ESTADO = { equivalente: '#5cc28a', aproximado: '#e9c34f', novo: '#c79bff', registrado: '#6f7889', nota: '#4a5160' };
const PIOR = ['equivalente', 'novo', 'aproximado', 'registrado'];
/** O estado "do nó" para colorir: o pior entre as linhas com número (as notas não contam). */
const estadoDoNo = (n) => {
  const l = [...n.estados, ...(n.opcoes ?? []).flatMap((o) => o.estados ?? [])].filter((e) => e !== 'nota');
  return l.length ? l.reduce((p, e) => (PIOR.indexOf(e) > PIOR.indexOf(p) ? e : p), 'equivalente') : 'nota';
};

export function criarTelaDaArvorePoe({ raiz }) {
  const T = { dados: null, porId: null, modo: 'arvore', asc: null, sel: null, busca: '', cor: 'tipo', cam: null, achados: new Set() };

  async function desenhar(resto = []) {
    if (!(await ligado(raiz, 'Árvore do PoE'))) return;
    if (!T.dados) {
      raiz().replaceChildren(el('div', { class: 'dica' }, 'Carregando a árvore…'));
      T.dados = await api('arvore');
      T.porId = new Map((T.dados.nos ?? []).map((n) => [n.id, n]));
    }
    if (!T.dados.ligada) return raiz().replaceChildren(cabecalho('Árvore do PoE', 'O servidor não carregou a árvore do PoE.'));
    if (resto[0]) T.sel = resto[0];
    const r = T.dados.relatorio ?? {};
    const cob = T.dados.cobertura;
    raiz().replaceChildren(
      cabecalho('Árvore do PoE', `A árvore passiva do PoE no lugar da do Draevor (1 ponto por nível): ${r.nos ?? '?'} nós, ${r.maestrias ?? '?'} maestrias, ${Object.keys(T.dados.ascendencias).length} ascendências. Cada linha do PoE com a tradução e o estado: ✓ ≈ ◆ têm efeito no Draevor; ○ só registrada.`),
      el('div', { class: 'poe-v poe-larga pa-v' }, el('aside', { class: 'poe-classes', id: 'pa-menu' }), el('section', { id: 'pa-palco' }), el('aside', { class: 'bib-painel', id: 'pa-painel' })));
    pintarMenu(cob);
    pintarPalco();
    pintarPainel();
  }

  function pintarMenu(cob = T.dados.cobertura) {
    const asc = Object.values(T.dados.ascendencias);
    const porClasse = {};
    for (const a of asc) (porClasse[a.classe] ??= []).push(a);
    document.querySelector('#pa-menu')?.replaceChildren(
      el('div', { class: 'bib-rotulo' }, 'Ver'),
      el('button', { type: 'button', class: `bib-cat${T.modo === 'arvore' ? ' ativa' : ''}`, onclick: () => { T.modo = 'arvore'; T.asc = null; T.cam = null; pintarMenu(); pintarPalco(); } }, el('span', {}, 'Árvore inteira'), el('span', { class: 'bib-num' }, T.dados.nos.filter((n) => !n.asc).length)),
      el('button', { type: 'button', class: `bib-cat${T.modo === 'keystones' ? ' ativa' : ''}`, onclick: () => { T.modo = 'keystones'; pintarMenu(); pintarPalco(); } }, el('span', {}, 'Keystones'), el('span', { class: 'bib-num' }, T.dados.nos.filter((n) => n.t === 'keystone').length)),
      el('button', { type: 'button', class: `bib-cat${T.modo === 'cobertura' ? ' ativa' : ''}`, onclick: () => { T.modo = 'cobertura'; pintarMenu(); pintarPalco(); } }, el('span', {}, 'Cobertura da tradução'), el('span')),
      ...Object.entries(porClasse).flatMap(([classe, lista]) => [el('div', { class: 'bib-rotulo' }, `Ascendências — ${classe}`), ...lista.map((a) => el('button', { type: 'button', class: `bib-cat${T.asc === a.slug ? ' ativa' : ''}`, onclick: () => { T.modo = 'asc'; T.asc = a.slug; T.cam = null; pintarMenu(); pintarPalco(); } }, el('span', {}, a.nome), el('span', { class: 'bib-num' }, a.nos)))]));
  }

  const visiveis = () => (T.modo === 'asc' ? T.dados.nos.filter((n) => n.asc === T.asc) : T.dados.nos.filter((n) => !n.asc));

  function pintarPalco() {
    const palco = document.querySelector('#pa-palco');
    if (!palco) return;
    if (T.modo === 'keystones') return palco.replaceChildren(listaDeKeystones());
    if (T.modo === 'cobertura') return palco.replaceChildren(tabelaDeCobertura());
    const canvas = el('canvas', { class: 'pa-canvas', width: 1200, height: 860 });
    const busca = el('input', { type: 'search', placeholder: 'Buscar nó ou texto (ex.: vida, Ressonância)…', value: T.busca, oninput: (e) => { T.busca = e.target.value; buscar(); desenharCanvas(canvas); contagem.textContent = T.busca ? `${T.achados.size} achados` : ''; } });
    const contagem = el('span', { class: 'dica' }, '');
    const corSel = el('select', { onchange: (e) => { T.cor = e.target.value; desenharCanvas(canvas); legenda.replaceChildren(...itensDaLegenda()); } }, [['tipo', 'Cor: tipo do nó'], ['estado', 'Cor: estado da tradução']].map(([v, n]) => el('option', { value: v, selected: v === T.cor }, n)));
    const legenda = el('div', { class: 'pa-legenda' }, ...itensDaLegenda());
    const asc = T.modo === 'asc' ? T.dados.ascendencias[T.asc] : null;
    palco.replaceChildren(...[
      el('div', { class: 'bib-contagem pa-barra' }, el('b', {}, asc ? `${asc.nome} (${asc.classe})` : 'Árvore passiva'), busca, corSel, contagem),
      asc?.flavour ? el('p', { class: 'dica', style: 'font-style:italic' }, asc.flavour.replace(/ \/ /g, ' ')) : null,
      el('div', { class: 'pa-quadro' }, canvas), legenda,
      el('p', { class: 'dica' }, 'Arraste para mover, roda do mouse para o zoom, clique num nó para ver os textos.')].filter(Boolean));
    buscar();
    contagem.textContent = T.busca ? `${T.achados.size} achados` : '';
    ligarCanvas(canvas);
    desenharCanvas(canvas);
  }

  const itensDaLegenda = () => (T.cor === 'tipo'
    ? Object.entries({ small: 'pequeno', notable: 'notável', keystone: 'keystone', mastery: 'maestria', start: 'início de classe' }).map(([k, n]) => el('span', {}, el('i', { style: `background:${COR_DO_TIPO[k]}` }), n))
    : Object.entries(ESTADO).map(([k, n]) => el('span', {}, el('i', { style: `background:${COR_DO_ESTADO[k]}` }), `${SIMBOLO[k]} ${n}`)));

  function buscar() {
    const t = T.busca.trim().toLowerCase();
    T.achados = new Set(t.length < 2 ? [] : visiveis().filter((n) => n.nome?.toLowerCase().includes(t) || n.en?.toLowerCase().includes(t) || n.textos.some((x) => x.toLowerCase().includes(t)) || (n.opcoes ?? []).some((o) => o.textos.some((x) => x.toLowerCase().includes(t)))).map((n) => n.id));
  }

  /** A câmera: ajusta os nós visíveis no quadro (uma vez por conjunto). */
  function camera(canvas) {
    if (T.cam) return T.cam;
    const l = visiveis();
    const xs = l.map((n) => n.x);
    const ys = l.map((n) => n.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const esc = Math.min(canvas.width / (x1 - x0 + 400), canvas.height / (y1 - y0 + 400));
    T.cam = { esc, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    return T.cam;
  }
  const naTela = (canvas, n) => {
    const c = camera(canvas);
    return [canvas.width / 2 + (n.x - c.cx) * c.esc, canvas.height / 2 + (n.y - c.cy) * c.esc];
  };

  function desenharCanvas(canvas) {
    const g = canvas.getContext('2d');
    const estilo = getComputedStyle(canvas);
    g.fillStyle = estilo.getPropertyValue('--pa-fundo').trim() || '#0f1218';
    g.fillRect(0, 0, canvas.width, canvas.height);
    const l = visiveis();
    const ids = new Set(l.map((n) => n.id));
    const esc = camera(canvas).esc;
    g.strokeStyle = 'rgba(140,150,170,.28)';
    g.lineWidth = 1;
    g.beginPath();
    for (const n of l) {
      const [ax, ay] = naTela(canvas, n);
      for (const v of n.c) {
        if (!ids.has(v) || v < n.id) continue;
        const m = T.porId.get(v);
        if (!m || m.t === 'mastery' || n.t === 'mastery') continue;
        const [bx, by] = naTela(canvas, m);
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
      }
    }
    g.stroke();
    const buscando = T.achados.size > 0;
    for (const n of l) {
      const [x, y] = naTela(canvas, n);
      if (x < -10 || y < -10 || x > canvas.width + 10 || y > canvas.height + 10) continue;
      const base = { small: 2.2, notable: 4, keystone: 6, mastery: 3.6, start: 6 }[n.t] ?? 2;
      const r = Math.max(1.5, base * Math.min(3, Math.max(0.6, esc * 18)));
      g.globalAlpha = buscando && !T.achados.has(n.id) ? 0.18 : 1;
      g.fillStyle = T.cor === 'tipo' ? COR_DO_TIPO[n.t] ?? '#999' : COR_DO_ESTADO[estadoDoNo(n)];
      g.beginPath();
      if (n.t === 'mastery') g.rect(x - r, y - r, r * 2, r * 2);
      else g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      if (n.id === T.sel || (buscando && T.achados.has(n.id))) {
        g.strokeStyle = n.id === T.sel ? '#ffffff' : '#ffd166';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(x, y, r + 3, 0, Math.PI * 2);
        g.stroke();
      }
      if (n.t === 'keystone' || (n.t === 'notable' && esc > 0.09) || (T.modo === 'asc' && n.t !== 'small')) {
        g.globalAlpha = buscando && !T.achados.has(n.id) ? 0.25 : 0.9;
        g.fillStyle = estilo.getPropertyValue('--pa-texto').trim() || '#d8dce6';
        g.font = '11px system-ui, sans-serif';
        g.fillText(n.nome, x + r + 3, y + 4);
      }
    }
    g.globalAlpha = 1;
  }

  function ligarCanvas(canvas) {
    let arrasto = null;
    const ponto = (e) => {
      const b = canvas.getBoundingClientRect();
      return [(e.clientX - b.left) * (canvas.width / b.width), (e.clientY - b.top) * (canvas.height / b.height)];
    };
    canvas.addEventListener('pointerdown', (e) => { arrasto = { p: ponto(e), mexeu: false }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!arrasto) return;
      const [x, y] = ponto(e);
      const c = camera(canvas);
      const dx = x - arrasto.p[0];
      const dy = y - arrasto.p[1];
      if (Math.abs(dx) + Math.abs(dy) > 2) arrasto.mexeu = true;
      c.cx -= dx / c.esc;
      c.cy -= dy / c.esc;
      arrasto.p = [x, y];
      desenharCanvas(canvas);
    });
    canvas.addEventListener('pointerup', (e) => {
      const mexeu = arrasto?.mexeu;
      arrasto = null;
      if (mexeu) return;
      const [x, y] = ponto(e);
      let melhor = null;
      let dist = 14 * 14;
      for (const n of visiveis()) {
        const [nx, ny] = naTela(canvas, n);
        const d = (nx - x) ** 2 + (ny - y) ** 2;
        if (d < dist) [melhor, dist] = [n, d];
      }
      if (melhor) {
        T.sel = melhor.id;
        desenharCanvas(canvas);
        pintarPainel();
      }
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const c = camera(canvas);
      const [x, y] = ponto(e);
      const wx = c.cx + (x - canvas.width / 2) / c.esc;
      const wy = c.cy + (y - canvas.height / 2) / c.esc;
      c.esc = Math.min(2, Math.max(0.01, c.esc * (e.deltaY < 0 ? 1.25 : 0.8)));
      c.cx = wx - (x - canvas.width / 2) / c.esc;
      c.cy = wy - (y - canvas.height / 2) / c.esc;
      desenharCanvas(canvas);
    }, { passive: false });
  }

  const linhaDeTexto = (texto, estado, efeitos) => el('div', { class: 'pa-linha' }, marca(estado ?? 'registrado'), el('span', {}, texto));
  const efeitosEmTexto = (ef) => (ef ?? []).map((f) => (f.add ? `${f.add} +${f.valor}` : f.stat ? `${f.stat} ${f.pct ?? f.valor ?? ''}${f.pct != null ? '%' : ''}` : f.tag ? `tag ${f.tag} ${f.dano ?? ''}` : JSON.stringify(f))).join(' · ');

  function pintarPainel() {
    const caixa = document.querySelector('#pa-painel');
    if (!caixa) return;
    const n = T.sel ? T.porId.get(String(T.sel)) : null;
    if (!n) return caixa.replaceChildren(el('div', { class: 'bib-painel-vazio' }, el('b', {}, 'Clique num nó'), el('span', { class: 'dica' }, 'Os textos do PoE, o estado de cada linha e o que soma no Draevor.')));
    const TIPO = { small: 'Pequeno', notable: 'Notável', keystone: 'Keystone', mastery: 'Maestria', start: 'Início de classe' };
    const vizinhos = n.c.map((v) => T.porId.get(v)).filter(Boolean);
    caixa.replaceChildren(
      el('div', { class: 'bib-painel-topo' }, el('div', { class: 'bib-painel-titulo' }, el('h2', { class: 'bib-nome' }, n.nome), el('div', { class: 'dica' }, `${n.en ?? ''}`),
        el('div', { class: 'linha' }, el('span', { class: 'selo', style: `flex:none;border-color:${COR_DO_TIPO[n.t]}` }, TIPO[n.t] ?? n.t), n.asc ? el('span', { class: 'selo aviso', style: 'flex:none' }, `Ascendência ${n.asc}`) : null, el('span', { class: 'eng-id', style: 'flex:none' }, `nó ${n.id}`), el('span')))),
      el('div', { class: 'bib-painel-corpo' },
        n.textos.length ? [el('h4', {}, 'Texto do PoE e estado'), el('div', { class: 'pa-linhas' }, n.textos.map((t, i) => linhaDeTexto(t, n.estados[i])))] : null,
        n.efeitos.length ? [el('h4', {}, 'O que soma no Draevor'), el('p', { class: 'eng-id' }, efeitosEmTexto(n.efeitos))] : n.t !== 'mastery' && n.t !== 'start' ? el('p', { class: 'dica' }, 'Nenhum efeito numérico (linhas registradas ou explicativas).') : null,
        n.keystone ? [el('h4', {}, 'Regra da keystone'), el('p', {}, el('span', { class: 'selo' }, n.keystone.regra), ' ', el('span', { class: 'eng-id' }, n.keystone.id ?? '—'), n.keystone.regra === 'texto' ? el('div', { class: 'dica' }, 'Só texto: ainda não muda o combate.') : el('div', { class: 'dica' }, 'Aplicada no jogo (ficha/combate).'))] : null,
        n.opcoes ? [el('h4', {}, `Opções da maestria (${n.opcoes.length}) — escolhe uma`), el('div', { class: 'pa-opcoes' }, n.opcoes.map((o) => el('div', { class: 'pa-opcao' }, o.textos.map((t, i) => linhaDeTexto(t, o.estados?.[i])), o.efeitos?.length ? el('div', { class: 'eng-id' }, efeitosEmTexto(o.efeitos)) : null)))] : null,
        vizinhos.length ? [el('h4', {}, `Ligado a (${vizinhos.length})`), el('div', { class: 'eng-card-selos' }, vizinhos.map((v) => el('button', { type: 'button', class: 'selo', onclick: () => { T.sel = v.id; pintarPainel(); const c = document.querySelector('.pa-canvas'); if (c) desenharCanvas(c); } }, v.nome)))] : null));
  }

  function listaDeKeystones() {
    const l = T.dados.nos.filter((n) => n.t === 'keystone').sort((a, b) => a.nome.localeCompare(b.nome));
    const aplicadas = l.filter((n) => n.keystone && n.keystone.regra !== 'texto').length;
    return el('div', {},
      el('div', { class: 'bib-contagem' }, el('b', {}, `Keystones (${l.length})`), el('span', { class: 'dica' }, `${aplicadas} com regra aplicada no jogo · ${l.length - aplicadas} só texto`)),
      el('div', { class: 'bib-tabela' }, el('table', {},
        el('thead', {}, el('tr', {}, ['Keystone', 'Texto do PoE', 'Regra no jogo'].map((h) => el('th', {}, h)))),
        el('tbody', {}, l.map((n) => el('tr', { style: 'cursor:pointer', class: n.id === T.sel ? 'selecionada' : '', onclick: () => { T.sel = n.id; pintarPainel(); } },
          el('td', {}, el('b', {}, n.nome), el('div', { class: 'dica' }, n.en ?? '')), el('td', {}, n.textos.map((t, i) => linhaDeTexto(t, n.estados[i]))),
          el('td', {}, n.keystone?.regra === 'texto' || !n.keystone ? el('span', { class: 'selo aviso' }, 'só texto') : el('span', { class: 'selo usos' }, `${n.keystone.regra}${n.keystone.id ? ` · ${n.keystone.id}` : ''}`))))))));
  }

  function tabelaDeCobertura() {
    const cob = T.dados.cobertura;
    const NOME = { small: 'Pequenos', notable: 'Notáveis', keystone: 'Keystones', mastery: 'Maestrias (opções)', start: 'Inícios', ascendencia: 'Ascendências' };
    const estados = ['equivalente', 'aproximado', 'novo', 'registrado', 'nota'];
    return el('div', {},
      el('div', { class: 'bib-contagem' }, el('b', {}, 'Cobertura da tradução (linhas)'), el('span', { class: 'dica' }, '✓ ≈ ◆ têm efeito no Draevor; ○ registrada sem efeito; · texto explicativo')),
      el('div', { class: 'bib-tabela' }, el('table', {},
        el('thead', {}, el('tr', {}, ['Tipo', 'Nós', ...estados.map((e) => `${SIMBOLO[e]} ${e}`), 'Com efeito'].map((h) => el('th', {}, h)))),
        el('tbody', {}, Object.entries(cob).map(([k, v]) => {
          const total = estados.filter((e) => e !== 'nota').reduce((s, e) => s + (v.estados[e] ?? 0), 0) || 1;
          const efeito = ['equivalente', 'aproximado', 'novo'].reduce((s, e) => s + (v.estados[e] ?? 0), 0);
          return el('tr', {}, el('td', {}, NOME[k] ?? k), el('td', { class: 'num' }, v.nos), ...estados.map((e) => el('td', { class: 'num' }, v.estados[e] ?? 0)), el('td', { class: 'num' }, `${Math.round((efeito / total) * 100)}%`));
        })))));
  }

  return { desenhar };
}

// ================================================================ TABELA DE DROP DO MONSTRO (Acts e Campanha do PoE)

/**
 * O editor da tabela de drop de um monstro: as linhas (item, chance %, "só na missão"), a busca de item para acrescentar e o Salvar (vale
 * na hora no jogo e fica em gamedata/itens-poe/drops-por-monstro.json). `monstro`: o slug do PoE ou a chave do bestiário.
 */
export function editorDeDrops(monstro, drops = [], { somenteLeitura = false, aoSalvar = null } = {}) {
  const T = { lista: drops.map((d) => ({ ...d })), achados: [], sujo: false };
  const caixa = el('div', { class: 'pd-drops' });
  const pintar = () => {
    const linha = (d, i) => el('div', { class: 'pd-linha' },
      el('span', { class: 'pd-item', title: String(d.id) }, d.nome ?? `item ${d.id}`, d.missao ? el('span', { class: 'selo aviso', style: 'margin-left:6px' }, 'missão') : null),
      el('input', { type: 'number', min: 0.01, max: 100, step: 'any', value: d.chance, disabled: somenteLeitura, title: 'chance em % (cada linha sorteia sozinha, a cada morte)', onchange: (e) => { d.chance = Number(e.target.value); T.sujo = true; pintar(); } }), el('span', { class: 'dica' }, '%'),
      el('label', { class: 'marca', title: 'Só cai enquanto a missão da fase está aberta (o item da missão)' }, el('input', { type: 'checkbox', checked: !!d.missao, disabled: somenteLeitura, onchange: (e) => { d.missao = e.target.checked; T.sujo = true; pintar(); } }), 'só na missão'),
      somenteLeitura ? null : el('button', { type: 'button', class: 'fantasma', title: 'Tirar', onclick: () => { T.lista.splice(i, 1); T.sujo = true; pintar(); } }, '✕'));
    const busca = el('input', { type: 'search', placeholder: 'Buscar item para acrescentar (nome ou ID)…', onchange: async (e) => {
      const q = e.target.value.trim();
      T.achados = q.length >= 2 ? (await (await fetch(`/api/mapas/_conteudo/itens?q=${encodeURIComponent(q)}`)).json()).itens ?? [] : [];
      pintar();
    } });
    caixa.replaceChildren(...[
      T.lista.length ? el('div', { class: 'pd-linhas' }, T.lista.map(linha)) : el('div', { class: 'dica' }, 'Sem drop próprio (só o drop do PoE pela raridade do monstro).'),
      somenteLeitura ? null : el('div', { class: 'pd-busca' }, busca),
      T.achados.length ? el('div', { class: 'pd-achados' }, T.achados.map((it) => el('button', { type: 'button', class: 'selo', onclick: () => { if (!T.lista.some((d) => d.id === it.id)) T.lista.push({ id: it.id, nome: it.name, chance: 1 }); T.achados = []; T.sujo = true; pintar(); } }, `+ ${it.name} (${it.id})`))) : null,
      somenteLeitura ? null : el('div', { class: 'linha' }, el('button', { type: 'button', class: T.sujo ? 'primario' : '', disabled: !T.sujo, onclick: async () => {
        const r = await api('drops', { monstro, lista: T.lista.map(({ id, chance, missao }) => ({ id, chance, ...(missao ? { missao: true } : {}) })) });
        if (!r.ok) return msg(r.erros?.join(' ') ?? 'Não salvou.', 'erro');
        T.lista = r.drops.map((d) => ({ ...d }));
        T.sujo = false;
        msg('Tabela de drop salva (vale na hora).', 'ok');
        aoSalvar?.(r.drops);
        pintar();
      } }, T.sujo ? 'Salvar drops' : 'Drops salvos'), el('span', { class: 'dica' }, 'Por cima do drop do PoE. Cada linha sorteia sozinha a cada morte.'))].filter(Boolean));
  };
  pintar();
  return caixa;
}
