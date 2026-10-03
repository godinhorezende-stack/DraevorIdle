// As VISTAS do editor de atos além do fluxo: Validação, Pré-visualização (como o jogador vê), Versões (histórico, comparação,
// restaurar) e Publicação (lista de conferência e estado). Só apresentação: validação, versões e publicação vêm do servidor
// (`admin/atos.mjs`). Cada vista devolve um elemento; quem chama (`editor-atos.mjs`) decide quando pintar.
import { el } from './editor-ui.mjs';

const DIFICULDADES = [['facil', 'Normal'], ['medio', 'Cruel'], ['dificil', 'Merciless']];

/** As fases na ordem em que o jogador as encontra: pelo grafo a partir da inicial (largura), depois as soltas. Pura. */
export function ordemDasFases(ato) {
  const por = new Map(ato.fases.map((f) => [f.id, f]));
  const saidas = new Map(ato.fases.map((f) => [f.id, []]));
  for (const c of ato.conexoes) saidas.get(c.de)?.push(c.para);
  const vistos = new Set();
  const fila = por.has(ato.inicio) ? [ato.inicio] : [];
  const ordem = [];
  while (fila.length) {
    const id = fila.shift();
    if (vistos.has(id)) continue;
    vistos.add(id);
    ordem.push(por.get(id));
    fila.push(...(saidas.get(id) ?? []));
  }
  return [...ordem, ...ato.fases.filter((f) => !vistos.has(f.id))];
}

/** Uma linha de texto com o que a recompensa paga (para o cartão do jogador). Pura. */
export function resumoDeRecompensa(rec) {
  if (!rec) return null;
  const partes = [];
  const drops = rec.drops?.length ?? 0;
  if (drops) partes.push(`${drops} drop(s) × ${rec.rolagens ?? 1} rolagem(ns)`);
  const pc = rec.primeiraConclusao;
  if (pc?.gold) partes.push(`${pc.gold.toLocaleString('pt-BR')} de ouro (1ª vez)`);
  if (pc?.exp) partes.push(`${pc.exp.toLocaleString('pt-BR')} de exp (1ª vez)`);
  if (pc?.itens?.length) partes.push(`${pc.itens.length} item(ns) (1ª vez)`);
  return partes.length ? partes.join(' · ') : null;
}

// ------------------------------------------------------------------ validação

export function vistaValidacao(problemas, { irParaFase }) {
  const erros = problemas.filter((p) => p.nivel === 'erro');
  const avisos = problemas.filter((p) => p.nivel !== 'erro');
  const grupo = (titulo, lista, classe) => lista.length
    ? el('section', { class: 'hunt-sec' }, el('h3', {}, `${titulo} (${lista.length})`), el('ul', { class: 'problemas' }, lista.map((p) => el('li', { class: classe, style: p.onde.startsWith('fase ') ? 'cursor:pointer' : '', onclick: () => p.onde.startsWith('fase ') && irParaFase(p.onde.slice(5)) }, el('b', {}, `[${p.onde}] `), p.mensagem))))
    : null;
  return el('div', { class: 'atos-vista' }, !problemas.length ? el('div', { class: 'selo ok' }, 'Nenhum problema encontrado. O ato passa na validação.') : null, grupo('Erros — bloqueiam beta e publicação', erros, 'erro'), grupo('Avisos — não bloqueiam', avisos, 'aviso'),
    el('div', { class: 'dica' }, 'A validação confere: nome e ID, fases e hunts existentes, boss final, ligações, caminhos alcançáveis, ciclos, condições de desbloqueio, recompensas, itens e a compatibilidade com o jogo (tipos de fase e conclusão que o runtime executa). Clique num erro de fase para abri-la no fluxo.'));
}

// ------------------------------------------------------------------ pré-visualização

