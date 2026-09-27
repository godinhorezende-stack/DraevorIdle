/* =========================================================================
 * O BRASÃO DA GUILDA NAS PÁGINAS DO SITE
 *
 * "no site, em ranking, online, top5 level, top exp hoje e na aba de
 *  characters, tem que mostrar a guild atual e o brasão também."
 *
 * São quatro telas com quatro montagens diferentes — uma tabela, uma lista, um
 * cartaz e uma ficha —, e o que elas têm em comum é exatamente isto: um escudo
 * pequeno com o nome da guilda ao lado. Numa função só, para as quatro não
 * divergirem no tamanho, no espaçamento ou no que fazem quando não há guilda.
 *
 * ---- O DESENHO VEM DO MESMO LUGAR DO JOGO ----
 *
 * `desenharBrasao` mora em `packages/shared`, ao lado do catálogo, e é o mesmo
 * que a janela de guildas usa. Não há uma versão de site: a guilda que escolheu
 * um leão dourado tem o mesmo leão dourado nas duas telas, por construção.
 *
 * ---- O ESTILO VIAJA JUNTO, PELA MESMA RAZÃO ----
 *
 * Injetado num `<style>` na primeira vez. Pendurá-lo no `site.css` obrigaria a
 * lembrar dele em cada página nova — e a página que esquecesse mostraria o
 * escudo sem alinhamento nenhum, o que é pior do que não mostrar.
 * ========================================================================= */
import { desenharBrasao, vestirNomeDaGuilda } from '/packages/shared/src/desenhar-brasao.mjs';

const MARCA = 'estilo-do-selo-de-guilda';

const ESTILO = `
.site-guilda {
  display: inline-flex; align-items: center; gap: 5px;
  vertical-align: middle;
  max-width: 100%;
  min-width: 0;
  text-decoration: none;
}
.site-guilda > b {
  font-weight: 600; font-size: 11px; letter-spacing: .01em;
  color: #b9a97e;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: color .12s;
}
.site-guilda:hover > b { color: #ffd98a; text-decoration: underline; }
/* O escudo nunca encolhe: quem cede largura é o nome, que já corta. */
.site-guilda .guilda-brasao { flex: none; }
/*
 * A linha da guilda embaixo do nome, nas telas em que o nome é o assunto (o
 * ranking, o online, o top 5). Ela é MENOR e mais apagada de propósito: quem lê
 * a tabela procura o nome da pessoa, e a guilda é a segunda pergunta.
 */
.site-guilda-linha { display: flex; align-items: center; margin-top: 2px; min-width: 0; }
.site-guilda-linha .site-guilda > b { font-size: 10.5px; }
`;

function garantirEstilo() {
  if (document.getElementById(MARCA)) return;
  const folha = document.createElement('style');
  folha.id = MARCA;
  folha.textContent = ESTILO;
  document.head.append(folha);
}

/**
 * O escudo mais o nome da guilda, ou `null` quando a pessoa nao tem guilda.
 *
 * Devolver `null` — e não uma caixa vazia — é o que deixa quem chama escrever
 * `if (selo) celula.append(selo)`: sem guilda, a linha fica exatamente como era
 * antes desta coluna existir, sem um espaço reservado para nada.
 *
 * ---- POR QUE O PADRAO E' 18, E NAO 12 ----
 *
 * "no Top 5 da home o brasão está com ~12px, desenhado completo, e quase não
 *  aparece."
 *
 * A doze pixels o escudo cheio nao encolhe: ele vira media. O simbolo ocupa quatro
 * pixels, as duas iniciais um traco de um pixel cada, e o degrade de um efeito pago
 * soma tudo num cinza. Dezoito ja' esta' ABAIXO do corte do modo icone (20), e por
 * isso o desenhista troca sozinho para o desenho simplificado — cor chapada, simbolo
 * grande e um contorno escuro que separa o escudo do fundo da tabela.
 *
 * Quem quiser o desenho cheio pede um tamanho acima de 20 (a ficha do personagem
 * pede 32). A regra e' do desenhista e nao desta funcao: um `icone: true` escrito
 * aqui seria um segundo lugar decidindo o mesmo, e um dia os dois discordariam.
 */
export function seloDaGuilda(guilda, tamanho = 18) {
  if (!guilda?.nome) return null;
  garantirEstilo();

  /*
   * ---- E' UM LINK PARA A PAGINA DA GUILDA ----
   *
   * "na aba characters, onde mostra a guild da pessoa, ao clicar na guild dela
   *  tem que levar pra pagina da guilda."
   *
   * Vale para os quatro lugares em que este selo aparece — ranking, online,
   * top 5 e a ficha do personagem — porque e' a mesma peca nos quatro. Um link
   * so' na ficha seria um escudo clicavel numa tela e morto nas outras tres.
   */
  const caixa = document.createElement('a');
  caixa.className = 'site-guilda';
  caixa.href = `/guildas?nome=${encodeURIComponent(guilda.nome)}`;
  caixa.title = `Guilda: ${guilda.nome}`;
  caixa.append(desenharBrasao(document, guilda.nome, tamanho, guilda.brasao ?? null));

  const nome = document.createElement('b');
  nome.textContent = guilda.nome;
  /*
   * ---- O NOME NA FONTE QUE A GUILDA ESCOLHEU ----
   *
   * "onde o nome da guilda aparece com a fonte: (...) e site (/guildas, ficha da
   *  guilda, Top 5, ranking, online, ficha do personagem)."
   *
   * Este selo E' quatro desses cinco lugares — e' o mesmo no' nas quatro telas do
   * site. Vesti-lo aqui e' vestir as quatro de uma vez, e e' o motivo de este
   * arquivo existir.
   *
   * As seis familias nao baixam nada em nenhuma pagina: Cinzel e Cinzel Decorative
   * ja' vem no `<link>` de toda pagina do site, e as outras quatro sao pilhas do
   * sistema (Georgia, Segoe UI, Impact, monoespacada). Ver `FONTES`, no catalogo.
   */
  vestirNomeDaGuilda(nome, guilda.brasao ?? null);
  caixa.append(nome);
  return caixa;
}

/** O mesmo selo, embrulhado na linha de baixo — para as tabelas de nome. */
export function linhaDaGuilda(guilda, tamanho = 18) {
  const selo = seloDaGuilda(guilda, tamanho);
  if (!selo) return null;
  const linha = document.createElement('div');
  linha.className = 'site-guilda-linha';
  linha.append(selo);
  return linha;
}
