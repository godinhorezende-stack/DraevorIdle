/*
 * ---- UMA SEGUNDA TENTATIVA PARA A ARTE QUE O CACHE ENVENENOU ----
 *
 * Medido em 24/09/2026, pedindo de propósito um arquivo que não existe:
 *
 *   GET /client/assets/icons/nao-existe-xyz.png
 *   HTTP/1.1 404 Not Found
 *   Cache-Control: max-age=14400, must-revalidate
 *
 * O 404 vem com QUATRO HORAS de validade. A origem manda `no-cache` (ver o
 * servidor de estáticos no `index.mjs`); quem carimba o `max-age` por cima é o
 * Cloudflare, e ele o faz também na resposta de ERRO.
 *
 * O estrago: quem abre uma tela enquanto um desenho ainda não subiu guarda o
 * 404. A arte entra no ar, o servidor devolve 200 para todo mundo — e aquele
 * navegador não pede de novo, nem com F5, porque para ele a resposta ainda é
 * fresca. O `onerror` já rodou, a imagem já saiu da tela, e o botão fica sem
 * ícone com o arquivo publicado e servindo. Aconteceu em 24/09 com os ícones da
 * loja e do ranking da arena e com o fundo da Livraria de Fogo.
 *
 * O conserto é trocar de ENDEREÇO, não de arquivo: um carimbo na query é uma
 * url nova para o cache (não há entrada velha para reusar) e o mesmo arquivo
 * para o servidor (a query não muda o caminho no disco).
 *
 * ---- POR QUE SÓ UMA VEZ, E SÓ DEPOIS DE FALHAR ----
 *
 * Carimbar sempre custaria uma rebaixada de tudo a cada carga, e o motivo de a
 * arte ser cacheável é justamente esse. Aqui o carimbo só existe no caminho do
 * ERRO: quem está com o cache limpo nunca faz o segundo pedido.
 *
 * E só uma repetição, nunca um laço: um desenho que não existe MESMO tem de
 * terminar em `aoDesistir` — que é o comportamento antigo, tirar a imagem da
 * tela —, e não em pedidos infinitos a um arquivo ausente.
 */

/** A url com um carimbo curto, respeitando uma query que já exista. */
export function comCarimbo(url) {
  return `${url}${url.includes('?') ? '&' : '?'}r=${Date.now().toString(36)}`;
}

/**
 * Põe a `url` na imagem. Falhando, tenta mais UMA vez com carimbo; falhando de
 * novo, chama `aoDesistir` — que por padrão tira a imagem da tela, como antes.
 */
export function arteTeimosa(img, url, aoDesistir) {
  let repetiu = false;
  img.onerror = () => {
    if (repetiu) {
      if (aoDesistir) aoDesistir(img);
      else img.remove();
      return;
    }
    repetiu = true;
    img.src = comCarimbo(url);
  };
  img.src = url;
  return img;
}

/**
 * O mesmo, para um fundo de CSS — que não tem `onerror` nenhum.
 *
 * A prova é uma imagem solta com a MESMA url que a folha vai pedir: quando ela
 * carrega (o caso normal) as duas dividem a mesma entrada do cache e não há
 * pedido a mais; quando ela falha, o fundo é reposto com carimbo.
 */
export function fundoTeimoso(elemento, propriedade, url) {
  elemento.style.setProperty(propriedade, `url('${url}')`);
  /*
   * `document.createElement` e nao `new Image()`: e' o que o resto do cliente
   * usa, e o DOM de mentira dos testes so' conhece este caminho. Um global a
   * menos para faltar em algum lugar.
   */
  const prova = document.createElement('img');
  prova.onerror = () => {
    elemento.style.setProperty(propriedade, `url('${comCarimbo(url)}')`);
  };
  prova.src = url;
}
