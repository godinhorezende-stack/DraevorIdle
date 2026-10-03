// O PAINEL POR HUNT do /editor/conteudo: o mapa, os monstros, a distribuição de raridade, a dificuldade e os drops esperados de uma hunt, num
// lugar só. SOMENTE LEITURA (a hunt é editada onde sempre foi: mapa no /editor, encontros em "Fases e encontros"). Os dados vêm de
// `admin/hunts.mjs` (`hunts` e `hunts/painel`); nenhuma conta de jogo é feita aqui.
import { el, cabecalho } from './editor-ui.mjs';
import { retrato } from './editor-sprites.mjs';
import { tabelaDeDrops, num, pct } from './editor-drops.mjs';

const NOME_DA_RARIDADE = { normal: 'Normal', modificado: 'Modificado', raro: 'Raro', elite: 'Elite', unico: 'Único', boss: 'Boss' };
const COR_DA_RARIDADE = { normal: '#9aa4bd', modificado: '#5aa9ff', raro: '#f2d04a', elite: '#ff9d3c', unico: '#c58bff', boss: '#ff5b4f' };
const CATEGORIAS = [['', 'Todas'], ['hunts', 'Normais'], ['vips', 'VIP'], ['especiais', 'Especiais'], ['divinas', 'Divinas']];

