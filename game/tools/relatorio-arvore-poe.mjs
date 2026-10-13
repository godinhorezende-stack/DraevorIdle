// O RELATÓRIO da árvore de passivas do PoE (dono, 12/10: "veja o que ainda não está implementado na árvore de habilidades e parcial…
// faça um relatório, atualizando o status do tooltip sempre que implementar"): lê `gamedata/itens-poe/arvore-poe.json` — o mesmo estado de
// cada linha que o balão da árvore mostra (✓ equivalente/novo/aproximado, ✗ registrado/inerte, – "não se aplica ao jogo") — e escreve
// `docs/arvore-poe-pendencias.md`: os números, o que NÃO funciona e o que é PARCIAL, agrupados pelo motivo (a nota da regra), com os nós.
// `tools/montar-arvore-poe.mjs` chama no fim: remontar a árvore (depois de mexer numa regra) atualiza o balão E o relatório juntos.
//
// Uso: node tools/relatorio-arvore-poe.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ARVORE = new URL('../gamedata/itens-poe/arvore-poe.json', import.meta.url);
const DESTINO = new URL('../../docs/arvore-poe-pendencias.md', import.meta.url);
const NAO_SE_APLICA = /^não se aplica ao jogo:/i;
const FALTA_NO_JOGO = /^falta no jogo:/i;
/**
 * Os blocos que eram DECISÃO do dono (memória do ciclo 7 da árvore), pela nota da linha. Dono, 12/10: implementar os cinco ("Tintura,
 * Runas e Vínculos, Armadilhas e Minas, Convocar o Aço" e "ligar os modificadores" de monstro e de mapa).
 */
const DECISAO_DO_DONO = [
  // (os blocos com nome primeiro: a nota do Convocar o Aço fala em empalamentos, que o último pegaria)
  [/Tinturas/i, 'criar a Tintura'],
  [/Runas e os Vínculos|Runas do jogo|habilidades de Vínculo/i, 'Runas e Vínculos presos ao alvo'],
  [/Armadilha e a Mina/i, 'Armadilhas e Minas plantadas (limite, duração, detonação)'],
  [/Convocar o Aço/i, 'o Convocar o Aço (Call of Steel)'],
  [/monstro|reflexo|Empal|Mutil|Drenar Vida De Você/i, 'ligar os modificadores de monstro/mapa (reflexo, Cegueira, Sangue Corrompido, Mutilar, Empalar em você…)'],
];

/**
 * Os blocos JÁ implementados a pedido do dono (12/10), pelo texto da linha: quantas linhas da árvore passaram a ter efeito e o que mudou no
 * jogo. Um bloco novo entra aqui quando é feito (o relatório conta as linhas sozinho).
 */
