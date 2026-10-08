# Matriz dos testes

Gerada por `npm run test:auditoria` (2026-10-08 22:19). Estratégia: [testes-por-nivel.md](testes-por-nivel.md).

- **Arquivos de teste:** 368 (250 do jogo oficial + 118 irmãos `.classico`).
- **Soma dos tempos por arquivo:** 27.7 min (cada arquivo num processo); base: `base-medicao-inicial.json` (3559 testes, parede 10.5 min). Boot × testes medido em 58 arquivos (as rodadas com o coletor atual): BOOT 1.5 min + TESTS 1.0 min.
- **Rodam isolados:** 367 de 368 passaram sozinhos na rodada isolada; falharam uma vez: loot-moeda (intermitente: passou em todas as repetições seguintes — ver testes-por-nivel.md).

## Por sistema

| Sistema | Arquivos | Tempo somado (s) |
|---|---:|---:|
| `gemas` — Gemas e habilidades | 53 | 139.5 |
| `itens` — Itens, mochila e equipamento | 77 | 367.0 |
| `combate` — Combate e dano | 66 | 168.8 |
| `campanha` — Campanha, atos, chefes e encontros | 52 | 202.3 |
| `cacada` — Caçada (tique, movimento, instância, mapa) | 44 | 154.4 |
| `offline` — Caçada offline e Server Save | 13 | 237.9 |
| `party` — Party | 20 | 160.0 |
| `sessao` — Sessão e WebSocket | 33 | 134.3 |
| `banco` — Banco e persistência | 16 | 207.0 |
| `cliente` — Cliente (frontend) e estáticos | 30 | 62.9 |
| `editor` — Engine (editores), overrides e operação | 55 | 308.3 |
| `loot` — Loot e filtro de loot | 24 | 100.8 |
| `social` — Site, guildas, chat, arena e loja | 22 | 45.2 |
| `progressao` — Progressão do personagem (árvore, passivas, classes, XP) | 33 | 105.4 |

## Por dependência

| Dependência | Arquivos |
|---|---:|
| jogo inteiro | 283 |
| SQLite dev | 85 |
| SQLite próprio | 4 |
| Postgres | 5 |
| Redis | 1 |
| servidor HTTP | 20 |
| sessão/WS | 70 |
| cliente | 74 |
| temporários | 52 |
| git | 15 |
| workers/processos | 30 |
| shell | 2 |
| estado global | 47 |
| env | 60 |
| modo clássico | 118 |

## TOP 20 — os arquivos mais lentos

Tempo = parede do arquivo na FULL (BOOT = carga do jogo no processo; TESTES = os testes em si). Nenhum foi mudado, pulado ou ganhou timeout: é o diagnóstico.

| # | Arquivo | Total (s) | Boot (s) | Testes (s) | Nº testes | Dependências | Motivo provável | Dá para otimizar? | Deve continuar pesado? |
|---:|---|---:|---:|---:|---:|---|---|---|---|
| 1 | `validacao.test.mjs` | 112.5 | — | — | 9 | cliente, temporários, git, workers/processos, env | V5 e V6 sobem o validador da Engine de verdade: um processo à parte carrega o jogo do disco e roda `node --test` em arquivos escolhidos | sim — o V6 pode reaproveitar a rodada do V5 (as duas carregam o jogo do zero) | em parte: é integração de verdade |
| 2 | `itens-poe-jogo.test.mjs` | 85.2 | — | — | 15 | jogo inteiro, env | um teste gera milhares de peças para provar que o bicho de nível 11 só solta mod de iLvl ≤ 11 | sim — sorteio com semente (`mulberry32`) e amostra menor com o mesmo rigor | não |
| 3 | `server-save.classico.test.mjs` | 69.4 | — | — | 56 | jogo inteiro, SQLite dev, SQLite próprio, workers/processos, modo clássico | carga por desenho: P2 com 5.000 créditos pendentes, P1 com 1.500 ausentes e 400 conectados (o irmão clássico: o mesmo arquivo no outro modo) | P1/P2 poderiam rodar só no oficial (o irmão clássico repete a carga) — decisão do dono | sim: mede o laço sob carga |
| 4 | `server-save.test.mjs` | 66.1 | — | — | 56 | jogo inteiro, SQLite dev, SQLite próprio, workers/processos | carga por desenho: P2 com 5.000 créditos pendentes, P1 com 1.500 ausentes e 400 conectados | P1/P2 poderiam rodar só no oficial (o irmão clássico repete a carga) — decisão do dono | sim: mede o laço sob carga |
| 5 | `itens-poe-pools.test.mjs` | 32.0 | — | — | 4 | jogo inteiro | "drop de verdade": muitas mortes para provar que nenhum Raro sai sem mod | sim — semente fixa e amostra menor | não |
| 6 | `party-limite.classico.test.mjs` | 26.9 | — | — | 28 | jogo inteiro, SQLite dev, sessão/WS, estado global, modo clássico | cinco jogadores na mesma caçada, tique a tique (colisão, ninguém preso) (o irmão clássico: o mesmo arquivo no outro modo) | pouco | sim: é gameplay de party de verdade |
| 7 | `itens-poe-gemas.test.mjs` | 26.3 | 2.3 | 23.9 | 20 | jogo inteiro, env | o drop do PoE amostrado (as gemas do Draevor fora) e o catálogo das 562 gemas | em parte — amostra com semente | em parte |
| 8 | `consolidacao-offline.classico.test.mjs` | 23.4 | — | — | 28 | jogo inteiro, SQLite dev, sessão/WS, workers/processos, estado global, modo clássico | a caçada offline consolidada em worker, com o banco (o irmão clássico: o mesmo arquivo no outro modo) | pouco | sim: é o offline de verdade |
| 9 | `party-limite.test.mjs` | 22.5 | — | — | 28 | jogo inteiro, SQLite dev, sessão/WS, estado global | cinco jogadores na mesma caçada, tique a tique (colisão, ninguém preso) | pouco | sim: é gameplay de party de verdade |
| 10 | `git-integracao.test.mjs` | 20.1 | — | — | 10 | cliente, temporários, git, workers/processos, env | repositórios git reais numa pasta temporária | não | sim: é integração com o git |
| 11 | `encontros-etapa6.test.mjs` | 19.4 | — | — | 16 | jogo inteiro, temporários, workers/processos | carga: 150 caçadas simultâneas com cinco encontros cada | não sem perder a medida | sim: mede o custo |
| 12 | `simulacao-offline.classico.test.mjs` | 19.1 | — | — | 8 | jogo inteiro, SQLite dev, sessão/WS, workers/processos, modo clássico | a caçada offline numa thread à parte, 30 min tique a tique (o irmão clássico: o mesmo arquivo no outro modo) | pouco | sim |
| 13 | `git-envio.test.mjs` | 17.3 | — | — | 8 | cliente, temporários, git, workers/processos, env | repositórios git reais (envio das alterações do dono) | não | sim |
| 14 | `encontros-etapa6.classico.test.mjs` | 15.8 | — | — | 16 | jogo inteiro, temporários, workers/processos, modo clássico | carga: 150 caçadas simultâneas com cinco encontros cada (o irmão clássico: o mesmo arquivo no outro modo) | não sem perder a medida | sim: mede o custo |
| 15 | `hot-reload-cliente.test.mjs` | 15.5 | — | — | 3 | cliente | HC2 (o renderer do cliente) leva ~15 s sozinho | provável — a investigar (espera de temporizador num teste de renderer) | não |
| 16 | `progressao.classico.test.mjs` | 14.8 | — | — | 36 | jogo inteiro, cliente, temporários, git, workers/processos, env, modo clássico | as curvas de experiência e as recompensas simuladas nível a nível (o irmão clássico: o mesmo arquivo no outro modo) | em parte | em parte |
| 17 | `biblioteca.test.mjs` | 14.7 | — | — | 26 | jogo inteiro, env | L5 varre o catálogo inteiro procurando referência quebrada | pouco | sim: é auditoria do conteúdo inteiro |
| 18 | `personagens-legado.test.mjs` | 14.1 | — | — | 12 | jogo inteiro, SQLite dev, servidor HTTP, sessão/WS, workers/processos, env | contas e personagens no banco, entrada pela sessão de verdade | pouco | sim |
| 19 | `loot-curva.test.mjs` | 13.6 | — | — | 10 |  | a curva global de loot amostrada por faixa de nível | sim — semente fixa | não |
| 20 | `party-follow-independente.test.mjs` | 12.8 | — | — | 34 | jogo inteiro, SQLite dev, sessão/WS, cliente | party com sessões reais, follow e reagrupamento tique a tique | pouco | sim |

