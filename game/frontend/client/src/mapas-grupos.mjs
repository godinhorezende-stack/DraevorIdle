// Os GRUPOS e as ABAS do Dispositivo de Mapas (dono, 27/10: "uma aba por mapa e os mapas que forem iguais aparecer ×1 ×2, a quantidade").
// A parte pura da tela (`mapas-dispositivo.mjs` desenha): junta os mapas iguais num grupo (a `chave` que o servidor manda — a mesma base e
// tier, raridade, qualidade, afixos, o único e o corrompido: `systems/itens-poe/mapas-loop.mjs → chaveDoMapa`), monta as abas por tier com
// a contagem e diz quantos mapas a seleção do loop usa. Sem DOM.

const RARIDADE = { normal: 'Normal', magico: 'Mágico', raro: 'Raro', unico: 'Único' };

/**
 * Junta os mapas iguais, na ordem em que o servidor mandou (do tier maior para o menor): `[{ chave, tier, nivel, raridade, nome, mapas,
 * qtd, naBolsa }]`. O primeiro de cada grupo é o que o "Abrir mapa" abre. Sem `chave` (servidor antigo), cada peça fica sozinha.
 */
export function agruparMapas(mapas) {
  const grupos = new Map();
  for (const m of mapas ?? []) {
    const chave = m.chave ?? `${m.onde}:${m.indice}:${m.assinatura}`;
    let g = grupos.get(chave);
    if (!g) grupos.set(chave, (g = { chave, tier: m.tier, nivel: m.nivel, raridade: m.raridade, nome: m.nome, mapas: [], qtd: 0, naBolsa: 0 }));
    g.mapas.push(m);
    g.qtd++;
    if (m.onde === 'pouch') g.naBolsa++;
  }
  return [...grupos.values()];
}

/** A aba de um grupo: o tier (`t3`), ou `unicos` para os mapas únicos (que têm a aba deles). */
export const abaDoGrupo = (g) => (g.raridade === 'unico' ? 'unicos' : `t${g.tier}`);

/**
 * As abas da tela: "Todos" e uma por tier que o jogador TEM (do T1 ao T16; as vazias não aparecem), mais "Únicos" se houver — cada uma
 * com quantos mapas (peças, não grupos): `[{ id, rotulo, qtd }]`.
 */
export function abasDosMapas(grupos) {
  const porAba = new Map();
  let total = 0;
  for (const g of grupos ?? []) {
    const id = abaDoGrupo(g);
    porAba.set(id, (porAba.get(id) ?? 0) + g.qtd);
    total += g.qtd;
  }
  const tiers = [...porAba.keys()].filter((id) => id !== 'unicos').sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  return [
    { id: 'todos', rotulo: 'Todos', qtd: total },
    ...tiers.map((id) => ({ id, rotulo: `T${id.slice(1)}`, qtd: porAba.get(id) })),
    ...(porAba.has('unicos') ? [{ id: 'unicos', rotulo: 'Únicos', qtd: porAba.get('unicos') }] : []),
  ];
}

/** A aba que vale: a pedida, se ainda existe; senão "Todos". */
export const abaValida = (abas, pedida) => (abas.some((a) => a.id === pedida) ? pedida : 'todos');

/** Os grupos de uma aba. */
export const gruposDaAba = (grupos, aba) => (aba === 'todos' ? grupos : grupos.filter((g) => abaDoGrupo(g) === aba));

/** "T3 Normal" / o nome do único — o rótulo curto do grupo (com " ×N" se `n`). */
export const rotuloDoGrupo = (g, n = null) => `${g.raridade === 'unico' ? g.nome : `T${g.tier} ${RARIDADE[g.raridade] ?? g.raridade}`}${n != null ? ` ×${n}` : ''}`;

/**
 * A seleção do loop (`selecao`: `Map<chave, quantos | null>` — null = todos) contra os grupos de agora: só os que ainda existem, na ordem
 * da tela, com quantos cada um usa (o número escolhido sem passar do que há). `{ grupos: [{ chave, quantos }], mapas }` — `grupos` é o
 * que vai para o servidor (`iniciarLoopDeMapas`).
 */
export function resumoDaSelecao(grupos, selecao) {
  const saida = [];
  let mapas = 0;
  for (const g of grupos ?? []) {
    if (!selecao?.has(g.chave)) continue;
    const q = selecao.get(g.chave);
    const n = Number.isFinite(q) && q >= 1 ? Math.min(Math.floor(q), g.qtd) : null;
    saida.push({ chave: g.chave, quantos: n });
    mapas += n ?? g.qtd;
  }
  return { grupos: saida, mapas };
}

/**
 * (27/10, revisão) O que do Dispositivo (`campanha.mapas`) muda a tela: o mapa aberto, os mapas que você carrega, o loop (o "Parar loop", o
 * "N de M", o porquê de ter parado) e as estatísticas. Entra na assinatura da mensagem `campanha` (`main.mjs`): ela só redesenha quando a
 * assinatura muda, e sem isto a resposta do servidor trocava os dados e a tela aberta ficava como estava.
 */
export function assinaturaDoDispositivo(m) {
  if (!m) return null;
  const a = m.aberto;
  const e = m.estatisticas;
  return [m.liberado, m.motivo, a && [a.id, a.portais, a.mortes, a.naCacada, a.guardado], (m.mapas ?? []).map((x) => [x.id, x.onde, x.indice, x.chave]), m.loop ?? null, e && [e.concluidos, e.falhos, e.mortes, e.maiorTier]];
}
