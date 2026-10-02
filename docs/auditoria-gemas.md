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
