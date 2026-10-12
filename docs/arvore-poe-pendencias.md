# Árvore de passivas do PoE — o que falta e o que é parcial

Gerado por `game/tools/relatorio-arvore-poe.mjs` em 2026-10-12, a partir de `game/gamedata/itens-poe/arvore-poe.json` — o mesmo estado que o balão da árvore mostra em cada linha. Remontar a árvore (`node tools/montar-arvore-poe.mjs`, depois de mexer numa regra de `traducao.json`) atualiza o balão e este relatório juntos.

## Resumo

- Linhas: **6801** (nós, ascendências e opções das maestrias).
- ✓ Com efeito: **5845** — equivalente 1345, novo 4245, aproximado (parcial) 255.
- ✗ Sem efeito: **129** — na árvore principal 75, nas ascendências 54; sem regra de efeito (registrado) 0; habilidade/mecânica que falta no jogo 29; **58 estão nos blocos que o dono mandou implementar (12/10)**.
- – Não se aplica ao jogo: 62. Lembretes do PoE (entre parênteses, sem marca): 765.

## Implementado a pedido do dono (12/10)

| Bloco | Linhas com efeito agora | Sem efeito ainda | O que mudou no jogo |
|---|---:|---:|---|
| Modificadores de monstro e de mapa ligados (lote 2) | 71 | 0 | monstros que Cegam, Expõem, põem Sangue Corrompido, drenam vida e ganham cargas (modificadores de monstro); mapas com Cegar, Mutilar, Empalar, cargas por acerto, espinhos nos Raros e "Impossível Drenar"; o Golpe Crítico do monstro incendeia, congela e eletriza; o bloqueio do monstro contra Espada |
| Armadilhas e Minas plantadas (lote 3) | 41 | 0 | a gema de Armadilha/Mina planta no alvo; a Armadilha ativa com inimigo a 1 casa (dura 4 s, até 15); a Mina detona sozinha com você parado e inimigo perto, em sequência (dura 5 s, até 15); a magia em área do monstro destrói as plantadas |
| Runas presas ao inimigo (lote 4a) | 22 | 0 | a Runa (Brand) vincula ao inimigo e é Ativada a cada N segundos enquanto vinculada (5 s; solta, procura outro por 6 s); até 3 ativas, 1 por inimigo; o automático não reconjura com todas em campo |
| Vínculos (lote 4b) | 33 | 0 | as 6 gemas de Vínculo criadas: focam um jogador da party na sala (lacaios, com o nó), custam mana por segundo, quebram fora do alcance em 4 s e, se o alvo morre vinculado, você morre; os efeitos de cada uma (Fogo, bloqueio, menos dano e o seu Escudo, crítico, o seu Dreno no alvo) |
| Convocar o Aço (lote 5) | 26 | 0 | as gemas de Aço concedem o Convocar o Aço, automático: chama os empalamentos dos vivos e dos cadáveres a até 6 casas, reflete em volta de cada um o dano × os acertos que restavam e dá 1 Fragmento de Aço por empalamento; recarrega 4 Fragmentos a cada 0,5 s até 12; o Aço Perfurador, o Aço Violento e o Estraçalhador da Munição e a Balista gastam os Fragmentos como no PoE (mais projéteis, a divisão, a Proteção de Aço); a linha dos "Empalamentos removidos desta forma" é da remoção ao Acertar (a mesma opção da maestria), não do Convocar o Aço |

## Sem efeito (✗), pelo motivo

