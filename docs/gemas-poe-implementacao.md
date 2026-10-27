# Gemas do PoE: estado da implementação

Gerado por `ITENS_POE=1 node tools/relatorio-gemas-poe.mjs` a partir do código (status no jogo de `itens-poe/gemas-poe.mjs` e `itens-poe/suportes-poe.mjs`), dos ícones em `gamedata/itens-poe/`, da compatibilidade (`suportes-compat.json`) e dos testes que citam cada gema. Nada é classificado à mão. **"Testada" quer dizer que algum teste cita a gema** — não que todas as linhas dela tenham teste.

## Totais

### Gemas de habilidade (562; ataques: 210)

| Estado | Gemas | 
|---|---|
| implementada e testada | 448 |
| implementada, sem teste próprio | 44 |
| limitação do modelo idle | 54 |
| parcial | 15 |
| não se aplica | 1 |

Só os ataques:

| Estado | Gemas |
|---|---|
| implementada e testada | 178 |
| implementada, sem teste próprio | 18 |
| limitação do modelo idle | 10 |
| parcial | 4 |

### Gemas de suporte (262)

| Estado | Gemas |
|---|---|
| implementada e testada | 191 |
| implementada, sem teste próprio | 51 |
| parcial | 20 |

### Variantes

- Vaal (52): implementada e testada 41 · limitação do modelo idle 5 · implementada, sem teste próprio 6
- Alternativas (209): implementada e testada 154 · implementada, sem teste próprio 24 · parcial 4 · limitação do modelo idle 27

### Compatibilidade, efeitos compartilhados, imagens, testes

- Compatibilidade: 562 ativas e 260 suportes com regra; 58049 pares compatíveis; sem regra: 0 ativas, 2 suportes (Inspiration_Support, Pacifism_Support).
- Efeitos compartilhados faltando: 89 linhas distintas (8 em duas ou mais gemas).
- Imagens: 562/562 ativas com ícone da gema, 562/562 com ícone da habilidade, 262/262 suportes; 0 desenhos repetidos entre gemas de bases diferentes.
- Catálogo do poedb (Skill_Gems + Support_Gems, pt): 824 gemas; faltam no jogo: nenhuma; só no jogo: nenhuma.
- Testes que citam a gema: 505/562 ativas, 195/262 suportes.
- Teste geral (`testes/gemas-todas-funcionam-poe.test.mjs`): toda ativa `funciona` é usada de verdade numa caçada e precisa causar dano no alvo (ou ligar o buff); todo suporte `funciona` precisa de efeito sem linha não feita, e cada chave do efeito precisa ser lida pelo código do jogo. "Sem teste próprio" quer dizer que só esse teste geral cobre a gema.

## Linhas que faltam (por quantidade de gemas)

