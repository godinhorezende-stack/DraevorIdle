// As três telas da engine para o PoE (grupo "Referência PoE", só com ITENS_POE=1 no servidor):
//   CAMPANHA — os atos com o grafo das áreas (o mesmo que o runtime de atos usa), o mapa do Draevor de cada área (dá para trocar: vale na
//              hora e fica salvo), os monstros com os status do PoE e o desenho do Draevor, as habilidades e o chefe do ato;
//   ÁRVORE   — a árvore passiva do PoE inteira (nós, maestrias, keystones) e as ascendências, com o texto do PoE, a tradução de cada
//              linha e o estado (tem efeito / registrado);
//   CHEFES   — os pináculos e os chefes de ato: status (PoE e no jogo), habilidades convertidas e arena.
import { el, msg, cabecalho, botaoCopiar } from './editor-ui.mjs';
import { retrato } from './editor-sprites.mjs';
import { cartaoDeAtaque, metrica, barrasDeResistencia, seloDoElemento } from './editor-fichas.mjs';
import { editorDeAtaques } from './editor-ataques.mjs';
import { escolherSprite } from './editor-biblioteca-sprites.mjs';
import { arenaDeEfeitos } from './editor-arena-efeitos.mjs';

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
      el('details', { class: 'atq-no-chefe' }, el('summary', {}, el('b', {}, 'Editar ataques e efeitos (com a arena)')), editorDeAtaques(s.slug)),
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

// ================================================================ MOBS (com o PoE ligado: os monstros do PoE, no lugar do bestiário do Tibia)