| Linhas | Motivo | Bloco a implementar (dono, 12/10) | Exemplos (nó — texto) |
|---:|---|---|---|
| 58 | as Tinturas não existem no jogo | criar a Tintura | Queima de Mana mais Lenta (nó) — Tinturas aplicadas em você têm Queima de Mana reduzida em 5%<br>Composto da Natureza (notável) — Frascos adjacentes às Tinturas ativas ganham 2 cargas quando você Acertar um Inimigo com uma Arma Corpo a Corpo, não mais que uma vez por segundo<br>Evasão, Efeito de Tinturas (asc. Warden) — Tinturas aplicadas em você têm Efeito aumentado em 10% |
| 10 | a reserva das auras existe (itens-poe/reserva.mjs), mas esta variação ainda não tem efeito — a dos suportados por Feiticeiro (Spellslinger) não tem a quem valer: esse suporte não está no jogo | — | Ego Supremo (keystone) — Auras das suas Habilidades só podem afetar você Habilidades Aura têm 1% mais Efeito de Aura por cada 2% de Mana máxima que Reservarem<br>Ego Supremo (keystone) — 40% mais Reserva de Mana de Habilidades Aura<br>Maestria de Varinhas (maestria) — Eficácia da Reserva de Mana das Habilidades Suportadas por Feiticeiro aumentada em 25% |
| 10 | o Perfurar, o Ricochete e a Difusão do jogo ainda não contam por projétil | — | Tiro Partido (notável) — Projéteis têm 50% de chance de receber um Projétil adicional quando Difundindo<br>Tiro Longo (notável) — Projéteis ganham Dano conforme viajam adiante, causando<br>Chance de uma Difusão Extra de Projéteis (nó) — Projéteis têm 25% de chance de receber um Projétil adicional quando Difundindo |
| 5 | sem aliados nem Vínculos no jogo: o efeito em aliados não tem em quem agir | — | Mestre do Metal (asc. Champion) — Caso tenha Empalado um Inimigo Recentemente, você e Aliados próximos recebem +1000 de Armadura<br>Mestre do Metal (asc. Champion) — Você e Aliados próximos causam de 6 a 12 de Dano Físico adicional para cada Empalar no Inimigo<br>Necromante (asc. Ascendant) — Auras das suas Habilidades concedem 2% de aumento das Velocidades de Ataque e Conjuração para você e Aliados |
| 4 | a gema Portador da Praga não está no jogo | — | Maestria de Envenenamentos (maestria) — Portador da Praga têm Valor Máximo da Praga aumentado em 20% |
| 4 | falta no jogo: a Chama Santificada (só beneficia os ataques dos aliados) | — | Marechal da Divindade (asc. Guardian) — Inflige Chama Santificada ao atingir corpo a corpo<br>Marechal da Divindade (asc. Guardian) — Você pode infligir +1 Chama Santificada nos inimigos<br>Marechal da Divindade (asc. Guardian) — Ganha 10% do dano físico como dano elétrico adicional para cada uma das suas Chamas Santificadas que foram removidas recentemente por um ataque aliado, até 80% |
| 4 | falta no jogo: a habilidade Avatar Liberto (o Liberto e a Fúria Liberta) | — | Avatar da Selva (asc. Warden) — Ganhe 1 de Fúria Liberta quando você infligir uma Afecção Elemental com um Acerto em um Inimigo, não mais que uma vez a cada 0.2 segundos por cada tipo de Afecção<br>Avatar da Selva (asc. Warden) — Não pode ganhar Fúria Liberta enquanto Liberto<br>Avatar da Selva (asc. Warden) — Seus Acertos sempre infligem Congelamento, Eletrização e Incêndio enquanto Liberto |
| 4 | falta no jogo: o Poder Arcano | — | Maestria de Varinhas (maestria) — Ataques têm 100% de Poder Arcano ao usar uma varinha |
| 3 | as Égides (habilidades de único) não existem no jogo | — | Bastião dos Elementos (asc. Elementalist) — Ativa Égide Primitiva Nível 20 quando Alocado<br>Bastião dos Elementos (asc. Elementalist) — Égide Primitiva pode sofrer 75 de Dano Elemental por Nódulo de Habilidade Passiva Alocada<br>Bastião dos Elementos (asc. Elementalist) — Outras Habilidades de Égides são Desabilitadas |
| 3 | falta no jogo: a Casca do Warden (quantas, como se ganha) | — | Lição das Estações (asc. Warden) — -25 de dano sofrido de cada tipo de dano por ataques de magia por casca<br>Lição das Estações (asc. Warden) — Impede +3% do Dano Mágico Suprimido por Casca abaixo do máximo<br>Lição das Estações (asc. Warden) — Perde 1 Casca quando Acertado por Dano Mágico Inimigo |
| 2 | falta no jogo: a chance de crítico de magia que se bifurca (a Infusão Mística entra inteira) | — | Infusão Mística (asc. Assassin) — A chance de causar golpe mágico crítico se bifurca<br>Infusão Mística (asc. Assassin) — ㅤ-30% de chance de causar golpe mágico crítico |
| 2 | falta no jogo: os bônus de altar do PoE (os Santuários) | — | Gritos dos Dessecados (asc. Reliquarian) — Você tem o bônus do Altar Impenetrável, se não estiver sob o efeito de frascos<br>Harmonia do Propósito (asc. Guardian) — Ganha um buff de altar aleatório a cada 10 segundos |
| 1 | a Fortificação vale só em você (os lacaios ainda não a contam) | — | Fortitude (asc. Champion) — Aliados Próximos contam como tendo Fortificação igual a sua |
| 1 | a habilidade "Arauto Trovejante" não está na coleção de gemas do jogo | — | Espigão de Fidelitas (asc. Reliquarian) — Arauto Trovejante tem Eficácia da Reserva de Mana aumentada em 100% |
| 1 | a habilidade "Avatar Liberto" não está na coleção de gemas do jogo | — | Avatar da Selva (asc. Warden) — Concede a Habilidade Avatar Liberto Nível 20 |
| 1 | a habilidade "Convocar Sentinela do Resplendor" não está na coleção de gemas do jogo | — | Cruzada Radiante (asc. Guardian) — Concede a Habilidade Convocar Sentinela do Resplendor Nível 20 |
| 1 | a habilidade "Erguer Aranhas" não está na coleção de gemas do jogo | — | Presa de Arakaali (asc. Reliquarian) — Ativa Erguer Aranhas Nível 20 ao Matar |
| 1 | a habilidade "Pele de Árvore" não está na coleção de gemas do jogo | — | Ensinamentos da Mãe (asc. Warden) — Concede a Habilidade Pele de Árvore Nível 20 |
| 1 | a habilidade "Suspender no Tempo" não está na coleção de gemas do jogo | — | As Areias do Tempo (asc. Reliquarian) — Ativa Suspender no Tempo nível 1 ao conjurar uma magia |
| 1 | a Proteção (Ward) não existe no jogo | — | A Apóstata (asc. Reliquarian) — Ganhe Vida Máxima ao invés de Escudo de Energia Máximo dos Itens de Proteção Equipados |
| 1 | as gemas Profanar e Desenterrar não estão no jogo | — | Coveiro (notável) — Profanar e Desenterrar tem +2 de número Máximo de cadáveres permitidos |
| 1 | falta no jogo: a Geada (o Congelamento curto demais que vira Geada) | — | Juramento do Inverno (asc. Warden) — Acertos que falharem em Congelar devido a Duração insuficiente do Congelamento infligem Geada |
| 1 | falta no jogo: a habilidade Rajada Vulcânica | — | Chamas de Ngamahu (asc. Reliquarian) — Ativa Rajada Vulcânica nível 20 ao atingir corpo a corpo |
| 1 | falta no jogo: a Relíquia Elemental | — | Cruzada Implacável (asc. Guardian) — 25% de chance de Ativar Convocar Relíquia Elemental Nível 20 quando você ou um Aliado próximo Matar um Inimigo, ou Acertar um Inimigo Raro ou Único |
| 1 | falta no jogo: o efeito das auras das gemas nos inimigos | — | Pândega (notável) — Efeito de Auras Não-Maldição de suas Habilidades aumentado em 10% nos Inimigos |
| 1 | falta no jogo: o Grande Emissário das Direções | — | A Divindade Despedaçada (asc. Reliquarian) — Concede a Habilidade Convocar Grande Emissário das Direções |
| 1 | falta no jogo: o Poder Fantasmal | — | O Bastão Negro (asc. Reliquarian) — Cada Fantasma Convocado concede a Você Poder Fantasmal |
| 1 | falta no jogo: o Sentinela do Resplendor | — | Cruzada Radiante (asc. Guardian) — 20% do Dano dos Acertos é sofrido na vida do seu Sentinela do Resplendor antes da sua |
| 1 | falta no jogo: os Robôs Ativadores | — | Crime Perfeito (asc. Saboteur) — Ativa Convocar Robôs Ativadores Nível 20 quando Alocado |
| 1 | falta no jogo: passar os bônus do escudo aos lacaios (a Égide Necromântica entra inteira) | — | Égide Necromântica (keystone) — Todos os bônus do Escudo equipado se aplicam aos seus Lacaios e não a você |
| 1 | falta no jogo: reconvocar o golem morto | — | Suserano do Primordial (asc. Elementalist) — Golens Convocados são Reconvocados 4 segundos após serem Mortos |
| 1 | tipo de carga exclusivo de único que o jogo não tem (só Poder, Frenesi e Tolerância) | — | Rito Profano (asc. Occultist) — Ganha Infusão Espiritual a cada 0.5 segundos enquanto canaliza uma magia |

