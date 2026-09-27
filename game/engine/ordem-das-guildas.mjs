/* =========================================================================
 * A ORDEM DA TABELA DE GUILDAS — um critério, escrito uma vez
 *
 * "Critério: pontos → nível da guilda → membros → data de fundação (mais antiga
 *  primeiro). Mesmo critério no jogo e no site (/guildas, ranking)."
 *
 * ---- POR QUE ISTO E' UM ARQUIVO, E NAO UM `ORDER BY` ----
 *
 * O `ORDER BY` do banco ordena o que SAI de lá, e é ele que decide quem entra no
 * `LIMIT`. Mas a mesma lista é redesenhada em três lugares — a tabela do jogo, a
 * página /guildas e o pódio —, e cada um deles já teve, em algum momento, um
 * `sort` próprio. Dois `sort` com o mesmo nome e critérios diferentes é a forma
 * mais discreta de a mesma guilda aparecer em 2º numa tela e em 3º na outra.
 *
 * Aqui a comparação é UMA função. O banco continua ordenando (ele precisa, por
 * causa do `LIMIT`), e quem desenha aplica esta — que é a palavra final.
 *
 * ---- POR QUE A MAIS ANTIGA NA FRENTE ----
 *
 * O último critério existe para nunca haver empate de verdade: sem ele, duas
 * guildas iguais em tudo trocariam de lugar entre duas leituras, e a tabela
 * pareceria mexer sozinha. A data resolve isso e resolve dizendo algo justo —
 * entre iguais, quem está no servidor há mais tempo aparece primeiro.
 *
 * O NOME fecha a conta, para o caso de duas guildas fundadas no mesmo
 * milissegundo (duas abas, um servidor rápido). Ele não é um critério de mérito:
 * é o desempate que garante que a ordem é sempre a mesma.
 * ========================================================================= */

/** O texto do critério, para o "?" da janela e para a página do site. */
export const CRITERIO_DA_ORDEM =
  'A tabela é ordenada por pontos, depois nível da guilda, depois número de membros e, ' +
  'em último, data de fundação — entre iguais, a guilda mais antiga aparece primeiro.';

const numeroDe = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/*
 * A data vem com dois nomes: `criadaEm` na lista que viaja para as telas e
 * `criada_em` na linha crua do banco. As duas são lidas aqui porque este arquivo
 * é chamado dos dois lados — e um `??` é mais barato que uma segunda função.
 *
 * Sem data, a guilda vai para o FIM do desempate (`Infinity`) e não para o
 * começo: um campo faltando não é um certificado de antiguidade.
 */
const fundacaoDe = (g) => {
  const n = Number(g?.criadaEm ?? g?.criada_em);
  return Number.isFinite(n) ? n : Infinity;
};

/** Compara duas guildas pelo critério da tabela. Serve direto ao `sort`. */
export function compararGuildas(a, b) {
  return (
    numeroDe(b?.pontos) - numeroDe(a?.pontos) ||
    numeroDe(b?.nivel) - numeroDe(a?.nivel) ||
    numeroDe(b?.membros) - numeroDe(a?.membros) ||
    fundacaoDe(a) - fundacaoDe(b) ||
    String(a?.nome ?? '').localeCompare(String(b?.nome ?? ''), 'pt-BR')
  );
}

/**
 * A lista ordenada, numa CÓPIA.
 *
 * `sort` mexe no arranjo original, e a lista que chega aqui é, nos três
 * chamadores, a mesma que o resto da tela usa — ordenar no lugar mudaria a ordem
 * de quem nem pediu ordem nenhuma.
 */
export const ordenarGuildas = (lista) => [...(lista ?? [])].sort(compararGuildas);
