# Auditoria — preços de venda ao NPC × loot dos monstros

Gerado por `tools/auditar-precos-e-loot.mjs` (só leitura). Preço = `precoNpc` (`sell` × `quickSellRate` = 1), a mesma regra da venda e do Analisador.

## 1. De onde vem o preço dos 2.296 itens que caem dos bichos

| Origem do preço | Itens |
|---|---|
| catálogo capturado | 1.392 |
| calculado: curva por level | 370 |
| calculado: fixo de lixo (1) | 194 |
| sem preço (NPC não compra) | 138 |
| sem cadastro | 105 |
| calculado: compra × 0,25 | 97 |

Não há preço "padrão de 1 gold por erro": item sem `sell` vale 0 (o NPC não compra) em toda conta. O 1 gold vem de duas fontes, as duas DE PROPÓSITO: o `sell: 1` do catálogo capturado do servidor original e a regra do dono (30/09) para loot comum sem preço nenhum (lixo, produto de bicho, comida...). A raridade não muda o preço, também por decisão do dono.

## 2. Raridade de catálogo alta (épico/lendário/mítico), chance < 1% e venda ≤ 1 gold — 69 itens

O "Problema 1" relatado. Candidatos a REVISÃO ECONÔMICA (nada foi mudado):

| Item | id | Raridade | Venda | Origem do preço | Menor chance | Bichos | Hunts (até 3) |
|---|---|---|---|---|---|---|---|
| tainted heart | 43854 | lendário | 1 | calculado: fixo de lixo (1) | 0,002% | 7 | Jaded Roots |
| darklight heart | 43855 | lendário | 1 | calculado: fixo de lixo (1) | 0,002% | 8 | Walking Pillar |
| Bag You Desire | 34109 | épico | 0 | sem preço (NPC não compra) | 0,005% | 66 | Dark Thais |
| Bag You Covet | 43895 | lendário | 0 | sem preço (NPC não compra) | 0,005% | 27 | — |
| Draevor Bag Set | 55517 | mítico | 0 | sem preço (NPC não compra) | 0,005% | 23 | — |
| Draevor Bag | 55216 | mítico | 0 | sem preço (NPC não compra) | 0,005% | 2 | — |
| mini mummy | 10290 | épico | 1 | calculado: fixo de lixo (1) | 0,02% | 3 | Dark Pyramid |
| reins | 12308 | lendário | 0 | sem preço (NPC não compra) | 0,02% | 2 | — |
| stuffed toad | 10294 | lendário | 1 | calculado: fixo de lixo (1) | 0,02% | 1 | Amazon Camp |
| rat god doll | 17825 | lendário | 1 | calculado: fixo de lixo (1) | 0,024% | 2 | Port Hope Corym Dungeons |
| foxtail | 14142 | lendário | 0 | sem preço (NPC não compra) | 0,04% | 3 | — |
| leather whip | 12306 | épico | 0 | sem preço (NPC não compra) | 0,04% | 3 | — |
| preserved purple seed | 45656 | lendário | 1 | calculado: fixo de lixo (1) | 0,04% | 3 | — |
| giant shrimp | 12318 | lendário | 0 | sem preço (NPC não compra) | 0,04% | 4 | — |
| soul prism | 49164 | lendário | 1 | calculado: fixo de lixo (1) | 0,04% | 1 | — |
| golden can of oil | 12801 | épico | 1 | calculado: fixo de lixo (1) | 0,072% | 3 | — |
| die | 5792 | épico | 0 | sem preço (NPC não compra) | 0,08% | 8 | — |
| preserved violet seed | 45655 | lendário | 1 | calculado: fixo de lixo (1) | 0,1% | 2 | — |
| tagralt-inlaid scabbard | 37002 | lendário | 0 | sem preço (NPC não compra) | 0,104% | 1 | — |
| plain monk robe | 50257 | lendário | 1 | catálogo capturado | 0,14% | 1 | — |
| preserved light blue seed | 45654 | lendário | 1 | calculado: fixo de lixo (1) | 0,14% | 2 | — |
| amphora | 2893 | lendário | 1 | calculado: compra × 0,25 | 0,2% | 1 | Medusa Tower, Wild Life Raid - Oramond, Spike -8 |
| brinebrute inferniarch soul core | 50105 | lendário | 0 | sem preço (NPC não compra) | 0,2% | 1 | — |
| broodrider inferniarch soul core | 50107 | lendário | 0 | sem preço (NPC não compra) | 0,2% | 2 | — |
| gorger inferniarch soul core | 50108 | lendário | 0 | sem preço (NPC não compra) | 0,2% | 1 | — |
| forbidden fruit | 24966 | lendário | 1 | calculado: fixo de lixo (1) | 0,2% | 1 | — |
| tin key | 12305 | lendário | 0 | sem preço (NPC não compra) | 0,2% | 1 | — |
| preserved pink seed | 45652 | lendário | 1 | calculado: fixo de lixo (1) | 0,22% | 3 | — |
| preserved red seed | 45653 | lendário | 1 | calculado: fixo de lixo (1) | 0,22% | 3 | — |
| preserved yellow seed | 45657 | lendário | 1 | calculado: fixo de lixo (1) | 0,22% | 3 | — |
| preserved dark seed | 48505 | lendário | 1 | calculado: fixo de lixo (1) | 0,22% | 1 | — |
| slingshot | 5907 | lendário | 0 | sem preço (NPC não compra) | 0,24% | 1 | — |
| skull candle | 5813 | lendário | 0 | sem preço (NPC não compra) | 0,26% | 1 | — |
| Crafted Bronze Token | 55362 | lendário | 0 | sem preço (NPC não compra) | 0,28% | 1 | — |
| elven parchment | 30146 | lendário | 1 | calculado: fixo de lixo (1) | 0,3% | 1 | — |
| frost charm | 7289 | lendário | 0 | sem preço (NPC não compra) | 0,3% | 2 | — |
| eye patch | 6098 | lendário | 1 | calculado: fixo de lixo (1) | 0,3% | 10 | Glooth Bandits East |
| peg leg | 6126 | lendário | 1 | calculado: fixo de lixo (1) | 0,3% | 10 | Glooth Bandits East |
| hook | 6097 | lendário | 1 | calculado: fixo de lixo (1) | 0,3% | 10 | Glooth Bandits East |
| eye-embroidered veil | 37003 | lendário | 0 | sem preço (NPC não compra) | 0,312% | 3 | — |
| sun medal | 31573 | lendário | 0 | sem preço (NPC não compra) | 0,32% | 2 | — |
| nomad parchment | 7533 | lendário | 0 | sem preço (NPC não compra) | 0,34% | 5 | — |
| shadow mask | 24973 | lendário | 1 | calculado: fixo de lixo (1) | 0,4% | 1 | — |
| shadow paint | 24974 | lendário | 1 | calculado: fixo de lixo (1) | 0,4% | 1 | — |
| eye of the storm | 19369 | lendário | 1 | calculado: fixo de lixo (1) | 0,4% | 1 | — |
| rusted helmet | 8907 | lendário | 1 | calculado: fixo de lixo (1) | 0,44% | 1 | — |
| fist on a stick | 12546 | lendário | 1 | calculado: fixo de lixo (1) | 0,44% | 3 | — |
| suspicious device | 27653 | épico | 0 | sem preço (NPC não compra) | 0,5% | 6 | — |
| portable flame | 39545 | lendário | 0 | sem preço (NPC não compra) | 0,5% | 1 | — |
| firefighting axe | 39544 | lendário | 0 | sem preço (NPC não compra) | 0,5% | 1 | — |
| spectral scrap of cloth | 32629 | lendário | 1 | calculado: fixo de lixo (1) | 0,5% | 1 | — |
| strange inedible fruit | 48514 | lendário | 1 | calculado: fixo de lixo (1) | 0,5% | 1 | — |
| bar of chocolate | 6574 | épico | 1 | calculado: fixo de lixo (1) | 0,56% | 2 | Spike -8 |
| Lisa's doll | 21218 | lendário | 1 | calculado: fixo de lixo (1) | 0,6% | 1 | — |
| fireproof horn | 20356 | lendário | 0 | sem preço (NPC não compra) | 0,7% | 3 | — |
| red silk flower | 34258 | lendário | 0 | sem preço (NPC não compra) | 0,72% | 4 | — |
| wind-up loco | 37398 | lendário | 1 | calculado: fixo de lixo (1) | 0,72% | 1 | — |
| decorative plume | 37605 | lendário | 1 | calculado: fixo de lixo (1) | 0,72% | 1 | — |
| piece of marble rock | 10426 | lendário | 1 | calculado: fixo de lixo (1) | 0,76% | 4 | Deeper Banuta -8, Medusa Tower |
| holy scarab | 3023 | lendário | 0 | sem preço (NPC não compra) | 0,8% | 1 | — |
| final judgement | 31738 | lendário | 0 | sem preço (NPC não compra) | 0,8% | 5 | — |
| spectral saddle | 34073 | lendário | 0 | sem preço (NPC não compra) | 0,8% | 1 | — |
| spectral horse tack | 34074 | lendário | 0 | sem preço (NPC não compra) | 0,8% | 2 | — |
| the skull of a beast | 34075 | lendário | 1 | calculado: fixo de lixo (1) | 0,8% | 3 | — |
| spectral horseshoe | 34072 | lendário | 0 | sem preço (NPC não compra) | 0,8% | 2 | — |
| bracelet of strengthening | 34076 | lendário | 1 | calculado: fixo de lixo (1) | 0,8% | 2 | — |
| part of a rune | 24954 | lendário | 1 | calculado: fixo de lixo (1) | 0,8% | 2 | — |
| string of mending | 20208 | lendário | 1 | calculado: fixo de lixo (1) | 0,92% | 1 | — |
| clay lump | 10422 | épico | 1 | calculado: fixo de lixo (1) | 0,96% | 10 | Medusa Tower, Wild Life Raid - Oramond, Spike -8 |

