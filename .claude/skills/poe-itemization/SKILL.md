---
name: poe-itemization
description: Itens no modelo do Path of Exile 1 no Draevor — bases, classes, item level, raridade (Normal, Mágico, Raro, Único), qualidade, requisitos, sockets/links/cores, implícitos e explícitos, prefixos e sufixos com tiers, propriedades de Únicos, tradução de mods para atributos, equipar/tirar, slots (luvas, 2 anéis), mochila de 20 vagas, depósito, moedas de craft (Forja do PoE), serialização da peça no estado e validação no servidor. Use para criar, gerar, mostrar, equipar, guardar ou validar item — e antes de pensar em "outro sistema de itens".
---

# PoE — itemização

Existe **um** sistema de itens do PoE, já ligado ao inventário do Draevor. Não crie outro. O sistema antigo do Draevor
(`game/systems/itens/gerar.mjs`, afixos `af` do Draevor) só vale no clássico.

## Definição × instância

| | O quê | Onde |
|---|---|---|
| **Definição (dado)** | classes → bases (requisitos, implícitos, defesa/dano, ícone), pool de mods por arquétipo (prefixos e sufixos por família, com tiers: iLvl, peso, texto, faixas), Únicos | `game/gamedata/itens-poe/catalogo-itens.json` (gerado por `tools/importar-poe-itens.mjs`; lido por `itens-poe/catalogo.mjs` `catalogo()`) |
| **Pools especiais (dado)** | influências (Ancião, Criador, Cruzado, Redentor, Caçador, Senhor da Guerra), corrompido, bancada do mestre, essência, fósseis, velado, eldritch (Abrasador/Devorador), síntese, encantamento e outros — 23, fora do drop comum | `game/gamedata/itens-poe/pools/<pool>.json` (um por pool, `tools/importar-poe-itens.mjs --so-pools`); lido sob demanda por `itens-poe/catalogo.mjs` (`poolEspecial`, `poolEspecialDa`, `poolsEspeciais`) |
| **Regras (dado)** | raridades e quantos mods, pesos do drop, sockets, qualidade, frascos, moedas, ouro | `game/gamedata/itens-poe/regras.json` (`Catalogo.REGRAS`) |
| **Tradução (dado)** | linha de mod do PoE → atributo do jogo | `game/gamedata/itens-poe/traducao.json`, `atributos-novos.json`; código `itens-poe/traduzir.mjs` |
| **Item do catálogo do jogo** | cada base vira um item virtual em `ITEM_CATALOG` (ids `7.000.000+`, slot pela classe) | `itens-poe/jogo.mjs` (`iniciar`, `idDaBase`, `baseDoId`, `CLASSES_DO_JOGO`) |
| **Instância (a peça)** | `{ id, count, raridade, …, poe: { nome, raridade, ilvl, mods, af (traduzido), qualidade, sockets… } }` dentro do `estado` (mochila, corpo, depósito, bolsa) | geração `itens-poe/gerar.mjs` (`gerarPeca`) → `jogo.mjs` (`pecaDoJogo`, `qualidadeDoDrop`, `recalcular`) |

A peça vive no JSON do personagem: **serialização é o próprio estado**. Campos da instância: `systems/itens/item.mjs`
(`camposDaPeca`, `pecaEspecial`, `converterTudo`). Peça antiga é refeita no login por `jogo.mjs` `refazerPecasAntigas`
(`VERSAO_DA_TRADUCAO`) — mudança de tradução sobe a versão em vez de migrar à mão.

## Onde cada regra mora

- **Gerar** (raridade, base, mods por tier e iLvl, qualidade): `itens-poe/gerar.mjs` + `jogo.mjs` (`pecaSorteada`, `dropsDoMonstro`,
  `pecaDoBauInicial`, `armaInicial`, `frascoInicial`). Sorte só aqui. Ver `poe-loot` para QUANDO gerar. Base sem pool de mods só cai
  como Único (`jogo.mjs` `podeCairComo`); o implícito "±N Modificadores Prefixo/Sufixo permitidos" muda o limite (anéis especiais, Simplex).
