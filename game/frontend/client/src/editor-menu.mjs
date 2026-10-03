// O MENU LATERAL da Engine: grupos que recolhem e expandem, o menu inteiro recolhido num trilho de ícones (com dicas), o estado guardado no navegador,
// a gaveta em telas pequenas e as marcas discretas de "consulta"/"parcial". Só apresentação: quais itens existem e para onde levam é decidido por
// quem chama (`editor-conteudo.mjs`) — aqui NÃO se inventa item nem rota. A lógica de estado é pura (testada); o DOM mora em `desenharMenu`.
import { el, icone } from './editor-ui.mjs';

export const CHAVE_DO_MENU = 'engine.menu.v1';
/** O que cada marca diz ao dono sobre a ferramenta (nada para as de edição completa: o padrão não precisa de selo). */
export const MARCAS = {
  consulta: { texto: 'consulta', dica: 'Somente consulta: mostra o cadastro, não edita.' },
  parcial: { texto: 'parcial', dica: 'Edição parcial: só parte dos dados se edita aqui.' },
  emdev: { texto: 'em desenv.', dica: 'Em desenvolvimento.' },
};

/** O estado inicial: menu aberto, nenhum grupo fechado. */
export const estadoPadrao = () => ({ recolhido: false, gruposFechados: [] });

/** Lê o estado guardado (qualquer falha — sem storage, JSON ruim, tipo errado — devolve o padrão; nunca quebra a tela). */
export function lerEstado(storage) {
  try {
    const bruto = JSON.parse(storage?.getItem(CHAVE_DO_MENU) ?? 'null');
    if (!bruto || typeof bruto !== 'object') return estadoPadrao();
    return { recolhido: bruto.recolhido === true, gruposFechados: Array.isArray(bruto.gruposFechados) ? bruto.gruposFechados.filter((g) => typeof g === 'string') : [] };
  } catch {
    return estadoPadrao();
  }
}
export function gravarEstado(storage, estado) {
  try {
    storage?.setItem(CHAVE_DO_MENU, JSON.stringify(estado));
    return true;
  } catch {
    return false; // modo privado / cota: o menu funciona igual, só não lembra
  }
}

/** Abre/fecha um grupo; devolve o estado novo (não muda o antigo). */
export const alternarGrupo = (estado, id) => ({ ...estado, gruposFechados: estado.gruposFechados.includes(id) ? estado.gruposFechados.filter((g) => g !== id) : [...estado.gruposFechados, id] });
/** Garante o grupo da página ativa aberto (navegar até um item num grupo fechado o abre). */
export const abrirGrupoDe = (estado, grupos, ativa) => {
  const g = grupos.find((x) => x.itens.some((i) => i.id === ativa));
  return g && estado.gruposFechados.includes(g.id) ? { ...estado, gruposFechados: estado.gruposFechados.filter((x) => x !== g.id) } : estado;
};
/** Os grupos que têm item (grupo vazio nunca aparece: nada de "em breve" sem tela). */
export const gruposVisiveis = (grupos) => grupos.filter((g) => g.itens.length);

/**
 * Desenha o menu em `alvo`. `grupos`: `[{ id, titulo, itens: [{ id, nome, icone, modo?, href?, dica? }] }]`; `ativa`: id da página; `irPara(id)`;
 * `estado` + `aoMudar(estado)`: o estado do menu (recolhido, grupos fechados); `fecharGaveta()`: chamado ao navegar (telas pequenas).
 */
export function desenharMenu({ alvo, grupos, ativa, irPara, estado, aoMudar, fecharGaveta = () => {} }) {
  const visiveis = gruposVisiveis(grupos);
  const marca = (i) => (i.modo && MARCAS[i.modo] ? el('span', { class: `eng-nav-marca ${i.modo}`, title: MARCAS[i.modo].dica }, MARCAS[i.modo].texto) : null);
  const itemDe = (i) => {
    const rotulo = i.dica ? `${i.nome} — ${i.dica}` : i.nome;
    const base = { 'data-tip': i.nome, 'aria-label': rotulo, title: rotulo };
    if (i.href) return el('a', { class: 'eng-nav-item', href: i.href, ...base }, icone(i.icone), el('span', { class: 'eng-nav-nome' }, i.nome), el('span', { class: 'eng-nav-extra' }, icone('externo')));
    return el('button', { type: 'button', class: `eng-nav-item${i.id === ativa ? ' ativa' : ''}`, 'aria-current': i.id === ativa ? 'page' : false, ...base, onclick: () => { fecharGaveta(); irPara(i.id); } }, icone(i.icone), el('span', { class: 'eng-nav-nome' }, i.nome), marca(i));
  };
  const topo = el('button', { type: 'button', class: 'eng-nav-recolher', 'aria-pressed': String(!!estado.recolhido), 'data-tip': estado.recolhido ? 'Expandir menu' : 'Recolher menu', title: estado.recolhido ? 'Expandir o menu' : 'Recolher o menu', onclick: () => aoMudar({ ...estado, recolhido: !estado.recolhido }) }, icone(estado.recolhido ? 'expandir' : 'recolher'), el('span', { class: 'eng-nav-nome' }, 'Recolher menu'));
  const blocos = visiveis.map((g) => {
    const aberto = !estado.gruposFechados.includes(g.id);
    const ativoDentro = g.itens.some((i) => i.id === ativa);
    return el('section', { class: `eng-nav-sec${aberto ? '' : ' fechado'}`, 'data-grupo': g.id },
      el('button', { type: 'button', class: `eng-nav-grupo${ativoDentro ? ' tem-ativa' : ''}`, 'aria-expanded': String(aberto), 'aria-controls': `eng-grupo-${g.id}`, onclick: () => aoMudar(alternarGrupo(estado, g.id)) }, icone('chevron'), el('span', { class: 'eng-nav-nome' }, g.titulo)),
      el('div', { class: 'eng-nav-itens', id: `eng-grupo-${g.id}`, hidden: !aberto && !estado.recolhido }, g.itens.map(itemDe)));
  });
  alvo.classList.toggle('recolhido', !!estado.recolhido);
  // A largura do menu mora numa variável do <body> (a grade, a marca e o conteúdo a usam).
  if (typeof document !== 'undefined') document.body.classList.toggle('eng-menu-recolhido', !!estado.recolhido);
  alvo.replaceChildren(topo, ...blocos);
}