## 3. Raridade alta que o NPC não compra (venda 0) — 59 itens

Moedas, fichas, bolsas, itens de quest/montaria ficam sem venda por regra; os demais podem merecer preço:

| Item | id | Raridade | Tipo | Menor chance |
|---|---|---|---|---|
| Bag You Desire | 34109 | épico | liquids | 0,005% |
| Bag You Covet | 43895 | lendário | liquids | 0,005% |
| Draevor Bag Set | 55517 | mítico | liquids | 0,005% |
| Draevor Bag | 55216 | mítico | liquids | 0,005% |
| reins | 12308 | lendário | taming items | 0,02% |
| foxtail | 14142 | lendário | taming items | 0,04% |
| leather whip | 12306 | épico | taming items | 0,04% |
| giant shrimp | 12318 | lendário | taming items | 0,04% |
| die | 5792 | épico | game tokens | 0,08% |
| tagralt-inlaid scabbard | 37002 | lendário | valuables | 0,104% |
| brinebrute inferniarch soul core | 50105 | lendário | soul cores | 0,2% |
| broodrider inferniarch soul core | 50107 | lendário | soul cores | 0,2% |
| gorger inferniarch soul core | 50108 | lendário | soul cores | 0,2% |
| tin key | 12305 | lendário | taming items | 0,2% |
| slingshot | 5907 | lendário | taming items | 0,24% |
| skull candle | 5813 | lendário | light sources | 0,26% |
| Crafted Bronze Token | 55362 | lendário | valuables | 0,28% |
| frost charm | 7289 | lendário | quest items | 0,3% |
| eye-embroidered veil | 37003 | lendário | valuables | 0,312% |
| sun medal | 31573 | lendário | valuables | 0,32% |
| nomad parchment | 7533 | lendário | documents and papers | 0,34% |
| suspicious device | 27653 | épico | amulets and necklaces | 0,5% |
| portable flame | 39545 | lendário | valuables | 0,5% |
| firefighting axe | 39544 | lendário | valuables | 0,5% |
| fireproof horn | 20356 | lendário | tools | 0,7% |
| red silk flower | 34258 | lendário | plants and herbs | 0,72% |
| holy scarab | 3023 | lendário | valuables | 0,8% |
| final judgement | 31738 | lendário | quest items | 0,8% |
| spectral saddle | 34073 | lendário | valuables | 0,8% |
| spectral horse tack | 34074 | lendário | valuables | 0,8% |
| spectral horseshoe | 34072 | lendário | valuables | 0,8% |
| epaulette | 28793 | lendário | quest items | 1% |
| holy falcon | 3024 | lendário | magical items | 1% |
| library ticket | 28791 | lendário | taming items | 1% |
| stone wall | 22555 | lendário | walls | 1% |
| shadow cowl | 31737 | lendário | quest items | 1,06% |
| golden bijou | 31575 | lendário | valuables | 1,16% |
| small tortoise | 31445 | épico | quest items | 1,34% |
| red ectoplasm | 30084 | lendário | quest items | 1,4% |
| spectral stone | 4840 | épico | quest items | 1,6% |
| Ferumbras' mana keg | 22769 | épico | valuables | 1,6% |
| Instance Hunts | 22771 | mítico | liquids | 1,6% |
| herald's insignia | 44753 | épico | valuables | 1,724% |
| herald's wings | 44754 | épico | valuables | 1,84% |
| bowl | 2902 | épico | kitchen tools | 2% |
| skin of Gralvalon | 49892 | épico | quest items | 2% |
| skin of Malvaroth | 49893 | épico | quest items | 2% |
| glooth glider casing | 21901 | épico | quest items | 2% |
| skin of Twisterror | 49891 | épico | quest items | 2% |
| witchesbroom | 3211 | épico | tools | 3% |
| tinged pot | 27656 | épico | quest items | 3,38% |
| Draevor Tier UP | 50051 | mítico | valuables | 3,4% |
| scrubbing brush | 35695 | épico | valuables | 3,58% |
| green ectoplasm | 30083 | épico | quest items | 3,78% |
| crackling egg | 23684 | épico | taming items | 4% |
| medicine pouch | 12517 | épico | quest items | 4,32% |
| golden horseshoe | 30319 | épico | valuables | 5,02% |
| soap | 35595 | épico | valuables | 5,36% |
| golden sea horse figurine | 31911 | épico | quest items | 5,64% |

