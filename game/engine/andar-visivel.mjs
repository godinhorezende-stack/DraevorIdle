/*
 * Até que andar a tela mostra — a regra do teto, e a do piso.
 *
 * Começou só com o teto, que era onde estava o defeito da vez. A regra do PISO
 * chegou depois, no fim do arquivo, quando se descobriu que ela vivia como um
 * número solto em dois lugares — ver "a outra ponta", lá embaixo. As duas são a
 * mesma conta da base, lida de cima e lida de baixo.
 *
 * ---- O problema ----
 *
 * As hunts exportam o andar de cima e o de baixo como andares de verdade: dá
 * para subir e descer por escada. O desenho, porém, só mostrava o que está
 * ABAIXO, pelos buracos do chão (`camadasDeFundo`). Para cima não mostrava
 * nada, e o motivo não era esquecimento: desenhado errado, o andar de cima
 * cobre o personagem — o jogador fica dentro de uma caverna e vê o chão do
 * nível de cima por cima da própria cabeça.
 *
 * O client do Tibia resolve isso com uma pergunta feita a cada quadro: qual é o
 * andar mais ALTO que ainda vale desenhar? Ele se chama "primeiro andar
 * visível" porque os andares são desenhados do mais alto para o mais baixo, e
 * é o que este módulo responde.
 *
 * ---- A regra, em duas metades ----
 *
 * 1. O ALCANCE. Debaixo da terra a vista é de dois andares para cada lado. Não
 *    é chute: é o `MAP_LAYER_VIEW_LIMIT = 2` do crystalserver
 *    (`src/map/map_const.hpp`), que é o que o servidor de fato manda para o
 *    client em `ProtocolGame::GetMapDescription` — de `z - 2` a `z + 2` quando
 *    `z > MAP_INIT_SURFACE_LAYER` (7). Ao ar livre o alcance é outro: do andar
 *    em que se está até o 0, que é o que faz a montanha aparecer por cima do
 *    acampamento. (O piso do subterrâneo é o andar 2, e não o 8 — ver a nota
 *    do `PISO_SUBTERRANEO`, que é onde essa conta foi corrigida.)
 *
 * 2. A COBERTURA. Dentro do alcance, o que decide é se há teto sobre a cabeça
 *    do personagem. O client varre as casas em volta dele subindo andar por
 *    andar; achando chão em cima, para ali — o que está acima de um teto não se
 *    vê, e é isso que impede o andar de cima de cobrir quem está embaixo dele.
 *
 *    A varredura tem uma sutileza que parece erro de digitação e não é: além da
 *    casa logo acima (`x, y, z-1`), ela olha a casa acima E na diagonal
 *    (`x+1, y+1, z-1`). É o `coveredUp` do client, e existe porque o Tibia
 *    desenha em perspectiva: o chão do andar de cima aparece deslocado meio
 *    tile para baixo e para a direita, então quem cobre o que você vê não é só
 *    quem está exatamente sobre você.
 *
 * ---- O que "tem chão" quer dizer aqui ----
 *
 * No client a conta é do `Tile::limitsFloorsView`: a casa limita a vista se o
 * primeiro item dela é chão, ou se é um item de fundo que barra o tiro. No mapa
 * exportado por este projeto as duas viram a mesma pergunta — uma casa ou tem
 * pilha (chão, e o que estiver em cima dele) ou está vazia, e vazia é buraco.
 * É a mesma conta que o `camadasDeFundo` já faz para o andar de baixo: "casa
 * sem pilha é buraco". Por isso o módulo pede uma função `temChao(z, x, y)` e
 * não conhece o formato do mapa.
 *
 * `deixaVer(z, x, y)` é o `isLookPossible`: a casa não barra o tiro (no
 * exportado, `opaque` zerado). Ela decide se as casas AO LADO do personagem
 * entram na varredura — de dentro de uma parede não se enxerga em volta.
 *
 * ---- De onde veio cada número ----
 *
 * O alcance de dois andares está conferido na fonte, no crystalserver, e o
 * caminho está escrito acima. A regra da cobertura NÃO está: ela mora no
 * client (`MapView::calcFirstVisibleFloor`), e o código do Draevor OTC não viaja
 * com este projeto — só os dados dele (`assets-client/1524`). O que está aqui
 * reproduz o comportamento dele: dentro de caverna não se vê o nível de cima,
 * e por um buraco no teto se vê. Quem tiver o código do client à mão, confira
 * contra ele; o `tools/test-teto.mjs` é onde a regra está escrita caso a caso.
 *
 * A regra é conservadora de propósito: na dúvida ela responde "tem teto", e
 * teto quer dizer não desenhar nada por cima do personagem. O defeito que ela
 * evita é o pior dos dois — o jogador sumir debaixo do chao do andar de cima.
 */

