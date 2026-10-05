# Auditoria do combate × Item Power — Etapas 1 e 2 (auditoria e proposta)

> **Estado:** só leitura. Nenhuma fórmula, peso ou dado foi alterado. Todos os números abaixo foram calculados chamando as **funções reais** do jogo (`Ficha.combate`, `regras.attackDamage`, `formulas.reducaoDeArmaduraPoe`, `atributos.chanceDeEsquiva`, `regras.blockChance`…) com os itens do catálogo, personagem sintético sem overrides. A implementação (Etapa 3) só começa depois da sua validação desta proposta.

## 1. Dano

### 1.1 Caminho do golpe básico do jogador (arma corpo a corpo e à distância)
Arquivo `systems/hunt/combate.mjs` → `round()` → `golpear()`; ficha em `systems/ficha.mjs` (`combate`); contas em `engine/formulas.mjs` + `systems/regras.mjs`.

| # | Etapa (ordem real no código) | Função / arquivo |
|---|---|---|
| 1 | **Acerto**: o golpe pode errar (a perícia treina igual) | `Defesa.errou` → `Atributos.chanceDeAcerto` → `Formulas.chanceDeAcertoPoe(precisão, evasão do mob)` (modo `poe`: `prec / (prec + (evasão/4)^0,8)`, entre 5% e 95%) |
| 2 | O mob pode **bloquear** (só quem tem bloqueio configurado) | `AtributosDoMob.bloqueou` |
| 3 | **Dano-base da arma**: faixa `[ataqueMin, ataqueMax]` da peça (valor do catálogo, ou a faixa sorteada no drop) + `phys_add`/`atk_flat` dos afixos + joias + munição | `Ficha.combate` (`ataqueMin/Max`) |
| 4 | **Faixa do golpe** pela perícia e pelo level | `regras.attackDamage` → `engine/formulas.attackDamage` (abaixo) |
| 5 | Sorteio inteiro uniforme em `[min, max]` | `regras.golpeDoJogador` |
| 6 | **+ proficiência** (`% da perícia como dano`) | `Proficiencia.daPericia` |
| 7 | **× "físico"** = `1 + (danoDoElemento.physical + afinidade da classe + reforços ligados)/100` — o `danoDoElemento.physical` já traz **STR × `STR_PHYSICAL_DAMAGE_PER_POINT`** (`efeitosDosAtributos.danoFisicoPct`), afixos `phys_dmg` e árvore | `Ficha.combate` (linha do `danoDoElemento`), `Ficha.afinidadePara`, `Reforcos.bonus` |
| 8 | × 2º golpe do ataque duplo (se for o extra) | `Limites.LIMITES.ataqueDuplo.danoDoSegundoGolpePct` |
| 9 | **Armadura do mob**, redução de dano do mob, **resistência do alvo menos penetração** | `hunt/resistencia.resistido` → `AtributosDoMob.reducaoDeArmadura` (`A/(A+5×dano)`), `Limites.resistenciaEfetiva`, `Limites.danoAposResistencia` |
| 10 | **Crítico** e multiplicadores finais, **um único `Math.round`** | `Ficha.rolarCritico`: `base × proficiência vs alvo × (crítico ? critMultiplier : 1) × onslaught × prey × árvore × efeitos de item` |
| 11 | Imbuement elemental (converte X% do golpe), elementais dos atributos, ataque duplo, leech | `elementalDoImbuement`, `elementalDosAtributos`, `Ficha.aplicarLeech` |

### 1.2 Dano mínimo e máximo — a fórmula realmente implementada
`engine/formulas.mjs › attackDamage({ attack, attackMin, attackMax, skill, level, variacao, fatorPericia })` (chamado por `regras.attackDamage` com `variacao = danoFisico.variacaoPct/100 = 0,30` e `fatorPericia = 0,0425`, de `gamedata/combate/formulas.json`):

