# Auditoria dos únicos — jogo × poedb

Gerado por `game/tools/auditar-unicos-poedb.mjs` em 2026-10-11, a partir de https://poedb.tw/pt/Unique_item (abas Weapon, Armour, Other, Item Recipe e Foulborn) e da página de cada único.

## Resumo

- Únicos no poedb (Weapon + Armour + Other): **1232**; no jogo: **1176**; faltando no jogo: **49**; sem página baixada: 7.
- Iguais linha a linha (implícitos e explícitos, com as faixas): **1157**; com alguma diferença: **19** (7214 linhas conferidas).
- Diferenças: base 9; linha que falta no jogo 19; valor/faixa diferente 0; linha a mais no jogo 18; tipo (implícito × explícito) 0.
- Sorteio (1171 únicos do jogo × 40): não geram 0; valores fora da faixa 0; únicos com linha perdida 0; implícito da base somado ao do único 0; mínimo e máximo alcançáveis: sim.
- Foulborn: 372 variantes no poedb (8 marcadas "Not in game" lá); o jogo ainda não tem a variante Foulborn.
- Receitas de único (Item Recipe): 23 no poedb; o jogo ainda não tem.

## Corrigido (unicos-correcoes.json, aplicado por cima do catálogo)

- **35 únicos** com as linhas da versão atual do poedb: Chifre de Abberath, Shimmeron, Scaeva, Singularidade, Acordo de Yaomac, O Chamado do Crustáceo, O Toque Lancinante, Bastão da Revelação, Tremor de Taryn, Potencial de Jiquani, A Espiral Cinza, Mandado de Atziri, Divisor de Águas, Remorso de Lioneye, The Draugur's Lantern, Honralar, O Olho Aberto (base Máscara do Arlequim), Mandíbula da Enganação, Prisão de Estase, Desilusão de Doryani (base Grevas do Leviatã), Farol da Loucura, Sinal da Wyrm, Punho da Tríade, Lamento de Sibila, Praxis, Emplema do Precursor, Sinete de Ngamahu, Precisão de Tawhanuku, Poço Infestado (base Talismã de Caranguejo-escudo), Maldição de Rigwald (base Talismã de Lobo Alfa), Hierarquia Natural (base Talismã de Rhex), Comparsa Profano (base Cinto de Pano), Sangue Tempestuoso, Atirador do Vazio (base Aljava Ornamentada), Olhos do Lobo Grandioso (base Talismã do Lobo Grandioso).
- **1 novo(s)**: Réplica: Ensinamentos de Maata (Cetro Karui).
- O implícito do único não soma mais com o da base (655 únicos tinham o implícito em dobro; as peças antigas são refeitas na entrada).
- Ficaram de fora de propósito: os mapas únicos e as joias (`foraDaComparacao` em poedb-unicos.json) e os de mecânica própria — Pérola de Tsoatha, Engenhosidade de Zana, Gancho de Poço, O Escudeiro.

## Faltando no jogo

