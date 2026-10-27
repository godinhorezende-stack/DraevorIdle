# Gemas do PoE: estado da implementação

Gerado por `ITENS_POE=1 node tools/relatorio-gemas-poe.mjs` a partir do código (status no jogo de `itens-poe/gemas-poe.mjs` e `itens-poe/suportes-poe.mjs`), dos ícones em `gamedata/itens-poe/`, da compatibilidade (`suportes-compat.json`) e dos testes que citam cada gema. Nada é classificado à mão. **"Testada" quer dizer que algum teste cita a gema** — não que todas as linhas dela tenham teste.

## Totais

### Gemas de habilidade (562; ataques: 210)

| Estado | Gemas | 
|---|---|
| implementada e testada | 432 |
| implementada, sem teste próprio | 44 |
| limitação do modelo idle | 44 |
| parcial | 41 |
| não se aplica | 1 |

Só os ataques:

| Estado | Gemas |
|---|---|
| implementada e testada | 173 |
| implementada, sem teste próprio | 18 |
| limitação do modelo idle | 9 |
| parcial | 10 |

### Gemas de suporte (262)

| Estado | Gemas |
|---|---|
| implementada e testada | 159 |
| implementada, sem teste próprio | 51 |
| parcial | 52 |

### Variantes

- Vaal (52): implementada e testada 39 · parcial 4 · implementada, sem teste próprio 6 · limitação do modelo idle 3
- Alternativas (209): implementada e testada 150 · implementada, sem teste próprio 24 · parcial 12 · limitação do modelo idle 23

### Compatibilidade, efeitos compartilhados, imagens, testes

- Compatibilidade: 562 ativas e 260 suportes com regra; 58049 pares compatíveis; sem regra: 0 ativas, 2 suportes (Inspiration_Support, Pacifism_Support).
- Efeitos compartilhados faltando: 233 linhas distintas (22 em duas ou mais gemas).
- Imagens: 562/562 ativas com ícone da gema, 562/562 com ícone da habilidade, 262/262 suportes; 0 desenhos repetidos entre gemas de bases diferentes.
- Catálogo do poedb (Skill_Gems + Support_Gems, pt): 824 gemas; faltam no jogo: nenhuma; só no jogo: nenhuma.
- Testes que citam a gema: 490/562 ativas, 168/262 suportes.
- Teste geral (`testes/gemas-todas-funcionam-poe.test.mjs`): toda ativa `funciona` é usada de verdade numa caçada e precisa causar dano no alvo (ou ligar o buff); todo suporte `funciona` precisa de efeito sem linha não feita, e cada chave do efeito precisa ser lida pelo código do jogo. "Sem teste próprio" quer dizer que só esse teste geral cobre a gema.

## Linhas que faltam (por quantidade de gemas)

