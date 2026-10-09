# Atributos-base das armas, qualidade e modificadores locais (estilo Path of Exile, adaptado)

Conta central e única: **`engine/arma.mjs`** (pura; lida pelo servidor e pelo tooltip do cliente via `/packages/shared/src/arma.mjs`). Integrada em `systems/ficha.mjs` (engine), `admin/item-power-editor.mjs` (editor) e `frontend/client/src/tooltip.mjs`.

## Auditoria — como era
- **Base:** cada arma do catálogo tinha um `attack` ÚNICO (sem mín./máx. na base), `range`, `minLevel`, `vocations`, `twoHanded`. O mín./máx. só existia na **faixa sorteada no drop** (`peca.base.attack = [piso, teto]`, pela raridade). Nenhum APS, crítico base de arma ou requisito explícito por atributo (os requisitos de STR/DEX/INT eram **derivados** da classe e do nível, `personagem/requisitos.mjs`).
- **Dano:** `ficha.ataqueMin/Max = round(faixa da peça + atk_flat + phys_add + proficiência)` e `regras.attackDamage`: `mult = 0,0425 × (perícia+4)`; sem faixa própria, `média ± 30%`; `+ level/5`.
- **Velocidade:** UM intervalo global, `2000 ms × (1+árvore) / (1 + atk_speed% + DEX%)` — **nenhuma arma tinha velocidade própria**.
- **Qualidade:** não existia para armas (só "qualidade" de gema: lesser/regular/greater).
- **Modificadores:** todos os afixos eram **globais** (somados de todas as peças em `Afixos.soma`); `phys_add` (dano adicional) entrava na base da arma antes do multiplicador de perícia, mesmo vindo de um anel.
- **Tooltip:** mostrava `Dano` (faixa sorteada) e o catálogo; não mostrava APS, crítico base, qualidade nem DPS.
- **Divergências encontradas:** o tooltip mostrava o `attack` da arma, mas o golpe real é `attack × 0,0425 × (perícia+4) + level/5` (±30%) — por isso o balão agora diz "Dano Físico" **da arma** e "DPS Físico" **da arma**, explicitando que não é o dano de uma habilidade nem o DPS do personagem; o editor mostra ao lado o **golpe básico real** da ficha.

## Como ficou
**Base** (`baseDaArma`): `attackMin`/`attackMax` (sem eles, o `attack` único), `aps` (padrão **0,5** = 1 golpe a cada 2 s, exatamente o de hoje), `critChance` (centésimos de %, o mesmo campo que a ficha já somava), `range`, `minLevel`, `reqStr/reqDex/reqInt` — campos de override de item validados por `engine/arma.mjs › validarBaseDaArma` (só em armas; APS de 0,1 a 5). Sem os campos, **a engine produz os mesmos números de antes**.

**Ordem do dano físico da arma:** `base (mín., máx.)` → `+ dano adicional LOCAL` → `× (1 + % dano físico local)` → `× (1 + qualidade/100)` = dano final da arma.
`danoMin = danoMinBase × (1 + q/100)`, `danoMax = danoMaxBase × (1 + q/100)` (após as etapas locais), `aps = apsBase × (1 + vel.local/100) × (1 + q/100)`.
**Velocidade:** APS base → × % local → × qualidade (= APS da arma) → **na ficha**: `intervaloBase = 1000 / APS da arma`, depois os aumentos globais (DEX, afixos, árvore, especialização) e os limites que já existiam (`Math.max(0,2, …)`).
**Crítico:** `critChance` base da arma × `(1 + % crítico local)`; a **qualidade não entra**. Alcance e requisitos também não.
**Qualidade (0–20%, regra do Draevor):** aumenta dano físico mín./máx. e APS; **não** altera crítico, alcance, requisitos nem dano elemental; aplicada **uma vez** (em `statsDaArma`; a ficha só consome o resultado). Wand/rod: o dano é o Magic Attack (poder da arma), então a qualidade só afeta a velocidade.
**Locais × globais:** locais ficam na peça (`peca.qualidade`, `peca.locais = { addMin, addMax, pctDano, pctVelocidade, pctCritico }`) e mudam só os números da arma; os globais continuam em `Afixos.soma`/árvore/gemas e entram na ficha **depois**, sem receber a qualidade e sem entrar na base mostrada da arma.
**DPS físico da arma** = `((dmgMin + dmgMax)/2) × APS final` — distinto de dano médio por ataque, do dano de habilidade (`acoes.mjs`, que usa o *poder da arma*) e do DPS efetivo do personagem.