| Único | Slug | Base | Aba |
| --- | --- | --- | --- |
| Divinação Destilada | Divination_Distillate | Frasco Híbrido Grande | Outros |
| O Jarro Contorcido | The_Writhing_Jar | Frasco Híbrido Consagrado | Outros |
| Beleza | Beauty | Aspecto Vaal | Outros |
| Curiosidade | Curiosity | Aspecto Vaal | Outros |
| Ambição | Ambition | Aspecto Vaal | Outros |
| Cooperação | Cooperation | Aspecto Vaal | Outros |
| Artefato da Absorção | Curio_of_Absorption | Fragmento Primordial | Outros |
| Artefato do Consumo | Curio_of_Consumption | Fragmento Primordial | Outros |
| Artefato do Potencial | Curio_of_Potential | Fragmento Primordial | Outros |
| Artefato da Decadência | Curio_of_Decay | Fragmento Primordial | Outros |
| A Hora da Divindade | The_Hour_of_Divinity | Relíquia: Incensário | Outros |
| O Sangue de Innocence | The_Blood_of_Innocence | Relíquia: Incensário | Outros |
| O Cálice Dourado | The_Gilded_Chalice | Relíquia: Processional | Outros |
| Os Grilhões Castigadores | The_Chains_of_Castigation | Relíquia: Processional | Outros |
| O Segundo Sacramento | The_Second_Sacrament | Relíquia: Castiçal | Outros |
| A Lanterna Noturna | The_Night_Lamp | Relíquia: Urna | Outros |
| A Primeira Coroa | The_First_Crest | Relíquia: Arca | Outros |
| O Incensário Quebrado | The_Broken_Censer | Relíquia: Tomo | Outros |
| O Poder e a Promessa | The_Power_and_the_Promise | Relíquia: Tomo | Outros |
| A Escritura Original | The_Original_Scripture | Relíquia: Papiro | Outros |
| Reviravolta do Destino | Twist_of_Fate | Ídolo Menor | Outros |
| Fonte da Criação | Wellspring_of_Creation | Ídolo Menor | Outros |
| Dança da Destruição | Dance_of_Destruction | Ídolo Menor | Outros |
| Foco Singular | Singular_Focus | Ídolo Menor | Outros |
| Olhar Ancestral | Eldritch_Gaze | Ídolo Menor | Outros |
| Ira do Cosmos | Wrath_of_the_Cosmos | Ídolo Menor | Outros |
| Molde Sombrio | Shadow_Shaping | Ídolo Menor | Outros |
| Arqueologia Extrema | Extreme_Archaeology | Ídolo Menor | Outros |
| Rotação de Plantações | Crop_Rotation | Ídolo Menor | Outros |
| Conflito Atemporal | Timeless_Conflict | Ídolo Menor | Outros |
| Pesadelo Sem Fim | Unending_Nightmare | Ídolo Menor | Outros |
| Dogma Imutável | Immutable_Dogma | Ídolo Menor | Outros |
| Princípios Arbitrários | Arbitrary_Tenets | Ídolo Menor | Outros |
| Maré Infinita | Endless_Tide | Ídolo Menor | Outros |
| Portavoz dos Mortos | Speaker_of_the_Dead | Ídolo Menor | Outros |
| Orgulho de Cassia | Cassias_Pride | Ídolo Menor | Outros |
| Avaliador Meticuloso | Meticulous_Appraiser | Ídolo Menor | Outros |
| Sonhos Lúcidos | Lucid_Dreams | Ídolo Menor | Outros |
| Brincadeira Destrutiva | Destructive_Play | Ídolo Menor | Outros |
| Empreendimentos Audaciosos | Bold_Undertakings | Ídolo Menor | Outros |
| Prova Exaustiva | Gruelling_Gauntlet | Ídolo Menor | Outros |
| Aposta Ruinosa | Ruinous_Wager | Ídolo Menor | Outros |
| Exploração Minuciosa | Thorough_Exploration | Ídolo Menor | Outros |
| Arrebentar e Saquear | Smash_and_Grab | Ídolo Menor | Outros |
| Poder Cristalizado | Crystallised_Power | Ídolo Menor | Outros |
| Bem Abastecido | Well_Supplied | Ídolo Menor | Outros |
| Grandeza Percebida | Perceived_Greatness | Ídolo Menor | Outros |
| Desejo Distorcido | Twisted_Wish | Ídolo Menor | Outros |
| Barganha do Refinador | Refiners_Bargain | Ídolo Menor | Outros |

## Base diferente

| Único | poedb | Jogo |
| --- | --- | --- |
| O Gancho de Poço | Vara de Pescar |  |
| Pérola de Tsoatha | Anel Prismático |  |
| Engenhosidade de Zana | Anel Prismático |  |
| Olhos do Lobo Grandioso | Talismã do Grande Lobo | Talismã do Lobo Grandioso |
| Vingança Infecta | Joia do Olho Assassino |  |
| Toque Extinguidor | Joia do Olho Examinador |  |
| Domínio Funesto | Joia do Olho Hipnótico |  |
| Aspiração Destrutiva | Joia do Olho Pavoroso |  |
| Malevolência Recuperada | Joia Ocular Montada |  |

## Linhas diferentes

