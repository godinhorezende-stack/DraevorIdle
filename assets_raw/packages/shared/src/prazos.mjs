/*
 * ---- OS PRAZOS VIAJAM COMO INSTANTE, E A CONTA É DE QUEM DESENHA ----
 *
 * Report do Druid, no painel do jogo:
 *
 *   "mandar realmente apenas o que altera. Se tá mandando coisa repetida em
 *    todas mensagens, não deveria — pq aí vc vai estar gastando dado e
 *    processamento pra responder algo que tá do mesmo jeito. Até mesmo esse
 *    tempo de expire dos itens de reward não precisaria mandar toda hora, pq
 *    não vai mudar. Não precisa mandar quanto tempo falta pra expirar: manda 1
 *    vez o dia e hora que expira, aí fica armazenado e pronto. Não precisa
 *    ficar lendo toda hora e atualizando 8x por segundo."
 *
 * Uma contagem regressiva é `prazo - agora`. Ela muda em TODO quadro, por
 * definição — e como o quadro viaja por delta, campo a campo, um milissegundo
 * diferente faz o campo INTEIRO atravessar o fio. Foi assim que a espera de
 * todos os bosses, as três listas de prey, o baú com os itens de todos os
 * bosses do dia e os doze relógios da barra de magias atravessavam a rede oito
 * vezes por segundo sem que nada tivesse acontecido.
 *
 * O instante não muda. Ele viaja uma vez e fica.
 *
 * ---- Este arquivo, e por que ele é compartilhado ----
 *
 * O relógio da barra de ações é o único prazo do jogo com DOIS relógios, e a
 * regra de qual vale para quem não pode morar só num dos lados: o servidor a
 * usa para os cards da party e os testes de cooldown, e o cliente para pintar o
 * leque dos slots a 60 quadros por segundo. Duas cópias de uma regra assim
 * divergem — e o modo de divergir é o pior que existe: um relógio errado por
 * minutos, sem erro nenhum em lugar nenhum.
 */

/**
 * Quanto falta de um relógio da barra de ações, em milissegundos.
 *
 * `ate` corre no relógio da CAÇADA (`state.clock`), que só anda enquanto a
 * sessão anda — é o relógio de toda magia e de toda poção.
 *
 * `ateReal` corre no relógio do MUNDO, e é só do summon: o familiar continua
 * contando com o jogo fechado, que é o que faz ele valer para quem joga por
 * sessões curtas. Por isso são dois campos e não um — ver `actionCooldowns`.
 */
export function faltaDoCooldown(relogio, clock = 0, agora = Date.now()) {
  if (!relogio) return 0;
  if (relogio.ateReal != null) return Math.max(0, relogio.ateReal - agora);
  return Math.max(0, (relogio.ate ?? 0) - clock);
}
