// A aba ÁRVORE × POEDB da engine (dono, 09/10: "crie uma aba de tudo que está funcionando e está pendente e se existe ou não, tendo como
// referência a árvore do poedb; verifique se tem implementado aqui todas as abas de Ascendancy_class e de Bloodline_Ascendancy_class"):
// a árvore principal, as 21 ascendências de classe, as alternativas e as 13 Linhagens — cada grupo com quantos nós o poedb tem, quantos o
// jogo tem e o estado (funciona, parcial, pendente, não existe); a lista dos nós, com cada linha; e as abas das duas páginas, item a item.
import { el, cabecalho } from './editor-ui.mjs';

const BASE = '/api/mapas/_engine/itens-poe/';
const api = async (rota) => (await fetch(BASE + rota)).json();
const ESTADOS = {
  funciona: { nome: 'Funciona', simbolo: '✓', dica: 'todas as linhas do nó têm efeito no jogo' },
  parcial: { nome: 'Parcial', simbolo: '◐', dica: 'parte das linhas tem efeito, parte ainda não' },
  pendente: { nome: 'Pendente', simbolo: '○', dica: 'ainda sem efeito no jogo' },
  inexiste: { nome: 'Não existe no jogo', simbolo: '–', dica: 'mecânica do PoE que o jogo não tem (o porquê ao passar o mouse)' },
  lembrete: { nome: 'Lembrete', simbolo: '·', dica: 'só texto de lembrete (entre parênteses)' },
};
const TIPO_DO_GRUPO = { principal: 'Árvore principal', classe: 'Ascendências de classe', alternativa: 'Ascendências alternativas', linhagem: 'Linhagens (Bloodline)', antiga: 'Outras', fora: 'Fora da árvore' };
const TIPO_DO_NO = { pequeno: 'pequeno', notavel: 'notável', keystone: 'keystone', maestria: 'maestria', joia: 'encaixe de joia', inicio: 'início', inicioAscendencia: 'início', notavelAscendencia: 'notável', pequenoAscendencia: 'pequeno', linhagem: 'linhagem' };

function barra(r) {
  const total = Object.values(r ?? {}).reduce((a, b) => a + b, 0) || 1;
  const ordem = ['funciona', 'parcial', 'pendente', 'inexiste', 'lembrete'].filter((k) => r?.[k]);
  return el('div', { class: 'poe-cobertura arv-barra', title: ordem.map((k) => `${ESTADOS[k].nome}: ${r[k]}`).join(' · ') }, ordem.map((k) => el('span', { class: `pend-barra ${k}`, style: `flex-basis:${(r[k] / total) * 100}%` })));
}

