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
  [/Runas e os Vínculos|Runas do jogo/i, 'Runas e Vínculos presos ao alvo'],
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