## Todos

| Teste | Sistema | Tempo (s) | Boot (s) | Testes | Dependências | Pode rodar isolado? |
|---|---|---:|---:|---:|---|---|
| `acesso` | editor | 0.4 | — | 11 | servidor HTTP, cliente, temporários | sim |
| `agua.classico` | cacada | 8.4 | — | 6 | jogo inteiro, modo clássico | sim |
| `agua` | cacada | 2.8 | — | 6 | jogo inteiro | sim |
| `alvo-mais-perto` | cacada | 3.2 | — | 2 | jogo inteiro | sim |
| `amigos.classico` | social | 0.9 | — | 8 | SQLite dev, modo clássico | sim |
| `amigos` | social | 0.9 | — | 8 | SQLite dev | sim |
| `andar-por-clique.classico` | cacada, sessao, cliente | 1.3 | — | 28 | jogo inteiro, SQLite dev, sessão/WS, estado global, modo clássico | sim |
| `andar-por-clique` | cacada, sessao, cliente | 4.3 | — | 28 | jogo inteiro, SQLite dev, sessão/WS, estado global | sim |
| `andar` | cacada, sessao | 3.8 | — | 2 | jogo inteiro, SQLite dev, sessão/WS, estado global | sim |
| `andares.classico` | cacada, sessao | 2.8 | — | 14 | jogo inteiro, modo clássico | sim |
| `andares` | cacada, sessao | 3.3 | — | 14 | jogo inteiro | sim |
| `anuncios` | loot, social | 0.5 | — | 3 | — | sim |
| `apagar-arquivados` | banco, editor | 0.6 | — | 1 | SQLite dev, SQLite próprio, temporários, workers/processos, env | sim |
| `aquecer-grades` | cacada | 5.2 | — | 3 | — | sim |
| `areas.classico` | combate | 1.5 | — | 22 | jogo inteiro, sessão/WS, modo clássico | sim |
| `areas` | combate | 3.1 | — | 22 | jogo inteiro, sessão/WS | sim |
| `arena.classico` | social | 1.3 | — | 10 | jogo inteiro, SQLite dev, modo clássico | sim |
| `arena` | social | 4.4 | — | 10 | jogo inteiro, SQLite dev | sim |
| `arma-base.classico` | itens | 0.8 | 0.1 | 18 | cliente, temporários, env, modo clássico | sim |
| `arma-base` | itens | 0.9 | 0.1 | 18 | cliente, temporários, env | sim |
| `arma-elemental` | combate | 3.6 | — | 3 | jogo inteiro, estado global | sim |
| `artes-em-dia` | cliente | 0.1 | — | 2 | cliente | sim |
| `arvore` | progressao | 3.2 | — | 10 | jogo inteiro | sim |
| `ataque-do-mob` | combate | 3.4 | — | 8 | jogo inteiro, estado global | sim |
| `atos-armazem.classico` | campanha, editor | 1.2 | — | 12 | SQLite dev, sessão/WS, temporários, modo clássico | sim |
| `atos-armazem` | campanha, editor | 1.0 | — | 12 | SQLite dev, sessão/WS, temporários | sim |
| `atos-editor-tela` | campanha, editor | 0.9 | — | 4 | cliente | sim |
| `atos-modelo.classico` | campanha | 1.2 | — | 12 | modo clássico | sim |
| `atos-modelo` | campanha | 1.1 | — | 12 | — | sim |
| `atos-recompensas` | campanha | 5.6 | — | 5 | jogo inteiro | sim |
| `atos-runtime.classico` | campanha | 5.6 | — | 26 | jogo inteiro, temporários, modo clássico | sim |
| `atos-runtime` | campanha | 5.7 | — | 26 | jogo inteiro, temporários | sim |
| `atos-versoes.classico` | campanha, editor | 1.3 | — | 14 | jogo inteiro, cliente, temporários, modo clássico | sim |
| `atos-versoes` | campanha, editor | 4.1 | — | 14 | jogo inteiro, cliente, temporários | sim |
| `atos-vip-especial.classico` | campanha | 1.8 | — | 8 | jogo inteiro, modo clássico | sim |
| `atos-vip-especial` | campanha | 4.8 | — | 8 | jogo inteiro | sim |
| `atributos-do-mob.classico` | combate | 1.5 | — | 24 | jogo inteiro, estado global, modo clássico | sim |
| `atributos-do-mob` | combate | 6.0 | — | 24 | jogo inteiro, estado global | sim |
| `atributos-efeito.classico` | itens, combate | 4.8 | — | 116 | jogo inteiro, estado global, modo clássico | sim |
| `atributos-efeito` | itens, combate | 6.1 | — | 116 | jogo inteiro, estado global | sim |
| `auditoria-modificadores` | combate | 4.2 | 2.0 | 22 | jogo inteiro, SQLite dev, servidor HTTP, cliente | sim |
| `avancar-em-grupo.classico` | campanha, party | 4.9 | — | 4 | jogo inteiro, SQLite dev, sessão/WS, modo clássico | sim |
| `avancar-em-grupo` | campanha, party | 3.9 | — | 4 | jogo inteiro, SQLite dev, sessão/WS | sim |
| `balanceamento-1-100.classico` | progressao | 1.6 | — | 8 | jogo inteiro, modo clássico | sim |
| `balanceamento-1-100` | progressao | 3.0 | — | 8 | jogo inteiro | sim |
| `balanceamento-das-gemas.classico` | gemas | 1.7 | 0.6 | 5 | jogo inteiro, modo clássico | sim |
| `balanceamento-das-gemas` | gemas | 2.3 | 2.3 | 5 | jogo inteiro | sim |
| `banco` | social | 3.0 | — | 7 | jogo inteiro | sim |
| `barra-poe` | gemas | 2.3 | 2.2 | 6 | jogo inteiro, SQLite dev, sessão/WS, env | sim |
| `base-por-raridade.classico` | itens | 1.3 | — | 32 | jogo inteiro, modo clássico | sim |
| `base-por-raridade` | itens | 2.9 | — | 32 | jogo inteiro | sim |
| `biblioteca-sprites` | editor | 2.6 | — | 2 | — | sim |
| `biblioteca.classico` | editor | 6.9 | — | 26 | jogo inteiro, env, modo clássico | sim |
| `biblioteca` | editor | 14.7 | — | 26 | jogo inteiro, env | sim |
| `bloqueio-animacao` | combate, cacada, cliente | 3.1 | — | 2 | jogo inteiro | sim |
| `bloqueio` | combate, cacada | 0.1 | — | 5 | — | sim |
| `bolsa-mover.classico` | itens, cliente, loot | 0.6 | — | 6 | jogo inteiro, modo clássico | sim |
| `bolsa-mover` | itens, cliente, loot | 2.3 | — | 6 | jogo inteiro | sim |
| `bonus-online.classico` | cacada, party, progressao | 2.0 | — | 26 | jogo inteiro, SQLite dev, sessão/WS, modo clássico | sim |
| `bonus-online` | cacada, party, progressao | 3.2 | — | 26 | jogo inteiro, SQLite dev, sessão/WS | sim |
| `boss-do-ato.classico` | campanha | 2.4 | — | 38 | jogo inteiro, SQLite dev, sessão/WS, cliente, modo clássico | sim |
| `boss-do-ato` | campanha | 7.9 | — | 38 | jogo inteiro, SQLite dev, sessão/WS, cliente | sim |
| `bosses-dos-atos.classico` | combate, campanha | 2.0 | — | 16 | jogo inteiro, estado global, modo clássico | sim |
| `bosses-dos-atos` | combate, campanha | 2.5 | — | 16 | jogo inteiro, estado global | sim |
| `bosses-unicos` | campanha | 3.1 | — | 19 | jogo inteiro | sim |
| `bosses.classico` | campanha | 1.3 | — | 18 | jogo inteiro, modo clássico | sim |
| `bosses` | campanha | 3.0 | — | 18 | jogo inteiro | sim |
| `caminho` | cacada | 5.2 | — | 1 | jogo inteiro | sim |
| `campanha-editor.classico` | campanha, editor | 1.9 | — | 18 | cliente, temporários, workers/processos, modo clássico | sim |
| `campanha-editor` | campanha, editor | 1.3 | — | 18 | cliente, temporários, workers/processos | sim |
| `campanha.classico` | campanha | 4.0 | — | 42 | jogo inteiro, modo clássico | sim |
| `campanha` | campanha | 2.7 | — | 42 | jogo inteiro | sim |
| `captura` | campanha | 2.8 | — | 6 | jogo inteiro | sim |
| `chao-e-troca.classico` | itens | 5.2 | — | 22 | jogo inteiro, SQLite dev, sessão/WS, modo clássico | sim |
| `chao-e-troca` | itens | 4.1 | — | 22 | jogo inteiro, SQLite dev, sessão/WS | sim |
| `charms.classico` | progressao | 1.1 | — | 20 | jogo inteiro, estado global, modo clássico | sim |
| `charms` | progressao | 2.8 | — | 20 | jogo inteiro, estado global | sim |
| `chat-broadcast` | sessao, social | 0.9 | — | 3 | SQLite dev, sessão/WS | sim |
| `chefe-da-fase` | campanha | 7.8 | — | 4 | jogo inteiro | sim |
| `chegadas.classico` | itens, sessao | 1.1 | — | 6 | jogo inteiro, modo clássico | sim |
| `chegadas` | itens, sessao | 5.7 | — | 6 | jogo inteiro | sim |
| `classes.classico` | editor, progressao | 1.7 | — | 26 | SQLite dev, servidor HTTP, sessão/WS, cliente, temporários, git, env, modo clássico | sim |
| `classes` | editor, progressao | 3.3 | — | 26 | SQLite dev, servidor HTTP, sessão/WS, cliente, temporários, git, env | sim |
| `combate-formulas.classico` | combate | 1.7 | — | 24 | jogo inteiro, estado global, modo clássico | sim |
| `combate-formulas` | combate | 3.5 | — | 24 | jogo inteiro, estado global | sim |
| `combate-limites.classico` | combate | 1.0 | — | 28 | jogo inteiro, modo clássico | sim |
| `combate-limites` | combate | 3.3 | — | 28 | jogo inteiro | sim |
| `combo-poe` | gemas | 2.8 | 1.1 | 8 | jogo inteiro, env | sim |
| `combo.classico` | gemas | 1.4 | 0.7 | 11 | jogo inteiro, modo clássico | sim |
| `combo` | gemas | 2.4 | 2.3 | 11 | jogo inteiro | sim |
| `comparar` | itens | 3.2 | — | 5 | jogo inteiro | sim |
| `conjuntos.classico` | itens, editor | 1.4 | — | 32 | temporários, git, env, modo clássico | sim |
| `conjuntos` | itens, editor | 1.6 | — | 32 | temporários, git, env | sim |
| `consolidacao-offline.classico` | offline, banco | 23.4 | — | 28 | jogo inteiro, SQLite dev, sessão/WS, workers/processos, estado global, modo clássico | sim |
| `consolidacao-offline` | offline, banco | 8.9 | — | 28 | jogo inteiro, SQLite dev, sessão/WS, workers/processos, estado global | sim |
| `conta-char.classico` | party, sessao | 10.0 | — | 16 | jogo inteiro, SQLite dev, sessão/WS, modo clássico | sim |
| `conta-char` | party, sessao | 10.8 | — | 16 | jogo inteiro, SQLite dev, sessão/WS | sim |
| `conteudo-dos-atos.classico` | campanha | 12.8 | — | 10 | modo clássico | sim |
| `conteudo-dos-atos` | campanha | 0.7 | — | 10 | — | sim |
| `conteudo-privado` | sessao, cliente | 0.1 | — | 2 | servidor HTTP | sim |
| `controle-do-jogador` | combate | 2.4 | — | 9 | jogo inteiro, estado global | sim |
| `dano-ao-longo-do-tempo.classico` | combate | 1.5 | — | 32 | jogo inteiro, modo clássico | sim |
| `dano-ao-longo-do-tempo` | combate | 2.5 | — | 32 | jogo inteiro | sim |
| `dano-elemental-atributo.classico` | combate | 1.2 | — | 14 | jogo inteiro, modo clássico | sim |
| `dano-elemental-atributo` | combate | 2.6 | — | 14 | jogo inteiro | sim |
| `dano-fisico-variacao.classico` | combate | 1.2 | — | 14 | jogo inteiro, modo clássico | sim |
| `dano-fisico-variacao` | combate | 2.8 | — | 14 | jogo inteiro | sim |
| `db` | banco | 0.2 | — | 3 | SQLite dev, Postgres, temporários, env | sim |
| `decisao` | campanha | 2.9 | — | 8 | jogo inteiro, SQLite dev, sessão/WS | sim |
| `defesa-poe` | combate | 2.9 | — | 7 | jogo inteiro, estado global | sim |
| `defesas-novas.classico` | itens | 1.1 | — | 26 | jogo inteiro, estado global, modo clássico | sim |
| `defesas-novas` | itens | 2.5 | — | 26 | jogo inteiro, estado global | sim |
| `economia.classico` | sessao, banco, social | 1.5 | — | 6 | jogo inteiro, SQLite dev, sessão/WS, modo clássico | sim |
| `economia` | sessao, banco, social | 3.1 | — | 6 | jogo inteiro, SQLite dev, sessão/WS | sim |
| `editor-conteudo.classico` | editor | 3.2 | — | 20 | temporários, modo clássico | sim |
| `editor-conteudo` | editor | 0.9 | — | 20 | temporários | sim |
| `editor-mapas` | editor | 3.5 | — | 13 | jogo inteiro, cliente | sim |
| `editor-menu` | editor | 0.1 | — | 5 | cliente | sim |
| `editor-sprites` | editor | 0.1 | — | 7 | cliente | sim |
| `editor-ui` | editor | 0.8 | — | 9 | cliente | sim |
| `efeitos-visuais` | gemas, editor | 2.2 | 2.0 | 6 | jogo inteiro, cliente | sim |
| `encontros-bau.classico` | campanha, loot | 1.9 | — | 30 | jogo inteiro, SQLite dev, sessão/WS, modo clássico | sim |
| `encontros-bau` | campanha, loot | 3.5 | — | 30 | jogo inteiro, SQLite dev, sessão/WS | sim |
| `encontros-etapa6.classico` | campanha | 15.8 | — | 16 | jogo inteiro, temporários, workers/processos, modo clássico | sim |
| `encontros-etapa6` | campanha | 19.4 | — | 16 | jogo inteiro, temporários, workers/processos | sim |
| `encontros` | campanha | 4.5 | — | 18 | jogo inteiro | sim |
| `equipamento-slots.classico` | itens | 1.4 | — | 28 | jogo inteiro, cliente, modo clássico | sim |
| `equipamento-slots` | itens | 5.7 | — | 28 | jogo inteiro, cliente | sim |
| `equipamento.classico` | itens | 1.1 | — | 16 | jogo inteiro, modo clássico | sim |
| `equipamento` | itens | 3.4 | — | 16 | jogo inteiro | sim |
| `escalonamento.classico` | cacada, party | 2.3 | — | 14 | jogo inteiro, SQLite dev, sessão/WS, modo clássico | sim |
| `escalonamento` | cacada, party | 2.9 | — | 14 | jogo inteiro, SQLite dev, sessão/WS | sim |
| `especializacoes.classico` | combate, progressao | 1.7 | — | 24 | jogo inteiro, estado global, modo clássico | sim |
| `especializacoes` | combate, progressao | 2.7 | — | 24 | jogo inteiro, estado global | sim |
| `estados` | gemas, combate | 2.0 | 1.9 | 17 | jogo inteiro, cliente | sim |
| `estaticos-precomprimido` | sessao, cliente | 0.3 | — | 14 | servidor HTTP, temporários | sim |
| `estaticos-versao` | sessao, cliente | 0.3 | — | 3 | servidor HTTP, temporários | sim |
| `estaticos` | sessao, cliente | 0.7 | — | 6 | servidor HTTP | sim |
| `extrair-poedb-pinaculos` | campanha | 0.1 | — | 2 | — | sim |
| `familiar-anda` | cacada | 4.6 | — | 11 | jogo inteiro | sim |
| `familiar-combate.classico` | combate | 2.4 | — | 28 | jogo inteiro, modo clássico | sim |
| `familiar-combate` | combate | 3.9 | — | 28 | jogo inteiro | sim |
| `fatias-do-relogio` | sessao | 1.2 | — | 3 | SQLite dev, sessão/WS | sim |
| `ficha-de-dano.classico` | combate | 0.9 | — | 16 | jogo inteiro, modo clássico | sim |
| `ficha-de-dano` | combate | 2.8 | — | 16 | jogo inteiro | sim |
| `ficha-origens.classico` | combate | 0.8 | — | 16 | jogo inteiro, modo clássico | sim |
| `ficha-origens` | combate | 2.7 | — | 16 | jogo inteiro | sim |
| `ficha-poe` | combate | 2.8 | — | 9 | jogo inteiro, SQLite dev, sessão/WS, env | sim |
| `fila-de-transacoes` | sessao, banco | 0.8 | — | 3 | SQLite dev, sessão/WS | sim |
| `filtro-da-conta.classico` | itens, loot | 1.5 | — | 16 | jogo inteiro, modo clássico | sim |
| `filtro-da-conta` | itens, loot | 2.6 | — | 16 | jogo inteiro | sim |
| `filtro-de-loot` | itens, loot | 2.6 | — | 5 | jogo inteiro | sim |
| `filtro-decisao.classico` | itens, loot | 1.8 | — | 30 | jogo inteiro, modo clássico | sim |
| `filtro-decisao` | itens, loot | 3.1 | — | 30 | jogo inteiro | sim |
| `filtro-poe` | itens, loot | 4.6 | — | 14 | jogo inteiro, cliente, env | sim |
| `forja.classico` | itens | 1.4 | — | 26 | jogo inteiro, modo clássico | sim |
| `forja` | itens | 3.0 | — | 26 | jogo inteiro | sim |
| `gemas-combinacoes.classico` | gemas | 1.2 | 0.6 | 23 | jogo inteiro, sessão/WS, modo clássico | sim |
| `gemas-combinacoes` | gemas | 2.5 | 2.3 | 23 | jogo inteiro, sessão/WS | sim |
| `gemas-raridade.classico` | gemas, itens | 0.9 | 0.7 | 18 | jogo inteiro, SQLite dev, modo clássico | sim |
| `gemas-raridade` | gemas, itens | 2.4 | 2.4 | 18 | jogo inteiro, SQLite dev | sim |
| `gemas-skill.classico` | gemas | 2.0 | 0.8 | 36 | jogo inteiro, estado global, modo clássico | sim |
| `gemas-skill` | gemas | 8.3 | 2.3 | 36 | jogo inteiro, estado global | sim |
| `gemas` | gemas | 2.4 | 2.2 | 13 | jogo inteiro | sim |
| `git-envio` | editor | 17.3 | — | 8 | cliente, temporários, git, workers/processos, env | sim |
| `git-integracao` | editor | 20.1 | — | 10 | cliente, temporários, git, workers/processos, env | sim |
| `guildas` | social | 1.1 | — | 5 | SQLite dev | sim |
| `historico-da-loja` | sessao, social | 7.9 | — | 10 | jogo inteiro, SQLite dev, sessão/WS | sim |
| `hot-reload-cliente` | cliente, editor | 15.5 | — | 3 | cliente | sim |
| `hot-reload-conteudo.classico` | editor | 3.3 | — | 22 | Postgres, servidor HTTP, temporários, env, modo clássico | sim |
| `hot-reload-conteudo` | editor | 2.6 | — | 22 | Postgres, servidor HTTP, temporários, env | sim |
| `hot-reload` | editor | 1.8 | — | 12 | Postgres, servidor HTTP, cliente, temporários | sim |
| `hunt-gravada.classico` | cacada, offline, banco | 1.9 | — | 8 | jogo inteiro, modo clássico | sim |
| `hunt-gravada` | cacada, offline, banco | 2.5 | — | 8 | jogo inteiro | sim |
| `hunts-painel.classico` | cacada | 1.7 | — | 14 | jogo inteiro, cliente, modo clássico | sim |
| `hunts-painel` | cacada | 2.6 | — | 14 | jogo inteiro, cliente | sim |
| `icones` | itens, cliente | 0.8 | — | 4 | cliente | sim |
| `implicitos.classico` | itens | 0.9 | 0.7 | 8 | jogo inteiro, cliente, modo clássico | sim |
| `implicitos` | itens | 2.0 | 2.0 | 8 | jogo inteiro, cliente | sim |
| `infra-editores.classico` | editor | 2.7 | — | 20 | jogo inteiro, servidor HTTP, cliente, temporários, modo clássico | sim |
| `infra-editores` | editor | 4.1 | — | 20 | jogo inteiro, servidor HTTP, cliente, temporários | sim |
| `interpolacao` | cliente | 0.8 | — | 3 | cliente | sim |
| `isolamento-dos-testes` | editor | 0.5 | — | 2 | jogo inteiro, temporários, workers/processos, env | sim |
| `item-no-chao` | itens, cacada, cliente, loot | 0.1 | — | 3 | cliente | sim |
| `item-power-editor.classico` | itens, editor | 4.2 | — | 64 | cliente, temporários, env, modo clássico | sim |
| `item-power-editor` | itens, editor | 4.2 | — | 64 | cliente, temporários, env | sim |
| `item-power.classico` | itens, editor | 3.8 | — | 44 | jogo inteiro, temporários, git, estado global, env, modo clássico | sim |
| `item-power` | itens, editor | 3.2 | — | 44 | jogo inteiro, temporários, git, estado global, env | sim |
| `itens-compat.classico` | itens | 1.9 | — | 18 | jogo inteiro, modo clássico | sim |
| `itens-compat` | itens | 3.6 | — | 18 | jogo inteiro | sim |
| `itens-efeitos` | itens | 3.4 | — | 7 | jogo inteiro | sim |
| `itens-geracao` | itens | 2.5 | — | 10 | — | sim |
| `itens-novos-sprites.classico` | itens, editor | 2.1 | — | 22 | cliente, temporários, git, env, modo clássico | sim |
| `itens-novos-sprites` | itens, editor | 1.6 | — | 22 | cliente, temporários, git, env | sim |
| `itens-poe-afeccoes` | itens, combate | 3.5 | — | 5 | jogo inteiro, env | sim |
| `itens-poe-aneis` | itens | 3.0 | — | 5 | jogo inteiro, env | sim |
| `itens-poe-arvore` | itens, progressao | 12.2 | — | 8 | jogo inteiro, workers/processos, env | sim |
| `itens-poe-atos` | itens, campanha | 2.8 | — | 7 | jogo inteiro, env | sim |
| `itens-poe-campanha` | itens, campanha | 11.0 | — | 9 | jogo inteiro, workers/processos, env | sim |
| `itens-poe-cargas` | itens, combate | 2.9 | — | 7 | jogo inteiro, env | sim |
| `itens-poe-classes` | itens, combate, progressao | 2.5 | — | 6 | jogo inteiro, env | sim |
| `itens-poe-combate` | itens, combate | 4.0 | — | 7 | jogo inteiro, estado global | sim |
| `itens-poe-frascos` | itens | 6.5 | — | 6 | jogo inteiro, SQLite dev, sessão/WS, cliente, env | sim |
| `itens-poe-gemas` | gemas, itens | 26.3 | 2.3 | 20 | jogo inteiro, env | sim |
| `itens-poe-jogo` | itens | 85.2 | — | 15 | jogo inteiro, env | sim |
| `itens-poe-modificadores-monstro` | itens, combate | 2.4 | — | 8 | jogo inteiro, env | sim |
| `itens-poe-mods` | itens, combate | 3.8 | — | 14 | jogo inteiro, env | sim |
| `itens-poe-pendencias` | itens, editor | 3.7 | — | 2 | jogo inteiro | sim |
| `itens-poe-pinaculos` | itens, campanha | 2.7 | — | 3 | jogo inteiro, env | sim |
| `itens-poe-pools` | itens, loot | 32.0 | — | 4 | jogo inteiro | sim |
| `itens-poe-sockets` | gemas, itens | 4.1 | 0.1 | 4 | env | sim |
| `itens-poe-telas` | itens, editor | 3.5 | — | 3 | env | sim |
| `itens-poe` | itens | 6.1 | — | 14 | env | sim |
| `jogadores-na-praca` | sessao, social | 1.0 | — | 6 | SQLite dev, sessão/WS | sim |
| `kite-parede-diagonal` | cacada | 5.0 | — | 8 | jogo inteiro | sim |
| `limites` | sessao | 0.4 | — | 5 | sessão/WS | sim |
| `limpeza-de-temporarios` | offline | 4.7 | — | 16 | jogo inteiro, SQLite dev, temporários, shell | sim |
| `limpeza-do-chao` | cacada | 2.7 | — | 16 | jogo inteiro | sim |
| `loot-curva` | cacada, loot | 13.6 | — | 10 | — | sim |
| `loot-moeda` | cacada, loot | 8.2 | — | 2 | jogo inteiro, estado global | intermitente — falhou 1× na rodada isolada |
| `magias-fase-a.classico` | gemas | 2.3 | 0.8 | 11 | jogo inteiro, modo clássico | sim |
| `magias-fase-a` | gemas | 2.4 | 2.3 | 11 | jogo inteiro | sim |
| `mapa-editor` | campanha, editor | 2.7 | — | 8 | jogo inteiro, temporários | sim |
| `mapa-fundo` | editor | 3.2 | — | 9 | jogo inteiro, cliente, temporários | sim |
| `mapa-spawns` | cacada | 3.3 | — | 5 | jogo inteiro | sim |
| `melee.classico` | combate, progressao | 0.9 | — | 8 | jogo inteiro, modo clássico | sim |
| `melee` | combate, progressao | 2.6 | — | 8 | jogo inteiro | sim |
| `melhorias-da-conta` | sessao, banco | 0.2 | — | 2 | SQLite dev | sim |
| `minimapa.classico` | cliente | 6.7 | — | 18 | jogo inteiro, SQLite dev, sessão/WS, cliente, modo clássico | sim |
| `minimapa` | cliente | 8.1 | — | 18 | jogo inteiro, SQLite dev, sessão/WS, cliente | sim |
| `missoes-de-gemas` | gemas, campanha | 2.0 | 2.0 | 6 | jogo inteiro, env | sim |
| `mobs-mecanicas.classico` | combate | 0.9 | — | 18 | jogo inteiro, estado global, modo clássico | sim |
| `mobs-mecanicas` | combate | 2.5 | — | 18 | jogo inteiro, estado global | sim |
| `mobs-raridade.classico` | combate, loot | 1.0 | — | 24 | jogo inteiro, modo clássico | sim |
| `mobs-raridade` | combate, loot | 2.4 | — | 24 | jogo inteiro | sim |
| `mochila-redesenho` | itens, cliente | 0.1 | — | 2 | cliente | sim |
| `modificadores-do-mob` | combate | 1.5 | — | 12 | — | sim |
| `modificadores` | combate | 0.1 | — | 10 | — | sim |
| `modo-beta.classico` | editor | 1.0 | — | 10 | jogo inteiro, servidor HTTP, modo clássico | sim |
| `modo-beta` | editor | 3.1 | — | 10 | jogo inteiro, servidor HTTP | sim |
| `modos-das-magias.classico` | gemas | 1.4 | 0.6 | 10 | jogo inteiro, modo clássico | sim |
| `modos-das-magias` | gemas | 2.4 | 2.4 | 10 | jogo inteiro | sim |
| `moedas-poe` | itens | 2.8 | — | 6 | jogo inteiro, env | sim |
| `moedas-pools` | itens, loot | 3.2 | — | 8 | jogo inteiro | sim |
| `morte.classico` | cacada, progressao | 1.2 | — | 12 | jogo inteiro, modo clássico | sim |
| `morte` | cacada, progressao | 3.9 | — | 12 | jogo inteiro | sim |
| `motor-de-dano.classico` | gemas, combate | 3.4 | 0.9 | 5 | modo clássico | sim |
| `motor-de-dano` | gemas, combate | 2.8 | 2.7 | 5 | — | sim |
| `moverMonstros` | cacada | 1.2 | — | 5 | — | sim |
| `nameplate-do-jogador` | cliente | 0.8 | — | 12 | cliente | sim |
| `ondas` | campanha | 3.9 | — | 11 | jogo inteiro | sim |
| `operacao` | editor | 3.8 | — | 7 | jogo inteiro, SQLite dev, servidor HTTP, sessão/WS, cliente | sim |
| `orbes-de-socket.classico` | gemas | 1.0 | 0.7 | 24 | jogo inteiro, SQLite dev, sessão/WS, modo clássico | sim |
| `orbes-de-socket` | gemas | 2.6 | 2.5 | 24 | jogo inteiro, SQLite dev, sessão/WS | sim |
| `overrides-itens.classico` | itens, editor | 2.3 | — | 14 | cliente, temporários, workers/processos, modo clássico | sim |
| `overrides-itens` | itens, editor | 2.2 | — | 14 | cliente, temporários, workers/processos | sim |
| `overrides` | editor | 2.3 | — | 9 | cliente, temporários, workers/processos | sim |
| `party-follow-independente.classico` | party | 10.0 | — | 34 | jogo inteiro, SQLite dev, sessão/WS, cliente, modo clássico | sim |
| `party-follow-independente` | party | 12.8 | — | 34 | jogo inteiro, SQLite dev, sessão/WS, cliente | sim |
| `party-limite.classico` | party | 26.9 | — | 28 | jogo inteiro, SQLite dev, sessão/WS, estado global, modo clássico | sim |
| `party-limite` | party | 22.5 | — | 28 | jogo inteiro, SQLite dev, sessão/WS, estado global | sim |
| `party-objetivo-da-fase` | campanha, party | 11.4 | — | 4 | jogo inteiro, SQLite dev, sessão/WS, env | sim |
| `party-persistencia` | party, sessao, banco | 12.2 | — | 8 | jogo inteiro, SQLite dev, sessão/WS, env | sim |
| `party-recompensas.classico` | party | 3.7 | — | 26 | jogo inteiro, SQLite dev, sessão/WS, modo clássico | sim |
| `party-recompensas` | party | 5.8 | — | 26 | jogo inteiro, SQLite dev, sessão/WS | sim |
| `party-ver-aliados` | party, sessao | 3.9 | — | 2 | jogo inteiro, SQLite dev, sessão/WS, env | sim |
| `party-volta-na-cacada` | party, sessao | 4.8 | — | 5 | jogo inteiro, SQLite dev, sessão/WS, env | sim |
| `passivas.classico` | progressao | 1.0 | — | 78 | jogo inteiro, modo clássico | sim |
| `passivas` | progressao | 2.7 | — | 78 | jogo inteiro | sim |
| `percurso.classico` | cacada | 5.1 | — | 12 | jogo inteiro, modo clássico | sim |
| `percurso` | cacada | 6.8 | — | 12 | jogo inteiro | sim |
| `personagens-legado` | sessao, banco | 14.1 | — | 12 | jogo inteiro, SQLite dev, servidor HTTP, sessão/WS, workers/processos, env | sim |
| `pilha-de-20` | itens, loot | 3.2 | — | 5 | jogo inteiro, env | sim |
| `pocoes.classico` | itens | 1.3 | — | 58 | jogo inteiro, modo clássico | sim |
| `pocoes` | itens | 2.9 | — | 58 | jogo inteiro | sim |
| `poder-da-arma.classico` | gemas, combate | 1.2 | 0.7 | 16 | jogo inteiro, modo clássico | sim |
| `poder-da-arma` | gemas, combate | 2.4 | 2.4 | 16 | jogo inteiro | sim |
| `poderes.classico` | combate | 6.3 | — | 18 | jogo inteiro, estado global, modo clássico | sim |
| `poderes` | combate | 5.2 | — | 18 | jogo inteiro, estado global | sim |
| `podio-combate.classico` | combate | 1.5 | — | 4 | jogo inteiro, estado global, modo clássico | sim |
| `podio-combate` | combate | 3.4 | — | 4 | jogo inteiro, estado global | sim |
| `preco-das-pocoes` | itens | 0.5 | — | 1 | — | sim |
| `preco-de-venda.classico` | itens, loot | 1.2 | — | 16 | jogo inteiro, modo clássico | sim |
| `preco-de-venda` | itens, loot | 3.3 | — | 16 | jogo inteiro | sim |
| `precomprimidos-em-dia` | cliente | 0.3 | — | 5 | temporários | sim |
| `presentes` | banco, social | 1.9 | — | 6 | SQLite dev | sim |
| `prey-combate.classico` | combate, progressao | 1.5 | — | 12 | jogo inteiro, estado global, modo clássico | sim |
| `prey-combate` | combate, progressao | 3.7 | — | 12 | jogo inteiro, estado global | sim |
| `prey.classico` | progressao | 1.2 | — | 34 | jogo inteiro, modo clássico | sim |
| `prey` | progressao | 3.5 | — | 34 | jogo inteiro | sim |
| `progressao.classico` | progressao | 14.8 | — | 36 | jogo inteiro, cliente, temporários, git, workers/processos, env, modo clássico | sim |
| `progressao` | progressao | 9.1 | — | 36 | jogo inteiro, cliente, temporários, git, workers/processos, env | sim |
| `progresso-da-hunt.classico` | cacada | 2.7 | — | 46 | jogo inteiro, estado global, modo clássico | sim |
| `progresso-da-hunt` | cacada | 2.9 | — | 46 | jogo inteiro, estado global | sim |
| `projeteis.classico` | gemas, combate | 1.0 | 0.7 | 13 | jogo inteiro, modo clássico | sim |
| `projeteis` | gemas, combate | 2.7 | 2.6 | 13 | jogo inteiro | sim |
| `publicacao` | editor | 5.0 | — | 11 | temporários, git, workers/processos, shell | sim |
| `quadro` | sessao | 7.0 | — | 4 | jogo inteiro, SQLite dev, sessão/WS | sim |
| `raridade-dos-mapas.classico` | cacada, editor | 1.5 | — | 12 | jogo inteiro, modo clássico | sim |
| `raridade-dos-mapas` | cacada, editor | 3.6 | — | 12 | jogo inteiro | sim |
| `raridade-minima-boss-bau` | campanha, loot | 3.1 | — | 4 | jogo inteiro | sim |
| `recarga.classico` | gemas | 1.0 | 0.7 | 3 | jogo inteiro, modo clássico | sim |
| `recarga` | gemas | 2.9 | 2.9 | 3 | jogo inteiro | sim |
| `recompensas-de-nivel.classico` | progressao | 0.7 | — | 20 | jogo inteiro, modo clássico | sim |
| `recompensas-de-nivel` | progressao | 3.0 | — | 20 | jogo inteiro | sim |
| `redis` | banco | 0.1 | — | 3 | Postgres, Redis, env | sim |
| `reforcos.classico` | gemas | 1.0 | 0.7 | 9 | jogo inteiro, modo clássico | sim |
| `reforcos` | gemas | 2.4 | 2.4 | 9 | jogo inteiro | sim |
| `regen-na-cidade.classico` | cacada, sessao | 1.0 | — | 6 | jogo inteiro, SQLite dev, sessão/WS, estado global, modo clássico | sim |
| `regen-na-cidade` | cacada, sessao | 2.8 | — | 6 | jogo inteiro, SQLite dev, sessão/WS, estado global | sim |
| `regras-de-uso.classico` | gemas | 0.9 | 0.6 | 6 | jogo inteiro, modo clássico | sim |
| `regras-de-uso` | gemas | 2.3 | 2.2 | 6 | jogo inteiro | sim |
| `regras-do-slot.classico` | gemas | 1.4 | 0.7 | 23 | jogo inteiro, modo clássico | sim |
| `regras-do-slot` | gemas | 2.7 | 2.5 | 23 | jogo inteiro | sim |
| `relatorio-da-ausencia.classico` | offline, sessao | 10.7 | — | 14 | jogo inteiro, SQLite dev, sessão/WS, workers/processos, modo clássico | sim |
| `relatorio-da-ausencia` | offline, sessao | 11.2 | — | 14 | jogo inteiro, SQLite dev, sessão/WS, workers/processos | sim |
| `rentabilidade.classico` | cacada, loot | 1.2 | — | 22 | jogo inteiro, modo clássico | sim |
| `rentabilidade` | cacada, loot | 3.3 | — | 22 | jogo inteiro | sim |
| `reserva-de-mana` | gemas, combate | 3.0 | 2.6 | 11 | jogo inteiro, env | sim |
| `roupa-da-classe` | campanha, social, progressao | 0.3 | — | 3 | SQLite dev, SQLite próprio, temporários, env | sim |
| `server-save.classico` | offline, banco | 69.4 | — | 56 | jogo inteiro, SQLite dev, SQLite próprio, workers/processos, modo clássico | sim |
| `server-save` | offline, banco | 66.1 | — | 56 | jogo inteiro, SQLite dev, SQLite próprio, workers/processos | sim |
| `setores.classico` | cacada, party | 2.6 | — | 18 | jogo inteiro, SQLite dev, sessão/WS, cliente, modo clássico | sim |
| `setores` | cacada, party | 3.3 | — | 18 | jogo inteiro, SQLite dev, sessão/WS, cliente | sim |
| `sets-de-marco.classico` | campanha, progressao | 0.9 | — | 18 | jogo inteiro, modo clássico | sim |
| `sets-de-marco` | campanha, progressao | 2.2 | — | 18 | jogo inteiro | sim |
| `simulacao-offline.classico` | offline | 19.1 | — | 8 | jogo inteiro, SQLite dev, sessão/WS, workers/processos, modo clássico | sim |
| `simulacao-offline` | offline | 8.5 | — | 8 | jogo inteiro, SQLite dev, sessão/WS, workers/processos | sim |
| `simulador-de-rotacao.classico` | gemas | 1.7 | 0.8 | 6 | jogo inteiro, modo clássico | sim |
| `simulador-de-rotacao` | gemas | 2.3 | 2.2 | 6 | jogo inteiro | sim |
| `simulador-do-mob.classico` | combate | 0.9 | — | 18 | jogo inteiro, servidor HTTP, cliente, modo clássico | sim |
| `simulador-do-mob` | combate | 2.9 | — | 18 | jogo inteiro, servidor HTTP, cliente | sim |
| `simulador-tique.classico` | offline | 2.8 | — | 10 | jogo inteiro, SQLite dev, sessão/WS, workers/processos, estado global, env, modo clássico | sim |
| `simulador-tique` | offline | 8.8 | — | 10 | jogo inteiro, SQLite dev, sessão/WS, workers/processos, estado global, env | sim |
| `site-poe` | campanha, social | 2.8 | — | 9 | jogo inteiro, SQLite dev, cliente | sim |
| `site.classico` | social | 0.8 | — | 12 | jogo inteiro, SQLite dev, modo clássico | sim |
| `site` | social | 2.5 | — | 12 | jogo inteiro, SQLite dev | sim |
| `skills-iguais` | gemas, progressao | 0.1 | 0.1 | 3 | — | sim |
| `so-itens-do-poe` | itens | 4.8 | — | 9 | jogo inteiro, SQLite dev, workers/processos, env | sim |
| `sockets-cores-poe` | gemas | 2.6 | 2.4 | 5 | jogo inteiro, env | sim |
| `sockets-joias-poe` | gemas, itens | 5.7 | 0.1 | 2 | jogo inteiro, cliente | sim |
| `sockets-toque` | gemas, cliente | 2.2 | 2.2 | 4 | jogo inteiro, cliente | sim |
| `sprites-edicao` | editor | 2.6 | — | 12 | — | sim |
| `sprites-overrides` | editor | 5.1 | — | 11 | cliente, temporários | sim |
| `supports-etapa4.classico` | gemas | 1.1 | 0.7 | 8 | jogo inteiro, modo clássico | sim |
| `supports-etapa4` | gemas | 2.6 | 2.5 | 8 | jogo inteiro | sim |
| `tarefas.classico` | social | 1.5 | — | 24 | jogo inteiro, SQLite dev, sessão/WS, modo clássico | sim |
| `tarefas` | social | 4.1 | — | 24 | jogo inteiro, SQLite dev, sessão/WS | sim |
| `tooltip-dos-buffs.classico` | gemas, cliente | 1.0 | 0.9 | 6 | jogo inteiro, cliente, modo clássico | sim |
| `tooltip-dos-buffs` | gemas, cliente | 2.3 | 2.2 | 6 | jogo inteiro, cliente | sim |
| `tooltip-gemas.classico` | gemas, cliente | 0.7 | 0.6 | 4 | jogo inteiro, modo clássico | sim |
| `tooltip-gemas` | gemas, cliente | 2.3 | 2.2 | 4 | jogo inteiro | sim |
| `tooltip-suportes.classico` | gemas, cliente | 0.7 | 0.6 | 7 | jogo inteiro, cliente, modo clássico | sim |
| `tooltip-suportes` | gemas, cliente | 2.1 | 2.1 | 7 | jogo inteiro, cliente | sim |
| `top5-balao` | cliente, social | 0.3 | — | 2 | cliente | sim |
| `validacao` | editor | 112.5 | — | 9 | cliente, temporários, git, workers/processos, env | sim |
| `velocidade-de-ataque.classico` | combate | 1.1 | — | 2 | jogo inteiro, modo clássico | sim |
| `velocidade-de-ataque` | combate | 3.6 | — | 2 | jogo inteiro | sim |
| `versao-do-cliente` | sessao, cliente | 1.3 | — | 2 | SQLite dev, sessão/WS, temporários | sim |
| `versoes` | editor | 7.3 | — | 10 | cliente, temporários, git, workers/processos, env | sim |
| `welcome-cidade` | sessao, social | 3.7 | — | 2 | jogo inteiro, SQLite dev, sessão/WS | sim |
| `wiki` | social | 1.0 | — | 6 | servidor HTTP, cliente | sim |
| `world-camera-modo-leve` | campanha, cliente | 0.1 | — | 2 | cliente | sim |
| `world-dados` | campanha, cliente | 3.6 | — | 13 | jogo inteiro, cliente | sim |
| `world.classico` | campanha | 1.4 | — | 16 | jogo inteiro, cliente, modo clássico | sim |
| `world` | campanha | 4.0 | — | 16 | jogo inteiro, cliente | sim |
| `xp-da-hunt.classico` | cacada, progressao | 7.0 | — | 12 | jogo inteiro, estado global, modo clássico | sim |
| `xp-da-hunt` | cacada, progressao | 3.9 | — | 12 | jogo inteiro, estado global | sim |
