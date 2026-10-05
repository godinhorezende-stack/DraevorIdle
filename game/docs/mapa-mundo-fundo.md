# Imagem de fundo do mapa mundo, por Ato

Engine › **Mapa do mundo** › escolha o Ato › bloco **Imagem de fundo do Ato**: carregar, ver a prévia, **Salvar imagem neste Ato** ou **Remover imagem**.
- Aceita PNG, JPG ou WEBP (conferido pela assinatura do arquivo), até 3 MB, 200–4096 px por lado; a tela do mapa é 1000×640 (proporção muito diferente gera aviso: a imagem cobre a tela e o excesso é cortado).
- Salvar grava `gamedata/mapa-mundo/ato-<n>-<hash>.<ext>` (pública, vai no Git) e a referência em `atos[n].fundo` de `campanha-conteudo.json`. Trocar apaga a imagem anterior do Ato; o hash no nome evita cache velho.
- No jogo (tela WORLD) a imagem cobre o mapa do Ato no lugar do fundo desenhado; os nós e estradas ficam por cima. Sem imagem, o fundo de sempre. A imagem salva **imediatamente** em disco (não espera o botão de salvar do mapa); para valer na produção: commit + deploy (o conteúdo da campanha é lido no boot: reinicie o servidor local para ver).
- Só local: em produção a tela é somente leitura. Testes: `testes/mapa-fundo.test.mjs`.
