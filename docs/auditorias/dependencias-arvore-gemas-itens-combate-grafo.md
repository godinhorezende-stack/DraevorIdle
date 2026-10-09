# Grafo de dependências árvore × gemas × itens × combate (gerado)

Gerado por `game/tools/mapear-dependencias.mjs` em 2026-10-09T11:00:54.288Z a partir da árvore, das regras de tradução, do código (quem lê cada atributo) e do registro das gemas. Não edite à mão.

## Por categoria (os temas do editor)

| Grupo · categoria | Nós | Linhas com efeito | Pendentes | Inexistentes no jogo | Efeito validado por teste | Estado |
|---|---:|---:|---:|---:|---:|---|
| mecanica · Outros | 1664 | 1805 (76%) | 397 | 172 | 1409/2082 | parcial |
| mecanica · Afecções e controle | 441 | 391 (64%) | 208 | 13 | 285/490 | parcial |
| gema · Lacaios | 91 | 103 (54%) | 83 | 5 | 62/103 | parcial |
| mecanica · Dreno | 81 | 52 (38%) | 37 | 47 | 23/52 | parcial |
| gema · Marcas e Runas | 40 | 7 (8%) | 70 | 11 | 7/7 | parcial |
| gema · Armadilhas e Minas | 63 | 60 (43%) | 80 | 0 | 0/60 | parcial |
| mecanica · Recuperação e regeneração | 173 | 177 (73%) | 45 | 21 | 77/177 | parcial |
| mecanica · Precisão e crítico | 267 | 354 (85%) | 61 | 1 | 230/364 | parcial |
| mecanica · Defesa e armadura | 299 | 320 (84%) | 43 | 16 | 231/376 | parcial |
| mecanica · Atordoamento | 117 | 99 (63%) | 51 | 8 | 41/103 | parcial |
| gema · Maldições | 75 | 62 (53%) | 47 | 9 | 4/80 | parcial |
| gema · Golpes e ataques | 48 | 21 (29%) | 9 | 42 | 0/21 | parcial |
| mecanica · Fúria, cargas e poder | 118 | 119 (71%) | 41 | 7 | 52/119 | parcial |
| item · Frascos | 68 | 106 (70%) | 33 | 13 | 99/130 | parcial |
| mecanica · Debuffs do PoE | 39 | 1 (2%) | 29 | 15 | 0/2 | parcial |
| gema · Clamores | 45 | 35 (45%) | 28 | 14 | 0/35 | parcial |
| mecanica · Reflexo | 29 | 1 (3%) | 36 | 2 | 0/1 | parcial |
| gema · Conjuração | 84 | 57 (62%) | 29 | 6 | 67/72 | parcial |
| mecanica · Escudo de Energia | 123 | 114 (79%) | 29 | 2 | 88/114 | parcial |
| gema · Auras e Arautos | 31 | 22 (42%) | 5 | 25 | 9/22 | parcial |
| mecanica · Exposição | 35 | 16 (37%) | 23 | 4 | 2/16 | parcial |
| gema · Canalização e repetição | 10 | 0 (0%) | 26 | 0 | 0/0 | ausente |
| item · Defesa de uma peça | 91 | 105 (81%) | 17 | 8 | 41/112 | parcial |
| gema · Totens | 33 | 36 (64%) | 20 | 0 | 0/36 | parcial |
| mecanica · Solo e mapa | 7 | 0 (0%) | 5 | 5 | 0/0 | ausente |
| gema · Cadáveres | 9 | 0 (0%) | 0 | 9 | 0/0 | ausente |
| gema · Oferendas, golens e invocações | 18 | 16 (64%) | 9 | 0 | 5/32 | parcial |
| item · Encaixes e cores | 9 | 0 (0%) | 9 | 0 | 0/0 | ausente |
| gema · Guardas | 17 | 12 (63%) | 7 | 0 | 0/12 | parcial |
| item · Aljava, anéis, amuleto, cinto | 8 | 2 (25%) | 6 | 0 | 2/2 | parcial |
| item · Joias | 1 | 0 (0%) | 2 | 0 | 0/0 | ausente |
| gema · Gemas Vaal | 11 | 12 (100%) | 0 | 0 | 0/12 | completo |

## O grafo de cada categoria

### mecanica · Outros

- **Nós da árvore:** 1664 (ids no inventário da árvore). **Linhas:** 1805 com efeito, 397 pendentes, 172 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `atk_speed` (147) → encontros/altares.mjs, ficha (atributos finais), cargas, condições, golpe e tique, gemas ativas, lacaios e totens
  - `phys_dmg` (143) → encontros/altares.mjs, ficha (atributos finais), itens/item.mjs, condições, golpe e tique
  - `dmg_inc` (140) → ficha (atributos finais), condições, golpe e tique
  - `int` (99) → classes.mjs, ficha (atributos finais), itens/item.mjs, condições, golpe e tique, itens-poe/jogo.mjs, itens-poe/sockets.mjs, árvore (motor), atributos For/Des/Int, tela da ficha, personagem/requisitos.mjs
  - `stat:life` (99) → soma de atributos, ficha (atributos finais)
  - `str` (95) → classes.mjs, ficha (atributos finais), itens/item.mjs, itens-poe/catalogo.mjs, condições, golpe e tique, itens-poe/jogo.mjs, itens-poe/sockets.mjs, árvore (motor), atributos For/Des/Int, tela da ficha, personagem/requisitos.mjs
  - `fire_dmg` (89) → encontros/altares.mjs, ficha (atributos finais), condições, golpe e tique, gemas ativas
  - `ice_dmg` (89) → encontros/altares.mjs, ficha (atributos finais), condições, golpe e tique, gemas ativas
  - `dex` (87) → classes.mjs, ficha (atributos finais), itens/item.mjs, condições, golpe e tique, itens-poe/jogo.mjs, itens-poe/sockets.mjs, árvore (motor), atributos For/Des/Int, tela da ficha, personagem/requisitos.mjs
  - `energy_dmg` (86) → encontros/altares.mjs, ficha (atributos finais), condições, golpe e tique, gemas ativas