- **Pool especial** (corromper, essência, fóssil, influência, velado, eldritch, bancada): o dado está em `gamedata/itens-poe/pools/`; o
  sistema que usa (a moeda em `itens-poe/moedas.mjs`, um encontro, um mapa) lê o seu com `poolEspecialDa(pool, classe, base.pool)`.
- **Sockets, links, cores:** `itens-poe/sockets.mjs` (máximo pela classe e pelo item level, sorteio de números/links/cores, orbes);
  regra compartilhada com a tela (grupos ligados, compatibilidade): `game/engine/sockets-de-gema.mjs`. Gemas nos sockets: `poe-gems`.
- **Requisitos (FOR/DES/INT e nível):** `systems/personagem/requisitos.mjs` (no PoE todos os requisitos da base valem).
- **Equipar/tirar e slots:** `systems/inventario.mjs` (`equipar`, `tirar`) + validação central `systems/itens/equipamento.mjs`
  (`SLOTS_DE_EQUIPAMENTO` com `gloves` e `ring2` no PoE, `validarEquipar`, duas mãos, munição).
- **Efeito na ficha:** `systems/afixos.mjs` (`soma` do equipado, inclui o `poe.af` traduzido) → `systems/ficha.mjs`; condicionais em
  `itens-poe/condicoes-poe.mjs`. Ver `poe-combat`.
- **Mochila e guarda:** `systems/inventario.mjs` (no PoE 20 vagas para não empilháveis: `vagasDaMochila`; o excedente vai para o
  depósito), `systems/bolsa.mjs` (bolsa de loot), `systems/deposito.mjs`.
- **Moedas de craft (Transmutação, Alquimia, Caos…):** `itens-poe/moedas.mjs` (`usar`, `linhasDaLoja`) + `gamedata/itens-poe/moedas-poe.json`.
- **Só item do PoE entra:** `itens-poe/so-itens-do-poe.mjs` (`podeEntrar`) em toda ENTRADA de item (loot, loja, mercado, troca, chão…).
- **Tela:** balão `frontend/client/src/itens-poe-balao.mjs` + `tooltip.mjs`; grade do corpo e cinto `inventory.mjs`; Engine
  `frontend/client/src/editor-itens-poe.mjs`, API `game/admin/itens-poe-http.mjs` (ícones em `/api/jogo/poe/icone/item/`).

## Validação no servidor

- Equipar: slot, requisito, duas mãos, munição — sempre `validarEquipar`; nada de confiar no que a tela mandou.
- Movimentos (mochila ↔ depósito ↔ bolsa) usam a peça apontada (`alvo`/`pilha`) e nunca perdem campos da instância.
- Item que entra por troca/mercado/loja: `podeEntrar` + posse + quantidade + capacidade, em transação quando envolve outro personagem.

## Antes de criar outro sistema de itens

1. Localize o atual (tabela acima). 2. É do PoE (`peca.poe`, ids 7.000.000+) ou do Draevor (`af`, ids baixos)? 3. Veja dependências
(`afixos.soma`, `ficha`, `inventario`, filtro, mercado, tela). 4. Estenda o do PoE (dado em `gamedata/itens-poe`, regra em `itens-poe/`).
5. O do Draevor sai quando o clássico for aposentado — não o use para peça do PoE (ex.: `gerarItem` do Draevor numa base do PoE gera
peça sem mods do PoE; foi um bug real da projeção offline).

## Testes de referência

`game/testes/itens-poe-jogo.test.mjs`, `itens-poe-mods.test.mjs`, `itens-poe-sockets.test.mjs`, `sockets-cores-poe.test.mjs`,
`itens-poe-aneis.test.mjs`, `itens-poe-pools.test.mjs`, `moedas-poe.test.mjs`, `filtro-poe.test.mjs`, `so-itens-do-poe.test.mjs`.
