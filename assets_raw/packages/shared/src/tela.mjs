/*
 * O tamanho da tela, em casas.
 *
 * ---- Por que isto virou um módulo ----
 *
 * O número morava no cliente, que é quem desenha, e parecia o lugar certo. Só
 * que quem MEDE o que o jogador vê precisa dele tanto quanto quem desenha — e
 * quem mede é o `tools/test-fundo-preto.mjs`, que conta quanta tela sai preta
 * em cada hunt. Um teste que fizesse a conta com um 23 escrito à mão passaria a
 * aprovar o jogo errado no dia em que a tela mudasse de tamanho.
 *
 * Um número que duas pontas precisam saber e só uma sabia é um número no lugar
 * errado. Agora as duas leem daqui.
 */

/*
 * Campo de visão exato: 11 sqm para cada lado do personagem e 6 para cima e
 * para baixo, mais o tile dele. Não é "pelo menos isso" — é isso.
 */
export const VIEW_TILES_X = 23;
export const VIEW_TILES_Y = 13;

/** Quantas casas a tela mostra para cada lado do personagem. */
export const METADE_DA_TELA = {
  x: (VIEW_TILES_X - 1) / 2,
  y: (VIEW_TILES_Y - 1) / 2,
};

/*
 * A casa a mais, em cada direção.
 *
 * O sprite alto é ancorado no canto de baixo: uma árvore ou uma parede que está
 * na linha logo ACIMA da tela ainda pinta dentro dela. É por isso que o desenho
 * começa a varredura uma casa antes do canto — a "folga da borda" do
 * `drawMapa`. Ela não conta como tela: aquela casa não é mostrada, só o topo
 * do que está nela é que entra.
 */
export const FOLGA_DO_SPRITE_ALTO = 1;