## 4. Valor esperado por morte, por hunt (chances-base, sem bônus de loot)

Ouro das moedas + itens pelo preço do NPC, por bicho morto (média dos bichos da hunt). Serve para comparar hunts entre si, não é promessa de lucro.

| Hunt | Bichos | Ouro/morte | Itens/morte | Item que mais pesa |
|---|---|---|---|---|
| Dark Thais | 3 | 10.000 | 4.587 | violet gem (876) |
| Golems Catacombs | 7 | 10.876 | 3.655 | steel boots (459) |
| Prison -2 | 7 | 10.732 | 3.395 | steel boots (529) |
| Jaded Roots | 3 | 2.500 | 9.540 | violet gem (2.073) |
| Feru Way | 5 | 7.505 | 4.393 | giant sword (262) |
| Walking Pillar | 4 | 2.177 | 9.321 | twiceslicer (1.623) |
| Infernatil Seal | 6 | 6.698 | 4.608 | demonic essence (329) |
| DT Seal INQ | 4 | 7.818 | 2.662 | steel boots (758) |
| Ghastly Dragon Lair | 1 | 4.666 | 5.316 | terra legs (994) |
| Warzone 2 | 5 | 7.720 | 1.633 | blazing bone (131) |
| ROSHAMUUL CAVE | 6 | 4.415 | 1.770 | nightmare blade (173) |
| POI DT Seal | 6 | 4.202 | 1.826 | steel boots (505) |
| Asura Mirror | 7 | 2.730 | 2.834 | royal star (555) |
| Black Serpent Dungeon | 1 | 4.274 | 1.178 | Zaoan armor (274) |
| Abandoned Sewers | 5 | 3.935 | 1.368 | giant sword (135) |
| Medusa Cave | 2 | 3.600 | 1.453 | medusa shield (274) |
| Drefia Wyrm Caves | 3 | 3.220 | 1.280 | nightmare blade (205) |
| Burster Spectres | 1 | 100 | 4.268 | hailstorm rod (1.053) |
| Zaoan Draken Walls | 3 | 2.979 | 1.267 | Zaoan legs (266) |
| Glooth Bandits East | 2 | 2.050 | 1.894 | rubber cap (275) |
| Spike -8 | 10 | 2.578 | 1.051 | buckle (290) |
| Flimsy Lost Souls Venore | 3 | 1.903 | 1.524 | nightmare blade (205) |
| Falcons | 2 | 50 | 3.343 | violet gem (524) |
| Deeper Banuta -8 | 6 | 2.286 | 753 | medusa shield (97) |
| Cobra Bastion -1 | 3 | 100 | 2.548 | terra rod (573) |
| Summer Court | 8 | 100 | 2.540 | collar of green plasma (169) |
| Winter Dream Court | 5 | 80 | 2.503 | collar of red plasma (254) |
| Wild Life Raid - Oramond | 8 | 1.810 | 615 | composite hornbow (73) |
| Haunted Temple | 2 | 100 | 2.103 | mino shield (360) |
| Feyrist Nightmare | 2 | 1.140 | 985 | boots of haste (150) |
| Oramond Hydras | 4 | 1.493 | 412 | gearwheel chain (73) |
| Deathlings | 2 | 50 | 1.792 | warrior's axe (637) |
| Werelions -1 | 3 | 867 | 882 | serpent sword (200) |
| Netherworld | 2 | 100 | 1.638 | skull staff (272) |
| Sphinx Issavi | 5 | 100 | 1.537 | sea horse figurine (176) |
| Old Fortress - Hero Cave | 6 | 1.273 | 359 | crown armor (40) |
| Edron Were Mobs | 6 | 1.245 | 146 | dreaded cleaver (22) |
| Medusa Tower | 12 | 974 | 366 | medusa shield (46) |
| Werehyaenna North | 2 | 100 | 1.219 | hailstorm rod (193) |
| Cults Carlin | 4 | 1.088 | 164 | great health potion (43) |
| Putrid Mummies | 3 | 793 | 416 | green gem (102) |
| Hive Surface | 5 | 929 | 235 | epee (32) |
| Mother of Scarabs Lair | 4 | 442 | 171 | boots of haste (31) |
| Port Hope Corym Dungeons | 2 | 205 | 63 | ratana (18) |
| Mistrock Cyclops | 3 | 202 | 41 | cyclops toe (8) |
| Dark Pyramid | 5 | 108 | 51 | wand of cosmic energy (5) |
| Amazon Camp | 4 | 56 | 37 | necrotic rod (6) |
| Troll Cave | 1 | 20 | 10 | rope (2) |