export function vistaPrevia(ato, { dif = 'facil', aoMudarDif }) {
  const fases = ordemDasFases(ato);
  const nomeDe = (id) => ato.fases.find((f) => f.id === id)?.nome ?? id;
  const proximas = (id) => ato.conexoes.filter((c) => c.de === id).map((c) => `${nomeDe(c.para)}${c.rotulo ? ` (${c.rotulo})` : ''}${c.requisito?.exige?.length ? ` — exige ${c.requisito.exige.map(nomeDe).join(', ')}` : ''}`);
  const boss = ato.bossFinal;
  return el('div', { class: 'atos-vista' },
    el('div', { class: 'dica' }, 'Como o jogador enxerga este ato na tela de campanha: a ordem das fases, o nível em cada dificuldade, o que é opcional e o portal do boss final. Não executa nada.'),
    el('div', { class: 'hunts-cats' }, DIFICULDADES.map(([id, nome]) => el('button', { type: 'button', class: dif === id ? 'ativa' : '', onclick: () => aoMudarDif(id) }, nome))),
    el('section', { class: 'hunt-sec' }, el('h3', {}, `${ato.nome}${ato.nivelRecomendado ? ` · nível recomendado ${ato.nivelRecomendado}` : ''}`), ato.descricao ? el('div', { class: 'dica' }, ato.descricao) : null,
      ato.anterior ? el('div', { class: 'dica' }, `🔒 Abre depois de vencer o boss de "${ato.anterior}" na mesma dificuldade.`) : el('div', { class: 'dica' }, 'Sem ato anterior exigido.')),
    el('div', { class: 'previa-fases' }, fases.map((f, i) => el('div', { class: `previa-fase${f.obrigatoria ? '' : ' opcional'}${f.id === ato.inicio ? ' inicio' : ''}` },
      el('div', { class: 'previa-topo' }, el('b', {}, `${i + 1}. ${f.nome}`), f.obrigatoria ? null : el('span', { class: 'selo' }, 'opcional'), f.id === ato.inicio ? el('span', { class: 'selo ok' }, 'início') : null),
      el('div', { class: 'dica' }, `${f.huntId ?? 'sem hunt'} · ${f.tipo} · ${f.nivel?.[dif] != null ? `level ~${f.nivel[dif]}` : 'sem nível definido'}`),
      f.descricao ? el('div', { class: 'dica' }, f.descricao) : null,
      f.requisitos?.exige?.length ? el('div', { class: 'dica' }, `Exige: ${f.requisitos.exige.map(nomeDe).join(', ')}`) : null,
      resumoDeRecompensa(f.recompensas) ? el('div', { class: 'previa-premio' }, `🎁 ${resumoDeRecompensa(f.recompensas)}`) : null,
      proximas(f.id).length ? el('div', { class: 'dica' }, `→ ${proximas(f.id).join(' | ')}`) : el('div', { class: 'dica' }, boss?.faseAnterior === f.id ? '→ portal do boss final (ao limpar a hunt)' : '→ fim de caminho')))),
    boss ? el('section', { class: 'hunt-sec previa-boss' }, el('h3', {}, `Boss final: ${boss.bossId ?? 'não escolhido'}`),
      el('div', { class: 'dica' }, `${nomeDe(boss.faseAnterior)} → limpar a hunt NESTA execução → portal aberto → boss. Sem recarga; na Caça Automática o personagem entra sozinho.`),
      resumoDeRecompensa(boss.recompensas) ? el('div', { class: 'previa-premio' }, `🎁 ${resumoDeRecompensa(boss.recompensas)}`) : null) : el('div', { class: 'dica' }, 'Sem boss final.'));
}

// ------------------------------------------------------------------ versões

