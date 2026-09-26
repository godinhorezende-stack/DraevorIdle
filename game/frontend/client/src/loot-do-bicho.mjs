/*
 * ---- O que cai de um bicho, gemas incluídas ----
 *
 * Report do Taka Flecha: "vocês implementaram drops das gemas nos mapas! mas
 * não aparece na descrição dos drop dos bichos nem no loot filter! aí o
 * vendedor automático está vendendo todas, e não dá nem para colocar no 'Não
 * vender' porque ele não aparece nos filtros".
 *
 * A gema não está na tabela do bicho: ela é juntada na hora de rolar o loot, no
 * servidor (ver `montarGemasDoCatalogo`, no index.mjs, onde está a história
 * inteira). Então ela é juntada aqui, no ÚNICO lugar que responde "o que cai
 * deste bicho", e toda tela que faz essa pergunta chama este ajudante.
 *
 * ---- Por que ele saiu do panels.mjs para um módulo só dele ----
 *
 * Ele nasceu lá dentro, servindo as quatro telas que já moravam ali. Aí a barra
 * dos bosses da arena, que é do `hud.mjs`, passou a precisar da mesma resposta —
 * e o `hud.mjs` não pode importar o `panels.mjs`, que importa o `hud.mjs` de
 * volta. Copiar as vinte linhas seria a queixa acima de novo, um dia, numa das
 * duas cópias.
 *
 * O catálogo entra como PARÂMETRO em vez de vir de um estado global: é o que
 * deixa este arquivo não importar ninguém, que é a condição de ele poder ser
 * importado por qualquer um.
 */

/**
 * A tabela de loot do bicho com as gemas do Gem Atelier juntadas.
 *
 * ---- Um detalhe que a tela arredonda ----
 *
 * Quem rola a tabela de BOSS é a sessão, e não o bicho: dentro de uma sala de
 * boss os acompanhantes rolam com a tabela do boss também. Aqui a pergunta é
 * feita ao bicho (`entry.boss`), então o acompanhante aparece com a chance de
 * caça. É a diferença entre 0,09% e 0,04% numa linha de um bicho que ninguém
 * entra para caçar — e a alternativa seria passar a sessão por cinco telas.
 */
export function lootComGemas(entry, catalog) {
  const base = entry?.loot ?? [];
  const gemas = catalog?.gemas;
  if (!gemas) return base;
  const extra = entry?.boss
    ? gemas.boss
    : (entry?.exp ?? 0) >= (gemas.expMinima ?? Infinity)
    ? gemas.caca
    : null;
  if (!extra?.length) return base;
  /*
   * ---- E a gema que o bicho JÁ larga não entra duas vezes ----
   *
   * São 38 bichos com gema na tabela própria, importada da base: o Dragon Hoard
   * larga a lesser guardian a 11,1%, contra os 0,03% da regra geral. Sem esta
   * peneira a mesma gema apareceria duas vezes na ficha dele — e a segunda, com
   * o número pior, faria a chance boa parecer errada.
   *
   * Fica a linha DO BICHO, e não a maior das duas: nas 38 ela é a melhor em
   * todas as linhas (medido), e quando o dono mexer numa chance pelo painel é o
   * número dele que a ficha tem de mostrar.
   */
  const jaTem = new Set(base.map((linha) => linha.id));
  const faltando = extra.filter((linha) => !jaTem.has(linha.id));
  return faltando.length ? base.concat(faltando) : base;
}