| Gemas | Linha |
|---|---|
| 3 | as flechas caem em linha, cada uma com dano em área e um acerto só por inimigo (act_dex.lua:##; no jogo ainda são projéteis no alvo) |
| 3 | Habilidades Suportadas também contam como Habilidades Bênção Você só pode ter uma Aura de suas Habilidades Bênção |
| 3 | Habilidades Suportadas também contam como Habilidades Bênção\nVocê só pode ter uma Aura de suas Habilidades Bênção |
| 2 | # % de chance de Convocar um Sentinela da Absolvição ao Acertar um Inimigo Raro ou Único |
| 2 | #% de Poder Arcano |
| 2 | Esta habilidade é ativada por habilidades reforçadas de Instabilidade Cinética |
| 2 | Máximo de # anomalias |
| 2 | sem dano direto: nenhum efeito no combate |
| 1 | # % de chance de Convocar um Sentinela da Pureza ao Acertar um Inimigo Raro ou Único |
| 1 | +# ao número máximo de Guerreiros Ilusórios |
| 1 | A Habilidade Explosiva da Relíquia Sagrada concede # de Vida regenerada por segundo aos Aliados |
| 1 | A Habilidade Explosiva da Relíquia Sagrada concede # de Vida regenerada por segundo aos Lacaios |
| 1 | Arqueiro Ilusório dura # segundos |
| 1 | Arqueiro Ilusório utiliza Habilidades Suportadas com #% menos Velocidade de Ataque |
| 1 | as torres de osso não bloqueiam o caminho dos monstros (o caminho dos bichos não tem obstáculo temporário) |
| 1 | Ativa esta magia reforçada quando sua salvaguarda quebra |
| 1 | Ativa Invocar Relâmpago Vivo quando uma habilidade de reforço causa dano elétrico com o acerto |
| 1 | Ativa Invocar Relâmpago Vivo quando uma habilidade\nde reforço causa dano elétrico com o acerto |
| 1 | Auras das Habilidades Suportadas têm uma duração base de # segundos |
| 1 | Buff concede # % mais Dano Físico |
| 1 | Causa # a # de Dano de Raio |
| 1 | Causa Dano de Fogo base igual a #% da Vida Máxima dos Totens |
| 1 | Consumir um cadáver com habilidades reforçadas tem #% de chance de conceder uma alma por poder |
| 1 | Consumir um cadáver com habilidades reforçadas tem +#% de chance de conceder uma alma por poder |
| 1 | Conta o Poder total de Inimigos e Cadáveres no Alcance |
| 1 | Convoca # Espíritos Sagrados Máximo de # Espíritos Sagrados |
| 1 | Convoca # Espíritos Sagrados\nMáximo de # Espíritos Sagrados |
| 1 | Convoca um Sentinela da Pureza quando você Matar um Inimigo |
| 1 | Cria # mãos adicionais |
| 1 | Cria # mãos por glifo |
| 1 | Dano e Resfriamentos Perduram por uma Duração Base de # segundos |
| 1 | Dano e Resfriamentos Perduram por uma Duração Base de +# segundos |
| 1 | Detonação da Mina é Instantânea |
| 1 | Dispara até # Flechas em alvos diferentes |
| 1 | Efeito do Buff aumentado em # % |
| 1 | Espíritos Sagrados têm #% de chance de usar a Habilidade Ativadora quando voc#e disparar um Projétil com tal Habilidade |
| 1 | Espíritos Sagrados têm #% de chance de usar a Habilidade Ativadora quando voc#e disparar um\nProjétil com tal Habilidade |
| 1 | Espíritos Sagrados têm +#% de chance de usar a Habilidade Ativadora quando você disparar um Projétil com tal habilidade enquanto um Inimigo Raro ou Único estiver em sua Presença |
| 1 | Esta habilidade é ativada quando uma habilidade de reforço causa dano elétrico com o acerto |
| 1 | Este ataque e lacaios convertem # % do dano físico em dano elétrico |
| 1 | Flechas caem em duas linhas perpendiculares |
| 1 | Glifos reforçados ativam Constrição Pérfida ao serem recuperados |
| 1 | Habilidades de Aura Suportadas não tem Reserva |
| 1 | Habilidades dos Lacaios Ricocheteiam +# Vezes |
| 1 | Habilidades reforçadas ativam Fluxo Cinético ao causar golpe crítico |
| 1 | Habilidades reforçadas ativam Fluxo Cinético no golpe fatal |
| 1 | Habilidades reforçadas ganham #% do dano físico como dano de caos adicional por fundamental |
| 1 | Habilidades reforçadas podem conjurar # glifos adicionais |
| 1 | Habilidades reforçadas têm o custo aumentado em #% por fundamental |
| 1 | Habilidades Suportadas arremessam Minas em um Arco |
| 1 | Habilidades Suportadas Ativarão Convocar Espíritos Sagrados ao Acertar |
| 1 | Habilidades Suportadas causam # Dano Base de Gelo por segundo |
| 1 | Habilidades Suportadas causam #% menos Dano quando usadas por Espíritos Sagrados |
| 1 | Habilidades Suportadas Causam Dano e Resfriam Inimigos entre você e Alvos Vinculados |
| 1 | Habilidades Suportadas Custam +# de Mana |
| 1 | Habilidades Suportadas não podem aplicar Auras em você a menos que você tenha Lacaios de uma Habilidade Suportada |
| 1 | Habilidades Suportadas não tem Reserva |
| 1 | Habilidades Suportadas só podem ser usadas com Varinhas |
| 1 | Habilidades Suportadas têm Efeito das Auras reduzido em #% |
| 1 | Inimigos sofrem de Insanidade Perversa se estiverem sob a influência de auras de habilidades reforçadas por mais de # segundos |
| 1 | Invoca # Lacaios Relâmpagos Vivos |
| 1 | Invoca # Nascido(s) da Colmeia |
| 1 | Lacaios causam # % de Dano Físico |
| 1 | Lacaios convertem #% do Dano Físico para Dano de Raio |
| 1 | Lacaios das Habilidades Suportadas sofrem #% de sua Vida e Escudo de Energia Máximos total como Dano Físico por segundo enquanto você tiver uma Aura de uma Habilidade Suportada em você |
| 1 | Lacaios Relâmpagos Vivos atacam # vezes antes de desaparecerem |
| 1 | Lacaios Relâmpagos Vivos atacam +# vezes antes de desaparecerem |
| 1 | Lacaios têm #% de chance de cobrir os inimigos de gelo ao atingir |
| 1 | Lacaios têm efeito de definhamento aumentado em # % |
| 1 | Lacaios têm Recuperação da Recarga aumentada em # % |
| 1 | Magias Suportadas causam # % menos Dano |
| 1 | Máximo de # Arqueiro Ilusório Convocado |
| 1 | Máximo de # Lacaios Relâmpagos Vivos |
| 1 | Máximo de # mãos |
| 1 | Máximo de # Nascido(s) da Colmeia |
| 1 | Minas de Habilidades Suportadas não podem ser Detonadas enquanto dentro de # metros de você |
| 1 | Minas usando Habilidades Suportadas sempre focam na sua localização |
| 1 | Modificadores ao Dano Mágico são aplicados ao efeito de Dano Degenerativo das Habilidades Suportadas |
| 1 | o impedimento de ganho de almas que a Tentação substitui (o jogo não tem o Impedimento de Ganho de Almas: as almas das gemas Vaal são a recarga) |
| 1 | o totem provoca os monstros em volta a atacá-lo (act_str.lua:##) |
| 1 | Oferendas reforçadas ativam Invocar Nascidos da Colmeia ao usar |
| 1 | perto do totem, você ganha Área de Efeito aumentada para Habilidades Corpo a Corpo (a descrição; o valor — ancestor_totem_grants_owner_area_of_effect_+%_with_melee_skills — não está nos dados do PoB) |
| 1 | Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade Arqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados |
| 1 | Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade\nArqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados |
| 1 | Somente uma Mina deste tipo pode ser Detonada em cada Sequência de Detonação |
| 1 | Suas Habilidades Não-Bênção que Reservam Mana são Desabilitadas enquanto você tiver uma Aura da Habilidade Suportada em você |
| 1 | Totens com esta Habilidade a Ativam quando Acertados por um Inimigo |
| 1 | Totens das Habilidades Suportadas ganham a Habilidade Vingança Flamejante e a Ativa quando Acertado por um Inimigo |
| 1 | Totens das Habilidades Suportadas ganham a Habilidade\nVingança Flamejante e a Ativa quando Acertado por um Inimigo |

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
- **Blink_Arrow** (Flecha Ilusória) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Blink_Arrow_of_Bombarding_Clones** (Flecha Ilusória dos Clones Bombardeiros) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Blink_Arrow_of_Prismatic_Clones** (Flecha Ilusória dos Clones Prismáticos) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Bone_Offering** (Oferenda Óssea) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Conversion_Trap** (Armadilha Conversora) — parcial
  - sem dano direto: nenhum efeito no combate
- **Convocation** (Convocação) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Decoy_Totem** (Totem Chamariz) — parcial
  - efeito não simulado: o totem provoca os monstros em volta a atacá-lo (act_str.lua:2416-2432)
- **Dominating_Blow** (Golpe Dominador) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Dominating_Blow_of_Inspiring** (Golpe Dominador da Inspiração) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Flesh_Offering** (Oferenda Carnal) — limitação do modelo idle
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
  - efeito não simulado: Este ataque e lacaios convertem 50 % do dano físico em dano elétrico
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
- **Raise_Spectre** (Evocar Espectro) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Raise_Spectre_of_Transience** (Evocar Espectro da Transitoriedade) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Raise_Zombie** (Evocar Zumbi) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Raise_Zombie_of_Falling** (Evocar Zumbi da Queda) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Raise_Zombie_of_Slamming** (Evocar Zumbi da Pancada) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Smoke_Mine** (Mina de Fumaça) — parcial
  - sem dano direto: nenhum efeito no combate
  - efeito não simulado: Somente uma Mina deste tipo pode ser Detonada em cada Sequência de Detonação
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
- **Summon_Reaper_of_Eviscerating** (Convocar Ceifador da Evisceração) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Reaper_of_Revenants** (Convocar Ceifador dos Fantasmas) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Skeletons** (Convocar Esqueleto) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Skeletons_of_Archers** (Convocar Esqueleto dos Arqueiros) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Skeletons_of_Mages** (Convocar Esqueleto dos Magos) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Skitterbots** (Convocar Robôs Rastejantes) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Stone_Golem** (Convocar Golem Pedregulho) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Stone_Golem_of_Hordes** (Convocar Golem de Pedra das Hordas) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Stone_Golem_of_Safeguarding** (Convocar Golem de Pedra da Proteção) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Vaal_Absolution** (Absolvição Vaal) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Vaal_Animate_Weapon** (Animar Arma Vaal) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Vaal_Domination** (Dominação Vaal) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Vaal_Double_Strike** (Golpe Duplo Vaal) — limitação do modelo idle
  - _idle:_ limitação do idle: os clones do Golpe Duplo Vaal não andam no jogo — o "Clones possuem X% de aumento da Velocidade de Movimento" não tem onde valer (D4.4)
- **Vaal_Summon_Skeletons** (Convocar Esqueletos Vaal) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro

## Gemas de suporte pendentes

- **Bonespire_Support** (Torre Óssea (Reforço)) — parcial
  - não simulado: as torres de osso não bloqueiam o caminho dos monstros (o caminho dos bichos não tem obstáculo temporário)
- **Cast_on_Ward_Break_Support** (Conjurar ao Perder Salvaguarda (Reforço)) — parcial
  - não simulado: Ativa esta magia reforçada quando sua salvaguarda quebra
- **Divine_Blessing_Support** (Bênção Divina) — parcial
  - não simulado: Habilidades Suportadas Custam +233 de Mana
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção Você só pode ter uma Aura de suas Habilidades Bênção
  - não simulado: Auras das Habilidades Suportadas têm uma duração base de 10.9 segundos
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção\nVocê só pode ter uma Aura de suas Habilidades Bênção
- **Earthbreaker_Support** (Devastador) — parcial
  - não simulado: perto do totem, você ganha Área de Efeito aumentada para Habilidades Corpo a Corpo (a descrição; o valor — ancestor_totem_grants_owner_area_of_effect_+%_with_melee_skills — não está nos dados do PoB)
- **Eldritch_Blasphemy_Support** (Blasfêmia Sobrenatural (Reforço)) — parcial
  - não simulado: Inimigos sofrem de Insanidade Perversa se estiverem sob a influência de auras de habilidades reforçadas por mais de 5 segundos
- **Eternal_Blessing_Support** (Bênção Eterna) — parcial
  - não simulado: Habilidades Suportadas não tem Reserva
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção Você só pode ter uma Aura de suas Habilidades Bênção
  - não simulado: Suas Habilidades Não-Bênção que Reservam Mana são Desabilitadas enquanto você tiver uma Aura da Habilidade Suportada em você
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção\nVocê só pode ter uma Aura de suas Habilidades Bênção
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
- **Frigid_Bond_Support** (Vínculo Frígido) — parcial
  - não simulado: Habilidades Suportadas Causam Dano e Resfriam Inimigos entre você e Alvos Vinculados
  - não simulado: Habilidades Suportadas causam 4335.8 Dano Base de Gelo por segundo
  - não simulado: Dano e Resfriamentos Perduram por uma Duração Base de 3 segundos
  - não simulado: Modificadores ao Dano Mágico são aplicados ao efeito de Dano Degenerativo das Habilidades Suportadas
  - não simulado: Dano e Resfriamentos Perduram por uma Duração Base de +2 segundos
- **Greater_Devour_Support** (Devorar Maior (Reforço)) — parcial
  - não simulado: Consumir um cadáver com habilidades reforçadas tem 4% de chance de conceder uma alma por poder
  - não simulado: Consumir um cadáver com habilidades reforçadas tem +1% de chance de conceder uma alma por poder
- **Greater_Kinetic_Instability_Support** (Instabilidade Cinética Maior (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ativam Fluxo Cinético ao causar golpe crítico
  - não simulado: 150% de Poder Arcano
  - não simulado: Máximo de 20 anomalias
  - não simulado: Esta habilidade é ativada por habilidades reforçadas de Instabilidade Cinética
- **Guardians_Blessing_Support** (Bênção do Guardião) — parcial
  - não simulado: Habilidades Suportadas têm Efeito das Auras reduzido em 27%
  - não simulado: Habilidades de Aura Suportadas não tem Reserva
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção Você só pode ter uma Aura de suas Habilidades Bênção
  - não simulado: Habilidades Suportadas não podem aplicar Auras em você a menos que você tenha Lacaios de uma Habilidade Suportada
  - não simulado: Lacaios das Habilidades Suportadas sofrem 14.3% de sua Vida e Escudo de Energia Máximos total como Dano Físico por segundo enquanto você tiver uma Aura de uma Habilidade Suportada em você
  - não simulado: Habilidades Suportadas também contam como Habilidades Bênção\nVocê só pode ter uma Aura de suas Habilidades Bênção
- **Hiveborn_Support** (Nascido da Colmeia (Reforço)) — parcial
  - não simulado: Oferendas reforçadas ativam Invocar Nascidos da Colmeia ao usar
  - não simulado: Máximo de 12 Nascido(s) da Colmeia
  - não simulado: Invoca 5 Nascido(s) da Colmeia
  - não simulado: Lacaios têm 20% de chance de cobrir os inimigos de gelo ao atingir
  - não simulado: Máximo de 2 Nascido(s) da Colmeia
- **Kinetic_Instability_Support** (Reforço Instabilidade Cinética) — parcial
  - não simulado: Habilidades reforçadas ativam Fluxo Cinético no golpe fatal
  - não simulado: 150% de Poder Arcano
  - não simulado: Máximo de 20 anomalias
  - não simulado: Esta habilidade é ativada por habilidades reforçadas de Instabilidade Cinética
- **Living_Lightning_Support** (Reforço Relâmpago Vivo) — parcial
  - não simulado: Ativa Invocar Relâmpago Vivo quando uma habilidade de reforço causa dano elétrico com o acerto
  - não simulado: Lacaios convertem 100% do Dano Físico para Dano de Raio
  - não simulado: Máximo de 8 Lacaios Relâmpagos Vivos
  - não simulado: Invoca 1 Lacaios Relâmpagos Vivos
  - não simulado: Lacaios Relâmpagos Vivos atacam 3 vezes antes de desaparecerem
  - não simulado: Esta habilidade é ativada quando uma habilidade de reforço causa dano elétrico com o acerto
  - não simulado: Habilidades dos Lacaios Ricocheteiam +3 Vezes
  - não simulado: Ativa Invocar Relâmpago Vivo quando uma habilidade\nde reforço causa dano elétrico com o acerto
  - não simulado: Lacaios Relâmpagos Vivos atacam +2 vezes antes de desaparecerem
- **Locus_Mine_Support** (Mina Local) — parcial
  - não simulado: Minas de Habilidades Suportadas não podem ser Detonadas enquanto dentro de 3 metros de você
  - não simulado: Minas usando Habilidades Suportadas sempre focam na sua localização
  - não simulado: Habilidades Suportadas arremessam Minas em um Arco
- **Machinations_Support** (Maquinações (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ganham 8% do dano físico como dano de caos adicional por fundamental
  - não simulado: Habilidades reforçadas têm o custo aumentado em 10% por fundamental
- **Mirage_Archer_Support** (Arqueiro Ilusório) — parcial
  - não simulado: Máximo de 1 Arqueiro Ilusório Convocado
  - não simulado: Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade Arqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados
  - não simulado: Arqueiro Ilusório utiliza Habilidades Suportadas com 60% menos Velocidade de Ataque
  - não simulado: Arqueiro Ilusório dura 4 segundos
  - não simulado: Quando você Acertar um Inimigo com uma Flecha de uma Habilidade Suportada, Convoca um Arqueiro Ilusório que utiliza tal Habilidade\nArqueiros Ilusórios podem usar Ataques Ativados como se não fossem Ativados
- **Sacred_Wisps_Support** (Espíritos Sagrados) — parcial
  - não simulado: Habilidades Suportadas causam 51% menos Dano quando usadas por Espíritos Sagrados
  - não simulado: Habilidades Suportadas Ativarão Convocar Espíritos Sagrados ao Acertar
  - não simulado: Habilidades Suportadas só podem ser usadas com Varinhas
  - não simulado: Convoca 2 Espíritos Sagrados Máximo de 2 Espíritos Sagrados
  - não simulado: Espíritos Sagrados têm 25% de chance de usar a Habilidade Ativadora quando voc6e disparar um Projétil com tal Habilidade
  - não simulado: Espíritos Sagrados têm +25% de chance de usar a Habilidade Ativadora quando você disparar um Projétil com tal habilidade enquanto um Inimigo Raro ou Único estiver em sua Presença
  - não simulado: Convoca 2 Espíritos Sagrados\nMáximo de 2 Espíritos Sagrados
  - não simulado: Espíritos Sagrados têm 25% de chance de usar a Habilidade Ativadora quando voc6e disparar um\nProjétil com tal Habilidade
- **Vaal_Temptation_Support** (Tentação Vaal (Reforço)) — parcial
  - não simulado: o impedimento de ganho de almas que a Tentação substitui (o jogo não tem o Impedimento de Ganho de Almas: as almas das gemas Vaal são a recarga)

## Não se aplicam ao jogo

- **Portal** (Portal) — não se aplica (não se aplica: a caçada já tem a saída para a cidade, e os 6 portais do mapa são gastos pela morte (mapa-aberto.mjs) — o portal do PoE não tem o que fazer no jogo)

## Linhas que não se aplicam ao jogo

- **Spectral_Throw_of_Materialising** (Arremesso Espectral da Materialização) — implementada e testada
  - não se aplica: "Desaceleração do Projétil reduzida" (Arremesso Espectral da Materialização) só muda a trajetória — o PoB não a usa na conta
- **Smoke_Mine** (Mina de Fumaça) — parcial
  - não se aplica: "Minas não podem ser Re-armadas" (Mina de Fumaça) — o jogo não tem Re-armar Minas (aval do dono 27/10)
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