- **O que falta (pendentes):** mecânica própria desta linha. Exemplos: "Habilidades de Ataque tem +1 de número máximo aos Totens Balista Convocados" · "Efeito em Área de Habilidades Feitiço aumentada em 15%" · "Eficiência de custo de mana de habilidades de conexão aumentada em 20%" · "A cada 10 segundos, ganhe 30% do Dano Físico como Dano Extra de Fogo por 4 segundos"

### mecanica · Afecções e controle

- **Nós da árvore:** 441 (ids no inventário da árvore). **Linhas:** 391 com efeito, 208 pendentes, 13 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `ailment_dmg_inc` (153) → afecções e dano contínuo
  - `dmg_inc` (66) → ficha (atributos finais), condições, golpe e tique
  - `chance_empalar` (17) → gemas ativas, combate: acerto e eventos
  - `efeito_resfriamento` (13) → afecções e dano contínuo, combate: acerto e eventos
  - `chance_freeze` (13) → afecções e dano contínuo
  - `chance_bleed_ataque` (12) → afecções e dano contínuo
  - `avoid_elem_ailments` (12) → condições, golpe e tique, combate: acerto e eventos
  - `dot_multi_poison` (11) → afecções e dano contínuo
  - `chance_ignite` (11) → afecções e dano contínuo
  - `chance_shock` (10) → afecções e dano contínuo
- **O que falta (pendentes):** afecções em você (limite, "enquanto tiver uma"), empalar em você, resfriamento mínimo, dano por segundo congelado. Exemplos: "Efeito do Resfriamento e Eletrização em você reduzido em 10%" · "Efeito dos Empalamentos infligidos por você com Armas de Duas Mãos aumentado em 10%" · "+25% de Multiplicador do Dano Degenerativo para Afecções dos Golpes Críticos" · "Efeito do Resfriamento e Eletrização em você reduzido em 20%"

### gema · Lacaios

- **Nós da árvore:** 91 (ids no inventário da árvore). **Linhas:** 103 com efeito, 83 pendentes, 5 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `minion_dmg` (38) → lacaios e totens
  - `minion_life` (25) → lacaios e totens
  - `minion_atk_speed` (10) → lacaios e totens
  - `minion_cast_speed` (10) → lacaios e totens
  - `minion_leech` (5) → lacaios e totens
  - `minion_regen_pct` (4) → lacaios e totens
  - `lacaio_duracao:qualquer` (3) → **ninguém lê**
  - `minion_chaos_res` (3) → lacaios e totens
  - `minion_block` (2) → lacaios e totens
  - `minion_res` (2) → lacaios e totens
- **Gemas (arquétipo `lacaio`):** 58 — funcionam 0, parciais 58, sem comportamento 0. Motivos mais comuns: 58× o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro; 49× efeito não simulado.
- **O que falta (pendentes):** os atributos dos lacaios além de dano/vida/velocidade (área, recarga, penetração, buffs ao matar, resistências máximas) — o lacaio do jogo ainda não tem esses números. Exemplos: "Lacaios têm +20% de Multiplicador de Acerto Crítico" · "Aumentos e reduções de Dano de Lacaio também afetam você" · "Lacaios têm Chance de Acerto Crítico aumentada em 25%" · "Lacaios explodem quando reduzidos à Vida Baixa, causando 33% de suas vidas máximas como Dano de Fogo em inimigos próximos"

### mecanica · Dreno

- **Nós da árvore:** 81 (ids no inventário da árvore). **Linhas:** 52 com efeito, 37 pendentes, 47 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `life_leech` (22) → ficha (atributos finais), condições, golpe e tique
  - `roubo_teto_inc` (18) → ficha (atributos finais), tela da ficha
  - `mana_leech` (11) → ficha (atributos finais), condições, golpe e tique
  - `roubo_teto_vida_menos` (1) → ficha (atributos finais)
- **O que falta (pendentes):** o roubo do PoE já tem instância, taxa e teto (`ficha.aplicarLeech`/`recuperarRoubo`); faltam o dreno instantâneo, o de mana/escudo por tipo de dano e o "enquanto drenando" de outras peças. Exemplos: "Recuperação de Mana Máxima total do Dreno por segundo aumentada em 40%" · "0.8% do Dano Mágico Drenado como Escudo de Energia" · "Recuperação de Escudo de Energia Máxima total do Dreno por segundo aumentada em 30%" · "Dreno de Vida do Dano Corpo a Corpo é Instantâneo"

### gema · Marcas e Runas

- **Nós da árvore:** 40 (ids no inventário da árvore). **Linhas:** 7 com efeito, 70 pendentes, 11 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `dmg_inc` (4) → ficha (atributos finais), condições, golpe e tique
  - `crit_chance_inc` (2) → ficha (atributos finais), cargas, condições, golpe e tique, lacaios e totens
  - `crit_dmg` (1) → encontros/altares.mjs, ficha (atributos finais), itens/item.mjs, cargas, condições, golpe e tique
- **Gemas (arquétipo `marca`):** 11 — funcionam 0, parciais 11, sem comportamento 0. Motivos mais comuns: 34× efeito não simulado; 2× sem dano direto; 1× os estágios de canalização não existem.
- **O que falta (pendentes):** marcas presas ao inimigo (vínculo, convocação, alcance, duração da marca). Exemplos: "Dano com Acertos e Afecções contra Inimigos Marcados aumentado em 20%" · "Habilidades de Runa têm sua Duração aumentada em 15%" · "Inimigo Marcado concede Cargas de Frasco aumentadas em 20% a Você" · "Habilidades de Runa têm sua Duração aumentada em 10%"

### gema · Armadilhas e Minas

