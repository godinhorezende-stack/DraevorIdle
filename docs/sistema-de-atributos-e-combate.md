# Sistema de atributos, modificadores e combate

Documento técnico do que **existe no código hoje**. Cada regra traz a origem: **[PoE]** reproduzida do Path of Exile 1, **[Adaptada]** inspirada no PoE com ajuste do Draevor, **[Draevor]** própria do jogo, **[Validar]** decisão temporária.

## 1. Arquitetura

| Camada | Arquivos | Papel |
|---|---|---|
| Motor de modificadores | `game/systems/combate/modificadores.mjs` | Conta única flat / increased / more, local e global, condição, validade, limite. Puro. |
| Fórmulas de combate | `game/systems/combate/formulas.mjs` + `gamedata/combate/formulas.json` | Armadura, acerto/evasão, bloqueio, crítico, arredondamento. Puras, sem sorteio escondido (o `roll` entra por parâmetro). |
| Limites | `game/systems/combate/limites.mjs` + `limites.json` | Tetos de resistência, penetração, crítico, ataque duplo, controle. Resistência com penetração numa conta só. |
| Dano contínuo / controle | `combate/dot.mjs`, `combate/controle.mjs` | Queimadura, veneno, sangramento, choque…; congelar, atordoar, lentidão. |
| Ficha do jogador | `game/systems/ficha.mjs` (`combate(estado)`) | Calcula **todos** os atributos finais do jogador a partir de equipamento, afixos, árvore, passivas, gemas, proficiência, imbuements, classe. É a fonte única que o combate e a tela leem. |
| Atributos dos monstros | `game/systems/mobs/atributos.mjs`, `curvas.mjs`, `raridade.mjs` | Curvas por level, faixa, classe, espécie e modificadores. |
| Simuladores | `combate/simulador.mjs`, `combate/simulador-mob.mjs`, `tools/simular-luta.mjs` | Estimativas sem mexer em estado. |
| Registro | `combate/registro.mjs` | Depuração por golpe (`COMBATE_LOG=1\|2`). |

O servidor é a autoridade: o cliente só mostra o que a ficha manda (`derived`), incluindo `origens` (o detalhamento).

## 2. Modificadores [PoE]

Forma: `{ id, tipo, valor, escopo, fonte, condicao?, alvo?, ate? }`.

- **flat** soma no valor. **increased** é % aditiva (negativo = reduced). **more** é % multiplicativa independente (negativo = less).
- Ordem: flat local → increased local → more local → flat global → increased global (uma soma só) → more global → limite e arredondamento.
- `increased` somados nunca passam de −100% (reduced demais zera, não inverte o sinal). `more` multiplica cada um por fora: 30% e 20% valem ×1,30 × 1,20 = 1,56.
- `condicao`, `ate` (expiração) e `alvo` (tag de habilidade) decidem se o modificador vale; quem não vale não entra na conta nem no detalhamento.
- Remover uma fonte (peça, buff, passiva) é filtrar a lista: `semFonte`.

Exemplos testados (`testes/modificadores.test.mjs`): 1.000 × (1 + 20% + 30% + 50%) = 2.000; 1.000 × 2 × 1,30 × 1,20 = 3.120.

## 3. Onde o motor já é usado

- Armadura, evasão e Energy Shield do jogador (`ficha.mjs` → `defesasDaFicha`), armadura em faixa (`faixaDeArmadura`) e precisão: `(base + planos) × (1 + %)`.
- Todos os atributos dos monstros (`mobs/atributos.mjs` → `compor`).
- `combinarModificadores` (formulas.mjs) delega ao motor.

**Ainda NÃO usa o motor** (somas próprias, funcionando e testadas): dano por elemento, crítico, velocidade de ataque/conjuração, leech, regeneração. São "somas de % por fonte" que a ficha já mostra com `origens`. Migrar é trabalho incremental e fica como pendência.

## 4. Fórmulas de combate