## Parcial (aproximado, ✓ com diferença do PoE), pelo motivo

| Linhas | A diferença | Exemplos (nó — texto) |
|---:|---|---|
| 25 | soma no alcance em metros: cada 2 m é uma casa a mais (`ficha.alcanceCorpoExtra`) | Dano Corpo a Corpo e Alcance de Golpes (nó) — +0.1 metros ao Alcance de Golpes Corpo a Corpo<br>Dano Físico, Alcance de Golpe Corpo a Corpo (asc. Berserker) — +0.2 metros ao Alcance de Golpes Corpo a Corpo<br>Dano com Espadas e Alcance Corpo a Corpo (nó) — +0.1 metros ao Alcance de Golpes Corpo a Corpo com Espadas |
| 12 | a mana volta na hora (no PoE, ao longo do tempo) | Maestria de Mana (maestria) — Recupera 10% da Mana por 1 segundo quando você usar uma Habilidade de Guarda |
| 10 | (sem nota) | Sobrecarga Elemental (keystone) — Habilidades que causaram um Golpe Crítico nos últimos 8 segundos causam 40% mais Dano Elemental com Acertos e Afecções<br>Sobrecarga Elemental (keystone) — Seus Golpes Críticos não causam Dano extra<br>Sobrecarga Elemental (keystone) — Afecções nunca contam como sendo de um Golpe Crítico |
| 8 | a última repetição pega a área maior (uma casa a cada ~25%) | Domínio de Conjuração (maestria) — Repetição Final das Magias têm Efeito em Área aumentado em 40% |
| 8 | o PoE drena só do dano físico de ataque; o Draevor, de todo o dano. | Dano Corpo a Corpo e Drenagem com Duas Mãos (nó) — 0.8% do Dano de Ataques Físicos é Drenado como Vida<br>Espírito da Guerra (notável) — 0.5% do Dano de Ataques Físicos é Drenado como Mana<br>Dano Corpo a Corpo com Duas Mãos e Dreno (nó) — 0.4% do Dano de Ataques Físicos é Drenado como Vida |
| 8 | os baús da sala a até 4 casas abrem como se você os abrisse (a chave, a armadilha e os guardiões valem igual) | Domínio de Conjuração (maestria) — 25% de chance de abrir Baús próximos quando você Conjurar uma Magia |
| 8 | qualquer frasco de vida remove a afecção mais antiga | Maestria de Frascos (maestria) — Remove uma Afecção não Elemental aleatória quando você usar um Frasco de Vida |
| 8 | vale em você; os aliados não | Guardião (asc. Ascendant) — Caso tenha sido Atacado Recentemente, você e Aliados possuem +10% de Chance de Bloquear o Dano de Ataques<br>Guardião (asc. Ascendant) — Caso tenha Conjurado uma Magia Recentemente, você e Aliados próximos possuem +10% de Chance de Bloquear o Dano Mágico<br>Baluarte da Esperança (asc. Guardian) — Caso tenha sido Atacado Recentemente, você e Aliados possuem +25% de Chance de Bloquear o Dano de Ataques |
| 8 | vale na exposição posta pelos modificadores de acerto ("Inflige Exposição … ao Acertar"); a das gemas ainda não soma | Maestria de Fogo (maestria) — Exposição a Fogo infligida por você aplica -5% extra de Resistência a Fogo |
| 7 | trava só o bloqueio de golpe de Elite/Chefe (os que atordoam no jogo): 0,35 s | Armadura e Escudo de Energia, Recuperação do Bloqueio (asc. Guardian) — Recuperação de Bloqueio aumentada em 30%<br>Barreira de Lâmina (notável) — Recuperação de Bloqueio aumentada em 50%<br>Tartaruga (notável) — Recuperação de Bloqueio aumentada em 60% |
| 6 | entra como redução de dano físico enquanto o escudo está cheio | Maestria de Escudo de Energia (maestria) — 10% menos Dano Físico Sofrido enquanto em Escudo de Energia Cheio |
| 6 | o "mais" entra como aumentado | Dano de Magia Degenerativo (nó) — Mais 12% de dano degenerativo com habilidades mágicas<br>Dano de Magia Degenerativo (nó) — Mais 16% de dano degenerativo com habilidades mágicas<br>Morte Apressada (notável) — Mais 30% de dano degenerativo com habilidades mágicas |
| 6 | o alvo da maldição é Cegado (o "não amaldiçoado" não é conferido) | Maestria de Maldições (maestria) — Inimigos Não Amaldiçoados que você inflija Maldições não Auras são Cegados por 4 segundos |
| 6 | remove uma afecção por clamor | Maestria de Clamores (maestria) — Remove todas as Afecções Danificadoras quando você Clamar |
| 6 | somado à precisão que a Destreza já dá | Maestria de Precisão (maestria) — Bônus de Precisão da Destreza concede +3 de Precisão por Destreza |
| 5 | a Mina detona logo que um inimigo chega perto (no PoE é a aura da Mina plantada): soma no alvo de cada Mina, por 4 s | Maestria de Minas (maestria) — Cada Mina aplica Dano sofrido aumentado em 2% aos Inimigos próximos a ela, até 10% |
| 5 | a velocidade de uso do clamor | Velocidade de Clamores (nó) — Velocidade dos Clamores aumentada em 15%<br>Admoestador (notável) — Velocidade dos Clamores aumentada em 50%<br>Dano Físico, Velocidade do Clamor (asc. Berserker) — Velocidade dos Clamores aumentada em 20% |
| 5 | Causticar, Fragilizar e Exaurir elementais (os do PoE) ainda não existem: vale no Resfriamento e na Eletrização | Dano Elemental com Armas e Efeito de Afecções (nó) — Efeito de Afecções Não-Danificadoras aumentado em 10%<br>Foco Elemental (notável) — Efeito de Afecções Não-Danificadoras aumentado em 20%<br>Cinza, Gelo e Tempestade (notável) — Efeito de Afecções Não-Danificadoras aumentado em 30% |
| 5 | Chance de Crítico aumentada pela distância até o alvo: nada colado, tudo a 6 casas | Maestria de Arcos (maestria) — Flechas ganham Chance de Golpe Crítico enquanto viajam adiante, máximo de até 100% de Chance de Golpe Crítico |
| 5 | no jogo o atalho de Detonar Minas é automático: detona com você parado e um inimigo perto da Mina; com esta linha, também andando | Maestria de Minas (maestria) — Detonar Minas é Ativado enquanto você se mover |
| 5 | no PoE é o dano que o inimigo causa (o poedb traduz "sofrido"); soma no alvo de cada Mina, por 4 s | Maestria de Minas (maestria) — Cada Mina aplica Dano sofrido reduzido em 2% aos Inimigos próximos a ela, até 10% |
| 4 | acelera todas as afecções de dano, não só o veneno | Maestria de Envenenamentos (maestria) — Envenenamentos infligidos por você causam Dano 20% mais rápido |
| 4 | conta a Garra da mão principal | Maestria de Garras (maestria) — Ganha 25 de Mana por Inimigo Acertado com Ataques de Garras na Mão Secundária |
| 4 | encolhe o raio em que os monstros notam você (8 casas ÷ (1 + X%)); quem já persegue segue perseguindo | Maestria de Garras (maestria) — Furtividade aumentada em 50% caso você tenha Acertado com uma Garra Recentemente |
| 4 | o Elusivo dura 4 s | Maestria de Empunhadura Dupla (maestria) — 20% de chance de ganhar Elusivo ao Bloquear enquanto em Empunhadura Dupla |
| 4 | tira o dano contínuo mais antigo em você | Maestria de Estandartes (maestria) — Remove uma Afecção aleatória de você quando você consumir ao menos 10 de Valor para plantar um Estandarte |
| 4 | vale nos golpes com a tag Caos (o golpe inteiro) | Maestria de Caos (maestria) — Causa 10% mais Dano de Caos aos inimigos que tiverem Escudo de Energia<br>Presença Pútrida (asc. Occultist) — 15% mais Dano de Caos |
| 3 | "Recentemente" (4 s) | Espírito Primitivo (notável) — Ganha 4 de Mana por Inimigo Acertado pelos Ataques se você usou um Frasco de Mana nos últimos 10 segundos<br>Maestria de Evasão e Escudo de Energia (maestria) — Evasão aumentada em 100% se a Recarga do Escudo de Energia iniciou nos últimos 2 segundos |
| 3 | nas gemas (o golpe básico, não) | Força Concussiva (notável) — Incêndios de Acertos Corpo a Corpo Atordoantes causam 20% mais Dano<br>Risco Calculado (asc. Saboteur) — Dano com Acertos é Azarado<br>Julgamento Inevitável (asc. Inquisitor) — Acertos Não Críticos penetram 10% das Resistências Elementais do Inimigo |
| 3 | o "menos" entra como reduzido | Maestria de Duração (maestria) — 10% menos Duração do Efeito de Habilidades<br>Mestre Cirurgiã (asc. Pathfinder) — 50% menos Vida Recuperada de Frascos |
| 3 | vale para as afecções que os monstros causam em você | Maestria de Duração (maestria) — Debuffs em você expiram 15% mais rápido |
| 2 | "Corpo a Corpo": com uma arma corpo a corpo empunhada | Maestria de Fortificação (maestria) — Ganha 20 Fortificação ao Matar Corpo a Corpo contra um Inimigo Raro ou Único |
| 2 | a cada 10 segundos (a linha de cima) | Parada Cardíaca (asc. Trickster) — Sofre 50% menos Dano de Acertos por 5 segundos<br>Parada Cardíaca (asc. Trickster) — Sofre 50% menos Dano Degenerativo por 5 segundos |
| 2 | a velocidade de ataque, o crítico, o bloqueio e a regeneração da Oferenda | Dama do Sacrifício (asc. Necromancer) — Suas Habilidades de Oferenda também afetam você |
| 2 | cada 100% é uma casa a mais; o resto, a chance de mais uma | Distância do Empurrão (nó) — Distância do Empurrão aumentada em 25% |
| 2 | conta as Minas detonadas nos últimos 4 s | Detonações Sucessivas (notável) — Chance de Golpe Crítico aumentada em 10% por cada Mina Detonada<br>Detonações Sucessivas (notável) — +4% de Multiplicador de Golpes Críticos para cada Mina Detonada |
| 2 | conta os aumentos de Armadura em % (o valor/100 vira a fração) | Maestria de Armadura e Escudo de Energia (maestria) — Aumentos e Reduções à Armadura também se aplicam à Recarga do Escudo de Energia em 20% de seu valor |
| 2 | o bloqueio-base do escudo vira N (o aumentado local dele não entra) | Gladiador (asc. Ascendant) — Ganhe 50% de Chance de Bloquear com o Escudo Equipado ao invés do valor do Escudo |
| 2 | os monstros só batem nos lacaios de perto: o golpe de um monstro que conjura magias conta como magia | Proteção da Podridão (notável) — Lacaios tem +18% de Chance de Bloquear o Dano Mágico<br>Bloqueio Mágico de Lacaios (nó) — Lacaios tem +12% de Chance de Bloquear o Dano Mágico |
| 2 | pela distância até o alvo: tudo colado, nada a 6 casas | Animosidade Adjacente (notável) — Projéteis causam Dano com Acertos aumentado em 40% aos alvos no início de seu movimento, reduzido para 0% na medida em que viajam adiante<br>Queima-Roupa (keystone) — Acertos dos Ataques de Projéteis causam até 30% mais Dano aos alvos no inicio de seu movimento, causando menos Dano aos alvos na medida em que o projétil viaja adiante |
| 2 | Vento Favorável: +10% de velocidade de ataque, conjuração e movimento | Atiradora (asc. Ascendant) — Você e Aliados próximos têm Vento Favorável |
| 1 | 1% de Escudo de Energia máximo aumentado por 1% de chance de Bloquear Magias | Bastião Vil (asc. Occultist) — Chance de bloquear magias aumenta o seu escudo de energia máximo |
| 1 | a cura sai junto do golpe, da vida que faltava antes dele | Desafiando a Dor (asc. Berserker) — Ganha 3% da vida não reservada faltante antes de ser atingido por um inimigo para cada Desafio |
| 1 | a explosão do jogo não passa pela resistência física dos atingidos | Violência Gratuita (asc. Gladiator) — Inimigos com Sangramento Explodem quando você matá-los, causando 20% de suas Vidas Máximas com Dano Físico |
| 1 | a faixa física da arma (com os locais e a qualidade) e o elemental somado da própria arma. | Instrumentos da Virtude (asc. Inquisitor) — Mago de Batalha |
| 1 | a lentidão dos monstros não pega | Incontrolável (asc. Juggernaut) — Velocidade de Movimento não pode ser modificada para abaixo do valor base |
| 1 | a regeneração vale em você; a dos totens ainda não | Ritual do Despertar (asc. Hierophant) — Você e seus Totens Regeneram 1% de Vida por segundo para cada Totem Convocado |
| 1 | a reserva das auras existe (itens-poe/reserva.mjs), mas esta variação ainda não tem efeito — a dos suportados por Feiticeiro (Spellslinger) não tem a quem valer: esse suporte não está no jogo | Magia Sanguínea (keystone) — Habilidades Reservam Vida ao invés de mana |
| 1 | aliado = um lacaio seu em campo (o jogo não mede a distância dele) | Glória do Comando (notável) — Precisão aumentada em 40%, se você tiver pelo menos 1 aliado por perto |
| 1 | aliado: um lacaio vivo | Glória do Comando (notável) — Área de efeito de ataques aumentada em 15%, se você tiver pelo menos 1 aliado por perto |
| 1 | as cargas vão para todos os frascos do cinto | Entrincheirar (notável) — Frascos de Vida ganham 3 quando você Suprimir Dano Mágico |
| 1 | conta os segundos desde o último Clamor | Escalonamento (notável) — Dano Corpo a Corpo aumentado em 10% para cada segundo que você for afetado por um Buff de Clamor, máximo de 60% |
| 1 | Convergência: 30% mais dano nas habilidades Elementais, por 4 s | Coração da Destruição (asc. Elementalist) — Ganha Convergência ao Acertar um Inimigo Único, não mais do que uma vez a cada 8 segundos |
| 1 | durante qualquer frasco | Extração de Essência (notável) — Recuperação de Mana aumentada em 15% durante o Efeito de qualquer Frasco de Mana |
| 1 | na redução do dano de Acertos | Guarda do Vento (asc. Deadeye) — 4% menos Dano sofrido por Força dos Ventos |
| 1 | no golpe físico dos monstros | Dançarino do Vento (keystone) — 20 menos dano de Ataque sofrido se você não foi Acertado por um Ataque Recentemente |
| 1 | no PoE soma pontos à chance base da habilidade; aqui, à chance de crítico do personagem. | Assassino (asc. Ascendant) — +0.75% de Chance de Golpe Crítico |
| 1 | o acerto e o dano degenerativo das suas gemas não ferem (os totens e lacaios, sim); o golpe básico não sai | Vínculo Ancestral (keystone) — Você não pode causar Dano com Habilidades por si só |
| 1 | o acerto no amaldiçoado renova os 2 s de base | Forças Profanadas (notável) — Redefine a duração de esfriamentos e eletrificações em inimigos amaldiçoados por você |
| 1 | o Elusivo do jogo dura 4 s (no PoE ele vai se desfazendo) | Assassino (asc. Ascendant) — 10% de chance de ganhar Elusivo no Golpe Crítico |
| 1 | o golpe corpo a corpo do jogo é sempre de perto: o máximo | Impacto (asc. Slayer) — Causa até 15% mais Dano Corpo a Corpo aos Inimigos, baseado na proximidade |
| 1 | o golpe inteiro nos vivos a 1 casa de cada atingido | Fúria Tribal (notável) — Habilidades de Golpe Corpo a Corpo causam Dano Propagado aos alvos ao redor |
| 1 | o jogo não tem áreas frias no chão: vale o Resfriamento no inimigo | Geada Cortante (keystone) — Inimigos nas suas áreas frias sofrem dano de frio aumentado pelo esfriamento |
| 1 | o Solo dura 4 s | Inquisidor (asc. Ascendant) — 10% de chance de criar Solo Sagrado ao Acertar um Inimigo Raro ou Único |
| 1 | o teto vale na redução de dano físico (armadura + redução adicional) | Guarda Desequilibrada (keystone) — Redução de Dano Máxima para qualquer Tipo de Dano é 50% |
| 1 | parado: sem andar há pouco | Cinzas Assentadas (notável) — Inimigos Próximos são Cobertos em Cinzas se você não se moveu nos últimos 2 segundos |
| 1 | pela distância até o alvo: nada colado, tudo a 6 casas | Tiro Distante (asc. Deadeye) — Projéteis ganham Dano ao viajar adiante, causando até 30% mais Dano com Acertos e Afecções |
| 1 | qualquer frasco, "Recentemente" (4 s) | Coração de Carvalho (notável) — Regenera 2% de Vida por Segundo se você usou um Frasco de Vida nos últimos 10 segundos |
| 1 | quando Acertado (o PoE: "when Hit") | Guarda do Vento (asc. Deadeye) — Perde toda a sua Força dos Ventos ao Acertar |
| 1 | soma no alcance em metros: cada 2 m é uma casa a mais; "Próximos" = a até 2 casas | Golpe Certeiro (notável) — +0.4 metros ao Alcance de Golpes Corpo a Corpo enquanto com ao menos 5 Inimigos Próximos |
| 1 | uma carga por segundo para os frascos do cinto, se você acertou há pouco | Medicina de Campo (notável) — Frascos de Vida ganham uma Carga quando você acertar um Inimigo, não mais que uma vez por segundo |
| 1 | vale com qualquer Fúria | Ritual da Ruína (asc. Berserker) — Perca 0.1% de Vida por segundo por Fúria enquanto não estiver perdendo Fúria |
| 1 | vale em qualquer inimigo Provocado por você | Autoridade Natural (notável) — Inimigos Provocados por seus Clamores sofrem Dano aumentado em 8% |
| 1 | vale em todos os frascos de Utilidade | Dádiva da Natureza (asc. Pathfinder) — Frascos Utilitários Mágicos aplicados em você têm Efeito aumentado em 30% |
| 1 | vale em você (na área do Estandarte plantado); nos aliados ainda não | Inspirador (asc. Champion) — Você e Aliados próximos dos seus Estandartes Regeneram 0.1% de Vida por segundo por cada Valor consumido por tal Estandarte |
| 1 | vale no acerto corpo a corpo que tem Fogo, sobre o dano inteiro dele | Força Concussiva (notável) — Acertos Atordoam como se causassem 50% mais Dano de Fogo Corpo a Corpo |
| 1 | vale nos golpes com a tag Gelo (o golpe inteiro) | Despertar Frígido (asc. Occultist) — 15% mais Dano de Gelo |
| 1 | vale para o inimigo provocado que você matar (no PoE, o provocado pelo clamor, morto por qualquer um). | Lâmina de Cinturão Verde (asc. Reliquarian) — Inimigos Provocados por seus Clamores Explodem ao morrer, causando 8% de sua Vida máxima como Dano de Caos |