- **Nós da árvore:** 63 (ids no inventário da árvore). **Linhas:** 60 com efeito, 80 pendentes, 0 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `dmg_inc` (16) → ficha (atributos finais), condições, golpe e tique
  - `cast_speed_tag` (14) → habilidades (uso)
  - `area_inc` (10) → condições, golpe e tique
  - `crit_chance_inc` (8) → ficha (atributos finais), cargas, condições, golpe e tique, lacaios e totens
  - `crit_dmg` (8) → encontros/altares.mjs, ficha (atributos finais), itens/item.mjs, cargas, condições, golpe e tique
  - `eficiencia_reserva_minas` (3) → habilidades (uso)
  - `elem_pen` (1) → ficha (atributos finais), condições, golpe e tique
- **Gemas (arquétipo `armadilha`):** 27 — funcionam 4, parciais 23, sem comportamento 0. Motivos mais comuns: 40× efeito não simulado; 3× as repetições do golpe não existem; 1× sem dano direto.
- **Gemas (arquétipo `mina`):** 8 — funcionam 0, parciais 8, sem comportamento 0. Motivos mais comuns: 15× efeito não simulado; 2× sem dano direto.
- **O que falta (pendentes):** armadilhas e minas de verdade (armar, detonar, limite plantado, auras das minas) — no jogo as gemas viram golpes comuns. Exemplos: "Minas tem Velocidade de Detonação aumentada em 20%" · "Habilidades usadas por Minas causam Dano em Área aumentado em 30% caso tenha Detonado uma Mina Recentemente" · "Habilidades usadas por Minas têm Efeito em Área aumentado em 15% caso tenha Detonado uma Mina Recentemente" · "Pode ter até 2 Armadilhas adicionais plantadas por vez"

### mecanica · Recuperação e regeneração

- **Nós da árvore:** 173 (ids no inventário da árvore). **Linhas:** 177 com efeito, 45 pendentes, 21 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `life_regen_max_pct` (47) → ficha (atributos finais)
  - `mana_regen_pct` (32) → ficha (atributos finais), cargas
  - `life_regen` (16) → ficha (atributos finais), itens/item.mjs, gemas ativas, lacaios e totens
  - `recoup_mana` (13) → combate: acerto e eventos
  - `mana_regen` (13) → ficha (atributos finais), gemas ativas, lacaios e totens
  - `ev:usarHabilidade:manaPctChance:10` (12) → combate: acerto e eventos
  - `recoup_life` (9) → combate: acerto e eventos
  - `ev:matar:vidaPctChance:100` (7) → combate: acerto e eventos
  - `sem_regen_vida` (7) → ficha (atributos finais)
  - `ev:bloquearAtaque:vidaPct` (5) → combate: acerto e eventos
- **O que falta (pendentes):** recuperação ao longo do tempo, regeneração periódica e a dos inimigos próximos. Exemplos: "Regeneração de Mana aumentada em 1% por cada 1% de Chance de Bloquear Dano Mágico" · "Enquanto não estiver em Vida Cheia, Sacrifica 20% da Mana por Segundo para Recuperar a mesma quantidade de Vida" · "A cada 4 segundos, Regenera 15% de Vida durante um segundo" · "Flecha Ilusória e Flecha Espelhada têm Recuperação da Recarga aumentada em 100%"

### mecanica · Precisão e crítico

- **Nós da árvore:** 267 (ids no inventário da árvore). **Linhas:** 354 com efeito, 61 pendentes, 1 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `crit_chance_inc` (111) → ficha (atributos finais), cargas, condições, golpe e tique, lacaios e totens
  - `crit_dmg` (91) → encontros/altares.mjs, ficha (atributos finais), itens/item.mjs, cargas, condições, golpe e tique
  - `accuracy` (41) → combate/simulador-mob.mjs, combate/simulador.mjs, ficha (atributos finais), condições, golpe e tique, lacaios e totens, árvore (motor), defesa (escudo, esquiva), tela da ficha, sessão (WebSocket)
  - `accuracy_inc` (34) → ficha (atributos finais)
  - `stat:accuracy` (33) → soma de atributos, ficha (atributos finais)
  - `crit_dmg_taken_red` (15) → condições, golpe e tique
  - `spell_crit_chance_inc` (12) → ficha (atributos finais)
  - `gem_level` (7) → skills/gemas.mjs
  - `area_inc` (5) → condições, golpe e tique
  - `carga_poder_ao_critico_varinha` (4) → cargas
- **O que falta (pendentes):** precisão "mais" contra únicos/de perto, crítico contra o personagem. Exemplos: "Golpes Críticos não causam Dano extra" · "Precisão aumentada em 40%, se você tiver pelo menos 1 aliado por perto" · "Inimigos são Empurrados caso você acerte um Golpe Crítico com um Cajado" · "Empurra Inimigos se você tiver um Golpe Crítico com Dano de Projéteis"

### mecanica · Defesa e armadura

- **Nós da árvore:** 299 (ids no inventário da árvore). **Linhas:** 320 com efeito, 43 pendentes, 16 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `evasion_pct` (103) → encontros/altares.mjs, ficha (atributos finais), cargas, lacaios e totens
  - `armour_pct` (87) → encontros/altares.mjs, ficha (atributos finais), cargas, lacaios e totens
  - `block` (76) → habilidades (uso), caçada (tique), charms.mjs, encontros/altares.mjs, ficha (atributos finais), golpe básico e dano recebido, item-power.mjs, itens/item.mjs, condições, golpe e tique, itens-poe/jogo.mjs, party.mjs, magias dos monstros no jogador
  - `spell_block` (41) → ficha (atributos finais)
  - `armor_flat` (11) → ficha (atributos finais), golpe básico e dano recebido, gemas ativas
  - `inimigos_nao_bloqueiam` (10) → habilidades (uso), golpe básico e dano recebido
  - `ev:bloquear:vida` (5) → combate: acerto e eventos
  - `ev:bloquear:alvo:intimidado:4` (5) → combate: acerto e eventos
  - `fire_res_max` (5) → ficha (atributos finais)
  - `ice_res_max` (5) → ficha (atributos finais)
