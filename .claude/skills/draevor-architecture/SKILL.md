---
name: draevor-architecture
description: Arquitetura do Draevor Idle (Node ESM, WebSocket, server-authoritative, PoE 1 como gameplay oficial). Use ANTES de criar, mover ou ligar qualquer sistema, módulo, pasta ou dependência; para decidir onde uma regra mora (engine × systems × data × websocket × database × frontend); para evitar ciclos de import, duplicação entre o sistema antigo do Draevor e o do PoE, portas de modo (`ligado()`/feature flags) e para planejar migração/remoção de legado. As outras skills do projeto (draevor-engine, poe-*, draevor-testing) partem desta.
---

# Draevor — arquitetura

O Draevor é **server-authoritative**: o servidor decide tudo, o cliente mostra e pede. O gameplay **oficial é o do PoE 1**
(`game/systems/itens-poe/*`) rodando sobre o motor do Draevor (`game/systems/*`). O Draevor clássico só existe como **transição**
(`DRAEVOR_CLASSICO=1`), para legado e testes antigos.

Mapa real (onde cada coisa está, problemas, ciclos, duplicações): [references/mapa-do-repositorio.md](references/mapa-do-repositorio.md).
Plano da migração: `docs/migracao-poe-oficial.md`. Não confie na estrutura "ideal" abaixo sem conferir o mapa.

## Camadas: o conceito e onde ele está hoje

| Conceito | Onde está de verdade | Pode depender de |
|---|---|---|
| ENGINE (como o jogo funciona) | relógio em `game/websocket/sessao.mjs`; tique em `game/systems/cacadas.mjs`; instância/terreno/caminho/andares/setores/monstros em `game/systems/hunt/`; isomórfico em `game/engine/` | nada de gameplay específico |
| SYSTEMS (regras) | `game/systems/**` (motor e Draevor) e `game/systems/itens-poe/**` (PoE) | engine, data, persistência por função |
| DATA (conteúdo) | `game/gamedata/**` | — (é lido pelos systems) |
| DATABASE | `game/database/*` | — (regra entra por parâmetro) |
| WEBSOCKET | `game/websocket/*` | systems |
| FRONTEND | `game/frontend/client/**` | só o que o servidor manda; isomórfico de `game/engine/` para prévia |
| INFRA | `game/backend/`, `game/docker/`, `scripts/`, `docs/deploy.md` | — |
| EDITORES ("a Engine") | `game/admin/*` + `frontend/client/src/editor-*.mjs` — só local | systems, data |

"Engine" tem três sentidos neste repositório (editores, a pasta `game/engine/`, o motor de runtime). Diga qual.

## Regras de dependência

1. **A engine não conhece gameplay.** O que é técnico (tique, instância, caminho, colisão na grade, andares, quadro) não importa
   `itens-poe/*` nem decide regra de PoE. Conceito como Fireball, Act 1, Unique, Support Gem, Prefix/Suffix mora em systems/data.
   Dívida conhecida: `game/engine/formulas.mjs` e `game/engine/sockets-de-gema.mjs` têm regra — não piore isso.
2. **Bootstrap só em ponto de entrada.** `game/systems/itens-poe/iniciar.mjs` (`iniciarJogoDoPoe`) é importado por
   `backend/index.mjs`, pelos workers (`simulacao-offline-worker.mjs`, `simulador-tique-worker.mjs`), por `admin/validacao-runner.mjs` e
   pelos testes (`testes/apoio.mjs`). Nenhum módulo de `systems/` o importa — é o que evita ciclo. Processo novo que roda o jogo chama ele.
3. **systems não importa websocket nem admin; database não importa systems.** Violações existentes (não repita):
   `systems/chat.mjs` → `websocket/quadro.mjs`, `systems/consolidacao-offline.mjs` → `websocket/sessao.mjs`,
   `database/caca-offline.mjs` → `systems/stamina.mjs`. Para passar regra à persistência, use parâmetro (ex.: `migrarClasse(…, { pular })`).
4. **Sem ler no topo do módulo um valor de outro módulo do mesmo ciclo** (TDZ). Há um ciclo de 29 arquivos e `arena ↔ cacadas`;
   calcule sob demanda (ex.: `PONTOS` preguiçoso em `itens-poe/lacaios-poe.mjs`). Import novo: confira se não cria ciclo.
5. **Uma fonte por dado e por regra.** Antes de escrever uma conta, procure a existente (ver duplicações no mapa).

## Server authority