const IMPLEMENTADOS = [
  {
    bloco: 'Modificadores de monstro e de mapa ligados (lote 2)',
    re: /refletid|Refletid|Evitar Cegueira|Não pode ser Cegado|Sangue Corrompido|Exposições em você|ganhar Cargas de Poder, Frenesi ou Tolerância|Bloquearem Ataques com Espada|Drenar Vida De Você|não pode ser Mutilado|ser Empalado|Afecções Elementais de forma Inerente/,
    fora: /Convocar o Aço|Empalamentos removidos/,
    jogo: 'monstros que Cegam, Expõem, põem Sangue Corrompido, drenam vida e ganham cargas (modificadores de monstro); mapas com Cegar, Mutilar, Empalar, cargas por acerto, espinhos nos Raros e "Impossível Drenar"; o Golpe Crítico do monstro incendeia, congela e eletriza; o bloqueio do monstro contra Espada',
  },
  {
    bloco: 'Armadilhas e Minas plantadas (lote 3)',
    re: /plantadas por vez|Armadilhas adicionais|não podem ser Danificadas|Detonar Minas é Ativado|Velocidade de Detonação|Duração da Mina|Armadilhas próximas também Ativam|Uso de Recarga|Ativarem uma vez adicional|Detonadas uma Vez Adicional|quando são Plantadas/,
    jogo: 'a gema de Armadilha/Mina planta no alvo; a Armadilha ativa com inimigo a 1 casa (dura 4 s, até 15); a Mina detona sozinha com você parado e inimigo perto, em sequência (dura 5 s, até 15); a magia em área do monstro destrói as plantadas',
  },
  {
    bloco: 'Runas presas ao inimigo (lote 4a)',
    re: /Alcance do Vínculo de Runas|Runas Adicionais|Runas se Vinculam|quando uma Runa expira|Runas Vinculadas a eles|Marca adicional Vinculada|Frequência de Ativação se|caso \d+% da Duração do Vínculo/,
    jogo: 'a Runa (Brand) vincula ao inimigo e é Ativada a cada N segundos enquanto vinculada (5 s; solta, procura outro por 6 s); até 3 ativas, 1 por inimigo; o automático não reconjura com todas em campo',
  },
  {
    bloco: 'Vínculos (lote 4b)',
    re: /focar em Lacaios Danificáveis|Feixes de Vínculo|alvos Vinculados têm Exposição|Vínculos demoram|alvo aleatório adicional|Alvos Vinculados compartilham|entre os Jogadores Vinculados|alvov?s Vinculados$|Duração do Vínculo que tenha Expirado|ao invés dos alvos Vinculados/,
    jogo: 'as 6 gemas de Vínculo criadas: focam um jogador da party na sala (lacaios, com o nó), custam mana por segundo, quebram fora do alcance em 4 s e, se o alvo morre vinculado, você morre; os efeitos de cada uma (Fogo, bloqueio, menos dano e o seu Escudo, crítico, o seu Dreno no alvo)',
  },
  {
    bloco: 'Convocar o Aço (lote 5)',
    re: /Convocar o Aço|Chamado do Aço|Empalamentos removidos desta forma/,
    jogo: 'as gemas de Aço concedem o Convocar o Aço, automático: chama os empalamentos dos vivos e dos cadáveres a até 6 casas, reflete em volta de cada um o dano × os acertos que restavam e dá 1 Fragmento de Aço por empalamento; recarrega 4 Fragmentos a cada 0,5 s até 12; o Aço Perfurador, o Aço Violento e o Estraçalhador da Munição e a Balista gastam os Fragmentos como no PoE (mais projéteis, a divisão, a Proteção de Aço); a linha dos "Empalamentos removidos desta forma" é da remoção ao Acertar (a mesma opção da maestria), não do Convocar o Aço',
  },
  {
    bloco: 'Tinturas (lote 6)',
    re: /Tintura|Queimas? de Mana|Ferimentos Abertos/,
    jogo: 'as Tinturas criadas: caem (Normal, Mágica, Única), vão no cinto de frascos e ativam sozinhas em combate; ativas, põem Queima de Mana em você (1% da Mana máxima por segundo cada) e dão os mods delas nos ataques com Arma Corpo a Corpo; desativam com a mana acabando (ou abaixo do limite da regra), tiram a Queima de Mana e entram na recarga da base',
  },
  {
    bloco: 'Aliados de verdade (lote 7)',
    re: /[Aa]liad/,
    jogo: '"Você e Aliados" vira a aura do nó (vale em você, nos companheiros da party na sala a até 3 casas e nos seus lacaios; a mesma aura de duas pessoas: a maior); "Auras das suas Habilidades concedem" entra por aura ligada; a Fortificação igual do Campeão; "aliado por perto" conta lacaios e a party; a Ichimonji nas auras',
  },
];

/** Todas as linhas da árvore: os nós (com as ascendências) e as opções das maestrias. */
export function linhasDaArvore(arvore) {
  const saida = [];
  for (const n of Object.values(arvore.nos ?? {})) {
    const pegar = (o, maestria) => (o.textos ?? []).forEach((texto, i) => saida.push({
      id: n.id, no: n.nome, tipo: n.tipo, asc: n.ascendencia ?? null, maestria, texto, estado: o.estados?.[i] ?? null, nota: o.notas?.[i] ?? null,
    }));
    pegar(n, false);
    for (const op of n.opcoes ?? []) pegar(op, true);
  }
  return saida;
}
const semEfeito = (l) => l.estado === 'registrado' || (l.estado === 'inerte' && !NAO_SE_APLICA.test(l.nota ?? ''));
const parcial = (l) => l.estado === 'aproximado';

function agrupar(linhas) {
  const g = new Map();
  for (const l of linhas) {
    const k = (l.nota ?? '(sem nota)').replace(/\s+/g, ' ').trim();
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(l);
  }
  return [...g].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}
const ondeE = (l) => (l.asc ? `asc. ${l.asc}` : l.maestria ? 'maestria' : l.tipo === 'keystone' ? 'keystone' : l.tipo === 'notable' ? 'notável' : 'nó');
const escapar = (t) => String(t).replace(/\|/g, '\\|');