/** `MAP_INIT_SURFACE_LAYER` do crystalserver: o nível do mar. */
export const ANDAR_DO_MAR = 7;

/** `MAP_LAYER_VIEW_LIMIT` do crystalserver: dois andares de vista, para cada lado. */
export const ALCANCE_SUBTERRANEO = 2;

/*
 * ---- O piso da vista debaixo da terra ----
 *
 * `m_mapUndergroundFloorRange` do client, e vale **2** — um número de ANDAR, e
 * não uma distância. A conta dele é
 *
 *     firstFloor = max(z - awareUndergroundFloorRange, undergroundFloorRange)
 *                = max(z - 2, 2)
 *
 * Aqui estava `max(z - 2, 8)`, com um comentário afirmando que de z=8 não se vê
 * a superfície. Não é o que o client faz: de z=8 ele chega ao andar 6, e é a
 * varredura de teto — e só ela — que decide se algo de lá aparece. Com o piso
 * em 8, `primeiro` nunca ficava menor que `z` numa caverna, a varredura era
 * ignorada e NENHUM andar de cima era desenhado nunca debaixo da terra.
 *
 * Conferido no fonte que o dono usa como base:
 * `src/client/gameconfig.h` (`m_mapUndergroundFloorRange{ 2 }`) e
 * `src/client/mapview.cpp` (`MapView::calcFirstVisibleFloor`).
 */
export const PISO_SUBTERRANEO = 2;

/**
 * O andar mais alto que ainda deve ser desenhado, estando em `z, x, y`.
 *
 * Devolve o próprio `z` quando há teto — o caso comum dentro de uma caverna, e
 * o que faz a regra ser segura: na dúvida, não se desenha nada por cima do
 * personagem. Devolve menos que `z` só onde existe buraco no teto, que é
 * justamente onde o Tibia mostra o nível de cima.
 */
export function primeiroAndarVisivel({ z, x, y, temChao, deixaVer }) {
  /*
   * ---- Onde a vista começa, antes de olhar o teto ----
   *
   * Debaixo da terra: dois andares acima, com piso no andar 2. É o
   * `max(z - 2, 2)` do client — o segundo termo quase nunca morde, e quem
   * decide de fato o que aparece é a varredura de teto logo abaixo.
   *
   * Já foi `max(z - 2, 8)` aqui, por leitura errada do `undergroundFloorRange`
   * (que é um número de andar, e não uma distância). Com aquele piso, debaixo
   * da terra `primeiro` nunca ficava menor que `z`: a varredura não chegava a
   * rodar e nenhum andar de cima era desenhado em caverna nenhuma.
   *
   * Ao ar livre (z <= 7): a vista vai até o andar 0. É o que faz a montanha
   * aparecer por cima do acampamento, e o telhado por cima de quem entra na
   * casa — quando há telhado, a varredura abaixo o encontra e a vista para
   * nele.
   */
  let primeiro = z > ANDAR_DO_MAR ? Math.max(z - ALCANCE_SUBTERRANEO, PISO_SUBTERRANEO) : 0;

  for (let ix = -1; ix <= 1 && primeiro < z; ix++) {
    for (let iy = -1; iy <= 1 && primeiro < z; iy++) {
      /*
       * A casa do personagem sempre entra; as dos lados só se der para enxergar
       * daqui até lá. As diagonais não entram nunca — `abs(ix) != abs(iy)` é o
       * que sobra depois de tirar o centro e os quatro cantos.
       */
      const noCentro = ix === 0 && iy === 0;
      if (!noCentro && !(Math.abs(ix) !== Math.abs(iy) && deixaVer(z, x + ix, y + iy))) continue;

      // Sobe andar por andar a partir daqui, olhando as duas casas que podem
      // cobrir: a de cima e a de cima na diagonal.
      let cx = x + ix;
      let cy = y + iy;
      let cz = z;
      for (;;) {
        cz -= 1;
        cx += 1;
        cy += 1;
        if (cz < primeiro) break;
        // A casa acima e na diagonal (`coveredUp`), e a casa logo acima.
        if (temChao(cz, cx, cy) || temChao(cz, x + ix, y + iy)) {
          primeiro = cz + 1;
          break;
        }
      }
    }
  }
  return primeiro;
}