| Gemas | Linha |
|---|---|
| 3 | as flechas caem em linha, cada uma com dano em área e um acerto só por inimigo (act_dex.lua:##; no jogo ainda são projéteis no alvo) |
| 3 | Habilidades Suportadas ganham uma Reserva Base igual ao Custo Base de Mana e Vida |
| 3 | Habilidades Suportadas também contam como Habilidades Bênção Você só pode ter uma Aura de suas Habilidades Bênção |
| 3 | Habilidades Suportadas também contam como Habilidades Bênção\nVocê só pode ter uma Aura de suas Habilidades Bênção |
| 3 | nenhum efeito do buff tem equivalente no jogo |
| 3 | sem dano direto: nenhum efeito no combate |
| 2 | # % de chance de Convocar um Sentinela da Absolvição ao Acertar um Inimigo Raro ou Único |
| 2 | #% do Dano Físico Convertido para Dano de Fogo |
| 2 | a onda usa o físico médio da arma × o "Dano de Ataque: X% de base" dela pelo acerto sem golpe (sem o crítico e os modificadores locais da arma) |
| 2 | Causa # a # de Dano de Caos |
| 2 | Causa # a # de Dano de Raio |
| 2 | Causa # explosões menores Explosões menores têm entre # % de redução e # % de aumento do raio base, aleatoriamente |
| 2 | Causa +# explosões menores |
| 2 | Esta habilidade é ativada por habilidades reforçadas de Instabilidade Cinética |
| 2 | Habilidades suportadas criam Solo Maldito com uma Duração base de # segundos Feitiços de Habilidades Suportadas não tem Duração Inimigos em Solo Maldito das Habilidades Suportadas são Amaldiçoados com tal Feitiço Limite de # área de Solo Maldito |
| 2 | Lacaios de Habilidades Suportadas têm Chance de Golpe Crítico aumentada em #% |
| 2 | Lacaios possuem +# % de todas Resistências Elementais |
| 2 | Máximo de # anomalias |
| 2 | Raio Base da explosão menor igual a # metros |
| 2 | Sentinelas Ascendidos causam # % mais Dano |
| 2 | Sentinelas Ascendidos sofrem # % menos Dano |
| 2 | Velocidade de Movimento dos Lacaios está no Máximo |
| 1 | # % de chance de Convocar um Sentinela da Pureza ao Acertar um Inimigo Raro ou Único |
| 1 | # % mais Área de Efeito se Consumindo um Lacaio |
| 1 | # % mais Dano de Projétil |
| 1 | # % menos Dano de Afecções |
| 1 | # % menos Dano em Área |
| 1 | # metros de raio |
| 1 | #% de chance de renovar a Duração do Modificador recebido em até # segundos quando você Acertar um Inimigo Raro ou Único com Habilidades Suportadas |
| 1 | #% mais Dano em Área |
| 1 | +# % mais Dano em Área |
| 1 | +# ao número máximo de Guerreiros Ilusórios |
| 1 | +# ao número máximo de Zumbis |
| 1 | +# metros para o alcance do golpe corpo a corpo do lacaio |
| 1 | +# vez |
| 1 | a explosão da tempestade usa o físico médio da arma × o "Dano de Ataque: X% de base" dela pelo acerto sem golpe (sem o crítico e os modificadores locais da arma); a Cegueira dentro dela (a descrição) não é aplicada |
| 1 | a explosão das torres usa o físico médio da arma × #–#% pelo acerto sem golpe (sem o crítico e os modificadores locais da arma); as torres não bloqueiam o caminho dos monstros |
| 1 | A Habilidade Explosiva da Relíquia Sagrada concede # de Vida regenerada por segundo aos Aliados |
| 1 | A Habilidade Explosiva da Relíquia Sagrada concede # de Vida regenerada por segundo aos Lacaios |
| 1 | Acertos com Habilidades Suportadas para o qual o maior Tipo de Dano for Elemental fazem com que você ganhe # de Ressonância de outros Elementos por # segundos Perde # de Ressonância por segundo para cada Elemento que não estiver ganhando |
| 1 | Acertos com Habilidades Suportadas para o qual o maior Tipo de Dano for Elemental fazem com que você ganhe # de Ressonância de outros Elementos por # segundos\nPerde # de Ressonância por segundo para cada Elemento que não estiver ganhando |
| 1 | Alcance do Posicionamento de Totens aumentado em # % |
| 1 | Ao atingir # de Gula, perde toda a Gula e ganha Regurgitação por # segundos |
| 1 | Após atacar, os totens desaparecem |
| 1 | Armadilha dura +# segundo Gira |
| 1 | Arqueiro Ilusório dura # segundos |
| 1 | Arqueiro Ilusório utiliza Habilidades Suportadas com #% menos Velocidade de Ataque |
| 1 | Ataque de Impacto dos Zumbis Erguidos tem Efeito em Área aumentado em # % |
| 1 | Ataques com habilidades reforçadas, cujo maior tipo de dano é caos, elétrico ou físico, fazem você ganhar # de Ressonância Profana dos outros tipos por segundo durante # segundos Perde # de Ressonância Profana por segundo para cada tipo que não ganhar |
| 1 | Ataques com habilidades reforçadas, cujo maior tipo de dano é caos, elétrico ou físico, fazem você ganhar # de Ressonância Profana dos outros tipos por segundo durante # segundos\nPerde # de Ressonância Profana por segundo para cada tipo que não ganhar |
| 1 | Ataques reforçados ativam Rajada de Vento ao atingir, limitado a uma vez a cada # metros percorridos |
| 1 | Ativa Esta Habilidade quando um Feitiço de Habilidades Suportadas terminar |
| 1 | Ativa esta magia reforçada quando sua salvaguarda quebra |
| 1 | Ativa Explosão Destruidora quando um Feitiço de Habilidades Maldição Suportadas terminar |
| 1 | Ativa Invocar Relâmpago Vivo quando uma habilidade de reforço causa dano elétrico com o acerto |
| 1 | Ativa Invocar Relâmpago Vivo quando uma habilidade\nde reforço causa dano elétrico com o acerto |
| 1 | Aumenta a Velocidade de Conjuração dos Lacaios em # % |
| 1 | Aumenta a Velocidade de Movimento dos Lacaios em # % |
| 1 | Aura faz com que Castigo ataque +# alvos com relâmpagos |
| 1 | Auras das Habilidades Suportadas têm uma duração base de # segundos |
| 1 | Buff concede # % mais Dano Físico |
| 1 | Cada Mina das Habilidades Suportadas aplicadas #% de chance de causar Dano Dobrado aos Acertos contra Inimigos próximos a ele, até um máximo de #% |
| 1 | Causa # % do seu Escudo de Energia Máximo como Dano Base de Fogo por segundo |
| 1 | Causa # a # de Dano de Fogo |
| 1 | Causa # a # de Dano de Gelo |
| 1 | Causa Dano de Fogo base igual a #% da Vida Máxima dos Totens |
| 1 | Chão amaldiçoado de habilidades reforçadas ativam Sapo Explosivo a cada # segundo |
| 1 | Cobre Inimigos em Cinzas ao Acertar |
| 1 | Concede # % mais Dano Mágico |
| 1 | Concede # de Regeneração de Mana por segundo para cada Inimigo afetado |
| 1 | Concede # de Regeneração de Mana por segundo se qualquer Inimigo está afetado |
| 1 | Concede # de Regeneração de Vida por segundo caso um Inimigo esteja afetado |
| 1 | Concede # de Regeneração de Vida por segundo para cada Inimigo afetado |
| 1 | Concede aos Lacaios +# % de Chance de Bloquear Dano Mágico |
| 1 | Consumir um cadáver com habilidades reforçadas tem #% de chance de conceder uma alma por poder |
| 1 | Consumir um cadáver com habilidades reforçadas tem +#% de chance de conceder uma alma por poder |
| 1 | Conta o Poder total de Inimigos e Cadáveres no Alcance |
| 1 | Convoca # Espíritos Sagrados Máximo de # Espíritos Sagrados |
| 1 | Convoca # Espíritos Sagrados\nMáximo de # Espíritos Sagrados |
| 1 | Convoca um Sentinela da Pureza quando você Matar um Inimigo |
| 1 | Cria # fendas |
| 1 | Cria # mãos adicionais |
| 1 | Cria # mãos por glifo |
| 1 | Cria # Pilares de Cinzas |
| 1 | Cria +# fendas |
| 1 | Cria +# Pilar de Cinzas |
| 1 | Dano e Resfriamentos Perduram por uma Duração Base de # segundos |
| 1 | Dano e Resfriamentos Perduram por uma Duração Base de +# segundos |
| 1 | Detonação da Mina é Instantânea |
| 1 | Dispara # projéteis |
| 1 | Dispara até # Flechas em alvos diferentes |
| 1 | Duração Base do Frenesi Faminto é de # segundos |
| 1 | Efeito do Buff aumentado em # % |
| 1 | Efeito em Área de Habilidades Maldição Suportadas reduzido em #% |
| 1 | Enquanto na Postura da Areia, Buff faz com que você sofra até # % menos Dano dos Inimigos na Aura |
| 1 | Enquanto na Postura de Sangue, Aura faz com que os Inimigos sofram até # % mais Dano Físico dos Acertos |
| 1 | Enquanto você tiver Regurgitação, as magias reforçadas disparam projéteis em círculo Enquanto você tiver Regurgitação, as magias reforçadas disparam # projéteis adicionais |
| 1 | Espectros têm Duração Base de # segundos Espectros não viajam entre as Áreas |
| 1 | Espíritos Sagrados têm #% de chance de usar a Habilidade Ativadora quando voc#e disparar um Projétil com tal Habilidade |
| 1 | Espíritos Sagrados têm #% de chance de usar a Habilidade Ativadora quando voc#e disparar um\nProjétil com tal Habilidade |
| 1 | Espíritos Sagrados têm +#% de chance de usar a Habilidade Ativadora quando você disparar um Projétil com tal habilidade enquanto um Inimigo Raro ou Único estiver em sua Presença |
| 1 | Esta habilidade é ativada por habilidades de ataque reforçadas |
| 1 | Esta habilidade é ativada quando uma habilidade de reforço causa dano elétrico com o acerto |
| 1 | Esta Magia causa # a # , mais # % da sua Vida Máxima, como Dano de Fogo base |
| 1 | Estandarte concede # % mais Dano Físico com Habilidades Corpo a Corpo a Você e Aliados |
| 1 | Estandarte concede Precisão aumentada em # % a Você e Aliados |
| 1 | Este ataque e lacaios convertem # % do dano físico em dano elétrico |
| 1 | Estímulo dura # segundos |
| 1 | Explosões causam Dano de Fogo base igual a # % da Vida máxima do Lacaio |
| 1 | Feitiços aplicados por habilidades de maldição reforçadas afetam inimigos imunes a feitiços |
| 1 | Feitiços aplicados por habilidades de maldição reforçadas têm #% de chance de afetar inimigos imunes a feitiços |
| 1 | Feitiços de Habilidades Suportadas se Transferem para todos os Inimigos dentro de # metros quando o Inimigo Enfeitiçado morrer |
| 1 | Flechas caem em duas linhas perpendiculares |
| 1 | Fúria Arcana concede Velocidade de Conjuração aumentada em #% Fúria Arcana concede Regeneração de Mana aumentada em #% |
| 1 | Fúria Arcana concede Velocidade de Conjuração aumentada em #%\nFúria Arcana concede Regeneração de Mana aumentada em #% |
| 1 | Fúria Arcana dura # segundos |
| 1 | Ganha # de Gula ao conjurar magias reforçadas |
| 1 | Ganha Fúria Arcana após Gastar um total de # de Mana em Custos Diretos e Efeitos de uma Habilidade Suportada |
| 1 | Ganha Invervação ao Matar um Inimigo Eletrizado com Habilidades Suportadas |
| 1 | Ganha uma instância de Intensidade Sobrecarregada por # segundos após perder # de Intensidade com habilidades reforçadas |
| 1 | Ganha uma instância de Intensidade Sobrecarregada por # segundos após\nperder # de Intensidade com habilidades reforçadas |
| 1 | Gira # vez |
| 1 | Gira # vezes |
| 1 | Gira +# vezes se em Empunhadura Dupla |
| 1 | Glifos reforçados ativam Constrição Pérfida ao serem recuperados |
| 1 | Golpe de Impacto de Zumbis Evocados tem a Velocidade de Recarga aumentada em % |
| 1 | Habilidades de Aura Suportadas não tem Reserva |
| 1 | Habilidades reforçadas ativam Cristal em Queda ao atingir |
| 1 | Habilidades reforçadas ativam Fluxo Cinético ao causar golpe crítico |
| 1 | Habilidades reforçadas ativam Fluxo Cinético no golpe fatal |
| 1 | Habilidades reforçadas ativam uma fenda no impacto da pancada |
| 1 | Habilidades reforçadas ganham #% do dano físico como dano de caos adicional por fundamental |
| 1 | Habilidades reforçadas podem conjurar # glifos adicionais |
| 1 | Habilidades reforçadas têm #% de chance de ativar Chamado da Fogueira ao atingir inimigos incendiados corpo a corpo |
| 1 | Habilidades reforçadas têm #% de chance de ignorar a redução de dano físico do inimigo, se cada Ressonância Profana for de, no mínimo, # |
| 1 | Habilidades reforçadas têm #% de chance de ignorar a resistência a dano de caos e elétrico do inimigo, se cada Ressonância Profana for de, no mínimo, # |
| 1 | Habilidades reforçadas têm +#% de chance de causar golpe crítico por Intensidade Sobrecarregada |
| 1 | Habilidades reforçadas têm +#% de multiplicador de golpe crítico por Intensidade Sobrecarregada |
| 1 | Habilidades reforçadas têm o custo aumentado em #% por fundamental |
| 1 | Habilidades Suportadas arremessam Minas em um Arco |
| 1 | Habilidades Suportadas Ativam Explosão Prismática ao Acertar |
| 1 | Habilidades Suportadas Ativarão Convocar Espíritos Sagrados ao Acertar |
| 1 | Habilidades Suportadas causam # Dano Base de Gelo por segundo |
| 1 | Habilidades Suportadas causam #% mais Dano Elemental por cada # da sua menor Ressonância |
| 1 | Habilidades Suportadas Causam Dano e Resfriam Inimigos entre você e Alvos Vinculados |
| 1 | Habilidades Suportadas Custam +# de Mana |
| 1 | Habilidades Suportadas não podem aplicar Auras em você a menos que você tenha Lacaios de uma Habilidade Suportada |
| 1 | Habilidades Suportadas não tem Reserva |
| 1 | Habilidades Suportadas penetram #% da Resistência Elemental enquanto cada Ressonância estiver em ao menos # |
| 1 | Habilidades Suportadas só podem ser usadas com Varinhas |
| 1 | Habilidades Suportadas têm #% de Velocidade de Ataque de Lacaios aumentada |
| 1 | Habilidades Suportadas têm #% de Velocidade de Conjuração de Lacaios aumentada |
| 1 | Habilidades Suportadas têm alcance de Transferência de Feitiços aumentado em #% |
| 1 | Habilidades Suportadas têm Custo de Vida aumentado em #% |
| 1 | Habilidades Suportadas têm Efeito das Auras reduzido em #% |
| 1 | Inervação dura # segundos |
| 1 | Inflige Definhando por # segundos ao Acertar |
| 1 | Inimigos afetados por feitiços de habilidades de maldição reforçadas não podem causar golpes críticos |
| 1 | Inimigos possuem # % menos Velocidade de Movimento no início do Debuff |
| 1 | Inimigos recebem # % de aumento de Dano dos Acertos de Minas ou Armadilhas |
| 1 | Inimigos sofrem de Insanidade Perversa se estiverem sob a influência de auras de habilidades reforçadas por mais de # segundos |
| 1 | Invervação concede # a # de Dano de Raio |
| 1 | Invoca # Lacaios Relâmpagos Vivos |
| 1 | Invoca # Nascido(s) da Colmeia |
| 1 | Invoca # Totens de Balista em círculo que usam esta habilidade |
| 1 | Lacaios causam # % de Dano Físico |
| 1 | Lacaios convertem #% do Dano Físico para Dano de Raio |
| 1 | Lacaios criados por Habilidades Suportadas ganham Fúria Desperta e Adrenalina por #% de sua Duração, máximo de # segundos Fúria Desperta concede +#% de Chance de Golpe Crítico Fúria Desperta concede +#% de Multiplicador de Golpe Crítico |
| 1 | Lacaios das Habilidades Suportadas sofrem #% de sua Vida e Escudo de Energia Máximos total como Dano Físico por segundo enquanto você tiver uma Aura de uma Habilidade Suportada em você |
| 1 | Lacaios das Habilidades Suportadas têm # metros ao Raio de seu Efeito Incendiário |
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
| 1 | Lacaios Relâmpagos Vivos atacam # vezes antes de desaparecerem |
| 1 | Lacaios Relâmpagos Vivos atacam +# vezes antes de desaparecerem |
| 1 | Lacaios têm # % de chance de agravar sangramento em alvos atingidos com ataques |
| 1 | Lacaios têm # % de chance de causar Dano Dobrado |
| 1 | Lacaios têm #% de chance de cobrir os inimigos de gelo ao atingir |
| 1 | Lacaios têm Chance de Acerto Crítico aumentada em # % |
| 1 | Lacaios têm efeito de definhamento aumentado em # % |
| 1 | Lacaios têm Efeito Eletrizante aumentado em # % |
| 1 | Lacaios tem Efeito Resfriante aumentado em # % |
| 1 | Lacaios têm Recuperação da Recarga aumentada em # % |
| 1 | Libera # onda |
| 1 | Libera +# onda |
| 1 | Libera ondas a cada # segundos |
| 1 | Magias Suportadas causam # % menos Dano |
| 1 | Máximo de # Arqueiro Ilusório Convocado |
| 1 | Máximo de # Lacaios Relâmpagos Vivos |
| 1 | Máximo de # mãos |
| 1 | Máximo de # Nascido(s) da Colmeia |
| 1 | Minas de Habilidades Suportadas não podem ser Detonadas enquanto dentro de # metros de você |
| 1 | Minas não podem ser Re-armadas |
| 1 | Minas tem Velocidade de Detonação aumentada em # % |
| 1 | Minas usando Habilidades Suportadas sempre focam na sua localização |
| 1 | Modificadores ao Dano Mágico são aplicados ao efeito de Dano Degenerativo das Habilidades Suportadas |
| 1 | Não pode ser Evadido |
| 1 | Não requer um cadáver |
| 1 | o totem provoca os monstros em volta a atacá-lo (act_str.lua:##) |
| 1 | Oferendas reforçadas ativam Invocar Nascidos da Colmeia ao usar |
| 1 | perto do totem, você ganha Área de Efeito aumentada para Habilidades Corpo a Corpo (a descrição; o valor — ancestor_totem_grants_owner_area_of_effect_+%_with_melee_skills — não está nos dados do PoB) |
| 1 | Primeira Mina é Detonada Instantaneamente Minas recebem # % mais Velocidade de Detonação para cada Mina anteior na Sequência de Detonação |
| 1 | Projéteis deixam Solo Eletrizado |
| 1 | Projéteis Perfuram todos Alvos |
| 1 | Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade Arqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados |
| 1 | Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade\nArqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados |
| 1 | Raio acerta # alvo dentro de # metros |
| 1 | Raio acerta # alvos dentro de # metros |
| 1 | Robôs Rastejantes concedem # % mais Dano de Armadilhas e Minas |
| 1 | Sangramentos inflingidos por esta Habilidade causam Dano # % mais rápido |
| 1 | Solo Eletrizado causa # % de Dano sofrido aumentado |
| 1 | Somente uma Mina deste tipo pode ser Detonada em cada Sequência de Detonação |
| 1 | Suas Habilidades Não-Bênção que Reservam Mana são Desabilitadas enquanto você tiver uma Aura da Habilidade Suportada em você |
| 1 | Totens com esta Habilidade a Ativam quando Acertados por um Inimigo |
| 1 | Totens das Habilidades Suportadas ganham a Habilidade Vingança Flamejante e a Ativa quando Acertado por um Inimigo |
| 1 | Totens das Habilidades Suportadas ganham a Habilidade\nVingança Flamejante e a Ativa quando Acertado por um Inimigo |
| 1 | Um lacaio próximo ganha uma alma para cada # de vida que você gasta em custos iniciais com magias reforçadas |
| 1 | Um lacaio próximo ganha uma alma para cada # de vida que você gasta em custos\niniciais com magias reforçadas |
| 1 | Usar habilidades vaal reforçadas inflige Tentação Vaal em você, causando # de dano físico por segundo, em vez de aplicar impedimento de ganho de almas |
| 1 | Velocidade de rotação aumentada em # % se em Empunhadura Dupla |
| 1 | Você Queima por # % de sua Vida máxima por segundo como Dano de Fogo |
| 1 | Você Queima por # % do seu Escudo de Energia máximo por segundo como Dano de Fogo |

## Gemas de habilidade pendentes

- **Absolution** (Absolvição) — parcial
  - efeito não simulado: 25 % de chance de Convocar um Sentinela da Absolvição ao Acertar um Inimigo Raro ou Único
  - efeito não simulado: Lacaios têm Recuperação da Recarga aumentada em 40 %
- **Absolution_of_Inspiring** (Absolvição da Inspiração) — parcial
  - efeito não simulado: 25 % de chance de Convocar um Sentinela da Absolvição ao Acertar um Inimigo Raro ou Único
- **Animate_Guardian** (Animar Guardião) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Animate_Guardian_of_Smiting** (Guardião Animado do Castigo) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Animate_Weapon** (Animar Arma) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Animate_Weapon_of_Ranged_Arms** (Animar Arma dos Braços Distantes) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Animate_Weapon_of_Self_Reflection** (Animar Arma da Auto-reflexão) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Artillery_Ballista** (Balista de Artilharia) — parcial
  - efeito não simulado: as flechas caem em linha, cada uma com dano em área e um acerto só por inimigo (act_dex.lua:751-769; no jogo ainda são projéteis no alvo)
- **Artillery_Ballista_of_Cross_Strafe** (Balista de Artilharia do Fogo Cruzado) — parcial
  - efeito não simulado: as flechas caem em linha, cada uma com dano em área e um acerto só por inimigo (act_dex.lua:751-769; no jogo ainda são projéteis no alvo)
  - efeito não simulado: Flechas caem em duas linhas perpendiculares
- **Artillery_Ballista_of_Focus_Fire** (Balista de Artilharia do Fogo Concentrado) — parcial
  - efeito não simulado: as flechas caem em linha, cada uma com dano em área e um acerto só por inimigo (act_dex.lua:751-769; no jogo ainda são projéteis no alvo)
  - efeito não simulado: Dispara até 5 Flechas em alvos diferentes
- **Bear_Trap** (Armadilha de Urso) — parcial
  - efeito não simulado: Inimigos recebem 25 % de aumento de Dano dos Acertos de Minas ou Armadilhas
  - efeito não simulado: Inimigos possuem 80 % menos Velocidade de Movimento no início do Debuff
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
- **Blink_Arrow** (Flecha Ilusória) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Blink_Arrow_of_Bombarding_Clones** (Flecha Ilusória dos Clones Bombardeiros) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Blink_Arrow_of_Prismatic_Clones** (Flecha Ilusória dos Clones Prismáticos) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Bodyswap_of_Sacrifice** (Troca de Corpos do Sacrifício) — parcial
  - efeito não simulado: Esta Magia causa 210 a 315 , mais 4 % da sua Vida Máxima, como Dano de Fogo base
  - efeito não simulado: Explosões causam Dano de Fogo base igual a 29 % da Vida máxima do Lacaio
  - efeito não simulado: 300 % mais Área de Efeito se Consumindo um Lacaio
  - efeito não simulado: Explosões causam Dano de Fogo base igual a 5 % da Vida máxima do Lacaio
  - efeito não simulado: 50 % menos Dano de Afecções
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Bone_Offering** (Oferenda Óssea) — parcial
  - efeito não simulado: Concede aos Lacaios +34 % de Chance de Bloquear Dano Mágico
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Conversion_Trap** (Armadilha Conversora) — parcial
  - sem dano direto: nenhum efeito no combate
- **Convocation** (Convocação) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Decoy_Totem** (Totem Chamariz) — parcial
  - efeito não simulado: o totem provoca os monstros em volta a atacá-lo (act_str.lua:2416-2432)
- **Detonate_Mines** (Detonar Minas) — parcial
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: Primeira Mina é Detonada Instantaneamente Minas recebem 10 % mais Velocidade de Detonação para cada Mina anteior na Sequência de Detonação
  - efeito não simulado: Minas tem Velocidade de Detonação aumentada em 20 %
- **Dominating_Blow** (Golpe Dominador) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Dominating_Blow_of_Inspiring** (Golpe Dominador da Inspiração) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Explosive_Trap** (Armadilha Explosiva) — parcial
  - efeito não simulado: Raio Base da explosão menor igual a 3 metros
  - efeito não simulado: Causa 7 explosões menores Explosões menores têm entre 1 % de redução e 30 % de aumento do raio base, aleatoriamente
  - efeito não simulado: Causa +2 explosões menores
- **Explosive_Trap_of_Shrapnel** (Armadilha Explosiva dos Estilhaços) — parcial
  - efeito não simulado: Raio Base da explosão menor igual a 3 metros
  - efeito não simulado: Causa 7 explosões menores Explosões menores têm entre 1 % de redução e 30 % de aumento do raio base, aleatoriamente
  - efeito não simulado: Causa +2 explosões menores
- **Flesh_and_Stone** (Carne e Pedra) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Enquanto na Postura de Sangue, Aura faz com que os Inimigos sofram até 20 % mais Dano Físico dos Acertos
  - efeito não simulado: Enquanto na Postura da Areia, Buff faz com que você sofra até 19 % menos Dano dos Inimigos na Aura
- **Flesh_Offering** (Oferenda Carnal) — parcial
  - efeito não simulado: Aumenta a Velocidade de Conjuração dos Lacaios em 30 %
  - efeito não simulado: Aumenta a Velocidade de Movimento dos Lacaios em 29 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Generals_Cry** (Clamor do General) — parcial
  - efeito não simulado: Conta o Poder total de Inimigos e Cadáveres no Alcance
  - efeito não simulado: +1 ao número máximo de Guerreiros Ilusórios
- **Herald_of_Agony** (Arauto Agonizante) — parcial (nota: a Virulência fica no máximo (40 + a qualidade + a "Virulência Máxima") enquanto o Arauto está ligado e você Envenenou com ele há até 4 s, como o PoB mostra (dono, 26/10))
  - o Rastejador ataca como um lacaio de perto do jogo (o Morteiro e o Espinho da Cauda do PoE não são simulados)
- **Herald_of_Purity** (Arauto da Pureza) — parcial
  - efeito não simulado: Convoca um Sentinela da Pureza quando você Matar um Inimigo
  - efeito não simulado: 20 % de chance de Convocar um Sentinela da Pureza ao Acertar um Inimigo Raro ou Único
  - efeito não simulado: Buff concede 12 % mais Dano Físico
  - efeito não simulado: Lacaios causam 95 % de Dano Físico
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Holy_Strike** (Golpe Sagrado) — parcial
  - efeito não simulado: +2.1 metros para o alcance do golpe corpo a corpo do lacaio
  - efeito não simulado: Este ataque e lacaios convertem 50 % do dano físico em dano elétrico
  - efeito não simulado: +0.5 metros para o alcance do golpe corpo a corpo do lacaio
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Intuitive_Link** (Vínculo Intuitivo) — parcial
  - efeito não simulado: Magias Suportadas causam 44 % menos Dano
  - os acertos do alvo vinculado ainda não ativam as suas magias suportadas
- **Mirror_Arrow** (Flecha Espelhada) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Mirror_Arrow_of_Bombarding_Clones** (Flecha Espelhada dos Clones Bombardeiros) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Mirror_Arrow_of_Prismatic_Clones** (Flecha Espelhada dos Clones Prismáticos) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Plague_Bearer** (Infestador) — limitação do modelo idle
  - _idle:_ sai sozinha, na barra: Incuba e, no Valor Máximo da Praga com um inimigo a até 2 casas, Infesta até o Valor acabar; o raio da Infestação é de 2 casas (o PoE não publica o raio base)
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
- **Raise_Zombie** (Evocar Zumbi) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Raise_Zombie_of_Falling** (Evocar Zumbi da Queda) — parcial
  - efeito não simulado: +200 ao número máximo de Zumbis
  - efeito não simulado: Não requer um cadáver
  - efeito não simulado: Lacaios têm 15 % de chance de causar Dano Dobrado
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Raise_Zombie_of_Slamming** (Evocar Zumbi da Pancada) — parcial
  - efeito não simulado: Ataque de Impacto dos Zumbis Erguidos tem Efeito em Área aumentado em 76 %
  - efeito não simulado: Golpe de Impacto de Zumbis Evocados tem a Velocidade de Recarga aumentada em %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Righteous_Fire** (Círculo Ardente) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Causa 70 % do seu Escudo de Energia Máximo como Dano Base de Fogo por segundo
  - efeito não simulado: Você Queima por 90 % de sua Vida máxima por segundo como Dano de Fogo
  - efeito não simulado: Você Queima por 70 % do seu Escudo de Energia máximo por segundo como Dano de Fogo
  - efeito não simulado: Concede 39 % mais Dano Mágico
- **Seismic_Trap** (Armadilha Císmica) — parcial
  - efeito não simulado: Libera ondas a cada 0.9 segundos
  - efeito não simulado: Libera 5 onda
  - efeito não simulado: Libera +1 onda
- **Siege_Ballista_of_Trarthus** (Balista de Cerco de Trarthus) — parcial
  - efeito não simulado: Alcance do Posicionamento de Totens aumentado em 300 %
  - efeito não simulado: Invoca 1 Totens de Balista em círculo que usam esta habilidade
  - efeito não simulado: Após atacar, os totens desaparecem
  - efeito não simulado: 20 % mais Dano de Projétil
- **Siphoning_Trap** (Armadilha Sifão de Gelo) — parcial
  - efeito não simulado: Concede 324.4 de Regeneração de Vida por segundo caso um Inimigo esteja afetado
  - efeito não simulado: Concede 17.2 de Regeneração de Mana por segundo se qualquer Inimigo está afetado
  - efeito não simulado: Concede 32.4 de Regeneração de Vida por segundo para cada Inimigo afetado
  - efeito não simulado: Concede 1.7 de Regeneração de Mana por segundo para cada Inimigo afetado
- **Smite** (Castigo) — parcial
  - efeito não simulado: 20 % menos Dano em Área
  - efeito não simulado: Raio acerta 1 alvo dentro de 5 metros
  - efeito não simulado: 0 % menos Dano em Área
- **Smoke_Mine** (Mina de Fumaça) — parcial
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: Somente uma Mina deste tipo pode ser Detonada em cada Sequência de Detonação
  - efeito não simulado: Minas não podem ser Re-armadas
  - efeito não simulado: Detonação da Mina é Instantânea
- **Spirit_Offering** (Oferenda Espiritual) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Carrion_Golem** (Convocar Golem da Carniça) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Carrion_Golem_of_Hordes** (Convocar Golem da Carniça das Hordas) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Carrion_Golem_of_Scavenging** (Convocar Golem da Carniça do Saque) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Chaos_Golem** (Convocar Golem Caótico) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Chaos_Golem_of_Hordes** (Convocar Golem Caótico das Hordas) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Chaos_Golem_of_the_Maelstr%C3%B6m** (Convocar Golem Caótico do Turbilhão) — parcial
  - efeito não simulado: Lacaios têm efeito de definhamento aumentado em 20 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Flame_Golem** (Convocar Golem Flamejante) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Flame_Golem_of_Hordes** (Convocar Golem Flamejante das Hordas) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Flame_Golem_of_the_Meteor** (Convocar Golem Flamejante do Meteoro) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Holy_Relic** (Convocar Relíquia Sagrada) — parcial
  - efeito não simulado: A Habilidade Explosiva da Relíquia Sagrada concede 154.6 de Vida regenerada por segundo aos Aliados
  - efeito não simulado: A Habilidade Explosiva da Relíquia Sagrada concede 985 de Vida regenerada por segundo aos Lacaios
  - efeito não simulado: Efeito do Buff aumentado em 40 %
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Holy_Relic_of_Conviction** (Convocar Relíquia Sagrada da Convicção) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Ice_Golem** (Convocar Golem Glacial) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Ice_Golem_of_Hordes** (Convocar Golem Glacial das Hordas) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Ice_Golem_of_Shattering** (Convocar Golem Glacial do Despedaçamento) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Lightning_Golem** (Convocar Golem Relampejante) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Lightning_Golem_of_Hordes** (Convocar Golem Elétrico das Hordas) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Raging_Spirit** (Convocar Espírito Furioso) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Raging_Spirit_of_Enormity** (Convocar Espírito Furioso da Enormidade) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Reaper** (Convocar Ceifador) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Reaper_of_Eviscerating** (Convocar Ceifador da Evisceração) — parcial
  - efeito não simulado: Lacaios têm 40 % de chance de agravar sangramento em alvos atingidos com ataques
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Reaper_of_Revenants** (Convocar Ceifador dos Fantasmas) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Skeletons** (Convocar Esqueleto) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Skeletons_of_Archers** (Convocar Esqueleto dos Arqueiros) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Skeletons_of_Mages** (Convocar Esqueleto dos Magos) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Skitterbots** (Convocar Robôs Rastejantes) — parcial
  - efeito não simulado: Lacaios tem Efeito Resfriante aumentado em 19 %
  - efeito não simulado: Lacaios têm Efeito Eletrizante aumentado em 19 %
  - efeito não simulado: Robôs Rastejantes concedem 10 % mais Dano de Armadilhas e Minas
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Stone_Golem** (Convocar Golem Pedregulho) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Stone_Golem_of_Hordes** (Convocar Golem de Pedra das Hordas) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Stone_Golem_of_Safeguarding** (Convocar Golem de Pedra da Proteção) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Vaal_Absolution** (Absolvição Vaal) — parcial
  - efeito não simulado: Sentinelas Ascendidos causam 300 % mais Dano
  - efeito não simulado: Sentinelas Ascendidos sofrem 70 % menos Dano
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Vaal_Animate_Weapon** (Animar Arma Vaal) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Vaal_Domination** (Dominação Vaal) — parcial
  - efeito não simulado: Sentinelas Ascendidos causam 300 % mais Dano
  - efeito não simulado: Sentinelas Ascendidos sofrem 70 % menos Dano
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Vaal_Double_Strike** (Golpe Duplo Vaal) — limitação do modelo idle
  - _idle:_ limitação do idle: os clones do Golpe Duplo Vaal não andam no jogo — o "Clones possuem X% de aumento da Velocidade de Movimento" não tem onde valer (D4.4)
- **Vaal_Lightning_Trap** (Armadilha Relampejante Vaal) — parcial
  - efeito não simulado: Projéteis deixam Solo Eletrizado
  - efeito não simulado: Solo Eletrizado causa 15 % de Dano sofrido aumentado
  - efeito não simulado: Solo Eletrizado causa 5 % de Dano sofrido aumentado
- **Vaal_Smite** (Castigo Vaal) — parcial
  - efeito não simulado: Não pode ser Evadido
  - efeito não simulado: Raio acerta 30 alvos dentro de 10 metros
  - efeito não simulado: Aura faz com que Castigo ataque +1 alvos com relâmpagos
  - efeito não simulado: +10 % mais Dano em Área
- **Vaal_Summon_Skeletons** (Convocar Esqueletos Vaal) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **War_Banner** (Estandarte da Guerra) — parcial
  - nenhum efeito do buff tem equivalente no jogo
  - efeito não simulado: Estandarte concede Precisão aumentada em 8 % a Você e Aliados
  - efeito não simulado: Estandarte concede 4 % mais Dano Físico com Habilidades Corpo a Corpo a Você e Aliados

## Gemas de suporte pendentes

- **Arcane_Surge_Support** (Fúria Arcana) — parcial
  - não simulado: Ganha Fúria Arcana após Gastar um total de 400 de Mana em Custos Diretos e Efeitos de uma Habilidade Suportada
  - não simulado: Fúria Arcana concede Velocidade de Conjuração aumentada em 30% Fúria Arcana concede Regeneração de Mana aumentada em 30%
  - não simulado: Fúria Arcana dura 4 segundos
  - não simulado: Fúria Arcana concede Velocidade de Conjuração aumentada em 30%\nFúria Arcana concede Regeneração de Mana aumentada em 30%
- **Awakened_Hextouch_Support** (Suporte Desperto: Toque Maldito) — parcial
  - não simulado: Feitiços aplicados por habilidades de maldição reforçadas têm 34% de chance de afetar inimigos imunes a feitiços
- **Behead_Support** (Decapitar) — parcial
  - não simulado: 20% de chance de renovar a Duração do Modificador recebido em até 5 segundos quando você Acertar um Inimigo Raro ou Único com Habilidades Suportadas
- **Blastchain_Mine_Support** (Mina da Cadeia Explosiva) — parcial
  - não simulado: Habilidades Suportadas ganham uma Reserva Base igual ao Custo Base de Mana e Vida
- **Bonespire_Support** (Torre Óssea (Reforço)) — parcial
  - não simulado: a explosão das torres usa o físico médio da arma × 250–271% pelo acerto sem golpe (sem o crítico e os modificadores locais da arma); as torres não bloqueiam o caminho dos monstros
- **Cast_on_Ward_Break_Support** (Conjurar ao Perder Salvaguarda (Reforço)) — parcial
  - não simulado: Ativa esta magia reforçada quando sua salvaguarda quebra
- **Crystalfall_Support** (Cristal em Queda (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ativam Cristal em Queda ao atingir
- **Cursed_Ground_Support** (Solo Maldito) — parcial
  - não simulado: Habilidades suportadas criam Solo Maldito com uma Duração base de 34 segundos Feitiços de Habilidades Suportadas não tem Duração Inimigos em Solo Maldito das Habilidades Suportadas são Amaldiçoados com tal Feitiço Limite de 1 área de Solo Maldito
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
- **Eternal_Blessing_Support** (Bênção Eterna) — parcial
  - não simulado: Habilidades Suportadas não tem Reserva
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção Você só pode ter uma Aura de suas Habilidades Bênção
  - não simulado: Suas Habilidades Não-Bênção que Reservam Mana são Desabilitadas enquanto você tiver uma Aura da Habilidade Suportada em você
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção\nVocê só pode ter uma Aura de suas Habilidades Bênção
- **Exemplar_Support** (Exemplar (Reforço)) — parcial
  - não simulado: Lacaios de habilidades reforçadas têm a chance de causar golpe crítico aumentada em 40% toda vez que você causar um golpe crítico recentemente com um ataque, até 200%
  - não simulado: Lacaios de habilidades reforçadas têm +20% de multiplicador de golpe crítico toda vez que você causar um golpe crítico recentemente com um ataque, até +100%
  - não simulado: Lacaios de Habilidades Suportadas têm Chance de Golpe Crítico aumentada em 20%
- **Feeding_Frenzy_Support** (Frenesi Faminto) — parcial
  - não simulado: Duração Base do Frenesi Faminto é de 5.9 segundos
  - não simulado: Lacaios de Habilidades Suportadas tem 44% de chance de conceder Frenesi Faminto à você no Acerto
  - não simulado: Lacaios de Habilidades Suportadas são Agressivos
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
- **Gluttony_Support** (Gula (Reforço)) — parcial
  - não simulado: Ganha 1 de Gula ao conjurar magias reforçadas
  - não simulado: Ao atingir 10 de Gula, perde toda a Gula e ganha Regurgitação por 4 segundos
  - não simulado: Enquanto você tiver Regurgitação, as magias reforçadas disparam projéteis em círculo Enquanto você tiver Regurgitação, as magias reforçadas disparam 7 projéteis adicionais
- **Greater_Devour_Support** (Devorar Maior (Reforço)) — parcial
  - não simulado: Consumir um cadáver com habilidades reforçadas tem 4% de chance de conceder uma alma por poder
  - não simulado: Consumir um cadáver com habilidades reforçadas tem +1% de chance de conceder uma alma por poder
- **Greater_Kinetic_Instability_Support** (Instabilidade Cinética Maior (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ativam Fluxo Cinético ao causar golpe crítico
  - não simulado: Máximo de 20 anomalias
  - não simulado: Esta habilidade é ativada por habilidades reforçadas de Instabilidade Cinética
- **Guardians_Blessing_Support** (Bênção do Guardião) — parcial
  - não simulado: Habilidades Suportadas têm Efeito das Auras reduzido em 27%
  - não simulado: Habilidades de Aura Suportadas não tem Reserva
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção Você só pode ter uma Aura de suas Habilidades Bênção
  - não simulado: Habilidades Suportadas não podem aplicar Auras em você a menos que você tenha Lacaios de uma Habilidade Suportada
  - não simulado: Lacaios das Habilidades Suportadas sofrem 14.3% de sua Vida e Escudo de Energia Máximos total como Dano Físico por segundo enquanto você tiver uma Aura de uma Habilidade Suportada em você
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção\nVocê só pode ter uma Aura de suas Habilidades Bênção
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
- **High-Impact_Mine_Support** (Mina de Alto Impacto) — parcial
  - não simulado: Habilidades Suportadas ganham uma Reserva Base igual ao Custo Base de Mana e Vida
  - não simulado: Cada Mina das Habilidades Suportadas aplicadas 2% de chance de causar Dano Dobrado aos Acertos contra Inimigos próximos a ele, até um máximo de 100%
- **Hiveborn_Support** (Nascido da Colmeia (Reforço)) — parcial
  - não simulado: Oferendas reforçadas ativam Invocar Nascidos da Colmeia ao usar
  - não simulado: Máximo de 12 Nascido(s) da Colmeia
  - não simulado: Invoca 5 Nascido(s) da Colmeia
  - não simulado: Lacaios têm 20% de chance de cobrir os inimigos de gelo ao atingir
  - não simulado: Máximo de 2 Nascido(s) da Colmeia
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
- **Kinetic_Instability_Support** (Reforço Instabilidade Cinética) — parcial
  - não simulado: Habilidades reforçadas ativam Fluxo Cinético no golpe fatal
  - não simulado: Máximo de 20 anomalias
  - não simulado: Esta habilidade é ativada por habilidades reforçadas de Instabilidade Cinética
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
- **Meat_Shield_Support** (Escudo de Carne) — parcial
  - não simulado: Lacaios de Habilidades Suportadas tem 20% de chance de Provocar ao Acertar
  - não simulado: Lacaios de Habilidades Suportadas sofrem 24% menos Dano
  - não simulado: Lacaios de Habilidades Suportadas são Defensivos
  - não simulado: Lacaios de Habilidades Suportadas sofrem 5% menos Dano
- **Minion_Speed_Support** (Velocidade do Lacaio) — parcial
  - não simulado: Habilidades Suportadas têm 34% de Velocidade de Ataque de Lacaios aumentada
  - não simulado: Habilidades Suportadas têm 34% de Velocidade de Conjuração de Lacaios aumentada
- **Mirage_Archer_Support** (Arqueiro Ilusório) — parcial
  - não simulado: Máximo de 1 Arqueiro Ilusório Convocado
  - não simulado: Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade Arqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados
  - não simulado: Arqueiro Ilusório utiliza Habilidades Suportadas com 60% menos Velocidade de Ataque
  - não simulado: Arqueiro Ilusório dura 4 segundos
  - não simulado: Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade\nArqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados
- **Overloaded_Intensity_Support** (Intensidade Sobrecarregada (Reforço)) — parcial
  - não simulado: Ganha uma instância de Intensidade Sobrecarregada por 10 segundos após perder 6 de Intensidade com habilidades reforçadas
  - não simulado: Habilidades reforçadas têm +1.4% de chance de causar golpe crítico por Intensidade Sobrecarregada
  - não simulado: Habilidades reforçadas têm +50% de multiplicador de golpe crítico por Intensidade Sobrecarregada
  - não simulado: Ganha uma instância de Intensidade Sobrecarregada por 10 segundos após\nperder 6 de Intensidade com habilidades reforçadas
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
- **Sacred_Wisps_Support** (Espíritos Sagrados) — parcial
  - não simulado: Habilidades Suportadas Ativarão Convocar Espíritos Sagrados ao Acertar
  - não simulado: Habilidades Suportadas só podem ser usadas com Varinhas
  - não simulado: Convoca 2 Espíritos Sagrados Máximo de 2 Espíritos Sagrados
  - não simulado: Espíritos Sagrados têm 25% de chance de usar a Habilidade Ativadora quando voc6e disparar um Projétil com tal Habilidade
  - não simulado: Espíritos Sagrados têm +25% de chance de usar a Habilidade Ativadora quando você disparar um Projétil com tal habilidade enquanto um Inimigo Raro ou Único estiver em sua Presença
  - não simulado: Convoca 2 Espíritos Sagrados\nMáximo de 2 Espíritos Sagrados
  - não simulado: Espíritos Sagrados têm 25% de chance de usar a Habilidade Ativadora quando voc6e disparar um\nProjétil com tal Habilidade
- **Shockwave_Support** (Onda de Choque) — parcial
  - não simulado: a onda usa o físico médio da arma × o "Dano de Ataque: X% de base" dela pelo acerto sem golpe (sem o crítico e os modificadores locais da arma)
- **Transfusion_Support** (Transfusão (Reforço)) — parcial
  - não simulado: Um lacaio próximo ganha uma alma para cada 200 de vida que você gasta em custos iniciais com magias reforçadas
  - não simulado: Um lacaio próximo ganha uma alma para cada 200 de vida que você gasta em custos\niniciais com magias reforçadas
  - não simulado: Habilidades Suportadas têm Custo de Vida aumentado em 10%
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

## Não se aplicam ao jogo

- **Portal** (Portal) — não se aplica (não se aplica: a caçada já tem a saída para a cidade, e os 6 portais do mapa são gastos pela morte (mapa-aberto.mjs) — o portal do PoE não tem o que fazer no jogo)

## Linhas que não se aplicam ao jogo

- **Spectral_Throw_of_Materialising** (Arremesso Espectral da Materialização) — implementada e testada
  - não se aplica: "Desaceleração do Projétil reduzida" (Arremesso Espectral da Materialização) só muda a trajetória — o PoB não a usa na conta
- **Spectral_Helix** (Hélice Espectral) — implementada e testada
  - não se aplica: "Gira por N rotações" (Hélice Espectral) só muda a trajetória da espiral — o PoB não a usa na conta, e o projétil do jogo acerta no tique
- **Spectral_Helix_of_Trarthus** (Hélice Espectral de Trarthus) — implementada e testada
  - não se aplica: "Gira por N rotações" (Hélice Espectral) só muda a trajetória da espiral — o PoB não a usa na conta, e o projétil do jogo acerta no tique
- **Volatile_Dead** (Morto Volátil) — implementada e testada
  - não se aplica: "Velocidade de Movimento do Orbe aumentada em X%" (Morto Volátil) só muda a trajetória do orbe até o inimigo — o PoB não a usa na conta, e o orbe do jogo acerta no uso
- **Volatile_Dead_of_Seething** (Morto Volátil do Fervor) — implementada e testada
  - não se aplica: "Velocidade de Movimento do Orbe aumentada em X%" (Morto Volátil) só muda a trajetória do orbe até o inimigo — o PoB não a usa na conta, e o orbe do jogo acerta no uso
- **Kinetic_Bolt** (Tiro Cinético) — implementada e testada
  - não se aplica: "Projéteis mudam de direção N vezes" (Raio Cinético) só muda a trajetória — o projétil não acerta de novo a cada mudança
- **Kinetic_Bolt_of_Fragmentation** (Tiro Cinético da Fragmentação) — implementada, sem teste próprio
  - não se aplica: "Projéteis mudam de direção N vezes" (Raio Cinético) só muda a trajetória — o projétil não acerta de novo a cada mudança
- **Ice_Spear** (Lança Gélida) — implementada e testada
  - não se aplica: "A Segunda forma possui X% mais Velocidade de Projétil" (Lança de Gelo) só muda a trajetória da segunda forma — o PoB não a usa na conta, e o projétil do jogo acerta no tique
- **Ice_Spear_of_Splitting** (Lança de Gelo da Divisão) — implementada e testada
  - não se aplica: "A Segunda forma possui X% mais Velocidade de Projétil" (Lança de Gelo) só muda a trajetória da segunda forma — o PoB não a usa na conta, e o projétil do jogo acerta no tique

## Implementadas sem teste próprio

Added_Chaos_Damage_Support, Arc_of_Oscillating, Awakened_Added_Chaos_Damage_Support, Awakened_Added_Cold_Damage_Support, Awakened_Added_Fire_Damage_Support, Awakened_Added_Lightning_Damage_Support, Awakened_Arrow_Nova_Support, Awakened_Blasphemy_Support, Awakened_Burning_Damage_Support, Awakened_Chain_Support, Awakened_Deadly_Ailments_Support, Awakened_Elemental_Focus_Support, Awakened_Empower_Support, Awakened_Enlighten_Support, Awakened_Fork_Support, Awakened_Generosity_Support, Awakened_Greater_Multiple_Projectiles_Support, Awakened_Increased_Area_of_Effect_Support, Awakened_Melee_Splash_Support, Awakened_Minion_Damage_Support, Awakened_Multistrike_Support, Awakened_Swift_Affliction_Support, Awakened_Unbound_Ailments_Support, Awakened_Unleash_Support, Awakened_Vicious_Projectiles_Support, Barrage_Support, Blade_Trap_of_Greatswords, Blazing_Salvo, Bloodlust_Support, Brutality_Support, Cast_on_Melee_Kill_Support, Caustic_Arrow_of_Poison, Cold_Penetration_Support, Conductivity, Cooldown_Recovery_Support, Damage_on_Full_Life_Support, Detonate_Dead_of_Chain_Reaction, Elemental_Damage_with_Attacks_Support, Elemental_Penetration_Support, Elemental_Weakness, Enlighten_Support, Ethereal_Knives_of_the_Massacre, Firestorm_of_Meteors, Flameblast_of_Celerity, Flameblast_of_Contraction, Fork_Support, Frost_Bomb_of_Instability, Frozen_Legion, Frozen_Legion_of_Rallying, Glacial_Hammer_of_Shattering, Greater_Multistrike_Support, Greater_Spell_Echo_Support, Greater_Unleash_Support, Greater_Volley_Support, Ice_Nova_of_Deep_Freeze, Icicle_Mine_of_Fanning, Immolate_Support, Incinerate_of_Venting, Increased_Critical_Damage_Support, Increased_Critical_Strikes_Support, Kinetic_Bolt_of_Fragmentation, Kinetic_Rain, Lacerate_of_Haemorrhage, Less_Duration_Support, Lightning_Penetration_Support, Lightning_Spire_Trap_of_Overloading, Lightning_Strike_of_Arcing, Mana_Leech_Support, Minion_Life_Support, More_Duration_Support, Multiple_Projectiles_Support, Pact_of_Ghorr, Pact_of_Lycia, Pulverise_Support, Puncture_of_Shanking, Purity_of_Ice, Purity_of_Lightning, Rain_of_Arrows_of_Artillery, Rain_of_Arrows_of_Saturation, Scorching_Ray_of_Immolation, Shattering_Steel, Spark_of_Unpredictability, Spark_of_the_Nova, Storm_Call_of_Trarthus, Stun_Support, Swift_Affliction_Support, Thunderstorm, Vaal_Arc, Vaal_Burning_Arrow, Vaal_Caustic_Arrow, Vaal_Cyclone, Vaal_Haste, Vaal_Ice_Shot, Vitality, Volatile_Dead_of_Confinement
