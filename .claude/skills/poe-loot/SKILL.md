---
name: poe-loot
description: Loot no modelo do Path of Exile 1 no Draevor — o que cai quando o monstro ou o boss morre, quantas peças (raridade do monstro × quantidade), raridade e base da peça, item level, mods, qualidade, moedas, gemas, Únicos (e o anúncio), ouro, tabela de drop por monstro e itens de missão, drop exclusivo dos pináculos, sacola do boss, rodízio na party, filtro de loot do PoE, bolsa/auto-venda, a projeção da caçada offline e a regra "só item do PoE entra". Use para mudar chances, pesos, quantidades, tabelas ou o filtro, e para depurar "por que caiu/não caiu".
---

# PoE — loot

O servidor sorteia tudo; o cliente só vê o resultado. Os números moram em `game/gamedata/itens-poe/regras.json` (`drop`, `ouro`,
`moedas`, `sockets`) e nas tabelas `drops-por-monstro.json`, `itens-de-missao.json`, `pinaculos.json`.

## Pipeline: conceito × código

Conceito: Morte → Regras de drop → Candidatos → Base → Raridade → Mods → Finalização → Item no chão → Filtro → Coleta.

No Draevor **o loot não vai para o chão**: vai direto para a **bolsa de loot** do personagem, passando pelo filtro (o chão é só do que
o jogador larga). O caminho real (`game/systems/hunt/combate.mjs`):

1. **Morte:** `matarMonstro` (uma vez por morte: `alvo.recompensado`). Boss: `vitoriaNoBoss` (uma vez por luta: `hunt.vitoria`) →
   `Bau.novaSacola` (`systems/bau.mjs`).
2. **Quem leva:** sozinho, quem matou; na party, sorteio entre quem pode levar (`escolherDono`); ouro dividido (`entregarMoedas`).
3. **Peças do PoE:** `ItensPoeJogo.dropsDoMonstro(nível, tipo, rng, regras, quantidadeDoJogador, raridadeAumentada)`
   (`itens-poe/jogo.mjs`): `quantasPecas` (0,16 × bônus da raridade do monstro × modificadores de quantidade) → `pecaSorteada`
   (raridade pelos pesos com a "Raridade de Itens" do personagem → base pelo item level, sem Royale → `gerarPeca` com mods por iLvl →
   `qualidadeDoDrop`). Nível do drop: `nivelDoDropPoe`.
4. **Moedas do PoE:** `MoedasPoe.dropDoMonstro` (`itens-poe/moedas.mjs`); orbes de socket do PoE: `GemasDeSkill.sortearOrbesDoPoe`.
5. **Ouro:** `ItensPoeJogo.ouroDoMonstro` (faixa do nível × raridade × Gold Find).
6. **Tabela do monstro e missão:** `DropsPorMonstro.soltar` (`itens-poe/drops-por-monstro.mjs`; item de missão só com a missão
   aberta) → `Campanha.matou` (objetivo da área).
7. **Pináculo:** `Pinaculos.dropExclusivo` (`itens-poe/pinaculos.mjs`).
8. **Bolsa e filtro:** `Bolsa.porNaBolsa` (`systems/bolsa.mjs`: capacidade, "não coletar", auto-venda) com o filtro do PoE
   (`systems/afixos.mjs`: raridade, classe, iLvl, mods e tier, sockets; `previaDoFiltro` para a tela).
9. **Anúncio de Único:** `Anuncios.dropRaro` (`systems/anuncios.mjs`) — servidor inteiro.
10. **Offline:** 30 min tique a tique e o resto **projetado** (`systems/cacadas.mjs` `projetar`): a peça do PoE projetada sai do
    gerador do PoE (`pecaSorteada` com `baseFixa`), uma a uma — nunca a base crua.

O drop comum usa **só o pool normal** (como na campanha do PoE); os pools especiais (`gamedata/itens-poe/pools/`) entram pelo sistema de
cada um, nunca no sorteio da morte. Base sem pool de mods só cai como Único (`podeCairComo`).

Há também a tabela do bicho-base do Draevor (`alvo.loot`) e o drop de gemas/orbes do Draevor (`soltarDrops`, `darExtra`): no jogo
oficial a regra `podeEntrar` (`itens-poe/so-itens-do-poe.mjs`) deixa passar só o ouro dela.

## Regras

1. **Sorte só no gerador** (`itens-poe/jogo.mjs`, `itens-poe/gerar.mjs`); quem chama passa `rng` quando o teste precisa repetir.
2. **Número no dado**, não no código: chance, peso, quantidade, faixa de ouro em `gamedata/itens-poe/regras.json`.
3. **Toda entrada de item pergunta `podeEntrar`** — loot, sacola, prêmio, projeção. Item do Draevor não entra no jogo oficial.
4. **Uma vez só:** morte, vitória e prêmio de primeira vez são idempotentes; não pague em dois lugares.
5. Mudou chance/quantidade? Meça antes/depois com rng fixo e muitas mortes (ex.: 20 000) e mostre a distribuição.

## Onde mexer

| Quero mudar | Arquivo |
|---|---|
| quantas peças / pesos de raridade / iLvl máximo | `gamedata/itens-poe/regras.json` → `drop` |
| ouro | `regras.json` → `ouro`; `jogo.mjs` `ouroDoMonstro` |
| moedas | `regras.json` → `moedas`; `itens-poe/moedas.mjs` |
| drop de um monstro específico / item de missão | `gamedata/itens-poe/drops-por-monstro.json`, `itens-de-missao.json` (editáveis na Engine, aba Acts) |
| Únicos do pináculo | `gamedata/itens-poe/pinaculos.json` |
| filtro | `systems/afixos.mjs` (filtro do PoE) + `systems/bolsa.mjs` |

## Testes de referência

`game/testes/itens-poe-jogo.test.mjs` (quantidade, pesos, iLvl, qualidade), `itens-poe-pools.test.mjs` (raro sem mod, só pool normal), `moedas-poe.test.mjs`, `itens-poe-pinaculos.test.mjs`,
`itens-poe-atos.test.mjs` (tabela por monstro, item de missão), `filtro-poe.test.mjs`, `so-itens-do-poe.test.mjs` (loot e projeção offline).