- **O que falta (pendentes):** defender com armadura extra, bloqueio máximo, evasão condicional. Exemplos: "+3% à Chance máxima de Bloquear Dano Mágico" · "100% de chance de Defender com 200% de Armadura" · "+3% à Chance máxima de Bloquear o Dano de Ataques" · "Penalidades de Movimento das Armaduras são Ignoradas"

### mecanica · Atordoamento

- **Nós da árvore:** 117 (ids no inventário da árvore). **Linhas:** 99 com efeito, 51 pendentes, 8 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `stun_duration` (28) → combate: acerto e eventos
  - `enemy_stun_threshold_red` (20) → combate: acerto e eventos
  - `evitar_atordoamento` (11) → condições, golpe e tique, combate: acerto e eventos
  - `stun_recovery` (9) → condições, golpe e tique
  - `imune_atordoamento` (9) → condições, golpe e tique, combate: acerto e eventos
  - `carga_tolerancia_ao_atordoar` (6) → cargas
  - `block` (5) → habilidades (uso), caçada (tique), charms.mjs, encontros/altares.mjs, ficha (atributos finais), golpe básico e dano recebido, item-power.mjs, itens/item.mjs, condições, golpe e tique, itens-poe/jogo.mjs, party.mjs, magias dos monstros no jogador
  - `crit_dmg` (5) → encontros/altares.mjs, ficha (atributos finais), itens/item.mjs, cargas, condições, golpe e tique
  - `ponto_atordoamento_proprio_red` (4) → condições, golpe e tique
  - `chance_dobrar_atordoamento` (3) → combate: acerto e eventos
- **O que falta (pendentes):** duração do atordoamento crítico, ignorar atordoamento, atordoar em área ao ser atordoado. Exemplos: "10% do Dano sofrido de Acertos Atordoadores é Recuperado como Vida" · "Acertos Atordoam como se causassem 50% mais Dano de Fogo Corpo a Corpo" · "Incêndios de Acertos Corpo a Corpo Atordoantes causam 20% mais Dano" · "Regenera 5% de Vida durante 1 segundo quando Atordoado"

### gema · Maldições

- **Nós da árvore:** 75 (ids no inventário da árvore). **Linhas:** 62 com efeito, 47 pendentes, 9 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `efeito_buff_gema:aura` (16) → itens-poe/arvore.mjs, condições, golpe e tique, gemas ativas
  - `efeito_maldicao` (10) → habilidades (uso), combate: acerto e eventos
  - `efeito_maldicao_proprio` (6) → combate: acerto e eventos
  - `chance_ignite` (6) → afecções e dano contínuo
  - `chance_freeze` (6) → afecções e dano contínuo
  - `chance_shock` (6) → afecções e dano contínuo
  - `chance_poison` (6) → afecções e dano contínuo
  - `ev:conjurarMaldicao:alvo:cego:4` (6) → combate: acerto e eventos
  - `eficiencia_reserva_maldicao` (5) → reserva (auras)
  - `cast_speed` (5) → encontros/altares.mjs, ficha (atributos finais), cargas, gemas ativas, lacaios e totens
- **Gemas (arquétipo `maldicao`):** 19 — funcionam 6, parciais 13, sem comportamento 0. Motivos mais comuns: 37× efeito não simulado; 12× nenhum efeito do buff tem equivalente no jogo; 1× a lentidão da maldição ainda não existe no jogo.
- **O que falta (pendentes):** a duração e o "expirou X%" das maldições, maldição sobre inimigo sem maldição, maldições em você. Exemplos: "Efeito de Auras Não-Maldição de suas Habilidades aumentado em 10% nos Inimigos" · "Você pode aplicar uma Maldição adicional" · "+2 ao Nível de todas as Gemas de Habilidade Maldição" · "Remove Afecções Elementais quando você Conjurar uma Magia Maldição"

### gema · Golpes e ataques

- **Nós da árvore:** 48 (ids no inventário da árvore). **Linhas:** 21 com efeito, 9 pendentes, 42 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `alcance_corpo_m` (19) → ficha (atributos finais)
  - `eficiencia_reserva_postura` (2) → reserva (auras)
- **Gemas (arquétipo `corpo_a_corpo`):** 49 — funcionam 8, parciais 41, sem comportamento 0. Motivos mais comuns: 84× efeito não simulado.
- **Gemas (arquétipo `impacto`):** 23 — funcionam 1, parciais 22, sem comportamento 0. Motivos mais comuns: 53× efeito não simulado; 5× as repetições do golpe não existem.
- **O que falta (pendentes):** alcance corpo a corpo, ataques impelidos por clamor, posturas. Exemplos: "+0.1 metros ao Alcance de Golpes Corpo a Corpo com Espadas" · "Dano de Ataque aumentado em 20% enquanto na Postura do Sangue" · "+0.4 metros ao Alcance de Golpes Corpo a Corpo enquanto com ao menos 5 Inimigos Próximos" · "Habilidades de Golpe Corpo a Corpo causam Dano Propagado aos alvos ao redor"

### mecanica · Fúria, cargas e poder

- **Nós da árvore:** 118 (ids no inventário da árvore). **Linhas:** 119 com efeito, 41 pendentes, 7 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `furia_por_acerto` (14) → combate: acerto e eventos
  - `furia_max` (9) → condições, golpe e tique
  - `max_frenesi` (7) → cargas, condições, golpe e tique, tela da ficha
  - `furia_perda_lenta` (6) → condições, golpe e tique
  - `max_poder` (6) → cargas, condições, golpe e tique, tela da ficha
  - `duracao_tolerancia` (6) → cargas, condições, golpe e tique, combate: acerto e eventos
  - `duracao_frenesi` (5) → cargas, condições, golpe e tique, combate: acerto e eventos
  - `duracao_poder` (5) → cargas, condições, golpe e tique, combate: acerto e eventos
  - `max_tolerancia` (5) → cargas, condições, golpe e tique, tela da ficha
  - `ev:bloquear:buff:poderProfano` (5) → combate: acerto e eventos