```
multiplicador = fatorPericia × (skill + 4)                         // 0,0425 × (perícia + 4)
arma COM faixa (hi > lo):  min = max(1, floor(lo × multiplicador + level/5))
                           max = max(min, floor(hi × multiplicador + level/5))
arma SEM faixa (valor único, é o caso do catálogo):
                           média = attack × multiplicador + level/5
                           min = max(1, floor(média × (1 − 0,30)))
                           max = max(min, ceil (média × (1 + 0,30)))
```
- Mín. e máx. **não** são valores fixos do item: vêm de **um** `attack` (±30%) ou da faixa sorteada no drop (`p.base.attack`).
- O `level/5` é fixo e **não depende da arma**; a perícia (Melee/Distance, hoje 10 fixo no molde) é um multiplicador linear do `attack`.
- **Exemplo real** (`relic sword`, `attack` 42, perícia 10, level 50): `mult = 0,0425 × 14 = 0,595`; média = `42 × 0,595 + 10 = 34,99` → faixa **24–46** (confirmado por `Ficha.combate`: `damage {min 24, max 46}`).
- Outros: `sword` (14) lvl 8 → 6–13 · `magic longsword` (55) lvl 140 → 42–79 · `spear` (25, distance) lvl 10 → 11–22.

### 1.3 Wand e rod — **não usam `attack` nem `wand.min/max`**
`Ficha.combate`: `w.wand ? R.attackDamage({ attack: round(PoderDaArma.poderDaPeca(arma)), skill: Magic Level, level })`. O "ataque" da wand/rod é o **Magic Attack** = `poderDoNivel(nível de poder da arma) × fatorDaRaridade(raridade)` (`systems/armas/poder.mjs`, `gamedata/armas/poder.json`: `4 + 0,69 × nível`, raridade 1,00–1,25), fixo, sem sorteio. O `wand.min/max` do catálogo (ex.: 8–18, ou 803–1025 nos itens "Draevor") **não entra**. Exemplos: `snakebite rod` nv 6 → poder 8 → dano 1–4 (lvl 6); `Draevor Druid Rod` (`wand` 803–1025) → poder 10 → dano **2–5**.
O golpe da wand (`golpeDaWand`) sorteia entre `Ficha.damage.min/max`, soma proficiência, multiplica por `1 + (danoDoElemento + ML bônus + INT%)`, aplica resistência do alvo/penetração e crítico.

### 1.4 Habilidades ≠ dano da arma
As gemas/magias de ataque (`systems/acoes.mjs`, `danoNoLevel`) usam **o poder da arma** como "nível equivalente" (`Armas.Poder.poderEfetivo` → `nivelEquivalente` → reta do catálogo `danoNoLevel`), com **qualquer arma rendendo o poder inteiro em qualquer habilidade** (`afinidade` 1, `semArma` 0,15), piso legado, e com arma física a magia escala pelo "Dano" normal da ficha (`escalaDaMagia`). Portanto o dano final de uma habilidade **não é calculável só dos atributos-base** sem a gema, o level da gema e os suportes — o Item Power não pode (e não vai) apresentar isso como dano real.

### 1.5 O que existe e fica fora da conta do item
Dano elemental dos afixos (`<elemento>_dmg`), `phys_add` (soma ao mínimo X e ao máximo `proporcaoDoMaximo`×X), crítico (3% e +60% base; `critChance` das peças), ataque duplo, penetração (`phys_pen`, `elem_pen`), buffs/debuffs, reforços, prey, imbuement, gemas de suporte — são **modificadores** (afixos/jogador/situação), não atributos-base.
Velocidade: `intervaloDoGolpeMs = 2000 × (1 + árvore) / (1 + atk_speed + DEX%)` (`Ficha.combate`).

## 2. Defesas

### 2.1 Ordem real do golpe de um mob no jogador (`contraAtaque`, modo atual `poe` em `gamedata/combate/formulas.json`)
1. Sorteia a **chance de bloqueio** entre `blockChanceMin` e `blockChanceMax` da ficha (escudo + arma).
2. (modo `draevor`: bloqueia aqui; no modo `poe` atual o bloqueio vem **depois** da esquiva.)
3. "Esquiva" das gemas (`ficha.esquiva`).
4. **Evasion**: `Defesa.esquivou` = `Atributos.chanceDeEsquiva` e/ou **Chance to Avoid Damage** (`evitou`). O golpe inteiro não pega.
5. Dodge (charm) e Ruse (tier da armadura).
6. **Bloqueio** (modo `poe`): se bloqueou, o golpe **inteiro** é anulado (`glancingPct` = 0).
7. Dano bruto do mob (`Poderes.golpeCorpoACorpo` ou `R.ataqueDoMonstro`) × força (reforços/enfraquecido) × crítico do mob.
8. Controle e DoT calculados do dano antes da defesa.
9. **Proteção física** do equipamento (resistência, em %): `protegido = round(bruto × (1 − prot.physical/100))`.
10. **Armour** (modo `poe`): `R.danoRecebido(protegido, armour) = protegido × (1 − armour/(armour + 5 × protegido))` — sobre o dano **já reduzido pela resistência**, sem sorteio.
11. × prey de defesa × mitigação das gemas.
12. **Energy Shield** absorve (`Defesa.absorver`) → depois o *magic shield* (mana) → depois árvore (`Arvore.danoRecebido`) → **vida**.