## Simulações (valores reais da conta)
Base 30–50, APS 1,2, crítico 5%:
| Cenário | Dano físico | APS | DPS físico |
|---|---|---|---|
| sem qualidade | 30–50 | 1,20 | 48,0 |
| qualidade 10% | 33–55 | 1,32 | 58,1 |
| qualidade 20% | 36–60 | 1,44 | 69,1 |
| q10% + adicional 5–9 + 10% dano + 20% vel. local | 42,35–71,39 | 1,584 | 90,1 |
Golpe básico REAL (knight nv 50, perícia 10; relic sword com essa base): sem q 27–39 em 831 ms; q20% 31–45 em 693 ms (a ficha inclui perícia, level e DEX).

## As armas do PoE (modo PoE, 09/10)
- **APS da base:** a base virtual da arma do PoE (`itens-poe/jogo.iniciar`) leva `aps` = `ataques_por_segundo` do catálogo do PoE (Rusted Sword 1,55): o intervalo base do golpe básico e das gemas de ataque é `1000 / APS` (antes, 2 s para toda arma do PoE).
- **Velocidade de Ataque LOCAL:** na arma, "Velocidade de Ataque aumentada/reduzida em X%" sem condição é local, como no PoE — `itens-poe/jogo.separarVelocidadeLocal` tira de `atk_speed` (global) e põe em `poe.af.atk_speed_local`, que a ficha passa como `locais.pctVelocidade`. Com condição, e nas outras peças, segue global. As peças antigas são refeitas na entrada (`VERSAO_DA_TRADUCAO` 7).
- **Desarmado:** 1,2 ataques por segundo (833 ms) e o soco com a faixa de dano físico da CLASSE (`desarmado` em `gamedata/itens-poe/classes.json`: 2–8 no Marauder; 2–6 no Duelist, Templar e Scion; 2–5 na Ranger, Witch e Shadow), 0% de crítico — como no PoE (Path of Building › `data.unarmedWeaponData`). No clássico, sem arma, os 2 s e o `ataqueSemArma` de sempre.
- **Qualidade do PoE** (`poe.qualidade`) não mexe no APS (só no dano físico), como no PoE.
- **Duas armas:** o golpe alterna e cada um leva o tempo da sua arma — o intervalo base é a média dos dois (`Ficha.intervaloBaseDoGolpe`), × o "10% mais" de empunhar duas armas.
- **Na caçada** (e no PvP da arena) o golpe básico segue o relógio lógico das magias (`R.liberou` + `R.instanteLogico`): sem isso o tique de 250 ms arredondava 645 ms para 750 ms.
- Ainda **globais** na arma do PoE (o PoE os faz locais): "Adiciona X a Y de Dano Físico", "Dano Físico aumentado em X%" e "+X de Precisão".
Testes: `testes/velocidade-de-ataque-poe.test.mjs`.

## Requisitos de atributo
`reqStr/reqDex/reqInt` explícitos fazem `requisitoDe` devolver `{ todos: true, porAtributo }`: o personagem precisa de **todos** (como no PoE) — conferido ao equipar (`inventario.mjs`) e mostrado no balão; sem eles segue a regra derivada de sempre.

## Pendências de balanceamento (decisão sua)
1. Hoje **nenhum drop gera qualidade ou modificadores locais**: o modelo e a conta existem (peça + tooltip + editor), mas de onde vêm (drop, forja, moeda) não foi definido.
2. Os afixos legados (`phys_add`, `phys_dmg`, `atk_speed`, `crit_chance`) seguem **globais** (comportamento de antes); migrar os que caem em armas para "locais" muda números.
3. As armas existentes não ganharam APS/crítico/requisitos próprios (padrões = comportamento atual); definir uma tabela por tipo (garras, espadas, arcos…) é decisão de design.
4. Habilidades/gemas escalam pelo **poder da arma** (curva por nível de poder × raridade), não pelo dano físico da base: a qualidade não as afeta (documentado e testado).
Testes: `testes/arma-base.test.mjs` (AB1–AB18).
