---
name: poe-gems
description: Gemas do Path of Exile 1 no Draevor — gemas ativas (562) e de suporte (262), nível e XP da gema, tabela de progressão, qualidade, tags, requisitos, custo de mana, recarga e tempo de conjuração, sockets/links e cores, compatibilidade e efeito dos suportes, gatilhos (Conjurar no Crítico, ao Receber Dano…), lacaios e totens, auras/maldições como reforço, a barra do PoE e as missões que dão gema. Use para registrar, compilar, balancear, mostrar ou depurar uma gema/skill, e para entender como a gema vira a magia que o motor executa.
---

# PoE — gemas

## A cadeia (do dado à skill executada)

```
gemas-poe.json (dado cru do PoEDB)
  → compilador-de-gemas (habilidade no nível: arquétipo, elemento, dano, custo, tempos, status funciona/parcial/não)
  → gemas-poe.mjs iniciar: molde do Draevor por formato × elemento → entrada em ACTION_CATALOG + item da gema (916.001+)
  → skills/gemas.mjs: gema-instância { id, nivel, xp, raridade, qualidade } num socket de peça vestida
  → suportes LIGADOS no mesmo grupo (suportes-poe.mjs, 914.001+) → efeitoNaSkill (a skill modificada)
  → barra do PoE (acoes.mjs sincronizarBarraComGemas) → combo (combo.mjs) → disparo (acoes.mjs disparar)
```

| Peça | Onde |
|---|---|
| Definição das ativas | `game/gamedata/itens-poe/gemas-poe.json` (`game/tools/importar-gemas-poe.mjs`), ids estáveis `gemas-poe-ids.json` |
| Definição dos suportes | `game/gamedata/itens-poe/suportes-poe.json`, ids `suportes-poe-ids.json`, compatibilidade `suportes-compat.json` (`itens-poe/compat-suportes.mjs`) |
| Interpretador (gema crua → habilidade no nível) | `game/systems/itens-poe/compilador-de-gemas/{compilador,progressao,regras,arquetipos}.mjs` — código do repositório desde 08/10 (veio da coleção do dono) |
| Registro no jogo | `game/systems/itens-poe/gemas-poe.mjs` (`iniciar`, `doSlug`, `daAcao`, `fichaNoNivel`, `statusNoJogo`, `danoNoNivel`, `custoNoNivel`, `buffNoNivel`, `gemaDaTabelaDeXp`) |
| Suportes no jogo | `game/systems/itens-poe/suportes-poe.mjs` (`efeitoNoNivel`, gatilhos, `statusNoJogo`) |
| Instância, sockets, XP, efeito | `game/systems/skills/gemas.mjs` (`novaGema`, `itemDaGema`, `novaGemaDoItem`, `encaixar`, `tirar`, `soquetesDe`, `skillsAtivas`, `efeitoNaSkill`, `tempoDeConjuracao`, `ganharXp`, `xpParaSubir`, `registrarAtiva`, `registrarSuporte`, `darGemasIniciais`, `catalogoDaLoja`/`comprarNaLoja`) |
| Grupos ligados e compatibilidade (cliente e servidor) | `game/engine/sockets-de-gema.mjs` (`gruposLigados`, `compativel`) |
| Reforços (aura, maldição, postura) | `game/systems/skills/reforcos.mjs` |
| Lacaios e totens | `game/systems/itens-poe/lacaios-poe.mjs` |
| Tags | `game/systems/skills/tags.mjs`, `acoes.mjs` `tagsPoeDaSkill` |
| Estilo visual | `game/systems/itens-poe/estilos-das-gemas.mjs` |
| Missões que dão gema | `game/systems/itens-poe/missoes-de-gemas.mjs` + `gamedata/itens-poe/missoes-de-gemas.json` |
| Balão / ficha da gema | rota `gema` em `game/admin/itens-poe-http.mjs`; cliente `frontend/client/src/tooltip.mjs`, `soquetes.mjs` |

## Separe sempre

- **Definição** (o JSON) ≠ **instância** (o que o personagem tem: nível, XP, qualidade, raridade) ≠ **skill executável** (entrada em
  `ACTION_CATALOG` com `poeGema`) ≠ **modificador de suporte** (o efeito no nível, aplicado em `efeitoNaSkill`) ≠ **progressão**
  (tabela de XP da gema; transfiguradas/Vaal sem XP usam a da base).
- O nível e a qualidade mudam os números pela tabela do PoE (`fichaNoNivel`), não por um "bônus por nível" inventado.
- No PoE não há recarga global: cada gema tem os próprios tempos (`temposNoNivel`).

## Regras

1. Gema nova ou mudança de dado: pelo tool de importação + ids estáveis (só crescem; a peça salva guarda o número).
2. Efeito novo de gema/suporte: primeiro o interpretador (`compilador-de-gemas/regras.mjs` reconhece a linha) ou a tradução para as
   chaves do motor de suportes; só depois o combate. Linha que o jogo não faz entra em `naoFeitas` e baixa o status — não esconda.
3. A gema do PoE reaproveita um **molde do Draevor** (`MOLDES` em `gemas-poe.mjs`) para o motor executar; o molde é técnico (forma,
   projétil, área), o número vem da gema.
4. Só item do PoE entra: suportes/gemas do Draevor (911.xxx, 912.xxx) não caem nem se compram no jogo oficial (`so-itens-do-poe.mjs`).
5. Status hoje (do próprio catálogo): ativas 86 funcionam / 457 parciais / 19 não; suportes 61 / 168 / 33. Mudou o interpretador?
   Compare a contagem (o boot do servidor imprime).

## Dependências externas

- Em execução: nenhuma — gemas, suportes, ícones e o interpretador estão no repositório (`gamedata/itens-poe/`, `icones-gemas/`,
  `icones-suportes/`, `compilador-de-gemas/`).
- Só local (Engine/tools): `game/admin/gemas-poe.mjs` (Arena de Gemas) e `game/tools/importar-gemas-poe.mjs` leem a coleção externa
  `REFERENCIAS_POE/poe-gemas-poedb` e `poe-suportes-poedb`. Mudança no interpretador é feita no repositório, não na coleção.

## Testes de referência

`game/testes/itens-poe-gemas.test.mjs`, `missoes-de-gemas.test.mjs`, `barra-poe.test.mjs`, `combo-poe.test.mjs`.
