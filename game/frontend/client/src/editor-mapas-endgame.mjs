// A aba MAPAS DO ENDGAME da engine (dono, 10/10: "verifique se todos os modificadores estão funcionando e coloque uma aba na engine dos
// mapas, modificadores comum, mágico, raro, único, fazendo a validação"): o que cada raridade de mapa tem e o estado de cada modificador no
// jogo, validado no MESMO caminho do jogo (`systems/itens-poe/mapas-validacao.mjs`): funciona, parcial, não existe no jogo (com o porquê) ou
// erro (defeito: um efeito que não muda nada, ou o número ligado ao atributo errado). O balão do mapa mostra o mesmo estado em cada linha.
import { el, cabecalho } from './editor-ui.mjs';

const BASE = '/api/mapas/_engine/itens-poe/';
const api = async (rota) => (await fetch(BASE + rota)).json();
const ESTADOS = {
  funciona: { nome: 'Funciona', simbolo: '✓', dica: 'todos os efeitos da linha agem no jogo' },
  parcial: { nome: 'Parcial', simbolo: '◐', dica: 'age, mas parte da linha o jogo ainda não tem (o porquê na linha)' },
  inexiste: { nome: 'Não existe no jogo', simbolo: '–', dica: 'mecânica do PoE que o jogo não tem (o porquê na linha)' },
  erro: { nome: 'Erro', simbolo: '✗', dica: 'um efeito que não muda nada, ou o número ligado ao atributo errado: é defeito' },
};
const ABAS = [['normal', 'Normal'], ['magico', 'Mágico'], ['raro', 'Raro'], ['unico', 'Único']];
const FAIXAS = { baixo: 'T1–T5', medio: 'T6–T10', alto: 'T11–T16' };
const ALVO = { monstros: 'monstros', chefe: 'chefe', instancia: 'área', jogador: 'você', mapa: 'drop' };
const icone = (p) => (p ? `/api/jogo/poe/icone/item/${p.split('/').map(encodeURIComponent).join('/')}` : '');
const pct = (v) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}%`;
const marca = (estado) => el('em', { class: `pend-marca ${estado}`, title: ESTADOS[estado]?.dica }, ESTADOS[estado]?.simbolo ?? '?');

export function criarTelaDosMapasDoEndgame({ raiz }) {
  const T = { dados: null, aba: 'magico', faixa: 'todas', estado: 'todos', busca: '' };

  async function desenhar() {
    const e = await api('estado');
    if (!e.ligado) {
      raiz().replaceChildren(cabecalho('Mapas do endgame', 'Este servidor está no Draevor clássico (DRAEVOR_CLASSICO=1): suba sem essa variável.'));
      return;
    }
    T.dados = await api('mapas-endgame');
    pintar();
  }

  /** O cartão das contas (a barra e os números, que filtram ao clicar). */
  function cartao(titulo, contas) {
    const total = Object.values(contas).reduce((a, b) => a + b, 0) || 1;
    return el('div', { class: 'eng-painel pend-cartao' }, el('div', { class: 'eng-painel-corpo' },
      el('b', {}, titulo),
      el('div', { class: 'poe-cobertura' }, Object.keys(ESTADOS).filter((k) => contas[k]).map((k) => el('span', { class: `pend-barra ${k}`, style: `flex-basis:${(contas[k] / total) * 100}%`, title: `${ESTADOS[k].nome}: ${contas[k]}` }))),
      el('div', { class: 'pend-numeros' }, Object.keys(ESTADOS).filter((k) => contas[k]).map((k) => el('button', { type: 'button', class: `pend-num ${k}`, title: ESTADOS[k].dica, onclick: () => { T.estado = k; pintar(); } }, `${ESTADOS[k].simbolo} ${ESTADOS[k].nome}: ${contas[k]}`)))));
  }
  const contar = (linhas) => Object.fromEntries(Object.keys(ESTADOS).map((k) => [k, linhas.filter((l) => l.estado === k).length]));
  /** Os efeitos da linha: onde cada um age (ou por que não). */
  const efeitos = (l) => el('div', { class: 'mapas-efeitos' }, l.efeitos.map((e) => el('span', { class: `poe-tr ${e.ok ? 'equivalente' : 'inerte'}`, title: e.ok ? `age em: ${e.onde}` : e.motivo }, `${e.ok ? '✓' : '✗'} ${ALVO[e.alvo] ?? e.alvo}.${e.stat}`)));
  const nota = (l) => (l.nota ? el('div', { class: 'dica' }, l.nota) : null);
  const passa = (l, textos) => (T.estado === 'todos' || l.estado === T.estado) && (!T.busca.trim() || textos.some((t) => String(t ?? '').toLowerCase().includes(T.busca.trim().toLowerCase())));

  function barra(extra = []) {
    const selEstado = el('select', { onchange: (e) => { T.estado = e.target.value; pintar(); } }, [['todos', 'Todos os estados'], ...Object.entries(ESTADOS).map(([k, v]) => [k, v.nome])].map(([v, n]) => el('option', { value: v, selected: v === T.estado }, n)));
    const campo = el('input', { type: 'search', id: 'mapas-busca', placeholder: 'Buscar texto do modificador ou nome do mapa…', value: T.busca, oninput: (e) => { T.busca = e.target.value; pintar(); setTimeout(() => document.querySelector('#mapas-busca')?.focus(), 0); } });
    return el('div', { class: 'eng-tooltip-barra' }, ...extra, selEstado, campo, el('button', { type: 'button', onclick: async () => { T.dados = await api('mapas-endgame'); pintar(); } }, 'Validar de novo'));
  }

  function telaNormal(d) {
    return [
      el('p', { class: 'dica' }, `Mapa Normal: nenhum modificador — a área do tier como ela é (a qualidade, quando tem, soma Quantidade de Itens). Cai em ${pct(parte(d, 'normal'))} dos mapas.`),
      el('div', { class: 'bib-tabela' }, el('table', {},
        el('thead', {}, el('tr', {}, ['', 'Tier', 'Nível da área', 'Sorteio dos mods (Mágico/Raro)'].map((h) => el('th', {}, h)))),
        el('tbody', {}, d.tiers.map((t) => el('tr', {},
          el('td', {}, el('img', { src: icone(t.icone), width: 40, height: 40, alt: '', loading: 'lazy' })),
          el('td', {}, `T${t.tier}`), el('td', {}, String(t.nivel)), el('td', { class: 'dica' }, `${FAIXAS[t.faixa] ?? t.faixa} (${t.faixa})`)))))),
    ];
  }

  function telaDoSorteio(d, r) {
    const regra = r.id === 'magico' ? 'até 1 prefixo e 1 sufixo (1 mod: 50%; 2 mods: 50%)' : `até ${r.prefixos} prefixos e ${r.sufixos} sufixos (4 mods ~80%, 5 ~15%, 6 ~5%)`;
    const linhas = d.pool.filter((l) => (T.faixa === 'todas' || l.faixa === T.faixa) && passa(l, [l.texto, l.nome, l.familia]));
    const selFaixa = el('select', { onchange: (e) => { T.faixa = e.target.value; pintar(); } }, [['todas', 'Todos os tiers'], ...Object.entries(FAIXAS).map(([k, v]) => [k, v])].map(([v, n]) => el('option', { value: v, selected: v === T.faixa }, n)));
    const recompensa = (x) => [x.quantidade ? `Quantidade +${x.quantidade}%` : null, x.raridade ? `Raridade +${x.raridade}%` : null, x.grupo ? `Grupo +${x.grupo}%` : null].filter(Boolean).join(' · ');
    return [
      el('p', { class: 'dica' }, `Mapa ${r.nome}: ${regra}, sorteados do pool da faixa do tier. Cai em ${pct(parte(d, r.id))} dos mapas (sem Raridade de Itens). O Mágico e o Raro usam o mesmo pool.`),
      el('div', { class: 'pend-cartoes' }, Object.entries(FAIXAS).map(([k, v]) => cartao(`${v} — ${d.pool.filter((l) => l.faixa === k).length} mods`, contar(d.pool.filter((l) => l.faixa === k))))),
      barra([selFaixa]),
      el('div', { class: 'bib-tabela' }, el('table', {},
        el('thead', {}, el('tr', {}, ['', 'Modificador', 'Lado', 'Tiers', 'Soma no mapa', 'Efeitos no jogo'].map((h) => el('th', {}, h)))),
        el('tbody', {}, linhas.map((l) => el('tr', {},
          el('td', {}, marca(l.estado)),
          el('td', {}, el('div', {}, l.texto), el('div', { class: 'dica' }, `${l.nome ?? ''} · ${l.familia}`), nota(l)),
          el('td', { class: 'dica' }, l.lado === 'prefixo' ? 'Prefixo' : 'Sufixo'),
          el('td', { class: 'dica' }, FAIXAS[l.faixa] ?? l.faixa),
          el('td', { class: 'dica' }, recompensa(l.recompensa)),
          el('td', {}, efeitos(l))))))),
      el('h3', { class: 'pend-ref-titulo' }, `Fora do sorteio — modificadores do PoE sem mecânica no jogo (${d.naoImplementados.length})`),
      el('div', { class: 'bib-tabela' }, el('table', {},
        el('thead', {}, el('tr', {}, ['', 'Modificador do PoE', 'Por que não entra'].map((h) => el('th', {}, h)))),
        el('tbody', {}, d.naoImplementados.filter((n) => !T.busca.trim() || `${n.texto} ${n.familia}`.toLowerCase().includes(T.busca.trim().toLowerCase())).map((n) => el('tr', {},
          el('td', {}, marca('inexiste')), el('td', {}, el('div', {}, n.texto), el('div', { class: 'dica' }, n.familia)), el('td', { class: 'dica' }, n.motivo)))))),
    ];
  }

  function telaUnica(d) {
    const unicos = d.unicos.map((u) => ({ ...u, vistas: u.linhas.filter((l) => passa(l, [l.texto, u.nome])) })).filter((u) => u.vistas.length);
    return [
      el('p', { class: 'dica' }, `Mapa Único: as linhas fixas do único (os valores sorteados na faixa do poedb), em qualquer tier — a área e os monstros são os do tier em que caiu. ${pct(d.drop.chanceDoUnico)} dos mapas que caem são únicos (× a Raridade de Itens do mapa). Sem nenhuma linha com efeito: ${d.resumo.unicosSemEfeito.join(', ') || 'nenhum'}.`),
      el('div', { class: 'pend-cartoes' }, cartao(`${d.unicos.length} mapas únicos — ${d.unicos.reduce((n, u) => n + u.linhas.length, 0)} linhas`, d.resumo.unicos)),
      barra(),
      el('div', { class: 'mapas-unicos' }, unicos.map((u) => el('div', { class: 'eng-painel mapas-unico' }, el('div', { class: 'eng-painel-corpo' },
        el('div', { class: 'mapas-unico-topo' },
          el('img', { src: icone(u.icone), width: 48, height: 48, alt: '', loading: 'lazy' }),
          el('div', {}, el('b', { class: 'mapas-unico-nome' }, u.nome), el('div', { class: 'dica' }, `${u.slug} · ids ${u.idBase + 1}–${u.idBase + 16}`),
            el('div', { class: 'pend-numeros' }, Object.keys(ESTADOS).filter((k) => u.resumo[k]).map((k) => el('span', { class: `pend-num ${k}` }, `${ESTADOS[k].simbolo} ${u.resumo[k]}`))))),
        u.vistas.map((l) => el('div', { class: 'mapas-unico-linha' }, marca(l.estado), el('div', {}, el('div', {}, l.texto), nota(l), l.efeitos.length ? efeitos(l) : null))))))),
    ];
  }

  // A parte dos mapas que cai em cada raridade: Normal/Mágico/Raro pelos pesos do loot (o Único do loot fica de fora: o do mapa tem a chance
  // própria, sorteada por cima — `jogo.pecaSorteada`).
  const somaDosPesos = (d) => Object.entries(d.drop.pesos).filter(([k, v]) => k !== 'unico' && Number(v) > 0).reduce((n, [, v]) => n + Number(v), 0) || 1;
  const parte = (d, id) => ((Number(d.drop.pesos[id]) || 0) / somaDosPesos(d)) * (1 - (Number(d.drop.chanceDoUnico) || 0));

  function pintar() {
    const d = T.dados;
    const r = d.raridades.find((x) => x.id === T.aba);
    const todas = [...d.pool, ...d.unicos.flatMap((u) => u.linhas)];
    const erros = todas.filter((l) => l.estado === 'erro').length;
    const corpo = T.aba === 'normal' ? telaNormal(d) : T.aba === 'unico' ? telaUnica(d) : telaDoSorteio(d, r);
    raiz().replaceChildren(
      cabecalho('Mapas do endgame', `Os modificadores dos mapas T1–T16 por raridade, com a validação: cada efeito passa pelo mesmo caminho do jogo e tem de mudar alguma coisa (o monstro, o chefe, a área, você ou o drop). ${todas.length} linhas — ${erros ? `${erros} com ERRO` : 'nenhum erro'}.`),
      el('div', { class: 'eng-abas' }, ABAS.map(([id, nome]) => el('button', { type: 'button', class: id === T.aba ? 'ativa' : '', style: `color:${d.raridades.find((x) => x.id === id)?.cor ?? 'inherit'}`, onclick: () => { T.aba = id; T.estado = 'todos'; pintar(); } }, nome))),
      ...corpo,
    );
  }

  return { desenhar };
}