- **O que falta (pendentes):** ganhos e perdas de cargas/fúria em situações específicas. Exemplos: "Efeito da Fúria Arcana aumentado em 20% em você" · "Perna Inerente de Fúria começa 1 segundo depois" · "Efeito da Fúria Arcana aumentado em 10% por cada 200 de Mana gasto Recentemente, até 50%" · "10% de chance de ganhar Fúria Arcana ao Matar um Inimigo"

### item · Frascos

- **Nós da árvore:** 68 (ids no inventário da árvore). **Linhas:** 106 com efeito, 33 pendentes, 13 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `frasco_cargas_recebidas` (12) → frascos
  - `frasco_efeito` (12) → frascos
  - `frasco_regen_n:mana` (11) → frascos
  - `frasco_regen_s:mana` (11) → frascos
  - `frasco_regen_n:vida` (11) → frascos
  - `frasco_regen_s:vida` (11) → frascos
  - `frasco_duracao` (10) → frascos
  - `frasco_vida_rec` (9) → frascos
  - `ev:usarFrascoMana:removerAfeccao` (8) → combate: acerto e eventos
  - `ev:usarFrasco:removerAfeccao` (8) → combate: acerto e eventos
- **O que falta (pendentes):** cargas de frasco por abate/inimigo marcado e efeitos durante o frasco. Exemplos: "Velocidade de Recuperação dos Frascos aumentada em 30%" · "Ganha 4 de Mana por Inimigo Acertado pelos Ataques se você usou um Frasco de Mana nos últimos 10 segundos" · "Cargas de Frasco recebidas aumentadas em 20% caso você tenha causado um Golpe Crítico Recentemente" · "Frascos de Vida ganham uma Carga quando você acertar um Inimigo, não mais que uma vez por segundo"

### mecanica · Debuffs do PoE

- **Nós da árvore:** 39 (ids no inventário da árvore). **Linhas:** 1 com efeito, 29 pendentes, 15 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `chance_intimidar` (1) → combate: acerto e eventos
  - `intimidar_s` (1) → combate: acerto e eventos
- **O que falta (pendentes):** Crueldade, Esmagado, Sangue Corrompido — debuffs que o jogo ainda não tem. Exemplos: "Esmaga Inimigos por 4 segundos quando você Acertá-los enquanto estiverem em Vida Cheia" · "Efeito da Crueldade aumentado em 30%" · "Acertos Impiedosos Intimidam Inimigos por 4 segundos" · "20% de chance de Mutilar Inimigos com Acertos da Mão Principal"

### gema · Clamores

- **Nós da árvore:** 45 (ids no inventário da árvore). **Linhas:** 35 com efeito, 28 pendentes, 14 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `efeito_buff_gema:clamor` (10) → itens-poe/arvore.mjs, condições, golpe e tique, gemas ativas
  - `duracao_habilidades` (8) → habilidades (uso)
  - `ev:usarClamor:vidaPct` (6) → combate: acerto e eventos
  - `ev:usarClamor:proximos:debilitado:1` (6) → combate: acerto e eventos
  - `cast_speed` (5) → encontros/altares.mjs, ficha (atributos finais), cargas, gemas ativas, lacaios e totens
- **Gemas (arquétipo `clamor`):** 10 — funcionam 3, parciais 7, sem comportamento 0. Motivos mais comuns: 28× efeito não simulado.
- **O que falta (pendentes):** o Poder dos clamores, a recarga e os bônus do clamor reforçado. Exemplos: "Velocidade de Recarga do Clamor aumentada em 15%" · "Velocidade de Recarga do Clamor aumentada em 12%" · "Velocidade de Recarga do Clamor aumentada em 15%" · "Habilidades de Clamor têm Efeito em Área aumentado em 15%"

### mecanica · Reflexo

- **Nós da árvore:** 29 (ids no inventário da árvore). **Linhas:** 1 com efeito, 36 pendentes, 2 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `reflect_phys_melee` (1) → combate: acerto e eventos
- **O que falta (pendentes):** reflexo de dano dos monstros (o jogo ainda não reflete dano no personagem). Exemplos: "Evita +60% do dano elemental refletido" · "Evita +60% do dano elemental refletido" · "Evita +60% do dano físico refletido" · "Evita +60% do dano físico refletido"

### gema · Conjuração

- **Nós da árvore:** 84 (ids no inventário da árvore). **Linhas:** 57 com efeito, 29 pendentes, 6 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `cast_speed` (54) → encontros/altares.mjs, ficha (atributos finais), cargas, gemas ativas, lacaios e totens
  - `atk_speed` (15) → encontros/altares.mjs, ficha (atributos finais), cargas, condições, golpe e tique, gemas ativas, lacaios e totens
  - `cast_speed_tag` (3) → habilidades (uso)
- **Gemas (arquétipo `projetil`):** 101 — funcionam 44, parciais 57, sem comportamento 0. Motivos mais comuns: 121× efeito não simulado; 1× sem dano direto.
- **Gemas (arquétipo `area`):** 61 — funcionam 7, parciais 54, sem comportamento 0. Motivos mais comuns: 99× efeito não simulado; 11× o uso de cadáveres não existe no jogo; 3× as repetições do golpe não existem.
- **Gemas (arquétipo `nova`):** 15 — funcionam 4, parciais 11, sem comportamento 0. Motivos mais comuns: 19× efeito não simulado.
- **Gemas (arquétipo `orbe`):** 13 — funcionam 1, parciais 12, sem comportamento 0. Motivos mais comuns: 33× efeito não simulado.
- **Gemas (arquétipo `chuva`):** 15 — funcionam 2, parciais 13, sem comportamento 0. Motivos mais comuns: 23× efeito não simulado.
- **Gemas (arquétipo `ricochete`):** 9 — funcionam 2, parciais 7, sem comportamento 0. Motivos mais comuns: 13× efeito não simulado.
- **O que falta (pendentes):** contar as magias conjuradas recentemente e ignorar atordoamento ao conjurar. Exemplos: "25% de chance de Ignorar Atordoamentos enquanto Conjurando" · "15% de chance de Ignorar Atordoamentos enquanto Conjurando" · "15% de chance de Ignorar Atordoamentos enquanto Conjurando" · "15% de chance de Ignorar Atordoamentos enquanto Conjurando"

