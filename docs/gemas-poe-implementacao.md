# Gemas do PoE: estado da implementação

Gerado por `ITENS_POE=1 node tools/relatorio-gemas-poe.mjs` a partir do código (status no jogo de `itens-poe/gemas-poe.mjs` e `itens-poe/suportes-poe.mjs`), dos ícones em `gamedata/itens-poe/`, da compatibilidade (`suportes-compat.json`) e dos testes que citam cada gema. Nada é classificado à mão. **"Testada" quer dizer que algum teste cita a gema** — não que todas as linhas dela tenham teste.

## Totais

### Gemas de habilidade (562; ataques: 210)

| Estado | Gemas | 
|---|---|
| implementada e testada | 74 |
| implementada, sem teste próprio | 50 |
| limitação do modelo idle | 11 |
| parcial | 416 |
| sem efeito | 11 |

Só os ataques:

| Estado | Gemas |
|---|---|
| implementada e testada | 31 |
| implementada, sem teste próprio | 19 |
| limitação do modelo idle | 6 |
| parcial | 154 |

### Gemas de suporte (262)

| Estado | Gemas |
|---|---|
| implementada e testada | 58 |
| implementada, sem teste próprio | 50 |
| parcial | 148 |
| sem efeito | 6 |

### Variantes

- Vaal (52): parcial 44 · implementada e testada 3 · implementada, sem teste próprio 5
- Alternativas (198): parcial 158 · implementada, sem teste próprio 27 · implementada e testada 9 · limitação do modelo idle 2 · sem efeito 2

### Compatibilidade, efeitos compartilhados, imagens, testes

- Compatibilidade: 562 ativas e 260 suportes com regra; 58049 pares compatíveis; sem regra: 0 ativas, 2 suportes (Inspiration_Support, Pacifism_Support).
- Efeitos compartilhados faltando: 961 linhas distintas (215 em duas ou mais gemas).
- Imagens: 562/562 ativas com ícone da gema, 562/562 com ícone da habilidade, 262/262 suportes; 0 desenhos repetidos entre gemas de bases diferentes.
- Catálogo do poedb (Skill_Gems + Support_Gems, pt): 824 gemas; faltam no jogo: nenhuma; só no jogo: nenhuma.
- Testes que citam a gema: 186/562 ativas, 73/262 suportes.
- Teste geral (`testes/gemas-todas-funcionam-poe.test.mjs`): toda ativa `funciona` é usada de verdade numa caçada e precisa causar dano no alvo (ou ligar o buff); todo suporte `funciona` precisa de efeito sem linha não feita, e cada chave do efeito precisa ser lida pelo código do jogo. "Sem teste próprio" quer dizer que só esse teste geral cobre a gema.

## Linhas que faltam (por quantidade de gemas)

