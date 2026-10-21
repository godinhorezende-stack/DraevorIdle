# Gemas do PoE: estado da implementação

Gerado por `ITENS_POE=1 node tools/relatorio-gemas-poe.mjs` a partir do código (status no jogo de `itens-poe/gemas-poe.mjs` e `itens-poe/suportes-poe.mjs`), dos ícones em `gamedata/itens-poe/`, da compatibilidade (`suportes-compat.json`) e dos testes que citam cada gema. Nada é classificado à mão. **"Testada" quer dizer que algum teste cita a gema** — não que todas as linhas dela tenham teste.

## Totais

### Gemas de habilidade (562; ataques: 210)

| Estado | Gemas | 
|---|---|
| implementada e testada | 263 |
| implementada, sem teste próprio | 48 |
| limitação do modelo idle | 11 |
| parcial | 239 |
| não se aplica | 1 |

Só os ataques:

| Estado | Gemas |
|---|---|
| implementada e testada | 125 |
| implementada, sem teste próprio | 19 |
| limitação do modelo idle | 6 |
| parcial | 60 |

### Gemas de suporte (262)

| Estado | Gemas |
|---|---|
| implementada e testada | 102 |
| implementada, sem teste próprio | 51 |
| parcial | 109 |

### Variantes

- Vaal (52): implementada e testada 23 · parcial 23 · implementada, sem teste próprio 6
- Alternativas (209): implementada e testada 88 · implementada, sem teste próprio 25 · parcial 89 · limitação do modelo idle 7

### Compatibilidade, efeitos compartilhados, imagens, testes

- Compatibilidade: 562 ativas e 260 suportes com regra; 58049 pares compatíveis; sem regra: 0 ativas, 2 suportes (Inspiration_Support, Pacifism_Support).
- Efeitos compartilhados faltando: 629 linhas distintas (109 em duas ou mais gemas).
- Imagens: 562/562 ativas com ícone da gema, 562/562 com ícone da habilidade, 262/262 suportes; 0 desenhos repetidos entre gemas de bases diferentes.
- Catálogo do poedb (Skill_Gems + Support_Gems, pt): 824 gemas; faltam no jogo: nenhuma; só no jogo: nenhuma.
- Testes que citam a gema: 351/562 ativas, 119/262 suportes.
- Teste geral (`testes/gemas-todas-funcionam-poe.test.mjs`): toda ativa `funciona` é usada de verdade numa caçada e precisa causar dano no alvo (ou ligar o buff); todo suporte `funciona` precisa de efeito sem linha não feita, e cada chave do efeito precisa ser lida pelo código do jogo. "Sem teste próprio" quer dizer que só esse teste geral cobre a gema.

## Linhas que faltam (por quantidade de gemas)