### mecanica · Escudo de Energia

- **Nós da árvore:** 123 (ids no inventário da árvore). **Linhas:** 114 com efeito, 29 pendentes, 2 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `es_pct` (80) → ficha (atributos finais), tela da ficha
  - `energy_shield` (11) → ficha (atributos finais), gemas ativas, tela da ficha
  - `phys_res` (6) → encontros/altares.mjs, ficha (atributos finais), itens/item.mjs, cargas, gemas ativas
  - `ev:matar:es` (2) → combate: acerto e eventos
  - `evasion_pct` (2) → encontros/altares.mjs, ficha (atributos finais), cargas, lacaios e totens
  - `dmg_inc` (1) → ficha (atributos finais), condições, golpe e tique
  - `vida_como_escudo` (1) → ficha (atributos finais)
  - `ev:suprimir:es` (1) → combate: acerto e eventos
  - `roubo_vida_no_escudo` (1) → ficha (atributos finais)
  - `sem_recarga_es` (1) → defesa (escudo, esquiva)
- **O que falta (pendentes):** a recarga do escudo (atraso, início, ritmo), escudo no ponto de atordoamento, caos que não ignora o escudo. Exemplos: "Não pode Recuperar Escudo de Energia acima da Evasão" · "Quando Acertado, perca uma Mortalha Fantasma para Recuperar Escudo de Energia igual a 3% da sua Evasão" · "Regenera 5% de Escudo de Energia durante 1 segundo quando Atordoado" · "Não pode Recuperar Escudo de Energia acima da Armadura"

### gema · Auras e Arautos

- **Nós da árvore:** 31 (ids no inventário da árvore). **Linhas:** 22 com efeito, 5 pendentes, 25 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `dmg_inc` (9) → ficha (atributos finais), condições, golpe e tique
  - `efeito_buff_gema:aura` (8) → itens-poe/arvore.mjs, condições, golpe e tique, gemas ativas
  - `eficiencia_reserva_arauto` (4) → reserva (auras)
  - `efeito_buff_gema:arauto` (1) → itens-poe/arvore.mjs, condições, golpe e tique, gemas ativas
- **Gemas (arquétipo `aura`):** 31 — funcionam 9, parciais 22, sem comportamento 0. Motivos mais comuns: 47× efeito não simulado; 3× nenhum efeito do buff tem equivalente no jogo; 1× efeito não aplicado no jogo.
- **Gemas (arquétipo `arauto`):** 3 — funcionam 0, parciais 3, sem comportamento 0. Motivos mais comuns: 9× efeito não simulado; 3× nenhum efeito do buff tem equivalente no jogo; 1× efeito não aplicado no jogo.
- **O que falta (pendentes):** efeitos de aura em aliados e a duração das auras não reservadas. Exemplos: "Efeito dos Buffs de Arauto em você aumentado em 20%" · "Habilidades de Arauto têm Efeito em Área aumentado em 25%" · "Efeito dos Buffs de Arauto em você aumentado em 10%" · "Efeito dos Buffs de Arauto em você aumentado em 10%"

### mecanica · Exposição

- **Nós da árvore:** 35 (ids no inventário da árvore). **Linhas:** 16 com efeito, 23 pendentes, 4 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `exposicao_extra_fogo` (8) → combate: acerto e eventos
  - `ev:acertar:alvo:exposicaoGelo:4` (6) → combate: acerto e eventos
  - `equilibrio_exposicao` (1) → combate: acerto e eventos
  - `equilibrio_exposicao_pct` (1) → combate: acerto e eventos
- **O que falta (pendentes):** exposição com valor mínimo, efeito de exposição em você. Exemplos: "Chance de Golpe Crítico contra inimigos com Exposição a Raio aumentada em 60%" · "Exposições infligidas por você aplicam ao menos -18% à Resistência afetada" · "Efeito de Exposições em você reduzido em 50%" · "Exposições infligidas por você aplicam ao menos -18% à Resistência afetada"

### gema · Canalização e repetição

- **Nós da árvore:** 10 (ids no inventário da árvore). **Linhas:** 0 com efeito, 26 pendentes, 0 inexistentes no jogo.
- **Gemas (arquétipo `canalizacao`):** 36 — funcionam 3, parciais 33, sem comportamento 0. Motivos mais comuns: 59× efeito não simulado; 11× os estágios de canalização não existem; 1× sem dano direto.
- **O que falta (pendentes):** canalização por estágios, intensidade, selos (Liberar) e repetição de magias — no jogo cada uso é um. Exemplos: "Repetição Final das Magias têm Efeito em Área aumentado em 40%" · "Magias que podem ganhar Intensidade têm +1 de Intensidade máxima" · "Habilidades suportadas por Liberar tem +1 ao número máximo de Selos" · "Repetição Final das Magias têm Efeito em Área aumentado em 40%"

### item · Defesa de uma peça

