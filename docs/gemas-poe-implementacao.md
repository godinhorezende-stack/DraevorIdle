# Gemas do PoE: estado da implementação

Gerado por `ITENS_POE=1 node tools/relatorio-gemas-poe.mjs` a partir do código (status no jogo de `itens-poe/gemas-poe.mjs` e `itens-poe/suportes-poe.mjs`), dos ícones em `gamedata/itens-poe/`, da compatibilidade (`suportes-compat.json`) e dos testes que citam cada gema. Nada é classificado à mão. **"Testada" quer dizer que algum teste cita a gema** — não que todas as linhas dela tenham teste.

## Totais

### Gemas de habilidade (562; ataques: 210)

| Estado | Gemas | 
|---|---|
| implementada e testada | 456 |
| implementada, sem teste próprio | 44 |
| limitação do modelo idle | 60 |
| parcial | 1 |
| não se aplica | 1 |

Só os ataques:

| Estado | Gemas |
|---|---|
| implementada e testada | 181 |
| implementada, sem teste próprio | 18 |
| limitação do modelo idle | 11 |

### Gemas de suporte (262)

| Estado | Gemas |
|---|---|
| implementada e testada | 209 |
| implementada, sem teste próprio | 49 |
| parcial | 3 |
| não se aplica | 1 |

### Variantes

- Vaal (52): implementada e testada 41 · limitação do modelo idle 5 · implementada, sem teste próprio 6
- Alternativas (209): implementada e testada 156 · implementada, sem teste próprio 24 · limitação do modelo idle 29

### Compatibilidade, efeitos compartilhados, imagens, testes

- Compatibilidade: 562 ativas e 260 suportes com regra; 58049 pares compatíveis; sem regra: 0 ativas, 2 suportes (Inspiration_Support, Pacifism_Support).
- Efeitos compartilhados faltando: 5 linhas distintas (0 em duas ou mais gemas).
- Imagens: 562/562 ativas com ícone da gema, 562/562 com ícone da habilidade, 262/262 suportes; 0 desenhos repetidos entre gemas de bases diferentes.
- Catálogo do poedb (Skill_Gems + Support_Gems, pt): 824 gemas; faltam no jogo: nenhuma; só no jogo: nenhuma.
- Testes que citam a gema: 510/562 ativas, 212/262 suportes.
- Teste geral (`testes/gemas-todas-funcionam-poe.test.mjs`): toda ativa `funciona` é usada de verdade numa caçada e precisa causar dano no alvo (ou ligar o buff); todo suporte `funciona` precisa de efeito sem linha não feita, e cada chave do efeito precisa ser lida pelo código do jogo. "Sem teste próprio" quer dizer que só esse teste geral cobre a gema.

## Linhas que faltam (por quantidade de gemas)

| Gemas | Linha |
|---|---|
| 1 | Habilidades reforçadas ganham #% do dano físico como dano de caos adicional por fundamental |
| 1 | Habilidades reforçadas têm o custo aumentado em #% por fundamental |
| 1 | Magias Suportadas causam # % menos Dano |
| 1 | o impedimento de ganho de almas que a Tentação substitui (o jogo não tem o Impedimento de Ganho de Almas: as almas das gemas Vaal são a recarga) |
| 1 | perto do totem, você ganha Área de Efeito aumentada para Habilidades Corpo a Corpo (a descrição; o valor — ancestor_totem_grants_owner_area_of_effect_+%_with_melee_skills — não está nos dados do PoB) |

## Gemas de habilidade pendentes

- **Absolution** (Absolvição) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Absolution_of_Inspiring** (Absolvição da Inspiração) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
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
- **Blink_Arrow** (Flecha Ilusória) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Blink_Arrow_of_Bombarding_Clones** (Flecha Ilusória dos Clones Bombardeiros) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Blink_Arrow_of_Prismatic_Clones** (Flecha Ilusória dos Clones Prismáticos) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Bone_Offering** (Oferenda Óssea) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Convocation** (Convocação) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Dominating_Blow** (Golpe Dominador) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Dominating_Blow_of_Inspiring** (Golpe Dominador da Inspiração) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Flesh_Offering** (Oferenda Carnal) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Herald_of_Purity** (Arauto da Pureza) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Holy_Strike** (Golpe Sagrado) — limitação do modelo idle
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
- **Summon_Chaos_Golem_of_the_Maelstr%C3%B6m** (Convocar Golem Caótico do Turbilhão) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Flame_Golem** (Convocar Golem Flamejante) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Flame_Golem_of_Hordes** (Convocar Golem Flamejante das Hordas) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Flame_Golem_of_the_Meteor** (Convocar Golem Flamejante do Meteoro) — limitação do modelo idle
  - _idle:_ o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro
- **Summon_Holy_Relic** (Convocar Relíquia Sagrada) — limitação do modelo idle
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

- **Earthbreaker_Support** (Devastador) — parcial
  - não simulado: perto do totem, você ganha Área de Efeito aumentada para Habilidades Corpo a Corpo (a descrição; o valor — ancestor_totem_grants_owner_area_of_effect_+%_with_melee_skills — não está nos dados do PoB)