| Gemas | Linha |
|---|---|
| 16 | nenhum efeito do buff tem equivalente no jogo |
| 12 | Lacaios têm Recuperação da Recarga aumentada em # % |
| 9 | Efeito do Buff aumentado em # % |
| 7 | sem dano direto: nenhum efeito no combate |
| 6 | # % de Chance de uma Armadilha ser Ativada uma vez adicional |
| 5 | Duração do Efeito de Habilidades aumentada em # % |
| 5 | Velocidade de Movimento reduzida em # % |
| 4 | +# ao Máximo de Armas Animadas |
| 4 | +# ao Máximo de Esqueletos Convocados |
| 4 | Debuff pode ter até # camadas de Dano |
| 4 | Efeito das Auras aumentado em # % |
| 4 | Habilidades Suportadas têm #% de Velocidade de Movimento de Lacaios aumentada |
| 4 | Velocidade de Movimento dos Lacaios aumentada em # % |
| 3 | # segundos adicionais de Duração Base por Cadáver extra consumido |
| 3 | Alvos Extras das Habilidades Suportadas podem ser encontrados #% mais distânte |
| 3 | as flechas caem em linha, cada uma com dano em área e um acerto só por inimigo (act_dex.lua:##; no jogo ainda são projéteis no alvo) |
| 3 | Cada Flecha pode disparar # Feixes |
| 3 | Causa +# % mais Dano por Carga Sangrenta |
| 3 | Cria # Estaca |
| 3 | Duração da penalidade base é de # segundos |
| 3 | Efeito da Oferenda aumentado em # % |
| 3 | Flecha dispara Raios a cada # segundos |
| 3 | Habilidades Suportadas ganham uma Reserva Base igual ao Custo Base de Mana e Vida |
| 3 | Habilidades Suportadas também contam como Habilidades Bênção Você só pode ter uma Aura de suas Habilidades Bênção |
| 3 | Habilidades Suportadas também contam como Habilidades Bênção\nVocê só pode ter uma Aura de suas Habilidades Bênção |
| 3 | Parede terá # metros |
| 3 | Velocidade de Projéteis aumentada em # % |
| 2 | # % de chance de Convocar um Sentinela da Absolvição ao Acertar um Inimigo Raro ou Único |
| 2 | # % de chance de invocar uma Sentinela da Dominação normal ao atingir um monstro raro ou único |
| 2 | # % de chance de remover um Feitiço após Causar Dano |
| 2 | # % do dano de ataques é absorvido pelo bônus antes de afetar sua vida ou seu escudo de Energia Bônus pode sofrer dano equivalente a # % da sua armadura, até # |
| 2 | # % mais Dano com Acertos se o Inimigo estiver Enfeitiçado |
| 2 | # % mais Dano com Afecções se o Inimigo estiver Enfeitiçado |
| 2 | # % mais Dano com Sangramento enquanto na Postura de Sangue |
| 2 | # % mais Velocidade de Ataque enquanto estiver em uma Tempestade de Lâminas Sangrentas |
| 2 | # % menos Dano em Área |
| 2 | # a # de Dano de Fogo adicionado contra Inimigos Queimando |
| 2 | # de largura do Efeito em Área |
| 2 | # segundos entre o aparecimento de seções da Parede |
| 2 | #% do Dano Físico Convertido para Dano de Fogo |
| 2 | % de chance de remover um Feitiço após Causar Dano |
| 2 | +# ao Máximo de Zumbis Evocados |
| 2 | +# ao número Máximo de Tempestades de Lâminas por vez |
| 2 | +# metros ao raio do Solo Sagrado |
| 2 | Abalo Secundário causa # % mais Dano com Acertos e Afecções |
| 2 | Abalo Secundário causa +# % mais Dano com Acertos e Afecções |
| 2 | Acertos aós o primeiro em cada Inimigo causam # % menos Dano |
| 2 | Aplica feixes aos # Inimigos próximos |
| 2 | as flechas do mesmo ataque podem acertar o mesmo inimigo (no jogo cada flecha a mais vai num inimigo diferente) |
| 2 | Aura de Exposição ao Fogo aplica # % à resistência a dano de fogo |
| 2 | Buff Concede # % de chance de Eletrizar inimigos |
| 2 | Buff concede +# % de chance de Eletrizar inimigos |
| 2 | Cada Esporo aplica # % menos Velocidade de Movimento aos Inimigos próximos, até um máximo de # % |
| 2 | Cada Flecha pode disparar +# Feixes |
| 2 | Causa # % mais Dano por Carga Sangrenta |
| 2 | Causa # a # de Dano de Caos |
| 2 | Causa # a # de Dano de Raio |
| 2 | Causa # explosões menores Explosões menores têm entre # % de redução e # % de aumento do raio base, aleatoriamente |
| 2 | Causa # rajadas |
| 2 | Causa +# explosões menores |
| 2 | Ceifador faz com que seus Lacaios Não-Ceifadores causem # % menos Dano |
| 2 | Ceifador faz com que seus Lacaios Não-Ceifadores tenham # % menos Vida Máxima |
| 2 | Concede # % mais Dano Mágico |
| 2 | Custa # % mais Vida por Carga Sangrenta |
| 2 | Definhado dura # segundos |
| 2 | Dispara um feixe a cada # segundos |
| 2 | Duração de Maldições aumentada em # % |
| 2 | Duração do Buff aumentada em # % por Carga de Tolerância removida |
| 2 | Espalha quando o Inimigo afetado morrer |
| 2 | Essa Gema só pode Suportar Gemas de Habilidade que requerem Nível # ou menos |
| 2 | Esta habilidade é ativada por habilidades reforçadas de Instabilidade Cinética |
| 2 | Esta Magia causa # a # , mais # % da sua Vida Máxima, como Dano de Fogo base |
| 2 | Explosão Cinética cria # explosões adicionais |
| 2 | Feixes se dividem em direção a alvos dentro de um raio base de # metros |
| 2 | Fissuras irrompem # vezes adicionais |
| 2 | Ganhe uma Carga Sangrenta se esta Habilidade Acertar Inimigos e nenhum deles Morrerem Perca uma Carga Sangrenta quando um Inimigo Morrer enquanto afetado pelo Debuff desta Habilidade |
| 2 | Golens causam # % mais Dano por Lacaio Não-Golem próximo deles, até # % |
| 2 | Golpeia a cada # segundos enquanto Canalizando uma Habilidade de Raio próximo ao Orbe |
| 2 | Golpes Abatedores com Habilidades Suportadas Consomem cadáveres para Recuperar # de Vida e # de Mana |
| 2 | Habilidades de Efeito em Área Suportadas também afetam áreas na frente, atrás, e dos lados da área alvo |
| 2 | Habilidades de Efeito em Área Suportadas também afetam áreas na frente, atrás,\ne dos lados da área alvo |
| 2 | Habilidades Suportadas aplicam Maldições Suportadas em Acertos |
| 2 | Habilidades suportadas criam Solo Maldito com uma Duração base de # segundos Feitiços de Habilidades Suportadas não tem Duração Inimigos em Solo Maldito das Habilidades Suportadas são Amaldiçoados com tal Feitiço Limite de # área de Solo Maldito |
| 2 | Habilidades Suportadas têm Efeito em Área da Ativação de Armadilhas aumentado em #% |
| 2 | Impele o próximo # Ataque de Golpe Corpo a Corpo que você executar |
| 2 | Lacaios de Habilidades Suportadas têm Chance de Golpe Crítico aumentada em #% |
| 2 | Lacaios possuem +# % de todas Resistências Elementais |
| 2 | Libera # onda |
| 2 | Libera +# onda |
| 2 | Martelos causam - # % de dano |
| 2 | Máximo de # anomalias |
| 2 | o uso de cadáveres não existe no jogo |
| 2 | Orbes desaparecem após # Golpes |
| 2 | Orbes Explosivas causam # % do Dano da Habilidade para cada # segundos de Duração restante |
| 2 | Orbes saltam a cada # segundos |
| 2 | Pode focar em cada inimigo apenas uma vez a cada # segundos |
| 2 | Raio Base da explosão menor igual a # metros |
| 2 | Receba # % do Dano Físico como Dano de Gelo Extra |
| 2 | Sentinelas Ascendidos causam # % mais Dano |
| 2 | Sentinelas Ascendidos sofrem # % menos Dano |
| 2 | Só aplica Feitiços de Gemas de Habilidades Maldição que exigem Nível # ou menor |
| 2 | Tem # chamas |
| 2 | Tempestade Furiosa Acerta com # % mais Frequência |
| 2 | Tempestades de Lâminas causam # % menos Dano com Acertos e Afecções |
| 2 | Todos os Danos podem Incendiar, Congelar e Eletrizar |
| 2 | Trava o inimigo no lugar |
| 2 | Velocidade de Movimento do Orbe aumentada em # % |
| 2 | Velocidade de Movimento dos Lacaios está no Máximo |
| 2 | Você não pode Conjurar Magias Maldição Suportadas |
| 1 | [DNT] Deals # % more Damage per active wall |
| 1 | [Empowered\|Fortalece] a próxima magia vaal danosa que você conjurar |
| 1 | [Empowered\|Fortalece] as próximas # magias que você conjurar |
| 1 | [Empowered\|Fortalece] as próximas +# magias que você conjurar |
| 1 | # % de aumento da Distância do Empurrão |
| 1 | # % de chance de convocar um Lacaio extra |
| 1 | # % de chance de Convocar um Sentinela da Pureza ao Acertar um Inimigo Raro ou Único |
| 1 | # % de chance de ganhar uma Ruína adicional ao usar |
| 1 | # % de chancer de causar Sangramento enquanto na Postura de Sangue |
| 1 | # % do Dano de Acertos é sofrido no Buff antes da sua Vida ou Escudo de Energia Buff pode sofrer Dano igual a Mana Gasta pelo efeito desta Habilidade |
| 1 | # % do Dano de Raio Convertido em Dano de Caos |
| 1 | # % do Dano Físico é Convertido para Dano de Gelo enquanto a Esfera não possuir Afeções # % do Dano Físico é Convertido para Dano de Raio enquanto a Esfera estiver Eletrizada ou Exaurida # % do Dano Físico é Convertido para Dano de Gelo enquanto a Esfera etiver Congelada ou Enfraquecida |
| 1 | # % maior frequência de rajadas por # de mana máximo |
| 1 | # % mais Área de Efeito por lâmina do Vórtice de Lâminas detonada |
| 1 | # % mais Área de Efeito se Consumindo um Lacaio |
| 1 | # % mais Área de Efeito se Consumiu um cadáver |
| 1 | # % mais Dano com Acertos contra Inimigos Incendiados |
| 1 | # % mais Dano com Acertos e Afecções por cada Conjuração desta Magia aguardando no momento |
| 1 | # % mais Dano com Acertos e Afecções por Intensidade |
| 1 | # % mais Dano de Projétil |
| 1 | # % mais Dano na Postura de Sangue |
| 1 | # % mais dano por lâmina de Vórtice de Lâminas |
| 1 | # % mais Dano por Maldição aplicada |
| 1 | # % mais Duração do Veneno |
| 1 | # % mais Velocidade de Projétil |
| 1 | # % menos Dano de Afecções |
| 1 | # % menos Dano Físico sofrido por Carga de Tolerância removida |
| 1 | # % menos Velocidade de Arremesso de Armadilhas |
| 1 | # % menos velocidade de lançar armadilhas com arma de duas mãos |
| 1 | # metros ao raio do Solo Sagrado |
| 1 | # metros de raio |
| 1 | # Tiros |
| 1 | #% de chance de renovar a Duração do Modificador recebido em até # segundos quando você Acertar um Inimigo Raro ou Único com Habilidades Suportadas |
| 1 | #% mais Dano em Área |
| 1 | #% mais Dano por Carga de Tolerância |
| 1 | +# % mais Dano com Acertos contra Inimigos Incendiados |
| 1 | +# % mais Dano com Acertos e Afecções por cada Conjuração desta Magia aguardando no momento |
| 1 | +# % mais Dano com Acertos e Afecções por Intensidade |
| 1 | +# % mais Dano em Área |
| 1 | +# ao número máximo de Zumbis |
| 1 | +# de largura por cada # % de Mana Máxima Não Reservada possuída |
| 1 | +# de Relâmpagos Concentrados máximos |
| 1 | +# metros à Largura do Feixe Por Intensidade # % menos ângulo de ramificação por Intensidade |
| 1 | +# metros ao Raio da Explosão por Flecha Explosiva no Alvo, máximo de +# metros |
| 1 | +# metros ao raio do Pulso por Energia |
| 1 | +# metros para o alcance do golpe corpo a corpo do lacaio |
| 1 | +# vez |
| 1 | +#% para o número máximo de lacaios de habilidades reforçadas |
| 1 | a absorção de dano da guarda ainda não existe no jogo |
| 1 | A área alvejada base mede # metros de comprimento |
| 1 | A expiração do Buff não pode ser modificada |
| 1 | a explosão da tempestade usa o físico médio da arma × o "Dano de Ataque: X% de base" dela pelo acerto sem golpe (sem o crítico e os modificadores locais da arma); a Cegueira dentro dela (a descrição) não é aplicada |
| 1 | a explosão das torres usa o físico médio da arma × #–#% pelo acerto sem golpe (sem o crítico e os modificadores locais da arma); as torres não bloqueiam o caminho dos monstros |
| 1 | a imunidade a afecções ainda não existe no jogo |
| 1 | a lentidão da maldição ainda não existe no jogo |
| 1 | a Onda Arcana é um acerto só, no anel de # casas em volta de você — a duração de # s e a Eficácia de #% do dano adicionado não entram |
| 1 | a onda usa o físico médio da arma × o "Dano de Ataque: X% de base" dela pelo acerto sem golpe (sem o crítico e os modificadores locais da arma) |
| 1 | a perda de #% da Vida e do Escudo de Energia por segundo é a perda por segundo do jogo — não mata (deixa # de Vida) e não passa pelos modificadores de dano degenerativo recebido; no PoE é Dano Físico degenerativo (PhysicalDegen) |
| 1 | A Recarga do seu Escudo de Energia e dos seus aliados próximos não é impedida por Dano |
| 1 | A Segunda forma possui +# % ao Multiplicador de Acerto Crítico |
| 1 | Abalo Secundário causa # % mais Dano com Acertos por cada # segundos de Duração |
| 1 | Abalo Secundário causa # % mais Dano com Afecções por cada # segundos de Duração |
| 1 | Abalo Secundário tem # % mais Área de Efeito por cada # segundos de Duração |
| 1 | Acada segundo # % mais Fúria perdida |
| 1 | Acertos com Habilidades Suportadas para o qual o maior Tipo de Dano for Elemental fazem com que você ganhe # de Ressonância de outros Elementos por # segundos Perde # de Ressonância por segundo para cada Elemento que não estiver ganhando |
| 1 | Acertos com Habilidades Suportadas para o qual o maior Tipo de Dano for Elemental fazem com que você ganhe # de Ressonância de outros Elementos por # segundos\nPerde # de Ressonância por segundo para cada Elemento que não estiver ganhando |
| 1 | Acertos em Inimigos Incendiados criam Solo Ardente, não mais que uma vez a cada # segundos |
| 1 | Adrenalina de Combate concede #% mais Velocidade de Ataque às Habilidades de Deslocamento não Suportadas por Combate Próximo |
| 1 | Afecções Elementais infligidas por Habilidades Suportadas se espalham para outros inimigos dentro de # metros |
| 1 | Alcance do Posicionamento de Totens aumentado em # % |
| 1 | Alvos sofrem #% mais Dano do Sangramento por Rompimento das Habilidades Suportadas neles |
| 1 | Ângulo da ramificação aumentado em # % |
| 1 | Anima até # Armas |
| 1 | Ao atingir # de Gula, perde toda a Gula e ganha Regurgitação por # segundos |
| 1 | Aplica feixes aos +# Inimigos próximos |
| 1 | Após atacar, os totens desaparecem |
| 1 | Armadilha dura +# segundo Gira |
| 1 | Arqueiro Ilusório dura # segundos |
| 1 | Arqueiro Ilusório utiliza Habilidades Suportadas com #% menos Velocidade de Ataque |
| 1 | As flechas após a primeira caem em um raio base de # metros |
| 1 | Ataca um Inimigo a cada # segundos |
| 1 | Ataque de Impacto dos Zumbis Erguidos tem Efeito em Área aumentado em # % |
| 1 | Ataques com habilidades reforçadas, cujo maior tipo de dano é caos, elétrico ou físico, fazem você ganhar # de Ressonância Profana dos outros tipos por segundo durante # segundos Perde # de Ressonância Profana por segundo para cada tipo que não ganhar |
| 1 | Ataques com habilidades reforçadas, cujo maior tipo de dano é caos, elétrico ou físico, fazem você ganhar # de Ressonância Profana dos outros tipos por segundo durante # segundos\nPerde # de Ressonância Profana por segundo para cada tipo que não ganhar |
| 1 | Ataques Impelidos causam # % mais Dano por Aliado afetado, máximo de # % |
| 1 | Ataques Impelidos têm # % mais Área de Efeito |
| 1 | Ataques reforçados ativam Rajada de Vento ao atingir, limitado a uma vez a cada # metros percorridos |
| 1 | Ataques Suportados causam #% mais Dano por cada Clamor que os Impelir |
| 1 | Ataques Suportados causam Dano Físico com Armas Adicional igual a #% da Vida Máxima enquanto em Vida Baixa |
| 1 | Ataques Suportados causam Dano Físico com Armas Adicional igual a\n#% da Vida Máxima enquanto em Vida Baixa |
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
| 1 | Buff concede Imunidade a Eletrização |
| 1 | Buff concede Ponto de Atordoamento aumentado em # % por cada # de Poder, contando um máximo de # de Poder |
| 1 | Buff tem # % mais Efeito em seus Lacaios |
| 1 | Cada Aprisionamento aplica # % menos Velocidade de Movimento aos Inimigos Normais ou Mágicos |
| 1 | Cada Aprisionamento aplica # % menos Velocidade de Movimento aos Inimigos Raros |
| 1 | Cada Aprisionamento aplica # % menos Velocidade de Movimento aos Inimigos Únicos |
| 1 | Cada Esporo dispara # Flechas de Espinho |
| 1 | Cada Esporo dispara +# Flecha de Espinho |
| 1 | Cada Flecha deixa # Esporos |
| 1 | Cada Flecha pode disparar +# Feixe |
| 1 | Cada Habilidade Suportada causa #% mais Dano com Incêndio por cada Incêndio infligido com ela Recentemente, máximo de #% |
| 1 | Cada Habilidade Suportada causa #% menos Dano por cada Incêndio infligido com ela Recentemente, máximo de #% |
| 1 | Cada mina aplica Dano aumentado em +# % aos Inimigos próximos máximo de # % |
| 1 | Cada Mina das Habilidades Suportadas aplicadas #% de chance de causar Dano Dobrado aos Acertos contra Inimigos próximos a ele, até um máximo de #% |
| 1 | Cada onda tem # Explosões |
| 1 | Cada rajada dispara # lâminas, que permanecem no chão |
| 1 | Campo ganha # % mais Dano com Ataques por cada # % de Efeito de Eletrização no Inimigo quando criado |
| 1 | Campo ganha +# metros ao raio por cada # % de Efeito de Eletrização no Inimigo quando criado |
| 1 | Causa # % da sua Mana Máxima como Dano de Fogo Base por segundo |
| 1 | Causa # % do seu Escudo de Energia Máximo como Dano Base de Fogo por segundo |
| 1 | Causa # a # de Dano de Fogo |
| 1 | Causa # a # de Dano de Gelo |
| 1 | Causa # Ondas |
| 1 | Causa +# % da sua Vida Máxima como Dano de Fogo base |
| 1 | Causa +# rajadas |
| 1 | Causa Dano de Fogo base igual a #% da Vida Máxima dos Totens |
| 1 | Causa Dano de Raio base igual a # % da Mana Não Reservada que falta |
| 1 | Causa Dano de Raio base igual a +# % da Mana Não Reservada que falta |
| 1 | Causa Dano Físico Adicional igual a # % da Mana Máxima |
| 1 | Ceifadores fazem com que seus Lacaios não-Ceifadores tenham # % menos Dano |
| 1 | Ceifadores fazem com que seus Lacaios não-Ceifadores tenham # % menos Vida Máxima |
| 1 | Chão amaldiçoado de habilidades reforçadas ativam Sapo Explosivo a cada # segundo |
| 1 | Circunferência base da área-alvo é de # metros |
| 1 | Clamores reforçados criam um chão consagrado com duração de # segundos |
| 1 | Clamores reforçados têm #% de área de efeito |
| 1 | Clamores reforçados têm a velocidade de recarga reduzida em #% |
| 1 | Clamores Suportados infligem # Debuffs de Sangue Corrompido |
| 1 | Clamores Suportados infligem # Debuffs de Sangue Corrompido no primeiro inimigo Acertado por cada Ataque que Impelirem |
| 1 | Clamores Suportados infligem # Debuffs de Sangue Corrompido no primeiro\ninimigo Acertado por cada Ataque que Impelirem |
| 1 | Clones possuem # % de aumento da Velocidade de Movimento |
| 1 | Cobre Inimigos em Cinzas ao Acertar |
| 1 | Concede # % mais velocidade de conjuração |
| 1 | Concede # de Regeneração de Mana por segundo para cada Inimigo afetado |
| 1 | Concede # de Regeneração de Mana por segundo se qualquer Inimigo está afetado |
| 1 | Concede # de Regeneração de Vida por segundo caso um Inimigo esteja afetado |
| 1 | Concede # de Regeneração de Vida por segundo para cada Inimigo afetado |
| 1 | Concede +# ao máximo de Cargas de Sangue |
| 1 | Concede aos Lacaios +# % de Chance de Bloquear Dano Mágico |
| 1 | Concede até o máximo de Cargas de Sangue |
| 1 | Consumir um cadáver com habilidades reforçadas tem #% de chance de conceder uma alma por poder |
| 1 | Consumir um cadáver com habilidades reforçadas tem +#% de chance de conceder uma alma por poder |
| 1 | Conta o Poder total de Inimigos e Aliados no Raio |
| 1 | Converte # % do Dano Físico para um Elemento aleatório |
| 1 | Convoca # Espíritos Sagrados Máximo de # Espíritos Sagrados |
| 1 | Convoca # Espíritos Sagrados\nMáximo de # Espíritos Sagrados |
| 1 | Convoca Martelos Sagrados em até # inimigos atingidos |
| 1 | Convoca um Sentinela da Pureza quando você Matar um Inimigo |
| 1 | Cria # Estacas adicionais se você mudou de Postura Recentemente |
| 1 | Cria # fendas |
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
| 1 | Dano Mágico Suprimido causado em você é Azarado |
| 1 | Debuff Secundário causa # % do total restante do Dano Venenoso Esperado de todos os Venenos no Inimigo morto por segundo como Dano de Caos |
| 1 | Debuffs causam # % de Dano por Carga |
| 1 | Debuffs causam +# % de Dano por Carga |
| 1 | Detonação da Mina é Instantânea |
| 1 | Dispara # projéteis |
| 1 | Dispara # Projéteis secundários |
| 1 | Dispara até # Flechas em alvos diferentes |
| 1 | Dispara Projéteis # % mais rápido |
| 1 | Dispara Projéteis a cada # segundos |
| 1 | Dispara tentáculos em até # Alvos |
| 1 | Dispara um Carregamento de Flechas no ar Projéteis Disparam de onde a Flecha com o Carregamento cair |
| 1 | Duração Base do Frenesi Faminto é de # segundos |
| 1 | Duração do Buff é atualizada após você gastar um total de # de Vida |
| 1 | Efeito da Marca aumentado em # % |
| 1 | Efeito das Marcas de Habilidades Suportadas aumentado em #% |
| 1 | Efeito das Marcas de Habilidades Suportadas reduzido em #% |
| 1 | Efeito de Maldições aumentado em # % |
| 1 | Efeito do Debuff aumentado em # % |
| 1 | Efeito em Área de Habilidades Maldição Suportadas reduzido em #% |
| 1 | Efeitos do Sangue Fervendo Perduram por # segundos |
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
| 1 | Espalha quando o Inimigo afetado for Acertado |
| 1 | Espectros têm Duração Base de # segundos Espectros não viajam entre as Áreas |
| 1 | Espíritos Sagrados têm #% de chance de usar a Habilidade Ativadora quando voc#e disparar um Projétil com tal Habilidade |
| 1 | Espíritos Sagrados têm #% de chance de usar a Habilidade Ativadora quando voc#e disparar um\nProjétil com tal Habilidade |
| 1 | Espíritos Sagrados têm +#% de chance de usar a Habilidade Ativadora quando você disparar um Projétil com tal habilidade enquanto um Inimigo Raro ou Único estiver em sua Presença |
| 1 | Esta habilidade é ativada por habilidades de ataque reforçadas |
| 1 | Esta habilidade é ativada quando uma habilidade de reforço causa dano elétrico com o acerto |
| 1 | Esta Magia ganha Intensidade quando você Conjurá-la, máximo de # |
| 1 | Esta Magia perde # de Intensidade a cada # segundos enquanto se movendo, ou imediatamente ao teleportar |
| 1 | Estandarte concede # % mais Dano Físico com Habilidades Corpo a Corpo a Você e Aliados |
| 1 | Estandarte concede # de Dano sofrido de cada Tipo de Dano dos Acertos Suprimidos a Você e Aliados |
| 1 | Estandarte concede Precisão aumentada em # % a Você e Aliados |
| 1 | Estandarte faz com que você e Aliados Recuperem # de Vida ao Bloquear |
| 1 | Estandartes reforçados infligem Sangue Corrompido a cada segundo aos inimigos dentro de sua área |
| 1 | Este ataque e lacaios convertem # % do dano físico em dano elétrico |
| 1 | Estímulo dura # segundos |
| 1 | Explode um Cadáver próximo ao Disparar Projéteis |
| 1 | Explosão causa # % mais Dano com Acertos e Afecções |
| 1 | Explosão causa # % mais Dano com Acertos por Flecha Explosiva no Alvo |
| 1 | Explosão causa # % mais Dano com Afecções por Flecha Explosiva no Alvo |
| 1 | Explosão causa # % menos Dano Base |
| 1 | Explosão causa + # % de dano com ataques e afecções |
| 1 | Explosão Final causa + # % de dano |
| 1 | Explosão Final Causa + # % mais Dano |
| 1 | Explosões causam Dano de Fogo base igual a # % da Vida máxima do Lacaio |
| 1 | Explosões causam Dano de Raio igual a # % da Vida Máxima do cadáver |
| 1 | Explosões terão # a # de Dano de Fogo adicional |
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
| 1 | Gasta # % da Mana atual |
| 1 | Gelo se quebra após você sofrer # Acertos Danificadores ou a Duração expirar |
| 1 | Gira # vez |
| 1 | Gira # vezes |
| 1 | Gira +# vezes se em Empunhadura Dupla |
| 1 | Glifos reforçados ativam Constrição Pérfida ao serem recuperados |
| 1 | Golpe de Impacto de Zumbis Evocados tem a Velocidade de Recarga aumentada em % |
| 1 | Golpes Críticos com Habilidades Suportadas que infligirem Sangramento também infligem Rompimento |
| 1 | Golpes fatais com habilidades reforçadas fazem com que os inimigos tenham #% de chance de explodir e causarem um décimo da própria vida máxima como dano de um elemento aleatório |
| 1 | Golpes fatais com habilidades reforçadas fazem com que os inimigos tenham +#% de chance de explodir e causarem um décimo da própria vida máxima como dano de um elemento aleatório |
| 1 | Golpes Finais das Habilidades de Golpe Suportadas com Armas Corpo a Corpo contra Monstros Raros concedem um de seus Modificadores por # segundos |
| 1 | Golpes Impelidos focam em # Inimigos adicionais |
| 1 | Habilidades Corpo a Corpo causam # % mais Dano em Área enquanto na Postura de Sangue |
| 1 | Habilidades Corpo a Corpo têm # % menos Efeito em Área enquanto na Postura de Sangue |
| 1 | Habilidades de arauto reforçadas não têm efeito bônus |
| 1 | Habilidades de Aura Suportadas não tem Reserva |
| 1 | Habilidades de Efeito em Área Suportadas também afetam áreas na frente e atrás da área alvo |
| 1 | Habilidades fortalecidas causam + # % de dano |
| 1 | Habilidades fortalecidas causam + # % de dano com ataques e afecções |
| 1 | Habilidades fortalecidas disparam # projéteis adicionais Habilidades fortalecidas disparam projéteis em círculo |
| 1 | Habilidades fortalecidas também afetam # áreas adicionais em espiral ao redor da área-alvo |
| 1 | Habilidades Não-Instantâneas Suportadas têm +# Usos de Tempo do Recarga |
| 1 | Habilidades reforçadas ativam Cristal em Queda ao atingir |
| 1 | Habilidades reforçadas ativam Fluxo Cinético ao causar golpe crítico |
| 1 | Habilidades reforçadas ativam Fluxo Cinético no golpe fatal |
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
| 1 | Habilidades Suportadas Ativam Onda de Choque no Acerto Corpo a Corpo |
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
| 1 | Habilidades Suportadas ganham Dano de Raio Adicional igual a #% da Mana Máxima não Reservada |
| 1 | Habilidades Suportadas infligem Podridão ao Acertar, causando # de Dano de Caos por segundo durante # segundos |
| 1 | Habilidades Suportadas não podem aplicar Auras em você a menos que você tenha Lacaios de uma Habilidade Suportada |
| 1 | Habilidades Suportadas não tem Reserva |
| 1 | Habilidades Suportadas penetram #% da Resistência Elemental enquanto cada Ressonância estiver em ao menos # |
| 1 | Habilidades Suportadas podem ter até # Minas Remotas adicionais plantadas de uma vez |
| 1 | Habilidades Suportadas possuem #% de chance de causar Definhado ao Acertar |
| 1 | Habilidades Suportadas recebem #% de Dano Físico como Dano de Caos Extra |
| 1 | Habilidades Suportadas só podem ser usadas com Varinhas |
| 1 | Habilidades Suportadas têm # a # de Dano de Ataque Físico Adicional por Traumatismo |
| 1 | Habilidades Suportadas têm #% da duração da Cegueira aumentada |
| 1 | Habilidades Suportadas têm #% de chance de Cegar inimigos ao acertar |
| 1 | Habilidades Suportadas têm #% de chance de Enervar Inimigos por # segundos ao Acertar |
| 1 | Habilidades Suportadas têm #% de chance de Esmagar Inimigos por # segundos ao Acertar |
| 1 | Habilidades Suportadas têm #% de chance de ganhar uma Carga de Frenesi ao Matar um Inimigo Congelado |
| 1 | Habilidades Suportadas têm #% de chance de ganhar uma Carga de Poder com Golpes Críticos |
| 1 | Habilidades Suportadas têm #% de chance de Intimidar Inimigos por # segundos ao Acertar |
| 1 | Habilidades Suportadas têm #% de Velocidade de Ataque de Lacaios aumentada |
| 1 | Habilidades Suportadas têm #% de Velocidade de Conjuração de Lacaios aumentada |
| 1 | Habilidades Suportadas têm #% mais frequência de Ativação |
| 1 | Habilidades Suportadas têm alcance de Transferência de Feitiços aumentado em #% |
| 1 | Habilidades Suportadas tem Chance de Golpe Crítico aumentada em #% por Carga de Inspiração |
| 1 | Habilidades Suportadas têm Custo de Vida aumentado em #% |
| 1 | Habilidades Suportadas têm Duração da Armadilha aumentada em #% Habilidades reforçadas têm a duração de mina aumentada em #% |
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
| 1 | Inimigos Encharcados têm Exposição a Gelo e Raio, aplicando # % às Resistências |
| 1 | Inimigos possuem # % menos Velocidade de Movimento no início do Debuff |
| 1 | Inimigos Provocados por este Clamor são Intimidados |
| 1 | Inimigos Raros e Únicos Amaldiçoados tem # % menos Velocidade de Ação |
| 1 | Inimigos recebem # % de aumento de Dano dos Acertos de Minas ou Armadilhas |
| 1 | Inimigos sofrem de Insanidade Perversa se estiverem sob a influência de auras de habilidades reforçadas por mais de # segundos |
| 1 | Intensidade de Chama Santificada infligida por habilidades reforçadas aumentada em #% |
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
| 1 | Libera ondas a cada # segundos |
| 1 | Magias reforçadas causam de # a # de dano físico adicionado para cada lacaio permanente |
| 1 | Magias Suportadas causam # % menos Dano |
| 1 | Magias Suportadas Sacrificam #% da sua Vida atual quando Conjuradas para ganhar Dano de Caos adicional igual a #% da Vida Sacrificada |
| 1 | Magias Suportadas têm Recuperação da Recarga aumentada em #% |
| 1 | Martelos Cadentes ocorrem a cada # segundos Aumentos e reduções na velocidade de ataque afetam a frequência com que esses martelos caem |
| 1 | Máximo de # Arqueiro Ilusório Convocado |
| 1 | Máximo de # Lacaios Relâmpagos Vivos |
| 1 | Máximo de # mãos |
| 1 | Máximo de # Nascido(s) da Colmeia |
| 1 | Máximo de +# Flechas Explosivas grudadas em cada Inimigo |
| 1 | Máximo de +# gêiseres por vez |
| 1 | Máximo de +# Paredes Flamejantes por vez |
| 1 | Minas de Habilidades Suportadas não podem ser Detonadas enquanto dentro de # metros de você |
| 1 | Minas não podem ser Re-armadas |
| 1 | Minas tem Velocidade de Detonação aumentada em # % |
| 1 | Minas usando Habilidades Suportadas sempre focam na sua localização |
| 1 | Modificadores ao Dano Mágico são aplicados ao efeito de Dano Degenerativo das Habilidades Suportadas |
| 1 | Não pode Incendiar |
| 1 | Não pode infligir Envenenamento em Inimigos Envenenados |
| 1 | Não pode infligir múltiplos envenenamentos com o mesmo ataque |
| 1 | Não pode ser Convocada |
| 1 | Não pode ser Evadido |
| 1 | Não requer um cadáver |
| 1 | O efeito atual é finalizado após # Abalos Secundários |
| 1 | O raio base da Saraivada é de # metros |
| 1 | o Raio por estágio e o "menos dano" valem para você e os inimigos na área; os aliados (a party) na área não recebem o buff |
| 1 | o totem provoca os monstros em volta a atacá-lo (act_str.lua:##) |
| 1 | Oferendas reforçadas ativam Invocar Nascidos da Colmeia ao usar |
| 1 | Onda de Choque causa # % mais Dano |
| 1 | Onda de Choque causa # % menos Dano |
| 1 | Onda de Choque causa +# % mais Dano |
| 1 | Outros efeitos em inimigos Amaldiçoados expiram # % mais devagar |
| 1 | Perca # de Fúria por segundo |
| 1 | Perca todas as Cargas de Inspiração após Gastar um total de # de Mana em Custos Diretos e Efeitos das Habilidades Suportadas |
| 1 | perto do totem, você ganha Área de Efeito aumentada para Habilidades Corpo a Corpo (a descrição; o valor — ancestor_totem_grants_owner_area_of_effect_+%_with_melee_skills — não está nos dados do PoB) |
| 1 | Possui # Chamas |
| 1 | Primeira Mina é Detonada Instantaneamente Minas recebem # % mais Velocidade de Detonação para cada Mina anteior na Sequência de Detonação |
| 1 | Projéteis de Espinhos causam # % menos Dano |
| 1 | Projéteis deixam Solo Eletrizado |
| 1 | Projéteis Perfuram todos Alvos |
| 1 | Projéteis que Acertarem Inimigos Amaldiçoados se Dividem na direção de # alvos adicionais |
| 1 | Projéteis que passam pela parede causam # a # de Dano de Fogo Adicional |
| 1 | Projéteis Ricocheteiam ao colidirem com o terreno |
| 1 | Pulsa a cada # enquanto Congelada, Eletrizada, Enfraquecida ou Exaurida |
| 1 | Pulsos causam # % mais Dano com Afecções por Energia após a primeira |
| 1 | Pulsos causam # % mais Dano com Dano com Acertos por Energia após a primeira |
| 1 | Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade Arqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados |
| 1 | Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade\nArqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados |
| 1 | Raio acerta # alvo dentro de # metros |
| 1 | Raio acerta # alvos dentro de # metros |
| 1 | Raio base da lâmina é de # metro |
| 1 | Raio Base terciário igual a # metros |
| 1 | Raio de alcance base do impacto é de # metro |
| 1 | Raios acertam a cada # segundos |
| 1 | Raios Acertam Inimigos a cada # segundos |
| 1 | Raios causam # % menos Dano |
| 1 | Receba uma Carga de Tolerância quando você Atordoar um Inimigo com um Acerto Corpo a Corpo com Habilidades Suportadas |
| 1 | Reflete # % do Dano sofrido pelo Buff como Dano de Fogo por segundo, ou quando o Buff expirar ou se esgotar |
| 1 | Reflete # % do Dano sofrido pelo Buff como Dano de Fogo quando o Buff expirar ou se esgotar |
| 1 | Regeneração de Vida reduzida em # % |
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
| 1 | Só pode ser Acertado uma vez a cada # segundo |
| 1 | Solo Ardente causa # % de Dano de Fogo por segundo de Incêndio afetando o Inimigo |
| 1 | Solo Ardente causa # % do Dano de Fogo por Segundo do Incêndio mais forte no Inimigo Solo Cáustico causa # % do Dano de Caos por Segundo do Envenenamento mais forte no Inimigo Pode criar cada efeito de Solo não mais que uma vez por segundo |
| 1 | Solo ardente causa +# % do Dano de Fogo por segundo do Incêndio infligido |
| 1 | Solo Ardente dura # segundos |
| 1 | Solo Eletrizado causa # % de Dano sofrido aumentado |
| 1 | Somente uma Mina deste tipo pode ser Detonada em cada Sequência de Detonação |
| 1 | Suas Habilidades e de seus aliados próximos não Custam Mana |
| 1 | Suas Habilidades Não-Bênção que Reservam Mana são Desabilitadas enquanto você tiver uma Aura da Habilidade Suportada em você |
| 1 | Taxa base de explosão do orbe é de uma vez por segundo |
| 1 | Tempestade Furiosa causa # % mais Dano por cada # de Fúria Sacrificada |
| 1 | Tempestades Acertam Inimigos com Frequência aumentada em # % |
| 1 | Tormenta Furiosa tem +# metros ao raio por cada # de Fúria sacrificada |
| 1 | Totens com esta Habilidade a Ativam quando Acertados por um Inimigo |
| 1 | Totens das Habilidades Suportadas ganham a Habilidade Vingança Flamejante e a Ativa quando Acertado por um Inimigo |
| 1 | Totens das Habilidades Suportadas ganham a Habilidade\nVingança Flamejante e a Ativa quando Acertado por um Inimigo |
| 1 | Um lacaio próximo ganha uma alma para cada # de vida que você gasta em custos iniciais com magias reforçadas |
| 1 | Um lacaio próximo ganha uma alma para cada # de vida que você gasta em custos\niniciais com magias reforçadas |
| 1 | Uma rajada de lâminas cai a cada # segundos |
| 1 | Usar habilidades vaal reforçadas inflige Tentação Vaal em você, causando # de dano físico por segundo, em vez de aplicar impedimento de ganho de almas |
| 1 | Velocidade de Ataque aumentada em # % caso tenha mudado de Postura Recentemente |
| 1 | Velocidade de rotação aumentada em # % se em Empunhadura Dupla |
| 1 | Você e Aliados não-Lacaios Próximos têm # % de chance de criarem Solo Sagrado ao Acertar um Inimigo Raro ou Único, durando # segundos |
| 1 | Você e Aliados próximos ganham # % de Velocidade de Recarga de Escudo de Energia aumentada |
| 1 | Você e aliados próximos têm +# % de chance de Evadirem Acertos de Ataques |
| 1 | Você Queima por # % da sua Mana Máxima por segundo como Dano de Fogo |
| 1 | Você Queima por # % de sua Vida máxima por segundo como Dano de Fogo |
| 1 | Você Queima por # % do seu Escudo de Energia máximo por segundo como Dano de Fogo |
| 1 | Você sofre # % menos Dano de Acertos e conta como Congelado |
| 1 | ㅤ+ # % de dano com ataques e afecções por Relâmpagos Concentrados |

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
- **Bane** (Banir) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: 42 % mais Dano por Maldição aplicada
  - efeito não simulado: Só aplica Feitiços de Gemas de Habilidades Maldição que exigem Nível 70 ou menor
  - efeito não simulado: Essa Gema só pode Suportar Gemas de Habilidade que requerem Nível 70 ou menos
- **Bane_of_Condemnation** (Banimento da Condenação) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Só aplica Feitiços de Gemas de Habilidades Maldição que exigem Nível 70 ou menor
  - efeito não simulado: Essa Gema só pode Suportar Gemas de Habilidade que requerem Nível 70 ou menos
- **Bear_Trap** (Armadilha de Urso) — parcial
  - efeito não simulado: Trava o inimigo no lugar
  - efeito não simulado: Inimigos recebem 25 % de aumento de Dano dos Acertos de Minas ou Armadilhas
  - efeito não simulado: Inimigos possuem 80 % menos Velocidade de Movimento no início do Debuff
- **Bear_Trap_of_Skewers** (Armadilha de Urso dos Espetos) — parcial
  - efeito não simulado: Trava o inimigo no lugar
  - efeito não simulado: Empala Inimigos ao Acertar
- **Blade_Blast_of_Unloading** (Explosão de Lâminas do Descarrego) — parcial
  - efeito não simulado: 5 % mais dano por lâmina de Vórtice de Lâminas
  - efeito não simulado: 100 % mais Área de Efeito por lâmina do Vórtice de Lâminas detonada
  - efeito não simulado: 20 % mais Área de Efeito por lâmina do Vórtice de Lâminas detonada
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
- **Bladefall_of_Trarthus** (Corrente com Gancho de Trarthus) — parcial
  - efeito não simulado: Uma rajada de lâminas cai a cada 0.7 segundos
  - efeito não simulado: 2 % maior frequência de rajadas por 100 de mana máximo
  - efeito não simulado: O raio base da Saraivada é de 2.5 metros
  - efeito não simulado: Raio base da lâmina é de 1 metro
  - efeito não simulado: Cada rajada dispara 5 lâminas, que permanecem no chão
- **Bladestorm** (Tempestade de Lâminas) — parcial
  - efeito não simulado: 108 % mais Dano com Sangramento enquanto na Postura de Sangue
  - efeito não simulado: 12 % mais Velocidade de Ataque enquanto estiver em uma Tempestade de Lâminas Sangrentas
  - efeito não simulado: Tempestades de Lâminas causam 50 % menos Dano com Acertos e Afecções
  - efeito não simulado: +1 ao número Máximo de Tempestades de Lâminas por vez
- **Bladestorm_of_Uncertainty** (Tempestade de Lâminas da Incerteza) — parcial
  - efeito não simulado: 12 % mais Velocidade de Ataque enquanto estiver em uma Tempestade de Lâminas Sangrentas
  - efeito não simulado: Tempestades de Lâminas causam 50 % menos Dano com Acertos e Afecções
  - efeito não simulado: +1 ao número Máximo de Tempestades de Lâminas por vez
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
- **Blood_Rage** (Fúria Sangrenta) — parcial
  - efeito não simulado: a perda de 4% da Vida e do Escudo de Energia por segundo é a perda por segundo do jogo — não mata (deixa 1 de Vida) e não passa pelos modificadores de dano degenerativo recebido; no PoE é Dano Físico degenerativo (PhysicalDegen)
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
- **Conflagration** (Conflagração) — parcial
  - efeito não simulado: As flechas após a primeira caem em um raio base de 3 metros
  - efeito não simulado: Raio de alcance base do impacto é de 1 metro
  - efeito não simulado: Explosão causa + 50 % de dano com ataques e afecções
  - efeito não simulado: Duração da penalidade base é de 4 segundos
  - efeito não simulado: Explosão causa + 30 % de dano com ataques e afecções
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
- **Cremation_of_Exhuming** (Cremação da Exumação) — parcial
  - efeito não simulado: Explode um Cadáver próximo ao Disparar Projéteis
  - efeito não simulado: Dispara Projéteis 15 % mais rápido
- **Cremation_of_the_Volcano** (Cremação do Vulcão) — parcial
  - efeito não simulado: Dispara Projéteis a cada 1 segundos
  - efeito não simulado: Máximo de +2 gêiseres por vez
- **Dark_Bargain** (Barganha Sombria) — parcial
  - efeito não simulado: Sacrifica 12 % da Vida do Esqueleto para causar a mesma quantidade de Dano de Caos
  - efeito não simulado: Sacrifica +2 % da Vida do Esqueleto para causar a mesma quantidade de Dano de Caos
- **Dark_Bargain_of_Trarthus** (Barganha Sombria de Trarthus) — parcial
  - efeito não simulado: Ganha uma Ruína por uso Ao chegar a sete, sacrifica 50 % da sua vida e causa 600 % da vida sacrificada como dano de caos
  - efeito não simulado: 20 % de chance de ganhar uma Ruína adicional ao usar
- **Decoy_Totem** (Totem Chamariz) — parcial
  - efeito não simulado: o totem provoca os monstros em volta a atacá-lo (act_str.lua:2416-2432)
- **Defiance_Banner** (Estandarte Desafiador) — parcial
  - efeito não simulado: Estandarte concede -12 de Dano sofrido de cada Tipo de Dano dos Acertos Suprimidos a Você e Aliados
- **Despair** (Desespero) — parcial
  - efeito não simulado: Efeito de Maldições aumentado em 10 %
- **Detonate_Mines** (Detonar Minas) — parcial
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: Primeira Mina é Detonada Instantaneamente Minas recebem 10 % mais Velocidade de Detonação para cada Mina anteior na Sequência de Detonação
  - efeito não simulado: Minas tem Velocidade de Detonação aumentada em 20 %
- **Discipline** (Disciplina) — parcial
  - efeito não simulado: Você e Aliados próximos ganham 30 % de Velocidade de Recarga de Escudo de Energia aumentada
- **Divine_Blast** (Rajada Divina) — parcial
  - efeito não simulado: Explosão causa 100 % mais Dano com Acertos e Afecções
- **Divine_Blast_of_Radiance** (Rajada Divina do Esplendor) — parcial
  - efeito não simulado: Taxa base de explosão do orbe é de uma vez por segundo
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
- **Dread_Banner** (Estandarte Horrendo) — parcial
  - efeito não simulado: Estandarte faz com que você e Aliados Recuperem 34 de Vida ao Bloquear
- **Earthquake** (Terremoto) — parcial
  - efeito não simulado: Abalo Secundário causa 150 % mais Dano com Acertos e Afecções
  - efeito não simulado: Abalo Secundário causa +30 % mais Dano com Acertos e Afecções
- **Earthquake_of_Amplification** (Terremoto da Amplificação) — parcial
  - efeito não simulado: Abalo Secundário causa 15 % mais Dano com Acertos por cada 0.1 segundos de Duração
  - efeito não simulado: Abalo Secundário causa 5 % mais Dano com Afecções por cada 0.1 segundos de Duração
  - efeito não simulado: Abalo Secundário tem 2 % mais Área de Efeito por cada 0.1 segundos de Duração
- **Enfeeble** (Debilitar) — parcial
  - efeito não simulado: Inimigos Amaldiçoados possuem uma redução de 19 % de Precisão
  - efeito não simulado: Duração de Maldições aumentada em 20 %
- **Ensnaring_Arrow** (Flecha Aprisionadora) — parcial
  - efeito não simulado: Inimigos Aprisionados sofrem Dano de Projétil dos Acertos de Ataques aumentado em 20 %
  - efeito não simulado: Cada Aprisionamento aplica 40 % menos Velocidade de Movimento aos Inimigos Normais ou Mágicos
  - efeito não simulado: Cada Aprisionamento aplica 30 % menos Velocidade de Movimento aos Inimigos Raros
  - efeito não simulado: Cada Aprisionamento aplica 25 % menos Velocidade de Movimento aos Inimigos Únicos
  - efeito não simulado: Efeito do Debuff aumentado em 20 %
- **Explosive_Arrow** (Flecha Explosiva) — parcial
  - efeito não simulado: Explosão causa 50 % menos Dano Base
  - efeito não simulado: Explosões terão 522 a 783 de Dano de Fogo adicional
  - efeito não simulado: +0.2 metros ao Raio da Explosão por Flecha Explosiva no Alvo, máximo de +1.2 metros
  - efeito não simulado: Explosão causa 6 % mais Dano com Acertos por Flecha Explosiva no Alvo
  - efeito não simulado: Explosão causa 3 % mais Dano com Afecções por Flecha Explosiva no Alvo
  - efeito não simulado: Máximo de +2 Flechas Explosivas grudadas em cada Inimigo
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
- **Fire_Trap** (Armadilha Flamejante) — parcial
  - efeito não simulado: 286 a 429 de Dano de Fogo adicionado contra Inimigos Queimando
- **Fire_Trap_of_Blasting** (Armadilha Flamejante da Explosão) — parcial
  - efeito não simulado: 50 % de Chance de uma Armadilha ser Ativada uma vez adicional
  - efeito não simulado: 881 a 1316 de Dano de Fogo adicionado contra Inimigos Queimando
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
- **Frost_Wall** (Parede de Gelo) — parcial
  - efeito não simulado: 0.15 segundos entre o aparecimento de seções da Parede
  - efeito não simulado: Parede terá 5.6 metros
- **Frost_Wall_of_Encroachment** (Parede de Gelo da Invasão) — parcial
  - efeito não simulado: 0.15 segundos entre o aparecimento de seções da Parede
  - efeito não simulado: Parede terá 4.6 metros
  - efeito não simulado: [DNT] Deals 10 % more Damage per active wall
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
  - efeito não simulado: Receba 15 % do Dano Físico como Dano de Gelo Extra
- **Ice_Crash_of_Cadence** (Pancada de Gelo da Cadência) — parcial
  - efeito não simulado: Receba 20 % do Dano Físico como Dano de Gelo Extra
- **Ice_Spear** (Lança Gélida) — parcial
  - efeito não simulado: Segunda forma possui um aumento de 600 % de Chance de Crítico
  - efeito não simulado: A Segunda forma possui +49 % ao Multiplicador de Acerto Crítico
  - efeito não simulado: A Segunda forma possui +40 % ao Multiplicador de Acerto Crítico
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
- **Infernal_Blow** (Golpe Infernal) — parcial
  - o uso de cadáveres não existe no jogo
  - efeito não simulado: Debuffs causam 66 % de Dano por Carga
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
  - efeito não simulado: Explosão Cinética cria 1 explosões adicionais
- **Kinetic_Rain_of_Impact** (Chuva Cinética do Impacto) — parcial
  - efeito não simulado: A área alvejada base mede 9 metros de comprimento
  - efeito não simulado: Circunferência base da área-alvo é de 4.5 metros
- **Lacerate** (Dilacerar) — parcial
  - efeito não simulado: 88 % mais Dano com Sangramento enquanto na Postura de Sangue
  - efeito não simulado: 25 % de chancer de causar Sangramento enquanto na Postura de Sangue
  - efeito não simulado: Velocidade de Ataque aumentada em 20 % caso tenha mudado de Postura Recentemente
- **Lancing_Steel** (Aço Perfurador) — parcial
  - efeito não simulado: Acertos aós o primeiro em cada Inimigo causam 60 % menos Dano
- **Lancing_Steel_of_Spraying** (Aço Perfurador da Pulverização) — parcial
  - efeito não simulado: Acertos aós o primeiro em cada Inimigo causam 90 % menos Dano
- **Lightning_Arrow_of_Electrocution** (Flecha Relampejante da Eletrocussão) — parcial
  - efeito não simulado: Flechas causam Dano ao alvo final 4 vezes adicionais após grudar
  - efeito não simulado: Raios acertam a cada 0.5 segundos
  - efeito não simulado: Flechas causam Dano ao alvo final 1 vezes adicionais após grudar
- **Lightning_Spire_Trap_of_Zapping** (Armadilha da Espiral Relampejante da Eletrização) — parcial
  - efeito não simulado: 15 % de Chance de uma Armadilha ser Ativada uma vez adicional
- **Lightning_Trap** (Armadilha Relampejante) — parcial
  - efeito não simulado: 15 % de Chance de uma Armadilha ser Ativada uma vez adicional
- **Lightning_Trap_of_Sparking** (Armadilha Relampejante das Fagulhas) — parcial
  - efeito não simulado: Projéteis Ricocheteiam ao colidirem com o terreno
  - efeito não simulado: 15 % de Chance de uma Armadilha ser Ativada uma vez adicional
- **Mana-Infused_Staff** (Cajado Impregnado de Mana) — parcial
  - efeito não simulado: a Onda Arcana é um acerto só, no anel de 2 casas em volta de você — a duração de 0,35 s e a Eficácia de 450% do dano adicionado não entram
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
- **Orb_of_Storms** (Orbe Trovejante) — parcial
  - efeito não simulado: Golpeia a cada 0.5 segundos enquanto Canalizando uma Habilidade de Raio próximo ao Orbe
  - efeito não simulado: Feixes se dividem em direção a alvos dentro de um raio base de 3.5 metros
  - efeito não simulado: Orbes desaparecem após 29 Golpes
- **Orb_of_Storms_of_Squalls** (Orbe Trovejante das Borrascas) — parcial
  - efeito não simulado: Golpeia a cada 0.5 segundos enquanto Canalizando uma Habilidade de Raio próximo ao Orbe
  - efeito não simulado: Feixes se dividem em direção a alvos dentro de um raio base de 3.8 metros
  - efeito não simulado: Orbes desaparecem após 14 Golpes
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
- **Plague_Bearer** (Infestador) — limitação do modelo idle
  - _idle:_ sai sozinha, na barra: Incuba e, no Valor Máximo da Praga com um inimigo a até 2 casas, Infesta até o Valor acabar; o raio da Infestação é de 2 casas (o PoE não publica o raio base)
- **Poachers_Mark** (Marca do Larápio) — parcial
  - efeito não simulado: Inimigos Amaldiçoados têm -20 % de Reducão de Dano Físico
  - efeito não simulado: Inimigos Amaldiçoados têm 5 % de chance de concederem uma Carga de Frenesi quando Acertados
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
- **Reave_of_Refraction** (Devastação da Refração) — parcial
  - efeito não simulado: Converte 100 % do Dano Físico para um Elemento aleatório
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
- **Sigil_of_Power** (Emblema do Poder) — parcial
  - efeito não simulado: o Raio por estágio e o "menos dano" valem para você e os inimigos na área; os aliados (a party) na área não recebem o buff
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
- **Smoke_Mine** (Mina de Fumaça) — parcial
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: Somente uma Mina deste tipo pode ser Detonada em cada Sequência de Detonação
  - efeito não simulado: Minas não podem ser Re-armadas
  - efeito não simulado: Detonação da Mina é Instantânea
- **Snipers_Mark** (Marca do Atirador) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Inimigos Amaldiçoados sofrem Dano aumentado em 29 % de Acertos de Projéteis
  - efeito não simulado: Projéteis que Acertarem Inimigos Amaldiçoados se Dividem na direção de 2 alvos adicionais
  - efeito não simulado: Inimigos Amaldiçoados sofrem Dano aumentado em 5 % de Acertos de Projéteis
- **Somatic_Shell** (Concha Somática) — parcial
  - efeito não simulado: Dano de ataques é absorvido pela concha antes de afetar a vida ou o escudo de Energia do alvo Concha pode sofrer até 100 de dano antes de explodir
- **Spectral_Helix_of_Trarthus** (Hélice Espectral de Trarthus) — parcial
  - efeito não simulado: Lança até 1 armadilhas a mais ao usar duas armas
  - efeito não simulado: 25 % menos velocidade de lançar armadilhas com arma de duas mãos
- **Spirit_Offering** (Oferenda Espiritual) — parcial
  - efeito não simulado: 1 segundos adicionais de Duração Base por Cadáver extra consumido
  - efeito não simulado: Efeito da Oferenda aumentado em 10 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
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
- **Tempest_Shield** (Escudo Tempestuoso) — parcial
  - efeito não simulado: Buff concede +25 % de Chance de Bloquear o Dano Mágico enquanto portando um Escudo
  - efeito não simulado: Buff concede Imunidade a Eletrização
- **Temporal_Chains** (Grilhões Temporais) — parcial
  - a lentidão da maldição ainda não existe no jogo
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Outros efeitos em inimigos Amaldiçoados expiram 25 % mais devagar
  - efeito não simulado: Inimigos Raros e Únicos Amaldiçoados tem 18 % menos Velocidade de Ação
  - efeito não simulado: Duração de Maldições aumentada em 20 %
- **Tornado_Shot** (Tiro Tornado) — parcial
  - efeito não simulado: Dispara 3 Projéteis secundários
- **Tornado_Shot_of_Cloudburst** (Tiro Tornado da Núvem Explosiva) — parcial
  - efeito não simulado: Dispara um Carregamento de Flechas no ar Projéteis Disparam de onde a Flecha com o Carregamento cair
- **Toxic_Rain** (Chuva Tóxica) — parcial
  - efeito não simulado: Cada Esporo aplica 5 % menos Velocidade de Movimento aos Inimigos próximos, até um máximo de 30 %
- **Toxic_Rain_of_Sporeburst** (Chuva Tóxica da Explosão de Esporos) — parcial
  - efeito não simulado: Cada Esporo aplica 5 % menos Velocidade de Movimento aos Inimigos próximos, até um máximo de 30 %
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
- **Vaal_Blight** (Infestação Vaal) — parcial
  - efeito não simulado: Velocidade de Movimento reduzida em 80 %
  - efeito não simulado: Debuff pode ter até 20 camadas de Dano
  - efeito não simulado: Inimigos Desacelerados sofrem Dano de Caos aumentado em 30 %
- **Vaal_Clarity** (Clareza Vaal) — parcial
  - efeito não simulado: Suas Habilidades e de seus aliados próximos não Custam Mana
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
- **Vaal_Firestorm** (Tormenta Flamejante Vaal) — parcial
  - efeito não simulado: Solo Ardente dura 6 segundos
  - efeito não simulado: 16 Tiros
  - efeito não simulado: Impactos têm 20 % mais Efeito em Área
- **Vaal_Grace** (Graça Vaal) — parcial
  - efeito não simulado: Você e aliados próximos têm +15 % de chance de Evadirem Acertos de Ataques
  - efeito não simulado: Dano Mágico Suprimido causado em você é Azarado
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
- **Vaal_Lightning_Trap** (Armadilha Relampejante Vaal) — parcial
  - efeito não simulado: Projéteis deixam Solo Eletrizado
  - efeito não simulado: Solo Eletrizado causa 15 % de Dano sofrido aumentado
  - efeito não simulado: Solo Eletrizado causa 5 % de Dano sofrido aumentado
- **Vaal_Molten_Shell** (Escudo Flamejante Vaal) — parcial
  - efeito não simulado: 39 % do dano de ataques é absorvido pelo bônus antes de afetar sua vida ou seu escudo de Energia Bônus pode sofrer dano equivalente a 20 % da sua armadura, até 10000
  - efeito não simulado: Reflete 9000 % do Dano sofrido pelo Buff como Dano de Fogo por segundo, ou quando o Buff expirar ou se esgotar
  - efeito não simulado: Duração do Efeito de Habilidades aumentada em 20 %
- **Vaal_Reap** (Ceifar Vaal) — parcial
  - efeito não simulado: Efeitos do Sangue Fervendo Perduram por 4 segundos
  - efeito não simulado: Concede +4 ao máximo de Cargas de Sangue
  - efeito não simulado: Concede até o máximo de Cargas de Sangue
  - efeito não simulado: Causa +5 % mais Dano por Carga Sangrenta
- **Vaal_Righteous_Fire** (Círculo Ardente Vaal) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Sacrifica 60 % do seu total de Escudo de Energia e Vida Causa 158 % do Escudo de Energia e Vida Sacrificados como Dano de Fogo por segundo
  - efeito não simulado: Concede 19 % mais Dano Mágico
- **Vaal_Smite** (Castigo Vaal) — parcial
  - efeito não simulado: Não pode ser Evadido
  - efeito não simulado: Raio acerta 30 alvos dentro de 10 metros
  - efeito não simulado: Aura faz com que Castigo ataque +1 alvos com relâmpagos
  - efeito não simulado: +10 % mais Dano em Área
- **Vaal_Storm_Call** (Invocar Tormenta Vaal) — parcial
  - efeito não simulado: Ataca um Inimigo a cada 0.2 segundos
- **Vaal_Summon_Skeletons** (Convocar Esqueletos Vaal) — parcial
  - efeito não simulado: +7 ao Máximo de Esqueletos Convocados
  - efeito não simulado: +1 ao Máximo de Esqueletos Convocados
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Vaal_Volcanic_Fissure** (Fissura Vulcânica Vaal) — parcial
  - efeito não simulado: Fissuras irrompem 2 vezes adicionais
- **Viper_Strike_of_the_Mamba** (Golpe da Víbora d Mamba) — parcial
  - efeito não simulado: Não pode infligir múltiplos envenenamentos com o mesmo ataque
  - efeito não simulado: Não pode infligir Envenenamento em Inimigos Envenenados
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
- **War_Banner** (Estandarte da Guerra) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Estandarte concede Precisão aumentada em 8 % a Você e Aliados
  - efeito não simulado: Estandarte concede 4 % mais Dano Físico com Habilidades Corpo a Corpo a Você e Aliados
- **Warlords_Mark** (Marca do Comandante) — parcial
  - efeito não simulado: Inimigos Amaldiçoados têm 5 % de chance de concederem uma Carga de Tolerância quando Acertados
- **Wither** (Definhar) — parcial
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: Definhado dura 2 segundos
  - efeito não simulado: Velocidade de Movimento reduzida em 36 %
  - efeito não simulado: Dano de Caos sofrido aumentado em 6 %
- **Zealotry** (Fanatismo) — parcial
  - efeito não simulado: Você e Aliados não-Lacaios Próximos têm 10 % de chance de criarem Solo Sagrado ao Acertar um Inimigo Raro ou Único, durando 8 segundos

## Gemas de suporte pendentes

- **Ancestral_Call_Support** (Chamado Ancestral) — parcial
  - não simulado: Alvos Extras das Habilidades Suportadas podem ser encontrados 15% mais distânte
- **Annihilation_Support** (Aniquilação (Reforço)) — parcial
  - não simulado: Golpes fatais com habilidades reforçadas fazem com que os inimigos tenham 35% de chance de explodir e causarem um décimo da própria vida máxima como dano de um elemento aleatório
  - não simulado: Golpes fatais com habilidades reforçadas fazem com que os inimigos tenham +5% de chance de explodir e causarem um décimo da própria vida máxima como dano de um elemento aleatório
- **Arcane_Surge_Support** (Fúria Arcana) — parcial
  - não simulado: Ganha Fúria Arcana após Gastar um total de 400 de Mana em Custos Diretos e Efeitos de uma Habilidade Suportada
  - não simulado: Fúria Arcana concede Velocidade de Conjuração aumentada em 30% Fúria Arcana concede Regeneração de Mana aumentada em 30%
  - não simulado: Fúria Arcana dura 4 segundos
  - não simulado: Fúria Arcana concede Velocidade de Conjuração aumentada em 30%\nFúria Arcana concede Regeneração de Mana aumentada em 30%
- **Archmage_Support** (Arquimago) — parcial
  - não simulado: Habilidades Suportadas ganham Dano de Raio Adicional igual a 14% da Mana Máxima não Reservada
  - não simulado: Habilidades reforçadas ganham custo de mana base equivalente a 5% do mana máximo não reservado
- **Awakened_Ancestral_Call_Support** (Suporte Desperto: Chamado Ancestral) — parcial
  - não simulado: Alvos Extras das Habilidades Suportadas podem ser encontrados 15% mais distânte
- **Awakened_Brutality_Support** (Suporte Desperto: Brutalidade) — parcial
  - não simulado: Habilidades Suportadas têm 10% de chance de Esmagar Inimigos por 4 segundos ao Acertar
- **Awakened_Cast_On_Critical_Strike_Support** (Suporte Desperto: Conjurar no Acerto Crítico) — parcial
  - não simulado: Magias Suportadas têm Recuperação da Recarga aumentada em 52%
- **Awakened_Cast_While_Channelling_Support** (Suporte Desperto: Conjurar ao Canalizar) — parcial
  - não simulado: Ignora Atordoamentos enquanto Usando Habilidades Suportadas
- **Awakened_Controlled_Destruction_Support** (Suporte Desperto: Destruição Controlada) — parcial
  - não simulado: Habilidades Suportadas têm 10% de chance de Enervar Inimigos por 4 segundos ao Acertar
- **Awakened_Hextouch_Support** (Suporte Desperto: Toque Maldito) — parcial
  - não simulado: Habilidades Suportadas aplicam Maldições Suportadas em Acertos
  - não simulado: Você não pode Conjurar Magias Maldição Suportadas
  - não simulado: Feitiços aplicados por habilidades de maldição reforçadas têm 34% de chance de afetar inimigos imunes a feitiços
- **Awakened_Melee_Physical_Damage_Support** (Suporte Desperto: Dano Físico Corpo a Corpo) — parcial
  - não simulado: Habilidades Suportadas têm 10% de chance de Intimidar Inimigos por 4 segundos ao Acertar
- **Awakened_Spell_Cascade_Support** (Suporte Desperto: Cascata Mágica) — parcial
  - não simulado: Habilidades de Efeito em Área Suportadas também afetam áreas na frente, atrás, e dos lados da área alvo
  - não simulado: Habilidades de Efeito em Área Suportadas também afetam áreas na frente, atrás,\ne dos lados da área alvo
- **Behead_Support** (Decapitar) — parcial
  - não simulado: Golpes Finais das Habilidades de Golpe Suportadas com Armas Corpo a Corpo contra Monstros Raros concedem um de seus Modificadores por 20 segundos
  - não simulado: 20% de chance de renovar a Duração do Modificador recebido em até 5 segundos quando você Acertar um Inimigo Raro ou Único com Habilidades Suportadas
- **Blastchain_Mine_Support** (Mina da Cadeia Explosiva) — parcial
  - não simulado: Habilidades Suportadas ganham uma Reserva Base igual ao Custo Base de Mana e Vida
- **Blessed_Call_Support** (Chamado Abençoado (Reforço)) — parcial
  - não simulado: Clamores reforçados criam um chão consagrado com duração de 6 segundos
  - não simulado: Clamores reforçados têm -40% de área de efeito
  - não simulado: Clamores reforçados têm a velocidade de recarga reduzida em 20%
- **Blind_Support** (Cegar) — parcial
  - não simulado: Habilidades Suportadas têm 10% de chance de Cegar inimigos ao acertar
  - não simulado: Habilidades Suportadas têm 38% da duração da Cegueira aumentada
- **Bloodsoaked_Banner_Support** (Estandarte Ensanguentado (Reforço)) — parcial
  - não simulado: Estandartes reforçados infligem Sangue Corrompido a cada segundo aos inimigos dentro de sua área
  - não simulado: Sangue Corrompido infligido por estandartes reforçados causam 26.7 de dano físico base por segundo por bravura consumida
  - não simulado: Sangue Corrompido infligido por estandartes reforçados tem uma duração base de 8 segundos
- **Bloodthirst_Support** (Sede de Sangue) — parcial
  - não simulado: Ataques Suportados causam Dano Físico com Armas Adicional igual a 2% da Vida Máxima enquanto em Vida Baixa
  - não simulado: Ataques Suportados causam Dano Físico com Armas Adicional igual a\n2% da Vida Máxima enquanto em Vida Baixa
- **Bonespire_Support** (Torre Óssea (Reforço)) — parcial
  - não simulado: a explosão das torres usa o físico médio da arma × 250–271% pelo acerto sem golpe (sem o crítico e os modificadores locais da arma); as torres não bloqueiam o caminho dos monstros
- **Cast_on_Ward_Break_Support** (Conjurar ao Perder Salvaguarda (Reforço)) — parcial
  - não simulado: Ativa esta magia reforçada quando sua salvaguarda quebra
- **Close_Combat_Support** (Combate Próximo) — parcial
  - não simulado: Habilidades Suportadas concedem Ímpeto de Combate ao Acertar Ímpeto de Combate dura 2 segundos ou até que você utilize uma Habilidade de Deslocamento
  - não simulado: Adrenalina de Combate concede 20% mais Velocidade de Ataque às Habilidades de Deslocamento não Suportadas por Combate Próximo
  - não simulado: Habilidades Suportadas concedem Ímpeto de Combate ao Acertar\nÍmpeto de Combate dura 2 segundos ou até que você utilize uma Habilidade de Deslocamento
- **Cluster_Traps_Support** (Grupo de Armadilhas) — parcial
  - não simulado: Habilidades Suportadas têm Efeito em Área da Ativação de Armadilhas aumentado em 20%
- **Communion_Support** (Comunhão (Reforço)) — parcial
  - não simulado: Magias reforçadas causam de 20 a 30 de dano físico adicionado para cada lacaio permanente
- **Companionship_Support** (Companheirismo (Reforço)) — parcial
  - não simulado: Lacaios de habilidades reforçadas sofrem 15% do dano de ataque da própria vida antes de você, se eles forem seus únicos lacaios
  - não simulado: Lacaios de habilidades reforçadas sofrem -28% de dano, se eles forem seus únicos lacaios
  - não simulado: Lacaios de habilidades reforçadas sofrem 15% do dano de ataque da própria vida\nantes de você, se eles forem seus únicos lacaios
- **Congregation_Support** (Congregação (Reforço)) — parcial
  - não simulado: +38% para o número máximo de lacaios de habilidades reforçadas
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
- **Crystalfall_Support** (Cristal em Queda (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ativam Cristal em Queda ao atingir
- **Cursed_Ground_Support** (Solo Maldito) — parcial
  - não simulado: Habilidades suportadas criam Solo Maldito com uma Duração base de 34 segundos Feitiços de Habilidades Suportadas não tem Duração Inimigos em Solo Maldito das Habilidades Suportadas são Amaldiçoados com tal Feitiço Limite de 1 área de Solo Maldito
- **Decay_Support** (Decadência) — parcial
  - não simulado: Habilidades Suportadas infligem Podridão ao Acertar, causando 1230 de Dano de Caos por segundo durante 8 segundos
- **Devour_Support** (Devorar) — parcial
  - não simulado: Golpes Abatedores com Habilidades Suportadas Consomem cadáveres para Recuperar 366 de Vida e 40 de Mana
- **Divine_Blessing_Support** (Bênção Divina) — parcial
  - não simulado: Habilidades Suportadas Custam +233 de Mana
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção Você só pode ter uma Aura de suas Habilidades Bênção
  - não simulado: Auras das Habilidades Suportadas têm uma duração base de 10.9 segundos
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção\nVocê só pode ter uma Aura de suas Habilidades Bênção
- **Earthbreaker_Support** (Devastador) — parcial
  - não simulado: perto do totem, você ganha Área de Efeito aumentada para Habilidades Corpo a Corpo (a descrição; o valor — ancestor_totem_grants_owner_area_of_effect_+%_with_melee_skills — não está nos dados do PoB)
- **Eldritch_Blasphemy_Support** (Blasfêmia Sobrenatural (Reforço)) — parcial
  - não simulado: Inimigos sofrem de Insanidade Perversa se estiverem sob a influência de auras de habilidades reforçadas por mais de 5 segundos
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
- **Feeding_Frenzy_Support** (Frenesi Faminto) — parcial
  - não simulado: Duração Base do Frenesi Faminto é de 5.9 segundos
  - não simulado: Lacaios de Habilidades Suportadas tem 44% de chance de conceder Frenesi Faminto à você no Acerto
  - não simulado: Lacaios de Habilidades Suportadas são Agressivos
  - não simulado: Habilidades Suportadas têm 10% de Velocidade de Movimento de Lacaios aumentada
- **Fissure_Support** (Fenda (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ativam uma fenda no impacto da pancada
  - não simulado: 60% do Dano Físico Convertido para Dano de Fogo
  - não simulado: Cria 3 fendas
  - não simulado: Cria +1 fendas
- **Flamewood_Support** (Chuva Ardente) — parcial
  - não simulado: Totens das Habilidades Suportadas ganham a Habilidade Vingança Flamejante e a Ativa quando Acertado por um Inimigo
  - não simulado: Causa Dano de Fogo base igual a 137% da Vida Máxima dos Totens
  - não simulado: Totens com esta Habilidade a Ativam quando Acertados por um Inimigo
  - não simulado: Totens das Habilidades Suportadas ganham a Habilidade\nVingança Flamejante e a Ativa quando Acertado por um Inimigo
- **Foulgrasp_Support** (Constrição Pérfida (Reforço)) — parcial
  - não simulado: Habilidades reforçadas podem conjurar 2 glifos adicionais
  - não simulado: Glifos reforçados ativam Constrição Pérfida ao serem recuperados
  - não simulado: Causa 165 a 1482 de Dano de Raio
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
  - não simulado: Habilidades reforçadas ganham dano de frio adicionado equivalente a 26% do mana máximo reservado
  - não simulado: Habilidades reforçadas ganham custo de mana base equivalente a 5% do mana máximo reservado
- **Gluttony_Support** (Gula (Reforço)) — parcial
  - não simulado: Ganha 1 de Gula ao conjurar magias reforçadas
  - não simulado: Ao atingir 10 de Gula, perde toda a Gula e ganha Regurgitação por 4 segundos
  - não simulado: Enquanto você tiver Regurgitação, as magias reforçadas disparam projéteis em círculo Enquanto você tiver Regurgitação, as magias reforçadas disparam 7 projéteis adicionais
- **Greater_Ancestral_Call_Support** (Convocação Ancestral Maior (Reforço)) — parcial
  - não simulado: Alvos Extras das Habilidades Suportadas podem ser encontrados 40% mais distânte
- **Greater_Chain_Support** (Propagação Maior (Reforço)) — parcial
  - não simulado: Habilidades reforçadas se propagam 50% mais vezes
- **Greater_Devour_Support** (Devorar Maior (Reforço)) — parcial
  - não simulado: Golpes Abatedores com Habilidades Suportadas Consomem cadáveres para Recuperar 484 de Vida e 48 de Mana
  - não simulado: Consumir um cadáver com habilidades reforçadas tem 4% de chance de conceder uma alma por poder
  - não simulado: Consumir um cadáver com habilidades reforçadas tem +1% de chance de conceder uma alma por poder
- **Greater_Kinetic_Instability_Support** (Instabilidade Cinética Maior (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ativam Fluxo Cinético ao causar golpe crítico
  - não simulado: Máximo de 20 anomalias
  - não simulado: Esta habilidade é ativada por habilidades reforçadas de Instabilidade Cinética
- **Greater_Spell_Cascade_Support** (Sequência Mágica Maior (Reforço)) — parcial
  - não simulado: Habilidades de Efeito em Área Suportadas também afetam áreas na frente, atrás, e dos lados da área alvo
  - não simulado: Habilidades de Efeito em Área Suportadas também afetam áreas na frente, atrás,\ne dos lados da área alvo
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
  - não simulado: Efeito em Área de Habilidades Maldição Suportadas reduzido em 20%
  - não simulado: Inimigos afetados por feitiços de habilidades de maldição reforçadas não podem causar golpes críticos
- **Hextoad_Support** (Sapo Enfeitiçado (Reforço)) — parcial
  - não simulado: Habilidades suportadas criam Solo Maldito com uma Duração base de 14 segundos Feitiços de Habilidades Suportadas não tem Duração Inimigos em Solo Maldito das Habilidades Suportadas são Amaldiçoados com tal Feitiço Limite de 1 área de Solo Maldito
  - não simulado: Chão amaldiçoado de habilidades reforçadas ativam Sapo Explosivo a cada 0.8 segundo
  - não simulado: Causa 2504 a 3757 de Dano de Caos
  - não simulado: Inflige Definhando por 2 segundos ao Acertar
- **Hextouch_Support** (Toque Maldito) — parcial
  - não simulado: Habilidades Suportadas aplicam Maldições Suportadas em Acertos
  - não simulado: Você não pode Conjurar Magias Maldição Suportadas
- **High-Impact_Mine_Support** (Mina de Alto Impacto) — parcial
  - não simulado: Habilidades Suportadas ganham uma Reserva Base igual ao Custo Base de Mana e Vida
  - não simulado: Cada Mina das Habilidades Suportadas aplicadas 2% de chance de causar Dano Dobrado aos Acertos contra Inimigos próximos a ele, até um máximo de 100%
- **Hiveborn_Support** (Nascido da Colmeia (Reforço)) — parcial
  - não simulado: Oferendas reforçadas ativam Invocar Nascidos da Colmeia ao usar
  - não simulado: Máximo de 12 Nascido(s) da Colmeia
  - não simulado: Invoca 5 Nascido(s) da Colmeia
  - não simulado: Lacaios têm 20% de chance de cobrir os inimigos de gelo ao atingir
  - não simulado: Máximo de 2 Nascido(s) da Colmeia
- **Ice_Bite_Support** (Mordida Congelante) — parcial
  - não simulado: Habilidades Suportadas têm 69% de chance de ganhar uma Carga de Frenesi ao Matar um Inimigo Congelado
- **Ignite_Proliferation_Support** (Proliferação de Incêndio) — parcial
  - não simulado: Incêndios causados por Habilidades Suportadas se espalham para outros Inimigos dentro de 2 metros
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
- **Iron_Grip_Support** (Empunhadura de Ferro) — parcial
  - não simulado: Bônus de Dano da Força é aplicado ao Dano de Ataque dos Projéteis assim como às Habilidades Suportadas
- **Iron_Will_Support** (Vontade de Ferro) — parcial
  - não simulado: Bônus de dano da Força também é aplicado à todo Dano Mágico para Magias Suportadas
- **Kinetic_Instability_Support** (Reforço Instabilidade Cinética) — parcial
  - não simulado: Habilidades reforçadas ativam Fluxo Cinético no golpe fatal
  - não simulado: Máximo de 20 anomalias
  - não simulado: Esta habilidade é ativada por habilidades reforçadas de Instabilidade Cinética
- **Lethal_Dose_Support** (Dose Letal (Reforço)) — parcial
  - não simulado: Envenenar inimigos não envenenados com habilidades reforçadas inflige 2 envenenamentos adicionais
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
  - não simulado: Habilidades Suportadas ganham uma Reserva Base igual ao Custo Base de Mana e Vida
  - não simulado: Minas de Habilidades Suportadas não podem ser Detonadas enquanto dentro de 3 metros de você
  - não simulado: Minas usando Habilidades Suportadas sempre focam na sua localização
  - não simulado: Habilidades Suportadas arremessam Minas em um Arco
- **Machinations_Support** (Maquinações (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ganham 8% do dano físico como dano de caos adicional por fundamental
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
- **Overexertion_Support** (Esforço Excessivo) — parcial
  - não simulado: Ataques Suportados causam 10% mais Dano por cada Clamor que os Impelir
- **Overheat_Support** (Superaquecimento (Reforço)) — parcial
  - não simulado: Habilidades reforçadas consomem toda a Fortificação ao usar, causando +8% de dano com afecções por 3 de Fortificação consumida
- **Overloaded_Intensity_Support** (Intensidade Sobrecarregada (Reforço)) — parcial
  - não simulado: Ganha uma instância de Intensidade Sobrecarregada por 10 segundos após perder 6 de Intensidade com habilidades reforçadas
  - não simulado: Habilidades reforçadas têm +1.4% de chance de causar golpe crítico por Intensidade Sobrecarregada
  - não simulado: Habilidades reforçadas têm +50% de multiplicador de golpe crítico por Intensidade Sobrecarregada
  - não simulado: Ganha uma instância de Intensidade Sobrecarregada por 10 segundos após\nperder 6 de Intensidade com habilidades reforçadas
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
  - não simulado: Cria 4 Pilares de Cinzas
  - não simulado: Cria +1 Pilar de Cinzas
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
- **Spell_Cascade_Support** (Cascata Mágica) — parcial
  - não simulado: Habilidades de Efeito em Área Suportadas também afetam áreas na frente e atrás da área alvo
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
- **Trinity_Support** (Suporte Trindade) — parcial
  - não simulado: Acertos com Habilidades Suportadas para o qual o maior Tipo de Dano for Elemental fazem com que você ganhe 25 de Ressonância de outros Elementos por 2 segundos Perde 5 de Ressonância por segundo para cada Elemento que não estiver ganhando
  - não simulado: Habilidades Suportadas causam 3% mais Dano Elemental por cada 5 da sua menor Ressonância
  - não simulado: Habilidades Suportadas penetram 16% da Resistência Elemental enquanto cada Ressonância estiver em ao menos 25
  - não simulado: Acertos com Habilidades Suportadas para o qual o maior Tipo de Dano for Elemental fazem com que você ganhe 25 de Ressonância de outros Elementos por 2 segundos\nPerde 5 de Ressonância por segundo para cada Elemento que não estiver ganhando
- **Unholy_Trinity_Support** (Tríade Profana (Reforço)) — parcial
  - não simulado: Ataques com habilidades reforçadas, cujo maior tipo de dano é caos, elétrico ou físico, fazem você ganhar 25 de Ressonância Profana dos outros tipos por segundo durante 2 segundos Perde 5 de Ressonância Profana por segundo para cada tipo que não ganhar
  - não simulado: Habilidades reforçadas têm 90% de chance de ignorar a resistência a dano de caos e elétrico do inimigo, se cada Ressonância Profana for de, no mínimo, 25
  - não simulado: Habilidades reforçadas têm 90% de chance de ignorar a redução de dano físico do inimigo, se cada Ressonância Profana for de, no mínimo, 25
  - não simulado: Ataques com habilidades reforçadas, cujo maior tipo de dano é caos, elétrico ou físico, fazem você ganhar 25 de Ressonância Profana dos outros tipos por segundo durante 2 segundos\nPerde 5 de Ressonância Profana por segundo para cada tipo que não ganhar
- **Vaal_Sacrifice_Support** (Sacrifício Vaal (Reforço)) — parcial
  - não simulado: Habilidades reforçadas sacrificam tudo, menos 1, da sua vida e escudo de energia ao usar
- **Vaal_Temptation_Support** (Tentação Vaal (Reforço)) — parcial
  - não simulado: Usar habilidades vaal reforçadas inflige Tentação Vaal em você, causando 1300 de dano físico por segundo, em vez de aplicar impedimento de ganho de almas
- **Void_Shockwave_Support** (Onda de Choque do Vazio (Reforço)) — parcial
  - não simulado: a onda usa o físico médio da arma × o "Dano de Ataque: X% de base" dela pelo acerto sem golpe (sem o crítico e os modificadores locais da arma)
- **Voidstorm_Support** (Tormenta do Vazio (Reforço)) — parcial
  - não simulado: a explosão da tempestade usa o físico médio da arma × o "Dano de Ataque: X% de base" dela pelo acerto sem golpe (sem o crítico e os modificadores locais da arma); a Cegueira dentro dela (a descrição) não é aplicada
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

## Não se aplicam ao jogo

- **Portal** (Portal) — não se aplica (não se aplica: a caçada já tem a saída para a cidade, e os 6 portais do mapa são gastos pela morte (mapa-aberto.mjs) — o portal do PoE não tem o que fazer no jogo)

## Linhas que não se aplicam ao jogo

- **Spectral_Throw_of_Materialising** (Arremesso Espectral da Materialização) — implementada e testada
  - não se aplica: "Desaceleração do Projétil reduzida" (Arremesso Espectral da Materialização) só muda a trajetória — o PoB não a usa na conta
- **Spectral_Helix** (Hélice Espectral) — implementada e testada
  - não se aplica: "Gira por N rotações" (Hélice Espectral) só muda a trajetória da espiral — o PoB não a usa na conta, e o projétil do jogo acerta no tique
- **Spectral_Helix_of_Trarthus** (Hélice Espectral de Trarthus) — parcial
  - não se aplica: "Gira por N rotações" (Hélice Espectral) só muda a trajetória da espiral — o PoB não a usa na conta, e o projétil do jogo acerta no tique
- **Kinetic_Bolt** (Tiro Cinético) — implementada e testada
  - não se aplica: "Projéteis mudam de direção N vezes" (Raio Cinético) só muda a trajetória — o projétil não acerta de novo a cada mudança
- **Kinetic_Bolt_of_Fragmentation** (Tiro Cinético da Fragmentação) — implementada, sem teste próprio
  - não se aplica: "Projéteis mudam de direção N vezes" (Raio Cinético) só muda a trajetória — o projétil não acerta de novo a cada mudança
- **Ice_Spear** (Lança Gélida) — parcial
  - não se aplica: "A Segunda forma possui X% mais Velocidade de Projétil" (Lança de Gelo) só muda a trajetória da segunda forma — o PoB não a usa na conta, e o projétil do jogo acerta no tique
- **Ice_Spear_of_Splitting** (Lança de Gelo da Divisão) — implementada, sem teste próprio
  - não se aplica: "A Segunda forma possui X% mais Velocidade de Projétil" (Lança de Gelo) só muda a trajetória da segunda forma — o PoB não a usa na conta, e o projétil do jogo acerta no tique

## Implementadas sem teste próprio

Added_Chaos_Damage_Support, Arc_of_Oscillating, Awakened_Added_Chaos_Damage_Support, Awakened_Added_Cold_Damage_Support, Awakened_Added_Fire_Damage_Support, Awakened_Added_Lightning_Damage_Support, Awakened_Arrow_Nova_Support, Awakened_Blasphemy_Support, Awakened_Burning_Damage_Support, Awakened_Chain_Support, Awakened_Deadly_Ailments_Support, Awakened_Elemental_Focus_Support, Awakened_Empower_Support, Awakened_Enlighten_Support, Awakened_Fork_Support, Awakened_Generosity_Support, Awakened_Greater_Multiple_Projectiles_Support, Awakened_Increased_Area_of_Effect_Support, Awakened_Melee_Splash_Support, Awakened_Minion_Damage_Support, Awakened_Multistrike_Support, Awakened_Swift_Affliction_Support, Awakened_Unbound_Ailments_Support, Awakened_Unleash_Support, Awakened_Vicious_Projectiles_Support, Barrage_Support, Battlemages_Cry, Blade_Trap_of_Greatswords, Blazing_Salvo, Bloodlust_Support, Brutality_Support, Cast_on_Melee_Kill_Support, Caustic_Arrow_of_Poison, Cold_Penetration_Support, Conductivity, Cooldown_Recovery_Support, Damage_on_Full_Life_Support, Detonate_Dead_of_Chain_Reaction, Elemental_Damage_with_Attacks_Support, Elemental_Penetration_Support, Elemental_Weakness, Enlighten_Support, Ethereal_Knives_of_the_Massacre, Firestorm_of_Meteors, Flameblast_of_Celerity, Flameblast_of_Contraction, Fork_Support, Frost_Bomb_of_Instability, Frozen_Legion, Frozen_Legion_of_Rallying, Generals_Cry, Glacial_Hammer_of_Shattering, Greater_Multistrike_Support, Greater_Spell_Echo_Support, Greater_Unleash_Support, Greater_Volley_Support, Ice_Nova_of_Deep_Freeze, Ice_Spear_of_Splitting, Icicle_Mine_of_Fanning, Immolate_Support, Incinerate_of_Venting, Increased_Critical_Damage_Support, Increased_Critical_Strikes_Support, Kinetic_Bolt_of_Fragmentation, Kinetic_Rain, Lacerate_of_Haemorrhage, Less_Duration_Support, Lightning_Penetration_Support, Lightning_Spire_Trap_of_Overloading, Lightning_Strike_of_Arcing, Mana_Leech_Support, Minion_Life_Support, More_Duration_Support, Multiple_Projectiles_Support, Pact_of_Ghorr, Pact_of_Lycia, Pulverise_Support, Puncture_of_Shanking, Purity_of_Ice, Purity_of_Lightning, Rain_of_Arrows_of_Artillery, Rain_of_Arrows_of_Saturation, Scorching_Ray_of_Immolation, Shattering_Steel, Spark_of_Unpredictability, Spark_of_the_Nova, Storm_Call_of_Trarthus, Stun_Support, Swift_Affliction_Support, Thunderstorm, Vaal_Arc, Vaal_Burning_Arrow, Vaal_Caustic_Arrow, Vaal_Cyclone, Vaal_Haste, Vaal_Ice_Shot, Vitality, Volatile_Dead_of_Confinement, Volcanic_Fissure