export function criarTelaDosMobsPoe({ raiz }) {
  const T = { lista: null, sel: null, busca: '', ato: '', soUnicos: false, criaturas: [], qCriatura: '' };
  async function desenhar(resto = []) {
    if (!(await ligado(raiz, 'Mobs'))) return;
    T.lista = (await api('mobs')).mobs;
    if (resto[0]) T.sel = resto[0];
    raiz().replaceChildren(
      cabecalho('Mobs', `Os ${T.lista.length} monstros da campanha do PoE: os status são os do PoE (por nível de área), o desenho é o de uma criatura do Draevor. Os status de cada área se editam na aba Acts (ato → área → mobs); aqui ficam o desenho e os drops dos únicos.`),
      el('div', { class: 'poe-v painel-largo' }, el('section', { id: 'pm-lista', style: 'grid-column: span 2' }), el('aside', { class: 'bib-painel', id: 'pm-painel' })));
    pintarLista();
    pintarPainel();
  }
  const filtrados = () => {
    const t = T.busca.trim().toLowerCase();
    return T.lista.filter((m) => (!t || m.nome.toLowerCase().includes(t) || m.slug.toLowerCase().includes(t)) && (!T.ato || m.ocorrencias.some((o) => String(o.ato) === T.ato)) && (!T.soUnicos || m.unico));
  };
  function pintarLista() {
    const l = filtrados();
    const atos = [...new Set(T.lista.flatMap((m) => m.ocorrencias.map((o) => o.ato)))].sort((a, b) => a - b);
    document.querySelector('#pm-lista')?.replaceChildren(
      el('div', { class: 'bib-contagem pa-barra' }, el('b', {}, `${l.length} de ${T.lista.length}`),
        el('input', { type: 'search', placeholder: 'Buscar monstro…', value: T.busca, oninput: (e) => { T.busca = e.target.value; pintarLista(); } }),
        el('select', { onchange: (e) => { T.ato = e.target.value; pintarLista(); } }, el('option', { value: '' }, 'Todos os atos'), atos.map((a) => el('option', { value: String(a), selected: String(a) === T.ato }, a === 11 ? 'Epílogo' : `Ato ${a}`))),
        el('label', { class: 'marca' }, el('input', { type: 'checkbox', checked: T.soUnicos, onchange: (e) => { T.soUnicos = e.target.checked; pintarLista(); } }), 'só únicos')),
      el('div', { class: 'bib-grade' }, l.slice(0, 120).map((m) => {
        const o = m.ocorrencias[0];
        return el('div', { class: `eng-card${m.slug === T.sel ? ' selecionado' : ''}`, tabindex: 0, role: 'button', onclick: () => { T.sel = m.slug; pintarLista(); pintarPainel(); } },
          el('div', { class: 'eng-card-arte' }, retrato(m.desenho, 64, { categoria: 'monstros' })),
          el('div', { class: 'eng-card-info' }, el('b', { class: 'eng-card-nome' }, m.nome), el('span', { class: 'eng-id' }, m.slug),
            el('div', { class: 'eng-card-selos' }, m.unico ? el('span', { class: 'selo aviso' }, 'único') : null, o ? el('span', { class: 'selo' }, `${o.ato === 11 ? 'Epílogo' : `Ato ${o.ato}`} · nv ${o.nivel}`) : null, o ? el('span', { class: 'selo usos' }, `${num(o.vida + o.escudoDeEnergia)} vida`) : null, m.ocorrencias.length > 1 ? el('span', { class: 'selo' }, `${m.ocorrencias.length} áreas`) : null)));
      })),
      l.length > 120 ? el('p', { class: 'dica' }, `Mostrando 120 de ${l.length}: use a busca ou o filtro de ato.`) : null);
  }
  async function buscarCriaturas(q) {
    T.qCriatura = q;
    T.criaturas = q.length >= 2 ? (await api(`criaturas?q=${encodeURIComponent(q)}`)).criaturas : [];
    pintarPainel();
  }
  function pintarPainel() {
    const caixa = document.querySelector('#pm-painel');
    if (!caixa) return;
    const m = T.lista?.find((x) => x.slug === T.sel);
    if (!m) return caixa.replaceChildren(el('div', { class: 'bib-painel-vazio' }, el('b', {}, 'Escolha um monstro'), el('span', { class: 'dica' }, 'Status do PoE em cada área, o desenho e (nos únicos) o que ele solta.')));
    const trocarDesenho = async (key) => {
      const r = await api('mobs/desenho', { slug: m.slug, desenho: key });
      if (!r.ok) return msg(r.erros?.[0] ?? 'Não deu.', 'erro');
      msg(key ? 'Desenho trocado (vale na próxima entrada nas áreas dele).' : 'Desenho automático de volta.', 'ok');
      T.lista = (await api('mobs')).mobs;
      T.criaturas = [];
      pintarLista();
      pintarPainel();
    };
    T.aba ??= 'status';
    const abas = [['status', 'Status por área'], ['ataques', 'Ataques e efeitos'], ['desenho', 'Desenho'], ['drops', 'Drops']];
    const topo = el('div', { class: 'linha', style: 'gap:12px;align-items:center' }, retrato(m.desenho, 96, { categoria: 'monstros', animar: true }), el('div', {}, el('h2', { class: 'bib-nome' }, m.nome), el('span', { class: 'eng-id' }, m.slug), m.unico ? el('span', { class: 'selo aviso', style: 'margin-left:6px' }, 'único') : null));
    const barraDeAbas = el('div', { class: 'eng-abas', role: 'tablist' }, abas.map(([id, nome]) => el('button', { type: 'button', role: 'tab', class: T.aba === id ? 'ativa' : '', onclick: () => { T.aba = id; pintarPainel(); } }, nome)));
    if (T.aba === 'ataques') return caixa.replaceChildren(el('div', { class: 'bib-painel-corpo' }, topo, barraDeAbas, editorDeAtaques(m.slug)));
    caixa.replaceChildren(el('div', { class: 'bib-painel-corpo' }, topo, barraDeAbas));
    const corpo = caixa.firstChild;
    const secoes = {};
    const sec = (nome, ...filhos) => (secoes[nome] = filhos);
    sec('desenho',
      el('h4', {}, 'Desenho (criatura do Draevor)'),
      el('div', { class: 'dica' }, `Agora: ${m.desenhoDe ?? '—'}${m.desenhoAjustado ? ' (escolhido na Engine)' : ' (automático pelo nome / pelo mapa)'}`),
      el('button', { type: 'button', class: 'primario', onclick: async () => {
        const x = await escolherSprite({ tipo: 'mobs', secoes: ['mobs', 'outfits', 'montarias'], titulo: `Desenho de ${m.nome} — escolha na Biblioteca de sprites` });
        if (x) trocarDesenho(`look:${x.id}`);
      } }, 'Escolher na Biblioteca de sprites'),
      m.desenhoAjustado ? el('button', { type: 'button', onclick: () => trocarDesenho(null) }, 'Voltar ao desenho automático') : null,
      m.desenho?.look ? el('p', { class: 'dica' }, 'Para mudar os quadros, as direções e a animação do próprio desenho: ', el('a', { href: `#sprites/${m.desenho.look}` }, `Editor de sprites (look ${m.desenho.look}) →`)) : null);
    sec('status',
      el('h4', {}, `Status do PoE por área (${m.ocorrencias.length})`),
      el('div', { class: 'bib-tabela' }, el('table', {},
        el('thead', {}, el('tr', {}, ['Área', 'Nível', 'Vida', 'ES', 'Golpe', 'Tempo', 'Armadura', 'Evasão', 'Res. F/G/R/C', 'Exp'].map((h) => el('th', {}, h)))),
        el('tbody', {}, m.ocorrencias.map((o) => el('tr', {}, el('td', {}, `${o.ato === 11 ? 'Ep.' : `A${o.ato}`} · ${o.areaNome}`), el('td', { class: 'num' }, o.nivel), el('td', { class: 'num' }, num(o.vida)), el('td', { class: 'num' }, num(o.escudoDeEnergia)), el('td', { class: 'num' }, num(o.dano)), el('td', { class: 'num' }, `${Number(o.tempoAtaque).toFixed(2)} s`), el('td', { class: 'num' }, num(o.armadura)), el('td', { class: 'num' }, num(o.evasao)), el('td', { class: 'num' }, ['fire', 'ice', 'energy', 'chaos'].map((e) => o.resistencias?.[e] ?? 0).join('/')), el('td', { class: 'num' }, num(o.experiencia))))))),
      el('p', { class: 'dica' }, 'Para mudar os status numa área: aba Acts → o ato → a área → Mobs da área.'));
    sec('drops',
      el('h4', {}, 'Drops'),
      m.unico ? editorDeDrops(m.slug, m.drops ?? []) : el('div', { class: 'dica' }, 'Monstro comum: sem item próprio (modelo do PoE). Cai pela tabela global: ~16% de chance (mais nos mágicos/raros), Item Level = o nível dele, qualquer base até esse nível.'));
    corpo.append(...(secoes[T.aba] ?? []).filter(Boolean));
  }
  return { desenhar };
}

// ================================================================ MAPAS (Campanha → Mapas): os terrenos que as áreas usam