- **Machinations_Support** (Maquinações (Reforço)) — parcial
  - não simulado: Habilidades reforçadas ganham 8% do dano físico como dano de caos adicional por fundamental
  - não simulado: Habilidades reforçadas têm o custo aumentado em 10% por fundamental
- **Vaal_Temptation_Support** (Tentação Vaal (Reforço)) — parcial
  - não simulado: o impedimento de ganho de almas que a Tentação substitui (o jogo não tem o Impedimento de Ganho de Almas: as almas das gemas Vaal são a recarga)

## Não se aplicam ao jogo

- **Portal** (Portal) — não se aplica (não se aplica: a caçada já tem a saída para a cidade, e os 6 portais do mapa são gastos pela morte (mapa-aberto.mjs) — o portal do PoE não tem o que fazer no jogo)
- **Cast_on_Ward_Break_Support** (Conjurar ao Perder Salvaguarda (Reforço)) — não se aplica (não se aplica: o jogo não tem Salvaguarda (Ward), então a salvaguarda nunca quebra e a magia nunca seria ativada (aval do dono 27/10))
  - não se aplica: o jogo não tem Salvaguarda (Ward), então a salvaguarda nunca quebra e a magia nunca seria ativada (aval do dono 27/10)

## Linhas que não se aplicam ao jogo

- **Spectral_Throw_of_Materialising** (Arremesso Espectral da Materialização) — implementada e testada
  - não se aplica: "Desaceleração do Projétil reduzida" (Arremesso Espectral da Materialização) só muda a trajetória — o PoB não a usa na conta
- **Smoke_Mine** (Mina de Fumaça) — implementada e testada
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

Added_Chaos_Damage_Support, Arc_of_Oscillating, Awakened_Added_Chaos_Damage_Support, Awakened_Added_Cold_Damage_Support, Awakened_Added_Fire_Damage_Support, Awakened_Added_Lightning_Damage_Support, Awakened_Arrow_Nova_Support, Awakened_Blasphemy_Support, Awakened_Burning_Damage_Support, Awakened_Chain_Support, Awakened_Deadly_Ailments_Support, Awakened_Elemental_Focus_Support, Awakened_Empower_Support, Awakened_Enlighten_Support, Awakened_Fork_Support, Awakened_Generosity_Support, Awakened_Greater_Multiple_Projectiles_Support, Awakened_Increased_Area_of_Effect_Support, Awakened_Melee_Splash_Support, Awakened_Minion_Damage_Support, Awakened_Multistrike_Support, Awakened_Swift_Affliction_Support, Awakened_Unbound_Ailments_Support, Awakened_Unleash_Support, Awakened_Vicious_Projectiles_Support, Barrage_Support, Blade_Trap_of_Greatswords, Blazing_Salvo, Bloodlust_Support, Cast_on_Melee_Kill_Support, Caustic_Arrow_of_Poison, Cold_Penetration_Support, Conductivity, Cooldown_Recovery_Support, Damage_on_Full_Life_Support, Detonate_Dead_of_Chain_Reaction, Elemental_Penetration_Support, Elemental_Weakness, Enlighten_Support, Ethereal_Knives_of_the_Massacre, Firestorm_of_Meteors, Flameblast_of_Celerity, Flameblast_of_Contraction, Fork_Support, Frost_Bomb_of_Instability, Frozen_Legion, Frozen_Legion_of_Rallying, Glacial_Hammer_of_Shattering, Greater_Multistrike_Support, Greater_Spell_Echo_Support, Greater_Unleash_Support, Greater_Volley_Support, Ice_Nova_of_Deep_Freeze, Icicle_Mine_of_Fanning, Immolate_Support, Incinerate_of_Venting, Increased_Critical_Damage_Support, Increased_Critical_Strikes_Support, Kinetic_Bolt_of_Fragmentation, Kinetic_Rain, Lacerate_of_Haemorrhage, Less_Duration_Support, Lightning_Penetration_Support, Lightning_Spire_Trap_of_Overloading, Lightning_Strike_of_Arcing, Mana_Leech_Support, Minion_Life_Support, More_Duration_Support, Multiple_Projectiles_Support, Pact_of_Ghorr, Pact_of_Lycia, Pulverise_Support, Puncture_of_Shanking, Purity_of_Ice, Purity_of_Lightning, Rain_of_Arrows_of_Artillery, Rain_of_Arrows_of_Saturation, Scorching_Ray_of_Immolation, Shattering_Steel, Spark_of_Unpredictability, Spark_of_the_Nova, Storm_Call_of_Trarthus, Stun_Support, Swift_Affliction_Support, Thunderstorm, Vaal_Arc, Vaal_Burning_Arrow, Vaal_Caustic_Arrow, Vaal_Cyclone, Vaal_Haste, Vaal_Ice_Shot, Vitality, Volatile_Dead_of_Confinement