- **Nós da árvore:** 91 (ids no inventário da árvore). **Linhas:** 105 com efeito, 17 pendentes, 8 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `es_recharge` (17) → ficha (atributos finais)
  - `life_inc` (14) → soma de atributos
  - `defesas_pct_escudo` (7) → ficha (atributos finais), tela da ficha
  - `es_regen_pct` (7) → condições, golpe e tique
  - `es_pct_elmo` (6) → ficha (atributos finais), tela da ficha
  - `spell_suppression` (5) → ficha (atributos finais)
  - `evasion_pct_peitoral` (5) → ficha (atributos finais)
  - `ev:bloquearMagia:esPct` (5) → combate: acerto e eventos
  - `block` (5) → habilidades (uso), caçada (tique), charms.mjs, encontros/altares.mjs, ficha (atributos finais), golpe básico e dano recebido, item-power.mjs, itens/item.mjs, condições, golpe e tique, itens-poe/jogo.mjs, party.mjs, magias dos monstros no jogador
  - `dmg_inc` (5) → ficha (atributos finais), condições, golpe e tique
- **O que falta (pendentes):** a defesa de UMA peça já existe (`ficha.defesasDaFicha`, lote 5); faltam o que depende da recuperação/recarga do escudo e das condições de outras peças. Exemplos: "Remove todo Escudo Mágico" · "10% de chance da Recarga do Escudo de Energia começar quando você se Vincular a um alvo" · "Recuperação do Escudo de Energia aumentada em 20% se você não foi Acertado Recentemente" · "Evasão aumentada em 100% se a Recarga do Escudo de Energia iniciou nos últimos 2 segundos"

### gema · Totens

- **Nós da árvore:** 33 (ids no inventário da árvore). **Linhas:** 36 com efeito, 20 pendentes, 0 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `cast_speed_tag` (11) → habilidades (uso)
  - `dmg_inc` (9) → ficha (atributos finais), condições, golpe e tique
  - `totem_life` (6) → lacaios e totens
  - `crit_chance_inc` (5) → ficha (atributos finais), cargas, condições, golpe e tique, lacaios e totens
  - `crit_dmg` (5) → encontros/altares.mjs, ficha (atributos finais), itens/item.mjs, cargas, condições, golpe e tique
- **Gemas (arquétipo `totem`):** 21 — funcionam 0, parciais 21, sem comportamento 0. Motivos mais comuns: 21× o totem fica parado e usa a skill da gema no bicho mais perto (os bônus do PoE ao totem, como a velocidade de posicionamento, não entram); 20× efeito não simulado.
- **O que falta (pendentes):** totens múltiplos ("invocar dois"), dano sofrido pelo totem, roubo/provocação do totem — o totem do jogo é um só e simples. Exemplos: "Cada Totem aplica Dano aumentado em 1% sofrido pelos Inimigos próximos a ele" · "Duração do Totem aumentada em 30%" · "Velocidade de Movimento aumentada em 1% por Totem Convocado" · "Duração do Totem aumentada em 50%"

### mecanica · Solo e mapa

- **Nós da árvore:** 7 (ids no inventário da árvore). **Linhas:** 0 com efeito, 5 pendentes, 5 inexistentes no jogo.
- **O que falta (pendentes):** solos (sagrado, ardente…) e baús. Exemplos: "Efeito de Solos Sagrados Criados por você aumentado em 20%" · "Efeito de Solos Sagrados Criados por você aumentado em 10%" · "Efeito de Solos Sagrados Criados por você aumentado em 25%" · "Efeito de Solos Sagrados Criados por você aumentado em 20%"

### gema · Cadáveres

- **Nós da árvore:** 9 (ids no inventário da árvore). **Linhas:** 0 com efeito, 0 pendentes, 9 inexistentes no jogo.

### gema · Oferendas, golens e invocações

- **Nós da árvore:** 18 (ids no inventário da árvore). **Linhas:** 16 com efeito, 9 pendentes, 0 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `efeito_buff_gema:oferenda-carnal` (8) → itens-poe/arvore.mjs, condições, golpe e tique, gemas ativas
  - `efeito_buff_gema:oferenda-ossea` (8) → itens-poe/arvore.mjs, condições, golpe e tique, gemas ativas
  - `efeito_buff_gema:oferenda-espiritual` (8) → itens-poe/arvore.mjs, condições, golpe e tique, gemas ativas
  - `max_lacaio:zumbi` (2) → lacaios e totens
  - `max_lacaio:esqueleto` (2) → lacaios e totens
  - `max_lacaio:espectro` (1) → lacaios e totens
  - `block` (1) → habilidades (uso), caçada (tique), charms.mjs, encontros/altares.mjs, ficha (atributos finais), golpe básico e dano recebido, item-power.mjs, itens/item.mjs, condições, golpe e tique, itens-poe/jogo.mjs, party.mjs, magias dos monstros no jogador
  - `life_regen_max_pct` (1) → ficha (atributos finais)
  - `mana_regen_pct` (1) → ficha (atributos finais), cargas
- **Gemas (arquétipo `lacaio`):** 58 — funcionam 0, parciais 58, sem comportamento 0. Motivos mais comuns: 58× o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro; 49× efeito não simulado.
- **O que falta (pendentes):** os efeitos específicos de cada invocação. Exemplos: "Convocação tem Recuperação da Recarga aumentada em 40%" · "Convocação tem Recuperação da Recarga aumentada em 40%" · "Convocação tem Recuperação da Recarga aumentada em 40%" · "Convocação tem Recuperação da Recarga aumentada em 40%"

### item · Encaixes e cores

- **Nós da árvore:** 9 (ids no inventário da árvore). **Linhas:** 0 com efeito, 9 pendentes, 0 inexistentes no jogo.
- **O que falta (pendentes):** condições pela cor dos encaixes da arma/cajado. Exemplos: "Vida e mana máximos aumentados em 12%, se o seu cajado equipado tiver um encaixe azul e vermelho" · "Armadura e evasão aumentadas em 30%, se a arma da sua mão principal tiver um encaixe verde e vermelho" · "Vida e mana máximos aumentados em 12%, se o seu cajado equipado tiver um encaixe azul e vermelho" · "Armadura e evasão aumentadas em 30%, se a arma da sua mão principal tiver um encaixe verde e vermelho"

### gema · Guardas