const quando = (ms) => (ms ? new Date(ms).toLocaleString('pt-BR') : '—');
const lerCampo = (v) => (v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** O diff legível (`comparar` do servidor) como uma lista. */
export function listaDoDiff(d) {
  if (d.iguais) return el('div', { class: 'selo ok' }, d.soPosicao ? `Sem mudança de conteúdo (${d.soPosicao} fase(s) só mudaram de posição no canvas).` : 'Idênticas.');
  const linhas = [];
  const campo = (rot, c) => linhas.push(el('li', {}, el('b', {}, `${rot}: `), el('span', { class: 'diff-antes' }, lerCampo(c.antes)), ' → ', el('span', { class: 'diff-depois' }, lerCampo(c.depois))));
  for (const c of d.ato) campo(`Ato · ${c.campo}`, c);
  for (const id of d.fasesNovas) linhas.push(el('li', { class: 'diff-novo' }, `+ fase ${id}`));
  for (const id of d.fasesRemovidas) linhas.push(el('li', { class: 'diff-removido' }, `− fase ${id}`));
  for (const f of d.fasesAlteradas) for (const c of f.campos) campo(`Fase ${f.id} · ${c.campo}`, c);
  for (const k of d.ligacoesNovas) linhas.push(el('li', { class: 'diff-novo' }, `+ ligação ${k.replace('>', ' → ')}`));
  for (const k of d.ligacoesRemovidas) linhas.push(el('li', { class: 'diff-removido' }, `− ligação ${k.replace('>', ' → ')}`));
  for (const k of d.ligacoesAlteradas) linhas.push(el('li', {}, `~ ligação ${k.replace('>', ' → ')} (requisito/rótulo)`));
  for (const c of d.bossFinal) campo(`Boss final · ${c.campo}`, c);
  return el('ul', { class: 'diff-lista' }, linhas);
}

export async function vistaVersoes({ api, ato, sujo, aoRestaurar }) {
  const { versoes } = await api(`atos-editor/${ato.id}/versoes`);
  const cx = el('div', { class: 'atos-vista' });
  const detalhe = el('div', { class: 'hunt-sec', style: 'display:none' });
  const comparar = async (de, para = null) => {
    const d = await api(`atos-editor/${ato.id}/comparar?${new URLSearchParams({ de, ...(para ? { para } : {}) })}`);
    detalhe.style.display = '';
    detalhe.replaceChildren(el('h3', {}, `Versão ${d.de} → ${d.para === ato.versao && para == null ? `${d.para} (atual)` : d.para}`), d.ok === false ? el('div', { class: 'dica' }, d.erros.join(' ')) : listaDoDiff(d));
  };
  cx.append(
    el('div', { class: 'dica' }, `Cada gravação guarda uma versão (só acréscimo: nada é apagado). Restaurar cria uma versão NOVA com o conteúdo da antiga, sempre como rascunho — nunca publica sozinho.${sujo ? ' Há alterações não salvas: elas não entram nas versões até você salvar.' : ''}`),
    versoes.length ? el('table', {}, el('thead', {}, el('tr', {}, ['Versão', 'Salva em', 'Estado', 'Fases', 'Boss final', ''].map((h) => el('th', {}, h)))),
      el('tbody', {}, versoes.map((v, i) => el('tr', {}, el('td', {}, `${v.versao}${v.versao === ato.versao ? ' (atual)' : ''}`), el('td', {}, quando(v.salvoEm)), el('td', {}, el('span', { class: 'selo' }, v.estado)), el('td', {}, v.fases), el('td', {}, v.bossFinal ?? '—'),
        el('td', { class: 'linha' }, el('button', { type: 'button', onclick: () => comparar(v.versao) }, 'Comparar com a atual'), versoes[i + 1] ? el('button', { type: 'button', onclick: () => comparar(versoes[i + 1].versao, v.versao) }, 'O que mudou') : null, v.versao === ato.versao ? null : el('button', { type: 'button', class: 'perigo', onclick: () => aoRestaurar(v.versao) }, 'Restaurar')))))) : el('div', { class: 'dica' }, 'Ainda sem versões: salve o ato para criar a primeira.'),
    detalhe);
  return cx;
}

// ------------------------------------------------------------------ publicação

export async function vistaPublicacao({ api, ato, sujo, aoMudarEstado }) {
  const c = await api(`atos-editor/${ato.id}/publicacao`);
  if (c?.ok === false) return el('div', { class: 'atos-vista' }, el('div', { class: 'dica' }, (c.erros ?? ['Ato não encontrado.']).join(' ')));
  const botao = (rot, estado, classe = '') => el('button', { type: 'button', class: classe, disabled: sujo || (['beta', 'publicado'].includes(estado) && !c.itens.filter((i) => /Validação|Ordem/.test(i.texto)).every((i) => i.ok)), onclick: () => aoMudarEstado(estado) }, rot);
  return el('div', { class: 'atos-vista' },
    sujo ? el('div', { class: 'bib-alerta' }, 'Há alterações não salvas: salve o rascunho antes de publicar (a publicação grava o estado do ato como está salvo).') : null,
    el('section', { class: 'hunt-sec' }, el('h3', {}, `Lista de conferência — estado atual: ${c.estado}, versão ${c.versao}`),
      el('ul', { class: 'problemas' }, c.itens.map((i) => el('li', { class: i.ok ? 'ok' : i.aviso ? 'aviso' : 'erro' }, `${i.ok ? '✔' : i.aviso ? '⚠' : '✖'} ${i.texto}`))),
      el('div', { class: c.noJogoAgora ? 'selo ok' : 'selo' }, c.noJogoAgora ? 'Este servidor já está executando este ato.' : 'Este servidor ainda NÃO executa este ato (o jogo só lê os atos no boot).')),
    el('section', { class: 'hunt-sec' }, el('h3', {}, 'Mudar o estado'),
      el('div', { class: 'linha' }, botao('Salvar como rascunho', 'rascunho'), botao('Testar em Beta', 'beta'), botao('Publicar', 'publicado', 'primario'), botao('Desativar', 'desativado', 'perigo')),
      el('div', { class: 'dica' }, c.comoPublicar),
      el('div', { class: 'dica' }, 'Beta vale só com o modo beta do servidor ligado (testar com contas de teste); Publicado vale para todos. Desativado/Rascunho: o jogo ignora o ato.')));
}
