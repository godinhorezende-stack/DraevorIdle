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
/** A CATEGORIA da peça (a classe do PoE em português), a primeira linha das propriedades, como no PoE ("Espada de Duas Mãos"). */
export const CATEGORIA = {
  Body_Armours: 'Armadura de Corpo', Helmets: 'Elmo', Gloves: 'Luvas', Boots: 'Botas', Belts: 'Cinto', Shields: 'Escudo', Quivers: 'Aljava',
  Rings: 'Anel', Amulets: 'Amuleto', Trinkets: 'Bugiganga', Jewels: 'Joia', Abyss_Jewels: 'Joia Abissal',
  One_Hand_Swords: 'Espada de Uma Mão', Thrusting_One_Hand_Swords: 'Espada de Estocada de Uma Mão', Two_Hand_Swords: 'Espada de Duas Mãos',
  One_Hand_Axes: 'Machado de Uma Mão', Two_Hand_Axes: 'Machado de Duas Mãos', One_Hand_Maces: 'Maça de Uma Mão', Two_Hand_Maces: 'Maça de Duas Mãos',
  Sceptres: 'Cetro', Staves: 'Cajado', Warstaves: 'Cajado de Guerra', Claws: 'Garra', Daggers: 'Adaga', Rune_Daggers: 'Adaga Rúnica',
  Bows: 'Arco', Wands: 'Varinha', Fishing_Rods: 'Vara de Pesca',
  Life_Flasks: 'Frasco de Vida', Mana_Flasks: 'Frasco de Mana', Utility_Flasks: 'Frasco de Utilidade', Tinctures: 'Tintura',
};
const categoriaDe = (p) => CATEGORIA[p.classe ?? String(p.base ?? '').split('/')[0]] ?? null;
/** O frasco com os mods já aplicados (o servidor manda `poe.frasco`): o que recupera, as cargas e o efeito. */
function resumoDoFrasco(f) {
  const n = (v) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const linhas = [];
  if (f.recurso) linhas.push(f.instantaneo ? `Recupera ${n(f.quantidade)} de ${f.recurso === 'mana' ? 'Mana' : 'Vida'} na hora` : `Recupera ${n(f.quantidade)} de ${f.recurso === 'mana' ? 'Mana' : 'Vida'} em ${n(f.segundos)} s`);
  if (f.duracao) linhas.push(`Dura ${n(f.duracao)} s`);
  if (f.efeitoDaBase) linhas.push(f.efeitoDaBase);
  linhas.push(`Usa ${f.cargasPorUso} de ${f.cargasMaximas} cargas`);
  linhas.push(f.tipo === 'utilidade' ? 'No cinto: usado sozinho em combate' : `No cinto: usado sozinho com a ${f.recurso === 'mana' ? 'mana' : 'vida'} baixa`);
  return no('div', 'poe-props poe-frasco-resumo', linhas.map((l) => no('div', null, l)));
}

export function balaoPoe(p, { cor = p.cor ?? '#ddd', raridadeNome = p.raridadeNome ?? p.raridade, nomeDaBase = null, estados = p.estados ?? null, af = p.af ?? null, requisitos = null, tem = null } = {}) {
  const fila = [...(estados ?? [])];
  const marca = () => {
    const e = fila.shift();
    return e ? Object.assign(no('em', `poe-tr ${e}`, SIMBOLO[e] ?? ''), { title: ESTADO[e] ?? e }) : null;
  };
  const linhas = (lista, classe, sigla) => (lista ?? []).map((m) => no('div', `poe-mod ${classe}`, estados ? marca() : null, no('span', null, m.texto), m.tier != null ? Object.assign(no('i', null, `${sigla} T${m.tier}`), { title: `${m.familia ?? ''} · iLvl ${m.ilvl ?? '?'}` }) : null));
  const sep = () => no('div', 'poe-sep');
  const titulo = (texto) => no('div', 'poe-secao', texto);
  // A QUALIDADE (poedb › Quality): a linha "Qualidade: +X%" em cima e o dano físico/defesa já escalados (em azul, como no PoE).
  const q = Number(p.qualidade) || 0;
  const QUALIFICAM = new Set(['dano_fisico', 'armadura', 'evasao', 'escudo_energia']);
  const comQ = (k, v) => (!q || !QUALIFICAM.has(k) ? v : v && typeof v === 'object' ? { min: Math.round(v.min * (1 + q / 100)), max: Math.round(v.max * (1 + q / 100)) } : Math.round(v * (1 + q / 100)));
  const props = [
    q ? no('div', null, 'Qualidade: ', no('b', 'poe-aumentado', `+${q}%`)) : null,
    ...Object.entries(p.atributos ?? {}).filter(([k]) => ROTULO[k]).map(([k, v]) => no('div', null, `${ROTULO[k]}: `, no('b', q && QUALIFICAM.has(k) ? 'poe-aumentado' : null, valorDoAtributo(k, comQ(k, v))))),
  ];
  const caixa = no('div', `poe-balao r-${p.raridade}`,
    no('div', 'poe-topo', no('b', null, p.nome), nomeDaBase && nomeDaBase !== p.nome ? no('span', null, nomeDaBase) : null),
    no('div', 'poe-props', categoriaDe(p) ? no('div', 'poe-categoria', categoriaDe(p)) : null, no('div', 'poe-raridade', `${raridadeNome} · Item Level ${p.ilvl}`), props),
    requisitos && (requisitos.nivel > 1 || requisitos.str || requisitos.dex || requisitos.int)
      ? no('div', 'poe-requisitos', 'Requer ', [requisitos.nivel > 1 ? ['nivel', `Nível ${requisitos.nivel}`] : null, ...['str', 'dex', 'int'].filter((k) => requisitos[k]).map((k) => [k, `${requisitos[k]} ${NOME_DO_REQUISITO[k]}`])]
          .filter(Boolean)
          // O que o personagem NÃO tem fica em vermelho (número e atributo), como no PoE. `tem`: o que ele tem (sem `tem`, nada em vermelho).
          .flatMap(([k, texto], i) => [i ? ', ' : null, no('span', tem && (Number(tem[k]) || 0) < requisitos[k] ? 'poe-req falta' : 'poe-req', texto)]))
      : null,
    p.frasco ? [sep(), resumoDoFrasco(p.frasco)] : null,
    p.implicitos?.length ? [sep(), linhas(p.implicitos, 'imp', '')] : null,
    p.prefixos?.length ? [sep(), titulo('Prefixos'), linhas(p.prefixos, 'pre', 'P')] : null,
    p.sufixos?.length ? [p.prefixos?.length ? null : sep(), titulo('Sufixos'), linhas(p.sufixos, 'suf', 'S')] : null,
    p.modificadores?.length ? [sep(), p.modificadores.map((m) => no('div', 'poe-mod uni', estados ? marca() : null, no('span', null, m.texto)))] : null,
    // A faixa "No Draevor: STR +20 ..." saiu do balão (dono, 07/10): o que a peça dá já está nas linhas do PoE.
    p.aviso ? no('div', 'poe-aviso', p.aviso) : null,
    p.erro ? no('div', 'poe-aviso', p.erro) : null);
  caixa.style.setProperty('--cor', cor);
  return caixa;
}