/** O relatório em Markdown (e os números). */
export function relatorio(arvore, hoje = new Date()) {
  const linhas = linhasDaArvore(arvore);
  const n = (f) => linhas.filter(f).length;
  const se = linhas.filter(semEfeito);
  const pa = linhas.filter(parcial);
  const decisao = (nota) => DECISAO_DO_DONO.find(([re]) => re.test(nota ?? ''))?.[1] ?? null;
  const numeros = {
    linhas: linhas.length,
    comEfeito: n((l) => ['equivalente', 'novo', 'aproximado'].includes(l.estado)),
    equivalente: n((l) => l.estado === 'equivalente'), novo: n((l) => l.estado === 'novo'), aproximado: pa.length,
    semEfeito: se.length, registrado: n((l) => l.estado === 'registrado'), faltaNoJogo: n((l) => semEfeito(l) && FALTA_NO_JOGO.test(l.nota ?? '')),
    decisaoDoDono: se.filter((l) => decisao(l.nota)).length,
    naoSeAplica: n((l) => l.estado === 'inerte' && NAO_SE_APLICA.test(l.nota ?? '')), lembrete: n((l) => l.estado === 'nota'),
    semEfeitoPrincipal: se.filter((l) => !l.asc).length, semEfeitoAscendencias: se.filter((l) => l.asc).length,
  };
  const md = [];
  md.push('# Árvore de passivas do PoE — o que falta e o que é parcial', '');
  md.push(`Gerado por \`game/tools/relatorio-arvore-poe.mjs\` em ${hoje.toISOString().slice(0, 10)}, a partir de \`game/gamedata/itens-poe/arvore-poe.json\` — o mesmo estado que o balão da árvore mostra em cada linha. Remontar a árvore (\`node tools/montar-arvore-poe.mjs\`, depois de mexer numa regra de \`traducao.json\`) atualiza o balão e este relatório juntos.`, '');
  md.push('## Resumo', '');
  md.push(`- Linhas: **${numeros.linhas}** (nós, ascendências e opções das maestrias).`);
  md.push(`- ✓ Com efeito: **${numeros.comEfeito}** — equivalente ${numeros.equivalente}, novo ${numeros.novo}, aproximado (parcial) ${numeros.aproximado}.`);
  md.push(`- ✗ Sem efeito: **${numeros.semEfeito}** — na árvore principal ${numeros.semEfeitoPrincipal}, nas ascendências ${numeros.semEfeitoAscendencias}; sem regra de efeito (registrado) ${numeros.registrado}; habilidade/mecânica que falta no jogo ${numeros.faltaNoJogo}; **${numeros.decisaoDoDono} estão nos blocos que o dono mandou implementar (12/10)**.`);
  md.push(`- – Não se aplica ao jogo: ${numeros.naoSeAplica}. Lembretes do PoE (entre parênteses, sem marca): ${numeros.lembrete}.`, '');
  md.push('## Implementado a pedido do dono (12/10)', '');
  md.push('| Bloco | Linhas com efeito agora | Sem efeito ainda | O que mudou no jogo |', '|---|---:|---:|---|');
  for (const b of IMPLEMENTADOS) {
    const ls = linhas.filter((l) => b.re.test(l.texto) && !b.fora?.test(l.texto));
    md.push(`| ${escapar(b.bloco)} | ${ls.filter((l) => ['equivalente', 'novo', 'aproximado'].includes(l.estado)).length} | ${ls.filter(semEfeito).length} | ${escapar(b.jogo)} |`);
  }
  md.push('');
  md.push('## Sem efeito (✗), pelo motivo', '');
  md.push('| Linhas | Motivo | Bloco a implementar (dono, 12/10) | Exemplos (nó — texto) |', '|---:|---|---|---|');
  for (const [nota, ls] of agrupar(se)) {
    const ex = [...new Map(ls.map((l) => [l.texto, l])).values()].slice(0, 3).map((l) => `${escapar(l.no)} (${ondeE(l)}) — ${escapar(l.texto)}`).join('<br>');
    md.push(`| ${ls.length} | ${escapar(nota)} | ${decisao(nota) ? escapar(decisao(nota)) : '—'} | ${ex} |`);
  }
  md.push('', '## Parcial (aproximado, ✓ com diferença do PoE), pelo motivo', '');
  md.push('| Linhas | A diferença | Exemplos (nó — texto) |', '|---:|---|---|');
  for (const [nota, ls] of agrupar(pa)) {
    const ex = [...new Map(ls.map((l) => [l.texto, l])).values()].slice(0, 3).map((l) => `${escapar(l.no)} (${ondeE(l)}) — ${escapar(l.texto)}`).join('<br>');
    md.push(`| ${ls.length} | ${escapar(nota)} | ${ex} |`);
  }
  md.push('');
  return { md: md.join('\n'), numeros };
}

/** Lê a árvore montada, escreve o relatório e devolve os números. */
export function gravarRelatorio(hoje = new Date()) {
  const r = relatorio(JSON.parse(readFileSync(ARVORE, 'utf8')), hoje);
  writeFileSync(DESTINO, r.md);
  return r.numeros;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const numeros = gravarRelatorio();
  console.log(JSON.stringify(numeros), '→', DESTINO.pathname);
}