| Único | Problema | Tipo | poedb | Faixa poedb | Jogo |
| --- | --- | --- | --- | --- | --- |
| O Gancho de Poço | falta no jogo | explicit | Velocidade de Conjuração aumentada em (35 — 40) % | 35–40 |  |
| O Gancho de Poço | falta no jogo | explicit | Alcance da Pesca aumentado em (50 — 80) % | 50–80 |  |
| O Gancho de Poço | falta no jogo | explicit | Isca de Cadáver de Kulemak | — |  |
| O Gancho de Poço | falta no jogo | explicit | Raridade de peixes pescados aumentada em (20 — 30) % por peixe morto em posse | 20–30 |  |
| O Gancho de Poço | falta no jogo | explicit | Pode pescar Peixes Abissais | — |  |
| O Escudeiro | a mais no jogo | explicit |  | — | Somente Encaixes Brancos |
| Pérola de Tsoatha | falta no jogo | implicit | +(8 — 10) % de todas Resistências Elementais | 8–10 |  |
| Pérola de Tsoatha | falta no jogo | explicit | +(27 — 34) % de todas Resistências Elementais | 27–34 |  |
| Pérola de Tsoatha | falta no jogo | explicit | Dano Elemental aumentado em (30 — 60) % | 30–60 |  |
| Pérola de Tsoatha | falta no jogo | explicit | Gemas encaixadas no seu elmo recebem reforço de (1 — 164) nível 20 | 1–164, 20 |  |
| Engenhosidade de Zana | falta no jogo | implicit | +(8 — 10) % de todas Resistências Elementais | 8–10 |  |
| Engenhosidade de Zana | falta no jogo | explicit | Velocidade de Ataque aumentada em (5 — 15) % | 5–15 |  |
| Engenhosidade de Zana | falta no jogo | explicit | Escudo de Energia máximo aumentado em 20 % | 20 |  |
| Engenhosidade de Zana | falta no jogo | explicit | (-15 — 15) % de todas Resistências Elementais | -15–15 |  |
| Vingança Infecta | falta no jogo | explicit | Subjugando (100 — 8000) almas sob o domínio de Tecrod Passivas afetadas são Conquistadas pelo Abissal | 100–8000 |  |
| Toque Extinguidor | falta no jogo | explicit | Subjugando (100 — 8000) almas sob o domínio de Ulaman Passivas afetadas são Conquistadas pelo Abissal | 100–8000 |  |
| Domínio Funesto | falta no jogo | explicit | Subjugando (100 — 8000) almas sob o domínio de Kurgal Passivas afetadas são Conquistadas pelo Abissal | 100–8000 |  |
| Aspiração Destrutiva | falta no jogo | explicit | Subjugando (100 — 8000) almas sob o domínio de Amanamu Passivas afetadas são Conquistadas pelo Abissal | 100–8000 |  |
| Malevolência Recuperada | falta no jogo | explicit | Subjugando (100 — 8000) almas sob o domínio de Zorath Passivas afetadas são Conquistadas pelo Abissal | 100–8000 |  |
| Pesadelo de Acton | falta no jogo | explicit | map undead monsters get up after X seconds [10] | — |  |
| Pilares de Arun | a mais no jogo | explicit |  | 100–150 | Quantidade de Itens encontrados nesta Área aumentada em (100—150)% |
| Pilares de Arun | a mais no jogo | explicit |  | 200–300 | Raridade de Itens encontrados nessa Área aumentada em (200—300)% |
| Cortex | a mais no jogo | explicit |  | 100 | Quantidade de Itens encontrados nesta Área aumentada em 100% |
| Cortex | a mais no jogo | explicit |  | 25 | Tamanho do Grupo aumentado em 25% |
| Memória Distante Alterada | a mais no jogo | explicit |  | 100 | Quantidade de Itens encontrados nesta Área aumentada em 100% |
| Memória Distante Alterada | a mais no jogo | explicit |  | 25 | Tamanho do Grupo aumentado em 25% |
| Memória Distante Aumentada | a mais no jogo | explicit |  | 100 | Quantidade de Itens encontrados nesta Área aumentada em 100% |
| Memória Distante Aumentada | a mais no jogo | explicit |  | 25 | Tamanho do Grupo aumentado em 25% |
| Memória Distante Distorcida | a mais no jogo | explicit |  | 100 | Quantidade de Itens encontrados nesta Área aumentada em 100% |
| Memória Distante Distorcida | a mais no jogo | explicit |  | 25 | Tamanho do Grupo aumentado em 25% |
| Memória Distante Reescrita | a mais no jogo | explicit |  | 100 | Quantidade de Itens encontrados nesta Área aumentada em 100% |
| Memória Distante Reescrita | a mais no jogo | explicit |  | 25 | Tamanho do Grupo aumentado em 25% |
| Réplica: Córtex | a mais no jogo | explicit |  | 100 | Quantidade de Itens encontrados nesta Área aumentada em 100% |
| Réplica: Córtex | a mais no jogo | explicit |  | 25 | Tamanho do Grupo aumentado em 25% |
| Réplica: Pilares de Arun | a mais no jogo | explicit |  | 200–250 | Quantidade de Itens encontrados nesta Área aumentada em (200—250)% |
| Réplica: Pilares de Arun | a mais no jogo | explicit |  | 200–300 | Raridade de Itens encontrados nessa Área aumentada em (200—300)% |
| Réplica: Pilares de Arun | a mais no jogo | explicit |  | 30 | Tamanho do Grupo aumentado em 30% |

## Sorteio

Nenhum valor fora da faixa.