**Diferença para a estrutura-exemplo do enunciado:** a esquiva (4) vem **antes** do bloqueio (6); o crítico é do **mob** (7), não do defensor; a resistência (9) vem **antes** da armadura (10); não há "penetração" do mob; o ES (12) é a **última camada antes da vida**, depois de resistência e armadura.

### 2.2 Magias e ataques à distância dos mobs (`poderes.mjs › dispararMagia`)
Esquiva das gemas / *Chance to Avoid Damage* / esquiva de longe → **bloqueio de magia** (**só** o afixo `spell_block`, teto 75%; o `defense` do escudo **não** bloqueia magia) → resistência do **elemento** → ES → magic shield → vida. **Evasion e Armour não atuam em magia** (`"Evasion não: só o golpe corpo a corpo"`; a armadura só entra em `contraAtaque`).

### 2.3 Cada atributo
| Atributo | Como funciona de verdade |
|---|---|
| **Armour** (`ficha.armor`) | Soma das bases (`armor` do catálogo no tipo Armour) × (1 + %) + adds. **Reduz só o golpe físico corpo a corpo do mob**, por fração `A/(A+5×dano do golpe)`: **depende do dano recebido** (retornos decrescentes; nunca chega a 100%); sem teto próprio; não interage com penetração do mob (não existe). Contra **o mob**, a armadura dele reduz **o seu** golpe (`resistido`) com a mesma fórmula. |
| **Block — chance** | `regras.blockChance(shielding, defesa)`: `base = defesa/50 × 12,5%`; `pericia = min(1,(shielding−10)/130)`; `chance = min(50%, base × (1 + 3×pericia))`, depois `+ block%` dos afixos, teto 75% (`ficha.bloqueioDaFicha`). A defesa usada = **escudo + ⌊defesa da arma/2⌋ + defesa extra + proficiência**. Depende do equipamento **e da perícia Shielding** (treinada) — não só do item. Escudo `vampire shield` (34): **8,5%** (shielding 10), 16,4% (50), 26,2% (100), 34% (140). |
| **Block — valor** | **Não existe valor de bloqueio**: é tudo-ou-nada (`glancingPct` 0): bloqueia 100% do golpe físico corpo a corpo (e, com `spell_block`, da magia). |
| **Evasion** | **Chance**, não redução: `esquiva = 1 − chanceDeAcertoPoe(precisão do mob, evasão)`, com a precisão do mob `10 + 4 × level` (`gamedata/mobs/atributos.json`). Mínimo de 5% de acerto (esquiva até 95%). Só golpe **corpo a corpo**. Depende da precisão do **atacante** e do level dele: contra mob lvl 50 (precisão 210) evasão 200 → **9,8%**, 800 → 24,8%; lvl 140 (precisão 570) evasão 200 → 5,0% (o chão do cálculo de 5% de acerto). Soma DEX × `DEX_EVASION_PER_POINT`. |
| **Energy Shield** | Barra que **absorve antes da vida, golpe e magia**, depois da resistência e da armadura. **Recarrega** 20% da barra/s após 3 s sem apanhar (`atributos-principais.json › energyShield`). Valor da peça = `armor × (2 + 0,05 × level da peça)` (× 0,75 se híbrida). Não reduz dano: é "vida extra". |
| Outras | **Proteção/resistência por elemento** (`ficha.protection`, teto 100%), **Chance to Avoid Damage**, esquiva das gemas, reduções da árvore/prey; **Vida** vem de STR e do level (não do item); regeneração/leech são afixos. |

**Defesas por item × derivadas do personagem:** o item dá `armor` (convertido por tipo/level em Armour/Evasion/ES) e `defense` (Block); STR/DEX/INT, level, Shielding, árvore e afixos são do personagem.

