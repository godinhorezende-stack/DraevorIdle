/*
 * ---- O DESENHO DA BOSS POUCH, numa definição só ----
 *
 * Três lugares desenham esta bolsa: o quadradinho dentro da mochila, o
 * cabeçalho da janela dela, e o teste que garante que o sprite não sumiu do
 * atlas (`tools/test-catalogo-cheio.mjs`). Escrito à mão nos três, bastaria
 * trocar em dois para a tela ficar meio certa — e "meio certa" aqui quer dizer
 * um quadrado vazio numa janela e a bolsa certa na outra.
 *
 * ---- Por que 23721, e por que ele deu trabalho ----
 *
 * Pedido do dono: "a sprite da boss pouch tem que ser a de gold pouch". A
 * `gold pouch` é um container da gamestore dele, e por isso nenhuma das regras
 * do pipeline a alcançava: ela não cai de bicho, não se veste e não tem preço
 * de NPC. O atlas saía sem ela, `itemCanvas(23721)` desenhava nada, e foi por
 * isso que a primeira versão desta bolsa usou a `golden bag` (2863) — um
 * desenho parecido que já estava lá.
 *
 * Agora ela existe de verdade: `tools/extrair-item.mjs --pagina bolsa 23721`
 * a extraiu para uma página própria, o `cli.mjs` a inclui numa reextração
 * completa, e o `test-catalogo-cheio` acusa se ela sumir.
 */
/*
 * 15/09: o dono trocou — a Boss Pouch passa a ser o 55370 e a Store Inbox o
 * 55368, os dois extraídos para a página própria `pouches` com
 * `node tools/extrair-item.mjs --pagina pouches 55368 55370`. A gold pouch
 * (23721) virou a reserva.
 */
export const ITEM_DA_BOSS_POUCH = 55370;

/*
 * O desenho de reserva, se um dia o atlas vier sem o desenho da Boss Pouch.
 *
 * Uma bolsa parecida é melhor do que um buraco: o quadradinho fica no meio da
 * mochila, e um quadrado vazio ali parece defeito da mochila, não do sprite.
 */
export const ITEM_DA_BOSS_POUCH_RESERVA = 23721;

/** O desenho da Store Inbox (mesma página `pouches`). */
export const ITEM_DA_STORE_INBOX = 55368;
