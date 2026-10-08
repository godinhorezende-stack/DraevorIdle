---
name: poe-combat
description: Combate no modelo do Path of Exile 1 no Draevor — ataques e magias, corpo a corpo e projétil, acerto/erro (precisão × evasão), crítico, tipos de dano (físico, elemental, caos), conversão e "dano extra como", penetração, resistência, armadura, energy shield, bloqueio, roubo (leech), afecções (ignição, sangramento, veneno, congelar, eletrizar, resfriar), cargas, buffs/debuffs, recarga, velocidade de ataque/conjuração, área, dano contínuo e morte. Use para entender ou mudar qualquer conta de dano ou defesa, a ficha de combate ou o golpe do monstro.
---

# PoE — combate

O combate oficial é o do PoE 1, implementado **sobre o motor do Draevor**: as mesmas funções servem o clássico, com ramos
`ligado()` para o PoE. Pipeline real, com os nomes das funções: [references/pipeline-real.md](references/pipeline-real.md).
Documento técnico da base: `docs/sistema-de-atributos-e-combate.md`. Regras de mod: `docs/modificadores/`.

## Pipeline (conceito) × código

Conceito: Ação → Validação → Ataque/Conjuração → Acerto → Crítico → Cálculo → Conversão → Penetração → Resistência → Mitigação →
Dano final → Ao acertar → Roubo → Afecções → Morte.

No código **não há uma função por etapa**: o golpe básico passa por `round`/`golpear` (`game/systems/hunt/combate.mjs`), a skill da barra
por `Combo.tiqueDoCombo` → `Acoes.disparar` (`game/systems/acoes.mjs`), e o golpe do monstro por `contraAtaque`. As contas puras ficam em
`game/systems/combate/{formulas,limites,modificadores}.mjs` e `game/systems/hunt/resistencia.mjs`. **Antes de mudar, rastreie o caminho
real do golpe que você vai tocar** (as três entradas acima) e confirme com um teste.

## Regras

1. **Uma conta, um lugar.** Fórmula nova vai para `combate/formulas.mjs` (pura, coeficiente em `game/gamedata/combate/*.json`);
   modificador flat/increased/more passa por `combate/modificadores.mjs`; resistência com penetração por `combate/limites.mjs`.
   Nunca recalcule dano dentro de um sistema que só deveria pedir o dano (gema, item, encontro, boss).
2. **A ficha é a fonte dos atributos.** `Ficha.combate(estado)` (`game/systems/ficha.mjs`) é cache por estado; quem muda equipamento,
   buff, gema ou carga chama `Ficha.invalidar(estado)`. A tela do PoE (`systems/personagem/ficha-poe.mjs`) só MOSTRA o que a ficha tem.
   Contexto do golpe no PoE: `ModsPoe.fichaDoGolpe` (tags da skill, condições, alvo).
3. **Mods do PoE vêm traduzidos.** Linha de mod → atributo pelo `itens-poe/traduzir.mjs` (+ `gamedata/itens-poe/traducao.json`);
   mods condicionais em `itens-poe/condicoes-poe.mjs`; efeitos de estado (atordoar, mutilar, cegar, empalar…) em `itens-poe/mods-poe.mjs`.
   Mod novo do PoE: tradução/condição primeiro, não um `if` no combate.
4. **Afecções e cargas** têm módulo próprio: `itens-poe/afeccoes.mjs` (usa o `combate/dot.mjs` para o tempo), `itens-poe/cargas.mjs`.
   Crítico com afecção: regra do PoE (×1,5 nas afecções do crítico).
5. **Regra do PoE 1 vale sem perguntar** quando o modo é o PoE (decisão do dono); onde o PoE e o Draevor divergem, o ramo `ligado()` é do
   PoE. Não crie porta nova (`draevor-architecture`).
6. **Sorte injetável:** funções de combate recebem `rng`/rolagem quando testadas; nunca dependa de sorte em teste.
7. **Servidor decide.** Números que a tela mostra (balão da skill, ficha) saem das mesmas funções (`Acoes.danoMostrado`,
   `curaMostrada`), não de uma conta do cliente.

## Antes de mudar uma conta

- Qual entrada é afetada (golpe básico, skill, monstro, dano contínuo)? Rastreie no código.
- Já existe a conta? (`combate/formulas.mjs`, `combate/limites.mjs`, `hunt/resistencia.mjs`, `ficha.mjs`).
- Muda o número de algo que já existe em produção? Mostre antes/depois (os simuladores em `game/systems/combate/simulador*.mjs`).
- Vale no offline? A caçada offline roda o mesmo `Cacadas.tique` por 30 min e projeta o resto — teste nos dois.

## Testes de referência

`game/testes/combate-formulas.test.mjs`, `defesa-poe.test.mjs`, `ficha-poe.test.mjs`, `itens-poe-afeccoes.test.mjs`,
`itens-poe-cargas.test.mjs`, `itens-poe-combate.test.mjs`, `combate-limites.test.mjs`. Ver `draevor-testing` (classificação A–E).