## 3. Item Power atual (Base v1) — o que ele é
`IP = Σ atributo × normalização × peso` (`systems/item-power.mjs`; pesos de fábrica 1 / 1,5 / 0,8 / 0,8 / 0,8; normalização 1; Block da arma ×0,5; curva por slot calculada da **mediana do catálogo**; classificação ±25% / +75%). É um **indicador comparativo dos atributos-base**, não tenta estimar poder de combate. Damage = `attack` (valor único); wand/rod = **0**; atributo ausente = 0 pontos.

### 3.1 Distorções encontradas (com números reais)
1. **Wand/rod com IP 0** (e fora da curva): o dano real da wand/rod existe (Magic Attack, `poderDaArma`) mas o IP lê `attack` (inexistente) → `terra rod` IP **0**, `snakebite rod` IP **0**, `Draevor Druid Rod` (`wand` 803–1025) IP **0**.
2. **Evasion e ES numa unidade que cresce com o level da peça**: `evasion = armor × (5 + 0,1×level)`, `ES = armor × (2 + 0,05×level)`; para o mesmo `armor`, a Evasion vale ~10× a Armour. Pontuada linearmente com o mesmo peso 0,8, **evasão domina o IP**: `amazon armor` (paladino, armor 13): Evasion 211 → IP **114,4**, mas isso é **+5,2%** de esquiva contra um mob de level 50 e 0% contra magia.
3. **ES como "pontos" × realidade de vida**: `dark lord's cape` (mago, armor 11): ES 58 → IP **46,4**; mas o mago nível 50 tem vida base **26** → o ES vale **223% da vida** — a peça protege proporcionalmente muito mais que o IP sugere, e o ES vale contra **magia e golpe**.
4. **Armour pontuada sem o dano do golpe**: `A/(A+5D)` — Armour 20 corta 28,6% de um golpe de 10 mas 2% de um de 200. Linear em pontos não representa isso.
5. **Block como rating**: 1 ponto de defesa = +0,25% de chance × `(1+3×perícia)`; o IP dá 1,5 pontos por ponto. Plausível como comparador, mas ignora a perícia e o fato de ser tudo-ou-nada só contra golpe físico.
6. **Dano**: `attack` é proporcional ao dano de golpe básico (faixa ±30% × `0,0425×(perícia+4)`), então comparar `attack` entre armas da mesma perícia é **consistente**; o `level/5` é fixo e comum. Mas armas à distância/melee/mágicas têm perícias diferentes e a wand usa outra fonte (ponto 1).
7. **Categorias sem normalização**: a curva é por slot (mitiga), mas escudo×arma×armadura continuam em "pontos" de naturezas diferentes; só devem ser comparados dentro da categoria.
8. **Níveis**: `minLevel` ausente em ~metade do catálogo (itens iniciais e custom) → sem referência.
9. **Doc desatualizado no código**: `gamedata/combate/formulas.json › _nota` diz que os valores são "os de HOJE (tibia/draevor)", mas os modos ativos são `poe`; o comentário de `armorDoPersonagem` fala que o `defense` "ainda não está ligado" (está, via `bloqueioDaFicha`); `golpeDaWand` comenta "dano 8–18" (hoje vem do poder da arma). Sem impacto no cálculo — só risco de confusão.

## 4. Proposta (Etapa 2) — nada disto está implementado

### A. Item Power Base v2 (comparativo, compatível com a v1)
Mantém a fórmula `Σ valor × fator × peso` e **mantém a v1 intacta** (`versaoDaFormula` 1 continua calculável; a tela mostra v1 e v2 lado a lado). Mudanças propostas, todas pela configuração/override (nenhum peso é trocado sem sua aprovação):
1. **Damage de wand/rod = Magic Attack real** (`Armas.Poder.poderDoCatalogo(meta)`; × fator da raridade quando houver a peça): corrige o IP 0 usando o mesmo número que a ficha usa.
2. **Evasion e ES em unidade comparável à Armour**: normalização configurável por atributo que desfaz o crescimento com o level da peça (`fator = 1/(A + B×level)` da própria `atributos-principais.json › bases`) — "armadura equivalente" — em vez de pontuar o número bruto. O dono escolhe se liga (default v2: ligado; v1: desligado).
3. **Block e Damage ficam como estão** (consistentes com a ficha), documentando que Block é rating e não %.
4. Pesos de partida sugeridos para a v2 **só depois** de você validar: 1,0 (Damage) / 1,0 (Block) / 1,0 (Armour) / 1,0 (Evasion eq.) / 1,0 (ES eq.) — ou manter os atuais; decisão sua.