## 5. Ids de loot SEM cadastro no catálogo — 105

Erro de dados: o bestiário manda dropar um id que o catálogo de itens não tem (sem nome, sem sprite, sem preço). A entrada SEM id nenhum ("rotten feather", "ritual tooth") passou a ser ignorada no combate (01/10: virava item fantasma na bolsa); as de id numérico sem cadastro ainda entram na bolsa como item sem nome que não vende (vale 0). Precisa decidir: cadastrar o item ou tirar o drop.

| id | Nome no bestiário | Menor chance | Bichos | Hunts (até 3) |
|---|---|---|---|---|
| SEM ID (ignorado) | rotten feather | 0,72% | 64 | Jaded Roots, Walking Pillar |
| 52719 | crystallized death | 3,78% | 8 | — |
| 51487 | norcferatu talisman | 1,2% | 7 | — |
| 51588 | proficiency catalyst | 6% | 6 | — |
| 52705 | necromantic core | 1,3% | 6 | — |
| 51442 | blank imbuement scroll | 2% | 6 | — |
| 52664 | stag parchment | 4,1% | 5 | — |
| 52663 | cuirass plate | 8,3% | 5 | — |
| 52662 | silver poniard | 3,06% | 5 | — |
| 52706 | toe nails | 3,88% | 5 | — |
| 52708 | fetid heart | 0,32% | 5 | — |
| 52709 | cryptic fossil | 1,3% | 5 | — |
| 53004 | infernoid ember | 18% | 5 | — |
| 53003 | lizard tail | 5% | 5 | — |
| 53002 | gold tooth | 5% | 5 | — |
| 52637 | repair kit for boats | 14,18% | 4 | — |
| 51443 | etcher | 1,2% | 3 | — |
| 51423 | book with a dragon | 3,2% | 3 | — |
| 44736 | — | 9,09% | 3 | — |
| 44737 | — | 9,09% | 3 | — |
| 44738 | — | 9,09% | 3 | — |
| 52720 | cluster of crystallized death | 1,94% | 3 | — |
| 53167 | sail pass | 18% | 3 | — |
| 51275 | greater garlic necklace | 2,4% | 3 | — |
| 52660 | ancient crypt rune | 100% | 2 | — |
| 51422 | star ink | 2,8% | 2 | — |
| 52713 | ancient scales | 30% | 2 | — |
| 52714 | soul trap | 20% | 2 | — |
| 52661 | necromantic crypt rune | 100% | 2 | — |
| 52748 | battle tactics | 33,08% | 2 | — |
| 52707 | giant tusk | 9,2% | 2 | — |
| 51427 | torn page | 5,6% | 2 | — |
| 52718 | deadly fangs | 2,18% | 2 | — |
| 52633 | night harpy feathers | 1,08% | 2 | — |
| 51474 | piece of frozen night | 5% | 2 | — |
| 52636 | tender venison | 51,7% | 2 | — |
| 44773 | — | 9,52% | 2 | — |
| 51484 | heart amphora | 5% | 2 | — |
| 51476 | pot of orcish warpaint | 3% | 2 | — |
| 52819 | personal letter of adlerauge i | 18,6% | 1 | — |
| … mais 65 | | | | |

## 6. Raridade do catálogo × raridade do drop

Equipamento (peça que não empilha): a raridade que vale é a SORTEADA no drop (`itens/gerar.mjs`); a do catálogo é ignorada (`raridadeDaPeca`). Os demais itens usam a do catálogo, e ela não mexe no preço. Não é erro de cadastro: é a regra.