export function criarPainelDeHunts({ api, raiz, irPara }) {
  const H = { lista: [], q: '', categoria: '', id: null, dif: 'facil', painel: null, andar: null, pedido: 0 };

  async function desenhar(resto = []) {
    if (!H.lista.length) H.lista = (await api('hunts')).hunts;
    if (resto[0] && resto[0] !== H.id) await abrir(resto[0], false);
    else pintar();
  }
  async function abrir(id, pintarAgora = true) {
    H.id = id;
    const meu = ++H.pedido;
    const p = await api(`hunts/painel?${new URLSearchParams({ id, dif: H.dif })}`);
    if (meu !== H.pedido) return;
    H.painel = p?.id ? p : null;
    H.andar = H.painel?.spawns?.porAndar?.[0]?.andar ?? null;
    history.replaceState(null, '', `#hunts/${encodeURIComponent(id)}`);
    if (pintarAgora) pintar();
    else pintar();
  }

  const secao = (titulo, ...filhos) => el('section', { class: 'hunt-sec' }, el('h3', {}, titulo), ...filhos);
  const metrica = (rotulo, valor, dica = null) => el('div', { class: 'eng-metrica', title: dica ?? '' }, el('span', {}, rotulo), el('b', {}, valor ?? '—'));
  const naoCad = (t = 'não cadastrado') => el('span', { class: 'dica' }, t);

  function listaLateral() {
    const q = H.q.trim().toLowerCase();
    const itens = H.lista.filter((h) => (!H.categoria || h.categoria === H.categoria) && (!q || h.nome.toLowerCase().includes(q) || h.id.includes(q)));
    return el('aside', { class: 'hunts-lista' },
      el('input', { type: 'search', placeholder: 'buscar hunt…', value: H.q, oninput: (e) => { H.q = e.target.value; repintarLista(); } }),
      el('div', { class: 'hunts-cats' }, CATEGORIAS.map(([id, nome]) => el('button', { type: 'button', class: H.categoria === id ? 'ativa' : '', onclick: () => { H.categoria = id; repintarLista(); } }, nome))),
      el('div', { class: 'hunts-itens', id: 'hunts-itens' }, itens.slice(0, 300).map((h) => el('button', { type: 'button', class: `hunts-item${h.id === H.id ? ' ativa' : ''}`, onclick: () => abrir(h.id) }, el('b', {}, h.nome), el('small', {}, `${h.tipo}${h.nivel != null ? ` · lv ${h.nivel}` : ''}${h.spawns ? ` · ${h.spawns} spawns` : ' · sem spawns'}`)))),
      el('div', { class: 'dica' }, `${itens.length} hunt(s)`));
  }
  function repintarLista() {
    document.querySelector('.hunts-lista')?.replaceWith(listaLateral());
    document.querySelector('.hunts-lista input')?.focus();
  }

  function minimapa(p) {
    const { largura, altura } = p.mapa;
    const pontos = p.spawns.pontos.filter((s) => H.andar == null || s.z === H.andar);
    if (!largura || !altura || !pontos.length) return el('div', { class: 'dica' }, p.spawns.total ? 'Sem pontos neste andar.' : 'O mapa não define spawns (a hunt usa o cadastro).');
    const esc = Math.min(4, 320 / Math.max(largura, altura));
    const c = el('canvas', { width: Math.round(largura * esc), height: Math.round(altura * esc), class: 'hunt-minimapa', role: 'img', 'aria-label': `Spawns de ${p.nome}` });
    const g = c.getContext('2d');
    g.fillStyle = '#0b0d12';
    g.fillRect(0, 0, c.width, c.height);
    for (const s of pontos) {
      g.globalAlpha = 0.18;
      g.fillStyle = COR_DA_RARIDADE[s.raridade] ?? '#9aa4bd';
      g.fillRect((s.x - s.raio) * esc, (s.y - s.raio) * esc, (2 * s.raio + 1) * esc, (2 * s.raio + 1) * esc);
      g.globalAlpha = 1;
      g.beginPath();
      g.arc((s.x + 0.5) * esc, (s.y + 0.5) * esc, Math.max(2, esc * (s.raridade === 'normal' ? 0.6 : 1)), 0, Math.PI * 2);
      g.fill();
    }
    return c;
  }

  function sMapa(p) {
    const m = p.mapa;
    const andares = p.spawns.porAndar;
    return secao('Mapa',
      el('div', { class: 'eng-metricas' }, metrica('Arquivo', m.arquivo ?? 'sem arquivo'), metrica('Tamanho', m.largura && m.altura ? `${m.largura} × ${m.altura}` : null), metrica('Andares', m.andares?.join(', ')), metrica('Tipo', m.real == null ? null : m.real ? 'real (só spawns editáveis)' : 'do editor (chão e spawns)'), metrica('Spawns', `${p.spawns.total} (${p.spawns.bichos} bichos)`)),
      andares.length > 1 ? el('label', { class: 'campo' }, 'Andar', el('select', { onchange: (e) => { H.andar = Number(e.target.value); pintar(); } }, andares.map((a) => el('option', { value: a.andar, selected: a.andar === H.andar }, `${a.andar} — ${a.spawns} spawns`)))) : null,
      minimapa(p),
      el('div', { class: 'hunt-legenda' }, Object.entries(NOME_DA_RARIDADE).map(([r, n]) => el('span', {}, el('i', { style: `background:${COR_DA_RARIDADE[r]}` }), n))),
      m.arquivo ? el('a', { class: 'eng-link', href: `#mapas/${encodeURIComponent(p.id)}` }, 'Abrir no editor de mapas →') : naoCad('Sem arquivo de mapa: a hunt usa o terreno do cadastro.'));
  }

  function sMonstros(p) {
    const lista = p.monstros.definidosPeloMapa;
    if (!lista.length) {
      return secao('Monstros', el('div', { class: 'dica' }, 'O mapa não define spawns; estes são os monstros que o cadastro diz que vivem na hunt (sem quantidade).'),
        p.monstros.doCadastro?.length ? el('div', { class: 'hunt-monstros' }, p.monstros.doCadastro.map((m) => el('div', { class: 'hunt-monstro' }, retrato(m.desenho, 40, { categoria: 'monstros', rotulo: m.nome }), el('span', {}, el('b', {}, m.nome ?? m.key), el('small', {}, `vida ${num(m.hp, 0)} · exp ${num(m.exp, 0)}`))))) : naoCad('nenhum monstro cadastrado'));
    }
    const maior = Math.max(...lista.map((m) => m.mortesPorLimpeza));
    return secao('Monstros e distribuição na hunt',
      el('div', { class: 'dica' }, 'Quantos bichos de cada criatura uma limpeza espera (cada spawn gera `quantidade` bichos, repartidos pelo peso das criaturas dele).'),
      el('div', { class: 'hunt-monstros' }, lista.map((m) => el('div', { class: 'hunt-monstro' }, retrato(m.desenho, 40, { categoria: 'monstros', rotulo: m.nome }),
        el('span', {}, el('b', {}, m.nome ?? m.key), el('small', {}, `${m.classe ?? 'sem classe'} · vida ${num(m.hp, 0)}${m.hpNaEscala !== m.hp ? ` → ${num(m.hpNaEscala, 0)} na escala` : ''} · em ${m.spawnsComEle} spawn(s)`)),
        el('span', { class: 'hunt-barra' }, el('i', { style: `width:${Math.round((m.mortesPorLimpeza / maior) * 100)}%` }), el('em', {}, `${num(m.mortesPorLimpeza, 1)} (${pct(m.pctDosBichos)})`))))));
  }

  function sDistribuicao(p) {
    const d = p.distribuicao;
    if (!d) return secao('Distribuição de raridade', naoCad('sem spawns no mapa'));
    return secao('Distribuição de raridade',
      el('div', { class: 'dica' }, d.observacao),
      el('table', { class: 'hunt-tabela' }, el('thead', {}, el('tr', {}, ['Raridade', 'Spawns', 'Bichos', '% dos spawns', 'Alvo da distribuição'].map((h) => el('th', {}, h)))),
        el('tbody', {}, d.linhas.map((l) => el('tr', {}, el('td', {}, el('i', { class: 'hunt-bolinha', style: `background:${COR_DA_RARIDADE[l.raridade]}` }), NOME_DA_RARIDADE[l.raridade] ?? l.raridade), el('td', { class: 'num' }, l.spawns), el('td', { class: 'num' }, l.bichos), el('td', { class: 'hunt-barra-celula' }, el('span', { class: 'hunt-barra' }, el('i', { style: `width:${Math.min(100, l.pctDosSpawns ?? 0)}%;background:${COR_DA_RARIDADE[l.raridade]}` }), el('em', {}, pct(l.pctDosSpawns)))), el('td', { class: 'num' }, l.alvoPct != null ? pct(l.alvoPct) : '—'))))));
  }

  function sDificuldade(p) {
    const d = p.dificuldade;
    const seletor = el('div', { class: 'hunts-cats' }, (d.porDificuldade ?? []).map((x) => el('button', { type: 'button', class: H.dif === x.id ? 'ativa' : '', onclick: () => { H.dif = x.id; abrir(H.id); } }, x.nome)));
    if (d.tipo !== 'campanha') return secao('Dificuldade', el('div', { class: 'eng-metricas' }, metrica('Level da hunt', d.levelDaHunt)), el('div', { class: 'dica' }, d.observacao));
    return secao('Dificuldade (campanha)', seletor,
      el('div', { class: 'eng-metricas' }, metrica('Ato', d.ato), metrica('Level original', d.levelOriginal)),
      el('table', { class: 'hunt-tabela' }, el('thead', {}, el('tr', {}, ['Dificuldade', 'Level alvo', 'Vida ×', 'Dano ×', 'Exp ×'].map((h) => el('th', {}, h)))),
        el('tbody', {}, d.porDificuldade.map((x) => el('tr', { class: x.id === H.dif ? 'ativa' : '' }, el('td', {}, x.nome), el('td', { class: 'num' }, x.levelAlvo), el('td', { class: 'num' }, num(x.vida, 3)), el('td', { class: 'num' }, num(x.dano, 3)), el('td', { class: 'num' }, num(x.exp, 3)))))),
      el('div', { class: 'dica' }, d.observacao));
  }

  function sDrops(p) {
    const dr = p.drops;
    const linhas = dr.itens.map((i) => ({ id: i.item, nome: i.nome, desenho: i.desenho, chancePct: Math.max(...i.fontes.map((f) => f.chancePct)), esperado: i.quedasPorLimpeza, valor: i.valorPorLimpeza, origem: i.fontes.slice(0, 3).map((f) => `${f.monstro} ${pct(f.chancePct)}`).join(' · ') + (i.fontes.length > 3 ? ` +${i.fontes.length - 3}` : ''), aviso: i.existe ? null : 'item inexistente no catálogo' }));
    return secao('Drops esperados por limpeza',
      el('div', { class: 'dica' }, dr.modelo),
      el('div', { class: 'eng-metricas' }, metrica('Bichos por limpeza', num(dr.bichosPorLimpeza, 0)), metrica('Ouro esperado', num(dr.ouroEsperado, 0), 'moedas dos bichos, na escala da fase'), metrica('Itens (valor NPC)', num(dr.valorDosItensEsperado, 0)), metrica('Total esperado', num(dr.valorTotalEsperado, 0), 'ouro + itens vendidos ao NPC')),
      dr.bichosPorLimpeza ? tabelaDeDrops(linhas, { rotuloDoEsperado: 'Quedas / limpeza', ordem: 'valor', vazio: 'Os monstros desta hunt não têm itens na tabela de loot.' }) : el('div', { class: 'dica' }, 'Sem spawns no mapa: não há como estimar o loot por limpeza.'),
      dr.deEncontros ? el('div', { class: 'hunt-encontros' }, el('h4', {}, 'Recompensas dos encontros da fase'), dr.deEncontros.map((e) => tabelaDeDrops(e.drops.map((x) => ({ id: x.item, nome: x.nome, chancePct: x.chancePct, esperado: (x.chancePct / 100) * (e.rolagens ?? 1), valor: null, origem: `${e.tipo} · ${e.probabilidade ?? 100}% de aparecer` })), { titulo: `${e.nome ?? e.id}${e.obrigatorio ? ' (obrigatório)' : ''}`, rotuloDoEsperado: 'Esperado / abertura', vazio: 'Sem drops (só moedas/primeira conclusão).' }))) : null,
      dr.referenciasQuebradas.length ? el('div', { class: 'bib-alerta' }, `Itens que não existem no catálogo: ${dr.referenciasQuebradas.join(', ')}`) : null);
  }

  function painelDaHunt() {
    const p = H.painel;
    if (!p) return el('div', { class: 'bib-painel-vazio' }, H.id ? 'Hunt não encontrada.' : 'Escolha uma hunt à esquerda para ver o mapa, os monstros, a dificuldade e os drops num só lugar.');
    return el('div', { class: 'hunt-painel' },
      el('div', { class: 'hunt-topo' }, retrato(p.monstros.definidosPeloMapa[0]?.desenho ?? p.monstros.doCadastro?.[0]?.desenho ?? null, 64, { categoria: 'monstros', imediato: true }), el('div', {}, el('h2', {}, p.nome), el('div', { class: 'dica' }, `${p.tipo}${p.nivel != null ? ` · level ${p.nivel}` : ''}${p.doCampanha ? ` · Ato ${p.doCampanha.ato}, fase ${p.doCampanha.indice}` : ''} · ${p.id}`), p.descricao ? el('div', { class: 'dica' }, p.descricao) : null),
        p.doCampanha && irPara ? el('button', { type: 'button', onclick: () => irPara('fase', p.id) }, 'Editar fase e encontros') : null),
      sMapa(p), sMonstros(p), sDistribuicao(p), sDificuldade(p), sDrops(p));
  }

  function pintar() {
    raiz().replaceChildren(cabecalho('Hunts', 'Cada hunt num painel só: o mapa, os monstros, a distribuição de raridade, a dificuldade e os drops esperados. Somente leitura — a hunt continua sendo editada no editor de mapas e em Fases e encontros.'), el('div', { class: 'hunts-duas' }, listaLateral(), painelDaHunt()));
  }

  return { desenhar, abrir: (_cat, id) => abrir(id), focarBusca: () => document.querySelector('.hunts-lista input')?.focus() };
}
