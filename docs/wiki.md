# Wiki do Draevor — como escrever artigos e usar imagens

Endereços: `/wiki` (início) e `/wiki/<artigo>`. Arquivos: `game/frontend/wiki.html`, `game/frontend/client/site/wiki.mjs` (artigos e blocos), `wiki.css`, dados em `game/systems/wiki.mjs` (`/api/wiki/itens`).

## Situação do "editor"
**Não existe editor de conteúdo da wiki.** O `editor-conteudo` do projeto é das fases/encontros (não tem relação com a wiki). Hoje cada artigo é código em `ARTIGOS` (`wiki.mjs`), montado com blocos. Um editor com upload de imagem seria infraestrutura nova (tabela, rota de escrita trancada, armazenamento); fica como próxima etapa, se for desejado.

## Blocos disponíveis
`h2(titulo, id)` · `p` e `rico` (**negrito**, links internos `[texto](/wiki/artigo)` ou `[texto](#secao)` — só links da wiki) · `lista` · `aviso(texto, verde?)` · `exemplo(titulo, ...paragrafos)` · `tabela(cabecalhos, linhas, opcoes)` · `figura`, `figuraDeItens`, `figuraDePeca` · "Veja também" (campo `relacionados: ['slug']` do artigo).

Tabelas: rolam dentro da própria caixa (com sombra nas bordas quando há mais conteúdo e foco por teclado); `cartoes: true` transforma cada linha em um cartão quando a tela é estreita (até 1100 px), sem perder coluna. Colunas de texto quebram linha; só número fica `nowrap`.

## Imagens
- Arquivos em `game/frontend/client/assets/wiki/` (URL `/client/assets/wiki/<nome>.webp`), ou qualquer arquivo já existente em `/client/assets/`. **Só caminhos de `/client/assets/` são aceitos** (nada de URL externa).
- `figura({ src, alt, legenda?, largura: 'p'|'m'|'g', alinhar: 'centro'|'esquerda'|'direita', w, h, ampliar })`. `alt` é obrigatório (sem ele a figura não aparece); informe `w` e `h` para o layout não pular; clicar amplia (janela com a imagem inteira).
- Formato e tamanho: WebP, no máximo ~1200 px de largura e ~150 KB (o jogo já usa `.webp`); imagens grandes são limitadas a 560 px de altura no artigo e mostradas inteiras no zoom. Carregam sob demanda (`loading="lazy"`).
- `figuraDeItens`: desenha sprites **reais** do atlas do jogo (o índice de sprites só é baixado quando a figura chega perto da tela).
- Só use imagem que explique o texto: se não houver uma apropriada, o artigo fica sem.

## Teste de layout
`/wiki/layout` é um artigo oculto (não aparece no índice) com tabela larga, imagens de todos os tamanhos e alinhamentos, lista, blocos e texto sem espaços. O teste em navegador: `node tools/testar-wiki-responsiva.mjs <urlBase>` (precisa de `playwright-core` e Chromium; confere 320 a 1920 px: a página não rola para o lado, nada passa da coluna do artigo, imagens sem distorção).