export function criarTelaDaArvorePoedb({ raiz }) {
  const T = { dados: null, grupo: 'principal', estado: 'todos', busca: '', limite: 300 };

  async function desenhar() {
    const e = await api('estado');
    if (!e.ligado) {
      raiz().replaceChildren(cabecalho('Árvore × PoEDB', 'Este servidor está no Draevor clássico (DRAEVOR_CLASSICO=1): suba sem essa variável.'));
      return;
    }
    T.dados = await api('arvore-poedb');
    if (T.dados.ok === false) {
      raiz().replaceChildren(cabecalho('Árvore × PoEDB', T.dados.erros?.join(' ') ?? 'Sem o manifesto.'));
      return;
    }
    pintar();
  }

  /** Um cartão de grupo (a árvore principal, uma ascendência, uma Linhagem). */
  const cartao = (g) => el('button', { type: 'button', class: `arv-grupo${T.grupo === g.id ? ' ativo' : ''}${g.noJogo ? '' : ' fora-do-jogo'}`, onclick: () => { T.grupo = g.id; T.limite = 300; pintar(); } },
    el('span', { class: 'arv-grupo-nome' }, g.nome, g.classe ? el('em', {}, ` ${g.classe}`) : null),
    el('span', { class: 'arv-grupo-num' }, g.noJogo === g.nos ? `${g.nos} nós · no jogo` : g.noJogo ? `${g.noJogo} de ${g.nos} nós no jogo` : `${g.nos} nós · não está no jogo`),
    barra(g.porEstado));

  function pintar() {
    const d = T.dados;
    const porTipo = {};
    for (const g of d.grupos) (porTipo[g.tipo] ??= []).push(g);
    for (const l of Object.values(porTipo)) l.sort((a, b) => a.nome.localeCompare(b.nome));
    const busca = T.busca.trim().toLowerCase();
    const nos = d.nos.filter((n) => (T.grupo === 'todos' || n.grupo === T.grupo) && (T.estado === 'todos' || n.estado === T.estado)
      && (!busca || n.nome.toLowerCase().includes(busca) || n.linhas.some((l) => l.texto.toLowerCase().includes(busca))));
    const ordem = { pendente: 0, parcial: 1, inexiste: 2, funciona: 3, lembrete: 4 };
    nos.sort((a, b) => ordem[a.estado] - ordem[b.estado] || a.nome.localeCompare(b.nome));
    const g = d.grupos.find((x) => x.id === T.grupo);
    const selEstado = el('select', { onchange: (e) => { T.estado = e.target.value; T.limite = 300; pintar(); } }, [['todos', 'Todos os estados'], ...Object.entries(ESTADOS).map(([k, v]) => [k, v.nome])].map(([v, n]) => el('option', { value: v, selected: v === T.estado }, n)));
    const campo = el('input', { type: 'search', id: 'arv-busca', placeholder: 'Buscar nó ou texto…', value: T.busca, oninput: (e) => { T.busca = e.target.value; T.limite = 300; pintar(); setTimeout(() => document.querySelector('#arv-busca')?.focus(), 0); } });
    const linhaDoNo = (n) => el('tr', {},
      el('td', {}, el('em', { class: `pend-marca ${n.estado}`, title: ESTADOS[n.estado]?.dica }, ESTADOS[n.estado]?.simbolo ?? '?')),
      el('td', {}, el('b', {}, n.nome), el('div', { class: 'dica' }, `${TIPO_DO_NO[n.tipo] ?? n.tipo} · id ${n.id}${n.noJogo ? '' : ' · não está no jogo'}`)),
      el('td', {}, el('div', { class: 'pend-partes' }, n.linhas.map((l) => el('span', { class: `arv-linha ${l.estado}`, title: l.nota ?? (l.tema ? `${ESTADOS[l.estado]?.nome} — falta: ${l.tema}` : ESTADOS[l.estado]?.nome) }, `${ESTADOS[l.estado]?.simbolo ?? '?'} ${l.texto}`)))));
    const item = (it) => el('span', { class: `arv-item ${it.noJogo ? 'sim' : 'nao'}`, title: [it.ascendencia, it.classe, it.estado ? ESTADOS[it.estado]?.nome : null].filter(Boolean).join(' · ') }, it.nome);
    const aba = (a) => el('div', { class: 'arv-aba' },
      el('div', {}, el('b', {}, a.titulo.replace(/\s*\/\s*\d+$/, '')), el('span', { class: a.noJogo === a.itens.length ? 'arv-ok' : 'arv-falta' }, ` ${a.noJogo} de ${a.itens.length} no jogo`)),
      el('div', { class: 'arv-itens' }, a.itens.map(item)));
    const paginas = Object.entries(d.paginas ?? {}).map(([pag, p]) => el('div', { class: 'eng-painel arv-pagina' },
      el('div', { class: 'eng-painel-corpo' },
        el('b', {}, pag.replace(/_/g, ' ')),
        el('a', { href: p.fonte, target: '_blank', rel: 'noopener', class: 'arv-link' }, ' abrir no poedb'),
        el('div', { class: 'arv-abas' }, p.abas.filter((a) => a.itens.length).map(aba)))));
    // (09/10) O QUE FALTA na árvore principal: as linhas sem efeito por grupo — o que depende de GEMAS, de ITENS e das MECÂNICAS — com o que
    // o motor precisa ter para implementar direito.
    const GRUPO_DO_QUE_FALTA = { gema: 'Depende de gemas', item: 'Depende de itens', mecanica: 'Mecânicas do combate' };
    const quadroDoQueFalta = (d.precisa ?? []).length ? el('div', { class: 'arv-falta-grade' }, Object.entries(GRUPO_DO_QUE_FALTA).map(([g, titulo]) => {
      const temas = d.precisa.filter((x) => x.grupo === g);
      return el('div', { class: 'eng-painel arv-falta' }, el('div', { class: 'eng-painel-corpo' },
        el('b', {}, titulo), el('span', { class: 'dica' }, ` · ${temas.reduce((n, x) => n + x.linhas, 0)} linhas`),
        temas.map((x) => el('details', { class: 'arv-tema' },
          el('summary', {}, el('span', {}, x.tema), el('span', { class: 'dica' }, ` ${x.linhas} linhas · ${x.nos} nós`)),
          el('div', { class: 'arv-precisa' }, `Precisa: ${x.precisa}`),
          el('div', { class: 'arv-exemplos' }, x.exemplos.map((e) => el('div', {}, `· ${e}`)))))));
    })) : null;
    const principal = d.grupos.find((x) => x.id === 'principal');
    raiz().replaceChildren(
      cabecalho('Árvore × PoEDB', `A árvore do poedb (PoE 1 ${d.versao}) comparada com a do jogo, nó a nó pelo id do PoE. Árvore principal: ${principal?.noJogo ?? 0} de ${principal?.nos ?? 0} nós no jogo; ${principal?.porEstado.funciona ?? 0} funcionam inteiros.`,
        el('button', { type: 'button', onclick: async () => { T.dados = await api('arvore-poedb?recalcular=1'); pintar(); } }, 'Recalcular')),
      el('div', { class: 'arv-tipos' }, ['principal', 'classe', 'alternativa', 'linhagem', 'antiga', 'fora'].filter((t) => porTipo[t]).map((t) => el('section', { class: 'arv-tipo' },
        el('h3', {}, TIPO_DO_GRUPO[t], el('span', { class: 'dica' }, ` ${porTipo[t].length > 1 ? `${porTipo[t].length} · ` : ''}${porTipo[t].reduce((n, x) => n + x.noJogo, 0)} de ${porTipo[t].reduce((n, x) => n + x.nos, 0)} nós no jogo`)),
        el('div', { class: 'arv-grupos' }, porTipo[t].map(cartao))))),
      quadroDoQueFalta ? el('h3', { class: 'arv-subtitulo' }, 'O que falta implementar na árvore principal (as linhas em vermelho)') : null,
      quadroDoQueFalta,
      el('h3', { class: 'arv-subtitulo' }, 'As abas das páginas de Ascendência e de Linhagem'),
      el('div', { class: 'arv-paginas' }, paginas),
      el('h3', { class: 'arv-subtitulo' }, g ? `Nós: ${g.nome}` : 'Nós'),
      el('div', { class: 'eng-tooltip-barra' }, selEstado, campo, el('button', { type: 'button', onclick: () => { T.grupo = 'todos'; pintar(); } }, 'Todos os grupos'), el('span', { class: 'dica' }, `${nos.length} nós`), g ? el('span', {}, barra(g.linhas), el('span', { class: 'dica' }, ' linhas')) : null),
      el('div', { class: 'bib-tabela arv-tabela' }, el('table', {},
        el('thead', {}, el('tr', {}, ['', 'Nó', 'Linhas (o estado de cada uma no jogo)'].map((h) => el('th', {}, h)))),
        el('tbody', {}, nos.slice(0, T.limite).map(linhaDoNo)))),
      nos.length > T.limite ? el('button', { type: 'button', onclick: () => { T.limite += 300; pintar(); } }, `Mostrar mais (${nos.length - T.limite})`) : null,
    );
  }

  return { desenhar };
}
