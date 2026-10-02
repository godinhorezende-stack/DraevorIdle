# Auditoria das gemas (fase 1: inventário e diagnóstico — nada foi alterado)

Gerado por `node tools/auditar-gemas.mjs` (add `--json` para os dados). Personagem de referência: level 300, perícias e magic level a 40% do level, equipamento inicial — os números são os do catálogo de ações (`Acoes.catalogo`, o mesmo `danoMostrado` do balão). **DPS aqui é teórico de UMA habilidade sozinha** (`dano médio ÷ max(recarga, recarga do grupo, intervalo global)`), sem crítico, sem suportes, sem alvo. Não é rotação: a rotação real divide o intervalo global (≈2 s) entre todas as habilidades, e isso só o motor mede (fase 2, simulador de rotação).

Inventário: 132 ações (114 magias + 18 runas); por vocação, só as que ela pode usar. Os suportes (`gamedata/gemas/supports.json`, 40) e os reforços (`reforcos.json`) são auditados na fase 2.

## Resumo por vocação (habilidades de dano com custo)

| Vocação | Qtd | DPS mediano | DPS máximo | Maiores (DPS / mana / forma) |
|---|---|---|---|---|
| Knight | 12 | 159 | 307 | Fierce Berserk 307/360 (área); Shield Bash 289/30 (área); Front Sweep 288/200 (onda) |
| Paladin | 9 | 103 | 179 | Ethereal Barrage 179/135 (área); Divine Barrage 167/175 (área); Strong Ethereal Spear 152/55 |
| Sorcerer | 25 | 103 | 191 | Ignite e Electrify 191/30 (alvo único, recarga 15 s); Great Fire Wave 161/120 |
| Druid | 22 | 103 | 189 | Terra Wave 189/170 (onda); Envenom 132/30; Strong Ice Wave 125/170 |
| Monk | 13 | 160 | **645** | **Chained Penance 645/180 (cadeia)**; Greater Flurry 369/300; Double Jab 310/30 |

## Problemas encontrados (medidos)