| Mecânica | Fórmula | Origem |
|---|---|---|
| Acerto | `precisão / (precisão + (evasão/4)^0,8)`, entre 5% e 95% | [PoE] (modo `poe`, atual) |
| Armadura | redução do dano **físico do golpe** = `armadura / (armadura + 5 × dano)`; não reduz elemental nem DoT | [PoE] (coeficiente 5 em `formulas.json`) |
| Bloqueio | só o teto 75% (golpe e magia); acerto/esquiva vem antes, depois o bloqueio; `glancingPct` 0 = anula | [Adaptada] |
| Resistência | efetiva = (resistência cortada no teto) − penetração, só quando positiva; fraqueza não muda; jogador teto 75%, mob teto 75%, fraqueza até −100% | [PoE] (tetos) / [Adaptada] (penetração global + específica) |
| Penetração | física só no físico; elemental global + do elemento; máx. 100; nunca altera a resistência exibida | [Adaptada] |
| Crítico | chance 0–100%; multiplicador sem limite; só quem tem crítico crítica | [Adaptada] |
| Entropia do acerto | desligada | [Validar] |
| Ataque duplo | 1 golpe extra por golpe, sem recursão, 100% do dano | [Draevor] |
| DoT | sem crítico, sem acerto, sem armadura; passa pela resistência no pulso | [Adaptada] |
| Arredondamento | o dano final é arredondado **uma vez**, no fim | [Draevor] |

Atributos dos monstros: `(base × fatores + fixos) × (1 + aumentos − reduções) × more`; os valores padrão reproduzem os de antes das curvas. [Draevor]

## 5. Fluxo do dano

Golpe do jogador (`hunt/combate.mjs`, `acoes.mjs`, `poderes.mjs`): dano base da arma/habilidade → modificadores ofensivos e afinidades → teste de acerto (precisão × evasão do bicho) → crítico → por tipo: armadura (só físico) e resistência com penetração (`hunt/resistencia.mjs`) → vida do bicho.

Golpe do bicho no jogador (`hunt/combate.mjs` → `contraAtaque`): esquiva/acerto → bloqueio → por tipo: armadura (físico), proteção do elemento, mitigação das gemas → energy shield → vida. Controle e DoT do bicho entram por `controle.mjs` e `dot.mjs`.

## 6. Cache

`Ficha.combate(estado)` guarda o resultado num `WeakMap` por estado; `Ficha.invalidar(estado)` o apaga e a sessão o chama no início de cada tique/comando — então equipamento, buff, gema ou level mudados valem no próximo tique/comando, nunca ficam velhos por mais que isso. Os atributos dos monstros ficam em cache por instância (`WeakMap`) enquanto nada que os muda mudar. [Validar] Dentro de um mesmo tique, uma mudança no meio (ex.: poção) só aparece na ficha se quem muda chamar `invalidar`.

## 7. Como estender

- **Novo atributo do jogador:** calcule em `ficha.mjs` (`calcularCombate`), use `simples`/`calcular` para a parte "planos × aumentos", adicione a chave em `origens` (`origensDaFicha`) e mostre em `frontend/client/src/sheet.mjs`.
- **Novo modificador de item:** afixo em `gamedata/itens` + sonda em `testes/atributos-efeito.test.mjs` e lista em `testes/itens-geracao.test.mjs`.
- **Nova fórmula de combate:** função pura em `combate/formulas.mjs` com coeficiente em `formulas.json`, testada em `testes/combate-formulas.test.mjs`.
- **Testes probabilísticos:** passe o `roll`/`rng` (o simulador usa semente `mulberry32`); nunca dependa de sorte.

## 8. Pendências e riscos

- Migrar dano por elemento, crítico, velocidades e leech para o motor, para ter uma só conta com `more` e condições.
- Modificadores com `condicao` e `alvo` ainda não são declarados por itens/passivas: hoje buffs temporários entram por `BuffPower.bonusDeCombate` e `Gemas.bonus`.
- Mecânicas do PoE **não** reproduzidas: caos, entropia, evasão por "chance de evitar" separada do acerto, bloqueio de magia por tipo de ataque além do teto.
- Balanceamento não foi alterado nesta etapa (as contas migradas dão o mesmo número de antes: provado por teste).