export function criarTelaDosMapasPoe({ raiz }) {
  const T = { lista: null, sel: null, busca: '', soUsados: true };
  async function desenhar() {
    if (!(await ligado(raiz, 'Mapas'))) return;
    T.lista = (await api('mapas')).mapas;
    raiz().replaceChildren(
      cabecalho('Mapas', `Os ${T.lista.length} mapas do Draevor que servem de terreno às áreas da campanha. Veja quem usa cada um, troque o mapa de uma área e abra o mapa no Editor de mapas (Ferramentas) para mudar o chão e os spawns.`),
      el('div', { class: 'poe-v painel-largo' }, el('section', { id: 'pmap-lista', style: 'grid-column: span 2' }), el('aside', { class: 'bib-painel', id: 'pmap-painel' })));
    pintar();
  }
  function pintar() {
    const t = T.busca.trim().toLowerCase();
    const l = T.lista.filter((m) => (!T.soUsados || m.areas.length) && (!t || m.nome.toLowerCase().includes(t) || m.id.includes(t) || m.areas.some((a) => a.nome.toLowerCase().includes(t))));
    document.querySelector('#pmap-lista')?.replaceChildren(
      el('div', { class: 'bib-contagem pa-barra' }, el('b', {}, `${l.length} mapa(s)`), el('input', { type: 'search', placeholder: 'Buscar mapa ou área…', value: T.busca, oninput: (e) => { T.busca = e.target.value; pintar(); } }),
        el('label', { class: 'marca' }, el('input', { type: 'checkbox', checked: T.soUsados, onchange: (e) => { T.soUsados = e.target.checked; pintar(); } }), 'só os usados')),
      el('div', { class: 'bib-grade' }, l.map((m) => el('div', { class: `eng-card${m.id === T.sel ? ' selecionado' : ''}`, tabindex: 0, role: 'button', onclick: () => { T.sel = m.id; pintar(); } },
        el('div', { class: 'eng-card-arte' }, retrato(m.desenho, 64, { categoria: 'mapas' })),
        el('div', { class: 'eng-card-info' }, el('b', { class: 'eng-card-nome' }, m.nome), el('span', { class: 'eng-id' }, m.id),
          el('div', { class: 'eng-card-selos' }, m.nivel ? el('span', { class: 'selo' }, `nv ${m.nivel}`) : null, el('span', { class: m.areas.length ? 'selo usos' : 'selo' }, m.areas.length ? `${m.areas.length} área(s)` : 'livre')))))));
    const m = T.lista.find((x) => x.id === T.sel);
    document.querySelector('#pmap-painel')?.replaceChildren(!m ? el('div', { class: 'bib-painel-vazio' }, el('b', {}, 'Escolha um mapa'), el('span', { class: 'dica' }, 'Quem usa, trocar o mapa de uma área e abrir no Editor de mapas.')) : el('div', { class: 'bib-painel-corpo' },
      el('h2', { class: 'bib-nome' }, m.nome), el('span', { class: 'eng-id' }, m.id),
      el('div', { class: 'linha' }, el('a', { class: 'botao', href: `#mapas/${encodeURIComponent(m.id)}` }, 'Abrir no Editor de mapas →')),
      el('h4', {}, `Áreas que usam este mapa (${m.areas.length})`),
      m.areas.length ? el('div', { class: 'pmap-areas' }, m.areas.map((a) => el('div', { class: 'linha' }, el('span', { class: 'selo' }, a.ato === 11 ? 'Ep.' : `A${a.ato}`), el('b', { style: 'flex:1' }, a.nome), el('span', { class: 'dica' }, `nv ${a.nivel}${a.trocado ? ' · trocado' : ''}`), el('a', { href: `#poe-fases/poe-ato-${a.ato}/${a.id}` }, 'editar a fase →')))) : el('p', { class: 'dica' }, 'Nenhuma área usa este mapa. Para ligar: Campanha → Fases → a fase → Mapa e mobs da área.')));
  }
  return { desenhar };
}

// ================================================================ MISSÕES (Campanha → Missões): as missões do Drive e o que o jogo liga a elas

export function criarTelaDasMissoesPoe({ raiz }) {
  const T = { lista: null, sel: null, busca: '', ato: '', soLigadas: false };
  async function desenhar() {
    if (!(await ligado(raiz, 'Missões'))) return;
    T.lista = (await api('missoes')).missoes;
    raiz().replaceChildren(
      cabecalho('Missões', `As ${T.lista.length} missões da campanha (coleção do Drive): onde cada uma passa, os objetivos de cada etapa, a recompensa e o que já está ligado no jogo — o item de missão e as fases cuja conclusão vem dela.`),
      el('div', { class: 'poe-v painel-largo' }, el('section', { id: 'pmis-lista', style: 'grid-column: span 2' }), el('aside', { class: 'bib-painel', id: 'pmis-painel' })));
    pintar();
  }
  function pintar() {
    const t = T.busca.trim().toLowerCase();
    const l = T.lista.filter((m) => (!T.ato || String(m.ato) === T.ato) && (!T.soLigadas || m.fasesLigadas.length) && (!t || m.nome.toLowerCase().includes(t) || m.areas.some((a) => a.nome.toLowerCase().includes(t))));
    const atos = [...new Set(T.lista.map((m) => m.ato))].sort((a, b) => a - b);
    document.querySelector('#pmis-lista')?.replaceChildren(
      el('div', { class: 'bib-contagem pa-barra' }, el('b', {}, `${l.length} missão(ões)`), el('input', { type: 'search', placeholder: 'Buscar missão ou área…', value: T.busca, oninput: (e) => { T.busca = e.target.value; pintar(); } }),
        el('select', { onchange: (e) => { T.ato = e.target.value; pintar(); } }, el('option', { value: '' }, 'Todos os atos'), atos.map((a) => el('option', { value: String(a), selected: String(a) === T.ato }, `Ato ${a}`))),
        el('label', { class: 'marca' }, el('input', { type: 'checkbox', checked: T.soLigadas, onchange: (e) => { T.soLigadas = e.target.checked; pintar(); } }), 'só as ligadas a uma fase')),
      el('div', { class: 'pmis-lista' }, l.map((m) => el('button', { type: 'button', class: `pmis-item${m.slug === T.sel ? ' ativo' : ''}`, onclick: () => { T.sel = m.slug; pintar(); } },
        el('span', { class: 'selo' }, `Ato ${m.ato}`), el('b', {}, m.nome), el('span', { class: 'dica' }, `${m.tipo === 'Optional' ? 'opcional' : 'principal'} · ${m.areas.length} área(s)`),
        m.fasesLigadas.length ? el('span', { class: 'selo usos' }, `ligada a ${m.fasesLigadas.length} fase(s)`) : el('span', { class: 'selo' }, 'sem fase'), m.item ? el('span', { class: 'selo aviso' }, `📜 ${m.item.nome}`) : null))));
    const m = T.lista.find((x) => x.slug === T.sel);
    document.querySelector('#pmis-painel')?.replaceChildren(!m ? el('div', { class: 'bib-painel-vazio' }, el('b', {}, 'Escolha uma missão'), el('span', { class: 'dica' }, 'As etapas por área, a recompensa e as fases ligadas a ela.')) : el('div', { class: 'bib-painel-corpo' },
      el('h2', { class: 'bib-nome' }, m.nome), el('div', { class: 'dica' }, `Ato ${m.ato} · ${m.tipo === 'Optional' ? 'missão opcional' : 'missão principal'}`),
      m.descricao ? el('p', {}, m.descricao) : null,
      m.recompensa ? el('p', { class: 'dica' }, `Recompensa no PoE: ${m.recompensa}`) : null,
      el('h4', {}, 'No jogo'),
      m.item ? el('div', { class: 'linha' }, el('span', { class: 'conc-icone' }, '📜'), el('b', {}, m.item.nome), el('span', { class: 'dica' }, `item de missão · ${m.item.monstroNome} carrega`)) : el('p', { class: 'dica' }, 'Sem item de missão.'),
      m.fasesLigadas.length ? el('div', { class: 'pmap-areas' }, m.fasesLigadas.map((f) => el('div', { class: 'linha' }, el('span', { class: 'selo usos' }, f.conclusao?.tipo === 'item-de-missao' ? '📜 item' : '☠ chefe'), el('b', { style: 'flex:1' }, `${f.atoNome} · ${f.nome}`), el('a', { href: `#poe-fases/${f.ato}/${f.fase}` }, 'editar a fase →'))))
        : el('p', { class: 'dica' }, 'Nenhuma fase conclui por esta missão. Para ligar: abra uma das fases abaixo e escolha em "Como a fase conclui".'),
      m.fasesDaMissao.length ? [el('h5', {}, 'Fases por onde ela passa'), el('div', { class: 'eng-card-selos' }, m.fasesDaMissao.map((f) => el('a', { class: 'selo', href: `#poe-fases/${f.ato}/${f.fase}` }, f.nome)))] : null,
      el('h4', {}, 'Etapas (do Drive)'),
      m.areas.map((a) => el('div', { class: 'pmis-area' }, el('b', {}, `${a.nome}${a.cidade ? ' (cidade)' : ''}`), el('ol', {}, a.etapas.map((e) => el('li', { value: e.etapa }, e.objetivos.slice(0, 2).join(' — ') || e.titulo || '', e.alvos.length ? el('span', { class: 'dica' }, ` · alvo: ${e.alvos.join(', ')}` ) : null, e.npcs.length ? el('span', { class: 'dica' }, ` · NPC: ${e.npcs.join(', ')}`) : null)))))));
  }
  return { desenhar };
}

