# Missões do PoE no jogo (05/11/2026)

Pedido do dono: conferir se todas as missões e os itens de missão de https://poedb.tw/pt/Quest estão no jogo e implementar o que falta, no lugar das Tasks.

## Decisões do dono (05/11)

- **Tela:** as missões **substituem a aba Tasks** da janela Tarefas. No jogo do PoE, a primeira aba passa a ser "Missões" e o botão da gaveta muda de nome. O clássico continua com as Tasks.
- **Missões do Atlas:** entram agora, ligadas ao endgame de mapas.
- **Missões de liga:** entram também, mesmo sem a mecânica. O que não tem caminho no jogo fica marcado "sem caminho", com o motivo.
- **Sem perguntar** (regra do PoE no jogo do PoE): os pontos de passiva dos Livros de Habilidade, a escolha dos Bandidos e os itens de missão com ícone.
- **Testes:** os 5 testes de pontos de passiva passam a criar o personagem sem as missões da campanha (aval do dono, 05/11). Eles contam só os pontos do level, e os pontos das missões têm o teste próprio.

## O que existia antes

- 71 das 103 missões da campanha, só como texto nos objetivos das fases. O texto vinha da coleção do Drive e nada concluía missão nenhuma.
- As 14 missões de gema (`missoes-de-gemas.json`). Continuam iguais.
- 16 itens de missão, sem ícone, que caem dos monstros alvo (`itens-de-missao.json`).

## O que entrou

| Parte | Onde |
|---|---|
| A página do poedb e as 353 páginas de missão e de item | `/home/deploy/scrapling/saida/html/missoes/` (fora do repositório) |
| Importador do poedb: as 194 missões com os passos, os 244 itens, as recompensas por classe, o vendedor e os 52 bônus | `game/tools/importar-missoes-poedb.mjs` → `gamedata/itens-poe/missoes-poedb.json` |
| Gerador do registro: liga cada missão a uma fase, a um chefe, a um mapa ou a um pináculo, e junta as recompensas e os itens | `game/tools/montar-missoes-poe.mjs` → `gamedata/itens-poe/missoes.json`, `missoes-itens-ids.json` |
| Ícones dos 244 itens e das missões (PNG 64×64; 302 de 311 baixados) | `gamedata/itens-poe/icones-itens/poe-itens/Missoes/` |
| O sistema no servidor | `game/systems/itens-poe/missoes.mjs` |
| A aba Missões (lista, detalhe, filtros por ato e por estado) | `frontend/client/src/aba-missoes.mjs`, `panels.mjs` (`openQuests`), `main.mjs`, `style.css` |
| O balão do item de missão: as linhas do poedb, o texto de sabor e a missão | `frontend/client/src/tooltip.mjs` |
| Teste | `game/testes/missoes-poe.test.mjs` |

## Como funciona

- **Conclusão:** vem do que o personagem já fez, sem gravar nada para concluir. Por isso vale também para quem já tinha jogado.
  - **Campanha:** a fase do gatilho completa ou o chefe do ato vencido, em qualquer dificuldade. A fase do gatilho é a mais adiante entre as áreas dos passos do poedb. Oito missões têm o gatilho corrigido à mão (`GATILHOS` no gerador).
  - **Bandidos:** as três fases deles (Ponte Quebrada, Floresta Ocidental e Terras Inundadas) completas. Depois o jogador escolhe uma vez, na aba: matar os três (`Lidando com os Bandidos`) ou ajudar um deles.
  - **Atlas:**
    - Uma Mobilização e O Atlas dos Mundos: o primeiro mapa concluído.
    - A Maven, O Jogo da Maven, O Ancião, O Devorador e O Exarca: o pináculo vencido. Fica gravado a partir de 05/11 em `estado.missoes.pinaculos`.
    - Segmentos da Originadora: os 4 mapas únicos Memória Distante, gravados em `estado.missoes.unicos`.
  - **Sem caminho (93):**
    - 91 de liga (Heist, Sanctum, Sentinel, Kingsmarch, Chayula…);
    - o Labirinto;
    - o Esconderijo.
- **Recompensas:**
  - **Pontos de Habilidade Passiva:** as missões concluídas somam no total da árvore (`passivas/arvore.mjs`, `pontos` e `pontosSe`). São 23 na campanha, mais o dos Bandidos se o jogador matar os três.
  - **Bônus dos Bandidos:**
    - Kraityn: 8% de Velocidade de Movimento;
    - Alira: +15% de todas as Resistências Elementais;
    - Oak: +40 de Vida.
    - Entram nos efeitos da árvore, com a fonte "Missão: …".
  - **Penalidade de resistência do Kitava:** a ficha já aplica ao vencer o chefe. A aba só mostra.
  - **Pontos de Restituição:** aparecem, mas não têm efeito, porque no jogo do PoE o respec é grátis (dono, 09/10).
  - **Escolha de um item:** gema, moeda ou base Normal, na aba, uma vez por missão. As gemas por classe continuam na janela das missões de gema, que a aba também abre.
- **Itens de missão:** os 244 entram no catálogo com o ícone. Os 16 que já existiam mantêm o id e o drop, e ganham o ícone. Os novos não caem na mochila: a aba mostra os de cada missão. Assim a bolsa não enche, e nenhum item precisa ser apagado depois.

## Pontos em aberto

- **Bandidos, "matar os três":** o poedb dá 1 Ponto de Habilidade Passiva (`Missão Stats`). O jogo segue o poedb.
- **Pináculos:** continuam exigindo level 250 (`pinaculos.mjs`), então as missões deles ficam inalcançáveis até essa trava ser decidida.
- **Missões de gema com item no mesmo prêmio** (O Bruto Enjaulado, Afiado e Cruel…): a gema por classe e a escolha do item são duas recompensas separadas.
- **Ícones:** 9 ícones de missão não existem no poedb nem no CDN oficial. Essas missões aparecem com o ícone do primeiro item, ou com "!".
