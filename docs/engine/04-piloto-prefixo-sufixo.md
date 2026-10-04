# Piloto (Fase D) — modificadores de item com prefixo e sufixo: proposta para aprovação (04/10/2026)

Decisão do dono (04/10): o piloto **já adota prefixo/sufixo**. Este documento é o desenho concreto, para aprovar ANTES de mexer na
geração de itens. Referência: `poe-itens/**/modificadores-tiers.json` (PoEDB) — para cada família, o lado em que ela aparece no pool
`normal` (o drop comum); influência, essência, craft e delve foram ignorados.

## 1. Regras propostas

| Regra | PoE 1 (referência) | Proposta para o Draevor |
|---|---|---|
| Lado do mod | Cada família é prefixo OU sufixo | Cada um dos 56 mods ganha `lado: 'prefixo' \| 'sufixo'` (tabela abaixo) |
| Limite por lado | Mágico 1+1, raro 3+3 | **Máximo por lado = metade do máximo da raridade, arredondado para cima**: incomum 1+1, raro 2+2, épico 2+2, lendário 3+3, mítico 3+3 |
| Quantidade total | Por raridade | **Inalterada** (incomum 1–2 … mítico 5–6). Só muda QUAIS saem: o sorteio respeita o limite de cada lado |
| Famílias | Mods da mesma família não coexistem | Campo `familia` (por padrão = o próprio id: o comportamento de hoje, "não repetir o mesmo id"). O editor permite agrupar depois |
| Tiers | Variam por família, T1 = melhor | **Mantidos 5 tiers, T1 = o mais fraco** (a régua do Draevor; trocar mexe no balanceamento inteiro) |
| Item Level | Libera por mod/tier | **Inalterado** (`tiers.json` + `nivelMinimo`) |
| Pesos | Por mod | **Inalterados** (o peso de cada mod continua; o sorteio só pula o lado cheio) |

Peças que já existem: guardam os valores sorteados e **continuam válidas como estão**, mesmo com mais de 3 do mesmo lado (marcadas
como "fora do padrão" só para a forja: rerrolar respeita o lado dali em diante). Nenhuma conversão de dado salvo é necessária.
A essência ocupa uma vaga do lado do mod que ela traz.

## 2. Classificação dos mods (os 54 que caem hoje; os 2 desligados — `atk_flat` e `dmg_vs_elite` — ficam como prefixo, por serem de dano)

`ref.` = família equivalente no PoEDB e o lado dela no pool normal. **⚠** = a referência é ambígua ou não existe: decisão do dono.

### Prefixos (21)

| Mod do Draevor | Ref. PoE (pool normal) |
|---|---|
| `life` | IncreasedLife — prefixo |
| `mana` | IncreasedMana — prefixo |
| `energy_shield` | EnergyShield (base local) — prefixo |
| `armor_flat` | BaseLocalDefences — prefixo |
| `evasion` | IncreasedEvasionRating — prefixo |
| `armour_pct`, `evasion_pct`, `es_pct` | defesa local % — prefixo |
| `phys_add` | PhysicalDamage (adicionado) — prefixo |
| `phys_dmg` | LocalPhysicalDamagePercent — prefixo |
| `fire_dmg`, `ice_dmg`, `energy_dmg` | Fire/Cold/LightningDamage, ElementalDamagePercent — prefixo |
| `earth_dmg`, `holy_dmg`, `death_dmg` | sem elemento igual no PoE; **por analogia** aos elementais — prefixo |
| `elem_pen` | ElementalPenetration — prefixo |
| `move_speed` | MovementVelocity — prefixo (aparece nos dois; predominante prefixo) |
| `gem_level` | IncreaseSocketedGemLevel — prefixo |
| `dmg_vs_boss`, `dmg_vs_monsters` | **⚠** sem equivalente direto; proposta: prefixo (família de dano) |

### Sufixos (33)