/**
 * A mesma regra, já ligada ao mapa de uma hunt exportada.
 *
 * O desenho (`camadasDeTeto`, no cliente) e o teste (`tools/test-teto.mjs`)
 * precisam da MESMA fiação entre o arquivo e a regra — que casa conta como
 * chão, que casa deixa ver. Duas fiações parecidas dariam um teste que confere
 * uma coisa e um jogo que faz outra, e o defeito só apareceria na tela.
 */
export function primeiroAndarDoMapa(map, z, x, y) {
  const largura = map.width;
  const dentro = (px, py) => px >= 0 && py >= 0 && px < largura && py < map.height;

  return primeiroAndarVisivel({
    z,
    x,
    y,
    /*
     * Casa com pilha é chão; casa vazia é buraco. É a mesma conta que as
     * camadas de baixo já fazem para saber por onde se enxerga o andar
     * seguinte.
     *
     * Andar que não está no arquivo responde "sem chão" — e não há o que
     * desenhar dele de qualquer jeito, então a resposta dá no mesmo.
     */
    temChao: (andar, px, py) =>
      dentro(px, py) && (map.floors?.[andar]?.stacks?.[py * largura + px]?.length ?? 0) > 0,
    // Barrar o tiro é o `opaque` do recorte: o mesmo número que o servidor usa
    // para saber se dá para acertar alguém dali.
    deixaVer: (andar, px, py) => dentro(px, py) && !map.floors?.[andar]?.opaque?.[py * largura + px],
  });
}

/**
 * As camadas de teto a desenhar, do andar mais fundo para o mais alto.
 *
 * Cada uma diz QUAL andar e com que DESLOCAMENTO ele entra na tela:
 *
 *   `andar`         o índice em `map.floors`;
 *   `deslocamento`  quantas casas somar ao ler a pilha. A casa que na tela
 *                   mostra `x, y` do andar em que se está mostra `x+1, y+1` do
 *                   andar de cima.
 *
 * O deslocamento não é enfeite, e não é chute: é o `offset` do
 * `ProtocolGame::GetMapDescription` do crystalserver, que descreve o andar `nz`
 * a partir de `x + offset`, com `offset = z - nz`
 * (`src/server/network/protocol/protocolgame.cpp`). É a mesma diagonal do
 * `coveredUp` da regra acima, vista do lado do desenho: o Tibia mostra o andar
 * de cima meio tile para baixo e para a direita, então ler a casa `x+1, y+1` é
 * o que faz a pedra de cima cair em cima da parede que a sustenta.
 *
 * A ordem é a do client (`for z = último até primeiro`): o andar mais fundo
 * primeiro, e o mais alto por cima dele.
 *
 * > As camadas de BAIXO (`camadasDeFundo`, no cliente) passaram a usar o mesmo
 * > `offset`, com o sinal trocado: `-1` por andar de profundidade. Esta nota
 * > dizia que elas não o usavam e que consertar pediria reexportar as hunts —
 * > não pedia. O recorte é gravado alinhado casa a casa, e quem desloca é o
 * > desenho, dos dois lados.
 * >
 * > O que a dívida custava estava na cidade: de pé na rua o telhado do sobrado
 * > aparecia em `x+1, y+1` (certo), e de pé NO sobrado o chão da rua aparecia
 * > em `x, y`. Subir a escada mudava a cidade de lugar por uma casa.
 */