- O cliente **nunca decide**: dano, drop, XP, cooldown, moeda/ouro, inventário, resultado de combate, entrada em área.
- Toda mensagem do cliente passa por **lista branca de campos** (ex.: `startHunt` em `websocket/sessao.mjs` só repassa
  `huntId/mode/strategy/dificuldade`; `viaPortal`, `campanha`, `arenaPvp` são decisões do servidor).
- Posse, quantidade, alcance e saldo são conferidos no servidor; ouro/itens entre personagens em transação
  (`database/banco.mjs` `transacao` + a fila `emTransacao` da sessão).
- Eventos idempotentes: morte paga uma vez (`alvo.recompensado`), vitória uma vez (`hunt.vitoria`), pedido repetido (`pedido`) ignorado.
- O isomórfico em `game/engine/` (áreas, sockets, fórmulas) é para a tela PREVER/DESENHAR; quem decide é o servidor.

## Modo e feature flags

- A única porta é `ligado()` em `game/systems/itens-poe/catalogo.mjs` (= não clássico e catálogo presente). `ITENS_POE` não é lida.
- **Não crie** variável de modo nova nem ramo `if (ligado())` novo por conveniência: no jogo oficial, a regra do PoE É a regra. Se
  precisar tocar num ramo existente, mexa no ramo do PoE e deixe o clássico como está.
- Fim da transição (dono decide quando): colapsar cada porta no lugar (fica o ramo PoE) e apagar o código só do Draevor — depois de
  verificar quem o usa (terreno das hunts e bestiário ficam). Ver `docs/migracao-poe-oficial.md` §10 (F4).

## Dados (data-driven)

- Número de balanceamento mora em `game/gamedata/**` (ex.: `game/gamedata/itens-poe/regras.json`, `game/gamedata/combate/*.json`, `game/gamedata/mobs/*.json`), não no código.
- Ids do PoE são estáveis e só crescem (`gamedata/itens-poe/{gemas,suportes,moedas}-poe-ids.json`).
- O conteúdo do PoE que o jogo usa está no repositório (`gamedata/itens-poe/`); a coleção externa (`REFERENCIAS_POE`) é só fonte dos
  tools (`tools/importar-poe-itens.mjs`, `game/tools/importar-gemas-poe.mjs`).
- Editores gravam em `gamedata/` e `gamedata/overrides/` (com `_versoes/`); produção recebe por git → PR → deploy (montado somente leitura).

## Legado

- Personagem antigo: **arquivado**, nunca convertido nem apagado (`game/systems/personagem/legado.mjs`). Todo caminho que lê ou grava
  OUTRO personagem pergunta `Legado.arquivado` (ex.: banco por nome, "char da conta", ranking, mercado, migração de classe).
- Só conteúdo do PoE entra (`conteudoDoJogoOficial` em `systems/cacadas.mjs`) e só item do PoE entra no personagem
  (`podeEntrar` em `systems/itens-poe/so-itens-do-poe.mjs`, em toda ENTRADA de item — nunca em movimento interno).

## ANTES DE CRIAR NOVO SISTEMA

Responda por escrito antes de codar:

1. **Já existe?** Procure por conceito em `game/systems/`, `game/systems/itens-poe/`, `game/engine/`, `game/admin/` e no mapa.
2. **Existe algo equivalente** (no Draevor ou no PoE)? Veja a tabela de duplicações.
3. **Deve ser estendido?** Preferir estender o motor com regra/dado do PoE (como as gemas do PoE usam os moldes do Draevor).
4. **Deve ser migrado?** O do Draevor fica só no clássico; não crie um terceiro.
5. **Existe duplicação** que este trabalho aumentaria?
6. **Cria dependência circular** ou inverte a direção (systems → websocket, database → systems)?
7. **Onde mora o dado** e quem é o dono do arquivo?
8. **Qual teste prova** a regra (skill `draevor-testing`) e como o servidor a valida?

Refatoração estrutural grande só depois de diagnóstico apresentado e aprovado pelo dono. Não mova arquivos por estética.

## Limites de atuação

- Trabalhe em worktree/branch. Sem autorização explícita do dono: nada de merge, push na `main`, deploy, mexer em `/srv/draevor`
  (produção), banco de produção, nem apagar contas/personagens/itens.
- Entrega: testes → commit na branch → push + link de comparação → o dono mergeia → deploy por `/srv/draevor/bin/deploy.sh`.

## Skills relacionadas

`draevor-engine` (motor de runtime), `poe-combat`, `poe-itemization`, `poe-gems`, `poe-loot`, `poe-campaign`, `draevor-testing`.
