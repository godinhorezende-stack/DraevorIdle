# Inventário da árvore de passivas do PoE (gerado)

Gerado por `game/tools/auditar-arvore-passivas.mjs` em 2026-10-09T14:53:35.183Z. Não edite à mão: rode de novo.

## Resumo

| Situação | Nós | % dos auditáveis |
| --- | ---: | ---: |
| funcional | 1753 | 63.0% |
| funcional-aproximado | 148 | 5.3% |
| parcial | 406 | 14.6% |
| sem-efeito | 365 | 13.1% |
| nao-classificado | 110 | 4.0% |
| **auditáveis** (sem os inícios) | 2782 | 100% |

Verificados no motor (alocar → somar → tirar): 2782 nós; com falha de alocação/cálculo/remoção: 0.

## A escada (onde cada nó chega)

Cada nó fica no ÚLTIMO degrau que alcança sem pular nenhum:

- **exibido**: está no editor, mas nada dele tem efeito;
- **alocavel**: o motor aloca e tira o nó, mas nenhuma linha tem efeito;
- **interpretado**: a linha vira modificador tipado com leitor no código, mas não se viu aplicar;
- **aplicado**: a ficha efetiva muda, ou o combate lê o valor no acerto/tique;
- **validado**: cada efeito tem teste numérico (`testes/cobertura-arvore.mjs` e os testes citados lá).

| Degrau | Nós | % dos auditáveis |
| --- | ---: | ---: |
| exibido | 0 | 0.0% |
| alocavel | 475 | 17.1% |
| interpretado | 10 | 0.4% |
| aplicado | 1081 | 38.9% |
| validado | 1216 | 43.7% |

Como o "aplicado" foi observado: ficha 1694 · combate 603 · sem efeito 475 · condicional 10. Legenda:

- **ficha**: um número da ficha efetiva mudou (vida, armadura, golpe…);
- **combate**: o valor está no que o combate lê no acerto/tique (`afPoe`, eventos, golpe por tag);
- **condicional**: depende de condição que o cenário automático não monta;
- **nao**: interpretado, mas nada mudou (verificar).

| Categoria | exibido | alocavel | interpretado | aplicado | validado |
| --- | ---: | ---: | ---: | ---: | ---: |
| notavel | 0 | 54 | 3 | 249 | 148 |
| comum | 0 | 174 | 4 | 454 | 886 |
| encaixe-de-joia | 0 | 57 | 0 | 0 | 0 |
| keystone | 0 | 19 | 0 | 11 | 18 |
| maestria | 0 | 46 | 0 | 253 | 16 |
| ascendencia-comum | 0 | 22 | 2 | 76 | 129 |
| ascendencia-notavel | 0 | 103 | 1 | 38 | 19 |

## Por categoria

| Categoria | Nós | funcional | funcional-aproximado | parcial | sem-efeito | nao-classificado |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| notavel | 454 | 307 | 23 | 70 | 54 | 0 |
| comum | 1518 | 1237 | 75 | 32 | 132 | 42 |
| encaixe-de-joia | 57 | 0 | 0 | 0 | 0 | 57 |
| keystone | 48 | 22 | 4 | 3 | 19 | 0 |
| inicio | 7 | 0 | 0 | 0 | 0 | 0 |
| maestria | 315 | 19 | 26 | 224 | 46 | 0 |
| ascendencia-comum | 229 | 147 | 19 | 41 | 22 | 0 |
| ascendencia-notavel | 161 | 21 | 1 | 36 | 92 | 11 |
| ascendencia-inicio | 21 | 0 | 0 | 0 | 0 | 0 |

## Matriz por forma do efeito

| Tipo | Efeitos | Nós | Conectados (leitor no código) | Alocação ok / verificados | Cálculo ok / verificados |
| --- | ---: | ---: | ---: | ---: | ---: |
| soma simples | 2818 | 1678 | 2814 (99.9%) | 2818/2818 | 2818/2818 |
| condição de estado (com escudo, vida baixa…) | 536 | 305 | 536 (100.0%) | 536/536 | 536/536 |
| tag de golpe (ataque, magia, projétil…) | 503 | 401 | 503 (100.0%) | 503/503 | 503/503 |
| condição de estado + tag de golpe | 487 | 239 | 487 (100.0%) | 487/487 | 487/487 |
| % de stat (formato das especializações) | 203 | 198 | 203 (100.0%) | 203/203 | 203/203 |
| evento (ao matar, bloquear…) | 177 | 100 | 177 (100.0%) | 177/177 | 177/177 |
| dinâmico (buff, gema, keystone…) | 126 | 65 | 126 (100.0%) | 126/126 | 126/126 |
| escala (por X) | 80 | 63 | 80 (100.0%) | 80/80 | 80/80 |
| escala da ficha (por X de armadura, bloqueio…) | 27 | 17 | 27 (100.0%) | 27/27 | 27/27 |
| escala com condição | 4 | 4 | 4 (100.0%) | 4/4 | 4/4 |

## Matriz por tipo de modificador

| Tipo | Efeitos | Nós | Conectados (leitor no código) | Alocação ok / verificados | Cálculo ok / verificados |
| --- | ---: | ---: | ---: | ---: | ---: |
| dano % (aumentado e "mais") | 942 | 584 | 938 (99.6%) | 942/942 | 942/942 |
| outros | 526 | 303 | 526 (100.0%) | 526/526 | 526/526 |
| afecções e chance no acerto | 369 | 279 | 369 (100.0%) | 369/369 | 369/369 |
| crítico | 330 | 234 | 330 (100.0%) | 330/330 | 330/330 |
| velocidades | 328 | 290 | 328 (100.0%) | 328/328 | 328/328 |
| atributos (For/Des/Int) | 296 | 273 | 296 (100.0%) | 296/296 | 296/296 |
| armadura e evasão | 248 | 188 | 248 (100.0%) | 248/248 | 248/248 |
| resistências | 231 | 115 | 231 (100.0%) | 231/231 | 231/231 |
| vida, regeneração e dreno de vida | 216 | 181 | 216 (100.0%) | 216/216 | 216/216 |
| efeito por evento | 177 | 100 | 177 (100.0%) | 177/177 | 177/177 |
| escudo de energia | 157 | 129 | 157 (100.0%) | 157/157 | 157/157 |
| mana e custo | 141 | 123 | 141 (100.0%) | 141/141 | 141/141 |
| bloqueio | 132 | 100 | 132 (100.0%) | 132/132 | 132/132 |
| auras, maldições e reserva | 109 | 91 | 109 (100.0%) | 109/109 | 109/109 |
| vida % | 99 | 99 | 99 (100.0%) | 99/99 | 99/99 |
| frascos | 93 | 48 | 93 (100.0%) | 93/93 | 93/93 |
| atordoamento | 88 | 70 | 88 (100.0%) | 88/88 | 88/88 |
| lacaios e totens | 80 | 71 | 80 (100.0%) | 80/80 | 80/80 |
| área e projéteis | 80 | 79 | 80 (100.0%) | 80/80 | 80/80 |
| cargas e fúria | 75 | 66 | 75 (100.0%) | 75/75 | 75/75 |
| precisão | 75 | 54 | 75 (100.0%) | 75/75 | 75/75 |
| mana % | 71 | 71 | 71 (100.0%) | 71/71 | 71/71 |
| supressão de magia | 40 | 40 | 40 (100.0%) | 40/40 | 40/40 |
| precisão % | 33 | 33 | 33 (100.0%) | 33/33 | 33/33 |
| penetração | 19 | 19 | 19 (100.0%) | 19/19 | 19/19 |
| conversão / dano extra | 6 | 6 | 6 (100.0%) | 6/6 | 6/6 |

## Efeitos traduzidos sem efeito real (causa técnica)

| Causa | Nós | Exemplos |
| --- | ---: | --- |
| condição desconhecida: alvoVenenos:5 | 4 | Maestria de Adagas (7634); Maestria de Adagas (15409); Maestria de Adagas (31197); Maestria de Adagas (62853) |

## Linhas sem tradução com efeito (pendentes), por tema

| Grupo · tema | Linhas | Nós | O que precisa | Exemplos |
| --- | ---: | ---: | --- | --- |
| mecanica · Outros | 394 | 253 | mecânica própria desta linha | Habilidades de Ataque tem +1 de número máximo aos Totens Balista Convocados / Efeito em Área de Habilidades Feitiço aumentada em 15% / Eficiência de custo de mana de habilidades de conexão aumentada em 20% |
| gema · Lacaios | 83 | 35 | os atributos dos lacaios além de dano/vida/velocidade (área, recarga, penetração, buffs ao matar, resistências máximas) — o lacaio do jogo ainda não tem esses números | Lacaios têm +20% de Multiplicador de Acerto Crítico / Aumentos e reduções de Dano de Lacaio também afetam você / Lacaios têm Chance de Acerto Crítico aumentada em 25% |
| gema · Armadilhas e Minas | 80 | 30 | armadilhas e minas de verdade (armar, detonar, limite plantado, auras das minas) — no jogo as gemas viram golpes comuns | Minas tem Velocidade de Detonação aumentada em 20% / Habilidades usadas por Minas causam Dano em Área aumentado em 30% caso tenha Detonado uma Mina Recentemente / Habilidades usadas por Minas têm Efeito em Área aumentado em 15% caso tenha Detonado uma Mina Recentemente |
| gema · Marcas e Runas | 70 | 30 | marcas presas ao inimigo (vínculo, convocação, alcance, duração da marca) | Dano com Acertos e Afecções contra Inimigos Marcados aumentado em 20% / Habilidades de Runa têm sua Duração aumentada em 15% / Inimigo Marcado concede Cargas de Frasco aumentadas em 20% a Você |
| mecanica · Precisão e crítico | 60 | 44 | precisão "mais" contra únicos/de perto, crítico contra o personagem | Precisão aumentada em 40%, se você tiver pelo menos 1 aliado por perto / Inimigos são Empurrados caso você acerte um Golpe Crítico com um Cajado / Empurra Inimigos se você tiver um Golpe Crítico com Dano de Projéteis |
| mecanica · Atordoamento | 51 | 40 | duração do atordoamento crítico, ignorar atordoamento, atordoar em área ao ser atordoado | 10% do Dano sofrido de Acertos Atordoadores é Recuperado como Vida / Acertos Atordoam como se causassem 50% mais Dano de Fogo Corpo a Corpo / Incêndios de Acertos Corpo a Corpo Atordoantes causam 20% mais Dano |
| mecanica · Recuperação e regeneração | 44 | 29 | recuperação ao longo do tempo, regeneração periódica e a dos inimigos próximos | Regeneração de Mana aumentada em 1% por cada 1% de Chance de Bloquear Dano Mágico / Enquanto não estiver em Vida Cheia, Sacrifica 20% da Mana por Segundo para Recuperar a mesma quantidade de Vida / A cada 4 segundos, Regenera 15% de Vida durante um segundo |
| mecanica · Defesa e armadura | 43 | 27 | defender com armadura extra, bloqueio máximo, evasão condicional | +3% à Chance máxima de Bloquear Dano Mágico / 100% de chance de Defender com 200% de Armadura / +3% à Chance máxima de Bloquear o Dano de Ataques |
| mecanica · Fúria, cargas e poder | 41 | 30 | ganhos e perdas de cargas/fúria em situações específicas | Efeito da Fúria Arcana aumentado em 20% em você / Perna Inerente de Fúria começa 1 segundo depois / Efeito da Fúria Arcana aumentado em 10% por cada 200 de Mana gasto Recentemente, até 50% |
| mecanica · Reflexo | 36 | 26 | reflexo de dano dos monstros (o jogo ainda não reflete dano no personagem) | Evita +60% do dano elemental refletido / Evita +60% do dano físico refletido / Evita +50% do dano refletido |
| item · Frascos | 33 | 24 | cargas de frasco por abate/inimigo marcado e efeitos durante o frasco | Velocidade de Recuperação dos Frascos aumentada em 30% / Ganha 4 de Mana por Inimigo Acertado pelos Ataques se você usou um Frasco de Mana nos últimos 10 segundos / Cargas de Frasco recebidas aumentadas em 20% caso você tenha causado um Golpe Crítico Recentemente |
| mecanica · Afecções e controle | 31 | 25 | afecções em você (limite, "enquanto tiver uma"), empalar em você, resfriamento mínimo, dano por segundo congelado | 25% de chance de Agravar o Sangramento em alvos que você Golpear com um Crítico com Ataques / 10% de chance de Agravar o Sangramento em alvos que você Acertar com Ataques / Dano de Raio dos Inimigos Acertando você enquanto você estiver Eletrizado é Azarado |
| gema · Conjuração | 29 | 21 | contar as magias conjuradas recentemente e ignorar atordoamento ao conjurar | 25% de chance de Ignorar Atordoamentos enquanto Conjurando / 15% de chance de Ignorar Atordoamentos enquanto Conjurando / Magias Conjuradas por Totens têm 4% de Velocidade de Conjuração aumentada |
| mecanica · Debuffs do PoE | 29 | 29 | Crueldade, Esmagado, Sangue Corrompido — debuffs que o jogo ainda não tem | Esmaga Inimigos por 4 segundos quando você Acertá-los enquanto estiverem em Vida Cheia / Efeito da Crueldade aumentado em 30% / Acertos Impiedosos Intimidam Inimigos por 4 segundos |
| mecanica · Escudo de Energia | 29 | 22 | a recarga do escudo (atraso, início, ritmo), escudo no ponto de atordoamento, caos que não ignora o escudo | Não pode Recuperar Escudo de Energia acima da Evasão / Quando Acertado, perca uma Mortalha Fantasma para Recuperar Escudo de Energia igual a 3% da sua Evasão / Regenera 5% de Escudo de Energia durante 1 segundo quando Atordoado |
| gema · Clamores | 28 | 24 | o Poder dos clamores, a recarga e os bônus do clamor reforçado | Velocidade de Recarga do Clamor aumentada em 15% / Velocidade de Recarga do Clamor aumentada em 12% / Habilidades de Clamor têm Efeito em Área aumentado em 15% |
| gema · Canalização e repetição | 26 | 10 | canalização por estágios, intensidade, selos (Liberar) e repetição de magias — no jogo cada uso é um | Repetição Final das Magias têm Efeito em Área aumentado em 40% / Magias que podem ganhar Intensidade têm +1 de Intensidade máxima / Habilidades suportadas por Liberar tem +1 ao número máximo de Selos |
| mecanica · Exposição | 23 | 16 | exposição com valor mínimo, efeito de exposição em você | Chance de Golpe Crítico contra inimigos com Exposição a Raio aumentada em 60% / Exposições infligidas por você aplicam ao menos -18% à Resistência afetada / Efeito de Exposições em você reduzido em 50% |
| gema · Totens | 20 | 12 | totens múltiplos ("invocar dois"), dano sofrido pelo totem, roubo/provocação do totem — o totem do jogo é um só e simples | Cada Totem aplica Dano aumentado em 1% sofrido pelos Inimigos próximos a ele / Duração do Totem aumentada em 30% / Velocidade de Movimento aumentada em 1% por Totem Convocado |
| item · Defesa de uma peça | 17 | 14 | a defesa de UMA peça já existe (`ficha.defesasDaFicha`, lote 5); faltam o que depende da recuperação/recarga do escudo e das condições de outras peças | Remove todo Escudo Mágico / 10% de chance da Recarga do Escudo de Energia começar quando você se Vincular a um alvo / Recuperação do Escudo de Energia aumentada em 20% se você não foi Acertado Recentemente |
| gema · Golpes e ataques | 9 | 9 | alcance corpo a corpo, ataques impelidos por clamor, posturas | +0.1 metros ao Alcance de Golpes Corpo a Corpo com Espadas / Dano de Ataque aumentado em 20% enquanto na Postura do Sangue / +0.4 metros ao Alcance de Golpes Corpo a Corpo enquanto com ao menos 5 Inimigos Próximos |
| item · Encaixes e cores | 9 | 9 | condições pela cor dos encaixes da arma/cajado | Vida e mana máximos aumentados em 12%, se o seu cajado equipado tiver um encaixe azul e vermelho / Armadura e evasão aumentadas em 30%, se a arma da sua mão principal tiver um encaixe verde e vermelho |
| gema · Oferendas, golens e invocações | 9 | 7 | os efeitos específicos de cada invocação | Convocação tem Recuperação da Recarga aumentada em 40% / Suas Habilidades de Oferenda também afetam você / Suas Oferendas possuem 50% de redução do Efeito em você |
| gema · Guardas | 7 | 5 | o escudo absorvente das guardas | Habilidades de Guarda tem sua Velocidade de Recuperação da Recarga aumentada em 20% / Habilidades de Guarda têm Duração aumentada em 40% / Remove Sangramento quando você usar uma Habilidade de Guarda |
| item · Aljava, anéis, amuleto, cinto | 6 | 6 | condições pelos modificadores de outras peças e os bônus da aljava | Bônus recebidos da Aljava Equipada aumentado em 20% / Seu mercenário pode equipar anéis únicos |
| mecanica · Solo e mapa | 5 | 4 | solos (sagrado, ardente…) e baús | Efeito de Solos Sagrados Criados por você aumentado em 20% / Efeito de Solos Sagrados Criados por você aumentado em 10% / Efeito de Solos Sagrados Criados por você aumentado em 25% |
| gema · Auras e Arautos | 5 | 5 | efeitos de aura em aliados e a duração das auras não reservadas | Efeito dos Buffs de Arauto em você aumentado em 20% / Habilidades de Arauto têm Efeito em Área aumentado em 25% / Efeito dos Buffs de Arauto em você aumentado em 10% |
| item · Joias | 2 | 1 | encaixes de joia na árvore | Joias Não Únicas fazem com que Aumentos e Reduções aos Tipos de Dano em um Grande Raio sejam Transformados para serem aplicados ao Dano de Fogo / Joias Não Únicas fazem com que Habilidades Passivas Pequenas e Notáveis em um Raio Grande também concedam +4 de Força |
| gema · Maldições | 1 | 1 | as maldições do PoE já amaldiçoam o monstro com limite, duração, "expirou X%", lentidão e o evento "sem Maldições" (`Reforcos.marcar`); o monstro à prova de maldições, a regeneração/escudo do amaldiçoado, o "destruído" e as maldições dos monstros em você também; faltam as auras não-maldição nos inimigos e o redefinir de esfriamentos e eletrificações | Efeito de Auras Não-Maldição de suas Habilidades aumentado em 10% nos Inimigos |

## Nós parciais e sem efeito (lista verificável)

### notavel (124)

- `544` Vigilância — **parcial**: pendente: Habilidades de Ataque tem +1 de número máximo aos Totens Balista Convocados · pendente: Cada Totem aplica Dano aumentado em 1% sofrido pelos Inimigos próximos a ele
- `1340` Baluarte — **sem-efeito**
- `2275` Composto da Natureza — **sem-efeito**
- `2599` Resposta Pronta — **sem-efeito**
- `4177` Ajuda Espiritual — **sem-efeito**: pendente: Aumentos e reduções de Dano de Lacaio também afetam você
- `4918` Vingança Indiscriminada — **sem-efeito**
- `5430` Golpes Magmáticos — **sem-efeito**: pendente: A cada 10 segundos, ganhe 30% do Dano Físico como Dano Extra de Fogo por 4 segundos
- `6233` Ondas Explosivas — **sem-efeito**: pendente: Habilidades usadas por Minas causam Dano em Área aumentado em 30% caso tenha Detonado uma Mina Recentemente · pendente: Habilidades usadas por Minas têm Efeito em Área aumentado em 15% caso tenha Detonado uma Mina Recentemente
- `6289` Sem Sangue — **parcial**
- `6967` Garantia — **parcial**: pendente: +3% à Chance máxima de Bloquear Dano Mágico
- `7069` Tiro Partido — **sem-efeito**: pendente: Projéteis têm 50% de chance de receber um Projétil adicional quando Difundindo
- `7136` Mestre Sabotador — **parcial**: pendente: Pode ter até 2 Armadilhas adicionais plantadas por vez · pendente: 15% de chance de receber uma Carga de Frenesi quando sua Armadilha for ativada por um Inimigo
- `8135` Aplicação Prática — **parcial**: pendente: 25% de chance de Ignorar Atordoamentos enquanto Conjurando
- `8458` Tiro Longo — **parcial**: pendente: Projéteis ganham Dano conforme viajam adiante, causando · pendente: Dano aumentado em até 60% com Acertos em alvos
- `9055` Minas Voláteis — **sem-efeito**: pendente: Duração da Mina aumentada em 30% · pendente: Pode ter até 3 Minas Remotas adicionais plantadas por vez · pendente: Minas tem Velocidade de Detonação aumentada em 30%
- `10115` Perfeição Pródiga — **parcial**: pendente: Dano Mágico aumentado em 2% por cada 100 de Mana Máxima, até 40%
- `13703` Postura Desafiadora — **sem-efeito**
- `13922` Firme — **sem-efeito**
- `14001` Invencível — **parcial**: pendente: 10% do Dano sofrido de Acertos Atordoadores é Recuperado como Vida
- `14813` Pândega — **parcial**: pendente: Efeito de Auras Não-Maldição de suas Habilidades aumentado em 10% nos Inimigos
- `15085` Ambidestria — **sem-efeito**: pendente: Dano de Ataque com a Mão Principal aumentado em 60% enquanto em Empunhadura Dupla · pendente: Velocidade de Ataque com a Mão Secundária aumentada em 30% enquanto em Dupla Empunhadura
- `15226` Retaliação Cruel — **sem-efeito**
- `15290` Torres de Vigílha — **parcial**: pendente: Habilidades de Ataque tem +1 de número máximo aos Totens Balista Convocados · pendente: Velocidade de Movimento aumentada em 1% por Totem Convocado
- `15400` Runas Escorregadias — **parcial**: pendente: Efeito em Área de Habilidades Feitiço aumentada em 50% · pendente: Eficiência de custo de mana de habilidades de maldição aumentada em 20%
- `18174` Bastião Místico — **parcial**: pendente: Regeneração de Mana aumentada em 1% por cada 1% de Chance de Bloquear Dano Mágico
- `19730` Golpe Certeiro — **parcial**: pendente: +0.4 metros ao Alcance de Golpes Corpo a Corpo enquanto com ao menos 5 Inimigos Próximos
- `19794` Força Concussiva — **sem-efeito**: pendente: Acertos Atordoam como se causassem 50% mais Dano de Fogo Corpo a Corpo · pendente: Incêndios de Acertos Corpo a Corpo Atordoantes causam 20% mais Dano
- `19858` Herborismo — **parcial**: pendente: Velocidade de Recuperação dos Frascos aumentada em 30%
- `21297` Altamente Explosivos — **parcial**: pendente: 15% de chance de receber uma Carga do Poder quando sua Armadilha for ativada por um Inimigo
- `21389` Forjador de Runas — **sem-efeito**: pendente: Velocidade de Conjuração com Habilidades de Runas aumentada em 12%
- `21602` Aparato Destrutivo — **parcial**: pendente: Duração da Mina aumentada em 60%
- `21973` Proteção da Podridão — **parcial**: pendente: Lacaios tem +18% de Chance de Bloquear o Dano Mágico · pendente: Lacaios Recuperam 2% de suas Vidas quando Bloqueiam
- `24256` Dínamo — **parcial**: pendente: Habilidades de Guarda têm Duração aumentada em 40%
- `25178` Espírito Primitivo — **parcial**: pendente: Ganha 4 de Mana por Inimigo Acertado pelos Ataques se você usou um Frasco de Mana nos últimos 10 segundos
- `25409` Exército Indomável — **parcial**: pendente: Lacaios tem 15% de Redução de Dano Físico adicional · pendente: Se Mover enquanto Sangrando não faz com que Lacaios sofram Dano extra
- `25439` Coveiro — **parcial**: pendente: Profanar e Desenterrar tem +2 de número Máximo de cadáveres permitidos
- `25738` Perseguição Implacável — **sem-efeito**: pendente: Velocidade de Ataque aumentado em 10% se você conjurou uma Magia de Runa Recentemente · pendente: Velocidade de Movimento aumentada em 10% se você conjurou uma Magia de Marca Recentemente
- `26294` Sangria — **parcial**: pendente: 10% de chance de Agravar o Sangramento em alvos que você Acertar com Ataques
- `26564` Vencedor — **parcial**: pendente: Esmaga Inimigos por 4 segundos quando você Acertá-los enquanto estiverem em Vida Cheia
- `26620` Corrupção — **sem-efeito**
- `26763` Fórmula Aperfeiçoada — **sem-efeito**
- `27119` Fúria Tribal — **sem-efeito**: pendente: Habilidades de Golpe Corpo a Corpo causam Dano Propagado aos alvos ao redor
- `27190` Super Preparado — **sem-efeito**: pendente: Habilidades que Arremessam Armadilhas têm +1 Uso de Recarga
- `27308` Pacto da Sepultura — **parcial**: pendente: Lacaios tem 8% de chance de causar Dano Dobrado
- `28034` Vínculo Maximizador — **sem-efeito**: pendente: +2 ao Nível de todas as Gemas de Habilidade de Vínculo
- `28449` Explosão de Vigor — **sem-efeito**: pendente: A cada 4 segundos, Regenera 15% de Vida durante um segundo
- `29381` Horda Faminta — **parcial**: pendente: Lacaios tem 30% de chance de ganhar Agressividade por 4 segundos ao Matar
- `29522` Dança das Lâminas — **sem-efeito**
- `29861` Runas Explosivas — **parcial**: pendente: Alcance do Vínculo de Runas aumentado em 30%
- `30160` Defender-se — **parcial**: pendente: Distância do Empurrão aumentada em 25%
- `30974` Caçador Perito — **sem-efeito**
- `31257` Autoridade Natural — **parcial**: pendente: Inimigos Provocados por seus Clamores sofrem Dano aumentado em 8%
- `31513` Animosidade Adjacente — **parcial**: pendente: Projéteis causam Dano com Acertos aumentado em 40% aos alvos no início de seu movimento, reduzido para 0% na medida em que viajam adiante
- `31585` Conservador Cuidadoso — **parcial**: pendente: Cargas de Frasco recebidas aumentadas em 20% caso você tenha causado um Golpe Crítico Recentemente
- `32681` Presa Marcada — **sem-efeito**: pendente: Inimigo Marcado tem Precisão reduzida em 10% · pendente: Inimigo Marcado sofre Dano aumentado em 10%
- `33718` Campeão da Causa — **parcial**
- `33777` Dispositivos Devastadores — **parcial**: pendente: 10% de chance de receber uma Carga do Poder quando sua Mina for Detonada por um Inimigo alvo
- `34973` Fúria Medida — **sem-efeito**
- `34978` Mistura Coloidal — **sem-efeito**
- `35233` Artesão da Discórdia — **parcial**: pendente: Efeito dos Buffs de Arauto em você aumentado em 20%
- `35685` Força Destemida — **sem-efeito**: pendente: Lacaios têm Chance de Acerto Crítico aumentada em 60% · pendente: Lacaios têm +20% de Multiplicador de Acerto Crítico
- `36949` Devoção — **parcial**: pendente: Efeito de Solos Sagrados Criados por você aumentado em 25%
- `37425` Reaplicação Praticada — **sem-efeito**
- `38246` Presságio — **parcial**: pendente: Habilidades de Arauto têm Efeito em Área aumentado em 25%
- `39986` Forças Profanadas — **parcial**: pendente: Redefine a duração de esfriamentos e eletrificações em inimigos amaldiçoados por você
- `40619` Admiração e Terror — **sem-efeito**
- `41137` Medicina de Campo — **parcial**: pendente: Frascos de Vida ganham uma Carga quando você acertar um Inimigo, não mais que uma vez por segundo
- `41305` Resposta Esmagadora — **sem-efeito**
- `41420` Remédios Naturais — **parcial**: pendente: Remove Mutilação e Desaceleração ao usar um Frasco
- `41595` Marcado para Morrer — **sem-efeito**: pendente: Golpe de Misericórdia contra Inimigos Marcados
- `41870` Abraço Invernal — **parcial**: pendente: Dano aumentado em 30% se você Estilhaçou um Inimigo Recentemente
- `43689` Comando Espiritual — **parcial**: pendente: Aumentos e Reduções à Velocidade de Ataque dos Lacaios também te afetam
- `44102` Explosivos Eficientes — **parcial**: pendente: Minas têm uma chance de 15% de serem Detonadas uma Vez Adicional
- `44191` Como a Montanha — **parcial**: pendente: +3% à Chance máxima de Bloquear o Dano de Ataques
- `44207` Tartaruga — **parcial**
- `44788` Conexões Potentes — **sem-efeito**
- `45329` Tiro Ardil — **sem-efeito**: pendente: Alcance do Ricochete aumentado em 30%
- `45350` Glória do Comando — **sem-efeito**: pendente: Precisão aumentada em 40%, se você tiver pelo menos 1 aliado por perto · pendente: Área de efeito de ataques aumentada em 15%, se você tiver pelo menos 1 aliado por perto
- `45608` Detonações Sucessivas — **sem-efeito**: pendente: Chance de Golpe Crítico aumentada em 10% por cada Mina Detonada · pendente: Recentemente, até 100% · pendente: +4% de Multiplicador de Golpes Críticos para cada Mina Detonada · pendente: Recentemente, até 40%
- `45657` Provação da Fé — **parcial**: pendente: Regenera 5% de Escudo de Energia durante 1 segundo quando Atordoado · pendente: Regenera 5% de Vida durante 1 segundo quando Atordoado
- `45945` Barreira Conjurada — **parcial**: pendente: 30% de chance de Ignorar Atordoamentos enquanto Conjurando
- `46471` Vínculo Poderoso — **sem-efeito**: pendente: Efeito do Buff dos seus Vínculos aumentado em 20% para cada 50% de Duração do Vínculo que tenha Expirado
- `46965` Sabotador — **parcial**: pendente: Pode ter até 2 Armadilhas adicionais plantadas por vez · pendente: Pode ter até 2 Minas Remotas adicionais plantadas por vez
- `48556` Coração das Trevas — **parcial**: pendente: Dano Penetra 7% da Resistência a Caos
- `48807` Arte do Gladiador — **parcial**: pendente: Penalidades de Movimento das Armaduras são Ignoradas
- `49416` Inflexível — **parcial**: pendente: Remove Sangramento quando você usar uma Habilidade de Guarda · pendente: remove Sangue Corrompido ao usar uma Habilidade de Guarda · pendente: Habilidades de Guarda têm Duração aumentada em 25%
- `49445` Respirações Profundas — **sem-efeito**: pendente: Velocidade de Recarga do Clamor aumentada em 35% · pendente: Habilidades de Clamor têm Efeito em Área aumentado em 40%
- `50842` Ira do Veterano — **parcial**: pendente: Perna Inerente de Fúria começa 1 segundo depois
- `50858` Admoestador — **parcial**: pendente: Dano aumentado em 15% para cada vez que você Clamou Recentemente
- `51108` Capacitor Arcano — **parcial**: pendente: Efeito da Fúria Arcana aumentado em 10% por cada 200 de Mana gasto Recentemente, até 50% · pendente: 10% de chance de ganhar Fúria Arcana ao Matar um Inimigo
- `52030` Explosão Enérgica — **sem-efeito**
- `52742` Morte Apressada — **parcial**: pendente: Mais 30% de dano degenerativo com habilidades mágicas
- `53802` Extração de Essência — **parcial**: pendente: Recuperação de Mana aumentada em 15% durante o Efeito de qualquer Frasco de Mana
- `54268` Barreira de Lâmina — **parcial**
- `54694` Luz da Divindade — **parcial**
- `54791` Garras da Gralha — **parcial**: pendente: 25% de chance de Roubar Cargas de Poder, Frenesi e Tolerância ao Acertar com Garras
- `55002` Fúria Justificada — **parcial**
- `55027` Justiça Brilhante — **sem-efeito**: pendente: Efeito de Solos Sagrados Criados por você aumentado em 20% · pendente: Seu chão consagrado concede precisão aumentada em 30% para você e seus aliados
- `55194` Cinzas Assentadas — **sem-efeito**: pendente: Inimigos Próximos são Cobertos em Cinzas se você não se moveu nos últimos 2 segundos
- `55380` Construção Inteligente — **sem-efeito**: pendente: 10% de Chance das Armadilhas Ativarem uma vez adicional
- `55381` Retaliação Arcana — **sem-efeito**: pendente: 25% mais Dano Mágico se você foi Atordoado enquanto Conjurando Recentemente
- `56330` Fluxo da Batalha — **sem-efeito**
- `58382` Feitos Renomados — **sem-efeito**: pendente: +30 ao máximo de Valor
- `58851` Líder da Matilha — **parcial**
- `59423` Escalonamento — **sem-efeito**: pendente: Dano Corpo a Corpo aumentado em 10% para cada segundo que você for afetado por um Buff de Clamor, máximo de 60%
- `59866` Entrincheirar — **parcial**: pendente: Frascos de Vida ganham 3 quando você Suprimir Dano Mágico
- `59976` Contra-ataque Cuidadoso — **sem-efeito**
- `60085` Preservação Arcana — **parcial**: pendente: Eficiência de custo de mana de magias aumentada em 20%
- `60781` Vínculo Inspirador — **sem-efeito**: pendente: 10% de chance da Recarga do Escudo de Energia começar quando você se Vincular a um alvo · pendente: Habilidades de Vïnculo têm Efeito do Buff aumentado em 20% se você se Vinculou a um alvo Recentemente
- `61190` Ícone da União — **sem-efeito**
- `61982` Graves Intenções — **parcial**: pendente: Lacaios ganham 20% de sua Vida Máxima como Escudo de Energia Máximo
- `63033` Porta Estandarte — **sem-efeito**: pendente: Bônus do seu estandarte permanecem por 3 segundos após você sair da área
- `63150` Pau-Ferro — **parcial**: pendente: Totens possuem 40% de Redução de Dano Físico adicional
- `63207` Explosão Tempestuosa — **sem-efeito**: pendente: Ganhe 20% do Dano Físico da Varinha como Dano Extra de Raio
- `63251` Inveterado — **parcial**: pendente: Ignora +3% do Dano Mágico Suprimido
- `63453` Sustento Excessivo — **sem-efeito**: pendente: 15% de chance de ganhar 200 de Vida ao Acertar com Ataques
- `63635` Manifestação Primitiva — **parcial**: pendente: Duração do Totem aumentada em 50%
- `63933` Zelo Totêmico — **parcial**: pendente: Magias Conjuradas por Totens têm 8% de Velocidade de Conjuração aumentada
- `64226` Rugido Desafiador — **sem-efeito**: pendente: Poder total contado por Clamores aumentado em 25%
- `64355` Equidade de Runas — **sem-efeito**: pendente: Você pode Conjurar 2 Runas Adicionais · pendente: Habilidades de Runa têm sua Duração aumentada em 20% · pendente: Convocação de Runas tem sua Velocidade de Recuperação de Recarga aumentada em 20%
- `64395` Contusão — **parcial**: pendente: Inimigos são Empurrados caso você acerte um Golpe Crítico com um Cajado
- `65093` Dançarino da Lâmina — **parcial**: pendente: +0.3 metros ao Alcance de Golpes Corpo a Corpo com Espadas
- `65097` Liderança — **parcial**
- `65210` Coração de Carvalho — **parcial**: pendente: Regenera 2% de Vida por Segundo se você usou um Frasco de Vida nos últimos 10 segundos

### comum (206)

- `224` Recuperação da Recarga de Clamores — **sem-efeito**: pendente: Velocidade de Recarga do Clamor aumentada em 15%
- `494` Dano com Habilidades de Retaliação e Bloqueio com Escudos — **parcial**
- `655` Queima de Mana mais Lenta — **sem-efeito**
- `1652` Área de Efeito de Feitiços — **sem-efeito**: pendente: Efeito em Área de Habilidades Feitiço aumentada em 15%
- `1696` Duração e Velocidade para Colocar Totem — **parcial**: pendente: Duração do Totem aumentada em 30%
- `1722` Multiplicador de Golpe Crítico de Lacaios — **sem-efeito**: pendente: Lacaios têm +20% de Multiplicador de Acerto Crítico
- `2348` Eficiência de Custo de Mana de Conexão — **sem-efeito**: pendente: Eficiência de custo de mana de habilidades de conexão aumentada em 20%
- `2413` Queima de Mana mais Lenta — **sem-efeito**
- `3089` Efeito dos Vínculos — **sem-efeito**
- `3319` Bloqueio com Escudos e Recuperação de Bloqueio — **parcial**
- `3854` Proxy de Posicionamento — **nao-classificado**
- `4269` Dano contra Inimigos Marcados — **sem-efeito**: pendente: Dano com Acertos e Afecções contra Inimigos Marcados aumentado em 20%
- `4270` Duração de Runas — **sem-efeito**: pendente: Habilidades de Runa têm sua Duração aumentada em 15%
- `4546` Velocidade de Detonação de Minas — **sem-efeito**: pendente: Minas tem Velocidade de Detonação aumentada em 20%
- `5203` Duração do Atordoamento das Habilidades de Retaliação — **sem-efeito**
- `5935` Área de Efeito da Aura — **sem-efeito**
- `6139` Ganho de Fortificações — **sem-efeito**
- `6264` Efeito de Tinturas — **sem-efeito**
- `7609` Ângulo Bifurcado — **sem-efeito**: pendente: Ângulo da Difusão de Projéteis reduzido em 50%
- `7659` Eficiência de Custo de Mana de Marcas — **sem-efeito**: pendente: Eficiência de custo de mana de habilidades de marca aumentada em 20%
- `7728` Duração dos Estandartes — **sem-efeito**
- `7898` Chance de Golpe Crítico de Lacaios — **sem-efeito**: pendente: Lacaios têm Chance de Acerto Crítico aumentada em 25%
- `7956` Proxy de Posicionamento — **nao-classificado**
- `8139` Velocidade de Conjuração dos Vínculos — **sem-efeito**
- `8410` Velocidade de Ataque na Postura de Areia — **sem-efeito**
- `8620` Cargas de Frasco contra Inimigos Marcados — **sem-efeito**: pendente: Inimigo Marcado concede Cargas de Frasco aumentadas em 20% a Você
- `9262` Dano com Espadas e Alcance Corpo a Corpo — **parcial**: pendente: +0.1 metros ao Alcance de Golpes Corpo a Corpo com Espadas
- `9933` Efeito de Marcas — **sem-efeito**
- `9995` Área de Efeito da Aura — **sem-efeito**
- `10073` Armadura e Recuperação da Recarga de Habilidades de Guarda — **parcial**: pendente: Habilidades de Guarda tem sua Velocidade de Recuperação da Recarga aumentada em 20%
- `10311` Efeito da Aura dos Estandartes — **sem-efeito**
- `10555` Duração do Vínculo — **sem-efeito**
- `10643` Proxy de Posicionamento — **nao-classificado**
- `10989` Dano e Ponto de Atordoamento com Habilidades de Retaliação — **sem-efeito**
- `10992` Área de Efeito de Feitiços — **sem-efeito**: pendente: Efeito em Área de Habilidades Feitiço aumentada em 15%
- `11128` Anulação de Interrupções durante a Conjuração e Resistências Elementais — **parcial**: pendente: 15% de chance de Ignorar Atordoamentos enquanto Conjurando
- `11200` Vida do Cadáver — **sem-efeito**
- `11456` Recuperação da Recarga de Habilidades de Postura — **sem-efeito**
- `11659` Anulação de Interrupções durante a Conjuração e Resistências Elementais — **parcial**: pendente: 15% de chance de Ignorar Atordoamentos enquanto Conjurando
- `11800` Mana ao Matar com Tinturas — **sem-efeito**
- `11850` Duração da Cegueira — **sem-efeito**: pendente: Duração da Cegueira aumentada em 40%
- `12032` Velocidade de Conjuração e Eficiência de Custo de Mana de Magias — **parcial**: pendente: Eficiência de custo de mana de magias aumentada em 10%
- `12215` Sangramento Agravado na Chance de Golpe Crítico — **sem-efeito**: pendente: 25% de chance de Agravar o Sangramento em alvos que você Golpear com um Crítico com Ataques
- `13201` Proxy de Posicionamento — **nao-classificado**
- `13965` Queima de Mana mais Lenta — **sem-efeito**
- `14384` Máximo de Fortificações — **sem-efeito**
- `14767` Duração de Fortificações — **sem-efeito**
- `15167` Vida e Efeito do Bônus de Golens — **parcial**: pendente: Vida Máxima dos Golens aumentada em 15%
- `15491` Dano das Habilidades de Retaliação — **sem-efeito**
- `15783` Efeito de Chão Consagrado — **sem-efeito**: pendente: Efeito de Solos Sagrados Criados por você aumentado em 20%
- `15973` Dano e Duração de Runas — **parcial**: pendente: Habilidades de Runa têm sua Duração aumentada em 10%
- `16245` Duração da Usabilidade das Habilidades de Retaliação — **sem-efeito**
- `17020` Dano de Ataque na Postura de Sangue — **sem-efeito**: pendente: Dano de Ataque aumentado em 20% enquanto na Postura do Sangue
- `17383` Mana e Área de Efeito de Aura — **parcial**
- `18208` Efeito de Chão Consagrado e Precisão — **parcial**: pendente: Efeito de Solos Sagrados Criados por você aumentado em 10%
- `18361` Proxy de Posicionamento — **nao-classificado**
- `18756` Proxy de Posicionamento — **nao-classificado**
- `19098` Danod e Raio com Varinhas — **sem-efeito**: pendente: Ganhe 5% do Dano Físico da Varinha como Dano Extra de Raio
- `19261` Recuperação da Recarga de Clamores — **sem-efeito**: pendente: Velocidade de Recarga do Clamor aumentada em 12%
- `19679` Alcance de Runas e Recuperação da Recarga de Runas — **sem-efeito**: pendente: Convocação de Runas tem sua Velocidade de Recuperação de Recarga aumentada em 10% · pendente: Alcance do Vínculo de Runas aumentado em 10%
- `19958` Velocidade de Conjuração dos Vínculos — **sem-efeito**
- `21019` Efeito de Tinturas — **sem-efeito**
- `21048` Duração do Vínculo — **sem-efeito**
- `21184` Prevenção de Interrupções enquanto Conjurando — **sem-efeito**: pendente: 15% de chance de Ignorar Atordoamentos enquanto Conjurando
- `21548` Duração dos Estandartes — **sem-efeito**
- `22046` Proxy de Posicionamento — **nao-classificado**
- `22472` Mana e Efeito de Fúria Arcana — **parcial**: pendente: Efeito da Fúria Arcana aumentado em 20% em você
- `22577` Recuperação do Bloqueio e Escudo de Energia — **parcial**
- `22845` Efeito de Tinturas — **sem-efeito**
- `22908` Valor Máximo dos Estandartes — **sem-efeito**: pendente: +10 ao máximo de Valor
- `23036` Recuperação da Recarga de Clamores e Área de Efeito — **sem-efeito**: pendente: Velocidade de Recarga do Clamor aumentada em 15% · pendente: Habilidades de Clamor têm Efeito em Área aumentado em 15%
- `23237` Área de Efeito das Auras — **sem-efeito**
- `24452` Proxy de Posicionamento — **nao-classificado**
- `24872` Vida e Efeito do Bônus de Golens — **parcial**: pendente: Vida Máxima dos Golens aumentada em 15%
- `25134` Proxy de Posicionamento — **nao-classificado**
- `25431` Eficiência de Custo de Mana de Maldições — **sem-efeito**: pendente: Eficiência de custo de mana de habilidades de maldição aumentada em 20%
- `25441` Proxy de Posicionamento — **nao-classificado**
- `25732` Velocidade de Ataque e Conjuração de Totens — **parcial**: pendente: Magias Conjuradas por Totens têm 4% de Velocidade de Conjuração aumentada
- `25770` Recuperação da Recarga de Armadilhas — **sem-efeito**: pendente: Velocidade de Recuperação da Recarga para lançar Armadilhas aumentada em 10%
- `25781` Máximo de Fortificações — **sem-efeito**
- `25959` Área de Efeito de Feitiços — **sem-efeito**: pendente: Efeito em Área de Habilidades Feitiço aumentada em 15%
- `26002` Velocidade de Conjuração de Marcas — **sem-efeito**: pendente: Habilidades Marca têm Velocidade de Conjuração aumentada em 10%
- `26661` Proxy de Posicionamento — **nao-classificado**
- `27325` Cargas de Frasco contra Inimigos Marcados — **sem-efeito**: pendente: Inimigo Marcado concede Cargas de Frasco aumentadas em 20% a Você
- `27475` Proxy de Posicionamento — **nao-classificado**
- `27605` Ganho de Fortificações — **sem-efeito**
- `27819` Proxy de Posicionamento — **nao-classificado**
- `28018` Proxy de Posicionamento — **nao-classificado**
- `28650` Proxy de Posicionamento — **nao-classificado**
- `30038` Duração dos Estandartes — **sem-efeito**
- `30275` Proxy de Posicionamento — **nao-classificado**
- `30370` Dano de Magia Degenerativo — **sem-efeito**: pendente: Mais 12% de dano degenerativo com habilidades mágicas
- `30826` Queima de Mana mais Lenta — **sem-efeito**
- `31103` Vida e Redução de Dano Físico de Lacaios — **parcial**: pendente: Lacaios tem 8% de Redução de Dano Físico adicional
- `31371` Área de Efeito de Minas — **sem-efeito**: pendente: Habilidades usadas por Minas têm Efeito em Área aumentado em 10%
- `31438` Mana ao Matar com Tinturas — **sem-efeito**
- `31520` Velocidade de Ataque e Conjuração de Totens — **parcial**: pendente: Magias Conjuradas por Totens têm 5% de Velocidade de Conjuração aumentada
- `32376` Dano das Habilidades de Retaliação — **sem-efeito**
- `33374` Chance de uma Difusão Extra de Projéteis — **sem-efeito**: pendente: Projéteis têm 25% de chance de receber um Projétil adicional quando Difundindo
- `33566` Ganho de Valor com Estandartes — **sem-efeito**
- `33833` Proxy de Posicionamento — **nao-classificado**
- `33911` Duração das Minas — **sem-efeito**: pendente: Duração da Mina aumentada em 30%
- `34013` Proxy de Posicionamento — **nao-classificado**
- `34306` Bloqueio Mágico de Lacaios — **sem-efeito**: pendente: Lacaios tem +12% de Chance de Bloquear o Dano Mágico
- `34660` Efeito de Marcas — **sem-efeito**
- `35035` Recuperação da Recarga do Convocar Runas — **sem-efeito**: pendente: Convocação de Runas tem sua Velocidade de Recuperação de Recarga aumentada em 15%
- `35070` Proxy de Posicionamento — **nao-classificado**
- `35237` Valor Máximo dos Estandartes — **sem-efeito**: pendente: +10 ao máximo de Valor
- `35313` Proxy de Posicionamento — **nao-classificado**
- `35406` Duração e Valor Máximo dos Estandartes — **sem-efeito**: pendente: +5 ao máximo de Valor
- `35791` Multiplicador de Golpe Crítico de Lacaios — **sem-efeito**: pendente: Lacaios têm +20% de Multiplicador de Acerto Crítico
- `35853` Proxy de Posicionamento — **nao-classificado**
- `35926` Proxy de Posicionamento — **nao-classificado**
- `36200` Velocidade de Clamores e Dano de Ataques Impelidos — **parcial**
- `36371` Vida do Cadáver — **sem-efeito**
- `36414` Proxy de Posicionamento — **nao-classificado**
- `37147` Proxy de Posicionamento — **nao-classificado**
- `37898` Proxy de Posicionamento — **nao-classificado**
- `38462` Velocidade das Habilidades de Retaliação — **sem-efeito**
- `38947` Distância do Ricochete — **sem-efeito**: pendente: Alcance do Ricochete aumentado em 15%
- `39814` Recuperação da Recarga de Armadilhas — **sem-efeito**: pendente: Velocidade de Recuperação da Recarga para lançar Armadilhas aumentada em 10%
- `40114` Proxy de Posicionamento — **nao-classificado**
- `40229` Recuperação da Recarga de Clamores e Área de Efeito — **sem-efeito**: pendente: Velocidade de Recarga do Clamor aumentada em 15% · pendente: Habilidades de Clamor têm Efeito em Área aumentado em 15%
- `40409` Velocidade de Detonação de Minas — **sem-efeito**: pendente: Minas tem Velocidade de Detonação aumentada em 20%
- `40751` Área de Efeito de Minas — **sem-efeito**: pendente: Habilidades usadas por Minas têm Efeito em Área aumentado em 10%
- `41026` Mana e Recuperação da Recarga de Habilidades de Guarda — **parcial**: pendente: Habilidades de Guarda tem sua Velocidade de Recuperação da Recarga aumentada em 20%
- `42106` Dano e Ponto de Atordoamento com Habilidades de Retaliação — **sem-efeito**
- `42495` Recuperação da Recarga das Habilidades de Retaliação — **sem-efeito**
- `43413` Bloqueio com Escudo e Recuperação de Bloqueio — **parcial**
- `43833` Recuperação da Recarga de Clamores — **sem-efeito**: pendente: Velocidade de Recarga do Clamor aumentada em 15%
- `43989` Proxy de Posicionamento — **nao-classificado**
- `44268` Área de Efeito das Habilidades de Retaliação — **sem-efeito**
- `44362` Dano de Caos e Expiração do Definhamento — **parcial**: pendente: Definhamentos infligidos por você expiram 10% mais lentamente
- `44470` Proxy de Posicionamento — **nao-classificado**
- `45163` Dano das Habilidades de Retaliação — **sem-efeito**
- `45246` Queima de Mana mais Lenta — **sem-efeito**
- `45503` Efeito da Aura dos Estandartes — **sem-efeito**
- `46585` Área de Efeito dos Estandartes — **sem-efeito**
- `47504` Velocidade de Conjuração e Eficiência de Custo de Mana de Magias — **parcial**: pendente: Eficiência de custo de mana de magias aumentada em 10%
- `47785` Ganho de Valor com Estandartes — **sem-efeito**
- `47902` Dano das Habilidades de Retaliação — **sem-efeito**
- `48128` Proxy de Posicionamento — **nao-classificado**
- `48132` Proxy de Posicionamento — **nao-classificado**
- `48275` Prevenção de Interrupções enquanto Conjurando — **sem-efeito**: pendente: 15% de chance de Ignorar Atordoamentos enquanto Conjurando
- `48284` Blqueio e Recuperação do Bloqueio — **parcial**
- `48713` Chance de Golpe Crítico de Lacaios — **sem-efeito**: pendente: Lacaios têm Chance de Acerto Crítico aumentada em 20%
- `49147` Armadura e Recuperação da Recarga de Habilidades de Guarda — **parcial**: pendente: Habilidades de Guarda tem sua Velocidade de Recuperação da Recarga aumentada em 20%
- `49407` Recuperação da Recarga das Habilidades de Retaliação — **sem-efeito**
- `49635` Ganho de Valor com Estandartes — **sem-efeito**
- `49951` Proxy de Posicionamento — **nao-classificado**
- `50179` Proxy de Posicionamento — **nao-classificado**
- `50515` Fortificação em Atordoamentos Corpo a Corpo — **sem-efeito**
- `50734` Queima de Mana mais Lenta — **sem-efeito**
- `51233` Proxy de Posicionamento — **nao-classificado**
- `51804` Dano de Magia Degenerativo — **sem-efeito**: pendente: Mais 16% de dano degenerativo com habilidades mágicas
- `51953` Ângulo Bifurcado — **sem-efeito**: pendente: Ângulo da Difusão de Projéteis aumentado em 50%
- `52655` Duração de Runas — **sem-efeito**: pendente: Habilidades de Runa têm sua Duração aumentada em 12%
- `53018` Dano e Duração de Runas — **parcial**: pendente: Habilidades de Runa têm sua Duração aumentada em 10%
- `53203` Proxy de Posicionamento — **nao-classificado**
- `53574` Velocidade de Conjuração de Marcas e Eficiência de Custo de Mana — **sem-efeito**: pendente: Habilidades Marca têm Velocidade de Conjuração aumentada em 5% · pendente: Eficiência de custo de mana de habilidades de marca aumentada em 10%
- `53882` Efeito de Tinturas e Frascos — **parcial**
- `54600` Proxy de Posicionamento — **nao-classificado**
- `54862` Duração da Usabilidade das Habilidades de Retaliação — **sem-efeito**
- `54880` Área de Efeito dos Estandartes — **sem-efeito**
- `55021` Recuperação da Recarga de Habilidades de Postura — **sem-efeito**
- `55706` Proxy de Posicionamento — **nao-classificado**
- `55880` Dano contra Inimigos Marcados — **sem-efeito**: pendente: Dano com Acertos e Afecções contra Inimigos Marcados aumentado em 20%
- `56370` Fortificação em Atordoamentos Corpo a Corpo — **sem-efeito**
- `56439` Proxy de Posicionamento — **nao-classificado**
- `56671` Dano de Caos e Expiração do Definhamento — **parcial**: pendente: Definhamentos infligidos por você expiram 10% mais lentamente
- `56920` Recuperação da Recarga das Habilidades de Retaliação — **sem-efeito**
- `57167` Mana e Efeito da Fúria Arcana — **parcial**: pendente: Efeito da Fúria Arcana aumentado em 20% em você
- `57194` Proxy de Posicionamento — **nao-classificado**
- `57404` Efeito dos Vínculos — **sem-efeito**
- `57565` Eficiência de Custo de Mana de Conexão — **sem-efeito**: pendente: Eficiência de custo de mana de habilidades de conexão aumentada em 20%
- `57651` Sangramento Agravado na Chance de Golpe Crítico — **sem-efeito**: pendente: 25% de chance de Agravar o Sangramento em alvos que você Golpear com um Crítico com Ataques
- `58194` Proxy de Posicionamento — **nao-classificado**
- `58336` Ganho de Valor com Estandartes — **sem-efeito**
- `58355` Proxy de Posicionamento — **nao-classificado**
- `58545` Mana e Área de Efeito de Aura — **parcial**
- `59070` Alcance de Runas e Recuperação da Recarga de Runas — **sem-efeito**: pendente: Convocação de Runas tem sua Velocidade de Recuperação de Recarga aumentada em 10% · pendente: Alcance do Vínculo de Runas aumentado em 10%
- `60145` Efeito dos Vínculos — **sem-efeito**
- `60963` Ganho de Valor com Estandartes — **sem-efeito**
- `60989` Efeito de Buff de Arautos — **sem-efeito**: pendente: Efeito dos Buffs de Arauto em você aumentado em 10%
- `61573` Efeito de Tinturas — **sem-efeito**
- `62109` Recuperação da Recarga das Habilidades de Retaliação — **sem-efeito**
- `62480` Eficiência de Custo de Mana de Maldições — **sem-efeito**: pendente: Eficiência de custo de mana de habilidades de maldição aumentada em 20%
- `62530` Duração de Fortificações — **sem-efeito**
- `62721` Efeito das Tinturas — **sem-efeito**
- `62879` Dano com Habilidades de Retaliação e Bloqueio com Escudos — **parcial**
- `63027` Dano de Ataques Impelidos — **sem-efeito**
- `63039` Efeito de Buff de Arautos — **sem-efeito**: pendente: Efeito dos Buffs de Arauto em você aumentado em 10%
- `63306` Dano com Habilidades de Retaliação — **sem-efeito**
- `63754` Proxy de Posicionamento — **nao-classificado**
- `64166` Proxy de Posicionamento — **nao-classificado**
- `64181` Área de Efeito de Clamores — **sem-efeito**: pendente: Habilidades de Clamor têm Efeito em Área aumentado em 20%
- `64238` Área de Efeito das Habilidades de Retaliação — **sem-efeito**
- `64257` Velocidade das Habilidades de Retaliação — **sem-efeito**
- `64265` Área de Efeito da Aura — **sem-efeito**
- `64284` Recuperação da Recarga de Habilidades de Postura — **sem-efeito**
- `64612` Danod e Raio com Varinhas — **sem-efeito**: pendente: Ganhe 5% do Dano Físico da Varinha como Dano Extra de Raio
- `64888` Efeito das Tinturas — **sem-efeito**
- `65112` Máximo de Fortificações — **sem-efeito**
- `65159` Velocidade de Ataque e Conjuração de Totens — **parcial**: pendente: Magias Conjuradas por Totens têm 5% de Velocidade de Conjuração aumentada
- `65400` Recuperação da Recarga de Clamores e Dano de Ataques Impelidos — **sem-efeito**: pendente: Velocidade de Recarga do Clamor aumentada em 12%
- `65456` Distância do Empurrão — **sem-efeito**: pendente: Distância do Empurrão aumentada em 25%

### encaixe-de-joia (57)

- `2311` Encaixe de Joia Pequena — **nao-classificado**
- `2491` Encaixe de Joia Grande — **nao-classificado**
- `3109` Encaixe de Joia Pequena — **nao-classificado**
- `6230` Encaixe de Joia Básico — **nao-classificado**
- `6910` Encaixe de Joia Média — **nao-classificado**
- `7960` Encaixe de Joia Grande — **nao-classificado**
- `9408` Encaixe de Joia Média — **nao-classificado**
- `9797` Encaixe de Joia Pequena — **nao-classificado**
- `10532` Encaixe de Joia Média — **nao-classificado**
- `11150` Encaixe de Joia Pequena — **nao-classificado**
- `12161` Encaixe de Joia Pequena — **nao-classificado**
- `12613` Encaixe de Joia Pequena — **nao-classificado**
- `13170` Encaixe de Joia Média — **nao-classificado**
- `14993` Encaixe de Joia Pequena — **nao-classificado**
- `16218` Encaixe de Joia Pequena — **nao-classificado**
- `17219` Encaixe de Joia Média — **nao-classificado**
- `18436` Encaixe de Joia Pequena — **nao-classificado**
- `21984` Encaixe de Joia Grande — **nao-classificado**
- `22748` Encaixe de Joia Pequena — **nao-classificado**
- `22994` Encaixe de Joia Média — **nao-classificado**
- `23756` Encaixe de Joia Média — **nao-classificado**
- `23984` Encaixe de Joia Pequena — **nao-classificado**
- `24970` Encaixe de Joia Pequena — **nao-classificado**
- `26196` Encaixe de Joia Básico — **nao-classificado**
- `26725` Encaixe de Joia Básico — **nao-classificado**
- `28475` Encaixe de Joia Básico — **nao-classificado**
- `29712` Encaixe de Joia Média — **nao-classificado**
- `31683` Encaixe de Joia Básico — **nao-classificado**
- `32763` Encaixe de Joia Grande — **nao-classificado**
- `33631` Encaixe de Joia Básico — **nao-classificado**
- `33753` Encaixe de Joia Média — **nao-classificado**
- `33989` Encaixe de Joia Básico — **nao-classificado**
- `34483` Encaixe de Joia Básico — **nao-classificado**
- `36634` Encaixe de Joia Básico — **nao-classificado**
- `36931` Encaixe de Joia Pequena — **nao-classificado**
- `40400` Encaixe de Joia Média — **nao-classificado**
- `41263` Encaixe de Joia Básico — **nao-classificado**
- `41876` Encaixe de Joia Pequena — **nao-classificado**
- `44169` Encaixe de Joia Média — **nao-classificado**
- `46393` Encaixe de Joia Média — **nao-classificado**
- `46519` Encaixe de Joia Média — **nao-classificado**
- `46882` Encaixe de Joia Grande — **nao-classificado**
- `48679` Encaixe de Joia Média — **nao-classificado**
- `48768` Encaixe de Joia Básico — **nao-classificado**
- `49080` Encaixe de Joia Média — **nao-classificado**
- `49684` Encaixe de Joia Média — **nao-classificado**
- `51198` Encaixe de Joia Pequena — **nao-classificado**
- `54127` Encaixe de Joia Básico — **nao-classificado**
- `55190` Encaixe de Joia Grande — **nao-classificado**
- `59585` Encaixe de Joia Pequena — **nao-classificado**
- `60735` Encaixe de Joia Básico — **nao-classificado**
- `61288` Encaixe de Joia Média — **nao-classificado**
- `61305` Encaixe de Joia Pequena — **nao-classificado**
- `61419` Encaixe de Joia Básico — **nao-classificado**
- `61666` Encaixe de Joia Pequena — **nao-classificado**
- `61834` Encaixe de Joia Básico — **nao-classificado**
- `64583` Encaixe de Joia Média — **nao-classificado**

### keystone (22)

- `11239` Dançarino do Vento — **sem-efeito**: pendente: 20 menos dano de Ataque sofrido se você não foi Acertado por um Ataque Recentemente · pendente: 10% mais chance de Evadir Ataques se você foi Acertado por um Ataque Recentemente · pendente: 20% mais Dano de Ataque sofrido se você foi Acertado por um Ataque Recentemente
- `11455` Inoculação do Caos — **sem-efeito**: pendente: Vida Máxima torna-se 1, Imune a Dano de Caos
- `12128` Geada Cortante — **sem-efeito**: pendente: Inimigos esfriados pelos seus ataques sofrem dano de frio aumentado pelo esfriamento · pendente: Inimigos nas suas áreas frias sofrem dano de frio aumentado pelo esfriamento · pendente: Não pode causar dano que não seja de frio
- `13019` Lâmina Ensanguentada — **sem-efeito**
- `17818` Dança Carmesim — **parcial**
- `18663` Instabilidade do Lacaio — **sem-efeito**: pendente: Lacaios explodem quando reduzidos à Vida Baixa, causando 33% de suas vidas máximas como Dano de Fogo em inimigos próximos
- `19732` O Agnóstico — **sem-efeito**: pendente: Remove todo Escudo Mágico · pendente: Enquanto não estiver em Vida Cheia, Sacrifica 20% da Mana por Segundo para Recuperar a mesma quantidade de Vida
- `21210` Arsenal da Vingança — **sem-efeito**
- `23090` Mobilização — **sem-efeito**: pendente: Seus Clamores não concedem Buffs ou Cargas a Você 100% mais Duração dos Clamores
- `24720` Guarda Desequilibrada — **sem-efeito**: pendente: 100% de chance de Defender com 200% de Armadura · pendente: Redução de Dano Máxima para qualquer Tipo de Dano é 50%
- `35255` Dança Fantasma — **sem-efeito**: pendente: Não pode Recuperar Escudo de Energia acima da Evasão · pendente: A cada 2 segundos, ganhe uma Mortalha Fantasma, máximo de 3 · pendente: Quando Acertado, perca uma Mortalha Fantasma para Recuperar Escudo de Energia igual a 3% da sua Evasão
- `40351` Tempestade Turbulenta — **sem-efeito**: pendente: ㅤ+25% de dano elétrico máximo · pendente: -50% de dano elétrico mínimo · pendente: Não pode causar dano que não seja elétrico
- `41970` Vínculo Ancestral — **parcial**: pendente: Você não pode causar Dano com Habilidades por si só
- `42178` Queima-Roupa — **sem-efeito**: pendente: Acertos dos Ataques de Projéteis causam até 30% mais Dano aos alvos no inicio de seu movimento, causando menos Dano aos alvos na medida em que o projétil viaja adiante
- `42343` Mesclador de Runas — **parcial**
- `45175` Égide Necromântica — **sem-efeito**: pendente: Todos os bônus do Escudo equipado se aplicam aos seus Lacaios e não a você
- `49639` Ego Supremo — **sem-efeito**
- `50679` Combatente Versátil — **sem-efeito**: pendente: -10% ao máximo de Chance de Bloqueio do Dano de Ataques · pendente: -10% ao máximo de Chance de Bloqueio do Dano Mágico · pendente: +2% de Chance de Bloqueio Mágico para cada 1% de Chance de Bloqueio do Dano de Ataques Excedente
- `54307` Acrobacia — **sem-efeito**: pendente: Modificadores de Chance de Suprimir Dano Mágico se aplicam à Chance de Esquivar dos Acertos Mágicos em 50% de seu valor, ao invés · pendente: Chance Máxima de Esquiva Mágica é 75%
- `54922` Dança da Flecha — **sem-efeito**: pendente: Evasão é Dobrada contra Ataques de Projéteis · pendente: 25% menos Evasão contra Ataques Corpo a Corpo
- `58556` Escudo Divino — **sem-efeito**: pendente: Não pode Recuperar Escudo de Energia acima da Armadura · pendente: 3% do Dano Físico negado de Acertos Recentes é Regenerado como Escudo de Energia por segundo
- `63903` Chama Voraz — **sem-efeito**: pendente: Você pode infligir um incêndio adicional em cada inimigo · pendente: A duração base do incêndio é de 1 segundo · pendente: -25% de dano de incêndio · pendente: Não pode causar dano que não seja de fogo

### maestria (270)

- `89` Maestria de Minas — **sem-efeito**: pendente: Cada Mina aplica Dano sofrido aumentado em 2% aos Inimigos próximos a ela, até 10% · pendente: Cada Mina aplica Dano sofrido reduzido em 2% aos Inimigos próximos a ela, até 10% · pendente: Efeito de Auras das Minas aumentado em 30% · pendente: Detonar Minas é Ativado enquanto você se mover · pendente: Minas não podem ser Danificadas · pendente: Regenera 2.5% de Vida por Segundo se você Detonou uma Mina Recentemente
- `240` Maestria de Raio — **parcial**: pendente: Chance de Golpe Crítico contra inimigos com Exposição a Raio aumentada em 60% · pendente: Dano de Raio dos Inimigos Acertando você enquanto você estiver Eletrizado é Azarado
- `857` Maestria de Escudo de Energia — **parcial**: pendente: 50% do seu Escudo de Energia é adicionado ao seu Ponto de Atordoamento · pendente: 30% do dano de caos sofrido não ignora o escudo de energia
- `1205` Maestria de Envenenamentos — **parcial**: pendente: Portador da Praga têm Valor Máximo da Praga aumentado em 20%
- `1215` Maestria de Evasão e Escudo de Energia — **parcial**: pendente: Recuperação do Escudo de Energia aumentada em 20% se você não foi Acertado Recentemente · pendente: Evasão aumentada em 100% se a Recarga do Escudo de Energia iniciou nos últimos 2 segundos · pendente: A cada 4 segundos, Regenere Escudo de Energia igual a 1% da Evasão durante 1 segundo
- `2828` Maestria de Dano Degenerativo — **parcial**: pendente: Efeito da Crueldade aumentado em 30%
- `3471` Maestria de Escudo de Energia — **parcial**: pendente: 50% do seu Escudo de Energia é adicionado ao seu Ponto de Atordoamento · pendente: 30% do dano de caos sofrido não ignora o escudo de energia
- `3883` Maestria de Evasão — **parcial**
- `4327` Maestria de Retaliação — **sem-efeito**
- `4424` Maestria de Machados — **parcial**: pendente: Inimigos Mortos pelos seus Acertos são destruídos
- `4492` Maestria de Atributos — **parcial**: pendente: +5 de Força por Habilidade Passiva de Maestria Alocada · pendente: +5 de Inteligência por Habilidade Passiva de Maestria Alocada · pendente: +5 de Destreza por Habilidade Passiva de Maestria Alocada
- `4707` Maestria de Cargas — **parcial**: pendente: Monstros Inimigos não podem ganhar Cargas de Poder, Frenesi ou Tolerância
- `4788` Maestria de Garras — **parcial**: pendente: Ganha 25 de Vida por Inimigo Acertado com Ataques de Garras na Mão Principal · pendente: Ganha 25 de Mana por Inimigo Acertado com Ataques de Garras na Mão Secundária · pendente: Bônus Inerente de Velocidade de Ataque da Empunhadura Dupla é dobrado enquanto portando Garras · pendente: Furtividade aumentada em 50% caso você tenha Acertado com uma Garra Recentemente · pendente: Habilidades Suportadas por Lâmina Noturna têm Efeito do Elusivo aumentado em 40%
- `5230` Maestria de Cajados — **parcial**: pendente: Vida e mana máximos aumentados em 12%, se o seu cajado equipado tiver um encaixe azul e vermelho
- `5348` Maestria Elementar — **sem-efeito**: pendente: Exposições infligidas por você aplicam ao menos -18% à Resistência afetada · pendente: Evita +60% do dano elemental refletido · pendente: Efeito de Exposições em você reduzido em 50% · pendente: Acertos têm 15% de chance de tratarem os valores da Resistência Elemental dos Monstros Inimigos como invertidos · pendente: 3% de chance de Acertos causarem 300% do Dano Físico como Dano Extra de um Elemento aleatório
- `5368` Maestria de Bloqueio — **parcial**: pendente: +2% à Chance máxima de Bloquear o Dano de Ataques · pendente: +2% à Chance máxima de Bloquear Dano Mágico
- `5726` Maestria Elementar — **sem-efeito**: pendente: Exposições infligidas por você aplicam ao menos -18% à Resistência afetada · pendente: Evita +60% do dano elemental refletido · pendente: Efeito de Exposições em você reduzido em 50% · pendente: Acertos têm 15% de chance de tratarem os valores da Resistência Elemental dos Monstros Inimigos como invertidos · pendente: 3% de chance de Acertos causarem 300% do Dano Físico como Dano Extra de um Elemento aleatório
- `5826` Maestria de Projéteis — **parcial**: pendente: Projéteis causam Dano aumentado em 20% com Acertos e Afecções para cada Inimigo Atravessado · pendente: Projéteis causam Dano aumentado em 20% com Acertos e Afecções para cada vez que Ricochetearam · pendente: Empurra Inimigos se você tiver um Golpe Crítico com Dano de Projéteis · pendente: 15% mais Velocidade de Projéteis · pendente: 15% menos Velocidade de Projéteis
- `6338` Maestria de Escudo de Energia — **parcial**: pendente: 50% do seu Escudo de Energia é adicionado ao seu Ponto de Atordoamento · pendente: 30% do dano de caos sofrido não ignora o escudo de energia
- `6384` Maestria de Dreno — **parcial**
- `6427` Maestria de Arcos — **parcial**: pendente: Flecha Ilusória e Flecha Espelhada têm Recuperação da Recarga aumentada em 100% · pendente: Flechas ganham Chance de Golpe Crítico enquanto viajam adiante, máximo de até 100% de Chance de Golpe Crítico · pendente: Duração do Arqueiro Ilusório aumentada em 100% · pendente: Bônus recebidos da Aljava Equipada aumentado em 20% · pendente: Aumentos e Reduções à Velocidade de Projéteis também se aplicam ao Dano com Arcos
- `6507` Maestria de Reserva — **parcial**
- `6588` Maestria de Atordoamentos — **parcial**: pendente: Acertos contra voê Não podem ser Golpes Críticos se você foi Atordoado Recentemente · pendente: 25% de chance de causar um Acerto Atordoador aos Monstros Inimigos Próximos quando você for Atordoado · pendente: Ganha Adrenalina quando Atordoado, por 2 segundos por cada 100ms de Duração do Atordoamento
- `6912` Maestria de Duas Mãos — **parcial**: pendente: Armadura e evasão aumentadas em 30%, se a arma da sua mão principal tiver um encaixe verde e vermelho · pendente: 15% mais Duração de Atordoamentos com Armas de Duas Mãos · pendente: Acertos Impiedosos Intimidam Inimigos por 4 segundos
- `6968` Maestria de Cajados — **parcial**: pendente: Vida e mana máximos aumentados em 12%, se o seu cajado equipado tiver um encaixe azul e vermelho
- `7023` Maestria de Gelo — **parcial**: pendente: +1 ao multiplicador de dano de gelo degenerativo por 4% de resistência a dano de gelo excedente
- `7488` Maestria de Dreno — **parcial**
- `7528` Maestria de Fúria — **parcial**: pendente: Cada Fúria também concede Ponto de Atordoamento aumentado em 1% · pendente: Perda Inerente de Fúria é 20% mais rápida · pendente: Clamores concedem 1 de Fúria por cada 5 de Poder Inimigo, até 5 · pendente: Inimigos Próximos são Intimidados enquanto você tiver Fúria
- `7634` Maestria de Adagas — **parcial**: pendente: Acertos Críticos possuem Golpe de Misericórdia · pendente: Elusivo concede +40% de Multiplicador de Golpes Críticos às Habilidades Suportadas por Lâmina Noturna · mais_dano@alvoVenenos:5: condição desconhecida: alvoVenenos:5
- `8370` Maestria de Atributos — **parcial**: pendente: +5 de Força por Habilidade Passiva de Maestria Alocada · pendente: +5 de Inteligência por Habilidade Passiva de Maestria Alocada · pendente: +5 de Destreza por Habilidade Passiva de Maestria Alocada
- `8460` Maestria de Clamores — **parcial**: pendente: Clamores têm um mínimo de 10 de Poder
- `8556` Maestria de Ataque — **parcial**
- `8629` Maestria de Ataque — **parcial**
- `8872` Maestria de Dupla Empunhadura — **parcial**: pendente: Dupla Empunhadura não concede chance de Bloquear o Dano de Ataques de forma inerente · pendente: +1% de Chance de Golpe Crítico da Mão Secundária enquanto em Dupla Empunhadura · pendente: 20% de chance de ganhar Elusivo ao Bloquear enquanto em Empunhadura Dupla · pendente: 20% de chance de Mutilar Inimigos com Acertos da Mão Principal · pendente: 20% de chance de Cegar Inimigos com Acertos da Mão Secundária
- `9083` Maestria Defensiva de Lacaios — **parcial**: pendente: Lacaios tem +8% de máximo de todas as Resistências Elementais · pendente: Convocação tem Recuperação da Recarga aumentada em 40% · pendente: Lacaios têm Recuperação de Vida reduzida em 15% · pendente: Lacaios Recuperam 5% de Vida na Morde de Lacaios
- `9213` Maestria de Vínculos — **sem-efeito**: pendente: Vínculos demoram duas vezes mais para quebrar
- `9393` Maestria de Frascos — **parcial**: pendente: Inimigos que você Matar sob efeito de Afecções Elementais concedem 100% de Cargas de Frascos aumentadas
- `9458` Maestria de Frascos — **parcial**: pendente: Inimigos que você Matar sob efeito de Afecções Elementais concedem 100% de Cargas de Frascos aumentadas
- `9471` Maestria de Fúria — **parcial**: pendente: Cada Fúria também concede Ponto de Atordoamento aumentado em 1% · pendente: Perda Inerente de Fúria é 20% mais rápida · pendente: Clamores concedem 1 de Fúria por cada 5 de Poder Inimigo, até 5 · pendente: Inimigos Próximos são Intimidados enquanto você tiver Fúria
- `9586` Maestria de Críticos — **parcial**: pendente: Atordoamentos dos Golpes Criticos têm Duração aumentada em 100%
- `10141` Maestria de Recuperação — **parcial**: pendente: Efeitos de Recuperação de Vida ocorrem durante 3 segundos ao invés · pendente: Inimigos Próximos têm Regeneração de Vida reduzida em 50% · pendente: A cada 4 segundos,Recupere 1 de vida por cada 0.1 Vida Recuperada por segundo da Regeneração
- `10166` Maestria de Minas — **sem-efeito**: pendente: Cada Mina aplica Dano sofrido aumentado em 2% aos Inimigos próximos a ela, até 10% · pendente: Cada Mina aplica Dano sofrido reduzido em 2% aos Inimigos próximos a ela, até 10% · pendente: Efeito de Auras das Minas aumentado em 30% · pendente: Detonar Minas é Ativado enquanto você se mover · pendente: Minas não podem ser Danificadas · pendente: Regenera 2.5% de Vida por Segundo se você Detonou uma Mina Recentemente
- `10204` Maestria de Espadas — **parcial**: pendente: +0.3 metros ao Alcance de Golpes Corpo a Corpo com Espadas · pendente: Precisão da Mão Secundária é igual a da Mão Primária enquanto portando uma Espada · pendente: Chance de Inimigos Bloquearem Ataques com Espada reduzida em 50%
- `10245` Maestria de Ataque — **parcial**
- `10414` Maestria de Recuperação — **parcial**: pendente: Efeitos de Recuperação de Vida ocorrem durante 3 segundos ao invés · pendente: Inimigos Próximos têm Regeneração de Vida reduzida em 50% · pendente: A cada 4 segundos,Recupere 1 de vida por cada 0.1 Vida Recuperada por segundo da Regeneração
- `10429` Maestria de Armadilhas — **parcial**: pendente: 5% de chance de arremessar até 4 Armadilhas adicionais · pendente: 8% de Chance das Armadilhas Ativarem uma vez adicional · pendente: Pode ter até 5 Armadilhas adicionais plantadas por vez · pendente: Recupere 30 da Vida quando sua Armadilha for ativada por um Inimigo · pendente: Armadilhas não podem ser Danificadas
- `10729` Maestria de Escudo de Energia — **parcial**: pendente: 50% do seu Escudo de Energia é adicionado ao seu Ponto de Atordoamento · pendente: 30% do dano de caos sofrido não ignora o escudo de energia
- `11032` Maestria de Evasão e Escudo de Energia — **parcial**: pendente: Recuperação do Escudo de Energia aumentada em 20% se você não foi Acertado Recentemente · pendente: Evasão aumentada em 100% se a Recarga do Escudo de Energia iniciou nos últimos 2 segundos · pendente: A cada 4 segundos, Regenere Escudo de Energia igual a 1% da Evasão durante 1 segundo
- `11596` Maestria de Maça — **parcial**: pendente: Esmaga Inimigos ao acertar com Maças e Cetros · pendente: 12% de chance de causar Dano Dobrado com Ataques se o Tempo de Ataque for maior que 1 segundo · pendente: Acertos que Atordoarem os Inimigos possuem Golpe de Misericórdia
- `12169` Maestria Física — **parcial**: pendente: Evita +60% do dano físico refletido · pendente: 10% mais Dano Físico Máximo de Ataques · pendente: Não pode ser Atordoado por Acertos que causem apenas Dano Físico · pendente: Dano Físico com Habilidades que Custam Vida aumentado em 40%
- `12239` Maestria Física — **parcial**: pendente: Evita +60% do dano físico refletido · pendente: 10% mais Dano Físico Máximo de Ataques · pendente: Não pode ser Atordoado por Acertos que causem apenas Dano Físico · pendente: Dano Físico com Habilidades que Custam Vida aumentado em 40%
- `12244` Maestria de Vínculos — **sem-efeito**: pendente: Vínculos demoram duas vezes mais para quebrar
- `12503` Maestria de Proteção — **parcial**: pendente: Evita +50% do dano refletido · pendente: Não pode ser afetado por Sangue Corrompido
- `12518` Maestria de Garras — **parcial**: pendente: Ganha 25 de Vida por Inimigo Acertado com Ataques de Garras na Mão Principal · pendente: Ganha 25 de Mana por Inimigo Acertado com Ataques de Garras na Mão Secundária · pendente: Bônus Inerente de Velocidade de Ataque da Empunhadura Dupla é dobrado enquanto portando Garras · pendente: Furtividade aumentada em 50% caso você tenha Acertado com uma Garra Recentemente · pendente: Habilidades Suportadas por Lâmina Noturna têm Efeito do Elusivo aumentado em 40%
- `12873` Maestria de Proteção — **parcial**: pendente: Evita +50% do dano refletido · pendente: Não pode ser afetado por Sangue Corrompido
- `13387` Maestria Elementar — **sem-efeito**: pendente: Exposições infligidas por você aplicam ao menos -18% à Resistência afetada · pendente: Evita +60% do dano elemental refletido · pendente: Efeito de Exposições em você reduzido em 50% · pendente: Acertos têm 15% de chance de tratarem os valores da Resistência Elemental dos Monstros Inimigos como invertidos · pendente: 3% de chance de Acertos causarem 300% do Dano Físico como Dano Extra de um Elemento aleatório
- `13712` Domínio de Reserva — **parcial**
- `14113` Maestria de Conjuração — **sem-efeito**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40% · pendente: Velocidade de Conjuração aumentada em 6% por cada Magia Não Instantânea que você tenha Conjurado Recentemente · pendente: Magias que podem ganhar Intensidade têm +1 de Intensidade máxima · pendente: Habilidades suportadas por Liberar tem +1 ao número máximo de Selos · pendente: 25% de chance de abrir Baús próximos quando você Conjurar uma Magia
- `14122` Maestria de Raio — **parcial**: pendente: Chance de Golpe Crítico contra inimigos com Exposição a Raio aumentada em 60% · pendente: Dano de Raio dos Inimigos Acertando você enquanto você estiver Eletrizado é Azarado
- `14505` Maestria Ofensiva de Lacaios — **parcial**: pendente: Acertos dos Lacaios têm 50% de chance de ignorar a Redução de Dano Físico Inimiga · pendente: Lacaios Penetram 8% das Resistências Elementais dos Inimigos Amaldiçoados · pendente: Lacaios tem 25% de chance de ganhar Poder Profano por 4 segundos ao Matar · pendente: Lacaios têm Efeito em Área aumentado em 30% · pendente: Lacaios têm Recuperação da Recarga aumentada em 20%
- `14832` Maestria de Maça — **parcial**: pendente: Esmaga Inimigos ao acertar com Maças e Cetros · pendente: 12% de chance de causar Dano Dobrado com Ataques se o Tempo de Ataque for maior que 1 segundo · pendente: Acertos que Atordoarem os Inimigos possuem Golpe de Misericórdia
- `15409` Maestria de Adagas — **parcial**: pendente: Acertos Críticos possuem Golpe de Misericórdia · pendente: Elusivo concede +40% de Multiplicador de Golpes Críticos às Habilidades Suportadas por Lâmina Noturna · mais_dano@alvoVenenos:5: condição desconhecida: alvoVenenos:5
- `15697` Maestria de Tinturas — **sem-efeito**: pendente: As primeiras 6 Queimas de Mana aplicadas em você não tem efeito
- `16123` Maestria de Críticos — **parcial**: pendente: Atordoamentos dos Golpes Criticos têm Duração aumentada em 100%
- `16141` Maestria de Dreno — **parcial**
- `17127` Maestria de Proteção — **parcial**: pendente: Evita +50% do dano refletido · pendente: Não pode ser afetado por Sangue Corrompido
- `17380` Maestria de Gelo — **parcial**: pendente: +1 ao multiplicador de dano de gelo degenerativo por 4% de resistência a dano de gelo excedente
- `17411` Maestria de Conjuração — **sem-efeito**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40% · pendente: Velocidade de Conjuração aumentada em 6% por cada Magia Não Instantânea que você tenha Conjurado Recentemente · pendente: Magias que podem ganhar Intensidade têm +1 de Intensidade máxima · pendente: Habilidades suportadas por Liberar tem +1 ao número máximo de Selos · pendente: 25% de chance de abrir Baús próximos quando você Conjurar uma Magia
- `17906` Maestria de Armadilhas — **parcial**: pendente: 5% de chance de arremessar até 4 Armadilhas adicionais · pendente: 8% de Chance das Armadilhas Ativarem uma vez adicional · pendente: Pode ter até 5 Armadilhas adicionais plantadas por vez · pendente: Recupere 30 da Vida quando sua Armadilha for ativada por um Inimigo · pendente: Armadilhas não podem ser Danificadas
- `17945` Domínio de Dano Degenerativo — **parcial**: pendente: Efeito da Crueldade aumentado em 30%
- `18240` Maestria de Escudo de Energia — **parcial**: pendente: 50% do seu Escudo de Energia é adicionado ao seu Ponto de Atordoamento · pendente: 30% do dano de caos sofrido não ignora o escudo de energia
- `18750` Maestria de Frascos — **parcial**: pendente: Inimigos que você Matar sob efeito de Afecções Elementais concedem 100% de Cargas de Frascos aumentadas
- `19050` Maestria de Garras — **parcial**: pendente: Ganha 25 de Vida por Inimigo Acertado com Ataques de Garras na Mão Principal · pendente: Ganha 25 de Mana por Inimigo Acertado com Ataques de Garras na Mão Secundária · pendente: Bônus Inerente de Velocidade de Ataque da Empunhadura Dupla é dobrado enquanto portando Garras · pendente: Furtividade aumentada em 50% caso você tenha Acertado com uma Garra Recentemente · pendente: Habilidades Suportadas por Lâmina Noturna têm Efeito do Elusivo aumentado em 40%
- `19725` Maestria de Atordoamentos — **parcial**: pendente: Acertos contra voê Não podem ser Golpes Críticos se você foi Atordoado Recentemente · pendente: 25% de chance de causar um Acerto Atordoador aos Monstros Inimigos Próximos quando você for Atordoado · pendente: Ganha Adrenalina quando Atordoado, por 2 segundos por cada 100ms de Duração do Atordoamento
- `19750` Maestria de Armadura e Evasão — **parcial**: pendente: Defende com 120% da Armadura contra Ataques de Projéteis · pendente: 5% mais chance de Evadir Ataques Corpo a Corpo · pendente: A cada 4 segundos, Regenere Vida igual a 1% da sua Armadura e Evasão durante 1 segundo
- `20675` Maestria Física — **parcial**: pendente: Evita +60% do dano físico refletido · pendente: 10% mais Dano Físico Máximo de Ataques · pendente: Não pode ser Atordoado por Acertos que causem apenas Dano Físico · pendente: Dano Físico com Habilidades que Custam Vida aumentado em 40%
- `20730` Maestria de Supressão Mágica — **parcial**: pendente: Ignora +3% do Dano Mágico Suprimido · pendente: Inflige Exposição a Fogo, Gelo e raio nos Inimigos quando você Suprimir seu Dano Mágico · pendente: Impede +1% do Dano Mágico Suprimido por Acerto Suprimido Recentemente · pendente: -2% de chance de Suprimir Dano Mágico por Acerto Suprimido Recentemente · pendente: Você tem Trespassar se você Suprimiu Dano Mágico Recentemente · pendente: +8% de chance de Suprimir Dano Mágico enquanto Trepassando · pendente: Chance de Suprimir Dano Mágico é Sortuda
- `20736` Maestria de Frascos — **parcial**: pendente: Inimigos que você Matar sob efeito de Afecções Elementais concedem 100% de Cargas de Frascos aumentadas
- `21143` Maestria de Runas — **sem-efeito**: pendente: Runas têm Área de Efeito aumentada em 30% caso 50% da Duração do Vínculo tenha expirado · pendente: Runas se Vinculam a um novo Inimigo cada vez que se Ativam, não mais do que uma vez a cada 0.3 segundos · pendente: Convocação de Runas tem sua Velocidade de Recuperação de Recarga aumentada em 50% · pendente: Você pode Conjurar 2 Runas Adicionais · pendente: Alcance do Vínculo de Runas aumentado em 40%
- `21324` Maestria de Bloqueio — **parcial**: pendente: +2% à Chance máxima de Bloquear o Dano de Ataques · pendente: +2% à Chance máxima de Bloquear Dano Mágico
- `21801` Maestria de Caos — **parcial**: pendente: Recupera 1% de Vida por Debuff de Definhamento em cada Inimigo que você Matar · pendente: Perca 10% de Vida e Escudo de Energia ao usar uma Habilidade de Caos · pendente: Causa 10% mais Dano de Caos aos inimigos que tiverem Escudo de Energia · pendente: 5% de chance de, quando você infligir Definhamento, infligir até um máximo de 15 Debuffs de Definhamento ao invés
- `22067` Maestria de Dano Degenerativo — **parcial**: pendente: Efeito da Crueldade aumentado em 30%
- `22295` Maestria de Sangramento — **parcial**: pendente: 50% de chance de Agravar o Sangramento em alvos que você Atordoar com Acertos de Ataques · pendente: Acertos de Ataques Agravam qualquer Sangramento mais antigos que 4 segundos nos alvos
- `22480` Maestria de Bloqueio — **parcial**: pendente: +2% à Chance máxima de Bloquear o Dano de Ataques · pendente: +2% à Chance máxima de Bloquear Dano Mágico
- `22970` Maestria Defensiva de Lacaios — **parcial**: pendente: Lacaios tem +8% de máximo de todas as Resistências Elementais · pendente: Convocação tem Recuperação da Recarga aumentada em 40% · pendente: Lacaios têm Recuperação de Vida reduzida em 15% · pendente: Lacaios Recuperam 5% de Vida na Morde de Lacaios
- `23547` Maestria de Caos — **parcial**: pendente: Recupera 1% de Vida por Debuff de Definhamento em cada Inimigo que você Matar · pendente: Perca 10% de Vida e Escudo de Energia ao usar uma Habilidade de Caos · pendente: Causa 10% mais Dano de Caos aos inimigos que tiverem Escudo de Energia · pendente: 5% de chance de, quando você infligir Definhamento, infligir até um máximo de 15 Debuffs de Definhamento ao invés
- `24224` Maestria de Machados — **parcial**: pendente: Inimigos Mortos pelos seus Acertos são destruídos
- `24334` Maestria de Vínculos — **sem-efeito**: pendente: Vínculos demoram duas vezes mais para quebrar
- `24481` Maestria de Recuperação — **parcial**: pendente: Efeitos de Recuperação de Vida ocorrem durante 3 segundos ao invés · pendente: Inimigos Próximos têm Regeneração de Vida reduzida em 50% · pendente: A cada 4 segundos,Recupere 1 de vida por cada 0.1 Vida Recuperada por segundo da Regeneração
- `24552` Maestria de Arcos — **parcial**: pendente: Flecha Ilusória e Flecha Espelhada têm Recuperação da Recarga aumentada em 100% · pendente: Flechas ganham Chance de Golpe Crítico enquanto viajam adiante, máximo de até 100% de Chance de Golpe Crítico · pendente: Duração do Arqueiro Ilusório aumentada em 100% · pendente: Bônus recebidos da Aljava Equipada aumentado em 20% · pendente: Aumentos e Reduções à Velocidade de Projéteis também se aplicam ao Dano com Arcos
- `25031` Maestria de Clamores — **parcial**: pendente: Clamores têm um mínimo de 10 de Poder
- `25313` Domínio do Conjurador — **sem-efeito**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40% · pendente: Velocidade de Conjuração aumentada em 6% por cada Magia Não Instantânea que você tenha Conjurado Recentemente · pendente: Magias que podem ganhar Intensidade têm +1 de Intensidade máxima · pendente: Habilidades suportadas por Liberar tem +1 ao número máximo de Selos · pendente: 25% de chance de abrir Baús próximos quando você Conjurar uma Magia
- `25349` Maestria de Arcos — **parcial**: pendente: Flecha Ilusória e Flecha Espelhada têm Recuperação da Recarga aumentada em 100% · pendente: Flechas ganham Chance de Golpe Crítico enquanto viajam adiante, máximo de até 100% de Chance de Golpe Crítico · pendente: Duração do Arqueiro Ilusório aumentada em 100% · pendente: Bônus recebidos da Aljava Equipada aumentado em 20% · pendente: Aumentos e Reduções à Velocidade de Projéteis também se aplicam ao Dano com Arcos
- `25446` Maestria de Dreno — **parcial**
- `25934` Maestria de Duas Mãos — **parcial**: pendente: Armadura e evasão aumentadas em 30%, se a arma da sua mão principal tiver um encaixe verde e vermelho · pendente: 15% mais Duração de Atordoamentos com Armas de Duas Mãos · pendente: Acertos Impiedosos Intimidam Inimigos por 4 segundos
- `26037` Maestria de Retaliação — **sem-efeito**
- `26148` Maestria de Precisão — **parcial**: pendente: 40% mais Precisão contra Inimigos Únicos · pendente: 50% mais Precisão em Curta Distância
- `26154` Maestria de Clamores — **parcial**: pendente: Clamores têm um mínimo de 10 de Poder
- `26393` Maestria Defensiva de Lacaios — **parcial**: pendente: Lacaios tem +8% de máximo de todas as Resistências Elementais · pendente: Convocação tem Recuperação da Recarga aumentada em 40% · pendente: Lacaios têm Recuperação de Vida reduzida em 15% · pendente: Lacaios Recuperam 5% de Vida na Morde de Lacaios
- `26608` Maestria de Totens — **parcial**: pendente: A Velocidade de Ação dos Totens não pode ser modificada para abaixo do valor base · pendente: Habilidades que invocam um Totem têm 30% de chance de invocar dois em vez de um · pendente: 5% do Dano de Acertos é sofrido na Vida do seu Totem mais próximo antes da sua · pendente: Chance de golpe crítico aumentada em 40%, se você criou um totem recentemente · pendente: Totens Provocam Inimigos ao redor deles por 1 segundo quando Convocados
- `26697` Maestria de Espadas — **parcial**: pendente: +0.3 metros ao Alcance de Golpes Corpo a Corpo com Espadas · pendente: Precisão da Mão Secundária é igual a da Mão Primária enquanto portando uma Espada · pendente: Chance de Inimigos Bloquearem Ataques com Espada reduzida em 50%
- `27157` Domínio de Precisão — **parcial**: pendente: 40% mais Precisão contra Inimigos Únicos · pendente: 50% mais Precisão em Curta Distância
- `27193` Maestria de Recuperação — **parcial**: pendente: Efeitos de Recuperação de Vida ocorrem durante 3 segundos ao invés · pendente: Inimigos Próximos têm Regeneração de Vida reduzida em 50% · pendente: A cada 4 segundos,Recupere 1 de vida por cada 0.1 Vida Recuperada por segundo da Regeneração
- `27235` Maestria de Recuperação — **parcial**: pendente: Efeitos de Recuperação de Vida ocorrem durante 3 segundos ao invés · pendente: Inimigos Próximos têm Regeneração de Vida reduzida em 50% · pendente: A cada 4 segundos,Recupere 1 de vida por cada 0.1 Vida Recuperada por segundo da Regeneração
- `27307` Maestria de Escudo de Energia — **parcial**: pendente: 50% do seu Escudo de Energia é adicionado ao seu Ponto de Atordoamento · pendente: 30% do dano de caos sofrido não ignora o escudo de energia
- `27371` Maestria de Evasão — **parcial**
- `27733` Maestria de Conjuração — **sem-efeito**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40% · pendente: Velocidade de Conjuração aumentada em 6% por cada Magia Não Instantânea que você tenha Conjurado Recentemente · pendente: Magias que podem ganhar Intensidade têm +1 de Intensidade máxima · pendente: Habilidades suportadas por Liberar tem +1 ao número máximo de Selos · pendente: 25% de chance de abrir Baús próximos quando você Conjurar uma Magia
- `27865` Maestria de Arcos — **parcial**: pendente: Flecha Ilusória e Flecha Espelhada têm Recuperação da Recarga aumentada em 100% · pendente: Flechas ganham Chance de Golpe Crítico enquanto viajam adiante, máximo de até 100% de Chance de Golpe Crítico · pendente: Duração do Arqueiro Ilusório aumentada em 100% · pendente: Bônus recebidos da Aljava Equipada aumentado em 20% · pendente: Aumentos e Reduções à Velocidade de Projéteis também se aplicam ao Dano com Arcos
- `27872` Maestria de Minas — **sem-efeito**: pendente: Cada Mina aplica Dano sofrido aumentado em 2% aos Inimigos próximos a ela, até 10% · pendente: Cada Mina aplica Dano sofrido reduzido em 2% aos Inimigos próximos a ela, até 10% · pendente: Efeito de Auras das Minas aumentado em 30% · pendente: Detonar Minas é Ativado enquanto você se mover · pendente: Minas não podem ser Danificadas · pendente: Regenera 2.5% de Vida por Segundo se você Detonou uma Mina Recentemente
- `27931` Maestria de Maça — **parcial**: pendente: Esmaga Inimigos ao acertar com Maças e Cetros · pendente: 12% de chance de causar Dano Dobrado com Ataques se o Tempo de Ataque for maior que 1 segundo · pendente: Acertos que Atordoarem os Inimigos possuem Golpe de Misericórdia
- `28039` Maestria de Machados — **parcial**: pendente: Inimigos Mortos pelos seus Acertos são destruídos
- `28284` Maestria de Atributos — **parcial**: pendente: +5 de Força por Habilidade Passiva de Maestria Alocada · pendente: +5 de Inteligência por Habilidade Passiva de Maestria Alocada · pendente: +5 de Destreza por Habilidade Passiva de Maestria Alocada
- `28680` Maestria de Conjuração — **sem-efeito**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40% · pendente: Velocidade de Conjuração aumentada em 6% por cada Magia Não Instantânea que você tenha Conjurado Recentemente · pendente: Magias que podem ganhar Intensidade têm +1 de Intensidade máxima · pendente: Habilidades suportadas por Liberar tem +1 ao número máximo de Selos · pendente: 25% de chance de abrir Baús próximos quando você Conjurar uma Magia
- `28862` Maestria de Dreno — **parcial**
- `28863` Maestria de Ataque — **parcial**
- `28903` Maestria de Envenenamentos — **parcial**: pendente: Portador da Praga têm Valor Máximo da Praga aumentado em 20%
- `29993` Maestria de Duração — **parcial**: pendente: 10% mais Duração do Efeito de Habilidades · pendente: 10% menos Duração do Efeito de Habilidades
- `30393` Maestria de Armadura e Escudo de Energia — **parcial**: pendente: 2% de chance de Defender com 150% de Armadura por cada 5% de Escudo de Energia faltando · pendente: Recupera 5% de Escudo de Energia durante 1 segundo quando você sofrer Dano Físico de um Acerto Inimigo · pendente: Aumentos e Reduções à Armadura também se aplicam à Recarga do Escudo de Energia em 20% de seu valor
- `31039` Maestria de Críticos — **parcial**: pendente: Atordoamentos dos Golpes Criticos têm Duração aumentada em 100%
- `31197` Maestria de Adagas — **parcial**: pendente: Acertos Críticos possuem Golpe de Misericórdia · pendente: Elusivo concede +40% de Multiplicador de Golpes Críticos às Habilidades Suportadas por Lâmina Noturna · mais_dano@alvoVenenos:5: condição desconhecida: alvoVenenos:5
- `31291` Maestria de Espadas — **parcial**: pendente: +0.3 metros ao Alcance de Golpes Corpo a Corpo com Espadas · pendente: Precisão da Mão Secundária é igual a da Mão Primária enquanto portando uma Espada · pendente: Chance de Inimigos Bloquearem Ataques com Espada reduzida em 50%
- `31292` Maestria de Maça — **parcial**: pendente: Esmaga Inimigos ao acertar com Maças e Cetros · pendente: 12% de chance de causar Dano Dobrado com Ataques se o Tempo de Ataque for maior que 1 segundo · pendente: Acertos que Atordoarem os Inimigos possuem Golpe de Misericórdia
- `31400` Maestria de Empalamento — **parcial**: pendente: Convocar o Aço causa Dano Refletido com Área de Efeito aumentada em 40% · pendente: Convocar o Aço tem Velocidade de Uso aumentada em 40% · pendente: Chamado do Aço tem +4 ao máximo de Fragmentos de Aço · pendente: Convocar o Aço causa Dano Refletido aumentado em 10% · pendente: Empalamentos removidos desta forma multiplicam seu Dano Refletido para este Acerto pela quantidade de Acertos que restavam
- `31818` Maestria de Proteção — **parcial**: pendente: Evita +50% do dano refletido · pendente: Não pode ser afetado por Sangue Corrompido
- `32242` Maestria de Estandartes — **sem-efeito**: pendente: Ganhe 5 de Valor quando você Clamar, se possível
- `32278` Maestria Ofensiva de Lacaios — **parcial**: pendente: Acertos dos Lacaios têm 50% de chance de ignorar a Redução de Dano Físico Inimiga · pendente: Lacaios Penetram 8% das Resistências Elementais dos Inimigos Amaldiçoados · pendente: Lacaios tem 25% de chance de ganhar Poder Profano por 4 segundos ao Matar · pendente: Lacaios têm Efeito em Área aumentado em 30% · pendente: Lacaios têm Recuperação da Recarga aumentada em 20%
- `32509` Maestria de Conjuração — **sem-efeito**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40% · pendente: Velocidade de Conjuração aumentada em 6% por cada Magia Não Instantânea que você tenha Conjurado Recentemente · pendente: Magias que podem ganhar Intensidade têm +1 de Intensidade máxima · pendente: Habilidades suportadas por Liberar tem +1 ao número máximo de Selos · pendente: 25% de chance de abrir Baús próximos quando você Conjurar uma Magia
- `32657` Maestria de Marcas — **sem-efeito**: pendente: Inimigos Marcados não podem Regenerar Vida · pendente: Inimigos próximos do seu Inimigo Marcado são Cegados · pendente: 10% de chance de ganhar uma Carga de Frenesi quando você Acertar seu Inimigo Marcado · pendente: Inimigos Marcados não podem causar Golpes Críticos · pendente: Sua Marca se transfere para outro Inimigo quando o Inimigo Marcado morrer · pendente: 50% mais Precisão contra o Inimigo Marcado
- `33037` Maestria de Ataques — **parcial**
- `33657` Maestria de Proteção — **parcial**: pendente: Evita +50% do dano refletido · pendente: Não pode ser afetado por Sangue Corrompido
- `33678` Maestria de Cargas — **parcial**: pendente: Monstros Inimigos não podem ganhar Cargas de Poder, Frenesi ou Tolerância
- `33823` Maestria de Críticos — **parcial**: pendente: Atordoamentos dos Golpes Criticos têm Duração aumentada em 100%
- `34317` Maestria Elementar — **sem-efeito**: pendente: Exposições infligidas por você aplicam ao menos -18% à Resistência afetada · pendente: Evita +60% do dano elemental refletido · pendente: Efeito de Exposições em você reduzido em 50% · pendente: Acertos têm 15% de chance de tratarem os valores da Resistência Elemental dos Monstros Inimigos como invertidos · pendente: 3% de chance de Acertos causarem 300% do Dano Físico como Dano Extra de um Elemento aleatório
- `34487` Maestria de Totens — **parcial**: pendente: A Velocidade de Ação dos Totens não pode ser modificada para abaixo do valor base · pendente: Habilidades que invocam um Totem têm 30% de chance de invocar dois em vez de um · pendente: 5% do Dano de Acertos é sofrido na Vida do seu Totem mais próximo antes da sua · pendente: Chance de golpe crítico aumentada em 40%, se você criou um totem recentemente · pendente: Totens Provocam Inimigos ao redor deles por 1 segundo quando Convocados
- `34552` Maestria Ofensiva de Lacaios — **parcial**: pendente: Acertos dos Lacaios têm 50% de chance de ignorar a Redução de Dano Físico Inimiga · pendente: Lacaios Penetram 8% das Resistências Elementais dos Inimigos Amaldiçoados · pendente: Lacaios tem 25% de chance de ganhar Poder Profano por 4 segundos ao Matar · pendente: Lacaios têm Efeito em Área aumentado em 30% · pendente: Lacaios têm Recuperação da Recarga aumentada em 20%
- `34723` Maestria de Cargas — **parcial**: pendente: Monstros Inimigos não podem ganhar Cargas de Poder, Frenesi ou Tolerância
- `35038` Maestria de Varinhas — **parcial**: pendente: Ataques têm 100% de Poder Arcano ao usar uma varinha · pendente: Inteligência é adicionada à Precisão com Varinhas
- `35085` Maestria de Críticos — **parcial**: pendente: Atordoamentos dos Golpes Criticos têm Duração aumentada em 100%
- `35118` Maestria de Duas Mãos — **parcial**: pendente: Armadura e evasão aumentadas em 30%, se a arma da sua mão principal tiver um encaixe verde e vermelho · pendente: 15% mais Duração de Atordoamentos com Armas de Duas Mãos · pendente: Acertos Impiedosos Intimidam Inimigos por 4 segundos
- `35221` Maestria de Precisão — **parcial**: pendente: 40% mais Precisão contra Inimigos Únicos · pendente: 50% mais Precisão em Curta Distância
- `35321` Maestria de Estandartes — **sem-efeito**: pendente: Ganhe 5 de Valor quando você Clamar, se possível
- `35859` Maestria de Dreno — **parcial**
- `35977` Maestria de Clamores — **parcial**: pendente: Clamores têm um mínimo de 10 de Poder
- `37502` Maestria de Arcos — **parcial**: pendente: Flecha Ilusória e Flecha Espelhada têm Recuperação da Recarga aumentada em 100% · pendente: Flechas ganham Chance de Golpe Crítico enquanto viajam adiante, máximo de até 100% de Chance de Golpe Crítico · pendente: Duração do Arqueiro Ilusório aumentada em 100% · pendente: Bônus recebidos da Aljava Equipada aumentado em 20% · pendente: Aumentos e Reduções à Velocidade de Projéteis também se aplicam ao Dano com Arcos
- `37532` Maestria de Raio — **parcial**: pendente: Chance de Golpe Crítico contra inimigos com Exposição a Raio aumentada em 60% · pendente: Dano de Raio dos Inimigos Acertando você enquanto você estiver Eletrizado é Azarado
- `37616` Maestria de Armadilhas — **parcial**: pendente: 5% de chance de arremessar até 4 Armadilhas adicionais · pendente: 8% de Chance das Armadilhas Ativarem uma vez adicional · pendente: Pode ter até 5 Armadilhas adicionais plantadas por vez · pendente: Recupere 30 da Vida quando sua Armadilha for ativada por um Inimigo · pendente: Armadilhas não podem ser Danificadas
- `37641` Maestria de Armadura e Escudo de Energia — **parcial**: pendente: 2% de chance de Defender com 150% de Armadura por cada 5% de Escudo de Energia faltando · pendente: Recupera 5% de Escudo de Energia durante 1 segundo quando você sofrer Dano Físico de um Acerto Inimigo · pendente: Aumentos e Reduções à Armadura também se aplicam à Recarga do Escudo de Energia em 20% de seu valor
- `37698` Maestria de Atordoamentos — **parcial**: pendente: Acertos contra voê Não podem ser Golpes Críticos se você foi Atordoado Recentemente · pendente: 25% de chance de causar um Acerto Atordoador aos Monstros Inimigos Próximos quando você for Atordoado · pendente: Ganha Adrenalina quando Atordoado, por 2 segundos por cada 100ms de Duração do Atordoamento
- `37956` Maestria de Sangramento — **parcial**: pendente: 50% de chance de Agravar o Sangramento em alvos que você Atordoar com Acertos de Ataques · pendente: Acertos de Ataques Agravam qualquer Sangramento mais antigos que 4 segundos nos alvos
- `38207` Maestria de Gelo — **parcial**: pendente: +1 ao multiplicador de dano de gelo degenerativo por 4% de resistência a dano de gelo excedente
- `38377` Maestria de Totens — **parcial**: pendente: A Velocidade de Ação dos Totens não pode ser modificada para abaixo do valor base · pendente: Habilidades que invocam um Totem têm 30% de chance de invocar dois em vez de um · pendente: 5% do Dano de Acertos é sofrido na Vida do seu Totem mais próximo antes da sua · pendente: Chance de golpe crítico aumentada em 40%, se você criou um totem recentemente · pendente: Totens Provocam Inimigos ao redor deles por 1 segundo quando Convocados
- `38568` Maestria de Cegueira — **parcial**: pendente: Duração da Cegueira aumentada em 100% · pendente: 100% de chance de Evitar Cegueira
- `38579` Maestria de Envenenamentos — **parcial**: pendente: Portador da Praga têm Valor Máximo da Praga aumentado em 20%
- `38595` Domínio de Precisão — **parcial**: pendente: 40% mais Precisão contra Inimigos Únicos · pendente: 50% mais Precisão em Curta Distância
- `38622` Maestria de Tinturas — **sem-efeito**: pendente: As primeiras 6 Queimas de Mana aplicadas em você não tem efeito
- `38921` Maestria de Bloqueio — **parcial**: pendente: +2% à Chance máxima de Bloquear o Dano de Ataques · pendente: +2% à Chance máxima de Bloquear Dano Mágico
- `39332` Maestria de Cajados — **parcial**: pendente: Vida e mana máximos aumentados em 12%, se o seu cajado equipado tiver um encaixe azul e vermelho
- `39338` Maestria de Duas Mãos — **parcial**: pendente: Armadura e evasão aumentadas em 30%, se a arma da sua mão principal tiver um encaixe verde e vermelho · pendente: 15% mais Duração de Atordoamentos com Armas de Duas Mãos · pendente: Acertos Impiedosos Intimidam Inimigos por 4 segundos
- `39416` Maestria Ofensiva de Lacaios — **parcial**: pendente: Acertos dos Lacaios têm 50% de chance de ignorar a Redução de Dano Físico Inimiga · pendente: Lacaios Penetram 8% das Resistências Elementais dos Inimigos Amaldiçoados · pendente: Lacaios tem 25% de chance de ganhar Poder Profano por 4 segundos ao Matar · pendente: Lacaios têm Efeito em Área aumentado em 30% · pendente: Lacaios têm Recuperação da Recarga aumentada em 20%
- `39836` Maestria de Reserva — **parcial**
- `40170` Maestria de Sangramento — **parcial**: pendente: 50% de chance de Agravar o Sangramento em alvos que você Atordoar com Acertos de Ataques · pendente: Acertos de Ataques Agravam qualquer Sangramento mais antigos que 4 segundos nos alvos
- `40196` Maestria de Conjuração — **sem-efeito**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40% · pendente: Velocidade de Conjuração aumentada em 6% por cada Magia Não Instantânea que você tenha Conjurado Recentemente · pendente: Magias que podem ganhar Intensidade têm +1 de Intensidade máxima · pendente: Habilidades suportadas por Liberar tem +1 ao número máximo de Selos · pendente: 25% de chance de abrir Baús próximos quando você Conjurar uma Magia
- `40383` Maestria de Dreno — **parcial**
- `40439` Maestria de Runas — **sem-efeito**: pendente: Runas têm Área de Efeito aumentada em 30% caso 50% da Duração do Vínculo tenha expirado · pendente: Runas se Vinculam a um novo Inimigo cada vez que se Ativam, não mais do que uma vez a cada 0.3 segundos · pendente: Convocação de Runas tem sua Velocidade de Recuperação de Recarga aumentada em 50% · pendente: Você pode Conjurar 2 Runas Adicionais · pendente: Alcance do Vínculo de Runas aumentado em 40%
- `40698` Maestria de Fúria — **parcial**: pendente: Cada Fúria também concede Ponto de Atordoamento aumentado em 1% · pendente: Perda Inerente de Fúria é 20% mais rápida · pendente: Clamores concedem 1 de Fúria por cada 5 de Poder Inimigo, até 5 · pendente: Inimigos Próximos são Intimidados enquanto você tiver Fúria
- `41016` Maestria de Frascos — **parcial**: pendente: Inimigos que você Matar sob efeito de Afecções Elementais concedem 100% de Cargas de Frascos aumentadas
- `41163` Maestria de Evasão — **parcial**
- `41225` Maestria Defensiva de Lacaios — **parcial**: pendente: Lacaios tem +8% de máximo de todas as Resistências Elementais · pendente: Convocação tem Recuperação da Recarga aumentada em 40% · pendente: Lacaios têm Recuperação de Vida reduzida em 15% · pendente: Lacaios Recuperam 5% de Vida na Morde de Lacaios
- `41273` Domínio de Dano Degenerativo — **parcial**: pendente: Efeito da Crueldade aumentado em 30%
- `41522` Maestria de Duração — **parcial**: pendente: 10% mais Duração do Efeito de Habilidades · pendente: 10% menos Duração do Efeito de Habilidades
- `41744` Maestria de Retaliação — **sem-efeito**
- `42361` Maestria de Caos — **parcial**: pendente: Recupera 1% de Vida por Debuff de Definhamento em cada Inimigo que você Matar · pendente: Perca 10% de Vida e Escudo de Energia ao usar uma Habilidade de Caos · pendente: Causa 10% mais Dano de Caos aos inimigos que tiverem Escudo de Energia · pendente: 5% de chance de, quando você infligir Definhamento, infligir até um máximo de 15 Debuffs de Definhamento ao invés
- `42533` Maestria de Precisão — **parcial**: pendente: 40% mais Precisão contra Inimigos Únicos · pendente: 50% mais Precisão em Curta Distância
- `42792` Maestria de Proteção — **parcial**: pendente: Evita +50% do dano refletido · pendente: Não pode ser afetado por Sangue Corrompido
- `43307` Maestria de Estandartes — **sem-efeito**: pendente: Ganhe 5 de Valor quando você Clamar, se possível
- `43495` Maestria de Dreno — **parcial**
- `43601` Maestria de Sangramento — **parcial**: pendente: 50% de chance de Agravar o Sangramento em alvos que você Atordoar com Acertos de Ataques · pendente: Acertos de Ataques Agravam qualquer Sangramento mais antigos que 4 segundos nos alvos
- `43647` Maestria Ofensiva de Lacaios — **parcial**: pendente: Acertos dos Lacaios têm 50% de chance de ignorar a Redução de Dano Físico Inimiga · pendente: Lacaios Penetram 8% das Resistências Elementais dos Inimigos Amaldiçoados · pendente: Lacaios tem 25% de chance de ganhar Poder Profano por 4 segundos ao Matar · pendente: Lacaios têm Efeito em Área aumentado em 30% · pendente: Lacaios têm Recuperação da Recarga aumentada em 20%
- `44179` Maestria de Gelo — **parcial**: pendente: +1 ao multiplicador de dano de gelo degenerativo por 4% de resistência a dano de gelo excedente
- `44206` Maestria de Tinturas — **sem-efeito**: pendente: As primeiras 6 Queimas de Mana aplicadas em você não tem efeito
- `44298` Maestria Elementar — **sem-efeito**: pendente: Exposições infligidas por você aplicam ao menos -18% à Resistência afetada · pendente: Evita +60% do dano elemental refletido · pendente: Efeito de Exposições em você reduzido em 50% · pendente: Acertos têm 15% de chance de tratarem os valores da Resistência Elemental dos Monstros Inimigos como invertidos · pendente: 3% de chance de Acertos causarem 300% do Dano Físico como Dano Extra de um Elemento aleatório
- `44330` Maestria de Tinturas — **sem-efeito**: pendente: As primeiras 6 Queimas de Mana aplicadas em você não tem efeito
- `44540` Maestria de Armadilhas — **parcial**: pendente: 5% de chance de arremessar até 4 Armadilhas adicionais · pendente: 8% de Chance das Armadilhas Ativarem uma vez adicional · pendente: Pode ter até 5 Armadilhas adicionais plantadas por vez · pendente: Recupere 30 da Vida quando sua Armadilha for ativada por um Inimigo · pendente: Armadilhas não podem ser Danificadas
- `45019` Maestria de Frascos — **parcial**: pendente: Inimigos que você Matar sob efeito de Afecções Elementais concedem 100% de Cargas de Frascos aumentadas
- `45358` Maestria de Armadura — **parcial**: pendente: 20% de chance de Defender com 200% de Armadura · pendente: Armadura aumentada em 20% por segundo que você tenha ficado parado, máximo de 100%
- `45372` Maestria de Ataques — **parcial**
- `46495` Maestria de Reserva — **parcial**
- `46665` Maestria de Frascos — **parcial**: pendente: Inimigos que você Matar sob efeito de Afecções Elementais concedem 100% de Cargas de Frascos aumentadas
- `46761` Maestria de Frascos — **parcial**: pendente: Inimigos que você Matar sob efeito de Afecções Elementais concedem 100% de Cargas de Frascos aumentadas
- `47059` Maestria de Empalamento — **parcial**: pendente: Convocar o Aço causa Dano Refletido com Área de Efeito aumentada em 40% · pendente: Convocar o Aço tem Velocidade de Uso aumentada em 40% · pendente: Chamado do Aço tem +4 ao máximo de Fragmentos de Aço · pendente: Convocar o Aço causa Dano Refletido aumentado em 10% · pendente: Empalamentos removidos desta forma multiplicam seu Dano Refletido para este Acerto pela quantidade de Acertos que restavam
- `47197` Maestria de Reserva — **parcial**
- `47212` Maestria de Projéteis — **parcial**: pendente: Projéteis causam Dano aumentado em 20% com Acertos e Afecções para cada Inimigo Atravessado · pendente: Projéteis causam Dano aumentado em 20% com Acertos e Afecções para cada vez que Ricochetearam · pendente: Empurra Inimigos se você tiver um Golpe Crítico com Dano de Projéteis · pendente: 15% mais Velocidade de Projéteis · pendente: 15% menos Velocidade de Projéteis
- `47242` Maestria Ofensiva de Lacaios — **parcial**: pendente: Acertos dos Lacaios têm 50% de chance de ignorar a Redução de Dano Físico Inimiga · pendente: Lacaios Penetram 8% das Resistências Elementais dos Inimigos Amaldiçoados · pendente: Lacaios tem 25% de chance de ganhar Poder Profano por 4 segundos ao Matar · pendente: Lacaios têm Efeito em Área aumentado em 30% · pendente: Lacaios têm Recuperação da Recarga aumentada em 20%
- `47294` Maestria de Dano Degenerativo — **parcial**: pendente: Efeito da Crueldade aumentado em 30%
- `48144` Maestria de Vínculos — **sem-efeito**: pendente: Vínculos demoram duas vezes mais para quebrar
- `48290` Maestria Defensiva de Lacaios — **parcial**: pendente: Lacaios tem +8% de máximo de todas as Resistências Elementais · pendente: Convocação tem Recuperação da Recarga aumentada em 40% · pendente: Lacaios têm Recuperação de Vida reduzida em 15% · pendente: Lacaios Recuperam 5% de Vida na Morde de Lacaios
- `48349` Maestria de Cajados — **parcial**: pendente: Vida e mana máximos aumentados em 12%, se o seu cajado equipado tiver um encaixe azul e vermelho
- `48411` Maestria de Varinhas — **parcial**: pendente: Ataques têm 100% de Poder Arcano ao usar uma varinha · pendente: Inteligência é adicionada à Precisão com Varinhas
- `48508` Maestria de Totens — **parcial**: pendente: A Velocidade de Ação dos Totens não pode ser modificada para abaixo do valor base · pendente: Habilidades que invocam um Totem têm 30% de chance de invocar dois em vez de um · pendente: 5% do Dano de Acertos é sofrido na Vida do seu Totem mais próximo antes da sua · pendente: Chance de golpe crítico aumentada em 40%, se você criou um totem recentemente · pendente: Totens Provocam Inimigos ao redor deles por 1 segundo quando Convocados
- `48660` Maestria Elementar — **sem-efeito**: pendente: Exposições infligidas por você aplicam ao menos -18% à Resistência afetada · pendente: Evita +60% do dano elemental refletido · pendente: Efeito de Exposições em você reduzido em 50% · pendente: Acertos têm 15% de chance de tratarem os valores da Resistência Elemental dos Monstros Inimigos como invertidos · pendente: 3% de chance de Acertos causarem 300% do Dano Físico como Dano Extra de um Elemento aleatório
- `48717` Maestria de Armadura — **parcial**: pendente: 20% de chance de Defender com 200% de Armadura · pendente: Armadura aumentada em 20% por segundo que você tenha ficado parado, máximo de 100%
- `48982` Maestria de Empalamento — **parcial**: pendente: Convocar o Aço causa Dano Refletido com Área de Efeito aumentada em 40% · pendente: Convocar o Aço tem Velocidade de Uso aumentada em 40% · pendente: Chamado do Aço tem +4 ao máximo de Fragmentos de Aço · pendente: Convocar o Aço causa Dano Refletido aumentado em 10% · pendente: Empalamentos removidos desta forma multiplicam seu Dano Refletido para este Acerto pela quantidade de Acertos que restavam
- `49391` Maestria de Ataques — **parcial**
- `49677` Maestria de Empalamentos — **parcial**: pendente: Convocar o Aço causa Dano Refletido com Área de Efeito aumentada em 40% · pendente: Convocar o Aço tem Velocidade de Uso aumentada em 40% · pendente: Chamado do Aço tem +4 ao máximo de Fragmentos de Aço · pendente: Convocar o Aço causa Dano Refletido aumentado em 10% · pendente: Empalamentos removidos desta forma multiplicam seu Dano Refletido para este Acerto pela quantidade de Acertos que restavam
- `49820` Maestria de Supressão Mágica — **parcial**: pendente: Ignora +3% do Dano Mágico Suprimido · pendente: Inflige Exposição a Fogo, Gelo e raio nos Inimigos quando você Suprimir seu Dano Mágico · pendente: Impede +1% do Dano Mágico Suprimido por Acerto Suprimido Recentemente · pendente: -2% de chance de Suprimir Dano Mágico por Acerto Suprimido Recentemente · pendente: Você tem Trespassar se você Suprimiu Dano Mágico Recentemente · pendente: +8% de chance de Suprimir Dano Mágico enquanto Trepassando · pendente: Chance de Suprimir Dano Mágico é Sortuda
- `50071` Maestria de Dupla Empunhadura — **parcial**: pendente: Dupla Empunhadura não concede chance de Bloquear o Dano de Ataques de forma inerente · pendente: +1% de Chance de Golpe Crítico da Mão Secundária enquanto em Dupla Empunhadura · pendente: 20% de chance de ganhar Elusivo ao Bloquear enquanto em Empunhadura Dupla · pendente: 20% de chance de Mutilar Inimigos com Acertos da Mão Principal · pendente: 20% de chance de Cegar Inimigos com Acertos da Mão Secundária
- `50757` Maestria de Evasão — **parcial**
- `51583` Maestria de Críticos — **parcial**: pendente: Atordoamentos dos Golpes Criticos têm Duração aumentada em 100%
- `51761` Maestria de Dupla Empunhadura — **parcial**: pendente: Dupla Empunhadura não concede chance de Bloquear o Dano de Ataques de forma inerente · pendente: +1% de Chance de Golpe Crítico da Mão Secundária enquanto em Dupla Empunhadura · pendente: 20% de chance de ganhar Elusivo ao Bloquear enquanto em Empunhadura Dupla · pendente: 20% de chance de Mutilar Inimigos com Acertos da Mão Principal · pendente: 20% de chance de Cegar Inimigos com Acertos da Mão Secundária
- `51974` Maestria de Fortificação — **sem-efeito**
- `52018` Maestria de Empunhadura Dupla — **parcial**: pendente: Dupla Empunhadura não concede chance de Bloquear o Dano de Ataques de forma inerente · pendente: +1% de Chance de Golpe Crítico da Mão Secundária enquanto em Dupla Empunhadura · pendente: 20% de chance de ganhar Elusivo ao Bloquear enquanto em Empunhadura Dupla · pendente: 20% de chance de Mutilar Inimigos com Acertos da Mão Principal · pendente: 20% de chance de Cegar Inimigos com Acertos da Mão Secundária
- `52061` Maestria de Fúria — **parcial**: pendente: Cada Fúria também concede Ponto de Atordoamento aumentado em 1% · pendente: Perda Inerente de Fúria é 20% mais rápida · pendente: Clamores concedem 1 de Fúria por cada 5 de Poder Inimigo, até 5 · pendente: Inimigos Próximos são Intimidados enquanto você tiver Fúria
- `52074` Maestria de Empalamento — **parcial**: pendente: Convocar o Aço causa Dano Refletido com Área de Efeito aumentada em 40% · pendente: Convocar o Aço tem Velocidade de Uso aumentada em 40% · pendente: Chamado do Aço tem +4 ao máximo de Fragmentos de Aço · pendente: Convocar o Aço causa Dano Refletido aumentado em 10% · pendente: Empalamentos removidos desta forma multiplicam seu Dano Refletido para este Acerto pela quantidade de Acertos que restavam
- `52220` Maestria Física — **parcial**: pendente: Evita +60% do dano físico refletido · pendente: 10% mais Dano Físico Máximo de Ataques · pendente: Não pode ser Atordoado por Acertos que causem apenas Dano Físico · pendente: Dano Físico com Habilidades que Custam Vida aumentado em 40%
- `52462` Maestria de Armadura — **parcial**: pendente: 20% de chance de Defender com 200% de Armadura · pendente: Armadura aumentada em 20% por segundo que você tenha ficado parado, máximo de 100%
- `52875` Maestria de Ataque — **parcial**
- `53216` Maestria de Atordoamentos — **parcial**: pendente: Acertos contra voê Não podem ser Golpes Críticos se você foi Atordoado Recentemente · pendente: 25% de chance de causar um Acerto Atordoador aos Monstros Inimigos Próximos quando você for Atordoado · pendente: Ganha Adrenalina quando Atordoado, por 2 segundos por cada 100ms de Duração do Atordoamento
- `53365` Maestria de Garras — **parcial**: pendente: Ganha 25 de Vida por Inimigo Acertado com Ataques de Garras na Mão Principal · pendente: Ganha 25 de Mana por Inimigo Acertado com Ataques de Garras na Mão Secundária · pendente: Bônus Inerente de Velocidade de Ataque da Empunhadura Dupla é dobrado enquanto portando Garras · pendente: Furtividade aumentada em 50% caso você tenha Acertado com uma Garra Recentemente · pendente: Habilidades Suportadas por Lâmina Noturna têm Efeito do Elusivo aumentado em 40%
- `53517` Maestria de Recuperação — **parcial**: pendente: Efeitos de Recuperação de Vida ocorrem durante 3 segundos ao invés · pendente: Inimigos Próximos têm Regeneração de Vida reduzida em 50% · pendente: A cada 4 segundos,Recupere 1 de vida por cada 0.1 Vida Recuperada por segundo da Regeneração
- `53615` Maestria de Reserva — **parcial**
- `53738` Maestria de Minas — **sem-efeito**: pendente: Cada Mina aplica Dano sofrido aumentado em 2% aos Inimigos próximos a ela, até 10% · pendente: Cada Mina aplica Dano sofrido reduzido em 2% aos Inimigos próximos a ela, até 10% · pendente: Efeito de Auras das Minas aumentado em 30% · pendente: Detonar Minas é Ativado enquanto você se mover · pendente: Minas não podem ser Danificadas · pendente: Regenera 2.5% de Vida por Segundo se você Detonou uma Mina Recentemente
- `53828` Maestria de Varinhas — **parcial**: pendente: Ataques têm 100% de Poder Arcano ao usar uma varinha · pendente: Inteligência é adicionada à Precisão com Varinhas
- `54340` Maestria de Armadura — **parcial**: pendente: 20% de chance de Defender com 200% de Armadura · pendente: Armadura aumentada em 20% por segundo que você tenha ficado parado, máximo de 100%
- `54413` Maestria de Supressão Mágica — **parcial**: pendente: Ignora +3% do Dano Mágico Suprimido · pendente: Inflige Exposição a Fogo, Gelo e raio nos Inimigos quando você Suprimir seu Dano Mágico · pendente: Impede +1% do Dano Mágico Suprimido por Acerto Suprimido Recentemente · pendente: -2% de chance de Suprimir Dano Mágico por Acerto Suprimido Recentemente · pendente: Você tem Trespassar se você Suprimiu Dano Mágico Recentemente · pendente: +8% de chance de Suprimir Dano Mágico enquanto Trepassando · pendente: Chance de Suprimir Dano Mágico é Sortuda
- `54849` Maestria Ofensiva de Lacaios — **parcial**: pendente: Acertos dos Lacaios têm 50% de chance de ignorar a Redução de Dano Físico Inimiga · pendente: Lacaios Penetram 8% das Resistências Elementais dos Inimigos Amaldiçoados · pendente: Lacaios tem 25% de chance de ganhar Poder Profano por 4 segundos ao Matar · pendente: Lacaios têm Efeito em Área aumentado em 30% · pendente: Lacaios têm Recuperação da Recarga aumentada em 20%
- `54887` Maestria de Gelo — **parcial**: pendente: +1 ao multiplicador de dano de gelo degenerativo por 4% de resistência a dano de gelo excedente
- `55017` Maestria de Retaliação — **sem-efeito**
- `55152` Maestria de Totens — **parcial**: pendente: A Velocidade de Ação dos Totens não pode ser modificada para abaixo do valor base · pendente: Habilidades que invocam um Totem têm 30% de chance de invocar dois em vez de um · pendente: 5% do Dano de Acertos é sofrido na Vida do seu Totem mais próximo antes da sua · pendente: Chance de golpe crítico aumentada em 40%, se você criou um totem recentemente · pendente: Totens Provocam Inimigos ao redor deles por 1 segundo quando Convocados
- `55230` Maestria de Dreno — **parcial**
- `55281` Maestria de Estandartes — **sem-efeito**: pendente: Ganhe 5 de Valor quando você Clamar, se possível
- `55348` Maestria de Ataque — **parcial**
- `55491` Maestria de Reserva — **parcial**
- `56023` Maestria de Projéteis — **parcial**: pendente: Projéteis causam Dano aumentado em 20% com Acertos e Afecções para cada Inimigo Atravessado · pendente: Projéteis causam Dano aumentado em 20% com Acertos e Afecções para cada vez que Ricochetearam · pendente: Empurra Inimigos se você tiver um Golpe Crítico com Dano de Projéteis · pendente: 15% mais Velocidade de Projéteis · pendente: 15% menos Velocidade de Projéteis
- `56128` Maestria de Varinhas — **parcial**: pendente: Ataques têm 100% de Poder Arcano ao usar uma varinha · pendente: Inteligência é adicionada à Precisão com Varinhas
- `56519` Maestria de Tinturas — **sem-efeito**: pendente: As primeiras 6 Queimas de Mana aplicadas em você não tem efeito
- `56595` Maestria de Ataque — **parcial**
- `56865` Maestria de Marcas — **sem-efeito**: pendente: Inimigos Marcados não podem Regenerar Vida · pendente: Inimigos próximos do seu Inimigo Marcado são Cegados · pendente: 10% de chance de ganhar uma Carga de Frenesi quando você Acertar seu Inimigo Marcado · pendente: Inimigos Marcados não podem causar Golpes Críticos · pendente: Sua Marca se transfere para outro Inimigo quando o Inimigo Marcado morrer · pendente: 50% mais Precisão contra o Inimigo Marcado
- `57949` Maestria de Dano Degenerativo — **parcial**: pendente: Efeito da Crueldade aumentado em 30%
- `58302` Maestria de Precisão — **parcial**: pendente: 40% mais Precisão contra Inimigos Únicos · pendente: 50% mais Precisão em Curta Distância
- `58540` Maestria de Machados — **parcial**: pendente: Inimigos Mortos pelos seus Acertos são destruídos
- `58563` Maestria de Marcas — **sem-efeito**: pendente: Inimigos Marcados não podem Regenerar Vida · pendente: Inimigos próximos do seu Inimigo Marcado são Cegados · pendente: 10% de chance de ganhar uma Carga de Frenesi quando você Acertar seu Inimigo Marcado · pendente: Inimigos Marcados não podem causar Golpes Críticos · pendente: Sua Marca se transfere para outro Inimigo quando o Inimigo Marcado morrer · pendente: 50% mais Precisão contra o Inimigo Marcado
- `58728` Maestria de Retaliação — **sem-efeito**
- `58816` Maestria de Raio — **parcial**: pendente: Chance de Golpe Crítico contra inimigos com Exposição a Raio aumentada em 60% · pendente: Dano de Raio dos Inimigos Acertando você enquanto você estiver Eletrizado é Azarado
- `59013` Maestria de Maça — **parcial**: pendente: Esmaga Inimigos ao acertar com Maças e Cetros · pendente: 12% de chance de causar Dano Dobrado com Ataques se o Tempo de Ataque for maior que 1 segundo · pendente: Acertos que Atordoarem os Inimigos possuem Golpe de Misericórdia
- `59335` Maestria de Fortificação — **sem-efeito**
- `59501` Maestria de Cegueira — **parcial**: pendente: Duração da Cegueira aumentada em 100% · pendente: 100% de chance de Evitar Cegueira
- `59926` Maestria de Minas — **sem-efeito**: pendente: Cada Mina aplica Dano sofrido aumentado em 2% aos Inimigos próximos a ela, até 10% · pendente: Cada Mina aplica Dano sofrido reduzido em 2% aos Inimigos próximos a ela, até 10% · pendente: Efeito de Auras das Minas aumentado em 30% · pendente: Detonar Minas é Ativado enquanto você se mover · pendente: Minas não podem ser Danificadas · pendente: Regenera 2.5% de Vida por Segundo se você Detonou uma Mina Recentemente
- `60170` Maestria de Gelo — **parcial**: pendente: +1 ao multiplicador de dano de gelo degenerativo por 4% de resistência a dano de gelo excedente
- `60210` Maestria de Envenenamentos — **parcial**: pendente: Portador da Praga têm Valor Máximo da Praga aumentado em 20%
- `60512` Domínio de Conjuração — **sem-efeito**: pendente: Repetição Final das Magias têm Efeito em Área aumentado em 40% · pendente: Velocidade de Conjuração aumentada em 6% por cada Magia Não Instantânea que você tenha Conjurado Recentemente · pendente: Magias que podem ganhar Intensidade têm +1 de Intensidade máxima · pendente: Habilidades suportadas por Liberar tem +1 ao número máximo de Selos · pendente: 25% de chance de abrir Baús próximos quando você Conjurar uma Magia
- `60834` Maestria de Dano Degenerativo — **parcial**: pendente: Efeito da Crueldade aumentado em 30%
- `60992` Maestria de Clamores — **parcial**: pendente: Clamores têm um mínimo de 10 de Poder
- `61343` Maestria de Runas — **sem-efeito**: pendente: Runas têm Área de Efeito aumentada em 30% caso 50% da Duração do Vínculo tenha expirado · pendente: Runas se Vinculam a um novo Inimigo cada vez que se Ativam, não mais do que uma vez a cada 0.3 segundos · pendente: Convocação de Runas tem sua Velocidade de Recuperação de Recarga aumentada em 50% · pendente: Você pode Conjurar 2 Runas Adicionais · pendente: Alcance do Vínculo de Runas aumentado em 40%
- `61529` Maestria de Recuperação — **parcial**: pendente: Efeitos de Recuperação de Vida ocorrem durante 3 segundos ao invés · pendente: Inimigos Próximos têm Regeneração de Vida reduzida em 50% · pendente: A cada 4 segundos,Recupere 1 de vida por cada 0.1 Vida Recuperada por segundo da Regeneração
- `61992` Maestria Ofensiva de Lacaios — **parcial**: pendente: Acertos dos Lacaios têm 50% de chance de ignorar a Redução de Dano Físico Inimiga · pendente: Lacaios Penetram 8% das Resistências Elementais dos Inimigos Amaldiçoados · pendente: Lacaios tem 25% de chance de ganhar Poder Profano por 4 segundos ao Matar · pendente: Lacaios têm Efeito em Área aumentado em 30% · pendente: Lacaios têm Recuperação da Recarga aumentada em 20%
- `62015` Maestria de Clamores — **parcial**: pendente: Clamores têm um mínimo de 10 de Poder
- `62023` Maestria de Atordoamentos — **parcial**: pendente: Acertos contra voê Não podem ser Golpes Críticos se você foi Atordoado Recentemente · pendente: 25% de chance de causar um Acerto Atordoador aos Monstros Inimigos Próximos quando você for Atordoado · pendente: Ganha Adrenalina quando Atordoado, por 2 segundos por cada 100ms de Duração do Atordoamento
- `62235` Maestria de Armadura e Evasão — **parcial**: pendente: Defende com 120% da Armadura contra Ataques de Projéteis · pendente: 5% mais chance de Evadir Ataques Corpo a Corpo · pendente: A cada 4 segundos, Regenere Vida igual a 1% da sua Armadura e Evasão durante 1 segundo
- `62416` Maestria de Cajados — **parcial**: pendente: Vida e mana máximos aumentados em 12%, se o seu cajado equipado tiver um encaixe azul e vermelho
- `62759` Maestria de Marcas — **sem-efeito**: pendente: Inimigos Marcados não podem Regenerar Vida · pendente: Inimigos próximos do seu Inimigo Marcado são Cegados · pendente: 10% de chance de ganhar uma Carga de Frenesi quando você Acertar seu Inimigo Marcado · pendente: Inimigos Marcados não podem causar Golpes Críticos · pendente: Sua Marca se transfere para outro Inimigo quando o Inimigo Marcado morrer · pendente: 50% mais Precisão contra o Inimigo Marcado
- `62853` Maestria de Adagas — **parcial**: pendente: Acertos Críticos possuem Golpe de Misericórdia · pendente: Elusivo concede +40% de Multiplicador de Golpes Críticos às Habilidades Suportadas por Lâmina Noturna · mais_dano@alvoVenenos:5: condição desconhecida: alvoVenenos:5
- `63184` Maestria de Espadas — **parcial**: pendente: +0.3 metros ao Alcance de Golpes Corpo a Corpo com Espadas · pendente: Precisão da Mão Secundária é igual a da Mão Primária enquanto portando uma Espada · pendente: Chance de Inimigos Bloquearem Ataques com Espada reduzida em 50%
- `63482` Maestria de Raio — **parcial**: pendente: Chance de Golpe Crítico contra inimigos com Exposição a Raio aumentada em 60% · pendente: Dano de Raio dos Inimigos Acertando você enquanto você estiver Eletrizado é Azarado
- `63710` Maestria de Sangramento — **parcial**: pendente: 50% de chance de Agravar o Sangramento em alvos que você Atordoar com Acertos de Ataques · pendente: Acertos de Ataques Agravam qualquer Sangramento mais antigos que 4 segundos nos alvos
- `63861` Maestria de Críticos — **parcial**: pendente: Atordoamentos dos Golpes Criticos têm Duração aumentada em 100%
- `64042` Maestria Física — **parcial**: pendente: Evita +60% do dano físico refletido · pendente: 10% mais Dano Físico Máximo de Ataques · pendente: Não pode ser Atordoado por Acertos que causem apenas Dano Físico · pendente: Dano Físico com Habilidades que Custam Vida aumentado em 40%
- `64128` Maestria de Reserva — **parcial**
- `64406` Maestria de Armadura — **parcial**: pendente: 20% de chance de Defender com 200% de Armadura · pendente: Armadura aumentada em 20% por segundo que você tenha ficado parado, máximo de 100%
- `65154` Maestria de Totens — **parcial**: pendente: A Velocidade de Ação dos Totens não pode ser modificada para abaixo do valor base · pendente: Habilidades que invocam um Totem têm 30% de chance de invocar dois em vez de um · pendente: 5% do Dano de Acertos é sofrido na Vida do seu Totem mais próximo antes da sua · pendente: Chance de golpe crítico aumentada em 40%, se você criou um totem recentemente · pendente: Totens Provocam Inimigos ao redor deles por 1 segundo quando Convocados
- `65528` Maestria de Evasão — **parcial**

### ascendencia-comum (63)

- `6982` Armadura e Evasão, Duração de Provocar [Champion] — **parcial**: pendente: Duração da Provocação aumentada em 20%
- `35185` Armadura e Evasão, Dano de Ataque Enquanto Fortificado [Champion] — **parcial**
- `60508` Armadura e Evasão, Dano de Ataque Enquanto Fortificado [Champion] — **parcial**
- `1729` Dano de Projétil, Duração do Arqueiro Ilusório [Deadeye] — **parcial**: pendente: Duração do Arqueiro Ilusório aumentada em 15%
- `53086` Dano de Projétil, Velocidade de Conjuração de Marca [Deadeye] — **parcial**: pendente: Habilidades Marca têm Velocidade de Conjuração aumentada em 25%
- `62136` Dano de Projétil, Duração do Arqueiro Ilusório [Deadeye] — **parcial**: pendente: Duração do Arqueiro Ilusório aumentada em 15%
- `2060` Evasão, Efeito de Tinturas [Warden] — **parcial**
- `19488` Evasão, Efeito de Tinturas [Warden] — **parcial**
- `24214` Evasão, Efeito de Tinturas [Warden] — **parcial**
- `58650` Evasão, Efeito de Tinturas [Warden] — **parcial**
- `4194` Berserker [Ascendant] — **parcial**: pendente: 15% mais Dano · pendente: Não pode ser Atordoado enquanto ainda possuir ao menos 25 de Ira · pendente: Perna Inerente de Fúria começa 1 segundo depois
- `6778` Trapaceiro [Ascendant] — **parcial**: pendente: Impede +6% do Dano Mágico Suprimido enquanto em Escudo de Energia Cheio · pendente: 2% mais Dano para cada tipo diferente de Maestria Alocada por você · pendente: Velocidade de Ação dos Monstros Inimigos Próximos é no máximo de 90% do valor base
- `8281` Elementalista [Ascendant] — **parcial**: pendente: Não pode sofrer Dano Elemental Refletido · pendente: Exposições infligidas por você aplicam -20% extra à Resistência afetada
- `8656` Protetora [Ascendant] — **parcial**
- `9327` Desbravadora [Ascendant] — **parcial**: pendente: Remove Sangramento ao usar o Frasco · pendente: Frascos recebem 3 Cargas a cada 3 segundos · pendente: 25% de chance de Frascos usados por você não consumirem Cargas
- `10099` Necromante [Ascendant] — **parcial**: pendente: Suas Habilidades de Oferenda também afetam você · pendente: Suas Oferendas possuem 50% de redução do Efeito em você · pendente: Se tiver Consumido um cadáver Recentemente, você e seus Lacaios tem Efeito em Área aumentado em 30%
- `12597` Ocultista [Ascendant] — **parcial**: pendente: Não pode ser Atordoado enquanto possuir Escudo de Energia
- `30919` Guardião [Ascendant] — **parcial**: pendente: A cada 4 segundos, Regenera 50% de Vida durante um segundo
- `34567` Atiradora [Ascendant] — **parcial**: pendente: Habilidades atiram um Projétil adicional
- `34774` Gladiador [Ascendant] — **sem-efeito**: pendente: 25% de chance de Agravar o Sangramento em alvos que você Acertar com Ataques · pendente: Ganhe 50% de Chance de Bloquear com o Escudo Equipado ao invés do valor do Escudo · pendente: Bônus Inerentes da Empunhadura Dupla são dobrados · pendente: Causa 1% mais Dano com Acertos e Afecções contra Inimigos Raros e Únicos por cada segundo que passarem em sua Presença, máximo de 50%
- `39598` Campeão [Ascendant] — **parcial**: pendente: Provocar ao Atingir · pendente: Seus Acertos Intimidam permanentemente Inimigos com Vida Cheia · pendente: Inimigos que você Provocar recebem Dano aumentado 10%
- `42144` Hierofante [Ascendant] — **parcial**: pendente: 8% de Dano é removido da Mana antes da Vida · pendente: Fúria Arcana também concede +10% de dano mágico a você · pendente: Recebe Fúria Arcana quando você ou seus Totens Acertarem um Inimigo com uma Magia
- `43122` Assassino [Ascendant] — **parcial**: pendente: +0.75% de Chance de Golpe Crítico
- `43195` Executor [Ascendant] — **parcial**: pendente: Não pode sofrer Dano Físico Refletido
- `43962` Inquisidor [Ascendant] — **sem-efeito**: pendente: Dano penetra 8% das Resistências Elementais do Inimigo · pendente: Inimigos próximos Sofrem 10% de Dano Elemental aumentado
- `57052` Chefe Guerreiro [Ascendant] — **parcial**: pendente: 20% de chance de Cobrir Inimigos Raros ou Únicos em Cinzas por 10 Segundos quando você Acertá-los
- `58827` Sabotador [Ascendant] — **parcial**: pendente: Acertos têm 20% de chance de causar 50% mais Dano em Área · pendente: 25% de chance de Cegar Inimigos ao Acertar
- `61072` Destruidor [Ascendant] — **parcial**: pendente: Ganha 1 Carga de Tolerância por segundo se foi Acertado Recentemente
- `1977` Cintos Lendários [Luminary] — **sem-efeito**: pendente: Seu mercenário pode equipar cintos únicos
- `19993` Botas Lendárias [Luminary] — **sem-efeito**: pendente: Seu mercenário pode equipar botas únicas
- `27123` Vida de Mercenário, Campo de Visão [Luminary] — **sem-efeito**: pendente: Seu mercenário e os lacaios dele têm a vida máxima aumentada em 15%
- `30675` Velocidade de Conjuração de Conexão, Campo de Visão [Luminary] — **sem-efeito**
- `32095` Elmos Lendários [Luminary] — **sem-efeito**: pendente: Seu mercenário pode equipar elmos únicos
- `32669` Amuletos Lendários [Luminary] — **sem-efeito**: pendente: Seu mercenário pode equipar amuletos únicos
- `35877` Dano de Mercenário, Campo de Visão [Luminary] — **sem-efeito**: pendente: Seu mercenário e os lacaios dele causam dano aumentado em 15%
- `43645` Anéis Lendários [Luminary] — **sem-efeito**: pendente: Seu mercenário pode equipar anéis únicos
- `52633` Luvas Lendárias [Luminary] — **sem-efeito**: pendente: Seu mercenário pode equipar luvas únicas
- `61133` Vida de Mercenário, Campo de Visão [Luminary] — **sem-efeito**: pendente: Seu mercenário e os lacaios dele têm a vida máxima aumentada em 15%
- `63954` Velocidade de Conjuração de Conexão, Campo de Visão [Luminary] — **sem-efeito**
- `2768` União da Carne [Reliquarian] — **parcial**: pendente: Resistências Elementais são limitadas pelo seu maior Máximo de Resistência Elemental ao invés
- `8081` As Areias do Tempo [Reliquarian] — **sem-efeito**
- `8967` Gritos dos Dessecados [Reliquarian] — **sem-efeito**: pendente: Você tem o bônus do Altar Impenetrável, se não estiver sob o efeito de frascos
- `17386` Alavanca de Xirgil [Reliquarian] — **parcial**: pendente: 30% de chance da Recarga do Escudo de Energia iniciar quando você Bloquear
- `20160` Espigão de Fidelitas [Reliquarian] — **parcial**
- `25795` Chamas de Ngamahu [Reliquarian] — **parcial**: pendente: Ativa Rajada Vulcânica nível 20 ao atingir corpo a corpo
- `26055` A Divindade Despedaçada [Reliquarian] — **parcial**: pendente: Concede a Habilidade Convocar Grande Emissário das Direções
- `27054` Lâmina de Cinturão Verde [Reliquarian] — **sem-efeito**: pendente: Inimigos Provocados por seus Clamores Explodem ao morrer, causando 8% de sua Vida máxima como Dano de Caos · pendente: A Recarga de Habilidades Clamor é de 4 segundos
- `33467` Vínculo de Kaom [Reliquarian] — **parcial**: pendente: Inimigos Próximos Convertem 25% de seu Dano Físico para Fogo
- `35448` Raízes de Kaom [Reliquarian] — **parcial**: pendente: Velocidade de Ação não pode ser modificada para abaixo do valor base · pendente: Não Evade Ataques inimigos
- `36072` Presa Sombria [Reliquarian] — **parcial**: pendente: Projéteis que Ricochetearam ganham 20% de Dano Não-Caótico como Dano de Caos extra
- `37303` O Bastão Negro [Reliquarian] — **sem-efeito**: pendente: Cada Fantasma Convocado concede a Você Poder Fantasmal
- `40276` Autoridade de Cadigan [Reliquarian] — **parcial**: pendente: +0.3% de chance de golpe crítico por carga de poder
- `43857` Presa de Arakaali [Reliquarian] — **sem-efeito**
- `47058` Poder de Ahn [Reliquarian] — **parcial**: pendente: ㅤ+20% de precisão, se tiver a quantidade máxima de cargas de frenesi · pendente: +100% ao multiplicador de golpe crítico, se você não tiver cargas de frenesi
- `54928` O Cálice Sagrado [Reliquarian] — **sem-efeito**: pendente: Ganha uma Carga de Frasco ao causar um Golpe Crítico · pendente: Ganha 20% do dano físico como dano de frio adicional se você usou um Frasco de Safira recentemente · pendente: Ganha 20% do dano físico como dano de fogo adicional se você usou um Frasco de Rubi recentemente · pendente: Ganha 20% do dano físico como dano elétrico adicional se você usou um Frasco de Topázio recentemente
- `56940` A Apóstata [Reliquarian] — **parcial**: pendente: Remove todo Escudo Mágico
- `18335` Na Jugular [Assassin] — **sem-efeito**: pendente: +100% ao multiplicador de golpe crítico contra inimigos que não estiverem em vida baixa · pendente: 100% mais Chance de Crítico contra Inimigos com Vida Baixa · pendente: Acertos Críticos possuem Golpe de Misericórdia
- `21264` Apunhalada [Assassin] — **sem-efeito**: pendente: Mais 100% de chance de golpe crítico contra inimigos que não estiverem em vida baixa · pendente: +100% ao multiplicador de golpe crítico contra inimigos em vida baixa · pendente: Acertos Críticos possuem Golpe de Misericórdia
- `55686` Chance de Causar Golpe Crítico, Efeito de Marca [Assassin] — **parcial**
- `5929` Efeito da Chama Santificada [Guardian] — **sem-efeito**: pendente: Intensidade de Chama Santificada infligida por você aumentada em 20%
- `32992` Armadura e Escudo de Energia, Recuperação do Bloqueio [Guardian] — **parcial**
- `33167` Regeneração de Mana, Efeito da Fúria Arcana [Hierophant] — **parcial**: pendente: Efeito da Fúria Arcana aumentado em 20% em você
- `44797` Regeneração de Mana, Efeito da Fúria Arcana [Hierophant] — **parcial**: pendente: Efeito da Fúria Arcana aumentado em 20% em você

### ascendencia-notavel (139)

- `11412` Inspirador [Champion] — **parcial**
- `13374` Mestre do Metal [Champion] — **parcial**
- `27604` Primeiro a Bater, Último a Cair [Champion] — **parcial**: pendente: Seus Acertos Intimidam permanentemente Inimigos com Vida Cheia
- `31700` Fortitude [Champion] — **sem-efeito**: pendente: Você atingiu sua fortificação máxima
- `33940` Herói Incontrolável [Champion] — **sem-efeito**
- `35750` Causas Nobres [Champion] — **sem-efeito**
- `56967` Inimigo Digno [Champion] — **sem-efeito**: pendente: Provocar ao Atingir · pendente: Inimigos que você Provocar recebem Dano aumentado 15% · pendente: Inimigos Provocados por você não podem Evadir Ataques
- `758` Guerra do Desgaste [Gladiator] — **sem-efeito**: pendente: Causa 1% mais Dano com Acertos e Afecções contra Inimigos Raros e Únicos por cada segundo que passarem em sua Presença, máximo de 100%
- `2598` Mais Que Habilidade [Gladiator] — **sem-efeito**: pendente: Chance de Bloquear o Dano Mágico ou de Ataques é Sortuda se você Bloqueou Recentemente
- `8419` Sobrevivente Determinado [Gladiator] — **sem-efeito**: pendente: Ganhe 50% de Chance de Bloquear com o Escudo Equipado ao invés do valor do Escudo · pendente: Bônus Inerentes da Empunhadura Dupla são dobrados
- `15616` Técnica Irregular [Gladiator] — **sem-efeito**: pendente: Sangramentos que você infligir são Agravados
- `52575` Mestre das Armas [Gladiator] — **parcial**: pendente: 25% mais Precisão enquanto empunhando uma Espada · pendente: 20% mais Área de Efeito enquanto empunhando uma Maça ou Cetro · pendente: 20% mais Chance de Golpe Crítico enquanto empunhando uma Adaga
- `63490` Retaliação Comedida [Gladiator] — **sem-efeito**
- `3184` Carrasco [Slayer] — **sem-efeito**: pendente: Mata Inimigos que possuem 20% ou menos de Vida quando Acertado por suas Habilidades · pendente: Ganha Velocidade de Ataque aumentada em 10% por 20 segundos quando Matar um Inimigo Raro ou Único · pendente: Ganha 10% de aumento da Velocidade de Movimento por 20 segundos ao Matar um Inimigo
- `10143` Fervor Brutal [Slayer] — **parcial**: pendente: Dano sofrido reduzido em 10% enquanto Drenando
- `17315` Esmagador [Slayer] — **sem-efeito**: pendente: Chance de Acerto Crítico Base para Ataques com Armas é de 8% · pendente: +10% de Multiplicador de Acerto Crítico por Inimigo Próximo, máximo de +100% · pendente: Inimigos Próximos tem -30% de Multiplicador de Acerto Crítico
- `34484` Apetite Insaciável [Slayer] — **parcial**: pendente: Velocidade de Ataque aumentada em 20% enquanto Drenando · pendente: Não pode ser Atordoado enquanto Drenando
- `38180` Impacto [Slayer] — **parcial**: pendente: Efeito em Área aumentado em 5% por Inimigo morto recentemente, até 50% · pendente: Causa até 15% mais Dano Corpo a Corpo aos Inimigos, baseado na proximidade
- `62817` Executor de Lendas [Slayer] — **parcial**: pendente: 10% mais Dano se você Matou Recentemente · pendente: Não pode sofrer Dano Físico Refletido
- `9271` Desafiando a Dor [Berserker] — **sem-efeito**: pendente: Ganha Desafio por 10 segundos ao perder Vida para um Acerto Inimigo, não mais do que uma vez a cada 0.3 segundos · pendente: Perde todo o Desafio quando chegar a 10 de Desafio · pendente: Ganha 3% da vida não reservada faltante antes de ser atingido por um inimigo para cada Desafio
- `24528` Frenesi de Combate [Berserker] — **sem-efeito**: pendente: Cada Fúria também concede Velocidade de Ataque aumentada em 1% · pendente: Perna Inerente de Fúria começa 2 segundos depois
- `29630` Dançarino Sanguinolento [Berserker] — **sem-efeito**: pendente: 30% do dreno de vida é instantâneo
- `32251` Portador da Guerra [Berserker] — **sem-efeito**
- `38999` Fúria Ancestral [Berserker] — **sem-efeito**: pendente: Habilidades de Golpe também miram no local anterior que foram Usadas
- `57560` Ritual da Ruína [Berserker] — **sem-efeito**: pendente: Perca 0.1% de Vida por segundo por Fúria enquanto não estiver perdendo Fúria · pendente: Efeito da Fúria aumentado em 50%
- `59920` Aspecto da Carnificina [Berserker] — **parcial**: pendente: 40% mais Dano
- `1731` Hinekora, Fúria da Morte [Chieftain] — **sem-efeito**: pendente: Inimigos que você ou seus Totens Matarem têm 10% de chance de Explodir, causando 250% de sua Vida Máxima como Dano de Fogo
- `31667` Sione, Rugido Solar [Chieftain] — **parcial**: pendente: Clamores têm poder infinito
- `32249` Valako, Abraço da Tormenta [Chieftain] — **sem-efeito**: pendente: Modificadores à Resistência a Fogo Máxima também se aplicam ao Máximo das Resistências a Gelo e Raio
- `48480` Tasalio, Água Purificadora [Chieftain] — **parcial**: pendente: Modificadores à Resistência a Fogo também se aplicam à Resistência a Gelo e Raio em 50% de seu Valor
- `50692` Ngamahu, Avanço da Chama [Chieftain] — **sem-efeito**: pendente: Joias Não Únicas fazem com que Aumentos e Reduções aos Tipos de Dano em um Grande Raio sejam Transformados para serem aplicados ao Dano de Fogo · pendente: Joias Não Únicas fazem com que Habilidades Passivas Pequenas e Notáveis em um Raio Grande também concedam +4 de Força
- `53095` Tukohama, Arauto da Guerra [Chieftain] — **sem-efeito**: pendente: Habilidades do Peitoral Equipado são Suportadas por Chamado Ancestral Nível 30 · pendente: Habilidades do Peitoral Equipado são Suportadas por Punho da Guerra Nível 20
- `61355` Ramako, Luz do Sol [Chieftain] — **sem-efeito**: pendente: A Resistência dos Monstros Inimigos Próximos contra · pendente: Dano Degenerativo é -20% enquanto você estiver Parado
- `1734` Inabalável [Juggernaut] — **parcial**: pendente: Ganha 1 Carga de Tolerância por segundo se foi Acertado Recentemente
- `5819` Incontrolável [Juggernaut] — **parcial**: pendente: Velocidade de Ação não pode ser modificada para abaixo do valor base · pendente: Velocidade de Movimento não pode ser modificada para abaixo do valor base
- `17988` Incansável [Juggernaut] — **parcial**: pendente: 1.5% do Total de Dano Físico dos Acertos impedido nos últimos 10 segundos é Regenerado como Vida por segundo
- `44297` Inegável [Juggernaut] — **parcial**: pendente: Velocidade de Ataque aumentada em 1% por cada 150 de Precisão · pendente: Ganha Precisão igual a duas vezes sua Força
- `53816` Inquebrável [Juggernaut] — **sem-efeito**: pendente: Armadura do Peitoral Equipado é dobrada · pendente: 15% de Armadura também é aplicado ao Dano de Caos sofrido dos Acertos
- `2872` Força Ocupante [Deadeye] — **sem-efeito**: pendente: Arqueiros Ilusórios não são grudados em você · pendente: +2 ao número máximo de Arqueiros Ilusórios Convocados · pendente: Não pode Convocar Arqueiros Ilusórios enquanto próximo dos seus Arqueiros Ilusórios
- `5443` Ponto Focal [Deadeye] — **sem-efeito**: pendente: 25% menos Dano sofrido dos outros Inimigos próximos do Inimigo Marcado · pendente: Sua Marca se transfere para outro Inimigo quando o Inimigo Marcado morrer
- `23169` Guarda do Vento [Deadeye] — **sem-efeito**: pendente: 4% menos Dano sofrido por Força dos Ventos · pendente: Perde toda a sua Força dos Ventos ao Acertar
- `24848` Ventania [Deadeye] — **sem-efeito**: pendente: Ganha 1 de Força dos Ventos ao usar uma Habilidade · pendente: Efeito do Vento Favorável em você aumentado em 10% por Força dos Ventos
- `26067` Munições Infinitas [Deadeye] — **sem-efeito**: pendente: Habilidades atiram 2 Projéteis adicionais
- `44482` Avidez [Deadeye] — **parcial**: pendente: 5% mais Precisão por Carga de Frenesi · pendente: Ganhe uma Carga de Frenesi por segundo enquanto se Move
- `45313` Tiro Distante [Deadeye] — **sem-efeito**: pendente: Projéteis ganham Dano ao viajar adiante, causando até 30% mais Dano com Acertos e Afecções · pendente: Barragens de Projéteis não se propagam
- `61627` Ricochete [Deadeye] — **parcial**: pendente: Projéteis têm 30% de chance de conseguirem Ricochetear ao colidirem com o terreno
- `1697` Mestre Toxista [Pathfinder] — **sem-efeito**: pendente: Ao matar um inimigo envenenado durante o efeito de um frasco, os inimigos em um raio de 1,5 metro também ficam envenenados · pendente: Envenenamento causado por você durante o Efeito de Frascos possuem 20% de chance de causar 100% mais Dano
- `6038` Mestre Destilador [Pathfinder] — **sem-efeito**: pendente: Concede bônus para Habilidades Não Canalizadoras usadas por você consumindo 3 Cargas de um Frasco de cada um dos seguintes tipos, se possível: · pendente: Se Cargas de um Frasco de Diamante forem consumidas, Chance de Golpe Crítico aumentado em 250% · pendente: Se Cargas de um Frasco de Bismuto forem consumidas, Penetra 25% das Resistências Elementais · pendente: Se Cargas de um Frasco de Ametista forem consumidas, 37% do Dano Físico como Dano Extra de Caos
- `40813` Represália da Natureza [Pathfinder] — **parcial**
- `51101` Adrenalina da Natureza [Pathfinder] — **sem-efeito**: pendente: Frascos recebem 3 Cargas a cada 3 segundos
- `61805` Mestre Alquimista [Pathfinder] — **sem-efeito**: pendente: Remove Afecções Elementais quando você usa um Frasco · pendente: 50% de chance de Frascos usados por você não consumirem Cargas
- `63293` Mestre Cirurgiã [Pathfinder] — **sem-efeito**: pendente: Efeitos do Frasco de Vida não se Enfileram · pendente: 50% menos Vida Recuperada de Frascos
- `65296` Dádiva da Natureza [Pathfinder] — **sem-efeito**: pendente: Frascos Utilitários Mágicos aplicados em você têm Efeito aumentado em 30%
- `4849` Ensinamentos da Mãe [Warden] — **sem-efeito**
- `11597` Lição das Estações [Warden] — **sem-efeito**: pendente: -25 de dano sofrido de cada tipo de dano por ataques de magia por casca · pendente: Impede +3% do Dano Mágico Suprimido por Casca abaixo do máximo · pendente: Perde 1 Casca quando Acertado por Dano Mágico Inimigo
- `16848` Juramento do Inverno [Warden] — **parcial**: pendente: Acertos que falharem em Congelar devido a Duração insuficiente do Congelamento infligem Geada
- `29662` Herbalista Experiente [Warden] — **sem-efeito**
- `33645` Juramento do Verão [Warden] — **sem-efeito**: pendente: Acertos que causariam Incêndio causam Causticação ao invés · pendente: Você pode infligir uma Causticação adicional em cada Inimgo
- `36958` Caçador Experiente [Warden] — **sem-efeito**
- `40104` Sufusão Persistente [Warden] — **sem-efeito**
- `55509` Avatar da Selva [Warden] — **sem-efeito**: pendente: Ganhe 1 de Fúria Liberta quando você infligir uma Afecção Elemental com um Acerto em um Inimigo, não mais que uma vez a cada 0.2 segundos por cada tipo de Afecção · pendente: Não pode ganhar Fúria Liberta enquanto Liberto · pendente: Seus Acertos sempre infligem Congelamento, Eletrização e Incêndio enquanto Liberto · pendente: 100% mais Dano Elemental enquanto Liberto
- `772` Ascensão do Sombra [Ascendant] — **nao-classificado**
- `15435` Ascensão do Templário [Ascendant] — **nao-classificado**
- `24798` Ascensão do Duelista [Ascendant] — **nao-classificado**
- `49532` Ascensão da Caçadora [Ascendant] — **nao-classificado**
- `51782` Ascensão da Bruxa [Ascendant] — **nao-classificado**
- `61437` Ascensão do Marauder [Ascendant] — **nao-classificado**
- `1564` Guarda-costas Leal [Luminary] — **sem-efeito**: pendente: Se a vida do seu mercenário for maior que a sua, 20% do dano recebido de ataques será subtraído da vida do seu mercenário antes de atingir você · pendente: Se a vida do seu mercenário for menor que a sua, 40% do dano sofrido por ele é recuperado como vida
- `15900` Juramento de Fidelidade [Luminary] — **sem-efeito**: pendente: ㅤ-50% de custo de habilidades de conexão · pendente: Habilidades de conexão têm duração de fixação infinita · pendente: Se o seu mercenário conectado morrer, o dono da conexão não morrerá
- `25944` Armas Lendárias [Luminary] — **sem-efeito**: pendente: Seu mercenário pode equipar aljavas, armas e escudos únicos · pendente: Seu mercenário e os lacaios dele causam +8% de dano para cada item único equipado por ele
- `31517` Glória Dourada [Luminary] — **sem-efeito**: pendente: Aumentos e reduções de campo de visão também se aplicam ao efeito dos seus bônus de habilidade de conexão no seu mercenário
- `46479` Sangue Nobre [Luminary] — **sem-efeito**: pendente: Você pode contratar um mercenário de forma permanente
- `56292` Sagração à Cavalaria [Luminary] — **sem-efeito**: pendente: Seu mercenário provoca ao atingir · pendente: Seu mercenário tem o efeito das auras não maldições das habilidades aumentado em 50%
- `2460` Mostruário de Armas de Conjurador [Reliquarian] — **nao-classificado**
- `12003` Mostruário de Armas Marciais [Reliquarian] — **nao-classificado**
- `35989` Mostruário de Pedrarias [Reliquarian] — **nao-classificado**
- `36489` Mostruário de Armaduras [Reliquarian] — **nao-classificado**
- `1945` Infusão Mística [Assassin] — **sem-efeito**: pendente: A chance de causar golpe mágico crítico se bifurca · pendente: ㅤ-30% de chance de causar golpe mágico crítico
- `19083` Assassinar [Assassin] — **sem-efeito**: pendente: Enquanto houver no máximo um Inimigo Raro ou Único próximo, você causa 25% mais Dano · pendente: Menos 35% de dano sofrido enquanto houver pelo menos dois inimigos raros ou únicos por perto
- `19598` Entrega Tóxica [Assassin] — **parcial**: pendente: Duração do Envenamento aumentada em 5% para cada Veneno que você tenha infligido Recentemente, máximo de 100% · pendente: Recupera 0.5% de Vida por Veneno afetando Inimigos mortos por Você
- `28782` Andarilho da Névoa [Assassin] — **parcial**: pendente: Você não sofre Dano Extra de Golpes Críticos enquanto Elusivo
- `46676` Estilo de Assassinato [Assassin] — **nao-classificado**
- `48239` Mortífero [Assassin] — **sem-efeito**: pendente: Ativa Marca do Assassino nível 30 ao causar golpe crítico com ataques contra um inimigo raro ou único e você não tem uma marca · pendente: Habilidades de marca não custam mana · pendente: Efeito das suas habilidades de marca aumentado em 10% por carga de poder máxima · pendente: 3% do roubo de recursos é instantâneo por carga de poder máxima
- `5087` Nascido nas Sombras [Saboteur] — **parcial**: pendente: Não pode ser Cegado · pendente: Dano Sofrido de Inimigos Cegos reduzido em 15% · pendente: Cega Inimigos ao Acertar
- `14103` Risco Calculado [Saboteur] — **sem-efeito**: pendente: Sua Chance de Crítico é Sortuda · pendente: O dano dos inimigos que te atingem é azarado · pendente: Dano com Acertos é Azarado
- `16940` Ataque Cegante [Saboteur] — **parcial**: pendente: 2% de Vida Regenerada por Segundo para cada uma das suas Minas Detonadas Recentemente, até 10% por segundo · pendente: 2% da Vida Regenerada por Segundo para cada uma de suas Armadilhas Ativadas Recentemente, até 10% por segundo
- `28535` Crime Perfeito [Saboteur] — **sem-efeito**: pendente: Ativa Convocar Robôs Ativadores Nível 20 quando Alocado · pendente: 30% menos Dano com Magias Ativadas
- `38918` Reação em Cadeia [Saboteur] — **sem-efeito**: pendente: Habilidades utilizadas por Armadilhas possuem 50% de aumento do Efeito em Área · pendente: Quando suas Armadilhas Ativarem, suas Armadilhas próximas também Ativam
- `39834` Especialista em Demolições [Saboteur] — **sem-efeito**: pendente: Efeito de Auras das Minas aumentado em 150% · pendente: Minas Desaceleram Inimigos próximos delas por 2 segundos quando são Plantadas
- `47778` Especialista em Bombas [Saboteur] — **sem-efeito**: pendente: Acertos têm 30% de chance de causar 50% mais Dano em Área · pendente: 30% de chance de sofrer 50% menos Dano em Área de Acertos
- `51462` Como Relógio [Saboteur] — **parcial**: pendente: Inimigos Próximos têm Recuperação da Recarga reduzido em 10%
- `57175` Especialista de Estilhaços [Saboteur] — **sem-efeito**: pendente: Projéteis têm 50% de chance de Retornarem a você · pendente: Projéteis são disparados em direções aleatórias
- `23225` Um Passo a Frente [Trickster] — **sem-efeito**: pendente: Sua Velocidade de Ação é de ao menos 90% do valor base · pendente: Velocidade de Ação dos Monstros Inimigos Próximos é no máximo de 90% do valor base
- `28884` Parada Cardíaca [Trickster] — **sem-efeito**: pendente: A cada 10 segundos: · pendente: Sofre 50% menos Dano de Acertos por 5 segundos · pendente: Sofre 50% menos Dano Degenerativo por 5 segundos
- `29825` Arte do Escape [Trickster] — **sem-efeito**: pendente: +4 de Evasão por cada 1 de Escudo de Energia Máximo no Elmo Equipado · pendente: +1 para o escudo de energia máximo por 8 de evasão no peitoral equipado
- `41891` Quebra-Feitiço [Trickster] — **sem-efeito**: pendente: Impede +15% do Dano Mágico Suprimido enquanto em Escudo de Energia Cheio · pendente: 50% de chance da Recarga do Escudo de Energia começar quando você Suprimir Dano Mágico
- `55867` Polímata [Trickster] — **sem-efeito**: pendente: 2% mais Dano para cada tipo diferente de Maestria Alocada por você · pendente: Recupera 1% da Vida ao Matar para cada tipo diferente de Maestria Alocada por você · pendente: Recupera 1% da Escudo de Energia ao Matar para cada tipo diferente de Maestria Alocada por você · pendente: Recupera 1% da Mana ao Matar para cada tipo diferente de Maestria Alocada por você
- `3458` Marechal da Divindade [Guardian] — **sem-efeito**: pendente: Inflige Chama Santificada ao atingir corpo a corpo · pendente: Você pode infligir +1 Chama Santificada nos inimigos · pendente: Ganha 10% do dano físico como dano elétrico adicional para cada uma das suas Chamas Santificadas que foram removidas recentemente por um ataque aliado, até 80%
- `4494` Cruzada Radiante [Guardian] — **sem-efeito**: pendente: 20% do Dano dos Acertos é sofrido na vida do seu Sentinela do Resplendor antes da sua
- `19641` Cruzada Implacável [Guardian] — **sem-efeito**: pendente: 25% de chance de Ativar Convocar Relíquia Elemental Nível 20 quando você ou um Aliado próximo Matar um Inimigo, ou Acertar um Inimigo Raro ou Único
- `39728` Baluarte da Esperança [Guardian] — **sem-efeito**
- `42264` Fé Radiante [Guardian] — **sem-efeito**
- `55146` Hora da Necessidade [Guardian] — **sem-efeito**: pendente: Remove maldições e afecções de você a cada 4 segundos · pendente: A cada 4 segundos, Regenera 100% de Vida durante um segundo
- `61372` Harmonia do Propósito [Guardian] — **sem-efeito**: pendente: Ganha um buff de altar aleatório a cada 10 segundos
- `922` Orientação Divina [Hierophant] — **parcial**: pendente: 10% de Dano é removido da Mana antes da Vida · pendente: Transfiguração da Mente
- `1105` Busca da Fé [Hierophant] — **parcial**: pendente: Duração do Totem aumentada em 100%
- `29026` Santuário do Pensamento [Hierophant] — **parcial**: pendente: Adicional de 1% à Regeneração de Mana por segundo
- `34434` Ritual do Despertar [Hierophant] — **sem-efeito**: pendente: 3% mais Dano por Totem Convocado · pendente: Regenera 0.5% da Mana por segundo para cada Totem Convocado · pendente: Você e seus Totens Regeneram 1% de Vida por segundo para cada Totem Convocado
- `40510` Benção Arcana [Hierophant] — **sem-efeito**: pendente: Fúria Arcana também concede +20% de dano mágico a você · pendente: Recebe Fúria Arcana quando você ou seus Totens Acertarem um Inimigo com uma Magia
- `51492` Sinal de Propósito [Hierophant] — **sem-efeito**: pendente: Runas têm 100% mais Frequência de Ativação se 75% da Duração de Vínculo houver expirado · pendente: Convocação de Runas tem sua Velocidade de Recuperação de Recarga aumentada em 100%
- `60462` Devoção Iluminada [Hierophant] — **parcial**: pendente: Área de Efeito aumentada em 30% enquanto você possuir Fúria Arcana
- `3154` Instrumentos de Justiça [Inquisitor] — **sem-efeito**: pendente: Chance de Golpe Crítico Mágico de Magias é igual ao da sua Arma Principal
- `13851` Instrumentos do Fervor [Inquisitor] — **sem-efeito**: pendente: Ganha Fanatismo por 5 segundos ao atingir o Máximo de Cargas Fanáticas · pendente: Ganha 1 Carga Fanática a cada segundo se tiver Atacado no segundo anterior · pendente: Perde todas as Cargas Fanáticas ao atingir o Máximo de Cargas Fanáticas · pendente: +3 ao Máximo de Cartas Fanáticas
- `19417` Instrumentos da Virtude [Inquisitor] — **sem-efeito**: pendente: 10% mais Dano de Ataque por cada Magia Não Instantânea que você tenha Conjurado nos últimos 8 segundos nos últimos 8 segundos, máximo de 30% · pendente: Mago de Batalha
- `32816` Caminho Piedoso [Inquisitor] — **sem-efeito**
- `39790` Santificar [Inquisitor] — **sem-efeito**
- `40059` Presságio do Arrependimento [Inquisitor] — **sem-efeito**: pendente: Inimigos próximos Sofrem 16% de Dano Elemental aumentado · pendente: Inimigos próximos causam 8% menos Dano Elemental
- `48214` Julgamento Inevitável [Inquisitor] — **sem-efeito**: pendente: Golpes Críticos ignoram as Resistências Elementais de Monstros Inimigos · pendente: Acertos Não Críticos penetram 10% das Resistências Elementais do Inimigo
- `53884` Justa Providência [Inquisitor] — **parcial**: pendente: Chance de Golpe Crítico aumentada em 1% por ponto em Força ou Inteligência, o que for menor
- `258` Arauto da Ruína [Elementalist] — **parcial**: pendente: Efeito dos Buffs de Arauto em você aumentado em 66%
- `4917` Bastião dos Elementos [Elementalist] — **sem-efeito**: pendente: Não pode sofrer Dano Elemental Refletido
- `53123` Modelador das Chamas [Elementalist] — **parcial**: pendente: Inimigos Incendiados por você têm 40% do Dano Físico causado por eles convertido para Fogo
- `56461` Suserano do Primordial [Elementalist] — **parcial**: pendente: Golens Convocados são Imunes ao Dano Elemental · pendente: Golens Convocados são Reconvocados 4 segundos após serem Mortos
- `57197` Coração da Destruição [Elementalist] — **sem-efeito**: pendente: Ganha Convergência ao Acertar um Inimigo Único, não mais do que uma vez a cada 8 segundos · pendente: Área de Efeito aumentada em 60% enquanto você não possuir Convergência
- `61259` Gênio da Discórdia [Elementalist] — **sem-efeito**: pendente: Exposições infligidas por você aplicam -25% extra à Resistência afetada · pendente: Regenera 1% de Mana por segundo se você infligiu Exposição Recentemente
- `3554` Gula por Essências [Necromancer] — **sem-efeito**: pendente: Regenera 8% de Escudo de Energia durante 2 segundos ao Consumir um cadáver · pendente: Regenera 4% de Mana durante 2 segundos ao Consumir um cadáver
- `11490` Portador da Infestação [Necromancer] — **sem-efeito**: pendente: Se tiver Consumido um cadáver Recentemente, você e seus Lacaios tem Efeito em Área aumentado em 30% · pendente: Com ao menos um cadáver próximo, Inimigos próximos causam Dano reduzido em 10%
- `14603` Barreira Óssea [Necromancer] — **sem-efeito**: pendente: 1% de Redução de Dano Físico adicional por Lacaio, até 10% · pendente: 1% do Dano Causado pelos seus Lacaios é Drenado como Vida para você · pendente: Lacaios ganham 40% de sua Vida Máxima como Escudo de Energia Máximo
- `23572` Pacto Cadavérico [Necromancer] — **sem-efeito**: pendente: Velocidades de Ataque e Conjuração aumentadas em 4% por cada cadáver Consumido Recentemente, máximo de 200% · pendente: Inimigos próximos a cadáveres Criados por você Recentemente são Resfriados e Eletrizados
- `36017` Comandante das Trevas [Necromancer] — **sem-efeito**
- `48719` Dama do Sacrifício [Necromancer] — **parcial**: pendente: Suas Habilidades de Oferenda também afetam você · pendente: Suas Oferendas possuem 50% de redução do Efeito em você
- `54159` Agressão Desmedida [Necromancer] — **sem-efeito**: pendente: Lacaios tem 20% mais Vida Máxima · pendente: Lacaios causam 10% mais Dano
- `65153` Força Sobrenatural [Necromancer] — **sem-efeito**: pendente: Lacaios têm Poder Profano
- `5502` Rito Profano [Occultist] — **sem-efeito**
- `25309` Presença Pútrida [Occultist] — **parcial**: pendente: 15% mais Dano de Caos · pendente: A cada segundo, causa Definhando em Inimigos próximos por 15 segundos · pendente: Inimigos Próximos Desacelerados causam 15% de Dano Degenerativo reduzido
- `27096` Farol do Além [Occultist] — **sem-efeito**: pendente: Inimigos Próximos possuem -20% de Resistência a Gelo · pendente: Inimigos próximos possuem -20% de Resistência a Caos · pendente: Velocidade de Regeneração de Vida de Inimigos Próximos reduzida em 100%
- `37127` Florescer Profano [Occultist] — **sem-efeito**: pendente: Inimigos Amaldiçoados Mortos por você ou seus Lacaios possuem 50% de chance de Explodir, causando um quarto de sua Vida máxima como Dano de Caos
- `37492` Bastião Vil [Occultist] — **parcial**: pendente: Não pode ser Atordoado enquanto possuir Escudo de Energia · pendente: Chance de bloquear magias aumenta o seu escudo de energia máximo
- `47630` Despertar Frígido [Occultist] — **parcial**: pendente: 15% mais Dano de Gelo · pendente: A cada 4 segundos, 50% de chance de Congelar Inimigos próximos Não Congelados por 0.4 segundos · pendente: Inimigos Próximos Resfriados causam Dano reduzido em 10% com Acertos

## Inventário por nó (rastreável por id)

A versão completa, com as chaves de cada nó, está em `arvore-passivas-poe-inventario.json`.

| id | nó | categoria | tipos de modificador | situação | degrau | aplicado | cobertura |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `6` | Terrores Gêmeos | notavel | crítico | funcional | validado | ficha | 1/1 |
| `94` | Evasão | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `127` | Vida e Recuperação ao Matar | comum | vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `223` | Decaimento Lento da Fúria | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `224` | Recuperação da Recarga de Clamores | comum | — | sem-efeito | alocavel | — | — |
| `238` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `265` | Chance de Crítico e Precisão com Garras | comum | crítico | funcional | validado | ficha | 1/1 |
| `367` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `420` | Dano de Lacaio e Físico | comum | lacaios e totens, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `444` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `465` | Dano e Velocidade de Ataque do Projétil | comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `476` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `487` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `494` | Dano com Habilidades de Retaliação e Bloqueio com Escudos | comum | bloqueio | parcial | validado | ficha | 1/1 |
| `529` | Presas Venenosas | notavel | afecções e chance no acerto, dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `544` | Vigilância | notavel | lacaios e totens | parcial | aplicado | combate | 0/1 |
| `570` | Golpes Ofuscantes | notavel | crítico, afecções e chance no acerto, outros | funcional | aplicado | ficha | 0/3 |
| `651` | Resistências Elementais | comum | afecções e chance no acerto | funcional | validado | combate | 3/3 |
| `655` | Queima de Mana mais Lenta | comum | — | sem-efeito | alocavel | — | — |
| `720` | Precisão e Dano com Ataques | comum | dano % (aumentado e "mais"), precisão % | funcional | validado | ficha | 2/2 |
| `739` | Velocidade de Conjuração | comum | velocidades | funcional | validado | ficha | 1/1 |
| `861` | Bastião Agressivo | notavel | bloqueio, dano % (aumentado e "mais"), efeito por evento | funcional | aplicado | ficha | 3/4 |
| `864` | Efeito de Empalamento com Armas de Duas Mãos | comum | outros | funcional | aplicado | combate | 0/1 |
| `885` | Dano de Fogo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `903` | Velocidade de Movimento e Supressão Mágica | comum | supressão de magia, velocidades | funcional | validado | ficha | 2/2 |
| `918` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `930` | Dano com Arcos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `1006` | Potência da Vontade | notavel | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `1031` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `1159` | Dano de Ataques e Velocidade de Ataque com Escudo | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `1201` | Dano com Ataques | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `1203` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `1252` | Chance de Empurrar | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `1325` | Sangue do Golem | notavel | vida %, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `1340` | Baluarte | notavel | — | sem-efeito | alocavel | — | — |
| `1346` | Chance de Crítico Mágico | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `1354` | Fúria ao Acertar | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `1382` | Vácuo de Espírito | notavel | mana e custo, outros | funcional | aplicado | ficha | 1/2 |
| `1405` | Vindo das Sombras | notavel | velocidades, outros | funcional | aplicado | ficha | 1/2 |
| `1427` | Prevenção de Atordoamento | comum | atordoamento | funcional | aplicado | combate | 0/1 |
| `1461` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `1550` | Dano de Fogo e Regeneração de Vida | comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `1568` | Lâmina Fatal | notavel | crítico | funcional | validado | ficha | 2/2 |
| `1572` | Multiplicador de Dano Físico Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `1593` | Bloqueio e Resistências Elementais com Escudos | comum | bloqueio, resistências | funcional | validado | ficha | 4/4 |
| `1600` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `1609` | Regeneração de Vida de Lacaios | comum | lacaios e totens | funcional | aplicado | combate | 0/1 |
| `1648` | Chance de Envenenamento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `1652` | Área de Efeito de Feitiços | comum | — | sem-efeito | alocavel | — | — |
| `1655` | Dano com Minas | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `1696` | Duração e Velocidade para Colocar Totem | comum | velocidades | parcial | aplicado | combate | 0/1 |
| `1698` | Chance e Multiplicador de Crítico da Espada | comum | crítico | funcional | validado | ficha | 2/2 |
| `1722` | Multiplicador de Golpe Crítico de Lacaios | comum | — | sem-efeito | alocavel | — | — |
| `1761` | Dano com Cajados e Armadura | comum | dano % (aumentado e "mais"), armadura e evasão | funcional | validado | ficha | 3/3 |
| `1767` | Vida e Escudo de Energia ao Matar | comum | vida, regeneração e dreno de vida, efeito por evento | funcional | aplicado | ficha | 0/2 |
| `1822` | Vida e Escudo de Energia | comum | escudo de energia, vida % | funcional | validado | ficha | 2/2 |
| `1891` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `1909` | Dano Corpo a Corpo e Velocidade de Ataque com Duas Mãos | comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 0/3 |
| `1957` | Velocidade de Conjuração | comum | velocidades | funcional | validado | ficha | 1/1 |
| `2081` | Eficácia da Reserva de mana de Maldições | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `2092` | Dano Corpo a Corpo e Alcance de Golpes | comum | dano % (aumentado e "mais"), outros | funcional | aplicado | ficha | 1/2 |
| `2094` | Evasão e Vida | comum | armadura e evasão, vida % | funcional-aproximado | aplicado | ficha | 1/2 |
| `2121` | Velocidade de Ataque com Garras | comum | velocidades | funcional | validado | ficha | 1/1 |
| `2151` | Inteligência e Regeneração de Mana | comum | mana e custo, atributos (For/Des/Int) | funcional | validado | ficha | 2/2 |
| `2185` | Velocidade de Ataque com Arcos | comum | velocidades | funcional | validado | ficha | 1/1 |
| `2219` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `2225` | Olho de Águia | notavel | precisão, crítico, precisão % | funcional | validado | ficha | 3/3 |
| `2260` | Dano com Minas | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `2275` | Composto da Natureza | notavel | — | sem-efeito | alocavel | — | — |
| `2292` | Mana e Vida | comum | vida %, mana % | funcional | validado | ficha | 2/2 |
| `2311` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `2348` | Eficiência de Custo de Mana de Conexão | comum | — | sem-efeito | alocavel | — | — |
| `2355` | Defesas com Escudos | comum | armadura e evasão | funcional | aplicado | combate | 0/1 |
| `2392` | Dano e Bloqueio com Dupla Empunhadura | comum | bloqueio, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `2411` | Dano e Duração de Atordoamento de Maça | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 4/5 |
| `2413` | Queima de Mana mais Lenta | comum | — | sem-efeito | alocavel | — | — |
| `2454` | Dano Corpo a Corpo com Duas Mãos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `2474` | Vida Recuperada | comum | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `2491` | Encaixe de Joia Grande | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `2550` | Incendiário | notavel | afecções e chance no acerto, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `2599` | Resposta Pronta | notavel | — | sem-efeito | alocavel | — | — |
| `2715` | Passo Rápido | notavel | supressão de magia, velocidades | funcional | validado | ficha | 2/2 |
| `2785` | Duração de Maldições | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `2913` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `2959` | Temporada Gélida | notavel | afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `3009` | Precisão com Dupla Empunhadura | comum | precisão | funcional | aplicado | ficha | 0/1 |
| `3089` | Efeito dos Vínculos | comum | — | sem-efeito | alocavel | — | — |
| `3109` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `3167` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `3187` | Velocidade de Movimento e Supressão Mágica | comum | supressão de magia, velocidades | funcional | validado | ficha | 2/2 |
| `3309` | Pés Leves | notavel | armadura e evasão, velocidades, outros | funcional | aplicado | ficha | 2/3 |
| `3314` | Duração da Carga de Frenesi | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `3319` | Bloqueio com Escudos e Recuperação de Bloqueio | comum | bloqueio | parcial | validado | ficha | 1/1 |
| `3359` | Velocidade de Conjuração de Maldição | comum | velocidades | funcional | aplicado | combate | 0/1 |
| `3362` | Velocidade e Chance de Envenenar de Garra | comum | velocidades, afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `3398` | Resistência a Eletrização | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `3424` | Dano e Velocidade de Movimento de Garra | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `3452` | Previsão | notavel | escudo de energia | funcional | aplicado | ficha | 2/3 |
| `3469` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `3533` | Eficiência de Custo e Vida | comum | vida %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `3537` | Duração da Carga de Poder | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `3634` | Dreno de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `3644` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `3656` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `3676` | Cargas de Frasco Recebidas | comum | frascos | funcional | validado | combate | 1/1 |
| `3854` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `3863` | Multiplicador de Crítico e Duração de Veneno de Adaga | comum | crítico, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `3992` | Precisão | comum | precisão % | funcional | validado | ficha | 1/1 |
| `4011` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `4036` | Multiplicador de Crítico | comum | crítico | funcional | validado | ficha | 1/1 |
| `4105` | Vida e Recuperação ao Matar | comum | vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `4177` | Ajuda Espiritual | notavel | — | sem-efeito | alocavel | — | — |
| `4184` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `4207` | Janela de Oportunidade | notavel | afecções e chance no acerto | funcional-aproximado | aplicado | combate | 0/2 |
| `4219` | Evasão e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `4247` | Vida de Lacaios | comum | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `4269` | Dano contra Inimigos Marcados | comum | — | sem-efeito | alocavel | — | — |
| `4270` | Duração de Runas | comum | — | sem-efeito | alocavel | — | — |
| `4300` | Dano de Totens e Marcas, Velocidade de Posicionamento de Totens | comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 0/2 |
| `4336` | Dano com Espadas | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `4367` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `4378` | Dreno de Vida | comum | outros | funcional | validado | combate | 1/1 |
| `4397` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `4432` | Escudo de Energia | comum | escudo de energia | funcional | validado | ficha | 1/1 |
| `4481` | Forças da Natureza | notavel | penetração | funcional | aplicado | ficha | 0/1 |
| `4502` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `4546` | Velocidade de Detonação de Minas | comum | — | sem-efeito | alocavel | — | — |
| `4565` | Velocidade de Ataque com Dupla Empunhadura | comum | velocidades | funcional | validado | ficha | 1/1 |
| `4568` | Dano de Lacaio e Físico | comum | lacaios e totens, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `4573` | Evasão e Recuperação da Recarga de Habilidade de Movimento | comum | armadura e evasão, outros | funcional | aplicado | combate | 1/2 |
| `4656` | Supressão Mágica e Recuperação de Vida com Frascos | comum | supressão de magia, frascos | funcional | validado | ficha | 2/2 |
| `4713` | Multiplicador de Dano Incendiário | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `4750` | Velocidade e Dano com Totens | comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 0/2 |
| `4833` | Vigor | notavel | cargas e fúria | funcional | validado | ficha | 1/1 |
| `4854` | Hospício | notavel | resistências, auras, maldições e reserva | funcional | aplicado | ficha | 1/2 |
| `4918` | Vingança Indiscriminada | notavel | — | sem-efeito | alocavel | — | — |
| `4940` | Fendedor | notavel | dano % (aumentado e "mais"), afecções e chance no acerto, outros | funcional | aplicado | ficha | 2/4 |
| `4944` | Armadura, Evasão e Efeito de Agressividade | comum | armadura e evasão, outros | funcional | aplicado | combate | 2/3 |
| `4973` | Multiplicador de Dano Degenerativo | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `4977` | Dano e Chance de Crítico com Cajados | comum | crítico | funcional | validado | ficha | 2/2 |
| `5018` | Chance de Envenenar com Magias | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `5022` | Dano de Raio com Armas | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `5065` | Máximo de Resistência a Raio | comum | resistências | funcional | aplicado | combate | 0/1 |
| `5068` | Chance e Multiplicador de Crítico de Maça | comum | crítico | funcional | validado | ficha | 4/4 |
| `5103` | Ponto de Atordoamento | comum | atordoamento | funcional | aplicado | combate | 0/1 |
| `5126` | Triturador de Espinhas | notavel | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 4/5 |
| `5129` | Multiplicador de Dano Degenerativo | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `5152` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `5197` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `5203` | Duração do Atordoamento das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `5233` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `5237` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `5289` | Despertar de Batalha | notavel | mana %, outros | funcional | aplicado | ficha | 1/2 |
| `5296` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `5408` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `5430` | Golpes Magmáticos | notavel | — | sem-efeito | alocavel | — | — |
| `5456` | Poder | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `5462` | Área de Efeito com Cajados | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `5560` | Área de Efeito | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `5591` | Recarga do Escudo de Energia | comum | escudo de energia | funcional | validado | ficha | 1/1 |
| `5612` | Dano de Ataque Físico | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `5613` | Dano Físico e Velocidade de Ataque e Conjuração | comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 3/3 |
| `5616` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `5622` | Multiplicador de Dano Físico e Precisão em Dupla Empunhadura | comum | precisão, crítico | funcional | aplicado | ficha | 1/2 |
| `5629` | Dano da Garra | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `5632` | Sangramento e Chance de Golpe Crítico | comum | afecções e chance no acerto, crítico | funcional | validado | ficha | 2/2 |
| `5743` | Vida e Escudo de Energia | comum | escudo de energia, vida % | funcional | validado | ficha | 2/2 |
| `5802` | Dano com Adagas e Velocidade de Movimento | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `5823` | Coordenação | notavel | velocidades, atributos (For/Des/Int) | funcional-aproximado | validado | ficha | 4/4 |
| `5875` | Velocidade de Conjuração | comum | velocidades, crítico | funcional | aplicado | ficha | 1/2 |
| `5916` | Multiplicador de Dano Incendiário | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `5935` | Área de Efeito da Aura | comum | — | sem-efeito | alocavel | — | — |
| `5972` | Dano de Gelo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `6042` | Vida Ganha ao Acertar | comum | vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/1 |
| `6043` | Máximo de Resistência de Fogo | comum | resistências | funcional | aplicado | combate | 0/1 |
| `6108` | Chance e Multiplicador de Crítico da Espada | comum | crítico | funcional | validado | ficha | 2/2 |
| `6109` | Efeito de Maldições | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `6113` | Dano de Machado | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `6139` | Ganho de Fortificações | comum | — | sem-efeito | alocavel | — | — |
| `6204` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `6230` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `6233` | Ondas Explosivas | notavel | — | sem-efeito | alocavel | — | — |
| `6237` | Precisão | notavel | velocidades, atributos (For/Des/Int), precisão % | funcional | validado | ficha | 4/4 |
| `6245` | Chance de Incendiar | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `6250` | Velocidade de Conjuração de Maldição | comum | velocidades | funcional | aplicado | combate | 0/1 |
| `6264` | Efeito de Tinturas | comum | — | sem-efeito | alocavel | — | — |
| `6289` | Sem Sangue | notavel | vida % | parcial | validado | ficha | 1/1 |
| `6359` | Armadura e Vida | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `6363` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `6383` | Supressão Mágica e Recuperação de Vida com Frascos | comum | supressão de magia, frascos | funcional | validado | ficha | 2/2 |
| `6446` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `6534` | Evasão e Supressão Mágica | comum | supressão de magia, armadura e evasão | funcional | validado | ficha | 2/2 |
| `6538` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `6542` | Evasão | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `6580` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `6615` | Golpes Arqueados | notavel | penetração, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `6616` | Velocidade de Conjuração em Dupla Empunhadura e Recuperação da Recarga de Habilidades de Movimento | comum | velocidades, outros | funcional | aplicado | ficha | 1/2 |
| `6633` | Dano de Ataque e Área de Efeito com Maças | comum | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 4/5 |
| `6654` | Dano do Arco e Chance de Golpes Críticos | comum | dano % (aumentado e "mais"), crítico | funcional | aplicado | ficha | 2/3 |
| `6685` | Velocidade de Ataque e Conjuração de Lacaios | comum | velocidades | funcional | aplicado | combate | 0/2 |
| `6712` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `6718` | Resistências Elementais | comum | resistências | funcional | validado | ficha | 3/3 |
| `6741` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `6764` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `6770` | Guarda Arcana | notavel | bloqueio, escudo de energia | funcional | aplicado | ficha | 0/2 |
| `6783` | Espetos Selvagens | notavel | outros | funcional | aplicado | combate | 0/1 |
| `6785` | Dano de Fogo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `6797` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `6799` | Carisma | notavel | auras, maldições e reserva | funcional | aplicado | combate | 0/2 |
| `6884` | Dano Corpo a Corpo e Velocidade de Drenagem de Vida com Duas Mãos | comum | dano % (aumentado e "mais"), outros | funcional | aplicado | ficha | 1/3 |
| `6910` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `6913` | Dano do Arco e Chance de Golpes Críticos | comum | dano % (aumentado e "mais"), crítico | funcional | aplicado | ficha | 2/3 |
| `6949` | Escudo de Energia e Recuperação | comum | escudo de energia | funcional | validado | ficha | 2/2 |
| `6967` | Garantia | notavel | efeito por evento, bloqueio | parcial | aplicado | ficha | 1/3 |
| `6981` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `7069` | Tiro Partido | notavel | — | sem-efeito | alocavel | — | — |
| `7082` | Dano da Espada | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `7085` | Arte da Arma | notavel | bloqueio, velocidades, outros | funcional-aproximado | aplicado | ficha | 3/4 |
| `7092` | Dano Físico e de Raio | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `7112` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `7136` | Mestre Sabotador | notavel | dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/1 |
| `7153` | Dano de Raio | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `7162` | Armadura e Resistências Elementais | comum | armadura e evasão, resistências | funcional | validado | ficha | 4/4 |
| `7187` | Multiplicador de Dano Incendiário com Ataques | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `7263` | Venenos Velozes | notavel | afecções e chance no acerto, velocidades | funcional-aproximado | validado | ficha | 2/2 |
| `7285` | Eficiência de Custo de Ataque | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `7335` | Armadura e Regeneração de Vida | comum | armadura e evasão, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `7347` | Bloqueio Mágico com Cajados | comum | bloqueio | funcional | aplicado | ficha | 0/1 |
| `7364` | Área de Efeito com Cajados | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `7374` | Eficiência de Custo e Vida | comum | vida %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `7388` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `7399` | Resistência a Raio | comum | resistências | funcional | validado | ficha | 1/1 |
| `7440` | Ceifador de Inimigos | notavel | dano % (aumentado e "mais"), outros | funcional | aplicado | ficha | 2/3 |
| `7444` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `7503` | Recarga do Escudo de Energia | comum | escudo de energia | funcional | validado | ficha | 1/1 |
| `7555` | Velocidade Crepitante | notavel | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `7594` | Eficácia da Reserva | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `7609` | Ângulo Bifurcado | comum | — | sem-efeito | alocavel | — | — |
| `7614` | Duração da Habilidade | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `7641` | Escudo de Energia e Velocidade da Recarga de Escudo de Energia | comum | escudo de energia | funcional | aplicado | ficha | 1/2 |
| `7659` | Eficiência de Custo de Mana de Marcas | comum | — | sem-efeito | alocavel | — | — |
| `7688` | Vínculo Duradouro | notavel | afecções e chance no acerto, lacaios e totens | funcional | aplicado | combate | 0/3 |
| `7728` | Duração dos Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `7786` | Velocidade de Ataque do Totem | comum | lacaios e totens | funcional | aplicado | combate | 0/1 |
| `7828` | Velocidade de Ataques Corpo a Corpo | comum | velocidades | funcional | validado | combate | 1/1 |
| `7898` | Chance de Golpe Crítico de Lacaios | comum | — | sem-efeito | alocavel | — | — |
| `7903` | Bloqueio | comum | bloqueio | funcional | validado | ficha | 2/2 |
| `7918` | Defesa Enigmática | notavel | dano % (aumentado e "mais"), bloqueio | funcional | aplicado | ficha | 1/3 |
| `7920` | Velocidade de Arremesso de Armadilhas e Minas | comum | velocidades | funcional | aplicado | combate | 0/2 |
| `7938` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `7956` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `7960` | Encaixe de Joia Grande | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `8001` | Ladrão Inteligênte | notavel | vida, regeneração e dreno de vida, mana e custo | funcional | aplicado | ficha | 1/2 |
| `8012` | Vida e Mana ao Acertar | comum | vida, regeneração e dreno de vida, mana e custo | funcional | aplicado | ficha | 0/2 |
| `8027` | Chance e Multiplicador de Golpes Críticos com Minas | comum | crítico | funcional | aplicado | ficha | 0/2 |
| `8135` | Aplicação Prática | notavel | resistências, atributos (For/Des/Int) | parcial | validado | ficha | 5/5 |
| `8139` | Velocidade de Conjuração dos Vínculos | comum | — | sem-efeito | alocavel | — | — |
| `8198` | Chance de Incendiar, Congelar e Eletrizar | comum | afecções e chance no acerto | funcional | validado | ficha | 3/3 |
| `8302` | Duração da Carga de Poder | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `8348` | Evasão e Supressão Mágica | comum | supressão de magia, armadura e evasão | funcional | validado | ficha | 2/2 |
| `8410` | Velocidade de Ataque na Postura de Areia | comum | — | sem-efeito | alocavel | — | — |
| `8426` | Dano e Limite de Atordoamento Inimigo Reduzido Corpo a Corpo com Duas Mãos | comum | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 1/3 |
| `8458` | Tiro Longo | notavel | velocidades | parcial | aplicado | combate | 0/1 |
| `8500` | Dano e Duração do Atordoamento com Maças | comum | dano % (aumentado e "mais"), atordoamento | funcional | validado | ficha | 5/5 |
| `8533` | Dano Corpo a Corpo com Duas Mãos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `8544` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `8566` | Dano Físico com Arcos e Ponto de Atordoamento | comum | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 2/3 |
| `8620` | Cargas de Frasco contra Inimigos Marcados | comum | — | sem-efeito | alocavel | — | — |
| `8624` | Duração e Chance de Incendiar | comum | afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `8640` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `8643` | Velocidade de Conjuração | comum | velocidades | funcional | validado | ficha | 1/1 |
| `8833` | Coração de Gelo | notavel | dano % (aumentado e "mais"), penetração | funcional | aplicado | ficha | 1/2 |
| `8879` | Dano de Fogo da Arma | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `8904` | Duração de Clamores | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `8920` | Apunhalada | notavel | crítico | funcional | aplicado | ficha | 2/3 |
| `8930` | Vida e Frascos | comum | vida %, frascos | funcional | validado | ficha | 2/2 |
| `8938` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `8948` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `9009` | Velocidade de Movimento | comum | velocidades | funcional | validado | ficha | 1/1 |
| `9015` | Tormento Horrível | notavel | crítico | funcional | validado | ficha | 2/2 |
| `9052` | Bloqueio | comum | bloqueio | funcional | validado | ficha | 2/2 |
| `9055` | Minas Voláteis | notavel | — | sem-efeito | alocavel | — | — |
| `9149` | Resistência a Resfriamento e Congelamento | comum | afecções e chance no acerto | funcional | aplicado | combate | 1/2 |
| `9171` | Velocidade do Dreno de Vida | comum | outros | funcional | validado | combate | 1/1 |
| `9194` | Espetada Impiedosa | notavel | afecções e chance no acerto, outros | funcional | aplicado | combate | 0/2 |
| `9206` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `9261` | Discípulo do Proibido | notavel | cargas e fúria, dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/3 |
| `9262` | Dano com Espadas e Alcance Corpo a Corpo | comum | dano % (aumentado e "mais") | parcial | validado | ficha | 2/2 |
| `9294` | Dano de Lacaio e Físico | comum | lacaios e totens, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `9355` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `9361` | Máximo de Fúria | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `9370` | Velocidade de Ataque e Conjuração de Lacaios | comum | velocidades | funcional | aplicado | combate | 0/2 |
| `9373` | Mana e Efeito de Frascos | comum | mana %, frascos | funcional | aplicado | ficha | 1/2 |
| `9386` | Vida e Escudo de Energia | comum | escudo de energia, vida % | funcional | validado | ficha | 2/2 |
| `9392` | Efeito da Aura | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `9402` | Bloqueio | comum | bloqueio | funcional | validado | ficha | 2/2 |
| `9408` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `9432` | Rapidez Mental | notavel | velocidades, mana e custo | funcional | validado | ficha | 2/2 |
| `9469` | Chance de Crítico | comum | crítico | funcional | validado | ficha | 1/1 |
| `9505` | Dano dos Lacaios | comum | lacaios e totens | funcional | validado | combate | 1/1 |
| `9511` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `9535` | Estratégia do Caçador | notavel | afecções e chance no acerto, dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/3 |
| `9567` | Devorador da Luz | notavel | escudo de energia, dano % (aumentado e "mais") | funcional | aplicado | combate | 0/3 |
| `9650` | Dano de Vida de Lacaios | comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `9695` | Armadura e Resistências Elementais | comum | armadura e evasão, resistências | funcional | validado | ficha | 4/4 |
| `9769` | Supressão Mágica e Recarga do Escudo de Energia | comum | supressão de magia, escudo de energia | funcional | validado | ficha | 2/2 |
| `9786` | Evasão e Velocidade de Movimento | comum | armadura e evasão, velocidades | funcional | validado | ficha | 2/2 |
| `9788` | Vivacidade | notavel | velocidades, crítico | funcional | aplicado | ficha | 1/2 |
| `9797` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `9864` | Crescer e Apodrecer | notavel | afecções e chance no acerto, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `9877` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `9933` | Efeito de Marcas | comum | — | sem-efeito | alocavel | — | — |
| `9976` | Dano com Machados | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `9995` | Área de Efeito da Aura | comum | — | sem-efeito | alocavel | — | — |
| `10016` | Executor | notavel | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 1/2 |
| `10017` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `10031` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `10073` | Armadura e Recuperação da Recarga de Habilidades de Guarda | comum | armadura e evasão | parcial | validado | combate | 1/1 |
| `10115` | Perfeição Pródiga | notavel | mana % | parcial | validado | ficha | 1/1 |
| `10153` | Físico | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `10221` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `10282` | Dano Corpo a Corpo com Uma Mão | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `10311` | Efeito da Aura dos Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `10490` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `10511` | Tolerância | notavel | resistências, outros | funcional | aplicado | ficha | 1/3 |
| `10532` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `10542` | Baluarte de Espinhos | notavel | armadura e evasão, outros | funcional | aplicado | combate | 1/2 |
| `10555` | Duração do Vínculo | comum | — | sem-efeito | alocavel | — | — |
| `10575` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `10594` | Efeito do Buff de Clamores | comum | outros | funcional | aplicado | combate | 0/1 |
| `10643` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `10661` | Reflexos de Ferro | keystone | — | funcional | aplicado | combate | — |
| `10763` | Chance de Crítico | comum | crítico | funcional | validado | ficha | 1/1 |
| `10808` | Pacto Vaal | keystone | outros | funcional | validado | combate | 2/2 |
| `10829` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `10835` | Sonhador | notavel | mana e custo | funcional | aplicado | ficha | 1/2 |
| `10840` | Eficiência de Custo de Ataque | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `10843` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `10851` | Dano com Escudos | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `10893` | Dano de Fogo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `10904` | Vida de Lacaios | comum | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `10989` | Dano e Ponto de Atordoamento com Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `10992` | Área de Efeito de Feitiços | comum | — | sem-efeito | alocavel | — | — |
| `11016` | Dano Físico e Elemental | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 4/4 |
| `11018` | Evasão e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `11088` | Eficiência de Custo e Vida | comum | vida %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `11128` | Anulação de Interrupções durante a Conjuração e Resistências Elementais | comum | resistências | parcial | validado | ficha | 3/3 |
| `11150` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `11162` | Multiplicador de Dano de Gelo Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `11190` | Vida e Resistências Elementais de Totens | comum | vida, regeneração e dreno de vida, resistências | funcional | aplicado | combate | 0/2 |
| `11200` | Vida do Cadáver | comum | — | sem-efeito | alocavel | — | — |
| `11239` | Dançarino do Vento | keystone | — | sem-efeito | alocavel | — | — |
| `11334` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `11364` | Afecções Rápidas | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `11420` | Domínio do Ocultista | notavel | dano % (aumentado e "mais"), velocidades, atributos (For/Des/Int) | funcional | aplicado | ficha | 2/3 |
| `11431` | Vida e Dano de Totens | comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/2 |
| `11455` | Inoculação do Caos | keystone | — | sem-efeito | alocavel | — | — |
| `11456` | Recuperação da Recarga de Habilidades de Postura | comum | — | sem-efeito | alocavel | — | — |
| `11489` | Chance e Multiplicador de Crítico de Adaga | comum | crítico | funcional | validado | ficha | 2/2 |
| `11497` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `11515` | Dano Corpo a Corpo e Área de Efeito com Duas Mãos | comum | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 0/3 |
| `11551` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `11568` | Multiplicador de Dano com Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `11645` | Sopro Trovejante | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `11651` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `11659` | Anulação de Interrupções durante a Conjuração e Resistências Elementais | comum | resistências | parcial | validado | ficha | 3/3 |
| `11678` | Dano de Projéteis | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `11688` | Dano Mágico | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `11689` | Dano e Bloqueio Mágico com Escudos | comum | bloqueio, dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `11700` | Área de Efeito Corpo a Corpo | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `11716` | Multiplicador de Golpes Críticos de Minas | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `11730` | Tolerância | notavel | cargas e fúria | funcional | validado | ficha | 1/1 |
| `11784` | Vampirismo | notavel | vida, regeneração e dreno de vida | funcional | aplicado | combate | 1/2 |
| `11792` | Duração de Clamores | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `11800` | Mana ao Matar com Tinturas | comum | — | sem-efeito | alocavel | — | — |
| `11811` | Chance e Duração dos Envenenamentos | comum | afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `11820` | Carne Ungida | notavel | resistências, afecções e chance no acerto | funcional | aplicado | combate | 3/6 |
| `11850` | Duração da Cegueira | comum | — | sem-efeito | alocavel | — | — |
| `11859` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `11924` | Sopro Flamejante | notavel | afecções e chance no acerto, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `11984` | Chance de Envenenar com Magias | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `12032` | Velocidade de Conjuração e Eficiência de Custo de Mana de Magias | comum | velocidades | parcial | validado | ficha | 1/1 |
| `12033` | Lâmina Perversa | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 0/2 |
| `12068` | Dano com Arcos e Velocidade de Ataque | comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 2/3 |
| `12095` | Velocidade de Ataque e Bloqueio com Empunhadura Dupla | comum | bloqueio, velocidades | funcional | validado | ficha | 2/2 |
| `12128` | Geada Cortante | keystone | — | sem-efeito | alocavel | — | — |
| `12143` | Influência | notavel | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `12161` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `12189` | Velocidade de Conjuração | comum | velocidades, crítico | funcional | aplicado | ficha | 1/2 |
| `12215` | Sangramento Agravado na Chance de Golpe Crítico | comum | — | sem-efeito | alocavel | — | — |
| `12236` | Dano de Ataques com Escudo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `12246` | Escudo de Energia | comum | escudo de energia | funcional | aplicado | combate | 0/1 |
| `12247` | Eficiência de Custo de Ataque | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `12250` | Escudo de Energia e Mana | comum | escudo de energia, mana % | funcional | validado | ficha | 2/2 |
| `12379` | Dano de Raio e Velocidade de Conjuração | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `12407` | Dano e Velocidade de Ataque do Machado | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `12412` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `12415` | Chance de Incêndio com Ataques e Velocidade de Ataque | comum | velocidades, afecções e chance no acerto | funcional-aproximado | aplicado | ficha | 1/2 |
| `12439` | Dano de Gelo e Chance de Congelar | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `12536` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `12613` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `12664` | Sangramento Rápido | comum | outros | funcional | aplicado | ficha | 0/1 |
| `12702` | Caminho do Guerreiro | notavel | armadura e evasão, atributos (For/Des/Int), dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 2/3 |
| `12720` | Dano e Bloqueio da Espada | comum | bloqueio, dano % (aumentado e "mais") | funcional | validado | ficha | 4/4 |
| `12783` | Multiplicador de Golpes Críticos por Carga de Poder | comum | crítico | funcional | aplicado | combate | 0/1 |
| `12794` | Chance e Multiplicador de Crítico com Ataques de Projéteis | comum | crítico | funcional | validado | ficha | 2/2 |
| `12795` | Versatilidade | notavel | velocidades, atributos (For/Des/Int), precisão % | funcional | validado | ficha | 4/4 |
| `12801` | Evasão e Vida | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `12809` | Freneticismo | notavel | velocidades, cargas e fúria | funcional-aproximado | validado | ficha | 2/2 |
| `12824` | Dano com Armadilhas | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `12831` | Chance de Congelamento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `12852` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `12878` | Retaliação | notavel | dano % (aumentado e "mais"), velocidades, armadura e evasão | funcional | aplicado | ficha | 2/3 |
| `12888` | Regeneração de Mana por Carga de Poder | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `12913` | Mana | comum | mana e custo, mana % | funcional | aplicado | ficha | 1/2 |
| `12926` | Empunhadura de Ferro | keystone | área e projéteis | funcional | validado | combate | 1/1 |
| `12948` | Multiplicador e Chance de Golpes Críticos com Arcos | comum | crítico | funcional | validado | ficha | 2/2 |
| `13009` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `13019` | Lâmina Ensanguentada | keystone | — | sem-efeito | alocavel | — | — |
| `13164` | Julgamento Divino | notavel | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `13168` | Dano de Envenenamento e Velocidade de Conjuração | comum | velocidades, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `13170` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `13191` | Duração de Habilidade | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `13201` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `13202` | Dano de Gelo e Efeito de Afecções de Gelo | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `13231` | Velocidade de Ataque com Arcos e Trespassar | comum | velocidades, efeito por evento | funcional | aplicado | ficha | 1/2 |
| `13232` | Aumento do Dreno de Escudo de Energia | comum | escudo de energia | funcional | aplicado | combate | 0/1 |
| `13273` | Chance de Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `13322` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `13375` | Multi-tiro | notavel | área e projéteis | funcional | aplicado | combate | 0/1 |
| `13498` | Chance de Empalamentos | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `13559` | Multiplicador de Dano Incendiário | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `13573` | Dupla Empunhadura e Velocidade de Conjuração e Bloqueio | comum | bloqueio, velocidades | funcional | validado | ficha | 3/3 |
| `13703` | Postura Desafiadora | notavel | — | sem-efeito | alocavel | — | — |
| `13714` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `13753` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `13782` | Dano Físico | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 1/1 |
| `13807` | Dano e Velocidade de Ataque com Dupla Empunhadura | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `13885` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `13922` | Firme | notavel | — | sem-efeito | alocavel | — | — |
| `13935` | Calor da Batalha | notavel | mana e custo | funcional | aplicado | ficha | 0/2 |
| `13961` | Efeito de Afecções de Raio | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `13965` | Queima de Mana mais Lenta | comum | — | sem-efeito | alocavel | — | — |
| `14001` | Invencível | notavel | atordoamento | parcial | aplicado | combate | 0/1 |
| `14021` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `14040` | Dano de Fogo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `14056` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `14057` | Vida e Escudo de Energia | comum | escudo de energia, vida % | funcional | validado | ficha | 2/2 |
| `14090` | Duração de Habilidades Reduzida | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `14151` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `14157` | Chance de Crítico com Adagas | comum | crítico | funcional | validado | ficha | 1/1 |
| `14182` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `14209` | Duração de Afecções de Gelo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `14211` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `14292` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `14384` | Máximo de Fortificações | comum | — | sem-efeito | alocavel | — | — |
| `14400` | Duração do Efeito de Frascos | comum | frascos | funcional | validado | combate | 1/1 |
| `14419` | Dano de Fogo da Arma | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `14606` | Carnificina | notavel | dano % (aumentado e "mais"), velocidades, atributos (For/Des/Int) | funcional | aplicado | ficha | 1/4 |
| `14665` | Ira Divina | notavel | conversão / dano extra, penetração | funcional | aplicado | ficha | 0/2 |
| `14745` | Área de Efeito com Magias | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `14767` | Duração de Fortificações | comum | — | sem-efeito | alocavel | — | — |
| `14804` | Chance de Crítico com Ataques de Projéteis | comum | crítico | funcional | validado | ficha | 1/1 |
| `14813` | Pândega | notavel | mana e custo, mana % | parcial | aplicado | ficha | 1/2 |
| `14930` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `14936` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `14993` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `15021` | Bloqueio e Resistências Elementais com Escudos | comum | bloqueio, resistências | funcional | validado | ficha | 4/4 |
| `15027` | Músculo | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `15046` | Redenção | notavel | lacaios e totens, velocidades | funcional | aplicado | combate | 1/3 |
| `15064` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `15073` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `15081` | Dano e Duração de Lacaios | comum | lacaios e totens | funcional | aplicado | combate | 1/2 |
| `15085` | Ambidestria | notavel | — | sem-efeito | alocavel | — | — |
| `15086` | Chance de Crítico e Dano de Maça | comum | dano % (aumentado e "mais"), crítico | funcional | validado | ficha | 6/6 |
| `15117` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `15124` | Efeito de Empalar | comum | outros | funcional | aplicado | combate | 0/1 |
| `15144` | Velocidade de Ataque e Destreza | comum | velocidades, atributos (For/Des/Int) | funcional-aproximado | validado | ficha | 2/2 |
| `15163` | Dano de Ataque e Área de Efeito com Maças | comum | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 4/5 |
| `15167` | Vida e Efeito do Bônus de Golens | comum | lacaios e totens | parcial | aplicado | combate | 0/1 |
| `15226` | Retaliação Cruel | notavel | — | sem-efeito | alocavel | — | — |
| `15228` | Multiplicador de Crítico | comum | crítico | funcional | validado | ficha | 1/1 |
| `15290` | Torres de Vigílha | notavel | dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/1 |
| `15344` | Liberdade de Movimento | notavel | armadura e evasão, velocidades, atributos (For/Des/Int) | funcional | aplicado | ficha | 1/3 |
| `15365` | Área de Efeito | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `15400` | Runas Escorregadias | notavel | auras, maldições e reserva | parcial | aplicado | combate | 0/1 |
| `15405` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `15437` | Deflexão | notavel | bloqueio, cargas e fúria | funcional | aplicado | ficha | 1/2 |
| `15438` | Dano e Duração de Atordoamento Corpo a Corpo com Duas Mãos | comum | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 0/3 |
| `15451` | Velocidade de Clamores | comum | velocidades | funcional-aproximado | aplicado | combate | 0/1 |
| `15452` | Multiplicador de Dano de Magia Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `15491` | Dano das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `15522` | Máximo de Resistência a Raio | comum | resistências | funcional | aplicado | combate | 0/1 |
| `15543` | Máximo de Fúria e Armadura | comum | armadura e evasão, cargas e fúria | funcional | validado | combate | 2/2 |
| `15549` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `15599` | Precisão, Velocidade de Ataque e Conjuração | comum | precisão, velocidades | funcional | validado | ficha | 3/3 |
| `15614` | Garras do Gavião | notavel | crítico | funcional | validado | ficha | 2/2 |
| `15631` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `15678` | Multiplicador de Crítico Corpo a Corpo | comum | crítico | funcional | validado | ficha | 1/1 |
| `15711` | Raio da Explosão | notavel | área e projéteis, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `15716` | Chance e Multiplicador de Crítico com Cajados | comum | crítico | funcional | validado | ficha | 2/2 |
| `15727` | Chance de Incêndio com Ataques | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `15783` | Efeito de Chão Consagrado | comum | — | sem-efeito | alocavel | — | — |
| `15837` | Anulação de Afecções de Status | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `15842` | Um Com a Natureza | notavel | resistências, crítico, dano % (aumentado e "mais") | funcional | validado | ficha | 7/7 |
| `15852` | Banquete Etéreo | notavel | escudo de energia | funcional | aplicado | combate | 0/2 |
| `15868` | Vida e Armadura | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `15880` | Área de Efeito de Ataque e Precisão | comum | área e projéteis, precisão % | funcional | aplicado | ficha | 1/2 |
| `15973` | Dano e Duração de Runas | comum | dano % (aumentado e "mais") | parcial | validado | ficha | 1/1 |
| `16079` | Evasão Por Carga de Frenesi | comum | armadura e evasão | funcional | aplicado | combate | 0/1 |
| `16113` | Bloqueio com Cajados | comum | bloqueio | funcional | aplicado | ficha | 1/2 |
| `16167` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `16213` | Velocidade de Ataque por Carga de Frenesi | comum | velocidades | funcional | aplicado | combate | 0/1 |
| `16218` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `16236` | Golpes Tóxicos | notavel | afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `16243` | Fuzilaria | notavel | velocidades, precisão | funcional | aplicado | ficha | 1/2 |
| `16245` | Duração da Usabilidade das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `16380` | Precisão e Chance de Crítico | comum | crítico, precisão % | funcional | validado | ficha | 2/2 |
| `16544` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `16602` | Duração de Frascos e Frascos de Vida | comum | frascos | funcional | validado | combate | 2/2 |
| `16703` | Quebra-Crânio | notavel | dano % (aumentado e "mais"), atordoamento | funcional | validado | ficha | 6/6 |
| `16743` | Dupla Empunhadura e Velocidade de Movimento | comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 1/2 |
| `16754` | Chance de Crítico de Cajado | comum | crítico | funcional | validado | ficha | 1/1 |
| `16756` | Dano e Chance de Empalar com Machados | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 2/3 |
| `16775` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `16790` | Chance de Crítico Mágico | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `16851` | Dano e Precisão de Arco | comum | dano % (aumentado e "mais"), precisão | funcional | aplicado | ficha | 1/3 |
| `16860` | Dano de Ataques Físicos | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `16882` | Duração do Efeito de Frascos | comum | frascos | funcional | validado | combate | 1/1 |
| `16954` | Chance de Golpes Críticos por Carga de Poder | comum | crítico | funcional | aplicado | combate | 0/1 |
| `16970` | Dano se Consumiu um Cadáver | comum | dano % (aumentado e "mais") | funcional | interpretado | condicional | 0/1 |
| `17020` | Dano de Ataque na Postura de Sangue | comum | — | sem-efeito | alocavel | — | — |
| `17038` | Duração do Atordoamento | comum | atordoamento | funcional | validado | combate | 1/1 |
| `17171` | Congelamento Imediato | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 3/3 |
| `17201` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `17219` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `17236` | Escudo de Energia e Velocidade da Recarga de Escudo de Energia | comum | escudo de energia | funcional | aplicado | ficha | 1/2 |
| `17251` | Armadura e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `17352` | Mana e Vida | comum | vida %, mana % | funcional | validado | ficha | 2/2 |
| `17383` | Mana e Área de Efeito de Aura | comum | mana % | parcial | validado | ficha | 1/1 |
| `17412` | Dano e Precisão do Lacaio | comum | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `17421` | Mana e Cargas de Frasco Recebidas | comum | mana %, frascos | funcional | validado | ficha | 2/2 |
| `17429` | Chance de Empalamento e Velocidade de Ataque | comum | velocidades, afecções e chance no acerto | funcional-aproximado | aplicado | ficha | 1/2 |
| `17527` | Bloqueio | comum | bloqueio | funcional | validado | ficha | 2/2 |
| `17546` | Mana e Frascos | comum | mana %, frascos | funcional | aplicado | ficha | 1/2 |
| `17566` | Armadura e Evasão | comum | armadura e evasão, resistências | funcional | validado | ficha | 5/5 |
| `17569` | Chance de Crítico com Totens | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `17579` | Dano Mágico | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `17608` | Passos Silenciosos | notavel | armadura e evasão, outros | funcional | aplicado | combate | 1/2 |
| `17674` | Dano Físico | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 1/1 |
| `17735` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `17749` | Recuperação de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `17788` | Cargas de Frasco Recebidas | comum | frascos | funcional | validado | combate | 1/1 |
| `17790` | Cargas de Frasco Recebidas | comum | frascos | funcional | validado | combate | 1/1 |
| `17814` | Evasão e Supressão Mágica | comum | supressão de magia, armadura e evasão | funcional | validado | ficha | 2/2 |
| `17818` | Dança Carmesim | keystone | outros | parcial | validado | ficha | 2/2 |
| `17821` | Vida e Regeneração de Mana | comum | vida %, mana e custo | funcional | validado | ficha | 2/2 |
| `17833` | Dano e Multiplicador de Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `17849` | Dano da Mina | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `17908` | Dano e Velocidade de Ataque da Garra | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `17934` | Dano de Ataques e Velocidade | comum | dano % (aumentado e "mais"), velocidades | funcional-aproximado | validado | ficha | 3/3 |
| `18009` | Dano Corpo a Corpo e Alcance de Golpes | comum | dano % (aumentado e "mais"), outros | funcional | aplicado | ficha | 1/2 |
| `18025` | Batidas Fortes | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `18033` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `18103` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `18174` | Bastião Místico | notavel | bloqueio | parcial | aplicado | ficha | 0/1 |
| `18182` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `18202` | Fúria ao Acertar | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `18208` | Efeito de Chão Consagrado e Precisão | comum | precisão % | parcial | validado | ficha | 1/1 |
| `18239` | Dano de Magia e Recuperação contra Atordoamento | comum | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 0/2 |
| `18302` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `18357` | Agilidade Felina | notavel | bloqueio, velocidades | funcional | validado | ficha | 2/2 |
| `18359` | Bloqueio de Lacaios | comum | bloqueio | funcional | aplicado | combate | 0/1 |
| `18361` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `18379` | Multiplicador e Chance de Crítico de Maça | comum | crítico | funcional | validado | ficha | 4/4 |
| `18402` | Vida e Frascos | comum | vida %, frascos | funcional | validado | ficha | 2/2 |
| `18436` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `18661` | Dano de Minas e Eficácia da Reserva | comum | dano % (aumentado e "mais"), auras, maldições e reserva | funcional | aplicado | ficha | 0/2 |
| `18663` | Instabilidade do Lacaio | keystone | — | sem-efeito | alocavel | — | — |
| `18670` | Dano Elemental com Armas | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `18703` | Ataque Gracioso | notavel | outros, efeito por evento, armadura e evasão | funcional | aplicado | combate | 0/4 |
| `18707` | Perfeccionista | notavel | velocidades, atordoamento | funcional | aplicado | ficha | 1/3 |
| `18715` | Dano de Fogo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `18747` | Recuperação de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `18756` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `18767` | Escudo de Energia e Mana | comum | escudo de energia, mana % | funcional | validado | ficha | 2/2 |
| `18769` | Escrito em Sangue | notavel | escudo de energia, vida %, atributos (For/Des/Int) | funcional | validado | ficha | 3/3 |
| `18770` | Supressão Mágica | comum | supressão de magia | funcional | validado | ficha | 1/1 |
| `18865` | Fusão | notavel | vida %, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `18866` | Velocidade de Conjuração | comum | velocidades | funcional | validado | ficha | 1/1 |
| `18901` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `18990` | Bloqueio com Cajados | comum | bloqueio | funcional | aplicado | ficha | 1/2 |
| `19008` | Dano e Bloqueio Mágico com Escudos | comum | bloqueio, dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `19069` | Pele Grossa | notavel | vida %, afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `19098` | Danod e Raio com Varinhas | comum | — | sem-efeito | alocavel | — | — |
| `19103` | Exército da Justiça | notavel | vida, regeneração e dreno de vida, lacaios e totens | funcional | aplicado | ficha | 2/3 |
| `19144` | Sentinela | notavel | armadura e evasão, resistências | funcional | validado | ficha | 5/5 |
| `19196` | Eficácia da Reserva | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `19210` | Dano Físico e Redução de Dano Físico Ignorada | comum | outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `19228` | Dano de Afecções e Chance de Envenenar com Garras | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `19261` | Recuperação da Recarga de Clamores | comum | — | sem-efeito | alocavel | — | — |
| `19287` | Vida e Vida ao Matar | comum | vida %, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `19374` | Escudo de Energia | comum | escudo de energia | funcional | aplicado | ficha | 1/2 |
| `19388` | Dano e Precisão de Machado | comum | dano % (aumentado e "mais"), precisão | funcional | aplicado | ficha | 2/3 |
| `19401` | Vida Ganha ao Acertar | comum | vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/1 |
| `19501` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `19506` | Caminho do Caçador | notavel | precisão, dano % (aumentado e "mais"), atributos (For/Des/Int) | funcional | validado | ficha | 3/3 |
| `19609` | Multiplicador de Dano Físico Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `19635` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `19679` | Alcance de Runas e Recuperação da Recarga de Runas | comum | — | sem-efeito | alocavel | — | — |
| `19711` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `19730` | Golpe Certeiro | notavel | dano % (aumentado e "mais") | parcial | validado | ficha | 1/1 |
| `19732` | O Agnóstico | keystone | — | sem-efeito | alocavel | — | — |
| `19782` | Defesas com Escudo | comum | armadura e evasão | funcional | aplicado | combate | 0/1 |
| `19794` | Força Concussiva | notavel | — | sem-efeito | alocavel | — | — |
| `19858` | Herborismo | notavel | vida % | parcial | validado | ficha | 1/1 |
| `19884` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `19897` | Sintonia Mortal | notavel | lacaios e totens | funcional | validado | combate | 3/3 |
| `19919` | Bloqueio Mágico | comum | bloqueio | funcional | aplicado | ficha | 0/2 |
| `19939` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `19958` | Velocidade de Conjuração dos Vínculos | comum | — | sem-efeito | alocavel | — | — |
| `20010` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `20018` | Dano de Machado | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `20127` | Multiplicador de Dano com Venenos | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `20142` | Multiplicador de Crítico com Totens | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `20167` | Dano de Afecções e Chance de Envenenar com Adagas | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `20228` | Vida e Regeneração de Mana | comum | vida, regeneração e dreno de vida, mana e custo | funcional | validado | ficha | 2/2 |
| `20261` | Meditação Contemplativa | notavel | auras, maldições e reserva, mana e custo | funcional | aplicado | combate | 0/2 |
| `20310` | Bloqueio | comum | bloqueio | funcional | validado | ficha | 2/2 |
| `20402` | Eficiência de Custo de Ataque | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `20467` | Chance e Multiplicador de Crítico de Maça | comum | crítico | funcional | validado | ficha | 4/4 |
| `20528` | Instabilidade | notavel | cargas e fúria | funcional | validado | ficha | 1/1 |
| `20546` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `20551` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `20807` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `20812` | Evasão e Supressão Mágica | comum | supressão de magia, armadura e evasão | funcional | validado | ficha | 2/2 |
| `20832` | Santuário | notavel | bloqueio, resistências | funcional | aplicado | ficha | 1/5 |
| `20835` | Diplomacia Arriscada | notavel | área e projéteis | funcional | aplicado | combate | 0/1 |
| `20844` | Velocidade de Ataque e Precisão da Varinha | comum | velocidades, precisão | funcional | aplicado | ficha | 1/2 |
| `20852` | Dano de Fogo e Gelo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `20913` | Fúria ao Acertar | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `20953` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `20966` | Dano da Maça | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 4/4 |
| `20987` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `21019` | Efeito de Tinturas | comum | — | sem-efeito | alocavel | — | — |
| `21033` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `21048` | Duração do Vínculo | comum | — | sem-efeito | alocavel | — | — |
| `21075` | Dano de Área de Efeito | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `21170` | Efeito de Resfriamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `21184` | Prevenção de Interrupções enquanto Conjurando | comum | — | sem-efeito | alocavel | — | — |
| `21210` | Arsenal da Vingança | keystone | — | sem-efeito | alocavel | — | — |
| `21228` | Tiros Perfurantes | notavel | área e projéteis | funcional | aplicado | combate | 0/1 |
| `21262` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `21297` | Altamente Explosivos | notavel | crítico | parcial | aplicado | ficha | 0/2 |
| `21301` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `21330` | Recuperação Rápida | notavel | vida %, mana e custo, vida, regeneração e dreno de vida | funcional | validado | ficha | 3/3 |
| `21389` | Forjador de Runas | notavel | — | sem-efeito | alocavel | — | — |
| `21413` | Vigor de Combate | notavel | armadura e evasão, vida %, vida, regeneração e dreno de vida | funcional | validado | ficha | 3/3 |
| `21435` | Pano e Malha | notavel | armadura e evasão, resistências | funcional | validado | ficha | 5/5 |
| `21460` | Sopro Glacial | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 2/3 |
| `21548` | Duração dos Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `21575` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `21602` | Aparato Destrutivo | notavel | velocidades | parcial | aplicado | combate | 0/1 |
| `21634` | Química Arcana | notavel | mana %, frascos | funcional | aplicado | ficha | 3/4 |
| `21650` | Juventude Eterna | keystone | outros, escudo de energia | funcional | validado | ficha | 3/3 |
| `21678` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `21693` | Dano Físico e Ataque e Velocidade de Conjuração | comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 3/3 |
| `21758` | Duração da Carga de Frenesi | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `21835` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `21929` | Armadura e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `21934` | Dano Mágico | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `21958` | Preparação Cruel | notavel | vida %, resistências | funcional | validado | ficha | 4/4 |
| `21973` | Proteção da Podridão | notavel | bloqueio | parcial | aplicado | combate | 0/1 |
| `21974` | Eficácia da Reserva | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `21984` | Encaixe de Joia Grande | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `22046` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `22061` | Mana | comum | mana e custo, mana % | funcional | aplicado | ficha | 1/2 |
| `22062` | Dano e Duração de Lacaios | comum | lacaios e totens | funcional | aplicado | combate | 1/2 |
| `22088` | Sobrecarga Elemental | keystone | — | funcional-aproximado | aplicado | ficha | — |
| `22090` | Dano de Gelo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `22133` | Chama Revigorante | notavel | afecções e chance no acerto, efeito por evento | funcional | validado | ficha | 2/2 |
| `22180` | Precisão | comum | precisão % | funcional | validado | ficha | 1/1 |
| `22217` | Supressão Mágica e Recuperação de Vida com Frascos | comum | supressão de magia, frascos | funcional | validado | ficha | 2/2 |
| `22261` | Dano e Velocidade de Ataque da Adaga | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `22266` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `22285` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `22315` | Regeneração de Mana | comum | mana e custo | funcional | validado | ficha | 1/1 |
| `22356` | Hematofagia | notavel | outros | funcional | validado | combate | 2/2 |
| `22407` | Dano Físico e Velocidade de Ataque da Varinha | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `22423` | Dano com Dupla Empunhadura | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `22472` | Mana e Efeito de Fúria Arcana | comum | mana % | parcial | validado | ficha | 1/1 |
| `22473` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `22488` | Velocidade de Arremesso com Armadilhas | comum | velocidades | funcional | aplicado | combate | 0/1 |
| `22497` | Velocidade de Conjuração | comum | velocidades | funcional | validado | ficha | 1/1 |
| `22535` | Sussurros da Ruína | notavel | outros | funcional | validado | combate | 1/1 |
| `22577` | Recuperação do Bloqueio e Escudo de Energia | comum | escudo de energia | parcial | aplicado | combate | 0/1 |
| `22618` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `22627` | Vida e Armadura | comum | armadura e evasão, vida % | funcional-aproximado | aplicado | ficha | 1/2 |
| `22647` | Chance de Incêndio | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `22702` | Postura da Serpente | notavel | crítico, bloqueio | funcional | aplicado | ficha | 2/3 |
| `22703` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `22706` | Intensidade Selvagem | notavel | mana e custo, cargas e fúria | funcional | aplicado | combate | 1/2 |
| `22728` | Dano Elemental de Cajados e Penetração | comum | dano % (aumentado e "mais"), penetração | funcional | aplicado | ficha | 3/4 |
| `22748` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `22845` | Efeito de Tinturas | comum | — | sem-efeito | alocavel | — | — |
| `22893` | Duração de Habilidade | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `22908` | Valor Máximo dos Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `22972` | Defensor com Varinha | notavel | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `22994` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `23027` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `23036` | Recuperação da Recarga de Clamores e Área de Efeito | comum | — | sem-efeito | alocavel | — | — |
| `23038` | Matança | notavel | dano % (aumentado e "mais"), velocidades, cargas e fúria | funcional | validado | ficha | 4/4 |
| `23066` | Selvageria | notavel | cargas e fúria | funcional | validado | ficha | 1/1 |
| `23090` | Mobilização | keystone | — | sem-efeito | alocavel | — | — |
| `23122` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `23185` | Resistência a Dano de Caos e Dano dos Lacaios | comum | resistências, lacaios e totens | funcional | validado | ficha | 2/2 |
| `23199` | Dano e Chance de Sangramento | comum | afecções e chance no acerto, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `23215` | Maldições e Resistência a Caos | comum | resistências, auras, maldições e reserva | funcional | aplicado | ficha | 1/2 |
| `23237` | Área de Efeito das Auras | comum | — | sem-efeito | alocavel | — | — |
| `23334` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `23407` | Agonia Perfeita | keystone | outros, crítico | funcional | validado | ficha | 3/3 |
| `23438` | Duração de Frascos e Frascos de Vida | comum | frascos | funcional | validado | combate | 2/2 |
| `23439` | Chance de Golpes Críticos | comum | crítico | funcional | validado | ficha | 1/1 |
| `23449` | Dano Chance de Envenenamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `23456` | Regeneração de Mana e Vida | comum | mana e custo, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `23471` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `23507` | Velocidades de Ataque e Conjuração | comum | velocidades | funcional-aproximado | validado | ficha | 2/2 |
| `23540` | Conduíte | keystone | — | funcional | aplicado | combate | — |
| `23616` | Dano Físico e de Caos | comum | dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `23659` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `23690` | Infusão de Essência | notavel | escudo de energia | funcional | aplicado | ficha | 1/2 |
| `23756` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `23760` | Dano Físico e Sobrecarregar | comum | outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `23834` | Efeito do Buff de Clamores | comum | outros | funcional | aplicado | combate | 0/1 |
| `23852` | Dano de Machado | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `23881` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `23886` | Velocidade de Ataque e Duração de Veneno | comum | velocidades, afecções e chance no acerto | funcional-aproximado | aplicado | ficha | 1/2 |
| `23912` | Velocidade de Ataque com Arcos | comum | velocidades | funcional | validado | ficha | 1/1 |
| `23950` | Proteção Perversa | keystone | cargas e fúria, escudo de energia | funcional | validado | combate | 2/2 |
| `23951` | Velocidade de Movimento por Carga de Frenesi | comum | velocidades | funcional | aplicado | combate | 0/1 |
| `23984` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `24050` | Friamente Calculado | notavel | dano % (aumentado e "mais"), mana e custo, atributos (For/Des/Int) | funcional | validado | ficha | 3/3 |
| `24067` | Instinto | notavel | supressão de magia, efeito por evento | funcional | aplicado | ficha | 1/2 |
| `24083` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `24133` | Sobrevivencialista | notavel | armadura e evasão, resistências | funcional | aplicado | ficha | 4/5 |
| `24155` | Chance de Crítico com Maças | comum | crítico | funcional | validado | ficha | 2/2 |
| `24157` | Dano e Velocidade de Posicionamento de Totens | comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 0/2 |
| `24229` | Dano e Chance de Crítico com Cajados | comum | crítico | funcional | validado | ficha | 1/1 |
| `24256` | Dínamo | notavel | mana % | parcial | validado | ficha | 1/1 |
| `24324` | Impacto Explosivo | notavel | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 1/2 |
| `24362` | Pensamentos Profundos | notavel | mana %, mana e custo, atributos (For/Des/Int) | funcional | validado | ficha | 3/3 |
| `24377` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `24383` | Sangue do Guerreiro | notavel | vida, regeneração e dreno de vida, atordoamento, atributos (For/Des/Int) | funcional | aplicado | ficha | 2/3 |
| `24426` | Devastador Fantasma | keystone | outros, escudo de energia, cargas e fúria | funcional | validado | combate | 3/3 |
| `24452` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `24472` | Duração da Habilidade | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `24496` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `24544` | Chance de Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `24641` | Dano com Dupla Empunhadura | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `24643` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `24677` | Dano Elemental e Precisão da Maça | comum | precisão, dano % (aumentado e "mais") | funcional | aplicado | ficha | 6/8 |
| `24716` | Transe de Batalha | notavel | cargas e fúria | funcional | validado | combate | 1/1 |
| `24720` | Guarda Desequilibrada | keystone | — | sem-efeito | alocavel | — | — |
| `24721` | Esmagador de Tórax | notavel | dano % (aumentado e "mais"), velocidades, área e projéteis | funcional | aplicado | ficha | 5/6 |
| `24772` | Dano de Ataque e Área de Efeito com Maças | comum | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 4/5 |
| `24824` | Velocidade de Ataque e Conjuração do Lacaio | comum | velocidades | funcional | aplicado | combate | 0/2 |
| `24858` | Lançador de Arpão | notavel | afecções e chance no acerto, outros | funcional | aplicado | combate | 1/3 |
| `24865` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `24872` | Vida e Efeito do Bônus de Golens | comum | lacaios e totens | parcial | aplicado | combate | 0/1 |
| `24914` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `24970` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `24974` | Duração de Frascos | comum | frascos | funcional | validado | combate | 1/1 |
| `25058` | Sifão de Sangue | notavel | vida %, vida, regeneração e dreno de vida, atributos (For/Des/Int) | funcional | aplicado | ficha | 2/3 |
| `25067` | Evasão e Vida | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `25134` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `25168` | Dano Físico como Dano de Fogo Extra | comum | conversão / dano extra | funcional | aplicado | combate | 0/1 |
| `25178` | Espírito Primitivo | notavel | mana %, atributos (For/Des/Int) | parcial | validado | ficha | 3/3 |
| `25209` | Multiplicador de Dano Físico e Precisão em Dupla Empunhadura | comum | precisão, crítico | funcional | aplicado | ficha | 1/2 |
| `25222` | Velocidade de Ataque e Conjuração do Lacaio | comum | velocidades | funcional | aplicado | combate | 0/2 |
| `25237` | Regeneração de Mana e Eficiência de Custo de Mana | comum | mana e custo | funcional | aplicado | ficha | 1/2 |
| `25260` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `25324` | Dano de Ataques com Escudo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `25332` | Dano de Lacaios e Velocidade de Ataque e Conjuração | comum | lacaios e totens, velocidades | funcional | aplicado | combate | 1/3 |
| `25355` | Eficácia da Reserva de Posturas | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `25367` | Mestre da Lâmina | notavel | dano % (aumentado e "mais"), velocidades, precisão | funcional | validado | ficha | 4/4 |
| `25409` | Exército Indomável | notavel | resistências | parcial | aplicado | combate | 0/1 |
| `25411` | Infundido | notavel | cargas e fúria | funcional | validado | ficha | 1/1 |
| `25431` | Eficiência de Custo de Mana de Maldições | comum | — | sem-efeito | alocavel | — | — |
| `25439` | Coveiro | notavel | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | parcial | interpretado | condicional | 0/2 |
| `25441` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `25456` | Dervixe | notavel | bloqueio, dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `25511` | Dano Elemental da Arma | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `25531` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `25682` | Dano do Machado | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `25714` | Mana e Custo de Mana Aumentado | comum | mana %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `25732` | Velocidade de Ataque e Conjuração de Totens | comum | lacaios e totens | parcial | aplicado | combate | 0/1 |
| `25738` | Perseguição Implacável | notavel | — | sem-efeito | alocavel | — | — |
| `25757` | Chance de Crítico Mágico | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `25766` | Multiplicador de Dano com Envenenamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `25770` | Recuperação da Recarga de Armadilhas | comum | — | sem-efeito | alocavel | — | — |
| `25775` | Dano e Velocidade de Ataque da Garra | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `25781` | Máximo de Fortificações | comum | — | sem-efeito | alocavel | — | — |
| `25789` | Dreno de Escudo de Energia | comum | escudo de energia | funcional | aplicado | combate | 0/1 |
| `25796` | Chance de Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `25831` | Eficácia da Reserva | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `25933` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `25959` | Área de Efeito de Feitiços | comum | — | sem-efeito | alocavel | — | — |
| `25970` | Amargor | notavel | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `25989` | Ensinamentos Nômades | notavel | resistências | funcional | aplicado | combate | 0/3 |
| `26002` | Velocidade de Conjuração de Marcas | comum | — | sem-efeito | alocavel | — | — |
| `26023` | Ferimentos Selvagens | notavel | outros | funcional | aplicado | ficha | 0/1 |
| `26070` | Eficiência de Custo | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `26096` | Mestre da Machadinha | notavel | dano % (aumentado e "mais"), velocidades, efeito por evento | funcional | aplicado | ficha | 3/4 |
| `26188` | Dano e Chance de Crítico de Machado | comum | dano % (aumentado e "mais"), crítico | funcional | validado | ficha | 3/3 |
| `26196` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `26270` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `26294` | Sangria | notavel | afecções e chance no acerto | parcial | validado | ficha | 1/1 |
| `26365` | Chance de Incêndio com Ataques | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `26456` | Dano e Velocidade de Ataque da Maça | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 5/5 |
| `26471` | Anulação de Eletriações | comum | outros | funcional | aplicado | combate | 0/1 |
| `26481` | Dano e Vida de Lacaios | comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `26523` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `26528` | Vida e Evasão a Afecção Elemental | comum | vida %, afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `26557` | Golpes Estáticos | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 1/3 |
| `26564` | Vencedor | notavel | dano % (aumentado e "mais") | parcial | validado | ficha | 1/1 |
| `26585` | Bloqueio Mágico com Cajados | comum | bloqueio | funcional | aplicado | ficha | 0/1 |
| `26620` | Corrupção | notavel | — | sem-efeito | alocavel | — | — |
| `26661` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `26712` | Armadura | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `26725` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `26740` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `26763` | Fórmula Aperfeiçoada | notavel | — | sem-efeito | alocavel | — | — |
| `26820` | Ganho de Vida ao Acertar | comum | vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/1 |
| `26866` | Santidade | notavel | armadura e evasão, escudo de energia, vida, regeneração e dreno de vida, atributos (For/Des/Int) | funcional | validado | ficha | 5/5 |
| `26960` | Premeditação | notavel | mana %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `27119` | Fúria Tribal | notavel | — | sem-efeito | alocavel | — | — |
| `27134` | Dano da Maça | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 4/4 |
| `27137` | Santuário do Pensamento | notavel | crítico, armadura e evasão, escudo de energia | funcional | aplicado | combate | 2/3 |
| `27140` | Dano Corpo a Corpo e Drenagem com Duas Mãos | comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional-aproximado | aplicado | ficha | 1/3 |
| `27163` | Vontade Arcana | notavel | mana %, mana e custo, atributos (For/Des/Int) | funcional | aplicado | ficha | 2/3 |
| `27166` | Resistência a Fogo | comum | resistências | funcional | validado | ficha | 1/1 |
| `27190` | Super Preparado | notavel | — | sem-efeito | alocavel | — | — |
| `27195` | Resistência a Gelo | comum | resistências | funcional | validado | ficha | 1/1 |
| `27203` | Coração e Alma | notavel | vida %, mana % | funcional | validado | ficha | 2/2 |
| `27276` | Dano Físico e de Caos | comum | dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `27283` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `27301` | Experiência Marcial | notavel | dano % (aumentado e "mais"), outros | funcional | aplicado | ficha | 1/4 |
| `27308` | Pacto da Sepultura | notavel | resistências | parcial | validado | ficha | 1/1 |
| `27323` | Bloqueio Mágico com Escudos | comum | bloqueio | funcional | aplicado | ficha | 0/1 |
| `27325` | Cargas de Frasco contra Inimigos Marcados | comum | — | sem-efeito | alocavel | — | — |
| `27415` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `27422` | Espírito da Guerra | notavel | mana e custo | funcional-aproximado | aplicado | ficha | 0/2 |
| `27444` | Chance e Multiplicador de Crítico do Totem | comum | crítico | funcional | aplicado | ficha | 0/2 |
| `27475` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `27564` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `27575` | Duração da Carga de Poder | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `27592` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `27605` | Ganho de Fortificações | comum | — | sem-efeito | alocavel | — | — |
| `27611` | Senhor dos Mortos | notavel | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 4/4 |
| `27623` | Lições Duras | notavel | afecções e chance no acerto | funcional | aplicado | ficha | 0/2 |
| `27656` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `27659` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `27697` | Redução do Ponto de Atordoamento | comum | atordoamento | funcional | validado | combate | 1/1 |
| `27709` | Chance de Incendiar | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `27718` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `27788` | Bebedor de Sangue | notavel | vida %, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `27806` | Como o Trovão | notavel | afecções e chance no acerto, outros | funcional | aplicado | combate | 0/2 |
| `27819` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `27879` | Chance e Multiplicador de Crítico de Varinha | comum | crítico | funcional | validado | ficha | 2/2 |
| `27929` | Sabedoria Profunda | notavel | escudo de energia, mana e custo, atributos (For/Des/Int) | funcional | aplicado | ficha | 1/3 |
| `27962` | Velocidade de Armamento e Área de Ativação da Armadilha | comum | área e projéteis, velocidades | funcional | aplicado | combate | 0/2 |
| `28012` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `28018` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `28034` | Vínculo Maximizador | notavel | — | sem-efeito | alocavel | — | — |
| `28076` | Mana e Regeneração de Mana | comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `28221` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `28265` | Mana e Regeneração de Mana | comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `28311` | Velocidade da Drenagem de Vida e Velocidade de Ataque | comum | velocidades, outros | funcional-aproximado | validado | ficha | 2/2 |
| `28330` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `28424` | Mana e Mana ao Matar | comum | mana %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `28449` | Explosão de Vigor | notavel | — | sem-efeito | alocavel | — | — |
| `28475` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `28498` | Chance de Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `28503` | Sangria | notavel | velocidades, precisão, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/3 |
| `28574` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `28650` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `28658` | Chance de Crítico com Ataques de Projéteis | comum | crítico | funcional | validado | ficha | 1/1 |
| `28728` | Dano com Armas de Duas Mãos Corpo a Corpo e Redução de Dano Físico Ignorada | comum | dano % (aumentado e "mais"), outros | funcional | aplicado | ficha | 0/3 |
| `28753` | Dano com Armadilhas | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `28754` | Assassinato | notavel | crítico | funcional | validado | ficha | 2/2 |
| `28758` | Multiplicador de Golpes Críticos de Adagas | comum | crítico | funcional | validado | ficha | 1/1 |
| `28859` | Eficácia da Reserva | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `28878` | Implacável | notavel | vida, regeneração e dreno de vida, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `28887` | Incêndio mais Rápido | comum | outros | funcional | aplicado | ficha | 0/1 |
| `29005` | Armadura e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `29033` | Chance de Crítico com Runas | comum | crítico | funcional | validado | ficha | 1/1 |
| `29034` | Dano e Duração de Atordoamento Corpo a Corpo com Duas Mãos | comum | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 0/3 |
| `29049` | Fogo Sagrado | notavel | afecções e chance no acerto, resistências | funcional | validado | ficha | 2/2 |
| `29061` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `29089` | Dano do Arco e Evasão | comum | dano % (aumentado e "mais"), armadura e evasão | funcional | aplicado | ficha | 2/3 |
| `29104` | Mana e Cargas de Frasco Recebidas | comum | mana %, frascos | funcional | validado | ficha | 2/2 |
| `29106` | Dano de Lacaios e Velocidade de Ataque e Conjuração | comum | lacaios e totens, velocidades | funcional | aplicado | combate | 1/3 |
| `29171` | Vida de Lacaios | comum | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `29185` | Chance de Crítico e Precisão Corpo a Corpo com Duas Mãos | comum | precisão, crítico | funcional | aplicado | ficha | 0/2 |
| `29199` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `29292` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `29353` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `29359` | Dano de Ataques e Dreno | comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional-aproximado | validado | ficha | 3/3 |
| `29379` | Precisão e Resistências Elementais | comum | resistências, precisão % | funcional | validado | ficha | 4/4 |
| `29381` | Horda Faminta | notavel | lacaios e totens | parcial | aplicado | combate | 0/1 |
| `29454` | Supressão Mágica | comum | supressão de magia | funcional | validado | ficha | 1/1 |
| `29472` | Recuperação de Atordoamentos | comum | atordoamento | funcional | aplicado | combate | 0/1 |
| `29522` | Dança das Lâminas | notavel | — | sem-efeito | alocavel | — | — |
| `29543` | Dano e Velocidade de Ataque de Machado | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `29547` | Dreno de Vida | comum | outros | funcional | validado | combate | 1/1 |
| `29549` | Dano com Minas | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `29552` | Dano da Varinha | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `29629` | Dano de Caos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `29712` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `29781` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `29797` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `29856` | Multiplicador e Chance de Crítico com Espadas | comum | crítico | funcional | validado | ficha | 2/2 |
| `29861` | Runas Explosivas | notavel | crítico | parcial | validado | ficha | 1/1 |
| `29870` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `29933` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `29937` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `30030` | Dano e Velocidade de Ataque do Machado | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `30038` | Duração dos Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `30110` | Multiplicador de Dano Degenerativo de Caos | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `30148` | Precisão | comum | precisão, precisão % | funcional | validado | ficha | 2/2 |
| `30155` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `30160` | Defender-se | notavel | afecções e chance no acerto | parcial | aplicado | combate | 0/1 |
| `30170` | Decaimento Lento da Fúria | comum | armadura e evasão, cargas e fúria | funcional | validado | combate | 2/2 |
| `30205` | Dano Físico | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 1/1 |
| `30225` | Andarilho do Raio | notavel | dano % (aumentado e "mais"), velocidades, resistências | funcional | aplicado | ficha | 2/3 |
| `30251` | Dano com Machados e Espadas | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `30275` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `30302` | Caloroso | notavel | vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `30319` | Chance e Multiplicador de Crítico com Armadilhas | comum | crítico | funcional | aplicado | ficha | 0/2 |
| `30335` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `30338` | Dano Degenerativo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `30370` | Dano de Magia Degenerativo | comum | — | sem-efeito | alocavel | — | — |
| `30380` | Vida e Resistências Elementais | comum | vida %, resistências | funcional | validado | ficha | 4/4 |
| `30427` | Efeito de Resfriamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `30439` | Açoite de Lava | notavel | penetração, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `30455` | Chance e Multiplicador de Crítico com Ataques de Projéteis | comum | crítico | funcional | validado | ficha | 2/2 |
| `30471` | Golpe Certeiro | notavel | crítico | funcional | validado | ficha | 2/2 |
| `30547` | Dano de Ataque e Área de Efeito com Maças | comum | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 4/5 |
| `30626` | Chance de Crítico com Duas Mãos | comum | crítico | funcional | validado | ficha | 1/1 |
| `30658` | Vida e Resistências Elementais de Lacaios | comum | vida, regeneração e dreno de vida, resistências | funcional | aplicado | combate | 1/2 |
| `30679` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `30691` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `30693` | Catalisar | notavel | dano % (aumentado e "mais"), crítico, atributos (For/Des/Int) | funcional | validado | ficha | 4/4 |
| `30714` | Decaimento Lento da Fúria | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `30733` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `30745` | Chance e Multiplicador de Crítico de Garra | comum | crítico | funcional | validado | ficha | 2/2 |
| `30767` | Efeito da Maldição | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `30825` | Vida e Resistências Elementais de Totens | comum | vida, regeneração e dreno de vida, resistências | funcional | aplicado | combate | 0/2 |
| `30826` | Queima de Mana mais Lenta | comum | — | sem-efeito | alocavel | — | — |
| `30842` | Precisão Corpo a Corpo com Duas Mãos | comum | precisão | funcional | aplicado | ficha | 0/1 |
| `30894` | Dano Elemental com Armas | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `30926` | Dano Elemental da Varinha E Penetração | comum | dano % (aumentado e "mais"), penetração | funcional | aplicado | ficha | 3/4 |
| `30969` | Dano Elemental com Armas e Efeito de Afecções | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional-aproximado | validado | ficha | 5/5 |
| `30974` | Caçador Perito | notavel | — | sem-efeito | alocavel | — | — |
| `31033` | Robustez | notavel | vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `31080` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `31103` | Vida e Redução de Dano Físico de Lacaios | comum | vida, regeneração e dreno de vida | parcial | validado | combate | 1/1 |
| `31137` | Carga ao Matar | comum | cargas e fúria | funcional | aplicado | ficha | 0/1 |
| `31153` | Dano Físico e de Fogo | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `31222` | Atravessar | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `31257` | Autoridade Natural | notavel | outros | parcial | aplicado | combate | 0/1 |
| `31315` | Evasão e Vida | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `31359` | Toxinas Fatais | notavel | afecções e chance no acerto, resistências, dano % (aumentado e "mais") | funcional | aplicado | ficha | 2/3 |
| `31371` | Área de Efeito de Minas | comum | — | sem-efeito | alocavel | — | — |
| `31438` | Mana ao Matar com Tinturas | comum | — | sem-efeito | alocavel | — | — |
| `31462` | Multiplicador de Dano Incendiário | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `31471` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `31473` | Mestre das Feridas | notavel | afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `31501` | Velocidade de Armamento e Área de Ativação da Armadilha | comum | área e projéteis, velocidades | funcional | aplicado | combate | 0/2 |
| `31508` | Aspecto de Lince | notavel | dano % (aumentado e "mais"), velocidades, crítico | funcional | validado | ficha | 3/3 |
| `31513` | Animosidade Adjacente | notavel | velocidades | parcial | aplicado | combate | 0/1 |
| `31520` | Velocidade de Ataque e Conjuração de Totens | comum | lacaios e totens | parcial | aplicado | combate | 0/1 |
| `31583` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `31585` | Conservador Cuidadoso | notavel | frascos | parcial | aplicado | combate | 0/2 |
| `31604` | Sangramento Mais Rápido | comum | outros | funcional | aplicado | ficha | 0/1 |
| `31619` | Dano Mágico em Dupla Empunhadura e Bloqueio Mágico | comum | bloqueio, dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `31628` | Dano Corpo a Corpo e Vida | comum | vida, regeneração e dreno de vida, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `31683` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `31703` | Sintonia da Dor | keystone | — | funcional | aplicado | combate | — |
| `31758` | Regeneração de Mana e Vida | comum | mana e custo, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `31819` | Eficiência de Custo de Mana e Vida | comum | mana %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `31875` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `31928` | Armadura | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `31931` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `31961` | Técnica Resoluta | keystone | — | funcional | aplicado | combate | — |
| `31973` | Área de Efeito da Maldição | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `32024` | Vida do Lacaio | comum | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `32053` | Dano Corpo a Corpo e Alcance de Golpes | comum | dano % (aumentado e "mais"), outros | funcional | aplicado | ficha | 1/2 |
| `32059` | Impactos Titânicos | notavel | crítico | funcional | aplicado | ficha | 0/1 |
| `32075` | Velocidade de Conjuração de Maldições | comum | velocidades | funcional | aplicado | combate | 0/1 |
| `32091` | Evasão e Supressão Mágica | comum | supressão de magia, armadura e evasão | funcional | validado | ficha | 2/2 |
| `32117` | Vida e Anulação de Atordoamentos | comum | vida %, atordoamento | funcional | aplicado | ficha | 1/2 |
| `32176` | Ladrão de Almas | notavel | armadura e evasão, escudo de energia, efeito por evento | funcional | aplicado | combate | 2/3 |
| `32210` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `32227` | Toque da Víbora | notavel | crítico | funcional | aplicado | ficha | 0/2 |
| `32245` | Especialidade | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `32314` | Eficácia de Reserva de Maldições | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `32345` | Espontaneidade | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `32376` | Dano das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `32431` | Dano de Raio | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `32432` | Chance e Multiplicador de Golpes Críticos com Armadilhas | comum | crítico | funcional | aplicado | ficha | 0/2 |
| `32455` | Tecelagem da Tempestade | notavel | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `32477` | Dano Elemental com Armas e Efeito de Afecções | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional-aproximado | validado | ficha | 5/5 |
| `32480` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `32482` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `32514` | Multiplicador e Chance de Golpes Críticos com Arcos | comum | crítico | funcional | validado | ficha | 2/2 |
| `32519` | Dano e Chance de Crítico de Machado | comum | dano % (aumentado e "mais"), crítico | funcional | validado | ficha | 3/3 |
| `32555` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `32681` | Presa Marcada | notavel | — | sem-efeito | alocavel | — | — |
| `32690` | Área de Efeito por Carga de Tolerância | comum | área e projéteis | funcional | interpretado | condicional | 0/1 |
| `32710` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `32738` | Parede de Aço | notavel | bloqueio, armadura e evasão | funcional | aplicado | ficha | 2/3 |
| `32739` | Precisão | comum | precisão, precisão % | funcional | validado | ficha | 2/2 |
| `32763` | Encaixe de Joia Grande | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `32802` | Multiplicador de Dano com Envenenamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `32932` | Soberania | notavel | auras, maldições e reserva | funcional | aplicado | combate | 0/2 |
| `32942` | Dano Físico e Velocidade de Ataque da Varinha | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `33082` | Fio da Navalha | notavel | dano % (aumentado e "mais"), outros | funcional | aplicado | ficha | 2/3 |
| `33089` | Dano e Velocidade de Ataque com Dupla Empunhadura | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `33098` | Duração do Incêndio e Sangramento | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/2 |
| `33196` | Dano de Gelo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `33287` | Destruidor | notavel | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `33296` | Dano Mágico | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `33310` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `33374` | Chance de uma Difusão Extra de Projéteis | comum | — | sem-efeito | alocavel | — | — |
| `33435` | Elementalista | notavel | resistências, dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 9/9 |
| `33479` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `33508` | Resistência a Fogo | comum | resistências | funcional | validado | ficha | 1/1 |
| `33545` | Devastador | notavel | velocidades | funcional-aproximado | validado | ficha | 3/3 |
| `33558` | Evasão e Velocidade de Movimento | comum | armadura e evasão, velocidades | funcional | validado | ficha | 2/2 |
| `33566` | Ganho de Valor com Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `33582` | Espetada Forçada | notavel | afecções e chance no acerto, outros | funcional | aplicado | combate | 0/2 |
| `33623` | Efeito do Buff de Clamores | comum | outros | funcional | aplicado | combate | 0/1 |
| `33631` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `33718` | Campeão da Causa | notavel | auras, maldições e reserva | parcial | aplicado | combate | 0/2 |
| `33725` | Presunção | notavel | bloqueio, cargas e fúria | funcional | aplicado | ficha | 1/2 |
| `33740` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `33753` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `33755` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `33777` | Dispositivos Devastadores | notavel | crítico | parcial | aplicado | ficha | 0/2 |
| `33779` | Chance de Crítico com Totens | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `33783` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `33833` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `33864` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `33903` | Vontade de Lâminas | notavel | crítico, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `33911` | Duração das Minas | comum | — | sem-efeito | alocavel | — | — |
| `33923` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `33943` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `33988` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `33989` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `34009` | Mestre da Arena | notavel | vida, regeneração e dreno de vida, dano % (aumentado e "mais"), outros, atributos (For/Des/Int) | funcional | aplicado | ficha | 3/4 |
| `34013` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `34031` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `34098` | Mente Sobre Matéria | keystone | — | funcional | aplicado | combate | — |
| `34130` | Velocidade de Ataques Corpo a Corpo | comum | velocidades | funcional | validado | combate | 1/1 |
| `34144` | Dano de Lacaios | comum | lacaios e totens | funcional | validado | combate | 1/1 |
| `34157` | Velocidade de Conjuração | comum | velocidades | funcional | validado | ficha | 1/1 |
| `34171` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `34173` | Sobrecarga | notavel | cargas e fúria | funcional | validado | ficha | 1/1 |
| `34191` | Efeito de Empalamentos | comum | outros | funcional | aplicado | combate | 0/1 |
| `34207` | Dano Físico | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 1/1 |
| `34225` | Efeito de Maldições | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `34284` | Esgrima Experiente | notavel | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `34306` | Bloqueio Mágico de Lacaios | comum | — | sem-efeito | alocavel | — | — |
| `34327` | Precisão com Cajados | comum | precisão | funcional | aplicado | ficha | 0/1 |
| `34359` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `34400` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `34423` | Multiplicador de Dano Degenerativo | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `34478` | Recarga do Escudo de Energia | comum | escudo de energia | funcional | validado | ficha | 1/1 |
| `34483` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `34506` | Comandante dos Golens | notavel | lacaios e totens | funcional | aplicado | combate | 1/2 |
| `34510` | Dano Degenerativo com Arcos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `34513` | Efeito da Aura | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `34560` | Dupla Empunhadura e Velocidade de Movimento | comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 1/2 |
| `34579` | Chance de Crítico | comum | crítico | funcional | validado | ficha | 1/1 |
| `34590` | Fúria ao Acertar | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `34591` | Intenção Maliciosa | notavel | outros | funcional | aplicado | combate | 0/1 |
| `34601` | Proficiência | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `34625` | Precisão do Arco | comum | precisão | funcional | aplicado | ficha | 0/1 |
| `34660` | Efeito de Marcas | comum | — | sem-efeito | alocavel | — | — |
| `34661` | Andarilho do Fogo | notavel | dano % (aumentado e "mais"), velocidades, resistências | funcional | aplicado | ficha | 2/3 |
| `34666` | Destruidor | notavel | dano % (aumentado e "mais"), velocidades, atordoamento | funcional | aplicado | ficha | 0/4 |
| `34678` | Vida e Evasão a Afecção Elemental | comum | vida %, afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `34750` | Dano de Fogo da Arma | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `34763` | Multiplicador de Dano Degenerativo de Caos | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `34880` | Vida do Lacaio | comum | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `34906` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `34907` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `34917` | Máximo de Resistência a Gelo | comum | resistências | funcional | aplicado | combate | 0/1 |
| `34959` | Dano Corpo a Corpo e Velocidade de Drenagem de Vida com Duas Mãos | comum | dano % (aumentado e "mais"), outros | funcional | aplicado | ficha | 1/3 |
| `34973` | Fúria Medida | notavel | — | sem-efeito | alocavel | — | — |
| `34978` | Mistura Coloidal | notavel | — | sem-efeito | alocavel | — | — |
| `35035` | Recuperação da Recarga do Convocar Runas | comum | — | sem-efeito | alocavel | — | — |
| `35053` | Chance de Crítico com Espadas | comum | crítico | funcional | validado | ficha | 1/1 |
| `35070` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `35086` | Eficiência de Custo de Ataque | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `35179` | Velocidade de Movimento | comum | velocidades | funcional | validado | ficha | 1/1 |
| `35190` | Eficácia da Reserva de mana de Maldições | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `35192` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `35233` | Artesão da Discórdia | notavel | dano % (aumentado e "mais") | parcial | interpretado | condicional | 1/1 |
| `35237` | Valor Máximo dos Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `35255` | Dança Fantasma | keystone | — | sem-efeito | alocavel | — | — |
| `35260` | Dano de Lacaios | comum | lacaios e totens | funcional | validado | combate | 1/1 |
| `35283` | Chance de Crítico | comum | crítico | funcional | validado | ficha | 1/1 |
| `35288` | Armadura | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `35313` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `35334` | Multiplicador e Chance de Golpes Críticos com Minas | comum | crítico | funcional | aplicado | ficha | 0/2 |
| `35362` | Dano Corpo a Corpo e Área de Efeito com Duas Mãos | comum | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 0/3 |
| `35384` | Dano e Velocidade de Ataque da Garra | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `35406` | Duração e Valor Máximo dos Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `35436` | Impactos Cinéticos | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 0/4 |
| `35503` | Resistência a Raio | comum | resistências | funcional | validado | ficha | 1/1 |
| `35507` | Velocidade do Dreno de Vida | comum | outros | funcional | validado | combate | 1/1 |
| `35556` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `35568` | Armadura, Evasão e Vida | comum | armadura e evasão, vida % | funcional | validado | ficha | 3/3 |
| `35663` | Braço Forte | notavel | dano % (aumentado e "mais"), velocidades, atributos (For/Des/Int) | funcional | aplicado | ficha | 1/4 |
| `35685` | Força Destemida | notavel | — | sem-efeito | alocavel | — | — |
| `35706` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `35724` | Dano e Mana | comum | dano % (aumentado e "mais"), mana e custo | funcional | aplicado | ficha | 1/2 |
| `35730` | Duração de Maldições | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `35737` | Carga ao Matar | comum | cargas e fúria | funcional | aplicado | ficha | 0/1 |
| `35756` | Efeito do Buff de Clamores | comum | outros | funcional | aplicado | combate | 0/1 |
| `35791` | Multiplicador de Golpe Crítico de Lacaios | comum | — | sem-efeito | alocavel | — | — |
| `35851` | Precisão e Chance de Crítico | comum | crítico, precisão % | funcional | validado | ficha | 2/2 |
| `35853` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `35894` | Trapaça | notavel | dano % (aumentado e "mais"), crítico, atributos (For/Des/Int) | funcional | validado | ficha | 4/4 |
| `35910` | Vida e Resistências Elementais de Totens | comum | vida, regeneração e dreno de vida, resistências | funcional | aplicado | combate | 0/2 |
| `35926` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `35958` | Fé e Aço | notavel | armadura e evasão, escudo de energia, resistências | funcional | validado | ficha | 5/5 |
| `35992` | Dano e Limite de Atordoamento Inimigo Reduzido de Maça | comum | dano % (aumentado e "mais"), atordoamento | funcional | validado | ficha | 6/6 |
| `36047` | Vida e Armadura | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `36107` | Eficácia de Reserva de Arautos | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `36121` | Dano de Raio | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `36200` | Velocidade de Clamores e Dano de Ataques Impelidos | comum | velocidades | parcial | aplicado | combate | 0/1 |
| `36221` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `36222` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `36225` | Chance e Multiplicador de Crítico da Garra | comum | crítico | funcional | validado | ficha | 2/2 |
| `36226` | Danod e Gelo e Chance de Congelar | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `36281` | Força Primitiva | notavel | dano % (aumentado e "mais") | funcional | aplicado | ficha | 3/6 |
| `36287` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `36371` | Vida do Cadáver | comum | — | sem-efeito | alocavel | — | — |
| `36412` | Dano de Gelo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `36414` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `36452` | Multiplicador de Crítico Mágico | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `36490` | Esfola | notavel | dano % (aumentado e "mais"), velocidades, precisão | funcional | aplicado | ficha | 3/4 |
| `36542` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `36543` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `36585` | Dano de Gelo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `36634` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `36678` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `36687` | Avatar da Caçada | notavel | dano % (aumentado e "mais"), armadura e evasão, velocidades | funcional-aproximado | aplicado | ficha | 2/4 |
| `36704` | Drenagem de Vida e Mana | comum | vida, regeneração e dreno de vida, mana e custo | funcional | aplicado | ficha | 1/2 |
| `36736` | Brutalidade Ardente | notavel | afecções e chance no acerto, velocidades | funcional-aproximado | validado | ficha | 2/2 |
| `36761` | Dano de Ataques e Velocidade de Ataque com Escudo | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `36764` | Sangramento e Chance de Golpe Crítico | comum | afecções e chance no acerto, crítico | funcional | validado | ficha | 2/2 |
| `36774` | Dano Mágico | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `36801` | Dano de Afecções e Duração do Veneno com Garras | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `36849` | Velocidade de Ataque e Duração de Veneno | comum | velocidades, afecções e chance no acerto | funcional-aproximado | aplicado | ficha | 1/2 |
| `36858` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `36859` | Postura da Madeira-aço | notavel | dano % (aumentado e "mais"), armadura e evasão, bloqueio | funcional | aplicado | ficha | 3/4 |
| `36874` | Sabedoria da Clareira | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `36877` | Dano da Armadilha | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `36881` | Resistência a Gelo | comum | resistências | funcional | validado | ficha | 1/1 |
| `36915` | Pastorear o Rebanho | notavel | vida, regeneração e dreno de vida, lacaios e totens | funcional | aplicado | ficha | 2/3 |
| `36931` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `36945` | Chance de Incêndio com Ataques | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `36949` | Devoção | notavel | vida % | parcial | validado | ficha | 1/1 |
| `36972` | Velocidade de Ataque com Duas Mãos | comum | velocidades | funcional | aplicado | ficha | 0/1 |
| `37078` | Caminho do Sábio | notavel | dano % (aumentado e "mais"), mana e custo, atributos (For/Des/Int) | funcional | aplicado | ficha | 1/3 |
| `37147` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `37163` | Dano de Fogo e Velocidade de Conjuração | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `37175` | Dano se Consumiu um Cadáver | comum | dano % (aumentado e "mais") | funcional | interpretado | condicional | 0/1 |
| `37326` | Saúde | notavel | cargas e fúria | funcional | validado | ficha | 1/1 |
| `37403` | Carne Infundida | notavel | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `37425` | Reaplicação Praticada | notavel | — | sem-efeito | alocavel | — | — |
| `37501` | Chance de Crítico Corpo a Corpo | comum | crítico | funcional | validado | ficha | 1/1 |
| `37504` | Intuição | notavel | supressão de magia, armadura e evasão, vida % | funcional | validado | ficha | 3/3 |
| `37569` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `37575` | Precisão | comum | precisão % | funcional | validado | ficha | 1/1 |
| `37584` | Duração da Carga de Tolerância | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `37619` | Evasão e Resistências Elementais | comum | armadura e evasão, resistências | funcional | validado | ficha | 4/4 |
| `37639` | Dano e Duração do Atordoamento do Cajado | comum | dano % (aumentado e "mais"), atordoamento | funcional | validado | ficha | 3/3 |
| `37647` | Desmembramento | notavel | crítico, efeito por evento | funcional | aplicado | ficha | 2/3 |
| `37663` | Multiplicador de Dano de Caos Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `37671` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `37690` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `37785` | Multiplicador de Dano dos Envenenamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `37800` | Dreno de Vida | comum | vida, regeneração e dreno de vida | funcional-aproximado | validado | ficha | 1/1 |
| `37884` | Resistências Elementais | comum | resistências | funcional | validado | ficha | 3/3 |
| `37887` | Dano de Ataques e Dreno | comum | dano % (aumentado e "mais"), outros | funcional | validado | ficha | 3/3 |
| `37895` | Ponto de Atordoamento | comum | atordoamento | funcional | aplicado | combate | 0/1 |
| `37898` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `37999` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `38023` | Dano da Maça e Limite de Atordoamento Inimigo Reduzido | comum | dano % (aumentado e "mais"), atordoamento | funcional | validado | ficha | 6/6 |
| `38048` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `38119` | Bloqueio e Armadura | comum | bloqueio, armadura e evasão | funcional | validado | ficha | 3/3 |
| `38129` | Dano e Escudo de Energia | comum | dano % (aumentado e "mais"), escudo de energia | funcional | aplicado | ficha | 1/2 |
| `38148` | Dano de Gelo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `38149` | Dano com Arcos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `38176` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `38190` | Vida e Escudo de Energia | comum | escudo de energia, vida % | funcional | validado | ficha | 2/2 |
| `38246` | Presságio | notavel | auras, maldições e reserva | parcial | aplicado | combate | 0/1 |
| `38344` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `38348` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `38450` | Área de Efeito | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `38462` | Velocidade das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `38508` | Duração da Carga de Tolerância | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `38516` | Decreto Justo | notavel | mana %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `38520` | Multiplicador de Crítico com Garras | comum | crítico | funcional | validado | ficha | 1/1 |
| `38538` | Dano Físico e Sobrecarregar | comum | outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `38539` | Dano Físico e Velocidade de Ataque e Conjuração | comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 3/3 |
| `38662` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `38664` | Chance de Crítico Corpo a Corpo | comum | crítico | funcional | validado | ficha | 1/1 |
| `38701` | Escudo de Energia e Mana | comum | escudo de energia, mana % | funcional | validado | ficha | 2/2 |
| `38772` | Dano Corpo a Corpo e Alcance de Golpes | comum | dano % (aumentado e "mais"), outros | funcional | aplicado | ficha | 1/2 |
| `38777` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `38789` | Duração e Chance de Incendiar | comum | afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `38805` | Área de Efeito | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `38836` | Armadura e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `38849` | Calor Cauterizante | notavel | outros | funcional | aplicado | ficha | 0/1 |
| `38864` | Dano e Velocidade de Ataque da Adaga | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `38900` | Área de Efeito | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `38906` | Armadura e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `38922` | Golias | notavel | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `38947` | Distância do Ricochete | comum | — | sem-efeito | alocavel | — | — |
| `38989` | Dano de Lacaios | comum | lacaios e totens | funcional | validado | combate | 1/1 |
| `38995` | Vida e Mana ao Acertar | comum | vida, regeneração e dreno de vida, mana e custo | funcional | aplicado | ficha | 0/2 |
| `39023` | Chance de Crítico Corpo a Corpo | comum | crítico | funcional | validado | ficha | 2/2 |
| `39085` | Equilíbrio Elemental | keystone | outros | funcional | validado | combate | 2/2 |
| `39211` | Dano de Ataque Físico | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `39437` | Decaimento Lento da Fúria | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `39443` | Chance de Golpes Críticos e Dreno | comum | crítico, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `39521` | Dano da Varinha | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `39524` | Multiplicador de Dano Degenerativo Crítico de Afecções | comum | crítico | funcional | validado | ficha | 1/1 |
| `39530` | Vácuo da Vitalidade | notavel | vida, regeneração e dreno de vida, outros | funcional | validado | ficha | 2/2 |
| `39631` | Armadura e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `39648` | Vida e Regeneração de Mana | comum | vida %, mana e custo | funcional | validado | ficha | 2/2 |
| `39657` | Forjador da Dor | notavel | crítico, atordoamento | funcional | aplicado | ficha | 4/5 |
| `39665` | Velocidade de Ataque com Arcos | comum | velocidades | funcional | validado | ficha | 1/1 |
| `39678` | Armadura | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `39713` | Golpes Reveladores | keystone | — | funcional | aplicado | combate | — |
| `39718` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `39725` | Precisão e Velocidade de Ataque | comum | velocidades, precisão | funcional-aproximado | validado | ficha | 2/2 |
| `39743` | Artes Sombrias | notavel | bloqueio, velocidades | funcional | aplicado | ficha | 3/4 |
| `39761` | Contrapeso | notavel | crítico | funcional | validado | ficha | 2/2 |
| `39768` | Precisão | comum | precisão, precisão % | funcional | validado | ficha | 2/2 |
| `39773` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `39786` | Dano Corpo a Corpo com Uma Mão | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `39814` | Recuperação da Recarga de Armadilhas | comum | — | sem-efeito | alocavel | — | — |
| `39821` | Evasão e Vida | comum | armadura e evasão, vida, regeneração e dreno de vida | funcional-aproximado | aplicado | ficha | 1/2 |
| `39841` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `39861` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `39904` | Espetos Brutais | notavel | outros | funcional | validado | combate | 1/1 |
| `39916` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `39938` | Dano com Arcos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `39986` | Forças Profanadas | notavel | velocidades, efeito por evento | parcial | aplicado | combate | 1/2 |
| `40075` | Dano Mágico com Cajados | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `40100` | Chance de Crítico | comum | crítico | funcional | validado | ficha | 1/1 |
| `40114` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `40126` | Área de Efeito da Maldição | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `40132` | Evasão | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `40135` | Dano com Espadas | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `40189` | Máximo de Fúria | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `40229` | Recuperação da Recarga de Clamores e Área de Efeito | comum | — | sem-efeito | alocavel | — | — |
| `40287` | Golpes Críticos contra Inimigos Cegos | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `40291` | Dano de Fogo e Velocidade de Conjuração com Habilidades de Fogo | comum | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 1/2 |
| `40351` | Tempestade Turbulenta | keystone | — | sem-efeito | alocavel | — | — |
| `40362` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `40366` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `40400` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `40409` | Velocidade de Detonação de Minas | comum | — | sem-efeito | alocavel | — | — |
| `40483` | Efeito de Resfriamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `40508` | Armadura e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `40535` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `40609` | Dano de Gelo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `40619` | Admiração e Terror | notavel | — | sem-efeito | alocavel | — | — |
| `40637` | Dano de Vida de Lacaios | comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `40644` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `40645` | Quebra-Osso | notavel | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 4/5 |
| `40653` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `40705` | Multiplicador de Dano de Gelo Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `40743` | Pele de Cristal | notavel | resistências, afecções e chance no acerto | funcional | aplicado | combate | 1/4 |
| `40751` | Área de Efeito de Minas | comum | — | sem-efeito | alocavel | — | — |
| `40766` | Duração da Carga de Tolerância | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `40776` | Dano com Runas | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `40818` | Chance de Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `40840` | Dano da Varinha | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `40841` | Chance e Dano de Ataque Físico de Empalar | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `40867` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `40907` | Postura Inabalável | keystone | — | funcional-aproximado | aplicado | ficha | — |
| `40927` | Área de Efeito | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `41026` | Mana e Recuperação da Recarga de Habilidades de Guarda | comum | mana % | parcial | validado | ficha | 1/1 |
| `41047` | Área de Efeito com Arcos | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `41068` | Duração do Sangramento | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `41119` | Letalidade | notavel | crítico | funcional | validado | ficha | 2/2 |
| `41137` | Medicina de Campo | notavel | frascos | parcial | validado | combate | 1/1 |
| `41190` | Dano e Vida de Lacaios | comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `41250` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `41251` | Efeito de Afecções | comum | afecções e chance no acerto | funcional-aproximado | validado | ficha | 2/2 |
| `41263` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `41305` | Resposta Esmagadora | notavel | — | sem-efeito | alocavel | — | — |
| `41380` | Velocidade de Ataque e Precisão do Arco | comum | velocidades, precisão | funcional | aplicado | ficha | 1/2 |
| `41420` | Remédios Naturais | notavel | frascos | parcial | aplicado | combate | 1/2 |
| `41472` | Disciplina e Treinamento | notavel | vida, regeneração e dreno de vida, vida % | funcional | validado | ficha | 2/2 |
| `41476` | Poder Ancião | notavel | dano % (aumentado e "mais"), cargas e fúria | funcional | aplicado | ficha | 0/2 |
| `41536` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `41595` | Marcado para Morrer | notavel | — | sem-efeito | alocavel | — | — |
| `41599` | Dano e Bloqueio com Cajados | comum | dano % (aumentado e "mais"), bloqueio | funcional | validado | ficha | 3/3 |
| `41635` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `41689` | Dano Físico e de Caos | comum | dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `41819` | Velocidade do Dreno de Vida | comum | outros | funcional | validado | combate | 1/1 |
| `41866` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `41870` | Abraço Invernal | notavel | afecções e chance no acerto | parcial | validado | ficha | 1/1 |
| `41876` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `41967` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `41970` | Vínculo Ancestral | keystone | lacaios e totens | parcial | validado | combate | 1/1 |
| `41989` | Desenvoltura | notavel | supressão de magia, escudo de energia, vida % | funcional | validado | ficha | 3/3 |
| `42006` | Dano de Minas e Eficácia da Reserva | comum | dano % (aumentado e "mais"), auras, maldições e reserva | funcional | aplicado | ficha | 0/2 |
| `42009` | Alma de Aço | notavel | armadura e evasão, resistências | funcional-aproximado | aplicado | ficha | 1/5 |
| `42041` | Química Profana | notavel | vida %, frascos | funcional | validado | ficha | 4/4 |
| `42086` | Eficiência de Custo de Ataque | comum | mana e custo | funcional | aplicado | combate | 0/1 |
| `42104` | Precisão e Velocidade de Ataque | comum | velocidades, precisão % | funcional-aproximado | validado | ficha | 2/2 |
| `42106` | Dano e Ponto de Atordoamento com Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `42133` | Ganho de Cargas de Frascos de Vida | comum | frascos | funcional | validado | combate | 2/2 |
| `42161` | Chance de Incendiar com Ataques e Velocidade de Ataque | comum | velocidades, afecções e chance no acerto | funcional-aproximado | aplicado | ficha | 1/2 |
| `42178` | Queima-Roupa | keystone | — | sem-efeito | alocavel | — | — |
| `42343` | Mesclador de Runas | keystone | lacaios e totens | parcial | validado | combate | 1/1 |
| `42443` | Frenético | notavel | cargas e fúria | funcional | validado | ficha | 1/1 |
| `42485` | Dano Mágico com Cajados e Bloqueio | comum | dano % (aumentado e "mais"), bloqueio | funcional | aplicado | ficha | 1/2 |
| `42495` | Recuperação da Recarga das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `42623` | Dano com Uma Mão | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `42632` | Chance e Multiplicador de Crítico do Totem | comum | crítico | funcional | aplicado | ficha | 0/2 |
| `42637` | Dano e Velocidade de Ataque do Machado | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `42649` | Forjado em Neve | notavel | dano % (aumentado e "mais"), outros | funcional | validado | ficha | 3/3 |
| `42668` | Velocidade de Ataque e Conjuração do Lacaio | comum | velocidades | funcional | aplicado | combate | 0/2 |
| `42686` | Foco Elemental | notavel | afecções e chance no acerto, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 5/6 |
| `42720` | Puxada Pesada | notavel | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 2/3 |
| `42731` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `42744` | Chance e Multiplicador de Golpes Críticos de Minas | comum | crítico | funcional | aplicado | ficha | 0/2 |
| `42760` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `42795` | Foco Arcano | notavel | escudo de energia, atributos (For/Des/Int) | funcional | aplicado | ficha | 2/3 |
| `42800` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `42804` | Bebedor de Mentes | notavel | mana %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `42837` | Regeneração de Mana e Vida | comum | mana e custo, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `42907` | Multiplicador de Dano Degenerativo de Caos | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `42911` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `42917` | Barreira Giratória | notavel | cargas e fúria, bloqueio | funcional | aplicado | ficha | 1/3 |
| `42964` | Dano com Arcos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `42981` | Frascos de Mana | comum | frascos | funcional | aplicado | combate | 1/2 |
| `43000` | Mana e Dano Mágico | comum | dano % (aumentado e "mais"), mana % | funcional | aplicado | ficha | 1/2 |
| `43010` | Eficácia da Reserva de mana de Maldições | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `43057` | Resistência à Incêndio | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `43061` | Bloqueio Mágico com Escudos | comum | bloqueio | funcional | aplicado | ficha | 0/1 |
| `43133` | Resistência a Dano de Caos e Dano dos Lacaios | comum | resistências, lacaios e totens | funcional | validado | ficha | 2/2 |
| `43162` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `43303` | Dano Corpo a Corpo com Duas Mãos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `43316` | Dano Físico e Redução de Dano Físico Ignorada | comum | outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `43328` | Dreno de Escudo de Energia | comum | escudo de energia | funcional | aplicado | combate | 0/1 |
| `43374` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `43385` | Espírito Invernal | notavel | conversão / dano extra | funcional | aplicado | combate | 0/1 |
| `43412` | Dano Corpo a Corpo com Duas Mãos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `43413` | Bloqueio com Escudo e Recuperação de Bloqueio | comum | bloqueio | parcial | validado | ficha | 1/1 |
| `43457` | Evasão e Efeito da Cegueira | comum | armadura e evasão, outros | funcional | aplicado | combate | 1/2 |
| `43491` | Cargas Usadas de Frascos | comum | frascos | funcional | aplicado | combate | 0/1 |
| `43514` | Chance de Golpes Críticos e Precisão com Espadas | comum | precisão, crítico | funcional | aplicado | ficha | 1/2 |
| `43608` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `43684` | Afecções Rápidas | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `43689` | Comando Espiritual | notavel | velocidades | parcial | aplicado | combate | 0/2 |
| `43716` | Dano de Lacaios | comum | lacaios e totens | funcional | validado | combate | 1/1 |
| `43787` | Precisão e Resistências Elementais | comum | resistências, precisão % | funcional | validado | ficha | 4/4 |
| `43822` | Dano e Duração de Atordoamento de Maça | comum | dano % (aumentado e "mais"), atordoamento | funcional | validado | ficha | 5/5 |
| `43833` | Recuperação da Recarga de Clamores | comum | — | sem-efeito | alocavel | — | — |
| `43988` | Mestre dos Feitiços | keystone | afecções e chance no acerto, auras, maldições e reserva | funcional | validado | combate | 2/2 |
| `43989` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `44102` | Explosivos Eficientes | notavel | auras, maldições e reserva | parcial | aplicado | combate | 0/1 |
| `44103` | Reflexos | notavel | supressão de magia, armadura e evasão | funcional-aproximado | aplicado | ficha | 2/3 |
| `44134` | Chance e Multiplicador de Crítico de Adaga | comum | crítico | funcional | validado | ficha | 2/2 |
| `44169` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `44183` | Dano de Raio e Velocidade de Conjuração | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `44184` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `44191` | Como a Montanha | notavel | bloqueio | parcial | validado | ficha | 2/2 |
| `44202` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `44207` | Tartaruga | notavel | bloqueio, efeito por evento | parcial | aplicado | ficha | 1/2 |
| `44268` | Área de Efeito das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `44306` | Dano e Velocidade de Projéteis | comum | velocidades, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `44339` | Dano de Raio da Arma | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `44347` | Fúria Divina | notavel | conversão / dano extra, penetração | funcional | aplicado | ficha | 0/2 |
| `44360` | Velocidade de Ataque e Conjuração de Lacaios | comum | velocidades | funcional | aplicado | combate | 0/2 |
| `44362` | Dano de Caos e Expiração do Definhamento | comum | dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/1 |
| `44429` | Vida e Resistências Elementais | comum | vida %, resistências | funcional | validado | ficha | 4/4 |
| `44465` | Recuperação de Atordoamentos | comum | atordoamento | funcional | aplicado | combate | 0/1 |
| `44470` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `44529` | Precisão, Velocidade de Ataque e Conjuração | comum | precisão, velocidades | funcional | validado | ficha | 3/3 |
| `44562` | Domínio do Xamã | notavel | crítico | funcional | aplicado | ficha | 0/2 |
| `44606` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `44624` | Chance de Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `44723` | Chance de Crítico Mágico | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `44788` | Conexões Potentes | notavel | — | sem-efeito | alocavel | — | — |
| `44799` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `44824` | Misticismo | notavel | dano % (aumentado e "mais"), velocidades, mana e custo | funcional | aplicado | ficha | 1/3 |
| `44908` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `44916` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `44922` | Dano e Defesas com Escudo | comum | dano % (aumentado e "mais"), armadura e evasão | funcional | aplicado | ficha | 2/3 |
| `44924` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `44941` | Avatar do Fogo | keystone | — | funcional-aproximado | aplicado | ficha | — |
| `44955` | Andarilho do Gelo | notavel | dano % (aumentado e "mais"), velocidades, resistências | funcional | aplicado | ficha | 2/3 |
| `44967` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `44983` | Dano de Fogo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `44988` | Assolador | notavel | afecções e chance no acerto, resistências | funcional | aplicado | ficha | 1/2 |
| `45033` | Evasão e Trespassar | comum | armadura e evasão, efeito por evento | funcional | aplicado | combate | 1/2 |
| `45035` | Dano de Projétil e Precisão | comum | precisão, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `45067` | Assassino de Emoções | notavel | mana %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `45163` | Dano das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `45175` | Égide Necromântica | keystone | — | sem-efeito | alocavel | — | — |
| `45202` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `45227` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `45246` | Queima de Mana mais Lenta | comum | — | sem-efeito | alocavel | — | — |
| `45272` | Vida e Dano Físico e de Caos | comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional-aproximado | aplicado | ficha | 2/3 |
| `45283` | Presa Encurralada | notavel | crítico | funcional | aplicado | ficha | 0/2 |
| `45317` | Cinza, Gelo e Tempestade | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional-aproximado | validado | ficha | 8/8 |
| `45329` | Tiro Ardil | notavel | — | sem-efeito | alocavel | — | — |
| `45341` | Máximo de Resistência de Gelo | comum | resistências | funcional | aplicado | combate | 0/1 |
| `45350` | Glória do Comando | notavel | — | sem-efeito | alocavel | — | — |
| `45360` | Chance de Envenenamento e Dano | comum | afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `45366` | Multiplicador de Crítico com Totens | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `45436` | Dano Elemental da Arma, Chance de Aflição de Status | comum | afecções e chance no acerto, dano % (aumentado e "mais") | funcional | validado | ficha | 6/6 |
| `45456` | Dano Mágico | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `45486` | Chance e Multiplicador de Crítico com Cajados | comum | crítico | funcional | validado | ficha | 2/2 |
| `45491` | Dano com Ataques | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `45503` | Efeito da Aura dos Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `45565` | Duração do Sangramento | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `45593` | Evasão e Vida | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `45608` | Detonações Sucessivas | notavel | — | sem-efeito | alocavel | — | — |
| `45646` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `45657` | Provação da Fé | notavel | atordoamento | parcial | aplicado | combate | 0/1 |
| `45680` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `45788` | Velocidade de Ataque com Garras | comum | velocidades | funcional | validado | ficha | 1/1 |
| `45803` | Soldado Veterano | notavel | afecções e chance no acerto, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `45810` | Dano de Envenenamento e Velocidade de Conjuração | comum | velocidades, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `45827` | Dano com Armadilhas | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `45838` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `45887` | Bloqueio | comum | bloqueio | funcional | validado | ficha | 2/2 |
| `45945` | Barreira Conjurada | notavel | atordoamento, mana e custo | parcial | aplicado | ficha | 0/2 |
| `46092` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `46106` | Precisão do Arco | comum | precisão | funcional | aplicado | ficha | 0/1 |
| `46111` | Efeito de Maldições | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `46127` | Dano e Duração do Atordoamento da Maça | comum | dano % (aumentado e "mais"), atordoamento | funcional | validado | ficha | 5/5 |
| `46136` | Evasão e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `46277` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `46289` | Dano Degenerativo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `46291` | Velocidade de Ataque do Totem | comum | lacaios e totens | funcional | aplicado | combate | 0/1 |
| `46340` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `46344` | Dano com Arcos e Evasão | comum | dano % (aumentado e "mais"), armadura e evasão | funcional | aplicado | ficha | 2/3 |
| `46393` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `46408` | Presas da Víbora | notavel | dano % (aumentado e "mais"), velocidades, atributos (For/Des/Int) | funcional-aproximado | aplicado | ficha | 3/4 |
| `46469` | Dano de Raio e Chance de Eletrizar | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `46471` | Vínculo Poderoso | notavel | — | sem-efeito | alocavel | — | — |
| `46519` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `46578` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `46585` | Área de Efeito dos Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `46636` | Armadura e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `46672` | Dano Elemental de Cajados e Penetração | comum | dano % (aumentado e "mais"), penetração | funcional | aplicado | ficha | 3/4 |
| `46694` | Evasão e Efeito da Cegueira | comum | armadura e evasão, outros | funcional | aplicado | combate | 1/2 |
| `46726` | Eficiência de Custo de Mana e Vida | comum | mana %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `46730` | Dano de Ataques com Escudo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `46756` | Duração do Atordoamento | comum | atordoamento | funcional | validado | combate | 1/1 |
| `46842` | Potência Arcana | notavel | crítico | funcional | aplicado | ficha | 0/2 |
| `46882` | Encaixe de Joia Grande | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `46896` | Multiplicador de Dano Degenerativo e Regeneração de Vida | comum | afecções e chance no acerto, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `46897` | Armadura e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `46904` | Santuário Arcano | notavel | bloqueio, dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 1/3 |
| `46910` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `46965` | Sabotador | notavel | dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/2 |
| `47030` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `47062` | Dano Mágico e Inteligência | comum | dano % (aumentado e "mais"), atributos (For/Des/Int) | funcional | aplicado | ficha | 1/2 |
| `47065` | Mestre das Lâminas | notavel | outros, atributos (For/Des/Int), dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 2/3 |
| `47085` | Multiplicador de Dano de Magia Degenerativo e Duração | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/2 |
| `47251` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `47306` | Engasgador | notavel | crítico | funcional | validado | ficha | 1/1 |
| `47312` | Dano Elemental | comum | resistências, dano % (aumentado e "mais") | funcional | validado | ficha | 6/6 |
| `47321` | Chance de Crítico e Precisão com Garras | comum | precisão, crítico | funcional | aplicado | ficha | 1/2 |
| `47362` | Vida e Escudo de Energia ao Matar | comum | vida, regeneração e dreno de vida, efeito por evento | funcional | aplicado | ficha | 0/2 |
| `47389` | Dano de Ataque Físico e Vida | comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `47421` | Multiplicador de Dano Físico Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `47422` | Chance e Multiplicador de Crítico da Adaga | comum | crítico | funcional | validado | ficha | 2/2 |
| `47426` | Duração de Clamores | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `47427` | Dano e Duração do Atordoamento com Cajados | comum | dano % (aumentado e "mais"), atordoamento | funcional | validado | ficha | 3/3 |
| `47471` | Sobrecarregado | notavel | cargas e fúria | funcional | aplicado | ficha | 0/1 |
| `47484` | Percepção Profunda | notavel | precisão, crítico, precisão % | funcional | validado | ficha | 3/3 |
| `47504` | Velocidade de Conjuração e Eficiência de Custo de Mana de Magias | comum | velocidades | parcial | validado | ficha | 1/1 |
| `47507` | Multiplicador de Crítico Mágico | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `47743` | Perspicácia | notavel | dano % (aumentado e "mais"), velocidades, precisão | funcional | aplicado | ficha | 2/4 |
| `47785` | Ganho de Valor com Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `47854` | Chance de Empalamento e Velocidade de Ataque | comum | velocidades, afecções e chance no acerto | funcional-aproximado | aplicado | ficha | 1/2 |
| `47902` | Dano das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `47949` | Dano de Caos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `48093` | Velocidade de Conjuração em Dupla Empunhadura e Recuperação da Recarga de Habilidades de Movimento | comum | velocidades, outros | funcional | aplicado | ficha | 1/2 |
| `48099` | Vida e Anulação de Atordoamentos | comum | vida %, atordoamento | funcional | aplicado | ficha | 1/2 |
| `48109` | Regeneração de Vida por Carga de Tolerância | comum | vida, regeneração e dreno de vida | funcional | aplicado | combate | 0/1 |
| `48118` | Multiplicador de Dano Degenerativo | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `48128` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `48132` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `48199` | Fúria ao Acertar | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `48275` | Prevenção de Interrupções enquanto Conjurando | comum | — | sem-efeito | alocavel | — | — |
| `48282` | Chance de Crítico de Cajado | comum | crítico | funcional | validado | ficha | 1/1 |
| `48284` | Blqueio e Recuperação do Bloqueio | comum | bloqueio | parcial | validado | ficha | 2/2 |
| `48287` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `48298` | Inspirador | notavel | escudo de energia, mana %, mana e custo | funcional | aplicado | ficha | 2/3 |
| `48362` | Mana e Vida | comum | vida %, mana % | funcional | validado | ficha | 2/2 |
| `48423` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `48438` | Coragem | notavel | armadura e evasão, vida % | funcional | validado | ficha | 3/3 |
| `48477` | Velocidades de Ataque e Conjuração | comum | velocidades | funcional-aproximado | validado | ficha | 2/2 |
| `48513` | Dano de Ataque Físico | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `48514` | Mana e Regeneração de Mana | comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `48556` | Coração das Trevas | notavel | dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/1 |
| `48614` | Fervor | notavel | cargas e fúria | funcional | validado | ficha | 1/1 |
| `48679` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `48698` | Barreira de Vácuo | notavel | armadura e evasão, escudo de energia, supressão de magia | funcional | aplicado | combate | 2/3 |
| `48713` | Chance de Golpe Crítico de Lacaios | comum | — | sem-efeito | alocavel | — | — |
| `48768` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `48778` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `48807` | Arte do Gladiador | notavel | velocidades, atributos (For/Des/Int), precisão % | parcial | validado | ficha | 3/3 |
| `48813` | Dano e Bloqueio com Escudo | comum | bloqueio, dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `48822` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `48823` | Puxada Mortal | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 0/2 |
| `48828` | Dano Físico e Força | comum | atributos (For/Des/Int), dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `48878` | Precisão e Velocidade de Ataque da Varinha | comum | velocidades, precisão | funcional | aplicado | ficha | 1/2 |
| `48929` | Máximo de Resistência a Fogo | comum | resistências | funcional | aplicado | combate | 0/1 |
| `48971` | Dano de Caos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `49047` | Vida de Lacaios e Resistência a Caos | comum | vida, regeneração e dreno de vida, resistências | funcional | aplicado | combate | 1/2 |
| `49080` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `49109` | Armadura e Evasão | comum | armadura e evasão, resistências | funcional | validado | ficha | 5/5 |
| `49147` | Armadura e Recuperação da Recarga de Habilidades de Guarda | comum | armadura e evasão | parcial | validado | combate | 1/1 |
| `49167` | Duração de Clamores | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `49178` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `49254` | Retribuição | notavel | dano % (aumentado e "mais"), lacaios e totens, velocidades, atributos (For/Des/Int) | funcional | validado | ficha | 6/6 |
| `49308` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `49318` | Bola de Demolição | notavel | dano % (aumentado e "mais"), velocidades, atordoamento | funcional | aplicado | ficha | 0/4 |
| `49343` | Chance de Bloqueio e Dano de Ataques com Escudo | comum | bloqueio, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `49379` | Assassino de Aluguel | notavel | vida %, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `49407` | Recuperação da Recarga das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `49408` | Evasão e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `49412` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `49415` | Dano e Velocidade de Ataque da Espada | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `49416` | Inflexível | notavel | armadura e evasão | parcial | validado | combate | 1/1 |
| `49445` | Respirações Profundas | notavel | — | sem-efeito | alocavel | — | — |
| `49459` | Rei da Colina | notavel | crítico | funcional | validado | ficha | 1/1 |
| `49481` | Mana ao Acertar | comum | mana e custo | funcional | aplicado | ficha | 0/1 |
| `49515` | Supressão Mágica e Recarga do Escudo de Energia | comum | supressão de magia, escudo de energia | funcional | validado | ficha | 2/2 |
| `49534` | Dano Mágico com Cajados e Bloqueio Mágico | comum | dano % (aumentado e "mais"), bloqueio | funcional | aplicado | ficha | 0/2 |
| `49538` | Desafio | notavel | bloqueio, dano % (aumentado e "mais"), armadura e evasão | funcional | aplicado | ficha | 2/3 |
| `49547` | Dano e Bloqueio com Dupla Empunhadura | comum | bloqueio, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `49568` | Chance e Multiplicador de Crítico de Garra | comum | crítico | funcional | validado | ficha | 2/2 |
| `49571` | Dano e Velocidade de Ataque do Machado | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `49588` | Dano de Raio e Chance de Eletrizar | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `49605` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `49621` | Acuidade | notavel | velocidades, precisão, precisão % | funcional-aproximado | validado | ficha | 3/3 |
| `49635` | Ganho de Valor com Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `49639` | Ego Supremo | keystone | — | sem-efeito | alocavel | — | — |
| `49645` | Cauterização | notavel | outros | funcional | validado | combate | 2/2 |
| `49651` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `49652` | Duração do Incêndio e Sangramento | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/2 |
| `49684` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `49698` | Bloqueio com Cajados | comum | bloqueio | funcional | validado | ficha | 1/1 |
| `49772` | Poder Extremo | notavel | atributos (For/Des/Int) | funcional | aplicado | ficha | 1/2 |
| `49779` | Dano da Varinha | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `49806` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `49807` | Precisão | comum | precisão % | funcional | validado | ficha | 1/1 |
| `49900` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `49929` | Multiplicador de Crítico Mágico | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `49951` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `49969` | Coragem | notavel | armadura e evasão, supressão de magia | funcional | interpretado | condicional | 0/3 |
| `49971` | Duração da Carga de Frenesi | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `49978` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `50029` | Calma Inatural | notavel | escudo de energia, resistências | funcional | aplicado | ficha | 2/3 |
| `50038` | Dreno de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `50041` | Dano Físico de Arco | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `50082` | Multiplicador de Dano de Magia Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `50150` | Dano Elemental da Arma, Chance de Aflição de Status | comum | afecções e chance no acerto, dano % (aumentado e "mais") | funcional | validado | ficha | 6/6 |
| `50179` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `50197` | Conhecimento Ancestral | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `50225` | Multiplicador de Crítico de Maças | comum | crítico | funcional | validado | ficha | 2/2 |
| `50264` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `50288` | Vontade de Ferro | keystone | — | funcional | aplicado | ficha | — |
| `50306` | Armadura, Evasão e Vida | comum | armadura e evasão, vida % | funcional | validado | ficha | 3/3 |
| `50338` | Balística | notavel | velocidades, dano % (aumentado e "mais"), atributos (For/Des/Int) | funcional | aplicado | ficha | 2/3 |
| `50340` | Resistências Elementais | comum | resistências | funcional | validado | ficha | 3/3 |
| `50360` | Mana e Regeneração de Mana | comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `50382` | Velocidade de Conjuração em Dupla Empunhadura | comum | velocidades | funcional | validado | ficha | 1/1 |
| `50422` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `50472` | Dano da Varinha | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `50515` | Fortificação em Atordoamentos Corpo a Corpo | comum | — | sem-efeito | alocavel | — | — |
| `50562` | Multiplicador de Dano Ardente com Ataques | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `50570` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `50679` | Combatente Versátil | keystone | — | sem-efeito | alocavel | — | — |
| `50690` | Remédios Nutritivos | notavel | frascos | funcional | validado | combate | 5/5 |
| `50734` | Queima de Mana mais Lenta | comum | — | sem-efeito | alocavel | — | — |
| `50826` | Mana e Bloqueio Mágico | comum | bloqueio, mana % | funcional | aplicado | ficha | 1/2 |
| `50842` | Ira do Veterano | notavel | cargas e fúria | parcial | validado | combate | 1/1 |
| `50858` | Admoestador | notavel | velocidades | parcial | aplicado | combate | 0/1 |
| `50862` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `50904` | Vida e Armadura | comum | armadura e evasão, vida, regeneração e dreno de vida | funcional-aproximado | aplicado | ficha | 1/2 |
| `50969` | Área de Efeito Corpo a Corpo | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `51108` | Capacitor Arcano | notavel | mana % | parcial | validado | ficha | 1/1 |
| `51146` | Precisão e Velocidade de Ataque da Varinha | comum | velocidades, precisão | funcional | aplicado | ficha | 1/2 |
| `51191` | Duração de Maldições | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `51198` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `51212` | Entropia | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `51213` | Eficácia de Reserva de Arautos | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `51219` | Dreno de Escudo de Energia | comum | escudo de energia | funcional | aplicado | combate | 0/1 |
| `51220` | Dano Físico e de Caos | comum | dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `51233` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `51235` | Prevenção de Atordoamento | comum | atordoamento | funcional | aplicado | combate | 0/1 |
| `51291` | Área de Efeito | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `51382` | Duração de Maldições | comum | afecções e chance no acerto | funcional | validado | combate | 1/1 |
| `51404` | Dano de Gelo da Arma | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `51420` | Drenagem de Mana | comum | mana e custo | funcional | aplicado | ficha | 0/1 |
| `51440` | Ritual Druídico | notavel | mana %, frascos | funcional | validado | ficha | 2/2 |
| `51517` | Vida de Lacaios e Resistência a Caos | comum | vida, regeneração e dreno de vida, resistências | funcional | aplicado | combate | 1/2 |
| `51524` | Precisão e Velocidade de Ataque da Varinha | comum | velocidades, precisão | funcional | aplicado | ficha | 1/2 |
| `51559` | Golpes Esmagadores | notavel | dano % (aumentado e "mais"), crítico | funcional | aplicado | ficha | 3/4 |
| `51748` | Últimos Ritos | notavel | outros, cargas e fúria | funcional | validado | combate | 3/3 |
| `51786` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `51801` | Área de Efeito com Magias | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `51804` | Dano de Magia Degenerativo | comum | — | sem-efeito | alocavel | — | — |
| `51856` | Dano de Ataque Físico | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `51881` | Mestre Flecheiro | notavel | área e projéteis | funcional | aplicado | combate | 0/1 |
| `51923` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `51953` | Ângulo Bifurcado | comum | — | sem-efeito | alocavel | — | — |
| `51954` | Chance de Crítico com Runas | comum | crítico | funcional | validado | ficha | 1/1 |
| `51976` | Velocidade de Ataque e Bloqueio com Empunhadura Dupla | comum | bloqueio, velocidades | funcional | validado | ficha | 2/2 |
| `52030` | Explosão Enérgica | notavel | — | sem-efeito | alocavel | — | — |
| `52031` | Desintegração | notavel | crítico, atributos (For/Des/Int) | funcional | validado | ficha | 3/3 |
| `52090` | Ladrão de Inimigos | notavel | dano % (aumentado e "mais"), crítico, precisão | funcional | validado | ficha | 4/4 |
| `52095` | Resistência a Caos | comum | resistências | funcional | validado | ficha | 1/1 |
| `52099` | Duração de Habilidades Reduzida | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `52157` | Sifão d'Alma | notavel | mana e custo, mana % | funcional | aplicado | ficha | 1/3 |
| `52213` | Dano da Espada e Bloqueio | comum | bloqueio, dano % (aumentado e "mais") | funcional | validado | ficha | 4/4 |
| `52230` | Caçador Veterano | notavel | precisão, resistências, precisão % | funcional | validado | ficha | 5/5 |
| `52288` | Dano e Velocidade de Projéteis | comum | velocidades, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `52407` | Multiplicador de Golpe Crítico de Raio | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `52412` | Vida e Dano de Lacaios | comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `52423` | Chance de Cegar | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `52502` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `52522` | Chance de Golpes Críticos de Minas | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `52632` | Precisão | comum | precisão % | funcional | validado | ficha | 1/1 |
| `52655` | Duração de Runas | comum | — | sem-efeito | alocavel | — | — |
| `52714` | Proeza | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `52742` | Morte Apressada | notavel | velocidades, afecções e chance no acerto | parcial | aplicado | ficha | 1/2 |
| `52789` | Círculo da Vida | notavel | vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `52848` | Chance e Multiplicador de Crítico de Varinha | comum | crítico | funcional | validado | ficha | 2/2 |
| `52904` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `53002` | Armadura, Evasão e Efeito de Agressividade | comum | armadura e evasão, outros | funcional | aplicado | combate | 2/3 |
| `53005` | Chance de Congelamento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `53013` | Atrofia | notavel | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 0/2 |
| `53018` | Dano e Duração de Runas | comum | dano % (aumentado e "mais") | parcial | validado | ficha | 1/1 |
| `53042` | Performance Excepcional | notavel | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `53072` | Multiplicador de Dano Ardente com Ataques | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `53114` | Vingança dos Caçados | notavel | armadura e evasão, vida %, supressão de magia | funcional | aplicado | ficha | 2/3 |
| `53118` | Barbarismo | notavel | vida %, resistências | funcional | aplicado | ficha | 2/3 |
| `53203` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `53213` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `53279` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `53290` | Efeito de Resfriamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `53292` | Efeito de Empalar | comum | outros | funcional | aplicado | combate | 0/1 |
| `53324` | Evasão e Trespassar | comum | armadura e evasão, efeito por evento | funcional | aplicado | combate | 1/2 |
| `53332` | Decaimento Lento da Fúria | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `53456` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `53493` | Aniquilação | notavel | crítico | funcional | aplicado | ficha | 0/2 |
| `53558` | Defesas com Escudos | comum | armadura e evasão | funcional | aplicado | combate | 0/1 |
| `53573` | Extensão Arcana | notavel | área e projéteis | funcional | aplicado | combate | 0/1 |
| `53574` | Velocidade de Conjuração de Marcas e Eficiência de Custo de Mana | comum | — | sem-efeito | alocavel | — | — |
| `53630` | Chance de Incêndio com Ataques | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `53652` | Mergulhado na Profanidade | notavel | auras, maldições e reserva | funcional | aplicado | combate | 0/2 |
| `53667` | Efeito de Empalamentos | comum | outros | funcional | aplicado | combate | 0/1 |
| `53677` | Dano dos Lacaios | comum | lacaios e totens | funcional | validado | combate | 1/1 |
| `53732` | Multiplicador de Dano Degenerativo de Gelo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `53757` | Fúria Xamânica | notavel | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 0/2 |
| `53793` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `53802` | Extração de Essência | notavel | frascos | parcial | validado | combate | 1/1 |
| `53809` | Duração de Frascos | comum | frascos | funcional | validado | combate | 1/1 |
| `53840` | Vingança | notavel | armadura e evasão, efeito por evento | funcional | aplicado | combate | 0/2 |
| `53882` | Efeito de Tinturas e Frascos | comum | frascos | parcial | aplicado | combate | 0/1 |
| `53945` | Precisão com Cajados | comum | precisão | funcional | aplicado | ficha | 0/1 |
| `53957` | Chance de Acerto Crítico com Cajados e Multiplicador | comum | crítico | funcional | validado | ficha | 2/2 |
| `53987` | Duração de Clamores e Efeito do Buff | comum | afecções e chance no acerto, outros | funcional | aplicado | combate | 0/2 |
| `54043` | Dano Elemental da Varinha E Penetração | comum | dano % (aumentado e "mais"), penetração | funcional | aplicado | ficha | 3/4 |
| `54127` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `54142` | Sutileza | notavel | velocidades, atributos (For/Des/Int), precisão % | funcional-aproximado | validado | ficha | 3/3 |
| `54144` | Dupla Empunhadura e Velocidade de Conjuração e Bloqueio | comum | bloqueio, velocidades | funcional | validado | ficha | 3/3 |
| `54267` | Resistência a Dano de Caos e Dano dos Lacaios | comum | resistências, lacaios e totens | funcional | validado | ficha | 2/2 |
| `54268` | Barreira de Lâmina | notavel | bloqueio, dano % (aumentado e "mais") | parcial | validado | ficha | 2/2 |
| `54307` | Acrobacia | keystone | — | sem-efeito | alocavel | — | — |
| `54338` | Dano Físico | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 1/1 |
| `54354` | Dano da Espada | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `54396` | Multiplicador de Dano Incendiário | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `54452` | Aumento do Dreno de Escudo de Energia | comum | escudo de energia | funcional | aplicado | combate | 0/1 |
| `54574` | Área de Ativação de Armadilhas | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `54600` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `54629` | Inexorável | notavel | cargas e fúria, armadura e evasão | funcional | aplicado | ficha | 0/2 |
| `54645` | Multiplicador de Golpe Crítico de Raio | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `54657` | Velocidade de Conjuração | comum | velocidades | funcional | validado | ficha | 1/1 |
| `54667` | Bloqueio com Cajados | comum | bloqueio | funcional | aplicado | ficha | 1/2 |
| `54694` | Luz da Divindade | notavel | dano % (aumentado e "mais"), crítico, atributos (For/Des/Int) | parcial | aplicado | ficha | 2/4 |
| `54713` | Modelador de Força | notavel | conversão / dano extra, velocidades | funcional | aplicado | ficha | 2/3 |
| `54776` | Fluxo de Mana | notavel | mana %, mana e custo, atributos (For/Des/Int) | funcional | validado | ficha | 3/3 |
| `54791` | Garras da Gralha | notavel | dano % (aumentado e "mais"), velocidades | parcial | validado | ficha | 3/3 |
| `54862` | Duração da Usabilidade das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `54868` | Dano com Arcos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `54872` | Velocidade do Dreno de Mana | comum | outros | funcional | validado | combate | 1/1 |
| `54880` | Área de Efeito dos Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `54922` | Dança da Flecha | keystone | — | sem-efeito | alocavel | — | — |
| `54954` | Maldições e Resistência a Caos | comum | resistências, auras, maldições e reserva | funcional | aplicado | ficha | 1/2 |
| `54974` | Área de Ativação de Armadilhas | comum | área e projéteis | funcional | aplicado | combate | 0/1 |
| `55002` | Fúria Justificada | notavel | dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/1 |
| `55021` | Recuperação da Recarga de Habilidades de Postura | comum | — | sem-efeito | alocavel | — | — |
| `55027` | Justiça Brilhante | notavel | — | sem-efeito | alocavel | — | — |
| `55085` | Armadura e Evasão | comum | armadura e evasão | funcional | validado | combate | 2/2 |
| `55114` | Intelecto Extremo | notavel | atributos (For/Des/Int) | funcional | aplicado | ficha | 1/2 |
| `55166` | Dano e Velocidade de Ataque da Espada | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `55190` | Encaixe de Joia Grande | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `55194` | Cinzas Assentadas | notavel | — | sem-efeito | alocavel | — | — |
| `55247` | Vida e Escudo de Energia | comum | escudo de energia, vida % | funcional | validado | ficha | 2/2 |
| `55307` | Anulação de Incêndios | comum | outros | funcional | aplicado | combate | 0/1 |
| `55332` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `55373` | Vida e Força | comum | vida, regeneração e dreno de vida, atributos (For/Des/Int) | funcional | validado | ficha | 2/2 |
| `55380` | Construção Inteligente | notavel | — | sem-efeito | alocavel | — | — |
| `55381` | Retaliação Arcana | notavel | — | sem-efeito | alocavel | — | — |
| `55392` | Armadura e Evasão | comum | armadura e evasão | funcional | validado | combate | 2/2 |
| `55414` | Dano da Adaga | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `55420` | Fúria ao Acertar | comum | cargas e fúria | funcional | validado | combate | 1/1 |
| `55485` | Constituição | notavel | vida, regeneração e dreno de vida, vida % | funcional | validado | ficha | 2/2 |
| `55558` | Vida ao Matar contra Inimigos Amaldiçoados | comum | efeito por evento | funcional | aplicado | combate | 0/1 |
| `55563` | Regeneração de Vida do Lacaio | comum | lacaios e totens | funcional | aplicado | combate | 0/1 |
| `55571` | Efeito da Aura | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `55643` | Escudo de Energia | comum | escudo de energia | funcional | aplicado | ficha | 1/2 |
| `55647` | Dano de Raio | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `55648` | Velocidade de Ataque do Totem | comum | lacaios e totens | funcional | aplicado | combate | 0/1 |
| `55649` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `55676` | Vida e Armadura | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `55706` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `55743` | Bloqueio Mágico | comum | bloqueio | funcional | aplicado | ficha | 0/2 |
| `55750` | Multiplicador e Chance de Golpes Críticos com Arcos | comum | crítico | funcional | validado | ficha | 2/2 |
| `55772` | Influência do Ferreiro | notavel | dano % (aumentado e "mais"), crítico | funcional | validado | ficha | 6/6 |
| `55804` | Vida Recuperada | comum | vida, regeneração e dreno de vida | funcional | validado | combate | 1/1 |
| `55854` | Dano Físico | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 1/1 |
| `55866` | Dano Elemental | comum | resistências, dano % (aumentado e "mais") | funcional | validado | ficha | 6/6 |
| `55880` | Dano contra Inimigos Marcados | comum | — | sem-efeito | alocavel | — | — |
| `55906` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `55913` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `55926` | Bloqueio com Cajados | comum | bloqueio | funcional | validado | ficha | 1/1 |
| `55993` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `56001` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `56029` | Agilidade | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `56066` | Dano Elemental da Varinha | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `56075` | Bateria Anciã | keystone | outros, escudo de energia | funcional | validado | combate | 3/3 |
| `56090` | Evasão e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `56094` | Um com o Rio | notavel | dano % (aumentado e "mais"), penetração | funcional | aplicado | ficha | 3/4 |
| `56116` | Terror dos Magos | keystone | outros, supressão de magia | funcional | validado | ficha | 2/2 |
| `56149` | Precisão e Dano com Ataques | comum | dano % (aumentado e "mais"), precisão % | funcional | validado | ficha | 2/2 |
| `56153` | Dano Mágico | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `56158` | Dano Mágico por Carga de Poder | comum | dano % (aumentado e "mais") | funcional | aplicado | combate | 0/1 |
| `56174` | Dano e Velocidade de Ataque da Adaga | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `56186` | Multiplicador de Dano de Gelo Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `56231` | Dano e Bloqueio com Dupla Empunhadura | comum | bloqueio, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `56276` | Caçador Noturno | notavel | crítico, vida, regeneração e dreno de vida, mana e custo | funcional | aplicado | ficha | 2/3 |
| `56295` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `56330` | Fluxo da Batalha | notavel | — | sem-efeito | alocavel | — | — |
| `56355` | Chance de Crítico Corpo a Corpo | comum | crítico | funcional | validado | ficha | 2/2 |
| `56359` | Ritual Canibalístico | notavel | mana e custo | funcional | aplicado | combate | 0/2 |
| `56370` | Fortificação em Atordoamentos Corpo a Corpo | comum | — | sem-efeito | alocavel | — | — |
| `56381` | Dano Corpo a Corpo e Velocidade de Ataque com Duas Mãos | comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 0/3 |
| `56439` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `56460` | Multiplicador de Crítico Corpo a Corpo | comum | crítico | funcional | validado | ficha | 1/1 |
| `56509` | Dano da Espada e Bloqueio | comum | bloqueio, dano % (aumentado e "mais") | funcional | validado | ficha | 4/4 |
| `56589` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `56646` | Dano Elemental da Arma | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `56648` | Garras do Falcão | notavel | precisão, crítico | funcional | aplicado | ficha | 1/2 |
| `56659` | Efeito de Empalamentos | comum | outros | funcional | aplicado | combate | 0/1 |
| `56671` | Dano de Caos e Expiração do Definhamento | comum | dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/1 |
| `56716` | Coração Trovejante | notavel | dano % (aumentado e "mais"), penetração | funcional | aplicado | ficha | 1/2 |
| `56803` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `56807` | Bloqueio | comum | bloqueio | funcional | validado | ficha | 2/2 |
| `56814` | Evasão | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `56855` | Velocidade de Ataque com Arcos e Trespassar | comum | velocidades, efeito por evento | funcional | aplicado | ficha | 1/2 |
| `56920` | Recuperação da Recarga das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `56922` | Eficiência de Reserva | comum | auras, maldições e reserva, mana e custo | funcional | aplicado | combate | 0/2 |
| `56982` | Redução de Limite de Atordoamento | comum | atordoamento | funcional | validado | combate | 1/1 |
| `57011` | Duração do Atordoamento por Carga de Tolerância | comum | atordoamento | funcional | interpretado | condicional | 0/1 |
| `57030` | Chance de Envenenamento e Dano | comum | afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `57044` | Anulação de Sangramento | comum | outros | funcional | aplicado | combate | 0/1 |
| `57061` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `57080` | Precisão e Velocidade de Ataque | comum | velocidades, precisão % | funcional-aproximado | validado | ficha | 2/2 |
| `57167` | Mana e Efeito da Fúria Arcana | comum | mana % | parcial | validado | ficha | 1/1 |
| `57194` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `57199` | Presas de Gelo | notavel | penetração, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `57226` | Escudo de Energia e mana | comum | escudo de energia, mana e custo | funcional | aplicado | ficha | 0/2 |
| `57240` | Mana e Efeito de Frascos | comum | mana %, frascos | funcional | aplicado | ficha | 1/2 |
| `57248` | Velocidades de Ataque e Conjuração | comum | velocidades | funcional-aproximado | validado | ficha | 2/2 |
| `57257` | O Empalador | keystone | outros, bloqueio | funcional | validado | combate | 3/3 |
| `57259` | Ganho de Cargas de Frascos de Mana | comum | frascos | funcional | validado | combate | 2/2 |
| `57264` | Dano Mágico e Mana | comum | dano % (aumentado e "mais"), mana e custo | funcional | aplicado | ficha | 0/2 |
| `57266` | Dano da Maça e Limite de Atordoamento Inimigo Reduzido | comum | dano % (aumentado e "mais"), atordoamento | funcional | validado | ficha | 6/6 |
| `57279` | Magia Sanguínea | keystone | vida %, mana % | funcional-aproximado | validado | ficha | 2/2 |
| `57283` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `57362` | Dano de Raio | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `57404` | Efeito dos Vínculos | comum | — | sem-efeito | alocavel | — | — |
| `57449` | Evasão por Carga de Frenesi | comum | armadura e evasão | funcional | aplicado | combate | 0/1 |
| `57457` | Velocidade de Ataque e Conjuração em Dupla Empunhadura | comum | velocidades | funcional | validado | ficha | 2/2 |
| `57565` | Eficiência de Custo de Mana de Conexão | comum | — | sem-efeito | alocavel | — | — |
| `57615` | Velocidade de Arremesso de Minas | comum | velocidades | funcional | aplicado | combate | 0/1 |
| `57651` | Sangramento Agravado na Chance de Golpe Crítico | comum | — | sem-efeito | alocavel | — | — |
| `57736` | Efeito da Aura | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `57746` | Resistência a Caos e Prevenção | comum | resistências, outros | funcional | aplicado | ficha | 1/3 |
| `57819` | Velocidade de Ataque e Precisão do Arco | comum | velocidades, precisão | funcional | aplicado | ficha | 1/2 |
| `57839` | Lâmina da Astúcia | notavel | precisão, crítico | funcional | aplicado | ficha | 2/3 |
| `57900` | Comando do Aço | notavel | bloqueio, armadura e evasão | funcional | aplicado | ficha | 1/2 |
| `57923` | Duração do Atordoamento | comum | atordoamento | funcional | validado | combate | 1/1 |
| `57953` | Dano e Velocidade de Ataque do Machado | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 3/3 |
| `57992` | Efeito do Buff de Clamores | comum | outros | funcional | aplicado | combate | 0/1 |
| `58032` | Feiticeiro Sinuoso | notavel | outros, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `58069` | Dano com Uma Mão | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `58168` | Alta Voltagem | notavel | crítico | funcional | aplicado | ficha | 0/1 |
| `58194` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `58198` | Dedos de Gelo | notavel | outros, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `58210` | Dano Mágico com Escudos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/1 |
| `58214` | Velocidade de Ataque e Bloqueio com Empunhadura Dupla | comum | bloqueio, velocidades | funcional | validado | ficha | 2/2 |
| `58218` | Pureza da Carne | notavel | escudo de energia, vida %, resistências | funcional | validado | ficha | 3/3 |
| `58244` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `58271` | Vida e Evasão a Afecção Elemental | comum | vida %, afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `58288` | Velocidade e Dano com Totens | comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 0/2 |
| `58336` | Ganho de Valor com Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `58355` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `58382` | Feitos Renomados | notavel | — | sem-efeito | alocavel | — | — |
| `58402` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `58449` | Nascido para Lutar | notavel | velocidades, atributos (For/Des/Int), dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 3/3 |
| `58453` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `58474` | Dano Físico como Dano de Gelo Extra | comum | conversão / dano extra | funcional | aplicado | combate | 0/1 |
| `58541` | Dano e Velocidade de Ataque com Maças | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 5/5 |
| `58545` | Mana e Área de Efeito de Aura | comum | mana % | parcial | validado | ficha | 1/1 |
| `58556` | Escudo Divino | keystone | — | sem-efeito | alocavel | — | — |
| `58603` | Chance de Congelar | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `58604` | Dano de Raio | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `58649` | Evasão e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `58763` | Dano de Gelo e Raio | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `58803` | Chance de Crítico e Precisão Corpo a Corpo com Duas Mãos | comum | precisão, crítico | funcional | aplicado | ficha | 0/2 |
| `58831` | Estripar | notavel | crítico | funcional | validado | ficha | 2/2 |
| `58851` | Líder da Matilha | notavel | auras, maldições e reserva | parcial | aplicado | combate | 0/1 |
| `58854` | Evasão | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `58869` | Velocidade de Conjuração de Maldições | comum | velocidades | funcional | aplicado | combate | 0/1 |
| `58921` | Discipulo da Matança | notavel | cargas e fúria, dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/3 |
| `58968` | Multiplicador de Dano de Caos Degenerativo | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `59005` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `59009` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `59016` | Bloqueio e Velocidade de Ataque em Dupla Empunhadura | comum | bloqueio, velocidades | funcional | validado | ficha | 2/2 |
| `59070` | Alcance de Runas e Recuperação da Recarga de Runas | comum | — | sem-efeito | alocavel | — | — |
| `59151` | Lâmina Brutal | notavel | bloqueio, dano % (aumentado e "mais"), cargas e fúria | funcional | aplicado | ficha | 4/5 |
| `59220` | Chance de Crítico | comum | crítico | funcional | validado | ficha | 1/1 |
| `59252` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `59306` | Dano Físico | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 1/1 |
| `59370` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `59423` | Escalonamento | notavel | — | sem-efeito | alocavel | — | — |
| `59482` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `59494` | Precisão e Chance de Crítico | comum | crítico, precisão % | funcional | validado | ficha | 2/2 |
| `59556` | Munições Rápidas | notavel | área e projéteis, velocidades | funcional | aplicado | combate | 0/2 |
| `59585` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `59605` | Munições Instáveis | notavel | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 0/3 |
| `59606` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `59650` | Escudo de Energia e Regeneração de Mana | comum | escudo de energia, mana e custo | funcional | aplicado | ficha | 1/2 |
| `59699` | Dreno de Escudo de Energia | comum | escudo de energia | funcional | aplicado | combate | 0/1 |
| `59718` | Armadura, Evasão e Vida | comum | armadura e evasão, vida % | funcional | validado | ficha | 3/3 |
| `59728` | Dano da Área de Efeito | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `59766` | Técnicas Sujas | notavel | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `59833` | Chance de Empalar | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `59861` | Regeneração de Vida | comum | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `59866` | Entrincheirar | notavel | supressão de magia | parcial | validado | ficha | 1/1 |
| `59928` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `59976` | Contra-ataque Cuidadoso | notavel | — | sem-efeito | alocavel | — | — |
| `60002` | Disparos da Fúria | notavel | velocidades, dano % (aumentado e "mais"), atributos (For/Des/Int) | funcional | aplicado | ficha | 2/3 |
| `60031` | Pele Prismática | notavel | resistências | funcional | aplicado | combate | 0/3 |
| `60085` | Preservação Arcana | notavel | velocidades, atributos (For/Des/Int) | parcial | aplicado | ficha | 1/2 |
| `60090` | Escudo de Energia | comum | escudo de energia | funcional | validado | combate | 1/1 |
| `60145` | Efeito dos Vínculos | comum | — | sem-efeito | alocavel | — | — |
| `60153` | Dano de Ataques Físicos | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `60169` | Dano Corpo a Corpo com Duas Mãos | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `60180` | Ofício do Ladrão | notavel | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `60204` | Evasão e Supressão Mágica | comum | supressão de magia, armadura e evasão | funcional | validado | ficha | 2/2 |
| `60247` | Solipsismo | keystone | escudo de energia, afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `60259` | Evasão e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `60388` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `60398` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `60405` | Chance de Crítico Mágico | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `60440` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `60472` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `60501` | Coração Flamejante | notavel | dano % (aumentado e "mais"), penetração | funcional | aplicado | ficha | 1/2 |
| `60529` | Chance de Empalamentos | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `60532` | Velocidade de Movimento | comum | velocidades | funcional | validado | ficha | 1/1 |
| `60554` | Dano do Lacaio | comum | lacaios e totens | funcional | validado | combate | 1/1 |
| `60592` | Precisão e Chance de Crítico | comum | crítico, precisão % | funcional | validado | ficha | 2/2 |
| `60619` | Martelo Galvânico | notavel | precisão, dano % (aumentado e "mais"), penetração | funcional | aplicado | ficha | 6/9 |
| `60648` | Frascos de Mana | comum | frascos | funcional | aplicado | combate | 1/2 |
| `60735` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `60737` | Mãos Hábeis | notavel | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 0/3 |
| `60740` | Dano e Duração do Atordoamento com Cajados | comum | dano % (aumentado e "mais"), atordoamento | funcional | validado | ficha | 3/3 |
| `60781` | Vínculo Inspirador | notavel | — | sem-efeito | alocavel | — | — |
| `60803` | Evasão | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `60887` | Chance de Sangramento | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `60942` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `60949` | Dano de Armadilha e Mina | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/2 |
| `60963` | Ganho de Valor com Estandartes | comum | — | sem-efeito | alocavel | — | — |
| `60989` | Efeito de Buff de Arautos | comum | — | sem-efeito | alocavel | — | — |
| `61007` | Precisão | comum | precisão, precisão % | funcional | validado | ficha | 2/2 |
| `61039` | Voracidade Selvagem | notavel | vida, regeneração e dreno de vida, outros | funcional | validado | ficha | 2/2 |
| `61050` | Multiplicador de Crítico com Espadas | comum | crítico | funcional | validado | ficha | 1/1 |
| `61190` | Ícone da União | notavel | — | sem-efeito | alocavel | — | — |
| `61198` | Coração do Guerreiro | notavel | vida, regeneração e dreno de vida, vida %, atributos (For/Des/Int) | funcional | validado | ficha | 3/3 |
| `61217` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `61262` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `61264` | Dano de Raio e Chance de Eletrizar | comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `61283` | Mana ao Matar contra Inimigos Amaldiçoados | comum | efeito por evento | funcional | aplicado | combate | 0/1 |
| `61288` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `61305` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `61306` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `61308` | Amplificar | notavel | área e projéteis, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `61320` | Vida e Escudo de Energia | comum | escudo de energia, vida % | funcional | validado | ficha | 2/2 |
| `61327` | Dano de Gelo da Arma | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `61351` | Redução do Ponto de Atordoamento | comum | atordoamento | funcional | validado | combate | 1/1 |
| `61388` | Chance de Empalamentos com Armas de Duas Mãos | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `61419` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `61471` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `61573` | Efeito de Tinturas | comum | — | sem-efeito | alocavel | — | — |
| `61602` | Velocidade de Clamores | comum | velocidades | funcional-aproximado | aplicado | combate | 0/1 |
| `61636` | Chance de Crítico Corpo a Corpo | comum | crítico | funcional | validado | ficha | 1/1 |
| `61653` | Vida e Escudo de Energia | comum | escudo de energia, vida % | funcional | validado | ficha | 2/2 |
| `61666` | Encaixe de Joia Pequena | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `61689` | Elementos Explosivos | notavel | penetração | funcional | aplicado | ficha | 0/1 |
| `61804` | Dano de Fogo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `61834` | Encaixe de Joia Básico | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `61868` | Armadura | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `61875` | Vida e Vida ao Matar | comum | vida %, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 1/2 |
| `61950` | Dano Elemental e Precisão da Maça | comum | precisão, dano % (aumentado e "mais") | funcional | aplicado | ficha | 6/8 |
| `61981` | Conjuro da Ruína | notavel | crítico | funcional | aplicado | ficha | 0/2 |
| `61982` | Graves Intenções | notavel | resistências | parcial | aplicado | combate | 0/1 |
| `62017` | Vida e Armadura | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `62021` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `62042` | Dano da Espada | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `62069` | Dano Elemental | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `62094` | Fome de Sangue | notavel | vida, regeneração e dreno de vida, outros | funcional | validado | ficha | 2/2 |
| `62103` | Dano de Projétil e Destreza | comum | dano % (aumentado e "mais"), atributos (For/Des/Int) | funcional | validado | ficha | 2/2 |
| `62108` | Drenagem de Vida e Velocidade de Ataque | comum | velocidades, vida, regeneração e dreno de vida | funcional-aproximado | validado | ficha | 2/2 |
| `62109` | Recuperação da Recarga das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `62214` | Bloqueio Mágico com Escudo e Resistências Elementais com Escudo | comum | bloqueio, resistências | funcional | aplicado | ficha | 3/4 |
| `62217` | Velocidade de Ataque e Precisão da Varinha | comum | velocidades, precisão | funcional | aplicado | ficha | 1/2 |
| `62303` | Eficiência de Custo de Mana e Vida | comum | mana %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `62319` | Dano Corpo a Corpo | comum | dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `62363` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `62429` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `62480` | Eficiência de Custo de Mana de Maldições | comum | — | sem-efeito | alocavel | — | — |
| `62490` | Anulação de Envenenamento | comum | outros | funcional | aplicado | combate | 0/1 |
| `62530` | Duração de Fortificações | comum | — | sem-efeito | alocavel | — | — |
| `62577` | Pulso de Essência | notavel | escudo de energia | funcional | aplicado | ficha | 0/2 |
| `62662` | Dano Físico | comum | dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 1/1 |
| `62694` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `62697` | Chance de Eletrização | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `62712` | Dano de Projétil | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `62721` | Efeito das Tinturas | comum | — | sem-efeito | alocavel | — | — |
| `62744` | Supressão Mágica | comum | supressão de magia | funcional | validado | ficha | 1/1 |
| `62767` | Bloqueio Mágico e Resistências Elementais | comum | resistências, bloqueio | funcional | aplicado | ficha | 3/5 |
| `62791` | Sombra Fluvial | keystone | outros, afecções e chance no acerto | funcional | validado | combate | 2/2 |
| `62795` | Evasão e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `62802` | Beira da Morte | notavel | vida, regeneração e dreno de vida | funcional | validado | ficha | 1/1 |
| `62831` | Dano Físico e de Caos | comum | dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `62849` | Jaula Glacial | notavel | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `62879` | Dano com Habilidades de Retaliação e Bloqueio com Escudos | comum | bloqueio | parcial | aplicado | ficha | 0/1 |
| `62970` | Velocidade de Conjuração de Escudos | comum | velocidades | funcional | validado | ficha | 1/1 |
| `63027` | Dano de Ataques Impelidos | comum | — | sem-efeito | alocavel | — | — |
| `63033` | Porta Estandarte | notavel | — | sem-efeito | alocavel | — | — |
| `63039` | Efeito de Buff de Arautos | comum | — | sem-efeito | alocavel | — | — |
| `63048` | Vida e Armadura | comum | armadura e evasão, vida % | funcional | validado | ficha | 2/2 |
| `63067` | Dano e Velocidade de Ataque da Varinha | comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 2/2 |
| `63138` | Bloqueio Mágico e Resistências Elementais | comum | resistências, bloqueio | funcional | aplicado | ficha | 3/5 |
| `63139` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `63150` | Pau-Ferro | notavel | vida, regeneração e dreno de vida | parcial | aplicado | combate | 0/1 |
| `63194` | Eficácia da Reserva | comum | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `63207` | Explosão Tempestuosa | notavel | — | sem-efeito | alocavel | — | — |
| `63228` | Mana | comum | mana % | funcional | validado | ficha | 1/1 |
| `63251` | Inveterado | notavel | supressão de magia | parcial | validado | ficha | 1/1 |
| `63282` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `63306` | Dano com Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `63398` | Chance de Crítico Mágico | comum | crítico | funcional | aplicado | ficha | 0/1 |
| `63413` | Chance de Empalamento e Velocidade de Ataque | comum | velocidades, afecções e chance no acerto | funcional-aproximado | aplicado | ficha | 1/2 |
| `63422` | Lascívia por Carnificina | notavel | velocidades, vida, regeneração e dreno de vida | funcional-aproximado | validado | ficha | 2/2 |
| `63425` | Juramento do Zelote | keystone | outros | funcional | validado | ficha | 1/1 |
| `63439` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `63447` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `63453` | Sustento Excessivo | notavel | — | sem-efeito | alocavel | — | — |
| `63558` | Dano de Magia e Recuperação contra Atordoamento | comum | dano % (aumentado e "mais"), atordoamento | funcional | aplicado | ficha | 0/2 |
| `63618` | Dano e Velocidade de Posicionamento do Totem | comum | dano % (aumentado e "mais"), velocidades | funcional | aplicado | ficha | 0/2 |
| `63620` | Técnica Precisa | keystone | — | funcional | aplicado | ficha | — |
| `63635` | Manifestação Primitiva | notavel | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | parcial | aplicado | ficha | 0/2 |
| `63639` | Dano e Escudo de Energia | comum | dano % (aumentado e "mais"), escudo de energia | funcional | aplicado | ficha | 1/2 |
| `63649` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `63723` | Força | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `63727` | Perseverança do Gladiador | notavel | velocidades, vida, regeneração e dreno de vida, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 2/3 |
| `63754` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `63795` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `63799` | Vida e Escudo de Energia | comum | escudo de energia, vida % | funcional | validado | ficha | 2/2 |
| `63843` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `63845` | Velocidade de Conjuração | comum | velocidades | funcional | validado | ficha | 1/1 |
| `63903` | Chama Voraz | keystone | — | sem-efeito | alocavel | — | — |
| `63921` | Rapidez Extrema | notavel | atributos (For/Des/Int) | funcional | aplicado | ficha | 1/2 |
| `63933` | Zelo Totêmico | notavel | velocidades, lacaios e totens | parcial | aplicado | combate | 0/2 |
| `63944` | Tecelão Prismático | notavel | velocidades, dano % (aumentado e "mais"), penetração | funcional | aplicado | ficha | 4/5 |
| `63963` | Dano de Gelo | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `63965` | Dano Elemental | comum | dano % (aumentado e "mais"), mana e custo | funcional | aplicado | ficha | 1/2 |
| `63976` | Modelador | notavel | mana e custo, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `64024` | Multiplicador de Crítico com Espadas | comum | crítico | funcional | validado | ficha | 1/1 |
| `64077` | Treinamento de Guerreiro | notavel | outros, área e projéteis | funcional | aplicado | combate | 0/2 |
| `64166` | Proxy de Posicionamento | comum | — | nao-classificado | alocavel | — | — |
| `64181` | Área de Efeito de Clamores | comum | — | sem-efeito | alocavel | — | — |
| `64210` | Inteligência | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `64221` | Armadura | comum | armadura e evasão | funcional | validado | combate | 1/1 |
| `64226` | Rugido Desafiador | notavel | — | sem-efeito | alocavel | — | — |
| `64235` | Evasão e Resistências Elementais | comum | armadura e evasão, resistências | funcional | validado | ficha | 4/4 |
| `64238` | Área de Efeito das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `64239` | Dano Físico da Varinha | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `64241` | Anulação de Resfriamentos e Congelamentos | comum | outros | funcional | aplicado | combate | 0/2 |
| `64257` | Velocidade das Habilidades de Retaliação | comum | — | sem-efeito | alocavel | — | — |
| `64265` | Área de Efeito da Aura | comum | — | sem-efeito | alocavel | — | — |
| `64284` | Recuperação da Recarga de Habilidades de Postura | comum | — | sem-efeito | alocavel | — | — |
| `64355` | Equidade de Runas | notavel | — | sem-efeito | alocavel | — | — |
| `64395` | Contusão | notavel | crítico | parcial | validado | ficha | 2/2 |
| `64401` | Vida e Mana ao Matar contra Inimigos Amaldiçoados | comum | efeito por evento | funcional | aplicado | combate | 0/2 |
| `64426` | Resistências Elementais com Escudo | comum | resistências | funcional | validado | ficha | 3/3 |
| `64501` | Evasão e Escudo de Energia | comum | armadura e evasão, escudo de energia | funcional | validado | combate | 2/2 |
| `64509` | Dano de Afecções com Adagas | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 1/1 |
| `64583` | Encaixe de Joia Média | encaixe-de-joia | — | nao-classificado | alocavel | — | — |
| `64587` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `64612` | Danod e Raio com Varinhas | comum | — | sem-efeito | alocavel | — | — |
| `64695` | Chance de Incêndio com Ataques | comum | afecções e chance no acerto | funcional | aplicado | ficha | 0/1 |
| `64709` | Destreza | comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `64769` | Chance de Envenenamentos | comum | afecções e chance no acerto | funcional | validado | ficha | 1/1 |
| `64816` | Dano Corpo a Corpo com Duas Mãos e Dreno | comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional-aproximado | aplicado | ficha | 1/3 |
| `64878` | Dano Elemental da Arma | comum | dano % (aumentado e "mais") | funcional | validado | ficha | 3/3 |
| `64882` | Discipulo do Inflexível | notavel | cargas e fúria, dano % (aumentado e "mais") | funcional | aplicado | ficha | 0/3 |
| `64888` | Efeito das Tinturas | comum | — | sem-efeito | alocavel | — | — |
| `65033` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `65034` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `65053` | Seiva da Essência | notavel | mana e custo, outros | funcional | aplicado | ficha | 2/3 |
| `65093` | Dançarino da Lâmina | notavel | dano % (aumentado e "mais") | parcial | validado | ficha | 2/2 |
| `65097` | Liderança | notavel | auras, maldições e reserva | parcial | aplicado | combate | 0/1 |
| `65107` | Quebra-bastião | notavel | dano % (aumentado e "mais"), outros | funcional | aplicado | ficha | 1/2 |
| `65108` | Incansável | notavel | vida %, mana e custo | funcional | aplicado | ficha | 1/2 |
| `65112` | Máximo de Fortificações | comum | — | sem-efeito | alocavel | — | — |
| `65125` | Duração de Clamores | comum | afecções e chance no acerto | funcional | aplicado | combate | 0/1 |
| `65159` | Velocidade de Ataque e Conjuração de Totens | comum | lacaios e totens | parcial | aplicado | combate | 0/1 |
| `65167` | Vida | comum | vida % | funcional | validado | ficha | 1/1 |
| `65203` | Mana e Regeneração de Mana | comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `65210` | Coração de Carvalho | notavel | vida %, atordoamento | parcial | aplicado | ficha | 1/2 |
| `65224` | Aspecto da Águia | notavel | dano % (aumentado e "mais"), velocidades, precisão | funcional | aplicado | ficha | 2/4 |
| `65273` | Alcance Enigmático | notavel | área e projéteis, efeito por evento, bloqueio | funcional | aplicado | ficha | 0/3 |
| `65308` | Pele de Diamante | notavel | resistências | funcional | validado | ficha | 3/3 |
| `65400` | Recuperação da Recarga de Clamores e Dano de Ataques Impelidos | comum | — | sem-efeito | alocavel | — | — |
| `65427` | Velocidade de Ataque | comum | velocidades | funcional-aproximado | validado | ficha | 1/1 |
| `65456` | Distância do Empurrão | comum | — | sem-efeito | alocavel | — | — |
| `65485` | Armadura por Carga de Tolerância | comum | armadura e evasão | funcional | aplicado | combate | 0/1 |
| `65502` | Perfurador | notavel | crítico | funcional | validado | ficha | 1/1 |
| `89` | Maestria de Minas | maestria | — | sem-efeito | alocavel | — | — |
| `240` | Maestria de Raio | maestria | outros | parcial | aplicado | ficha | 3/4 |
| `292` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `857` | Maestria de Escudo de Energia | maestria | resistências, escudo de energia | parcial | aplicado | combate | 0/3 |
| `1205` | Maestria de Envenenamentos | maestria | outros, afecções e chance no acerto, crítico, efeito por evento | parcial | aplicado | ficha | 3/5 |
| `1215` | Maestria de Evasão e Escudo de Energia | maestria | armadura e evasão, escudo de energia, outros | parcial | aplicado | ficha | 4/5 |
| `2828` | Maestria de Dano Degenerativo | maestria | afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/4 |
| `2841` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `3042` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `3471` | Maestria de Escudo de Energia | maestria | resistências, escudo de energia | parcial | aplicado | combate | 0/3 |
| `3571` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `3883` | Maestria de Evasão | maestria | atordoamento, armadura e evasão, velocidades, outros, supressão de magia | parcial | aplicado | ficha | 1/7 |
| `4139` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `4327` | Maestria de Retaliação | maestria | — | sem-efeito | alocavel | — | — |
| `4424` | Maestria de Machados | maestria | outros, dano % (aumentado e "mais"), cargas e fúria | parcial | aplicado | ficha | 1/4 |
| `4492` | Maestria de Atributos | maestria | atributos (For/Des/Int), dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/4 |
| `4707` | Maestria de Cargas | maestria | outros, afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/5 |
| `4788` | Maestria de Garras | maestria | dano % (aumentado e "mais"), outros | parcial | validado | ficha | 2/2 |
| `5230` | Maestria de Cajados | maestria | efeito por evento, armadura e evasão, escudo de energia, bloqueio, crítico | parcial | aplicado | ficha | 3/8 |
| `5348` | Maestria Elementar | maestria | — | sem-efeito | alocavel | — | — |
| `5368` | Maestria de Bloqueio | maestria | efeito por evento, bloqueio | parcial | aplicado | combate | 0/3 |
| `5726` | Maestria Elementar | maestria | — | sem-efeito | alocavel | — | — |
| `5826` | Maestria de Projéteis | maestria | dano % (aumentado e "mais") | parcial | validado | ficha | 1/1 |
| `6338` | Maestria de Escudo de Energia | maestria | resistências, escudo de energia | parcial | aplicado | combate | 0/3 |
| `6384` | Maestria de Dreno | maestria | outros, armadura e evasão, vida, regeneração e dreno de vida | parcial | aplicado | combate | 4/6 |
| `6427` | Maestria de Arcos | maestria | área e projéteis | parcial | aplicado | combate | 0/1 |
| `6507` | Maestria de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva | parcial | aplicado | combate | 1/6 |
| `6570` | Maestria de Maldições | maestria | afecções e chance no acerto, crítico, efeito por evento, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 4/10 |
| `6588` | Maestria de Atordoamentos | maestria | atordoamento, crítico | parcial | aplicado | ficha | 2/4 |
| `6912` | Maestria de Duas Mãos | maestria | dano % (aumentado e "mais"), velocidades | parcial | aplicado | ficha | 1/6 |
| `6968` | Maestria de Cajados | maestria | efeito por evento, armadura e evasão, escudo de energia, bloqueio, crítico | parcial | aplicado | ficha | 3/8 |
| `7023` | Maestria de Gelo | maestria | outros, efeito por evento, resistências, dano % (aumentado e "mais") | parcial | aplicado | ficha | 4/7 |
| `7488` | Maestria de Dreno | maestria | outros, armadura e evasão, vida, regeneração e dreno de vida | parcial | aplicado | combate | 4/6 |
| `7528` | Maestria de Fúria | maestria | velocidades, cargas e fúria, outros | parcial | aplicado | combate | 2/3 |
| `7634` | Maestria de Adagas | maestria | crítico, supressão de magia, dano % (aumentado e "mais"), velocidades | parcial | aplicado | ficha | 1/3 |
| `8370` | Maestria de Atributos | maestria | atributos (For/Des/Int), dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/4 |
| `8460` | Maestria de Clamores | maestria | efeito por evento | parcial | aplicado | combate | 0/3 |
| `8556` | Maestria de Ataque | maestria | outros, velocidades, mana e custo | parcial | aplicado | combate | 0/5 |
| `8629` | Maestria de Ataque | maestria | outros, velocidades, mana e custo | parcial | aplicado | combate | 0/5 |
| `8732` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `8872` | Maestria de Dupla Empunhadura | maestria | bloqueio, dano % (aumentado e "mais") | parcial | aplicado | ficha | 1/3 |
| `9083` | Maestria Defensiva de Lacaios | maestria | lacaios e totens, vida, regeneração e dreno de vida | parcial | aplicado | combate | 1/2 |
| `9213` | Maestria de Vínculos | maestria | — | sem-efeito | alocavel | — | — |
| `9393` | Maestria de Frascos | maestria | frascos, efeito por evento | parcial | aplicado | combate | 7/8 |
| `9458` | Maestria de Frascos | maestria | frascos, efeito por evento | parcial | aplicado | combate | 7/8 |
| `9471` | Maestria de Fúria | maestria | velocidades, cargas e fúria, outros | parcial | aplicado | combate | 2/3 |
| `9586` | Maestria de Críticos | maestria | crítico, outros | parcial | aplicado | ficha | 1/5 |
| `10141` | Maestria de Recuperação | maestria | efeito por evento, outros, vida, regeneração e dreno de vida | parcial | aplicado | ficha | 0/3 |
| `10166` | Maestria de Minas | maestria | — | sem-efeito | alocavel | — | — |
| `10204` | Maestria de Espadas | maestria | afecções e chance no acerto, cargas e fúria, crítico | parcial | aplicado | ficha | 2/4 |
| `10245` | Maestria de Ataque | maestria | outros, velocidades, mana e custo | parcial | aplicado | combate | 0/5 |
| `10414` | Maestria de Recuperação | maestria | efeito por evento, outros, vida, regeneração e dreno de vida | parcial | aplicado | ficha | 0/3 |
| `10429` | Maestria de Armadilhas | maestria | área e projéteis | parcial | aplicado | combate | 0/1 |
| `10495` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `10729` | Maestria de Escudo de Energia | maestria | resistências, escudo de energia | parcial | aplicado | combate | 0/3 |
| `11032` | Maestria de Evasão e Escudo de Energia | maestria | armadura e evasão, escudo de energia, outros | parcial | aplicado | ficha | 4/5 |
| `11505` | Maestria de Fogo | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `11596` | Maestria de Maça | maestria | outros, área e projéteis, atordoamento | parcial | aplicado | combate | 1/10 |
| `12125` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `12169` | Maestria Física | maestria | outros, afecções e chance no acerto | parcial | aplicado | ficha | 1/2 |
| `12239` | Maestria Física | maestria | outros, afecções e chance no acerto | parcial | aplicado | ficha | 1/2 |
| `12244` | Maestria de Vínculos | maestria | — | sem-efeito | alocavel | — | — |
| `12382` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `12503` | Maestria de Proteção | maestria | auras, maldições e reserva, outros, dano % (aumentado e "mais") | parcial | aplicado | combate | 3/4 |
| `12518` | Maestria de Garras | maestria | dano % (aumentado e "mais"), outros | parcial | validado | ficha | 2/2 |
| `12873` | Maestria de Proteção | maestria | auras, maldições e reserva, outros, dano % (aumentado e "mais") | parcial | aplicado | combate | 3/4 |
| `13387` | Maestria Elementar | maestria | — | sem-efeito | alocavel | — | — |
| `13712` | Domínio de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva | parcial | aplicado | combate | 1/6 |
| `13862` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `14113` | Maestria de Conjuração | maestria | — | sem-efeito | alocavel | — | — |
| `14122` | Maestria de Raio | maestria | outros | parcial | aplicado | ficha | 3/4 |
| `14505` | Maestria Ofensiva de Lacaios | maestria | outros | parcial | aplicado | combate | 0/3 |
| `14832` | Maestria de Maça | maestria | outros, área e projéteis, atordoamento | parcial | aplicado | combate | 1/10 |
| `15409` | Maestria de Adagas | maestria | crítico, supressão de magia, dano % (aumentado e "mais"), velocidades | parcial | aplicado | ficha | 1/3 |
| `15697` | Maestria de Tinturas | maestria | — | sem-efeito | alocavel | — | — |
| `16123` | Maestria de Críticos | maestria | crítico, outros | parcial | aplicado | ficha | 1/5 |
| `16141` | Maestria de Dreno | maestria | outros, armadura e evasão, vida, regeneração e dreno de vida | parcial | aplicado | combate | 4/6 |
| `16810` | Maestria de Escudos | maestria | atordoamento, bloqueio, efeito por evento, afecções e chance no acerto, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 4/6 |
| `17127` | Maestria de Proteção | maestria | auras, maldições e reserva, outros, dano % (aumentado e "mais") | parcial | aplicado | combate | 3/4 |
| `17380` | Maestria de Gelo | maestria | outros, efeito por evento, resistências, dano % (aumentado e "mais") | parcial | aplicado | ficha | 4/7 |
| `17411` | Maestria de Conjuração | maestria | — | sem-efeito | alocavel | — | — |
| `17906` | Maestria de Armadilhas | maestria | área e projéteis | parcial | aplicado | combate | 0/1 |
| `17945` | Domínio de Dano Degenerativo | maestria | afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/4 |
| `18240` | Maestria de Escudo de Energia | maestria | resistências, escudo de energia | parcial | aplicado | combate | 0/3 |
| `18750` | Maestria de Frascos | maestria | frascos, efeito por evento | parcial | aplicado | combate | 7/8 |
| `19050` | Maestria de Garras | maestria | dano % (aumentado e "mais"), outros | parcial | validado | ficha | 2/2 |
| `19725` | Maestria de Atordoamentos | maestria | atordoamento, crítico | parcial | aplicado | ficha | 2/4 |
| `19749` | Maestria de Fogo | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `19750` | Maestria de Armadura e Evasão | maestria | armadura e evasão, atordoamento, outros | parcial | aplicado | combate | 0/7 |
| `20675` | Maestria Física | maestria | outros, afecções e chance no acerto | parcial | aplicado | ficha | 1/2 |
| `20730` | Maestria de Supressão Mágica | maestria | outros | parcial | validado | combate | 1/1 |
| `20736` | Maestria de Frascos | maestria | frascos, efeito por evento | parcial | aplicado | combate | 7/8 |
| `21143` | Maestria de Runas | maestria | — | sem-efeito | alocavel | — | — |
| `21324` | Maestria de Bloqueio | maestria | efeito por evento, bloqueio | parcial | aplicado | combate | 0/3 |
| `21801` | Maestria de Caos | maestria | outros, resistências | parcial | aplicado | combate | 0/3 |
| `22067` | Maestria de Dano Degenerativo | maestria | afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/4 |
| `22295` | Maestria de Sangramento | maestria | crítico, afecções e chance no acerto | parcial | aplicado | ficha | 0/2 |
| `22480` | Maestria de Bloqueio | maestria | efeito por evento, bloqueio | parcial | aplicado | combate | 0/3 |
| `22959` | Maestria de Maldições | maestria | afecções e chance no acerto, crítico, efeito por evento, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 4/10 |
| `22970` | Maestria Defensiva de Lacaios | maestria | lacaios e totens, vida, regeneração e dreno de vida | parcial | aplicado | combate | 1/2 |
| `23547` | Maestria de Caos | maestria | outros, resistências | parcial | aplicado | combate | 0/3 |
| `23796` | Maestria de Maldições | maestria | afecções e chance no acerto, crítico, efeito por evento, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 4/10 |
| `24224` | Maestria de Machados | maestria | outros, dano % (aumentado e "mais"), cargas e fúria | parcial | aplicado | ficha | 1/4 |
| `24334` | Maestria de Vínculos | maestria | — | sem-efeito | alocavel | — | — |
| `24481` | Maestria de Recuperação | maestria | efeito por evento, outros, vida, regeneração e dreno de vida | parcial | aplicado | ficha | 0/3 |
| `24552` | Maestria de Arcos | maestria | área e projéteis | parcial | aplicado | combate | 0/1 |
| `25011` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `25031` | Maestria de Clamores | maestria | efeito por evento | parcial | aplicado | combate | 0/3 |
| `25186` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `25281` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `25313` | Domínio do Conjurador | maestria | — | sem-efeito | alocavel | — | — |
| `25349` | Maestria de Arcos | maestria | área e projéteis | parcial | aplicado | combate | 0/1 |
| `25446` | Maestria de Dreno | maestria | outros, armadura e evasão, vida, regeneração e dreno de vida | parcial | aplicado | combate | 4/6 |
| `25535` | Maestria de Escudos | maestria | atordoamento, bloqueio, efeito por evento, afecções e chance no acerto, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 4/6 |
| `25934` | Maestria de Duas Mãos | maestria | dano % (aumentado e "mais"), velocidades | parcial | aplicado | ficha | 1/6 |
| `26037` | Maestria de Retaliação | maestria | — | sem-efeito | alocavel | — | — |
| `26148` | Maestria de Precisão | maestria | precisão | parcial | aplicado | ficha | 3/4 |
| `26154` | Maestria de Clamores | maestria | efeito por evento | parcial | aplicado | combate | 0/3 |
| `26393` | Maestria Defensiva de Lacaios | maestria | lacaios e totens, vida, regeneração e dreno de vida | parcial | aplicado | combate | 1/2 |
| `26608` | Maestria de Totens | maestria | lacaios e totens | parcial | validado | combate | 1/1 |
| `26697` | Maestria de Espadas | maestria | afecções e chance no acerto, cargas e fúria, crítico | parcial | aplicado | ficha | 2/4 |
| `27157` | Domínio de Precisão | maestria | precisão | parcial | aplicado | ficha | 3/4 |
| `27193` | Maestria de Recuperação | maestria | efeito por evento, outros, vida, regeneração e dreno de vida | parcial | aplicado | ficha | 0/3 |
| `27235` | Maestria de Recuperação | maestria | efeito por evento, outros, vida, regeneração e dreno de vida | parcial | aplicado | ficha | 0/3 |
| `27307` | Maestria de Escudo de Energia | maestria | resistências, escudo de energia | parcial | aplicado | combate | 0/3 |
| `27371` | Maestria de Evasão | maestria | atordoamento, armadura e evasão, velocidades, outros, supressão de magia | parcial | aplicado | ficha | 1/7 |
| `27733` | Maestria de Conjuração | maestria | — | sem-efeito | alocavel | — | — |
| `27865` | Maestria de Arcos | maestria | área e projéteis | parcial | aplicado | combate | 0/1 |
| `27872` | Maestria de Minas | maestria | — | sem-efeito | alocavel | — | — |
| `27931` | Maestria de Maça | maestria | outros, área e projéteis, atordoamento | parcial | aplicado | combate | 1/10 |
| `28039` | Maestria de Machados | maestria | outros, dano % (aumentado e "mais"), cargas e fúria | parcial | aplicado | ficha | 1/4 |
| `28284` | Maestria de Atributos | maestria | atributos (For/Des/Int), dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/4 |
| `28680` | Maestria de Conjuração | maestria | — | sem-efeito | alocavel | — | — |
| `28862` | Maestria de Dreno | maestria | outros, armadura e evasão, vida, regeneração e dreno de vida | parcial | aplicado | combate | 4/6 |
| `28863` | Maestria de Ataque | maestria | outros, velocidades, mana e custo | parcial | aplicado | combate | 0/5 |
| `28903` | Maestria de Envenenamentos | maestria | outros, afecções e chance no acerto, crítico, efeito por evento | parcial | aplicado | ficha | 3/5 |
| `29993` | Maestria de Duração | maestria | afecções e chance no acerto | parcial | aplicado | combate | 1/2 |
| `30393` | Maestria de Armadura e Escudo de Energia | maestria | crítico, armadura e evasão, escudo de energia, auras, maldições e reserva | parcial | aplicado | combate | 0/4 |
| `31039` | Maestria de Críticos | maestria | crítico, outros | parcial | aplicado | ficha | 1/5 |
| `31197` | Maestria de Adagas | maestria | crítico, supressão de magia, dano % (aumentado e "mais"), velocidades | parcial | aplicado | ficha | 1/3 |
| `31291` | Maestria de Espadas | maestria | afecções e chance no acerto, cargas e fúria, crítico | parcial | aplicado | ficha | 2/4 |
| `31292` | Maestria de Maça | maestria | outros, área e projéteis, atordoamento | parcial | aplicado | combate | 1/10 |
| `31400` | Maestria de Empalamento | maestria | outros | parcial | aplicado | combate | 3/4 |
| `31818` | Maestria de Proteção | maestria | auras, maldições e reserva, outros, dano % (aumentado e "mais") | parcial | aplicado | combate | 3/4 |
| `32241` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `32242` | Maestria de Estandartes | maestria | — | sem-efeito | alocavel | — | — |
| `32278` | Maestria Ofensiva de Lacaios | maestria | outros | parcial | aplicado | combate | 0/3 |
| `32509` | Maestria de Conjuração | maestria | — | sem-efeito | alocavel | — | — |
| `32657` | Maestria de Marcas | maestria | — | sem-efeito | alocavel | — | — |
| `33037` | Maestria de Ataques | maestria | outros, velocidades, mana e custo | parcial | aplicado | combate | 0/5 |
| `33657` | Maestria de Proteção | maestria | auras, maldições e reserva, outros, dano % (aumentado e "mais") | parcial | aplicado | combate | 3/4 |
| `33678` | Maestria de Cargas | maestria | outros, afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/5 |
| `33823` | Maestria de Críticos | maestria | crítico, outros | parcial | aplicado | ficha | 1/5 |
| `34317` | Maestria Elementar | maestria | — | sem-efeito | alocavel | — | — |
| `34487` | Maestria de Totens | maestria | lacaios e totens | parcial | validado | combate | 1/1 |
| `34552` | Maestria Ofensiva de Lacaios | maestria | outros | parcial | aplicado | combate | 0/3 |
| `34723` | Maestria de Cargas | maestria | outros, afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/5 |
| `34927` | Maestria de Fogo | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `35038` | Maestria de Varinhas | maestria | crítico, área e projéteis, vida, regeneração e dreno de vida, mana e custo | parcial | aplicado | ficha | 1/4 |
| `35085` | Maestria de Críticos | maestria | crítico, outros | parcial | aplicado | ficha | 1/5 |
| `35118` | Maestria de Duas Mãos | maestria | dano % (aumentado e "mais"), velocidades | parcial | aplicado | ficha | 1/6 |
| `35221` | Maestria de Precisão | maestria | precisão | parcial | aplicado | ficha | 3/4 |
| `35321` | Maestria de Estandartes | maestria | — | sem-efeito | alocavel | — | — |
| `35859` | Maestria de Dreno | maestria | outros, armadura e evasão, vida, regeneração e dreno de vida | parcial | aplicado | combate | 4/6 |
| `35977` | Maestria de Clamores | maestria | efeito por evento | parcial | aplicado | combate | 0/3 |
| `37502` | Maestria de Arcos | maestria | área e projéteis | parcial | aplicado | combate | 0/1 |
| `37532` | Maestria de Raio | maestria | outros | parcial | aplicado | ficha | 3/4 |
| `37616` | Maestria de Armadilhas | maestria | área e projéteis | parcial | aplicado | combate | 0/1 |
| `37641` | Maestria de Armadura e Escudo de Energia | maestria | crítico, armadura e evasão, escudo de energia, auras, maldições e reserva | parcial | aplicado | combate | 0/4 |
| `37698` | Maestria de Atordoamentos | maestria | atordoamento, crítico | parcial | aplicado | ficha | 2/4 |
| `37795` | Maestria de Escudos | maestria | atordoamento, bloqueio, efeito por evento, afecções e chance no acerto, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 4/6 |
| `37911` | Maestria Flamejante | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `37956` | Maestria de Sangramento | maestria | crítico, afecções e chance no acerto | parcial | aplicado | ficha | 0/2 |
| `38207` | Maestria de Gelo | maestria | outros, efeito por evento, resistências, dano % (aumentado e "mais") | parcial | aplicado | ficha | 4/7 |
| `38235` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `38320` | Maestria de Fogo | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `38377` | Maestria de Totens | maestria | lacaios e totens | parcial | validado | combate | 1/1 |
| `38436` | Maestria de Escudos | maestria | atordoamento, bloqueio, efeito por evento, afecções e chance no acerto, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 4/6 |
| `38568` | Maestria de Cegueira | maestria | outros, crítico | parcial | aplicado | ficha | 0/2 |
| `38579` | Maestria de Envenenamentos | maestria | outros, afecções e chance no acerto, crítico, efeito por evento | parcial | aplicado | ficha | 3/5 |
| `38595` | Domínio de Precisão | maestria | precisão | parcial | aplicado | ficha | 3/4 |
| `38622` | Maestria de Tinturas | maestria | — | sem-efeito | alocavel | — | — |
| `38921` | Maestria de Bloqueio | maestria | efeito por evento, bloqueio | parcial | aplicado | combate | 0/3 |
| `39332` | Maestria de Cajados | maestria | efeito por evento, armadura e evasão, escudo de energia, bloqueio, crítico | parcial | aplicado | ficha | 3/8 |
| `39338` | Maestria de Duas Mãos | maestria | dano % (aumentado e "mais"), velocidades | parcial | aplicado | ficha | 1/6 |
| `39416` | Maestria Ofensiva de Lacaios | maestria | outros | parcial | aplicado | combate | 0/3 |
| `39836` | Maestria de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva | parcial | aplicado | combate | 1/6 |
| `40170` | Maestria de Sangramento | maestria | crítico, afecções e chance no acerto | parcial | aplicado | ficha | 0/2 |
| `40196` | Maestria de Conjuração | maestria | — | sem-efeito | alocavel | — | — |
| `40271` | Maestria de Fogo | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `40383` | Maestria de Dreno | maestria | outros, armadura e evasão, vida, regeneração e dreno de vida | parcial | aplicado | combate | 4/6 |
| `40439` | Maestria de Runas | maestria | — | sem-efeito | alocavel | — | — |
| `40698` | Maestria de Fúria | maestria | velocidades, cargas e fúria, outros | parcial | aplicado | combate | 2/3 |
| `41016` | Maestria de Frascos | maestria | frascos, efeito por evento | parcial | aplicado | combate | 7/8 |
| `41163` | Maestria de Evasão | maestria | atordoamento, armadura e evasão, velocidades, outros, supressão de magia | parcial | aplicado | ficha | 1/7 |
| `41225` | Maestria Defensiva de Lacaios | maestria | lacaios e totens, vida, regeneração e dreno de vida | parcial | aplicado | combate | 1/2 |
| `41273` | Domínio de Dano Degenerativo | maestria | afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/4 |
| `41415` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `41522` | Maestria de Duração | maestria | afecções e chance no acerto | parcial | aplicado | combate | 1/2 |
| `41744` | Maestria de Retaliação | maestria | — | sem-efeito | alocavel | — | — |
| `42361` | Maestria de Caos | maestria | outros, resistências | parcial | aplicado | combate | 0/3 |
| `42533` | Maestria de Precisão | maestria | precisão | parcial | aplicado | ficha | 3/4 |
| `42792` | Maestria de Proteção | maestria | auras, maldições e reserva, outros, dano % (aumentado e "mais") | parcial | aplicado | combate | 3/4 |
| `43307` | Maestria de Estandartes | maestria | — | sem-efeito | alocavel | — | — |
| `43495` | Maestria de Dreno | maestria | outros, armadura e evasão, vida, regeneração e dreno de vida | parcial | aplicado | combate | 4/6 |
| `43601` | Maestria de Sangramento | maestria | crítico, afecções e chance no acerto | parcial | aplicado | ficha | 0/2 |
| `43647` | Maestria Ofensiva de Lacaios | maestria | outros | parcial | aplicado | combate | 0/3 |
| `43818` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `44179` | Maestria de Gelo | maestria | outros, efeito por evento, resistências, dano % (aumentado e "mais") | parcial | aplicado | ficha | 4/7 |
| `44206` | Maestria de Tinturas | maestria | — | sem-efeito | alocavel | — | — |
| `44298` | Maestria Elementar | maestria | — | sem-efeito | alocavel | — | — |
| `44316` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `44330` | Maestria de Tinturas | maestria | — | sem-efeito | alocavel | — | — |
| `44540` | Maestria de Armadilhas | maestria | área e projéteis | parcial | aplicado | combate | 0/1 |
| `44948` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `45019` | Maestria de Frascos | maestria | frascos, efeito por evento | parcial | aplicado | combate | 7/8 |
| `45358` | Maestria de Armadura | maestria | armadura e evasão, crítico, resistências | parcial | aplicado | ficha | 0/7 |
| `45372` | Maestria de Ataques | maestria | outros, velocidades, mana e custo | parcial | aplicado | combate | 0/5 |
| `45558` | Maestria de Escudos | maestria | atordoamento, bloqueio, efeito por evento, afecções e chance no acerto, dano % (aumentado e "mais"), crítico | funcional | aplicado | combate | 4/6 |
| `46495` | Maestria de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva | parcial | aplicado | combate | 1/6 |
| `46665` | Maestria de Frascos | maestria | frascos, efeito por evento | parcial | aplicado | combate | 7/8 |
| `46761` | Maestria de Frascos | maestria | frascos, efeito por evento | parcial | aplicado | combate | 7/8 |
| `47059` | Maestria de Empalamento | maestria | outros | parcial | aplicado | combate | 3/4 |
| `47197` | Maestria de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva | parcial | aplicado | combate | 1/6 |
| `47212` | Maestria de Projéteis | maestria | dano % (aumentado e "mais") | parcial | validado | ficha | 1/1 |
| `47242` | Maestria Ofensiva de Lacaios | maestria | outros | parcial | aplicado | combate | 0/3 |
| `47294` | Maestria de Dano Degenerativo | maestria | afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/4 |
| `48007` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `48144` | Maestria de Vínculos | maestria | — | sem-efeito | alocavel | — | — |
| `48267` | Maestria de Fogo | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `48290` | Maestria Defensiva de Lacaios | maestria | lacaios e totens, vida, regeneração e dreno de vida | parcial | aplicado | combate | 1/2 |
| `48349` | Maestria de Cajados | maestria | efeito por evento, armadura e evasão, escudo de energia, bloqueio, crítico | parcial | aplicado | ficha | 3/8 |
| `48411` | Maestria de Varinhas | maestria | crítico, área e projéteis, vida, regeneração e dreno de vida, mana e custo | parcial | aplicado | ficha | 1/4 |
| `48505` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `48508` | Maestria de Totens | maestria | lacaios e totens | parcial | validado | combate | 1/1 |
| `48660` | Maestria Elementar | maestria | — | sem-efeito | alocavel | — | — |
| `48717` | Maestria de Armadura | maestria | armadura e evasão, crítico, resistências | parcial | aplicado | ficha | 0/7 |
| `48859` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `48982` | Maestria de Empalamento | maestria | outros | parcial | aplicado | combate | 3/4 |
| `49391` | Maestria de Ataques | maestria | outros, velocidades, mana e custo | parcial | aplicado | combate | 0/5 |
| `49677` | Maestria de Empalamentos | maestria | outros | parcial | aplicado | combate | 3/4 |
| `49820` | Maestria de Supressão Mágica | maestria | outros | parcial | validado | combate | 1/1 |
| `50071` | Maestria de Dupla Empunhadura | maestria | bloqueio, dano % (aumentado e "mais") | parcial | aplicado | ficha | 1/3 |
| `50540` | Maestria de Maldições | maestria | afecções e chance no acerto, crítico, efeito por evento, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 4/10 |
| `50757` | Maestria de Evasão | maestria | atordoamento, armadura e evasão, velocidades, outros, supressão de magia | parcial | aplicado | ficha | 1/7 |
| `51583` | Maestria de Críticos | maestria | crítico, outros | parcial | aplicado | ficha | 1/5 |
| `51761` | Maestria de Dupla Empunhadura | maestria | bloqueio, dano % (aumentado e "mais") | parcial | aplicado | ficha | 1/3 |
| `51974` | Maestria de Fortificação | maestria | — | sem-efeito | alocavel | — | — |
| `52018` | Maestria de Empunhadura Dupla | maestria | bloqueio, dano % (aumentado e "mais") | parcial | aplicado | ficha | 1/3 |
| `52061` | Maestria de Fúria | maestria | velocidades, cargas e fúria, outros | parcial | aplicado | combate | 2/3 |
| `52074` | Maestria de Empalamento | maestria | outros | parcial | aplicado | combate | 3/4 |
| `52220` | Maestria Física | maestria | outros, afecções e chance no acerto | parcial | aplicado | ficha | 1/2 |
| `52462` | Maestria de Armadura | maestria | armadura e evasão, crítico, resistências | parcial | aplicado | ficha | 0/7 |
| `52875` | Maestria de Ataque | maestria | outros, velocidades, mana e custo | parcial | aplicado | combate | 0/5 |
| `53188` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `53216` | Maestria de Atordoamentos | maestria | atordoamento, crítico | parcial | aplicado | ficha | 2/4 |
| `53365` | Maestria de Garras | maestria | dano % (aumentado e "mais"), outros | parcial | validado | ficha | 2/2 |
| `53517` | Maestria de Recuperação | maestria | efeito por evento, outros, vida, regeneração e dreno de vida | parcial | aplicado | ficha | 0/3 |
| `53615` | Maestria de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva | parcial | aplicado | combate | 1/6 |
| `53738` | Maestria de Minas | maestria | — | sem-efeito | alocavel | — | — |
| `53828` | Maestria de Varinhas | maestria | crítico, área e projéteis, vida, regeneração e dreno de vida, mana e custo | parcial | aplicado | ficha | 1/4 |
| `54340` | Maestria de Armadura | maestria | armadura e evasão, crítico, resistências | parcial | aplicado | ficha | 0/7 |
| `54413` | Maestria de Supressão Mágica | maestria | outros | parcial | validado | combate | 1/1 |
| `54849` | Maestria Ofensiva de Lacaios | maestria | outros | parcial | aplicado | combate | 0/3 |
| `54887` | Maestria de Gelo | maestria | outros, efeito por evento, resistências, dano % (aumentado e "mais") | parcial | aplicado | ficha | 4/7 |
| `55017` | Maestria de Retaliação | maestria | — | sem-efeito | alocavel | — | — |
| `55152` | Maestria de Totens | maestria | lacaios e totens | parcial | validado | combate | 1/1 |
| `55230` | Maestria de Dreno | maestria | outros, armadura e evasão, vida, regeneração e dreno de vida | parcial | aplicado | combate | 4/6 |
| `55281` | Maestria de Estandartes | maestria | — | sem-efeito | alocavel | — | — |
| `55348` | Maestria de Ataque | maestria | outros, velocidades, mana e custo | parcial | aplicado | combate | 0/5 |
| `55491` | Maestria de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva | parcial | aplicado | combate | 1/6 |
| `56023` | Maestria de Projéteis | maestria | dano % (aumentado e "mais") | parcial | validado | ficha | 1/1 |
| `56128` | Maestria de Varinhas | maestria | crítico, área e projéteis, vida, regeneração e dreno de vida, mana e custo | parcial | aplicado | ficha | 1/4 |
| `56519` | Maestria de Tinturas | maestria | — | sem-efeito | alocavel | — | — |
| `56595` | Maestria de Ataque | maestria | outros, velocidades, mana e custo | parcial | aplicado | combate | 0/5 |
| `56865` | Maestria de Marcas | maestria | — | sem-efeito | alocavel | — | — |
| `57949` | Maestria de Dano Degenerativo | maestria | afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/4 |
| `58302` | Maestria de Precisão | maestria | precisão | parcial | aplicado | ficha | 3/4 |
| `58540` | Maestria de Machados | maestria | outros, dano % (aumentado e "mais"), cargas e fúria | parcial | aplicado | ficha | 1/4 |
| `58563` | Maestria de Marcas | maestria | — | sem-efeito | alocavel | — | — |
| `58728` | Maestria de Retaliação | maestria | — | sem-efeito | alocavel | — | — |
| `58816` | Maestria de Raio | maestria | outros | parcial | aplicado | ficha | 3/4 |
| `59013` | Maestria de Maça | maestria | outros, área e projéteis, atordoamento | parcial | aplicado | combate | 1/10 |
| `59335` | Maestria de Fortificação | maestria | — | sem-efeito | alocavel | — | — |
| `59501` | Maestria de Cegueira | maestria | outros, crítico | parcial | aplicado | ficha | 0/2 |
| `59926` | Maestria de Minas | maestria | — | sem-efeito | alocavel | — | — |
| `60170` | Maestria de Gelo | maestria | outros, efeito por evento, resistências, dano % (aumentado e "mais") | parcial | aplicado | ficha | 4/7 |
| `60210` | Maestria de Envenenamentos | maestria | outros, afecções e chance no acerto, crítico, efeito por evento | parcial | aplicado | ficha | 3/5 |
| `60512` | Domínio de Conjuração | maestria | — | sem-efeito | alocavel | — | — |
| `60834` | Maestria de Dano Degenerativo | maestria | afecções e chance no acerto, dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/4 |
| `60992` | Maestria de Clamores | maestria | efeito por evento | parcial | aplicado | combate | 0/3 |
| `61343` | Maestria de Runas | maestria | — | sem-efeito | alocavel | — | — |
| `61529` | Maestria de Recuperação | maestria | efeito por evento, outros, vida, regeneração e dreno de vida | parcial | aplicado | ficha | 0/3 |
| `61785` | Maestria de Maldições | maestria | afecções e chance no acerto, crítico, efeito por evento, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 4/10 |
| `61992` | Maestria Ofensiva de Lacaios | maestria | outros | parcial | aplicado | combate | 0/3 |
| `62015` | Maestria de Clamores | maestria | efeito por evento | parcial | aplicado | combate | 0/3 |
| `62023` | Maestria de Atordoamentos | maestria | atordoamento, crítico | parcial | aplicado | ficha | 2/4 |
| `62235` | Maestria de Armadura e Evasão | maestria | armadura e evasão, atordoamento, outros | parcial | aplicado | combate | 0/7 |
| `62416` | Maestria de Cajados | maestria | efeito por evento, armadura e evasão, escudo de energia, bloqueio, crítico | parcial | aplicado | ficha | 3/8 |
| `62506` | Maestria de Maldições | maestria | afecções e chance no acerto, crítico, efeito por evento, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 4/10 |
| `62588` | Maestria de Vida | maestria | vida, regeneração e dreno de vida, outros, mana e custo | funcional | aplicado | ficha | 1/6 |
| `62759` | Maestria de Marcas | maestria | — | sem-efeito | alocavel | — | — |
| `62853` | Maestria de Adagas | maestria | crítico, supressão de magia, dano % (aumentado e "mais"), velocidades | parcial | aplicado | ficha | 1/3 |
| `63184` | Maestria de Espadas | maestria | afecções e chance no acerto, cargas e fúria, crítico | parcial | aplicado | ficha | 2/4 |
| `63268` | Maestria de Fogo | maestria | outros, efeito por evento, afecções e chance no acerto, vida, regeneração e dreno de vida, crítico, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/8 |
| `63482` | Maestria de Raio | maestria | outros | parcial | aplicado | ficha | 3/4 |
| `63559` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `63710` | Maestria de Sangramento | maestria | crítico, afecções e chance no acerto | parcial | aplicado | ficha | 0/2 |
| `63861` | Maestria de Críticos | maestria | crítico, outros | parcial | aplicado | ficha | 1/5 |
| `64042` | Maestria Física | maestria | outros, afecções e chance no acerto | parcial | aplicado | ficha | 1/2 |
| `64128` | Maestria de Reserva | maestria | dano % (aumentado e "mais"), resistências, auras, maldições e reserva | parcial | aplicado | combate | 1/6 |
| `64406` | Maestria de Armadura | maestria | armadura e evasão, crítico, resistências | parcial | aplicado | ficha | 0/7 |
| `65154` | Maestria de Totens | maestria | lacaios e totens | parcial | validado | combate | 1/1 |
| `65395` | Maestria de Mana | maestria | mana e custo, efeito por evento, outros, auras, maldições e reserva | funcional-aproximado | aplicado | ficha | 0/6 |
| `65528` | Maestria de Evasão | maestria | atordoamento, armadura e evasão, velocidades, outros, supressão de magia | parcial | aplicado | ficha | 1/7 |
| `6982` | Armadura e Evasão, Duração de Provocar [Champion] | ascendencia-comum | armadura e evasão | parcial | validado | combate | 2/2 |
| `11412` | Inspirador [Champion] | ascendencia-notavel | auras, maldições e reserva | parcial | aplicado | combate | 0/1 |
| `13374` | Mestre do Metal [Champion] | ascendencia-notavel | outros | parcial | validado | combate | 1/1 |
| `25111` | Armadura e Evasão, Efeito da Aura [Champion] | ascendencia-comum | armadura e evasão, auras, maldições e reserva | funcional | aplicado | combate | 2/3 |
| `27604` | Primeiro a Bater, Último a Cair [Champion] | ascendencia-notavel | efeito por evento, outros | parcial | validado | combate | 3/3 |
| `31700` | Fortitude [Champion] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `33940` | Herói Incontrolável [Champion] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `35185` | Armadura e Evasão, Dano de Ataque Enquanto Fortificado [Champion] | ascendencia-comum | armadura e evasão | parcial | validado | combate | 2/2 |
| `35750` | Causas Nobres [Champion] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `41433` | Armadura e Evasão, Chance de Empalar [Champion] | ascendencia-comum | armadura e evasão, afecções e chance no acerto | funcional | aplicado | combate | 2/3 |
| `43725` | Armadura e Evasão, Dano de Ataque [Champion] | ascendencia-comum | dano % (aumentado e "mais"), armadura e evasão | funcional | validado | ficha | 3/3 |
| `56967` | Inimigo Digno [Champion] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `60508` | Armadura e Evasão, Dano de Ataque Enquanto Fortificado [Champion] | ascendencia-comum | armadura e evasão | parcial | validado | combate | 2/2 |
| `61478` | Armadura e Evasão, Efeito de Aura [Champion] | ascendencia-comum | armadura e evasão, auras, maldições e reserva | funcional | aplicado | combate | 2/3 |
| `758` | Guerra do Desgaste [Gladiator] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `1675` | Velocidade de Ataque, Chance de Bloqueio [Gladiator] | ascendencia-comum | velocidades, bloqueio | funcional-aproximado | validado | ficha | 2/2 |
| `2598` | Mais Que Habilidade [Gladiator] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `3651` | Velocidade de Ataque e Dano com Uma Mão [Gladiator] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `8419` | Sobrevivente Determinado [Gladiator] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `14726` | Velocidade de Ataque, Dano com Ataques [Gladiator] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional-aproximado | validado | ficha | 2/2 |
| `15616` | Técnica Irregular [Gladiator] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `24538` | Velocidade de Ataque, Chance de Bloqueio [Gladiator] | ascendencia-comum | velocidades, bloqueio | funcional-aproximado | validado | ficha | 2/2 |
| `27864` | Violência Gratuita [Gladiator] | ascendencia-notavel | efeito por evento | funcional-aproximado | aplicado | combate | 0/1 |
| `33179` | Velocidade de Ataque, Chance de Sangramento [Gladiator] | ascendencia-comum | velocidades, afecções e chance no acerto | funcional-aproximado | validado | ficha | 2/2 |
| `37623` | Velocidade de Ataque, Chance de Bloqueio [Gladiator] | ascendencia-comum | velocidades, bloqueio | funcional-aproximado | validado | ficha | 2/2 |
| `48760` | Velocidade de Ataque, Chance de Sangramento [Gladiator] | ascendencia-comum | velocidades, afecções e chance no acerto | funcional-aproximado | validado | ficha | 2/2 |
| `52575` | Mestre das Armas [Gladiator] | ascendencia-notavel | outros, dano % (aumentado e "mais") | parcial | aplicado | ficha | 1/2 |
| `63490` | Retaliação Comedida [Gladiator] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `3184` | Carrasco [Slayer] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `10143` | Fervor Brutal [Slayer] | ascendencia-notavel | outros | parcial | aplicado | combate | 1/2 |
| `15286` | Dano de Ataque, Velocidade de Ataque [Slayer] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional-aproximado | validado | ficha | 2/2 |
| `16306` | Forma Magistral [Slayer] | ascendencia-notavel | cargas e fúria | funcional | aplicado | ficha | 1/2 |
| `17315` | Esmagador [Slayer] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `20954` | Dano de Ataque, Área de Efeito [Slayer] | ascendencia-comum | dano % (aumentado e "mais"), área e projéteis | funcional | aplicado | ficha | 1/2 |
| `34215` | Dano de Ataque, Drenagem de Vida [Slayer] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `34484` | Apetite Insaciável [Slayer] | ascendencia-notavel | outros | parcial | validado | combate | 2/2 |
| `38180` | Impacto [Slayer] | ascendencia-notavel | outros, precisão % | parcial | aplicado | ficha | 1/2 |
| `42293` | Dano de Ataque, Velocidade de Ataque [Slayer] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional-aproximado | validado | ficha | 2/2 |
| `45696` | Dano de Ataque, Drenagem de Vida [Slayer] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `50845` | Dano de Ataque, Duração de Cargas de Frenesi e Tolerância [Slayer] | ascendencia-comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | aplicado | ficha | 2/3 |
| `61393` | Dano de Ataque, Chance de Crítico [Slayer] | ascendencia-comum | dano % (aumentado e "mais"), crítico | funcional | validado | ficha | 2/2 |
| `62817` | Executor de Lendas [Slayer] | ascendencia-notavel | dano % (aumentado e "mais") | parcial | aplicado | ficha | 0/1 |
| `5865` | Dano Físico, Armadura [Berserker] | ascendencia-comum | armadura e evasão, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `8592` | Dano Físico, Alcance de Golpe Corpo a Corpo [Berserker] | ascendencia-comum | outros, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `9271` | Desafiando a Dor [Berserker] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `24528` | Frenesi de Combate [Berserker] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `29630` | Dançarino Sanguinolento [Berserker] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `32251` | Portador da Guerra [Berserker] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `38999` | Fúria Ancestral [Berserker] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `42861` | Dano Físico, Fúria ao Acertar [Berserker] | ascendencia-comum | cargas e fúria, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `48904` | Dano Físico, Vida Roubada por Segundo [Berserker] | ascendencia-comum | outros, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `50024` | Dano Físico, Velocidade do Clamor [Berserker] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | aplicado | ficha | 1/2 |
| `57560` | Ritual da Ruína [Berserker] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `59920` | Aspecto da Carnificina [Berserker] | ascendencia-notavel | dano % (aumentado e "mais") | parcial | aplicado | combate | 0/1 |
| `63583` | Dano Físico, Fúria ao Acertar [Berserker] | ascendencia-comum | cargas e fúria, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `63673` | Dano Físico, Velocidade de Ataque [Berserker] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `982` | Regeneração de Vida, Dano Corpo a Corpo [Chieftain] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `1731` | Hinekora, Fúria da Morte [Chieftain] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `5643` | Regeneração de Vida, Resistência a Fogo [Chieftain] | ascendencia-comum | resistências, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `6028` | Regeneração de Vida, Duração do Clamor [Chieftain] | ascendencia-comum | vida, regeneração e dreno de vida, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `9971` | Regeneração de Vida, Força [Chieftain] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `10238` | Regeneração de Vida, Dano de Fogo [Chieftain] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `14996` | Regeneração de Vida, Dano de Fogo [Chieftain] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `31667` | Sione, Rugido Solar [Chieftain] | ascendencia-notavel | outros | parcial | aplicado | combate | 0/1 |
| `32249` | Valako, Abraço da Tormenta [Chieftain] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `42659` | Regeneração de Vida, Resistência a Fogo [Chieftain] | ascendencia-comum | resistências, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `47486` | Regeneração de Vida, Dano Corpo a Corpo [Chieftain] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `48480` | Tasalio, Água Purificadora [Chieftain] | ascendencia-notavel | outros | parcial | aplicado | combate | 0/1 |
| `50692` | Ngamahu, Avanço da Chama [Chieftain] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `53095` | Tukohama, Arauto da Guerra [Chieftain] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `61355` | Ramako, Luz do Sol [Chieftain] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `1734` | Inabalável [Juggernaut] | ascendencia-notavel | cargas e fúria, afecções e chance no acerto | parcial | aplicado | ficha | 1/3 |
| `5819` | Incontrolável [Juggernaut] | ascendencia-notavel | velocidades, atordoamento | parcial | aplicado | ficha | 1/2 |
| `16093` | Armadura, Regeneração de Vida [Juggernaut] | ascendencia-comum | armadura e evasão, vida, regeneração e dreno de vida | funcional | validado | ficha | 2/2 |
| `17988` | Incansável [Juggernaut] | ascendencia-notavel | vida, regeneração e dreno de vida | parcial | aplicado | ficha | 0/1 |
| `23972` | Armadura, Duração da Carga de Tolerância [Juggernaut] | ascendencia-comum | armadura e evasão, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `32115` | Armadura, Velocidade de Ataque [Juggernaut] | ascendencia-comum | velocidades, armadura e evasão | funcional-aproximado | validado | ficha | 2/2 |
| `44297` | Inegável [Juggernaut] | ascendencia-notavel | precisão | parcial | validado | ficha | 1/1 |
| `49153` | Armadura, Duração da Carga de Tolerância [Juggernaut] | ascendencia-comum | armadura e evasão, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `51998` | Armadura, Resistência a Caos [Juggernaut] | ascendencia-comum | armadura e evasão, resistências | funcional | validado | ficha | 2/2 |
| `53816` | Inquebrável [Juggernaut] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `56789` | Implacável [Juggernaut] | ascendencia-notavel | cargas e fúria | funcional | aplicado | combate | 0/2 |
| `62349` | Armadura, Duração de Atordoamento [Juggernaut] | ascendencia-comum | armadura e evasão, atordoamento | funcional | validado | combate | 2/2 |
| `62595` | Inflexível [Juggernaut] | ascendencia-notavel | dano % (aumentado e "mais"), área e projéteis, atordoamento | funcional | aplicado | ficha | 0/4 |
| `63417` | Armadura, Velocidade de Movimento [Juggernaut] | ascendencia-comum | armadura e evasão, velocidades | funcional | validado | ficha | 2/2 |
| `1729` | Dano de Projétil, Duração do Arqueiro Ilusório [Deadeye] | ascendencia-comum | dano % (aumentado e "mais") | parcial | validado | ficha | 1/1 |
| `2872` | Força Ocupante [Deadeye] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `5082` | Dano de Projétil, Precisão [Deadeye] | ascendencia-comum | dano % (aumentado e "mais"), precisão % | funcional | validado | ficha | 2/2 |
| `5443` | Ponto Focal [Deadeye] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `22852` | Danod e Projétil, Velocidade de Ataque [Deadeye] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `23169` | Guarda do Vento [Deadeye] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `24848` | Ventania [Deadeye] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `26067` | Munições Infinitas [Deadeye] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `28995` | Dano de Projétil, Velocidade de Projétil [Deadeye] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `44482` | Avidez [Deadeye] | ascendencia-notavel | cargas e fúria | parcial | validado | ficha | 1/1 |
| `45313` | Tiro Distante [Deadeye] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `53086` | Dano de Projétil, Velocidade de Conjuração de Marca [Deadeye] | ascendencia-comum | dano % (aumentado e "mais") | parcial | validado | ficha | 1/1 |
| `55985` | Dano com Projéteis, Precisão [Deadeye] | ascendencia-comum | dano % (aumentado e "mais"), precisão % | funcional | validado | ficha | 2/2 |
| `56134` | Dano de Projétil, Precisão [Deadeye] | ascendencia-comum | dano % (aumentado e "mais"), precisão % | funcional | validado | ficha | 2/2 |
| `59837` | Dano de Projétil, Velocidade de Ataque [Deadeye] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional-aproximado | validado | ficha | 2/2 |
| `61627` | Ricochete [Deadeye] | ascendencia-notavel | área e projéteis | parcial | aplicado | combate | 0/1 |
| `62136` | Dano de Projétil, Duração do Arqueiro Ilusório [Deadeye] | ascendencia-comum | dano % (aumentado e "mais") | parcial | validado | ficha | 1/1 |
| `64028` | Dano de Projétil, Velocidade de Projétil [Deadeye] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `1697` | Mestre Toxista [Pathfinder] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `6038` | Mestre Destilador [Pathfinder] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `14156` | Efeito e Duração do Frasco [Pathfinder] | ascendencia-comum | frascos | funcional | aplicado | combate | 1/2 |
| `20480` | Efeito do Frasco, Duração do Envenenamento [Pathfinder] | ascendencia-comum | frascos, afecções e chance no acerto | funcional | aplicado | ficha | 0/2 |
| `32640` | Efeito do Frasco e Cargas Recebidas [Pathfinder] | ascendencia-comum | frascos | funcional | aplicado | combate | 1/2 |
| `32662` | Efeito do Frasco, Dano de Caos [Pathfinder] | ascendencia-comum | dano % (aumentado e "mais"), frascos | funcional | aplicado | ficha | 0/2 |
| `36242` | Efeito e Duração do Frasco [Pathfinder] | ascendencia-comum | frascos | funcional | aplicado | combate | 1/2 |
| `40631` | Efeito do Frasco e Cargas Recebidas [Pathfinder] | ascendencia-comum | frascos | funcional | aplicado | combate | 1/2 |
| `40813` | Represália da Natureza [Pathfinder] | ascendencia-notavel | efeito por evento | parcial | aplicado | combate | 0/1 |
| `51101` | Adrenalina da Natureza [Pathfinder] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `59800` | Efeito de Frascos e Cargas Recebidas [Pathfinder] | ascendencia-comum | frascos | funcional | aplicado | combate | 1/2 |
| `61805` | Mestre Alquimista [Pathfinder] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `63293` | Mestre Cirurgiã [Pathfinder] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `65296` | Dádiva da Natureza [Pathfinder] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `2060` | Evasão, Efeito de Tinturas [Warden] | ascendencia-comum | armadura e evasão | parcial | validado | combate | 1/1 |
| `4849` | Ensinamentos da Mãe [Warden] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `5926` | Evasão, Chance de Eletrização [Warden] | ascendencia-comum | armadura e evasão, afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `11597` | Lição das Estações [Warden] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `12146` | Evasão, Supressão Mágica [Warden] | ascendencia-comum | supressão de magia, armadura e evasão | funcional | validado | ficha | 2/2 |
| `15550` | Evasão, Duração de Afecções Elementais [Warden] | ascendencia-comum | armadura e evasão, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `16848` | Juramento do Inverno [Warden] | ascendencia-notavel | outros | parcial | validado | ficha | 1/1 |
| `19488` | Evasão, Efeito de Tinturas [Warden] | ascendencia-comum | armadura e evasão | parcial | validado | combate | 1/1 |
| `24214` | Evasão, Efeito de Tinturas [Warden] | ascendencia-comum | armadura e evasão | parcial | validado | combate | 1/1 |
| `24432` | Evasão, Chance de Incendiar [Warden] | ascendencia-comum | armadura e evasão, afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `27536` | Evasão, Supressão Mágica [Warden] | ascendencia-comum | supressão de magia, armadura e evasão | funcional | validado | ficha | 2/2 |
| `29662` | Herbalista Experiente [Warden] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `31364` | Juramento da Primavera [Warden] | ascendencia-notavel | outros | funcional | validado | ficha | 2/2 |
| `33645` | Juramento do Verão [Warden] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `36958` | Caçador Experiente [Warden] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `40104` | Sufusão Persistente [Warden] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `53421` | Evasão, Chance de Congelamento [Warden] | ascendencia-comum | armadura e evasão, afecções e chance no acerto | funcional | validado | ficha | 2/2 |
| `55509` | Avatar da Selva [Warden] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `58650` | Evasão, Efeito de Tinturas [Warden] | ascendencia-comum | armadura e evasão | parcial | validado | combate | 1/1 |
| `61761` | Evasão, Duração de Afecções Elementais [Warden] | ascendencia-comum | armadura e evasão, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `63940` | Evasão, Duração de Afecções Elementais [Warden] | ascendencia-comum | armadura e evasão, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `193` | Força [Ascendant] | ascendencia-comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `607` | Força e Destreza [Ascendant] | ascendencia-comum | atributos (For/Des/Int) | funcional | validado | ficha | 2/2 |
| `772` | Ascensão do Sombra [Ascendant] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `2521` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `4194` | Berserker [Ascendant] | ascendencia-comum | dano % (aumentado e "mais"), vida, regeneração e dreno de vida, mana e custo | parcial | aplicado | combate | 0/3 |
| `6778` | Trapaceiro [Ascendant] | ascendencia-comum | escudo de energia | parcial | validado | combate | 1/1 |
| `7618` | Caminho da Caçadora [Ascendant] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `8281` | Elementalista [Ascendant] | ascendencia-comum | outros, lacaios e totens | parcial | validado | ficha | 2/2 |
| `8656` | Protetora [Ascendant] | ascendencia-comum | supressão de magia, penetração | parcial | aplicado | ficha | 1/2 |
| `9327` | Desbravadora [Ascendant] | ascendencia-comum | velocidades | parcial | interpretado | condicional | 0/2 |
| `10099` | Necromante [Ascendant] | ascendencia-comum | lacaios e totens | parcial | validado | combate | 1/1 |
| `12597` | Ocultista [Ascendant] | ascendencia-comum | outros, auras, maldições e reserva, escudo de energia | parcial | aplicado | combate | 1/3 |
| `15435` | Ascensão do Templário [Ascendant] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `17445` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `22551` | Força e Inteligência [Ascendant] | ascendencia-comum | atributos (For/Des/Int) | funcional | validado | ficha | 2/2 |
| `24755` | Caminho do Marauder [Ascendant] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `24798` | Ascensão do Duelista [Ascendant] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `30690` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `30919` | Guardião [Ascendant] | ascendencia-comum | auras, maldições e reserva | parcial | aplicado | combate | 0/1 |
| `31598` | Destreza [Ascendant] | ascendencia-comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `33875` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `34567` | Atiradora [Ascendant] | ascendencia-comum | outros | parcial | aplicado | ficha | 0/1 |
| `34774` | Gladiador [Ascendant] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `38689` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `39598` | Campeão [Ascendant] | ascendencia-comum | auras, maldições e reserva | parcial | aplicado | combate | 0/1 |
| `41534` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `41996` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `42144` | Hierofante [Ascendant] | ascendencia-comum | mana %, lacaios e totens | parcial | validado | ficha | 2/2 |
| `42546` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `42671` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `43122` | Assassino [Ascendant] | ascendencia-comum | crítico, efeito por evento | parcial | aplicado | ficha | 0/2 |
| `43195` | Executor [Ascendant] | ascendencia-comum | outros, área e projéteis | parcial | aplicado | combate | 1/3 |
| `43336` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `43962` | Inquisidor [Ascendant] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `45403` | Destreza e Inteligência [Ascendant] | ascendencia-comum | atributos (For/Des/Int) | funcional | validado | ficha | 2/2 |
| `49532` | Ascensão da Caçadora [Ascendant] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `51782` | Ascensão da Bruxa [Ascendant] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `53992` | Caminho do Sombra [Ascendant] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `54877` | Caminho do Templário [Ascendant] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `56722` | Caminho da Bruxa [Ascendant] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `57052` | Chefe Guerreiro [Ascendant] | ascendencia-comum | outros, atributos (For/Des/Int) | parcial | aplicado | ficha | 0/3 |
| `57429` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `58029` | Inteligência [Ascendant] | ascendencia-comum | atributos (For/Des/Int) | funcional | validado | ficha | 1/1 |
| `58827` | Sabotador [Ascendant] | ascendencia-comum | área e projéteis, outros | parcial | aplicado | ficha | 0/2 |
| `61072` | Destruidor [Ascendant] | ascendencia-comum | precisão, outros, atordoamento, dano % (aumentado e "mais") | parcial | aplicado | ficha | 1/4 |
| `61437` | Ascensão do Marauder [Ascendant] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `62162` | Ponto de Passiva [Ascendant] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `63357` | Caminho do Duelista [Ascendant] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `1564` | Guarda-costas Leal [Luminary] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `1977` | Cintos Lendários [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `15900` | Juramento de Fidelidade [Luminary] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `19993` | Botas Lendárias [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `25944` | Armas Lendárias [Luminary] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `27123` | Vida de Mercenário, Campo de Visão [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `30675` | Velocidade de Conjuração de Conexão, Campo de Visão [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `31517` | Glória Dourada [Luminary] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `32095` | Elmos Lendários [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `32669` | Amuletos Lendários [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `35877` | Dano de Mercenário, Campo de Visão [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `43645` | Anéis Lendários [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `46479` | Sangue Nobre [Luminary] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `52633` | Luvas Lendárias [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `56292` | Sagração à Cavalaria [Luminary] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `61133` | Vida de Mercenário, Campo de Visão [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `63954` | Velocidade de Conjuração de Conexão, Campo de Visão [Luminary] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `2460` | Mostruário de Armas de Conjurador [Reliquarian] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `2768` | União da Carne [Reliquarian] | ascendencia-comum | resistências | parcial | aplicado | combate | 0/3 |
| `8081` | As Areias do Tempo [Reliquarian] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `8967` | Gritos dos Dessecados [Reliquarian] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `9258` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `12003` | Mostruário de Armas Marciais [Reliquarian] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `15544` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `16633` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `16994` | Carícia Vaal [Reliquarian] | ascendencia-comum | efeito por evento, outros | funcional | aplicado | combate | 0/2 |
| `17386` | Alavanca de Xirgil [Reliquarian] | ascendencia-comum | outros | parcial | aplicado | combate | 0/1 |
| `18147` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `20160` | Espigão de Fidelitas [Reliquarian] | ascendencia-comum | afecções e chance no acerto, outros, auras, maldições e reserva | parcial | aplicado | ficha | 1/3 |
| `22441` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `22628` | Rompe-amanhecer [Reliquarian] | ascendencia-comum | outros | funcional | aplicado | combate | 0/3 |
| `25795` | Chamas de Ngamahu [Reliquarian] | ascendencia-comum | penetração | parcial | aplicado | ficha | 0/1 |
| `26055` | A Divindade Despedaçada [Reliquarian] | ascendencia-comum | atributos (For/Des/Int) | parcial | validado | ficha | 2/2 |
| `27054` | Lâmina de Cinturão Verde [Reliquarian] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `33467` | Vínculo de Kaom [Reliquarian] | ascendencia-comum | atributos (For/Des/Int) | parcial | aplicado | ficha | 0/1 |
| `35448` | Raízes de Kaom [Reliquarian] | ascendencia-comum | vida, regeneração e dreno de vida, atordoamento | parcial | aplicado | ficha | 1/2 |
| `35936` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `35989` | Mostruário de Pedrarias [Reliquarian] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `36072` | Presa Sombria [Reliquarian] | ascendencia-comum | área e projéteis | parcial | aplicado | combate | 0/1 |
| `36489` | Mostruário de Armaduras [Reliquarian] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `37303` | O Bastão Negro [Reliquarian] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `40276` | Autoridade de Cadigan [Reliquarian] | ascendencia-comum | crítico, bloqueio | parcial | aplicado | combate | 0/2 |
| `43857` | Presa de Arakaali [Reliquarian] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `47058` | Poder de Ahn [Reliquarian] | ascendencia-comum | cargas e fúria | parcial | validado | ficha | 1/1 |
| `48040` | Ambição de Veruso [Reliquarian] | ascendencia-comum | supressão de magia, afecções e chance no acerto, efeito por evento | funcional | aplicado | ficha | 2/3 |
| `48410` | Devastação Polárica [Reliquarian] | ascendencia-comum | afecções e chance no acerto, efeito por evento | funcional | aplicado | ficha | 2/3 |
| `52094` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `54569` | Presença de Chayula [Reliquarian] | ascendencia-comum | atordoamento, vida, regeneração e dreno de vida | funcional | aplicado | ficha | 0/2 |
| `54928` | O Cálice Sagrado [Reliquarian] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `56940` | A Apóstata [Reliquarian] | ascendencia-comum | vida, regeneração e dreno de vida | parcial | aplicado | ficha | 0/1 |
| `59067` | Fêmures dos Santos [Reliquarian] | ascendencia-comum | bloqueio, velocidades, vida, regeneração e dreno de vida, mana e custo | funcional | interpretado | condicional | 0/5 |
| `60582` | Ponto Passivo [Reliquarian] | ascendencia-comum | outros | funcional | validado | combate | 1/1 |
| `1945` | Infusão Mística [Assassin] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `4242` | Infusão Instável [Assassin] | ascendencia-notavel | crítico, cargas e fúria | funcional | aplicado | ficha | 1/3 |
| `6064` | Chance e Multiplicador de Crítico [Assassin] | ascendencia-comum | crítico | funcional | validado | ficha | 2/2 |
| `9014` | Chance e Multiplicador de Crítico [Assassin] | ascendencia-comum | crítico | funcional | validado | ficha | 2/2 |
| `12850` | Chance de Crítico, Duração da Carga de Poder [Assassin] | ascendencia-comum | afecções e chance no acerto, crítico | funcional | aplicado | ficha | 1/2 |
| `18335` | Na Jugular [Assassin] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `19083` | Assassinar [Assassin] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `19598` | Entrega Tóxica [Assassin] | ascendencia-notavel | crítico | parcial | aplicado | ficha | 0/1 |
| `21192` | Toxinas Infundidas [Assassin] | ascendencia-notavel | outros | funcional | aplicado | combate | 0/1 |
| `21264` | Apunhalada [Assassin] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `23024` | Chance de Causar Golpe Crítico, Chance de Envenenamento [Assassin] | ascendencia-comum | afecções e chance no acerto, crítico | funcional | validado | ficha | 2/2 |
| `28782` | Andarilho da Névoa [Assassin] | ascendencia-notavel | efeito por evento, outros | parcial | aplicado | combate | 0/2 |
| `29844` | Sangue Sombreado [Assassin] | ascendencia-notavel | vida, regeneração e dreno de vida, outros | funcional | aplicado | combate | 0/5 |
| `33954` | Chance de Causar Golpe Crítico, Dano Mágico [Assassin] | ascendencia-comum | dano % (aumentado e "mais"), crítico | funcional | aplicado | ficha | 1/2 |
| `43215` | Chance de Golpes Críticos, Efeito Elusivo [Assassin] | ascendencia-comum | outros, crítico | funcional | aplicado | ficha | 1/2 |
| `46676` | Estilo de Assassinato [Assassin] | ascendencia-notavel | — | nao-classificado | alocavel | — | — |
| `47531` | Chance de Causar Golpe Crítico, Chance de Envenenamento [Assassin] | ascendencia-comum | afecções e chance no acerto, crítico | funcional | validado | ficha | 2/2 |
| `48239` | Mortífero [Assassin] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `51402` | Chance de Causar Golpe Crítico, Vida [Assassin] | ascendencia-comum | vida %, crítico | funcional | validado | ficha | 2/2 |
| `55686` | Chance de Causar Golpe Crítico, Efeito de Marca [Assassin] | ascendencia-comum | crítico | parcial | validado | ficha | 1/1 |
| `869` | Área de Efeito, Velocidade de Movimento [Saboteur] | ascendencia-comum | velocidades, área e projéteis | funcional | aplicado | ficha | 1/2 |
| `1953` | Área de Efeito, Velocidade de Arremessar Armadilhas e Minas [Saboteur] | ascendencia-comum | área e projéteis, velocidades | funcional | aplicado | combate | 0/3 |
| `5087` | Nascido nas Sombras [Saboteur] | ascendencia-notavel | auras, maldições e reserva | parcial | aplicado | combate | 0/1 |
| `14103` | Risco Calculado [Saboteur] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `16212` | Área de Efeito, Velocidade de Arremesso de Armadilhas [Saboteur] | ascendencia-comum | área e projéteis, velocidades | funcional | aplicado | combate | 0/2 |
| `16940` | Ataque Cegante [Saboteur] | ascendencia-notavel | outros | parcial | aplicado | combate | 0/2 |
| `25167` | Área de Efeito, Velocidade de Arremesso de Minas [Saboteur] | ascendencia-comum | área e projéteis, velocidades | funcional | aplicado | combate | 0/2 |
| `26446` | Área de Efeito, Velocidade de Arremesso de Armadilhas [Saboteur] | ascendencia-comum | área e projéteis, velocidades | funcional | aplicado | combate | 0/2 |
| `28535` | Crime Perfeito [Saboteur] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `38918` | Reação em Cadeia [Saboteur] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `39834` | Especialista em Demolições [Saboteur] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `41081` | Área de Efeito, Velocidade de Movimento [Saboteur] | ascendencia-comum | velocidades, área e projéteis | funcional | aplicado | ficha | 1/2 |
| `47366` | Área de Efeito, Velocidade de Arremesso de Minas [Saboteur] | ascendencia-comum | área e projéteis, velocidades | funcional | aplicado | combate | 0/2 |
| `47778` | Especialista em Bombas [Saboteur] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `51462` | Como Relógio [Saboteur] | ascendencia-notavel | outros | parcial | aplicado | ficha | 0/1 |
| `57175` | Especialista de Estilhaços [Saboteur] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `62067` | Área de Efeito, Dano em Área [Saboteur] | ascendencia-comum | área e projéteis, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `63135` | Área de Efeito, Dano de Área [Saboteur] | ascendencia-comum | área e projéteis, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `64785` | Velocidade de Projétil, Dano de Projétil [Saboteur] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `64842` | Área de Efeito, Efeito de Cegamentos [Saboteur] | ascendencia-comum | área e projéteis, outros | funcional | aplicado | combate | 0/2 |
| `65085` | Velocidade de Projétil, Dano de Projétil [Saboteur] | ascendencia-comum | velocidades, dano % (aumentado e "mais") | funcional | aplicado | ficha | 1/2 |
| `2336` | Evasão e Escudo de Energia, Dreno de Escudo de Energia [Trickster] | ascendencia-comum | armadura e evasão, escudo de energia | funcional | aplicado | combate | 2/3 |
| `13219` | Evasão e Escudo de Energia, Dano [Trickster] | ascendencia-comum | dano % (aumentado e "mais"), armadura e evasão, escudo de energia | funcional | validado | ficha | 3/3 |
| `19587` | Evasão e Escudo de Energia, Velocidade de Movimento [Trickster] | ascendencia-comum | armadura e evasão, escudo de energia, velocidades | funcional | validado | ficha | 3/3 |
| `23225` | Um Passo a Frente [Trickster] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `28884` | Parada Cardíaca [Trickster] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `29825` | Arte do Escape [Trickster] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `32947` | Assassino Hábil [Trickster] | ascendencia-notavel | afecções e chance no acerto, cargas e fúria | funcional | aplicado | ficha | 1/2 |
| `35598` | Evasão e Escudo de Energia, Velocidade de Ataque e Conjuração [Trickster] | ascendencia-comum | armadura e evasão, escudo de energia, velocidades | funcional | validado | ficha | 4/4 |
| `37191` | Evasão e Escudo de Energia, Duração de Cargas de Frenesi [Trickster] | ascendencia-comum | armadura e evasão, escudo de energia, afecções e chance no acerto | funcional | validado | ficha | 3/3 |
| `41891` | Quebra-Feitiço [Trickster] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `48999` | Bebedor de Almas [Trickster] | ascendencia-notavel | escudo de energia | funcional | validado | combate | 2/2 |
| `55867` | Polímata [Trickster] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `58454` | Evasão e Escudo de Energia, Recarga do Escudo de Energia [Trickster] | ascendencia-comum | armadura e evasão, escudo de energia | funcional | validado | ficha | 3/3 |
| `63908` | Evasão e Escudo de Energia, Velocidade de Movimento [Trickster] | ascendencia-comum | armadura e evasão, escudo de energia, velocidades | funcional | validado | ficha | 3/3 |
| `3458` | Marechal da Divindade [Guardian] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `4494` | Cruzada Radiante [Guardian] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `5929` | Efeito da Chama Santificada [Guardian] | ascendencia-comum | — | sem-efeito | alocavel | — | — |
| `16745` | Armadura e Escudo de Energia, Dano do Lacaio [Guardian] | ascendencia-comum | armadura e evasão, escudo de energia, lacaios e totens | funcional | validado | combate | 3/3 |
| `19641` | Cruzada Implacável [Guardian] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `20050` | Armadura e Escudo de Energia, Efeito de Aura [Guardian] | ascendencia-comum | armadura e evasão, escudo de energia, auras, maldições e reserva | funcional | aplicado | combate | 2/3 |
| `32364` | Armadura e Escudo de Energia, Regeneração de Vida [Guardian] | ascendencia-comum | armadura e evasão, escudo de energia, vida, regeneração e dreno de vida | funcional | validado | ficha | 3/3 |
| `32992` | Armadura e Escudo de Energia, Recuperação do Bloqueio [Guardian] | ascendencia-comum | armadura e evasão, escudo de energia | parcial | validado | combate | 2/2 |
| `37419` | Armadura e Escudo de Energia, Efeito de Aura [Guardian] | ascendencia-comum | armadura e evasão, escudo de energia, auras, maldições e reserva | funcional | aplicado | combate | 2/3 |
| `39728` | Baluarte da Esperança [Guardian] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `40010` | Armadura e Escudo de Energia, Dano do Lacaio [Guardian] | ascendencia-comum | armadura e evasão, escudo de energia, lacaios e totens | funcional | validado | combate | 3/3 |
| `42264` | Fé Radiante [Guardian] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `46952` | Armadura e Escudo de Energia, Efeito de Bônus de Altar [Guardian] | ascendencia-comum | armadura e evasão, escudo de energia, outros | funcional | aplicado | combate | 2/3 |
| `55146` | Hora da Necessidade [Guardian] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `61372` | Harmonia do Propósito [Guardian] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `64768` | Fé Inabalável [Guardian] | ascendencia-notavel | auras, maldições e reserva | funcional | aplicado | combate | 0/1 |
| `922` | Orientação Divina [Hierophant] | ascendencia-notavel | mana % | parcial | validado | ficha | 1/1 |
| `1105` | Busca da Fé [Hierophant] | ascendencia-notavel | lacaios e totens, velocidades | parcial | aplicado | combate | 1/2 |
| `11046` | Regeneração de Mana, Mana [Hierophant] | ascendencia-comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `14870` | Regeneração de Mana, Velocidade de Posicionamento de Totem [Hierophant] | ascendencia-comum | mana e custo, velocidades | funcional | aplicado | ficha | 1/2 |
| `22637` | Regeneração de Mana, Mana [Hierophant] | ascendencia-comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `25651` | Convicção de Poder [Hierophant] | ascendencia-notavel | cargas e fúria | funcional | aplicado | ficha | 2/4 |
| `26714` | Regeneração de Mana, Velocidade de Posicionamento de Totem [Hierophant] | ascendencia-comum | mana e custo, velocidades | funcional | aplicado | ficha | 1/2 |
| `29026` | Santuário do Pensamento [Hierophant] | ascendencia-notavel | mana e custo | parcial | aplicado | ficha | 0/1 |
| `29994` | Regeneração de Mana, Mana [Hierophant] | ascendencia-comum | mana %, mana e custo | funcional | validado | ficha | 2/2 |
| `33167` | Regeneração de Mana, Efeito da Fúria Arcana [Hierophant] | ascendencia-comum | mana e custo | parcial | validado | ficha | 1/1 |
| `34434` | Ritual do Despertar [Hierophant] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `38387` | Regeneração de Mana, Dano da Runa [Hierophant] | ascendencia-comum | mana e custo, dano % (aumentado e "mais") | funcional | validado | ficha | 2/2 |
| `40510` | Benção Arcana [Hierophant] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `44797` | Regeneração de Mana, Efeito da Fúria Arcana [Hierophant] | ascendencia-comum | mana e custo | parcial | validado | ficha | 1/1 |
| `51492` | Sinal de Propósito [Hierophant] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `60462` | Devoção Iluminada [Hierophant] | ascendencia-notavel | afecções e chance no acerto, vida, regeneração e dreno de vida | parcial | interpretado | condicional | 0/3 |
| `662` | Dano Elemental, Multiplicador de Crítico [Inquisitor] | ascendencia-comum | dano % (aumentado e "mais"), crítico | funcional | validado | ficha | 4/4 |
| `3154` | Instrumentos de Justiça [Inquisitor] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `10635` | Dano Elemental, Regeneração de Vida [Inquisitor] | ascendencia-comum | vida, regeneração e dreno de vida, dano % (aumentado e "mais") | funcional | validado | ficha | 4/4 |
| `13851` | Instrumentos do Fervor [Inquisitor] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `19417` | Instrumentos da Virtude [Inquisitor] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `27055` | Dano Elemental, Velocidade de Ataque e Conjuração [Inquisitor] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 5/5 |
| `32816` | Caminho Piedoso [Inquisitor] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `35739` | Dano Elemental, Ataque e Velocidade de Conjuração [Inquisitor] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 5/5 |
| `37486` | Dano Elemental, Multiplicador de Crítico [Inquisitor] | ascendencia-comum | dano % (aumentado e "mais"), crítico | funcional | validado | ficha | 4/4 |
| `39790` | Santificar [Inquisitor] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `40059` | Presságio do Arrependimento [Inquisitor] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `43193` | Dano Elemental, Velocidade de Ataque e Conjuração [Inquisitor] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 5/5 |
| `48214` | Julgamento Inevitável [Inquisitor] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `53884` | Justa Providência [Inquisitor] | ascendencia-notavel | atributos (For/Des/Int) | parcial | validado | ficha | 2/2 |
| `57222` | Dano Elemental, Regeneração de Vida [Inquisitor] | ascendencia-comum | vida, regeneração e dreno de vida, dano % (aumentado e "mais") | funcional | validado | ficha | 4/4 |
| `60769` | Dano Elemental e Resistências [Inquisitor] | ascendencia-comum | resistências, dano % (aumentado e "mais") | funcional | validado | ficha | 6/6 |
| `258` | Arauto da Ruína [Elementalist] | ascendencia-notavel | auras, maldições e reserva | parcial | aplicado | combate | 0/1 |
| `4917` | Bastião dos Elementos [Elementalist] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `6052` | Dano Elemental e Resistências [Elementalist] | ascendencia-comum | resistências, dano % (aumentado e "mais") | funcional | validado | ficha | 6/6 |
| `12475` | Dano Elemental, Efeito de Afecção de Gelo [Elementalist] | ascendencia-comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 4/4 |
| `12738` | Dano Elemental, Multiplicador de Dano de Fogo [Elementalist] | ascendencia-comum | afecções e chance no acerto, dano % (aumentado e "mais") | funcional | validado | ficha | 4/4 |
| `19595` | Dano Elemental, Velocidade de Ataque e Conjuração [Elementalist] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 5/5 |
| `27038` | Modelador das Tormentas [Elementalist] | ascendencia-notavel | afecções e chance no acerto, outros | funcional | aplicado | ficha | 2/6 |
| `37114` | Dano Elemental, Velocidade de Ataque e Conjuração [Elementalist] | ascendencia-comum | dano % (aumentado e "mais"), velocidades | funcional | validado | ficha | 5/5 |
| `40810` | Modelador do Inverno [Elementalist] | ascendencia-notavel | outros | funcional | aplicado | ficha | 2/6 |
| `47873` | Dano Elemental e Resistências [Elementalist] | ascendencia-comum | resistências, dano % (aumentado e "mais") | funcional | validado | ficha | 6/6 |
| `53123` | Modelador das Chamas [Elementalist] | ascendencia-notavel | afecções e chance no acerto, outros | parcial | aplicado | ficha | 1/5 |
| `54279` | Dano Elemental e Resistências [Elementalist] | ascendencia-comum | resistências, dano % (aumentado e "mais") | funcional | validado | ficha | 6/6 |
| `56461` | Suserano do Primordial [Elementalist] | ascendencia-notavel | lacaios e totens | parcial | validado | combate | 1/1 |
| `57197` | Coração da Destruição [Elementalist] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `58998` | Dano Elemental, Efeito de Afecção de Raio [Elementalist] | ascendencia-comum | dano % (aumentado e "mais"), afecções e chance no acerto | funcional | validado | ficha | 4/4 |
| `61259` | Gênio da Discórdia [Elementalist] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `3554` | Gula por Essências [Necromancer] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `5415` | Dano do Lacaio, Efeito de Aura [Necromancer] | ascendencia-comum | lacaios e totens, auras, maldições e reserva | funcional | aplicado | combate | 1/2 |
| `11490` | Portador da Infestação [Necromancer] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `14603` | Barreira Óssea [Necromancer] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `18309` | Dano de Lacaios, Duração de Habilidades [Necromancer] | ascendencia-comum | afecções e chance no acerto, lacaios e totens | funcional | aplicado | combate | 1/2 |
| `18574` | Dano de Lacaio, Mana [Necromancer] | ascendencia-comum | mana %, lacaios e totens | funcional | validado | ficha | 2/2 |
| `23509` | Dano de Lacaio, Velocidade de Conjuração [Necromancer] | ascendencia-comum | velocidades, lacaios e totens | funcional | validado | ficha | 2/2 |
| `23572` | Pacto Cadavérico [Necromancer] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `26298` | Vida e Dano de Lacaios [Necromancer] | ascendencia-comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `36017` | Comandante das Trevas [Necromancer] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `39818` | Vida e Dano de Lacaios [Necromancer] | ascendencia-comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `48719` | Dama do Sacrifício [Necromancer] | ascendencia-notavel | afecções e chance no acerto | parcial | aplicado | combate | 0/1 |
| `54159` | Agressão Desmedida [Necromancer] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `55646` | Dano e Vida de Lacaios [Necromancer] | ascendencia-comum | vida, regeneração e dreno de vida, lacaios e totens | funcional | validado | combate | 2/2 |
| `60547` | Dano de Lacaios, Velocidade de Conjuração [Necromancer] | ascendencia-comum | velocidades, lacaios e totens | funcional | validado | ficha | 2/2 |
| `65153` | Força Sobrenatural [Necromancer] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `5502` | Rito Profano [Occultist] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `6728` | Escudo de Energia, Duração de Cargas de Poder [Occultist] | ascendencia-comum | escudo de energia, afecções e chance no acerto | funcional | aplicado | ficha | 1/2 |
| `17018` | Escudo de Energia, Duração de Maldições [Occultist] | ascendencia-comum | escudo de energia, auras, maldições e reserva | funcional | aplicado | combate | 1/2 |
| `25309` | Presença Pútrida [Occultist] | ascendencia-notavel | resistências | parcial | validado | ficha | 1/1 |
| `27096` | Farol do Além [Occultist] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `29161` | Escudo de Energia e Velocidade de Recarga do Escudo de Energia [Occultist] | ascendencia-comum | escudo de energia | funcional | validado | ficha | 2/2 |
| `31316` | Escudo de Energia, Dano de Caos [Occultist] | ascendencia-comum | dano % (aumentado e "mais"), escudo de energia | funcional | aplicado | ficha | 1/2 |
| `31344` | Autoridade Profana [Occultist] | ascendencia-notavel | outros | funcional | validado | combate | 2/2 |
| `31984` | Escudo de Energia, Duração de Maldições [Occultist] | ascendencia-comum | escudo de energia, auras, maldições e reserva | funcional | aplicado | combate | 1/2 |
| `32417` | Escudo de Energia, Dano de Caos e Gelo [Occultist] | ascendencia-comum | dano % (aumentado e "mais"), escudo de energia | funcional | aplicado | ficha | 2/3 |
| `37127` | Florescer Profano [Occultist] | ascendencia-notavel | — | sem-efeito | alocavel | — | — |
| `37492` | Bastião Vil [Occultist] | ascendencia-notavel | escudo de energia | parcial | aplicado | combate | 0/1 |
| `43242` | Escudo de Energia, Dano de Gelo [Occultist] | ascendencia-comum | dano % (aumentado e "mais"), escudo de energia | funcional | validado | ficha | 2/2 |
| `47630` | Despertar Frígido [Occultist] | ascendencia-notavel | outros | parcial | aplicado | combate | 0/2 |
| `48124` | Escudo de Energia, Velocidade da Recarga de Escudo de Energia [Occultist] | ascendencia-comum | escudo de energia | funcional | validado | ficha | 2/2 |
| `50935` | Escudo de Energia, Velocidade da Recarga de Escudo de Energia [Occultist] | ascendencia-comum | escudo de energia | funcional | validado | ficha | 2/2 |
| `62504` | Poder Proibido [Occultist] | ascendencia-notavel | área e projéteis, dano % (aumentado e "mais"), outros, cargas e fúria | funcional | aplicado | ficha | 1/4 |