- **Nós da árvore:** 17 (ids no inventário da árvore). **Linhas:** 12 com efeito, 7 pendentes, 0 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `ev:usarGuarda:manaPct` (12) → combate: acerto e eventos
- **Gemas (arquétipo `guarda`):** 12 — funcionam 0, parciais 12, sem comportamento 0. Motivos mais comuns: 27× efeito não simulado; 6× nenhum efeito do buff tem equivalente no jogo; 1× a absorção de dano da guarda ainda não existe no jogo.
- **O que falta (pendentes):** o escudo absorvente das guardas. Exemplos: "Habilidades de Guarda tem sua Velocidade de Recuperação da Recarga aumentada em 20%" · "Habilidades de Guarda têm Duração aumentada em 40%" · "Habilidades de Guarda tem sua Velocidade de Recuperação da Recarga aumentada em 20%" · "Habilidades de Guarda tem sua Velocidade de Recuperação da Recarga aumentada em 20%"

### item · Aljava, anéis, amuleto, cinto

- **Nós da árvore:** 8 (ids no inventário da árvore). **Linhas:** 2 com efeito, 6 pendentes, 0 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `es_pct` (2) → ficha (atributos finais), tela da ficha
- **O que falta (pendentes):** condições pelos modificadores de outras peças e os bônus da aljava. Exemplos: "Bônus recebidos da Aljava Equipada aumentado em 20%" · "Bônus recebidos da Aljava Equipada aumentado em 20%" · "Bônus recebidos da Aljava Equipada aumentado em 20%" · "Bônus recebidos da Aljava Equipada aumentado em 20%"

### item · Joias

- **Nós da árvore:** 1 (ids no inventário da árvore). **Linhas:** 0 com efeito, 2 pendentes, 0 inexistentes no jogo.
- **O que falta (pendentes):** encaixes de joia na árvore. Exemplos: "Joias Não Únicas fazem com que Aumentos e Reduções aos Tipos de Dano em um Grande Raio sejam Transformados para serem aplicados ao Dano de Fogo" · "Joias Não Únicas fazem com que Habilidades Passivas Pequenas e Notáveis em um Raio Grande também concedam +4 de Força"

### gema · Gemas Vaal

- **Nós da árvore:** 11 (ids no inventário da árvore). **Linhas:** 12 com efeito, 0 pendentes, 0 inexistentes no jogo.
- **Atributos que as linhas com efeito produzem → quem os lê (o sistema consumidor):**
  - `golpe_alvos_extra` (10) → habilidades (uso)
  - `ev:usarVaal:buff:agressividade` (1) → combate: acerto e eventos
  - `gem_level` (1) → skills/gemas.mjs

## As gemas por arquétipo (o eixo "gema" do grafo)

| Arquétipo | Gemas | Funcionam | Parciais | Sem comportamento | Motivos mais comuns |
|---|---:|---:|---:|---:|---|
| projetil | 101 | 44 | 57 | 0 | 121× efeito não simulado; 1× sem dano direto |
| area | 61 | 7 | 54 | 0 | 99× efeito não simulado; 11× o uso de cadáveres não existe no jogo; 3× as repetições do golpe não existem |
| lacaio | 58 | 0 | 58 | 0 | 58× o lacaio ataca do jeito do tipo dele (de longe ou de perto, o elemento, o golpe em área, o crítico, o sangramento) com a força de um monstro comum do nível dele, e o golem dá os bônus dele a você; o espectro ergue o último cadáver e usa as magias daquele monstro; 49× efeito não simulado |
| corpo_a_corpo | 49 | 8 | 41 | 0 | 84× efeito não simulado |
| canalizacao | 36 | 3 | 33 | 0 | 59× efeito não simulado; 11× os estágios de canalização não existem; 1× sem dano direto |
| aura | 31 | 9 | 22 | 0 | 47× efeito não simulado; 3× nenhum efeito do buff tem equivalente no jogo; 1× efeito não aplicado no jogo |
| armadilha | 27 | 4 | 23 | 0 | 40× efeito não simulado; 3× as repetições do golpe não existem; 1× sem dano direto |
| impacto | 23 | 1 | 22 | 0 | 53× efeito não simulado; 5× as repetições do golpe não existem |
| totem | 21 | 0 | 21 | 0 | 21× o totem fica parado e usa a skill da gema no bicho mais perto (os bônus do PoE ao totem, como a velocidade de posicionamento, não entram); 20× efeito não simulado |
| movimento | 21 | 0 | 21 | 0 | 41× efeito não simulado; 21× o deslocamento (salto, investida, teleporte) não existe; 5× sem dano direto |
| maldicao | 19 | 6 | 13 | 0 | 37× efeito não simulado; 12× nenhum efeito do buff tem equivalente no jogo; 1× a lentidão da maldição ainda não existe no jogo |
| generico | 19 | 0 | 0 | 19 | 19× a gema não tem comportamento de combate reconhecido |
| chuva | 15 | 2 | 13 | 0 | 23× efeito não simulado |
| nova | 15 | 4 | 11 | 0 | 19× efeito não simulado |
| orbe | 13 | 1 | 12 | 0 | 33× efeito não simulado |
| guarda | 12 | 0 | 12 | 0 | 27× efeito não simulado; 6× nenhum efeito do buff tem equivalente no jogo; 1× a absorção de dano da guarda ainda não existe no jogo |
| marca | 11 | 0 | 11 | 0 | 34× efeito não simulado; 2× sem dano direto; 1× os estágios de canalização não existem |
| clamor | 10 | 3 | 7 | 0 | 28× efeito não simulado |
| ricochete | 9 | 2 | 7 | 0 | 13× efeito não simulado |
| mina | 8 | 0 | 8 | 0 | 15× efeito não simulado; 2× sem dano direto |
| arauto | 3 | 0 | 3 | 0 | 9× efeito não simulado; 3× nenhum efeito do buff tem equivalente no jogo; 1× efeito não aplicado no jogo |
