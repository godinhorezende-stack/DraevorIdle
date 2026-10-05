// O BALÃO da peça do sistema de itens do PoE (Fase 1, só com ITENS_POE=1) — o MESMO desenho no balão do jogo (`tooltip.mjs`) e na engine
// (`editor-itens-poe.mjs`): nome na cor da raridade, a base, as propriedades, o implícito, os PREFIXOS e os SUFIXOS separados (decisão do
// dono) com o tier, e o que a peça soma no Draevor. Só desenho: textos e números vêm da peça. Sem dependência de outra tela.

const ROTULO = {
  armadura: 'Armadura', evasao: 'Evasão', escudo_energia: 'Escudo de Energia', velocidade_movimento_pct: 'Velocidade de Movimento',
  chance_bloqueio_pct: 'Chance de Bloqueio', dano_fisico: 'Dano Físico', chance_critico_pct: 'Chance de Crítico', ataques_por_segundo: 'Ataques por Segundo',
  alcance_metros: 'Alcance', protecao: 'Proteção', recupera: 'Recupera', cargas_por_uso: 'Cargas por uso', cargas_maximas: 'Cargas máximas', duracao_segundos: 'Duração',
};
const SUFIXO = { velocidade_movimento_pct: '%', chance_bloqueio_pct: '%', chance_critico_pct: '%', alcance_metros: ' m', duracao_segundos: ' s' };
const SIMBOLO = { equivalente: '✓', aproximado: '≈', novo: '◆', registrado: '○' };
const ESTADO = { equivalente: 'tem efeito no Draevor (mesma conta)', aproximado: 'tem efeito no Draevor (com diferença)', novo: 'atributo novo do PoE, com efeito', registrado: 'registrado, ainda sem efeito no combate' };
export const valorDoAtributo = (k, v) => (v && typeof v === 'object' ? `${v.min}–${v.max}` : `${v}${SUFIXO[k] ?? ''}`);

function no(tag, classe, ...filhos) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  for (const f of filhos.flat(Infinity)) if (f != null && f !== false) e.append(f.nodeType ? f : document.createTextNode(String(f)));
  return e;
}

/**
 * O balão. `p`: a peça gerada OU o `peca.poe` do jogo (os mesmos campos: nome, raridade, ilvl, atributos, implicitos, prefixos, sufixos,
 * modificadores, e — no jogo — `estados` e `af`); `opcoes`: `{ cor, raridadeNome, nomeDaBase, estados, af, requisitos }` —
 * `requisitos`: `{ nivel, str, dex, int }` (o que a base pede; no jogo, do catálogo), mostrado como no PoE ("Requer Nível 68, 191 For");
 * `tem`: `{ nivel, str, dex, int }` do personagem — o requisito que ele não cumpre fica em vermelho.
 */
const NOME_DO_REQUISITO = { str: 'For', dex: 'Des', int: 'Int' };
export function balaoPoe(p, { cor = p.cor ?? '#ddd', raridadeNome = p.raridadeNome ?? p.raridade, nomeDaBase = null, estados = p.estados ?? null, af = p.af ?? null, requisitos = null, tem = null } = {}) {
  const fila = [...(estados ?? [])];
  const marca = () => {
    const e = fila.shift();
    return e ? Object.assign(no('em', `poe-tr ${e}`, SIMBOLO[e] ?? ''), { title: ESTADO[e] ?? e }) : null;
  };
  const linhas = (lista, classe, sigla) => (lista ?? []).map((m) => no('div', `poe-mod ${classe}`, estados ? marca() : null, no('span', null, m.texto), m.tier != null ? Object.assign(no('i', null, `${sigla} T${m.tier}`), { title: `${m.familia ?? ''} · iLvl ${m.ilvl ?? '?'}` }) : null));
  const sep = () => no('div', 'poe-sep');
  const titulo = (texto) => no('div', 'poe-secao', texto);
  const props = Object.entries(p.atributos ?? {}).filter(([k]) => ROTULO[k]).map(([k, v]) => no('div', null, `${ROTULO[k]}: `, no('b', null, valorDoAtributo(k, v))));
  const caixa = no('div', `poe-balao r-${p.raridade}`,
    no('div', 'poe-topo', no('b', null, p.nome), nomeDaBase && nomeDaBase !== p.nome ? no('span', null, nomeDaBase) : null),
    no('div', 'poe-props', no('div', 'poe-raridade', `${raridadeNome} · Item Level ${p.ilvl}`), props),
    requisitos && (requisitos.nivel > 1 || requisitos.str || requisitos.dex || requisitos.int)
      ? no('div', 'poe-requisitos', 'Requer ', [requisitos.nivel > 1 ? ['nivel', `Nível ${requisitos.nivel}`] : null, ...['str', 'dex', 'int'].filter((k) => requisitos[k]).map((k) => [k, `${requisitos[k]} ${NOME_DO_REQUISITO[k]}`])]
          .filter(Boolean)
          // O que o personagem NÃO tem fica em vermelho (número e atributo), como no PoE. `tem`: o que ele tem (sem `tem`, nada em vermelho).
          .flatMap(([k, texto], i) => [i ? ', ' : null, no('span', tem && (Number(tem[k]) || 0) < requisitos[k] ? 'poe-req falta' : 'poe-req', texto)]))
      : null,
    p.implicitos?.length ? [sep(), linhas(p.implicitos, 'imp', '')] : null,
    p.prefixos?.length ? [sep(), titulo('Prefixos'), linhas(p.prefixos, 'pre', 'P')] : null,
    p.sufixos?.length ? [p.prefixos?.length ? null : sep(), titulo('Sufixos'), linhas(p.sufixos, 'suf', 'S')] : null,
    p.modificadores?.length ? [sep(), p.modificadores.map((m) => no('div', 'poe-mod uni', estados ? marca() : null, no('span', null, m.texto)))] : null,
    af && Object.keys(af).length ? no('div', 'poe-draevor', no('b', null, 'No Draevor: '), Object.entries(af).filter(([, v]) => typeof v === 'number').map(([k, v]) => no('span', 'poe-af', `${k} ${v > 0 ? '+' : ''}${v}`))) : null,
    p.aviso ? no('div', 'poe-aviso', p.aviso) : null,
    p.erro ? no('div', 'poe-aviso', p.erro) : null);
  caixa.style.setProperty('--cor', cor);
  return caixa;
}