// ================================================================ MODIFICADORES (Conteúdo → Modificadores): os mods de monstro do PoE e o ouro

const ESTADO_DO_MOD = { efeito: ['ok', 'tem efeito'], aproximado: ['ok', 'efeito aproximado'], parcial: ['aviso', 'efeito parcial'], registrado: ['', 'registrado (sem efeito ainda)'] };
const NOME_DO_STAT = { vidaPct: 'vida %', danoPct: 'dano %', velocidadePct: 'movimento %', velocidadeDeAtaquePct: 'velocidade de ataque %', regenPct: 'regeneração (% da vida/s)', precisaoPct: 'precisão %', evasaoPct: 'evasão %', armaduraPct: 'armadura %', bloqueio: 'bloqueio %', reducaoDeDano: 'redução de dano %', critChance: 'chance de crítico %', critMultiplicador: 'dano crítico %' };
const NOME_DO_EL = { physical: 'física', fire: 'fogo', ice: 'gelo', energy: 'raio', chaos: 'caos', earth: 'veneno' };
const pctX = (f) => `+${num(Math.round(f * 100))}%`;

export function criarTelaDosModificadoresPoe({ raiz }) {
  const T = { d: null, sel: null, busca: '', raridade: '', estado: '', nivel: '' };
  async function desenhar() {
    if (!(await ligado(raiz, 'Modificadores'))) return;
    T.d = await api('modificadores-monstro');
    raiz().replaceChildren(
      cabecalho('Modificadores de monstro', `Os ${T.d.mods.length} modificadores de monstro do PoE (poedb). Monstro Normal não tem; Mágico sorteia 1; Raro, 2 a 4 — pelo peso, entre os de nível até o do monstro, sem repetir a família. Os ocultos da raridade e o ouro por level estão no fim.`),
      el('div', { class: 'poe-v painel-largo' }, el('section', { id: 'pmod-lista', style: 'grid-column: span 2' }), el('aside', { class: 'bib-painel', id: 'pmod-painel' })),
      el('div', { class: 'eng-painel', id: 'pmod-regras' }));
    pintar();
    pintarRegras();
  }
  function pintar() {
    const t = T.busca.trim().toLowerCase();
    const nivel = Number(T.nivel) || null;
    const l = T.d.mods.filter((m) => (!T.raridade || (T.raridade === 'magico' ? m.pesoMagico > 0 : m.pesoRaro > 0)) && (!T.estado || m.estado === T.estado) && (!nivel || m.nivel <= nivel)
      && (!t || m.nome.toLowerCase().includes(t) || (m.nomeEn ?? '').toLowerCase().includes(t) || m.linhas.some((x) => x.toLowerCase().includes(t))));
    document.querySelector('#pmod-lista')?.replaceChildren(
      el('div', { class: 'bib-contagem pa-barra' }, el('b', {}, `${l.length} modificador(es)`),
        el('input', { type: 'search', placeholder: 'Buscar nome ou texto…', value: T.busca, oninput: (e) => { T.busca = e.target.value; pintar(); } }),
        el('select', { onchange: (e) => { T.raridade = e.target.value; pintar(); } }, [['', 'Mágico e Raro'], ['magico', 'Sai em Mágico'], ['raro', 'Sai em Raro']].map(([v, n]) => el('option', { value: v, selected: v === T.raridade }, n))),
        el('select', { onchange: (e) => { T.estado = e.target.value; pintar(); } }, el('option', { value: '' }, 'Todos os estados'), Object.entries(ESTADO_DO_MOD).map(([v, [, n]]) => el('option', { value: v, selected: v === T.estado }, n))),
        el('input', { type: 'number', min: 1, max: 100, placeholder: 'Nível do monstro', value: T.nivel, style: 'width:9em', oninput: (e) => { T.nivel = e.target.value; pintar(); } })),
      el('div', { class: 'pmis-lista' }, l.map((m) => el('button', { type: 'button', class: `pmis-item${m.id === T.sel ? ' ativo' : ''}`, onclick: () => { T.sel = m.id; pintar(); } },
        el('span', { class: 'selo' }, `nv ${m.nivel}`), el('b', {}, m.nome), el('span', { class: 'dica' }, m.linhas.slice(0, 2).join(' · ')),
        m.pesoMagico > 0 ? el('span', { class: 'selo' }, 'Mágico') : null, m.pesoRaro > 0 ? el('span', { class: 'selo' }, 'Raro') : null,
        el('span', { class: `selo ${ESTADO_DO_MOD[m.estado]?.[0] ?? ''}` }, ESTADO_DO_MOD[m.estado]?.[1] ?? m.estado)))));
    const m = T.d.mods.find((x) => x.id === T.sel);
    document.querySelector('#pmod-painel')?.replaceChildren(!m ? el('div', { class: 'bib-painel-vazio' }, el('b', {}, 'Escolha um modificador'), el('span', { class: 'dica' }, 'O texto do PoE, o que vale no Draevor, o peso e o nível.')) : el('div', { class: 'bib-painel-corpo' },
      el('h2', { class: 'bib-nome' }, m.nome), el('span', { class: 'eng-id' }, `${m.nomeEn ?? ''} · ${m.id}`),
      el('div', { class: 'eng-card-selos' }, el('span', { class: 'selo' }, m.tipo === 'archnemesis' ? 'Archnemesis' : 'Modificador'), el('span', { class: 'selo' }, `nível ${m.nivel}+`),
        el('span', { class: 'selo' }, `peso Mágico ${num(m.pesoMagico)}`), el('span', { class: 'selo' }, `peso Raro ${num(m.pesoRaro)}`), el('span', { class: `selo ${ESTADO_DO_MOD[m.estado]?.[0] ?? ''}` }, `${ESTADO_DO_MOD[m.estado]?.[1] ?? m.estado} (${m.valem}/${m.total})`)),
      el('h4', {}, 'No PoE'), el('ul', {}, m.linhas.map((x) => el('li', {}, x))),
      el('h4', {}, 'No Draevor'),
      Object.keys(m.stats).length || m.mecanicas?.length ? el('ul', {},
        Object.entries(m.stats).filter(([k]) => k !== 'resist').map(([k, v]) => el('li', {}, `${NOME_DO_STAT[k] ?? k}: ${v > 0 ? '+' : ''}${num(v)}`)),
        Object.entries(m.stats.resist ?? {}).map(([k, v]) => el('li', {}, `resistência a ${NOME_DO_EL[k] ?? k}: ${v > 0 ? '+' : ''}${num(v)}%`)),
        (m.mecanicas ?? []).map((x) => el('li', {}, `no golpe (${x.chance}%): ${x.danoPctDoGolpe}% do dano em ${NOME_DO_EL[x.elemento] ?? x.elemento} ao longo de ${x.duracaoMs / 1000} s`)))
        : el('p', { class: 'dica' }, 'Nada ainda — fica registrado e não entra no sorteio.'),
      el('h5', {}, 'Stats do PoE'), el('pre', { class: 'bib-json' }, m.statsPoe.map((s) => `${s.stat}: ${s.min === s.max ? s.min : `${s.min} a ${s.max}`}`).join('\n') || '—')));
  }
  function pintarRegras() {
    const d = T.d;
    const o = d.ocultos ?? {};
    const linhaOculto = (r, n) => o[r] ? el('tr', {}, el('th', {}, n), el('td', {}, pctX(o[r].vidaMais)), el('td', {}, pctX(o[r].danoMais)), el('td', {}, `+${o[r].velocidadeDeAtaquePct}%`), el('td', {}, `+${o[r].velocidadePct}%`), el('td', {}, d.expPorRaridade?.[r] ? `×${num(d.expPorRaridade[r])}` : pctX(o[r].expMais))) : null;
    const mult = (r) => d.ouro?.porRaridade?.[r] ?? 1 + (d.bonusDeQuantidade?.[r] ?? 0);
    document.querySelector('#pmod-regras')?.replaceChildren(el('div', { class: 'eng-painel-corpo' },
      el('h3', {}, 'Ocultos da raridade (o que o monstro do PoE ganha sem aparecer)'),
      el('p', { class: 'dica' }, `Chance de um monstro comum nascer Mágico ${num((d.sorteioDaRaridade.modificado ?? 0) * 100)}% e Raro ${num((d.sorteioDaRaridade.raro ?? 0) * 100)}% (spawn sem raridade). O spawn que define a raridade no Editor de mapas manda; os únicos do PoE já vêm com os números de único.`),
      el('table', { class: 'mob-tabela' }, el('tr', {}, el('th', {}, 'Raridade'), el('th', {}, 'Vida'), el('th', {}, 'Dano'), el('th', {}, 'Vel. ataque'), el('th', {}, 'Movimento'), el('th', {}, 'Exp')),
        linhaOculto('magico', 'Mágico'), linhaOculto('raro', 'Raro / Elite'), linhaOculto('unico', 'Único / Chefe')),
      el('h3', {}, 'Ouro por level do monstro'),
      el('p', { class: 'dica' }, `Aleatório entre o mínimo e o máximo (interpolado entre os levels da tabela) × a raridade: Normal ×${num(mult('normal'))}, Mágico ×${num(mult('modificado'))}, Raro ×${num(mult('raro'))}, Único/Chefe ×${num(mult('boss'))}; soma o Gold Find. Editável em gamedata/itens-poe/regras.json → ouro.`),
      el('div', { style: 'overflow-x:auto' }, el('table', { class: 'mob-tabela' }, el('tr', {}, el('th', {}, 'Level'), (d.ouro?.tabela ?? []).map(([lv]) => el('th', {}, lv))), el('tr', {}, el('th', {}, 'Ouro'), (d.ouro?.tabela ?? []).map(([, a, b]) => el('td', {}, `${a}–${b}`)))))));
  }
  return { desenhar };
}