export function camadasAcima(map, z, x, y) {
  const primeiro = primeiroAndarDoMapa(map, z, x, y);
  const camadas = [];
  for (let andar = z - 1; andar >= primeiro; andar--) {
    if (map.floors?.[andar]?.stacks) camadas.push({ andar, deslocamento: z - andar });
  }
  return camadas;
}

/*
 * ---- E a outra ponta: até que andar ABAIXO a tela mostra ----
 *
 * O módulo começou respondendo só pelo teto, porque era ali que estava o
 * defeito da vez. O piso tinha a resposta escrita em dois lugares, e nos dois
 * como um número solto: `FUNDOS_VISIVEIS = 4` no exportador e um `4` no
 * `camadasDeFundo` do cliente. Quatro nunca foi uma leitura da base — foi o
 * número que resolveu o acampamento das amazonas, onde dois não bastava.
 *
 * A regra da base é esta, e é a mesma que decide o que o servidor manda para o
 * client (`Game::updateSpectatorsVision`, `src/game/game.cpp`, e o
 * `ProtocolGame::GetMapDescription` que ela acompanha):
 *
 *     if (z > MAP_INIT_SURFACE_LAYER) {         // debaixo da terra
 *       visibleMinZ = z - MAP_LAYER_VIEW_LIMIT; // dois para cima
 *       visibleMaxZ = min(MAP_MAX_LAYERS - 1, z + MAP_LAYER_VIEW_LIMIT);
 *     } else {                                  // ao ar livre
 *       visibleMinZ = 0;
 *       visibleMaxZ = MAP_INIT_SURFACE_LAYER;   // ate' o nivel do mar
 *     }
 *
 * Ou seja: numa caverna a vista desce DOIS andares, e nem um a mais — o quatro
 * do exportador estava gastando arquivo com dois andares que ninguém vê (foi
 * medido: nenhuma casa de nenhuma hunt deixava de ser preta por causa da
 * terceira ou da quarta camada debaixo da terra).
 *
 * Ao ar livre a vista desce até o nível do mar, e é aqui que os quatro faltavam.
 * Em cima da muralha de Zao a rota anda no z1: do z1 até o chão da cidade são
 * SEIS andares, e com quatro o jogador via 41% da tela preta. Não é um caso
 * exótico — é toda hunt de plataforma, torre ou muralha, e é exatamente por
 * onde o dono passou.
 *
 * Repare que a conta ao ar livre não é uma distância fixa: do z6 é um andar, do
 * z1 são seis. É por isso que ela não podia ser uma constante.
 */

/** `MAP_MAX_LAYERS - 1` do crystalserver: o andar mais fundo que existe. */
export const ANDAR_MAIS_FUNDO = 15;

/**
 * O andar mais fundo que a tela mostra, estando em `z`.
 *
 * Debaixo da terra, dois abaixo. Ao ar livre, o nível do mar — e estando NELE
 * (z=7), nada abaixo: de cima da grama não se vê a caverna.
 */
export function ultimoAndarVisivel(z) {
  return z > ANDAR_DO_MAR ? Math.min(ANDAR_MAIS_FUNDO, z + ALCANCE_SUBTERRANEO) : ANDAR_DO_MAR;
}

/**
 * Quantos andares abaixo de `z` entram na tela. Zero é resposta legítima: é o
 * que a superfície responde.
 */
export const andaresAbaixo = (z) => Math.max(0, ultimoAndarVisivel(z) - z);
