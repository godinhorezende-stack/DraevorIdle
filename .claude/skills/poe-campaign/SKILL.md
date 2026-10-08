---
name: poe-campaign
description: A campanha do Path of Exile 1 no Draevor — 10 atos + Epílogo, 143 áreas, cidades, conexões (grafo) entre áreas, objetivos e conclusão da área (matar chefe, matar N, item de missão), chefes de ato e pináculos, portal do boss, progressão e liberação, "Ficar na fase"/"Avançar"/"Seguir líder", instâncias e "Hunt Clear!", monstros e modificadores de monstro do PoE, recompensas e missões de gema, e o editor de Atos da Engine. Use para mexer em ato, área, mapa de área, chefe, objetivo, progressão ou estado de campanha do personagem.
---

# PoE — campanha

O Draevor é **instanciado e online**: cada entrada numa área cria uma **instância** (`game/systems/hunt/instancia.mjs`) com os bichos
dela; limpar tudo dá "Hunt Clear!" e, depois da pausa, uma instância nova. A campanha do PoE **usa essa infraestrutura** — não crie um
sistema paralelo de mapas, áreas ou instâncias.

## Modelo real

| Peça | Onde | Observação |
|---|---|---|
| Atos e áreas do PoE (dado) | `game/gamedata/itens-poe/campanha-poe.json` (`atos`, `areas` com `mapa`, `nivel`, `conexoes`, `monstros`, `chefes`) | gerado por `game/tools/montar-campanha-poe.mjs`; os ajustes da Engine (mobs e desenhos) vão para `game/gamedata/itens-poe/campanha-ajustes.json` — opcional, nasce na primeira edição |
| Ato jogável (dado do editor) | `game/gamedata/atos/poe-ato-N.json` (`fases` com `huntId`, `objetivos`, `conclusao`, `recompensas`; `conexoes`; `bossFinal`; versões em `_versoes/`) | editado na Engine (`game/admin/atos.mjs`, telas em `game/admin/itens-poe-telas.mjs`) |
| Terreno da área | a área é uma **hunt virtual sobre um mapa do Draevor** (`mapa` na área; a troca pela Engine vai para `game/gamedata/itens-poe/campanha-mapas.json` — opcional, nasce na primeira troca) | `game/systems/itens-poe/campanha.mjs` (`huntDaArea`, `trocarMapa`), `game/systems/hunt/terreno.mjs` (apelido de mapa) |
| Monstros da área | monstros do PoE como criaturas do bestiário do Draevor (status do PoE, desenho do Draevor) | `game/systems/itens-poe/monstros.mjs`; habilidades de chefe `itens-poe/habilidades.mjs`; raridade/mods `itens-poe/modificadores-monstro.mjs` |
| Chefe de ato | boss único registrado como entrada de `CATALOGO.bosses` com `poeChefeDeAto` | `itens-poe/campanha.mjs` (`registrarChefe`), `game/systems/bosses-unicos/*` |
| Pináculos | `poePinaculo` em `CATALOGO.bosses`, drop exclusivo | `game/systems/itens-poe/pinaculos.mjs` + `gamedata/itens-poe/pinaculos.json` |
| Motor de atos/fases (genérico) | liberação, conclusão, objetivos, portal, recompensa de ato, "Seguir" | `game/systems/campanha.mjs` (`faseDe`, `motivoParaNaoEntrar`, `faseLiberada`, `faseCompleta`, `conclusaoDa`, `matou`, `limpou`, `venceuBoss`, `abrirPortalDoBoss`, `proximaParaSeguir`, `registrarAto`, `recompensaDaFase`) |
| Entrar / portal / seguir | `game/systems/cacadas.mjs` (`entrar` — só conteúdo do PoE no oficial; `entrarNoPortalDoBoss`); `game/websocket/sessao.mjs` (avançar de fase, portal) | |
| Estado do personagem | `estado.campanha[dificuldade]` = `{ kills, completas, bosses }` | no PoE só a dificuldade padrão |
| Missões de gema | `game/systems/itens-poe/missoes-de-gemas.mjs` + `gamedata/itens-poe/missoes-de-gemas.json` | ver `poe-gems` |
| Prévia da área | `game/systems/itens-poe/previa-da-area.mjs` | números reais do PoE na janela da hunt |

`game/systems/campanha.mjs` também carrega a campanha antiga do Draevor (48 fases): no jogo oficial ela fica vazia e entram os atos
`poe-ato-*` (os outros atos do editor são ignorados — ver a porta em `registrarAto`).

## Conceitos do PoE e o que existe

- **Cidade:** áreas com `cidade` não são hunts (sem combate); fora de caçada o personagem está "na cidade" (vida, mana, ES e frascos cheios).
- **Conexões/transições:** o grafo do ato (`conexoes` em `game/gamedata/atos/poe-ato-N.json`); a próxima área abre pela conclusão da anterior.
- **Waypoint/checkpoint do PoE:** não existe como sistema. "waypoint" no código é ponto do percurso da Caça Automática
  (`hunt/percurso.mjs`), não teleporte. Proponha antes de criar (skill `draevor-architecture`).
- **Portal:** só o do boss do ato (aberto pela limpeza da última área NESTA execução).
- **Missões:** o objetivo da área (`conclusao`) + itens de missão (`gamedata/itens-poe/itens-de-missao.json`) + missões de gema.

## Regras

1. Conteúdo da campanha é **dado**: área, objetivo, recompensa e monstros pelos arquivos (ou pela Engine), não por `if` no código.
2. Nova área precisa de terreno (um mapa existente do Draevor) — não apague mapas de `gamedata/hunts/` nem o bestiário.
3. Toda regra de progressão passa por `systems/campanha.mjs` (servidor decide se entra; o cliente só mostra).
4. Instância, setores, andares, escalonamento da party e encontros são do motor (`draevor-engine`); a campanha os usa.
5. Recompensa paga uma vez por personagem (`reivindicarPremio`) e só com item do PoE (`so-itens-do-poe.mjs`).

## Testes de referência

`game/testes/itens-poe-campanha.test.mjs`, `itens-poe-atos.test.mjs`, `itens-poe-telas.test.mjs`, `itens-poe-pinaculos.test.mjs`,
`itens-poe-modificadores-monstro.test.mjs`, `missoes-de-gemas.test.mjs`. Os testes da campanha antiga (`campanha.test.mjs`,
`boss-do-ato.test.mjs`) são do Draevor clássico (categoria B, `docs/migracao-poe-matriz.md`).
