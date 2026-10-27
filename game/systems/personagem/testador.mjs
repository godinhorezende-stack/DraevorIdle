// O PERSONAGEM DE TESTE (dono, 27/10: "coloque meu char ADM GODINES no lv máximo, mas não entra no ranking e ele não pode morrer —
// chega a 0 de vida e não morre, mas toma dano para testar as coisas").
//
// A marca é `estado.testador === true`, posta só pela ferramenta de admin (`admin/personagem-de-teste.mjs`). Ela faz TRÊS coisas (a 3., abaixo) e
// nenhuma outra:
//   1. a MORTE não acontece: o dano chega normalmente (o número aparece, a vida cai), mas a vida para no piso `VIDA_MINIMA` em vez de
//      zerar. O piso é 1, e não 0, porque o jogo inteiro lê "vida <= 0" como morto (a sessão manda o `death`, a caçada offline para, os
//      golpes e os frascos param): com 0 ele ficaria parado, sem bater nem curar, e com 1 segue de pé tomando dano. A regeneração segue;
//   2. o RANKING não o lista (o highscore do jogo, o do site, a exp do dia e da hora e o pódio da Arena): `sqlSemTestador` nas consultas
//      e `ehTestador` no valor ao vivo.
// Onde a morte é barrada: no dano (`hunt/combate.mjs` → o golpe corpo a corpo; `poderes.mjs` → `aplicarNoJogador`, por onde passam as
// magias, as mecânicas e o dano contínuo), no fim de todo tique da caçada (`Cacadas.tique`, que também é o tique da caçada offline e o
// das threads do tique) e na sessão, antes de conferir a morte (`websocket/sessao.mjs`). Os três chamam `segurarVida`.
// E o piso (`pisoDaVida`) nos danos em você que tiravam a vida direto: o Traumatismo e o Ritual Proibido (`acoes.mjs`), a morte do alvo
// vinculado, o Sangue Petrificado (`gemas-a2.mjs`), as ações `dano`/`danoPctVida` dos gatilhos (`mods-poe.mjs`) e a reserva da Dissolução
// (`condicoes-poe.mjs`) — sem ele, o testador ficava em 0 no meio do tique e o número saía com `fatal`. Fora da marca, nada muda.
// 3. (fora da regra da morte e do ranking) os drops dele não vão para a vitrine da capa do site (`drops-do-site.mjs`, pelo `estado`).
//
// Sem dependências de propósito: é importado do caminho quente do combate.

/** O personagem é o de teste? */
export const ehTestador = (estado) => estado?.testador === true;

/** O piso da vida do personagem de teste (o mínimo que o jogo precisa para não o dar como morto). */
export const VIDA_MINIMA = 1;

/** O piso da vida para o dano: `VIDA_MINIMA` no personagem de teste, 0 nos outros (a conta de sempre). */
export const pisoDaVida = (estado) => (ehTestador(estado) ? VIDA_MINIMA : 0);

/** Personagem de teste com a vida abaixo do piso: volta ao piso. Devolve `true` se segurou (ele teria morrido). */
export function segurarVida(estado) {
  if (!ehTestador(estado) || !((estado.hp ?? 0) < VIDA_MINIMA)) return false;
  estado.hp = VIDA_MINIMA;
  return true;
}

/** A condição SQL que deixa o personagem de teste de fora (a coluna `estado` da tabela `personagens`). */
export const sqlSemTestador = (dialeto) =>
  dialeto === 'postgres'
    ? `coalesce(estado::jsonb ->> 'testador', 'false') <> 'true'`
    : `coalesce(json_extract(estado, '$.testador'), 0) = 0`;