// ================================================================ GEMAS (Conteúdo → Gemas) e a ARENA DE GEMAS (Ferramentas)
// A coleção do dono (`poe-gemas-poedb`, servida por `admin/gemas-poe.mjs`): as 562 gemas ativas do poedb, cada uma com o STATUS verificado
// usando a gema na Arena de Gemas dele (funciona / parcial / não) e o porquê; e a própria arena, para ver cada efeito batendo nos mobs.

const STATUS_DA_GEMA = { funciona: ['ok', '✓ funciona'], parcial: ['aviso', '◐ parcial'], nao: ['erro', '✗ não funciona'] };
const COR_DA_GEMA = { vermelha: '#e0705c', verde: '#7fd36b', azul: '#6ba5e0', branca: '#e8e2d0' };
const iconeDaGema = (g, tamanho = 40) => el('img', { src: g.iconeUrl ?? `${BASE}gemas-arena/${g.icone}`, alt: '', width: tamanho, height: tamanho, loading: 'lazy', style: `width:${tamanho}px;height:${tamanho}px;object-fit:contain`, onerror: (e) => (e.target.style.visibility = 'hidden') });

export function criarTelaDasGemasPoe({ raiz }) {
  const T = { lista: null, resumo: null, sel: null, det: null, busca: '', status: '', jogo: '', cor: '', arq: '' };
  async function desenhar(args = []) {
    if (!(await ligado(raiz, 'Gemas'))) return;
    const r = await api('gemas');
    if (!r.ok) return raiz().replaceChildren(cabecalho('Gemas', r.erros?.[0] ?? 'Sem a coleção de gemas.'));
    T.lista = r.gemas;
    T.resumo = r.resumo;
    if (args[0]) T.sel = decodeURIComponent(args[0]);
    const s = T.resumo.porStatus;
    const j = T.resumo.porStatusJogo ?? {};
    raiz().replaceChildren(
      cabecalho('Gemas', `As ${T.resumo.total} gemas ativas do PoE (poedb, coleção do dono) — no modo PoE elas substituem as gemas do Draevor. Dois status: NA ARENA (a simulação do dono: ✓ ${s.funciona ?? 0}, ◐ ${s.parcial ?? 0}, ✗ ${s.nao ?? 0}) e NO JOGO (o combate do Draevor, com a forma e o efeito visual de uma magia parecida: ✓ ${j.funciona ?? 0}, ◐ ${j.parcial ?? 0}, ✗ ${j.nao ?? 0}). Cada gema diz o que falta. "Ver na arena" abre a gema batendo nos mobs.`),
      el('div', { class: 'poe-v painel-largo' }, el('section', { id: 'pgem-lista', style: 'grid-column: span 2' }), el('aside', { class: 'bib-painel', id: 'pgem-painel' })));
    pintar();
    if (T.sel) await abrir(T.sel);
  }
  function pintar() {
    const t = T.busca.trim().toLowerCase();
    const l = T.lista.filter((g) => (!T.status || g.status === T.status) && (!T.jogo || g.statusJogo === T.jogo) && (!T.cor || g.cor === T.cor) && (!T.arq || g.arquetipoNome === T.arq)
      && (!t || g.nome.toLowerCase().includes(t) || (g.en ?? '').toLowerCase().includes(t) || g.tags.some((x) => x.toLowerCase().includes(t))));
    const arquetipos = [...new Set(T.lista.map((g) => g.arquetipoNome).filter(Boolean))].sort();
    document.querySelector('#pgem-lista')?.replaceChildren(
      el('div', { class: 'bib-contagem pa-barra' }, el('b', {}, `${l.length} gema(s)`),
        el('input', { type: 'search', placeholder: 'Buscar gema, nome em inglês ou tag…', value: T.busca, oninput: (e) => { T.busca = e.target.value; pintar(); } }),
        el('select', { onchange: (e) => { T.status = e.target.value; pintar(); } }, [['', 'Arena: todos'], ...Object.entries(STATUS_DA_GEMA).map(([k, [, n]]) => [k, `Arena: ${n}`])].map(([v, n]) => el('option', { value: v, selected: v === T.status }, n))),
        el('select', { onchange: (e) => { T.jogo = e.target.value; pintar(); } }, [['', 'Jogo: todos'], ...Object.entries(STATUS_DA_GEMA).map(([k, [, n]]) => [k, `Jogo: ${n}`])].map(([v, n]) => el('option', { value: v, selected: v === T.jogo }, n))),
        el('select', { onchange: (e) => { T.cor = e.target.value; pintar(); } }, [['', 'Todas as cores'], ['vermelha', 'Vermelha (For)'], ['verde', 'Verde (Des)'], ['azul', 'Azul (Int)'], ['branca', 'Branca']].map(([v, n]) => el('option', { value: v, selected: v === T.cor }, n))),
        el('select', { onchange: (e) => { T.arq = e.target.value; pintar(); } }, el('option', { value: '' }, 'Todos os tipos'), arquetipos.map((a) => el('option', { value: a, selected: a === T.arq }, a)))),
      el('div', { class: 'bib-grade' }, l.map((g) => el('div', { class: `eng-card${g.slug === T.sel ? ' selecionado' : ''}`, tabindex: 0, role: 'button', onclick: () => abrir(g.slug) },
        el('div', { class: 'eng-card-arte' }, iconeDaGema(g, 48)),
        el('div', { class: 'eng-card-info' }, el('b', { class: 'eng-card-nome', style: `color:${COR_DA_GEMA[g.cor] ?? ''}` }, g.nome), el('span', { class: 'eng-id' }, g.en),
          el('div', { class: 'eng-card-selos' }, g.status ? el('span', { class: `selo ${STATUS_DA_GEMA[g.status]?.[0] ?? ''}`, title: 'na Arena de Gemas' }, `arena ${STATUS_DA_GEMA[g.status]?.[1] ?? g.status}`) : null, g.statusJogo ? el('span', { class: `selo ${STATUS_DA_GEMA[g.statusJogo]?.[0] ?? ''}`, title: 'no combate do jogo' }, `jogo ${STATUS_DA_GEMA[g.statusJogo]?.[1] ?? g.statusJogo}`) : null, g.arquetipoNome ? el('span', { class: 'selo' }, g.arquetipoNome) : null, el('span', { class: 'selo' }, `nv ${g.nivelReq}`)))))));
  }
  async function abrir(slug) {
    T.sel = slug;
    pintar();
    const g = await api(`gemas/detalhe?slug=${encodeURIComponent(slug)}`);
    if (!g?.slug) return;
    if (g.suporte) return pintarSuporte(g);
    const v = g.verificacao ?? {};
    const st = STATUS_DA_GEMA[v.status] ?? ['', v.status ?? '?'];
    const ex = v.execucao ?? {};
    document.querySelector('#pgem-painel')?.replaceChildren(el('div', { class: 'bib-painel-corpo' },
      el('div', { class: 'linha' }, iconeDaGema(g, 64), el('div', {}, el('h2', { class: 'bib-nome', style: `color:${COR_DA_GEMA[g.cor] ?? ''}` }, g.nome), el('span', { class: 'eng-id' }, `${g.en} · ${g.slug}`))),
      el('div', { class: 'eng-card-selos' }, el('span', { class: `selo ${st[0]}` }, st[1]), v.arquetipoNome ? el('span', { class: 'selo' }, v.arquetipoNome) : null, v.elemento ? el('span', { class: 'selo' }, v.elemento) : null, el('span', { class: 'selo' }, `linhas simuladas ${v.aplicadas ?? 0}/${v.total ?? 0}`), ...(g.tags ?? []).map((t) => el('span', { class: 'selo' }, t))),
      el('div', { class: 'linha' }, el('a', { class: 'botao', href: `#poe-arena-gemas/${encodeURIComponent(g.slug)}` }, 'Ver na arena (batendo nos mobs) →')),
      g.noJogo ? [el('h4', {}, `No jogo: ${STATUS_DA_GEMA[g.noJogo.status]?.[1] ?? g.noJogo.status}`),
        el('p', { class: 'dica' }, `Usa a forma e o efeito visual da magia "${g.noJogo.molde}" do Draevor${g.noJogo.formato ? ` (${g.noJogo.formato})` : ''}, elemento ${g.noJogo.elemento}; o dano, o custo, o tempo e a recarga vêm do nível da gema (a tabela do PoE). Os suportes do Draevor valem nela.`),
        // Os TEMPOS do PoE que o jogo usa (sem o cooldown global do Draevor): conjuração (magia) ou a velocidade da gema sobre o golpe da arma (ataque), e a recarga.
        el('div', { class: 'eng-metricas' }, ...[1, 20].flatMap((n) => {
          const t = g.noJogo.tempos?.[n] ?? {};
          const s = (ms) => `${(ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s`;
          return [
            metrica(g.noJogo.ataque ? `Ataque (nv ${n})` : `Conjuração (nv ${n})`, g.noJogo.ataque ? `arma × ${t.velAtaqueBase ?? 100}%` : t.conjuracaoMs ? s(t.conjuracaoMs) : 'instantânea'),
            metrica(`Recarga (nv ${n})`, t.recargaMs ? `${s(t.recargaMs)}${t.cargas > 1 ? ` · ${t.cargas} usos` : ''}` : 'sem recarga'),
          ];
        })),
        el('p', { class: 'dica' }, 'No jogo: a magia dura a conjuração (÷ a velocidade de conjuração) e o ataque o golpe da arma (APS e velocidade de ataque) ÷ a velocidade da gema; a próxima skill sai quando ela termina — sem o cooldown global do Draevor. Recarga só a da gema no PoE (com a recuperação de recarga).'),
        g.noJogo.motivos.length ? el('ul', {}, g.noJogo.motivos.map((m) => el('li', {}, m))) : el('p', { class: 'dica' }, 'Tudo da gema tem efeito no jogo.')] : null,
      el('h4', {}, `Na arena: ${st[1]}`),
      (v.motivos ?? []).length ? el('ul', {}, v.motivos.map((m) => el('li', {}, m))) : el('p', { class: 'dica' }, 'Todas as linhas de efeito são simuladas.'),
      ex.observado?.length || ex.efeitos?.length ? [el('h4', {}, 'Verificação (a gema usada de verdade)'), el('p', { class: 'dica' }, [...(ex.observado ?? []), ex.efeitos?.length ? `efeitos vistos: ${ex.efeitos.join(', ')}` : null].filter(Boolean).join(' · '))] : null,
      g.desc ? el('p', {}, g.desc) : null,
      el('h4', {}, 'Propriedades'), el('ul', {}, (g.props ?? []).map((p) => el('li', {}, p))),
      (g.mods ?? []).length ? [el('h4', {}, 'Efeitos'), el('ul', {}, g.mods.map((m) => el('li', {}, m)))] : null,
      (g.qualidade ?? []).length ? [el('h4', {}, 'Qualidade'), el('ul', {}, g.qualidade.map((m) => el('li', {}, m)))] : null,
      g.obtencao ? [el('h4', {}, 'Onde se ganha'), el('p', { class: 'dica' }, typeof g.obtencao === 'string' ? g.obtencao : JSON.stringify(g.obtencao))] : null,
      (g.linhas ?? []).length ? [el('h4', {}, `Por nível (${g.linhas.length})`), el('div', { style: 'overflow-x:auto;max-height:280px;overflow-y:auto' }, el('table', { class: 'mob-tabela' }, el('tr', {}, (g.colunas ?? []).map((c) => el('th', {}, c))), g.linhas.map((l) => el('tr', {}, l.map((c) => el('td', {}, c))))))] : null));
  }
  /** O painel de um SUPORTE do PoE: o status no jogo, o gatilho, a compatibilidade e os dados do poedb. */
  function pintarSuporte(g) {
    const j = g.noJogo ?? {};
    const QUANDO = { critico: 'quando o ataque ligado acerta um crítico', abate: 'quando o ataque corpo a corpo ligado mata', danoRecebido: `a cada ${j.gatilho?.limiar ?? '?'} de dano recebido (nível 1)` };
    document.querySelector('#pgem-painel')?.replaceChildren(el('div', { class: 'bib-painel-corpo' },
      el('div', { class: 'linha' }, iconeDaGema(g, 64), el('div', {}, el('h2', { class: 'bib-nome', style: `color:${COR_DA_GEMA[g.cor] ?? ''}` }, g.nome), el('span', { class: 'eng-id' }, `${g.en} · ${g.slug}`))),
      el('div', { class: 'eng-card-selos' }, el('span', { class: 'selo' }, 'Suporte'), ...(g.tags ?? []).map((t) => el('span', { class: 'selo' }, t))),
      el('h4', {}, `No jogo: ${STATUS_DA_GEMA[j.status]?.[1] ?? j.status}`),
      el('p', { class: 'dica' }, `Suporta: ${j.requer?.length ? j.requer.map((t) => t.replace('poe:', '')).join(' + ') : 'qualquer habilidade'}. O efeito usa os números do nível do suporte (a tabela do poedb): "mais/menos dano" multiplica, o custo multiplica, velocidade muda o tempo de uso.`),
      j.gatilho ? el('p', {}, `Gatilho: ativa as magias ligadas ${QUANDO[j.gatilho.quando] ?? j.gatilho.quando}; recarga ${(j.gatilho.recargaMs / 1000).toLocaleString('pt-BR')} s. A magia ativada não se conjura à mão.`) : null,
      (j.motivos ?? []).length ? el('ul', {}, j.motivos.map((m) => el('li', {}, m))) : el('p', { class: 'dica' }, 'Tudo do suporte tem efeito no jogo.'),
      g.desc ? el('p', {}, g.desc) : null,
      el('h4', {}, 'Propriedades'), el('ul', {}, (g.props ?? []).map((p) => el('li', {}, p))),
      (g.mods ?? []).length ? [el('h4', {}, 'Efeitos'), el('ul', {}, g.mods.map((m) => el('li', {}, m)))] : null,
      (g.qualidade ?? []).length ? [el('h4', {}, 'Qualidade'), el('ul', {}, g.qualidade.map((m) => el('li', {}, m)))] : null,
      (g.linhas ?? []).length ? [el('h4', {}, `Por nível (${g.linhas.length})`), el('div', { style: 'overflow-x:auto;max-height:280px;overflow-y:auto' }, el('table', { class: 'mob-tabela' }, el('tr', {}, (g.colunas ?? []).map((c) => el('th', {}, c))), g.linhas.map((l) => el('tr', {}, l.map((c) => el('td', {}, c))))))] : null));
  }
  return { desenhar };
}