1. **Monk fora da curva.** Chained Penance dá 3,4× o melhor DPS de qualquer outra vocação (645 contra 191). Double Jab: 310 DPS por 30 de mana, e Swift Jab 196 DPS por 3 de mana. A mediana do Monk (160) é 55% acima da de Paladin, Sorcerer e Druid (103).
2. **Cura do Knight mais eficiente que a do Druid.** Wound Cleansing, Fair e Intense Wound Cleansing rendem 15–16 de cura por mana; as curas do Druid e do Sorcerer rendem de 3,3 a 8,8 (Nature's Embrace, 10,3). Fair Wound Cleansing (1.443 por 90 de mana) supera Ultimate Healing (612 por 160). Contradiz a identidade do Druid como curandeiro.
3. **Eficiência de cura cai com o tamanho da cura.** Light Healing 8,8 cura/mana; Intense 4,6; Ultimate e Divine 3,8. Não há razão para a magia grande ser pior, e é por isso que a de 20 de mana vira a escolha obrigatória.
4. **Paladin é o mais fraco em dano e não tem vantagem compensatória visível aqui.** DPS máximo de 179, mediana 103, cura mais cara que a do Monk. Crítico e velocidade (a identidade dele) só aparecem na fase de rotação com equipamentos.
5. **Habilidades quase sem uso.** Divine Grenade 18 DPS por 160 de mana; Holy Flash 16 por 30; Curse 6 por 30; Physical Strike do Druid 27 DPS; Magic Patch cura 27 por 6 de mana (o dano nem acompanha o level 300). Rage of the Skies, Hell's Core, Wrath of Nature e Eternal Winter dão 28–32 DPS por 600–1.100 de mana (são explosões de recarga de 20 s; só valem em área).
6. **Runa sem custo de mana.** Holy Missile Rune (Paladin): 129 DPS e 0 de mana, mais que várias magias. O custo real é o item da runa; precisa ser medido contra o preço e a oferta.
7. **Intervalo mínimo.** O intervalo global é de 2.000 ms (1.905 com a conjuração do Sorcerer/Druid de referência) e a maior parte das habilidades tem recarga de 1.000–2.000 ms, ou seja: o intervalo global, e não a recarga, limita o DPS de quase tudo. Baixar para 500 ms (pedido do prompt) multiplicaria o DPS de todas as habilidades de recarga curta por até 4× no limite e mudaria o balanceamento inteiro; não é um ajuste local.
8. **Funções repetidas.** 6 "strikes" do Sorcerer/Druid (Flame, Energy, Terra, Ice, Death, Apprentice) diferem só por elemento e alguns pontos de dano; Strong/Ultimate dos mesmos elementos também. É intencional (identidade elemental), mas a diferença entre Strong (474 por 60 de mana, recarga 4 s) e o básico (204 por 20, recarga 1 s) é de DPS de 119 contra 107 — o Strong custa o triplo de mana por 11% a mais de DPS.

## O que ainda NÃO foi medido (não há número aqui)

Suportes e multiplicadores de custo; reforços e tooltips; rotação completa com o intervalo global; mana sustentada; alvos múltiplos reais; cura contra dano recebido; combinações e builds; wand contra rod; matriz entre classes com equipamento. Os números acima são de habilidades isoladas e não valem como conclusão de balanceamento.

---

# Fase 2: simulador de rotação (motor real) — resultados MEDIDOS

Ferramenta: `node tools/simular-rotacao.mjs --matriz [--duracao 60]` (cada gema de ataque sozinha, 60 s, em 1 e em 5 bonecos) e `--grupo skill+suporte…` para builds. Núcleo: `game/systems/combate/simulador-rotacao.mjs` — roda `Cacadas.tique` (intervalo global, recarga, conjuração, mana, suportes, tique de 250 ms), lê o dano do registro de golpes do motor e usa semente fixa. Testes: `game/testes/simulador-de-rotacao.test.mjs`. Personagem de referência: level 300, perícias a 40%, gemas no nível 1, sem crítico extra, boneco com resistência 0, que não ataca. **Os números abaixo são o DPS só das gemas** (sem o golpe básico e a wand que batem entre uma magia e outra).

## Resultado por vocação (gemas sozinhas)

| Vocação | Mediana 1 alvo | Mediana 5 alvos | Melhor 1 alvo | Melhor 5 alvos | Regen. de mana/s |
|---|---|---|---|---|---|
| Knight | 161 | 562 | Fierce Berserk 308 | Fierce Berserk 1.229 · Shield Bash 1.163 | 9 |
| Paladin | 103 | 119 | Ethereal Barrage 183 | Ethereal Barrage 902 | 27 |
| Sorcerer | 65 | 113 | Great Fire Wave 156 | Great Fire Wave 652 | 57 |
| Druid | 72 | 129 | Strong Terra Strike 138 | Forked Thorns 619 | 57 |
| Monk | 161 | 196 | **Chained Penance 670** | **Chained Penance 3.250** | 18 |

## Achados novos (só o simulador mostra)

1. **Inversão de identidade em área.** O Sorcerer, que deveria ser o "excelente em área", tem a mediana mais baixa de 5 alvos (113) e o melhor de 652; o Knight chega a 1.229 e o Monk a 3.250. Shield Bash do Knight faz 1.163 de DPS em 5 alvos por 30 de mana — a área mais barata do jogo.
2. **Chained Penance** é 5× o melhor DPS de qualquer outra classe em 5 alvos (3.250 contra 652 do Sorcerer) e 4,3× em alvo único, a 180 de mana.
3. **Mana não sustenta as áreas fortes.** Gasto contra regeneração (por segundo): Knight Fierce Berserk 120 contra 9; Monk Chained Penance 90 contra 18; Paladin Ethereal Barrage 67 contra 27. O Sorcerer e o Druid sustentam quase tudo (regen 57), mas só Great Fire Wave e Hell's Core chegam perto do teto. Hoje o jogador cobre a diferença com poções, que o simulador **não** conta.
4. **O intervalo global é quantizado pelo tique de 250 ms.** Uma magia com intervalo de 1.905 ms sai de fato a cada 2.000–2.250 ms (≈ 1,88–2 s medidos). O DPS real fica de 5% a 8% abaixo do teórico da fase 1 (Energy Strike: 107 teórico, 91 medido).
5. **O 1º slot de ataque monopoliza a rotação.** Com recarga menor que o intervalo global, a magia do slot 1 está pronta toda vez que o global libera, e as de baixo nunca saem (testado: Energy Strike no slot 1, Fire Wave no slot 2 → Fire Wave com 0 de dano). Comportamento de prioridade por slot, não bug: obriga a pôr as magias de recarga longa em cima.
6. **O dano da gema não atinge a soma do catálogo.** O balão diz 126–156 para Energy Strike, mas os acertos medidos contra o boneco saem de 106 a 165 (variação do dano e do crítico de 3%); a média bate com o catálogo dentro da variação.
7. **Beam e Wave de 1 alvo dão 6–9 de DPS no simulador** (Energy Beam, Great Energy Beam, Terra Wave, Strong Ice Wave, Ice/Terra Burst): é artefato do posicionamento do boneco único (fica fora da forma da magia), **não** um achado de balanceamento; só a coluna de 5 alvos vale para essas gemas.

## Ainda não medido

Suportes e multiplicadores de custo em combinações; wand contra rod; rotações multi-habilidade com buffs e curas; cenários de sobrevivência (os bonecos não atacam); cura contra dano recebido; hunts de 15 e 30 min com poções; a matriz de classes com equipamento avançado.

---

# Fase 3: rebalanceamento aplicado (02/10) — antes e depois MEDIDOS

Decisões do dono: baixar o Monk; baixar Knight e Monk e subir Sorcerer e Druid em área; corrigir a cura do Knight e subir a do Druid; **não mexer** no intervalo global (2 s). Botões: `fatorDeDano` (já existia), e os novos `fatorDeCura` e `fatorDeCusto`, todos em `gamedata/gemas/skills.json` (uma linha por gema; nada mais mudou nos dados nem na estrutura de personagens, equipamentos ou slots).

## DPS das gemas (simulador de rotação, 60 s, motor real, level 300)

| Vocação | Mediana 1 alvo | Mediana 5 alvos | Melhor 1 alvo | Melhor 5 alvos |
|---|---|---|---|---|
| Knight | 161 → 147 | 562 → 506 | 308 → 219 | 1.229 → 860 |
| Paladin | 103 → 124 | 119 → 143 | 183 → 192 | 902 → 902 |
| Sorcerer | 65 → 95 | 113 → 149 | 156 → 282 | 652 → **1.173** |
| Druid | 72 → 95 | 129 → 161 | 138 → 173 | 619 → 712 |
| Monk | 161 → 151 | 196 → 182 | **670 → 228** | **3.250 → 1.025** |

Mudanças principais (`fatorDeDano`): Chained Penance ×0,3, Greater Flurry ×0,55, Double Jab ×0,6, Flurry ×0,8, Sweeping Takedown ×0,85, Swift Jab ×0,8; Knight: Shield Bash ×0,55, Fierce Berserk e Berserk ×0,7, Front Sweep ×0,75, Shield Slam ×0,8, Groundshaker ×0,9; Sorcerer: ondas, feixes e Death Echo de ×1,5 a ×1,8, os "strikes" ×1,3, as Ultimate ×2,2, Rage of the Skies e Hell's Core ×2, Curse ×3; Druid: ondas ×1,4, Bursts e Ultimate ×2, Wrath e Eternal Winter ×1,6, strikes ×1,25; Paladin: lanças ×1,2, Caldera e Grenade ×1,5, Holy Flash ×3 (Barrages ficam como estavam). Resultado: a melhor área é a do Sorcerer (1.173), seguida de Monk (1.025), Paladin (902), Knight (860) e Druid (712); o Monk em alvo único deixa de ser 4,3× o resto (228 contra 219 do Knight).

## Cura (cura por mana, catálogo)

| Magia | Antes | Depois |
|---|---|---|
| Knight: Wound / Fair / Intense Wound Cleansing | 15,4 / 16,0 / 15,2 | 6,8 / 7,1 / 6,7 (cura ×0,8, custo ×1,8) |
| Light Healing (todas as vocações) | 8,8 | 6,8 (custo ×1,3) |
| Intense Healing | 4,6 | 6,9 (cura ×1,5) |
| Divine Healing (Paladin) / Ultimate Healing (Druid, Sorcerer) | 3,8 / 3,8 | 6,1 / 6,1 (cura ×1,6) |
| Restoration (Druid, Sorcerer) | 3,3 | 4,9 (×1,5) |
| Heal Friend / Mass Healing / Nature's Embrace (Druid) | 5,7 / 3,8 / 10,3 | 7,9 / 5,7 / 12,4 |
| Salvation (Paladin) | 5,5 | 7,1 (×1,3) |

A cura do Knight deixa de ser mais barata que a do Druid, e as magias grandes deixam de ser menos eficientes que a de 20 de mana.

## Limites desta rodada (honestidade)

- A cura de Intense/Ultimate/Restoration é **compartilhada** entre vocações (a gema é a mesma): o Sorcerer e o Paladin também sobem. Dar cura exclusiva ao Druid exigiria um fator por vocação (não existe).
- Não medi o efeito da cura no tempo de sobrevivência (os bonecos não atacam) nem o consumo de mana com poções.
- O Monk perde a "explosão" sem ganhar ainda a identidade de combo/janela proposta; isso fica para uma etapa própria, com proposta antes de implementar.
- Suportes, wand contra rod, buffs e tooltips dos buffs, e as gemas novas ainda não foram tratados.
- Travas automáticas (`game/testes/balanceamento-das-gemas.test.mjs`) medem no motor que o Monk não passa do Knight em alvo único (×1,5) nem do Sorcerer em área, e que a cura do Knight não é mais eficiente que a do Druid.

---

# Fase 4: suportes — auditoria medida e ajuste (02/10)

Ferramenta: `node tools/simular-suportes.mjs` (cada suporte ligado, só onde é compatível, a gemas representativas das 5 vocações, em 1 e em 5 alvos, 30 s no motor real; compara o DPS e a mana por segundo da gema com e sem o suporte). Cada número abaixo é a mediana dos casos compatíveis (7 a 16 por suporte).

## O que a medição mostrou

| Suporte | DPS 1 alvo | DPS 5 alvos | Observação |
|---|---|---|---|
| Greater Damage, Physical/Fire/Earth/Energy/Ice/Holy Damage | ×1,25 | ×1,25 | Os genéricos e os específicos davam o mesmo (25%): redundantes |
| Multiple Projectiles / Greater Multiple / Fork / Chain | ×1,00 | ×2,19 / ×2,83 / ×2,19 / ×2,38 | Não multiplicam em alvo único (correto); em grupo viravam área, **sem custo** |
| Explosion / Secondary Explosion / Impact | ×1,28–1,42 | ×2,43–3,02 | O mais forte em grupo, **sem custo** |
| Life Cost | ×1,10 | ×1,10 | Mana vai a zero (custo em vida de 1:1, irrisório com a vida alta); **combina com Life/Mana Leech e cura = mana infinita** |
| Faster Casting, Faster Attacks, Cooldown Recovery | ×1,00 | ×1,00 | **Inúteis** para a maioria das gemas (ver abaixo) |
| Increased Critical, Critical Damage | ×1,01–1,07 | ×1,01–1,07 | Fracos com 3% de crítico base: só valem com build de crítico |
| Ignite, Slow, Stun, Poison, Bleed | ×0,93–1,00 | ×0,98–1,00 | Pequena perda de DPS direto; o efeito é de controle/dano contínuo |

**Combinação dominante encontrada:** Flame Strike (20 de mana) + Greater Multiple Projectiles + Explosion + Greater Damage rendia **1.455 DPS em 5 alvos por 11 de mana/s**, mais que a melhor área nativa do jogo (Great Fire Wave, 1.173 por 60 de mana/s) com 1/5 do gasto, e em alvo único 283 (acima do melhor alvo único nativo, 282).

**Por que Faster Casting / Faster Attacks / Cooldown Recovery não fazem nada:** eles encurtam a recarga ou o tempo de conjuração da própria gema, mas quase todas as magias de ataque têm recarga e conjuração **menores** que o intervalo global (≈ 2 s), e é o intervalo global que limita a cadência. A única forma de deixá-los úteis é fazê-los encurtar também o intervalo global que a gema impõe; isso muda o ritmo de todo o combate e **não foi feito** (decisão anterior de não mexer no intervalo global).

## O que foi alterado

1. **Custo dos suportes agora MULTIPLICA** (`custoPct`, em `skills/gemas.mjs`): +30% e +20% valem ×1,3 × ×1,2; a economia (Mana Efficiency, −20%) também multiplica. O custo **extra** (positivo) não cresce com a raridade da gema; a economia continua crescendo.
2. **Custos novos em `supports.json`:** Multiple Projectiles +30%, Extra Projectile +15%, Greater Multiple Projectiles +50% (e o dano dos extras de 45% para 40%), Fork +25%, Chain +30%, Returning Projectile +25%, Explosion +30% (e o dano da explosão de 50% para 40%), Secondary Explosion +20%, Impact +20%, Greater Damage +10%, Life Cost +50% de custo (pago em vida) e +20% de dano (era +10%).
3. **Resultado da combinação dominante:** 1.455 → 1.174 DPS em 5 alvos, com 23 de mana/s (era 11) — igual à melhor área nativa, mas ocupando 3 sockets de suporte e com o dobro do gasto de antes; alvo único 283 → 266.

Travas novas em `game/testes/balanceamento-das-gemas.test.mjs`: custo multiplicativo, raridade sem encarecer, e a combinação barata não pode passar de 1,2× a melhor área nativa.

## Pendências desta fase

- **Faster Casting / Faster Attacks / Cooldown Recovery** seguem sem efeito para a maioria das gemas (decisão estrutural: precisam encurtar o intervalo global).
- **Life Cost + leech/cura** continua dando mana "infinita" para quem tem vida de sobra; o custo em vida precisa virar % da vida máxima para pesar de verdade.
- **Suportes defensivos, de controle e utilitários:** só existem Slow, Stun, Freeze, Ignite, Poison e Bleed; faltam suportes de defesa, eficiência, conversão de dano e mudança de comportamento (candidatas na fase de gemas novas).
- **Greater Damage × os de dano específico:** os específicos (25%) seguem igualando o genérico (25% + 10% de custo); falta separar (candidato: específicos a 30%).
- **Pierce** deu ×1,00 no simulador: provável efeito do posicionamento dos bonecos (a perfuração exige alvos em linha), não confirmado.
- Não medi os suportes de cura (Potent Healing) nem de duração (Skill Duration) no simulador (as gemas de teste são de ataque); a compatibilidade com cada tag foi verificada, mas o efeito não.
- Wand contra rod, buffs e tooltips dos buffs, rotações com vários slots e gemas novas continuam fora.