| Mod do Draevor | Ref. PoE (pool normal) |
|---|---|
| `str`, `dex`, `int` | Strength/Dexterity/Intelligence — sufixo |
| `fire_res`, `ice_res`, `energy_res` | resistências — sufixo |
| `earth_res`, `holy_res`, `death_res`, `phys_res` | **por analogia** às resistências — sufixo |
| `atk_speed` | IncreasedAttackSpeed — sufixo |
| `cast_speed` | IncreasedCastSpeed — sufixo |
| `crit_chance` | CriticalStrikeChanceIncrease — sufixo |
| `crit_dmg` | CriticalStrikeMultiplier — sufixo |
| `accuracy` | IncreasedAccuracy — sufixo |
| `life_leech`, `mana_leech` | LifeLeech / ManaLeech — sufixo |
| `phys_pen` | ArmourPenetration — sufixo |
| `double_attack` | DoubleDamage — sufixo |
| `life_regen`, `mana_regen` | LifeRegeneration / ManaRegeneration — sufixo |
| `life_regen_pct`, `mana_regen_pct` | LifeRegenerationRate — sufixo |
| `control_resist` | AvoidStun / ailments — sufixo |
| `cooldown_recovery` | CooldownRecovery — sufixo |
| `skill_cost` | ManaCostReduction — sufixo |
| `avoid_damage` | avoidance — sufixo |
| `dmg_reduction` | **⚠** sem equivalente direto; proposta: sufixo (família defensiva) |
| `exp_bonus`, `gold_find`, `loot_bonus` | ItemFoundRarity — **⚠** existe nos dois lados (prefixo e sufixo); proposta: sufixo |
| `block`, `spell_block` | BlockPercent — **⚠** nos dois lados e fora do pool normal; proposta: sufixo |

Contagem: 21 prefixos, 33 sufixos. Por pool (só os mods que caem), **todos comportam 3+3**:

| Pool | Prefixos | Sufixos |
|---|---|---|
| arma corpo a corpo / distância | 12 | 10 |
| arma mágica | 11 | 10 |
| munição | 10 | 4 |
| escudo | 9 | 19 |
| livro | 11 | 17 |
| aljava | 8 | 5 |
| armadura (cabeça, peito, pernas) | 16 | 22 |
| bota | 10 | 18 |
| anel | 17 | 28 |
| amuleto | 21 | 31 |

Efeito esperado: numa peça cheia (3+3), cada prefixo de um pool com poucos prefixos (escudo, bota) sai com mais frequência do que
hoje, e cada sufixo com menos. A simulação do piloto mede isso por tipo de item antes da aprovação.

## 3. O que o piloto entrega (com prefixo/sufixo)

1. `atributos.json`: campos `lado` e `familia` em cada um dos 56 mods; `raridades.json`: `maxPorLado` por raridade. Validação nova (todo mod com
   lado; pool de cada tipo com prefixos e sufixos suficientes para a raridade máxima).
2. `gerar.mjs`: o sorteio respeita o limite por lado e a família (o resto da conta igual).
3. Forja/rerrolar e essência respeitando o lado; peças antigas "fora do padrão" preservadas.
4. Tooltip do jogo: os mods agrupados em Prefixos / Sufixos (só apresentação; o valor e o tier não mudam).
5. Engine: editor de modificadores (lado, família, faixas, pesos, pools), simulação antes × depois (distribuição por lado, por tipo de
   item, valor esperado na ficha), testes com rascunho, histórico em `gamedata/_historico`, aprovação.
6. Testes: os de geração (G1–G6) passam a checar o limite por lado; regressão das peças antigas.

## Decisões do dono (04/10, depois da proposta)

O dono foi além do piloto: o sistema de itens passa a seguir o PoE por inteiro, construído em paralelo e desligado em produção
(Fase 1, `ITENS_POE=1`), e só troca o jogo publicado quando ele aprovar (Fase 3).

1. **Raridades:** Normal, Mágico, Raro e Único, como na documentação (`poe-itens/Raridades`). Mágico: 1 mod 50% (só prefixo ou só
   sufixo), 2 mods 50% (1+1). Raro: 4 mods 80%, 5 mods 15%, 6 mods 5% (até 3+3). Poderes especiais só nos Únicos.
2. **Itens e mods:** só os da coleção (bases, famílias de prefixo/sufixo, únicos). O destino das peças atuais dos jogadores fica para a Fase 3.
3. **Conteúdo publicado:** copiar nomes, textos e valores do PoE como estão (o dono assume o risco de direitos; lembrar antes da Fase 3).
4. **Imagens do PoE:** podem ser associadas a entidades no jogo local de testes; fora do git e da produção.
5. **Elementos:** Fogo, Gelo, Raio e Caos — o Caos é um elemento próprio (`chaos`); terra, sagrado e morte continuam no Draevor.
6. **Atributos:** "todas do PoE, sem excluir nada" — todo texto de mod vira atributo (o que o Draevor já calcula, um atributo novo
   nomeado em `gamedata/itens-poe/atributos-novos.json`, ou um automático `poe.<texto>`). O efeito no combate entra por etapas (3b).
7. **Escala:** os valores do PoE entram sempre como estão, sem fator de escala.