| Gemas | Linha |
|---|---|
| 21 | o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área |
| 16 | nenhum efeito do buff tem equivalente no jogo |
| 13 | sem dano direto: nenhum efeito no combate |
| 12 | Lacaios têm Recuperação da Recarga aumentada em # % |
| 9 | Efeito do Buff aumentado em # % |
| 8 | Velocidade de Projéteis aumentada em # % |
| 7 | Projéteis que Atravessaram causam # % mais Dano |
| 6 | # % de Chance de uma Armadilha ser Ativada uma vez adicional |
| 6 | # % mais Velocidade de Projétil |
| 5 | as repetições do golpe não existem: no jogo é um |
| 5 | Duração do Efeito de Habilidades aumentada em # % |
| 5 | Efeito em Área de Habilidades Maldição Suportadas aumentado em #% |
| 5 | Velocidade de Movimento reduzida em # % |
| 4 | +# ao Máximo de Armas Animadas |
| 4 | +# ao Máximo de Esqueletos Convocados |
| 4 | Debuff pode ter até # camadas de Dano |
| 4 | Duração da penalidade base é de # segundos |
| 4 | Efeito das Auras aumentado em # % |
| 4 | Habilidades Suportadas têm #% de Velocidade de Movimento de Lacaios aumentada |
| 4 | Velocidade de Movimento dos Lacaios aumentada em # % |
| 3 | # % de aumento do ângulo por estágio, até # % |
| 3 | # segundos adicionais de Duração Base por Cadáver extra consumido |
| 3 | + # do máximo de Estágios |
| 3 | +# % ao Máximo de Efeito da Eletrização |
| 3 | +# metro ao Raio por # de Fúria |
| 3 | Alvos Extras das Habilidades Suportadas podem ser encontrados #% mais distânte |
| 3 | Ângulo do Efeito em Área aumentado em # % |
| 3 | Área de Efeito aumentada em # % por cada # metro de Alcance de Golpe Corpo a Corpo adicional |
| 3 | as flechas caem em linha, cada uma com dano em área e um acerto só por inimigo (act_dex.lua:##; no jogo ainda são projéteis no alvo) |
| 3 | Cada Flecha pode disparar # Feixes |
| 3 | Causa +# % mais Dano por Carga Sangrenta |
| 3 | Cria # Estaca |
| 3 | Definhado dura # segundos |
| 3 | Efeito da Oferenda aumentado em # % |
| 3 | Estacas Despedaçadoras causam # % mais dano |
| 3 | Feixe causa # % mais Dano com Acertos por Estágio após o primeiro Feixe causa # % mais Dano com Afecções por Estágio após o primeiro |
| 3 | Flecha dispara Raios a cada # segundos |
| 3 | Habilidades Suportadas ganham uma Reserva Base igual ao Custo Base de Mana e Vida |
| 3 | Habilidades Suportadas só podem ser usadas com Machados, Maças, Cetros ou Cajados |
| 3 | Habilidades Suportadas também contam como Habilidades Bênção Você só pode ter uma Aura de suas Habilidades Bênção |
| 3 | Habilidades Suportadas também contam como Habilidades Bênção\nVocê só pode ter uma Aura de suas Habilidades Bênção |
| 3 | O feixe se divide em direção a +# alvos adicionais |
| 3 | Parede terá # metros |
| 3 | Projéteis de Estilhas Causam # % menos Dano |
| 3 | Projéteis podem se Dividir sem acertar um alvo |
| 3 | Pulso tem Efeito em Área aumentado em # % por cada #s de Duração do Atordoamento, máximo de # % |
| 3 | Raio Base terciário igual a # metros |
| 2 | # % de chance de causar Dano sem remover Cargas |
| 2 | # % de chance de Convocar um Sentinela da Absolvição ao Acertar um Inimigo Raro ou Único |
| 2 | # % de chance de detonar um cadáver adicional |
| 2 | # % de chance de ganhar uma Carga de Poder em Acertos Críticos |
| 2 | # % de chance de infligir Definhando por # segundos ao Acertar |
| 2 | # % de chance de invocar uma Sentinela da Dominação normal ao atingir um monstro raro ou único |
| 2 | # % de chance de manter cada Projétil capturado disparado com Lâminas Giratórias |
| 2 | # % de chance de receber uma Carga de Poder quando um Projétil Acertar um Inimigo Raro ou Único |
| 2 | # % de chance de remover um Feitiço após Causar Dano |
| 2 | # % do dano de ataques é absorvido pelo bônus antes de afetar sua vida ou seu escudo de Energia Bônus pode sofrer dano equivalente a # % da sua armadura, até # |
| 2 | # % do Dano Mágico Drenado como Escudo de Energia |
| 2 | # % mais Área de Efeito por Carga removida |
| 2 | # % mais Dano com Acertos se o Inimigo estiver Enfeitiçado |
| 2 | # % mais Dano com Afecções se o Inimigo estiver Enfeitiçado |
| 2 | # % mais Dano com Sangramento enquanto na Postura de Sangue |
| 2 | # % mais Efeito de Resfriamento |
| 2 | # % mais Velocidade de Ataque enquanto estiver em uma Tempestade de Lâminas Sangrentas |
| 2 | # % menos Dano em Área |
| 2 | # a # de Dano de Fogo adicionado contra Inimigos Queimando |
| 2 | # de largura do Efeito em Área |
| 2 | # Estágios Máximos |
| 2 | # segundos entre o aparecimento de seções da Parede |
| 2 | #% de Qualidade das Gemas de Habilidade Suportadas |
| 2 | #% do Dano Físico Convertido para Dano de Fogo |
| 2 | % de chance de remover um Feitiço após Causar Dano |
| 2 | +# ao Máximo de Zumbis Evocados |
| 2 | +# ao número Máximo de Tempestades de Lâminas por vez |
| 2 | +# fissura |
| 2 | +# metros ao Alcance de Golpes Corpo a Corpo |
| 2 | +# metros ao raio do Solo Sagrado |
| 2 | +# metros de raio por inimigo próximo, até +# metro |
| 2 | +# Rajada |
| 2 | A Ilusão se move com # % da sua Velocidade de Movimento |
| 2 | A Segunda forma possui # % mais Velocidade de Projétil |
| 2 | Abalo Secundário causa # % mais Dano com Acertos e Afecções |
| 2 | Abalo Secundário causa +# % mais Dano com Acertos e Afecções |
| 2 | Acertos aós o primeiro em cada Inimigo causam # % menos Dano |
| 2 | Acertos da onda final causam # % de dano por estágio |
| 2 | Aplica feixes aos # Inimigos próximos |
| 2 | as flechas do mesmo ataque podem acertar o mesmo inimigo (no jogo cada flecha a mais vai num inimigo diferente) |
| 2 | Aura de Exposição ao Fogo aplica # % à resistência a dano de fogo |
| 2 | Buff Concede # % de chance de Eletrizar inimigos |
| 2 | Buff concede +# % de chance de Eletrizar inimigos |
| 2 | Buff concede Trespassar |
| 2 | Cada Esporo aplica # % menos Velocidade de Movimento aos Inimigos próximos, até um máximo de # % |
| 2 | Cada Esporo dispara # Flechas de Espinho |
| 2 | Cada Flecha pode disparar +# Feixes |
| 2 | Cargas de Frasco usadas reduzidas em # % |
| 2 | Causa # % do seu máximo de Escudo de Energia como Dano de Caos base |
| 2 | Causa # % mais Dano por Carga Sangrenta |
| 2 | Causa # a # de Dano de Caos |
| 2 | Causa # a # de Dano de Gelo Adicional se Cargas de um Frasco de Safira foram consumidas |
| 2 | Causa # a # de Dano de Raio |
| 2 | Causa # a # de Dano de Raio Adicional se Cargas de um Frasco de Topázio foram consumidas |
| 2 | Causa # explosões menores Explosões menores têm entre # % de redução e # % de aumento do raio base, aleatoriamente |
| 2 | Causa # rajadas |
| 2 | Causa + # % de dano com ataques ao canalizar, se a Ilusão terminou seu movimento |
| 2 | Causa +# explosões menores |
| 2 | Causa Dano a cada # segundos |
| 2 | Causa Dano em # Inimigos próximos quando você ganha Estágios |
| 2 | Ceifador faz com que seus Lacaios Não-Ceifadores causem # % menos Dano |
| 2 | Ceifador faz com que seus Lacaios Não-Ceifadores tenham # % menos Vida Máxima |
| 2 | Comprimento do raio aumentado em # % |
| 2 | Concede # % mais Dano Mágico |
| 2 | Custa # % mais Vida por Carga Sangrenta |
| 2 | Dano de Caos Adicional igual a # % da Quantidade de Recuperação do Frasco se Cargas foram consumidas de um Frasco de Vida |
| 2 | Debuff Incendiário pode ter no máximo # estágios |
| 2 | Debuffs causam # % de Dano por Carga |
| 2 | Debuffs causam +# % de Dano por Carga |
| 2 | Dispara # Fragmentos de Projéteis em uma Espiral quando o Projétil terminar |
| 2 | Dispara # Projéteis em uma espiral |
| 2 | Dispara Projéteis # % mais rápido |
| 2 | Dispara Projéteis extras em até # Inimigos ao redor |
| 2 | Dispara Projéteis extras em até +# Inimigos ao redor |
| 2 | Dispara um feixe a cada # segundos |
| 2 | Distância de Deslocamento máxima aumentada em # % |
| 2 | Distância de Deslocamento máxima aumentada em % |
| 2 | Duração de Maldições aumentada em # % |
| 2 | Duração do Buff aumentada em # % por Carga de Tolerância removida |
| 2 | Duração reduzida em # % |
| 2 | Efeito dos Resfriamentos infligidos por Habilidades Suportadas aumentado em #% |
| 2 | Espalha quando o Inimigo afetado morrer |
| 2 | Essa Gema só pode Suportar Gemas de Habilidade que requerem Nível # ou menos |
| 2 | esses lacaios especiais ainda não existem no jogo |
| 2 | Esta habilidade é ativada por habilidades reforçadas de Instabilidade Cinética |
| 2 | Esta Magia causa # a # , mais # % da sua Vida Máxima, como Dano de Fogo base |
| 2 | Estágios Adicionais do Debuff adicionam # % de Dano |
| 2 | Explosão Cinética cria # explosões adicionais |
| 2 | Feixes se dividem em direção a alvos dentro de um raio base de # metros |
| 2 | Fissuras irrompem # vezes adicionais |
| 2 | Ganha # Traumatismo a primeira vez que este Ataque Acertar um Inimigo Sofre # de Dano Físico por Traumatismo quando você ganhar Traumatistmo Traumatismo dura # segundos |
| 2 | Ganhe uma Carga Sangrenta se esta Habilidade Acertar Inimigos e nenhum deles Morrerem Perca uma Carga Sangrenta quando um Inimigo Morrer enquanto afetado pelo Debuff desta Habilidade |
| 2 | Gira por # rotações |
| 2 | Golens causam # % mais Dano por Lacaio Não-Golem próximo deles, até # % |
| 2 | Golpeia a cada # segundos enquanto Canalizando uma Habilidade de Raio próximo ao Orbe |
| 2 | Golpes Abatedores com Habilidades Suportadas Consomem cadáveres para Recuperar # de Vida e # de Mana |
| 2 | Golpes Finais fazem com que os Empalamentos em Inimigos Reflitam o Dano aos Inimigos ao redor |
| 2 | Habilidades de Efeito em Área Suportadas também afetam áreas na frente, atrás, e dos lados da área alvo |
| 2 | Habilidades de Efeito em Área Suportadas também afetam áreas na frente, atrás,\ne dos lados da área alvo |
| 2 | Habilidades reforçadas têm #% de chance de fazer os monstros fugirem ao atingir |
| 2 | Habilidades reforçadas têm +#% de chance de fazer os monstros fugirem ao atingir |
| 2 | Habilidades Suportadas aplicam Maldições Suportadas em Acertos |
| 2 | Habilidades Suportadas Ativam Onda de Choque no Acerto Corpo a Corpo |
| 2 | Habilidades suportadas criam Solo Maldito com uma Duração base de # segundos Feitiços de Habilidades Suportadas não tem Duração Inimigos em Solo Maldito das Habilidades Suportadas são Amaldiçoados com tal Feitiço Limite de # área de Solo Maldito |
| 2 | Habilidades Suportadas Disparam Projéteis em um círculo |
| 2 | Habilidades Suportadas disparam uma Flecha Carregada no ar Projéteis da Habilidade Suportada Disparam de onde a Flecha Carregada cair |
| 2 | Habilidades Suportadas disparam uma Flecha Carregada no ar\nProjéteis da Habilidade Suportada Disparam de onde a Flecha Carregada cair |
| 2 | Habilidades Suportadas sempre disparam ao menos # Projétil |
| 2 | Habilidades Suportadas só podem ser usadas com Arcos |
| 2 | Habilidades Suportadas também disparam Projéteis de até # pontos de cada lado seu |
| 2 | Habilidades Suportadas têm #% de Velocidade de Projétil aumentada |
| 2 | Habilidades Suportadas têm Efeito em Área da Ativação de Armadilhas aumentado em #% |
| 2 | Impele o próximo # Ataque de Golpe Corpo a Corpo que você executar |
| 2 | Inimigos ao alcance são tolhidos, com velocidade de movimento reduzida em até # %, com base na distância da Esfera do Vazio |
| 2 | Inimigos no alcance são Desacelerados com Velocidade de Movimento reduzida em # % |
| 2 | Lacaios de Habilidades Suportadas têm Chance de Golpe Crítico aumentada em #% |
| 2 | Lacaios possuem +# % de todas Resistências Elementais |
| 2 | Libera # onda |
| 2 | Libera +# onda |
| 2 | Libera um Pulso Mais Forte a cada # Pulsos Pulsos Mais Fortes sempre são Golpes Críticos |
| 2 | Martelos causam - # % de dano |
| 2 | Martelos Sagrados se acumulam em cascata até # vezes |
| 2 | Máximo de # anomalias |
| 2 | Máximo de +# Estacas Cria |
| 2 | o uso de cadáveres não existe no jogo |
| 2 | Orbes desaparecem após # Golpes |
| 2 | Orbes Explosivas causam # % do Dano da Habilidade para cada # segundos de Duração restante |
| 2 | Orbes saltam a cada # segundos |
| 2 | os estágios de canalização não existem: no jogo é um uso por vez |
| 2 | Pode consumir Cargas de um Frasco de Rubi, Safira e Topázio Consome # Carga de # Frasco de cada tipo válido, se possível, por Projétil Disparado |
| 2 | Pode focar em cada inimigo apenas uma vez a cada # segundos |
| 2 | Pode ter até # Áreas Resfriadas |
| 2 | Pode ter até # lâminas giratórias ativas |
| 2 | Projéteis causam + # % dano por projétil disparado anteriormente em sequência |
| 2 | Projéteis das Habilidades Suportadas podem Difundir # Vezes adicionais |
| 2 | Projéteis de Espinhos causam # % menos Dano |
| 2 | Projéteis ganham até +# % mais Dano até se dissiparem |
| 2 | Projéteis ganham Dano continuamente, até # % mais Dano até se dissiparem |
| 2 | Projéteis mudam de direção # vezes |
| 2 | Projéteis não podem se Partir |
| 2 | Projéteis podem Ricochetear ao atingir o solo Projéteis não mudam de direção ao Ricochetear |
| 2 | Pulsa a cada # segundos |
| 2 | Quando em Empunhadura Dupla, # % Menos Velocidade de Ataque |
| 2 | Raio acerta # alvos dentro de # metros |
| 2 | Raio Base da explosão menor igual a # metros |
| 2 | Rebate até # vezes Modificadores ao número de Projéteis se aplicam ao número de Rebatidas |
| 2 | Receba # % do Dano Físico como Dano de Gelo Extra |
| 2 | Recupera #% de Vida quando Habilidades Suportadas Matam um Inimigo |
| 2 | Regenera # % do Dano do Debuff como Vida |
| 2 | Regenera +# % do Dano do Debuff como Vida |
| 2 | Regeneração de Vida reduzida em # % |
| 2 | Repete # vezes |
| 2 | Sentinelas Ascendidos causam # % mais Dano |
| 2 | Sentinelas Ascendidos sofrem # % menos Dano |
| 2 | Só aplica Feitiços de Gemas de Habilidades Maldição que exigem Nível # ou menor |
| 2 | Taxa de Acerto aumentada em +# % por cada lâmina |
| 2 | Tem # chamas |
| 2 | Tempestade Furiosa Acerta com # % mais Frequência |
| 2 | Tempestades de Lâminas causam # % menos Dano com Acertos e Afecções |
| 2 | Tempo de Conjuração desta Magia é adicionado à sua Recarga se Ativada |
| 2 | Todos os Danos podem Incendiar, Congelar e Eletrizar |
| 2 | Trava o inimigo no lugar |
| 2 | Um impacto a cada # segundos |
| 2 | Uma Runa é Melhorada para cada # de Mana Gasta |
| 2 | Velocidade de Movimento do Orbe aumentada em # % |
| 2 | Velocidade de Movimento dos Lacaios está no Máximo |
| 2 | Você não pode Conjurar Magias Maldição Suportadas |
| 2 | ㅤ- # % de dano de ataque com duas armas |
| 1 | [DNT] Deals # % more Damage per active wall |
| 1 | [Empowered\|Fortalece] a próxima magia vaal danosa que você conjurar |
| 1 | [Empowered\|Fortalece] as próximas # magias que você conjurar |
| 1 | [Empowered\|Fortalece] as próximas +# magias que você conjurar |
| 1 | # % de aumento da Chance de Acerto Crítico por Rajada |
| 1 | # % de aumento da Distância do Empurrão |
| 1 | # % de aumento da Duração da Habilidade por Carga de Frenesi removida |
| 1 | # % de aumento da Frequência de Projéteis por Estágio |
| 1 | # % de aumento do Efeito de Mutilação |
| 1 | # % de chance de Causticar Inimigos |
| 1 | # % de chance de Cegar inimigos ao acertá-los |
| 1 | # % de chance de convocar um Lacaio extra |
| 1 | # % de chance de Convocar um Sentinela da Pureza ao Acertar um Inimigo Raro ou Único |
| 1 | # % de chance de ganhar uma Carga de Frenesi quando um Inimigo Morrer enquanto na Área dessa Habilidade |
| 1 | # % de chance de ganhar uma Ruína adicional ao usar |
| 1 | # % de Chance de ramificação da Fissura |
| 1 | # % de chance de ramificação de fissuras por Carga de Tolerância removida |
| 1 | # % de chance de receber uma Carga de Frenesi ao Acertar |
| 1 | # % de chance do Relâmpago acertar o Marcador ao Conjurar |
| 1 | # % de chancer de causar Sangramento enquanto na Postura de Sangue |
| 1 | # % do Dano de Acertos é sofrido no Buff antes da sua Vida ou Escudo de Energia Buff pode sofrer Dano igual a Mana Gasta pelo efeito desta Habilidade |
| 1 | # % do Dano de Raio Convertido em Dano de Caos |
| 1 | # % do Dano Físico é Convertido para Dano de Gelo enquanto a Esfera não possuir Afeções # % do Dano Físico é Convertido para Dano de Raio enquanto a Esfera estiver Eletrizada ou Exaurida # % do Dano Físico é Convertido para Dano de Gelo enquanto a Esfera etiver Congelada ou Enfraquecida |
| 1 | # % maior frequência de rajadas por # de mana máximo |
| 1 | # % mais Área de Efeito por Carga de Tolerância removida |
| 1 | # % mais Área de Efeito por lâmina do Vórtice de Lâminas detonada |
| 1 | # % mais Área de Efeito quando Conjurada em um Disparo Congelante |
| 1 | # % mais Área de Efeito se Consumindo um Lacaio |
| 1 | # % mais Área de Efeito se Consumiu um cadáver |
| 1 | # % mais Dano com Acertos contra Inimigos Incendiados |
| 1 | # % mais Dano com Acertos e Afecções por cada Conjuração desta Magia aguardando no momento |
| 1 | # % mais Dano com Acertos e Afecções por Intensidade |
| 1 | # % mais Dano com Acertos e Afecções se usar sua Vida |
| 1 | # % mais Dano com Acertos na Distância Máxima da Investida |
| 1 | # % mais Dano com Acertos por cada # % de Efeito de Eletrização no Inimigo |
| 1 | # % mais Dano com Acertos por cada # % de Efeito do Resfriamento no Inimigo |
| 1 | # % mais Dano com Afecções por estágio |
| 1 | # % mais Dano de Projétil |
| 1 | # % mais Dano em Área |
| 1 | # % mais Dano Físico Corpo a Corpo |
| 1 | # % mais Dano Mágico por estágio |
| 1 | # % mais Dano na Postura de Sangue |
| 1 | # % mais Dano por Carga de Tolerância removida |
| 1 | # % mais dano por lâmina |
| 1 | # % mais dano por lâmina de Vórtice de Lâminas |
| 1 | # % mais Dano por Maldição aplicada |
| 1 | # % mais Dano por Rajada |
| 1 | # % mais Dano por Trauma, até # % |
| 1 | # % mais Dano por Traumatismo |
| 1 | # % mais Dano quando Conjurado com Disparo Congelante |
| 1 | # % mais Duração do Veneno |
| 1 | # % mais Frequência de Projéteis enquanto Canalizando |
| 1 | # % mais Raio de Área contra Inimigos afetados por uma Afecção do Elemento escolhido |
| 1 | # % mais Velocidade de Ataque por cada Estágio |
| 1 | # % mais Velocidade de Conjuração |
| 1 | # % menos Dano de Afecções |
| 1 | # % menos Dano Físico sofrido por Carga de Tolerância removida |
| 1 | # % menos Dano Sofrido enquanto Canalizando |
| 1 | # % menos Velocidade de Arremesso de Armadilhas |
| 1 | # % menos velocidade de lançar armadilhas com arma de duas mãos |
| 1 | # % menos Velocidade de Movimento |
| 1 | # % menos Velocidade de Movimento por Estágio |
| 1 | # do Nível das Gemas de Habilidade de Caos Suportadas |
| 1 | # metros ao raio do Solo Sagrado |
| 1 | # metros de raio |
| 1 | # Tiros |
| 1 | #% de chance de renovar a Duração do Modificador recebido em até # segundos quando você Acertar um Inimigo Raro ou Único com Habilidades Suportadas |
| 1 | #% mais Dano em Área |
| 1 | #% mais Dano por Carga de Tolerância |
| 1 | + # % de dano ao gastar uma carga de poder |
| 1 | +# % ao multiplicador de golpe crítico quando em estágios máximos |
| 1 | +# % de Chance de ramificação da Fissura |
| 1 | +# % de chance de ramificar fissuras por Carga de Tolerância |
| 1 | +# % de Multiplicador de Dano Degenerativo com Incêndios se Cargas de um Frasco de Rubi foram consumidas |
| 1 | +# % de Multiplicador de Golpe Crítico se Cargas foram consumidas de um Frasco de Rubi |
| 1 | +# % mais Dano com Acertos contra Inimigos Incendiados |
| 1 | +# % mais Dano com Acertos e Afecções por cada Conjuração desta Magia aguardando no momento |
| 1 | +# % mais Dano com Acertos e Afecções por cada estágio |
| 1 | +# % mais Dano com Acertos e Afecções por Intensidade |
| 1 | +# % mais Dano com Acertos por cada # % de Efeito de Eletrização no Inimigo |
| 1 | +# % mais Dano em Área |
| 1 | +# % mais dano por carga de poder removida |
| 1 | +# % mais Dano por Carga de Tolerância removida |
| 1 | +# % mais Dano por Traumatismo |
| 1 | +# % menos Dano em Área |
| 1 | +# ao número máximo de Zumbis |
| 1 | +# cascatas por carga de poder removida |
| 1 | +# de largura por cada # % de Mana Máxima Não Reservada possuída |
| 1 | +# de Relâmpagos Concentrados máximos |
| 1 | +# Estágios Máximos |
| 1 | +# metro ao Alcance de Golpes Corpo a Corpo |
| 1 | +# metros à Largura do Feixe Por Intensidade # % menos ângulo de ramificação por Intensidade |
| 1 | +# metros ao Raio da Explosão por Flecha Explosiva no Alvo, máximo de +# metros |
| 1 | +# metros ao raio do Pulso por Energia |
| 1 | +# metros para o alcance do golpe corpo a corpo do lacaio |
| 1 | +# vez |
| 1 | +#% de Qualidade das Gemas de Habilidade Suportadas |
| 1 | +#% para o número máximo de lacaios de habilidades reforçadas |
| 1 | a absorção de dano da guarda ainda não existe no jogo |
| 1 | A área alvejada base mede # metros de comprimento |
| 1 | A expiração do Buff não pode ser modificada |
| 1 | A Ilusão se move com um adicional de +# % da sua Velocidade de Movimento |
| 1 | a imunidade a afecções ainda não existe no jogo |
| 1 | a lentidão da maldição ainda não existe no jogo |
| 1 | A Recarga do seu Escudo de Energia e dos seus aliados próximos não é impedida por Dano |
| 1 | A Segunda forma possui +# % ao Multiplicador de Acerto Crítico |
| 1 | Abalo Secundário causa # % mais Dano com Acertos por cada # segundos de Duração |
| 1 | Abalo Secundário causa # % mais Dano com Afecções por cada # segundos de Duração |
| 1 | Abalo Secundário tem # % mais Área de Efeito por cada # segundos de Duração |
| 1 | Acada segundo # % mais Fúria perdida |
| 1 | Acerta até # Inimigos |
| 1 | Acerta Inimigos a cada # Segundos |
| 1 | Acertos com Habilidades Suportadas para o qual o maior Tipo de Dano for Elemental fazem com que você ganhe # de Ressonância de outros Elementos por # segundos Perde # de Ressonância por segundo para cada Elemento que não estiver ganhando |
| 1 | Acertos com Habilidades Suportadas para o qual o maior Tipo de Dano for Elemental fazem com que você ganhe # de Ressonância de outros Elementos por # segundos\nPerde # de Ressonância por segundo para cada Elemento que não estiver ganhando |
| 1 | Acertos Corpo a Corpo Fortificam por # segundos |
| 1 | Acertos da Onda final causa # % de Dano por estágio |
| 1 | Acertos em Inimigos Incendiados criam Solo Ardente, não mais que uma vez a cada # segundos |
| 1 | Acertos tratam os valores da Resistência Elemental dos Monstros Inimigos como invertidos |
| 1 | Adrenalina de Combate concede #% mais Velocidade de Ataque às Habilidades de Deslocamento não Suportadas por Combate Próximo |
| 1 | Afecções Elementais infligidas por Habilidades Suportadas se espalham para outros inimigos dentro de # metros |
| 1 | Alcance aumentado em # % |
| 1 | Alcance do Posicionamento de Totens aumentado em # % |
| 1 | Alvos acorrentados concedem # Fúria quando atingidos |
| 1 | Alvos sofrem #% mais Dano do Sangramento por Rompimento das Habilidades Suportadas neles |
| 1 | Anel sempre Eletriza |
| 1 | Ângulo aumentada em # % |
| 1 | Ângulo aumentada em # % enquanto na Postura da Areia |
| 1 | Ângulo aumentado em # % |
| 1 | Ângulo da ramificação aumentado em # % |
| 1 | Anima até # Armas |
| 1 | Ao atingir # de Gula, perde toda a Gula e ganha Regurgitação por # segundos |
| 1 | Aplica feixes aos +# Inimigos próximos |
| 1 | Após atacar, os totens desaparecem |
| 1 | Armadilha dura +# segundo Gira |
| 1 | Arqueiro Ilusório dura # segundos |
| 1 | Arqueiro Ilusório utiliza Habilidades Suportadas com #% menos Velocidade de Ataque |
| 1 | As flechas após a primeira caem em um raio base de # metros |
| 1 | As Flechas desta Habilidade causam # % mais Dano com Acertos por Estágio |
| 1 | As Flechas desta Habilidade causam # % mais Dano com Afecções por Estágio |
| 1 | Ataca um Inimigo a cada # segundos |
| 1 | Ataque de Impacto dos Zumbis Erguidos tem Efeito em Área aumentado em # % |
| 1 | Ataques com habilidades reforçadas, cujo maior tipo de dano é caos, elétrico ou físico, fazem você ganhar # de Ressonância Profana dos outros tipos por segundo durante # segundos Perde # de Ressonância Profana por segundo para cada tipo que não ganhar |
| 1 | Ataques com habilidades reforçadas, cujo maior tipo de dano é caos, elétrico ou físico, fazem você ganhar # de Ressonância Profana dos outros tipos por segundo durante # segundos\nPerde # de Ressonância Profana por segundo para cada tipo que não ganhar |
| 1 | Ataques de habilidades reforçadas não podem matar inimigos |
| 1 | Ataques de habilidades reforçadas têm #% de chance de considerar os valores de resistência elemental dos monstros inimigos como invertidos |
| 1 | Ataques Impelidos causam # % mais Dano por Aliado afetado, máximo de # % |
| 1 | Ataques Impelidos têm # % mais Área de Efeito |
| 1 | Ataques Impelidos têm +# % de Chance de Golpe Crítico |
| 1 | Ataques Impelidos têm +# % de Multiplicador de Dano Crítico |
| 1 | Ataques reforçados ativam Rajada de Vento ao atingir, limitado a uma vez a cada # metros percorridos |
| 1 | Ataques Suportados causam #% mais Dano por cada Clamor que os Impelir |
| 1 | Ataques Suportados causam Dano Físico com Armas Adicional igual a #% da Vida Máxima enquanto em Vida Baixa |
| 1 | Ataques Suportados causam Dano Físico com Armas Adicional igual a\n#% da Vida Máxima enquanto em Vida Baixa |
| 1 | Ataques Suportados tem #% de chance de Empalar Inimigos ao Acertar |
| 1 | Ataques Suportados tem o Efeito de Empalamento aumentdo em #% |
| 1 | Até # metros ao raio da propagação de Energia, escalonado pela distância da Runa |
| 1 | Ativa a Habilidade Suportada quando você Acertar um Inimigo Raro ou Único com um Ataque |
| 1 | Ativa Esta Habilidade quando um Feitiço de Habilidades Suportadas terminar |
| 1 | Ativa esta magia reforçada quando sua salvaguarda quebra |
| 1 | Ativa Explosão Destruidora quando um Feitiço de Habilidades Maldição Suportadas terminar |
| 1 | Ativa Invocar Relâmpago Vivo quando uma habilidade de reforço causa dano elétrico com o acerto |
| 1 | Ativa Invocar Relâmpago Vivo quando uma habilidade\nde reforço causa dano elétrico com o acerto |
| 1 | Aumenta a Velocidade de Conjuração dos Lacaios em # % |
| 1 | Aumenta a Velocidade de Movimento dos Lacaios em # % |
| 1 | Aura faz com que Castigo ataque +# alvos com relâmpagos |
| 1 | Auras das Habilidades Suportadas têm uma duração base de # segundos |
| 1 | Bônus de Dano da Força é aplicado ao Dano de Ataque dos Projéteis assim como às Habilidades Suportadas |
| 1 | Bônus de dano da Força também é aplicado à todo Dano Mágico para Magias Suportadas |
| 1 | Buff concede # % mais Dano Físico |
| 1 | Buff concede # de Regeneração de Escudo de Energia por segundo |
| 1 | Buff concede # de Regeneração de Mana por segundo |
| 1 | Buff concede +# % de Chance de Bloquear o Dano Mágico enquanto portando um Escudo |
| 1 | Buff concede Dano de Ataque Adicional igual a # % do Dano da sua Arma da Mão Principal por cada # de Poder, contando um máximo de # de Poder |
| 1 | Buff concede Dano de Raio Adicional igual a # % da Mana Gasta pelo efeito desta Habilidade |
| 1 | Buff concede Furtividade aumentada em # % |
| 1 | Buff concede Golpe Abatedor com Cutilada Buff concede # % mais Área de Efeito da Cutilada Buff concede # % mais Dano com Cutilada com Acertos e Afecções aos Inimigos que estão em Vida Baixo |
| 1 | Buff concede Imunidade a Eletrização |
| 1 | Buff concede Ponto de Atordoamento aumentado em # % por cada # de Poder, contando um máximo de # de Poder |
| 1 | Buff é removido para Impelir o próximo Ataque Corpo a Corpo que você executar Ataques Impelidos por esta Habilidade não podem ser Impelidos por outras Habilidades |
| 1 | Buff tem # % mais Efeito em seus Lacaios |
| 1 | Cada Aprisionamento aplica # % menos Velocidade de Movimento aos Inimigos Normais ou Mágicos |
| 1 | Cada Aprisionamento aplica # % menos Velocidade de Movimento aos Inimigos Raros |
| 1 | Cada Aprisionamento aplica # % menos Velocidade de Movimento aos Inimigos Únicos |
| 1 | Cada Esporo dispara +# Flecha de Espinho |
| 1 | Cada Esporo dispara +# Flechas de Espinho |
| 1 | Cada Esporo inflige # Debuff de Definhamento nos Inimigos próximos |
| 1 | Cada Flecha deixa # Esporos |
| 1 | Cada Flecha pode disparar +# Feixe |
| 1 | Cada Habilidade Suportada causa #% mais Dano com Incêndio por cada Incêndio infligido com ela Recentemente, máximo de #% |
| 1 | Cada Habilidade Suportada causa #% menos Dano por cada Incêndio infligido com ela Recentemente, máximo de #% |
| 1 | Cada mina aplica Dano aumentado em +# % aos Inimigos próximos máximo de # % |
| 1 | Cada Mina das Habilidades Suportadas aplicadas #% de chance de causar Dano Dobrado aos Acertos contra Inimigos próximos a ele, até um máximo de #% |
| 1 | Cada onda tem # Explosões |
| 1 | Cada rajada dispara # lâminas, que permanecem no chão |
| 1 | Cadáveres Criados têm Vida Máxima aumentada em # % |
| 1 | Campo ganha # % mais Dano com Ataques por cada # % de Efeito de Eletrização no Inimigo quando criado |
| 1 | Campo ganha +# metros ao raio por cada # % de Efeito de Eletrização no Inimigo quando criado |
| 1 | Causa # % da sua Mana Máxima como Dano de Fogo Base por segundo |
| 1 | Causa # % do seu Escudo de Energia Máximo como Dano Base de Fogo por segundo |
| 1 | Causa # % do seu máximo de Vida como Dano de Caos base |
| 1 | Causa # % mais Dano com Acertos e Afecções quando conjurada em um Disparo Congelante |
| 1 | Causa # % mais Dano com Acertos por cada # segundos de Duração |
| 1 | Causa # % mais Dano com Afecções por cada # segundos de Duração |
| 1 | Causa # a # de Dano de Fogo |
| 1 | Causa # a # de Dano de Gelo |
| 1 | Causa # Ondas |
| 1 | Causa +# % da sua Vida Máxima como Dano de Fogo base |
| 1 | Causa +# rajadas |
| 1 | Causa Dano de Fogo Adicional igual a # % da Vida Máxima |
| 1 | Causa Dano de Fogo base igual a #% da Vida Máxima dos Totens |
| 1 | Causa dano de magia adicional igual a # % do dano da adaga equipada Se duas adagas estiverem equipadas, cada uma contribui com até # % de dano adicional |
| 1 | Causa Dano de Raio Adicional igual a # % da Mana máxima |
| 1 | Causa Dano de Raio base igual a # % da Mana Não Reservada que falta |
| 1 | Causa Dano de Raio base igual a +# % da Mana Não Reservada que falta |
| 1 | Causa Dano Físico Adicional igual a # % da Mana Máxima |
| 1 | Causa Dano nos Inimigos # vezes |
| 1 | Causa explosões menores até # vezes em acertos inimigos |
| 1 | Ceifadores fazem com que seus Lacaios não-Ceifadores tenham # % menos Dano |
| 1 | Ceifadores fazem com que seus Lacaios não-Ceifadores tenham # % menos Vida Máxima |
| 1 | Chance de Crítico aumentada em # % por Carga de Poder |
| 1 | Chão amaldiçoado de habilidades reforçadas ativam Sapo Explosivo a cada # segundo |
| 1 | Circunferência base da área-alvo é de # metros |
| 1 | Circunferência base da onda é de # metros |
| 1 | Clamores reforçados criam um chão consagrado com duração de # segundos |
| 1 | Clamores reforçados têm #% de área de efeito |
| 1 | Clamores reforçados têm a velocidade de recarga reduzida em #% |
| 1 | Clamores Suportados infligem # Debuffs de Sangue Corrompido |
| 1 | Clamores Suportados infligem # Debuffs de Sangue Corrompido no primeiro inimigo Acertado por cada Ataque que Impelirem |
| 1 | Clamores Suportados infligem # Debuffs de Sangue Corrompido no primeiro\ninimigo Acertado por cada Ataque que Impelirem |
| 1 | Clones possuem # % de aumento da Velocidade de Movimento |
| 1 | Cobre Inimigos em Cinzas ao Acertar |
| 1 | Comprimento máximo da corrente: # metros |
| 1 | Concede # % mais velocidade de conjuração |
| 1 | Concede # de Regeneração de Mana por segundo para cada Inimigo afetado |
| 1 | Concede # de Regeneração de Mana por segundo se qualquer Inimigo está afetado |
| 1 | Concede # de Regeneração de Vida por segundo caso um Inimigo esteja afetado |
| 1 | Concede # de Regeneração de Vida por segundo para cada Inimigo afetado |
| 1 | Concede +# ao máximo de Cargas de Sangue |
| 1 | Concede aos Lacaios +# % de Chance de Bloquear Dano Mágico |
| 1 | Concede até o máximo de Cargas de Sangue |
| 1 | Consome # Carga de # Frasco de Vida, se possível, por Projétil Disparado |
| 1 | Consome # Cargas de # Frasco de Vida, se possível, por Projétil Disparado |
| 1 | Consome todas as Carga de Frenesi quando você Acertar um inimigo enquanto no máximo de Cargas de Frenesi para ganhar Agressividade por # segundo por Carga consumida |
| 1 | Consumir um cadáver com habilidades reforçadas tem #% de chance de conceder uma alma por poder |
| 1 | Consumir um cadáver com habilidades reforçadas tem +#% de chance de conceder uma alma por poder |
| 1 | Conta o Poder total de Inimigos e Aliados no Raio |
| 1 | Converte # % do Dano Físico para um Elemento aleatório |
| 1 | Convoca # Espíritos Sagrados Máximo de # Espíritos Sagrados |
| 1 | Convoca # Espíritos Sagrados\nMáximo de # Espíritos Sagrados |
| 1 | Convoca Martelos Sagrados em até # inimigos atingidos |
| 1 | Convoca um Sentinela da Pureza quando você Matar um Inimigo |
| 1 | CooldownTime |
| 1 | Cria # Estacas adicionais se você mudou de Postura Recentemente |
| 1 | Cria # fendas |
| 1 | Cria # fissura |
| 1 | Cria # mãos adicionais |
| 1 | Cria # mãos por glifo |
| 1 | Cria # Pilares de Cinzas |
| 1 | Cria +# Estacas |
| 1 | Cria +# fendas |
| 1 | Cria +# Pilar de Cinzas |
| 1 | Dano de ataques é absorvido pela concha antes de afetar a vida ou o escudo de Energia do alvo Concha pode sofrer até # de dano antes de explodir |
| 1 | Dano de Caos com Acertos é Resistido pela maior Resistência ao invés |
| 1 | Dano de Caos com Acertos é Resistido pela Resistência mais baixa |
| 1 | Dano de Caos sofrido aumentado em # % |
| 1 | Dano e Resfriamentos Perduram por uma Duração Base de # segundos |
| 1 | Dano e Resfriamentos Perduram por uma Duração Base de +# segundos |
| 1 | Dano Elemental das Habilidades Suportadas não pode ser Refletido |
| 1 | Dano Mágico Suprimido causado em você é Azarado |
| 1 | Debuff causa # % mais Dano por Estágio |
| 1 | Debuff causa +# % mais Dano por Estágio |
| 1 | Debuff Secundário causa # % do total restante do Dano Venenoso Esperado de todos os Venenos no Inimigo morto por segundo como Dano de Caos |
| 1 | Deixa uma Lâmina Persistente no solo para cada # Saraivadas |
| 1 | Desaceleração do Projétil reduzida em # % |
| 1 | Detonação da Mina é Instantânea |
| 1 | Dispara # Flecha |
| 1 | Dispara # Fragmentos de Projéteis em uma Espiral enquanto vôa, e então termina |
| 1 | Dispara # fragmentos por vez até que todos sejam disparados |
| 1 | Dispara # projéteis |
| 1 | Dispara # Projéteis em cada uma das duas espirais espelhadas |
| 1 | Dispara # Projéteis secundários |
| 1 | Dispara # projétil |
| 1 | Dispara # sequências de flechas adicionais |
| 1 | Dispara +# Fragmentos de Projéteis em uma Espiral quando o Projétil terminar |
| 1 | Dispara até # Flechas em alvos diferentes |
| 1 | Dispara projéteis a cada # segundos |
| 1 | Dispara Projéteis a cada # segundos |
| 1 | Dispara Projéteis em cada inimigo Próximo |
| 1 | Dispara Projéteis em direções aleatórias |
| 1 | Dispara tentáculos em até # Alvo |
| 1 | Dispara tentáculos em até # Alvos |
| 1 | Dispara um Carregamento de Flechas no ar Projéteis Disparam de onde a Flecha com o Carregamento cair |
| 1 | Distância de Deslocamento aumentada em # % |
| 1 | Distância de Deslocamento aumentada em % |
| 1 | Duração aumentada em # % por Estágio |
| 1 | Duração Base do Debuff é de # segundos |
| 1 | Duração Base do Frenesi Faminto é de # segundos |
| 1 | Duração do Buff é atualizada após você gastar um total de # de Vida |
| 1 | Durante a Duração Secundária, Reflete # % do Dano Sofrido aos Inimigos |
| 1 | Efeito da Cegueira aumentado em # % |
| 1 | Efeito da Marca aumentado em # % |
| 1 | Efeito das Marcas de Habilidades Suportadas aumentado em #% |
| 1 | Efeito das Marcas de Habilidades Suportadas reduzido em #% |
| 1 | Efeito de eletrificações infligidos com habilidades reforçadas aumentado em #% |
| 1 | Efeito de Maldições aumentado em # % |
| 1 | Efeito do Debuff aumentado em # % |
| 1 | Efeito do Elusivo desta Habilidade aumentado em # % |
| 1 | Efeito em Área de Habilidades Maldição Suportadas reduzido em #% |
| 1 | Efeito em Área reduzido em # % a cada repetição |
| 1 | Efeitos do Sangue Fervendo Perduram por # segundos |
| 1 | Eletrifica inimigos quando eles são esfriados por ataques de habilidades reforçadas, aumentando o dano sofrido com base no efeito de esfriamento |
| 1 | Eletrifica inimigos quando eles são esfriados por seus ataques, aumentando o dano sofrido com base no efeito de esfriamento |
| 1 | Empala Inimigos ao Acertar |
| 1 | Empurra e Interrompe Inimigos em uma pequena Área |
| 1 | Empurra Inimigos ao Acertar |
| 1 | Enquanto na Postura da Areia, Buff faz com que você sofra até # % menos Dano dos Inimigos na Aura |
| 1 | Enquanto na Postura de Sangue, Aura faz com que os Inimigos sofram até # % mais Dano Físico dos Acertos |
| 1 | Enquanto você tiver Regurgitação, as magias reforçadas disparam projéteis em círculo Enquanto você tiver Regurgitação, as magias reforçadas disparam # projéteis adicionais |
| 1 | Envenenar inimigos não envenenados com habilidades reforçadas inflige # envenenamentos adicionais |
| 1 | Envia feixes até # Inimigos, incluindo o Inimigo Vinculado |
| 1 | Envia feixes para +# Inimigo |
| 1 | Envia um feixe ao Inimigo Vinculado |
| 1 | Esfria inimigos quando eles são eletrificados por ataques de habilidades reforçadas, reduzindo a velocidade de ação com base no efeito de eletrificação |
| 1 | Esfria inimigos quando eles são eletrificados por seus ataques, reduzindo a velocidade de ação com base no efeito de eletrificação |
| 1 | Espalha quando o Inimigo afetado for Acertado |
| 1 | Espectros têm Duração Base de # segundos Espectros não viajam entre as Áreas |
| 1 | Espíritos Sagrados têm #% de chance de usar a Habilidade Ativadora quando voc#e disparar um Projétil com tal Habilidade |
| 1 | Espíritos Sagrados têm #% de chance de usar a Habilidade Ativadora quando voc#e disparar um\nProjétil com tal Habilidade |
| 1 | Espíritos Sagrados têm +#% de chance de usar a Habilidade Ativadora quando você disparar um Projétil com tal habilidade enquanto um Inimigo Raro ou Único estiver em sua Presença |
| 1 | Esta habilidade é ativada por habilidades de ataque reforçadas |
| 1 | Esta habilidade é ativada quando uma habilidade de reforço causa dano elétrico com o acerto |
| 1 | Esta Magia ganha Intensidade quando você Conjurá-la, máximo de # |
| 1 | Esta Magia perde # de Intensidade a cada # segundos enquanto se movendo, ou imediatamente ao teleportar |
| 1 | Estacas Despedaçadas têm # % mais Área de Efeito |
| 1 | Estacas Despedaçadoras causam +# % mais dano |
| 1 | Estágios Adicionais do Debuff adicionam +# % de Dano |
| 1 | Estandarte concede # % mais Dano Físico com Habilidades Corpo a Corpo a Você e Aliados |
| 1 | Estandarte concede # de Dano sofrido de cada Tipo de Dano dos Acertos Suprimidos a Você e Aliados |
| 1 | Estandarte concede Precisão aumentada em # % a Você e Aliados |
| 1 | Estandarte faz com que você e Aliados Recuperem # de Vida ao Bloquear |
| 1 | Estandartes reforçados infligem Sangue Corrompido a cada segundo aos inimigos dentro de sua área |
| 1 | Este ataque e lacaios convertem # % do dano físico em dano elétrico |
| 1 | Este Ataque pode ser Impelido como se não fosse uma Habilidade Vaal |
| 1 | Estímulo dura # segundos |
| 1 | Explode um Cadáver próximo ao Disparar Projéteis |
| 1 | Explosão causa # % mais Dano com Acertos e Afecções |
| 1 | Explosão causa # % mais Dano com Acertos por Flecha Explosiva no Alvo |
| 1 | Explosão causa # % mais Dano com Afecções por Flecha Explosiva no Alvo |
| 1 | Explosão causa # % menos Dano Base |
| 1 | Explosão causa + # % de dano com ataques e afecções |
| 1 | Explosão causa +#% de dano com ataques e afecções por estágio |
| 1 | Explosão Final causa + # % de dano |
| 1 | Explosão Final Causa + # % mais Dano |
| 1 | Explosões causam Dano de Fogo base igual a # % da Vida máxima do Lacaio |
| 1 | Explosões causam Dano de Raio igual a # % da Vida Máxima do cadáver |
| 1 | Explosões terão # a # de Dano de Fogo adicional |
| 1 | Exposição a Fogo aplica # % de Resistência a Fogo |
| 1 | Exposição a Gelo aplica # % de Resistência a Gelo |
| 1 | Exposição aplica # % de Resistência Elemental que combine com o maior Dano sofrido |
| 1 | Extensão da onda é de # metros |
| 1 | Feitiços aplicados por habilidades de maldição reforçadas afetam inimigos imunes a feitiços |
| 1 | Feitiços aplicados por habilidades de maldição reforçadas têm #% de chance de afetar inimigos imunes a feitiços |
| 1 | Feitiços de Habilidades Suportadas se Transferem para todos os Inimigos dentro de # metros quando o Inimigo Enfeitiçado morrer |
| 1 | Feixes de habilidades fortalecidas se propagam mais # vezes |
| 1 | Flechas caem em duas linhas perpendiculares |
| 1 | Flechas causam Dano ao alvo final # vezes adicionais após grudar |
| 1 | Fonte de Vida dura # segundos |
| 1 | Fonte de Vida dura +# segundos |
| 1 | Frequência do Pulso aumentada em +# % |
| 1 | Frequência do Raio aumentada em # % |
| 1 | Fúria Arcana concede Velocidade de Conjuração aumentada em #% Fúria Arcana concede Regeneração de Mana aumentada em #% |
| 1 | Fúria Arcana concede Velocidade de Conjuração aumentada em #%\nFúria Arcana concede Regeneração de Mana aumentada em #% |
| 1 | Fúria Arcana dura # segundos |
| 1 | Ganha # Cargas de Frasco quando você Acertar um Inimigo Amaldiçoado, não mais que uma vez a cada # segundos |
| 1 | Ganha # de Gula ao conjurar magias reforçadas |
| 1 | Ganha # de Relâmpagos Concentrados ao atingir corpo a corpo |
| 1 | Ganha # Traumatismo na primeira vez que um Ataque Suportado Acertar um Inimigo Sofre # de Dano Físico por Traumatismo quando você ganhar Traumatismo das Habilidades Suportadas Traumatismos duram # segundos |
| 1 | Ganha Fonte de Vida após Gastar um total de # de Vida no Custo Direto e Efeitos das Habilidades Suportadas |
| 1 | Ganha Fúria Arcana após Gastar um total de # de Mana em Custos Diretos e Efeitos de uma Habilidade Suportada |
| 1 | Ganha Invervação ao Matar um Inimigo Eletrizado com Habilidades Suportadas |
| 1 | Ganha uma Carga de Inspiração ao Gastar Mana em Custos Diretos ou Efeitos das Habilidades Suportadas |
| 1 | Ganha uma Carga de Inspiração ao Gastar Mana em\nCustos Diretos ou Efeitos das Habilidades Suportadas |
| 1 | Ganha uma instância de Intensidade Sobrecarregada por # segundos após perder # de Intensidade com habilidades reforçadas |
| 1 | Ganha uma instância de Intensidade Sobrecarregada por # segundos após\nperder # de Intensidade com habilidades reforçadas |
| 1 | Ganha uma Ruína por uso Ao chegar a sete, sacrifica # % da sua vida e causa # % da vida sacrificada como dano de caos |
| 1 | Ganhe +# metro de raio por segundo enquanto Canalizando, máximo de +# metros |
| 1 | Ganhe um Estágio no início de cada ataque par Máximo de # Estágios |
| 1 | Ganhe uma Carga de Poder quando um Inimigo Morrer enquanto na Área dessa Habilidade A cada Segundo, receba uma Carga de Frenesi se um Inimigo estiver na Área dessa Habilidade |
| 1 | Gasta # % da Mana atual |
| 1 | Gelo se quebra após você sofrer # Acertos Danificadores ou a Duração expirar |
| 1 | Gira # vez |
| 1 | Gira # vezes |
| 1 | Gira +# vezes se em Empunhadura Dupla |
| 1 | Glifos reforçados ativam Constrição Pérfida ao serem recuperados |
| 1 | Golpe Críticos infligem Empalamento |
| 1 | Golpe de Impacto de Zumbis Evocados tem a Velocidade de Recarga aumentada em % |
| 1 | Golpes Críticos com Habilidades Suportadas que infligirem Sangramento também infligem Rompimento |
| 1 | Golpes Críticos não causam Dano extra |
| 1 | Golpes fatais com habilidades reforçadas fazem com que os inimigos tenham #% de chance de explodir e causarem um décimo da própria vida máxima como dano de um elemento aleatório |
| 1 | Golpes fatais com habilidades reforçadas fazem com que os inimigos tenham +#% de chance de explodir e causarem um décimo da própria vida máxima como dano de um elemento aleatório |
| 1 | Golpes Finais das Habilidades de Golpe Suportadas com Armas Corpo a Corpo contra Monstros Raros concedem um de seus Modificadores por # segundos |
| 1 | Golpes Impelidos focam em # Inimigos adicionais |
| 1 | Habilidades Corpo a Corpo causam # % mais Dano em Área enquanto na Postura de Sangue |
| 1 | Habilidades Corpo a Corpo têm # % menos Efeito em Área enquanto na Postura de Sangue |
| 1 | Habilidades de arauto reforçadas não têm efeito bônus |
| 1 | Habilidades de Aura Suportadas não tem Reserva |
| 1 | Habilidades de Efeito em Área Suportadas também afetam áreas na frente e atrás da área alvo |
| 1 | Habilidades de Retaliação Suportadas se tornam Utilizáveis por um tempo #% maior |
| 1 | Habilidades fortalecidas causam + # % de dano |
| 1 | Habilidades fortalecidas causam + # % de dano com ataques e afecções |
| 1 | Habilidades fortalecidas disparam # projéteis adicionais Habilidades fortalecidas disparam projéteis em círculo |
| 1 | Habilidades fortalecidas também afetam # áreas adicionais em espiral ao redor da área-alvo |
| 1 | Habilidades Não-Instantâneas Suportadas têm +# Usos de Tempo do Recarga |
| 1 | Habilidades reforçadas ativam Cristal em Queda ao atingir |
| 1 | Habilidades reforçadas ativam Fluxo Cinético ao causar golpe crítico |
| 1 | Habilidades reforçadas ativam Fluxo Cinético no golpe fatal |
| 1 | Habilidades reforçadas ativam Tormenta do Vazio ao atingir o chão Tormentas do Vazio não podem ser ativadas a menos de # metros de você |
| 1 | Habilidades reforçadas ativam Tormenta do Vazio ao atingir o chão\nTormentas do Vazio não podem ser ativadas a menos de # metros de você |
| 1 | Habilidades reforçadas ativam uma fenda no impacto da pancada |
| 1 | Habilidades reforçadas consomem toda a Fortificação ao usar, causando +#% de dano com afecções por # de Fortificação consumida |
| 1 | Habilidades reforçadas excomungam os inimigos ao atingir corpo a corpo por # segundos |
| 1 | Habilidades reforçadas ganham #% do dano físico como dano de caos adicional por fundamental |
| 1 | Habilidades reforçadas ganham custo de mana base equivalente a #% do mana máximo não reservado |
| 1 | Habilidades reforçadas ganham custo de mana base equivalente a #% do mana máximo reservado |
| 1 | Habilidades reforçadas ganham dano de frio adicionado equivalente a #% do mana máximo reservado |
| 1 | Habilidades reforçadas infligem Chama Santificada ao atingir corpo a corpo |
| 1 | Habilidades reforçadas podem conjurar # glifos adicionais |
| 1 | Habilidades reforçadas sacrificam tudo, menos #, da sua vida e escudo de energia ao usar |
| 1 | Habilidades reforçadas se propagam #% mais vezes |
| 1 | Habilidades reforçadas têm #% de chance de ativar Chamado da Fogueira ao atingir inimigos incendiados corpo a corpo |
| 1 | Habilidades reforçadas têm #% de chance de ignorar a redução de dano físico do inimigo, se cada Ressonância Profana for de, no mínimo, # |
| 1 | Habilidades reforçadas têm #% de chance de ignorar a resistência a dano de caos e elétrico do inimigo, se cada Ressonância Profana for de, no mínimo, # |
| 1 | Habilidades reforçadas têm +#% de chance de causar golpe crítico por Intensidade Sobrecarregada |
| 1 | Habilidades reforçadas têm +#% de multiplicador de golpe crítico por Intensidade Sobrecarregada |
| 1 | Habilidades reforçadas têm o custo aumentado em #% por fundamental |
| 1 | Habilidades Suportadas arremessam Minas em um Arco |
| 1 | Habilidades Suportadas Ativam Explosão Prismática ao Acertar |
| 1 | Habilidades Suportadas Ativam uma vez que o Custo de Mana total em outros Ataques de Arco excederem #% do seu Custo de Mana |
| 1 | Habilidades Suportadas Ativam uma vez que o Custo de Mana total em outros Ataques\nde Arco excederem #% do seu Custo de Mana |
| 1 | Habilidades Suportadas Ativarão Convocar Espíritos Sagrados ao Acertar |
| 1 | Habilidades Suportadas causam # Dano Base de Gelo por segundo |
| 1 | Habilidades Suportadas causam #% mais Dano com Acertos e Afecções por cada # de Custo de Mana |
| 1 | Habilidades Suportadas causam #% mais Dano Elemental por cada # da sua menor Ressonância |
| 1 | Habilidades Suportadas Causam Dano e Resfriam Inimigos entre você e Alvos Vinculados |
| 1 | Habilidades Suportadas concedem Ímpeto de Combate ao Acertar Ímpeto de Combate dura # segundos ou até que você utilize uma Habilidade de Deslocamento |
| 1 | Habilidades Suportadas concedem Ímpeto de Combate ao Acertar\nÍmpeto de Combate dura # segundos ou até que você utilize uma Habilidade de Deslocamento |
| 1 | Habilidades Suportadas Custam +# de Mana |
| 1 | Habilidades Suportadas disparam #% menos Projéteis |
| 1 | Habilidades Suportadas Eletrizam Inimigos como se causassem #% mais Dano |
| 1 | Habilidades Suportadas ganham #% de Dano de Gelo como Dano Extra de Fogo |
| 1 | Habilidades Suportadas ganham Dano de Raio Adicional igual a #% da Mana Máxima não Reservada |
| 1 | Habilidades Suportadas infligem Podridão ao Acertar, causando # de Dano de Caos por segundo durante # segundos |
| 1 | Habilidades Suportadas infligem Subjugado por # segundos ao Bloquear |
| 1 | Habilidades Suportadas não podem aplicar Auras em você a menos que você tenha Lacaios de uma Habilidade Suportada |
| 1 | Habilidades Suportadas não tem Reserva |
| 1 | Habilidades Suportadas penetram #% da Resistência Elemental enquanto cada Ressonância estiver em ao menos # |
| 1 | Habilidades Suportadas podem ter até # Minas Remotas adicionais plantadas de uma vez |
| 1 | Habilidades Suportadas possuem #% de chance de causar Definhado ao Acertar |
| 1 | Habilidades Suportadas recebem #% de Dano Físico como Dano de Caos Extra |
| 1 | Habilidades Suportadas só podem ser usadas com Maças, Cetros ou Cajados |
| 1 | Habilidades Suportadas só podem ser usadas com Machados e Espadas |
| 1 | Habilidades Suportadas só podem ser usadas com Varinhas |
| 1 | Habilidades Suportadas têm # a # de Dano de Ataque Físico Adicional por Traumatismo |
| 1 | Habilidades Suportadas têm #% da duração da Cegueira aumentada |
| 1 | Habilidades Suportadas têm #% de chance de Cegar inimigos ao acertar |
| 1 | Habilidades Suportadas têm #% de chance de Enervar Inimigos por # segundos ao Acertar |
| 1 | Habilidades Suportadas têm #% de chance de Esmagar Inimigos por # segundos ao Acertar |
| 1 | Habilidades Suportadas têm #% de chance de ganhar uma Carga de Frenesi ao Matar um Inimigo Congelado |
| 1 | Habilidades Suportadas têm #% de chance de ganhar uma Carga de Poder com Golpes Críticos |
| 1 | Habilidades Suportadas têm #% de chance de infligir Exposição a Gelo ao Acertar |
| 1 | Habilidades Suportadas têm #% de chance de infligir Exposição a Raio ao Acertar |
| 1 | Habilidades Suportadas têm #% de chance de infligirem Exposição a Fogo ao Acertar |
| 1 | Habilidades Suportadas têm #% de chance de Intimidar Inimigos por # segundos ao Acertar |
| 1 | Habilidades Suportadas têm #% de Dano de Gelo Convertido para Dano de Fogo |
| 1 | Habilidades Suportadas têm #% de Dano Drenado como Vida |
| 1 | Habilidades Suportadas têm #% de Dano Físico Convertido em Dano de Raio |
| 1 | Habilidades Suportadas têm #% de Duração de Atordoamentos em Inimigos aumentada |
| 1 | Habilidades Suportadas têm #% de Duração de Efeito da Habilidade aumentada |
| 1 | Habilidades Suportadas têm #% de Duração de Eletrização aumentada em Inimigos |
| 1 | Habilidades Suportadas têm #% de Precisão aumentada |
| 1 | Habilidades Suportadas têm #% de Velocidade de Ataque de Lacaios aumentada |
| 1 | Habilidades Suportadas têm #% de Velocidade de Conjuração de Lacaios aumentada |
| 1 | Habilidades Suportadas tem #% do Dano Drenado como Escudo de Energia |
| 1 | Habilidades Suportadas têm #% mais frequência de Ativação |
| 1 | Habilidades Suportadas têm #% menos Velocidade de Projétil |
| 1 | Habilidades Suportadas têm +# de Precisão |
| 1 | Habilidades Suportadas têm +# metros ao Alcance de Golpes Corpo a Corpo |
| 1 | Habilidades Suportadas têm +#% de chance de Congelar Inimigos Resfriados |
| 1 | Habilidades Suportadas têm alcance de Transferência de Feitiços aumentado em #% |
| 1 | Habilidades Suportadas tem Chance de Golpe Crítico aumentada em #% por Carga de Inspiração |
| 1 | Habilidades Suportadas têm Custo de Vida aumentado em #% |
| 1 | Habilidades Suportadas têm Dano Mágico Adicional igual a #% doDano das Armas Corpo a Corpo de Uma Mão Equipadas Se duas Armas forem Equipadas, cada uma contribuindo com #% da quantidade de Dano Adicional |
| 1 | Habilidades Suportadas têm Duração da Armadilha aumentada em #% Habilidades reforçadas têm a duração de mina aumentada em #% |
| 1 | Habilidades Suportadas têm Duração da Fortificação aumentada em #% |
| 1 | Habilidades Suportadas têm Duração do Atordoamento aumentada em #% por Traumatismo |
| 1 | Habilidades Suportadas têm Efeito da Mutilação aumentado em #% |
| 1 | Habilidades Suportadas têm Efeito das Auras reduzido em #% |
| 1 | Habilidades Suportadas têm Velocidade de Recuperação da Recarga reduzida em #% |
| 1 | Ignora Atordoamentos enquanto Usando Habilidades Suportadas |
| 1 | Impactos têm # % mais Efeito em Área |
| 1 | Impele os próximos # Ataques de Golpe Corpo a Corpo que você executar |
| 1 | Impele os próximos # Ataques de Pancada Corpo a Corpo que você executar |
| 1 | Incendiar Inimigos cria Solo Ardente, não mais que uma vez por segundo Solo Ardente causa # % do Dano de Fogo por segundo do Incêndio infligido |
| 1 | Incêndios causados por Habilidades Suportadas se espalham para outros Inimigos dentro de # metros |
| 1 | Inervação dura # segundos |
| 1 | Inflige # Debuffs de Definhamento adicionais na primeira vez que cada Inimigo entrar na Área |
| 1 | Inflige +# Debuffs de Definhamento adicionais na primeira vez que cada Inimigo entrar na Área |
| 1 | Inflige Definhando por # segundos ao Acertar |
| 1 | Inimigos afetados por feitiços de habilidades de maldição reforçadas não podem causar golpes críticos |
| 1 | Inimigos Amaldiçoados possuem uma redução de # % de Precisão |
| 1 | Inimigos Amaldiçoados são Debilitados por # Segundos quando Acertarem |
| 1 | Inimigos Amaldiçoados são Debilitados por +# Segundos quando Acertarem |
| 1 | Inimigos Amaldiçoados sofrem Dano aumentado em # % de Acertos de Projéteis |
| 1 | Inimigos Amaldiçoados sofrem Dano aumentado em # % enquanto em Vida Baixa |
| 1 | Inimigos Amaldiçoados têm # % de chance de concederem uma Carga de Frenesi quando Acertados |
| 1 | Inimigos Amaldiçoados têm # % de chance de concederem uma Carga de Poder quando Acertados |
| 1 | Inimigos Amaldiçoados têm # % de chance de concederem uma Carga de Tolerância quando Acertados |
| 1 | Inimigos Amaldiçoados têm # % de Reducão de Dano Físico |
| 1 | Inimigos Aprisionados sofrem Dano de Projétil dos Acertos de Ataques aumentado em # % |
| 1 | Inimigos Desacelerados sofrem Dano de Caos aumentado em # % |
| 1 | Inimigos em Áreas Resfriadas por Habilidades Suportadas tem o Dano de Gelo sofrido aumentado pelo Efeito de Resfriamento |
| 1 | Inimigos Encharcados têm Exposição a Gelo e Raio, aplicando # % às Resistências |
| 1 | Inimigos Incendiados por Habilidades Suportadas possuem #% de Resistência a Fogo |
| 1 | Inimigos possuem # % menos Velocidade de Movimento no início do Debuff |
| 1 | Inimigos possuem #% de chance de Bloquear o Dano de Ataques e Magias das Habilidades Suportadas |
| 1 | Inimigos Provocados por este Clamor são Intimidados |
| 1 | Inimigos Raros e Únicos Amaldiçoados tem # % menos Velocidade de Ação |
| 1 | Inimigos recebem # % de aumento de Dano dos Acertos de Minas ou Armadilhas |
| 1 | Inimigos Resfriados por Habilidades Suportadas tem o Dano de Gelo sofrido aumentado pelo Efeito de Resfriamento |
| 1 | Inimigos sofrem de Insanidade Perversa se estiverem sob a influência de auras de habilidades reforçadas por mais de # segundos |
| 1 | Intensidade de Chama Santificada infligida por habilidades reforçadas aumentada em #% |
| 1 | Inverte a direção ao Repetir |
| 1 | Invervação concede # a # de Dano de Raio |
| 1 | Invoca # Lacaios Relâmpagos Vivos |
| 1 | Invoca # Nascido(s) da Colmeia |
| 1 | Invoca # Totens de Balista em círculo que usam esta habilidade |
| 1 | Lacaios causam # % de Dano Físico |
| 1 | Lacaios convertem #% do Dano Físico para Dano de Raio |
| 1 | Lacaios criados por Habilidades Suportadas ganham Fúria Desperta e Adrenalina por #% de sua Duração, máximo de # segundos Fúria Desperta concede +#% de Chance de Golpe Crítico Fúria Desperta concede +#% de Multiplicador de Golpe Crítico |
| 1 | Lacaios das Habilidades Suportadas sofrem #% de sua Vida e Escudo de Energia Máximos total como Dano Físico por segundo enquanto você tiver uma Aura de uma Habilidade Suportada em você |
| 1 | Lacaios das Habilidades Suportadas têm # metros ao Raio de seu Efeito Incendiário |
| 1 | Lacaios de habilidades reforçadas sofrem #% de dano, se eles forem seus únicos lacaios |
| 1 | Lacaios de habilidades reforçadas sofrem #% do dano de ataque da própria vida antes de você, se eles forem seus únicos lacaios |
| 1 | Lacaios de habilidades reforçadas sofrem #% do dano de ataque da própria vida\nantes de você, se eles forem seus únicos lacaios |
| 1 | Lacaios de habilidades reforçadas têm +#% de multiplicador de golpe crítico toda vez que você causar um golpe crítico recentemente com um ataque, até +#% |
| 1 | Lacaios de habilidades reforçadas têm a chance de causar golpe crítico aumentada em #% toda vez que você causar um golpe crítico recentemente com um ataque, até #% |
| 1 | Lacaios de Habilidades Suportadas causam # de Dano de Fogo por segundo aos Inimigos próximos a eles |
| 1 | Lacaios de Habilidades Suportadas infligem Exposição no Acerto, aplicando #% à Resistência Elemental que combine com o maior tipo de Dano sofrido pelo Inimigo |
| 1 | Lacaios de Habilidades Suportadas são Agressivos |
| 1 | Lacaios de Habilidades Suportadas são Defensivos |
| 1 | Lacaios de Habilidades Suportadas sempre focam em Presas se possível |
| 1 | Lacaios de Habilidades Suportadas sofrem #% de sua Vida Máxima como Dano de Fogo por segundo |
| 1 | Lacaios de Habilidades Suportadas sofrem #% menos Dano |
| 1 | Lacaios de Habilidades Suportadas têm #% ao máximo de todas as Resistências Elementais |
| 1 | Lacaios de Habilidades Suportadas tem #% de chance de conceder Frenesi Faminto à você no Acerto |
| 1 | Lacaios de Habilidades Suportadas tem #% de chance de Provocar ao Acertar |
| 1 | Lacaios de Habilidades Suportadas têm +#% ao máximo de todas as Resistências Elementais |
| 1 | Lacaios de Habilidades Suportadas têm +#% de todas as Resistências Elementais |
| 1 | Lacaios Regeneram # % de Vida por segundo |
| 1 | Lacaios Relâmpagos Vivos atacam # vezes antes de desaparecerem |
| 1 | Lacaios Relâmpagos Vivos atacam +# vezes antes de desaparecerem |
| 1 | Lacaios têm # % de chance de agravar sangramento em alvos atingidos com ataques |
| 1 | Lacaios têm # % de chance de causar Dano Dobrado |
| 1 | Lacaios têm # % menos Vida Máxima |
| 1 | Lacaios têm #% de chance de cobrir os inimigos de gelo ao atingir |
| 1 | Lacaios têm Chance de Acerto Crítico aumentada em # % |
| 1 | Lacaios têm efeito de definhamento aumentado em # % |
| 1 | Lacaios têm Efeito Eletrizante aumentado em # % |
| 1 | Lacaios tem Efeito Resfriante aumentado em # % |
| 1 | Lâminas Persistêntes Animadas se tornam Arcos |
| 1 | Lança até # armadilhas a mais ao usar duas armas |
| 1 | Lança correntes em até # alvos ao alcance |
| 1 | Lança uma corrente em até # inimigos |
| 1 | Libera ondas a cada # segundos |
| 1 | Magias reforçadas causam de # a # de dano físico adicionado para cada lacaio permanente |
| 1 | Magias Suportadas causam # % menos Dano |
| 1 | Magias Suportadas ganham Intensidade quando você as Conjurar, máximo de # Habilidades Suportadas disparam um Projétil a menos por Intensidade |
| 1 | Magias Suportadas ganham Intensidade quando você as Conjurar, máximo de #\nHabilidades Suportadas disparam um Projétil a menos por Intensidade |
| 1 | Magias Suportadas Sacrificam #% da sua Vida atual quando Conjuradas para ganhar Dano de Caos adicional igual a #% da Vida Sacrificada |
| 1 | Magias Suportadas têm Recuperação da Recarga aumentada em #% |
| 1 | Mais # % de dano contra inimigos atordoados |
| 1 | Mais # % de dano quando em estágios máximos |
| 1 | Martelos Cadentes ocorrem a cada # segundos Aumentos e reduções na velocidade de ataque afetam a frequência com que esses martelos caem |
| 1 | Mata Inimigos com #% de Vida ou menos quando Acertado por Habilidades Suportadas |
| 1 | Mata inimigos de raridade normal e mágica com #% de vida ou menos quando atingidos por habilidades reforçadas |
| 1 | Máximo de # Arqueiro Ilusório Convocado |
| 1 | Máximo de # Estágios Deixa # Esporo por Estágio |
| 1 | Máximo de # Lacaios Relâmpagos Vivos |
| 1 | Máximo de # mãos |
| 1 | Máximo de # Nascido(s) da Colmeia |
| 1 | Máximo de # tempestades |
| 1 | Máximo de +# Flechas Explosivas grudadas em cada Inimigo |
| 1 | Máximo de +# gêiseres por vez |
| 1 | Máximo de +# Paredes Flamejantes por vez |
| 1 | Máximo de +# Projéteis capturados |
| 1 | Minas de Habilidades Suportadas não podem ser Detonadas enquanto dentro de # metros de você |
| 1 | Minas não podem ser Re-armadas |
| 1 | Minas tem Velocidade de Detonação aumentada em # % |
| 1 | Minas usando Habilidades Suportadas sempre focam na sua localização |
| 1 | Modificadores ao Dano Mágico são aplicados ao efeito de Dano Degenerativo das Habilidades Suportadas |
| 1 | Mutila ao Acertar |
| 1 | Não pode Incendiar |
| 1 | Não pode infligir Envenenamento em Inimigos Envenenados |
| 1 | Não pode infligir múltiplos envenenamentos com o mesmo ataque |
| 1 | Não pode infligir Resfriamento |
| 1 | Não pode ser Conjurado ou Ativado enquanto Elusivo Concede Elusivo |
| 1 | Não pode ser Convocada |
| 1 | Não requer um cadáver |
| 1 | O efeito atual é finalizado após # Abalos Secundários |
| 1 | O primeiro e último disparo da sequência dispara # Projéteis adicionais simultâneos |
| 1 | O primeiro martelo de cada cascata causa + # % de dano |
| 1 | O raio base da Saraivada é de # metros |
| 1 | o totem provoca os monstros em volta a atacá-lo (act_str.lua:##) |
| 1 | Oferendas reforçadas ativam Invocar Nascidos da Colmeia ao usar |
| 1 | Onda Central tem # % mais Área de Efeito |
| 1 | Onda de Choque causa # % mais Dano |
| 1 | Onda de Choque causa # % menos Dano |
| 1 | Onda de Choque causa +# % mais Dano |
| 1 | Onda de choque se repete de até # inimigos na área |
| 1 | Onda pode recomeçar até # vezes Áreas de onda ganham +# metros de raio para cada área anterior |
| 1 | Ondas adicionais serão criadas a partir dos aliados dentro de um raio base de # metros do primeiro inimigo atingido |
| 1 | Outros efeitos em inimigos Amaldiçoados expiram # % mais devagar |
| 1 | Pela Duração Inicial, pode ser acertado pelos seus Projéteis até # vezes |
| 1 | Penetra # % da Resistência a Fogo |
| 1 | Perca # de Fúria por segundo |
| 1 | Perca todas as Cargas de Inspiração após Gastar um total de # de Mana em Custos Diretos e Efeitos das Habilidades Suportadas |
| 1 | Perca todo o Traumatismo ao atingir # Traumatismos |
| 1 | Perca Vida e Escudo de Energia igual a # % do Dano do Debuff |
| 1 | perto do totem, você ganha Área de Efeito aumentada para Habilidades Corpo a Corpo (a descrição; o valor — ancestor_totem_grants_owner_area_of_effect_+%_with_melee_skills — não está nos dados do PoB) |
| 1 | Pode aglomerar até # usos |
| 1 | Pode explor de até # Projéteis de Disparo Congelante |
| 1 | Pode se expandir de até # Projéteis de Disparo Congelante |
| 1 | Possui # Chamas |
| 1 | Possui # lâminas |
| 1 | Primeira Mina é Detonada Instantaneamente Minas recebem # % mais Velocidade de Detonação para cada Mina anteior na Sequência de Detonação |
| 1 | Primeiro Impacto causa # % mais Dano com Acertos e Afecções |
| 1 | Primeiro Impacto tem # % mais efeito em área |
| 1 | Projéteis causam +# % mais dano por projétil disparado anteriormente em sequência |
| 1 | Projéteis das Habilidades Suportadas causam #% mais Dano com Acertos por Intensidade |
| 1 | Projéteis de Habilidades Suportadas Atravessam # Alvos adicionais |
| 1 | Projéteis de Habilidades Suportadas Atravessam todos os Alvos enquanto Retornando |
| 1 | Projéteis de Habilidades Suportadas causam #% menos Dano com Acertos e Afecções enquanto Retornam |
| 1 | Projéteis de Habilidades Suportadas Retornam a você |
| 1 | Projéteis de Habilidades Suportadas têm #% de chance de ganhar um Projétil adicional ao Difundirem |
| 1 | Projéteis deixam Solo Eletrizado |
| 1 | Projéteis mudam de direção # vezes Projéteis podem Acertar alvos cada vez que mudam de direção |
| 1 | Projéteis Perfuram todos Alvos |
| 1 | Projéteis podem Ricochetear ao atingir o solo Projéteis Ricocheteiam para direções aleatórias |
| 1 | Projéteis podem se Dividir ao acertar o terreno |
| 1 | Projéteis que Acertarem Inimigos Amaldiçoados se Dividem na direção de # alvos adicionais |
| 1 | Projéteis que passam pela parede causam # a # de Dano de Fogo Adicional |
| 1 | Projéteis Retornam a você |
| 1 | Projéteis Retornando Atravessam todos os Alvos |
| 1 | Projéteis Retornando causam # % menos Dano com Acertos e Afecções |
| 1 | Projéteis Ricocheteiam ao colidirem com o terreno |
| 1 | Pulsa a cada # enquanto Congelada, Eletrizada, Enfraquecida ou Exaurida |
| 1 | Pulsos causam # % mais Dano com Afecções por Energia após a primeira |
| 1 | Pulsos causam # % mais Dano com Dano com Acertos por Energia após a primeira |
| 1 | Pulsos Fortalecidos causam # % mais Dano com Acertos e Afecções |
| 1 | Pulsos Mais Fortes têm # % mais Área de Efeito |
| 1 | Qualidade não tem efeito |
| 1 | Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade Arqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados |
| 1 | Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade\nArqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados |
| 1 | Raio acerta # alvo dentro de # metros |
| 1 | Raio acerta alvos dentro de +# metros |
| 1 | Raio base da lâmina é de # metro |
| 1 | Raio Base da Mão Principal é de # metros |
| 1 | Raio Base do Círculo é de # metro +# metros ao Raio do Círculo por Estágio A Canalização é interrompida quando o Raio Total do Círculo atingir # metros |
| 1 | Raio Base final do Solo Resfriado igual a # metros |
| 1 | Raio de alcance base da mão secundária é de # metros |
| 1 | Raio de alcance base do impacto é de # metro |
| 1 | Raio inicial base de chão congelado é de # metros |
| 1 | Raios acertam a cada # segundos |
| 1 | Raios Acertam Inimigos a cada # segundos |
| 1 | Raios causam # % menos Dano |
| 1 | Raridade de Itens Derrubados por Inimigos Mortos por Habilidades Suportadas aumentada em #% |
| 1 | Receba uma Carga de Poder quando um Projétil Acertar um Inimigo Raro ou Único |
| 1 | Receba uma Carga de Tolerância quando você Atordoar um Inimigo com um Acerto Corpo a Corpo com Habilidades Suportadas |
| 1 | Recuperação da Recarga aumentada em # % se usado enquanto um Inimigo Único estiver em sua Presença |
| 1 | Redução do Ponto de Atordoamento aumentada em # % em inimigos na distância Máxima da investida |
| 1 | Reflete # % do Dano sofrido pelo Buff como Dano de Fogo por segundo, ou quando o Buff expirar ou se esgotar |
| 1 | Reflete # % do Dano sofrido pelo Buff como Dano de Fogo quando o Buff expirar ou se esgotar |
| 1 | Remove Resfriamentos após Causar Dano |
| 1 | Repetição Final das Habilidades Suportadas tem #% de chance de causar Dano Dobrado |
| 1 | Repetições da onda de choque causam #% de dano com ataques e afecções |
| 1 | Resfria Inimigos por # segundos ao Acertar, reduzindo sua Velocidade de Ação em # % |
| 1 | Resistência à Fogo de Inimigos Próximos é Ignorada por Acertos |
| 1 | Resistência à Gelo de Inimigos Próximos é Ignorada por Acertos |
| 1 | Resistência à Raio de Inimigos Próximos é Ignorada por Acertos |
| 1 | Robôs Rastejantes concedem # % mais Dano de Armadilhas e Minas |
| 1 | Sacrifica # % da Vida do Esqueleto para causar a mesma quantidade de Dano de Caos |
| 1 | Sacrifica # % do seu total de Escudo de Energia e Vida Causa # % do Escudo de Energia e Vida Sacrificados como Dano de Fogo por segundo |
| 1 | Sacrifica +# % da Vida do Esqueleto para causar a mesma quantidade de Dano de Caos |
| 1 | Sacrifica +# % de Fúria ao criar uma Tempestade Furiosa |
| 1 | Sacrifica +# % de Fúria ao criar uma Tempestade Furiosa, se você tiver ao menos # de Fúria |
| 1 | Sangramento expira #% mais rápido por Rompimento das Habilidades Suportadas nos alvos |
| 1 | Sangramentos inflingidos por esta Habilidade causam Dano # % mais rápido |
| 1 | Sangue Corrompido infligido por Clamores Suportados causam # de Dano Físico base por segundo |
| 1 | Sangue Corrompido infligido por Clamores Suportados tem uma Duração Base de # segundos |
| 1 | Sangue Corrompido infligido por estandartes reforçados causam # de dano físico base por segundo por bravura consumida |
| 1 | Sangue Corrompido infligido por estandartes reforçados tem uma duração base de # segundos |
| 1 | Segunda forma possui um aumento de # % de Chance de Crítico |
| 1 | Segundo Estágio causa # % menos Dano |
| 1 | Só pode ser Acertado uma vez a cada # segundo |
| 1 | Sofre # % da Vida Máxima e # % do Escudo de Energia Máximo como Dano de Caos |
| 1 | Sofre # % do Escudo de Energia Máximo como Dano de Caos |
| 1 | Solo Ardente causa # % de Dano de Fogo por segundo de Incêndio afetando o Inimigo |
| 1 | Solo Ardente causa # % do Dano de Fogo por Segundo do Incêndio mais forte no Inimigo Solo Cáustico causa # % do Dano de Caos por Segundo do Envenenamento mais forte no Inimigo Pode criar cada efeito de Solo não mais que uma vez por segundo |
| 1 | Solo ardente causa +# % do Dano de Fogo por segundo do Incêndio infligido |
| 1 | Solo Ardente dura # segundos |
| 1 | Solo Eletrizado causa # % de Dano sofrido aumentado |
| 1 | Somente uma Mina deste tipo pode ser Detonada em cada Sequência de Detonação |
| 1 | Suas Habilidades e de seus aliados próximos não Custam Mana |
| 1 | Suas Habilidades Não-Bênção que Reservam Mana são Desabilitadas enquanto você tiver uma Aura da Habilidade Suportada em você |
| 1 | Subjugado aplica #% à chance de Bloquear o Dano Mágico e de Ataques |
| 1 | Taxa base de explosão do orbe é de uma vez por segundo |
| 1 | Taxa de Acerto aumentada em # % por cada lâmina |
| 1 | Tempestade Furiosa causa # % mais Dano por cada # de Fúria Sacrificada |
| 1 | Tempestades Acertam Inimigos com Frequência aumentada em # % |
| 1 | Tempestades ganham um estágio por # segundos, até # |
| 1 | Tempestades têm +#% de área de efeito por estágio |
| 1 | Terceiro Estágio causa # % menos Dano |
| 1 | Tormenta Furiosa tem +# metros ao raio por cada # de Fúria sacrificada |
| 1 | Totens com esta Habilidade a Ativam quando Acertados por um Inimigo |
| 1 | Totens das Habilidades Suportadas ganham a Habilidade Vingança Flamejante e a Ativa quando Acertado por um Inimigo |
| 1 | Totens das Habilidades Suportadas ganham a Habilidade\nVingança Flamejante e a Ativa quando Acertado por um Inimigo |
| 1 | Um a cada # Projéteis disparados permanece no solo como Lâmina Persistente |
| 1 | Um lacaio próximo ganha uma alma para cada # de vida que você gasta em custos iniciais com magias reforçadas |
| 1 | Um lacaio próximo ganha uma alma para cada # de vida que você gasta em custos\niniciais com magias reforçadas |
| 1 | Uma rajada de lâminas cai a cada # segundos |
| 1 | Usa sua Vida se não houver Esqueletos em alcance |
| 1 | Usar habilidades vaal reforçadas inflige Tentação Vaal em você, causando # de dano físico por segundo, em vez de aplicar impedimento de ganho de almas |
| 1 | Utiliza o Tempo de Ataque da Arma Secundária |
| 1 | Velocidade de Ataque aumentada em # % caso tenha mudado de Postura Recentemente |
| 1 | Velocidade de Ataque aumentada em # % por Carga de Frenesi |
| 1 | Velocidade de Recuperação da Recarga aumentada em # % para cada Inimigo Normal ou Mágico na Área Velocidade de Recuperação da Recarga aumentada em # % para cada Inimigo Raro ou Único na Área |
| 1 | Velocidade de rotação aumentada em # % se em Empunhadura Dupla |
| 1 | Você e Aliados não-Lacaios Próximos têm # % de chance de criarem Solo Sagrado ao Acertar um Inimigo Raro ou Único, durando # segundos |
| 1 | Você e Aliados próximos ganham # % de Velocidade de Recarga de Escudo de Energia aumentada |
| 1 | Você e aliados próximos têm +# % de chance de Evadirem Acertos de Ataques |
| 1 | Você Queima por # % da sua Mana Máxima por segundo como Dano de Fogo |
| 1 | Você Queima por # % de sua Vida máxima por segundo como Dano de Fogo |
| 1 | Você Queima por # % do seu Escudo de Energia máximo por segundo como Dano de Fogo |
| 1 | Você sofre # % menos Dano de Acertos e conta como Congelado |
| 1 | ㅤ+ # % de dano com ataques e afecções por Relâmpagos Concentrados |
| 1 | ㅤ+ # % de dano por carga de poder removida |

## Gemas de habilidade pendentes

- **Absolution** (Absolvição) — parcial
  - efeito não simulado: 25 % de chance de Convocar um Sentinela da Absolvição ao Acertar um Inimigo Raro ou Único
  - efeito não simulado: Lacaios têm Recuperação da Recarga aumentada em 40 %
- **Absolution_of_Inspiring** (Absolvição da Inspiração) — parcial
  - efeito não simulado: 25 % de chance de Convocar um Sentinela da Absolvição ao Acertar um Inimigo Raro ou Único
- **Alchemists_Mark** (Marca do Alquimista) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Solo Ardente causa 26 % do Dano de Fogo por Segundo do Incêndio mais forte no Inimigo Solo Cáustico causa 79 % do Dano de Caos por Segundo do Envenenamento mais forte no Inimigo Pode criar cada efeito de Solo não mais que uma vez por segundo
  - efeito não simulado: Ganha 1 Cargas de Frasco quando você Acertar um Inimigo Amaldiçoado, não mais que uma vez a cada 3 segundos
  - efeito não simulado: Efeito da Marca aumentado em 10 %
- **Ambush** (Emboscada) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: Buff é removido para Impelir o próximo Ataque Corpo a Corpo que você executar Ataques Impelidos por esta Habilidade não podem ser Impelidos por outras Habilidades
  - efeito não simulado: Ataques Impelidos têm +25 % de Chance de Golpe Crítico
  - efeito não simulado: Ataques Impelidos têm +138 % de Multiplicador de Dano Crítico
  - efeito não simulado: Duração da penalidade base é de 3 segundos
  - efeito não simulado: Ataques Impelidos têm +10 % de Chance de Golpe Crítico
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Ancestral_Cry** (Clamor Ancestral) — parcial
  - efeito não simulado: Impele os próximos 8 Ataques de Golpe Corpo a Corpo que você executar
  - efeito não simulado: Golpes Impelidos focam em 2 Inimigos adicionais
- **Animate_Guardian** (Animar Guardião) — parcial
  - efeito não simulado: Velocidade de Movimento dos Lacaios aumentada em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Animate_Guardian_of_Smiting** (Guardião Animado do Castigo) — parcial
  - efeito não simulado: Velocidade de Movimento dos Lacaios aumentada em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Animate_Weapon** (Animar Arma) — parcial
  - efeito não simulado: +2 ao Máximo de Armas Animadas
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Animate_Weapon_of_Ranged_Arms** (Animar Arma dos Braços Distantes) — parcial
  - efeito não simulado: Lâminas Persistêntes Animadas se tornam Arcos
  - efeito não simulado: +2 ao Máximo de Armas Animadas
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Animate_Weapon_of_Self_Reflection** (Animar Arma da Auto-reflexão) — parcial
  - efeito não simulado: +1 ao Máximo de Armas Animadas
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Arc_of_Surging** (Arco Elétrico do Surgimento) — parcial
  - efeito não simulado: O feixe se divide em direção a +2 alvos adicionais
- **Arcane_Cloak** (Manto Arcano) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Gasta 64 % da Mana atual
  - efeito não simulado: 75 % do Dano de Acertos é sofrido no Buff antes da sua Vida ou Escudo de Energia Buff pode sofrer Dano igual a Mana Gasta pelo efeito desta Habilidade
  - efeito não simulado: Buff concede Dano de Raio Adicional igual a 10 % da Mana Gasta pelo efeito desta Habilidade
  - efeito não simulado: Efeito do Buff aumentado em 20 %
- **Arcanist_Brand** (Runa Arcanista) — parcial
  - sem dano direto: nenhum efeito no combate
- **Armageddon_Brand_of_Volatility** (Runa do Armagedom da Volatilidade) — parcial
  - efeito não simulado: Não pode ser Convocada
- **Artillery_Ballista** (Balista de Artilharia) — parcial
  - efeito não simulado: as flechas caem em linha, cada uma com dano em área e um acerto só por inimigo (act_dex.lua:751-769; no jogo ainda são projéteis no alvo)
- **Artillery_Ballista_of_Cross_Strafe** (Balista de Artilharia do Fogo Cruzado) — parcial
  - efeito não simulado: as flechas caem em linha, cada uma com dano em área e um acerto só por inimigo (act_dex.lua:751-769; no jogo ainda são projéteis no alvo)
  - efeito não simulado: Flechas caem em duas linhas perpendiculares
- **Artillery_Ballista_of_Focus_Fire** (Balista de Artilharia do Fogo Concentrado) — parcial
  - efeito não simulado: as flechas caem em linha, cada uma com dano em área e um acerto só por inimigo (act_dex.lua:751-769; no jogo ainda são projéteis no alvo)
  - efeito não simulado: Dispara até 5 Flechas em alvos diferentes
- **Assassins_Mark** (Marca do Assassino) — parcial
  - efeito não simulado: Inimigos Amaldiçoados têm 5 % de chance de concederem uma Carga de Poder quando Acertados
- **Automation** (Automação) — sem efeito
  - a gema não tem comportamento de combate reconhecido
- **Ball_Lightning_of_Orbiting** (Esfera Trovejante da Órbita) — parcial
  - efeito não simulado: 100 % mais Velocidade de Projétil
- **Bane** (Banir) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: 42 % mais Dano por Maldição aplicada
  - efeito não simulado: Só aplica Feitiços de Gemas de Habilidades Maldição que exigem Nível 70 ou menor
  - efeito não simulado: Essa Gema só pode Suportar Gemas de Habilidade que requerem Nível 70 ou menos
- **Bane_of_Condemnation** (Banimento da Condenação) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Só aplica Feitiços de Gemas de Habilidades Maldição que exigem Nível 70 ou menor
  - efeito não simulado: Essa Gema só pode Suportar Gemas de Habilidade que requerem Nível 70 ou menos
- **Barrage_of_Volley_Fire** (Barragem da Saraivada de Tiros) — parcial
  - efeito não simulado: O primeiro e último disparo da sequência dispara 6 Projéteis adicionais simultâneos
  - efeito não simulado: O primeiro e último disparo da sequência dispara 4 Projéteis adicionais simultâneos
- **Bear_Trap** (Armadilha de Urso) — parcial
  - efeito não simulado: Trava o inimigo no lugar
  - efeito não simulado: Inimigos recebem 25 % de aumento de Dano dos Acertos de Minas ou Armadilhas
  - efeito não simulado: Inimigos possuem 80 % menos Velocidade de Movimento no início do Debuff
- **Bear_Trap_of_Skewers** (Armadilha de Urso dos Espetos) — parcial
  - efeito não simulado: Trava o inimigo no lugar
  - efeito não simulado: Golpes Finais fazem com que os Empalamentos em Inimigos Reflitam o Dano aos Inimigos ao redor
  - efeito não simulado: Empala Inimigos ao Acertar
- **Berserk** (Berserk) — sem efeito
  - a gema não tem comportamento de combate reconhecido
- **Blade_Blast_of_Dagger_Detonation** (Explosão de Lâminas da Detonação da Adaga) — parcial
  - efeito não simulado: Causa dano de magia adicional igual a 675 % do dano da adaga equipada Se duas adagas estiverem equipadas, cada uma contribui com até 60 % de dano adicional
- **Blade_Blast_of_Unloading** (Explosão de Lâminas do Descarrego) — parcial
  - efeito não simulado: 5 % mais dano por lâmina de Vórtice de Lâminas
  - efeito não simulado: 100 % mais Área de Efeito por lâmina do Vórtice de Lâminas detonada
  - efeito não simulado: 20 % mais Área de Efeito por lâmina do Vórtice de Lâminas detonada
- **Blade_Flurry** (Rajada de Lâminas) — parcial
  - efeito não simulado: Mais 20 % de dano quando em estágios máximos
- **Blade_Flurry_of_Incision** (Rajada de Lâminas da Incisão) — parcial
  - efeito não simulado: +40 % ao multiplicador de golpe crítico quando em estágios máximos
- **Blade_Trap** (Armadilha de Lâminas) — parcial
  - efeito não simulado: Gira 4 vezes
  - efeito não simulado: Velocidade de rotação aumentada em 25 % se em Empunhadura Dupla
  - efeito não simulado: Gira +1 vezes se em Empunhadura Dupla
  - efeito não simulado: Armadilha dura +1 segundo Gira
  - efeito não simulado: +1 vez
- **Blade_Trap_of_Laceration** (Armadilha de Lâminas da Laceração) — parcial
  - efeito não simulado: Gira 1 vez
  - efeito não simulado: Sangramentos inflingidos por esta Habilidade causam Dano 50 % mais rápido
  - efeito não simulado: Sangramentos inflingidos por esta Habilidade causam Dano 10 % mais rápido
- **Blade_Vortex** (Vórtice de Lâminas) — parcial
  - efeito não simulado: Taxa de Acerto aumentada em 30 % por cada lâmina
  - efeito não simulado: 30 % mais dano por lâmina
  - efeito não simulado: Pode ter até 10 lâminas giratórias ativas
  - efeito não simulado: Taxa de Acerto aumentada em +5 % por cada lâmina
- **Blade_Vortex_of_the_Scythe** (Vórtice de Lâminas da Foice) — parcial
  - efeito não simulado: Pode ter até 1 lâminas giratórias ativas
- **Bladefall** (Chuva de Lâminas) — parcial
  - as repetições do golpe não existem: no jogo é um
  - efeito não simulado: Deixa uma Lâmina Persistente no solo para cada 1 Saraivadas
  - efeito não simulado: +1 Rajada
- **Bladefall_of_Impaling** (Chuva de Lâminas do Empalamento) — parcial
  - as repetições do golpe não existem: no jogo é um
  - efeito não simulado: Golpes Críticos não causam Dano extra
  - efeito não simulado: Golpe Críticos infligem Empalamento
- **Bladefall_of_Trarthus** (Corrente com Gancho de Trarthus) — parcial
  - efeito não simulado: Uma rajada de lâminas cai a cada 0.7 segundos
  - efeito não simulado: 2 % maior frequência de rajadas por 100 de mana máximo
  - efeito não simulado: O raio base da Saraivada é de 2.5 metros
  - efeito não simulado: Raio base da lâmina é de 1 metro
  - efeito não simulado: Cada rajada dispara 5 lâminas, que permanecem no chão
- **Bladefall_of_Volleys** (Chuva de Lâminas da Rajada) — parcial
  - as repetições do golpe não existem: no jogo é um
  - efeito não simulado: 10 % mais Dano por Rajada
  - efeito não simulado: 25 % de aumento da Chance de Acerto Crítico por Rajada
  - efeito não simulado: +1 Rajada
- **Bladestorm** (Tempestade de Lâminas) — parcial
  - efeito não simulado: 108 % mais Dano com Sangramento enquanto na Postura de Sangue
  - efeito não simulado: 12 % mais Velocidade de Ataque enquanto estiver em uma Tempestade de Lâminas Sangrentas
  - efeito não simulado: Tempestades de Lâminas causam 50 % menos Dano com Acertos e Afecções
  - efeito não simulado: +1 ao número Máximo de Tempestades de Lâminas por vez
- **Bladestorm_of_Uncertainty** (Tempestade de Lâminas da Incerteza) — parcial
  - efeito não simulado: 12 % mais Velocidade de Ataque enquanto estiver em uma Tempestade de Lâminas Sangrentas
  - efeito não simulado: Tempestades de Lâminas causam 50 % menos Dano com Acertos e Afecções
  - efeito não simulado: +1 ao número Máximo de Tempestades de Lâminas por vez
- **Blast_Rain** (Chuva Explosiva) — parcial
  - efeito não simulado: Penetra 30 % da Resistência a Fogo
- **Blast_Rain_of_Trarthus** (Chuva Explosiva de Trarthus) — parcial
  - efeito não simulado: Dispara 1 Flecha
- **Blight** (Infestação) — parcial
  - efeito não simulado: Velocidade de Movimento reduzida em 80 %
  - efeito não simulado: Debuff pode ter até 20 camadas de Dano
- **Blight_of_Atrophy** (Infestação da Atrofia) — parcial
  - efeito não simulado: Velocidade de Movimento reduzida em 80 %
  - efeito não simulado: Debuff pode ter até 20 camadas de Dano
  - efeito não simulado: Regeneração de Vida reduzida em 80 %
- **Blight_of_Contagion** (Infestação do Contágio) — parcial
  - efeito não simulado: Velocidade de Movimento reduzida em 80 %
  - efeito não simulado: Debuff pode ter até 6 camadas de Dano
- **Blink_Arrow** (Flecha Ilusória) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Blink_Arrow_of_Bombarding_Clones** (Flecha Ilusória dos Clones Bombardeiros) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Blink_Arrow_of_Prismatic_Clones** (Flecha Ilusória dos Clones Prismáticos) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Blood_and_Sand** (Sangue e Areia) — parcial
  - efeito não simulado: Habilidades Corpo a Corpo causam 27 % mais Dano em Área enquanto na Postura de Sangue
  - efeito não simulado: Habilidades Corpo a Corpo têm 5 % menos Efeito em Área enquanto na Postura de Sangue
- **Blood_Rage** (Fúria Sangrenta) — sem efeito
  - a gema não tem comportamento de combate reconhecido
- **Bodyswap** (Troca de Corpos) — parcial
  - o uso de cadáveres não existe no jogo
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: Esta Magia causa 210 a 315 , mais 6 % da sua Vida Máxima, como Dano de Fogo base
  - efeito não simulado: 300 % mais Área de Efeito se Consumiu um cadáver
  - efeito não simulado: Causa +6 % da sua Vida Máxima como Dano de Fogo base
- **Bodyswap_of_Sacrifice** (Troca de Corpos do Sacrifício) — parcial
  - efeito não simulado: Esta Magia causa 210 a 315 , mais 4 % da sua Vida Máxima, como Dano de Fogo base
  - efeito não simulado: Explosões causam Dano de Fogo base igual a 29 % da Vida máxima do Lacaio
  - efeito não simulado: 300 % mais Área de Efeito se Consumindo um Lacaio
  - efeito não simulado: Explosões causam Dano de Fogo base igual a 5 % da Vida máxima do Lacaio
  - efeito não simulado: 50 % menos Dano de Afecções
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Bone_Offering** (Oferenda Óssea) — parcial
  - efeito não simulado: 1 segundos adicionais de Duração Base por Cadáver extra consumido
  - efeito não simulado: Concede aos Lacaios +34 % de Chance de Bloquear Dano Mágico
  - efeito não simulado: Efeito da Oferenda aumentado em 10 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Boneshatter** (Esmaga-ossos) — parcial
  - efeito não simulado: Ganha 6 Traumatismo a primeira vez que este Ataque Acertar um Inimigo Sofre 194 de Dano Físico por Traumatismo quando você ganhar Traumatistmo Traumatismo dura 6 segundos
  - efeito não simulado: 6 % mais Dano por Traumatismo
  - efeito não simulado: Pulso tem Efeito em Área aumentado em 15 % por cada 0.1s de Duração do Atordoamento, máximo de 400 %
  - efeito não simulado: +1 % mais Dano por Traumatismo
- **Boneshatter_of_Carnage** (Quebra-Ossos da Carnificina) — parcial
  - efeito não simulado: Pulso tem Efeito em Área aumentado em 20 % por cada 0.1s de Duração do Atordoamento, máximo de 400 %
  - efeito não simulado: Mais 20 % de dano contra inimigos atordoados
- **Boneshatter_of_Complex_Trauma** (Quebra-Ossos do Traumatismo Complexo) — parcial
  - efeito não simulado: Perca todo o Traumatismo ao atingir 10 Traumatismos
  - efeito não simulado: Ganha 6 Traumatismo a primeira vez que este Ataque Acertar um Inimigo Sofre 582 de Dano Físico por Traumatismo quando você ganhar Traumatistmo Traumatismo dura 6 segundos
  - efeito não simulado: 15 % mais Dano por Trauma, até 200 %
  - efeito não simulado: Pulso tem Efeito em Área aumentado em 15 % por cada 0.1s de Duração do Atordoamento, máximo de 400 %
  - efeito não simulado: 5 % mais Dano por Trauma, até 200 %
- **Burning_Arrow_of_Vigour** (Flecha Ardente do Vigor) — parcial
  - efeito não simulado: Causa Dano de Fogo Adicional igual a 32 % da Vida Máxima
- **Chain_Hook** (Corrente com Gancho) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - efeito não simulado: +0.1 metro ao Raio por 5 de Fúria
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Chain_Hook_of_Angling** (Corrente de Anzol para Pesca) — parcial
  - efeito não simulado: Lança uma corrente em até 7 inimigos
  - efeito não simulado: Alcance aumentado em 40 %
- **Chain_Hook_of_Trarthus** (Corrente com Gancho de Trarthus) — parcial
  - efeito não simulado: Lança correntes em até 8 alvos ao alcance
  - efeito não simulado: Alvos acorrentados concedem 1 Fúria quando atingidos
  - efeito não simulado: Comprimento máximo da corrente: 6 metros
  - efeito não simulado: +0.1 metro ao Raio por 5 de Fúria
  - efeito não simulado: Lança correntes em até 3 alvos ao alcance
- **Charged_Dash** (Avanço Fantasma) — parcial
  - efeito não simulado: Causa + 150 % de dano com ataques ao canalizar, se a Ilusão terminou seu movimento
  - efeito não simulado: Acertos da onda final causam 75 % de dano por estágio
  - efeito não simulado: A Ilusão se move com 130 % da sua Velocidade de Movimento
  - efeito não simulado: A Ilusão se move com um adicional de +20 % da sua Velocidade de Movimento
- **Charged_Dash_of_Projection** (Impulso Energizado da Projeção) — parcial
  - efeito não simulado: Causa + 150 % de dano com ataques ao canalizar, se a Ilusão terminou seu movimento
  - efeito não simulado: Acertos da onda final causam 125 % de dano por estágio
  - efeito não simulado: A Ilusão se move com 150 % da sua Velocidade de Movimento
  - efeito não simulado: Acertos da Onda final causa 20 % de Dano por estágio
- **Cleave** (Cutilada) — parcial
  - efeito não simulado: +0.1 metros de raio por inimigo próximo, até +1 metro
- **Cleave_of_Rage** (Cutilada da Fúria) — parcial
  - efeito não simulado: +0.1 metro ao Raio por 5 de Fúria
- **Cold_Snap** (Estalo Gélido) — parcial
  - efeito não simulado: Raio inicial base de chão congelado é de 1.5 metros
  - efeito não simulado: Raio Base final do Solo Resfriado igual a 3 metros
  - efeito não simulado: 25 % de chance de ganhar uma Carga de Frenesi quando um Inimigo Morrer enquanto na Área dessa Habilidade
  - efeito não simulado: 20 % mais Efeito de Resfriamento
- **Cold_Snap_of_Power** (Estalo Gélido do Poder) — parcial
  - efeito não simulado: 50 % de chance de ganhar uma Carga de Poder em Acertos Críticos
  - efeito não simulado: 20 % de chance de ganhar uma Carga de Poder em Acertos Críticos
- **Conflagration** (Conflagração) — parcial
  - efeito não simulado: As flechas após a primeira caem em um raio base de 6 metros
  - efeito não simulado: Raio de alcance base do impacto é de 7 metro
  - efeito não simulado: Explosão causa + 50 % de dano com ataques e afecções
  - efeito não simulado: Duração da penalidade base é de 4 segundos
  - efeito não simulado: Explosão causa + 30 % de dano com ataques e afecções
- **Consecrated_Path** (Caminho Sagrado) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Consecrated_Path_of_Endurance** (Caminho Sagrado da Tolerância) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Contagion** (Contagiar) — parcial
  - efeito não simulado: Espalha quando o Inimigo afetado morrer
- **Contagion_of_Subsiding** (Contágio da Subsidência) — parcial
  - efeito não simulado: Espalha quando o Inimigo afetado morrer
- **Contagion_of_Transference** (Contágio da Transferência) — parcial
  - efeito não simulado: Espalha quando o Inimigo afetado for Acertado
- **Conversion_Trap** (Armadilha Conversora) — parcial
  - sem dano direto: nenhum efeito no combate
- **Convocation** (Convocação) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Corrupting_Fever** (Febre Corrompedora) — parcial
  - efeito não simulado: Duração do Buff é atualizada após você gastar um total de 205 de Vida
  - efeito não simulado: Duração da penalidade base é de 1.5 segundos
- **Crackling_Lance** (Lança Crepitante) — parcial
  - efeito não simulado: Esta Magia perde 1 de Intensidade a cada 0.5 segundos enquanto se movendo, ou imediatamente ao teleportar
  - efeito não simulado: Esta Magia ganha Intensidade quando você Conjurá-la, máximo de 3
  - efeito não simulado: +0.3 metros à Largura do Feixe Por Intensidade 33 % menos ângulo de ramificação por Intensidade
  - efeito não simulado: 35 % mais Dano com Acertos e Afecções por Intensidade
  - efeito não simulado: +10 % mais Dano com Acertos e Afecções por Intensidade
- **Crackling_Lance_of_Branching** (Lança Crepitante da Ramificação) — parcial
  - efeito não simulado: Ângulo da ramificação aumentado em 50 %
- **Crackling_Lance_of_Disintegration** (Lança Crepitante da Desintegração) — parcial
  - efeito não simulado: +10 % ao Máximo de Efeito da Eletrização
  - efeito não simulado: +10 % ao Máximo de Efeito da Eletrização
- **Creeping_Frost** (Geada Rastejante) — parcial
  - efeito não simulado: Pode ter até 10 Áreas Resfriadas
- **Creeping_Frost_of_Floes** (Geada Gradativa das Banquisas) — parcial
  - efeito não simulado: Pode ter até 5 Áreas Resfriadas
- **Cremation** (Cremação) — parcial
  - efeito não simulado: Dispara Projéteis 15 % mais rápido
- **Cremation_of_Exhuming** (Cremação da Exumação) — parcial
  - efeito não simulado: Explode um Cadáver próximo ao Disparar Projéteis
  - efeito não simulado: Dispara Projéteis 15 % mais rápido
- **Cremation_of_the_Volcano** (Cremação do Vulcão) — parcial
  - efeito não simulado: Dispara Projéteis a cada 1 segundos
  - efeito não simulado: Máximo de +2 gêiseres por vez
- **Cyclone** (Ciclone) — parcial
  - efeito não simulado: Área de Efeito aumentada em 15 % por cada 0.1 metro de Alcance de Golpe Corpo a Corpo adicional
  - efeito não simulado: 20 % menos Velocidade de Movimento
  - efeito não simulado: Área de Efeito aumentada em 5 % por cada 0.1 metro de Alcance de Golpe Corpo a Corpo adicional
- **Cyclone_of_Tumult** (Ciclone do Tumulto) — parcial
  - efeito não simulado: Área de Efeito aumentada em 15 % por cada 0.1 metro de Alcance de Golpe Corpo a Corpo adicional
  - efeito não simulado: 10 % menos Velocidade de Movimento por Estágio
- **Dark_Bargain** (Barganha Sombria) — parcial
  - efeito não simulado: Sacrifica 12 % da Vida do Esqueleto para causar a mesma quantidade de Dano de Caos
  - efeito não simulado: Usa sua Vida se não houver Esqueletos em alcance
  - efeito não simulado: 136 % mais Dano com Acertos e Afecções se usar sua Vida
  - efeito não simulado: Sacrifica +2 % da Vida do Esqueleto para causar a mesma quantidade de Dano de Caos
- **Dark_Bargain_of_Trarthus** (Barganha Sombria de Trarthus) — parcial
  - efeito não simulado: Ganha uma Ruína por uso Ao chegar a sete, sacrifica 50 % da sua vida e causa 600 % da vida sacrificada como dano de caos
  - efeito não simulado: 20 % de chance de ganhar uma Ruína adicional ao usar
- **Dash** (Avanço) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: Distância de Deslocamento aumentada em 57 %
  - efeito não simulado: Distância de Deslocamento aumentada em %
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Decoy_Totem** (Totem Chamariz) — parcial
  - efeito não simulado: o totem provoca os monstros em volta a atacá-lo (act_str.lua:2416-2432)
- **Defiance_Banner** (Estandarte Desafiador) — parcial
  - efeito não simulado: Estandarte concede -12 de Dano sofrido de cada Tipo de Dano dos Acertos Suprimidos a Você e Aliados
- **Despair** (Desespero) — parcial
  - efeito não simulado: Efeito de Maldições aumentado em 10 %
- **Detonate_Dead** (Detonar Morto) — parcial
  - efeito não simulado: 15 % de chance de detonar um cadáver adicional
- **Detonate_Dead_of_Scavenging** (Detonar Morto da Limpeza) — parcial
  - sem dano direto: nenhum efeito no combate
- **Detonate_Mines** (Detonar Minas) — parcial
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: Primeira Mina é Detonada Instantaneamente Minas recebem 10 % mais Velocidade de Detonação para cada Mina anteior na Sequência de Detonação
  - efeito não simulado: Minas tem Velocidade de Detonação aumentada em 20 %
- **Discharge** (Descarga) — parcial
  - efeito não simulado: 15 % mais Área de Efeito por Carga removida
  - efeito não simulado: 10 % de chance de causar Dano sem remover Cargas
- **Discharge_of_Misery** (Descarga da Miséria) — parcial
  - efeito não simulado: 20 % mais Área de Efeito por Carga removida
  - efeito não simulado: 10 % de chance de causar Dano sem remover Cargas
- **Discipline** (Disciplina) — parcial
  - efeito não simulado: Você e Aliados próximos ganham 30 % de Velocidade de Recarga de Escudo de Energia aumentada
- **Divine_Blast** (Rajada Divina) — parcial
  - efeito não simulado: Explosão causa 100 % mais Dano com Acertos e Afecções
- **Divine_Blast_of_Radiance** (Rajada Divina do Esplendor) — parcial
  - efeito não simulado: Taxa base de explosão do orbe é de uma vez por segundo
- **Divine_Ire** (Ira Divina) — parcial
  - efeito não simulado: Causa Dano em 5 Inimigos próximos quando você ganha Estágios
  - efeito não simulado: Feixe causa 250 % mais Dano com Acertos por Estágio após o primeiro Feixe causa 250 % mais Dano com Afecções por Estágio após o primeiro
  - efeito não simulado: Comprimento do raio aumentado em 20 %
- **Divine_Ire_of_Disintegration** (Ira Divina da Desintegração) — parcial
  - efeito não simulado: Comprimento do raio aumentado em 19 %
  - efeito não simulado: Feixe causa 200 % mais Dano com Acertos por Estágio após o primeiro Feixe causa 200 % mais Dano com Afecções por Estágio após o primeiro
  - efeito não simulado: Comprimento do raio aumentado em 20 %
- **Divine_Ire_of_Holy_Lightning** (Ira Divina do Relâmpago Sagrado) — parcial
  - efeito não simulado: Causa Dano em 10 Inimigos próximos quando você ganha Estágios
  - efeito não simulado: Feixe causa 140 % mais Dano com Acertos por Estágio após o primeiro Feixe causa 140 % mais Dano com Afecções por Estágio após o primeiro
  - efeito não simulado: Causa Dano em 4 Inimigos próximos quando você ganha Estágios
- **Divine_Retribution** (Retribuição Divina) — parcial
  - efeito não simulado: Cada onda tem 6 Explosões
  - efeito não simulado: Causa 4 Ondas
- **Dominating_Blow** (Golpe Dominador) — parcial
  - efeito não simulado: 25 % de chance de invocar uma Sentinela da Dominação normal ao atingir um monstro raro ou único
  - efeito não simulado: Lacaios têm Recuperação da Recarga aumentada em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Dominating_Blow_of_Inspiring** (Golpe Dominador da Inspiração) — parcial
  - efeito não simulado: 25 % de chance de invocar uma Sentinela da Dominação normal ao atingir um monstro raro ou único
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Double_Strike_of_Impaling** (Golpe Duplo do Empalamento) — parcial
  - efeito não simulado: Golpes Finais fazem com que os Empalamentos em Inimigos Reflitam o Dano aos Inimigos ao redor
- **Double_Strike_of_Momentum** (Golpe Duplo do Impulso) — parcial
  - efeito não simulado: 10 % mais Velocidade de Ataque por cada Estágio
  - efeito não simulado: Ganhe um Estágio no início de cada ataque par Máximo de 10 Estágios
  - efeito não simulado: 4 % mais Velocidade de Ataque por cada Estágio
- **Dread_Banner** (Estandarte Horrendo) — parcial
  - efeito não simulado: Estandarte faz com que você e Aliados Recuperem 34 de Vida ao Bloquear
- **Dual_Strike_of_Ambidexterity** (Golpe Duplo da Ambidestria) — parcial
  - efeito não simulado: Utiliza o Tempo de Ataque da Arma Secundária
- **Earthquake** (Terremoto) — parcial
  - efeito não simulado: Abalo Secundário causa 150 % mais Dano com Acertos e Afecções
  - efeito não simulado: Abalo Secundário causa +30 % mais Dano com Acertos e Afecções
- **Earthquake_of_Amplification** (Terremoto da Amplificação) — parcial
  - efeito não simulado: Abalo Secundário causa 15 % mais Dano com Acertos por cada 0.1 segundos de Duração
  - efeito não simulado: Abalo Secundário causa 5 % mais Dano com Afecções por cada 0.1 segundos de Duração
  - efeito não simulado: Abalo Secundário tem 2 % mais Área de Efeito por cada 0.1 segundos de Duração
- **Earthshatter** (Destroçador) — parcial
  - as repetições do golpe não existem: no jogo é um
  - efeito não simulado: Estacas Despedaçadoras causam 30 % mais dano
  - efeito não simulado: Máximo de +3 Estacas Cria
  - efeito não simulado: +1 fissura
- **Earthshatter_of_Fragility** (Destroçador da Fragilidade) — parcial
  - as repetições do golpe não existem: no jogo é um
  - efeito não simulado: Estacas Despedaçadoras causam 30 % mais dano
  - efeito não simulado: Máximo de +3 Estacas Cria
  - efeito não simulado: +1 fissura
- **Earthshatter_of_Prominence** (Destroçador da Proeminência) — parcial
  - efeito não simulado: Estacas Despedaçadas têm 157 % mais Área de Efeito
  - efeito não simulado: Estacas Despedaçadoras causam 100 % mais dano
  - efeito não simulado: Cria 1 fissura
  - efeito não simulado: Estacas Despedaçadoras causam +20 % mais dano
- **Elemental_Hit** (Acerto Elemental) — parcial
  - efeito não simulado: 80 % mais Raio de Área contra Inimigos afetados por uma Afecção do Elemento escolhido
- **Energy_Blade** (Lâmina de Energia) — sem efeito
  - a gema não tem comportamento de combate reconhecido
- **Enfeeble** (Debilitar) — parcial
  - efeito não simulado: Inimigos Amaldiçoados possuem uma redução de 19 % de Precisão
  - efeito não simulado: Duração de Maldições aumentada em 20 %
- **Ensnaring_Arrow** (Flecha Aprisionadora) — parcial
  - efeito não simulado: Inimigos Aprisionados sofrem Dano de Projétil dos Acertos de Ataques aumentado em 20 %
  - efeito não simulado: Cada Aprisionamento aplica 40 % menos Velocidade de Movimento aos Inimigos Normais ou Mágicos
  - efeito não simulado: Cada Aprisionamento aplica 30 % menos Velocidade de Movimento aos Inimigos Raros
  - efeito não simulado: Cada Aprisionamento aplica 25 % menos Velocidade de Movimento aos Inimigos Únicos
  - efeito não simulado: Efeito do Debuff aumentado em 20 %
- **Essence_Drain** (Drenar Essência) — parcial
  - efeito não simulado: Regenera 0.5 % do Dano do Debuff como Vida
  - efeito não simulado: Regenera +0.5 % do Dano do Debuff como Vida
- **Essence_Drain_of_Desperation** (Dreno de Essência do Desespero) — parcial
  - efeito não simulado: Perca Vida e Escudo de Energia igual a 0.3 % do Dano do Debuff
- **Essence_Drain_of_Wickedness** (Dreno de Essência da Maldade) — parcial
  - efeito não simulado: Regenera 1 % do Dano do Debuff como Vida
  - efeito não simulado: Regenera +0.5 % do Dano do Debuff como Vida
- **Ethereal_Knives** (Facas Etéreas) — parcial
  - efeito não simulado: 20 % mais Velocidade de Projétil
- **Ethereal_Knives_of_Lingering_Blades** (Facas Etéreas das Lâminas Persistentes) — parcial
  - efeito não simulado: Um a cada 1 Projéteis disparados permanece no solo como Lâmina Persistente
- **Eviscerate** (Eviscerar) — parcial
  - efeito não simulado: Extensão da onda é de 10 metros
  - efeito não simulado: Circunferência base da onda é de 5 metros
- **Explosive_Arrow** (Flecha Explosiva) — parcial
  - efeito não simulado: Explosão causa 50 % menos Dano Base
  - efeito não simulado: Explosões terão 522 a 783 de Dano de Fogo adicional
  - efeito não simulado: +0.2 metros ao Raio da Explosão por Flecha Explosiva no Alvo, máximo de +1.2 metros
  - efeito não simulado: Explosão causa 6 % mais Dano com Acertos por Flecha Explosiva no Alvo
  - efeito não simulado: Explosão causa 3 % mais Dano com Afecções por Flecha Explosiva no Alvo
  - efeito não simulado: Máximo de +2 Flechas Explosivas grudadas em cada Inimigo
- **Explosive_Concoction** (Composto Explosivo) — parcial
  - efeito não simulado: Pode consumir Cargas de um Frasco de Rubi, Safira e Topázio Consome 1 Carga de 1 Frasco de cada tipo válido, se possível, por Projétil Disparado
  - efeito não simulado: Causa 706 a 1058 de Dano de Gelo Adicional se Cargas de um Frasco de Safira foram consumidas
  - efeito não simulado: Causa 151 a 1764 de Dano de Raio Adicional se Cargas de um Frasco de Topázio foram consumidas
  - efeito não simulado: +196 % de Multiplicador de Dano Degenerativo com Incêndios se Cargas de um Frasco de Rubi foram consumidas
  - efeito não simulado: Cargas de Frasco usadas reduzidas em 15 %
- **Explosive_Concoction_of_Destruction** (Composto Explosivo da Destruição) — parcial
  - efeito não simulado: Pode consumir Cargas de um Frasco de Rubi, Safira e Topázio Consome 1 Carga de 1 Frasco de cada tipo válido, se possível, por Projétil Disparado
  - efeito não simulado: Causa 625 a 937 de Dano de Gelo Adicional se Cargas de um Frasco de Safira foram consumidas
  - efeito não simulado: Causa 134 a 1562 de Dano de Raio Adicional se Cargas de um Frasco de Topázio foram consumidas
  - efeito não simulado: +196 % de Multiplicador de Golpe Crítico se Cargas foram consumidas de um Frasco de Rubi
  - efeito não simulado: Cargas de Frasco usadas reduzidas em 15 %
- **Explosive_Trap** (Armadilha Explosiva) — parcial
  - efeito não simulado: Raio Base da explosão menor igual a 3 metros
  - efeito não simulado: Causa 7 explosões menores Explosões menores têm entre 1 % de redução e 30 % de aumento do raio base, aleatoriamente
  - efeito não simulado: Causa +2 explosões menores
- **Explosive_Trap_of_Magnitude** (Armadilha Explosiva da Magnitude) — parcial
  - efeito não simulado: 30 % menos Velocidade de Arremesso de Armadilhas
- **Explosive_Trap_of_Shrapnel** (Armadilha Explosiva dos Estilhaços) — parcial
  - efeito não simulado: Raio Base da explosão menor igual a 3 metros
  - efeito não simulado: Causa 7 explosões menores Explosões menores têm entre 1 % de redução e 30 % de aumento do raio base, aleatoriamente
  - efeito não simulado: Causa +2 explosões menores
- **Exsanguinate** (Ensanguentar) — parcial
  - efeito não simulado: Dispara tentáculos em até 9 Alvos
- **Exsanguinate_of_Transmission** (Ensanguentar da Transmissão) — parcial
  - efeito não simulado: Dispara tentáculos em até 1 Alvo
- **Eye_of_Winter** (Olho Invernal) — parcial
  - efeito não simulado: Dispara 8 Fragmentos de Projéteis em uma Espiral quando o Projétil terminar
  - efeito não simulado: Projéteis ganham Dano continuamente, até 200 % mais Dano até se dissiparem
  - efeito não simulado: Dispara +2 Fragmentos de Projéteis em uma Espiral quando o Projétil terminar
- **Eye_of_Winter_of_Finality** (Olho Invernal da Finalidade) — parcial
  - efeito não simulado: Dispara 16 Fragmentos de Projéteis em uma Espiral quando o Projétil terminar
  - efeito não simulado: Projéteis ganham Dano continuamente, até 100 % mais Dano até se dissiparem
  - efeito não simulado: Projéteis ganham até +20 % mais Dano até se dissiparem
- **Eye_of_Winter_of_Transience** (Olho Invernal da Transitoriedade) — parcial
  - efeito não simulado: Dispara 12 Fragmentos de Projéteis em uma Espiral enquanto vôa, e então termina
  - efeito não simulado: 50 % mais Velocidade de Projétil
  - efeito não simulado: Projéteis ganham até +15 % mais Dano até se dissiparem
- **Fire_Trap** (Armadilha Flamejante) — parcial
  - efeito não simulado: 286 a 429 de Dano de Fogo adicionado contra Inimigos Queimando
- **Fire_Trap_of_Blasting** (Armadilha Flamejante da Explosão) — parcial
  - efeito não simulado: 50 % de Chance de uma Armadilha ser Ativada uma vez adicional
  - efeito não simulado: 881 a 1316 de Dano de Fogo adicionado contra Inimigos Queimando
- **Firestorm** (Tormenta Flamejante) — parcial
  - efeito não simulado: Um impacto a cada 0.15 segundos
  - efeito não simulado: Primeiro Impacto tem 100 % mais efeito em área
  - efeito não simulado: Primeiro Impacto causa 325 % mais Dano com Acertos e Afecções
- **Firestorm_of_Pelting** (Tormenta Flamejante do Disparo) — parcial
  - efeito não simulado: Um impacto a cada 0.15 segundos
- **Flame_Dash** (Avanço Ardente) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Flame_Dash_of_Return** (Avanço Ardente do Retorno) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - efeito não simulado: Repete 1 vezes
  - efeito não simulado: Inverte a direção ao Repetir
  - efeito não simulado: Distância de Deslocamento máxima aumentada em 19 %
  - efeito não simulado: Distância de Deslocamento máxima aumentada em %
  - efeito não simulado: 20 % de chance de Causticar Inimigos
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Flame_Surge** (Chicote Ardente) — parcial
  - efeito não simulado: 88 % mais Dano com Acertos contra Inimigos Incendiados
  - efeito não simulado: Não pode Incendiar
  - efeito não simulado: 9 de largura do Efeito em Área
  - efeito não simulado: Acertos em Inimigos Incendiados criam Solo Ardente, não mais que uma vez a cada 2 segundos
  - efeito não simulado: Solo Ardente causa 30 % de Dano de Fogo por segundo de Incêndio afetando o Inimigo
  - efeito não simulado: +20 % mais Dano com Acertos contra Inimigos Incendiados
- **Flame_Surge_of_Combusting** (Chicote Ardente da Combustão) — parcial
  - efeito não simulado: 9 de largura do Efeito em Área
  - efeito não simulado: Incendiar Inimigos cria Solo Ardente, não mais que uma vez por segundo Solo Ardente causa 50 % do Dano de Fogo por segundo do Incêndio infligido
  - efeito não simulado: Solo ardente causa +15 % do Dano de Fogo por segundo do Incêndio infligido
- **Flame_Wall** (Parede Flamejante) — parcial
  - efeito não simulado: Parede terá 5.9 metros
  - efeito não simulado: Projéteis que passam pela parede causam 78 a 117 de Dano de Fogo Adicional
  - efeito não simulado: Máximo de +2 Paredes Flamejantes por vez
- **Flamethrower_Trap** (Armadilha Lança-Chamas) — parcial
  - efeito não simulado: Tem 4 chamas
- **Flamethrower_Trap_of_Stability** (Armadilha Lança-chamas da Estabilidade) — parcial
  - efeito não simulado: Tem 5 chamas
  - efeito não simulado: Possui 1 Chamas
- **Flesh_and_Stone** (Carne e Pedra) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Enquanto na Postura de Sangue, Aura faz com que os Inimigos sofram até 20 % mais Dano Físico dos Acertos
  - efeito não simulado: Enquanto na Postura da Areia, Buff faz com que você sofra até 19 % menos Dano dos Inimigos na Aura
- **Flesh_Offering** (Oferenda Carnal) — parcial
  - efeito não simulado: 1 segundos adicionais de Duração Base por Cadáver extra consumido
  - efeito não simulado: Aumenta a Velocidade de Conjuração dos Lacaios em 30 %
  - efeito não simulado: Aumenta a Velocidade de Movimento dos Lacaios em 29 %
  - efeito não simulado: Efeito da Oferenda aumentado em 10 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Flicker_Strike** (Golpe Súbito) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - efeito não simulado: Velocidade de Ataque aumentada em 10 % por Carga de Frenesi
  - efeito não simulado: 15 % de chance de receber uma Carga de Frenesi ao Acertar
  - efeito não simulado: 10 % de chance de receber uma Carga de Frenesi ao Acertar
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Flicker_Strike_of_Power** (Golpe Súbito do Poder) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - efeito não simulado: 30 % de chance de ganhar uma Carga de Poder em Acertos Críticos
  - efeito não simulado: Chance de Crítico aumentada em 50 % por Carga de Poder
  - efeito não simulado: 20 % de chance de ganhar uma Carga de Poder em Acertos Críticos
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Forbidden_Rite** (Ritual Proibido) — parcial
  - efeito não simulado: Causa 5 % do seu máximo de Escudo de Energia como Dano de Caos base
  - efeito não simulado: Causa 14 % do seu máximo de Vida como Dano de Caos base
  - efeito não simulado: Sofre 40 % da Vida Máxima e 25 % do Escudo de Energia Máximo como Dano de Caos
  - efeito não simulado: Dispara Projéteis extras em até 7 Inimigos ao redor
  - efeito não simulado: Dispara Projéteis extras em até +2 Inimigos ao redor
- **Forbidden_Rite_of_Soul_Sacrifice** (Ritual Proibido do Sacrifício D'alma) — parcial
  - efeito não simulado: Causa 20 % do seu máximo de Escudo de Energia como Dano de Caos base
  - efeito não simulado: Sofre 50 % do Escudo de Energia Máximo como Dano de Caos
  - efeito não simulado: Dispara Projéteis extras em até 7 Inimigos ao redor
  - efeito não simulado: Dispara Projéteis extras em até +2 Inimigos ao redor
- **Freezing_Pulse** (Pulso Congelante) — parcial
  - efeito não simulado: Dispara 5 projétil
  - efeito não simulado: Velocidade de Projéteis aumentada em 40 %
- **Frenzy_of_Onslaught** (Frenesi da Agressividade) — parcial
  - efeito não simulado: Consome todas as Carga de Frenesi quando você Acertar um inimigo enquanto no máximo de Cargas de Frenesi para ganhar Agressividade por 1 segundo por Carga consumida
- **Frost_Blades** (Lâminas Gélidas) — parcial
  - efeito não simulado: +2.1 metros ao Alcance de Golpes Corpo a Corpo
- **Frost_Blades_of_Katabasis** (Lâminas Gélidas da Catábase) — parcial
  - efeito não simulado: +5 metros ao Alcance de Golpes Corpo a Corpo
  - efeito não simulado: +1 metro ao Alcance de Golpes Corpo a Corpo
- **Frost_Bomb** (Bomba Congelante) — parcial
  - efeito não simulado: Regeneração de Vida reduzida em 75 %
  - efeito não simulado: Exposição a Gelo aplica -15 % de Resistência a Gelo
- **Frost_Bomb_of_Forthcoming** (Bomba Congelante da Aproximação) — parcial
  - efeito não simulado: Causa 10 % mais Dano com Acertos por cada 0.1 segundos de Duração
  - efeito não simulado: Causa 3 % mais Dano com Afecções por cada 0.1 segundos de Duração
- **Frost_Shield** (Escudo Gélido) — sem efeito
  - a gema não tem comportamento de combate reconhecido
- **Frost_Wall** (Parede de Gelo) — parcial
  - efeito não simulado: 0.15 segundos entre o aparecimento de seções da Parede
  - efeito não simulado: Parede terá 5.6 metros
- **Frost_Wall_of_Encroachment** (Parede de Gelo da Invasão) — parcial
  - efeito não simulado: 0.15 segundos entre o aparecimento de seções da Parede
  - efeito não simulado: Parede terá 4.6 metros
  - efeito não simulado: [DNT] Deals 10 % more Damage per active wall
- **Frostblink** (Teleporte Gélido) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - efeito não simulado: Velocidade de Recuperação da Recarga aumentada em 19 % para cada Inimigo Normal ou Mágico na Área Velocidade de Recuperação da Recarga aumentada em 99 % para cada Inimigo Raro ou Único na Área
  - efeito não simulado: Distância de Deslocamento máxima aumentada em 38 %
  - efeito não simulado: CooldownTime
  - efeito não simulado: Distância de Deslocamento máxima aumentada em %
  - efeito não simulado: Distância de Deslocamento máxima aumentada em 10 %
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Frostblink_of_Wintry_Blast** (Teleporte Gélido da Explosão Invernal) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - efeito não simulado: Tempo de Conjuração desta Magia é adicionado à sua Recarga se Ativada
  - efeito não simulado: Não pode infligir Resfriamento
  - efeito não simulado: 15 % mais Dano com Acertos por cada 5 % de Efeito do Resfriamento no Inimigo
  - efeito não simulado: Remove Resfriamentos após Causar Dano
  - efeito não simulado: 4 % mais Dano com Acertos por cada 5 % de Efeito do Resfriamento no Inimigo
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Frostbolt** (Disparo Congelante) — parcial
  - efeito não simulado: Projéteis que Atravessaram causam 20 % mais Dano
- **Galvanic_Arrow** (Flecha Galvânica) — parcial
  - efeito não simulado: Velocidade de Projéteis aumentada em 40 %
- **Galvanic_Arrow_of_Surging** (Flecha Galvânica do Surto) — parcial
  - efeito não simulado: Velocidade de Projéteis aumentada em 40 %
- **Galvanic_Field** (Campo Galvânico) — parcial
  - efeito não simulado: Dispara um feixe a cada 0.1 segundos
  - efeito não simulado: Pode focar em cada inimigo apenas uma vez a cada 0.4 segundos
  - efeito não simulado: Campo ganha 15 % mais Dano com Ataques por cada 5 % de Efeito de Eletrização no Inimigo quando criado
  - efeito não simulado: Campo ganha +0.1 metros ao raio por cada 10 % de Efeito de Eletrização no Inimigo quando criado
  - efeito não simulado: Buff Concede 50 % de chance de Eletrizar inimigos
  - efeito não simulado: Buff concede +20 % de chance de Eletrizar inimigos
- **Galvanic_Field_of_Intensity** (Campo Galvânico da Intensidade) — parcial
  - efeito não simulado: Dispara um feixe a cada 0.2 segundos
  - efeito não simulado: Pode focar em cada inimigo apenas uma vez a cada 0.55 segundos
  - efeito não simulado: Buff Concede 50 % de chance de Eletrizar inimigos
  - efeito não simulado: Buff concede +20 % de chance de Eletrizar inimigos
- **Glacial_Cascade** (Cascata Glacial) — parcial
  - efeito não simulado: Empurra Inimigos ao Acertar
  - efeito não simulado: Explosão Final Causa + 200 % mais Dano
  - efeito não simulado: Causa 4 rajadas
  - efeito não simulado: Explosão Final causa + 50 % de dano
- **Glacial_Cascade_of_the_Fissure** (Cascata Glacial da Fissura) — parcial
  - efeito não simulado: Causa 6 rajadas
  - efeito não simulado: Causa +2 rajadas
- **Ground_Slam_of_Earthshaking** (Impacto Sísmico do Tremor) — parcial
  - efeito não simulado: Ângulo aumentado em 100 %
- **Herald_of_Agony** (Arauto Agonizante) — parcial
  - a Virulência fica no máximo (40 + a qualidade + a "Virulência Máxima") enquanto o Arauto está ligado e você Envenenou com ele há até 4 s, como o PoB: o ganho por Veneno e a perda com o tempo do PoE não são simulados
  - o Rastejador ataca como um lacaio de perto do jogo (o Morteiro e o Espinho da Cauda do PoE não são simulados)
- **Herald_of_Ash** (Arauto Flamejante) — parcial
  - a queima do excesso de dano é a mesma em todos os vizinhos do morto (as condições de cada alvo não entram)
- **Herald_of_Purity** (Arauto da Pureza) — parcial
  - efeito não simulado: Convoca um Sentinela da Pureza quando você Matar um Inimigo
  - efeito não simulado: 20 % de chance de Convocar um Sentinela da Pureza ao Acertar um Inimigo Raro ou Único
  - efeito não simulado: Buff concede 12 % mais Dano Físico
  - efeito não simulado: Lacaios causam 95 % de Dano Físico
  - efeito não simulado: Lacaios têm Recuperação da Recarga aumentada em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Herald_of_Thunder** (Arauto Trovejante) — parcial
  - efeito não simulado: Tempestades Acertam Inimigos com Frequência aumentada em 20 %
- **Hexblast** (Feitiço Explosivo) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Todos os Danos podem Incendiar, Congelar e Eletrizar
  - efeito não simulado: Dano de Caos com Acertos é Resistido pela Resistência mais baixa
  - efeito não simulado: 90 % mais Dano com Afecções se o Inimigo estiver Enfeitiçado
  - efeito não simulado: 200 % mais Dano com Acertos se o Inimigo estiver Enfeitiçado
  - efeito não simulado: % de chance de remover um Feitiço após Causar Dano
  - efeito não simulado: 0 % de chance de remover um Feitiço após Causar Dano
- **Hexblast_of_Contradiction** (Feitiço Explosivo da Contradição) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Todos os Danos podem Incendiar, Congelar e Eletrizar
  - efeito não simulado: Dano de Caos com Acertos é Resistido pela maior Resistência ao invés
  - efeito não simulado: 120 % mais Dano com Afecções se o Inimigo estiver Enfeitiçado
  - efeito não simulado: 300 % mais Dano com Acertos se o Inimigo estiver Enfeitiçado
  - efeito não simulado: % de chance de remover um Feitiço após Causar Dano
  - efeito não simulado: 0 % de chance de remover um Feitiço após Causar Dano
- **Hexblast_of_Havoc** (Feitiço Explosivo da Devastação) — parcial
  - nenhum efeito do buff tem equivalente no jogo
- **Holy_Flame_Totem** (Totem Flamejante Sagrado) — parcial
  - efeito não simulado: Velocidade de Projéteis aumentada em 40 %
- **Holy_Flame_Totem_of_Ire** (Totem Flamejante Sagrado da Ira) — parcial
  - efeito não simulado: 128 % mais Velocidade de Projétil
- **Holy_Hammers** (Martelos Sagrados) — parcial
  - efeito não simulado: O primeiro martelo de cada cascata causa + 100 % de dano
  - efeito não simulado: Martelos Sagrados se acumulam em cascata até 2 vezes
  - efeito não simulado: + 20 % de dano ao gastar uma carga de poder
- **Holy_Hammers_of_Spirals** (Martelos Sagrados das Espirais) — parcial
  - efeito não simulado: ㅤ+ 15 % de dano por carga de poder removida
  - efeito não simulado: Martelos Sagrados se acumulam em cascata até 6 vezes
  - efeito não simulado: +1 cascatas por carga de poder removida
  - efeito não simulado: +5 % mais dano por carga de poder removida
- **Holy_Strike** (Golpe Sagrado) — parcial
  - efeito não simulado: +2.1 metros para o alcance do golpe corpo a corpo do lacaio
  - efeito não simulado: Este ataque e lacaios convertem 50 % do dano físico em dano elétrico
  - efeito não simulado: +0.5 metros para o alcance do golpe corpo a corpo do lacaio
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Holy_Sweep** (Varrida Sagrada) — parcial
  - efeito não simulado: Martelos causam - 35 % de dano
  - efeito não simulado: Convoca Martelos Sagrados em até 5 inimigos atingidos
  - efeito não simulado: Convoca Martelos Sagrados em até 3 inimigos atingidos
- **Holy_Sweep_of_Hammerfalls** (Varrida Sagrada dos Martelos Cadentes) — parcial
  - efeito não simulado: Martelos causam - 50 % de dano
  - efeito não simulado: Martelos Cadentes ocorrem a cada 0.7 segundos Aumentos e reduções na velocidade de ataque afetam a frequência com que esses martelos caem
- **Hydrosphere** (Hidroesfera) — parcial
  - efeito não simulado: Pulsa a cada 0.4 enquanto Congelada, Eletrizada, Enfraquecida ou Exaurida
  - efeito não simulado: Só pode ser Acertado uma vez a cada 1 segundo
  - efeito não simulado: Inimigos Encharcados têm Exposição a Gelo e Raio, aplicando -10 % às Resistências
  - efeito não simulado: 100 % do Dano Físico é Convertido para Dano de Gelo enquanto a Esfera não possuir Afeções 100 % do Dano Físico é Convertido para Dano de Raio enquanto a Esfera estiver Eletrizada ou Exaurida 100 % do Dano Físico é Convertido para Dano de Gelo enquanto a Esfera etiver Congelada ou Enfraquecida
  - efeito não simulado: Frequência do Pulso aumentada em +10 %
- **Ice_Crash** (Pancada Glacial) — parcial
  - efeito não simulado: Segundo Estágio causa 15 % menos Dano
  - efeito não simulado: Terceiro Estágio causa 30 % menos Dano
  - efeito não simulado: Raio Base terciário igual a 3.1 metros
  - efeito não simulado: Receba 15 % do Dano Físico como Dano de Gelo Extra
- **Ice_Crash_of_Cadence** (Pancada de Gelo da Cadência) — parcial
  - efeito não simulado: Raio Base da Mão Principal é de 1.1 metros
  - efeito não simulado: Raio de alcance base da mão secundária é de 3.1 metros
  - efeito não simulado: Receba 20 % do Dano Físico como Dano de Gelo Extra
- **Ice_Nova_of_Frostbolts** (Nova Glacial dos Disparos Congelantes) — parcial
  - efeito não simulado: Causa 50 % mais Dano com Acertos e Afecções quando conjurada em um Disparo Congelante
  - efeito não simulado: Pode se expandir de até 2 Projéteis de Disparo Congelante
- **Ice_Shot** (Tiro Gélido) — parcial
  - efeito não simulado: Ângulo do Efeito em Área aumentado em 80 %
- **Ice_Shot_of_Penetration** (Tiro Gélido da Penetração) — parcial
  - efeito não simulado: Ângulo do Efeito em Área aumentado em 80 %
- **Ice_Spear** (Lança Gélida) — parcial
  - efeito não simulado: Segunda forma possui um aumento de 600 % de Chance de Crítico
  - efeito não simulado: A Segunda forma possui +49 % ao Multiplicador de Acerto Crítico
  - efeito não simulado: A Segunda forma possui 300 % mais Velocidade de Projétil
  - efeito não simulado: A Segunda forma possui +40 % ao Multiplicador de Acerto Crítico
- **Ice_Spear_of_Splitting** (Lança de Gelo da Divisão) — parcial
  - efeito não simulado: A Segunda forma possui 300 % mais Velocidade de Projétil
  - efeito não simulado: Projéteis podem se Dividir ao acertar o terreno
- **Ice_Trap** (Armadilha Glacial) — parcial
  - efeito não simulado: Raio Base terciário igual a 0.6 metros
  - efeito não simulado: 15 % de Chance de uma Armadilha ser Ativada uma vez adicional
- **Ice_Trap_of_Hollowness** (Armadilha de Gelo do Vão) — parcial
  - efeito não simulado: 15 % de Chance de uma Armadilha ser Ativada uma vez adicional
- **Icicle_Mine_of_Sabotage** (Mina Congelante da Sabotagem) — parcial
  - efeito não simulado: Efeito das Auras aumentado em 20 %
- **Immortal_Call** (Chamado Imortal) — parcial
  - efeito não simulado: Duração do Buff aumentada em 20 % por Carga de Tolerância removida
  - efeito não simulado: 15 % menos Dano Físico sofrido por Carga de Tolerância removida
- **Incinerate** (Incinerar) — parcial
  - efeito não simulado: 100 % de aumento do ângulo por estágio, até 300 %
- **Incinerate_of_Expanse** (Incinerar da Expansão) — parcial
  - efeito não simulado: 100 % de aumento do ângulo por estágio, até 300 %
- **Incinerate_of_Venting** (Incinerar da Exaustão) — parcial
  - efeito não simulado: 100 % de aumento do ângulo por estágio, até 300 %
- **Infernal_Blow** (Golpe Infernal) — parcial
  - o uso de cadáveres não existe no jogo
  - efeito não simulado: Debuffs causam 66 % de Dano por Carga
  - efeito não simulado: Debuffs causam +10 % de Dano por Carga
- **Infernal_Blow_of_Immolation** (Golpe Infernal da Imolação) — parcial
  - efeito não simulado: Debuffs causam 80 % de Dano por Carga
  - efeito não simulado: Debuffs causam +10 % de Dano por Carga
- **Infernal_Cry** (Clamor Infernal) — parcial
  - efeito não simulado: Duração da penalidade base é de 3.4 segundos
- **Intimidating_Cry** (Clamor Intimidador) — parcial
  - efeito não simulado: Inimigos Provocados por este Clamor são Intimidados
  - efeito não simulado: Impele o próximo 2 Ataque de Golpe Corpo a Corpo que você executar
- **Intuitive_Link** (Vínculo Intuitivo) — parcial
  - efeito não simulado: Magias Suportadas causam 44 % menos Dano
  - os acertos do alvo vinculado ainda não ativam as suas magias suportadas
- **Kinetic_Blast** (Explosão Cinética) — parcial
  - efeito não simulado: Explosão Cinética cria 4 explosões adicionais
  - efeito não simulado: 40 % menos Dano em Área
  - efeito não simulado: Explosão Cinética cria 1 explosões adicionais
- **Kinetic_Blast_of_Clustering** (Explosão Cinética da Ramificação) — parcial
  - efeito não simulado: Explosão Cinética cria 3 explosões adicionais
  - efeito não simulado: Causa Dano Físico Adicional igual a 15 % da Mana Máxima
  - efeito não simulado: Projéteis não podem se Partir
  - efeito não simulado: Explosão Cinética cria 1 explosões adicionais
- **Kinetic_Bolt** (Tiro Cinético) — parcial
  - efeito não simulado: Projéteis mudam de direção 8 vezes
- **Kinetic_Bolt_of_Fragmentation** (Tiro Cinético da Fragmentação) — parcial
  - efeito não simulado: Projéteis mudam de direção 3 vezes
  - efeito não simulado: Projéteis mudam de direção 1 vezes
- **Kinetic_Fusillade** (Fuzilamento Cinético) — parcial
  - efeito não simulado: Projéteis causam + 8 % dano por projétil disparado anteriormente em sequência
  - efeito não simulado: Projéteis causam +4 % mais dano por projétil disparado anteriormente em sequência
- **Kinetic_Fusillade_of_Detonation** (Fuzilamento Cinético da Detonação) — parcial
  - efeito não simulado: Projéteis causam + 16 % dano por projétil disparado anteriormente em sequência
- **Kinetic_Rain_of_Impact** (Chuva Cinética do Impacto) — parcial
  - efeito não simulado: A área alvejada base mede 9 metros de comprimento
  - efeito não simulado: Circunferência base da área-alvo é de 4.5 metros
- **Lacerate** (Dilacerar) — parcial
  - efeito não simulado: 88 % mais Dano com Sangramento enquanto na Postura de Sangue
  - efeito não simulado: 25 % de chancer de causar Sangramento enquanto na Postura de Sangue
  - efeito não simulado: Ângulo aumentada em 50 % enquanto na Postura da Areia
  - efeito não simulado: Velocidade de Ataque aumentada em 20 % caso tenha mudado de Postura Recentemente
- **Lacerate_of_Butchering** (Laceração da Carnificina) — parcial
  - efeito não simulado: Ângulo aumentada em 50 %
- **Lancing_Steel** (Aço Perfurador) — parcial
  - efeito não simulado: Acertos aós o primeiro em cada Inimigo causam 60 % menos Dano
- **Lancing_Steel_of_Spraying** (Aço Perfurador da Pulverização) — parcial
  - efeito não simulado: Acertos aós o primeiro em cada Inimigo causam 90 % menos Dano
- **Leap_Slam** (Salto Impactante) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Leap_Slam_of_Groundbreaking** (Salto Impactante Quebra-solo) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Lightning_Arrow_of_Electrocution** (Flecha Relampejante da Eletrocussão) — parcial
  - efeito não simulado: Flechas causam Dano ao alvo final 4 vezes adicionais após grudar
  - efeito não simulado: Raios acertam a cada 0.5 segundos
  - efeito não simulado: Flechas causam Dano ao alvo final 1 vezes adicionais após grudar
- **Lightning_Conduit** (Condutor Elétrico) — parcial
  - efeito não simulado: Tempo de Conjuração desta Magia é adicionado à sua Recarga se Ativada
  - efeito não simulado: 20 % mais Dano com Acertos por cada 1 % de Efeito de Eletrização no Inimigo
  - efeito não simulado: +4 % mais Dano com Acertos por cada 5 % de Efeito de Eletrização no Inimigo
- **Lightning_Conduit_of_the_Heavens** (Condutor Elétrico dos Céus) — parcial
  - efeito não simulado: Acerta até 15 Inimigos
  - efeito não simulado: Acerta até 4 Inimigos
- **Lightning_Spire_Trap_of_Zapping** (Armadilha da Espiral Relampejante da Eletrização) — parcial
  - efeito não simulado: 15 % de Chance de uma Armadilha ser Ativada uma vez adicional
- **Lightning_Tendrils** (Tentáculos Relampejantes) — parcial
  - efeito não simulado: Libera um Pulso Mais Forte a cada 3 Pulsos Pulsos Mais Fortes sempre são Golpes Críticos
- **Lightning_Tendrils_of_Eccentricity** (Tentáculos Relampejantes da Excentricidade) — parcial
  - efeito não simulado: Libera um Pulso Mais Forte a cada 5 Pulsos Pulsos Mais Fortes sempre são Golpes Críticos
  - efeito não simulado: Pulsos Mais Fortes têm 150 % mais Área de Efeito
  - efeito não simulado: Pulsos Fortalecidos causam 500 % mais Dano com Acertos e Afecções
- **Lightning_Tendrils_of_Escalation** (Tentáculos Relampejantes do Escalonamento) — parcial
  - efeito não simulado: Ganhe +1 metro de raio por segundo enquanto Canalizando, máximo de +2 metros
  - efeito não simulado: +10 % ao Máximo de Efeito da Eletrização
- **Lightning_Trap** (Armadilha Relampejante) — parcial
  - efeito não simulado: 15 % de Chance de uma Armadilha ser Ativada uma vez adicional
- **Lightning_Trap_of_Sparking** (Armadilha Relampejante das Fagulhas) — parcial
  - efeito não simulado: Projéteis Ricocheteiam ao colidirem com o terreno
  - efeito não simulado: 15 % de Chance de uma Armadilha ser Ativada uma vez adicional
- **Lightning_Warp** (Teleporte Relampejante) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - efeito não simulado: Pode aglomerar até 50 usos
  - efeito não simulado: Duração reduzida em 49 %
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Mana-Infused_Staff** (Cajado Impregnado de Mana) — sem efeito
  - a gema não tem comportamento de combate reconhecido
- **Manabond** (Vínculo de Mana) — parcial
  - efeito não simulado: Causa Dano de Raio base igual a 44 % da Mana Não Reservada que falta
  - efeito não simulado: +6 de largura por cada 25 % de Mana Máxima Não Reservada possuída
  - efeito não simulado: Causa Dano de Raio base igual a +10 % da Mana Não Reservada que falta
- **Mirror_Arrow** (Flecha Espelhada) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Mirror_Arrow_of_Bombarding_Clones** (Flecha Espelhada dos Clones Bombardeiros) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Mirror_Arrow_of_Prismatic_Clones** (Flecha Espelhada dos Clones Prismáticos) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Molten_Shell** (Escudo Flamejante) — parcial
  - efeito não simulado: 75 % do dano de ataques é absorvido pelo bônus antes de afetar sua vida ou seu escudo de Energia Bônus pode sofrer dano equivalente a 10 % da sua armadura, até 5000
  - efeito não simulado: Reflete 3000 % do Dano sofrido pelo Buff como Dano de Fogo quando o Buff expirar ou se esgotar
  - efeito não simulado: Duração do Efeito de Habilidades aumentada em 20 %
- **Old_Arctic_Armour** (Armadura Ártica) — parcial
  - efeito não simulado: Resfria Inimigos por 0.5 segundos ao Acertar, reduzindo sua Velocidade de Ação em 30 %
  - efeito não simulado: Duração do Efeito de Habilidades aumentada em 20 %
- **Old_Phase_Run** (Passo Etéreo) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: 30 % mais Dano Físico Corpo a Corpo
  - efeito não simulado: 100 % de aumento da Duração da Habilidade por Carga de Frenesi removida
  - efeito não simulado: Buff concede Furtividade aumentada em 100 %
  - efeito não simulado: Buff concede Trespassar
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Orb_of_Storms** (Orbe Trovejante) — parcial
  - efeito não simulado: Golpeia a cada 0.5 segundos enquanto Canalizando uma Habilidade de Raio próximo ao Orbe
  - efeito não simulado: Feixes se dividem em direção a alvos dentro de um raio base de 3.5 metros
  - efeito não simulado: Orbes desaparecem após 29 Golpes
  - efeito não simulado: O feixe se divide em direção a +2 alvos adicionais
- **Orb_of_Storms_of_Squalls** (Orbe Trovejante das Borrascas) — parcial
  - efeito não simulado: Golpeia a cada 0.5 segundos enquanto Canalizando uma Habilidade de Raio próximo ao Orbe
  - efeito não simulado: Feixes se dividem em direção a alvos dentro de um raio base de 3.8 metros
  - efeito não simulado: Orbes desaparecem após 14 Golpes
  - efeito não simulado: O feixe se divide em direção a +2 alvos adicionais
- **Pact_of_Beidat** (Pacto de Beidat) — parcial
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: [Empowered|Fortalece] as próximas 6 magias que você conjurar
  - efeito não simulado: Habilidades fortalecidas causam + 35 % de dano com ataques e afecções
  - efeito não simulado: Habilidades fortalecidas também afetam 8 áreas adicionais em espiral ao redor da área-alvo
  - efeito não simulado: Feixes de habilidades fortalecidas se propagam mais 6 vezes
  - efeito não simulado: Habilidades fortalecidas disparam 6 projéteis adicionais Habilidades fortalecidas disparam projéteis em círculo
  - efeito não simulado: [Empowered|Fortalece] as próximas +2 magias que você conjurar
- **Pact_of_KTash** (Pacto de K'tash) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: [Empowered|Fortalece] a próxima magia vaal danosa que você conjurar
  - efeito não simulado: Habilidades fortalecidas causam + 29 % de dano
- **Penance_Brand_of_Conduction** (Runa da Penitência da Condução) — parcial
  - efeito não simulado: Até 0.9 metros ao raio da propagação de Energia, escalonado pela distância da Runa
- **Penance_Brand_of_Dissipation** (Runa da Penitência da Dissipação) — parcial
  - efeito não simulado: Pulsos causam 20 % mais Dano com Afecções por Energia após a primeira
  - efeito não simulado: Pulsos causam 20 % mais Dano com Dano com Acertos por Energia após a primeira
  - efeito não simulado: +0.1 metros ao raio do Pulso por Energia
- **Perforate** (Perfurar) — parcial
  - efeito não simulado: Cria 7 Estaca
  - efeito não simulado: Cria +2 Estacas
- **Perforate_of_Bloodshed** (Perfuração da Carnificina) — parcial
  - efeito não simulado: Cria 6 Estaca
- **Perforate_of_Duality** (Perfuração da Dualidade) — parcial
  - efeito não simulado: Cria 10 Estacas adicionais se você mudou de Postura Recentemente
  - efeito não simulado: Cria 5 Estaca
  - efeito não simulado: 5 % mais Dano na Postura de Sangue
- **Pestilent_Strike** (Golpe Pestilento) — parcial
  - efeito não simulado: 30 % mais Duração do Veneno
  - efeito não simulado: Debuff Secundário causa 50 % do total restante do Dano Venenoso Esperado de todos os Venenos no Inimigo morto por segundo como Dano de Caos
  - efeito não simulado: 20 % mais Duração do Veneno
- **Petrified_Blood** (Sangue Petrificado) — sem efeito
  - a gema não tem comportamento de combate reconhecido
- **Plague_Bearer** (Infestador) — limitação do modelo idle
  - _idle:_ sai sozinha, na barra: Incuba e, no Valor Máximo da Praga com um inimigo a até 2 casas, Infesta até o Valor acabar; o raio da Infestação é de 2 casas (o PoE não publica o raio base)
- **Poachers_Mark** (Marca do Larápio) — parcial
  - efeito não simulado: Inimigos Amaldiçoados têm -20 % de Reducão de Dano Físico
  - efeito não simulado: Inimigos Amaldiçoados têm 5 % de chance de concederem uma Carga de Frenesi quando Acertados
- **Poisonous_Concoction** (Composto Venenoso) — parcial
  - efeito não simulado: Consome 1 Carga de 1 Frasco de Vida, se possível, por Projétil Disparado
  - efeito não simulado: Dano de Caos Adicional igual a 16 % da Quantidade de Recuperação do Frasco se Cargas foram consumidas de um Frasco de Vida
  - efeito não simulado: 20 % de chance de infligir Definhando por 2 segundos ao Acertar
- **Poisonous_Concoction_of_Bouncing** (Composto Venenoso Saltador) — parcial
  - efeito não simulado: Projéteis podem Ricochetear ao atingir o solo Projéteis Ricocheteiam para direções aleatórias
  - efeito não simulado: Consome 8 Cargas de 1 Frasco de Vida, se possível, por Projétil Disparado
  - efeito não simulado: Dano de Caos Adicional igual a 18 % da Quantidade de Recuperação do Frasco se Cargas foram consumidas de um Frasco de Vida
  - efeito não simulado: 20 % de chance de infligir Definhando por 2 segundos ao Acertar
- **Portal** (Portal) — sem efeito
  - a gema não tem comportamento de combate reconhecido
- **Power_Siphon** (Sifão de Poder) — parcial
  - efeito não simulado: 20 % de chance de receber uma Carga de Poder quando um Projétil Acertar um Inimigo Raro ou Único
- **Power_Siphon_of_the_Archmage** (Sifão de Poder do Arquimago) — parcial
  - efeito não simulado: Causa Dano de Raio Adicional igual a 24 % da Mana máxima
  - efeito não simulado: 20 % de chance de receber uma Carga de Poder quando um Projétil Acertar um Inimigo Raro ou Único
  - efeito não simulado: Causa Dano de Raio Adicional igual a 3 % da Mana máxima
- **Punishment** (Castigo) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Inimigos Amaldiçoados sofrem Dano aumentado em 58 % enquanto em Vida Baixa
  - efeito não simulado: Inimigos Amaldiçoados são Debilitados por 2 Segundos quando Acertarem
  - efeito não simulado: Inimigos Amaldiçoados são Debilitados por +1 Segundos quando Acertarem
- **Purifying_Flame** (Chama Purificadora) — parcial
  - efeito não simulado: 0.6 metros ao raio do Solo Sagrado
  - efeito não simulado: Onda de Choque causa 25 % menos Dano
  - efeito não simulado: +0.3 metros ao raio do Solo Sagrado
- **Purifying_Flame_of_Revelations** (Chama Purificadora das Revelações) — parcial
  - efeito não simulado: +1.1 metros ao raio do Solo Sagrado
  - efeito não simulado: Onda de Choque causa 150 % mais Dano
  - efeito não simulado: Onda de Choque causa +30 % mais Dano
- **Purity_of_Elements** (Pureza Elementar) — parcial
  - a imunidade a afecções ainda não existe no jogo
- **Pyroclast_Mine** (Mina Explosiva de Fogo) — parcial
  - efeito não simulado: Aura de Exposição ao Fogo aplica -15 % à resistência a dano de fogo
- **Pyroclast_Mine_of_Sabotage** (Mina Piroclástica da Sabotagem) — parcial
  - efeito não simulado: Aura de Exposição ao Fogo aplica -25 % à resistência a dano de fogo
- **Quickstep** (Passo Rápido) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: Recuperação da Recarga aumentada em 200 % se usado enquanto um Inimigo Único estiver em sua Presença
  - efeito não simulado: Qualidade não tem efeito
  - efeito não simulado: Qualidade não tem efeito
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Rage_Vortex** (Vórtice Furioso) — parcial
  - efeito não simulado: Sacrifica +20 % de Fúria ao criar uma Tempestade Furiosa, se você tiver ao menos 10 de Fúria
  - efeito não simulado: Tempestade Furiosa causa 10 % mais Dano por cada 1 de Fúria Sacrificada
  - efeito não simulado: Tormenta Furiosa tem +0.1 metros ao raio por cada 2 de Fúria sacrificada
  - efeito não simulado: Tempestade Furiosa Acerta com 250 % mais Frequência
  - efeito não simulado: Sacrifica +5 % de Fúria ao criar uma Tempestade Furiosa
- **Rage_Vortex_of_Berserking** (Vórtice Furioso do Berserker) — parcial
  - efeito não simulado: Tempestade Furiosa Acerta com 250 % mais Frequência
  - efeito não simulado: Perca 3 de Fúria por segundo
  - efeito não simulado: Acada segundo 20 % mais Fúria perdida
- **Raise_Spectre** (Evocar Espectro) — parcial
  - efeito não simulado: Lacaios possuem +30 % de todas Resistências Elementais
  - efeito não simulado: Velocidade de Movimento dos Lacaios está no Máximo
  - efeito não simulado: Lacaios possuem +20 % de todas Resistências Elementais
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Raise_Spectre_of_Transience** (Evocar Espectro da Transitoriedade) — parcial
  - efeito não simulado: Espectros têm Duração Base de 30 segundos Espectros não viajam entre as Áreas
  - efeito não simulado: Lacaios possuem +30 % de todas Resistências Elementais
  - efeito não simulado: Velocidade de Movimento dos Lacaios está no Máximo
  - efeito não simulado: Lacaios têm Chance de Acerto Crítico aumentada em 1180 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Raise_Zombie** (Evocar Zumbi) — parcial
  - efeito não simulado: +1 ao Máximo de Zumbis Evocados
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Raise_Zombie_of_Falling** (Evocar Zumbi da Queda) — parcial
  - efeito não simulado: +200 ao número máximo de Zumbis
  - efeito não simulado: Não requer um cadáver
  - efeito não simulado: Lacaios têm 15 % de chance de causar Dano Dobrado
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Raise_Zombie_of_Slamming** (Evocar Zumbi da Pancada) — parcial
  - efeito não simulado: Ataque de Impacto dos Zumbis Erguidos tem Efeito em Área aumentado em 76 %
  - efeito não simulado: Golpe de Impacto de Zumbis Evocados tem a Velocidade de Recarga aumentada em %
  - efeito não simulado: +1 ao Máximo de Zumbis Evocados
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Rallying_Cry** (Clamor Agrupador) — parcial
  - efeito não simulado: Conta o Poder total de Inimigos e Aliados no Raio
  - efeito não simulado: Buff concede Dano de Ataque Adicional igual a 4 % do Dano da sua Arma da Mão Principal por cada 5 de Poder, contando um máximo de 30 de Poder
  - efeito não simulado: Buff tem 100 % mais Efeito em seus Lacaios
  - efeito não simulado: Impele o próximo 5 Ataque de Golpe Corpo a Corpo que você executar
  - efeito não simulado: Ataques Impelidos causam 5 % mais Dano por Aliado afetado, máximo de 25 %
- **Reap** (Ceifar) — parcial
  - efeito não simulado: Ganhe uma Carga Sangrenta se esta Habilidade Acertar Inimigos e nenhum deles Morrerem Perca uma Carga Sangrenta quando um Inimigo Morrer enquanto afetado pelo Debuff desta Habilidade
  - efeito não simulado: Custa 20 % mais Vida por Carga Sangrenta
  - efeito não simulado: Causa 15 % mais Dano por Carga Sangrenta
  - efeito não simulado: Causa +5 % mais Dano por Carga Sangrenta
- **Reap_of_Butchery** (Colheita da Carnificina) — parcial
  - efeito não simulado: Ganhe uma Carga Sangrenta se esta Habilidade Acertar Inimigos e nenhum deles Morrerem Perca uma Carga Sangrenta quando um Inimigo Morrer enquanto afetado pelo Debuff desta Habilidade
  - efeito não simulado: Custa 20 % mais Vida por Carga Sangrenta
  - efeito não simulado: Causa 25 % mais Dano por Carga Sangrenta
  - efeito não simulado: Causa +5 % mais Dano por Carga Sangrenta
- **Reave** (Devastar) — parcial
  - efeito não simulado: 4 Estágios Máximos
  - efeito não simulado: + 2 do máximo de Estágios
- **Reave_of_Refraction** (Devastação da Refração) — parcial
  - efeito não simulado: 4 Estágios Máximos
  - efeito não simulado: Converte 100 % do Dano Físico para um Elemento aleatório
  - efeito não simulado: + 2 do máximo de Estágios
- **Righteous_Fire** (Círculo Ardente) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Causa 70 % do seu Escudo de Energia Máximo como Dano Base de Fogo por segundo
  - efeito não simulado: Você Queima por 90 % de sua Vida máxima por segundo como Dano de Fogo
  - efeito não simulado: Você Queima por 70 % do seu Escudo de Energia máximo por segundo como Dano de Fogo
  - efeito não simulado: Concede 39 % mais Dano Mágico
- **Righteous_Fire_of_Arcane_Devotion** (Círculo Ardente da Devoção Arcana) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Causa 70 % da sua Mana Máxima como Dano de Fogo Base por segundo
  - efeito não simulado: Você Queima por 90 % da sua Mana Máxima por segundo como Dano de Fogo
  - efeito não simulado: Concede 24 % mais velocidade de conjuração
- **Rolling_Magma** (Bola de Magma) — parcial
  - efeito não simulado: Projéteis podem Ricochetear ao atingir o solo Projéteis não mudam de direção ao Ricochetear
- **Scorching_Ray** (Raio Escaldante) — parcial
  - efeito não simulado: Debuff Incendiário pode ter no máximo 8 estágios
  - efeito não simulado: Estágios Adicionais do Debuff adicionam 80 % de Dano
  - efeito não simulado: Exposição a Fogo aplica -25 % de Resistência a Fogo
  - efeito não simulado: Exposição a Fogo aplica 0 % de Resistência a Fogo
- **Scorching_Ray_of_Immolation** (Raio Escaldante da Imolação) — parcial
  - efeito não simulado: Debuff Incendiário pode ter no máximo 8 estágios
  - efeito não simulado: Estágios Adicionais do Debuff adicionam 10 % de Dano
  - efeito não simulado: Estágios Adicionais do Debuff adicionam +4 % de Dano
- **Scourge_Arrow** (Flecha Virulenta) — parcial
  - efeito não simulado: Máximo de 5 Estágios Deixa 1 Esporo por Estágio
  - efeito não simulado: Cada Esporo dispara 9 Flechas de Espinho
  - efeito não simulado: Projéteis de Espinhos causam 50 % menos Dano
  - efeito não simulado: Cada Esporo dispara +2 Flechas de Espinho
- **Scourge_Arrow_of_Menace** (Flecha Virulenta da Ameaça) — parcial
  - efeito não simulado: Cada Flecha deixa 1 Esporos
  - efeito não simulado: Cada Esporo dispara 4 Flechas de Espinho
  - efeito não simulado: Projéteis de Espinhos causam 50 % menos Dano
  - efeito não simulado: Cada Esporo dispara +1 Flecha de Espinho
- **Seismic_Cry** (Clamor Sísmico) — parcial
  - efeito não simulado: 200 % de aumento da Distância do Empurrão
  - efeito não simulado: Empurra e Interrompe Inimigos em uma pequena Área
  - efeito não simulado: Buff concede Ponto de Atordoamento aumentado em 15 % por cada 5 de Poder, contando um máximo de 25 de Poder
  - efeito não simulado: Impele os próximos 6 Ataques de Pancada Corpo a Corpo que você executar
  - efeito não simulado: Ataques Impelidos têm 50 % mais Área de Efeito
- **Seismic_Trap** (Armadilha Císmica) — parcial
  - efeito não simulado: Libera ondas a cada 0.9 segundos
  - efeito não simulado: Libera 5 onda
  - efeito não simulado: Libera +1 onda
- **Seismic_Trap_of_Swells** (Armadilha Sísmica dos Poços) — parcial
  - efeito não simulado: Libera 3 onda
  - efeito não simulado: Libera +1 onda
- **Shield_Charge** (Investida com Escudo) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - efeito não simulado: Redução do Ponto de Atordoamento aumentada em 75 % em inimigos na distância Máxima da investida
  - efeito não simulado: 100 % mais Dano com Acertos na Distância Máxima da Investida
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Shield_Crush_of_the_Chieftain** (Esmagar Escudos do Chefe Guerreiro) — parcial
  - efeito não simulado: Onda Central tem 88 % mais Área de Efeito
  - efeito não simulado: Onda Central tem 40 % mais Área de Efeito
- **Shield_of_Light** (Escudo de Luz) — parcial
  - efeito não simulado: Ondas adicionais serão criadas a partir dos aliados dentro de um raio base de 4 metros do primeiro inimigo atingido
- **Shock_Nova** (Nova Elétrica) — parcial
  - efeito não simulado: +10 % ao Máximo de Efeito da Eletrização
  - efeito não simulado: Anel sempre Eletriza
  - efeito não simulado: +10 % ao Máximo de Efeito da Eletrização
- **Shock_Nova_of_Procession** (Nova Elétrica da Procissão) — parcial
  - efeito não simulado: Repete 2 vezes
  - efeito não simulado: 10 % mais Velocidade de Conjuração
- **Shrapnel_Ballista** (Balista Estilhaçante) — parcial
  - efeito não simulado: as flechas do mesmo ataque podem acertar o mesmo inimigo (no jogo cada flecha a mais vai num inimigo diferente)
  - efeito não simulado: Velocidade de Projéteis aumentada em 40 %
- **Shrapnel_Ballista_of_Steel** (Balista de Cerco do Aço) — parcial
  - efeito não simulado: as flechas do mesmo ataque podem acertar o mesmo inimigo (no jogo cada flecha a mais vai num inimigo diferente)
  - efeito não simulado: Velocidade de Projéteis aumentada em 40 %
- **Siege_Ballista_of_Trarthus** (Balista de Cerco de Trarthus) — parcial
  - efeito não simulado: Alcance do Posicionamento de Totens aumentado em 300 %
  - efeito não simulado: Invoca 1 Totens de Balista em círculo que usam esta habilidade
  - efeito não simulado: Após atacar, os totens desaparecem
  - efeito não simulado: 20 % mais Dano de Projétil
- **Sigil_of_Power** (Emblema do Poder) — sem efeito
  - a gema não tem comportamento de combate reconhecido
- **Siphoning_Trap** (Armadilha Sifão de Gelo) — parcial
  - efeito não simulado: Aplica feixes aos 10 Inimigos próximos
  - efeito não simulado: Concede 324.4 de Regeneração de Vida por segundo caso um Inimigo esteja afetado
  - efeito não simulado: Concede 17.2 de Regeneração de Mana por segundo se qualquer Inimigo está afetado
  - efeito não simulado: Concede 32.4 de Regeneração de Vida por segundo para cada Inimigo afetado
  - efeito não simulado: Concede 1.7 de Regeneração de Mana por segundo para cada Inimigo afetado
  - efeito não simulado: Aplica feixes aos +4 Inimigos próximos
- **Siphoning_Trap_of_Pain** (Armadilha Drenante da Dor) — parcial
  - efeito não simulado: Aplica feixes aos 18 Inimigos próximos
- **Smite** (Castigo) — parcial
  - efeito não simulado: 20 % menos Dano em Área
  - efeito não simulado: Raio acerta 1 alvo dentro de 5 metros
  - efeito não simulado: 0 % menos Dano em Área
- **Smite_of_Divine_Judgement** (Castigo do Julgamento Divino) — parcial
  - efeito não simulado: 38 % mais Dano em Área
  - efeito não simulado: Raio acerta 3 alvos dentro de 5 metros
  - efeito não simulado: Raio acerta alvos dentro de +2 metros
- **Smoke_Mine** (Mina de Fumaça) — parcial
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: Somente uma Mina deste tipo pode ser Detonada em cada Sequência de Detonação
  - efeito não simulado: Minas não podem ser Re-armadas
  - efeito não simulado: Detonação da Mina é Instantânea
- **Snipe** (Atirar) — parcial
  - efeito não simulado: As Flechas desta Habilidade causam 1 % mais Dano com Afecções por Estágio
  - efeito não simulado: As Flechas desta Habilidade causam 1 % mais Dano com Acertos por Estágio
- **Snipers_Mark** (Marca do Atirador) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Inimigos Amaldiçoados sofrem Dano aumentado em 29 % de Acertos de Projéteis
  - efeito não simulado: Projéteis que Acertarem Inimigos Amaldiçoados se Dividem na direção de 2 alvos adicionais
  - efeito não simulado: Inimigos Amaldiçoados sofrem Dano aumentado em 5 % de Acertos de Projéteis
- **Somatic_Shell** (Concha Somática) — parcial
  - efeito não simulado: Dano de ataques é absorvido pela concha antes de afetar a vida ou o escudo de Energia do alvo Concha pode sofrer até 100 de dano antes de explodir
- **Soulrend** (Rasgalma) — parcial
  - efeito não simulado: 4 % do Dano Mágico Drenado como Escudo de Energia
- **Soulrend_of_Reaping** (Rasgalma da Colheita) — parcial
  - efeito não simulado: 4 % do Dano Mágico Drenado como Escudo de Energia
  - efeito não simulado: Velocidade de Projéteis aumentada em 40 %
- **Soulrend_of_the_Spiral** (Rasgalma da Espiral) — parcial
  - efeito não simulado: Dispara 5 Projéteis em uma espiral
- **Spectral_Helix** (Hélice Espectral) — parcial
  - efeito não simulado: Rebate até 3 vezes Modificadores ao número de Projéteis se aplicam ao número de Rebatidas
  - efeito não simulado: Gira por 4.25 rotações
  - efeito não simulado: Projéteis que Atravessaram causam 20 % mais Dano
- **Spectral_Helix_of_Trarthus** (Hélice Espectral de Trarthus) — parcial
  - efeito não simulado: Lança até 1 armadilhas a mais ao usar duas armas
  - efeito não simulado: Rebate até 3 vezes Modificadores ao número de Projéteis se aplicam ao número de Rebatidas
  - efeito não simulado: Gira por 4.25 rotações
  - efeito não simulado: 25 % menos velocidade de lançar armadilhas com arma de duas mãos
  - efeito não simulado: Projéteis que Atravessaram causam 20 % mais Dano
- **Spectral_Shield_Throw** (Arremesso de Escudo Espectral) — parcial
  - efeito não simulado: Projéteis de Estilhas Causam 50 % menos Dano
- **Spectral_Shield_Throw_of_Shattering** (Arremesso de Escudo Espectral do Despedaçamento) — parcial
  - efeito não simulado: Projéteis de Estilhas Causam 25 % menos Dano
  - efeito não simulado: 20 % mais Velocidade de Projétil
- **Spectral_Shield_Throw_of_Trarthus** (Arremesso de Escudo Espectral de Trarthus) — parcial
  - efeito não simulado: Projéteis de Estilhas Causam 50 % menos Dano
  - efeito não simulado: Dispara 6 fragmentos por vez até que todos sejam disparados
  - efeito não simulado: 20 % mais Velocidade de Projétil
- **Spectral_Throw** (Arremesso Espectral) — parcial
  - efeito não simulado: Projéteis que Atravessaram causam 20 % mais Dano
- **Spectral_Throw_of_Materialising** (Arremesso Espectral da Materialização) — parcial
  - efeito não simulado: Desaceleração do Projétil reduzida em 30 %
  - efeito não simulado: Projéteis que Atravessaram causam 20 % mais Dano
- **Spectral_Throw_of_Trarthus** (Arremesso Espectral de Trarthus) — parcial
  - efeito não simulado: Projéteis que Atravessaram causam 20 % mais Dano
- **Spirit_Offering** (Oferenda Espiritual) — parcial
  - efeito não simulado: 1 segundos adicionais de Duração Base por Cadáver extra consumido
  - efeito não simulado: Efeito da Oferenda aumentado em 10 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Split_Arrow_of_Splitting** (Flecha Dividida da Divisão) — parcial
  - efeito não simulado: Projéteis podem se Dividir sem acertar um alvo
- **Splitting_Steel** (Aço Violento) — parcial
  - efeito não simulado: Projéteis podem se Dividir sem acertar um alvo
- **Splitting_Steel_of_Ammunition** (Aço Violento da Munição) — parcial
  - efeito não simulado: Projéteis podem se Dividir sem acertar um alvo
- **Static_Strike** (Golpe Estático) — parcial
  - efeito não simulado: Raios Acertam Inimigos a cada 0.32 segundos
  - efeito não simulado: Raios causam 30 % menos Dano
  - efeito não simulado: Frequência do Raio aumentada em 20 %
- **Static_Strike_of_Gathering_Lightning** (Golpe Estático de Relâmpagos Concentrados) — parcial
  - efeito não simulado: Ganha 1 de Relâmpagos Concentrados ao atingir corpo a corpo
  - efeito não simulado: ㅤ+ 8 % de dano com ataques e afecções por Relâmpagos Concentrados
  - efeito não simulado: +2 de Relâmpagos Concentrados máximos
- **Steelskin** (Pele de Aço) — parcial
  - a absorção de dano da guarda ainda não existe no jogo
- **Storm_Brand** (Runa Tempestuosa) — parcial
  - efeito não simulado: Envia feixes até 3 Inimigos, incluindo o Inimigo Vinculado
  - efeito não simulado: Envia feixes para +1 Inimigo
- **Storm_Brand_of_Indecision** (Runa Tempestuosa da Indecisão) — parcial
  - efeito não simulado: Envia um feixe ao Inimigo Vinculado
- **Storm_Burst** (Tormenta Explosiva) — parcial
  - efeito não simulado: Orbes saltam a cada 0.4 segundos
  - efeito não simulado: Orbes Explosivas causam 75 % do Dano da Habilidade para cada 0.4 segundos de Duração restante
- **Storm_Burst_of_Repulsion** (Estouro Tempestuoso da Repulsão) — parcial
  - efeito não simulado: Orbes saltam a cada 0.4 segundos
  - efeito não simulado: Orbes Explosivas causam 75 % do Dano da Habilidade para cada 0.4 segundos de Duração restante
- **Storm_Call** (Invocar Tormenta) — parcial
  - efeito não simulado: 15 % de chance do Relâmpago acertar o Marcador ao Conjurar
- **Storm_Rain** (Chuva Tempestuosa) — parcial
  - efeito não simulado: Flecha dispara Raios a cada 0.41 segundos
  - efeito não simulado: Cada Flecha pode disparar 4 Feixes
  - efeito não simulado: Cada Flecha pode disparar +1 Feixe
- **Storm_Rain_of_the_Conduit** (Chuva Tempestuosa do Conduíte) — parcial
  - efeito não simulado: Flecha dispara Raios a cada 0.3 segundos
  - efeito não simulado: Cada Flecha pode disparar 6 Feixes
  - efeito não simulado: Cada Flecha pode disparar +2 Feixes
- **Storm_Rain_of_the_Fence** (Chuva Tempestuosa da Barreira) — parcial
  - efeito não simulado: Flecha dispara Raios a cada 0.15 segundos
  - efeito não simulado: Cada Flecha pode disparar 20 Feixes
  - efeito não simulado: Cada Flecha pode disparar +4 Feixes
- **Stormbind** (Vínculo Tempestuoso) — parcial
  - efeito não simulado: Uma Runa é Melhorada para cada 24 de Mana Gasta
- **Stormbind_of_Teleportation** (Vínculo Tempestuoso do Teleporte) — parcial
  - efeito não simulado: Uma Runa é Melhorada para cada 24 de Mana Gasta
- **Stormblast_Mine** (Mina da Tormenta Explosiva) — parcial
  - efeito não simulado: Cada mina aplica Dano aumentado em +1 % aos Inimigos próximos máximo de 150 %
- **Summon_Carrion_Golem** (Convocar Golem da Carniça) — parcial
  - efeito não simulado: Golens causam 5 % mais Dano por Lacaio Não-Golem próximo deles, até 50 %
  - efeito não simulado: Efeito do Buff aumentado em 20 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Carrion_Golem_of_Hordes** (Convocar Golem da Carniça das Hordas) — parcial
  - efeito não simulado: Lacaios têm Recuperação da Recarga aumentada em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Carrion_Golem_of_Scavenging** (Convocar Golem da Carniça do Saque) — parcial
  - efeito não simulado: Golens causam 5 % mais Dano por Lacaio Não-Golem próximo deles, até 50 %
  - efeito não simulado: Lacaios Regeneram 3 % de Vida por segundo
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Chaos_Golem** (Convocar Golem Caótico) — parcial
  - efeito não simulado: Efeito do Buff aumentado em 20 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Chaos_Golem_of_Hordes** (Convocar Golem Caótico das Hordas) — parcial
  - efeito não simulado: Lacaios têm Recuperação da Recarga aumentada em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Chaos_Golem_of_the_Maelstr%C3%B6m** (Convocar Golem Caótico do Turbilhão) — parcial
  - efeito não simulado: Lacaios têm efeito de definhamento aumentado em 20 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Flame_Golem** (Convocar Golem Flamejante) — parcial
  - efeito não simulado: Efeito do Buff aumentado em 20 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Flame_Golem_of_Hordes** (Convocar Golem Flamejante das Hordas) — parcial
  - efeito não simulado: Lacaios têm Recuperação da Recarga aumentada em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Flame_Golem_of_the_Meteor** (Convocar Golem Flamejante do Meteoro) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Holy_Relic** (Convocar Relíquia Sagrada) — parcial
  - efeito não simulado: Efeito do Buff aumentado em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Holy_Relic_of_Conviction** (Convocar Relíquia Sagrada da Convicção) — parcial
  - efeito não simulado: Lacaios têm Recuperação da Recarga aumentada em 20 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Ice_Golem** (Convocar Golem Glacial) — parcial
  - efeito não simulado: Efeito do Buff aumentado em 20 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Ice_Golem_of_Hordes** (Convocar Golem Glacial das Hordas) — parcial
  - efeito não simulado: Lacaios têm Recuperação da Recarga aumentada em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Ice_Golem_of_Shattering** (Convocar Golem Glacial do Despedaçamento) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Lightning_Golem** (Convocar Golem Relampejante) — parcial
  - efeito não simulado: Efeito do Buff aumentado em 20 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Lightning_Golem_of_Hordes** (Convocar Golem Elétrico das Hordas) — parcial
  - efeito não simulado: Lacaios têm Recuperação da Recarga aumentada em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Raging_Spirit** (Convocar Espírito Furioso) — parcial
  - efeito não simulado: 30 % de chance de convocar um Lacaio extra
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Raging_Spirit_of_Enormity** (Convocar Espírito Furioso da Enormidade) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Reaper** (Convocar Ceifador) — parcial
  - efeito não simulado: Ceifador faz com que seus Lacaios Não-Ceifadores causem 29 % menos Dano
  - efeito não simulado: Ceifador faz com que seus Lacaios Não-Ceifadores tenham 29 % menos Vida Máxima
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Reaper_of_Eviscerating** (Convocar Ceifador da Evisceração) — parcial
  - efeito não simulado: Ceifador faz com que seus Lacaios Não-Ceifadores causem 29 % menos Dano
  - efeito não simulado: Ceifador faz com que seus Lacaios Não-Ceifadores tenham 29 % menos Vida Máxima
  - efeito não simulado: Lacaios têm 40 % de chance de agravar sangramento em alvos atingidos com ataques
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Reaper_of_Revenants** (Convocar Ceifador dos Fantasmas) — parcial
  - efeito não simulado: Ceifadores fazem com que seus Lacaios não-Ceifadores tenham 29 % menos Dano
  - efeito não simulado: Ceifadores fazem com que seus Lacaios não-Ceifadores tenham 29 % menos Vida Máxima
  - efeito não simulado: Velocidade de Movimento dos Lacaios aumentada em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Skeletons** (Convocar Esqueleto) — parcial
  - efeito não simulado: +1 ao Máximo de Esqueletos Convocados
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Skeletons_of_Archers** (Convocar Esqueleto dos Arqueiros) — parcial
  - efeito não simulado: +1 ao Máximo de Esqueletos Convocados
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Skeletons_of_Mages** (Convocar Esqueleto dos Magos) — parcial
  - efeito não simulado: +1 ao Máximo de Esqueletos Convocados
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Skitterbots** (Convocar Robôs Rastejantes) — parcial
  - efeito não simulado: Velocidade de Movimento dos Lacaios aumentada em 76 %
  - efeito não simulado: Lacaios tem Efeito Resfriante aumentado em 19 %
  - efeito não simulado: Lacaios têm Efeito Eletrizante aumentado em 19 %
  - efeito não simulado: Robôs Rastejantes concedem 10 % mais Dano de Armadilhas e Minas
  - efeito não simulado: Velocidade de Movimento dos Lacaios aumentada em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Stone_Golem** (Convocar Golem Pedregulho) — parcial
  - efeito não simulado: Efeito do Buff aumentado em 20 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Stone_Golem_of_Hordes** (Convocar Golem de Pedra das Hordas) — parcial
  - efeito não simulado: Lacaios têm Recuperação da Recarga aumentada em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Stone_Golem_of_Safeguarding** (Convocar Golem de Pedra da Proteção) — parcial
  - efeito não simulado: Lacaios têm 50 % menos Vida Máxima
  - efeito não simulado: Efeito do Buff aumentado em 20 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Sunder_of_Trarthus** (Ruptura de Trarthus) — parcial
  - efeito não simulado: Onda pode recomeçar até 3 vezes Áreas de onda ganham +0.1 metros de raio para cada área anterior
- **Swordstorm** (Tormenta de Espadas) — parcial
  - efeito não simulado: Causa Dano nos Inimigos 8 vezes
- **Tectonic_Slam** (Impacto Tectônico) — parcial
  - efeito não simulado: 30 % de Chance de ramificação da Fissura
  - efeito não simulado: +5 % de chance de ramificar fissuras por Carga de Tolerância
  - efeito não simulado: +30 % de Chance de ramificação da Fissura
- **Tectonic_Slam_of_Cataclysm** (Impacto Tectônico do Cataclismo) — parcial
  - efeito não simulado: 15 % mais Dano por Carga de Tolerância removida
  - efeito não simulado: 10 % mais Área de Efeito por Carga de Tolerância removida
  - efeito não simulado: 10 % de chance de ramificação de fissuras por Carga de Tolerância removida
  - efeito não simulado: +5 % mais Dano por Carga de Tolerância removida
- **Tempest_Shield** (Escudo Tempestuoso) — parcial
  - efeito não simulado: Buff concede +25 % de Chance de Bloquear o Dano Mágico enquanto portando um Escudo
  - efeito não simulado: Buff concede Imunidade a Eletrização
- **Temporal_Chains** (Grilhões Temporais) — parcial
  - a lentidão da maldição ainda não existe no jogo
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Outros efeitos em inimigos Amaldiçoados expiram 25 % mais devagar
  - efeito não simulado: Inimigos Raros e Únicos Amaldiçoados tem 18 % menos Velocidade de Ação
  - efeito não simulado: Duração de Maldições aumentada em 20 %
- **Temporal_Rift** (Fenda Temporal) — sem efeito
  - a gema não tem comportamento de combate reconhecido
- **Tornado** (Tornado) — parcial
  - efeito não simulado: Causa Dano a cada 0.25 segundos
  - efeito não simulado: Pela Duração Inicial, pode ser acertado pelos seus Projéteis até 20 vezes
  - efeito não simulado: Durante a Duração Secundária, Reflete 10 % do Dano Sofrido aos Inimigos
  - efeito não simulado: Inimigos no alcance são Desacelerados com Velocidade de Movimento reduzida em -1 %
- **Tornado_of_Elemental_Turbulence** (Tornado da Turbulência Elemental) — parcial
  - efeito não simulado: Causa Dano a cada 0.25 segundos
  - efeito não simulado: Inimigos no alcance são Desacelerados com Velocidade de Movimento reduzida em -1 %
- **Tornado_Shot** (Tiro Tornado) — parcial
  - efeito não simulado: Dispara 3 Projéteis secundários
  - efeito não simulado: Velocidade de Projéteis aumentada em 40 %
- **Tornado_Shot_of_Cloudburst** (Tiro Tornado da Núvem Explosiva) — parcial
  - efeito não simulado: Dispara um Carregamento de Flechas no ar Projéteis Disparam de onde a Flecha com o Carregamento cair
- **Toxic_Rain** (Chuva Tóxica) — parcial
  - efeito não simulado: Cada Esporo aplica 5 % menos Velocidade de Movimento aos Inimigos próximos, até um máximo de 30 %
- **Toxic_Rain_of_Sporeburst** (Chuva Tóxica da Explosão de Esporos) — parcial
  - efeito não simulado: Cada Esporo aplica 5 % menos Velocidade de Movimento aos Inimigos próximos, até um máximo de 30 %
- **Toxic_Rain_of_Withering** (Chuva Tóxica do Definhamento) — parcial
  - efeito não simulado: Cada Esporo inflige 1 Debuff de Definhamento nos Inimigos próximos
- **Unearth** (Desenterrar) — parcial
  - efeito não simulado: Cadáveres Criados têm Vida Máxima aumentada em 20 %
- **Vaal_Absolution** (Absolvição Vaal) — parcial
  - efeito não simulado: Sentinelas Ascendidos causam 300 % mais Dano
  - efeito não simulado: Sentinelas Ascendidos sofrem 70 % menos Dano
  - efeito não simulado: Lacaios têm Recuperação da Recarga aumentada em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Vaal_Animate_Weapon** (Animar Arma Vaal) — parcial
  - efeito não simulado: Anima até 10 Armas
  - efeito não simulado: +2 ao Máximo de Armas Animadas
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Vaal_Arctic_Armour** (Armadura Ártica Vaal) — parcial
  - efeito não simulado: Você sofre 90 % menos Dano de Acertos e conta como Congelado
  - efeito não simulado: Gelo se quebra após você sofrer 3 Acertos Danificadores ou a Duração expirar
  - efeito não simulado: Buff concede 30.6 de Regeneração de Mana por segundo
  - efeito não simulado: Buff concede 395 de Regeneração de Escudo de Energia por segundo
  - efeito não simulado: Duração do Efeito de Habilidades aumentada em 20 %
- **Vaal_Blade_Flurry** (Rajada de Lâminas Vaal) — parcial
  - efeito não simulado: Efeito da Cegueira aumentado em 68 %
  - efeito não simulado: 100 % de chance de Cegar inimigos ao acertá-los
  - efeito não simulado: 50 % menos Dano Sofrido enquanto Canalizando
  - efeito não simulado: Raio Base do Círculo é de 1 metro +0.5 metros ao Raio do Círculo por Estágio A Canalização é interrompida quando o Raio Total do Círculo atingir 9 metros
  - efeito não simulado: +5 % mais Dano com Acertos e Afecções por cada estágio
- **Vaal_Blade_Vortex** (Vórtice de Lâminas Vaal) — parcial
  - efeito não simulado: Acerta Inimigos a cada 0.2 Segundos
  - efeito não simulado: Possui 10 lâminas
  - efeito não simulado: Taxa de Acerto aumentada em +5 % por cada lâmina
- **Vaal_Blight** (Infestação Vaal) — parcial
  - efeito não simulado: Velocidade de Movimento reduzida em 80 %
  - efeito não simulado: Debuff pode ter até 20 camadas de Dano
  - efeito não simulado: Inimigos Desacelerados sofrem Dano de Caos aumentado em 30 %
- **Vaal_Clarity** (Clareza Vaal) — parcial
  - efeito não simulado: Suas Habilidades e de seus aliados próximos não Custam Mana
- **Vaal_Cleave** (Cutilada Vaal) — parcial
  - efeito não simulado: Buff concede Golpe Abatedor com Cutilada Buff concede 60 % mais Área de Efeito da Cutilada Buff concede 60 % mais Dano com Cutilada com Acertos e Afecções aos Inimigos que estão em Vida Baixo
  - efeito não simulado: +0.1 metros de raio por inimigo próximo, até +1 metro
- **Vaal_Cold_Snap** (Estalo Gélido Vaal) — parcial
  - efeito não simulado: Raio Base terciário igual a 3.6 metros
  - efeito não simulado: Ganhe uma Carga de Poder quando um Inimigo Morrer enquanto na Área dessa Habilidade A cada Segundo, receba uma Carga de Frenesi se um Inimigo estiver na Área dessa Habilidade
  - efeito não simulado: 20 % mais Efeito de Resfriamento
- **Vaal_Cyclone** (Ciclone Vaal) — parcial
  - efeito não simulado: Área de Efeito aumentada em 15 % por cada 0.1 metro de Alcance de Golpe Corpo a Corpo adicional
  - efeito não simulado: Área de Efeito aumentada em 5 % por cada 0.1 metro de Alcance de Golpe Corpo a Corpo adicional
- **Vaal_Detonate_Dead** (Detonar Morto Vaal) — parcial
  - efeito não simulado: 30 % de chance de detonar um cadáver adicional
- **Vaal_Discipline** (Disciplina Vaal) — parcial
  - efeito não simulado: A Recarga do seu Escudo de Energia e dos seus aliados próximos não é impedida por Dano
- **Vaal_Domination** (Dominação Vaal) — parcial
  - efeito não simulado: Sentinelas Ascendidos causam 300 % mais Dano
  - efeito não simulado: Sentinelas Ascendidos sofrem 70 % menos Dano
  - efeito não simulado: Lacaios têm Recuperação da Recarga aumentada em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Vaal_Double_Strike** (Golpe Duplo Vaal) — parcial
  - efeito não simulado: Clones possuem 57 % de aumento da Velocidade de Movimento
- **Vaal_Earthquake** (Terremoto Vaal) — parcial
  - efeito não simulado: Abalo Secundário causa 407 % mais Dano com Acertos e Afecções
  - efeito não simulado: O efeito atual é finalizado após 9 Abalos Secundários
  - efeito não simulado: Abalo Secundário causa +30 % mais Dano com Acertos e Afecções
- **Vaal_Fireball** (Bola de Fogo Vaal) — parcial
  - efeito não simulado: Dispara 32 Projéteis em uma espiral
- **Vaal_Firestorm** (Tormenta Flamejante Vaal) — parcial
  - efeito não simulado: Solo Ardente dura 6 segundos
  - efeito não simulado: 16 Tiros
  - efeito não simulado: Impactos têm 20 % mais Efeito em Área
- **Vaal_Flameblast** (Explosão Flamejante Vaal) — parcial
  - efeito não simulado: 200 % mais Dano Mágico por estágio
  - efeito não simulado: 110 % mais Dano com Afecções por estágio
- **Vaal_Flicker_Strike** (Golpe Súbito Vaal) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Vaal_Grace** (Graça Vaal) — parcial
  - efeito não simulado: Você e aliados próximos têm +15 % de chance de Evadirem Acertos de Ataques
  - efeito não simulado: Dano Mágico Suprimido causado em você é Azarado
- **Vaal_Ground_Slam** (Impacto Sísmico Vaal) — parcial
  - efeito não simulado: Este Ataque pode ser Impelido como se não fosse uma Habilidade Vaal
- **Vaal_Ice_Nova** (Nova Glacial Vaal) — parcial
  - efeito não simulado: Causa explosões menores até 5 vezes em acertos inimigos
  - efeito não simulado: Efeito em Área reduzido em 15 % a cada repetição
- **Vaal_Ice_Shot** (Tiro Gélido Vaal) — parcial
  - efeito não simulado: Ângulo do Efeito em Área aumentado em 80 %
- **Vaal_Immortal_Call** (Chamado Imortal Vaal) — parcial
  - efeito não simulado: Duração do Buff aumentada em 157 % por Carga de Tolerância removida
  - efeito não simulado: A expiração do Buff não pode ser modificada
  - efeito não simulado: Duração do Efeito de Habilidades aumentada em 20 %
- **Vaal_Impurity_of_Fire** (Impureza Ardente Vaal) — parcial
  - efeito não simulado: Efeito das Auras aumentado em 76 %
  - efeito não simulado: Resistência à Fogo de Inimigos Próximos é Ignorada por Acertos
- **Vaal_Impurity_of_Ice** (Impureza Glacial Vaal) — parcial
  - efeito não simulado: Efeito das Auras aumentado em 76 %
  - efeito não simulado: Resistência à Gelo de Inimigos Próximos é Ignorada por Acertos
- **Vaal_Impurity_of_Lightning** (Impureza Elétrica Vaal) — parcial
  - efeito não simulado: Efeito das Auras aumentado em 76 %
  - efeito não simulado: Resistência à Raio de Inimigos Próximos é Ignorada por Acertos
- **Vaal_Lightning_Arrow** (Flecha Relampejante Vaal) — parcial
  - efeito não simulado: Projéteis mudam de direção 9 vezes Projéteis podem Acertar alvos cada vez que mudam de direção
  - efeito não simulado: Projéteis não podem se Partir
- **Vaal_Lightning_Trap** (Armadilha Relampejante Vaal) — parcial
  - efeito não simulado: Projéteis deixam Solo Eletrizado
  - efeito não simulado: Solo Eletrizado causa 15 % de Dano sofrido aumentado
  - efeito não simulado: Solo Eletrizado causa 5 % de Dano sofrido aumentado
- **Vaal_Lightning_Warp** (Teleporte Relampejante Vaal) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - efeito não simulado: Duração reduzida em 49 %
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Vaal_Molten_Shell** (Escudo Flamejante Vaal) — parcial
  - efeito não simulado: 39 % do dano de ataques é absorvido pelo bônus antes de afetar sua vida ou seu escudo de Energia Bônus pode sofrer dano equivalente a 20 % da sua armadura, até 10000
  - efeito não simulado: Reflete 9000 % do Dano sofrido pelo Buff como Dano de Fogo por segundo, ou quando o Buff expirar ou se esgotar
  - efeito não simulado: Duração do Efeito de Habilidades aumentada em 20 %
- **Vaal_Molten_Strike** (Golpe Vulcânico Vaal) — parcial
  - efeito não simulado: Projéteis podem Ricochetear ao atingir o solo Projéteis não mudam de direção ao Ricochetear
- **Vaal_Power_Siphon** (Sifão de Poder Vaal) — parcial
  - efeito não simulado: Dispara Projéteis em cada inimigo Próximo
  - efeito não simulado: Receba uma Carga de Poder quando um Projétil Acertar um Inimigo Raro ou Único
- **Vaal_Rain_of_Arrows** (Chuva de Flechas Vaal) — parcial
  - efeito não simulado: Dispara 4 sequências de flechas adicionais
  - efeito não simulado: Mutila ao Acertar
  - efeito não simulado: 150 % de aumento do Efeito de Mutilação
- **Vaal_Reap** (Ceifar Vaal) — parcial
  - efeito não simulado: Efeitos do Sangue Fervendo Perduram por 4 segundos
  - efeito não simulado: Concede +4 ao máximo de Cargas de Sangue
  - efeito não simulado: Concede até o máximo de Cargas de Sangue
  - efeito não simulado: Causa +5 % mais Dano por Carga Sangrenta
- **Vaal_Reave** (Devastar Vaal) — parcial
  - efeito não simulado: + 4 do máximo de Estágios
  - efeito não simulado: + 2 do máximo de Estágios
- **Vaal_Righteous_Fire** (Círculo Ardente Vaal) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Sacrifica 60 % do seu total de Escudo de Energia e Vida Causa 158 % do Escudo de Energia e Vida Sacrificados como Dano de Fogo por segundo
  - efeito não simulado: Concede 39 % mais Dano Mágico
- **Vaal_Smite** (Castigo Vaal) — parcial
  - efeito não simulado: Raio acerta 30 alvos dentro de 10 metros
  - efeito não simulado: Aura faz com que Castigo ataque +1 alvos com relâmpagos
  - efeito não simulado: +20 % menos Dano em Área
  - efeito não simulado: +10 % mais Dano em Área
- **Vaal_Spark** (Faísca Vaal) — parcial
  - efeito não simulado: Dispara Projéteis em direções aleatórias
- **Vaal_Spectral_Throw** (Arremesso Espectral Vaal) — parcial
  - efeito não simulado: Dispara 8 Projéteis em cada uma das duas espirais espelhadas
  - efeito não simulado: Projéteis que Atravessaram causam 20 % mais Dano
- **Vaal_Storm_Call** (Invocar Tormenta Vaal) — parcial
  - efeito não simulado: Ataca um Inimigo a cada 0.2 segundos
- **Vaal_Summon_Skeletons** (Convocar Esqueletos Vaal) — parcial
  - efeito não simulado: +7 ao Máximo de Esqueletos Convocados
  - efeito não simulado: +1 ao Máximo de Esqueletos Convocados
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Vaal_Venom_Gyre** (Espiral Venenosa Vaal) — parcial
  - efeito não simulado: 40 % de chance de manter cada Projétil capturado disparado com Lâminas Giratórias
- **Vaal_Volcanic_Fissure** (Fissura Vulcânica Vaal) — parcial
  - efeito não simulado: Fissuras irrompem 2 vezes adicionais
- **Venom_Gyre** (Espiral Venenosa) — parcial
  - efeito não simulado: Projéteis Retornam a você
  - efeito não simulado: Projéteis Retornando causam 75 % menos Dano com Acertos e Afecções
  - efeito não simulado: Projéteis Retornando Atravessam todos os Alvos
  - efeito não simulado: 40 % de chance de manter cada Projétil capturado disparado com Lâminas Giratórias
  - efeito não simulado: Máximo de +10 Projéteis capturados
- **Vigilant_Strike** (Golpe Vigilante) — parcial
  - efeito não simulado: Acertos Corpo a Corpo Fortificam por 8 segundos
- **Viper_Strike** (Golpe da Víbora) — parcial
  - efeito não simulado: Quando em Empunhadura Dupla, 30 % Menos Velocidade de Ataque
  - efeito não simulado: ㅤ- 20 % de dano de ataque com duas armas
- **Viper_Strike_of_the_Mamba** (Golpe da Víbora d Mamba) — parcial
  - efeito não simulado: Quando em Empunhadura Dupla, 30 % Menos Velocidade de Ataque
  - efeito não simulado: ㅤ- 20 % de dano de ataque com duas armas
  - efeito não simulado: Não pode infligir múltiplos envenenamentos com o mesmo ataque
  - efeito não simulado: Não pode infligir Envenenamento em Inimigos Envenenados
- **Void_Sphere** (Esfera do Vácuo) — parcial
  - efeito não simulado: Pulsa a cada 0.4 segundos
  - efeito não simulado: Inimigos ao alcance são tolhidos, com velocidade de movimento reduzida em até 39 %, com base na distância da Esfera do Vazio
- **Void_Sphere_of_Rending** (Esfera do Vazio da Fenda) — parcial
  - efeito não simulado: Pulsa a cada 0.25 segundos
  - efeito não simulado: Inimigos ao alcance são tolhidos, com velocidade de movimento reduzida em até 39 %, com base na distância da Esfera do Vazio
- **Volatile_Dead** (Morto Volátil) — parcial
  - efeito não simulado: Velocidade de Movimento do Orbe aumentada em 40 %
- **Volatile_Dead_of_Seething** (Morto Volátil do Fervor) — parcial
  - efeito não simulado: Velocidade de Movimento do Orbe aumentada em 40 %
- **Volcanic_Fissure_of_Snaking** (Fissura Vulcânica do Serpenteado) — parcial
  - efeito não simulado: Fissuras irrompem 2 vezes adicionais
  - efeito não simulado: Fissuras irrompem 1 vezes adicionais
- **Voltaxic_Burst** (Explosão Voltáxica) — parcial
  - efeito não simulado: 60 % do Dano de Raio Convertido em Dano de Caos
  - efeito não simulado: Explosões causam Dano de Raio igual a 10 % da Vida Máxima do cadáver
  - efeito não simulado: 1 % mais Dano com Acertos e Afecções por cada Conjuração desta Magia aguardando no momento
  - efeito não simulado: +1 % mais Dano com Acertos e Afecções por cada Conjuração desta Magia aguardando no momento
- **Vortex_of_Projection** (Vórtice da Proteção) — parcial
  - efeito não simulado: 50 % mais Área de Efeito quando Conjurada em um Disparo Congelante
  - efeito não simulado: 50 % mais Dano quando Conjurado com Disparo Congelante
  - efeito não simulado: Pode explor de até 5 Projéteis de Disparo Congelante
- **Wall_of_Force** (Parede de Força) — sem efeito
  - a gema não tem comportamento de combate reconhecido
- **War_Banner** (Estandarte da Guerra) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Estandarte concede Precisão aumentada em 8 % a Você e Aliados
  - efeito não simulado: Estandarte concede 4 % mais Dano Físico com Habilidades Corpo a Corpo a Você e Aliados
- **Warlords_Mark** (Marca do Comandante) — parcial
  - efeito não simulado: Inimigos Amaldiçoados têm 5 % de chance de concederem uma Carga de Tolerância quando Acertados
- **Wave_of_Conviction** (Onda de Convicção) — parcial
  - efeito não simulado: Exposição aplica -15 % de Resistência Elemental que combine com o maior Dano sofrido
- **Whirling_Blades** (Lâminas Giratórias) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Wild_Strike_of_Extremes** (Golpe Selvagem dos Extremos) — parcial
  - efeito não simulado: Acertos tratam os valores da Resistência Elemental dos Monstros Inimigos como invertidos
- **Winter_Orb** (Orbe Invernal) — parcial
  - os estágios de canalização não existem: no jogo é um uso por vez
  - efeito não simulado: Dispara projéteis a cada 1.2 segundos
  - efeito não simulado: Duração aumentada em 30 % por Estágio
  - efeito não simulado: 80 % mais Frequência de Projéteis enquanto Canalizando
  - efeito não simulado: 20 % de aumento da Frequência de Projéteis por Estágio
  - efeito não simulado: +2 Estágios Máximos
- **Wintertide_Brand** (Runa da Maré Invernal) — parcial
  - os estágios de canalização não existem: no jogo é um uso por vez
  - efeito não simulado: Debuff causa 20 % mais Dano por Estágio
  - efeito não simulado: Duração Base do Debuff é de 2 segundos
  - efeito não simulado: Debuff causa +5 % mais Dano por Estágio
- **Wither** (Definhar) — parcial
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: Definhado dura 2 segundos
  - efeito não simulado: Velocidade de Movimento reduzida em 36 %
  - efeito não simulado: Dano de Caos sofrido aumentado em 6 %
- **Withering_Step** (Passo Definhante) — parcial
  - o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: Definhado dura 3 segundos
  - efeito não simulado: Não pode ser Conjurado ou Ativado enquanto Elusivo Concede Elusivo
  - efeito não simulado: Efeito do Elusivo desta Habilidade aumentado em 38 %
  - efeito não simulado: Inflige 6 Debuffs de Definhamento adicionais na primeira vez que cada Inimigo entrar na Área
  - efeito não simulado: Buff concede Trespassar
  - efeito não simulado: Inflige +2 Debuffs de Definhamento adicionais na primeira vez que cada Inimigo entrar na Área
  - _idle:_ o deslocamento (salto, investida, teleporte) não existe: no jogo é o golpe na área
- **Zealotry** (Fanatismo) — parcial
  - efeito não simulado: Você e Aliados não-Lacaios Próximos têm 10 % de chance de criarem Solo Sagrado ao Acertar um Inimigo Raro ou Único, durando 8 segundos

## Gemas de suporte pendentes

- **Additional_Accuracy_Support** (Precisão Adicional) — parcial
  - não simulado: Habilidades Suportadas têm +1034 de Precisão
  - não simulado: Habilidades Suportadas têm 20% de Precisão aumentada
- **Ancestral_Call_Support** (Chamado Ancestral) — parcial
  - não simulado: Alvos Extras das Habilidades Suportadas podem ser encontrados 15% mais distânte
- **Annihilation_Support** (Aniquilação (Reforço)) — parcial
  - não simulado: Golpes fatais com habilidades reforçadas fazem com que os inimigos tenham 67% de chance de explodir e causarem um décimo da própria vida máxima como dano de um elemento aleatório
  - não simulado: Golpes fatais com habilidades reforçadas fazem com que os inimigos tenham +5% de chance de explodir e causarem um décimo da própria vida máxima como dano de um elemento aleatório
- **Arcane_Surge_Support** (Fúria Arcana) — parcial
  - não simulado: Ganha Fúria Arcana após Gastar um total de 400 de Mana em Custos Diretos e Efeitos de uma Habilidade Suportada
  - não simulado: Fúria Arcana concede Velocidade de Conjuração aumentada em 30% Fúria Arcana concede Regeneração de Mana aumentada em 30%
  - não simulado: Fúria Arcana dura 4 segundos
  - não simulado: Fúria Arcana concede Velocidade de Conjuração aumentada em 30%\nFúria Arcana concede Regeneração de Mana aumentada em 30%
- **Archmage_Support** (Arquimago) — parcial
  - não simulado: Habilidades Suportadas ganham Dano de Raio Adicional igual a 14% da Mana Máxima não Reservada
  - não simulado: Habilidades reforçadas ganham custo de mana base equivalente a 5% do mana máximo não reservado
- **Arrow_Nova_Support** (Nova de Flechas) — parcial
  - não simulado: Habilidades Suportadas disparam uma Flecha Carregada no ar Projéteis da Habilidade Suportada Disparam de onde a Flecha Carregada cair
  - não simulado: Habilidades Suportadas Disparam Projéteis em um círculo
  - não simulado: Habilidades Suportadas só podem ser usadas com Arcos
  - não simulado: Habilidades Suportadas disparam uma Flecha Carregada no ar\nProjéteis da Habilidade Suportada Disparam de onde a Flecha Carregada cair
- **Awakened_Ancestral_Call_Support** (Suporte Desperto: Chamado Ancestral) — parcial
  - não simulado: Alvos Extras das Habilidades Suportadas podem ser encontrados 15% mais distânte
- **Awakened_Arrow_Nova_Support** (Suporte Desperto: Nova de Flechas) — parcial
  - não simulado: Habilidades Suportadas disparam uma Flecha Carregada no ar Projéteis da Habilidade Suportada Disparam de onde a Flecha Carregada cair
  - não simulado: Habilidades Suportadas Disparam Projéteis em um círculo
  - não simulado: Habilidades Suportadas só podem ser usadas com Arcos
  - não simulado: Habilidades Suportadas disparam uma Flecha Carregada no ar\nProjéteis da Habilidade Suportada Disparam de onde a Flecha Carregada cair
- **Awakened_Blasphemy_Support** (Suporte Desperto: Blasfêmia) — parcial
  - não simulado: Efeito em Área de Habilidades Maldição Suportadas aumentado em 104%
  - não simulado: Efeito em Área de Habilidades Maldição Suportadas aumentado em 20%
- **Awakened_Brutality_Support** (Suporte Desperto: Brutalidade) — parcial
  - não simulado: Habilidades Suportadas têm 10% de chance de Esmagar Inimigos por 4 segundos ao Acertar
- **Awakened_Cast_On_Critical_Strike_Support** (Suporte Desperto: Conjurar no Acerto Crítico) — parcial
  - não simulado: Magias Suportadas têm Recuperação da Recarga aumentada em 52%
- **Awakened_Cast_While_Channelling_Support** (Suporte Desperto: Conjurar ao Canalizar) — parcial
  - não simulado: Ignora Atordoamentos enquanto Usando Habilidades Suportadas
- **Awakened_Cold_Penetration_Support** (Suporte Desperto: Penetração de Gelo) — parcial
  - não simulado: Habilidades Suportadas têm 10% de chance de infligir Exposição a Gelo ao Acertar
- **Awakened_Controlled_Destruction_Support** (Suporte Desperto: Destruição Controlada) — parcial
  - não simulado: Habilidades Suportadas têm 10% de chance de Enervar Inimigos por 4 segundos ao Acertar
- **Awakened_Elemental_Damage_with_Attacks_Support** (Suporte Desperto: Dano Elemental com Ataques) — parcial
  - não simulado: Dano Elemental das Habilidades Suportadas não pode ser Refletido
- **Awakened_Enhance_Support** (Suporte Desperto: Melhorar) — parcial
  - não simulado: 152% de Qualidade das Gemas de Habilidade Suportadas
- **Awakened_Fire_Penetration_Support** (Suporte Desperto: Penetração de Fogo) — parcial
  - não simulado: Habilidades Suportadas têm 10% de chance de infligirem Exposição a Fogo ao Acertar
- **Awakened_Fork_Support** (Suporte Desperto: Difundir) — parcial
  - não simulado: Projéteis das Habilidades Suportadas podem Difundir 1 Vezes adicionais
- **Awakened_Hextouch_Support** (Suporte Desperto: Toque Maldito) — parcial
  - não simulado: Habilidades Suportadas aplicam Maldições Suportadas em Acertos
  - não simulado: Você não pode Conjurar Magias Maldição Suportadas
  - não simulado: Feitiços aplicados por habilidades de maldição reforçadas têm 34% de chance de afetar inimigos imunes a feitiços
- **Awakened_Lightning_Penetration_Support** (Suporte Desperto: Penetração de Raio) — parcial
  - não simulado: Habilidades Suportadas têm 10% de chance de infligir Exposição a Raio ao Acertar
- **Awakened_Melee_Physical_Damage_Support** (Suporte Desperto: Dano Físico Corpo a Corpo) — parcial
  - não simulado: Habilidades Suportadas têm 10% de chance de Intimidar Inimigos por 4 segundos ao Acertar
- **Awakened_Spell_Cascade_Support** (Suporte Desperto: Cascata Mágica) — parcial
  - não simulado: Habilidades de Efeito em Área Suportadas também afetam áreas na frente, atrás, e dos lados da área alvo
  - não simulado: Habilidades de Efeito em Área Suportadas também afetam áreas na frente, atrás,\ne dos lados da área alvo
- **Awakened_Spell_Echo_Support** (Suporte Desperto: Eco Mágico) — parcial
  - não simulado: Repetição Final das Habilidades Suportadas tem 20% de chance de causar Dano Dobrado
- **Awakened_Void_Manipulation_Support** (Suporte Desperto: Manipulação do Vácuo) — parcial
  - não simulado: 1 do Nível das Gemas de Habilidade de Caos Suportadas
- **Behead_Support** (Decapitar) — parcial
  - não simulado: Habilidades Suportadas têm +0.3 metros ao Alcance de Golpes Corpo a Corpo
  - não simulado: Golpes Finais das Habilidades de Golpe Suportadas com Armas Corpo a Corpo contra Monstros Raros concedem um de seus Modificadores por 20 segundos
  - não simulado: 20% de chance de renovar a Duração do Modificador recebido em até 5 segundos quando você Acertar um Inimigo Raro ou Único com Habilidades Suportadas
- **Blasphemy_Support** (Blasfêmia) — parcial
  - não simulado: Efeito em Área de Habilidades Maldição Suportadas aumentado em 76%
  - não simulado: Efeito em Área de Habilidades Maldição Suportadas aumentado em 20%
- **Blastchain_Mine_Support** (Mina da Cadeia Explosiva) — parcial
  - não simulado: Habilidades Suportadas ganham uma Reserva Base igual ao Custo Base de Mana e Vida
- **Blessed_Call_Support** (Chamado Abençoado (Reforço)) — parcial
  - não simulado: Clamores reforçados criam um chão consagrado com duração de 6 segundos
  - não simulado: Clamores reforçados têm -40% de área de efeito
  - não simulado: Clamores reforçados têm a velocidade de recarga reduzida em 20%
- **Blind_Support** (Cegar) — parcial
  - não simulado: Habilidades Suportadas têm 10% de chance de Cegar inimigos ao acertar
  - não simulado: Habilidades Suportadas têm 38% da duração da Cegueira aumentada
- **Block_Chance_Reduction_Support** (Redução de Chance de Bloqueio) — sem efeito
  - não simulado: Subjugado aplica -5% à chance de Bloquear o Dano Mágico e de Ataques
  - não simulado: Habilidades Suportadas infligem Subjugado por 4 segundos ao Bloquear
  - não simulado: Inimigos possuem -20% de chance de Bloquear o Dano de Ataques e Magias das Habilidades Suportadas
  - nenhuma linha do suporte tem efeito no jogo ainda
- **Bloodsoaked_Banner_Support** (Estandarte Ensanguentado (Reforço)) — parcial
  - não simulado: Estandartes reforçados infligem Sangue Corrompido a cada segundo aos inimigos dentro de sua área
  - não simulado: Sangue Corrompido infligido por estandartes reforçados causam 82.3 de dano físico base por segundo por bravura consumida
  - não simulado: Sangue Corrompido infligido por estandartes reforçados tem uma duração base de 8 segundos
- **Bloodthirst_Support** (Sede de Sangue) — parcial
  - não simulado: Ataques Suportados causam Dano Físico com Armas Adicional igual a 2% da Vida Máxima enquanto em Vida Baixa
  - não simulado: Ataques Suportados causam Dano Físico com Armas Adicional igual a\n2% da Vida Máxima enquanto em Vida Baixa
- **Bonechill_Support** (Suporte Resfriamento Ósseo) — parcial
  - não simulado: Efeito dos Resfriamentos infligidos por Habilidades Suportadas aumentado em 44%
  - não simulado: Inimigos Resfriados por Habilidades Suportadas tem o Dano de Gelo sofrido aumentado pelo Efeito de Resfriamento
  - não simulado: Inimigos em Áreas Resfriadas por Habilidades Suportadas tem o Dano de Gelo sofrido aumentado pelo Efeito de Resfriamento
- **Bonespire_Support** (Torre Óssea (Reforço)) — sem efeito
  - esses lacaios especiais ainda não existem no jogo
- **Cast_on_Ward_Break_Support** (Conjurar ao Perder Salvaguarda (Reforço)) — parcial
  - não simulado: Ativa esta magia reforçada quando sua salvaguarda quebra
- **Chance_to_Flee_Support** (Chance de Fugir) — sem efeito
  - não simulado: Habilidades reforçadas têm 44% de chance de fazer os monstros fugirem ao atingir
  - não simulado: Habilidades reforçadas têm +20% de chance de fazer os monstros fugirem ao atingir
  - nenhuma linha do suporte tem efeito no jogo ainda
- **Close_Combat_Support** (Combate Próximo) — parcial
  - não simulado: Habilidades Suportadas concedem Ímpeto de Combate ao Acertar Ímpeto de Combate dura 2 segundos ou até que você utilize uma Habilidade de Deslocamento
  - não simulado: Adrenalina de Combate concede 20% mais Velocidade de Ataque às Habilidades de Deslocamento não Suportadas por Combate Próximo
  - não simulado: Habilidades Suportadas só podem ser usadas com Machados e Espadas
  - não simulado: Habilidades Suportadas concedem Ímpeto de Combate ao Acertar\nÍmpeto de Combate dura 2 segundos ou até que você utilize uma Habilidade de Deslocamento
- **Cluster_Traps_Support** (Grupo de Armadilhas) — parcial
  - não simulado: Habilidades Suportadas têm Efeito em Área da Ativação de Armadilhas aumentado em 20%
- **Cold_to_Fire_Support** (Gelo a Fogo) — parcial
  - não simulado: Habilidades Suportadas ganham 29% de Dano de Gelo como Dano Extra de Fogo
  - não simulado: Habilidades Suportadas têm 50% de Dano de Gelo Convertido para Dano de Fogo
- **Combustion_Support** (Combustão) — parcial
  - não simulado: Inimigos Incendiados por Habilidades Suportadas possuem -10% de Resistência a Fogo
- **Communion_Support** (Comunhão (Reforço)) — parcial
  - não simulado: Magias reforçadas causam de 44 a 66 de dano físico adicionado para cada lacaio permanente
- **Companionship_Support** (Companheirismo (Reforço)) — parcial
  - não simulado: Lacaios de habilidades reforçadas sofrem 15% do dano de ataque da própria vida antes de você, se eles forem seus únicos lacaios
  - não simulado: Lacaios de habilidades reforçadas sofrem -41% de dano, se eles forem seus únicos lacaios
  - não simulado: Lacaios de habilidades reforçadas sofrem 15% do dano de ataque da própria vida\nantes de você, se eles forem seus únicos lacaios
- **Congregation_Support** (Congregação (Reforço)) — parcial
  - não simulado: +64% para o número máximo de lacaios de habilidades reforçadas
  - não simulado: Habilidades Suportadas têm 10% de Velocidade de Movimento de Lacaios aumentada
- **Controlled_Blaze_Support** (Incêndio Controlado) — parcial
  - não simulado: Cada Habilidade Suportada causa 14% mais Dano com Incêndio por cada Incêndio infligido com ela Recentemente, máximo de 364%
  - não simulado: Cada Habilidade Suportada causa 3% menos Dano por cada Incêndio infligido com ela Recentemente, máximo de 78%
- **Corrupting_Cry_Support** (Clamor Corrompedor) — parcial
  - não simulado: Sangue Corrompido infligido por Clamores Suportados causam 691.8 de Dano Físico base por segundo
  - não simulado: Clamores Suportados infligem 1 Debuffs de Sangue Corrompido no primeiro inimigo Acertado por cada Ataque que Impelirem
  - não simulado: Sangue Corrompido infligido por Clamores Suportados tem uma Duração Base de 2 segundos
  - não simulado: Clamores Suportados infligem 4 Debuffs de Sangue Corrompido
  - não simulado: Clamores Suportados infligem 1 Debuffs de Sangue Corrompido no primeiro\ninimigo Acertado por cada Ataque que Impelirem
- **Coursing_Current_Support** (Coursing Current) — parcial
  - não simulado: Efeito dos Resfriamentos infligidos por Habilidades Suportadas aumentado em 76%
  - não simulado: Efeito de eletrificações infligidos com habilidades reforçadas aumentado em 76%
  - não simulado: Esfria inimigos quando eles são eletrificados por seus ataques, reduzindo a velocidade de ação com base no efeito de eletrificação
  - não simulado: Eletrifica inimigos quando eles são esfriados por seus ataques, aumentando o dano sofrido com base no efeito de esfriamento
  - não simulado: Eletrifica inimigos quando eles são esfriados por ataques de habilidades reforçadas, aumentando o dano sofrido com base no efeito de esfriamento
  - não simulado: Esfria inimigos quando eles são eletrificados por ataques de habilidades reforçadas, reduzindo a velocidade de ação com base no efeito de eletrificação
- **Crystalfall_Support** (Cristal em Queda (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ativam Cristal em Queda ao atingir
- **Cull_the_Weak_Support** (Exterminar os Fracos (Reforço)) — parcial
  - não simulado: Mata inimigos de raridade normal e mágica com 47% de vida ou menos quando atingidos por habilidades reforçadas
  - não simulado: Recupera 2% de Vida quando Habilidades Suportadas Matam um Inimigo
- **Culling_Strike_Support** (Golpe Abatedor) — parcial
  - não simulado: Mata Inimigos com 10% de Vida ou menos quando Acertado por Habilidades Suportadas
  - não simulado: Recupera 2% de Vida quando Habilidades Suportadas Matam um Inimigo
- **Cursed_Ground_Support** (Solo Maldito) — parcial
  - não simulado: Habilidades suportadas criam Solo Maldito com uma Duração base de 34 segundos Feitiços de Habilidades Suportadas não tem Duração Inimigos em Solo Maldito das Habilidades Suportadas são Amaldiçoados com tal Feitiço Limite de 1 área de Solo Maldito
  - não simulado: Efeito em Área de Habilidades Maldição Suportadas aumentado em 10%
- **Decay_Support** (Decadência) — parcial
  - não simulado: Habilidades Suportadas infligem Podridão ao Acertar, causando 1230 de Dano de Caos por segundo durante 8 segundos
- **Devour_Support** (Devorar) — parcial
  - não simulado: Golpes Abatedores com Habilidades Suportadas Consomem cadáveres para Recuperar 366 de Vida e 40 de Mana
- **Divine_Blessing_Support** (Bênção Divina) — parcial
  - não simulado: Habilidades Suportadas Custam +233 de Mana
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção Você só pode ter uma Aura de suas Habilidades Bênção
  - não simulado: Auras das Habilidades Suportadas têm uma duração base de 10.9 segundos
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção\nVocê só pode ter uma Aura de suas Habilidades Bênção
- **Divine_Sentinel_Support** (Sentinela Divina (Reforço)) — sem efeito
  - esses lacaios especiais ainda não existem no jogo
- **Earthbreaker_Support** (Devastador) — parcial
  - não simulado: perto do totem, você ganha Área de Efeito aumentada para Habilidades Corpo a Corpo (a descrição; o valor — ancestor_totem_grants_owner_area_of_effect_+%_with_melee_skills — não está nos dados do PoB)
- **Eclipse_Support** (Eclipse (Reforço)) — parcial
  - não simulado: +38% de Qualidade das Gemas de Habilidade Suportadas
- **Efficacy_Support** (Eficácia) — parcial
  - não simulado: Habilidades Suportadas têm 24% de Duração de Efeito da Habilidade aumentada
- **Eldritch_Blasphemy_Support** (Blasfêmia Sobrenatural (Reforço)) — parcial
  - não simulado: Efeito em Área de Habilidades Maldição Suportadas aumentado em 122%
  - não simulado: Inimigos sofrem de Insanidade Perversa se estiverem sob a influência de auras de habilidades reforçadas por mais de 5 segundos
  - não simulado: Efeito em Área de Habilidades Maldição Suportadas aumentado em 20%
- **Elemental_Army_Support** (Resistências Elementais de Lacaios e Totens) — parcial
  - não simulado: Lacaios de Habilidades Suportadas têm +29% de todas as Resistências Elementais
  - não simulado: Lacaios de Habilidades Suportadas têm 2% ao máximo de todas as Resistências Elementais
  - não simulado: Lacaios de Habilidades Suportadas infligem Exposição no Acerto, aplicando -10% à Resistência Elemental que combine com o maior tipo de Dano sofrido pelo Inimigo
  - não simulado: Lacaios de Habilidades Suportadas têm +2% ao máximo de todas as Resistências Elementais
- **Elemental_Proliferation_Support** (Proliferação Elemental) — parcial
  - não simulado: Afecções Elementais infligidas por Habilidades Suportadas se espalham para outros inimigos dentro de 1.5 metros
- **Endurance_Charge_on_Melee_Stun_Support** (Carga de Tolerância ao Atordoar Corpo a Corpo) — parcial
  - não simulado: 4% mais Dano por Carga de Tolerância
  - não simulado: Receba uma Carga de Tolerância quando você Atordoar um Inimigo com um Acerto Corpo a Corpo com Habilidades Suportadas
  - não simulado: Habilidades Suportadas têm 20% de Duração de Atordoamentos em Inimigos aumentada
- **Energy_Leech_Support** (Dreno de Energia) — parcial
  - não simulado: Habilidades Suportadas tem 1.9% do Dano Drenado como Escudo de Energia
- **Enhance_Support** (Melhorar) — parcial
  - não simulado: 72% de Qualidade das Gemas de Habilidade Suportadas
- **Eternal_Blessing_Support** (Bênção Eterna) — parcial
  - não simulado: Habilidades Suportadas não tem Reserva
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção Você só pode ter uma Aura de suas Habilidades Bênção
  - não simulado: Suas Habilidades Não-Bênção que Reservam Mana são Desabilitadas enquanto você tiver uma Aura da Habilidade Suportada em você
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção\nVocê só pode ter uma Aura de suas Habilidades Bênção
- **Excommunicate_Support** (Excomungar (Reforço)) — parcial
  - não simulado: Habilidades reforçadas excomungam os inimigos ao atingir corpo a corpo por 3 segundos
- **Exemplar_Support** (Exemplar (Reforço)) — parcial
  - não simulado: Lacaios de habilidades reforçadas têm a chance de causar golpe crítico aumentada em 40% toda vez que você causar um golpe crítico recentemente com um ataque, até 200%
  - não simulado: Lacaios de habilidades reforçadas têm +20% de multiplicador de golpe crítico toda vez que você causar um golpe crítico recentemente com um ataque, até +100%
  - não simulado: Lacaios de Habilidades Suportadas têm Chance de Golpe Crítico aumentada em 20%
- **Expert_Retaliation_Support** (Perito em Retaliação) — parcial
  - não simulado: Habilidades de Retaliação Suportadas se tornam Utilizáveis por um tempo 39% maior
- **Faster_Projectiles_Support** (Projéteis Rápidos) — parcial
  - não simulado: Habilidades Suportadas têm 69% de Velocidade de Projétil aumentada
  - não simulado: Habilidades Suportadas têm 10% de Velocidade de Projétil aumentada
- **Feeding_Frenzy_Support** (Frenesi Faminto) — parcial
  - não simulado: Duração Base do Frenesi Faminto é de 5.9 segundos
  - não simulado: Lacaios de Habilidades Suportadas tem 44% de chance de conceder Frenesi Faminto à você no Acerto
  - não simulado: Lacaios de Habilidades Suportadas são Agressivos
  - não simulado: Habilidades Suportadas têm 10% de Velocidade de Movimento de Lacaios aumentada
- **Fissure_Support** (Fenda (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ativam uma fenda no impacto da pancada
  - não simulado: Habilidades Suportadas só podem ser usadas com Machados, Maças, Cetros ou Cajados
  - não simulado: 60% do Dano Físico Convertido para Dano de Fogo
  - não simulado: Cria 3 fendas
  - não simulado: Cria +1 fendas
- **Flamewood_Support** (Chuva Ardente) — parcial
  - não simulado: Totens das Habilidades Suportadas ganham a Habilidade Vingança Flamejante e a Ativa quando Acertado por um Inimigo
  - não simulado: Causa Dano de Fogo base igual a 137% da Vida Máxima dos Totens
  - não simulado: Totens com esta Habilidade a Ativam quando Acertados por um Inimigo
  - não simulado: Totens das Habilidades Suportadas ganham a Habilidade\nVingança Flamejante e a Ativa quando Acertado por um Inimigo
- **Fortify_Support** (Fortificar) — parcial
  - não simulado: Habilidades Suportadas têm Duração da Fortificação aumentada em 20%
- **Foulgrasp_Support** (Constrição Pérfida (Reforço)) — parcial
  - não simulado: Habilidades reforçadas podem conjurar 2 glifos adicionais
  - não simulado: Glifos reforçados ativam Constrição Pérfida ao serem recuperados
  - não simulado: Causa 481 a 4331 de Dano de Raio
  - não simulado: Máximo de 30 mãos
  - não simulado: Cria 2 mãos por glifo
  - não simulado: Cria 2 mãos adicionais
- **Fresh_Meat_Support** (Carne Fresca) — parcial
  - não simulado: Lacaios criados por Habilidades Suportadas ganham Fúria Desperta e Adrenalina por 10% de sua Duração, máximo de 10 segundos Fúria Desperta concede +3.9% de Chance de Golpe Crítico Fúria Desperta concede +69% de Multiplicador de Golpe Crítico
  - não simulado: Lacaios de Habilidades Suportadas têm Chance de Golpe Crítico aumentada em 20%
- **Frigid_Bond_Support** (Vínculo Frígido) — parcial
  - não simulado: Habilidades Suportadas Causam Dano e Resfriam Inimigos entre você e Alvos Vinculados
  - não simulado: Habilidades Suportadas causam 4335.8 Dano Base de Gelo por segundo
  - não simulado: Dano e Resfriamentos Perduram por uma Duração Base de 3 segundos
  - não simulado: Modificadores ao Dano Mágico são aplicados ao efeito de Dano Degenerativo das Habilidades Suportadas
  - não simulado: Dano e Resfriamentos Perduram por uma Duração Base de +2 segundos
- **Frostmage_Support** (Mago do Gelo (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ganham dano de frio adicionado equivalente a 39% do mana máximo reservado
  - não simulado: Habilidades reforçadas ganham custo de mana base equivalente a 5% do mana máximo reservado
- **Gluttony_Support** (Gula (Reforço)) — parcial
  - não simulado: Ganha 1 de Gula ao conjurar magias reforçadas
  - não simulado: Ao atingir 10 de Gula, perde toda a Gula e ganha Regurgitação por 4 segundos
  - não simulado: Enquanto você tiver Regurgitação, as magias reforçadas disparam projéteis em círculo Enquanto você tiver Regurgitação, as magias reforçadas disparam 13 projéteis adicionais
- **Greater_Ancestral_Call_Support** (Convocação Ancestral Maior (Reforço)) — parcial
  - não simulado: Alvos Extras das Habilidades Suportadas podem ser encontrados 105% mais distânte
- **Greater_Chain_Support** (Propagação Maior (Reforço)) — parcial
  - não simulado: Habilidades reforçadas se propagam 50% mais vezes
- **Greater_Devour_Support** (Devorar Maior (Reforço)) — parcial
  - não simulado: Golpes Abatedores com Habilidades Suportadas Consomem cadáveres para Recuperar 757 de Vida e 74 de Mana
  - não simulado: Consumir um cadáver com habilidades reforçadas tem 10.5% de chance de conceder uma alma por poder
  - não simulado: Consumir um cadáver com habilidades reforçadas tem +1% de chance de conceder uma alma por poder
- **Greater_Fork_Support** (Ramificação Maior (Reforço)) — parcial
  - não simulado: Projéteis das Habilidades Suportadas podem Difundir 1 Vezes adicionais
  - não simulado: Projéteis de Habilidades Suportadas têm 100% de chance de ganhar um Projétil adicional ao Difundirem
- **Greater_Kinetic_Instability_Support** (Instabilidade Cinética Maior (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ativam Fluxo Cinético ao causar golpe crítico
  - não simulado: Máximo de 20 anomalias
  - não simulado: Esta habilidade é ativada por habilidades reforçadas de Instabilidade Cinética
- **Greater_Spell_Cascade_Support** (Sequência Mágica Maior (Reforço)) — parcial
  - não simulado: Habilidades de Efeito em Área Suportadas também afetam áreas na frente, atrás, e dos lados da área alvo
  - não simulado: Habilidades de Efeito em Área Suportadas também afetam áreas na frente, atrás,\ne dos lados da área alvo
- **Greater_Volley_Support** (Grande Rajada) — parcial
  - não simulado: Habilidades Suportadas também disparam Projéteis de até 4 pontos de cada lado seu
- **Guardians_Blessing_Support** (Bênção do Guardião) — parcial
  - não simulado: Habilidades Suportadas têm Efeito das Auras reduzido em 27%
  - não simulado: Habilidades de Aura Suportadas não tem Reserva
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção Você só pode ter uma Aura de suas Habilidades Bênção
  - não simulado: Habilidades Suportadas não podem aplicar Auras em você a menos que você tenha Lacaios de uma Habilidade Suportada
  - não simulado: Lacaios das Habilidades Suportadas sofrem 14.3% de sua Vida e Escudo de Energia Máximos total como Dano Físico por segundo enquanto você tiver uma Aura de uma Habilidade Suportada em você
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção\nVocê só pode ter uma Aura de suas Habilidades Bênção
- **Hallow_Support** (Santificação (Reforço)) — parcial
  - não simulado: Intensidade de Chama Santificada infligida por habilidades reforçadas aumentada em 36%
  - não simulado: Habilidades reforçadas infligem Chama Santificada ao atingir corpo a corpo
  - não simulado: Intensidade de Chama Santificada infligida por habilidades reforçadas aumentada em 10%
- **Hex_Bloom_Support** (Propagar Feitiço) — parcial
  - não simulado: Habilidades Suportadas têm alcance de Transferência de Feitiços aumentado em 28%
  - não simulado: Feitiços de Habilidades Suportadas se Transferem para todos os Inimigos dentro de 3 metros quando o Inimigo Enfeitiçado morrer
  - não simulado: Habilidades Suportadas têm alcance de Transferência de Feitiços aumentado em 4%
- **Hexpass_Support** (Passe Enfeitiçado (Reforço)) — parcial
  - não simulado: Feitiços aplicados por habilidades de maldição reforçadas afetam inimigos imunes a feitiços
  - não simulado: Efeito em Área de Habilidades Maldição Suportadas reduzido em 12%
  - não simulado: Inimigos afetados por feitiços de habilidades de maldição reforçadas não podem causar golpes críticos
- **Hextoad_Support** (Sapo Enfeitiçado (Reforço)) — parcial
  - não simulado: Habilidades suportadas criam Solo Maldito com uma Duração base de 27 segundos Feitiços de Habilidades Suportadas não tem Duração Inimigos em Solo Maldito das Habilidades Suportadas são Amaldiçoados com tal Feitiço Limite de 1 área de Solo Maldito
  - não simulado: Chão amaldiçoado de habilidades reforçadas ativam Sapo Explosivo a cada 0.7 segundo
  - não simulado: Causa 7124 a 10687 de Dano de Caos
  - não simulado: Inflige Definhando por 2 segundos ao Acertar
  - não simulado: Efeito em Área de Habilidades Maldição Suportadas aumentado em 10%
- **Hextouch_Support** (Toque Maldito) — parcial
  - não simulado: Habilidades Suportadas aplicam Maldições Suportadas em Acertos
  - não simulado: Você não pode Conjurar Magias Maldição Suportadas
- **High-Impact_Mine_Support** (Mina de Alto Impacto) — parcial
  - não simulado: Habilidades Suportadas ganham uma Reserva Base igual ao Custo Base de Mana e Vida
  - não simulado: Cada Mina das Habilidades Suportadas aplicadas 2% de chance de causar Dano Dobrado aos Acertos contra Inimigos próximos a ele, até um máximo de 100%
- **Hiveborn_Support** (Nascido da Colmeia (Reforço)) — parcial
  - não simulado: Oferendas reforçadas ativam Invocar Nascidos da Colmeia ao usar
  - não simulado: Máximo de 12 Nascido(s) da Colmeia
  - não simulado: Invoca 11 Nascido(s) da Colmeia
  - não simulado: Lacaios têm 20% de chance de cobrir os inimigos de gelo ao atingir
  - não simulado: Máximo de 2 Nascido(s) da Colmeia
- **Hypothermia_Support** (Hipotermia) — parcial
  - não simulado: Habilidades Suportadas têm +20% de chance de Congelar Inimigos Resfriados
  - não simulado: Habilidades Suportadas têm +20% de chance de Congelar Inimigos Resfriados
- **Ice_Bite_Support** (Mordida Congelante) — parcial
  - não simulado: Habilidades Suportadas têm 69% de chance de ganhar uma Carga de Frenesi ao Matar um Inimigo Congelado
- **Ignite_Proliferation_Support** (Proliferação de Incêndio) — parcial
  - não simulado: Incêndios causados por Habilidades Suportadas se espalham para outros Inimigos dentro de 2 metros
- **Impale_Support** (Empalar) — parcial
  - não simulado: Ataques Suportados tem 60% de chance de Empalar Inimigos ao Acertar
  - não simulado: Ataques Suportados tem o Efeito de Empalamento aumentdo em 28%
  - não simulado: Ataques Suportados tem o Efeito de Empalamento aumentdo em 10%
- **Impending_Doom_Support** (Destruição Iminente) — parcial
  - não simulado: Ativa Explosão Destruidora quando um Feitiço de Habilidades Maldição Suportadas terminar
  - não simulado: Causa 1654 a 2481 de Dano de Caos
  - não simulado: Ativa Esta Habilidade quando um Feitiço de Habilidades Suportadas terminar
- **Infernal_Legion_Support** (Legião Infernal) — parcial
  - não simulado: Lacaios de Habilidades Suportadas sofrem 40% de sua Vida Máxima como Dano de Fogo por segundo
  - não simulado: Lacaios de Habilidades Suportadas causam 2468.6 de Dano de Fogo por segundo aos Inimigos próximos a eles
  - não simulado: Lacaios das Habilidades Suportadas têm 0.5 metros ao Raio de seu Efeito Incendiário
- **Innervate_Support** (Inervação) — parcial
  - não simulado: Ganha Invervação ao Matar um Inimigo Eletrizado com Habilidades Suportadas
  - não simulado: Invervação concede 8 a 145 de Dano de Raio
  - não simulado: Estímulo dura 8 segundos
  - não simulado: Inervação dura 2 segundos
- **Inspiration_Support** (Inspiração) — parcial
  - não simulado: Ganha uma Carga de Inspiração ao Gastar Mana em Custos Diretos ou Efeitos das Habilidades Suportadas
  - não simulado: Habilidades Suportadas tem Chance de Golpe Crítico aumentada em 8% por Carga de Inspiração
  - não simulado: Perca todas as Cargas de Inspiração após Gastar um total de 800 de Mana em Custos Diretos e Efeitos das Habilidades Suportadas
  - não simulado: Ganha uma Carga de Inspiração ao Gastar Mana em\nCustos Diretos ou Efeitos das Habilidades Suportadas
- **Invention_Support** (Invenção (Reforço)) — parcial
  - não simulado: Habilidades Suportadas têm Duração da Armadilha aumentada em 20% Habilidades reforçadas têm a duração de mina aumentada em 20%
- **Invert_the_Rules_Support** (Inversão de Regras (Reforço)) — parcial
  - não simulado: Ataques de habilidades reforçadas têm 60% de chance de considerar os valores de resistência elemental dos monstros inimigos como invertidos
- **Iron_Grip_Support** (Empunhadura de Ferro) — parcial
  - não simulado: Bônus de Dano da Força é aplicado ao Dano de Ataque dos Projéteis assim como às Habilidades Suportadas
- **Iron_Will_Support** (Vontade de Ferro) — parcial
  - não simulado: Bônus de dano da Força também é aplicado à todo Dano Mágico para Magias Suportadas
- **Item_Rarity_Support** (Raridade de Itens) — sem efeito
  - não simulado: Raridade de Itens Derrubados por Inimigos Mortos por Habilidades Suportadas aumentada em 59%
  - não simulado: Raridade de Itens Derrubados por Inimigos Mortos por Habilidades Suportadas aumentada em 10%
  - nenhuma linha do suporte tem efeito no jogo ainda
- **Kinetic_Instability_Support** (Reforço Instabilidade Cinética) — parcial
  - não simulado: Habilidades reforçadas ativam Fluxo Cinético no golpe fatal
  - não simulado: Máximo de 20 anomalias
  - não simulado: Esta habilidade é ativada por habilidades reforçadas de Instabilidade Cinética
- **Lethal_Dose_Support** (Dose Letal (Reforço)) — parcial
  - não simulado: Envenenar inimigos não envenenados com habilidades reforçadas inflige 2 envenenamentos adicionais
- **Life_Leech_Support** (Dreno de Vida) — parcial
  - não simulado: Habilidades Suportadas têm 3.9% de Dano Drenado como Vida
- **Lifetap_Support** (Fonte de Vida) — parcial
  - não simulado: Ganha Fonte de Vida após Gastar um total de 273 de Vida no Custo Direto e Efeitos das Habilidades Suportadas
  - não simulado: Fonte de Vida dura 4 segundos
  - não simulado: Fonte de Vida dura +2 segundos
- **Living_Lightning_Support** (Reforço Relâmpago Vivo) — parcial
  - não simulado: Ativa Invocar Relâmpago Vivo quando uma habilidade de reforço causa dano elétrico com o acerto
  - não simulado: Lacaios convertem 100% do Dano Físico para Dano de Raio
  - não simulado: Máximo de 8 Lacaios Relâmpagos Vivos
  - não simulado: Invoca 1 Lacaios Relâmpagos Vivos
  - não simulado: Lacaios Relâmpagos Vivos atacam 3 vezes antes de desaparecerem
  - não simulado: Esta habilidade é ativada quando uma habilidade de reforço causa dano elétrico com o acerto
  - não simulado: Ativa Invocar Relâmpago Vivo quando uma habilidade\nde reforço causa dano elétrico com o acerto
  - não simulado: Lacaios Relâmpagos Vivos atacam +2 vezes antes de desaparecerem
- **Locus_Mine_Support** (Mina Local) — parcial
  - não simulado: Habilidades Suportadas sempre disparam ao menos 1 Projétil
  - não simulado: Habilidades Suportadas disparam 30% menos Projéteis
  - não simulado: Habilidades Suportadas ganham uma Reserva Base igual ao Custo Base de Mana e Vida
  - não simulado: Minas de Habilidades Suportadas não podem ser Detonadas enquanto dentro de 3 metros de você
  - não simulado: Minas usando Habilidades Suportadas sempre focam na sua localização
  - não simulado: Habilidades Suportadas arremessam Minas em um Arco
- **Machinations_Support** (Maquinações (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ganham 14% do dano físico como dano de caos adicional por fundamental
  - não simulado: Habilidades reforçadas têm o custo aumentado em 10% por fundamental
- **Maim_Support** (Mutilação) — parcial
  - não simulado: Habilidades Suportadas têm Efeito da Mutilação aumentado em 20%
- **Manaforged_Arrows_Support** (Flecha Forjada com Mana) — parcial
  - não simulado: Habilidades Suportadas causam 1% mais Dano com Acertos e Afecções por cada 1 de Custo de Mana
  - não simulado: Habilidades Suportadas Ativam uma vez que o Custo de Mana total em outros Ataques de Arco excederem 300% do seu Custo de Mana
  - não simulado: Habilidades Suportadas Ativam uma vez que o Custo de Mana total em outros Ataques\nde Arco excederem 300% do seu Custo de Mana
- **Mark_On_Hit_Support** (Marcar ao Acertar) — parcial
  - não simulado: Efeito das Marcas de Habilidades Suportadas reduzido em 21%
  - não simulado: Ativa a Habilidade Suportada quando você Acertar um Inimigo Raro ou Único com um Ataque
  - não simulado: Efeito das Marcas de Habilidades Suportadas aumentado em 5%
- **Meat_Shield_Support** (Escudo de Carne) — parcial
  - não simulado: Lacaios de Habilidades Suportadas tem 20% de chance de Provocar ao Acertar
  - não simulado: Habilidades Suportadas têm 29% de Velocidade de Movimento de Lacaios aumentada
  - não simulado: Lacaios de Habilidades Suportadas sofrem 24% menos Dano
  - não simulado: Lacaios de Habilidades Suportadas são Defensivos
  - não simulado: Lacaios de Habilidades Suportadas sofrem 5% menos Dano
- **Minefield_Support** (Campo Minado) — parcial
  - não simulado: Habilidades Suportadas podem ter até 3 Minas Remotas adicionais plantadas de uma vez
- **Minion_Speed_Support** (Velocidade do Lacaio) — parcial
  - não simulado: Habilidades Suportadas têm 34% de Velocidade de Ataque de Lacaios aumentada
  - não simulado: Habilidades Suportadas têm 34% de Velocidade de Conjuração de Lacaios aumentada
  - não simulado: Habilidades Suportadas têm 44% de Velocidade de Movimento de Lacaios aumentada
  - não simulado: Habilidades Suportadas têm 10% de Velocidade de Movimento de Lacaios aumentada
- **Mirage_Archer_Support** (Arqueiro Ilusório) — parcial
  - não simulado: Máximo de 1 Arqueiro Ilusório Convocado
  - não simulado: Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade Arqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados
  - não simulado: Arqueiro Ilusório utiliza Habilidades Suportadas com 60% menos Velocidade de Ataque
  - não simulado: Arqueiro Ilusório dura 4 segundos
  - não simulado: Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade\nArqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados
- **Multiple_Traps_Support** (Múltiplas Armadilhas) — parcial
  - não simulado: Habilidades Suportadas têm Efeito em Área da Ativação de Armadilhas aumentado em 20%
- **Overcharge_Support** (Sobrecarga) — parcial
  - não simulado: Habilidades Suportadas Eletrizam Inimigos como se causassem 690% mais Dano
  - não simulado: Habilidades Suportadas têm 20% de Duração de Eletrização aumentada em Inimigos
- **Overexertion_Support** (Esforço Excessivo) — parcial
  - não simulado: Ataques Suportados causam 10% mais Dano por cada Clamor que os Impelir
- **Overheat_Support** (Superaquecimento (Reforço)) — parcial
  - não simulado: Habilidades reforçadas consomem toda a Fortificação ao usar, causando +14% de dano com afecções por 3 de Fortificação consumida
- **Overloaded_Intensity_Support** (Intensidade Sobrecarregada (Reforço)) — parcial
  - não simulado: Ganha uma instância de Intensidade Sobrecarregada por 10 segundos após perder 6 de Intensidade com habilidades reforçadas
  - não simulado: Habilidades reforçadas têm +2.7% de chance de causar golpe crítico por Intensidade Sobrecarregada
  - não simulado: Habilidades reforçadas têm +82% de multiplicador de golpe crítico por Intensidade Sobrecarregada
  - não simulado: Ganha uma instância de Intensidade Sobrecarregada por 10 segundos após\nperder 6 de Intensidade com habilidades reforçadas
- **Pacifism_Support** (Pacifismo (Reforço)) — sem efeito
  - não simulado: Habilidades reforçadas têm 52% de chance de fazer os monstros fugirem ao atingir
  - não simulado: Ataques de habilidades reforçadas não podem matar inimigos
  - não simulado: Habilidades reforçadas têm +10% de chance de fazer os monstros fugirem ao atingir
  - nenhuma linha do suporte tem efeito no jogo ainda
- **Physical_to_Lightning_Support** (Físico para Raio) — parcial
  - não simulado: Habilidades Suportadas têm 50% de Dano Físico Convertido em Dano de Raio
- **Pierce_Support** (Atravessar) — parcial
  - não simulado: Projéteis de Habilidades Suportadas Atravessam 4 Alvos adicionais
- **Pinpoint_Support** (Localizar) — parcial
  - não simulado: Magias Suportadas ganham Intensidade quando você as Conjurar, máximo de 3 Habilidades Suportadas disparam um Projétil a menos por Intensidade
  - não simulado: Projéteis das Habilidades Suportadas causam 20% mais Dano com Acertos por Intensidade
  - não simulado: Habilidades Suportadas sempre disparam ao menos 1 Projétil
  - não simulado: Magias Suportadas ganham Intensidade quando você as Conjurar, máximo de 3\nHabilidades Suportadas disparam um Projétil a menos por Intensidade
- **Power_Charge_On_Critical_Support** (Carga de Poder no Crítico) — parcial
  - não simulado: Habilidades Suportadas têm 54% de chance de ganhar uma Carga de Poder com Golpes Críticos
  - não simulado: Habilidades Suportadas têm 10% de chance de ganhar uma Carga de Poder com Golpes Críticos
- **Predator_Support** (Predador) — parcial
  - não simulado: Lacaios de Habilidades Suportadas sempre focam em Presas se possível
- **Prismatic_Burst_Support** (Explosão Prismática) — parcial
  - não simulado: Habilidades Suportadas Ativam Explosão Prismática ao Acertar
  - não simulado: Causa 1224 a 1836 de Dano de Gelo
  - não simulado: Causa 153 a 2907 de Dano de Raio
  - não simulado: Causa 1224 a 1836 de Dano de Fogo
  - não simulado: 0.9 metros de raio
- **Pyre_Support** (Pira (Reforço)) — parcial
  - não simulado: Habilidades reforçadas têm 50% de chance de ativar Chamado da Fogueira ao atingir inimigos incendiados corpo a corpo
  - não simulado: 100% do Dano Físico Convertido para Dano de Fogo
  - não simulado: Cobre Inimigos em Cinzas ao Acertar
  - não simulado: Cria 7 Pilares de Cinzas
  - não simulado: Cria +1 Pilar de Cinzas
- **Returning_Projectiles_Support** (Projéteis Retornados) — parcial
  - não simulado: Projéteis de Habilidades Suportadas Retornam a você
  - não simulado: Projéteis de Habilidades Suportadas causam 66% menos Dano com Acertos e Afecções enquanto Retornam
  - não simulado: Projéteis de Habilidades Suportadas Atravessam todos os Alvos enquanto Retornando
  - não simulado: Habilidades Suportadas têm 10% de Velocidade de Projétil aumentada
- **Rupture_Support** (Rompimento) — parcial
  - não simulado: Golpes Críticos com Habilidades Suportadas que infligirem Sangramento também infligem Rompimento
  - não simulado: Alvos sofrem 29% mais Dano do Sangramento por Rompimento das Habilidades Suportadas neles
  - não simulado: Sangramento expira 25% mais rápido por Rompimento das Habilidades Suportadas nos alvos
- **Sacred_Wisps_Support** (Espíritos Sagrados) — parcial
  - não simulado: Habilidades Suportadas Ativarão Convocar Espíritos Sagrados ao Acertar
  - não simulado: Habilidades Suportadas só podem ser usadas com Varinhas
  - não simulado: Convoca 2 Espíritos Sagrados Máximo de 2 Espíritos Sagrados
  - não simulado: Espíritos Sagrados têm 25% de chance de usar a Habilidade Ativadora quando voc6e disparar um Projétil com tal Habilidade
  - não simulado: Espíritos Sagrados têm +25% de chance de usar a Habilidade Ativadora quando você disparar um Projétil com tal habilidade enquanto um Inimigo Raro ou Único estiver em sua Presença
  - não simulado: Convoca 2 Espíritos Sagrados\nMáximo de 2 Espíritos Sagrados
  - não simulado: Espíritos Sagrados têm 25% de chance de usar a Habilidade Ativadora quando voc6e disparar um\nProjétil com tal Habilidade
- **Sacrifice_Support** (Sacrificar) — parcial
  - não simulado: Magias Suportadas Sacrificam 20% da sua Vida atual quando Conjuradas para ganhar Dano de Caos adicional igual a 54% da Vida Sacrificada
- **Scornful_Herald_Support** (Arauto Desdenhoso (Reforço)) — parcial
  - não simulado: Habilidades de arauto reforçadas não têm efeito bônus
- **Second_Wind_Support** (Segunda Ventania) — parcial
  - não simulado: Habilidades Suportadas têm Velocidade de Recuperação da Recarga reduzida em 5%
  - não simulado: Habilidades Não-Instantâneas Suportadas têm +1 Usos de Tempo do Recarga
- **Shockwave_Support** (Onda de Choque) — parcial
  - não simulado: Habilidades Suportadas Ativam Onda de Choque no Acerto Corpo a Corpo
  - não simulado: Habilidades Suportadas só podem ser usadas com Maças, Cetros ou Cajados
- **Slower_Projectiles_Support** (Projéteis Lentos) — parcial
  - não simulado: Habilidades Suportadas têm 30% menos Velocidade de Projétil
- **Spell_Cascade_Support** (Cascata Mágica) — parcial
  - não simulado: Habilidades de Efeito em Área Suportadas também afetam áreas na frente e atrás da área alvo
- **Spellblade_Support** (Lâmina Mágica) — parcial
  - não simulado: Habilidades Suportadas têm Dano Mágico Adicional igual a 135% doDano das Armas Corpo a Corpo de Uma Mão Equipadas Se duas Armas forem Equipadas, cada uma contribuindo com 60% da quantidade de Dano Adicional
- **Swiftbrand_Support** (Runa Repentina) — parcial
  - não simulado: Habilidades Suportadas têm 44% mais frequência de Ativação
  - não simulado: Habilidades Suportadas têm 5% mais frequência de Ativação
- **Transfusion_Support** (Transfusão (Reforço)) — parcial
  - não simulado: Um lacaio próximo ganha uma alma para cada 200 de vida que você gasta em custos iniciais com magias reforçadas
  - não simulado: Um lacaio próximo ganha uma alma para cada 200 de vida que você gasta em custos\niniciais com magias reforçadas
  - não simulado: Habilidades Suportadas têm Custo de Vida aumentado em 10%
- **Trauma_Support** (Traumatismo) — parcial
  - não simulado: Habilidades Suportadas têm 10 a 17 de Dano de Ataque Físico Adicional por Traumatismo
  - não simulado: Habilidades Suportadas têm Duração do Atordoamento aumentada em 5% por Traumatismo
  - não simulado: Ganha 1 Traumatismo na primeira vez que um Ataque Suportado Acertar um Inimigo Sofre 146 de Dano Físico por Traumatismo quando você ganhar Traumatismo das Habilidades Suportadas Traumatismos duram 6.9 segundos
  - não simulado: Habilidades Suportadas só podem ser usadas com Machados, Maças, Cetros ou Cajados
- **Trinity_Support** (Suporte Trindade) — parcial
  - não simulado: Acertos com Habilidades Suportadas para o qual o maior Tipo de Dano for Elemental fazem com que você ganhe 25 de Ressonância de outros Elementos por 2 segundos Perde 5 de Ressonância por segundo para cada Elemento que não estiver ganhando
  - não simulado: Habilidades Suportadas causam 3% mais Dano Elemental por cada 5 da sua menor Ressonância
  - não simulado: Habilidades Suportadas penetram 16% da Resistência Elemental enquanto cada Ressonância estiver em ao menos 25
  - não simulado: Acertos com Habilidades Suportadas para o qual o maior Tipo de Dano for Elemental fazem com que você ganhe 25 de Ressonância de outros Elementos por 2 segundos\nPerde 5 de Ressonância por segundo para cada Elemento que não estiver ganhando
- **Unholy_Trinity_Support** (Tríade Profana (Reforço)) — parcial
  - não simulado: Ataques com habilidades reforçadas, cujo maior tipo de dano é caos, elétrico ou físico, fazem você ganhar 25 de Ressonância Profana dos outros tipos por segundo durante 2 segundos Perde 5 de Ressonância Profana por segundo para cada tipo que não ganhar
  - não simulado: Habilidades reforçadas têm 100% de chance de ignorar a resistência a dano de caos e elétrico do inimigo, se cada Ressonância Profana for de, no mínimo, 25
  - não simulado: Habilidades reforçadas têm 100% de chance de ignorar a redução de dano físico do inimigo, se cada Ressonância Profana for de, no mínimo, 25
  - não simulado: Ataques com habilidades reforçadas, cujo maior tipo de dano é caos, elétrico ou físico, fazem você ganhar 25 de Ressonância Profana dos outros tipos por segundo durante 2 segundos\nPerde 5 de Ressonância Profana por segundo para cada tipo que não ganhar
- **Vaal_Sacrifice_Support** (Sacrifício Vaal (Reforço)) — parcial
  - não simulado: Habilidades reforçadas sacrificam tudo, menos 1, da sua vida e escudo de energia ao usar
- **Vaal_Temptation_Support** (Tentação Vaal (Reforço)) — parcial
  - não simulado: Usar habilidades vaal reforçadas inflige Tentação Vaal em você, causando 925 de dano físico por segundo, em vez de aplicar impedimento de ganho de almas
- **Void_Shockwave_Support** (Onda de Choque do Vazio (Reforço)) — parcial
  - não simulado: Habilidades Suportadas Ativam Onda de Choque no Acerto Corpo a Corpo
  - não simulado: Habilidades Suportadas só podem ser usadas com Machados, Maças, Cetros ou Cajados
  - não simulado: Onda de choque se repete de até 10 inimigos na área
  - não simulado: Repetições da onda de choque causam -50% de dano com ataques e afecções
- **Voidstorm_Support** (Tormenta do Vazio (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ativam Tormenta do Vazio ao atingir o chão Tormentas do Vazio não podem ser ativadas a menos de 3 metros de você
  - não simulado: Máximo de 3 tempestades
  - não simulado: Tempestades ganham um estágio por 0.2 segundos, até 10
  - não simulado: Tempestades têm +15% de área de efeito por estágio
  - não simulado: Explosão causa +40% de dano com ataques e afecções por estágio
  - não simulado: Habilidades reforçadas ativam Tormenta do Vazio ao atingir o chão\nTormentas do Vazio não podem ser ativadas a menos de 3 metros de você
- **Volley_Support** (Rajada) — parcial
  - não simulado: Habilidades Suportadas também disparam Projéteis de até 2 pontos de cada lado seu
- **Windburst_Support** (Reforço Rajada de Vento) — parcial
  - não simulado: Ataques reforçados ativam Rajada de Vento ao atingir, limitado a uma vez a cada 10 metros percorridos
  - não simulado: Projéteis Perfuram todos Alvos
  - não simulado: Dispara 3 projéteis
  - não simulado: 40% mais Dano em Área
  - não simulado: Esta habilidade é ativada por habilidades de ataque reforçadas
- **Withering_Touch_Support** (Suporte Toque Definhador) — parcial
  - não simulado: Habilidades Suportadas possuem 25% de chance de causar Definhado ao Acertar
  - não simulado: Definhado dura 2 segundos
  - não simulado: Habilidades Suportadas recebem 29% de Dano Físico como Dano de Caos Extra

## Implementadas sem teste próprio

Added_Chaos_Damage_Support, Added_Cold_Damage_Support, Added_Lightning_Damage_Support, Arc_of_Oscillating, Autoexertion, Awakened_Added_Chaos_Damage_Support, Awakened_Added_Cold_Damage_Support, Awakened_Added_Fire_Damage_Support, Awakened_Added_Lightning_Damage_Support, Awakened_Burning_Damage_Support, Awakened_Chain_Support, Awakened_Deadly_Ailments_Support, Awakened_Elemental_Focus_Support, Awakened_Empower_Support, Awakened_Enlighten_Support, Awakened_Generosity_Support, Awakened_Greater_Multiple_Projectiles_Support, Awakened_Increased_Area_of_Effect_Support, Awakened_Melee_Splash_Support, Awakened_Minion_Damage_Support, Awakened_Multistrike_Support, Awakened_Swift_Affliction_Support, Awakened_Unbound_Ailments_Support, Awakened_Unleash_Support, Awakened_Vicious_Projectiles_Support, Ball_Lightning, Ball_Lightning_of_Static, Barrage_Support, Battlemages_Cry, Blade_Blast, Blade_Trap_of_Greatswords, Blazing_Salvo, Bloodlust_Support, Brutality_Support, Cast_on_Melee_Kill_Support, Caustic_Arrow_of_Poison, Cold_Penetration_Support, Conductivity, Cooldown_Recovery_Support, Damage_on_Full_Life_Support, Detonate_Dead_of_Chain_Reaction, Elemental_Damage_with_Attacks_Support, Elemental_Penetration_Support, Elemental_Weakness, Enlighten_Support, Ethereal_Knives_of_the_Massacre, Firestorm_of_Meteors, Flameblast_of_Celerity, Flameblast_of_Contraction, Fork_Support, Frost_Bomb_of_Instability, Frozen_Legion, Frozen_Legion_of_Rallying, Galvanic_Arrow_of_Energy, Generals_Cry, Glacial_Hammer_of_Shattering, Greater_Multistrike_Support, Greater_Spell_Echo_Support, Greater_Unleash_Support, Ice_Nova_of_Deep_Freeze, Icicle_Mine_of_Fanning, Immolate_Support, Increased_Critical_Damage_Support, Increased_Critical_Strikes_Support, Kinetic_Rain, Lacerate_of_Haemorrhage, Less_Duration_Support, Lightning_Penetration_Support, Lightning_Spire_Trap_of_Overloading, Lightning_Strike, Lightning_Strike_of_Arcing, Mana_Leech_Support, Minion_Life_Support, More_Duration_Support, Pact_of_Ghorr, Pact_of_Lycia, Point_Blank_Support, Pulverise_Support, Puncture_of_Shanking, Purity_of_Ice, Purity_of_Lightning, Rain_of_Arrows, Rain_of_Arrows_of_Artillery, Rain_of_Arrows_of_Saturation, Spark_of_Unpredictability, Spark_of_the_Nova, Storm_Call_of_Trarthus, Stun_Support, Swift_Affliction_Support, Thunderstorm, Vaal_Arc, Vaal_Burning_Arrow, Vaal_Caustic_Arrow, Vaal_Haste, Vaal_Lightning_Strike, Vitality, Void_Manipulation_Support, Volatile_Dead_of_Confinement, Volcanic_Fissure, Wave_of_Conviction_of_Trarthus