export function criarTelaDaArenaDeGemas({ raiz }) {
  async function desenhar(args = []) {
    if (!(await ligado(raiz, 'Arena de gemas'))) return;
    const slug = args[0] ? decodeURIComponent(args[0]) : null;
    const quadro = el('iframe', { src: `${BASE}gemas-arena/engine/index.html`, title: 'Arena de Gemas', style: 'width:100%;height:calc(100vh - 220px);min-height:560px;border:1px solid var(--eng-linha, #2a3438);border-radius:6px;background:#0b0f11' });
    if (slug) quadro.addEventListener('load', () => quadro.contentWindow?.postMessage({ tipo: 'gema', slug }, '*'), { once: true });
    // A ARENA DE EFEITOS logo abaixo (o visual das skills, com o combate e o desenho do jogo): a gema escolhida em cima vem escolhida embaixo.
    const efeitos = arenaDeEfeitos({ slugInicial: slug });
    const ouvir = (e) => { if (e.source === quadro.contentWindow && e.data?.tipo === 'gemaEscolhida' && e.data.slug) efeitos.escolherGema(e.data.slug); };
    // Um ouvinte só (a tela se redesenha ao voltar a ela): o anterior sai.
    if (window.__ouvirArenaDeEfeitos) window.removeEventListener('message', window.__ouvirArenaDeEfeitos);
    window.__ouvirArenaDeEfeitos = ouvir;
    window.addEventListener('message', ouvir);
    raiz().replaceChildren(
      cabecalho('Arena de gemas', 'A Arena de Gemas da coleção do dono: um personagem usando cada gema do PoE contra os monstros do bestiário — escolha a gema na lista da esquerda (ou "Ver na arena" na aba Gemas), o mob, o nível e a quantidade. O inspetor da direita marca cada linha de efeito: ✓ simulada, ✗ não simulada. "Mobs usam esta gema" faz os monstros usarem a gema contra você; "Tour" passa pelas gemas filtradas sozinho. Abaixo, a Arena de Efeitos: o visual de cada skill no jogo.'),
      quadro, efeitos.elemento);
  }
  return { desenhar };
}