### B. Item Power de Combate Estimado (novo, opcional, por cenário)
Indicador **separado**, sempre rotulado "simulação em cenário", nunca somado ao Base. Chama as funções reais; não reimplementa fórmula.

**Ofensivo (só para armas)** — para a classe/nível/perícia de referência configurados:
- Dano mín./máx./médio do golpe básico: `regras.attackDamage` com `Ficha.combate` do personagem de referência vestindo a arma (wand/rod: poder da arma); inclui STR/INT% e level/5 reais.
- Dano médio com crítico: `danoMedioComCritico(médio, critChance, critMultiplier)`.
- Chance de acerto contra um mob de referência: `chanceDeAcertoPoe(precisão do personagem, evasão do mob)`.
- Golpes/s: `1000/intervaloDoGolpeMs` da ficha. → **"DPS do golpe básico"** estimado = médio × crit × acerto × golpes/s. Rótulo: **sem habilidades/gemas** (limitação declarada, não "DPS real").

**Defensivo (só para peças defensivas)** — cenários configuráveis, cada um um **vetor próprio** (não somado):
| Cenário | Atua |
|---|---|
| Físico leve / físico pesado (golpe = X% da vida de referência) | Bloqueio (chance, tudo-ou-nada) + Esquiva (`1−acerto`) + Armour (`A/(A+5D)`) + resistência física + ES |
| Mágico (golpe = X% da vida) | só ES + resistência do elemento (+ `spell_block` se o item tiver) |
| À distância | tratado como o cenário que o jogo aplica a esse ataque (`poderes.mjs`: sem Evasion/Armour); declara-se quando não há dado |
- Resultado por cenário: **dano esperado recebido** e **vida efetiva** `EHP = (vida + ES) / fatores`, comparando "com a peça" × "sem a peça" (contribuição marginal da peça, sem penalizar quem não tem o atributo).
- Parâmetros (override): classe de referência por categoria (knight/paladin/sorcerer/druid/monk — as 5 reais), level de referência (padrão = nível da peça), perícia de referência, level do mob de referência (precisão/evasão pela curva real), % da vida por cenário, resistências de referência (0 por padrão).
- Sem dado = indicado: "não calculável" (habilidades, DPS real, magias do alvo reais, perícia treinada, afixos).

### C. Exibição e rotulagem
Cada número na tela leva um selo: **regra real do combate** (ex.: faixa de dano, chance de bloqueio) · **indicador comparativo** (Base v1/v2) · **estimativa em cenário** (Combate Estimado) · **não calculável**. Lado a lado: original × simulado, com o nível atualizando só a referência.

### D. Garantias
- Somente leitura sobre as funções do combate; nenhum `Ficha`/estado de jogo é mutado (estados sintéticos descartáveis).
- Testes comparam o estimador com chamadas diretas das funções reais para armas com faixa, escudos, armaduras (Armour/Evasion/ES), híbridos, wands/rods e itens sem atributos, e verificam valores extremos/arredondamentos (`floor`/`ceil`/`Math.round` únicos do `attackDamage`/`rolarCritico`).
- Configuração por override (`item-power`), com versão; mudar peso/cenário **nunca** toca em `gamedata/combate/*`.

### E. Decisões que preciso de você antes da Etapa 3
1. Posso corrigir o **Damage de wand/rod** (Magic Attack real) na v2, mantendo a v1 como está para comparação?
2. Liga a **normalização de Evasion/ES** por level na v2 (default) — ou prefere só o Combate Estimado tratar isso?
3. Classe de referência por categoria: **knight** (melee), **paladin** (distance), **sorcerer/druid** (magic) e **monk**? E a **perícia de referência** (a do molde, 10, ou uma por level)?
4. Cenários padrão: golpe físico leve = **5%** e pesado = **20%** da vida de referência, mágico = **10%**? (são só valores de partida; mudam por override).
5. Mantenho o Item Power Base v1 como padrão exibido e a v2 como opção, ou o contrário?
